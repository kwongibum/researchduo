/* =========================================================
   매칭 카테고리 ⑤ 목표 성과   (담당: 이름을 적어주세요)
   - 같은 목표가 있으면 100점
   - 같지는 않지만 비슷한 묶음(GOAL_GROUP: 성과 발표 / 경험·배움)이면 60점
   - 전혀 다르면 0점
   (v0.1에서 '일치/불일치로만 판단'하던 문제를 보완)
   ========================================================= */
RDMatch.register({
  no: 5, key: 'goal', label: '목표 성과', weight: 1,
  score(me, other) {
    const { arr, overlap } = RDMatch.util;
    const good = [], warn = [];
    if (!arr(me.goals).length || !arr(other.goals).length) {
      warn.push('목표 성과가 입력되지 않았어요');
      return { score: 50, good, warn };
    }
    const same = overlap(me.goals, other.goals);
    if (same.length) {
      good.push(`같은 목표: ${same.join(', ')}`);
      return { score: 100, good, warn };
    }
    const g1 = arr(me.goals).map(g => GOAL_GROUP[g]);
    const g2 = arr(other.goals).map(g => GOAL_GROUP[g]);
    if (g1.some(g => g2.includes(g))) {
      good.push(`비슷한 목표 (상대: ${arr(other.goals).join(', ')})`);
      return { score: 60, good, warn };
    }
    warn.push(`목표가 달라요 (상대: ${arr(other.goals).join(', ')})`);
    return { score: 0, good, warn };
  },
});
