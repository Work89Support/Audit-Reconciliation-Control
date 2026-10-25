/* =============================================================
   Sb - เชื่อมระบบเข้ากับ Supabase (คลังไฟล์ที่ n8n ส่งเข้ามา)

   สถาปัตยกรรม
     Gmail (label AUDIT 2) → n8n → Supabase Storage + Google Drive
                                 → ทะเบียน mail_batches / source_files
     ระบบนี้ → อ่านทะเบียน → โหลดไฟล์ต้นฉบับจาก Storage
             → แปลงในเบราว์เซอร์ด้วยตัวอ่านเดิม (formats/pdf-stm/xlsx-reader)
             → เขียนผลกลับ recon_runs / exceptions / damages

   ความปลอดภัย
     - ใช้ anon key เท่านั้น ห้ามใส่ service_role key ในหน้าเว็บ
     - ทุกตารางเปิด RLS ต้องล็อกอินด้วย Supabase Auth ก่อนจึงอ่านได้
   ============================================================= */

const Sb = (() => {
  let session = null; // { access_token, refresh_token, expires_at, user }
  let refreshInFlight = null;
  let refreshRetryAt = 0;
  const REFRESH_RETRY_KEY = "audit-sb-refresh-retry-at";
  // Read-only, tab-local snapshots. Never persist financial data or cache
  // approval RPCs. Scope to the authenticated user and project, not tokens.
  const fileSnapshots = new Map();
  const fileDownloads = new Map();
  const fileReads = new Map();
  let fileSnapshotGeneration = 0;
  const fileScope = () => signedIn() ? `${cfg().url}|${cfg().bucket}|${session.user.id || currentEmail()}` : null;
  function clearFileSnapshots() {
    fileSnapshotGeneration++;
    fileSnapshots.clear(); fileDownloads.clear(); fileReads.clear();
  }
  function batchSnapshotKey({from, to, company} = {}) {
    return JSON.stringify([fileScope(), from || '', to || '', company || 'ALL']);
  }
  function fileSnapshotInfo(input) {
    if (!fileScope()) return null;
    const entry = fileSnapshots.get(batchSnapshotKey(input));
    return entry ? {updatedAt: entry.at, stale: Date.now() - entry.at >= 60000} : null;
  }
  async function fileSnapshotRead(kind, key, force, load) {
    if (!fileScope()) throw new Error('กรุณาล็อกอินก่อนเปิดสแนปช็อตไฟล์');
    const map = kind === 'batches' ? fileSnapshots : fileDownloads;
    const ttl = kind === 'batches' ? 60000 : 300000;
    const copy = value => kind === 'batches' ? JSON.parse(JSON.stringify(value)) : value.slice(0);
    const entry = map.get(key);
    if (!force && entry && Date.now() - entry.at < ttl) return copy(entry.value);
    const pendingKey = `${kind}|${key}`;
    // A forced refresh is also single-flight: do not multiply the same request.
    if (fileReads.has(pendingKey)) return copy(await fileReads.get(pendingKey));
    const generation = fileSnapshotGeneration, scope = fileScope();
    const pending = (async () => {
      const value = await load();
      if (generation !== fileSnapshotGeneration || scope !== fileScope()) {
        throw new Error('ผู้ใช้หรือข้อมูลเปลี่ยนระหว่างโหลด กรุณาลองใหม่');
      }
      if (kind === 'batches' || value.byteLength <= 32 * 1024 * 1024) {
        map.delete(key);
        map.set(key, {value: copy(value), at: Date.now()});
        while (map.size > (kind === 'batches' ? 8 : 12) ||
          (kind === 'download' && [...map.values()].reduce((n, x) => n + x.value.byteLength, 0) > 32 * 1024 * 1024)) {
          map.delete(map.keys().next().value);
        }
      }
      return value;
    })();
    fileReads.set(pendingKey, pending);
    try { return copy(await pending); }
    finally { if (fileReads.get(pendingKey) === pending) fileReads.delete(pendingKey); }
  }

  /* ---------------- config ---------------- */
  const cfg = () => {
    const d = Store.data;
    const app = window.APP_CONFIG || {};
    if (!d.supabase) d.supabase = { email: "", autoSync: false, lastSync: null };
    d.supabase.url = app.supabaseUrl || d.supabase.url || "";
    d.supabase.anonKey = app.supabasePublishableKey || d.supabase.anonKey || "";
    d.supabase.bucket = app.storageBucket || d.supabase.bucket || "audit-files";
    return d.supabase;
  };
  function saveConfig(patch) {
    Object.assign(cfg(), patch);
    Store.persist();
    return cfg();
  }
  const configured = () => !!(cfg().url && cfg().anonKey);
  /* refresh token ยังใช้ต่ออายุได้ จึงถือว่ายังล็อกอินอยู่ระหว่างที่ access token
     หมดอายุ หลีกเลี่ยงอาการส่วนหัวมีอีเมลแต่บางหน้าขึ้นว่ายังไม่ได้เข้าสู่ระบบ */
  const signedIn = () => !!(session && session.user && (session.refresh_token || session.expires_at > Date.now() / 1000 + 30));
  const currentEmail = () => (session && session.user ? session.user.email : "");
  const authUser = () => (session && session.user ? session.user : null);

  /* เก็บ session แบบเดียวกับ Supabase client เพื่อให้ระบบยังล็อกอินอยู่หลังปิดแท็บ
     access token มีอายุสั้นและต่ออายุด้วย refresh token; ผู้ใช้กดออกจากระบบเพื่อล้างได้ */
  const SB_SESSION_KEY = "audit-sb-session";
  async function restore() {
    /* ล้าง session เก่าที่เวอร์ชันก่อนหน้าเคยเก็บถาวรใน localStorage ทิ้ง (migration ครั้งเดียว) */
    if (Store.data.sbSession) {
      delete Store.data.sbSession;
      Store.persist();
    }
    let s = null;
    try {
      s = JSON.parse(localStorage.getItem(SB_SESSION_KEY) || "null");
    } catch (e) {
      s = null;
    }
    if (s && s.expires_at > Date.now() / 1000 + 30) {
      session = s;
      if (!session.user) await loadAuthUser();
    }
    else if (s && s.refresh_token) {
      session = s;
      try {
        await refreshSession(s.refresh_token);
      } catch (e) {
        // A transient outage/429 is not a logout. Requests remain blocked by
        // refresh backoff; do not destroy the user's recoverable session.
      }
    }
    return signedIn();
  }
  function keep(s) {
    if (session?.user?.id !== s?.user?.id) clearFileSnapshots();
    session = s;
    try {
      localStorage.setItem(SB_SESSION_KEY, JSON.stringify(s));
    } catch (e) {
      /* sessionStorage ใช้ไม่ได้ก็เก็บแค่ในหน่วยความจำ — ปลอดภัยกว่าเก็บถาวร */
    }
  }

  async function readResponseBody(res, kind = 'text', timeoutMs = 15000) {
    let timer;
    try {
      return await Promise.race([res[kind](), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('ได้รับการตอบรับแล้ว แต่ข้อมูลตอบกลับค้างเกินเวลาที่กำหนด — เก็บสถานะเข้าสู่ระบบไว้ กรุณาลองเชื่อมต่อใหม่')), timeoutMs);
      })]);
    } finally { clearTimeout(timer); }
  }
  async function authFetch(url, opts = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...opts, signal: controller.signal });
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("ระบบเข้าสู่ระบบตอบกลับช้าเกิน 15 วินาที — กรุณาลองใหม่");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function refreshSession(refreshToken) {
    if (refreshInFlight) return refreshInFlight;
    const renew = async () => {
      // Another tab may already have rotated this refresh token while we
      // waited for the browser lock. Only adopt the same user's new session.
      try {
        const saved = JSON.parse(localStorage.getItem(SB_SESSION_KEY) || "null");
        if (saved?.refresh_token && saved.refresh_token !== refreshToken &&
            saved.user?.id === session?.user?.id && saved.expires_at > Date.now() / 1000 + 60) {
          session = saved;
          return saved.user;
        }
        refreshRetryAt = Math.max(refreshRetryAt, Number(localStorage.getItem(REFRESH_RETRY_KEY)) || 0);
      } catch (e) {}
      if (!session || session.refresh_token !== refreshToken) {
        throw new Error("สถานะเข้าสู่ระบบเปลี่ยนแล้ว — กรุณาลองใหม่");
      }
      if (Date.now() < refreshRetryAt) {
        throw new Error("ระบบต่ออายุล็อกอินกำลังพักคำขอ — กรุณารอสักครู่แล้วลองใหม่");
      }
      try {
        const res = await authFetch(base() + "/auth/v1/token?grant_type=refresh_token", {
          method: "POST",
          headers: { apikey: cfg().anonKey, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) {
          const retry = res.headers.get("Retry-After");
          const retryMs = /^\d+$/.test(retry || "") ? Number(retry) * 1000 : Date.parse(retry || "") - Date.now();
          const delay = Math.max(30000, Math.min(300000, Number.isFinite(retryMs) && retryMs > 0 ? retryMs : 60000));
          refreshRetryAt = Date.now() + delay;
          const j = await readResponseBody(res,'json').catch(() => ({}));
          throw new Error(res.status === 429 ? "คำขอต่ออายุล็อกอินมากเกินไป — ระบบพักการลองใหม่ชั่วคราว" :
            j.error_description || j.msg || j.message || "ต่ออายุการเข้าสู่ระบบไม่สำเร็จ");
        }
        const j = await readResponseBody(res,'json');
        if (!j.access_token || !j.refresh_token || !j.user?.id) {
          throw new Error("ข้อมูลต่ออายุล็อกอินไม่ครบ — กรุณาลองใหม่");
        }
        if (!session || session.refresh_token !== refreshToken) {
          throw new Error("สถานะเข้าสู่ระบบเปลี่ยนระหว่างต่ออายุ — กรุณาลองใหม่");
        }
        keep({ ...j, expires_at: Math.floor(Date.now() / 1000) + Number(j.expires_in || 3600) });
        refreshRetryAt = 0;
        try { localStorage.removeItem(REFRESH_RETRY_KEY); } catch (e) {}
        return j.user;
      } catch (error) {
        refreshRetryAt = Math.max(refreshRetryAt, Date.now() + 30000);
        try { localStorage.setItem(REFRESH_RETRY_KEY, String(refreshRetryAt)); } catch (e) {}
        throw error;
      }
    };
    // Web Locks coordinates same-origin tabs without exposing tokens. The
    // in-flight promise and shared cooldown still protect unsupported browsers.
    const locks = typeof navigator !== "undefined" ? navigator.locks : null;
    const pending = Promise.resolve().then(async () => {
      if (!locks?.request) return renew();
      // A suspended tab can hold this lock indefinitely. Cancel ONLY our
      // waiting request; never steal the lock or rotate tokens concurrently.
      const waiting = new AbortController();
      const waitTimer = setTimeout(() => waiting.abort(), 10000);
      try {
        return await locks.request("audit-sb-refresh-session", { signal: waiting.signal }, async () => {
          clearTimeout(waitTimer);
          return renew();
        });
      } catch (error) {
        if (waiting.signal.aborted && error?.name === "AbortError") {
          throw new Error("รอต่ออายุล็อกอินจากแท็บอื่นเกิน 10 วินาที — ไม่ได้ออกจากระบบ กรุณาลองเชื่อมต่อใหม่");
        }
        throw error;
      } finally {
        clearTimeout(waitTimer);
      }
    });
    refreshInFlight = pending;
    try { return await pending; }
    finally { if (refreshInFlight === pending) refreshInFlight = null; }
  }

  async function ensureFreshSession() {
    if (!session || !session.refresh_token) return signedIn();
    if (Number(session.expires_at || 0) > Date.now() / 1000 + 60) return true;
    await refreshSession(session.refresh_token);
    return true;
  }

  /* ---------------- HTTP ---------------- */
  function base() {
    const u = String(cfg().url || "").trim().replace(/\/+$/, "");
    if (!u) throw new Error("ยังไม่ได้ใส่ Supabase URL ในหน้าตั้งค่า");
    return u;
  }
  const headers = (extra) =>
    Object.assign(
      {
        apikey: cfg().anonKey,
        Authorization: "Bearer " + (session ? session.access_token : cfg().anonKey),
      },
      extra || {},
    );

  // Share only in-flight JSON reads. Never retain completed financial results,
  // share across identities, or coalesce a write/approval/upload.
  const pendingJsonReads = new Map();
  let readGeneration = 0;
  async function req(path, opts = {}) {
    // Invalidate before writes, including uncertain/timeout outcomes.
    if (opts.method && opts.method.toUpperCase() !== 'GET' && !opts.readOnly && !path.startsWith('/storage/v1/object/sign/')) {
      clearFileSnapshots();
      readGeneration++;
      pendingJsonReads.clear();
    }
    await ensureFreshSession();
    const controller = opts.signal ? null : new AbortController();
    const timeout = controller ? setTimeout(() => controller.abort(), Number(opts.timeoutMs || 30000)) : null;
    const fetchOpts = { ...opts, signal: opts.signal || controller.signal, headers: headers(opts.headers) };
    delete fetchOpts.timeoutMs;
    delete fetchOpts.readOnly;
    delete fetchOpts.recoverRead;
    try {
      let res = await fetch(base() + path, fetchOpts);
      /* token อาจถูกเพิกถอนก่อนเวลาที่บันทึกไว้ ลองต่ออายุอีกครั้งหนึ่งก่อนแจ้งผู้ใช้ */
      if (res.status === 401 && session && session.refresh_token) {
        if (fetchOpts.headers.Authorization === "Bearer " + session.access_token) {
          await refreshSession(session.refresh_token);
        }
        res = await fetch(base() + path, { ...fetchOpts, headers: headers(opts.headers) });
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error("ไม่มีสิทธิ์อ่านข้อมูล — ล็อกอิน Supabase ก่อน (RLS เปิดอยู่)");
      }
      if (!res.ok) {
        let msg = `Supabase ตอบกลับ ${res.status}`;
        try {
          const j = await readResponseBody(res,'json');
          msg = j.message || j.error_description || j.error || msg;
        } catch (e) {}
        const failure=new Error(msg);
        failure.retryableRead=[502,503,504].includes(res.status);
        throw failure;
      }
      return res;
    } catch (error) {
      if (error?.name === "AbortError") {
        const failure=new Error(`Supabase ใช้เวลาตอบกลับนานเกิน ${Math.ceil(Number(opts.timeoutMs || 30000) / 1000)} วินาที`);
        failure.retryableRead=true;throw failure;
      }
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
  const json = async (path, opts = {}) => {
    // These POST endpoints only read. Treating them as writes used to clear an
    // in-flight source-file snapshot while the daily summary was loading it.
    const readRpc=path.match(/^\/rest\/v1\/rpc\/([^?]+)(?:\?|$)/)?.[1];
    if(opts.method?.toUpperCase()==='POST'&&readOnlyCaseRpcs.has(readRpc))opts={...opts,readOnly:true};
    // Collections use the active case set; explicit detail/evidence/history reads stay intact.
    if((!opts.method||opts.method.toUpperCase()==='GET')&&!opts.includeHistorical){
      if(path.startsWith('/rest/v1/exceptions?')&&!/[?&]id=eq\./.test(path))path=path.replace('/rest/v1/exceptions?','/rest/v1/active_audit_exceptions?');
      for(const name of ['case_closure_requests','cross_day_pair_requests','cross_day_image_reviews','manual_case_pairs'])
        if(path.startsWith('/rest/v1/'+name+'?')&&/[?&]status=eq.pending(?:&|$)/.test(path))path=path.replace('/rest/v1/'+name+'?','/rest/v1/active_'+name+'?');
    }
    const actor = session?.user?.id || '';
    const read = (!opts.method || opts.method.toUpperCase() === 'GET' || opts.readOnly === true) && !opts.signal;
    const key = read ? JSON.stringify([base(), session?.access_token || '', actor, readGeneration, path, opts.headers || {}, opts.timeoutMs || 30000, opts.body || null]) : null;
    if (key && pendingJsonReads.has(key)) return pendingJsonReads.get(key);
    const generation=readGeneration;
    const pending = (async () => {
      // One bounded recovery for opted-in idempotent case reads only. Writes,
      // approvals, uploads and auth errors must never be replayed here.
      const recover=read&&(opts.recoverRead||opts.readOnly===true);
      let res;
      for(let attempt=0;attempt<2;attempt++){
        try {res=await req(path,recover?{...opts,timeoutMs:12000}:opts);break;}
        catch(error){
          const transient=error?.retryableRead||error?.name==='TypeError';
          if(!recover||attempt||!transient||actor!==(session?.user?.id||'')||generation!==readGeneration)throw error;
        }
      }
      const body = await readResponseBody(res,'text',Number(opts.timeoutMs || 15000));
      if (actor !== (session?.user?.id || '')) throw new Error('ผู้ใช้งานเปลี่ยนระหว่างโหลดข้อมูล กรุณาเปิดหน้าทำงานใหม่');
      return body ? JSON.parse(body) : null;
    })();
    if (key) pendingJsonReads.set(key, pending);
    try { return await pending; }
    finally { if (key && pendingJsonReads.get(key) === pending) pendingJsonReads.delete(key); }
  };

  /* ---------------- Auth ---------------- */
  const usernameDomain = '@users.audit.invalid';
  const loginIdentity = value => {
    const identifier = String(value || '').trim().toLowerCase();
    if (identifier.includes('@')) return identifier;
    if (!/^[a-z][a-z0-9_.-]{2,31}$/.test(identifier)) throw new Error('ชื่อผู้ใช้ต้องเป็นอังกฤษ 3–32 ตัว เริ่มด้วยตัวอักษร ใช้ตัวเลข _ . - ได้');
    return identifier + usernameDomain;
  };
  const displayLogin = value => String(value || '').endsWith(usernameDomain) ? String(value).slice(0,-usernameDomain.length) : String(value || '');
  async function signIn(email, password) {
    email = loginIdentity(email);
    const res = await authFetch(base() + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: cfg().anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const j = await readResponseBody(res,'json');
    if (!res.ok) throw new Error(j.error_description || j.msg || j.message || "ล็อกอินไม่สำเร็จ");
    keep({ ...j, expires_at: Math.floor(Date.now() / 1000) + Number(j.expires_in || 3600) });
    saveConfig({ email: displayLogin(email) });
    return j.user;
  }

  async function loadAuthUser() {
    if (!session || !session.access_token) return null;
    const res = await authFetch(base() + "/auth/v1/user", { headers: headers() });
    const user = await readResponseBody(res,'json');
    if (!res.ok) throw new Error(user.message || "อ่านข้อมูลผู้ใช้ไม่สำเร็จ");
    session.user = user;
    keep(session);
    return user;
  }

  async function consumeAuthHash() {
    const params = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
    const type = params.get("type");
    if (!params.get("access_token")) return null;
    if (type && !["magiclink", "recovery", "signup", "invite"].includes(type)) return null;
    keep({
      access_token: params.get("access_token"),
      refresh_token: params.get("refresh_token") || "",
      expires_at: Math.floor(Date.now() / 1000) + Number(params.get("expires_in") || 3600),
      user: null,
    });
    await loadAuthUser();
    history.replaceState(null, "", location.pathname + location.search + "#/cloud");
    return type || "oauth";
  }

  function signInWithGoogle() {
    const redirect = location.origin + location.pathname.replace(/index\.html$/, "");
    location.assign(base() + "/auth/v1/authorize?provider=google&redirect_to=" + encodeURIComponent(redirect));
  }

  async function requestMagicLink(email) {
    const redirect = location.origin + location.pathname.replace(/index\.html$/, "");
    const res = await fetch(base() + "/auth/v1/otp?redirect_to=" + encodeURIComponent(redirect), {
      method: "POST",
      headers: { apikey: cfg().anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, create_user: false }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error_description || j.msg || j.message || "ส่งลิงก์เข้าใช้งานไม่สำเร็จ");
    saveConfig({ email });
    return true;
  }

  async function requestPasswordReset(email) {
    if (!String(email || '').includes('@') || String(email).endsWith(usernameDomain)) throw new Error('บัญชีชื่อผู้ใช้ไม่มีอีเมลรับลิงก์ กรุณาติดต่อผู้ดูแลระบบเรื่องรหัสผ่าน');
    const redirect = location.origin + location.pathname.replace(/index\.html$/, "");
    const res = await fetch(base() + "/auth/v1/recover?redirect_to=" + encodeURIComponent(redirect), {
      method: "POST",
      headers: { apikey: cfg().anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error_description || j.msg || j.message || "ส่งอีเมลไม่สำเร็จ");
    return true;
  }

  async function updatePassword(password) {
    const res = await fetch(base() + "/auth/v1/user", {
      method: "PUT",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ password }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error_description || j.msg || j.message || "บันทึกรหัสผ่านไม่สำเร็จ");
    return j;
  }

  const passwordChangeRequired = () => rpc('password_change_required');
  const passwordAccount = body => json('/functions/v1/password-accounts', {
    method:'POST',headers:{'Content-Type':'application/json'},timeoutMs:45000,body:JSON.stringify(body),
  });

  function signOut() {
    clearFileSnapshots();
    readGeneration++;
    pendingJsonReads.clear();
    session = null;
    try {
      localStorage.removeItem(SB_SESSION_KEY);
    } catch (e) {}
    if (Store.data.sbSession) {
      delete Store.data.sbSession;
      Store.persist();
    }
  }

  /* ---------------- ทะเบียนไฟล์ ---------------- */
  const q = (o) =>
    Object.entries(o)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");

  /* สรุปรายวัน (view) — กรองที่ฐานข้อมูลเพื่อลดเวลารอและปริมาณข้อมูล */
  function rangedView(name, order, input, defaultLimit) {
    const opts = typeof input === "number" ? { limit: input } : (input || {});
    const columns = name === 'v_recon_quality' ? 'business_date,company,business_system,status,missing_groups,file_count,error_count,is_archived,run_id,run_at,stm_count,bo_count,matched,match_rate,exception_count' : '*';
    const filters = [`select=${columns}`, `order=${order}`, `limit=${opts.limit || defaultLimit}`];
    if (opts.from) filters.push(`business_date=gte.${encodeURIComponent(opts.from)}`);
    if (opts.to) filters.push(`business_date=lte.${encodeURIComponent(opts.to)}`);
    if (opts.company && opts.company !== "ALL") filters.push(`company=eq.${encodeURIComponent(opts.company)}`);
    return json(`/rest/v1/${name}?${filters.join("&")}`);
  }

  async function primaryOverlays(rows,{caseCountsOnly=false}={}){
    if(!rows.length)return rows;
    const dates=rows.map(r=>r.business_date).sort(),companies=[...new Set(rows.map(r=>r.company))];
    const versions=await json(`/rest/v1/manual_primary_results?business_date=gte.${dates[0]}&business_date=lte.${dates[dates.length-1]}&company=in.(${companies.map(encodeURIComponent).join(',')})&select=company,business_date&limit=1000`);
    const scopes=new Set(versions.map(r=>r.company+'|'+r.business_date)),resolved=new Map(),unavailable=new Map(),checked=new Set();
    const pendingScopes=rows.filter(row=>{
      const key=row.company+'|'+row.business_date;
      if(!scopes.has(key)||checked.has(key))return false;
      checked.add(key);return true;
    });
    // A slow unrelated company must not serialize every accepted result.
    // Bound concurrency, and share only identical in-flight authenticated reads.
    for(let offset=0;offset<pendingScopes.length;offset+=3)await Promise.all(
      pendingScopes.slice(offset,offset+3).map(async row=>{
        const key=row.company+'|'+row.business_date;
        try{const v=await readManualPrimary(row.company,row.business_date);if(v?.stale)unavailable.set(key,v);else if(v)resolved.set(key,v);}
        catch(e){unavailable.set(key,{stale:false,message:e.message});}
      }));
    let manual=[],holds=[],workflowStatusError='';
    if(caseCountsOnly){
      const filter=`business_date=gte.${dates[0]}&business_date=lte.${dates[dates.length-1]}&company=in.(${companies.map(encodeURIComponent).join(',')})`;
      const extra=await Promise.allSettled([
        json(`/rest/v1/account_recheck_jobs?${filter}&select=id,company,business_date,account,direction,mode,status,created_at,confirmed_at,selected_file_ids&order=created_at.desc,id.desc&limit=1000`),
        json(`/rest/v1/audit_run_holds?${filter}&select=company,business_date,paused&limit=1000`)
      ]);
      if(extra[0].status==='fulfilled')manual=extra[0].value;else workflowStatusError='สถานะรันมือยังโหลดไม่สำเร็จ';
      if(manual.length>=1000)workflowStatusError='สถานะรันมือมีมากกว่าขอบเขตที่โหลด กรุณาเลือกช่วงวันหรือบริษัทให้แคบลง';
      if(extra[1].status==='fulfilled')holds=extra[1].value;else workflowStatusError+=' · สถานะพักรันยังโหลดไม่สำเร็จ';
    }
return rows.map(row=>{const key=row.company+'|'+row.business_date,v=resolved.get(key),problem=unavailable.get(key),scopedError=[workflowStatusError,problem?row.company+' '+row.business_date+' · '+problem.message:''].filter(Boolean).join(' · ');const counts=v?.case_set?{open_count:v.case_set.open_count,closed_count:v.case_set.closed_count,resolved_count:v.case_set.closed_count}:v?{open_count:null,closed_count:null,resolved_count:null}:{};if(caseCountsOnly)return {...row,primaryResult:v||null,primaryFileCount:v?manual.find(q=>q.id===v.recheck_id)?.selected_file_ids?.length??null:null,...counts,rechecks:manual.filter(q=>q.company===row.company&&q.business_date===row.business_date),latestRecheck:manual.find(q=>q.company===row.company&&q.business_date===row.business_date)||null,autoPaused:holds.some(q=>q.company===row.company&&q.business_date===row.business_date&&q.paused),primaryUnavailable:problem||null,workflowStatusError:scopedError};if(!v)return problem?{...row,primaryResult:null,primaryUnavailable:problem,workflowStatusError:scopedError}:row;const r=v.report;return {...row,stm_count:r.stm_count,bo_count:r.bo_count,matched:r.matched,exception_count:(r.exceptions?.length||0)+(r.summary?.waiting_bo?.length||0),match_rate:r.stm_count?100*r.matched/r.stm_count:0,primaryResult:v,...counts};});
  }
  const dailyStatus = async (opts = 30) => primaryOverlays(await rangedView("v_daily_status", "business_date.desc", opts, 30));
  const operations = async (opts = 100) => {
    const rows=await primaryOverlays(await rangedView("v_recon_operations", "business_date.desc,company.asc", opts, 100));
    if(!rows.length)return rows;
    const dates=rows.map(j=>j.business_date).sort();
    try{
      const notices=await rpc('audit_run_notices',{p_from:dates[0],p_to:dates[dates.length-1],p_company:typeof opts==='object'&&opts.company&&opts.company!=='ALL'?opts.company:null});
      const byScope=new Map(notices.map(n=>[n.company+'|'+n.business_date,n]));
      return rows.map(j=>({...j,runNotice:byScope.get(j.company+'|'+j.business_date)||null,runNoticeError:!byScope.has(j.company+'|'+j.business_date)}));
    }catch{return rows.map(j=>({...j,runNotice:null,runNoticeError:true}));}
  };
  const quality = async (opts = 1000) => primaryOverlays(await rangedView("v_recon_quality", "business_date.desc,company.asc", opts, 1000));

  async function dailyChecklist({ from, to, company, limit = 5000 } = {}) {
    if (from && to) {
      // Keep each authenticated aggregate bounded. Do not turn a failed slice
      // into an empty checklist (which would incorrectly imply missing files).
      const start = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) throw new Error("ช่วงวันที่เช็กลิสต์ไม่ถูกต้อง");
      const cap = Math.min(5000, Math.max(1, Number(limit) || 5000));
      const day = 86400000, rows = [];
      for (let cursor = end; cursor >= start && rows.length < cap; cursor -= day) {
        const chunk = await rpc("audit_daily_checklist", {
          p_from: new Date(cursor).toISOString().slice(0, 10),
          p_to: new Date(cursor).toISOString().slice(0, 10),
          p_company: company === "ALL" ? null : company || null,
          p_limit: cap - rows.length,
        });
        rows.push(...chunk);
      }
      return primaryOverlays(rows.slice(0, cap),{caseCountsOnly:true});
    }
    const filters = ["select=*", "order=business_date.desc,company.asc", `limit=${limit}`];
    if (from) filters.push(`business_date=gte.${encodeURIComponent(from)}`);
    if (to) filters.push(`business_date=lte.${encodeURIComponent(to)}`);
    if (company && company !== "ALL") filters.push(`company=eq.${encodeURIComponent(company)}`);
    return primaryOverlays(await json(`/rest/v1/v_daily_company_checklist?${filters.join("&")}`),{caseCountsOnly:true});
  }

  async function boFirstCoverage({ from, to, company, limit = 5000 } = {}) {
    /* อ่านเฉพาะผลรันที่ daily_recon_jobs ยืนยันว่าเป็นรันล่าสุด
       view เดิมอ่าน bo_first JSON ของรันเก่าทั้งหมดก่อนกรอง จึง timeout
       เมื่อมีการรันย้อนหลังหลายครั้งและทำให้หน้าเว็บดูเหมือนข้อมูลไม่ครบ */
    const jobFilters = ["select=last_run_id", "last_run_id=not.is.null", "is_archived=eq.false", `limit=${Math.min(1000, limit)}`];
    if (from) jobFilters.push(`business_date=gte.${encodeURIComponent(from)}`);
    if (to) jobFilters.push(`business_date=lte.${encodeURIComponent(to)}`);
    if (company && company !== "ALL") jobFilters.push(`company=eq.${encodeURIComponent(company)}`);
    const jobs = await json(`/rest/v1/daily_recon_jobs?${jobFilters.join("&")}`);
    const runIds = [...new Set((jobs || []).map((row) => row.last_run_id).filter(Boolean))];
    if (!runIds.length) return [];
    const rows = [];
    for (let index = 0; index < runIds.length; index += 10) {
      const page = await json(`/rest/v1/recon_runs?id=in.(${runIds.slice(index, index + 10).join(",")})&select=id,business_date,company,created_at,coverage:summary->bo_first&order=business_date.desc,created_at.desc&limit=10`);
      for (const run of page || []) {
        const coverage = run?.coverage;
        if (!coverage) continue;
        rows.push({
          run_id: run.id,
          business_date: run.business_date,
          company: String(run.company || "").toUpperCase(),
          created_at: run.created_at,
          method: coverage.method || "BO_FIRST",
          required: Array.isArray(coverage.required) ? coverage.required : [],
          received: Array.isArray(coverage.received) ? coverage.received : [],
          missing: Array.isArray(coverage.missing) ? coverage.missing : [],
          complete: coverage.complete === true,
          registry_source: coverage.registry_source || null,
        });
      }
    }
    return rows.slice(0, limit);
  }

  const runtimeSettings = () => json("/rest/v1/audit_runtime_settings?select=*&id=eq.true&limit=1");

  async function damages({ from, to, company, limit = 5000 } = {}) {
    const filters = ["select=*", "voided_at=is.null", "order=business_date.desc,created_at.desc,id.desc"];
    if (from) filters.push(`business_date=gte.${encodeURIComponent(from)}`);
    if (to) filters.push(`business_date=lte.${encodeURIComponent(to)}`);
    if (company && company !== "ALL") filters.push(`company=eq.${encodeURIComponent(company)}`);
    const maximum = Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit,5000) : 5000;
    const rows=[];
    while (rows.length < maximum) {
      const page = await json(`/rest/v1/damages?${filters.join("&")}&limit=${Math.min(500,maximum-rows.length)}&offset=${rows.length}`);
      if (!Array.isArray(page)) throw new Error('รูปแบบทะเบียนความเสียหายไม่ถูกต้อง');
      if (!page.length) break;
      rows.push(...page);
    }
    return rows;
  }

  async function damageCollections(ids) {
    const collections=[], receipts=[];
    for (let start=0;start<ids.length;start+=100) {
      const filter=`damage_id=in.(${ids.slice(start,start+100).map(encodeURIComponent).join(',')})`;
      for (const [table,target] of [['damage_collections',collections],['damage_receipts',receipts]]) {
        for(let offset=0;;) {
          const page=await json(`/rest/v1/${table}?select=*&${filter}&order=${table==='damage_collections'?'damage_id':'id'}.asc&limit=500&offset=${offset}`);
          if(!Array.isArray(page)) throw new Error('อ่านยอดเรียกเก็บหรือโอนคืนไม่สำเร็จ');
          if(!page.length) break;
          target.push(...page);
          offset+=page.length;
        }
      }
    }
    return {collections,receipts};
  }
  async function approveDamageCollection(body) {
    const rows=await rpc('approve_damage_collection',body);
    if(!Array.isArray(rows) || rows.length!==1 || rows[0].damage_id!==body.p_damage_id) throw new Error('ยังยืนยันผลอนุมัติไม่ได้ กรุณารีเฟรชก่อนลองใหม่');
    return rows[0];
  }
  async function confirmDamageReceipt(body) {
    const rows=await rpc('confirm_damage_receipt',body);
    if(!Array.isArray(rows) || rows.length!==1 || rows[0].id!==body.p_id || rows[0].damage_id!==body.p_damage_id) throw new Error('ยังยืนยันยอดโอนไม่ได้ กรุณารีเฟรชก่อนลองใหม่');
    return rows[0];
  }
  const voidDamageReceipt=(id,reason)=>rpc('void_damage_receipt',{p_id:id,p_reason:reason});
  async function reverseWrongCaseClosure(body) {
    const result=await rpc('reverse_wrong_case_closure',body);
    const saved=Array.isArray(result)?result[0]:result;
    const expected=body.p_action==='return_clarification'?'clarifying':'answered';
    if(!saved?.id||saved.id!==body.p_case||saved.status!==expected||saved.case_closure_request_id)
      throw new Error('ยังยืนยันสถานะตีกลับไม่ได้ กรุณาโหลดเคสใหม่ก่อนลองซ้ำ');
    return saved;
  }

  async function evidenceFiles({ from, to, company, limit = 2000, includeSourceFiles = false } = {}) {
    const filters = [
      "select=*,mail_batches!inner(business_date,company,subject,sender,received_at)",
      ...(includeSourceFiles ? [] : ["kind=eq.doc_clarify"]),
      "order=created_at.desc",
      `limit=${limit}`,
    ];
    if (from) filters.push(`mail_batches.business_date=gte.${encodeURIComponent(from)}`);
    if (to) filters.push(`mail_batches.business_date=lte.${encodeURIComponent(to)}`);
    if (company) filters.push(`mail_batches.company=eq.${encodeURIComponent(company)}`);
    const rows = await json(`/rest/v1/source_files?${filters.join("&")}`);
    return (rows || []).map((row) => ({
      ...row,
      business_date: row.mail_batches?.business_date || null,
      batch_company: row.mail_batches?.company || null,
      subject: row.mail_batches?.subject || "",
      sender: row.mail_batches?.sender || "",
      received_at: row.created_at || row.mail_batches?.received_at || null,
    }));
  }

  const linkSelectedCaseFile = (caseId, fileId, note) => rpc('link_selected_case_file', {
    p_exception_id: caseId, p_file_id: fileId, p_note: note,
  });
  const linkWaitingCrossDayFile = (caseId, fileId, note) => rpc('link_waiting_cross_day_file', {
    p_exception_id:caseId,p_file_id:fileId,p_note:note,
  });

  async function auditLogs({ from, to, limit = 2000 } = {}) {
    const filters = ["select=*", "order=at.desc", `limit=${limit}`];
    if (from) filters.push(`at=gte.${encodeURIComponent(from + "T00:00:00+07:00")}`);
    if (to) filters.push(`at=lt.${encodeURIComponent(to + "T23:59:59.999+07:00")}`);
    return json(`/rest/v1/audit_log?${filters.join("&")}`);
  }

  const notifications = (limit = 1000, from) =>
    json(`/rest/v1/recon_notifications?${q({ select: "*", limit, order: "created_at.desc", ...(from ? {or: `(business_date.gte.${from},and(business_date.is.null,created_at.gte.${from}T00:00:00+07:00))`} : {}) })}`);

  async function clarificationMatches({ from, to, company, limit = 5000 } = {}) {
    const filters = ["select=*", "order=processed_at.desc", `limit=${limit}`];
    if (from) filters.push(`business_date=gte.${encodeURIComponent(from)}`);
    if (to) filters.push(`business_date=lte.${encodeURIComponent(to)}`);
    if (company && company !== "ALL") filters.push(`company=eq.${encodeURIComponent(company)}`);
    return json(`/rest/v1/clarification_matches?${filters.join("&")}`);
  }

  async function evidenceUsage(fileIds, company) {
    if(!company || !Array.isArray(fileIds))throw new Error('ต้องระบุบริษัทและไฟล์');
    const ids=[...new Set(fileIds)];
    if(ids.some(id=>!(/^[0-9a-f-]{36}$/i).test(id)))throw new Error('รหัสไฟล์ไม่ถูกต้อง');
    const result=[];
    for(let i=0;i<ids.length;i+=100){
      for(let offset=0;;offset+=500){
        const rows=await json(`/rest/v1/exceptions?select=id,code,business_date,status,clarification_file_id&company=eq.${encodeURIComponent(company)}&clarification_file_id=in.(${ids.slice(i,i+100).join(',')})&order=id&limit=500&offset=${offset}`);
        if(!Array.isArray(rows))throw new Error('โหลดประวัติใช้เอกสารไม่ครบ');
        result.push(...rows);if(rows.length<500)break;
      }
    }
    return result;
  }

  async function currentExceptions({ from, to, company, limit = 5000 } = {}) {
    // The read-only next-case queue must resolve the same exact primary
    // membership as the summary/responder queue, including a null system base.
    const pageSize = 1000;
    const fetchPage = async (offset) => json('/rest/v1/rpc/audit_current_cases_scoped?select=*',
      {method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({p_from:from || null,p_to:to || null,p_company:company || 'ALL',
          p_limit:Math.min(pageSize,limit-offset),p_offset:offset})});
    const first = await fetchPage(0);
    if (!first || first.length < pageSize || limit <= pageSize) return first || [];
    const offsets = [];
    for (let offset = pageSize; offset < limit; offset += pageSize) offsets.push(offset);
    const rest = [];
    for (const offset of offsets) {
      const page = await fetchPage(offset);
      rest.push(page);
      if (page.length < pageSize) break;
    }
    return first.concat(...rest);
  }

  /* Dashboard ใช้เฉพาะคอลัมน์สรุป ไม่ดึง stm_raw/bo_raw หลายพันแถว
     หลักฐานดิบยังโหลดได้จากหน้ารายการผิดปกติเมื่อผู้ใช้ต้องตรวจเคส */
  async function currentExceptionsSummary({ from, to, company, limit = 5000, offset: startOffset = 0 } = {}) {
    const pageSize = 1000;
    const columns = [
      "id", "run_id", "code", "business_date", "occurred_at", "company", "bank", "account", "direction",
      "member_code", "ex_type", "type_name", "severity", "status", "track", "due_at", "system_amount",
      "bank_amount", "amount_diff", "risk_amount", "currency", "fx_rate", "time_diff_sec", "employee", "shift",
      "cause", "detail", "created_at", "clarification_file_id", "auto_closed", "resolution_note", "resolved_at",
      "resolved_by", "match_confidence", "assigned_to", "requested_by", "requested_at", "response_text",
      "responded_by", "responded_at", "approved_by", "approved_at", "manual_pair_id", "case_closure_request_id", "cross_day_request_id", "cross_day_image_request_id", "document_due_at",
      "bo_date", "bo_time", "stm_date", "stm_time", "customer_details", "superseded_by_exception_id",
    ].join(",");
    // Company/day scope includes accepted manual primaries even when both the
    // failed system job and its manual base have no run_id. Resolve exact case
    // membership server-side under the caller's existing RLS; never infer it
    // from a nullable system-run list or broaden to historical exceptions.
    const fetchPage = async (offset) => json(
      `/rest/v1/rpc/audit_current_cases_scoped?select=${columns}`,
      {method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({p_from:from || null,p_to:to || null,p_company:company || 'ALL',
          p_limit:Math.min(pageSize,limit-offset),p_offset:startOffset+offset})});
    const first = await fetchPage(0);
    if (!first || first.length < pageSize || limit <= pageSize) return first || [];
    const offsets = [];
    for (let offset = pageSize; offset < limit; offset += pageSize) offsets.push(offset);
    const rest = [];
    for (const offset of offsets) {
      const page = await fetchPage(offset);
      rest.push(page);
      if (page.length < pageSize) break;
    }
    return first.concat(...rest);
  }

  async function searchExceptions({ term, from, to, company, limit = 1000 } = {}) {
    const clean = String(term || "").trim().replace(/[,*()]/g, " ").replace(/\s+/g, " ");
    if (!clean) return [];
    // Search the same current-primary registry as the list and next-case
    // queue. No dependency on a successful system run; no history/raw search.
    const rows = [], pageSize = 1000;
    for (let offset = 0; offset < limit; offset += pageSize) {
      const page = await json('/rest/v1/rpc/audit_search_current_cases_scoped?select=*',
        {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
          p_term:clean.slice(0,200),p_from:from || null,p_to:to || null,p_company:company || 'ALL',
          p_limit:Math.min(pageSize,limit-offset),p_offset:offset})});
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    return rows;
  }

  /* โหลดรายละเอียดหนักเฉพาะตอนผู้ตรวจเปิดเคส ไม่ดึง raw evidence ทุกแถวในหน้ารวม */
  async function exceptionDetail(exceptionId) {
    if (!exceptionId) return null;
    const rows = await json(`/rest/v1/exceptions?id=eq.${encodeURIComponent(exceptionId)}&select=*&limit=1`,{recoverRead:true});
    return rows[0] || null;
  }

  // Follow the job's committed run, never select a possibly stale run by date alone.
  async function matchedEvidence(company, date) {
    if (!company || company === "ALL" || !date) throw new Error("เลือกบริษัทและวันที่ก่อน");
    const primary=await readManualPrimary(company,date);
    if(primary?.stale)throw new Error(primary.message);
    if(primary)return ManualPrimary.run(primary);
    const jobs = await json(`/rest/v1/daily_recon_jobs?company=eq.${encodeURIComponent(company)}&business_date=eq.${encodeURIComponent(date)}&is_archived=eq.false&select=company,business_date,last_run_id,status,completed_at,error_count,bo_waiting_snapshot&limit=1`);
    const snapshot=jobs[0]?.error_count===0?jobs[0]?.bo_waiting_snapshot:null;
    if (!jobs[0]?.last_run_id) return snapshot?{id:null,company,business_date:date,summary:{},jobStatus:jobs[0].status,boWaitingSnapshot:snapshot,isSnapshotOnly:true}:null;
    const runs = await json(`/rest/v1/recon_runs?id=eq.${encodeURIComponent(jobs[0].last_run_id)}&select=id,company,business_date,created_at,stm_count,bo_count,exception_count,matched,summary&limit=1`);
    if(!runs[0])return null;
    let state=null,retainedResultError='';
    if(!['completed','needs_review','running'].includes(jobs[0].status)){
      try{state=await fileRunManagement(company,date);}catch(e){retainedResultError=e.message;}
    }
    return { ...runs[0],jobStatus:jobs[0].status,...retainedRunState(jobs[0],runs[0],state),retainedResultError,boWaitingSnapshot:snapshot };
  }

  // A paused future queue does not revoke a committed previous result. Never
  // infer completion from the pause alone or reuse a result after source edits.
  function retainedRunState(job,run,state){
    const current=state?.job,finished=Date.parse(job?.completed_at),created=Date.parse(run?.created_at);
    const retained=!!(state?.hold?.paused&&state.manualOnly===false&&current
      &&job.company===run.company&&job.business_date===run.business_date
      &&current.last_run_id===run.id&&job.last_run_id===run.id
      &&current.status===job.status&&['queued','error','waiting_files'].includes(job.status)
      &&job.error_count===0&&Number.isFinite(finished)&&Number.isFinite(created)&&finished>=created);
    return {automaticPaused:!!state?.hold?.paused,retainedCompletedResult:retained,
      resultStatus:retained?'completed':job?.status};
  }

  async function reconciliationEvidence({ from, to, company } = {}) {
    const filters = ["select=last_run_id,company,business_date", "is_archived=eq.false", "limit=1000"];
    if (from) filters.push(`business_date=gte.${encodeURIComponent(from)}`);
    if (to) filters.push(`business_date=lte.${encodeURIComponent(to)}`);
    if (company && company !== "ALL") filters.push(`company=eq.${encodeURIComponent(company)}`);
    const jobs = await primaryOverlays(await json(`/rest/v1/daily_recon_jobs?${filters.join("&")}`));
    const ids = [...new Set((jobs || []).filter(row=>!row.primaryResult).map(row => row.last_run_id).filter(Boolean))];
    const evidence = jobs.flatMap(row=>row.primaryResult?.report?.match_evidence||[]);
    for (let index = 0; index < ids.length; index += 10) {
      // Fetch only the matching evidence, not the complete large run summary.
      const page = await json(`/rest/v1/recon_runs?id=in.(${ids.slice(index,index+10).join(",")})&select=id,match_evidence:summary->match_evidence&limit=10`);
      for (const run of page || []) if (Array.isArray(run?.match_evidence)) evidence.push(...run.match_evidence);
    }
    return evidence;
  }

  async function reconciliationOverview(company, date) {
    const run = await matchedEvidence(company, date);
    if (!run) return { run: null, cases: [], complete: true };
    if(run.primaryResult){
      const history=[];for(let offset=0;;offset+=500){const page=await json(`/rest/v1/exceptions?company=eq.${encodeURIComponent(company)}&business_date=eq.${encodeURIComponent(date)}&select=*&order=created_at.desc,id.asc&limit=500&offset=${offset}`,{includeHistorical:true});history.push(...page);if(page.length<500)break;}
      const ids=new Set((run.primaryResult.case_set?.items||[]).map(i=>i.exception_id)),current=history.filter(e=>ids.has(e.id));
      const waitingIds=new Set((run.primaryResult.case_set?.items||[]).filter(i=>i.row_kind==='waiting').map(i=>i.exception_id));
      return {run,cases:ManualPrimary.cases(run.primaryResult,current),caseHistory:history.filter(e=>!ids.has(e.id)),waitingHistory:current.filter(e=>waitingIds.has(e.id)),complete:true,confirmations:[],confirmedRechecks:[],primaryResult:run.primaryResult};
    }
    if (!run.id) return {run,cases:[],complete:false};
    let confirmedRechecks=[],recheckReportError='';
    try{confirmedRechecks=(await listAccountRechecks(company,date)).filter(q=>q.status==='confirmed');}catch(error){recheckReportError=error.message;}
    let confirmations=[],confirmationError='';
    try {
      for(let offset=0;;offset+=1000){
        const page=await json(`/rest/v1/pair_audit_confirmations?run_id=eq.${encodeURIComponent(run.id)}&select=pair_index,confirmed_by,confirmed_at,note&order=pair_index.asc&limit=1000&offset=${offset}`);
        confirmations.push(...page);if(page.length<1000)break;
      }
    } catch(error) { confirmationError=error.message; }
    // Read prior-run waiting cases for this company-day, including approved
    // closures. They annotate exact BO source rows, never add transactions.
    const waitingHistory=[];let waitingHistoryError='';
    try{
      for(let offset=0;;offset+=500){
        const page=await json(`/rest/v1/exceptions?company=eq.${encodeURIComponent(company)}&business_date=eq.${encodeURIComponent(date)}&customer_details->>waiting_source=eq.true&superseded_by_exception_id=is.null&select=*&order=created_at.desc,id.asc&limit=500&offset=${offset}`,{includeHistorical:true,recoverRead:true});
        waitingHistory.push(...page);if(page.length<500)break;
      }
    }catch(error){waitingHistoryError=error.message;}
    const cases = [];
    for (let offset = 0; offset < 20000; offset += 500) {
      const page = await json(`/rest/v1/exceptions?run_id=eq.${encodeURIComponent(run.id)}&superseded_by_exception_id=is.null&select=*&order=id.asc&limit=500&offset=${offset}`,{includeHistorical:true,recoverRead:true});
      cases.push(...page);
      if (page.length < 500) return { run, cases, waitingHistory, waitingHistoryError, complete: true, confirmations, confirmationError,confirmedRechecks,recheckReportError };
    }
    return { run, cases, waitingHistory, waitingHistoryError, complete: false, confirmations, confirmationError,confirmedRechecks,recheckReportError };
  }

  /* ไฟล์ประกอบของเคส = ไฟล์ทั้งหมดที่ใช้สร้าง recon run + ไฟล์ชี้แจงที่จับคู่เคส */
  async function exceptionFiles(runId, clarificationFileId, sourceFileIds = []) {
    const ids = [];
    if (runId) {
      const runs = await json(`/rest/v1/recon_runs?id=eq.${encodeURIComponent(runId)}&select=file_ids&limit=1`);
      (runs[0]?.file_ids || []).forEach((id) => ids.push(id));
    }
    if (clarificationFileId) ids.push(clarificationFileId);
    for (const id of sourceFileIds || []) if (id) ids.push(id);
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return [];
    return json(`/rest/v1/source_files?id=in.(${unique.join(",")})&select=*&order=file_name.asc`);
  }

  const readOnlyCaseRpcs = new Set(['get_my_access','account_review_hold_scopes','account_review_hold_for_case','account_review_hold_continuation_report','case_clarification_instructions','case_clarification_history',
    'read_manual_primary','read_manual_primary_case_set','list_account_rechecks','audit_daily_checklist','audit_run_notices','audit_source_exclusion_states','audit_source_exclusion_preview','audit_source_workspace',
    'audit_current_cases_scoped','audit_search_current_cases_scoped']);
  const rpc = (name, body = {}) =>
    json(`/rest/v1/rpc/${name}`, {
      method: "POST",
      readOnly: readOnlyCaseRpcs.has(name),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const financeReportingCompanies=()=>rpc('finance_reporting_companies');
  const financeBoWindow=(company,from,to)=>rpc('finance_bo_window',{p_company:company,p_from:from,p_to:to});
  const financeReportBoWindow=(company,from,to)=>rpc('finance_report_bo_window',{p_company:company,p_from:from,p_to:to});
  const financeBoReportManifest=(company,date)=>rpc('finance_bo_report_manifest',{p_company:company,p_date:date});
  const acceptFinanceBoReport=payload=>rpc('accept_finance_bo_report',payload);
  const financeBoReportHistory=(company,date)=>rpc('finance_bo_report_history',{p_company:company,p_date:date});
  const financeCaseReport=(company,from,to)=>rpc('finance_case_report',{p_company:company,p_from:from,p_to:to});
  const reviewHoldScopes=()=>rpc('account_review_hold_scopes');
  const manageAccountReviewHold=payload=>rpc('manage_account_review_hold',payload);
  const reviewHoldForCase=id=>rpc('account_review_hold_for_case',{p_case:id});
  const reviewHoldReport=(company,from,to)=>rpc('account_review_hold_report',{p_company:company,p_from:from,p_to:to});
  // Operational ledger, not the restricted finance dashboard. These tables
  // already grant authenticated SELECT with account_review_hold_access RLS.
  // No policies/grants are changed, and no privileged credential is used.
  async function reviewHoldRegistryCompanies(){
    const raw=await rpc('get_my_access'),access=Array.isArray(raw)?raw[0]:raw;
    if(!access?.active||!['lead','monitor','audit_assistant','shift_lead','exec','admin'].includes(access.role))throw Error('ไม่มีสิทธิ์อ่านทะเบียนพักตรวจ');
    if(!Array.isArray(access.companies))throw Error('ยังอ่านสิทธิ์บริษัทไม่ครบ');
    const all=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
    const allowed=access.companies.map(c=>String(c).toUpperCase());
    return all.filter(c=>access.role==='admin'||allowed.includes('*')||allowed.includes(c));
  }
  async function reviewHoldRegistryReport(company,from,to){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||from>to||(Date.parse(to)-Date.parse(from))/86400000>365)throw Error('เลือกช่วงทะเบียนไม่เกิน 366 วัน');
    if(!(await reviewHoldRegistryCompanies()).includes(company))throw Error('ไม่มีสิทธิ์อ่านทะเบียนบริษัทนี้');
    const holds=[];
    for(let offset=0;;offset+=200){
      const page=await json(`/rest/v1/account_review_holds?company=eq.${encodeURIComponent(company)}&business_date=gte.${from}&business_date=lte.${to}&select=*&order=business_date.asc,id.asc&limit=200&offset=${offset}`,{recoverRead:true});
      if(!Array.isArray(page)||page.some(h=>h.company!==company||h.business_date<from||h.business_date>to||!h.id))throw Error('ขอบเขตทะเบียนไม่ตรงบริษัท/วันที่');
      holds.push(...page);if(page.length<200)break;
    }
    const items=[];
    for(let index=0;index<holds.length;index+=50){
      const batch=holds.slice(index,index+50),byId=new Map(batch.map(h=>[h.id,h]));
      for(let offset=0;;offset+=500){
        const page=await json(`/rest/v1/account_review_hold_items?hold_id=in.(${batch.map(h=>encodeURIComponent(h.id)).join(',')})&select=*&order=hold_id.asc,source_ref.asc&limit=500&offset=${offset}`,{recoverRead:true});
        if(!Array.isArray(page))throw Error('ยังอ่านรายการพักตรวจไม่ครบ');
        for(const i of page){const h=byId.get(i.hold_id);if(!h)throw Error('รายการพักตรวจเป็นของบริษัทอื่น');items.push({...i,company:h.company,date:h.business_date,account:h.account,reason:h.reason,responsible_role:h.responsible_role,registered_at:h.created_at,registered_by:h.created_by,assessment:'ยังประเมินไม่ได้ — ขาด STM',loss_amount:null});}
        if(page.length<500)break;
      }
    }
    // Continuous scopes may begin before the selected report range. Read their
    // current case projection separately, never persist duplicate ledger rows.
    const continuous=await rpc('account_review_hold_continuation_report',{p_company:company,p_from:from,p_to:to});
    if(!continuous||continuous.company!==company||!Array.isArray(continuous.items)||!Array.isArray(continuous.scopes)
      ||continuous.scopes.some(h=>h.company!==company||h.continuous!==true||h.business_date>to)
      ||continuous.items.some(i=>i.company!==company||i.date<from||i.date>to||i.continuous!==true||i.loss_amount!==null))throw Error('ขอบเขตทะเบียนต่อเนื่องไม่ตรงบริษัท/วันที่');
    const byHold=new Map(holds.map(h=>[h.id,h])),byItem=new Map(items.map(i=>[i.hold_id+':'+i.source_ref,i]));
    continuous.scopes.forEach(h=>byHold.set(h.id,h));continuous.items.forEach(i=>byItem.set(i.hold_id+':'+i.source_ref,i));
    if(!(await reviewHoldRegistryCompanies()).includes(company))throw Error('สิทธิ์บริษัทเปลี่ยน กรุณาเปิดทะเบียนใหม่');
    return {company,scopes:[...byHold.values()],items:[...byItem.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.occurred_at).localeCompare(String(b.occurred_at))||String(a.source_ref).localeCompare(String(b.source_ref)))};
  }
  const financeActionReport=(company,to)=>rpc('finance_action_report',{p_company:company,p_to:to});
  const financeActionCase=(company,id)=>rpc('finance_action_case',{p_company:company,p_case:id});
  const findFinanceActionCase=(company,date,code)=>rpc('find_finance_action_case',{p_company:company,p_date:date,p_code:code});
  const saveFinanceAction=payload=>rpc('save_finance_action',payload);
  async function financeActionUrl(path){
    const j=await json(`/storage/v1/object/sign/finance-action-evidence/${encodeURI(path)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:300})});
    if(typeof j?.signedURL!=='string'||!j.signedURL.startsWith('/object/sign/finance-action-evidence/'))throw Error('ยังเปิดหลักฐาน Action ไม่ได้');
    return base()+'/storage/v1'+j.signedURL;
  }
  async function uploadFinanceActionEvidence(company,id,file){
    const actor=authUser()?.id,ext=file.name.split('.').pop().toLowerCase(),types={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',csv:'text/csv',txt:'text/plain'};
    if(!actor||!types[ext]||!file.size||file.size>20971520)throw Error('เลือกหลักฐานที่รองรับ ไม่เกิน 20 MB');
    const bytes=await file.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',bytes),sha=[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');
    if(authUser()?.id!==actor)throw Error('ผู้ใช้เปลี่ยน หยุดอัปโหลด');
    const proof=await rpc('reserve_finance_action_evidence',{p_company:company,p_case:id,p_name:replacementSafeName(file.name).slice(-200),p_size:file.size,p_mime:types[ext],p_sha256:sha});
    if(authUser()?.id!==actor)throw Error('ผู้ใช้เปลี่ยน หยุดอัปโหลด');
    if(!proof.uploaded){
      try{await req(`/storage/v1/object/finance-action-evidence/${encodeURI(proof.storage_path)}`,{method:'POST',headers:{'Content-Type':types[ext],'x-upsert':'false'},body:bytes,timeoutMs:120000});}
      catch(e){if(!/already exists|duplicate|resource.*exists/i.test(e.message))throw e;}
    }
    if(authUser()?.id!==actor)throw Error('ผู้ใช้เปลี่ยน หยุดบันทึก');
    const checked=await rpc('reserve_finance_action_evidence',{p_company:company,p_case:id,p_name:proof.file_name,p_size:file.size,p_mime:types[ext],p_sha256:sha});
    if(!checked.uploaded)throw Error('ยังยืนยันไฟล์เดิมไม่ครบ กดลองต่อโดยไม่เลือกไฟล์ใหม่');
    return checked;
  }
  const confirmAuditPairs=(runId,indices,note)=>rpc('confirm_audit_pairs',{p_run_id:runId,p_indices:indices,p_note:note});

  /* สิทธิ์ใช้งานจริงมาจากฐานข้อมูลเท่านั้น ไม่อ่าน role จาก user_metadata
     เพื่อป้องกันผู้ใช้แก้ metadata ฝั่ง client แล้วขยายสิทธิ์ตนเอง */
  const myAccess = () => rpc("get_my_access");
  const leadUserManagementContext=()=>rpc('lead_user_management_context');
  const leadUpdateUserAccess=body=>rpc('lead_update_user_access',body);
  const leadCreateUser=body=>json('/functions/v1/scoped-invite-user',{method:'POST',headers:{'Content-Type':'application/json'},timeoutMs:45000,body:JSON.stringify(body)});
  const monthlyAuditContext=month=>rpc('monthly_audit_context',{p_month:month});
  const createMonthlyAuditSet=body=>rpc('create_monthly_audit_set',body);
  const monthlyAuditDetail=id=>rpc('monthly_audit_set_detail',{p_set:id});
  const monthlyAuditItemReview=id=>rpc('monthly_audit_item_review',{p_item:id});
  const assignMonthlyAuditReviewer=body=>rpc('assign_monthly_audit_reviewer',body);
  const saveMonthlyAuditAssessment=body=>rpc('save_monthly_audit_assessment',body);
  async function uploadMonthlyAuditEvidence(item,file,receipt){
    const actor=authUser()?.id,ext=file.name.split('.').pop().toLowerCase();
    const types={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',csv:'text/csv',txt:'text/plain'};
    if(!actor||!types[ext]||!file.size||file.size>20*1024*1024)throw Error('เลือกไฟล์หลักฐานที่รองรับ ไม่เกิน 20 MB');
    if(!/^[0-9a-f-]{36}$/.test(item)||!/^[0-9a-f-]{36}$/.test(receipt))throw Error('รหัสรายการหรือหลักฐานไม่ถูกต้อง');
    const name=replacementSafeName(file.name).slice(-200),mime=types[ext],path=`monthly-audit/${actor}/${item}/${receipt}/${name}`;
    const bytes=await file.arrayBuffer();
    if(authUser()?.id!==actor)throw Error('ผู้ใช้เปลี่ยน กรุณาเปิดหน้าตรวจใหม่');
    try{await req(`/storage/v1/object/${cfg().bucket}/${encodeURI(path)}`,{method:'POST',headers:{'Content-Type':mime,'x-upsert':'false'},body:bytes,timeoutMs:120000});}
    catch(e){if(!/already exists|duplicate/i.test(e.message))throw e;}
    if(authUser()?.id!==actor)throw Error('ผู้ใช้เปลี่ยน กรุณาเปิดหน้าตรวจใหม่');
    return rpc('register_monthly_audit_evidence',{p_item:item,p_id:receipt,p_name:name,p_mime:mime,p_size:file.size,p_path:path});
  }
  const adminUserAccess = () => rpc("admin_list_user_access");
  const adminSaveUserAccess = (email, fullName, role, active, companies) => rpc("admin_upsert_user_access", {
    p_email: String(email || "").trim().toLowerCase(),
    p_full_name: String(fullName || "").trim(),
    p_role: role,
    p_active: !!active,
    p_companies: [...new Set((companies || []).map((value) => String(value).trim().toUpperCase()).filter(Boolean))],
  });
  const adminInviteUser = (email, fullName, role, active, companies) =>
    json("/functions/v1/admin-invite-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      timeoutMs: 45000,
      body: JSON.stringify({
        email: String(email || "").trim().toLowerCase(),
        full_name: String(fullName || "").trim(),
        role,
        active: !!active,
        companies: [...new Set((companies || []).map((value) => String(value).trim().toUpperCase()).filter(Boolean))],
      }),
    });

  const adminCreateUsernameUser = (username, password, fullName, role, active, companies) =>
    json('/functions/v1/admin-invite-user', {
      method:'POST', headers:{'Content-Type':'application/json'}, timeoutMs:45000,
      body:JSON.stringify({login_mode:'username',username:displayLogin(loginIdentity(username)),password,
        full_name:String(fullName || '').trim(),role,active:!!active,
        companies:[...new Set((companies || []).map(value=>String(value).trim().toUpperCase()).filter(Boolean))]}),
    });

  const queueDueJobs = (from, to) => rpc("queue_due_daily_recon_jobs", { p_from: from, p_to: to });
  const requestAccountRecheck=body=>json('/functions/v1/account-recheck',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),timeoutMs:45000,
  });
  const listAccountRechecks=(company,date)=>rpc('list_account_rechecks',{p_company:company,p_date:date});
  const accountRecheckDetail=async id=>{const rows=await json(`/rest/v1/account_recheck_jobs?id=eq.${encodeURIComponent(id)}&select=id,company,business_date,account,direction,mode,status,result,error,revision,confirmed_at,confirmed_by,confirmation_reason,base_run_id&limit=1`);if(!rows[0])throw Error('ไม่พบผลหรือไม่มีสิทธิ์บริษัท');return rows[0];};
  const confirmAccountRecheck=body=>rpc('confirm_account_recheck',body);
  const manualPrimaryPreview=id=>json('/rest/v1/rpc/manual_primary_preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_id:id}),timeoutMs:45000});
  const acceptManualPrimary=body=>json('/rest/v1/rpc/accept_manual_primary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),timeoutMs:45000});
  const acceptManualPrimaryWithCases=body=>json('/rest/v1/rpc/accept_manual_primary_with_cases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),timeoutMs:45000});
  const readManualPrimary=async(company,date)=>{const v=await rpc('read_manual_primary',{p_company:company,p_date:date});if(v&&!v.stale)v.case_set=await rpc('read_manual_primary_case_set',{p_id:v.id});return v;};
  const manualPrimaryCasesPreview=id=>json('/rest/v1/rpc/manual_primary_cases_preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_id:id}),timeoutMs:45000});
  const activateManualPrimaryCases=body=>json('/rest/v1/rpc/activate_manual_primary_cases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),timeoutMs:45000});
  const auditSourceArchiveManifest=(company,date,includeEvidence)=>rpc('audit_source_archive_manifest',{p_company:company,p_date:date,p_include_evidence:!!includeEvidence});
  const auditSourceArchiveValidate=(company,date,includeEvidence,files)=>rpc('audit_source_archive_validate',{p_company:company,p_date:date,p_include_evidence:!!includeEvidence,p_files:files.map(f=>({id:f.id,storage_path:f.storage_path,file_name:f.file_name,checksum:f.checksum,size_bytes:f.size_bytes,object_version:f.object_version,object_etag:f.object_etag}))});
  const effectiveAuditFiles=(company,date)=>rpc('effective_audit_source_files',{p_company:company,p_date:date});
  async function fileRunManagement(company,date){
    return rpc('file_run_management_state',{p_company:company,p_date:date});
  }
  const sourceRevisionHistory=id=>json(`/rest/v1/audit_source_revisions?source_file_id=eq.${encodeURIComponent(id)}&select=revision,reason,created_at,effective_name,company,business_date,kind,replacement_file_id,excluded,original&order=revision.desc`);
  const sourceExclusionPreview=id=>rpc('audit_source_exclusion_preview',{p_file_id:id});
  const sourceWorkspace=(company,date)=>rpc('audit_source_workspace',{p_company:company,p_date:date});
  const setSourceExcluded=b=>rpc('set_audit_source_excluded',{p_file_id:b.fileId,p_expected_revision:b.expectedRevision,p_excluded:b.excluded,p_reason:b.reason});
  const setAuditRunHold=b=>rpc('set_audit_run_hold',{p_company:b.company,p_date:b.date,p_paused:b.paused,p_reason:b.reason,p_expected_revision:b.expectedRevision});
  const correctAuditSource=b=>rpc('correct_audit_source',{p_file_id:b.fileId,p_expected_revision:b.expectedRevision,p_name:b.name,p_company:b.company,p_date:b.date,p_kind:b.kind,p_replacement_id:b.replacementId,p_excluded:b.excluded,p_reason:b.reason});
  const pendingSourceUploads=new Map();
  const pendingManualSources=new Map();
  async function addAuditManualSource(b,file){
    const actor=authUser()?.id;
    if(!actor||!file?.size||file.size>50*1024*1024||!String(b.reason||'').trim()||b.reason.trim().length<10)throw Error('เข้าสู่ระบบ เลือกไฟล์ไม่เกิน 50 MB และระบุเหตุผลอย่างน้อย 10 ตัวอักษร');
    const bytes=await file.arrayBuffer(),checksum=await sha256Hex(bytes);
    if(authUser()?.id!==actor)throw Error('ผู้ใช้เปลี่ยน กรุณาเปิดหน้าจัดการไฟล์ใหม่');
    const plan=await effectiveAuditFiles(b.company,b.date);
    if(authUser()?.id!==actor)throw Error('ผู้ใช้เปลี่ยน กรุณาเปิดหน้าจัดการไฟล์ใหม่');
    const same=plan.find(f=>!f.excluded&&f.business_date===b.date&&f.kind===b.kind&&f.checksum===checksum);
    if(same)return {source_file_id:same.id,reused:true,duplicate:true};
    const key=JSON.stringify([actor,b.company,b.date,b.kind,b.reason.trim(),file.name,file.size,checksum]);
    let receipt=pendingManualSources.get(key);
    if(!receipt){receipt={id:crypto.randomUUID(),uploaded:false};pendingManualSources.set(key,receipt);}
    const path=`manual-replacements/${actor}/${receipt.id}/${replacementSafeName(file.name)}`;
    if(!receipt.uploaded){
      try{await req(`/storage/v1/object/${cfg().bucket}/${encodeURI(path)}`,{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream','x-upsert':'false'},body:bytes,timeoutMs:120000});}
      catch(error){if(!/already exists|duplicate/i.test(error.message))throw error;}
      receipt.uploaded=true;
    }
    if(authUser()?.id!==actor)throw Error('ผู้ใช้เปลี่ยน กรุณาเปิดหน้าจัดการไฟล์ใหม่');
    const result=await rpc('add_audit_manual_source',{p_company:b.company,p_date:b.date,p_kind:b.kind,p_reason:b.reason.trim(),p_metadata:{id:receipt.id,storage_path:path,file_name:file.name,...(b.name?{effective_name:b.name.trim()}:{}),mime_type:file.type||'application/octet-stream',size_bytes:file.size,checksum}});
    pendingManualSources.delete(key);return result;
  }
  async function uploadAuditSourceCorrection(b,file){
    const bytes=await file.arrayBuffer(),actor=authUser()?.id;
    if(!actor||!file.size||file.size>50*1024*1024)throw Error('เข้าสู่ระบบและเลือกไฟล์ไม่เกิน 50 MB');
    const checksum=await sha256Hex(bytes),key=JSON.stringify([actor,b,file.name,file.size,checksum]);
    let receipt=pendingSourceUploads.get(key);
    if(!receipt){receipt={id:crypto.randomUUID(),uploaded:false};pendingSourceUploads.set(key,receipt);}
    const id=receipt.id;
    const storagePath=`manual-replacements/${actor}/${id}/${replacementSafeName(file.name)}`;
    if(!receipt.uploaded){
      try{await req(`/storage/v1/object/${cfg().bucket}/${encodeURI(storagePath)}`,{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream','x-upsert':'false'},body:bytes,timeoutMs:120000});}
      catch(error){if(!/already exists|duplicate/i.test(error.message))throw error;}
      // A retry may find the same actor-owned immutable nonce; RPC verifies its owner and size.
      receipt.uploaded=true;
    }
    if(authUser()?.id!==actor)throw Error('ผู้ใช้เปลี่ยน กรุณาเปิดหน้าจัดการไฟล์ใหม่');
    const result=await rpc('upload_audit_source_revision',{p_file_id:b.fileId,p_expected_revision:b.expectedRevision,p_metadata:{id,storage_path:storagePath,file_name:file.name,mime_type:file.type||'application/octet-stream',size_bytes:file.size,checksum},p_correction:b});
    pendingSourceUploads.delete(key);return result;
  }
  async function dailyJob(company, date) {
    if (!company || company === "ALL" || !date) return null;
    const rows = await json(`/rest/v1/daily_recon_jobs?company=eq.${encodeURIComponent(company)}&business_date=eq.${encodeURIComponent(date)}&is_archived=eq.false&select=id,company,business_date,status&limit=1`);
    return rows[0] || null;
  }
  const claimJob = (worker) => rpc("claim_daily_recon_job", { p_worker: worker || currentEmail() || "web-worker" });
  const retryJob = (jobId) => rpc("retry_daily_recon_job", { p_job_id: jobId });
  const finishJob = (jobId, runId) => rpc("finish_daily_recon_job", { p_job_id: jobId, p_run_id: runId });
  const finishParseOnly = (jobId) => rpc("finish_daily_recon_parse_only", { p_job_id: jobId });
  const failJob = (jobId, error) => rpc("fail_daily_recon_job", { p_job_id: jobId, p_error: String(error || "Unknown error") });
  const reclassifySourceFile = (fileId, company, kind) => rpc("reclassify_source_file", {
    p_file_id: fileId,
    p_company: company,
    p_kind: kind,
    p_actor: currentEmail() || "web-auditor",
  });
  const manualMatchClarificationFile = (fileId, exceptionIds, note) => rpc("manual_match_clarification_file", {
    p_file_id: fileId,
    p_exception_ids: [...new Set((exceptionIds || []).filter(Boolean))],
    p_actor: currentEmail() || "web-auditor",
    p_note: note || "Audit จับคู่ไฟล์ชี้แจงกับเคสที่เลือก",
  });

  const evidenceRecommendations = ({fileId, date, from, to, company, limit = 2000} = {}) => {
    const maximum = Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 5000) : 2000;
    const filters = ['select=*', 'order=created_at.desc', `limit=${maximum}`];
    if (fileId) filters.push(`source_file_id=eq.${encodeURIComponent(fileId)}`);
    if (date) filters.push(`business_date=eq.${encodeURIComponent(date)}`);
    if (from) filters.push(`business_date=gte.${encodeURIComponent(from)}`);
    if (to) filters.push(`business_date=lte.${encodeURIComponent(to)}`);
    if (company) filters.push(`or=${encodeURIComponent(`(company.eq.${company},payer_company.eq.${company})`)}`);
    return json(`/rest/v1/evidence_recommendations?${filters.join('&')}`);
  };
  async function evidenceCaseRecommendations({runId,caseId,recommendationId} = {}) {
    if (!runId && !caseId && !recommendationId) throw new Error('ต้องระบุรอบตรวจ เคส หรือกลุ่มหลักฐาน');
    const filters = ['select=recommendation_id,exception_id,reason,exceptions!inner(id,code,status,run_id,company,business_date),evidence_recommendations!inner(*)', 'order=exception_id.asc,recommendation_id.asc'];
    if (recommendationId) filters.push(`recommendation_id=eq.${encodeURIComponent(recommendationId)}`);
    if (runId) filters.push(`exceptions.run_id=eq.${encodeURIComponent(runId)}`);
    if (caseId) filters.push(`exception_id=eq.${encodeURIComponent(caseId)}`);
    const rows=[];
    for(let offset=0;;offset+=500){
      const page=await json(`/rest/v1/evidence_recommendation_cases?${filters.join('&')}&limit=500&offset=${offset}`);
      rows.push(...page);
      if(page.length<500)return rows;
      if(rows.length>=20000)throw new Error('คู่แนะนำเกินขอบเขตการโหลด กรุณาตรวจแยกเคส');
    }
  }
  const saveEvidenceRecommendation = (row) => json('/rest/v1/evidence_recommendations', {
    method: 'POST', headers: {'Content-Type':'application/json', Prefer:'return=representation'},
    body: JSON.stringify(row),
  });

  const linkRecommendedEvidence = (caseId, recommendationId, note) => rpc('link_recommended_case_evidence', {
    p_exception_id: caseId, p_recommendation_id: recommendationId, p_note: note,
  });

  const replacementSafeName = (name) => String(name || "replacement.bin")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-140) || "replacement.bin";

  async function sha256Hex(buffer) {
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function replaceSourceFile(fileId, currentStoragePath, file, company, kind) {
    if (!fileId || !file || !file.size) throw new Error("กรุณาเลือกไฟล์ใหม่ที่มีข้อมูล");
    const buffer = await file.arrayBuffer();
    const checksum = await sha256Hex(buffer);
    const basePath = String(currentStoragePath || "manual")
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .slice(0, -1)
      .join("/") || "manual";
    const storagePath = `${basePath}/replacements/${fileId}/${Date.now()}-${replacementSafeName(file.name)}`;
    await req(`/storage/v1/object/${cfg().bucket}/${encodeURI(storagePath)}`, {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: buffer,
      timeoutMs: 120000,
    });
    try {
      return await rpc("replace_source_file", {
        p_file_id: fileId,
        p_file_name: file.name,
        p_mime_type: file.type || "application/octet-stream",
        p_size_bytes: file.size,
        p_storage_path: storagePath,
        p_checksum: checksum,
        p_company: company,
        p_kind: kind,
        p_actor: currentEmail() || "web-auditor",
      });
    } catch (error) {
      // The upload and database update are one user action. If the RPC fails,
      // remove the unreferenced object so retries do not leak files in Storage.
      try {
        await req(`/storage/v1/object/${cfg().bucket}/${encodeURI(storagePath)}`, {
          method: "DELETE",
          timeoutMs: 30000,
        });
      } catch (cleanupError) {
        console.warn("cleanup replacement upload failed", cleanupError);
      }
      const detail = String(error?.message || error || "");
      if (/replace_source_file/i.test(detail) && /schema cache|could not find the function/i.test(detail)) {
        throw new Error("ระบบแทนที่ไฟล์ยังตั้งค่าไม่ครบ กรุณาแจ้งผู้ดูแลระบบ แล้วลองใหม่อีกครั้ง");
      }
      throw error;
    }
  }

  async function fileOcr(fileId) {
    if (!fileId) return null;
    const rows = await json(`/rest/v1/source_file_ocr?source_file_id=eq.${encodeURIComponent(fileId)}&select=*&limit=1`);
    return rows[0] || null;
  }

  async function recoverySource(fileId) {
    const rows = await json(`/rest/v1/source_files?id=eq.${encodeURIComponent(fileId)}&select=id,company,kind,checksum,mail_batches(company,business_date)&limit=1`);
    if (!rows[0]) throw new Error('ไม่พบไฟล์ต้นฉบับหรือไม่มีสิทธิ์อ่าน');
    const f = rows[0], b = f.mail_batches;
    return {...f, company:f.company || b?.company, business_date:b?.business_date};
  }
  const approvePdfRecovery = (payload, note) => rpc('approve_reviewed_pdf_recovery', {p_payload:payload,p_note:note});

  /* เมลทั้งหมดของช่วงวันที่ พร้อมไฟล์ */
  async function batches({ from, to, company, force = false } = {}) {
    const filters = ["select=*,source_files(*)", "order=received_at.desc"];
    if (from) filters.push(`business_date=gte.${from}`);
    if (to) filters.push(`business_date=lte.${to}`);
    if (company && company !== "ALL") filters.push(`company=eq.${company}`);
    return fileSnapshotRead('batches', batchSnapshotKey({from, to, company}), force, async () => {
      const rows=await json(`/rest/v1/mail_batches?${filters.join("&")}`),files=rows.flatMap(b=>b.source_files||[]),states=new Map();
      for(let i=0;i<files.length;i+=500){
        const page=await rpc('audit_source_exclusion_states',{p_ids:files.slice(i,i+500).map(f=>f.id)});
        for(const f of page)states.set(f.id,f);
      }
      if(files.some(f=>!states.has(f.id)))throw Error('โหลดสถานะยกเว้นไฟล์ไม่ครบ กรุณารีเฟรช ไม่อนุญาตให้เลือกไฟล์จากข้อมูลไม่ครบ');
      return rows.map(b=>({...b,source_files:(b.source_files||[]).map(f=>({...f,...states.get(f.id)}))}));
    });
  }

  /* ---------------- Storage ---------------- */
  async function download(storagePath, {force = false} = {}) {
    const key = JSON.stringify([fileScope(), storagePath]);
    return fileSnapshotRead('download', key, force, () => downloadOriginal(storagePath));
  }
  async function downloadOriginal(storagePath) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const res = await req(`/storage/v1/object/${cfg().bucket}/${encodeURI(storagePath)}`, { signal: controller.signal });
      return await res.arrayBuffer();
    } catch (e) {
      if (e && e.name === "AbortError") throw new Error("ดาวน์โหลดไฟล์เกิน 120 วินาที");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  /* ลิงก์ชั่วคราวไว้ให้ผู้ใช้เปิดดูไฟล์เอง */
  async function signedUrl(storagePath, seconds = 300) {
    const j = await json(`/storage/v1/object/sign/${cfg().bucket}/${encodeURI(storagePath)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: seconds }),
    });
    if (!j || typeof j.signedURL !== 'string' || !j.signedURL.startsWith('/object/sign/')) throw new Error('ยังยืนยันไฟล์ในคลังไม่ได้');
    return base() + "/storage/v1" + j.signedURL;
  }

  /* ---------------- เขียนผลกลับ ---------------- */
  const post = (table, rows, prefer = "return=representation") =>
    json(`/rest/v1/${table}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: prefer },
      body: JSON.stringify(rows),
    });

  const patch = (table, filter, body) =>
    req(`/rest/v1/${table}?${filter}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(body),
    });

  async function requestClarification(id, previousStatus, body) {
    // A linked evidence file is not a request receipt. Never replay this write
    // after an ambiguous network outcome; only the user can choose to retry.
    const verify = row => row && row.id === id && row.status === 'clarifying'
      && Number.isFinite(Date.parse(row.requested_at)) && !!row.requested_by;
    let saved;
    try {
    if (!["open", "pending_next_day"].includes(previousStatus)) throw new Error("สถานะนี้ต้องใช้ปุ่มตีกลับเพื่อเก็บประวัติคำตอบเดิม");
    saved = await rpc('request_current_case_clarification', {p_case:id,p_previous_status:previousStatus});
    if (!verify(saved)) throw new Error('ผลตอบกลับไม่มีหลักฐานการส่งครบถ้วน');
    // Read through the authenticated, ID-scoped endpoint, not local overrides.
    const rows = await json(`/rest/v1/exceptions?id=eq.${encodeURIComponent(id)}&select=id,status,company,requested_at,requested_by&limit=1`, {recoverRead:true});
    const receipt = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
    if (!verify(receipt) || receipt.requested_by !== saved.requested_by
        || Date.parse(receipt.requested_at) !== Date.parse(saved.requested_at)) {
      throw new Error('อ่านกลับไม่ตรงกับคำขอที่บันทึก หรือสถานะเคสเปลี่ยนระหว่างส่ง');
    }
    return {...saved, ...receipt};
    } catch (error) {
      throw new Error('ยังยืนยันการส่งไม่ได้ — อย่ากดส่งซ้ำ ให้โหลดเคสล่าสุดเพื่อตรวจสถานะก่อน: ' + error.message);
    }
  }

  async function manualPairCandidates(company,date,type,direction=null) {
    if(!company || !date || !['missing_stm','missing_bo'].includes(type)) throw new Error('เลือกบริษัท วันที่ และฝั่งรายการ');
    const adjacent=(value,days)=>{const parsed=new Date(value+'T12:00:00Z');parsed.setUTCDate(parsed.getUTCDate()+days);return parsed.toISOString().slice(0,10);};
    const from=adjacent(date,-1),to=adjacent(date,1);
    // Resolve the same accepted primary as the live lists, including manual
    // case sets with a null system run. Never fall back to historical cases.
    // Page the unfiltered resolver output to completion BEFORE filtering: an
    // early page can contain no eligible opposite-side/direction candidates.
    const candidates=[],seen=new Set(),pageSize=1000;
    for(let offset=0;;offset+=pageSize){
      const page=await json('/rest/v1/rpc/audit_current_cases_scoped?select=*',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({p_from:from,p_to:to,p_company:company,p_limit:pageSize,p_offset:offset})});
      if(!Array.isArray(page))throw new Error('ค้นหาเคสคู่ไม่สำเร็จ: รูปแบบผลหลักไม่ถูกต้อง');
      for(const row of page){
        if(!row?.id||seen.has(row.id))throw new Error('ข้อมูลผลหลักเปลี่ยนระหว่างค้นหา กรุณาค้นหาใหม่ — ยังไม่ส่งคำขอ');
        seen.add(row.id);
        if(row.company===company&&row.business_date>=from&&row.business_date<=to&&['open','clarifying','answered','pending_next_day'].includes(row.status)
          &&(row.ex_type===type||type==='missing_stm'&&row.ex_type==='cross_day')&&!row.manual_pair_id&&!row.case_closure_request_id&&!row.superseded_by_exception_id
          &&(!direction||row.direction===direction))candidates.push(row);
      }
      if(page.length<pageSize)return candidates.sort((a,b)=>Math.abs(Date.parse(a.business_date)-Date.parse(date))-Math.abs(Date.parse(b.business_date)-Date.parse(date))||String(a.business_date).localeCompare(String(b.business_date))||String(a.occurred_at||'').localeCompare(String(b.occurred_at||''))||String(a.id).localeCompare(String(b.id)));
    }
  }
  async function manualPair(id) {
    const rows=await json(`/rest/v1/manual_case_pairs?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    return rows[0]||null;
  }
  async function pendingManualPairs() {
    const rows=[];
    for(let offset=0;;offset+=200){
      const page=await json(`/rest/v1/manual_case_pairs?status=eq.pending&select=*&order=submitted_at.asc,id.asc&limit=200&offset=${offset}`);
      if(!Array.isArray(page))throw new Error('อ่านคิวอนุมัติไม่สำเร็จ');
      rows.push(...page);
      if(page.length<200)return rows;
    }
  }
  const submitManualPair=body=>json('/rest/v1/rpc/submit_manual_case_pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const crossDayWorkbench=body=>body?.p_case
    ?rpc('cross_day_workbench_for_case',{p_case:body.p_case})
    :rpc('cross_day_workbench',body);
  const submitCrossDayPair=body=>rpc('submit_cross_day_pair',body);
  async function crossDayPair(id){const rows=await json(`/rest/v1/cross_day_pair_requests?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);return rows[0]||null;}
  async function pendingCrossDayPairs(){const rows=[];for(const table of ['cross_day_pair_requests','cross_day_image_reviews'])for(let offset=0;;offset+=200){const page=await json(`/rest/v1/${table}?status=eq.pending&select=*&order=submitted_at.asc,id.asc&limit=200&offset=${offset}`);if(!Array.isArray(page))throw Error('อ่านคิวข้ามวันไม่สำเร็จ');rows.push(...page.map(q=>table==='cross_day_image_reviews'?{...q,source_mode:'image',stm_row:q.source_page}:q));if(page.length<200)break;}return rows;}
  const submitCrossDayImageReview=body=>rpc('submit_cross_day_image_review',body);
  const closeCrossDayPair=body=>rpc('close_cross_day_pair',body);
  const closeCrossDayImageReview=body=>rpc('close_cross_day_image_review',body);
  async function crossDayImageReview(id){const rows=await json(`/rest/v1/cross_day_image_reviews?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);return rows[0]||null;}
  const decideCrossDayImageReview=body=>verifyDecision('/rest/v1/rpc/decide_cross_day_image_review',body,crossDayImageReview);
  async function crossDayPairHistory(company,date){
    const rows=[];
    for(const table of ['cross_day_pair_requests','cross_day_image_reviews'])for(let offset=0;;offset+=200){
      const page=await json(`/rest/v1/${table}?status=eq.approved&company=eq.${encodeURIComponent(company)}&snapshot->bo->>business_date=eq.${encodeURIComponent(date)}&select=*&order=submitted_at.desc,id.desc&limit=200&offset=${offset}`);
      if(!Array.isArray(page))throw Error('อ่านประวัติข้ามวันไม่สำเร็จ');
      rows.push(...page.map(q=>table==='cross_day_image_reviews'?{...q,source_mode:'image'}:q));if(page.length<200)break;
    }
    return rows.sort((a,b)=>String(b.submitted_at).localeCompare(String(a.submitted_at)));
  }
  const decideCrossDayPair=body=>verifyDecision('/rest/v1/rpc/decide_cross_day_pair',body,crossDayPair);
  async function verifyDecision(path, body, readBack, action=body.p_action) {
    let requestError;
    try { await json(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); }
    catch (err) { requestError=err; }
    // Also recover a committed decision after a lost response, without
    // submitting the request again. Never infer success from HTTP alone.
    const saved=await readBack(body.p_id);
    const expected=action==='approve'?'approved':'rejected';
    if(saved?.id!==body.p_id||saved.status!==expected||saved.decided_by!==authUser()?.id)
      throw requestError||new Error('สถานะที่บันทึกในฐานข้อมูลยังไม่ตรงกับคำขอนี้ กรุณาโหลดคิวใหม่ก่อนลองซ้ำ');
    return saved;
  }
  const decideManualPair=body=>verifyDecision('/rest/v1/rpc/decide_manual_case_pair',body,manualPair);
  async function closeManualPair(body) {
    const saved=await verifyDecision('/rest/v1/rpc/close_manual_case_pair',body,manualPair,'approve');
    if(saved.bo_case_id!==body.p_bo||saved.stm_case_id!==body.p_stm)throw new Error('คู่ที่บันทึกไม่ตรงกับรายการที่เลือก');
    const cases=await Promise.all([...new Set([body.p_bo,body.p_stm])].map(exceptionDetail));
    if(cases.some(e=>!e||e.status!=='closed'||e.manual_pair_id!==saved.id||e.approved_by!==authUser()?.id))
      throw new Error('ยังยืนยันสถานะปิดคู่ในฐานข้อมูลไม่ได้ กรุณาตรวจสถานะก่อนลองซ้ำ');
    return saved;
  }
  async function closeInternalTransferPair(body) {
    const saved=await verifyDecision('/rest/v1/rpc/close_internal_transfer_pair',body,manualPair,'approve');
    if(saved.mode!=='internal'||saved.bo_case_id!==body.p_bo||saved.stm_case_id!==body.p_stm)throw new Error('คู่ข้ามบัญชีที่บันทึกไม่ตรงกับรายการที่เลือก');
    const cases=await Promise.all([body.p_bo,body.p_stm].map(exceptionDetail));
    if(cases.some(e=>!e||e.status!=='closed'||e.manual_pair_id!==saved.id||e.approved_by!==authUser()?.id))
      throw new Error('ยังยืนยันสถานะปิดคู่ข้ามบัญชีในฐานข้อมูลไม่ได้ กรุณาตรวจสถานะก่อนลองซ้ำ');
    return saved;
  }
  async function pendingCaseClosures() {
    const rows=[];
    for(let offset=0;;offset+=200){
      const page=await json(`/rest/v1/case_closure_requests?status=eq.pending&select=*&order=requested_at.asc,id.asc&limit=200&offset=${offset}`);
      if(!Array.isArray(page))throw new Error('อ่านคิวปิดเคสไม่สำเร็จ');
      rows.push(...page);if(page.length<200)return rows;
    }
  }
  async function caseClosureRequest(id) {
    const rows=await json(`/rest/v1/case_closure_requests?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);return rows[0]||null;
  }
  async function caseClosureHistory() {
    const rows=[];
    for(let offset=0;;offset+=200){
      const page=await json(`/rest/v1/case_closure_requests?select=*&order=requested_at.desc,id.desc&limit=200&offset=${offset}`);
      if(!Array.isArray(page))throw new Error('อ่านประวัติคำขอปิดเคสไม่สำเร็จ');
      rows.push(...page);if(page.length<200)return rows;
    }
  }
  const pendingDocumentClosurePreview=id=>rpc('pending_document_closure_preview',{p_case:id});
  const submitCaseClosure=body=>json('/rest/v1/rpc/submit_case_closure',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const submitProcessErrorCase=body=>json('/rest/v1/rpc/submit_process_error_case',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const decideCaseClosure=body=>verifyDecision('/rest/v1/rpc/decide_case_closure',body,caseClosureRequest);
  const decideProcessErrorCase=body=>verifyDecision('/rest/v1/rpc/decide_process_error_case',body,caseClosureRequest,body.p_action);
  const approveOwnDocumentClosure=async body=>{
    const saved=await verifyDecision('/rest/v1/rpc/approve_own_document_closure',body,caseClosureRequest,'approve');
    const e=await exceptionDetail(saved.exception_id);
    if(e?.status!=='closed'||e.case_closure_request_id!==saved.id||e.approved_by!==authUser()?.id)
      throw new Error('ยังยืนยันการปิดเคสไม่ได้ กรุณาโหลดใหม่ก่อนลองซ้ำ');
    return saved;
  };
  const closeDocumentCase=async body=>{
    const saved=await verifyDecision('/rest/v1/rpc/close_document_case',body,caseClosureRequest,'approve');
    const e=await exceptionDetail(body.p_case);
    if(e?.status!=='closed'||e.case_closure_request_id!==saved.id||e.approved_by!==authUser()?.id)
      throw new Error('คำขอบันทึกแล้ว แต่ยังยืนยันสถานะปิดเคสไม่ได้ กรุณาโหลดใหม่ก่อนลองซ้ำ');
    return saved;
  };
  const closeDocumentCaseWithResponsibility=async body=>{
    const saved=await verifyDecision('/rest/v1/rpc/close_document_case_with_responsibility',body,caseClosureRequest,'approve');
    const e=await exceptionDetail(body.p_case);
    if(e?.status!=='closed'||e.case_closure_request_id!==saved.id||e.approved_by!==authUser()?.id
      ||e.employee!==body.p_employee||e.shift!==body.p_shift)
      throw new Error('คำขอบันทึกแล้ว แต่ยังยืนยันผู้เกี่ยวข้อง กะ และสถานะปิดเคสไม่ได้ กรุณาโหลดใหม่ก่อนลองซ้ำ');
    return saved;
  };
  const closeProcessErrorCase=async body=>{
    const saved=await verifyDecision('/rest/v1/rpc/close_process_error_case',body,caseClosureRequest,'approve');
    const e=await exceptionDetail(body.p_case);
    if(e?.status!=='closed'||e.case_closure_request_id!==saved.id||e.approved_by!==authUser()?.id
      ||e.employee!==body.p_employee||e.shift!==body.p_shift)
      throw new Error('คำขอบันทึกแล้ว แต่ยังยืนยันข้อสังเกต ผู้เกี่ยวข้อง กะ และสถานะปิดเคสไม่ได้ กรุณาโหลดใหม่ก่อนลองซ้ำ');
    return saved;
  };
  const companyCaseSlas=()=>json('/rest/v1/company_case_sla?select=*&order=company.asc');
  const saveCompanyCaseSla=(company,days)=>json('/rest/v1/rpc/save_company_case_sla',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_company:company,p_days:days})});

  async function caseEvidence(id) {
    if (!id) return [];
    return await json(`/rest/v1/case_evidence?exception_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.asc`,{recoverRead:true}) || [];
  }

  // Queue display only: read attachment presence under existing case_evidence
  // RLS. Never create/link evidence or write a clarification/status here.
  async function caseEvidenceFlags(ids) {
    const unique=[...new Set(ids||[])];
    if(unique.some(id=>!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).test(id)))throw Error('รหัสเคสในคิวไม่ถูกต้อง');
    const flags={};
    for(let start=0;start<unique.length;start+=100){
      const batch=unique.slice(start,start+100);
      for(let offset=0;;offset+=500){
        const rows=await json(`/rest/v1/case_evidence?select=exception_id&exception_id=in.(${batch.join(',')})&order=id.asc&limit=500&offset=${offset}`);
        if(!Array.isArray(rows))throw Error('ยังตรวจหลักฐานในคิวไม่ครบ');
        for(const row of rows)if(batch.includes(row.exception_id))flags[row.exception_id]=true;
        if(rows.length<500)break;
      }
    }
    return flags;
  }

  // RLS on both tables remains authoritative, including closed-case history.
  // Scope by transaction date, not upload date; paginate without a fake zero on failure.
  async function caseEvidenceLibrary({from,to,company} = {}) {
    const actor = authUser()?.id;
    if(!actor || !signedIn()) throw new Error('ต้องเข้าสู่ระบบก่อนอ่านคลังหลักฐาน');
    const filters = ['select=*,exceptions!inner(id,code,company,business_date,status)', 'order=created_at.desc,id.asc'];
    if(from) filters.push(`exceptions.business_date=gte.${encodeURIComponent(from)}`);
    if(to) filters.push(`exceptions.business_date=lte.${encodeURIComponent(to)}`);
    if(company && company !== 'ALL') filters.push(`exceptions.company=eq.${encodeURIComponent(company)}`);
    const rows = [];
    for(let offset=0; ; offset+=500) {
      const page=await json(`/rest/v1/case_evidence?${filters.join('&')}&limit=500&offset=${offset}`);
      if(authUser()?.id !== actor || !signedIn()) throw new Error('บัญชีเปลี่ยนระหว่างอ่านคลังหลักฐาน กรุณาโหลดใหม่');
      if(!Array.isArray(page)) throw new Error('อ่านคลังหลักฐานจากเคสไม่สำเร็จ');
      rows.push(...page);
      if(page.length < 500) return rows;
    }
  }

  // Full, append-only Audit notes. Existing audit_log RLS remains authoritative.
  async function caseNotes(id) {
    if (!id) return [];
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const page = await json(`/rest/v1/audit_log?entity=eq.exception&action=eq.case_note&target=eq.${encodeURIComponent(id)}&select=id,actor,at,detail&order=at.asc,id.asc&limit=500&offset=${offset}`,{recoverRead:true});
      if (!Array.isArray(page)) throw new Error("อ่าน Note จากฐานข้อมูลไม่สำเร็จ");
      rows.push(...page.map((row) => ({ id: row.id, by: row.actor, at: row.at, text: row.detail })));
      if (page.length < 500) return rows;
    }
  }

  async function clarificationInstructions(id) {
    if (!signedIn() || !authUser()?.id || !id) throw new Error('ต้องเข้าสู่ระบบและเลือกเคสก่อนอ่านคำขอชี้แจง');
    const actor=authUser().id;
    const rows=await rpc('case_clarification_instructions',{p_exception_id:id});
    if(authUser()?.id!==actor || !signedIn()) throw new Error('บัญชีเปลี่ยนระหว่างอ่านคำขอชี้แจง');
    if(!Array.isArray(rows)) throw new Error('อ่านคำขอชี้แจงไม่สำเร็จ');
    return rows;
  }

  async function appendCaseNote(id, text) {
    if (!signedIn() || !authUser()?.id) throw new Error("ต้องเข้าสู่ระบบก่อนบันทึก Note");
    const detail = String(text || "").trim();
    if (!id || !detail) throw new Error("กรุณาระบุเคสและข้อความ Note");
    const actor=authUser().id;
    const saved = await rpc('append_clarification_instruction',{p_exception_id:id,p_text:detail});
    if (authUser()?.id!==actor || !signedIn() || !saved?.id || saved.text !== detail) {
      throw new Error("ยังยืนยันการบันทึก Note ไม่ได้ กรุณาตรวจประวัติก่อนลองซ้ำ");
    }
    return saved;
  }

  // Keep uncertain receipts in this tab only. Never discard an uploaded object,
  // recreate its UUID, or persist customer files/tokens in localStorage.
  const pendingEvidenceUploads = new Map();
  async function readEvidenceReceipt(metadata) {
    const rows=await json(`/rest/v1/case_evidence?id=eq.${encodeURIComponent(metadata.id)}&exception_id=eq.${encodeURIComponent(metadata.exception_id)}&select=*&limit=1`);
    const saved=Array.isArray(rows)?rows[0]:null;
    if(!saved)return null;
    if(saved.id!==metadata.id||saved.exception_id!==metadata.exception_id||saved.storage_path!==metadata.storage_path||Number(saved.size_bytes)!==Number(metadata.size_bytes)||saved.uploaded_by!==metadata.uploaded_by||saved.file_name!==metadata.file_name||saved.mime_type!==metadata.mime_type||metadata.correction_reason&&(saved.correction_reason!==metadata.correction_reason||(saved.replaces_evidence_id||null)!==(metadata.replaces_evidence_id||null)||(saved.replaces_source_file_id||null)!==(metadata.replaces_source_file_id||null))){
      const error=new Error('ทะเบียนหลักฐานไม่ตรงกับคำขอเดิม ต้องให้ผู้ดูแลตรวจ ไม่สร้างไฟล์ใหม่');error.code='evidence_receipt_mismatch';throw error;
    }
    return saved;
  }
  function pendingCaseEvidence(exceptionId) {
    return [...pendingEvidenceUploads.values()].filter(p=>p.metadata.exception_id===exceptionId&&p.metadata.uploaded_by===authUser()?.id)
      .map(p=>({id:p.metadata.id,name:p.metadata.file_name,uploaded:p.uploaded,busy:!!p.inFlight}));
  }
  async function resumeCaseEvidence(id) {
    const pending=pendingEvidenceUploads.get(id);
    if(!pending||!signedIn()||pending.metadata.uploaded_by!==authUser()?.id)throw new Error('ไม่พบคำขอเดิมของบัญชีนี้ในหน้าต่างนี้');
    if(pending.inFlight)return pending.inFlight;
    const work=async()=>{
      const metadata=pending.metadata;
      const checkActor=()=>{if(!signedIn()||authUser()?.id!==metadata.uploaded_by)throw new Error('บัญชีผู้ใช้เปลี่ยนระหว่างส่งไฟล์ เก็บคำขอเดิมให้ผู้ดูแลตรวจ ไม่ผูกเคสข้ามบัญชี');};
      const progress=stage=>pending.onProgress?.(stage);
      checkActor();progress('ตรวจสถานะคำขอเดิม');
      // Exact primary-key lookup avoids rereading every evidence row under RLS.
      let saved;
      if(pending.attempted)try{saved=await readEvidenceReceipt(metadata);}catch(error){if(error.code==='evidence_receipt_mismatch')throw error;pending.readError=error;}
      checkActor();
      if(saved){pendingEvidenceUploads.delete(id);return saved;}
      if(!pending.uploaded){
        // Keep the request/bytes even when the preflight read times out. The
        // retry button must work before Storage as well as after Storage.
        progress('ตรวจการเชื่อมต่อและสิทธิ์อ่านเคส');
        let accessible;
        try { accessible=await json(`/rest/v1/exceptions?id=eq.${encodeURIComponent(metadata.exception_id)}&select=id,status&limit=1`); }
        catch(error){throw new Error(`ยังไม่ได้ส่งไฟล์: ตรวจสิทธิ์เคสไม่สำเร็จ (รหัส ${id}) เก็บไฟล์ในหน้าต่างนี้ไว้แล้ว กดตรวจ/ลองต่อได้โดยไม่เลือกใหม่: ${error.message}`);}
        checkActor();
        if(!Array.isArray(accessible)||accessible.length!==1||accessible[0].id!==metadata.exception_id)
          throw new Error('ยังไม่ได้ส่งไฟล์: ไม่พบเคสหรือไม่มีสิทธิ์อ่านเคสนี้');
        if(!(metadata.correction_reason?['closed','approved']:['open','pending_next_day','clarifying','answered','pair_pending']).includes(accessible[0].status))
          throw new Error('ยังไม่ได้ส่งไฟล์: สถานะเคสเปลี่ยนหรือปิดแล้ว กรุณาตรวจล่าสุดก่อน');
        if(accessible[0].status==='pending_next_day' && await rpc('can_attach_waiting_cross_day_evidence',{p_case:metadata.exception_id})!==true)
          throw new Error('ยังไม่ได้ส่งไฟล์: ไม่มีสิทธิ์ หรือเคสรอข้ามวันไม่ใช่ผลหลักล่าสุด/มีคำขออยู่แล้ว');
        progress('กำลังส่งไฟล์เข้าคลัง (สูงสุด 120 วินาที)');
        pending.attempted=true;
        for(let storageAttempt=0;storageAttempt<2;storageAttempt++)try {await req(`/storage/v1/object/${cfg().bucket}/${metadata.storage_path}`,{method:'POST',headers:{'Content-Type':metadata.mime_type,'x-upsert':'false'},body:pending.buffer,timeoutMs:120000});pending.uploaded=true;break;}
        catch(error){
          // POST may have committed before the response was lost; the same path
          // is retried without upsert. Verify the uploader's existing object.
          checkActor();
          try{await signedUrl(metadata.storage_path,60);pending.uploaded=true;break;}catch{
            if(storageAttempt===0&&/connection.*timed out|database timed out/i.test(error.message||'')){
              progress('คลังไฟล์เชื่อมต่อฐานข้อมูลไม่สำเร็จ กำลังลองด้วยรหัสและเส้นทางเดิม (2/2)');
              await new Promise(resolve=>setTimeout(resolve,1000));checkActor();continue;
            }
            throw new Error(`ยังยืนยันไฟล์ในคลังไม่ได้ (รหัส ${id}) เก็บคำขอเดิมไว้ กดตรวจ/ลองต่อได้โดยไม่เลือกไฟล์ใหม่: ${error.message}`);
          }
        }
      }
      checkActor();progress('ไฟล์เข้าคลังแล้ว กำลังยืนยันทะเบียนผูกเคส');
      // Metadata recovery no longer needs the bytes once Storage is confirmed.
      if(pending.uploaded){pending.buffer=null;if(pending.digest)pending.file=null;}
      for(let attempt=0;attempt<3;attempt++)try {
        // Ignore only an identical primary-key conflict, never overwrite history.
        // Verify the exact owned object without traversing general Storage RLS.
        // Legacy fallback is only for a missing migration, never a timeout/denial.
        let rows;
        try {
          const receipt=await rpc(metadata.correction_reason?'register_closed_case_evidence':'register_case_evidence',{p_metadata:metadata});
          rows=Array.isArray(receipt)?receipt:[receipt];
        } catch(error) {
          if(metadata.correction_reason||!/PGRST202|Could not find the function public\.register_case_evidence/i.test(error.message||''))throw error;
          rows=await post('case_evidence?on_conflict=id',[metadata],'resolution=ignore-duplicates,return=representation');
        }
        checkActor();
        const returned=Array.isArray(rows)?rows.find(row=>row.id===id):null;
        if(returned&&returned.exception_id===metadata.exception_id&&returned.storage_path===metadata.storage_path&&returned.uploaded_by===metadata.uploaded_by&&Number(returned.size_bytes)===Number(metadata.size_bytes)&&returned.file_name===metadata.file_name&&returned.mime_type===metadata.mime_type&&(!metadata.correction_reason||returned.correction_reason===metadata.correction_reason&&(returned.replaces_evidence_id||null)===(metadata.replaces_evidence_id||null)&&(returned.replaces_source_file_id||null)===(metadata.replaces_source_file_id||null))){
          pendingEvidenceUploads.delete(id);return returned;
        }
        saved=await readEvidenceReceipt(metadata);
        checkActor();if(saved){pendingEvidenceUploads.delete(id);return saved;}
        throw new Error('ยังไม่พบทะเบียนหลักฐานที่ตรงกับคำขอ');
      } catch(error) {
        try{saved=await readEvidenceReceipt(metadata);}catch(receiptError){if(receiptError.code==='evidence_receipt_mismatch')throw receiptError; /* uncertainty is not absence */ }
        checkActor();
        if(saved){pendingEvidenceUploads.delete(id);return saved;}
        // Retry only transient connection failures, with the same metadata ID.
        // Storage is already confirmed and is never uploaded again here.
        if(attempt<2&&/connection.*timed out|database timed out|failed to fetch|networkerror|network request failed/i.test(error.message||'')){
          progress(`ไฟล์เข้าคลังแล้ว กำลังลองยืนยันทะเบียนอีกครั้ง (${attempt+2}/3)`);
          await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));
          checkActor();continue;
        }
        throw new Error(`ไฟล์ส่งถึงคลังแล้ว แต่ยังยืนยันการผูกเคสไม่ได้ (รหัส ${id}) เก็บคำขอเดิมไว้ กดตรวจ/ลองบันทึกต่อโดยไม่อัปไฟล์ซ้ำ: ${error.message}`);
      }
    };
    pending.inFlight=work();try{return await pending.inFlight;}finally{pending.inFlight=null;}
  }
  async function uploadCaseEvidence(exceptionId, file, onProgress=()=>{}, correction=null) {
    if (!signedIn() || !authUser()?.id) throw new Error("ต้องเข้าสู่ระบบก่อนแนบหลักฐาน");
    if (!exceptionId || !file || !file.size || file.size > 20 * 1024 * 1024) throw new Error("เลือกไฟล์ขนาดไม่เกิน 20 MB และต้องไม่ว่าง");
    if (!/\.(pdf|docx|png|jpe?g|gif|webp|csv|xlsx|txt)$/i.test(file.name)) throw new Error("ชนิดไฟล์ไม่รองรับ — ใช้ PDF, Word (.docx), รูปภาพ, Excel, CSV หรือ TXT");
    if(correction&&(!String(correction.reason||'').trim()||String(correction.reason).trim().length>2000||!!correction.evidenceId===!!correction.sourceFileId))throw new Error('ต้องเลือกหลักฐานเดิมและระบุเหตุผลไม่เกิน 2000 ตัวอักษร');
    const correctionMeta=correction?{correction_reason:String(correction.reason).trim(),replaces_evidence_id:correction.evidenceId||null,replaces_source_file_id:correction.sourceFileId||null}:{};
    const uploader=authUser().id;
    const buffer = await file.arrayBuffer();
    const digest=crypto.subtle?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join(''):null;
    const previous=[...pendingEvidenceUploads.values()].find(p=>p.metadata.exception_id===exceptionId&&p.metadata.uploaded_by===authUser()?.id&&p.metadata.file_name===file.name&&p.metadata.size_bytes===file.size&&JSON.stringify([p.metadata.correction_reason,p.metadata.replaces_evidence_id,p.metadata.replaces_source_file_id])===JSON.stringify([correctionMeta.correction_reason,correctionMeta.replaces_evidence_id,correctionMeta.replaces_source_file_id])&&(digest?p.digest===digest:p.file===file));
    if(authUser()?.id!==uploader)throw new Error('บัญชีผู้ใช้เปลี่ยนก่อนส่งไฟล์ กรุณาลองใหม่ด้วยบัญชีเดิม');
    if(previous){previous.onProgress=onProgress;return resumeCaseEvidence(previous.metadata.id);}
    const id = crypto.randomUUID();
    const storagePath = `case-evidence/${exceptionId}/${authUser().id}/${id}`;
    const metadata = { id, exception_id: exceptionId, storage_path: storagePath, file_name: file.name,
      size_bytes: file.size, mime_type: file.type || "application/octet-stream", uploaded_by: authUser().id,...correctionMeta };
    pendingEvidenceUploads.set(id,{metadata,file,digest,buffer,uploaded:false,inFlight:null,onProgress});
    return resumeCaseEvidence(id);
  }


  const returnClarification=body=>rpc('return_case_for_clarification',body);
  const clarificationHistory=id=>rpc('case_clarification_history',{p_case:id});
  const submitClarificationWithFile=(id,response,fileId,status,previousFile)=>rpc('submit_case_clarification',{
    p_case:id,p_response:response,p_file:fileId||null,p_previous_status:status,p_previous_file:previousFile||null,
  });
  async function submitClarification(id, body) {
    if (!String(body.response_text || "").trim()) throw new Error("กรุณากรอกคำชี้แจง");
    if (!body.clarification_file_id && !(await caseEvidence(id)).length) throw new Error("ต้องมีไฟล์ชี้แจงที่บันทึกในระบบแล้ว");
    const rows = await json(`/rest/v1/exceptions?id=eq.${encodeURIComponent(id)}&status=eq.clarifying`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ ...body, status: "answered" }),
    });
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0].status !== "answered") throw new Error("สถานะเปลี่ยนหรือไม่มีสิทธิ์ตอบ กรุณาโหลดเคสใหม่");
    return rows[0];
  }

  async function confirmDamage(id, previousStatus, amount, cause, details) {
    const rows = await json(details ? '/rest/v1/rpc/confirm_damage_details' : '/rest/v1/rpc/confirm_damage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_exception_id: id, p_previous_status: previousStatus, p_amount: amount, p_cause: cause,
        ...(details ? { p_employee: details.employee, p_shift: details.shift, p_occurred_at: details.time || null } : {}) }),
    });
    if (!Array.isArray(rows) || rows.length !== 1 || !rows[0].id || rows[0].exception_id !== id) {
      throw new Error('ยังยืนยันผลบันทึกไม่ได้ กรุณารีเฟรชทะเบียนก่อนลองใหม่');
    }
    return rows[0];
  }

  async function closeException(id, previousStatus, body) {
    const saved = await rpc('close_current_audit_case', {
      p_case:id,p_previous_status:previousStatus,p_resolution_note:body?.resolution_note,p_resolved_by:body?.resolved_by,
    });
    if (!saved || saved.id !== id || saved.status !== "closed") {
      throw new Error("สถานะเคสเปลี่ยนหรือไม่มีสิทธิ์บันทึก กรุณารีเฟรชแล้วตรวจใหม่");
    }
    return saved;
  }

  async function markParsed(fileId, rowCount, error) {
    return patch("source_files", `id=eq.${fileId}`, {
      parsed: !error,
      parsed_at: new Date().toISOString(),
      row_count: rowCount ?? null,
      parse_error: error || null,
    });
  }

  /* บันทึกผลการกระทบยอด 1 ครั้ง พร้อม exception ทั้งหมด */
  async function saveRun(run, exceptions, opts = {}) {
    const rows = await post("recon_runs", [
      {
        business_date: run.businessDate,
        company: opts.company || null,
        run_by: opts.by || currentEmail() || "-",
        elapsed_ms: run.elapsedMs || 0,
        stm_count: run.stmCount || 0,
        bo_count: run.boCount || 0,
        matched: run.matched || 0,
        match_rate: Number((run.matchRate || 0).toFixed(3)),
        exception_count: (exceptions || []).length,
        no_stm_count: run.noStmCount || 0,
        file_ids: opts.fileIds || null,
        summary: { ...opts.summary, match_evidence: run.matchEvidence || [], match_evidence_version: 1 },
      },
    ]);
    const runId = rows[0].id;
    const chunk = 500;
    for (let i = 0; i < (exceptions || []).length; i += chunk) {
      await post(
        "exceptions",
        exceptions.slice(i, i + chunk).map((e) => ({
          run_id: runId,
          code: e.id,
          business_date: e.date,
          occurred_at: e.time,
          bo_date: e.boDate || null,
          bo_time: e.boTime && e.boTime !== "-" ? e.boTime : null,
          stm_date: e.stmDate || null,
          stm_time: e.stmTime && e.stmTime !== "-" ? e.stmTime : null,
          company: e.company,
          bank: e.bank,
          account: e.account,
          direction: e.direction,
          member_code: e.member || null,
          customer_details: e.customerDetails || {},
          ex_type: e.type,
          type_name: e.typeName,
          severity: e.severity,
          status: e.status,
          track: e.track,
          system_amount: e.systemAmount,
          bank_amount: e.bankAmount,
          amount_diff: e.amountDiff,
          risk_amount: e.riskAmount,
          time_diff_sec: e.timeDiffSec,
          employee: e.employee,
          shift: e.shift,
          cause: e.cause,
          detail: e.detail || null,
          stm_raw: String(e.stmRaw || "").slice(0, 4000),
          bo_raw: String(e.boRaw || "").slice(0, 4000),
        })),
        "return=minimal",
      );
    }
    saveConfig({ lastSync: new Date().toISOString() });
    return runId;
  }

  const log = (actor, action, entity, target, detail, meta) =>
    post("audit_log", [{ actor, action, entity, target, detail, meta: meta || null }], "return=minimal").catch(() => {});

  /* ---------------- ทดสอบการเชื่อมต่อ ---------------- */
  async function ping() {
    const out = { url: !!cfg().url, key: !!cfg().anonKey, auth: false, tables: false, storage: false, error: null };
    try {
      out.auth = signedIn();
      await json(`/rest/v1/mail_batches?select=id&limit=1`);
      out.tables = true;
      await json(`/storage/v1/bucket/${cfg().bucket}`);
      out.storage = true;
    } catch (e) {
      out.error = e.message;
    }
    return out;
  }

  const mailSources = () => json('/rest/v1/mail_sources?select=email,display_name,business_systems,expected_reports,active,note,created_at,updated_at&order=active.desc,display_name.asc,email.asc');
  const mailPullRequests = () => json('/rest/v1/mail_pull_requests?select=id,source_email,date_from,date_to,status,requested_by_email,requested_at,started_at,finished_at,found_count,imported_count,skipped_count,error_message,worker_receipt&order=requested_at.desc&limit=100');
  const registerMailSource = body => rpc('register_mail_source', {
    p_email: String(body.email || '').trim().toLowerCase(),
    p_display_name: String(body.displayName || '').trim(),
    p_business_systems: body.businessSystems || [],
    p_expected_reports: body.expectedReports || [],
    p_note: String(body.note || '').trim() || null,
  });
  const requestMailPull = body => rpc('request_mail_pull', {
    p_email: String(body.email || '').trim().toLowerCase(),
    p_date_from: body.dateFrom,
    p_date_to: body.dateTo,
  });

  // Compact authenticated export for Company Hub. Page until complete; never
  // copy raw financial evidence or Supabase sessions into the receiving app.
  async function companyHubResults({from, to, onProgress = () => {}} = {}) {
    // Read only the job metadata needed for the handoff. The operations view
    // also aggregates notifications and can time out on a busy database.
    const filters = ["select=id,company,business_date,status,last_run_id,is_archived",
      "order=business_date.desc,company.asc,id.asc", "limit=1000"];
    if (from) filters.push(`business_date=gte.${encodeURIComponent(from)}`);
    if (to) filters.push(`business_date=lte.${encodeURIComponent(to)}`);
    const operationsRows = await json(`/rest/v1/daily_recon_jobs?${filters.join("&")}`).catch(e => { throw new Error("อ่านรอบตรวจไม่สำเร็จ: " + e.message); });
    const jobs = operationsRows.filter(row => !row.is_archived);
    onProgress(`อ่านรอบตรวจแล้ว ${jobs.length} รอบ กำลังอ่านผลจับคู่…`);
    const runIds = [...new Set(jobs.map(row => row.last_run_id).filter(Boolean))];
    if (runIds.length) {
      const runs = await json(`/rest/v1/recon_runs?select=id,matched&id=in.(${runIds.join(",")})&limit=1000`).catch(e => { throw new Error("อ่านผลจับคู่ไม่สำเร็จ: " + e.message); });
      const matched = new Map(runs.map(row => [row.id, row.matched]));
      jobs.forEach(row => { row.matched = matched.get(row.last_run_id) ?? null; });
    }
    const ids = [...new Set(jobs.filter(row => row.status === "completed").map(row => row.last_run_id).filter(Boolean))];
    const rows = [];
    if (ids.length) {
      const fields = "id,run_id,code,type_name,company,business_date,status,assigned_to";
      let cursor = null;
      for (let offset=0; offset<100000; offset+=1000) {
        const after = cursor ? `&or=(run_id.gt.${encodeURIComponent(cursor.run_id)},and(run_id.eq.${encodeURIComponent(cursor.run_id)},id.gt.${encodeURIComponent(cursor.id)}))` : "";
        const page = await json(`/rest/v1/exceptions?select=${fields}&run_id=in.(${ids.join(",")})&order=run_id.asc,id.asc&limit=1000${after}`).catch(e => { throw new Error(`อ่านเคสหน้าที่ ${offset / 1000 + 1} ไม่สำเร็จ: ` + e.message); });
        if (page.length) cursor = page[page.length - 1];
        rows.push(...page);
        onProgress(`อ่านเคสแล้ว ${rows.length.toLocaleString()} รายการ กำลังตรวจหน้าถัดไป…`);
        if (page.length<1000) return {rows,jobs,partial:operationsRows.length>=1000};
      }
    }
    return {rows,jobs,partial:operationsRows.length>=1000 || rows.length>=100000};
  }

  return {
    financeReportingCompanies,financeBoWindow,financeReportBoWindow,financeBoReportManifest,acceptFinanceBoReport,financeBoReportHistory,financeCaseReport,reviewHoldScopes,manageAccountReviewHold,reviewHoldForCase,reviewHoldReport,reviewHoldRegistryCompanies,reviewHoldRegistryReport,financeActionReport,financeActionCase,findFinanceActionCase,saveFinanceAction,financeActionUrl,uploadFinanceActionEvidence,
    leadUserManagementContext,leadUpdateUserAccess,leadCreateUser,
    monthlyAuditContext,createMonthlyAuditSet,monthlyAuditDetail,monthlyAuditItemReview,assignMonthlyAuditReviewer,saveMonthlyAuditAssessment,uploadMonthlyAuditEvidence,
    loginIdentity,displayLogin,adminCreateUsernameUser,
    manualPairCandidates,manualPair,pendingManualPairs,submitManualPair,decideManualPair,closeManualPair,closeInternalTransferPair,closeDocumentCase,closeDocumentCaseWithResponsibility,closeProcessErrorCase,
    crossDayWorkbench,submitCrossDayPair,crossDayPair,pendingCrossDayPairs,crossDayPairHistory,decideCrossDayPair,
    submitCrossDayImageReview,crossDayImageReview,decideCrossDayImageReview,closeCrossDayPair,closeCrossDayImageReview,
    pendingCaseClosures,caseClosureRequest,caseClosureHistory,pendingDocumentClosurePreview,submitCaseClosure,submitProcessErrorCase,decideCaseClosure,decideProcessErrorCase,approveOwnDocumentClosure,companyCaseSlas,saveCompanyCaseSla,
    companyHubResults,
    mailSources,mailPullRequests,registerMailSource,requestMailPull,
    requestAccountRecheck,listAccountRechecks,accountRecheckDetail,confirmAccountRecheck,manualPrimaryPreview,acceptManualPrimary,acceptManualPrimaryWithCases,readManualPrimary,manualPrimaryCasesPreview,activateManualPrimaryCases,
    auditSourceArchiveManifest,
    auditSourceArchiveValidate,
    fileRunManagement,effectiveAuditFiles,sourceRevisionHistory,sourceExclusionPreview,setSourceExcluded,sourceWorkspace,setAuditRunHold,correctAuditSource,
    uploadAuditSourceCorrection,addAuditManualSource,
    cfg,
    saveConfig,
    configured,
    signedIn,
    currentEmail,
    authUser,
    restore,
    signIn,
    signInWithGoogle,
    consumeAuthHash,
    requestMagicLink,
    requestPasswordReset,
    updatePassword,
    passwordChangeRequired,passwordAccount,
    signOut,
    fileSnapshotInfo,
    clearFileSnapshots,
    dailyStatus,
    operations,
    quality,
    dailyChecklist,
    boFirstCoverage,
    runtimeSettings,
    damages,
    damageCollections,
    approveDamageCollection,
    confirmDamageReceipt,
    voidDamageReceipt,
    reverseWrongCaseClosure,
    evidenceFiles,
    linkSelectedCaseFile,
    linkWaitingCrossDayFile,
    auditLogs,
    notifications,
    clarificationMatches,
    evidenceUsage,
    currentExceptions,
    caseEvidenceFlags,
    currentExceptionsSummary,
    searchExceptions,
    exceptionDetail,
    matchedEvidence,
    reconciliationEvidence,
    reconciliationOverview,
    confirmAuditPairs,
    registerBoWaitingCases: (runId, rows) => rpc('register_bo_waiting_cases', {p_run_id: runId, p_rows: rows}),
    exceptionFiles,
    queueDueJobs,
    dailyJob,
    claimJob,
    retryJob,
    finishJob,
    finishParseOnly,
    failJob,
    myAccess,
    adminUserAccess,
    adminSaveUserAccess,
    adminInviteUser,
    reclassifySourceFile,
    manualMatchClarificationFile,
    evidenceRecommendations,
    evidenceCaseRecommendations,
    saveEvidenceRecommendation,
    replaceSourceFile,
    fileOcr,
    recoverySource,
    approvePdfRecovery,
    batches,
    download,
    signedUrl,
    markParsed,
    saveRun,
    log,
    ping,
    post,
    patch,
    requestClarification,
    returnClarification,
    submitClarification,
    clarificationHistory,
    submitClarificationWithFile,
    caseEvidence,
    caseEvidenceLibrary,
    caseNotes,
    clarificationInstructions,
    appendCaseNote,
    uploadCaseEvidence,
    pendingCaseEvidence,resumeCaseEvidence,
    linkRecommendedEvidence,
    closeException,
    confirmDamage,
  };
})();

if (typeof window !== "undefined") window.Sb = Sb;

