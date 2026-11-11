/* =========================================================
   기능 2 · 프로젝트 개설·매칭 (project.js)
   - 내 프로젝트: 개설·수정·삭제 → 시트 '프로젝트' 탭 (RD.api('saveProject'))
   - 프로젝트 → 연구자 추천: 프로젝트를 '찾는 사람'으로 바꿔서 같은 6개 카테고리로 비교
       ① 주제·키워드, ② 필요한 자리, ⑤ 목표, ⑥ 시간·방식 = 프로젝트 값
       ③ 경험·④ 학과·전공 = 개설자 프로필 값
   - 열린 프로젝트: 다른 팀원의 프로젝트에 내가 얼마나 맞는지 → 참여 요청
   ========================================================= */
(() => {
  const me = RD.requireLogin();
  if (!me) return;
  const $ = s => document.querySelector(s);
  const e = s => RD.esc(s);
  const clone = o => JSON.parse(JSON.stringify(o));
  RD.skillDatalist();

  const EMPTY = { id: null, title: '', summary: '', topics: [], keywords: [], goals: [], hours: [3, 6], mode: '블렌디드',
                  slots: [{ raw: '', tag: null, level: 2, role: ROLES[0] }] };
  let draft = clone(EMPTY);
  let projects = [], profiles = [], requests = [];
  let myProfile = null;

  /* ---------- 선택지 ---------- */
  const checks = (el, list, name) => { el.innerHTML = list.map(v => `<label><input type="checkbox" name="${name}" value="${e(v)}"> ${e(v)}</label>`).join(''); };
  checks($('#topics'), TOPICS, 'ptopic');
  checks($('#goals'), GOALS, 'pgoal');
  $('#mode').innerHTML = MODES.map(m => `<option>${m}</option>`).join('');

  /* ---------- 탭 ---------- */
  function showTab(t) {
    document.querySelectorAll('.mtab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    $('#tab-mine').classList.toggle('hide', t !== 'mine');
    $('#tab-open').classList.toggle('hide', t !== 'open');
  }
  document.querySelectorAll('.mtab').forEach(b => { b.onclick = () => showTab(b.dataset.tab); });

  /* ---------- 프로젝트 → '찾는 사람' 모양으로 바꾸기 ---------- */
  function seekerOf(p) {
    const o = profiles.find(x => x.userId === p.ownerId) || {};
    return {
      userId: p.ownerId, name: p.ownerName,
      topics: p.topics || [], keywords: p.keywords || [],
      needs: (p.slots || []).map(s => s.tag).filter(Boolean),
      skills: o.skills || [], exp: o.exp, dept: o.dept, field: o.field, deptPref: o.deptPref || '상관없음',
      goals: p.goals || [], hours: p.hours || o.hours, mode: p.mode || o.mode, available: true,
    };
  }

  /* 자리별로 이 사람이 채울 수 있는지 (요구 숙련도 비교) */
  function slotFits(p, person) {
    const skills = (person.skills || []).filter(s => s.tag);
    return (p.slots || []).filter(s => s.tag).map(s => {
      const ex = skills.find(k => k.tag === s.tag);
      if (ex) return { s, cls: ex.level >= s.level ? 'ok' : 'low', text: `${s.tag} ${LEVELS[ex.level]}${ex.level >= s.level ? ' ✓' : ` (요구 ${LEVELS[s.level]})`}` };
      const cat = SKILLS[s.tag] && SKILLS[s.tag].cat;
      const rel = cat && skills.find(k => SKILLS[k.tag] && SKILLS[k.tag].cat === cat);
      if (rel) return { s, cls: 'rel', text: `${s.tag} ← 비슷한 ${rel.tag}` };
      return { s, cls: '', text: `${s.tag} 없음` };
    });
  }

  /* 카테고리 문구를 상황에 맞게 바꾸기 */
  function reword(text, view) {
    if (view === 'recs') return text.replace(/내가 필요한/g, '프로젝트에 필요한').replace(/내 선호/g, '내 협업 선호');
    return text.replace(/내가 필요한/g, '프로젝트에 필요한').replace(/상대가 필요한/g, '내가 필요한')
      .replace(/내 선호/g, '개설자 선호').replace(/\(상대 /g, '(나 ').replace(/나 (\d+)–(\d+) \/ 상대/g, '프로젝트 $1–$2 / 나');
  }

  function bars(parts) {
    return `<div class="mc-bars">${parts.map(p => `
      <div><div class="mb-l"><span>${p.no} ${e(p.label)}</span><b>${p.score}</b></div>
      <div class="mb-t"><i class="${p.score < 50 ? 'low' : ''}" style="width:${p.score}%"></i></div></div>`).join('')}</div>`;
  }
  function why(parts, view) {
    const good = parts.flatMap(p => p.good.map(g => `<li><i>${p.no}</i>${e(reword(g, view))}</li>`));
    const warn = parts.flatMap(p => p.warn.map(w => `<li><i>${p.no}</i>${e(reword(w, view))}</li>`));
    return `<div class="mc-why"><ul class="ok">${good.join('')}</ul><ul class="wn">${warn.join('')}</ul></div>`;
  }
  function reqFor(projectTitle, a, b) {
    return requests.find(r => String(r.projectTitle || '') === String(projectTitle || '')
      && ((r.fromId === a && r.toId === b) || (r.fromId === b && r.toId === a)));
  }
  const ST = { req: '요청 중', acc: '수락됨', chat: '커피챗 예정', group: '같은 그룹', rej: '거절됨', end: '종료됨' };

  /* ---------- 내 프로젝트 목록 ---------- */
  function drawList() {
    const mine = projects.filter(p => p.ownerId === me.id);
    $('#mineCount').textContent = mine.length ? `${mine.length}개` : '';
    $('#plist').innerHTML = mine.map(p => `<button class="pchip ${draft.id === p.id ? 'on' : ''}" data-id="${e(p.id)}">${e(p.title)}<small>${e((p.slots || []).map(s => s.tag).filter(Boolean).join(' · '))}</small></button>`).join('')
      + `<button class="pchip new" id="newChip">+ 새 프로젝트</button>`;
    $('#plist').querySelectorAll('[data-id]').forEach(b => { b.onclick = () => edit(b.dataset.id); });
    $('#newChip').onclick = newProject;
  }

  /* ---------- 입력 폼 ---------- */
  function drawSlots() {
    $('#slots').innerHTML = draft.slots.map((s, i) => `
      <div class="slot" data-i="${i}">
        <div class="slot-top">자리 ${i + 1}${draft.slots.length > 1 ? '<button type="button" class="slot-del" aria-label="삭제">×</button>' : ''}</div>
        <input type="text" class="sl-raw" list="skill-list" placeholder="필요한 전문성 (예: 통계 분석, SPSS)" value="${e(s.raw || s.tag || '')}">
        <small class="hint hide"></small>
        <div class="grid2">
          <select class="sl-lv" aria-label="요구 숙련도">${[1, 2, 3].map(l => `<option value="${l}" ${+s.level === l ? 'selected' : ''}>요구: ${LEVELS[l]} 이상</option>`).join('')}</select>
          <select class="sl-role" aria-label="역할">${ROLES.map(r => `<option ${s.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
        </div>
      </div>`).join('');
    hints();
  }
  function hints() {
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
    $('#formTitle').textContent = draft.id ? '프로젝트 수정' : '새 프로젝트 개설';
    $('#delBtn').classList.toggle('hide', !draft.id);
    $('#title').value = draft.title || '';
    $('#summary').value = draft.summary || '';
    $('#keywords').value = (draft.keywords || []).join(', ');
    $('#hmin').value = draft.hours[0]; $('#hmax').value = draft.hours[1];
    $('#mode').value = draft.mode;
    document.querySelectorAll('[name=ptopic]').forEach(c => { c.checked = (draft.topics || []).includes(c.value); });
    document.querySelectorAll('[name=pgoal]').forEach(c => { c.checked = (draft.goals || []).includes(c.value); });
    if (!draft.slots || !draft.slots.length) draft.slots = clone(EMPTY.slots);
    drawSlots();
  }
  function collect() {
    draft.title = $('#title').value.trim();
    draft.summary = $('#summary').value.trim();
    draft.keywords = $('#keywords').value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8);
    const a = Math.max(1, +$('#hmin').value || 1), b = Math.max(1, +$('#hmax').value || 1);
    draft.hours = [Math.min(a, b), Math.max(a, b)];
    draft.mode = $('#mode').value;
    draft.topics = [...document.querySelectorAll('[name=ptopic]:checked')].map(c => c.value);
    draft.goals = [...document.querySelectorAll('[name=pgoal]:checked')].map(c => c.value);
    draft.slots = [...document.querySelectorAll('.slot')].map(row => {
      const raw = row.querySelector('.sl-raw').value.trim();
      return { raw, tag: normalizeSkill(raw).tag, level: +row.querySelector('.sl-lv').value, role: row.querySelector('.sl-role').value };
    });
  }

  $('#pj').addEventListener('input', () => { collect(); hints(); });
  $('#pj').addEventListener('change', ev => {
    if (ev.target.name === 'ptopic' && document.querySelectorAll('[name=ptopic]:checked').length > 3) {
      ev.target.checked = false; RD.toast('연구 주제는 최대 3개까지 고를 수 있어요');
    }
  });
  $('#slots').addEventListener('click', ev => {
    if (!ev.target.classList.contains('slot-del')) return;
    collect(); draft.slots.splice(+ev.target.closest('.slot').dataset.i, 1); drawSlots();
  });
  $('#addSlot').onclick = () => { collect(); draft.slots.push({ raw: '', tag: null, level: 2, role: ROLES[0] }); drawSlots(); document.querySelector('.slot:last-child .sl-raw').focus(); };
  $('#newBtn').onclick = newProject;

  function newProject() {
    draft = clone(EMPTY);
    if (myProfile) { draft.hours = myProfile.hours || draft.hours; draft.mode = myProfile.mode || draft.mode; draft.goals = (myProfile.goals || []).slice(); }
    fill(); drawList();
    $('#recs').innerHTML = '<div class="empty"><b>프로젝트를 저장하면 추천 연구자가 나와요</b>제목, 연구 주제, 필요한 전문성 자리를 입력해 주세요.</div>';
    $('#title').focus();
  }
  function edit(id) {
    const p = projects.find(x => x.id === id);
    if (!p) return;
    draft = Object.assign(clone(EMPTY), clone(p));
    fill(); drawList(); drawRecs();
  }

  $('#pj').addEventListener('submit', async ev => {
    ev.preventDefault();
    collect();
    const err = $('#err');
    const p = { ...draft, slots: draft.slots.filter(s => s.tag) };
    const problems = [];
    if (!p.title) problems.push('연구 제목');
    if (!p.topics.length) problems.push('연구 주제 1개 이상');
    if (!p.slots.length) problems.push('인식된 전문성 자리 1개 이상');
    if (!p.goals.length) problems.push('목표 성과');
    if (problems.length) { err.textContent = `다음을 입력해 주세요: ${problems.join(', ')}`; err.classList.remove('hide'); return; }
    err.classList.add('hide');
    const btn = $('#saveBtn');
    btn.classList.add('busy'); btn.textContent = '저장 중…';
    try {
      const r = await RD.api('saveProject', { project: p });
      RD.toast('프로젝트를 저장했어요. 모든 팀원에게 보여요');
      await load(true);
      edit(r.id);
    } catch (ex) {
      err.textContent = ex.message; err.classList.remove('hide');
    } finally {
      btn.classList.remove('busy'); btn.textContent = '저장하고 추천받기';
    }
  });

  $('#delBtn').onclick = async () => {
    if (!draft.id || !window.confirm('이 프로젝트를 삭제할까요? 다른 팀원에게도 더 이상 보이지 않아요.')) return;
    try {
      await RD.api('deleteProject', { id: draft.id });
      RD.toast('삭제했어요');
      await load(true);
      newProject();
    } catch (ex) { RD.toast(ex.message); }
  };

  /* ---------- 프로젝트 → 연구자 추천 ---------- */
  let recRanked = [];
  function drawRecs() {
    const p = projects.find(x => x.id === draft.id);
    if (!p) return;
    const seeker = seekerOf(p);
    recRanked = RDMatch.rank(seeker, profiles);
    $('#recs').innerHTML = `
      <div class="res-h">
        <div class="kick">추천 연구자</div>
        <h2>${e(p.title)}</h2>
        ${p.summary ? `<p>${e(p.summary)}</p>` : ''}
        <div class="res-meta">${(p.topics || []).map(t => `<span class="chip b">${e(t)}</span>`).join('')}
          ${(p.slots || []).map(s => `<span class="chip">${e(s.tag)} · ${LEVELS[s.level]}↑ · ${e(s.role)}</span>`).join('')}</div>
      </div>
      ${recRanked.length ? recRanked.map((m, i) => recCard(p, m, i)).join('')
        : '<div class="empty"><b>아직 비교할 다른 연구자가 없어요</b>팀원들이 프로필을 저장하면 여기에 나타나요.</div>'}`;
    $('#recs').querySelectorAll('[data-view]').forEach(b => { b.onclick = () => viewPerson(b.dataset.view); });
    $('#recs').querySelectorAll('[data-cast]').forEach(b => { b.onclick = () => castModal(p, b.dataset.cast); });
  }
  function recCard(p, m, i) {
    const o = m.other;
    const q = reqFor(p.title, me.id, o.userId);
    const btn = q ? `<button class="btn sm done" disabled>${ST[q.status] || '요청함'}</button>`
      : m.available ? `<button class="btn pri sm" data-cast="${e(o.userId)}">이 프로젝트에 초대</button>`
      : '<button class="btn sm" disabled>참여 어려움</button>';
    return `<div class="mc ${m.available ? '' : 'off'}">
      <div class="mc-top"><span class="mc-rank">${i + 1}</span>${RD.avatar(o.name, o.userId, 44)}
        <div class="mc-who"><b>${e(o.name)}</b><div class="sub">${e([o.dept, o.degree, o.semester].filter(Boolean).join(' · '))}</div></div>
        <div class="mc-score"><b>${m.total}</b><span>/100</span></div></div>
      <div class="fits">${slotFits(p, o).map(f => `<span class="fit ${f.cls}">자리 · ${e(f.text)}</span>`).join('')}</div>
      ${bars(m.parts)}${why(m.parts, 'recs')}
      <div class="mc-act"><button class="btn sm" data-view="${e(o.userId)}">프로필 보기</button>${btn}</div>
    </div>`;
  }
  function viewPerson(uid) {
    const o = profiles.find(x => x.userId === uid);
    if (o) RD.openModal(RDProfileView.render(o));
  }
  function castModal(p, uid) {
    const m = recRanked.find(x => x.other.userId === uid);
    if (!m) return;
    const o = m.other;
    const fits = slotFits(p, o);
    const best = (fits.find(f => f.cls === 'ok') || fits.find(f => f.cls === 'rel') || fits[0] || {}).s;
    const modal = RD.openModal(`<h3 class="m-title">${e(o.name)}님을 프로젝트에 초대</h3>
      <p class="m-sub">‘${e(p.title)}’ · 매칭 ${m.total}점. 요청은 ${e(o.name)}님의 ③ 받은 요청함에 도착해요.</p>
      <div class="field"><label>어떤 자리를 부탁하나요?</label><select id="qSlot">${(p.slots || []).map((s, i) => `<option value="${i}" ${best === s ? 'selected' : ''}>${e(s.tag)} · ${e(s.role)}</option>`).join('')}</select></div>
      <div class="field"><label>메시지</label><textarea id="qMsg" rows="3" placeholder="예) 설문 데이터 분석 자리를 부탁드리고 싶어요. 30분 커피챗 가능할까요?"></textarea></div>
      <p class="hint err hide" id="qErr"></p>
      <div class="row-end"><span></span><button class="btn pri" id="qSend">초대 보내기</button></div>`);
    modal.querySelector('#qSend').onclick = async ev => {
      const msg = modal.querySelector('#qMsg').value.trim();
      const er = modal.querySelector('#qErr');
      if (!msg) { er.textContent = '메시지를 적어 주세요'; er.classList.remove('hide'); return; }
      const s = p.slots[+modal.querySelector('#qSlot').value];
      ev.target.classList.add('busy'); ev.target.textContent = '보내는 중…';
      try {
        await RD.api('createRequest', { request: { kind: 'cast', toId: o.userId, toName: o.name, projectId: p.id, projectTitle: p.title,
          role: `${s.tag} · ${s.role}`, message: msg, score: m.total } });
        RD.closeModal(); RD.toast(`${o.name}님에게 초대를 보냈어요`);
        await load(true); drawRecs();
      } catch (ex) { er.textContent = ex.message; er.classList.remove('hide'); ev.target.classList.remove('busy'); ev.target.textContent = '초대 보내기'; }
    };
  }

  /* ---------- 열린 프로젝트: 다른 팀원의 프로젝트에 내가 맞는지 ---------- */
  function drawOpen() {
    const others = projects.filter(p => p.ownerId !== me.id);
    $('#openCount').textContent = others.length ? `${others.length}개` : '';
    const box = $('#openList');
    if (!others.length) { box.innerHTML = '<div class="empty"><b>아직 다른 팀원이 연 프로젝트가 없어요</b>팀원이 프로젝트를 개설하면 여기에 나타나요.</div>'; return; }
    if (!myProfile) { box.innerHTML = `<div class="empty"><b>먼저 내 연구 프로필이 필요해요</b>내 프로필과 비교해서 맞는 프로젝트를 보여드려요.<br><a class="btn pri" href="../profile/profile.html">① 연구 프로필 만들기</a></div>`; return; }
    const list = others.map(p => ({ p, m: RDMatch.compare(seekerOf(p), myProfile) })).sort((a, b) => b.m.total - a.m.total);
    box.innerHTML = list.map(({ p, m }) => {
      const topic = m.parts.find(x => x.key === 'topic');
      const q = reqFor(p.title, me.id, p.ownerId);
      const btn = q ? `<button class="btn sm done" disabled>${ST[q.status] || '요청함'}</button>`
        : `<button class="btn grn sm" data-apply="${e(p.id)}">참여 요청</button>`;
      return `<div class="mc">
        <div class="mc-top">${RD.avatar(p.ownerName, p.ownerId, 44)}
          <div class="mc-who"><b>${e(p.title)}</b>${topic && topic.score >= 50 ? '<span class="simtag">비슷한 주제</span>' : ''}
            <div class="pc-owner">개설자 ${e(p.ownerName)} · ${e(p.updated || '')}</div></div>
          <div class="mc-score"><b>${m.total}</b><span>/100</span></div></div>
        ${p.summary ? `<div class="pc-sum">${e(p.summary)}</div>` : ''}
        <div class="fits">${slotFits(p, myProfile).map(f => `<span class="fit ${f.cls}">자리 · ${e(f.text)}</span>`).join('')}</div>
        ${bars(m.parts)}${why(m.parts, 'open')}
        <div class="mc-act"><button class="btn sm" data-owner="${e(p.ownerId)}">개설자 프로필</button>${btn}</div>
      </div>`;
    }).join('');
    box.querySelectorAll('[data-owner]').forEach(b => { b.onclick = () => viewPerson(b.dataset.owner); });
    box.querySelectorAll('[data-apply]').forEach(b => { b.onclick = () => applyModal(list.find(x => x.p.id === b.dataset.apply)); });
  }
  function applyModal({ p, m }) {
    const fits = slotFits(p, myProfile);
    const best = (fits.find(f => f.cls === 'ok') || fits.find(f => f.cls === 'rel') || fits[0] || {}).s;
    const modal = RD.openModal(`<h3 class="m-title">‘${e(p.title)}’에 참여 요청</h3>
      <p class="m-sub">개설자 ${e(p.ownerName)}님의 ③ 받은 요청함에 도착해요. 나와의 매칭 ${m.total}점</p>
      <div class="field"><label>어떤 자리로 참여하고 싶나요?</label><select id="aSlot">${(p.slots || []).map((s, i) => `<option value="${i}" ${best === s ? 'selected' : ''}>${e(s.tag)} · ${e(s.role)}</option>`).join('')}</select></div>
      <div class="field"><label>메시지</label><textarea id="aMsg" rows="3" placeholder="예) 통계 분석을 해본 경험이 있어요. 참여하고 싶어요!"></textarea></div>
      <p class="hint err hide" id="aErr"></p>
      <div class="row-end"><span></span><button class="btn grn" id="aSend">참여 요청 보내기</button></div>`);
    modal.querySelector('#aSend').onclick = async ev => {
      const msg = modal.querySelector('#aMsg').value.trim();
      const er = modal.querySelector('#aErr');
      if (!msg) { er.textContent = '메시지를 적어 주세요'; er.classList.remove('hide'); return; }
      const s = p.slots[+modal.querySelector('#aSlot').value];
      ev.target.classList.add('busy'); ev.target.textContent = '보내는 중…';
      try {
        await RD.api('createRequest', { request: { kind: 'apply', toId: p.ownerId, toName: p.ownerName, projectId: p.id, projectTitle: p.title,
          role: `${s.tag} · ${s.role}`, message: msg, score: m.total } });
        RD.closeModal(); RD.toast('참여 요청을 보냈어요');
        await load(true);
      } catch (ex) { er.textContent = ex.message; er.classList.remove('hide'); ev.target.classList.remove('busy'); ev.target.textContent = '참여 요청 보내기'; }
    };
  }

  /* ---------- 불러오기 ---------- */
  async function load(quiet) {
    if (!quiet) { RD.loading($('#openList')); }
    const [pj, pr, rq] = await Promise.all([RD.api('listProjects'), RD.api('listProfiles'), RD.api('listRequests')]);
    projects = pj.projects.sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
    profiles = pr.profiles;
    requests = rq.requests;
    myProfile = profiles.find(p => p.userId === me.id) || null;
    drawList(); drawOpen();
  }

  fill();
  load().then(() => {
    const mine = projects.filter(p => p.ownerId === me.id);
    if (new URLSearchParams(location.search).get('tab') === 'open') showTab('open');
    if (mine.length) edit(mine[0].id); else newProject();
  }).catch(ex => { RD.errorBox($('#openList'), ex); RD.errorBox($('#recs'), ex); });
})();
