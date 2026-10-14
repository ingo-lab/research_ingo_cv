# research_ingo_cv — 연구자 CV 사이트

`cv.json` 한 파일로 만드는 정적 CV 사이트(한국어 / English 전환, 라이트 / 다크). INGO 소개 사이트(`ingo-lab/ingo` 의 `apps/site`)의 구조와 INGO v10 디자인 토큰을 그대로 가져왔다.

| 할 일 | 명령 · 파일 |
|---|---|
| 내용 고치기 | `cv.json` 한 곳. 빈 문자열 `""` 은 화면에 "준비 중"으로 보이고 빌드가 경고로 알려 준다 |
| 빌드 | `npm run build` → `dist/` (의존성 없음, Node 22+) |
| 로컬에서 보기 | `npm run dev` → http://localhost:4321 |
| 테스트 | `npm test` (`node:test`) · 전체 검사 `npm run check` |
| 배포(기본) | **GitHub Pages** — `main` 에 머지되면 `.github/workflows/pages.yml` 이 테스트 · 빌드 후 자동 게시. 주소 https://ingo-lab.github.io/research_ingo_cv/ . 서버 불필요. 처음 한 번만 Settings → Pages → Source = **GitHub Actions** (레포가 public 이어야 무료) |
| 배포(대안) | Cloudflare Workers assets — `npm run deploy` (`wrangler.jsonc`) |

## 구조
- `cv.json` — 내용 원본. `record[]` 가 연도별 연구실적(논문 · 특허 · 프로젝트 · 연구실). 항목마다 `year`(정수) · `type`(`paper|patent|project|lab`)이 필수이고, `doi` / `url` / `number` 중 하나 또는 `selfReported: true` 가 있어야 빌드가 통과한다.
- `src/render.mjs` — `cv.json` → HTML 순수 함수. 두 언어를 모두 넣고 CSS(`html[data-lang]`)로 하나만 보여 준다. 저자 순서(`공저자 5/12`)와 연구실 공동 논문 수는 데이터에서 계산한다.
- `public/styles.css` — 맨 위 토큰 블록은 INGO v10 에서 **그대로 복사**. 그 아래가 왼쪽 고정 프로필 + 목차, 연도별 타임라인 컴포넌트.
- `public/site.js` — 테마 · 언어 전환, 목차 현재 위치 표시, 스크롤 등장, 숫자 올라가기. JS 없이도 내용은 다 보이고, "동작 줄이기" 설정이면 움직이지 않는다.
- `public/fonts/` — woff2(OFL).

자산 경로는 상대 경로라서 `/research_ingo_cv/` 같은 하위 경로에서도 동작한다(테스트로 고정).

## 항목 추가
논문: `{ "year": 2026, "type": "paper", "title": "...", "authors": ["A B", "Jung B"], "venue": "...", "doi": "10.xxxx/...", "pmid": "...", "topic": {"ko": "한 줄 설명", "en": "One-line topic"} }`
특허: `{ "year": 2024, "type": "patent", "title": "...", "inventors": ["Jung B"], "number": "10-2024-0000000", "country": "KR", "status": "등록" }`
`myName`(`Jung B`)과 같은 저자 이름은 자동으로 강조된다.

## 내용 규칙 (INGO AGENTS.md §6 에서 가져옴)
- 사실만 쓴다. 날짜 · 수치(`stats`, `timeline`)에는 `source` 가 필수이고, 없으면 빌드가 실패한다.
- 모르는 칸은 비워 둔다 — 추측으로 채우지 않는다. 화면에는 "준비 중"이 뜬다.
- 링크는 `http(s)` 만 허용(`validate`).

## 채워야 할 칸
`npm run build` 경고 목록이 정본이다. 지금: 학년/기간(`education.0.period`).
ORCID 에는 논문 6편 · 특허 3건이 있다고 하나, 번호로 확인된 3편만 넣었다. 나머지 논문 · 특허는 위 「항목 추가」 형식으로 `record` 에 넣는다(DOI · 특허번호 등 확인 가능한 것만).
