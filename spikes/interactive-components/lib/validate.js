// S5a Spike — 인터랙티브 스펙 검증. 브라우저와 Node가 같은 코드를 쓴다.
// 제품 코드가 아니다. docs/research/spikes/interactive-components.md 참조.
(function (g) {
  const TYPES = ["comparison", "simulation", "process"];
  // 식 안에 직접 쓸 수 있는 숫자는 단위 환산용뿐이다. 그 밖의 숫자는 사실 ID나 가정값 표시가 있어야 한다.
  const UNIT_LITERALS = [1, 10, 12, 100, 1000, 10000];
  const FUNCS = { min: Math.min, max: Math.max, round: Math.round };

  function tokenize(expr) {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
      const ch = expr[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (/[0-9.]/.test(ch)) {
        let j = i;
        while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
        const n = Number(expr.slice(i, j));
        if (!Number.isFinite(n)) throw new Error("잘못된 숫자: " + expr.slice(i, j));
        tokens.push({ t: "num", v: n });
        i = j;
        continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        let j = i;
        while (j < expr.length && /[A-Za-z0-9_]/.test(expr[j])) j++;
        tokens.push({ t: "id", v: expr.slice(i, j) });
        i = j;
        continue;
      }
      if ("+-*/(),".includes(ch)) { tokens.push({ t: ch }); i++; continue; }
      throw new Error("허용되지 않는 문자: " + ch);
    }
    return tokens;
  }

  // 사칙연산, 괄호, min/max/round만 계산한다. 코드를 실행하지 않는다.
  function evalFormula(expr, vars) {
    const tokens = tokenize(String(expr));
    let p = 0;
    const take = (t) => (tokens[p] && tokens[p].t === t ? tokens[p++] : null);
    function primary() {
      const tk = tokens[p++];
      if (!tk) throw new Error("식이 끝나지 않았다");
      if (tk.t === "num") return tk.v;
      if (tk.t === "-") return -primary();
      if (tk.t === "(") {
        const v = sum();
        if (!take(")")) throw new Error("괄호가 닫히지 않았다");
        return v;
      }
      if (tk.t === "id") {
        if (take("(")) {
          if (!Object.hasOwn(FUNCS, tk.v)) throw new Error("모르는 함수: " + tk.v);
          const args = [sum()];
          while (take(",")) args.push(sum());
          if (!take(")")) throw new Error("괄호가 닫히지 않았다");
          return FUNCS[tk.v](...args);
        }
        if (!Object.hasOwn(vars, tk.v)) throw new Error("모르는 이름: " + tk.v);
        return vars[tk.v];
      }
      throw new Error("잘못된 식");
    }
    function product() {
      let v = primary();
      for (;;) {
        if (take("*")) v *= primary();
        else if (take("/")) v /= primary();
        else return v;
      }
    }
    function sum() {
      let v = product();
      for (;;) {
        if (take("+")) v += product();
        else if (take("-")) v -= product();
        else return v;
      }
    }
    const out = sum();
    if (p < tokens.length) throw new Error("식 뒤에 남은 내용이 있다");
    if (!Number.isFinite(out)) throw new Error("계산 결과가 숫자가 아니다");
    return out;
  }

  const close = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
  const isText = (x) => typeof x === "string" && x.trim().length > 0;

  function simVars(spec, values) {
    const vars = {};
    for (const c of spec.constants || []) vars[c.key] = c.value.v;
    for (const inp of spec.inputs) vars[inp.key] = values && inp.key in values ? values[inp.key] : inp.default.v;
    return vars;
  }
  function computeSim(spec, values) {
    const vars = simVars(spec, values);
    const out = {};
    for (const o of spec.outputs) out[o.key] = evalFormula(o.formula, vars);
    return out;
  }
  function computeMetric(spec, metric, optionKey) {
    if (!metric.derived) return metric.values[optionKey].v;
    const vars = {};
    for (const m of spec.metrics) if (!m.derived) vars[m.key] = m.values[optionKey].v;
    return evalFormula(metric.derived, vars);
  }

  function validateCase(c) {
    const errors = [];
    const err = (code, msg) => errors.push({ code, msg });
    if (!isObj(c)) return { ok: false, errors: [{ code: "SCHEMA", msg: "사례가 객체가 아니다" }] };
    if (!isText(c.id)) err("SCHEMA", "id가 없다");
    if (!TYPES.includes(c.type)) err("SCHEMA", "모르는 유형: " + c.type);
    if (!isObj(c.source) || !isText(c.source.label) || !isText(c.source.asOf)) err("SCHEMA", "출처와 기준 시점이 없다");
    if (!Array.isArray(c.facts) || c.facts.length === 0) err("SCHEMA", "사실 목록이 없다");
    const facts = new Map();
    for (const f of Array.isArray(c.facts) ? c.facts : []) {
      if (!isObj(f) || !isText(f.id) || !isText(f.text)) { err("SCHEMA", "사실 항목의 형식이 틀렸다"); continue; }
      if (facts.has(f.id)) err("SCHEMA", "사실 ID가 겹친다: " + f.id);
      facts.set(f.id, f);
    }
    const spec = c.spec;
    if (!isObj(spec) || !isText(spec.title) || !isText(spec.guide)) {
      err("SCHEMA", "스펙에 제목이나 조작 안내가 없다");
      return { ok: false, errors };
    }

    // 수치는 사실 ID를 달거나 가정값으로 표시해야 한다 (FR-D-04, FR-D-05)
    function checkValue(val, where) {
      if (!isObj(val) || typeof val.v !== "number" || !Number.isFinite(val.v)) { err("SCHEMA", where + ": 수치 형식이 틀렸다"); return false; }
      if (val.assumed === true) return true;
      if (!isText(val.fact)) { err("NO_REF", where + ": 사실 ID도 가정값 표시도 없는 수치 " + val.v); return false; }
      const f = facts.get(val.fact);
      if (!f) { err("FACT_MISSING", where + ": 사실 목록에 없는 ID " + val.fact); return false; }
      if (typeof f.value !== "number") { err("FACT_MISMATCH", where + ": 사실 " + val.fact + "에 수치가 없다"); return false; }
      if (!close(f.value, val.v)) { err("FACT_MISMATCH", where + ": 스펙 " + val.v + " ≠ 사실 " + val.fact + "의 " + f.value); return false; }
      return true;
    }
    function checkLiterals(expr, where) {
      let nums;
      try { nums = tokenize(String(expr)).filter((t) => t.t === "num").map((t) => t.v); }
      catch (e) { err("FORMULA", where + ": " + e.message); return; }
      for (const n of nums) if (!UNIT_LITERALS.includes(n)) err("LITERAL_IN_FORMULA", where + ": 식 안에 근거 표시 없는 숫자 " + n);
    }

    if (c.type === "comparison") {
      const opts = Array.isArray(spec.options) ? spec.options : [];
      const keys = opts.map((o) => o && o.key);
      if (opts.length < 2 || new Set(keys).size !== keys.length || opts.some((o) => !isObj(o) || !isText(o.key) || !isText(o.label))) err("SCHEMA", "비교 대상이 2개 이상 있어야 하고 키가 겹치면 안 된다");
      if (!keys.includes(spec.baseline)) err("SCHEMA", "기준이 되는 대상이 없다");
      const metrics = Array.isArray(spec.metrics) ? spec.metrics : [];
      if (metrics.length === 0) err("SCHEMA", "비교 항목이 없다");
      let valuesOk = true;
      for (const m of metrics) {
        if (!isObj(m) || !isText(m.key) || !isText(m.label) || !isText(m.unit)) { err("SCHEMA", "비교 항목의 형식이 틀렸다"); valuesOk = false; continue; }
        if (m.derived) { checkLiterals(m.derived, m.key); continue; }
        for (const k of keys) if (!checkValue(m.values && m.values[k], m.key + "." + k)) valuesOk = false;
      }
      if (valuesOk && errors.length === 0) {
        for (const m of metrics.filter((x) => x.derived)) {
          const checks = (spec.checks || []).filter((ch) => ch.metric === m.key);
          if (checks.length === 0) err("NO_CHECKS", m.key + ": 계산 결과를 대조할 값이 없다");
          for (const k of keys) {
            try { computeMetric(spec, m, k); } catch (e) { err("FORMULA", m.key + ": " + e.message); break; }
          }
          for (const ch of checks) {
            try {
              const got = computeMetric(spec, m, ch.option);
              if (!close(got, ch.expect)) err("CALC_MISMATCH", m.key + "." + ch.option + ": 계산 " + got + " ≠ 대조값 " + ch.expect);
            } catch (e) { err("FORMULA", m.key + ": " + e.message); }
          }
        }
      }
    }

    if (c.type === "simulation") {
      const inputs = Array.isArray(spec.inputs) ? spec.inputs : [];
      const outputs = Array.isArray(spec.outputs) ? spec.outputs : [];
      if (inputs.length === 0 || outputs.length === 0) err("SCHEMA", "입력과 출력이 하나 이상 있어야 한다");
      let shapeOk = inputs.length > 0 && outputs.length > 0;
      for (const c2 of spec.constants || []) {
        if (!isObj(c2) || !isText(c2.key) || !isText(c2.label)) { err("SCHEMA", "상수의 형식이 틀렸다"); shapeOk = false; continue; }
        if (!checkValue(c2.value, "상수 " + c2.key)) shapeOk = false;
      }
      for (const inp of inputs) {
        if (!isObj(inp) || !isText(inp.key) || !isText(inp.label) || !isText(inp.unit) || ![inp.min, inp.max, inp.step].every(Number.isFinite)) { err("SCHEMA", "입력의 형식이 틀렸다"); shapeOk = false; continue; }
        if (!(inp.min < inp.max) || !(inp.step > 0)) { err("RANGE", inp.key + ": 범위나 간격이 틀렸다"); shapeOk = false; }
        if (!checkValue(inp.default, inp.key + " 기본값")) { shapeOk = false; continue; }
        if (inp.default.v < inp.min || inp.default.v > inp.max) { err("RANGE", inp.key + ": 기본값 " + inp.default.v + "이 범위 밖이다"); shapeOk = false; }
        for (const mk of inp.marks || []) {
          if (!checkValue(mk.value, inp.key + " 표시값")) { shapeOk = false; continue; }
          if (mk.value.v < inp.min || mk.value.v > inp.max) { err("RANGE", inp.key + ": 표시값 " + mk.value.v + "이 범위 밖이다"); shapeOk = false; }
        }
      }
      for (const o of outputs) {
        if (!isObj(o) || !isText(o.key) || !isText(o.label) || !isText(o.unit) || !isText(o.formula)) { err("SCHEMA", "출력의 형식이 틀렸다"); shapeOk = false; continue; }
        checkLiterals(o.formula, o.key);
      }
      if (spec.compare) {
        if (!inputs.some((i) => i.key === spec.compare.input) || !isText(spec.compare.label)) { err("SCHEMA", "비교 기준의 형식이 틀렸다"); shapeOk = false; }
        else if (!checkValue(spec.compare.from, "비교 기준")) shapeOk = false;
      }
      if (shapeOk && !errors.some((e) => e.code === "FORMULA")) {
        try {
          computeSim(spec);
          // 조작에 따라 계산되는 결과도 검사 대상이다 (FR-D-04)
          const checks = Array.isArray(spec.checks) ? spec.checks : [];
          if (checks.length < 2) err("NO_CHECKS", "계산 결과를 대조할 값이 2개 이상 있어야 한다");
          for (const ch of checks) {
            const got = computeSim(spec, ch.inputs)[ch.output];
            if (got === undefined || !close(got, ch.expect)) err("CALC_MISMATCH", ch.output + ": 계산 " + got + " ≠ 대조값 " + ch.expect);
          }
          // 값을 바꾸면 결과가 달라져야 한다 (FR-D-03)
          for (const inp of inputs) {
            const lo = computeSim(spec, { [inp.key]: inp.min });
            const hi = computeSim(spec, { [inp.key]: inp.max });
            if (outputs.every((o) => close(lo[o.key], hi[o.key]))) err("INPUT_NO_EFFECT", inp.key + ": 값을 바꿔도 결과가 달라지지 않는다");
          }
        } catch (e) { err("FORMULA", e.message); }
      }
    }

    if (c.type === "process") {
      const steps = Array.isArray(spec.steps) ? spec.steps : [];
      if (steps.length < 2) err("SCHEMA", "단계가 2개 이상 있어야 한다");
      steps.forEach((s, i) => {
        if (!isObj(s) || !isText(s.title) || !isText(s.body)) { err("SCHEMA", "단계 " + (i + 1) + "의 형식이 틀렸다"); return; }
        for (const id of s.facts || []) if (!facts.has(id)) err("FACT_MISSING", "단계 " + (i + 1) + ": 사실 목록에 없는 ID " + id);
        if (s.figure) {
          if (!isText(s.figure.label) || !isText(s.figure.unit)) err("SCHEMA", "단계 " + (i + 1) + ": 수치 표시의 형식이 틀렸다");
          else checkValue(s.figure.value, "단계 " + (i + 1) + " 수치");
        }
      });
      if (spec.current !== undefined && !(Number.isInteger(spec.current) && spec.current >= 0 && spec.current < steps.length)) err("RANGE", "현재 단계가 범위 밖이다");
    }

    return { ok: errors.length === 0, errors };
  }

  g.S5A_VALIDATE = { TYPES, UNIT_LITERALS, evalFormula, computeSim, computeMetric, validateCase };
})(globalThis);
