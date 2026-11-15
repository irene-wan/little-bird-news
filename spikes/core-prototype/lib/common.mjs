// 핵심 가치 프로토타입 Spike — 공통 도구. 제품 코드가 아니다.
// 모든 실행 기록은 Git에 올라가지 않는 private/runs/<실행ID>/ 에 남긴다.
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const env = Object.fromEntries(
  readFileSync(join(ROOT, ".env"), "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
export const config = JSON.parse(readFileSync(join(ROOT, "spikes", "core-prototype", "config.json"), "utf8"));

export function runDir(runId) {
  const dir = join(ROOT, "private", "runs", runId);
  mkdirSync(join(dir, "llm"), { recursive: true });
  return dir;
}
export const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
export const writeJson = (p, data) => writeFileSync(p, JSON.stringify(data, null, 1));

// 단계 결과를 파일로 남기고, 이미 있으면 다시 만들지 않는다 (같은 입력으로 다음 단계만 다시 돌릴 수 있게).
export async function stage(dir, name, fn, force) {
  const file = join(dir, name + ".json");
  if (existsSync(file) && !force) return readJson(file);
  const t0 = Date.now();
  const out = await fn();
  writeJson(file, out);
  console.log(`[${name}] ${((Date.now() - t0) / 1000).toFixed(1)}초`);
  return out;
}

// ── 뉴스 공급원 (newsapi.ai / Event Registry) ─────────────────
let newsTokens = 0;
export const newsTokensUsed = () => newsTokens;
export async function news(path, body, cost) {
  const res = await fetch("https://eventregistry.org/api/v1/" + path, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, apiKey: env.NEWSAPI_AI_KEY }),
  });
  if (!res.ok) throw new Error("뉴스 공급원 오류 " + res.status + " " + (await res.text()).slice(0, 300));
  newsTokens += cost;
  return res.json();
}

// 본문 끝에 붙어 오는 군더더기를 걷어 낸다.
const JUNK = /(좋아요\s*\d|싫어요\s*\d|후속기사|무단\s*전재|재배포\s*금지|저작권자|Copyright|ⓒ|©|기사제보|구독하기|네이버에서.*구독|\S+@\S+\.\S+|^\[?사진[=\s]|송고$|와우넷|오늘장전략)/i;
export function cleanBody(body, title) {
  const lines = String(body || "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  while (lines.length && (JUNK.test(lines.at(-1)) || lines.at(-1).length < 12)) lines.pop();
  const kept = lines.filter((l) => !JUNK.test(l) || l.length > 120);
  if (kept[0] && title && kept[0].replace(/\s/g, "") === title.replace(/\s/g, "")) kept.shift();
  return kept.join("\n");
}
export const norm = (s) => String(s || "").replace(/[\s"'“”‘’.,…·\-–—()\[\]<>]/g, "");

// ── LLM (Gemini) ───────────────────────────────────────────
// 호출마다 입력·출력·모델·지시문 버전·토큰·시간을 남긴다. 나중에 같은 입력으로 다시 돌려 비교할 수 있다.
const spendFile = join(ROOT, "private", "llm-spend.json");
function addSpend(model, usd) {
  const s = existsSync(spendFile) ? readJson(spendFile) : { usd: 0, byModel: {} };
  s.usd += usd;
  s.byModel[model] = (s.byModel[model] || 0) + usd;
  writeJson(spendFile, s);
  return s.usd;
}
export const spentUsd = () => (existsSync(spendFile) ? readJson(spendFile).usd : 0);

let seq = 0;
export async function llm(dir, { stage: stageName, tag, model, system, prompt, version, temperature = 0.2, maxOutputTokens = 8192 }) {
  if (spentUsd() >= config.budgetUsd) throw new Error(`LLM 비용 상한 도달: ${spentUsd().toFixed(3)}달러 / ${config.budgetUsd}달러`);
  const price = config.prices[model] || config.prices.default;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens, responseMimeType: "application/json", ...(config.thinking[model] ? { thinkingConfig: config.thinking[model] } : {}) },
  };
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const t0 = Date.now();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    const ms = Date.now() - t0;
    const u = json.usageMetadata || {};
    const tin = u.promptTokenCount || 0, tout = (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0);
    const usd = (tin * price.in + tout * price.out) / 1e6;
    const text = (json.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
    let parsed = null, error = null;
    if (!res.ok) error = "HTTP " + res.status + " " + JSON.stringify(json.error?.message || json).slice(0, 300);
    else { try { parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, "")); } catch (e) { error = "JSON 해석 실패: " + (json.candidates?.[0]?.finishReason || "") + " " + text.slice(0, 120); } }
    const n = String(++seq).padStart(3, "0");
    writeJson(join(dir, "llm", `${n}-${stageName}-${tag}.json`), { stage: stageName, tag, model, version, attempt, system, prompt, responseText: text, usage: u, ms, usd, error });
    appendFileSync(join(dir, "llm-calls.jsonl"), JSON.stringify({ at: new Date().toISOString(), stage: stageName, tag, model, version, attempt, ms, in: tin, out: u.candidatesTokenCount || 0, thoughts: u.thoughtsTokenCount || 0, usd, ok: !error, error }) + "\n");
    addSpend(model, usd);
    if (!error) return parsed;
    last = error;
    if (res.status === 429 || res.status >= 500) await new Promise((r) => setTimeout(r, 4000 * attempt));
    else if (res.status >= 400) break;
  }
  throw new Error(`[${stageName}/${tag}] ${last}`);
}

// 동시에 몇 개씩만 돌린다.
export async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { out[k] = { error: String(e.message) }; } }
  }));
  return out;
}
