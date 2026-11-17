/* =========================================================
   기능 3 · 요청·커피챗·팀 (connect.js)  v0.3
   - 요청 종류: invite(팀원이 연구자를 팀에 초대) / apply(공개 프로젝트에 참여 요청)
   - 상태: req(요청) → acc(수락) → chat(커피챗 확정) → group(팀 합류)
           req → rej(거절, 사유 직접 작성) / chat → end(협업하지 않기)
   - 수락: 초대받은 사람은 기여 의향서를 쓰고 수락 / 참여 요청은 팀원 누구나 수락·거절
   - 커피챗: 한쪽이 후보 일정 2~3개 제안 → 상대가 고르거나 역제안 → 고르면 확정 (양방향)
   ========================================================= */
(() => {
  const me = RD.requireLogin();
  if (!me) return;
  const $ = s => document.querySelector(s);
  const e = s => RD.esc(s);

  const AUTHORS = ['공동 1저자', '2저자 이하 공동저자', '감사의 글', '해당 없음 (자문)'];
  const END_REASONS = ['역량이 기대와 달랐어요', '목표 성과가 달랐어요', '시간·일정이 안 맞았어요', '협업 방식이 안 맞았어요', '기타'];
  const TIMES = ['10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '19:00', '20:00'];
  const STEPS = [['req', '요청'], ['acc', '수락'], ['chat', '커피챗'], ['group', '팀 합류']];

  let requests = [], profiles = [], projects = [];
  const prof = id => profiles.find(p => p.userId === id);
  const proj = id => projects.find(p => p.id === id);
  const inDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const opt = (list, sel) => list.map(v => `<option ${v === sel ? 'selected' : ''}>${e(v)}</option>`).join('');

  /* 나는 이 요청에서 어느 쪽인가: 초대(보낸 쪽/받은 쪽) · 참여 요청(지원자/팀) */
  function side(q, uid = me.id) {
    if (q.kind === 'apply') return uid === q.fromId ? 'applicant' : 'team';
    return uid === q.fromId ? 'sender' : 'receiver';
  }
  const receiving = q => ['receiver', 'team'].includes(side(q));
  function other(q) {
    const s = side(q);
    if (s === 'applicant') return { id: q.toId, name: q.toName, team: true };
    if (s === 'sender') return { id: q.toId, name: q.toName };
    return { id: q.fromId, name: q.fromName };
  }

  function progress(status) {
    const idx = STEPS.findIndex(s => s[0] === status);
    return `<div class="prog">${STEPS.map(([k, l], i) => `
      ${i ? `<span class="ln ${i <= idx ? 'done' : ''}"></span>` : ''}
      <span class="p ${i < idx || status === 'group' ? 'done' : i === idx ? 'now' : ''}"><i>${i < idx || status === 'group' ? '✓' : i + 1}</i><span>${l}</span></span>`).join('')}</div>`;
  }

  function head(q) {
    const o = other(q), p = prof(o.id), pj = proj(q.projectId);
    const sub = p ? [p.dept, p.degree].filter(Boolean).join(' · ') : '';
    const kind = q.kind === 'apply' ? '참여 요청' : q.kind === 'invite' ? '팀 초대' : '협업 요청';
    const members = pj ? 1 + (pj.members || []).length : null;
    const teamLine = q.projectId
      ? `<div class="rq-team">→ <b>${e(q.projectTitle)}</b> 팀${members ? ` · 기존 팀 ${members}명에 합류` : ''}${pj && RDTeam.isMember(pj, me.id) ? ` · <a href="team.html?id=${encodeURIComponent(pj.id)}">팀 공간</a>` : ''}</div>`
      : '<div class="rq-team">→ 대상 팀 없음 (v0.2 요청 · 합류하면 새 팀이 만들어져요)</div>';
    return `<div class="rq-top">
      ${RD.avatar(o.name, o.id, 42)}
      <div class="rq-who"><b>${e(o.name)}</b>${p ? RDProfileView.badges(p) : ''}<div class="sub">${e(o.team ? '프로젝트 개설자' : sub)}</div></div>
      <div class="rq-meta"><span class="chip ${receiving(q) ? 'g' : 'b'}">${receiving(q) ? '받음' : '보냄'} · ${kind}</span>
        ${q.role ? `<span class="chip">${e(q.role)}</span>` : ''}${q.score != null ? `<span class="chip d">매칭 ${e(q.score)}점</span>` : ''}
        ${p ? `<button class="linkbtn" data-view="${e(o.id)}">프로필</button>` : ''}</div>
    </div>
    ${teamLine}
    ${q.message ? `<div class="rq-msg">“${e(q.message)}”<span>${e(q.fromName)} · ${e(q.created || '')}</span></div>` : ''}
    ${RDTeam.intentView(q.intent, pj)}
    ${q.reply ? `<div class="rq-msg reply">“${e(q.reply)}”<span>${e(q.kind === 'apply' ? (q.updatedBy || '팀') : q.toName)}의 답장</span></div>` : ''}`;
  }

  function rejectBox() {
    return `<div class="endbox hide">
      <div class="grid2">
        <div><span class="lbl">거절 이유</span><select class="r-reason">${opt(REJECT_REASONS)}</select></div>
        <div><span class="lbl">상대에게 남길 말 <small>직접 작성</small></span><input type="text" class="r-note" placeholder="예) 이번 학기는 어렵지만 다음 학기엔 함께하고 싶어요"></div>
      </div>
      <button class="btn dark sm" data-act="reject">거절 보내기</button>
    </div>`;
  }

  function proposeForm(hidden) {
    return `<div class="propose ${hidden ? 'hide' : ''}">
      <div class="prop-rows">${[3, 4].map(d => propRow(inDays(d))).join('')}</div>
      <div class="btns"><button class="btn sm" data-act="addProp">+ 후보 추가</button><button class="btn pri sm" data-act="propose">후보 일정 보내기</button></div>
    </div>`;
  }
  function propRow(date) {
    return `<div class="grid3 prop-row">
      <div><span class="lbl">날짜</span><input type="date" class="c-date" value="${date}"></div>
      <div><span class="lbl">시간</span><select class="c-time">${opt(TIMES, '15:00')}</select></div>
      <div><span class="lbl">방식</span><select class="c-mode">${opt(['온라인', '오프라인'], '온라인')}</select></div></div>`;
  }

  function body(q) {
    const s = side(q);
    const pj = proj(q.projectId);
    if (q.status === 'req') {
      if (s === 'sender' || s === 'applicant') return `<div class="rq-body"><div class="wait"><span class="spin"></span>${e(other(q).name)}${s === 'applicant' ? ' 팀' : '님'}의 응답을 기다리고 있어요</div></div>`;
      if (s === 'receiver') {
        const slots = pj ? (pj.slots || []).filter(x => x.tag && (!x.filledBy || x.id === q.slotId)) : [];
        return `<div class="rq-body">
          ${RDTeam.intentForm(slots, { slotId: q.slotId })}
          <div class="field"><span class="lbl">답장 <small>선택</small></span><input type="text" class="r-reply" placeholder="예) 좋아요! 커피챗에서 이야기해요"></div>
          <div class="btns"><button class="btn grn sm" data-act="accept">기여 의향서 보내고 수락</button><button class="btn sm" data-act="showRej">거절하기</button></div>
          ${rejectBox()}
        </div>`;
      }
      return `<div class="rq-body">
        <div class="field"><span class="lbl">답장 <small>선택</small></span><input type="text" class="r-reply" placeholder="예) 지원 감사해요! 커피챗에서 이야기해요"></div>
        <div class="btns"><button class="btn grn sm" data-act="accept">팀으로 수락</button><button class="btn sm" data-act="showRej">거절하기</button>
          ${pj ? `<a class="btn sm" href="team.html?id=${encodeURIComponent(pj.id)}#applicants">다른 지원자와 비교</a>` : ''}</div>
        ${rejectBox()}
      </div>`;
    }
    if (q.status === 'acc') {
      const c = q.chat || {}, props = c.proposals || [];
      if (!props.length) {
        return `<div class="rq-body"><div class="agree-h">Coffee Chat 후보 일정 제안 <span class="mute">2~3개를 보내면 상대가 하나를 고르거나 다른 시간을 제안해요</span></div>${proposeForm(false)}</div>`;
      }
      const mineProposed = c.proposedSide === s || (s === 'team' && c.proposedSide === 'team') || c.proposedBy === me.id;
      const list = props.map((x, i) => `<label class="prop"><input type="radio" name="pick-${e(q.id)}" value="${i}" ${i === 0 ? 'checked' : ''} ${mineProposed ? 'disabled' : ''}>
        <b>${e(x.date)}</b> ${e(x.time)} · ${e(x.mode)}</label>`).join('');
      if (mineProposed) {
        return `<div class="rq-body"><div class="agree-h">보낸 후보 일정 <span class="mute">${e(c.proposedByName || '')} 제안 · 상대가 고르는 중</span></div>
          <div class="props">${list}</div><div class="wait" style="margin:8px 0"><span class="spin"></span>상대가 일정을 고르면 확정돼요</div>
          <button class="linkbtn" data-act="showProp">다시 제안하기</button>${proposeForm(true)}</div>`;
      }
      return `<div class="rq-body"><div class="agree-h">${e(c.proposedByName || '상대')}님이 ${c.counter ? '다른 시간을 다시 제안했어요' : '후보 일정을 보냈어요'} <span class="mute">하나를 고르면 확정돼요</span></div>
        <div class="props">${list}</div>
        <div class="btns"><button class="btn pri sm" data-act="confirm">이 시간으로 확정</button><button class="btn sm" data-act="showProp">다른 시간 제안</button></div>
        ${proposeForm(true)}</div>`;
    }
    if (q.status === 'chat') {
      const c = q.chat || {};
      const slots = pj ? (pj.slots || []).filter(x => x.tag && (!x.filledBy || x.id === (q.intent || {}).slotId || x.id === q.slotId)) : [];
      const defSlot = (q.intent || {}).slotId || q.slotId;
      const who = q.kind === 'apply' ? q.fromName : q.toName;
      return `<div class="rq-body">
        <div class="chat-info"><b>커피챗 확정</b> ${e(c.date)} ${e(c.time)} · ${e(c.mode)} · 30분 <span class="mute">(${e(c.proposedByName || '')} 제안 → ${e(c.confirmedByName || '')} 확정)</span></div>
        <div class="agree-h">협업 합의서 <span class="mute">커피챗에서 정한 내용을 기록하면 팀에 합류해요</span></div>
        <div class="grid2">
          ${slots.length ? `<div><span class="lbl">${e(who)}님의 자리</span><select class="a-slot">${slots.map(x => `<option value="${e(x.id)}" ${x.id === defSlot ? 'selected' : ''}>${e(x.tag)} · ${e(x.role || '')}</option>`).join('')}</select></div>` : ''}
          <div><span class="lbl">맡을 역할</span><input type="text" class="a-role" value="${e((q.intent || {}).contribution || q.role || '')}"></div>
        </div>
        <div class="grid2" style="margin-top:8px">
          <div><span class="lbl">협업 기간</span><select class="a-period">${opt(PERIODS, (q.intent || {}).period || '2주 단기 협업')}</select></div>
          <div><span class="lbl">저자 순서</span><select class="a-author">${opt(AUTHORS, '2저자 이하 공동저자')}</select></div>
        </div>
        <div class="btns" style="margin-top:12px"><button class="btn grn sm" data-act="group">합의하고 팀 합류</button><button class="btn sm" data-act="showEnd">협업하지 않기</button></div>
        <div class="endbox hide">
          <div class="grid2">
            <div><span class="lbl">협업하지 않는 이유</span><select class="e-reason">${opt(END_REASONS)}</select></div>
            <div><span class="lbl">메모 <small>직접 작성</small></span><input type="text" class="e-memo" placeholder="예) 통계는 기초 수준이었음"></div>
          </div>
          <button class="btn dark sm" data-act="end">종료로 기록</button>
        </div>
      </div>`;
    }
    return '';
  }

  const rq = q => `<div class="rq" data-id="${e(q.id)}">${head(q)}${progress(q.status)}${body(q)}</div>`;

  function draw() {
    const active = ['req', 'acc', 'chat'];
    const inbox = requests.filter(q => receiving(q) && active.includes(q.status));
    const sent = requests.filter(q => !receiving(q) && active.includes(q.status));
    const ended = requests.filter(q => ['rej', 'end'].includes(q.status));
    const teams = RDTeam.myTeams(projects, me.id);

    $('#stats').innerHTML = [
      [inbox.filter(q => q.status === 'req').length, '응답할 요청'],
      [requests.filter(q => q.status === 'acc' && (q.chat || {}).proposals && (q.chat.proposedSide !== side(q))).length, '고를 커피챗 일정'],
      [teams.filter(p => p.status !== '완료').length, '진행 중인 팀'],
      [ended.length, '종료된 요청'],
    ].map(([n, l], i) => `<div class="stat ${i < 2 && n ? 'hot' : ''}"><b>${n}</b><span>${l}</span></div>`).join('');

    $('#inbox').innerHTML = inbox.length ? inbox.map(rq).join('') : '<div class="empty">받은 요청이 없어요.</div>';
    $('#sent').innerHTML = sent.length ? sent.map(rq).join('')
      : `<div class="empty">보낸 요청이 없어요.<br><a class="btn pri sm" href="../matching/matching.html">② 나와 맞는 연구자 찾기</a></div>`;

    $('#teams').innerHTML = teams.length ? teams.map(p => {
      const open = RDTeam.openSlots(p).length;
      const newApps = requests.filter(q => q.projectId === p.id && q.kind === 'apply' && q.status === 'req').length;
      const people = [{ userId: p.ownerId, name: p.ownerName }, ...(p.members || [])];
      return `<a class="tcard" href="team.html?id=${encodeURIComponent(p.id)}">
        <div class="tc-top">${RDTeam.statusChip(p.status)}${RDTeam.visChip(p)}${newApps ? `<span class="chip w">새 지원자 ${newApps}</span>` : ''}</div>
        <h3>${e(p.title)}</h3>
        <div class="tc-ppl">${people.slice(0, 6).map(m => RD.avatar(m.name, m.userId, 26)).join('')}<span>${people.length}명 · 남은 자리 ${open}</span></div>
        <span class="tc-go">${p.ownerId === me.id ? '개설자' : '팀원'} · 팀 공간 열기 →</span>
      </a>`;
    }).join('') : `<div class="empty">아직 참여 중인 팀이 없어요.<br><a class="btn pri sm" href="../matching/project.html?new=1">② 프로젝트 팀 만들기</a></div>`;

    if (ended.length) {
      const tally = {};
      ended.forEach(q => { const k = (q.status === 'rej' ? '거절 · ' : '중단 · ') + (q.endReason || '사유 없음'); tally[k] = (tally[k] || 0) + 1; });
      const max = Math.max(...Object.values(tally));
      $('#ended').innerHTML = `<div class="tally"><b>사유별 집계</b>${Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, n]) =>
        `<div class="tally-r"><span>${e(k)}</span><span class="t"><i style="width:${(n / max) * 100}%"></i></span><b>${n}</b></div>`).join('')}</div>` +
        ended.map(q => { const o = other(q); return `<div class="end">${RD.avatar(o.name, o.id, 30)}<b>${e(o.name)}</b>
          <span class="mute">${e(q.projectTitle || '')}${q.role ? ' · ' + e(q.role) : ''}</span>
          <span class="why">${q.status === 'rej' ? '거절' : '중단'} · ${e(q.endReason || '')}</span>
          ${q.endMemo ? `<span class="memo">“${e(q.endMemo)}” — ${e(q.updatedBy || '')}</span>` : ''}</div>`; }).join('');
    } else {
      $('#ended').innerHTML = '<div class="empty">종료된 요청이 없어요.</div>';
    }

    document.querySelectorAll('[data-view]').forEach(b => {
      b.onclick = () => { const p = prof(b.dataset.view); if (p) RD.openModal(RDProfileView.render(p)); };
    });
  }

  /* ---------- 버튼 동작 → 시트에 반영 ---------- */
  document.querySelector('main').addEventListener('click', async ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const card = b.closest('.rq');
    if (!card) return;
    const q = requests.find(x => x.id === card.dataset.id);
    if (!q) return;
    const act = b.dataset.act;
    const val = sel => { const el = card.querySelector(sel); return el ? el.value.trim() : ''; };

    if (act === 'showRej' || act === 'showEnd') { card.querySelector('.endbox').classList.toggle('hide'); return; }
    if (act === 'showProp') { card.querySelector('.propose').classList.toggle('hide'); return; }
    if (act === 'addProp') {
      const rows = card.querySelector('.prop-rows');
      if (rows.children.length >= 3) { RD.toast('후보는 3개까지 보낼 수 있어요'); return; }
      rows.insertAdjacentHTML('beforeend', propRow(inDays(5)));
      return;
    }

    let patch = null, msg = '';
    if (act === 'accept') {
      if (side(q) === 'receiver') {
        const it = RDTeam.readIntent(card);
        if (!it.contribution) { RD.toast('기여 의향서에 기여하고 싶은 내용을 적어 주세요'); return; }
        patch = { status: 'acc', intent: it, reply: val('.r-reply') };
      } else patch = { status: 'acc', reply: val('.r-reply') };
      msg = '수락했어요. 커피챗 후보 일정을 보내 보세요';
    }
    if (act === 'reject') { patch = { status: 'rej', endReason: val('.r-reason'), endMemo: val('.r-note'), reply: val('.r-reply') }; msg = '거절과 사유를 보냈어요'; }
    if (act === 'propose') {
      const proposals = [...card.querySelectorAll('.propose:not(.hide) .prop-row')]
        .map(r => ({ date: r.querySelector('.c-date').value, time: r.querySelector('.c-time').value, mode: r.querySelector('.c-mode').value }))
        .filter(x => x.date);
      if (!proposals.length) { RD.toast('후보 일정을 1개 이상 골라 주세요'); return; }
      const prev = q.chat || {};
      patch = { chat: { proposals, proposedBy: me.id, proposedByName: me.name, proposedSide: side(q), counter: !!(prev.proposals && prev.proposals.length) } };
      msg = '후보 일정을 보냈어요. 상대가 고르면 확정돼요';
    }
    if (act === 'confirm') {
      const c = q.chat || {};
      const pick = card.querySelector(`input[name="pick-${CSS.escape(q.id)}"]:checked`);
      const x = (c.proposals || [])[pick ? +pick.value : 0];
      if (!x) return;
      patch = { status: 'chat', chat: { ...c, date: x.date, time: x.time, mode: x.mode, confirmedBy: me.id, confirmedByName: me.name } };
      msg = '커피챗 일정이 확정됐어요';
    }
    if (act === 'group') {
      patch = { status: 'group', agree: { slotId: val('.a-slot'), role: val('.a-role') || q.role, period: val('.a-period'), author: val('.a-author') } };
      msg = '팀 합류 완료! 팀 공간에서 함께 일해 보세요';
    }
    if (act === 'end') { patch = { status: 'end', endReason: val('.e-reason'), endMemo: val('.e-memo') }; msg = '종료 사유를 기록했어요'; }
    if (!patch) return;

    card.querySelectorAll('button').forEach(x => x.classList.add('busy'));
    try {
      await RD.api('updateRequest', { id: q.id, patch });
      RD.toast(msg);
      await load(true);
    } catch (ex) {
      RD.toast(ex.message);
      card.querySelectorAll('button').forEach(x => x.classList.remove('busy'));
    }
  });

  async function load(quiet) {
    if (!quiet) ['#inbox', '#sent', '#teams', '#ended'].forEach(s => RD.loading($(s)));
    try {
      const [rqs, pr, pj] = await Promise.all([RD.api('listRequests'), RD.api('listProfiles'), RD.api('listProjects')]);
      requests = rqs.requests.sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
      profiles = pr.profiles; projects = pj.projects;
      draw();
    } catch (ex) {
      RD.errorBox($('#inbox'), ex);
    }
  }

  $('#reload').onclick = () => load();
  load();
  setInterval(() => {
    const typing = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    const open = document.querySelector('.endbox:not(.hide)');
    if (!document.hidden && !typing && !open && !document.querySelector('.modal-bg')) load(true);
  }, 30000);
})();
