/* =========================================================
   연구해듀오 — 공통 모듈 (core/common.js)
   모든 페이지가 이 파일을 불러와요. 이 파일은 팀 전체가 함께 쓰므로
   고칠 때는 팀에 먼저 알려주세요.

   ★ 모듈 간 데이터 연결 규칙 (브라우저 localStorage 사용)
   ┌──────────────┬──────────────┬───────────────────────────┐
   │ 저장 이름      │ 쓰는 모듈       │ 읽는 모듈                    │
   ├──────────────┼──────────────┼───────────────────────────┤
   │ rd_profile   │ ① 연구 프로필   │ ② 매칭(나에게 맞는 프로젝트), ③ │
   │ rd_project   │ ② 매칭         │ ③ (재매칭 버튼)               │
   │ rd_requests  │ ② 매칭(요청 생성)│ ③ (상태 변경)                 │
   └──────────────┴──────────────┴───────────────────────────┘
   직접 localStorage를 쓰지 말고 RD.store.* 함수를 써 주세요.

   요청(request) 한 건의 모양:
   {
     id, key,                       // key: 같은 요청 중복 방지용
     dir: 'cast' | 'apply',          // cast = 내가 연구자를 캐스팅 / apply = 내가 프로젝트에 참여 요청
     who:     { id, name, dept },    // 상대방
     project: { id, title },
     slot:    { tag, role },         // 어떤 전문성 자리인지
     score,                          // 매칭 점수(0~100)
     status: 'req' | 'acc' | 'chat' | 'group' | 'rej' | 'end',
             // 요청됨 → 수락 → 커피챗 예정 → 그룹 결성 / 거절 / 커피챗 후 종료
     chat:  { date, time, mode },    // 커피챗 일정 (③에서 입력)
     agree: { role, period, author },// 협업 합의서 (③에서 입력)
     endReason, endMemo,             // 종료 사유 (③에서 입력)
     created
   }
   ========================================================= */

const RD = (() => {
  /* ---- 버전 기록: 매주 고친 내용을 여기에 추가하세요 ---- */
  const VERSION = 'v0.1';
  const CHANGELOG = [
    { v: 'v0.1', date: '2026-11-03', items: [
      '핵심 기능 3개를 모듈로 분리해 첫 구현 (① 연구 프로필 · ② 프로젝트 개설·매칭 · ③ 요청·커피챗·그룹)',
      '더미 연구자 18명 · 더미 프로젝트 6개 · 테스트 시나리오 4개',
      '테스트 메모 기능 (발견한 문제를 바로 기록)',
    ] },
  ];

  const root = document.body.dataset.root || './';
  const PAGES = [
    { key: 'home',     href: 'index.html',                      label: '홈' },
    { key: 'profile',  href: 'features/profile/profile.html',   label: '① 연구 프로필' },
    { key: 'matching', href: 'features/matching/matching.html', label: '② 프로젝트 개설·매칭' },
    { key: 'connect',  href: 'features/connect/connect.html',   label: '③ 요청·커피챗·그룹' },
  ];
  const url = href => root + href;

  /* ---------- 저장소 ---------- */
  function load(k, fallback) {
    try { const v = localStorage.getItem('rd_' + k); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function save(k, v) {
    try { localStorage.setItem('rd_' + k, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 */ }
  }
  const store = {
    getProfile: () => load('profile', null),
    saveProfile: p => save('profile', p),
    getProject: () => load('project', null),
    saveProject: p => save('project', p),
    getRequests: () => load('requests', []),
    saveRequests: list => save('requests', list),
    addRequest(req) {
      const all = store.getRequests();
      if (all.some(x => x.key === req.key)) return false;
      all.unshift({ ...req, id: 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
                    status: 'req', created: new Date().toISOString() });
      store.saveRequests(all);
      return true;
    },
    updateRequest(id, patch) {
      const all = store.getRequests().map(x => (x.id === id ? { ...x, ...patch } : x));
      store.saveRequests(all);
    },
    hasRequest: key => store.getRequests().some(x => x.key === key),
    getNotes: () => load('notes', []),
    saveNotes: n => save('notes', n),
    reset() {
      ['profile', 'project', 'requests', 'notes'].forEach(k => {
        try { localStorage.removeItem('rd_' + k); } catch (e) {}
      });
    },
  };

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
    t._h = setTimeout(() => t.classList.remove('show'), 2400);
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

  /* 전문성 자동완성 목록 (입력칸에 list="skill-list" 를 달면 사용됨) */
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
    const nav = document.getElementById('nav');
    if (nav) {
      nav.className = 'nav';
      nav.innerHTML = `<div class="nav-in">
        <a class="brand" href="${url('index.html')}">${LOGO}<span class="bw">연구해<span>듀오</span></span></a>
        <nav class="menu">${PAGES.map(p => `<a href="${url(p.href)}" class="${p.key === cur ? 'on' : ''}">${p.label}</a>`).join('')}</nav>
        <span class="ver">프로토타입 ${VERSION}</span>
      </div>`;
    }
    const foot = document.getElementById('foot');
    if (foot) {
      foot.className = 'foot';
      foot.innerHTML = `<div class="foot-in">
        <div><b>연구해듀오 프로토타입 ${VERSION}</b> · 과학기술학개론 조별 프로젝트 · 모든 연구자·프로젝트는 더미 데이터예요</div>
        <details class="clog"><summary>변경 기록</summary>${CHANGELOG.map(c =>
          `<div class="clog-v"><b>${esc(c.v)}</b> <span>${esc(c.date)}</span><ul>${c.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}</details>
        <button class="linkbtn" id="resetAll">테스트 데이터 초기화</button>
      </div>`;
      foot.querySelector('#resetAll').onclick = () => {
        if (window.confirm('저장된 프로필·프로젝트·요청·메모를 모두 지울까요?')) { store.reset(); location.reload(); }
      };
    }
    renderNotes();
  }

  /* 테스트 메모: 사이트를 써보다 발견한 문제를 바로 적어두는 기능 */
  function renderNotes() {
    const fab = document.createElement('button');
    fab.className = 'notes-fab';
    fab.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 2h10v7l-3 3H2z M9 12V9h3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> 테스트 메모`;
    document.body.appendChild(fab);
    const pageLabel = (PAGES.find(p => p.key === document.body.dataset.page) || {}).label || document.title;

    fab.onclick = () => {
      const m = openModal(`<h3 class="m-title">테스트 메모</h3>
        <p class="m-sub">써보다가 이상한 점을 바로 적어두세요. 주간 발표의 ‘발견한 문제점’이 됩니다.</p>
        <textarea id="noteText" rows="3" placeholder="예) 수현이 1위로 추천되는데 원하는 시간이 전혀 안 맞음"></textarea>
        <div class="row-end"><span class="mute">페이지: ${esc(pageLabel)}</span><button class="btn pri sm" id="noteSave">저장</button></div>
        <div id="noteList" class="note-list"></div>
        <div class="row-end"><button class="linkbtn" id="noteClear">모두 지우기</button><button class="btn sm" id="noteCopy">표 형식으로 복사</button></div>`);
      const draw = () => {
        const notes = store.getNotes();
        m.querySelector('#noteList').innerHTML = notes.length
          ? notes.map(n => `<div class="note"><span>${esc(n.date)} · ${esc(n.page)}</span>${esc(n.text)}</div>`).join('')
          : '<div class="empty">아직 메모가 없어요.</div>';
      };
      draw();
      m.querySelector('#noteSave').onclick = () => {
        const t = m.querySelector('#noteText').value.trim();
        if (!t) return;
        const d = new Date();
        store.saveNotes([{ text: t, page: pageLabel, date: `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }, ...store.getNotes()]);
        m.querySelector('#noteText').value = '';
        draw();
      };
      m.querySelector('#noteClear').onclick = () => { store.saveNotes([]); draw(); };
      m.querySelector('#noteCopy').onclick = () => {
        const rows = store.getNotes().map(n => `| ${n.date} | ${n.page} | ${n.text.replace(/\|/g, '/')} |  |`);
        copyText(['| 날짜 | 페이지 | 발견한 문제 | 보완 계획 |', '|---|---|---|---|', ...rows].join('\n'));
      };
    };
  }

  function copyText(text) {
    const done = () => toast('복사했어요. 문서에 붙여넣으세요.');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, () => fallback());
    } else fallback();
    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('복사에 실패했어요.'); }
      ta.remove();
    }
  }

  renderChrome();

  return { VERSION, store, esc, avatar, toast, openModal, closeModal, skillDatalist, url, copyText };
})();
