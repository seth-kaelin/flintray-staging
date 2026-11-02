// FlintRay site script for pages on the new frame. No framework, no animation library.

// The audit form posts to Formspree. Until the publish step sets the form id,
// the action holds a placeholder and the form says so instead of sending.
for (const form of document.querySelectorAll(".audit-form")) {
  const note = form.querySelector(".form-note");
  const button = form.querySelector("button[type=submit]");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    note.classList.remove("is-ok", "is-error");
    if (form.action.includes("__FORMSPREE_ID__")) {
      note.textContent = "Preview only: this form isn't connected yet, so nothing was sent.";
      return;
    }
    button.disabled = true;
    try {
      const res = await fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      note.textContent = "Thanks. We'll be in touch within two working days.";
      note.classList.add("is-ok");
    } catch {
      note.textContent = "That didn't send. Please try again in a moment.";
      note.classList.add("is-error");
    } finally {
      button.disabled = false;
    }
  });
}

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
  const MAX_LINES = Number(root.dataset.lines || 99);
  const CITED_ONLY = root.dataset.sources === "cited";
  const ROLE = { recommended: "Put first", shortlisted: "Shortlisted", mentioned: "Mentioned", none: "Not named" };

  // Beats (seconds): 0.25 question starts typing at 34 chars/s (capped 1.9 s); answer streams at
  // 26 words/s; each classification stamp lands 0.16 s apart; then the source line draws for 0.7 s.
  // The sheet shows the moment, not the whole conversation: the first lines and the source they cite.
  function view(e) {
    const lines = e.lines.slice(0, MAX_LINES);
    const first = lines.find((l) => l.cites.length);
    const keep = CITED_ONLY ? (first ? [first.cites[0]] : []) : e.sources.map((_, i) => i + 1);
    return { ...e, lines, sourceIds: keep };
  }

  function plan(e) {
    const qStart = 0.25, qDur = Math.min(1.9, e.ask.length / 34);
    const words = e.lines.map((l) => l.text.split(" "));
    const total = words.reduce((a, w) => a + w.length, 0);
    const aStart = qStart + qDur + 0.25, aDur = Math.min(1.6, total / 26);
    const rows = e.named.length + 1;
    const sStart = aStart + aDur + 0.15;
    const lStart = sStart + rows * 0.16 + 0.1;
    return { qStart, qDur, words, total, aStart, aDur, rows, sStart, lStart, end: lStart + 0.7 };
  }
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const ease = (x) => 1 - Math.pow(1 - x, 3);

  let engine = Object.keys(D.engines)[0], P = null, start = null, raf = 0, geom = null;

  function paint(key) {
    const e = view(D.engines[key]);
    root.dataset.engine = key;
    root.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === key)));
    root.querySelectorAll("[data-f=engine]").forEach((n) => (n.textContent = e.label));
    root.querySelectorAll("[data-f=model]").forEach((n) => (n.textContent = e.model));
    root.querySelectorAll("[data-f=pos]").forEach((n) => (n.textContent = `${Object.keys(D.engines).indexOf(key) + 1}/${Object.keys(D.engines).length}`));
    $("[data-f=ask]").textContent = "\u201C" + e.ask + "\u201D";
    $("[data-f=answer]").innerHTML = e.lines.map((l) => {
      let t = l.text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
      l.names.forEach((n) => (t = t.replace(n, `<b>${n}</b>`)));
      return `<li>${t}</li>`;
    }).join("") || `<li class="none">This engine named no company in its third answer.</li>`;
    const rows = e.named.map((n) => [n.role, n.name]);
    rows.push([e.subjectRole || "none", D.subject]);
    $("[data-f=verdict]").innerHTML = rows.map(([role, name], i) =>
      `<li class="v-row${name === D.subject ? " is-you" : ""}" data-i="${i}"><span class="v-name">${name}</span><span class="stamp stamp-${role}">${ROLE[role]}</span></li>`).join("");
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
    root.classList.toggle("is-typing", t < P.aStart);
    let k = Math.round(P.total * clamp((t - P.aStart) / P.aDur));
    $("[data-f=answer]").querySelectorAll("li").forEach((li, i) => {
      const n = P.words[i] ? P.words[i].length : 0;
      const show = Math.min(n, Math.max(0, k));
      k -= n;
      li.style.opacity = n ? String(show / n) : "1";
    });
    // Names are on the page from the start; each classification stamp lands in turn.
    $("[data-f=verdict]").querySelectorAll(".v-row").forEach((row, i) => {
      const p = ease(clamp((t - P.sStart - i * 0.16) / 0.24));
      row.toggleAttribute("data-on", p > 0.5);
      const st = row.querySelector(".stamp");
      st.style.opacity = String(p);
      st.style.transform = `translateY(${(1 - p) * 4}px)`;
    });
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
      if (t < P.end) raf = requestAnimationFrame(frame); else root.dataset.done = "";
    };
    raf = requestAnimationFrame(frame);
  }

  const order = Object.keys(D.engines);
  root.querySelectorAll("[data-next]").forEach((b) => b.addEventListener("click", () => {
    engine = order[(order.indexOf(engine) + 1) % order.length];
    paint(engine);
    if (reduced) renderAt(P.end); else play();
  }));
  root.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    engine = b.dataset.tab;
    paint(engine);
    if (reduced) renderAt(P.end); else play();
  }));
  addEventListener("resize", () => { measure(); renderAt(P.end); });

  paint(engine);
  if (frozen !== null) { renderAt(Number(frozen)); document.fonts.ready.then(() => { measure(); renderAt(Number(frozen)); }); }
  else if (reduced) { renderAt(P.end); document.fonts.ready.then(() => { measure(); renderAt(P.end); }); }
  else document.fonts.ready.then(() => { measure(); play(); });
})();
