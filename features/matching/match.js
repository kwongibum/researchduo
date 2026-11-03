/* =========================================================
   연구해듀오 프로토타입 — 매칭 규칙
   실제 서비스에서는 AI가 할 일을, 프로토타입에서는 아래 점수 규칙으로 대신해요.
   발표 때 '매칭 기준'으로 그대로 설명할 수 있도록 단순하게 유지합니다.

   총점 100 = 전문성 40 + 숙련도·근거 20 + 목표 성과 20 + 협업 조건 20
   → 문제를 발견하면 WEIGHTS 숫자나 아래 규칙을 고치고 버전을 올리세요.
   ========================================================= */

const WEIGHTS = {
  expertise: 40, // 필요한 전문성을 갖고 있는가 (정확히 일치 / 같은 분야)
  level: 20,     // 요구 숙련도 이상인가 + 근거 자료가 있는가
  goal: 20,      // 목표 성과(학술지·학회·연구 경험 등)가 같은가
  cond: 20,      // 주당 시간·협업 방식이 맞는가
};
const RELATED_RATIO = 0.55; // 같은 분야(cat)의 다른 전문성일 때 전문성 점수 비율

/* normalizeSkill(입력어) 는 core/data.js 에 있어요 (① 프로필 모듈도 같이 쓰기 때문) */

function hoursOverlap(a, b) { return a[0] <= b[1] && b[0] <= a[1]; }
function modeOk(a, b) { return a === b || a === '블렌디드' || b === '블렌디드'; }

/* 연구자 r 이 프로젝트의 슬롯(필요 전문성 1개)에 얼마나 맞는지 계산 */
function scoreResearcher(r, slot, project) {
  if (!SKILLS[slot.tag]) return null;
  let skill = r.skills.find(s => s.tag === slot.tag);
  let type = 'exact';
  if (!skill) {
    const cat = SKILLS[slot.tag].cat;
    skill = r.skills
      .filter(s => SKILLS[s.tag] && SKILLS[s.tag].cat === cat)
      .sort((a, b) => b.level - a.level)[0];
    if (!skill) return null;
    type = 'related';
  }
  const reasons = [], warns = [], parts = {};
  const hasEv = !!(skill.evNote && skill.evNote.trim());

  // 1) 전문성
  if (type === 'exact') {
    parts.expertise = WEIGHTS.expertise;
    reasons.push(`필요 전문성 ‘${slot.tag}’ 보유`);
  } else {
    parts.expertise = Math.round(WEIGHTS.expertise * RELATED_RATIO);
    warns.push(`‘${slot.tag}’ 대신 같은 분야의 ‘${skill.tag}’ 보유 (관련 분야 추천)`);
  }

  // 2) 숙련도 + 근거
  let lv = skill.level >= slot.level ? 12 : skill.level === slot.level - 1 ? 6 : 2;
  if (hasEv) lv += 8;
  parts.level = Math.round((lv / 20) * WEIGHTS.level);
  if (skill.level >= slot.level) reasons.push(`숙련도 ${LEVELS[skill.level]} (요구: ${LEVELS[slot.level]} 이상)`);
  else warns.push(`숙련도 ${LEVELS[skill.level]}: 요구 수준(${LEVELS[slot.level]})보다 낮음`);
  if (hasEv) reasons.push(`근거: ${skill.evNote}`);
  else warns.push('숙련도 근거 자료 없음, 커피챗에서 실제 경험 확인 필요');

  // 3) 목표 성과
  if (r.goals.includes(project.goal)) {
    parts.goal = WEIGHTS.goal;
    reasons.push(`목표 성과 일치: ${project.goal}`);
  } else {
    parts.goal = 0;
    warns.push(`목표 성과가 다름: 상대는 ‘${r.goals.join('·') || '미입력'}’ 희망`);
  }

  // 4) 협업 조건
  let c = 0;
  if (hoursOverlap(r.hours, project.hours)) {
    c += 12; reasons.push(`주당 시간 맞음 (상대 ${r.hours[0]}–${r.hours[1]}시간)`);
  } else {
    warns.push(`주당 시간 차이: 상대 ${r.hours[0]}–${r.hours[1]}시간 / 프로젝트 ${project.hours[0]}–${project.hours[1]}시간`);
  }
  if (modeOk(r.mode, project.mode)) c += 8;
  else warns.push(`협업 방식 차이: 상대는 ${r.mode} 선호`);
  parts.cond = Math.round((c / 20) * WEIGHTS.cond);

  const total = parts.expertise + parts.level + parts.goal + parts.cond;
  return { r, slot, type, skill, parts, total, reasons, warns, available: r.available !== false };
}

/* 프로젝트 → 사람 : 슬롯마다 추천 연구자 목록 */
function matchProject(project, researchers) {
  return project.slots.map(slot => ({
    slot,
    results: researchers
      .map(r => scoreResearcher(r, slot, project))
      .filter(Boolean)
      .sort((a, b) => (b.available - a.available) || (b.total - a.total)),
  }));
}

/* 사람 → 프로젝트 : 나에게 맞는 프로젝트 목록 (프로젝트별 가장 잘 맞는 슬롯 기준) */
function matchProjectsFor(me, projects) {
  return projects
    .map(p => {
      const best = p.slots
        .map(slot => scoreResearcher(me, slot, p))
        .filter(Boolean)
        .sort((a, b) => b.total - a.total)[0];
      return best ? { project: p, ...best } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total);
}
