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

// The take-apart record on home. At 1024 and up, with motion allowed, the record pins (page-motion.css:
// .takeapart-pin adds a 100vh spacer to its track and the record sticks with its foot near the viewport's), and scroll
// position alone draws it. No timers: render() is a pure function of where the record sits in the viewport.
//   approach  the record scrolls up into view; each buyer turn brightens (opacity .35 to 1) as its top
//             rises from 85% to 40% of the viewport, so it brightens while it is being read
//   pin, by pin progress q (0 when the record's foot reaches its sticky line, 1 when the track ends).
//   While a beat plays, the rows it isn't about dim to 0.3, so the eye goes to the row that is changing:
//     0.00-0.05  FOCUS    every row except Order dims (1 to 0.3)
//     0.00-0.40  STAMPS   the order stamps land, 0.06 apart over 0.10 each, cubic-bezier(.2,.8,.2,1), scale
//                         1.06 to 1; the subject's "Not named" lands last, after a beat of 0.08
//     0.38-0.44  HANDOFF  Order dims; Quote and Sources come up (0.3 to 1)
//     0.42-0.74  TRACE    the source line draws from the end of the [1] marker's visual line to its source row;
//                         the cited source's underline arrives as the line reaches it, 0.70-0.76
//     0.74-0.78  JOIN     Order comes back up beside Quote and Sources, so the three rows the payoff needs are lit
//     0.78-0.90  OUTLINE  the subject's row takes its 1px orange outline (offset settles 8px to 3px)
//     0.90-0.96  RELEASE  the other rows come back up (0.3 to 1)
//     0.96-1.00  HOLD     the final state: the trace, the underlined source and the "Not named" outline together,
//                         every row at full strength; then the record scrolls on
// Anywhere else (track below the viewport, phones, reduced motion, no JS) the record shows that final state.
(() => {
  const track = document.querySelector(".takeapart-pin");
  const convo = track && track.querySelector("[data-takeapart]");
  if (!convo) return;
  const svg = convo.querySelector(".takeapart-trace");
  const path = svg && svg.querySelector("path");
  const turns = [...convo.querySelectorAll(".record.buyer")];
  const stamps = [...convo.querySelectorAll(".order .stamp")];
  const you = convo.querySelector(".order li.is-you");
  const srcList = convo.querySelector(".sources-row [data-cited-source]");
  const cited = srcList && srcList.querySelector(`[data-src="${srcList.dataset.citedSource}"]`);
  if (cited) cited.classList.add("is-cited");
  // Each row's part in the beats: the order row, the two rows the trace joins, or context
  const rows = [...convo.querySelectorAll(".convo-row")].map((el) => ({
    el, part: el.querySelector(".order") ? "order" : el.matches(".quote-row, .sources-row") ? "trace" : "context",
  }));
  const DIM = 0.3;
  const pinning = matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
  const { clamp, easeOut, land } = FR;
  const span = (q, a, b) => clamp((q - a) / (b - a));
  let length = 0, raf = 0;

  function citationRect(row) {
    const marker = row.querySelector(".record");
    if (!marker) return null;
    const walker = document.createTreeWalker(marker, NodeFilter.SHOW_TEXT);
    const range = document.createRange(); let node;
    while ((node = walker.nextNode())) {
      const match = node.textContent.match(/\[(\d+)\]/);
      if (match) {
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const at = range.getBoundingClientRect();
        // Leave from the end of the marker's visual line, so the trace never crosses the words after it.
        // Measure inside the marker's own paragraph: a range over the whole record would count each
        // paragraph's block box, which runs to the column's right edge.
        range.selectNodeContents(node.parentElement.closest("p") || marker);
        const row = [...range.getClientRects()].filter((r) => Math.abs(r.top + r.height / 2 - (at.top + at.height / 2)) < at.height / 2);
        return row.length ? { top: at.top, height: at.height, right: Math.max(...row.map((r) => r.right)) } : at;
      }
    }
    return null;
  }

  // Geometry only, relative to the record, so it holds wherever the sticky record sits
  function measure() {
    if (!svg || !path) return;
    const quote = convo.querySelector(".quote-row");
    const sources = convo.querySelector(".sources-row");
    const citedId = sources && sources.querySelector("[data-cited-source]")?.dataset.citedSource;
    const sourceList = sources && citedId && sources.querySelector(`[data-src="${citedId}"]`);
    const cited = quote && citationRect(quote);
    const box = convo.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    if (!quote || !sources || !sourceList || !cited) { path.setAttribute("d", ""); length = 0; return; }
    const callout = quote.children[0].getBoundingClientRect();
    const content = quote.children[1].getBoundingClientRect();
    const quoteBox = quote.getBoundingClientRect();
    const source = sourceList.getBoundingClientRect();
    const gutter = callout.right - box.left + (content.left - callout.right) / 2;
    const x1 = cited.right - box.left + 4;
    const y1 = cited.top - box.top + cited.height / 2;
    const x2 = source.left - box.left - 8;
    const y2 = source.top - box.top + source.height / 2;
    const safeRight = content.right - box.left + 10;
    const clearY = quoteBox.bottom - box.top - 8;
    path.setAttribute("d", `M${x1} ${y1} H${safeRight} V${clearY} H${gutter} V${y2} H${x2}`);
    length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
  }

  // The scroll state: where the track and the buyer turns sit in the viewport, read from layout
  function state() {
    const vh = innerHeight, t = track.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(track, "::before").height) || 0;
    const foot = vh - (parseFloat(getComputedStyle(convo).bottom) || 0);
    return {
      engaged: pinning.matches && t.top < vh && t.bottom > 0,
      // pin progress: 0 when the record's foot reaches its sticky line, 1 when the track runs out
      q: pad ? clamp((foot - t.bottom + pad) / pad) : 1,
      turns: turns.map((el) => clamp((0.85 * vh - el.getBoundingClientRect().top) / (0.45 * vh))),
    };
  }

  // Pure: the record's look for one scroll state. Final state when not engaged.
  function render(s) {
    const live = s.engaged;
    turns.forEach((el, i) => (el.style.opacity = live ? String(0.35 + 0.65 * easeOut(s.turns[i])) : ""));
    stamps.forEach((st, i) => {
      const at = i === stamps.length - 1 ? Math.max(0, i - 1) * 0.06 + 0.1 + 0.08 : i * 0.06;
      const k = live ? span(s.q, at, at + 0.1) : 1;
      const p = land(k);
      st.style.opacity = k >= 1 ? "" : String(p);
      st.style.transform = k >= 1 ? "" : `scale(${1.06 - 0.06 * p})`;
    });
    if (path && length) path.style.strokeDashoffset = String(live ? length * (1 - easeOut(span(s.q, 0.42, 0.74))) : 0);
    if (cited) cited.style.setProperty("--lit", live ? easeOut(span(s.q, 0.7, 0.76)).toFixed(3) : "1");
    // Focus: how far each row is dimmed (0 lit, 1 at DIM), from the beats above
    const focus = easeOut(span(s.q, 0, 0.05)) * (1 - easeOut(span(s.q, 0.9, 0.96)));
    const handoff = easeOut(span(s.q, 0.38, 0.44));
    const dim = {
      context: focus,
      order: focus * handoff * (1 - easeOut(span(s.q, 0.74, 0.78))),
      trace: focus * (1 - handoff),
    };
    rows.forEach(({ el, part }) => (el.style.opacity = live && dim[part] > 0 ? String(1 - (1 - DIM) * dim[part]) : ""));
    if (you) {
      const o = live ? easeOut(span(s.q, 0.78, 0.9)) : 1;
      you.style.setProperty("--o", o.toFixed(3));
      you.style.setProperty("--oo", `${(8 - 5 * o).toFixed(2)}px`);
    }
  }

  const update = () => { raf = 0; render(state()); };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
  const relayout = () => { measure(); update(); };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", () => { cancelAnimationFrame(raf); relayout(); });
  pinning.addEventListener("change", relayout);
  document.fonts.ready.then(relayout);
  relayout();
})();
