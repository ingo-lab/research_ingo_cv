// CV site interactions: theme, language, reveal, count-up, active table of contents.
// Content is fully readable without JS (final numbers are in the HTML).
(() => {
  const doc = document.documentElement;
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode: in-memory only */ } };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canObserve = "IntersectionObserver" in window;

  document.querySelector('[data-action="theme"]')?.addEventListener("click", () => {
    const dark = doc.dataset.theme ? doc.dataset.theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    doc.dataset.theme = dark ? "light" : "dark";
    store("cv-theme", doc.dataset.theme);
  });

  document.querySelector('[data-action="lang"]')?.addEventListener("click", () => {
    const next = doc.dataset.lang === "en" ? "ko" : "en";
    doc.dataset.lang = next;
    doc.lang = next;
    store("cv-lang", next);
  });

  const countUp = (el) => {
    const to = Number(el.dataset.to);
    if (!Number.isFinite(to) || to < 1) return;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 900);
      el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = "0";
    requestAnimationFrame(step);
  };

  if (!reduce && canObserve) {
    doc.classList.add("js");
    document.querySelectorAll(".item, .proj, .edu").forEach((el, i) => el.style.setProperty("--d", `${(i % 6) * 70}ms`));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("in");
        e.target.querySelectorAll("[data-to]").forEach(countUp);
        io.unobserve(e.target);
      }
    }, { rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  }

  // Table of contents: smooth scroll (CSS) + highlight the section in view.
  const links = [...document.querySelectorAll(".toc a, .nav a")];
  const mark = (id) => links.forEach((a) => a.setAttribute("aria-current", String(a.hash === `#${id}`)));
  links.forEach((a) => a.addEventListener("click", () => mark(a.hash.slice(1))));
  if (canObserve && links.length) {
    const spy = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) mark(e.target.id);
    }, { rootMargin: "-30% 0px -60% 0px" });
    document.querySelectorAll(".sec").forEach((s) => spy.observe(s));
    mark("about");
    // The last section is short: at the very bottom of the page, it is the current one.
    const last = document.querySelector(".sec:last-of-type")?.id;
    window.addEventListener("scroll", () => {
      if (last && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) mark(last);
    }, { passive: true });
  }
})();
