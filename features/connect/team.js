/* =========================================================
   기능 3 · 팀 공간 (team.js)  v0.3 — 그룹 결성 후에 할 수 있는 일
   - 팀 현황: 상태(모집 중/진행 중/완료), 공개/비공개(개설자), 오픈채팅 링크
   - 자리 현황: 채워진 자리 / 남은 자리, 자리 추가·삭제(팀원 누구나), 남은 자리로 추천받아 초대
   - 멤버: 자리·역할·기여 내용·기간·저자 순서
   - 지원자 비교: 같은 자리 지원자를 나란히 (매칭 점수·카테고리·기여 의향)
   - 팀 메시지: 8초마다 새로고침되는 가벼운 채팅
   - 완료 후 후기: 팀원끼리 후기 키워드 → 프로필 활동 기록
   ========================================================= */
(() => {
  const me = RD.requireLogin();
  if (!me) return;
  const $ = s => document.querySelector(s);
  const e = s => RD.esc(s);
  RD.skillDatalist();
  const id = new URLSearchParams(location.search).get('id');

  let p = null, profiles = [], requests = [], messages = [], reviews = [];
  let member = false, owner = false;
  const prof = uid => profiles.find(x => x.userId === uid);
  const people = () => [{ userId: p.ownerId, name: p.ownerName, owner: true }, ...(p.members || [])];

  async function save(patch, okMsg) {
    try {
      const r = await RD.api('saveProject', { project: { id: p.id, ...patch } });
      p = r.project;
      if (okMsg) RD.toast(okMsg);
      drawAll();
    } catch (ex) { RD.toast(ex.message); }
  }

  /* ---------- 머리말: 팀 현황·설정 ---------- */
  function drawHead() {
    $('#head').innerHTML = `<div class="thead">
      <div class="th-top">${RDTeam.statusChip(p.status)}${RDTeam.visChip(p)}<span class="chip">팀 ${people().length}명</span><span class="chip">남은 자리 ${RDTeam.openSlots(p).length}</span></div>
      <h1>${e(p.title)}</h1>
      <div class="th-owner">개설자 ${e(p.ownerName)} · ${e(p.created || '')} 개설</div>
      ${p.summary ? `<p class="th-sum">${e(p.summary)}</p>` : ''}
      <div class="th-tags">${(p.topics || []).map(t => `<span class="chip b">${e(t)}</span>`).join('')}${(p.goals || []).map(t => `<span class="chip g">${e(t)}</span>`).join('')}</div>
      ${member ? `<div class="th-ctl">
        <label class="mute">진행 상태</label><select id="stSel">${TEAM_STATUS.map(s => `<option ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
        ${owner ? `<label class="mute">공개</label><select id="visSel"><option value="public" ${p.visibility !== 'private' ? 'selected' : ''}>공개 · 참여 요청 받기</option><option value="private" ${p.visibility === 'private' ? 'selected' : ''}>비공개 · 초대로만</option></select>` : ''}
        <span class="sp"></span>
        <a class="btn sm" href="../matching/project.html?id=${encodeURIComponent(p.id)}">프로젝트 내용 수정</a>
        ${owner ? '' : '<button class="btn sm" id="leaveBtn">팀 나가기</button>'}
      </div>` : `<div class="th-ctl"><span class="mute">팀원이 아니에요. 공개 프로젝트라 내용을 볼 수 있어요.</span><span class="sp"></span>
        <a class="btn grn sm" href="../matching/project.html?tab=open">기여 의향서 쓰고 참여 요청</a></div>`}
    </div>`;
    if (!member) return;
    $('#stSel').onchange = ev => {
      const v = ev.target.value;
      if (v === '완료' && !window.confirm('프로젝트를 완료로 바꿀까요? 완료하면 팀원끼리 후기를 남길 수 있어요.')) { ev.target.value = p.status; return; }
      save({ status: v }, `상태를 ‘${v}’(으)로 바꿨어요`);
    };
    if (owner) $('#visSel').onchange = ev => save({ visibility: ev.target.value }, ev.target.value === 'private' ? '비공개로 바꿨어요. 초대로만 합류할 수 있어요' : '공개로 바꿨어요. 다른 연구자가 참여 요청할 수 있어요');
    const lb = $('#leaveBtn');
    if (lb) lb.onclick = async () => {
      if (!window.confirm('이 팀에서 나갈까요? 내가 맡은 자리는 다시 남은 자리가 돼요.')) return;
      try { await RD.api('leaveTeam', { id: p.id }); RD.toast('팀에서 나왔어요'); location.href = 'connect.html'; } catch (ex) { RD.toast(ex.message); }
    };
  }

  /* ---------- 자리 현황 ---------- */
  function drawSlots() {
    const slots = (p.slots || []).filter(s => s.tag);
    $('#slotsCard').innerHTML = `<div class="card-h"><h2>자리 현황</h2><span class="mute">필요한 전문성 = 팀의 역량 설정</span></div>
      <div class="slots">${slots.map(s => {
        const who = s.filledBy ? people().find(m => m.userId === s.filledBy) : null;
        return `<div class="sl ${who ? '' : 'open'}">
          ${who ? RD.avatar(who.name, who.userId, 32) : '<span class="sl-empty">?</span>'}
          <div class="sl-tag"><b>${e(s.tag)}</b> <span class="mute">${LEVELS[s.level] || ''} 이상 · ${e(s.role || '')}</span>
            <small>${who ? `✓ ${e(who.name)}님이 맡고 있어요` : '남은 자리'}</small></div>
          <div class="btns">${!who && member ? `<button class="btn pri sm" data-rec="${e(s.id)}">추천받아 초대</button><button class="linkbtn" data-del="${e(s.id)}">삭제</button>` : ''}</div>
        </div>`;
      }).join('') || '<div class="empty">아직 등록된 자리가 없어요.</div>'}</div>
      ${member ? `<form class="addslot" id="addSlot">
        <span class="lbl">+ 새 자리 추가 <small>연구 중 새로 필요해진 전문성</small></span>
        <div class="grid3">
          <input type="text" id="nsTag" list="skill-list" placeholder="예) 질적 연구, 인터뷰">
          <select id="nsLv">${[1, 2, 3].map(l => `<option value="${l}" ${l === 2 ? 'selected' : ''}>요구: ${LEVELS[l]} 이상</option>`).join('')}</select>
          <select id="nsRole">${ROLES.map(r => `<option>${r}</option>`).join('')}</select>
        </div>
        <small class="hint hide" id="nsHint"></small>
        <div class="row-end"><span></span><button class="btn sm" type="submit">자리 추가</button></div>
      </form>` : ''}`;
    $('#slotsCard').querySelectorAll('[data-rec]').forEach(b => { b.onclick = () => recModal(b.dataset.rec); });
    $('#slotsCard').querySelectorAll('[data-del]').forEach(b => {
      b.onclick = () => { if (window.confirm('이 자리를 삭제할까요?')) save({ slots: p.slots.filter(s => s.id !== b.dataset.del) }, '자리를 삭제했어요'); };
    });
    const f = $('#addSlot');
    if (f) {
      $('#nsTag').oninput = () => {
        const raw = $('#nsTag').value.trim(), n = normalizeSkill(raw), h = $('#nsHint');
        h.className = 'hint hide';
        if (raw && !n.tag) { h.textContent = '목록에 없는 용어예요. 자동완성에서 골라 주세요.'; h.className = 'hint err'; }
        else if (n.via) { h.textContent = `‘${raw}’ → ‘${n.tag}’(으)로 인식했어요`; h.className = 'hint'; }
      };
      f.onsubmit = ev => {
        ev.preventDefault();
        const n = normalizeSkill($('#nsTag').value);
        if (!n.tag) { RD.toast('목록에 있는 전문성을 골라 주세요'); return; }
        save({ slots: [...p.slots, { raw: n.raw, tag: n.tag, level: +$('#nsLv').value, role: $('#nsRole').value }] }, `‘${n.tag}’ 자리를 추가했어요. 추천받아 초대해 보세요`);
      };
    }
  }

  /* 남은 자리로 추천받아 초대 */
  function recModal(slotId) {
    const s = RDTeam.slotById(p, slotId);
    const busy = uid => requests.some(q => q.projectId === p.id && ['req', 'acc', 'chat'].includes(q.status) && (q.kind === 'apply' ? q.fromId : q.toId) === uid);
    const ranked = RDMatch.rank(RDTeam.seekerOf(p, profiles, [s.tag]), profiles.filter(x => !RDTeam.isMember(p, x.userId))).slice(0, 6);
    const modal = RD.openModal(`<h3 class="m-title">‘${e(s.tag)}’ 자리 추천</h3>
      <p class="m-sub">이 자리를 기준으로 같은 6개 카테고리로 비교했어요. 초대하면 이 팀에 합류해요.</p>
      <div class="recs">${ranked.length ? ranked.map(m => {
        const o = m.other, fit = RDTeam.slotFits([s], o)[0];
        return `<div class="rec" data-uid="${e(o.userId)}">
          <div class="who">${RD.avatar(o.name, o.userId, 36)}<div><b>${e(o.name)}</b>${RDProfileView.badges(o)}<div class="mute">${e([o.dept, o.degree].filter(Boolean).join(' · '))}</div></div>
            <strong>${m.total}<small>/100</small></strong></div>
          <div class="fits"><span class="fit ${fit.cls}">${e(fit.text)}</span></div>
          ${busy(o.userId) ? '<button class="btn sm done" disabled>진행 중인 요청 있음</button>' : `<button class="btn pri sm" data-inv="${e(o.userId)}">초대</button>`}
          <div class="inv hide"><textarea rows="2" placeholder="예) ${e(s.tag)} 자리를 부탁드리고 싶어요. 30분 커피챗 가능할까요?"></textarea><button class="btn pri sm" data-send="${e(o.userId)}">초대 보내기</button></div>
        </div>`;
      }).join('') : '<div class="empty">추천할 연구자가 없어요.</div>'}</div>`);
    modal.querySelectorAll('[data-inv]').forEach(b => { b.onclick = () => { b.classList.add('hide'); b.parentElement.querySelector('.inv').classList.remove('hide'); b.parentElement.querySelector('textarea').focus(); }; });
    modal.querySelectorAll('[data-send]').forEach(b => {
      b.onclick = async () => {
        const box = b.closest('.rec'), msg = box.querySelector('textarea').value.trim();
        const m = ranked.find(x => x.other.userId === b.dataset.send);
        if (!msg) { RD.toast('메시지를 적어 주세요'); return; }
        b.classList.add('busy');
        try {
          await RD.api('createRequest', { request: { kind: 'invite', projectId: p.id, toId: m.other.userId, toName: m.other.name,
            slotId: s.id, role: `${s.tag} · ${s.role}`, message: msg, score: m.total } });
          RD.closeModal(); RD.toast(`${m.other.name}님에게 초대를 보냈어요`);
          await load(true);
        } catch (ex) { RD.toast(ex.message); b.classList.remove('busy'); }
      };
    });
  }

  /* ---------- 멤버 ---------- */
  function drawMembers() {
    $('#membersCard').innerHTML = `<div class="card-h"><h2>멤버</h2><span class="mute">${people().length}명</span></div>
      ${people().map(m => {
        const pr = prof(m.userId), s = m.slotId ? RDTeam.slotById(p, m.slotId) : null;
        return `<div class="mrow">${RD.avatar(m.name, m.userId, 34)}
          <div class="nm"><b>${e(m.name)}${m.userId === me.id ? ' (나)' : ''}</b>${pr ? RDProfileView.badges(pr) : ''}<small>${m.owner ? '프로젝트 개설자' : `${e(m.joined || '')} 합류`}</small></div>
          <div><span class="k">자리 · 기여 내용</span>${m.owner ? '프로젝트 총괄' : e([s ? s.tag : '', m.contribution || m.role].filter(Boolean).join(' · ') || '—')}</div>
          <div class="hide-s"><span class="k">기간 · 저자 순서</span>${m.owner ? '—' : e([m.period, m.author].filter(Boolean).join(' · ') || '—')}</div>
        </div>`;
      }).join('')}`;
  }

  /* ---------- 지원자 비교 ---------- */
  function drawApplicants() {
    const box = $('#applicants');
    if (!member) { box.classList.add('hide'); return; }
    const act = requests.filter(q => q.projectId === p.id && ['req', 'acc', 'chat'].includes(q.status));
    const joinerId = q => (q.kind === 'apply' ? q.fromId : q.toId);
    const joinerName = q => (q.kind === 'apply' ? q.fromName : q.toName);
    const groups = {};
    act.forEach(q => { const sid = (q.intent || {}).slotId || q.slotId || '_'; (groups[sid] = groups[sid] || []).push(q); });
    const ST = { req: '응답 대기', acc: '커피챗 조율 중', chat: '커피챗 확정' };
    box.innerHTML = `<div class="card-h"><h2>지원자 비교</h2><span class="mute">같은 자리 지원자를 나란히 보고 골라요</span></div>
      ${!act.length ? '<div class="empty">진행 중인 지원자·초대가 없어요. 남은 자리에서 ‘추천받아 초대’를 눌러 보세요.</div>' :
      Object.entries(groups).map(([sid, list]) => {
        const s = RDTeam.slotById(p, sid);
        const rows = list.map(q => {
          const pr = prof(joinerId(q)) || { name: joinerName(q), userId: joinerId(q) };
          const m = RDMatch.compare(RDTeam.seekerOf(p, profiles, s ? [s.tag] : undefined), pr);
          return { q, pr, m, fit: s ? RDTeam.slotFits([s], pr)[0] : null };
        });
        const best = Math.max(...rows.map(r => r.m.total));
        const cell = fn => rows.map(r => `<td>${fn(r)}</td>`).join('');
        return `<div class="cmp-slot"><h3>${s ? `${e(s.tag)} <span class="mute">${LEVELS[s.level]} 이상 · ${e(s.role || '')}</span>` : '자리 미지정'}<span class="chip">${rows.length}명</span></h3>
          <div class="cmp-wrap"><table class="cmp">
            <tr><th>지원자</th>${cell(r => `<div class="who">${RD.avatar(r.pr.name, r.pr.userId, 30)}<div><b>${e(r.pr.name)}</b><div>${RDProfileView.badges(r.pr)}</div></div></div>
              <div class="mute" style="margin-top:4px">${r.q.kind === 'apply' ? '참여 요청' : `초대 (${e(r.q.fromName)})`} · ${ST[r.q.status]}</div>`)}</tr>
            <tr><th>매칭 점수</th>${cell(r => `<span class="score ${r.m.total === best && rows.length > 1 ? 'best' : ''}">${r.m.total}</span><span class="mute">/100</span>`)}</tr>
            <tr><th>카테고리 6개</th>${cell(r => r.m.parts.map(x => `<div class="mini"><span>${x.no} ${e(x.label)}</span><span class="t"><i style="width:${x.score}%;${x.score < 50 ? 'background:var(--warn)' : ''}"></i></span><b>${x.score}</b></div>`).join(''))}</tr>
            <tr><th>이 자리 역량</th>${cell(r => r.fit ? `<span class="fit ${r.fit.cls}">${e(r.fit.text)}</span>` : '—')}</tr>
            <tr><th>기여 내용</th>${cell(r => e((r.q.intent || {}).contribution || (r.q.kind === 'invite' && r.q.status === 'req' ? '수락할 때 작성해요' : '—')))}</tr>
            <tr><th>시간 · 기간</th>${cell(r => e([(r.q.intent || {}).hours, (r.q.intent || {}).period].filter(Boolean).join(' · ') || '—'))}</tr>
            <tr><th>동기 · 계획</th>${cell(r => e((r.q.intent || {}).motivation || '—'))}</tr>
            <tr><th>경험</th>${cell(r => { const x = r.pr.exp || {}; return `논문 ${+x.papers || 0} · 학회 ${+x.talks || 0} · 프로젝트 ${+x.projects || 0}`; })}</tr>
            <tr><th>처리</th>${cell(r => (r.q.kind === 'apply' && r.q.status === 'req')
              ? `<div class="acts"><button class="btn grn sm" data-acc="${e(r.q.id)}">수락</button><button class="btn sm" data-rej="${e(r.q.id)}">거절</button></div>`
              : `<a class="btn sm" href="connect.html">③에서 진행 →</a>`)}</tr>
          </table></div></div>`;
      }).join('')}`;
    box.querySelectorAll('[data-acc]').forEach(b => {
      b.onclick = async () => {
        b.classList.add('busy');
        try { await RD.api('updateRequest', { id: b.dataset.acc, patch: { status: 'acc', reply: '지원 감사해요! 커피챗에서 이야기해요' } }); RD.toast('수락했어요. ③에서 커피챗 일정을 조율하세요'); await load(true); }
        catch (ex) { RD.toast(ex.message); b.classList.remove('busy'); }
      };
    });
    box.querySelectorAll('[data-rej]').forEach(b => { b.onclick = () => rejectModal(b.dataset.rej); });
  }
  function rejectModal(qid) {
    const q = requests.find(x => x.id === qid);
    const modal = RD.openModal(`<h3 class="m-title">${e(q.fromName)}님의 참여 요청 거절</h3>
      <p class="m-sub">사유는 ${e(q.fromName)}님 화면에 표시돼요.</p>
      <div class="field"><label>거절 이유</label><select id="rr">${REJECT_REASONS.map(r => `<option>${r}</option>`).join('')}</select></div>
      <div class="field"><label>남길 말 <small>직접 작성</small></label><textarea id="rn" rows="2" placeholder="예) 이번 자리는 통계 경험이 더 많은 분이 필요해요. 다음 기회에 함께해요!"></textarea></div>
      <div class="row-end"><span></span><button class="btn dark" id="rs">거절 보내기</button></div>`);
    modal.querySelector('#rs').onclick = async ev => {
      ev.target.classList.add('busy');
      try { await RD.api('updateRequest', { id: qid, patch: { status: 'rej', endReason: modal.querySelector('#rr').value, endMemo: modal.querySelector('#rn').value.trim() } });
        RD.closeModal(); RD.toast('거절과 사유를 보냈어요'); await load(true); }
      catch (ex) { RD.toast(ex.message); ev.target.classList.remove('busy'); }
    };
  }

  /* ---------- 완료 후 후기 ---------- */
  function drawReviews() {
    const box = $('#reviewsCard');
    if (!member || p.status !== '완료') { box.classList.add('hide'); return; }
    box.classList.remove('hide');
    const got = reviews.filter(r => r.toId === me.id);
    const gotKw = {};
    got.forEach(r => r.keywords.forEach(k => { gotKw[k] = (gotKw[k] || 0) + 1; }));
    box.innerHTML = `<div class="card-h"><h2>협업 후기</h2><span class="mute">남긴 후기는 상대 프로필의 활동 기록에 쌓여요</span></div>
      ${people().filter(m => m.userId !== me.id).map(m => {
        const mine = reviews.find(r => r.fromId === me.id && r.toId === m.userId) || { keywords: [], memo: '' };
        return `<div class="rv" data-to="${e(m.userId)}">
          <div class="rv-h">${RD.avatar(m.name, m.userId, 30)}<b>${e(m.name)}</b>${mine.time ? `<span class="chip g">남김 · ${e(mine.time)}</span>` : ''}</div>
          <div class="kwsel">${REVIEW_KEYWORDS.map(k => `<button type="button" class="${mine.keywords.includes(k) ? 'on' : ''}">${e(k)}</button>`).join('')}</div>
          <div class="row-end"><input type="text" class="rv-memo" value="${e(mine.memo)}" placeholder="한 줄 후기 (선택)"><button class="btn grn sm" data-rv>저장</button></div>
        </div>`;
      }).join('')}
      <div class="rv-got"><b>내가 받은 후기</b> ${Object.keys(gotKw).length ? Object.entries(gotKw).map(([k, n]) => `“${e(k)}”${n > 1 ? ' ×' + n : ''}`).join(' · ') : '아직 없어요'}</div>`;
    box.querySelectorAll('.kwsel button').forEach(b => { b.onclick = () => b.classList.toggle('on'); });
    box.querySelectorAll('[data-rv]').forEach(b => {
      b.onclick = async () => {
        const rv = b.closest('.rv');
        const kws = [...rv.querySelectorAll('.kwsel button.on')].map(x => x.textContent);
        if (!kws.length) { RD.toast('키워드를 1개 이상 골라 주세요'); return; }
        b.classList.add('busy');
        try { await RD.api('saveReview', { projectId: p.id, toId: rv.dataset.to, keywords: kws, memo: rv.querySelector('.rv-memo').value.trim() });
          RD.toast('후기를 남겼어요'); reviews = (await RD.api('listReviews', { projectId: p.id })).reviews; drawReviews(); }
        catch (ex) { RD.toast(ex.message); b.classList.remove('busy'); }
      };
    });
  }

  /* ---------- 팀 메시지 ---------- */
  function drawChatLink() {
    const box = $('#chatLink');
    if (!member) { box.innerHTML = ''; return; }
    const safe = /^https?:\/\//i.test(p.chatLink || '');
    box.innerHTML = `${safe ? `<a class="clink" href="${e(p.chatLink)}" target="_blank" rel="noopener">💬 오픈채팅방 열기</a>` : ''}
      <details style="margin-top:6px"><summary class="mute" style="cursor:pointer">${safe ? '오픈채팅 링크 바꾸기' : '오픈채팅 링크 등록'}</summary>
        <div class="clink-edit" style="margin-top:6px"><input type="text" id="clIn" value="${e(p.chatLink || '')}" placeholder="https://open.kakao.com/..."><button class="btn sm" id="clSave">저장</button></div></details>`;
    $('#clSave').onclick = () => {
      const v = $('#clIn').value.trim();
      if (v && !/^https?:\/\//i.test(v)) { RD.toast('https:// 로 시작하는 링크를 넣어 주세요'); return; }
      save({ chatLink: v }, '오픈채팅 링크를 저장했어요');
    };
  }
  function drawMsgs() {
    const box = $('#msgs');
    if (!member) { $('#chatCard').classList.add('hide'); return; }
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    box.innerHTML = messages.length ? messages.map(m => `<div class="msg ${m.userId === me.id ? 'mine' : ''}">
      ${m.userId === me.id ? '' : RD.avatar(m.name, m.userId, 28)}
      <div><div class="meta">${m.userId === me.id ? '' : e(m.name) + ' · '}${e(m.time.slice(5))}</div><div class="bub">${e(m.text)}</div></div></div>`).join('')
      : '<div class="empty" style="margin:auto 0">첫 메시지를 남겨 보세요. 역할 분담, 다음 할 일 등을 적어두면 좋아요.</div>';
    if (nearBottom || !box.dataset.init) { box.scrollTop = box.scrollHeight; box.dataset.init = '1'; }
  }
  $('#msgForm').onsubmit = async ev => {
    ev.preventDefault();
    const t = $('#msgText').value.trim();
    if (!t) return;
    const btn = ev.target.querySelector('button');
    btn.classList.add('busy');
    try {
      await RD.api('sendMessage', { projectId: p.id, text: t });
      $('#msgText').value = '';
      messages = (await RD.api('listMessages', { projectId: p.id })).messages;
      drawMsgs(); $('#msgs').scrollTop = $('#msgs').scrollHeight;
    } catch (ex) { RD.toast(ex.message); }
    btn.classList.remove('busy');
  };
  $('#msgText').addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); $('#msgForm').requestSubmit(); }
  });

  function drawAll() {
    member = RDTeam.isMember(p, me.id); owner = p.ownerId === me.id;
    document.title = `${p.title} · 팀 공간`;
    drawHead(); drawSlots(); drawMembers(); drawApplicants(); drawReviews(); drawChatLink(); drawMsgs();
  }

  async function load(quiet) {
    if (!quiet) RD.loading($('#head'), '팀 공간을 불러오는 중…');
    try {
      const [pj, pr, rq] = await Promise.all([RD.api('listProjects'), RD.api('listProfiles'), RD.api('listRequests')]);
      profiles = pr.profiles; requests = rq.requests;
      p = pj.projects.find(x => x.id === id);
      if (!p) {
        $('#head').innerHTML = '<div class="empty"><b>볼 수 없는 팀이에요</b>비공개 프로젝트이거나 삭제됐을 수 있어요.<br><a class="btn sm" href="connect.html">③ 요청·팀으로</a></div>';
        $('#body').classList.add('hide');
        return;
      }
      if (RDTeam.isMember(p, me.id)) {
        const calls = [RD.api('listMessages', { projectId: p.id })];
        if (p.status === '완료') calls.push(RD.api('listReviews', { projectId: p.id }));
        const [ms, rv] = await Promise.all(calls);
        messages = ms.messages; reviews = rv ? rv.reviews : [];
      }
      drawAll();
      if (!quiet && location.hash) { const t = document.querySelector(location.hash); if (t) setTimeout(() => t.scrollIntoView({ behavior: 'smooth' }), 100); }
    } catch (ex) { RD.errorBox($('#head'), ex); }
  }

  load();
  /* 메시지는 8초마다, 나머지는 60초마다 새로고침 */
  setInterval(async () => {
    if (!p || !member || document.hidden) return;
    try { messages = (await RD.api('listMessages', { projectId: p.id })).messages; drawMsgs(); $('#chatState').textContent = '실시간 새로고침 중'; } catch (x) {}
  }, 8000);
  setInterval(() => {
    const typing = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if (p && !document.hidden && !typing && !document.querySelector('.modal-bg')) load(true);
  }, 60000);
})();
