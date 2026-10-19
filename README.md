# Vercel·DB 전환 0.3

GitHub: https://github.com/bjkwak912/eevent / Vercel 프로젝트: `bjkwak912-7589/omgim`.

운영 사이트: https://omgim-lime.vercel.app / 공용 API: https://omgim-lime.vercel.app/api/catalog . 2026-10-19 DB 자료 revision 3·30개 항목과 무인증 쓰기 차단을 확인했다. 같은 조건 재발행은 revision 3을 유지했다. 정오 수집 수동 실행은 46개 URL 중 42개 수집·4개 접근 실패로 기록됐다. 이는 전체 조건 재검증 완료를 뜻하지 않으며 기존 조건은 보존했다. GitHub의 Vercel Login Connection은 아직 연결되지 않아 현재 배포는 인증된 CLI로 수행했다.

## 구조

공식 원문·포스터 → 조건 검증 → 인증된 발행 API → Neon PostgreSQL → `/api/catalog` → Android·웹.

웹과 Android는 실행·복귀·새로고침·활성 상태 5분 간격으로 API를 조회한다. 연결 실패 시 마지막 정상 자료와 연결 실패를 표시한다. DB 미구성일 때만 초기 번들 자료를 제공하며 서버 연결 준비 중임을 알린다. DB 장애를 초기 자료로 위장하지 않는다.

DB의 `catalog_versions`는 30개 항목 전체의 불변 JSONB 스냅샷, `catalog_current`는 현재 포인터, `source_observations`는 원문 해시, `check_runs`는 점검·발행 기록이다. 하나의 트랜잭션으로 발행해 부분 반영을 막는다. 조건이 같으면 revision·자료 시각을 유지하고 로그만 남긴다. 다른 변경이 이미 발행됐다면 오래된 revision을 기준으로 한 쓰기를 거절한다.

## 최초 연결

1. Vercel 플러그인/MCP 계정을 연결한다. CLI는 `npx vercel@64.5.0 login`을 사용한다.
2. `npx vercel@64.5.0 project inspect --non-interactive --scope bjkwak912-7589`로 `omgim` 프로젝트를 확인한다.
3. Neon Marketplace 무료 DB `omgim-events`, Singapore `sin1`, auth=false를 연결한다. 약관은 사용자가 직접 승인한다. 설치·리소스 목록을 먼저 확인해 중복 생성하지 않는다.
4. 서버 전용 `DATABASE_URL`, 서로 다른 무작위 32바이트 이상 `CATALOG_PUBLISH_TOKEN`, `CRON_SECRET`을 Vercel에 설정한다. 키·DB URL은 Android·브라우저·Git에 넣지 않는다.
5. `vercel env pull .env.local` 후 키 이름만 확인하고 `npm ci`, `npm test`, `npm run db:migrate`를 실행한다. 프로젝트 연결과 환경변수 검증 전에는 마이그레이션을 실행하지 않는다.
6. Vercel에 배포하고 `.env.local`의 `CATALOG_API_ORIGIN`을 실제 고정 production origin으로 설정한다. 초기 검토 자료를 발행한 뒤 공개 API의 `X-Catalog-Source: database`, revision 3, 30개 항목을 확인한다.
7. Android를 `-PcatalogApiUrl=https://실제운영주소/api/catalog`로 빌드한다. API 주소가 없는 검토 빌드를 서버 연결 완료본으로 배포하지 않는다. 기존 0.2.2 사용자에게는 이 전환 버전만 한 번 설치하도록 안내한다.

## 검토 자료 발행

```sh
npm run catalog:publish -- public/catalog.json "공식 포스터와 상세 각주 대조 완료: 변경 내용과 출처"
```

상위 `scripts/catalog_publish.py`로 검증·조건 비교 후 변경된 발행본을 위 API에 전송한다. 공개 revision을 다시 읽어야 서버 반영 완료다. 데이터 변경만으로 APK·ZIP·웹을 다시 배포하지 않는다. GitHub의 `public/catalog.json`은 초기·복구용이며 코드 배포가 운영 DB를 덮어쓰지 않는다.

## 정오 점검

`vercel.json`의 `0 3 * * *`는 UTC 03:00, 한국 정오다. Hobby Cron은 시간대 내 오차가 있어 정각 실행 보장은 없다. 인증된 `/api/cron/check`가 공식 URL과 포스터 바이트 변경·접근 실패를 DB에 남긴다. **해시가 같아도 동적 각주와 혜택 조건 검증 완료가 아니다.** 조건 검토·발행은 기존 Codex 정오 점검 절차로 수행하며 현재 PC·Codex 실행이 필요하다. 서버 수집만 PC 없이 실행된다. 해석·검증·발행까지 완전 자동화됐다고 안내하지 않는다.

## 로컬 확인

Node.js 24 LTS: `npm ci`, `npm test`, `npm start`. `http://localhost:3000`에서 확인한다. DB 없이도 초기 자료 API의 UI를 확인할 수 있다. 실제 DB 마이그레이션은 대상 검증 후에만 실행한다. 테스트는 메모리 PGlite DB로 발행 SQL을 검증하며 운영 DB에 접속하지 않는다.

자료 revision 3(2026-10-19): 계산 가능 21개, 대상 제한 1개, 확인 필요 8개. 기존 Cafe24 서비스는 별도로 남아 있으며 Vercel 전환 검증 전까지 운영 완료로 안내하지 않는다.
