// POST /api/prepare  →  오늘의 소식이 준비돼 있는지 보고, 오래됐으면 그 자리에서 최신 뉴스로 새로 준비한다.
// 아무도 쓰지 않는 날에는 아무 비용도 들지 않는다. 그날 처음 누른 사람만 1~2분 기다리고, 그 뒤 12시간은 바로 쓴다.
import { buildPool } from "../lib/build.mjs";
import { currentPool, savePool, isFresh, isBuilding, markBuilding } from "../lib/store.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let building = null;

export async function handle() {
  let pool = await currentPool();
  if (isFresh(pool)) return { status: 200, json: { ready: true, date: pool.date, built: false } };
  // 다른 요청이 이미 준비하고 있으면 끝나기를 기다린다
  if (!building && (await isBuilding())) {
    for (let i = 0; i < 40 && !isFresh(pool); i++) { await sleep(5000); pool = await currentPool(); }
    return { status: 200, json: { ready: true, date: pool.date, built: false, stale: !isFresh(pool) } };
  }
  if (!building) {
    building = (async () => {
      await markBuilding(true);
      try {
        const fresh = await buildPool({ geminiKey: process.env.GEMINI_API_KEY, newsKey: process.env.NEWSAPI_AI_KEY, log: (m) => console.log(m) });
        await savePool(fresh);
        return fresh;
      } finally { await markBuilding(false); building = null; }
    })();
  }
  try {
    const fresh = await building;
    return { status: 200, json: { ready: true, date: fresh.date, built: true } };
  } catch (e) {
    // 새로 준비하지 못하면 가지고 있던 소식으로 계속한다
    console.error("소식 준비 실패:", e.message);
    return { status: 200, json: { ready: true, date: pool.date, built: false, stale: true } };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST만 받는다" });
  const out = await handle();
  res.status(out.status).json(out.json);
}
