// POST /api/edition  { job, interests, weak, avoid }  →  그 독자를 위한 오늘의 소식 세 편
// 프로필은 저장하지 않는다. 고르는 동안 AI(Gemini)에만 전달한다.
import poolData from "../data/pool.mjs";
import { personalize } from "../lib/personalize.mjs";

// 남용 막기: 서버 한 대(인스턴스)가 기억하는 범위의 간단한 제한
const hits = new Map();
let dayKey = "", dayCount = 0;
const PER_IP = 8, WINDOW_MS = 10 * 60e3, PER_DAY = 400;
function allowed(ip) {
  const now = Date.now(), today = new Date().toISOString().slice(0, 10);
  if (today !== dayKey) { dayKey = today; dayCount = 0; }
  if (dayCount >= PER_DAY) return false;
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= PER_IP) return false;
  list.push(now); hits.set(ip, list); dayCount++;
  if (hits.size > 2000) hits.clear();
  return true;
}

export async function handle(body, ip) {
  if (!allowed(ip)) return { status: 429, json: { error: "요청이 많아요. 몇 분 뒤에 다시 해 주세요." } };
  try {
    const edition = await personalize(body || {}, poolData, { apiKey: process.env.GEMINI_API_KEY });
    return { status: 200, json: edition };
  } catch (e) {
    console.error("edition 실패:", e.message);
    return { status: e.status || 500, json: { error: e.status ? e.message : "소식을 고르는 중에 문제가 생겼어요. 잠시 뒤에 다시 해 주세요." } };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST만 받는다" });
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
  const out = await handle(body, ip);
  res.status(out.status).json(out.json);
}
