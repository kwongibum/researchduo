/* =========================================================
   매칭 카테고리 ④ 학과·전공   (담당: 이름을 적어주세요)
   내 '협업 선호'(deptPref)에 따라 점수가 달라져요.
   - 다른 계열과 융합: 다른 계열 100 / 같은 계열·다른 학과 60 / 같은 학과 30
   - 같은 계열 선호:   같은 학과 100 / 같은 계열 80 / 다른 계열 30
   - 상관없음:         모두 70
   ========================================================= */
RDMatch.register({
  no: 4, key: 'major', label: '학과·전공', weight: 1,
  score(me, other) {
    const good = [], warn = [];
    const norm = s => String(s || '').replace(/\s+/g, '');
    const sameDept = norm(me.dept) && norm(me.dept) === norm(other.dept);
    const sameField = me.field && me.field === other.field;
    const pref = me.deptPref || '상관없음';
    const desc = sameDept ? '같은 학과' : sameField ? `같은 ${other.field} 계열` : `다른 계열(${other.field || '미입력'})`;

    let score = 70;
    if (pref === '다른 계열과 융합') score = sameDept ? 30 : sameField ? 60 : 100;
    else if (pref === '같은 계열 선호') score = sameDept ? 100 : sameField ? 80 : 30;

    if (score >= 80) good.push(`${desc} · 내 선호(${pref})와 맞아요`);
    else if (score <= 40) warn.push(`${desc} · 내 선호(${pref})와 달라요`);
    else good.push(desc);
    return { score, good, warn };
  },
});
