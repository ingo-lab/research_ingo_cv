import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normDoi, parseWorks, parseEpmc, mergeRecord } from "../src/orcid.mjs";
import { validate, renderPage } from "../src/render.mjs";

const cv = JSON.parse(readFileSync(new URL("../cv.json", import.meta.url), "utf8"));

// ASSUMPTION: shape of ORCID public API v3.0 /works (group[].work-summary[]) — verify on the first real sync.
const summary = (o) => ({
  "put-code": o.putCode,
  title: { title: { value: o.title } },
  type: o.type,
  "publication-date": o.year ? { year: { value: String(o.year) } } : null,
  "journal-title": o.venue ? { value: o.venue } : null,
  "external-ids": { "external-id": o.ids ?? [] },
  url: o.url ? { value: o.url } : null,
});
const orcidJson = {
  group: [
    { "work-summary": [summary({ putCode: 1, title: "New cohort paper", type: "JOURNAL_ARTICLE", year: 2026, venue: "Some Journal", ids: [{ "external-id-type": "doi", "external-id-value": "https://doi.org/10.1000/NEW.1" }] })] },
    { "work-summary": [summary({ putCode: 2, title: "Known paper", type: "JOURNAL_ARTICLE", year: 2025, ids: [{ "external-id-type": "doi", "external-id-value": cv.record.find((r) => r.doi).doi }] })] },
    { "work-summary": [summary({ putCode: 3, title: "A patent", type: "PATENT", year: 2024, ids: [{ "external-id-type": "other-id", "external-id-value": "KR 10-2024-0001234" }] })] },
    { "work-summary": [summary({ putCode: 4, title: "No proof at all", type: "JOURNAL_ARTICLE", year: 2023 })] },
    { "work-summary": [summary({ putCode: 5, title: "A dataset", type: "DATA_SET", year: 2023, ids: [{ "external-id-type": "doi", "external-id-value": "10.1000/ds" }] })] },
    { "work-summary": [summary({ putCode: 6, title: "No year paper", type: "JOURNAL_ARTICLE", ids: [{ "external-id-type": "doi", "external-id-value": "10.1000/ny" }] })] },
  ],
};

test("normDoi strips the resolver prefix and lowercases", () => {
  assert.equal(normDoi("https://doi.org/10.1000/ABC"), "10.1000/abc");
  assert.equal(normDoi(" 10.1000/ABC "), "10.1000/abc");
  assert.equal(normDoi(""), "");
});

test("parseWorks keeps verifiable papers and patents, skips the rest and says why", () => {
  const { record, skipped } = parseWorks(orcidJson);
  assert.deepEqual(record.map((r) => r.title).sort(), ["A patent", "Known paper", "New cohort paper"]);
  const paper = record.find((r) => r.title === "New cohort paper");
  assert.deepEqual([paper.type, paper.year, paper.doi, paper.venue], ["paper", 2026, "10.1000/new.1", "Some Journal"]);
  const patent = record.find((r) => r.type === "patent");
  assert.equal(patent.number, "KR 10-2024-0001234");
  assert.equal(skipped.length, 3);
  assert.ok(skipped.some((s) => /No proof/.test(s.title) && /identifier/.test(s.reason)));
  assert.ok(skipped.some((s) => /dataset/.test(s.title) && /type/.test(s.reason)));
  assert.ok(skipped.some((s) => /No year/.test(s.title) && /year/.test(s.reason)));
});

test("parseWorks tolerates an empty or malformed response", () => {
  assert.deepEqual(parseWorks({}).record, []);
  assert.deepEqual(parseWorks(null).record, []);
  assert.deepEqual(parseWorks({ group: [{}] }).record, []);
});

test("parseEpmc reads authors, PMID and journal from a Europe PMC core result", () => {
  const e = parseEpmc({ resultList: { result: [{ pmid: "41", authorString: "Seo W, Jung B, Jo EK.", journalTitle: "Cell Death Discov" }] } });
  assert.deepEqual(e, { authors: ["Seo W", "Jung B", "Jo EK"], pmid: "41", venue: "Cell Death Discov" });
  assert.deepEqual(parseEpmc({}), {});
});

test("mergeRecord adds new works, lets hand-written entries win, and stamps the sync date", () => {
  const { record } = parseWorks(orcidJson);
  const merged = mergeRecord(cv, { syncedAt: "2026-10-15", record });
  const known = cv.record.find((r) => r.doi);
  assert.equal(merged.record.filter((r) => r.doi && normDoi(r.doi) === normDoi(known.doi)).length, 1);
  assert.ok(merged.record.find((r) => normDoi(r.doi ?? "") === normDoi(known.doi)).topic, "hand-written topic kept");
  assert.ok(merged.record.some((r) => r.title === "New cohort paper"));
  assert.equal(merged.meta.syncedAt, "2026-10-15");
  assert.equal(cv.meta.syncedAt, undefined, "input is not mutated");
});

test("mergeRecord with nothing synced returns the same record", () => {
  assert.deepEqual(mergeRecord(cv, { syncedAt: "", record: [] }).record, cv.record);
  assert.deepEqual(mergeRecord(cv, null).record, cv.record);
});

test("a merged CV validates and renders new works without authors (position omitted)", () => {
  const merged = mergeRecord(cv, { syncedAt: "2026-10-15", record: parseWorks(orcidJson).record });
  assert.deepEqual(validate(merged).errors, []);
  const html = renderPage(merged);
  assert.match(html, /New cohort paper/);
  assert.match(html, /A patent/);
  assert.match(html, /KR 10-2024-0001234/);
  assert.match(html, /ORCID[^<]*2026-10-15|2026-10-15/);
  assert.match(html, /data-count="patents" data-to="1"/);
});

test("safeMerge falls back to the hand-written CV when synced data would fail validation", async () => {
  const { safeMerge } = await import("../src/orcid.mjs");
  const bad = { syncedAt: "2026-10-15", record: [{ year: "oops", type: "paper", title: "x", doi: "10.1/x" }] };
  const r = safeMerge(cv, bad, validate);
  assert.equal(r.usedSync, false);
  assert.ok(r.reason.length > 0);
  assert.deepEqual(r.cv.record, cv.record);
  const good = safeMerge(cv, { syncedAt: "2026-10-15", record: parseWorks(orcidJson).record }, validate);
  assert.equal(good.usedSync, true);
  assert.ok(good.cv.record.length > cv.record.length);
});

test("parseWorks keeps the publication month and parseEpmc reads it from firstPublicationDate", () => {
  const withMonth = { group: [{ "work-summary": [{ title: { title: { value: "M" } }, type: "JOURNAL_ARTICLE", "publication-date": { year: { value: "2026" }, month: { value: "03" } }, "external-ids": { "external-id": [{ "external-id-type": "doi", "external-id-value": "10.1/m" }] } }] }] };
  assert.equal(parseWorks(withMonth).record[0].month, 3);
  assert.equal(parseEpmc({ resultList: { result: [{ firstPublicationDate: "2026-10-05" }] } }).month, 10);
  assert.equal(parseEpmc({ resultList: { result: [{ firstPublicationDate: "garbage" }] } }).month, undefined);
});

test("parseWorks reports how many ORCID entries there are of each raw type", () => {
  const r = parseWorks(orcidJson);
  assert.equal(r.typeCounts.JOURNAL_ARTICLE, 4);
  assert.equal(r.typeCounts.PATENT, 1);
  assert.equal(r.typeCounts.DATA_SET, 1);
});

test("describe lists every kept and skipped work so a sync log shows exactly what ORCID returned", async () => {
  const { describe } = await import("../src/orcid.mjs");
  const lines = describe(parseWorks(orcidJson));
  const text = lines.join("\n");
  assert.match(text, /types: .*JOURNAL_ARTICLE=4/);
  assert.match(text, /PATENT=1/);
  assert.match(text, /kept patent 2024 .*A patent.*KR 10-2024-0001234/);
  assert.match(text, /kept paper 2026 .*New cohort paper.*10\.1000\/new\.1/);
  assert.match(text, /skipped .*No proof at all.*identifier/);
});

test("ORCID patents are synced as-is (no link), the Lens profile lives in Contact only, preprints are marked", () => {
  const w = (o) => ({ "work-summary": [summary(o)] });
  const { record } = parseWorks({
    group: [
      w({ putCode: 1, title: "Some patent", type: "PATENT", year: 2025, ids: [{ "external-id-type": "other-id", "external-id-value": "133-544-147-073-270" }] }),
      w({ putCode: 2, title: "A preprint", type: "PREPRINT", year: 2026, ids: [{ "external-id-type": "doi", "external-id-value": "10.21203/rs.3.rs-1/v1" }] }),
    ],
  });
  assert.equal(record[0].number, "133-544-147-073-270");
  assert.equal(record[1].subtype, "preprint");
  const page = renderPage({ ...cv, record: [...cv.record, ...record.map((r) => ({ ...r, authors: ["Jung B"], venue: "" }))] });
  const card = page.slice(page.indexOf("Some patent"));
  assert.ok(!card.slice(0, card.indexOf("</li>")).includes("<a "));
  const at = page.indexOf('id="contact"');
  assert.ok(page.slice(at).includes('href="https://link.lens.org/iKq9HjWBeUd"'));
  assert.ok(!page.slice(0, at).includes("link.lens.org"));
  assert.match(page, /data-count="preprints" data-to="1"/);
});
