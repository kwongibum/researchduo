/* 테스트 전용 DB 어댑터 — psql CLI 로 로컬 Postgres 에 같은 SQL 실행 (pg 설치 불가 환경 대응)
   프로덕션에서는 쓰이지 않아요. $1,$2 자리표시자를 안전한 리터럴로 바꿔서 psql 에 넘겨요. */
const { execFileSync } = require('child_process');

function literal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  const s = String(v);
  let tag = 'p';
  while (s.includes('$' + tag + '$')) tag += 'x';
  return '$' + tag + '$' + s + '$' + tag + '$';
}
function build(text, params) {
  return text.replace(/\$(\d+)/g, (m, n) => literal((params || [])[+n - 1]));
}
function run(sql) {
  return execFileSync('psql', ['-tAc', sql], {
    env: { ...process.env, PGHOST: process.env.PGHOST || '/tmp', PGPORT: process.env.PGPORT || '5433',
      PGUSER: process.env.PGUSER || 'rd', PGDATABASE: process.env.PGDATABASE || 'researchduo' },
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
}
async function query(text, params) {
  const sql = build(text, params);
  if (/^\s*select/i.test(sql)) {
    const out = run(`select coalesce(json_agg(t),'[]') from (${sql.replace(/;\s*$/, '')}) t`).trim();
    return JSON.parse(out || '[]');
  }
  run(sql);
  return [];
}
module.exports = { query };
