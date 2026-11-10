/* =========================================================
   기능 2 · 매칭 엔진 (engine.js)
   카테고리 파일(criteria/*.js)들을 모아서 총점을 계산해요.
   실제 서비스에서 AI가 할 판단을, 프로토타입에서는 카테고리별 규칙으로 대신해요.

   ★ 카테고리 추가 방법: criteria 폴더에 파일을 하나 만들고
     RDMatch.register({ no, key, label, owner, weight, score(me, other) }) 를 부른 뒤
     matching.html 에 <script src="criteria/파일이름.js"></script> 한 줄 추가.

   score(me, other) 는 { score: 0~100, good: ['좋은 점'], warn: ['확인할 점'] } 를 돌려줘야 해요.
   총점 = 카테고리 점수의 가중 평균 (weight가 클수록 많이 반영, 기본은 모두 1)
   ========================================================= */
const RDMatch = (() => {
  const list = [];

  function register(c) {
    list.push(c);
    list.sort((a, b) => a.no - b.no);
  }

  function criteria() { return list.slice(); }

  /* 나(me)와 상대(other) 비교 → 카테고리별 점수 + 총점 */
  function compare(me, other, weights) {
    const parts = list.map(c => {
      let r;
      try { r = c.score(me, other) || {}; } catch (e) { r = { score: 0, warn: ['계산 오류: ' + e.message] }; }
      const w = weights && weights[c.key] != null ? weights[c.key] : (c.weight ?? 1);
      return { key: c.key, no: c.no, label: c.label, weight: w,
               score: Math.max(0, Math.min(100, Math.round(r.score || 0))), good: r.good || [], warn: r.warn || [] };
    });
    const wsum = parts.reduce((s, p) => s + p.weight, 0) || 1;
    const total = Math.round(parts.reduce((s, p) => s + p.score * p.weight, 0) / wsum);
    return { other, total, parts, available: other.available !== false };
  }

  /* 나와 다른 모든 연구자를 비교해서 점수순 정렬 (참여 가능한 사람 먼저) */
  function rank(me, others, weights) {
    return others
      .filter(o => o.userId !== me.userId)
      .map(o => compare(me, o, weights))
      .sort((a, b) => (b.available - a.available) || (b.total - a.total));
  }

  /* 여러 카테고리 파일에서 같이 쓰는 도우미 */
  const util = {
    arr: v => (Array.isArray(v) ? v.filter(Boolean) : []),
    overlap: (a, b) => util.arr(a).filter(x => util.arr(b).includes(x)),
  };

  return { register, criteria, compare, rank, util };
})();
