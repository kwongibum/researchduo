/* =========================================================
   기능 1 · 연구 프로필 (profile.js)
   - 입력 → 미리보기 → 저장(RD.store.saveProfile)
   - 저장한 프로필은 ② 매칭의 '나에게 맞는 프로젝트'에서 사용돼요.
   ========================================================= */
(() => {
  const $ = s => document.querySelector(s);
  const clone = o => JSON.parse(JSON.stringify(o));
  RD.skillDatalist();

  const EMPTY = {
    id: 'me', name: '', school: '', dept: '', degree: '석사', semester: '',
    skills: [{ raw: '', tag: null, level: 2, evNote: '' }],
    interests: [], intro: '', goals: [], hours: [3, 6], mode: '블렌디드',
    available: true, types: [], reviews: [], completed: 0, liked: 0,
  };
  const SAMPLE = {
    id: 'me', name: '박지우', school: '○○대', dept: '교육학과', degree: '석사', semester: '2학기',
    skills: [
      { raw: '설문 설계', level: 3, evNote: '학회 발표 1' },
      { raw: 'SPSS', level: 2, evNote: '수업 프로젝트 1' },
      { raw: '인터뷰', level: 1, evNote: '' },
    ],
    interests: ['생성형 AI', '학습 효율', '대학 교육'],
    intro: '대학생의 생성형 AI 활용이 학습에 어떤 영향을 주는지 관심이 있어요.',
    goals: ['학회 발표', '연구 경험'], hours: [3, 6], mode: '블렌디드', available: true,
    types: ['공동 프로젝트', '아이디어 논의'], reviews: [], completed: 0, liked: 3,
  };

  let state = RD.store.getProfile() || clone(EMPTY);
  if (!state.skills || !state.skills.length) state.skills = clone(EMPTY.skills);

  /* 체크 목록 만들기 */
  const checks = (el, list, name) => {
    el.innerHTML = list.map(v => `<label><input type="checkbox" name="${name}" value="${RD.esc(v)}"> ${RD.esc(v)}</label>`).join('');
  };
  checks($('#goals'), GOALS, 'goal');
  checks($('#types'), COLLAB_TYPES, 'type');
  $('#mode').innerHTML = MODES.map(m => `<option>${m}</option>`).join('');

  /* 역량 입력 줄 */
  function drawSkills() {
    $('#skills').innerHTML = state.skills.map((s, i) => `
      <div class="sk-row" data-i="${i}">
        <input type="text" class="sk-raw" list="skill-list" placeholder="예) 통계 분석, SPSS" value="${RD.esc(s.raw || s.tag || '')}" aria-label="전문성">
        <select class="sk-lv" aria-label="숙련도">${[1, 2, 3].map(l => `<option value="${l}" ${+s.level === l ? 'selected' : ''}>${LEVELS[l]}</option>`).join('')}</select>
        <input type="text" class="ev" placeholder="예) 학회 발표 1" value="${RD.esc(s.evNote || '')}" aria-label="근거">
        <button type="button" class="sk-del" title="삭제" aria-label="삭제">×</button>
        <small class="hint hide"></small>
      </div>`).join('');
    updateHints();
  }

  function updateHints() {
    document.querySelectorAll('.sk-row').forEach(row => {
      const raw = row.querySelector('.sk-raw').value.trim();
      const h = row.querySelector('.hint');
      const n = normalizeSkill(raw);
      h.className = 'hint hide';
      if (!raw) return;
      if (!n.tag) { h.textContent = '목록에 없는 용어예요. 자동완성에서 고르면 매칭에 반영돼요.'; h.className = 'hint err'; }
      else if (n.via) { h.textContent = `‘${raw}’ → ‘${n.tag}’(으)로 인식했어요`; h.className = 'hint'; }
    });
  }

  /* 상태 → 입력칸 */
  function fill() {
    ['name', 'school', 'dept', 'semester', 'intro'].forEach(k => { $('#' + k).value = state[k] || ''; });
    $('#degree').value = state.degree || '석사';
    $('#interests').value = (state.interests || []).join(', ');
    $('#available').checked = state.available !== false;
    $('#hmin').value = state.hours[0];
    $('#hmax').value = state.hours[1];
    $('#mode').value = state.mode;
    document.querySelectorAll('[name=goal]').forEach(c => { c.checked = state.goals.includes(c.value); });
    document.querySelectorAll('[name=type]').forEach(c => { c.checked = state.types.includes(c.value); });
    drawSkills();
  }

  /* 입력칸 → 상태 */
  function collect() {
    ['name', 'school', 'dept', 'semester', 'intro'].forEach(k => { state[k] = $('#' + k).value.trim(); });
    state.degree = $('#degree').value;
    state.interests = $('#interests').value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
    state.available = $('#available').checked;
    const a = Math.max(1, +$('#hmin').value || 1), b = Math.max(1, +$('#hmax').value || 1);
    state.hours = [Math.min(a, b), Math.max(a, b)];
    state.mode = $('#mode').value;
    state.goals = [...document.querySelectorAll('[name=goal]:checked')].map(c => c.value);
    state.types = [...document.querySelectorAll('[name=type]:checked')].map(c => c.value);
    state.skills = [...document.querySelectorAll('.sk-row')].map(row => {
      const raw = row.querySelector('.sk-raw').value.trim();
      return { raw, tag: normalizeSkill(raw).tag, level: +row.querySelector('.sk-lv').value, evNote: row.querySelector('.ev').value.trim() };
    });
  }

  function preview() {
    $('#preview').innerHTML = RDProfileView.render(state, {
      banner: '미리보기',
      actions: '<span class="btn sm" aria-disabled="true">Coffee Chat</span><span class="btn pri sm" aria-disabled="true">협업 요청</span>',
    });
  }

  /* 이벤트 */
  $('#pf').addEventListener('input', () => { collect(); updateHints(); preview(); });
  $('#pf').addEventListener('change', () => { collect(); preview(); });
  $('#skills').addEventListener('click', e => {
    if (!e.target.classList.contains('sk-del')) return;
    collect();
    state.skills.splice(+e.target.closest('.sk-row').dataset.i, 1);
    if (!state.skills.length) state.skills = clone(EMPTY.skills);
    drawSkills(); preview();
  });
  $('#addSkill').onclick = () => {
    collect();
    state.skills.push({ raw: '', tag: null, level: 2, evNote: '' });
    drawSkills();
    document.querySelector('.sk-row:last-child .sk-raw').focus();
  };
  $('#sample').onclick = () => {
    state = clone(SAMPLE);
    state.skills.forEach(s => { s.tag = normalizeSkill(s.raw).tag; });
    fill(); preview();
  };
  $('#pf').addEventListener('submit', e => {
    e.preventDefault();
    collect();
    const err = $('#err');
    const problems = [];
    if (!state.name) problems.push('이름');
    if (!state.skills.some(s => s.tag)) problems.push('인식된 연구 역량 1개 이상');
    if (!state.goals.length) problems.push('목표 성과');
    if (problems.length) {
      err.textContent = `다음을 입력해 주세요: ${problems.join(', ')}`;
      err.classList.remove('hide');
      return;
    }
    err.classList.add('hide');
    RD.store.saveProfile(state);
    $('#savedBox').classList.remove('hide');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    RD.toast('프로필을 저장했어요');
  });

  fill();
  preview();
  if (RD.store.getProfile()) $('#savedBox').classList.remove('hide');
})();
