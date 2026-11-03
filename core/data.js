/* =========================================================
   연구해듀오 프로토타입 — 데이터
   - 이 파일만 고치면 연구자·프로젝트·시나리오를 바꿀 수 있어요.
   - 숙련도(level): 1 = 기초, 2 = 활용, 3 = 능숙
   - evNote: 숙련도 근거(논문·학회·프로젝트). 비어 있으면 '근거 없음'
   ========================================================= */

/* 1. 전문성 목록 — cat(분야)이 같으면 '관련 분야'로 추천,
      syn(유사어)을 입력하면 자동으로 해당 전문성으로 인식 */
const SKILLS = {
  '설문 설계':         { cat: '조사방법', syn: ['설문조사', '척도 개발', '문항 설계', '설문'] },
  '실험 설계':         { cat: '조사방법', syn: ['A/B 테스트', '실험'] },
  '임상 데이터 수집':   { cat: '조사방법', syn: ['임상 연구', '환자 데이터'] },
  '통계 분석':         { cat: '정량분석', syn: ['SPSS', 'R', '회귀분석', '통계', 'Stata'] },
  '구조방정식':        { cat: '정량분석', syn: ['SEM', 'AMOS', '경로분석'] },
  '질적 연구':         { cat: '질적분석', syn: ['인터뷰', '심층면담', 'FGI', '근거이론', '질적연구'] },
  '문헌 검토':         { cat: '연구기획', syn: ['체계적 문헌고찰', '선행연구', '문헌연구'] },
  '학술 글쓰기':        { cat: '연구기획', syn: ['논문 작성', '영문 교정', '논문 쓰기'] },
  'NLP 모델링':        { cat: 'AI',      syn: ['PyTorch', '자연어처리', 'LLM', '텍스트 분류', 'NLP'] },
  '머신러닝':          { cat: 'AI',      syn: ['딥러닝', '예측 모델', '시계열 예측', 'ML'] },
  '추천 시스템':        { cat: 'AI',      syn: ['협업 필터링', '추천 알고리즘'] },
  'AI 생성 콘텐츠 판별': { cat: 'AI',      syn: ['딥페이크 탐지', '가짜뉴스 탐지'] },
  '데이터 전처리':      { cat: '데이터',   syn: ['파싱', '크롤링', '데이터 정제', '다국어 데이터'] },
  '데이터 시각화':      { cat: '데이터',   syn: ['Tableau', '대시보드', '시각화'] },
  'GIS 분석':          { cat: '데이터',   syn: ['Web GIS', '공간분석', 'GIS'] },
  '메타데이터 설계':    { cat: '정보조직', syn: ['분류체계', '온톨로지', '메타데이터'] },
};

/* 입력한 용어를 전문성 목록의 이름으로 바꿔요. ①·② 모듈이 같이 써요.
   예) normalizeSkill('SPSS') → { tag: '통계 분석', via: 'SPSS' } */
function normalizeSkill(input) {
  const raw = String(input || '').trim();
  if (!raw) return { tag: null, raw };
  if (SKILLS[raw]) return { tag: raw, raw, via: null };
  const low = raw.toLowerCase().replace(/\s+/g, '');
  for (const tag of Object.keys(SKILLS)) {
    if (tag.toLowerCase().replace(/\s+/g, '') === low) return { tag, raw, via: null };
    if (SKILLS[tag].syn.some(s => s.toLowerCase().replace(/\s+/g, '') === low)) return { tag, raw, via: raw };
  }
  return { tag: null, raw };
}

const LEVELS = { 1: '기초', 2: '활용', 3: '능숙' };
const GOALS = ['학술지 투고', '학회 발표', '연구 경험', '기술 습득', '수업 과제'];
const MODES = ['온라인', '오프라인', '블렌디드'];
const ROLES = ['공동저자급 파트너', '방법론 자문', '데이터·실험 지원', '아이디어 토론'];
const COLLAB_TYPES = ['아이디어 논의', '방법론 자문', '공동 프로젝트', '논문 작성'];

/* 2. 더미 연구자 18명 */
const RESEARCHERS = [
  { id: 'r01', name: '이수현', school: '○○대', dept: '심리학과', degree: '석사', semester: '2학기',
    skills: [ { tag: '통계 분석', level: 3, evNote: '학회 발표 1 · 논문 1' },
              { tag: '설문 설계', level: 2, evNote: '참여 프로젝트 1' },
              { tag: '구조방정식', level: 2, evNote: '' } ],
    interests: ['학습 동기', '교육심리', '척도 개발'], goals: ['학술지 투고'],
    hours: [10, 15], mode: '오프라인', available: true, types: ['공동 프로젝트', '논문 작성'],
    intro: '대학생 학습 동기를 설문으로 측정하고 정량 분석하는 연구를 하고 있어요.',
    reviews: ['분석 꼼꼼'], completed: 2, liked: 8 },

  { id: 'r02', name: '김하린', school: '○○대', dept: '간호학과', degree: '석사', semester: '3학기',
    skills: [ { tag: '설문 설계', level: 3, evNote: '학회 발표 1' },
              { tag: '임상 데이터 수집', level: 3, evNote: '참여 프로젝트 1' },
              { tag: '통계 분석', level: 2, evNote: '' } ],
    interests: ['노인 간호', '낙상 예측', '디지털 헬스'], goals: ['학회 발표', '연구 경험'],
    hours: [3, 6], mode: '블렌디드', available: true, types: ['공동 프로젝트', '방법론 자문'],
    intro: '노인 낙상 위험을 줄이는 디지털 헬스 개입에 관심이 있어요.',
    reviews: ['응답이 빨라요'], completed: 1, liked: 5 },

  { id: 'r03', name: '김성현', school: '○○대', dept: '컴퓨터공학과', degree: '석사', semester: '1학기',
    skills: [ { tag: 'NLP 모델링', level: 1, evNote: '' },
              { tag: '데이터 전처리', level: 2, evNote: '수업 프로젝트 1' } ],
    interests: ['LLM', '텍스트 분류'], goals: ['기술 습득', '학회 발표'],
    hours: [4, 8], mode: '온라인', available: true, types: ['공동 프로젝트'],
    intro: 'PyTorch를 수업 과제로 써봤고 NLP 연구 경험을 쌓고 싶어요.',
    reviews: [], completed: 0, liked: 6 },

  { id: 'r04', name: '정유진', school: '△△대', dept: '언어학과·AI 협동과정', degree: '박사', semester: '2학기',
    skills: [ { tag: 'NLP 모델링', level: 3, evNote: '논문 2 · 참여 프로젝트 1' },
              { tag: '데이터 전처리', level: 3, evNote: '참여 프로젝트 1' },
              { tag: '머신러닝', level: 2, evNote: '학회 발표 1' } ],
    interests: ['다국어 언어모델', '학술 텍스트 마이닝'], goals: ['학술지 투고', '학회 발표'],
    hours: [4, 6], mode: '온라인', available: true, types: ['공동 프로젝트', '논문 작성'],
    intro: '다국어 텍스트 분류 모델을 연구하고 있어요. 학술 데이터에 관심이 많아요.',
    reviews: ['설명이 친절해요'], completed: 3, liked: 12 },

  { id: 'r05', name: '이현우', school: '○○대', dept: '환경공학과', degree: '석사', semester: '2학기',
    skills: [ { tag: 'GIS 분석', level: 3, evNote: '학회 발표 2' },
              { tag: '데이터 전처리', level: 2, evNote: '참여 프로젝트 1' } ],
    interests: ['해양 오염', '공간 데이터'], goals: ['학회 발표'],
    hours: [5, 8], mode: '오프라인', available: true, types: ['공동 프로젝트'],
    intro: '해양 관측 데이터를 정리하고 Web GIS로 시각화하는 작업을 해요.',
    reviews: [], completed: 1, liked: 3 },

  { id: 'r06', name: '박서준', school: '○○대', dept: '인공지능학과', degree: '석사', semester: '3학기',
    skills: [ { tag: '머신러닝', level: 3, evNote: '논문 1 · 학회 발표 1' },
              { tag: 'NLP 모델링', level: 2, evNote: '참여 프로젝트 1' } ],
    interests: ['시계열 예측', '환경 데이터'], goals: ['학술지 투고', '기술 습득'],
    hours: [6, 10], mode: '블렌디드', available: true, types: ['공동 프로젝트', '방법론 자문'],
    intro: '딥러닝 기반 시계열 예측 모델을 다양한 도메인에 적용해 보고 싶어요.',
    reviews: ['일정 잘 지켜요'], completed: 2, liked: 9 },

  { id: 'r07', name: '최다은', school: '□□대', dept: '데이터사이언스학과', degree: '석사', semester: '2학기',
    skills: [ { tag: '추천 시스템', level: 3, evNote: '참여 프로젝트 1' },
              { tag: '통계 분석', level: 2, evNote: '수업 프로젝트 1' },
              { tag: '데이터 시각화', level: 2, evNote: '' } ],
    interests: ['추천 알고리즘', '이용자 행동 데이터'], goals: ['학회 발표', '연구 경험'],
    hours: [4, 8], mode: '블렌디드', available: true, types: ['공동 프로젝트'],
    intro: '협업 필터링 기반 추천 시스템을 공공 데이터에 적용해 보고 싶어요.',
    reviews: [], completed: 0, liked: 4 },

  { id: 'r08', name: '오지민', school: '○○대', dept: '사회학과', degree: '박사', semester: '3학기',
    skills: [ { tag: '질적 연구', level: 3, evNote: '논문 2 · 학회 발표 1' },
              { tag: '문헌 검토', level: 3, evNote: '논문 1' } ],
    interests: ['미디어 이용', '청년 세대'], goals: ['학술지 투고'],
    hours: [3, 5], mode: '오프라인', available: true, types: ['방법론 자문', '논문 작성'],
    intro: '심층 인터뷰로 청년 세대의 미디어 이용 경험을 연구해요.',
    reviews: ['피드백이 구체적이에요'], completed: 4, liked: 15 },

  { id: 'r09', name: '한서윤', school: '○○대', dept: '교육학과', degree: '박사', semester: '1학기',
    skills: [ { tag: '구조방정식', level: 3, evNote: '논문 1 · 학회 발표 1' },
              { tag: '통계 분석', level: 3, evNote: '논문 1' },
              { tag: '설문 설계', level: 2, evNote: '참여 프로젝트 1' } ],
    interests: ['디지털 리터러시', '교육 공학'], goals: ['학술지 투고'],
    hours: [5, 10], mode: '블렌디드', available: true, types: ['공동 프로젝트', '논문 작성'],
    intro: '디지털 리터러시와 학습 성과의 관계를 구조방정식으로 분석해요.',
    reviews: ['분석 꼼꼼'], completed: 2, liked: 7 },

  { id: 'r10', name: '윤도현', school: '○○대', dept: '미디어커뮤니케이션학과', degree: '학부', semester: '4학년',
    skills: [ { tag: 'AI 생성 콘텐츠 판별', level: 2, evNote: '수업 프로젝트 1' },
              { tag: '질적 연구', level: 1, evNote: '' } ],
    interests: ['가짜뉴스', '생성형 AI'], goals: ['연구 경험'],
    hours: [3, 5], mode: '온라인', available: true, types: ['아이디어 논의', '공동 프로젝트'],
    intro: '생성형 AI가 만든 뉴스를 사람들이 어떻게 판단하는지 궁금해요.',
    reviews: [], completed: 0, liked: 2 },

  { id: 'r11', name: '강민서', school: '□□대', dept: '통계학과', degree: '학부', semester: '3학년',
    skills: [ { tag: '통계 분석', level: 2, evNote: '수업 프로젝트 1' },
              { tag: '데이터 시각화', level: 2, evNote: '공모전 1' } ],
    interests: ['교육 데이터', '설문 분석'], goals: ['연구 경험', '기술 습득'],
    hours: [3, 6], mode: '온라인', available: true, types: ['공동 프로젝트'],
    intro: '수업에서 배운 통계를 실제 연구에 써보고 싶어요.',
    reviews: [], completed: 0, liked: 1 },

  { id: 'r12', name: '서예린', school: '○○대', dept: '문헌정보학과', degree: '석사', semester: '2학기',
    skills: [ { tag: '메타데이터 설계', level: 3, evNote: '학회 발표 1' },
              { tag: '문헌 검토', level: 2, evNote: '참여 프로젝트 1' },
              { tag: '데이터 전처리', level: 1, evNote: '' } ],
    interests: ['학술 데이터', '분류 체계'], goals: ['학회 발표'],
    hours: [3, 6], mode: '블렌디드', available: true, types: ['아이디어 논의', '공동 프로젝트'],
    intro: '학술 데이터의 메타데이터 품질과 분류 체계를 연구해요.',
    reviews: [], completed: 1, liked: 6 },

  { id: 'r13', name: '임재훈', school: '△△대', dept: '경영학과', degree: '석사', semester: '1학기',
    skills: [ { tag: '실험 설계', level: 2, evNote: '' },
              { tag: '통계 분석', level: 2, evNote: '' },
              { tag: '설문 설계', level: 2, evNote: '수업 프로젝트 1' } ],
    interests: ['소비자 행동', '생성형 AI 활용'], goals: ['학술지 투고', '연구 경험'],
    hours: [4, 6], mode: '온라인', available: false, types: ['아이디어 논의'],
    intro: '이번 학기는 논문 준비로 참여가 어려워요.',
    reviews: [], completed: 0, liked: 3 },

  { id: 'r14', name: '배수아', school: '○○대', dept: '심리학과', degree: '학부', semester: '4학년',
    skills: [ { tag: '설문 설계', level: 2, evNote: '학부 연구생 1' },
              { tag: '실험 설계', level: 2, evNote: '학부 연구생 1' } ],
    interests: ['학습 효율', '인지 부하'], goals: ['연구 경험'],
    hours: [3, 5], mode: '블렌디드', available: true, types: ['공동 프로젝트', '아이디어 논의'],
    intro: '학부 연구생으로 설문·실험을 설계해 본 경험이 있어요.',
    reviews: ['응답이 빨라요'], completed: 1, liked: 4 },

  { id: 'r15', name: '노태윤', school: '□□대', dept: '컴퓨터공학과', degree: '학부', semester: '4학년',
    skills: [ { tag: '데이터 전처리', level: 2, evNote: '크롤링 프로젝트 1' },
              { tag: '데이터 시각화', level: 2, evNote: '공모전 1' },
              { tag: '추천 시스템', level: 1, evNote: '' } ],
    interests: ['웹 크롤링', '대시보드'], goals: ['기술 습득', '연구 경험'],
    hours: [5, 10], mode: '온라인', available: true, types: ['공동 프로젝트'],
    intro: '데이터 수집·정제와 시각화를 맡을 수 있어요.',
    reviews: [], completed: 0, liked: 2 },

  { id: 'r16', name: '문가은', school: '△△대', dept: '정보통계학과', degree: '박사', semester: '2학기',
    skills: [ { tag: '통계 분석', level: 3, evNote: '논문 2 · 학회 발표 1' },
              { tag: '구조방정식', level: 3, evNote: '논문 1' } ],
    interests: ['측정 모형', '교육 통계'], goals: ['학술지 투고'],
    hours: [2, 4], mode: '온라인', available: true, types: ['방법론 자문'],
    intro: '짧은 방법론 자문 위주로 참여할 수 있어요.',
    reviews: ['피드백이 구체적이에요'], completed: 5, liked: 10 },

  { id: 'r17', name: '장우석', school: '○○대', dept: '인공지능학과', degree: '박사', semester: '1학기',
    skills: [ { tag: 'AI 생성 콘텐츠 판별', level: 3, evNote: '논문 1 · 학회 발표 1' },
              { tag: '머신러닝', level: 3, evNote: '참여 프로젝트 1' } ],
    interests: ['딥페이크 탐지', '미디어 포렌식'], goals: ['학술지 투고', '학회 발표'],
    hours: [4, 6], mode: '블렌디드', available: true, types: ['공동 프로젝트', '방법론 자문'],
    intro: 'AI 생성 이미지·텍스트 탐지 모델을 연구해요.',
    reviews: [], completed: 1, liked: 11 },

  { id: 'r18', name: '홍채린', school: '□□대', dept: '교육공학과', degree: '석사', semester: '3학기',
    skills: [ { tag: '학술 글쓰기', level: 3, evNote: '논문 1' },
              { tag: '질적 연구', level: 2, evNote: '참여 프로젝트 1' },
              { tag: '문헌 검토', level: 2, evNote: '' } ],
    interests: ['수업 설계', '협력 학습'], goals: ['학회 발표', '연구 경험'],
    hours: [3, 6], mode: '온라인', available: true, types: ['논문 작성', '아이디어 논의'],
    intro: '논문 구조 잡기와 글쓰기를 도와줄 수 있어요.',
    reviews: ['설명이 친절해요'], completed: 2, liked: 5 },
];

/* 3. 다른 사람이 올린 더미 프로젝트 (연구자 → 프로젝트 추천에 사용) */
const PROJECTS = [
  { id: 'p01', title: '생성형 AI 가짜뉴스가 대학생의 정보 판단에 미치는 영향', owner: '윤도현 · 미디어커뮤니케이션학과 학부',
    summary: '생성형 AI로 만든 가짜뉴스를 대학생이 어떻게 판단하는지 설문으로 알아봐요.',
    goal: '연구 경험', hours: [3, 6], mode: '온라인',
    slots: [ { tag: '통계 분석', level: 2, role: '데이터·실험 지원' },
             { tag: 'AI 생성 콘텐츠 판별', level: 2, role: '공동저자급 파트너' } ] },
  { id: 'p02', title: 'AI 기반 미세플라스틱 오염도 예측', owner: '김지아 · 환경학과 박사',
    summary: '해양 데이터와 유속 변수를 반영한 오염도 예측 모델을 만들어요.',
    goal: '학술지 투고', hours: [5, 10], mode: '블렌디드',
    slots: [ { tag: '데이터 전처리', level: 2, role: '데이터·실험 지원' },
             { tag: 'GIS 분석', level: 2, role: '데이터·실험 지원' },
             { tag: '머신러닝', level: 3, role: '공동저자급 파트너' } ] },
  { id: 'p03', title: 'LLM 활용 다국어 학술 데이터 자동 분류 및 시각화', owner: '박민우 · 문헌정보학과 석사',
    summary: '여러 언어의 학술 데이터를 LLM으로 자동 분류하고 시각화해요.',
    goal: '학회 발표', hours: [5, 8], mode: '온라인',
    slots: [ { tag: 'NLP 모델링', level: 3, role: '공동저자급 파트너' },
             { tag: '데이터 전처리', level: 2, role: '데이터·실험 지원' } ] },
  { id: 'p04', title: '공공도서관 대출 데이터 기반 맞춤형 도서 추천', owner: '연구자 A · 문헌정보학과 석사',
    summary: '대출 로그로 이용자 맞춤 도서 추천 모델을 만들고 이용자 인식을 조사해요.',
    goal: '학회 발표', hours: [4, 8], mode: '블렌디드',
    slots: [ { tag: '추천 시스템', level: 2, role: '공동저자급 파트너' },
             { tag: '통계 분석', level: 2, role: '데이터·실험 지원' } ] },
  { id: 'p05', title: '노인 낙상 예측을 위한 웨어러블 데이터 분석', owner: '정소희 · 간호학과 박사',
    summary: '웨어러블 기기 데이터로 낙상 위험을 미리 알려주는 모델을 만들어요.',
    goal: '학회 발표', hours: [4, 8], mode: '오프라인',
    slots: [ { tag: '머신러닝', level: 2, role: '공동저자급 파트너' },
             { tag: '임상 데이터 수집', level: 2, role: '데이터·실험 지원' } ] },
  { id: 'p06', title: '대학 수업 내 협업 경험에 대한 질적 연구', owner: '조은비 · 교육학과 석사',
    summary: '팀 프로젝트 수업을 들은 학생들을 인터뷰해 협업 경험을 분석해요.',
    goal: '학회 발표', hours: [3, 5], mode: '온라인',
    slots: [ { tag: '질적 연구', level: 2, role: '방법론 자문' },
             { tag: '학술 글쓰기', level: 2, role: '아이디어 토론' } ] },
];

/* 4. 테스트용 시나리오 — project.html?s=1 처럼 불러와요 */
const SCENARIOS = {
  1: { label: '시나리오 1', persona: '민정 · 경영학과 학부생',
       check: '통계를 잘하는 수현이 추천될 때 목표(학술지 vs 연구 경험)·시간 차이가 경고로 보이는가?',
       project: { title: '대학생의 생성형 AI 활용이 학습 효율에 미치는 영향',
                  summary: '대학생의 생성형 AI 활용 정도와 학습 효율의 관계를 설문으로 분석하려고 해요.',
                  goal: '연구 경험', hours: [3, 5], mode: '온라인',
                  slots: [ { tag: '설문 설계', level: 2, role: '방법론 자문' },
                           { tag: '통계 분석', level: 2, role: '데이터·실험 지원' } ] } },
  2: { label: '시나리오 2', persona: 'K · 교육학과 박사과정',
       check: '분석 단계에서 구조방정식 역량을 추가했을 때 시간이 맞는 연구자가 위로 오는가?',
       project: { title: '대학생 디지털 리터러시와 생성형 AI 활용의 관계',
                  summary: '디지털 리터러시가 생성형 AI 활용에 미치는 영향을 분석해요.',
                  goal: '학술지 투고', hours: [5, 10], mode: '블렌디드',
                  slots: [ { tag: '설문 설계', level: 2, role: '방법론 자문' },
                           { tag: '구조방정식', level: 3, role: '공동저자급 파트너' } ] } },
  4: { label: '시나리오 4', persona: '민우 · 문헌정보학과 석사',
       check: 'PyTorch를 기초만 써본 성현이 근거 없음 경고와 함께 아래로 내려가는가?',
       project: { title: 'LLM 활용 다국어 학술 데이터 자동 분류 및 시각화',
                  summary: '여러 언어의 학술 데이터를 LLM으로 자동 분류하고 시각화하는 석사 논문 연구예요.',
                  goal: '학회 발표', hours: [5, 8], mode: '온라인',
                  slots: [ { tag: 'NLP 모델링', level: 3, role: '공동저자급 파트너' },
                           { tag: '데이터 전처리', level: 2, role: '데이터·실험 지원' } ] } },
  6: { label: '시나리오 6', persona: '연구자 A · 문헌정보학과 석사',
       check: '‘협업 필터링’, ‘SPSS’ 같은 용어를 입력해도 올바른 전문성으로 인식되는가?',
       project: { title: '공공도서관 대출 데이터를 활용한 맞춤형 도서 추천',
                  summary: '대출 로그 데이터로 이용자 맞춤형 도서 추천 알고리즘을 만들어요.',
                  goal: '학회 발표', hours: [4, 8], mode: '블렌디드',
                  slots: [ { tag: '협업 필터링', level: 2, role: '공동저자급 파트너' },
                           { tag: 'SPSS', level: 2, role: '데이터·실험 지원' } ] } },
};
