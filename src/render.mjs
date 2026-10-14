// cv.json → one static HTML page. Pure functions, no dependencies.
// Every visible string is rendered in both languages; CSS shows the one picked in <html data-lang>.

const HTTP = /^https?:\/\//;
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i;
const TBD = { ko: "준비 중", en: "Coming soon" };
const UI = {
  record: "Research",
  education: "Education",
  projects: "Projects",
  skills: "Interests & Skills",
  contact: "Contact",
  paper: { ko: "논문", en: "Paper" },
  patent: { ko: "특허", en: "Patent" },
  project: { ko: "프로젝트", en: "Project" },
  lab: { ko: "연구실", en: "Lab" },
  program: { ko: "프로그램", en: "Program" },
  ongoing: { ko: "진행 중", en: "Ongoing" },
  review: { ko: "리뷰", en: "Review" },
  first: { ko: "제1저자", en: "First author" },
  monthUnknown: { ko: "월 미상", en: "Month unknown" },
  toc: "Contents",
  pos: { ko: "공저자", en: "Author" },
  labPapers: { ko: "함께한 공동 논문", en: "Co-authored papers with the lab" },
  papers: { ko: "논문", en: "Papers" },
  preprint: { ko: "프리프린트", en: "Preprint" },
  preprints: { ko: "프리프린트", en: "Preprints" },
  patents: { ko: "특허", en: "Patents" },
  selfReported: { ko: "본인 기재", en: "Self-reported" },
  updated: { ko: "갱신", en: "Updated" },
  synced: { ko: "ORCID 동기화", en: "ORCID sync" },
  theme: { ko: "테마 전환", en: "Toggle theme" },
  skip: { ko: "본문으로", en: "Skip to content" },
};
const SECTIONS = ["record", "education", "projects", "skills", "contact"];
const KINDS = ["paper", "patent", "project", "lab", "program"];

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

const byMonthDesc = (a, b) => monthKey(b) - monthKey(a);

export function groupByYear(items) {
  const years = [...new Set(items.map((i) => i.year))].sort((a, b) => b - a);
  return years.map((year) => ({ year, items: items.filter((i) => i.year === year).sort(byMonthDesc) }));
}

const ONGOING = 13; // internal group key: shown first, labelled "ongoing"
const monthKey = (i) => (i.ongoing ? ONGOING : i.month ?? 0);

export function groupByMonth(items) {
  const keys = [...new Set(items.map(monthKey))].sort((a, b) => (a === 0) - (b === 0) || b - a);
  return keys.map((month) => ({ month, items: items.filter((i) => monthKey(i) === month) }));
}

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_VIEW_MIN = 3; // a year with this many entries or more is split by month

const verifiable = (r) => Boolean(r.doi || r.url || r.number || r.lensId || r.selfReported);

export function validate(cv) {
  const errors = [];
  if (!cv?.person?.affiliation) errors.push("person.affiliation is required");
  for (const key of ["record", "projects", "skills", "interests"]) {
    if (!Array.isArray(cv?.[key])) errors.push(`${key} must be an array`);
  }
  (cv?.record ?? []).forEach((r, i) => {
    if (!Number.isInteger(r.year)) errors.push(`record.${i}.year must be an integer`);
    if (r.ongoing != null && typeof r.ongoing !== "boolean") errors.push(`record.${i}.ongoing must be true or false`);
    if (r.month != null && !(Number.isInteger(r.month) && r.month >= 1 && r.month <= 12)) errors.push(`record.${i}.month must be 1-12`);
    if (!KINDS.includes(r.type)) errors.push(`record.${i}.type must be one of ${KINDS.join("/")}`);
    if (!verifiable(r)) errors.push(`record.${i} needs doi, url, number, or selfReported`);
    if (r.url && !HTTP.test(r.url)) errors.push(`record.${i}.url must be http(s)`);
  });
  (cv?.contact?.emails ?? []).forEach((e, i) => { if (!EMAIL.test(e)) errors.push(`contact.emails.${i} is not an email`); });
  for (const [k, v] of Object.entries(cv?.contact ?? {})) {
    if (k !== "emails" && v && !HTTP.test(v)) errors.push(`contact.${k} url must be http(s)`);
  }
  (cv?.identifiers ?? []).forEach((x, i) => { if (!HTTP.test(x.url)) errors.push(`identifiers.${i}.url must be http(s)`); });
  return { errors, warnings: emptyPaths(cv ?? {}) };
}

const monogram = (name) =>
  plain(name, "en").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

const ext = (href, label) => `<a href="${esc(href)}" rel="noopener" target="_blank">${esc(label)}</a>`;

function authorLine(authors = [], me) {
  return authors.map((a) => (a === me ? `<b class="me">${esc(a)}</b>` : esc(a))).join(", ");
}

function recordLinks(r) {
  const l = [];
  if (r.doi) l.push(ext(`https://doi.org/${r.doi}`, "DOI"));
  if (r.pmid) l.push(ext(`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`, "PubMed"));
  if (r.lensId) l.push(ext(`https://www.lens.org/lens/patent/${r.lensId}`, "Lens"));
  if (r.url) l.push(ext(r.url, "Link"));
  return l.length ? `<p class="links">${l.join("")}</p>` : "";
}

const posOf = (r, me) => {
  const i = (r.authors ?? []).indexOf(me);
  return i < 0 ? "" : `${i + 1}/${r.authors.length}`;
};

function recordItem(r, me, all) {
  const when = r.ongoing ? `<span class="when mono">${bi(UI.ongoing)}</span>` : r.month ? `<span class="when mono">${r.year}.${String(r.month).padStart(2, "0")}</span>` : "";
  const review = r.subtype === "review" ? `<span class="kind kind-review">${bi(UI.review)}</span>` : r.subtype === "preprint" ? `<span class="kind kind-review">${bi(UI.preprint)}</span>` : "";
  const kind = `<p class="kinds"><span class="kind kind-${r.type}">${bi(UI[r.type])}</span>${review}${when}</p>`;
  const title = r.type === "paper" || r.type === "patent" ? esc(r.title) : bi(r.title);
  let meta = "";
  if (r.type === "paper") {
    const pos = posOf(r, me);
    meta = `${r.topic ? `<p class="topic">${bi(r.topic)}</p>` : ""}<p class="meta">${authorLine(r.authors, me)}</p>` +
      `<p class="venue">${esc(r.venue ?? "")}${pos ? ` · <span class="pos" data-pos="${pos}">${pos.startsWith("1/") ? bi(UI.first) : `${bi(UI.pos)} ${pos}`}</span>` : ""}</p>`;
  }
  if (r.type === "patent") {
    const bits = [r.number && `<span class="mono">${esc(r.number)}</span>`, r.country && esc(r.country), r.status && esc(r.status)].filter(Boolean);
    meta = `${r.inventors?.length ? `<p class="meta">${authorLine(r.inventors, me)}</p>` : ""}<p class="venue">${bits.join(" · ")}</p>`;
  }
  if (r.type === "program") meta = `${r.period ? `<p class="mono period">${bi(r.period)}</p>` : ""}<p class="topic">${bi(r.text)}</p><p class="self">${bi(UI.selfReported)}</p>`;
  if (r.type === "project") meta = `<p class="topic">${bi(r.text)}</p><p class="self">${bi(UI.selfReported)}</p>`;
  if (r.type === "lab") {
    const n = r.coauthor ? all.filter((x) => x.type === "paper" && (x.authors ?? []).includes(r.coauthor)).length : 0;
    meta = `<p class="mono period">${bi(r.period)}</p><p class="topic">${bi(r.text)}</p>` +
      (n ? `<p class="venue"><a href="#record" data-lab-papers="${n}">${bi(UI.labPapers)} ${n}</a></p>` : "") +
      `<p class="self">${bi(UI.selfReported)}</p>`;
  }
  return `<li class="item">${kind}<h4>${title}</h4>${meta}${recordLinks(r)}</li>`;
}

function counts(record) {
  const n = (t) => record.filter((r) => r.type === t).length;
  const years = record.map((r) => r.year);
  const cell = (key, v) => `<li><b data-count="${key}" data-to="${v}">${v}</b><span>${bi(UI[key])}</span></li>`;
  const pre = record.filter((r) => r.type === "paper" && r.subtype === "preprint").length;
  const cells = [cell("papers", n("paper") - pre)];
  if (pre) cells.push(cell("preprints", pre));
  if (n("patent")) cells.push(cell("patents", n("patent")));
  const span = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "";
  return `<ul class="counts">${cells.join("")}${span ? `<li><b>${esc(span)}</b><span>${bi({ ko: "기간", en: "Years" })}</span></li>` : ""}</ul>`;
}

function yearBlock(g, cv) {
  const list = (items) => `<ul class="items">${items.map((r) => recordItem(r, cv.myName, cv.record)).join("")}</ul>`;
  if (g.items.length < MONTH_VIEW_MIN) return list(g.items);
  const label = (m) => (m === ONGOING ? bi(UI.ongoing) : m ? bi({ ko: `${m}월`, en: MONTHS[m] }) : bi(UI.monthUnknown));
  const months = groupByMonth(g.items)
    .map((m) => `<li class="month" data-month="${m.month}"><h4 class="mo mono">${label(m.month)}</h4>${list(m.items)}</li>`)
    .join("");
  return `<ol class="months">${months}</ol>`;
}

function recordSection(cv) {
  const years = groupByYear(cv.record)
    .map((g) => `<li class="year"><h3 class="yr">${g.year}</h3>${yearBlock(g, cv)}</li>`)
    .join("");
  const note = cv.meta?.recordSource ? `<p class="note">${bi(cv.meta.recordSource)}</p>` : "";
  return `${counts(cv.record)}<ol class="years">${years}</ol>${note}`;
}

const eduItem = (e) => {
  const steps = (e.steps ?? []).map((s) => `<li><span class="mono">${esc(s.date)}</span><span>${bi(s.text)}</span></li>`).join("");
  return `<li class="edu"><h3>${bi(e.org)}</h3><p>${bi(e.degree)}</p>${e.period ? `<span class="mono period">${bi(e.period)}</span>` : ""}${steps ? `<ol class="steps">${steps}</ol>` : ""}</li>`;
};

const projectItem = (p) =>
  `<li class="proj"><div class="proj-head"><h3>${esc(p.name)}</h3>${p.period ? `<span class="mono period">${bi(p.period)}</span>` : ""}</div><p>${bi(p.summary)}</p><p class="role mono">${bi(p.role)}</p>${p.stack?.length ? `<ul class="stack">${p.stack.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}</li>`;

function skillsBlock(cv) {
  const chips = cv.interests.map((i) => `<li>${bi(i.label)}</li>`).join("");
  const groups = cv.skills
    .map((g) => `<div class="skill-group"><h3>${bi(g.group)}</h3><ul class="stack">${g.items.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>`)
    .join("");
  return `<ul class="chips">${chips}</ul><div class="skills">${groups}</div>`;
}

function allLinks(cv) {
  const row = (label, text, href) => `<li><span class="mono">${esc(label)}</span><a href="${esc(href)}" rel="noopener">${esc(text)}</a></li>`;
  const ids = (cv.identifiers ?? []).map((x) => row(x.label, x.value, x.url));
  const mails = (cv.contact?.emails ?? []).map((e) => row("Email", e, `mailto:${e}`));
  const gh = cv.contact?.github ? [row("GitHub", cv.contact.github.replace(HTTP, ""), cv.contact.github)] : [];
  return [...ids, ...mails, ...gh].join("");
}

function toc() {
  const items = SECTIONS.map((s, i) => `<li><a href="#${s}"><span class="mono">${String(i + 1).padStart(2, "0")}</span>${bi(UI[s])}</a></li>`).join("");
  return `<nav class="toc" aria-label="${esc(plain(UI.toc))}"><ol>${items}</ol></nav>`;
}

const tools = (cls) => `<div class="tools ${cls}">
    <button type="button" class="lang" data-action="lang" aria-label="Language">KO / EN</button>
    <button type="button" class="theme" data-action="theme" aria-label="${esc(plain(UI.theme))}">◐</button>
  </div>`;

function hero(cv) {
  const p = cv.person;
  return `<header class="hero" id="top">
  <div class="hero-in">
    <div class="mono-badge" aria-hidden="true">${esc(monogram(p.name))}</div>
    <p class="eyebrow">${bi(p.role)}</p>
    <h1>${bi(p.name)}</h1>
    <p class="affil">${bi(p.affiliation)}</p>
    <p class="intro">${bi(p.intro)}</p>
  </div>
</header>`;
}

const rail = () => `<aside class="rail">${toc()}</aside>`;

function body(cv) {
  const wrap = (id, inner) =>
    `<section id="${id}" class="sec reveal"><header class="sec-head"><h2>${bi(UI[id])}</h2></header>${inner}</section>`;
  return [
    wrap("record", recordSection(cv)),
    wrap("education", `<ul class="edus">${cv.education.map(eduItem).join("")}</ul>`),
    wrap("projects", `<ul class="projs">${cv.projects.map(projectItem).join("")}</ul>`),
    wrap("skills", skillsBlock(cv)),
    wrap("contact", `<ul class="ids wide">${allLinks(cv)}</ul>`),
  ].join("\n");
}

const nav = () =>
  `<nav class="nav" aria-label="Sections"><ul>${SECTIONS.map((s) => `<li><a href="#${s}">${bi(UI[s])}</a></li>`).join("")}</ul></nav>`;

export function renderPage(cv, opts = {}) {
  const v = opts.assetVersion ? `?v=${esc(opts.assetVersion)}` : "";
  const title = `${plain(cv.person.name)} · ${plain(cv.person.affiliation)}`;
  return `<!doctype html>
<html lang="ko" data-lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(plain(cv.person.intro))}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(plain(cv.person.intro, "en"))}">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preload" href="fonts/pretendard-variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="styles.css${v}">
<script>try{var t=localStorage.getItem("cv-theme");if(t)document.documentElement.dataset.theme=t;var l=localStorage.getItem("cv-lang");if(l){document.documentElement.dataset.lang=l;document.documentElement.lang=l}}catch(e){}</script>
</head>
<body>
<a class="skip" href="#record">${bi(UI.skip)}</a>
${tools("")}
<div class="topbar"><div class="topbar-in">
  <a class="brand" href="#top" aria-label="Top"><img src="favicon.svg" alt="" width="20" height="20"><span class="mono">CV</span></a>
  ${nav()}
</div></div>
${hero(cv)}
<div class="layout">
${rail()}
<main class="main">
${body(cv)}
<footer class="foot"><p class="mono">${bi(UI.updated)} ${esc(cv.meta?.updated ?? "")}${cv.meta?.syncedAt ? ` · <span data-synced="${esc(cv.meta.syncedAt)}">${bi(UI.synced)} ${esc(cv.meta.syncedAt)}</span>` : ""}</p></footer>
</main>
</div>
<script src="site.js${v}" defer></script>
</body>
</html>
`;
}
