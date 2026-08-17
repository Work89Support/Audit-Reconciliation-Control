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
      { id: "dashboard", label: "แดชบอร์ด", icon: "dashboard", title: "แดชบอร์ดตรวจสอบประจำวัน", desc: "ภาพรวมรายการ, ผลจับคู่, exception ตามประเภท/กะ และ SLA ที่ต้องตามวันนี้", filters: true },
      { id: "cloud", label: "คลังไฟล์จากเมล", icon: "cloud", title: "คลังไฟล์จากเมล (n8n + Supabase)", desc: "ไฟล์จากเมล AUDIT 2 ถูก n8n ดึงมาเก็บใน Supabase และ Google Drive ให้อัตโนมัติ — เลือกไฟล์แล้วกดดึงเข้าระบบเพื่อกระทบยอดได้ทันที", filters: true },
      { id: "import", label: "นำเข้าข้อมูล", icon: "import", title: "นำเข้าไฟล์และกระทบยอดอัตโนมัติ", desc: "ดึงไฟล์จาก email กลาง หรืออัปโหลดเอง แล้วระบบจะ parse, ใช้กฎธนาคาร และกระทบยอด 3 จุดให้เองทันทีที่ไฟล์ครบทั้งสองฝั่ง", filters: false },
      { id: "intake", label: "Intake Control", icon: "intake", title: "ตรวจไฟล์ก่อนกระทบยอด", desc: "เช็คว่า STM / BO / ไฟล์แก้ไขมือ / ไฟล์ชี้แจง / PM ครบและถูกบริษัทหรือไม่ ถ้ายังไม่ครบระบบจะรอ ไม่กระทบยอดเงียบ ๆ", filters: true },
      { id: "exceptions", label: "รายการผิดปกติ", icon: "exceptions", title: "Exception Queue", desc: "คิวรายการที่ไม่ผ่าน 3-point match พร้อมหลักฐานย้อนกลับและ workflow ชี้แจง", filters: true },
      { id: "matching", label: "3-Point Match", icon: "matching", title: "ตรวจการจับคู่ 3 จุด", desc: "เทียบ account, time, amount ระหว่าง STM กับ BO ทีละรายการพร้อม tolerance ที่ใช้", filters: true },
    ],
  },
  {
    group: "ตรวจสอบและอนุมัติ",
    items: [
      { id: "clarify", label: "งานชี้แจง", icon: "clarify", title: "งานชี้แจงและกำหนดส่ง", desc: "แผนกตรวจ 2 ระบบ — ระบบ XB ส่งหัวหน้ากะทุกวันภายใน 17:00 ทุกเคส · ระบบ 123 ออดิท 1/2/3 รวบเป็นรอบ 1-15 / 16-25 / 26-สิ้นเดือน ให้เวลาชี้แจง 2-3 วัน", filters: true },
      { id: "approvals", label: "อนุมัติ / ปิดเคส", icon: "approvals", title: "คำขอรออนุมัติ", desc: "รายการที่ชี้แจงแล้วรอ Audit Lead ตรวจทาน อนุมัติ หรือส่งกลับ", filters: false },
      { id: "damage", label: "ทะเบียนความเสียหาย", icon: "damage", title: "Damage Register", desc: "บันทึกความเสียหายรายวัน แยกตามรอบชี้แจง 1-15, 16-25, 26-สิ้นเดือน", filters: true },
      { id: "pm", label: "PM Monitor", icon: "pm", title: "บัญชี PM ระบบ 123", desc: "AUTOPEER / AZPAY / Cyberplus กรองเฉพาะรายการสำเร็จและวันที่ที่ตรวจ", filters: false },
    ],
  },
  {
    group: "รายงาน",
    items: [
      { id: "kpi", label: "KPI & Shift", icon: "kpi", title: "KPI ตามกะและพนักงาน", desc: "ความผิดพลาดตามกะ พนักงาน และบริษัท เพื่อใช้ประเมินและลดความผิดซ้ำ", filters: true },
      { id: "reports", label: "รายงาน & Export", icon: "reports", title: "รายงานรายวัน / รายเดือน", desc: "สรุปผลตรวจ, แนวโน้มความเสียหาย และ export ให้การเงิน / บุคคล", filters: true },
      { id: "talk", label: "Talk to Data", icon: "talk", title: "ถามข้อมูลด้วยภาษาไทย", desc: "ถามจากข้อมูลที่ reconcile แล้ว ทุกคำตอบอ้างอิงตัวเลข ช่วงวันที่ และลิงก์กลับหลักฐาน", filters: false },
    ],
  },
  {
    group: "ระบบ",
    items: [
      { id: "rules", label: "Bank Rules", icon: "rules", title: "กฎธนาคารและ Tolerance", desc: "ปรับกฎรายธนาคารได้โดยไม่ต้องแก้โปรแกรม ทุกการเปลี่ยนถูกบันทึกใน audit log", filters: false },
      { id: "users", label: "ผู้ใช้ & สิทธิ์", icon: "users", title: "ผู้ใช้และสิทธิ์ตามบทบาท", desc: "ตารางสิทธิ์ 5 บทบาท ตั้งแต่ Audit Monitor ถึง System Admin", filters: false },
      { id: "notifications", label: "การแจ้งเตือน", icon: "bell", title: "ศูนย์การแจ้งเตือน", desc: "แจ้งเมื่อไฟล์ขาด พบ exception ระดับสูง เลย SLA หรือใกล้ครบรอบชี้แจง พร้อมตั้งกฎและช่องทางได้", filters: false },
      { id: "schedule", label: "ตั้งเวลา & ความปลอดภัย", icon: "clock", title: "ตารางเวลาและความปลอดภัย", desc: "ตั้งเวลาให้ระบบดึงไฟล์และกระทบยอดเอง, นโยบายเก็บข้อมูลและสำรอง, และทดสอบ performance ระดับ 200,000 รายการ", filters: false },
      { id: "audit-log", label: "Audit Log", icon: "log", title: "บันทึกการใช้งานระบบ", desc: "ทุก note, status, approval, การตั้งค่า ถูกบันทึกพร้อมเวลาและผู้ทำรายการ", filters: true },
      { id: "settings", label: "ตั้งค่าระบบ", icon: "settings", title: "ตั้งค่าการตรวจสอบ", desc: "tolerance, เกณฑ์แจ้งเตือน, SLA และ rule preset ที่บังคับใช้ทั้งระบบ", filters: false },
      { id: "roadmap", label: "สิ่งที่ต้องพัฒนาต่อ", icon: "roadmap", title: "Gap และแผนพัฒนา", desc: "สิ่งที่ Audit ต้องเตรียม และสิ่งที่ระบบต้องทำต่อจาก prototype นี้", filters: false },
    ],
  },
];
const ROUTE_MAP = {};
ROUTES.forEach((g) => g.items.forEach((it) => (ROUTE_MAP[it.id] = it)));

/* หน้าที่แต่ละ role มองเห็น */
const ROUTE_ROLES = {
  monitor: ["dashboard", "import", "intake", "exceptions", "matching", "clarify", "approvals", "damage", "pm", "kpi", "reports", "talk", "rules", "notifications", "audit-log", "roadmap"],
  lead: Object.keys(ROUTE_MAP),
  shift_lead: ["dashboard", "exceptions", "clarify", "approvals", "damage", "talk", "notifications", "roadmap"],
  exec: ["dashboard", "kpi", "reports", "damage", "talk", "notifications", "roadmap"],
  admin: Object.keys(ROUTE_MAP),
};

/* ---------------- state ---------------- */
const state = {
  route: "dashboard",
  role: "lead",
  filters: { date: DB.BUSINESS_DATE, from: DB.BUSINESS_DATE, to: DB.BUSINESS_DATE, preset: "day", company: "ALL", direction: "ALL", shift: "ALL" },
  exFilter: { q: "", type: "ALL", severity: "ALL", status: "ALL", sla: false },
  sort: { key: "time", dir: "asc" },
  page: 1,
  perPage: 12,
  selected: null,
  matchIndex: 0,
  damageCycle: "C1",
  dataset: "demo",
  chat: [],
};

const can = (cap) => DB.roles[state.role].can.includes(cap);

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
const currentUser = () => DB.users.find((u) => u.role === state.role) || DB.users[0];

/* ---------------- audit log + toast ---------------- */
function logAction(action, entity, target, detail) {
  const entry = { at: nowStamp(), user: currentUser().username, action, entity, target, detail };
  DB.auditLog.unshift(entry);
  if (typeof Store !== "undefined") {
    Store.data.auditLog.unshift(entry);
    Store.persist();
  }
}

/* บันทึกสถานะเคสที่ถูกแก้ ให้อยู่รอดข้ามการรีเฟรช */
function saveOverride(e) {
  Store.data.exOverrides[e.id] = {
    status: e.status,
    hasEvidence: e.hasEvidence,
    notes: e.notes,
    evidence: (e.evidence || []).map((f) => ({ name: f.name, size: f.size, at: f.at })),
  };
  Store.persist();
}
function applyStoredState() {
  const ov = Store.data.exOverrides || {};
  DB.exceptions.forEach((e) => {
    const o = ov[e.id];
    if (!o) return;
    e.status = o.status ?? e.status;
    e.hasEvidence = o.hasEvidence ?? e.hasEvidence;
    e.notes = o.notes || e.notes;
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
function filteredExceptions() {
  const f = state.filters;
  const x = state.exFilter;
  return DB.exceptions.filter((e) => {
    if (!inRange(e.date)) return false;
    if (f.company !== "ALL" && e.company !== f.company) return false;
    if (f.direction !== "ALL" && e.direction !== f.direction) return false;
    if (f.shift !== "ALL" && e.shift !== f.shift) return false;
    if (x.type !== "ALL" && e.type !== x.type) return false;
    if (x.severity !== "ALL" && e.severity !== x.severity) return false;
    if (x.status !== "ALL" && e.status !== x.status) return false;
    if (x.sla && !e.overSla) return false;
    if (x.q) {
      const q = x.q.toLowerCase();
      const hay = `${e.id} ${e.account} ${e.employee} ${e.typeName} ${e.cause} ${e.bank}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
function scopedExceptions() {
  const f = state.filters;
  return DB.exceptions.filter(
    (e) =>
      inRange(e.date) &&
      (f.company === "ALL" || e.company === f.company) &&
      (f.direction === "ALL" || e.direction === f.direction) &&
      (f.shift === "ALL" || e.shift === f.shift),
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

/* ---------------- shell rendering ---------------- */
function renderNav() {
  const allowed = ROUTE_ROLES[state.role];
  $("#navList").innerHTML = ROUTES.map((g) => {
    const items = g.items.filter((it) => allowed.includes(it.id));
    if (!items.length) return "";
    return (
      `<span class="nav-label">${h(g.group)}</span>` +
      items
        .map(
          (it) =>
            `<a href="#/${it.id}" class="${state.route === it.id ? "active" : ""}" data-route="${it.id}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[it.icon]}"/></svg><span>${h(it.label)}</span>
              ${it.id === "exceptions" ? `<b class="nav-count">${DB.exceptions.filter((e) => !["closed", "approved"].includes(e.status)).length}</b>` : ""}
              ${it.id === "approvals" ? `<b class="nav-count">${DB.exceptions.filter((e) => e.status === "answered").length}</b>` : ""}
            </a>`,
        )
        .join("")
    );
  }).join("");
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
  box.innerHTML = `
    <label>วันที่ตรวจ
      <input type="date" id="fDate" value="${f.date}" />
    </label>
    <label>ช่วงข้อมูล
      <select id="fPreset">
        ${DATE_PRESETS.map((p) => `<option value="${p.code}" ${f.preset === p.code ? "selected" : ""}>${h(p.name)}</option>`).join("")}
      </select>
    </label>
    <label>ตั้งแต่วันที่
      <input type="date" id="fFrom" value="${f.from}" max="${f.to}" />
    </label>
    <label>ถึงวันที่
      <input type="date" id="fTo" value="${f.to}" min="${f.from}" />
    </label>
    <label>บริษัท
      <select id="fCompany">
        <option value="ALL">ทุกบริษัท</option>
        ${DB.companies.map((c) => `<option value="${c.code}" ${f.company === c.code ? "selected" : ""}>${h(c.name)}</option>`).join("")}
      </select>
    </label>
    <label>ประเภทบัญชี
      <select id="fDirection">
        <option value="ALL">ฝากและถอน</option>
        <option value="ฝาก" ${f.direction === "ฝาก" ? "selected" : ""}>ฝาก</option>
        <option value="ถอน" ${f.direction === "ถอน" ? "selected" : ""}>ถอน</option>
        <option value="PM" ${f.direction === "PM" ? "selected" : ""}>PM</option>
      </select>
    </label>
    <label>กะ
      <select id="fShift">
        <option value="ALL">ทุกกะ</option>
        ${DB.shifts.map((s) => `<option value="${s.code}" ${f.shift === s.code ? "selected" : ""}>${h(s.name)} (${s.range})</option>`).join("")}
      </select>
    </label>
    <div class="filter-summary" id="filterSummary"></div>`;

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
  ["fCompany", "fDirection", "fShift"].forEach((id) => {
    $("#" + id).addEventListener("change", (e) => {
      state.filters[id === "fCompany" ? "company" : id === "fDirection" ? "direction" : "shift"] = e.target.value;
      state.page = 1;
      render();
    });
  });
  const scoped = scopedExceptions();
  $("#filterSummary").innerHTML = `ช่วงข้อมูล <b>${h(rangeLabel())}</b> · กำลังดู <b>${num(scoped.length)}</b> exception · เกิน SLA <b>${num(scoped.filter((e) => e.overSla).length)}</b> รายการ · ความเสียหายในช่วงนี้ <b>${money0(DB.damages.filter((d) => inRange(d.date)).reduce((a, c) => a + c.amount, 0))}</b> บาท`;
}

/* ---------------- router ---------------- */
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "").split("?")[0];
  return ROUTE_MAP[raw] ? raw : "dashboard";
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
    location.hash = "#/dashboard";
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
function render() {
  const route = ROUTE_MAP[state.route];
  Charts.reset();
  $("#crumb").textContent = ROUTES.find((g) => g.items.some((i) => i.id === route.id)).group;
  $("#pageTitle").textContent = route.title;
  $("#pageDesc").innerHTML =
    h(route.desc) +
    (state.dataset === "imported"
      ? ' <span class="badge green">ข้อมูลจากไฟล์ที่นำเข้าจริง</span>'
      : ' <span class="badge grey">ข้อมูลตัวอย่าง</span>');
  renderNav();
  renderFilters();
  $("#viewRoot").innerHTML = "";
  VIEWS[route.id]($("#viewRoot"));
  addPanelCaptureButtons();
  $("#sidebar").classList.remove("open");
}

/* =============================================================
   VIEW: Dashboard
   ============================================================= */
VIEWS.dashboard = (root) => {
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
   VIEW: Intake Control
   ============================================================= */
VIEWS.intake = (root) => {
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
  const list = filteredExceptions();
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

  const th = (key, label) =>
    `<th class="sortable ${state.sort.key === key ? "sorted " + state.sort.dir : ""}" data-sort="${key}">${label}</th>`;

  root.innerHTML = `
    <section class="panel">
      <div class="toolbar">
        <input type="search" id="exSearch" placeholder="ค้นหาเลขเคส บัญชี พนักงาน หรือสาเหตุ..." value="${h(x.q)}" />
        <select id="exType">
          <option value="ALL">ทุกประเภท</option>
          ${allExceptionTypes().map((t) => `<option value="${t.code}" ${x.type === t.code ? "selected" : ""}>${h(t.name)}</option>`).join("")}
        </select>
        <select id="exSeverity">
          <option value="ALL">ทุกระดับ</option>
          ${DB.severities.map((s) => `<option value="${s.code}" ${x.severity === s.code ? "selected" : ""}>${h(s.name)}</option>`).join("")}
        </select>
        <select id="exStatus">
          <option value="ALL">ทุกสถานะ</option>
          ${DB.statuses.map((s) => `<option value="${s.code}" ${x.status === s.code ? "selected" : ""}>${h(s.name)}</option>`).join("")}
        </select>
        <label class="chk"><input type="checkbox" id="exSla" ${x.sla ? "checked" : ""} /> เฉพาะที่เลย SLA</label>
        <button class="ghost-button sm" id="exReset">ล้างตัวกรอง</button>
      </div>

      <div class="result-line">
        พบ <b>${num(sorted.length)}</b> รายการ · ยอดที่ต้องตรวจรวม <b>${money0(sumRisk(sorted))}</b> บาท
        · เกิน SLA <b class="danger">${num(sorted.filter((e) => e.overSla).length)}</b>
      </div>

      <div class="table-wrap">
        <table class="rows">
          <thead><tr>
            ${th("id", "เคส")}${th("time", "เวลา")}<th>บัญชี</th>${th("typeName", "ประเภท")}
            <th class="right">ยอด BO</th><th class="right">ยอด STM</th>${th("riskAmount", "ผลต่าง / ยอดที่ต้องตรวจ")}
            ${th("severity", "ระดับ")}<th>ผู้เกี่ยวข้อง</th>${th("status", "สถานะ")}
          </tr></thead>
          <tbody>
            ${
              rows
                .map(
                  (e) => `<tr class="clickable ${e.overSla ? "over-sla" : ""}" data-ex="${e.id}">
              <td><b>${e.id}</b>${e.overSla ? '<span class="sla-flag" title="เกิน SLA">!</span>' : ""}</td>
              <td class="tnum">${e.time}</td>
              <td>${h(e.account)}<small class="sub">${h(e.direction)}</small></td>
              <td>${h(e.typeName)}</td>
              <td class="right tnum">${e.systemAmount === null ? '<span class="muted">—</span>' : money(e.systemAmount)}</td>
              <td class="right tnum">${e.bankAmount === null ? '<span class="muted">—</span>' : money(e.bankAmount)}</td>
              <td class="right tnum">${diffLabel(e)}${e.riskAmount ? `<small class="sub">ตรวจ ${money(e.riskAmount)}</small>` : ""}</td>
              <td><span class="badge ${e.severity}">${h(sevMeta(e.severity).name)}</span></td>
              <td>${h(e.employee)}<small class="sub">${h(DB.shifts.find((s) => s.code === e.shift).name)}</small></td>
              <td><span class="badge ${statusMeta(e.status).tone}">${h(statusMeta(e.status).name)}</span></td>
            </tr>`,
                )
                .join("") || `<tr><td colspan="10" class="empty">ไม่พบรายการตามตัวกรอง</td></tr>`
            }
          </tbody>
        </table>
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
    state.exFilter = { q: "", type: "ALL", severity: "ALL", status: "ALL", sla: false };
    rerender();
  });
  $("#pgPrev").addEventListener("click", () => ((state.page = Math.max(1, state.page - 1)), render()));
  $("#pgNext").addEventListener("click", () => ((state.page = Math.min(pages, state.page + 1)), render()));
  $("#exExport").addEventListener("click", () => exportSheets("รายการผิดปกติ", [SHEET_BUILDERS.exceptions.build()]));
  root.querySelectorAll("th[data-sort]").forEach((thEl) =>
    thEl.addEventListener("click", () => {
      const k = thEl.dataset.sort;
      state.sort = { key: k, dir: state.sort.key === k && state.sort.dir === "asc" ? "desc" : "asc" };
      render();
    }),
  );
  root.querySelectorAll("tr[data-ex]").forEach((tr) => tr.addEventListener("click", () => openException(tr.dataset.ex)));
};

/* =============================================================
   Drawer: Exception detail + evidence timeline + close checklist
   ============================================================= */
function openException(id) {
  const e = DB.exceptions.find((x) => x.id === id);
  if (!e) return;
  state.selected = id;
  const drawer = $("#drawer");
  const overlay = $("#drawerOverlay");
  const checklist = [
    { key: "raw", label: "มี Raw STM และ BO row", ok: true },
    { key: "cause", label: "ระบุสาเหตุแล้ว", ok: !!e.cause },
    { key: "owner", label: "ระบุผู้รับผิดชอบแล้ว", ok: !!e.employee },
    { key: "evidence", label: "แนบหลักฐาน / ไฟล์ชี้แจง", ok: e.hasEvidence },
    { key: "note", label: "มี note จาก Audit", ok: e.notes.length > 0 },
    { key: "amount", label: "ระบุยอดเสียหายหรือยืนยันว่าไม่มี", ok: e.status === "damage" || e.status === "approved" || e.status === "closed" },
  ];
  const ready = checklist.every((c) => c.ok);

  drawer.innerHTML = `
    <header class="drawer-head">
      <div>
        <p class="eyebrow">${h(e.typeName)} · ${h(e.company)}</p>
        <h2 id="drawerTitle">${e.id} <span class="badge ${e.severity}">${h(sevMeta(e.severity).name)}</span> <span class="badge ${statusMeta(e.status).tone}">${h(statusMeta(e.status).name)}</span></h2>
      </div>
      <button class="icon-btn" id="drawerClose" aria-label="ปิด">✕</button>
    </header>

    <div class="drawer-body">
      <div class="kv-grid">
        <div><span>วันที่ / เวลา</span><b>${e.date} ${e.time}</b></div>
        <div><span>บัญชี</span><b>${h(e.account)} (${h(e.bank)})</b></div>
        <div><span>ทิศทาง</span><b>${h(e.direction)}</b></div>
        <div><span>กะ</span><b>${h(DB.shifts.find((s) => s.code === e.shift).name)}</b></div>
        <div><span>ยอดระบบ (BO)</span><b>${e.systemAmount === null ? "ไม่พบรายการ" : money(e.systemAmount)}</b></div>
        <div><span>ยอดธนาคาร (STM)</span><b>${e.bankAmount === null ? "ไม่พบรายการ" : money(e.bankAmount)}</b></div>
        <div><span>ผลต่าง</span><b>${diffLabel(e)}</b></div>
        <div><span>ยอดที่ต้องตรวจ</span><b class="danger">${e.riskAmount ? money(e.riskAmount) : "ไม่กระทบยอดเงิน"}</b></div>
        <div><span>ผลต่างเวลา</span><b>${e.timeDiffSec} วินาที</b></div>
        <div><span>พนักงานที่ทำรายการ</span><b>${h(e.employee)}</b></div>
        <div><span>SLA</span><b class="${e.overSla ? "danger" : ""}">${e.ageHours} ชม. / เกณฑ์ ${e.slaHours} ชม.</b></div>
        <div><span>ระบบต้นทาง / สายชี้แจง</span><b>${h(trackMeta(e.track).short)}${e.systemUnassigned ? " (ยังไม่กำหนดระบบ)" : ""}</b></div>
        <div><span>กำหนดส่งคืน</span><b class="${e.overSla ? "danger" : ""}">${h(dueOf(e).short)}</b></div>
      </div>
      <p class="hint" style="margin-top:8px">${h(dueOf(e).detail)}</p>
      ${e.detail ? `<div class="rule-detail"><b>สิ่งที่ระบบตรวจพบ</b><p>${h(e.detail)}</p>${e.member ? `<small>สมาชิก ${h(e.member)}${e.memberNick ? " (" + h(e.memberNick) + ")" : ""}</small>` : ""}</div>` : ""}

      <h3 class="drawer-h3">Evidence Timeline</h3>
      <ol class="timeline">
        <li><span class="t-dot"></span><div><b>Raw STM</b><code>${h(e.stmRaw)}</code></div></li>
        <li><span class="t-dot"></span><div><b>Raw BO</b><code>${h(e.boRaw)}</code></div></li>
        <li><span class="t-dot"></span><div><b>ผลการจับคู่</b><span>${
          e.ruleBased
            ? `ตรวจด้วยกฎธุรกิจจากรายงานหลังบ้าน (ไม่ต้องใช้ statement): ${h(e.typeName)}`
            : `ไม่ผ่านเกณฑ์: ${h(e.typeName)} — tolerance ที่ใช้ ${e.direction === "ถอน" ? DB.settings.toleranceWithdraw : DB.settings.toleranceDeposit} วินาที`
        }</span></div></li>
        <li><span class="t-dot"></span><div><b>สาเหตุที่บันทึกไว้</b><span>${h(e.cause)}</span></div></li>
        ${e.hasEvidence ? `<li><span class="t-dot ok"></span><div><b>หลักฐานแนบ</b><span>สลิป / ไฟล์ชี้แจงจากหัวหน้ากะ (2 ไฟล์)</span></div></li>` : `<li><span class="t-dot bad"></span><div><b>หลักฐาน</b><span class="danger">ยังไม่มีหลักฐานแนบ</span></div></li>`}
        ${e.notes.map((n) => `<li><span class="t-dot"></span><div><b>Note โดย ${h(n.by)} · ${h(n.at)}</b><span>${h(n.text)}</span></div></li>`).join("")}
      </ol>

      <h3 class="drawer-h3">Close Checklist</h3>
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

    <footer class="drawer-foot">
      <button class="ghost-button" id="btnDocReq">ใบขอให้ชี้แจง (PDF)</button>
      <button class="ghost-button" id="btnDocClr">เอกสารชี้แจง (PDF)</button>
      <button class="ghost-button" id="btnClarify">ส่งให้หัวหน้ากะชี้แจง</button>
      <button class="ghost-button" id="btnRespond">ตอบชี้แจง + แนบหลักฐาน</button>
      <button class="ghost-button" id="btnDamage">บันทึกเป็นความเสียหาย</button>
      <button class="primary-button" id="btnApprove">อนุมัติและปิดเคส</button>
    </footer>`;

  drawer.hidden = false;
  overlay.hidden = false;
  requestAnimationFrame(() => drawer.classList.add("on"));

  $("#drawerClose").addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer, { once: true });

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
    logAction("request_clarify", "exception", e.id, "ส่งให้หัวหน้ากะ " + e.shift + " ชี้แจง");
    saveOverride(e);
    toast("ส่งให้หัวหน้ากะชี้แจงแล้ว");
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
  $("#btnDamage").addEventListener("click", () => {
    if (!can("close_case")) return deny("บันทึกความเสียหาย");
    if (!e.hasEvidence) return toast("ต้องมีหลักฐานก่อนบันทึกเป็นความเสียหาย", "warn");
    if (e.status !== "damage") {
      e.status = "damage";
      DB.damages.push({
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
      });
      logAction("damage", "damage_record", e.id, "บันทึกความเสียหาย " + money(e.riskAmount || Math.abs(e.amountDiff)) + " บาท");
      Store.data.extraDamages.push(DB.damages[DB.damages.length - 1]);
      saveOverride(e);
      toast("บันทึกเข้าทะเบียนความเสียหายแล้ว");
    }
    openException(id);
  });
  $("#btnApprove").addEventListener("click", () => {
    if (!can("approve")) return deny("อนุมัติ/ปิดเคส");
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
  const list = scopedExceptions().filter((e) => e.type !== "missing_stm");
  if (!list.length) {
    root.innerHTML = `<div class="panel"><p class="empty">ไม่มีรายการให้ตรวจในตัวกรองนี้</p></div>`;
    return;
  }
  state.matchIndex = Math.min(state.matchIndex, list.length - 1);
  const e = list[state.matchIndex];
  const tol = e.direction === "ถอน" ? DB.settings.toleranceWithdraw : DB.settings.toleranceDeposit;
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
          <div class="kv-line"><span>กฎที่ใช้</span><b>${h(DB.banks.find((b) => b.code === e.bank).rule)}</b></div>
        </div>
        <div class="compare-mid"><span>เทียบกับ</span></div>
        <div class="compare-col">
          <h3>ฝั่งระบบหลังบ้าน (BO)</h3>
          <code>${h(e.boRaw)}</code>
          <div class="kv-line"><span>เวลา</span><b>${e.systemAmount === null ? "-" : e.boTime}</b></div>
          <div class="kv-line"><span>ยอด</span><b>${e.systemAmount === null ? "ไม่พบรายการ" : money(e.systemAmount)}</b></div>
          <div class="kv-line"><span>ผู้ทำรายการ</span><b>${h(e.employee)}</b></div>
        </div>
      </div>
    </section>

    <section class="grid-2">
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Tolerance</p><h2>ปรับเกณฑ์จับคู่</h2></div><span class="health ${can("rules") ? "ok" : "attention"}">${can("rules") ? "แก้ไขได้" : "อ่านอย่างเดียว"}</span></div>
        <div class="setting-list">
          <label><span>Time tolerance ฝาก</span><input type="number" id="tolD" value="${DB.settings.toleranceDeposit}" ${can("rules") ? "" : "disabled"} /><b>วินาที</b></label>
          <label><span>Time tolerance ถอน</span><input type="number" id="tolW" value="${DB.settings.toleranceWithdraw}" ${can("rules") ? "" : "disabled"} /><b>วินาที</b></label>
          <label><span>ยอด Diff ที่ต้องแจ้งเตือน</span><input type="number" id="tolA" value="${DB.settings.diffAlert}" ${can("rules") ? "" : "disabled"} /><b>บาท</b></label>
        </div>
        <button class="primary-button" id="tolSave" ${can("rules") ? "" : "disabled"}>บันทึกและคำนวณผลใหม่</button>
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
          <li>ผ่าน threshold = matched, ไม่ผ่าน = exception</li>
          <li>ส่ง exception เข้า workflow ชี้แจง</li>
        </ol>
      </div>
    </section>`;

  $("#mPrev").addEventListener("click", () => ((state.matchIndex = Math.max(0, state.matchIndex - 1)), render()));
  $("#mNext").addEventListener("click", () => ((state.matchIndex = Math.min(list.length - 1, state.matchIndex + 1)), render()));
  $("#mOpen").addEventListener("click", () => openException(e.id));
  $("#tolSave").addEventListener("click", () => {
    if (!can("rules")) return deny("แก้ tolerance");
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
  const queue = DB.exceptions.filter((e) => ["answered", "clarifying", "damage"].includes(e.status));
  root.innerHTML = `
    <section class="status-strip four">
      <article><span>รอชี้แจง</span><strong>${num(DB.exceptions.filter((e) => e.status === "clarifying").length)}</strong><small>ส่งให้หัวหน้ากะแล้ว</small></article>
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

VIEWS.damage = (root) => {
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

/* =============================================================
   VIEW: PM Monitor
   ============================================================= */
VIEWS.pm = (root) => {
  const pmEx = DB.exceptions.filter((e) => e.direction === "PM");
  root.innerHTML = `
    <section class="grid-3">
      ${DB.pmAccounts
        .map((p) => {
          const cnt = pmEx.filter((e) => e.company === p.company).length;
          return `<article class="panel pm-card">
          <p class="eyebrow">PM Account</p>
          <h2>${h(p.company)}</h2>
          <div class="pm-rate"><strong>${p.match}%</strong><span>อัตราจับคู่สำเร็จ</span></div>
          <p class="pm-note">${h(p.note)}</p>
          <div class="pm-foot"><span>Exception วันนี้</span><b>${cnt}</b></div>
          <button class="ghost-button sm" data-pm="${p.company}">ดูรายการ</button>
        </article>`;
        })
        .join("")}
    </section>

    <section class="grid-2">
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Match Rate</p><h2>เทียบ 3 บริษัท PM</h2></div></div>
        <div class="chart" id="chPm"></div>
        <p class="chart-note">Cyberplus ต่ำที่สุดเพราะยอดถอนต้องรอไฟล์ชี้แจงประจำวัน ควรเร่ง SLA การส่งไฟล์เป็นก่อน 09:00</p>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">กฎเฉพาะ PM</p><h2>สิ่งที่ต้องกรองก่อนจับคู่</h2></div></div>
        <ul class="tick-list">
          <li>กรองเฉพาะรายการที่สถานะ <b>สำเร็จ</b> เท่านั้น</li>
          <li>กรองวันที่ให้ตรงกับวันที่ตรวจ (STM PM มักมีวันอื่นปนมา)</li>
          <li>AZPAY ฝากและถอนอยู่บัญชีเดียว ต้องแยก direction จาก marker</li>
          <li>ยอดโอนออกต้องตรวจว่าปลายทางเป็นบัญชีบริษัทหรือไม่</li>
          <li>รายการ 23:00-23:59 ตรวจร่วมกับไฟล์วันถัดไป</li>
        </ul>
      </div>
    </section>`;

  Charts.draw("#chPm", "bars", {
    label: "อัตราจับคู่สำเร็จของบัญชี PM",
    items: DB.pmAccounts.map((p) => ({ label: p.company, value: p.match, hint: p.note })),
    color: Charts.PALETTE.s3,
    metric: "อัตราจับคู่",
    unit: "%",
    height: 230,
  });
  root.querySelectorAll("[data-pm]").forEach((b) =>
    b.addEventListener("click", () => go("exceptions", { filters: { company: b.dataset.pm, direction: "ALL" }, exFilter: { q: "", type: "ALL", severity: "ALL", status: "ALL", sla: false } })),
  );
};

/* =============================================================
   VIEW: KPI
   ============================================================= */
VIEWS.kpi = (root) => {
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
  const byCompany = DB.companies.map((c) => ({ label: c.name, value: ex.filter((e) => e.company === c.code).length })).filter((x) => x.value);

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
VIEWS.reports = (root) => {
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
  "ยอดผิดปกติกะดึกมีเท่าไหร่",
  "สาเหตุหลักวันนี้คืออะไร",
  "ไฟล์ไหนยังไม่ได้ส่ง",
  "ความเสียหายเดือนนี้เท่าไหร่",
  "เคสไหนเลย SLA บ้าง",
  "บัญชีไหนเกิด diff บ่อยที่สุด",
];

function answerQuestion(q) {
  const t = q.toLowerCase();
  const ex = DB.exceptions;
  const has = (...w) => w.some((x) => t.includes(x));

  if (has("กะดึก", "กะ ดึก", "night")) {
    const n = ex.filter((e) => e.shift === "night");
    return {
      text: `กะดึก (00:00-08:00) ของวันที่ ${DB.BUSINESS_DATE} พบ exception ${n.length} รายการ คิดเป็น ${((n.length / ex.length) * 100).toFixed(1)}% ของทั้งวัน ยอดที่ต้องตรวจรวม ${money0(sumRisk(n))} บาท โดยเป็นระดับ Critical ${n.filter((e) => e.severity === "critical").length} รายการ`,
      link: { label: "ดูรายการกะดึกทั้งหมด", route: "exceptions", filters: { shift: "night" } },
    };
  }
  if (has("สาเหตุ", "cause", "ทำไม")) {
    const agg = Object.entries(ex.reduce((a, e) => ((a[e.cause] = (a[e.cause] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
    return {
      text: `สาเหตุอันดับต้นของวันที่ ${DB.BUSINESS_DATE} คือ "${agg[0][0]}" ${agg[0][1]} เคส รองลงมา "${agg[1][0]}" ${agg[1][1]} เคส และ "${agg[2][0]}" ${agg[2][1]} เคส`,
      link: { label: "ดูรายการทั้งหมด", route: "exceptions" },
    };
  }
  if (has("ไฟล์", "file", "stm", "bo ")) {
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
    const tot = DB.hourly.reduce((a, c) => a + c.total, 0);
    const m = DB.hourly.reduce((a, c) => a + c.matched, 0);
    return {
      text: `วันที่ ${DB.BUSINESS_DATE} มีรายการทั้งหมด ${num(tot)} จับคู่สำเร็จ ${num(m)} คิดเป็น ${((m / tot) * 100).toFixed(2)}% เหลือ exception ${num(tot - m)} รายการที่ต้องตรวจ`,
      link: { label: "เปิดแดชบอร์ด", route: "dashboard" },
    };
  }
  return {
    text: `ยังไม่มีข้อมูลตรงกับคำถามนี้ ลองถามเกี่ยวกับ: กะ, สาเหตุ, ไฟล์ที่ขาด, ความเสียหาย, SLA, บัญชีที่เกิด diff บ่อย หรืออัตราจับคู่ของวันที่ ${DB.BUSINESS_DATE}`,
    link: null,
  };
}

VIEWS.talk = (root) => {
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
              : `<div class="message system">ลองถามว่า "ยอดผิดปกติกะดึกมีเท่าไหร่" หรือ "ไฟล์ไหนยังไม่ได้ส่ง" — ทุกคำตอบจะอ้างอิงตัวเลขจริงจากข้อมูลที่ผ่านการตรวจสอบ พร้อมลิงก์กลับไปยังหลักฐาน</div>`
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
          <li>ยอด exception แยกตามกะ / บริษัท / บัญชี</li>
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
  const editable = can("rules");
  root.innerHTML = `
    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Rule Engine</p><h2>กฎรายธนาคาร</h2></div>
        <span class="health ${editable ? "ok" : "attention"}">${editable ? "แก้ไขได้โดยไม่ต้องแก้โปรแกรม" : "อ่านอย่างเดียว"}</span>
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
VIEWS.users = (root) => {
  const caps = [
    ["view", "ดูข้อมูล / dashboard"],
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
  root.innerHTML = `
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
          <thead><tr><th>Username</th><th>ชื่อ</th><th>บทบาท</th><th>กะ</th><th>คำอธิบายสิทธิ์</th></tr></thead>
          <tbody>
            ${DB.users
              .map(
                (u) => `<tr><td class="mono">${h(u.username)}</td><td>${h(u.name)}</td>
              <td><span class="badge blue">${h(DB.roles[u.role].name)}</span></td>
              <td>${h(DB.shifts.find((s) => s.code === u.shift).name)}</td>
              <td class="muted">${h(DB.roles[u.role].desc)}</td></tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>`;
};

/* =============================================================
   VIEW: Audit log
   ============================================================= */
VIEWS["audit-log"] = (root) => {
  const logs = DB.auditLog.filter((l) => inRange(String(l.at).slice(0, 10)));
  root.innerHTML = `
    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Audit Log</p><h2>บันทึกทุกการเปลี่ยนแปลง (${logs.length} จาก ${DB.auditLog.length} รายการ)</h2><small class="head-sub">ช่วงข้อมูล ${h(rangeLabel())}</small></div>
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
              .join("")}
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
const cloudState = { batches: null, daily: null, loading: false, error: null, picked: {}, busy: "" };

async function cloudLoad() {
  cloudState.loading = true;
  cloudState.error = null;
  render();
  try {
    const to = state.filters.to || DB.BUSINESS_DATE;
    const from = state.filters.from || to;
    const [b, d] = await Promise.all([Sb.batches({ from, to, company: state.filters.company }), Sb.dailyStatus(30)]);
    cloudState.batches = b;
    cloudState.daily = d;
  } catch (e) {
    cloudState.error = e.message;
  }
  cloudState.loading = false;
  render();
}

/* โหลดไฟล์จาก Storage แล้วส่งเข้าตัวอ่านเดิม */
async function cloudImport(files) {
  if (!files.length) return toast("ยังไม่ได้เลือกไฟล์", "warn");
  showProgress("กำลังดึงไฟล์จากคลังและอ่านเข้าระบบ");
  let ok = 0;
  const failed = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    setProgress((i + 1) / files.length, f.file_name);
    try {
      const buf = await Sb.download(f.storage_path);
      const norm = await ingestRaw(f.file_name, buf, buf.byteLength);
      const n = norm.records.length + (norm.aux || []).length;
      ok++;
      Sb.markParsed(f.id, n, null).catch(() => {});
    } catch (e) {
      failed.push(`${f.file_name}: ${e.message}`);
      Sb.markParsed(f.id, null, e.message).catch(() => {});
    }
  }
  hideProgress();
  logAction("cloud_import", "source_file", `${ok} ไฟล์`, `ดึงจากคลัง Supabase ${ok} ไฟล์${failed.length ? ` · ผิดพลาด ${failed.length}` : ""}`);
  toast(`อ่านเข้าระบบแล้ว ${ok} ไฟล์${failed.length ? ` · ไม่สำเร็จ ${failed.length}` : ""}`);
  if (failed.length) console.warn(failed);
  cloudState.picked = {};
  await runReconcileFromImport({ reason: "ดึงจากคลังไฟล์" });
}

VIEWS.cloud = (root) => {
  const c = Sb.cfg();
  const ready = Sb.configured();
  const inSession = Sb.signedIn();

  if (!ready || !inSession) {
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

  if (cloudState.batches === null && !cloudState.loading) {
    cloudLoad();
  }

  const batches = cloudState.batches || [];
  const allFiles = batches.flatMap((b) => (b.source_files || []).map((f) => ({ ...f, business_date: b.business_date, company: b.company })));
  const readable = allFiles.filter((f) => /\.(xlsx|xlsm|xls|csv|txt|pdf)$/i.test(f.file_name) && f.kind !== "doc_clarify");
  const pickedFiles = readable.filter((f) => cloudState.picked[f.id]);
  const daily = cloudState.daily || [];

  root.innerHTML = `
    <section class="status-strip four">
      <article class="ok"><span>เมลที่ดึงเข้ามาแล้ว</span><strong>${num(batches.length)}</strong><small>ช่วง ${h(rangeLabel())}</small></article>
      <article><span>ไฟล์ในคลัง</span><strong>${num(allFiles.length)}</strong><small>อ่านเข้าระบบได้ ${num(readable.length)} ไฟล์</small></article>
      <article class="${allFiles.filter((f) => f.parsed).length ? "ok" : ""}"><span>อ่านเข้าระบบแล้ว</span><strong>${num(allFiles.filter((f) => f.parsed).length)}</strong><small>เหลือ ${num(readable.filter((f) => !f.parsed).length)} ไฟล์</small></article>
      <article class="${allFiles.some((f) => f.parse_error) ? "danger" : ""}"><span>อ่านไม่สำเร็จ</span><strong>${num(allFiles.filter((f) => f.parse_error).length)}</strong><small>${allFiles.some((f) => f.parse_error) ? "ดูสาเหตุในตาราง" : "ไม่มีปัญหา"}</small></article>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Cloud Inbox</p><h2>ไฟล์จากเมล AUDIT 2</h2><small class="head-sub">ล็อกอินเป็น ${h(Sb.currentEmail())} · ${cloudState.error ? "โหลดข้อมูลไม่สำเร็จ" : "อัปเดตล่าสุด " + (c.lastSync ? String(c.lastSync).replace("T", " ").slice(0, 19) : "-")}</small></div>
        <div class="inline-actions">
          <button class="ghost-button sm" id="cReload" ${cloudState.loading ? "disabled" : ""}>${cloudState.loading ? "กำลังโหลด..." : "รีเฟรช"}</button>
          <button class="ghost-button sm" id="cPickNew">เลือกที่ยังไม่ได้อ่าน</button>
          <button class="primary-button sm" id="cImport" ${pickedFiles.length ? "" : "disabled"}>ดึงเข้าระบบ ${pickedFiles.length ? `(${pickedFiles.length})` : ""}</button>
          <button class="ghost-button sm" id="cLogout">ออกจากระบบคลัง</button>
        </div>
      </div>
      ${cloudState.error ? `<p class="hint danger">${h(cloudState.error)}</p>` : ""}
      ${
        batches.length
          ? batches
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
                  return `<tr class="${f.parse_error ? "bad" : ""}">
                  <td>${canRead ? `<input type="checkbox" data-pick="${h(f.id)}" ${cloudState.picked[f.id] ? "checked" : ""} />` : ""}</td>
                  <td><b>${h(f.file_name)}</b>${f.from_zip ? `<small class="sub">จาก ${h(f.from_zip)}</small>` : ""}</td>
                  <td>${h(KIND_LABEL[f.kind] || f.kind || "-")}</td>
                  <td class="right tnum">${f.size_bytes ? Math.round(f.size_bytes / 1024).toLocaleString() + " KB" : "-"}</td>
                  <td>${
                    f.parse_error
                      ? `<span class="badge red" title="${h(f.parse_error)}">อ่านไม่ได้</span>`
                      : f.parsed
                        ? `<span class="badge green">อ่านแล้ว${f.row_count ? " " + num(f.row_count) + " แถว" : ""}</span>`
                        : `<span class="badge grey">ยังไม่อ่าน</span>`
                  }</td>
                  <td class="right">${f.drive_url ? `<a class="link-btn" href="${h(f.drive_url)}" target="_blank" rel="noopener">Drive</a>` : ""} <button class="link-btn" data-open="${h(f.storage_path)}">เปิดไฟล์</button></td>
                </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>`,
              )
              .join("")
          : `<p class="empty-box">${cloudState.loading ? "กำลังโหลด..." : "ยังไม่มีเมลในช่วงวันที่นี้ — ลองขยายช่วงวันที่ในแถบตัวกรองด้านบน หรือตรวจว่า workflow ใน n8n รันแล้ว"}</p>`
      }
    </section>

    ${
      daily.length
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

  $("#cReload").addEventListener("click", cloudLoad);
  $("#cLogout").addEventListener("click", () => {
    Sb.signOut();
    cloudState.batches = null;
    toast("ออกจากระบบคลังไฟล์แล้ว");
    render();
  });
  $("#cPickNew").addEventListener("click", () => {
    readable.filter((f) => !f.parsed).forEach((f) => (cloudState.picked[f.id] = true));
    render();
  });
  $("#cImport").addEventListener("click", () => cloudImport(pickedFiles));
  root.querySelectorAll("[data-pick]").forEach((cb) =>
    cb.addEventListener("change", () => {
      cloudState.picked[cb.dataset.pick] = cb.checked;
      render();
    }),
  );
  root.querySelectorAll("[data-open]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        const url = await Sb.signedUrl(b.dataset.open, 300);
        window.open(url, "_blank", "noopener");
      } catch (e) {
        toast(e.message, "warn");
      }
    }),
  );
};

const KIND_LABEL = {
  bo_main: "รายงานบัญชีฝาก-ถอน",
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

async function ingestRaw(name, text, size) {
  let rows = [];
  let norm;
  if (/\.pdf$/i.test(name)) {
    /* statement ธนาคารเป็น PDF — ใช้ตัวอ่านเฉพาะ */
    norm = await PdfStm.parse(name, text, state.filters.date);
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
    norm = Engine.normalize(name, rows, DB.settings, state.filters.date);
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

  ImportState.files = ImportState.files.filter((f) => f.name !== name);
  ImportState.files.push({
    name,
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
    const norm = Engine.normalize(f.name, f.rows, DB.settings, state.filters.date);
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

  hideProgress();
  ImportState.running = false;
  applyRunResult(result, stm, bo);
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
  const n = Store.unread();
  const b = $("#bellCount");
  if (!b) return;
  b.textContent = n > 99 ? "99+" : n;
  b.hidden = n === 0;
}

VIEWS.notifications = (root) => {
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
        <p class="hint">ไม่ต้องกดสั่งกระทบยอดเอง ระบบทำให้ทุกครั้งที่ไฟล์เข้าครบหรือถึงเวลาตามตาราง · ตัวตั้งเวลานี้ทำงานขณะเปิดหน้าเว็บไว้ ในระบบจริงจะย้ายไปเป็น cron หรือ job queue ฝั่ง server</p>
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
  retagTracks();
  const all = scopedExceptions().filter((e) => !["closed", "approved"].includes(e.status));
  const daily = all.filter((e) => e.track === "daily");
  const cyc = all.filter((e) => e.track === "cycle");
  const c = DB.settings.clarify;
  const XB = sysMeta("XB");
  const S123 = sysMeta("SYS123");
  const known = [...new Set(DB.companies.map((x) => x.code).concat(all.map((e) => e.company)))].filter((x) => x && x !== "-");
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
  m.classList.remove("on");
  $("#modalOverlay").hidden = true;
  setTimeout(() => (m.hidden = true), 200);
}

/* ตัวสร้างชุดข้อมูลแต่ละชีต ตามช่วงวันที่ปัจจุบัน */
const SHEET_BUILDERS = {
  exceptions: {
    label: "รายการผิดปกติ (Exception)",
    build: () => {
      const rows = filteredExceptions();
      return {
        name: "Exception",
        title: "รายการผิดปกติ",
        headers: ["เคส", "วันที่", "เวลา", "บริษัท", "บัญชี", "ธนาคาร", "ทิศทาง", "ประเภท", "ยอด BO", "ยอด STM", "ผลต่างยอด", "ยอดที่ต้องตรวจ", "ผลต่างเวลา (วิ)", "ระดับ", "สถานะ", "พนักงาน", "กะ", "สมาชิก", "สายชี้แจง", "กำหนดส่ง", "อายุเคส (ชม.)", "SLA (ชม.)", "เกิน SLA", "สาเหตุ", "สิ่งที่ระบบตรวจพบ"],
        widths: [11, 12, 10, 12, 13, 9, 8, 22, 13, 13, 13, 15, 13, 10, 14, 17, 10, 14, 12, 14, 12, 10, 10, 34, 70],
        rows: rows.map((e) => [
          e.id, e.date, e.time, e.company, e.account, e.bank, e.direction, e.typeName,
          e.systemAmount ?? "", e.bankAmount ?? "", e.amountDiff, e.riskAmount, e.timeDiffSec,
          sevMeta(e.severity).name, statusMeta(e.status).name, e.employee,
          (DB.shifts.find((sh) => sh.code === e.shift) || {}).name || e.shift,
          e.member || "", trackMeta(e.track).short, dueOf(e).short,
          e.ageHours, e.slaHours, e.overSla ? "เกิน" : "ปกติ", e.cause, e.detail || "",
        ]),
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
        headers: ["พนักงาน", "กะ", "เคสทั้งหมด", "Critical", "High", "เกิน SLA", "ยอดที่ต้องตรวจ", "ระดับความเสี่ยง"],
        widths: [18, 12, 12, 10, 10, 10, 16, 14],
        rows: DB.employees.map((emp) => {
          const r = ex.filter((e) => e.employee === emp.username);
          const crit = r.filter((e) => e.severity === "critical").length;
          const sla = r.filter((e) => e.overSla).length;
          return [emp.username, (DB.shifts.find((sh) => sh.code === emp.shift) || {}).name || emp.shift, r.length, crit, r.filter((e) => e.severity === "high").length, sla, sumRisk(r), crit >= 4 || sla >= 5 ? "สูง" : crit >= 2 ? "กลาง" : "ต่ำ"];
        }),
      };
    },
  },
  daily: {
    label: "สรุปรายชั่วโมง",
    build: () => ({
      name: "รายชั่วโมง",
      title: "สรุปรายการต่อชั่วโมง",
      headers: ["ชั่วโมง", "รายการทั้งหมด", "จับคู่สำเร็จ", "Exception", "อัตราจับคู่ (%)"],
      widths: [10, 16, 14, 12, 15],
      rows: DB.hourly.map((x) => [x.label, x.total, x.matched, x.exception, x.total ? +((x.matched / x.total) * 100).toFixed(2) : 0]),
    }),
  },
  monthly: {
    label: "แนวโน้มรายเดือน",
    build: () => {
      const t = DB.monthlyTrend.filter((m) => m.ym >= state.filters.from.slice(0, 7) && m.ym <= state.filters.to.slice(0, 7));
      const use = t.length ? t : DB.monthlyTrend;
      return {
        name: "แนวโน้มรายเดือน",
        title: "แนวโน้มความเสียหายรายเดือน",
        headers: ["เดือน", "รหัสเดือน", "ความเสียหาย", "มูลค่าที่ป้องกันได้", "จำนวนเคส"],
        widths: [12, 12, 16, 20, 12],
        rows: use.map((m) => [m.month, m.ym, m.damage, m.prevented, m.cases]),
      };
    },
  },
  intake: {
    label: "สถานะไฟล์ที่รับ",
    build: () => ({
      name: "ไฟล์ที่รับ",
      title: "สถานะไฟล์ประจำวัน",
      headers: ["บริษัท", "ประเภทไฟล์", "เวลาที่รับ", "จำนวนแถว", "ผู้ส่ง", "Checksum", "สถานะ"],
      widths: [14, 24, 12, 12, 18, 14, 14],
      rows: DB.files.map((f) => [f.companyName, f.fileType, f.receivedAt, f.rows, f.sender, f.checksum, { received: "รับแล้ว", missing: "ไม่ได้ส่ง", wrong_company: "ผิดบริษัท", late: "ส่งช้า" }[f.status]]),
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

function openExportDialog() {
  if (!can("export")) return deny("export ข้อมูล");
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
function boot() {
  applyStoredState();
  renderRoleSelect();
  updateBell();
  startScheduler();
  $("#btnBell").addEventListener("click", () => go("notifications"));
  $("#roleSelect").addEventListener("change", (e) => {
    state.role = e.target.value;
    if (!ROUTE_ROLES[state.role].includes(state.route)) {
      location.hash = "#/dashboard";
      state.route = "dashboard";
    }
    toast("สลับมุมมองเป็น " + DB.roles[state.role].name);
    render();
  });
  $("#btnExport").addEventListener("click", openExportDialog);
  $("#autoStatus").addEventListener("click", () => go("import"));
  $("#navToggle").addEventListener("click", () => {
    const sb = $("#sidebar");
    sb.classList.toggle("open");
    $("#navToggle").setAttribute("aria-expanded", sb.classList.contains("open"));
  });

  state.route = parseHash();
  if (!location.hash) location.hash = "#/dashboard";
  render();
  runNotificationRules();
  updateAutoStatus();
  /* กู้การแมป "บริษัทไหนอยู่ระบบไหน" ที่ผู้ใช้ตั้งไว้ */
  const savedSys = Store.data.companySystems || {};
  Object.entries(savedSys).forEach(([code, sysCode]) => {
    let c = DB.companies.find((x) => x.code === code);
    if (!c) DB.companies.push((c = { code, name: code, type: "main", system: null }));
    c.system = sysCode || null;
  });
  retagTracks();
  if (typeof Manual !== "undefined") Manual.init();
}
document.addEventListener("DOMContentLoaded", boot);
