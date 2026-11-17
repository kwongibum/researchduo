/* =========================================================
   기능 2 · 프로젝트 개설·매칭 (project.js)  v0.3
   - 내 프로젝트 팀: 개설·수정(팀원 누구나)·삭제(개설자) → 시트 '프로젝트' 탭
   - 프로젝트 → 연구자 추천: 남은 자리 기준으로 같은 6개 카테고리 비교 → 팀에 초대
   - 열린 프로젝트: 공개 프로젝트에 '기여 의향서'와 함께 참여 요청
   - 지원자 비교·팀 관리는 ③ 팀 공간(team.html)에서
   ========================================================= */
(() => {
  const me = RD.requireLogin();
  if (!me) return;
  const $ = s => document.querySelector(s);
  const e = s => RD.esc(s);
  const clone = o => JSON.parse(JSON.stringify(o));
  RD.skillDatalist();
  const params = new URLSearchParams(location.search);

  const EMPTY = { id: null, title: '', summary: '', topics: [], keywords: [], goals: [], hours: [3, 6], mode: '블렌디드',
                  visibility: 'public', slots: [{ raw: '', tag: null, level: 2, role: ROLES[0] }] };
  let draft = clone(EMPTY);
  let projects = [], profiles = [], requests = [];
  let myProfile = null;

  const checks = (el, list, name) => { el.innerHTML = list.map(v => `<label><input type="checkbox" name="${name}" value="${e(v)}"> ${e(v)}</label>`).join(''); };
  checks($('#topics'), TOPICS, 'ptopic');
  checks($('#goals'), GOALS, 'pgoal');
  $('#mode').innerHTML = MODES.map(m => `<option>${m}</option>`).join('');

  function showTab(t) {
    document.querySelectorAll('.mtab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    $('#tab-mine').classList.toggle('hide', t !== 'mine');
    $('#tab-open').classList.toggle('hide', t !== 'open');
  }
  document.querySelectorAll('.mtab').forEach(b => { b.onclick = () => showTab(b.dataset.tab); });

  /* 카테고리 문구를 상황에 맞게 바꾸기 */
  function reword(text, view) {
    if (view === 'recs') return text.replace(/내가 필요한/g, '프로젝트에 필요한').replace(/내 선호/g, '개설자 협업 선호');
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
  /* 이 팀과 이 사람 사이에 진행 중인(또는 끝난) 요청 */
  function reqFor(p, uid) {
    return requests.filter(r => r.projectId === p.id && (r.kind === 'apply' ? r.fromId === uid : r.toId === uid))
      .sort((a, b) => String(b.updated).localeCompare(String(a.updated)))[0];
  }

  /* ---------- 내 프로젝트 팀 목록 ---------- */
  function drawList() {
    const mine = RDTeam.myTeams(projects, me.id);
    $('#mineCount').textContent = mine.length ? `${mine.length}개` : '';
    $('#plist').innerHTML = mine.map(p => {
      const open = RDTeam.openSlots(p).length;
      return `<button class="pchip ${draft.id === p.id ? 'on' : ''}" data-id="${e(p.id)}">${e(p.title)}
        <small>${p.ownerId === me.id ? '개설' : '팀원'} · ${e(p.status)} · ${1 + (p.members || []).length}명 · 남은 자리 ${open}</small></button>`;
    }).join('') + `<button class="pchip new" id="newChip">+ 새 프로젝트</button>`;
    $('#plist').querySelectorAll('[data-id]').forEach(b => { b.onclick = () => edit(b.dataset.id); });
    $('#newChip').onclick = newProject;
  }

  /* ---------- 입력 폼 ---------- */
  function drawSlots() {
    $('#slots').innerHTML = draft.slots.map((s, i) => `
      <div class="slot" data-i="${i}">
        <div class="slot-top">자리 ${i + 1}${s.filledBy ? ` <span class="chip g">✓ ${e(RDTeam.memberName(draft, s.filledBy) || '채워짐')}</span>` : ''}${draft.slots.length > 1 && !s.filledBy ? '<button type="button" class="slot-del" aria-label="삭제">×</button>' : ''}</div>
        <input type="text" class="sl-raw" list="skill-list" placeholder="필요한 전문성 (예: 통계 분석, SPSS)" value="${e(s.raw || s.tag || '')}" ${s.filledBy ? 'disabled' : ''}>
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
    const isOwner = !draft.id || draft.ownerId === me.id;
    $('#formTitle').textContent = draft.id ? '프로젝트 팀 수정' : '새 프로젝트 개설';
    $('#delBtn').classList.toggle('hide', !draft.id || !isOwner);
    $('#teamLink').classList.toggle('hide', !draft.id);
    if (draft.id) $('#teamLink').href = `../connect/team.html?id=${encodeURIComponent(draft.id)}`;
    $('#title').value = draft.title || '';
    $('#summary').value = draft.summary || '';
    $('#keywords').value = (draft.keywords || []).join(', ');
    $('#hmin').value = (draft.hours || [3, 6])[0]; $('#hmax').value = (draft.hours || [3, 6])[1];
    $('#mode').value = draft.mode || '블렌디드';
    document.querySelectorAll('[name=ptopic]').forEach(c => { c.checked = (draft.topics || []).includes(c.value); });
    document.querySelectorAll('[name=pgoal]').forEach(c => { c.checked = (draft.goals || []).includes(c.value); });
    document.querySelectorAll('[name=vis]').forEach(c => { c.checked = c.value === (draft.visibility || 'public'); c.disabled = !isOwner; });
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
    draft.visibility = (document.querySelector('[name=vis]:checked') || {}).value || 'public';
    draft.slots = [...document.querySelectorAll('.slot')].map((row, i) => {
      const prev = draft.slots[i] || {};
      const raw = row.querySelector('.sl-raw').value.trim();
      return { id: prev.id, filledBy: prev.filledBy, raw, tag: normalizeSkill(raw).tag, level: +row.querySelector('.sl-lv').value, role: row.querySelector('.sl-role').value };
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
      const send = { id: p.id, title: p.title, summary: p.summary, topics: p.topics, keywords: p.keywords, goals: p.goals,
                     hours: p.hours, mode: p.mode, slots: p.slots };
      if (!p.id || p.ownerId === me.id) send.visibility = p.visibility;
      const r = await RD.api('saveProject', { project: send });
      RD.toast(p.id ? '저장했어요' : '프로젝트 팀을 만들었어요. 팀 공간도 열렸어요');
      await load(true);
      edit(r.id);
    } catch (ex) {
      err.textContent = ex.message; err.classList.remove('hide');
    } finally {
      btn.classList.remove('busy'); btn.textContent = '저장하고 추천받기';
    }
  });

  $('#delBtn').onclick = async () => {
    if (!draft.id || !window.confirm('이 프로젝트 팀을 삭제할까요? 다른 팀원에게도 더 이상 보이지 않아요.')) return;
    try { await RD.api('deleteProject', { id: draft.id }); RD.toast('삭제했어요'); await load(true); newProject(); }
    catch (ex) { RD.toast(ex.message); }
  };

  /* ---------- 프로젝트 → 연구자 추천 (남은 자리 기준) ---------- */
  let recRanked = [];
  function drawRecs() {
    const p = projects.find(x => x.id === draft.id);
    if (!p) return;
    const open = RDTeam.openSlots(p);
    const applicants = requests.filter(r => r.projectId === p.id && ['req', 'acc', 'chat'].includes(r.status)).length;
    recRanked = RDMatch.rank(RDTeam.seekerOf(p, profiles), profiles.filter(x => !RDTeam.isMember(p, x.userId)));
    $('#recs').innerHTML = `
      <div class="res-h">
        <div class="kick">추천 연구자 · 남은 자리 ${open.length}개 기준</div>
        <h2>${e(p.title)} ${RDTeam.statusChip(p.status)} ${RDTeam.visChip(p)}</h2>
        ${p.summary ? `<p>${e(p.summary)}</p>` : ''}
        <div class="res-meta">${(p.slots || []).map(s => `<span class="chip ${s.filledBy ? 'g' : ''}">${s.filledBy ? '✓ ' : ''}${e(s.tag)} · ${LEVELS[s.level]}↑ · ${e(s.role)}</span>`).join('')}</div>
        ${applicants ? `<a class="btn sm" style="margin-top:12px" href="../connect/team.html?id=${encodeURIComponent(p.id)}#applicants">진행 중인 지원자 ${applicants}명 비교하기 →</a>` : ''}
      </div>
      ${!open.length ? '<div class="empty"><b>모든 자리가 채워졌어요</b>새 전문성이 필요하면 왼쪽에서 자리를 추가하세요.</div>'
        : recRanked.length ? recRanked.map((m, i) => recCard(p, m, i)).join('')
        : '<div class="empty"><b>아직 비교할 다른 연구자가 없어요</b>팀원들이 프로필을 저장하면 여기에 나타나요.</div>'}`;
    $('#recs').querySelectorAll('[data-view]').forEach(b => { b.onclick = () => { const o = profiles.find(x => x.userId === b.dataset.view); if (o) RD.openModal(RDProfileView.render(o)); }; });
    $('#recs').querySelectorAll('[data-cast]').forEach(b => { b.onclick = () => inviteModal(p, b.dataset.cast); });
  }
  function recCard(p, m, i) {
    const o = m.other;
    const q = reqFor(p, o.userId);
    const active = q && ['req', 'acc', 'chat'].includes(q.status);
    const btn = active ? `<button class="btn sm done" disabled>${RDTeam.STATUS_LABEL[q.status]}</button>`
      : m.available ? `<button class="btn pri sm" data-cast="${e(o.userId)}">팀에 초대</button>`
      : '<button class="btn sm" disabled>참여 어려움</button>';
    return `<div class="mc ${m.available ? '' : 'off'}">
      <div class="mc-top"><span class="mc-rank">${i + 1}</span>${RD.avatar(o.name, o.userId, 44)}
        <div class="mc-who"><b>${e(o.name)}</b>${RDProfileView.badges(o)}<div class="sub">${e([o.dept, o.degree, o.semester].filter(Boolean).join(' · '))}</div></div>
        <div class="mc-score"><b>${m.total}</b><span>/100</span></div></div>
      <div class="fits">${RDTeam.slotFits(RDTeam.openSlots(p), o).map(f => `<span class="fit ${f.cls}">자리 · ${e(f.text)}</span>`).join('')}</div>
      ${bars(m.parts)}${why(m.parts, 'recs')}
      <div class="mc-act"><button class="btn sm" data-view="${e(o.userId)}">프로필 보기</button>${btn}</div>
    </div>`;
  }
  function inviteModal(p, uid) {
    const m = recRanked.find(x => x.other.userId === uid);
    if (!m) return;
    const o = m.other, open = RDTeam.openSlots(p), best = RDTeam.bestSlot(open, o);
    const modal = RD.openModal(`<h3 class="m-title">${e(o.name)}님을 ‘${e(p.title)}’ 팀에 초대</h3>
      <p class="m-sub">매칭 ${m.total}점 · 기존 팀에 합류해요. 초대는 ${e(o.name)}님의 ③ 받은 요청함에 도착하고, 수락할 때 기여 의향서를 써요.</p>
      <div class="field"><label>어떤 자리를 부탁하나요?</label><select id="qSlot">${open.map(s => `<option value="${e(s.id)}" ${best === s ? 'selected' : ''}>${e(s.tag)} · ${e(s.role)}</option>`).join('')}</select></div>
      <div class="field"><label>메시지</label><textarea id="qMsg" rows="3" placeholder="예) 설문 데이터 분석 자리를 부탁드리고 싶어요. 30분 커피챗 가능할까요?"></textarea></div>
      <p class="hint err hide" id="qErr"></p>
      <div class="row-end"><span></span><button class="btn pri" id="qSend">초대 보내기</button></div>`);
    modal.querySelector('#qSend').onclick = async ev => {
      const msg = modal.querySelector('#qMsg').value.trim(), er = modal.querySelector('#qErr');
      if (!msg) { er.textContent = '메시지를 적어 주세요'; er.classList.remove('hide'); return; }
      const s = RDTeam.slotById(p, modal.querySelector('#qSlot').value);
      ev.target.classList.add('busy'); ev.target.textContent = '보내는 중…';
      try {
        await RD.api('createRequest', { request: { kind: 'invite', projectId: p.id, toId: o.userId, toName: o.name,
          slotId: s.id, role: `${s.tag} · ${s.role}`, message: msg, score: m.total } });
        RD.closeModal(); RD.toast(`${o.name}님에게 초대를 보냈어요`);
        await load(true); drawRecs();
      } catch (ex) { er.textContent = ex.message; er.classList.remove('hide'); ev.target.classList.remove('busy'); ev.target.textContent = '초대 보내기'; }
    };
  }

  /* ---------- 열린 프로젝트: 공개 프로젝트에 기여 의향과 함께 참여 요청 ---------- */
  function drawOpen() {
    const others = projects.filter(p => !RDTeam.isMember(p, me.id) && p.visibility !== 'private' && p.status !== '완료');
    $('#openCount').textContent = others.length ? `${others.length}개` : '';
    const box = $('#openList');
    if (!others.length) { box.innerHTML = '<div class="empty"><b>참여할 수 있는 공개 프로젝트가 없어요</b>다른 연구자가 공개 프로젝트를 개설하면 여기에 나타나요.</div>'; return; }
    if (!myProfile) { box.innerHTML = `<div class="empty"><b>먼저 내 연구 프로필이 필요해요</b>내 프로필과 비교해서 맞는 프로젝트를 보여드려요.<br><a class="btn pri" href="../profile/profile.html">① 연구 프로필 만들기</a></div>`; return; }
    const list = others.map(p => ({ p, m: RDMatch.compare(RDTeam.seekerOf(p, profiles), myProfile) })).sort((a, b) => b.m.total - a.m.total);
    box.innerHTML = list.map(({ p, m }) => {
      const topic = m.parts.find(x => x.key === 'topic');
      const q = reqFor(p, me.id);
      const open = RDTeam.openSlots(p);
      const btn = q && ['req', 'acc', 'chat'].includes(q.status) ? `<button class="btn sm done" disabled>${RDTeam.STATUS_LABEL[q.status]}</button>`
        : open.length ? `<button class="btn grn sm" data-apply="${e(p.id)}">기여 의향서 쓰고 참여 요청</button>` : '<button class="btn sm" disabled>남은 자리 없음</button>';
      return `<div class="mc">
        <div class="mc-top">${RD.avatar(p.ownerName, p.ownerId, 44)}
          <div class="mc-who"><b>${e(p.title)}</b>${topic && topic.score >= 50 ? '<span class="simtag">비슷한 주제</span>' : ''}
            <div class="pc-owner">개설자 ${e(p.ownerName)} · 팀 ${1 + (p.members || []).length}명 · ${RDTeam.statusChip(p.status)}</div></div>
          <div class="mc-score"><b>${m.total}</b><span>/100</span></div></div>
        ${p.summary ? `<div class="pc-sum">${e(p.summary)}</div>` : ''}
        <div class="fits">${RDTeam.slotFits(open, myProfile).map(f => `<span class="fit ${f.cls}">남은 자리 · ${e(f.text)}</span>`).join('') || '<span class="fit">남은 자리 없음</span>'}</div>
        ${bars(m.parts)}${why(m.parts, 'open')}
        <div class="mc-act"><button class="btn sm" data-owner="${e(p.ownerId)}">개설자 프로필</button>${btn}</div>
      </div>`;
    }).join('');
    box.querySelectorAll('[data-owner]').forEach(b => { b.onclick = () => { const o = profiles.find(x => x.userId === b.dataset.owner); if (o) RD.openModal(RDProfileView.render(o)); }; });
    box.querySelectorAll('[data-apply]').forEach(b => { b.onclick = () => applyModal(list.find(x => x.p.id === b.dataset.apply)); });
  }
  function applyModal({ p, m }) {
    const open = RDTeam.openSlots(p), best = RDTeam.bestSlot(open, myProfile);
    const modal = RD.openModal(`<h3 class="m-title">‘${e(p.title)}’에 참여 요청</h3>
      <p class="m-sub">개설자 ${e(p.ownerName)}님과 팀원들의 ③ 받은 요청함에 도착해요. 나와의 매칭 ${m.total}점</p>
      ${RDTeam.intentForm(open, { slotId: best && best.id, hours: myProfile.hours ? `주 ${myProfile.hours[0]}~${myProfile.hours[1]}시간` : '' })}
      <div class="field"><label>한마디</label><textarea id="aMsg" rows="2" placeholder="예) 시각화를 맡아보고 싶어요. 잘 부탁드려요!"></textarea></div>
      <p class="hint err hide" id="aErr"></p>
      <div class="row-end"><span></span><button class="btn grn" id="aSend">참여 요청 보내기</button></div>`);
    modal.querySelector('#aSend').onclick = async ev => {
      const it = RDTeam.readIntent(modal), er = modal.querySelector('#aErr');
      const msg = modal.querySelector('#aMsg').value.trim();
      if (!it.contribution) { er.textContent = '구체적으로 무엇을 기여하고 싶은지 적어 주세요'; er.classList.remove('hide'); return; }
      const s = RDTeam.slotById(p, it.slotId);
      ev.target.classList.add('busy'); ev.target.textContent = '보내는 중…';
      try {
        await RD.api('createRequest', { request: { kind: 'apply', projectId: p.id, slotId: it.slotId,
          role: s ? `${s.tag} · ${s.role}` : '', message: msg || it.contribution, intent: it, score: m.total } });
        RD.closeModal(); RD.toast('참여 요청을 보냈어요');
        await load(true);
      } catch (ex) { er.textContent = ex.message; er.classList.remove('hide'); ev.target.classList.remove('busy'); ev.target.textContent = '참여 요청 보내기'; }
    };
  }

  /* ---------- 불러오기 ---------- */
  async function load(quiet) {
    if (!quiet) RD.loading($('#openList'));
    const [pj, pr, rq] = await Promise.all([RD.api('listProjects'), RD.api('listProfiles'), RD.api('listRequests')]);
    projects = pj.projects.sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
    profiles = pr.profiles;
    requests = rq.requests;
    myProfile = profiles.find(p => p.userId === me.id) || null;
    drawList(); drawOpen();
  }

  fill();
  load().then(() => {
    const mine = RDTeam.myTeams(projects, me.id);
    if (params.get('tab') === 'open') showTab('open');
    const want = params.get('id');
    if (want && mine.some(p => p.id === want)) edit(want);
    else if (params.get('new')) newProject();
    else if (mine.length) edit(mine[0].id); else newProject();
  }).catch(ex => { RD.errorBox($('#openList'), ex); RD.errorBox($('#recs'), ex); });
})();
