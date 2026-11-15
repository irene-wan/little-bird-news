// 읽기 화면. 틀과 디자인은 목표 시안을 따르고, 내용은 서버가 준 오늘의 소식으로 채운다.
(function () {
  "use strict";
  var CFG = {
    runtime: "vendor/rive.js", wasm: "vendor/rive.wasm", asset: "bird.riv", stateMachine: "State Machine 1", input: "Pressed",
    // 그림 파일의 대지(500×500)에서 새는 아래쪽 4분의 1만 차지한다. 자리 크기별로 보여 줄 중심과 배율.
    crop: { lg: { cx: 0.46, cy: 0.5, zoom: 1.5 }, md: { cx: 0.46, cy: 0.5, zoom: 1.5 }, sm: { cx: 0.47, cy: 0.62, zoom: 2.2 } }, timeoutMs: 9000
  };
  var FALLBACK_SVG = '<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="52" cy="58" rx="30" ry="26" fill="currentColor"/><circle cx="36" cy="40" r="17" fill="currentColor"/><path d="M19 40 6 45l14 4z" fill="currentColor"/><path d="M78 52c12-6 16-16 15-24-9 3-17 9-21 17z" fill="currentColor"/><circle cx="32" cy="37" r="3.2" fill="#fff"/></svg>';
  var $ = function (id) { return document.getElementById(id); };
  var icon = window.WIDGETS.icon;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var store = { get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

  // 주제마다 색, 아이콘, 영문 라벨을 정해 둔다 (AI가 고르지 않는다)
  var TOPIC = {
    "AI·기술": { tone: "ai", icon: "sparkles", kicker: "TECH", stack: ["brain", "sparkles", "layers"] },
    "일·채용": { tone: "work", icon: "briefcase-business", kicker: "CAREER", stack: ["users", "briefcase-business", "check"] },
    "돈·경제": { tone: "money", icon: "chart-no-axes-column", kicker: "MONEY", stack: ["banknote", "chart-no-axes-column", "activity"] },
    "주거": { tone: "home", icon: "home", kicker: "HOME", stack: ["home", "calendar", "shield-check"] },
    "건강": { tone: "health", icon: "heart-pulse", kicker: "HEALTH", stack: ["heart-pulse", "activity", "layers"] },
    "사회·제도": { tone: "world", icon: "users", kicker: "SOCIETY", stack: ["users", "shield-check", "info"] },
    "국제": { tone: "world", icon: "globe", kicker: "WORLD", stack: ["globe", "activity", "layers"] },
    "과학·환경": { tone: "health", icon: "flask-conical", kicker: "SCIENCE", stack: ["flask-conical", "microscope", "sparkles"] },
    "문화·여가": { tone: "home", icon: "ticket", kicker: "CULTURE", stack: ["ticket", "users", "calendar"] },
    "교육": { tone: "ai", icon: "graduation", kicker: "EDUCATION", stack: ["graduation", "book-open", "users"] }
  };
  function T(s) { return TOPIC[s.topic] || TOPIC["사회·제도"]; }
  function toneStyle(s) { var t = T(s).tone; return "--tone:var(--" + t + ");--tone-soft:var(--" + t + "-soft);--theme-color:var(--" + t + ");--hero-accent:var(--" + t + ");--hero-soft:var(--" + t + "-soft)"; }
  function badge(s) { return '<span class="category">' + icon(T(s).icon, "icon-sm") + esc(s.topic.replace("·", " · ")) + "</span>"; }

  // ── 새: 읽는 동안에는 스스로 움직이지 않는다. 불러오지 못하면 멈춘 그림으로 바꾸고 읽기는 그대로 둔다 ──
  var Bird = (function () {
    var b = document.createElement("button"); b.className = "bird-btn"; b.type = "button"; b.setAttribute("aria-label", "새. 누르면 반응해요");
    var canvas = document.createElement("canvas"), r = null, input = null, state = "none", quiet = false, settleTimer = 0, slot = null;
    function reduced() { return window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches; }
    function fit() {
      if (!r || !slot) return;
      var size = slot.clientWidth || 44, dpr = Math.min(window.devicePixelRatio || 1, 3), crop = CFG.crop[slot.dataset.size] || CFG.crop.lg, css = size * crop.zoom;
      canvas.style.width = canvas.style.height = css + "px";
      canvas.style.left = (size / 2 - crop.cx * css) + "px"; canvas.style.top = (size / 2 - crop.cy * css) + "px";
      canvas.width = canvas.height = Math.min(1000, Math.round(css * dpr));
      try { r.resizeDrawingSurfaceToCanvas(canvas.width / css); if (typeof r.drawFrame === "function") r.drawFrame(); } catch (e) {}
    }
    function place(target) { if (!target) return; slot = target; if (b.parentNode !== target) target.append(b); fit(); }
    function fail() { if (r) { try { r.cleanup(); } catch (e) {} r = null; input = null; } b.innerHTML = FALLBACK_SVG; state = "failed"; }
    function loadScript() { return new Promise(function (ok, bad) { if (window.rive) return ok(); var s = document.createElement("script"); s.src = CFG.runtime; s.async = true; s.onload = ok; s.onerror = function () { bad(new Error("움직임 도구를 불러오지 못함")); }; document.head.append(s); }); }
    function init() {
      state = "loading";
      return Promise.all([loadScript(), fetch(CFG.asset).then(function (x) { if (!x.ok) throw new Error("새 그림을 불러오지 못함"); return x.arrayBuffer(); })]).then(function (got) {
        try { window.rive.RuntimeLoader.setWasmUrl(CFG.wasm); } catch (e) {}
        b.append(canvas);
        return new Promise(function (done) {
          var finished = false, timer = setTimeout(function () { if (!finished) { finished = true; fail(); done(); } }, CFG.timeoutMs);
          try {
            r = new window.rive.Rive({ buffer: got[1], canvas: canvas, stateMachine: CFG.stateMachine, autoplay: !reduced(),
              onLoad: function () { if (finished) return; finished = true; clearTimeout(timer);
                try { input = (r.stateMachineInputs(CFG.stateMachine) || []).filter(function (i) { return i.name === CFG.input; })[0] || null; } catch (e) { input = null; }
                state = "ready"; fit(); done(); },
              onLoadError: function () { if (finished) return; finished = true; clearTimeout(timer); fail(); done(); },
              onStateChange: function (e) { if (quiet && ((e && e.data) || []).join(" ").indexOf("Idle") >= 0) settle(600); } });
          } catch (e) { if (!finished) { finished = true; clearTimeout(timer); fail(); done(); } }
        });
      }).catch(fail);
    }
    function settle(ms) { clearTimeout(settleTimer); settleTimer = setTimeout(function () { if (quiet && r) { try { r.pause(); } catch (e) {} } }, ms); }
    function react() { if (state !== "ready" || !r || reduced()) return false; try { r.play(); if (input) input.fire(); } catch (e) { return false; } if (quiet) settle(2600); return true; }
    function setQuiet(q) { quiet = q; clearTimeout(settleTimer); if (!r || state !== "ready" || reduced()) return; try { if (q) settle(2600); else r.play(); } catch (e) {} }
    function flourish(cls) { if (reduced()) return; b.classList.remove("fly-in", "hand-over"); void b.offsetWidth; b.classList.add(cls); }
    b.addEventListener("pointerdown", function () { react(); });
    b.addEventListener("click", function (e) { if (e.detail === 0) react(); });
    window.addEventListener("resize", fit);
    return { init: init, place: place, react: react, setQuiet: setQuiet, flourish: flourish };
  })();

  // ── 상태와 공통 ───────────────────────────────────────
  var app = $("app"), edition = null, read = {}, at = "intro", dockWatch = null, onBird = function () {}, waitTimer = 0, slowTimer = 0;
  var theme = store.get("theme") || (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  function setTheme() { document.documentElement.dataset.theme = theme; $("themeToggle").innerHTML = icon(theme === "light" ? "moon" : "sun"); $("themeToggle").setAttribute("aria-label", theme === "light" ? "어두운 화면으로" : "밝은 화면으로"); }
  function dateLabel(d) { var x = new Date(d + "T00:00:00+09:00"); return isNaN(x) ? d : x.getFullYear() + ". " + (x.getMonth() + 1) + ". " + x.getDate() + " " + ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][x.getDay()]; }
  function show(html, where) {
    if (dockWatch) { dockWatch.disconnect(); dockWatch = null; }
    clearInterval(waitTimer); clearTimeout(slowTimer);
    at = where; app.innerHTML = html;
    $("profileBtn").hidden = where === "intro" || where === "wait";
    $("allNews").hidden = typeof where !== "number" && where !== "closing";
    $("datePill").textContent = edition && where !== "intro" && where !== "wait" ? dateLabel(edition.date) + " · YOUR DAILY SIGNAL" : "YOUR DAILY SIGNAL";
    window.scrollTo({ top: 0, behavior: "instant" }); progress();
  }
  function progress() {
    var bar = $("progress"); if (typeof at !== "number") { bar.style.width = "0%"; return; }
    var max = document.documentElement.scrollHeight - window.innerHeight; bar.style.width = (max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0) + "%";
  }
  function hero(label, h1, p, extra) {
    return '<section class="hero"><div><div class="today-label"><i></i><span>' + label + '</span></div><h1 class="serif">' + h1 + "</h1><p>" + p + '</p></div><div class="hero-collage with-bird"><div class="collage-circle"></div><div class="slot" data-size="lg" id="slot-main"></div>' + (extra || "") + "</div></section>";
  }
  function birdMain(flyIn) { onBird = function () { Bird.setQuiet(false); Bird.place($("slot-main")); if (flyIn) { Bird.flourish("fly-in"); var here = at; setTimeout(function () { if (at === here) Bird.react(); }, 820); } else Bird.react(); }; onBird(); }

  // ── 프로필 ───────────────────────────────────────────
  var SAMPLES = [
    { label: "직장인", job: "IT 기업 인사팀에서 신입·경력 채용을 맡은 8년 차예요. 여섯 살 아이를 키우고 있어요", interests: "채용 시장, 청년 고용, AI 역량 평가, 육아, 내 집 마련", weak: "반도체, AI 기술 용어", avoid: "연예인 소식" },
    { label: "교육인", job: "기업 교육팀에서 AI 인재 양성 과정을 기획하고 운영하는 11년 차예요", interests: "AI 교육, 생성형 AI 활용, 대학 교육, 러닝, 연금과 노후 준비", weak: "금리, 환율 같은 경제 흐름", avoid: "정치 공방" },
    { label: "취업 준비생", job: "대학교 4학년이고 마케팅 직무로 취업을 준비하고 있어요", interests: "채용, 자취, 생활비 아끼기", weak: "금리, 환율 같은 경제 용어", avoid: "연예인 소식" },
    { label: "개발자", job: "스타트업에서 일하는 3년 차 백엔드 개발자예요", interests: "AI, 반도체, 주식 투자, 전세", weak: "부동산 제도", avoid: "정치 공방" }
  ];
  var FIELDS = [["job", "지금 하는 일이나 상황", "한 줄이면 돼요", "user"], ["interests", "요즘 관심 있는 것", "쉼표로 여러 개", "sparkles"], ["weak", "잘 몰라서 어려운 분야", "없으면 비워 두세요", "book-open"], ["avoid", "받고 싶지 않은 주제", "없으면 비워 두세요", "shield-check"]];
  function intro(error) {
    var saved = store.get("profile") || {};
    show('<div class="shell">' + hero("YOUR DAILY SIGNAL", "나를 아는 작은 새가,<br><em>소식을 물어 와요.</em>", "당신을 조금만 알려 주세요. 오늘의 뉴스에서 당신에게 맞는 세 편을 골라, 한눈에 잡히고 직접 눌러 보며 이해되는 소식으로 가져옵니다.") +
      '<form class="workbench profile" id="profileForm"><div class="samples"><span>예시로 채우기</span>' + SAMPLES.map(function (s, i) { return '<button type="button" class="skill" data-sample="' + i + '">' + esc(s.label) + "</button>"; }).join("") + '</div><div class="fields">' +
      FIELDS.map(function (f) { return '<div class="field"><label for="f-' + f[0] + '">' + icon(f[3], "icon-sm") + esc(f[1]) + " <small>" + esc(f[2]) + '</small></label><textarea id="f-' + f[0] + '" maxlength="300" rows="2">' + esc(saved[f[0]] || "") + "</textarea></div>"; }).join("") + "</div>" +
      (error ? '<p class="form-error" role="alert">' + esc(error) + "</p>" : "") +
      '<button type="submit" class="solidbtn big">오늘의 소식 받기 ' + icon("arrow-right", "icon-sm") + '</button><p class="form-note">적은 내용은 AI가 소식을 고르는 데만 쓰고 저장하지 않아요.' + (store.get("edition") ? ' <button type="button" class="navbtn" id="again" style="padding:4px 8px">아까 받은 소식 다시 보기</button>' : "") + "</p></form></div>", "intro");
    birdMain(true);
  }
  function request(profile) {
    var NORMAL = ["프로필 읽는 중", "오늘의 소식 살펴보는 중", "세 편 고르는 중", "가져온 이유 적는 중"], FRESH = ["오늘 뉴스 모으는 중", "기사에서 사실 확인하는 중", "쉽게 풀어 쓰는 중", "직접 눌러 보는 설명 만드는 중", "마지막 점검 중"];
    show('<div class="shell"><section class="bird-stage"><div class="slot" data-size="lg" id="slot-main"></div><div class="today-label"><i></i><span>PREPARING YOUR SIGNAL</span></div><h1 class="serif" id="waitTitle">소식을 물어 오는 중이에요</h1><p id="waitSub">잠깐이면 돼요. 새를 눌러 보세요.</p><ol class="waitlist" id="waitList"></ol></section></div>', "wait");
    birdMain(false);
    var n = 0, names = NORMAL;
    function mark() { $("waitList").innerHTML = names.map(function (x, i) { return '<li data-done="' + (i < n ? 1 : 0) + '" data-on="' + (i === n ? 1 : 0) + '"><span class="dot">' + icon("check") + "</span>" + esc(x) + "</li>"; }).join(""); }
    function steps(list, every) { names = list; n = 0; mark(); clearInterval(waitTimer); waitTimer = setInterval(function () { if (n < names.length - 1) { n++; mark(); } }, every); }
    steps(NORMAL, 2500);
    // 오늘 소식이 아직 준비되지 않았으면 서버가 지금 최신 뉴스로 준비한다. 금방 답이 오지 않으면 그 사실을 알린다
    slowTimer = setTimeout(function () { if (at !== "wait") return; $("waitTitle").textContent = "오늘 첫 손님이에요"; $("waitSub").textContent = "방금 나온 뉴스로 소식을 새로 준비하고 있어요. 1~2분쯤 걸려요."; steps(FRESH, 20000); }, 3000);
    fetch("api/prepare", { method: "POST" }).catch(function () {}).then(function () {
      clearTimeout(slowTimer); if (at !== "wait") throw new Error("취소");
      $("waitTitle").textContent = "소식을 물어 오는 중이에요"; $("waitSub").textContent = "잠깐이면 돼요. 새를 눌러 보세요."; steps(NORMAL, 2500);
      return fetch("api/edition", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(profile) });
    }).then(function (res) { return res.json().then(function (j) { if (!res.ok) throw new Error(j.error || "문제가 생겼어요."); return j; }); })
      .then(function (j) { if (at !== "wait") return; edition = j; read = {}; store.set("edition", j); overview(); })
      .catch(function (e) { if (at === "wait") intro(/Failed|NetworkError|JSON|fetch/.test(e.message) ? "서버에 닿지 못했어요. 잠시 뒤에 다시 해 주세요." : e.message); });
  }

  // ── 오늘의 소식 ────────────────────────────────────────
  function miniViz(i) {
    if (i % 3 === 0) return '<div class="card-viz" aria-hidden="true"><span class="tiny-bar" style="height:16px"></span><span class="tiny-bar" style="height:30px"></span><span class="tiny-bar" style="height:47px"></span><span class="tiny-bar" style="height:56px"></span></div>';
    if (i % 3 === 1) return '<div class="card-viz viz-dots" aria-hidden="true">' + Array.from({ length: 13 }, function (_, j) { return '<span style="background:var(--theme-color);opacity:' + (j < 3 ? 1 : 0.16) + '"></span>'; }).join("") + "</div>";
    return '<div class="card-viz viz-line" aria-hidden="true"><b style="background:var(--theme-color)"></b><i style="background:var(--theme-color)"></i><b style="background:var(--theme-color)"></b><i style="background:var(--theme-color)"></i><b style="border-color:var(--theme-color)"></b></div>';
  }
  function overview() {
    var S = edition.stories, personal = S.filter(function (s) { return s.personal; }).length;
    var cards = S.filter(function (s) { return s.sheet.metric && s.sheet.metric.text.length <= 9; }).slice(0, 2).map(function (s, i) {
      return '<div class="collage-card ' + (i ? "cc-job" : "cc-health") + '" style="' + toneStyle(s) + '"><span class="squareicon tone">' + icon(T(s).icon) + '</span><span class="micro">' + T(s).kicker + "</span><strong>" + esc(s.sheet.metric.text) + "</strong></div>";
    }).join("");
    show('<div class="shell">' + hero("YOUR DAILY SIGNAL · " + dateLabel(edition.date), "오늘은 세 가지를<br><em>물어 왔어요.</em>", personal ? "그중 " + personal + "편은 당신이 적어 준 이야기와 이어져요. 한눈에 요점을 잡고, 직접 눌러 보고, 숫자 뒤의 맥락까지 확인해 보세요." : "오늘은 알아 둘 만한 소식으로 골랐어요. 한눈에 요점을 잡고, 직접 눌러 보세요.", cards) +
      '<section aria-labelledby="h-stories"><div class="section-heading"><h2 id="h-stories">오늘의 세 가지 이야기 <span class="muted">/ 0' + S.length + '</span></h2><p>관심 있는 이야기부터 골라보세요.</p></div><div class="articles-grid">' +
      S.map(function (s, i) {
        return '<button class="story-card" data-open="' + i + '" style="' + toneStyle(s) + '" aria-label="' + esc(s.story.title) + ' 읽기"><div class="card-head">' + badge(s) + '<span class="muted kicker">' + (read[i] ? "읽음" : "0" + (i + 1)) + "</span></div><h3>" + esc(s.story.title) + "</h3><p>" + esc(s.sheet.compact) + "</p>" + miniViz(i) +
          '<div class="card-metric">' + (s.sheet.metric ? '<span class="big" style="color:var(--theme-color);font-size:' + (s.sheet.metric.text.length > 9 ? "22px" : "") + '">' + esc(s.sheet.metric.text) + '</span><span class="text">' + esc(s.sheet.metric.label) + "</span>" : '<span class="text">' + (s.personal ? "나와 이어지는 소식" : "알아 둘 소식") + "</span>") + '</div><span class="card-arrow">' + icon("arrow-right", "icon-sm") + "</span></button>";
      }).join("") + '</div></section><section class="howto" aria-label="읽는 방법"><span>' + icon("book-open") + "핵심 확인</span>" + icon("arrow-right", "arrow icon-sm") + "<span>" + icon("mouse-pointer") + "직접 조작</span>" + icon("arrow-right", "arrow icon-sm") + "<span>" + icon("shield-check") + "출처 점검</span></section></div>", "overview");
    birdMain(true);
  }

  // ── 소식 한 편 ─────────────────────────────────────────
  var KIND = { fact: "보도된 사실", concept: "개념 풀어보기", meaning: "해석과 시사점", background: "배경" };
  function nextUnread(i) { var S = edition.stories; for (var k = 1; k < S.length; k++) { var n = (i + k) % S.length; if (!read[n]) return n; } return null; }
  function article(i) {
    var S = edition.stories, s = S[i], t = T(s), next = nextUnread(i), m = s.sheet.metric;
    var visual = m && /%/.test(m.text) ? '<div class="visual-circle">' + icon(t.icon) + "</div>" : '<div class="visual-icon-stack">' + t.stack.map(function (n) { return "<span>" + icon(n) + "</span>"; }).join("") + "</div>";
    var hint = { comparison: "카드를 눌러 견줘 보기", process: "단계를 눌러 흐름 따라가기", simulation: "값을 움직여 결과 보기" }[s.widgetType] || "핵심 숫자만 모았어요";
    show('<div class="shell article-layout" style="' + toneStyle(s) + '"><aside class="rail" aria-label="소식 바로가기"><div class="rail-caption">TODAY\'S STORIES</div>' +
      S.map(function (x, k) { return '<button class="rail-item ' + (k === i ? "current" : "") + '" data-open="' + k + '" style="' + toneStyle(x) + '"><span class="squareicon tone">' + icon(T(x).icon) + "</span><span>" + esc(x.sheet.hook) + "</span></button>"; }).join("") +
      '<div class="rail-note">' + icon("info", "icon-sm") + "사실과 해석을 구분해 표시합니다. 숫자는 기사 원문의 근거와 대조했어요.</div></aside>" +
      '<article class="article-column"><button class="back" data-home>' + icon("arrow-left", "icon-sm") + ' 오늘의 세 가지 이야기</button><div class="story-meta">' + badge(s) + '<span class="meta-divider"></span><span class="muted">기준 시점 ' + esc(s.asOf) + '</span><span class="meta-divider"></span><span class="muted">0' + (i + 1) + " / 0" + S.length + "</span></div>" +
      '<h1 class="article-title serif">' + esc(s.story.title) + '</h1><p class="lede">' + esc(s.story.lede.text) + "</p>" +
      '<div class="article-actions"><div class="read-tabs" role="group" aria-label="읽기 방식"><button data-depth="short" aria-pressed="true">30초 핵심</button><button data-depth="long" aria-pressed="false">깊이 읽기</button></div></div>' +
      '<section class="hero-stat"><div class="visual-split"><div><div class="eyebrow">' + t.kicker + " · SIGNAL 0" + (i + 1) + '</div><h2 class="serif">' + esc(s.sheet.hook) + "</h2><p>" + esc(s.sheet.insight) + "</p></div>" + visual + "</div></section>" +
      '<div class="factstrip">' + s.sheet.key_facts.map(function (f, k) { return '<div class="facttile"><span class="num">KEY 0' + (k + 1) + "</span><p>" + esc(f.text) + "</p></div>"; }).join("") + "</div>" +
      '<div class="why-bird" id="why"><div class="slot" data-size="md" id="slot-why"></div><div class="why-panel"><strong>왜 이 소식을 물어 왔을까요?</strong><p>' + esc(s.why) + "</p></div></div>" +
      '<div class="section-line"></div><div class="explore-header"><div><span class="eyebrow">' + (s.widgetMode === "interactive" ? "INTERACTIVE EXPLAINER" : "AT A GLANCE") + "</span><h2>" + (s.widgetMode === "interactive" ? "직접 움직여 이해하기" : "숫자로 한눈에 보기") + "</h2></div><p>" + hint + '</p></div><div id="workbench"></div>' +
      (s.sheet.caution ? '<div class="research-warning">' + icon("info", "icon-sm") + "<span>" + esc(s.sheet.caution) + "</span></div>" : "") +
      '<p id="deepHint" style="color:var(--muted);font-size:12px;margin:17px 0">더 자세한 배경이 궁금하다면 위의 <b>‘깊이 읽기’</b>를 눌러보세요.</p>' +
      '<div id="deepDive" hidden><div class="section-line"></div><section class="card-section"><span class="eyebrow">GO DEEPER</span><h2>맥락까지 읽어보기</h2><div class="text-blocks">' +
      s.story.blocks.map(function (b) { return '<section class="text-section ' + esc(b.kind) + '"><span class="text-kind">' + (KIND[b.kind] || "설명") + "</span>" + (b.heading ? "<h3>" + esc(b.heading) + "</h3>" : "") + "<p>" + b.sentences.map(function (v) { return esc(v.text); }).join(" ") + "</p></section>"; }).join("") +
      (s.story.uncertainty ? '<section class="text-section"><span class="text-kind">아직 확실하지 않은 것</span><p>' + esc(s.story.uncertainty) + "</p></section>" : "") + "</div></section></div>" +
      '<section class="quiz"><span class="quiz-kicker">CHECK YOUR UNDERSTANDING · 1 QUESTION</span><h2>' + esc(s.sheet.quiz.question) + '</h2><div class="quiz-options">' + s.sheet.quiz.answers.map(function (a, k) { return '<button data-answer="' + k + '" aria-pressed="false">' + esc(a) + "</button>"; }).join("") + '</div><div class="quiz-feedback" id="quizFb" hidden aria-live="polite"></div></section>' +
      ((s.story.terms || []).length ? '<section class="card-section"><h2>낯선 단어, 10초 해설</h2><div class="glossary-grid">' + s.story.terms.map(function (x) { return '<details class="term"><summary>' + esc(x.term) + icon("chevron-down", "icon-sm") + "</summary><p>" + esc(x.explain) + "</p></details>"; }).join("") + "</div></section>" : "") +
      '<section class="card-section"><h2>원문에서 확인하기 <span style="font-size:13px;color:var(--muted);font-weight:500">' + s.sources.length + '건</span></h2><ul class="source-list">' + s.sources.map(function (a) { return '<li><a href="' + esc(/^https?:\/\//.test(a.url) ? a.url : "#") + '" target="_blank" rel="noopener noreferrer"><span><strong>' + esc(a.source) + "</strong><small>" + esc(a.title) + " · " + esc(String(a.dateTime || "").slice(0, 10).replace(/-/g, ".")) + "</small></span>" + icon("external-link", "icon-sm") + "</a></li>"; }).join("") +
      '</ul><p class="source-disclaimer">\'보도된 사실\'은 기사 원문의 근거와 대조한 내용이에요. \'개념 풀어보기\'와 \'해석\'은 보도 사실과 구분되는 설명입니다.</p></section>' +
      '<div class="article-next"><div>' + (next === null ? "오늘의 소식을 다 읽었어요" : "다음 이야기<strong>" + esc(S[next].sheet.hook) + "</strong>") + '</div><button class="solidbtn" ' + (next === null ? "data-close" : 'data-open="' + next + '"') + ">" + (next === null ? "마무리" : "다음 소식") + " " + icon("arrow-right", "icon-sm") + "</button></div></article></div>", i);
    read[i] = 1;
    try { window.WIDGETS.mount($("workbench"), Object.assign({ iconName: t.icon }, s.widget)); } catch (e) { $("workbench").hidden = true; }
    // 새: 가져온 이유 옆에 있다가, 그 자리가 화면 밖으로 나가면 위쪽 띠로 옮겨 가만히 있는다
    var seen = true;
    onBird = function () { Bird.setQuiet(true); Bird.place(seen ? $("slot-why") : $("slot-dock")); Bird.flourish("hand-over"); Bird.react(); };
    onBird();
    if ("IntersectionObserver" in window) {
      dockWatch = new IntersectionObserver(function (es) { if (at !== i) return; seen = es[0].isIntersecting; Bird.place(seen ? $("slot-why") : $("slot-dock")); }, { rootMargin: "-80px 0px 0px 0px" });
      dockWatch.observe($("why"));
    }
  }
  function closing() {
    show('<div class="shell"><section class="bird-stage"><div class="slot" data-size="lg" id="slot-main"></div><div class="today-label"><i></i><span>THAT\'S ALL FOR TODAY</span></div><h1 class="serif">오늘의 소식은<br>여기까지예요.</h1><p>세 편을 다 읽으면 끝나요. 편히 쉬어요.</p><div class="stage-actions"><button class="solidbtn previousbtn" data-home>오늘 소식 다시 보기</button><button class="solidbtn" data-profile>프로필 바꿔서 다시 받기</button></div></section></div>', "closing");
    birdMain(false);
  }

  // ── 누르기 ─────────────────────────────────────────────
  document.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.sample !== undefined) { var s = SAMPLES[Number(b.dataset.sample)]; FIELDS.forEach(function (f) { $("f-" + f[0]).value = s[f[0]]; }); return; }
    if (b.id === "again") { edition = store.get("edition"); read = {}; overview(); return; }
    if (b.dataset.open !== undefined) { article(Number(b.dataset.open)); return; }
    if (b.dataset.home !== undefined || b.id === "allNews" || b.id === "home") { if (edition) overview(); else intro(); return; }
    if (b.dataset.close !== undefined) { closing(); return; }
    if (b.dataset.profile !== undefined || b.id === "profileBtn") { intro(); return; }
    if (b.id === "themeToggle") { theme = theme === "light" ? "dark" : "light"; store.set("theme", theme); setTheme(); return; }
    if (b.dataset.depth) {
      var long = b.dataset.depth === "long"; $("deepDive").hidden = !long; $("deepHint").hidden = long;
      Array.prototype.forEach.call(b.parentNode.children, function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      if (long) $("deepDive").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (b.dataset.answer !== undefined && typeof at === "number") {
      var q = edition.stories[at].sheet.quiz, k = Number(b.dataset.answer);
      Array.prototype.forEach.call(b.parentNode.children, function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      $("quizFb").hidden = false; $("quizFb").innerHTML = "<b>" + (k === q.correct ? "✓ 맞았어요!" : "↗ 한 번 더 살펴볼까요?") + "</b>" + esc(q.explain);
      Bird.react();
    }
  });
  document.addEventListener("submit", function (e) {
    if (e.target.id !== "profileForm") return; e.preventDefault();
    var p = {}; FIELDS.forEach(function (f) { p[f[0]] = $("f-" + f[0]).value.trim(); });
    store.set("profile", p);
    if (!p.job && !p.interests) { intro("하는 일이나 관심사를 한 줄이라도 적어 주세요."); return; }
    request(p);
  });
  window.addEventListener("scroll", progress, { passive: true }); window.addEventListener("resize", progress);
  window.__demo = { story: article, overview: overview, closing: closing, state: function () { return at; } }; // 개발 확인용

  setTheme(); intro();
  var boot = function () { Bird.init().then(function () { onBird(); }); };
  if ("requestIdleCallback" in window) requestIdleCallback(boot, { timeout: 600 }); else setTimeout(boot, 50);
})();
