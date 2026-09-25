# 곱셈 카피바라 — 계정 기능 설계

작성일: 2026-09-25

## 1. 목적

같은 아이가 **어느 기기에서든** 로그인하면 자기 진도(레벨·경험치·배지·복습 주머니 등)를 이어서 할 수 있게 한다. 계정마다 진도는 따로 관리된다.

**성공 기준**
- 초대 코드를 아는 사람만 이메일 + 8자 이상 비밀번호로 가입할 수 있다.
- 로그인하면 계정의 진도가 불러와지고, 한 판이 끝날 때마다 계정에 저장된다.
- 두 기기에서 같은 계정을 써도 진도가 절대 줄어들지 않는다.
- 로그인하지 않아도 지금처럼 바로 풀 수 있다(게스트 모드). 인터넷이 끊겨도 풀 수 있다.

**범위 밖** — 공개 가입, 비밀번호 찾기(메일 발송), 닉네임·프로필, 회원 탈퇴 화면, 한 계정 안의 여러 아이.

## 2. 결정 사항과 근거

| 결정 | 근거 |
|---|---|
| 서버 + DB를 붙인 진짜 계정 | 기기 간 이어하기가 목적이다 |
| **초대 코드가 있어야만 가입** | 사용자가 초등학생이다. 공개 가입은 만 14세 미만 개인정보 수집에 법정대리인 동의가 필요하다. 가족 전용으로 범위를 좁혀 이 문제를 피한다 |
| 게스트 모드 유지, 로그인은 선택 | 기존 진도를 버리지 않고, 오프라인·GitHub Pages·HTML 파일 버전이 계속 동작한다 |
| 병합은 "항목별로 더 진행된 쪽" | 진도가 절대 줄지 않는다. 기존 저장 구조를 그대로 쓴다 |
| Vercel 함수 + Upstash Redis, 로그인 직접 구현 | 서비스 추가 가입 없음, 무료 요금제 일시정지 없음, 외부 라이브러리 0개 유지 |

## 3. 서버

### 3.1 함수

| 경로 | 입력 | 결과 |
|---|---|---|
| `POST /api/signup` | `{ email, password, inviteCode }` | 201, 세션 쿠키 발급, `{ email }` |
| `POST /api/login` | `{ email, password }` | 200, 세션 쿠키 발급, `{ email }` |
| `POST /api/logout` | — | 200, 쿠키 삭제 |
| `GET /api/progress` | — (쿠키) | 200 `{ email, state }` / 401 |
| `PUT /api/progress` | `{ state }` (쿠키) | 200 `{ state }` — 저장된 진도와 병합한 결과 / 401 |

오류 응답은 `{ error: '<code>' }`이고 화면이 코드를 한국어 문구로 바꾼다.
오류 코드: `invalid-email`, `weak-password`, `bad-invite`, `email-taken`, `bad-credentials`, `too-many-attempts`, `unauthorized`, `invalid-state`, `bad-request`, `server-error`.

### 3.2 저장 (Upstash Redis, REST API를 `fetch`로 호출)

- `user:<정규화된 이메일>` → `{ id, email, salt, hash, createdAt }`
- `progress:<id>` → 진도 JSON (지금의 state 그대로)
- `attempts:<정규화된 이메일>` → 로그인 실패 횟수, 15분 만료

가입은 `SET ... NX`로 같은 이메일이 동시에 두 번 만들어지지 않게 한다.

### 3.3 보안

- 이메일은 `trim().toLowerCase()`로 정규화한다. 형식은 `x@y.z` 수준으로 검사하고 254자 이하.
- 비밀번호는 8자 이상 128자 이하. 계정마다 16바이트 무작위 salt, `scrypt`(N=16384, r=8, p=1, 64바이트)로 해시, `timingSafeEqual`로 비교한다.
- 초대 코드 비교도 `timingSafeEqual`.
- 세션은 서버 저장 없이 **HMAC-SHA256으로 서명한 쿠키** `capy_session=<id>.<만료시각>.<서명>`. `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=90일`.
- 로그인 실패가 15분 안에 10번이면 `too-many-attempts`. 성공하면 카운터를 지운다.
- 로그인 실패 시 이메일이 없는지 비밀번호가 틀렸는지 구분하지 않는다(`bad-credentials`). 이메일이 없어도 해시 계산을 한 번 수행해 응답 시간 차이를 줄인다.
- `PUT /api/progress`는 본문 64KB 제한, 받은 state를 기존 `validateState`로 검증한 뒤 병합한다.
- 환경변수: `INVITE_CODE`, `SESSION_SECRET`(32바이트 이상), `KV_REST_API_URL`, `KV_REST_API_TOKEN`(Upstash 연동 시 Vercel이 넣어줌). 하나라도 없으면 `server-error`.

## 4. 병합 규칙 (`src/core/merge.js`, 서버·브라우저 공용 순수 함수)

`mergeStates(a, b)` — 두 state를 합쳐 새 state를 돌려준다. 입력은 바꾸지 않는다. 교환법칙이 성립한다.

| 항목 | 규칙 |
|---|---|
| `level`, `xp` | 한 묶음으로 (level, xp)가 사전식으로 큰 쪽 |
| `streakDays`, `lastPlayedDate` | 한 묶음으로 날짜가 늦은 쪽, 같으면 streak이 큰 쪽. 한쪽이 null이면 다른 쪽 |
| `setsPlayed`, `perfectSets`, `verticalSolved` | 큰 값 |
| `solvedByCategory[c]` | 큰 값 |
| `recentByCategory[c]`, `difficultyByCategory[c]` | 한 묶음으로 `solvedByCategory[c]`가 큰 쪽의 것, 같으면 a |
| `bestByCategory[c]` | 정답 수가 많은 쪽, 같으면 시간이 짧은 쪽, 한쪽이 null이면 다른 쪽 |
| `badges` | 합집합 |
| `reviewQueue` | id 기준 합집합, 같은 id는 streak이 작은 쪽. 40개를 넘으면 뒤쪽 40개 |
| `reviewEverHad` | OR |

## 5. 브라우저

### 5.1 서버 유무 감지

앱 시작 시 `GET /api/progress`를 호출한다.
- 200 → 로그인 상태
- 401 → 서버 있음, 게스트 (로그인 버튼 보임)
- 그 외(404, 네트워크 오류, `file://`) → 서버 없음 또는 오프라인. 기기에 로그인 캐시가 있으면 오프라인 로그인 상태, 없으면 게스트이며 **로그인 버튼을 숨긴다**.

### 5.2 기기 저장

- 게스트 진도: 기존 `capy-math-v1` 그대로
- 계정 캐시: `capy-math-v1:account` → `{ email, state, dirty }`. `dirty`는 서버에 아직 반영되지 않았다는 표시.

### 5.3 흐름

- **로그인/가입 성공** → 서버 진도를 받는다. 게스트 진도가 의미 있으면(`setsPlayed > 0`) "이 기기에서 쌓은 진도(Lv.N, 배지 M개)를 계정에 합칠까요?" 확인 → 합치면 `mergeStates` 후 서버에 저장, 게스트 진도는 기본값으로 비운다.
- **한 판 종료·중간 나가기·진도 불러오기** → 계정 캐시에 `dirty: true`로 저장 → `PUT /api/progress` → 성공 시 받은 병합 결과를 state와 캐시에 반영, `dirty: false`.
- **저장 실패(네트워크)** → 캐시는 dirty로 남고 집 화면에 "아직 계정에 저장 안 됐어요 — 인터넷이 되면 자동으로 저장돼요". 다음 저장이나 앱 시작 때 다시 보낸다.
- **401(로그인 만료)** → 캐시는 지우지 않고 로그인 화면. 다시 로그인하면 캐시 진도가 서버 진도와 병합된다.
- **로그아웃** → `POST /api/logout`, 계정 캐시 삭제, 게스트 진도로 돌아간다.

### 5.4 화면

- 집 화면 오른쪽 위: 게스트면 `로그인` 버튼, 로그인 중이면 이메일 앞부분과 `로그아웃`.
- 계정 화면: `로그인` / `가입` 탭. 가입은 이메일·비밀번호·비밀번호 확인·초대 코드. 오류는 입력칸 아래 한국어. 제출 중에는 버튼 비활성.
- 문구
  - `invalid-email` 이메일 형식이 아니에요
  - `weak-password` 비밀번호는 8자 이상이어야 해요
  - 확인 불일치: 비밀번호가 서로 달라요
  - `bad-invite` 초대 코드가 맞지 않아요
  - `email-taken` 이미 가입된 이메일이에요
  - `bad-credentials` 이메일이나 비밀번호가 맞지 않아요
  - `too-many-attempts` 너무 많이 틀렸어요. 15분 뒤에 다시 해 주세요
  - 네트워크: 인터넷 연결을 확인해 주세요
  - 그 외: 잠시 뒤에 다시 해 주세요

## 6. 코드 구조

| 파일 | 역할 |
|---|---|
| `src/core/merge.js` | 병합 규칙 |
| `src/core/credentials.js` | 이메일 정규화·검사, 비밀번호 길이 검사 |
| `src/storage.js` | `validateState` export 추가 |
| `src/sync.js` | 서버 통신, 계정 캐시 |
| `src/ui/screens/account.js` | 로그인/가입 화면 |
| `src/ui/screens/home.js` | 계정 버튼 영역 |
| `src/app.js` | 계정 상태에 따라 저장 경로 선택 |
| `api/signup.js` `api/login.js` `api/logout.js` `api/progress.js` | 서버 함수 |
| `api/_lib/password.js` `session.js` `store.js` `http.js` | 해시, 세션, Redis, 요청/응답 도우미 |

서버 함수는 저장소(store)와 환경을 인자로 받는 핸들러 함수로 만들어, 테스트에서 메모리 저장소를 끼운다.

## 7. 테스트

- `merge.js`, `credentials.js`, `password.js`, `session.js` 단위 테스트
- 핸들러 테스트: 메모리 저장소로 가입 → 중복 가입 거부 → 로그인 → 틀린 비밀번호 → 시도 제한 → 진도 저장/병합 → 로그아웃, 잘못된 초대 코드, 위조 쿠키, 만료 쿠키
- `sync.js`: fetch를 가짜로 바꿔 200/401/네트워크 오류 경로
- 배포 후 실제 Vercel 주소에서 Chrome으로 가입·로그인·저장·두 브라우저 병합 확인

## 8. 운영 준비 (사용자가 대시보드에서 1회)

1. Vercel 프로젝트를 GitHub 저장소와 연결
2. Storage에서 Upstash for Redis를 추가해 프로젝트에 연결
3. 환경변수 `INVITE_CODE`, `SESSION_SECRET` 입력
