// The sample report's interactions, loaded only on sample-report.html. No framework.
// Without this file every section and conversation still reads in place (tools/build_sample.py renders them all).
// With it: the section bar marks where you are, and matrix cells and finding buttons open a conversation drawer
// (assistant tabs, three turns, the companies named, the sources) that works by touch and keyboard.
(() => {
  const page = document.querySelector(".sample-page");
  if (!page) return;
  const ENGINES = ["chatgpt", "claude", "gemini", "perplexity"];
  const NAMES = { chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini", perplexity: "Perplexity" };
  const bodyFor = (sid, engine) => document.getElementById(`conversation-${sid}-${engine}`);
  // r06, the LCP trim: the 60 conversations in full (assets/sample-convos.js, 470KB) load once the page has loaded,
  // so the first paint never waits on them. Anything that opens a conversation before they arrive waits for them.
  const convos = new Promise((done) => {
    const host = document.querySelector("[data-convos]");
    if (!host) { done(); return; }
    const load = () => {
      const s = document.createElement("script");
      s.src = host.dataset.convos;
      s.onload = s.onerror = () => done();
      document.body.append(s);
    };
    if (document.readyState === "complete") load(); else addEventListener("load", load, { once: true });
  });

  // The section bar sits under the site header when the header is pinned
  const nav = document.querySelector("body > header.site-nav");
  const jump = page.querySelector(".jump");
  const measure = () => {
    const pos = nav ? getComputedStyle(nav).position : "static";
    page.style.setProperty("--sample-top", pos === "sticky" || pos === "fixed" ? `${nav.offsetHeight}px` : "0px");
  };
  measure();
  addEventListener("resize", measure);

  // Where you are: the last section whose top has passed under the bar
  const links = [...jump.querySelectorAll("ul a")];
  const sections = links.map((a) => document.getElementById(a.hash.slice(1)));
  const strip = jump.querySelector("ul");
  let current = null, ticking = false;
  const mark = () => {
    ticking = false;
    const line = jump.getBoundingClientRect().bottom + 24;
    let i = 0;
    sections.forEach((s, k) => { if (s && s.getBoundingClientRect().top <= line) i = k; });
    if (i === current) return;
    current = i;
    here.textContent = links[i].textContent;
    links.forEach((a, k) => (k === i ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
    const a = links[i], left = a.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + a.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: left - 24, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  };
  // On phones the bar is one slim row: the current section, which opens the full list, and the main action
  const here = document.createElement("button");
  here.type = "button"; here.className = "jump-here";
  here.setAttribute("aria-expanded", "false"); here.setAttribute("aria-controls", strip.id);
  jump.prepend(here);
  jump.classList.add("has-menu");
  const openMenu = (on) => { jump.classList.toggle("is-open", on); here.setAttribute("aria-expanded", String(on)); };
  here.addEventListener("click", () => openMenu(!jump.classList.contains("is-open")));
  strip.addEventListener("click", (e) => { if (e.target.closest("a")) openMenu(false); });
  document.addEventListener("click", (e) => { if (!jump.contains(e.target)) openMenu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && jump.classList.contains("is-open")) { openMenu(false); here.focus(); } });
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(mark); } }, { passive: true });
  mark();

  // The bar scrolls sideways on phones: an edge with more sections past it fades and shows a 44px arrow that scrolls it
  const arrow = (dir, label, glyph) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = `jump-more jump-more-${dir}`; b.textContent = glyph; b.hidden = true;
    b.setAttribute("aria-label", label);
    b.addEventListener("click", () => strip.scrollBy({ left: (dir === "end" ? 1 : -1) * strip.clientWidth * 0.7, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
    return b;
  };
  const back = arrow("start", "Earlier sections", "\u2039"), more = arrow("end", "More sections", "\u203A");
  strip.before(back); strip.after(more);
  const edges = () => {
    const atStart = strip.scrollLeft <= 1, atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1;
    strip.classList.toggle("more-start", !atStart);
    strip.classList.toggle("more-end", !atEnd);
    back.hidden = atStart; more.hidden = atEnd;
  };
  strip.addEventListener("scroll", edges, { passive: true });
  addEventListener("resize", edges);
  edges();

  // ---------------------------------------------------------------------------
  // The drawer. r04 (Seth, Nov 4): one conversation at a time, so it swipes. r10.1: it opens with focus on the
  // conversation, so ← and → step conversations at once; the tab row keeps its own arrow keys only while it has focus. Its body is a native sideways scroller
  // (scroll-snap, one conversation per snap, data-carousel) through the conversations it was opened on: a finding's
  // set, or all 60 in the matrix's order. Nothing advances on its own and touching it starts no timer. The position
  // ("3 of 60") and Previous and Next stay in the head; the arrow keys step on laptops; the tabs jump to another
  // assistant's answer to the same situation. Each slide is a copy of the conversation's markup in the page.
  const subject = document.getElementById("verdict-title").textContent;
  const MARK = { put: "put forward", named: "mentioned", none: "not named" };
  const matrix = page.querySelector(".matrix");
  const ALL = [...matrix.tBodies[0].rows].flatMap((row) => [...row.querySelectorAll("a.cell")].map((c) => ({ sid: c.dataset.sid, engine: c.dataset.engine })));
  const cta = document.querySelector(".jump-cta");
  const root = document.createElement("div");
  root.className = "drawer-root";
  root.hidden = true;
  root.innerHTML = `<div class="drawer-scrim" data-close></div>
    <section class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div class="drawer-head">
        <div class="drawer-set" hidden>
          <p class="set-finding">Conversations behind <strong data-f="finding"></strong></p>
          <p class="set-note" data-f="note"></p>
          <p class="set-why" data-f="why"></p>
        </div>
        <div class="drawer-bar">
          <div class="drawer-titles"><h2 class="drawer-title" id="drawer-title" tabindex="-1" data-f="title"></h2><p class="drawer-market" data-f="market"></p></div>
          <button type="button" class="drawer-close" data-close>Close</button>
        </div>
        <div class="set-row"><button type="button" data-step="-1">Previous</button><span class="set-count" data-f="count" aria-live="polite"></span><button type="button" data-step="1">Next</button></div>
        <div class="drawer-tabs" role="tablist" aria-label="Assistant">${ENGINES.map((x) =>
          `<button type="button" class="drawer-tab" role="tab" id="drawer-tab-${x}" data-engine="${x}" aria-controls="drawer-panel">${NAMES[x]}<span class="visually-hidden" data-outcome></span></button>`).join("")}</div>
        <ul class="drawer-key" aria-hidden="true"><li>${subject}:</li>${Object.entries(MARK).map(([k, v]) => `<li class="key is-${k}">${v}</li>`).join("")}</ul>
      </div>
      <div class="drawer-body" id="drawer-panel" role="tabpanel" tabindex="0" data-carousel></div>
      <div class="drawer-foot"><a class="drawer-cta" href="${cta.getAttribute("href")}">${cta.textContent}</a></div>
    </section>`;
  document.body.append(root);
  const $ = (s) => root.querySelector(s);
  const panel = $(".drawer-body");
  const tabs = [...root.querySelectorAll(".drawer-tab")];
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = { list: ALL, index: 0, set: null, trigger: null, pushed: false, slides: [] };
  const item = () => state.list[state.index];

  // The slides: one per conversation in the list, filled with a copy of its markup when it is near the one showing.
  // r10.1: each conversation states its own model ("Answered by …"), so the slide no longer repeats the assistant's
  // model line above it. On phones the situation's title opens the slide and scrolls away with it (sample.css), so the
  // head keeps only the controls.
  const layout = () => {
    state.slides = state.list.map(() => { const d = document.createElement("div"); d.className = "drawer-slide"; return d; });
    panel.replaceChildren(...state.slides);
  };
  const fillSlide = (i) => {
    const slide = state.slides[i], it = state.list[i];
    if (!slide || slide.childElementCount || !it) return;
    const source = bodyFor(it.sid, it.engine);
    if (!source) return;
    const copy = source.cloneNode(true);
    copy.removeAttribute("id");
    copy.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    const situation = document.getElementById(`situation-${it.sid}`);
    const title = document.createElement("p");
    title.className = "drawer-slide-title";
    title.setAttribute("aria-hidden", "true");
    title.innerHTML = `<span></span> <span class="drawer-slide-market"></span>`;
    title.firstChild.textContent = situation.querySelector(".situation-title").textContent;
    title.lastChild.textContent = situation.querySelector(".situation-market").textContent;
    slide.append(title, copy);
  };

  // What the head says for the conversation showing
  const markAt = (i) => {
    state.index = i;
    [i - 1, i, i + 1].forEach(fillSlide);
    const { sid, engine } = item();
    const situation = document.getElementById(`situation-${sid}`);
    $('[data-f="title"]').textContent = situation.querySelector(".situation-title").textContent;
    $('[data-f="market"]').textContent = situation.querySelector(".situation-market").textContent;
    tabs.forEach((t) => {
      const on = t.dataset.engine === engine;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      const m = bodyFor(sid, t.dataset.engine).dataset.state;
      t.className = `drawer-tab is-${m}`;
      t.querySelector("[data-outcome]").textContent = `, ${subject} ${MARK[m]}`;
    });
    panel.setAttribute("aria-labelledby", `drawer-tab-${engine}`);
    const focused = document.activeElement;
    if (focused && focused.matches(".drawer-tab") && focused.dataset.engine !== engine) panel.focus({ preventScroll: true });
    $('[data-f="count"]').textContent = `${i + 1} of ${state.list.length}`;
    root.querySelectorAll("[data-step]").forEach((b) => {
      const to = i + Number(b.dataset.step);
      b.disabled = to < 0 || to >= state.list.length;
    });
    if (state.set) $('[data-f="why"]').textContent = state.list[i].why || "";
    const hash = `#conversation-${sid}-${engine}`;
    if (location.hash !== hash) history.replaceState(history.state, "", hash);
  };
  // A step or a tab scrolls the track to its conversation; until it lands there, the scroll it causes never marks the
  // conversations it passes (a finger or a wheel takes over at once)
  let landing = null;
  const go = (i, smooth = true) => {
    i = Math.max(0, Math.min(state.list.length - 1, i));
    fillSlide(i);
    landing = Math.abs(panel.scrollLeft - i * panel.clientWidth) < 2 ? null : i;
    panel.scrollTo({ left: i * panel.clientWidth, behavior: smooth && !reduced() && Math.abs(i - state.index) <= 2 ? "smooth" : "auto" });
    markAt(i);
  };
  ["touchstart", "wheel", "pointerdown"].forEach((t) => panel.addEventListener(t, () => (landing = null), { passive: true }));
  let sliding = false;
  panel.addEventListener("scroll", () => {
    if (sliding || root.hidden) return;
    sliding = true;
    requestAnimationFrame(() => {
      sliding = false;
      const i = Math.max(0, Math.min(state.list.length - 1, Math.round(panel.scrollLeft / panel.clientWidth)));
      if (landing !== null) { if (Math.abs(panel.scrollLeft - landing * panel.clientWidth) < 2) landing = null; return; }
      if (i !== state.index) markAt(i);
    });
  }, { passive: true });
  addEventListener("resize", () => { if (!root.hidden) panel.scrollLeft = state.index * panel.clientWidth; });

  const siblings = () => [...document.body.children].filter((n) => n !== root && n.tagName !== "SCRIPT");
  const open = (sid, engine, opts) => convos.then(() => openNow(sid, engine, opts));
  const openNow = (sid, engine, { set = null, index = 0, trigger = null } = {}) => {
    if (!bodyFor(sid, engine)) return;
    state.set = set;
    state.list = set ? set.items : ALL;
    const setBox = $(".drawer-set");
    setBox.hidden = !set;
    if (set) { $('[data-f="finding"]').textContent = set.title; $('[data-f="note"]').textContent = set.note; }
    const wasOpen = !root.hidden;
    if (!wasOpen) {
      state.trigger = trigger || document.activeElement;
      state.pushed = false;
      if (location.hash !== `#conversation-${sid}-${engine}`) { history.pushState({ sampleDrawer: true }, ""); state.pushed = true; }
    }
    layout();
    const i = set ? index : Math.max(0, ALL.findIndex((o) => o.sid === sid && o.engine === engine));
    if (!wasOpen) {
      root.hidden = false;
      document.documentElement.classList.add("drawer-open");
      siblings().forEach((n) => { if (!n.inert) { n.inert = true; n.dataset.drawerInert = ""; } });
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("is-open")));
    }
    state.index = i;
    go(i, false);
    if (!wasOpen) panel.focus({ preventScroll: true });
  };
  // A tab: the same situation, another assistant. Inside a finding's set it stays in the set when that answer is in
  // it; otherwise the drawer moves to the matrix's order of all 60, so swiping still walks the whole report.
  const toEngine = (engine) => {
    const { sid } = item();
    const inList = state.list.findIndex((o) => o.sid === sid && o.engine === engine);
    if (inList >= 0) { go(inList); return; }
    open(sid, engine);
  };

  const hide = () => {
    if (root.hidden) return;
    root.classList.remove("is-open");
    root.hidden = true;
    document.documentElement.classList.remove("drawer-open");
    siblings().forEach((n) => { if ("drawerInert" in n.dataset) { n.inert = false; delete n.dataset.drawerInert; } });
    if (state.trigger && state.trigger.isConnected) state.trigger.focus({ preventScroll: true });
  };
  const close = () => {
    if (state.pushed) { state.pushed = false; history.back(); return; } // popstate hides it
    history.replaceState(history.state, "", location.pathname + location.search);
    hide();
  };
  addEventListener("popstate", () => {
    const m = location.hash.match(/^#conversation-([A-Za-z0-9]+)-([a-z]+)$/);
    if (m && !root.hidden) {
      const i = state.list.findIndex((o) => o.sid === m[1] && o.engine === m[2]);
      if (i >= 0) go(i, false);
    } else { state.pushed = false; hide(); }
  });

  root.addEventListener("click", (ev) => {
    const t = ev.target.closest("button, a, [data-close]");
    if (!t) return;
    if (t.matches("[data-close]")) { close(); return; }
    if (t.matches(".drawer-tab")) { toEngine(t.dataset.engine); return; }
    if (t.matches("[data-step]")) {
      go(state.index + Number(t.dataset.step));
      (t.disabled ? root.querySelector(`[data-step="${-Number(t.dataset.step)}"]`) : t).focus();
      return;
    }
    if (t.matches(".citation")) {
      // A citation points at the source list under its own answer, inside the slide it sits in
      ev.preventDefault();
      const li = t.closest(".drawer-slide")?.querySelector(`[data-src="${t.dataset.cite}"]`);
      if (!li) return;
      li.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduced() ? "auto" : "smooth" });
      li.classList.add("is-flash");
      setTimeout(() => li.classList.remove("is-flash"), 1400);
      return;
    }
    if (t.matches("a[href^='#']")) hide(); // a source link leaves the drawer for the page's source table
  });

  root.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") { ev.preventDefault(); close(); return; }
    const tab = ev.target.closest(".drawer-tab");
    if (tab) {
      const i = tabs.indexOf(tab);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[ev.key];
      if (to === undefined) return;
      ev.preventDefault();
      const next = tabs[(to + tabs.length) % tabs.length];
      toEngine(next.dataset.engine);
      next.focus();
      return;
    }
    // Arrow keys on the conversation step to the previous or next one
    if ((ev.key === "ArrowRight" || ev.key === "ArrowLeft") && ev.target.closest(".drawer-body, .drawer-slide, .drawer-head") && !ev.target.matches("input, textarea")) {
      ev.preventDefault();
      go(state.index + (ev.key === "ArrowRight" ? 1 : -1));
      return;
    }
    if (ev.key === "Tab") {
      const focusable = [...root.querySelectorAll("button:not([disabled]), a[href], [tabindex='0']")].filter((n) => n.getClientRects().length && n.tabIndex >= 0);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });

  // ---------------------------------------------------------------------------
  // What opens it: matrix cells, finding buttons and their conversation rows
  matrix.addEventListener("click", (ev) => {
    const cell = ev.target.closest("a.cell");
    if (!cell) return;
    ev.preventDefault();
    open(cell.dataset.sid, cell.dataset.engine, { trigger: cell });
  });
  matrix.addEventListener("keydown", (ev) => {
    const cell = ev.target.closest("tbody a.cell");
    const move = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[ev.key];
    if (!cell || !move) return;
    const rows = [...matrix.tBodies[0].rows];
    const r = rows.indexOf(cell.closest("tr")), c = cell.closest("td").cellIndex;
    const target = rows[r + move[0]]?.cells[c + move[1]]?.querySelector("a.cell");
    if (target) { ev.preventDefault(); target.focus(); }
  });

  page.querySelectorAll(".finding").forEach((finding) => {
    const rows = [...finding.querySelectorAll(".evidence-row")];
    const set = {
      title: finding.querySelector("h3").textContent,
      note: finding.querySelector(".evidence-note")?.textContent || "",
      items: rows.map((a) => ({ sid: a.dataset.sid, engine: a.dataset.engine, why: a.querySelector(".ev-why").textContent })),
    };
    const button = finding.querySelector(".evidence-open");
    button.setAttribute("aria-haspopup", "dialog");
    button.addEventListener("click", (ev) => {
      ev.preventDefault();
      open(set.items[0].sid, set.items[0].engine, { set, index: 0, trigger: button });
    });
    rows.forEach((a, index) => a.addEventListener("click", (ev) => {
      ev.preventDefault();
      open(a.dataset.sid, a.dataset.engine, { set, index, trigger: a });
    }));
  });

  // A shared link to one conversation opens it
  const linked = location.hash.match(/^#conversation-([A-Za-z0-9]+)-([a-z]+)$/);
  if (linked) open(linked[1], linked[2]);
})();
