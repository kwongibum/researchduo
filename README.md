# 연구해듀오 (Research Duo) 프로토타입

> 필요한 전문성으로 공동 연구자를 찾고 연결하는 AI 기반 연구자 매칭 서비스
> 과학기술학개론 조별 프로젝트

- 사이트 주소: `https://<GitHub아이디>.github.io/<저장소이름>/` ← 배포 후 여기에 적어 두세요
- 현재 버전: **v0.1** (변경 기록은 `core/common.js` 위쪽 `CHANGELOG`와 `docs/개선기록.md`)

---

## 1. 폴더 구조: 누가 어디를 고치나

```
index.html                  홈 화면                         ← 공통 (팀장)
core/                       공통 모듈                        ← 공통 (팀장, 고칠 때 팀에 공지)
  ├─ style.css              색·글꼴·버튼·입력칸 등 공통 디자인
  ├─ home.css               홈 화면 디자인
  ├─ data.js                더미 연구자 18명·프로젝트 6개·시나리오·전문성 목록
  └─ common.js              상단 메뉴, 하단, 테스트 메모, 모듈 간 데이터 저장소(RD.store)
features/
  ├─ profile/   ① 연구 프로필                                ← 기능 1 담당
  │    ├─ profile.html / profile.css / profile.js
  │    └─ profile-view.js / profile-view.css  (프로필 화면 부품, ②도 가져다 씀)
  ├─ matching/  ② 프로젝트 개설·AI 매칭                       ← 기능 2 담당
  │    ├─ matching.html / matching.css / matching.js
  │    └─ match.js           매칭 점수 규칙 (AI 역할을 대신함)
  └─ connect/   ③ 요청·커피챗·그룹                           ← 기능 3 담당
       └─ connect.html / connect.css / connect.js
docs/개선기록.md             주간 발표용 문제·보완 기록
```

**규칙: 각자 자기 `features/○○/` 폴더 안만 고치기.** 폴더가 겹치지 않으니 GitHub에서 합칠 때 충돌이 거의 나지 않아요.

## 2. 모듈끼리 연결되는 방법

세 모듈은 브라우저 저장소(localStorage)로 데이터를 주고받아요. 직접 저장하지 말고 `core/common.js`의 `RD.store` 함수를 쓰세요.

| 저장 이름 | 쓰는 모듈 | 읽는 모듈 | 함수 |
|---|---|---|---|
| `rd_profile` | ① 프로필 | ② (나에게 맞는 프로젝트), ③ (그룹 멤버 이름) | `RD.store.saveProfile()` / `getProfile()` |
| `rd_project` | ② 매칭 | ② (다시 열 때), ③ (재매칭 버튼) | `RD.store.saveProject()` / `getProject()` |
| `rd_requests` | ② 매칭 (요청 생성) | ③ (상태 변경) | `RD.store.addRequest()` / `getRequests()` / `updateRequest()` |

- 요청 한 건의 모양(필드)은 `core/common.js` 맨 위 주석에 있어요. **필드 이름을 바꾸려면 ②·③ 담당자가 같이 정하기.**
- ②는 ①의 `profile-view.js`(프로필 화면)를 가져다 써요. ① 담당자가 `RDProfileView.render()` 사용법을 바꾸면 ②에 알려 주세요.
- 저장소는 **브라우저마다 따로**예요. 내 컴퓨터에서 만든 프로필은 다른 사람 화면에 안 보여요 (프로토타입 한계).

## 3. GitHub에 올리고 합치기

### 처음 한 번 (팀장)
1. GitHub에서 **New repository** → 이름 예: `research-duo` → **Public** → Create
2. 저장소 화면에서 **uploading an existing file** 클릭 → 압축을 푼 폴더 **안의 내용 전체**(index.html, core, features, docs, README.md, .nojekyll)를 끌어다 놓기 → **Commit changes**
3. **Settings → Collaborators → Add people** 로 팀원 초대
4. **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main**, 폴더 **/(root)** → Save
5. 1~2분 뒤 `https://<아이디>.github.io/research-duo/` 에서 사이트 확인 → 이 README 맨 위 주소 칸에 적기

### 각 담당자가 수정할 때
**방법 A. 웹에서 바로 (가장 쉬움)**
1. 저장소에서 내 파일 열기 (예: `features/profile/profile.js`) → 연필 아이콘(Edit)
2. 수정 후 **Commit changes** → **Create a new branch for this commit and start a pull request** 선택 (브랜치 이름 예: `feature-1-profile`)
3. **Pull request** 만들기 → 팀장이 확인하고 **Merge**

**방법 B. GitHub Desktop (파일 여러 개를 고칠 때)**
1. GitHub Desktop으로 저장소 Clone
2. **Current branch → New branch** (`feature-1-profile` / `feature-2-matching` / `feature-3-connect`)
3. VS Code 등에서 내 폴더 수정 → 크롬에서 `index.html`을 열어 확인
4. Commit → **Push origin** → **Create Pull Request** → 팀장이 Merge

### 합친 뒤 연결 확인 (매주 Merge 후 5분)
- [ ] ①에서 프로필 저장 → ②의 ‘나에게 맞는 프로젝트’에 내 역량이 반영되는가
- [ ] ②에서 협업 요청 → ③ ‘진행 중인 요청’에 나타나는가
- [ ] ③에서 그룹 결성 → ‘필요 역량 추가 → 재매칭’ 버튼이 ②로 이어지는가
- [ ] 화면 아래 **테스트 데이터 초기화** 후 처음부터 다시 해도 오류가 없는가

## 4. 자주 고칠 곳

| 하고 싶은 것 | 고칠 파일 |
|---|---|
| 더미 연구자·프로젝트 추가 / 수정 | `core/data.js` |
| 전문성 목록·유사어 추가 (예: ‘Python’ → 머신러닝) | `core/data.js`의 `SKILLS` |
| 매칭 점수 비중 바꾸기 (전문성 40 / 근거 20 / 목표 20 / 조건 20) | `features/matching/match.js`의 `WEIGHTS` |
| 시나리오 추가 | `core/data.js`의 `SCENARIOS` |
| 홈 화면의 ‘담당 · 이름’ 바꾸기 | `index.html` |
| 버전·변경 기록 | `core/common.js`의 `VERSION`, `CHANGELOG` + `docs/개선기록.md` |

## 5. 매주 발표 흐름

1. **지난주 문제 → 이렇게 고쳤다** (둘째 주부터)
2. 이번 주 핵심 기능 범위
3. 프로토타입 시연: 홈의 **시나리오로 테스트하기**를 그대로 시연
4. 발견한 문제점: 오른쪽 아래 **테스트 메모 → 표 형식으로 복사**한 내용을 정리
5. 다음 주 보완 계획
