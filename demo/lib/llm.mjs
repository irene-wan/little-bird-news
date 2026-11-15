// Gemini 호출 한 곳. 호출마다 모델·토큰·시간·비용을 onCall로 알려 준다.
// 서버리스에서도 쓰므로 파일을 쓰지 않는다. 기록은 부르는 쪽이 정한다.
export const PRICES = {
  // 달러 / 100만 토큰 (2026-11-15 공식 요금 페이지 유료 단가)
  "gemini-3.5-flash-lite": { in: 0.3, out: 2.5 },
  "gemini-3.8-flash": { in: 0.75, out: 3.75 },
};
const THINKING = {
  "gemini-3.5-flash-lite": { thinkingLevel: "minimal" },
  "gemini-3.8-flash": { thinkingLevel: "low" },
};
export const MODELS = { light: "gemini-3.5-flash-lite", main: "gemini-3.8-flash" };

export async function llm({ apiKey, model, system, prompt, temperature = 0.2, maxOutputTokens = 8192, attempts = 2, timeoutMs = 60000, stage = "", tag = "", onCall }) {
  if (!apiKey) throw new Error("GEMINI_API_KEY가 없다");
  const price = PRICES[model] || { in: 2, out: 10 };
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens, responseMimeType: "application/json", ...(THINKING[model] ? { thinkingConfig: THINKING[model] } : {}) },
  };
  let last = "알 수 없는 오류";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const t0 = Date.now();
    let status = 0, json = {};
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
      });
      status = res.status;
      json = await res.json().catch(() => ({}));
    } catch (e) { last = "연결 실패: " + e.message; }
    const u = json.usageMetadata || {};
    const tin = u.promptTokenCount || 0, tout = (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0);
    const usd = (tin * price.in + tout * price.out) / 1e6;
    const text = (json.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
    let parsed = null, error = null;
    if (!status) error = last;
    else if (status !== 200) error = "HTTP " + status + " " + JSON.stringify(json.error?.message || "").slice(0, 200);
    else { try { parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, "")); } catch (e) { error = "JSON 해석 실패 " + (json.candidates?.[0]?.finishReason || ""); } }
    if (onCall) onCall({ stage, tag, model, attempt, ms: Date.now() - t0, in: tin, out: u.candidatesTokenCount || 0, thoughts: u.thoughtsTokenCount || 0, usd, ok: !error, error, system, prompt, responseText: text });
    if (!error) return parsed;
    last = error;
    if (status === 429 || status >= 500 || !status) await new Promise((r) => setTimeout(r, 1500 * attempt));
    else if (status >= 400) break;
  }
  throw new Error(`[${stage}/${tag}] ${last}`);
}

// 동시에 몇 개씩만 돌린다. 실패한 칸은 { error }로 남긴다.
export async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { out[k] = { error: String(e.message) }; } }
  }));
  return out;
}
