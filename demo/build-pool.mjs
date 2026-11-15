// 명령줄에서 오늘의 소식을 준비해 data/ 에 써 둔다 (배포본에 함께 들어가는 예비용).
// 실행: node demo/build-pool.mjs
// 배포된 데모는 독자가 버튼을 누를 때 소식이 오래됐으면 스스로 새로 준비한다 (api/prepare.js).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEMO } from "./lib/env.mjs";
import { buildPool } from "./lib/build.mjs";
const poolData = await buildPool({ geminiKey: process.env.GEMINI_API_KEY, newsKey: process.env.NEWSAPI_AI_KEY, log: console.log });
writeFileSync(join(DEMO, "data", "pool.mjs"), "// build-pool.mjs가 만든 파일. 손으로 고치지 않는다.\nexport default " + JSON.stringify(poolData) + ";\n");
