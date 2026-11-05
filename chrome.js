// FlintRay chrome, loaded on every page (build_site.footer emits the tag). Owns the pinned phone bar and every
// request form. The phone menu lives in site.js. No framework.

// Phone chrome (760px and below), r06: at most one pinned element at a time, always opaque. On the first screen the
// header is pinned. Scrolling down hides the header (html.chrome-down) and shows the bottom bar; scrolling up brings
// the header back (html.chrome-up) and hides the bar, so the menu is one flick away. The bar also stays hidden
// while a request form is on screen, or while the request section or the footer fills a quarter of the screen,
// so it never sits over what it points to. Laptops keep the pinned header and no bar.
(() => {
  const bar = document.querySelector("[data-cta-bar]");
  const root = document.documentElement;
  const phone = matchMedia("(max-width: 760px)");
  const share = new Map();
  // The footer only blocks once it fills 40% of the screen, so a short page still shows the bar on its second screen
  const blocked = () => [...share.entries()].some(([el, r]) => (el.matches(".audit-form") ? r > 0 : r >= (el.matches(".site-footer") ? 0.4 : 0.25)));
  let anchor = scrollY, down = false;
  const update = () => {
    const y = scrollY;
    if (Math.abs(y - anchor) > 8) { down = y > anchor; anchor = y; }
    const past = y > innerHeight * 0.6;
    const hide = phone.matches && past && down && !root.classList.contains("menu-open");
    root.classList.toggle("chrome-down", hide);
    root.classList.toggle("chrome-up", !hide);
    if (bar) {
      // Back on the first screen (a jump to the top), the bar goes at once rather than sliding over the hero
      bar.classList.toggle("is-instant", !past);
      bar.classList.toggle("is-shown", hide && !blocked());
    }
  };
  if (bar && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) share.set(entry.target, entry.isIntersecting ? entry.intersectionRect.height / innerHeight : 0);
      update();
    }, { threshold: Array.from({ length: 21 }, (_, i) => i / 20) });
    document.querySelectorAll(".audit-form, #request, .site-footer").forEach((el) => io.observe(el));
  }
  let queued = false;
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  // A jump inside the page (a header link, "Request a free audit") lands with the header away, as a scroll down would
  addEventListener("hashchange", () => { down = true; anchor = scrollY; schedule(); });
  update();
})();

// Request forms. With a real Formspree id in the action (export_site.sh sets it), post with fetch. Until then
// (the __FORMSPREE_ID__ placeholder, or staging's mailto action) open a prefilled email to Seth.
(() => {
  const CONNECTED = /^https:\/\/formspree\.io\/f\/(?!__)[A-Za-z0-9]+$/;
  const TO = "seth@flintray.com";

  // "Company website: https://..." per filled field, in form order, labelled as the visitor saw it
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
      if (form.querySelector(".hp")?.value) return; // the honeypot: a bot filled it
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
        // The two-working-day promise is for the free audit only, never partner or paid work (Seth, 2026-11-04)
        say(form.classList.contains("partner-letter") ? "Thanks. We'll be in touch." : "Thanks. We'll be in touch, and your results arrive within two working days.", "is-ok");
      } catch {
        say("That didn't send. Please try again in a moment.", "is-error");
      } finally {
        button.disabled = false;
      }
    });
  }
})();
