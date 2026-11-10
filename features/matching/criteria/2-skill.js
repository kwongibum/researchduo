/* =========================================================
   매칭 카테고리 ② 연구 방법·역량   (담당: 이름을 적어주세요)
   - 내가 '필요한 역량'을 상대가 갖고 있는가 (70%)
   - 상대가 필요한 역량을 내가 갖고 있는가 (30%) → 서로 보완되는 관계일수록 높음
   - 같은 역량: 숙련도에 따라 능숙 1.0 / 활용 0.8 / 기초 0.4
   - 같은 분야(SKILLS의 cat)의 다른 역량: 0.3
   ========================================================= */
RDMatch.register({
  no: 2, key: 'skill', label: '연구 역량', weight: 1,
  score(me, other) {
    const { arr } = RDMatch.util;
    const good = [], warn = [];
    const LV = { 1: 0.4, 2: 0.8, 3: 1 };

    // 'needs'(필요한 역량 목록)를 'who'가 얼마나 채워주는지 0~1
    function cover(needs, who, label) {
      const ns = arr(needs).map(n => normalizeSkill(n).tag || n);
      if (!ns.length) return null;
      const skills = arr(who.skills).filter(s => s.tag);
      const vals = ns.map(n => {
        const exact = skills.find(s => s.tag === n);
        if (exact) {
          const v = LV[exact.level] || 0.4;
          good.push(`${label} ‘${n}’ 보유 (${LEVELS[exact.level]}${exact.evNote ? ', 근거 있음' : ''})`);
          if (exact.level === 1) warn.push(`‘${n}’은 기초 수준이에요`);
          return v;
        }
        const cat = SKILLS[n] && SKILLS[n].cat;
        const rel = cat && skills.find(s => SKILLS[s.tag] && SKILLS[s.tag].cat === cat);
        if (rel) { warn.push(`${label} ‘${n}’ 대신 비슷한 ‘${rel.tag}’ 보유`); return 0.3; }
        return 0;
      });
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    const forMe = cover(me.needs, other, '내가 필요한');
    const forThem = cover(other.needs, me, '상대가 필요한');
    if (forMe === null && forThem === null) {
      warn.push('필요한 역량이 입력되지 않아 비교할 수 없어요');
      return { score: 50, good, warn };
    }
    if (forMe === 0) warn.push('내가 필요한 역량을 갖고 있지 않아요');
    const score = forMe === null ? forThem * 100
      : forThem === null ? forMe * 100
      : (forMe * 0.7 + forThem * 0.3) * 100;
    return { score, good, warn };
  },
});
