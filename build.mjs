// node build.mjs → dist/ (no dependencies). Fails on schema errors, lists empty fields as warnings.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { validate, renderPage } from "./src/render.mjs";

const root = new URL(".", import.meta.url);
const dist = new URL("dist/", root);
const cv = JSON.parse(readFileSync(new URL("cv.json", root), "utf8"));

const { errors, warnings } = validate(cv);
if (errors.length) {
  console.error(`cv.json errors:\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
if (warnings.length) console.warn(`비어 있는 칸(화면에 '준비 중'):\n  - ${warnings.join("\n  - ")}`);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(new URL("public/", root), dist, { recursive: true });
writeFileSync(new URL("index.html", dist), renderPage(cv));
console.log("built dist/index.html");
