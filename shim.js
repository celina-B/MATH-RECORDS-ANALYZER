// exam-analysis.html 맨 위(본문 스크립트보다 앞)에서 불러오는 연결 코드.
// 기존 앱이 쓰는 claude.use('db'|'sample'|'assets'|'downloads') 를 Supabase + /api/claude 로 대신 처리합니다.
// 로그인하지 않으면 앱 본문이 시작되지 않습니다.
(function () {
  const SUPABASE_URL = 'https://oenngemiydqbkfgnxgia.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_c1ylACuS9X6xzHeO1jHxHA_JGCSVlbK'; // 공개용 키(RLS가 보호)
  const ID_DOMAIN = '@cheongra.example.com'; // 아이디만 입력하면 뒤에 자동으로 붙는 내부용 주소(실제 메일 아님)
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const css = `#gate{position:fixed;inset:0;z-index:99999;background:#f4f4f4;display:flex;align-items:center;justify-content:center;font-family:system-ui,'Malgun Gothic',sans-serif}
  #gate form{background:#fff;border:1px solid #ddd;border-radius:12px;padding:32px;width:min(360px,90vw)}
  #gate h1{font-size:18px;margin:0 0 4px;color:#3B3D3F}#gate p{font-size:13px;color:#777;margin:0 0 18px}
  #gate input{width:100%;box-sizing:border-box;padding:10px;margin-bottom:10px;border:1px solid #ccc;border-radius:8px;font-size:14px}
  #gate button{width:100%;padding:11px;border:0;border-radius:8px;background:#C8202B;color:#fff;font-size:14px;cursor:pointer}
  #gate .err{color:#C8202B;font-size:13px;min-height:18px;margin-top:8px}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function gate(msg) {
    return new Promise(resolve => {
      const g = document.createElement('div'); g.id = 'gate';
      g.innerHTML = `<form><h1>청라 내신 분석실</h1><p>허용된 선생님만 사용할 수 있습니다.</p>
        <input type="text" id="g-e" placeholder="아이디" autocomplete="username" autocapitalize="off" required>
        <input type="password" id="g-p" placeholder="비밀번호" autocomplete="current-password" required>
        <button>로그인</button><div class="err">${msg || ''}</div></form>`;
      document.body.appendChild(g);
      g.querySelector('form').onsubmit = async ev => {
        ev.preventDefault();
        const id = g.querySelector('#g-e').value.trim().toLowerCase();
        const { error } = await sb.auth.signInWithPassword({ email: id.includes('@') ? id : id + ID_DOMAIN, password: g.querySelector('#g-p').value });
        if (error) { g.querySelector('.err').textContent = '이메일 또는 비밀번호가 올바르지 않습니다.'; return; }
        g.remove(); resolve();
      };
    });
  }

  // 비밀번호 변경 창. force=true 이면 닫을 수 없고, 바꿔야만 앱이 열립니다(처음 로그인).
  function openPwModal(force) {
    return new Promise(resolve => {
      const m = document.createElement('div');
      m.style.cssText = 'position:fixed;inset:0;z-index:99998;background:' + (force ? '#f4f4f4' : 'rgba(0,0,0,.4)') + ';display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,"Malgun Gothic",sans-serif';
      m.innerHTML = '<form style="background:#fff;border:1px solid #ddd;border-radius:12px;padding:28px;width:min(360px,100%)">'
        + '<b style="font-size:17px;color:#3B3D3F">' + (force ? '처음 로그인하셨습니다' : '비밀번호 변경') + '</b>'
        + (force ? '<div style="font-size:13px;color:#777;margin-top:6px;line-height:1.5">안전을 위해 새 비밀번호를 정해 주세요. 정한 뒤에 앱이 열립니다.</div>' : '')
        + '<input type="password" id="pw1" placeholder="새 비밀번호 (6자 이상)" autocomplete="new-password" style="width:100%;box-sizing:border-box;padding:10px;margin:14px 0 8px;border:1px solid #ccc;border-radius:8px;font-size:14px" required>'
        + '<input type="password" id="pw2" placeholder="새 비밀번호 한 번 더" autocomplete="new-password" style="width:100%;box-sizing:border-box;padding:10px;margin-bottom:8px;border:1px solid #ccc;border-radius:8px;font-size:14px" required>'
        + '<div id="pwmsg" style="min-height:18px;font-size:13px;color:#C8202B"></div>'
        + '<div style="display:flex;gap:8px;margin-top:8px"><button style="flex:1;padding:10px;border:0;border-radius:8px;background:#C8202B;color:#fff;font-size:14px;cursor:pointer">변경</button>'
        + (force ? '' : '<button type="button" id="pwx" style="flex:1;padding:10px;border:1px solid #ccc;border-radius:8px;background:#fff;font-size:14px;cursor:pointer">닫기</button>')
        + '</div></form>';
      document.body.appendChild(m);
      const x = m.querySelector('#pwx');
      if (x) x.onclick = () => { m.remove(); resolve(false); };
      m.querySelector('form').onsubmit = async ev => {
        ev.preventDefault();
        const p1 = m.querySelector('#pw1').value, p2 = m.querySelector('#pw2').value, msg = m.querySelector('#pwmsg');
        const { data: { session } } = await sb.auth.getSession();
        const myId = ((session && session.user.email) || '').replace(ID_DOMAIN, '').toLowerCase();
        if (p1.length < 6) { msg.textContent = '6자 이상으로 정해 주세요.'; return; }
        if (p1.toLowerCase() === myId) { msg.textContent = '아이디와 다른 비밀번호로 정해 주세요.'; return; }
        if (p1 !== p2) { msg.textContent = '두 번 입력한 비밀번호가 다릅니다.'; return; }
        const { error } = await sb.auth.updateUser({ password: p1, data: { must_change_password: false } });
        if (error) { msg.textContent = '변경하지 못했습니다: ' + error.message; return; }
        msg.style.color = '#3B3D3F'; msg.textContent = '비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 쓰세요.';
        setTimeout(() => { m.remove(); resolve(true); }, 1200);
      };
    });
  }

  async function ensureAccess() {
    for (;;) {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { await gate(); continue; }
      const { data } = await sb.from('profiles').select('approved,role,name').eq('id', session.user.id).single();
      if (data && data.approved) {
        if (session.user.user_metadata && session.user.user_metadata.must_change_password) await openPwModal(true);
        return { session, role: data.role, name: data.name };
      }
      await sb.auth.signOut();
      await gate('이 계정은 아직 허용되지 않았습니다. 원장님께 문의하세요.');
    }
  }

  // ---- 분석 비용 표시: 호출이 5초간 없으면 "작업 완료"로 보고 이번 작업 비용을 띄웁니다 ----
  const KRW_PER_USD = 1400; // 환산용 대략값(실제 청구는 달러 기준)
  const run = { calls: 0, usd: 0, input: 0, output: 0 };   // 이번 작업
  const tot = { calls: 0, usd: 0 };                        // 이번 접속 전체
  let costTimer = null;
  const fmt = u => `$${u.toFixed(3)} (약 ${Math.round(u * KRW_PER_USD).toLocaleString('ko-KR')}원)`;
  function costAdd(u) {
    if (!u) return;
    run.calls++; run.usd += u.costUsd || 0; run.input += u.input || 0; run.output += u.output || 0;
    tot.calls++; tot.usd += u.costUsd || 0;
    clearTimeout(costTimer);
    costTimer = setTimeout(costShow, 5000);
  }
  function costShow() {
    if (!run.calls) return;
    let el = document.getElementById('cost-toast');
    if (!el) {
      el = document.createElement('div'); el.id = 'cost-toast';
      el.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99998;background:#3B3D3F;color:#fff;border-radius:10px;padding:14px 16px;font:13px/1.6 system-ui,"Malgun Gothic",sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25);max-width:280px';
      document.body.appendChild(el);
    }
    el.innerHTML = `<b>분석 작업 완료</b><br>이번 작업 비용: <b>${fmt(run.usd)}</b><br>Claude 호출 ${run.calls}회 · 입력 ${run.input.toLocaleString('ko-KR')} / 출력 ${run.output.toLocaleString('ko-KR')} 토큰<br><span style="opacity:.7">이번 접속 누적 ${fmt(tot.usd)} · ${tot.calls}회</span><br><a href="#" style="color:#fff;text-decoration:underline">닫기</a>`;
    el.querySelector('a').onclick = ev => { ev.preventDefault(); el.remove(); };
    run.calls = 0; run.usd = 0; run.input = 0; run.output = 0;
  }

  const blobToB64 = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(b); });
  const who = () => sb.auth.getSession().then(s => s.data.session?.user?.email || '');

  const db = {
    doc(path) {
      return {
        async get() {
          const { data } = await sb.from('docs').select('data').eq('path', path).maybeSingle();
          return { exists: !!data, data: () => data && data.data };
        },
        async set(obj) {
          const { error } = await sb.from('docs').upsert({ path, data: obj, updated_at: new Date().toISOString(), updated_by: await who() });
          if (error) throw error;
        },
        async delete() { const { error } = await sb.from('docs').delete().eq('path', path); if (error) throw error; }
      };
    },
    collection(name) {
      return {
        async get() {
          const { data, error } = await sb.from('docs').select('path,data').like('path', name + '/%');
          if (error) throw error;
          return { docs: (data || []).map(r => ({ id: r.path.slice(name.length + 1), data: () => r.data })) };
        }
      };
    }
  };

  // Claude 답에 설명 문장(수식의 { 포함)이 앞에 붙어도, 그 안의 진짜 JSON 덩어리를 찾아냅니다.
  function extractJson(t) {
    t = String(t || '');
    const ends = [];
    for (let k = 0; k < t.length; k++) if (t[k] === '}' || t[k] === ']') ends.push(k);
    let tries = 0;
    for (let s = 0; s < t.length; s++) {
      const c = t[s];
      if (c !== '{' && c !== '[') continue;
      for (let e = ends.length - 1; e >= 0 && ends[e] > s; e--) {
        if (t[ends[e]] !== (c === '{' ? '}' : ']')) continue;
        if (++tries > 4000) throw new Error('결과를 읽지 못했습니다. 다시 시도하세요.');
        try { return JSON.parse(t.slice(s, ends[e] + 1)); } catch (_) {}
      }
    }
    throw Object.assign(new Error('결과를 읽지 못했습니다. 다시 시도하세요.'), { code: 'invalid_json' });
  }

  const sample = {
    async limits() { return { images: { maxCount: 6 } }; },
    async json(prompt, opts = {}) {
      const { data: { session } } = await sb.auth.getSession();
      const images = [];
      for (const im of opts.images || []) {
        const blob = im instanceof Blob ? im : await (await fetch(im)).blob();
        images.push({ media_type: blob.type || 'image/jpeg', data: await blobToB64(blob) });
      }
      const r = await fetch(SUPABASE_URL + '/functions/v1/claude', {
        method: 'POST', signal: opts.signal,
        headers: { 'content-type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ prompt, images })
      });
      const out = await r.json();
      if (!r.ok) throw Object.assign(new Error(out.error || '분석 실패'), { code: r.status });
      costAdd(out.usage);
      return extractJson(out.text);
    }
  };

  // 앱의 사진 글자읽기(ocr)는 sample(...)을 함수로 불러 {text}를 받습니다. 원래 환경과 같게 함수 + limits/json 으로 만듭니다.
  const sampleFn = Object.assign(async (prompt, opts = {}) => {
    const { data: { session } } = await sb.auth.getSession();
    const images = [];
    for (const im of opts.images || []) {
      const blob = im instanceof Blob ? im : await (await fetch(im)).blob();
      images.push({ media_type: blob.type || 'image/jpeg', data: await blobToB64(blob) });
    }
    const r = await fetch(SUPABASE_URL + '/functions/v1/claude', {
      method: 'POST', signal: opts.signal,
      headers: { 'content-type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ prompt, images })
    });
    const out = await r.json();
    if (!r.ok) throw Object.assign(new Error(out.error || '분석 실패'), { code: r.status });
    costAdd(out.usage);
    return { text: out.text };
  }, { limits: sample.limits, json: sample.json });

  const assets = {
    async upload(file) {
      const id = crypto.randomUUID();
      const { error } = await sb.storage.from('files').upload(id, file, { contentType: file.type || 'application/octet-stream' });
      if (error) throw error;
      return { id };
    },
    async delete(id) { await sb.storage.from('files').remove([id]); }
  };

  const downloads = {
    async save({ filename, data }) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data]));
      a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
  };

  // 앱이 원본 파일을 '/_blob/<id>' 주소로 읽으므로, 이 주소를 Supabase 파일 보관함으로 연결합니다.
  const _fetch = window.fetch.bind(window);
  window.fetch = (u, o) => {
    if (typeof u === 'string' && u.startsWith('/_blob/')) {
      return sb.storage.from('files').download(u.slice(7)).then(({ data, error }) => error ? new Response(null, { status: 404 }) : new Response(data));
    }
    return _fetch(u, o);
  };

  // '원본' 링크(/_blob/<id>)를 눌렀을 때 보관함에서 내려받아 새 탭에 PDF로 열어 줍니다.
  document.addEventListener('click', async ev => {
    const a = ev.target.closest && ev.target.closest('a[href^="/_blob/"]');
    if (!a) return;
    ev.preventDefault();
    const w = window.open('about:blank', '_blank');
    const { data, error } = await sb.storage.from('files').download(a.getAttribute('href').slice(7));
    if (error || !data) { if (w) w.close(); alert('원본 파일을 불러오지 못했습니다.'); return; }
    const url = URL.createObjectURL(new Blob([data], { type: data.type && data.type !== 'application/octet-stream' ? data.type : 'application/pdf' }));
    if (w) w.location = url; else location.href = url;
  }, true);

  // 앱 본문이 `claude.use(...)` 를 호출하기 전에 로그인이 끝나도록 막아 둡니다.
  const ready = ensureAccess();
  window.claude = { use: async name => { await ready; return ({ db, sample: sampleFn, assets, downloads })[name]; } };
  window.logout = () => sb.auth.signOut().then(() => location.reload());

  // 바탕화면에 앱 설치 (크롬/엣지: 설치하면 바탕화면·시작 메뉴에 아이콘이 생깁니다)
  let installEv = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEv = e; });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  async function installApp() {
    if (installEv) { installEv.prompt(); await installEv.userChoice.catch(() => {}); installEv = null; return; }
    // 설치 창을 쓸 수 없는 경우: 바탕화면용 바로가기 파일(.url)을 내려받게 함
    const blob = new Blob(['[InternetShortcut]\r\nURL=' + location.origin + location.pathname + '\r\n'], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '청라 내신 분석실.url'; a.click();
    alert('바로가기 파일을 내려받았습니다. 파일을 바탕화면으로 옮기면 아이콘이 됩니다.\n(크롬 주소창 오른쪽의 설치 아이콘이 보이면 그것을 눌러도 됩니다.)');
  }
  // 오른쪽 위 계정 표시: 이름, 비밀번호 변경, 로그아웃
  ready.then(info => {
    const id = (info.session.user.email || '').replace(ID_DOMAIN, '');
    const chip = document.createElement('div');
    chip.className = 'noprint';
    chip.style.cssText = 'position:fixed;top:8px;right:8px;z-index:9500;display:flex;gap:10px;align-items:center;background:#fff;border:1px solid #ddd;border-radius:999px;padding:5px 14px;font:12px system-ui,"Malgun Gothic",sans-serif;color:#3B3D3F;box-shadow:0 1px 6px rgba(0,0,0,.12)';
    const inApp = matchMedia('(display-mode: standalone)').matches;
    chip.innerHTML = `<b>${(info.name || id).replace(/</g, '')}</b><a href="#" data-a="pw" style="color:#C8202B">비밀번호 변경</a><a href="#" data-a="out" style="color:#777">로그아웃</a>${inApp ? '' : '<a href="#" data-a="inst" style="color:#0a7d3b">바탕화면에 앱 설치</a>'}`;
    document.body.appendChild(chip);
    chip.onclick = ev => {
      const a = ev.target.closest('a[data-a]'); if (!a) return; ev.preventDefault();
      if (a.dataset.a === 'out') return window.logout();
      if (a.dataset.a === 'inst') return installApp();
      openPwModal(false);
    };
  });
})();
