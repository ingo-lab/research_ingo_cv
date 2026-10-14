// Content hash of the files the page links to. Appended as ?v=… so a new deploy never pairs
// new HTML with an older cached stylesheet or script.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function assetVersion(root) {
  const h = createHash("sha1");
  for (const f of ["public/styles.css", "public/site.js"]) h.update(readFileSync(new URL(f, root)));
  return h.digest("hex").slice(0, 10);
}
