/* =========================================================
   기능 1 · 연구 프로필 — 프로필 화면 컴포넌트 (profile-view.js)
   ★ ② 매칭, ③ 요청·그룹 모듈도 이 파일을 가져다 써요.
      함수 이름과 입력 모양을 바꿀 때는 다른 담당자에게 알려주세요.

   RDProfileView.render(프로필, { banner, reason, actions })  → 상세 화면 HTML
   RDProfileView.mini(프로필, { right })                      → 목록용 작은 카드 HTML

   프로필 모양 (구글 시트 '프로필' 탭의 data 칸에 저장됨):
   { userId, name, school, dept, field, degree, semester, intro,
     topics:[], keywords:[],                       ① 연구 관심 주제
     skills:[{tag, raw, level, evNote}], needs:[],  ② 연구 방법·역량 (보유 / 필요)
     exp:{papers, talks, projects}, expNote,        ③ 경험
     deptPref,                                       ④ 학과·전공 (field·dept와 함께)
     goals:[],                                       ⑤ 목표 성과
     hours:[최소,최대], mode, available, types:[] } ⑥ 협업 조건
   ========================================================= */
const RDProfileView = (() => {
  const e = s => RD.esc(s);
  const arr = v => (Array.isArray(v) ? v.filter(Boolean) : []);

  function bar(level) {
    return `<span class="pv-bar">${[1, 2, 3].map(i => `<i class="${i <= level ? 'o' : ''}"></i>`).join('')}</span>`;
  }
  function subline(r) {
    const a = [r.school, r.dept].filter(Boolean).join(' ');
    const b = [r.degree, r.semester].filter(Boolean).join(' ');
    return [a, b].filter(Boolean).join(' · ');
  }
  function tags(list, cls = '') {
    return arr(list).length ? `<div class="tags ${cls}">${arr(list).map(i => `<span>${e(i)}</span>`).join('')}</div>` : '<div class="pv-none">—</div>';
  }

  function render(r, opts = {}) {
    const skills = arr(r.skills).filter(s => (s.tag || s.raw || '').trim());
    const x = r.exp || {};
    return `<div class="pv">
      <div class="pv-cover">${opts.banner ? `<span>${e(opts.banner)}</span>` : ''}</div>
      <div class="pv-id">
        ${RD.avatar(r.name || '?', r.userId || r.name, 60)}
        <div class="pv-nm">
          <b>${e(r.name || '이름')}</b>
          ${r.available === false ? '<span class="chip">참여 어려움</span>' : '<span class="chip g">● 참여 가능</span>'}
          <div class="pv-sub">${e(subline(r) || '학교 · 학과 · 과정')}</div>
        </div>
        ${opts.actions ? `<div class="pv-act">${opts.actions}</div>` : ''}
      </div>
      ${opts.reason ? `<div class="pv-rec"><b>매칭</b> · ${opts.reason}</div>` : ''}
      <div class="pv-body">
        <div class="pv-sec full">
          <div class="pv-lb"><i>①</i>연구 관심 주제</div>
          ${tags(r.topics, 'b')}
          ${arr(r.keywords).length ? `<div class="pv-kw">${arr(r.keywords).map(k => '#' + e(k)).join(' ')}</div>` : ''}
        </div>
        <div class="pv-sec full">
          <div class="pv-lb"><i>②</i>연구 방법·역량</div>
          ${skills.length ? skills.map(s => `
            <div class="pv-sk">
              <span class="pv-skn">${e(s.tag || s.raw)}${s.tag && s.raw && s.raw !== s.tag ? `<small>${e(s.raw)}</small>` : ''}</span>
              ${bar(s.level)}<span class="pv-lv">${LEVELS[s.level] || ''}</span>
            </div>
            <div class="pv-ev ${s.evNote ? '' : 'none'}">${s.evNote ? '✓ 근거 · ' + e(s.evNote) : '근거 자료 없음'}</div>`).join('')
          : '<div class="pv-none">아직 입력한 역량이 없어요</div>'}
          <div class="pv-need"><span>필요한 역량</span>${arr(r.needs).length ? arr(r.needs).map(n => `<em>${e(n)}</em>`).join('') : '<span class="pv-none">—</span>'}</div>
        </div>
        <div class="pv-sec">
          <div class="pv-lb"><i>③</i>경험</div>
          <div class="pv-exp"><span><b>${+x.papers || 0}</b>논문</span><span><b>${+x.talks || 0}</b>학회 발표</span><span><b>${+x.projects || 0}</b>연구 프로젝트</span></div>
          ${r.expNote ? `<div class="pv-intro">${e(r.expNote)}</div>` : ''}
        </div>
        <div class="pv-sec">
          <div class="pv-lb"><i>④</i>학과·전공</div>
          <div class="pv-txt">${e(r.dept || '—')}${r.field ? ` <span class="chip">${e(r.field)} 계열</span>` : ''}</div>
          <div class="pv-intro">협업 선호: ${e(r.deptPref || '—')}</div>
        </div>
        <div class="pv-sec">
          <div class="pv-lb"><i>⑤</i>목표 성과</div>
          ${tags(r.goals, 'g')}
        </div>
        <div class="pv-sec">
          <div class="pv-lb"><i>⑥</i>협업 조건</div>
          <div class="pv-cond">
            <span><b>주당</b>${r.hours ? `${e(r.hours[0])}–${e(r.hours[1])}시간` : '—'}</span>
            <span><b>방식</b>${e(r.mode || '—')}</span>
          </div>
          ${arr(r.types).length ? `<div class="pv-intro">희망: ${e(arr(r.types).join(', '))}</div>` : ''}
        </div>
        ${r.intro ? `<div class="pv-sec full"><div class="pv-lb">관심 연구 소개</div><p class="pv-intro">${e(r.intro)}</p></div>` : ''}
      </div>
      ${r.updated ? `<div class="pv-upd">마지막 수정 ${e(r.updated)}</div>` : ''}
    </div>`;
  }

  function mini(r, opts = {}) {
    return `<div class="pm" data-uid="${e(r.userId)}">
      ${RD.avatar(r.name, r.userId, 44)}
      <div class="pm-b">
        <div class="pm-n"><b>${e(r.name)}</b>${r.available === false ? '<span class="chip">참여 어려움</span>' : ''}</div>
        <div class="pm-s">${e(subline(r))}</div>
        <div class="tags b">${arr(r.topics).slice(0, 3).map(t => `<span>${e(t)}</span>`).join('')}</div>
        <div class="pm-sk">${arr(r.skills).filter(s => s.tag).slice(0, 4).map(s => `${e(s.tag)} <small>${LEVELS[s.level] || ''}</small>`).join(' · ')}</div>
      </div>
      ${opts.right || ''}
    </div>`;
  }

  return { render, mini };
})();
