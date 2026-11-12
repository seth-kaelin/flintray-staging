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
  sheet.querySelectorAll("nav a").forEach((a) => a.addEventListener("click", () => {
    if (new URL(a.href).pathname === location.pathname) setOpen(false);
  }));
  matchMedia("(min-width: 1024px)").addEventListener("change", (m) => { if (m.matches && !sheet.hidden) setOpen(false); });
})();
const FR = (() => {
  const clamp = (x) => Math.max(0, Math.min(1, x));
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
  const moreNamed = (n) => `${["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"][n] ?? n} more ${n === 1 ? "company is" : "companies are"} named further down the answer.`;
  const ROLE = { recommended: "Recommended", shortlisted: "Shortlisted", mentioned: "Mentioned", cautioned: "Named negatively", none: "Not named" };
  function view(e) {
    const lines = e.lines.slice(0, maxLines());
    const first = lines.find((l) => l.cites.length);
    const keep = CITED_ONLY ? (first ? [first.cites[0]] : []) : e.sources.map((_, i) => i + 1);
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
    const marker = `[${first.cites[0]}]`;
    const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
    const range = document.createRange(); let node, end = null;
    while ((node = walker.nextNode())) {
      const at = node.textContent.indexOf(marker);
      if (at >= 0) { range.setStart(node, at); range.setEnd(node, at + marker.length); end = range.getBoundingClientRect(); break; }
    }
    if (!end) { range.selectNodeContents(li); const rs = [...range.getClientRects()]; end = rs[rs.length - 1]; }
    range.selectNodeContents(li);
    const row = [...range.getClientRects()].filter((r) => Math.abs(r.top + r.height / 2 - (end.top + end.height / 2)) < end.height / 2);
    if (row.length) end = { top: end.top, height: end.height, right: Math.max(...row.map((r) => r.right)) };
    const c = s.getBoundingClientRect();
    const x1 = end.right - box.left + 10, y1 = end.top - box.top + end.height / 2;
    const x2 = c.left - box.left - 6, y2 = c.top - box.top + c.height / 2;
    const stacked = x2 < x1 || root.dataset.route === "gutter";
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
    const vrows = $("[data-f=verdict]").querySelectorAll(".v-row");
    vrows.forEach((row, i) => {
      const last = i === vrows.length - 1;
      const k = clamp((t - (last ? P.yStart : P.sStart + i * STAMP_GAP)) / STAMP_DUR);
      const p = land(k);
      row.toggleAttribute("data-on", k > 0);
      const st = row.querySelector(".stamp");
      st.style.opacity = String(p);
      st.style.transform = k >= 1 ? "" : `scale(${1.06 - 0.06 * p})`;
      const r = last && st.classList.contains("stamp-none") ? clamp((t - P.ringStart) / RING) : 0;
      st.style.outline = r > 0 && r < 1 ? `1px solid rgb(232 116 59 / ${(1 - r).toFixed(3)})` : "";
      st.style.outlineOffset = r > 0 && r < 1 ? `${(6 * ease(r)).toFixed(2)}px` : "";
    });
    if (countEl) countEl.textContent = String(counting ? Math.round(countTo * ease(clamp((t - COUNT[0]) / COUNT[1]))) : countTo);
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
  const settled = () => (frozen !== null ? Number(frozen) : P.end);
  addEventListener("resize", () => { measure(); renderAt(settled()); });
  phone.addEventListener("change", () => { paint(engine); renderAt(settled()); });
  paint(engine);
  if (frozen !== null) { renderAt(Number(frozen)); document.fonts.ready.then(() => { measure(); renderAt(Number(frozen)); }); }
  else if (reduced) { renderAt(P.end); document.fonts.ready.then(() => { measure(); renderAt(P.end); }); }
  else document.fonts.ready.then(() => { measure(); play(); });
})();
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
(() => {
  const root = document.querySelector("[data-preview]");
  const index = root && root.querySelector("[data-pv-index]");
  const inline = index && index.querySelector("[data-pv-matrix]");
  const pane = root && root.querySelector(".pv-convo");
  if (!inline || !pane) return;
  const V = document.currentScript ? new URL(document.currentScript.src).search : "";
  const M = JSON.parse(inline.textContent);
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phone = matchMedia("(max-width: 760px)");
  const E = M.engines.length, total = M.n, start = M.show;
  const situation = (i) => `Situation ${String(Math.floor(i / E) + 1).padStart(2, "0")}`;
  const engine = (i) => M.engines[i % E][1];
  const chip = ([word, code], extra = "") => `<b class="chip o-${code}${extra}">${esc(word)}</b>`;
  const top = document.createElement("div");
  top.className = "pv-top";
  top.innerHTML = `<p class="pv-label">Real data, anonymized.</p>
    <div class="pv-co"><p class="pv-co-h">The company, in all ${total}</p><p class="pv-co-v">${chip([M.co[0], M.co[1]], " chip-co")}<em>${M.co[2]} of ${total}</em></p></div>
    <p class="pv-read"><b>Each cell is one conversation</b><i>Rival A’s outcome</i></p>`;
  const grid = document.createElement("div");
  grid.className = "pv-grid";
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-label", "The conversation matrix");
  let html = `<p class="pv-mk pv-mk-h">Situation</p>` + M.engines.map(([, n]) => `<p class="pv-h">${esc(n)}</p>`).join("");
  for (let s = 0; s < M.sit; s++) {
    html += `<p class="pv-mk" style="--r:${s}">${situation(s * E)}</p>`;
    for (let c = 0; c < E; c++) {
      const i = s * E + c, [word, code] = M.cells[i];
      html += `<button type="button" class="pv-cell tile t-${code}" data-i="${i}" data-col="${c + 1}" aria-pressed="false" aria-label="${esc(word)}, ${situation(i)}, ${esc(engine(i))}" style="--r:${s};--c:${c}">${chip([word, code])}</button>`;
    }
  }
  grid.innerHTML = html;
  const tabs = document.createElement("div");
  tabs.className = "pv-tabs";
  tabs.setAttribute("role", "group");
  tabs.innerHTML = M.engines.map(([, n], i) => `<button type="button" data-col="${i + 1}" aria-pressed="false" aria-expanded="false"><span class="pv-tab-n">${esc(n)}</span></button>`).join("");
  const showCol = (n) => {
    grid.dataset.show = String(n);
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.col === String(n))));
  };
  const tileMode = () => phone.matches && !root.classList.contains("is-list");
  const syncTiles = () => grid.querySelectorAll(".pv-cell").forEach((b) => (tileMode() ? (b.tabIndex = -1) : b.removeAttribute("tabindex")));
  const listOpen = (on) => {
    root.classList.toggle("is-list", on);
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-expanded", String(on && b.dataset.col === grid.dataset.show)));
    syncTiles();
  };
  phone.addEventListener("change", syncTiles);
  tabs.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    const again = root.classList.contains("is-list") && b.dataset.col === grid.dataset.show;
    if (again) { root.classList.remove("is-open"); listOpen(false); return; }
    showCol(Number(b.dataset.col));
    listOpen(true);
  });
  showCol(start % E + 1);
  syncTiles();
  const box = document.createElement("div");
  box.className = "pv-index-in";
  box.append(top, tabs, grid);
  index.replaceChildren(box);
  const cells = [...grid.querySelectorAll(".pv-cell")];
  const turn = (t, n, rec) => {
    const lit = rec.ft && n >= rec.ft, first = rec.ft === n;
    const named = t.n.map(([who, word, code]) => `<li><i class="who">${esc(who)}</i>${chip([word, code])}</li>`).join("")
      + (t.o ? `<li class="others">${t.o === 1 ? "1 other rival" : `${t.o} other rivals`}</li>` : "");
    const cites = t.l ? `<div class="cites"><div class="stack" aria-hidden="true">${t.lt.map(([, c, k]) => `<i class="sk sk-${k}" style="flex-basis:${(100 * c / t.l).toFixed(2)}%"></i>`).join("")}</div>
      <ul>${t.lt.map(([label, c, k]) => `<li><i class="sw sw-${k}" aria-hidden="true"></i>${esc(label)} <em>${c}</em></li>`).join("")}</ul></div>` : "";
    return `<li class="turn${lit ? " is-lit" : ""}${first ? " is-first" : ""}"><p class="turn-h">Turn ${n}<em>${t.l === 1 ? "1 cited link" : `${t.l} cited links`}</em></p>
      ${named ? `<ul class="named">${named}</ul>` : `<p class="none">No company named</p>`}${cites}</li>`;
  };
  const record = (rec) => `<dl class="rec-sum">
      <div><dt>The company</dt><dd>${chip(rec.co, " chip-co")}</dd></div>
      <div><dt>Top pick</dt><dd>${rec.p ? esc(rec.p) : "None"}</dd></div>
      <div><dt>Top pick first named</dt><dd>${rec.ft ? `Turn ${rec.ft}` : "None"}</dd></div>
    </dl><ol class="turns">${rec.t.map((t, k) => turn(t, k + 1, rec)).join("")}</ol>`;
  const nav = document.createElement("div");
  nav.className = "pv-nav";
  nav.innerHTML = `<p class="pv-where"><a class="pv-open" href="sample-report.html"></a><em></em></p><button type="button" class="pv-step" data-step="-1">Previous</button><p class="pv-pos" aria-live="polite"></p><button type="button" class="pv-step" data-step="1">Next</button>`;
  const track = document.createElement("div");
  track.className = "pv-track";
  track.dataset.carousel = "";
  track.tabIndex = 0;
  track.setAttribute("role", "region");
  const slides = Array.from({ length: total }, () => { const d = document.createElement("div"); d.className = "pv-slide"; return d; });
  slides[start].innerHTML = record(M.first);
  track.append(slides[start]);
  pane.replaceChildren(nav, track);
  root.classList.add("is-live");
  let recs = null, loading = null, built = false;
  const fill = (i) => { if (recs && slides[i] && !slides[i].childElementCount) slides[i].innerHTML = record(recs[i]); };
  const build = () => {
    if (built || !recs) return;
    built = true;
    track.replaceChildren(...slides);
    track.scrollLeft = start * track.clientWidth;
    mark(current);
  };
  const load = () => loading || (loading = new Promise((done, fail) => {
    if (window.RR_RECORDS) return done();
    const s = document.createElement("script");
    s.src = `assets/report-records.js${V}`;
    s.onload = done;
    s.onerror = fail;
    document.head.append(s);
  }).then(() => { recs = window.RR_RECORDS; build(); }).catch(() => { loading = null; }));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); load(); } }, { rootMargin: "800px 0px" });
    io.observe(root);
  }
  const fit = () => {
    const shown = slides[current];
    if (shown && shown.offsetHeight) track.style.height = `${shown.scrollHeight}px`;
  };
  const sized = "ResizeObserver" in window ? new ResizeObserver(() => fit()) : null;
  if (sized) slides.forEach((d) => sized.observe(d));
  let current = start;
  const pos = nav.querySelector(".pv-pos");
  const where = nav.querySelector(".pv-open");
  const eng = nav.querySelector(".pv-where em");
  const steps = [...nav.querySelectorAll(".pv-step")];
  const open = () => !phone.matches || root.classList.contains("is-open");
  const mark = (i) => {
    current = i;
    [i - 1, i, i + 1].forEach(fill);
    cells.forEach((b) => b.setAttribute("aria-pressed", String(open() && Number(b.dataset.i) === i)));
    where.textContent = situation(i);
    where.href = `sample-report.html#c${i}`;
    eng.textContent = engine(i);
    track.setAttribute("aria-label", `${situation(i)}, ${engine(i)}`);
    pos.textContent = `${i + 1} of ${total}`;
    if (getComputedStyle(tabs).display !== "none" && root.classList.contains("is-open")) { showCol(i % E + 1); if (root.classList.contains("is-list")) listOpen(true); }
    steps[0].disabled = !built || i === 0;
    steps[1].disabled = !built || i === total - 1;
    fit();
  };
  mark(start);
  const cued = tabs.querySelector(`[data-col="${start % E + 1}"]`);
  if (cued && phone.matches && "IntersectionObserver" in window && !reduced()) {
    const cue = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      cue.disconnect();
      cued.classList.add("is-cued");
    }, { rootMargin: "0px 0px -35% 0px" });
    cue.observe(cued);
  }
  const win = root.querySelector(".pv-window");
  const rowEnd = (i) => cells[Math.floor(i / E) * E + E - 1];
  const place = (i, hold) => {
    const end = rowEnd(i);
    if (!end || pane.previousElementSibling === end) return false;
    const y = hold.getBoundingClientRect().top;
    if (pane.parentElement !== grid) end.after(pane);
    else {
      const kids = [...grid.children], from = kids.indexOf(pane), to = kids.indexOf(end);
      if (to > from) pane.before(...kids.slice(from + 1, to + 1));
      else pane.after(...kids.slice(to + 1, from));
    }
    const doc = document.documentElement.style, was = doc.scrollBehavior;
    doc.scrollBehavior = "auto";
    scrollBy(0, hold.getBoundingClientRect().top - y);
    doc.scrollBehavior = was;
    return true;
  };
  const unplace = () => { if (pane.parentElement === grid) win.append(pane); };
  phone.addEventListener("change", () => {
    if (!phone.matches) unplace();
    else if (root.classList.contains("is-open")) place(current, pane);
    mark(current);
  });
  let ticking = false, rest = 0;
  track.addEventListener("scroll", () => {
    if (!built) return;
    clearTimeout(rest);
    rest = setTimeout(() => { if (phone.matches && root.classList.contains("is-open")) place(current, pane); }, 180);
    if (ticking) return;
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
    fill(i);
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
    if (tileMode()) { tabs.querySelector(`[data-col="${cell.dataset.col}"]`).click(); return; }
    const i = Number(cell.dataset.i);
    if (phone.matches && root.classList.contains("is-open") && cell.getAttribute("aria-pressed") === "true") {
      root.classList.remove("is-open");
      mark(current);
      return;
    }
    const opening = !root.classList.contains("is-open");
    root.classList.add("is-open");
    const moved = phone.matches && place(i, cell);
    await load();
    go(i, !opening && !moved);
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop || 0);
    const at = pane.getBoundingClientRect().top;
    if (phone.matches) {
      if (at > innerHeight * 0.7) scrollTo({ top: scrollY + cell.getBoundingClientRect().top - pad, behavior: reduced() ? "auto" : "smooth" });
    } else if (getComputedStyle(win).gridTemplateColumns.split(" ").length === 1 && at > innerHeight * 0.7) {
      scrollTo({ top: scrollY + at - pad, behavior: reduced() ? "auto" : "smooth" });
    }
  });
  grid.addEventListener("keydown", (ev) => {
    const cell = ev.target.closest(".pv-cell");
    const one = getComputedStyle(tabs).display !== "none";
    const move = one ? { ArrowDown: E, ArrowUp: -E }[ev.key] : { ArrowRight: 1, ArrowLeft: -1, ArrowDown: E, ArrowUp: -E }[ev.key];
    if (!cell || !move) return;
    const next = cells[cells.indexOf(cell) + move];
    if (next) { ev.preventDefault(); next.focus(); }
  });
  grid.dataset.reveal = "fill";
})();
(() => {
  const folds = [...document.querySelectorAll(".g-plan-more")];
  const wide = matchMedia("(min-width: 1024px)");
  folds.forEach((d) => d.addEventListener("toggle", () => { if (wide.matches) folds.forEach((o) => { if (o.open !== d.open) o.open = d.open; }); }));
})();
(() => {
  const els = [...document.querySelectorAll("[data-reveal]")];
  if (!els.length) return;
  const done = (el) => el.setAttribute("data-revealed", "");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) { els.forEach(done); return; }
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const out = (x) => 1 - Math.pow(1 - x, 3);
  const narrow = matchMedia("(max-width: 760px)");
  const stagger = (n, each, cap) => (n > 1 ? Math.min(cap, Math.max(0, 1200 - each) / (n - 1)) : 0);
  const clear = (n, ...props) => props.forEach((p) => n.style.removeProperty(p));
  const draw = (n, k) => n.style.setProperty("--k", out(clamp(k)).toFixed(4));
  const place = (n) => {
    const cs = getComputedStyle(n), r = cs.getPropertyValue("--r"), c = cs.getPropertyValue("--c");
    if (r !== "") return [Number(r) || 0, Number(c) || 0];
    const row = n.closest(".mr, .pr"), cell = n.closest(".mc, .pr-ra");
    return [row ? [...row.parentElement.children].indexOf(row) : 0, cell ? [...cell.parentElement.children].indexOf(cell) : 0];
  };
  const KINDS = {
    rise: { dur: () => 700, at: (el, t, end) => (end ? clear(el, "transform") : (el.style.transform = `translate3d(0, ${((1 - out(clamp(t / 700))) * 8).toFixed(2)}px, 0)`)) },
    rows: {
      prep: (el) => ({ kids: [...el.children], gap: stagger(el.children.length, 600, 110) }),
      dur: (el, s) => 600 + s.gap * (s.kids.length - 1),
      at: (el, t, end, s) => s.kids.forEach((n, i) => (end ? clear(n, "--k") : draw(n, (t - i * s.gap) / 600))),
    },
    rule: { dur: () => 700, at: (el, t, end) => (end ? clear(el, "--k") : draw(el, t / 700)) },
    bars: {
      prep: (el) => { const bars = [...el.querySelectorAll(".fa-bar i, .bar i, .sk, .sg, .ty-bar i")]; return { bars, gap: stagger(bars.length, 750, 70) }; },
      dur: (el, s) => 750 + s.gap * (s.bars.length - 1),
      at: (el, t, end, s) => s.bars.forEach((b, i) => (end ? clear(b, "transform") : (b.style.transform = `scaleX(${out(clamp((t - i * s.gap) / 750)).toFixed(4)})`))),
    },
    tally: {
      prep: (el) => ({ marks: [...el.querySelectorAll(".fa-tally")].map((m) => { const v = m.viewBox.baseVal; return [m, Math.max(1, Math.round(v.height / 12))]; }) }),
      dur: () => 900,
      at: (el, t, end, s) => s.marks.forEach(([m, rows]) => {
        if (end) return clear(m, "clip-path");
        const pos = clamp(t / 900) * rows, r = Math.floor(pos), f = (pos - r) * 100, y0 = (r / rows) * 100, y1 = ((r + 1) / rows) * 100;
        m.style.clipPath = `polygon(0 0, 100% 0, 100% ${y0}%, ${f}% ${y0}%, ${f}% ${y1}%, 0 ${y1}%)`;
      }),
    },
    count: {
      whole: true,
      prep: (el) => ({ nums: [...el.querySelectorAll("[data-count]")].map((n) => [n, Number(n.dataset.count)]) }),
      dur: () => 900,
      at: (el, t, end, s) => s.nums.forEach(([n, to]) => { n.textContent = String(end ? to : Math.round(to * out(clamp(t / 900)))); }),
    },
    fill: {
      prep: (el) => ({ tiles: !!el.querySelector(".tile"), cells: [...el.querySelectorAll(el.querySelector(".tile") ? ".tile" : ".chip")].map((n) => { const [r, c] = place(n.querySelector(".chip") || n); return [n, r * 40 + c * 22]; }) }),
      dur: (el, s) => 420 + Math.min(880, Math.max(0, ...s.cells.map(([, d]) => d))),
      at: (el, t, end, s) => s.cells.forEach(([n, d]) => {
        if (end) return clear(n, "--f", "transform");
        const e = out(clamp((t - Math.min(d, 880)) / 420));
        n.style.setProperty("--f", e.toFixed(3));
        if (!s.tiles) n.style.transform = `translateY(${((1 - e) * 4).toFixed(2)}px)`;
      }),
    },
    rail: {
      scroll: (el) => clamp((innerHeight * 0.92 - el.getBoundingClientRect().top) / (innerHeight * 0.55)),
      prep: (el) => ({ steps: [...el.children] }),
      dur: () => 1000,
      at: (el, t, end, s) => {
        const n = s.steps.length, p = clamp(t / 1000);
        s.steps.forEach((li, i) => {
          if (end) return clear(li, "--rv", "--rd");
          const k = clamp(p * n - i);
          li.style.setProperty("--rv", out(k).toFixed(4));
          li.style.setProperty("--rd", clamp(k * 4).toFixed(3));
        });
      },
    },
    steps: {
      prep: (el) => {
        const list = el.matches(".fa-steps") ? el : el.querySelector(".fa-steps");
        return { list, steps: [...list.children], byRow: !narrow.matches && !!el.querySelector(".g-threads"),
          draws: [...el.querySelectorAll("[data-draw]")].map((d) => [d, Number(d.dataset.from), Number(d.dataset.to)]) };
      },
      dur: () => 1250,
      at: (el, t, end, s) => {
        const n = s.steps.length, row = clamp(t / 1100);
        s.steps.forEach((li, i) => {
          if (end) return clear(li, "--rv", "--rd");
          const k = s.byRow ? clamp(row * n - i) : clamp((t - i * 120) / 600);
          li.style.setProperty("--rv", String(out(k)));
          li.style.setProperty("--rd", String(clamp(k * 4)));
        });
        if (end) clear(s.list, "--rl");
        else s.list.style.setProperty("--rl", String(out(s.byRow ? clamp(row * n - (n - 1)) : clamp((t - (n - 1) * 120) / 600))));
        s.draws.forEach(([d, from, to]) => (end ? clear(d, "stroke-dashoffset") : (d.style.strokeDashoffset = String(1 - out(clamp((row - from) / (to - from)))))));
      },
    },
    weave: {
      prep: (el) => ({ paths: [...el.querySelectorAll("path")], nodes: [...el.querySelectorAll("i[style]")] }),
      dur: () => 1200,
      at: (el, t, end, s) => s.paths.forEach((p, j) => {
        const k = clamp((t - j * 200) / 800);
        if (end) { clear(p, "stroke-dashoffset"); if (s.nodes[j]) clear(s.nodes[j], "opacity"); return; }
        p.style.strokeDashoffset = String(1 - out(k));
        if (s.nodes[j]) s.nodes[j].style.opacity = k >= 1 ? "1" : "0";
      }),
    },
  };
  const kind = (el) => KINDS[el.dataset.reveal] || KINDS.rise;
  for (const n of document.querySelectorAll("[data-reveal=count] [data-count]")) n.style.minWidth = `${n.getBoundingClientRect().width}px`;
  document.documentElement.classList.add("rv");
  const running = new Map();
  const finish = (el) => { const r = running.get(el); if (r) { running.delete(el); kind(el).at(el, r.dur, true, r.s); } done(el); };
  const play = (el) => {
    io.unobserve(el);
    const K = kind(el), s = K.prep ? K.prep(el) : null, dur = K.dur(el, s);
    running.set(el, { dur, s });
    if (K.scroll) {
      let best = 0;
      const tick = () => {
        if (!running.has(el)) return removeEventListener("scroll", on);
        best = Math.max(best, K.scroll(el));
        if (best >= 1) { removeEventListener("scroll", on); finish(el); } else K.at(el, best * dur, false, s);
      };
      let queued = false;
      const on = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; tick(); }); } };
      K.at(el, 0, false, s);
      el.removeAttribute("data-reveal-wait");
      addEventListener("scroll", on, { passive: true });
      tick();
      return;
    }
    K.at(el, 0, false, s);
    el.removeAttribute("data-reveal-wait");
    let t0 = null;
    const frame = (now) => {
      if (!running.has(el)) return;
      if (t0 === null) t0 = now;
      const t = now - t0;
      if (t >= dur) finish(el);
      else { K.at(el, t, false, s); requestAnimationFrame(frame); }
    };
    requestAnimationFrame(frame);
  };
  document.addEventListener("visibilitychange", () => { if (document.hidden) [...running.keys()].forEach(finish); });
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    const K = kind(e.target);
    const seen = K.scroll ? true : K.whole ? e.intersectionRatio >= 0.97 : e.intersectionRatio >= 0.25 || e.intersectionRect.height >= innerHeight * 0.34;
    if (seen) play(e.target);
  }), { threshold: [0, 0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.97, 1] });
  const h = innerHeight;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (!el.getClientRects().length || r.top < h) { done(el); continue; }
    el.setAttribute("data-reveal-wait", "");
    if (el.dataset.reveal === "count") el.querySelectorAll("[data-count]").forEach((n) => { n.textContent = "0"; });
    io.observe(el);
  }
})();
