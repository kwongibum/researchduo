/* =========================================================
   기능 1 · 연구 프로필 — 프로필 화면 컴포넌트 (profile-view.js)
   ★ ② 매칭 모듈도 '프로필 보기' 창에서 이 파일을 가져다 써요.
      함수 이름과 입력 모양을 바꿀 때는 ② 담당자에게 알려주세요.

   사용법: RDProfileView.render(연구자, { banner, reason, actions })  → HTML 문자열
   연구자 모양: { id, name, school, dept, degree, semester, available,
                 skills:[{tag, raw, level, evNote}], interests:[], intro,
                 goals:[], hours:[최소,최대], mode, types:[], reviews:[], completed, liked }
   ========================================================= */
const RDProfileView = (() => {
  const e = s => RD.esc(s);

  function bar(level) {
    return `<span class="pv-bar">${[1, 2, 3].map(i => `<i class="${i <= level ? 'o' : ''}"></i>`).join('')}</span>`;
  }

  function render(r, opts = {}) {
    const skills = (r.skills || []).filter(s => (s.tag || s.raw || '').trim());
    const sub = [r.school, r.dept].filter(Boolean).join(' ') + (r.degree ? ` · ${r.degree}` : '') + (r.semester ? ` ${r.semester}` : '');
    const review = (r.reviews || [])[0];
    return `<div class="pv">
      <div class="pv-cover">${opts.banner ? `<span>${e(opts.banner)}</span>` : ''}</div>
      <div class="pv-id">
        ${RD.avatar(r.name || '?', r.id || r.name, 60)}
        <div class="pv-nm">
          <b>${e(r.name || '이름')}</b>
          ${r.available === false ? '<span class="chip">참여 어려움</span>' : '<span class="chip g">● 참여 가능</span>'}
          <div class="pv-sub">${e(sub || '학교 · 학과 · 과정')}</div>
        </div>
        ${opts.actions ? `<div class="pv-act">${opts.actions}</div>` : ''}
      </div>
      <div class="pv-tabs"><span class="on">프로필</span><span>실적 Record</span><span>찜한 논문 ${r.liked || 0}</span><span>후기</span></div>
      ${opts.reason ? `<div class="pv-rec"><b>추천 이유</b> · ${opts.reason}</div>` : ''}
      <div class="pv-body">
        <div class="pv-sec full">
          <div class="pv-lb">연구 역량</div>
          ${skills.length ? skills.map(s => `
            <div class="pv-sk">
              <span class="pv-skn">${e(s.tag || s.raw)}${s.tag && s.raw && s.raw !== s.tag ? `<small>${e(s.raw)}</small>` : ''}</span>
              ${bar(s.level)}<span class="pv-lv">${LEVELS[s.level] || ''}</span>
            </div>
            <div class="pv-ev ${s.evNote && s.evNote.trim() ? '' : 'none'}">${s.evNote && s.evNote.trim() ? '✓ 근거 · ' + e(s.evNote) : '근거 자료 없음'}</div>`).join('')
          : '<div class="pv-none">아직 입력한 역량이 없어요</div>'}
        </div>
        <div class="pv-sec">
          <div class="pv-lb">관심 분야</div>
          ${(r.interests || []).length ? `<div class="tags">${r.interests.map(i => `<span>${e(i)}</span>`).join('')}</div>` : '<div class="pv-none">—</div>'}
        </div>
        <div class="pv-sec">
          <div class="pv-lb">목표 성과</div>
          ${(r.goals || []).length ? `<div class="tags g">${r.goals.map(i => `<span>${e(i)}</span>`).join('')}</div>` : '<div class="pv-none">—</div>'}
        </div>
        ${r.intro ? `<div class="pv-sec full"><div class="pv-lb">관심 연구 소개</div><p class="pv-intro">${e(r.intro)}</p></div>` : ''}
        <div class="pv-sec full">
          <div class="pv-lb">협업 조건</div>
          <div class="pv-cond">
            <span><b>주당</b>${r.hours ? `${e(r.hours[0])}–${e(r.hours[1])}시간` : '—'}</span>
            <span><b>방식</b>${e(r.mode || '—')}</span>
            <span><b>희망 유형</b>${e((r.types || []).join(', ') || '—')}</span>
          </div>
        </div>
      </div>
      <div class="pv-stats">
        <div><b>${r.liked || 0}편</b>찜한 논문</div>
        <div><b>${r.completed || 0}건</b>협업 완료</div>
        <div><b>${review ? '“' + e(review) + '”' : '—'}</b>받은 후기</div>
      </div>
    </div>`;
  }

  return { render };
})();
