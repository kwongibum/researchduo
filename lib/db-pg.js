/* 프로덕션 DB 어댑터 (Vercel) — pg 로 Vercel Postgres 에 연결
   Vercel 대시보드에서 Postgres 를 추가하면 POSTGRES_URL 환경변수가 자동으로 들어와요. */
const { Pool } = require('pg');
let pool;
function getPool() {
  if (!pool) {
    const cs = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;
    const local = /localhost|127\.0\.0\.1/.test(cs || '');
    pool = new Pool({ connectionString: cs, max: 3, ssl: local ? false : { rejectUnauthorized: false } });
  }
  return pool;
}
async function query(text, params) {
  const r = await getPool().query(text, params || []);
  return r.rows;
}
module.exports = { query };
