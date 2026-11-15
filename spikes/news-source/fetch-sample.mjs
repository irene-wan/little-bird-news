// S1 Spike — newsapi.ai(Event Registry) 시험 호출.
// 한국어 기사가 충분히 오는지, 본문 전체·매체·발행 시각·원문 주소가 오는지 확인한다.
// 받은 원본은 Git에 올라가지 않는 private/news-samples/ 에 저장한다.
// 실행: node spikes/news-source/fetch-sample.mjs [articles|events|usage]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env"), "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const apiKey = env.NEWSAPI_AI_KEY;
if (!apiKey) { console.error(".env에 NEWSAPI_AI_KEY가 없다"); process.exit(1); }

const outDir = join(root, "private", "news-samples");
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const KOREA = "http://en.wikipedia.org/wiki/South_Korea";

async function call(path, body) {
  const t0 = Date.now();
  const res = await fetch("https://eventregistry.org/api/v1/" + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, apiKey }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { parseError: text.slice(0, 500) }; }
  return { status: res.status, ms: Date.now() - t0, json };
}

const mode = process.argv[2] || "usage";

if (mode === "usage") {
  const r = await call("usage", {});
  console.log(r.status, JSON.stringify(r.json));
}

if (mode === "articles") {
  const page = Number(process.argv[3]) || 1;
  const r = await call("article/getArticles", {
    action: "getArticles",
    lang: "kor",
    sourceLocationUri: KOREA,
    dataType: ["news"],
    isDuplicateFilter: "skipDuplicates",
    articlesSortBy: "date",
    articlesCount: 100,
    articlesPage: page,
    articleBodyLen: -1,
    resultType: "articles",
    includeArticleEventUri: true,
    includeArticleCategories: true,
    includeSourceRanking: true,
  });
  writeFileSync(join(outDir, `articles-p${page}-${stamp}.json`), JSON.stringify(r.json));
  const a = r.json.articles;
  if (!a) { console.log(r.status, JSON.stringify(r.json).slice(0, 800)); process.exit(1); }
  const rows = a.results;
  const bySource = {};
  for (const x of rows) bySource[x.source?.title || "?"] = (bySource[x.source?.title || "?"] || 0) + 1;
  const lens = rows.map((x) => (x.body || "").length).sort((p, q) => p - q);
  console.log(JSON.stringify({
    status: r.status, ms: r.ms, totalResults: a.totalResults, pages: a.pages, returned: rows.length,
    newest: rows[0]?.dateTime, oldest: rows.at(-1)?.dateTime,
    bodyLen: { min: lens[0], median: lens[Math.floor(lens.length / 2)], max: lens.at(-1), empty: lens.filter((n) => n === 0).length, under300: lens.filter((n) => n < 300).length },
    withEventUri: rows.filter((x) => x.eventUri).length,
    fields: Object.keys(rows[0] || {}),
    sources: Object.entries(bySource).sort((p, q) => q[1] - p[1]),
    sample: rows.slice(0, 3).map((x) => ({ title: x.title, source: x.source?.title, dateTime: x.dateTime, url: x.url, eventUri: x.eventUri, bodyStart: (x.body || "").slice(0, 120), bodyEnd: (x.body || "").slice(-80) })),
  }, null, 1));
}

if (mode === "events") {
  const r = await call("event/getEvents", {
    action: "getEvents",
    lang: "kor",
    sourceLocationUri: KOREA,
    resultType: "events",
    eventsSortBy: "date",
    eventsCount: 50,
    includeEventSummary: true,
    includeEventArticleCounts: true,
  });
  writeFileSync(join(outDir, `events-${stamp}.json`), JSON.stringify(r.json));
  const e = r.json.events;
  if (!e) { console.log(r.status, JSON.stringify(r.json).slice(0, 800)); process.exit(1); }
  console.log(JSON.stringify({
    status: r.status, ms: r.ms, totalResults: e.totalResults, returned: e.results.length,
    fields: Object.keys(e.results[0] || {}),
    sample: e.results.slice(0, 12).map((x) => ({ uri: x.uri, date: x.eventDate, title: x.title?.kor || x.title, total: x.totalArticleCount, kor: x.articleCounts?.kor })),
  }, null, 1));
}
