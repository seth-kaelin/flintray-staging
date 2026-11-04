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
    links.forEach((a, k) => (k === i ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
    const a = links[i], left = a.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + a.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: left - 24, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  };
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
  // The drawer
  const subject = document.getElementById("verdict-title").textContent;
  // The mark on each tab is the sample company's outcome there; the key under the tabs says so, and screen readers hear it in the tab name
  const MARK = { put: "put forward", named: "mentioned", none: "not named" };
  const matrix = page.querySelector(".matrix");
  const modelsFor = (engine) => matrix.querySelector(`thead th[data-engine="${engine}"]`)?.dataset.models || "";
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
          <div class="set-row"><button type="button" data-step="-1">Previous</button><span class="set-count" data-f="count"></span><button type="button" data-step="1">Next</button></div>
          <p class="set-why" data-f="why"></p>
        </div>
        <div class="drawer-bar">
          <div class="drawer-titles"><h2 class="drawer-title" id="drawer-title" tabindex="-1" data-f="title"></h2><p class="drawer-market" data-f="market"></p></div>
          <button type="button" class="drawer-close" data-close>Close</button>
        </div>
        <div class="drawer-tabs" role="tablist" aria-label="Assistant">${ENGINES.map((x) =>
          `<button type="button" class="drawer-tab" role="tab" id="drawer-tab-${x}" data-engine="${x}" aria-controls="drawer-panel">${NAMES[x]}<span class="visually-hidden" data-outcome></span></button>`).join("")}</div>
        <ul class="drawer-key" aria-hidden="true"><li>${subject}:</li>${Object.entries(MARK).map(([k, v]) => `<li class="key is-${k}">${v}</li>`).join("")}</ul>
      </div>
      <div class="drawer-body" id="drawer-panel" role="tabpanel" tabindex="0"></div>
      <div class="drawer-foot"><a class="drawer-cta" href="${cta.getAttribute("href")}">${cta.textContent}</a></div>
    </section>`;
  document.body.append(root);
  const $ = (s) => root.querySelector(s);
  const panel = $(".drawer-body");
  const tabs = [...root.querySelectorAll(".drawer-tab")];
  const state = { sid: null, engine: null, set: null, index: 0, trigger: null, pushed: false };

  const show = (sid, engine) => {
    const source = bodyFor(sid, engine);
    if (!source) return false;
    state.sid = sid; state.engine = engine;
    const situation = document.getElementById(`situation-${sid}`);
    $('[data-f="title"]').textContent = situation.querySelector(".situation-title").textContent;
    $('[data-f="market"]').textContent = situation.querySelector(".situation-market").textContent;
    tabs.forEach((t) => {
      const on = t.dataset.engine === engine;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      const mark = bodyFor(sid, t.dataset.engine).dataset.state;
      t.className = `drawer-tab is-${mark}`;
      t.querySelector("[data-outcome]").textContent = `, ${subject} ${MARK[mark]}`;
    });
    panel.setAttribute("aria-labelledby", `drawer-tab-${engine}`);
    const copy = source.cloneNode(true);
    copy.removeAttribute("id");
    copy.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    const models = document.createElement("p");
    models.className = "drawer-models";
    models.textContent = modelsFor(engine);
    models.hidden = !models.textContent;
    panel.replaceChildren(models, copy);
    panel.scrollTop = 0;
    if (state.set) {
      const item = state.set.items[state.index];
      const here = item.sid === sid && item.engine === engine;
      $('[data-f="count"]').textContent = `${state.index + 1} of ${state.set.items.length}`;
      const names = { chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini", perplexity: "Perplexity" };
      // Keep the set line when another tab is open, and say which answer is showing
      $('[data-f="why"]').textContent = here ? item.why : `${item.why} You're reading ${names[engine]}'s answer to the same situation.`;
      root.querySelectorAll("[data-step]").forEach((b) => {
        const to = state.index + Number(b.dataset.step);
        b.disabled = to < 0 || to >= state.set.items.length;
      });
    }
    const hash = `#conversation-${sid}-${engine}`;
    if (location.hash !== hash) history.replaceState(history.state, "", hash);
    return true;
  };

  const siblings = () => [...document.body.children].filter((n) => n !== root && n.tagName !== "SCRIPT");
  const open = (sid, engine, { set = null, index = 0, trigger = null } = {}) => {
    state.set = set; state.index = index;
    const setBox = $(".drawer-set");
    setBox.hidden = !set;
    if (set) { $('[data-f="finding"]').textContent = set.title; $('[data-f="note"]').textContent = set.note; }
    const wasOpen = !root.hidden;
    if (!wasOpen) {
      state.trigger = trigger || document.activeElement;
      state.pushed = false;
      if (location.hash !== `#conversation-${sid}-${engine}`) { history.pushState({ sampleDrawer: true }, ""); state.pushed = true; }
    }
    if (!show(sid, engine)) return;
    if (!wasOpen) {
      root.hidden = false;
      panel.scrollTop = 0; // a hidden panel keeps the last conversation's scroll, so reset it once it can scroll
      document.documentElement.classList.add("drawer-open");
      siblings().forEach((n) => { if (!n.inert) { n.inert = true; n.dataset.drawerInert = ""; } });
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("is-open")));
    }
    tabs.find((t) => t.dataset.engine === engine).focus({ preventScroll: true });
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
    if (m && !root.hidden) show(m[1], m[2]);
    else { state.pushed = false; hide(); }
  });

  root.addEventListener("click", (ev) => {
    const t = ev.target.closest("button, a, [data-close]");
    if (!t) return;
    if (t.matches("[data-close]")) { close(); return; }
    if (t.matches(".drawer-tab")) { show(state.sid, t.dataset.engine); return; }
    if (t.matches("[data-step]") && state.set) {
      const to = state.index + Number(t.dataset.step);
      if (to < 0 || to >= state.set.items.length) return;
      state.index = to;
      const item = state.set.items[to];
      show(item.sid, item.engine);
      (t.disabled ? root.querySelector(`[data-step="${-Number(t.dataset.step)}"]`) : t).focus();
      return;
    }
    if (t.matches(".citation")) {
      // A citation points at the source list under its own answer, inside the drawer
      ev.preventDefault();
      const li = panel.querySelector(`[data-src="${t.dataset.cite}"]`);
      if (!li) return;
      li.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
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
      show(state.sid, next.dataset.engine);
      next.focus();
      return;
    }
    if (ev.key === "Tab") {
      // inert keeps focus out of the page; this keeps it cycling inside the drawer
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
  if (linked && bodyFor(linked[1], linked[2])) open(linked[1], linked[2]);
})();
