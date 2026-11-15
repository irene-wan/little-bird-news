// 로컬에서 돌릴 때만: 저장소 루트의 .env(깃에 없음)를 읽어 process.env에 채운다. 배포 환경에서는 호스팅의 환경 변수를 쓴다.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
export const DEMO = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const p of [join(DEMO, ".env"), join(DEMO, "..", ".env")]) {
  if (!existsSync(p)) continue;
  for (const l of readFileSync(p, "utf8").split("\n")) {
    if (!l.includes("=") || l.startsWith("#")) continue;
    const k = l.slice(0, l.indexOf("=")).trim(), v = l.slice(l.indexOf("=") + 1).trim();
    if (k && v && !process.env[k]) process.env[k] = v;
  }
}
