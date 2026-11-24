/* =========================================================
   연구해듀오 — 서버 로직 (lib/actions.js)  v0.4
   저장소(구글 시트) → Postgres 로 이전. 화면이 보내는 요청(action)을 여기서 처리해요.
   DB 접근은 db.query(sql, params) 로 추상화해서, 프로덕션(pg)·테스트(psql) 둘 다 동작해요.

   테이블: users / profiles / projects / requests / messages / reviews
   대부분의 실제 내용은 각 행의 data(jsonb)에 통째로 저장해요(시트 때와 같은 구조).

   v0.4 보안 강화
   - 가입 시 동의(agreed) 필수, 공개 이름은 닉네임(실명 수집 안 함)
   - 프로필 공개범위(visibility): public / matchonly / private
   - listProfiles: 비공개(private)는 연결된 사이에게만, 그 외에도 자유 서술(intro 등)은 연결된 사이에게만
   ========================================================= */
const crypto = require('crypto');
const ACTIVE = ['req', 'acc', 'chat'];

/* ---------- 작은 도우미 ---------- */
const uid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 10);
function now() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' '); }
function hash(pw, salt) { return crypto.createHash('sha256').update(salt + '|' + pw, 'utf8').digest('hex'); }
const J = v => JSON.stringify(v == null ? {} : v);

/* ---------- 스키마 (최초 1회) ---------- */
let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  // 표시용 시각은 KST 문자열(text)로 저장 → DB 시간대와 무관하게 일관. 순서가 중요한 메시지는 seq 사용.
  await db.query(`create table if not exists users(
    id text primary key, username text unique, name text,
    pass_hash text, salt text, token text, data jsonb default '{}'::jsonb, created text)`);
  await db.query(`create table if not exists profiles(
    user_id text primary key, data jsonb, updated text)`);
  await db.query(`create table if not exists projects(
    id text primary key, owner_id text, data jsonb, updated text)`);
  await db.query(`create table if not exists requests(
    id text primary key, data jsonb, status text, updated text)`);
  await db.query(`create table if not exists messages(
    id text primary key, project_id text, data jsonb, created text, seq bigserial)`);
  await db.query(`create table if not exists reviews(
    id text primary key, project_id text, from_id text, to_id text, data jsonb, created text)`);
  schemaReady = true;
}

/* ---------- 인증 ---------- */
async function auth(body, db) {
  if (!body.token) throw new Error('로그인이 필요해요');
  const r = await db.query('select id, username, name from users where token=$1', [body.token]);
  if (!r.length) throw new Error('로그인이 만료됐어요. 다시 로그인해 주세요');
  return { id: r[0].id, username: r[0].username, name: r[0].name };
}

/* ---------- 프로젝트(=팀) 로더/세이버 ---------- */
function normProject(row) {
  const d = row.data || {};
  d.id = String(d.id || row.id);
  d.ownerId = String(d.ownerId || row.owner_id);
  d.ownerName = d.ownerName || '';
  d.members = Array.isArray(d.members) ? d.members : [];
  d.slots = (Array.isArray(d.slots) ? d.slots : []).map((s, i) => Object.assign({ id: 's' + i, filledBy: '' }, s));
  d.visibility = d.visibility === 'private' ? 'private' : 'public';
  d.status = d.status || '모집 중';
  d.updated = row.updated ? String(row.updated).slice(0, 16).replace('T', ' ') : '';
  return d;
}
async function loadProjects(db) {
  const rows = await db.query('select id, owner_id, data, updated from projects', []);
  return rows.map(normProject);
}
/* 현재 닉네임 맵 (id→name). 이름은 저장 시점의 스냅샷이 아니라 읽을 때 최신값으로 덮어써요. */
async function nameMap(db) {
  const r = await db.query('select id, name from users', []);
  const m = {}; r.forEach(u => { m[u.id] = u.name; }); return m;
}
function freshProject(p, nm) {
  if (nm[p.ownerId]) p.ownerName = nm[p.ownerId];
  (p.members || []).forEach(m => { if (nm[m.userId]) m.name = nm[m.userId]; });
  return p;
}
async function saveProj(db, p) {
  const d = Object.assign({}, p); delete d.updated;
  await db.query(
    `insert into projects(id, owner_id, data, updated) values($1,$2,$3::jsonb,$4)
     on conflict(id) do update set owner_id=excluded.owner_id, data=excluded.data, updated=excluded.updated`,
    [d.id, d.ownerId, J(d), now()]);
}
const isMember = (p, id) => !!p && !!id && (p.ownerId === String(id) || (p.members || []).some(m => m.userId === String(id)));
const slotById = (p, id) => (p.slots || []).find(s => s.id === id);
function mergeSlots(oldSlots, newSlots) {
  const byId = {}; (oldSlots || []).forEach(s => { if (s.id) byId[s.id] = s; });
  return (newSlots || []).map(s => {
    const prev = s.id && byId[s.id];
    return { id: s.id || 's' + uid().slice(0, 6), tag: s.tag || '', raw: s.raw || s.tag || '',
      level: +s.level || 2, role: s.role || '', filledBy: prev ? (prev.filledBy || '') : (s.filledBy || '') };
  });
}
const joinerOf = d => (d.kind === 'apply' ? d.fromId : d.toId);
async function joinTeam(db, team, data) {
  const joinerId = joinerOf(data);
  const joinerName = data.kind === 'apply' ? data.fromName : data.toName;
  const agree = data.agree || {}, intent = data.intent || {};
  const slotId = agree.slotId || intent.slotId || data.slotId || '';
  if (!isMember(team, joinerId)) {
    team.members.push({ userId: joinerId, name: joinerName, slotId, role: agree.role || data.role || '',
      period: agree.period || intent.period || '', author: agree.author || '', contribution: intent.contribution || '',
      hours: intent.hours || '', joined: now() });
  }
  const slot = slotById(team, slotId);
  if (slot && !slot.filledBy) slot.filledBy = joinerId;
  if (team.status === '모집 중' && (team.slots || []).length && team.slots.every(s => s.filledBy)) team.status = '진행 중';
  await saveProj(db, team);
}

/* ---------- 액션 ---------- */
const actions = {
  async ping() { return { ok: true, version: 'v0.4', time: now() }; },

  /* 가입: { name(=닉네임), username, password, agreed } */
  async signup(b, db) {
    const name = String(b.name || '').trim();
    const username = String(b.username || '').trim().toLowerCase();
    const password = String(b.password || '');
    if (!b.agreed) throw new Error('개인정보·프로필 공개 안내에 동의해 주세요');
    if (!name) throw new Error('닉네임을 입력해 주세요');
    if (name.length > 20) throw new Error('닉네임은 20자까지 쓸 수 있어요');
    if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new Error('아이디는 영문 소문자·숫자·_ 3~20자로 만들어 주세요');
    if (password.length < 4) throw new Error('비밀번호는 4자 이상이어야 해요');
    const dup = await db.query('select 1 from users where username=$1', [username]);
    if (dup.length) throw new Error('이미 사용 중인 아이디예요');
    const id = 'u' + uid(), salt = crypto.randomUUID(), token = crypto.randomUUID();
    await db.query('insert into users(id, username, name, pass_hash, salt, token, data, created) values($1,$2,$3,$4,$5,$6,$7::jsonb,$8)',
      [id, username, name, hash(password, salt), salt, token, J({ agreed: true, agreedAt: now() }), now()]);
    return { ok: true, token, user: { id, username, name } };
  },

  /* 로그인: { username, password } */
  async login(b, db) {
    const username = String(b.username || '').trim().toLowerCase();
    const r = await db.query('select * from users where username=$1', [username]);
    const u = r[0];
    if (!u || hash(String(b.password || ''), u.salt) !== u.pass_hash) throw new Error('아이디 또는 비밀번호가 맞지 않아요');
    let token = u.token;
    if (!token) { token = crypto.randomUUID(); await db.query('update users set token=$1 where id=$2', [token, u.id]); }
    return { ok: true, token, user: { id: u.id, username, name: u.name } };
  },

  async me(b, db) { return { ok: true, user: await auth(b, db) }; },

  /* 비밀번호 변경(로그인 상태): { token, oldPassword, newPassword } */
  async changePassword(b, db) {
    const user = await auth(b, db);
    const r = await db.query('select salt, pass_hash from users where id=$1', [user.id]);
    if (!r.length || hash(String(b.oldPassword || ''), r[0].salt) !== r[0].pass_hash) throw new Error('현재 비밀번호가 맞지 않아요');
    if (String(b.newPassword || '').length < 4) throw new Error('새 비밀번호는 4자 이상이어야 해요');
    const salt = crypto.randomUUID();
    await db.query('update users set pass_hash=$1, salt=$2 where id=$3', [hash(b.newPassword, salt), salt, user.id]);
    return { ok: true };
  },

  /* 닉네임 변경: { token, name } */
  async rename(b, db) {
    const user = await auth(b, db);
    const name = String(b.name || '').trim();
    if (!name) throw new Error('닉네임을 입력해 주세요');
    if (name.length > 20) throw new Error('닉네임은 20자까지 쓸 수 있어요');
    await db.query('update users set name=$1 where id=$2', [name, user.id]);
    // 프로필·팀·요청에 박혀 있는 표시 이름도 갱신
    await db.query(`update profiles set data = jsonb_set(data,'{name}',to_jsonb($1::text)) where user_id=$2`, [name, user.id]);
    return { ok: true, user: { ...user, name } };
  },

  /* 프로필 저장: { token, profile } */
  async saveProfile(b, db) {
    const user = await auth(b, db);
    const p = b.profile || {};
    const data = Object.assign({}, p, { userId: user.id, name: user.name });
    if (!['public', 'matchonly', 'private'].includes(data.visibility)) data.visibility = 'public';
    await db.query(`insert into profiles(user_id, data, updated) values($1,$2::jsonb,$3)
      on conflict(user_id) do update set data=excluded.data, updated=excluded.updated`, [user.id, J(data), now()]);
    return { ok: true };
  },

  /* 모든(볼 수 있는) 프로필 + 활동 기록. 프라이버시 게이팅 적용 */
  async listProfiles(b, db) {
    const viewer = await auth(b, db);
    const [prows, projects, revs] = await Promise.all([
      db.query('select user_id, data, updated from profiles', []),
      loadProjects(db),
      db.query('select to_id, data from reviews', []),
    ]);
    // 연결 관계: 같은 팀이거나, 둘 사이에 요청 기록이 있으면 connected
    const reqs = await db.query('select data from requests', []);
    const connectedIds = new Set();
    projects.forEach(p => { if (isMember(p, viewer.id)) [p.ownerId, ...(p.members || []).map(m => m.userId)].forEach(x => connectedIds.add(x)); });
    reqs.forEach(r => { const d = r.data || {}; if (d.fromId === viewer.id) connectedIds.add(d.toId); if (d.toId === viewer.id) connectedIds.add(d.fromId); });

    const out = [];
    for (const row of prows) {
      const d = row.data || {};
      const pid = String(row.user_id);
      const vis = ['public', 'matchonly', 'private'].includes(d.visibility) ? d.visibility : 'public';
      const self = pid === viewer.id;
      const connected = self || connectedIds.has(pid);
      if (!self && vis === 'private' && !connected) continue; // 비공개는 연결된 사이에게만
      // 활동 기록
      const kw = {};
      revs.filter(v => String(v.to_id) === pid).forEach(v => (((v.data || {}).keywords) || [])
        .forEach(k => { kw[k] = (kw[k] || 0) + 1; }));
      const activity = {
        completed: projects.filter(p => p.status === '완료' && isMember(p, pid)).length,
        teams: projects.filter(p => p.status !== '완료' && isMember(p, pid)).length,
        reviewCount: revs.filter(v => String(v.to_id) === pid).length,
        keywords: kw,
      };
      const prof = Object.assign({}, d, { userId: pid, name: d.name, updated: String(row.updated || '').slice(0, 16).replace('T', ' '),
        activity, visibility: vis, connected });
      // 연결되지 않은 상대에게는 자유 서술(관심 연구 소개·대표 경험)을 가림 — 매칭 점수엔 영향 없음
      if (!connected) { prof.intro = ''; prof.expNote = ''; prof.locked = true; }
      out.push(prof);
    }
    return { ok: true, profiles: out };
  },

  /* 프로젝트 저장(생성·수정): 팀원 누구나 수정, 공개설정·삭제는 개설자 */
  async saveProject(b, db) {
    const user = await auth(b, db);
    const p = b.project || {};
    let proj;
    if (p.id) {
      const projects = await loadProjects(db);
      proj = projects.find(x => x.id === String(p.id));
      if (!proj) throw new Error('프로젝트를 찾을 수 없어요');
      if (!isMember(proj, user.id)) throw new Error('팀원만 수정할 수 있어요');
      ['title', 'summary', 'topics', 'keywords', 'goals', 'hours', 'mode', 'chatLink', 'status'].forEach(k => { if (k in p) proj[k] = p[k]; });
      if ('visibility' in p) {
        if (proj.ownerId !== user.id && p.visibility !== proj.visibility) throw new Error('공개 설정은 개설자만 바꿀 수 있어요');
        proj.visibility = p.visibility === 'private' ? 'private' : 'public';
      }
      if ('slots' in p) proj.slots = mergeSlots(proj.slots, p.slots);
    } else {
      proj = { id: 'p' + uid(), ownerId: user.id, ownerName: user.name, created: now(),
        title: p.title, summary: p.summary, topics: p.topics || [], keywords: p.keywords || [], goals: p.goals || [],
        hours: p.hours, mode: p.mode, chatLink: p.chatLink || '', status: p.status || '모집 중',
        visibility: p.visibility === 'private' ? 'private' : 'public', members: [], slots: mergeSlots([], p.slots || []) };
    }
    if (!String(proj.title || '').trim()) throw new Error('연구 제목을 입력해 주세요');
    await saveProj(db, proj);
    return { ok: true, id: proj.id, project: proj };
  },

  async listProjects(b, db) {
    const user = await auth(b, db);
    const [projects, nm] = await Promise.all([loadProjects(db), nameMap(db)]);
    return { ok: true, projects: projects.filter(p => p.visibility !== 'private' || isMember(p, user.id)).map(p => freshProject(p, nm)) };
  },

  async deleteProject(b, db) {
    const user = await auth(b, db);
    const r = await db.query('select owner_id from projects where id=$1', [b.id]);
    if (!r.length) throw new Error('프로젝트를 찾을 수 없어요');
    if (String(r[0].owner_id) !== user.id) throw new Error('개설자만 삭제할 수 있어요');
    await db.query('delete from projects where id=$1', [b.id]);
    return { ok: true };
  },

  async leaveTeam(b, db) {
    const user = await auth(b, db);
    const projects = await loadProjects(db);
    const p = projects.find(x => x.id === String(b.id));
    if (!p) throw new Error('프로젝트를 찾을 수 없어요');
    if (p.ownerId === user.id) throw new Error('개설자는 팀을 나갈 수 없어요');
    p.members = (p.members || []).filter(m => m.userId !== user.id);
    (p.slots || []).forEach(s => { if (s.filledBy === user.id) s.filledBy = ''; });
    await saveProj(db, p);
    return { ok: true };
  },

  /* 요청 생성: invite(팀원→연구자 초대) / apply(공개 프로젝트에 참여 요청) */
  async createRequest(b, db) {
    const user = await auth(b, db);
    const q = b.request || {};
    const projects = await loadProjects(db);
    const p = projects.find(x => x.id === String(q.projectId || ''));
    if (!p) throw new Error('요청할 프로젝트 팀을 골라 주세요');
    const kind = q.kind === 'apply' ? 'apply' : 'invite';
    let toId = String(q.toId || ''), toName = String(q.toName || '');
    if (kind === 'apply') {
      if (isMember(p, user.id)) throw new Error('이미 이 팀의 팀원이에요');
      if (p.visibility === 'private') throw new Error('비공개 프로젝트라 초대로만 합류할 수 있어요');
      toId = p.ownerId; toName = p.ownerName;
    } else {
      if (!isMember(p, user.id)) throw new Error('팀원만 다른 연구자를 초대할 수 있어요');
      if (!toId) throw new Error('받는 사람이 없어요');
      if (toId === user.id) throw new Error('나에게는 요청할 수 없어요');
      if (isMember(p, toId)) throw new Error('이미 이 팀의 팀원이에요');
    }
    const joiner = kind === 'apply' ? user.id : toId;
    const existing = await db.query('select data, status from requests', []);
    const dup = existing.some(r => { const d = r.data || {}; return d.projectId === p.id && ACTIVE.includes(r.status) && joinerOf(d) === joiner; });
    if (dup) throw new Error('이 팀에 대해 이미 진행 중인 요청이 있어요');
    const id = 'q' + uid();
    const data = Object.assign({}, q, { id, kind, fromId: user.id, fromName: user.name, toId, toName,
      projectId: p.id, projectTitle: p.title, status: 'req', created: now() });
    await db.query('insert into requests(id, data, status, updated) values($1,$2::jsonb,$3,$4)', [id, J(data), 'req', now()]);
    return { ok: true, id };
  },

  async listRequests(b, db) {
    const user = await auth(b, db);
    const projects = await loadProjects(db);
    const myTeams = projects.filter(p => isMember(p, user.id)).map(p => p.id);
    const [rows, nm] = await Promise.all([db.query('select data, status, updated from requests', []), nameMap(db)]);
    const list = rows.map(r => Object.assign({}, r.data, { status: r.status, updated: String(r.updated || '').slice(0, 16).replace('T', ' ') }))
      .filter(d => d.fromId === user.id || d.toId === user.id || (d.kind === 'apply' && myTeams.includes(d.projectId)))
      .map(d => { if (nm[d.fromId]) d.fromName = nm[d.fromId]; if (nm[d.toId]) d.toName = nm[d.toId]; return d; });
    return { ok: true, requests: list };
  },

  async updateRequest(b, db) {
    const user = await auth(b, db);
    const rows = await db.query('select data, status from requests where id=$1', [b.id]);
    if (!rows.length) throw new Error('요청을 찾을 수 없어요');
    const data = rows[0].data || {}; const cur = rows[0].status;
    const projects = await loadProjects(db);
    const p = projects.find(x => x.id === data.projectId);
    const teamSide = p && isMember(p, user.id) && data.kind === 'apply';
    if (data.fromId !== user.id && data.toId !== user.id && !teamSide) throw new Error('이 요청을 바꿀 권한이 없어요');
    const patch = b.patch || {};
    if (cur === 'req' && (patch.status === 'acc' || patch.status === 'rej')) {
      const receiver = data.kind === 'apply' ? (p ? isMember(p, user.id) : data.toId === user.id) : data.toId === user.id;
      if (!receiver) throw new Error('요청을 받은 쪽만 수락·거절할 수 있어요');
    }
    if (patch.status === 'chat' && data.chat && data.chat.proposedBy === user.id) throw new Error('상대방이 제안한 일정 중에서 골라야 확정돼요');
    ['status', 'chat', 'agree', 'intent', 'reply', 'endReason', 'endMemo'].forEach(k => { if (k in patch) data[k] = patch[k]; });
    data.updatedBy = user.name; data.updatedById = user.id;
    if (patch.status === 'group') { if (p) { await joinTeam(db, p, data); data.projectId = p.id; data.projectTitle = p.title; } }
    await db.query('update requests set data=$1::jsonb, status=$2, updated=$3 where id=$4', [J(data), data.status || cur, now(), b.id]);
    return { ok: true };
  },

  /* 팀 메시지 */
  async sendMessage(b, db) {
    const user = await auth(b, db);
    const p = (await loadProjects(db)).find(x => x.id === String(b.projectId || ''));
    if (!p || !isMember(p, user.id)) throw new Error('팀원만 쓸 수 있어요');
    const text = String(b.text || '').trim();
    if (!text) throw new Error('내용을 입력해 주세요');
    if (text.length > 500) throw new Error('메시지는 500자까지 쓸 수 있어요');
    await db.query('insert into messages(id, project_id, data, created) values($1,$2,$3::jsonb,$4)',
      ['m' + uid(), p.id, J({ userId: user.id, name: user.name, text }), now()]);
    return { ok: true };
  },
  async listMessages(b, db) {
    const user = await auth(b, db);
    const p = (await loadProjects(db)).find(x => x.id === String(b.projectId || ''));
    if (!p || !isMember(p, user.id)) throw new Error('팀원만 볼 수 있어요');
    const [rows, nm] = await Promise.all([db.query('select id, data, created from messages where project_id=$1 order by seq asc', [p.id]), nameMap(db)]);
    return { ok: true, messages: rows.slice(-200).map(r => ({ id: r.id, userId: r.data.userId, name: nm[r.data.userId] || r.data.name, text: r.data.text,
      time: String(r.created || '') })) };
  },

  /* 후기 (완료된 프로젝트의 팀원끼리) */
  async saveReview(b, db) {
    const user = await auth(b, db);
    const p = (await loadProjects(db)).find(x => x.id === String(b.projectId || ''));
    if (!p || !isMember(p, user.id)) throw new Error('팀원만 볼 수 있어요');
    if (p.status !== '완료') throw new Error('프로젝트가 완료된 뒤에 후기를 남길 수 있어요');
    const toId = String(b.toId || '');
    if (!isMember(p, toId) || toId === user.id) throw new Error('같은 팀원에게만 후기를 남길 수 있어요');
    const toName = toId === p.ownerId ? p.ownerName : ((p.members || []).find(m => m.userId === toId) || {}).name;
    const kw = (b.keywords || []).slice(0, 5).map(String);
    const data = { keywords: kw, memo: String(b.memo || '').slice(0, 300), fromName: user.name, toName };
    const ex = await db.query('select id from reviews where project_id=$1 and from_id=$2 and to_id=$3', [p.id, user.id, toId]);
    if (ex.length) await db.query('update reviews set data=$1::jsonb, created=$2 where id=$3', [J(data), now(), ex[0].id]);
    else await db.query('insert into reviews(id, project_id, from_id, to_id, data, created) values($1,$2,$3,$4,$5::jsonb,$6)',
      ['r' + uid(), p.id, user.id, toId, J(data), now()]);
    return { ok: true };
  },
  async listReviews(b, db) {
    const user = await auth(b, db);
    const p = (await loadProjects(db)).find(x => x.id === String(b.projectId || ''));
    if (!p || !isMember(p, user.id)) throw new Error('팀원만 볼 수 있어요');
    const [rows, nm] = await Promise.all([db.query('select from_id, to_id, data, created from reviews where project_id=$1', [p.id]), nameMap(db)]);
    return { ok: true, reviews: rows.map(r => ({ fromId: r.from_id, fromName: nm[r.from_id] || r.data.fromName, toId: r.to_id, toName: nm[r.to_id] || r.data.toName,
      keywords: r.data.keywords || [], memo: r.data.memo || '', time: String(r.created || '') })) };
  },
};

async function dispatch(action, body, db) {
  const fn = actions[action];
  if (!fn) throw new Error('알 수 없는 요청이에요: ' + action);
  return await fn(body, db);
}

module.exports = { ensureSchema, dispatch, actions };
