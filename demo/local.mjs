// 로컬에서 데모를 띄운다: node demo/local.mjs  (같은 와이파이의 폰에서 보려면 --lan)
// 배포(Vercel)에서는 public/ 과 api/ 를 그대로 쓰고 이 파일은 쓰지 않는다.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { DEMO } from "./lib/env.mjs";
const { handle } = await import("./api/edition.js");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".wasm": "application/wasm", ".riv": "application/octet-stream", ".svg": "image/svg+xml" };
const port = Number(process.env.PORT || 4175), host = process.argv.includes("--lan") ? "0.0.0.0" : "127.0.0.1";
createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api/edition") {
    if (req.method !== "POST") { res.writeHead(405).end(); return; }
    let raw = ""; for await (const chunk of req) { raw += chunk; if (raw.length > 8000) break; }
    let body = {}; try { body = JSON.parse(raw || "{}"); } catch (e) {}
    const out = await handle(body, req.socket.remoteAddress || "");
    res.writeHead(out.status, { "content-type": TYPES[".json"], "cache-control": "no-store" }).end(JSON.stringify(out.json));
    return;
  }
  const rel = normalize(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^(\.\.[/\\])+/, "");
  try {
    const data = await readFile(join(DEMO, "public", rel));
    res.writeHead(200, { "content-type": TYPES[extname(rel)] || "application/octet-stream", "cache-control": "no-store" }).end(data);
  } catch (e) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("없는 주소"); }
}).listen(port, host, () => console.log(`http://${host === "0.0.0.0" ? "<이 컴퓨터의 IP>" : "localhost"}:${port}`));
