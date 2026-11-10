/* =========================================================
   매칭 카테고리 ③ 경험   (담당: 이름을 적어주세요)
   - 상대의 연구 경험이 많을수록 높은 점수
   - 논문 1편 30점, 학회 발표 1회 20점, 연구 프로젝트 1개 10점 (최대 100)
   - 역량에 근거(evNote)를 적은 경우 개당 5점 가산
   ========================================================= */
RDMatch.register({
  no: 3, key: 'experience', label: '경험', weight: 1,
  score(me, other) {
    const x = other.exp || {};
    const papers = +x.papers || 0, talks = +x.talks || 0, projects = +x.projects || 0;
    const evidence = (other.skills || []).filter(s => s.evNote).length;
    const good = [], warn = [];
    const score = papers * 30 + talks * 20 + projects * 10 + evidence * 5;
    if (papers + talks + projects) good.push(`논문 ${papers} · 학회 ${talks} · 프로젝트 ${projects}`);
    else warn.push('입력된 연구 경험이 없어요. 커피챗에서 확인해 보세요');
    if (evidence) good.push(`역량 근거 ${evidence}건`);
    if (other.expNote) good.push(other.expNote);
    return { score: Math.min(100, score), good, warn };
  },
});
