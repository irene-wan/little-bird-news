// 독자의 프로필을 받아, 미리 준비해 둔 소식 가운데 세 편을 고르고 "가져온 이유"를 만든다.
// 후보 평가(AI) → 선정(정해진 규칙, AI 없음) → 가져온 이유 쓰기(AI) → 이유 검증(다른 역할의 AI + 실패하면 정해진 문장)
// 프로필은 어디에도 저장하지 않는다. 이 함수 안에서만 쓰고 버린다.
import { llm, pool, MODELS } from "./llm.mjs";
import * as P from "./prompts.mjs";

export const STORIES_PER_DAY = 3;
const WEIGHTS = { relevance: 0.5, importance: 0.2, reliability: 0.2, novelty: 0.1 };
const FIELDS = [["job", "하는 일·상황"], ["interests", "관심사"], ["weak", "잘 모르는 분야"], ["avoid", "받고 싶지 않은 주제"]];
const MAX_FIELD = 300;

// 입력을 항목 단위로 나눈다. 고른 근거는 항상 이 항목 하나하나를 가리킨다.
export function toItems(input) {
  const items = [];
  for (const [key, category] of FIELDS) {
    const raw = String(input?.[key] || "").slice(0, MAX_FIELD);
    for (const part of raw.split(/[\n,，、;]+|(?<=[.。!?])\s+/).map((s) => s.trim()).filter((s) => s.length >= 2)) {
      if (items.length < 16) items.push({ id: "P" + (items.length + 1), category, text: part });
    }
  }
  return items;
}

export async function personalize(input, poolData, { apiKey } = {}) {
  const t0 = Date.now();
  const items = toItems(input);
  if (!items.some((p) => p.category !== "받고 싶지 않은 주제")) throw Object.assign(new Error("프로필이 비어 있어요. 하는 일이나 관심사를 한 줄이라도 적어 주세요."), { status: 400 });
  const pById = new Map(items.map((p) => [p.id, p]));
  const calls = [];
  const ask = (o) => llm({ apiKey, timeoutMs: 40000, ...o, onCall: (c) => calls.push({ stage: c.stage, model: c.model, ms: c.ms, usd: c.usd, ok: c.ok }) });

  // 1. 후보 평가: 프로필 항목과 사건의 사실 사이에 근거 있는 연결고리가 있는가
  const outs = await pool(poolData.stories, 16, async (s) => {
    const cand = { summary: s.summary, facts: s.facts, articleCount: s.articleCount, sources: s.sourceNames };
    const r = await ask({ stage: "evaluate", tag: s.id, model: MODELS.main, maxOutputTokens: 3000, ...P.evaluate(items, cand, []) });
    const fids = new Set(s.facts.map((f) => f.id)), links = [];
    for (const l of r.links || []) {
      const f = (l.fact_ids || []).filter((id) => fids.has(id));
      // 프로필 근거는 실제로 있는 항목만, 사건 근거는 확인된 사실만 인정한다
      if (!pById.has(l.profile_id) || f.length === 0 || pById.get(l.profile_id).category === "받고 싶지 않은 주제") continue;
      links.push({ profile_id: l.profile_id, profile_text: pById.get(l.profile_id).text, fact_ids: f, fact_texts: f.slice(0, 2).map((id) => s.facts.find((x) => x.id === id).text), relation: String(l.relation || ""), inferred: !!l.inferred, strength: Number(l.strength) || 1 });
    }
    const cr = r.criteria || {};
    const sc = (k) => Math.min(5, Math.max(1, Number(cr[k]?.score) || 1));
    const criteria = { relevance: links.length ? sc("relevance") : 1, importance: sc("importance"), reliability: sc("reliability"), novelty: 5 };
    const total = Object.keys(WEIGHTS).reduce((n, k) => n + criteria[k] * WEIGHTS[k], 0);
    return { id: s.id, links, criteria, avoid: !!r.avoid?.is, kind: r.kind, total: Math.round(total * 100) / 100 };
  });
  const evals = outs.map((o, i) => (o.error ? { id: poolData.stories[i].id, failed: true } : o));
  if (evals.filter((e) => !e.failed).length < STORIES_PER_DAY) throw Object.assign(new Error("지금은 소식을 고르지 못했어요. 잠시 뒤에 다시 해 주세요."), { status: 503 });

  // 2. 선정: 정해진 규칙으로 고르고, 모든 후보의 이유를 남긴다 (AI를 쓰지 않는다)
  const story = (id) => poolData.stories.find((s) => s.id === id);
  const decisions = [], ranked = [];
  for (const e of evals) {
    if (e.failed) { decisions.push({ id: e.id, selected: false, reason: "평가하지 못함" }); continue; }
    if (e.avoid) { decisions.push({ id: e.id, selected: false, reason: "받고 싶지 않다고 한 주제" }); continue; }
    const personal = e.links.length > 0 && e.criteria.relevance >= 3;
    ranked.push({ ...e, personal, links: personal ? e.links : [], total: personal ? e.total : Math.round((e.total - (e.criteria.relevance - 1) * WEIGHTS.relevance) * 100) / 100 });
  }
  ranked.sort((a, b) => b.total - a.total);
  const picked = [];
  const take = (e, why) => { picked.push(e); decisions.push({ id: e.id, selected: true, reason: why + ` (점수 ${e.total})` }); };
  for (const e of ranked) {
    if (picked.length >= STORIES_PER_DAY) break;
    if (!e.personal) continue;
    if (picked.some((p) => story(p.id).topic === story(e.id).topic)) continue;
    take(e, "프로필과 근거 있는 연결");
  }
  // 개인 연결이 있는 소식이 모자라면, 억지로 잇지 않고 중요한 소식으로 채운다
  for (const sameTopicOk of [false, true]) for (const e of ranked) {
    if (picked.length >= STORIES_PER_DAY) break;
    if (picked.includes(e) || (!sameTopicOk && picked.some((p) => story(p.id).topic === story(e.id).topic))) continue;
    take(e, e.personal ? "프로필과 근거 있는 연결" : "개인 연결은 약하지만 알아 둘 만한 소식");
  }
  for (const e of ranked) if (!decisions.some((d) => d.id === e.id)) decisions.push({ id: e.id, selected: false, reason: e.personal ? `연결은 있지만 순위 밖이거나 같은 주제가 이미 뽑힘 (점수 ${e.total})` : `프로필과 근거 있는 연결이 약함 (점수 ${e.total})` });

  // 3. 가져온 이유: 연결고리에 있는 프로필 문장과 사실만으로 쓴다
  const picks = picked.map((e) => ({ id: e.id, summary: story(e.id).summary, links: e.links.slice(0, 2), inferred: e.links.some((l) => l.inferred) }));
  const fallback = (p) => (p.links.length ? `적어 주신 "${p.links[0].profile_text}"와 이어지는 소식이에요.` : "직접 이어지는 건 적지만, 알아 둘 만한 소식이라 골랐어요.");
  let replaced = 0;
  try {
    const w = await ask({ stage: "why", tag: "all", model: MODELS.main, temperature: 0.5, maxOutputTokens: 1500, ...P.whys(picks) });
    for (const p of picks) p.why = String((w.whys || []).find((x) => x.id === p.id)?.text || "").slice(0, 220);
    // 4. 검증: 프로필에 적히지 않은 사정을 보탰으면 정해진 문장으로 바꾼다
    const v = await ask({ stage: "why-verify", tag: "all", model: MODELS.main, temperature: 0, maxOutputTokens: 1500, ...P.whysVerify(picks.filter((p) => p.why)) });
    for (const p of picks) {
      const ok = p.why && (v.results || []).find((x) => x.id === p.id)?.verdict === "ok";
      if (!ok) { p.why = fallback(p); p.replaced = true; replaced++; }
    }
  } catch (e) {
    for (const p of picks) { p.why = fallback(p); p.replaced = true; }
    replaced = picks.length;
  }

  const title = (id) => story(id).sheet.compact || story(id).story.title;
  return {
    date: poolData.date,
    stories: picks.map((p) => ({ ...story(p.id), personal: p.links.length > 0, inferred: p.inferred, why: p.why, whyReplaced: !!p.replaced,
      basis: p.links.map((l) => ({ profile: l.profile_text, fact: l.fact_texts[0], relation: l.relation, inferred: l.inferred })) })),
    process: {
      profileItems: items.length, poolSize: poolData.stories.length, candidates: poolData.candidates, prepUsd: poolData.prepUsd,
      decisions: decisions.sort((a, b) => Number(b.selected) - Number(a.selected)).map((d) => ({ title: title(d.id), topic: story(d.id).topic, selected: d.selected, reason: d.reason })),
      whyReplaced: replaced, aiCalls: calls.length, usd: Math.round(calls.reduce((n, c) => n + c.usd, 0) * 10000) / 10000, ms: Date.now() - t0,
    },
  };
}
