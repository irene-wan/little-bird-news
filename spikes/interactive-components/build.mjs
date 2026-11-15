// S5a Spike — page.html과 lib/*.js를 파일 하나로 합친다.
//   dist/artifact.html   게시용 (문서 뼈대 없이 내용만)
//   dist/index.html      로컬 확인용 (뼈대 포함, 그대로 브라우저에서 열 수 있음)
// 실행: node spikes/interactive-components/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, "page.html"), "utf8");
const inlined = page.replace(/<script src="(lib\/[^"]+)"><\/script>/g, (_, src) => {
  const code = readFileSync(join(here, src), "utf8");
  if (code.includes("</script")) throw new Error(src + " 안에 </script 문자열이 있다");
  return "<script>\n" + code + "</script>";
});
const skeleton =
  '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  "<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n";

mkdirSync(join(here, "dist"), { recursive: true });
writeFileSync(join(here, "dist", "artifact.html"), inlined);
writeFileSync(join(here, "dist", "index.html"), skeleton + inlined + "\n</body>\n</html>\n");
console.log("dist/artifact.html, dist/index.html 생성 (" + Math.round(inlined.length / 1024) + "KB)");
