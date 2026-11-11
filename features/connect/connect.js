/* =========================================================
   기능 3 · 요청·커피챗·그룹 (connect.js)
   - RD.api('listRequests') 로 내가 보내거나 받은 요청을 시트에서 불러와요.
   - 상태: req(요청됨) → acc(수락) → chat(커피챗 예정) → group(그룹 결성)
           req → rej(거절) / chat → end(커피챗 후 종료)
   - 받은 사람만 수락·거절할 수 있고, 커피챗·합의서는 두 사람 모두 진행할 수 있어요.
   - 30초마다 자동으로 새로고침해서 상대방의 응답을 반영해요.
   ========================================================= */
(() => {
  const me = RD.requireLogin();
  if (!me) return;
  const $ = s => document.querySelector(s);
  const e = s => RD.esc(s);

  const PERIODS = ['1회 자문', '2주 단기 협업', '한 달', '한 학기'];
  const AUTHORS = ['공동 1저자', '2저자 이하 공동저자', '감사의 글', '해당 없음 (자문)'];
  const END_REASONS = ['역량이 기대와 달랐어요', '목표 성과가 달랐어요', '시간·일정이 안 맞았어요', '협업 방식이 안 맞았어요', '기타'];
  const REJ_REASONS = ['지금은 시간이 없어요', '연구 주제가 맞지 않아요', '요청한 역할을 하기 어려워요', '기타'];
  const TIMES = ['10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '19:00', '20:00'];
  const STEPS = [['req', '요청'], ['acc', '수락'], ['chat', '커피챗'], ['group', '그룹 결성']];

  let requests = [], profiles = [];

  const inDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const opt = (list, sel) => list.map(v => `<option ${v === sel ? 'selected' : ''}>${e(v)}</option>`).join('');
  const other = q => (q.fromId === me.id ? { id: q.toId, name: q.toName } : { id: q.fromId, name: q.fromName });
  const prof = id => profiles.find(p => p.userId === id);

  function progress(status) {
    const idx = STEPS.findIndex(s => s[0] === status);
    return `<div class="prog">${STEPS.map(([k, l], i) => `
      ${i ? `<span class="ln ${i <= idx ? 'done' : ''}"></span>` : ''}
      <span class="p ${i < idx || status === 'group' ? 'done' : i === idx ? 'now' : ''}"><i>${i < idx || status === 'group' ? '✓' : i + 1}</i><span>${l}</span></span>`).join('')}</div>`;
  }

  function head(q) {
    const o = other(q), p = prof(o.id);
    const sub = p ? [p.dept, p.degree].filter(Boolean).join(' · ') : '';
    return `<div class="rq-top">
      ${RD.avatar(o.name, o.id, 42)}
      <div class="rq-who"><b>${e(o.name)}</b><div class="sub">${e(sub)}</div></div>
      <div class="rq-meta"><span class="chip ${q.fromId === me.id ? 'b' : 'g'}">${q.fromId === me.id ? '내가 보냄' : '나에게 옴'}</span>
        ${q.kind === 'apply' ? '<span class="chip">프로젝트 참여 요청</span>' : q.kind === 'cast' ? '<span class="chip">프로젝트 초대</span>' : ''}
        <span class="chip">${e(q.role || '협업')}</span>${q.score != null ? `<span class="chip d">매칭 ${e(q.score)}점</span>` : ''}
        ${p ? `<button class="linkbtn" data-view="${e(o.id)}">프로필</button>` : ''}</div>
    </div>
    ${q.projectTitle ? `<div class="rq-proj">연구 주제 · <b>${e(q.projectTitle)}</b></div>` : ''}
    <div class="rq-msg">“${e(q.message)}”<span>${e(q.fromName)} · ${e(q.created || '')}</span></div>
    ${q.reply ? `<div class="rq-msg reply">“${e(q.reply)}”<span>${e(q.toName)}의 답장</span></div>` : ''}`;
  }

  function body(q) {
    const iAmReceiver = q.toId === me.id;
    if (q.status === 'req') {
      if (!iAmReceiver) return `<div class="rq-body"><div class="wait"><span class="spin"></span>${e(q.toName)}님의 응답을 기다리고 있어요</div></div>`;
      return `<div class="rq-body">
        <div class="field"><span class="lbl">답장 <small>선택</small></span><input type="text" class="r-reply" placeholder="예) 좋아요! 다음 주에 이야기해요"></div>
        <div class="btns"><button class="btn grn sm" data-act="accept">수락하기</button><button class="btn sm" data-act="showRej">거절하기</button></div>
        <div class="endbox hide">
          <span class="lbl">거절 이유 <small>상대에게 보여요</small></span>
          <select class="r-reason">${opt(REJ_REASONS)}</select>
          <button class="btn dark sm" data-act="reject" style="margin-top:8px">거절 보내기</button>
        </div>
      </div>`;
    }
    if (q.status === 'acc') {
      return `<div class="rq-body">
        <div class="agree-h">Coffee Chat 잡기 <span class="mute">30분 · 연구 방향·역할·일정 가볍게 조율</span></div>
        <div class="grid3">
          <div><span class="lbl">날짜</span><input type="date" class="c-date" value="${inDays(3)}"></div>
          <div><span class="lbl">시간</span><select class="c-time">${opt(TIMES, '15:00')}</select></div>
          <div><span class="lbl">방식</span><select class="c-mode">${opt(['온라인', '오프라인'], '온라인')}</select></div>
        </div>
        <button class="btn pri sm" data-act="chat">커피챗 확정</button>
      </div>`;
    }
    if (q.status === 'chat') {
      const c = q.chat || {};
      return `<div class="rq-body">
        <div class="chat-info"><b>커피챗 예정</b> ${e(c.date)} ${e(c.time)} · ${e(c.mode)} · 30분 ${q.updatedBy ? `<span class="mute">(${e(q.updatedBy)} 확정)</span>` : ''}</div>
        <div class="agree-h">협업 합의서 <span class="mute">커피챗에서 정한 내용을 기록해요</span></div>
        <div class="grid3">
          <div><span class="lbl">${e(q.kind === 'apply' ? q.fromName : q.toName)}님의 역할</span><input type="text" class="a-role" value="${e(q.role || '')}"></div>
          <div><span class="lbl">협업 기간</span><select class="a-period">${opt(PERIODS, '2주 단기 협업')}</select></div>
          <div><span class="lbl">저자 순서</span><select class="a-author">${opt(AUTHORS, q.role === '공동 연구자' ? '공동 1저자' : '2저자 이하 공동저자')}</select></div>
        </div>
        <div class="btns"><button class="btn grn sm" data-act="group">합의하고 그룹 결성</button><button class="btn sm" data-act="showEnd">협업하지 않기</button></div>
        <div class="endbox hide">
          <div class="grid2">
            <div><span class="lbl">협업하지 않는 이유</span><select class="e-reason">${opt(END_REASONS)}</select></div>
            <div><span class="lbl">메모 <small>선택</small></span><input type="text" class="e-memo" placeholder="예) 통계는 기초 수준이었음"></div>
          </div>
          <button class="btn dark sm" data-act="end">종료로 기록</button>
        </div>
      </div>`;
    }
    return '';
  }

  function rq(q) { return `<div class="rq" data-id="${e(q.id)}">${head(q)}${progress(q.status)}${body(q)}</div>`; }

  function draw() {
    const active = ['req', 'acc', 'chat'];
    const inbox = requests.filter(q => q.toId === me.id && active.includes(q.status));
    const sent = requests.filter(q => q.fromId === me.id && active.includes(q.status));
    const groups = requests.filter(q => q.status === 'group');
    const ended = requests.filter(q => ['rej', 'end'].includes(q.status));

    $('#stats').innerHTML = [
      [inbox.filter(q => q.status === 'req').length, '응답할 요청'],
      [requests.filter(q => q.status === 'chat').length, '커피챗 예정'],
      [groups.length, '함께하는 연구자'],
      [ended.length, '종료된 매칭'],
    ].map(([n, l], i) => `<div class="stat ${i === 0 && n ? 'hot' : ''}"><b>${n}</b><span>${l}</span></div>`).join('');

    $('#inbox').innerHTML = inbox.length ? inbox.map(rq).join('') : '<div class="empty">받은 요청이 없어요.</div>';
    $('#sent').innerHTML = sent.length ? sent.map(rq).join('')
      : `<div class="empty">보낸 요청이 없어요.<br><a class="btn pri sm" href="../matching/matching.html">② 나와 맞는 연구자 찾기</a></div>`;

    /* 그룹: 요청을 보낸 사람(개설자) + 연구 주제 기준으로 묶기 */
    const map = {};
    groups.forEach(q => {
      // 참여 요청(apply)은 받은 사람이 개설자, 나머지는 보낸 사람이 개설자
      const lead = q.kind === 'apply' ? { id: q.toId, name: q.toName } : { id: q.fromId, name: q.fromName };
      const mem = q.kind === 'apply' ? { id: q.fromId, name: q.fromName } : { id: q.toId, name: q.toName };
      const k = lead.id + '|' + (q.projectTitle || mem.id);
      (map[k] = map[k] || { title: q.projectTitle || `${lead.name} × ${mem.name} 공동 연구`, lead, ms: [] }).ms.push({ ...q, mem });
    });
    const gl = Object.values(map);
    $('#groups').innerHTML = gl.length ? gl.map(g => `<div class="grp">
        <div class="grp-h"><div><span class="chip g">Research Group · ${g.ms.length + 1}명</span><h3>${e(g.title)}</h3></div></div>
        <div class="members">
          <div class="mem mem-head"><span></span><span>이름</span><span>역할</span><span class="hide-s">기간</span><span class="hide-s">저자 순서</span></div>
          <div class="mem">${RD.avatar(g.lead.name, g.lead.id, 32)}<b>${e(g.lead.name)}${g.lead.id === me.id ? ' (나)' : ''}</b><span>${g.ms.some(q => q.projectId) ? '프로젝트 개설자' : '요청한 연구자'}</span><span class="hide-s">—</span><span class="hide-s">—</span></div>
          ${g.ms.map(q => `<div class="mem">${RD.avatar(q.mem.name, q.mem.id, 32)}<b>${e(q.mem.name)}${q.mem.id === me.id ? ' (나)' : ''}</b><span>${e((q.agree || {}).role || q.role)}</span><span class="hide-s">${e((q.agree || {}).period || '')}</span><span class="hide-s">${e((q.agree || {}).author || '')}</span></div>`).join('')}
        </div>
        ${g.lead.id === me.id ? `<p class="mute" style="margin-top:10px">새 전문성이 필요하면 <a href="../matching/project.html">② 프로젝트</a>에서 자리를 추가하고 다른 연구자를 초대하면 이 그룹에 추가돼요.</p>` : ''}
      </div>`).join('')
      : '<div class="empty">아직 결성된 그룹이 없어요. 커피챗 후 합의서를 작성하면 여기에 나타나요.</div>';

    if (ended.length) {
      const tally = {};
      ended.forEach(q => { const k = q.status === 'rej' ? `거절: ${q.endReason || '사유 없음'}` : q.endReason; tally[k] = (tally[k] || 0) + 1; });
      const max = Math.max(...Object.values(tally));
      $('#ended').innerHTML = `<div class="tally"><b>사유별 집계</b>${Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, n]) =>
        `<div class="tally-r"><span>${e(k)}</span><span class="t"><i style="width:${(n / max) * 100}%"></i></span><b>${n}</b></div>`).join('')}</div>` +
        ended.map(q => { const o = other(q); return `<div class="end">${RD.avatar(o.name, o.id, 30)}<b>${e(o.name)}</b><span class="mute">${e(q.role || '')}${q.projectTitle ? ' · ' + e(q.projectTitle) : ''}</span>
          <span class="why">${q.status === 'rej' ? '거절 · ' : ''}${e(q.endReason || '')}</span>${q.endMemo ? `<span class="memo">메모: ${e(q.endMemo)}</span>` : ''}</div>`; }).join('');
    } else {
      $('#ended').innerHTML = '<div class="empty">종료된 매칭이 없어요.</div>';
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
    const q = requests.find(x => x.id === card.dataset.id);
    if (!q) return;
    const act = b.dataset.act;
    if (act === 'showRej' || act === 'showEnd') { card.querySelector('.endbox').classList.toggle('hide'); return; }

    let patch = null, msg = '';
    if (act === 'accept') { patch = { status: 'acc', reply: card.querySelector('.r-reply').value.trim() }; msg = '수락했어요. 커피챗을 잡아 보세요'; }
    if (act === 'reject') { patch = { status: 'rej', endReason: card.querySelector('.r-reason').value, reply: card.querySelector('.r-reply').value.trim() }; msg = '거절을 보냈어요'; }
    if (act === 'chat') {
      const date = card.querySelector('.c-date').value;
      if (!date) { RD.toast('날짜를 골라 주세요'); return; }
      patch = { status: 'chat', chat: { date, time: card.querySelector('.c-time').value, mode: card.querySelector('.c-mode').value } };
      msg = '커피챗 일정을 확정했어요';
    }
    if (act === 'group') {
      patch = { status: 'group', agree: { role: card.querySelector('.a-role').value.trim() || q.role,
        period: card.querySelector('.a-period').value, author: card.querySelector('.a-author').value } };
      msg = '연구 그룹이 결성됐어요';
    }
    if (act === 'end') { patch = { status: 'end', endReason: card.querySelector('.e-reason').value, endMemo: card.querySelector('.e-memo').value.trim() }; msg = '종료 사유를 기록했어요'; }
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
    if (!quiet) ['#inbox', '#sent', '#groups', '#ended'].forEach(s => RD.loading($(s)));
    try {
      const [rq, pr] = await Promise.all([RD.api('listRequests'), RD.api('listProfiles')]);
      requests = rq.requests.sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
      profiles = pr.profiles;
      draw();
    } catch (ex) {
      RD.errorBox($('#inbox'), ex);
    }
  }

  $('#reload').onclick = () => load();
  load();
  /* 30초마다 조용히 새로고침 (입력 중이 아닐 때만) */
  setInterval(() => {
    const typing = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if (!document.hidden && !typing && !document.querySelector('.modal-bg')) load(true);
  }, 30000);
})();
