// 오늘의 소식 후보를 미리 준비한다 (프로필 없이).
// 수집 → 1차 선별 → 기사 받기 → 사실 목록 → 집필 → 검증 → 표현 시트 → 조작형 설명 → data/pool.mjs
// 실행: node demo/build-pool.mjs [실행ID] [--from=단계]
// 단계 결과와 모든 AI 호출 기록은 깃에 올라가지 않는 private/runs/<실행ID>/ 에 남긴다. 같은 실행ID로 다시 돌리면 끝난 단계는 건너뛴다.
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { DEMO } from "./lib/env.mjs";
import { llm as callLlm, pool, MODELS } from "./lib/llm.mjs";
import * as P from "./lib/prompts.mjs";
import "./public/validate.js";
import "./lib/cases.js";

const { validateCase } = globalThis.S5A_VALIDATE;
const args = process.argv.slice(2);
const runId = args.find((a) => !a.startsWith("--")) || "demo-" + new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const from = (args.find((a) => a.startsWith("--from=")) || "").slice(7);
const dir = join(DEMO, "..", "private", "runs", runId);
mkdirSync(join(dir, "llm"), { recursive: true });
const CFG = { bigEventPages: 3, articlesPerQuery: 20, searchDays: 3, deep: 18, perTopic: 2, articlesPerEvent: 8, poolSize: 16, budgetUsd: 2.5,
  keywords: ["AI", "반도체", "채용", "취업", "금리", "환율", "부동산", "전세", "건강", "운동", "스타트업", "기후", "교육", "게임", "영화", "여행", "주식", "물가", "연금", "청년"] };
const ORDER = ["collect", "screen", "articles", "facts", "write", "verify", "present", "interactive"];
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p, d) => writeFileSync(p, JSON.stringify(d, null, 1));
async function stage(name, fn) {
  const file = join(dir, String(ORDER.indexOf(name) + 1).padStart(2, "0") + "-" + name + ".json");
  const force = from && ORDER.indexOf(name) >= ORDER.indexOf(from);
  if (existsSync(file) && !force) return readJson(file);
  const t0 = Date.now(); const out = await fn(); writeJson(file, out);
  console.log(`[${name}] ${((Date.now() - t0) / 1000).toFixed(1)}초 · 누적 $${spent.toFixed(3)}`);
  return out;
}
let spent = 0, seq = 0;
const llm = (o) => {
  if (spent >= CFG.budgetUsd) throw new Error("이번 실행의 AI 비용 상한 도달");
  return callLlm({ apiKey: process.env.GEMINI_API_KEY, attempts: 3, timeoutMs: 120000, ...o, onCall: (c) => {
    spent += c.usd;
    writeJson(join(dir, "llm", `${String(++seq).padStart(3, "0")}-${c.stage}-${c.tag}.json`), c);
    const { system, prompt, responseText, ...row } = c;
    appendFileSync(join(dir, "llm-calls.jsonl"), JSON.stringify({ at: new Date().toISOString(), ...row }) + "\n");
  } });
};
const KOREA = "http://en.wikipedia.org/wiki/South_Korea";
const day = (o) => new Date(Date.now() + 9 * 3600e3 + o * 86400e3).toISOString().slice(0, 10);
let newsTokens = 0;
async function news(path, body, cost) {
  const res = await fetch("https://eventregistry.org/api/v1/" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, apiKey: process.env.NEWSAPI_AI_KEY }) });
  if (!res.ok) throw new Error("뉴스 공급원 오류 " + res.status + " " + (await res.text()).slice(0, 300));
  newsTokens += cost; return res.json();
}
const JUNK = /(좋아요\s*\d|싫어요\s*\d|후속기사|무단\s*전재|재배포\s*금지|저작권자|Copyright|ⓒ|©|기사제보|구독하기|네이버에서.*구독|\S+@\S+\.\S+|^\[?사진[=\s]|송고$|와우넷|오늘장전략)/i;
function cleanBody(body, title) {
  const lines = String(body || "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  while (lines.length && (JUNK.test(lines.at(-1)) || lines.at(-1).length < 12)) lines.pop();
  const kept = lines.filter((l) => !JUNK.test(l) || l.length > 120);
  if (kept[0] && title && kept[0].replace(/\s/g, "") === title.replace(/\s/g, "")) kept.shift();
  return kept.join("\n");
}
const norm = (s) => String(s || "").replace(/[\s"'“”‘’.,…·\-–—()\[\]<>]/g, "");
const nums = (s) => String(s || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/g) || [];

// ── 1. 수집: 큰 사건 + 넓은 주제 검색어 ──
const collected = await stage("collect", async () => {
  const dateStart = day(-1), dateEnd = day(0), candidates = new Map();
  for (let page = 1; page <= CFG.bigEventPages; page++) {
    const r = await news("event/getEvents", { action: "getEvents", lang: "kor", sourceLocationUri: KOREA, dateStart, dateEnd, resultType: "events", eventsSortBy: "size", eventsCount: 50, eventsPage: page, includeEventSummary: true, includeEventArticleCounts: true }, 5);
    for (const e of r.events?.results || []) {
      const title = typeof e.title === "string" ? e.title : e.title?.kor || Object.values(e.title || {})[0] || "";
      const summary = typeof e.summary === "string" ? e.summary : e.summary?.kor || Object.values(e.summary || {})[0] || "";
      candidates.set(e.uri, { key: e.uri, eventUri: e.uri, origins: ["큰 사건"], title, snippet: summary.replace(/\s+/g, " ").slice(0, 160), articleCount: e.totalArticleCount, articles: [] });
    }
  }
  for (const q of CFG.keywords) {
    const r = await news("article/getArticles", { action: "getArticles", keyword: q, keywordSearchMode: "simple", lang: "kor", sourceLocationUri: KOREA, dateStart: day(-CFG.searchDays), dateEnd, dataType: ["news"], isDuplicateFilter: "skipDuplicates", articlesSortBy: "rel", articlesCount: CFG.articlesPerQuery, articleBodyLen: -1, resultType: "articles", includeArticleEventUri: true }, 1);
    for (const a of r.articles?.results || []) {
      const key = a.eventUri || "t:" + norm(a.title).slice(0, 18);
      const c = candidates.get(key) || { key, eventUri: a.eventUri || null, origins: [], title: a.title, snippet: cleanBody(a.body, a.title).replace(/\s+/g, " ").slice(0, 160), articleCount: 0, articles: [] };
      if (!c.origins.includes("검색: " + q)) c.origins.push("검색: " + q);
      c.articles.push(a);
      if (!a.eventUri) c.articleCount = c.articles.length;
      candidates.set(key, c);
    }
  }
  return { dateStart, dateEnd, newsTokens, candidates: [...candidates.values()].map((c, i) => ({ cid: "C" + (i + 1), ...c })) };
});
console.log(`후보 ${collected.candidates.length}건`);

// ── 2. 1차 선별: 주제가 고르게 남도록 추린다 ──
const screened = await stage("screen", async () => {
  const chunks = [];
  for (let i = 0; i < collected.candidates.length; i += 90) chunks.push(collected.candidates.slice(i, i + 90));
  const outs = await pool(chunks, 3, (chunk, i) => llm({ stage: "screen", tag: "chunk" + i, model: MODELS.light, maxOutputTokens: 16000, ...P.screenGeneric(chunk) }));
  const by = new Map();
  for (const o of outs) for (const it of o.items || []) by.set(it.cid, it);
  const rows = collected.candidates.map((c) => {
    const j = by.get(c.cid);
    const score = !j ? -2 : j.skip ? -1 : (j.imp || 0) * 2 + (j.explain || 0) * 1.5 + Math.min(c.articleCount || 0, 10) / 10;
    return { cid: c.cid, title: c.title, articleCount: c.articleCount, imp: j?.imp ?? null, explain: j?.explain ?? null, skip: !!j?.skip, topic: P.TOPICS.includes(j?.topic) ? j.topic : "사회·제도", score };
  });
  const ranked = [...rows].sort((a, b) => b.score - a.score), deep = [], perTopic = {};
  for (const r of ranked) {
    if (deep.length >= CFG.deep || r.score <= 3) break;
    if ((perTopic[r.topic] || 0) >= CFG.perTopic) continue;
    perTopic[r.topic] = (perTopic[r.topic] || 0) + 1; deep.push(r.cid);
  }
  for (const r of rows) r.deep = deep.includes(r.cid);
  return { rows };
});
const deepRows = screened.rows.filter((r) => r.deep);
console.log(`깊이 볼 후보 ${deepRows.length}건: ` + deepRows.map((r) => r.topic).join(", "));

// ── 3. 기사 받기 ──
const withArticles = await stage("articles", async () => {
  const out = [];
  for (const row of deepRows) {
    const c = collected.candidates.find((x) => x.cid === row.cid);
    let raw = c.articles;
    if (c.eventUri) {
      const r = await news("event/getEvent", { eventUri: c.eventUri, resultType: "articles", articlesLang: "kor", articlesSortBy: "sourceImportance", articlesCount: CFG.articlesPerEvent, articleBodyLen: -1 }, 1);
      raw = (r[c.eventUri]?.articles?.results || []).concat(raw);
    }
    const seen = new Set(), articles = [];
    for (const a of raw) {
      const body = cleanBody(a.body, a.title), sig = norm(body).slice(0, 80);
      if (body.length < 200 || seen.has(a.url) || seen.has(sig)) continue;
      seen.add(sig); seen.add(a.url);
      articles.push({ source: a.source?.title || "?", title: a.title, url: a.url, dateTime: a.dateTime, body });
    }
    out.push({ cid: row.cid, topic: row.topic, imp: row.imp, title: c.title, articleCount: Math.max(c.articleCount || 0, articles.length), articles });
  }
  return { candidates: out.filter((c) => c.articles.length > 0) };
});

// ── 4. 사실 목록: 근거 문장이 기사 원문에 글자 그대로 있는 사실만 남긴다 ──
const factSheets = await stage("facts", async () => {
  const outs = await pool(withArticles.candidates, 5, async (c) => {
    const used = [...c.articles].sort((a, b) => b.body.length - a.body.length).slice(0, 4).map((a) => ({ ...a, body: a.body.slice(0, 3000) }));
    const r = await llm({ stage: "facts", tag: c.cid, model: MODELS.main, ...P.facts(used) });
    const bodies = used.map((a) => norm(a.body)), kept = [];
    let dropped = 0;
    for (const f of r.facts || []) {
      if (!f || typeof f.text !== "string" || typeof f.quote !== "string") continue;
      const q = norm(f.quote), idx = q.length >= 8 ? bodies.findIndex((b) => b.includes(q)) : -1;
      if (idx < 0) { dropped++; continue; }
      const fact = { id: "F" + (kept.length + 1), text: f.text, quote: f.quote, article: idx, kind: f.kind === "claim" ? "claim" : "fact" };
      if (typeof f.value === "number" && Number.isFinite(f.value) && /\d/.test(f.quote) && typeof f.unit === "string" && f.unit) { fact.value = f.value; fact.unit = f.unit; }
      kept.push(fact);
    }
    return { cid: c.cid, topic: c.topic, imp: c.imp, title: c.title, summary: r.summary || c.title, event_date: /^\d{4}-\d{2}-\d{2}$/.test(r.event_date || "") ? r.event_date : collected.dateEnd, same_event: r.same_event !== false, conflicts: (r.conflicts || []).filter(Boolean), facts: kept, dropped,
      usedArticles: used.map((a) => ({ source: a.source, title: a.title, url: a.url, dateTime: a.dateTime })), sources: [...new Set(c.articles.map((a) => a.source))], articleCount: c.articleCount };
  });
  return { sheets: outs.filter((o) => !o.error) };
});
const usable = factSheets.sheets.filter((s) => s.facts.length >= 5 && s.same_event);
console.log(`사실 목록: 쓸 수 있는 사건 ${usable.length}건 (버린 사실 ${factSheets.sheets.reduce((n, s) => n + s.dropped, 0)}건)`);

// ── 5. 집필 ──
const drafts = await stage("write", async () => {
  const outs = await pool(usable, 5, (c) => llm({ stage: "write", tag: c.cid, model: MODELS.main, temperature: 0.5, ...P.writeGeneric(c) }));
  return { drafts: outs.map((o, i) => ({ cid: usable[i].cid, ...(o.error ? { error: o.error } : { story: o }) })) };
});

// ── 6. 검증: 문장마다 근거 사실과 대조하고, 숫자는 코드로 대조한다. 걸리면 한 번 고쳐 쓰고 다시 검증한다 ──
async function checkStory(c, s, round) {
  const fmap = new Map(c.facts.map((f) => [f.id, f])), claims = [];
  const add = (sid, text, facts, kind, ref) => claims.push({ sid, text: String(text || ""), facts: (facts || []).filter((id) => fmap.has(id)), kind, ref });
  add("S0", s.lede?.text, s.lede?.facts, "fact", s.lede || {});
  (s.blocks || []).forEach((b, bi) => (b.sentences || []).forEach((sen, si) => { if (b.kind === "fact" || (sen.facts || []).length) add(`S${bi + 1}_${si + 1}`, sen.text, sen.facts, b.kind, sen); }));
  const r = await llm({ stage: "verify", tag: c.cid + "-" + round, model: MODELS.main, temperature: 0, ...P.verify({ ...c, links: [] }, s, claims) });
  const verdicts = new Map((r.results || []).map((x) => [x.sid, x])), report = [];
  for (const cl of claims) {
    const v = verdicts.get(cl.sid);
    let verdict = v?.verdict || "unsupported", problem = v?.problem || (v ? "" : "검증 결과 누락");
    if (cl.kind === "fact" && cl.facts.length === 0) { verdict = "unsupported"; problem = "근거 사실 ID가 없음"; }
    if (verdict === "ok") {
      const hay = cl.facts.map((id) => fmap.get(id)).map((f) => f.text + " " + f.quote + " " + (f.value ?? "")).join(" ").replace(/,/g, "");
      const missing = nums(cl.text).filter((n) => !hay.includes(n));
      if (missing.length) { verdict = "overreach"; problem = "근거에 없는 숫자: " + missing.join(", "); }
    }
    cl.ref.verdict = verdict;
    report.push({ sid: cl.sid, kind: cl.kind, text: cl.text, verdict, problem });
  }
  const bad = report.filter((x) => x.verdict !== "ok");
  for (const b of s.blocks || []) b.sentences = (b.sentences || []).filter((sen) => !sen.verdict || sen.verdict === "ok");
  s.blocks = (s.blocks || []).filter((b) => b.sentences.length > 0);
  let hold = null;
  if (report.find((x) => x.sid === "S0")?.verdict !== "ok") hold = "핵심 문장이 근거와 맞지 않음";
  else if (bad.length / Math.max(1, report.length) > 0.34) hold = `근거와 맞지 않는 문장이 많음 (${bad.length}/${report.length})`;
  else if (!s.blocks.some((b) => b.kind === "fact")) hold = "사실 문단이 남지 않음";
  return { hold, bad, report, story: s };
}
const verified = await stage("verify", async () => {
  const outs = await pool(drafts.drafts, 5, async (d) => {
    if (d.error) return { cid: d.cid, published: false, hold: "집필 실패" };
    const c = usable.find((p) => p.cid === d.cid);
    let res = await checkStory(c, structuredClone(d.story), 1), revised = false;
    if (res.bad.length) {
      try {
        const fixed = await llm({ stage: "revise", tag: c.cid, model: MODELS.main, temperature: 0.3, ...P.reviseGeneric(c, d.story, res.bad) });
        if (fixed && fixed.lede && Array.isArray(fixed.blocks)) { res = await checkStory(c, fixed, 2); revised = true; }
      } catch (e) { /* 고쳐 쓰기에 실패하면 첫 검증 결과를 쓴다 */ }
    }
    return { cid: c.cid, published: !res.hold, hold: res.hold, revised, removed: res.bad.length, checked: res.report.length, story: res.story };
  });
  return { results: outs.map((o, i) => (o.error ? { cid: drafts.drafts[i].cid, published: false, hold: "검증 실패: " + o.error } : o)) };
});
for (const r of verified.results) console.log(`검증 ${r.cid}: ${r.published ? "통과" : "보류 — " + r.hold}${r.removed ? ` (문장 ${r.removed}개 삭제)` : ""}${r.revised ? " (한 번 고쳐 씀)" : ""}`);
const published = verified.results.filter((r) => r.published);

// ── 7. 표현 시트: 질문, 답, 대표 숫자, 핵심 3줄, 확인 문제. 숫자와 근거는 코드로 대조한다 ──
function checkSheet(sheet, facts) {
  const fmap = new Map(facts.map((f) => [f.id, f])), problems = [];
  const part = (name, text, ids) => {
    const refs = (ids || []).map((id) => fmap.get(id)).filter(Boolean);
    if (!refs.length) { problems.push(`${name}: 근거 사실 없음`); return; }
    const have = nums(refs.map((f) => f.text + " " + f.quote + " " + (f.value ?? "")).join(" ")).map(Number);
    const ok = (n) => have.includes(n) || have.some((a) => have.some((b) => Math.abs(Math.abs(a - b) - n) < 1e-9));
    const missing = nums(text).map(Number).filter((n) => !ok(n));
    if (missing.length) problems.push(`${name}: 근거에 없는 숫자 ${missing.join(", ")}`);
  };
  if (sheet.metric && sheet.metric.text) part("metric", sheet.metric.text, sheet.metric.fact_ids); else sheet.metric = null;
  (sheet.key_facts || []).forEach((k, i) => part(`key_facts[${i}]`, k.text, k.fact_ids));
  if (!Array.isArray(sheet.key_facts) || sheet.key_facts.length !== 3) problems.push("key_facts가 3개가 아님");
  const q = sheet.quiz;
  if (!q || !Array.isArray(q.answers) || q.answers.length !== 2 || ![0, 1].includes(q.correct)) problems.push("quiz 형식 오류");
  else part("quiz", q.explain, q.fact_ids);
  for (const k of ["hook", "insight", "compact"]) if (!sheet[k]) problems.push(`${k} 없음`);
  return problems;
}
const presented = await stage("present", async () => {
  const outs = await pool(published, 5, async (v) => {
    const c = usable.find((p) => p.cid === v.cid);
    let last = [];
    for (let n = 1; n <= 2; n++) {
      const base = P.present(c, v.story);
      const r = await llm({ stage: "present", tag: `${c.cid}-${n}`, model: MODELS.main, temperature: 0.4, maxOutputTokens: 2500, system: base.system, prompt: base.prompt + (last.length ? `\n\n앞서 만든 글감은 대조에서 걸렸다. 고쳐서 다시 만들어라: ${last.join(" / ")}` : "") });
      last = checkSheet(r, c.facts);
      if (!last.length) return { cid: c.cid, ok: true, sheet: r };
    }
    return { cid: c.cid, ok: false, problems: last };
  });
  return { results: outs.map((o, i) => (o.error ? { cid: published[i].cid, ok: false, problems: [o.error] } : o)) };
});
for (const r of presented.results) console.log(`표현 시트 ${r.cid}: ${r.ok ? r.sheet.hook : "실패 — " + r.problems.join(" / ")}`);
const ready = published.filter((v) => presented.results.find((r) => r.cid === v.cid)?.ok);

// ── 8. 조작형 설명: AI가 유형을 고르고 스펙을 만든다. 검증기를 통과한 것만 쓰고, 아니면 요약 카드로 대신한다 ──
const TYPE_HELP = `A. comparison (비교): 여러 대상을 같은 항목으로 견준다. 독자가 대상을 바꿔 본다.
   spec: {"title","guide","baseline":기준 대상의 key,"options":[{"key","label"}] (2~4개),"metrics":[{"key","label","unit","values":{대상 key: 수치}} 또는 {"key","label","unit","derived":"다른 metric의 key로 쓴 식"}],"checks":[{"metric","option","expect"}] (derived가 있으면 필수)}
   derived가 아닌 모든 metric은 모든 대상의 수치를 가져야 한다.
B. simulation (시뮬레이션): 독자가 슬라이더로 값을 바꾸면 결과가 계산된다.
   spec: {"title","guide","constants":[{"key","label","value":수치}] (선택),"inputs":[{"key","label","unit","min","max","step","default":수치,"marks":[{"label","value":수치}] (선택)}],"outputs":[{"key","label","unit","formula","digits"}],"compare":{"input":입력 key,"from":수치,"label":"~보다"} (선택),"checks":[{"inputs":{입력 key: 값},"output":출력 key,"expect":값}] (2개 이상)}
   기본값과 표시값은 min~max 안에 있어야 하고, 모든 입력은 결과를 바꿔야 한다.
C. process (과정): 순서가 있는 단계를 하나씩 넘겨 본다.
   spec: {"title","guide","current":지금 단계 번호(0부터, 선택),"steps":[{"title","body","facts":["F1"] (선택),"figure":{"label","value":수치,"unit"} (선택)}] (3~6단계)}
   단계 설명에 이 사건의 사실을 쓰면 facts에 ID를 단다.
key는 모두 영문 소문자와 숫자, 밑줄만 쓴다.`;
const EXAMPLES = ["cmp-rent", "sim-wage", "proc-recall"].map((id) => {
  const c = globalThis.S5A_CASES.find((x) => x.id === id);
  return JSON.stringify({ 사실: c.facts.map((f) => `${f.id} ${f.text}${f.value !== undefined ? ` [수치 ${f.value} ${f.unit}]` : ""}`), 출력: { suitable: true, type: c.type, reason: "(이유)", purpose: "(목적)", spec: c.spec } });
}).join("\n");
const widgetFacts = (c) => c.facts.map((f) => ({ id: f.id, text: f.text, ...(f.value !== undefined ? { value: f.value, unit: f.unit } : {}) }));
const widgetSource = (c) => ({ label: c.sources.slice(0, 3).join(", ") + " 보도", asOf: c.event_date });
const widgets = await stage("interactive", async () => {
  const outs = await pool(ready, 5, async (v) => {
    const c = usable.find((p) => p.cid === v.cid), base = P.interactive(c, v.story, EXAMPLES, TYPE_HELP);
    let prompt = base.prompt, why = "";
    for (let n = 1; n <= 2; n++) {
      const r = await llm({ stage: "interactive", tag: `${c.cid}-${n}`, model: MODELS.main, maxOutputTokens: 6000, system: base.system, prompt });
      if (r.suitable === false) return { cid: c.cid, mode: "fallback", why: "조작형이 맞지 않는 소식: " + (r.reason || "") };
      const widget = { id: c.cid, type: r.type, topic: c.topic, facts: widgetFacts(c), source: widgetSource(c), spec: r.spec };
      const res = validateCase(widget);
      if (res.ok) return { cid: c.cid, mode: "interactive", type: r.type, purpose: r.purpose, widget, tries: n };
      why = res.errors.map((e) => e.code).join(", ");
      prompt = base.prompt + `\n\n앞서 만든 스펙은 검증에서 걸렸다. 아래 문제를 고쳐 다시 만들어라. 고칠 수 없으면 suitable을 false로 하라.\n${res.errors.map((e) => `- ${e.code}: ${e.msg}`).join("\n")}\n앞서 만든 스펙: ${JSON.stringify(r.spec).slice(0, 3000)}`;
    }
    return { cid: c.cid, mode: "fallback", why: "스펙이 검증을 통과하지 못함: " + why };
  });
  return { widgets: outs.map((o, i) => (o.error ? { cid: ready[i].cid, mode: "fallback", why: "생성 실패" } : o)) };
});
for (const w of widgets.widgets) console.log(`조작형 ${w.cid}: ${w.mode === "interactive" ? w.type : "요약 카드 — " + w.why}`);

// ── 묶기: 공개해도 되는 것만 담는다 (기사 본문은 담지 않는다. 근거 인용은 15~60자) ──
const stories = ready.map((v) => {
  const c = usable.find((p) => p.cid === v.cid), w = widgets.widgets.find((x) => x.cid === v.cid), sheet = presented.results.find((r) => r.cid === v.cid).sheet;
  return { id: c.cid, topic: c.topic, importance: c.imp, asOf: c.event_date, summary: c.summary, facts: c.facts.map((f) => ({ id: f.id, text: f.text, quote: f.quote, kind: f.kind, article: f.article, ...(f.value !== undefined ? { value: f.value, unit: f.unit } : {}) })),
    story: v.story, sheet, widgetMode: w.mode, widgetType: w.type || null,
    widget: w.mode === "interactive" ? w.widget : { id: c.cid, type: "fallback", facts: widgetFacts(c), source: widgetSource(c) },
    sources: c.usedArticles, sourceNames: c.sources, articleCount: c.articleCount };
}).slice(0, CFG.poolSize);
const calls = existsSync(join(dir, "llm-calls.jsonl")) ? readFileSync(join(dir, "llm-calls.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
const usd = calls.reduce((n, c) => n + c.usd, 0);
const poolData = { builtAt: new Date().toISOString(), date: collected.dateEnd, candidates: collected.candidates.length, deep: deepRows.length, prepUsd: Math.round(usd * 1000) / 1000, stories };
mkdirSync(join(DEMO, "data"), { recursive: true });
if (stories.length < 6) { console.error(`준비된 소식이 ${stories.length}편뿐이라 기존 것을 그대로 둔다`); process.exit(1); }
writeFileSync(join(DEMO, "data", "pool.mjs"), "// build-pool.mjs가 만든 파일. 손으로 고치지 않는다.\nexport default " + JSON.stringify(poolData) + ";\n");
writeFileSync(join(DEMO, "data", "pool.json"), JSON.stringify(poolData));
writeJson(join(dir, "summary.json"), { runId, stories: stories.length, llmUsd: usd, llmCalls: calls.length, newsTokens });
const spendFile = join(DEMO, "..", "private", "llm-spend.json");
if (existsSync(spendFile) && spent > 0) { const s = readJson(spendFile); s.usd += spent; s.byModel.demo = (s.byModel.demo || 0) + spent; writeJson(spendFile, s); }
console.log(`완료: 소식 ${stories.length}편 준비 (조작형 ${stories.filter((s) => s.widgetMode === "interactive").length}편), 이번 실행 AI 비용 $${usd.toFixed(3)}`);
