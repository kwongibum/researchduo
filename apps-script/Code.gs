/**
 * =========================================================
 *  연구해듀오 — 구글 스프레드시트 서버 (Apps Script)
 *  이 코드를 스프레드시트의 [확장 프로그램 → Apps Script]에 붙여넣고
 *  [배포 → 새 배포 → 웹 앱]으로 배포하세요.
 *  처음 요청이 오면 '회원', '프로필', '프로젝트', '요청' 탭이 자동으로 만들어져요.
 * =========================================================
 */

const SHEETS = {
  users:    { name: '회원',    headers: ['id', '아이디', '이름', '비밀번호(암호화)', 'salt', 'token', '가입일'] },
  profiles: { name: '프로필',  headers: ['userId', '이름', '학과', '과정', '관심 주제', '연구 역량', '필요한 역량', '경험', '목표 성과', '주당 시간', '협업 방식', '참여 가능', '수정일', 'data'] },
  projects: { name: '프로젝트', headers: ['id', 'ownerId', '개설자', '제목', '필요 전문성', '수정일', 'data'] },
  requests: { name: '요청',    headers: ['id', 'fromId', '보낸 사람', 'toId', '받는 사람', '내용', '상태', '수정일', 'data'] },
};

/* 주소를 브라우저로 열었을 때: 서버가 살아있는지 확인용 */
function doGet() {
  return json_({ ok: true, service: 'researchduo', time: now_() });
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
  lock.waitLock(20000);
  try {
    const fn = ACTIONS[body.action];
    if (!fn) return json_({ ok: false, error: '알 수 없는 요청이에요: ' + body.action });
    return json_(fn(body));
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- 요청 종류 ---------------- */
const ACTIONS = {
  ping: () => ({ ok: true, time: now_() }),

  /* 회원가입: { name, username, password } */
  signup(b) {
    const name = String(b.name || '').trim();
    const username = String(b.username || '').trim().toLowerCase();
    const password = String(b.password || '');
    if (!name) throw new Error('이름을 입력해 주세요');
    if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new Error('아이디는 영문 소문자·숫자·_ 3~20자로 만들어 주세요');
    if (password.length < 4) throw new Error('비밀번호는 4자 이상이어야 해요');
    if (rows_('users').some(r => String(r.obj['아이디']) === username)) throw new Error('이미 사용 중인 아이디예요');
    const id = 'u' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
    const salt = Utilities.getUuid();
    const token = Utilities.getUuid();
    sheet_('users').appendRow([id, clean_(username), clean_(name), hash_(password, salt), salt, token, now_()]);
    return { ok: true, token, user: { id, username, name } };
  },

  /* 로그인: { username, password } */
  login(b) {
    const username = String(b.username || '').trim().toLowerCase();
    const u = rows_('users').find(r => String(r.obj['아이디']) === username);
    if (!u || hash_(String(b.password || ''), String(u.obj.salt)) !== String(u.obj['비밀번호(암호화)'])) {
      throw new Error('아이디 또는 비밀번호가 맞지 않아요');
    }
    let token = String(u.obj.token || '');
    if (!token) {
      token = Utilities.getUuid();
      sheet_('users').getRange(u.row, 6).setValue(token);
    }
    return { ok: true, token, user: { id: String(u.obj.id), username, name: String(u.obj['이름']) } };
  },

  /* 로그인 상태 확인: { token } */
  me(b) {
    return { ok: true, user: auth_(b.token) };
  },

  /* 내 프로필 저장: { token, profile } */
  saveProfile(b) {
    const user = auth_(b.token);
    const p = b.profile || {};
    const data = JSON.stringify(Object.assign({}, p, { userId: user.id, name: user.name }));
    const row = [
      user.id, user.name, p.dept, p.degree,
      list_(p.topics), list_((p.skills || []).map(s => s.tag + (s.level ? '(' + s.level + ')' : ''))),
      list_(p.needs), expText_(p.exp), list_(p.goals),
      p.hours ? p.hours[0] + '~' + p.hours[1] + '시간' : '', p.mode,
      p.available === false ? 'X' : 'O', now_(), data,
    ].map(clean_);
    upsert_('profiles', 'userId', user.id, row);
    return { ok: true };
  },

  /* 모든 프로필 보기 (로그인 필요): { token } */
  listProfiles(b) {
    auth_(b.token);
    const profiles = rows_('profiles').map(r => Object.assign(parse_(r.obj.data), {
      userId: String(r.obj.userId), name: String(r.obj['이름']), updated: String(r.obj['수정일']),
    }));
    return { ok: true, profiles };
  },

  /* 프로젝트 저장(새로 만들기·수정): { token, project } */
  saveProject(b) {
    const user = auth_(b.token);
    const p = b.project || {};
    let id = p.id;
    if (id) {
      const ex = rows_('projects').find(r => String(r.obj.id) === String(id));
      if (ex && String(ex.obj.ownerId) !== user.id) throw new Error('내가 만든 프로젝트만 수정할 수 있어요');
    } else {
      id = 'p' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
    }
    const data = JSON.stringify(Object.assign({}, p, { id, ownerId: user.id, ownerName: user.name }));
    const row = [id, user.id, user.name, p.title, list_((p.slots || []).map(s => s.tag)), now_(), data].map(clean_);
    upsert_('projects', 'id', id, row);
    return { ok: true, id };
  },

  /* 모든 프로젝트 보기: { token } */
  listProjects(b) {
    auth_(b.token);
    return { ok: true, projects: rows_('projects').map(r => Object.assign(parse_(r.obj.data), { updated: String(r.obj['수정일']) })) };
  },

  /* 내 프로젝트 삭제: { token, id } */
  deleteProject(b) {
    const user = auth_(b.token);
    const ex = rows_('projects').find(r => String(r.obj.id) === String(b.id));
    if (!ex) throw new Error('프로젝트를 찾을 수 없어요');
    if (String(ex.obj.ownerId) !== user.id) throw new Error('내가 만든 프로젝트만 삭제할 수 있어요');
    sheet_('projects').deleteRow(ex.row);
    return { ok: true };
  },

  /* 협업 요청 보내기: { token, request: { toId, toName, message, role, projectTitle, ... } } */
  createRequest(b) {
    const user = auth_(b.token);
    const q = b.request || {};
    if (!q.toId) throw new Error('받는 사람이 없어요');
    if (String(q.toId) === user.id) throw new Error('나에게는 요청할 수 없어요');
    const active = ['req', 'acc', 'chat'];
    const dup = rows_('requests').some(r => String(r.obj.fromId) === user.id && String(r.obj.toId) === String(q.toId)
      && active.indexOf(String(r.obj['상태'])) >= 0 && String(parse_(r.obj.data).projectTitle || '') === String(q.projectTitle || ''));
    if (dup) throw new Error('이미 진행 중인 요청이 있어요');
    const id = 'q' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
    const data = Object.assign({}, q, { id, fromId: user.id, fromName: user.name, status: 'req', created: now_() });
    sheet_('requests').appendRow([id, user.id, user.name, q.toId, q.toName, q.message, 'req', now_(), JSON.stringify(data)].map(clean_));
    return { ok: true, id };
  },

  /* 내가 보내거나 받은 요청 보기: { token } */
  listRequests(b) {
    const user = auth_(b.token);
    const list = rows_('requests')
      .filter(r => String(r.obj.fromId) === user.id || String(r.obj.toId) === user.id)
      .map(r => Object.assign(parse_(r.obj.data), { status: String(r.obj['상태']), updated: String(r.obj['수정일']) }));
    return { ok: true, requests: list };
  },

  /* 요청 상태 바꾸기 (보낸 사람·받은 사람만): { token, id, patch: { status, chat, agree, endReason, endMemo, reply } } */
  updateRequest(b) {
    const user = auth_(b.token);
    const ex = rows_('requests').find(r => String(r.obj.id) === String(b.id));
    if (!ex) throw new Error('요청을 찾을 수 없어요');
    if (String(ex.obj.fromId) !== user.id && String(ex.obj.toId) !== user.id) throw new Error('이 요청을 바꿀 권한이 없어요');
    const allowed = ['status', 'chat', 'agree', 'endReason', 'endMemo', 'reply'];
    const data = parse_(ex.obj.data);
    const patch = b.patch || {};
    allowed.forEach(k => { if (k in patch) data[k] = patch[k]; });
    data.updatedBy = user.name;
    const sh = sheet_('requests');
    sh.getRange(ex.row, 7).setValue(clean_(data.status || ex.obj['상태']));
    sh.getRange(ex.row, 8).setValue(now_());
    sh.getRange(ex.row, 9).setValue(JSON.stringify(data));
    return { ok: true };
  },
};

/* ---------------- 도우미 함수 ---------------- */
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
    // 모든 칸을 '일반 텍스트'로: 날짜·숫자로 자동 변환되는 것 방지
    sh.getRange(1, 1, sh.getMaxRows(), def.headers.length).setNumberFormat('@');
  }
  return sh;
}

function rows_(key) {
  const values = sheet_(key).getDataRange().getValues();
  const headers = values.shift() || [];
  return values.map((r, i) => {
    const obj = {};
    headers.forEach((h, j) => { obj[h] = r[j]; });
    return { row: i + 2, obj };
  });
}

function upsert_(key, idCol, idVal, rowArr) {
  const sh = sheet_(key);
  const found = rows_(key).find(r => String(r.obj[idCol]) === String(idVal));
  if (found) sh.getRange(found.row, 1, 1, rowArr.length).setValues([rowArr]);
  else sh.appendRow(rowArr);
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

function list_(arr) { return Array.isArray(arr) ? arr.filter(Boolean).join(', ') : (arr || ''); }
function expText_(e) {
  if (!e) return '';
  return ['논문 ' + (e.papers || 0), '학회 ' + (e.talks || 0), '프로젝트 ' + (e.projects || 0)].join(' · ');
}
function parse_(s) { try { return JSON.parse(s) || {}; } catch (e) { return {}; } }
function now_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'); }
