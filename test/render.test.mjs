import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { esc, bi, emptyPaths, validate, renderPage } from "../src/render.mjs";

const cv = JSON.parse(readFileSync(new URL("../cv.json", import.meta.url), "utf8"));

test("esc escapes HTML-significant characters", () => {
  assert.equal(esc(`<a href="x">&'</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
});

test("bi renders both languages and a placeholder for empty text", () => {
  assert.equal(bi({ ko: "가", en: "A" }), '<span data-l="ko">가</span><span data-l="en">A</span>');
  assert.equal(bi("Same"), "Same");
  assert.match(bi({ ko: "", en: "" }), /class="tbd"/);
  assert.match(bi(""), /준비 중/);
});

test("bi escapes user content", () => {
  assert.doesNotMatch(bi({ ko: "<script>", en: "<b>" }), /<script>|<b>/);
});

test("emptyPaths lists every empty string so missing facts are visible", () => {
  const paths = emptyPaths({ a: "", b: { c: "x", d: "" }, e: [""] });
  assert.deepEqual(paths, ["a", "b.d", "e.0"]);
});

test("validate rejects a CV without the required sections", () => {
  assert.ok(validate({}).errors.length > 0);
  assert.deepEqual(validate(cv).errors, []);
});

test("validate requires a source on every stat and timeline entry", () => {
  const broken = structuredClone(cv);
  broken.timeline[0].source = "";
  assert.ok(validate(broken).errors.some((e) => e.includes("timeline.0.source")));
});

test("validate rejects non-http links", () => {
  const broken = structuredClone(cv);
  broken.projects[0].links[0].url = "javascript:alert(1)";
  assert.ok(validate(broken).errors.some((e) => e.includes("url")));
});

test("renderPage contains every section and the real affiliation", () => {
  const html = renderPage(cv);
  for (const id of ["about", "interests", "projects", "practice", "skills", "timeline", "education", "publications", "contact"]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.match(html, /충남대학교 의과대학/);
  assert.match(html, /Chungnam National University College of Medicine/);
  assert.match(html, /INGO Research/);
  assert.match(html, /<html lang="ko" data-lang="ko">/);
});

test("renderPage never invents publication entries", () => {
  const html = renderPage({ ...cv, publications: [] });
  assert.doesNotMatch(html, /class="pubs"/);
  const bare = renderPage({ ...cv, publications: [], identifiers: [] });
  assert.match(bare.slice(bare.indexOf('id="publications"')), /class="tbd"/);
});

test("renderPage cites a source next to every stat", () => {
  const html = renderPage(cv);
  for (const s of cv.projects[0].stats) assert.ok(html.includes(esc(s.source)), s.source);
});

test("renderPage shows the name in the hero and the <title>", () => {
  const html = renderPage(cv);
  assert.match(html, /<title>Bokeum Jung · /);
  assert.match(html, /<h1>(<span data-l="ko">)?Bokeum Jung/);
});

test("renderPage links every email with mailto", () => {
  const html = renderPage(cv);
  for (const e of cv.contact.emails) assert.ok(html.includes(`href="mailto:${e}"`), e);
});

test("renderPage lists researcher IDs with links in the publications section", () => {
  const html = renderPage(cv);
  const pubs = html.slice(html.indexOf('id="publications"'), html.indexOf('id="contact"'));
  assert.match(pubs, /0009-0003-8264-3228/);
  assert.match(pubs, /href="https:\/\/orcid\.org\/0009-0003-8264-3228"/);
  assert.match(pubs, /RHD-7236-2026/);
});

test("validate rejects malformed emails and non-http identifier links", () => {
  const broken = structuredClone(cv);
  broken.contact.emails = ["not-an-email"];
  broken.identifiers[0].url = "ftp://x";
  const { errors } = validate(broken);
  assert.ok(errors.some((e) => e.includes("emails")));
  assert.ok(errors.some((e) => e.includes("identifiers")));
});
