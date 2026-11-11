(() => {
  const bar = document.querySelector("[data-cta-bar]");
  const root = document.documentElement;
  const phone = matchMedia("(max-width: 760px)");
  const share = new Map();
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
  addEventListener("hashchange", () => { down = true; anchor = scrollY; schedule(); });
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
