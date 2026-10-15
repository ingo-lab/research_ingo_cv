// dist/cv-<lang>.html → dist/<Name>-CV-<lang>.pdf with a headless Chrome (CI runners ship one).
// If a PDF cannot be made, the download buttons are removed from dist/index.html so the site never links to a missing file.
import { existsSync, readFileSync, writeFileSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import { stripPdfLinks, pdfName } from "../src/render.mjs";

const root = new URL("../", import.meta.url);
const dist = fileURLToPath(new URL("dist/", root));
const CANDIDATES = [process.env.CHROME_BIN, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/opt/pw-browsers/chromium"].filter(Boolean);

export function findChrome(exists = existsSync) {
  return CANDIDATES.find((p) => exists(p)) ?? "";
}

function printPdf(chrome, lang, out) {
  const url = pathToFileURL(`${dist}cv-${lang}.html`).href;
  const args = ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=3000", `--print-to-pdf=${out}`, url];
  const r = spawnSync(chrome, args, { encoding: "utf8", timeout: 60000 });
  const ok = existsSync(out) && statSync(out).size > 2000;
  if (!ok) console.error(`PDF (${lang}) failed: ${(r.stderr || r.error || "no output").toString().slice(-300)}`);
  return ok;
}

function main() {
  const cv = JSON.parse(readFileSync(new URL("cv.json", root), "utf8"));
  const chrome = findChrome();
  const results = chrome ? ["ko", "en"].map((lang) => printPdf(chrome, lang, `${dist}${pdfName(cv, lang)}`)) : [];
  if (!chrome) console.error("No Chrome found (set CHROME_BIN).");
  for (const lang of ["ko", "en"]) rmSync(`${dist}cv-${lang}.html`, { force: true });
  if (results.length && results.every(Boolean)) {
    console.log(`made ${pdfName(cv, "ko")} and ${pdfName(cv, "en")}`);
    return;
  }
  const page = `${dist}index.html`;
  writeFileSync(page, stripPdfLinks(readFileSync(page, "utf8")));
  for (const lang of ["ko", "en"]) rmSync(`${dist}${pdfName(cv, lang)}`, { force: true });
  console.error("PDF download buttons removed from index.html");
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
