// CV site interactions: theme, language, scroll reveal, active nav. Content is fully readable without JS.
(() => {
  const doc = document.documentElement;
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode: keep in-memory only */ } };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  if (!reduce && "IntersectionObserver" in window) {
    doc.classList.add("js");
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -10% 0px" });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  }

  const links = [...document.querySelectorAll(".nav a")];
  if ("IntersectionObserver" in window && links.length) {
    const spy = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((a) => a.setAttribute("aria-current", String(a.hash === `#${e.target.id}`)));
      }
    }, { rootMargin: "-40% 0px -55% 0px" });
    document.querySelectorAll(".sec").forEach((s) => spy.observe(s));
  }
})();
