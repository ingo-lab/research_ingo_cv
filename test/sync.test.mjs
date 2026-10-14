import { test } from "node:test";
import assert from "node:assert/strict";
import { sync } from "../scripts/sync-orcid.mjs";

const works = { group: [
  { "work-summary": [{ title: { title: { value: "Paper A" } }, type: "JOURNAL_ARTICLE", "publication-date": { year: { value: "2026" } }, "external-ids": { "external-id": [{ "external-id-type": "doi", "external-id-value": "10.1000/a" }] } }] },
  { "work-summary": [{ title: { title: { value: "Paper B" } }, type: "JOURNAL_ARTICLE", "publication-date": { year: { value: "2025" } }, "journal-title": { value: "J B" }, "external-ids": { "external-id": [{ "external-id-type": "doi", "external-id-value": "10.1000/b" }] } }] },
  { "work-summary": [{ title: { title: { value: "Patent C" } }, type: "PATENT", "publication-date": { year: { value: "2024" } }, "external-ids": { "external-id": [{ "external-id-type": "other-id", "external-id-value": "KR 1" }] } }] },
] };

const fakeFetch = (log = []) => async (url) => {
  log.push(url);
  if (url.includes("pub.orcid.org")) return works;
  if (decodeURIComponent(url).includes("10.1000/a")) return { resultList: { result: [{ pmid: "7", authorString: "X Y, Jung B.", journalTitle: "Journal A" }] } };
  throw new Error("epmc down");
};

test("sync fetches the ORCID works, enriches papers from Europe PMC, and stamps the date", async () => {
  const log = [];
  const out = await sync({ orcid: "0000-0000-0000-0001", fetchJson: fakeFetch(log), today: "2026-10-15" });
  assert.equal(out.orcid, "0000-0000-0000-0001");
  assert.equal(out.syncedAt, "2026-10-15");
  const a = out.record.find((r) => r.title === "Paper A");
  assert.deepEqual([a.authors, a.pmid, a.venue], [["X Y", "Jung B"], "7", "Journal A"]);
  assert.ok(log[0].includes("pub.orcid.org/v3.0/0000-0000-0000-0001/works"));
});

test("a Europe PMC failure for one paper does not lose it or fail the sync", async () => {
  const out = await sync({ orcid: "0000-0000-0000-0001", fetchJson: fakeFetch(), today: "2026-10-15" });
  const b = out.record.find((r) => r.title === "Paper B");
  assert.equal(b.venue, "J B");
  assert.equal(b.authors, undefined);
  assert.ok(out.record.some((r) => r.type === "patent" && r.number === "KR 1"));
});

test("an ORCID failure rejects, so the caller keeps the previous data", async () => {
  await assert.rejects(sync({ orcid: "0000-0000-0000-0001", fetchJson: async () => { throw new Error("orcid down"); }, today: "2026-10-15" }), /orcid down/);
});

test("sync refuses an invalid ORCID iD before touching the network", async () => {
  let called = false;
  await assert.rejects(sync({ orcid: "nope", fetchJson: async () => { called = true; }, today: "x" }), /ORCID/);
  assert.equal(called, false);
});
