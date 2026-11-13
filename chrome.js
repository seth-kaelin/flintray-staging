(() => {
  const bar = document.querySelector("[data-cta-bar]");
  const root = document.documentElement;
  const phone = matchMedia("(max-width: 760px)");
  const jump = document.querySelector(".jump");
  const nav = document.querySelector(".site-nav");
  const share = new Map();
  const blocked = () => [...share.entries()].some(([el, r]) => (el.matches(".audit-form, #request, [data-final]") ? r > 0 : r >= 0.4));
  let anchor = scrollY, down = false;
  let previousY = scrollY, direction = 0, travel = 0;
  const update = () => {
    const y = scrollY;
    if (jump) {
      const delta = y - previousY, sign = Math.sign(delta);
      if (Math.abs(delta) > innerHeight) { down = true; anchor = y; direction = 1; travel = 0; }
      else if (sign) {
        if (sign !== direction) { direction = sign; travel = 0; }
        travel += Math.abs(delta);
        if (travel > 8) { down = direction > 0; anchor = y; }
      }
      previousY = y;
    } else if (Math.abs(y - anchor) > 8) { down = y > anchor; anchor = y; }
    const past = y > innerHeight * 0.6;
    const jumpEngaged = jump && (jump.classList.contains("is-open") || jump.contains(document.activeElement));
    const navEngaged = jump && nav && nav.contains(document.activeElement);
    const hide = phone.matches && !navEngaged && (jumpEngaged || (past && down)) && !root.classList.contains("menu-open");
    root.classList.toggle("chrome-down", hide);
    root.classList.toggle("chrome-up", !hide);
    if (bar) {
      bar.classList.toggle("is-instant", !!jump || !past);
      bar.classList.toggle("is-shown", hide && !blocked());
    }
  };
  if (bar && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) share.set(entry.target, entry.isIntersecting ? entry.intersectionRect.height / innerHeight : 0);
      update();
    }, { threshold: Array.from({ length: 21 }, (_, i) => i / 20) });
    document.querySelectorAll(".audit-form, #request, [data-final], .site-footer").forEach((el) => io.observe(el));
  }
  let queued = false;
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  addEventListener("hashchange", () => { down = true; anchor = scrollY; previousY = scrollY; direction = 1; travel = 0; schedule(); });
  if (jump && nav) {
    let frames = 0, running = false;
    const plate = document.querySelector("[data-final]");
    const measure = () => {
      if (plate) jump.classList.toggle("is-ended", phone.matches && !jump.classList.contains("is-open") && !jump.contains(document.activeElement) && plate.getBoundingClientRect().top < jump.offsetHeight - 0.5);
      const j = jump.getBoundingClientRect(), n = nav.getBoundingClientRect();
      const overlap = j.top < n.bottom && j.bottom > n.top && n.bottom > 0;
      jump.classList.toggle("is-yielded", phone.matches && ((root.classList.contains("chrome-up") && j.top < n.height && j.bottom > 0) || overlap || root.classList.contains("menu-open")));
      jump.classList.toggle("is-pinned", j.top >= -0.5 && j.top <= 0.5);
      const jumpShown = getComputedStyle(jump).visibility === "visible" && j.top <= 0.5;
      const chromeBottom = Math.max(0, n.bottom, jumpShown ? j.bottom : 0);
      root.style.setProperty("--report-top", `${chromeBottom}px`);
      document.querySelectorAll(".vh,.mr-head").forEach(header => {
        const r = header.getBoundingClientRect();
        header.classList.toggle("is-released", r.top < chromeBottom - 0.5);
      });
    };
    const tick = () => {
      update(); measure();
      if (++frames < 40 || nav.getAnimations().some(a => a.playState === "running")) requestAnimationFrame(tick);
      else running = false;
    };
    const track = () => { frames = 0; if (!running) { running = true; requestAnimationFrame(tick); } };
    addEventListener("scroll", track, {passive:true});
    addEventListener("resize", track);
    addEventListener("reportchromechange", track);
    nav.addEventListener("transitionend", measure);
    let menuState = root.classList.contains("menu-open");
    new MutationObserver(() => { const next = root.classList.contains("menu-open"); if (next !== menuState) { menuState = next; track(); } }).observe(root,{attributes:true,attributeFilter:["class"]});
    document.addEventListener("focusin", track);
    document.addEventListener("keydown", event => {
      if (!phone.matches || event.key !== "Tab" || root.classList.contains("menu-open") || root.classList.contains("drawer-open")) return;
      const focusable = el => el.tabIndex >= 0 && !el.disabled && !el.closest("[hidden],[inert]") && el.getClientRects().length && getComputedStyle(el).visibility === "visible";
      const navKeys = [...nav.querySelectorAll("a[href],button,[tabindex]")].filter(focusable);
      const firstBody = [...document.querySelectorAll("main a[href],main button,main summary,main [tabindex]")].filter(el => !jump.contains(el) && focusable(el) && (jump.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING))[0];
      const forward = !event.shiftKey && document.activeElement === navKeys.at(-1);
      const reverse = event.shiftKey && document.activeElement === firstBody;
      if (!forward && !reverse) return;
      const target = jump.querySelector(forward ? ".jump-here" : ".jump-cta");
      if (!target) return;
      event.preventDefault();
      scrollTo({top:jump.getBoundingClientRect().top+scrollY,behavior:"instant"});
      down = true; anchor = scrollY; previousY = scrollY; direction = 1; travel = 9;
      root.classList.add("chrome-down"); root.classList.remove("chrome-up");
      jump.classList.remove("is-yielded"); jump.classList.add("is-pinned");
      target.focus({preventScroll:true}); update(); measure();
    });
    measure();
  }
  update();
})();
(() => {
  const CONNECTED = /^https:\/\/formspree\.io\/f\/(?!__)[A-Za-z0-9]+$/;
  const TO = "seth@flintray.com";
  const letter = (form) => [...form.querySelectorAll("input:not([type=hidden]):not(.hp)")]
    .filter((input) => input.value.trim())
    .map((input) => {
      const label = input.closest("label");
      const name = label ? [...label.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ").trim() : input.name;
      return `${name}: ${input.value.trim()}`;
    }).join("\n");
  for (const form of document.querySelectorAll(".audit-form")) {
    const note = form.querySelector(".form-note");
    const button = form.querySelector("button[type=submit]");
    const say = (text, cls) => {
      if (!note) return;
      note.classList.remove("is-ok", "is-error");
      note.textContent = text;
      if (cls) note.classList.add(cls);
    };
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (form.querySelector(".hp")?.value) return;
      if (!CONNECTED.test(form.action)) {
        const subject = form.querySelector('input[name="_subject"]')?.value || "Free audit request";
        location.href = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(letter(form))}`;
        say(`Your email app should open with this request filled in. If it doesn't, write to ${TO}.`);
        return;
      }
      button.disabled = true;
      try {
        const res = await fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        say(form.classList.contains("partner-letter") ? "Thanks. We'll be in touch." : "Thanks. We'll be in touch, and your results arrive within two working days.", "is-ok");
      } catch {
        say("That didn't send. Please try again in a moment.", "is-error");
      } finally {
        button.disabled = false;
      }
    });
  }
})();
(() => {
  const stage = document.querySelector(".g-hero-stage, .aud-top, body.p-sample-report .cover");
  if (!stage) return;
  const root = document.documentElement;
  const nav = document.querySelector(".site-nav");
  let raf = 0;
  const set = () => { raf = 0; const h = nav ? nav.getBoundingClientRect().bottom : 64; root.classList.toggle("on-stage", stage.getBoundingClientRect().bottom > h); };
  addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(set); }, { passive: true });
  addEventListener("resize", set);
  set();
})();
for (const d of document.querySelectorAll("[data-plans] details.g-plan-more, details.aud-plan-more")) d.open = true;
