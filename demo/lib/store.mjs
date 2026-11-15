// 준비된 소식을 보관한다. 서버리스에는 디스크가 없어서 Vercel Blob에 두고, 못 쓰는 곳(로컬)에서는 메모리에만 둔다.
// 배포본에 함께 들어 있는 data/pool.mjs는 아무것도 받지 못했을 때의 예비용이다.
import { put, list } from "@vercel/blob";
import bundled from "../data/pool.mjs";

const FRESH_MS = 12 * 3600e3;      // 이보다 오래된 소식은 새로 준비한다
const BUILDING_MS = 240e3;         // 준비 중 표시는 이 시간 동안만 믿는다
let cached = bundled, checkedAt = 0;
export const isFresh = (p) => Date.now() - Date.parse(p.builtAt) < FRESH_MS;

async function readBlob(name) {
  const { blobs } = await list({ prefix: name });
  const b = blobs.find((x) => x.pathname === name);
  if (!b) return null;
  const res = await fetch(b.url + "?t=" + Date.now(), { cache: "no-store" });
  return res.ok ? res.json() : null;
}
const writeBlob = (name, data) => put(name, JSON.stringify(data), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60 });

export async function currentPool() {
  if (isFresh(cached) || Date.now() - checkedAt < 4000) return cached;
  try { const j = await readBlob("pool.json"); if (j && Array.isArray(j.stories) && j.builtAt > cached.builtAt) cached = j; } catch (e) { /* 가진 것을 쓴다 */ }
  checkedAt = Date.now();
  return cached;
}
export async function savePool(p) { cached = p; try { await writeBlob("pool.json", p); } catch (e) { console.error("소식 보관 실패:", e.message); } }
export async function isBuilding() { try { const m = await readBlob("building.json"); return !!m && Date.now() - m.at < BUILDING_MS; } catch (e) { return false; } }
export async function markBuilding(on) { try { await writeBlob("building.json", { at: on ? Date.now() : 0 }); } catch (e) { /* 표시 없이 진행 */ } }
