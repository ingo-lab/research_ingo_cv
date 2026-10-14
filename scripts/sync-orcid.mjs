// node scripts/sync-orcid.mjs → data/orcid.json. Pulls works from the ORCID public API and
// enriches papers with authors/PMID from Europe PMC. On any ORCID failure it exits 1 and
// leaves the previous file untouched, so a deploy never loses data.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseWorks, parseEpmc } from "../src/orcid.mjs";

const ORCID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

export async function sync({ orcid, fetchJson, today }) {
  if (!ORCID_RE.test(orcid ?? "")) throw new Error(`Invalid ORCID iD: ${orcid}`);
  const works = await fetchJson(`https://pub.orcid.org/v3.0/${orcid}/works`);
  const { record, skipped } = parseWorks(works);
  const enriched = await Promise.all(record.map(async (r) => {
    if (r.type !== "paper" || !r.doi) return r;
    try {
      const q = encodeURIComponent(`DOI:"${r.doi}"`);
      const e = parseEpmc(await fetchJson(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${q}&resultType=core&format=json`));
      return { ...r, ...e, venue: e.venue ?? r.venue };
    } catch {
      return r;
    }
  }));
  return { orcid, syncedAt: today, record: enriched, skipped };
}

const getJson = async (url) => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
};

async function main() {
  const root = new URL("../", import.meta.url);
  const cv = JSON.parse(readFileSync(new URL("cv.json", root), "utf8"));
  const orcid = process.env.ORCID_ID || cv.identifiers?.find((x) => x.id === "orcid")?.value;
  const out = await sync({ orcid, fetchJson: getJson, today: new Date().toISOString().slice(0, 10) });
  for (const s of out.skipped) console.warn(`skipped "${s.title}": ${s.reason}`);
  writeFileSync(new URL("data/orcid.json", root), JSON.stringify({ orcid: out.orcid, syncedAt: out.syncedAt, record: out.record }, null, 2) + "\n");
  console.log(`synced ${out.record.length} works from ORCID ${orcid} (${out.skipped.length} skipped)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`ORCID sync failed: ${e.message}`); process.exit(1); });
}
