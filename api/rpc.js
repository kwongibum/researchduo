/* Vercel 서버 함수 — 화면이 보내는 모든 요청을 받아 처리 (구글 Apps Script 를 대체)
   같은 사이트(/api/rpc)에서 돌아가므로 CORS 설정이 필요 없어요. */
const db = require('../lib/db-pg');
const { ensureSchema, dispatch } = require('../lib/actions');

function readBody(req) {
  return new Promise(resolve => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'GET') { res.end(JSON.stringify({ ok: true, service: 'researchduo', version: 'v0.4', time: new Date().toISOString() })); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(JSON.stringify({ ok: false, error: 'POST만 허용돼요' })); return; }
  try {
    const body = await readBody(req);
    await ensureSchema(db);
    const out = await dispatch(body.action, body, db);
    res.end(JSON.stringify(out));
  } catch (e) {
    res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
  }
};
