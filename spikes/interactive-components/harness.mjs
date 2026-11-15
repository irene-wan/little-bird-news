// S5a Spike — 검증 하네스.
// 정상 사례는 모두 통과해야 하고, 일부러 틀리게 만든 사례는 정해진 오류 코드로 걸러져야 한다.
// 실행: node spikes/interactive-components/harness.mjs
import "./lib/validate.js";
import "./lib/cases.js";

const { validateCase, evalFormula } = globalThis.S5A_VALIDATE;
const cases = globalThis.S5A_CASES;
const byId = (id) => structuredClone(cases.find((c) => c.id === id));
const rows = [];
let failed = 0;

function expectPass(name, c) {
  const res = validateCase(c);
  if (!res.ok) failed++;
  rows.push({ 구분: "정상 사례", 사례: name, 기대: "통과", 결과: res.ok ? "통과" : "거름: " + res.errors.map((e) => e.code).join(","), 판정: res.ok ? "OK" : "실패" });
}
function expectReject(name, code, c) {
  const res = validateCase(c);
  const codes = res.errors.map((e) => e.code);
  const ok = !res.ok && codes.includes(code);
  if (!ok) failed++;
  rows.push({ 구분: "주입 오류", 사례: name, 기대: code, 결과: res.ok ? "통과시킴" : [...new Set(codes)].join(","), 판정: ok ? "OK" : "실패" });
}
function mutate(id, fn) { const c = byId(id); fn(c); return c; }

for (const c of cases) expectPass(c.id + " (" + c.type + ")", c);

expectReject("틀린 수치: 스펙의 값이 사실과 다름", "FACT_MISMATCH", mutate("cmp-rent", (c) => { c.spec.metrics[0].values.a.v = 35; }));
expectReject("참조 없는 수치", "NO_REF", mutate("cmp-commute", (c) => { delete c.spec.metrics[0].values.bus.fact; }));
expectReject("사실 목록에 없는 ID", "FACT_MISSING", mutate("cmp-commute", (c) => { c.spec.metrics[2].values.metro.fact = "F99"; }));
expectReject("모르는 유형", "SCHEMA", mutate("sim-loan", (c) => { c.type = "freeform-html"; }));
expectReject("조작 안내 누락", "SCHEMA", mutate("proc-bill", (c) => { delete c.spec.guide; }));
expectReject("출처와 기준 시점 누락", "SCHEMA", mutate("proc-recall", (c) => { delete c.source; }));
expectReject("틀린 계산식 (12로 나누지 않음)", "CALC_MISMATCH", mutate("sim-loan", (c) => { c.spec.outputs[0].formula = "principal * rate / 100"; }));
expectReject("틀린 파생 계산 (곱하기 대신 더하기)", "CALC_MISMATCH", mutate("cmp-rent", (c) => { c.spec.metrics[2].derived = "amount + months"; }));
expectReject("대조값 없는 계산", "NO_CHECKS", mutate("sim-wage", (c) => { c.spec.checks = []; }));
expectReject("범위 밖 기본값", "RANGE", mutate("sim-loan", (c) => { c.spec.inputs[1].min = 5; }));
expectReject("값을 바꿔도 결과가 그대로인 입력", "INPUT_NO_EFFECT", mutate("sim-wage", (c) => { c.spec.outputs[0].formula = "hourly * weeks / 10000"; c.spec.checks = [{ inputs: { hourly: 10000 }, output: "pay", expect: 4.345 }, { inputs: { hourly: 12000 }, output: "pay", expect: 5.214 }]; }));
expectReject("식 안에 근거 없는 숫자", "LITERAL_IN_FORMULA", mutate("sim-wage", (c) => { c.spec.outputs[0].formula = "hourly * hours * 4.345 / 10000"; }));
expectReject("식에 코드 넣기 시도", "FORMULA", mutate("sim-loan", (c) => { c.spec.outputs[0].formula = "principal * rate; alert(1)"; }));
expectReject("식에 모르는 이름", "FORMULA", mutate("sim-loan", (c) => { c.spec.outputs[0].formula = "principal * window / 12"; }));
expectReject("과정: 사실 목록에 없는 ID", "FACT_MISSING", mutate("proc-bill", (c) => { c.spec.steps[0].facts = ["F77"]; }));
expectReject("과정: 틀린 수치", "FACT_MISMATCH", mutate("proc-recall", (c) => { c.spec.steps[2].figure.value.v = 23000; }));
expectReject("가정값 표시 없이 예시 금액 사용", "NO_REF", mutate("sim-loan", (c) => { c.spec.inputs[0].default = { v: 10000 }; }));

// 식 계산기 자체의 대조
const formulaChecks = [["1 + 2 * 3", {}, 7], ["(1 + 2) * 3", {}, 9], ["-a + 10", { a: 4 }, 6], ["max(a, 10) / 10", { a: 4 }, 1], ["round(a / 12)", { a: 100 }, 8]];
for (const [expr, vars, expect] of formulaChecks) {
  const got = evalFormula(expr, vars);
  const ok = got === expect;
  if (!ok) failed++;
  rows.push({ 구분: "식 계산기", 사례: expr, 기대: String(expect), 결과: String(got), 판정: ok ? "OK" : "실패" });
}

console.table(rows);
console.log(failed === 0 ? `전체 ${rows.length}건 기대대로 동작` : `${failed}건이 기대와 다름`);
process.exit(failed === 0 ? 0 : 1);
