// node build.mjs → dist/ (no dependencies). Fails on schema errors, lists empty fields as warnings.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { validate, renderPage } from "./src/render.mjs";
import { renderCv } from "./src/cvdoc.mjs";
import { safeMerge } from "./src/orcid.mjs";
import { assetVersion } from "./src/assets.mjs";

const root = new URL(".", import.meta.url);
const dist = new URL("dist/", root);
const base = JSON.parse(readFileSync(new URL("cv.json", root), "utf8"));
const synced = JSON.parse(readFileSync(new URL("data/orcid.json", root), "utf8"));
const merged = safeMerge(base, synced, validate);
if (!merged.usedSync && synced.record?.length) console.warn(`ORCID data ignored (invalid): ${merged.reason}`);
const cv = merged.cv;

const { errors, warnings } = validate(cv);
if (errors.length) {
  console.error(`cv.json errors:\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
if (warnings.length) console.warn(`비어 있는 칸(화면에 '준비 중'):\n  - ${warnings.join("\n  - ")}`);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(new URL("public/", root), dist, { recursive: true });
// Version the assets by content so a new deploy never pairs new HTML with a cached old stylesheet.
const version = assetVersion(root);
writeFileSync(new URL("index.html", dist), renderPage(cv, { assetVersion: version }));
// Print-ready CV documents; scripts/make-pdf.mjs turns them into the downloadable PDFs.
for (const lang of ["ko", "en"]) writeFileSync(new URL(`cv-${lang}.html`, dist), renderCv(cv, { lang }));
console.log("built dist/index.html");
