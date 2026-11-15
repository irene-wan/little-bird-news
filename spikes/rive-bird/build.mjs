// S6 Spike — page.html에 새 그림 파일(.riv)을 넣어 파일 하나로 만든다. 제품 코드가 아니다.
//   dist/artifact.html   게시용 (문서 뼈대 없이 내용만)
//   dist/index.html      로컬 확인용 (뼈대 포함)
//   dist/rive.wasm       움직임 도구의 본체. 페이지와 같은 곳에 둔다
// 실행: node spikes/rive-bird/build.mjs
// vendor/rive.wasm 이 없으면 먼저 받는다:
//   curl -o spikes/rive-bird/vendor/rive.wasm https://unpkg.com/@rive-app/canvas-lite@2.47.1/rive.wasm
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const riv = readFileSync(join(here, "assets", "bird-jctoon.riv"));
const page = readFileSync(join(here, "page.html"), "utf8").replace("/*RIV_B64*/", riv.toString("base64"));
const skeleton =
  '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  "<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n";

mkdirSync(join(here, "dist"), { recursive: true });
writeFileSync(join(here, "dist", "artifact.html"), page);
writeFileSync(join(here, "dist", "index.html"), skeleton + page + "\n</body>\n</html>\n");
copyFileSync(join(here, "vendor", "rive.wasm"), join(here, "dist", "rive.wasm"));
console.log(`dist/artifact.html, dist/index.html 생성 (${Math.round(page.length / 1024)}KB, 새 그림 ${riv.length}바이트)`);
