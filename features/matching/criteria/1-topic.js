/* =========================================================
   매칭 카테고리 ① 연구 관심 주제   (담당: 이름을 적어주세요)
   - 관심 주제 카테고리(TOPICS)가 겹칠수록 높은 점수
   - 세부 키워드까지 겹치면 가산점
   - 지난 피드백 '카테고리 추출해서 비슷하면 추천' 반영
   ========================================================= */
RDMatch.register({
  no: 1, key: 'topic', label: '관심 주제', weight: 1,
  score(me, other) {
    const { arr, overlap } = RDMatch.util;
    const good = [], warn = [];
    const same = overlap(me.topics, other.topics);
    const base = Math.max(arr(me.topics).length, arr(other.topics).length) || 1;

    // 키워드는 대소문자·띄어쓰기 무시하고 비교
    const norm = s => String(s).toLowerCase().replace(/\s+/g, '');
    const myKw = arr(me.keywords).map(norm);
    const kw = arr(other.keywords).filter(k => myKw.includes(norm(k)));

    let score = 0;
    if (same.length) {
      score = 50 + 50 * (same.length / base);   // 하나라도 겹치면 50점부터
      good.push(`관심 주제 겹침: ${same.join(', ')}`);
    } else {
      warn.push('겹치는 관심 주제가 없어요');
    }
    if (kw.length) {
      score += 15 * kw.length;
      good.push(`같은 키워드: ${kw.map(k => '#' + k).join(' ')}`);
    }
    return { score: Math.min(100, score), good, warn };
  },
});
