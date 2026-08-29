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
      try {
        await refreshSession(s.refresh_token);
      } catch (e) {
        localStorage.removeItem(SB_SESSION_KEY);
      }
    }
    return signedIn();
  }
  function keep(s) {
    session = s;
    try {
      localStorage.setItem(SB_SESSION_KEY, JSON.stringify(s));
    } catch (e) {
      /* sessionStorage ใช้ไม่ได้ก็เก็บแค่ในหน่วยความจำ — ปลอดภัยกว่าเก็บถาวร */
    }
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
    const res = await authFetch(base() + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: cfg().anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error_description || j.msg || j.message || "ต่ออายุการเข้าสู่ระบบไม่สำเร็จ");
    keep({ ...j, expires_at: Math.floor(Date.now() / 1000) + Number(j.expires_in || 3600) });
    return j.user;
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

  async function req(path, opts = {}) {
    await ensureFreshSession();
    const controller = opts.signal ? null : new AbortController();
    const timeout = controller ? setTimeout(() => controller.abort(), Number(opts.timeoutMs || 30000)) : null;
    const fetchOpts = { ...opts, signal: opts.signal || controller.signal, headers: headers(opts.headers) };
    delete fetchOpts.timeoutMs;
    try {
      let res = await fetch(base() + path, fetchOpts);
      /* token อาจถูกเพิกถอนก่อนเวลาที่บันทึกไว้ ลองต่ออายุอีกครั้งหนึ่งก่อนแจ้งผู้ใช้ */
      if ((res.status === 401 || res.status === 403) && session && session.refresh_token) {
        await refreshSession(session.refresh_token);
        res = await fetch(base() + path, { ...fetchOpts, headers: headers(opts.headers) });
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error("ไม่มีสิทธิ์อ่านข้อมูล — ล็อกอิน Supabase ก่อน (RLS เปิดอยู่)");
      }
      if (!res.ok) {
        let msg = `Supabase ตอบกลับ ${res.status}`;
        try {
          const j = await res.json();
          msg = j.message || j.error_description || j.error || msg;
        } catch (e) {}
        throw new Error(msg);
      }
      return res;
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Supabase ใช้เวลาตอบกลับนานเกิน 30 วินาที — กรุณาลองใหม่");
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
  const json = async (path, opts) => {
    const res = await req(path, opts);
    const body = await res.text();
    return body ? JSON.parse(body) : null;
  };

  /* ---------------- Auth ---------------- */
  async function signIn(email, password) {
    const res = await fetch(base() + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: cfg().anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error_description || j.msg || j.message || "ล็อกอินไม่สำเร็จ");
    keep({ ...j, expires_at: Math.floor(Date.now() / 1000) + Number(j.expires_in || 3600) });
    saveConfig({ email });
    return j.user;
  }

  async function loadAuthUser() {
    if (!session || !session.access_token) return null;
    const res = await authFetch(base() + "/auth/v1/user", { headers: headers() });
    const user = await res.json();
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

  function signOut() {
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
    const filters = ["select=*", `order=${order}`, `limit=${opts.limit || defaultLimit}`];
    if (opts.from) filters.push(`business_date=gte.${encodeURIComponent(opts.from)}`);
    if (opts.to) filters.push(`business_date=lte.${encodeURIComponent(opts.to)}`);
    if (opts.company && opts.company !== "ALL") filters.push(`company=eq.${encodeURIComponent(opts.company)}`);
    return json(`/rest/v1/${name}?${filters.join("&")}`);
  }

  const dailyStatus = (opts = 30) => rangedView("v_daily_status", "business_date.desc", opts, 30);
  const operations = (opts = 100) => rangedView("v_recon_operations", "business_date.desc,company.asc", opts, 100);
  const quality = (opts = 1000) => rangedView("v_recon_quality", "business_date.desc,company.asc", opts, 1000);

  async function dailyChecklist({ from, to, company, limit = 5000 } = {}) {
    const filters = ["select=*", "order=business_date.desc,company.asc", `limit=${limit}`];
    if (from) filters.push(`business_date=gte.${encodeURIComponent(from)}`);
    if (to) filters.push(`business_date=lte.${encodeURIComponent(to)}`);
    if (company && company !== "ALL") filters.push(`company=eq.${encodeURIComponent(company)}`);
    return json(`/rest/v1/v_daily_company_checklist?${filters.join("&")}`);
  }

  const runtimeSettings = () => json("/rest/v1/audit_runtime_settings?select=*&id=eq.true&limit=1");

  async function damages({ from, to, company, limit = 5000 } = {}) {
    const filters = ["select=*", "order=business_date.desc,created_at.desc", `limit=${limit}`];
    if (from) filters.push(`business_date=gte.${encodeURIComponent(from)}`);
    if (to) filters.push(`business_date=lte.${encodeURIComponent(to)}`);
    if (company && company !== "ALL") filters.push(`company=eq.${encodeURIComponent(company)}`);
    return json(`/rest/v1/damages?${filters.join("&")}`);
  }

  async function auditLogs({ from, to, limit = 2000 } = {}) {
    const filters = ["select=*", "order=at.desc", `limit=${limit}`];
    if (from) filters.push(`at=gte.${encodeURIComponent(from + "T00:00:00+07:00")}`);
    if (to) filters.push(`at=lt.${encodeURIComponent(to + "T23:59:59.999+07:00")}`);
    return json(`/rest/v1/audit_log?${filters.join("&")}`);
  }

  const notifications = (limit = 1000) =>
    json(`/rest/v1/recon_notifications?${q({ select: "*", limit, order: "created_at.desc" })}`);

  async function clarificationMatches({ from, to, company, limit = 5000 } = {}) {
    const filters = ["select=*", "order=processed_at.desc", `limit=${limit}`];
    if (from) filters.push(`business_date=gte.${encodeURIComponent(from)}`);
    if (to) filters.push(`business_date=lte.${encodeURIComponent(to)}`);
    if (company && company !== "ALL") filters.push(`company=eq.${encodeURIComponent(company)}`);
    return json(`/rest/v1/clarification_matches?${filters.join("&")}`);
  }

  async function currentExceptions({ from, to, company, limit = 5000 } = {}) {
    const pageSize = 1000;
    const fetchPage = async (offset) => {
      const filters = ["select=*", "order=business_date.desc,occurred_at.desc", `limit=${Math.min(pageSize, limit - offset)}`, `offset=${offset}`];
      if (from) filters.push(`business_date=gte.${encodeURIComponent(from)}`);
      if (to) filters.push(`business_date=lte.${encodeURIComponent(to)}`);
      if (company && company !== "ALL") filters.push(`company=eq.${encodeURIComponent(company)}`);
      return json(`/rest/v1/v_current_exceptions?${filters.join("&")}`);
    };
    const first = await fetchPage(0);
    if (!first || first.length < pageSize || limit <= pageSize) return first || [];
    const offsets = [];
    for (let offset = pageSize; offset < limit; offset += pageSize) offsets.push(offset);
    const rest = await Promise.all(offsets.map(fetchPage));
    return first.concat(...rest);
  }

  /* Dashboard ใช้เฉพาะคอลัมน์สรุป ไม่ดึง stm_raw/bo_raw หลายพันแถว
     หลักฐานดิบยังโหลดได้จากหน้ารายการผิดปกติเมื่อผู้ใช้ต้องตรวจเคส */
  async function currentExceptionsSummary({ from, to, company, limit = 5000 } = {}) {
    const pageSize = 1000;
    const columns = [
      "id", "run_id", "code", "business_date", "occurred_at", "company", "bank", "account", "direction",
      "member_code", "ex_type", "type_name", "severity", "status", "track", "due_at", "system_amount",
      "bank_amount", "amount_diff", "risk_amount", "currency", "fx_rate", "time_diff_sec", "employee", "shift",
      "cause", "detail", "created_at", "clarification_file_id", "auto_closed", "resolution_note", "resolved_at",
      "resolved_by", "match_confidence",
    ].join(",");
    /* อ่าน run ล่าสุดจากคิวก่อน แล้วค่อยอ่าน exceptions โดย run_id โดยตรง
       เพื่อไม่ให้ Postgres ต้อง materialize v_current_exceptions หลายพันแถวทุกครั้ง
       (View เดิม timeout บ่อยเมื่อเครื่องฐานข้อมูลมีโหลดสูง) */
    const jobFilters = ["select=last_run_id", "status=eq.completed", "last_run_id=not.is.null", "limit=1000"];
    if (from) jobFilters.push(`business_date=gte.${encodeURIComponent(from)}`);
    if (to) jobFilters.push(`business_date=lte.${encodeURIComponent(to)}`);
    if (company && company !== "ALL") jobFilters.push(`company=eq.${encodeURIComponent(company)}`);
    const jobs = await json(`/rest/v1/daily_recon_jobs?${jobFilters.join("&")}`);
    const runIds = [...new Set((jobs || []).map((row) => row.last_run_id).filter(Boolean))];
    if (!runIds.length) return [];
    const runFilter = `run_id=in.(${runIds.join(",")})`;
    const fetchPage = async (offset) => {
      const filters = [`select=${columns}`, runFilter, "order=business_date.desc,occurred_at.desc", `limit=${Math.min(pageSize, limit - offset)}`, `offset=${offset}`];
      return json(`/rest/v1/exceptions?${filters.join("&")}`);
    };
    const first = await fetchPage(0);
    if (!first || first.length < pageSize || limit <= pageSize) return first || [];
    const offsets = [];
    for (let offset = pageSize; offset < limit; offset += pageSize) offsets.push(offset);
    const rest = await Promise.all(offsets.map(fetchPage));
    return first.concat(...rest);
  }

  async function searchExceptions({ term, from, to, company, limit = 1000 } = {}) {
    const clean = String(term || "").trim().replace(/[,*()]/g, " ").replace(/\s+/g, " ");
    if (!clean) return [];
    // Keep the server-side search on compact columns. Searching the large raw
    // JSON/text evidence fields with a leading wildcard regularly exceeds the
    // database statement timeout. The client still searches those raw fields
    // in the rows it has already loaded.
    const fields = ["code", "company", "bank", "account", "direction", "member_code", "ex_type", "type_name", "employee", "cause"];
    const or = `(${fields.map((field) => `${field}.ilike.*${clean}*`).join(",")})`;
    const filters = ["select=*", "order=business_date.desc,occurred_at.desc", `limit=${limit}`, `or=${encodeURIComponent(or)}`];
    if (from) filters.push(`business_date=gte.${encodeURIComponent(from)}`);
    if (to) filters.push(`business_date=lte.${encodeURIComponent(to)}`);
    if (company && company !== "ALL") filters.push(`company=eq.${encodeURIComponent(company)}`);
    return json(`/rest/v1/v_current_exceptions?${filters.join("&")}`);
  }

  /* โหลดรายละเอียดหนักเฉพาะตอนผู้ตรวจเปิดเคส ไม่ดึง raw evidence ทุกแถวในหน้ารวม */
  async function exceptionDetail(exceptionId) {
    if (!exceptionId) return null;
    const rows = await json(`/rest/v1/exceptions?id=eq.${encodeURIComponent(exceptionId)}&select=*&limit=1`);
    return rows[0] || null;
  }

  /* ไฟล์ประกอบของเคส = ไฟล์ทั้งหมดที่ใช้สร้าง recon run + ไฟล์ชี้แจงที่จับคู่เคส */
  async function exceptionFiles(runId, clarificationFileId) {
    const ids = [];
    if (runId) {
      const runs = await json(`/rest/v1/recon_runs?id=eq.${encodeURIComponent(runId)}&select=file_ids&limit=1`);
      (runs[0]?.file_ids || []).forEach((id) => ids.push(id));
    }
    if (clarificationFileId) ids.push(clarificationFileId);
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return [];
    return json(`/rest/v1/source_files?id=in.(${unique.join(",")})&select=*&order=file_name.asc`);
  }

  const rpc = (name, body = {}) =>
    json(`/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const queueDueJobs = (from, to) => rpc("queue_due_daily_recon_jobs", { p_from: from, p_to: to });
  const claimJob = (worker) => rpc("claim_daily_recon_job", { p_worker: worker || currentEmail() || "web-worker" });
  const finishJob = (jobId, runId) => rpc("finish_daily_recon_job", { p_job_id: jobId, p_run_id: runId });
  const failJob = (jobId, error) => rpc("fail_daily_recon_job", { p_job_id: jobId, p_error: String(error || "Unknown error") });
  const reclassifySourceFile = (fileId, company, kind) => rpc("reclassify_source_file", {
    p_file_id: fileId,
    p_company: company,
    p_kind: kind,
    p_actor: currentEmail() || "web-auditor",
  });

  async function fileOcr(fileId) {
    if (!fileId) return null;
    const rows = await json(`/rest/v1/source_file_ocr?source_file_id=eq.${encodeURIComponent(fileId)}&select=*&limit=1`);
    return rows[0] || null;
  }

  /* เมลทั้งหมดของช่วงวันที่ พร้อมไฟล์ */
  async function batches({ from, to, company } = {}) {
    const filters = ["select=*,source_files(*)", "order=received_at.desc"];
    if (from) filters.push(`business_date=gte.${from}`);
    if (to) filters.push(`business_date=lte.${to}`);
    if (company && company !== "ALL") filters.push(`company=eq.${company}`);
    return json(`/rest/v1/mail_batches?${filters.join("&")}`);
  }

  /* ---------------- Storage ---------------- */
  async function download(storagePath) {
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
        summary: opts.summary || null,
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
          company: e.company,
          bank: e.bank,
          account: e.account,
          direction: e.direction,
          member_code: e.member || null,
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

  return {
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
    signOut,
    dailyStatus,
    operations,
    quality,
    dailyChecklist,
    runtimeSettings,
    damages,
    auditLogs,
    notifications,
    clarificationMatches,
    currentExceptions,
    currentExceptionsSummary,
    searchExceptions,
    exceptionDetail,
    exceptionFiles,
    queueDueJobs,
    claimJob,
    finishJob,
    failJob,
    reclassifySourceFile,
    fileOcr,
    batches,
    download,
    signedUrl,
    markParsed,
    saveRun,
    log,
    ping,
    post,
    patch,
  };
})();

if (typeof window !== "undefined") window.Sb = Sb;
