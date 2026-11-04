// exam-analysis.html 맨 위(본문 스크립트보다 앞)에서 불러오는 연결 코드.
// 기존 앱이 쓰는 claude.use('db'|'sample'|'assets'|'downloads') 를 Supabase + /api/claude 로 대신 처리합니다.
// 로그인하지 않으면 앱 본문이 시작되지 않습니다.
(function () {
  const SUPABASE_URL = 'https://oenngemiydqbkfgnxgia.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_c1ylACuS9X6xzHeO1jHxHA_JGCSVlbK'; // 공개용 키(RLS가 보호)
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
        <input type="email" id="g-e" placeholder="이메일" autocomplete="username" required>
        <input type="password" id="g-p" placeholder="비밀번호" autocomplete="current-password" required>
        <button>로그인</button><div class="err">${msg || ''}</div></form>`;
      document.body.appendChild(g);
      g.querySelector('form').onsubmit = async ev => {
        ev.preventDefault();
        const { error } = await sb.auth.signInWithPassword({ email: g.querySelector('#g-e').value.trim(), password: g.querySelector('#g-p').value });
        if (error) { g.querySelector('.err').textContent = '이메일 또는 비밀번호가 올바르지 않습니다.'; return; }
        g.remove(); resolve();
      };
    });
  }

  async function ensureAccess() {
    for (;;) {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { await gate(); continue; }
      const { data } = await sb.from('profiles').select('approved,role,name').eq('id', session.user.id).single();
      if (data && data.approved) return { session, role: data.role, name: data.name };
      await sb.auth.signOut();
      await gate('이 계정은 아직 허용되지 않았습니다. 원장님께 문의하세요.');
    }
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
      const t = out.text, i = t.search(/[\[{]/), j = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
      return JSON.parse(t.slice(i, j + 1));
    }
  };

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

  // 앱 본문이 `claude.use(...)` 를 호출하기 전에 로그인이 끝나도록 막아 둡니다.
  const ready = ensureAccess();
  window.claude = { use: async name => { await ready; return ({ db, sample, assets, downloads })[name]; } };
  window.logout = () => sb.auth.signOut().then(() => location.reload());
})();
