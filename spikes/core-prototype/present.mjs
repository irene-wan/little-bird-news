// 핵심 가치 프로토타입 Spike — 표현 시트 시험.
// 이미 만든 오늘의 소식(11-edition.json)에, 목표 시안의 구조(질문형 제목, 대표 숫자, 핵심 3줄, 확인 퀴즈)를 채울 글감을 모델별로 만들어 본다.
// 목표 시안: docs/research/references/target-edition-mockup.html
// 실행: node spikes/core-prototype/present.mjs <실행ID>
// 결과: private/runs/<실행ID>/12-present.json  (읽기 화면에는 아직 연결하지 않았다)
import { join } from "node:path";
import { config, runDir, readJson, writeJson, llm, spentUsd } from "./lib/common.mjs";
import * as P from "./lib/prompts.mjs";

const runId = process.argv[2];
if (!runId) { console.error("실행ID가 필요하다"); process.exit(1); }
const dir = runDir(runId);
const edition = readJson(join(dir, "11-edition.json"));
const sheets = readJson(join(dir, "05-facts.json")).sheets;
const models = config.models.present || [config.models.write];
const nums = (s) => String(s || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/g) || [];

// 코드로 하는 대조: 근거 사실 ID가 실제로 있는가, 글감의 숫자가 근거 사실에 있는가 (두 숫자의 차이는 허용)
function check(sheet, facts) {
  const fmap = new Map(facts.map((f) => [f.id, f]));
  const problems = [];
  const part = (name, text, ids) => {
    const refs = (ids || []).map((id) => fmap.get(id)).filter(Boolean);
    if (!refs.length) { problems.push(`${name}: 근거 사실 없음`); return; }
    const have = nums(refs.map((f) => f.text + " " + f.quote + " " + (f.value ?? "")).join(" ")).map(Number);
    const ok = (n) => have.includes(n) || have.some((a) => have.some((b) => Math.abs(Math.abs(a - b) - n) < 1e-9));
    const missing = nums(text).map(Number).filter((n) => !ok(n));
    if (missing.length) problems.push(`${name}: 근거에 없는 숫자 ${missing.join(", ")}`);
  };
  if (sheet.metric) part("metric", sheet.metric.text, sheet.metric.fact_ids);
  (sheet.key_facts || []).forEach((k, i) => part(`key_facts[${i}]`, k.text, k.fact_ids));
  if (!Array.isArray(sheet.key_facts) || sheet.key_facts.length !== 3) problems.push("key_facts가 3개가 아님");
  const q = sheet.quiz;
  if (!q || !Array.isArray(q.answers) || q.answers.length !== 2 || ![0, 1].includes(q.correct)) problems.push("quiz 형식 오류");
  else part("quiz", q.explain, q.fact_ids);
  for (const k of ["hook", "insight", "compact"]) if (!sheet[k]) problems.push(`${k} 없음`);
  return problems;
}

const out = [];
for (const s of edition.stories) {
  const cand = sheets.find((x) => x.cid === s.cid);
  for (const model of models) {
    try {
      const r = await llm(dir, { stage: "present", tag: `${s.cid}-${model}`, model, version: P.VERSION, temperature: 0.4, maxOutputTokens: 2000, ...P.present(cand, s.story) });
      const problems = check(r, cand.facts);
      out.push({ cid: s.cid, model, ok: problems.length === 0, problems, sheet: r });
      console.log(`${s.cid} ${model}: ${problems.length ? "문제 " + problems.join(" / ") : "통과"} — ${r.hook}`);
    } catch (e) { out.push({ cid: s.cid, model, ok: false, problems: ["생성 실패: " + e.message] }); console.log(`${s.cid} ${model}: 생성 실패 ${e.message}`); }
  }
}
writeJson(join(dir, "12-present.json"), { runId, promptVersion: P.VERSION, results: out });
console.log(`누적 LLM 비용 $${spentUsd().toFixed(3)}`);
