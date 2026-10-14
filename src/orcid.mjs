// ORCID sync helpers: pure functions, no network. scripts/sync-orcid.mjs does the fetching.
// ASSUMPTION: ORCID public API v3.0 /works JSON shape (group[].work-summary[]); verify on the first real sync.

const PAPER_TYPES = new Set(["journal-article", "conference-paper", "book-chapter", "preprint", "review", "book", "report", "magazine-article", "dissertation-thesis", "working-paper"]);
const norm = (s) => String(s ?? "").toLowerCase().replace(/_/g, "-");

export function normDoi(v) {
  return String(v ?? "").trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase();
}

const idsOf = (s) => s?.["external-ids"]?.["external-id"] ?? [];
const doiOf = (s) => {
  const hit = idsOf(s).find((x) => norm(x["external-id-type"]) === "doi");
  return hit ? normDoi(hit["external-id-value"]) : "";
};
const numberOf = (s) => {
  const hit = idsOf(s).find((x) => norm(x["external-id-type"]) !== "doi" && x["external-id-value"]);
  return hit ? String(hit["external-id-value"]).trim() : "";
};

function toEntry(s) {
  const title = s?.title?.title?.value;
  const type = norm(s?.type);
  const year = Number(s?.["publication-date"]?.year?.value);
  const label = title ?? "(untitled)";
  if (!title) return { skip: { title: label, reason: "no title" } };
  const kind = type === "patent" ? "patent" : PAPER_TYPES.has(type) ? "paper" : "";
  if (!kind) return { skip: { title, reason: `type "${type}" is not shown` } };
  if (!Number.isInteger(year)) return { skip: { title, reason: "no publication year" } };
  const doi = doiOf(s);
  const number = kind === "patent" ? numberOf(s) : "";
  const url = s?.url?.value && /^https?:\/\//.test(s.url.value) ? s.url.value : "";
  if (!doi && !number && !url) return { skip: { title, reason: "no verifiable identifier (DOI, number or URL)" } };
  const venue = s?.["journal-title"]?.value ?? "";
  const entry = { year, type: kind, title, ...(doi && { doi }), ...(number && { number }), ...(url && !doi && { url }), ...(venue && { venue }) };
  return { entry };
}

export function parseWorks(json) {
  const record = [];
  const skipped = [];
  for (const g of json?.group ?? []) {
    const summary = g?.["work-summary"]?.[0];
    if (!summary) continue;
    const { entry, skip } = toEntry(summary);
    if (entry) record.push(entry);
    else skipped.push(skip);
  }
  return { record, skipped };
}

export function parseEpmc(json) {
  const r = json?.resultList?.result?.[0];
  if (!r) return {};
  const authors = String(r.authorString ?? "").replace(/\.$/, "").split(/,\s*/).filter(Boolean);
  return { ...(authors.length && { authors }), ...(r.pmid && { pmid: String(r.pmid) }), ...(r.journalTitle && { venue: r.journalTitle }) };
}

export function mergeRecord(cv, synced) {
  const extra = synced?.record ?? [];
  const mine = new Set(cv.record.map((r) => r.doi && normDoi(r.doi)).filter(Boolean));
  const added = extra.filter((r) => !(r.doi && mine.has(normDoi(r.doi))));
  return {
    ...cv,
    record: [...cv.record, ...added],
    meta: { ...cv.meta, ...(synced?.syncedAt && { syncedAt: synced.syncedAt }) },
  };
}

// Never let a bad sync break the deploy: if the merged CV does not validate, use the hand-written one.
export function safeMerge(cv, synced, validate) {
  const merged = mergeRecord(cv, synced);
  const { errors } = validate(merged);
  if (!errors.length) return { cv: merged, usedSync: true, reason: "" };
  return { cv, usedSync: false, reason: errors.join("; ") };
}
