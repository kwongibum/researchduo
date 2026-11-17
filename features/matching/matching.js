/* =========================================================
   기능 2 · 매칭 화면 — 나와 맞는 연구자 (matching.js)  v0.3
   - 시트에서 모든 프로필을 불러와 engine.js + criteria/*.js 로 점수 계산
   - 회원 구분(학부생/대학원생/교수) 필터
   - '팀에 초대': 어느 프로젝트 팀으로 초대할지 고르고(기존 팀 / 새 팀) 자리를 정해서 요청
   ========================================================= */
(() => {
  const me = RD.requireLogin();
  if (!me) return;
  const $ = s => document.querySelector(s);
  const e = s => RD.esc(s);

  const RULES = {
    topic: '관심 주제가 겹칠수록 ↑, 키워드 일치 가산',
    skill: '내가 필요한 역량을 상대가 가졌는가 (+반대 방향)',
    experience: '논문·학회·프로젝트·근거가 많을수록 ↑',
    major: '내 협업 선호(융합/같은 계열)에 맞는가',
    goal: '같은 목표 100 · 비슷한 목표 60 · 다름 0',
    condition: '주당 시간 겹침 + 온·오프라인 방식',
  };

  let weights = {};
  try { weights = JSON.parse(localStorage.getItem('rd_weights') || '{}'); } catch (x) { weights = {}; }
  const saveW = () => { try { localStorage.setItem('rd_weights', JSON.stringify(weights)); } catch (x) {} };
  let typeFilter = '전체';

  let myProfile = null, profiles = [], requests = [], projects = [];

  function drawCrit() {
    $('#crit').innerHTML = RDMatch.criteria().map(c => `
      <div class="crit-r"><span class="n">${c.no}</span>
        <div><b>${e(c.label)}</b><small>${e(RULES[c.key] || '')}</small></div>
        <button class="imp ${weights[c.key] === 2 ? 'on' : ''}" data-k="${c.key}">중요</button></div>`).join('');
    $('#crit').querySelectorAll('.imp').forEach(b => {
      b.onclick = () => { weights[b.dataset.k] = weights[b.dataset.k] === 2 ? 1 : 2; saveW(); drawCrit(); drawResults(); };
    });
  }

  function drawMe() {
    const p = myProfile;
    $('#meCard').innerHTML = `<div class="me-h">${RD.avatar(me.name, me.id, 36)}<div><b>${e(me.name)}</b>${RDProfileView.badges(p)}<span class="mute">내 프로필 기준으로 비교 중</span></div></div>
      <div class="me-sec"><b>관심</b>${e((p.topics || []).join(', ') || '—')}</div>
      <div class="me-sec"><b>필요한 역량</b>${e((p.needs || []).join(', ') || '—')}</div>
      <div class="me-sec"><b>목표</b>${e((p.goals || []).join(', ') || '—')}</div>
      <a class="btn sm" style="margin-top:12px" href="../profile/profile.html">프로필 수정</a>`;
  }

  /* 이 사람과 진행 중인 요청 (어느 팀이든) */
  function activeWith(uid) {
    return requests.filter(r => ['req', 'acc', 'chat'].includes(r.status)
      && ((r.fromId === me.id && r.toId === uid) || (r.toId === me.id && r.fromId === uid) || (r.fromId === uid && r.kind === 'apply')));
  }
  function teamsTogether(uid) { return projects.filter(p => RDTeam.isMember(p, me.id) && RDTeam.isMember(p, uid)); }

  function bars(parts) {
    return `<div class="mc-bars">${parts.map(p => `
      <div><div class="mb-l ${p.weight > 1 ? 'x' : ''}"><span>${p.no} ${e(p.label)}</span><b>${p.score}</b></div>
      <div class="mb-t"><i class="${p.score < 50 ? 'low' : ''}" style="width:${p.score}%"></i></div></div>`).join('')}</div>`;
  }

  function card(m, i) {
    const o = m.other;
    const act = activeWith(o.userId), together = teamsTogether(o.userId);
    const note = [
      together.length ? `<span class="chip g">함께하는 팀 ${together.length}개</span>` : '',
      act.length ? `<span class="chip b">진행 중인 요청 ${act.length}건</span>` : '',
    ].join('');
    const btn = m.available ? `<button class="btn pri sm" data-req="${e(o.userId)}">팀에 초대</button>` : '<button class="btn sm" disabled>참여 어려움</button>';
    const good = m.parts.flatMap(p => p.good.map(g => `<li><i>${p.no}</i>${e(g)}</li>`));
    const warn = m.parts.flatMap(p => p.warn.map(w => `<li><i>${p.no}</i>${e(w)}</li>`));
    return `<div class="mc ${m.available ? '' : 'off'}">
      <div class="mc-top">
        <span class="mc-rank">${i + 1}</span>
        ${RD.avatar(o.name, o.userId, 44)}
        <div class="mc-who"><b>${e(o.name)}</b>${RDProfileView.badges(o)}${m.available ? '' : '<span class="chip">참여 어려움</span>'}
          <div class="sub">${e([o.dept, o.degree, o.semester].filter(Boolean).join(' · '))}</div></div>
        <div class="mc-score"><b>${m.total}</b><span>/100</span></div>
      </div>
      ${bars(m.parts)}
      <div class="mc-why"><ul class="ok">${good.join('')}</ul><ul class="wn">${warn.join('')}</ul></div>
      <div class="mc-act">${note}<span style="flex:1"></span><button class="btn sm" data-view="${e(o.userId)}">프로필 보기</button>${btn}</div>
    </div>`;
  }

  let ranked = [];
  function drawResults() {
    if (!myProfile) return;
    ranked = RDMatch.rank(myProfile, profiles, weights);
    const shown = ranked.filter(m => typeFilter === '전체' || memberType(m.other) === typeFilter);
    const box = $('#results');
    if (!ranked.length) {
      box.innerHTML = `<div class="empty"><b>아직 비교할 다른 연구자가 없어요</b>팀원들이 회원가입하고 프로필을 저장하면 여기에 나타나요.</div>`;
      return;
    }
    const types = ['전체', '학부생', '대학원생', '교수'];
    box.innerHTML = `<div class="res-top"><h2>추천 연구자 ${shown.length}명</h2><span class="mute">시트에 저장된 프로필 기준 · <button class="linkbtn" id="reload">새로고침</button></span></div>
      <div class="tfilter">${types.map(t => `<button class="${t === typeFilter ? 'on' : ''}" data-t="${t}">${t}<small>${t === '전체' ? ranked.length : ranked.filter(m => memberType(m.other) === t).length}</small></button>`).join('')}</div>
      ${shown.length ? shown.map(card).join('') : '<div class="empty">이 구분에 해당하는 연구자가 없어요.</div>'}`;
    $('#reload').onclick = load;
    box.querySelectorAll('.tfilter button').forEach(b => { b.onclick = () => { typeFilter = b.dataset.t; drawResults(); }; });
    box.querySelectorAll('[data-view]').forEach(b => { b.onclick = () => view(b.dataset.view); });
    box.querySelectorAll('[data-req]').forEach(b => { b.onclick = () => inviteModal(b.dataset.req); });
  }

  function view(uid) {
    const m = ranked.find(x => x.other.userId === uid);
    if (!m) return;
    const top = m.parts.slice().sort((a, b) => b.score - a.score).slice(0, 2).map(p => p.label).join(', ');
    const modal = RD.openModal(RDProfileView.render(m.other, {
      banner: `나와의 매칭 ${m.total}점`,
      reason: `${m.total}점 · 특히 잘 맞는 카테고리: <b>${e(top)}</b>`,
      actions: m.available ? '<button class="btn pri sm" id="mReq">팀에 초대</button>' : '',
    }));
    const b = modal.querySelector('#mReq');
    if (b) b.onclick = () => inviteModal(uid);
  }

  /* ---------- 팀에 초대: 대상 팀 + 자리 선택 ---------- */
  function inviteModal(uid) {
    const m = ranked.find(x => x.other.userId === uid);
    if (!m) return;
    const o = m.other;
    const candidateTags = [...new Set([...(myProfile.needs || []).filter(n => (o.skills || []).some(s => s.tag === n)),
      ...(o.skills || []).map(s => s.tag)].filter(Boolean))];
    const mineOpen = RDTeam.myTeams(projects, me.id).filter(p => p.status !== '완료' && !RDTeam.isMember(p, uid));
    const modal = RD.openModal(`<h3 class="m-title">${e(o.name)}님을 프로젝트 팀에 초대</h3>
      <p class="m-sub">매칭 ${m.total}점. 초대는 ${e(o.name)}님의 ③ 받은 요청함에 도착하고, 수락하면 고른 팀에 합류해요.</p>
      ${RDTeam.teamPicker(mineOpen, me.id, mineOpen.length ? mineOpen[0].id : '__new')}
      <div class="field"><label>어떤 자리를 부탁하나요?</label><select class="q-slot"></select></div>
      <div class="grid2 q-newslot">
        <div class="field"><label>새 자리 · 전문성</label><select class="q-tag">${candidateTags.map(t => `<option>${e(t)}</option>`).join('')}</select></div>
        <div class="field"><label>역할</label><select class="q-role">${ROLES.map(r => `<option>${r}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>메시지</label><textarea class="q-msg" rows="3" placeholder="예) 설문 결과를 분석해 줄 분을 찾고 있어요. 30분 커피챗 가능할까요?"></textarea></div>
      <p class="hint err hide q-err"></p>
      <div class="row-end"><span></span><button class="btn pri q-send">초대 보내기</button></div>`);

    const slotSel = modal.querySelector('.q-slot');
    function drawSlotOptions(pid) {
      const p = projects.find(x => x.id === pid);
      const open = p ? RDTeam.openSlots(p) : [];
      const best = p ? RDTeam.bestSlot(open, o) : null;
      slotSel.innerHTML = open.map(s => `<option value="${e(s.id)}" ${best === s ? 'selected' : ''}>${e(s.tag)} · ${e(s.role || '')} (남은 자리)</option>`).join('')
        + `<option value="__add" ${open.length ? '' : 'selected'}>+ 새 자리 만들기</option>`;
      toggleNew();
    }
    function toggleNew() { modal.querySelector('.q-newslot').classList.toggle('hide', slotSel.value !== '__add'); }
    slotSel.onchange = toggleNew;
    RDTeam.bindTeamPicker(modal, drawSlotOptions);
    drawSlotOptions(modal.querySelector('.t-pick').value);

    modal.querySelector('.q-send').onclick = async ev => {
      const btn = ev.target, err = modal.querySelector('.q-err');
      const showErr = t => { err.textContent = t; err.classList.remove('hide'); };
      const msg = modal.querySelector('.q-msg').value.trim();
      if (!msg) return showErr('메시지를 적어 주세요');
      let pid = modal.querySelector('.t-pick').value;
      if (pid === '__new' && !modal.querySelector('.t-title').value.trim()) return showErr('새 팀 이름을 적어 주세요');
      if (slotSel.value === '__add' && !modal.querySelector('.q-tag').value) return showErr('새 자리의 전문성을 골라 주세요');
      btn.classList.add('busy'); btn.textContent = '보내는 중…';
      try {
        let slotId = slotSel.value;
        const newSlot = { tag: modal.querySelector('.q-tag').value, level: 2, role: modal.querySelector('.q-role').value };
        if (pid === '__new') {
          const r = await RD.api('saveProject', { project: {
            title: modal.querySelector('.t-title').value.trim(), visibility: modal.querySelector('.t-public').checked ? 'public' : 'private',
            topics: myProfile.topics || [], keywords: myProfile.keywords || [], goals: myProfile.goals || [],
            hours: myProfile.hours, mode: myProfile.mode, slots: [newSlot] } });
          pid = r.id; slotId = r.project.slots[0].id;
        } else if (slotId === '__add') {
          const p = projects.find(x => x.id === pid);
          const r = await RD.api('saveProject', { project: { id: pid, slots: [...(p.slots || []), newSlot] } });
          slotId = r.project.slots[r.project.slots.length - 1].id;
        }
        const p2 = (await RD.api('listProjects')).projects.find(x => x.id === pid);
        const s = p2 && RDTeam.slotById(p2, slotId);
        await RD.api('createRequest', { request: { kind: 'invite', projectId: pid, toId: o.userId, toName: o.name,
          slotId, role: s ? `${s.tag} · ${s.role}` : newSlot.role, message: msg, score: m.total } });
        RD.closeModal();
        RD.toast(`${o.name}님에게 초대를 보냈어요`);
        await load();
      } catch (ex) {
        showErr(ex.message);
        btn.classList.remove('busy'); btn.textContent = '초대 보내기';
      }
    };
  }

  async function load() {
    RD.loading($('#results'), '팀원 프로필을 불러오는 중…');
    try {
      const [pr, rq, pj] = await Promise.all([RD.api('listProfiles'), RD.api('listRequests'), RD.api('listProjects')]);
      profiles = pr.profiles; requests = rq.requests; projects = pj.projects;
      myProfile = profiles.find(p => p.userId === me.id);
      if (!myProfile) {
        $('#meCard').innerHTML = '';
        $('#results').innerHTML = `<div class="empty"><b>먼저 내 연구 프로필이 필요해요</b>내 프로필을 기준으로 다른 연구자와 비교해요.<br><a class="btn pri" href="../profile/profile.html">① 연구 프로필 만들기</a></div>`;
        return;
      }
      drawMe();
      drawResults();
    } catch (ex) {
      RD.errorBox($('#results'), ex);
    }
  }

  drawCrit();
  load();
})();
