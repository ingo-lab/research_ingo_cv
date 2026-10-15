// cv.json → a standalone, print-ready A4 CV (one language per document). Pure functions, no dependencies.
// build.mjs writes cv-ko.html / cv-en.html; scripts/make-pdf.mjs turns them into the downloadable PDFs.
import { esc, plain, withStudyYear, pdfName } from "./render.mjs";

const L = {
  education: { ko: "학력", en: "Education" },
  experience: { ko: "연구 경험", en: "Research experience" },
  publications: { ko: "논문", en: "Publications" },
  preprints: { ko: "프리프린트", en: "Preprints" },
  patents: { ko: "특허", en: "Patents" },
  projects: { ko: "프로젝트", en: "Projects" },
  skills: { ko: "기술 · 관심 분야", en: "Skills & interests" },
  interests: { ko: "관심 분야", en: "Interests" },
  review: { ko: "리뷰", en: "Review" },
  first: { ko: "제1저자", en: "First author" },
  ongoing: { ko: "진행 중", en: "Ongoing" },
  labPapers: { ko: "공동 논문", en: "co-authored papers" },
  updated: { ko: "갱신", en: "Updated" },
  self: { ko: "본인 기재", en: "Self-reported" },
};
const t = (k, lang) => L[k][lang];
const val = (v, lang) => esc(plain(v, lang));

const when = (r, lang) => (r.ongoing ? t("ongoing", lang) : r.month ? `${r.year}.${String(r.month).padStart(2, "0")}` : String(r.year));
const byDateDesc = (a, b) => b.year - a.year || (b.month ?? 0) - (a.month ?? 0);

const row = (date, inner) => `<div class="row"><div class="when">${date}</div><div class="what">${inner}</div></div>`;
const section = (title, inner) => (inner ? `<section><h2>${esc(title)}</h2>${inner}</section>` : "");
const who = (names = [], me) => names.map((n) => (n === me ? `<b>${esc(n)}</b>` : esc(n))).join(", ");

function education(cv, lang) {
  return (cv.education ?? [])
    .map((e) => {
      const steps = (e.steps ?? []).map((s) => `<li><span class="mono">${esc(s.date)}</span> ${val(s.text, lang)}</li>`).join("");
      return row(val(e.period, lang), `<p class="t">${val(e.org, lang)}</p><p>${val(e.degree, lang)}</p>${steps ? `<ul class="steps">${steps}</ul>` : ""}`);
    })
    .join("");
}

function experience(cv, lang) {
  const items = cv.record.filter((r) => r.type === "lab" || r.type === "program").sort((a, b) => Number(Boolean(b.ongoing)) - Number(Boolean(a.ongoing)) || byDateDesc(a, b));
  return items
    .map((r) => {
      const n = r.coauthor ? cv.record.filter((x) => x.type === "paper" && (x.authors ?? []).includes(r.coauthor)).length : 0;
      const extra = n ? ` · ${n} ${t("labPapers", lang)}` : "";
      return row(r.period ? val(r.period, lang) : when(r, lang), `<p class="t">${val(r.title, lang)}</p><p>${val(r.text, lang)}${extra}</p>`);
    })
    .join("");
}

function paperLine(r, i, cv, lang) {
  const badge = r.subtype === "review" ? ` <span class="tag">${t("review", lang)}</span>` : "";
  const first = r.authors?.[0] === cv.myName ? ` <span class="tag">${t("first", lang)}</span>` : "";
  const ids = [r.doi && `doi:${esc(r.doi)}`, r.pmid && `PMID ${esc(r.pmid)}`].filter(Boolean).join(" · ");
  return `<li value="${i}"><p>${who(r.authors, cv.myName)}. ${esc(r.title)} <i>${esc(r.venue ?? "")}</i>. ${when(r, lang)}.${badge}${first}</p>${ids ? `<p class="ids mono">${ids}</p>` : ""}</li>`;
}

function publications(cv, lang) {
  const papers = cv.record.filter((r) => r.type === "paper" && r.subtype !== "preprint").sort(byDateDesc);
  const pre = cv.record.filter((r) => r.type === "paper" && r.subtype === "preprint").sort(byDateDesc);
  const list = (items) => `<ol class="pubs" reversed>${items.map((r, i) => paperLine(r, items.length - i, cv, lang)).join("")}</ol>`;
  return section(t("publications", lang), papers.length ? list(papers) : "") + section(t("preprints", lang), pre.length ? list(pre) : "");
}

function patents(cv, lang) {
  const items = cv.record.filter((r) => r.type === "patent").sort(byDateDesc);
  const body = items
    .map((r) => {
      const link = r.lensId ? `<p class="ids mono">lens.org/lens/patent/${esc(r.lensId)}</p>` : r.number ? `<p class="ids mono">${esc(r.number)}</p>` : "";
      return row(when(r, lang), `<p class="t">${esc(r.title)}</p>${r.inventors?.length ? `<p>${who(r.inventors, cv.myName)}</p>` : ""}${link}`);
    })
    .join("");
  return section(t("patents", lang), body);
}

function projects(cv, lang) {
  const body = (cv.projects ?? [])
    .map((p) => {
      const chips = [...(p.topics ?? []).map((x) => plain(x, lang)), ...(p.stack ?? [])].map(esc).join(" · ");
      return row(p.period ? val(p.period, lang) : "", `<p class="t">${esc(p.name)} <span class="role">${val(p.role, lang)}</span></p><p>${val(p.summary, lang)}</p>${chips ? `<p class="ids">${chips}</p>` : ""}`);
    })
    .join("");
  return section(t("projects", lang), body);
}

function skills(cv, lang) {
  const groups = (cv.skills ?? []).map((g) => row(val(g.group, lang), `<p>${g.items.map(esc).join(" · ")}</p>`)).join("");
  const interests = (cv.interests ?? []).length ? row(t("interests", lang), `<p>${cv.interests.map((i) => val(i.label, lang)).join(" · ")}</p>`) : "";
  return section(t("skills", lang), groups + interests);
}

function contactLine(cv) {
  const parts = [
    ...(cv.contact?.emails ?? []).map(esc),
    ...(cv.identifiers ?? []).map((x) => `${esc(x.label)} ${esc(x.value)}`),
    cv.contact?.github && esc(cv.contact.github.replace(/^https?:\/\//, "")),
    cv.meta?.siteUrl && esc(cv.meta.siteUrl.replace(/^https?:\/\//, "")),
  ].filter(Boolean);
  return parts.join(" &nbsp;|&nbsp; ");
}

const CSS = `
@font-face { font-family: "Pretendard Variable"; src: url("fonts/pretendard-variable.woff2") format("woff2"); font-weight: 45 920; }
@font-face { font-family: "Source Serif 4"; src: url("fonts/source-serif-4-variable.woff2") format("woff2"); font-weight: 200 900; }
@page { size: A4; margin: 16mm 15mm 16mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #14213d; font: 400 9.6pt/1.5 "Pretendard Variable", system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
header.top { padding-bottom: 10px; border-bottom: 2px solid #2B4FA8; margin-bottom: 4px; }
h1 { margin: 0; font: 600 25pt/1.1 "Source Serif 4", Georgia, serif; letter-spacing: -.01em; }
.role-line { margin: 5px 0 0; font-weight: 600; color: #2B4FA8; }
.affil { margin: 1px 0 0; color: #4a5568; }
.contact { margin: 8px 0 0; font-size: 8.4pt; color: #4a5568; }
h2 { margin: 16px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #cbd5e1; font: 700 8.8pt/1.2 "Pretendard Variable", sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #2B4FA8; }
.row { display: grid; grid-template-columns: 31mm 1fr; gap: 10px; padding: 3px 0; break-inside: avoid; }
.when { color: #4a5568; font-size: 8.8pt; }
.what p { margin: 0; }
.t { font-weight: 650; }
.role { font-weight: 500; color: #4a5568; font-size: 8.8pt; margin-left: 6px; }
.steps { list-style: none; margin: 2px 0 0; padding: 0; color: #4a5568; font-size: 8.8pt; }
.mono, .ids { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 8pt; color: #4a5568; }
.pubs { margin: 0; padding-left: 7mm; }
.pubs li { padding: 2px 0; break-inside: avoid; }
.pubs li::marker { color: #4a5568; font-size: 8.8pt; }
.tag { display: inline-block; padding: 0 5px; border: 1px solid #2B4FA8; border-radius: 4px; color: #2B4FA8; font-size: 7.4pt; font-weight: 600; }
b { font-weight: 700; }
footer { margin-top: 18px; padding-top: 6px; border-top: 1px solid #cbd5e1; color: #6b7280; font-size: 8pt; }
`;

export function renderCv(input, { lang = "en", today = new Date() } = {}) {
  const cv = withStudyYear(input, today);
  const p = cv.person;
  const body = [
    section(t("education", lang), education(cv, lang)),
    section(t("experience", lang), experience(cv, lang)),
    publications(cv, lang),
    patents(cv, lang),
    projects(cv, lang),
    skills(cv, lang),
  ].join("");
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>${val(p.name, lang)} — CV</title>
<style>${CSS}</style>
</head>
<body>
<header class="top">
  <h1>${val(p.name, lang)}</h1>
  <p class="role-line">${val(p.role, lang)}</p>
  <p class="affil">${val(p.affiliation, lang)}</p>
  <p class="contact">${contactLine(cv)}</p>
</header>
${body}
<footer>${t("updated", lang)} ${esc(cv.meta?.updated ?? "")}${cv.meta?.siteUrl ? ` · ${esc(cv.meta.siteUrl)}` : ""}</footer>
</body>
</html>
`;
}
