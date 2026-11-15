// 핵심 가치 프로토타입 Spike — 하루치 소식 준비.
// 수집 → 1차 선별 → 기사 받기 → 사실 목록 → 후보 평가 → 선정 → 집필 → 검증 → 인터랙티브
// 실행: node spikes/core-prototype/run.mjs [실행ID] [--from=단계이름]
// 단계마다 결과를 private/runs/<실행ID>/<단계>.json 에 남긴다. 제품 코드가 아니다.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, config, runDir, stage as runStage, news, newsTokensUsed, cleanBody, norm, llm, pool, readJson, writeJson, spentUsd } from "./lib/common.mjs";
import * as P from "./lib/prompts.mjs";
import "../interactive-components/lib/validate.js";
import "../interactive-components/lib/cases.js";

const { validateCase } = globalThis.S5A_VALIDATE;
const args = process.argv.slice(2);
const runId = args.find((a) => !a.startsWith("--")) || new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const from = (args.find((a) => a.startsWith("--from=")) || "").slice(7);
const dir = runDir(runId);
const ORDER = ["profile", "collect", "screen", "articles", "facts", "evaluate", "select", "write", "verify", "interactive", "edition"];
const stage = (name, fn) => runStage(dir, String(ORDER.indexOf(name) + 1).padStart(2, "0") + "-" + name, fn, from && ORDER.indexOf(name) >= ORDER.indexOf(from));
const M = config.models;
const KOREA = "http://en.wikipedia.org/wiki/South_Korea";
const day = (offset) => new Date(Date.now() + 9 * 3600e3 + offset * 86400e3).toISOString().slice(0, 10);

// ── 1. 프로필 스냅숏: 이번 실행이 근거로 삼은 프로필을 그대로 남긴다 (FR-A-11) ──
const profile = await stage("profile", async () => {
  const lines = readFileSync(join(ROOT, "private", "profile.md"), "utf8").split("\n");
  const items = [];
  let category = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("## ")) { category = line.slice(3).trim(); continue; }
    if (!category || !line || line.startsWith("(") || line.startsWith("#")) continue;
    for (const part of line.split(/(?<=[.。])\s+/).map((s) => s.trim()).filter((s) => s.length > 3)) items.push({ id: "P" + (items.length + 1), category, text: part, provenance: "직접 입력" });
  }
  if (items.length === 0) throw new Error("프로필이 비어 있다 (E-A-02)");
  return { takenAt: new Date().toISOString(), items };
});
const pById = new Map(profile.items.map((p) => [p.id, p]));

// ── 2. 수집: 큰 사건 + 프로필에서 나온 검색어 ──
const collected = await stage("collect", async () => {
  const dateStart = day(-1), dateEnd = day(0);
  const candidates = new Map();
  for (let page = 1; page <= config.bigEventPages; page++) {
    const r = await news("event/getEvents", { action: "getEvents", lang: "kor", sourceLocationUri: KOREA, dateStart, dateEnd, resultType: "events", eventsSortBy: "size", eventsCount: 50, eventsPage: page, includeEventSummary: true, includeEventArticleCounts: true }, 5);
    for (const e of r.events?.results || []) {
      const title = typeof e.title === "string" ? e.title : e.title?.kor || Object.values(e.title || {})[0] || "";
      const summary = typeof e.summary === "string" ? e.summary : e.summary?.kor || Object.values(e.summary || {})[0] || "";
      candidates.set(e.uri, { key: e.uri, eventUri: e.uri, origins: ["큰 사건"], title, snippet: summary.replace(/\s+/g, " ").slice(0, 160), articleCount: e.totalArticleCount, articles: [] });
    }
  }
  const q = await llm(dir, { stage: "collect", tag: "queries", model: M.screen, version: P.VERSION, ...P.queries(profile.items, config.searchQueries) });
  const queries = (q.queries || []).filter((x) => x && typeof x.q === "string").slice(0, config.searchQueries);
  for (const query of queries) {
    const r = await news("article/getArticles", { action: "getArticles", keyword: query.q, keywordSearchMode: "simple", lang: "kor", sourceLocationUri: KOREA, dateStart: day(-(config.searchDays || 3)), dateEnd, dataType: ["news"], isDuplicateFilter: "skipDuplicates", articlesSortBy: "rel", articlesCount: config.articlesPerQuery, articleBodyLen: -1, resultType: "articles", includeArticleEventUri: true }, 1);
    query.found = r.articles?.results?.length || 0;
    for (const a of r.articles?.results || []) {
      const key = a.eventUri || "t:" + norm(a.title).slice(0, 18);
      const c = candidates.get(key) || { key, eventUri: a.eventUri || null, origins: [], title: a.title, snippet: cleanBody(a.body, a.title).replace(/\s+/g, " ").slice(0, 160), articleCount: 0, articles: [] };
      if (!c.origins.includes("검색: " + query.q)) c.origins.push("검색: " + query.q);
      c.articles.push(a);
      if (!a.eventUri) c.articleCount = c.articles.length;
      candidates.set(key, c);
    }
  }
  const list = [...candidates.values()].map((c, i) => ({ cid: "C" + (i + 1), ...c }));
  return { dateStart, dateEnd, queries, newsTokens: newsTokensUsed(), candidates: list };
});
console.log(`후보 ${collected.candidates.length}건 (큰 사건 ${collected.candidates.filter((c) => c.origins.includes("큰 사건")).length}, 검색 ${collected.candidates.filter((c) => c.origins.some((o) => o.startsWith("검색"))).length})`);

// ── 3. 1차 선별: 모든 후보를 훑어 깊이 볼 후보를 추린다. 모든 후보의 판단을 남긴다 ──
const screened = await stage("screen", async () => {
  const chunks = [];
  for (let i = 0; i < collected.candidates.length; i += 90) chunks.push(collected.candidates.slice(i, i + 90));
  const outs = await pool(chunks, 3, (chunk, i) => llm(dir, { stage: "screen", tag: "chunk" + i, model: M.screen, version: P.VERSION, maxOutputTokens: 16000, ...P.screen(profile.items, chunk) }));
  const byCid = new Map();
  for (const o of outs) for (const it of o.items || []) byCid.set(it.cid, it);
  const rows = collected.candidates.map((c) => {
    const j = byCid.get(c.cid);
    const pids = (j?.pids || []).filter((id) => pById.has(id));
    const score = j ? (j.avoid ? -1 : j.rel * 2 + j.imp + (pids.length ? 0.5 : 0)) : -2;
    return { cid: c.cid, title: c.title, origins: c.origins, articleCount: c.articleCount, rel: j?.rel ?? null, imp: j?.imp ?? null, avoid: !!j?.avoid, pids, topic: j?.topic || "", why: j?.why || (j ? "" : "판단 누락"), score };
  });
  const ranked = [...rows].sort((a, b) => b.score - a.score || b.articleCount - a.articleCount);
  const deep = new Set(ranked.filter((r) => r.score > 0).slice(0, config.deepCandidates).map((r) => r.cid));
  for (const r of rows) r.decision = deep.has(r.cid) ? "깊이 평가" : r.avoid ? "제외: 받고 싶지 않은 주제" : r.score < 0 ? "제외: 판단 누락" : "제외: 1차 점수 낮음";
  return { rows };
});
const deepRows = screened.rows.filter((r) => r.decision === "깊이 평가");
console.log(`1차 선별: 깊이 평가 ${deepRows.length}건 / 받고 싶지 않은 주제 ${screened.rows.filter((r) => r.avoid).length}건`);

// ── 4. 기사 받기와 사건 정리: 같은 기사가 여러 매체에 실린 것을 걷어 낸다 ──
const withArticles = await stage("articles", async () => {
  const out = [];
  for (const row of deepRows) {
    const c = collected.candidates.find((x) => x.cid === row.cid);
    let raw = c.articles;
    if (c.eventUri) {
      const r = await news("event/getEvent", { eventUri: c.eventUri, resultType: "articles", articlesLang: "kor", articlesSortBy: "sourceImportance", articlesCount: config.articlesPerEvent, articleBodyLen: -1 }, 1);
      raw = (r[c.eventUri]?.articles?.results || []).concat(raw);
    }
    const seen = new Set();
    const articles = [];
    let duplicates = 0;
    for (const a of raw) {
      const body = cleanBody(a.body, a.title);
      const sig = norm(body).slice(0, 80);
      if (body.length < 200 || seen.has(a.url)) continue;
      if (seen.has(sig)) { duplicates++; continue; }
      seen.add(sig); seen.add(a.url);
      articles.push({ source: a.source?.title || "?", title: a.title, url: a.url, dateTime: a.dateTime, image: a.image || null, body });
    }
    out.push({ cid: row.cid, eventUri: c.eventUri, title: c.title, origins: c.origins, articleCount: Math.max(c.articleCount || 0, articles.length), duplicatesRemoved: duplicates, articles });
  }
  return { newsTokens: newsTokensUsed(), candidates: out.filter((c) => c.articles.length > 0) };
});

// ── 5. 사실 목록: 기사 원문에 그대로 있는 근거가 확인된 사실만 남긴다 ──
const factSheets = await stage("facts", async () => {
  const outs = await pool(withArticles.candidates, 4, async (c) => {
    const used = [...c.articles].sort((a, b) => b.body.length - a.body.length).slice(0, 4).map((a) => ({ ...a, body: a.body.slice(0, 3000) }));
    const r = await llm(dir, { stage: "facts", tag: c.cid, model: M.facts, version: P.VERSION, ...P.facts(used) });
    const bodies = used.map((a) => norm(a.body));
    const kept = [], dropped = [];
    for (const f of r.facts || []) {
      if (!f || typeof f.text !== "string" || typeof f.quote !== "string") continue;
      const q = norm(f.quote);
      const idx = q.length >= 8 ? bodies.findIndex((b) => b.includes(q)) : -1;
      if (idx < 0) { dropped.push({ text: f.text, quote: f.quote, reason: "근거 문장이 기사 원문에 없음" }); continue; }
      const fact = { id: "F" + (kept.length + 1), text: f.text, quote: f.quote, article: idx, kind: f.kind === "claim" ? "claim" : "fact" };
      if (typeof f.value === "number" && Number.isFinite(f.value) && /\d/.test(f.quote) && typeof f.unit === "string" && f.unit) { fact.value = f.value; fact.unit = f.unit; }
      kept.push(fact);
    }
    return { cid: c.cid, title: c.title, summary: r.summary || c.title, event_date: /^\d{4}-\d{2}-\d{2}$/.test(r.event_date || "") ? r.event_date : collected.dateEnd, same_event: r.same_event !== false, mixed: r.mixed || [], conflicts: (r.conflicts || []).filter(Boolean), facts: kept, droppedFacts: dropped, usedArticles: used.map((a) => ({ source: a.source, title: a.title, url: a.url, dateTime: a.dateTime })), sources: [...new Set(c.articles.map((a) => a.source))], articleCount: c.articleCount };
  });
  return { sheets: outs.map((o, i) => (o.error ? { cid: withArticles.candidates[i].cid, error: o.error, facts: [] } : o)) };
});
{
  const all = factSheets.sheets.reduce((n, s) => n + s.facts.length + (s.droppedFacts?.length || 0), 0);
  const dropped = factSheets.sheets.reduce((n, s) => n + (s.droppedFacts?.length || 0), 0);
  console.log(`사실 목록: ${all - dropped}건 유지, ${dropped}건은 근거 문장이 원문에 없어 버림`);
}

// ── 6. 후보 평가: 프로필 항목과 사건 사실의 연결고리, 평가 기준 ──
const deliveredFile = join(ROOT, "private", "delivered.json");
const delivered = existsSync(deliveredFile) ? readJson(deliveredFile) : [];
const evaluated = await stage("evaluate", async () => {
  const usable = factSheets.sheets.filter((s) => !s.error && s.facts.length >= 3 && s.same_event);
  const past = delivered.filter((d) => d.runId !== runId).map((d) => d.summary);
  const outs = await pool(usable, 4, async (s) => {
    const r = await llm(dir, { stage: "evaluate", tag: s.cid, model: M.evaluate, version: P.VERSION, ...P.evaluate(profile.items, s, past) });
    const fids = new Set(s.facts.map((f) => f.id));
    const links = [], rejected = [];
    for (const l of r.links || []) {
      const f = (l.fact_ids || []).filter((id) => fids.has(id));
      // 프로필 근거는 이번 스냅숏에 실제로 있는 항목만, 사건 근거는 확인된 사실만 인정한다
      if (!pById.has(l.profile_id) || f.length === 0) { rejected.push({ ...l, reason: "프로필 항목이나 사실 ID가 실제로 없음" }); continue; }
      links.push({ profile_id: l.profile_id, profile_text: pById.get(l.profile_id).text, fact_ids: f, relation: String(l.relation || ""), inferred: !!l.inferred, strength: Number(l.strength) || 1 });
    }
    const cr = r.criteria || {};
    const sc = (k) => Math.min(5, Math.max(1, Number(cr[k]?.score) || 1));
    const criteria = Object.fromEntries(["relevance", "importance", "novelty", "reliability"].map((k) => [k, { score: k === "relevance" && links.length === 0 ? 1 : sc(k), reason: String(cr[k]?.reason || "") }]));
    const w = config.weights;
    const total = criteria.relevance.score * w.relevance + criteria.importance.score * w.importance + criteria.reliability.score * w.reliability + criteria.novelty.score * w.novelty;
    return { cid: s.cid, summary: s.summary, links, rejectedLinks: rejected, criteria, avoid: !!r.avoid?.is, kind: ["personal", "important", "discovery", "skip"].includes(r.kind) ? r.kind : "skip", topic: String(r.topic || ""), total: Math.round(total * 100) / 100 };
  });
  const skipped = factSheets.sheets.filter((s) => !usable.includes(s)).map((s) => ({ cid: s.cid, reason: s.error ? "사실 목록 생성 실패" : !s.same_event ? "사건 정리 오류: 다른 사건의 기사가 섞임" : "근거가 확인된 사실이 3건 미만" }));
  return { evals: outs.map((o, i) => (o.error ? { cid: usable[i].cid, error: o.error } : o)), skipped };
});

// ── 7. 선정: 정해진 규칙으로 고르고 모든 후보의 이유를 남긴다 (LLM을 쓰지 않는다) ──
const selection = await stage("select", async () => {
  const decisions = evaluated.skipped.map((s) => ({ cid: s.cid, selected: false, reason: "제외: " + s.reason }));
  const pool2 = [];
  for (const e of evaluated.evals) {
    if (e.error) { decisions.push({ cid: e.cid, selected: false, reason: "제외: 평가 실패" }); continue; }
    if (e.avoid) { decisions.push({ cid: e.cid, selected: false, reason: "제외: 받고 싶지 않은 주제" }); continue; }
    if (e.kind === "skip") { decisions.push({ cid: e.cid, selected: false, reason: "제외: 전할 이유가 없음" }); continue; }
    if (e.criteria.novelty.score <= 1) { decisions.push({ cid: e.cid, selected: false, reason: "제외: 이미 전달한 사건의 반복" }); continue; }
    // 개인 관련 소식은 근거 있는 연결고리가 있어야 한다. 없으면 개인화된 이유를 붙이지 않는다 (FR-B-08)
    const personal = e.links.length > 0 && e.criteria.relevance.score >= config.minRelevanceForPersonal;
    if (!personal && e.criteria.importance.score < 4) { decisions.push({ cid: e.cid, selected: false, reason: "제외: 근거 있는 연결이 약하고 중요도도 높지 않음" }); continue; }
    pool2.push({ ...e, kind: personal ? "personal" : e.kind === "discovery" ? "discovery" : "important", links: personal ? e.links : [] });
  }
  pool2.sort((a, b) => b.total - a.total);
  const picked = [];
  for (const e of pool2) {
    if (picked.length >= config.storiesPerDay) { decisions.push({ cid: e.cid, selected: false, reason: `제외: 점수 순위 밖 (${e.total})` }); continue; }
    if (picked.some((p) => p.topic && p.topic === e.topic)) { decisions.push({ cid: e.cid, selected: false, reason: `제외: 같은 주제(${e.topic})가 이미 선정됨` }); continue; }
    picked.push(e);
    decisions.push({ cid: e.cid, selected: true, reason: `선정: ${e.kind === "personal" ? "근거 있는 개인 연결" : e.kind === "discovery" ? "발견형" : "중요해서"} (${e.total})` });
  }
  return { picked: picked.map((p) => p.cid), kinds: Object.fromEntries(picked.map((p) => [p.cid, p.kind])), linksUsed: Object.fromEntries(picked.map((p) => [p.cid, p.links])), decisions, shortfall: picked.length < config.storiesPerDay ? "기준을 통과한 후보가 계획한 수보다 적다 (품질 기준)" : null };
});
const picked = selection.picked.map((cid) => {
  const sheet = factSheets.sheets.find((s) => s.cid === cid);
  const ev = evaluated.evals.find((e) => e.cid === cid);
  return { ...sheet, links: selection.linksUsed[cid], kind: selection.kinds[cid], topic: ev.topic, criteria: ev.criteria };
});
console.log(`선정 ${picked.length}편: ` + picked.map((p) => `[${p.kind}] ${p.title.slice(0, 28)}`).join(" / "));

// ── 8. 집필 (선정과 별도 단계) ──
const drafts = await stage("write", async () => {
  const outs = await pool(picked, 3, (c) => llm(dir, { stage: "write", tag: c.cid, model: M.write, version: P.VERSION, temperature: 0.5, ...P.write(profile.items, c) }));
  return { drafts: outs.map((o, i) => ({ cid: picked[i].cid, ...(o.error ? { error: o.error } : { story: o }) })) };
});

async function checkStory(c, s, round) {
  const fmap = new Map(c.facts.map((f) => [f.id, f]));
  const claims = [];
  const add = (sid, text, facts, kind, ref) => claims.push({ sid, text: String(text || ""), facts: (facts || []).filter((id) => fmap.has(id)), kind, ref });
  add("S0", s.lede?.text, s.lede?.facts, "fact", s.lede);
  (s.blocks || []).forEach((b, bi) => (b.sentences || []).forEach((sen, si) => { if (b.kind === "fact" || (sen.facts || []).length) add(`S${bi + 1}_${si + 1}`, sen.text, sen.facts, b.kind, sen); }));
  add("WHY", s.why?.text, c.links.flatMap((l) => l.fact_ids), "why", s.why);
  const r = await llm(dir, { stage: "verify", tag: c.cid + "-" + round, model: M.verify, version: P.VERSION, temperature: 0, ...P.verify(c, s, claims) });
  const verdicts = new Map((r.results || []).map((x) => [x.sid, x]));
  const report = [];
  for (const cl of claims) {
    const v = verdicts.get(cl.sid);
    let verdict = v?.verdict || "unsupported", problem = v?.problem || (v ? "" : "검증 결과 누락");
    if (cl.kind === "fact" && cl.facts.length === 0) { verdict = "unsupported"; problem = "근거 사실 ID가 없음"; }
    // 숫자 대조: 문장에 나온 숫자는 근거 사실의 문장이나 원문 인용에 있어야 한다
    if (cl.kind !== "why" && verdict === "ok") {
      const hay = cl.facts.map((id) => fmap.get(id)).map((f) => f.text + " " + f.quote + " " + (f.value ?? "")).join(" ").replace(/,/g, "");
      const missing = (cl.text.replace(/,/g, "").match(/\d+(?:\.\d+)?/g) || []).filter((n) => !hay.includes(n));
      if (missing.length) { verdict = "overreach"; problem = "근거에 없는 숫자: " + missing.join(", "); }
    }
    cl.ref.verdict = verdict;
    report.push({ sid: cl.sid, kind: cl.kind, text: cl.text, facts: cl.facts, verdict, problem });
  }
  const checked = report.filter((x) => x.kind !== "why");
  const bad = checked.filter((x) => x.verdict !== "ok");
  // 통과하지 못한 문장은 싣지 않는다 (NFR-T-01)
  for (const b of s.blocks || []) b.sentences = (b.sentences || []).filter((sen) => !sen.verdict || sen.verdict === "ok");
  s.blocks = (s.blocks || []).filter((b) => b.sentences.length > 0);
  const whyOk = report.find((x) => x.sid === "WHY")?.verdict === "ok";
  if (!whyOk) s.why = { text: c.links.length ? `프로필에 적어 주신 "${c.links[0].profile_text}"와 이어지는 소식이에요.` : "직접 관련은 적지만 알아 둘 만한 소식이라 골랐어요.", links: [], replaced: true };
  let holdReason = null;
  if (report.find((x) => x.sid === "S0")?.verdict !== "ok") holdReason = "핵심 문장이 근거와 맞지 않음";
  else if (bad.length / Math.max(1, checked.length) > 0.34) holdReason = `근거와 맞지 않는 문장이 많음 (${bad.length}/${checked.length})`;
  else if (!s.blocks.some((b) => b.kind === "fact")) holdReason = "사실 문단이 남지 않음";
  return { holdReason, bad, whyOk, report, story: s };
}

// ── 9. 검증: 다른 모델이 문장과 근거를 대조하고, 숫자는 코드로 대조한다 ──
const verified = await stage("verify", async () => {
  const outs = await pool(drafts.drafts, 3, async (d) => {
    if (d.error) return { cid: d.cid, published: false, holdReason: "집필 실패: " + d.error };
    const c = picked.find((p) => p.cid === d.cid);
    let res = await checkStory(c, structuredClone(d.story), 1);
    let revised = false;
    const firstReport = res.report;
    if (res.bad.length || !res.whyOk) {
      // 걸린 문장을 필자에게 돌려보내 한 번 고쳐 쓰게 한다. 고친 글은 처음부터 다시 검증한다
      const problems = res.report.filter((x) => x.verdict !== "ok");
      try {
        const fixed = await llm(dir, { stage: "revise", tag: c.cid, model: M.write, version: P.VERSION, temperature: 0.3, ...P.revise(profile.items, c, d.story, problems) });
        if (fixed && fixed.lede && Array.isArray(fixed.blocks)) { res = await checkStory(c, fixed, 2); revised = true; }
      } catch (e) { /* 고쳐 쓰기에 실패하면 첫 검증 결과를 그대로 쓴다 */ }
    }
    const { holdReason, bad, whyOk, report, story: s } = res;
    return { cid: c.cid, published: !holdReason, holdReason, revised, removedSentences: bad.length, whyReplaced: !whyOk, report, firstReport: revised ? firstReport : undefined, story: s };
  });
  return { results: outs.map((o, i) => (o.error ? { cid: drafts.drafts[i].cid, published: false, holdReason: "검증 실패: " + o.error } : o)) };
});
for (const r of verified.results) console.log(`검증 ${r.cid}: ${r.published ? "발행" : "보류 — " + r.holdReason}${r.removedSentences ? ` (문장 ${r.removedSentences}개 삭제)` : ""}${r.whyReplaced ? " (추천 이유 교체)" : ""}${r.revised ? " (한 번 고쳐 씀)" : ""}`);

// ── 10. 인터랙티브: AI가 유형을 고르고 스펙을 만든다. S5a 검증기를 통과한 것만 쓴다 ──
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

async function makeWidget(c, story, model, allowRetry) {
  const base = P.interactive(c, story, EXAMPLES, TYPE_HELP);
  const attempts = [];
  let prompt = base.prompt;
  for (let n = 1; n <= (allowRetry ? 2 : 1); n++) {
    let r;
    try { r = await llm(dir, { stage: "interactive", tag: `${c.cid}-${model}-${n}`, model, version: P.VERSION, maxOutputTokens: 6000, system: base.system, prompt }); }
    catch (e) { attempts.push({ n, error: String(e.message) }); break; }
    if (r.suitable === false) { attempts.push({ n, suitable: false, reason: r.reason }); return { mode: "visual", why: "조작형이 적합하지 않다고 판단: " + (r.reason || ""), attempts }; }
    const widget = { id: c.cid, type: r.type, topic: c.topic, facts: c.facts.map((f) => ({ id: f.id, text: f.text, ...(f.value !== undefined ? { value: f.value, unit: f.unit } : {}) })), source: { label: c.sources.slice(0, 3).join(", ") + " 보도", asOf: c.event_date }, spec: r.spec };
    const res = validateCase(widget);
    attempts.push({ n, type: r.type, reason: r.reason, purpose: r.purpose, ok: res.ok, errors: res.errors });
    if (res.ok) return { mode: "interactive", type: r.type, reason: r.reason, purpose: r.purpose, widget, attempts };
    prompt = base.prompt + `\n\n앞서 만든 스펙은 검증에서 걸렸다. 아래 문제를 고쳐 다시 만들어라. 고칠 수 없으면 suitable을 false로 하라.\n${res.errors.map((e) => `- ${e.code}: ${e.msg}`).join("\n")}\n앞서 만든 스펙: ${JSON.stringify(r.spec).slice(0, 3000)}`;
  }
  return { mode: "visual", why: "스펙이 검증을 통과하지 못함", attempts };
}
const published = verified.results.filter((r) => r.published);
const widgets = await stage("interactive", async () => {
  const outs = await pool(published, 3, async (v) => ({ cid: v.cid, ...(await makeWidget(picked.find((p) => p.cid === v.cid), v.story, M.interactive, true)) }));
  return { widgets: outs.map((o, i) => (o.error ? { cid: published[i].cid, mode: "visual", why: "생성 실패: " + o.error, attempts: [] } : o)) };
});
for (const w of widgets.widgets) console.log(`인터랙티브 ${w.cid}: ${w.mode === "interactive" ? w.type + " (시도 " + w.attempts.length + "회)" : "대체 시각 요소 — " + w.why}`);

// ── 11. 오늘의 소식: 읽기 화면이 쓰는 최종 결과 ──
const edition = await stage("edition", async () => {
  const stories = published.map((v) => {
    const c = picked.find((p) => p.cid === v.cid);
    const w = widgets.widgets.find((x) => x.cid === v.cid);
    return {
      cid: c.cid, kind: c.kind, topic: c.topic, asOf: c.event_date, story: v.story,
      inferred: c.links.some((l) => l.inferred),
      widgetMode: w.mode, widgetType: w.type || null, widgetReason: w.reason || w.why,
      widget: w.mode === "interactive" ? w.widget : { id: c.cid, type: "fallback", facts: c.facts.map((f) => ({ id: f.id, text: f.text, ...(f.value !== undefined ? { value: f.value, unit: f.unit } : {}) })), source: { label: c.sources.slice(0, 3).join(", ") + " 보도", asOf: c.event_date } },
      sources: c.usedArticles,
    };
  });
  return { runId, date: collected.dateEnd, planned: config.storiesPerDay, stories, emptyReason: stories.length ? null : selection.picked.length ? "선정된 소식이 모두 검증에서 보류됨 (품질 기준)" : "기준을 통과한 후보가 없음 (품질 기준)" };
});
const others = delivered.filter((d) => d.runId !== runId);
writeJson(deliveredFile, others.concat(edition.stories.map((s) => ({ runId, cid: s.cid, summary: picked.find((p) => p.cid === s.cid).summary }))));

const calls = existsSync(join(dir, "llm-calls.jsonl")) ? readFileSync(join(dir, "llm-calls.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
const byStage = {};
for (const c of calls) { const s = (byStage[c.stage] ||= { calls: 0, usd: 0, sec: 0, failed: 0 }); s.calls++; s.usd += c.usd; s.sec += c.ms / 1000; if (!c.ok) s.failed++; }
writeJson(join(dir, "summary.json"), { runId, stories: edition.stories.length, llmUsd: calls.reduce((n, c) => n + c.usd, 0), llmCalls: calls.length, byStage, newsTokens: (collected.newsTokens || 0) + (withArticles.newsTokens || 0), totalSpentUsd: spentUsd() });
console.log(`완료: 소식 ${edition.stories.length}편, 이번 실행 LLM 비용 $${calls.reduce((n, c) => n + c.usd, 0).toFixed(3)}, 누적 $${spentUsd().toFixed(3)}`);
