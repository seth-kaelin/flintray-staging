document.documentElement.classList.add("js");
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
(() => {
  const jump = document.querySelector(".jump");
  if (!jump) return;
  const links = [...jump.querySelectorAll("ul a")];
  const sections = links.map((a) => document.getElementById(a.hash.slice(1)));
  const here = document.createElement("button");
  here.type = "button"; here.className = "jump-here";
  here.setAttribute("aria-expanded", "false"); here.setAttribute("aria-controls", "jump-list");
  jump.prepend(here);
  const open = (on) => { jump.classList.toggle("is-open", on); here.setAttribute("aria-expanded", String(on)); dispatchEvent(new Event("reportchromechange")); };
  here.addEventListener("click", () => open(!jump.classList.contains("is-open")));
  links.forEach((a) => a.addEventListener("click", () => {
    open(false);
    if (matchMedia("(max-width: 760px)").matches) {
      const section = document.getElementById(a.hash.slice(1));
      const target = section?.querySelector("h1,h2,h3,h4") || section;
      if (target) { target.tabIndex = -1; target.focus({preventScroll:true}); }
    }
  }));
  document.addEventListener("click", (e) => { if (!jump.contains(e.target)) open(false); });
  jump.addEventListener("keydown", (e) => { if (e.key === "Escape") { open(false); here.focus(); } });
  let current = null, ticking = false;
  const mark = () => {
    ticking = false;
    const nav = document.querySelector(".site-nav");
    const shown = el => el && getComputedStyle(el).visibility === "visible" && el.getBoundingClientRect().bottom > 0;
    const edge = Math.max(0, shown(jump) ? Math.min(64, jump.getBoundingClientRect().bottom) : 0, shown(nav) ? nav.getBoundingClientRect().bottom : 0);
    let at = 0;
    sections.forEach((s, k) => { if (s && s.getBoundingClientRect().top <= edge + 8) at = k; });
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) {
      const landing = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) + parseFloat(getComputedStyle(target).scrollMarginTop);
      const y = target.getBoundingClientRect().top;
      const selected = sections.findIndex(s => s && s.contains(target));
      if (selected >= 0 && y >= edge && y <= landing + 1) at = selected;
    }
    if (at === current) return;
    current = at;
    here.textContent = links[at].textContent;
    links.forEach((a, k) => (k === at ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(mark); } }, { passive: true });
  addEventListener("resize", mark);
  addEventListener("hashchange", () => {
    requestAnimationFrame(() => {
      if (location.hash === "#title" || location.hash === "#verdict") scrollTo({top:0,behavior:"instant"});
      mark();
    });
  });
  mark();
})();
(() => {
  const track = document.querySelector(".pm-track");
  const tabs = [...document.querySelectorAll(".pm-tabs button")];
  if (!track || !tabs.length) return;
  const mx = document.querySelector(".mx"), narrow = matchMedia("(max-width: 760px)");
  const panels = tabs.map(t => document.getElementById(t.getAttribute("aria-controls")));
  document.querySelector(".pm-tabs").removeAttribute("role");
  const set = (k, on, focus = false) => {
    tabs[k].setAttribute("aria-expanded", String(on));
    panels[k].hidden = !on;
    panels[k].inert = !on;
    if (focus) tabs[k].focus({preventScroll:true});
  };
  tabs.forEach((t,k) => {
    t.removeAttribute("role"); t.removeAttribute("aria-selected"); t.tabIndex = 0;
    panels[k].removeAttribute("role");
    set(k, false);
    t.addEventListener("click", () => set(k, t.getAttribute("aria-expanded") !== "true", true));
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape" || document.documentElement.classList.contains("drawer-open")) return;
    const k = tabs.findIndex((t,k) => t === document.activeElement || panels[k].contains(document.activeElement));
    if (k >= 0 && tabs[k].getAttribute("aria-expanded") === "true") { e.preventDefault(); set(k,false,true); }
  });
  const sync = () => {
    if (narrow.matches) mx.setAttribute("aria-hidden", "true"); else mx.removeAttribute("aria-hidden");
    mx.querySelectorAll(".mc-b").forEach(b => { if (narrow.matches) b.tabIndex = -1; else b.tabIndex = 0; });
  };
  mx.addEventListener("click", e => {
    const tile = e.target.closest(".mc-b");
    if (!narrow.matches || !tile) return;
    e.preventDefault(); e.stopImmediatePropagation();
    tabs[Number(tile.dataset.rec) % 4].click();
  }, true);
  narrow.addEventListener("change", sync); sync();
})();
(() => {
  const records = window.RR_RECORDS;
  const openers = [...document.querySelectorAll("[data-rec]")];
  if (!records || !openers.length) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const cta = document.querySelector(".jump-cta");
  const root = document.createElement("div");
  root.className = "drawer-root";
  root.hidden = true;
  root.innerHTML = `<div class="drawer-scrim" data-close></div>
    <section class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div class="drawer-head">
        <div class="drawer-bar"><div class="drawer-titles"><h2 class="drawer-title" id="drawer-title" tabindex="-1"></h2><p class="drawer-eng"></p></div>
          <button type="button" class="drawer-close" data-close>Close</button></div>
        <div class="set-row"><button type="button" data-step="-1">Previous</button><p class="set-count" aria-live="polite"></p><button type="button" data-step="1">Next</button></div>
      </div>
      <div class="drawer-body" data-carousel></div>
      <div class="drawer-foot"><a class="btn" href="${cta.getAttribute("href")}">${esc(cta.textContent)}</a></div>
    </section>`;
  document.body.append(root);
  const $ = (s) => root.querySelector(s);
  const body = $(".drawer-body");
  const slides = records.map(() => { const d = document.createElement("article"); d.className = "slide"; return d; });
  body.append(...slides);
  const state = { index: 0, trigger: null };
  const chip = ([word, code], extra = "") => `<b class="chip o-${code}${extra}">${esc(word)}</b>`;
  const turnHtml = (t, n, rec) => {
    const lit = rec.ft && n >= rec.ft, first = rec.ft === n;
    const named = t.n.map(([who, word, code]) => `<li><i class="who">${esc(who)}</i>${chip([word, code])}</li>`).join("")
      + (t.o ? `<li class="others">${t.o === 1 ? "1 other rival" : `${t.o} other rivals`}</li>` : "");
    const total = t.l || 1;
    const cites = t.l ? `<div class="cites"><div class="stack" aria-hidden="true">${t.lt.map(([, c, k]) => `<i class="sk sk-${k}" style="flex-basis:${(100 * c / total).toFixed(2)}%"></i>`).join("")}</div>
      <ul>${t.lt.map(([label, c, k]) => `<li><i class="sw sw-${k}" aria-hidden="true"></i>${esc(label)} <em>${c}</em></li>`).join("")}</ul></div>` : "";
    return `<li class="turn${lit ? " is-lit" : ""}${first ? " is-first" : ""}"><p class="turn-h">Turn ${n}<em>${t.l === 1 ? "1 cited link" : `${t.l} cited links`}</em></p>
      ${named ? `<ul class="named">${named}</ul>` : `<p class="none">No company named</p>`}${cites}</li>`;
  };
  const fill = (i) => {
    const slide = slides[i], rec = records[i];
    if (!slide || slide.childElementCount) return;
    slide.setAttribute("aria-label", `${rec.s}, ${rec.e}`);
    slide.innerHTML = `<dl class="rec-sum">
        <div><dt>The company</dt><dd>${chip(rec.co, " chip-co")}</dd></div>
        <div><dt>Top pick</dt><dd>${rec.p ? esc(rec.p) : "None"}</dd></div>
        <div><dt>Top pick first named</dt><dd>${rec.ft ? `Turn ${rec.ft}` : "None"}</dd></div>
      </dl>
      <ol class="turns">${rec.t.map((t, k) => turnHtml(t, k + 1, rec)).join("")}</ol>`;
  };
  const mark = (i) => {
    state.index = i;
    [i - 1, i, i + 1].forEach(fill);
    const rec = records[i];
    $(".drawer-title").textContent = rec.s;
    $(".drawer-eng").textContent = rec.e;
    $(".set-count").textContent = `${i + 1} of ${records.length}`;
    root.querySelectorAll("[data-step]").forEach((b) => { const to = i + Number(b.dataset.step); b.disabled = to < 0 || to >= records.length; });
    slides.forEach((s, k) => { s.classList.toggle("is-shown", k === i); s.toggleAttribute("inert", k !== i); });
    openers.forEach((o) => o.matches(".mc-b") && o.setAttribute("aria-pressed", String(Number(o.dataset.rec) === i)));
  };
  const go = (i, smooth = true) => {
    i = Math.max(0, Math.min(records.length - 1, i));
    fill(i);
    body.scrollTo({ left: i * body.clientWidth, behavior: smooth && !reduced() && Math.abs(i - state.index) <= 2 ? "smooth" : "auto" });
    mark(i);
  };
  let queued = false;
  body.addEventListener("scroll", () => {
    if (queued || root.hidden) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const i = Math.max(0, Math.min(records.length - 1, Math.round(body.scrollLeft / body.clientWidth)));
      if (i !== state.index) mark(i);
    });
  }, { passive: true });
  addEventListener("resize", () => { if (!root.hidden) body.scrollLeft = state.index * body.clientWidth; });
  const others = () => [...document.body.children].filter((n) => n !== root && n.tagName !== "SCRIPT");
  const open = (i, trigger) => {
    state.trigger = trigger;
    root.hidden = false;
    document.documentElement.classList.add("drawer-open");
    others().forEach((n) => { if (!n.inert) { n.inert = true; n.dataset.drawerInert = ""; } });
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("is-open")));
    state.index = -1;
    go(i, false);
    $(".drawer-title").focus({ preventScroll: true });
  };
  const close = () => {
    if (root.hidden) return;
    root.classList.remove("is-open");
    root.hidden = true;
    document.documentElement.classList.remove("drawer-open");
    others().forEach((n) => { if ("drawerInert" in n.dataset) { n.inert = false; delete n.dataset.drawerInert; } });
    openers.forEach((o) => o.removeAttribute("aria-pressed"));
    if (state.trigger && state.trigger.isConnected) state.trigger.focus({ preventScroll: true });
  };
  openers.forEach((o) => o.addEventListener("click", () => open(Number(o.dataset.rec), o)));
  const asked = location.hash.match(/^#c(\d+)$/);
  if (asked && records[Number(asked[1])]) open(Number(asked[1]), openers.find((o) => Number(o.dataset.rec) === Number(asked[1])));
  root.addEventListener("click", (e) => {
    const t = e.target.closest("[data-close], [data-step]");
    if (!t) return;
    if (t.matches("[data-close]")) { close(); return; }
    go(state.index + Number(t.dataset.step));
    (t.disabled ? root.querySelector(`[data-step="${-Number(t.dataset.step)}"]`) : t).focus();
  });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); close(); return; }
    if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && !e.target.closest("a")) {
      e.preventDefault();
      go(state.index + (e.key === "ArrowRight" ? 1 : -1));
    }
    if (e.key === "Tab") {
      const f = [...root.querySelectorAll("button:not(:disabled), a[href]")].filter((n) => n.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
})();
(() => {
  const mx = document.querySelector("[data-fill]");
  if (mx) mx.querySelectorAll(".mr:not(.mr-head)").forEach((row, r) => row.querySelectorAll(".mc").forEach((c, k) => { c.style.setProperty("--r", r); c.style.setProperty("--c", k); }));
})();
(() => {
  const fig = document.querySelector(".ray-fig");
  if (!fig || reduced()) return;
  const narrow = matchMedia("(max-width: 760px)");
  let queued = false;
  const paint = () => { queued = false; const y = scrollY; if (y < innerHeight * 1.6) fig.style.transform = `translate3d(0, ${Math.min(y * (narrow.matches ? 0.12 : 0.2), innerHeight * 0.22).toFixed(1)}px, 0)`; };
  addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(paint); } }, { passive: true });
})();
(() => {
  document.querySelectorAll("a[href],button,summary").forEach(el => {
    if (!el.hasAttribute("tabindex") && !el.matches(".mc-b") && !el.closest(".site-nav,.site-footer,.menu-sheet,[data-cta-bar]")) el.tabIndex = 0;
  });
  document.addEventListener("focusin", event => {
    const el = event.target;
    if (el === document.body || el === document.documentElement || el.closest(".site-nav,.drawer-root,.menu-sheet")) return;
    requestAnimationFrame(() => {
      if (document.activeElement !== el) return;
      const jump = el.closest(".jump");
      if (jump) {
        if (matchMedia("(max-width: 760px)").matches && jump.getBoundingClientRect().top !== 0) scrollTo({top:jump.getBoundingClientRect().top+scrollY,behavior:"instant"});
        return;
      }
      el.scrollIntoView({block:"nearest",inline:"nearest",behavior:"instant"});
      const shown = e => getComputedStyle(e).visibility === "visible" && e.getBoundingClientRect().bottom > 0;
      const bars = [...document.querySelectorAll(".jump,.site-nav,.vh,.mr-head")].filter(e => shown(e) && !e.contains(el));
      const top = bars.reduce((n,e) => {
        const r=e.getBoundingClientRect(),s=getComputedStyle(e);
        const stuck=(s.position === "sticky" || s.position === "fixed") && r.top <= parseFloat(s.top || "0") + 0.5;
        return stuck ? Math.max(n,r.bottom) : n;
      },0);
      const r=el.getBoundingClientRect();
      if (r.top < top + 8) scrollBy({top:r.top-top-8,behavior:"instant"});
      else if (r.bottom > innerHeight-8) scrollBy({top:r.bottom-innerHeight+8,behavior:"instant"});
    });
  });
})();
