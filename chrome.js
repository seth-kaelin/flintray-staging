// FlintRay chrome, loaded on every page (build_site.footer emits the tag). Owns the pinned phone bar and every
// request form. The phone menu lives in site.js. No framework.

// The pinned phone bar (760px and below, CSS): hidden on the first screen, shown from the second, and hidden
// while any request form is on screen, so it never sits over the form it points to.
(() => {
  const bar = document.querySelector("[data-cta-bar]");
  if (!bar) return;
  const onScreen = new Set();
  const update = () => bar.classList.toggle("is-shown", scrollY > innerHeight * 0.6 && onScreen.size === 0);
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) entry.isIntersecting ? onScreen.add(entry.target) : onScreen.delete(entry.target);
      update();
    });
    document.querySelectorAll(".audit-form").forEach((form) => io.observe(form));
  }
  let queued = false;
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
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
        say("Thanks. We'll be in touch, and your results arrive within two working days.", "is-ok");
      } catch {
        say("That didn't send. Please try again in a moment.", "is-error");
      } finally {
        button.disabled = false;
      }
    });
  }
})();
