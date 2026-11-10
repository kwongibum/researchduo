/* =========================================================
   매칭 카테고리 ⑥ 협업 조건   (담당: 이름을 적어주세요)
   - 주당 시간 (60점): 가능한 시간대가 겹치면 40점 + 많이 겹칠수록 최대 20점 추가
   - 협업 방식 (40점): 같거나 한쪽이 블렌디드면 40점
   - 상대가 '참여 어려움'이면 경고 (목록 맨 아래로 내려감)
   ========================================================= */
RDMatch.register({
  no: 6, key: 'condition', label: '협업 조건', weight: 1,
  score(me, other) {
    const good = [], warn = [];
    const a = me.hours || [3, 6], b = other.hours || [3, 6];
    const ov = Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
    let score = 0;
    if (ov >= 0) {
      const span = Math.max(1, Math.min(a[1] - a[0], b[1] - b[0]));
      score += 40 + 20 * Math.min(1, ov / span);
      good.push(`주당 시간 겹침 (상대 ${b[0]}–${b[1]}시간)`);
    } else {
      warn.push(`주당 시간이 안 맞아요 (나 ${a[0]}–${a[1]} / 상대 ${b[0]}–${b[1]}시간)`);
    }
    if (me.mode === other.mode || me.mode === '블렌디드' || other.mode === '블렌디드') {
      score += 40;
      good.push(`협업 방식 맞음 (상대 ${other.mode})`);
    } else {
      warn.push(`협업 방식이 달라요 (상대 ${other.mode})`);
    }
    if (other.available === false) warn.push('지금은 협업 참여가 어렵다고 했어요');
    return { score, good, warn };
  },
});
