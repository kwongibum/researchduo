/* =========================================================
   연구해듀오 — 공통 모듈 (core/common.js)
   모든 페이지가 불러와요. 팀 전체가 같이 쓰므로 고칠 때는 팀에 먼저 알려주세요.

   ★ v0.2부터 데이터는 구글 스프레드시트(Apps Script)에 저장돼요.
     모듈에서는 직접 fetch 하지 말고 RD.api('요청이름', {...}) 를 쓰세요.

   서버 요청 목록 (자세한 내용은 apps-script/Code.gs)
   ┌────────────────┬──────────────────────────────┬──────────────┐
   │ 요청            │ 보내는 값                       │ 주로 쓰는 모듈  │
   ├────────────────┼──────────────────────────────┼──────────────┤
   │ signup / login │ name, username, password      │ 로그인(auth)   │
   │ saveProfile    │ profile                       │ ① 프로필       │
   │ listProfiles   │ -                             │ ① ② ③        │
   │ createRequest  │ request {toId, toName, ...}   │ ② 매칭        │
   │ listRequests   │ -                             │ ③ 연결        │
   │ updateRequest  │ id, patch {status, chat, ...} │ ③ 연결        │
   └────────────────┴──────────────────────────────┴──────────────┘
   ========================================================= */

const RD = (() => {
  /* ---- 버전 기록: 매주 고친 내용을 여기에 추가하세요 ---- */
  const VERSION = 'v0.2';
  const CHANGELOG = [
    { v: 'v0.2', date: '2026-11-10', items: [
      '로그인·회원가입 추가',
      '프로필을 구글 스프레드시트에 저장 → 다른 컴퓨터에서도 보임',
      '더미 연구자 18명 삭제, 팀원 실제 프로필로 매칭',
      '매칭 카테고리 6개(1인 1개 담당): 관심 주제 · 연구 역량 · 경험 · 학과·전공 · 목표 성과 · 협업 조건',
      '협업 요청이 상대방 화면에 실제로 도착 (받은 요청함, 수락·거절)',
    ] },
    { v: 'v0.1', date: '2026-11-03', items: [
      '핵심 기능 3개를 모듈로 분리해 첫 구현', '더미 연구자 18명 · 시나리오 테스트 모드', '테스트 메모 기능',
    ] },
  ];

  const root = document.body.dataset.root || './';
  const PAGES = [
    { key: 'home',     href: 'index.html',                      label: '홈' },
    { key: 'profile',  href: 'features/profile/profile.html',   label: '① 연구 프로필' },
    { key: 'matching', href: 'features/matching/matching.html', label: '② 매칭' },
    { key: 'connect',  href: 'features/connect/connect.html',   label: '③ 요청·그룹' },
  ];
  const url = href => root + href;

  /* ---------- 브라우저 저장 (로그인 상태, 테스트 메모만) ---------- */
  function load(k, fallback) {
    try { const v = localStorage.getItem('rd_' + k); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function save(k, v) {
    try { if (v === null) localStorage.removeItem('rd_' + k); else localStorage.setItem('rd_' + k, JSON.stringify(v)); } catch (e) {}
  }

  /* ---------- 로그인 상태 ---------- */
  const session = {
    get: () => load('session', null),              // { token, user: { id, username, name } }
    set: s => save('session', s),
    clear: () => save('session', null),
    user: () => (load('session', null) || {}).user || null,
  };

  /* ---------- 서버 요청 ---------- */
  async function api(action, payload = {}) {
    if (typeof API_URL === 'undefined' || !API_URL) {
      throw new Error('서버 주소가 설정되지 않았어요. core/config.js 의 API_URL을 확인해 주세요.');
    }
    const s = session.get();
    let res;
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action, token: s && s.token, ...payload }),
      });
    } catch (e) {
      throw new Error('서버에 연결하지 못했어요. 인터넷 연결이나 서버 주소를 확인해 주세요.');
    }
    let data;
    try { data = await res.json(); } catch (e) { throw new Error('서버 응답을 읽지 못했어요. Apps Script 배포 설정(모든 사용자)을 확인해 주세요.'); }
    if (!data.ok) {
      if (/로그인이 (필요|만료)/.test(data.error || '')) session.clear();
      throw new Error(data.error || '알 수 없는 오류가 발생했어요');
    }
    return data;
  }

  /* 로그인이 필요한 페이지에서 호출 — 안 되어 있으면 로그인 페이지로 */
  function requireLogin() {
    const u = session.user();
    if (!u) {
      location.href = url('features/auth/login.html') + '?next=' + encodeURIComponent(location.pathname + location.search);
      return null;
    }
    return u;
  }

  function logout() {
    session.clear();
    location.href = url('index.html');
  }

  /* ---------- 유틸 ---------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const COLORS = ['#2c5be6', '#0d9a74', '#171a26', '#7357d1', '#c2410c', '#0e7490'];
  function hash(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
  function avatar(name, seed, size = 40) {
    const c = COLORS[hash(seed || name) % COLORS.length];
    return `<span class="av" style="background:${c};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px">${esc((name || '?').trim()[0] || '?')}</span>`;
  }

  function toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* 영역에 '불러오는 중' / 오류 표시 */
  function loading(el, text = '불러오는 중…') { el.innerHTML = `<div class="loading"><span class="spin"></span>${esc(text)}</div>`; }
  function errorBox(el, err) {
    el.innerHTML = `<div class="empty err"><b>문제가 생겼어요</b>${esc(err.message || err)}<br><button class="btn sm" onclick="location.reload()">다시 시도</button></div>`;
  }

  function openModal(html) {
    closeModal();
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal" role="dialog"><button class="modal-x" aria-label="닫기">×</button>${html}</div>`;
    bg.addEventListener('click', e => { if (e.target === bg || e.target.classList.contains('modal-x')) closeModal(); });
    document.body.appendChild(bg);
    document.body.style.overflow = 'hidden';
    return bg.querySelector('.modal');
  }
  function closeModal() {
    document.querySelectorAll('.modal-bg').forEach(m => m.remove());
    document.body.style.overflow = '';
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  /* 역량 자동완성 목록 (입력칸에 list="skill-list") */
  function skillDatalist() {
    if (document.getElementById('skill-list')) return;
    const dl = document.createElement('datalist');
    dl.id = 'skill-list';
    const opts = [];
    Object.keys(SKILLS).forEach(t => { opts.push(t); SKILLS[t].syn.forEach(s => opts.push(s)); });
    dl.innerHTML = opts.map(o => `<option value="${esc(o)}">`).join('');
    document.body.appendChild(dl);
  }

  const LOGO = `<svg width="30" height="20" viewBox="0 0 40 28" aria-hidden="true"><circle cx="14" cy="14" r="12" fill="#2c5be6"/><circle cx="26" cy="14" r="12" fill="#0d9a74"/><path d="M20 3.6A12 12 0 0 1 20 24.4A12 12 0 0 1 20 3.6Z" fill="#171a26"/></svg>`;

  /* ---------- 공통 화면: 상단 메뉴 · 하단 · 테스트 메모 ---------- */
  function renderChrome() {
    const cur = document.body.dataset.page;
    const u = session.user();
    const nav = document.getElementById('nav');
    if (nav) {
      nav.className = 'nav';
      nav.innerHTML = `<div class="nav-in">
        <a class="brand" href="${url('index.html')}">${LOGO}<span class="bw">연구해<span>듀오</span></span></a>
        <nav class="menu">${PAGES.map(p => `<a href="${url(p.href)}" class="${p.key === cur ? 'on' : ''}">${p.label}</a>`).join('')}</nav>
        <div class="who">${u
          ? `${avatar(u.name, u.id, 28)}<span class="who-n">${esc(u.name)}</span><button class="linkbtn" id="logoutBtn">로그아웃</button>`
          : `<a class="btn pri sm" href="${url('features/auth/login.html')}">로그인</a>`}</div>
      </div>`;
      const lo = nav.querySelector('#logoutBtn');
      if (lo) lo.onclick = logout;
    }
    const foot = document.getElementById('foot');
    if (foot) {
      foot.className = 'foot';
      foot.innerHTML = `<div class="foot-in">
        <div><b>연구해듀오 프로토타입 ${VERSION}</b> · 과학기술학개론 조별 프로젝트 · 데이터는 팀 구글 스프레드시트에 저장돼요</div>
        <details class="clog"><summary>변경 기록</summary>${CHANGELOG.map(c =>
          `<div class="clog-v"><b>${esc(c.v)}</b> <span>${esc(c.date)}</span><ul>${c.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}</details>
      </div>`;
    }
    if (!API_URL && document.body.dataset.page !== 'home') {
      const w = document.createElement('div');
      w.className = 'cfg-warn';
      w.innerHTML = '⚠️ 서버 주소가 아직 설정되지 않았어요. <b>core/config.js</b> 의 <code>API_URL</code>에 Apps Script 웹 앱 URL을 넣어 주세요.';
      document.body.insertBefore(w, document.body.firstChild);
    }
    renderNotes();
  }

  /* 테스트 메모: 써보다 발견한 문제를 바로 적어두는 기능 (이 브라우저에만 저장) */
  function renderNotes() {
    const fab = document.createElement('button');
    fab.className = 'notes-fab';
    fab.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 2h10v7l-3 3H2z M9 12V9h3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> 테스트 메모`;
    document.body.appendChild(fab);
    const pageLabel = (PAGES.find(p => p.key === document.body.dataset.page) || {}).label || document.title;
    fab.onclick = () => {
      const m = openModal(`<h3 class="m-title">테스트 메모</h3>
        <p class="m-sub">써보다가 이상한 점을 바로 적어두세요. 주간 발표의 ‘발견한 문제점’이 됩니다. (이 컴퓨터에만 저장)</p>
        <textarea id="noteText" rows="3" placeholder="예) 같은 학과인데 학과·전공 점수가 너무 낮게 나옴"></textarea>
        <div class="row-end"><span class="mute">페이지: ${esc(pageLabel)}</span><button class="btn pri sm" id="noteSave">저장</button></div>
        <div id="noteList" class="note-list"></div>
        <div class="row-end"><button class="linkbtn" id="noteClear">모두 지우기</button><button class="btn sm" id="noteCopy">표 형식으로 복사</button></div>`);
      const draw = () => {
        const notes = load('notes', []);
        m.querySelector('#noteList').innerHTML = notes.length
          ? notes.map(n => `<div class="note"><span>${esc(n.date)} · ${esc(n.page)}</span>${esc(n.text)}</div>`).join('')
          : '<div class="empty">아직 메모가 없어요.</div>';
      };
      draw();
      m.querySelector('#noteSave').onclick = () => {
        const t = m.querySelector('#noteText').value.trim();
        if (!t) return;
        const d = new Date();
        save('notes', [{ text: t, page: pageLabel, date: `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }, ...load('notes', [])]);
        m.querySelector('#noteText').value = '';
        draw();
      };
      m.querySelector('#noteClear').onclick = () => { save('notes', []); draw(); };
      m.querySelector('#noteCopy').onclick = () => {
        const rows = load('notes', []).map(n => `| ${n.date} | ${n.page} | ${n.text.replace(/\|/g, '/')} |  |`);
        copyText(['| 날짜 | 페이지 | 발견한 문제 | 보완 계획 |', '|---|---|---|---|', ...rows].join('\n'));
      };
    };
  }

  function copyText(text) {
    const done = () => toast('복사했어요. 문서에 붙여넣으세요.');
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('복사에 실패했어요.'); }
      ta.remove();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  renderChrome();

  return { VERSION, session, api, requireLogin, logout, esc, avatar, toast, loading, errorBox,
           openModal, closeModal, skillDatalist, url, copyText };
})();
