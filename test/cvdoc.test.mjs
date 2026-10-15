import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderCv } from "../src/cvdoc.mjs";
import { renderPage, pdfName, stripPdfLinks } from "../src/render.mjs";
import { findChrome } from "../scripts/make-pdf.mjs";

const cv = JSON.parse(readFileSync(new URL("../cv.json", import.meta.url), "utf8"));
const today = new Date("2026-10-14");
const en = renderCv(cv, { lang: "en", today });
const ko = renderCv(cv, { lang: "ko", today });
const papers = cv.record.filter((r) => r.type === "paper" && r.subtype !== "preprint");

test("the CV document has the academic sections, one language per file", () => {
  for (const h of ["Education", "Research experience", "Publications", "Projects", "Skills &amp; interests"]) assert.ok(en.includes(`<h2>${h}</h2>`), h);
  for (const h of ["학력", "연구 경험", "논문", "프로젝트"]) assert.ok(ko.includes(`<h2>${h}</h2>`), h);
  assert.ok(!en.includes("충남대학교") && en.includes("Chungnam National University College of Medicine"));
  assert.ok(!ko.includes("Medical student"));
});

test("publications are numbered newest first with the owner's name in bold; reviews are tagged", () => {
  const lis = en.match(/<li value="\d+">/g) || [];
  assert.ok(lis.length >= papers.length);
  assert.match(en, new RegExp(`<li value="${papers.length}">`));
  assert.ok(en.indexOf(papers.find((p) => p.title.startsWith("Mitophagy")).title) < en.indexOf("Inflammasomes and pyroptosis"));
  assert.match(en, /<b>Jung B<\/b>/);
  assert.match(en, /class="tag">Review</);
});

test("the CV carries the lab (Prof. Jo) and the program with its advisor, and resolves the year of study", () => {
  assert.match(en, /Lab of Prof\. Eun-Kyeong Jo/);
  assert.match(ko, /조은경 교수님 연구실/);
  assert.match(ko, /지도교수: 구태윤 교수님 \(KAIST\)/);
  assert.ok(!en.includes("{year}") && !ko.includes("{year}"));
  assert.match(ko, /의학과 1학년/);
  assert.doesNotMatch(ko, /졸업 때까지/);
});

test("patents show their Lens address; every project lists topics and stack", () => {
  const c = structuredClone(cv);
  c.record.push({ year: 2025, type: "patent", title: "Sample patent", lensId: "133-544-147-073-270" });
  assert.match(renderCv(c, { lang: "en", today }), /lens\.org\/lens\/patent\/133-544-147-073-270/);
  for (const p of cv.projects) for (const s of p.stack) assert.ok(en.includes(s), s);
});

test("the CV document is self-contained text with no scripts and escapes its content", () => {
  assert.doesNotMatch(en, /<script/i);
  const c = structuredClone(cv);
  c.record[0].title = "<img src=x onerror=alert(1)>";
  assert.ok(!renderCv(c, { lang: "en", today }).includes("<img src=x"));
});

test("the site offers the PDF in both languages in the rail and in Contact, and the buttons can be stripped", () => {
  const html = renderPage(cv, { today });
  assert.equal(pdfName(cv, "en"), "Bokeum-Jung-CV-en.pdf");
  assert.equal((html.match(/href="Bokeum-Jung-CV-(ko|en)\.pdf"/g) || []).length, 4);
  assert.ok(html.slice(html.indexOf('<aside class="rail"'), html.indexOf("</aside>")).includes("Bokeum-Jung-CV-en.pdf"));
  assert.ok(html.slice(html.indexOf('id="contact"')).includes("Bokeum-Jung-CV-ko.pdf"));
  const stripped = stripPdfLinks(html);
  assert.ok(!stripped.includes(".pdf") && !stripped.includes("<!--pdf-->"));
});

test("findChrome picks the first existing browser and returns empty when none exists", () => {
  assert.equal(findChrome(() => false), "");
  assert.equal(findChrome((p) => p === "/usr/bin/chromium"), "/usr/bin/chromium");
});
