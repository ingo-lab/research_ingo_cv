# Maintaining this site

Bokeum Jung 의 연구자 CV 사이트. 연구실적을 연도별(많은 해는 월별)로 보여 주고, ORCID 와 매일 자동으로 동기화한다.

- **사이트:** https://ingo-lab.github.io/research_ingo_cv/ (GitHub Pages)
- 한국어 / English 전환(오른쪽 위에 고정된 버튼 하나), 라이트 / 다크, 모바일 대응. 서버 · 빌드 의존성 없음(Node 22+).
- 디자인은 INGO v10 토큰(색 · 글꼴)을 쓰되, 밝고 단정하게: 파란색은 맨 위 히어로(이름 · 소개)에만, 나머지는 흰 바탕. 전체가 화면 가운데에 정렬되고, 히어로 아래 왼쪽에 목차가 고정된다. 목차와 섹션 제목은 한국어 화면에서도 영어(Research · Education · Projects · Interests & Skills · Contact). 격자 무늬 없음(테스트로 고정).

## 내용 고치기 (가장 자주 하는 일)

내용은 전부 **`cv.json` 한 파일**에 있다. 고치고 `main` 에 머지하면 자동으로 사이트에 반영된다.

| 바꾸고 싶은 것 | `cv.json` 의 위치 |
|---|---|
| 이름 · 역할 · 소속 · **맨 위 파란 영역의 소개 글** | `person` (`intro` 가 소개 글) |
| 논문 · 특허 · 프로젝트 · 연구실 경험 | `record[]` (아래 「연구실적 항목」) |
| 학력(입학 · 진급 시점) | `education[]` — `period` 와 `steps[]`(날짜 + 문구)로 입학 · 수료 · 진입을 시간순으로 보여 준다. `period` 를 비워 두면 그 줄은 화면에 안 나온다. 문구 안의 `{year}` 는 `medicalFrom`(의학과 진입 `YYYY-MM`)에서 학년으로 자동 계산된다(매년 3월에 올라가고 `medicalYears` 에서 멈춤 · 매일 빌드로 갱신) |
| 프로젝트 소개 | `projects[]` (짧은 요약만 — 아래 「공개 범위」) |
| 관심 분야 · 기술 | `interests[]` · `skills[]` |
| ORCID · WoS · GitHub · 이메일 | `identifiers[]` · `contact` — 화면에는 맨 아래 **Contact** 섹션에만 나온다 |

모든 문구는 `{ "ko": "...", "en": "..." }` 로 두 언어를 함께 쓴다. 한쪽만 있으면 그 값을 양쪽에 보여 준다. 빈 문자열은 화면에 "준비 중"으로 보이고, 빌드 로그가 어느 칸인지 알려 준다.

### 연구실적 항목

```jsonc
// 논문
{ "year": 2026, "month": 10, "type": "paper", "subtype": "review",
  "title": "...", "authors": ["Lee B", "Jung B"], "venue": "...",
  "doi": "10.xxxx/...", "pmid": "...",
  "topic": { "ko": "한 줄 설명", "en": "One-line topic" } }

// 특허
{ "year": 2024, "month": 5, "type": "patent", "title": "...",
  "inventors": ["Jung B"], "number": "10-2024-0000000", "country": "KR", "status": "등록" }

// 프로젝트 · 연구실 경험 · 프로그램 (본인이 직접 쓰는 항목은 selfReported 로 표시)
{ "year": 2024, "month": 2, "type": "lab", "title": {...}, "period": {...}, "text": {...},
  "coauthor": "Jo EK", "selfReported": true }
```

- `type` 은 `paper | patent | project | lab | program`. `year` 는 정수, `month`(1–12)는 선택.
- 지금 하고 있는 일(예: 참여 중인 프로그램)은 `"ongoing": true` — 월 대신 "진행 중"으로 표시되고, 월별 보기에서는 그 해의 맨 위 그룹이 된다. 끝나면 `ongoing` 을 지우고 `month` 와 `period` 를 채운다.
- 모든 항목은 **확인할 수 있어야** 한다: `doi` / `url` / `number` 중 하나, 또는 `selfReported: true`. 아니면 빌드가 실패한다.
- 화면 표시는 데이터에서 계산한다. `myName`(`Jung B`)과 같은 저자는 강조되고, 첫 저자면 "제1저자", 아니면 "공저자 n/N". `subtype: "review"` 는 "리뷰" 배지. `lab` 항목의 `coauthor` 가 저자에 있는 논문 수는 자동으로 센다.
- **한 해에 업적이 3개 이상이면 그 해는 월별(최신 월 먼저)로 나뉜다.** 2개 이하는 월 구분 없이 나열. 기준값은 `src/render.mjs` 의 `MONTH_VIEW_MIN`. 월을 모르는 항목은 "월 미상"으로 맨 뒤.

## ORCID 자동 동기화

`.github/workflows/pages.yml` 이 **매일 03:17 UTC(한국 시간 12:17)**, `main` 에 머지될 때, 그리고 Actions 탭에서 수동 실행할 때 `scripts/sync-orcid.mjs` 를 먼저 돌린 뒤 빌드 · 배포한다.

1. ORCID 공개 API(`pub.orcid.org/v3.0/<ORCID>/works`)에서 논문 · 특허를 가져온다.
2. 논문은 DOI 로 Europe PMC 에서 저자 · PMID · 발행 월을 보강한다. 결과는 `data/orcid.json`.
3. 빌드할 때 `record[]` 와 합친다. **같은 DOI 가 `cv.json` 에 이미 있으면 손으로 쓴 쪽이 이긴다**(한 줄 설명 `topic` 을 지키려고). 새 논문이 한 줄 설명 없이 나오는 게 싫으면 같은 DOI 로 `topic` 만 넣어 두면 된다.
4. DOI · 특허번호 · URL 이 없는 항목, 연도가 없는 항목, 논문/특허가 아닌 유형(데이터셋 등)은 **건너뛰고** 로그에 이유를 남긴다. 확인할 수 없는 것은 화면에 나오지 않는다.
5. 푸터에 마지막으로 성공한 동기화 날짜가 나온다.

안전장치: ORCID 나 네트워크가 실패하면 동기화 단계만 실패하고 **이전 데이터로 배포가 계속**된다. 합친 결과가 검증을 통과하지 못하면 ORCID 데이터를 무시하고 `cv.json` 만으로 만든다.

- 동기화 로그는 ORCID 가 돌려준 **유형별 개수**(`ORCID types: JOURNAL_ARTICLE=…, PATENT=…`)와 가져온 항목 · 건너뛴 항목을 한 줄씩 보여 준다. 특허 · 논문이 안 보이면 먼저 이 로그를 본다.
- 확인용 로그 한 줄: Actions 의 `pages` 실행 → `build` → 동기화 단계에 `synced N works from ORCID … (M skipped)`.
- 로컬 실행: `node scripts/sync-orcid.mjs` (인터넷 필요). 다른 ORCID 는 `ORCID_ID=0000-0000-0000-0000`.
- 논문 · 특허가 ORCID 에 없거나 형식이 달라 빠지면, 위 「연구실적 항목」 형식으로 `cv.json` 에 직접 넣는다.

## 배포

`main` 에 머지 → `pages.yml` 이 테스트 · 빌드 → GitHub Pages 게시. 레포가 **public** 이어야 무료이고, private 이면 Actions 가 시작되지 않을 수 있다.

**처음 한 번 설정(직접 해야 함)**
1. Settings → Pages → Build and deployment → Source = **GitHub Actions**
2. Settings → Environments → `github-pages` → Deployment branches 에 **`main` 허용**(또는 No restriction)

**배포가 실패할 때**

| 증상 · 오류 | 원인 |
|---|---|
| `deploy` 가 2초 만에 실패, 주석에 `Branch "main" is not allowed to deploy to github-pages due to environment protection rules` | 위 2번(환경의 브랜치 규칙) |
| `Failed to create deployment (status: 404) … Ensure GitHub Pages has been enabled` | 위 1번(Pages 가 켜져 있지 않음) |
| 모든 job 이 단계 없이 즉시 실패 | 계정의 Actions 결제 · 사용 한도 문제 |

고친 뒤에는 코드를 바꿀 필요 없이 Actions 에서 실패한 실행을 **Re-run failed jobs**.

대안: Cloudflare Workers 정적 자산 — `npm run deploy` (`wrangler.jsonc`).

## 공개 범위

이 사이트는 공개되어 있다. `cv.json` 에는 **공개해도 되는 것만** 쓴다.

- INGO · GuideOne 은 짧은 소개 한두 줄만. 내부 구조 · 수치 · 작업 번호 · 비공개 레포 링크는 넣지 않는다. 테스트(`private INGO details stay out of the public page`)가 대표적인 누출 패턴을 막는다.
- 환자 데이터는 어떤 형태로도 넣지 않는다.
- 사실만 쓴다. 모르는 칸은 비워 둔다 — 추측으로 채우지 않는다.

## 개발

```bash
npm run build   # cv.json + data/orcid.json → dist/
npm run dev     # 빌드 후 http://localhost:4321
npm test        # node:test (렌더 · ORCID 파싱 · 동기화, 네트워크는 가짜 응답)
npm run check   # 테스트 + 빌드 (PR 에서 ci.yml 이 같은 명령을 돌린다)
```

| 파일 | 역할 |
|---|---|
| `cv.json` | 내용 원본 |
| `data/orcid.json` | ORCID 동기화 결과(자동 생성) |
| `src/render.mjs` | `cv.json` → HTML 순수 함수 · 검증(`validate`). 두 언어를 모두 넣고 CSS(`html[data-lang]`)로 하나만 보여 준다 |
| `src/orcid.mjs` | ORCID / Europe PMC 응답 파싱 · 병합(`mergeRecord` · `safeMerge`) |
| `scripts/sync-orcid.mjs` | 실제로 네트워크를 호출하는 동기화 스크립트 |
| `build.mjs` | 위를 묶어 `dist/` 생성. 검증 오류면 실패, 빈 칸은 경고. CSS · JS 주소에 내용 해시(`?v=…`)를 붙여서, 새로 배포해도 브라우저에 남은 예전 스타일과 섞이지 않는다 |
| `public/styles.css` | 맨 위 토큰 블록은 INGO v10 에서 **그대로 복사**. 아래는 파란 히어로 · 왼쪽 고정 목차 · 가운데 내용 · 연도별 타임라인 |
| `public/site.js` | 테마 · 언어 전환, 목차 현재 위치, 스크롤 등장, 숫자 올라가기. JS 없이도 내용은 다 보이고 "동작 줄이기" 설정이면 움직이지 않는다 |
| `public/fonts/` | woff2 (OFL) |

자산 경로는 상대 경로라서 `/research_ingo_cv/` 같은 하위 경로에서도 동작한다(테스트로 고정).
