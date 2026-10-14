import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { esc, bi, emptyPaths, validate, renderPage, groupByYear } from "../src/render.mjs";

const cv = JSON.parse(readFileSync(new URL("../cv.json", import.meta.url), "utf8"));
const html = renderPage(cv);

test("esc escapes HTML-significant characters", () => {
  assert.equal(esc(`<a href="x">&'</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
});

test("bi renders both languages and a placeholder for empty text", () => {
  assert.equal(bi({ ko: "가", en: "A" }), '<span data-l="ko">가</span><span data-l="en">A</span>');
  assert.equal(bi("Same"), "Same");
  assert.match(bi({ ko: "", en: "" }), /class="tbd"/);
  assert.doesNotMatch(bi({ ko: "<script>", en: "<b>" }), /<script>|<b>/);
});

test("emptyPaths lists every empty string so missing facts are visible", () => {
  assert.deepEqual(emptyPaths({ a: "", b: { c: "x", d: "" }, e: [""] }), ["a", "b.d", "e.0"]);
});

test("groupByYear sorts years newest first and keeps entry order inside a year", () => {
  const g = groupByYear([{ year: 2025, n: 1 }, { year: 2026, n: 2 }, { year: 2026, n: 3 }]);
  assert.deepEqual(g.map((x) => x.year), [2026, 2025]);
  assert.deepEqual(g[0].items.map((i) => i.n), [2, 3]);
});

test("validate accepts the real cv.json and rejects a CV without required parts", () => {
  assert.deepEqual(validate(cv).errors, []);
  assert.ok(validate({}).errors.length > 0);
});

test("validate requires every record entry to be verifiable or marked self-reported", () => {
  const broken = structuredClone(cv);
  delete broken.record[0].doi;
  assert.ok(validate(broken).errors.some((e) => e.includes("record.0")));
  broken.record[0].selfReported = true;
  assert.deepEqual(validate(broken).errors.filter((e) => e.includes("record.0")), []);
});

test("validate rejects bad year, malformed emails and non-http links", () => {
  const broken = structuredClone(cv);
  broken.record[0].year = "2026";
  broken.contact.emails = ["not-an-email"];
  broken.identifiers[0].url = "ftp://x";
  const { errors } = validate(broken);
  for (const k of ["record.0.year", "emails", "identifiers"]) assert.ok(errors.some((e) => e.includes(k)), k);
});

test("renderPage has every section, the real name and affiliation", () => {
  for (const id of ["about", "record", "education", "projects", "skills", "contact"]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.match(html, /<title>Bokeum Jung · /);
  assert.match(html, /충남대학교 의과대학/);
  assert.match(html, /Chungnam National University College of Medicine/);
  assert.match(html, /<html lang="ko" data-lang="ko">/);
});

test("record is grouped by year, newest first, with DOI links for every paper", () => {
  const rec = html.slice(html.indexOf('id="record"'), html.indexOf('id="education"'));
  assert.ok(rec.indexOf(">2026<") < rec.indexOf(">2025<"));
  for (const p of cv.record.filter((r) => r.type === "paper")) {
    assert.ok(rec.includes(`href="https://doi.org/${p.doi}"`), p.doi);
    assert.ok(rec.includes(esc(p.title)), p.title);
  }
});

test("the researcher's own name is highlighted in author lists", () => {
  assert.match(html, /<b class="me">Jung B<\/b>/);
  assert.equal((html.match(/class="me"/g) || []).length, cv.record.filter((r) => r.type === "paper").length);
});

test("paper count shown in the summary matches the data", () => {
  const n = cv.record.filter((r) => r.type === "paper").length;
  assert.match(html, new RegExp(`data-count="papers" data-to="${n}">${n}<`));
});

test("private INGO details stay out of the public page", () => {
  for (const leak of [/\bT-\d{3}\b/, /PHI 0/, /spec\/adr/, /ingo-lab\/ingo\b/, /Evidence Clock/, /Lab Universe/, /Lab OS/, /IACUC/, /plan\/roadmap/]) {
    assert.doesNotMatch(html, leak, String(leak));
  }
});

test("both projects appear only as short summaries", () => {
  const proj = html.slice(html.indexOf('id="projects"'), html.indexOf('id="skills"'));
  assert.match(proj, /INGO Research/);
  assert.match(proj, /GuideOne/);
  assert.ok(proj.length < 2500, `projects section too long: ${proj.length}`);
});

test("renderPage links every email with mailto and every researcher ID", () => {
  for (const e of cv.contact.emails) assert.ok(html.includes(`href="mailto:${e}"`), e);
  for (const x of cv.identifiers) {
    assert.ok(html.includes(`href="${x.url}"`), x.url);
    assert.ok(html.includes(x.value), x.value);
  }
});

test("renderPage cites where the publication list came from", () => {
  assert.match(html, /Europe PMC/);
});

test("asset paths are relative so the site works under a subpath (GitHub Pages)", () => {
  assert.doesNotMatch(html, /(href|src)="\/[^/]/);
  const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /url\("\//);
});

const withPatent = () => {
  const c = structuredClone(cv);
  c.record.push({ year: 2024, type: "patent", title: "Sample patent title", inventors: ["Jung B"], number: "10-2024-0000000", country: "KR" });
  return c;
};

test("patents are supported: need a number or link, shown with a patent label and counted", () => {
  const c = withPatent();
  assert.deepEqual(validate(c).errors, []);
  const page = renderPage(c);
  assert.match(page, /Sample patent title/);
  assert.match(page, /10-2024-0000000/);
  assert.match(page, /data-count="patents" data-to="1">1</);
  delete c.record.at(-1).number;
  assert.ok(validate(c).errors.some((e) => e.includes(`record.${c.record.length - 1}`)));
});

test("the patent count is not shown while there are no patents", () => {
  assert.doesNotMatch(html, /data-count="patents"/);
});

test("a fixed table of contents links to every section and each target exists", () => {
  const toc = html.slice(html.indexOf('class="toc"'), html.indexOf("</nav>", html.indexOf('class="toc"')));
  for (const id of ["about", "record", "education", "projects", "skills", "contact"]) {
    assert.ok(toc.includes(`href="#${id}"`), `toc → ${id}`);
    assert.match(html, new RegExp(`<section id="${id}"`), `section ${id}`);
  }
});

test("lab experience is listed in the year it started, with its period", () => {
  const lab = cv.record.find((r) => r.type === "lab");
  assert.ok(lab, "cv.json has a lab entry");
  const rec = html.slice(html.indexOf('id="record"'), html.indexOf('id="education"'));
  assert.match(rec, /kind-lab/);
  assert.match(rec, /2024\.02 – 2025\.07/);
  assert.ok(rec.indexOf(">2025<") < rec.indexOf(">2024<"));
});

test("lab entry shows how many listed papers share its PI as co-author (derived, not typed)", () => {
  const lab = cv.record.find((r) => r.type === "lab");
  const n = cv.record.filter((r) => r.type === "paper" && r.authors.includes(lab.coauthor)).length;
  assert.ok(n > 0);
  assert.match(html, new RegExp(`data-lab-papers="${n}"`));
});

test("each paper states the researcher's author position and a one-line topic", () => {
  for (const p of cv.record.filter((r) => r.type === "paper")) {
    const pos = p.authors.indexOf(cv.myName) + 1;
    assert.ok(html.includes(`data-pos="${pos}/${p.authors.length}"`), `${pos}/${p.authors.length}`);
    assert.ok(p.topic?.ko && p.topic?.en, `topic for ${p.doi}`);
    assert.ok(html.includes(esc(p.topic.en)), p.doi);
  }
});

test("count-up numbers keep their final value in the HTML (works without JS)", () => {
  assert.match(html, /<b data-count="papers" data-to="3">3<\/b>/);
});
