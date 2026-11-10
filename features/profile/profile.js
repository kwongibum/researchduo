/* =========================================================
   기능 1 · 연구 프로필 (profile.js)
   - 로그인한 사람의 프로필을 시트에서 불러와 입력칸에 채우고
   - 저장하면 RD.api('saveProfile') 로 시트에 올려요 → 모든 팀원에게 보임
   - '전체 연구자' 탭: 시트에 저장된 모든 프로필
   ========================================================= */
(() => {
  const me = RD.requireLogin();
  if (!me) return;
  const $ = s => document.querySelector(s);
  const e = s => RD.esc(s);
  const clone = o => JSON.parse(JSON.stringify(o));
  RD.skillDatalist();

  const EMPTY = {
    school: '', dept: '', field: '사회', degree: '학부', semester: '', intro: '',
    topics: [], keywords: [],
    skills: [{ raw: '', tag: null, level: 2, evNote: '' }], needs: [''],
    exp: { papers: 0, talks: 0, projects: 0 }, expNote: '',
    deptPref: '다른 계열과 융합', goals: [],
    hours: [3, 6], mode: '블렌디드', available: true, types: [],
  };
  let state = clone(EMPTY);
  let all = [];

  /* ---------- 선택지 만들기 ---------- */
  const checks = (el, list, name, type = 'checkbox') => {
    el.innerHTML = list.map(v => `<label><input type="${type}" name="${name}" value="${e(v)}"> ${e(v)}</label>`).join('');
  };
  checks($('#topics'), TOPICS, 'topic');
  checks($('#goals'), GOALS, 'goal');
  checks($('#types'), COLLAB_TYPES, 'type');
  checks($('#deptPref'), DEPT_PREFS, 'deptPref', 'radio');
  $('#degree').innerHTML = DEGREES.map(m => `<option>${m}</option>`).join('');
  $('#field').innerHTML = FIELDS.map(m => `<option>${m}</option>`).join('');
  $('#mode').innerHTML = MODES.map(m => `<option>${m}</option>`).join('');
  $('#name').value = me.name;

  /* ---------- 탭 ---------- */
  document.querySelectorAll('.mtab').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.mtab').forEach(x => x.classList.toggle('on', x === b));
      $('#tab-mine').classList.toggle('hide', b.dataset.tab !== 'mine');
      $('#tab-all').classList.toggle('hide', b.dataset.tab !== 'all');
    };
  });

  /* ---------- 역량 / 필요한 역량 입력 줄 ---------- */
  function drawSkills() {
    $('#skills').innerHTML = state.skills.map((s, i) => `
      <div class="sk-row" data-i="${i}">
        <input type="text" class="sk-raw" list="skill-list" placeholder="예) 통계 분석, SPSS" value="${e(s.raw || s.tag || '')}" aria-label="역량">
        <select class="sk-lv" aria-label="숙련도">${[1, 2, 3].map(l => `<option value="${l}" ${+s.level === l ? 'selected' : ''}>${LEVELS[l]}</option>`).join('')}</select>
        <input type="text" class="ev" placeholder="예) 학회 발표 1" value="${e(s.evNote || '')}" aria-label="근거">
        <button type="button" class="sk-del" data-k="skills" aria-label="삭제">×</button>
        <small class="hint hide"></small>
      </div>`).join('');
    $('#needs').innerHTML = state.needs.map((n, i) => `
      <div class="nd-row" data-i="${i}">
        <input type="text" class="nd-raw" list="skill-list" placeholder="예) 질적 연구, 데이터 시각화" value="${e(n)}" aria-label="필요한 역량">
        <button type="button" class="sk-del" data-k="needs" aria-label="삭제">×</button>
        <small class="hint hide"></small>
      </div>`).join('');
    updateHints();
  }
  function updateHints() {
    document.querySelectorAll('.sk-row, .nd-row').forEach(row => {
      const raw = row.querySelector('input').value.trim();
      const h = row.querySelector('.hint');
      const n = normalizeSkill(raw);
      h.className = 'hint hide';
      if (!raw) return;
      if (!n.tag) { h.textContent = '목록에 없는 용어예요. 자동완성에서 고르면 매칭에 반영돼요.'; h.className = 'hint err'; }
      else if (n.via) { h.textContent = `‘${raw}’ → ‘${n.tag}’(으)로 인식했어요`; h.className = 'hint'; }
    });
  }

  /* ---------- 상태 ↔ 입력칸 ---------- */
  function fill() {
    ['school', 'dept', 'semester', 'intro', 'expNote'].forEach(k => { $('#' + k).value = state[k] || ''; });
    $('#degree').value = state.degree || '학부';
    $('#field').value = state.field || '사회';
    $('#mode').value = state.mode || '블렌디드';
    $('#keywords').value = (state.keywords || []).join(', ');
    $('#available').checked = state.available !== false;
    $('#hmin').value = (state.hours || [3, 6])[0];
    $('#hmax').value = (state.hours || [3, 6])[1];
    const x = state.exp || {};
    $('#papers').value = +x.papers || 0; $('#talks').value = +x.talks || 0; $('#projects').value = +x.projects || 0;
    const setChecks = (name, list) => document.querySelectorAll(`[name=${name}]`).forEach(c => { c.checked = (list || []).includes(c.value); });
    setChecks('topic', state.topics); setChecks('goal', state.goals); setChecks('type', state.types);
    setChecks('deptPref', [state.deptPref]);
    if (!state.skills || !state.skills.length) state.skills = clone(EMPTY.skills);
    state.needs = (state.needs && state.needs.length) ? state.needs : [''];
    drawSkills();
  }
  function collect() {
    ['school', 'dept', 'semester', 'intro', 'expNote'].forEach(k => { state[k] = $('#' + k).value.trim(); });
    state.degree = $('#degree').value;
    state.field = $('#field').value;
    state.mode = $('#mode').value;
    state.keywords = $('#keywords').value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8);
    state.available = $('#available').checked;
    const a = Math.max(1, +$('#hmin').value || 1), b = Math.max(1, +$('#hmax').value || 1);
    state.hours = [Math.min(a, b), Math.max(a, b)];
    state.exp = { papers: Math.max(0, +$('#papers').value || 0), talks: Math.max(0, +$('#talks').value || 0), projects: Math.max(0, +$('#projects').value || 0) };
    const getChecks = name => [...document.querySelectorAll(`[name=${name}]:checked`)].map(c => c.value);
    state.topics = getChecks('topic');
    state.goals = getChecks('goal');
    state.types = getChecks('type');
    state.deptPref = getChecks('deptPref')[0] || '상관없음';
    state.skills = [...document.querySelectorAll('.sk-row')].map(row => {
      const raw = row.querySelector('.sk-raw').value.trim();
      return { raw, tag: normalizeSkill(raw).tag, level: +row.querySelector('.sk-lv').value, evNote: row.querySelector('.ev').value.trim() };
    });
    state.needs = [...document.querySelectorAll('.nd-raw')].map(i => i.value.trim());
  }

  /* 저장할 때: 인식된 역량만 남기고, 필요한 역량은 목록 이름으로 바꿔 저장 */
  function toSave() {
    const p = clone(state);
    p.skills = p.skills.filter(s => s.raw);
    p.needs = [...new Set(p.needs.map(n => normalizeSkill(n).tag || n).filter(Boolean))];
    return p;
  }

  function preview() {
    $('#preview').innerHTML = RDProfileView.render({ ...toSave(), name: me.name, userId: me.id }, {
      banner: '미리보기',
      actions: '<span class="btn pri sm" aria-disabled="true">협업 요청</span>',
    });
  }

  function drawAll() {
    $('#allCount').textContent = all.length ? `${all.length}명` : '';
    $('#allList').innerHTML = all.length
      ? all.map(p => RDProfileView.mini(p, { right: p.userId === me.id ? '<span class="me-tag">나</span>' : '' })).join('')
      : '<div class="empty"><b>아직 저장된 프로필이 없어요</b>첫 번째로 프로필을 저장해 보세요.</div>';
    $('#allList').querySelectorAll('.pm').forEach(el => {
      el.onclick = () => {
        const p = all.find(x => x.userId === el.dataset.uid);
        if (p) RD.openModal(RDProfileView.render(p, { banner: p.userId === me.id ? '내 프로필' : '' }));
      };
    });
  }

  /* ---------- 이벤트 ---------- */
  $('#pf').addEventListener('input', () => { collect(); updateHints(); preview(); });
  $('#pf').addEventListener('change', e2 => {
    // 관심 주제는 최대 3개
    if (e2.target.name === 'topic' && document.querySelectorAll('[name=topic]:checked').length > 3) {
      e2.target.checked = false; RD.toast('관심 주제는 최대 3개까지 고를 수 있어요');
    }
    collect(); preview();
  });
  $('#pf').addEventListener('click', ev => {
    const b = ev.target.closest('.sk-del');
    if (!b) return;
    collect();
    const k = b.dataset.k;
    state[k].splice(+b.closest('[data-i]').dataset.i, 1);
    if (!state[k].length) state[k] = k === 'skills' ? clone(EMPTY.skills) : [''];
    drawSkills(); preview();
  });
  $('#addSkill').onclick = () => { collect(); state.skills.push({ raw: '', tag: null, level: 2, evNote: '' }); drawSkills(); document.querySelector('.sk-row:last-child .sk-raw').focus(); };
  $('#addNeed').onclick = () => { collect(); state.needs.push(''); drawSkills(); document.querySelector('.nd-row:last-child .nd-raw').focus(); };

  $('#pf').addEventListener('submit', async ev => {
    ev.preventDefault();
    collect();
    const err = $('#err');
    const p = toSave();
    const problems = [];
    if (!p.dept) problems.push('학과');
    if (!p.topics.length) problems.push('① 관심 주제 1개 이상');
    if (!p.skills.some(s => s.tag)) problems.push('② 인식된 역량 1개 이상');
    if (!p.goals.length) problems.push('⑤ 목표 성과');
    if (problems.length) { err.textContent = `다음을 입력해 주세요: ${problems.join(', ')}`; err.classList.remove('hide'); return; }
    err.classList.add('hide');
    const btn = $('#saveBtn');
    btn.classList.add('busy'); btn.textContent = '저장 중…';
    try {
      await RD.api('saveProfile', { profile: p });
      RD.toast('저장했어요. 이제 모든 팀원에게 보여요');
      $('#savedBox').classList.remove('hide');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await loadAll();
    } catch (ex) {
      err.textContent = ex.message; err.classList.remove('hide');
    } finally {
      btn.classList.remove('busy'); btn.textContent = '프로필 저장';
    }
  });

  /* ---------- 시작: 시트에서 불러오기 ---------- */
  async function loadAll() {
    const { profiles } = await RD.api('listProfiles');
    all = profiles.sort((a, b) => (a.userId === me.id ? -1 : b.userId === me.id ? 1 : 0));
    const mine = all.find(p => p.userId === me.id);
    if (mine) $('#lastSaved').textContent = `마지막 저장 ${mine.updated}`;
    drawAll();
    return mine;
  }

  fill(); preview();
  RD.loading($('#allList'));
  const saveBtn = $('#saveBtn');
  saveBtn.classList.add('busy'); saveBtn.textContent = '불러오는 중…';
  loadAll().then(mine => {
    if (mine) {
      state = Object.assign(clone(EMPTY), mine);
      fill(); preview();
      $('#savedBox').classList.remove('hide');
    }
  }).catch(ex => {
    RD.errorBox($('#allList'), ex);
    $('#err').textContent = ex.message; $('#err').classList.remove('hide');
  }).finally(() => { saveBtn.classList.remove('busy'); saveBtn.textContent = '프로필 저장'; });
})();
