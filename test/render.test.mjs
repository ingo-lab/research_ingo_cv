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
  for (const id of ["record", "education", "projects", "skills", "contact"]) {
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
  for (const id of ["record", "education", "projects", "skills", "contact"]) {
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
  const n = cv.record.filter((r) => r.type === "paper").length;
  assert.match(html, new RegExp(`<b data-count="papers" data-to="${n}">${n}</b>`));
});

const side = () => html.slice(html.indexOf("<aside"), html.indexOf("</aside>"));

test("the profile is a full-height left panel placed before the content", () => {
  assert.ok(html.indexOf("<aside") > 0 && html.indexOf("<aside") < html.indexOf("<main"));
  assert.match(html, /<aside class="side"/);
});

test("the left panel carries the name, a personal intro, and every link", () => {
  const s = side();
  assert.match(s, /Bokeum Jung/);
  assert.ok(s.includes(esc(cv.person.intro.en)), "intro (en)");
  assert.ok(s.includes(esc(cv.person.intro.ko)), "intro (ko)");
  for (const x of cv.identifiers) assert.ok(s.includes(`href="${x.url}"`), x.url);
  for (const e of cv.contact.emails) assert.ok(s.includes(`href="mailto:${e}"`), e);
  assert.ok(s.includes(`href="${cv.contact.github}"`), "github");
});

test("the intro is about the person, not a slogan: affiliation, interests and the lab", () => {
  const ko = cv.person.intro.ko;
  assert.match(ko, /충남대학교 의과대학/);
  assert.match(ko, /조은경 교수/);
  assert.match(ko, /2024/);
  assert.ok(ko.length > 80);
});

test("there is no separate About section duplicating the intro", () => {
  assert.doesNotMatch(html, /id="about"/);
});

// ---- months: years with 3+ entries are split by month ----
import { groupByMonth } from "../src/render.mjs";

test("groupByMonth sorts months newest first and puts entries without a month last", () => {
  const g = groupByMonth([{ month: 2, n: 1 }, { n: 2 }, { month: 10, n: 3 }, { month: 2, n: 4 }]);
  assert.deepEqual(g.map((x) => x.month), [10, 2, 0]);
  assert.deepEqual(g[1].items.map((i) => i.n), [1, 4]);
});

test("a year with three or more entries is shown month by month, newest first", () => {
  const rec = html.slice(html.indexOf('id="record"'), html.indexOf('id="education"'));
  const y2026 = cv.record.filter((r) => r.year === 2026);
  assert.ok(y2026.length >= 3, "fixture: 2026 has 3+ entries");
  const key = (r) => (r.ongoing ? 13 : r.month ?? 0);
  const months = [...new Set(y2026.map(key))].sort((a, b) => (a === 0) - (b === 0) || b - a);
  const seen = [...rec.matchAll(/data-month="(\d+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(seen.slice(0, months.length), months);
});

test("a year with fewer than three entries has no month headings", () => {
  const small = structuredClone(cv);
  small.record = small.record.filter((r) => r.year !== 2026);
  assert.doesNotMatch(renderPage(small), /data-month=/);
  const two = structuredClone(cv);
  two.record = cv.record.filter((r) => r.year === 2026).slice(0, 2);
  assert.doesNotMatch(renderPage(two), /data-month=/);
});

test("exactly three entries in a year triggers the month view", () => {
  const three = structuredClone(cv);
  three.record = cv.record.filter((r) => r.year === 2026).slice(0, 3);
  assert.match(renderPage(three), /data-month=/);
});

test("every entry shows its year.month when known", () => {
  const rec = html.slice(html.indexOf('id="record"'), html.indexOf('id="education"'));
  for (const r of cv.record.filter((x) => x.month)) {
    assert.ok(rec.includes(`${r.year}.${String(r.month).padStart(2, "0")}`), `${r.year}.${r.month}`);
  }
});

test("validate rejects a month outside 1-12", () => {
  const bad = structuredClone(cv);
  bad.record[0].month = 13;
  assert.ok(validate(bad).errors.some((e) => e.includes("record.0.month")));
});

test("the most recent paper (first author) is on the page, with a first-author label and review badge", () => {
  const p = cv.record.find((r) => r.doi === "10.1038/s12276-026-01852-7");
  assert.ok(p, "cv.json has the Oct 2026 review");
  assert.equal(p.authors[0], cv.myName);
  assert.match(html, /Mitophagy in pathogenesis/);
  assert.match(html, /data-pos="1\/7"/);
  assert.match(html, /제1저자/);
  assert.match(html, /kind-review/);
});

test("an empty education period renders nothing instead of a placeholder", () => {
  const edu = html.slice(html.indexOf('id="education"'), html.indexOf('id="projects"'));
  assert.doesNotMatch(edu, /class="tbd"/);
});

// ---- clean, bright look: blue only at the top, no grid pattern ----
test("the stylesheet has no grid pattern backgrounds", () => {
  const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /background-size:\s*\d+px\s+\d+px/);
  assert.doesNotMatch(css, /linear-gradient\(\s*var\(--emulsion-faint\)/);
});

test("the blue name block is at the very top of the left panel, with the intro and links below it", () => {
  const s = html.slice(html.indexOf("<aside"), html.indexOf("</aside>"));
  const top = s.indexOf('class="side-top"');
  const body = s.indexOf('class="side-body"');
  assert.ok(top >= 0 && body > top, "side-top then side-body");
  const topHtml = s.slice(top, body);
  assert.match(topHtml, /<h1>/);
  assert.doesNotMatch(topHtml, /class="intro"/);
  const bodyHtml = s.slice(body);
  for (const k of ['class="intro"', 'class="side-links"', 'class="toc"']) assert.ok(bodyHtml.includes(k), k);
});

test("the left panel's body is not painted with the brand blue (blue stays at the top)", () => {
  const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  const rule = /\.side\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  assert.doesNotMatch(rule, /var\(--(cyanotype|prussian)\)/);
});

// ---- honorific + ongoing program ----
test('Korean text always says "교수님" for the professor (never a bare "교수")', () => {
  assert.doesNotMatch(JSON.stringify(cv), /조은경 교수(?!님)/);
  assert.doesNotMatch(html, /조은경 교수(?!님)/);
  assert.match(html, /조은경 교수님 연구실/);
});

test("KCHAMPf is listed as a current program, with nothing invented about it", () => {
  const k = cv.record.find((r) => /KCHAMPf/.test(JSON.stringify(r.title)));
  assert.ok(k, "cv.json has a KCHAMPf entry");
  assert.equal(k.type, "program");
  assert.equal(k.ongoing, true);
  assert.equal(k.selfReported, true);
  assert.match(html, /KCHAMPf/);
  assert.match(html, /kind-program/);
});

test("ongoing entries form their own first group inside a month-split year, never 'month unknown'", () => {
  const rec = html.slice(html.indexOf('id="record"'), html.indexOf('id="education"'));
  const y2026 = rec.slice(rec.indexOf(">2026<"), rec.indexOf(">2025<"));
  const first = /data-month="(\d+)"/.exec(y2026)?.[1];
  assert.equal(first, "13");
  assert.match(y2026, /진행 중/);
  assert.doesNotMatch(y2026, /월 미상/);
});

test("an ongoing entry shows 'ongoing' instead of a made-up month", () => {
  const rec = html.slice(html.indexOf('id="record"'), html.indexOf('id="education"'));
  const k = rec.slice(rec.indexOf("KCHAMPf") - 400, rec.indexOf("KCHAMPf") + 200);
  assert.match(k, /진행 중/);
  assert.doesNotMatch(k, /2026\.\d\d/);
});

test("validate accepts program entries and rejects a bad ongoing flag", () => {
  const ok = structuredClone(cv);
  assert.deepEqual(validate(ok).errors, []);
  const bad = structuredClone(cv);
  bad.record.find((r) => r.ongoing).ongoing = "yes";
  assert.ok(validate(bad).errors.some((e) => e.includes("ongoing")));
});
