/* =========================================================
   로그인·회원가입 (features/auth/login.js)
   성공하면 RD.session 에 { token, user } 를 저장하고 원래 가려던 페이지로 이동해요.
   ========================================================= */
(() => {
  const $ = s => document.querySelector(s);
  const next = new URLSearchParams(location.search).get('next');

  /* 이미 로그인되어 있으면 바로 이동 */
  if (RD.session.user()) go();

  document.querySelectorAll('.atab').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.atab').forEach(x => x.classList.toggle('on', x === b));
      $('#loginForm').classList.toggle('hide', b.dataset.t !== 'login');
      $('#signupForm').classList.toggle('hide', b.dataset.t !== 'signup');
    };
  });
  if (location.hash === '#signup') document.querySelector('.atab[data-t=signup]').click();

  function showErr(el, msg) { el.textContent = msg; el.classList.remove('hide'); }

  async function go() {
    // 프로필이 아직 없으면 프로필 작성 페이지로 안내
    if (next) { location.href = next; return; }
    try {
      const { profiles } = await RD.api('listProfiles');
      const mine = profiles.find(p => p.userId === RD.session.user().id);
      location.href = RD.url(mine ? 'features/matching/matching.html' : 'features/profile/profile.html');
    } catch (e) {
      location.href = RD.url('features/profile/profile.html');
    }
  }

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const err = $('#lerr'); err.classList.add('hide');
    const username = $('#lu').value.trim(), password = $('#lp').value;
    if (!username || !password) return showErr(err, '아이디와 비밀번호를 입력해 주세요');
    btn.classList.add('busy'); btn.textContent = '로그인 중…';
    try {
      const r = await RD.api('login', { username, password });
      RD.session.set({ token: r.token, user: r.user });
      RD.toast(`${r.user.name}님, 반가워요`);
      await go();
    } catch (ex) {
      showErr(err, ex.message);
    } finally {
      btn.classList.remove('busy'); btn.textContent = '로그인';
    }
  });

  $('#signupForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const err = $('#serr'); err.classList.add('hide');
    const name = $('#sn').value.trim(), username = $('#su').value.trim().toLowerCase();
    const password = $('#sp').value, password2 = $('#sp2').value;
    if (!name) return showErr(err, '이름을 입력해 주세요');
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return showErr(err, '아이디는 영문 소문자·숫자·_ 3~20자로 만들어 주세요');
    if (password.length < 4) return showErr(err, '비밀번호는 4자 이상이어야 해요');
    if (password !== password2) return showErr(err, '비밀번호 확인이 일치하지 않아요');
    btn.classList.add('busy'); btn.textContent = '가입 중…';
    try {
      const r = await RD.api('signup', { name, username, password });
      RD.session.set({ token: r.token, user: r.user });
      RD.toast('가입 완료! 이제 연구 프로필을 만들어 주세요');
      location.href = next || RD.url('features/profile/profile.html');
    } catch (ex) {
      showErr(err, ex.message);
    } finally {
      btn.classList.remove('busy'); btn.textContent = '가입하고 시작하기';
    }
  });
})();
