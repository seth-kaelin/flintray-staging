// FlintRay site script, loaded on every page. No framework, no animation library.

// Phone menu: the header's Menu button opens a full-screen sheet with every route.
(() => {
  const toggle = document.querySelector(".menu-toggle");
  const sheet = document.getElementById("site-menu");
  if (!toggle || !sheet) return;
  const close = sheet.querySelector(".menu-close");
  const setOpen = (open) => {
    sheet.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    document.documentElement.classList.toggle("menu-open", open);
    (open ? sheet.querySelector("nav a") : toggle).focus();
  };
  toggle.addEventListener("click", () => setOpen(true));
  close.addEventListener("click", () => setOpen(false));
  sheet.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  // An in-page link (Pricing on the home page) closes the sheet so the section is visible
  sheet.querySelectorAll("nav a").forEach((a) => a.addEventListener("click", () => {
    if (new URL(a.href).pathname === location.pathname) setOpen(false);
  }));
  matchMedia("(min-width: 1024px)").addEventListener("change", (m) => { if (m.matches && !sheet.hidden) setOpen(false); });
})();

// Motion helpers, shared by the hero and the take-apart. Pure functions: no clocks, no state.
const FR = (() => {
  const clamp = (x) => Math.max(0, Math.min(1, x));
  // CSS cubic-bezier(x1, y1, x2, y2) as a function of progress (bisection on x, so it is exact and deterministic)
  const bezier = (x1, y1, x2, y2) => {
    const at = (a, b, u) => 3 * a * u * (1 - u) * (1 - u) + 3 * b * u * u * (1 - u) + u * u * u;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let lo = 0, hi = 1, u = x;
      for (let i = 0; i < 24; i++) { u = (lo + hi) / 2; if (at(x1, x2, u) < x) lo = u; else hi = u; }
      return at(y1, y2, u);
    };
  };
  return { clamp, bezier, easeOut: (x) => 1 - Math.pow(1 - x, 3), land: bezier(0.2, 0.8, 0.2, 1) };
})();

// The live specimen in the home hero. The server HTML holds the final frame; on load it replays once:
// the buyer's question types, the answer line arrives, each classification stamp lands, the source line
// draws. "next" replays it with the next engine's answer.
// Seekable (MOTION_VIDEO_RULES): renderAt(t) is a pure function of time; ?t=<s> freezes a frame.
// Reduced motion: the final state, no travel. Exact sample text only (embedded by tools/build_site.py from the sample JSON).
(() => {
  const root = document.querySelector("[data-specimen]");
  const json = root && root.querySelector("[data-specimen-json]");
  if (!root || !json) return;
  const D = JSON.parse(json.textContent);
  const $ = (s) => root.querySelector(s);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const frozen = new URLSearchParams(location.search).get("t");
  const phone = matchMedia("(max-width: 760px)");
  const maxLines = () => Number((phone.matches && root.dataset.linesPhone) || root.dataset.lines || 99);
  const CITED_ONLY = root.dataset.sources === "cited";
  // 'One more company is named further down the answer.' (build_site.more_named() says the same)
  const moreNamed = (n) => `${["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"][n] ?? n} more ${n === 1 ? "company is" : "companies are"} named further down the answer.`;
  const ROLE = { recommended: "Recommended", shortlisted: "Shortlisted", mentioned: "Mentioned", cautioned: "Named negatively", none: "Not named" };

  // Beats (seconds; plan() computes them per engine, figures are for the opening answer, Perplexity):
  //   0.00  FRAME 1  the sheet, the faint question, every company name in the verdict and "0 of 60" are on
  //                  the page; the answer line, the stamps and the source line wait. It reads as a form
  //                  about to be filled, never blank.
  //   0.10  COUNT    "6 of 60" counts up over 0.5 s in tabular Geist Mono; the box is fixed, nothing moves
  //   0.25  ASK      the question types at 34 chars/s (capped 1.9 s), the orange caret leading
  //   2.40  ANSWER   (aStart: question end + 0.25) the answer streams at 26 words/s (capped 1.6 s); its source fades up
  //   2.86  TRACE    (lStart: answer end) the source line draws from the end of the [1] line to its source, 0.7 s
  //   3.01  STAMPS   (sStart: answer end + 0.15) each named company's stamp lands, 140 ms apart: 220 ms,
  //                  cubic-bezier(.2,.8,.2,1), scale 1.06 to 1, fading up
  //   3.73  YOU      (yStart) a 300 ms beat after the last stamp's slot (and after the trace ends) the sample
  //                  client's stamp lands last; "Not named" then throws a 1px orange ring that grows
  //                  0 to 6px and fades, 3.86 to 4.26
  //   4.26  HOLD     (end) the final frame, identical to the server HTML and to the reduced-motion state
  // The sheet shows the moment, not the whole conversation: the first lines and the source they cite.
  function view(e) {
    const lines = e.lines.slice(0, maxLines());
    const first = lines.find((l) => l.cites.length);
    const keep = CITED_ONLY ? (first ? [first.cites[0]] : []) : e.sources.map((_, i) => i + 1);
    // Stamp only the companies the visible lines name; count the ones named further down the answer
    const shown = new Set(lines.flatMap((l) => l.names));
    const named = e.named.filter((n) => shown.has(n.name));
    return { ...e, lines, named, later: e.named.length - named.length, sourceIds: keep };
  }

  const STAMP_GAP = 0.14, STAMP_DUR = 0.22, BEAT = 0.3, RING = 0.4, COUNT = [0.1, 0.5];
  function plan(e) {
    const qStart = 0.25, qDur = Math.min(1.9, e.ask.length / 34);
    const words = e.lines.map((l) => l.text.split(" "));
    const total = words.reduce((a, w) => a + w.length, 0);
    const aStart = qStart + qDur + 0.25, aDur = Math.min(1.6, total / 26);
    const rows = e.named.length + 1;
    const lStart = aStart + aDur;
    const sStart = lStart + 0.15;
    const yStart = Math.max(sStart + (rows - 1) * STAMP_GAP + BEAT, lStart + 0.7 + 0.15);
    const ringStart = yStart + STAMP_DUR * 0.6;
    return { qStart, qDur, words, total, aStart, aDur, rows, lStart, sStart, yStart, ringStart, end: ringStart + RING };
  }
  const { clamp, easeOut: ease, land } = FR;
  const countEl = root.querySelector(".base .count");
  const countTo = countEl ? Number(countEl.dataset.count) : 0;
  // The headline figure is the same for every assistant, so it counts up on the opening replay only
  let counting = true;

  let engine = Object.keys(D.engines)[0], P = null, start = null, raf = 0, geom = null;

  function paint(key) {
    const e = view(D.engines[key]);
    root.dataset.engine = key;
    root.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === key)));
    root.querySelectorAll("[data-f=engine]").forEach((n) => (n.textContent = e.label));
    root.querySelectorAll("[data-f=model]").forEach((n) => (n.textContent = e.model));
    $("[data-f=ask-guide]").textContent = "\u201C" + e.ask + "\u201D";
    $("[data-f=ask]").textContent = "\u201C" + e.ask + "\u201D";
    $("[data-f=answer]").innerHTML = e.lines.map((l) => {
      let t = l.text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
      l.names.forEach((n) => (t = t.replace(n, `<b>${n}</b>`)));
      return `<li>${t}</li>`;
    }).join("") || `<li class="none">This engine named no company in its third answer.</li>`;
    const rows = e.named.map((n) => [n.role, n.name]);
    rows.push([e.subjectRole || "none", D.subject]);
    const later = e.later ? `<li class="v-later">${moreNamed(e.later)}</li>` : "";
    $("[data-f=verdict]").innerHTML = rows.map(([role, name], i) =>
      `${name === D.subject ? later : ""}<li class="v-row${name === D.subject ? " is-you" : ""}" data-i="${i}"><span class="v-name">${name}${name === D.subject ? '<span class="v-who">the sample client</span>' : ""}</span><span class="stamp stamp-${role}">${ROLE[role]}</span></li>`).join("");
    $("[data-f=sources]").innerHTML = e.sourceIds.length
      ? e.sourceIds.map((i) => `<li data-src="${i}"><span class="n">[${i}]</span> ${e.sources[i - 1].domain} <span class="kind">${e.sources[i - 1].kind}</span></li>`).join("")
      : `<li class="none">${e.sources.length ? "No source cited in these lines." : "The app showed no sources for this answer."}</li>`;
    P = plan(e);
    measure();
  }

  // The source line: from the first recommended name in the answer to the source its line cites.
  function measure() {
    const e = view(D.engines[engine]);
    const svg = $("svg.trace"), path = svg.querySelector("path");
    const first = e.lines.find((l) => l.cites.length);
    const box = root.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    if (!first) { path.setAttribute("d", ""); geom = null; return; }
    const li = $("[data-f=answer]").children[e.lines.indexOf(first)];
    const s = $(`[data-f=sources] [data-src="${first.cites[0]}"]`);
    if (!li || !s) { path.setAttribute("d", ""); geom = null; return; }
    // From the end of the cited answer line, through the gutter, to its source row: never over text.
    // Anchor on the citation marker itself, e.g. "[1]", not on the line box.
    const marker = `[${first.cites[0]}]`;
    const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
    const range = document.createRange(); let node, end = null;
    while ((node = walker.nextNode())) {
      const at = node.textContent.indexOf(marker);
      if (at >= 0) { range.setStart(node, at); range.setEnd(node, at + marker.length); end = range.getBoundingClientRect(); break; }
    }
    if (!end) { range.selectNodeContents(li); const rs = [...range.getClientRects()]; end = rs[rs.length - 1]; }
    // The marker can sit mid-line ("Trellisec [1], Kontrolo and…"): leave from the end of that visual line,
    // so the trace never runs through the words after it
    range.selectNodeContents(li);
    const row = [...range.getClientRects()].filter((r) => Math.abs(r.top + r.height / 2 - (end.top + end.height / 2)) < end.height / 2);
    if (row.length) end = { top: end.top, height: end.height, right: Math.max(...row.map((r) => r.right)) };
    const c = s.getBoundingClientRect();
    const x1 = end.right - box.left + 10, y1 = end.top - box.top + end.height / 2;
    const x2 = c.left - box.left - 6, y2 = c.top - box.top + c.height / 2;
    const stacked = x2 < x1 || root.dataset.route === "gutter"; // route down the right margin
    // Orthogonal route with rounded corners: along the end of the line, down the gutter, into the source.
    const sheetBox = root.querySelector(".sheet")?.getBoundingClientRect();
    const gx = stacked ? (sheetBox ? sheetBox.right - box.left + 20 : box.width - 7) : x2 - 14, r = root.dataset.route === "gutter" ? 0 : 8, dy = Math.sign(y2 - y1) || 1;
    path.setAttribute("d", stacked
      ? `M${x1} ${y1} H${gx - r} Q${gx} ${y1} ${gx} ${y1 + r * dy} V${y2 - r * dy} Q${gx} ${y2} ${gx - r} ${y2} H${c.right - box.left + 8} M${c.right - box.left + 8} ${y2 - 5} V${y2 + 5}`
      : `M${x1} ${y1} H${gx - r} Q${gx} ${y1} ${gx} ${y1 + r * dy} V${y2 - r * dy} Q${gx} ${y2} ${gx + r} ${y2} H${x2}`);
    geom = path.getTotalLength();
    const dot = svg.querySelector("circle"); if (dot) { dot.setAttribute("cx", x1); dot.setAttribute("cy", y1); }
    path.style.strokeDasharray = `${geom}`;
  }

  function renderAt(t) {
    const e = view(D.engines[engine]);
    const q = Math.round(e.ask.length * clamp((t - P.qStart) / P.qDur));
    const qa = $("[data-f=ask]");
    qa.textContent = "\u201C" + e.ask.slice(0, q) + (q >= e.ask.length ? "\u201D" : "");
    const caret = root.querySelector(".caret");
    if (caret && qa.firstChild) {
      const range = document.createRange();
      range.selectNodeContents(qa);
      const rects = [...range.getClientRects()];
      const last = rects[rects.length - 1], parent = qa.parentElement.getBoundingClientRect();
      if (last) caret.style.transform = `translate(${last.right - parent.left + 3}px, ${last.bottom - parent.top - last.height}px)`;
    }
    root.classList.toggle("is-typing", t < P.aStart);
    let k = Math.round(P.total * clamp((t - P.aStart) / P.aDur));
    $("[data-f=answer]").querySelectorAll("li").forEach((li, i) => {
      const n = P.words[i] ? P.words[i].length : 0;
      const show = Math.min(n, Math.max(0, k));
      k -= n;
      li.style.opacity = n ? String(show / n) : "1";
    });
    // Names are on the page from the start; each classification stamp lands in turn, the sample client's last.
    const vrows = $("[data-f=verdict]").querySelectorAll(".v-row");
    vrows.forEach((row, i) => {
      const last = i === vrows.length - 1;
      const k = clamp((t - (last ? P.yStart : P.sStart + i * STAMP_GAP)) / STAMP_DUR);
      const p = land(k);
      row.toggleAttribute("data-on", k > 0);
      const st = row.querySelector(".stamp");
      st.style.opacity = String(p);
      st.style.transform = k >= 1 ? "" : `scale(${1.06 - 0.06 * p})`;
      // "Not named": a 1px orange ring leaves the stamp, growing to 6px as it fades
      const r = last && st.classList.contains("stamp-none") ? clamp((t - P.ringStart) / RING) : 0;
      st.style.outline = r > 0 && r < 1 ? `1px solid rgb(232 116 59 / ${(1 - r).toFixed(3)})` : "";
      st.style.outlineOffset = r > 0 && r < 1 ? `${(6 * ease(r)).toFixed(2)}px` : "";
    });
    if (countEl) countEl.textContent = String(counting ? Math.round(countTo * ease(clamp((t - COUNT[0]) / COUNT[1]))) : countTo);
    // The cited source arrives with the answer; the trace dot waits for its line.
    const aProg = clamp((t - P.aStart) / P.aDur);
    $("[data-f=sources]").querySelectorAll("li").forEach((li) => (li.style.opacity = String(0.45 + 0.55 * aProg)));
    const dot = root.querySelector("svg.trace circle");
    if (dot) dot.style.opacity = t >= P.lStart ? "1" : "0";
    const path = $("svg.trace path");
    if (geom) path.style.strokeDashoffset = String(geom * (1 - ease(clamp((t - P.lStart) / 0.7))));
    $("[data-f=sources]").classList.toggle("is-lit", t >= P.lStart + 0.5);
  }

  function play() {
    cancelAnimationFrame(raf);
    delete root.dataset.done;
    start = null;
    const frame = (now) => {
      if (start === null) start = now;
      const t = (now - start) / 1000;
      renderAt(Math.min(t, P.end));
      if (t < P.end) raf = requestAnimationFrame(frame); else { root.dataset.done = ""; counting = false; }
    };
    raf = requestAnimationFrame(frame);
  }

  const order = Object.keys(D.engines);
  root.querySelectorAll("[data-next]").forEach((b) => b.addEventListener("click", () => {
    counting = false;
    engine = order[(order.indexOf(engine) + 1) % order.length];
    paint(engine);
    if (reduced) renderAt(P.end); else play();
  }));
  root.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    counting = false;
    engine = b.dataset.tab;
    paint(engine);
    if (reduced) renderAt(P.end); else play();
  }));
  // A resize re-lays the sheet and shows the frame it should be on: the frozen ?t= frame if there is one, else the end
  const settled = () => (frozen !== null ? Number(frozen) : P.end);
  addEventListener("resize", () => { measure(); renderAt(settled()); });
  phone.addEventListener("change", () => { paint(engine); renderAt(settled()); });

  paint(engine);
  if (frozen !== null) { renderAt(Number(frozen)); document.fonts.ready.then(() => { measure(); renderAt(Number(frozen)); }); }
  else if (reduced) { renderAt(P.end); document.fonts.ready.then(() => { measure(); renderAt(P.end); }); }
  else document.fonts.ready.then(() => { measure(); play(); });
})();

// Home, r02. The take-apart's three buyer turns fold to their first lines; the row is the button, named by its own
// callout, and opening it shows the whole turn. Without this script every turn reads in full.
(() => {
  for (const row of document.querySelectorAll(".convo-row.is-fold")) {
    const name = row.querySelector(".callout b");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "fold-toggle";
    button.setAttribute("aria-expanded", "false");
    if (name) button.setAttribute("aria-label", name.textContent);
    button.addEventListener("click", () => {
      const open = row.classList.toggle("is-folded") === false;
      button.setAttribute("aria-expanded", String(open));
      dispatchEvent(new Event("resize"));
    });
    row.classList.add("is-folded");
    row.append(button);
  }
})();

// Home, r02. The plans table on phones: each plan's name becomes a tab and the rows show that plan only
// (pages.css reads data-show). Wider screens ignore data-show and show the whole table.
(() => {
  const plans = document.querySelector("[data-plans]");
  if (!plans) return;
  const heads = [...plans.querySelectorAll("thead h3")];
  const show = (n) => {
    plans.dataset.show = String(n + 1);
    heads.forEach((h, i) => h.firstChild.setAttribute("aria-pressed", String(i === n)));
  };
  heads.forEach((h, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.append(...h.childNodes);
    button.addEventListener("click", () => show(i));
    h.append(button);
  });
  show(0);
})();

// Home, r04. The live preview: the sample report's matrix as a working miniature beside its conversations, one at a
// time, taken apart. The record is a native sideways swipe (scroll-snap, one conversation per snap, data-carousel):
// nothing ever advances on its own and touching it starts no timer. Tapping a tile goes to that conversation; the
// position shows as "24 of 60"; on laptops the prev/next buttons and the arrow keys step through. Each situation line
// opens that conversation in full in the sample report, and each buyer turn still unfolds on a tap.
// The matrix lays out from the inline data at once; the 60 conversations load from assets/sample-preview.json when
// the preview nears the screen, or on the first tap. Exact sample text only (build_site.write_preview).
// No JS: the record shows the showcase conversation and the matrix is a still image of itself.
(() => {
  const root = document.querySelector("[data-preview]");
  const index = root && root.querySelector("[data-pv-index]");
  const inline = index && index.querySelector("[data-pv-matrix]");
  const first = root && root.querySelector("[data-takeapart]");
  if (!inline || !first) return;
  const M = JSON.parse(inline.textContent);
  // One outcome code on every page (r06/TOKENS.md): each cell carries its own outcome's class
  const STATE = { recommended: "recommended", shortlisted: "shortlisted", mentioned: "mentioned", cautioned: "cautioned", none: "none" };
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const order = M.scenarios.flatMap((s) => M.engines.map(([key]) => ({ sid: s.id, engine: key })));
  const total = order.length;
  const at = (sid, engine) => order.findIndex((o) => o.sid === sid && o.engine === engine);

  // The matrix
  const grid = document.createElement("div");
  grid.className = "pv-grid";
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-label", `${M.subject}, ${M.engines.map((e) => e[1]).join(", ")}`);
  let html = `<div class="pv-mk" aria-hidden="true"></div>` + M.engines.map(([, n]) => `<div class="pv-h">${esc(n)}</div>`).join("");
  for (const s of M.scenarios) {
    // r06: each row names its situation in words (editorial's index), not its market
    html += `<div class="pv-mk" title="${esc(s.title)}"><span>${esc(s.title)}</span></div>`;
    html += s.roles.map((role, i) => {
      const [key, name] = M.engines[i];
      return `<button type="button" class="pv-cell is-${STATE[role]}" data-sid="${s.id}" data-engine="${key}" data-col="${i + 1}" aria-pressed="false"
        aria-label="${esc(`${name}, ${s.title}, ${s.market}: ${M.subject} ${M.stamps[role]}`)}"><span class="pv-w">${esc(M.stamps[role])}</span></button>`;
    }).join("");
  }
  grid.innerHTML = html;
  // Phones (pages.css): one assistant's column at a time, chosen by these tabs, so every cell reads its outcome in
  // words at 14px. Wider screens hide the tabs and show all four columns.
  const tabs = document.createElement("div");
  tabs.className = "pv-tabs";
  tabs.setAttribute("role", "group");
  tabs.innerHTML = M.engines.map(([, n], i) => `<button type="button" data-col="${i + 1}" aria-pressed="false">${esc(n)}</button>`).join("");
  const showCol = (n) => {
    grid.dataset.show = String(n);
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.col === String(n))));
  };
  tabs.addEventListener("click", (ev) => { const b = ev.target.closest("button"); if (b) showCol(Number(b.dataset.col)); });
  showCol(Math.max(1, M.engines.findIndex((e) => e[0] === M.show[1]) + 1));
  const box = document.createElement("div");
  box.className = "pv-index-in";
  box.append(tabs, grid);
  index.replaceChildren(box);
  const cells = [...grid.querySelectorAll(".pv-cell")];

  // The record: a track of 60 slides, the server-rendered showcase conversation in its own place
  const holder = first.closest(".takeapart-pin") || first;
  const pane = holder.parentElement;
  const template = first.cloneNode(true);
  template.querySelectorAll(".fold-toggle").forEach((b) => b.remove());
  template.querySelectorAll(".is-folded").forEach((r) => r.classList.remove("is-folded"));
  const nav = document.createElement("div");
  nav.className = "pv-nav";
  nav.innerHTML = `<button type="button" class="pv-step" data-step="-1" aria-label="Previous">‹</button><p class="pv-pos" aria-live="polite"></p><button type="button" class="pv-step" data-step="1" aria-label="Next">›</button>`;
  const track = document.createElement("div");
  track.className = "pv-track";
  track.dataset.carousel = "";
  track.tabIndex = 0;
  track.setAttribute("role", "region");
  track.setAttribute("aria-label", M.subject);
  const slides = order.map(() => { const d = document.createElement("div"); d.className = "pv-slide"; return d; });
  const start = Math.max(0, at(M.show[0], M.show[1]));
  slides[start].append(holder);
  slides.forEach((d, i) => { if (i === start) track.append(d); });
  pane.replaceChildren(nav, track);
  root.classList.add("is-live");

  const fold = (convo) => {
    for (const row of convo.querySelectorAll(".convo-row.is-fold")) {
      if (row.querySelector(".fold-toggle")) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "fold-toggle";
      button.setAttribute("aria-expanded", "false");
      const name = row.querySelector(".callout b");
      if (name) button.setAttribute("aria-label", name.textContent);
      button.addEventListener("click", () => button.setAttribute("aria-expanded", String(row.classList.toggle("is-folded") === false)));
      row.classList.add("is-folded");
      row.append(button);
    }
  };
  // The situation line opens the whole conversation in the sample report (its drawer)
  const linkSituation = (convo, sid, engine) => {
    const line = convo.querySelector(".convo-row .meta-line");
    if (!line || line.querySelector("a")) return;
    const a = document.createElement("a");
    a.className = "pv-open";
    a.href = `sample-report.html#conversation-${sid}-${engine}`;
    a.append(...line.childNodes);
    line.append(a);
  };
  linkSituation(first, M.show[0], M.show[1]);

  let data = null, loading = null, built = false;
  const fill = (convo, sid, engine) => {
    const s = data.scenarios.find((x) => x.id === sid), c = s && s.c[engine];
    if (!c) return;
    const rows = [...convo.querySelectorAll(".convo-row")];
    const part = (i, sel) => rows[i] && rows[i].querySelector(sel);
    const name = M.engines.find((e) => e[0] === engine)[1];
    part(0, ".meta-line").textContent = `${s.title}, ${s.market}`;
    [1, 2, 3].forEach((i) => { const r = part(i, ".record"); if (r) r.textContent = c.prompts[i - 1] || ""; });
    part(4, ".meta-line").textContent = `${name}, ${c.model || data.notShown}`;
    part(5, ".record").innerHTML = c.lines.length ? c.lines.map((l) => {
      let t = esc(l.text);
      l.names.forEach((n) => (t = t.replace(esc(n), `<b>${esc(n)}</b>`)));
      return `<p data-quote>${t}</p>`;
    }).join("") : `<p data-quote>This engine named no company in its third answer.</p>`;
    part(6, ".order").innerHTML = c.order.concat([[data.subject, c.role]]).map(([n, role]) =>
      `<li${n === data.subject ? ' class="is-you"' : ""}><span>${esc(n)}</span><span class="stamp stamp-${role}">${esc(data.stamps[role])}</span></li>`).join("");
    part(7, ".srcs").innerHTML = c.sources.length
      ? c.sources.map(([d, k], i) => `<li data-src="${i + 1}"><span class="n">[${i + 1}]</span> ${esc(d)}, ${esc(k)}</li>`).join("")
      : `<li>The app showed no sources for this answer.</li>`;
  };
  // Every conversation, built once the data is in: each slide a copy of the record in the same shape
  const build = () => {
    if (built || !data) return;
    built = true;
    const keep = track.scrollLeft;
    track.replaceChildren(...slides);
    order.forEach(({ sid, engine }, i) => {
      if (i === start) return;
      const convo = template.cloneNode(true);
      fill(convo, sid, engine);
      linkSituation(convo, sid, engine);
      fold(convo);
      slides[i].append(convo);
    });
    track.scrollLeft = keep + start * track.clientWidth;
    mark(start);
  };
  const load = () => loading || (loading = fetch("assets/sample-preview.json").then((r) => r.json()).then((d) => { data = d; build(); }).catch(() => { loading = null; }));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); load(); } }, { rootMargin: "800px 0px" });
    io.observe(root);
  }

  // r10.1: the track is as tall as the conversation showing, at every width, so the quote, the order and the sources
  // read on the page with no inner scroll. It follows the conversation as it changes (a swipe, a step, a turn unfolding).
  const fit = () => {
    const convo = slides[current] && slides[current].firstElementChild;
    if (convo && convo.offsetHeight) track.style.height = `${convo.offsetHeight}px`;
  };
  const sized = "ResizeObserver" in window ? new ResizeObserver(() => fit()) : null;
  if (sized) slides.forEach((d) => sized.observe(d));

  // Where the track is: the tile pressed, the count, the steps at either end
  let current = start;
  const pos = nav.querySelector(".pv-pos");
  const steps = [...nav.querySelectorAll(".pv-step")];
  const mark = (i) => {
    current = i;
    const o = order[i];
    cells.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sid === o.sid && b.dataset.engine === o.engine)));
    pos.textContent = `${i + 1} of ${total}`;
    if (getComputedStyle(tabs).display !== "none") showCol(M.engines.findIndex((e) => e[0] === o.engine) + 1);
    steps[0].disabled = !built || i === 0;
    steps[1].disabled = !built || i === total - 1;
    fit();
  };
  mark(start);
  // r10.1, phones: the record waits for a tap, so every tile carries a disclosure mark (pages.css), and the tile of the
  // conversation the record holds rings once as it comes up the screen. Reduced motion: the marks only.
  const pressed = cells.find((b) => b.getAttribute("aria-pressed") === "true");
  if (pressed && "IntersectionObserver" in window && !reduced()) {
    const cue = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      cue.disconnect();
      pressed.classList.add("is-cued");
    }, { rootMargin: "0px 0px -35% 0px" });
    cue.observe(pressed);
  }
  let ticking = false;
  track.addEventListener("scroll", () => {
    if (!built || ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const i = Math.max(0, Math.min(total - 1, Math.round(track.scrollLeft / track.clientWidth)));
      if (i !== current) mark(i);
    });
  }, { passive: true });
  const go = (i, smooth = true) => {
    if (!built) return;
    i = Math.max(0, Math.min(total - 1, i));
    track.scrollTo({ left: i * track.clientWidth, behavior: smooth && !reduced() && Math.abs(i - current) <= 3 ? "smooth" : "auto" });
    mark(i);
  };
  addEventListener("resize", () => { if (built) track.scrollLeft = current * track.clientWidth; });
  nav.addEventListener("click", (ev) => { const b = ev.target.closest(".pv-step"); if (b) go(current + Number(b.dataset.step)); });
  track.addEventListener("keydown", (ev) => {
    if (ev.target !== track) return;
    const d = { ArrowRight: 1, ArrowLeft: -1 }[ev.key];
    if (d) { ev.preventDefault(); go(current + d); }
  });
  grid.addEventListener("click", async (ev) => {
    const cell = ev.target.closest(".pv-cell");
    if (!cell) return;
    // Phones keep the record closed until a cell is tapped (pages.css), so the preview never stands between
    // the visitor and the form; the first tap opens it on that conversation
    const opening = !root.classList.contains("is-open");
    root.classList.add("is-open");
    await load();
    go(at(cell.dataset.sid, cell.dataset.engine), !opening);
    // Stacked (phones and tablets), bring the record up if it is below the screen
    const top = pane.getBoundingClientRect().top;
    if (getComputedStyle(root.querySelector(".pv-window")).gridTemplateColumns.split(" ").length === 1 && top > innerHeight * 0.7) {
      scrollTo({ top: scrollY + top - parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop || 0), behavior: reduced() ? "auto" : "smooth" });
    }
  });
  grid.addEventListener("keydown", (ev) => {
    const cell = ev.target.closest(".pv-cell");
    const one = getComputedStyle(tabs).display !== "none";
    const move = one ? { ArrowDown: 4, ArrowUp: -4 }[ev.key] : { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 4, ArrowUp: -4 }[ev.key];
    if (!cell || !move) return;
    const next = cells[cells.indexOf(cell) + move];
    if (next) { ev.preventDefault(); next.focus(); }
  });
})();

// r04. Scroll reveals for the counted figures, home and the sample report: as a figure group first comes well on
// screen, its numbers count up from zero, its bars draw from zero to their value and the conversation marks wipe in
// from the left, once, over 0.36 s (ease-out; the process line over 0.9 s). State is a pure function of the time since that group arrived (no
// timers); a group already on screen at load, reduced motion and no JS all show the final state from frame 1.
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const groups = [...document.querySelectorAll("[data-reveal]")].filter((g) => g.getBoundingClientRect().top > innerHeight);
  if (!groups.length) return;
  // r06: the method's thread lays itself step to step over 2.7 s, 450 ms a step
  const DUR = 360, ease = FR.easeOut, dur = (g) => (g.matches(".g-thread") ? 2700 : g.matches(".fa-steps") ? 900 : DUR);
  const parts = (g) => ({
    nums: [...g.querySelectorAll("[data-count]")].map((n) => [n, Number(n.dataset.count)]),
    bars: [...g.querySelectorAll(".fa-bar i, .pick-bar, .src-bar span")],
    marks: [...g.querySelectorAll(".fa-tally")],
    // The process line (home): it draws itself from the first step to the last, each step's mark landing as the
    // line reaches it, like a thread being laid (kurrent.io's idea, not its look)
    steps: g.matches(".fa-steps") ? [...g.children] : [...g.querySelectorAll(".fa-steps > li")],
    // r06: the threads above the steps (navy's idea): each strand draws over its own share of the arrival
    draws: [...g.querySelectorAll("[data-draw]")].map((d) => [d, Number(d.dataset.from), Number(d.dataset.to)]),
  });
  const paint = (p, k) => {
    const e = ease(k);
    p.nums.forEach(([n, to]) => (n.textContent = String(Math.round(to * e))));
    p.bars.forEach((b) => (b.style.transform = k >= 1 ? "" : `scaleX(${e})`));
    p.marks.forEach((m) => (m.style.clipPath = k >= 1 ? "" : `inset(0 ${(1 - e) * 100}% 0 0)`));
    p.draws.forEach(([d, from, to]) => {
      d.style.strokeDashoffset = k >= 1 ? "" : String(1 - ease(Math.max(0, Math.min(1, (k - from) / (to - from)))));
    });
    const n = p.steps.length;
    p.steps.forEach((li, i) => {
      if (k >= 1) { li.style.removeProperty("--rv"); li.style.removeProperty("--rd"); return; }
      li.style.setProperty("--rv", String(Math.max(0, Math.min(1, k * n - i))));
      li.style.setProperty("--rd", String(Math.max(0, Math.min(1, (k * n - i) * 4))));
    });
  };
  // A group starts the moment its top edge is on screen; one already scrolled past (a jump, a link) shows its
  // final state at once, so no figure is ever left at zero
  const pending = new Set(groups);
  const run = (g) => {
    const p = parts(g);
    let t0 = null;
    const frame = (now) => {
      if (t0 === null) t0 = now;
      const k = Math.min(1, (now - t0) / dur(g));
      paint(p, k);
      if (k < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  const check = () => {
    for (const g of pending) {
      const r = g.getBoundingClientRect();
      if (r.top > innerHeight - 24) continue;
      pending.delete(g);
      if (r.bottom < 0) paint(parts(g), 1); else run(g);
    }
    if (!pending.size) removeEventListener("scroll", onScroll);
  };
  let queued = false;
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; check(); }); } };
  for (const g of groups) {
    const p = parts(g);
    p.bars.forEach((b) => (b.style.transformOrigin = "0 50%"));
    paint(p, 0);
  }
  addEventListener("scroll", onScroll, { passive: true });
})();
