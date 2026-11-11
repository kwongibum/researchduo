/* =========================================================
   기능 2 · 매칭 화면 (matching.js)
   - 시트에서 모든 프로필을 불러와 engine.js + criteria/*.js 로 점수 계산
   - '협업 요청'을 누르면 RD.api('createRequest') → 상대방의 ③ 받은 요청함에 도착
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

  /* '중요' 표시는 이 브라우저에 기억 (개인 설정) */
  let weights = {};
  try { weights = JSON.parse(localStorage.getItem('rd_weights') || '{}'); } catch (x) { weights = {}; }
  const saveW = () => { try { localStorage.setItem('rd_weights', JSON.stringify(weights)); } catch (x) {} };

  let myProfile = null, profiles = [], requests = [];

  function drawCrit() {
    $('#crit').innerHTML = RDMatch.criteria().map(c => `
      <div class="crit-r"><span class="n">${c.no}</span>
        <div><b>${e(c.label)}</b><small>${e(RULES[c.key] || '')}</small></div>
        <button class="imp ${weights[c.key] === 2 ? 'on' : ''}" data-k="${c.key}">중요</button></div>`).join('');
    $('#crit').querySelectorAll('.imp').forEach(b => {
      b.onclick = () => {
        weights[b.dataset.k] = weights[b.dataset.k] === 2 ? 1 : 2;
        saveW(); drawCrit(); drawResults();
      };
    });
  }

  function drawMe() {
    const p = myProfile;
    $('#meCard').innerHTML = `<div class="me-h">${RD.avatar(me.name, me.id, 36)}<div><b>${e(me.name)}</b><span class="mute">내 프로필 기준으로 비교 중</span></div></div>
      <div class="me-sec"><b>관심</b>${e((p.topics || []).join(', ') || '—')}</div>
      <div class="me-sec"><b>필요한 역량</b>${e((p.needs || []).join(', ') || '—')}</div>
      <div class="me-sec"><b>목표</b>${e((p.goals || []).join(', ') || '—')}</div>
      <a class="btn sm" style="margin-top:12px" href="../profile/profile.html">프로필 수정</a>`;
  }

  function reqStatus(uid) {
    // 프로젝트 초대·참여 요청은 제외하고 개인 간 요청만
    const q = requests.find(r => !r.projectId && ((r.fromId === me.id && r.toId === uid) || (r.toId === me.id && r.fromId === uid)));
    return q ? q.status : null;
  }

  function bars(parts) {
    return `<div class="mc-bars">${parts.map(p => `
      <div><div class="mb-l ${p.weight > 1 ? 'x' : ''}"><span>${p.no} ${e(p.label)}</span><b>${p.score}</b></div>
      <div class="mb-t"><i class="${p.score < 50 ? 'low' : ''}" style="width:${p.score}%"></i></div></div>`).join('')}</div>`;
  }

  function card(m, i) {
    const o = m.other;
    const st = reqStatus(o.userId);
    const label = { req: '요청 중', acc: '수락됨', chat: '커피챗 예정', group: '같은 그룹', rej: '거절됨', end: '종료됨' }[st];
    const btn = st ? `<button class="btn sm done" disabled>${label}</button>`
      : m.available ? `<button class="btn pri sm" data-req="${e(o.userId)}">협업 요청</button>`
      : '<button class="btn sm" disabled>참여 어려움</button>';
    const good = m.parts.flatMap(p => p.good.map(g => `<li><i>${p.no}</i>${e(g)}</li>`));
    const warn = m.parts.flatMap(p => p.warn.map(w => `<li><i>${p.no}</i>${e(w)}</li>`));
    return `<div class="mc ${m.available ? '' : 'off'}">
      <div class="mc-top">
        <span class="mc-rank">${i + 1}</span>
        ${RD.avatar(o.name, o.userId, 44)}
        <div class="mc-who"><b>${e(o.name)}</b>${m.available ? '' : '<span class="chip">참여 어려움</span>'}
          <div class="sub">${e([o.dept, o.degree, o.semester].filter(Boolean).join(' · '))}</div></div>
        <div class="mc-score"><b>${m.total}</b><span>/100</span></div>
      </div>
      ${bars(m.parts)}
      <div class="mc-why"><ul class="ok">${good.join('')}</ul><ul class="wn">${warn.join('')}</ul></div>
      <div class="mc-act"><button class="btn sm" data-view="${e(o.userId)}">프로필 보기</button>${btn}</div>
    </div>`;
  }

  let ranked = [];
  function drawResults() {
    ranked = RDMatch.rank(myProfile, profiles, weights);
    const box = $('#results');
    if (!ranked.length) {
      box.innerHTML = `<div class="empty"><b>아직 비교할 다른 연구자가 없어요</b>팀원들이 회원가입하고 프로필을 저장하면 여기에 나타나요.</div>`;
      return;
    }
    box.innerHTML = `<div class="res-top"><h2>추천 연구자 ${ranked.length}명</h2><span class="mute">시트에 저장된 프로필 기준 · <button class="linkbtn" id="reload">새로고침</button></span></div>
      ${ranked.map(card).join('')}`;
    $('#reload').onclick = load;
    box.querySelectorAll('[data-view]').forEach(b => { b.onclick = () => view(b.dataset.view); });
    box.querySelectorAll('[data-req]').forEach(b => { b.onclick = () => requestModal(b.dataset.req); });
  }

  function view(uid) {
    const m = ranked.find(x => x.other.userId === uid);
    if (!m) return;
    const top = m.parts.slice().sort((a, b) => b.score - a.score).slice(0, 2).map(p => p.label).join(', ');
    const st = reqStatus(uid);
    const modal = RD.openModal(RDProfileView.render(m.other, {
      banner: `나와의 매칭 ${m.total}점`,
      reason: `${m.total}점 · 특히 잘 맞는 카테고리: <b>${e(top)}</b>`,
      actions: m.available && !st ? '<button class="btn pri sm" id="mReq">협업 요청</button>' : '',
    }));
    const b = modal.querySelector('#mReq');
    if (b) b.onclick = () => requestModal(uid);
  }

  function requestModal(uid) {
    const m = ranked.find(x => x.other.userId === uid);
    if (!m) return;
    const o = m.other;
    const modal = RD.openModal(`<h3 class="m-title">${e(o.name)}님에게 협업 요청</h3>
      <p class="m-sub">요청을 보내면 ${e(o.name)}님의 ③ 요청·그룹 화면에 바로 나타나요. 매칭 점수 ${m.total}점</p>
      <div class="field"><label>어떤 역할을 부탁하고 싶나요?</label><select id="qRole">${ROLES.map(r => `<option>${r}</option>`).join('')}</select></div>
      <div class="field"><label>연구 주제 <small>선택</small></label><input type="text" id="qTitle" placeholder="예) 생성형 AI 활용과 학습 효율"></div>
      <div class="field"><label>메시지</label><textarea id="qMsg" rows="3" placeholder="예) 설문 결과를 분석해 줄 분을 찾고 있어요. 30분 커피챗 가능할까요?"></textarea></div>
      <p class="hint err hide" id="qErr"></p>
      <div class="row-end"><span></span><button class="btn pri" id="qSend">요청 보내기</button></div>`);
    modal.querySelector('#qSend').onclick = async ev => {
      const btn = ev.target;
      const msg = modal.querySelector('#qMsg').value.trim();
      const err = modal.querySelector('#qErr');
      if (!msg) { err.textContent = '메시지를 적어 주세요'; err.classList.remove('hide'); return; }
      btn.classList.add('busy'); btn.textContent = '보내는 중…';
      try {
        await RD.api('createRequest', { request: {
          toId: o.userId, toName: o.name, role: modal.querySelector('#qRole').value,
          projectTitle: modal.querySelector('#qTitle').value.trim(), message: msg, score: m.total,
        } });
        RD.closeModal();
        RD.toast(`${o.name}님에게 요청을 보냈어요`);
        await load();
      } catch (ex) {
        err.textContent = ex.message; err.classList.remove('hide');
        btn.classList.remove('busy'); btn.textContent = '요청 보내기';
      }
    };
  }

  async function load() {
    RD.loading($('#results'), '팀원 프로필을 불러오는 중…');
    try {
      const [pr, rq] = await Promise.all([RD.api('listProfiles'), RD.api('listRequests')]);
      profiles = pr.profiles;
      requests = rq.requests;
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
