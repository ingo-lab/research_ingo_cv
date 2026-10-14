// CV site interactions: theme, language, reveal, count-up, active table of contents.
// Content is fully readable without JS (final numbers are in the HTML).
(() => {
  const doc = document.documentElement;
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode: in-memory only */ } };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canObserve = "IntersectionObserver" in window;

  document.querySelectorAll('[data-action="theme"]').forEach((btn) => btn.addEventListener("click", () => {
    const dark = doc.dataset.theme ? doc.dataset.theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    doc.dataset.theme = dark ? "light" : "dark";
    store("cv-theme", doc.dataset.theme);
  }));

  document.querySelectorAll('[data-action="lang"]').forEach((btn) => btn.addEventListener("click", () => {
    const next = doc.dataset.lang === "en" ? "ko" : "en";
    doc.dataset.lang = next;
    doc.lang = next;
    store("cv-lang", next);
  }));

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

  // Table of contents: smooth scroll (CSS) + highlight the section being read.
  // Position based (the last section whose top has passed the reading line), so short sections work.
  const links = [...document.querySelectorAll(".toc a, .nav a")];
  const sections = [...document.querySelectorAll(".sec")];
  const mark = (id) => links.forEach((a) => a.setAttribute("aria-current", String(a.hash === `#${id}`)));
  let lockUntil = 0;
  const current = () => {
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (atBottom) return sections.at(-1)?.id;
    const line = Math.min(160, window.innerHeight * 0.3);
    return [...sections].reverse().find((s) => s.getBoundingClientRect().top <= line)?.id ?? sections[0]?.id;
  };
  links.forEach((a) => a.addEventListener("click", () => { lockUntil = performance.now() + 900; mark(a.hash.slice(1)); }));
  if (links.length && sections.length) {
    let ticking = false;
    const onScroll = () => {
      if (ticking || performance.now() < lockUntil) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; mark(current()); });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    mark(current());
  }
})();
