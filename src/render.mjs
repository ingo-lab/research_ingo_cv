// cv.json → one static HTML page. Pure functions, no dependencies.
// Every visible string is rendered in both languages; CSS shows the one picked in <html data-lang>.

const TBD = { ko: "준비 중", en: "Coming soon" };
const UI = {
  about: { ko: "소개", en: "About" },
  interests: { ko: "관심 분야", en: "Interests" },
  projects: { ko: "프로젝트", en: "Projects" },
  practice: { ko: "일하는 방식", en: "How I work" },
  skills: { ko: "기술", en: "Skills" },
  timeline: { ko: "타임라인", en: "Timeline" },
  education: { ko: "학력", en: "Education" },
  publications: { ko: "논문 · 연구자 ID", en: "Publications · Researcher IDs" },
  contact: { ko: "연락", en: "Contact" },
  featured: { ko: "대표 프로젝트", en: "Featured" },
  role: { ko: "역할", en: "Role" },
  source: { ko: "출처", en: "Source" },
  updated: { ko: "갱신", en: "Updated" },
  nameFallback: { ko: "연구자 CV", en: "Researcher CV" },
  theme: { ko: "테마 전환", en: "Toggle theme" },
};
const SECTIONS = ["about", "interests", "projects", "practice", "skills", "timeline", "education", "publications", "contact"];

const HTTP = /^https?:\/\//;
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i;

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const isEmpty = (v) => v == null || v === "" || (typeof v === "object" && !Array.isArray(v) && !v.ko && !v.en);

export function bi(v) {
  if (isEmpty(v)) return `<span class="tbd">${bi(TBD)}</span>`;
  if (typeof v === "string") return esc(v);
  return `<span data-l="ko">${esc(v.ko || v.en)}</span><span data-l="en">${esc(v.en || v.ko)}</span>`;
}

const plain = (v, lang = "ko") => (typeof v === "string" ? v : (v?.[lang] || v?.ko || v?.en || ""));

export function emptyPaths(obj, prefix = "") {
  if (obj === "") return [prefix];
  if (obj === null || typeof obj !== "object") return [];
  return Object.entries(obj).flatMap(([k, v]) => (k.startsWith("$") ? [] : emptyPaths(v, prefix ? `${prefix}.${k}` : k)));
}

export function validate(cv) {
  const errors = [];
  if (!cv?.person?.affiliation) errors.push("person.affiliation is required");
  for (const key of ["interests", "projects", "timeline", "skills"]) {
    if (!Array.isArray(cv?.[key])) errors.push(`${key} must be an array`);
  }
  (cv?.timeline ?? []).forEach((t, i) => { if (!t.source) errors.push(`timeline.${i}.source is required`); });
  (cv?.projects ?? []).forEach((p, i) => {
    (p.stats ?? []).forEach((s, j) => { if (!s.source) errors.push(`projects.${i}.stats.${j}.source is required`); });
    (p.links ?? []).forEach((l, j) => { if (!/^https?:\/\//.test(l.url)) errors.push(`projects.${i}.links.${j}.url must be http(s)`); });
  });
  (cv?.contact?.emails ?? []).forEach((e, i) => { if (!EMAIL.test(e)) errors.push(`contact.emails.${i} is not an email`); });
  for (const [k, v] of Object.entries(cv?.contact ?? {})) {
    if (k !== "emails" && v && !HTTP.test(v)) errors.push(`contact.${k} url must be http(s)`);
  }
  (cv?.identifiers ?? []).forEach((x, i) => { if (!HTTP.test(x.url)) errors.push(`identifiers.${i}.url must be http(s)`); });
  return { errors, warnings: emptyPaths(cv ?? {}) };
}

const sectionHead = (id, n) =>
  `<header class="sec-head"><span class="sec-no">§ ${String(n).padStart(2, "0")}</span><h2>${bi(UI[id])}</h2></header>`;

const wrap = (id, n, body) => `<section id="${id}" class="sec reveal">${sectionHead(id, n)}${body}</section>`;

function hero(cv) {
  const p = cv.person;
  const name = isEmpty(p.name) ? bi(UI.nameFallback) : bi(p.name);
  const chips = cv.interests.map((i) => `<li>${bi(i.label)}</li>`).join("");
  return `<section class="hero"><div class="hero-in">
  <p class="eyebrow">${bi(p.role)}</p>
  <h1>${name}</h1>
  <p class="affil">${bi(p.affiliation)}</p>
  <p class="tagline">${bi(p.tagline)}</p>
  <ul class="chips" aria-label="Interests">${chips}</ul>
  <p class="pen" aria-hidden="true">${bi({ ko: "근거를 보여 주는 도구를 만듭니다 →", en: "building tools that show the evidence →" })}</p>
</div></section>`;
}

const interestCard = (i) =>
  `<li class="card interest" data-id="${esc(i.id)}"><h3>${bi(i.label)}</h3><p>${bi(i.note)}</p></li>`;

const links = (ls = []) =>
  ls.map((l) => `<a class="btn-link" href="${esc(l.url)}" rel="noopener" target="_blank">${esc(l.label)} ↗</a>`).join("");

const stat = (s) =>
  `<li class="stat"><b>${esc(s.value)}</b><span>${bi(s.label)}</span><small>${bi(UI.source)}: ${esc(s.source)}</small></li>`;

function projectCard(p) {
  const hl = (p.highlights ?? []).map((h) => `<li>${bi(h)}</li>`).join("");
  const stats = (p.stats ?? []).map(stat).join("");
  const stack = (p.stack ?? []).map((s) => `<li>${esc(s)}</li>`).join("");
  return `<article class="card project${p.featured ? " featured" : ""}">
  ${p.featured ? `<p class="tag">${bi(UI.featured)}</p>` : ""}
  <header><h3>${bi(p.name)}</h3><span class="mono period">${bi(p.period)}</span></header>
  <p class="summary">${bi(p.summary)}</p>
  <p class="role"><span class="mono">${bi(UI.role)}</span> ${bi(p.role)}</p>
  ${stats ? `<ul class="stats">${stats}</ul>` : ""}
  ${hl ? `<ul class="highlights">${hl}</ul>` : ""}
  ${stack ? `<ul class="stack">${stack}</ul>` : ""}
  <p class="links">${links(p.links)}</p>
</article>`;
}

const practiceCard = (x, i) =>
  `<li class="card practice"><span class="mono idx">0${i + 1}</span><h3>${bi(x.title)}</h3><p>${bi(x.body)}</p></li>`;

const skillGroup = (g) =>
  `<div class="skill-group"><h3>${bi(g.group)}</h3><ul class="stack">${g.items.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>`;

const timelineItem = (t) =>
  `<li><time class="mono" datetime="${esc(t.date)}">${esc(t.date)}</time><p>${bi(t.text)}</p><small>${bi(UI.source)}: ${esc(t.source)}</small></li>`;

const eduItem = (e) =>
  `<li class="card edu"><h3>${bi(e.org)}</h3><p>${bi(e.degree)}</p><span class="mono period">${bi(e.period)}</span></li>`;

const pubItem = (p) =>
  `<li><span class="mono">${esc(p.year ?? "")}</span> ${p.url ? `<a href="${esc(p.url)}" rel="noopener" target="_blank">${esc(p.title)}</a>` : esc(p.title)} <em>${esc(p.venue ?? "")}</em></li>`;

const idCard = (x) =>
  `<li class="card ident" data-id="${esc(x.id)}"><span class="mono">${esc(x.label)}</span><a href="${esc(x.url)}" rel="noopener" target="_blank"><b>${esc(x.value)}</b> ↗</a></li>`;

function publications(cv) {
  const list = cv.publications ?? [];
  const ids = cv.identifiers ?? [];
  if (!list.length && !ids.length) return `<p class="empty">${bi("")}</p>`;
  return [
    list.length ? `<ol class="pubs">${list.map(pubItem).join("")}</ol>` : "",
    ids.length && cv.publicationsNote ? `<p class="note">${bi(cv.publicationsNote)}</p>` : "",
    ids.length ? `<ul class="grid g2 idents">${ids.map(idCard).join("")}</ul>` : "",
  ].join("");
}

function contactBlock(c, ids = []) {
  const row = (label, val, href) =>
    `<li><span class="mono">${esc(label)}</span><a href="${esc(href)}" rel="noopener">${esc(val.replace(HTTP, ""))}</a></li>`;
  const emails = (c.emails ?? []).map((e) => row("Email", e, `mailto:${e}`));
  const gh = c.github ? [row("GitHub", c.github, c.github)] : [];
  const orcid = ids.filter((x) => x.id === "orcid").map((x) => row(x.label, x.value, x.url));
  const rows = [...emails, ...gh, ...orcid];
  return rows.length ? `<ul class="contact">${rows.join("")}</ul>` : `<p class="empty">${bi("")}</p>`;
}

function body(cv) {
  const parts = {
    about: `<p class="lead">${bi(cv.about)}</p>`,
    interests: `<ul class="grid g4">${cv.interests.map(interestCard).join("")}</ul>`,
    projects: `<div class="projects">${cv.projects.map(projectCard).join("")}</div>`,
    practice: `<ol class="grid g2">${(cv.practice ?? []).map(practiceCard).join("")}</ol>`,
    skills: `<div class="grid g2">${cv.skills.map(skillGroup).join("")}</div>`,
    timeline: `<ol class="timeline">${cv.timeline.map(timelineItem).join("")}</ol>`,
    education: `<ul class="grid g2">${(cv.education ?? []).map(eduItem).join("")}</ul>`,
    publications: publications(cv),
    contact: contactBlock(cv.contact ?? {}, cv.identifiers),
  };
  return SECTIONS.map((id, i) => wrap(id, i + 1, parts[id])).join("\n");
}

const nav = () =>
  `<nav class="nav" aria-label="Sections"><ul>${SECTIONS.filter((s) => s !== "publications")
    .map((s) => `<li><a href="#${s}">${bi(UI[s])}</a></li>`).join("")}</ul></nav>`;

export function renderPage(cv) {
  const title = `${plain(cv.person.name) || plain(UI.nameFallback)} · ${plain(cv.person.affiliation)}`;
  return `<!doctype html>
<html lang="ko" data-lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(plain(cv.person.tagline))}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(plain(cv.person.tagline, "en"))}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/pretendard-variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/styles.css">
<script>try{var t=localStorage.getItem("cv-theme");if(t)document.documentElement.dataset.theme=t;var l=localStorage.getItem("cv-lang");if(l){document.documentElement.dataset.lang=l;document.documentElement.lang=l}}catch(e){}</script>
</head>
<body>
<a class="skip" href="#about">${bi({ ko: "본문으로", en: "Skip to content" })}</a>
<div class="topbar"><div class="topbar-in">
  <a class="brand" href="#top" aria-label="Top"><img src="/favicon.svg" alt="" width="20" height="20"><span class="mono">CV</span></a>
  ${nav()}
  <div class="tools">
    <button type="button" class="lang" data-action="lang" aria-label="Language">KO / EN</button>
    <button type="button" class="theme" data-action="theme" aria-label="${esc(plain(UI.theme))}">◐</button>
  </div>
</div></div>
<main id="top">
${hero(cv)}
<div class="wrap">
${body(cv)}
</div>
</main>
<footer class="foot"><div class="wrap"><p class="mono">${bi(UI.updated)} ${esc(cv.meta?.updated ?? "")} · ${bi({ ko: "INGO v10 디자인 토큰으로 제작", en: "Built with INGO v10 design tokens" })}</p></div></footer>
<script src="/site.js" defer></script>
</body>
</html>
`;
}
