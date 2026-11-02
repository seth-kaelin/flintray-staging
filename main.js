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

// Motion follows docs/rules/MOTION_VIDEO_RULES.md: the entrance is a pure function of time,
// renderAt(t), so any frame can be reproduced. ?t=<seconds> freezes it at that time for review.
(() => {
  const manta = document.querySelector(".hero-manta");
  if (!manta) return;
  const layers = [...document.querySelectorAll("[data-parallax]")];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const frozen = new URLSearchParams(location.search).get("t");

  const ENTRANCE = 1.8; // seconds
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);

  // Beats: 0.0 s manta 60px left, 30px low, tilted, invisible. 1.8 s at rest. Holds after.
  function mantaAt(t) {
    const p = easeOut(Math.min(Math.max(t / ENTRANCE, 0), 1));
    return { x: -60 * (1 - p), y: 30 * (1 - p), rot: -4 * (1 - p), opacity: p };
  }

  function renderAt(t, scrollY) {
    const m = mantaAt(t);
    manta.style.opacity = m.opacity;
    manta.style.transform = `translate3d(${m.x}px, ${m.y + scrollY * 0.12}px, 0) rotate(${m.rot}deg)`;
    for (const el of layers) {
      el.style.transform = `translate3d(0, ${scrollY * Number(el.dataset.parallax)}px, 0)`;
    }
  }

  if (reduced) {
    renderAt(ENTRANCE, 0);
    return;
  }
  if (frozen !== null) {
    renderAt(Number(frozen), scrollY);
    return;
  }

  let start = null;
  let t = 0;
  function frame(now) {
    if (start === null) start = now;
    t = Math.min((now - start) / 1000, ENTRANCE);
    renderAt(t, scrollY);
    if (t < ENTRANCE) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  addEventListener("scroll", () => renderAt(t, scrollY), { passive: true });
})();
