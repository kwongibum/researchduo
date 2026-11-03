/* =========================================================
   기능 3 · 요청·커피챗·그룹 (connect.js)
   - ② 매칭이 만든 요청(RD.store.getRequests)을 읽어서 단계를 진행시켜요.
   - 상태: req(요청됨) → acc(수락) → chat(커피챗 예정) → group(그룹 결성)
           req → rej(거절) / chat → end(커피챗 후 종료)
   ========================================================= */
(() => {
  const $ = s => document.querySelector(s);
  const e = s => RD.esc(s);

  const PERIODS = ['1회 자문', '2주 단기 협업', '한 달', '한 학기'];
  const AUTHORS = ['공동 1저자', '2저자 이하 공동저자', '감사의 글', '해당 없음 (자문)'];
  const END_REASONS = ['역량이 기대와 달랐어요', '목표 성과가 달랐어요', '시간·일정이 안 맞았어요', '협업 방식이 안 맞았어요', '기타'];
  const TIMES = ['10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '19:00', '20:00'];
  const STEPS = [['req', '요청'], ['acc', '수락'], ['chat', '커피챗'], ['group', '그룹 결성']];

  const me = RD.store.getProfile();
  const myName = (me && me.name) || '나';

  function inDays(n) {
    const d = new Date(); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  const opt = (list, sel) => list.map(v => `<option ${v === sel ? 'selected' : ''}>${e(v)}</option>`).join('');

  function progress(status) {
    const idx = STEPS.findIndex(s => s[0] === status);
    return `<div class="prog">${STEPS.map(([k, l], i) => `
      ${i ? `<span class="ln ${i <= idx ? 'done' : ''}"></span>` : ''}
      <span class="p ${i < idx || status === 'group' ? 'done' : i === idx ? 'now' : ''}"><i>${i < idx || status === 'group' ? '✓' : i + 1}</i><span>${l}</span></span>`).join('')}</div>`;
  }

  function head(q) {
    const dirChip = q.dir === 'cast' ? '<span class="chip b">내가 캐스팅</span>' : '<span class="chip g">내가 참여 요청</span>';
    return `<div class="rq-top">
      ${RD.avatar(q.who.name, q.who.id, 42)}
      <div class="rq-who"><b>${e(q.who.name)}</b><div class="sub">${e(q.who.dept)}</div></div>
      <div class="rq-meta">${dirChip}<span class="chip">${e(q.slot.tag)} · ${e(q.slot.role)}</span>${q.score != null ? `<span class="chip d">${q.score}점</span>` : ''}</div>
    </div>
    <div class="rq-proj">프로젝트 · <b>${e(q.project.title)}</b></div>`;
  }

  function body(q) {
    if (q.status === 'req') {
      return `<div class="rq-body">
        <div class="sim">상대방 응답 시뮬레이션</div>
        <div class="btns"><button class="btn grn sm" data-act="accept">상대가 수락함</button><button class="btn sm" data-act="reject">상대가 거절함</button></div>
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
        <div class="chat-info"><b>커피챗 예정</b> ${e(c.date)} ${e(c.time)} · ${e(c.mode)} · 30분</div>
        <div class="agree-h">협업 합의서 <span class="mute">커피챗에서 정한 내용을 기록해요</span></div>
        <div class="grid3">
          <div><span class="lbl">맡을 역할</span><input type="text" class="a-role" value="${e(q.slot.tag + ' · ' + q.slot.role)}"></div>
          <div><span class="lbl">협업 기간</span><select class="a-period">${opt(PERIODS, '2주 단기 협업')}</select></div>
          <div><span class="lbl">저자 순서</span><select class="a-author">${opt(AUTHORS, q.slot.role === '공동저자급 파트너' ? '공동 1저자' : '2저자 이하 공동저자')}</select></div>
        </div>
        <div class="btns"><button class="btn grn sm" data-act="group">합의하고 그룹 결성</button><button class="btn sm" data-act="showEnd">협업하지 않기</button></div>
        <div class="endbox hide">
          <div class="grid2">
            <div><span class="lbl">협업하지 않는 이유</span><select class="e-reason">${opt(END_REASONS)}</select></div>
            <div><span class="lbl">메모 <small>(선택)</small></span><input type="text" class="e-memo" placeholder="예) PyTorch는 기초 과제 수준이었음"></div>
          </div>
          <button class="btn dark sm" data-act="end">종료로 기록</button>
        </div>
      </div>`;
    }
    return '';
  }

  function draw() {
    const all = RD.store.getRequests();
    const active = all.filter(q => ['req', 'acc', 'chat'].includes(q.status));
    const groups = all.filter(q => q.status === 'group');
    const ended = all.filter(q => ['rej', 'end'].includes(q.status));
    const groupTitles = [...new Set(groups.map(q => q.project.title))];

    $('#stats').innerHTML = [
      [active.filter(q => q.status !== 'chat').length, '응답·일정 대기'],
      [active.filter(q => q.status === 'chat').length, '커피챗 예정'],
      [groupTitles.length, '결성된 연구 그룹'],
      [ended.length, '종료된 매칭'],
    ].map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('');

    /* 진행 중 */
    $('#active').innerHTML = active.length
      ? active.map(q => `<div class="rq" data-id="${q.id}">${head(q)}${progress(q.status)}${body(q)}</div>`).join('')
      : `<div class="empty"><b>진행 중인 요청이 없어요</b>② 매칭에서 연구자에게 협업 요청을 보내거나, 나에게 맞는 프로젝트에 참여 요청을 보내 보세요.<br>
         <a class="btn pri" href="../matching/matching.html">② 프로젝트 개설·매칭으로</a></div>`;

    /* 그룹 */
    $('#groups').innerHTML = groupTitles.length ? groupTitles.map(title => {
      const ms = groups.filter(q => q.project.title === title);
      const mine = ms.some(q => q.dir === 'cast');
      const lead = mine
        ? { name: myName, role: '프로젝트 개설자', period: '—', author: '—', seed: 'me' }
        : { name: ms[0].who.name, role: '프로젝트 개설자', period: '—', author: '—', seed: ms[0].who.id };
      const rows = [lead, ...ms.map(q => mine
        ? { name: q.who.name, role: q.agree.role, period: q.agree.period, author: q.agree.author, seed: q.who.id }
        : { name: myName, role: q.agree.role, period: q.agree.period, author: q.agree.author, seed: 'me' })];
      return `<div class="grp">
        <div class="grp-h"><div><span class="chip g">Research Group · ${rows.length}명</span><h3>${e(title)}</h3></div>
          ${mine ? '<a class="btn sm" href="../matching/matching.html?add=1">필요 역량 추가 → 재매칭</a>' : ''}</div>
        <div class="members">
          <div class="mem mem-head"><span></span><span>이름</span><span>맡을 역할</span><span class="hide-s">기간</span><span class="hide-s">저자 순서</span></div>
          ${rows.map(r => `<div class="mem">${RD.avatar(r.name, r.seed, 32)}<b>${e(r.name)}</b><span>${e(r.role)}</span><span class="hide-s">${e(r.period)}</span><span class="hide-s">${e(r.author)}</span></div>`).join('')}
        </div>
      </div>`;
    }).join('') : '<div class="empty">아직 결성된 그룹이 없어요. 커피챗 후 합의서를 작성하면 여기에 나타나요.</div>';

    /* 종료 */
    if (ended.length) {
      const tally = {};
      ended.forEach(q => { const k = q.status === 'rej' ? '요청 거절' : q.endReason; tally[k] = (tally[k] || 0) + 1; });
      const max = Math.max(...Object.values(tally));
      $('#ended').innerHTML = `<div class="tally"><b>사유별 집계</b>${Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, n]) =>
        `<div class="tally-r"><span>${e(k)}</span><span class="t"><i style="width:${(n / max) * 100}%"></i></span><b>${n}</b></div>`).join('')}</div>` +
        ended.map(q => `<div class="end">${RD.avatar(q.who.name, q.who.id, 30)}<b>${e(q.who.name)}</b><span class="mute">${e(q.slot.tag)} · ${e(q.project.title)}</span>
          <span class="why">${q.status === 'rej' ? '요청 거절' : e(q.endReason)}</span>${q.endMemo ? `<span class="memo">메모: ${e(q.endMemo)}</span>` : ''}</div>`).join('');
    } else {
      $('#ended').innerHTML = '<div class="empty">종료된 매칭이 없어요.</div>';
    }
  }

  /* 버튼 동작 */
  $('#active').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const card = b.closest('.rq');
    const id = card.dataset.id;
    const q = RD.store.getRequests().find(x => x.id === id);
    if (!q) return;
    const act = b.dataset.act;
    if (act === 'accept') { RD.store.updateRequest(id, { status: 'acc' }); RD.toast(`${q.who.name}님이 수락했어요 · 커피챗을 잡아 보세요`); }
    if (act === 'reject') { RD.store.updateRequest(id, { status: 'rej' }); RD.toast('거절된 요청으로 기록했어요'); }
    if (act === 'chat') {
      const date = card.querySelector('.c-date').value;
      if (!date) { RD.toast('날짜를 골라 주세요'); return; }
      RD.store.updateRequest(id, { status: 'chat', chat: { date, time: card.querySelector('.c-time').value, mode: card.querySelector('.c-mode').value } });
      RD.toast('커피챗 일정을 확정했어요');
    }
    if (act === 'showEnd') { card.querySelector('.endbox').classList.toggle('hide'); return; }
    if (act === 'group') {
      RD.store.updateRequest(id, { status: 'group', agree: {
        role: card.querySelector('.a-role').value.trim() || q.slot.tag,
        period: card.querySelector('.a-period').value,
        author: card.querySelector('.a-author').value } });
      RD.toast('연구 그룹이 결성됐어요');
    }
    if (act === 'end') {
      RD.store.updateRequest(id, { status: 'end', endReason: card.querySelector('.e-reason').value, endMemo: card.querySelector('.e-memo').value.trim() });
      RD.toast('종료 사유를 기록했어요');
    }
    draw();
  });

  draw();
})();
