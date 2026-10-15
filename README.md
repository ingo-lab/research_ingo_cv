# Bokeum Jung — Research CV

A clean, bilingual (한국어 / English) CV site for a medical student and researcher, with publications grouped by year and kept in sync with ORCID.

**Live:** https://ingo-lab.github.io/research_ingo_cv/

## Highlights

- **Research record by year** — papers, patents, lab experience and programs; busy years split by month.
- **Auto-updating** — a daily job reads the public ORCID record and enriches papers through Europe PMC.
- **Light, readable design** — one blue hero, a sticky table of contents, light/dark theme, mobile friendly, print friendly.
- **Downloadable CV** — a clean A4 PDF (한국어 / English) is generated from the same data on every deploy.
- **Zero dependencies** — plain Node 22 static generator, no framework, no tracking.

## How it works

```
cv.json ─┐
         ├─► build.mjs ─► dist/index.html ─► GitHub Pages
ORCID ───┘  (daily sync)
```

All content lives in [`cv.json`](cv.json); ORCID results are stored in `data/orcid.json`. Hand-written entries win over synced ones with the same DOI.

## Develop

```bash
npm run dev     # build and serve at http://localhost:4321
npm test        # unit tests
npm run check   # tests + build (what CI runs)
```

Editing content, entry formats, ORCID sync details and deployment troubleshooting: [docs/MAINTAINING.md](docs/MAINTAINING.md).

## Notes

Only publicly shareable information is published here. Design tokens come from the INGO v10 design system; fonts are OFL-licensed.
