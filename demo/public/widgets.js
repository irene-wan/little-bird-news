// 조작형 설명(비교, 시뮬레이션, 과정)과 요약 카드를 목표 시안의 틀로 그린다.
// AI가 만든 스펙은 validate.js의 검증을 통과해야 조작형으로 그려진다. 통과하지 못하면 사실 목록으로 요약 카드를 그린다.
(function (g) {
  const V = g.S5A_VALIDATE;
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k === "html") node.innerHTML = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : v);
    }
    for (const ch of [].concat(children || [])) if (ch) node.append(ch);
    return node;
  }
  const icon = (name, cls) => `<svg class="icon ${cls || ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${g.ICONS[name] || g.ICONS.info}</svg>`;
  const fmt = (n, digits) => Number(n).toLocaleString("ko-KR", { maximumFractionDigits: digits === undefined ? 1 : digits });
  const signed = (n, digits) => (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n), digits);
  // 큰 수는 읽기 쉬운 단위로 줄인다 (표시만 바꾼다)
  function short(v, unit) {
    const a = Math.abs(v);
    if (/원|달러|명|개|건|곳|대|가구/.test(unit || "") && a >= 1e8) return fmt(v / 1e8, 1) + "억" + unit;
    if (/원|달러|명|개|건|곳|대|가구/.test(unit || "") && a >= 1e4) return fmt(v / 1e4, 1) + "만" + unit;
    return fmt(v) + (unit || "");
  }
  const caption = (c, extra) => el("p", { class: "demo-caption", text: (extra ? extra + " · " : "") + "자료: " + c.source.label + " · 기준 시점 " + c.source.asOf });
  const title = (spec) => el("h3", { class: "wb-title", text: spec.title });

  // ── 비교: 대상을 카드로 나란히 놓고, 고른 대상과 기준의 차이를 크게 보여 준다 ──
  function renderComparison(c) {
    const spec = c.spec, base = spec.options.find((o) => o.key === spec.baseline);
    let selected = (spec.options.find((o) => o.key !== spec.baseline) || base).key, mi = 0;
    const tabs = el("div", { class: "skills" }), grid = el("div", { class: "compare-wrap" }), diff = el("div", { class: "difference", "aria-live": "polite" });
    function draw() {
      const m = spec.metrics[mi], all = spec.options.map((o) => V.computeMetric(spec, m, o.key)), max = Math.max(...all.map(Math.abs)) || 1;
      const isPct = m.unit === "%" && all.every((v) => v >= 0 && v <= 100);
      grid.style.gridTemplateColumns = `repeat(${spec.options.length === 3 ? 3 : 2},minmax(0,1fr))`;
      grid.replaceChildren(...spec.options.map((o, i) => {
        const on = o.key === selected;
        const viz = isPct ? el("span", { class: "pie", style: "--p:" + all[i] }) : el("span", { class: "vbar-track" }, el("span", { class: "vbar", style: "height:" + Math.max(5, (Math.abs(all[i]) / max) * 100) + "%" }));
        return el("div", { class: "metric-card" + (on ? " active" : "") }, el("button", { type: "button", "aria-pressed": String(on), onclick: () => { selected = o.key; draw(); } }, [
          el("span", { class: "small", text: o.label }), el("strong", { text: short(all[i], m.unit) }), viz,
        ]));
      }));
      const s = V.computeMetric(spec, m, selected), b = V.computeMetric(spec, m, base.key), d = s - b, sel = spec.options.find((o) => o.key === selected);
      diff.replaceChildren(
        el("strong", { text: selected === base.key ? short(b, m.unit) : signed(d) + (m.unit === "%" ? "%p" : m.unit) }),
        el("p", { text: selected === base.key ? base.label + " · " + m.label : m.label + " · " + sel.label + "이(가) " + base.label + "보다 " + (d === 0 ? "같음" : d > 0 ? "높음" : "낮음") })
      );
      for (const t of tabs.children) t.setAttribute("aria-pressed", String(Number(t.dataset.i) === mi));
    }
    spec.metrics.forEach((m, i) => tabs.append(el("button", { type: "button", class: "skill", "data-i": i, text: m.label, onclick: () => { mi = i; draw(); } })));
    draw();
    return el("div", { class: "workbench" }, [title(spec), spec.metrics.length > 1 ? tabs : null, grid, diff, caption(c, "카드를 눌러 견줄 대상을 바꿔 보세요")]);
  }

  // ── 과정: 단계를 눌러 흐름을 따라간다 ──
  function renderProcess(c) {
    const spec = c.spec, steps = spec.steps;
    let at = 0;
    const track = el("div", { class: "step-track", style: `grid-template-columns:repeat(${steps.length > 4 ? 3 : steps.length},1fr)` });
    const content = el("div", { class: "step-content", "aria-live": "polite" }), pos = el("span"), prev = el("button", { type: "button", class: "solidbtn previousbtn", html: icon("arrow-left", "icon-sm") + " 이전", onclick: () => go(at - 1) }), next = el("button", { type: "button", class: "solidbtn", html: "다음 " + icon("arrow-right", "icon-sm"), onclick: () => go(at + 1) });
    function go(i) { at = Math.min(steps.length - 1, Math.max(0, i)); draw(); }
    function draw() {
      const s = steps[at];
      const fig = s.figure ? el("div", { class: "step-figure" }, [el("span", { html: icon(c.iconName || "activity", "icon-lg") }), el("div", {}, [el("strong", { text: short(s.figure.value.v, s.figure.unit) }), el("small", { text: s.figure.label })])]) : null;
      content.style.gridTemplateColumns = fig ? "" : "1fr";
      content.replaceChildren(el("div", {}, [el("h3", { text: s.title }), el("p", { text: s.body })]), fig || "");
      [...track.children].forEach((b, i) => b.setAttribute("aria-pressed", String(i === at)));
      pos.textContent = at + 1 + " / " + steps.length + " 단계 · 직접 눌러 탐색";
      prev.disabled = at === 0; next.disabled = at === steps.length - 1;
    }
    steps.forEach((s, i) => track.append(el("button", { type: "button", class: "step-btn", onclick: () => go(i) }, [el("span", { class: "stepnum", text: "0" + (i + 1) + " / 0" + steps.length }), el("span", { class: "stepname", text: s.title })])));
    draw();
    return el("div", { class: "workbench" }, [title(spec), track, content, el("div", { class: "step-nav" }, [pos, el("div", { class: "step-buttons" }, [prev, next])]), caption(c)]);
  }

  // ── 시뮬레이션: 값을 움직이면 결과가 계산된다 ──
  function renderSimulation(c) {
    const spec = c.spec, values = {};
    for (const inp of spec.inputs) values[inp.key] = inp.default.v;
    const out = el("div", { class: "difference sim-result", "aria-live": "polite" }), controls = el("div", { class: "sim-controls" }), redraws = [];
    function draw() {
      const res = V.computeSim(spec, values);
      out.replaceChildren(...spec.outputs.map((o) => {
        const kids = [el("strong", { text: short(Number(res[o.key].toFixed(o.digits === undefined ? 1 : o.digits)), o.unit) }), el("p", { text: o.label })];
        if (spec.compare) {
          const before = V.computeSim(spec, Object.assign({}, values, { [spec.compare.input]: spec.compare.from.v }))[o.key], d = res[o.key] - before;
          if (Math.abs(d) > 1e-9) kids.push(el("p", { class: "sim-diff", text: spec.compare.label + " " + signed(d, o.digits) + o.unit }));
        }
        return el("div", {}, kids);
      }));
      redraws.forEach((fn) => fn());
    }
    for (const inp of spec.inputs) {
      const id = "in-" + c.id + "-" + inp.key, valueText = el("strong", { class: "sim-value" });
      const range = el("input", { type: "range", id, min: inp.min, max: inp.max, step: inp.step, value: inp.default.v, oninput: (e) => { values[inp.key] = Number(e.target.value); draw(); } });
      const marks = el("div", { class: "skills" });
      for (const mk of inp.marks || []) marks.append(el("button", { type: "button", class: "skill", "data-v": mk.value.v, text: mk.label, onclick: () => { values[inp.key] = mk.value.v; range.value = mk.value.v; draw(); } }));
      redraws.push(() => { valueText.textContent = fmt(values[inp.key], 2) + inp.unit; for (const b of marks.children) b.setAttribute("aria-pressed", String(Number(b.dataset.v) === values[inp.key])); });
      controls.append(el("div", { class: "sim-input" }, [
        el("div", { class: "sim-head" }, [el("label", { for: id, text: inp.label }), valueText]), range, marks.children.length ? marks : null,
        inp.default.assumed ? el("p", { class: "sim-note", text: "처음 값은 설명을 위한 가정이에요: " + String(inp.default.note || "").replace(/\bF\d+(의|에서|,)?\s*/g, "") }) : null,
      ]));
    }
    draw();
    const consts = (spec.constants || []).map((k) => el("p", { class: "sim-note", text: "가정: " + k.label }));
    return el("div", { class: "workbench" }, [title(spec), out, controls].concat(consts, [caption(c, "값을 움직여 보세요")]));
  }

  // ── 요약 카드: 사실 목록의 숫자만으로 그린다 ──
  function renderFallback(c) {
    const facts = (Array.isArray(c.facts) ? c.facts : []).filter((f) => f && typeof f.text === "string"), nums = facts.filter((f) => typeof f.value === "number").slice(0, 4);
    if (!facts.length) throw new Error("사실 목록이 없다");
    const list = nums.length >= 2 ? nums : facts.slice(0, 3);
    return el("div", { class: "workbench" }, [
      el("div", { class: "compare-wrap fact-cards" }, list.map((f) => el("div", { class: "metric-card" }, [typeof f.value === "number" ? el("strong", { text: short(f.value, f.unit) }) : null, el("span", { class: "small", text: f.text })]))),
      c.source && c.source.label ? caption(c) : null,
    ]);
  }

  const RENDER = { comparison: renderComparison, simulation: renderSimulation, process: renderProcess };
  function mount(box, c) {
    box.replaceChildren();
    try {
      const res = V.validateCase(c);
      if (!res.ok) throw new Error("검증 실패");
      box.append(RENDER[c.type](c)); box.dataset.mode = "interactive";
    } catch (e) {
      box.replaceChildren();
      try { box.append(renderFallback(c)); box.dataset.mode = "fallback"; } catch (e2) { box.dataset.mode = "none"; }
    }
  }
  g.WIDGETS = { mount, icon };
})(globalThis);
