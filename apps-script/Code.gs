/**
 * =========================================================
 *  연구해듀오 — 구글 스프레드시트 서버 (Apps Script)  v0.3
 *  ▶ 기존 코드를 전부 지우고 이 코드로 바꾼 뒤
 *    [배포 → 배포 관리 → 연필(수정) → 버전: 새 버전 → 배포] 하세요. (주소 그대로 유지)
 *
 *  v0.3 변경
 *   - 프로젝트 = 팀 : 멤버·자리(채워짐) 관리, 공개/비공개, 상태(모집 중/진행 중/완료)
 *   - 요청: 기여 의향(intent), 팀 초대(invite)/참여 요청(apply), 팀원 누구나 지원자 처리
 *   - 팀 메시지, 협업 후기
 *   - v0.2 데이터 자동 이전 (처음 한 번만 실행됨)
 * =========================================================
 */
const SERVER_VERSION = 'v0.3';

const SHEETS = {
  users:    { name: '회원',     headers: ['id', '아이디', '이름', '비밀번호(암호화)', 'salt', 'token', '가입일'] },
  profiles: { name: '프로필',   headers: ['userId', '이름', '학과', '과정', '관심 주제', '연구 역량', '필요한 역량', '경험', '목표 성과', '주당 시간', '협업 방식', '참여 가능', '수정일', 'data'] },
  projects: { name: '프로젝트', headers: ['id', 'ownerId', '개설자', '제목', '필요 전문성', '공개', '상태', '멤버', '수정일', 'data'] },
  requests: { name: '요청',     headers: ['id', 'fromId', '보낸 사람', 'toId', '받는 사람', '내용', '상태', '수정일', 'data'] },
  messages: { name: '팀메시지', headers: ['id', 'projectId', 'userId', '이름', '내용', '시간'] },
  reviews:  { name: '후기',     headers: ['id', 'projectId', 'fromId', '보낸 사람', 'toId', '받는 사람', '키워드', '메모', '시간'] },
};
const ACTIVE = ['req', 'acc', 'chat'];

/* 주소를 브라우저로 열었을 때: 서버 상태 확인용 */
function doGet() {
  return json_({ ok: true, service: 'researchduo', version: SERVER_VERSION, time: now_() });
}

/* 사이트에서 오는 모든 요청 */
function doPost(e) {
  let body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: '잘못된 요청 형식이에요' });
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    migrate_();
    const fn = ACTIONS[body.action];
    if (!fn) return json_({ ok: false, error: '알 수 없는 요청이에요: ' + body.action });
    return json_(fn(body));
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

/* =================== 요청 종류 =================== */
const ACTIONS = {
  ping: () => ({ ok: true, version: SERVER_VERSION, time: now_() }),

  /* ---------- 회원 ---------- */
  signup(b) {
    const name = String(b.name || '').trim();
    const username = String(b.username || '').trim().toLowerCase();
    const password = String(b.password || '');
    if (!name) throw new Error('이름을 입력해 주세요');
    if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new Error('아이디는 영문 소문자·숫자·_ 3~20자로 만들어 주세요');
    if (password.length < 4) throw new Error('비밀번호는 4자 이상이어야 해요');
    if (rows_('users').some(r => String(r.obj['아이디']) === username)) throw new Error('이미 사용 중인 아이디예요');
    const id = 'u' + uid_();
    const salt = Utilities.getUuid();
    const token = Utilities.getUuid();
    append_('users', { id, '아이디': username, '이름': name, '비밀번호(암호화)': hash_(password, salt), salt, token, '가입일': now_() });
    return { ok: true, token, user: { id, username, name } };
  },

  login(b) {
    const username = String(b.username || '').trim().toLowerCase();
    const u = rows_('users').find(r => String(r.obj['아이디']) === username);
    if (!u || hash_(String(b.password || ''), String(u.obj.salt)) !== String(u.obj['비밀번호(암호화)'])) {
      throw new Error('아이디 또는 비밀번호가 맞지 않아요');
    }
    let token = String(u.obj.token || '');
    if (!token) {
      token = Utilities.getUuid();
      setCell_('users', u.row, 'token', token);
    }
    return { ok: true, token, user: { id: String(u.obj.id), username, name: String(u.obj['이름']) } };
  },

  me(b) { return { ok: true, user: auth_(b.token) }; },

  /* ---------- 프로필 ---------- */
  saveProfile(b) {
    const user = auth_(b.token);
    const p = b.profile || {};
    const data = Object.assign({}, p, { userId: user.id, name: user.name });
    upsert_('profiles', 'userId', user.id, {
      userId: user.id, '이름': user.name, '학과': p.dept, '과정': p.degree,
      '관심 주제': list_(p.topics), '연구 역량': list_((p.skills || []).map(s => s.tag + (s.level ? '(' + s.level + ')' : ''))),
      '필요한 역량': list_(p.needs), '경험': expText_(p.exp), '목표 성과': list_(p.goals),
      '주당 시간': p.hours ? p.hours[0] + '~' + p.hours[1] + '시간' : '', '협업 방식': p.mode,
      '참여 가능': p.available === false ? 'X' : 'O', '수정일': now_(), data: JSON.stringify(data),
    });
    return { ok: true };
  },

  /* 모든 프로필 + 활동 기록(완료한 협업 수, 받은 후기 키워드) */
  listProfiles(b) {
    auth_(b.token);
    const projects = projects_();
    const reviews = rows_('reviews').map(r => r.obj);
    const profiles = rows_('profiles').map(r => {
      const uid = String(r.obj.userId);
      const kw = {};
      reviews.filter(v => String(v.toId) === uid).forEach(v => {
        String(v['키워드'] || '').split(',').map(s => s.trim()).filter(Boolean).forEach(k => { kw[k] = (kw[k] || 0) + 1; });
      });
      return Object.assign(parse_(r.obj.data), {
        userId: uid, name: String(r.obj['이름']), updated: String(r.obj['수정일']),
        activity: {
          completed: projects.filter(p => p.status === '완료' && isMember_(p, uid)).length,
          teams: projects.filter(p => p.status !== '완료' && isMember_(p, uid)).length,
          reviewCount: reviews.filter(v => String(v.toId) === uid).length,
          keywords: kw,
        },
      });
    });
    return { ok: true, profiles };
  },

  /* ---------- 프로젝트 = 팀 ---------- */
  /* 새로 만들기·수정: { token, project } — 팀원 누구나 수정 가능, 공개 설정·삭제는 개설자만 */
  saveProject(b) {
    const user = auth_(b.token);
    const p = b.project || {};
    let proj;
    if (p.id) {
      proj = projects_().find(x => x.id === String(p.id));
      if (!proj) throw new Error('프로젝트를 찾을 수 없어요');
      if (!isMember_(proj, user.id)) throw new Error('팀원만 수정할 수 있어요');
      ['title', 'summary', 'topics', 'keywords', 'goals', 'hours', 'mode', 'chatLink', 'status'].forEach(k => { if (k in p) proj[k] = p[k]; });
      if ('visibility' in p) {
        if (proj.ownerId !== user.id && p.visibility !== proj.visibility) throw new Error('공개 설정은 개설자만 바꿀 수 있어요');
        proj.visibility = p.visibility;
      }
      if ('slots' in p) proj.slots = mergeSlots_(proj.slots, p.slots);
    } else {
      proj = {
        id: 'p' + uid_(), ownerId: user.id, ownerName: user.name, created: now_(),
        title: p.title, summary: p.summary, topics: p.topics || [], keywords: p.keywords || [], goals: p.goals || [],
        hours: p.hours, mode: p.mode, chatLink: p.chatLink || '', status: p.status || '모집 중',
        visibility: p.visibility === 'private' ? 'private' : 'public', members: [], slots: mergeSlots_([], p.slots || []),
      };
    }
    if (!String(proj.title || '').trim()) throw new Error('연구 제목을 입력해 주세요');
    saveProj_(proj);
    return { ok: true, id: proj.id, project: proj };
  },

  /* 볼 수 있는 프로젝트: 공개 프로젝트 + 내가 팀원인 프로젝트 */
  listProjects(b) {
    const user = auth_(b.token);
    return { ok: true, projects: projects_().filter(p => p.visibility !== 'private' || isMember_(p, user.id)).map(clean0_) };
  },

  deleteProject(b) {
    const user = auth_(b.token);
    const p = projects_().find(x => x.id === String(b.id));
    if (!p) throw new Error('프로젝트를 찾을 수 없어요');
    if (p.ownerId !== user.id) throw new Error('개설자만 삭제할 수 있어요');
    sheet_('projects').deleteRow(p._row);
    return { ok: true };
  },

  /* 팀 나가기 (개설자 제외) */
  leaveTeam(b) {
    const user = auth_(b.token);
    const p = projects_().find(x => x.id === String(b.id));
    if (!p) throw new Error('프로젝트를 찾을 수 없어요');
    if (p.ownerId === user.id) throw new Error('개설자는 팀을 나갈 수 없어요');
    p.members = (p.members || []).filter(m => m.userId !== user.id);
    (p.slots || []).forEach(s => { if (s.filledBy === user.id) s.filledBy = ''; });
    saveProj_(p);
    return { ok: true };
  },

  /* ---------- 요청 ---------- */
  /* { token, request: { kind:'invite'|'apply', projectId, toId?, toName?, slotId, role, message, intent, score } }
     invite = 팀원이 다른 연구자를 팀에 초대 / apply = 공개 프로젝트에 참여 요청 (개설자에게 감) */
  createRequest(b) {
    const user = auth_(b.token);
    const q = b.request || {};
    const p = projects_().find(x => x.id === String(q.projectId || ''));
    if (!p) throw new Error('요청할 프로젝트 팀을 골라 주세요');
    const kind = q.kind === 'apply' ? 'apply' : 'invite';
    let toId = String(q.toId || ''), toName = String(q.toName || '');
    if (kind === 'apply') {
      if (isMember_(p, user.id)) throw new Error('이미 이 팀의 팀원이에요');
      if (p.visibility === 'private') throw new Error('비공개 프로젝트라 초대로만 합류할 수 있어요');
      toId = p.ownerId; toName = p.ownerName;
    } else {
      if (!isMember_(p, user.id)) throw new Error('팀원만 다른 연구자를 초대할 수 있어요');
      if (!toId) throw new Error('받는 사람이 없어요');
      if (toId === user.id) throw new Error('나에게는 요청할 수 없어요');
      if (isMember_(p, toId)) throw new Error('이미 이 팀의 팀원이에요');
    }
    const joiner = kind === 'apply' ? user.id : toId;
    const dup = rows_('requests').some(r => {
      const d = parse_(r.obj.data);
      return d.projectId === p.id && ACTIVE.indexOf(String(r.obj['상태'])) >= 0 && joinerOf_(d) === joiner;
    });
    if (dup) throw new Error('이 팀에 대해 이미 진행 중인 요청이 있어요');
    const id = 'q' + uid_();
    const data = Object.assign({}, q, { id, kind, fromId: user.id, fromName: user.name, toId, toName,
      projectId: p.id, projectTitle: p.title, status: 'req', created: now_() });
    append_('requests', { id, fromId: user.id, '보낸 사람': user.name, toId, '받는 사람': toName,
      '내용': q.message, '상태': 'req', '수정일': now_(), data: JSON.stringify(data) });
    return { ok: true, id };
  },

  /* 내가 보내거나 받은 요청 + 내 팀에 들어온 참여 요청 */
  listRequests(b) {
    const user = auth_(b.token);
    const myTeams = projects_().filter(p => isMember_(p, user.id)).map(p => p.id);
    const list = rows_('requests')
      .map(r => Object.assign(parse_(r.obj.data), { status: String(r.obj['상태']), updated: String(r.obj['수정일']) }))
      .filter(d => d.fromId === user.id || d.toId === user.id || (d.kind === 'apply' && myTeams.indexOf(d.projectId) >= 0));
    return { ok: true, requests: list };
  },

  /* 요청 진행: { token, id, patch: { status, chat, agree, intent, reply, endReason, endMemo } } */
  updateRequest(b) {
    const user = auth_(b.token);
    const ex = rows_('requests').find(r => String(r.obj.id) === String(b.id));
    if (!ex) throw new Error('요청을 찾을 수 없어요');
    const data = parse_(ex.obj.data);
    const cur = String(ex.obj['상태']);
    const projects = projects_();
    const p = projects.find(x => x.id === data.projectId);
    const teamSide = p && isMember_(p, user.id) && data.kind === 'apply';
    if (data.fromId !== user.id && data.toId !== user.id && !teamSide) throw new Error('이 요청을 바꿀 권한이 없어요');

    const patch = b.patch || {};
    // 수락·거절은 받은 쪽만 (참여 요청은 팀원 누구나)
    if (cur === 'req' && (patch.status === 'acc' || patch.status === 'rej')) {
      const receiver = data.kind === 'apply' ? (p ? isMember_(p, user.id) : data.toId === user.id) : data.toId === user.id;
      if (!receiver) throw new Error('요청을 받은 쪽만 수락·거절할 수 있어요');
    }
    // 커피챗 확정은 일정을 제안받은 사람만
    if (patch.status === 'chat' && data.chat && data.chat.proposedBy === user.id) {
      throw new Error('상대방이 제안한 일정 중에서 골라야 확정돼요');
    }
    ['status', 'chat', 'agree', 'intent', 'reply', 'endReason', 'endMemo'].forEach(k => { if (k in patch) data[k] = patch[k]; });
    data.updatedBy = user.name;
    data.updatedById = user.id;

    // 그룹 결성 → 팀에 합류
    if (patch.status === 'group') {
      let team = p;
      if (!team) team = legacyTeam_(data, projects);
      joinTeam_(team, data);
      data.projectId = team.id;
      data.projectTitle = team.title;
    }
    writeRow_('requests', ex.row, { '상태': data.status || cur, '수정일': now_(), data: JSON.stringify(data) });
    return { ok: true };
  },

  /* ---------- 팀 메시지 ---------- */
  sendMessage(b) {
    const user = auth_(b.token);
    const p = teamFor_(b.projectId, user);
    const text = String(b.text || '').trim();
    if (!text) throw new Error('내용을 입력해 주세요');
    if (text.length > 500) throw new Error('메시지는 500자까지 쓸 수 있어요');
    append_('messages', { id: 'm' + uid_(), projectId: p.id, userId: user.id, '이름': user.name, '내용': text, '시간': now_() });
    return { ok: true };
  },

  listMessages(b) {
    const user = auth_(b.token);
    const p = teamFor_(b.projectId, user);
    const list = rows_('messages').filter(r => String(r.obj.projectId) === p.id).map(r => ({
      id: String(r.obj.id), userId: String(r.obj.userId), name: String(r.obj['이름']), text: String(r.obj['내용']), time: String(r.obj['시간']),
    }));
    return { ok: true, messages: list.slice(-200) };
  },

  /* ---------- 후기 (완료된 프로젝트의 팀원끼리) ---------- */
  saveReview(b) {
    const user = auth_(b.token);
    const p = teamFor_(b.projectId, user);
    if (p.status !== '완료') throw new Error('프로젝트가 완료된 뒤에 후기를 남길 수 있어요');
    const toId = String(b.toId || '');
    if (!isMember_(p, toId) || toId === user.id) throw new Error('같은 팀원에게만 후기를 남길 수 있어요');
    const toName = toId === p.ownerId ? p.ownerName : ((p.members || []).find(m => m.userId === toId) || {}).name;
    const kw = (b.keywords || []).slice(0, 5).map(String);
    const obj = { projectId: p.id, fromId: user.id, '보낸 사람': user.name, toId, '받는 사람': toName,
      '키워드': kw.join(', '), '메모': String(b.memo || '').slice(0, 300), '시간': now_() };
    const ex = rows_('reviews').find(r => String(r.obj.projectId) === p.id && String(r.obj.fromId) === user.id && String(r.obj.toId) === toId);
    if (ex) writeRow_('reviews', ex.row, obj);
    else append_('reviews', Object.assign({ id: 'r' + uid_() }, obj));
    return { ok: true };
  },

  listReviews(b) {
    const user = auth_(b.token);
    const p = teamFor_(b.projectId, user);
    return { ok: true, reviews: rows_('reviews').filter(r => String(r.obj.projectId) === p.id).map(r => ({
      fromId: String(r.obj.fromId), fromName: String(r.obj['보낸 사람']), toId: String(r.obj.toId), toName: String(r.obj['받는 사람']),
      keywords: String(r.obj['키워드'] || '').split(',').map(s => s.trim()).filter(Boolean), memo: String(r.obj['메모'] || ''), time: String(r.obj['시간']),
    })) };
  },
};

/* =================== 팀 관련 도우미 =================== */
function projects_() {
  return rows_('projects').map(r => {
    const d = parse_(r.obj.data);
    d.id = String(d.id || r.obj.id);
    d.ownerId = String(d.ownerId || r.obj.ownerId);
    d.ownerName = d.ownerName || String(r.obj['개설자'] || '');
    d.members = Array.isArray(d.members) ? d.members : [];
    d.slots = (Array.isArray(d.slots) ? d.slots : []).map((s, i) => Object.assign({ id: 's' + i, filledBy: '' }, s));
    d.visibility = d.visibility === 'private' ? 'private' : 'public';
    d.status = d.status || '모집 중';
    d.updated = String(r.obj['수정일'] || '');
    d._row = r.row;
    return d;
  });
}

function saveProj_(p) {
  const d = clean0_(p);
  const slots = (d.slots || []).filter(s => s.tag).map(s => s.tag + (s.filledBy ? ' ✓' : ''));
  const names = [d.ownerName].concat((d.members || []).map(m => m.name));
  upsert_('projects', 'id', d.id, {
    id: d.id, ownerId: d.ownerId, '개설자': d.ownerName, '제목': d.title, '필요 전문성': slots.join(', '),
    '공개': d.visibility === 'private' ? '비공개' : '공개', '상태': d.status, '멤버': names.join(', '),
    '수정일': now_(), data: JSON.stringify(d),
  });
}

function clean0_(p) { const d = Object.assign({}, p); delete d._row; return d; }

function isMember_(p, uid) {
  if (!p || !uid) return false;
  return p.ownerId === String(uid) || (p.members || []).some(m => m.userId === String(uid));
}

function teamFor_(projectId, user) {
  const p = projects_().find(x => x.id === String(projectId || ''));
  if (!p) throw new Error('프로젝트 팀을 찾을 수 없어요');
  if (!isMember_(p, user.id)) throw new Error('팀원만 볼 수 있어요');
  return p;
}

/* 자리 합치기: 기존 자리의 id·채워진 사람은 유지, 새 자리는 id 부여 */
function mergeSlots_(oldSlots, newSlots) {
  const byId = {};
  (oldSlots || []).forEach(s => { if (s.id) byId[s.id] = s; });
  return (newSlots || []).map(s => {
    const prev = s.id && byId[s.id];
    return {
      id: s.id || 's' + uid_().slice(0, 6), tag: s.tag || '', raw: s.raw || s.tag || '',
      level: +s.level || 2, role: s.role || '', filledBy: prev ? (prev.filledBy || '') : (s.filledBy || ''),
    };
  });
}

function joinerOf_(d) { return d.kind === 'apply' ? d.fromId : d.toId; }

function joinTeam_(team, data) {
  const joinerId = joinerOf_(data);
  const joinerName = data.kind === 'apply' ? data.fromName : data.toName;
  const agree = data.agree || {}, intent = data.intent || {};
  const slotId = agree.slotId || intent.slotId || data.slotId || '';
  if (!isMember_(team, joinerId)) {
    team.members.push({ userId: joinerId, name: joinerName, slotId, role: agree.role || data.role || '',
      period: agree.period || intent.period || '', author: agree.author || '', contribution: intent.contribution || '',
      hours: intent.hours || '', joined: now_() });
  }
  const slot = (team.slots || []).find(s => s.id === slotId);
  if (slot && !slot.filledBy) slot.filledBy = joinerId;
  if (team.status === '모집 중' && (team.slots || []).length && team.slots.every(s => s.filledBy)) team.status = '진행 중';
  saveProj_(team);
}

/* v0.2의 개인 간 요청(프로젝트 없음)이 그룹이 되면 → 비공개 팀을 만들어 줌 */
function legacyTeam_(data, projects) {
  const title = data.projectTitle || (data.fromName + ' × ' + data.toName + ' 공동 연구');
  let team = projects.find(p => p.ownerId === data.fromId && p.title === title);
  if (!team) {
    team = { id: 'p' + uid_(), ownerId: data.fromId, ownerName: data.fromName, created: now_(), title,
      summary: '', topics: [], keywords: [], goals: [], hours: null, mode: '', chatLink: '', status: '진행 중',
      visibility: 'private', members: [], slots: [] };
    projects.push(team);
  }
  if (data.kind !== 'apply') data.kind = 'invite';
  return team;
}

/* v0.2 → v0.3 데이터 이전 (한 번만) */
function migrate_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('migrated') === SERVER_VERSION) return;
  SHEETS_CHECKED = {};
  Object.keys(SHEETS).forEach(k => sheet_(k));   // 탭·제목줄 맞추기
  const projects = projects_();
  projects.forEach(p => saveProj_(p));             // 새 칸(공개·상태·멤버) 채우기
  rows_('requests').forEach(r => {
    const d = parse_(r.obj.data);
    let changed = false;
    if (d.kind === 'cast') { d.kind = 'invite'; changed = true; }
    const st = String(r.obj['상태']);
    if (st === 'group') {
      let team = projects.find(p => p.id === d.projectId);
      if (!team) { team = legacyTeam_(d, projects); changed = true; }
      if (!isMember_(team, joinerOf_(d))) joinTeam_(team, d);
      if (d.projectId !== team.id) { d.projectId = team.id; d.projectTitle = team.title; changed = true; }
    }
    if (changed) writeRow_('requests', r.row, { data: JSON.stringify(d) });
  });
  props.setProperty('migrated', SERVER_VERSION);
}

/* =================== 시트 도우미 =================== */
let SHEETS_CHECKED = {};

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(key) {
  const def = SHEETS[key];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(def.name);
  if (!sh) {
    sh = ss.insertSheet(def.name);
    sh.appendRow(def.headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, def.headers.length).setFontWeight('bold');
    sh.getRange(1, 1, sh.getMaxRows(), def.headers.length).setNumberFormat('@');
    SHEETS_CHECKED[key] = true;
  } else if (!SHEETS_CHECKED[key]) {
    ensureHeaders_(sh, def);
    SHEETS_CHECKED[key] = true;
  }
  return sh;
}

/* 제목줄이 바뀌었으면(예: v0.2 프로젝트 탭) 기존 내용을 새 칸 순서로 다시 씀 */
function ensureHeaders_(sh, def) {
  const values = sh.getDataRange().getValues();
  const old = (values[0] || []).map(String);
  const same = old.length >= def.headers.length && def.headers.every((h, i) => old[i] === h);
  if (same) return;
  const out = [def.headers].concat(values.slice(1).map(r => def.headers.map(h => {
    const j = old.indexOf(h);
    return j >= 0 ? r[j] : '';
  })));
  sh.clearContents();
  sh.getRange(1, 1, sh.getMaxRows(), def.headers.length).setNumberFormat('@');
  sh.getRange(1, 1, out.length, def.headers.length).setValues(out);
  sh.getRange(1, 1, 1, def.headers.length).setFontWeight('bold');
}

function rows_(key) {
  const values = sheet_(key).getDataRange().getValues();
  const headers = values.shift() || [];
  return values.map((r, i) => {
    const obj = {};
    headers.forEach((h, j) => { obj[h] = r[j]; });
    return { row: i + 2, obj };
  }).filter(x => String(x.obj[headers[0]] || '') !== '');
}

function rowArr_(key, obj) { return SHEETS[key].headers.map(h => clean_(obj[h])); }
function append_(key, obj) { sheet_(key).appendRow(rowArr_(key, obj)); }

function writeRow_(key, row, obj) {
  const sh = sheet_(key);
  SHEETS[key].headers.forEach((h, j) => { if (h in obj) sh.getRange(row, j + 1).setValue(clean_(obj[h])); });
}
function setCell_(key, row, header, value) { writeRow_(key, row, { [header]: value }); }

function upsert_(key, idCol, idVal, obj) {
  const found = rows_(key).find(r => String(r.obj[idCol]) === String(idVal));
  if (found) sheet_(key).getRange(found.row, 1, 1, SHEETS[key].headers.length).setValues([rowArr_(key, obj)]);
  else append_(key, obj);
}

function auth_(token) {
  if (!token) throw new Error('로그인이 필요해요');
  const u = rows_('users').find(r => String(r.obj.token) === String(token));
  if (!u) throw new Error('로그인이 만료됐어요. 다시 로그인해 주세요');
  return { id: String(u.obj.id), username: String(u.obj['아이디']), name: String(u.obj['이름']) };
}

function hash_(pw, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pw, Utilities.Charset.UTF_8);
  return bytes.map(x => ((x + 256) % 256).toString(16).padStart(2, '0')).join('');
}

/* 시트에서 수식으로 바뀌지 않게 막기 (=, +, -, @ 로 시작하는 글자) */
function clean_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v !== 'string') return v;
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function uid_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function list_(arr) { return Array.isArray(arr) ? arr.filter(Boolean).join(', ') : (arr || ''); }
function expText_(e) {
  if (!e) return '';
  return ['논문 ' + (e.papers || 0), '학회 ' + (e.talks || 0), '프로젝트 ' + (e.projects || 0)].join(' · ');
}
function parse_(s) { try { return JSON.parse(s) || {}; } catch (e) { return {}; } }
function now_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'); }
