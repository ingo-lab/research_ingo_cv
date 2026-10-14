# research_ingo_cv — 연구자 CV 사이트

`cv.json` 한 파일로 만드는 정적 CV 사이트(한국어 / English 전환, 라이트 / 다크). INGO 소개 사이트(`ingo-lab/ingo` 의 `apps/site`)의 구조와 INGO v10 디자인 토큰을 그대로 가져왔다.

| 할 일 | 명령 · 파일 |
|---|---|
| 내용 고치기 | `cv.json` 한 곳. 빈 문자열 `""` 은 화면에 "준비 중"으로 보이고 빌드가 경고로 알려 준다 |
| 빌드 | `npm run build` → `dist/` (의존성 없음, Node 22+) |
| 로컬에서 보기 | `npm run dev` → http://localhost:4321 |
| 테스트 | `npm test` (`node:test`) · 전체 검사 `npm run check` |
| 배포(기본) | **GitHub Pages** — `main` 에 머지되면 `.github/workflows/pages.yml` 이 테스트 · 빌드 후 자동 게시. 주소 https://ingo-lab.github.io/research_ingo_cv/ . 서버를 따로 돌릴 필요 없음. 처음 한 번만 Settings → Pages → Source = **GitHub Actions** |
| 배포(대안) | Cloudflare Workers assets — `npm run deploy` (`wrangler.jsonc`) |

## 구조
- `src/render.mjs` — `cv.json` → HTML 로 바꾸는 순수 함수(`esc` · `bi` · `validate` · `renderPage`). 두 언어를 모두 HTML 에 넣고 CSS(`html[data-lang]`)로 하나만 보여 준다.
- `public/styles.css` — 맨 위 토큰 블록은 INGO v10 에서 **그대로 복사**(prussian · cyanotype · bridge · collision · deadline, Pretendard · Source Serif 4 · JetBrains Mono · Nanum Pen Script). 그 아래가 CV 컴포넌트.
- `public/site.js` — 테마 · 언어 전환, 스크롤 등장, 현재 섹션 표시. JS 없이도 내용은 다 보이고, "동작 줄이기" 설정이면 움직이지 않는다.
- `public/fonts/` — INGO 소개 사이트와 같은 woff2(OFL).

자산 경로(`styles.css` · `fonts/` · `site.js`)는 상대 경로라서 `/research_ingo_cv/` 같은 하위 경로에서도 그대로 동작한다(테스트로 고정).

## 내용 규칙 (INGO AGENTS.md §6 에서 가져옴)
- 사실만 쓴다. 날짜 · 수치(`stats`, `timeline`)에는 `source` 가 필수이고, 없으면 빌드가 실패한다.
- 모르는 칸은 비워 둔다 — 추측으로 채우지 않는다. 화면에는 "준비 중"이 뜬다.
- 링크는 `http(s)` 만 허용(`validate`).

## 채워야 할 칸
`npm run build` 경고 목록이 정본이다. 지금: 학년/기간(`education.0.period`).
논문은 연구자 ID(`identifiers`: ORCID · Web of Science ResearcherID)로 연결한다. 개별 항목을 직접 보이고 싶으면 `publications` 에
`{ "year": 2026, "title": "...", "venue": "...", "url": "https://..." }` 모양으로 넣는다(원문에서 확인한 것만).
