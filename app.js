/* =============================================================
   Audit AI Reconciliation - Application shell
   - hash router แยกหน้าจอจริงเมื่อกดเมนู (#/dashboard, #/exceptions ...)
   - สิทธิ์ตาม role, ฟังก์ชันทำงานจริงบนข้อมูลจำลอง, audit log อัตโนมัติ
   ============================================================= */

/* ---------------- utilities ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = (n) => Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 });
const num = (n) => Number(n || 0).toLocaleString("th-TH");
const nowStamp = () => {
  const d = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

async function copyPlainText(text) {
  const value = String(text || "");
  try {
    await navigator.clipboard.writeText(value);
  } catch (_) {
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  return value;
}

/* ---------------- routes ---------------- */
const ICONS = {
  dashboard: "M3 13h8V3H3v10Zm10 8h8V11h-8v10ZM3 21h8v-6H3v6ZM13 9h8V3h-8v6Z",
  intake: "M4 4h16v4H4V4Zm0 6h16v10H4V10Zm3 3h6v2H7v-2Z",
  exceptions: "M12 2 1 21h22L12 2Zm0 6 6.5 11h-13L12 8Zm-1 3v4h2v-4h-2Zm0 5v2h2v-2h-2Z",
  matching: "M4 6h7v3H4V6Zm0 9h7v3H4v-3Zm9-9h7v3h-7V6Zm0 9h7v3h-7v-3Zm-2-4.5h2v3h-2v-3Z",
  approvals: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z",
  damage: "M12 2 2 20h20L12 2Zm0 5 6 11H6l6-11Zm-1 3v4h2v-4h-2Z",
  fx: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm-1.2 3v1.3c-1.3.2-2.2 1-2.2 2.2 0 1.4 1.1 2 2.6 2.4 1.1.3 1.5.6 1.5 1.1 0 .5-.5.9-1.3.9-.9 0-1.6-.4-2.1-1l-1.2 1.2c.6.7 1.5 1.2 2.7 1.4V18h1.6v-1.4c1.5-.2 2.4-1.1 2.4-2.4 0-1.4-1-2.1-2.7-2.5-1-.3-1.4-.5-1.4-1 0-.5.4-.8 1.2-.8.8 0 1.4.3 1.9.9l1.2-1.2c-.6-.6-1.3-1-2.2-1.2V7h-1.6Z",
  cloud: "M6.5 19a4.5 4.5 0 0 1-.4-8.98A6 6 0 0 1 17.7 9.2 4.25 4.25 0 0 1 17.25 19H6.5Zm5-8.6-3.2 3.2 1.4 1.4 1.3-1.3V17h2v-3.3l1.3 1.3 1.4-1.4-3.2-3.2Z",
  pm: "M3 3h18v4H3V3Zm0 6h8v12H3V9Zm10 0h8v5h-8V9Zm0 7h8v5h-8v-5Z",
  kpi: "M4 20h3v-7H4v7Zm6.5 0h3V4h-3v16ZM17 20h3v-11h-3v11Z",
  reports: "M6 2h8l4 4v16H6V2Zm7 1.5V7h3.5L13 3.5ZM8 11h8v2H8v-2Zm0 4h8v2H8v-2Z",
  talk: "M4 4h16v11H8l-4 4V4Zm3 3v2h10V7H7Zm0 4v2h7v-2H7Z",
  rules: "M4 5h16v2H4V5Zm0 6h10v2H4v-2Zm0 6h16v2H4v-2Z",
  users: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5Z",
  log: "M5 3h14v18l-7-3-7 3V3Zm3 4v2h8V7H8Zm0 4v2h8v-2H8Z",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 4-2 .5.9 1.9-1.5 1.5-1.9-.9L15 17l-.5 2h-2.1L12 17l-1.9.9L8.6 16l-1.9.9L5.2 15.4 6.1 13.5 4 13v-2l2.1-.5-.9-1.9L6.7 7l1.9.9L10 6l.5-2h2.1L13 6l1.9-.9L16.4 6.6l-.9 1.9L18 9v3Z",
  roadmap: "M3 4h7v7H3V4Zm11 0h7v4h-7V4ZM3 13h7v7H3v-7Zm11-1h7v9h-7v-9Z",
  import: "M12 3v10.2l3.6-3.6 1.4 1.4-6 6-6-6 1.4-1.4 3.6 3.6V3h2ZM4 19h16v2H4v-2Z",
  bell: "M12 22a2.2 2.2 0 0 0 2.2-2.2H9.8A2.2 2.2 0 0 0 12 22Zm7-5.3V11a7 7 0 0 0-5.2-6.77V3.5a1.8 1.8 0 1 0-3.6 0v.73A7 7 0 0 0 5 11v5.7L3.2 18.5v.9h17.6v-.9L19 16.7Z",
  clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 10.6 4 2.4-1 1.7-5-3V6h2v6.6Z",
  clarify: "M4 3h16v13H8l-4 4V3Zm3 3v2h10V6H7Zm0 4v2h7v-2H7Zm11.5 6L22 19.5 20.5 21 17 17.5 18.5 16Z",
};

const ROUTES = [
  {
    group: "งานประจำวัน",
    items: [
      { id: "dashboard", label: "แดชบอร์ด", icon: "dashboard", title: "แดชบอร์ดตรวจสอบประจำวัน", desc: "ภาพรวมรายการ ผลจับคู่ และรายการผิดปกติ แยกตามบริษัท", filters: true },
      { id: "daily-summary", label: "สรุปรายวัน", icon: "reports", title: "สรุป 1 บริษัท 1 วัน", desc: "ดูไฟล์ที่ได้รับ ผลกระทบยอด และสถานะการแก้ไขทั้งหมดของบริษัทในวันเดียว พร้อม Export", filters: false },
      { id: "cloud", label: "ไฟล์และสถานะ", icon: "cloud", title: "ตรวจไฟล์จากเมล", desc: "เปิดดูไฟล์ต้นฉบับ ตรวจบริษัท ประเภท และสถานะอ่านไฟล์จาก Supabase ก่อนกระทบยอด", filters: true },
      { id: "intake", label: "ตรวจไฟล์เข้า", icon: "intake", title: "ตรวจไฟล์ก่อนกระทบยอด", desc: "ดูไฟล์จริงแยกตามบริษัทและประเภท PM / ฝาก / ถอน หากยังอ่านไม่สำเร็จระบบจะแจ้งให้ตรวจต่อ", filters: true, hidden: true },
      { id: "exceptions", label: "รายการผิดปกติ", icon: "exceptions", title: "Exception Queue", desc: "คิวรายการที่ไม่ผ่าน 3-point match พร้อมหลักฐานย้อนกลับและ workflow ชี้แจง", filters: true },
      { id: "matching", label: "3-Point Match", icon: "matching", title: "ตรวจการจับคู่ 3 จุด", desc: "เทียบ account, time, amount ระหว่าง STM กับ BO ทีละรายการพร้อม tolerance ที่ใช้", filters: true, hidden: true },
    ],
  },
  {
    group: "ตรวจสอบและอนุมัติ",
    items: [
      { id: "clarify", label: "ติดตามและอนุมัติ", icon: "clarify", title: "งานชี้แจงแยกตามบริษัท", desc: "ติดตาม Exception กำหนดส่ง และเปิดคิวอนุมัติจากจุดเดียว โดยไม่แบ่งกะ", filters: true },
      { id: "approvals", label: "อนุมัติ / ปิดเคส", icon: "approvals", title: "คำขอรออนุมัติ", desc: "รายการที่ชี้แจงแล้วรอ Audit Lead ตรวจทาน อนุมัติ หรือส่งกลับ", filters: false },
      { id: "damage", label: "ทะเบียนความเสียหาย", icon: "damage", title: "Damage Register", desc: "บันทึกความเสียหายรายวัน แยกตามรอบชี้แจง 1-15, 16-25, 26-สิ้นเดือน", filters: true },
    ],
  },
  {
    group: "รายงาน",
    items: [
      { id: "kpi", label: "KPI บริษัท", icon: "kpi", title: "KPI ตามบริษัทและพนักงาน", desc: "ความผิดพลาดตามบริษัท ประเภท และผู้ตรวจ เพื่อใช้ประเมินและลดความผิดซ้ำ", filters: true, hidden: true },
      { id: "reports", label: "รายงาน & Export", icon: "reports", title: "รายงานรายวัน / รายเดือน", desc: "สรุปผลตรวจ, แนวโน้มความเสียหาย และ export ให้การเงิน / บุคคล", filters: true },
      { id: "talk", label: "Talk to Data", icon: "talk", title: "ถามข้อมูลด้วยภาษาไทย", desc: "ถามจากข้อมูลที่ reconcile แล้ว ทุกคำตอบอ้างอิงตัวเลข ช่วงวันที่ และลิงก์กลับหลักฐาน", filters: false, hidden: true },
    ],
  },
  {
    group: "ระบบ",
    items: [
      { id: "rules", label: "Bank Rules", icon: "rules", title: "กฎธนาคารและ Tolerance", desc: "ปรับกฎรายธนาคารได้โดยไม่ต้องแก้โปรแกรม ทุกการเปลี่ยนถูกบันทึกใน audit log", filters: false },
      { id: "notifications", label: "การแจ้งเตือน", icon: "bell", title: "ศูนย์การแจ้งเตือน", desc: "แจ้งเมื่อไฟล์ขาด พบ exception ระดับสูง เลย SLA หรือใกล้ครบรอบชี้แจง พร้อมตั้งกฎและช่องทางได้", filters: false },
      { id: "audit-log", label: "Audit Log", icon: "log", title: "บันทึกการใช้งานระบบ", desc: "ทุก note, status, approval, การตั้งค่า ถูกบันทึกพร้อมเวลาและผู้ทำรายการ", filters: true },
      { id: "users", label: "ผู้ใช้และสิทธิ์", icon: "users", title: "ผู้ใช้ บทบาท และบริษัท", desc: "กำหนดหน้าที่และบริษัทที่ผู้ใช้แต่ละคนรับผิดชอบ สิทธิ์ถูกบังคับซ้ำที่ฐานข้อมูล", filters: false },
    ],
  },
];
const ROUTE_MAP = {};
ROUTES.forEach((g) => g.items.forEach((it) => (ROUTE_MAP[it.id] = it)));

/* หน้าที่แต่ละ role มองเห็น */
const ROUTE_ROLES = {
  monitor: ["cloud", "dashboard", "daily-summary", "exceptions", "matching", "clarify", "reports", "notifications"],
  lead: ["cloud", "dashboard", "daily-summary", "intake", "exceptions", "matching", "clarify", "approvals", "damage", "kpi", "reports", "talk", "rules", "notifications", "audit-log"],
  shift_lead: ["cloud", "daily-summary", "clarify", "notifications"],
  exec: ["dashboard", "daily-summary", "kpi", "reports", "damage", "notifications"],
  /* ผู้ดูแลระบบต้องตรวจสอบและช่วยงานได้ทุกหน้า รวมหน้าวิเคราะห์ที่ซ่อนจากบทบาททั่วไป */
  admin: Object.keys(ROUTE_MAP),
};

/* ---------------- state ---------------- */
const PROD_TODAY = (() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();
const OPERATING_START_DATE = "2026-08-30";
const DEFAULT_WORK_DATE = PROD_TODAY < OPERATING_START_DATE ? OPERATING_START_DATE : PROD_TODAY;
/* เปิดมาครั้งแรกให้เห็นย้อนหลังไม่เกิน 30 วัน แต่ไม่ย้อนก่อนวันเริ่มใช้งานจริง */
const DEFAULT_RANGE_FROM = (() => {
  const [y, m, d] = DEFAULT_WORK_DATE.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d - 30));
  const candidate = date.toISOString().slice(0, 10);
  return candidate < OPERATING_START_DATE ? OPERATING_START_DATE : candidate;
})();
const state = {
  route: "cloud",
  role: "lead",
  filters: { date: DEFAULT_WORK_DATE, from: DEFAULT_RANGE_FROM, to: DEFAULT_WORK_DATE, preset: "custom", company: "ALL", direction: "ALL" },
  filtersOpen: false,
  exFilter: { q: "", type: "ALL", severity: "ALL", status: "ACTION", sla: false },
  exceptionView: "sheet",
  sort: { key: "time", dir: "asc" },
  page: 1,
  perPage: 12,
  selected: null,
  matchIndex: 0,
  damageCycle: "C1",
  dailySummary: { date: DEFAULT_WORK_DATE, company: "3XB" },
  dataset: "production",
  access: { email: "", fullName: "", role: "monitor", companies: [], active: false, loaded: false },
  chat: [],
};

const can = (cap) => DB.roles[state.role].can.includes(cap);
const canAccessCompany = (company) => {
  const code = String(company || "").trim().toUpperCase();
  if (state.dataset !== "production" || ["lead", "exec", "admin"].includes(state.role)) return true;
  return state.access.companies.includes("*") || state.access.companies.includes(code);
};
const companyMaster = () => {
  const rows = state.dataset === "production"
    ? DB.companies.map((company) => company.code === "7M" ? { ...company, code: "UFABET7M", name: "UFABET7M" } : company)
    : DB.companies;
  return rows.filter((company) => canAccessCompany(company.code));
};

/* รายชื่อประเภท exception ทั้งหมด = ที่ตั้งไว้ในระบบ + ที่เกิดจริงจากกฎธุรกิจ */
function allExceptionTypes() {
  const out = DB.exceptionTypes.map((t) => ({ code: t.code, name: t.name }));
  const seen = new Set(out.map((t) => t.code));
  DB.exceptions.forEach((e) => {
    if (seen.has(e.type)) return;
    seen.add(e.type);
    out.push({ code: e.type, name: e.typeName || e.type });
  });
  return out;
}
const currentUser = () => ({
  username: state.access.email || (typeof Sb !== "undefined" ? Sb.currentEmail() : "") || "ผู้ใช้งานระบบ",
  name: state.access.fullName || state.access.email || "ผู้ใช้งานระบบ",
  role: state.role,
  shift: "",
});

/* ---------------- audit log + toast ---------------- */
function logAction(action, entity, target, detail) {
  const entry = { at: nowStamp(), user: currentUser().username, action, entity, target, detail };
  DB.auditLog.unshift(entry);
  if (typeof Store !== "undefined") {
    Store.data.auditLog.unshift(entry);
    Store.persist();
  }
  if (state.dataset === "production" && typeof Sb !== "undefined" && Sb.signedIn()) {
    Sb.post("audit_log", [{ actor: Sb.currentEmail() || currentUser().username, action, entity, target: String(target || ""), detail: String(detail || "") }], "return=minimal").catch((e) => console.warn("audit log", e));
  }
}

/* บันทึกสถานะเคสที่ถูกแก้ ให้อยู่รอดข้ามการรีเฟรช */
function saveOverride(e) {
  Store.data.exOverrides[e.id] = {
    status: e.status,
    hasEvidence: e.hasEvidence,
    notes: e.notes,
    resolutionNote: e.resolutionNote || "",
    resolvedAt: e.resolvedAt || null,
    resolvedBy: e.resolvedBy || null,
    evidence: (e.evidence || []).map((f) => ({ name: f.name, size: f.size, at: f.at })),
  };
  Store.persist();
  if (state.dataset === "production" && typeof Sb !== "undefined" && Sb.signedIn() && e.dbId) {
    const authId = Sb.authUser()?.id || null;
    const stamp = new Date().toISOString();
    const payload = { status: e.status, updated_at: new Date().toISOString() };
    if (e.status === "clarifying") Object.assign(payload, {
      requested_by: e.requestedBy || authId,
      requested_at: e.requestedAt || stamp,
    });
    if (e.status === "answered") Object.assign(payload, {
      response_text: e.responseText || e.resolutionNote || (e.notes || []).map((note) => note.text).filter(Boolean).join("\n") || "ชี้แจงพร้อมหลักฐาน",
      responded_by: e.respondedBy || authId,
      responded_at: e.respondedAt || stamp,
    });
    if (["approved", "closed"].includes(e.status)) Object.assign(payload, {
      approved_by: e.approvedBy || authId,
      approved_at: e.approvedAt || stamp,
    });
    if (e.status === "closed" && e.resolutionNote) Object.assign(payload, {
      resolution_note: e.resolutionNote,
      resolved_at: e.resolvedAt || new Date().toISOString(),
      resolved_by: e.resolvedBy || Sb.currentEmail() || currentUser().username,
    });
    Sb.patch("exceptions", `id=eq.${encodeURIComponent(e.dbId)}`, payload).catch((err) => {
      toast("บันทึกสถานะกลับ Supabase ไม่สำเร็จ: " + err.message, "warn");
    });
  }
}
function applyStoredState() {
  const ov = Store.data.exOverrides || {};
  DB.exceptions.forEach((e) => {
    const o = ov[e.id];
    if (!o) return;
    e.status = o.status ?? e.status;
    e.hasEvidence = o.hasEvidence ?? e.hasEvidence;
    e.notes = o.notes || e.notes;
    e.resolutionNote = o.resolutionNote || e.resolutionNote;
    e.resolvedAt = o.resolvedAt || e.resolvedAt;
    e.resolvedBy = o.resolvedBy || e.resolvedBy;
    e.evidence = o.evidence || e.evidence;
  });
  if (Store.data.settings) Object.assign(DB.settings, Store.data.settings);
  if (Store.data.auditLog.length) DB.auditLog = Store.data.auditLog.concat(DB.auditLog).slice(0, 500);
  (Store.data.extraDamages || []).forEach((d) => {
    if (!DB.damages.some((x) => x.id === d.id)) DB.damages.push(d);
  });
}
function toast(msg, kind = "ok") {
  const wrap = $("#toastWrap");
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.classList.add("on"), 10);
  setTimeout(() => {
    el.classList.remove("on");
    setTimeout(() => el.remove(), 300);
  }, 3200);
}
function deny(what) {
  toast(`สิทธิ์ ${DB.roles[state.role].name} ไม่สามารถ${what}ได้`, "warn");
}

/* ---------------- data selectors ---------------- */
function filteredExceptions(source = DB.exceptions) {
  const f = state.filters;
  const x = state.exFilter;
  return source.filter((e) => {
    if (!canAccessCompany(e.company)) return false;
    if (!inRange(e.date)) return false;
    if (f.company !== "ALL" && e.company !== f.company) return false;
    if (f.direction !== "ALL" && e.direction !== f.direction) return false;
    if (x.type !== "ALL" && e.type !== x.type) return false;
    if (x.severity !== "ALL" && e.severity !== x.severity) return false;
    if (x.status === "ACTION" && ["closed", "approved", "damage"].includes(e.status)) return false;
    if (!['ALL', 'ACTION'].includes(x.status) && e.status !== x.status) return false;
    if (x.sla && !e.overSla) return false;
    if (x.q) {
      const q = x.q.toLowerCase();
      const provider = typeof pmProviderOf === "function" ? pmProviderOf(`${e.account} ${e.detail} ${e.stmRaw} ${e.boRaw}`) || "" : "";
      const hay = `${e.id} ${e.company} ${e.account} ${e.employee} ${e.member} ${e.type} ${e.typeName} ${e.cause} ${e.bank} ${e.direction} ${e.detail} ${e.stmRaw} ${e.boRaw} ${provider}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
function scopedExceptions() {
  const f = state.filters;
  return DB.exceptions.filter(
    (e) =>
      canAccessCompany(e.company) &&
      inRange(e.date) &&
      (f.company === "ALL" || e.company === f.company) &&
      (f.direction === "ALL" || e.direction === f.direction),
  );
}
/* ---------------- ช่วงวันที่ ---------------- */
const DATE_PRESETS = [
  { code: "day", name: "วันที่ตรวจ (วันเดียว)" },
  { code: "last7", name: "7 วันล่าสุด" },
  { code: "last30", name: "30 วันล่าสุด" },
  { code: "thisMonth", name: "เดือนนี้" },
  { code: "lastMonth", name: "เดือนก่อน" },
  { code: "thisQuarter", name: "ไตรมาสนี้" },
  { code: "thisYear", name: "ปีนี้" },
  { code: "custom", name: "กำหนดเอง" },
];
function shiftDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  const p = (x) => String(x).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}
function monthBounds(iso, monthOffset) {
  const [y, m] = iso.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1 + monthOffset, 1));
  const end = new Date(Date.UTC(y, m + monthOffset, 0));
  const p = (x) => String(x).padStart(2, "0");
  return [
    `${start.getUTCFullYear()}-${p(start.getUTCMonth() + 1)}-01`,
    `${end.getUTCFullYear()}-${p(end.getUTCMonth() + 1)}-${p(end.getUTCDate())}`,
  ];
}
function applyPreset(preset) {
  const base = state.filters.date;
  const f = state.filters;
  f.preset = preset;
  if (preset === "day") [f.from, f.to] = [base, base];
  else if (preset === "last7") [f.from, f.to] = [shiftDays(base, -6), base];
  else if (preset === "last30") [f.from, f.to] = [shiftDays(base, -29), base];
  else if (preset === "thisMonth") [f.from, f.to] = monthBounds(base, 0);
  else if (preset === "lastMonth") [f.from, f.to] = monthBounds(base, -1);
  else if (preset === "thisQuarter") {
    const m = +base.split("-")[1];
    const qStart = Math.floor((m - 1) / 3) * 3 + 1;
    const y = base.split("-")[0];
    const [, end] = monthBounds(`${y}-${String(qStart + 2).padStart(2, "0")}-01`, 0);
    [f.from, f.to] = [`${y}-${String(qStart).padStart(2, "0")}-01`, end];
  } else if (preset === "thisYear") {
    const y = base.split("-")[0];
    [f.from, f.to] = [`${y}-01-01`, `${y}-12-31`];
  }
}
const inRange = (d) => {
  if (!d || d === "-") return true;
  const day = String(d).slice(0, 10);
  return day >= state.filters.from && day <= state.filters.to;
};
const rangeLabel = () =>
  state.filters.from === state.filters.to ? state.filters.from : `${state.filters.from} ถึง ${state.filters.to}`;

/* แสดงผลต่างให้ตรงกับความหมายของ exception แต่ละประเภท */
function diffLabel(e) {
  switch (e.type) {
    case "amount_diff":
      return `<span class="danger">${money(e.amountDiff)}</span>`;
    case "time_diff":
      return `${e.timeDiffSec} วิ`;
    case "cross_day":
      return `<span class="muted">ข้ามวัน ${e.timeDiffSec} วิ</span>`;
    case "missing_bo":
      return `<span class="danger">ไม่พบใน BO</span>`;
    case "missing_stm":
      return `<span class="danger">ไม่พบใน STM</span>`;
    case "duplicate":
      return `<span class="danger">ซ้ำ ${money(e.riskAmount)}</span>`;
    default:
      return `<span class="danger">${money(e.riskAmount)}</span>`;
  }
}
const sumRisk = (list) => list.reduce((a, c) => a + (c.riskAmount || 0), 0);
const severityColor = (s) => Charts.STATUS[s] || "#7c8ea2";
const statusMeta = (code) => DB.statuses.find((s) => s.code === code) || { name: code, tone: "grey" };
const sevMeta = (code) => DB.severities.find((s) => s.code === code) || { name: code };
const isEmptyPmFile = (file) => file?.parsed && !file?.parse_error && file?.kind === "pm_statement" && Number(file?.row_count || 0) === 0 && Number(file?.size_bytes || 0) <= 16;
const parsedFileLabel = (file) => isEmptyPmFile(file) ? "ไม่มีรายการ (0)" : "พร้อมใช้งาน";

/* ปิดด่วนได้เมื่อมีรายการครบทั้งสองฝั่งและยอดเท่ากัน ผู้ตรวจยังต้องกดยืนยันเอง */
function isQuickCloseEligible(e) {
  return e
    && !["closed", "approved", "damage"].includes(e.status)
    && e.bankAmount !== null && e.bankAmount !== undefined
    && e.systemAmount !== null && e.systemAmount !== undefined
    && Math.abs(Number(e.bankAmount) - Number(e.systemAmount)) < 0.01;
}

function completeQuickClose(e) {
  if (!can("approve")) return deny("ปิดเคส");
  if (!isQuickCloseEligible(e)) return toast("เคสนี้ยังปิดด่วนไม่ได้ กรุณาตรวจรายละเอียดก่อน", "warn");
  const note = "Audit ยืนยันรายการครบทั้ง STM และ BO/ระบบ และยอดตรงกัน";
  e.status = "closed";
  e.resolutionNote = note;
  e.resolvedAt = new Date().toISOString();
  e.resolvedBy = (typeof Sb !== "undefined" && Sb.signedIn() ? Sb.currentEmail() : "") || currentUser().username;
  e.notes = e.notes || [];
  e.notes.push({ by: currentUser().username, at: nowStamp(), text: note });
  logAction("quick_close", "exception", e.id, `${note} · STM ${money(e.bankAmount)} · BO ${money(e.systemAmount)} · ต่างเวลา ${num(e.timeDiffSec || 0)} วินาที`);
  saveOverride(e);
  closeModal();
  closeDrawer();
  toast(`ปิดเคส ${e.id} แล้ว — ยอดสองฝั่งตรงกัน`);
  renderNav();
  render();
}

function confirmQuickClose(e) {
  if (!can("approve")) return deny("ปิดเคส");
  if (!isQuickCloseEligible(e)) return toast("เคสนี้ยังปิดด่วนไม่ได้ กรุณาตรวจรายละเอียดก่อน", "warn");
  openModal(
    `ยืนยันปิดเคส ${h(e.id)}`,
    `<div class="quick-close-box"><strong>พบข้อมูลครบทั้งสองฝั่งและยอดตรงกัน</strong><div class="quick-close-grid"><div><span>STM / ธนาคาร</span><b>${money(e.bankAmount)}</b></div><div><span>BO / ระบบ</span><b>${money(e.systemAmount)}</b></div><div><span>ผลต่างยอด</span><b>${money(Number(e.systemAmount) - Number(e.bankAmount))}</b></div><div><span>ผลต่างเวลา</span><b>${num(e.timeDiffSec || 0)} วินาที</b></div></div><small>ระบบจะบันทึกผู้ยืนยัน เวลา และเหตุผลไว้ใน Audit Log การปิดนี้เป็นการตัดสินใจของผู้ตรวจ ไม่ใช่การปิดอัตโนมัติ</small></div>`,
    `<button class="ghost-button" id="quickCloseCancel">กลับไปตรวจ</button><button class="primary-button" id="quickCloseConfirm">ยืนยันยอดตรงและปิดเคส</button>`,
  );
  $("#quickCloseCancel").addEventListener("click", closeModal);
  $("#quickCloseConfirm").addEventListener("click", () => completeQuickClose(e));
}

/* ---------------- shell rendering ---------------- */
function renderNav() {
  const allowed = ROUTE_ROLES[state.role];
  $("#navList").innerHTML = ROUTES.map((g) => {
    const items = g.items.filter((it) => allowed.includes(it.id) && (!it.hidden || state.role === "admin"));
    if (!items.length) return "";
    return (
      `<span class="nav-label">${h(g.group)}</span>` +
      items
        .map(
          (it) =>
            `<a href="#/${it.id}" class="${state.route === it.id ? "active" : ""}" data-route="${it.id}" title="${h(it.label)}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[it.icon]}"/></svg><span>${h(it.label)}</span>
              ${it.id === "exceptions" ? `<b class="nav-count">${DB.exceptions.filter((e) => canAccessCompany(e.company) && !["closed", "approved"].includes(e.status)).length}</b>` : ""}
              ${it.id === "approvals" ? `<b class="nav-count">${DB.exceptions.filter((e) => canAccessCompany(e.company) && e.status === "answered").length}</b>` : ""}
            </a>`,
        )
        .join("")
    );
  }).join("");
}

function setSidebarCollapsed(collapsed) {
  const shell = $("#appShell");
  const button = $("#navToggle");
  if (!shell || !button) return;
  shell.classList.toggle("sidebar-collapsed", collapsed);
  button.setAttribute("aria-expanded", String(!collapsed));
  button.setAttribute("aria-label", collapsed ? "แสดงแถบเมนู" : "ซ่อนแถบเมนู");
  button.title = collapsed ? "แสดงแถบเมนู" : "ซ่อนแถบเมนู";
  try { localStorage.setItem("audit-sidebar-collapsed", collapsed ? "1" : "0"); } catch (_) {}
}

function renderAuditFlow() {
  const files = (cloudState.batches || []).flatMap((batch) => batch.source_files || []);
  const fileIssues = files.filter((file) => file.parse_error || file.kind === "unknown").length;
  const fileWaiting = files.filter((file) => !file.parsed && !file.parse_error && !["unknown", "doc_clarify"].includes(file.kind)).length;
  const openExceptions = DB.exceptions.filter((e) => !["closed", "approved"].includes(e.status));
  const waitingClarify = openExceptions.filter((e) => ["clarifying", "answered", "damage"].includes(e.status));
  const steps = [
    { route: "cloud", no: 1, label: "ตรวจไฟล์", meta: files.length ? `${num(files.length)} ไฟล์${fileIssues ? ` · ปัญหา ${num(fileIssues)}` : ""}${fileWaiting ? ` · รอระบบ ${num(fileWaiting)}` : fileIssues ? "" : " · พร้อม"}` : "ตรวจไฟล์ที่ได้รับ", tone: fileIssues ? "warn" : files.length ? "ok" : "" },
    { route: "dashboard", no: 2, label: "ดูภาพรวม", meta: "แยกตามบริษัท", tone: "" },
    { route: "exceptions", no: 3, label: "ตรวจข้อผิดปกติ", meta: `${num(openExceptions.length)} เคสเปิด`, tone: openExceptions.length ? "warn" : "ok" },
    { route: "clarify", no: 4, label: "ติดตาม/อนุมัติ", meta: `${num(waitingClarify.length)} งาน`, tone: waitingClarify.length ? "warn" : "ok" },
    { route: "reports", no: 5, label: "ออกรายงาน", meta: "Export หลักฐาน", tone: "" },
  ];
  const active = { intake: "cloud", matching: "exceptions", approvals: "clarify", kpi: "reports", talk: "reports" }[state.route] || state.route;
  $("#auditFlow").innerHTML = steps.map((step) => `<a href="#/${step.route}" class="${active === step.route ? "active" : ""} ${step.tone}"><i>${step.no}</i><span><b>${h(step.label)}</b><small>${h(step.meta)}</small></span></a>`).join("");
  if (state.route === "cloud") {
    $("#auditFlow").querySelector('a[href="#/cloud"]')?.addEventListener("click", (event) => {
      event.preventDefault();
      document.getElementById("cloudInbox")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

let pendingCloudInbox = false;

function nextActionForState() {
  const files = (cloudState.batches || liveIntakeState.batches || []).flatMap((batch) => (batch.source_files || []).map((file) => ({ ...file, batchCompany: batch.company, business_date: batch.business_date })));
  const unread = files.filter((file) => file.parse_error || file.kind === "unknown");
  const waiting = (liveOverviewState.checklist || []).filter((row) => ["missing_files", "missing_required", "waiting_files", "parse_error"].includes(row.checklist_status));
  const openExceptions = DB.exceptions.filter((row) => !["closed", "approved"].includes(row.status));
  const waitingClarify = openExceptions.filter((row) => ["clarifying", "answered", "damage"].includes(row.status));
  if (unread.length) return { route: "cloud", label: `ตรวจไฟล์ที่มีปัญหา ${num(unread.length)} ไฟล์`, detail: "กดดูรายชื่อไฟล์ปัญหาทั้งหมดและสาเหตุก่อน แล้วค่อยเปิดตรวจทีละรายการ", tone: "bad" };
  if (waiting.length) return { route: "daily-summary", label: `ดูรายการที่ยังขาด ${num(waiting.length)} บริษัท/วัน`, detail: "ตรวจ Checklist แล้วตาม STM หรือ BO ที่ยังไม่ครบ", tone: "warn" };
  if (waitingClarify.length) return { route: "clarify", label: `ตรวจคำชี้แจง ${num(waitingClarify.length)} งาน`, detail: "อนุมัติ ส่งกลับ หรือปิดเคสจากหลักฐาน", tone: "warn" };
  if (openExceptions.length) return { route: "exceptions", label: `ตรวจรายการผิดปกติ ${num(openExceptions.length)} เคส`, detail: "เปิดหลักฐาน ตรวจยอดต่าง และส่งติดตามคำชี้แจง", tone: "warn" };
  return { route: "reports", label: "ดูสรุปและออกรายงาน", detail: "งานที่ต้องดำเนินการหมดแล้ว ตรวจรายวันและ Export หลักฐาน", tone: "ok" };
}

function renderNextAction(root) {
  if (state.dataset !== "production" || !Sb.signedIn()) return;
  const action = nextActionForState();
  const route = ROUTE_ROLES[state.role].includes(action.route) ? action.route : "dashboard";
  const buttonLabel = route === "cloud" ? "ดูไฟล์ปัญหาทั้งหมด →" : "ไปต่อ →";
  root.insertAdjacentHTML("afterbegin", `<section class="next-action-bar ${action.tone}" data-next-route="${h(route)}" role="link" tabindex="0" aria-label="ขั้นถัดไป ${h(action.label)}"><div><span>ขั้นถัดไปที่แนะนำ</span><b>${h(action.label)}</b><small>${h(action.detail)}</small></div><button class="primary-button sm" type="button">${buttonLabel}</button></section>`);
  const bar = root.querySelector("[data-next-route]");
  const follow = () => {
    const nextRoute = bar.dataset.nextRoute;
    if (nextRoute === "cloud") {
      pendingCloudInbox = true;
      if (state.route === "cloud") {
        pendingCloudInbox = false;
        (document.getElementById("problemFileSummary") || document.getElementById("cloudInbox"))?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    go(nextRoute);
  };
  bar.addEventListener("click", follow);
  bar.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); follow(); }
  });
}

function renderRoleSelect() {
  $("#roleSelect").innerHTML = Object.entries(DB.roles)
    .map(([k, v]) => `<option value="${k}" ${state.role === k ? "selected" : ""}>${h(v.name)}</option>`)
    .join("");
}

function renderFilters() {
  const route = ROUTE_MAP[state.route];
  const box = $("#globalFilters");
  if (!route || !route.filters) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  box.hidden = false;
  const f = state.filters;
  const companyLabel = f.company === "ALL" ? "ทุกบริษัท" : f.company;
  const directionLabel = f.direction === "ALL" ? "ทุกประเภท" : f.direction;
  box.innerHTML = `
    <div class="filter-bar-head">
      <div><strong>ตัวกรอง</strong><span>${h(rangeLabel())} · ${h(companyLabel)} · ${h(directionLabel)}</span></div>
      <button class="ghost-button xs" id="filterToggle" type="button" aria-expanded="${state.filtersOpen}">${state.filtersOpen ? "ย่อ" : "ปรับตัวกรอง"}</button>
    </div>
    <div class="filter-fields" ${state.filtersOpen ? "" : "hidden"}>
      <label>วันที่อ้างอิง
        <input type="date" id="fDate" value="${f.date}" />
      </label>
      <label>ช่วงข้อมูล
        <select id="fPreset">
          ${DATE_PRESETS.map((p) => `<option value="${p.code}" ${f.preset === p.code ? "selected" : ""}>${h(p.name)}</option>`).join("")}
        </select>
      </label>
      <label>ตั้งแต่
        <input type="date" id="fFrom" value="${f.from}" max="${f.to}" />
      </label>
      <label>ถึง
        <input type="date" id="fTo" value="${f.to}" min="${f.from}" />
      </label>
      <label>บริษัท
        <select id="fCompany">
          <option value="ALL">ทุกบริษัท</option>
          ${companyMaster().map((c) => `<option value="${c.code}" ${f.company === c.code ? "selected" : ""}>${h(c.name)}</option>`).join("")}
        </select>
      </label>
      <label>ประเภท
        <select id="fDirection">
          <option value="ALL">ทุกประเภท</option>
          <option value="PM" ${f.direction === "PM" ? "selected" : ""}>PM</option>
          <option value="ฝาก" ${f.direction === "ฝาก" ? "selected" : ""}>ฝาก</option>
          <option value="ถอน" ${f.direction === "ถอน" ? "selected" : ""}>ถอน</option>
        </select>
      </label>
    </div>
    <div class="filter-summary" id="filterSummary"></div>`;

  $("#filterToggle").addEventListener("click", () => {
    state.filtersOpen = !state.filtersOpen;
    renderFilters();
  });

  $("#fDate").addEventListener("change", (e) => {
    state.filters.date = e.target.value;
    applyPreset(state.filters.preset);
    toast("เปลี่ยนวันที่ตรวจเป็น " + e.target.value);
    render();
  });
  $("#fPreset").addEventListener("change", (e) => {
    applyPreset(e.target.value);
    state.page = 1;
    render();
  });
  $("#fFrom").addEventListener("change", (e) => {
    state.filters.from = e.target.value;
    if (state.filters.from > state.filters.to) state.filters.to = state.filters.from;
    state.filters.preset = "custom";
    state.page = 1;
    render();
  });
  $("#fTo").addEventListener("change", (e) => {
    state.filters.to = e.target.value;
    if (state.filters.to < state.filters.from) state.filters.from = state.filters.to;
    state.filters.preset = "custom";
    state.page = 1;
    render();
  });
  ["fCompany", "fDirection"].forEach((id) => {
    $("#" + id).addEventListener("change", (e) => {
      state.filters[id === "fCompany" ? "company" : "direction"] = e.target.value;
      state.page = 1;
      render();
    });
  });
  if (state.route === "damage" && state.dataset === "production" && Sb.signedIn()) {
    const ready = liveDamageState?.ready && liveDamageState.key === damageQueryKey();
    const rows = ready ? liveDamageState.rows : [];
    const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    $("#filterSummary").innerHTML = `ช่วงข้อมูล <b>${h(rangeLabel())}</b> · ความเสียหายที่ยืนยันแล้ว <b>${ready ? num(rows.length) : "—"}</b> รายการ · ยอดรวม <b>${ready ? `${money0(total)} บาท` : "กำลังโหลดข้อมูลจริง"}</b>`;
    return;
  }
  const scoped = scopedExceptions();
  $("#filterSummary").innerHTML = `ช่วงข้อมูล <b>${h(rangeLabel())}</b> · กำลังดู <b>${num(scoped.length)}</b> exception · เกิน SLA <b>${num(scoped.filter((e) => e.overSla).length)}</b> รายการ · ความเสียหายในช่วงนี้ <b>${money0(DB.damages.filter((d) => inRange(d.date)).reduce((a, c) => a + c.amount, 0))}</b> บาท`;
}

/* ---------------- router ---------------- */
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "").split("?")[0];
  return ROUTE_MAP[raw] ? raw : (window.APP_CONFIG?.defaultRoute || "cloud");
}
function go(route, opts = {}) {
  if (opts.exFilter) Object.assign(state.exFilter, opts.exFilter);
  if (opts.filters) Object.assign(state.filters, opts.filters);
  location.hash = "#/" + route;
}
window.addEventListener("hashchange", () => {
  const r = parseHash();
  if (!ROUTE_ROLES[state.role].includes(r)) {
    toast(`สิทธิ์ ${DB.roles[state.role].name} เข้าหน้านี้ไม่ได้`, "warn");
    location.hash = "#/cloud";
    return;
  }
  state.route = r;
  state.page = 1;
  closeDrawer();
  render();
  $("#viewRoot").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
});

/* ---------------- main render ---------------- */
const VIEWS = {};
function showLoginGate(message) {
  $("#appShell").hidden = true;
  $("#loginGate").hidden = false;
  $("#loginForm").hidden = false;
  $("#resetForm").hidden = true;
  const out = $("#loginError");
  if (message) {
    out.textContent = message;
    out.hidden = false;
  } else {
    out.hidden = true;
  }
}

function showPasswordResetGate() {
  $("#appShell").hidden = true;
  $("#loginGate").hidden = false;
  $("#loginForm").hidden = true;
  $("#resetForm").hidden = false;
  $("#newPassword").focus();
}

function render() {
  const route = ROUTE_MAP[state.route];
  Charts.reset();
  $("#crumb").textContent = ROUTES.find((g) => g.items.some((i) => i.id === route.id)).group;
  $("#pageTitle").textContent = route.title;
  $("#pageDesc").innerHTML =
    h(route.desc) +
    (Sb.signedIn() ? ' <span class="badge green">ระบบข้อมูลจริง</span>' : "");
  renderNav();
  renderAuditFlow();
  renderFilters();
  $("#viewRoot").innerHTML = "";
  VIEWS[route.id]($("#viewRoot"));
  if (state.dataset === "production" && Sb.signedIn() && !["dashboard", "damage"].includes(route.id)) {
    const liveNotice = liveOverviewState.loading
      ? `<section class="alert live-background-notice"><strong>กำลังอัปเดตข้อมูลล่าสุด</strong><span>หน้านี้ใช้งานได้ตามปกติ ตัวเลขจะอัปเดตอัตโนมัติเมื่อ Supabase ตอบกลับ</span></section>`
      : liveOverviewState.error
        ? `<section class="alert warn live-background-notice"><strong>ข้อมูลล่าสุดยังมาไม่ครบ</strong><span>${h(liveOverviewState.error)}</span><button class="ghost-button sm" id="liveBackgroundRetry">ลองใหม่</button></section>`
        : "";
    if (liveNotice) $("#viewRoot").insertAdjacentHTML("afterbegin", liveNotice);
    $("#liveBackgroundRetry")?.addEventListener("click", () => loadLiveOverview(true));
  }
  renderNextAction($("#viewRoot"));
  addPanelCaptureButtons();
  if (state.route === "cloud" && pendingCloudInbox) requestAnimationFrame(() => {
    pendingCloudInbox = false;
    (document.getElementById("problemFileSummary") || document.getElementById("cloudInbox"))?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#sidebar").classList.remove("open");
}

/* =============================================================
   VIEW: Dashboard
   ============================================================= */
const liveOverviewState = { daily: null, operations: null, quality: null, checklist: null, boFirst: null, settings: null, damages: null, logs: null, notifications: null, clarifications: null, exceptionsReady: false, damagesReady: false, logsReady: false, loading: false, auxiliaryLoading: false, auxiliaryError: null, coreErrors: [], requestId: 0, error: null, key: "", updatedAt: null };
const liveExceptionSearch = { key: "", rows: [], loading: false, error: null };
const exceptionSupportCache = new Map();

async function loadLiveExceptionSearch(term) {
  const key = `${term}|${state.filters.from}|${state.filters.to}|${state.filters.company}`;
  if (!term || liveExceptionSearch.loading || liveExceptionSearch.key === key) return;
  liveExceptionSearch.key = key;
  liveExceptionSearch.loading = true;
  liveExceptionSearch.error = null;
  liveExceptionSearch.rows = [];
  try {
    const rows = await Sb.searchExceptions({ term, from: state.filters.from, to: state.filters.to, company: state.filters.company, limit: 2000 });
    liveExceptionSearch.rows = (rows || []).map(mapLiveException);
  } catch (error) {
    liveExceptionSearch.rows = [];
    liveExceptionSearch.error = error.message || "ค้นหา Supabase ไม่สำเร็จ";
  }
  liveExceptionSearch.loading = false;
  if (state.route === "exceptions") render();
}

const LIVE_KIND_LABEL = {
  stm_pdf: "STM / ฝาก-ถอนธนาคาร",
  bo_main: "รายงาน BO",
  pm_statement: "รายการเดินบัญชี PM",
  manual_credit: "ฝากมือ - เครดิต",
  manual_payment: "ฝากมือ - Payment",
  manual_bonus: "ฝากมือ - โบนัส",
  comm_req: "ถอนค่าคอมมิชชั่น",
  credit_out: "ถอนเครดิต",
  doc_clarify: "เอกสารชี้แจง",
  unknown: "ยังจำแนกไม่ได้",
};

const LIVE_STATUS = {
  completed: { label: "กระทบยอดสำเร็จ", tone: "green" },
  needs_review: { label: "ต้องตรวจสอบ", tone: "red" },
  waiting_files: { label: "รอไฟล์", tone: "amber" },
  ready: { label: "พร้อมกระทบยอด", tone: "blue" },
  queued: { label: "เข้าคิว", tone: "blue" },
  running: { label: "กำลังทำงาน", tone: "violet" },
  error: { label: "ล้มเหลว", tone: "red" },
};

// ตารางคิวรุ่นเก่าเคยสร้างแถวรวมตามชื่อระบบ (PM / SYS123 / XXX)
// แถวเหล่านั้นไม่ใช่บริษัทและต้องไม่ถูกนำไปปนกับสรุป 9 บริษัทจริง
const LIVE_COMPANY_CODES = new Set(["3XB", "AT4", "FR8", "MC8", "MR9", "PS8", "SK8", "UR9", "UFABET7M"]);
const normalizeLiveCompanyCode = (value) => {
  const code = String(value || "").trim().toUpperCase();
  if (code === "3X") return "3XB";
  if (code === "7M") return "UFABET7M";
  return LIVE_COMPANY_CODES.has(code) ? code : "";
};
const businessSystemOfCompany = (value) => {
  const company = normalizeLiveCompanyCode(value);
  if (["3XB", "MR9", "MC8", "UR9", "PS8"].includes(company)) return "XXX";
  if (["FR8", "AT4", "SK8"].includes(company)) return "123";
  if (company === "UFABET7M") return "7M";
  return "ไม่ระบุระบบ";
};
const isLiveCompanyRow = (row) => Boolean(normalizeLiveCompanyCode(row?.company));

const CHECKLIST_STATUS = {
  scheduled: { label: "เตรียมรอวันทำการ", tone: "grey" },
  receiving: { label: "อยู่ในช่วงรับไฟล์", tone: "blue" },
  missing_files: { label: "ยังไม่ได้รับไฟล์", tone: "red" },
  missing_required: { label: "ไฟล์หลักยังไม่ครบ", tone: "red" },
  parse_error: { label: "มีไฟล์อ่านไม่ได้", tone: "red" },
  waiting_parse: { label: "กำลังอ่านไฟล์", tone: "amber" },
  waiting_files: { label: "รอไฟล์", tone: "amber" },
  ready: { label: "พร้อมกระทบยอด", tone: "blue" },
  queued: { label: "เข้าคิว", tone: "blue" },
  running: { label: "กำลังกระทบยอด", tone: "violet" },
  needs_review: { label: "ต้องตรวจสอบ", tone: "red" },
  open_cases: { label: "มีเคสต้องปิด", tone: "amber" },
  completed: { label: "ครบและปิดงาน", tone: "green" },
  error: { label: "ทำงานล้มเหลว", tone: "red" },
};

const checklistMark = (ok, value, optional = false) =>
  `<span class="check-mark ${ok ? "ok" : optional ? "optional" : "missing"}"><b>${ok ? "✓" : optional ? "–" : "!"}</b>${h(value)}</span>`;

const expectedBoCount = (row) => Number(row?.expected_bo_count || (["AT4", "FR8", "SK8"].includes(normalizeLiveCompanyCode(row?.company)) ? 2 : 1));
const registeredStmCount = (row) => Number(row?.registered_stm_accounts || 0);
const registeredPmCount = (row) => Number(row?.registered_pm_files || 0);

function safeExceptionDetail(e) {
  const detail = String(e.detail || "");
  if (!/undefined|NaN(?::NaN)*/i.test(detail)) return detail;
  if ((e.ex_type || e.type) === "cross_day") return "ข้อมูลวันที่หรือเวลาฝั่ง BO ไม่ครบ — ไม่ควรใช้รายการนี้ตัดสินว่าเป็นรายการข้ามวัน กรุณาประมวลผลใหม่ด้วย Worker เวอร์ชันล่าสุด";
  return detail.replace(/undefined/gi, "ไม่พบข้อมูล").replace(/NaN(?::NaN)*/gi, "ไม่พบเวลา");
}

function mapLiveException(e) {
  const severity = e.severity || "medium";
  const slaHours = Number(sevMeta(severity).sla || 48);
  const created = e.created_at ? new Date(e.created_at).getTime() : Date.now();
  const ageHours = Math.max(0, Math.floor((Date.now() - created) / 3600000));
  const status = e.status || "open";
  return {
    id: e.code || e.id,
    dbId: e.id,
    runId: e.run_id,
    date: e.business_date,
    time: String(e.occurred_at || "").slice(0, 8),
    boTime: String(e.bo_time || e.occurred_at || "").slice(0, 8),
    company: e.company || "ไม่ระบุ",
    bank: e.bank || "-",
    account: e.account || "-",
    direction: e.direction || "-",
    member: e.member_code || "-",
    type: e.ex_type || "unknown",
    typeName: e.type_name || e.ex_type || "ยังไม่จำแนก",
    severity,
    status,
    track: e.track,
    dueAt: e.due_at,
    systemAmount: e.system_amount == null ? null : Number(e.system_amount),
    bankAmount: e.bank_amount == null ? null : Number(e.bank_amount),
    amountDiff: Number(e.amount_diff || 0),
    riskAmount: Number(e.risk_amount || 0),
    currency: e.currency || "THB",
    fxRate: e.fx_rate == null ? null : Number(e.fx_rate),
    timeDiffSec: Number(e.time_diff_sec || 0),
    employee: e.employee || "ไม่ระบุ",
    shift: e.shift || "day",
    cause: e.cause || "รอตรวจสอบสาเหตุ",
    detail: safeExceptionDetail(e),
    stmRaw: e.stm_raw || "—",
    boRaw: e.bo_raw || "—",
    ageHours,
    slaHours,
    overSla: ageHours > slaHours && !["closed", "approved"].includes(status),
    notes: [],
    evidence: [],
    hasEvidence: !!e.clarification_file_id,
    clarificationFileId: e.clarification_file_id || null,
    autoClosed: !!e.auto_closed,
    resolutionNote: e.resolution_note || "",
    resolvedAt: e.resolved_at || null,
    resolvedBy: e.resolved_by || null,
    matchConfidence: Number(e.match_confidence || 0),
    assignedTo: e.assigned_to || null,
    requestedBy: e.requested_by || null,
    requestedAt: e.requested_at || null,
    responseText: e.response_text || "",
    respondedBy: e.responded_by || null,
    respondedAt: e.responded_at || null,
    approvedBy: e.approved_by || null,
    approvedAt: e.approved_at || null,
  };
}

function mapLiveDamage(d) {
  return {
    id: d.code || d.id,
    dbId: d.id,
    exceptionId: d.exception_id || "-",
    date: d.business_date,
    company: normalizeLiveCompanyCode(d.company) || d.company || "ไม่ระบุ",
    employee: d.employee || "ไม่ระบุ",
    shift: d.shift || "-",
    amount: Number(d.amount_thb ?? d.amount ?? 0),
    cause: d.cause || "รอตรวจสอบ",
    cycle: d.cycle || "ไม่ระบุรอบ",
    evidence: !!d.has_evidence,
    hrStatus: d.hr_status || "รอดำเนินการ",
    financeStatus: d.finance_status || "รอดำเนินการ",
    createdAt: d.created_at || null,
  };
}

function hydrateLiveData(quality, operations, exceptions, damages, logs) {
  DB.exceptions = (exceptions || []).map(mapLiveException);
  DB.damages = (damages || []).map(mapLiveDamage);
  DB.auditLog = (logs || []).map((l) => ({ at: l.at, user: l.actor || "ระบบ", action: l.action, entity: l.entity, target: l.target, detail: l.detail || "" }));
  const lastRun = (quality || []).find((x) => x.run_id && x.run_at);
  DB.currentRun = lastRun
    ? {
        id: lastRun.run_id,
        businessDate: lastRun.business_date,
        company: lastRun.company,
        stmCount: Number(lastRun.stm_count || 0),
        boCount: Number(lastRun.bo_count || 0),
        matched: Number(lastRun.matched || 0),
        matchRate: Number(lastRun.match_rate || 0),
        exceptionCount: Number(lastRun.exception_count || 0),
        noStmCount: 0,
      }
    : null;
}

async function loadLiveOverview(force = false) {
  const key = `${state.filters.from}|${state.filters.to}|${state.filters.company}`;
  if (liveOverviewState.loading || (!force && liveOverviewState.key === key && liveOverviewState.quality)) return;
  const requestId = ++liveOverviewState.requestId;
  const changedFilter = liveOverviewState.key !== key;
  liveOverviewState.loading = true;
  liveOverviewState.auxiliaryLoading = false;
  liveOverviewState.auxiliaryError = null;
  liveOverviewState.coreErrors = [];
  liveOverviewState.error = null;
  liveOverviewState.key = key;
  if (changedFilter) {
    liveOverviewState.daily = null;
    liveOverviewState.operations = null;
    liveOverviewState.quality = null;
    liveOverviewState.checklist = null;
    liveOverviewState.boFirst = null;
    liveOverviewState.damages = null;
    liveOverviewState.logs = null;
    liveOverviewState.clarifications = null;
    liveOverviewState.exceptionsReady = false;
    liveOverviewState.damagesReady = false;
    liveOverviewState.logsReady = false;
    DB.exceptions = [];
    DB.damages = [];
  }
  if (state.route === "dashboard") render();
  try {
    // Phase 1: ข้อมูลสรุปขนาดเล็กต้องขึ้นหน้าจอก่อน ไม่รอ exception/หลักฐานหลายพันแถว
    const core = await Promise.allSettled([
      Sb.dailyStatus({ from: state.filters.from, to: state.filters.to, company: state.filters.company, limit: 1000 }),
      Sb.operations({ from: state.filters.from, to: state.filters.to, company: state.filters.company, limit: 1000 }),
      Sb.quality({ from: state.filters.from, to: state.filters.to, company: state.filters.company, limit: 1000 }),
      Sb.dailyChecklist({ from: state.filters.from, to: state.filters.to, company: state.filters.company }),
      Sb.boFirstCoverage({ from: state.filters.from, to: state.filters.to, company: state.filters.company }),
      Sb.runtimeSettings(),
    ]);
    if (requestId !== liveOverviewState.requestId) return;
    const coreNames = ["ยอดเมลและไฟล์", "คิวกระทบยอด", "ผลกระทบยอด", "เช็กลิสต์", "ผล BO-first", "การตั้งค่าระบบ"];
    const coreValue = (index, fallback) => core[index].status === "fulfilled" ? (core[index].value ?? fallback) : fallback;
    let daily = coreValue(0, liveOverviewState.daily);
    let operations = coreValue(1, liveOverviewState.operations);
    let quality = coreValue(2, liveOverviewState.quality);
    let checklistRows = coreValue(3, liveOverviewState.checklist);
    let boFirstRows = coreValue(4, liveOverviewState.boFirst);
    const settings = coreValue(5, liveOverviewState.settings ? [liveOverviewState.settings] : null);
    liveOverviewState.coreErrors = core.flatMap((item, index) => item.status === "rejected" ? [coreNames[index]] : []);
    const qualityReady = core[2].status === "fulfilled";
    const defaultEmptyRange = state.filters.date === DEFAULT_WORK_DATE
      && state.filters.from === DEFAULT_RANGE_FROM
      && state.filters.to === DEFAULT_WORK_DATE
      && qualityReady
      && !(quality || []).some((row) => !row.is_archived && row.business_date >= state.filters.from && row.business_date <= state.filters.to);
    if (defaultEmptyRange) {
      const latestLookup = await Promise.allSettled([Sb.quality({ company: state.filters.company, limit: 1 })]);
      const latestQuality = latestLookup[0].status === "fulfilled" ? latestLookup[0].value : [];
      if (latestLookup[0].status === "rejected") liveOverviewState.coreErrors.push("ค้นหาวันล่าสุด");
      const latestOperationalDate = (latestQuality || [])
        .filter((row) => isLiveCompanyRow(row) && !row.is_archived && row.business_date)
        .map((row) => row.business_date)
        .sort()
        .pop();
      if (latestOperationalDate) {
        state.filters = { ...state.filters, date: latestOperationalDate, from: latestOperationalDate, to: latestOperationalDate, preset: "day" };
        state.dailySummary.date = latestOperationalDate;
        const latest = await Promise.allSettled([
          Sb.dailyStatus({ from: latestOperationalDate, to: latestOperationalDate, company: state.filters.company, limit: 1000 }),
          Sb.operations({ from: latestOperationalDate, to: latestOperationalDate, company: state.filters.company, limit: 1000 }),
          Sb.quality({ from: latestOperationalDate, to: latestOperationalDate, company: state.filters.company, limit: 1000 }),
          Sb.dailyChecklist({ from: latestOperationalDate, to: latestOperationalDate, company: state.filters.company }),
          Sb.boFirstCoverage({ from: latestOperationalDate, to: latestOperationalDate, company: state.filters.company }),
        ]);
        daily = latest[0].status === "fulfilled" ? latest[0].value : daily;
        operations = latest[1].status === "fulfilled" ? (latest[1].value || []).filter(isLiveCompanyRow) : operations;
        quality = latest[2].status === "fulfilled" ? (latest[2].value || []).filter(isLiveCompanyRow) : quality;
        checklistRows = latest[3].status === "fulfilled" ? latest[3].value : checklistRows;
        boFirstRows = latest[4].status === "fulfilled" ? latest[4].value : boFirstRows;
        liveOverviewState.coreErrors.push(...latest.flatMap((item, index) => item.status === "rejected" ? [coreNames[index]] : []));
        liveOverviewState.key = `${state.filters.from}|${state.filters.to}|${state.filters.company}`;
      }
    }
    if (requestId !== liveOverviewState.requestId) return;
    if (daily !== null) liveOverviewState.daily = daily || [];
    if (operations !== null) liveOverviewState.operations = (operations || []).filter(isLiveCompanyRow);
    if (quality !== null) liveOverviewState.quality = (quality || []).filter(isLiveCompanyRow);
    if (checklistRows !== null) liveOverviewState.checklist = checklistRows || [];
    if (boFirstRows !== null) liveOverviewState.boFirst = boFirstRows || [];
    if (settings !== null) liveOverviewState.settings = Array.isArray(settings) ? (settings[0] || null) : settings;
    liveOverviewState.error = liveOverviewState.coreErrors.length
      ? `ข้อมูลบางส่วนยังไม่พร้อม: ${[...new Set(liveOverviewState.coreErrors)].join(", ")} — ตัวเลขส่วนนี้จะแสดง “—” แทนศูนย์`
      : null;
    liveOverviewState.updatedAt = new Date();
    liveOverviewState.loading = false;
    liveOverviewState.auxiliaryLoading = true;
    hydrateLiveData(liveOverviewState.quality || [], liveOverviewState.operations || [], [], [], []);
    render();

    // Phase 2: เติมรายละเอียดหนักด้านหลัง โดยไม่บล็อกแดชบอร์ดหลัก
    const aux = await Promise.allSettled([
      // โหลดเฉพาะชุดแรกให้หน้าขึ้นไว; ค้นหา/Export ค่อยดึงเพิ่มเติมเมื่อผู้ใช้ร้องขอ
      Sb.currentExceptionsSummary({ from: state.filters.from, to: state.filters.to, company: state.filters.company, limit: 250 }),
      Sb.damages({ from: state.filters.from, to: state.filters.to, company: state.filters.company, limit: 2000 }),
      Sb.auditLogs({ from: state.filters.from, to: state.filters.to, limit: 500 }),
      Sb.notifications(200),
      Sb.clarificationMatches({ from: state.filters.from, to: state.filters.to, company: state.filters.company, limit: 1000 }),
    ]);
    if (requestId !== liveOverviewState.requestId) return;
    const value = (index, fallback = []) => aux[index].status === "fulfilled" ? (aux[index].value || fallback) : fallback;
    const exceptionRows = value(0, DB.exceptions || []);
    const damageRows = value(1, liveOverviewState.damages || []);
    const logRows = value(2, liveOverviewState.logs || []);
    liveOverviewState.exceptionsReady = aux[0].status === "fulfilled";
    liveOverviewState.damagesReady = aux[1].status === "fulfilled";
    liveOverviewState.logsReady = aux[2].status === "fulfilled";
    if (aux[1].status === "fulfilled") liveOverviewState.damages = damageRows;
    if (aux[2].status === "fulfilled") liveOverviewState.logs = logRows;
    if (aux[3].status === "fulfilled") liveOverviewState.notifications = value(3);
    if (aux[4].status === "fulfilled") liveOverviewState.clarifications = value(4);
    liveOverviewState.auxiliaryError = aux.some((item) => item.status === "rejected") ? "รายละเอียดบางส่วนโหลดไม่สำเร็จ — กดรีเฟรชเพื่อโหลดใหม่" : null;
    liveOverviewState.auxiliaryLoading = false;
    liveOverviewState.updatedAt = new Date();
    hydrateLiveData(liveOverviewState.quality || [], liveOverviewState.operations || [], exceptionRows, damageRows, logRows);
    updateBell();
  } catch (e) {
    if (requestId === liveOverviewState.requestId) liveOverviewState.error = e.message || "โหลดข้อมูลจริงไม่สำเร็จ";
  }
  if (requestId === liveOverviewState.requestId) {
    liveOverviewState.loading = false;
    liveOverviewState.auxiliaryLoading = false;
    render();
  }
}

function ensureLiveOverview(root) {
  if (state.dataset !== "production" || !Sb.signedIn()) return true;
  const key = `${state.filters.from}|${state.filters.to}|${state.filters.company}`;
  const stale = liveOverviewState.key !== key;
  if ((!liveOverviewState.quality || stale) && !liveOverviewState.loading) loadLiveOverview(stale);
  // อย่าปิดทั้งหน้าระหว่างรอข้อมูลกลาง แต่ละหน้าจะแสดงข้อมูลที่มีอยู่ก่อน
  // และ render() จะเติมแถบแจ้งสถานะด้านบนจนกว่าการอัปเดตจะเสร็จ
  return true;
}

function renderLiveDashboard(root) {
  if (!liveOverviewState.quality && !liveOverviewState.loading) loadLiveOverview();

  const inLiveRange = (x) => (!state.filters.from || x.business_date >= state.filters.from) && (!state.filters.to || x.business_date <= state.filters.to) && (state.filters.company === "ALL" || x.company === state.filters.company);
  const daily = (liveOverviewState.daily || []).filter(inLiveRange);
  const operations = (liveOverviewState.operations || []).filter(inLiveRange);
  const quality = (liveOverviewState.quality || []).filter(inLiveRange);
  const exceptions = scopedExceptions();
  const totalMail = daily.reduce((sum, x) => sum + Number(x.mail_count || 0), 0);
  const totalFiles = daily.reduce((sum, x) => sum + Number(x.file_count || 0), 0);
  const parsedFiles = daily.reduce((sum, x) => sum + Number(x.parsed_count || 0), 0);
  const completed = quality.filter((x) => x.status === "completed").length;
  const needsReview = quality.filter((x) => x.status === "needs_review").length;
  const waiting = quality.filter((x) => x.status === "waiting_files").length;
  const failed = quality.filter((x) => x.status === "error" || Number(x.error_count || 0) > 0).length;
  const exceptionTotal = quality.reduce((sum, x) => sum + Number(x.exception_count || 0), 0);
  const risk = exceptions.reduce((sum, x) => sum + Number(x.riskAmount || 0), 0);
  const dailyAvailable = Array.isArray(liveOverviewState.daily) && !liveOverviewState.coreErrors.includes("ยอดเมลและไฟล์");
  const qualityAvailable = Array.isArray(liveOverviewState.quality) && !liveOverviewState.coreErrors.includes("ผลกระทบยอด");
  const showMetric = (available, value) => available ? num(value) : "—";

  const opByKey = new Map(operations.map((x) => [`${x.business_date}|${x.company}|${x.business_system || ""}`, x]));
  const companyMap = new Map();
  quality.forEach((row) => {
    const key = `${row.company}|${row.business_system || "ไม่ระบุระบบ"}`;
    if (!companyMap.has(key)) companyMap.set(key, { company: row.company, system: row.business_system || "ไม่ระบุระบบ", completed: 0, review: 0, waiting: 0, error: 0, files: 0, latest: row.business_date, kinds: new Set() });
    const item = companyMap.get(key);
    item.files += Number(row.file_count || 0);
    item.latest = item.latest > row.business_date ? item.latest : row.business_date;
    if (row.status === "completed") item.completed++;
    else if (row.status === "waiting_files") item.waiting++;
    else if (row.status === "error") item.error++;
    else item.review++;
    const op = opByKey.get(`${row.business_date}|${row.company}|${row.business_system || ""}`);
    (op?.present_kinds || []).forEach((kind) => item.kinds.add(kind));
  });
  const companies = [...companyMap.values()].sort((a, b) => b.latest.localeCompare(a.latest) || b.review + b.waiting - (a.review + a.waiting));

  const behaviorGroups = [
    { label: "STM / ฝาก-ถอนธนาคาร", kinds: ["stm_pdf"], tone: "blue" },
    { label: "รายงาน BO", kinds: ["bo_main"], tone: "green" },
    { label: "PM / Payment", kinds: ["pm_statement"], tone: "violet" },
    { label: "Manual / รายการพิเศษ", kinds: ["manual_credit", "manual_payment", "manual_bonus", "comm_req", "credit_out"], tone: "amber" },
    { label: "ชี้แจง / ยังจำแนกไม่ได้", kinds: ["doc_clarify", "unknown"], tone: "red" },
  ].map((group) => ({ ...group, value: operations.filter((op) => (op.present_kinds || []).some((kind) => group.kinds.includes(kind))).length }));

  const typeSummary = Object.entries(exceptions.reduce((acc, e) => ((acc[e.typeName] = (acc[e.typeName] || 0) + 1), acc), {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const recent = [...quality].sort((a, b) => String(b.business_date).localeCompare(String(a.business_date)) || String(a.company).localeCompare(String(b.company), "th")).slice(0, 80);
  const missingText = (row) => {
    const groups = Array.isArray(row.missing_groups) ? row.missing_groups.flat(2) : [];
    return groups.length ? [...new Set(groups)].map((kind) => LIVE_KIND_LABEL[kind] || kind).join(", ") : "ครบ";
  };
  const activeStart = liveOverviewState.settings?.operational_start_date || OPERATING_START_DATE;
  const historyCutoff = liveOverviewState.settings?.history_cutoff_date || "2026-08-26";
  const checklistDates = [...new Set((liveOverviewState.checklist || []).map((row) => row.business_date))].sort().reverse();
  const checklistDate = checklistDates.includes(state.filters.date) ? state.filters.date : (checklistDates[0] || state.filters.date);
  const checklist = (liveOverviewState.checklist || []).filter((row) => row.business_date === checklistDate);
  const boFirstByCompanyDate = new Map();
  (liveOverviewState.boFirst || []).forEach((row) => {
    const key = `${row.business_date}|${String(row.company || "").toUpperCase()}`;
    if (!boFirstByCompanyDate.has(key)) boFirstByCompanyDate.set(key, row);
  });
  const loadNotice = liveOverviewState.loading
    ? `<section class="alert"><strong>กำลังอัปเดตข้อมูลล่าสุด</strong><span>เปิดดูเมนูและรายงานได้ทันที ระบบจะเติมตัวเลขบนหน้านี้เมื่อข้อมูลมาถึง</span></section>`
    : liveOverviewState.error
      ? `<section class="alert warn"><strong>ข้อมูลจริงมาไม่ครบทุกส่วน</strong><span>${h(liveOverviewState.error)}</span><button class="ghost-button sm" id="liveRetry">ลองใหม่</button></section>`
      : !daily.length && !operations.length && !quality.length
        ? `<section class="alert warn"><strong>ไม่พบข้อมูลในช่วง ${h(rangeLabel())}</strong><span>ข้อมูลอาจอยู่ก่อนช่วงวันที่ที่เลือก ลองขยายช่วงย้อนหลัง หรือเปิดคลังไฟล์เพื่อตรวจวันที่จากเมลจริง</span><button class="ghost-button sm" id="expandDateRange">ขยายย้อนหลัง 90 วัน</button><button class="ghost-button sm" data-goto="cloud">เปิดคลังไฟล์</button></section>`
        : "";

  root.innerHTML = `
    ${loadNotice}
    <section class="status-strip live-status-strip action-tiles">
      <article class="ok" data-action-route="cloud"><span>เมลในช่วงที่เลือก</span><strong>${showMetric(dailyAvailable, totalMail)}</strong><small>${dailyAvailable ? `${num(totalFiles)} ไฟล์ · อ่านแล้ว ${num(parsedFiles)}` : "ข้อมูลเมลยังไม่พร้อม"} · กดดูไฟล์</small></article>
      <article class="ok" data-action-route="daily-summary"><span>กระทบยอดสำเร็จ</span><strong>${showMetric(qualityAvailable, completed)}</strong><small>แยกตามวัน / บริษัท / ระบบ · กดดูสรุป</small></article>
      <article class="warn" data-action-route="daily-summary"><span>ต้องตรวจสอบ</span><strong>${showMetric(qualityAvailable, needsReview)}</strong><small>${qualityAvailable ? "ข้อมูลมาแล้วแต่ยังไม่ครบ" : "ผลกระทบยอดยังไม่พร้อม"} · กดดูสิ่งที่ขาด</small></article>
      <article class="bad" data-action-route="cloud"><span>รอไฟล์ / ล้มเหลว</span><strong>${showMetric(qualityAvailable, waiting + failed)}</strong><small>${qualityAvailable ? `รอ ${num(waiting)} · ล้มเหลว ${num(failed)}` : "ผลกระทบยอดยังไม่พร้อม"} · กดแก้ไฟล์</small></article>
      <article class="bad" data-action-route="exceptions"><span>Exception จริง</span><strong>${showMetric(qualityAvailable, exceptionTotal)}</strong><small>${!qualityAvailable ? "ผลกระทบยอดยังไม่พร้อม" : liveOverviewState.auxiliaryLoading ? "ข้อมูลหลักพร้อมแล้ว · กำลังเติมยอดเสี่ยง" : `ยอดเสี่ยง ${money0(risk)} บาท`} · กดตรวจเคส</small></article>
    </section>

    <section class="action-overview">
      <div><p class="eyebrow">สรุปที่ต้องทำ</p><h2>${!qualityAvailable ? "กำลังรอผลกระทบยอดจริง" : needsReview + waiting + failed ? `มี ${num(needsReview + waiting + failed)} งานที่ต้องตาม` : "งานในช่วงนี้เรียบร้อย"}</h2><p>${!qualityAvailable ? "ระบบไม่สรุปเป็นศูนย์จนกว่าจะอ่านผลจริงสำเร็จ" : `${waiting ? `รอไฟล์ ${num(waiting)} งาน · ` : ""}${needsReview ? `ต้องตรวจ ${num(needsReview)} งาน · ` : ""}${failed ? `ล้มเหลว ${num(failed)} งาน` : "ไม่พบงานล้มเหลว"}`}${liveOverviewState.auxiliaryLoading ? " · รายละเอียดกำลังโหลดเบื้องหลัง" : ""}${liveOverviewState.auxiliaryError ? ` · ${h(liveOverviewState.auxiliaryError)}` : ""}</p></div>
      <div class="inline-actions"><button class="primary-button" data-goto="daily-summary">สรุป 1 บริษัท/วัน</button><button class="ghost-button" data-goto="cloud">ดูเมลและไฟล์</button><button class="ghost-button" data-goto="exceptions">ดู Exception</button><button class="ghost-button" id="liveRefresh">รีเฟรชข้อมูล</button></div>
    </section>

    <section class="period-banner">
      <div><p class="eyebrow">รอบปฏิบัติงานปัจจุบัน</p><h2>เริ่มตรวจใหม่ตั้งแต่ ${h(activeStart)}</h2><p>ข้อมูลถึง ${h(historyCutoff)} ถูกเก็บไว้เป็นประวัติ ไม่ถูกลบ และไม่ปนกับคิวงานรอบใหม่</p></div>
      <button class="ghost-button" id="openHistory">ดูประวัติ 1–23 ส.ค.</button>
    </section>

    <section class="panel operating-timeline">
      <div class="panel-heading"><div><p class="eyebrow">รอบงานประจำวัน</p><h2>${h(checklist[0]?.workflow_phase_label || "ติดตามตามเวลาปฏิบัติงาน")}</h2><small class="head-sub">ระบบจะยังไม่แจ้งว่าขาดไฟล์ก่อนสิ้นสุดช่วงรับไฟล์ 08:00 น.</small></div><span class="badge blue">เวลาไทย</span></div>
      <div class="operating-timeline-grid">
        <article><b>05:00–08:00</b><span>รับไฟล์ตรวจจากแอดมิน</span></article>
        <article><b>08:00–17:00</b><span>อ่านไฟล์และกระทบยอด</span></article>
        <article><b>17:00</b><span>ส่งเคสให้แอดมินชี้แจง</span></article>
        <article><b>17:00–19:00</b><span>อัปโหลดไฟล์ที่ออดิทเสร็จ</span></article>
        <article><b>หลัง 19:00</b><span>ติดตามทีมออดิทหากยังไม่อัปโหลด</span></article>
      </div>
    </section>

    <section class="panel daily-checklist-panel">
      <div class="panel-heading"><div><p class="eyebrow">Checklist รายบริษัท</p><h2>วันที่ ${h(checklistDate)} · ครบทั้ง 9 บริษัท</h2><small class="head-sub">ระบบอ่าน BO ก่อนเพื่อรู้บัญชี/Provider ที่ใช้จริง แล้วจึงตรวจ STM/PM ที่ต้องส่ง โดย Google Sheet ใช้ยืนยันชื่อมาตรฐานเท่านั้น</small></div><span class="health ${checklist.some((row) => !["completed", "scheduled", "receiving"].includes(row.checklist_status)) ? "attention" : "ok"}">${num(checklist.filter((row) => row.checklist_status === "completed").length)}/${num(checklist.length || 9)} บริษัทปิดงาน</span></div>
      <div class="table-wrap"><table class="checklist-table"><thead><tr><th>บริษัท / ระบบ</th><th>เมล / ไฟล์</th><th>STM ตาม BO</th><th>BO ที่รับ / ต้องมี</th><th>PM ตาม BO</th><th>บัญชี/Provider ที่ BO ระบุ</th><th>อ่านไฟล์</th><th>กระทบยอด / เคส</th><th>สถานะ</th></tr></thead><tbody>
        ${checklist.map((row) => {
          const status = CHECKLIST_STATUS[row.checklist_status] || LIVE_STATUS[row.job_status] || { label: row.checklist_status, tone: "grey" };
          const future = row.checklist_status === "scheduled";
          const reconFileCount = Number(row.recon_file_count ?? row.file_count ?? 0);
          const parsedOk = reconFileCount > 0 && Number(row.parsed_count) === reconFileCount && !Number(row.error_count);
          const boExpected = expectedBoCount(row);
          const boOk = Number(row.bo_count) >= boExpected;
          const pmReceived = Number(row.pm_deposit_count || 0) + Number(row.pm_withdraw_count || 0);
          const coverage = boFirstByCompanyDate.get(`${row.business_date}|${String(row.company || "").toUpperCase()}`);
          const requiredCoverage = Array.isArray(coverage?.required) ? coverage.required : [];
          const missingCoverage = Array.isArray(coverage?.missing) ? coverage.missing : [];
          const coverageCount = (kind) => {
            const required = requiredCoverage.filter((item) => item.kind === kind);
            const missing = missingCoverage.filter((item) => item.kind === kind);
            return { required, missing, received: Math.max(0, required.length - missing.length) };
          };
          const stmCoverage = coverageCount("STM");
          const pmCoverage = coverageCount("PM");
          const boIdentities = requiredCoverage.map((item) => `${item.label || item.identity}${item.direction && item.direction !== "unknown" ? ` ${item.direction === "deposit" ? "ฝาก" : "ถอน"}` : ""}`);
          const providers = coverage ? (boIdentities.join(", ") || "BO ไม่พบรายการใช้งาน") : "รออ่าน BO";
          const inactiveProviders = Array.isArray(row.inactive_pm_providers) ? row.inactive_pm_providers.join(", ") : "";
          const pendingProviders = Array.isArray(row.pending_registry_pm_providers) ? row.pending_registry_pm_providers.join(", ") : "";
          const providerNotes = `${!coverage && inactiveProviders ? `<small class="sub">ทะเบียนยังไม่พบใช้: ${h(inactiveProviders)}</small>` : ""}${pendingProviders ? `<small class="sub registry-note">ชื่อรอยืนยันในชีต: ${h(pendingProviders)}</small>` : ""}`;
          const boFirstMissing = missingCoverage.map((item) => `ขาด ${item.kind} ${item.label || item.identity}${item.direction && item.direction !== "unknown" ? ` ${item.direction === "deposit" ? "ฝาก" : "ถอน"}` : ""}`);
          const pending = () => checklistMark(false, "รอวันทำการ", true);
          return `<tr class="checklist-row" data-check-date="${h(row.business_date)}" data-check-company="${h(row.company)}"><td><b>${h(row.display_name || row.company)}</b><small class="sub">ระบบ ${h(row.business_system || "-")} · ${future ? "รอเริ่มวันทำการ" : `รับล่าสุด ${h(row.last_mail_at ? String(row.last_mail_at).replace("T", " ").slice(0, 16) : "-")}`}</small></td><td>${future ? pending() : checklistMark(Number(row.file_count)>0, `${num(row.mail_count)} เมล · ${num(row.file_count)} ไฟล์`)}</td><td>${future ? pending() : coverage ? checklistMark(stmCoverage.missing.length === 0, `${num(stmCoverage.received)}/${num(stmCoverage.required.length)} กลุ่ม`) : checklistMark(false, "รออ่าน BO", true)}</td><td>${future ? pending() : checklistMark(boOk, `${num(row.bo_count)}/${num(boExpected)} ไฟล์`)}</td><td>${future ? pending() : coverage ? checklistMark(pmCoverage.missing.length === 0, `${num(pmCoverage.received)}/${num(pmCoverage.required.length)} กลุ่ม`) : checklistMark(false, "รออ่าน BO", true)}</td><td><small>${h(providers)}</small>${providerNotes}</td><td>${future ? pending() : checklistMark(parsedOk, Number(row.error_count) ? `อ่านไม่ได้ ${num(row.error_count)}` : `${num(row.parsed_count)}/${num(reconFileCount)}`)}</td><td>${future ? pending() : checklistMark(row.job_status==="completed" && Number(row.open_count)===0, row.job_status==="completed" ? `จับคู่ ${num(row.matched_count)} · ค้าง ${num(row.open_count)}` : (LIVE_STATUS[row.job_status]?.label || "ยังไม่รัน"))}</td><td><span class="badge ${status.tone}">${h(status.label)}</span>${!future && boFirstMissing.length ? `<small class="sub danger">${h(boFirstMissing.join(" · "))}</small>` : !future && Array.isArray(row.missing_items) && row.missing_items.length ? `<small class="sub danger">${h(row.missing_items.join(" · "))}</small>` : ""}${row.registry_warning ? `<small class="sub registry-note">ทะเบียน: ${h(row.registry_warning)}</small>` : ""}</td></tr>`;
        }).join("") || `<tr><td colspan="9" class="empty">กำลังเตรียมเช็กลิสต์รอบใหม่</td></tr>`}
      </tbody></table></div>
      <p class="hint">กดแถวบริษัทเพื่อเปิดสรุป 1 บริษัท 1 วัน · ระบบอ่านบัญชีที่ใช้จริงจาก BO/รายงานฝาก-ถอน แล้วตรวจหา STM/PM คู่กัน ส่วน BO ตรวจตามกฎ 1 หรือ 2 ไฟล์อัตโนมัติ</p>
    </section>

    <section class="grid-2 live-main-grid">
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">บริษัทและระบบ</p><h2>แยกงานตามบริษัท</h2></div><span class="health ${needsReview + waiting ? "attention" : "ok"}">${num(companies.length)} กลุ่ม</span></div>
        <div class="company-overview-grid">
          ${companies.map((c) => `<article class="company-overview-card action-card" data-summary-company="${h(c.company)}" data-summary-date="${h(c.latest)}" role="link" tabindex="0">
            <div class="company-card-head"><div><strong>${h(c.company)}</strong><span>${h(c.system)}</span></div><small>ล่าสุด ${h(c.latest)}</small></div>
            <div class="company-metrics"><span class="ok">สำเร็จ <b>${num(c.completed)}</b></span><span class="warn">ตรวจ <b>${num(c.review)}</b></span><span class="bad">รอ/พลาด <b>${num(c.waiting + c.error)}</b></span><span>ไฟล์ <b>${num(c.files)}</b></span></div>
            <div class="kind-chips">${[...c.kinds].slice(0, 6).map((kind) => `<i>${h(LIVE_KIND_LABEL[kind] || kind)}</i>`).join("") || "<i>ยังไม่พบชนิดไฟล์</i>"}</div>
          </article>`).join("") || `<p class="empty-box">ไม่มีข้อมูลบริษัทในช่วงที่เลือก</p>`}
        </div>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">ลักษณะงานจากเมล</p><h2>เมลที่ได้รับเป็นงานประเภทใด</h2></div></div>
        <div class="behavior-list">${behaviorGroups.map((x) => `<div><span class="badge ${x.tone}">${h(x.label)}</span><b>${num(x.value)}</b><small>ชุดงาน</small></div>`).join("")}</div>
        <p class="hint">“ฝาก-ถอนธนาคาร” จัดเป็น STM ตามกติกาของทีม ส่วนพฤติกรรมรายการฝาก/ถอนรายบุคคลจะแสดงหลังระบบอ่านข้อมูลในไฟล์และสร้าง Exception แล้ว</p>
        <div class="exception-summary">
          <h3>สาเหตุ Exception ที่พบมาก</h3>
          ${typeSummary.map(([label, value]) => `<div><span>${h(label)}</span><b>${num(value)}</b></div>`).join("") || `<p class="empty">ยังไม่มี Exception ในช่วงที่เลือก</p>`}
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-heading"><div><p class="eyebrow">รายการล่าสุด</p><h2>สถานะรายวันแยกบริษัท</h2><small class="head-sub">อัปเดต ${liveOverviewState.updatedAt ? liveOverviewState.updatedAt.toLocaleString("th-TH") : "-"}</small></div><span class="health ok">ข้อมูลจริง Supabase</span></div>
      <div class="table-wrap"><table class="live-table">
        <thead><tr><th>วันที่</th><th>บริษัท / ระบบ</th><th>สถานะ</th><th class="right">ไฟล์</th><th>ไฟล์ที่ยังขาด</th><th>ผลกระทบยอด</th></tr></thead>
        <tbody>${recent.map((row) => {
          const status = LIVE_STATUS[row.status] || { label: row.status || "ไม่ทราบ", tone: "grey" };
          return `<tr class="action-row" data-summary-company="${h(row.company)}" data-summary-date="${h(row.business_date)}" role="link" tabindex="0"><td><b>${h(row.business_date)}</b></td><td><b>${h(row.company)}</b><small class="sub">${h(row.business_system || "ไม่ระบุระบบ")}</small></td><td><span class="badge ${status.tone}">${h(status.label)}</span></td><td class="right tnum">${num(row.file_count)}</td><td class="${missingText(row) === "ครบ" ? "muted" : "danger"}">${h(missingText(row))}</td><td>${row.match_rate == null ? "-" : `${Number(row.match_rate).toFixed(2)}% · ${num(row.exception_count)} exception`}</td></tr>`;
        }).join("") || `<tr><td colspan="6" class="empty">ไม่มีข้อมูลในช่วงที่เลือก</td></tr>`}</tbody>
      </table></div>
    </section>`;

  root.querySelectorAll("[data-goto]").forEach((button) => button.addEventListener("click", () => go(button.dataset.goto)));
  $("#expandDateRange")?.addEventListener("click", () => {
    state.filters.from = shiftDays(state.filters.to || DEFAULT_WORK_DATE, -90);
    state.filters.preset = "custom";
    liveOverviewState.key = "";
    render();
  });
  root.querySelectorAll("[data-action-route]").forEach((item) => item.addEventListener("click", () => go(item.dataset.actionRoute)));
  root.querySelectorAll("[data-summary-company]").forEach((item) => {
    const open = () => {
      state.dailySummary.date = item.dataset.summaryDate;
      state.dailySummary.company = item.dataset.summaryCompany;
      go("daily-summary");
    };
    item.addEventListener("click", open);
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
    });
  });
  root.querySelectorAll("[data-check-company]").forEach((row) => row.addEventListener("click", () => {
    state.dailySummary.date = row.dataset.checkDate;
    state.dailySummary.company = row.dataset.checkCompany;
    go("daily-summary");
  }));
  $("#openHistory")?.addEventListener("click", () => {
    state.filters = { ...state.filters, date: "2026-08-23", from: "2026-08-01", to: "2026-08-23", preset: "custom" };
    liveOverviewState.key = "";
    go("cloud");
  });
  $("#liveRefresh")?.addEventListener("click", () => loadLiveOverview(true));
  $("#liveRetry")?.addEventListener("click", () => loadLiveOverview(true));
}

VIEWS.dashboard = (root) => {
  if (state.dataset === "production" && Sb.signedIn()) {
    renderLiveDashboard(root);
    return;
  }
  const ex = scopedExceptions();
  const run = DB.currentRun;
  const totalTx = run ? run.stmCount + (run.noStmCount || 0) : DB.hourly.reduce((a, c) => a + c.total, 0);
  const totalEx = DB.hourly.reduce((a, c) => a + c.exception, 0);
  const matched = run ? run.matched : totalTx - totalEx;
  const matchBase = run ? run.stmCount || 1 : totalTx || 1;
  const filesOk = DB.files.filter((f) => f.status === "received").length;
  const filesBad = DB.files.length - filesOk;
  const damageSum = DB.damages.reduce((a, c) => a + c.amount, 0);
  const overSla = ex.filter((e) => e.overSla).length;

  const tiles = [
    {
      label: "Transactions วันนี้",
      value: num(totalTx),
      sub: run ? `ฝั่งธนาคาร ${num(run.stmCount)} · ฝั่ง BO ${num(run.boCount)}` : "นำเข้าแล้ว 98.7% ของไฟล์ที่รับ",
      spark: DB.hourly.map((x) => x.total),
      color: Charts.PALETTE.s1,
    },
    {
      label: "Matched (3-point)",
      value: num(matched),
      sub: `อัตราจับคู่ ${((matched / matchBase) * 100).toFixed(2)}%${run && run.noStmCount ? ` · รอไฟล์ธนาคารอีก ${num(run.noStmCount)}` : ""}`,
      spark: DB.hourly.map((x) => x.matched),
      color: Charts.PALETTE.s3,
    },
    { label: "Diff / Missing", value: num(totalEx), sub: `เปิดค้าง ${num(ex.filter((e) => !["closed", "approved"].includes(e.status)).length)} เคสในคิว`, spark: DB.hourly.map((x) => x.exception), color: Charts.PALETTE.s2, tone: "warn" },
    { label: "เกิน SLA", value: num(overSla), sub: "ต้องเร่งติดตามชี้แจงวันนี้", spark: DB.hourly.map((x) => Math.round(x.exception * 0.3)), color: "#d03b3b", tone: overSla ? "bad" : "" },
    { label: "ไฟล์ที่ตรวจแล้ว", value: `${filesOk}/${DB.files.length}`, sub: filesBad ? `ยังมีปัญหา ${filesBad} ไฟล์` : "ครบทุกไฟล์", color: Charts.PALETTE.s4, tone: filesBad ? "warn" : "" },
  ];

  const byType = DB.exceptionTypes
    .map((t) => ({ label: t.name, value: ex.filter((e) => e.type === t.code).length, code: t.code }))
    .filter((x) => x.value)
    .sort((a, b) => b.value - a.value);
  const bySeverity = DB.severities.map((s) => ({ label: s.name, value: ex.filter((e) => e.severity === s.code).length, color: severityColor(s.code), code: s.code }));
  const byShift = DB.shifts.map((s) => ({ label: `${s.name}\n${s.range}`, value: ex.filter((e) => e.shift === s.code).length, hint: "คลิกกราฟเพื่อดูตัวเลขเทียบกัน" }));
  const byAccount = Object.entries(
    ex.reduce((acc, e) => {
      acc[e.account] = (acc[e.account] || 0) + 1;
      return acc;
    }, {}),
  )
    .map(([k, v]) => ({ label: k, value: v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  root.innerHTML = `
    <section class="status-strip">
      ${tiles
        .map(
          (t) => `<article class="${t.tone || ""}">
        <span>${h(t.label)}</span>
        <strong>${t.value}</strong>
        <div class="tile-foot"><small>${h(t.sub)}</small>${t.spark ? Charts.spark(t.spark, t.color) : ""}</div>
      </article>`,
        )
        .join("")}
    </section>

    <section class="pipeline" aria-label="ขั้นตอนการทำงาน">
      ${["รับไฟล์จาก Email", "ตรวจความครบถ้วน", "Normalize STM / BO", "3-Point Match", "ส่งชี้แจง / อนุมัติ", "สรุปความเสียหาย"]
        .map((s, i) => `<div class="${i < 4 ? "done" : i === 4 ? "active" : ""}"><strong>${i + 1}</strong><span>${h(s)}</span></div>`)
        .join("")}
    </section>

    <section class="grid-2">
      <div class="panel">
        <div class="panel-heading">
          <div><p class="eyebrow">Volume vs Exception</p><h2>รายการต่อชั่วโมง</h2></div>
          <span class="health ok">อัปเดตล่าสุด 1 ชม.ที่แล้ว</span>
        </div>
        <p class="small-mult-title" style="--dot:${Charts.PALETTE.s1}">ปริมาณรายการทั้งหมด</p>
        <div class="chart" id="chHourly"></div>
        <p class="small-mult-title" style="--dot:${Charts.PALETTE.s2}">รายการที่ไม่ match (คนละสเกล)</p>
        <div class="chart" id="chHourlyEx"></div>
        <p class="chart-note">แยกเป็นสองกราฟที่ใช้แกน y ของตัวเอง เพราะสองค่านี้ต่างสเกลกันมาก การใส่แกนคู่ในกราฟเดียวจะอ่านผิดได้ · ช่วง 22:00-06:00 มีสัดส่วน exception สูงกว่าช่วงอื่น</p>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Severity</p><h2>ระดับความรุนแรง</h2></div></div>
        <div class="chart" id="chSeverity"></div>
        <div class="sev-list">
          ${bySeverity
            .map(
              (s) => `<button class="sev-row" data-sev="${s.code}">
              <i style="background:${s.color}"></i>
              <span>${h(s.label)}</span>
              <small>${h(sevMeta(s.code).desc)}</small>
              <b>${num(s.value)}</b></button>`,
            )
            .join("")}
        </div>
        <p class="chart-note">คลิกที่ระดับใดระดับหนึ่งเพื่อกรอง Exception Queue ตามระดับนั้นทันที · ระดับความรุนแรงกำหนดจากประเภท exception และยอด diff โดยระบบจะยกระดับอัตโนมัติเมื่อยอดเกิน 10,000 บาท</p>
        <div class="sla-mini">
          <div><span>SLA Critical</span><b>4 ชม.</b></div>
          <div><span>High</span><b>8 ชม.</b></div>
          <div><span>Medium</span><b>48 ชม.</b></div>
          <div><span>Low</span><b>72 ชม.</b></div>
        </div>
      </div>
    </section>

    <section class="grid-3">
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Exception Type</p><h2>แยกตามประเภท</h2></div></div>
        <div class="chart" id="chType"></div>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Shift</p><h2>เทียบตามกะ</h2></div></div>
        <div class="chart" id="chShift"></div>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Account Risk</p><h2>บัญชีที่เกิด diff บ่อย</h2></div></div>
        <div class="chart" id="chAccount"></div>
      </div>
    </section>

    <section class="grid-2">
      <div class="panel">
        <div class="panel-heading">
          <div><p class="eyebrow">SLA Watch</p><h2>เคสที่เลยกำหนดชี้แจง</h2></div>
          <button class="ghost-button sm" data-goto="exceptions" data-sla="1">ดูทั้งหมด</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>เคส / ผู้เกี่ยวข้อง</th><th>ประเภท</th><th>ระดับ</th><th>อายุเคส</th></tr></thead>
            <tbody>
              ${ex
                .filter((e) => e.overSla)
                .sort((a, b) => b.ageHours / b.slaHours - a.ageHours / a.slaHours)
                .slice(0, 6)
                .map(
                  (e) => `<tr class="clickable" data-ex="${e.id}">
                  <td><b>${e.id}</b><small class="sub">${h(e.employee)}</small></td>
                  <td>${h(e.typeName)}</td>
                  <td><span class="badge ${e.severity}">${h(sevMeta(e.severity).name)}</span></td>
                  <td class="danger">${e.ageHours} ชม. / SLA ${e.slaHours} ชม.</td></tr>`,
                )
                .join("") || `<tr><td colspan="4" class="empty">ไม่มีเคสเลย SLA ในตัวกรองนี้</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      <div class="panel">
        <div class="panel-heading">
          <div><p class="eyebrow">Damage</p><h2>ความเสียหายรอบปัจจุบัน</h2></div>
          <button class="ghost-button sm" data-goto="damage">ทะเบียนความเสียหาย</button>
        </div>
        <div class="big-stat"><span>ยอดที่อาจเป็นความเสียหาย</span><strong>${money0(damageSum)} บาท</strong><small>${DB.damages.length} เคส · รอบ 1 (1-15 ส.ค. 2026)</small></div>
        <div class="chart" id="chDamageCause"></div>
      </div>
    </section>`;

  Charts.draw("#chHourly", "line", {
    label: "ปริมาณรายการต่อชั่วโมง",
    xLabels: DB.hourly.map((x) => x.label),
    short: true,
    hideXLabels: true,
    series: [{ name: "รายการทั้งหมด", color: Charts.PALETTE.s1, values: DB.hourly.map((x) => x.total), area: true }],
    height: 150,
  });
  Charts.draw("#chHourlyEx", "line", {
    label: "รายการที่ไม่ match ต่อชั่วโมง",
    xLabels: DB.hourly.map((x) => x.label),
    series: [{ name: "ไม่ match", color: Charts.PALETTE.s2, values: DB.hourly.map((x) => x.exception), area: true }],
    height: 150,
  });
  Charts.draw("#chSeverity", "stack", { label: "สัดส่วนความรุนแรง", items: bySeverity });
  Charts.draw("#chType", "hbars", { label: "exception แยกตามประเภท", items: byType.slice(0, 7), color: Charts.PALETTE.s1, metric: "จำนวนเคส" });
  Charts.draw("#chShift", "bars", { label: "exception แยกตามกะ", items: byShift, color: Charts.PALETTE.s4, metric: "จำนวนเคส", height: 232 });
  Charts.draw("#chAccount", "hbars", { label: "บัญชีที่เกิด diff บ่อย", items: byAccount, color: Charts.PALETTE.s2, metric: "จำนวนเคส" });

  const causeAgg = Object.entries(
    DB.damages.reduce((a, d) => {
      a[d.cause] = (a[d.cause] || 0) + d.amount;
      return a;
    }, {}),
  )
    .map(([k, v]) => ({ label: k, value: v }))
    .filter((it) => it.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  Charts.draw("#chDamageCause", "hbars", { label: "สาเหตุความเสียหาย", items: causeAgg, color: "#d03b3b", money: true, metric: "ยอด (บาท)" });

  root.querySelectorAll(".sev-row").forEach((b) =>
    b.addEventListener("click", () => go("exceptions", { exFilter: { severity: b.dataset.sev, status: "ALL" } })),
  );
  root.querySelectorAll("[data-goto]").forEach((b) =>
    b.addEventListener("click", () => go(b.dataset.goto, b.dataset.sla ? { exFilter: { sla: true } } : {})),
  );
  root.querySelectorAll("tr[data-ex]").forEach((tr) => tr.addEventListener("click", () => openException(tr.dataset.ex)));
};

/* =============================================================
   VIEW: Daily company summary - 1 บริษัท / 1 วัน
   ============================================================= */
const dailyCompanyState = { date: "", company: "", batches: null, quality: null, operations: null, checklist: null, boFirst: null, exceptions: null, damages: null, loading: false, detailsLoading: false, coreError: null, detailsError: null, requestId: 0, error: null, updatedAt: null };

async function loadDailyCompanySummary(force = false) {
  const date = state.dailySummary.date || PROD_TODAY;
  const company = state.dailySummary.company || companyMaster()[0]?.code || "3XB";
  const sameSelection = dailyCompanyState.date === date && dailyCompanyState.company === company;
  if ((dailyCompanyState.loading && sameSelection) || (!force && sameSelection && dailyCompanyState.batches)) return;
  const requestId = ++dailyCompanyState.requestId;
  if (!sameSelection) {
    dailyCompanyState.batches = null;
    dailyCompanyState.quality = null;
    dailyCompanyState.operations = null;
    dailyCompanyState.checklist = null;
    dailyCompanyState.boFirst = null;
    dailyCompanyState.exceptions = null;
    dailyCompanyState.damages = null;
  }
  dailyCompanyState.loading = true;
  dailyCompanyState.detailsLoading = false;
  dailyCompanyState.coreError = null;
  dailyCompanyState.detailsError = null;
  dailyCompanyState.error = null;
  dailyCompanyState.date = date;
  dailyCompanyState.company = company;
  if (state.route === "daily-summary") render();
  try {
    const core = await Promise.allSettled([
      Sb.batches({ from: date, to: date }),
      Sb.quality({ from: date, to: date, company, limit: 50 }),
      Sb.operations({ from: date, to: date, company, limit: 50 }),
      Sb.dailyChecklist({ from: date, to: date, company, limit: 20 }),
      Sb.boFirstCoverage({ from: date, to: date, company, limit: 20 }),
    ]);
    if (requestId !== dailyCompanyState.requestId) return;
    const fulfilled = core.filter((item) => item.status === "fulfilled").length;
    if (!fulfilled) throw new Error("Supabase ยังไม่ตอบกลับข้อมูลของวันที่และบริษัทที่เลือก");
    const valueAt = (index) => core[index].status === "fulfilled" ? (core[index].value || []) : [];
    const selectedQuality = valueAt(1).filter((row) => row.business_date === date);
    /* หน้าเปิดครั้งแรกยึดวันที่วันนี้ แต่ผลรันอาจเพิ่งเสร็จถึงวันก่อนหน้า
       ถ้าวันนี้ยังไม่มีผล ให้พาไปวันที่ล่าสุดที่บริษัทนี้มีผลจริงทันที */
    if (date === PROD_TODAY && !selectedQuality.some((row) => row.run_id)) {
      const latestRows = await Sb.quality({ company, limit: 100 });
      if (requestId !== dailyCompanyState.requestId) return;
      const latestDate = (latestRows || [])
        .filter((row) => row.run_id && row.business_date && !row.is_archived)
        .map((row) => row.business_date)
        .sort()
        .pop();
      if (latestDate && latestDate !== date) {
        state.dailySummary.date = latestDate;
        dailyCompanyState.loading = false;
        return loadDailyCompanySummary(true);
      }
    }
    dailyCompanyState.batches = valueAt(0);
    dailyCompanyState.quality = selectedQuality;
    dailyCompanyState.operations = valueAt(2).filter((row) => row.business_date === date);
    dailyCompanyState.checklist = valueAt(3);
    dailyCompanyState.boFirst = valueAt(4).filter((row) => row.business_date === date);
    const failedCore = ["รายการไฟล์", "ผลกระทบยอด", "สถานะงาน", "Checklist", "บัญชีที่พบจาก BO"].filter((_, index) => core[index].status === "rejected");
    dailyCompanyState.coreError = failedCore.length ? `${failedCore.join(" / ")} ตอบกลับช้า จึงแสดงส่วนที่โหลดสำเร็จก่อน` : null;
    dailyCompanyState.exceptions = [];
    dailyCompanyState.damages = [];
    dailyCompanyState.updatedAt = new Date();
    dailyCompanyState.loading = false;
    dailyCompanyState.detailsLoading = true;
    if (state.route === "daily-summary") render();

    const details = await Promise.allSettled([
      Sb.currentExceptionsSummary({ from: date, to: date, company, limit: 250 }),
      Sb.damages({ from: date, to: date, company, limit: 500 }),
    ]);
    if (requestId !== dailyCompanyState.requestId) return;
    dailyCompanyState.exceptions = details[0].status === "fulfilled" ? (details[0].value || []).map(mapLiveException) : [];
    dailyCompanyState.damages = details[1].status === "fulfilled" ? (details[1].value || []) : [];
    dailyCompanyState.detailsError = details.some((item) => item.status === "rejected") ? "รายละเอียด Exception หรือความเสียหายบางส่วนตอบกลับช้า" : null;
    dailyCompanyState.detailsLoading = false;
    dailyCompanyState.updatedAt = new Date();
  } catch (error) {
    if (requestId === dailyCompanyState.requestId) dailyCompanyState.error = error.message || "โหลดสรุปรายวันไม่สำเร็จ";
  }
  if (requestId === dailyCompanyState.requestId) {
    dailyCompanyState.loading = false;
    dailyCompanyState.detailsLoading = false;
    if (state.route === "daily-summary") render();
  }
}

function dailyCompanyData(company) {
  const batches = dailyCompanyState.batches || [];
  const files = batches.flatMap((batch) => (batch.source_files || []).map((file) => ({
    ...file,
    batch,
    resolvedCompany: intakeCompanyOf(file, batch) || file.company || batch.company || "ไม่ระบุ",
    receivedAt: file.received_at || batch.received_at || "",
  }))).filter((file) => file.resolvedCompany === company);
  const batchIds = new Set(files.map((file) => file.batch.id));
  batches.filter((batch) => String(batch.company || "").toUpperCase() === company).forEach((batch) => batchIds.add(batch.id));
  const ownBatches = batches.filter((batch) => batchIds.has(batch.id));
  const quality = (dailyCompanyState.quality || []).filter((row) => row.company === company);
  const operations = (dailyCompanyState.operations || []).filter((row) => row.company === company);
  const exceptions = (dailyCompanyState.exceptions || []).filter((row) => row.company === company);
  const damages = (dailyCompanyState.damages || []).filter((row) => row.company === company);
  const checklist = (dailyCompanyState.checklist || []).find((row) => row.company === company) || null;
  const boFirst = (dailyCompanyState.boFirst || []).find((row) => row.company === company) || null;
  const exceptionTotal = quality.reduce((sum, row) => sum + Number(row.exception_count || 0), 0);
  const fixed = exceptions.filter((row) => ["closed", "approved"].includes(row.status));
  const confirmedDamage = exceptions.filter((row) => row.status === "damage");
  const resolvedTotal = checklist?.resolved_count == null ? fixed.length : Number(checklist.resolved_count || 0);
  const reportedOpen = Number(checklist?.open_count || 0);
  const checklistCoversRun = checklist?.open_count != null && (reportedOpen + resolvedTotal) >= exceptionTotal;
  const stillOpen = checklistCoversRun ? reportedOpen : Math.max(0, exceptionTotal - resolvedTotal);
  const reconciliationFiles = files.filter((file) => file.kind !== "doc_clarify");
  const evidenceFiles = files.filter((file) => file.kind === "doc_clarify");
  return { company, files, reconciliationFiles, evidenceFiles, batches: ownBatches, quality, operations, checklist, boFirst, exceptions, damages, exceptionTotal, fixed, resolvedTotal, confirmedDamage, stillOpen };
}

function dailyCompanyOptions() {
  const found = new Set(companyMaster().map((company) => normalizeLiveCompanyCode(company.code)).filter(Boolean));
  const addCompany = (value) => {
    const company = normalizeLiveCompanyCode(value);
    if (company) found.add(company);
  };
  (dailyCompanyState.quality || []).forEach((row) => addCompany(row.company));
  (dailyCompanyState.operations || []).forEach((row) => addCompany(row.company));
  (dailyCompanyState.checklist || []).forEach((row) => addCompany(row.company));
  (dailyCompanyState.batches || []).forEach((batch) => {
    addCompany(batch.company);
    (batch.source_files || []).forEach((file) => {
      addCompany(intakeCompanyOf(file, batch));
    });
  });
  return [...found].sort((a, b) => String(a).localeCompare(String(b), "th"));
}

function dailyMissingKinds(rows) {
  const kinds = (rows || []).flatMap((row) => Array.isArray(row.missing_groups) ? row.missing_groups.flat(3) : []);
  return [...new Set(kinds)].map((kind) => LIVE_KIND_LABEL[kind] || kind);
}

function dailyAuditSheetRows(date) {
  const checklist = (liveOverviewState.checklist || []).filter((row) => row.business_date === date && isLiveCompanyRow(row));
  const quality = (liveOverviewState.quality || []).filter((row) => row.business_date === date && isLiveCompanyRow(row));
  const checklistByCompany = new Map(checklist.map((row) => [row.company, row]));
  const qualityByCompany = new Map(quality.map((row) => [row.company, row]));
  const companies = [...new Set([...checklistByCompany.keys(), ...qualityByCompany.keys()])];
  return companies.map((company) => {
    const row = checklistByCompany.get(company) || { company };
    const run = qualityByCompany.get(company) || {};
    const exceptionCount = Number(run.exception_count ?? row.exception_count ?? 0);
    const resolvedCount = Number(row.resolved_count || 0);
    const reportedOpen = Number(row.open_count || 0);
    const checklistCoversRun = row.open_count != null && (reportedOpen + resolvedCount) >= exceptionCount;
    const openCount = checklistCoversRun ? reportedOpen : Math.max(0, exceptionCount - resolvedCount);
    const runStatus = row.job_status || run.status || "waiting_files";
    return {
      ...row,
      status: openCount > 0 && runStatus === "completed" ? "completed_review" : (row.checklist_status || runStatus),
      fileCount: Number(run.file_count ?? row.file_count ?? 0),
      parsedCount: Number(run.parsed_count ?? row.parsed_count ?? 0),
      stmCount: Number(run.stm_count ?? row.stm_count ?? 0),
      boCount: Number(run.bo_count ?? row.bo_count ?? 0),
      matched: Number(run.matched ?? row.matched_count ?? 0),
      exceptionCount,
      openCount,
      resolvedCount,
      missing: Array.isArray(row.missing_items) ? row.missing_items : [],
    };
  }).sort((a, b) => String(a.company).localeCompare(String(b.company), "th"));
}

function exportDailyCompanySummary(data) {
  if (!can("export")) return deny("export ข้อมูล");
  const date = state.dailySummary.date;
  const parsed = data.reconciliationFiles.filter((file) => file.parsed).length;
  const fileErrors = data.reconciliationFiles.filter((file) => file.parse_error).length;
  const matched = data.quality.reduce((sum, row) => sum + Number(row.matched || 0), 0);
  const stm = data.quality.reduce((sum, row) => sum + Number(row.stm_count || 0), 0);
  const bo = data.quality.reduce((sum, row) => sum + Number(row.bo_count || 0), 0);
  const damageTotal = data.damages.reduce((sum, row) => sum + Number(row.amount_thb ?? row.amount ?? 0), 0);
  const sheets = [
    {
      name: "สรุป",
      title: `สรุป Audit ${data.company} วันที่ ${date}`,
      headers: ["หัวข้อ", "ผลรวม", "คำอธิบาย"],
      widths: [34, 18, 55],
      rows: [
        ["อีเมลที่ได้รับ", data.batches.length, "นับชุดอีเมลที่มีไฟล์ของบริษัทนี้"],
        ["ไฟล์ที่ได้รับ", data.files.length, "ไฟล์จริงใน Supabase Storage"],
        ["ไฟล์สำหรับกระทบยอด", data.reconciliationFiles.length, "ไม่นับไฟล์ชี้แจงหรือหลักฐานประกอบ"],
        ["ไฟล์ที่ระบบอ่านสำเร็จ", parsed, "ไฟล์สำหรับกระทบยอดที่พร้อมใช้งาน"],
        ["ไฟล์ชี้แจง/หลักฐาน", data.evidenceFiles.length, "เก็บไว้เปิดตรวจและใช้ประกอบการปิดเคส ไม่ต้องอ่านเป็นรายการ"],
        ["ไฟล์อ่านไม่สำเร็จ", fileErrors, "ต้องเปิดต้นฉบับหรือตรวจรูปแบบไฟล์"],
        ["รายการฝั่ง STM", stm, "รายการฝาก-ถอน/PM ที่ระบบอ่านได้"],
        ["รายการฝั่ง BO", bo, "รายการระบบหลังบ้านที่ระบบอ่านได้"],
        ["จับคู่สำเร็จ", matched, "ผ่านเงื่อนไข account + time + amount"],
        ["Exception ทั้งหมด", data.exceptionTotal, "รายการที่ต้องตรวจต่อ"],
        ["แก้ไขและปิดแล้ว", data.resolvedTotal, "สถานะ approved หรือ closed"],
        ["ยังแก้ไม่สำเร็จ", data.stillOpen, "รวมกำลังติดตามและรายการที่ยังปิดไม่ได้"],
        ["ยืนยันเป็นความเสียหาย", data.confirmedDamage.length, "ส่วนหนึ่งของรายการที่ยังแก้ไม่สำเร็จ"],
        ["มูลค่าความเสียหายที่บันทึก", damageTotal, "บาท"],
      ],
    },
    {
      name: "ไฟล์ที่ได้รับ",
      title: `ไฟล์ที่ได้รับ ${data.company} วันที่ ${date}`,
      headers: ["รับเมื่อ", "หัวข้อเมล", "ผู้ส่ง", "ชื่อไฟล์", "ประเภท", "ขนาด (KB)", "แถว", "สถานะอ่าน", "ข้อผิดพลาด", "Storage path"],
      widths: [22, 42, 28, 38, 24, 14, 12, 18, 42, 50],
      rows: data.files.map((file) => [file.receivedAt, file.batch.subject || "", file.batch.sender || "", file.file_name || "", LIVE_KIND_LABEL[file.kind] || file.kind || "", Math.round(Number(file.size_bytes || 0) / 1024), Number(file.row_count || 0), file.kind === "doc_clarify" ? "หลักฐานพร้อมตรวจ" : file.parse_error ? "อ่านไม่สำเร็จ" : file.parsed ? parsedFileLabel(file) : "รออ่าน", file.parse_error || "", file.storage_path || ""]),
    },
    {
      name: "ผลกระทบยอด",
      title: `ผลกระทบยอด ${data.company} วันที่ ${date}`,
      headers: ["ระบบ", "สถานะ", "STM", "BO", "จับคู่สำเร็จ", "อัตราจับคู่ (%)", "Exception", "ไฟล์", "ไฟล์อ่านผิดพลาด", "ไฟล์ที่ยังขาด", "เวลารัน"],
      widths: [18, 20, 12, 12, 16, 18, 14, 12, 18, 44, 22],
      rows: data.quality.map((row) => [row.business_system || "", LIVE_STATUS[row.status]?.label || row.status || "", Number(row.stm_count || 0), Number(row.bo_count || 0), Number(row.matched || 0), Number(row.match_rate || 0), Number(row.exception_count || 0), Number(row.file_count || 0), Number(row.error_count || 0), dailyMissingKinds([row]).join(", "), row.run_at || ""]),
    },
    {
      name: "Exception",
      title: `Exception ${data.company} วันที่ ${date}`,
      headers: ["เคส", "เวลา", "ธนาคาร", "บัญชี", "ฝาก/ถอน", "ประเภท", "ยอด BO", "ยอด STM", "ผลต่าง", "ระดับ", "สถานะ", "ผู้เกี่ยวข้อง", "สาเหตุ", "รายละเอียด"],
      widths: [16, 12, 14, 18, 12, 28, 16, 16, 16, 12, 18, 22, 35, 60],
      rows: data.exceptions.map((row) => [row.id, row.time, row.bank, row.account, row.direction, row.typeName, row.systemAmount ?? "", row.bankAmount ?? "", row.amountDiff, row.severity, statusMeta(row.status).name, row.employee, row.cause, row.detail]),
    },
    {
      name: "ความเสียหาย",
      title: `ความเสียหาย ${data.company} วันที่ ${date}`,
      headers: ["รหัส", "เคส", "ยอด (บาท)", "สาเหตุ", "ผู้เกี่ยวข้อง", "หลักฐาน", "สถานะการเงิน"],
      widths: [16, 16, 18, 42, 22, 14, 20],
      rows: data.damages.map((row) => [row.code || row.id, row.exception_id || "", Number(row.amount_thb ?? row.amount ?? 0), row.cause || "", row.employee || "", row.has_evidence ? "ครบ" : "รอ", row.finance_status || ""]),
    },
  ];
  const filename = `daily-audit_${date}_${data.company}.xlsx`;
  const meta = `บริษัท ${data.company} · วันที่ ${date} · ออกโดย ${currentUser().username} เมื่อ ${nowStamp()}`;
  const result = Exporter.workbook(sheets, filename, meta);
  if (result.ok) {
    logAction("export", "daily_company_summary", `${date}|${data.company}`, `Excel ${sheets.length} ชีต · ${data.files.length} ไฟล์ · ${data.exceptionTotal} exception`);
    toast(`ดาวน์โหลด ${filename} แล้ว`);
  } else {
    Exporter.csv(sheets[0].headers, sheets[0].rows, filename.replace(".xlsx", ".csv"));
    toast("ดาวน์โหลดสรุปเป็น CSV ให้แทน เนื่องจากตัวเขียน Excel ยังไม่พร้อม", "warn");
  }
}

function renderDailyCompanySummary(root) {
  let openBoFollowUp = () => {};
  if (!Sb.signedIn()) {
    root.innerHTML = `<section class="panel"><div class="alert bad"><strong>ยังไม่ได้เข้าสู่ระบบ</strong><span>เข้าสู่ระบบก่อนเพื่ออ่านไฟล์และผลกระทบยอดจริงจาก Supabase</span></div></section>`;
    return;
  }
  if ((!dailyCompanyState.batches || dailyCompanyState.date !== state.dailySummary.date || dailyCompanyState.company !== state.dailySummary.company) && !dailyCompanyState.loading) loadDailyCompanySummary();
  const companies = dailyCompanyOptions();
  const company = companies.includes(state.dailySummary.company) ? state.dailySummary.company : (companies[0] || "3XB");
  state.dailySummary.company = company;
  const controls = `<section class="panel daily-summary-controls no-capture"><div><p class="eyebrow">Daily Audit Pack</p><h2>เลือก 1 บริษัท และ 1 วัน</h2><small>ทุกตัวเลขและไฟล์ด้านล่างจะยึดตัวเลือกสองช่องนี้เท่านั้น</small></div><label>วันที่<input type="date" id="dailySummaryDate" value="${h(state.dailySummary.date)}" /></label><label>บริษัท<select id="dailySummaryCompany">${companies.map((code) => `<option value="${h(code)}" ${code === company ? "selected" : ""}>${h(code)}</option>`).join("")}</select></label><button class="ghost-button" id="dailySummaryRefresh">รีเฟรช</button><button class="primary-button" id="dailySummaryExport" ${dailyCompanyState.loading || dailyCompanyState.error ? "disabled" : ""}>Export รายวัน</button></section>`;
  if (dailyCompanyState.loading && !dailyCompanyState.batches) {
    root.innerHTML = controls + `<section class="panel"><div class="alert"><strong>กำลังโหลดข้อมูลหลักของรายงาน</strong><span>หน้านี้ยังใช้งานเมนูอื่นได้ตามปกติ และจะเปิดรายงานให้ทันทีเมื่อข้อมูลหลักมาถึง</span></div></section>`;
  } else if (dailyCompanyState.error) {
    root.innerHTML = controls + `<section class="panel"><div class="alert bad"><strong>โหลดสรุปรายวันไม่สำเร็จ</strong><span>${h(dailyCompanyState.error)}</span></div></section>`;
  } else {
    const data = dailyCompanyData(company);
    const parsed = data.reconciliationFiles.filter((file) => file.parsed).length;
    const fileErrors = data.reconciliationFiles.filter((file) => file.parse_error).length;
    const waitingFiles = data.reconciliationFiles.length - parsed - fileErrors;
    const stm = data.quality.reduce((sum, row) => sum + Number(row.stm_count || 0), 0);
    const bo = data.quality.reduce((sum, row) => sum + Number(row.bo_count || 0), 0);
    const matched = data.quality.reduce((sum, row) => sum + Number(row.matched || 0), 0);
    const matchRate = stm ? (matched / stm) * 100 : 0;
    const risk = data.exceptions.reduce((sum, row) => sum + Number(row.riskAmount || 0), 0);
    const damageTotal = data.damages.reduce((sum, row) => sum + Number(row.amount_thb ?? row.amount ?? 0), 0);
    const scheduled = data.checklist?.checklist_status === "scheduled";
    const missing = scheduled ? [] : data.checklist?.missing_items?.length
      ? data.checklist.missing_items
      : dailyMissingKinds(data.quality.length ? data.quality : data.operations);
    const latestStatus = data.quality[0]?.status || data.operations[0]?.status || (data.files.length ? "ready" : "waiting_files");
    const status = latestStatus === "completed" && data.stillOpen > 0
      ? { label: "กระทบยอดสำเร็จ · รอตรวจเคส", tone: "amber" }
      : LIVE_STATUS[latestStatus] || { label: latestStatus || "ยังไม่มีงาน", tone: "grey" };
    const kindCounts = Object.entries(data.files.reduce((acc, file) => {
      const label = LIVE_KIND_LABEL[file.kind] || file.kind || "ยังจำแนกไม่ได้";
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {})).sort((a, b) => b[1] - a[1]);
    const stmFiles = data.files.filter((file) => file.kind === "stm_pdf").length;
    const boFiles = data.files.filter((file) => file.kind === "bo_main").length;
    const pmFiles = data.files.filter((file) => file.kind === "pm_statement").length;
    const boSourceFiles = data.files.filter((file) => file.kind === "bo_main");
    const evidenceFiles = data.evidenceFiles.length;
    const boExpected = expectedBoCount(data.checklist || { company });
    const stmRegistered = registeredStmCount(data.checklist);
    const pmRegistered = registeredPmCount(data.checklist);
    const checklistReady = Boolean(data.checklist);
    const checklistBoCount = data.checklist?.bo_count == null ? boFiles : Number(data.checklist.bo_count || 0);
    const checklistStmCount = data.checklist?.stm_count == null ? stmFiles : Number(data.checklist.stm_count || 0);
    const checklistPmCount = data.checklist == null
      ? pmFiles
      : Number(data.checklist.pm_deposit_count || 0) + Number(data.checklist.pm_withdraw_count || 0);
    const reconciliationReady = data.reconciliationFiles.length > 0 && parsed === data.reconciliationFiles.length && fileErrors === 0;
    const boRequired = Array.isArray(data.boFirst?.required) ? data.boFirst.required : [];
    const boReceived = Array.isArray(data.boFirst?.received) ? data.boFirst.received : [];
    const boMissing = Array.isArray(data.boFirst?.missing) ? data.boFirst.missing : [];
    const businessSystem = data.checklist?.business_system || data.quality[0]?.business_system || data.operations[0]?.business_system || businessSystemOfCompany(company);
    const directionLabel = (value) => value === "deposit" ? "ฝาก" : value === "withdraw" ? "ถอน" : "ไม่ระบุทิศทาง";
    const sourceFilesFor = (kind) => data.files.filter((file) => kind === "PM" ? file.kind === "pm_statement" : file.kind === "stm_pdf");
    const pairInfo = (item, received, missingItem) => {
      if (!missingItem) return {
        code: "matched", tone: "green", title: "จับคู่แหล่งข้อมูลแล้ว",
        detail: `${num(received?.rows || 0)} รายการ`,
        sourceNames: Array.isArray(received?.source_files) ? received.source_files.filter(Boolean) : [],
      };
      const files = sourceFilesFor(item.kind);
      const errors = files.filter((file) => file.parse_error);
      const parsedFiles = files.filter((file) => file.parsed);
      const sameIdentity = boReceived.find((candidate) => candidate.kind === item.kind && candidate.identity === item.identity);
      const sameNames = Array.isArray(sameIdentity?.source_files) ? sameIdentity.source_files.filter(Boolean) : [];
      const allNames = files.map((file) => file.file_name).filter(Boolean);
      if (!files.length) return { code: "missing_file", tone: "red", title: `ยังไม่ได้รับไฟล์ ${item.kind || "STM"}`, detail: "ไม่พบไฟล์ต้นทางของบริษัท/วันที่นี้", sourceNames: [] };
      if (errors.length) return { code: "read_error", tone: "red", title: "ได้รับไฟล์แล้ว แต่อ่านไม่ได้", detail: `${num(files.length)} ไฟล์ · ผิดพลาด ${num(errors.length)}`, sourceNames: allNames };
      if (parsedFiles.length < files.length) return { code: "waiting", tone: "amber", title: "ได้รับไฟล์แล้ว · รออ่าน", detail: `อ่านแล้ว ${num(parsedFiles.length)}/${num(files.length)} ไฟล์`, sourceNames: allNames };
      if (sameIdentity) return { code: "wrong_direction", tone: "red", title: "พบบัญชีแล้ว แต่ทิศทางไม่ตรง", detail: `BO ${directionLabel(item.direction)} · ไฟล์ ${directionLabel(sameIdentity.direction)}`, sourceNames: sameNames.length ? sameNames : allNames };
      return { code: "identity_not_found", tone: "red", title: "มีไฟล์แล้ว · ไม่พบเลขบัญชีคู่", detail: `ได้รับและอ่านแล้ว ${num(files.length)} ไฟล์`, sourceNames: allNames };
    };
    const pairStatus = (info, followIndex) => `<span class="badge ${h(info.tone)}">${h(info.title)}</span><small class="sub">${h(info.detail)}${info.sourceNames.length && info.code === "matched" ? ` · ${h(info.sourceNames.join(" · "))}` : ""}</small><button type="button" class="bo-follow-button" data-bo-follow="${followIndex}">ดูรายละเอียด / ดำเนินการ</button>`;
    const fullBoIdentity = (item) => {
      const labels = Array.isArray(item?.source_labels) ? item.source_labels.filter(Boolean) : [];
      if (!labels.length) return `<span class="muted">–</span><small class="sub">รันใหม่เพื่อเก็บชื่อเต็ม</small>`;
      return `<div class="bo-full-identities">${labels.map((label) => `<span title="${h(label)}">${h(label)}</span>`).join("")}</div>`;
    };
    const boFollowUps = [];
    const boRequirementRows = boRequired.map((item) => {
      const received = boReceived.find((candidate) => candidate.key === item.key);
      const missingItem = boMissing.some((candidate) => candidate.key === item.key);
      const info = pairInfo(item, received, missingItem);
      const sourceNameSet = new Set(info.sourceNames.map((name) => String(name).trim().toLowerCase()));
      const sourceFiles = data.files.filter((file) => sourceNameSet.has(String(file.file_name || "").trim().toLowerCase()));
      const followIndex = boFollowUps.push({ item, received, info, sourceFiles }) - 1;
      return `<tr class="${missingItem ? "bo-requirement-attention" : ""}"><td><b>${h(item.system || businessSystem)}</b></td><td><b>${h(normalizeLiveCompanyCode(item.company) || company)}</b></td><td><b>${h(item.label || item.identity || "-")}</b><small class="sub">${h(item.kind || "STM")}</small></td><td>${fullBoIdentity(item)}</td><td>${h(directionLabel(item.direction))}</td><td class="right tnum">${num(item.rows || 0)}</td><td class="right tnum">${money0(item.amount || 0)}</td><td>${pairStatus(info, followIndex)}</td></tr>`;
    }).join("");
    const requiredKeys = new Set(boRequired.map((item) => item.key));
    const unmatchedReceived = boReceived.filter((item) => !requiredKeys.has(item.key));
    const unmatchedReceivedRows = unmatchedReceived.map((item) => `<tr><td><b>${h(item.system || businessSystem)}</b></td><td><b>${h(normalizeLiveCompanyCode(item.company) || company)}</b></td><td><b>${h(item.label || item.identity || "-")}</b><small class="sub">${h(item.kind || "STM")}</small></td><td>${h(directionLabel(item.direction))}</td><td class="right tnum">${num(item.rows || 0)}</td><td>${Array.isArray(item.source_files) && item.source_files.length ? h(item.source_files.join(" · ")) : "ไฟล์ถูกอ่านแล้ว แต่ผลรันเดิมยังไม่ได้เก็บชื่อไฟล์"}</td></tr>`).join("");
    const boFileCards = boSourceFiles.map((file) => {
      const fileStatus = file.parse_error ? "error" : file.parsed ? "parsed" : "waiting";
      const statusLabel = file.parse_error ? "อ่านไม่ได้" : file.parsed ? parsedFileLabel(file) : "รออ่าน";
      const tone = file.parse_error ? "red" : file.parsed ? "green" : "amber";
      return `<button type="button" class="bo-file-card" data-storage-open="${h(file.storage_path)}" data-file-id="${h(file.id)}" data-file-name="${h(file.file_name)}" data-file-mime="${h(file.mime_type || "")}" data-file-size="${h(file.size_bytes || "")}" data-file-kind="${h(file.kind || "")}" data-file-company="${h(company)}" data-file-date="${h(state.dailySummary.date)}" data-file-status="${fileStatus}" ${file.storage_path ? "" : "disabled"}><span><b>${h(file.file_name || "ไฟล์ BO")}</b><small>${h(String(file.receivedAt).replace("T", " ").slice(0, 16))} · ${num(file.row_count || 0)} แถว</small></span><em class="badge ${tone}">${h(statusLabel)}</em></button>`;
    }).join("");
    const boPreviewButton = (file, sourceLabel) => {
      if (!file) return "";
      const fileStatus = file.parse_error ? "error" : file.parsed ? "parsed" : "waiting";
      return `<button type="button" class="bo-follow-file" data-bo-preview data-storage-open="${h(file.storage_path)}" data-file-id="${h(file.id)}" data-file-name="${h(file.file_name)}" data-file-mime="${h(file.mime_type || "")}" data-file-size="${h(file.size_bytes || "")}" data-file-kind="${h(file.kind || "")}" data-file-company="${h(company)}" data-file-date="${h(state.dailySummary.date)}" data-file-status="${fileStatus}" ${file.storage_path ? "" : "disabled"}><span><small>${h(sourceLabel)}</small><b>${h(file.file_name || "ไฟล์ต้นทาง")}</b></span><em>Preview →</em></button>`;
    };
    openBoFollowUp = (followIndex) => {
      const follow = boFollowUps[Number(followIndex)];
      if (!follow) return;
      const { item, info, sourceFiles } = follow;
      const labels = Array.isArray(item.source_labels) ? item.source_labels.filter(Boolean) : [];
      const identity = item.label || item.identity || "-";
      const copyText = [
        "[ติดตามเอกสารกระทบยอด BO-first]",
        "",
        "=== 1) ข้อมูลอ้างอิง ===",
        `วันที่: ${state.dailySummary.date}`,
        `ระบบ: ${item.system || businessSystem}`,
        `บริษัท: ${normalizeLiveCompanyCode(item.company) || company}`,
        `บัญชี/Provider: ${identity}`,
        `ชื่อเต็มจาก BO: ${labels.join(" | ") || "-"}`,
        `ประเภท: ${item.kind || "STM"} ${directionLabel(item.direction)}`,
        "",
        "=== 2) ผลตรวจจาก BO ===",
        `รายการใน BO: ${num(item.rows || 0)} รายการ`,
        `ยอดรวม BO: ${money0(item.amount || 0)} บาท`,
        `สถานะ: ${info.title}`,
        `รายละเอียด: ${info.detail}`,
        "",
        "=== 3) ไฟล์ที่เกี่ยวข้อง ===",
        `ไฟล์ BO: ${boSourceFiles.map((file) => file.file_name).filter(Boolean).join(" | ") || "-"}`,
        `ไฟล์ STM/PM ที่พบ: ${info.sourceNames.join(" | ") || "-"}`,
        "",
        "=== 4) สิ่งที่ขอให้ทีมตรวจ ===",
        "1. ยืนยันเลขบัญชีหรือ Provider ว่าตรงกับ BO หรือไม่",
        "2. ยืนยันทิศทางฝาก/ถอนของไฟล์ที่ส่งมา",
        "3. หากข้อมูลไม่ตรง กรุณาชี้แจงสาเหตุและแนบหลักฐานที่เกี่ยวข้อง",
      ].join("\n");
      const sourceFileHtml = sourceFiles.length
        ? sourceFiles.map((file) => boPreviewButton(file, "ไฟล์ STM/PM ที่ระบบพบ")).join("")
        : info.sourceNames.length
          ? `<div class="bo-follow-file-names"><b>ชื่อไฟล์ที่ผลรันระบุ</b><span>${info.sourceNames.map(h).join("<br>")}</span><small>ไม่พบ metadata สำหรับเปิด Preview ในผลโหลดชุดนี้ ให้เปิดคลังไฟล์เพื่อตรวจต่อ</small></div>`
          : `<div class="empty-box">ยังไม่มีไฟล์ STM/PM สำหรับรายการนี้</div>`;
      openModal(
        `ติดตาม ${h(identity)} · ${h(directionLabel(item.direction))}`,
        `<div class="bo-follow-detail"><div class="bo-follow-status ${h(info.tone)}"><span>${h(info.title)}</span><small>${h(info.detail)}</small></div><div class="bo-follow-grid"><div><span>ระบบ / บริษัท</span><b>${h(item.system || businessSystem)} · ${h(normalizeLiveCompanyCode(item.company) || company)}</b></div><div><span>บัญชี / Provider</span><b>${h(identity)}</b></div><div class="wide"><span>ชื่อเต็มจาก BO</span><b>${labels.length ? labels.map(h).join("<br>") : "-"}</b></div><div><span>ประเภท</span><b>${h(item.kind || "STM")} · ${h(directionLabel(item.direction))}</b></div><div><span>ข้อมูล BO</span><b>${num(item.rows || 0)} รายการ · ${money0(item.amount || 0)} บาท</b></div></div><div class="bo-follow-files"><h3>เปิดข้อมูลจริงเพื่อรีเช็ก</h3>${boSourceFiles.map((file) => boPreviewButton(file, "ไฟล์ BO ต้นฉบับ")).join("")}${sourceFileHtml}</div><div class="bo-follow-copy"><div class="bo-follow-copy-head"><div><span>ข้อความพร้อมส่งให้ทีม</span><small>แบ่งหัวข้อไว้แล้ว อ่านง่ายและคัดลอกส่งได้ทันที</small></div></div><div class="bo-follow-message"><section><h3>1. ข้อมูลอ้างอิง</h3><dl><div><dt>วันที่</dt><dd>${h(state.dailySummary.date)}</dd></div><div><dt>ระบบ / บริษัท</dt><dd>${h(item.system || businessSystem)} · ${h(normalizeLiveCompanyCode(item.company) || company)}</dd></div><div><dt>บัญชี / Provider</dt><dd>${h(identity)}</dd></div><div><dt>ชื่อเต็มจาก BO</dt><dd>${labels.length ? labels.map(h).join("<br>") : "-"}</dd></div><div><dt>ประเภท</dt><dd>${h(item.kind || "STM")} · ${h(directionLabel(item.direction))}</dd></div></dl></section><section><h3>2. ผลตรวจจาก BO</h3><dl><div><dt>รายการ / ยอดรวม</dt><dd>${num(item.rows || 0)} รายการ · ${money0(item.amount || 0)} บาท</dd></div><div><dt>สถานะ</dt><dd class="danger">${h(info.title)}</dd></div><div><dt>รายละเอียด</dt><dd>${h(info.detail)}</dd></div></dl></section><section><h3>3. ไฟล์ที่เกี่ยวข้อง</h3><p><b>BO:</b> ${h(boSourceFiles.map((file) => file.file_name).filter(Boolean).join(" | ") || "-")}</p><p><b>STM/PM:</b> ${h(info.sourceNames.join(" | ") || "-")}</p></section><section class="action"><h3>4. สิ่งที่ขอให้ทีมตรวจ</h3><ol><li>ยืนยันเลขบัญชีหรือ Provider ว่าตรงกับ BO หรือไม่</li><li>ยืนยันทิศทางฝาก/ถอนของไฟล์ที่ส่งมา</li><li>หากข้อมูลไม่ตรง กรุณาชี้แจงสาเหตุและแนบหลักฐานที่เกี่ยวข้อง</li></ol></section></div><details class="bo-follow-raw"><summary>ดูข้อความแบบข้อความล้วน</summary><textarea id="boFollowCopyText" readonly>${h(copyText)}</textarea></details></div></div>`,
        `<button class="ghost-button" id="boFollowClose">ปิด</button><button class="ghost-button" id="boFollowCloud">เปิดคลังไฟล์</button><button class="ghost-button" id="boFollowCases">เปิดหน้าติดตามเคส</button><button class="primary-button" id="boFollowCopy">คัดลอกข้อความ</button>`,
      );
      $("#boFollowClose").addEventListener("click", closeModal);
      $("#boFollowCopy").addEventListener("click", async (event) => {
        await copyPlainText(copyText);
        event.currentTarget.textContent = "คัดลอกแล้ว ✓";
        toast("คัดลอกข้อความติดตามแล้ว", "ok");
      });
      $("#boFollowCloud").addEventListener("click", () => {
        closeModal();
        go("cloud", { filters: { date: state.dailySummary.date, from: state.dailySummary.date, to: state.dailySummary.date, preset: "day", company } });
      });
      $("#boFollowCases").addEventListener("click", () => {
        closeModal();
        go("clarify", { filters: { date: state.dailySummary.date, from: state.dailySummary.date, to: state.dailySummary.date, preset: "day", company } });
      });
      bindStoredFileLinks($("#modal"), "[data-bo-preview]");
    };
    const nextWork = fileErrors
      ? { route: "cloud", tone: "bad", title: `แก้ไฟล์อ่านไม่ได้ ${num(fileErrors)} ไฟล์`, detail: "เปิดตัวอย่าง เลือกบริษัท/ประเภท แล้วบันทึกและรันต่อ", button: "ตรวจไฟล์" }
      : waitingFiles
        ? { route: "cloud", tone: "warn", title: `รอระบบอ่าน ${num(waitingFiles)} ไฟล์`, detail: "ตรวจสถานะไฟล์ก่อนเริ่มกระทบยอด", button: "ดูไฟล์" }
        : missing.length
          ? { route: "cloud", tone: "warn", title: `ตามไฟล์ที่ยังขาด ${num(missing.length)} ประเภท`, detail: missing.join(" · "), button: "ดูสิ่งที่ขาด" }
          : data.stillOpen
            ? { route: "exceptions", tone: "warn", title: `ตรวจรายการค้าง ${num(data.stillOpen)} เคส`, detail: "เปิดหลักฐานและติดตามผลการชี้แจง", button: "ตรวจเคส" }
            : { route: "reports", tone: "ok", title: "ตรวจครบแล้ว พร้อมออกรายงาน", detail: "ตรวจยอดสรุปอีกครั้งแล้ว Export เก็บเป็นหลักฐาน", button: "ดูรายงาน" };
    const sheetRows = dailyAuditSheetRows(state.dailySummary.date);
    const auditSheetHtml = `
      <section class="panel audit-sheet-panel">
        <div class="panel-heading"><div><p class="eyebrow">Audit Sheet · ภาพรวมทุกบริษัท</p><h2>สถานะงานวันที่ ${h(state.dailySummary.date)}</h2><small class="head-sub">สรุปขึ้นก่อนทันที ส่วนรายละเอียดแต่ละรายงานจะโหลดเมื่อกดเปิด</small></div><span class="badge blue">${num(sheetRows.length)} บริษัท</span></div>
        <div class="table-wrap audit-sheet-wrap"><table class="audit-sheet"><thead><tr><th>บริษัท</th><th>ไฟล์</th><th class="right">STM/PM</th><th class="right">BO</th><th class="right">จับคู่</th><th>รายการผิดปกติ</th><th>สถานะ</th><th>สิ่งที่ต้องทำ</th></tr></thead><tbody>
          ${sheetRows.map((row) => {
            const meta = row.status === "completed_review"
              ? { label: "กระทบยอดแล้ว · รอตรวจเคส", tone: "amber" }
              : CHECKLIST_STATUS[row.status] || LIVE_STATUS[row.status] || { label: row.status || "รอตรวจ", tone: "grey" };
            const fileOk = row.fileCount > 0 && row.parsedCount >= row.fileCount;
            const action = row.missing.length || !fileOk ? "แก้ไฟล์" : row.openCount ? "ตรวจ/แจ้งแก้" : row.exceptionCount ? "เปิดอนุมัติ" : "ดูรายงาน";
            return `<tr data-sheet-company="${h(row.company)}"><td><b>${h(row.company)}</b></td><td><span class="sheet-progress ${fileOk ? "ok" : "warn"}">${num(row.parsedCount)}/${num(row.fileCount)}</span></td><td class="right tnum">${num(row.stmCount)}</td><td class="right tnum">${num(row.boCount)}</td><td class="right"><b class="${row.matched ? "success" : "muted"}">${num(row.matched)}</b></td><td><b class="${row.openCount ? "danger" : ""}">${num(row.openCount || row.exceptionCount)}</b><small class="sub">ปิดแล้ว ${num(row.resolvedCount)}</small></td><td><span class="badge ${h(meta.tone)}">${h(meta.label)}</span></td><td class="nowrap"><button class="ghost-button xs" data-sheet-open="${h(row.company)}">ดูรายงาน</button><button class="${row.openCount || row.missing.length ? "primary-button" : "ghost-button"} xs" data-sheet-action="${h(row.company)}" data-sheet-mode="${row.missing.length || !fileOk ? "files" : row.openCount ? "issues" : row.exceptionCount ? "approve" : "report"}">${h(action)}</button></td></tr>`;
          }).join("") || `<tr><td colspan="8" class="empty">ยังไม่มีสถานะบริษัทในวันนี้ — ระบบจะแสดงเมื่อได้รับอีเมลหรือมีผลกระทบยอด</td></tr>`}
        </tbody></table></div>
      </section>`;
    root.innerHTML = controls + `
      ${auditSheetHtml}
      <section class="daily-summary-head"><div><p class="eyebrow">สรุปประจำวัน</p><h2>${h(company)} · ${h(state.dailySummary.date)}</h2><p>อัปเดตจาก Supabase ${dailyCompanyState.updatedAt ? dailyCompanyState.updatedAt.toLocaleString("th-TH") : "-"}${dailyCompanyState.detailsLoading ? " · กำลังเติมรายละเอียดเคส" : ""}</p></div><span class="badge ${status.tone}">${h(status.label)}</span></section>
      ${dailyCompanyState.coreError ? `<section class="alert warn"><strong>แสดงข้อมูลที่โหลดสำเร็จก่อน</strong><span>${h(dailyCompanyState.coreError)} กดรีเฟรชเพื่อลองเฉพาะส่วนที่ยังขาดได้</span></section>` : ""}
      ${dailyCompanyState.detailsError ? `<section class="alert warn"><strong>ข้อมูลหลักพร้อมแล้ว</strong><span>${h(dailyCompanyState.detailsError)} — ตัวเลขไฟล์และผลกระทบยอดหลักยังเปิดดูได้</span></section>` : ""}
      <section class="panel daily-focus-board">
        <div class="daily-focus-title"><div><p class="eyebrow">ภาพรวมการกระทบยอด 3 จุด</p><h2>STM / PM ↔ เวลาและบัญชี ↔ BO</h2><small>ตัวเลขทั้งหมดมาจากผลอ่านไฟล์และผลรันจริงของ ${h(company)} เท่านั้น</small></div><span class="badge ${status.tone}">${h(status.label)}</span></div>
        <div class="daily-reconcile-tiles action-tiles">
          <article data-action-route="cloud"><span>รายการ STM / PM</span><strong>${num(stm)}</strong><small>${num(stmFiles + pmFiles)} ไฟล์ต้นทาง</small></article>
          <article data-action-route="cloud"><span>รายการ BO</span><strong>${num(bo)}</strong><small>${num(boFiles)} ไฟล์ต้นทาง</small></article>
          <article data-scroll-daily="dailyReconcileResult" class="ok"><span>จับคู่ผ่าน 3 จุด</span><strong>${num(matched)}</strong><small>${matchRate.toFixed(2)}% ของ STM / PM</small></article>
          <article data-action-route="exceptions" class="${data.exceptionTotal ? "warn" : "ok"}"><span>ต้องตรวจสอบ</span><strong>${num(data.exceptionTotal)}</strong><small>ยอดเสี่ยง ${money0(risk)} บาท</small></article>
          <article data-action-route="clarify" class="${data.stillOpen ? "bad" : "ok"}"><span>ยังไม่ปิด</span><strong>${num(data.stillOpen)}</strong><small>ปิดแล้ว ${num(data.resolvedTotal)} เคส</small></article>
        </div>
        <div class="daily-difference-strip"><div class="${stm === bo ? "ok" : "warn"}"><span>จำนวนรายการ STM/PM เทียบ BO</span><b>${num(stm - bo)}</b></div><div class="${data.exceptionTotal ? "bad" : "ok"}"><span>รายการที่ต้องตรวจต่อ</span><b>${num(data.exceptionTotal)}</b></div><div class="${damageTotal ? "bad" : "ok"}"><span>ความเสียหายที่ยืนยันแล้ว</span><b>${money0(damageTotal)} บาท</b></div></div>
        <button type="button" class="daily-next-work ${nextWork.tone}" data-action-route="${nextWork.route}"><span><small>ขั้นถัดไปที่แนะนำ</small><b>${h(nextWork.title)}</b><em>${h(nextWork.detail)}</em></span><strong>${h(nextWork.button)} →</strong></button>
      </section>
      <section class="daily-source-summary" aria-label="ไฟล์ที่ได้รับ"><article><span>อีเมล / ไฟล์ทั้งหมด</span><b>${num(data.batches.length)} / ${num(data.files.length)}</b></article><article><span>STM ธนาคาร</span><b>${num(stmFiles)} ไฟล์</b></article><article><span>BO หลังบ้าน</span><b>${num(boFiles)} ไฟล์</b></article><article><span>PM ฝาก/ถอน</span><b>${num(pmFiles)} ไฟล์</b></article><article><span>หลักฐานชี้แจง</span><b>${num(evidenceFiles)} ไฟล์</b></article><article class="${fileErrors ? "bad" : reconciliationReady ? "ok" : "warn"}"><span>ไฟล์กระทบยอดที่อ่านสำเร็จ</span><b>${num(parsed)}/${num(data.reconciliationFiles.length)}</b></article>
      </section>
      <section class="daily-audit-flow" aria-label="สถานะงานรายวัน"><button type="button" data-daily-route="cloud" class="${data.files.length ? "done" : "bad"}"><b>1</b><span>รับไฟล์<small>${num(data.files.length)} ไฟล์ · กดตรวจ</small></span></button><button type="button" data-daily-route="cloud" class="${reconciliationReady ? "done" : "warn"}"><b>2</b><span>อ่านไฟล์กระทบยอด<small>${num(parsed)}/${num(data.reconciliationFiles.length)} สำเร็จ · หลักฐาน ${num(evidenceFiles)} ไฟล์</small></span></button><button type="button" data-scroll-daily="dailyReconcileResult" class="${data.quality.length ? "done" : "warn"}"><b>3</b><span>กระทบยอด<small>${h(status.label)} · กดดูผล</small></span></button><button type="button" data-daily-route="exceptions" class="${data.exceptionTotal ? "warn" : "done"}"><b>4</b><span>ตรวจ Exception<small>${num(data.exceptionTotal)} เคส · กดตรวจ</small></span></button><button type="button" data-daily-route="clarify" class="${data.stillOpen ? "warn" : "done"}"><b>5</b><span>ปิดงาน<small>ปิดแล้ว ${num(data.resolvedTotal)} · กดติดตาม</small></span></button></section>

      <section class="panel bo-document-summary">
        <div class="panel-heading"><div><p class="eyebrow">BO-first document check</p><h2>สรุปเอกสาร BO ที่ตรวจ</h2><small class="head-sub">ระบบ ${h(businessSystem)} · บริษัท ${h(company)} · BO เป็นหลักในการระบุบัญชีและ Provider ที่ใช้งานจริง แล้วจึงตามหา STM/PM ของบริษัทเดียวกัน</small></div><span class="health ${boSourceFiles.length >= boExpected && !boMissing.length ? "ok" : "attention"}">${num(boSourceFiles.length)}/${num(boExpected)} ไฟล์ BO</span></div>
        <div class="bo-document-metrics"><article><span>รายการที่อ่านจาก BO</span><b>${num(bo)}</b></article><article><span>บัญชี/Provider ที่พบ</span><b>${num(boRequired.length)}</b></article><article class="${boMissing.length ? "bad" : "ok"}"><span>ยังจับคู่ STM/PM ไม่ได้</span><b>${num(boMissing.length)}</b></article><article class="${data.boFirst?.complete ? "ok" : "warn"}"><span>ผลตรวจ BO-first</span><b>${data.boFirst ? (data.boFirst.complete ? "ครบ" : "ยังไม่ครบ") : "รอผลรัน"}</b></article></div>
        <div class="bo-document-layout"><div><h3>ไฟล์ BO ต้นฉบับ</h3><div class="bo-file-list">${boFileCards || `<div class="empty-box">ยังไม่พบไฟล์ BO ของ ${h(company)} วันที่ ${h(state.dailySummary.date)}</div>`}</div></div><div><h3>บัญชี/Provider ที่ BO ระบุ</h3><div class="table-wrap compact-table"><table><thead><tr><th>ระบบ</th><th>บริษัท</th><th>บัญชี / Provider</th><th>ชื่อเต็มจาก BO</th><th>ประเภท</th><th class="right">รายการ BO</th><th class="right">ยอดรวม</th><th>STM/PM คู่กัน</th></tr></thead><tbody>${boRequirementRows || `<tr><td colspan="8" class="empty">ยังไม่มีผลอ่าน BO-first — เมื่ออ่าน BO สำเร็จ ระบบจะแสดงรายการที่ต้องตรวจตรงนี้</td></tr>`}</tbody></table></div></div></div>
        ${unmatchedReceived.length ? `<div class="bo-unmatched-received"><h3>ไฟล์ STM/PM ที่ได้รับและอ่านแล้ว แต่ยังจับกับ BO ไม่ได้</h3><div class="table-wrap compact-table"><table><thead><tr><th>ระบบ</th><th>บริษัท</th><th>บัญชี / Provider ที่อ่านได้</th><th>ประเภท</th><th class="right">รายการ</th><th>ไฟล์ต้นทาง</th></tr></thead><tbody>${unmatchedReceivedRows}</tbody></table></div></div>` : ""}
        <div class="alert ${data.boFirst?.complete ? "ok" : "warn"} bo-follow-summary"><div><strong>${data.boFirst?.complete ? "พบไฟล์คู่ครบตาม BO" : boMissing.length ? `ต้องตาม STM/PM อีก ${num(boMissing.length)} กลุ่ม` : "รออ่าน BO หรือรอผลกระทบยอด"}</strong><span>${data.boFirst?.complete ? "ระบบตรวจบัญชี/Provider และทิศทางฝาก-ถอนจาก BO แล้วพบฝั่ง STM/PM ครบ" : boMissing.length ? boMissing.map((item) => `${item.label || item.identity} ${directionLabel(item.direction)}`).join(" · ") : "ระบบจะไม่สรุปว่าขาดจากทะเบียนทั้งหมด แต่จะยึดเฉพาะสิ่งที่พบว่าใช้งานจริงใน BO ของวันนี้"}</span></div>${boMissing.length ? `<button type="button" class="primary-button sm" id="boOpenFirstFollow">เปิดรายละเอียดกลุ่มแรก</button>` : ""}</div>
      </section>

      <section class="panel company-day-checklist">
        <div class="panel-heading"><div><p class="eyebrow">สิ่งที่ต้องครบในวันนี้</p><h2>Checklist ${h(company)}</h2></div><span class="health ${!checklistReady || missing.length || data.stillOpen ? "attention" : "ok"}">${!checklistReady ? "Checklist กำลังอัปเดต" : missing.length ? `ต้องตาม ${num(missing.length)} เรื่อง` : data.stillOpen ? `รอตรวจ ${num(data.stillOpen)} เคส` : "ครบและปิดงาน"}</span></div>
        <div class="checklist-cards">
          ${[
            ["เมลและไฟล์", data.files.length > 0, `${num(data.batches.length)} เมล · ${num(data.files.length)} ไฟล์`, false],
            ["STM ของบัญชีที่พบใน BO", false, `${num(checklistStmCount)} ไฟล์ · ทะเบียนรองรับ ${num(stmRegistered)} บัญชี`, true],
            ["รายงาน BO บังคับ", checklistBoCount >= boExpected, `${num(checklistBoCount)}/${num(boExpected)} ไฟล์`, false],
            ["PM D/W ของ Provider ที่พบใน BO", false, `${num(checklistPmCount)} ไฟล์ · ทะเบียนรองรับ ${num(pmRegistered)}`, true],
            ["อ่านไฟล์สำหรับกระทบยอด", reconciliationReady, fileErrors ? `อ่านไม่ได้ ${num(fileErrors)}` : `${num(parsed)}/${num(data.reconciliationFiles.length)} สำเร็จ · หลักฐาน ${num(evidenceFiles)} ไฟล์ไม่ต้องแปลงรายการ`, false],
            ["กระทบยอดและปิดเคส", latestStatus === "completed" && data.stillOpen === 0, latestStatus === "completed" ? `จับคู่ ${num(matched)} · ค้าง ${num(data.stillOpen)}` : h(status.label), false],
          ].map(([label, ok, detail, optional]) => scheduled
            ? `<article class="optional"><i>–</i><div><b>${h(label)}</b><small>รอวันทำการ</small></div></article>`
            : `<article class="${ok ? "ok" : optional ? "optional" : "missing"}"><i>${ok ? "✓" : optional ? "–" : "!"}</i><div><b>${h(label)}</b><small>${h(detail)}${optional && !ok ? " · ข้อมูลประกอบ" : ""}</small></div></article>`).join("")}
        </div>
        ${scheduled ? `<div class="alert"><strong>เตรียม Checklist แล้ว</strong><span>ระบบจะเริ่มบันทึกสถานะอัตโนมัติเมื่อเข้าสู่วันที่ ${h(state.dailySummary.date)}</span></div>` : !checklistReady ? `<div class="alert warn"><strong>Checklist รายบัญชียังโหลดไม่ครบ</strong><span>ผลอ่านไฟล์และผลกระทบยอดด้านบนเป็นข้อมูลจริงและใช้งานได้ ระบบกำลังอัปเดตรายการบัญชีที่ต้องครบแยกต่างหาก</span></div>` : missing.length ? `<div class="alert warn"><strong>สิ่งที่ต้องตาม</strong><span>${h(missing.join(" · "))}</span></div>` : data.stillOpen ? `<div class="alert warn"><strong>ไฟล์และการกระทบยอดพร้อมแล้ว</strong><span>ยังมี ${num(data.stillOpen)} เคสที่ต้องตรวจ ชี้แจง หรืออนุมัติก่อนปิดงาน</span></div>` : `<div class="alert ok"><strong>Checklist บังคับครบและปิดงานแล้ว</strong><span>BO ครบตามระบบ ไฟล์กระทบยอดอ่านสำเร็จ และไม่มีเคสค้าง · STM/PM ตรวจเทียบกับบัญชีที่ใช้จริงของวันนี้</span></div>`}
        ${data.checklist?.registry_warning ? `<div class="alert warn registry-alert"><strong>ข้อมูลทะเบียนที่ควรยืนยัน</strong><span>${h(data.checklist.registry_warning)}</span></div>` : ""}
      </section>

      <section class="grid-2 daily-summary-grid">
        <div class="panel"><div class="panel-heading"><div><p class="eyebrow">File coverage</p><h2>ได้รับไฟล์ประเภทใดบ้าง</h2></div><span class="health ${missing.length ? "attention" : "ok"}">${missing.length ? `ยังขาด ${num(missing.length)} ประเภท` : "ครบตามกฎ"}</span></div><div class="daily-kind-list">${kindCounts.map(([label, count]) => `<div><span>${h(label)}</span><b>${num(count)} ไฟล์</b></div>`).join("") || `<p class="empty-box">ยังไม่พบไฟล์ของ ${h(company)} ในวันนี้</p>`}</div>${missing.length ? `<div class="alert warn"><strong>ไฟล์ที่ระบบยังไม่พบ</strong><span>${h(missing.join(", "))}</span><small>อาจยังไม่เข้า หรือระบบยังจำแนกบริษัท/ประเภทไม่ถูก ต้องตรวจจากรายชื่อไฟล์ด้านล่างอีกครั้ง</small></div>` : ""}</div>
        <div class="panel" id="dailyReconcileResult"><div class="panel-heading"><div><p class="eyebrow">Reconciliation result</p><h2>ผลกระทบยอด</h2></div><span class="badge ${status.tone}">${h(status.label)}</span></div><ul class="report-list compact"><li><span>รายการฝั่งฝาก-ถอน/PM (STM)</span><b>${num(stm)}</b></li><li><span>รายการฝั่ง BO</span><b>${num(bo)}</b></li><li><span>จับคู่ผ่าน 3 จุด</span><b>${num(matched)}</b></li><li><span>อัตราจับคู่</span><b>${matchRate.toFixed(2)}%</b></li><li><span>Exception</span><b>${num(data.exceptionTotal)}</b></li><li><span>มูลค่าความเสียหายที่บันทึก</span><b>${money0(damageTotal)} บาท</b></li></ul></div>
      </section>

      <section class="panel"><div class="panel-heading"><div><p class="eyebrow">Source files</p><h2>ไฟล์ที่ได้รับทั้งหมด</h2><small class="head-sub">กดชื่อไฟล์เพื่อดูตัวอย่างก่อนดาวน์โหลด · ไฟล์ชี้แจงใช้เป็นหลักฐานและไม่ต้องแปลงเป็นรายการ</small></div><span class="health ok">${num(data.files.length)} ไฟล์</span></div><div class="table-wrap daily-detail-table"><table><thead><tr><th>รับเมื่อ</th><th>หัวข้อเมล / ผู้ส่ง</th><th>ชื่อไฟล์</th><th>ประเภท</th><th class="right">แถว</th><th>สถานะ</th></tr></thead><tbody>${data.files.map((file) => {
        const evidence = file.kind === "doc_clarify";
        const fileStatus = evidence ? "evidence" : file.parse_error ? "error" : file.parsed ? "parsed" : "waiting";
        const statusHtml = evidence
          ? `<span class="badge blue">หลักฐานพร้อมตรวจ</span><small class="sub">ไม่ต้องอ่านเป็นรายการ</small>`
          : file.parse_error
            ? `<span class="badge red">อ่านไม่ได้</span><small class="sub danger">${h(file.parse_error)}</small>`
            : file.parsed
              ? `<span class="badge green">${h(parsedFileLabel(file))}</span>`
              : `<span class="badge amber">รออ่าน</span>`;
        return `<tr><td>${h(String(file.receivedAt).replace("T", " ").slice(0, 16))}</td><td><b>${h(file.batch.subject || "-")}</b><small class="sub">${h(file.batch.sender || "-")}</small></td><td><button class="file-name-link" data-storage-open="${h(file.storage_path)}" data-file-id="${h(file.id)}" data-file-name="${h(file.file_name)}" data-file-mime="${h(file.mime_type || "")}" data-file-size="${h(file.size_bytes || "")}" data-file-kind="${h(file.kind || "")}" data-file-company="${h(company)}" data-file-date="${h(state.dailySummary.date)}" data-file-status="${fileStatus}" ${file.storage_path ? "" : "disabled"}><span>${h(file.file_name)}</span><small>ดูตัวอย่าง</small></button></td><td>${h(LIVE_KIND_LABEL[file.kind] || file.kind || "ยังจำแนกไม่ได้")}</td><td class="right tnum">${evidence || file.row_count == null ? "-" : num(file.row_count)}</td><td>${statusHtml}</td></tr>`;
      }).join("") || `<tr><td colspan="6" class="empty">ยังไม่มีไฟล์ของบริษัทนี้ในวันที่เลือก</td></tr>`}</tbody></table></div></section>

      <section class="panel"><div class="panel-heading"><div><p class="eyebrow">Exception resolution</p><h2>ผลการตรวจและแก้ไขทั้งหมด</h2><small class="head-sub">แก้ไขแล้ว ${num(data.resolvedTotal)} · ยังไม่ปิด ${num(data.stillOpen)} · แสดงรายละเอียดชุดแรก ${num(data.exceptions.length)}/${num(data.exceptionTotal)}</small></div><button class="ghost-button sm" id="dailyGoExceptions">เปิดหน้าติดตามเคส</button></div><div class="table-wrap daily-detail-table"><table><thead><tr><th>เคส / เวลา</th><th>ประเภท</th><th>บัญชี</th><th class="right">ยอด BO</th><th class="right">ยอด STM</th><th class="right">ผลต่าง</th><th>ระดับ</th><th>สถานะการแก้ไข</th><th>ผู้เกี่ยวข้อง / สาเหตุ</th></tr></thead><tbody>${data.exceptions.map((row) => `<tr class="clickable" data-daily-ex="${h(row.id)}"><td><b>${h(row.id)}</b><small class="sub">${h(row.time || "-")}</small></td><td>${h(row.typeName)}</td><td>${h(row.account)}<small class="sub">${h(row.bank)} · ${h(row.direction)}</small></td><td class="right tnum">${row.systemAmount == null ? "-" : money(row.systemAmount)}</td><td class="right tnum">${row.bankAmount == null ? "-" : money(row.bankAmount)}</td><td class="right tnum danger">${money(row.amountDiff || row.riskAmount)}</td><td><span class="badge ${h(row.severity)}">${h(sevMeta(row.severity).name)}</span></td><td><span class="badge ${h(statusMeta(row.status).tone)}">${h(statusMeta(row.status).name)}</span></td><td>${h(row.employee)}<small class="sub">${h(row.cause)}</small></td></tr>`).join("") || `<tr><td colspan="9" class="empty">${data.exceptionTotal ? `ผลรันระบุ ${num(data.exceptionTotal)} Exception แต่ยังไม่มีรายละเอียดเคสที่เปิดดูได้` : "ไม่พบ Exception ของบริษัทนี้ในวันที่เลือก"}</td></tr>`}</tbody></table></div></section>`;
  }

  $("#dailySummaryDate")?.addEventListener("change", (event) => {
    state.dailySummary.date = event.target.value || DEFAULT_WORK_DATE;
    loadDailyCompanySummary(true);
  });
  $("#dailySummaryCompany")?.addEventListener("change", (event) => {
    state.dailySummary.company = event.target.value;
    loadDailyCompanySummary(true);
  });
  $("#dailySummaryRefresh")?.addEventListener("click", () => loadDailyCompanySummary(true));
  $("#dailySummaryExport")?.addEventListener("click", async () => {
    let data = dailyCompanyData(state.dailySummary.company);
    if (data.exceptionTotal > data.exceptions.length) {
      toast("กำลังดึงรายละเอียดทั้งหมดสำหรับ Export — หน้าจอยังใช้งานต่อได้");
      try {
        const rows = await Sb.currentExceptionsSummary({ from: state.dailySummary.date, to: state.dailySummary.date, company: state.dailySummary.company, limit: 5000 });
        dailyCompanyState.exceptions = (rows || []).map(mapLiveException);
        data = dailyCompanyData(state.dailySummary.company);
      } catch (error) {
        toast("ดึงรายละเอียดทั้งหมดไม่สำเร็จ จึง Export เฉพาะข้อมูลที่โหลดแล้ว: " + error.message, "warn");
      }
    }
    exportDailyCompanySummary(data);
  });
  root.querySelectorAll("[data-sheet-open]").forEach((button) => button.addEventListener("click", () => {
    state.dailySummary.company = button.dataset.sheetOpen;
    loadDailyCompanySummary(true);
  }));
  root.querySelectorAll("[data-sheet-action]").forEach((button) => button.addEventListener("click", () => {
    const company = button.dataset.sheetAction;
    const mode = button.dataset.sheetMode;
    const filters = { date: state.dailySummary.date, from: state.dailySummary.date, to: state.dailySummary.date, preset: "day", company };
    if (mode === "files") return go("cloud", { filters });
    if (mode === "issues") return go("exceptions", { filters, exFilter: { q: "", type: "ALL", severity: "ALL", status: "ACTION", sla: false } });
    if (mode === "approve") return go("approvals", { filters });
    state.dailySummary.company = company;
    loadDailyCompanySummary(true);
  }));
  $("#dailyGoExceptions")?.addEventListener("click", () => go("exceptions", { filters: { date: state.dailySummary.date, from: state.dailySummary.date, to: state.dailySummary.date, preset: "day", company: state.dailySummary.company }, exFilter: { q: "", type: "ALL", severity: "ALL", status: "ALL", sla: false } }));
  root.querySelectorAll("[data-daily-route]").forEach((button) => button.addEventListener("click", () => {
    const route = button.dataset.dailyRoute;
    const filters = { date: state.dailySummary.date, from: state.dailySummary.date, to: state.dailySummary.date, preset: "day", company: state.dailySummary.company };
    go(route, { filters, exFilter: route === "exceptions" ? { q: "", type: "ALL", severity: "ALL", status: "ALL", sla: false } : undefined });
  }));
  root.querySelectorAll("[data-action-route]").forEach((item) => item.addEventListener("click", () => {
    const route = item.dataset.actionRoute;
    const filters = { date: state.dailySummary.date, from: state.dailySummary.date, to: state.dailySummary.date, preset: "day", company: state.dailySummary.company };
    go(route, { filters, exFilter: route === "exceptions" ? { q: "", type: "ALL", severity: "ALL", status: "ALL", sla: false } : undefined });
  }));
  root.querySelectorAll("[data-scroll-daily]").forEach((item) => item.addEventListener("click", () => {
    document.getElementById(item.dataset.scrollDaily)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  root.querySelectorAll("[data-bo-follow]").forEach((button) => button.addEventListener("click", () => openBoFollowUp(button.dataset.boFollow)));
  $("#boOpenFirstFollow")?.addEventListener("click", () => {
    const first = root.querySelector(".bo-requirement-attention [data-bo-follow]");
    if (first) openBoFollowUp(first.dataset.boFollow);
  });
  bindStoredFileLinks(root);
  root.querySelectorAll("[data-daily-ex]").forEach((row) => row.addEventListener("click", () => {
    const item = (dailyCompanyState.exceptions || []).find((exception) => exception.id === row.dataset.dailyEx);
    if (item && !DB.exceptions.some((exception) => exception.id === item.id)) DB.exceptions.push(item);
    openException(row.dataset.dailyEx);
  }));
}

VIEWS["daily-summary"] = renderDailyCompanySummary;

/* =============================================================
   VIEW: Intake Control
   ============================================================= */
const liveIntakeState = { batches: null, loading: false, error: null, key: "", updatedAt: null };

async function loadLiveIntake(force = false) {
  const key = `${state.filters.from}|${state.filters.to}|${state.filters.company}`;
  if (liveIntakeState.loading || (!force && liveIntakeState.key === key && liveIntakeState.batches)) return;
  liveIntakeState.loading = true;
  liveIntakeState.error = null;
  liveIntakeState.key = key;
  render();
  try {
    liveIntakeState.batches = await Sb.batches({ from: state.filters.from, to: state.filters.to, company: state.filters.company });
    liveIntakeState.updatedAt = new Date();
  } catch (e) {
    liveIntakeState.error = e.message || "โหลดทะเบียนไฟล์จริงไม่สำเร็จ";
  }
  liveIntakeState.loading = false;
  render();
}

function intakeCompanyOf(file, batch) {
  const master = companyMaster().map((c) => c.code);
  const raw = `${file.company || ""} ${batch.company || ""} ${file.file_name || ""} ${batch.subject || ""}`.toUpperCase();
  if (/UFABET\s*7M|UFA\s*7M|(^|[^A-Z0-9])7M([^A-Z0-9]|$)/.test(raw)) return state.dataset === "production" ? "UFABET7M" : "7M";
  return master.find((code) => new RegExp(`(^|[^A-Z0-9])${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Z0-9]|$)`, "i").test(raw)) || null;
}

function intakeTypesOf(file) {
  const text = `${file.kind || ""} ${file.file_name || ""}`.toLowerCase();
  if (file.kind === "pm_statement" || /\bpm\b|autopeer|azpay|cyberplus|mypay|12pay|payment/.test(text)) return ["PM"];
  const out = [];
  const both = /ฝาก\s*[-–—/]?\s*ถอน|ถอน\s*[-–—/]?\s*ฝาก|ฝากถอน|ถอนฝาก|statement|\bstm\b/.test(text);
  if (both || /ฝาก|deposit/.test(text)) out.push("ฝาก");
  if (both || /ถอน|withdraw|\bwd\b/.test(text)) out.push("ถอน");
  if (!out.length && ["stm_pdf", "bo_main"].includes(file.kind)) out.push("ฝาก", "ถอน");
  return [...new Set(out)];
}

function renderLiveIntake(root) {
  if (!liveIntakeState.batches && !liveIntakeState.loading) loadLiveIntake();
  if (liveIntakeState.loading && !liveIntakeState.batches) {
    root.innerHTML = `<section class="panel live-loading"><span class="spinner"></span><div><h2>กำลังตรวจไฟล์จริง</h2><p class="hint">จัดกลุ่ม PM ฝาก และถอนตามบริษัท...</p></div></section>`;
    return;
  }
  if (liveIntakeState.error && !liveIntakeState.batches) {
    root.innerHTML = `<section class="panel"><div class="alert bad"><strong>โหลดไฟล์จริงไม่สำเร็จ</strong><span>${h(liveIntakeState.error)}</span><button class="ghost-button sm" id="intakeRetry">ลองใหม่</button></div></section>`;
    $("#intakeRetry")?.addEventListener("click", () => loadLiveIntake(true));
    return;
  }

  const batches = liveIntakeState.batches || [];
  const files = batches.flatMap((batch) =>
    (batch.source_files || []).map((file) => ({
      ...file,
      intakeCompany: intakeCompanyOf(file, batch),
      intakeTypes: intakeTypesOf(file),
      receivedAt: file.received_at || batch.received_at,
    })),
  );
  const typedFiles = files.filter((file) => file.intakeCompany && file.intakeTypes.length);
  const visibleTypes = state.filters.direction === "ALL" ? ["PM", "ฝาก", "ถอน"] : [state.filters.direction];
  const selectedFiles = typedFiles.filter((file) => file.intakeTypes.some((type) => visibleTypes.includes(type)));
  const companies = companyMaster().filter((company) => state.filters.company === "ALL" || company.code === state.filters.company);
  const rows = companies.map((company) => {
    const own = selectedFiles.filter((file) => file.intakeCompany === company.code);
    const counts = Object.fromEntries(["PM", "ฝาก", "ถอน"].map((type) => [type, own.filter((file) => file.intakeTypes.includes(type)).length]));
    const errors = own.filter((file) => file.parse_error).length;
    const parsed = own.filter((file) => file.parsed).length;
    const latest = own.map((file) => String(file.receivedAt || "")).sort().pop() || "";
    return { company: company.code, own, counts, errors, parsed, latest };
  });
  const foundCompanies = rows.filter((row) => row.own.length).length;
  const errors = selectedFiles.filter((file) => file.parse_error).length;
  const waitingRead = selectedFiles.filter((file) => !file.parsed && !file.parse_error).length;
  const missingCompanies = rows.length - foundCompanies;

  root.innerHTML = `
    <section class="status-strip four">
      <article><span>บริษัทที่ต้องตรวจ</span><strong>${num(rows.length)}</strong><small>${h(state.filters.company === "ALL" ? "ทะเบียนบริษัททั้งหมด" : state.filters.company)}</small></article>
      <article class="ok"><span>บริษัทที่พบไฟล์</span><strong>${num(foundCompanies)}</strong><small>จากไฟล์จริงใน Supabase</small></article>
      <article class="${waitingRead ? "warn" : "ok"}"><span>ไฟล์ PM / ฝาก / ถอน</span><strong>${num(selectedFiles.length)}</strong><small>รออ่าน ${num(waitingRead)} ไฟล์</small></article>
      <article class="${errors || missingCompanies ? "bad" : "ok"}"><span>ต้องตรวจเพิ่ม</span><strong>${num(errors + missingCompanies)}</strong><small>ไม่พบบริษัท ${num(missingCompanies)} · อ่านไม่ได้ ${num(errors)}</small></article>
    </section>

    ${
      !selectedFiles.length
        ? `<div class="alert bad"><strong>ยังไม่พบไฟล์ PM ฝาก หรือถอน</strong><span>ช่วง ${h(rangeLabel())} ยังไม่มีไฟล์ที่จำแนกเข้าบริษัทได้ กรุณาตรวจช่วงวันที่หรือเปิดคลังไฟล์จากเมล</span></div>`
        : errors || waitingRead || missingCompanies
          ? `<div class="alert bad"><strong>ยังสรุปว่าไฟล์ครบไม่ได้</strong><span>พบข้อมูลจริงแล้ว แต่ยังมีบริษัทไม่พบไฟล์ ไฟล์รออ่าน หรือไฟล์อ่านไม่สำเร็จ ต้องตรวจต่อก่อนกระทบยอด</span></div>`
          : `<div class="alert ok"><strong>ไฟล์ที่พบพร้อมตรวจ</strong><span>ไฟล์ในช่วงนี้อ่านสำเร็จแล้ว แต่ความครบถ้วนสุดท้ายให้ยืนยันจากผลกระทบยอดของแต่ละบริษัท</span></div>`
    }

    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">ข้อมูลจริงตามบริษัท</p><h2>สถานะ PM ฝาก และถอน</h2><small class="head-sub">อัปเดต ${liveIntakeState.updatedAt ? liveIntakeState.updatedAt.toLocaleString("th-TH") : "-"}</small></div>
        <div class="inline-actions"><button class="ghost-button sm" id="intakeRefresh">รีเฟรช</button><button class="primary-button sm" id="intakeCloud">เปิดคลังไฟล์</button></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>บริษัท</th>${visibleTypes.map((type) => `<th class="right">${h(type)}</th>`).join("")}<th class="right">รวมไฟล์</th><th class="right">อ่านแล้ว</th><th>รับล่าสุด</th><th>สถานะ</th></tr></thead>
        <tbody>${rows.map((row) => {
          const tone = !row.own.length ? "grey" : row.errors ? "red" : row.parsed < row.own.length ? "amber" : "green";
          const label = !row.own.length ? "ยังไม่พบไฟล์" : row.errors ? "มีไฟล์อ่านไม่ได้" : row.parsed < row.own.length ? "รออ่าน" : "พร้อมตรวจ";
          return `<tr><td><b>${h(row.company)}</b></td>${visibleTypes.map((type) => `<td class="right tnum">${num(row.counts[type])}</td>`).join("")}<td class="right tnum">${num(row.own.length)}</td><td class="right tnum">${num(row.parsed)}</td><td>${row.latest ? h(String(row.latest).replace("T", " ").slice(0, 16)) : "-"}</td><td><span class="badge ${tone}">${label}</span></td></tr>`;
        }).join("")}</tbody>
      </table></div>
      <p class="hint">จำนวนในคอลัมน์คือจำนวนไฟล์ที่ระบบจำแนกได้ ไม่ใช่จำนวนธุรกรรม; ไฟล์ชื่อ “ฝาก-ถอน” จะนับได้ทั้งฝากและถอน ส่วน PM แยกเป็นประเภทของตัวเอง</p>
    </section>`;

  $("#intakeRefresh")?.addEventListener("click", () => loadLiveIntake(true));
  $("#intakeCloud")?.addEventListener("click", () => go("cloud"));
}

VIEWS.intake = (root) => {
  if (state.dataset === "production" && Sb.signedIn()) {
    renderLiveIntake(root);
    return;
  }
  const f = state.filters;
  const files = DB.files.filter((x) => f.company === "ALL" || x.company === f.company);
  const stat = (s) => files.filter((x) => x.status === s).length;
  const statusText = { received: "รับแล้ว", missing: "ไม่ได้ส่ง", wrong_company: "ผิดบริษัท", late: "ส่งช้า" };
  const statusTone = { received: "green", missing: "red", wrong_company: "red", late: "amber" };
  const blocked = stat("missing") + stat("wrong_company");

  root.innerHTML = `
    <section class="status-strip four">
      <article><span>ไฟล์ที่ต้องได้รับ</span><strong>${files.length}</strong><small>${DB.companies.length} บริษัท × ประเภทไฟล์</small></article>
      <article class="ok"><span>รับครบถูกต้อง</span><strong>${stat("received")}</strong><small>ผ่าน quality gate</small></article>
      <article class="warn"><span>ส่งช้ากว่ากำหนด</span><strong>${stat("late")}</strong><small>รับแล้วแต่เกินเวลา 09:00</small></article>
      <article class="bad"><span>ขาด / ผิดบริษัท</span><strong>${blocked}</strong><small>ต้องแก้ก่อนเริ่ม reconcile</small></article>
    </section>

    ${
      blocked
        ? `<div class="alert bad">
        <strong>ยังเริ่ม reconcile แบบเต็มรอบไม่ได้</strong>
        <span>พบไฟล์ขาดหรือส่งผิดบริษัท ${blocked} รายการ ระบบจะไม่กระทบยอดเงียบ ๆ แต่รอจนกว่าไฟล์จะครบ แล้วจึงทำงานให้เองทันที</span>
        <button class="ghost-button sm" id="btnRemind">ส่งแจ้งเตือนผู้ส่งไฟล์</button>
      </div>`
        : `<div class="alert ok"><strong>ไฟล์ครบตามเช็คลิสต์</strong><span>ระบบกระทบยอดให้อัตโนมัติแล้วเมื่อไฟล์เข้าครบทั้งสองฝั่ง ไม่ต้องสั่งเอง</span></div>`
    }

    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Daily Checklist</p><h2>สถานะไฟล์รายบริษัท</h2></div>
        <div class="inline-actions">
          <button class="ghost-button sm" id="btnRecheck">ตรวจไฟล์ใหม่</button>
          <button class="primary-button sm" id="btnUpload">ไปหน้านำเข้าข้อมูลจริง</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>บริษัท</th><th>ประเภทไฟล์</th><th>เวลาที่รับ</th><th>จำนวนแถว</th><th>ผู้ส่ง</th><th>Checksum</th><th>สถานะ</th><th></th></tr></thead>
          <tbody>
            ${files
              .map(
                (x) => `<tr>
              <td>${h(x.companyName)}</td>
              <td>${h(x.fileType)}</td>
              <td>${h(x.receivedAt)}</td>
              <td class="tnum">${x.rows ? num(x.rows) : "-"}</td>
              <td>${h(x.sender)}</td>
              <td class="mono">${h(x.checksum)}</td>
              <td><span class="badge ${statusTone[x.status]}">${statusText[x.status]}</span></td>
              <td>${x.status === "received" ? "" : `<button class="link-btn" data-fix="${h(x.id)}">ทวงไฟล์</button>`}</td>
            </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="grid-2">
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Quality Gate</p><h2>สิ่งที่ระบบตรวจอัตโนมัติ</h2></div></div>
        <ul class="tick-list">
          <li>ไฟล์ถูกบริษัทหรือไม่ (เทียบเลขบัญชีใน master list)</li>
          <li>ประเภทไฟล์ตรงกับที่ระบุใน subject email</li>
          <li>ช่วงวันที่ในไฟล์ตรงกับวันที่ตรวจ (กันวันที่ปนจาก PM)</li>
          <li>checksum ซ้ำกับไฟล์เดิมหรือไม่ (กันส่งไฟล์เก่าซ้ำ)</li>
          <li>จำนวนแถวผิดปกติเทียบค่าเฉลี่ย 7 วัน</li>
        </ul>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Manual Review</p><h2>สิ่งที่ยังต้องใช้คนตรวจ</h2></div></div>
        <ul class="tick-list warn">
          <li>อ่านไฟล์ชี้แจงที่มีบริบทเฉพาะของหัวหน้ากะ</li>
          <li>ตัดสินว่าเคสใดเป็นความเสียหายจริง</li>
          <li>อนุมัติการแก้ไขรายการหรือการลงโทษ</li>
          <li>เคสที่ธนาคารไม่ระบุเวลา หรือข้อมูลไม่เป็น pattern</li>
        </ul>
      </div>
    </section>`;

  $("#btnRecheck")?.addEventListener("click", () => {
    logAction("recheck", "source_file", "ALL", "ตรวจความครบถ้วนไฟล์ใหม่");
    toast("ตรวจไฟล์ใหม่เสร็จ: สถานะไม่เปลี่ยนแปลง");
  });
  $("#btnUpload")?.addEventListener("click", () => go("import"));
  $("#btnRemind")?.addEventListener("click", () => {
    logAction("notify", "source_file", "missing", "ส่งแจ้งเตือนผู้ส่งไฟล์ที่ยังขาด");
    toast("ส่งแจ้งเตือนไปยังหัวหน้ากะที่เกี่ยวข้องแล้ว");
  });
  root.querySelectorAll("[data-fix]").forEach((b) =>
    b.addEventListener("click", () => {
      logAction("notify", "source_file", b.dataset.fix, "ทวงไฟล์รายรายการ");
      toast("ทวงไฟล์ " + b.dataset.fix + " แล้ว");
    }),
  );
};

/* =============================================================
   VIEW: Exceptions
   ============================================================= */
VIEWS.exceptions = (root) => {
  if (!ensureLiveOverview(root)) return;
  const query = String(state.exFilter.q || "").trim();
  const searchKey = `${query}|${state.filters.from}|${state.filters.to}|${state.filters.company}`;
  if (state.dataset === "production" && Sb.signedIn() && query) {
    loadLiveExceptionSearch(query);
    const intakeKey = `${state.filters.from}|${state.filters.to}|${state.filters.company}`;
    if ((!liveIntakeState.batches || liveIntakeState.key !== intakeKey) && !liveIntakeState.loading) loadLiveIntake();
  }
  const serverRows = query && liveExceptionSearch.key === searchKey ? liveExceptionSearch.rows : [];
  const source = [...new Map(DB.exceptions.concat(serverRows).map((row) => [row.dbId || row.id, row])).values()];
  const list = filteredExceptions(source);
  const sorted = [...list].sort((a, b) => {
    const k = state.sort.key;
    const dir = state.sort.dir === "asc" ? 1 : -1;
    const av = k === "riskAmount" ? a.riskAmount : a[k];
    const bv = k === "riskAmount" ? b.riskAmount : b[k];
    return av > bv ? dir : av < bv ? -dir : 0;
  });
  const pages = Math.max(1, Math.ceil(sorted.length / state.perPage));
  state.page = Math.min(state.page, pages);
  const rows = sorted.slice((state.page - 1) * state.perPage, state.page * state.perPage);
  const x = state.exFilter;
  const clarificationRows = liveOverviewState.clarifications || [];
  const autoClosedCount = clarificationRows.filter((row) => row.outcome === "auto_closed").length;
  const answeredCount = clarificationRows.filter((row) => row.outcome === "answered").length;
  const reviewCount = clarificationRows.filter((row) => ["ambiguous", "no_match", "error"].includes(row.outcome)).length;
  const fileMatches = query
    ? (liveIntakeState.batches || []).flatMap((batch) => (batch.source_files || []).map((file) => ({ ...file, business_date: batch.business_date, batchCompany: batch.company, subject: batch.subject }))).filter((file) => `${file.file_name} ${file.kind} ${file.company} ${file.batchCompany} ${file.subject}`.toLowerCase().includes(query.toLowerCase())).slice(0, 30)
    : [];
  const qualityRows = (liveOverviewState.quality || []).filter((row) =>
    (!state.filters.from || row.business_date >= state.filters.from)
    && (!state.filters.to || row.business_date <= state.filters.to)
    && (state.filters.company === "ALL" || row.company === state.filters.company),
  );
  const finishedRuns = qualityRows.filter((row) => !!row.run_id);
  const completedJobs = qualityRows.filter((row) => row.status === "completed").length;
  const waitingJobs = qualityRows.filter((row) => ["waiting_files", "ready", "queued", "running"].includes(row.status)).length;
  const failedJobs = qualityRows.filter((row) => row.status === "error" || Number(row.error_count || 0) > 0).length;
  const stmTotal = finishedRuns.reduce((sum, row) => sum + Number(row.stm_count || 0), 0);
  const boTotal = finishedRuns.reduce((sum, row) => sum + Number(row.bo_count || 0), 0);
  const matchedTotal = finishedRuns.reduce((sum, row) => sum + Number(row.matched || 0), 0);
  const generatedExceptionTotal = finishedRuns.reduce((sum, row) => sum + Number(row.exception_count || 0), 0);
  const qualityAvailable = Array.isArray(liveOverviewState.quality) && !liveOverviewState.coreErrors.includes("ผลกระทบยอด");
  const exceptionsAvailable = liveOverviewState.exceptionsReady;
  const resultMetric = (available, value) => available ? num(value) : "—";
  const reconMessage = liveOverviewState.loading && !qualityRows.length
    ? "กำลังตรวจสถานะงานกระทบยอดจาก Supabase"
    : !qualityAvailable
      ? "ผลกระทบยอดจริงยังโหลดไม่สำเร็จ — ยังไม่สรุปเป็นศูนย์"
    : !qualityRows.length
      ? "ยังไม่มีงานกระทบยอดในวันที่และบริษัทที่เลือก"
      : !finishedRuns.length
        ? `พบคิวงาน ${num(qualityRows.length)} งาน แต่ยังไม่มีผลรัน — เลข 0 ด้านล่างยังไม่ใช่ผลสำเร็จ`
        : `มีผลรันแล้ว ${num(finishedRuns.length)} งาน · สำเร็จ ${num(completedJobs)} · ยังรอ ${num(waitingJobs)} · ล้มเหลว ${num(failedJobs)}`;
  const overviewLoading = liveOverviewState.loading || liveOverviewState.auxiliaryLoading;

  const th = (key, label) =>
    `<th class="sortable ${state.sort.key === key ? "sorted " + state.sort.dir : ""}" data-sort="${key}">${label}</th>`;

  const auditSheetRows = rows.map((e) => {
    const hasStm = e.bankAmount !== null;
    const hasBo = e.systemAmount !== null;
    const result = hasStm && hasBo
      ? e.type === "time_diff" ? "ยอดตรง · เวลาต่าง" : e.type === "amount_diff" ? "เวลาใกล้ · ยอดต่าง" : e.typeName
      : hasStm ? "ไม่พบฝั่ง BO" : "ไม่พบฝั่ง STM";
    const explanation = e.resolutionNote || (e.notes || []).at(-1)?.text || "";
    return `<tr class="clickable ${e.overSla ? "over-sla" : ""}" data-ex="${h(e.id)}">
      <td class="sheet-state"><span class="badge ${statusMeta(e.status).tone}">${h(statusMeta(e.status).name)}</span><small>${h(e.id)}</small></td>
      <td>${h(e.date)}</td><td><b>${h(e.company)}</b><small class="sub">${h(e.direction)}</small></td><td>${h(e.account)}</td>
      <td class="sheet-side ${hasStm ? "has-value" : "is-blank"}">${hasStm ? `<b>${h(e.date)} ${h(e.time)}</b><small>${h(e.bank)}</small>` : ""}</td>
      <td class="right tnum sheet-side ${hasStm ? "has-value" : "is-blank"}">${hasStm ? money(e.bankAmount) : ""}</td>
      <td class="sheet-side ${hasBo ? "has-value" : "is-blank"}">${hasBo ? `<b>${h(e.date)} ${h(e.boTime || e.time)}</b><small>${h(e.employee)}</small>` : ""}</td>
      <td class="right tnum sheet-side ${hasBo ? "has-value" : "is-blank"}">${hasBo ? money(e.systemAmount) : ""}</td>
      <td class="right tnum">${hasStm && hasBo ? `${num(e.timeDiffSec)} วิ` : ""}</td>
      <td class="right tnum ${e.amountDiff ? "danger" : ""}">${hasStm && hasBo ? money(e.amountDiff) : ""}</td>
      <td><b class="${hasStm && hasBo && !e.amountDiff && e.type !== "time_diff" ? "success" : "danger"}">${h(result)}</b><small class="sub">${h(e.typeName)}</small></td>
      <td class="sheet-explanation ${explanation ? "answered" : "waiting"}">${explanation ? h(explanation) : "<span>เว้นไว้รอชี้แจง</span>"}</td>
      <td><div class="case-actions"><button class="primary-button xs" data-case-open="${h(e.id)}">ตรวจ</button><button class="ghost-button xs" data-case-files="${h(e.id)}">ไฟล์</button>${isQuickCloseEligible(e) && can("approve") ? `<button class="primary-button xs quick-close" data-case-quick-close="${h(e.id)}">ปิดเคส</button>` : ""}</div></td>
    </tr>`;
  }).join("") || `<tr><td colspan="13" class="empty">ไม่พบรายการตามตัวกรอง</td></tr>`;

  const caseQueueRows = rows.map((e) => `<tr class="clickable ${e.overSla ? "over-sla" : ""}" data-ex="${e.id}">
    <td><b>${e.id}</b>${e.overSla ? '<span class="sla-flag" title="เกิน SLA">!</span>' : ""}</td><td class="tnum">${e.time}</td>
    <td>${h(e.account)}<small class="sub">${h(e.direction)}</small></td><td>${h(e.typeName)}</td>
    <td class="right tnum">${e.systemAmount === null ? '<span class="muted">—</span>' : money(e.systemAmount)}</td>
    <td class="right tnum">${e.bankAmount === null ? '<span class="muted">—</span>' : money(e.bankAmount)}</td>
    <td class="right tnum">${diffLabel(e)}${e.riskAmount ? `<small class="sub">ตรวจ ${money(e.riskAmount)}</small>` : ""}</td>
    <td><span class="badge ${e.severity}">${h(sevMeta(e.severity).name)}</span></td>
    <td>${h(e.employee)}<small class="sub">${h((DB.shifts.find((s) => s.code === e.shift) || {}).name || e.shift || "-")}</small></td>
    <td><span class="badge ${statusMeta(e.status).tone}">${h(statusMeta(e.status).name)}</span></td>
    <td><div class="case-actions"><button class="primary-button xs" data-case-open="${h(e.id)}">ตรวจเคส</button><button class="ghost-button xs" data-case-files="${h(e.id)}">ดูไฟล์</button></div></td>
  </tr>`).join("") || `<tr><td colspan="11" class="empty">ไม่พบรายการตามตัวกรอง</td></tr>`;

  root.innerHTML = `
    ${overviewLoading ? `<section class="recon-loading-banner" role="status" aria-live="polite"><span class="spinner"></span><div><b>กำลังโหลดข้อมูลจริง…</b><small>${liveOverviewState.loading ? "กำลังอ่านผลกระทบยอดและรายการผิดปกติจาก Supabase" : "ข้อมูลหลักมาแล้ว กำลังเติมรายละเอียดไฟล์และสถานะล่าสุด"}</small></div><span class="recon-loading-pulse" aria-hidden="true"></span></section>` : ""}
    <section class="panel recon-result-summary">
      <div class="panel-heading"><div><p class="eyebrow">ผลกระทบยอดในช่วงที่เลือก</p><h2>${h(reconMessage)}</h2><small class="head-sub">ช่วง ${h(state.filters.from)} ถึง ${h(state.filters.to)} · ${state.filters.company === "ALL" ? "ทุกบริษัท" : h(state.filters.company)}</small></div><button class="primary-button sm" id="openDailyResult">เปิดสรุป 1 บริษัท/วัน</button></div>
      <div class="recon-kpi-grid">
        <article class="recon-kpi run"><span>งานที่ประมวลผลแล้ว</span><strong>${resultMetric(qualityAvailable, finishedRuns.length)}<small> / ${qualityAvailable ? num(qualityRows.length) : "—"} งาน</small></strong><p>${qualityAvailable ? `สำเร็จ ${num(completedJobs)} · รอ ${num(waitingJobs)} · ล้มเหลว ${num(failedJobs)}` : "กำลังรอข้อมูลจริง"}</p></article>
        <article class="recon-kpi"><span>รายการ STM / PM</span><strong>${resultMetric(qualityAvailable, stmTotal)}</strong><p>ข้อมูลฝากและถอนที่ระบบอ่านได้</p></article>
        <article class="recon-kpi"><span>รายการ BO</span><strong>${resultMetric(qualityAvailable, boTotal)}</strong><p>ข้อมูลรายการจากระบบหลังบ้าน</p></article>
        <article class="recon-kpi match"><span>จับคู่สำเร็จ</span><strong>${resultMetric(qualityAvailable, matchedTotal)}</strong><p>${qualityAvailable ? `${stmTotal ? ((matchedTotal / stmTotal) * 100).toFixed(2) : "0.00"}% ของรายการ STM / PM` : "กำลังรอข้อมูลจริง"}</p></article>
      </div>
      <div class="recon-work-grid">
        <button type="button" class="warn" data-action-route="exceptions"><i>${resultMetric(exceptionsAvailable, sorted.length)}</i><span><b>รายการรอตรวจ</b><small>${qualityAvailable ? `สร้างจากผลรัน ${num(generatedExceptionTotal)} รายการ` : "กำลังรอข้อมูลจริง"}</small></span><em>ดูรายการด้านล่าง ↓</em></button>
        <button type="button" class="amber" data-action-route="clarify"><i>${num(answeredCount)}</i><span><b>รอ Audit อนุมัติ</b><small>มีคำชี้แจงหรือหลักฐานแล้ว</small></span><em>เปิดตรวจ →</em></button>
        <button type="button" class="red" data-action-route="clarify"><i>${num(reviewCount)}</i><span><b>ต้องให้คุณตรวจ</b><small>ข้อมูลกำกวมหรือไฟล์อ่านไม่ได้</small></span><em>ดำเนินการ →</em></button>
        <button type="button" class="green" data-action-route="daily-summary"><i>${num(autoClosedCount)}</i><span><b>ปิดเคสอัตโนมัติ</b><small>ยืนยันจากไฟล์ชี้แจงสำเร็จ</small></span><em>ดูสรุป →</em></button>
      </div>
    </section>
    <section class="panel">
      <div class="toolbar">
        <input type="search" id="exSearch" placeholder="ค้นหาเคส บัญชี บริษัท สมาชิก หรือ Provider เช่น 12PAY..." value="${h(x.q)}" />
        <select id="exType">
          <option value="ALL">ทุกประเภท</option>
          ${allExceptionTypes().map((t) => `<option value="${t.code}" ${x.type === t.code ? "selected" : ""}>${h(t.name)}</option>`).join("")}
        </select>
        <select id="exSeverity">
          <option value="ALL">ทุกระดับ</option>
          ${DB.severities.map((s) => `<option value="${s.code}" ${x.severity === s.code ? "selected" : ""}>${h(s.name)}</option>`).join("")}
        </select>
        <select id="exStatus">
          <option value="ACTION" ${x.status === "ACTION" ? "selected" : ""}>เฉพาะเรื่องที่ยังต้องดู</option>
          <option value="ALL">ทุกสถานะ</option>
          ${DB.statuses.map((s) => `<option value="${s.code}" ${x.status === s.code ? "selected" : ""}>${h(s.name)}</option>`).join("")}
        </select>
        <label class="chk"><input type="checkbox" id="exSla" ${x.sla ? "checked" : ""} /> เฉพาะที่เลย SLA</label>
        <button class="ghost-button sm" id="exReset">ล้างตัวกรอง</button>
      </div>

      <div class="result-line">
        พบ <b>${num(sorted.length)}</b> รายการ · ยอดที่ต้องตรวจรวม <b>${money0(sumRisk(sorted))}</b> บาท
        · เกิน SLA <b class="danger">${num(sorted.filter((e) => e.overSla).length)}</b>
        ${query ? ` · ค้นจาก Supabase โดยตรง ${liveExceptionSearch.loading ? '<span class="badge blue">กำลังค้นหา...</span>' : liveExceptionSearch.error ? `<span class="badge red">${h(liveExceptionSearch.error)}</span>` : '<span class="badge green">ค้นแล้ว</span>'}` : ""}
      </div>

      <div class="audit-view-bar">
        <div><b>รูปแบบการตรวจ</b><span>${state.exceptionView === "sheet" ? "ตารางรวมเหมือน Excel — ช่องว่างคือยังไม่พบคู่และต้องรอชี้แจง" : "คิวเคสสำหรับติดตาม SLA หลักฐาน และการอนุมัติ"}</span></div>
        <div class="audit-view-switch" role="group" aria-label="เลือกรูปแบบการตรวจ">
          <button type="button" class="${state.exceptionView === "sheet" ? "active" : ""}" data-ex-view="sheet">ตารางกระทบยอด</button>
          <button type="button" class="${state.exceptionView === "cases" ? "active" : ""}" data-ex-view="cases">คิวเคส</button>
        </div>
      </div>

      ${query && fileMatches.length ? `<div class="related-files"><div><b>พบไฟล์ต้นฉบับที่เกี่ยวข้อง ${num(fileMatches.length)} ไฟล์</b><small>${sorted.length ? "แสดงทั้ง Exception และไฟล์หลักฐาน" : "ไม่พบ Exception แต่พบไฟล์จริง — เปิดไฟล์เพื่อตรวจสอบได้"}</small></div><div class="related-file-list">${fileMatches.map((file) => `<button class="file-result" data-storage-open="${h(file.storage_path)}" data-file-id="${h(file.id)}" data-file-name="${h(file.file_name)}" data-file-mime="${h(file.mime_type || "")}" data-file-size="${h(file.size_bytes || "")}" data-file-kind="${h(file.kind || "")}" data-file-company="${h(file.batchCompany || file.company || "")}" data-file-date="${h(file.business_date || "")}" data-file-status="${file.parse_error ? "error" : file.parsed ? "parsed" : "waiting"}"><span>${h(file.file_name)}</span><small>${h(file.batchCompany || file.company || "ไม่ระบุบริษัท")} · ${h(file.business_date || "-")} · ${file.parsed ? "พร้อมใช้งาน" : file.parse_error ? "อ่านไม่ได้" : "รอตรวจ"}</small></button>`).join("")}</div></div>` : ""}

      ${query && !sorted.length && !fileMatches.length && !liveExceptionSearch.loading && !liveIntakeState.loading ? `<div class="search-empty-help"><b>ไม่พบ “${h(query)}” ในช่วงและบริษัทที่เลือก</b><span>ลองล้างตัวกรองบริษัท/ประเภท หรือขยายช่วงวันที่ หากต้องการดูไฟล์ทั้งหมดให้ไปที่ “ไฟล์และสถานะ”</span><button class="ghost-button sm" id="searchGoFiles">เปิดไฟล์และสถานะ</button></div>` : ""}

      <div class="table-wrap ${state.exceptionView === "sheet" ? "reconciliation-sheet-wrap" : ""}">
        ${state.exceptionView === "sheet" ? `<table class="rows reconciliation-sheet">
          <thead><tr><th rowspan="2">สถานะ</th><th rowspan="2">วันที่</th><th rowspan="2">บริษัท</th><th rowspan="2">บัญชี / Provider</th><th colspan="2" class="sheet-group stm">ฝั่ง STM / ธนาคาร</th><th colspan="2" class="sheet-group bo">ฝั่ง BO / ระบบ</th><th rowspan="2" class="right">ต่างเวลา</th><th rowspan="2" class="right">ต่างยอด</th><th rowspan="2">ผลการจับคู่</th><th rowspan="2">คำชี้แจง / หมายเหตุ</th><th rowspan="2">ทำรายการ</th></tr><tr><th>วันที่ / เวลา</th><th class="right">ยอด</th><th>วันที่ / เวลา</th><th class="right">ยอด</th></tr></thead><tbody>${auditSheetRows}</tbody>
        </table>` : `<table class="rows"><thead><tr>${th("id", "เคส")}${th("time", "เวลา")}<th>บัญชี</th>${th("typeName", "ประเภท")}<th class="right">ยอด BO</th><th class="right">ยอด STM</th>${th("riskAmount", "ผลต่าง / ยอดที่ต้องตรวจ")}${th("severity", "ระดับ")}<th>ผู้เกี่ยวข้อง</th>${th("status", "สถานะ")}<th class="center">ดำเนินการ</th></tr></thead><tbody>${caseQueueRows}</tbody></table>`}
      </div>

      <div class="pager">
        <button class="ghost-button sm" id="pgPrev" ${state.page === 1 ? "disabled" : ""}>ก่อนหน้า</button>
        <span>หน้า ${state.page} / ${pages}</span>
        <button class="ghost-button sm" id="pgNext" ${state.page === pages ? "disabled" : ""}>ถัดไป</button>
        <span class="grow"></span>
        <button class="ghost-button sm" id="exExport">Export รายการนี้</button>
      </div>
    </section>`;

  const rerender = () => {
    state.page = 1;
    render();
  };
  $("#openDailyResult")?.addEventListener("click", () => {
    state.dailySummary.date = state.filters.date || state.filters.to || DEFAULT_WORK_DATE;
    if (state.filters.company !== "ALL") state.dailySummary.company = state.filters.company;
    go("daily-summary");
  });
  $("#exSearch").addEventListener("input", (e) => {
    state.exFilter.q = e.target.value;
    clearTimeout(window.__q);
    window.__q = setTimeout(() => {
      const pos = e.target.selectionStart;
      rerender();
      const el = $("#exSearch");
      el.focus();
      el.setSelectionRange(pos, pos);
    }, 260);
  });
  $("#exType").addEventListener("change", (e) => ((state.exFilter.type = e.target.value), rerender()));
  $("#exSeverity").addEventListener("change", (e) => ((state.exFilter.severity = e.target.value), rerender()));
  $("#exStatus").addEventListener("change", (e) => ((state.exFilter.status = e.target.value), rerender()));
  $("#exSla").addEventListener("change", (e) => ((state.exFilter.sla = e.target.checked), rerender()));
  $("#exReset").addEventListener("click", () => {
    state.exFilter = { q: "", type: "ALL", severity: "ALL", status: "ACTION", sla: false };
    rerender();
  });
  $("#pgPrev").addEventListener("click", () => ((state.page = Math.max(1, state.page - 1)), render()));
  $("#pgNext").addEventListener("click", () => ((state.page = Math.min(pages, state.page + 1)), render()));
  $("#exExport").addEventListener("click", () => exportSheets("รายการผิดปกติ", [SHEET_BUILDERS.exceptions.build()]));
  root.querySelectorAll("[data-ex-view]").forEach((button) => button.addEventListener("click", () => {
    state.exceptionView = button.dataset.exView;
    render();
  }));
  $("#searchGoFiles")?.addEventListener("click", () => go("cloud"));
  root.querySelectorAll("[data-action-route]").forEach((item) => item.addEventListener("click", () => go(item.dataset.actionRoute)));
  bindStoredFileLinks(root);
  root.querySelectorAll("th[data-sort]").forEach((thEl) =>
    thEl.addEventListener("click", () => {
      const k = thEl.dataset.sort;
      state.sort = { key: k, dir: state.sort.key === k && state.sort.dir === "asc" ? "desc" : "asc" };
      render();
    }),
  );
  root.querySelectorAll("tr[data-ex]").forEach((tr) => tr.addEventListener("click", () => openException(tr.dataset.ex)));
  root.querySelectorAll("[data-case-open]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openException(button.dataset.caseOpen);
  }));
  root.querySelectorAll("[data-case-files]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openException(button.dataset.caseFiles, { focusFiles: true });
  }));
  root.querySelectorAll("[data-case-quick-close]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const exception = DB.exceptions.find((item) => item.id === button.dataset.caseQuickClose);
    if (exception) confirmQuickClose(exception);
  }));
};

/* =============================================================
   Drawer: Exception detail + evidence timeline + close checklist
   ============================================================= */
function exceptionFileAttrs(file, e) {
  return `data-storage-open="${h(file.storage_path || "")}" data-file-id="${h(file.id || "")}" data-file-name="${h(file.file_name || "ไฟล์ต้นฉบับ")}" data-file-mime="${h(file.mime_type || "")}" data-file-size="${h(file.size_bytes || "")}" data-file-kind="${h(file.kind || "")}" data-file-company="${h(file.company || e.company || "")}" data-file-date="${h(e.date || "")}" data-file-status="${file.parse_error ? "error" : file.parsed ? "parsed" : "waiting"}"`;
}

function exceptionFilesMarkup(files, e) {
  if (!files.length) return `<div class="case-files-empty"><b>ยังไม่พบไฟล์ที่ผูกกับผลรันนี้</b><span>ใช้ปุ่ม “ดูไฟล์และสถานะทั้งหมด” เพื่อตรวจไฟล์ของบริษัทและวันที่เดียวกัน</span><button class="ghost-button sm" id="caseGoAllFiles">ดูไฟล์และสถานะทั้งหมด</button></div>`;
  return `<div class="case-file-list">${files.map((file) => {
    const extension = String(file.file_name || "FILE").split(".").pop().toUpperCase().slice(0, 4);
    const status = file.parsed ? "อ่านสำเร็จ" : file.parse_error ? "อ่านไม่ได้" : "รอประมวลผล";
    const tone = file.parsed ? "ok" : file.parse_error ? "bad" : "wait";
    return `<button type="button" class="case-file-row" ${exceptionFileAttrs(file, e)} ${file.storage_path ? "" : "disabled"}><span class="case-file-icon">${h(extension)}</span><span class="case-file-main"><b title="${h(file.file_name)}">${h(file.file_name)}</b><small>${h(LIVE_KIND_LABEL[file.kind] || file.kind || "ยังไม่ทราบประเภท")}</small></span><span class="case-file-state ${tone}">${status}</span><span class="case-file-open">ดูไฟล์ →</span></button>`;
  }).join("")}</div>`;
}

async function loadExceptionSupport(e, options = {}) {
  const host = $("#caseSourceFiles");
  if (!host || state.dataset !== "production" || !Sb.signedIn()) return;
  const cacheKey = `${e.runId || ""}|${e.clarificationFileId || ""}`;
  try {
    const detailPromise = e._detailLoaded || !e.dbId ? Promise.resolve(null) : Sb.exceptionDetail(e.dbId);
    const filesPromise = exceptionSupportCache.has(cacheKey)
      ? Promise.resolve(exceptionSupportCache.get(cacheKey))
      : Sb.exceptionFiles(e.runId, e.clarificationFileId).then((files) => (exceptionSupportCache.set(cacheKey, files || []), files || []));
    const [detail, files] = await Promise.all([detailPromise, filesPromise]);
    if (detail) {
      const notes = e.notes || [];
      const evidence = e.evidence || [];
      Object.assign(e, mapLiveException(detail), { notes, evidence, _detailLoaded: true });
      const stm = $("#caseRawStm");
      const bo = $("#caseRawBo");
      if (stm) stm.textContent = e.stmRaw || "— ไม่พบรายการฝั่ง STM —";
      if (bo) bo.textContent = e.boRaw || "— ไม่พบรายการฝั่ง BO —";
    }
    if (!document.body.contains(host)) return;
    host.innerHTML = exceptionFilesMarkup(files, e);
    bindStoredFileLinks(host);
    $("#caseGoAllFiles")?.addEventListener("click", () => (closeDrawer(), go("cloud", { filters: { date: e.date, from: e.date, to: e.date, company: e.company } })));
    if (options.focusFiles) setTimeout(() => host.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  } catch (error) {
    if (!document.body.contains(host)) return;
    host.innerHTML = `<div class="case-files-empty bad"><b>โหลดไฟล์ประกอบไม่สำเร็จ</b><span>${h(error.message)}</span><button class="ghost-button sm" id="caseFilesRetry">ลองใหม่</button></div>`;
    $("#caseFilesRetry")?.addEventListener("click", () => (exceptionSupportCache.delete(cacheKey), loadExceptionSupport(e, options)));
  }
}

function openException(id, options = {}) {
  const e = DB.exceptions.find((x) => x.id === id);
  if (!e) return;
  state.selected = id;
  const drawer = $("#drawer");
  const overlay = $("#drawerOverlay");
  const checklist = [
    { key: "raw", label: "โหลดข้อมูลรายการ STM / BO แล้ว", ok: !!e._detailLoaded || !!(e.stmRaw && e.stmRaw !== "—") || !!(e.boRaw && e.boRaw !== "—") },
    { key: "cause", label: "ระบุสาเหตุแล้ว", ok: !!e.cause },
    { key: "owner", label: "ระบุผู้รับผิดชอบแล้ว", ok: !!e.employee },
    { key: "evidence", label: "แนบหลักฐาน / ไฟล์ชี้แจง", ok: e.hasEvidence },
    { key: "note", label: "มี note จาก Audit", ok: e.notes.length > 0 || !!e.resolutionNote },
    { key: "amount", label: "ยอดตรงกัน หรือบันทึกความเสียหายแล้ว", ok: Number(e.riskAmount || 0) === 0 || e.status === "damage" || e.status === "approved" || e.status === "closed" },
  ];
  const quickCloseEligible = isQuickCloseEligible(e) && can("approve");
  const ready = checklist.every((c) => c.ok) || quickCloseEligible;

  drawer.innerHTML = `
    <header class="drawer-head">
      <div>
        <p class="eyebrow">${h(e.typeName)} · ${h(e.company)}</p>
        <h2 id="drawerTitle">${e.id} <span class="badge ${e.severity}">${h(sevMeta(e.severity).name)}</span> <span class="badge ${statusMeta(e.status).tone}">${h(statusMeta(e.status).name)}</span></h2>
      </div>
      <button class="icon-btn" id="drawerClose" aria-label="ปิด">✕</button>
    </header>

    <div class="drawer-body">
      <div class="case-review-flow" aria-label="ขั้นตอนตรวจเคส"><button type="button" data-case-step="summary"><i>1</i><span><b>เช็กยอดและเวลา</b><small>ดู BO เทียบ STM</small></span></button><button type="button" data-case-step="files"><i>2</i><span><b>เปิดไฟล์ประกอบ</b><small>Preview ไฟล์ที่ใช้รัน</small></span></button><button type="button" data-case-step="action"><i>3</i><span><b>เลือกผลดำเนินการ</b><small>ชี้แจง / ความเสียหาย / ปิดเคส</small></span></button></div>
      <div class="case-summary-grid" id="caseSummarySection">
        <div><span>วันที่ / เวลา</span><b>${e.date} ${e.time}</b></div>
        <div><span>บริษัท</span><b>${h(e.company || "ไม่ระบุ")}</b></div>
        <div><span>บัญชี / ทิศทาง</span><b>${h(e.account)} (${h(e.bank)}) · ${h(e.direction)}</b></div>
        <div><span>ผลต่างเวลา</span><b>${e.timeDiffSec} วินาที</b></div>
        <div><span>ยอดระบบ (BO)</span><b>${e.systemAmount === null ? "ไม่พบรายการ" : money(e.systemAmount)}</b></div>
        <div><span>ยอดธนาคาร (STM)</span><b>${e.bankAmount === null ? "ไม่พบรายการ" : money(e.bankAmount)}</b></div>
        <div><span>ผลต่าง</span><b>${diffLabel(e)}</b></div>
        <div class="case-summary-risk"><span>ยอดที่ต้องตรวจ</span><b class="danger">${e.riskAmount ? money(e.riskAmount) : "ไม่กระทบยอดเงิน"}</b></div>
      </div>
      <details class="case-meta-more"><summary>กำหนดส่งและผู้รับผิดชอบ</summary><div><span>พนักงาน <b>${h(e.employee || "ไม่ระบุ")}</b></span><span>SLA <b class="${e.overSla ? "danger" : ""}">${e.ageHours} ชม. / ${e.slaHours} ชม.</b></span><span>สายชี้แจง <b>${h(trackMeta(e.track).short)}${e.systemUnassigned ? " (ยังไม่กำหนดระบบ)" : ""}</b></span><span>กำหนดส่งคืน <b class="${e.overSla ? "danger" : ""}">${h(dueOf(e).short)}</b></span></div><p>${h(dueOf(e).detail)}</p></details>
      ${e.detail ? `<div class="rule-detail"><b>สิ่งที่ระบบตรวจพบ</b><p>${h(e.detail)}</p>${e.member ? `<small>สมาชิก ${h(e.member)}${e.memberNick ? " (" + h(e.memberNick) + ")" : ""}</small>` : ""}</div>` : ""}
      ${e.clarificationFileId ? `<div class="alert ${e.autoClosed ? "ok" : "warn"}"><strong>${e.autoClosed ? "ปิดเคสจากไฟล์ชี้แจงอัตโนมัติ" : "พบไฟล์ชี้แจงและจับคู่เคสแล้ว"}</strong><span>${h(e.resolutionNote || "มีหลักฐานจากอีเมล")} · ความมั่นใจ ${num(e.matchConfidence)}%${e.resolvedBy ? ` · โดย ${h(e.resolvedBy)}` : ""}</span></div>` : ""}

      <section class="case-source-section" id="caseFilesSection">
        <div class="case-section-head"><div><p class="eyebrow">ไฟล์ที่ใช้กระทบยอด</p><h3>ไฟล์ประกอบของเคสนี้</h3></div><button class="ghost-button sm" id="caseOpenAllFiles">ดูไฟล์ทั้งหมดของบริษัท/วัน</button></div>
        <div id="caseSourceFiles" class="case-files-loading"><span class="spinner"></span><span>กำลังหาไฟล์ STM / BO / PM ที่ใช้สร้างเคส...</span></div>
      </section>

      <h3 class="drawer-h3">ข้อมูลที่ระบบใช้ตัดสิน</h3>
      <ol class="timeline">
        <li><span class="t-dot"></span><div><b>รายการฝั่ง STM / PM</b><code id="caseRawStm">${h(e.stmRaw)}</code></div></li>
        <li><span class="t-dot"></span><div><b>รายการฝั่ง BO</b><code id="caseRawBo">${h(e.boRaw)}</code></div></li>
        <li><span class="t-dot"></span><div><b>ผลการจับคู่</b><span>${
          e.ruleBased
            ? `ตรวจด้วยกฎธุรกิจจากรายงานหลังบ้าน (ไม่ต้องใช้ statement): ${h(e.typeName)}`
            : `ไม่ผ่านเกณฑ์: ${h(e.typeName)} — tolerance ที่ใช้ ${e.direction === "ถอน" ? DB.settings.toleranceWithdraw : DB.settings.toleranceDeposit} วินาที`
        }</span></div></li>
        <li><span class="t-dot"></span><div><b>สาเหตุที่บันทึกไว้</b><span>${h(e.cause)}</span></div></li>
        ${e.hasEvidence ? `<li><span class="t-dot ok"></span><div><b>หลักฐานแนบ</b><span>สลิป / ไฟล์ชี้แจงจากหัวหน้ากะ (2 ไฟล์)</span></div></li>` : `<li><span class="t-dot bad"></span><div><b>หลักฐาน</b><span class="danger">ยังไม่มีหลักฐานแนบ</span></div></li>`}
        ${e.notes.map((n) => `<li><span class="t-dot"></span><div><b>Note โดย ${h(n.by)} · ${h(n.at)}</b><span>${h(n.text)}</span></div></li>`).join("")}
      </ol>

      <h3 class="drawer-h3">สิ่งที่ต้องครบก่อนปิดเคส</h3>
      ${quickCloseEligible ? `<p class="quick-close-hint"><b>ปิดเคสได้ทันที:</b> พบทั้ง STM และ BO/ระบบ และยอดตรงกัน ผู้ตรวจสามารถยืนยันปิดเคสได้โดยไม่ต้องรอหลักฐานเพิ่ม</p>` : ""}
      <ul class="close-check">
        ${checklist.map((c) => `<li class="${c.ok ? "ok" : "no"}"><i>${c.ok ? "✓" : "✕"}</i>${h(c.label)}</li>`).join("")}
      </ul>
      ${ready ? "" : `<p class="hint">ยังปิดเคสไม่ได้จนกว่าเช็คลิสต์จะครบ — เป็นกฎบังคับตาม Audit Improvement Notes</p>`}

      <h3 class="drawer-h3">หลักฐานแนบ</h3>
      <div class="evidence-box">
        ${
          (e.evidence || []).length
            ? `<ul class="evidence-list">${e.evidence
                .map(
                  (f) =>
                    `<li><span class="ev-ico">${f.name.match(/\.(png|jpe?g|gif|webp)$/i) ? "🖼" : "📄"}</span><div><b>${h(f.name)}</b><small>${(f.size / 1024).toFixed(0)} KB · แนบเมื่อ ${h(f.at)}</small></div>${f.url ? `<a class="link-btn" href="${f.url}" target="_blank" rel="noopener">เปิดดู</a>` : '<span class="muted">บันทึกไว้เฉพาะรายการ</span>'}</li>`,
                )
                .join("")}</ul>`
            : '<p class="muted small-note">ยังไม่มีไฟล์แนบ — ต้องแนบก่อนจึงจะปิดเคสได้</p>'
        }
        <label class="attach-btn ${can("attach") || can("note") ? "" : "locked"}">
          <input type="file" id="evInput" multiple hidden accept="image/*,.pdf,.csv,.xlsx,.txt" />
          แนบสลิป / ไฟล์ชี้แจง
        </label>
      </div>

      <h3 class="drawer-h3">เพิ่ม Note (ลบข้อมูลเดิมไม่ได้)</h3>
      <div class="note-form">
        <textarea id="noteText" rows="3" placeholder="บันทึกสิ่งที่ตรวจพบ..."></textarea>
        <button class="ghost-button" id="btnNote">บันทึก Note</button>
      </div>
    </div>

    <footer class="drawer-foot" id="caseActionSection">
      <div class="drawer-next"><span>ขั้นตอนถัดไป</span><b>${quickCloseEligible ? "ยอดสองฝั่งตรงกัน — ยืนยันเพื่อปิดเคสได้" : !e.hasEvidence ? "เปิดไฟล์ แล้วขอชี้แจงหรือแนบหลักฐาน" : !ready ? `ทำเช็กลิสต์ให้ครบอีก ${num(checklist.filter((item) => !item.ok).length)} ข้อ` : "หลักฐานครบ — พร้อมอนุมัติและปิดเคส"}</b></div>
      <div class="drawer-primary-actions"><button class="ghost-button" id="btnJumpFiles">ดูไฟล์ประกอบ</button><button class="ghost-button" id="btnAttachQuick">แนบหลักฐาน</button><button class="ghost-button" id="btnClarify">ส่งขอชี้แจง</button><button class="primary-button" id="btnApprove" ${ready ? "" : "disabled"}>${quickCloseEligible ? "ยืนยันยอดตรงและปิดเคส" : ready ? "อนุมัติและปิดเคส" : "ยังปิดไม่ได้"}</button></div>
      <details class="drawer-more-actions"><summary>เอกสารและการดำเนินการอื่น</summary><div><button class="ghost-button" id="btnDocReq">ใบขอให้ชี้แจง (PDF)</button><button class="ghost-button" id="btnDocClr">เอกสารชี้แจง (PDF)</button><button class="ghost-button" id="btnRespond">ตอบชี้แจง + แนบหลักฐาน</button><button class="ghost-button" id="btnDamage">บันทึกเป็นความเสียหาย</button></div></details>
    </footer>`;

  drawer.hidden = false;
  overlay.hidden = false;
  requestAnimationFrame(() => drawer.classList.add("on"));

  $("#drawerClose").addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer, { once: true });
  $("#btnJumpFiles").addEventListener("click", () => $("#caseFilesSection")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  $("#btnAttachQuick").addEventListener("click", () => $("#evInput")?.click());
  $("#caseOpenAllFiles").addEventListener("click", () => (closeDrawer(), go("cloud", { filters: { date: e.date, from: e.date, to: e.date, company: e.company } })));
  drawer.querySelectorAll("[data-case-step]").forEach((button) => button.addEventListener("click", () => {
    const target = button.dataset.caseStep === "files" ? $("#caseFilesSection") : button.dataset.caseStep === "action" ? $("#caseActionSection") : $("#caseSummarySection");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  loadExceptionSupport(e, options);

  $("#evInput").addEventListener("change", (evt) => {
    if (!can("attach") && !can("note")) return deny("แนบหลักฐาน");
    const files = [...evt.target.files];
    if (!files.length) return;
    e.evidence = e.evidence || [];
    files.forEach((f) => e.evidence.push({ name: f.name, size: f.size, at: nowStamp(), url: URL.createObjectURL(f) }));
    e.hasEvidence = true;
    logAction("attach", "evidence", e.id, `แนบไฟล์ ${files.map((f) => f.name).join(", ")}`);
    saveOverride(e);
    toast(`แนบหลักฐาน ${files.length} ไฟล์แล้ว`);
    openException(id);
  });

  $("#btnNote").addEventListener("click", () => {
    if (!can("note")) return deny("เพิ่ม note");
    const txt = $("#noteText").value.trim();
    if (!txt) return toast("กรุณาพิมพ์ note ก่อน", "warn");
    e.notes.push({ by: currentUser().username, at: nowStamp(), text: txt });
    logAction("note", "exception", e.id, "เพิ่ม note: " + txt.slice(0, 60));
    saveOverride(e);
    toast("บันทึก note แล้ว");
    openException(id);
  });
  $("#btnDocReq").addEventListener("click", () => {
    const d = dueOf(e);
    issueRequestDoc([e], {
      key: e.id,
      shiftName: (DB.shifts.find((s) => s.code === e.shift) || {}).name || e.shift,
      toName: (DB.users.find((u) => u.role === "shift_lead" && u.shift === e.shift) || {}).name,
      periodLabel: `วันที่ ${e.date} · เคส ${e.id}`,
    });
  });
  $("#btnDocClr").addEventListener("click", () =>
    issueClarificationDoc(e, ($("#noteText").value || "").trim() || (e.notes || []).map((n) => n.text).join("\n")),
  );

  $("#btnClarify").addEventListener("click", () => {
    if (!can("request_clarify")) return deny("ส่งชี้แจง");
    e.status = "clarifying";
    logAction("request_clarify", "exception", e.id, "ส่งให้ผู้ดูแลบริษัท " + e.company + " ชี้แจง");
    saveOverride(e);
    toast("ส่งให้ผู้ดูแลบริษัทชี้แจงแล้ว");
    openException(id);
    renderNav();
  });
  $("#btnRespond").addEventListener("click", () => {
    if (!can("respond")) return deny("ตอบชี้แจง");
    e.status = "answered";
    e.hasEvidence = true;
    logAction("respond", "clarification", e.id, "ตอบชี้แจงและแนบหลักฐาน");
    saveOverride(e);
    toast("ตอบชี้แจงและแนบหลักฐานแล้ว");
    openException(id);
    renderNav();
  });
  $("#btnDamage").addEventListener("click", async () => {
    if (!can("close_case")) return deny("บันทึกความเสียหาย");
    if (!e.hasEvidence) return toast("ต้องมีหลักฐานก่อนบันทึกเป็นความเสียหาย", "warn");
    if (e.status !== "damage") {
      const previousStatus = e.status;
      e.status = "damage";
      const damage = {
        id: "DMG-" + (900 + DB.damages.length),
        exceptionId: e.id,
        date: e.date,
        company: e.company,
        employee: e.employee,
        shift: e.shift,
        amount: e.riskAmount || Math.abs(e.amountDiff),
        cause: e.cause,
        cycle: "C1",
        evidence: true,
        hrStatus: "ส่งบุคคลแล้ว",
        financeStatus: "รอปิดรอบ",
      };
      DB.damages.push(damage);
      if (state.dataset === "production" && Sb.signedIn()) {
        try {
          const rows = await Sb.post("damages", [{
            code: damage.id,
            exception_id: e.dbId || null,
            business_date: damage.date,
            company: damage.company,
            employee: damage.employee,
            shift: e.shift || null,
            amount: damage.amount,
            currency: e.currency || "THB",
            fx_rate: e.fxRate || null,
            amount_thb: damage.amount,
            cause: damage.cause,
            cycle: damage.cycle,
            has_evidence: damage.evidence,
            hr_status: damage.hrStatus,
            finance_status: damage.financeStatus,
          }]);
          if (rows?.[0]) damage.dbId = rows[0].id;
          saveOverride(e);
          logAction("damage", "damage_record", e.id, "บันทึกความเสียหาย " + money(damage.amount) + " บาท");
          await loadLiveDamage(true);
          loadLiveOverview(true);
          toast("บันทึกเข้าทะเบียนความเสียหายแล้ว");
        } catch (err) {
          e.status = previousStatus;
          DB.damages = DB.damages.filter((row) => row !== damage);
          toast("บันทึก Supabase ไม่สำเร็จ: " + err.message, "warn");
          openException(id);
          return;
        }
      } else {
        Store.data.extraDamages.push(damage);
        saveOverride(e);
        logAction("damage", "damage_record", e.id, "บันทึกความเสียหาย " + money(damage.amount) + " บาท");
        toast("บันทึกเข้าทะเบียนความเสียหายแล้ว");
      }
    }
    openException(id);
  });
  $("#btnApprove").addEventListener("click", () => {
    if (!can("approve")) return deny("อนุมัติ/ปิดเคส");
    if (quickCloseEligible) return confirmQuickClose(e);
    if (!ready) return toast("เช็คลิสต์ยังไม่ครบ ปิดเคสไม่ได้", "warn");
    e.status = "closed";
    logAction("approve", "exception", e.id, "อนุมัติและปิดเคส");
    saveOverride(e);
    toast("อนุมัติและปิดเคส " + e.id + " แล้ว");
    closeDrawer();
    render();
  });

  const gate = { btnNote: "note", btnClarify: "request_clarify", btnRespond: "respond", btnDamage: "close_case", btnApprove: "approve", btnDocReq: "request_clarify" };
  Object.entries(gate).forEach(([btn, cap]) => {
    const el = $("#" + btn);
    if (!can(cap)) {
      el.classList.add("locked");
      el.title = `ต้องมีสิทธิ์: ${cap} (บทบาทปัจจุบัน ${DB.roles[state.role].name} ไม่มีสิทธิ์นี้)`;
    }
  });
}
function closeDrawer() {
  const d = $("#drawer");
  if (!d || d.hidden) return;
  d.classList.remove("on");
  $("#drawerOverlay").hidden = true;
  setTimeout(() => (d.hidden = true), 220);
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeDrawer();
    closeModal();
  }
});

/* =============================================================
   VIEW: 3-Point Match
   ============================================================= */
VIEWS.matching = (root) => {
  if (!ensureLiveOverview(root)) return;
  const ruleEditable = can("rules") && state.dataset !== "production";
  const list = scopedExceptions().filter((e) => e.type !== "missing_stm");
  if (!list.length) {
    root.innerHTML = `<div class="panel"><p class="empty">ไม่มีรายการให้ตรวจในตัวกรองนี้</p></div>`;
    return;
  }
  state.matchIndex = Math.min(state.matchIndex, list.length - 1);
  const e = list[state.matchIndex];
  const tol = e.direction === "ถอน" ? DB.settings.toleranceWithdraw : DB.settings.toleranceDeposit;
  const bankRule = (DB.banks.find((bank) => bank.code === e.bank) || {}).rule || "ใช้กฎมาตรฐานจากข้อมูลที่มีในไฟล์";
  const ruleBreach = {
    duplicate: "พบรายการยอดเดียวกันซ้ำในฝั่ง BO — เข้าเงื่อนไขเติมซ้ำ",
    backdated: "รายการถูกบันทึกย้อนหลังหลังปิดยอดของช่วงเวลานั้น",
    cross_day: "อยู่ในช่วง 23:00-23:59 ต้องตรวจร่วมกับไฟล์ของวันถัดไป",
    wrong_bank: "ธนาคารปลายทางไม่ตรงกับที่ระบุในรายการ BO",
    wrong_account: "บัญชีปลายทางไม่อยู่ใน master list ของบริษัท",
    unexplained_out: "ยอดโอนออกยังไม่มีไฟล์ชี้แจงประกอบ",
    missing_bo: "มีรายการฝั่ง STM แต่ไม่พบฝั่ง BO",
    missing_stm: "มีรายการฝั่ง BO แต่ไม่พบฝั่ง STM",
  };
  const checks = [
    { name: "Bank Account", ok: true, detail: `${e.account} ตรงกับ master list ของ ${e.company}` },
    { name: "Time Window", ok: e.timeDiffSec <= tol, detail: `ต่างกัน ${e.timeDiffSec} วินาที · tolerance ${tol} วินาที` },
    {
      name: "Amount",
      ok: e.bankAmount !== null && e.systemAmount !== null && Math.abs(e.amountDiff) < DB.settings.diffAlert,
      detail:
        e.bankAmount === null
          ? "ไม่พบรายการฝั่ง STM (BO มากกว่า STM)"
          : e.systemAmount === null
            ? "ไม่พบรายการฝั่ง BO (STM มากกว่า BO)"
            : `ต่างกัน ${money(Math.abs(e.amountDiff))} บาท · เกณฑ์แจ้งเตือน ${DB.settings.diffAlert} บาท`,
    },
  ];
  checks.push({
    name: "Business Rule",
    ok: !ruleBreach[e.type],
    detail: ruleBreach[e.type] || "ผ่านกฎธนาคารและกฎธุรกิจเพิ่มเติมทั้งหมด",
  });
  const passed = checks.filter((c) => c.ok).length;

  root.innerHTML = `
    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">รายการที่ ${state.matchIndex + 1} จาก ${list.length}</p><h2>${e.id} · ${h(e.typeName)}</h2></div>
        <div class="inline-actions">
          <button class="ghost-button sm" id="mPrev" ${state.matchIndex === 0 ? "disabled" : ""}>← ก่อนหน้า</button>
          <button class="ghost-button sm" id="mNext" ${state.matchIndex === list.length - 1 ? "disabled" : ""}>ถัดไป →</button>
          <button class="primary-button sm" id="mOpen">เปิดรายละเอียดเต็ม</button>
        </div>
      </div>

      <div class="match-score ${passed === 4 ? "ok" : passed === 3 ? "warn" : "bad"}">
        <strong>${passed}/4</strong><span>เกณฑ์ที่ผ่าน — 3 จุดหลัก (account / time / amount) และกฎธุรกิจเพิ่มเติม</span>
      </div>

      <div class="match-3">
        ${checks
          .map(
            (c) => `<div class="match-card ${c.ok ? "ok" : "bad"}">
          <i>${c.ok ? "✓" : "✕"}</i>
          <strong>${h(c.name)}</strong>
          <span>${h(c.detail)}</span>
        </div>`,
          )
          .join("")}
      </div>

      <div class="compare">
        <div class="compare-col">
          <h3>ฝั่งธนาคาร (STM)</h3>
          <code>${h(e.stmRaw)}</code>
          <div class="kv-line"><span>เวลา</span><b>${e.bankAmount === null ? "-" : e.time}</b></div>
          <div class="kv-line"><span>ยอด</span><b>${e.bankAmount === null ? "-" : money(e.bankAmount)}</b></div>
          <div class="kv-line"><span>กฎที่ใช้</span><b>${h(bankRule)}</b></div>
        </div>
        <div class="compare-mid"><span>เทียบกับ</span></div>
        <div class="compare-col">
          <h3>ฝั่งระบบหลังบ้าน (BO)</h3>
          <code>${h(e.boRaw)}</code>
          <div class="kv-line"><span>เวลา</span><b>${e.systemAmount === null ? "-" : h(e.boTime || e.time || "-")}</b></div>
          <div class="kv-line"><span>ยอด</span><b>${e.systemAmount === null ? "ไม่พบรายการ" : money(e.systemAmount)}</b></div>
          <div class="kv-line"><span>ผู้ทำรายการ</span><b>${h(e.employee)}</b></div>
        </div>
      </div>
    </section>

    <section class="grid-2">
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Tolerance</p><h2>เกณฑ์จับคู่ที่ใช้งานอยู่</h2></div><span class="health ${ruleEditable ? "ok" : "attention"}">${ruleEditable ? "แก้ไขได้" : "ค่าที่ deploy · อ่านอย่างเดียว"}</span></div>
        <div class="setting-list">
          <label><span>Time tolerance ฝาก</span><input type="number" id="tolD" value="${DB.settings.toleranceDeposit}" ${ruleEditable ? "" : "disabled"} /><b>วินาที</b></label>
          <label><span>Time tolerance ถอน</span><input type="number" id="tolW" value="${DB.settings.toleranceWithdraw}" ${ruleEditable ? "" : "disabled"} /><b>วินาที</b></label>
          <label><span>คู่ยอดตรงที่ไม่กำกวม</span><input type="number" value="${DB.settings.exactUniqueTolerance || 600}" disabled /><b>วินาที</b></label>
          <label><span>ยอด Diff ที่ต้องแจ้งเตือน</span><input type="number" id="tolA" value="${DB.settings.diffAlert}" ${ruleEditable ? "" : "disabled"} /><b>บาท</b></label>
        </div>
        <button class="primary-button" id="tolSave" ${ruleEditable ? "" : "disabled"}>บันทึกและคำนวณผลใหม่</button>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">ลำดับการจับคู่</p><h2>ระบบทำอะไรบ้าง</h2></div></div>
        <ol class="step-list">
          <li>เลือก business date และ company</li>
          <li>ตรวจ source file completeness (quality gate)</li>
          <li>Normalize STM และ BO เป็น schema เดียวกัน</li>
          <li>Apply bank rule (X1/X2/XB, ยอดยกมา, รอบวันที่)</li>
          <li>สร้าง candidate จาก account + amount</li>
          <li>คำนวณ time difference และให้คะแนน</li>
          <li>ถ้าบัญชี/Provider + ฝาก–ถอน + ยอดตรง และมีผู้สมัครเพียงคู่เดียว ระบบจับให้อัตโนมัติได้ถึง ${num(DB.settings.exactUniqueTolerance || 600)} วินาที</li>
          <li>ถ้ามียอดซ้ำหลายรายการ ระบบไม่เดาคู่และยังส่งให้ Audit ตรวจ</li>
          <li>ผ่าน threshold = matched, ไม่ผ่าน = exception</li>
          <li>ส่ง exception เข้า workflow ชี้แจง</li>
        </ol>
      </div>
    </section>`;

  $("#mPrev").addEventListener("click", () => ((state.matchIndex = Math.max(0, state.matchIndex - 1)), render()));
  $("#mNext").addEventListener("click", () => ((state.matchIndex = Math.min(list.length - 1, state.matchIndex + 1)), render()));
  $("#mOpen").addEventListener("click", () => openException(e.id));
  $("#tolSave").addEventListener("click", () => {
      if (!ruleEditable) return deny("แก้ tolerance");
    DB.settings.toleranceDeposit = +$("#tolD").value || 0;
    DB.settings.toleranceWithdraw = +$("#tolW").value || 0;
    DB.settings.diffAlert = +$("#tolA").value || 0;
    Store.data.settings = { ...DB.settings };
    Store.persist();
    logAction("update", "settings", "tolerance", `ฝาก ${DB.settings.toleranceDeposit}s / ถอน ${DB.settings.toleranceWithdraw}s / diff ${DB.settings.diffAlert} บาท`);
    toast("บันทึก tolerance แล้ว ระบบกำลังกระทบยอดใหม่ให้");
    renormalizeAll();
    scheduleAutoReconcile("เปลี่ยน tolerance");
    render();
  });
};

/* =============================================================
   VIEW: Approvals
   ============================================================= */
VIEWS.approvals = (root) => {
  if (!ensureLiveOverview(root)) return;
  const queue = DB.exceptions.filter((e) => ["answered", "clarifying", "damage"].includes(e.status));
  root.innerHTML = `
    <section class="status-strip four">
      <article><span>รอชี้แจง</span><strong>${num(DB.exceptions.filter((e) => e.status === "clarifying").length)}</strong><small>ส่งให้ผู้ดูแลบริษัทแล้ว</small></article>
      <article class="warn"><span>ชี้แจงแล้ว รออนุมัติ</span><strong>${num(DB.exceptions.filter((e) => e.status === "answered").length)}</strong><small>Audit Lead ต้องตรวจทาน</small></article>
      <article class="bad"><span>รอปิดเป็นความเสียหาย</span><strong>${num(DB.exceptions.filter((e) => e.status === "damage").length)}</strong><small>เข้าทะเบียนแล้ว รอปิดรอบ</small></article>
      <article class="ok"><span>ปิดเคสแล้ววันนี้</span><strong>${num(DB.exceptions.filter((e) => ["closed", "approved"].includes(e.status)).length)}</strong><small>มีหลักฐานและผู้อนุมัติครบ</small></article>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Approval Queue</p><h2>รายการรอตรวจทานและอนุมัติ</h2></div>
        <span class="health ${can("approve") ? "ok" : "attention"}">${can("approve") ? "คุณมีสิทธิ์อนุมัติ" : "บทบาทนี้อนุมัติไม่ได้"}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>เคส</th><th>ประเภท</th><th class="right">ยอด Diff</th><th>ระดับ</th><th>หลักฐาน</th><th>สถานะ</th><th class="right">การทำงาน</th></tr></thead>
          <tbody>
            ${
              queue
                .slice(0, 20)
                .map(
                  (e) => `<tr>
              <td><button class="link-btn" data-ex="${e.id}">${e.id}</button></td>
              <td>${h(e.typeName)}</td>
              <td class="right tnum">${e.riskAmount ? money(e.riskAmount) : "—"}</td>
              <td><span class="badge ${e.severity}">${h(sevMeta(e.severity).name)}</span></td>
              <td>${e.hasEvidence ? '<span class="badge green">ครบ</span>' : '<span class="badge red">ยังไม่มี</span>'}</td>
              <td><span class="badge ${statusMeta(e.status).tone}">${h(statusMeta(e.status).name)}</span></td>
              <td class="right nowrap">
                <button class="ghost-button xs" data-reject="${e.id}">ส่งกลับ</button>
                <button class="primary-button xs" data-approve="${e.id}" ${!e.hasEvidence && DB.settings.rules.requireEvidence ? 'disabled title="กฎบังคับแนบหลักฐานก่อนปิดเคส"' : ""}>อนุมัติ</button>
              </td>
            </tr>`,
                )
                .join("") || `<tr><td colspan="7" class="empty">ไม่มีรายการรออนุมัติ</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>`;

  root.querySelectorAll("[data-ex]").forEach((b) => b.addEventListener("click", () => openException(b.dataset.ex)));
  root.querySelectorAll("[data-approve]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!can("approve")) return deny("อนุมัติ");
      const e = DB.exceptions.find((x) => x.id === b.dataset.approve);
      if (!e.hasEvidence && DB.settings.rules.requireEvidence) return toast("กฎบังคับแนบหลักฐานก่อนปิดเคส — ยังอนุมัติไม่ได้", "warn");
      e.status = "closed";
      logAction("approve", "exception", e.id, "อนุมัติจากหน้า approval queue");
      saveOverride(e);
      toast("อนุมัติ " + e.id + " แล้ว");
      render();
    }),
  );
  root.querySelectorAll("[data-reject]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!can("approve")) return deny("ส่งกลับ");
      const e = DB.exceptions.find((x) => x.id === b.dataset.reject);
      e.status = "clarifying";
      logAction("reject", "exception", e.id, "ส่งกลับให้ชี้แจงเพิ่ม");
      saveOverride(e);
      toast("ส่งกลับให้ชี้แจงเพิ่มแล้ว");
      render();
    }),
  );
};

/* =============================================================
   VIEW: Damage register
   ============================================================= */
/* ยอดความเสียหาย (บาท) */
function dmgTHB(d) {
  return d.amount;
}
function cycleQuoteLabel() {
  return "";
}

const liveDamageState = {
  rows: null,
  loading: false,
  ready: false,
  error: null,
  key: "",
  requestId: 0,
  updatedAt: null,
};

function damageQueryKey() {
  return `${state.filters.from}|${state.filters.to}|${state.filters.company}`;
}

async function loadLiveDamage(force = false) {
  const key = damageQueryKey();
  if (liveDamageState.loading || (!force && liveDamageState.ready && liveDamageState.key === key)) return;
  const changedFilter = liveDamageState.key !== key;
  const requestId = ++liveDamageState.requestId;
  liveDamageState.key = key;
  liveDamageState.loading = true;
  liveDamageState.ready = false;
  liveDamageState.error = null;
  if (changedFilter) liveDamageState.rows = null;
  if (state.route === "damage") render();
  try {
    const records = await Sb.damages({
      from: state.filters.from,
      to: state.filters.to,
      company: state.filters.company,
      limit: 5000,
    });
    if (requestId !== liveDamageState.requestId || key !== damageQueryKey()) return;
    liveDamageState.rows = (records || []).map(mapLiveDamage);
    liveDamageState.ready = true;
    liveDamageState.updatedAt = new Date();
    DB.damages = liveDamageState.rows.slice();
  } catch (error) {
    if (requestId !== liveDamageState.requestId) return;
    liveDamageState.rows = null;
    liveDamageState.error = error.message || "โหลดทะเบียนความเสียหายไม่สำเร็จ";
  } finally {
    if (requestId === liveDamageState.requestId) {
      liveDamageState.loading = false;
      if (state.route === "damage") render();
    }
  }
}

function renderLiveDamage(root) {
  const key = damageQueryKey();
  const stale = liveDamageState.key !== key;
  if ((stale || !liveDamageState.ready) && !liveDamageState.loading && (!liveDamageState.error || stale)) loadLiveDamage(stale);
  if (liveDamageState.loading && (stale || !liveDamageState.rows)) {
    root.innerHTML = `<section class="panel live-loading"><span class="spinner"></span><div><h2>กำลังโหลดทะเบียนความเสียหายจริง</h2><p class="hint">อ่านเฉพาะข้อมูลที่ยืนยันเป็นความเสียหายแล้วจาก Supabase...</p></div></section>`;
    return;
  }
  if (liveDamageState.error && !liveDamageState.rows) {
    root.innerHTML = `<section class="panel"><div class="alert bad"><strong>โหลดทะเบียนความเสียหายไม่สำเร็จ</strong><span>${h(liveDamageState.error)}</span><button class="ghost-button sm" id="damageRetry">ลองใหม่</button></div></section>`;
    $("#damageRetry")?.addEventListener("click", () => loadLiveDamage(true));
    return;
  }
  const rows = (liveDamageState.rows || []).filter((d) => inRange(d.date) && (state.filters.company === "ALL" || d.company === state.filters.company));
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const byCompany = companyMaster().map((company) => ({ label: company.code, value: rows.filter((row) => row.company === company.code).reduce((sum, row) => sum + Number(row.amount || 0), 0) })).filter((item) => item.value);
  const open = rows.filter((row) => !row.financeStatus || !/ปิด|เสร็จ|completed|closed/i.test(row.financeStatus)).length;
  const loadedAt = liveDamageState.updatedAt ? liveDamageState.updatedAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "-";
  root.innerHTML = `
    <section class="damage-definition panel">
      <div><p class="eyebrow">ความเสียหายที่ยืนยันแล้ว</p><h2>ทะเบียนนี้ไม่ใช่รายการผิดปกติทั้งหมด</h2><p class="hint">เคสจะแสดงที่นี่เมื่อผู้ตรวจตรวจหลักฐานและเลือก “บันทึกเป็นความเสียหาย” แล้วเท่านั้น · อัปเดตล่าสุด ${h(loadedAt)} น.</p></div>
      <button class="ghost-button sm" id="damageRefresh">รีเฟรชข้อมูล</button>
    </section>
    <section class="status-strip four">
      <article><span>รายการความเสียหายจริง</span><strong>${num(rows.length)}</strong><small>ช่วง ${h(rangeLabel())}</small></article>
      <article class="bad"><span>ยอดความเสียหายรวม</span><strong>${money0(total)}</strong><small>บาท</small></article>
      <article class="${open ? "warn" : "ok"}"><span>ยังไม่ปิดทางการเงิน</span><strong>${num(open)}</strong><small>ตรวจจากสถานะจริง</small></article>
      <article><span>บริษัทที่มีรายการ</span><strong>${num(new Set(rows.map((row) => row.company)).size)}</strong><small>จาก 9 บริษัท</small></article>
    </section>
    <section class="grid-2">
      <div class="panel"><div class="panel-heading"><div><p class="eyebrow">ตามบริษัท</p><h2>ยอดความเสียหาย</h2></div></div><div class="chart" id="liveDamageCompany">${rows.length ? "" : '<div class="empty-box">ยังไม่มีข้อมูลสำหรับสร้างกราฟ</div>'}</div></div>
      <div class="panel"><div class="panel-heading"><div><p class="eyebrow">สาเหตุ</p><h2>รายการที่พบ</h2></div></div><div class="exception-summary">${Object.entries(rows.reduce((acc, row) => ((acc[row.cause] = (acc[row.cause] || 0) + 1), acc), {})).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([cause,count])=>`<div><span>${h(cause)}</span><b>${num(count)}</b></div>`).join("") || `<p class="empty">ยังไม่มีรายการความเสียหายในช่วงนี้</p>`}</div></div>
    </section>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">Supabase damages</p><h2>ทะเบียนความเสียหายจริง</h2></div><span class="health ok">ข้อมูลจริง</span></div>
      <div class="table-wrap"><table><thead><tr><th>วันที่</th><th>รหัส</th><th>บริษัท</th><th>ผู้เกี่ยวข้อง</th><th class="right">ยอด (บาท)</th><th>สาเหตุ</th><th>หลักฐาน</th><th>การเงิน</th></tr></thead>
      <tbody>${rows.map((d)=>`<tr><td>${h(d.date)}</td><td>${d.exceptionId === "-" ? `<span class="mono">${h(d.id)}</span>` : `<button class="link-btn mono" data-damage-ex="${h(d.exceptionId)}">${h(d.id)}</button>`}</td><td><b>${h(d.company)}</b></td><td>${h(d.employee)}</td><td class="right tnum">${money(d.amount)}</td><td>${h(d.cause)}</td><td><span class="badge ${d.evidence?"green":"amber"}">${d.evidence?"มี":"รอ"}</span></td><td>${h(d.financeStatus)}</td></tr>`).join("") || `<tr><td colspan="8"><div class="damage-empty"><strong>ยังไม่มีความเสียหายที่ยืนยันแล้วในช่วงนี้</strong><span>หากมีรายการผิดปกติ ให้เปิดเคส ตรวจหลักฐาน แล้วเลือก “บันทึกเป็นความเสียหาย” รายการจึงจะเข้าทะเบียน</span><button class="primary-button sm" id="damageGoExceptions">ไปตรวจรายการผิดปกติ</button></div></td></tr>`}</tbody></table></div>
    </section>`;
  if (rows.length) Charts.draw("#liveDamageCompany", "hbars", { label: "ยอดความเสียหายตามบริษัท", items: byCompany, color: "#d03b3b", money: true, metric: "ยอด (บาท)" });
  $("#damageRefresh")?.addEventListener("click", () => loadLiveDamage(true));
  $("#damageGoExceptions")?.addEventListener("click", () => go("exceptions"));
  root.querySelectorAll("[data-damage-ex]").forEach((button) => button.addEventListener("click", () => openException(button.dataset.damageEx)));
}

VIEWS.damage = (root) => {
  if (state.dataset === "production" && Sb.signedIn()) {
    renderLiveDamage(root);
    return;
  }
  const sum = (arr) => arr.reduce((a, c) => a + dmgTHB(c), 0);
  const byCycle = DB.damageCycles.map((c) => ({ ...c, records: DB.damages.filter((d) => d.cycle === c.code && inRange(d.date)) }));
  const cycle = DB.damageCycles.find((c) => c.code === state.damageCycle) || DB.damageCycles[0];
  const rows = DB.damages.filter((d) => d.cycle === cycle.code && inRange(d.date));
  const byShift = DB.shifts.map((s) => ({ label: s.name, value: sum(rows.filter((d) => d.shift === s.code)) }));
  const byEmp = Object.entries(
    rows.reduce((a, d) => {
      a[d.employee] = (a[d.employee] || 0) + dmgTHB(d);
      return a;
    }, {}),
  )
    .map(([k, v]) => ({ label: k, value: v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  root.innerHTML = `
    <section class="cycle-cards">
      ${byCycle
        .map(
          (c) => `<article class="panel cycle ${c.status} ${c.code === cycle.code ? "selected" : ""}" data-cycle="${c.code}">
        <p class="eyebrow">${c.status === "open" ? "รอบที่เปิดอยู่" : "ปิดรอบแล้ว"}</p>
        <h2>${h(c.name)}</h2>
        <strong>${money0(sum(c.records))} บาท</strong>
        <small>${cycleQuoteLabel(c.records)}${c.records.length} เคส · ให้เวลาแนบหลักฐาน ${DB.settings.slaEvidenceDays} วัน</small>
        ${
          c.status === "open"
            ? `<button class="primary-button sm" data-close-cycle="${c.code}">ปิดรอบและส่งการเงิน/บุคคล</button>`
            : `<span class="lock-tag">🔒 ล็อกแล้ว แก้ย้อนหลังต้องมีเหตุผลและ approval ใหม่</span>`
        }
      </article>`,
        )
        .join("")}
    </section>

    <section class="grid-2">
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">ตามกะ</p><h2>ยอดความเสียหายแยกกะ</h2></div></div>
        <div class="chart" id="chDmgShift"></div>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">ตามพนักงาน</p><h2>ผู้ที่เกิดเคสซ้ำ</h2></div></div>
        <div class="chart" id="chDmgEmp"></div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Damage Register</p><h2>รายการความเสียหาย ${h(cycle.name)}</h2><small class="head-sub">ช่วงข้อมูล ${h(rangeLabel())}</small></div>
        <div class="inline-actions">
          <select id="dmgCycle" aria-label="เลือกรอบชี้แจง">
            ${DB.damageCycles.map((c) => `<option value="${c.code}" ${c.code === cycle.code ? "selected" : ""}>${h(c.name)}</option>`).join("")}
          </select>
          <button class="ghost-button sm" id="dmgExport">Export ส่งการเงิน</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>รหัส</th><th>เคสอ้างอิง</th><th>บริษัท</th><th>พนักงาน</th><th>กะ</th><th class="right">ยอดเสียหาย (บาท)</th><th>สาเหตุ</th><th>หลักฐาน</th><th>สถานะ HR</th></tr></thead>
          <tbody>
            ${rows
              .map(
                (d) => `<tr>
              <td><b>${d.id}</b></td>
              <td>${d.exceptionId === "-" ? '<span class="muted">-</span>' : `<button class="link-btn" data-ex="${d.exceptionId}">${d.exceptionId}</button>`}</td>
              <td>${h(DB.companies.find((c) => c.code === d.company)?.name || d.company)}</td>
              <td>${h(d.employee)}</td>
              <td>${h(DB.shifts.find((s) => s.code === d.shift).name)}</td>
              <td class="right tnum">${money(dmgTHB(d))}</td>
              <td>${h(d.cause)}</td>
              <td>${d.evidence ? '<span class="badge green">ครบ</span>' : '<span class="badge amber">รอ</span>'}</td>
              <td>${h(d.hrStatus)}</td>
            </tr>`,
              )
              .join("")}
          </tbody>
          <tfoot><tr><td colspan="5">รวม ${rows.length} เคส</td><td class="right tnum"><b>${money(sum(rows))}</b></td><td colspan="3"></td></tr></tfoot>
        </table>
      </div>
    </section>`;

  Charts.draw("#chDmgShift", "bars", { label: "ความเสียหายตามกะ", items: byShift, color: "#d03b3b", money: true, metric: "ยอด (บาท)", height: 220 });
  Charts.draw("#chDmgEmp", "hbars", { label: "ความเสียหายตามพนักงาน", items: byEmp, color: Charts.PALETTE.s2, money: true, metric: "ยอด (บาท)" });

  root.querySelectorAll("[data-ex]").forEach((b) => b.addEventListener("click", () => openException(b.dataset.ex)));
  root.querySelectorAll("[data-cycle]").forEach((c) =>
    c.addEventListener("click", (evt) => {
      if (evt.target.closest("button")) return;
      state.damageCycle = c.dataset.cycle;
      render();
    }),
  );
  root.querySelectorAll("[data-close-cycle]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!can("close_cycle")) return deny("ปิดรอบความเสียหาย");
      const c = DB.damageCycles.find((x) => x.code === b.dataset.closeCycle);
      const noEvidence = DB.damages.filter((d) => d.cycle === c.code && !d.evidence).length;
      if (noEvidence) return toast(`ยังมี ${noEvidence} เคสไม่มีหลักฐาน ปิดรอบไม่ได้`, "warn");
      c.status = "locked";
      logAction("close_cycle", "damage_cycle", c.code, "ปิดรอบและส่งสรุปให้การเงิน/บุคคล");
      toast("ปิดรอบ " + c.name + " และล็อกข้อมูลแล้ว");
      render();
    }),
  );
  $("#dmgCycle").addEventListener("click", (e) => e.stopPropagation());
  $("#dmgCycle").addEventListener("change", (e) => {
    state.damageCycle = e.target.value;
    render();
  });
  $("#dmgExport").addEventListener("click", () =>
    exportSheets("ความเสียหาย_" + cycle.code, [
      {
        name: "ความเสียหาย " + cycle.code,
        title: "ทะเบียนความเสียหาย " + cycle.name,
        headers: ["รหัส", "เคสอ้างอิง", "วันที่", "บริษัท", "พนักงาน", "กะ", "ยอดเสียหาย", "สาเหตุ", "หลักฐาน", "สถานะ HR", "สถานะการเงิน"],
        widths: [14, 12, 12, 14, 17, 10, 14, 32, 10, 16, 16],
        rows: rows.map((d) => [d.id, d.exceptionId, d.date, (DB.companies.find((c) => c.code === d.company) || {}).name || d.company, d.employee, (DB.shifts.find((sh) => sh.code === d.shift) || {}).name || d.shift, d.amount, d.cause, d.evidence ? "ครบ" : "รอ", d.hrStatus, d.financeStatus]),
      },
    ]),
  );
};

function pmProviderOf(value) {
  const text = String(value || "").toUpperCase();
  if (/AUTOPEER|\bATP\b/.test(text)) return "AUTOPEER";
  if (/AZPAY/.test(text)) return "AZPAY";
  if (/COREPAY|CP[ _-]?PAY/.test(text)) return "COREPAY";
  if (/CPXM/.test(text)) return "CPXM";
  if (/CYBERPLUS|CYNERPLUS|\bCBY\b/.test(text)) return "CYBERPLUS";
  if (/MYPAY/.test(text)) return "MYPAY";
  if (/12PAY/.test(text)) return "12PAY";
  return null;
}

/* =============================================================
   VIEW: KPI
   ============================================================= */
function renderLiveKpi(root) {
  if (!ensureLiveOverview(root)) return;
  const ex = scopedExceptions();
  const byCompany = companyMaster().map((company) => ({ label: company.code, value: ex.filter((e) => e.company === company.code).length })).filter((item) => item.value);
  const byDirection = ["PM", "ฝาก", "ถอน"].map((direction) => ({ label: direction, value: ex.filter((e) => e.direction === direction).length }));
  const employeeNames = [...new Set(ex.map((e) => e.employee || "ไม่ระบุ"))];
  const employees = employeeNames.map((employee) => {
    const rows = ex.filter((e) => (e.employee || "ไม่ระบุ") === employee);
    return { employee, rows, critical: rows.filter((e) => e.severity === "critical").length, sla: rows.filter((e) => e.overSla).length, amount: sumRisk(rows) };
  }).sort((a,b)=>b.rows.length-a.rows.length);
  root.innerHTML = `
    <section class="status-strip four">
      <article><span>Exception จริง</span><strong>${num(ex.length)}</strong><small>${h(rangeLabel())}</small></article>
      <article class="bad"><span>Critical</span><strong>${num(ex.filter((e)=>e.severity==="critical").length)}</strong><small>ต้องตรวจเร่งด่วน</small></article>
      <article class="warn"><span>เกิน SLA</span><strong>${num(ex.filter((e)=>e.overSla).length)}</strong><small>คำนวณจาก created_at จริง</small></article>
      <article><span>ยอดเสี่ยงรวม</span><strong>${money0(sumRisk(ex))}</strong><small>บาท</small></article>
    </section>
    <section class="grid-2">
      <div class="panel"><div class="panel-heading"><div><p class="eyebrow">บริษัท</p><h2>Exception ตามบริษัท</h2></div></div><div class="chart" id="liveKpiCompany"></div></div>
      <div class="panel"><div class="panel-heading"><div><p class="eyebrow">ประเภท</p><h2>PM / ฝาก / ถอน</h2></div></div><div class="chart" id="liveKpiDirection"></div></div>
    </section>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">ผู้เกี่ยวข้องจากข้อมูลจริง</p><h2>สรุปตาม employee ใน Exception</h2></div></div>
      <div class="table-wrap"><table><thead><tr><th>ผู้เกี่ยวข้อง</th><th class="right">เคส</th><th class="right">Critical</th><th class="right">เกิน SLA</th><th class="right">ยอดเสี่ยง</th></tr></thead>
      <tbody>${employees.slice(0,100).map((row)=>`<tr><td>${h(row.employee)}</td><td class="right tnum">${num(row.rows.length)}</td><td class="right tnum">${num(row.critical)}</td><td class="right tnum">${num(row.sla)}</td><td class="right tnum">${money(row.amount)}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">ยังไม่มี Exception ในช่วงนี้</td></tr>`}</tbody></table></div>
      <p class="hint">ตารางนี้ใช้ค่าที่อยู่ในฟิลด์ employee ของข้อมูลจริงเท่านั้น ไม่มีรายชื่อพนักงานตัวอย่าง</p>
    </section>`;
  Charts.draw("#liveKpiCompany", "hbars", { label: "Exception ตามบริษัท", items: byCompany, color: Charts.PALETTE.s1, metric: "จำนวนเคส" });
  Charts.draw("#liveKpiDirection", "bars", { label: "Exception ตามประเภท", items: byDirection, color: Charts.PALETTE.s3, metric: "จำนวนเคส", height: 230 });
}

VIEWS.kpi = (root) => {
  if (state.dataset === "production" && Sb.signedIn()) {
    renderLiveKpi(root);
    return;
  }
  const ex = scopedExceptions();
  const byShift = DB.shifts.map((s) => ({
    label: `${s.name}\n${s.range}`,
    value: ex.filter((e) => e.shift === s.code).length,
    code: s.code,
  }));
  const byEmp = Object.entries(
    ex.reduce((a, e) => {
      a[e.employee] = (a[e.employee] || 0) + 1;
      return a;
    }, {}),
  )
    .map(([k, v]) => ({ label: k, value: v }))
    .sort((a, b) => b.value - a.value);
  const byCompany = companyMaster().map((c) => ({ label: c.name, value: ex.filter((e) => e.company === c.code).length })).filter((x) => x.value);

  root.innerHTML = `
    <section class="grid-3">
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Shift</p><h2>เคสตามกะ</h2></div></div>
        <div class="chart" id="kShift"></div>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Employee</p><h2>พนักงานที่เกิดเคสมากที่สุด</h2></div></div>
        <div class="chart" id="kEmp"></div>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Company</p><h2>เคสตามบริษัท</h2></div></div>
        <div class="chart" id="kCompany"></div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">KPI Table</p><h2>สรุปรายพนักงาน</h2></div>
        <button class="ghost-button sm" id="kpiExport">Export CSV</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>พนักงาน</th><th>กะ</th><th class="right">เคสทั้งหมด</th><th class="right">Critical</th><th class="right">เกิน SLA</th><th class="right">ยอด diff รวม</th><th>ระดับความเสี่ยง</th></tr></thead>
          <tbody>
            ${DB.employees
              .map((emp) => {
                const rows = ex.filter((e) => e.employee === emp.username);
                const crit = rows.filter((e) => e.severity === "critical").length;
                const sla = rows.filter((e) => e.overSla).length;
                const amt = sumRisk(rows);
                const risk = crit >= 4 || sla >= 5 ? "สูง" : crit >= 2 ? "กลาง" : "ต่ำ";
                const tone = risk === "สูง" ? "red" : risk === "กลาง" ? "amber" : "green";
                return `<tr><td>${h(emp.username)}</td><td>${h(DB.shifts.find((s) => s.code === emp.shift).name)}</td>
                  <td class="right tnum">${rows.length}</td><td class="right tnum">${crit}</td>
                  <td class="right tnum ${sla ? "danger" : ""}">${sla}</td><td class="right tnum">${money0(amt)}</td>
                  <td><span class="badge ${tone}">${risk}</span></td></tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="chart-note">KPI นี้ใช้ประกอบการหาสาเหตุเชิงกระบวนการ ไม่ควรใช้ตัดสินลงโทษโดยไม่ผ่านการอนุมัติและตรวจหลักฐานตามรอบชี้แจง</p>
    </section>`;

  Charts.draw("#kShift", "bars", { label: "เคสตามกะ", items: byShift, color: Charts.PALETTE.s4, metric: "จำนวนเคส", height: 230 });
  Charts.draw("#kEmp", "hbars", { label: "เคสตามพนักงาน", items: byEmp.slice(0, 8), color: Charts.PALETTE.s2, metric: "จำนวนเคส" });
  Charts.draw("#kCompany", "hbars", { label: "เคสตามบริษัท", items: byCompany, color: Charts.PALETTE.s1, metric: "จำนวนเคส" });

  $("#kpiExport").addEventListener("click", () => exportSheets("KPI", [SHEET_BUILDERS.kpi.build()]));
};

/* =============================================================
   VIEW: Reports
   ============================================================= */
function renderLiveReports(root) {
  if (!ensureLiveOverview(root)) return;
  const inScope = (row) => row.business_date >= state.filters.from && row.business_date <= state.filters.to && (state.filters.company === "ALL" || row.company === state.filters.company);
  const quality = (liveOverviewState.quality || []).filter(inScope);
  const operations = (liveOverviewState.operations || []).filter(inScope);
  const exceptions = scopedExceptions();
  const damages = DB.damages.filter((d) => inRange(d.date) && (state.filters.company === "ALL" || d.company === state.filters.company));
  const matched = quality.reduce((sum,row)=>sum+Number(row.matched||0),0);
  const stm = quality.reduce((sum,row)=>sum+Number(row.stm_count||0),0);
  const totalDamage = damages.reduce((sum,row)=>sum+Number(row.amount||0),0);
  const qualityAvailable = Array.isArray(liveOverviewState.quality) && !liveOverviewState.coreErrors.includes("ผลกระทบยอด");
  const operationsAvailable = Array.isArray(liveOverviewState.operations) && !liveOverviewState.coreErrors.includes("คิวกระทบยอด");
  const exceptionsAvailable = liveOverviewState.exceptionsReady;
  const damagesAvailable = liveOverviewState.damagesReady;
  const reportMetric = (available, value, formatter = num) => available ? formatter(value) : "—";
  const dateMap = new Map();
  operations.forEach((row)=>{
    const item=dateMap.get(row.business_date)||{date:row.business_date,mails:0,files:0,completed:0,review:0,waiting:0,error:0};
    item.mails+=Number(row.mail_count||0); item.files+=Number(row.file_count||0);
    if(row.status==="completed") item.completed++; else if(row.status==="waiting_files") item.waiting++; else if(row.status==="error") item.error++; else item.review++;
    dateMap.set(row.business_date,item);
  });
  const daily=[...dateMap.values()].sort((a,b)=>b.date.localeCompare(a.date));
  const monthMap=new Map();
  damages.forEach((row)=>{const ym=String(row.date||"").slice(0,7);monthMap.set(ym,(monthMap.get(ym)||0)+Number(row.amount||0));});
  const monthly=[...monthMap.entries()].sort().map(([label,value])=>({label,value}));
  root.innerHTML=`
    <section class="status-strip four action-tiles">
      <article data-action-route="cloud"><span>รายการ STM จริง</span><strong>${reportMetric(qualityAvailable, stm)}</strong><small>${qualityAvailable ? `${quality.length} งาน` : "กำลังรอข้อมูลจริง"} · กดดูไฟล์ต้นทาง</small></article>
      <article class="ok" data-action-route="daily-summary"><span>จับคู่สำเร็จ</span><strong>${reportMetric(qualityAvailable, matched)}</strong><small>${qualityAvailable ? `${stm?((matched/stm)*100).toFixed(2):"0.00"}%` : "กำลังรอข้อมูลจริง"} · กดดูผลรายวัน</small></article>
      <article class="bad" data-action-route="exceptions"><span>Exception</span><strong>${reportMetric(exceptionsAvailable, exceptions.length)}</strong><small>${exceptionsAvailable ? `เกิน SLA ${num(exceptions.filter((e)=>e.overSla).length)}` : "กำลังรอข้อมูลจริง"} · กดตรวจเคส</small></article>
      <article class="bad" data-action-route="damage"><span>ความเสียหายที่บันทึกจริง</span><strong>${reportMetric(damagesAvailable, totalDamage, money0)}</strong><small>${damagesAvailable ? `บาท · ${num(damages.length)} รายการ` : "กำลังรอข้อมูลจริง"} · กดดูทะเบียน</small></article>
    </section>
    <section class="panel export-bar no-capture"><div><p class="eyebrow">รายงานข้อมูลจริง</p><h2>ช่วง ${h(rangeLabel())}</h2><span class="muted">สรุปจาก Supabase ตามบริษัทและวันที่ที่เลือก</span></div><div class="inline-actions"><button class="ghost-button" id="liveRepException">Export Exception</button><button class="primary-button" id="liveRepDamage">Export ความเสียหาย</button></div></section>
    ${monthly.length?`<section class="panel"><div class="panel-heading"><div><p class="eyebrow">Damage Trend</p><h2>ความเสียหายรายเดือนจากข้อมูลจริง</h2></div></div><div class="chart" id="liveReportDamage"></div></section>`:""}
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">รายวัน</p><h2>สถานะไฟล์และงานกระทบยอด</h2></div><span class="health ok">ข้อมูลจริง</span></div>
      <div class="table-wrap"><table><thead><tr><th>วันที่</th><th class="right">เมล</th><th class="right">ไฟล์</th><th class="right">สำเร็จ</th><th class="right">ต้องตรวจ</th><th class="right">รอไฟล์</th><th class="right">ล้มเหลว</th></tr></thead>
      <tbody>${daily.map((row)=>`<tr class="action-row" data-report-date="${h(row.date)}" role="link" tabindex="0"><td><b>${h(row.date)}</b><small class="sub">กดดูสรุปรายวัน</small></td><td class="right tnum">${num(row.mails)}</td><td class="right tnum">${num(row.files)}</td><td class="right tnum">${num(row.completed)}</td><td class="right tnum">${num(row.review)}</td><td class="right tnum">${num(row.waiting)}</td><td class="right tnum">${num(row.error)}</td></tr>`).join("")||`<tr><td colspan="7" class="empty">${operationsAvailable ? "ยังไม่มีข้อมูลในช่วงนี้" : "ข้อมูลคิวกระทบยอดยังโหลดไม่สำเร็จ — ยังไม่สรุปเป็นศูนย์"}</td></tr>`}</tbody></table></div>
    </section>`;
  if(monthly.length) Charts.draw("#liveReportDamage","bars",{label:"ความเสียหายรายเดือน",items:monthly,color:"#d03b3b",money:true,metric:"บาท",height:240});
  $("#liveRepException")?.addEventListener("click",()=>exportSheets("Exception_ข้อมูลจริง",[{name:"Exception",title:`Exception ${rangeLabel()}`,headers:["วันที่","เวลา","บริษัท","ประเภท","ระดับ","สถานะ","ยอดเสี่ยง","สาเหตุ"],rows:exceptions.map((e)=>[e.date,e.time,e.company,e.typeName,e.severity,e.status,e.riskAmount,e.cause])}]));
  $("#liveRepDamage")?.addEventListener("click",()=>exportSheets("ความเสียหาย_ข้อมูลจริง",[{name:"ความเสียหาย",title:`ความเสียหาย ${rangeLabel()}`,headers:["วันที่","รหัส","บริษัท","ผู้เกี่ยวข้อง","ยอด","สาเหตุ","หลักฐาน","สถานะการเงิน"],rows:damages.map((d)=>[d.date,d.id,d.company,d.employee,d.amount,d.cause,d.evidence?"มี":"รอ",d.financeStatus])}]));
  root.querySelectorAll("[data-action-route]").forEach((item)=>item.addEventListener("click",()=>go(item.dataset.actionRoute)));
  root.querySelectorAll("[data-report-date]").forEach((row)=>{
    const open=()=>{state.dailySummary.date=row.dataset.reportDate;go("daily-summary");};
    row.addEventListener("click",open);
    row.addEventListener("keydown",(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();open();}});
  });
}

VIEWS.reports = (root) => {
  if (state.dataset === "production" && Sb.signedIn()) {
    renderLiveReports(root);
    return;
  }
  const all = DB.monthlyTrend;
  const inMonths = all.filter((m) => m.ym >= state.filters.from.slice(0, 7) && m.ym <= state.filters.to.slice(0, 7));
  const t = inMonths.length >= 2 ? inMonths : all;
  const last = t[t.length - 1];
  const prev = t[t.length - 2] || last;
  const delta = prev === last ? "0.0" : (((last.damage - prev.damage) / prev.damage) * 100).toFixed(1);

  root.innerHTML = `
    <section class="panel export-bar no-capture">
      <div>
        <p class="eyebrow">Export</p>
        <h2>ออกรายงานช่วง ${h(rangeLabel())}</h2>
        <span class="muted">เลือกช่วงวันที่ได้จากแถบตัวกรองด้านบน · ไฟล์ Excel จะมีหลายชีตในไฟล์เดียว · ทุกการ์ดในหน้านี้มีปุ่มกล้องสำหรับบันทึกเฉพาะส่วนนั้นเป็นภาพ</span>
      </div>
      <div class="inline-actions">
        <button class="ghost-button" id="repImage">บันทึกทั้งหน้าเป็นภาพ</button>
        <button class="primary-button" id="repAll">เลือกชุดข้อมูล & Export Excel</button>
      </div>
    </section>

    <section class="status-strip four">
      <article><span>ความเสียหายเดือนนี้</span><strong>${money0(last.damage)}</strong><small>บาท · ${last.cases} เคส</small></article>
      <article class="${delta < 0 ? "ok" : "bad"}"><span>เทียบเดือนก่อน</span><strong>${delta > 0 ? "+" : ""}${delta}%</strong><small>${delta < 0 ? "ลดลง" : "เพิ่มขึ้น"}จาก ${money0(prev.damage)} บาท</small></article>
      <article class="ok"><span>มูลค่าที่ป้องกันได้</span><strong>${money0(last.prevented)}</strong><small>จากการตรวจพบเร็ว</small></article>
      <article><span>เคสที่ยังไม่ปิด</span><strong>${num(DB.exceptions.filter((e) => !["closed", "approved"].includes(e.status)).length)}</strong><small>ต้องระบุเหตุผลในรายงาน</small></article>
    </section>

    <section class="panel">
      <div class="panel-heading"><div><p class="eyebrow">Trend 12 เดือน</p><h2>ความเสียหายเทียบมูลค่าที่ป้องกันได้</h2></div><span class="health ok">${t.length} เดือน · ${h(rangeLabel())}</span></div>
      <div class="chart" id="rTrend"></div>
      <div class="c-legend static"><span class="c-leg"><i style="background:${Charts.PALETTE.s2}"></i>ความเสียหายจริง</span><span class="c-leg"><i style="background:${Charts.PALETTE.s3}"></i>มูลค่าที่ป้องกันได้</span></div>
    </section>

    <section class="grid-2">
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Daily Report</p><h2>รายงานช่วง ${h(rangeLabel())}</h2></div></div>
        <ul class="report-list">
          <li><span>รายการทั้งหมด</span><b>${num(DB.hourly.reduce((a, c) => a + c.total, 0))}</b></li>
          <li><span>จับคู่สำเร็จ</span><b>${num(DB.hourly.reduce((a, c) => a + c.matched, 0))}</b></li>
          <li><span>Exception</span><b>${num(DB.hourly.reduce((a, c) => a + c.exception, 0))}</b></li>
          <li><span>ไฟล์ที่มีปัญหา</span><b>${DB.files.filter((f) => f.status !== "received").length}</b></li>
          <li><span>เคสเกิน SLA</span><b>${DB.exceptions.filter((e) => e.overSla).length}</b></li>
          <li><span>ยอดที่อาจเป็นความเสียหาย</span><b>${money0(DB.damages.reduce((a, c) => a + c.amount, 0))} บาท</b></li>
        </ul>
        <div class="inline-actions">
          <button class="ghost-button" id="repDaily">Excel รายงานรายวัน</button>
          <button class="ghost-button" id="repEx">Excel Exception</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Monthly Package</p><h2>ชุดรายงานส่งผู้บริหาร</h2></div></div>
        <ul class="tick-list">
          <li>มูลค่าความเสียหายจริงและที่ป้องกันได้</li>
          <li>Top cause และ Top employee / shift risk</li>
          <li>Trend เทียบเดือนก่อนและไตรมาสก่อน</li>
          <li>เคสที่ยังไม่ปิดพร้อมเหตุผล</li>
          <li>ข้อเสนอปรับ process เพื่อลดความผิดซ้ำ</li>
        </ul>
        <div class="inline-actions">
          <button class="ghost-button" id="repMonthly">Excel สรุปรายเดือน</button>
          <button class="primary-button" id="repSend">ส่งให้การเงิน / บุคคล</button>
        </div>
        <p class="hint">รายงานสำหรับ Finance / HR จะดึงเฉพาะ damage record ที่ปิดรอบแล้วเท่านั้น</p>
      </div>
    </section>`;

  Charts.draw("#rTrend", "line", {
    label: "แนวโน้มความเสียหายรายเดือน",
    xLabels: t.map((x) => x.month),
    short: true,
    series: [
      { name: "ความเสียหายจริง", color: Charts.PALETTE.s2, values: t.map((x) => x.damage), area: true },
      { name: "ป้องกันได้", color: Charts.PALETTE.s3, values: t.map((x) => x.prevented) },
    ],
    height: 260,
  });

  $("#repDaily").addEventListener("click", () =>
    exportSheets("รายงานรายวัน", [SHEET_BUILDERS.daily.build(), SHEET_BUILDERS.exceptions.build(), SHEET_BUILDERS.intake.build()]),
  );
  $("#repEx").addEventListener("click", () => exportSheets("รายการผิดปกติ", [SHEET_BUILDERS.exceptions.build()]));
  $("#repMonthly").addEventListener("click", () =>
    exportSheets("สรุปรายเดือน", [SHEET_BUILDERS.monthly.build(), SHEET_BUILDERS.damage.build(), SHEET_BUILDERS.kpi.build()]),
  );
  $("#repAll").addEventListener("click", openExportDialog);
  $("#repImage").addEventListener("click", capturePage);
  $("#repSend").addEventListener("click", () => {
    if (!can("export")) return deny("ส่งรายงาน");
    const open = DB.damageCycles.filter((c) => c.status === "open").length;
    if (open) return toast("ยังมีรอบที่ไม่ได้ปิด — ปิดรอบก่อนจึงส่งการเงิน/บุคคลได้", "warn");
    logAction("send_report", "report", "monthly", "ส่งสรุปความเสียหายให้การเงินและบุคคล");
    toast("ส่งชุดรายงานให้การเงินและบุคคลแล้ว");
  });
};

/* =============================================================
   VIEW: Talk to Data
   ============================================================= */
const SUGGESTIONS = [
  "บริษัทไหนมีรายการผิดปกติมากที่สุด",
  "สาเหตุหลักในช่วงนี้คืออะไร",
  "ไฟล์ไหนยังไม่ได้ส่ง",
  "ความเสียหายเดือนนี้เท่าไหร่",
  "เคสไหนเลย SLA บ้าง",
  "บัญชีไหนเกิด diff บ่อยที่สุด",
];

function answerQuestion(q) {
  const t = q.toLowerCase();
  const live = state.dataset === "production" && Sb.signedIn();
  const ex = live ? scopedExceptions() : DB.exceptions;
  const has = (...w) => w.some((x) => t.includes(x));

  if (has("บริษัท", "company")) {
    const agg = Object.entries(ex.reduce((a,e)=>((a[e.company]=(a[e.company]||0)+1),a),{})).sort((a,b)=>b[1]-a[1]);
    return {
      text: agg.length ? `ช่วง ${rangeLabel()} บริษัทที่มี Exception มากที่สุดคือ ${agg.slice(0,3).map(([company,count])=>`${company} ${num(count)} เคส`).join(", ")}` : `ช่วง ${rangeLabel()} ยังไม่มี Exception ที่ระบุบริษัท`,
      link: { label: "ดู KPI บริษัท", route: "kpi" },
    };
  }
  if (has("สาเหตุ", "cause", "ทำไม")) {
    const agg = Object.entries(ex.reduce((a, e) => ((a[e.cause] = (a[e.cause] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
    return {
      text: agg.length ? `สาเหตุอันดับต้นช่วง ${rangeLabel()} คือ ${agg.slice(0,3).map(([cause,count])=>`"${cause}" ${num(count)} เคส`).join(", ")}` : `ช่วง ${rangeLabel()} ยังไม่มี Exception`,
      link: { label: "ดูรายการทั้งหมด", route: "exceptions" },
    };
  }
  if (has("ไฟล์", "file", "stm", "bo ")) {
    if (live) {
      const ops=(liveOverviewState.operations||[]).filter((row)=>row.business_date>=state.filters.from&&row.business_date<=state.filters.to&&(state.filters.company==="ALL"||row.company===state.filters.company));
      const bad=ops.filter((row)=>["waiting_files","needs_review","error"].includes(row.status));
      return {text:bad.length?`ช่วง ${rangeLabel()} มี ${num(bad.length)} งานที่ต้องตาม: ${bad.slice(0,5).map((row)=>`${row.business_date} ${row.company} (${row.status})`).join(", ")}`:`ช่วง ${rangeLabel()} ไม่พบงานรอไฟล์หรือล้มเหลวใน Supabase`,link:{label:"เปิดหน้าตรวจไฟล์เข้า",route:"intake"}};
    }
    const bad = DB.files.filter((f) => f.status !== "received");
    return {
      text: bad.length
        ? `ยังมีไฟล์ที่มีปัญหา ${bad.length} รายการ: ${bad.slice(0, 5).map((b) => `${b.companyName} - ${b.fileType} (${b.status === "missing" ? "ไม่ได้ส่ง" : b.status === "late" ? "ส่งช้า" : "ผิดบริษัท"})`).join(", ")}${bad.length > 5 ? " และอื่น ๆ" : ""}`
        : "ไฟล์ครบทุกบริษัทและทุกประเภทแล้ว",
      link: { label: "เปิดหน้า Intake Control", route: "intake" },
    };
  }
  if (has("เสียหาย", "damage", "เดือนนี้")) {
    const sum = DB.damages.reduce((a, c) => a + c.amount, 0);
    if (live) return { text: `ช่วง ${rangeLabel()} มีความเสียหายที่บันทึกใน Supabase ${money0(sum)} บาท จาก ${num(DB.damages.length)} รายการ`, link: { label: "เปิดทะเบียนความเสียหาย", route: "damage" } };
    const last = DB.monthlyTrend[DB.monthlyTrend.length - 1];
    return {
      text: `รอบ 1 (1-15 ส.ค. 2026) มีความเสียหายที่บันทึกแล้ว ${money0(sum)} บาท จาก ${DB.damages.length} เคส สำหรับทั้งเดือนล่าสุดในระบบอยู่ที่ ${money0(last.damage)} บาท ${last.cases} เคส และป้องกันได้ ${money0(last.prevented)} บาท`,
      link: { label: "เปิดทะเบียนความเสียหาย", route: "damage" },
    };
  }
  if (has("sla", "เลยกำหนด", "ช้า")) {
    const over = ex.filter((e) => e.overSla);
    return {
      text: `มีเคสเกิน SLA ${over.length} รายการ แยกเป็น Critical ${over.filter((e) => e.severity === "critical").length}, High ${over.filter((e) => e.severity === "high").length}, Medium ${over.filter((e) => e.severity === "medium").length} เคสที่ค้างนานที่สุดคือ ${over.sort((a, b) => b.ageHours - a.ageHours)[0]?.id || "-"}`,
      link: { label: "กรองเฉพาะเคสเลย SLA", route: "exceptions", exFilter: { sla: true } },
    };
  }
  if (has("บัญชี", "account", "diff บ่อย")) {
    const agg = Object.entries(ex.reduce((a, e) => ((a[e.account] = (a[e.account] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
    return {
      text: `บัญชีที่เกิด diff บ่อยที่สุดคือ ${agg[0][0]} จำนวน ${agg[0][1]} เคส รองลงมา ${agg[1][0]} ${agg[1][1]} เคส และ ${agg[2][0]} ${agg[2][1]} เคส ควรตรวจว่าเป็นปัญหาที่รูปแบบไฟล์ธนาคารหรือขั้นตอนการทำงานของทีม`,
      link: { label: "ดูหน้า KPI", route: "kpi" },
    };
  }
  if (has("matched", "จับคู่", "กี่รายการ", "วันนี้")) {
    if (live) {
      const q=(liveOverviewState.quality||[]).filter((row)=>row.business_date>=state.filters.from&&row.business_date<=state.filters.to&&(state.filters.company==="ALL"||row.company===state.filters.company));
      const tot=q.reduce((sum,row)=>sum+Number(row.stm_count||0),0),m=q.reduce((sum,row)=>sum+Number(row.matched||0),0);
      return {text:`ช่วง ${rangeLabel()} มีรายการ STM ${num(tot)} จับคู่สำเร็จ ${num(m)} คิดเป็น ${tot?((m/tot)*100).toFixed(2):"0.00"}% และมี Exception ${num(ex.length)} รายการ`,link:{label:"เปิดแดชบอร์ด",route:"dashboard"}};
    }
    const tot = DB.hourly.reduce((a, c) => a + c.total, 0);
    const m = DB.hourly.reduce((a, c) => a + c.matched, 0);
    return {
      text: `วันที่ ${DB.BUSINESS_DATE} มีรายการทั้งหมด ${num(tot)} จับคู่สำเร็จ ${num(m)} คิดเป็น ${((m / tot) * 100).toFixed(2)}% เหลือ exception ${num(tot - m)} รายการที่ต้องตรวจ`,
      link: { label: "เปิดแดชบอร์ด", route: "dashboard" },
    };
  }
  return {
    text: `ยังไม่มีข้อมูลตรงกับคำถามนี้ ลองถามเกี่ยวกับบริษัท สาเหตุ ไฟล์ที่ขาด ความเสียหาย SLA บัญชีที่เกิด diff บ่อย หรืออัตราจับคู่ในช่วง ${rangeLabel()}`,
    link: null,
  };
}

VIEWS.talk = (root) => {
  if (!ensureLiveOverview(root)) return;
  root.innerHTML = `
    <section class="grid-talk">
      <div class="panel">
        <div class="panel-heading">
          <div><p class="eyebrow">Talk to Data</p><h2>ถามข้อมูลที่ผ่าน reconcile แล้ว</h2></div>
          <span class="health ok">ข้อมูล ${DB.BUSINESS_DATE}</span>
        </div>
        <div class="chat-box big" id="chatBox">
          ${
            state.chat.length
              ? state.chat
                  .map(
                    (m) =>
                      `<div class="message ${m.type}">${h(m.text)}${m.link ? `<button class="chat-link" data-route="${m.link.route}" data-payload='${h(JSON.stringify(m.link))}'>${h(m.link.label)} →</button>` : ""}</div>`,
                  )
                  .join("")
              : `<div class="message system">ลองถามว่า "บริษัทไหนมีรายการผิดปกติมากที่สุด" หรือ "ไฟล์ไหนยังไม่ได้ส่ง" — ทุกคำตอบจะอ้างอิงข้อมูลจริงในช่วงที่เลือก</div>`
          }
        </div>
        <form class="ask-form" id="askForm">
          <input id="askInput" type="text" placeholder="พิมพ์คำถามถึงข้อมูล..." autocomplete="off" />
          <button type="submit" class="primary-button">ถาม</button>
        </form>
        <div class="chips">${SUGGESTIONS.map((s) => `<button class="chip" data-q="${h(s)}">${h(s)}</button>`).join("")}</div>
      </div>

      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">ข้อกำหนด</p><h2>กติกาของคำตอบ</h2></div></div>
        <ul class="tick-list">
          <li>ตอบจากข้อมูลที่ผ่าน reconcile แล้วเท่านั้น</li>
          <li>ต้องระบุตัวเลขและช่วงวันที่ชัดเจน</li>
          <li>คำตอบที่กระทบการลงโทษหรือการเงิน ต้องมีลิงก์กลับไปหลักฐาน</li>
          <li>ไม่ตอบจากข้อมูลดิบที่ยังไม่ผ่าน quality gate</li>
        </ul>
        <div class="panel-heading mt"><div><p class="eyebrow">ตัวอย่างที่ตอบได้</p><h2>ขอบเขตปัจจุบัน</h2></div></div>
        <ul class="tick-list">
          <li>ยอด Exception แยกตามบริษัท / ประเภท / บัญชี</li>
          <li>ไฟล์ที่ขาดหรือส่งผิดบริษัท</li>
          <li>ยอดความเสียหายและแนวโน้มรายเดือน</li>
          <li>เคสที่เลย SLA และเคสที่ค้างนานที่สุด</li>
        </ul>
      </div>
    </section>`;

  const send = (q) => {
    state.chat.push({ type: "user", text: q });
    const a = answerQuestion(q);
    state.chat.push({ type: "system", text: a.text, link: a.link });
    logAction("query", "talk_to_data", q.slice(0, 40), a.text.slice(0, 80));
    render();
    const box = $("#chatBox");
    if (box) box.scrollTop = box.scrollHeight;
  };

  $("#askForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("#askInput").value.trim();
    if (v) send(v);
  });
  root.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => send(c.dataset.q)));
  root.querySelectorAll(".chat-link").forEach((b) =>
    b.addEventListener("click", () => {
      const p = JSON.parse(b.dataset.payload);
      go(p.route, { filters: p.filters, exFilter: p.exFilter });
    }),
  );
  const box = $("#chatBox");
  if (box) box.scrollTop = box.scrollHeight;
};

/* =============================================================
   VIEW: Bank rules
   ============================================================= */
VIEWS.rules = (root) => {
  if (!ensureLiveOverview(root)) return;
  const editable = can("rules") && state.dataset !== "production";
  root.innerHTML = `
    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Rule Engine</p><h2>กฎรายธนาคาร</h2></div>
        <span class="health ${editable ? "ok" : "attention"}">${editable ? "แก้ไขได้" : "กฎที่ใช้งานจริง · อ่านอย่างเดียว"}</span>
      </div>
      <div class="rule-rows">
        ${DB.settings.bankRules
          .map(
            (r) => `<div class="rule-row">
          <label class="switch"><input type="checkbox" data-bank="${r.bank}" ${r.enabled ? "checked" : ""} ${editable ? "" : "disabled"} /><span></span></label>
          <div><strong>${h(r.bank)}</strong><span>${h(r.detail)}</span></div>
          <span class="badge ${r.enabled ? "green" : "grey"}">${r.enabled ? "เปิดใช้" : "ปิด"}</span>
        </div>`,
          )
          .join("")}
      </div>
    </section>

    <section class="grid-2">
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Rule Preset</p><h2>กฎควบคุมการทำงาน</h2></div></div>
        <div class="toggle-list">
          ${[
            ["crossDay", "ตรวจช่วงข้ามวัน 23:00-23:59 ร่วมกับวันถัดไป"],
            ["lockDelete", "ห้ามลบข้อมูลหลัง import (ใส่ note ได้เท่านั้น)"],
            ["requireEvidence", "บังคับแนบหลักฐานก่อนปิดเคส"],
            ["pmSuccessOnly", "PM: กรองเฉพาะรายการสำเร็จ"],
            ["filterCarryForward", 'กรอง "ยอดยกมา" และ "รอบวันที่" อัตโนมัติ'],
            ["notifyTelegram", "แจ้งเตือน Telegram เมื่อ severity สูง"],
          ]
            .map(
              ([k, label]) =>
                `<label><input type="checkbox" data-rule="${k}" ${DB.settings.rules[k] ? "checked" : ""} ${editable ? "" : "disabled"} /> ${h(label)}</label>`,
            )
            .join("")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Taxonomy</p><h2>ประเภท exception และ SLA</h2></div></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>ประเภท</th><th>ระดับเริ่มต้น</th><th class="right">SLA (ชม.)</th><th class="right">เคสวันนี้</th></tr></thead>
            <tbody>
              ${DB.exceptionTypes
                .map(
                  (t) => `<tr><td>${h(t.name)}</td>
                <td><span class="badge ${t.baseSeverity}">${h(sevMeta(t.baseSeverity).name)}</span></td>
                <td class="right tnum">${sevMeta(t.baseSeverity).sla}</td>
                <td class="right tnum">${DB.exceptions.filter((e) => e.type === t.code).length}</td></tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    </section>`;

  root.querySelectorAll("[data-bank]").forEach((c) =>
    c.addEventListener("change", () => {
      const r = DB.settings.bankRules.find((x) => x.bank === c.dataset.bank);
      r.enabled = c.checked;
      logAction("update", "bank_rule", r.bank, (c.checked ? "เปิดใช้" : "ปิด") + "กฎธนาคาร");
      toast(`${r.bank}: ${c.checked ? "เปิดใช้" : "ปิด"}กฎแล้ว`);
      renormalizeAll();
      scheduleAutoReconcile("เปลี่ยนกฎธนาคาร " + r.bank);
      render();
    }),
  );
  root.querySelectorAll("[data-rule]").forEach((c) =>
    c.addEventListener("change", () => {
      DB.settings.rules[c.dataset.rule] = c.checked;
      Store.data.settings = { ...DB.settings };
      Store.persist();
      logAction("update", "rule_preset", c.dataset.rule, c.checked ? "เปิด" : "ปิด");
      toast("บันทึกการตั้งค่ากฎแล้ว");
      renormalizeAll();
      scheduleAutoReconcile("เปลี่ยนกฎการทำงาน");
    }),
  );
};

/* =============================================================
   VIEW: Users & permission
   ============================================================= */
VIEWS.users = async (root) => {
  const caps = [
    ["view", "ดูหน้าที่ได้รับสิทธิ์ / dashboard"],
    ["note", "ใส่ note"],
    ["status", "เปลี่ยนสถานะ"],
    ["request_clarify", "ส่งให้ชี้แจง"],
    ["respond", "ตอบชี้แจง"],
    ["attach", "แนบหลักฐาน"],
    ["approve", "อนุมัติ"],
    ["close_case", "ปิดเคส"],
    ["close_cycle", "ปิดรอบความเสียหาย"],
    ["rules", "แก้ rule / tolerance"],
    ["users", "จัดการผู้ใช้"],
    ["settings", "ตั้งค่าระบบ"],
    ["export", "export รายงาน"],
  ];
  root.innerHTML = `<section class="panel"><div class="loading-block"><span class="spinner"></span><strong>กำลังโหลดผู้ใช้และสิทธิ์จริงจาก Supabase</strong></div></section>`;
  let users = [];
  let loadError = "";
  try {
    users = await Sb.adminUserAccess();
    if (!Array.isArray(users)) users = users ? [users] : [];
  } catch (error) {
    loadError = error.message || "โหลดผู้ใช้ไม่สำเร็จ";
  }
  root.innerHTML = `
    ${loadError ? `<section class="alert warn"><strong>ยังโหลดทะเบียนผู้ใช้ไม่ได้</strong><span>${h(loadError)}</span></section>` : ""}
    <section class="panel access-admin-panel">
      <div class="panel-heading"><div><p class="eyebrow">User access</p><h2 id="accessFormTitle">เพิ่มผู้ใช้ใหม่</h2><small class="head-sub">กรอกข้อมูลครั้งเดียว ระบบจะส่งอีเมลเชิญเข้าใช้งานและกำหนดสิทธิ์ให้ทันที ไม่ต้องเปิดหน้า Supabase</small></div>
      <button class="primary-button" type="button" id="newAccessUser">+ เพิ่มผู้ใช้</button></div>
      <form id="accessUserForm" class="access-user-form">
        <label>อีเมล<input id="accessEmail" type="email" required placeholder="name@company.com"></label>
        <label>ชื่อที่แสดง<input id="accessName" type="text" required placeholder="ชื่อ-นามสกุล"></label>
        <label>บทบาท<select id="accessRole">${Object.entries(DB.roles).map(([key, role]) => `<option value="${key}">${h(role.name)}</option>`).join("")}</select></label>
        <label class="access-active"><input id="accessActive" type="checkbox" checked> เปิดใช้งาน</label>
        <fieldset><legend>บริษัทที่รับผิดชอบ</legend><div class="company-access-grid">
          ${companyMaster().map((company) => `<label><input type="checkbox" name="accessCompany" value="${h(company.code)}"> ${h(company.code)}</label>`).join("")}
        </div><small>Audit Lead, ผู้บริหาร และผู้ดูแลระบบเห็นทุกบริษัทโดยตำแหน่งอยู่แล้ว</small></fieldset>
        <div class="access-submit"><small id="accessSubmitHint">ผู้ใช้ใหม่จะได้รับอีเมลเชิญเพื่อตั้งรหัสผ่าน</small><button class="primary-button" type="submit">ส่งคำเชิญและบันทึกสิทธิ์</button></div>
      </form>
    </section>

    <section class="panel">
      <div class="panel-heading"><div><p class="eyebrow">Permission Matrix</p><h2>สิทธิ์ตามบทบาท</h2></div>
      <span class="health ok">ไม่มีบทบาทใดลบข้อมูลได้</span></div>
      <div class="table-wrap">
        <table class="matrix">
          <thead><tr><th>ความสามารถ</th>${Object.values(DB.roles).map((r) => `<th class="center">${h(r.name)}</th>`).join("")}</tr></thead>
          <tbody>
            ${caps
              .map(
                ([k, label]) =>
                  `<tr><td>${h(label)}</td>${Object.keys(DB.roles)
                    .map((rk) => `<td class="center">${DB.roles[rk].can.includes(k) ? '<span class="yes">✓</span>' : '<span class="no">–</span>'}</td>`)
                    .join("")}</tr>`,
              )
              .join("")}
            <tr class="deny-row"><td>ลบ transaction / หลักฐาน</td>${Object.keys(DB.roles).map(() => `<td class="center"><span class="no">✕</span></td>`).join("")}</tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <div class="panel-heading"><div><p class="eyebrow">Users</p><h2>ผู้ใช้งานในระบบ</h2></div></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>อีเมล</th><th>ชื่อ</th><th>บทบาท</th><th>บริษัทที่รับผิดชอบ</th><th>สถานะ</th></tr></thead>
          <tbody>
            ${users
              .map(
                (u) => `<tr class="access-user-row" data-email="${h(u.email)}"><td class="mono">${h(u.email)}</td><td>${h(u.full_name || "-")}</td>
              <td><span class="badge blue">${h(DB.roles[u.role]?.name || u.role)}</span></td>
              <td>${(u.companies || []).length ? (u.companies || []).map((company) => `<span class="badge">${h(company)}</span>`).join(" ") : '<span class="muted">ทุกบริษัทตามบทบาท</span>'}</td>
              <td>${u.active ? '<span class="badge green">ใช้งาน</span>' : '<span class="badge red">ระงับ</span>'}</td></tr>`,
              )
              .join("") || `<tr><td colspan="5" class="empty">ยังไม่มีผู้ใช้ในทะเบียนสิทธิ์</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>`;

  const resetAccessForm = () => {
    $("#accessUserForm").reset();
    $("#accessActive").checked = true;
    $("#accessRole").value = "monitor";
    $("#accessEmail").readOnly = false;
    $("#accessFormTitle").textContent = "เพิ่มผู้ใช้ใหม่";
    $("#accessSubmitHint").textContent = "ผู้ใช้ใหม่จะได้รับอีเมลเชิญเพื่อตั้งรหัสผ่าน";
    $("#accessUserForm button[type='submit']").textContent = "ส่งคำเชิญและบันทึกสิทธิ์";
  };
  $("#newAccessUser")?.addEventListener("click", () => {
    resetAccessForm();
    $("#accessEmail").focus();
  });
  root.querySelectorAll(".access-user-row").forEach((row) => row.addEventListener("click", () => {
    const user = users.find((item) => item.email === row.dataset.email);
    if (!user) return;
    $("#accessEmail").value = user.email || "";
    $("#accessName").value = user.full_name || "";
    $("#accessRole").value = user.role || "monitor";
    $("#accessActive").checked = user.active !== false;
    $("#accessEmail").readOnly = true;
    $("#accessFormTitle").textContent = "แก้สิทธิ์ผู้ใช้";
    $("#accessSubmitHint").textContent = "บันทึกการเปลี่ยนแปลงโดยไม่ส่งคำเชิญซ้ำ";
    $("#accessUserForm button[type='submit']").textContent = "บันทึกการเปลี่ยนแปลง";
    const selected = new Set(user.companies || []);
    $$('[name="accessCompany"]', root).forEach((box) => { box.checked = selected.has(box.value); });
    $("#accessEmail").scrollIntoView({ behavior: "smooth", block: "center" });
  }));
  $("#accessUserForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    button.textContent = "กำลังบันทึก...";
    try {
      const companies = $$('[name="accessCompany"]:checked', root).map((box) => box.value);
      const email = $("#accessEmail").value.trim().toLowerCase();
      const existing = users.some((user) => String(user.email || "").toLowerCase() === email);
      if (existing) {
        await Sb.adminSaveUserAccess(email, $("#accessName").value, $("#accessRole").value, $("#accessActive").checked, companies);
      } else {
        await Sb.adminInviteUser(email, $("#accessName").value, $("#accessRole").value, $("#accessActive").checked, companies);
      }
      toast(existing ? "บันทึกบทบาทและบริษัทที่รับผิดชอบแล้ว" : "ส่งอีเมลเชิญและกำหนดสิทธิ์แล้ว");
      logAction("update", "user_access", $("#accessEmail").value, `${$("#accessRole").value} · ${companies.join(", ") || "ทุกบริษัทตามบทบาท"}`);
      VIEWS.users(root);
    } catch (error) {
      toast("บันทึกสิทธิ์ไม่สำเร็จ: " + error.message, "warn");
    } finally {
      button.disabled = false;
      button.textContent = users.some((user) => String(user.email || "").toLowerCase() === $("#accessEmail").value.trim().toLowerCase()) ? "บันทึกการเปลี่ยนแปลง" : "ส่งคำเชิญและบันทึกสิทธิ์";
    }
  });
};

/* =============================================================
   VIEW: Audit log
   ============================================================= */
VIEWS["audit-log"] = (root) => {
  if (!ensureLiveOverview(root)) return;
  const logs = DB.auditLog.filter((l) => inRange(String(l.at).slice(0, 10)));
  const logsAvailable = liveOverviewState.logsReady;
  root.innerHTML = `
    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Audit Log</p><h2>${logsAvailable ? `บันทึกทุกการเปลี่ยนแปลง (${logs.length} จาก ${DB.auditLog.length} รายการ)` : "กำลังรอบันทึกจากฐานข้อมูลจริง"}</h2><small class="head-sub">ช่วงข้อมูล ${h(rangeLabel())}${logsAvailable ? "" : " · ยังไม่สรุปเป็น 0"}</small></div>
        <div class="inline-actions">
          <input type="search" id="logSearch" placeholder="ค้นหา user / เคส / action" />
          <button class="ghost-button sm" id="logExport">Export CSV</button>
        </div>
      </div>
      <div class="table-wrap">
        <table id="logTable">
          <thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>Action</th><th>Entity</th><th>เป้าหมาย</th><th>รายละเอียด</th></tr></thead>
          <tbody>
            ${logs
              .map(
                (l) => `<tr><td class="mono">${h(l.at)}</td><td>${h(l.user)}</td>
              <td><span class="badge blue">${h(l.action)}</span></td><td>${h(l.entity)}</td>
              <td class="mono">${h(l.target)}</td><td class="muted">${h(l.detail)}</td></tr>`,
              )
              .join("") || `<tr><td colspan="6" class="empty">${logsAvailable ? "ยังไม่มีบันทึกในช่วงนี้" : "ข้อมูล Audit Log ยังโหลดไม่สำเร็จ — กดลองใหม่จากแถบแจ้งเตือนด้านบน"}</td></tr>`}
          </tbody>
        </table>
      </div>
      <p class="hint">Audit log เขียนได้อย่างเดียว (append-only) ไม่มีบทบาทใดแก้หรือลบได้ ตามข้อกำหนด non-functional</p>
    </section>`;

  $("#logSearch").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    $$("#logTable tbody tr").forEach((tr) => (tr.style.display = tr.textContent.toLowerCase().includes(q) ? "" : "none"));
  });
  $("#logExport").addEventListener("click", () =>
    exportSheets("audit-log", [
      {
        name: "Audit Log",
        title: "บันทึกการใช้งานระบบ",
        headers: ["เวลา", "ผู้ใช้", "action", "entity", "target", "รายละเอียด"],
        widths: [20, 18, 16, 16, 22, 60],
        rows: logs.map((l) => [l.at, l.user, l.action, l.entity, l.target, l.detail]),
      },
    ]),
  );
};

/* =============================================================
   VIEW: Cloud - คลังไฟล์จาก Supabase (n8n ส่งเข้ามาจากเมล)
   ============================================================= */
const cloudState = { batches: null, daily: null, operations: null, loading: false, error: null, partialError: null, key: "", requestId: 0, picked: {}, busy: "", activeJob: null, fileView: "all" };

const cloudQueryKey = () => `${state.filters.from || ""}|${state.filters.to || ""}|${state.filters.company || "ALL"}`;

function isTransientFileError(error) {
  return /timeout|timed out|abort|network|fetch|connection|temporar|gateway|database/i.test(String(error?.message || error || ""));
}

async function retryTransientFileRequest(action, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await action(); }
    catch (error) {
      lastError = error;
      if (attempt >= attempts || !isTransientFileError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
    }
  }
  throw lastError;
}

function filePreviewTable(rows) {
  const use = (rows || []).slice(0, 50).map((row) => (row || []).slice(0, 20));
  const width = Math.max(1, ...use.map((row) => row.length));
  return `<div class="file-preview-note">แสดงตัวอย่าง ${num(use.length)} แถวแรก · สูงสุด ${num(width)} คอลัมน์</div><div class="file-preview-table"><table><tbody>${use.map((row, index) => `<tr>${Array.from({ length: width }, (_, col) => `<${index === 0 ? "th" : "td"}>${h(row[col] ?? "")}</${index === 0 ? "th" : "td"}>`).join("")}</tr>`).join("") || `<tr><td class="empty">ไฟล์ไม่มีข้อมูลที่แสดงตัวอย่างได้</td></tr>`}</tbody></table></div>`;
}

function updateSourceFileCaches(fileId, changes) {
  const seen = new Set();
  [cloudState.batches, liveIntakeState.batches, dailyCompanyState.batches].forEach((batches) => {
    if (!Array.isArray(batches) || seen.has(batches)) return;
    seen.add(batches);
    batches.forEach((batch) => (batch.source_files || []).forEach((file) => {
      if (file.id === fileId) Object.assign(file, changes);
    }));
  });
}

function exportOcrExcel(meta, ocr) {
  const parsedRows = Array.isArray(ocr.rows) ? ocr.rows : [];
  let headers;
  let rows;
  if (parsedRows.length) {
    headers = ["วันที่", "เวลา", "บริษัท", "ธนาคาร/ช่องทาง", "บัญชี", "ทิศทาง", "จำนวนเงิน", "ยอดคงเหลือ", "รายละเอียด", "แถวต้นฉบับ"];
    const timeOf = (sec) => Number.isFinite(Number(sec)) ? Engine.hhmmss(Number(sec)) : "";
    rows = parsedRows.map((row) => [
      row.date || meta.date || "", timeOf(row.sec), row.subco || row.company || meta.company || "",
      row.bank || row.channel || "", row.account || "", row.direction || "", row.amount ?? "",
      row.balance ?? "", row.desc || row.detail || "", row.raw || "",
    ]);
  } else {
    headers = ["ลำดับ", "ข้อความที่ OCR อ่านได้"];
    rows = String(ocr.extracted_text || "").split(/\r?\n/).filter((line) => line.trim()).map((line, index) => [index + 1, line]);
  }
  const result = Exporter.workbook([{ name: "OCR", headers, rows, widths: headers.map((_, index) => index === headers.length - 1 ? 52 : 18) }],
    `${String(meta.name || "pdf-ocr").replace(/\.pdf$/i, "")}-OCR.xlsx`,
    { title: `ผล OCR: ${meta.name || "PDF"}`, subject: `Google Document AI · ความมั่นใจ ${Math.round(Number(ocr.confidence || 0) * 100)}%` });
  if (!result.ok) throw new Error(result.reason || "สร้าง Excel ไม่สำเร็จ");
}

async function validateReplacementFile(file) {
  if (!file || !file.size) throw new Error("ไฟล์ใหม่ไม่มีข้อมูล");
  if (file.size > 50 * 1024 * 1024) throw new Error("ไฟล์ใหม่ต้องมีขนาดไม่เกิน 50 MB");
  const ext = (String(file.name || "").split(".").pop() || "").toLowerCase();
  if (!["xlsx", "xlsm", "csv", "txt", "pdf", "docx"].includes(ext)) {
    throw new Error("รองรับไฟล์ XLSX, XLSM, CSV, TXT, PDF และ DOCX เท่านั้น");
  }
  const buffer = await file.arrayBuffer();
  if (["xlsx", "xlsm"].includes(ext)) {
    try { await XlsxReader.read(buffer); }
    catch (error) { throw new Error("ไฟล์ Excel ใหม่ยังเปิดไม่ได้ กรุณาเปิดใน Excel แล้ว Save As เป็น .xlsx ก่อนอัปโหลด"); }
  } else if (ext === "pdf") {
    const signature = new TextDecoder("latin1").decode(new Uint8Array(buffer.slice(0, 5)));
    if (signature !== "%PDF-") throw new Error("ไฟล์ที่เลือกใช้นามสกุล PDF แต่เนื้อหาไม่ใช่ PDF ที่สมบูรณ์");
  } else if (ext === "docx") {
    const bytes = new Uint8Array(buffer.slice(0, 2));
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error("ไฟล์ DOCX ใหม่ไม่สมบูรณ์ กรุณาเปิดและบันทึกใหม่ก่อนอัปโหลด");
  }
  return true;
}

async function openStoredFilePreview(meta) {
  const name = meta.name || "ไฟล์ต้นฉบับ";
  const ext = (name.split(".").pop() || "").toLowerCase();
  const sizeLabel = meta.size ? `${Math.round(Number(meta.size) / 1024).toLocaleString()} KB` : "ไม่ระบุขนาด";
  const status = meta.status === "error" ? "อ่านไม่ได้" : meta.status === "parsed" ? "พร้อมใช้งาน" : "รอตรวจ";
  const companyOptions = companyMaster().map((company) => company.code).filter((code, index, rows) => rows.indexOf(code) === index);
  if (meta.company && !companyOptions.includes(meta.company)) companyOptions.unshift(meta.company);
  const kindOptions = [
    ["stm_pdf", "STM ฝาก-ถอน", "Statement หรือรายการเดินบัญชีธนาคาร"],
    ["bo_main", "BO รายงานหลังบ้าน", "รายงานหน้า BO ของบริษัท"],
    ["pm_statement", "PM ฝาก/ถอน", "AUTOPEER, AZPAY, CYBERPLUS, MYPAY หรือ 12PAY"],
    ["manual_credit", "ฝากมือ - เครดิต", "รายการเติมเครดิตด้วยมือ"],
    ["manual_payment", "ฝากมือ - Payment", "รายการฝากมือฝั่ง Payment"],
    ["manual_bonus", "ฝากมือ - โบนัส", "รายการโบนัส"],
    ["comm_req", "ถอนค่าคอมมิชชั่น", "รายการถอนคอมมิชชั่น"],
    ["credit_out", "ถอนเครดิต", "รายงานถอนเครดิต"],
    ["doc_clarify", "ไฟล์ชี้แจง/หลักฐาน", "เอกสารตอบข้อสงสัยหรือหลักฐานเพิ่มเติม"],
    ["unknown", "ยังไม่ทราบประเภท", "ใช้เมื่อยังไม่สามารถยืนยันประเภทไฟล์ได้"],
  ];
  const selectedKindHelp = (kindOptions.find(([kind]) => kind === meta.kind) || kindOptions[kindOptions.length - 1])[2];
  const canReclassify = state.dataset === "production" && meta.id && typeof Sb !== "undefined" && Sb.signedIn();
  const canMatchClarification = canReclassify && meta.kind === "doc_clarify";
  const clarificationPanel = canMatchClarification ? `<section class="file-clarification-match" id="fileClarificationMatch">
    <div class="file-clarification-head"><div><small>ใช้ไฟล์นี้เป็นหลักฐาน</small><b>จับคู่กับเคสที่ยังไม่พบคู่ของ ${h(meta.company || "บริษัทนี้")}</b><span>เลือกได้หลายเคสหรือเลือกทั้งหมด ระบบจะส่งสถานะเป็น “มีคำชี้แจง—รอ Audit ตรวจ” และยังไม่ปิดเคสอัตโนมัติ</span></div><span class="spinner" id="fileClarificationSpinner"></span></div>
    <div class="file-clarification-tools">
      <label><input type="checkbox" id="fileClarificationSameDay" checked> เฉพาะวันที่ ${h(meta.date || "เดียวกับไฟล์")}</label>
      <label><input type="checkbox" id="fileClarificationMissingOnly" checked> เฉพาะเคสที่ยังไม่พบคู่</label>
      <button class="ghost-button" id="fileClarificationSelectAll" type="button">เลือกทั้งหมดที่แสดง</button>
      <b id="fileClarificationCount">กำลังค้นหาเคส...</b>
    </div>
    <div class="file-clarification-list" id="fileClarificationList"><div class="empty">กำลังโหลดเคสของบริษัท...</div></div>
    <label class="file-clarification-note">บันทึกสำหรับผู้ตรวจ<textarea id="fileClarificationNote" rows="2">แนบไฟล์ชี้แจงจากทีม — รอ Audit ตรวจสอบและอนุมัติ</textarea></label>
  </section>` : "";
  openModal(
    h(name),
    `<div class="file-preview-meta"><span><b>บริษัท</b>${h(meta.company || "ไม่ระบุ")}</span><span><b>วันที่</b>${h(meta.date || "-")}</span><span><b>ประเภท</b>${h(KIND_LABEL[meta.kind] || meta.kind || ext.toUpperCase() || "-")}</span><span><b>ขนาด</b><i id="filePreviewSize">${h(sizeLabel)}</i></span><span><b>สถานะ</b><i id="filePreviewStatus">${h(status)}</i></span></div>${clarificationPanel}${canReclassify ? `<div class="file-replacement-ready" id="fileReplacementReady" hidden><div class="file-replacement-ready-head"><i aria-hidden="true">✓</i><div><b>ไฟล์ใหม่พร้อมตรวจ</b><small>ระบบยังเก็บไฟล์เดิมไว้ จนกว่าคุณจะกด “บันทึกและรันต่อ”</small></div></div><div class="file-replacement-compare"><div><small>ไฟล์เดิม</small><span>${h(name)}</span></div><i aria-hidden="true">→</i><div><small>ไฟล์ใหม่</small><span id="fileReplacementReadyName"></span></div></div></div><div class="file-preview-editor"><div><label for="fileCompanySelect">บริษัท</label><select id="fileCompanySelect">${companyOptions.map((company) => `<option value="${h(company)}" ${company === meta.company ? "selected" : ""}>${h(company)}</option>`).join("")}</select></div><div><label for="fileKindSelect">ประเภทไฟล์</label><select id="fileKindSelect">${kindOptions.map(([kind, label, description]) => `<option value="${h(kind)}" title="${h(description)}" ${kind === meta.kind ? "selected" : ""}>${h(label)}</option>`).join("")}</select><small class="file-kind-help" id="fileKindHelp">${h(selectedKindHelp)}</small></div><p>เลือกให้ถูกต้องแล้วกด “บันทึกและรันต่อ” ระบบจะล้างข้อผิดพลาดเดิมและส่งไฟล์กลับไปตรวจใหม่</p></div>` : ""}<div class="file-preview-content" id="filePreviewContent"><span class="spinner"></span><p>กำลังเตรียมตัวอย่างไฟล์...</p></div>`,
    `<button class="ghost-button" id="filePreviewClose">ปิด</button><button class="ghost-button" id="fileOpenOriginal">เปิดต้นฉบับในแท็บใหม่</button><button class="ghost-button" id="fileDownload">ดาวน์โหลดไฟล์</button>${canReclassify ? `<input id="fileReplacementInput" type="file" accept=".xlsx,.xlsm,.csv,.txt,.pdf,.docx" hidden><button class="ghost-button" id="fileReplaceUpload">อัปโหลดไฟล์ใหม่แทนที่</button><button class="primary-button" id="fileReclassify">บันทึกและรันต่อ</button>` : ""}${canMatchClarification ? `<button class="primary-button" id="fileMatchClarification" disabled>จับคู่กับเคสที่เลือก</button>` : ""}`,
  );
  $("#modal").classList.add("file-preview-modal");
  $("#filePreviewClose").addEventListener("click", closeModal);
  let signedUrl = "";
  let downloaded = null;
  let pendingReplacementFile = null;
  let pendingReplacementObjectUrl = "";
  const getSigned = async () => signedUrl || (signedUrl = await retryTransientFileRequest(() => Sb.signedUrl(meta.path, 600)));
  const getDownload = async () => downloaded || (downloaded = await retryTransientFileRequest(() => Sb.download(meta.path)));
  if (canMatchClarification) {
    const selectedCases = new Set();
    let clarificationCandidates = [];
    const isOpen = (row) => !["closed", "approved", "damage"].includes(row.status);
    const isMissingPair = (row) => row.bankAmount == null || row.systemAmount == null || /ไม่พบ|มากกว่า|missing/i.test(`${row.type} ${row.typeName}`);
    const visibleCandidates = () => clarificationCandidates.filter((row) => {
      if (!isOpen(row)) return false;
      if ($("#fileClarificationSameDay")?.checked && meta.date && row.date !== meta.date) return false;
      if ($("#fileClarificationMissingOnly")?.checked && !isMissingPair(row)) return false;
      return true;
    });
    const renderClarificationCandidates = () => {
      const list = $("#fileClarificationList");
      if (!list) return;
      const visible = visibleCandidates();
      list.innerHTML = visible.length ? visible.map((row) => `<label class="file-clarification-case ${selectedCases.has(row.dbId) ? "selected" : ""}">
        <input type="checkbox" value="${h(row.dbId)}" ${selectedCases.has(row.dbId) ? "checked" : ""}>
        <span><b>${h(row.id)}</b><small>${h(row.date)} · ${h(row.typeName)}</small></span>
        <span><b>${h(row.account || row.bank || "-")}</b><small>${h(row.direction || "-")}</small></span>
        <span class="file-clarification-amount"><b>STM ${row.bankAmount == null ? "—" : money(row.bankAmount)}</b><small>BO ${row.systemAmount == null ? "—" : money(row.systemAmount)}</small></span>
      </label>`).join("") : `<div class="empty">ไม่พบเคสค้างตามตัวกรองนี้ ลองปิด “เฉพาะวันที่” หรือ “เฉพาะเคสที่ยังไม่พบคู่”</div>`;
      list.querySelectorAll('input[type="checkbox"]').forEach((input) => input.addEventListener("change", () => {
        if (input.checked) selectedCases.add(input.value); else selectedCases.delete(input.value);
        renderClarificationCandidates();
      }));
      $("#fileClarificationCount").textContent = `เลือก ${num(selectedCases.size)} จาก ${num(visible.length)} เคสที่แสดง`;
      $("#fileMatchClarification").disabled = selectedCases.size === 0;
    };
    $("#fileClarificationSameDay").addEventListener("change", renderClarificationCandidates);
    $("#fileClarificationMissingOnly").addEventListener("change", renderClarificationCandidates);
    $("#fileClarificationSelectAll").addEventListener("click", () => {
      const visible = visibleCandidates();
      const allSelected = visible.length && visible.every((row) => selectedCases.has(row.dbId));
      visible.forEach((row) => allSelected ? selectedCases.delete(row.dbId) : selectedCases.add(row.dbId));
      renderClarificationCandidates();
    });
    $("#fileMatchClarification").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const ids = [...selectedCases];
      if (!ids.length) return;
      button.disabled = true;
      button.textContent = `กำลังจับคู่ ${num(ids.length)} เคส...`;
      try {
        const note = $("#fileClarificationNote").value.trim();
        const result = await Sb.manualMatchClarificationFile(meta.id, ids, note);
        DB.exceptions.forEach((row) => {
          if (!ids.includes(row.dbId)) return;
          Object.assign(row, {
            status: "answered", hasEvidence: true, clarificationFileId: meta.id,
            resolutionNote: note, resolvedBy: Sb.currentEmail() || "web-auditor", matchConfidence: 100,
          });
        });
        exceptionSupportCache.clear();
        logAction("clarification_manual_multi_match", "source_file", meta.id, `จับคู่ ${name} กับ ${ids.length} เคสของ ${meta.company}`);
        closeModal();
        toast(`แนบไฟล์ชี้แจงกับ ${num(result?.matched_count || ids.length)} เคสแล้ว — รอ Audit ตรวจและอนุมัติ`, "ok");
        render();
        setTimeout(() => loadLiveOverview(true), 300);
      } catch (error) {
        button.disabled = false;
        button.textContent = "จับคู่กับเคสที่เลือก";
        toast(`จับคู่ไฟล์ชี้แจงไม่สำเร็จ: ${error.message}`, "warn");
      }
    });
    const localRows = DB.exceptions.filter((row) => String(row.company).toUpperCase() === String(meta.company || "").toUpperCase());
    clarificationCandidates = localRows;
    renderClarificationCandidates();
    Sb.currentExceptionsSummary({ from: OPERATING_START_DATE, to: DEFAULT_WORK_DATE, company: meta.company, limit: 5000 })
      .then((rows) => {
        const merged = new Map(localRows.map((row) => [row.dbId, row]));
        (rows || []).map(mapLiveException).forEach((row) => merged.set(row.dbId, row));
        clarificationCandidates = [...merged.values()].sort((a, b) => (a.date === meta.date ? -1 : 0) - (b.date === meta.date ? -1 : 0) || String(b.date).localeCompare(String(a.date)) || String(a.time).localeCompare(String(b.time)));
        $("#fileClarificationSpinner")?.remove();
        renderClarificationCandidates();
      })
      .catch((error) => {
        $("#fileClarificationSpinner")?.remove();
        $("#fileClarificationCount").textContent = localRows.length ? `แสดงข้อมูลที่โหลดไว้ ${num(localRows.length)} เคส` : `โหลดเคสไม่สำเร็จ: ${error.message}`;
      });
  }
  $("#fileOpenOriginal").addEventListener("click", async () => {
    try {
      window.open(await getSigned(), "_blank", "noopener");
      logAction("view_file", "source_file", meta.id || meta.path, `เปิดไฟล์ต้นฉบับ ${name} ในแท็บใหม่`);
    } catch (error) { toast(error.message, "warn"); }
  });
  $("#fileDownload").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const old = button.textContent;
    button.disabled = true;
    button.textContent = "กำลังดาวน์โหลด...";
    try {
      const buffer = await getDownload();
      const blob = new Blob([buffer], { type: meta.mime || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      document.body.appendChild(anchor);
      anchor.click();
      setTimeout(() => { URL.revokeObjectURL(url); anchor.remove(); }, 1000);
      logAction("download_file", "source_file", meta.id || meta.path, `ดาวน์โหลดไฟล์ ${name}`);
      toast("เริ่มดาวน์โหลด " + name);
    } catch (error) { toast(error.message, "warn"); }
    button.disabled = false;
    button.textContent = old;
  });
  if (canReclassify) $("#fileKindSelect").addEventListener("change", (event) => {
    const option = kindOptions.find(([kind]) => kind === event.target.value);
    $("#fileKindHelp").textContent = option ? option[2] : "ตรวจเนื้อหาไฟล์ก่อนยืนยันประเภท";
  });
  if (canReclassify) $("#fileReclassify").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const old = button.textContent;
    const company = $("#fileCompanySelect").value;
    const kind = $("#fileKindSelect").value;
    button.disabled = true;
    button.textContent = pendingReplacementFile ? "กำลังอัปโหลดและบันทึก..." : "กำลังบันทึก...";
    try {
      const replacement = pendingReplacementFile;
      const result = replacement
        ? await Sb.replaceSourceFile(meta.id, meta.path, replacement, company, kind)
        : await Sb.reclassifySourceFile(meta.id, company, kind);
      logAction(
        replacement ? "replace_source_file_and_retry" : "reclassify_and_retry",
        "source_file",
        meta.id,
        replacement ? `${name} → ${replacement.name}` : `${name} → ${company} / ${kind}`,
      );
      updateSourceFileCaches(meta.id, {
        ...(replacement ? {
          file_name: result?.file_name || replacement.name,
          mime_type: result?.mime_type || replacement.type || "application/octet-stream",
          size_bytes: result?.size_bytes || replacement.size,
          storage_path: result?.storage_path,
          checksum: result?.checksum || null,
        } : {}),
        company,
        kind,
        parsed: false,
        parsed_at: null,
        row_count: null,
        parse_error: null,
      });
      closeModal();
      const queued = result && result.queued;
      toast(
        replacement
          ? (queued ? "แทนที่ไฟล์แล้ว และส่งไฟล์ใหม่เข้าคิวตรวจแล้ว" : "แทนที่ไฟล์แล้ว — ยังรอไฟล์บังคับให้ครบก่อนเข้าคิว")
          : (queued ? "บันทึกแล้ว และส่งเข้าคิวกระทบยอดแล้ว" : "บันทึกแล้ว — ยังรอไฟล์บังคับให้ครบก่อนเข้าคิว"),
        queued ? "ok" : "warn",
      );
      render();
      // Save feels immediate; refresh only the page currently in use instead
      // of reloading dashboard, intake, daily summary and cloud concurrently.
      setTimeout(() => {
        if (state.route === "cloud") cloudLoad();
        else if (state.route === "daily-summary") loadDailyCompanySummary(true);
        else if (state.route === "intake") loadLiveIntake(true);
        else loadLiveOverview(true);
      }, 300);
    } catch (error) {
      const action = pendingReplacementFile ? "แทนที่ไฟล์ไม่สำเร็จ" : "บันทึกประเภทไฟล์ไม่สำเร็จ";
      const detail = String(error?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
      toast(`${action}: ${detail}`, "warn");
      button.disabled = false;
      button.textContent = old;
    }
  });
  if (canReclassify) {
    const replacementInput = $("#fileReplacementInput");
    const replacementButton = $("#fileReplaceUpload");
    replacementButton.addEventListener("click", () => {
      replacementInput.value = "";
      replacementInput.click();
    });
    replacementInput.addEventListener("change", async () => {
      const file = replacementInput.files && replacementInput.files[0];
      if (!file) return;
      const saveButton = $("#fileReclassify");
      const oldLabel = replacementButton.textContent;
      try {
        replacementButton.disabled = true;
        saveButton.disabled = true;
        replacementButton.textContent = "กำลังตรวจไฟล์ใหม่...";
        await validateReplacementFile(file);
        pendingReplacementFile = file;
        const target = $("#filePreviewContent");
        const replacementExt = (file.name.split(".").pop() || "").toLowerCase();
        const buffer = await file.arrayBuffer();
        target.innerHTML = `<span class="spinner"></span><p>กำลังแสดงตัวอย่างไฟล์ใหม่...</p>`;
        if (pendingReplacementObjectUrl) URL.revokeObjectURL(pendingReplacementObjectUrl);
        pendingReplacementObjectUrl = "";
        if (replacementExt === "pdf") {
          pendingReplacementObjectUrl = URL.createObjectURL(file);
          target.innerHTML = `<iframe class="file-preview-frame" src="${h(pendingReplacementObjectUrl)}" title="ตัวอย่าง ${h(file.name)}"></iframe>`;
        } else if (["xlsx", "xlsm"].includes(replacementExt)) {
          target.innerHTML = filePreviewTable(await XlsxReader.read(buffer));
        } else if (["csv", "txt"].includes(replacementExt)) {
          const text = new TextDecoder("utf-8").decode(buffer);
          target.innerHTML = filePreviewTable(replacementExt === "csv" ? Engine.parseCSV(text) : text.split(/\r?\n/).map((line) => [line]));
        } else if (replacementExt === "docx") {
          const preview = await DocxReader.render(buffer);
          target.replaceChildren(preview.element);
          $("#modal")._contentCleanup = () => {
            preview.cleanup();
            if (pendingReplacementObjectUrl) URL.revokeObjectURL(pendingReplacementObjectUrl);
          };
        }
        if (replacementExt !== "docx") $("#modal")._contentCleanup = () => {
          if (pendingReplacementObjectUrl) URL.revokeObjectURL(pendingReplacementObjectUrl);
        };
        $("#modalTitle").textContent = file.name;
        $("#filePreviewSize").textContent = `${Math.max(1, Math.round(file.size / 1024)).toLocaleString()} KB`;
        $("#filePreviewStatus").textContent = "ไฟล์ใหม่พร้อมบันทึก";
        $("#fileReplacementReadyName").textContent = file.name;
        $("#fileReplacementReady").hidden = false;
        replacementButton.textContent = "เปลี่ยนไฟล์ใหม่อีกครั้ง";
        $("#fileOpenOriginal").textContent = "เปิดไฟล์เดิมในแท็บใหม่";
        $("#fileDownload").textContent = "ดาวน์โหลดไฟล์เดิม";
        toast("แสดงไฟล์ใหม่แล้ว ตรวจข้อมูลก่อนกดบันทึกและรันต่อ", "ok");
      } catch (error) {
        pendingReplacementFile = null;
        toast("ตรวจไฟล์ใหม่ไม่สำเร็จ: " + error.message, "warn");
      } finally {
        if (replacementButton && document.body.contains(replacementButton)) {
          replacementButton.disabled = false;
          if (!pendingReplacementFile) replacementButton.textContent = oldLabel;
        }
        if (saveButton && document.body.contains(saveButton)) saveButton.disabled = false;
      }
    });
  }

  try {
    const target = $("#filePreviewContent");
    if (!target) return;
    if (["pdf"].includes(ext) || String(meta.mime).includes("pdf")) {
      const originalUrl = await getSigned();
      if (pendingReplacementFile) return;
      target.innerHTML = `<iframe class="file-preview-frame" src="${h(originalUrl)}" title="ตัวอย่าง ${h(name)}"></iframe>`;
      if (canReclassify && typeof Sb.fileOcr === "function") {
        try {
          const ocr = await Sb.fileOcr(meta.id);
          if (ocr) {
            target.insertAdjacentHTML("afterbegin", `<div class="file-ocr-summary"><div><b>อ่าน PDF ด้วย OCR แล้ว</b><span>${num(ocr.page_count)} หน้า · ความมั่นใจ ${num(Math.round(Number(ocr.confidence || 0) * 100))}% · ${num(ocr.line_count)} บรรทัด</span></div><button class="ghost-button" id="fileOcrExcel">ดาวน์โหลด Excel OCR</button></div>`);
            $("#fileOcrExcel").addEventListener("click", () => {
              try { exportOcrExcel(meta, ocr); toast("สร้าง Excel จากผล OCR แล้ว", "ok"); }
              catch (error) { toast(error.message, "warn"); }
            });
          }
        } catch (error) {
          console.warn("Load OCR evidence failed", error);
        }
      }
    } else if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext) || String(meta.mime).startsWith("image/")) {
      const originalUrl = await getSigned();
      if (pendingReplacementFile) return;
      target.innerHTML = `<img class="file-preview-image" src="${h(originalUrl)}" alt="ตัวอย่าง ${h(name)}" />`;
    } else if (["xlsx", "xlsm"].includes(ext)) {
      const originalRows = await XlsxReader.read(await getDownload());
      if (pendingReplacementFile) return;
      target.innerHTML = filePreviewTable(originalRows);
    } else if (["csv", "txt"].includes(ext)) {
      const text = new TextDecoder("utf-8").decode(await getDownload());
      if (pendingReplacementFile) return;
      target.innerHTML = filePreviewTable(ext === "csv" ? Engine.parseCSV(text) : text.split(/\r?\n/).map((line) => [line]));
    } else if (ext === "docx" || String(meta.mime).includes("wordprocessingml")) {
      const preview = await DocxReader.render(await getDownload());
      if (pendingReplacementFile) { preview.cleanup(); return; }
      target.replaceChildren(preview.element);
      $("#modal")._contentCleanup = preview.cleanup;
    } else {
      target.innerHTML = `<div class="file-preview-unavailable"><b>ไฟล์ชนิดนี้ยังแสดงตัวอย่างในหน้าเว็บไม่ได้</b><span>ตรวจรายละเอียดด้านบน แล้วเลือก “เปิดต้นฉบับ” หรือ “ดาวน์โหลดไฟล์” เมื่อต้องการ</span></div>`;
    }
    logAction("preview_file", "source_file", meta.id || meta.path, `ดูตัวอย่างไฟล์ ${name}`);
  } catch (error) {
    const target = $("#filePreviewContent");
    if (target) target.innerHTML = `<div class="file-preview-unavailable bad"><b>สร้างตัวอย่างไม่สำเร็จหลังลองใหม่ 3 ครั้ง</b><span>${h(error.message)}</span><small>ยังสามารถเปิดต้นฉบับหรือดาวน์โหลดได้จากปุ่มด้านล่าง หรือปิดแล้วเปิด Preview ใหม่</small></div>`;
  }
}

function bindStoredFileLinks(root, selector = "[data-storage-open]") {
  root.querySelectorAll(selector).forEach((button) => button.addEventListener("click", () => openStoredFilePreview({
    path: button.dataset.storageOpen,
    id: button.dataset.fileId,
    name: button.dataset.fileName,
    mime: button.dataset.fileMime,
    size: button.dataset.fileSize,
    kind: button.dataset.fileKind,
    company: button.dataset.fileCompany,
    date: button.dataset.fileDate,
    status: button.dataset.fileStatus,
  })));
}

async function cloudLoad(force = false) {
  const key = cloudQueryKey();
  if (cloudState.loading && !force) return;
  if (!force && cloudState.key === key && cloudState.batches !== null) return;
  const requestId = ++cloudState.requestId;
  const changedFilter = cloudState.key !== key;
  cloudState.key = key;
  cloudState.loading = true;
  cloudState.error = null;
  cloudState.partialError = null;
  if (changedFilter) {
    cloudState.batches = null;
    cloudState.daily = null;
    cloudState.operations = null;
    cloudState.picked = {};
  }
  render();
  const to = state.filters.to || DB.BUSINESS_DATE;
  const from = state.filters.from || to;
  const result = await Promise.allSettled([
    Sb.batches({ from, to, company: state.filters.company }),
    Sb.dailyStatus({ from, to, company: state.filters.company, limit: 100 }),
    Sb.operations({ from, to, company: state.filters.company, limit: 200 }),
  ]);
  if (requestId !== cloudState.requestId || key !== cloudQueryKey()) return;
  if (result[0].status === "fulfilled") cloudState.batches = result[0].value || [];
  if (result[1].status === "fulfilled") cloudState.daily = result[1].value || [];
  if (result[2].status === "fulfilled") cloudState.operations = result[2].value || [];
  const failed = result.flatMap((item, index) => item.status === "rejected" ? [["รายการเมล/ไฟล์", "สรุปรายวัน", "คิวกระทบยอด"][index]] : []);
  if (failed.length) {
    cloudState.partialError = `โหลดไม่สำเร็จ: ${failed.join(", ")}`;
    cloudState.error = result[0].status === "rejected" ? `${cloudState.partialError} — ยังไม่แสดงจำนวนไฟล์เพื่อป้องกันยอดศูนย์ปลอม` : null;
  }
  cloudState.loading = false;
  render();
}

/* โหลดไฟล์จาก Storage แล้วส่งเข้าตัวอ่านเดิม */
async function cloudImport(files, opts = {}) {
  const blocked = files.filter((file) => file.parse_error || file.kind === "unknown");
  files = files.filter((file) => !file.parse_error && file.kind !== "unknown");
  if (blocked.length) toast(`พักไฟล์ปัญหา ${num(blocked.length)} ไฟล์ไว้ก่อน — ต้องแก้ประเภทหรือข้อผิดพลาดก่อนรัน`, "warn");
  if (!files.length) {
    if (opts.job) throw new Error(`พักคิวไว้ก่อน: มีไฟล์ปัญหา ${blocked.length} ไฟล์และยังไม่มีไฟล์พร้อมรัน`);
    return toast("ยังไม่มีไฟล์ที่พร้อมรัน", "warn");
  }
  if (opts.clear) {
    ImportState.files = [];
    ImportState.lastRun = null;
  }
  cloudState.activeJob = opts.job || null;
  showProgress("กำลังดึงไฟล์จากคลังและอ่านเข้าระบบ");
  let ok = 0;
  const failed = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    setProgress((i + 1) / files.length, f.file_name);
    try {
      const buf = await Sb.download(f.storage_path);
      const norm = await ingestRaw(f.file_name, buf, buf.byteLength, {
        fileId: f.id,
        storagePath: f.storage_path,
        businessDate: opts.job?.business_date,
      });
      const n = norm.records.length + (norm.aux || []).length;
      ok++;
      Sb.markParsed(f.id, n, null).catch(() => {});
    } catch (e) {
      failed.push(`${f.file_name}: ${e.message}`);
      Sb.markParsed(f.id, null, e.message).catch(() => {});
    }
  }
  hideProgress();
  logAction("cloud_import", "source_file", `${ok} ไฟล์`, `ดึงจากคลัง Supabase ${ok} ไฟล์${blocked.length ? ` · พักไฟล์ปัญหา ${blocked.length}` : ""}${failed.length ? ` · ผิดพลาด ${failed.length}` : ""}`);
  toast(`อ่านเข้าระบบแล้ว ${ok} ไฟล์${blocked.length ? ` · พักไฟล์ปัญหา ${blocked.length}` : ""}${failed.length ? ` · ไม่สำเร็จ ${failed.length}` : ""}`);
  if (failed.length) console.warn(failed);
  cloudState.picked = {};
  await runReconcileFromImport({ reason: opts.job ? "คิวกระทบยอดรายวัน" : "ดึงจากคลังไฟล์", job: opts.job || null });
}

VIEWS.cloud = (root) => {
  const c = Sb.cfg();
  const ready = Sb.configured();
  const inSession = Sb.signedIn();

  if (!ready || !inSession) {
    showLoginGate();
    root.innerHTML = "";
    return;
  }

  /* หน้า Production ไม่เปิดให้แก้ URL/key จากหน้าเว็บ */
  if (false) {
    root.innerHTML = `
      <section class="panel">
        <div class="panel-heading">
          <div><p class="eyebrow">Cloud Inbox</p><h2>เชื่อมต่อคลังไฟล์</h2></div>
          <span class="health ${ready ? "attention" : "attention"}">${ready ? "ยังไม่ได้ล็อกอิน" : "ยังไม่ได้ตั้งค่า"}</span>
        </div>
        <p class="hint">ไฟล์จากเมล <b>AUDIT 2</b> จะถูก n8n ดึงมาเก็บไว้ใน Supabase Storage และ Google Drive ให้อัตโนมัติ หน้านี้ใช้ดึงไฟล์เหล่านั้นเข้ามาตรวจโดยไม่ต้องดาวน์โหลดเอง</p>
        <div class="setting-list mt">
          <label><span>Supabase URL</span><input type="text" id="sbUrl" value="${h(c.url || "")}" placeholder="https://xxxx.supabase.co" /><b></b></label>
          <label class="wide"><span>anon public key</span><input type="password" id="sbKey" value="${h(c.anonKey || "")}" placeholder="eyJhbGciOi..." /><b></b></label>
          <label><span>Storage bucket</span><input type="text" id="sbBucket" value="${h(c.bucket || "audit-files")}" /><b></b></label>
        </div>
        <div class="setting-list">
          <label><span>อีเมลผู้ใช้</span><input type="email" id="sbEmail" value="${h(c.email || "")}" placeholder="audit@company.com" /><b></b></label>
          <label><span>รหัสผ่าน</span><input type="password" id="sbPass" placeholder="••••••••" /><b></b></label>
        </div>
        <div class="inline-actions">
          <button class="primary-button" id="sbLogin">บันทึกและล็อกอิน</button>
          <button class="ghost-button" id="sbPing">ทดสอบการเชื่อมต่อ</button>
        </div>
        <div id="sbPingOut"></div>
        <p class="chart-note">ใส่ได้เฉพาะ <b>anon public key</b> เท่านั้น — <b>service_role key</b> ต้องอยู่ใน n8n เท่านั้น ห้ามใส่ในหน้าเว็บ เพราะจะข้าม RLS และเปิดข้อมูลลูกค้าทั้งหมด</p>
      </section>`;

    $("#sbLogin").addEventListener("click", async () => {
      Sb.saveConfig({ url: $("#sbUrl").value.trim(), anonKey: $("#sbKey").value.trim(), bucket: $("#sbBucket").value.trim() || "audit-files" });
      try {
        await Sb.signIn($("#sbEmail").value.trim(), $("#sbPass").value);
        startCloudWorker();
        toast("ล็อกอิน Supabase สำเร็จ");
        logAction("cloud_login", "supabase", $("#sbEmail").value.trim(), "เชื่อมต่อคลังไฟล์");
        cloudLoad();
      } catch (e) {
        toast(e.message, "warn");
      }
    });
    $("#sbPing").addEventListener("click", async () => {
      Sb.saveConfig({ url: $("#sbUrl").value.trim(), anonKey: $("#sbKey").value.trim(), bucket: $("#sbBucket").value.trim() || "audit-files" });
      const r = await Sb.ping();
      $("#sbPingOut").innerHTML = `<ul class="tick-list mt">
        <li class="${r.url ? "" : "no"}">URL ${r.url ? "ใส่แล้ว" : "ยังไม่ได้ใส่"}</li>
        <li class="${r.key ? "" : "no"}">anon key ${r.key ? "ใส่แล้ว" : "ยังไม่ได้ใส่"}</li>
        <li class="${r.auth ? "" : "no"}">ล็อกอิน ${r.auth ? "แล้ว" : "ยังไม่ได้ล็อกอิน"}</li>
        <li class="${r.tables ? "" : "no"}">อ่านตารางทะเบียน ${r.tables ? "ได้" : "ไม่ได้"}</li>
        <li class="${r.storage ? "" : "no"}">อ่าน bucket ${r.storage ? "ได้" : "ไม่ได้"}</li>
        ${r.error ? `<li class="no">${h(r.error)}</li>` : ""}
      </ul>`;
    });
    return;
  }

  if ((cloudState.batches === null || cloudState.key !== cloudQueryKey()) && !cloudState.loading) {
    cloudLoad(cloudState.key !== cloudQueryKey());
  }

  const batches = cloudState.batches || [];
  const allFiles = batches.flatMap((b) => (b.source_files || []).map((f) => ({ ...f, business_date: b.business_date, company: f.company || b.company, subject: b.subject })));
  const isProblemFile = (file) => Boolean(file.parse_error || file.kind === "unknown");
  const isReadyFile = (file) => !isProblemFile(file) && Boolean(file.parsed || file.kind === "doc_clarify");
  const isWaitingFile = (file) => !isProblemFile(file) && !isReadyFile(file);
  const problemFiles = allFiles
    .filter(isProblemFile)
    .sort((a, b) => String(b.business_date || "").localeCompare(String(a.business_date || "")) || String(a.company || "").localeCompare(String(b.company || ""), "th") || String(a.file_name || "").localeCompare(String(b.file_name || ""), "th"));
  const readable = allFiles.filter((f) => /\.(xlsx|xlsm|xls|csv|txt|pdf)$/i.test(f.file_name) && f.kind !== "doc_clarify");
  const readyFiles = allFiles.filter(isReadyFile);
  const waitingFiles = allFiles.filter(isWaitingFile);
  const queueableFiles = readable.filter((f) => !f.parsed && !f.parse_error && f.kind !== "unknown");
  const pickedFiles = queueableFiles.filter((f) => cloudState.picked[f.id]);
  const visibleFile = (file) => cloudState.fileView === "problem"
    ? isProblemFile(file)
    : cloudState.fileView === "ready"
      ? isReadyFile(file)
      : cloudState.fileView === "waiting"
        ? isWaitingFile(file)
        : true;
  const visibleBatches = batches.map((batch) => ({ ...batch, source_files: (batch.source_files || []).filter(visibleFile) })).filter((batch) => batch.source_files.length);
  const daily = cloudState.daily || [];
  const operations = cloudState.operations || [];
  const jobLabel = { waiting_files: "รอไฟล์", ready: "พร้อม", queued: "เข้าคิว", running: "กำลังรัน", completed: "สำเร็จ", needs_review: "ต้องตรวจสอบ", error: "ล้มเหลว" };
  const jobTone = { waiting_files: "amber", ready: "blue", queued: "blue", running: "violet", completed: "green", needs_review: "red", error: "red" };

  root.innerHTML = `
    <section class="status-strip four action-tiles">
      <article class="ok" data-scroll-cloud="cloudInbox"><span>เมลที่ดึงเข้ามาแล้ว</span><strong>${num(batches.length)}</strong><small>ช่วง ${h(rangeLabel())} · กดดูเมล</small></article>
      <article data-cloud-view="all"><span>ไฟล์ทั้งหมด</span><strong>${num(allFiles.length)}</strong><small>กดดูทุกสถานะ</small></article>
      <article class="${readyFiles.length ? "ok" : ""}" data-cloud-view="ready"><span>พร้อมใช้งาน</span><strong>${num(readyFiles.length)}</strong><small>อ่านสำเร็จ · กดดูรายการ</small></article>
      <article data-cloud-view="waiting"><span>รอประมวลผล</span><strong>${num(waitingFiles.length)}</strong><small>ไม่ใช่ไฟล์เสีย · รอระบบอ่าน</small></article>
      <article class="${problemFiles.length ? "danger" : ""}" data-cloud-view="problem"><span>มีปัญหาต้องแก้</span><strong>${num(problemFiles.length)}</strong><small>${problemFiles.length ? "ไม่ส่งไปรันจนกว่าจะแก้" : "ไม่มีปัญหา"}</small></article>
    </section>

    <section class="audit-file-guide action-guide">
      <button type="button" data-scroll-cloud="cloudInbox"><i>1</i><span><b>เปิดไฟล์ที่ได้รับ</b><small>กดเพื่อไปยังไฟล์จากเมล</small></span></button>
      <button type="button" data-scroll-cloud="${problemFiles.length ? "problemFileSummary" : "cloudInbox"}"><i>2</i><span><b>ดูไฟล์ปัญหาทั้งหมด</b><small>ตรวจรายชื่อและสาเหตุก่อนแก้ทีละไฟล์</small></span></button>
      <button type="button" data-action-route="daily-summary"><i>3</i><span><b>ดูผลหลังบันทึก</b><small>ไปสรุป 1 บริษัท 1 วัน</small></span></button>
    </section>

    ${problemFiles.length ? `<section class="panel problem-file-summary" id="problemFileSummary">
      <div class="panel-heading">
        <div><p class="eyebrow">Problem files</p><h2>ไฟล์ที่พบปัญหาทั้งหมด</h2><small class="head-sub">รวม ${num(problemFiles.length)} ไฟล์ในช่วง ${h(rangeLabel())} · ตรวจรายชื่อและสาเหตุก่อนเริ่มแก้</small></div>
        <div class="inline-actions"><button class="primary-button sm" id="cReviewIssues">เริ่มตรวจทีละไฟล์</button><button class="ghost-button sm" type="button" data-scroll-cloud="cloudInbox">ดูไฟล์ทั้งหมดจากเมล</button></div>
      </div>
      <div class="table-wrap problem-file-table"><table>
        <thead><tr><th>#</th><th>วันที่</th><th>บริษัท</th><th>ชื่อไฟล์</th><th>ประเภทปัจจุบัน</th><th>ปัญหาที่พบ</th><th></th></tr></thead>
        <tbody>${problemFiles.map((file, index) => `<tr class="bad">
          <td class="tnum">${num(index + 1)}</td><td><b>${h(file.business_date || "-")}</b></td><td>${h(file.company || "ไม่ระบุ")}</td>
          <td><button class="file-name-link" data-storage-open="${h(file.storage_path)}" data-file-id="${h(file.id)}" data-file-name="${h(file.file_name)}" data-file-mime="${h(file.mime_type || "")}" data-file-size="${h(file.size_bytes || "")}" data-file-kind="${h(file.kind || "")}" data-file-company="${h(file.company || "")}" data-file-date="${h(file.business_date || "")}" data-file-status="${file.parse_error ? "error" : "waiting"}" ${file.storage_path ? "" : "disabled"}><span>${h(file.file_name)}</span><small>${h(file.subject || "กดเพื่อดูตัวอย่าง")}</small></button></td>
          <td>${h(KIND_LABEL[file.kind] || file.kind || "ยังไม่ทราบประเภท")}</td>
          <td><span class="badge red">${file.parse_error ? "อ่านไฟล์ไม่สำเร็จ" : "ยังไม่ทราบประเภท"}</span><small class="sub danger">${h(file.parse_error || "ต้องเปิด Preview แล้วเลือกประเภทไฟล์")}</small></td>
          <td class="right"><button class="primary-button xs" data-storage-open="${h(file.storage_path)}" data-file-id="${h(file.id)}" data-file-name="${h(file.file_name)}" data-file-mime="${h(file.mime_type || "")}" data-file-size="${h(file.size_bytes || "")}" data-file-kind="${h(file.kind || "")}" data-file-company="${h(file.company || "")}" data-file-date="${h(file.business_date || "")}" data-file-status="${file.parse_error ? "error" : "waiting"}" ${file.storage_path ? "" : "disabled"}>เปิดตรวจ</button></td>
        </tr>`).join("")}</tbody>
      </table></div>
    </section>` : `<section class="panel problem-file-summary ok" id="problemFileSummary"><div class="panel-heading"><div><p class="eyebrow">Problem files</p><h2>ไม่พบไฟล์ที่มีปัญหา</h2><small class="head-sub">ไฟล์ทั้งหมดมีประเภทแล้วและไม่มีข้อผิดพลาดจากการอ่าน</small></div><button class="ghost-button sm" type="button" data-scroll-cloud="cloudInbox">ดูไฟล์ทั้งหมดจากเมล</button></div></section>`}

    ${
      operations.length
        ? `<section class="panel">
      <div class="panel-heading"><div><p class="eyebrow">Daily Operations</p><h2>คิวกระทบยอดอัตโนมัติ</h2></div><span class="health ${operations.some((x) => x.status === "error" || x.status === "needs_review") ? "attention" : "ok"}">${operations.filter((x) => x.status === "queued" || x.status === "running").length} งานกำลังดำเนินการ</span></div>
      <div class="table-wrap"><table>
        <thead><tr><th>วันที่</th><th>บริษัท/ระบบ</th><th>สถานะ</th><th class="right">เมล</th><th class="right">ไฟล์</th><th>ไฟล์ที่ขาด</th><th>ผลล่าสุด</th></tr></thead>
        <tbody>${operations
          .map(
            (j) => `<tr class="action-row" data-summary-company="${h(j.company)}" data-summary-date="${h(j.business_date)}" role="link" tabindex="0">
            <td><b>${h(j.business_date)}</b>${j.late_file ? '<small class="sub danger">มีไฟล์มาช้า · จะรันซ้ำ</small>' : ""}</td>
            <td>${h(j.company)}${j.business_system ? `<small class="sub">${h(j.business_system)}</small>` : ""}</td>
            <td><span class="badge ${jobTone[j.status] || "grey"}">${h(jobLabel[j.status] || j.status)}</span>${j.last_error ? `<small class="sub danger" title="${h(j.last_error)}">${h(j.last_error.slice(0, 80))}</small>` : ""}</td>
            <td class="right tnum">${num(j.mail_count)}</td><td class="right tnum">${num(j.file_count)}</td>
            <td class="muted">${Array.isArray(j.missing_groups) && j.missing_groups.length ? h(j.missing_groups.map((g) => g.join(" / ")).join(", ")) : "ครบ"}</td>
            <td>${j.match_rate == null ? "-" : `${Number(j.match_rate).toFixed(2)}% · exception ${num(j.exception_count)}`}</td>
          </tr>`,
          )
          .join("")}</tbody>
      </table></div>
      <p class="hint">คิวถูกสร้างจากไฟล์จริงใน Supabase; ไฟล์ที่เข้าหลังปิดงานจะติดธงและเข้าคิวกระทบยอดซ้ำโดยอัตโนมัติ</p>
    </section>`
        : ""
    }

    <section class="panel" id="cloudInbox">
      <div class="panel-heading">
        <div><p class="eyebrow">Cloud Inbox</p><h2>ไฟล์จากเมล AUDIT 2</h2><small class="head-sub">ล็อกอินเป็น ${h(Sb.currentEmail())} · ${cloudState.error ? "โหลดข้อมูลไม่สำเร็จ" : cloudState.partialError ? h(cloudState.partialError) : "อัปเดตล่าสุด " + (c.lastSync ? String(c.lastSync).replace("T", " ").slice(0, 19) : "-")}</small></div>
        <div class="inline-actions">
          <button class="ghost-button sm" id="cReload" ${cloudState.loading ? "disabled" : ""}>${cloudState.loading ? "กำลังโหลด..." : "รีเฟรช"}</button>
          <button class="ghost-button sm" id="cPickNew">เลือกเฉพาะไฟล์ที่พร้อมรัน</button>
          <button class="primary-button sm" id="cImport" ${pickedFiles.length ? "" : "disabled"}>อ่านไฟล์ที่เลือก ${pickedFiles.length ? `(${pickedFiles.length})` : ""}</button>
        </div>
      </div>
      <div class="cloud-file-tabs" role="tablist" aria-label="กรองสถานะไฟล์">
        ${[["all", "ทั้งหมด", allFiles.length], ["ready", "พร้อมใช้งาน", readyFiles.length], ["waiting", "รอประมวลผล", waitingFiles.length], ["problem", "มีปัญหาต้องแก้", problemFiles.length]].map(([value, label, count]) => `<button type="button" role="tab" data-cloud-file-view="${value}" aria-selected="${cloudState.fileView === value}" class="${cloudState.fileView === value ? "active" : ""}">${label} <b>${num(count)}</b></button>`).join("")}
      </div>
      ${cloudState.error ? `<p class="hint danger">${h(cloudState.error)}</p>` : cloudState.partialError ? `<p class="hint warn">${h(cloudState.partialError)} · ส่วนที่โหลดสำเร็จยังเปิดดูได้</p>` : ""}
      ${
        visibleBatches.length
          ? visibleBatches
              .map(
                (b) => `<div class="mail-card">
        <div class="mail-head">
          <div>
            <strong>${h(b.subject || "(ไม่มีหัวข้อ)")}</strong>
            <span>${h(b.sender || "-")} · รับเมื่อ ${h(String(b.received_at || "").replace("T", " ").slice(0, 16))}</span>
          </div>
          <div class="mail-tags">
            ${b.company ? `<span class="badge violet">${h(b.company)}</span>` : ""}
            ${b.business_date ? `<span class="badge blue">${h(b.business_date)}</span>` : ""}
            ${b.is_supplement ? `<span class="badge amber">เพิ่มเติม</span>` : ""}
            <span class="badge ${b.status === "stored" ? "green" : "grey"}">${h(b.status)}</span>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th style="width:34px"></th><th>ไฟล์</th><th>ชนิดที่ระบบเดา</th><th class="right">ขนาด</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              ${(b.source_files || [])
                .sort((x, y) => String(x.file_name).localeCompare(String(y.file_name), "th"))
                .map((f) => {
                  const canRead = /\.(xlsx|xlsm|xls|csv|txt|pdf)$/i.test(f.file_name) && f.kind !== "doc_clarify";
                  const canQueue = canRead && !f.parsed && !f.parse_error && f.kind !== "unknown";
                  return `<tr class="${f.parse_error ? "bad" : ""}">
                  <td>${canQueue ? `<input type="checkbox" data-pick="${h(f.id)}" ${cloudState.picked[f.id] ? "checked" : ""} />` : ""}</td>
                  <td><button class="file-name-link" data-storage-open="${h(f.storage_path)}" data-file-id="${h(f.id)}" data-file-name="${h(f.file_name)}" data-file-mime="${h(f.mime_type || "")}" data-file-size="${h(f.size_bytes || "")}" data-file-kind="${h(f.kind || "")}" data-file-company="${h(f.company || b.company || "")}" data-file-date="${h(b.business_date || "")}" data-file-status="${f.parse_error ? "error" : f.parsed ? "parsed" : "waiting"}" ${f.storage_path ? "" : "disabled"}><span>${h(f.file_name)}</span><small>กดดูตัวอย่าง ↗${f.checksum ? ` · checksum ${h(String(f.checksum).slice(0, 10))}…` : ""}</small></button>${f.from_zip ? `<small class="sub">จาก ${h(f.from_zip)}</small>` : ""}</td>
                  <td>${h(KIND_LABEL[f.kind] || f.kind || "-")}</td>
                  <td class="right tnum">${f.size_bytes ? Math.round(f.size_bytes / 1024).toLocaleString() + " KB" : "-"}</td>
                  <td>${
                    f.parse_error
                      ? `<span class="file-state bad" title="${h(f.parse_error)}"><i>!</i><span><b>อ่านไม่ได้</b><small>กดดูสาเหตุ</small></span></span>`
                      : f.kind === "unknown"
                        ? `<span class="file-state bad"><i>!</i><span><b>ยังไม่ทราบประเภท</b><small>ต้องเปิด Preview และเลือกประเภท</small></span></span>`
                      : f.kind === "doc_clarify"
                        ? `<span class="file-state ok"><i>✓</i><span><b>หลักฐานพร้อมตรวจ</b><small>ไม่ต้องส่งเข้าเครื่องอ่านรายการ</small></span></span>`
                      : f.parsed
                        ? `<span class="file-state ok"><i>✓</i><span><b>${h(parsedFileLabel(f))}</b><small>${isEmptyPmFile(f) ? "Provider ส่งไฟล์ว่าง — ไม่มีรายการในรอบนี้" : f.row_count ? `ระบบอ่าน ${num(f.row_count)} แถว` : "ระบบอ่านสำเร็จ"}</small></span></span>`
                        : `<span class="file-state wait"><i>•</i><span><b>รอตรวจไฟล์</b><small>ยังไม่อ่านเข้าระบบ</small></span></span>`
                  }</td>
                  <td class="right"><div class="file-actions">${f.drive_url ? `<a class="ghost-button xs" href="${h(f.drive_url)}" target="_blank" rel="noopener">Drive</a>` : ""}<button class="primary-button xs" data-storage-open="${h(f.storage_path)}" data-file-id="${h(f.id)}" data-file-name="${h(f.file_name)}" data-file-mime="${h(f.mime_type || "")}" data-file-size="${h(f.size_bytes || "")}" data-file-kind="${h(f.kind || "")}" data-file-company="${h(f.company || b.company || "")}" data-file-date="${h(b.business_date || "")}" data-file-status="${f.parse_error ? "error" : f.parsed ? "parsed" : "waiting"}">ดูตัวอย่าง</button></div></td>
                </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>`,
              )
              .join("")
          : `<p class="empty-box">${cloudState.loading ? "กำลังโหลด..." : cloudState.fileView === "all" ? "ยังไม่มีเมลในช่วงวันที่นี้ — ลองขยายช่วงวันที่ในแถบตัวกรองด้านบน หรือตรวจว่า workflow ใน n8n รันแล้ว" : "ไม่มีไฟล์ในสถานะที่เลือก"}</p>`
      }
    </section>

    ${
      false && daily.length
        ? `<section class="panel">
      <div class="panel-heading"><div><p class="eyebrow">Coverage</p><h2>ไฟล์เข้าครบรายวัน</h2></div><span class="health ok">${num(daily.length)} รายการ</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>วันที่</th><th>บริษัท</th><th class="right">เมล</th><th class="right">ไฟล์</th><th class="right">อ่านแล้ว</th><th class="right">มีปัญหา</th><th>เมลล่าสุด</th></tr></thead>
          <tbody>
            ${daily
              .map(
                (d) => `<tr>
              <td><b>${h(d.business_date || "-")}</b></td>
              <td>${h(d.company || "-")}</td>
              <td class="right tnum">${num(d.mail_count)}</td>
              <td class="right tnum">${num(d.file_count)}</td>
              <td class="right tnum">${num(d.parsed_count)}</td>
              <td class="right tnum ${d.error_count ? "danger" : ""}">${num(d.error_count)}</td>
              <td class="muted">${h(String(d.last_mail_at || "").replace("T", " ").slice(0, 16))}</td>
            </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>`
        : ""
    }`;

  $("#cReload").addEventListener("click", () => cloudLoad(true));
  $("#cPickNew").addEventListener("click", () => {
    cloudState.picked = {};
    queueableFiles.forEach((f) => (cloudState.picked[f.id] = true));
    render();
  });
  $("#cImport").addEventListener("click", () => cloudImport(pickedFiles));
  $("#cReviewIssues")?.addEventListener("click", () => {
    const first = problemFiles[0];
    const button = Array.from(root.querySelectorAll("[data-storage-open][data-file-id]")).find((item) => item.dataset.fileId === first?.id);
    if (!button) return toast("ยังไม่พบไฟล์ปัญหาในรายการปัจจุบัน", "warn");
    button.scrollIntoView({ behavior: "smooth", block: "center" });
    button.click();
  });
  root.querySelectorAll("[data-action-route]").forEach((item) => item.addEventListener("click", () => go(item.dataset.actionRoute)));
  root.querySelectorAll("[data-cloud-view]").forEach((item) => item.addEventListener("click", () => {
    cloudState.fileView = item.dataset.cloudView;
    render();
    requestAnimationFrame(() => document.getElementById(cloudState.fileView === "problem" ? "problemFileSummary" : "cloudInbox")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }));
  root.querySelectorAll("[data-cloud-file-view]").forEach((item) => item.addEventListener("click", () => {
    cloudState.fileView = item.dataset.cloudFileView;
    render();
    requestAnimationFrame(() => document.getElementById("cloudInbox")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }));
  root.querySelectorAll("[data-scroll-cloud]").forEach((item) => item.addEventListener("click", () => document.getElementById(item.dataset.scrollCloud)?.scrollIntoView({ behavior: "smooth", block: "start" })));
  root.querySelectorAll("[data-summary-company]").forEach((row) => {
    const open = () => { state.dailySummary.date = row.dataset.summaryDate; state.dailySummary.company = row.dataset.summaryCompany; go("daily-summary"); };
    row.addEventListener("click", open);
    row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
  });
  root.querySelectorAll("[data-pick]").forEach((cb) =>
    cb.addEventListener("change", () => {
      cloudState.picked[cb.dataset.pick] = cb.checked;
      render();
    }),
  );
  bindStoredFileLinks(root);
};

const KIND_LABEL = {
  bo_main: "รายงานบัญชีฝาก-ถอน",
  pm_statement: "รายการเดินบัญชี PM",
  manual_credit: "ฝากมือ - เครดิต",
  manual_payment: "ฝากมือ - Payment",
  manual_bonus: "ฝากมือ - โบนัส",
  comm_req: "ขอถอนค่าคอมมิชชั่น",
  credit_out: "รายงานถอนเครดิต",
  stm_pdf: "Statement ธนาคาร (PDF)",
  doc_clarify: "เอกสารชี้แจง",
  unknown: "ยังระบุไม่ได้",
};

/* สถานะของหน้ารับไฟล์จริงและ progress overlay
   ต้องประกาศก่อน startRealTest()/VIEWS.import ซึ่งเรียกใช้ค่าชุดนี้ */
const ImportState = {
  files: [],
  lastRun: null,
  inbox: null,
  running: false,
};

function showProgress(title) {
  $("#progTitle").textContent = title;
  $("#progLabel").textContent = "เตรียมข้อมูล...";
  $("#progFill").style.width = "0%";
  $("#progPct").textContent = "0%";
  $("#progressOverlay").hidden = false;
}

function setProgress(pct, label) {
  const p = Math.round(Math.min(1, Math.max(0, pct)) * 100);
  $("#progFill").style.width = p + "%";
  $("#progPct").textContent = p + "%";
  if (label) $("#progLabel").textContent = label;
}

function hideProgress() {
  $("#progressOverlay").hidden = true;
}

function buildInbox() {
  const set = Sample.buildFileSet(state.filters.date, 2400);
  const expected = { ...set.scenario.expected };
  Object.keys(set.pmScenario.expected).forEach((key) => (expected[key] += set.pmScenario.expected[key]));
  ImportState.inbox = {
    date: state.filters.date,
    scenario: set.scenario,
    pmScenario: set.pmScenario,
    expected,
    messages: set.files.map((file, index) => ({
      id: "M" + (index + 1),
      from:
        [
          "ops_scb@bank-report",
          "ops_kbank@bank-report",
          "ops_gsb@bank-report",
          "ops_bbl@bank-report",
          "backoffice@sys123",
          "backoffice@sys123",
          "report@autopeer",
          "report@azpay",
          "report@cyberplus",
          "backoffice@sys123",
        ][index] || "backoffice@sys123",
      subject: `${file.kind} ประจำวันที่ ${state.filters.date}`,
      file,
      pulled: false,
    })),
  };
  return ImportState.inbox;
}


/* บัญชีที่มี statement เข้ามา ถือเป็นบัญชีของบริษัทโดยอัตโนมัติ
   ไม่งั้นกฎ "ลูกค้าฝากผิดบัญชี" จะฟ้องทุกแถวเพราะยังไม่มีในทะเบียนบัญชี */
function registerAccountFromStatement(norm) {
  const h = norm.header || {};
  if (!h.account) return;
  if (DB.accounts.some((a) => a.id === h.account)) return;
  DB.accounts.push({
    id: h.account,
    bank: h.bank || "-",
    company: norm.format.company || "-",
    type: "deposit",
    active: true,
    holder: h.holder || "",
    autoAdded: true,
  });
  logAction("account_add", "account", h.account, `เพิ่มบัญชีอัตโนมัติจาก statement ${h.bank || ""} ${h.holder || ""}`.trim());
}

/* โหลดบัญชีจริงจากทะเบียน (registry.js) มาเป็น master accounts ของระบบ */
function loadRegistryAccounts() {
  if (typeof Registry === "undefined" || !Registry.ACCOUNTS) return null;
  const banks = Registry.ACCOUNTS.filter((a) => a.source === "bank" && a.account);
  if (!banks.length) return null;
  return banks.map((a) => ({ id: a.account, bank: a.bank, company: a.subco || a.provider || "-", type: a.type || "both", active: true, holder: a.name || "", fromRegistry: true }));
}

/* ล้างข้อมูลตัวอย่าง/เก่าทั้งหมด แล้วเริ่มสถานะสะอาดสำหรับเทสข้อมูลจริง */
function startRealTest() {
  Store.reset();
  ImportState.files = [];
  ImportState.lastRun = null;
  ImportState.inbox = null;
  DB.exceptions = [];
  DB.damages = [];
  DB.files = [];
  DB.currentRun = null;
  if (Array.isArray(DB.hourly)) DB.hourly.forEach((x) => { x.total = 0; x.matched = 0; x.exception = 0; });
  const real = loadRegistryAccounts();
  if (real) DB.accounts = real;
  state.dataset = "imported";
  if (typeof updateAutoStatus === "function") updateAutoStatus();
  toast(`ล้างข้อมูลเก่าแล้ว — โหลดบัญชีจริง ${real ? real.length : 0} บัญชีจากทะเบียน · พร้อมนำเข้าไฟล์จริง`);
  go("import");
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("อ่านไฟล์ไม่ได้"));
    r.readAsText(file, "utf-8");
  });
}
function readFileBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("อ่านไฟล์ไม่ได้"));
    r.readAsArrayBuffer(file);
  });
}

async function ingestRaw(name, text, size, meta = {}) {
  let rows = [];
  let norm;
  const businessDate = meta.businessDate || state.filters.date;
  if (/\.pdf$/i.test(name)) {
    /* statement ธนาคารเป็น PDF — ใช้ตัวอ่านเฉพาะ */
    norm = await PdfStm.parse(name, text, businessDate);
    registerAccountFromStatement(norm);
  } else {
    if (/\.(xlsx|xlsm|xls)$/i.test(name)) rows = await Engine.parseSheet(text);
    else {
      /* ไฟล์ CSV/TXT ที่มาจาก input[type=file] ถูกอ่านเป็น string แต่ไฟล์จาก
         Supabase Storage ถูกดาวน์โหลดเป็น ArrayBuffer — แปลงให้เป็นข้อความก่อน
         ส่งเข้า parser เพื่อให้ทั้งสองเส้นทางใช้ตัวอ่านเดียวกันได้ */
      const csvText = typeof text === "string" ? text : new TextDecoder("utf-8").decode(text);
      rows = Engine.parseCSV(csvText);
    }
    norm = Engine.normalize(name, rows, DB.settings, businessDate);
  }
  /* แท็กด้วยทะเบียนบัญชี (บริษัทย่อย/บัญชี/ผู้ให้บริการ) + normalize เลขบัญชีให้เป็นรูปแบบเดียว
     เพื่อให้ STM (ธนาคาร) กับ BO/PM จับคู่กันได้แม้เขียนเลขบัญชีต่างรูปแบบ (ขีด/เบอร์ TrueMoney) */
  let tagSubco = "",
    tagProvider = "",
    tagAccount = "";
  if (typeof Registry !== "undefined") {
    let tag = null;
    if (/\.pdf$/i.test(name) && norm.header && norm.header.account) {
      tagAccount = Registry.normalizeAccount(norm.header.account, norm.header.bank);
      tag = Registry.byAccount(tagAccount) || Registry.matchFile(name).match;
    } else {
      tag = Registry.matchFile(name).match;
    }
    const bk = (norm.format && norm.format.bank) || (tag && tag.bank) || (norm.header && norm.header.bank) || "";
    (norm.records || []).forEach((r) => {
      if (r.account && !r.isPmChannel && /\d/.test(String(r.account))) r.account = Registry.normalizeAccount(r.account, bk || r.bank);
    });
    tagSubco = (tag && tag.subco) || (norm.format && norm.format.company) || "";
    const r0 = (norm.records || [])[0];
    tagProvider = (r0 && r0.isPmChannel && r0.channel) || (tag && tag.provider) || "";
    if (tagSubco) (norm.records || []).forEach((r) => { if (!r.subco) r.subco = tagSubco; });
  }

  ImportState.files = ImportState.files.filter((f) => (meta.fileId ? f.cloudFileId !== meta.fileId : f.name !== name));
  ImportState.files.push({
    name,
    cloudFileId: meta.fileId || null,
    storagePath: meta.storagePath || null,
    businessDate,
    size: size ?? (text.byteLength || text.length),
    rowCount: rows.length,
    rows, // เก็บแถวดิบไว้ เพื่อ normalize ใหม่เมื่อกฎธนาคารเปลี่ยน
    format: norm.format,
    records: norm.records,
    aux: norm.aux || [],
    dropped: norm.dropped,
    warnings: norm.warnings,
    subco: tagSubco,
    provider: tagProvider,
    tagAccount,
  });
  const kind = norm.format.realLabel || norm.format.source.toUpperCase() + (norm.format.bank ? " / " + norm.format.bank : "");
  logAction("import", "source_file", name, `นำเข้า ${(norm.records.length || (norm.aux || []).length)} รายการ (${kind})`);
  return norm;
}

/* อ่านไฟล์เดิมใหม่ด้วยกฎปัจจุบัน — ใช้เมื่อผู้ใช้เปลี่ยนกฎธนาคารหรือ tolerance */
function renormalizeAll() {
  ImportState.files = ImportState.files.map((f) => {
    if (!f.rows || !f.rows.length) return f;
    const norm = Engine.normalize(f.name, f.rows, DB.settings, f.businessDate || state.filters.date);
    return { ...f, format: norm.format, records: norm.records, aux: norm.aux || [], dropped: norm.dropped, warnings: norm.warnings };
  });
}

/* เงื่อนไขที่ทำให้ระบบกระทบยอดเองได้ */
function autoReadiness() {
  const files = ImportState.files;
  const hasStm = files.some((f) => f.format.source !== "bo" && f.format.source !== "aux" && f.records.length);
  const hasBo = files.some((f) => f.format.source === "bo" && f.records.length);
  const hasAux = files.some((f) => (f.aux || []).length);
  if (!files.length) return { ready: false, text: "รอไฟล์", tone: "idle", why: "ยังไม่มีไฟล์เข้าระบบ" };
  if (!hasStm && (hasBo || hasAux))
    return {
      ready: true,
      rulesOnly: true,
      text: ImportState.lastRun ? "ตรวจกฎแล้ว" : "ตรวจกฎธุรกิจ",
      tone: "wait",
      why: "ยังไม่มีไฟล์ฝั่งธนาคาร — ระบบตรวจกฎธุรกิจจากรายงานหลังบ้านให้ก่อน (ค่าคอม/ตัดเครดิต/ข้ามวัน/ซ้ำ)",
    };
  if (!hasStm) return { ready: false, text: "รอ STM", tone: "wait", why: "ยังไม่มีไฟล์ฝั่งธนาคาร (STM หรือ PM)" };
  if (!hasBo) return { ready: false, text: "รอ BO", tone: "wait", why: "ยังไม่มีไฟล์ฝั่งระบบหลังบ้าน (BO)" };
  return { ready: true, text: ImportState.lastRun ? "กระทบยอดแล้ว" : "พร้อมกระทบยอด", tone: "ok", why: "ไฟล์ครบทั้งสองฝั่ง ระบบกระทบยอดให้อัตโนมัติ" };
}

/* รวบรวมผลตรวจกฎธุรกิจจากไฟล์รายงานหลังบ้าน (ไม่ต้องใช้ statement) */
function runBusinessRules() {
  if (typeof Rules === "undefined") return { exceptions: [], counts: {} };
  const parsed = ImportState.files
    .filter((f) => f.format && (f.format.source === "bo" || f.format.source === "aux"))
    .map((f) => ({ records: f.format.source === "bo" ? f.records : [], aux: f.aux || [] }));
  return Rules.run(parsed, DB.settings);
}

/* BO-first coverage: BO คือหลักฐานว่าบัญชี/Provider ใดถูกใช้จริงในวันนั้น
   Google Sheet เป็นทะเบียนยืนยันชื่อมาตรฐาน ส่วนชื่อเมลและชื่อไฟล์เป็นเพียง hint */
function buildBoFirstCoverage(stmRecords, boRecords) {
  const clean = (value) => String(value || "").trim().toUpperCase();
  const companyOf = (record) => normalizeLiveCompanyCode(record?.subco || record?.company) || clean(record?.subco || record?.company) || "ไม่ระบุบริษัท";
  const direction = (record) => record?.direction === "withdraw" ? "withdraw" : record?.direction === "deposit" ? "deposit" : "unknown";
  const identity = (record) => {
    const raw = record?.channel || record?.account || record?.bank || "";
    const pm = typeof Formats !== "undefined" && Formats.canonicalPm ? Formats.canonicalPm(raw) : "";
    if (pm || record?.isPmChannel) return { kind: "PM", id: pm || clean(raw), label: pm || clean(raw) };
    const account = String(record?.account || "").replace(/\D/g, "");
    const bank = clean(record?.bank || record?.channel);
    return { kind: "STM", id: account || bank, label: [bank, account ? `••${account.slice(-4)}` : ""].filter(Boolean).join(" ") };
  };
  const collect = (records) => {
    const map = new Map();
    (records || []).forEach((record) => {
      const id = identity(record);
      if (!id.id || id.id === "UNKNOWN") return;
      const company = companyOf(record);
      const system = businessSystemOfCompany(company);
      const dir = direction(record);
      const key = `${system}|${company}|${id.kind}|${id.id}|${dir}`;
      const item = map.get(key) || { key, system, company, kind: id.kind, identity: id.id, label: id.label, direction: dir, rows: 0, amount: 0, source_files: [] };
      item.rows += 1;
      item.amount = Math.round((item.amount + Number(record?.amount || 0)) * 100) / 100;
      const sourceFile = String(record?.source_file || record?.fileName || "").trim();
      if (sourceFile && !item.source_files.includes(sourceFile)) item.source_files.push(sourceFile);
      map.set(key, item);
    });
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  };
  const required = collect(boRecords);
  const received = collect(stmRecords);
  const receivedKeys = new Set(received.map((item) => item.key));
  const missing = required.filter((item) => !receivedKeys.has(item.key));
  return {
    method: "BO_FIRST",
    registry_source: "https://docs.google.com/spreadsheets/d/1PlxeE2CIH9uh93xFJ0LHmo-9TI931chDJxdckBzfaME",
    required,
    received,
    missing,
    complete: required.length > 0 && missing.length === 0,
  };
}

function updateAutoStatus() {
  const el = $("#autoStatus");
  if (!el) return;
  const r = ImportState.running ? { text: "กำลังกระทบยอด", tone: "run", why: "" } : autoReadiness();
  el.className = "auto-status " + r.tone;
  $("#autoStatusText").textContent = r.text;
  el.title = r.why || "ระบบกำลังจับคู่รายการอยู่";
}

/* ทริกเกอร์อัตโนมัติ — เรียกทุกครั้งที่ไฟล์เข้าหรือกฎเปลี่ยน */
let autoTimer = null;
function scheduleAutoReconcile(reason) {
  clearTimeout(autoTimer);
  updateAutoStatus();
  if (!autoReadiness().ready || ImportState.running) return;
  autoTimer = setTimeout(() => runReconcileFromImport({ auto: true, reason }), 350);
}

async function runReconcileFromImport(opts = {}) {
  const stm = [];
  const bo = [];
  ImportState.files.forEach((f) => {
    if (f.format.source === "aux") return;
    if (f.format.source === "bo") bo.push(...f.records);
    else stm.push(...f.records);
  });
  /* รายการเดียวกันอาจอยู่ในหลายรายงาน (บัญชีฝาก + ฝากมือ) ต้องยุบก่อนจับคู่ */
  if (typeof Formats !== "undefined" && bo.some((r) => r.formatCode)) {
    const m = Formats.merge(bo);
    bo.length = 0;
    m.sort((a, b) => (a.sec || 0) - (b.sec || 0)).forEach((r) => bo.push(r));
  }
  const ready = autoReadiness();
  if (!ready.ready) {
    if (opts.job) {
      const message = `ไฟล์ในคิวไม่พร้อมกระทบยอด: ${ready.why}`;
      await Sb.failJob(opts.job.id, message).catch(() => {});
      cloudState.activeJob = null;
    }
    updateAutoStatus();
    return;
  }
  ImportState.running = true;
  updateAutoStatus();
  showProgress(ready.rulesOnly ? "กำลังตรวจกฎธุรกิจจากรายงานหลังบ้าน" : "ระบบกำลังกระทบยอดให้อัตโนมัติ");
  await new Promise((r) => setTimeout(r, 40));

  const biz = runBusinessRules();
  let result;
  if (ready.rulesOnly) {
    const hourlyStm = new Array(24).fill(0);
    const hourlyMatched = new Array(24).fill(0);
    bo.forEach((r) => hourlyStm[Math.floor(r.sec / 3600)]++);
    result = {
      matched: 0,
      exceptions: [],
      stmCount: 0,
      boCount: bo.length,
      elapsedMs: 0,
      matchRate: 0,
      nearTolerance: 0,
      hourlyStm,
      hourlyMatched,
      crossDayWindow: bo.filter((r) => r.crossDay || r.lateNight).length,
      noStmSide: [],
      noStmCount: bo.length,
      rulesOnly: true,
    };
  } else {
    DB.settings.asOf = Date.now(); // คิดอายุ SLA จากเวลาจริงของการตรวจ
    result = await Engine.reconcile(stm, bo, DB.settings, DB.accounts, (pct, label) => setProgress(pct, label));
  }
  /* รวม exception จากกฎธุรกิจเข้ากับผลจับคู่ แล้วออกรหัสใหม่ให้ต่อเนื่อง */
  /* รวมแล้วยุบรายการที่ซ้ำกัน (กฎธุรกิจกับการจับคู่อาจจับเคสเดียวกัน) */
  const bestEx = new Map();
  result.exceptions.concat(biz.exceptions).forEach((e) => {
    const k = [e.type, e.account, e.time, e.systemAmount ?? ""].join("|");
    const prev = bestEx.get(k);
    /* ถ้าซ้ำกัน เก็บอันที่มีคำอธิบายละเอียดกว่าไว้ */
    if (!prev || (!prev.detail && e.detail)) bestEx.set(k, e);
  });
  result.exceptions = [...bestEx.values()].sort((a, b) => a.sortSec - b.sortSec);
  result.exceptions.forEach((e, i) => (e.id = "EX-" + String(3001 + i)));
  result.ruleExceptions = biz.exceptions.length;
  result.auxCounts = biz.counts;
  result.boFirst = buildBoFirstCoverage(stm, bo);

  hideProgress();
  ImportState.running = false;
  applyRunResult(result, stm, bo);
  if (opts.job) {
    try {
      result.businessDate = opts.job.business_date;
      if (result.rulesOnly) {
        await Sb.finishParseOnly(opts.job.id);
        cloudState.activeJob = null;
        cloudState.operations = null;
        ImportState.lastRun.reason = opts.reason || "อ่าน BO เพื่อรอ STM";
        updateAutoStatus();
        toast(`อ่าน BO แล้ว · พบบัญชี/Provider ที่ใช้จริง ${num(result.boFirst.required.length)} กลุ่ม · ยังไม่สร้างผลกระทบยอดจนกว่า STM จะมา`);
        if (state.route === "import" || opts.goDashboard) go("dashboard");
        else render();
        return;
      }
      const runId = await Sb.saveRun(result, result.exceptions, {
        company: opts.job.company,
        fileIds: ImportState.files.map((f) => f.cloudFileId).filter(Boolean),
        summary: { reason: opts.reason || "คิวรายวัน", job_id: opts.job.id, late_file: !!opts.job.late_file, bo_first: result.boFirst },
      });
      await Sb.finishJob(opts.job.id, runId);
      cloudState.activeJob = null;
      cloudState.operations = null;
    } catch (e) {
      await Sb.failJob(opts.job.id, e.message).catch(() => {});
      cloudState.activeJob = null;
      toast(`บันทึกผลคิวรายวันไม่สำเร็จ: ${e.message}`, "warn");
    }
  }
  ImportState.lastRun.reason = opts.reason || "ไฟล์เข้าใหม่";
  updateAutoStatus();
  toast(
    result.rulesOnly
      ? `ตรวจกฎธุรกิจแล้ว · พบ ${num(result.exceptions.length)} รายการต้องชี้แจง · ยังรอไฟล์ฝั่งธนาคารเพื่อจับคู่`
      : `กระทบยอดอัตโนมัติแล้ว (${opts.reason || "ไฟล์เข้าใหม่"}) · จับคู่ ${num(result.matched)} รายการ · exception ${num(result.exceptions.length)} · ${result.elapsedMs} ms`,
  );
  if (state.route === "import" || opts.goDashboard) go("dashboard");
  else render();
}

function applyRunResult(result, stm, bo) {
  DB.exceptions = result.exceptions;
  DB.hourly.forEach((x, i) => {
    x.total = result.hourlyStm[i];
    x.matched = result.hourlyMatched[i];
    x.exception = 0;
  });
  result.exceptions.forEach((e) => DB.hourly[e.hour].exception++);
  DB.damages = DB.damages.filter((d) => d.cycle !== "C1");
  DB.currentRun = result;

  // Intake checklist สะท้อนไฟล์ที่นำเข้าจริง
  const srcLabel = { stm: "STM ธนาคาร", bo: "รายงาน BO", pm: "STM PM", unknown: "ไม่ทราบชนิด" };
  DB.files = ImportState.files.map((f) => ({
    id: f.name,
    company: f.format.company || "SYS123",
    companyName: (DB.companies.find((c) => c.code === (f.format.company || "SYS123")) || {}).name || f.format.company || "ระบบ 123",
    fileType: srcLabel[f.format.source] + (f.format.bank ? ` (${f.format.bank})` : ""),
    status: f.records.length ? "received" : "missing",
    rows: f.records.length,
    receivedAt: nowStamp().slice(11, 16),
    sender: "email กลาง",
    checksum: String(f.size).padStart(8, "0").slice(-8),
  }));
  ImportState.lastRun = {
    at: nowStamp(),
    ...result,
    files: ImportState.files.map((f) => ({ name: f.name, source: f.format.source, bank: f.format.bank, records: f.records.length, dropped: f.dropped })),
  };
  state.dataset = "imported";
  state.page = 1;
  /* เลื่อนตัวกรองไปที่วันที่ของข้อมูลที่เพิ่งนำเข้า ไม่งั้นหน้าจอจะว่างเพราะกรองด้วยวันนี้ */
  const dates = [...new Set(result.exceptions.map((e) => e.date).concat(stm.map((r) => r.date), bo.map((r) => r.date)).filter(Boolean))].sort();
  if (dates.length) {
    const main = dates[Math.floor(dates.length / 2)];
    state.filters.date = main;
    state.filters.from = dates[0];
    state.filters.to = dates[dates.length - 1];
    state.filters.preset = dates.length > 1 ? "custom" : "day";
  }
  logAction("auto_reconcile", "match_run", "MR-" + Date.now(), `กระทบยอดอัตโนมัติ: จับคู่ ${result.matched} รายการ, exception ${result.exceptions.length}, ${result.elapsedMs} ms`);
  retagTracks();
  runNotificationRules();
  Store.persist();
}

VIEWS.import = (root) => {
  const inbox = ImportState.inbox || buildInbox();
  const files = ImportState.files;
  const totalRecords = files.reduce((a, f) => a + f.records.length, 0);
  const hasStm = files.some((f) => f.format.source !== "bo");
  const hasBo = files.some((f) => f.format.source === "bo");
  const ready = autoReadiness();
  const srcName = { stm: "STM ธนาคาร", bo: "รายงาน BO", pm: "STM PM", aux: "รายงานประกอบ", unknown: "ไม่ทราบชนิด" };
  /* ไฟล์จริงจากแผนกไม่มีข้อบกพร่องที่จงใจใส่ไว้ จึงไม่ต้องแสดงตารางเทียบของไฟล์ตัวอย่าง */
  const usingRealFiles = files.some((f) => f.format.realCode);

  root.innerHTML = `
    <section class="status-strip four">
      <article><span>ไฟล์ในกล่องอีเมล</span><strong>${inbox.messages.length}</strong><small>วันที่ ${h(inbox.date)}</small></article>
      <article class="${files.length ? "ok" : ""}"><span>ไฟล์ที่นำเข้าแล้ว</span><strong>${files.length}</strong><small>${hasStm ? "มีฝั่งธนาคาร" : "ยังไม่มีฝั่งธนาคาร"} · ${hasBo ? "มีฝั่ง BO" : "ยังไม่มีฝั่ง BO"}</small></article>
      <article><span>รายการที่ normalize แล้ว</span><strong>${num(totalRecords)}</strong><small>ผ่านกฎธนาคารที่เปิดใช้</small></article>
      <article class="${ImportState.lastRun ? "ok" : ready.ready ? "warn" : ""}"><span>ผลกระทบยอดล่าสุด</span><strong>${ImportState.lastRun ? ImportState.lastRun.matchRate.toFixed(2) + "%" : "-"}</strong><small>${ImportState.lastRun ? ImportState.lastRun.elapsedMs + " ms · " + ImportState.lastRun.at : h(ready.why)}</small></article>
    </section>

    <section class="grid-2">
      <div class="panel">
        <div class="panel-heading">
          <div><p class="eyebrow">Email Ingestion</p><h2>กล่องอีเมลกลางของแผนก</h2></div>
          <button class="ghost-button sm" id="pullAll">ดึงไฟล์ทั้งหมด</button>
        </div>
        <div class="inbox-list">
          ${inbox.messages
            .map(
              (m) => `<div class="inbox-item ${m.pulled ? "pulled" : ""}">
            <div>
              <strong>${h(m.subject)}</strong>
              <span>${h(m.from)} · ${h(m.file.name)}</span>
              <small>${h(m.file.note)}</small>
            </div>
            <div class="inbox-actions">
              <button class="link-btn" data-dl="${h(m.id)}">ดาวน์โหลด</button>
              <button class="ghost-button xs" data-pull="${h(m.id)}" ${m.pulled ? "disabled" : ""}>${m.pulled ? "ดึงแล้ว" : "ดึงเข้าระบบ"}</button>
            </div>
          </div>`,
            )
            .join("")}
        </div>
        <p class="hint">ไฟล์เหล่านี้ถูกสร้างให้มีลักษณะเหมือนไฟล์จริง — มีบรรทัดยอดยกมา, บรรทัดรอบวันที่, marker X1/X2/XB, รายการ FAILED และวันที่ของวันอื่นปนมา เพื่อให้ทดสอบ parser และกฎธนาคารได้จริง ดาวน์โหลดไปเปิดดูหรืออัปโหลดกลับเข้ามาก็ได้</p>
      </div>

      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Upload</p><h2>อัปโหลดไฟล์ของคุณเอง</h2></div></div>
        <label class="dropzone" id="dropzone">
          <input type="file" id="fileInput" multiple accept=".csv,.txt,.xlsx,.xls,.pdf" hidden />
          <strong>ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์</strong>
          <span>รองรับ .xlsx .csv และ statement ธนาคารที่เป็น .pdf — ระบบอ่านหัวคอลัมน์เองว่าเป็นรายงานบัญชีฝาก-ถอน, ฝากมือ, ขอถอนค่าคอม, ถอนเครดิต หรือ statement ของธนาคารไหน</span>
        </label>

        <div class="auto-banner ${ready.tone}">
          <i></i>
          <div>
            <strong>${ready.ready ? "ระบบกระทบยอดให้อัตโนมัติ" : "ระบบยังกระทบยอดไม่ได้"}</strong>
            <span>${h(ready.why)}</span>
          </div>
        </div>
        <ul class="tick-list mt">
          <li>ไฟล์เข้าระบบครบทั้งฝั่งธนาคารและฝั่ง BO — กระทบยอดทันที</li>
          <li>มีไฟล์เพิ่มเข้ามาทีหลัง — กระทบยอดใหม่ทั้งชุดโดยอัตโนมัติ</li>
          <li>เปลี่ยนกฎธนาคารหรือ tolerance — อ่านไฟล์เดิมใหม่แล้วกระทบยอดใหม่ให้เอง</li>
          <li>ถึงเวลาตามตารางที่ตั้งไว้ — ดึงไฟล์จากอีเมลกลางแล้วกระทบยอดเอง</li>
        </ul>
        <div class="inline-actions mt">
          <button class="ghost-button" id="clearFiles" ${files.length ? "" : "disabled"}>ล้างไฟล์ทั้งหมด</button>
          <button class="ghost-button" id="backToDemo" ${state.dataset === "imported" ? "" : "disabled"}>กลับไปใช้ข้อมูลตัวอย่าง</button>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Parse Result</p><h2>ผลการอ่านไฟล์และกฎที่ถูกใช้</h2></div>
        <span class="health ${files.length ? "ok" : "attention"}">${files.length ? num(totalRecords) + " รายการพร้อมจับคู่" : "ยังไม่มีไฟล์"}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ไฟล์</th><th>ชนิดที่ตรวจได้</th><th class="right">แถวดิบ</th><th class="right">ใช้จับคู่ได้</th><th>ถูกกรองออกด้วยกฎ</th><th></th></tr></thead>
          <tbody>
            ${
              files
                .map(
                  (f) => `<tr>
              <td><b>${h(f.name)}</b>${f.warnings.length ? `<small class="sub danger">${h(f.warnings[0])}</small>` : ""}</td>
              <td>${h(f.format.realLabel || srcName[f.format.source] || "")}${f.format.bank ? ` <span class="badge blue">${h(f.format.bank)}</span>` : ""}${f.format.company ? ` <span class="badge violet">${h(f.format.company)}</span>` : ""}${f.subco || f.tagAccount || f.provider ? ` <span class="badge green" title="แท็กจากทะเบียนบัญชี">${h([f.subco, f.tagAccount || f.provider].filter(Boolean).join(" · "))}</span>` : ""}</td>
              <td class="right tnum">${num(f.rowCount || (f.records.length + (f.aux || []).length))}</td>
              <td class="right tnum">${num(f.records.length + (f.aux || []).length)}</td>
              <td class="wrap">${Object.entries(f.dropped).map(([k, v]) => `<span class="drop-tag">${h(k)} ${v}</span>`).join("") || '<span class="muted">ไม่มี</span>'}</td>
              <td><button class="link-btn" data-rm="${h(f.name)}">เอาออก</button></td>
            </tr>`,
                )
                .join("") || `<tr><td colspan="6" class="empty">ยังไม่มีไฟล์ — ดึงจากกล่องอีเมลหรืออัปโหลดเอง</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>

    ${
      ImportState.lastRun
        ? `<section class="panel">
      <div class="panel-heading"><div><p class="eyebrow">Match Run</p><h2>ผลการรันล่าสุด</h2></div><span class="health ok">${h(ImportState.lastRun.at)}</span></div>
      <div class="run-grid">
        <div><span>รายการฝั่งธนาคาร</span><b>${num(ImportState.lastRun.stmCount)}</b></div>
        <div><span>รายการฝั่ง BO</span><b>${num(ImportState.lastRun.boCount)}</b></div>
        <div><span>จับคู่สำเร็จ</span><b>${num(ImportState.lastRun.matched)}</b></div>
        <div><span>อัตราจับคู่</span><b>${ImportState.lastRun.matchRate.toFixed(2)}%</b></div>
        <div><span>Exception</span><b>${num(ImportState.lastRun.exceptions.length)}</b></div>
        <div><span>เวลาที่ใช้</span><b>${ImportState.lastRun.elapsedMs} ms</b></div>
        <div><span>รายการช่วง 23:00-23:59</span><b>${num(ImportState.lastRun.crossDayWindow || 0)}</b></div>
      </div>
      <p class="chart-note">รายการช่วง 23:00-23:59 ต้องตรวจร่วมกับไฟล์ของวันถัดไป — ที่จับคู่ได้แล้วถือว่าปกติ ส่วนที่จับคู่ไม่ได้จะถูกยกเป็น exception ประเภท "รายการข้ามวัน"</p>
      <div class="chart mt" id="runByType"></div>
    </section>

    ${
      (ImportState.lastRun.noStmSide || []).length
        ? `<section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Coverage</p><h2>ช่องทางที่ยังไม่มีไฟล์ฝั่งธนาคาร</h2></div>
        <span class="health attention">${num(ImportState.lastRun.noStmCount || 0)} รายการยังตรวจไม่ได้</span>
      </div>
      <p class="chart-note">รายการเหล่านี้ <b>ไม่ถูกนับเป็น exception</b> เพราะยังไม่มีไฟล์ statement ของช่องทางนั้นให้เทียบ ถ้าได้ไฟล์ของ Cyberplus / AUTOPEER / AZPAY มาเพิ่ม ระบบจะจับคู่ให้ทันทีโดยไม่ต้องตั้งค่าอะไร</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ช่องทาง</th><th>บริษัท</th><th class="right">จำนวนรายการ</th><th class="right">ยอดรวม (บาท)</th><th>บัญชี/เทอร์มินัล</th></tr></thead>
          <tbody>
            ${ImportState.lastRun.noStmSide
              .map(
                (g) => `<tr>
              <td><b>${h(g.channel)}</b></td>
              <td>${h(g.company)}</td>
              <td class="right tnum">${num(g.count)}</td>
              <td class="right tnum">${money(g.amount)}</td>
              <td class="wrap"><span class="muted">${h(g.accounts.slice(0, 4).join(", "))}${g.accounts.length > 4 ? " +" + (g.accounts.length - 4) : ""}</span></td>
            </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>`
        : ""
    }

    ${
      usingRealFiles
        ? ""
        : `
    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Engine Validation</p><h2>ตรวจว่าเครื่องจับคู่ทำงานถูกหรือไม่</h2></div>
        <span class="health ok">เทียบกับข้อบกพร่องที่จงใจใส่ไว้ในไฟล์ตัวอย่าง</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ประเภท exception</th><th class="right">ใส่ไว้ในไฟล์</th><th class="right">ระบบตรวจพบ</th><th>ผล</th></tr></thead>
          <tbody>
            ${Object.entries(inbox.expected)
              .filter(([k]) => k !== "total" && k !== "cross_day")
              .map(([k, v]) => {
                const found = ImportState.lastRun.exceptions.filter((e) => e.type === k).length;
                const ok = found >= v * 0.8 && found <= v * 1.6;
                return `<tr><td>${h(Engine.TYPE_NAME[k] || k)}</td><td class="right tnum">${v}</td><td class="right tnum">${found}</td>
                  <td><span class="badge ${ok ? "green" : "amber"}">${ok ? "ตรงตามที่ใส่ไว้" : "ต่างจากที่ใส่ไว้"}</span></td></tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="chart-note">ตัวเลขสองฝั่งไม่จำเป็นต้องเท่ากันเป๊ะ เพราะข้อบกพร่องบางอย่างซ้อนกันได้ เช่น รายการที่ยอดไม่ตรงและอยู่ช่วงข้ามวันพร้อมกัน ระบบจึงยกเป็นเคสตามกฎที่รุนแรงกว่า</p>
    </section>`
    }`
        : ""
    }`;

  if (ImportState.lastRun) {
    const agg = {};
    ImportState.lastRun.exceptions.forEach((e) => (agg[e.typeName] = (agg[e.typeName] || 0) + 1));
    Charts.draw("#runByType", "hbars", {
      label: "exception จากการรันล่าสุด",
      items: Object.entries(agg).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => b.value - a.value),
      color: Charts.PALETTE.s2,
      metric: "จำนวนเคส",
    });
  }

  const pull = async (m) => {
    await ingestRaw(m.file.name, m.file.content, m.file.content.length);
    m.pulled = true;
  };

  $("#pullAll").addEventListener("click", async () => {
    showProgress("กำลังดึงและ parse ไฟล์");
    const pending = inbox.messages.filter((m) => !m.pulled);
    for (let i = 0; i < pending.length; i++) {
      setProgress((i + 1) / pending.length, pending[i].file.name);
      await pull(pending[i]);
      await new Promise((r) => setTimeout(r, 10));
    }
    hideProgress();
    toast(`ดึงและ parse ไฟล์แล้ว ${pending.length} ไฟล์`);
    render();
    scheduleAutoReconcile("ดึงไฟล์จากอีเมลกลาง");
  });

  root.querySelectorAll("[data-pull]").forEach((b) =>
    b.addEventListener("click", async () => {
      const m = inbox.messages.find((x) => x.id === b.dataset.pull);
      await pull(m);
      toast(`นำเข้า ${m.file.name} แล้ว`);
      render();
      scheduleAutoReconcile("ไฟล์ " + m.file.name + " เข้าระบบ");
    }),
  );
  root.querySelectorAll("[data-dl]").forEach((b) =>
    b.addEventListener("click", () => {
      const m = inbox.messages.find((x) => x.id === b.dataset.dl);
      downloadText(m.file.name, m.file.content);
    }),
  );
  root.querySelectorAll("[data-rm]").forEach((b) =>
    b.addEventListener("click", () => {
      ImportState.files = ImportState.files.filter((f) => f.name !== b.dataset.rm);
      render();
    }),
  );

  const dz = $("#dropzone");
  const input = $("#fileInput");
  dz.addEventListener("click", () => input.click());
  ["dragenter", "dragover"].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.add("over");
    }),
  );
  ["dragleave", "drop"].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.remove("over");
    }),
  );
  const handleFiles = async (list) => {
    showProgress("กำลังอ่านไฟล์");
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      setProgress((i + 1) / list.length, f.name);
      try {
        const payload = /\.(xlsx|xlsm|xls|pdf)$/i.test(f.name) ? await readFileBuffer(f) : await readFileText(f);
        await ingestRaw(f.name, payload, f.size);
      } catch (err) {
        toast(`${f.name}: ${err.message}`, "warn");
      }
    }
    hideProgress();
    render();
    scheduleAutoReconcile(`อัปโหลด ${list.length} ไฟล์`);
  };
  dz.addEventListener("drop", (e) => handleFiles([...e.dataTransfer.files]));
  input.addEventListener("change", (e) => handleFiles([...e.target.files]));

  $("#clearFiles").addEventListener("click", () => {
    ImportState.files = [];
    render();
    updateAutoStatus();
  });
  $("#backToDemo").addEventListener("click", () => {
    location.reload();
  });
};

/* =============================================================
   Phase 4 — การแจ้งเตือน
   ============================================================= */

function runNotificationRules() {
  const r = Store.data.notifyRules;
  if (r.fileMissing) {
    const bad = DB.files.filter((f) => f.status === "missing" || f.status === "wrong_company");
    if (bad.length) Store.notify("bad", `ไฟล์ยังไม่ครบ ${bad.length} รายการ`, bad.map((b) => `${b.companyName} - ${b.fileType}`).join(", "), "intake");
  }
  if (r.criticalException) {
    const crit = DB.exceptions.filter((e) => e.severity === "critical" && !["closed", "approved"].includes(e.status));
    if (crit.length) Store.notify("bad", `พบ exception ระดับ Critical ${crit.length} รายการ`, `ยอดที่ต้องตรวจรวม ${money0(sumRisk(crit))} บาท`, "exceptions");
  }
  if (r.slaBreach) {
    const over = DB.exceptions.filter((e) => e.overSla && !["closed", "approved"].includes(e.status));
    if (over.length) Store.notify("warn", `เคสเลย SLA ${over.length} รายการ`, "ต้องเร่งติดตามชี้แจงภายในวันนี้", "exceptions");
  }
  if (r.cycleDue) {
    const open = DB.damageCycles.filter((c) => c.status === "open");
    if (open.length) Store.notify("info", `รอบชี้แจง ${open[0].name} ยังไม่ปิด`, `มี ${DB.damages.filter((d) => d.cycle === open[0].code).length} เคสรอสรุป`, "damage");
  }
  updateBell();
}

function updateBell() {
  const n = state.dataset === "production" && liveOverviewState.notifications ? liveOverviewState.notifications.filter((row) => !row.read_at).length : Store.unread();
  const b = $("#bellCount");
  if (!b) return;
  b.textContent = n > 99 ? "99+" : n;
  b.hidden = n === 0;
}

function renderLiveNotifications(root) {
  if (!ensureLiveOverview(root)) return;
  const list = liveOverviewState.notifications || [];
  const tone = { info: "blue", warning: "amber", error: "red", success: "green" };
  root.innerHTML = `<section class="panel">
    <div class="panel-heading"><div><p class="eyebrow">Supabase recon_notifications</p><h2>การแจ้งเตือนจริง (${num(list.length)})</h2><small class="head-sub">ยังไม่อ่าน ${num(list.filter((row)=>!row.read_at).length)}</small></div><div class="inline-actions"><button class="ghost-button sm" id="liveNotifRefresh">รีเฟรช</button><button class="ghost-button sm" id="liveNotifRead">อ่านทั้งหมด</button></div></div>
    <div class="notif-list">${list.map((row)=>`<div class="notif ${row.read_at?"":"unread"}"><span class="badge ${tone[row.level]||"grey"}">${h(row.level)}</span><div><strong>${h(row.title)}</strong><span>${h(row.detail||"")}</span><small>${h(new Date(row.created_at).toLocaleString("th-TH"))}${row.company?` · ${h(row.company)}`:""}</small></div>${row.business_date?`<button class="ghost-button xs" data-notif-date="${h(row.business_date)}" data-notif-company="${h(row.company||"ALL")}">เปิดดู</button>`:""}</div>`).join("")||`<p class="empty">ยังไม่มีการแจ้งเตือนจากระบบ</p>`}</div>
    <p class="hint">รายการนี้อ่านจากฐานข้อมูลจริง การแจ้ง Telegram ทำงานจาก n8n ไม่ได้จำลองในเบราว์เซอร์</p>
  </section>`;
  $("#liveNotifRefresh")?.addEventListener("click",()=>loadLiveOverview(true));
  $("#liveNotifRead")?.addEventListener("click",async()=>{
    const unread=list.filter((row)=>!row.read_at); if(!unread.length)return toast("อ่านครบแล้ว");
    await Promise.all(unread.map((row)=>Sb.patch("recon_notifications",`id=eq.${row.id}`,{read_at:new Date().toISOString()})));
    await loadLiveOverview(true); toast("ทำเครื่องหมายอ่านแล้ว");
  });
  root.querySelectorAll("[data-notif-date]").forEach((button)=>button.addEventListener("click",()=>{state.filters.date=button.dataset.notifDate;state.filters.from=button.dataset.notifDate;state.filters.to=button.dataset.notifDate;state.filters.company=button.dataset.notifCompany||"ALL";state.filters.preset="day";go("dashboard");}));
}

VIEWS.notifications = (root) => {
  if (state.dataset === "production" && Sb.signedIn()) {
    renderLiveNotifications(root);
    return;
  }
  const list = Store.data.notifications;
  const rules = Store.data.notifyRules;
  const kindTone = { bad: "red", warn: "amber", info: "blue", ok: "green", fx: "violet" };
  const kindLabel = { bad: "ต้องแก้ทันที", warn: "เฝ้าระวัง", info: "แจ้งให้ทราบ", ok: "ปกติ" };

  root.innerHTML = `
    <section class="grid-2">
      <div class="panel">
        <div class="panel-heading">
          <div><p class="eyebrow">Inbox</p><h2>การแจ้งเตือน (${list.length})</h2></div>
          <div class="inline-actions">
            <button class="ghost-button sm" id="nCheck">ตรวจเงื่อนไขเดี๋ยวนี้</button>
            <button class="ghost-button sm" id="nRead">ทำเครื่องหมายอ่านแล้ว</button>
          </div>
        </div>
        <div class="notif-list">
          ${
            list
              .map(
                (n) => `<div class="notif ${n.read ? "" : "unread"}">
            <span class="badge ${kindTone[n.kind]}">${kindLabel[n.kind]}</span>
            <div>
              <strong>${h(n.title)}</strong>
              <span>${h(n.detail)}</span>
              <small>${h(new Date(n.at).toLocaleString("th-TH"))}</small>
            </div>
            ${n.link ? `<button class="ghost-button xs" data-nlink="${h(n.link)}">เปิดดู</button>` : ""}
          </div>`,
              )
              .join("") || `<p class="empty">ยังไม่มีการแจ้งเตือน</p>`
          }
        </div>
      </div>

      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Rules</p><h2>เงื่อนไขและช่องทาง</h2></div></div>
        <div class="toggle-list">
          ${[
            ["fileMissing", "แจ้งเมื่อไฟล์ขาดหรือส่งผิดบริษัท"],
            ["criticalException", "แจ้งเมื่อพบ exception ระดับ Critical"],
            ["slaBreach", "แจ้งเมื่อมีเคสเลย SLA"],
            ["cycleDue", "แจ้งเมื่อใกล้ครบรอบชี้แจง"],
          ]
            .map(([k, l]) => `<label><input type="checkbox" data-nrule="${k}" ${rules[k] ? "checked" : ""} /> ${h(l)}</label>`)
            .join("")}
        </div>
        <h3 class="drawer-h3">ช่องทางส่ง</h3>
        <div class="toggle-list">
          ${[
            ["channelInApp", "แสดงในระบบ (กระดิ่งมุมบนขวา)"],
            ["channelEmail", "ส่งอีเมลถึงผู้รับผิดชอบ"],
            ["channelTelegram", "ส่ง Telegram เมื่อ severity สูง"],
          ]
            .map(([k, l]) => `<label><input type="checkbox" data-nrule="${k}" ${rules[k] ? "checked" : ""} /> ${h(l)}</label>`)
            .join("")}
        </div>
        <p class="hint">ในระบบจริง ช่องทางอีเมลและ Telegram จะยิงจากฝั่ง backend ตอนนี้บันทึกการตั้งค่าไว้และแสดงผลในระบบเท่านั้น</p>
      </div>
    </section>`;

  $("#nCheck").addEventListener("click", () => {
    runNotificationRules();
    toast("ตรวจเงื่อนไขและสร้างการแจ้งเตือนใหม่แล้ว");
    render();
  });
  $("#nRead").addEventListener("click", () => {
    Store.markAllRead();
    updateBell();
    render();
  });
  root.querySelectorAll("[data-nrule]").forEach((c) =>
    c.addEventListener("change", () => {
      Store.data.notifyRules[c.dataset.nrule] = c.checked;
      Store.persist();
      toast("บันทึกการตั้งค่าแจ้งเตือนแล้ว");
    }),
  );
  root.querySelectorAll("[data-nlink]").forEach((b) => b.addEventListener("click", () => go(b.dataset.nlink)));
};

/* =============================================================
   Phase 4 — ตั้งเวลา, retention, performance
   ============================================================= */

let scheduleTimer = null;
let cloudWorkerTimer = null;
let cloudWorkerBusy = false;
let cloudWorkerGeneration = 0;

function bangkokDate(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const base = `${parts.find((p) => p.type === "year").value}-${parts.find((p) => p.type === "month").value}-${parts.find((p) => p.type === "day").value}`;
  const d = new Date(base + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function cloudWorkerTick() {
  if (cloudWorkerBusy || !Sb.configured() || !Sb.signedIn()) return;
  cloudWorkerBusy = true;
  let job = null;
  try {
    await Sb.queueDueJobs(bangkokDate(-14), bangkokDate(1));
    job = await Sb.claimJob(Sb.currentEmail() || "web-worker");
    if (!job || !job.id) return;
    state.filters.date = job.business_date;
    state.filters.from = job.business_date;
    state.filters.to = job.business_date;
    const batches = await Sb.batches({ from: job.business_date, to: job.business_date });
    const files = batches
      .flatMap((b) => (b.source_files || []).filter((f) => String(f.company || b.company || "").toUpperCase() === String(job.company || "").toUpperCase()))
      .filter((f) => /\.(xlsx|xlsm|xls|csv|txt|pdf)$/i.test(f.file_name) && f.kind !== "doc_clarify" && f.kind !== "unknown" && !f.parse_error);
    if (!files.length) throw new Error("ไม่พบไฟล์ที่ตัวอ่านรองรับในคิวนี้");
    Store.notify("ok", "เริ่มคิวกระทบยอดรายวัน", `${job.business_date} · ${job.company} · ${files.length} ไฟล์`, "cloud");
    await cloudImport(files, { clear: true, job });
  } catch (e) {
    if (job && job.id) await Sb.failJob(job.id, e.message).catch(() => {});
    console.warn("daily reconciliation worker", e);
  } finally {
    cloudWorkerBusy = false;
  }
}

function startCloudWorker() {
  const generation = ++cloudWorkerGeneration;
  clearTimeout(cloudWorkerTimer);
  if (!Sb.configured() || !Sb.signedIn()) return;
  const runNext = async () => {
    await cloudWorkerTick();
    if (generation !== cloudWorkerGeneration || !Sb.configured() || !Sb.signedIn()) return;
    cloudWorkerTimer = setTimeout(runNext, 15000);
  };
  runNext();
}

function startScheduler() {
  clearInterval(scheduleTimer);
  const sc = Store.data.schedule;
  if (!sc.enabled) return;
  const ms = Math.max(1, sc.intervalMinutes) * 60000;
  sc.nextRun = new Date(Date.now() + ms).toISOString();
  Store.persist();
  scheduleTimer = setInterval(async () => {
    sc.lastRun = new Date().toISOString();
    sc.nextRun = new Date(Date.now() + ms).toISOString();
    Store.persist();
    if (sc.autoIngest) {
      const inbox = ImportState.inbox || buildInbox();
      const pending = inbox.messages.filter((m) => !m.pulled);
      for (const m of pending) {
        await ingestRaw(m.file.name, m.file.content, m.file.content.length);
        m.pulled = true;
      }
      if (pending.length) logAction("scheduled_ingest", "source_file", "inbox", `ดึงไฟล์จากอีเมลกลาง ${pending.length} ไฟล์`);
    }
    Store.notify("ok", "ทำงานตามตารางเวลาแล้ว", `ดึงไฟล์และกระทบยอดอัตโนมัติ · รอบถัดไปอีก ${sc.intervalMinutes} นาที`, "dashboard");
    updateBell();
    if (autoReadiness().ready) await runReconcileFromImport({ auto: true, reason: "ถึงเวลาตามตาราง" });
    else if (state.route === "schedule") render();
  }, ms);
}

VIEWS.schedule = (root) => {
  const sc = Store.data.schedule;
  const rt = Store.data.retention;
  const editable = can("settings") || can("rules");
  const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString("th-TH") : "ยังไม่เคยรัน");

  root.innerHTML = `
    <section class="grid-2">
      <div class="panel">
        <div class="panel-heading">
          <div><p class="eyebrow">Scheduled Reconcile</p><h2>ดึงไฟล์และกระทบยอดตามเวลา</h2></div>
          <span class="health ${sc.enabled ? "ok" : "attention"}">${sc.enabled ? "เปิดใช้งาน" : "ปิดอยู่"}</span>
        </div>
        <div class="toggle-list">
          <label><input type="checkbox" id="scEnabled" ${sc.enabled ? "checked" : ""} ${editable ? "" : "disabled"} /> เปิดการทำงานตามตารางเวลา</label>
          <label><input type="checkbox" id="scIngest" ${sc.autoIngest ? "checked" : ""} ${editable ? "" : "disabled"} /> ดึงไฟล์จากอีเมลกลางก่อนกระทบยอดทุกครั้ง</label>
        </div>
        <div class="setting-list mt">
          <label><span>รันทุก</span><input type="number" id="scInterval" value="${sc.intervalMinutes}" min="1" ${editable ? "" : "disabled"} /><b>นาที</b></label>
        </div>
        <div class="run-grid">
          <div><span>รันล่าสุด</span><b>${h(fmtTime(sc.lastRun))}</b></div>
          <div><span>รอบถัดไป</span><b>${h(sc.enabled ? fmtTime(sc.nextRun) : "-")}</b></div>
        </div>
        <div class="inline-actions mt">
          <button class="primary-button" id="scSave" ${editable ? "" : "disabled"}>บันทึกตารางเวลา</button>
          <button class="ghost-button" id="scNow">ทำงานเดี๋ยวนี้</button>
        </div>
        <p class="hint">n8n ตรวจความครบถ้วนและจัดคิวถาวรทุก 10 นาที ส่วนตัวอ่าน PDF/XLSX จะรับงานจากคิวเมื่อหน้าเว็บที่ล็อกอินเปิดอยู่ · ไฟล์มาช้าจะถูกติดธงและรันซ้ำอัตโนมัติ</p>
      </div>

      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Data Protection</p><h2>เก็บข้อมูล สำรอง และเข้ารหัส</h2></div></div>
        <div class="setting-list">
          <label><span>เก็บข้อมูลย้อนหลัง</span><input type="number" id="rtMonths" value="${rt.months}" min="1" ${editable ? "" : "disabled"} /><b>เดือน</b></label>
        </div>
        <div class="toggle-list">
          <label><input type="checkbox" id="rtBackup" ${rt.backupDaily ? "checked" : ""} ${editable ? "" : "disabled"} /> สำรองข้อมูลอัตโนมัติทุกวัน</label>
          <label><input type="checkbox" id="rtEncrypt" ${rt.encryptAtRest ? "checked" : ""} ${editable ? "" : "disabled"} /> เข้ารหัสข้อมูลการเงินขณะจัดเก็บ</label>
          <label><input type="checkbox" id="rtMask" ${rt.maskAccount ? "checked" : ""} ${editable ? "" : "disabled"} /> ปิดบังเลขบัญชีสำหรับบทบาทที่ไม่จำเป็นต้องเห็น</label>
        </div>
        <ul class="tick-list mt">
          <li>ไม่มี bot login mobile banking — รับข้อมูลจาก email / export เท่านั้น</li>
          <li>ทุก action สำคัญมี audit log แบบเขียนได้อย่างเดียว</li>
          <li>ไม่มีบทบาทใดลบ transaction หรือหลักฐานได้</li>
        </ul>
        <button class="ghost-button mt" id="rtSave" ${editable ? "" : "disabled"}>บันทึกนโยบาย</button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Performance</p><h2>ทดสอบระดับ 100,000-200,000 รายการต่อวัน</h2></div>
        <span class="health ok">เกณฑ์: daily report เสร็จใน 1-2 ชั่วโมง</span>
      </div>
      <div class="inline-actions">
        <label class="chk-inline">จำนวนรายการที่จะทดสอบ
          <select id="perfSize">
            <option value="50000">50,000</option>
            <option value="100000" selected>100,000</option>
            <option value="200000">200,000</option>
          </select>
        </label>
        <button class="primary-button" id="perfRun">เริ่มทดสอบ</button>
      </div>
      <div id="perfResult"></div>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Session</p><h2>การเก็บสถานะและการล้างข้อมูล</h2></div>
        <span class="health ${Store.available ? "ok" : "attention"}">${Store.available ? "บันทึกในเครื่องได้" : "เบราว์เซอร์นี้บันทึกไม่ได้ ใช้หน่วยความจำชั่วคราว"}</span>
      </div>
      <div class="run-grid">
        <div><span>บันทึกล่าสุด</span><b>${h(Store.data.lastSavedAt ? new Date(Store.data.lastSavedAt).toLocaleString("th-TH") : "-")}</b></div>
        <div><span>Audit log ที่เก็บไว้</span><b>${num(Store.data.auditLog.length)}</b></div>
        <div><span>การแจ้งเตือน</span><b>${num(Store.data.notifications.length)}</b></div>
        <div><span>สถานะเคสที่แก้ไว้</span><b>${num(Object.keys(Store.data.exOverrides).length)}</b></div>
      </div>
      <button class="ghost-button mt" id="wipe">ล้างข้อมูลที่บันทึกไว้ในเครื่อง</button>
      <button class="primary-button mt" id="startReal">ล้างข้อมูลเก่า + เริ่มเทสข้อมูลจริง</button>
      <p class="chart-note">ปุ่มนี้จะล้างข้อมูลตัวอย่าง/สถานะเก่าทั้งหมด และโหลดบัญชีจริงจากทะเบียนเป็น master แล้วพาไปหน้านำเข้าไฟล์ เพื่อเริ่มเทสด้วยไฟล์จริงจากศูนย์</p>
    </section>`;

  $("#scSave").addEventListener("click", () => {
    if (!editable) return deny("แก้ตารางเวลา");
    sc.enabled = $("#scEnabled").checked;
    sc.autoIngest = $("#scIngest").checked;
    sc.intervalMinutes = Math.max(1, +$("#scInterval").value || 60);
    Store.persist();
    startScheduler();
    logAction("update", "schedule", "reconcile", `${sc.enabled ? "เปิด" : "ปิด"} · ทุก ${sc.intervalMinutes} นาที`);
    toast("บันทึกตารางเวลาแล้ว");
    render();
  });
  $("#scNow").addEventListener("click", () => {
    sc.lastRun = new Date().toISOString();
    Store.persist();
    logAction("scheduled_run", "match_run", "MANUAL-" + Date.now(), "สั่งทำงานนอกตารางเวลา");
    Store.notify("ok", "สั่งทำงานนอกตารางเวลา", "ดึงไฟล์และกระทบยอดจากหน้าตารางเวลา", "dashboard");
    updateBell();
    if (autoReadiness().ready) runReconcileFromImport({ auto: true, reason: "สั่งนอกตาราง" });
    else {
      toast("ยังไม่มีไฟล์ครบทั้งสองฝั่ง — ระบบจะกระทบยอดให้เมื่อไฟล์เข้าครบ", "warn");
      render();
    }
  });
  $("#rtSave").addEventListener("click", () => {
    if (!editable) return deny("แก้นโยบายข้อมูล");
    rt.months = Math.max(1, +$("#rtMonths").value || 12);
    rt.backupDaily = $("#rtBackup").checked;
    rt.encryptAtRest = $("#rtEncrypt").checked;
    rt.maskAccount = $("#rtMask").checked;
    Store.persist();
    logAction("update", "settings", "retention", `เก็บ ${rt.months} เดือน`);
    toast("บันทึกนโยบายข้อมูลแล้ว");
  });
  $("#perfRun").addEventListener("click", async () => {
    const n = +$("#perfSize").value;
    showProgress(`ทดสอบ performance ${num(n)} รายการ`);
    setProgress(0.02, "สร้างชุดข้อมูลทดสอบ");
    await new Promise((r) => setTimeout(r, 30));
    const tGen = performance.now();
    const scn = Sample.buildScenario(DB.BUSINESS_DATE, n, 7777);
    const genMs = Math.round(performance.now() - tGen);
    const toRec = (r, side) => ({
      sec: r.sec,
      date: DB.BUSINESS_DATE,
      amount: r.amount,
      direction: r.acc.direction,
      account: r.acc.id,
      bank: side === "bo" ? r.bank : r.acc.bank,
      company: r.acc.company,
      username: r.user,
      ref: r.ref,
      desc: "",
      crossDay: r.sec >= 82800,
      raw: "",
    });
    const stm = scn.stm.map((r) => toRec(r, "stm"));
    const bo = scn.bo.map((r) => toRec(r, "bo"));
    delete DB.settings.asOf; // scenario จำลองใช้สูตรอายุแบบปลายวัน ไม่ผูกเวลาจริง
    const res = await Engine.reconcile(stm, bo, DB.settings, DB.accounts, (p, l) => setProgress(0.1 + p * 0.9, l));
    hideProgress();
    const perSec = Math.round((stm.length + bo.length) / (res.elapsedMs / 1000));
    $("#perfResult").innerHTML = `
      <div class="run-grid mt">
        <div><span>รายการฝั่งธนาคาร</span><b>${num(stm.length)}</b></div>
        <div><span>รายการฝั่ง BO</span><b>${num(bo.length)}</b></div>
        <div><span>สร้างชุดทดสอบ</span><b>${genMs} ms</b></div>
        <div><span>เวลาจับคู่</span><b>${res.elapsedMs} ms</b></div>
        <div><span>ความเร็ว</span><b>${num(perSec)} รายการ/วินาที</b></div>
        <div><span>อัตราจับคู่</span><b>${res.matchRate.toFixed(2)}%</b></div>
        <div><span>Exception ที่พบ</span><b>${num(res.exceptions.length)}</b></div>
        <div><span>ผลเทียบเกณฑ์</span><b class="${res.elapsedMs < 60000 ? "ok-txt" : "danger"}">${res.elapsedMs < 60000 ? "ผ่าน" : "ต้องปรับ"}</b></div>
      </div>
      <p class="chart-note">ทดสอบบนเครื่องผู้ใช้ด้วย JavaScript ล้วน ในระบบจริงงานนี้จะย้ายไปฝั่ง server พร้อม index ของฐานข้อมูล ซึ่งจะเร็วกว่านี้อีก</p>`;
    logAction("perf_test", "match_run", "PERF-" + n, `${res.elapsedMs} ms · ${perSec} รายการ/วินาที`);
    toast(`ทดสอบเสร็จ: ${num(perSec)} รายการ/วินาที`);
  });
  $("#wipe").addEventListener("click", () => {
    Store.reset();
    toast("ล้างข้อมูลที่บันทึกไว้แล้ว รีเฟรชหน้าเพื่อเริ่มใหม่");
    render();
  });
  $("#startReal").addEventListener("click", () => {
    if (!confirm("ล้างข้อมูลตัวอย่างและสถานะเก่าทั้งหมด แล้วเริ่มเทสด้วยข้อมูลจริง?\n(บัญชีจริงจากทะเบียนจะถูกโหลดเป็น master)")) return;
    startRealTest();
  });
};

function downloadText(filename, text) {
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}



/* =============================================================
   งานชี้แจง — ระบบ XB (ส่งทุกวัน 17:00) และระบบ 123 (รวบเป็นรอบ 1-15 / 16-25 / 26-สิ้นเดือน)
   ============================================================= */

/* ---------------------------------------------------------------
   2 ระบบที่แผนกตรวจ — สายชี้แจงมาจาก "ระบบต้นทางของบริษัท" ไม่ใช่ความรุนแรง
     XB     -> ส่งหัวหน้ากะทุกวัน ทุกเคส
     SYS123 -> ออดิท 1/2/3 รวบเป็นรอบแล้วตีไฟล์
   --------------------------------------------------------------- */
const sysMeta = (code) => DB.systems.find((x) => x.code === code) || null;
const trackMeta = (code) => DB.systems.find((x) => x.track === code) || DB.systems[1];

/* บริษัทนี้อยู่ระบบไหน (null = ยังไม่ได้กำหนด) */
function systemOfCompany(code) {
  const c = DB.companies.find((x) => x.code === code);
  return c ? c.system || null : null;
}
function setCompanySystem(code, system) {
  let c = DB.companies.find((x) => x.code === code);
  if (!c) {
    c = { code, name: code, type: "main", system: null };
    DB.companies.push(c);
  }
  const old = c.system;
  c.system = system || null;
  Store.data.companySystems = Store.data.companySystems || {};
  Store.data.companySystems[code] = c.system;
  Store.persist();
  logAction("set_system", "company", code, `กำหนดให้บริษัท ${code} อยู่ระบบ ${system ? sysMeta(system).short : "ยังไม่ระบุ"}${old ? ` (เดิม ${old})` : ""}`);
  retagTracks();
}

/* คืนค่าสายชี้แจงของเคสหนึ่ง — ยังไม่ได้กำหนดระบบให้ถือเป็นรายรอบไว้ก่อนและติดธงไว้ */
function trackOfException(e) {
  const sys = systemOfCompany(e.company);
  if (!sys) return { track: "cycle", system: null, unassigned: true };
  const m = sysMeta(sys);
  return { track: m.track, system: sys, unassigned: false };
}

/* เติม track ให้ทุกเคสตามระบบของบริษัท — เรียกทุกครั้งที่ข้อมูลหรือการแมปเปลี่ยน */
function retagTracks() {
  (DB.exceptions || []).forEach((e) => {
    const t = trackOfException(e);
    e.track = t.track;
    e.system = t.system;
    e.systemUnassigned = t.unassigned;
  });
}

/* บริษัทที่โผล่ในข้อมูลแต่ยังไม่ได้บอกว่าอยู่ระบบไหน */
function unassignedCompanies() {
  const seen = new Set((DB.exceptions || []).map((e) => e.company).filter(Boolean));
  ImportState.files.forEach((f) => f.format && f.format.company && seen.add(f.format.company));
  return [...seen].filter((c) => c !== "-" && !systemOfCompany(c));
}

/* รอบชี้แจงที่วันที่นี้ตกอยู่ */
function cycleOf(iso) {
  const d = +String(iso).slice(8, 10);
  const ym = String(iso).slice(0, 7);
  if (d <= 15) return { code: "C1", name: "รอบ 1 (1-15)", from: ym + "-01", to: ym + "-15", closeDay: 15 };
  if (d <= 25) return { code: "C2", name: "รอบ 2 (16-25)", from: ym + "-16", to: ym + "-25", closeDay: 25 };
  const last = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();
  return { code: "C3", name: `รอบ 3 (26-${last})`, from: ym + "-26", to: `${ym}-${last}`, closeDay: last };
}

/* กำหนดส่งคืนของแต่ละสาย */
function dueOf(e) {
  const c = DB.settings.clarify;
  const t = e.track || trackOfException(e).track;
  if (t === "daily") {
    return { label: `${e.date} เวลา ${c.dailyCutoff} น.`, short: c.dailyCutoff + " น.", detail: `ระบบ XB — ออดิทส่งให้หัวหน้ากะภายใน ${c.dailyCutoff} ของวันตรวจ จากนั้นชี้แจงกลับภายใน ${c.dailyRespondHours} ชม. (ส่งทุกเคส ไม่ดูความรุนแรง)` };
  }
  const cy = cycleOf(e.date);
  const due = shiftDays(cy.to, c.cycleRespondDays);
  return { label: `${due} (${cy.name})`, short: due, detail: `ระบบ 123 — ออดิท 1/2/3 รวบรวมถึงวันปิดรอบ ${cy.to} แล้วตีไฟล์ให้ชี้แจงภายใน ${c.cycleRespondDays} วัน`, cycle: cy };
}

/* เอกสาร: สร้างเลขที่ */
function docNo(prefix, key) {
  return `${prefix}-${String(state.filters.date).replace(/-/g, "")}-${key}`;
}

function issueRequestDoc(items, opts) {
  if (!can("request_clarify") && !can("approve")) return deny("ออกใบขอให้ชี้แจง");
  if (!items.length) return toast("ไม่มีรายการที่ต้องชี้แจงในกลุ่มนี้", "warn");
  const shiftName = opts.shiftName || "ทุกกะ";
  const due = dueOf(items[0]);
  const html = Docs.requestHtml({
    docNo: docNo("REQ", opts.key),
    trackName: trackMeta(items[0].track).name,
    issuedAt: state.filters.date,
    periodLabel: opts.periodLabel,
    dueLabel: due.label,
    toName: opts.toName || "หัวหน้ากะ " + shiftName,
    shiftName,
    companyName: state.filters.company === "ALL" ? "ทุกบริษัท" : state.filters.company,
    fromName: "แผนกออดิท",
    issuer: currentUser().name + " (" + currentUser().username + ")",
    items,
    date: items[0].date || state.filters.date,
    stamp: nowStamp(),
  });
  Docs.print(html, docNo("REQ", opts.key));
  items.forEach((e) => {
    if (e.status === "open") e.status = "clarifying";
    saveOverride(e);
  });
  logAction("issue_doc", "clarification", docNo("REQ", opts.key), `ออกใบขอให้ชี้แจง ${items.length} รายการ · ${opts.periodLabel}`);
  toast(`ออกใบขอให้ชี้แจง ${items.length} รายการแล้ว — เลือก "บันทึกเป็น PDF" ในหน้าต่างพิมพ์`);
  render();
}

function issueClarificationDoc(e, narrative) {
  const cy = cycleOf(e.date);
  const html = Docs.clarificationHtml({
    docNo: docNo("CLR", e.id),
    ex: e,
    brand: (DB.companies.find((c) => c.code === e.company) || {}).name || e.company,
    shiftName: (DB.shifts.find((s) => s.code === e.shift) || {}).name || e.shift,
    trackName: trackMeta(e.track).name,
    cycleName: cy.name,
    title: `${e.typeName} — ${e.account} ยอด ${money(e.riskAmount || Math.abs(e.amountDiff))} บาท เวลา ${e.time}`,
    severityName: sevMeta(e.severity).name,
    statusName: statusMeta(e.status).name,
    damage: e.status === "damage",
    narrative: narrative,
    responder: (DB.users.find((u) => u.role === "shift_lead" && u.shift === e.shift) || {}).name,
    issuer: currentUser().name + " (" + currentUser().username + ")",
    issuedAt: state.filters.date,
    stamp: nowStamp(),
  });
  Docs.print(html, docNo("CLR", e.id));
  logAction("issue_doc", "clarification", docNo("CLR", e.id), "ออกเอกสารชี้แจงฉบับสมบูรณ์");
  toast(`ออกเอกสารชี้แจง ${e.id} แล้ว — เลือก "บันทึกเป็น PDF" ในหน้าต่างพิมพ์`);
}

VIEWS.clarify = (root) => {
  if (!ensureLiveOverview(root)) return;
  if (state.dataset === "production" && Sb.signedIn()) {
    const rows = scopedExceptions().filter((e) => ["open", "clarifying", "answered"].includes(e.status));
    const newRows = rows.filter((e) => e.status === "open");
    const waitingRows = rows.filter((e) => e.status === "clarifying");
    const answeredRows = rows.filter((e) => e.status === "answered");
    const groups = [...new Set(rows.map((e) => e.company || "ไม่ระบุ"))].sort((a, b) => a.localeCompare(b, "th"));
    root.innerHTML = `
      <section class="status-strip four">
        <article class="warn"><span>เคสใหม่ ยังไม่ได้ส่งชี้แจง</span><strong>${num(newRows.length)}</strong><small>ต้องตรวจและส่งให้ทีม</small></article>
        <article><span>บริษัทที่เกี่ยวข้อง</span><strong>${num(groups.length)}</strong><small>ไม่แบ่งกะ</small></article>
        <article><span>ส่งแล้ว รอทีมตอบ</span><strong>${num(waitingRows.length)}</strong><small>กำลังติดตามคำชี้แจง</small></article>
        <article class="ok"><span>ทีมตอบแล้ว</span><strong>${num(answeredRows.length)}</strong><small>รอ Audit ตรวจและอนุมัติ</small></article>
      </section>
      <section class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Company workflow</p><h2>งานชี้แจงแยกตามบริษัท</h2><small class="head-sub">กดการ์ดบริษัทเพื่อเปิดรายการที่ต้องดำเนินการทั้งหมด</small></div><button class="primary-button sm" id="openApprovalQueue" ${answeredRows.length ? "" : "disabled"}>ตรวจคำชี้แจงที่ตอบแล้ว (${num(answeredRows.length)})</button></div>
        <div class="company-overview-grid">${groups.map((company) => {
          const own = rows.filter((e) => (e.company || "ไม่ระบุ") === company);
          const ownNew = own.filter((e) => e.status === "open").length;
          const ownWaiting = own.filter((e) => e.status === "clarifying").length;
          const ownAnswered = own.filter((e) => e.status === "answered").length;
          return `<article class="company-overview-card action-card" role="button" tabindex="0" data-clarify-company="${h(company)}" aria-label="เปิดเคสของบริษัท ${h(company)}"><div class="company-card-head"><div><strong>${h(company)}</strong><span>${num(own.length)} เคส</span></div><small class="${own.some((e) => e.overSla) ? "danger" : ""}">เกิน SLA ${num(own.filter((e) => e.overSla).length)}</small></div><div class="company-metrics"><span>ยังไม่ได้ส่ง <b>${num(ownNew)}</b></span><span class="warn">รอทีมตอบ <b>${num(ownWaiting)}</b></span><span class="ok">ตอบแล้ว <b>${num(ownAnswered)}</b></span><span class="bad">ยอดเสี่ยง <b>${money0(sumRisk(own))}</b></span></div><div class="company-card-action">ดูเคสทั้งหมด <span aria-hidden="true">→</span></div></article>`;
        }).join("") || `<p class="empty-box">ไม่มีงานชี้แจงในช่วงที่เลือก</p>`}</div>
      </section>
      <section class="panel"><div class="panel-heading"><div><p class="eyebrow">รายการจริง</p><h2>เคสที่ต้องติดตาม</h2></div></div><div class="table-wrap"><table><thead><tr><th>เคส</th><th>วันที่</th><th>บริษัท</th><th>ประเภท</th><th>ผู้เกี่ยวข้อง</th><th>สถานะ</th><th>SLA</th><th class="right">ยอดที่ต้องตรวจ</th></tr></thead><tbody>${rows.map((e) => `<tr><td><button class="link-btn" data-open-ex="${h(e.id)}">${h(e.id)}</button></td><td>${h(e.date)} ${h(e.time)}</td><td><b>${h(e.company)}</b></td><td>${h(e.typeName)}</td><td>${h(e.employee)}</td><td><span class="badge ${statusMeta(e.status).tone}">${h(statusMeta(e.status).name)}</span></td><td class="${e.overSla ? "danger" : ""}">${e.overSla ? "เกิน " : ""}${num(e.ageHours)}/${num(e.slaHours)} ชม.</td><td class="right tnum">${money0(e.riskAmount || Math.abs(e.amountDiff))}</td></tr>`).join("") || `<tr><td colspan="8" class="empty">ไม่มีรายการ</td></tr>`}</tbody></table></div></section>`;
    root.querySelectorAll("[data-open-ex]").forEach((button) => button.addEventListener("click", () => openException(button.dataset.openEx)));
    const openCompanyCases = (company) => go("exceptions", {
      filters: { company },
      exFilter: { q: "", type: "ALL", severity: "ALL", status: "ACTION", sla: false },
    });
    root.querySelectorAll("[data-clarify-company]").forEach((card) => {
      card.addEventListener("click", () => openCompanyCases(card.dataset.clarifyCompany));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openCompanyCases(card.dataset.clarifyCompany);
        }
      });
    });
    $("#openApprovalQueue")?.addEventListener("click", () => go("approvals"));
    return;
  }
  retagTracks();
  const all = scopedExceptions().filter((e) => !["closed", "approved"].includes(e.status));
  const daily = all.filter((e) => e.track === "daily");
  const cyc = all.filter((e) => e.track === "cycle");
  const c = DB.settings.clarify;
  const XB = sysMeta("XB");
  const S123 = sysMeta("SYS123");
  const known = [...new Set(companyMaster().map((x) => x.code).concat(all.map((e) => e.company)))].filter((x) => x && x !== "-");
  const pending = known.filter((code) => !systemOfCompany(code));
  const pendingActive = unassignedCompanies(); // ที่มีข้อมูลเข้ามาแล้วแต่ยังไม่ได้กำหนด

  /* ระบบ XB: จัดกลุ่มตามกะเพื่อส่งหัวหน้ากะแต่ละกะ */
  const byShift = DB.shifts.map((s) => ({
    shift: s,
    items: daily.filter((e) => e.shift === s.code),
    lead: DB.users.find((u) => u.role === "shift_lead" && u.shift === s.code),
  }));

  /* ระบบ 123: จัดกลุ่มตามรอบตีไฟล์ */
  const cycles = {};
  cyc.forEach((e) => {
    const cy = cycleOf(e.date);
    (cycles[cy.code] = cycles[cy.code] || { cy, items: [] }).items.push(e);
  });
  const cycleList = Object.values(cycles).sort((a, b) => a.cy.code.localeCompare(b.cy.code));

  root.innerHTML = `
    <section class="status-strip four">
      <article class="${daily.length ? "warn" : "ok"}"><span>ระบบ XB (ส่ง ${h(c.dailyCutoff)} ทุกวัน)</span><strong>${num(daily.length)}</strong><small>ส่งหัวหน้ากะทุกเคส ไม่ดูความรุนแรง</small></article>
      <article><span>ระบบ 123 (ตีไฟล์เป็นรอบ)</span><strong>${num(cyc.length)}</strong><small>ออดิท 1/2/3 รวบเป็นรอบ ให้เวลาชี้แจง ${c.cycleRespondDays} วัน</small></article>
      <article><span>ชี้แจงกลับมาแล้ว</span><strong>${num(all.filter((e) => e.status === "answered").length)}</strong><small>รอออดิทตรวจทาน</small></article>
      <article class="bad"><span>ค้างเกินกำหนด</span><strong>${num(all.filter((e) => e.overSla).length)}</strong><small>ต้องเร่งติดตาม</small></article>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">System Mapping</p><h2>บริษัทไหนอยู่ระบบไหน</h2>
        <small class="head-sub">สายชี้แจงมาจากระบบต้นทาง ไม่ใช่ความรุนแรง — ตั้งครั้งเดียว ระบบจำไว้ให้</small></div>
        <span class="health ${pendingActive.length ? "attention" : pending.length ? "" : "ok"}">${pending.length ? `ยังไม่ได้กำหนด ${pending.length} บริษัท` : "กำหนดครบแล้ว"}</span>
      </div>
      ${pendingActive.length ? `<p class="hint danger">บริษัท <b>${h(pendingActive.join(", "))}</b> มีข้อมูลเข้ามาแล้วแต่ยังไม่ได้บอกว่าอยู่ระบบไหน — ระบบจัดเป็นรายรอบไว้ก่อน กรุณาเลือกให้ถูก</p>` : ""}
      <div class="sysmap">
        ${known
          .map((code) => {
            const cur = systemOfCompany(code);
            const co = DB.companies.find((x) => x.code === code) || { name: code };
            const n = all.filter((e) => e.company === code).length;
            return `<div class="sysmap-row ${cur ? "" : "todo"}">
              <div><strong>${h(co.name || code)}</strong><span>${num(n)} เคสในช่วงนี้</span></div>
              <div class="sysmap-btns">
                <button class="chip-btn ${cur === "XB" ? "on amber" : ""}" data-sys="${h(code)}" data-val="XB">XB · รายวัน</button>
                <button class="chip-btn ${cur === "SYS123" ? "on blue" : ""}" data-sys="${h(code)}" data-val="SYS123">123 · รายรอบ</button>
                <button class="chip-btn ${cur ? "" : "on"}" data-sys="${h(code)}" data-val="">ยังไม่ระบุ</button>
              </div>
            </div>`;
          })
          .join("")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">${h(XB.name)}</p><h2>รายการที่ต้องส่งหัวหน้ากะวันนี้</h2>
        <small class="head-sub">${h(XB.desc)}</small></div>
        <span class="health ${daily.length ? "attention" : "ok"}">กำหนดส่ง ${h(c.dailyCutoff)} น. ของ ${h(state.filters.date)}</span>
      </div>
      <div class="track-grid">
        ${byShift
          .map(
            (g) => `<div class="track-card ${g.items.length ? "" : "empty"}">
          <div class="track-head">
            <div><strong>${h(g.shift.name)}</strong><span>${h(g.shift.range)}</span></div>
            <b>${g.items.length}</b>
          </div>
          <div class="track-body">
            <div class="kv-line"><span>หัวหน้ากะ</span><b>${h(g.lead ? g.lead.name : "-")}</b></div>
            <div class="kv-line"><span>ยอดที่ต้องตรวจ</span><b>${money0(sumRisk(g.items))} บาท</b></div>
            <div class="kv-line"><span>Critical / High</span><b>${g.items.filter((e) => e.severity === "critical").length} / ${g.items.filter((e) => e.severity === "high").length}</b></div>
          </div>
          <button class="primary-button sm" data-req-shift="${g.shift.code}" ${g.items.length ? "" : "disabled"}>ออกใบขอให้ชี้แจง</button>
        </div>`,
          )
          .join("")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">${h(S123.name)}</p><h2>รายการที่รวบเป็นรอบ</h2>
        <small class="head-sub">${h(S123.desc)}</small></div>
      </div>
      ${
        cycleList.length
          ? `<div class="track-grid">${cycleList
              .map((g) => {
                const due = shiftDays(g.cy.to, c.cycleRespondDays);
                const late = due < state.filters.date;
                return `<div class="track-card">
              <div class="track-head"><div><strong>${h(g.cy.name)}</strong><span>${h(g.cy.from)} ถึง ${h(g.cy.to)}</span></div><b>${g.items.length}</b></div>
              <div class="track-body">
                <div class="kv-line"><span>ปิดรอบ</span><b>${h(g.cy.to)}</b></div>
                <div class="kv-line"><span>กำหนดชี้แจง</span><b class="${late ? "danger" : ""}">${h(due)}</b></div>
                <div class="kv-line"><span>ยอดที่ต้องตรวจ</span><b>${money0(sumRisk(g.items))} บาท</b></div>
              </div>
              <button class="primary-button sm" data-req-cycle="${g.cy.code}">ออกใบขอให้ชี้แจงทั้งรอบ</button>
            </div>`;
              })
              .join("")}</div>`
          : `<p class="empty">ไม่มีรายการของระบบ 123 ตามตัวกรองนี้</p>`
      }
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Clarification Queue</p><h2>รายการทั้งหมดพร้อมกำหนดส่ง</h2>
        <small class="head-sub">กดที่เลขเคสเพื่อเปิดรายละเอียด · ปุ่มขวาสุดออกเอกสารชี้แจงรายเคสเป็น PDF</small></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>เคส</th><th>สาย</th><th>เวลา</th><th>ประเภท</th><th class="right">ยอดที่ต้องตรวจ</th><th>กะ / ผู้เกี่ยวข้อง</th><th>กำหนดส่ง</th><th>สถานะ</th><th class="right">เอกสาร</th></tr></thead>
          <tbody>
            ${
              all
                .slice(0, 40)
                .map((e) => {
                  const d = dueOf(e);
                  return `<tr>
                <td><button class="link-btn" data-ex="${e.id}">${e.id}</button></td>
                <td><span class="badge ${e.track === "daily" ? "amber" : "blue"}">${h(trackMeta(e.track).short)}</span></td>
                <td class="tnum">${e.time}</td>
                <td>${h(e.typeName)}</td>
                <td class="right tnum">${e.riskAmount ? money(e.riskAmount) : "—"}</td>
                <td>${h((DB.shifts.find((s) => s.code === e.shift) || {}).name || e.shift)}<small class="sub">${h(e.employee)}</small></td>
                <td class="${e.overSla ? "danger" : ""}">${h(d.short)}</td>
                <td><span class="badge ${statusMeta(e.status).tone}">${h(statusMeta(e.status).name)}</span></td>
                <td class="right nowrap"><button class="ghost-button xs" data-clr="${e.id}">เอกสารชี้แจง</button></td>
              </tr>`;
                })
                .join("") || `<tr><td colspan="9" class="empty">ไม่มีรายการค้างชี้แจง</td></tr>`
            }
          </tbody>
        </table>
      </div>
      ${all.length > 40 ? `<p class="hint">แสดง 40 รายการแรกจากทั้งหมด ${num(all.length)} รายการ — ใช้ตัวกรองด้านบนเพื่อลดขอบเขต</p>` : ""}
    </section>`;

  root.querySelectorAll("[data-sys]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!can("rules") && !can("settings") && !can("approve")) return deny("กำหนดระบบของบริษัท");
      setCompanySystem(b.dataset.sys, b.dataset.val || null);
      toast(`${b.dataset.sys} → ${b.dataset.val ? sysMeta(b.dataset.val).short : "ยังไม่ระบุ"}`);
      render();
    }),
  );
  root.querySelectorAll("[data-req-shift]").forEach((b) =>
    b.addEventListener("click", () => {
      const g = byShift.find((x) => x.shift.code === b.dataset.reqShift);
      issueRequestDoc(g.items, {
        key: g.shift.code.toUpperCase(),
        shiftName: g.shift.name,
        toName: g.lead ? g.lead.name : "หัวหน้ากะ " + g.shift.name,
        periodLabel: `วันที่ ${state.filters.date} (${g.shift.name} ${g.shift.range})`,
      });
    }),
  );
  root.querySelectorAll("[data-req-cycle]").forEach((b) =>
    b.addEventListener("click", () => {
      const g = cycleList.find((x) => x.cy.code === b.dataset.reqCycle);
      issueRequestDoc(g.items, { key: g.cy.code, shiftName: "ทุกกะ", periodLabel: `${g.cy.name} · ${g.cy.from} ถึง ${g.cy.to}` });
    }),
  );
  root.querySelectorAll("[data-ex]").forEach((b) => b.addEventListener("click", () => openException(b.dataset.ex)));
  root.querySelectorAll("[data-clr]").forEach((b) =>
    b.addEventListener("click", () => {
      const e = DB.exceptions.find((x) => x.id === b.dataset.clr);
      issueClarificationDoc(e, (e.notes || []).map((n) => n.text).join("\n"));
    }),
  );
};

/* =============================================================
   Export: Excel หลายชีต + บันทึกเป็นภาพ
   ============================================================= */

function openModal(title, bodyHtml, footHtml) {
  const m = $("#modal");
  if (typeof m._contentCleanup === "function") m._contentCleanup();
  m._contentCleanup = null;
  m.classList.remove("file-preview-modal");
  m.innerHTML = `
    <header class="modal-head">
      <h2 id="modalTitle">${title}</h2>
      <button class="icon-btn" id="modalClose" aria-label="ปิด">✕</button>
    </header>
    <div class="modal-body">${bodyHtml}</div>
    ${footHtml ? `<footer class="modal-foot">${footHtml}</footer>` : ""}`;
  m.hidden = false;
  $("#modalOverlay").hidden = false;
  requestAnimationFrame(() => m.classList.add("on"));
  $("#modalClose").addEventListener("click", closeModal);
  $("#modalOverlay").addEventListener("click", closeModal, { once: true });
}
function closeModal() {
  const m = $("#modal");
  if (!m || m.hidden) return;
  if (typeof m._contentCleanup === "function") m._contentCleanup();
  m._contentCleanup = null;
  m.classList.remove("on");
  $("#modalOverlay").hidden = true;
  setTimeout(() => (m.hidden = true), 200);
}

/* ตัวสร้างชุดข้อมูลแต่ละชีต ตามช่วงวันที่ปัจจุบัน */
const SHEET_BUILDERS = {
  exceptions: {
    label: "ตารางกระทบยอด / รายการผิดปกติ",
    build: () => {
      const rows = filteredExceptions();
      return {
        name: "กระทบยอด",
        title: "ตารางกระทบยอด — ช่องว่างหมายถึงไม่พบคู่และรอชี้แจง",
        headers: ["สถานะ", "เคส", "วันที่", "บริษัท", "ทิศทาง", "บัญชี / Provider", "STM วันที่ / เวลา", "STM ธนาคาร", "ยอด STM", "BO วันที่ / เวลา", "BO ผู้ทำรายการ", "ยอด BO", "ต่างเวลา (วิ)", "ต่างยอด", "ผลการจับคู่", "คำชี้แจง / หมายเหตุ", "ระดับ", "กำหนดส่ง", "เกิน SLA"],
        widths: [14, 11, 12, 12, 9, 18, 21, 15, 13, 21, 18, 13, 13, 13, 24, 42, 10, 14, 10],
        rows: rows.map((e) => {
          const hasStm = e.bankAmount !== null;
          const hasBo = e.systemAmount !== null;
          const explanation = e.resolutionNote || (e.notes || []).at(-1)?.text || "";
          const result = hasStm && hasBo
            ? e.type === "time_diff" ? "ยอดตรง · เวลาต่าง" : e.type === "amount_diff" ? "เวลาใกล้ · ยอดต่าง" : e.typeName
            : hasStm ? "ไม่พบฝั่ง BO" : "ไม่พบฝั่ง STM";
          return [
            statusMeta(e.status).name, e.id, e.date, e.company, e.direction, e.account,
            hasStm ? `${e.date} ${e.time}` : "", hasStm ? e.bank : "", hasStm ? e.bankAmount : "",
            hasBo ? `${e.date} ${e.boTime || e.time}` : "", hasBo ? e.employee : "", hasBo ? e.systemAmount : "",
            hasStm && hasBo ? e.timeDiffSec : "", hasStm && hasBo ? e.amountDiff : "", result,
            explanation || "เว้นไว้รอชี้แจง", sevMeta(e.severity).name, dueOf(e).short, e.overSla ? "เกิน" : "ปกติ",
          ];
        }),
      };
    },
  },
  damage: {
    label: "ทะเบียนความเสียหาย",
    build: () => {
      const rows = DB.damages.filter((d) => inRange(d.date));
      return {
        name: "ความเสียหาย",
        title: "ทะเบียนความเสียหาย",
        headers: ["รหัส", "เคสอ้างอิง", "วันที่", "รอบ", "บริษัท", "พนักงาน", "กะ", "ยอดเสียหาย (บาท)", "สาเหตุ", "หลักฐาน", "สถานะ HR", "สถานะการเงิน"],
        widths: [14, 12, 12, 8, 12, 17, 10, 17, 32, 10, 16, 16],
        rows: rows.map((d) => {
          return [
            d.id, d.exceptionId, d.date, d.cycle,
            (DB.companies.find((c) => c.code === d.company) || {}).name || d.company,
            d.employee, (DB.shifts.find((sh) => sh.code === d.shift) || {}).name || d.shift,
            dmgTHB(d),
            d.cause, d.evidence ? "ครบ" : "รอ", d.hrStatus, d.financeStatus,
          ];
        }),
      };
    },
  },
  kpi: {
    label: "KPI รายพนักงาน",
    build: () => {
      const ex = scopedExceptions();
      return {
        name: "KPI",
        title: "KPI รายพนักงาน",
        headers: ["พนักงาน", "บริษัท", "เคสทั้งหมด", "Critical", "High", "เกิน SLA", "ยอดที่ต้องตรวจ", "ระดับความเสี่ยง"],
        widths: [18, 18, 12, 10, 10, 10, 16, 14],
        rows: [...new Set(ex.map((e) => e.employee || "ไม่ระบุ"))].map((employee) => {
          const r = ex.filter((e) => (e.employee || "ไม่ระบุ") === employee);
          const crit = r.filter((e) => e.severity === "critical").length;
          const sla = r.filter((e) => e.overSla).length;
          return [employee, [...new Set(r.map((e) => e.company))].join(", "), r.length, crit, r.filter((e) => e.severity === "high").length, sla, sumRisk(r), crit >= 4 || sla >= 5 ? "สูง" : crit >= 2 ? "กลาง" : "ต่ำ"];
        }),
      };
    },
  },
  daily: {
    label: "สรุปการกระทบยอดรายวัน",
    build: () => ({
      name: "รายวัน",
      title: "สรุปการกระทบยอดรายวันจาก Supabase",
      headers: ["วันที่", "บริษัท", "ระบบ", "สถานะ", "ไฟล์", "อ่านสำเร็จ", "ข้อผิดพลาด", "ประเภทไฟล์ที่พบ"],
      widths: [12, 16, 18, 16, 10, 12, 12, 40],
      rows: (liveOverviewState.operations || []).filter((x) => inRange(x.business_date) && (state.filters.company === "ALL" || x.company === state.filters.company)).map((x) => [x.business_date, x.company, x.business_system || "", x.status || "", Number(x.file_count || 0), Number(x.parsed_count || 0), Number(x.error_count || 0), (x.present_kinds || []).join(", ")]),
    }),
  },
  monthly: {
    label: "แนวโน้มรายเดือน",
    build: () => {
      const byMonth = DB.damages.filter((d) => inRange(d.date)).reduce((acc, d) => {
        const ym = String(d.date || "").slice(0, 7) || "ไม่ระบุ";
        acc[ym] = acc[ym] || { amount: 0, cases: 0 };
        acc[ym].amount += dmgTHB(d);
        acc[ym].cases++;
        return acc;
      }, {});
      return {
        name: "แนวโน้มรายเดือน",
        title: "แนวโน้มความเสียหายรายเดือน",
        headers: ["เดือน", "ความเสียหายจริง (บาท)", "จำนวนเคส"],
        widths: [14, 22, 12],
        rows: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([ym, m]) => [ym, m.amount, m.cases]),
      };
    },
  },
  intake: {
    label: "สถานะไฟล์ที่รับ",
    build: () => ({
      name: "ไฟล์ที่รับ",
      title: "สถานะไฟล์ประจำวัน",
      headers: ["วันที่ธุรกิจ", "บริษัท", "ชื่อไฟล์", "ประเภท", "เวลาที่รับ", "สถานะอ่านไฟล์", "ข้อผิดพลาด", "Storage path"],
      widths: [14, 16, 34, 18, 22, 16, 35, 45],
      rows: (liveIntakeState.batches || []).flatMap((b) => (b.source_files || []).map((f) => [b.business_date, intakeCompanyOf(f, b) || b.company || "", f.file_name || "", f.kind || "", f.received_at || b.received_at || "", f.parsed ? "อ่านสำเร็จ" : "รออ่าน", f.parse_error || "", f.storage_path || ""])),
    }),
  },
  audit: {
    label: "Audit Log",
    build: () => ({
      name: "Audit Log",
      title: "บันทึกการใช้งานระบบ",
      headers: ["เวลา", "ผู้ใช้", "action", "entity", "target", "รายละเอียด"],
      widths: [20, 18, 16, 16, 22, 60],
      rows: DB.auditLog.filter((l) => inRange(String(l.at).slice(0, 10))).map((l) => [l.at, l.user, l.action, l.entity, l.target, l.detail]),
    }),
  },
};

const DEFAULT_SHEETS = { exceptions: true, damage: true, kpi: true, daily: true, monthly: false, intake: false, audit: false };
const exportChoice = { ...DEFAULT_SHEETS };

const FILE_SLUG = {
  "รายงาน_Audit": "audit-report",
  "รายการผิดปกติ": "exceptions",
  KPI: "kpi",
  "รายงานรายวัน": "daily-report",
  "สรุปรายเดือน": "monthly-summary",
  "audit-log": "audit-log",
  "ความเสียหาย_C1": "damage-cycle-1",
  "ความเสียหาย_C2": "damage-cycle-2",
  "ความเสียหาย_C3": "damage-cycle-3",
};
function exportSheets(baseName, sheets) {
  if (!can("export")) return deny("export ข้อมูล");
  const ascii =
    FILE_SLUG[baseName] ||
    baseName
      .replace(/[^\x20-\x7E]+/g, "-")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") ||
    "report";
  const stamp = state.filters.from === state.filters.to ? state.filters.from : `${state.filters.from}_to_${state.filters.to}`;
  const meta = `ช่วงข้อมูล ${rangeLabel()} · บริษัท ${state.filters.company === "ALL" ? "ทุกบริษัท" : state.filters.company} · ออกโดย ${currentUser().username} เมื่อ ${nowStamp()}`;
  const res = Exporter.workbook(sheets, `${ascii}_${stamp}.xlsx`, meta);
  if (res.ok) {
    logAction("export", "report", baseName, `Excel ${sheets.length} ชีต · ${sheets.reduce((a, c) => a + c.rows.length, 0)} แถว · ${rangeLabel()}`);
    toast(`ดาวน์โหลด ${ascii}_${stamp}.xlsx แล้ว (${sheets.length} ชีต · ${num(sheets.reduce((a, c) => a + c.rows.length, 0))} แถว)`);
    return true;
  }
  // ออฟไลน์: ถอยเป็น CSV ของชีตแรก
  const first = sheets[0];
  Exporter.csv(first.headers, first.rows, `${ascii}_${stamp}.csv`);
  logAction("export", "report", baseName, `CSV (ยังโหลดตัวเขียน Excel ไม่ได้) · ${first.rows.length} แถว`);
  toast("ยังโหลดตัวเขียนไฟล์ Excel ไม่ได้ (ต้องต่ออินเทอร์เน็ต) — ดาวน์โหลดเป็น CSV ให้แทน", "warn");
  return false;
}

async function openExportDialog() {
  if (!can("export")) return deny("export ข้อมูล");
  if (state.dataset === "production" && Sb.signedIn()) {
    try {
      if (!liveOverviewState.quality) {
        toast("กำลังโหลดข้อมูลจริงก่อนเปิด Export...");
        await loadLiveOverview(true);
      }
      if (!liveIntakeState.batches) {
        liveIntakeState.batches = await Sb.batches({ from: state.filters.from, to: state.filters.to, company: state.filters.company });
      }
    } catch (error) {
      return toast("เตรียมข้อมูล Export ไม่สำเร็จ: " + error.message, "warn");
    }
  }
  const f = state.filters;
  openModal(
    "Export รายงาน",
    `
    <div class="exp-section">
      <h3>ช่วงวันที่</h3>
      <div class="exp-range">
        <label>ช่วงสำเร็จรูป
          <select id="expPreset">${DATE_PRESETS.map((p) => `<option value="${p.code}" ${f.preset === p.code ? "selected" : ""}>${h(p.name)}</option>`).join("")}</select>
        </label>
        <label>ตั้งแต่<input type="date" id="expFrom" value="${f.from}" /></label>
        <label>ถึง<input type="date" id="expTo" value="${f.to}" /></label>
      </div>
      <p class="hint" id="expSummary"></p>
    </div>

    <div class="exp-section">
      <h3>ชุดข้อมูลที่ต้องการ (แต่ละชุดเป็น 1 ชีตในไฟล์เดียว)</h3>
      <div class="toggle-list">
        ${Object.entries(SHEET_BUILDERS)
          .map(([k, v]) => `<label><input type="checkbox" data-sheet="${k}" ${exportChoice[k] ? "checked" : ""} /> ${h(v.label)} <b class="sheet-count" data-count="${k}"></b></label>`)
          .join("")}
      </div>
    </div>

    <div class="exp-section">
      <h3>รูปแบบไฟล์</h3>
      <div class="seg">
        <label><input type="radio" name="expFmt" value="xlsx" checked /> Excel (.xlsx) — แนะนำ</label>
        <label><input type="radio" name="expFmt" value="csv" /> CSV (ชีตแรกเท่านั้น)</label>
      </div>
      <p class="hint">${Exporter.hasXLSX() ? "ไฟล์ Excel จะมี autofilter ทุกคอลัมน์ ตรึงหัวตาราง และตัวเลขเป็นตัวเลขจริงที่ SUM ได้ทันที" : "ยังโหลดตัวเขียนไฟล์ Excel ไม่ได้ — ต้องต่ออินเทอร์เน็ตครั้งแรก ระหว่างนี้จะได้ไฟล์ CSV แทน"}</p>
    </div>`,
    `<button class="ghost-button" id="expCancel">ยกเลิก</button>
     <button class="primary-button" id="expGo">ดาวน์โหลด</button>`,
  );

  const refresh = () => {
    Object.keys(SHEET_BUILDERS).forEach((k) => {
      const el = $(`[data-count="${k}"]`);
      if (el) el.textContent = `(${num(SHEET_BUILDERS[k].build().rows.length)} แถว)`;
    });
    const sum = $("#expSummary");
    if (sum) sum.textContent = `ช่วงที่เลือก: ${rangeLabel()}`;
  };
  refresh();

  $("#expPreset").addEventListener("change", (e) => {
    applyPreset(e.target.value);
    $("#expFrom").value = state.filters.from;
    $("#expTo").value = state.filters.to;
    refresh();
  });
  $("#expFrom").addEventListener("change", (e) => {
    state.filters.from = e.target.value;
    state.filters.preset = "custom";
    refresh();
  });
  $("#expTo").addEventListener("change", (e) => {
    state.filters.to = e.target.value;
    state.filters.preset = "custom";
    refresh();
  });
  $$("[data-sheet]").forEach((c) => c.addEventListener("change", () => (exportChoice[c.dataset.sheet] = c.checked)));
  $("#expCancel").addEventListener("click", closeModal);
  $("#expGo").addEventListener("click", () => {
    const picked = Object.keys(SHEET_BUILDERS).filter((k) => exportChoice[k]);
    if (!picked.length) return toast("เลือกอย่างน้อย 1 ชุดข้อมูล", "warn");
    const fmt = $$('input[name="expFmt"]').find((r) => r.checked).value;
    const sheets = picked.map((k) => SHEET_BUILDERS[k].build());
    if (fmt === "csv") {
      const first = sheets[0];
      Exporter.csv(first.headers, first.rows, `audit-report_${state.filters.from}.csv`);
      logAction("export", "report", "csv", `${first.rows.length} แถว · ${rangeLabel()}`);
      toast("ดาวน์โหลด CSV แล้ว");
    } else {
      exportSheets("รายงาน_Audit", sheets);
    }
    closeModal();
    render();
  });
}

/* ---------- บันทึกเป็นภาพ ---------- */
/* ชื่อไฟล์ต้องเป็น ASCII เท่านั้น ไม่งั้นเบราว์เซอร์จะตั้งชื่อไฟล์ให้เป็น "download" */
function asciiSlug(t) {
  return String(t || "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40);
}
function panelFileName(panel) {
  const eyebrow = asciiSlug((panel.querySelector(".eyebrow") || {}).textContent);
  if (eyebrow.length >= 3) return `${state.route}_${eyebrow}`;
  const idx = $$("#viewRoot .panel").indexOf(panel) + 1;
  return `${state.route}_section-${idx}`;
}
async function capturePanel(panel) {
  const title = (panel.querySelector("h2") || {}).textContent || ROUTE_MAP[state.route].title;
  const name = `${panelFileName(panel)}_${state.filters.from}.png`;
  toast("กำลังสร้างภาพ...");
  const res = await Exporter.capture(panel, name, { background: "#ffffff" });
  if (res.ok) {
    logAction("export", "image", title, `บันทึกส่วนรายงานเป็นภาพ (${res.mode})`);
    toast(res.mode === "chart-only" ? `บันทึกกราฟเป็นภาพแล้ว: ${name}` : `บันทึกภาพ ${name} แล้ว`);
  } else {
    toast("บันทึกภาพไม่สำเร็จ: " + res.reason, "warn");
  }
}
async function capturePage() {
  const root = $("#viewRoot");
  const name = `${state.route}_full-page_${state.filters.from}.png`;
  toast("กำลังสร้างภาพทั้งหน้า...");
  if (Exporter.hasCanvas()) {
    const res = await Exporter.capture(root, name, { background: "#f2f7fd", scale: 1.6 });
    if (res.ok) {
      logAction("export", "image", ROUTE_MAP[state.route].title, "บันทึกทั้งหน้าเป็นภาพ");
      return toast(`บันทึกภาพ ${name} แล้ว`);
    }
  }
  // ทางสำรอง: ต่อภาพทีละการ์ดเรียงลงมา ให้ผลแน่นอนกว่าการ render ทั้งหน้าในคราวเดียว
  try {
    const panels = $$("#viewRoot .panel, #viewRoot .status-strip, #viewRoot .pipeline").filter((el) => !el.classList.contains("no-capture") && !el.closest(".no-capture"));
    const n = await Exporter.stitch(panels, name, {
      background: "#f2f7fd",
      scale: 1.6,
      heading: ROUTE_MAP[state.route].title,
      subheading: `ช่วงข้อมูล ${rangeLabel()} · ออกโดย ${currentUser().username} เมื่อ ${nowStamp()}`,
    });
    logAction("export", "image", ROUTE_MAP[state.route].title, `บันทึกทั้งหน้าเป็นภาพ ${n} ส่วน`);
    toast(`บันทึกภาพ ${name} แล้ว (${n} ส่วน)`);
  } catch (e) {
    toast("บันทึกภาพไม่สำเร็จ: " + e.message, "warn");
  }
}

/* ใส่ปุ่มกล้องให้ทุกการ์ดโดยอัตโนมัติหลัง render */
function addPanelCaptureButtons() {
  $$("#viewRoot .panel").forEach((panel) => {
    if (panel.classList.contains("no-capture") || panel.querySelector(".panel-cam")) return;
    const head = panel.querySelector(".panel-heading");
    const btn = document.createElement("button");
    btn.className = "panel-cam no-capture" + (head ? "" : " float");
    btn.type = "button";
    btn.title = "บันทึกส่วนนี้เป็นภาพ PNG";
    btn.setAttribute("aria-label", "บันทึกส่วนนี้เป็นภาพ");
    btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3 7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3H9Zm3 5.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      capturePanel(panel);
    });
    (head || panel).appendChild(btn);
  });
}

/* =============================================================
   Export helpers
   ============================================================= */
function downloadCSV(filename, headers, rows, sheetName) {
  return exportSheets(filename.replace(/\.(csv|xlsx)$/i, ""), [
    { name: sheetName || "ข้อมูล", title: sheetName || filename.replace(/\.(csv|xlsx)$/i, ""), headers, rows, widths: headers.map(() => 18) },
  ]);
}
function exportExceptions() {
  exportSheets("รายการผิดปกติ", [SHEET_BUILDERS.exceptions.build()]);
}

/* =============================================================
   Boot
   ============================================================= */
let productionDataReady = false;

function prepareProductionData() {
  if (productionDataReady) return;
  productionDataReady = true;
  DB.exceptions = [];
  DB.damages = [];
  DB.files = [];
  DB.auditLog = [];
  DB.currentRun = null;
  if (Array.isArray(DB.hourly)) DB.hourly.forEach((x) => { x.total = 0; x.matched = 0; x.exception = 0; });
  const accounts = loadRegistryAccounts();
  if (accounts) DB.accounts = accounts;
  state.dataset = "production";
}

async function applyAuthenticatedRole() {
  const user = Sb.authUser() || {};
  const email = String(user.email || "").toLowerCase();
  const app = window.APP_CONFIG || {};
  let access = null;
  try {
    access = await Sb.myAccess();
    if (Array.isArray(access)) access = access[0] || null;
  } catch (error) {
    /* ช่วง deploy migration ให้บัญชี bootstrap เดิมยังเข้าไปติดตั้ง schema ได้
       บัญชีอื่นจะไม่ถูกอนุญาตจากค่า default หรือ metadata ใน browser */
    const bootstrapRole = app.roleByEmail?.[email];
    if (!bootstrapRole) throw error;
    access = { email, full_name: email, role: bootstrapRole, active: true, companies: ["*"], migration_pending: true };
  }
  if (!access?.active) throw new Error("บัญชีนี้ถูกระงับหรือยังไม่ได้กำหนดสิทธิ์ กรุณาติดต่อผู้ดูแลระบบ");
  const requested = ROUTE_ROLES[access.role] ? access.role : "monitor";
  state.role = requested;
  state.access = {
    email: access.email || email,
    fullName: access.full_name || access.email || email,
    role: requested,
    companies: Array.isArray(access.companies) ? access.companies.map((value) => String(value).toUpperCase()) : [],
    active: true,
    loaded: !access.migration_pending,
  };
  if (state.filters.company !== "ALL" && !canAccessCompany(state.filters.company)) state.filters.company = "ALL";
  if (state.dailySummary.company && !canAccessCompany(state.dailySummary.company)) state.dailySummary.company = companyMaster()[0]?.code || "";
  $("#signedUser").innerHTML = `${h(state.access.fullName)}<small>${h(DB.roles[state.role].name)}</small>`;
}

async function enterProductionApp() {
  const user = Sb.authUser() || {};
  const email = String(user.email || "").trim().toLowerCase();
  if (!email) {
    Sb.signOut();
    showLoginGate("ไม่พบอีเมลของบัญชี กรุณาเข้าสู่ระบบใหม่");
    return false;
  }
  prepareProductionData();
  try {
    await applyAuthenticatedRole();
  } catch (error) {
    Sb.signOut();
    showLoginGate(error.message || "ไม่สามารถตรวจสอบสิทธิ์ผู้ใช้ได้");
    return false;
  }
  $("#loginGate").hidden = true;
  $("#appShell").hidden = false;
  state.route = parseHash();
  if (!ROUTE_ROLES[state.role].includes(state.route)) state.route = "cloud";
  if (!location.hash || parseHash() !== state.route) location.hash = "#/" + state.route;
  cloudState.batches = null;
  cloudState.daily = null;
  cloudState.operations = null;
  cloudState.key = "";
  cloudState.error = null;
  cloudState.partialError = null;
  liveOverviewState.daily = null;
  liveOverviewState.operations = null;
  liveOverviewState.quality = null;
  liveOverviewState.checklist = null;
  liveOverviewState.settings = null;
  liveOverviewState.damages = null;
  liveOverviewState.logs = null;
  liveOverviewState.notifications = null;
  liveOverviewState.exceptionsReady = false;
  liveOverviewState.damagesReady = false;
  liveOverviewState.logsReady = false;
  liveOverviewState.coreErrors = [];
  liveOverviewState.key = "";
  dailyCompanyState.date = "";
  dailyCompanyState.company = "";
  dailyCompanyState.batches = null;
  dailyCompanyState.quality = null;
  dailyCompanyState.operations = null;
  dailyCompanyState.checklist = null;
  dailyCompanyState.boFirst = null;
  dailyCompanyState.exceptions = null;
  dailyCompanyState.damages = null;
  dailyCompanyState.coreError = null;
  dailyCompanyState.error = null;
  updateBell();
  render();
  loadLiveOverview().catch(() => {});
  return true;
}

async function boot() {
  applyStoredState();
  let authCallback = null;
  try {
    authCallback = await Sb.consumeAuthHash();
  } catch (e) {
    showLoginGate(e.message);
  }
  const restored = authCallback ? false : await Sb.restore();
  $("#loginEmail").value = Sb.cfg().email || "";
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("#loginSubmit");
    const error = $("#loginError");
    button.disabled = true;
    button.textContent = "กำลังเข้าสู่ระบบ...";
    error.hidden = true;
    try {
      await Sb.signIn($("#loginEmail").value.trim(), $("#loginPassword").value);
      await enterProductionApp();
    } catch (e) {
      showLoginGate(e.message || "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      button.disabled = false;
      button.textContent = "เข้าสู่ระบบด้วยรหัสผ่าน";
    }
  });
  $("#googleLogin").addEventListener("click", () => {
    const button = $("#googleLogin");
    button.disabled = true;
    $("#loginError").hidden = true;
    try {
      Sb.signInWithGoogle();
    } catch (e) {
      button.disabled = false;
      showLoginGate(e.message || "เชื่อมต่อ Google ไม่สำเร็จ");
    }
  });
  $("#forgotPassword").addEventListener("click", async () => {
    const email = $("#loginEmail").value.trim();
    const error = $("#loginError");
    error.hidden = true;
    if (!email) {
      showLoginGate("กรุณากรอกอีเมลก่อนขอรหัสผ่านใหม่");
      return;
    }
    try {
      await Sb.requestPasswordReset(email);
      showLoginGate("ส่งลิงก์ตั้งรหัสผ่านใหม่แล้ว กรุณาตรวจ Inbox หรือ Spam");
    } catch (e) {
      showLoginGate(e.message || "ส่งลิงก์ตั้งรหัสผ่านใหม่ไม่สำเร็จ");
    }
  });
  $("#resetForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = $("#newPassword").value;
    const confirm = $("#confirmPassword").value;
    const error = $("#resetError");
    if (password.length < 8 || password !== confirm) {
      error.textContent = password.length < 8 ? "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" : "รหัสผ่านทั้งสองช่องไม่ตรงกัน";
      error.hidden = false;
      return;
    }
    const button = $("#resetSubmit");
    button.disabled = true;
    try {
      await Sb.updatePassword(password);
      Sb.signOut();
      $("#newPassword").value = "";
      $("#confirmPassword").value = "";
      showLoginGate("ตั้งรหัสผ่านใหม่สำเร็จแล้ว กรุณาเข้าสู่ระบบ");
    } catch (e) {
      error.textContent = e.message;
      error.hidden = false;
    } finally {
      button.disabled = false;
    }
  });
  $("#btnBell").addEventListener("click", () => go("notifications"));
  $("#btnExport").addEventListener("click", openExportDialog);
  $("#btnLogout").addEventListener("click", () => {
    Sb.signOut();
    cloudState.batches = null;
    location.hash = "#/cloud";
    showLoginGate();
  });
  $("#autoStatus").addEventListener("click", () => go("cloud"));
  $("#navToggle").addEventListener("click", () => {
    const sb = $("#sidebar");
    if (window.matchMedia("(max-width: 1080px)").matches) {
      sb.classList.toggle("open");
      $("#navToggle").setAttribute("aria-expanded", String(sb.classList.contains("open")));
      return;
    }
    setSidebarCollapsed(!$("#appShell").classList.contains("sidebar-collapsed"));
  });

  if (!window.matchMedia("(max-width: 1080px)").matches) {
    let collapsed = false;
    try { collapsed = localStorage.getItem("audit-sidebar-collapsed") === "1"; } catch (_) {}
    setSidebarCollapsed(collapsed);
  }

  if (authCallback === "recovery") showPasswordResetGate();
  else if (authCallback) await enterProductionApp();
  else if (restored) await enterProductionApp();
  else showLoginGate();
  /* กู้การแมป "บริษัทไหนอยู่ระบบไหน" ที่ผู้ใช้ตั้งไว้ */
  const savedSys = Store.data.companySystems || {};
  Object.entries(savedSys).forEach(([code, sysCode]) => {
    let c = DB.companies.find((x) => x.code === code);
    if (!c) DB.companies.push((c = { code, name: code, type: "main", system: null }));
    c.system = sysCode || null;
  });
  retagTracks();
}
document.addEventListener("DOMContentLoaded", boot);
