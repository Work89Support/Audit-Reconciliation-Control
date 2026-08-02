/* =============================================================
   Gmail - ดึงไฟล์แนบจาก Gmail เข้าระบบโดยตรงจากหน้าเว็บ
   ไม่ต้องมีเซิร์ฟเวอร์ ใช้ Google Identity Services + Gmail REST API
   สิทธิ์ที่ขอ: gmail.readonly (อ่านอย่างเดียว แก้/ลบเมลไม่ได้)

   ขั้นตอนใช้งาน
     1. สร้าง OAuth Client ID (Web application) ใน Google Cloud Console
        แล้วใส่โดเมนที่เปิดระบบไว้ใน Authorized JavaScript origins
     2. ใส่ Client ID ในหน้าตั้งค่าของระบบ
     3. กด "เชื่อมต่อ Gmail" ครั้งเดียว แล้วดึงไฟล์ได้เลย
   ============================================================= */

const GmailBox = (() => {
  const GIS = "https://accounts.google.com/gsi/client";
  const API = "https://gmail.googleapis.com/gmail/v1/users/me";
  const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

  /* ไฟล์ที่ระบบอ่านได้ */
  const OK_EXT = /\.(xlsx|xlsm|xls|csv|txt|pdf|zip)$/i;
  const ZIP_EXT = /\.zip$/i;

  /* ตัวกรองเริ่มต้น — อิงชื่อไฟล์จริงที่แผนกใช้ */
  const DEFAULT_QUERY =
    'has:attachment newer_than:7d (filename:xlsx OR filename:pdf OR filename:zip OR filename:csv) ' +
    '(subject:(ออดิท OR audit OR รายงานบัญชี OR ฝาก OR ถอน OR statement OR ชี้แจง) OR ' +
    '"รายงานบัญชี" OR "ฝากมือ" OR "ขอถอนค่าคอม" OR "ถอนเครดิต" OR "AT4" OR "FR8")';

  let token = null; // { value, expiresAt }
  let tokenClient = null;
  let gisReady = null;

  /* ---------------- config ---------------- */
  const cfg = () => {
    const d = Store.data;
    if (!d.gmail) d.gmail = { clientId: "", query: DEFAULT_QUERY, maxResults: 25, autoImport: false, lastPull: null, pulledIds: [] };
    if (!d.gmail.pulledIds) d.gmail.pulledIds = [];
    return d.gmail;
  };
  function saveConfig(patch) {
    Object.assign(cfg(), patch);
    Store.persist();
    return cfg();
  }
  const configured = () => !!cfg().clientId;
  const connected = () => !!token && token.expiresAt > Date.now() + 5000;

  /* ---------------- OAuth ---------------- */
  function loadGis() {
    if (typeof google !== "undefined" && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gisReady) return gisReady;
    gisReady = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = GIS;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("โหลดไลบรารีของ Google ไม่ได้ — ตรวจว่าเครื่องต่ออินเทอร์เน็ตอยู่"));
      document.head.appendChild(s);
    });
    return gisReady;
  }

  async function connect(opts = {}) {
    const c = cfg();
    if (!c.clientId) throw new Error("ยังไม่ได้ใส่ OAuth Client ID ในหน้าตั้งค่า");
    if (location.protocol === "file:") {
      throw new Error("Google ไม่อนุญาตให้ล็อกอินจากไฟล์ที่เปิดตรงจากเครื่อง (file://) — ต้องเปิดผ่าน http หรือ https เช่น GitHub Pages หรือรัน local server");
    }
    await loadGis();
    return new Promise((resolve, reject) => {
      try {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: c.clientId,
          scope: SCOPE,
          prompt: opts.forcePrompt ? "consent" : "",
          callback: (res) => {
            if (res.error) return reject(new Error(googleError(res)));
            token = { value: res.access_token, expiresAt: Date.now() + (Number(res.expires_in || 3600) - 60) * 1000 };
            resolve({ ok: true, expiresIn: Number(res.expires_in || 3600) });
          },
          error_callback: (err) => reject(new Error(googleError(err))),
        });
        tokenClient.requestAccessToken();
      } catch (e) {
        reject(e);
      }
    });
  }

  function googleError(res) {
    const code = res.error || res.type || "";
    const map = {
      popup_closed: "ปิดหน้าต่างล็อกอินก่อนอนุญาต — ลองกดเชื่อมต่ออีกครั้ง",
      popup_failed_to_open: "เบราว์เซอร์บล็อกป๊อปอัป — อนุญาตป๊อปอัปของเว็บนี้แล้วลองใหม่",
      access_denied: "ไม่ได้กดอนุญาตให้อ่านอีเมล",
      invalid_client: "Client ID ไม่ถูกต้อง หรือยังไม่ได้ใส่โดเมนนี้ใน Authorized JavaScript origins",
      idpiframe_initialization_failed: "เบราว์เซอร์บล็อกคุกกี้ของบุคคลที่สาม",
    };
    return map[code] || res.error_description || `เชื่อมต่อ Google ไม่สำเร็จ (${code || "ไม่ทราบสาเหตุ"})`;
  }

  function disconnect() {
    if (token && typeof google !== "undefined" && google.accounts && google.accounts.oauth2) {
      try {
        google.accounts.oauth2.revoke(token.value);
      } catch (e) {}
    }
    token = null;
  }

  /* ---------------- REST ---------------- */
  async function api(path) {
    if (!connected()) await connect();
    const res = await fetch(API + path, { headers: { Authorization: "Bearer " + token.value } });
    if (res.status === 401) {
      token = null;
      throw new Error("สิทธิ์หมดอายุ — กดเชื่อมต่อ Gmail อีกครั้ง");
    }
    if (res.status === 403) throw new Error("Gmail API ยังไม่ถูกเปิดใช้ในโปรเจกต์ หรือบัญชีนี้ไม่ได้รับอนุญาต");
    if (!res.ok) throw new Error(`Gmail ตอบกลับ ${res.status}`);
    return res.json();
  }

  const b64urlToBytes = (s) => {
    const b64 = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };

  const headerOf = (msg, name) => {
    const h = ((msg.payload || {}).headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
    return h ? h.value : "";
  };

  /* เดินโครงสร้าง MIME เก็บเฉพาะไฟล์แนบที่ระบบอ่านได้ */
  function collectParts(part, out) {
    if (!part) return out;
    if (part.filename && part.body && part.body.attachmentId) {
      out.push({ filename: part.filename, attachmentId: part.body.attachmentId, size: part.body.size || 0, mimeType: part.mimeType });
    }
    (part.parts || []).forEach((p) => collectParts(p, out));
    return out;
  }

  /* ---------------- public: ค้นหาเมล ---------------- */
  async function search(query, maxResults) {
    const q = encodeURIComponent(query || cfg().query || DEFAULT_QUERY);
    const n = Math.min(Math.max(Number(maxResults || cfg().maxResults || 25), 1), 100);
    const list = await api(`/messages?q=${q}&maxResults=${n}`);
    const ids = (list.messages || []).map((m) => m.id);
    const out = [];
    for (const id of ids) {
      const msg = await api(`/messages/${id}?format=full`);
      const atts = collectParts(msg.payload, []).filter((a) => OK_EXT.test(a.filename));
      if (!atts.length) continue;
      out.push({
        id,
        threadId: msg.threadId,
        subject: headerOf(msg, "Subject") || "(ไม่มีหัวข้อ)",
        from: headerOf(msg, "From"),
        date: headerOf(msg, "Date"),
        ts: Number(msg.internalDate || 0),
        snippet: msg.snippet || "",
        attachments: atts,
        pulled: cfg().pulledIds.includes(id),
      });
    }
    out.sort((a, b) => b.ts - a.ts);
    saveConfig({ lastPull: new Date().toISOString() });
    return out;
  }

  /* ---------------- public: ดึงไฟล์แนบ ---------------- */
  async function download(messageId, att) {
    const data = await api(`/messages/${messageId}/attachments/${att.attachmentId}`);
    const bytes = b64urlToBytes(data.data);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }

  /* ดึงไฟล์แนบทั้งหมดของเมลหนึ่งฉบับ พร้อมแตก .zip ให้อัตโนมัติ */
  async function fetchFiles(msg, onProgress) {
    const files = [];
    for (let i = 0; i < msg.attachments.length; i++) {
      const a = msg.attachments[i];
      if (onProgress) onProgress((i + 1) / msg.attachments.length, a.filename);
      let buf;
      try {
        buf = await download(msg.id, a);
      } catch (e) {
        files.push({ name: a.filename, error: e.message });
        continue;
      }
      if (ZIP_EXT.test(a.filename)) {
        try {
          const inner = await XlsxReader.unzip(buf);
          inner
            .filter((f) => OK_EXT.test(f.name) && !ZIP_EXT.test(f.name))
            .forEach((f) => files.push({ name: f.name, buffer: f.buffer, size: f.size, fromZip: a.filename, error: f.error }));
          if (!inner.length) files.push({ name: a.filename, error: "ไฟล์ zip ว่างเปล่า" });
        } catch (e) {
          files.push({ name: a.filename, error: "แตกไฟล์ zip ไม่ได้: " + e.message });
        }
      } else {
        files.push({ name: a.filename, buffer: buf, size: a.size });
      }
    }
    return files;
  }

  function markPulled(id) {
    const c = cfg();
    if (!c.pulledIds.includes(id)) c.pulledIds.unshift(id);
    if (c.pulledIds.length > 500) c.pulledIds.length = 500;
    Store.persist();
  }
  function clearPulled() {
    cfg().pulledIds = [];
    Store.persist();
  }

  /* ประกอบ query จากตัวเลือกในหน้าจอ */
  function buildQuery(o = {}) {
    const parts = ["has:attachment"];
    if (o.days) parts.push(`newer_than:${o.days}d`);
    if (o.from) {
      const list = String(o.from)
        .split(/[,\s]+/)
        .filter(Boolean);
      if (list.length) parts.push(list.length === 1 ? `from:${list[0]}` : `{${list.map((f) => "from:" + f).join(" ")}}`);
    }
    if (o.label) parts.push(`label:${o.label}`);
    if (o.subject) parts.push(`subject:(${o.subject})`);
    if (o.words) parts.push(`(${o.words})`);
    if (o.onlyUnread) parts.push("is:unread");
    parts.push("(filename:xlsx OR filename:pdf OR filename:zip OR filename:csv)");
    return parts.join(" ");
  }

  return {
    DEFAULT_QUERY,
    cfg,
    saveConfig,
    configured,
    connected,
    connect,
    disconnect,
    search,
    download,
    fetchFiles,
    markPulled,
    clearPulled,
    buildQuery,
    OK_EXT,
  };
})();

if (typeof window !== "undefined") window.GmailBox = GmailBox;
