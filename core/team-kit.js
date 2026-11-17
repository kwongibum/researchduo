/* =========================================================
   연구해듀오 — 프로젝트 팀 공통 도구 (core/team-kit.js)  v0.3
   ② 매칭(프로젝트), ③ 요청·팀(팀 공간) 모듈이 같이 써요. 고칠 때는 팀에 알려주세요.

   프로젝트(=팀) 모양:
   { id, ownerId, ownerName, title, summary, topics:[], keywords:[], goals:[], hours:[], mode,
     visibility:'public'|'private', status:'모집 중'|'진행 중'|'완료', chatLink,
     slots:[{ id, tag, level, role, filledBy }],                       ← 필요한 전문성 '자리'
     members:[{ userId, name, slotId, role, period, author, contribution, hours, joined }] }
   ========================================================= */
const RDTeam = (() => {
  const e = s => RD.esc(s);

  const isMember = (p, uid) => !!p && (p.ownerId === uid || (p.members || []).some(m => m.userId === uid));
  const myTeams = (projects, uid) => projects.filter(p => isMember(p, uid));
  const openSlots = p => (p.slots || []).filter(s => s.tag && !s.filledBy);
  const memberName = (p, uid) => (uid === p.ownerId ? p.ownerName : ((p.members || []).find(m => m.userId === uid) || {}).name || '');
  const slotById = (p, id) => (p.slots || []).find(s => s.id === id);

  /* 프로젝트를 매칭 엔진의 '찾는 사람' 모양으로 (needs를 바꿔 특정 자리만 볼 수도 있음)
     ① 주제·키워드, ② 필요한 자리, ⑤ 목표, ⑥ 시간·방식 = 프로젝트 값 / ③ 경험·④ 학과·전공 = 개설자 프로필 */
  function seekerOf(p, profiles, needsOverride) {
    const o = profiles.find(x => x.userId === p.ownerId) || {};
    return {
      userId: p.ownerId, name: p.ownerName,
      topics: p.topics || [], keywords: p.keywords || [],
      needs: needsOverride || openSlots(p).map(s => s.tag),
      skills: o.skills || [], exp: o.exp, dept: o.dept, field: o.field, deptPref: o.deptPref || '상관없음',
      goals: (p.goals && p.goals.length) ? p.goals : (o.goals || []),
      hours: p.hours || o.hours, mode: p.mode || o.mode, available: true,
    };
  }

  /* 자리별로 이 사람이 채울 수 있는지 (요구 숙련도 비교) */
  function slotFits(slots, person) {
    const skills = ((person && person.skills) || []).filter(s => s.tag);
    return (slots || []).filter(s => s.tag).map(s => {
      const ex = skills.find(k => k.tag === s.tag);
      if (ex) return { s, cls: ex.level >= s.level ? 'ok' : 'low', text: `${s.tag} ${LEVELS[ex.level]}${ex.level >= s.level ? ' ✓' : ` (요구 ${LEVELS[s.level]})`}` };
      const cat = SKILLS[s.tag] && SKILLS[s.tag].cat;
      const rel = cat && skills.find(k => SKILLS[k.tag] && SKILLS[k.tag].cat === cat);
      if (rel) return { s, cls: 'rel', text: `${s.tag} ← 비슷한 ${rel.tag}` };
      return { s, cls: '', text: `${s.tag} 없음` };
    });
  }
  function bestSlot(slots, person) {
    const f = slotFits(slots, person);
    return ((f.find(x => x.cls === 'ok') || f.find(x => x.cls === 'low') || f.find(x => x.cls === 'rel') || f[0]) || {}).s;
  }

  /* ---------- 배지: 회원 구분 + 연구 경험 단계 ---------- */
  function badges(p) {
    if (!p) return '';
    const st = expStage(p);
    return `<span class="mbadge t-${e(memberType(p))}">${e(memberType(p))}</span>${st ? `<span class="mbadge stage" title="${e(st.desc)}">연구 경험 · ${e(st.label)}</span>` : ''}`;
  }

  /* ---------- 기여 의향서 (가진 능력 ≠ 이 프로젝트에서 하고 싶은 것) ---------- */
  function intentForm(slots, def = {}, opts = {}) {
    const list = (slots || []).filter(s => s.tag);
    return `<div class="intent">
      <div class="intent-h">기여 의향서 <small>가진 능력 중 <b>이 프로젝트에서 실제로 하고 싶은 것</b>을 적어요</small></div>
      ${list.length ? `<div class="field"><label>맡고 싶은 자리</label><select class="i-slot">${list.map(s =>
        `<option value="${e(s.id)}" ${def.slotId === s.id ? 'selected' : ''}>${e(s.tag)} · ${e(s.role || '')}${s.filledBy ? ' (채워짐)' : ''}</option>`).join('')}</select></div>` : ''}
      <div class="field"><label>구체적으로 무엇을 기여하고 싶나요?</label>
        <input type="text" class="i-contrib" value="${e(def.contribution || '')}" placeholder="예) 설문 데이터 수집과 기초 통계 분석 담당"></div>
      <div class="grid2">
        <div class="field"><label>투입 가능 시간</label><input type="text" class="i-hours" value="${e(def.hours || '')}" placeholder="예) 주 4시간"></div>
        <div class="field"><label>참여 기간</label><select class="i-period">${PERIODS.map(x => `<option ${(def.period || '2주 단기 협업') === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>참여 동기 · 향후 계획 <small>${opts.optionalPlan ? '선택' : ''}</small></label>
        <textarea class="i-motive" rows="2" placeholder="예) 데이터 분석 경험을 쌓아서 다음 학기 졸업 논문에 활용하고 싶어요">${e(def.motivation || '')}</textarea></div>
    </div>`;
  }
  function readIntent(root) {
    const v = sel => { const el = root.querySelector(sel); return el ? el.value.trim() : ''; };
    return { slotId: v('.i-slot'), contribution: v('.i-contrib'), hours: v('.i-hours'), period: v('.i-period'), motivation: v('.i-motive') };
  }
  function intentView(it, p) {
    if (!it || !(it.contribution || it.motivation)) return '';
    const s = p && it.slotId ? slotById(p, it.slotId) : null;
    return `<div class="intent-v">
      <div class="iv-h">기여 의향</div>
      ${s ? `<div><b>자리</b>${e(s.tag)} · ${e(s.role || '')}</div>` : ''}
      ${it.contribution ? `<div><b>기여 내용</b>${e(it.contribution)}</div>` : ''}
      ${(it.hours || it.period) ? `<div><b>시간·기간</b>${e([it.hours, it.period].filter(Boolean).join(' · '))}</div>` : ''}
      ${it.motivation ? `<div><b>동기·계획</b>${e(it.motivation)}</div>` : ''}
    </div>`;
  }

  const STATUS_LABEL = { req: '요청 중', acc: '수락됨', chat: '커피챗 예정', group: '팀 합류', rej: '거절됨', end: '종료됨' };
  const STATUS_CLS = { '모집 중': 'recruit', '진행 중': 'active', '완료': 'done' };
  const statusChip = st => `<span class="tstat ${STATUS_CLS[st] || ''}">${e(st || '모집 중')}</span>`;
  const visChip = p => (p.visibility === 'private' ? '<span class="chip">🔒 비공개</span>' : '<span class="chip g">공개</span>');

  /* 요청을 보낼 때 고르는 '대상 팀' 선택 칸 (내가 팀원인 팀 + 새 팀 만들기) */
  function teamPicker(projects, uid, selectedId) {
    const mine = myTeams(projects, uid).filter(p => p.status !== '완료');
    return `<div class="field"><label>어느 프로젝트 팀으로 초대하나요?</label>
      <select class="t-pick">${mine.map(p => `<option value="${e(p.id)}" ${p.id === selectedId ? 'selected' : ''}>${e(p.title)} (기존 팀 · ${1 + (p.members || []).length}명)</option>`).join('')}
        <option value="__new" ${!mine.length || selectedId === '__new' ? 'selected' : ''}>+ 새 프로젝트 팀 만들기</option></select></div>
      <div class="t-new ${mine.length && selectedId !== '__new' ? 'hide' : ''}">
        <div class="field"><label>새 팀 이름 <small>나중에 팀 공간에서 바꿀 수 있어요</small></label><input type="text" class="t-title" placeholder="예) 생성형 AI 활용과 학습 효율 연구"></div>
        <label class="toggle"><input type="checkbox" class="t-public" checked> 공개 (다른 연구자도 참여 요청 가능)</label>
      </div>`;
  }
  function bindTeamPicker(root, onChange) {
    const sel = root.querySelector('.t-pick');
    if (!sel) return;
    sel.onchange = () => { root.querySelector('.t-new').classList.toggle('hide', sel.value !== '__new'); if (onChange) onChange(sel.value); };
  }

  return { isMember, myTeams, openSlots, memberName, slotById, seekerOf, slotFits, bestSlot, badges,
           intentForm, readIntent, intentView, STATUS_LABEL, statusChip, visChip, teamPicker, bindTeamPicker };
})();
