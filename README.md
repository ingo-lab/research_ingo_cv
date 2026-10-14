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

## ORCID 자동 동기화
`pages.yml` 이 **매일 03:17 UTC**, `main` 에 머지될 때, 그리고 Actions 탭에서 수동 실행할 때 `scripts/sync-orcid.mjs` 를 먼저 돌린다.
- ORCID 공개 API(`pub.orcid.org/v3.0/<ORCID>/works`)에서 논문 · 특허를 가져오고, 논문은 DOI 로 Europe PMC 에서 저자 · PMID 를 보강한다 → `data/orcid.json`.
- `cv.json` 의 `record` 에 **같은 DOI 가 이미 있으면 손으로 쓴 쪽이 이긴다**(한 줄 설명 `topic` 등을 지키려고). 없으면 ORCID 항목이 추가된다. 프로젝트 · 연구실은 `cv.json` 에만 있다.
- DOI · 특허번호 · URL 이 없는 항목, 연도가 없는 항목, 논문/특허가 아닌 유형(데이터셋 등)은 **건너뛰고** 로그에 이유를 남긴다. 확인할 수 없는 것은 보이지 않는다.
- ORCID 나 네트워크가 실패하면 동기화 단계만 실패하고, 배포는 **이전 데이터로 계속**된다.
- 푸터에 "ORCID 동기화 YYYY-MM-DD" 가 마지막 성공 날짜로 표시된다.
- 새 논문이 한 줄 설명 없이 나오는 게 싫으면 `cv.json` 의 `record` 에 같은 DOI 로 `topic` 만 넣어 둔다.
- 수동 실행: `node scripts/sync-orcid.mjs` (인터넷 필요). 다른 ORCID 는 `ORCID_ID=...` 환경변수.

## 항목 추가
논문: `{ "year": 2026, "month": 10, "type": "paper", "subtype": "review", "title": "...", "authors": ["A B", "Jung B"], "venue": "...", "doi": "10.xxxx/...", "pmid": "...", "topic": {"ko": "한 줄 설명", "en": "One-line topic"} }`
특허: `{ "year": 2024, "month": 5, "type": "patent", "title": "...", "inventors": ["Jung B"], "number": "10-2024-0000000", "country": "KR", "status": "등록" }`
- `month`(1–12)는 선택. 있으면 항목에 `2026.10` 로 표시되고, **한 해에 업적이 3개 이상이면 그 해는 월별(최신 월 먼저)로 나뉜다**(기준값 `MONTH_VIEW_MIN`, `src/render.mjs`). 월을 모르는 항목은 "월 미상"으로 맨 뒤.
- `subtype: "review"` 는 "리뷰" 배지. `myName`(`Jung B`)과 같은 저자 이름은 자동 강조되고, 첫 번째 저자면 "제1저자" 로 표시된다.
- ORCID 동기화는 ORCID 의 발행 월 → 없으면 Europe PMC 의 `firstPublicationDate` 로 월을 채운다.

## 내용 규칙 (INGO AGENTS.md §6 에서 가져옴)
- 사실만 쓴다. 날짜 · 수치(`stats`, `timeline`)에는 `source` 가 필수이고, 없으면 빌드가 실패한다.
- 모르는 칸은 비워 둔다 — 추측으로 채우지 않는다. 화면에는 "준비 중"이 뜬다.
- 링크는 `http(s)` 만 허용(`validate`).

## 채워야 할 칸
`npm run build` 경고 목록이 정본이다. 지금: 입학 연도(`education.0.period`, 비어 있으면 화면에 아무것도 안 나온다), GuideOne 기간(`projects.1.period`).
ORCID 에는 논문 6편 · 특허 3건이 있다고 하나, 번호로 확인된 3편만 넣었다. 나머지 논문 · 특허는 위 「항목 추가」 형식으로 `record` 에 넣는다(DOI · 특허번호 등 확인 가능한 것만).
