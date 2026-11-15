// 핵심 가치 프로토타입 Spike — 오늘의 소식을 폰에서 읽는 화면 한 장으로 만든다.
// 실행: node spikes/core-prototype/render.mjs <실행ID>   (또는 --mock: 가짜 사례로 화면만 확인)
// 결과: spikes/core-prototype/dist/today.html (게시용), dist/index.html (로컬 확인용)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, readJson } from "./lib/common.mjs";

const arg = process.argv[2];
const s5a = join(ROOT, "spikes", "interactive-components");
let edition;
if (arg === "--mock") {
  await import("../interactive-components/lib/cases.js");
  const cs = globalThis.S5A_CASES;
  const mk = (c, i) => ({
    cid: c.id, kind: i === 2 ? "important" : "personal", topic: c.topic, asOf: c.source.asOf, inferred: i === 1,
    story: {
      title: c.headline, lede: { text: c.paragraphs[0] },
      why: { text: i === 2 ? "직접 관련은 적지만 알아 둘 만한 소식이라 골랐어요." : "프로필에 적어 주신 내용과 이어지는 소식이라 가져왔어요. (화면 확인용 가짜 문장)" },
      blocks: [
        { kind: "fact", heading: "무슨 일이 있었나", sentences: (c.paragraphs[1] ? [c.paragraphs[1]] : [c.after]).map((text) => ({ text })) },
        { kind: "concept", heading: "", sentences: [{ text: "이 자리에는 낯선 용어를 쉬운 말로 푸는 문단이 들어간다." }] },
        { kind: "meaning", heading: "나에게는 무슨 뜻일까", sentences: [{ text: c.after }] },
      ],
      terms: [{ term: "가짜 용어", explain: "화면 확인용으로 넣은 풀이다." }], uncertainty: i === 0 ? "아직 최종 확정된 내용은 아니다." : "", widget_after: 0,
    },
    widgetMode: i === 1 ? "visual" : "interactive", widget: i === 1 ? { id: c.id, type: "fallback", facts: c.facts, source: c.source } : c,
    sources: [{ source: "가짜 매체", title: c.headline, url: "https://example.com", dateTime: "2026-11-10T09:00:00Z" }],
  });
  edition = { runId: "mock", date: "2026-11-10", planned: 3, stories: [cs[0], cs[2], cs[4]].map(mk), mock: true };
} else {
  edition = readJson(join(ROOT, "private", "runs", arg, "11-edition.json"));
}

const base = readFileSync(join(s5a, "page.html"), "utf8");
const css = base.match(/<style>([\s\S]*?)<\/style>/)[1];
const fontLink = base.match(/<link rel="stylesheet"[^>]+>/)[0];
const libs = ["validate.js", "components.js"].map((f) => readFileSync(join(s5a, "lib", f), "utf8")).join("\n");

const readerCss = `
.reader { gap: 28px; }
.rd-top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 0.8rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.rd-top strong { color: var(--ink); font-size: 0.95rem; }
.rd-story { display: flex; flex-direction: column; gap: 20px; }
.rd-topic { font-size: 0.8rem; font-weight: 700; color: var(--accent); letter-spacing: 0.04em; }
.rd-why { background: var(--accent-soft); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
.rd-why-label { font-size: 0.75rem; font-weight: 700; color: var(--accent); }
.rd-why p { font-size: 0.95rem; line-height: 1.6; }
.rd-why small { font-size: 0.75rem; color: var(--muted); }
.rd-lede { font-size: 1.1rem; line-height: 1.7; font-weight: 500; }
.rd-block { display: flex; flex-direction: column; gap: 6px; }
.rd-block h3 { font-family: var(--font-display); font-size: 1.15rem; line-height: 1.4; }
.rd-kind { align-self: flex-start; font-size: 0.72rem; font-weight: 700; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 1px 9px; }
.rd-aside { border-left: 3px solid var(--line); padding-left: 14px; }
.rd-note { font-size: 0.8rem; color: var(--muted); line-height: 1.55; }
.rd-terms { display: flex; flex-direction: column; gap: 8px; margin: 0; font-size: 0.9rem; }
.rd-terms dt { font-weight: 700; }
.rd-terms dd { margin: 0; color: var(--muted); line-height: 1.6; }
.rd-sources { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 0.8rem; color: var(--muted); }
.rd-sources a { color: var(--accent); overflow-wrap: anywhere; }
.rd-next { min-height: 52px; border-radius: 12px; border: 0; background: var(--accent); color: var(--on-accent); font-weight: 700; font-size: 1rem; cursor: pointer; }
.rd-ghost { min-height: 44px; border-radius: 12px; border: 1px solid var(--line); background: transparent; cursor: pointer; }
.rd-end { display: flex; flex-direction: column; gap: 16px; padding-block: 48px; text-align: center; align-items: center; }
.rd-end p { color: var(--muted); }
`;

const body = `<title>오늘의 소식</title>
<meta name="claude:viewport-fit-sides" content="cover">
${fontLink}
<style>${css}${readerCss}</style>
<main class="page reader">
  <header class="rd-top"><span id="rd-date"></span><strong id="rd-progress"></strong></header>
  <div id="rd-view"></div>
</main>
<script>
${libs}
</script>
<script>
(function () {
  const ED = ${JSON.stringify(edition).replace(/</g, "\\u003c")};
  const S = globalThis.S5A;
  const view = document.getElementById("rd-view");
  const KIND = { background: "배경 설명", concept: "용어 풀이", meaning: "해석" };
  const key = "rd-pos-" + ED.runId;
  let at = 0;
  try { at = Math.min(ED.stories.length, Math.max(0, Number(localStorage.getItem(key)) || 0)); } catch (e) {}
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  document.getElementById("rd-date").textContent = (ED.mock ? "화면 확인용 가짜 내용 · " : "") + ED.date + " 오늘의 소식";

  function go(i) { at = i; try { localStorage.setItem(key, String(i)); } catch (e) {} draw(); window.scrollTo(0, 0); }

  function draw() {
    view.replaceChildren();
    const n = ED.stories.length;
    const prog = document.getElementById("rd-progress");
    if (n === 0) {
      prog.textContent = "";
      const end = el("section", "rd-end");
      end.append(el("h1", "", "오늘은 전할 소식이 없어요"), el("p", "", "기준에 맞는 소식을 찾지 못했어요. 억지로 채우지 않았어요. 편히 쉬세요."));
      view.append(end);
      return;
    }
    if (at >= n) {
      prog.textContent = "다 읽었어요";
      const end = el("section", "rd-end");
      const again = el("button", "rd-ghost", "오늘 소식 다시 보기");
      again.type = "button"; again.style.padding = "8px 20px"; again.addEventListener("click", () => go(0));
      end.append(el("h1", "", "오늘의 소식은 여기까지예요"), el("p", "", "더 볼 것은 없어요. 편히 쉬세요."), again);
      view.append(end);
      return;
    }
    prog.textContent = at + 1 + " / " + n;
    const item = ED.stories[at], s = item.story;
    const art = el("article", "rd-story");
    art.append(el("p", "rd-topic", item.topic + (item.kind === "important" ? " · 알아 둘 소식" : item.kind === "discovery" ? " · 새로운 분야" : "")));
    art.append(el("h1", "", s.title));
    const why = el("div", "rd-why");
    why.append(el("span", "rd-why-label", "이 소식을 가져온 이유"), el("p", "", s.why.text));
    if (item.inferred) why.append(el("small", "", "짐작이 섞인 연결이에요. 맞지 않으면 알려 주세요."));
    art.append(why);
    art.append(el("p", "rd-lede", s.lede.text));
    const box = el("div");
    let placed = false;
    (s.blocks || []).forEach((b, i) => {
      const sec = el("section", "rd-block" + (b.kind === "fact" ? "" : " rd-aside"));
      if (KIND[b.kind]) sec.append(el("span", "rd-kind", KIND[b.kind]));
      if (b.heading) sec.append(el("h3", "", b.heading));
      sec.append(el("p", "", b.sentences.map((x) => x.text).join(" ")));
      art.append(sec);
      if (i === Math.min(s.widget_after || 0, s.blocks.length - 1)) { art.append(box); placed = true; }
    });
    if (!placed) art.append(box);
    if (s.uncertainty) art.append(el("p", "rd-note", "아직 확실하지 않은 점: " + s.uncertainty));
    if ((s.terms || []).length) {
      const dl = el("dl", "rd-terms");
      for (const t of s.terms) dl.append(el("dt", "", t.term), el("dd", "", t.explain));
      art.append(dl);
    }
    art.append(el("p", "rd-note", "'배경 설명'과 '용어 풀이'는 AI가 알고 있는 지식으로 쓴 부분이에요. 그 밖의 사실은 아래 기사에서 확인한 내용이에요. 기준 시점 " + item.asOf));
    const ul = el("ul", "rd-sources");
    for (const src of item.sources || []) {
      const li = el("li");
      const a = el("a", "", src.title); a.href = src.url; a.target = "_blank"; a.rel = "noopener";
      li.append(document.createTextNode(src.source + " · " + String(src.dateTime).slice(0, 10) + " · "), a);
      ul.append(li);
    }
    art.append(ul);
    const next = el("button", "rd-next", at + 1 < n ? "다음 소식" : "마무리");
    next.type = "button"; next.addEventListener("click", () => go(at + 1));
    art.append(next);
    view.append(art);
    // 조작형 설명은 검증을 다시 거쳐 그린다. 대체 시각 요소는 사실 목록으로 그린다.
    if (item.widgetMode === "interactive") S.mount(box, item.widget);
    else { try { box.append(S.renderFallback(item.widget)); box.dataset.mode = "fallback"; } catch (e) { box.dataset.mode = "none"; } }
  }
  draw();
})();
</script>`;

const dist = join(ROOT, "spikes", "core-prototype", "dist");
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, "today.html"), body);
writeFileSync(join(dist, "index.html"), '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n' + body + "\n</body>\n</html>\n");
console.log(`dist/today.html 생성 (소식 ${edition.stories.length}편, ${Math.round(body.length / 1024)}KB)`);
