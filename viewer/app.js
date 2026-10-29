/* Atheos Study Viewer: browse and practice the content bundled in the Atheos 1.0.32 Android app.
   Reads `new_root` straight from the app's own data file (original/js/build/root_loader.js). */
(function () {
  "use strict";

  const ROOT = window.new_root;
  const main = document.getElementById("main");
  const nav = document.getElementById("nav");
  const searchInput = document.getElementById("search-input");

  if (!ROOT || !ROOT.children) {
    main.innerHTML = '<p class="empty">Could not load the app data (original/js/build/root_loader.js).</p>';
    return;
  }

  // ---------- storage (per-browser conveniences only) ----------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem("atheos-viewer:" + key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem("atheos-viewer:" + key, JSON.stringify(value));
      } catch (e) { /* storage unavailable: nothing to persist */ }
    },
  };
  let scores = store.get("scores", {});

  const savedTheme = store.get("theme", null);
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;

  // ---------- text rendering ----------
  // The data only uses <br>, <b>, **bold** and markdown links, so everything else is escaped.
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ESC[c]);

  function safeUrl(url) {
    const u = String(url).trim().replace(/\.$/, "");
    if (/^https?:\/\//i.test(u)) return u;
    if (/^(www\.|[\w-]+(\.[\w-]+)+(\/|$))/i.test(u)) return "http://" + u;
    return null;
  }

  function link(url, text) {
    return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`;
  }

  function inline(raw) {
    const held = [];
    const hold = (html) => "\u0000" + (held.push(html) - 1) + "\u0000";
    let s = String(raw == null ? "" : raw);
    // Links in the data can have line breaks or [nested] brackets in the text, "a=1 & b=2" in the URL,
    // or a missing opening bracket; the last kind falls through to bare-URL linking below.
    s = s.replace(/\[((?:[^[\]]|\[[^[\]]*\])+)\]\(([^)]+)\)/g, (m, text, url) => {
      const u = safeUrl(url.replace(/\s*&\s*/g, "&"));
      const label = text.replace(/\s+/g, " ").trim();
      return u && !/\s/.test(u) ? hold(link(u, label)) : text;
    });
    s = s.replace(/\]\((?=https?:\/\/)/g, " ");
    s = s.replace(/\bhttps?:\/\/[^\s<>()"']*[^\s<>()"'.,;:!?]/g, (url) => hold(link(url, url)));
    s = s.replace(/<br\s*\/?>/gi, () => hold("<br>"));
    s = s.replace(/<(\/?)b>/gi, (m, close) => hold(`<${close}strong>`));
    s = esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
    return s.replace(/\u0000(\d+)\u0000/g, (m, i) => held[+i]);
  }

  function plain(raw) {
    return String(raw == null ? "" : raw)
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/?[a-z][^>]*>/gi, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\*\*/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Paragraph-aware rendering for essays and long descriptions.
  function paragraphs(raw) {
    return String(raw == null ? "" : raw)
      .replace(/\r\n?/g, "\n")
      .replace(/^(\s|<br\s*\/?>)+/i, "")
      .replace(/(\s|<br\s*\/?>)+$/i, "")
      .split(/\n\s*\n|(?:<br\s*\/?>\s*){2,}/i)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${inline(p)}</p>`)
      .join("");
  }

  // Minimal markdown for the app's terms/about texts: headings, bullet lists, paragraphs.
  function markdown(raw) {
    const lines = String(raw == null ? "" : raw).replace(/\r\n?/g, "\n").split("\n");
    let html = "";
    let para = [];
    let list = [];
    const flushPara = () => {
      if (para.length) html += `<p>${inline(para.join("\n"))}</p>`;
      para = [];
    };
    const flushList = () => {
      if (list.length) html += `<ul>${list.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`;
      list = [];
    };
    lines.forEach((line) => {
      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      const bullet = line.match(/^\s*[*-]\s+(.*)$/);
      if (heading) {
        flushPara();
        flushList();
        const level = Math.min(heading[1].length + 2, 6);
        html += `<h${level}>${inline(heading[2])}</h${level}>`;
      } else if (bullet) {
        flushPara();
        list.push(bullet[1]);
      } else if (!line.trim()) {
        flushPara();
        flushList();
      } else {
        flushList();
        para.push(line);
      }
    });
    flushPara();
    flushList();
    return html;
  }

  function highlight(text, terms) {
    if (!terms.length) return esc(text);
    const re = new RegExp("(" + terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi");
    return text.split(re).map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part))).join("");
  }

  const img = (path, cls) => (path ? `<img class="${cls || ""}" src="original/${esc(path)}" alt="" loading="lazy">` : "");
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const stripDash = (s) => String(s || "").replace(/^\s*[—–-]\s*/, "").trim();

  // ---------- data model ----------
  const personas = ROOT.children;
  const levels = personas.filter((p) => p.type === "Persona" && p.id !== "None" && p.children.length);
  const introPersona = personas.find((p) => p.id === "None");
  const levelById = new Map(personas.map((p) => [p.id, p]));
  const quizzes = levels.flatMap((p) => p.children);
  const quizById = new Map();
  personas.forEach((p) => p.children.forEach((q) => quizById.set(q.id, q)));

  const scrolls = personas.flatMap((p) => (p.essays && p.essays.children) || []);
  const essays = scrolls.filter((s) => s.contribution_type === "Essay");
  const orgs = scrolls.filter((s) => s.contribution_type !== "Essay");
  const refs = personas.flatMap((p) => (p.externalReferences && p.externalReferences.children) || []);
  const definitions = (ROOT.definitions || []).slice().sort((a, b) => a.term.localeCompare(b.term));
  const props = ROOT.properties || {};
  const prop = (key) => (props[key] && props[key].description) || "";

  function levelInfo(p) {
    const parts = String(p.name).split(/<br\s*\/?>/i).map(plain).filter(Boolean);
    const label = parts[0] || p.id;
    const num = (label.match(/\d+/) || [""])[0];
    return { label, title: parts.slice(1).join(" "), num };
  }
  const levelBlurb = (p) => String(p.description || "").replace(/^\s*<b>.*?<\/b>/i, "");
  const levelName = (p) => {
    const info = levelInfo(p);
    return info.num ? `Level ${info.num}: ${info.title}` : plain(p.name);
  };

  const quizTitle = (q) => plain(q.name).replace(/\s*\(~?\d+\)\s*$/, "");
  const isDialogue = (q) => q.children.some((x) => x.step);
  const orderedQuestions = (q) => q.children.slice().sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  const answerText = (a) => a.description || a.name || "";

  function refTitle(r) {
    const m = String(r.name || "").match(/\[([^\]]+)\]/);
    return m ? m[1].trim() : plain(r.name).replace(/^\w+:\s*/, "");
  }
  const essayTitle = (e) => (e.contribution_type === "Essay" ? plain(e.name) : refTitle(e));
  const essaySummary = (e) => plain(e.essay_description).replace(/^Summary:\s*/i, "");

  // ---------- search index ----------
  const searchIndex = [];
  function addToIndex(entry) {
    entry.lower = (entry.title + " " + entry.text).toLowerCase();
    searchIndex.push(entry);
  }
  quizzes.forEach((quiz) => {
    const lvl = levelById.get(quiz.persona_id);
    const where = `${quizTitle(quiz)} · ${levelName(lvl)}`;
    addToIndex({ kind: "Quiz", title: quizTitle(quiz), context: levelName(lvl), text: plain(quiz.description), href: `#/quiz/${quiz.id}` });
    quiz.children.forEach((q) => {
      const parts = [q.reference].concat(q.children.map((a) => [answerText(a), a.whycorrect, a.whypoor].join(" ")));
      addToIndex({
        kind: "Question",
        title: plain(q.description),
        context: where,
        text: plain(parts.join(" ")),
        href: `#/quiz/${quiz.id}?q=${encodeURIComponent(q.id)}`,
      });
    });
  });
  essays.forEach((e) =>
    addToIndex({ kind: "Essay", title: essayTitle(e), context: stripDash(e.contributor), text: plain(e.essay_description + " " + e.description), href: `#/scroll/${e.id}` })
  );
  orgs.forEach((o) =>
    addToIndex({ kind: "Organization", title: essayTitle(o), context: "", text: plain(o.essay_description), href: `#/scrolls?id=${encodeURIComponent(o.id)}` })
  );
  refs.forEach((r) =>
    addToIndex({ kind: r.contribution_type || "Reference", title: refTitle(r), context: stripDash(r.contributor), text: plain(r.essay_description), href: `#/references?id=${encodeURIComponent(r.id)}` })
  );
  definitions.forEach((d) =>
    addToIndex({ kind: "Glossary", title: d.term, context: "", text: plain(d.description), href: `#/glossary?term=${encodeURIComponent(d.term)}` })
  );

  // ---------- navigation ----------
  function scoreBadge(quizId) {
    const s = scores[quizId];
    return s ? `<span class="done" title="Best practice score">✓ ${s.correct}/${s.total}</span>` : "";
  }

  function buildNav() {
    const open = nav.querySelectorAll("details[open]");
    const openIds = new Set(Array.prototype.map.call(open, (d) => d.dataset.level));
    let html = `
      <a href="#/" data-route="">Home</a>
      <a href="#/intro" data-route="intro">Introduction</a>
      <div class="nav-heading">Cave levels</div>`;
    levels.forEach((p) => {
      const info = levelInfo(p);
      html += `<details data-level="${esc(p.id)}"${openIds.has(p.id) ? " open" : ""}>
        <summary><span class="lvl-num">${esc(info.num)}</span>${esc(info.title)}</summary>
        <a class="sub" href="#/level/${esc(p.id)}" data-route="level/${esc(p.id)}">Overview</a>
        ${p.children
          .map(
            (q) => `<a class="sub" href="#/quiz/${esc(q.id)}" data-route="quiz/${esc(q.id)}">${esc(quizTitle(q))}${
              scoreBadge(q.id) || `<span class="count">${q.children.length}</span>`
            }</a>`
          )
          .join("")}
      </details>`;
    });
    html += `
      <div class="nav-heading">Library</div>
      <a href="#/scrolls" data-route="scrolls">Scrolls (essays)</a>
      <a href="#/references" data-route="references">References</a>
      <a href="#/glossary" data-route="glossary">Glossary</a>
      <a href="#/about" data-route="about">About &amp; credits</a>
      <div class="nav-heading">Original</div>
      <a class="external" href="original/index.html" target="_blank" rel="noopener">Play the original app</a>`;
    nav.innerHTML = html;
  }

  function markNav(routeKey, levelId) {
    nav.querySelectorAll("a[data-route]").forEach((a) => a.classList.toggle("active", a.dataset.route === routeKey));
    if (levelId) nav.querySelectorAll("details").forEach((d) => (d.open = d.dataset.level === levelId));
    const active = nav.querySelector("a.active");
    if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest" });
  }

  function pager(prev, next) {
    if (!prev && !next) return "";
    const a = (item, cls, label) =>
      item ? `<a class="${cls}" href="${item.href}"><small>${label}</small>${esc(item.title)}</a>` : "<span></span>";
    return `<nav class="pager">${a(prev, "prev", "← Previous")}${a(next, "next", "Next →")}</nav>`;
  }

  // ---------- pages ----------
  function renderHome() {
    const totalQuestions = quizzes.reduce((n, q) => n + q.children.length, 0);
    const stats = [
      [levels.length, "cave levels"],
      [quizzes.length, "quizzes & dialogues"],
      [totalQuestions, "questions"],
      [essays.length, "essays"],
      [refs.length, "references"],
      [definitions.length, "glossary terms"],
    ];
    const practiced = quizzes.filter((q) => scores[q.id]).length;
    return {
      title: "Home",
      html: `
      <section class="hero">
        <img src="original/img/Atheos-Owl_300x300_300_v1.png" alt="">
        <div>
          <div class="eyebrow">Study viewer · data v${esc(ROOT.dataVersion)}</div>
          <h1>Atheos</h1>
          <p class="lede">${esc(plain(prop("cave-levels-description")).replace(/^Cave Map\s*/, ""))}</p>
        </div>
      </section>
      <div class="stats">${stats.map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join("")}</div>
      <div class="toolbar">
        <a class="btn primary" href="#/level/${esc(levels[0].id)}">Start with Cave Level 1</a>
        <a class="btn" href="#/intro">How Atheos works</a>
        <span class="muted" style="font-size:14px">${practiced ? `You've practiced ${plural(practiced, "quiz")} so far.` : "Review any quiz, or practice it one question at a time."}</span>
      </div>
      <h2>Cave levels</h2>
      <div class="grid">${levels.map(levelCard).join("")}</div>`,
    };
  }

  function levelCard(p) {
    const info = levelInfo(p);
    const done = p.children.filter((q) => scores[q.id]).length;
    const questions = p.children.reduce((n, q) => n + q.children.length, 0);
    return `<a class="card level-card" href="#/level/${esc(p.id)}">
      ${img(p.image)}
      <div style="flex:1;min-width:0">
        <div class="lvl">${esc(info.label)}</div>
        <div class="t">${esc(info.title)}</div>
        <div class="s">${plural(p.children.length, "quiz")} · ${questions} questions</div>
        ${done ? `<div class="progress" title="${done} of ${p.children.length} practiced"><div style="width:${(done / p.children.length) * 100}%"></div></div>` : ""}
      </div>
    </a>`;
  }

  function quizCard(q) {
    const best = scores[q.id];
    return `<a class="card" href="#/quiz/${esc(q.id)}">
      ${img(q.image)}
      <div style="min-width:0">
        <div class="t">${esc(quizTitle(q))}</div>
        <div class="meta">
          <span class="pill">${isDialogue(q) ? "Dialogue" : "Quiz"}</span>
          <span class="pill">${q.children.length} questions</span>
          ${best ? `<span class="pill good">Best ${best.correct}/${best.total}</span>` : ""}
        </div>
      </div>
    </a>`;
  }

  function renderLevel(p) {
    const info = levelInfo(p);
    const i = levels.indexOf(p);
    const lvlEssays = ((p.essays && p.essays.children) || []).filter((e) => e.contribution_type === "Essay");
    const lvlOrgs = ((p.essays && p.essays.children) || []).filter((e) => e.contribution_type !== "Essay");
    const lvlRefs = (p.externalReferences && p.externalReferences.children) || [];
    const asItem = (lv) => lv && { href: `#/level/${lv.id}`, title: levelName(lv) };
    return {
      title: levelName(p),
      levelId: p.id,
      html: `
      <div class="crumbs"><a href="#/">Home</a> › ${esc(info.label)}</div>
      <header class="page-head">
        ${img(p.image, "art")}
        <div>
          <div class="eyebrow">${esc(info.label)}</div>
          <h1>${esc(info.title)}</h1>
          <p class="lede">${inline(levelBlurb(p).replace(/^(\s|<br\s*\/?>)+/i, ""))}</p>
        </div>
      </header>
      <h2>Quizzes &amp; dialogues</h2>
      <div class="grid">${p.children.map(quizCard).join("")}</div>
      ${lvlEssays.length ? `<h2>Scrolls</h2><div class="grid">${lvlEssays.map(essayCard).join("")}</div>` : ""}
      ${lvlOrgs.length ? `<h2>Organizations</h2><div class="list">${lvlOrgs.map(orgItem).join("")}</div>` : ""}
      ${lvlRefs.length ? `<h2>References</h2><div class="list">${lvlRefs.map(refItem).join("")}</div>` : ""}
      ${pager(asItem(levels[i - 1]), asItem(levels[i + 1]))}`,
    };
  }

  function answerItem(a, dialogue, byStep) {
    const why = a.correct ? a.whycorrect : a.whypoor;
    let go = "";
    if (dialogue && a.correct && a.goto_step) {
      const target = byStep.get(a.goto_step);
      if (a.goto_step === "END") go = '<span class="goto end">Ends the dialogue</span>';
      else if (target) go = `<a class="goto" href="#" data-jump="q-${esc(target.id)}">→ Step ${esc(a.goto_step)}</a>`;
      else go = `<span class="goto">→ Step ${esc(a.goto_step)}</span>`;
    }
    return `<li class="answer ${a.correct ? "good" : "bad"}">
      <span class="verdict">${a.correct ? "✓ Ideal" : "✗ Poor"}</span>
      <div class="abody">
        <div>${inline(answerText(a))}</div>
        ${why ? `<div class="why">${inline(why)}</div>` : ""}
        ${go}
      </div>
    </li>`;
  }

  function questionCard(q, i, dialogue, byStep) {
    const tag = q.cb_type || q.dd_type;
    return `<article class="qcard" id="q-${esc(q.id)}">
      <div class="qmeta">
        <span class="qnum">${dialogue && q.step ? "Step " + esc(q.step) : i + 1}</span>
        ${q.prefix ? `<span>${esc(q.prefix)}</span>` : ""}
        ${tag && !dialogue ? `<span class="tag">${esc(tag)}</span>` : ""}
      </div>
      <p class="prompt">${inline(q.description)}</p>
      <ul class="answers">${q.children.map((a) => answerItem(a, dialogue, byStep)).join("")}</ul>
      ${q.reference ? `<p class="source"><span>Source</span>${inline(q.reference)}</p>` : ""}
      <button class="btn reveal-btn" type="button" data-action="reveal">Reveal answers</button>
    </article>`;
  }

  function adjacentQuiz(quiz, delta) {
    const q = quizzes[quizzes.indexOf(quiz) + delta];
    return q && { href: `#/quiz/${q.id}`, title: quizTitle(q) };
  }

  function renderQuiz(quiz) {
    const lvl = levelById.get(quiz.persona_id);
    const qs = orderedQuestions(quiz);
    const dialogue = isDialogue(quiz);
    const byStep = new Map(qs.filter((q) => q.step).map((q) => [q.step, q]));
    const hide = store.get("hideAnswers", false);
    const best = scores[quiz.id];
    return {
      title: quizTitle(quiz),
      levelId: lvl.id,
      html: `
      <div class="crumbs"><a href="#/">Home</a> › <a href="#/level/${esc(lvl.id)}">${esc(levelName(lvl))}</a></div>
      <header class="page-head">
        ${img(quiz.image, "art")}
        <div>
          <div class="eyebrow">${dialogue ? "Dialogue" : "Quiz"} · ${qs.length} questions</div>
          <h1>${esc(quizTitle(quiz))}</h1>
          ${quiz.description ? `<p class="lede">${inline(quiz.description)}</p>` : ""}
          ${quiz.contributor ? `<p class="byline">Contributed by ${esc(stripDash(quiz.contributor))}</p>` : ""}
        </div>
      </header>
      <div class="toolbar">
        <a class="btn primary" href="#/practice/${esc(quiz.id)}">Practice this ${dialogue ? "dialogue" : "quiz"}</a>
        <label class="switch"><input type="checkbox" data-action="toggle-hide"${hide ? " checked" : ""}> Hide answers until I reveal them</label>
        ${best ? `<span class="pill good">Best ${best.correct}/${best.total}</span>` : ""}
      </div>
      ${dialogue ? '<p class="hint">A branching conversation. Each ideal response moves the believer to the step shown beside it; the practice mode follows those branches for you.</p>' : ""}
      <div class="qlist${hide ? " hide-answers" : ""}">${qs.map((q, i) => questionCard(q, i, dialogue, byStep)).join("")}</div>
      ${pager(adjacentQuiz(quiz, -1), adjacentQuiz(quiz, 1))}`,
    };
  }

  function renderIntro() {
    const slides = introPersona ? introPersona.children.flatMap((q) => orderedQuestions(q)) : [];
    return {
      title: "Introduction",
      html: `
      <div class="crumbs"><a href="#/">Home</a> › Introduction</div>
      <div class="eyebrow">How Atheos works</div>
      <h1>Introduction</h1>
      <p class="lede">These are the onboarding and closing screens from the app.</p>
      <div class="list" style="margin-top:22px">${slides
        .map(
          (s) => `<div class="item slide">${img(s.image)}<div>
            ${s.prefix ? `<p style="margin:0 0 6px">${inline(s.prefix)}</p>` : ""}
            <div class="s">${inline(s.description)}</div></div></div>`
        )
        .join("")}</div>
      ${prop("about-description") ? `<p class="muted" style="margin-top:22px">${inline(prop("about-description"))}: <a href="#/about">About &amp; credits</a></p>` : ""}`,
    };
  }

  function essayCard(e) {
    return `<a class="card" href="#/scroll/${esc(e.id)}">
      <div style="min-width:0">
        <div class="t">${esc(essayTitle(e))}</div>
        <div class="s">${esc(stripDash(e.contributor))}</div>
        <div class="s">${esc(essaySummary(e))}</div>
      </div>
    </a>`;
  }

  function orgItem(o) {
    const url = safeUrl(o.link || "");
    return `<div class="item" id="item-${esc(o.id)}">
      <div class="t">${url ? link(url, essayTitle(o)) : esc(essayTitle(o))}</div>
      <div class="s">${inline(o.essay_description)}</div>
    </div>`;
  }

  function refItem(r) {
    const url = safeUrl(r.link || "");
    return `<div class="item" id="item-${esc(r.id)}" data-type="${esc(r.contribution_type)}" data-text="${esc(
      (refTitle(r) + " " + r.contributor + " " + r.essay_description).toLowerCase()
    )}">
      <div class="row"><span class="kind">${esc(r.contribution_type)}</span>
        <span class="t">${url ? link(url, refTitle(r)) : esc(refTitle(r))}</span></div>
      ${r.contributor ? `<div class="s">${esc(stripDash(r.contributor))}</div>` : ""}
      ${r.essay_description ? `<div class="s"><em>${inline(r.essay_description)}</em></div>` : ""}
    </div>`;
  }

  function renderScrolls() {
    const groups = personas
      .map((p) => ({ p, list: ((p.essays && p.essays.children) || []).filter((e) => e.contribution_type === "Essay") }))
      .filter((g) => g.list.length);
    return {
      title: "Scrolls",
      route: "scrolls",
      html: `
      <div class="crumbs"><a href="#/">Home</a> › Scrolls</div>
      <h1>Scrolls</h1>
      <p class="lede">${esc(prop("essays-description"))}</p>
      ${groups.map((g) => `<h2>${esc(levelName(g.p))}</h2><div class="grid">${g.list.map(essayCard).join("")}</div>`).join("")}
      <h2>Organizations</h2>
      <p class="muted">${esc(prop("organization-description"))}</p>
      <div class="list">${orgs.map(orgItem).join("")}</div>`,
    };
  }

  function renderEssay(e) {
    const lvl = levelById.get(e.persona_id);
    const i = essays.indexOf(e);
    const asItem = (x) => x && { href: `#/scroll/${x.id}`, title: essayTitle(x) };
    const author = stripDash(e.contributor);
    const site = safeUrl(e.link || "");
    const body = String(e.description || "").replace(new RegExp("(<br\\s*/?>|\\s)*—\\s*" + author.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$"), "");
    return {
      title: essayTitle(e),
      route: "scrolls",
      levelId: lvl && lvl.id,
      html: `
      <div class="crumbs"><a href="#/scrolls">Scrolls</a>${lvl ? ` › <a href="#/level/${esc(lvl.id)}">${esc(levelName(lvl))}</a>` : ""}</div>
      <div class="eyebrow">Essay</div>
      <h1>${esc(essayTitle(e))}</h1>
      <p class="byline">by ${esc(author)}${site ? ` · ${link(site, site.replace(/^https?:\/\//, "").replace(/\/$/, ""))}` : ""}</p>
      <blockquote class="summary-quote">${esc(essaySummary(e))}</blockquote>
      <div class="essay-body">${paragraphs(body)}</div>
      ${pager(asItem(essays[i - 1]), asItem(essays[i + 1]))}`,
    };
  }

  function renderReferences() {
    const types = refs.map((r) => r.contribution_type).filter((t, i, a) => t && a.indexOf(t) === i);
    const groups = levels
      .map((p) => ({ p, list: (p.externalReferences && p.externalReferences.children) || [] }))
      .filter((g) => g.list.length);
    return {
      title: "References",
      route: "references",
      html: `
      <div class="crumbs"><a href="#/">Home</a> › References</div>
      <h1>References</h1>
      <p class="lede">${esc(prop("scrolls-description"))}. Each one is paired with the believer's claim it helps answer.</p>
      <div class="chips" role="group" aria-label="Filter by type">
        <button class="chip" type="button" data-action="ref-filter" data-type="" aria-pressed="true">All ${refs.length}</button>
        ${types.map((t) => `<button class="chip" type="button" data-action="ref-filter" data-type="${esc(t)}" aria-pressed="false">${esc(t)}s ${refs.filter((r) => r.contribution_type === t).length}</button>`).join("")}
      </div>
      <input class="filter" id="ref-filter-text" type="search" placeholder="Filter references…" aria-label="Filter references">
      <div id="ref-groups">${groups
        .map((g) => `<section class="ref-group"><h2>${esc(levelName(g.p))}</h2><div class="list">${g.list.map(refItem).join("")}</div></section>`)
        .join("")}</div>
      <p class="empty" id="ref-empty" hidden>No references match.</p>`,
    };
  }

  function applyRefFilter() {
    const active = main.querySelector('.chip[aria-pressed="true"]');
    const type = active ? active.dataset.type : "";
    const textInput = document.getElementById("ref-filter-text");
    const text = textInput ? textInput.value.trim().toLowerCase() : "";
    let shown = 0;
    main.querySelectorAll(".ref-group").forEach((group) => {
      let groupShown = 0;
      group.querySelectorAll(".item").forEach((item) => {
        const ok = (!type || item.dataset.type === type) && (!text || item.dataset.text.includes(text));
        item.hidden = !ok;
        if (ok) groupShown++;
      });
      group.hidden = !groupShown;
      shown += groupShown;
    });
    document.getElementById("ref-empty").hidden = shown > 0;
  }

  function renderGlossary() {
    return {
      title: "Glossary",
      route: "glossary",
      html: `
      <div class="crumbs"><a href="#/">Home</a> › Glossary</div>
      <h1>Glossary</h1>
      <p class="lede">${definitions.length} terms used throughout the app.</p>
      <input class="filter" id="glossary-filter" type="search" placeholder="Filter terms…" aria-label="Filter glossary">
      <dl class="glossary">${definitions
        .map(
          (d) => `<div data-term="${esc(d.term)}" data-text="${esc((d.term + " " + plain(d.description)).toLowerCase())}">
            <dt>${esc(d.term)}</dt><dd>${inline(d.description)}</dd></div>`
        )
        .join("")}</dl>`,
    };
  }

  function renderAbout() {
    const team = ROOT.team || [];
    return {
      title: "About",
      route: "about",
      html: `
      <div class="crumbs"><a href="#/">Home</a> › About</div>
      <h1>About Atheos</h1>
      <p class="lede">Content from Atheos ${esc(ROOT.dataVersion)}, last updated ${esc(String(ROOT.updated_at || "").slice(0, 10))}.</p>
      <h2>Team</h2>
      <div class="list">${team
        .map((m) => {
          const url = m.link && safeUrl(m.link);
          return `<div class="item"><div class="row"><span class="t">${url ? link(url, m.name) : esc(m.name)}</span>${
            m.position ? `<span class="pill">${esc(m.position)}</span>` : ""
          }</div>${m.description ? `<div class="s">${inline(m.description)}</div>` : ""}</div>`;
        })
        .join("")}</div>
      <h2>Terms and conditions</h2>
      <div class="prose item">${markdown(prop("web-terms-and-conditions") || prop("terms-and-conditions"))}</div>`,
    };
  }

  function renderSearch(query) {
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    let body;
    if (!terms.length) {
      body = '<p class="empty">Type at least two letters in the search box.</p>';
    } else {
      const hits = searchIndex.filter((e) => terms.every((t) => e.lower.includes(t)));
      const titleHit = (e) => terms.some((t) => e.title.toLowerCase().includes(t));
      hits.sort((a, b) => titleHit(b) - titleHit(a));
      const shown = hits.slice(0, 250);
      body = `<p class="muted">${hits.length ? `${hits.length} result${hits.length === 1 ? "" : "s"}${hits.length > shown.length ? `, showing the first ${shown.length}` : ""}` : "No results."}</p>
        <div class="list results">${shown
          .map((e) => {
            const full = e.title + " — " + e.text;
            const lower = full.toLowerCase();
            const pos = Math.max(0, Math.min(...terms.map((t) => (lower.indexOf(t) < 0 ? Infinity : lower.indexOf(t)))));
            const start = pos > 110 ? pos - 90 : 0;
            const snippet = (start ? "…" : "") + full.slice(start, start + 260) + (full.length > start + 260 ? "…" : "");
            return `<div class="item"><div class="row"><span class="kind">${esc(e.kind)}</span>${e.context ? `<span class="muted" style="font-size:13px">${esc(e.context)}</span>` : ""}</div>
              <a class="t" href="${e.href}">${highlight(e.title.length > 160 ? e.title.slice(0, 160) + "…" : e.title, terms)}</a>
              <div class="s">${highlight(snippet, terms)}</div></div>`;
          })
          .join("")}</div>`;
    }
    return {
      title: `Search: ${query}`,
      html: `<div class="crumbs"><a href="#/">Home</a> › Search</div><h1>Search</h1><div id="search-results">${body}</div>`,
    };
  }

  // ---------- practice mode ----------
  let practice = null;

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function startPractice(quiz) {
    const qs = orderedQuestions(quiz);
    practice = { quiz, qs, dialogue: isDialogue(quiz), current: qs[0], history: [], finished: false };
    prepareQuestion();
  }

  function prepareQuestion() {
    const p = practice;
    p.order = shuffle(p.current.children);
    p.picked = [];
    p.solved = false;
    p.firstTry = null;
    p.via = null;
  }

  function nextQuestion(p) {
    if (p.dialogue && p.via) {
      if (p.via.goto_step === "END") return null;
      const byId = p.via.nextquestion && p.qs.find((q) => q.id === p.via.nextquestion);
      if (byId) return byId;
      const byStep = p.via.goto_step && p.qs.find((q) => q.step === p.via.goto_step);
      if (byStep) return byStep;
    }
    return p.qs[p.qs.indexOf(p.current) + 1] || null;
  }

  function pick(idx) {
    const p = practice;
    if (!p || p.solved || p.finished || p.picked.includes(idx) || !p.order[idx]) return;
    const a = p.order[idx];
    p.picked.push(idx);
    if (p.firstTry === null) p.firstTry = !!a.correct;
    if (a.correct) {
      p.solved = true;
      p.via = a;
    }
    showPractice();
  }

  function giveUp() {
    const p = practice;
    if (!p || p.solved) return;
    p.solved = true;
    p.firstTry = false;
    p.via = p.order.find((a) => a.correct) || null;
    showPractice();
  }

  function advance() {
    const p = practice;
    if (!p || !p.solved) return;
    p.history.push({ q: p.current, correct: p.firstTry, via: p.via });
    const next = nextQuestion(p);
    if (!next || p.history.length >= p.qs.length * 2) {
      p.finished = true;
      const correct = p.history.filter((h) => h.correct).length;
      const prev = scores[p.quiz.id];
      if (!prev || correct / p.history.length > prev.correct / prev.total) {
        scores[p.quiz.id] = { correct, total: p.history.length, at: new Date().toISOString() };
        store.set("scores", scores);
        buildNav();
        markNav("quiz/" + p.quiz.id, p.quiz.persona_id);
      }
    } else {
      p.current = next;
      prepareQuestion();
    }
    showPractice();
  }

  function practiceView() {
    const p = practice;
    const quiz = p.quiz;
    const lvl = levelById.get(quiz.persona_id);
    const head = `<div class="crumbs"><a href="#/level/${esc(lvl.id)}">${esc(levelName(lvl))}</a> › <a href="#/quiz/${esc(quiz.id)}">${esc(quizTitle(quiz))}</a> › Practice</div>`;

    if (p.finished) {
      const correct = p.history.filter((h) => h.correct).length;
      const total = p.history.length;
      const missed = p.history.filter((h) => !h.correct);
      const ratio = total ? correct / total : 0;
      const next = adjacentQuiz(quiz, 1);
      return `${head}<div class="practice summary">
        <div class="eyebrow">${p.dialogue ? "Dialogue" : "Quiz"} complete</div>
        <div class="score-big">${correct}/${total}</div>
        <p class="lede">${ratio === 1 ? "Flawless: every response ideal on the first try." : ratio >= 0.75 ? "Strong work. A few to revisit below." : "Worth another pass. Here's what to revisit."}</p>
        <div class="pactions">
          <button class="btn primary" type="button" data-action="restart">Practice again</button>
          <a class="btn" href="#/quiz/${esc(quiz.id)}">Review all answers</a>
          ${next ? `<a class="btn" href="#/practice/${esc(next.href.split("/").pop())}">Next: ${esc(next.title)} →</a>` : ""}
        </div>
        ${missed.length ? `<div class="missed"><h3>Not ideal on the first try</h3><ol>${missed
          .map((h) => `<li><a href="#/quiz/${esc(quiz.id)}?q=${encodeURIComponent(h.q.id)}">${esc(plain(h.q.description))}</a></li>`)
          .join("")}</ol></div>` : ""}
      </div>`;
    }

    const q = p.current;
    const answered = p.history.length;
    const expected = p.dialogue ? quiz.total_questions || p.qs.length : p.qs.length;
    const pos = p.dialogue ? `Exchange ${answered + 1} of about ${expected}` : `Question ${answered + 1} of ${expected}`;
    const correctSoFar = p.history.filter((h) => h.correct).length;
    const lastPick = p.picked.length ? p.order[p.picked[p.picked.length - 1]] : null;
    let msg = "";
    if (p.solved) msg = p.firstTry ? '<div class="pmsg good">Ideal response on the first try.</div>' : '<div class="pmsg">Here is the ideal response.</div>';
    else if (lastPick && !lastPick.correct) msg = '<div class="pmsg bad">Not ideal. Try another response.</div>';
    else msg = '<div class="pmsg"></div>';
    const hasNext = p.solved && !!nextQuestion(p) && p.history.length + 1 < p.qs.length * 2;

    const transcript = p.dialogue && p.history.length
      ? `<div class="transcript">${p.history
          .map((h) => `<div class="bubble them"><small>Believer</small>${inline(h.q.description)}</div>${h.via ? `<div class="bubble you"><small>You</small>${inline(answerText(h.via))}</div>` : ""}`)
          .join("")}</div>`
      : "";

    const choices = p.order
      .map((a, i) => {
        const picked = p.picked.includes(i);
        const show = picked || p.solved;
        const why = a.correct ? a.whycorrect : a.whypoor;
        const state = show ? (a.correct ? "is-good" : "is-bad") : "";
        const dim = p.solved && !picked && !(a === p.via);
        return `<li class="choice-row ${state}${dim ? " dim" : ""}">
          <button class="choice" type="button" data-action="pick" data-idx="${i}"${p.solved || picked ? " disabled" : ""}>
            <span class="key">${i + 1}</span><span>${esc(plain(answerText(a)))}</span>
          </button>
          ${show ? `<div class="feedback"><b>${a.correct ? "Ideal" : "Poor"}</b>${why ? `<div class="why">${inline(why)}</div>` : ""}</div>` : ""}
        </li>`;
      })
      .join("");

    return `${head}<div class="practice">
      <div class="pstatus"><span>${pos}</span><span>${correctSoFar} ideal on first try</span></div>
      <div class="pbar"><div style="width:${Math.min(100, (answered / expected) * 100)}%"></div></div>
      ${transcript}
      ${q.prefix ? `<div class="ptype">${esc(p.dialogue ? "The believer says:" : q.prefix)}</div>` : ""}
      <p class="prompt">${inline(q.description)}</p>
      <ul class="choices">${choices}</ul>
      ${msg}
      <div class="pactions">
        ${p.solved
          ? `<button class="btn primary" type="button" data-action="next" id="next-btn">${hasNext ? "Next →" : "See results"}</button>`
          : '<button class="btn" type="button" data-action="giveup">Show the answer</button>'}
        <span class="kbd-hint">Keys: 1–${p.order.length} to answer, Enter to continue</span>
      </div>
    </div>`;
  }

  function showPractice() {
    main.innerHTML = practiceView();
    const nextBtn = document.getElementById("next-btn");
    if (nextBtn) nextBtn.focus({ preventScroll: true });
    if (practice.finished) window.scrollTo(0, 0);
  }

  // ---------- router ----------
  function parseHash() {
    const hash = location.hash.replace(/^#\/?/, "");
    const qIndex = hash.indexOf("?");
    const path = qIndex >= 0 ? hash.slice(0, qIndex) : hash;
    const params = new URLSearchParams(qIndex >= 0 ? hash.slice(qIndex + 1) : "");
    const parts = path.split("/").filter(Boolean).map((s) => decodeURIComponent(s));
    return { parts, params };
  }

  function route() {
    const { parts, params } = parseHash();
    const [view, id] = parts;
    let page;
    let routeKey = view || "";
    practice = null;

    if (view === "level" && levelById.has(id)) {
      page = renderLevel(levelById.get(id));
      routeKey = "level/" + id;
    } else if (view === "quiz" && quizById.has(id)) {
      page = renderQuiz(quizById.get(id));
      routeKey = "quiz/" + id;
    } else if (view === "practice" && quizById.has(id)) {
      const quiz = quizById.get(id);
      startPractice(quiz);
      page = { title: "Practice: " + quizTitle(quiz), levelId: quiz.persona_id, html: practiceView() };
      routeKey = "quiz/" + id;
    } else if (view === "intro") {
      page = renderIntro();
    } else if (view === "scrolls") {
      page = renderScrolls();
    } else if (view === "scroll" && essays.some((e) => e.id === id)) {
      page = renderEssay(essays.find((e) => e.id === id));
      routeKey = "scrolls";
    } else if (view === "references") {
      page = renderReferences();
    } else if (view === "glossary") {
      page = renderGlossary();
    } else if (view === "about") {
      page = renderAbout();
    } else if (view === "search") {
      const q = params.get("q") || "";
      page = renderSearch(q);
      if (document.activeElement !== searchInput) searchInput.value = q;
    } else {
      page = renderHome();
      routeKey = "";
    }

    main.innerHTML = page.html;
    document.title = (page.title === "Home" ? "" : page.title + " · ") + "Atheos Study Viewer";
    markNav(routeKey, page.levelId);
    // Live search re-routes on every keystroke; keep the mobile drawer open while typing.
    if (!(view === "search" && document.activeElement === searchInput)) document.body.classList.remove("nav-open");

    const focusId = params.get("q") && view === "quiz" ? "q-" + params.get("q") : params.get("id") ? "item-" + params.get("id") : null;
    const term = params.get("term");
    let target = focusId ? document.getElementById(focusId) : null;
    if (!target && term) target = main.querySelector(`[data-term="${CSS.escape(term)}"]`);
    if (target) {
      target.classList.add("flash", "revealed");
      target.scrollIntoView({ block: "center" });
    } else if (view !== "search") {
      window.scrollTo(0, 0);
    }
  }

  // ---------- events ----------
  document.addEventListener("error", (e) => {
    if (e.target && e.target.tagName === "IMG") e.target.classList.add("broken");
  }, true);

  document.addEventListener("click", (e) => {
    const jump = e.target.closest("[data-jump]");
    if (jump) {
      e.preventDefault();
      const el = document.getElementById(jump.dataset.jump);
      if (el) {
        el.classList.remove("flash");
        void el.offsetWidth;
        el.classList.add("flash");
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) {
      const hiddenAnswer = e.target.closest(".hide-answers .qcard:not(.revealed) .answer");
      if (hiddenAnswer) hiddenAnswer.closest(".qcard").classList.add("revealed");
      return;
    }
    const action = actionEl.dataset.action;
    if (action === "toggle-nav") document.body.classList.toggle("nav-open");
    else if (action === "toggle-theme") {
      const dark = getComputedStyle(document.documentElement).colorScheme.trim() === "dark";
      document.documentElement.dataset.theme = dark ? "light" : "dark";
      store.set("theme", document.documentElement.dataset.theme);
    } else if (action === "reveal") actionEl.closest(".qcard").classList.add("revealed");
    else if (action === "pick") pick(Number(actionEl.dataset.idx));
    else if (action === "giveup") giveUp();
    else if (action === "next") advance();
    else if (action === "restart") {
      startPractice(practice.quiz);
      showPractice();
    } else if (action === "ref-filter") {
      main.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === actionEl)));
      applyRefFilter();
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.matches('[data-action="toggle-hide"]')) {
      store.set("hideAnswers", e.target.checked);
      const list = main.querySelector(".qlist");
      if (list) {
        list.classList.toggle("hide-answers", e.target.checked);
        list.querySelectorAll(".qcard.revealed").forEach((c) => c.classList.remove("revealed"));
      }
    }
  });

  document.addEventListener("input", (e) => {
    if (e.target.id === "ref-filter-text") applyRefFilter();
    if (e.target.id === "glossary-filter") {
      const text = e.target.value.trim().toLowerCase();
      main.querySelectorAll("dl.glossary > div").forEach((d) => {
        d.hidden = !!text && !d.dataset.text.includes(text);
      });
    }
  });

  let searchTimer = null;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = searchInput.value.trim();
      if (q.length > 1) location.hash = "#/search?q=" + encodeURIComponent(q);
    }, 250);
  });
  document.getElementById("search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (q) location.hash = "#/search?q=" + encodeURIComponent(q);
  });

  document.addEventListener("keydown", (e) => {
    if (!practice || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest && e.target.closest("input, textarea, select")) return;
    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault();
      pick(Number(e.key) - 1);
    } else if ((e.key === "Enter" || e.key === "ArrowRight") && practice.solved) {
      if (practice.finished) return;
      e.preventDefault();
      advance();
    }
  });

  window.addEventListener("hashchange", route);
  buildNav();
  route();
})();
