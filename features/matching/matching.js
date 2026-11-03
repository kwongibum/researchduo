/* =========================================================
   기능 2 · 프로젝트 개설·매칭 (matching.js)
   - 프로젝트 개설 → match.js 규칙으로 점수 계산 → 슬롯별 추천 목록
   - '협업 요청'을 누르면 RD.store.addRequest 로 ③ 모듈에 넘겨요.
   - 탭 B: 저장된 내 프로필(①)로 나에게 맞는 프로젝트 추천
   ========================================================= */
(() => {
  const $ = s => document.querySelector(s);
  const e = s => RD.esc(s);
  const clone = o => JSON.parse(JSON.stringify(o));
  RD.skillDatalist();

  const params = new URLSearchParams(location.search);
  const EMPTY = { title: '', summary: '', goal: '연구 경험', hours: [3, 6], mode: '온라인',
                  slots: [{ raw: '', tag: null, level: 2, role: ROLES[0] }] };

  let project = RD.store.getProject() || clone(EMPTY);
  let activeSlot = 0;
  let lastMatch = null;

  $('#goal').innerHTML = GOALS.map(g => `<option>${g}</option>`).join('');
  $('#mode').innerHTML = MODES.map(m => `<option>${m}</option>`).join('');

  /* ---------- 탭 ---------- */
  function showTab(t) {
    document.querySelectorAll('.mtab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    $('#tab-cast').classList.toggle('hide', t !== 'cast');
    $('#tab-forme').classList.toggle('hide', t !== 'forme');
    if (t === 'forme') drawForMe();
  }
  document.querySelectorAll('.mtab').forEach(b => { b.onclick = () => showTab(b.dataset.tab); });

  /* ---------- 시나리오 ---------- */
  $('#scenBtns').innerHTML = Object.entries(SCENARIOS)
    .map(([k, s]) => `<button type="button" class="btn sm" data-s="${k}">${e(s.label)} · ${e(s.persona.split(' · ')[0])}</button>`).join('');
  $('#scenBtns').onclick = ev => {
    const b = ev.target.closest('[data-s]');
    if (b) loadScenario(b.dataset.s);
  };
  function loadScenario(k) {
    const s = SCENARIOS[k];
    if (!s) return;
    project = clone(s.project);
    project.slots = project.slots.map(sl => ({ raw: sl.tag, tag: normalizeSkill(sl.tag).tag, level: sl.level, role: sl.role }));
    document.querySelectorAll('#scenBtns .btn').forEach(b => b.classList.toggle('on', b.dataset.s === String(k)));
    $('#scenCheck').innerHTML = `<b>${e(s.label)} · ${e(s.persona)}</b> — 확인할 점: ${e(s.check)}`;
    $('#scenCheck').classList.remove('hide');
    fill();
    run();
  }

  /* ---------- 슬롯 입력 ---------- */
  function drawSlots() {
    $('#slots').innerHTML = project.slots.map((s, i) => `
      <div class="slot" data-i="${i}">
        <div class="slot-top">자리 ${i + 1}${project.slots.length > 1 ? '<button type="button" class="slot-del" aria-label="삭제">×</button>' : ''}</div>
        <input type="text" class="sl-raw" list="skill-list" placeholder="필요한 전문성 (예: 통계 분석, SPSS)" value="${e(s.raw || s.tag || '')}">
        <small class="hint hide"></small>
        <div class="grid2">
          <select class="sl-lv" aria-label="요구 숙련도">${[1, 2, 3].map(l => `<option value="${l}" ${+s.level === l ? 'selected' : ''}>요구: ${LEVELS[l]} 이상</option>`).join('')}</select>
          <select class="sl-role" aria-label="역할">${ROLES.map(r => `<option ${s.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
        </div>
      </div>`).join('');
    updateHints();
  }
  function updateHints() {
    document.querySelectorAll('.slot').forEach(row => {
      const raw = row.querySelector('.sl-raw').value.trim();
      const h = row.querySelector('.hint');
      const n = normalizeSkill(raw);
      h.className = 'hint hide';
      if (!raw) return;
      if (!n.tag) { h.textContent = '목록에 없는 용어예요. 자동완성에서 골라 주세요.'; h.className = 'hint err'; }
      else if (n.via) { h.textContent = `‘${raw}’ → ‘${n.tag}’(으)로 인식했어요`; h.className = 'hint'; }
    });
  }

  function fill() {
    $('#title').value = project.title || '';
    $('#summary').value = project.summary || '';
    $('#goal').value = project.goal;
    $('#hmin').value = project.hours[0];
    $('#hmax').value = project.hours[1];
    $('#mode').value = project.mode;
    drawSlots();
  }
  function collect() {
    project.title = $('#title').value.trim();
    project.summary = $('#summary').value.trim();
    project.goal = $('#goal').value;
    const a = Math.max(1, +$('#hmin').value || 1), b = Math.max(1, +$('#hmax').value || 1);
    project.hours = [Math.min(a, b), Math.max(a, b)];
    project.mode = $('#mode').value;
    project.slots = [...document.querySelectorAll('.slot')].map(row => {
      const raw = row.querySelector('.sl-raw').value.trim();
      return { raw, tag: normalizeSkill(raw).tag, level: +row.querySelector('.sl-lv').value, role: row.querySelector('.sl-role').value };
    });
  }

  $('#pj').addEventListener('input', () => { collect(); updateHints(); });
  $('#slots').addEventListener('click', ev => {
    if (!ev.target.classList.contains('slot-del')) return;
    collect();
    project.slots.splice(+ev.target.closest('.slot').dataset.i, 1);
    drawSlots();
  });
  $('#addSlot').onclick = () => {
    collect();
    project.slots.push({ raw: '', tag: null, level: 2, role: ROLES[0] });
    drawSlots();
    document.querySelector('.slot:last-child .sl-raw').focus();
  };
  $('#pj').addEventListener('submit', ev => {
    ev.preventDefault();
    collect();
    run(true);
  });

  /* ---------- 매칭 실행 ---------- */
  function run(fromForm) {
    const err = $('#err');
    const valid = project.slots.filter(s => s.tag);
    const problems = [];
    if (!project.title) problems.push('연구 제목');
    if (!valid.length) problems.push('인식된 전문성 자리 1개 이상');
    if (problems.length) {
      err.textContent = `다음을 입력해 주세요: ${problems.join(', ')}`;
      err.classList.remove('hide');
      return;
    }
    err.classList.add('hide');
    RD.store.saveProject(project);
    lastMatch = matchProject({ ...project, slots: valid }, RESEARCHERS);
    if (activeSlot >= lastMatch.length) activeSlot = 0;
    drawResults();
    if (fromForm && window.innerWidth < 920) $('#results').scrollIntoView({ behavior: 'smooth' });
  }

  function bars(parts) {
    const items = [['전문성', 'expertise'], ['숙련·근거', 'level'], ['목표', 'goal'], ['조건', 'cond']];
    return `<div class="mc-bars">${items.map(([l, k]) => {
      const pct = WEIGHTS[k] ? Math.round((parts[k] / WEIGHTS[k]) * 100) : 0;
      return `<div><div class="mb-l"><span>${l}</span><b>${parts[k]}/${WEIGHTS[k]}</b></div><div class="mb-t"><i class="${pct < 50 ? 'low' : ''}" style="width:${pct}%"></i></div></div>`;
    }).join('')}</div>`;
  }

  function teamStatus(key) {
    const q = RD.store.getRequests().find(x => x.key === key);
    return q ? q.status : null;
  }

  function drawResults() {
    if (!lastMatch) return;
    const cur = lastMatch[activeSlot];
    const crit = `<details class="crit"><summary>매칭 기준 보기 (총 100점)</summary><table>
      <tr><td>전문성</td><td>${WEIGHTS.expertise}</td><td>필요한 전문성을 갖고 있는가. 같은 분야의 다른 전문성이면 ${Math.round(WEIGHTS.expertise * RELATED_RATIO)}점</td></tr>
      <tr><td>숙련도·근거</td><td>${WEIGHTS.level}</td><td>요구 숙련도 이상인가 + 논문·학회·프로젝트 근거가 있는가</td></tr>
      <tr><td>목표 성과</td><td>${WEIGHTS.goal}</td><td>학술지 투고·학회 발표·연구 경험 등 목표가 같은가</td></tr>
      <tr><td>협업 조건</td><td>${WEIGHTS.cond}</td><td>주당 시간이 겹치는가, 협업 방식이 맞는가</td></tr>
      </table><p class="mute" style="margin-top:6px">실제 서비스에서는 AI가 연구 계획서·실적을 읽고 판단하는 부분을, 프로토타입에서는 이 규칙으로 대신해요.</p></details>`;

    $('#results').innerHTML = `
      <div class="res-h">
        <div class="kick">매칭 결과</div>
        <h2>${e(project.title)}</h2>
        <div class="res-meta"><span class="chip b">목표 · ${e(project.goal)}</span><span class="chip">주 ${project.hours[0]}–${project.hours[1]}시간</span><span class="chip">${e(project.mode)}</span></div>
        ${crit}
      </div>
      <div class="stabs">${lastMatch.map((m, i) => `<button class="stab ${i === activeSlot ? 'on' : ''}" data-i="${i}">${e(m.slot.tag)}<small>${m.results.length}명</small></button>`).join('')}</div>
      <div class="slot-desc">자리 ${activeSlot + 1} · <b>${e(cur.slot.tag)}</b> (${LEVELS[cur.slot.level]} 이상) · 역할: ${e(cur.slot.role)}</div>
      ${cur.results.length ? cur.results.slice(0, 6).map((m, i) => card(m, i)).join('')
        : '<div class="empty"><b>이 전문성을 가진 연구자가 없어요</b>요구 숙련도를 낮추거나 다른 용어로 바꿔 보세요.</div>'}`;

    $('#results').querySelectorAll('.stab').forEach(b => { b.onclick = () => { activeSlot = +b.dataset.i; drawResults(); }; });
    $('#results').querySelectorAll('[data-view]').forEach(b => { b.onclick = () => viewProfile(b.dataset.view); });
    $('#results').querySelectorAll('[data-req]').forEach(b => { b.onclick = () => sendCast(b.dataset.req, b); });
  }

  function castKey(rid, slotTag) { return `cast:${project.title}:${slotTag}:${rid}`; }

  function card(m, i) {
    const r = m.r;
    const key = castKey(r.id, m.slot.tag);
    const st = teamStatus(key);
    const btn = st === 'group' ? '<button class="btn sm done" disabled>팀원</button>'
      : (st === 'rej' || st === 'end') ? '<button class="btn sm done" disabled>매칭 종료</button>'
      : st ? '<button class="btn sm done" disabled>요청함</button>'
      : m.available ? `<button class="btn pri sm" data-req="${r.id}">협업 요청</button>`
      : '<button class="btn sm" disabled>참여 어려움</button>';
    return `<div class="mc ${m.available ? '' : 'off'}">
      <div class="mc-top">
        <span class="mc-rank">${i + 1}</span>
        ${RD.avatar(r.name, r.id, 44)}
        <div class="mc-who"><b>${e(r.name)}</b>${m.type === 'exact' ? '<span class="chip g">정확히 일치</span>' : '<span class="chip">관련 분야</span>'}
          <div class="sub">${e(r.dept)} · ${e(r.degree)} ${e(r.semester)}</div></div>
        <div class="mc-score"><b>${m.total}</b><span>/100</span></div>
      </div>
      ${bars(m.parts)}
      <div class="mc-why"><ul class="ok">${m.reasons.map(x => `<li>${e(x)}</li>`).join('')}</ul><ul class="wn">${m.warns.map(x => `<li>${e(x)}</li>`).join('')}</ul></div>
      <div class="mc-act"><button class="btn sm" data-view="${r.id}">프로필 보기</button>${btn}</div>
    </div>`;
  }

  function viewProfile(rid) {
    const cur = lastMatch[activeSlot];
    const m = cur.results.find(x => x.r.id === rid);
    if (!m) return;
    const reason = `내 프로젝트의 <b>${e(cur.slot.tag)}</b> 자리 · ${m.total}점` + (m.warns.length ? ` · 확인 필요 ${m.warns.length}건` : '');
    const st = teamStatus(castKey(rid, cur.slot.tag));
    const act = m.available && !st ? `<button class="btn pri sm" id="mReq">협업 요청</button>` : '';
    const modal = RD.openModal(RDProfileView.render(m.r, { banner: '내 프로젝트와 매칭됨', reason, actions: act }));
    const b = modal.querySelector('#mReq');
    if (b) b.onclick = () => { sendCast(rid, b); RD.closeModal(); drawResults(); };
  }

  function sendCast(rid, btn) {
    const cur = lastMatch[activeSlot];
    const m = cur.results.find(x => x.r.id === rid);
    if (!m) return;
    const ok = RD.store.addRequest({
      key: castKey(rid, cur.slot.tag), dir: 'cast',
      who: { id: rid, name: m.r.name, dept: `${m.r.dept} ${m.r.degree}` },
      project: { id: 'mine', title: project.title },
      slot: { tag: cur.slot.tag, role: cur.slot.role },
      score: m.total,
    });
    if (ok) {
      RD.toast(`${m.r.name}님에게 협업 요청을 보냈어요 · ③에서 확인`);
      if (btn) { btn.textContent = '요청함'; btn.disabled = true; btn.className = 'btn sm done'; }
    } else RD.toast('이미 요청한 연구자예요');
  }

  /* ---------- 탭 B: 나에게 맞는 프로젝트 ---------- */
  function drawForMe() {
    const me = RD.store.getProfile();
    const box = $('#forme');
    if (!me || !(me.skills || []).some(s => s.tag)) {
      box.innerHTML = `<div class="empty"><b>먼저 내 연구 프로필이 필요해요</b>프로필의 역량·목표·협업 조건으로 맞는 프로젝트를 찾아드려요.<br>
        <a class="btn pri" href="../profile/profile.html">① 연구 프로필 만들기</a></div>`;
      return;
    }
    const meR = { ...me, skills: me.skills.filter(s => s.tag) };
    const list = matchProjectsFor(meR, PROJECTS);
    box.innerHTML = `
      <div class="me-bar">${RD.avatar(me.name, 'me', 40)}
        <div><b>${e(me.name)}</b>님의 프로필 기준
          <div class="sub">${meR.skills.map(s => e(s.tag)).join(' · ')} · 목표 ${e(me.goals.join('·'))} · 주 ${me.hours[0]}–${me.hours[1]}시간</div></div>
        <a class="btn sm" href="../profile/profile.html">프로필 수정</a></div>
      ${list.length ? list.map(m => {
        const key = `apply:${m.project.id}`;
        const done = RD.store.hasRequest(key);
        return `<div class="mc">
          <div class="mc-top">
            <div class="mc-who"><div class="pc-title">${e(m.project.title)}</div><div class="pc-owner">${e(m.project.owner)}</div></div>
            <div class="mc-score"><b>${m.total}</b><span>/100</span></div>
          </div>
          <div class="pc-sum">${e(m.project.summary)}</div>
          <div class="res-meta"><span class="chip b">맞는 자리 · ${e(m.slot.tag)} (${e(m.slot.role)})</span>${m.type === 'exact' ? '<span class="chip g">정확히 일치</span>' : '<span class="chip">관련 분야</span>'}<span class="chip">목표 · ${e(m.project.goal)}</span></div>
          ${bars(m.parts)}
          <div class="mc-why"><ul class="ok">${m.reasons.map(x => `<li>${e(x)}</li>`).join('')}</ul><ul class="wn">${m.warns.map(x => `<li>${e(x)}</li>`).join('')}</ul></div>
          <div class="mc-act">${done ? '<button class="btn sm done" disabled>요청함</button>' : `<button class="btn grn sm" data-apply="${m.project.id}">참여 요청</button>`}</div>
        </div>`;
      }).join('') : '<div class="empty"><b>맞는 프로젝트가 없어요</b>역량을 더 추가하거나 다른 용어로 적어 보세요.</div>'}`;

    box.querySelectorAll('[data-apply]').forEach(b => {
      b.onclick = () => {
        const m = list.find(x => x.project.id === b.dataset.apply);
        const [oname, ...rest] = m.project.owner.split(' · ');
        RD.store.addRequest({
          key: `apply:${m.project.id}`, dir: 'apply',
          who: { id: m.project.id, name: oname, dept: rest.join(' · ') },
          project: { id: m.project.id, title: m.project.title },
          slot: { tag: m.slot.tag, role: m.slot.role }, score: m.total,
        });
        RD.toast('참여 요청을 보냈어요 · ③에서 확인');
        b.textContent = '요청함'; b.disabled = true; b.className = 'btn sm done';
      };
    });
  }

  /* ---------- 시작 ---------- */
  fill();
  if (params.get('s')) loadScenario(params.get('s'));
  else if (params.get('add')) {
    collect();
    project.slots.push({ raw: '', tag: null, level: 2, role: ROLES[0] });
    drawSlots();
    $('#addNotice').classList.remove('hide');
    if (project.title) run();
    setTimeout(() => {
      $('#slotsField').scrollIntoView({ behavior: 'smooth', block: 'center' });
      const last = document.querySelector('.slot:last-child .sl-raw');
      if (last) last.focus();
    }, 150);
  } else if (RD.store.getProject()) run();
  if (params.get('tab') === 'forme') showTab('forme');
})();
