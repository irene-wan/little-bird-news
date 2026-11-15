// S5a Spike — dist/ 폴더를 보여 주는 아주 작은 로컬 서버.
// 실행: node spikes/interactive-components/serve.mjs          (이 컴퓨터에서만 열림)
//       node spikes/interactive-components/serve.mjs --lan    (같은 와이파이의 폰에서도 열림)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "dist");
const host = process.argv.includes("--lan") ? "0.0.0.0" : "127.0.0.1";
const port = Number(process.env.PORT) || 4173;

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  const file = join(root, path === "/" || path === "\\" ? "index.html" : path);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": file.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("없는 파일");
  }
}).listen(port, host, () => console.log(`http://${host === "0.0.0.0" ? "<이 컴퓨터의 IP>" : "localhost"}:${port}`));
