// S5a Spike — 컴포넌트 시제품 (비교, 시뮬레이션, 과정)과 대체 시각 요소. 브라우저 전용.
// 제품 코드가 아니다.
(function (g) {
  const V = g.S5A_VALIDATE;
  const failures = [];
  const listeners = [];

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : v);
    }
    for (const ch of [].concat(children || [])) if (ch) node.append(ch);
    return node;
  }
  const fmt = (n, digits) => Number(n).toLocaleString("ko-KR", { maximumFractionDigits: digits === undefined ? 1 : digits });
  const signed = (n, digits) => (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n), digits);
  const chip = (kind) => el("span", { class: "chip chip-" + kind, text: kind === "fact" ? "보도 수치" : kind === "assumed" ? "가정값" : "직접 바꾼 값" });
  const sourceLine = (c) => el("p", { class: "w-src", text: "자료: " + c.source.label + " · 기준 시점 " + c.source.asOf });
  const head = (spec) => el("header", { class: "w-head" }, [el("h3", { text: spec.title }), el("p", { class: "w-guide", text: spec.guide })]);

  // ── 비교 ─────────────────────────────────────────────
  function renderComparison(c) {
    const spec = c.spec;
    const base = spec.options.find((o) => o.key === spec.baseline);
    const others = spec.options.filter((o) => o.key !== spec.baseline);
    let selected = others[0].key;
    const rows = el("div", { class: "cmp-rows", "data-output": true, "aria-live": "polite" });
    const seg = el("div", { class: "seg", role: "group", "aria-label": "견줄 대상 고르기" });

    function draw() {
      const sel = spec.options.find((o) => o.key === selected);
      rows.replaceChildren();
      for (const m of spec.metrics) {
        const all = spec.options.map((o) => V.computeMetric(spec, m, o.key));
        const max = Math.max(...all);
        const b = V.computeMetric(spec, m, base.key);
        const s = V.computeMetric(spec, m, sel.key);
        const d = s - b;
        // 비율(0~100%)은 원 그래프로, 그 밖의 수치는 세로 막대로 그린다. 글자는 수치와 이름만 남긴다
        const isPct = m.unit === "%" && all.every((v) => v >= 0 && v <= 100);
        const chart = el("div", { class: "vchart" }, spec.options.map((o, i) => {
          const on = o.key === selected;
          const mark = isPct
            ? el("span", { class: "pie", style: "--p:" + all[i] })
            : el("span", { class: "vbar-track" }, el("span", { class: "vbar", style: "height:" + Math.max(4, (all[i] / max) * 100) + "%" }));
          return el("button", { type: "button", class: "vcol" + (on ? " on" : ""), "aria-pressed": String(on), onclick: () => { selected = o.key; draw(); } }, [
            el("strong", { text: fmt(all[i]) + m.unit }), mark, el("span", { class: "vlabel", text: o.label }),
          ]);
        }));
        rows.append(
          el("section", { class: "cmp-metric" }, [
            el("div", { class: "cmp-metric-head" }, [
              el("h4", { text: m.label }),
              sel.key === base.key ? null : el("span", { class: "diff" + (d === 0 ? " diff-same" : ""), text: d === 0 ? base.label + "과 같음" : base.label + "보다 " + signed(d) + m.unit }),
            ]),
            chart,
          ])
        );
      }
      for (const btn of seg.children) btn.setAttribute("aria-pressed", String(btn.dataset.key === selected));
    }
    for (const o of spec.options) seg.append(el("button", { type: "button", "data-key": o.key, text: o.label, onclick: () => { selected = o.key; draw(); } }));
    draw();
    return el("div", { class: "w w-cmp" }, [head(spec), seg, rows, sourceLine(c)]);
  }

  // ── 시뮬레이션 ───────────────────────────────────────
  function renderSimulation(c) {
    const spec = c.spec;
    const values = {};
    for (const inp of spec.inputs) values[inp.key] = inp.default.v;
    const out = el("div", { class: "sim-out", "data-output": true, "aria-live": "polite" });
    const controls = el("div", { class: "sim-controls" });
    const redraws = [];

    function kindOf(inp) {
      const v = values[inp.key];
      const refs = [inp.default].concat((inp.marks || []).map((m) => m.value));
      const hit = refs.find((r) => r.v === v);
      if (hit) return hit.assumed ? "assumed" : "fact";
      return "custom";
    }
    function draw() {
      const res = V.computeSim(spec, values);
      out.replaceChildren();
      for (const o of spec.outputs) {
        const kids = [el("span", { class: "sim-out-label", text: o.label }), el("strong", { class: "sim-out-value" }, [fmt(res[o.key], o.digits), el("small", { text: " " + o.unit })])];
        if (spec.compare) {
          const before = V.computeSim(spec, Object.assign({}, values, { [spec.compare.input]: spec.compare.from.v }))[o.key];
          const d = res[o.key] - before;
          kids.push(el("span", { class: "diff" + (Math.abs(d) < 1e-9 ? " diff-same" : ""), text: Math.abs(d) < 1e-9 ? spec.compare.label + " 차이 없음" : spec.compare.label + " " + signed(d, o.digits) + o.unit }));
        }
        out.append(el("div", { class: "sim-out-item" }, kids));
      }
      redraws.forEach((fn) => fn());
    }
    for (const inp of spec.inputs) {
      const id = "in-" + c.id + "-" + inp.key;
      const valueText = el("span", { class: "sim-value" });
      const chipSlot = el("span", {});
      const range = el("input", {
        type: "range", id, min: inp.min, max: inp.max, step: inp.step, value: inp.default.v,
        oninput: (e) => { values[inp.key] = Number(e.target.value); draw(); },
      });
      const marks = el("div", { class: "marks" });
      for (const mk of inp.marks || []) {
        marks.append(el("button", { type: "button", class: "mark", text: mk.label + " " + fmt(mk.value.v, 2) + inp.unit, onclick: () => { values[inp.key] = mk.value.v; range.value = mk.value.v; draw(); } }));
      }
      redraws.push(() => {
        valueText.textContent = fmt(values[inp.key], 2) + inp.unit;
        chipSlot.replaceChildren(chip(kindOf(inp)));
        for (const b of marks.children) b.setAttribute("aria-pressed", String(b.textContent.startsWith((inp.marks.find((m) => m.value.v === values[inp.key]) || {}).label + " ")));
      });
      controls.append(
        el("div", { class: "sim-input" }, [
          el("div", { class: "sim-input-head" }, [el("label", { for: id, text: inp.label }), el("span", { class: "sim-input-val" }, [valueText, chipSlot])]),
          range,
          marks.children.length ? marks : null,
          inp.default.assumed ? el("p", { class: "w-note", text: "가정값: " + inp.default.note + ". 보도된 수치가 아닙니다." }) : null,
        ])
      );
    }
    draw();
    const consts = (spec.constants || []).map((k) => el("p", { class: "w-note", text: "가정: " + k.label + "." }));
    return el("div", { class: "w w-sim" }, [head(spec), out, controls].concat(consts, [sourceLine(c)]));
  }

  // ── 과정 ─────────────────────────────────────────────
  function renderProcess(c) {
    const spec = c.spec;
    const steps = spec.steps;
    let at = spec.current !== undefined ? spec.current : 0;
    const dots = el("ol", { class: "dots" });
    const card = el("div", { class: "proc-card", "data-output": true, "aria-live": "polite" });
    const prev = el("button", { type: "button", class: "nav", "data-prev": true, text: "이전", onclick: () => go(at - 1) });
    const next = el("button", { type: "button", class: "nav nav-next", "data-next": true, text: "다음", onclick: () => go(at + 1) });

    function go(i) { at = Math.min(steps.length - 1, Math.max(0, i)); draw(); }
    function draw() {
      const s = steps[at];
      const state = spec.current === undefined ? "" : at < spec.current ? "지나온 단계" : at === spec.current ? "지금 여기" : "남은 단계";
      card.replaceChildren(
        el("p", { class: "proc-pos" }, [el("span", { text: at + 1 + " / " + steps.length + "단계" }), state ? el("span", { class: "proc-state" + (at === spec.current ? " proc-now" : ""), text: state }) : null]),
        el("h4", { text: s.title }),
        el("p", { class: "proc-body", text: s.body }),
        s.figure ? el("p", { class: "proc-figure" }, [el("span", { text: s.figure.label }), el("strong", { text: fmt(s.figure.value.v) + s.figure.unit }), chip(s.figure.value.assumed ? "assumed" : "fact")]) : null
      );
      [...dots.children].forEach((li, i) => {
        const b = li.firstChild;
        b.setAttribute("aria-current", i === at ? "step" : "false");
        b.className = "dot" + (spec.current !== undefined && i < spec.current ? " dot-done" : "") + (i === spec.current ? " dot-now" : "");
      });
      prev.disabled = at === 0;
      next.disabled = at === steps.length - 1;
    }
    steps.forEach((s, i) => dots.append(el("li", {}, el("button", { type: "button", "aria-label": i + 1 + "단계 " + s.title, text: String(i + 1), onclick: () => go(i) }))));
    draw();
    return el("div", { class: "w w-proc" }, [head(spec), dots, card, el("div", { class: "proc-nav" }, [prev, next]), sourceLine(c)]);
  }

  // ── 대체 시각 요소: 사실 목록만으로 그린다 (FR-D-08) ─────────
  function renderFallback(c) {
    const facts = (Array.isArray(c.facts) ? c.facts : []).filter((f) => f && typeof f.text === "string");
    if (facts.length === 0) throw new Error("대체 시각 요소를 그릴 사실 목록이 없다");
    const withValue = facts.filter((f) => typeof f.value === "number");
    const cards = el("div", { class: "fb-cards" }, withValue.slice(0, 6).map((f) => el("div", { class: "fb-card" }, [el("strong", { text: fmt(f.value) + (f.unit || "") }), el("span", { text: f.text })])));
    const rest = facts.filter((f) => !withValue.slice(0, 6).includes(f));
    const src = c.source && c.source.label ? el("p", { class: "w-src", text: "자료: " + c.source.label + " · 기준 시점 " + c.source.asOf }) : null;
    return el("div", { class: "w w-fallback" }, [
      el("header", { class: "w-head" }, [el("h3", { text: "핵심 사실 한눈에" })]),
      withValue.length ? cards : null,
      rest.length ? el("ul", { class: "fb-list" }, rest.map((f) => el("li", { text: f.text }))) : null,
      src,
    ]);
  }

  const RENDER = { comparison: renderComparison, simulation: renderSimulation, process: renderProcess };

  function recordFailure(c, kind, message) {
    const item = { id: c && c.id, kind, message, at: new Date().toISOString() };
    failures.push(item);
    listeners.forEach((fn) => fn(item));
  }

  // 검증을 통과한 스펙만 조작형으로 그린다. 실패하면 대체 시각 요소를 넣고 실패를 기록한다.
  function mount(box, c, opts) {
    box.replaceChildren();
    box.dataset.case = c.id || "";
    box.dataset.type = c.type || "";
    try {
      const res = V.validateCase(c);
      if (!res.ok) throw Object.assign(new Error(res.errors.map((e) => e.code + " " + e.msg).join(" / ")), { kind: "검증 실패" });
      if (opts && opts.forceRenderError) throw Object.assign(new Error("일부러 일으킨 표시 오류"), { kind: "표시 실패" });
      box.append(RENDER[c.type](c));
      box.dataset.mode = "interactive";
    } catch (e) {
      recordFailure(c, e.kind || "표시 실패", String(e.message));
      box.replaceChildren();
      try {
        box.append(renderFallback(c));
        box.dataset.mode = "fallback";
      } catch (e2) {
        // 시각 요소가 하나도 없는 상태. 제품에서는 발행하지 않고 결함으로 다룬다 (FR-D-17).
        box.dataset.mode = "none";
        recordFailure(c, "대체 시각 요소 실패", String(e2.message));
      }
    }
  }

  // 화면에서 실제로 값을 바꿔 보고 결과가 달라지는지, 가로로 넘치지 않는지 확인한다.
  function selfTest() {
    const results = [];
    document.querySelectorAll("[data-case]").forEach((box) => {
      const id = box.dataset.case;
      if (box.dataset.mode !== "interactive") {
        results.push({ id, check: "대체 시각 요소가 표시됨", ok: box.dataset.mode === "fallback" && box.children.length > 0 });
      } else {
        const out = box.querySelector("[data-output]");
        const before = out.textContent;
        let restore;
        if (box.dataset.type === "simulation") {
          const r = box.querySelector("input[type=range]");
          const old = r.value;
          r.value = Number(r.value) === Number(r.max) ? r.min : r.max;
          r.dispatchEvent(new Event("input", { bubbles: true }));
          restore = () => { r.value = old; r.dispatchEvent(new Event("input", { bubbles: true })); };
        } else if (box.dataset.type === "comparison") {
          const btns = [...box.querySelectorAll(".seg button")];
          const cur = btns.find((b) => b.getAttribute("aria-pressed") === "true");
          btns.find((b) => b !== cur).click();
          restore = () => cur.click();
        } else {
          const nx = box.querySelector("[data-next]");
          const pv = box.querySelector("[data-prev]");
          if (!nx.disabled) { nx.click(); restore = () => pv.click(); } else { pv.click(); restore = () => nx.click(); }
        }
        const after = out.textContent;
        restore();
        results.push({ id, check: "값을 바꾸면 결과가 달라짐", ok: before !== after && out.textContent === before });
      }
      results.push({ id, check: "가로로 넘치지 않음", ok: box.scrollWidth <= box.clientWidth + 1 });
    });
    results.push({ id: "페이지", check: "페이지가 가로로 스크롤되지 않음", ok: document.documentElement.scrollWidth <= window.innerWidth + 1 });
    return results;
  }

  g.S5A = { mount, selfTest, failures, onFailure: (fn) => listeners.push(fn), renderFallback };
})(globalThis);
