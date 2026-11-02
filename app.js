Warning: truncated output (original token count: 201359)
Total output lines: 9565

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
const displayTime = value => AuditDisplay.dateTime(value);
function normalizeEvidenceSearch(value) {
  const thaiDigits = { "๐": "0", "๑": "1", "๒": "2", "๓": "3", "๔": "4", "๕": "5", "๖": "6", "๗": "7", "๘": "8", "๙": "9" };
  return String(value ?? "").toLocaleLowerCase("th-TH")
    .replace(/[๐-๙]/g, (digit) => thaiDigits[digit])
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function evidenceAmountLabel(value) {
  const amount = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(amount) && amount > 0
    ? `ยอด ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`
    : "";
}
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
      { id: "mc8-sheets", label: "ชีต AUDIT ทุกบริษัท", icon: "reports", title: "ชีต AUDIT ทุกบริษัท", desc: "ผลกระทบยอด STM / PM กับ BO แยก PM ตาม Provider และแยก STM ธนาคารทีละบัญชี พร้อมยอดรวมท้ายตาราง", filters: false },
      { id: "cloud", label: "ไฟล์และสถานะ", icon: "cloud", title: "ตรวจไฟล์จากเมล", desc: "เปิดดูไฟล์ต้นฉบับ ตรวจบริษัท ประเภท และสถานะอ่านไฟล์จาก Supabase ก่อนกระทบยอด", filters: true },
      { id: "source-upload", label: "รับและจัดไฟล์", icon: "cloud", title: "รับไฟล์ให้ถูก ก่อนเริ่มตรวจ", desc: "อัปโหลดแยกบริษัท วันและประเภท เก็บต้นฉบับและประวัติ โดยยังไม่รัน", filters: false },
      { id: "source-run", label: "เตรียมรันมือ", icon: "matching", title: "เลือกชุดไฟล์และเตรียมรันมือ", desc: "เลือกจากเมล อัปโหลด หรือผสมกัน ส่งเฉพาะไฟล์ที่เลือกไปทบทวนรันรอบใหม่", filters: false },
      { id: "intake", label: "ตรวจไฟล์เข้า", icon: "intake", title: "ตรวจไฟล์ก่อนกระทบยอด", desc: "ดูไฟล์จริงแยกตามบริษัทและประเภท PM / ฝาก / ถอน หากยังอ่านไม่สำเร็จระบบจะแจ้งให้ตรวจต่อ", filters: true, hidden: true },
      { id: "exceptions", label: "ผลตรวจและเคส", icon: "exceptions", title: "ภาพรวมผลตรวจและเคส", desc: "ดูคู่สำเร็จและรายการที่ต้องตรวจ แยกบริษัท วันที่ ฝาก–ถอน และสถานะ", filters: true },
      { id: "matching", label: "3-Point Match", icon: "matching", title: "ตรวจการจับคู่ 3 จุด", desc: "เทียบ account, time, amount ระหว่าง STM กับ BO ทีละรายการพร้อม tolerance ที่ใช้", filters: true, hidden: true },
    ],
  },
  {
    group: "ตรวจสอบและอนุมัติ",
    items: [
      { id: "clarify", label: "ติดตามคำชี้แจง", icon: "clarify", title: "งานชี้แจงแยกตามบริษัท", desc: "ส่งและติดตามเอกสารจากผู้ชี้แจงตาม SLA บริษัท เมื่อส่งกลับให้ Audit ตรวจในหน้า Audit รอตรวจ", filters: true },
      { id: "audit-review", label: "Audit รอตรวจ", icon: "exceptions", title: "Audit รอตรวจเอกสาร", desc: "เอกสารหรือคำตอบจากผู้ชี้แจงกลับมาแล้ว ตรวจในเคสเดิมก่อนส่งหัวหน้าอนุมัติปิด", filters: true },
      { id: "approvals", label: "อนุมัติ / ปิดเคส", icon: "approvals", title: "คำขอรออนุมัติ", desc: "รายการที่ชี้แจงแล้วรอ Audit Lead ตรวจทาน อนุมัติ หรือส่งกลับ", filters: true },
      { id: "damage", label: "ทะเบียนความเสียหาย", icon: "damage", title: "Damage Register", desc: "บันทึกผลตรวจและความเสียหายแบบเรียลไทม์ ค้นย้อนหลังตามช่วงวัน", filters: true },
    ],
  },
  {
    group: "รายงาน",
    items: [
      { id: "finance", label: "การเงิน & ผู้บริหาร", icon: "kpi", title: "การเงินและภาพรวมผู้บริหาร", desc: "BO ความเสี่ยง ความเสียหาย พนักงาน และ Action แยกตามบริษัทที่มีสิทธิ์ · ไม่แก้ยอดหรือสถานะเคส", filters: false },
      { id: "monthly-audit", label: "สุ่มตรวจรายเดือน", icon: "reports", title: "สุ่มตรวจ Audit รายเดือน", desc: "เก็บชุดสุ่ม ผู้ตรวจ ผลประเมิน หมายเหตุ หลักฐาน และประวัติแยกบริษัท/เดือน", filters: false },
      { id: "kpi", label: "KPI บริษัท", icon: "kpi", title: "KPI ตามบริษัทและพนักงาน", desc: "ความผิดพลาดตามบริษัท ประเภท และผู้ตรวจ เพื่อใช้ประเมินและลดความผิดซ้ำ", filters: true, hidden: true },
      { id: "reports", label: "รายงาน & Export", icon: "reports", title: "รายงานรายวัน / รายเดือน", desc: "สรุปผลตรวจ, แนวโน้มความเสียหาย และ export ให้การเงิน / บุคคล", filters: true },
      { id: "talk", label: "Talk to Data", icon: "talk", title: "ถามข้อมูลด้วยภาษาไทย", desc: "ถามจากข้อมูลที่ reconcile แล้ว ทุกคำตอบอ้างอิงตัวเลข ช่วงวันที่ และลิงก์กลับหลักฐาน", filters: false, hidden: true },
    ],
  },
  {
    group: "ระบบ",
    items: [
      { id: "rules", label: "Bank Rules", icon: "rules", title: "กฎธนาคารและ Tolerance", desc: "ปรับกฎรายธนาคารได้โดยไม่ต้องแก้โปรแกรม ทุกการเปลี่ยนถูกบันทึกใน audit log", filters: false },
      { id: "account-holds", label: "พักบัญชี STM", icon: "clock", title: "จัดการบัญชีพักตรวจ / รอ STM", desc: "หัวหน้าออดิทและผู้ดูแลระบบเปิดหรือปลดพักบัญชีที่ถูกระงับ โดยไม่รันซ้ำหรือเปลี่ยนยอดและสถานะเคส", filters: false },
      { id: "notifications", label: "การแจ้งเตือน", icon: "bell", title: "ศูนย์การแจ้งเตือน", desc: "แจ้งเมื่อไฟล์ขาด พบ exception ระดับสูง หรือเคสเลย SLA พร้อมตั้งกฎและช่องทางได้", filters: false },
      { id: "audit-log", label: "Audit Log", icon: "log", title: "บันทึกการใช้งานระบบ", desc: "ทุก note, status, approval, การตั้งค่า ถูกบันทึกพร้อมเวลาและผู้ทำรายการ", filters: true },
      { id: "mail-intake", label: "ตรวจเมลเข้า", icon: "intake", title: "ตรวจผู้ส่งและดึงเมลเข้าคลัง", desc: "เพิ่มอีเมลผู้ส่งและสั่งดึงเมลที่ตกหล่นเข้าคลัง แยกจากการรันหรือยืนยันผลกระทบยอด", filters: false },
      { id: "users", label: "ผู้ใช้และสิทธิ์", icon: "users", title: "ผู้ใช้ บทบาท และบริษัท", desc: "กำหนดหน้าที่และบริษัทที่ผู้ใช้แต่ละคนรับผิดชอบ สิทธิ์ถูกบังคับซ้ำที่ฐานข้อมูล", filters: false },
      { id: "case-settings", label: "ตั้งค่าเคส / SLA", icon: "rules", title: "ตั้งค่า SLA แยกบริษัท", desc: "กำหนดเวลาขอเอกสารของแต่ละบริษัท ไม่เปลี่ยนกำหนดเคสเก่าและไม่ปิดความเสียหายอัตโนมัติ", filters: false },
    ],
  },
];
const ROUTE_MAP = {};
ROUTES.forEach((g) => g.items.forEach((it) => (ROUTE_MAP[it.id] = it)));

/* โครงสร้างเครือบริษัทและกฎตรวจที่ Audit อนุมัติแล้ว
   แต่ละเครือใช้กฎของตัวเอง ห้ามยืมกฎข้ามเครือ */
const AUDIT_COMPANY_GROUPS = Object.freeze([
  {
    id: "XB",
    name: "เครือ XB",
    status: "active",
    companies: ["3XB", "MC8", "MR9", "PS8", "UR9"],
    rules: [
      "จับคู่ STM / PM กับ BO ภายในบริษัท บัญชี/Provider ทิศทาง และยอดเดียวกัน โดยไม่ข้ามบริษัท",
      "PM ฝาก: ใช้ paymentTime ก่อน; ใช้ expiredTime เฉพาะเมื่อไม่มี paymentTime · PM ถอน: ใช้ updateTime",
      "ยอดฝากทุก Provider ใช้ realAmount · ยอดถอน AT/M ใช้ transferredAmount · ยอดถอน AZ/CP/LP/12PAY ใช้ amount",
      "3XB: 12PAY ฝากและ 123PAY ถอนคือ Provider/บัญชีเดียวกันชื่อ 12PAY; รับไฟล์ PM เพียง 2 ไฟล์ แล้วแยกทิศทางตามไฟล์และ BO ก่อนจับด้วยบัญชี + เวลา + ยอด",
      "PM ของทุก Provider เก็บรหัสสองช่องแยกกัน: id เป็นรหัสธุรกรรม เช่น P2C... และ _id เป็นรหัส 6aa...; ฝั่ง BO แยกเฉพาะรหัส 6aa... หลัง Sapan:/Spean: เหมือน Text to Columns และตัดคำอธิบายที่ตามหลังออก",
      "กฎ Sapan/_id ใช้กับ PM ถอนของ XB ที่มี _id ได้แก่ AT/AZ/CP/M/LP: _id ฝั่ง PM ต้องตรงกับรหัสที่แยกจากหมายเหตุ BO และยอดจริงต้องตรงกันแบบคู่ 1:1 จึงปิดได้ แม้เวลา/ชื่อ Provider เดิมคลาดเคลื่อน",
      "3XB เปิดใช้ LOCALPAY ฝาก/ถอน (ฝากใช้ realAmount · ถอนใช้ amount) · QPAY รับไฟล์ไว้ได้แต่ยังไม่นำมากระทบยอดจนกว่าแอดมินเปิดใช้",
      "รายการข้ามวันเปิดเป็น “ค้างรอข้อมูลข้ามวัน”; เมื่อวันถัดไปจับคู่แบบ 1:1 ได้จึงปิดงานค้างและเก็บ Audit Log",
      "ยอดสูงและเวลาคลาดเคลื่อนที่จับคู่ได้ตามกฎเป็นสถานะแจ้งผล ไม่ส่งให้ Audit ยืนยัน; คู่ซ้ำหรือคลุมเครือจะไม่ปิดอัตโนมัติ",
      "STM ธนาคารของ XB รวมรายการฝากและถอน (D-W) ไว้ชีตเดียวต่อบัญชี เช่น KB A D-W หรือ SCB B D-W",
    ],
  },
  { id: "SYS123", name: "เครือ 123", status: "active", companies: ["AT4", "FR8", "SK8"], rules: [
    "AUTOPEER ฝาก/ถอน: รหัสสมาชิก ↔ สมาชิก BO, เลขบัญชีสมาชิก ↔ บัญชีลูกค้า BO และยอดฝาก/ถอน ↔ จำนวนเงินฝาก/จำนวนเงินถอนจริง BO",
    "AZPAY ฝาก: รหัสสมาชิก + เลขบัญชีสมาชิก + จำนวนเงินฝาก ต้องตรงกับ สมาชิก + บัญชีลูกค้า + จำนวนเงินฝาก BO (ยังไม่เปิดกฎถอน)",
    "COREPAY ฝาก/ถอน: รหัสสมาชิก + เลขบัญชีสมาชิก + ยอดฝาก/ถอน ต้องตรงกับสมาชิก + บัญชีลูกค้า + ยอดจริงฝั่ง BO",
    "CYBERPLUS ฝากใช้ 3 จุดเหมือน COREPAY; CYBERPLUS ถอนใช้ 2 จุดคือรหัสสมาชิกและจำนวนเงินถอนจริง โดยไม่บังคับเลขบัญชีสมาชิก",
    "LOCALPAY ฝาก/ถอน: รหัสสมาชิก + เลขบัญชีสมาชิก + ยอดฝาก/ถอน ต้องตรงกับสมาชิก + บัญชีลูกค้า + ยอดจริงฝั่ง BO",
    "ทุกคู่ต้องอยู่บริษัท Provider และทิศทางเดียวกัน; เลขบัญชีเต็มจับกับ 4 หลักท้ายได้เมื่อสมาชิกและยอดตรงกัน",
    "ถ้าสมาชิกหรือเลขบัญชีขาดเพียงหนึ่งฝั่ง ระบบใช้จุดที่เหลือร่วมกับยอดและคู่เวลาใกล้ที่สุดไม่เกิน 10 นาทีแบบ reciprocal 1:1; ข้อมูลขัดกัน คู่เวลาเสมอ หรือมีแต่ยอดจะไม่ปิด",
    "รายการซ้ำก่อน/หลังเที่ยงคืนจับต่อได้เมื่อ identity ตรงและเป็นคู่เวลาใกล้ที่สุดภายใน 60 นาที; เก็บหลักฐานข้ามวันใน Audit Log",
    "STM ธนาคารปกติจับเวลากับคอลัมน์วันที่ธนาคารในรายงานฝาก/ถอน; BBL และ GSB ที่ไม่มีเวลาใช้บัญชี+วัน+ทิศทาง+ยอด",
    "รายการ KTB เวลา 23:00-23:59 ที่ธนาคารลงวันที่ถัดไป เก็บเป็น candidate และปิดได้เฉพาะเมื่อบัญชี ทิศทาง ยอด และเวลาธนาคารเป็นคู่ 1:1 กับ BO ของวันก่อนหน้า",
    "ยอดตรงที่เวลาแตกต่างแต่ระบุคู่ได้ชัดเจนเป็นผลการจับคู่ ไม่ส่งให้ Audit ยืนยัน; หลักฐานขัดกันหรือคู่กำกวมยังคงเป็นเคส",
    "รายการฝากมือธนาคารปกติ: ใช้ยอดกับเวลาธนาคารใน BO จับคู่ STM; ท้าย 4 ตัวและชื่อลูกค้าใช้ช่วยแยกรายการซ้ำ และจะไม่เปิดเคสเพียงเพราะระบุว่าเติมมือ",
    "BBL/GSB ที่ STM ไม่มีเวลา: AT4 BBL นรวรฝาก, AT4 KTB เบญจพรฝาก และ SK8 BBL ดลยาฝากยังใช้กฎเฉพาะแบบยอดไม่ซ้ำ คนละยูส และยอด BO ไม่เกิน STM",
    "STM ธนาคารปกติแยกชีตตามบัญชีและแยกฝาก (D) / ถอน (W)",
  ] },
  { id: "SYS7M", name: "เครือ 7M", status: "active", companies: ["UFABET7M"], rules: [
    "PM ฝากและถอนต้องจับคู่ 3 จุด: Ref/Ref Id ใน STM PM กับ Note ของ BO, User/Username กับ User ใน BO และยอดตามช่องเงินจริงของ Provider กับยอด BO",
    "ATP ฝากใช้ยอด โอนจริง · ATP ถอนใช้ยอด P2P จ่าย",
    "COREPAY และ CYBERPLUS ฝากใช้ จำนวนที่ได้รับ · ถอนใช้ จำนวนเงิน",
    "AZPAY ฝากใช้ จำนวนเงิน · MYPAY และ LOCALPAY ฝาก/ถอนใช้ จำนวนเงินตามช่องรายการ",
    "Note ของ BO อาจมีคำอธิบาย เช่น P2P สำเร็จจากรายการ P2C หรือ MyPay สำเร็จจากรายการ ระบบต้องค้นหา Ref ภายในข้อความ ไม่เทียบทั้งช่องแบบตรงตัว",
    "เวลาเป็นข้อมูลประกอบ ไม่ใช่คีย์หลัก ถ้า Ref + User + ยอดเงินตรงกันให้ปิดได้ แม้เวลาต่างกัน; ถ้า User ไม่ครบ ใช้ Ref + ยอดเงินได้เมื่อเป็นคู่เดียวที่ไม่ซ้ำ",
    "ค้นหาคู่ข้ามแถว/ข้ามชีตได้ แต่คู่ซ้ำหรือคลุมเครือจะคงไว้ให้ตรวจเพิ่ม ไม่ปิดจากเวลาใกล้เคียงเพียงอย่างเดียว",
    "STM ธนาคารปกติจับคู่ด้วยยอดเงินและฝาก/ถอนภายในบัญชีเดียวกัน รองรับ BO/STM เรียงแถวไม่ตรงกัน โดยใช้เวลาที่ใกล้ที่สุดช่วยเลือกคู่",
    "เฉพาะ TMN แยกชีตฝาก (D) และถอน (W); STM ธนาคารปกติอื่นรวมฝาก-ถอน (D-W) ไว้ชีตเดียวต่อบัญชี; แสดงสถานะ วิธีจับคู่ เหตุผล และยอดรวมท้ายชีต"
  ] },
]);

function auditCompanyGroupOf(company) {
  const code = String(company || "").trim().toUpperCase();
  return AUDIT_COMPANY_GROUPS.find((group) => group.companies.includes(code));
}

function groupedCompanyOptions(codes, selected) {
  const available = new Set((codes || []).map((code) => String(code || "").trim().toUpperCase()).filter(Boolean));
  const groups = AUDIT_COMPANY_GROUPS.map((group) => {
    const members = group.companies.filter((code) => available.has(code));
    if (!members.length) return "";
    return `<optgroup label="${h(group.name)}${group.status === "pending" ? " · รอเงื่อนไข" : ""}">${members.map((code) => `<option value="${h(code)}" ${code === selected ? "selected" : ""}>${h(code)}</option>`).join("")}</optgroup>`;
  }).join("");
  const grouped = new Set(AUDIT_COMPANY_GROUPS.flatMap((group) => group.companies));
  const ungrouped = [...available].filter((code) => !grouped.has(code)).sort((a, b) => a.localeCompare(b, "th"));
  return groups + (ungrouped.length ? `<optgroup label="ยังไม่จัดเครือ">${ungrouped.map((code) => `<option value="${h(code)}" ${code === selected ? "selected" : ""}>${h(code)}</option>`).join("")}</optgroup>` : "");
}

function reviewCompanyGroupsMarkup(companies) {
  const available = new Map((companies || []).map((company) => [String(company.code || "").trim().toUpperCase(), company]));
  const configured = new Set(AUDIT_COMPANY_GROUPS.flatMap((group) => group.companies));
  const groupCards = AUDIT_COMPANY_GROUPS.map((group) => {
    const members = group.companies.map((code) => available.get(code)).filter(Boolean);
    if (!members.length) return "";
    return `<article class="company-group-card review-company-group ${group.status === "pending" ? "pending" : "active"}">
      <div class="company-group-head"><div><strong>${h(group.name)}</strong><span>${num(members.length)} บริษัท</span></div><span class="badge ${group.status === "active" ? "green" : "grey"}">${group.status === "active" ? "ใช้กฎแล้ว" : "รอเงื่อนไข"}</span></div>
      <div class="company-subcompany-list">${members.map((company) => `<button type="button" class="company-subcompany" data-review-company="${h(company.code)}"><span><b>${h(company.code)}</b><small>${h(company.name || company.code)}</small></span><i>เปิดชีทของบริษัทนี้</i></button>`).join("")}</div>
      ${group.status === "active" ? `<details class="company-rule-details" open><summary>เงื่อนไขตรวจของ${h(group.name)}</summary><ol>${group.rules.map((rule) => `<li>${h(rule)}</li>`).join("")}</ol><p>ใช้กับ ${num(members.length)} บริษัทในกลุ่มนี้ · หลักฐานไม่ครบหรือมีหลายคู่ต้องคงเคสให้ Audit ตรวจ</p></details>` : `<div class="company-group-pending"><b>ยังไม่เปิดกฎอัตโนมัติ</b><span>รอเงื่อนไขจาก Audit และจะไม่ใช้กฎของกลุ่มอื่นแทน</span></div>`}
    </article>`;
  }).join("");
  const ungrouped = [...available.entries()].filter(([code]) => !configured.has(code)).map(([, company]) => company);
  const ungroupedCard = ungrouped.length ? `<article class="company-group-card review-company-group pending"><div class="company-group-head"><div><strong>ยังไม่จัดเครือ</strong><span>${num(ungrouped.length)} บริษัท</span></div><span class="badge grey">รอจัดกลุ่ม</span></div><div class="company-subcompany-list">${ungrouped.map((company) => `<button type="button" class="company-subcompany" data-review-company="${h(company.code)}"><span><b>${h(company.code)}</b><small>${h(company.name || company.code)}</small></span><i>เปิดชีทของบริษัทนี้</i></button>`).join("")}</div></article>` : "";
  return groupCards + ungroupedCard;
}

function auditRuleBookMarkup(selectedCompany = "") {
  const selectedGroup = auditCompanyGroupOf(selectedCompany);
  const activeGroups = AUDIT_COMPANY_GROUPS.filter((group) => group.status === "active");
  return `<section class="panel audit-rule-book" aria-label="เงื่อนไขการกระทบยอดที่ระบบใช้จริง">
    <div class="panel-heading"><div><p class="eyebrow">กติกาที่ระบบใช้จริง</p><h2>เงื่อนไขกระทบยอด XB · 123 · 7M</h2><small class="head-sub">แสดงกฎที่เปิดใช้งานแล้วเท่านั้น · คู่ซ้ำ หลักฐานไม่ครบ หรือข้อมูลขัดกันจะไม่ถูกปิดอัตโนมัติ</small></div><span class="health ok">${num(activeGroups.length)} เครือเปิดใช้</span></div>
    <div class="audit-rule-book-grid">
      ${activeGroups.map((group) => `<article class="audit-rule-book-card ${selectedGroup?.id === group.id ? "selected" : ""}">
        <header><div><strong>${h(group.name)}</strong><small>${h(group.companies.join(" · "))}</small></div><span class="badge green">ใช้กฎแล้ว</span></header>
        <ol>${group.rules.map((rule) => `<li>${h(rule)}</li>`).join("")}</ol>
      </article>`).join("")}
    </div>
    <div class="cross-day-rule-flow">
      <strong>วงจรรายการข้ามวัน</strong>
      <span><b>1</b> วันแรก: ค้างรอข้อมูลข้ามวันและแจ้ง Audit</span>
      <i>→</i>
      <span><b>2</b> วันถัดไป: ค้นหาคู่เดิมด้วยบัญชี/Provider ทิศทาง ยอด และหลักฐานอ้างอิง</span>
      <i>→</i>
      <span><b>3</b> พบคู่เดียว: ปิดรายการค้าง นำออกจากคิว และเก็บประวัติใน Audit Log</span>
      <em>ไม่พบคู่หรือพบหลายคู่: คงไว้ให้ Audit ตรวจ ไม่บังคับปิด</em>
    </div>
  </section>`;
}

/* หน้าที่แต่ละ role มองเห็น */
const ROUTE_ROLES = {
  monitor: ["cloud", "dashboard", "daily-summary", "mc8-sheets", "exceptions", "matching", "clarify", "audit-review", "reports", "monthly-audit", "notifications"],
  audit_assistant: ["cloud", "dashboard", "daily-summary", "mc8-sheets", "exceptions", "matching", "clarify", "audit-review", "approvals", "reports", "monthly-audit", "notifications"],
  lead: ["cloud", "dashboard", "daily-summary", "mc8-sheets", "intake", "exceptions", "matching", "clarify", "audit-review", "approvals", "damage", "kpi", "reports", "monthly-audit", "talk", "rules", "account-holds", "notifications", "audit-log", "case-settings", "users", "finance"],
  shift_lead: ["cloud", "daily-summary", "clarify", "notifications"],
  exec: ["dashboard", "daily-summary", "kpi", "reports", "damage", "notifications", "finance"],
  /* ผู้ดูแลระบบต้องตรวจสอบและช่วยงานได้ทุกหน้า รวมหน้าวิเคราะห์ที่ซ่อนจากบทบาททั่วไป */
  admin: Object.keys(ROUTE_MAP),
};
for(const role of ['monitor','audit_assistant','lead'])ROUTE_ROLES[role].push('source-upload','source-run');
ROUTE_ROLES.lead.push('mail-intake');

/* ---------------- state ---------------- */
const PROD_TODAY = (() => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
})();
const OPERATING_START_DATE = "2026-08-30";
// Display scope only: retain older sources for cross-day matching and evidence.
// Do not apply this boundary to ingestion or reconciliation source lookups.
const VISIBLE_DATE_FROM = "2026-09-15";
const VISIBLE_DATE_TO = "9999-12-31";
function visibleDate(value) {
  return !value || value < VISIBLE_DATE_FROM ? VISIBLE_DATE_FROM : value > VISIBLE_DATE_TO ? VISIBLE_DATE_TO : value;
}
const DEFAULT_WORK_DATE = (() => {
  const [year, month, day] = PROD_TODAY.split('-').map(Number);
  return visibleDate(new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10));
})();
// Start with one day. Historical ranges remain explicitly selectable; source
// ingestion and adjacent-day matching are not restricted by this UI default.
const DEFAULT_RANGE_FROM = DEFAULT_WORK_DATE;
const state = {
  route: "cloud",
  role: "lead",
  filters: { date: DEFAULT_WORK_DATE, from: DEFAULT_RANGE_FROM, to: DEFAULT_WORK_DATE, preset: "custom", company: "ALL", direction: "ALL" },
  filtersOpen: false,
  exFilter: { q: "", type: "ALL", severity: "ALL", status: "ACTION", sla: false },
  reviewSheet: "all",
  auditDocumentView: "excel",
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
function saveOverride(e, persistRemote = true) {
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
  if (persistRemote && state.dataset === "production" && typeof Sb !== "undefined" && Sb.signedIn() && e.dbId) {
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
function belongsToClarificationSheet(e) {
  return !e.closureRequestId && Boolean(e.requestedAt || e.respondedAt || ["clarifying", "answered"].includes(e.status));
}
function filteredExceptions(source = DB.exceptions) {
  const f = state.filters;
  const x = state.exFilter;
  return source.filter((e) => {
    if (!canAccessCompany(e.company)) return false;
    if (state.route === "exceptions" && state.reviewSheet !== "all" && belongsToClarificationSheet(e) !== (state.reviewSheet === "clarification")) return false;
    if (!inRange(e.date)) return false;
    if (f.company !== "ALL" && e.company !== f.company) return false;
    if (f.direction !== "ALL" && e.direction !== f.direction) return false;
    if (x.type !== "ALL" && e.type !== x.type) return false;
    if (x.severity !== "ALL" && e.severity !== x.severity) return false;
    if (x.status === "ACTION" && ["closed", "approved", "damage"].includes(e.status)) return false;
    if (x.status === 'CLOSURE_PENDING' && !(e.closureRequestId && e.status === 'answered')) return false;
    if (!['ALL', 'ACTION', 'CLOSURE_PENDING'].includes(x.status) && e.status !== x.status) return false;
    if (x.sla && !e.overSla) return false;
    if (x.q) {
      const q = x.q.toLowerCase();
      const provider = typeof pmProviderOf === "function" ? pmProviderOf(`${e.account} ${e.detail} ${e.stmRaw} ${e.boRaw}`) || "" : "";
      const sys123CustomerTags = ["AT4", "FR8", "SK8"].includes(String(e.company || "").toUpperCase())
        ? JSON.stringify(e.customerDetails || {}) : "";
      const hay = `${e.id} ${e.code || ""} ${caseLabel(e)} ${e.company} ${e.account} ${e.employee} ${e.member} ${e.type} ${e.typeName} ${e.cause} ${e.bank} ${e.direction} ${e.detail} ${e.stmRaw} ${e.boRaw} ${provider} ${sys123CustomerTags}`.toLowerCase();
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
  f.date = visibleDate(f.date);
  f.from = visibleDate(f.from);
  f.to = visibleDate(f.to);
}
const inRange = (d) => {
  if (!d || d === "-") return true;
  const day = String(d).slice(0, 10);
  return day >= VISIBLE_DATE_FROM && day <= VISIBLE_DATE_TO && day >= state.filters.from && day <= state.filters.to;
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
function hasComparableExceptionTimes(e) {
  return !!(e && e.boTime && e.stmTime && e.boTime !== "-" && e.stmTime !== "-");
}
function exceptionTimeDiffLabel(e) {
  return hasComparableExceptionTimes(e) ? `${num(e.timeDiffSec)} วิ` : "ไม่มีเวลา";
}
function evidenceTimeDiffLabel(e) {
  return e?.bo?.noTime || e?.stm?.noTime || !Number.isFinite(Number(e?.timeDifferenceSeconds))
    ? "ไม่มีเวลา"
    : `${num(e.timeDifferenceSeconds)} วินาที`;
}
const sumRisk = (list) => list.reduce((a, c) => a + (c.riskAmount || 0), 0);
const severityColor = (s) => Charts.STATUS[s] || "#7c8ea2";
const statusMeta = (code) => DB.statuses.find((s) => s.code === code) || { name: code, tone: "grey" };
const caseStatusMeta = (e) => (e.reviewHold || window.AccountReviewHolds?.match(e)) ? {name:AccountReviewHolds.label,tone:'amber'} : e.closureRequestId && e.status === 'answered' ? {name:'รอหัวหน้าปิดเคส',tone:'grey'} : statusMeta(e.status);
const sevMeta = (code) => DB.severities.find((s) => s.code === code) || { name: code };
const isEmptyPmFile = (file) => file?.parsed && !file?.parse_error && file?.kind === "pm_statement" && Number(file?.row_count || 0) === 0 && Number(file?.size_bytes || 0) <= 16;
const parsedFileLabel = (file) => isEmptyPmFile(file) ? "ไม่มีรายการ (0)" : "พร้อมใช้งาน";

/* ปิดด่วนได้เมื่อมีรายการครบทั้งสองฝั่งและยอดเท่ากัน ผู้ตรวจยังต้องกดยืนยันเอง */
function isQuickCloseEligible(e) {
  if (typeof state !== "undefined" && state.dataset === "production") return !!e?._quickSourceEvidence && e.status === "open";
  const realEvidence = (raw) => {
    const value = String(raw || "").trim();
    return value.length > 1 && !/^[—–-]|ไม่พบรายการ|ไม่ต้องใช้\s*statement|ตรวจจากรายงานหลังบ้าน|รอข้อมูล|ไม่มีข้อมูล/i.test(value);
  };
  return e
    && !["closed", "approved", "damage"].includes(e.status)
    && e.bankAmount !== null && e.bankAmount !== undefined
    && e.systemAmount !== null && e.systemAmount !== undefined
    && e.bankAmount !== "" && e.systemAmount !== ""
    && Number.isFinite(Number(e.bankAmount)) && Number.isFinite(Number(e.systemAmount))
    && !!e._detailLoaded
    && realEvidence(e.stmRaw)
    && realEvidence(e.boRaw)
    && Math.abs(Number(e.bankAmount) - Number(e.systemAmount)) < 0.01;
}

function hasRecordedAmountOutcome(e) {
  return !!e.closureRequestId || e.status === "pair_pending" || ["damage", "approved", "closed"].includes(e.status);
}

async function refreshQuickCloseEvidence(e) {
  e._quickSourceEvidence = false;
  if (state.dataset !== "production" || !e.dbId || !e._detailLoaded) return;
  // Only open/closed complete pairs can pass the existing source-evidence
  // check (closed is display-only). Skip whole-day reads for other cases.
  if(!['open','closed'].includes(e.status) || e.bankAmount==null || e.systemAmount==null
    || e.bankAmount==='' || e.systemAmount==='' || !Number.isFinite(Number(e.bankAmount))
    || !Number.isFinite(Number(e.systemAmount)) || Math.abs(Number(e.bankAmount)-Number(e.systemAmount))>=0.01)return;
  const [data, links] = await Promise.all([
    Sb.reconciliationOverview(e.company, e.date),
    Sb.evidenceCaseRecommendations({caseId:e.dbId}),
  ]);
  const row = data.cases?.find(row => row.id === e.dbId);
  // Fail closed for linked clarification/cross-company cases and incomplete queries.
  if (!row || row.company !== e.company || !Array.isArray(links) || links.length
      || !["open","closed"].includes(row.status)) return;
  const review = {...data, cases:data.cases.map(item => item.id === row.id ? {...item,status:"open"} : item)};
  e._quickSourceEvidence = PreliminaryReview.manualCandidates(review).has(row.id);
  e._quickVerifiedStatus = row.status;
}

// Completion is a positive assertion: absent/failed queries must never count as passed checks.
function dailyCompletionBlockers(data) {
  const blockers = [];
  if (!data.files.length) blockers.push("ยังไม่ได้รับไฟล์");
  if (!data.checklist) blockers.push("Checklist ยังโหลดไม่ครบ");
  if (!data.reconciliationFiles.length || data.reconciliationFiles.some((f) => !f.parsed || f.parse_error)) blockers.push("ยังอ่านไฟล์กระทบยอดไม่ครบ");
  if (!data.quality.length || data.quality.some((r) => !r.run_id || r.status !== "completed")) blockers.push("ยังไม่มีผลกระทบยอดสำเร็จครบ");
  if (!data.boFirst || data.boFirst.complete !== true || (data.boFirst.missing || []).length) blockers.push("ยังตรวจคู่ STM/PM ตาม BO ไม่ครบ");
  if ((data.checklist?.missing_items || []).length) blockers.push("มีเอกสารที่ต้องติดตาม");
  if (data.stillOpen > 0) blockers.push(`ยังมี ${data.stillOpen} เคสค้าง`);
  return blockers;
}

const caseUiResults = new Map();
function caseUiKey(e) { return e.dbId || [e.company,e.date,e.runId,e.id].join('|'); }
function recordCaseUiResult(e, message) {
  caseUiResults.set(caseUiKey(e), {message, status:e.status, actor:(typeof Sb !== 'undefined' && Sb.currentEmail()) || currentUser().username, at:nowStamp()});
}
const clarificationRequestFlights = new Set();
function isUnsentClarificationCase(row) {
  return ['open','pending_next_day'].includes(row.status) && !row.requestedAt && !row.respondedAt && !row.closureRequestId;
}
function clarificationAccountKey(row) { return String(row.account||'').trim().toUpperCase(); }
function captureClarificationRequestContext(e) {
  const root = $('#viewRoot');
  const scrolls = Array.from(root?.querySelectorAll('*') || []).filter(el => el.scrollTop || el.scrollLeft).map(el => {
    const parts=[]; let node=el;
    while(node && node!==root){parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${Array.from(node.parentElement.children).indexOf(node)+1})`);node=node.parentElement;}
    return {selector:parts.join(' > '),top:el.scrollTop,left:el.scrollLeft};
  });
  // Sheet filters live inside MC8LiveSheets, not state.exFilter. A sheet case
  // may be the only row hydrated into DB.exceptions, so never infer exhaustion
  // from that partial, unrelated list.
  const rows=state.route==='mc8-sheets'?[]:filteredExceptions();
  const index=rows.findIndex(row=>caseUiKey(row)===caseUiKey(e));
  const ordered=index<0?rows:rows.slice(index+1).concat(rows.slice(0,index));
  const candidates=ordered.filter(row=>row.company===e.company && caseUiKey(row)!==caseUiKey(e)
    && isUnsentClarificationCase(row) && canAccessCompany(row.company));
  const account=clarificationAccountKey(e);
  const sameAccount=row=>account && clarificationAccountKey(row)===account;
  return {company:e.company, date:e.date, route:state.route, actor:Sb.authUser()?.id||null,
    account:e.account, x:window.scrollX,y:window.scrollY,scrolls,
    nextKeys:[...candidates.filter(sameAccount),...candidates.filter(row=>!sameAccount(row))].map(caseUiKey)};
}
function restoreClarificationRequestScroll(context) {
  const restore=()=>{
    for(const saved of context.scrolls){const el=$('#viewRoot')?.querySelector(saved.selector);if(el){el.scrollTop=saved.top;el.scrollLeft=saved.left;}}
    window.scrollTo({left:context.x,top:context.y,behavior:'instant'});
  };
  restore();requestAnimationFrame(()=>requestAnimationFrame(restore));
}
async function loadClarificationReceiptCandidates(e,context) {
  if((context.route!=='mc8-sheets'&&!context.readOnlyQueue)||state.dataset!=='production')return;
  if(!context.date||!canAccessCompany(context.company))throw Error('ไม่พบขอบเขตบริษัทและวันที่ของเคส');
  const [raw,scopes]=await Promise.all([
    Sb.currentExceptions({company:context.company,from:context.date,to:context.date,limit:10000}),
    Sb.reviewHoldScopes(),
  ]);
  if(!Array.isArray(raw)||raw.length>=10000||!Array.isArray(scopes))throw Error('ยังโหลดรายการเคสปัจจุบันไม่ครบ กรุณาลองตรวจอีกครั้ง');
  if(context.actor!==(Sb.authUser()?.id||null)||context.route!==state.route)throw Error('ผู้ใช้หรือหน้ารายการเปลี่ยนแล้ว');
  AccountReviewHolds.set(scopes);
  const rows=raw.map(mapLiveException).filter(row=>row.company===context.company&&row.date===context.date);
  const index=rows.findIndex(row=>caseUiKey(row)===caseUiKey(e));
  const ordered=index<0?rows:rows.slice(index+1).concat(rows.slice(0,index));
  const candidates=ordered.filter(row=>caseUiKey(row)!==caseUiKey(e)&&isUnsentClarificationCase(row)&&!AccountReviewHolds.match(row));
  if(context.readOnlyQueue){
    const flags=await Sb.caseEvidenceFlags(candidates.map(row=>row.dbId));
    if(context.actor!==(Sb.authUser()?.id||null)||context.route!==state.route)throw Error('ผู้ใช้หรือหน้ารายการเปลี่ยนแล้ว');
    for(const row of candidates)row.hasEvidence=!!row.clarificationFileId||!!flags[row.dbId];
    context.queueStats={total:rows.length,held:rows.filter(row=>AccountReviewHolds.match(row)).length};
  }
  const same=row=>clarificationAccountKey(row)===clarificationAccountKey(e);
  context.nextKeys=[...candidates.filter(same),...candidates.filter(row=>!same(row))].map(caseUiKey);
  for(const row of rows){
    const existing=DB.exceptions.find(item=>caseUiKey(item)===caseUiKey(row));
    if(existing)Object.assign(existing,row,{notes:existing.notes||[],evidence:existing.evidence||[]});
    else DB.exceptions.push(row);
  }
}
async function showReadOnlyCaseQueue(e) {
  if(!can('request_clarify')||!canAccessCompany(e.company))return deny('ดูคิวเคสถัดไป');
  if(state.dataset==='production'&&!Sb.signedIn())return deny('ดูคิวเคสถัดไป');
  captureCaseOpenDraft();
  const context=captureClarificationRequestContext(e);
  context.readOnlyQueue=true;
  return showClarificationRequestReceipt(e,context,{readOnly:true});
}
async function showClarificationRequestReceipt(e, context, {readOnly=false} = {}) {
  const next=()=>context.nextKeys.map(key=>DB.exceptions.find(row=>caseUiKey(row)===key)).find(row=>row
    && row.company===context.company && isUnsentClarificationCase(row)
    && canAccessCompany(row.company));
  openModal(readOnly?'ดูคิวเคสถัดไป — อ่านอย่างเดียว':'ส่งขอชี้แจงสำเร็จแล้ว', `<div role="status"><p><strong>${h(caseLabel(e))}</strong></p><p>${readOnly?'ยังไม่ได้ส่งคำขอใด ๆ · เปิดดูรายละเอียดเท่านั้น ไม่สร้างเคส ไม่เปลี่ยนยอด และไม่ปิดเคส':'ส่งคำขอให้ผู้ชี้แจงในเคสเดิมแล้ว ไม่สร้างเคสซ้ำ ไม่เปลี่ยนยอด และยังไม่ปิดเคส'}</p><p id="requestReceiptStatus">กำลังตรวจเคสถัดไปจากผลหลักล่าสุด…</p><small>คงบริษัท วันที่ ตัวกรอง หน้ารายการ และตำแหน่งเลื่อนเดิม · คิวครอบคลุมทุกบัญชีในบริษัท/วันเดียวกัน ตรวจบัญชีเดิมก่อน · ไฟล์แนบอย่างเดียวยังถือว่ายังไม่ส่ง</small></div>${readOnly?'<div id="readOnlyCaseQueue" aria-label="ลำดับเคสถัดไป"></div>':''}`,
    `<button class="ghost-button" id="requestReceiptReturn">${readOnly?'กลับเคส / รายการเดิม':'กลับหน้ารายการ'}</button><button class="primary-button" id="requestReceiptNext" disabled>ตรวจเคสถัดไปของบริษัทนี้</button>`);
  const nextButton=$('#requestReceiptNext'),status=$('#requestReceiptStatus');
  let acted=false,busy=false,failed=false;
  $('#modal')._contentCleanup=()=>{acted=true;};
  const active=()=>!acted&&state.route===context.route&&(Sb.authUser()?.id||null)===context.actor&&$('#requestReceiptNext')===nextButton;
  const returnToList=()=>{closeModal();if(!readOnly)closeDrawer();if(!readOnly&&context.route!=='mc8-sheets')render();restoreClarificationRequestScroll(context);};
  const refresh=async()=>{
    busy=true;nextButton.disabled=true;status.textContent='กำลังตรวจเคสถัดไปจากผลหลักล่าสุด…';
    try{
      await loadClarificationReceiptCandidates(e,context);
      if(!active())return;
      failed=false;const row=next();nextButton.disabled=!row;nextButton.textContent=readOnly?'เปิดดูเคสถัดไป (ไม่ส่งคำขอ)':'ตรวจเคสถัดไปของบริษัทนี้';
      status.textContent=row?`เคสถัดไป: ${caseLabel(row)} · ${row.account||'ไม่ระบุ'} · ${!clarificationAccountKey(e)?'เริ่มจากคิวของบริษัทนี้':clarificationAccountKey(row)===clarificationAccountKey(e)?'ตรวจบัญชีเดิมต่อ':'บัญชีเดิมไม่มีเคสที่ส่งต่อได้ ไปบัญชีอื่นของบริษัทนี้'}`:'ไม่มีเคสที่ยังไม่ส่งขอชี้แจงในขอบเขตนี้แล้ว (ไม่รวมเคสพักตรวจ)';
      if(readOnly){
        const queue=context.nextKeys.map(key=>DB.exceptions.find(row=>caseUiKey(row)===key)).filter(row=>row&&row.company===context.company&&canAccessCompany(row.company)&&isUnsentClarificationCase(row));
        const stats=context.queueStats||{};
        $('#readOnlyCaseQueue').innerHTML=`<p>เคสในผลหลัก ${num(stats.total||0)} · พักตรวจ ${num(stats.held||0)} · คิวถัดไป ${num(queue.length)} (ไม่รวมเคสที่กำลังเปิด)</p><div class="table-wrap"><table><thead><tr><th>ลำดับ</th><th>เคส</th><th>บัญชี</th><th>หลักฐาน</th></tr></thead><tbody>${queue.slice(0,100).map((row,i)=>`<tr data-next-queue-case="${h(row.dbId||row.id)}"><td>${i+1}${clarificationAccountKey(row)===clarificationAccountKey(e)?' · บัญชีเดิม':''}</td><td>${h(row.code||row.id)}</td><td>${h(row.account||'ไม่ระบุ')}</td><td>${row.hasEvidence?'แนบแล้ว — ยังไม่ส่ง':'ยังไม่แนบ — ยังไม่ส่ง'}</td></tr>`).join('')||'<tr><td colspan="4">ไม่มีเคสถัดไปที่ส่งต่อได้</td></tr>'}</tbody></table></div>${queue.length>100?'<p>แสดง 100 เคสแรกจากคิวทั้งหมด · ปุ่มถัดไปใช้คิวครบทุกเคส</p>':''}`;
      }
    }catch(error){if(active()){failed=true;status.textContent='ยังตรวจเคสถัดไปไม่สำเร็จ: '+error.message+(readOnly?' · ยังไม่ได้ส่งคำขอ':' · คำขอเดิมส่งสำเร็จแล้ว ไม่ต้องส่งซ้ำ');nextButton.disabled=false;nextButton.textContent='ลองตรวจเคสถัดไปอีกครั้ง';if(readOnly)$('#readOnlyCaseQueue').innerHTML='';}}
    finally{busy=false;}
  };
  $('#requestReceiptReturn').onclick=()=>{if(acted)return;acted=true;returnToList();};
  $('#requestReceiptNext').onclick=async()=>{
    if(!active()||busy)return;
    if(!can('request_clarify'))return deny('ตรวจเคสถัดไป');
    if(failed)return refresh();
    // Re-read the accepted current case set on navigation, not another send.
    await refresh();if(!active()||failed)return;
    const row=next();if(!row){$('#requestReceiptNext').disabled=true;return toast('ไม่มีเคสถัดไปในบริษัทและตัวกรองเดิมแล้ว','warn');}
    acted=true;if(readOnly)captureCaseOpenDraft();returnToList();await openException(row.id);
  };
  await refresh();
}
function showCaseSubmissionReceipt(kind, label = '') {
  const receipts = {
    request: ['ส่งขออนุมัติปิดเคสเรียบร้อย', 'คำขอปิดเคสถูกบันทึกและส่งเข้าคิวหัวหน้าแล้ว เคสยังไม่ปิดจนกว่าหัวหน้าจะตรวจและอนุมัติสำเร็จ'],
    clarification: ['ส่งคำชี้แจงพร้อมหลักฐานเรียบร้อย — รอ Audit ตรวจ', 'คำชี้แจงพร้อมหลักฐานถูกบันทึกแล้ว แต่ยังไม่ได้ส่งคำขอให้หัวหน้าปิดเคส ให้ Audit ตรวจเอกสารและผลยอด แล้วกดส่งหัวหน้ารอปิดเคส เคสเดิมยังอยู่ในภาพรวม'],
    evidence: ['แนบหลักฐานเรียบร้อย', 'บันทึกไฟล์และผูกกับเคสแล้ว แต่การแนบไฟล์หรือบันทึก Note อย่างเดียวยังไม่ได้ส่งคำขอปิดเคส ให้ส่งคำชี้แจงหรือคำขอจับคู่ตามประเภทเคส'],
    additional_evidence: ['เพิ่มหลักฐานในเคสรออนุมัติเรียบร้อย', 'บันทึกหลักฐานเพิ่มแล้ว คำขอเดิมยังรอหัวหน้าตรวจ ไม่ต้องส่งซ้ำ และยังไม่ใช่การปิดเคส'],
    review_evidence: ['ส่งหลักฐานเข้าคิวตรวจเรียบร้อย', 'ผูกเอกสารกับเคสและรอผู้ตรวจทานแล้ว ยังไม่ใช่การยืนยันยอดหรืออนุมัติปิดเคส'],
  };
  const receipt = receipts[kind];
  if (!receipt) throw new Error('Unknown case submission receipt');
  openModal(receipt[0], `<div role="status"><p>${h(label)}</p><p>${h(receipt[1])}</p><p>กลับไปหน้าภาพรวมเคสเพื่อดำเนินการเคสถัดไป</p></div>`, '<button class="ghost-button" id="receiptViewCase">ดูเคสนี้ต่อ</button><button class="primary-button" id="receiptOverview">กลับไปหน้าภาพรวมเคส</button>');
  $('#receiptViewCase').onclick = closeModal;
  $('#receiptOverview').onclick = () => { closeModal(); closeDrawer(); state.reviewSheet='all'; state.exFilter.status='ALL'; go('exceptions'); };
}
async function persistCaseClosure(e, note) {
  if (e._closing) return false;
  e._closing = true;
  try {
    const stamp = new Date().toISOString();
    const actor = (typeof Sb !== "undefined" && Sb.currentEmail()) || currentUser().username;
    if (state.dataset === "production") {
      if (typeof Sb === "undefined" || !Sb.signedIn() || !e.dbId) throw new Error("ยังยืนยันบัญชีผู้ใช้หรือเคสต้นทางไม่ได้");
      await Sb.closeException(e.dbId, e.status, {
        resolution_note: note, resolved_at: stamp, resolved_by: actor,
        approved_by: Sb.authUser()?.id, approved_at: stamp, updated_at: stamp,
      });
    }
    Object.assign(e, { status: "closed", resolutionNote: note, resolvedAt: stamp, resolvedBy: actor });
    recordCaseUiResult(e, 'ยืนยันปิดเคสสำเร็จ — ตรวจหลักฐานและประวัติการปิดได้ในเคสนี้');
    if (state.dataset !== "production") saveOverride(e);
    else {
      delete Store.data.exOverrides[e.id];
      Store.persist();
    }
    return true;
  } catch (err) {
    toast("ยังไม่ยืนยันการปิดเคส: " + err.message + " — รีเฟรชเพื่อตรวจสถานะจริง", "warn");
    return false;
  } finally {
    e._closing = false;
  }
}

async function completeQuickClose(e) {
  if (!can("approve")) return deny("ปิดเคส");
  try { await refreshQuickCloseEvidence(e); }
  catch (err) { return toast("ตรวจหลักฐานล่าสุดไม่สำเร็จ: " + err.message, "warn"); }
  if (state.dataset === "production" && e._quickVerifiedStatus !== "open") return toast("สถานะเคสเปลี่ยนแล้ว กรุณาเปิดตรวจใหม่", "warn");
  if (!isQuickCloseEligible(e)) return toast("เคสนี้ยังปิดด่วนไม่ได้ กรุณาตรวจรายละเอียดก่อน", "warn");
  const note = "Audit ยืนยันคู่ BO/PM และปิดเคส — ยอมรับเวลาต่างหรือข้ามวัน ตรวจยอด อ้างอิงและคู่ซ้ำแล้ว; ยอด " + e.systemAmount + " บาท; เวลา " + exceptionTimeDiffLabel(e) + "; BO: " + e.boRaw + "; PM: " + e.stmRaw;
  if (!await persistCaseClosure(e, note)) return;
  e.resolutionNote = note;
  e.resolvedAt = new Date().toISOString();
  e.resolvedBy = (typeof Sb !== "undefined" && Sb.signedIn() ? Sb.currentEmail() : "") || currentUser().username;
  e.notes = e.notes || [];
  e.notes.push({ by: currentUser().username, at: nowStamp(), text: note });
  logAction("quick_close", "exception", e.id, `${note} · STM ${money(e.bankAmount)} · BO ${money(e.systemAmount)} · เวลา ${exceptionTimeDiffLabel(e)}`);
  closeModal();
  toast(`ปิดเคส ${e.id} แล้ว — ยอดสองฝั่งตรงกัน`);
  renderNav();
  await refreshCaseView();
  await openException(e.id);
}

let bulkCaseApprovalRunning = false;
let auditStatusBatchRunning = false;
function confirmAuditStatusBatch(items, {company,date,onComplete}) {
  if(auditStatusBatchRunning || !items.length)return;
  const snapshot=items.map(({row,action})=>({row:row?{...row}:null,action}));
  openModal('บันทึกสถานะที่เตรียมไว้', `<p>${h(company)} · ${h(date)} · ${snapshot.length} รายการ</p><p>ตรวจสถานะล่าสุดก่อนบันทึกทีละรายการ รายการที่ไม่ผ่านจะไม่เปลี่ยนสถานะ ไม่ส่งข้อความภายนอก</p>${snapshot.map(({row,action})=>`<p>${h(row?.code||'ไม่พบเคส')} → ${action==='close'?'ยืนยันปิดเคส':'ส่งเข้าชีทรอชี้แจง'}</p>`).join('')}<p id="auditBatchProgress" role="status"></p>`, '<button id="auditBatchCancel" class="ghost-button">ยกเลิก</button><button id="auditBatchConfirm" class="primary-button">ยืนยันบันทึกทั้งหมด</button>');
  let cancelled=false;$('#modal')._contentCleanup=()=>{cancelled=true;};
  $('#auditBatchCancel').onclick=closeModal;
  $('#auditBatchConfirm').onclick=async()=>{
    if(auditStatusBatchRunning)return;
    auditStatusBatchRunning=true;$('#auditBatchConfirm').disabled=true;
    const results=[];
    try {
      for(const {row,action} of snapshot){
        if(cancelled)break;
        try{
          if(!Sb.signedIn())throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
          if(!row)throw new Error('ไม่พบเคสในชุดข้อมูลล่าสุด กรุณาเลือกเคสใหม่');
          if(row.company!==company)throw new Error(`เคสเป็นของ ${row.company} ไม่ใช่ ${company}`);
          if(row.business_date!==date)throw new Error(`เคสอยู่วันที่ ${row.business_date} แต่กำลังตรวจวันที่ ${date} กรุณาเปิดวันที่ของเคส`);
          if(action==='close'){
            const result=await BulkCaseReview.run([row],{company,date},{allowed:()=>can('approve')&&Sb.signedIn(),cancelled:()=>cancelled,load:Sb.reconciliationOverview,candidates:PreliminaryReview.manualCandidates,links:id=>Sb.evidenceCaseRecommendations({caseId:id}),progress:()=>{},save:async fresh=>{
              const e=mapLiveException(fresh);e.id=fresh.id;
              return persistCaseClosure(e,`Audit ยืนยันปิดจากตาราง — คู่ BO/PM ยอดและตัวตนตรง ไม่ซ้ำ ยอมรับเวลาต่างหรือข้ามวัน; BO: ${e.boRaw}; PM: ${e.stmRaw}`);
            }});
            results.push({code:row.code,ok:result[0]?.status==='closed',message:result[0]?.status==='closed'?'ปิดเคสแล้ว':result[0]?.reason||'ยังไม่ปิด'});
          }else if(action==='clarify'){
            if(!can('request_clarify'))throw new Error('ไม่มีสิทธิ์ส่งชี้แจง');
            const fresh=await Sb.exceptionDetail(row.id);
            if(!fresh||fresh.company!==company||fresh.business_date!==date||fresh.run_id!==row.run_id||fresh.status!==row.status||!['open','answered','pending_next_day'].includes(fresh.status))throw new Error('ข้อมูลเคสเปลี่ยนแล้ว กรุณาตรวจใหม่');
            if(cancelled)break;
            const at=new Date().toISOString();
            await Sb.requestClarification(row.id,fresh.status,{requested_at:at,requested_by:Sb.authUser()?.id,updated_at:at});
            results.push({code:row.code,ok:true,message:'ส่งเข้าชีทรอชี้แจงแล้ว'});
          }else throw new Error('ไม่รองรับสถานะนี้');
        }catch(error){results.push({code:row?.code,ok:false,message:error.message});}
        if(!cancelled&&$('#auditBatchProgress'))$('#auditBatchProgress').textContent=`ตรวจแล้ว ${results.length}/${snapshot.length}`;
      }
      await onComplete();
      if(cancelled)return toast(`บันทึกสำเร็จ ${results.filter(r=>r.ok).length} รายการ — หยุดรายการที่เหลือแล้ว`);
      openModal('ผลบันทึกสถานะ',`<p>สำเร็จ ${results.filter(r=>r.ok).length}/${snapshot.length} รายการ</p>${results.map(r=>`<p>${h(r.code)} — ${h(r.message)}</p>`).join('')}`,'<button id="auditBatchDone" class="primary-button">เสร็จสิ้น</button>');
      $('#auditBatchDone').onclick=closeModal;
    } finally {auditStatusBatchRunning=false;}
  };
}
function confirmBulkCaseClose(rows, {company, date, onComplete}) {
  if (!can("approve")) return deny("ปิดเคส");
  if (bulkCaseApprovalRunning || !rows.length || state.dataset !== "production") return;
  const snapshot = JSON.parse(JSON.stringify(rows));
  const total = snapshot.reduce((sum,row)=>sum+Math.round(Number(row.system_amount)*100),0)/100;
  openModal(`ยืนยันปิด ${num(snapshot.length)} เคสที่เลือก`,
    `<p>${h(company)} · ${h(date)} · รวม ${money(total)} บาท</p><p>ตรวจอ้างอิง BO/PM ยอด ตัวตน และคู่ซ้ำอีกครั้ง โดยยอมรับเวลาต่างหรือข้ามวันก่อนบันทึกแต่ละรายการ เคสที่เปลี่ยนสถานะหรือมีหลักฐานเชื่อมโยงจะข้ามไว้ ไม่ส่งข้อความและไม่บันทึกความเสียหาย</p><details><summary>รายการที่เลือก</summary>${snapshot.map(row=>`<p>${h(row.code || row.id)} · ${money(row.system_amount)} บาท</p>`).join('')}</details><p id="bulkCaseProgress" role="status"></p>`,
    '<button id="bulkCaseCancel" class="ghost-button">ยกเลิก</button><button id="bulkCaseConfirm" class="primary-button">ยืนยันอนุมัติและปิดรายการที่ผ่านเกณฑ์</button>');
  let cancelled = false;
  $("#modal")._contentCleanup = () => { cancelled = true; };
  $("#bulkCaseCancel").onclick = closeModal;
  $("#bulkCaseConfirm").onclick = async () => {
    if (bulkCaseApprovalRunning) return;
    bulkCaseApprovalRunning = true;
    $("#bulkCaseConfirm").disabled = true;
    $("#bulkCaseCancel").textContent = 'หยุดรายการที่เหลือ';
    try {
      const results = await BulkCaseReview.run(snapshot,{company,date},{
        allowed:()=>can('approve') && Sb.signedIn(), cancelled:()=>cancelled,
        load:Sb.reconciliationOverview, candidates:PreliminaryReview.manualCandidates,
        links:id=>Sb.evidenceCaseRecommendations({caseId:id}),
        progress:(done,count)=>{if(!cancelled && $('#bulkCaseProgress')) $('#bulkCaseProgress').textContent=`ตรวจแล้ว ${done}/${count} รายการ`;},
        save:async row=>{
          const e=mapLiveException(row);e.id=row.id;
          const note=`Audit ยืนยันแบบหลายรายการ — คู่ BO/PM ยอดและตัวตนตรง ไม่ซ้ำ ยอมรับเวลาต่างหรือข้ามวัน; ยอด ${e.systemAmount} บาท; เวลา ${exceptionTimeDiffLabel(e)}; BO: ${e.boRaw}; PM: ${e.stmRaw}`;
          return persistCaseClosure(e,note);
        },
      });
      const closed=results.filter(r=>r.status==='closed'), skipped=results.filter(r=>r.status!=='closed');
      await onComplete();
      if(cancelled) return toast(`ปิดแล้ว ${closed.length} เคส · ไม่ปิด ${skipped.length} เคส`);
      openModal('ผลอนุมัติรายการที่เลือก',`<p role="status">ปิดแล้ว ${closed.length} เคส · ${money(closed.reduce((n,r)=>n+r.amount,0))} บาท · ไม่ปิด ${skipped.length} เคส</p>${results.map(r=>`<p>${h(r.code)} — ${r.status==='closed'?'ปิดเคสแล้ว':h(r.reason)}</p>`).join('')}`, '<button id="bulkCaseDone" class="primary-button">เสร็จสิ้น</button>');
      $('#bulkCaseDone').onclick=closeModal;
    } catch(error) { toast('ตรวจผลล่าสุดไม่สำเร็จ: '+error.message+' — กรุณารีเฟรชก่อนลองใหม่','warn'); }
    finally { bulkCaseApprovalRunning=false; }
  };
}

function confirmQuickClose(e) {
  if (!can("approve")) return deny("ปิดเคส");
  if (!isQuickCloseEligible(e)) return toast("เคสนี้ยังปิดด่วนไม่ได้ กรุณาตรวจรายละเอียดก่อน", "warn");
  openModal(
    `ยืนยันปิดเคส ${h(e.id)}`,
    `<div class="quick-close-box"><strong>พบข้อมูลครบทั้งสองฝั่งและยอดตรงกัน</strong><div class="quick-close-grid"><div><span>STM / ธนาคาร</span><b>${money(e.bankAmount)}</b></div><div><span>BO / ระบบ</span><b>${money(e.systemAmount)}</b></div><div><span>ผลต่างยอด</span><b>${money(Number(e.systemAmount) - Number(e.bankAmount))}</b></div><div><span>ผลต่างเวลา</span><b>${h(exceptionTimeDiffLabel(e))}</b></div></div><small>ระบบจะบันทึกผู้ยืนยัน เวลา และเหตุผลไว้ใน Audit Log การปิดนี้เป็นการตัดสินใจของผู้ตรวจ ไม่ใช่การปิดอัตโนมัติ</small></div>`,
    `<button class="ghost-button" id="quickCloseCancel">กลับไปตรวจ</button><button class="primary-button" id="quickCloseConfirm">ยืนยันยอดตรงและปิดเคส</button>`,
  );
  $("#quickCloseCancel").addEventListener("click", closeModal);
  $("#quickCloseConfirm").addEventListener("click", () => completeQuickClose(e));
}

/* ---------------- shell rendering ---------------- */
function scopedWorkflowMetrics() {
  const inScope = (row) => {
    const date = row?.business_date || row?.date || "";
    return row
      && isLiveCompanyRow(row)
      && canAccessCompany(row.company)
      && (!state.filters.from || date >= state.filters.from)
      && (!state.filters.to || date <= state.filters.to)
      && (state.filters.company === "ALL" || normalizeLiveCompanyCode(row.company) === normalizeLiveCompanyCode(state.filters.company));
  };
  const qualityRows = (liveOverviewState.quality || []).filter(inScope).filter((row) => row.run_id && !row.is_archived);
  const currentCounts = (liveOverviewState.caseCounts || []).filter(inScope);
  const aggregateOpen = currentCounts.reduce((sum, row) => sum + Number(row.open_count || 0), 0);
  const loadedOpen = DB.exceptions.filter((row) => inScope(row) && !["closed", "approved"].includes(row.status)).length;
  const countsReady = Array.isArray(liveOverviewState.caseCounts) && !hasLiveCoreError("ยอดเคสชุดปัจจุบัน");
  return {
    openAvailable: countsReady || liveOverviewState.exceptionsReady,
    open: countsReady ? aggregateOpen : loadedOpen,
    approvalsAvailable: liveOverviewState.exceptionsReady && (state.dataset !== 'production' || (ManualPairing.queueState.rows !== null && CaseClosure.queueState.rows !== null && CrossDayWorkbench.queueState.rows !== null)),
    approvals: DB.exceptions.filter((row) => inScope(row) && !row.closureRequestId && row.status === 'damage').length + (state.dataset === 'production' ? (ManualPairing.queueState.rows?.length || 0) + (CaseClosure.queueState.rows?.length || 0) + (CrossDayWorkbench.queueState.rows?.length || 0) : new Set(DB.exceptions.filter(row=>row.status==='pair_pending').map(row=>row.manualPairId||row.id)).size),
    followUps: DB.exceptions.filter((row) => inScope(row) && !row.closureRequestId && !["closed", "approved"].includes(row.status) && ["clarifying", "answered", "damage"].includes(row.status)).length,
  };
}

function renderNav() {
  if(state.dataset==='production'&&Sb.signedIn()){ManualPairing.loadPending();CaseClosure.loadPending();CrossDayWorkbench.loadPending();}
  const allowed = ROUTE_ROLES[state.role];
  const workflow = scopedWorkflowMetrics();
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
              ${it.id === "exceptions" ? `<b class="nav-count">${workflow.openAvailable ? num(workflow.open) : "—"}</b>` : ""}
              ${it.id === "audit-review" ? `<b class="nav-count" title="เคสรอ Audit ตรวจในบริษัทและวันที่ที่เลือก">${liveOverviewState.exceptionsReady ? num(AuditReview.rows(DB.exceptions, {filters:state.filters,canAccessCompany}).length) : "—"}</b>` : ""}
              ${it.id === "approvals" ? `<b class="nav-count" title="คำขอจับคู่ทุกวันที่ตามสิทธิ์ รวมเคสชี้แจงแล้วในขอบเขตที่โหลด">${workflow.approvalsAvailable ? num(workflow.approvals) : "—"}</b>` : ""}
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
  const fileIssues = files.filter((file) => (file.parse_error && !statementNeedsBoReview(file)) || file.kind === "unknown").length;
  const fileReview = files.filter(statementNeedsBoReview).length;
  const fileWaiting = files.filter((file) => !file.parsed && !file.parse_error && !["unknown", "doc_clarify"].includes(file.kind)).length;
  const workflow = scopedWorkflowMetrics();
  const steps = [
    { route: "cloud", no: 1, label: "ตรวจไฟล์", meta: files.length ? `${num(files.length)} ไฟล์${fileIssues ? ` · ปัญหา ${num(fileIssues)}` : ""}${fileReview ? ` · รอเทียบ BO ${num(fileReview)}` : ""}${fileWaiting ? ` · รอระบบ ${num(fileWaiting)}` : fileIssues || fileReview ? "" : " · พร้อม"}` : "ตรวจไฟล์ที่ได้รับ", tone: fileIssues || fileReview ? "warn" : files.length ? "ok" : "" },
    { route: "dashboard", no: 2, label: "ดูภาพรวม", meta: "แยกตามบริษัท", tone: "" },
    { route: "exceptions", no: 3, label: "ตรวจข้อผิดปกติ", meta: workflow.openAvailable ? `${num(workflow.open)} เคสเปิด` : "กำลังโหลดยอดเคส", tone: !workflow.openAvailable ? "" : workflow.open ? "warn" : "ok" },
    { route: "clarify", no: 4, label: "ติดตาม/อนุมัติ", meta: workflow.approvalsAvailable ? `${num(workflow.followUps)} งาน` : "กำลังโหลดงานติดตาม", tone: !workflow.approvalsAvailable ? "" : workflow.followUps ? "warn" : "ok" },
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
  const unread = files.filter((file) => (file.parse_error && !statementNeedsBoReview(file)) || file.kind === "unknown");
  const needsBoReview = files.filter(statementNeedsBoReview);
  const waiting = (liveOverviewState.checklist || []).filter((row) => ["missing_files", "missing_required", "waiting_files", "parse_error"].includes(row.checklist_status));
  const workflow = scopedWorkflowMetrics();
  if (unread.length) return { route: "cloud", label: `ตรวจไฟล์ที่มีปัญหา ${num(unread.length)} ไฟล์`, detail: "กดดูรายชื่อไฟล์ปัญหาทั้งหมดและสาเหตุก่อน แล้วค่อยเปิดตรวจทีละรายการ", tone: "bad" };
  if (needsBoReview.length) return { route: "cloud", label: `เทียบ BO สำหรับไฟล์ที่อ่านแล้ว ${num(needsBoReview.length)} ไฟล์`, detail: "ไม่พบรายการในวันตรวจ ไม่ใช่ไฟล์เสีย — ตรวจบัญชีและวันกับ BO ก่อนสรุป ไม่ต้องรันไฟล์เดิมซ้ำ", tone: "warn" };
  if (waiting.length) return { route: "daily-summary", label: `ดูรายการที่ยังขาด ${num(waiting.length)} บริษัท/วัน`, detail: "ตรวจ Checklist แล้วตาม STM หรือ BO ที่ยังไม่ครบ", tone: "warn" };
  if (workflow.approvalsAvailable && workflow.approvals && can('approve')) return { route: "approvals", label: `ตรวจคำชี้แจง / คำขออนุมัติ ${num(workflow.approvals)} งาน`, detail: "เปิดเคสและเอกสารที่ผูกไว้ ตรวจหลักฐานก่อนอนุมัติ", tone: "warn" };
  const auditWaiting = AuditReview.rows(DB.exceptions, { filters: state.filters, canAccessCompany }).length;
  if (auditWaiting && ROUTE_ROLES[state.role].includes('audit-review')) return { route: 'audit-review', label: `Audit รอตรวจ ${num(auditWaiting)} เคส`, detail: 'ตรวจคำตอบและหลักฐานในเคสเดิมก่อนส่งหัวหน้า', tone: 'warn' };
  if (workflow.followUps) return { route: "clarify", label: `ติดตามคำชี้แจง ${num(workflow.followUps)} งาน`, detail: "ติดตามคำตอบและหลักฐานจากผู้ชี้แจง", tone: "warn" };
  if (workflow.openAvailable && workflow.open) return { route: "exceptions", label: `ตรวจรายการผิดปกติ ${num(workflow.open)} เคส`, detail: "เปิดหลักฐาน ตรวจยอดต่าง และส่งติดตามคำชี้แจง", tone: "warn" };
  if (!workflow.openAvailable) return { route: "dashboard", label: "กำลังตรวจยอดเคสจากฐานข้อมูล", detail: "ยังไม่สรุปว่างานหมดจนกว่าจะโหลดยอดจริงสำเร็จ", tone: "warn" };
  return { route: "reports", label: "ดูสรุปและออกรายงาน", detail: "งานที่ต้องดำเนินการหมดแล้ว ตรวจรายวันและ Export หลักฐาน", tone: "ok" };
}

function renderNextAction(root) {
  if (state.route === "mc8-sheets") return;
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
  if (!route || !route.filters || (state.route === "exceptions" && state.dataset === "production" && Sb.signedIn())) {
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
      <div><strong>1. เลือกข้อมูลที่จะตรวจ</strong><span>${h(rangeLabel())} · ${h(companyLabel)} · ${h(directionLabel)}</span></div>
      <button class="ghost-button xs" id="filterToggle" type="button" aria-expanded="${state.filtersOpen}">${state.filtersOpen ? "ย่อ" : "ปรับตัวกรอง"}</button>
    </div>
    <div class="filter-fields" ${state.filtersOpen ? "" : "hidden"}>
      <label>วันที่ตั้งต้นของช่วง
        <input type="date" id="fDate" value="${f.date}" min="${VISIBLE_DATE_FROM}" max="${VISIBLE_DATE_TO}" />
      </label>
      <label>เลือกช่วงวันที่
        <select id="fPreset">
          ${DATE_PRESETS.map((p) => `<option value="${p.code}" ${f.preset === p.code ? "selected" : ""}>${h(p.name)}</option>`).join("")}
        </select>
      </label>
      <label>วันเริ่มต้น
        <input type="date" id="fFrom" value="${f.from}" min="${VISIBLE_DATE_FROM}" max="${f.to}" />
      </label>
      <label>วันสิ้นสุด
        <input type="date" id="fTo" value="${f.to}" min="${f.from}" max="${VISIBLE_DATE_TO}" />
      </label>
      <label>บริษัท
        <select id="fCompany">
          <option value="ALL">ทุกบริษัท</option>
          ${companyMaster().map((c) => `<option value="${c.code}" ${f.company === c.code ? "selected" : ""}>${h(c.name)}</option>`).join("")}
        </select>
      </label>
      <label>ธุรกรรม / ช่องทาง
        <select id="fDirection">
          <option value="ALL">ฝากและถอน · ทุกช่องทาง</option>
          <option value="PM" ${f.direction === "PM" ? "selected" : ""}>เฉพาะ Payment (PM)</option>
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
  if (state.dataset === 'production' && Sb.signedIn() && (!liveOverviewState.exceptionsReady || liveOverviewState.key !== `${state.filters.from}|${state.filters.to}|${state.filters.company}`)) {
    $('#filterSummary').innerHTML = `ช่วงข้อมูล <b>${h(rangeLabel())}</b> · รายการเคส <b>—</b> · SLA <b>—</b> · ยอด <b>—</b> · กำลังรอข้อมูลจริง ไม่ใช่ศูนย์`;
    return;
  }
  if (state.dataset === 'production' && state.route === 'clarify' && state.role === 'shift_lead') {
    $('#filterSummary').innerHTML = `ช่วงข้อมูล <b>${h(rangeLabel())}</b> · คิวคำขอที่ Audit ส่งมา <b>${num(scoped.length)}</b> เคสในบริษัทที่เลือก · ไม่ใช่ยอดกระทบยอดหรือความเสียหาย`;
    return;
  }
  if (typeof fastReviewQueueMode === 'function' && fastReviewQueueMode()) {
    $('#filterSummary').innerHTML = `ช่วงข้อมูล <b>${h(rangeLabel())}</b> · รายการเคสที่โหลดในบริษัทที่เลือก <b>${num(scoped.length)}</b> · ไม่ใช่ยอดรวมการเงินหรือความเสียหาย`;
    return;
  }
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
const sourceWorkspaceScope={company:null,date:null};
function renderSourceWorkspace(host,page){
 if(state.dataset!=='production'||!Sb.signedIn()){host.innerHTML='<section class="panel">หน้านี้ใช้ทะเบียนจริงหลังเข้าสู่ระบบ ไม่มีข้อมูลจำลอง</section>';return;}
 const companies=MC8LiveSheets.COMPANIES.filter(canAccessCompany);if(!companies.length){host.innerHTML='<section class="panel">ไม่มีสิทธิ์บริษัท</section>';return;}
 if(!companies.includes(sourceWorkspaceScope.company))sourceWorkspaceScope.company=companies.includes(state.filters.company)?state.filters.company:companies.includes(state.dailySummary.company)?state.dailySummary.company:companies[0];
 sourceWorkspaceScope.date=sourceWorkspaceScope.date||state.dailySummary.date||state.filters.to||PROD_TODAY;
 const scope=(company,date)=>Object.assign(sourceWorkspaceScope,{company,date});
 const controller=SourceWorkspace.mount(host,{page,company:sourceWorkspaceScope.company,date:sourceWorkspaceScope.date,companies,
 role:()=>state.role,actor:()=>Sb.authUser()?.id,active:()=>Sb.signedIn()&&state.route===`source-${page==='upload'?'upload':'run'}`,
 load:Sb.sourceWorkspace,add:Sb.addAuditManualSource,confirm:FileRunManagement.confirmAction,scope,
 navigate:(route,company,date)=>{scope(company,date);go(route);},
 manage:(company,date,fileId,onUpdated)=>openFileRunManagement({company,date,accounts:[],fileId,onUpdated}),
 preview:file=>openStoredFilePreview({path:file.storage_path,name:file.file_name,mime:file.mime_type,id:file.id,kind:file.kind,company:file.company,date:file.business_date,size:file.size_bytes}),
 run:(company,date,fileIds)=>openAccountRecheck({company,date,accounts:[],fileIds})});
 host.sourceWorkspaceDispose=()=>controller.dispose();
}
VIEWS['source-upload']=host=>renderSourceWorkspace(host,'upload');
VIEWS['source-run']=host=>renderSourceWorkspace(host,'run');
VIEWS['mail-intake']=host=>MailIntakeControl.mount(host,{api:Sb,role:state.role,today:PROD_TODAY,isActive:()=>state.route==='mail-intake'&&Sb.signedIn(),notify:toast});
VIEWS.finance=root=>{
 if(state.dataset!=='production'||!Sb.signedIn()) {root.innerHTML='<section class="panel">รายงานนี้ใช้ข้อมูลจริงหลังเข้าสู่ระบบเท่านั้น ไม่มีตัวเลขตัวอย่าง</section>';return;}
 FinanceExecutive.mount(root,{role:()=>state.role,actor:()=>Sb.authUser()?.id,active:()=>state.route==='finance'&&Sb.signedIn(),today:PROD_TODAY,
  context:Sb.financeReportingCompanies,bo:Sb.financeReportBoWindow,cases:Sb.financeCaseReport,formatTime:displayTime,saveBlob:Exporter.saveBlob,buildWorkbook:XlsxWriter.build,archive:XlsxWriter.archive,
  boManifest:Sb.financeBoReportManifest,acceptBoReport:Sb.acceptFinanceBoReport,boHistory:Sb.financeBoReportHistory,
  boDownload:async file=>{if(state.route!=='finance'||!['lead','admin'].includes(state.role)||!canAccessCompany(file.company))throw Error('ไม่มีสิทธิ์อ่าน BO รายงาน');return Sb.download(file.storage_path,{force:true});},
  boReadXlsx:async bytes=>{const sheets=(await XlsxReader.readWorkbook(bytes,{includeMetadata:true})).filter(s=>s.rows.some(r=>r.some(v=>String(v??'').trim())));if(sheets.length!==1)throw Error('BO หลายชีต/ไม่มีชีตข้อมูล ต้องทบทวนขอบเขตรายงานก่อน ไม่อ่านแค่ชีตแรก');return sheets[0];},boParse:Formats.parse,boSha256:async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join(''),
  holds:Sb.reviewHoldReport,actions:Sb.financeActionReport,actionCase:Sb.financeActionCase,findActionCase:Sb.findFinanceActionCase,saveAction:Sb.saveFinanceAction,uploadAction:Sb.uploadFinanceActionEvidence,actionUrl:Sb.financeActionUrl});
};
function openAccountRecheck({company,date,accounts,fileIds=null,initialJobId=null,onPrimaryReady=null}) {
  if(state.dataset!=='production'||!Sb.signedIn()||!canAccessCompany(company))return deny('ตรวจเฉพาะบัญชี');
  openModal('ตรวจซ้ำ / กระทบยอดเฉพาะบัญชี', '<div id="accountRecheckPanel"></div>', '<button id="accountRecheckDismiss">ปิดหน้าทบทวน</button>');
  const dispose=AccountRecheck.mount($('#accountRecheckPanel'),{
    company,date,accounts:['ALL',...accounts.filter(a=>a!=='ALL')],fileIds,initialJobId,role:()=>state.role,actor:()=>Sb.authUser()?.id,
    request:Sb.requestAccountRecheck,list:Sb.listAccountRechecks,loadState:Sb.fileRunManagement,confirm:Sb.confirmAccountRecheck,
    detail:Sb.accountRecheckDetail,exportWorkbook:Exporter.workbook,
    finalConfirmation:AccountRecheck.finalConfirmation,
    onPrimary:id=>ManualPrimary.open(id,{actor:()=>Sb.authUser()?.id,role:()=>state.role,
      preview:Sb.manualPrimaryPreview,accept:Sb.acceptManualPrimaryWithCases,withCases:true,
      onAccepted:async value=>{
        toast(`ใช้ผลตรวจมือเป็นผลหลักและเตรียมเคสพร้อมดำเนินการแล้ว ${value?.case_set?.case_count??0} เคส`,'ok');
        dispose();closeModal();
        if(onPrimaryReady)await onPrimaryReady();
        else { await loadLiveOverview(true); render(); }
      }}),
  });
  $('#modal')._contentCleanup=dispose;
  $('#accountRecheckDismiss').onclick=()=>{dispose();closeModal();};
}
async function reparseStoredAuditSource(file){
  const actor=Sb.authUser()?.id;
  if(!actor||!file?.id||!file.storage_path||!file.revision)throw Error('ข้อมูลไฟล์หรือสิทธิ์ไม่ครบ กรุณาโหลดสถานะล่าสุด');
  if(!/\.(?:xlsx?|xlsm|csv|pdf)$/i.test(String(file.file_name||'')))throw Error('ไฟล์ชนิดนี้ต้องอ่านผ่าน Worker ยังอ่านใหม่จากหน้านี้ไม่ได้');
  const savedFiles=ImportState.files.slice();
  let norm;
  try{
    const bytes=await Sb.download(file.storage_path);
    if(Sb.authUser()?.id!==actor)throw Error('ผู้ใช้เปลี่ยน กรุณาเปิดหน้าจัดการไฟล์ใหม่');
    norm=await ingestRaw(file.file_name,bytes,bytes.byteLength,{fileId:file.physical_source_file_id||file.id,storagePath:file.storage_path,businessDate:file.business_date});
    const rowCount=(norm.records||[]).length+(norm.aux||[]).length;
    if(!rowCount&&file.kind!=='pm_statement')throw Error('อ่านไฟล์แล้วไม่พบรายการที่ใช้ตรวจได้');
    const receipt=await Sb.recordAuditSourceReparse({fileId:file.id,expectedRevision:file.revision,expectedChecksum:file.checksum,
      parserVersion:'ui-source-reparse-20261026',rowCount,parseError:null,
      quality:{complete:true,records:(norm.records||[]).length,aux:(norm.aux||[]).length,warnings:norm.warnings||[],dropped:norm.dropped||{}}});
    if(!receipt?.parsed||receipt.file_id!==file.id||Number(receipt.row_count)!==rowCount)throw Error('เซิร์ฟเวอร์ยังไม่ยืนยันผลอ่านไฟล์ กรุณาโหลดสถานะก่อนลองใหม่');
    return receipt;
  }catch(error){
    if(norm===undefined&&Sb.authUser()?.id===actor){
      await Sb.recordAuditSourceReparse({fileId:file.id,expectedRevision:file.revision,expectedChecksum:file.checksum,
        parserVersion:'ui-source-reparse-20261026',rowCount:0,parseError:String(error?.message||'อ่านไฟล์ไม่สำเร็จ').slice(0,2000),quality:{complete:false}}).catch(()=>{});
    }
    throw error;
  }finally{ImportState.files=savedFiles;}
}
async function openFileExclusion(fileId) {
  if(state.dataset!=='production'||!Sb.signedIn()||!FileExclusion.canManage(state.role))return deny('ยกเว้นไฟล์จากการรัน');
  return FileExclusion.open({fileId,role:()=>state.role,actor:()=>Sb.authUser()?.id,
    preview:Sb.sourceExclusionPreview,save:Sb.setSourceExcluded,confirm:FileRunManagement.confirmAction});
}
function openFileRunManagement({company,date,accounts,fileId=null,onUpdated=null}) {
  if(state.dataset!=='production'||!Sb.signedIn()||!canAccessCompany(company))return deny('จัดการไฟล์/พักรัน');
  openModal('เลือกไฟล์ / แก้ข้อมูล / พักรัน','<div id="fileRunManagementPanel"></div>','<button id="fileRunManagementDismiss">ปิด</button>');
  const dispose=FileRunManagement.mount($('#fileRunManagementPanel'),{
    company,date,initialFileId:fileId,onUpdated,role:()=>state.role,load:Sb.fileRunManagement,history:Sb.sourceRevisionHistory,
    companies:MC8LiveSheets.COMPANIES.filter(canAccessCompany),actor:()=>Sb.authUser()?.id,
    setHold:Sb.setAuditRunHold,correct:Sb.correctAuditSource,reparse:reparseStoredAuditSource,
    onExclude:openFileExclusion,
    searchSources:Sb.effectiveAuditFiles,addSource:Sb.addAuditManualSource,
    confirmAddition:b=>FileRunManagement.confirmAction({title:'ทบทวนเพิ่มไฟล์ในรอบตรวจ',message:`${b.name}\nบริษัท ${b.company} · วันอ้างอิง ${b.date}\n${b.reason}\nเพิ่มไฟล์โดยเก็บต้นฉบับและตรวจไฟล์ซ้ำ พักบอทรอบนี้ ยังไม่รัน ไม่ใช้ผลหลักหรือเปลี่ยนเคส`,confirmLabel:'ยืนยันเพิ่มไฟล์ · ไม่รัน',allowed:()=>Sb.signedIn()&&FileRunManagement.canManage(state.role)&&canAccessCompany(company)}),
    confirmHold:b=>FileRunManagement.confirmAction({title:`${b.paused?'พัก':'เปิด'}บอทรอบหลัก · ${company} · ${date}`,message:`${b.reason}\nไม่แก้ยอดหรือปิดเคส\nการพักบอทไม่เริ่มรันมือให้เอง`,confirmLabel:b.paused?'ยืนยันพักบอท':'ยืนยันเปิดบอท',allowed:()=>Sb.signedIn()&&FileRunManagement.canManage(state.role)&&canAccessCompany(company)}),
    uploadCorrection:Sb.uploadAuditSourceCorrection,
    onFile:file=>openStoredFilePreview({path:file.storage_path,name:file.file_name,mime:file.mime_type,id:file.id,kind:file.kind,company:file.company,date,size:file.size_bytes}),
    confirmCorrection:b=>FileRunManagement.confirmAction({title:'ทบทวนแก้วัน/ข้อมูลไฟล์',message:`${b.name}\nบริษัท ${b.company} · วันอ้างอิง ${b.date}\n${b.reason}\nเก็บต้นฉบับ เพิ่มเวอร์ชันใหม่ และพักบอทรอบที่เกี่ยวข้อง ไม่รันหรือยืนยันผลหลัก`,confirmLabel:'ยืนยันบันทึกเวอร์ชันใหม่',allowed:()=>Sb.signedIn()&&FileRunManagement.canManage(state.role)&&canAccessCompany(company)}),
    confirmReparse:file=>FileRunManagement.confirmAction({title:'อ่านไฟล์เดิมใหม่จากหน้าระบบ',message:`${file.file_name}\nบริษัท ${file.company} · วันอ้างอิง ${file.business_date}\nอ่านด้วยกฎปัจจุบันและบันทึกเฉพาะผล Parse ไม่กระทบยอด ไม่สร้างหรือปิดเคส และไม่เปลี่ยนผลหลัก`,confirmLabel:'ยืนยันอ่านไฟล์ใหม่',allowed:()=>Sb.signedIn()&&FileRunManagement.canManage(state.role)&&canAccessCompany(company)}),
    confirmRunWarnings:b=>FileRunManagement.confirmAction({title:`ทบทวนคำเตือน · ${b.company} · ${b.date}`,message:`พบคำเตือน ${b.warnings.length} รายการ\n${b.warnings.map(w=>[w.file_name,w.detail].filter(Boolean).join(' · ')).join('\n')}\nไปทบทวนขอบเขตรันตรวจมือเท่านั้น ยังไม่รันจนกดยืนยันในขั้นถัดไป ไม่เปิดบอท ไม่ยืนยันผลหลักหรือส่งชี้แจง`,confirmLabel:'ไปเลือกขอบเขต · ยังไม่รัน',allowed:()=>Sb.signedIn()&&canAccessCompany(company)}),
    onRun:async fileIds=>{
      try{let choices=accounts||[];
        // Selected sources are enough to open an ALL-account staged recheck.
        // A stale primary must block acceptance, not the rerun needed to review it.
        if(!choices.length&&!fileIds?.length){const data=await Sb.reconciliationOverview(company,date);choices=[...new Set([...(data.run?.summary?.match_evidence||[]).map(r=>r.account),...(data.cases||[]).map(r=>r.account),...(data.run?.summary?.bo_first?.required||[]).map(r=>r.identity)].filter(a=>a&&String(a).toUpperCase()!=='UNKNOWN'))];}
        dispose();closeModal();openAccountRecheck({company,date,accounts:choices,fileIds});
      }catch(error){toast(error.message,'bad');}
    },
  });
  $('#modal')._contentCleanup=dispose;
  $('#fileRunManagementDismiss').onclick=()=>{dispose();closeModal();};
}
function chooseFileRunManagement(){
  const companies=MC8LiveSheets.COMPANIES.filter(canAccessCompany),company=companies.includes(state.filters.company)?state.filters.company:companies[0];
  openModal('เลือกขอบเขตจัดการไฟล์ / พักรัน',`<label>บริษัท<select id="fileManageCompany">${companies.map(c=>`<option ${c===company?'selected':''}>${h(c)}</option>`).join('')}</select></label><label>วันที่<input type="date" id="fileManageDate" value="${h(state.filters.to||state.filters.date||DEFAULT_WORK_DATE)}"></label>`,'<button id="fileManageContinue">เปิดไฟล์/สถานะของวัน</button>');
  $('#fileManageContinue').onclick=()=>{const company=$('#fileManageCompany').value,date=$('#fileManageDate').value;if(!company||!/^\d{4}-\d{2}-\d{2}$/.test(date))return toast('เลือกบริษัทและวันที่ให้ครบ','warn');closeModal();openFileRunManagement({company,date,accounts:[]});};
}
function openAuditSourceArchive(){
  if(state.dataset!=='production'||!Sb.signedIn())return deny('ดาวน์โหลดไฟล์จริง');
  const companies=MC8LiveSheets.COMPANIES.filter(canAccessCompany),initialActor=Sb.authUser()?.id;
  openModal('ดาวน์โหลดไฟล์จริง — เผื่อทำงานมือ','<div id="auditSourceArchivePanel"></div>','<button id="auditArchiveCancel">ปิด / ยกเลิกการเตรียม</button>');
  $('#modal').classList.add('source-archive-modal');
  const dispose=AuditSourceArchive.mount($('#auditSourceArchivePanel'),{
    company:companies.includes(state.filters.company)?state.filters.company:companies[0],date:state.filters.to||state.filters.date||DEFAULT_WORK_DATE,companies,initialActor,
    actorId:()=>Sb.authUser()?.id,catalog:Sb.auditSourceArchiveManifest,download:path=>Sb.download(path,{force:true}),
    validate:Sb.auditSourceArchiveValidate,
    access:async()=>{const result=await Sb.myAccess();return Array.isArray(result)?result[0]:result;},
    sha256:async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join(''),
    zip:XlsxWriter.archive,save:Exporter.saveBlob,
  });
  $('#modal')._contentCleanup=()=>{dispose();$('#modal').classList.remove('source-archive-modal');};
  $('#auditArchiveCancel').onclick=()=>{dispose();closeModal();};
}
async function readAuditBoOperatorRecords(file,date) {
  if(state.dataset!=='production'||!Sb.signedIn()||file.kind!=='bo_main'||!canAccessCompany(file.company))throw new Error('ไม่มีสิทธิ์อ่าน BO ต้นทาง');
  if(!/\.xlsx$/i.test(file.file_name))throw new Error('ไฟล์ BO นี้ไม่ใช่ XLSX ที่รองรับ');
  const response=await fetch(await Sb.signedUrl(file.storage_path));
  if(!response.ok)throw new Error('ดาวน์โหลด BO ไม่สำเร็จ ('+response.status+')');
  const result=Formats.parse(file.file_name,await XlsxReader.read(await response.arrayBuffer()),date);
  if(!['bo_compact','bo_transaction_export','bo_main'].includes(result.code))throw new Error('ไม่พบรูปแบบ BO ที่ตรวจสอบได้');
  return [...result.records,...(result.aux||[]).filter(r=>r.kind==='xb_information')];
}
async function openManualPrimaryCaseSet(id,onReload){
  if(!['lead','admin'].includes(state.role))return deny('ยืนยันเคสชุดใหม่');
  return PrimaryCaseSets.open(id,{actor:()=>Sb.authUser()?.id,role:()=>state.role,preview:Sb.manualPrimaryCasesPreview,activate:Sb.activateManualPrimaryCases,onActivated:()=>{toast('สร้างเคสชุดใหม่แล้ว เก็บเคสเดิมเป็นประวัติ');onReload?.();}});
}
VIEWS["mc8-sheets"] = root => MC8LiveSheets.mount(root, {
  date: state.filters.date || DEFAULT_WORK_DATE,
  company: MC8LiveSheets.COMPANIES.includes(state.dailySummary.company) ? state.dailySummary.company : 'MC8',
  companies: MC8LiveSheets.COMPANIES,
  signedIn: () => state.dataset === 'production' && Sb.signedIn(),
  load: Sb.reconciliationOverview,
  loadFiles: runId => Sb.exceptionFiles(runId),
  readBoRecords: readAuditBoOperatorRecords,
  onRecheck: openAccountRecheck,
  onManageFiles: openFileRunManagement,
  exportBoWaitingCases: downloadBoWaitingCaseRequest,
  onNextCaseQueue: can('request_clarify') ? scope=>showReadOnlyCaseQueue({...scope,account:''}) : null,
  isActive: () => state.route === 'mc8-sheets',
  onLocal: () => MC8Sheets.render(root),
  onCompany: company => { state.dailySummary.company = company; },
  onDate: date => { state.filters.date = date; },
  onCase: async (row) => {
    if (!row?.id) throw new Error('ไม่พบ UUID ของเคสจริง');
    await openEvidenceRelatedCase(row.id);
  },
  onNewCaseSet: ['lead','admin'].includes(state.role)?openManualPrimaryCaseSet:null,
  onCaseError: (error) => toast('เปิดเคสจริงไม่สำเร็จ: ' + (error?.message || 'ไม่ทราบสาเหตุ'), 'warn'),
  onFile: (file,date,company) => { if(file?.storage_path) openStoredFilePreview({path:file.storage_path,name:file.file_name,mime:file.mime_type,id:file.id,kind:file.kind,company:file.company||company,date,size:file.size_bytes,status:file.parse_error?'error':file.parsed?'parsed':'waiting'}); },
  exportWorkbook: (sheets, filename, meta) => Exporter.workbook(sheets, filename, meta),
  onExported: ({filename,company,date,rows,sheets,complete}) => {
    logAction('export', 'audit_reconciliation_workbook', `${company}|${date}`, `Excel ${sheets} ชีต · ${rows} แถว · ${complete?'ข้อมูลรอบครบ':'ข้อมูลรอบยังไม่ครบ'}`);
    toast(`ดาวน์โหลด ${filename} แล้ว (${sheets} ชีต · ${num(rows)} แถว)`);
  },
});
function showLoginGate(message) {
  $('#accessWaitNotice')?.remove?.();
  $('#appShell').inert = false;
  for (const id of ['#drawer', '#modal', '#drawerOverlay', '#modalOverlay']) {
    const node = $(id); if (node) { node.inert = false; node.hidden = true; }
  }
  $('#connectionGate').hidden = true;
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

function showConnectingGate(message, retryAction, preserveWork = false) {
  const shell = $('#appShell');
  $('#accessWaitNotice')?.remove?.();
  if (preserveWork) {
    // Keep the authenticated DOM/drafts, but never admit writes on stale access.
    shell.inert = true;
    for (const id of ['#drawer', '#modal']) { const node = $(id); if (node) node.inert = true; }
    const notice = document.createElement('aside');
    notice.id = 'accessWaitNotice';
    notice.className = 'alert warn';
    notice.setAttribute('role', 'status');
    const text = document.createElement('span');
    text.textContent = message;
    notice.append(text);
    if (retryAction) {
      const retry = document.createElement('button');
      retry.textContent = 'ตรวจสิทธิ์อีกครั้ง';
      retry.onclick = async () => { retry.disabled = true; try { await retryAction(); } finally { retry.disabled = false; } };
      notice.append(retry);
    }
    shell.before(notice);
    $('#connectionGate').hidden = true;
    return;
  }
  shell.inert = false;
  for (const id of ['#drawer', '#modal']) { const node = $(id); if (node) { node.inert = false; node.hidden = true; } }
  $('#loginGate').hidden = true;
  $('#appShell').hidden = true;
  $('#connectionGate').hidden = false;
  $('#connectionMessage').textContent = message || 'กำลังคืนสถานะเข้าสู่ระบบและตรวจสิทธิ์ กรุณารอสักครู่ ไม่ต้องเข้าสู่ระบบซ้ำ';
  const retry = $('#accessCheckRetry');
  retry.hidden = !retryAction;
  retry.disabled = false;
  retry.onclick = retryAction ? async () => {
    if (retry.disabled) return;
    retry.disabled = true;
    try { await retryAction(); } finally { retry.disabled = false; }
  } : null;
}

function showPasswordResetGate() {
  $('#connectionGate').hidden = true;
  $("#appShell").hidden = true;
  $("#loginGate").hidden = false;
  $("#loginForm").hidden = true;
  $("#resetForm").hidden = false;
  $("#newPassword").focus();
}

function render() {
  state.filters.date = visibleDate(state.filters.date);
  state.filters.from = visibleDate(state.filters.from);
  state.filters.to = visibleDate(state.filters.to);
  if (state.filters.from > state.filters.to) state.filters.to = state.filters.from;
  state.dailySummary.date = visibleDate(state.dailySummary.date);
  const route = ROUTE_MAP[state.route];
  Charts.reset();
  $("#crumb").textContent = ROUTES.find((g) => g.items.some((i) => i.id === route.id)).group;
  $("#pageTitle").textContent = route.title;
  document.title = `${route.title} · Audit AI Reconciliation`;
  $("#pageDesc").innerHTML =
    h(route.desc) +
    (Sb.signedIn() ? ' <span class="badge green">ระบบข้อมูลจริง</span>' : "");
  renderNav();
  renderAuditFlow();
  renderFilters();
  captureFastQueueDrafts();
  $("#viewRoot").dataset.fastQueueDraftKey = fastQueueDraftKey();
  $("#viewRoot").financeDispose?.();
  $("#viewRoot").sourceWorkspaceDispose?.();
  $("#viewRoot").innerHTML = "";
  VIEWS[route.id]($("#viewRoot"));
  restoreFastQueueDrafts();
  $('#fileManageEntry')?.remove();
  $('#sourceArchiveEntry')?.remove();
  if(state.dataset==='production'&&Sb.signedIn()&&['cloud','intake','exceptions','daily-summary','mc8-sheets'].includes(route.id)&&['monitor','audit_assistant','lead','admin'].includes(state.role)){
    const entry=document.createElement('button');entry.id='fileManageEntry';entry.className='ghost-button';entry.textContent='รันมือ / จัดการไฟล์';entry.onclick=chooseFileRunManagement;$('#btnExport').parentElement.appendChild(entry);
    const backup=document.createElement('button');backup.id='sourceArchiveEntry';backup.className='ghost-button';backup.textContent='ดาวน์โหลดไฟล์จริง (ทำงานมือ)';backup.onclick=openAuditSourceArchive;$('#btnExport').parentElement.appendChild(backup);
    if(['cloud','intake'].includes(route.id)){
      const card=document.createElement('section');card.className='source-archive-launch';card.innerHTML='<div><h2>ดาวน์โหลดต้นฉบับไว้ทำกระทบยอดมือ</h2><p>เลือกบริษัทและวันที่ · ได้ ZIP แยกโฟลเดอร์ STM/PM, BO และหลักฐาน · ไม่รันบอทหรือเปลี่ยนเคส</p></div><button>ดาวน์โหลดไฟล์ต้นฉบับ</button>';card.querySelector('button').onclick=openAuditSourceArchive;$('#viewRoot').prepend(card);
      const manual=document.createElement('section');manual.className='source-archive-launch';manual.innerHTML='<div><h2>รันตรวจซ้ำ / จัดการไฟล์</h2><p>1 เลือกบริษัทและวัน → 2 เลือกไฟล์/บัญชี → 3 ตรวจและทบทวนผล · หัวหน้า/ผู้ดูแลยืนยันเท่านั้น<br>แก้ชื่อ/บริษัท/ฉบับแทน หรือพักรันได้ โดยเก็บต้นฉบับและประวัติ</p></div><button>เลือกไฟล์และรันตรวจซ้ำ</button>';manual.querySelector('button').onclick=chooseFileRunManagement;$('#viewRoot').prepend(manual);
    }
  }
  if (state.dataset === "production" && Sb.signedIn() && !["dashboard", "damage", "mc8-sheets", "finance"].includes(route.id)) {
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
  AuditUi.syncNav();
}

/* =============================================================
   VIEW: Dashboard
   ============================================================= */
const liveOverviewState = { daily: null, operations: null, quality: null, checklist: null, caseCounts: null, boFirst: null, settings: null, damages: null, logs: null, notifications: null, clarifications: null, informationalExceptions: [], matchEvidence: [], matchedStaleExceptions: 0, exceptionsReady: false, damagesReady: false, logsReady: false, loading: false, auxiliaryLoading: false, auxiliaryError: null, coreErrors: [], requestId: 0, error: null, key: "", updatedAt: null };
const liveExceptionSearch = { key: "", rows: [], loading: false, error: null };
const exceptionSupportCache = new Map();
const moreCaseState = { offset: 0, hasMore: true, loading: false, error: "" };

async function loadMoreCases() {
  if (moreCaseState.loading || liveOverviewState.loading || liveOverviewState.auxiliaryLoading) return;
  const key = liveOverviewState.key;
  const generation = liveOverviewState.requestId;
  moreCaseState.loading = true;
  moreCaseState.error = "";
  render();
  try {
    const rows = await Sb.currentExceptionsSummary({ from: state.filters.from, to: state.filters.to, company: state.filters.company, limit: 250, offset: moreCaseState.offset });
    if (key !== liveOverviewState.key || generation !== liveOverviewState.requestId) return;
    moreCaseState.offset += rows.length;
    moreCaseState.hasMore = rows.length === 250;
    const existing = new Map(DB.exceptions.map((row) => [row.dbId || row.id, row]));
    for (const raw of actionableAuditRows(rows,liveOverviewState.matchEvidence)) if (!existing.has(raw.id)) existing.set(raw.id, mapLiveException(raw));
    DB.exceptions = [...existing.values()];
  } catch (error) {
    if (key === liveOverviewState.key) moreCaseState.error = "โหลดเคสเพิ่มเติมไม่สำเร็จ: " + error.message;
  } finally {
    moreCaseState.loading = false;
    if (state.route === "exceptions") render();
  }
}

async function loadLiveExceptionSearch(term) {
  const key = `${term}|${state.filters.from}|${state.filters.to}|${state.filters.company}`;
  if (!term || liveExceptionSearch.loading || liveExceptionSearch.key === key) return;
  liveExceptionSearch.key = key;
  liveExceptionSearch.loading = true;
  liveExceptionSearch.error = null;
  liveExceptionSearch.rows = [];
  try {
    const rows = await Sb.searchExceptions({ term, from: state.filters.from, to: state.filters.to, company: state.filters.company, limit: 2000 });
    liveExceptionSearch.rows = actionableAuditRows(rows,liveOverviewState.matchEvidence).map(mapLiveException);
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
  completed: { label: "ระบบประมวลผลเสร็จ", tone: "green" },
  completed_review: { label: "กระทบยอดแล้ว · รอตรวจเคส", tone: "amber" },
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
const actionableAuditRows = (rows, evidence) => window.AuditVisiblePolicy ? window.AuditVisiblePolicy.filter(rows, evidence) : (Array.isArray(rows) ? rows : []);
const informationalAuditRows = (rows) => (Array.isArray(rows) ? rows : []).filter((row) => window.AuditVisiblePolicy?.isInformational(row));
const matchedStaleAuditCount = (rows, evidence) => Math.max(0, actionableAuditRows(rows).length - actionableAuditRows(rows, evidence).length);

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
  completed: { label: "ระบบประมวลผลเสร็จ", tone: "green" },
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

function caseLabel(e) {
  const company = String(e?.company || "ไม่ระบุ").trim();
  const date = String(e?.date || e?.business_date || "").slice(0, 10);
  const shared = AuditDisplay.caseCode(e, company, date);
  if (shared && shared !== String(e?.code || e?.id || "").trim()) return shared;
  const legacyOrdinal = String(e?.code || "").match(/^EX-(\d+)(?:$|-C)/i);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date) && legacyOrdinal) {
    const ordinal = Number(legacyOrdinal[1]) - 3000;
    if (ordinal > 0 && ordinal <= 999) {
      const companyCode = company === "UFABET7M" ? "7M" : company;
      const displayDate = `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;
      return `${companyCode}-${displayDate}-${String(ordinal).padStart(3, "0")}`;
    }
  }
  const shortDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `${date.slice(8, 10)}-${date.slice(5, 7)}-${date.slice(2, 4)}`
    : date;
  const code = String(e?.code || e?.id || "เคส").trim();
  return [company, shortDate, code].filter(Boolean).join(" ");
}

function mapLiveException(e) {
  const severity = e.severity || "medium";
  const slaHours = Number(sevMeta(severity).sla || 48);
  const created = e.created_at ? new Date(e.created_at).getTime() : Date.now();
  const ageHours = Math.max(0, Math.floor((Date.now() - created) / 3600000));
  const status = e.status || "open";
  return {
    // `code` starts again at EX-3001 for every company/run.  It is a display
    // number, not a globally unique key.  Using it for drawer navigation made
    // a 3XB row open the first MC8 EX-3001 already loaded in memory.  Keep the
    // persisted UUID as the UI/action key and render the scoped label instead.
    id: e.id,
    code: e.code || e.id,
    dbId: e.id,
    runId: e.run_id,
    manualPairId: e.manual_pair_id || null,
    crossDayRequestId: e.cross_day_request_id || null,
    crossDayImageRequestId: e.cross_day_image_request_id || null,
    supersededByExceptionId: e.superseded_by_exception_id || null,
    date: e.business_date,
    time: String(e.occurred_at || "").slice(0, 8),
    boTime: String(e.bo_time || "").slice(0, 8),
    stmTime: String(e.stm_time || "").slice(0, 8),
    boDate: e.bo_date || "",
    stmDate: e.stm_date || "",
    company: e.company || "ไม่ระบุ",
    bank: e.bank || "-",
    account: e.account || "-",
    direction: e.direction || "-",
    member: e.member_code || "-",
    customerDetails: e.customer_details || {},
    type: e.ex_type || "unknown",
    typeName: e.type_name || e.ex_type || "ยังไม่จำแนก",
    severity,
    status,
    track: e.track,
    dueAt: e.due_at,
    documentDueAt: e.document_due_at || null,
    closureRequestId: e.case_closure_request_id || null,
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
    overSla: !e.case_closure_request_id && !["closed", "approved"].includes(status) && (e.document_due_at ? status==='clarifying'&&Date.now()>Date.parse(e.document_due_at) : ageHours > slaHours),
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
    time: String(d.occurred_at || '').slice(0, 8),
    amount: d.amount_thb == null && d.amount == null ? null : Number(d.amount_thb ?? d.amount),
    cause: d.cause || "รอตรวจสอบ",
    cycle: d.cycle || "ไม่ระบุรอบ",
    evidence: !!d.has_evidence,
    hrStatus: d.hr_status || "รอดำเนินการ",
    financeStatus: d.finance_status || "รอดำเนินการ",
    createdAt: d.created_at || null,
  };
}

function openWrongClosureReversal(e,action) {
  if(state.dataset!=='production'||!Sb.signedIn()||!['lead','admin'].includes(state.role)||!can('approve'))return deny('ยกเลิกผลปิดเคส');
  if(!['closed','damage'].includes(e.status))return toast('เคสนี้ไม่ได้อยู่ในสถานะปิดหรือยืนยันความเสียหายแล้ว','warn');
  const returning=action==='return_clarification';
  const title=returning?'ตีกลับให้ชี้แจงเพิ่มเติม':'ยกเลิกผลปิด — คืนให้ Audit ตรวจใหม่';
  openModal(title,`<p>${h(caseLabel(e))}</p><p class="alert warn">การทำรายการนี้ไม่ลบยอด หลักฐาน หรือประวัติเดิม ระบบจะทำเครื่องหมายผลความเสียหายเดิมว่า “ยกเลิก” และนำออกจากยอดสรุปปัจจุบัน${e.manualPairId?' · เคสนี้ปิดจากการจับคู่ ระบบจะยกเลิกผลคู่ ปลดคู่จอง และคืนทั้งสองเคสให้ตรวจใหม่':''}</p><p>${returning?'คืนเคสไปสถานะรอผู้ชี้แจงส่งข้อมูลเพิ่มเติม':'คืนเคสไปสถานะตอบแล้ว เพื่อให้ Audit ตรวจและปิดผลใหม่'}</p><label>เหตุผลที่ยกเลิกผลเดิม<textarea id="closureReversalReason" maxlength="2000" placeholder="ระบุว่าผลเดิมผิดอย่างไร และต้องตรวจแก้จุดใด"></textarea></label><label><input type="checkbox" id="closureReversalChecked">ตรวจเลขเคส ยอดเดิม หลักฐาน และยืนยันว่าต้องย้อนผลปิดเคสนี้${e.manualPairId?'พร้อมเคสคู่':''}</label><p id="closureReversalStatus" role="status"></p>`,`<button class="ghost-button" id="closureReversalCancel">ยกเลิก</button><button class="primary-button" id="closureReversalConfirm">${h(title)}</button>`);
  $('#closureReversalCancel').onclick=closeModal;
  $('#closureReversalConfirm').onclick=async event=>{
    const reason=$('#closureReversalReason').value.trim();
    if(!$('#closureReversalChecked').checked||reason.length<10||reason.length>2000)return toast('ต้องตรวจยืนยันและระบุเหตุผล 10–2,000 ตัวอักษร','warn');
    event.currentTarget.disabled=true;$('#closureReversalStatus').textContent='กำลังบันทึกและอ่านสถานะยืนยัน — ห้ามกดซ้ำ';
    try{
      await Sb.reverseWrongCaseClosure({p_id:crypto.randomUUID(),p_case:e.dbId,p_previous_status:e.status,p_action:action,p_reason:reason});
      closeModal();closeDrawer();await loadLiveOverview(true);render();toast(returning?'ตีกลับให้ชี้แจงแล้ว และเก็บประวัติผลเดิมครบ':e.manualPairId?'ยกเลิกผลปิดคู่ ปลดคู่จอง และคืนทั้งสองเคสให้ Audit ตรวจใหม่แล้ว':'ยกเลิกผลปิดและคืนให้ Audit ตรวจใหม่แล้ว');
    }catch(error){$('#closureReversalStatus').textContent='ยังไม่ยืนยันผล: '+error.message;toast('ยังย้อนเคสไม่ได้: '+error.message,'warn');event.currentTarget.disabled=false;}
  };
}

function hydrateLiveData(quality, operations, exceptions, damages, logs) {
  DB.exceptions = actionableAuditRows(exceptions).map(mapLiveException);
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

// Background requests must not replace a sheet, filter or draft being used.
let liveInteractionVersion = 0;
for (const eventName of ["pointerdown", "keydown", "input", "wheel", "touchmove"]) {
  document.addEventListener(eventName, () => { liveInteractionVersion++; }, { passive: true });
}
let liveQueueUpdatePending = false;
let liveQueueLastPoll = 0;
function liveQueueRoute() {
  return ['dashboard','clarify','audit-review','approvals'].includes(state.route) && state.dataset==='production' && Sb.signedIn();
}
function liveQueueProtected() {
  if ($('#appShell')?.inert) return true;
  if(document.visibilityState==='hidden')return true;
  if(['#drawer','#modal'].some(selector=>$(selector)&&!$(selector).hidden))return true;
  const root=$('#viewRoot');
  return Array.from(root?.querySelectorAll('textarea,input,select')||[]).some(el=>
    (document.activeElement===el && el.id!=='auditReviewCompany') || (['checkbox','radio'].includes(el.type)?el.checked:
    el.tagName==='SELECT'?Array.from(el.options).some((option,index)=>option.selected!==(option.defaultSelected || (!el.multiple && !Array.from(el.options).some(item=>item.defaultSelected) && index===0))):el.value!==el.defaultValue));
}
function applyLiveQueueUpdate(force=false) {
  if(!liveQueueRoute() || liveOverviewState.loading || liveOverviewState.auxiliaryLoading
    || (!liveOverviewState.exceptionsReady && !(state.route === 'clarify' && liveOverviewState.auxiliaryError)) || (['audit-review','approvals'].includes(state.route) && (liveOverviewState.error || liveOverviewState.auxiliaryError))
    || (!force && liveQueueProtected()))return false;
  const root=$('#viewRoot'),x=window.scrollX,y=window.scrollY;
  if(state.route==='audit-review'&&typeof root?.auditQueueUpdateInPlace==='function'){
    const updated=root.auditQueueUpdateInPlace();
    if(updated){liveQueueUpdatePending=false;$('#liveUpdateAvailable')?.remove();root.querySelector('.live-background-notice')?.remove();renderNav();renderAuditFlow();if(typeof renderFilters==='function')renderFilters();}
    return updated;
  }
  const scrolls=Array.from(root?.querySelectorAll('*')||[]).filter(el=>el.scrollTop||el.scrollLeft).map(el=>{
    const path=[];let node=el;while(node&&node!==root){path.unshift(`${node.tagName.toLowerCase()}:nth-child(${Array.from(node.parentElement.children).indexOf(node)+1})`);node=node.parentElement;}
    return {selector:path.join(' > '),top:el.scrollTop,left:el.scrollLeft};
  });
  liveQueueUpdatePending=false;
  render();
  const restore=()=>{for(const saved of scrolls){const el=$('#viewRoot')?.querySelector(saved.selector);if(el){el.scrollTop=saved.top;el.scrollLeft=saved.left;}}window.scrollTo(x,y);};
  restore();requestAnimationFrame(restore);
  return true;
}
async function pollLiveQueues() {
  if(!liveQueueRoute() || liveQueueProtected())return;
  if(liveQueueUpdatePending)applyLiveQueueUpdate();
  if(liveOverviewState.loading || liveOverviewState.auxiliaryLoading || Date.now()-liveQueueLastPoll<30000)return;
  liveQueueLastPoll=Date.now();
  // Read only. Never dispatch reconciliation, decisions, notes or case changes.
  if(state.route==='approvals')for(const name of [CaseClosure,ManualPairing,CrossDayWorkbench])name.queueState.at=0;
  await loadLiveOverview(true);
}
setInterval(()=>pollLiveQueues().catch(()=>{}),1000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden'){liveQueueLastPoll=0;pollLiveQueues().catch(()=>{});}});
function offerLiveOverviewUpdate() {
  if(state.route==='finance')return;
  if(typeof liveQueueRoute==='function' && liveQueueRoute()) {
    liveQueueUpdatePending=true;
    if(applyLiveQueueUpdate())return;
  }
  const root = $("#viewRoot");
  if (!root || !Sb.signedIn()) return;
  let notice = $("#liveUpdateAvailable");
  if (!notice) {
    notice = document.createElement("aside");
    notice.id = "liveUpdateAvailable";
    notice.className = "alert live-update-available";
    notice.setAttribute("role", "status");
    const text = document.createElement("span");
    text.textContent = "ข้อมูลล่าสุดพร้อมแล้ว · หน้าที่กำลังตรวจยังคงเดิม";
    const button = document.createElement("button");
    button.className = "ghost-button sm";
    button.textContent = "แสดงข้อมูลล่าสุด";
    button.onclick = () => {
      // Applying is explicit; never discard a form or open case silently.
      if (($('#drawer') && !$('#drawer').hidden) || (typeof liveQueueRoute === 'function' && liveQueueRoute() && liveQueueProtected()) || ($("#modal") && !$("#modal").hidden)) {
        toast("กรุณาบันทึกและปิดหน้ารายละเอียดที่เปิดอยู่ก่อน — ยังไม่ได้เปลี่ยนหน้าหรือทิ้งข้อความ", "warn");
        return;
      }
      if (notice.querySelector("div")) return;
      const confirm = document.createElement("div");
      confirm.setAttribute("role", "group");
      confirm.setAttribute("aria-label", "ยืนยันแสดงข้อมูลล่าสุด");
      const warning = document.createElement("p");
      warning.textContent = "แสดงข้อมูลล่าสุด? หากมีข้อความที่ยังไม่บันทึก ให้ยกเลิกและบันทึกก่อน";
      const cancel = document.createElement("button");
      cancel.className = "ghost-button sm";
      cancel.textContent = "ยกเลิก";
      cancel.onclick = () => confirm.remove();
      const apply = document.createElement("button");
      apply.className = "primary-button sm";
      apply.textContent = "ยืนยันแสดงข้อมูลล่าสุด";
      apply.onclick = () => {
        if (($('#drawer') && !$('#drawer').hidden) || (typeof liveQueueRoute === 'function' && liveQueueRoute() && liveQueueProtected()) || ($("#modal") && !$("#modal").hidden)) return;
        const x = window.scrollX, y = window.scrollY;
        render();
        window.scrollTo(x, y);
      };
      confirm.append(warning, cancel, apply);
      notice.append(confirm);
    };
    const retry = document.createElement("button");
    retry.className = "ghost-button sm";
    retry.textContent = "ลองโหลดใหม่";
    retry.onclick = async () => {
      retry.disabled = true;
      try { await loadLiveOverview(true); }
      finally { retry.disabled = false; }
    };
    notice.append(text, button, retry);
    root.append(notice);
  }
  const errors = [liveOverviewState.error, liveOverviewState.auxiliaryError].filter(Boolean);
  notice.querySelector("span").textContent = errors.length
    ? "ข้อมูลบางส่วนโหลดไม่สำเร็จ: " + errors.join(" · ") + " — ไม่ใช่ยอดค้างเป็นศูนย์; กดลองโหลดใหม่โดยไม่ทิ้งงานที่เปิดอยู่"
    : "ข้อมูลล่าสุดพร้อมแล้ว · หน้าที่กำลังตรวจยังคงเดิม";
}
// Read-only responder model. One authorized date-range snapshot serves all
// company filters; never persist it or share it across actors/access scopes.
const fastQueueDrafts = new Map();
function fastQueueDraftKey() {
  if (!['audit-review','approvals'].includes(state.route) || state.dataset !== 'production') return '';
  return JSON.stringify([Sb.authUser()?.id,state.role,state.access?.companies,state.route,state.filters]);
}
function captureFastQueueDrafts() {
  const root=$('#viewRoot'),key=root?.dataset.fastQueueDraftKey;
  if (!key) return;
  const values=fastQueueDrafts.get(key)||{};
  root.querySelectorAll('textarea').forEach(el=>{const name=el.id||(el.hasAttribute('data-pair-bulk-note')?'pair-bulk-note':'');if(name)values[name]=el.value;});
  fastQueueDrafts.set(key,values);
}
function restoreFastQueueDrafts(expectedKey=fastQueueDraftKey()) {
  const root=$('#viewRoot');
  if (!expectedKey || root?.dataset.fastQueueDraftKey!==expectedKey) return;
  const values=fastQueueDrafts.get(expectedKey)||{};
  root.querySelectorAll('textarea').forEach(el=>{const name=el.id||(el.hasAttribute('data-pair-bulk-note')?'pair-bulk-note':'');if(Object.hasOwn(values,name)&&el.value===el.defaultValue&&document.activeElement!==el)el.value=values[name];});
}
let responderQueueCache = null;
let responderQueueFailure = null;
const responderQueueFlights = new Map();
function responderQueueMode() {
  return state.dataset === 'production' && state.route === 'clarify' && state.role === 'shift_lead' && Sb.signedIn();
}
function fastReviewQueueMode() {
  return state.dataset === 'production' && Sb.signedIn() &&
    ['audit-review','approvals'].includes(state.route) && ['monitor','audit_assistant','lead','admin'].includes(state.role);
}
function fastCaseQueueMode() { return responderQueueMode() || fastReviewQueueMode(); }
function responderQueueKey() {
  return JSON.stringify([Sb.authUser()?.id, state.access?.email, state.role,
    [...(state.access?.companies || [])].sort(), state.filters.from, state.filters.to]);
}
function applyResponderQueue(snapshot) {
  DB.exceptions = snapshot.rows.filter(row => canAccessCompany(row.company)).map(mapLiveException);
  liveOverviewState.key = `${state.filters.from}|${state.filters.to}|${state.filters.company}`;
  liveOverviewState.responderOnly = true;
  liveOverviewState.exceptionsReady = true;
  liveOverviewState.error = null;
  liveOverviewState.coreErrors = [];
  liveOverviewState.updatedAt = new Date(snapshot.at);
  moreCaseState.hasMore = snapshot.truncated;
  moreCaseState.offset = snapshot.total;
  moreCaseState.error = '';
}
async function loadResponderQueue(force = false) {
  if (!fastCaseQueueMode() || !Sb.authUser()?.id) return;
  // Independent authenticated reads: do not wait for jobs/case summaries before
  // warming the three approval queues. Their existing single flights/cache own
  // error and actor isolation; this does not submit or decide any request.
  if (state.route === 'approvals') {
    for (const module of [ManualPairing, CrossDayWorkbench, CaseClosure]) {
      module.loadPending().catch(() => {});
    }
  }
  const key = responderQueueKey();
  if (!liveOverviewState.responderOnly) ++liveOverviewState.requestId;
  if (responderQueueCache?.key !== key) {
    responderQueueCache = null;
    DB.exceptions = [];
    liveOverviewState.exceptionsReady = false;
  }
  if (responderQueueCache) applyResponderQueue(responderQueueCache);
  if (!force && responderQueueCache && Date.now() - responderQueueCache.at < 30000) {
    renderFilters();
    return;
  }
  if (responderQueueFlights.has(key)) return responderQueueFlights.get(key);
  if (!force && responderQueueFailure?.key === key && Date.now() < responderQueueFailure.retryAt) return;
  const scope = {from: state.filters.from, to: state.filters.to, company: 'ALL', limit: 5000};
  liveOverviewState.responderOnly = true;
  liveOverviewState.key = `${scope.from}|${scope.to}|${state.filters.company}`;
  liveOverviewState.loading = true;
  liveOverviewState.auxiliaryLoading = false;
  liveOverviewState.auxiliaryError = null;
  const flight = (async () => {
    // Existing authenticated transport + server-side RLS/current-primary model.
    // No dashboard, history, finance, notifications or reconciliation reads.
    try {
      const rows = await Sb.currentExceptionsSummary(scope);
      if (!fastCaseQueueMode() || responderQueueKey() !== key) return;
      responderQueueCache = {key, at: Date.now(), total: rows.length, truncated: rows.length === scope.limit,
        rows: responderQueueMode() ? rows.filter(row => row.requested_at && !row.case_closure_request_id && ['open','clarifying','answered'].includes(row.status)) : rows};
      applyResponderQueue(responderQueueCache);
      responderQueueFailure = null;
    } catch (error) {
      if (fastCaseQueueMode() && responderQueueKey() === key) {
        responderQueueFailure = {key, retryAt: Date.now() + 30000};
        liveOverviewState.auxiliaryError = 'รายการเคส: ' + (error.message || 'โหลดไม่สำเร็จ') + ' · คงร่างและข้อมูลที่โหลดได้ครั้งก่อน';
      }
    } finally {
      responderQueueFlights.delete(key);
      if (fastCaseQueueMode() && responderQueueKey() === key) {
        liveOverviewState.loading = false;
        liveOverviewState.auxiliaryLoading = false;
        offerLiveOverviewUpdate();
      }
    }
  })();
  responderQueueFlights.set(key, flight);
  return flight;
}
async function loadLiveOverview(force = false) {
  if (state.route === 'clarify' && state.role === 'shift_lead') return loadResponderQueue(force);
  if (typeof fastReviewQueueMode === 'function' && fastReviewQueueMode()) return loadResponderQueue(force);
  if (liveOverviewState.responderOnly) {
    liveOverviewState.responderOnly = false;
    liveOverviewState.loading = false;
    liveOverviewState.auxiliaryLoading = false;
    ++liveOverviewState.requestId;
    liveOverviewState.quality = null;
    liveOverviewState.key = '';
  }
  const key = `${state.filters.from}|${state.filters.to}|${state.filters.company}`;
  const caseReadLimit = state.route === 'clarify' ? 5000 : 250;
  if (liveOverviewState.loading || liveOverviewState.auxiliaryLoading || (!force && liveOverviewState.key === key && liveOverviewState.quality)) return;
  const requestId = ++liveOverviewState.requestId;
  const changedFilter = liveOverviewState.key !== key;
  const firstDashboardLoad = state.route === "dashboard" && !liveOverviewState.quality;
  const interactionAtStart = liveInteractionVersion;
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
    liveOverviewState.caseCounts = null;
    liveOverviewState.boFirst = null;
    liveOverviewState.damages = null;
    liveOverviewState.logs = null;
    liveOverviewState.clarifications = null;
    liveOverviewState.informationalExceptions = [];
    liveOverviewState.exceptionsReady = false;
    liveOverviewState.damagesReady = false;
    liveOverviewState.logsReady = false;
    DB.exceptions = [];
    DB.damages = [];
  }
  // Keep existing content while the request is in flight.
  try {
    // Phase 1: ข้อมูลสรุปขนาดเล็กต้องขึ้นหน้าจอก่อน ไม่รอ exception/หลักฐานหลายพันแถว
    const core = await Promise.allSettled([
      Sb.dailyStatus({ from: state.filters.from, to: state.filters.to, company: state.filters.company, limit: 1000 }),
      Sb.operations({ from: state.filters.from, to: state.filters.to, company: state.filters.company, limit: 1000 }),
      Sb.quality({ from: state.filters.from, to: state.filters.to, company: state.filters.company, limit: 1000 }),
      Sb.dailyChecklist({ from: state.filters.from, to: state.filters.to, company: state.filters.company }),
      Sb.currentCaseCounts({ from: state.filters.from, to: state.filters.to, company: state.filters.company }),
      Sb.boFirstCoverage({ from: state.filters.from, to: state.filters.to, company: state.filters.company }),
      Sb.runtimeSettings(),
      Sb.reviewHoldScopes(),
    ]);
    if (requestId !== liveOverviewState.requestId) return;
    const coreNames = ["ยอดเมลและไฟล์", "คิวกระทบยอด", "ผลกระทบยอด", "เช็กลิสต์", "ยอดเคสชุดปัจจุบัน", "ผล BO-first", "การตั้งค่าระบบ", "ทะเบียนพักตรวจ"];
    AccountReviewHolds.set(core[7].status==='fulfilled'?core[7].value:[]);
    if (key !== `${state.filters.from}|${state.filters.to}|${state.filters.company}`) {
      liveOverviewState.loading = false;
      return loadLiveOverview(true);
    }
    const coreValue = (index, fallback) => core[index].status === "fulfilled" ? (core[index].value ?? fallback) : fallback;
    let daily = coreValue(0, liveOverviewState.daily);
    let operations = coreValue(1, liveOverviewState.operations);
    let quality = coreValue(2, liveOverviewState.quality);
    let checklistRows = coreValue(3, liveOverviewState.checklist);
    let caseCountRows = coreValue(4, liveOverviewState.caseCounts);
    let boFirstRows = coreValue(5, liveOverviewState.boFirst);
    const settings = coreValue(6, liveOverviewState.settings ? [liveOverviewState.settings] : null);
    liveOverviewState.coreErrors = core.flatMap((item, index) => item.status === "rejected" ? [coreNames[index] + ": " + String(item.reason?.message || "คำขอไม่สำเร็จ").slice(0, 240)] : []);
    // Keep the requested day even when empty; never silently widen or change Day-1.
    if (requestId !== liveOverviewState.requestId) return;
    if (daily !== null) liveOverviewState.daily = daily || [];
    if (operations !== null) liveOverviewState.operations = (operations || []).filter(isLiveCompanyRow);
    if (quality !== null) liveOverviewState.quality = (quality || []).filter(isLiveCompanyRow);
    if (checklistRows !== null) liveOverviewState.checklist = (checklistRows || []).filter(isLiveCompanyRow);
    if (caseCountRows !== null) liveOverviewState.caseCounts = (caseCountRows || []).filter(isLiveCompanyRow);
    if (boFirstRows !== null) liveOverviewState.boFirst = (boFirstRows || []).filter(isLiveCompanyRow);
    if (settings !== null) liveOverviewState.settings = Array.isArray(settings) ? (settings[0] || null) : settings;
    liveOverviewState.error = liveOverviewState.coreErrors.length
      ? `ข้อมูลบางส่วนยังไม่พร้อม: ${[...new Set(liveOverviewState.coreErrors)].join(", ")} — ตัวเลขส่วนนี้จะแสดง “—” แทนศูนย์`
      : null;
    liveOverviewState.updatedAt = new Date();
    liveOverviewState.loading = false;
    liveOverviewState.auxiliaryLoading = true;
    // Phase 1 must not erase the last loaded case objects/drafts while the
    // independent case read is pending. Hydrate raw rows only after phase 2.
    if (firstDashboardLoad && state.route === "dashboard" && liveInteractionVersion === interactionAtStart && liveOverviewState.quality) {
      const x = window.scrollX, y = window.scrollY;
      render();
      window.scrollTo(x, y);
    } else offerLiveOverviewUpdate();

    // Phase 2: เติมรายละเอียดหนักด้านหลัง โดยไม่บล็อกแดชบอร์ดหลัก
    const aux = await Promise.allSettled([
      // โหลดเฉพาะชุดแรกให้หน้าขึ้นไว; ค้นหา/Export ค่อยดึงเพิ่มเติมเมื่อผู้ใช้ร้องขอ
      Sb.currentExceptionsSummary({ from: state.filters.from, to: state.filters.to, company: state.filters.company, limit: caseReadLimit }),
      Sb.damages({ from: state.filters.from, to: state.filters.to, company: state.filters.company, limit: 2000 }),
      Sb.auditLogs({ from: state.filters.from, to: state.filters.to, limit: 500 }),
      Sb.notifications(200, VISIBLE_DATE_FROM),
      Sb.clarificationMatches({ from: state.filters.from, to: state.filters.to, company: state.filters.company, limit: 1000 }),
      Sb.reconciliationEvidence({ from: state.filters.from, to: state.filters.to, company: state.filters.company }),
    ]);
    if (requestId !== liveOverviewState.requestId) return;
    if (liveOverviewState.key !== `${state.filters.from}|${state.filters.to}|${state.filters.company}`) {
      liveOverviewState.loading = false;
      liveOverviewState.auxiliaryLoading = false;
      return loadLiveOverview(true);
    }
    const value = (index, fallback = []) => aux[index].status === "fulfilled" ? (aux[index].value || fallback) : fallback;
    const previousCases = DB.exceptions;
    const previousDamages = DB.damages;
    const previousLogs = DB.auditLog;
    const rawExceptionRows = value(0, []);
    const matchEvidence = value(5, []);
    const exceptionRows = actionableAuditRows(rawExceptionRows,matchEvidence);
    const damageRows = value(1, liveOverviewState.damages || []);
    const logRows = value(2, liveOverviewState.logs || []);
    const casesSucceeded = aux[0].status === "fulfilled";
    liveOverviewState.exceptionsReady = casesSucceeded || liveOverviewState.exceptionsReady;
    if (casesSucceeded) {
      liveOverviewState.informationalExceptions = informationalAuditRows(rawExceptionRows);
      liveOverviewState.matchEvidence = matchEvidence;
      liveOverviewState.matchedStaleExceptions = matchedStaleAuditCount(rawExceptionRows,matchEvidence);
      moreCaseState.offset = rawExceptionRows.length;
      moreCaseState.hasMore = rawExceptionRows.length === caseReadLimit;
      moreCaseState.error = "";
    }
    liveOverviewState.damagesReady = aux[1].status === "fulfilled";
    liveOverviewState.logsReady = aux[2].status === "fulfilled";
    if (aux[1].status === "fulfilled") liveOverviewState.damages = damageRows;
    if (aux[2].status === "fulfilled") liveOverviewState.logs = logRows;
    if (aux[3].status === "fulfilled") liveOverviewState.notifications = value(3);
    if (aux[4].status === "fulfilled") liveOverviewState.clarifications = value(4);
    const auxiliaryNames = ["รายการเคส", "ทะเบียนความเสียหาย", "ประวัติงาน", "การแจ้งเตือน", "คำชี้แจง", "หลักฐานจับคู่"];
    const auxiliaryErrors = aux.flatMap((item, index) => item.status === "rejected"
      ? [auxiliaryNames[index] + ": " + String(item.reason?.message || "คำขอไม่สำเร็จ").slice(0, 240)] : []);
    liveOverviewState.auxiliaryError = auxiliaryErrors.length ? auxiliaryErrors.join(" · ") : null;
    liveOverviewState.auxiliaryLoading = false;
    liveOverviewState.updatedAt = new Date();
    hydrateLiveData(liveOverviewState.quality || [], liveOverviewState.operations || [], exceptionRows, damageRows, logRows);
    if (!casesSucceeded) DB.exceptions = previousCases;
    if (aux[1].status !== 'fulfilled') DB.damages = previousDamages;
    if (aux[2].status !== 'fulfilled') DB.auditLog = previousLogs;
    updateBell();
  } catch (e) {
    if (requestId === liveOverviewState.requestId) liveOverviewState.error = e.message || "โหลดข้อมูลจริงไม่สำเร็จ";
  }
  if (requestId === liveOverviewState.requestId) {
    liveOverviewState.loading = false;
    liveOverviewState.auxiliaryLoading = false;
    offerLiveOverviewUpdate();
  }
}

function ensureLiveOverview(root) {
  if (state.dataset !== "production" || !Sb.signedIn()) return true;
  if (fastCaseQueueMode()) { loadResponderQueue().catch(() => {}); return true; }
  const key = `${state.filters.from}|${state.filters.to}|${state.filters.company}`;
  const stale = liveOverviewState.key !== key;
  if (liveOverviewState.responderOnly || ((!liveOverviewState.quality || stale) && !liveOverviewState.loading)) loadLiveOverview(stale);
  // อย่าปิดทั้งหน้าระหว่างรอข้อมูลกลาง แต่ละหน้าจะแสดงข้อมูลที่มีอยู่ก่อน
  // และ render() จะเติมแถบแจ้งสถานะด้านบนจนกว่าการอัปเดตจะเสร็จ
  return true;
}

function hasLiveCoreError(section, errors = liveOverviewState.coreErrors) {
  return errors.some((message) => message === section || message.startsWith(`${section}:`));
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
  const completed = quality.filter((x) => x.primaryResult || x.status === "completed").length;
  const needsReview = quality.filter((x) => x.status === "needs_review").length;
  const waiting = quality.filter((x) => !x.primaryResult && x.status === "waiting_files").length;
  const failed = quality.filter((x) => !x.primaryResult && (x.status === "error" || Number(x.error_count || 0) > 0)).length;
  const checklistInRange = (liveOverviewState.checklist || []).filter(inLiveRange);
  const checklistByCompanyDate = new Map(checklistInRange.map((row) => [`${row.business_date}|${String(row.company || "").toUpperCase()}`, row]));
  const currentCountsInRange = (liveOverviewState.caseCounts || []).filter(inLiveRange);
  const currentCountsByCompanyDate = new Map(currentCountsInRange.map((row) => [`${row.business_date}|${String(row.company || "").toUpperCase()}`, row]));
  const manualFollowups=manualFollowupItems(checklistInRange);
  const manualFollowupErrors=[...new Set(checklistInRange.map(r=>r.workflowStatusError).filter(Boolean))];
  const manualFollowupReady=Array.isArray(liveOverviewState.checklist)&&!hasLiveCoreError('เช็กลิสต์');
  const currentExceptionCount = (row) => {
    const lifecycle = currentCountsByCompanyDate.get(`${row.business_date}|${String(row.company || "").toUpperCase()}`);
    return lifecycle?.total_count != null
      ? Number(lifecycle.total_count || 0)
      : Number(row.exception_count || 0);
  };
  const currentCountsReady = Array.isArray(liveOverviewState.caseCounts) && !hasLiveCoreError("ยอดเคสชุดปัจจุบัน");
  const exceptionTotal = currentCountsReady
    ? currentCountsInRange.reduce((sum, row) => sum + Number(row.total_count || 0), 0)
    : quality.reduce((sum, x) => sum + Number(x.exception_count || 0), 0);
  const risk = exceptions.reduce((sum, x) => sum + Number(x.riskAmount || 0), 0);
  const dailyAvailable = Array.isArray(liveOverviewState.daily) && !hasLiveCoreError("ยอดเมลและไฟล์");
  const qualityAvailable = Array.isArray(liveOverviewState.quality) && !hasLiveCoreError("ผลกระทบยอด");
  const showMetric = (available, value) => available ? num(value) : "—";

  const opByKey = new Map(operations.map((x) => [`${x.business_date}|${x.company}|${x.business_system || ""}`, x]));
  const companyMap = new Map();
  quality.forEach((row) => {
    const key = `${row.company}|${row.business_system || "ไม่ระบุระบบ"}`;
    if (!companyMap.has(key)) companyMap.set(key, { company: row.company, system: row.business_system || "ไม่ระบุระบบ", completed: 0, review: 0, waiting: 0, error: 0, files: 0, latest: row.business_date, kinds: new Set() });
    const item = companyMap.get(key);
    item.files += Number(row.file_count || 0);
    item.latest = item.latest > row.business_date ? item.latest : row.business_date;
    if (row.primaryResult || row.status === "completed") item.completed++;
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
  const missingText = (row) => cloudMissingGroupsText(row.missing_groups);
  const companyByCode = new Map(companies.map((company) => [String(company.company || "").toUpperCase(), company]));
  const latestCompanyDate = (codes) => codes.reduce((latest, code) => {
    const value = companyByCode.get(code)?.latest || "";
    return value > latest ? value : latest;
  }, state.filters.to || DEFAULT_WORK_DATE);
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
      <article class="ok" data-action-route="daily-summary"><span>ระบบประมวลผลเสร็จ</span><strong>${showMetric(qualityAvailable, completed)}</strong><small>จำนวนงานรายวัน/บริษัท · ยังไม่ใช่การยืนยันจาก Audit</small></article>
      <article class="warn" data-action-route="daily-summary"><span>ต้องตรวจสอบ</span><strong>${showMetric(qualityAvailable, needsReview)}</strong><small>${qualityAvailable ? "ข้อมูลมาแล้วแต่ยังไม่ครบ" : "ผลกระทบยอดยังไม่พร้อม"} · กดดูสิ่งที่ขาด</small></article>
      <article class="bad" data-action-route="cloud"><span>รอไฟล์ / ล้มเหลว</span><strong>${showMetric(qualityAvailable, waiting + failed)}</strong><small>${qualityAvailable ? `รอ ${num(waiting)} · ล้มเหลว ${num(failed)}` : "ผลกระทบยอดยังไม่พร้อม"} · กดแก้ไฟล์</small></article>
      <article class="bad" data-action-route="exceptions"><span>เคสที่ระบบตรวจพบ</span><strong>${showMetric(qualityAvailable, exceptionTotal)}</strong><small>${!qualityAvailable ? "ผลกระทบยอดยังไม่พร้อม" : liveOverviewState.auxiliaryLoading ? "ข้อมูลหลักพร้อมแล้ว · กำลังเติมยอดเสี่ยง" : !liveOverviewState.exceptionsReady ? "ยอดเสี่ยงยังโหลดไม่สำเร็จ" : `ยอดเสี่ยงเฉพาะ ${num(exceptions.length)} เคสที่โหลด ${money0(risk)} บาท · ไม่ใช่ยอดรวมทั้งระบบ`} · กดตรวจเคส</small></article>
    </section>

    <section class="panel manual-followup-panel" aria-labelledby="manualFollowupTitle">
      <div class="panel-heading"><div><p class="eyebrow">ไม่ลืมยืนยันผลรันมือ</p><h2 id="manualFollowupTitle">ผลรันมือที่ต้องทำต่อ ${manualFollowupReady?`(${num(manualFollowups.length)})`:''}</h2><small class="head-sub">ตามบริษัทและช่วงวันที่ที่เลือก · แสดงรอบล่าสุดของแต่ละขอบเขต · เปิดทบทวนเท่านั้น ไม่ยืนยันหรือเปลี่ยนผลหลักอัตโนมัติ</small></div></div>
      ${!manualFollowupReady?'<p role="status">ยังตรวจสถานะรายงานไม่สำเร็จ กรุณารีเฟรช ไม่ได้หมายความว่าไม่มีงานค้าง</p>':''}
      ${manualFollowupErrors.map(e=>`<p role="alert">${h(e)} · รายการอาจยังไม่ครบ</p>`).join('')}
${manualFollowups.map(q=>`<article class="manual-followup-item"><div><strong>${h(q.company)} · ${h(q.business_date)}</strong><p>${q.status==='ready'?'รันมือสำเร็จ · รอหัวหน้า/ผู้ดูแลยืนยันรายงาน':'ยืนยันรายงานแล้ว · ยังไม่ใช้เป็นผลหลัก'}</p><small>${h(q.account==='ALL'?'ทุกบัญชี':q.account)} · ${h({all:'ฝากและถอน',deposit:'ฝาก',withdraw:'ถอน'}[q.direction]||q.direction)} · รันเมื่อ ${h(displayTime(q.created_at))}</small>${q.account!=='ALL'||q.direction!=='all'?'<small class="sub">รายงานเฉพาะขอบเขต: ยืนยันเก็บเป็นรายงานแยกได้ แต่ใช้แทนผลหลักทั้งบริษัทไม่ได้</small>':''}</div>${['lead','admin'].includes(state.role)&&canAccessCompany(q.company)?`<button class="primary-button" data-manual-followup="${h(q.id)}">${q.status==='ready'?'ทบทวนและยืนยันรายงาน':q.account!=='ALL'||q.direction!=='all'?'เปิดรายงานเฉพาะขอบเขต':'ทบทวนใช้เป็นผลหลัก'}</button>`:'<small>ให้หัวหน้า/ผู้ดูแลในบริษัทนี้ดำเนินการ</small>'}</article>`).join('')}
      ${manualFollowupReady&&!manualFollowups.length&&!manualFollowupErrors.length?'<p class="empty">ไม่พบผลรันมือที่รอยืนยันหรือยังไม่ใช้เป็นผลหลักในขอบเขตนี้</p>':''}
    </section>

    <section class="action-overview">
      <div><p class="eyebrow">สรุปที่ต้องทำ</p><h2>${!qualityAvailable ? "กำลังรอผลกระทบยอดจริง" : needsReview + waiting + failed ? `มี ${num(needsReview + waiting + failed)} งานที่ต้องตาม` : "ตรวจผลและการยืนยันของ Audit ต่อในหน้ารายการ"}</h2><p>${!qualityAvailable ? "ระบบไม่สรุปเป็นศูนย์จนกว่าจะอ่านผลจริงสำเร็จ" : `${waiting ? `รอไฟล์ ${num(waiting)} งาน · ` : ""}${needsReview ? `ต้องตรวจ ${num(needsReview)} งาน · ` : ""}${failed ? `ล้มเหลว ${num(failed)} งาน` : "ไม่พบงานล้มเหลว"}`}${liveOverviewState.auxiliaryLoading ? " · รายละเอียดกำลังโหลดเบื้องหลัง" : ""}${liveOverviewState.auxiliaryError ? ` · ${h(liveOverviewState.auxiliaryError)}` : ""}</p></div>
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
<div class="panel-heading"><div><p class="eyebrow">Checklist รายบริษัท</p><h2>วันที่ ${h(checklistDate)} · ครบทั้ง 9 บริษัท</h2><small class="head-sub">ระบบอ่าน BO ก่อนเพื่อรู้บัญชี/Provider ที่ใช้จริง แล้วจึงตรวจ STM/PM ที่ต้องส่ง · คอลัมน์เอกสารและการอ่านไฟล์เป็นรอบอัตโนมัติ · ผลหลักและผลรันมือแสดงแยกในคอลัมน์สถานะ</small></div><span class="health ${checklist.some((row) => !row.primaryResult && !["completed", "scheduled", "receiving"].includes(row.checklist_status)) ? "attention" : "ok"}">${num(checklist.filter((row) => row.primaryResult || row.checklist_status === "completed").length)}/${num(checklist.length || 9)} บริษัทที่ระบบประมวลผลเสร็จ</span></div>
      <div class="table-wrap"><table class="checklist-table"><thead><tr><th>บริษัท / ระบบ</th><th>เมล / ไฟล์</th><th>STM ตาม BO</th><th>BO ที่รับ / ต้องมี</th><th>PM ตาม BO</th><th>บัญชี/Provider ที่ BO ระบุ</th><th>อ่านไฟล์</th><th>กระทบยอด / เคส</th><th>สถานะ</th></tr></thead><tbody>
        ${checklist.map((row) => {
          const resultStatus=dailyResultStatus(row);
          const lifecycle=currentCountsByCompanyDate.get(`${row.business_date}|${String(row.company || "").toUpperCase()}`);
          const currentOpen=lifecycle?.open_count!=null?Number(lifecycle.open_count || 0):Number(row.open_count || 0);
          const status = resultStatus.primary ? {label:resultStatus.label,tone:'green'} : resultStatus.manual ? {label:resultStatus.manual,tone:'blue'} : CHECKLIST_STATUS[row.checklist_status] || LIVE_STATUS[row.job_status] || { label: row.checklist_status, tone: "grey" };
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
return `<tr class="checklist-row" data-check-date="${h(row.business_date)}" data-check-company="${h(row.company)}"><td><b>${h(row.display_name || row.company)}</b><small class="sub">ระบบ ${h(row.business_system || "-")} · ${future ? "รอเริ่มวันทำการ" : `รับล่าสุด ${h(displayTime(row.last_mail_at))}`}</small></td><td>${future ? pending() : checklistMark(Number(row.file_count)>0, `${num(row.mail_count)} เมล · ${num(row.file_count)} ไฟล์`)}</td><td>${future ? pending() : coverage ? checklistMark(stmCoverage.missing.length === 0, `${num(stmCoverage.received)}/${num(stmCoverage.required.length)} กลุ่ม`) : checklistMark(false, "รออ่าน BO", true)}</td><td>${future ? pending() : checklistMark(boOk, `${num(row.bo_count)}/${num(boExpected)} ไฟล์`)}</td><td>${future ? pending() : coverage ? checklistMark(pmCoverage.missing.length === 0, `${num(pmCoverage.received)}/${num(pmCoverage.required.length)} กลุ่ม`) : checklistMark(false, "รออ่าน BO", true)}</td><td><small>${h(providers)}</small>${providerNotes}</td><td>${future ? pending() : checklistMark(parsedOk, Number(row.error_count) ? `อ่านไม่ได้ ${num(row.error_count)}` : `${num(row.parsed_count)}/${num(reconFileCount)}`)}</td><td>${future ? pending() : checklistMark((resultStatus.primary || row.job_status==="completed") && currentOpen===0, resultStatus.primary || row.job_status==="completed" ? `จับคู่ ${num(resultStatus.primary?.report?.matched ?? row.matched_count)} · ค้าง ${num(currentOpen)}` : (LIVE_STATUS[row.job_status]?.label || "ยังไม่รัน"))}</td><td><span class="badge ${status.tone}">${h(status.label)}</span><small class="sub">${h(resultStatus.automatic)}</small>${!future && boFirstMissing.length ? `<small class="sub danger">${h(boFirstMissing.join(" · "))}</small>` : !future && Array.isArray(row.missing_items) && row.missing_items.length ? `<small class="sub danger">${h(cloudMissingGroupsText(row.missing_items))}</small>` : ""}${row.registry_warning ? `<small class="sub registry-note">ทะเบียน: ${h(row.registry_warning)}</small>` : ""}</td></tr>`;
        }).join("") || `<tr><td colspan="9" class="empty">กำลังเตรียมเช็กลิสต์รอบใหม่</td></tr>`}
      </tbody></table></div>
      <p class="hint">กดแถวบริษัทเพื่อเปิดสรุป 1 บริษัท 1 วัน · ระบบอ่านบัญชีที่ใช้จริงจาก BO/รายงานฝาก-ถอน แล้วตรวจหา STM/PM คู่กัน ส่วน BO ตรวจตามกฎ 1 หรือ 2 ไฟล์อัตโนมัติ</p>
    </section>

    <section class="grid-2 live-main-grid company-rule-layout">
      <div class="panel company-group-panel">
        <div class="panel-heading"><div><p class="eyebrow">บริษัทและระบบ</p><h2>3 เครือบริษัท · แยกบริษัทย่อย</h2><small class="head-sub">กดชื่อบริษัทเพื่อเปิดสรุปรายวันของบริษัทนั้น</small></div><span class="health ${needsReview + waiting ? "attention" : "ok"}">${num(AUDIT_COMPANY_GROUPS.length)} เครือ</span></div>
        <div class="company-group-grid">
          ${AUDIT_COMPANY_GROUPS.map((group) => {
            const members = group.companies.map((code) => ({ code, data: companyByCode.get(code) }));
            const totals = members.reduce((acc, member) => {
              acc.completed += Number(member.data?.completed || 0);
              acc.review += Number(member.data?.review || 0);
              acc.waiting += Number(member.data?.waiting || 0) + Number(member.data?.error || 0);
              return acc;
            }, { completed: 0, review: 0, waiting: 0 });
            return `<article class="company-group-card ${group.status === "pending" ? "pending" : "active"}">
              <div class="company-group-head"><div><strong>${h(group.name)}</strong><span>${num(group.companies.length)} บริษัท</span></div><span class="badge ${group.status === "active" ? "green" : "grey"}">${group.status === "active" ? "ใช้กฎแล้ว" : "รอเงื่อนไข"}</span></div>
              <div class="company-subcompany-list">${members.map(({ code, data }) => `<button type="button" class="company-subcompany ${data ? "has-data" : ""}" data-summary-company="${h(code)}" data-summary-date="${h(data?.latest || latestCompanyDate(group.companies))}"><span><b>${h(code)}</b><small>${data ? `ล่าสุด ${h(data.latest)}` : "ยังไม่พบงานในช่วงที่เลือก"}</small></span><i>${data ? `สำเร็จ ${num(data.completed)} · ตรวจ ${num(data.review)} · รอ ${num(data.waiting + data.error)}` : "เปิดดูบริษัท"}</i></button>`).join("")}</div>
              ${group.status === "active" ? `<details class="company-rule-details" open><summary>เงื่อนไขตรวจของ${h(group.name)}</summary><ol>${group.rules.map((rule) => `<li>${h(rule)}</li>`).join("")}</ol><p>ใช้กับ ${num(group.companies.length)} บริษัทในกลุ่มนี้ · หากหลักฐานไม่ครบหรือมีหลายคู่ ระบบต้องคงเคสให้ Audit ตรวจ</p></details>` : `<div class="company-group-pending"><b>ยังไม่เปิดกฎอัตโนมัติ</b><span>รอเงื่อนไขจาก Audit และจะไม่ใช้กฎของกลุ่มอื่นแทน</span></div>`}
              <div class="company-group-totals"><span class="ok">สำเร็จ <b>${num(totals.completed)}</b></span><span class="warn">ตรวจ <b>${num(totals.review)}</b></span><span class="bad">รอ/พลาด <b>${num(totals.waiting)}</b></span></div>
            </article>`;
          }).join("")}
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
      <div class="panel-heading"><div><p class="eyebrow">รายการล่าสุด</p><h2>สถานะรายวันแยกบริษัท</h2><small class="head-sub">อัปเดต ${liveOverviewState.updatedAt ? displayTime(liveOverviewState.updatedAt) : "-"}</small></div><span class="health ok">ข้อมูลจริง Supabase</span></div>
      <div class="table-wrap"><table class="live-table">
        <thead><tr><th>วันที่</th><th>บริษัท / ระบบ</th><th>สถานะ</th><th class="right">ไฟล์</th><th>ไฟล์ที่ยังขาด</th><th>ผลกระทบยอด</th></tr></thead>
        <tbody>${recent.map((row) => {
          const checklistRow = checklistByCompanyDate.get(`${row.business_date}|${String(row.company || "").toUpperCase()}`);
          const lifecycle = currentCountsByCompanyDate.get(`${row.business_date}|${String(row.company || "").toUpperCase()}`);
          const rowStatus = row.status === "completed" && Number(lifecycle?.open_count || 0) > 0 ? "completed_review" : row.status;
          const resultStatus = dailyResultStatus(checklistRow||{},row);
          const status = resultStatus.primary ? {label:resultStatus.label,tone:'green'} : resultStatus.manual ? {label:resultStatus.manual,tone:'blue'} : LIVE_STATUS[rowStatus] || { label: rowStatus || "ไม่ทราบ", tone: "grey" };
return `<tr class="action-row" data-summary-company="${h(row.company)}" data-summary-date="${h(row.business_date)}" role="link" tabindex="0"><td><b>${h(row.business_date)}</b></td><td><b>${h(row.company)}</b><small class="sub">${h(row.business_system || "ไม่ระบุระบบ")}</small></td><td><span class="badge ${status.tone}">${h(status.label)}</span><small class="sub">${h(resultStatus.automatic)}</small>${resultStatus.review?`<small class="sub danger">${h(resultStatus.review)}</small>`:''}${resultStatus.error?`<small class="sub danger">${h(resultStatus.error)}</small>`:''}${resultStatus.primary&&resultStatus.manual?`<small class="sub">${h(resultStatus.manual)}</small>`:''}</td><td class="right tnum">รับเข้า ${num(row.file_count)}${resultStatus.primary?`<small class="sub">ผลหลัก ${checklistRow?.primaryFileCount==null?'รอข้อมูลจำนวนไฟล์':num(checklistRow.primaryFileCount)+' ไฟล์'}</small>`:''}</td><td class="${missingText(row) === "ครบ" ? "muted" : "danger"}">${resultStatus.primary?'<b class="succe…101359 tokens truncated…actor:()=>Sb.authUser()?.id,role:()=>state.role,today:PROD_TODAY,
    load:Sb.monthlyAuditContext,create:Sb.createMonthlyAuditSet,detail:Sb.monthlyAuditDetail,review:Sb.monthlyAuditItemReview,
    assign:Sb.assignMonthlyAuditReviewer,save:Sb.saveMonthlyAuditAssessment,upload:Sb.uploadMonthlyAuditEvidence,
    preview:meta=>openStoredFilePreview({id:meta.id,name:meta.file_name,path:meta.storage_path,size:meta.size_bytes,mime:meta.mime_type,company:meta.company,kind:meta.kind||'doc_clarify',readOnly:true}),
  });
};

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
  const canReclassify = !meta.readOnly && !String(meta.path || '').startsWith('case-evidence/') && state.dataset === "production" && meta.id && typeof Sb !== "undefined" && Sb.signedIn();
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
  if(meta.readOnly) $('#filePreviewContent').insertAdjacentHTML('beforebegin',
    `<section class="panel"><b>หลักฐานในคลัง · เปิดอ่านเท่านั้น</b><p>${h(meta.evidenceOrigin || 'หลักฐาน')} · ${h(meta.caseCode || 'ไฟล์จากเมล')} · ไม่อ่านเป็นรายการกระทบยอด</p>${meta.uploadedBy ? `<small>ผู้แนบ/ผู้ส่ง: ${h(meta.uploadedBy)} · เวลา: ${h(meta.uploadedAt || '—')}</small>` : ''}${meta.correctionReason ? `<p>เหตุผลแก้หลักฐาน: ${h(meta.correctionReason)}</p><small>อ้างถึงไฟล์เดิม: ${h(meta.replacesEvidenceId || meta.replacesSourceFileId || '—')} · ไฟล์เดิมยังอยู่ในคลัง</small>` : ''}</section>`);
  if (canMatchClarification) EvidenceRecommendations.mount($("#modal .modal-body"), meta, companyOptions, Sb, openStoredFilePreview);
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
        render();
        showCaseSubmissionReceipt('clarification',`ส่งเอกสารให้ตรวจ ${num(result?.matched_count || ids.length)} เคส`);
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
    Sb.currentExceptionsSummary({ from: VISIBLE_DATE_FROM, to: DEFAULT_WORK_DATE, company: meta.company, limit: 5000 })
      .then((rows) => {
        const merged = new Map(localRows.map((row) => [row.dbId, row]));
        actionableAuditRows(rows).map(mapLiveException).forEach((row) => merged.set(row.dbId, row));
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
      if(meta.readOnly) {
        // Render authenticated bytes in the app; do not depend on a browser PDF plug-in.
        const cleanup = await StatementPreview.mount(target, {id:meta.id || meta.path, storage_path:meta.path});
        if(target.isConnected) $('#modal')._contentCleanup = cleanup;
        else cleanup?.();
        logAction('preview_file','case_evidence',meta.id || meta.path,`ดู PDF หลักฐาน ${name}`);
        return;
      }
      const originalUrl = await getSigned();
      if (pendingReplacementFile) return;
      target.innerHTML = `<iframe class="file-preview-frame" src="${h(originalUrl)}" title="ตัวอย่าง ${h(name)}"></iframe>`;
      if (canReclassify && typeof Sb.fileOcr === "function") {
        try {
          const ocr = await Sb.fileOcr(meta.id);
          if (pendingReplacementFile || !target.isConnected) return;
          PdfReview.mount(target, { url: originalUrl, evidence: ocr, name });
          if (meta.kind === 'stm_pdf' && ['monitor','audit_assistant','lead','admin'].includes(state.role)) {
            PdfSourceApproval.mount(target, {
              loadSource: () => Sb.recoverySource(meta.id),
              download: getDownload,
              approve: (payload, note) => {
                if (pendingReplacementFile) throw new Error('กรุณาปิดไฟล์ที่เลือกแทนก่อนยืนยันต้นฉบับเดิม');
                return Sb.approvePdfRecovery(payload, note);
              },
              onPage: page => { target.querySelector('iframe').src = originalUrl.split('#')[0] + '#page=' + page; },
            });
          }
          if (ocr) {
            const exportButton = document.createElement('button');
            exportButton.className = 'ghost-button';
            exportButton.textContent = 'ดาวน์โหลด Excel OCR';
            exportButton.addEventListener('click', () => {
              try { exportOcrExcel(meta, ocr); toast('สร้าง Excel จากผล OCR แล้ว', 'ok'); }
              catch (error) { toast(error.message, 'warn'); }
            });
            target.querySelector('.pdf-review-heading').append(exportButton);
          }
        } catch (error) {
          console.warn("Load OCR evidence failed", error);
          if (target.isConnected && !pendingReplacementFile) target.insertAdjacentHTML("afterbegin", '<p role="alert">โหลดข้อมูลที่อ่านจาก PDF ไม่สำเร็จ ยังตรวจภาพต้นฉบับได้ และยังไม่ยืนยันว่าไม่มีรายการ</p>');
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

function cloudMissingGroupsText(groups) {
  const label = (group) => {
    if (Array.isArray(group)) return group.map(label).join(" / ");
    if (typeof group === "string") return group || "ไม่ระบุกลุ่มไฟล์";
    if (!group || typeof group !== "object") return "ไม่ระบุกลุ่มไฟล์";
    const names = Array.isArray(group.source_labels)
      ? group.source_labels.filter((value) => typeof value === "string" && value.trim()).join(" / ") : "";
    const account = names || (typeof group.label === "string" && group.label)
      || (typeof group.identity === "string" && group.identity) || "ไม่ระบุบัญชี";
    const direction = { deposit: "ฝาก", withdraw: "ถอน", ฝาก: "ฝาก", ถอน: "ถอน" }[group.direction] || "";
    return [typeof group.kind === "string" ? group.kind : "", account, direction].filter(Boolean).join(" · ");
  };
  if (!Array.isArray(groups)) return "ยังไม่มีข้อมูลไฟล์ที่ขาด";
  return groups.length ? groups.map(label).join(", ") : "ครบ";
}

async function cloudLoad(force = false) {
  const key = cloudQueryKey();
  // A new filter owns a new request even while the previous scope is pending.
  // Otherwise its stale response returns without ever releasing the spinner.
  if (cloudState.key === key && (cloudState.loading || cloudState.auxiliaryLoading) && !force) return;
  if (!force && cloudState.key === key && cloudState.batches !== null) return;
  const requestId = ++cloudState.requestId;
  const changedFilter = cloudState.key !== key;
  cloudState.key = key;
  cloudState.loading = true;
  cloudState.auxiliaryLoading = true;
  cloudState.error = null;
  cloudState.partialError = null;
  cloudState.evidenceError = null;
  cloudState.caseAttachments = null;
  if (changedFilter) {
    cloudState.batches = null;
    cloudState.daily = null;
    cloudState.operations = null;
    cloudState.picked = {};
  }
  render();
  const to = state.filters.to || DB.BUSINESS_DATE;
  const from = state.filters.from || to;
  const company = state.filters.company;
  const current = () => !(requestId !== cloudState.requestId || key !== cloudQueryKey());
  const failed = new Map();
  const names = ["รายการเมล/ไฟล์", "สรุปรายวัน", "คิวกระทบยอด", "หลักฐานจากเคส"];
  // Bound each read group, including multi-request primary overlays. No writes
  // or reconciliation are retried here. Late responses cannot replace a scope.
  const read = async (index, load, apply) => {
    let timer;
    try {
      const value = await Promise.race([
        Promise.resolve().then(load),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('หมดเวลารอข้อมูล กรุณารีเฟรช')), 35000); }),
      ]);
      if (current()) apply(value);
    } catch (error) {
      if (current()) failed.set(index, `${names[index]} (${error?.message || 'อ่านไม่สำเร็จ'})`);
    } finally {
      clearTimeout(timer);
      if (current()) {
        cloudState.partialError = failed.size ? `โหลดไม่สำเร็จ: ${[...failed.values()].join(", ")}` : null;
        cloudState.error = failed.has(0) ? `${failed.get(0)} — ยังไม่แสดงจำนวนไฟล์เพื่อป้องกันยอดศูนย์ปลอม` : null;
        if (index === 0) cloudState.loading = false;
        if (index === 3 && failed.has(3)) cloudState.evidenceError = 'โหลดหลักฐานจากเคสไม่สำเร็จ กรุณารีเฟรช ไม่ใช่การยืนยันว่าไม่มีหลักฐาน';
        if (state.route === 'cloud') render();
      }
    }
  };
  await Promise.all([
    read(0, () => Sb.batches({from, to, company, force}), value => { cloudState.batches = value || []; }),
    read(1, () => Sb.dailyStatus({from, to, company, limit:100}), value => { cloudState.daily = value || []; }),
    read(2, () => Sb.operations({from, to, company, limit:200}), value => { cloudState.operations = value || []; }),
    read(3, () => Sb.caseEvidenceLibrary({from, to, company}), value => { cloudState.caseAttachments = value; }),
  ]);
  if (!current()) return;
  cloudState.auxiliaryLoading = false;
  if (state.route === 'cloud') render();
}

/* โหลดไฟล์จาก Storage แล้วส่งเข้าตัวอ่านเดิม */
async function cloudImport(files, opts = {}) {
  if(files.some(file=>file.excluded))throw Error('มีไฟล์ที่ยกเว้นจากการรัน กรุณาโหลดทะเบียนล่าสุดและเลือกใหม่');
  // Evidence must never enter parsers, markParsed or reconciliation, even if supplied manually.
  files = files.filter(file => file.kind !== 'doc_clarify' && !String(file.storage_path || '').startsWith('case-evidence/'));
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

  if (cloudState.key !== cloudQueryKey() || (cloudState.batches === null && !cloudState.loading && !cloudState.error)) {
    cloudLoad();
  }

  const batches = cloudState.batches || [];
  const allFiles = batches.flatMap((b) => (b.source_files || []).map((f) => ({ ...f, business_date: b.business_date, company: f.company || b.company, subject: b.subject })));
  const isProblemFile = (file) => Boolean((file.parse_error && !statementNeedsBoReview(file)) || file.kind === "unknown");
  const isReadyFile = (file) => !statementNeedsBoReview(file) && !isProblemFile(file) && Boolean(file.parsed || file.kind === "doc_clarify");
  const isWaitingFile = (file) => !statementNeedsBoReview(file) && !isProblemFile(file) && !isReadyFile(file);
  const reviewFiles = allFiles.filter(statementNeedsBoReview);
  const problemFiles = allFiles
    .filter(isProblemFile)
    .sort((a, b) => String(b.business_date || "").localeCompare(String(a.business_date || "")) || String(a.company || "").localeCompare(String(b.company || ""), "th") || String(a.file_name || "").localeCompare(String(b.file_name || ""), "th"));
  const readable = allFiles.filter((f) => !f.excluded && /\.(xlsx|xlsm|xls|csv|txt|pdf)$/i.test(f.file_name) && f.kind !== "doc_clarify");
  const readyFiles = allFiles.filter(isReadyFile);
  const waitingFiles = allFiles.filter(isWaitingFile);
  const queueableFiles = readable.filter((f) => !f.parsed && !f.parse_error && f.kind !== "unknown");
  const pickedFiles = queueableFiles.filter((f) => cloudState.picked[f.id]);
  const visibleFile = (file) => cloudState.fileView === "review"
    ? statementNeedsBoReview(file)
    : cloudState.fileView === "problem"
    ? isProblemFile(file)
    : cloudState.fileView === "ready"
      ? isReadyFile(file)
      : cloudState.fileView === "waiting"
        ? isWaitingFile(file)
        : true;
  const visibleBatches = batches.map((batch) => ({ ...batch, source_files: (batch.source_files || []).filter(visibleFile) })).filter((batch) => batch.source_files.length);
  const daily = cloudState.daily || [];
  const operations = cloudState.operations || [];
  const fileSnapshot = Sb.fileSnapshotInfo({
    from: state.filters.from || state.filters.to || DB.BUSINESS_DATE,
    to: state.filters.to || DB.BUSINESS_DATE,
    company: state.filters.company,
  });
  const jobLabel = { waiting_files: "รอไฟล์", ready: "พร้อม", queued: "เข้าคิว", running: "กำลังรัน", completed: "สำเร็จ", needs_review: "ต้องตรวจสอบ", error: "ล้มเหลว" };
  const jobTone = { waiting_files: "amber", ready: "blue", queued: "blue", running: "violet", completed: "green", needs_review: "red", error: "red" };

  root.innerHTML = `
    ${operations.some(j=>j.runNoticeError||j.runNotice?.hold?.paused||j.runNotice?.manualOnly||j.status==='error'||(['queued','error'].includes(j.status)&&Number(j.runNotice?.attempt_count)>=3))?`<section class="panel" aria-label="แจ้งเหตุที่งานยังไม่รัน"><h2>งานที่ต้องทราบก่อนรัน</h2><p>แยกคิวรอบหลักกับงานตรวจมือ · ตรวจเหตุผลและขั้นตอนต่อไปด้านล่าง</p>${operations.filter(j=>j.runNoticeError||j.runNotice?.hold?.paused||j.runNotice?.manualOnly||j.status==='error'||(['queued','error'].includes(j.status)&&Number(j.runNotice?.attempt_count)>=3)).map(j=>`<h3>${h(j.company)} · ${h(j.business_date)}</h3>${FileRunManagement.noticeHtml(j.runNotice)}`).join('')}<p>ผู้มีสิทธิ์สั่งตรวจใช้เมนู “รันมือ / จัดการไฟล์” · ผู้ชี้แจงแจ้ง Audit/หัวหน้าได้จากเหตุผลนี้</p></section>`:''}
    <section class="panel" id="caseEvidenceLibraryPanel">
      <div class="panel-heading"><div><p class="eyebrow">Evidence Library</p><h2>คลังหลักฐาน · เมลและผู้ชี้แจง</h2><small>ใช้บริษัทและวันที่เคสจากตัวกรองด้านบน · เก็บไฟล์เดิมและประวัติครบ · ไม่เข้ากระทบยอด</small></div></div>
      ${cloudState.evidenceError ? `<p role="alert">${h(cloudState.evidenceError)}</p>` : cloudState.caseAttachments === null ? '<p role="status">กำลังโหลดหลักฐานจากเคส…</p>' : ''}
      <div id="caseEvidenceLibrary"></div>
    </section>
    <section class="status-strip four action-tiles">
      <article class="ok" data-scroll-cloud="cloudInbox"><span>เมลที่ดึงเข้ามาแล้ว</span><strong>${num(batches.length)}</strong><small>ช่วง ${h(rangeLabel())} · กดดูเมล</small></article>
      <article data-cloud-view="all"><span>ไฟล์ทั้งหมด</span><strong>${num(allFiles.length)}</strong><small>กดดูทุกสถานะ</small></article>
      <article class="${readyFiles.length ? "ok" : ""}" data-cloud-view="ready"><span>พร้อมใช้งาน</span><strong>${num(readyFiles.length)}</strong><small>อ่านสำเร็จ · กดดูรายการ</small></article>
      <article data-cloud-view="waiting"><span>รอประมวลผล</span><strong>${num(waitingFiles.length)}</strong><small>ไม่ใช่ไฟล์เสีย · รอระบบอ่าน</small></article>
      <article data-cloud-view="review"><span>อ่านแล้ว · รอเทียบ BO</span><strong>${num(reviewFiles.length)}</strong><small>ไม่พบรายการในวันตรวจ · ไม่ต้องรันไฟล์เดิมซ้ำ</small></article>
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
          <td><span class="badge red">${file.parse_error ? h(statementReviewLabel(file)) : "ยังไม่ทราบประเภท"}</span><small class="sub danger">${h(file.parse_error || "ต้องเปิด Preview แล้วเลือกประเภทไฟล์")}</small></td>
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
            <td><b>${h(j.business_date)}</b>${j.late_file ? '<small class="sub danger">มีไฟล์มาช้า · ตรวจสถานะรันก่อน</small>' : ""}</td>
            <td>${h(j.company)}${j.business_system ? `<small class="sub">${h(j.business_system)}</small>` : ""}</td>
            <td><span class="badge ${j.runNotice?.hold?.paused||j.runNotice?.manualOnly?'amber':jobTone[j.status] || "grey"}">${h(j.runNotice?.hold?.paused||j.runNotice?.manualOnly?'พักบอทรอบหลัก':jobLabel[j.status] || j.status)}</span>${j.runNoticeError?'<small class="sub danger">ยังตรวจสถานะพักไม่ได้ · โหลดสถานะล่าสุดก่อนสั่งงาน</small>':j.runNotice&&(j.runNotice.hold?.paused||j.runNotice.manualOnly||j.status==='error'||Number(j.runNotice.attempt_count)>=3)?FileRunManagement.noticeHtml(j.runNotice):''}${j.last_error && !j.runNotice?.workerFailure && !j.last_error.includes("ตรวจรูปแบบไฟล์หรือเพิ่มไฟล์ที่ถูกต้อง") ? `<small class="sub danger" title="${h(j.last_error)}">${h(j.last_error.slice(0, 80))}</small>` : ""}</td>
            <td class="right tnum">${num(j.mail_count)}</td><td class="right tnum">${num(j.file_count)}</td>
            <td class="muted">${h(cloudMissingGroupsText(j.missing_groups))}</td>
            <td>${j.match_rate == null ? "-" : `${Number(j.match_rate).toFixed(2)}% · exception ${num(j.exception_count)}`}</td>
          </tr>`,
          )
          .join("")}</tbody>
      </table></div>
      <p class="hint">คิวรอบหลักกับงานตรวจมือเป็นคนละงาน · งานพัก/ไฟล์แก้ไขจะไม่รันหลักอัตโนมัติ เลือก “รันมือ / จัดการไฟล์” เพื่อดูเหตุผลและรันรายงานแยก</p>
    </section>`
        : ""
    }

    <section class="panel" id="cloudInbox">
      <div class="panel-heading">
        <div><p class="eyebrow">Cloud Inbox</p><h2>ไฟล์จากเมล AUDIT 2</h2><small class="head-sub">ล็อกอินเป็น ${h(Sb.currentEmail())} · ${cloudState.error ? "โหลดข้อมูลไม่สำเร็จ" : cloudState.partialError ? h(cloudState.partialError) : "อัปเดตล่าสุด " + (c.lastSync ? displayTime(c.lastSync) : "-")}</small></div>
        <div class="inline-actions">
          <button class="ghost-button sm" id="cReload" ${cloudState.loading ? "disabled" : ""}>${cloudState.loading ? "กำลังโหลด..." : "รีเฟรช"}</button>
          <button class="ghost-button sm" id="cEvidenceRecommendations">คู่แนะนำจากหลักฐาน</button>
          <button class="ghost-button sm" id="cPickNew">เลือกเฉพาะไฟล์ที่พร้อมรัน</button>
          <button class="primary-button sm" id="cImport" ${pickedFiles.length ? "" : "disabled"}>อ่านไฟล์ที่เลือก ${pickedFiles.length ? `(${pickedFiles.length})` : ""}</button>
        </div>
      </div>
      <p class="hint" role="status">สแนปช็อตทะเบียนไฟล์ในแท็บนี้${fileSnapshot ? ' · บันทึกเมื่อ ' + h(displayTime(fileSnapshot.updatedAt)) : ''} · เปลี่ยนหน้าใช้ข้อมูลเดิม · ตัวอย่างต้นฉบับพักในหน่วยความจำไม่เกิน 5 นาที · กดรีเฟรชเพื่ออ่านทะเบียนล่าสุด · ไม่ใช่การยืนยันสถานะปิดเคส</p>
      ${cloudState.auxiliaryLoading ? '<p role="status">กำลังโหลดสรุป/คิวและหลักฐานเพิ่มเติม · รายการไฟล์แสดงแยกได้ ไม่รันงาน</p>' : ''}
      <div class="cloud-file-tabs" role="tablist" aria-label="กรองสถานะไฟล์">
        ${[["all", "ทั้งหมด", allFiles.length], ["ready", "พร้อมใช้งาน", readyFiles.length], ["waiting", "รอประมวลผล", waitingFiles.length], ["review", "อ่านแล้ว · รอเทียบ BO", reviewFiles.length], ["problem", "มีปัญหาต้องแก้", problemFiles.length]].map(([value, label, count]) => `<button type="button" role="tab" data-cloud-file-view="${value}" aria-selected="${cloudState.fileView === value}" class="${cloudState.fileView === value ? "active" : ""}">${label} <b>${num(count)}</b></button>`).join("")}
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
            <span>${h(b.sender || "-")} · รับเมื่อ ${h(displayTime(b.received_at))}</span>
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
                  const canQueue = canRead && !f.excluded && !f.parsed && !f.parse_error && f.kind !== "unknown";
                  return `<tr class="${f.parse_error && !statementNeedsBoReview(f) ? "bad" : ""}">
                  <td>${canQueue ? `<input type="checkbox" data-pick="${h(f.id)}" ${cloudState.picked[f.id] ? "checked" : ""} />` : ""}</td>
                  <td><button class="file-name-link" data-storage-open="${h(f.storage_path)}" data-file-id="${h(f.id)}" data-file-name="${h(f.file_name)}" data-file-mime="${h(f.mime_type || "")}" data-file-size="${h(f.size_bytes || "")}" data-file-kind="${h(f.kind || "")}" data-file-company="${h(f.company || b.company || "")}" data-file-date="${h(b.business_date || "")}" data-file-status="${f.parse_error ? "error" : f.parsed ? "parsed" : "waiting"}" ${f.storage_path ? "" : "disabled"}><span>${h(f.file_name)}</span><small>กดดูตัวอย่าง ↗${f.checksum ? ` · checksum ${h(String(f.checksum).slice(0, 10))}…` : ""}</small></button>${f.from_zip ? `<small class="sub">จาก ${h(f.from_zip)}</small>` : ""}</td>
                  <td>${h(KIND_LABEL[f.kind] || f.kind || "-")}${f.reference_date?`<small class="sub">วันอ้างอิง ${h(f.reference_date)}</small>`:''}${f.excluded?'<small class="sub">ยกเว้นจากการรัน · เก็บต้นฉบับ</small>':''}</td>
                  <td class="right tnum">${f.size_bytes ? Math.round(f.size_bytes / 1024).toLocaleString() + " KB" : "-"}</td>
                  <td>${
                    f.excluded ? '<span class="file-state wait"><span><b>ยกเว้นจากการรัน</b><small>ไม่ลบไฟล์และไม่เปลี่ยนเคส</small></span></span>' : f.parse_error
                      ? `<span class="file-state wait" title="${h(f.parse_error)}"><i>!</i><span><b>${h(statementReviewLabel(f))}</b><small>กดตรวจรายละเอียด — ยังไม่ยืนยันผลกระทบยอด</small></span></span>`
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
              <td class="muted">${h(displayTime(d.last_mail_at))}</td>
            </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>`
        : ""
    }`;

  if(cloudState.caseAttachments !== null) CaseEvidenceLibrary.mount($('#caseEvidenceLibrary'), CaseEvidenceLibrary.entries(cloudState.batches, cloudState.caseAttachments), openStoredFilePreview);
  // Append a distinct metadata action; never reuse preview/import buttons.
  if(FileExclusion.canManage(state.role)) root.querySelectorAll('tr').forEach(row=>{
    const preview=row.querySelector('[data-file-id]');if(!preview)return;
    const file=allFiles.find(f=>f.id===preview.dataset.fileId);if(!file)return;
    const button=document.createElement('button');button.className='ghost-button xs';button.type='button';
    button.textContent=file.excluded?'คืนไฟล์ให้เลือกใช้':'ยกเว้นไฟล์จากการรัน';
    button.dataset.excludeFile=file.id;button.onclick=async()=>{if(await openFileExclusion(file.id))cloudLoad(true);};
    row.querySelector('.file-actions')?.appendChild(button);
  });
  $("#cReload").addEventListener("click", () => cloudLoad(true));
  $("#cEvidenceRecommendations").addEventListener("click", () => EvidenceRecommendations.browse(Sb, state.date || DEFAULT_WORK_DATE, openStoredFilePreview));
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
  AuditUi.tabs(root);
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
    if (norm.quality && !norm.quality.complete) throw new Error(`PDF อ่านได้บางส่วน: ${norm.quality.unreadRows.length} บรรทัดยังอ่านไม่ได้ / ${norm.quality.invalidRows.length} รายการต้องยืนยัน — ส่งอ่านผ่าน OCR หรือตรวจต้นฉบับก่อนกระทบยอด`);
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
      <div class="panel-heading"><div><p class="eyebrow">Match Run</p><h2>ผลการรันล่าสุด</h2></div><span class="health ok">${h(displayTime(ImportState.lastRun.at))}</span></div>
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
    <div class="notif-list">${list.map((row)=>`<div class="notif ${row.read_at?"":"unread"}"><span class="badge ${tone[row.level]||"grey"}">${h(row.level)}</span><div><strong>${h(row.title)}</strong><span>${h(row.detail||"")}</span><small>${h(displayTime(row.created_at))}${row.company?` · ${h(row.company)}`:""}</small></div>${row.business_date?`<button class="ghost-button xs" data-notif-date="${h(row.business_date)}" data-notif-company="${h(row.company||"ALL")}">เปิดดู</button>`:""}</div>`).join("")||`<p class="empty">ยังไม่มีการแจ้งเตือนจากระบบ</p>`}</div>
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
              <small>${h(displayTime(n.at))}</small>
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

function bangkokDate(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const base = `${parts.find((p) => p.type === "year").value}-${parts.find((p) => p.type === "month").value}-${parts.find((p) => p.type === "day").value}`;
  const d = new Date(base + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function cloudWorkerTick() {
  // Cloud owns automatic jobs. Browsers must never claim the same queue:
  // user-scoped RLS and stale tabs can otherwise fail a job before n8n sees it.
  if (Sb.configured() && Sb.signedIn()) await Sb.queueDueJobs(bangkokDate(-14), bangkokDate(1));
}

function startCloudWorker() {
  clearTimeout(cloudWorkerTimer);
  // The published n8n schedule runs without an open browser.
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
  const fmtTime = (iso) => (iso ? displayTime(iso) : "ยังไม่เคยรัน");

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
        <div><span>บันทึกล่าสุด</span><b>${h(Store.data.lastSavedAt ? displayTime(Store.data.lastSavedAt) : "-")}</b></div>
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

function downloadBoWaitingCaseRequest(runId, rows) {
  const blob = new Blob([JSON.stringify({run_id: runId, rows}, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `bo-waiting-${rows[0]?.company || 'company'}-${rows[0]?.boDate || 'date'}.json`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
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
  return { track: "daily", system: sys, unassigned: !sys };
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
  if(e.documentDueAt){const label=displayTime(e.documentDueAt);return {label,short:label,detail:'SLA เอกสารตามบริษัท ณ วันส่งคำขอ ไม่เปลี่ยนเมื่อส่งซ้ำหรือแก้ตั้งค่า และไม่ยืนยันความเสียหายอัตโนมัติ'};}
  const c = DB.settings.clarify;
  return { label: `${e.date} เวลา ${c.dailyCutoff} น.`, short: c.dailyCutoff + " น.", detail: `ติดตามแบบเรียลไทม์ — ส่งให้หัวหน้ากะภายใน ${c.dailyCutoff} ของวันตรวจ และชี้แจงกลับภายใน ${c.dailyRespondHours} ชม.` };
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
    statusName: caseStatusMeta(e).name,
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
    if (!liveOverviewState.exceptionsReady) {
      root.innerHTML = `<section class="panel" role="status" aria-busy="${liveOverviewState.loading || liveOverviewState.auxiliaryLoading}"><h2>${liveOverviewState.auxiliaryError ? 'ยังโหลดรายการเคสไม่สำเร็จ' : 'กำลังโหลดรายการเคสจริง…'}</h2><p>— ยังไม่สรุปว่าไม่มีเคสหรือยอดเป็นศูนย์ · คงบริษัทและช่วงวันที่ที่เลือก</p><p>${h(liveOverviewState.auxiliaryError || '')}</p><button class="ghost-button" id="clarifyLoadRetry">ลองโหลดรายการอีกครั้ง</button></section>`;
      $('#clarifyLoadRetry').onclick = () => loadLiveOverview(true);
      return;
    }
    const rows = scopedExceptions().filter((e) => !e.closureRequestId&&["open", "clarifying", "answered"].includes(e.status)&&(state.role!=='shift_lead'||!!e.requestedAt));
    const newRows = rows.filter((e) => e.status === "open");
    const waitingRows = rows.filter((e) => e.status === "clarifying");
    const answeredRows = rows.filter((e) => e.status === "answered");
    const groups = [...new Set(rows.map((e) => e.company || "ไม่ระบุ"))].sort((a, b) => a.localeCompare(b, "th"));
    root.innerHTML = `
      ${liveOverviewState.auxiliaryError ? `<section class="alert warn" role="status">ข้อมูลล่าสุดยังมาไม่ครบ · แสดงข้อมูลที่โหลดได้ครั้งก่อน ไม่ใช่ยอดศูนย์: ${h(liveOverviewState.auxiliaryError)}</section>` : ''}
      ${moreCaseState.hasMore ? '<section class="alert warn">รายการที่โหลดอาจยังไม่ครบ กรุณากรองบริษัทหรือช่วงวันที่ให้แคบลงก่อนสรุปจำนวนรวม</section>' : ''}
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
      <section class="panel"><div class="panel-heading"><div><p class="eyebrow">รายการจริง</p><h2>เคสที่ต้องติดตาม</h2></div></div><div class="table-wrap"><table><thead><tr><th>เคส</th><th>วันที่</th><th>บริษัท</th><th>ประเภท</th><th>ผู้เกี่ยวข้อง</th><th>สถานะ</th><th>SLA</th><th class="right">ยอดที่ต้องตรวจ</th></tr></thead><tbody>${rows.map((e) => `<tr><td><button class="link-btn" data-open-ex="${h(e.id)}">${h(e.id)}</button></td><td>${h(e.date)} ${h(e.time)}</td><td><b>${h(e.company)}</b></td><td>${h(e.typeName)}</td><td>${h(e.employee)}</td><td><span class="badge ${caseStatusMeta(e).tone}">${h(caseStatusMeta(e).name)}</span></td><td class="${e.overSla ? "danger" : ""}">${e.overSla ? "เกิน " : ""}${num(e.ageHours)}/${num(e.slaHours)} ชม.</td><td class="right tnum">${money0(e.riskAmount || Math.abs(e.amountDiff))}</td></tr>`).join("") || `<tr><td colspan="8" class="empty">ไม่มีรายการ</td></tr>`}</tbody></table></div></section>`;
    root.querySelectorAll("[data-open-ex]").forEach((button) => button.addEventListener("click", async () => {
      const id=button.dataset.openEx;
      // A company refresh may clear the row cache while its preserved DOM is
      // still visible. Re-read the selected UUID under RLS instead of claiming
      // the persisted case is missing. No extra read on the normal path.
      try {
        if(DB.exceptions.some(row=>row.id===id))await openException(id);
        else await openEvidenceRelatedCase(id);
      } catch(error) { toast('เปิดรายละเอียดเคสไม่ได้: '+error.message,'warn'); }
    }));
    const openCompanyCases = (company) => {
      if (state.role === 'shift_lead') {
        // Same-route hash assignment emits no hashchange. Repaint the already
        // scoped read-only snapshot, keeping dates, drafts and case state.
        state.filters.company = company;
        render();
        return;
      }
      go("exceptions", {
        filters: { company },
        exFilter: { q: "", type: "ALL", severity: "ALL", status: "ACTION", sla: false },
      });
    };
    root.querySelectorAll("[data-clarify-company]").forEach((card) => {
      card.addEventListener("click", () => openCompanyCases(card.dataset.clarifyCompany));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openCompanyCases(card.dataset.clarifyCompany);
        }
      });
    });
    if(state.role==='shift_lead') $('#openApprovalQueue').hidden=true;
    $("#openApprovalQueue")?.addEventListener("click", () => {if(state.role!=='shift_lead')go(can('approve')?"approvals":"audit-review");});
    return;
  }
  retagTracks();
  const all = scopedExceptions().filter((e) => !["closed", "approved"].includes(e.status));
  const daily = all;
  const cyc = [];
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
      <article class="${daily.length ? "warn" : "ok"}"><span>รายการชี้แจงแบบเรียลไทม์</span><strong>${num(daily.length)}</strong><small>ไม่รวบรอรายเดือน</small></article>
      <article><span>กำหนดติดตาม</span><strong>${h(c.dailyCutoff)} น.</strong><small>ใช้กับทุกระบบและทุกบริษัท</small></article>
      <article><span>ชี้แจงกลับมาแล้ว</span><strong>${num(all.filter((e) => e.status === "answered").length)}</strong><small>รอออดิทตรวจทาน</small></article>
      <article class="bad"><span>ค้างเกินกำหนด</span><strong>${num(all.filter((e) => e.overSla).length)}</strong><small>ต้องเร่งติดตาม</small></article>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">System Mapping</p><h2>บริษัทไหนอยู่ระบบไหน</h2>
        <small class="head-sub">สายชี้แจงมาจากระบบต้นทาง ไม่ใช่ความรุนแรง — ตั้งครั้งเดียว ระบบจำไว้ให้</small></div>
        <span class="health ${pendingActive.length ? "attention" : pending.length ? "" : "ok"}">${pending.length ? `ยังไม่ได้กำหนด ${pending.length} บริษัท` : "กำหนดครบแล้ว"}</span>
      </div>
      ${pendingActive.length ? `<p class="hint danger">บริษัท <b>${h(pendingActive.join(", "))}</b> มีข้อมูลเข้ามาแล้วแต่ยังไม่ได้กำหนดระบบต้นทาง — ยังคงติดตามแบบเรียลไทม์</p>` : ""}
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
                <button class="chip-btn ${cur === "SYS123" ? "on blue" : ""}" data-sys="${h(code)}" data-val="SYS123">123 · เรียลไทม์</button>
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

    <section class="panel" hidden aria-hidden="true">
      <div class="panel-heading">
        <div><p class="eyebrow">${h(S123.name)}</p><h2>ประวัติรายรอบเดิม</h2>
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
                <td><span class="badge ${caseStatusMeta(e).tone}">${h(caseStatusMeta(e).name)}</span></td>
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
  clearTimeout(m._hideTimer);
  m._hideTimer = null;
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
  AuditUi.open(m);
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
  AuditUi.close(m);
  clearTimeout(m._hideTimer);
  m._hideTimer = setTimeout(() => { m.hidden = true; m._hideTimer = null; }, 200);
}

// Reuse the exact visible/filter-scoped rows. Do not expand access or date scope on export.
function buildReviewExportSheets() {
  const combined = SHEET_BUILDERS.exceptions.build();
  const directionColumn = combined.headers.indexOf("ทิศทาง");
  const split = (name, direction) => ({ ...combined, name,
    title: `${name} — ${combined.title}`,
    rows: combined.rows.filter((row) => row[directionColumn] === direction) });
  const sheets = [split("ฝาก (ฝ)", "ฝาก"), split("ถอน (ถ)", "ถอน")];
  const unknown = combined.rows.filter((row) => !["ฝาก", "ถอน"].includes(row[directionColumn]));
  if (unknown.length) sheets.push({ ...combined, name: "รอระบุประเภท", rows: unknown });
  sheets.push({ ...combined, name: "รวม" });
  return sheets;
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
        headers: ["สถานะ", "เคส", "วันที่", "บริษัท", "ทิศทาง", "บัญชี / Provider", "BO วันที่ / เวลา", "BO ผู้ทำรายการ", "ยอด BO", "STM วันที่ / เวลา", "STM ธนาคาร", "ยอด STM", "ต่างเวลา (วิ)", "ต่างยอด", "ผลการจับคู่", "คำชี้แจง / หมายเหตุ", "ระดับ", "กำหนดส่ง", "เกิน SLA", "BO User", "BO บัญชีลูกค้า", "BO ชื่อลูกค้า", "BO ท้าย 4 ตัว", "BO รหัสอ้างอิง", "STM/PM User", "STM/PM บัญชีลูกค้า", "STM/PM ชื่อลูกค้า", "STM/PM ท้าย 4 ตัว", "STM/PM รหัสอ้างอิง"],
        widths: [14, 11, 12, 12, 9, 18, 21, 15, 13, 21, 18, 13, 13, 13, 24, 42, 10, 14, 10, 18, 20, 25, 14, 35, 18, 20, 25, 14, 35],
        rows: rows.map((e) => {
          const hasStm = e.bankAmount !== null;
          const hasBo = e.systemAmount !== null;
          const explanation = e.resolutionNote || (e.notes || []).at(-1)?.text || "";
          const result = hasStm && hasBo
            ? e.type === "time_diff" ? "ยอดตรง · เวลาต่าง" : e.type === "amount_diff" ? "เวลาใกล้ · ยอดต่าง" : e.typeName
            : hasStm ? "ไม่พบฝั่ง BO" : "ไม่พบฝั่ง STM";
          return [
            caseStatusMeta(e).name, e.id, e.date, e.company, e.direction, e.account,
            hasBo ? exceptionSideTimestamp(e, "bo") : "", hasBo ? e.employee : "", hasBo ? e.systemAmount : "",
            hasStm ? exceptionSideTimestamp(e, "stm") : "", hasStm ? e.bank : "", hasStm ? e.bankAmount : "",
            hasStm && hasBo ? exceptionTimeDiffLabel(e) : "", hasStm && hasBo ? e.amountDiff : "", result,
            explanation || "เว้นไว้รอชี้แจง", sevMeta(e.severity).name, dueOf(e).short, e.overSla ? "เกิน" : "ปกติ",
            ...["bo", "stm"].flatMap((side) => { const c = reviewCustomer(e, side); return [c.user, c.account, c.name, c.tail, c.reference]; }),
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
function exportSheets(baseName, sheets, context = {}) {
  if (!can("export")) return deny("export ข้อมูล");
  const ascii =
    FILE_SLUG[baseName] ||
    baseName
      .replace(/[^\x20-\x7E]+/g, "-")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") ||
    "report";
  const stamp = context.date || (state.filters.from === state.filters.to ? state.filters.from : `${state.filters.from}_to_${state.filters.to}`);
  const meta = `ช่วงข้อมูล ${context.date || rangeLabel()} · บริษัท ${context.company || (state.filters.company === "ALL" ? "ทุกบริษัท" : state.filters.company)} · ออกโดย ${currentUser().username} เมื่อ ${nowStamp()}`;
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
        <label>ตั้งแต่<input type="date" id="expFrom" value="${f.from}" min="${VISIBLE_DATE_FROM}" max="${VISIBLE_DATE_TO}" /></label>
        <label>ถึง<input type="date" id="expTo" value="${f.to}" min="${VISIBLE_DATE_FROM}" max="${VISIBLE_DATE_TO}" /></label>
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
    state.filters.from = visibleDate(e.target.value);
    state.filters.preset = "custom";
    refresh();
  });
  $("#expTo").addEventListener("change", (e) => {
    state.filters.to = visibleDate(e.target.value);
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
  exportSheets("รายการผิดปกติ", buildReviewExportSheets());
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

async function applyAuthenticatedRole(entryAccess) {
  const user = Sb.authUser() || {};
  const email = String(user.email || "").toLowerCase();
  const app = window.APP_CONFIG || {};
  let access = null;
  try {
    if (entryAccess?.status === 'rejected') throw entryAccess.reason;
    access = entryAccess?.status === 'fulfilled' ? entryAccess.value : await Sb.myAccess();
    if (Array.isArray(access)) access = access[0] || null;
  } catch (error) {
    /* ช่วง deploy migration ให้บัญชี bootstrap เดิมยังเข้าไปติดตั้ง schema ได้
       บัญชีอื่นจะไม่ถูกอนุญาตจากค่า default หรือ metadata ใน browser */
    const bootstrapRole = app.roleByEmail?.[email];
    if (!bootstrapRole) throw error;
    access = { email, full_name: email, role: bootstrapRole, active: true, companies: ["*"], migration_pending: true };
  }
  if (!access?.active) {
    const error = new Error("บัญชีนี้ถูกระงับหรือยังไม่ได้กำหนดสิทธิ์ กรุณาติดต่อผู้ดูแลระบบ");
    error.code = 'APP_ACCESS_DENIED';
    throw error;
  }
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
  if (enterProductionApp.pending) return enterProductionApp.pending;
  const pending = performProductionEntry();
  enterProductionApp.pending = pending;
  try { return await pending; }
  finally { if (enterProductionApp.pending === pending) enterProductionApp.pending = null; }
}

async function readProductionEntryChecks() {
  // Both checks must finish before admission. Settle access errors immediately
  // even when the password gate is slower; no data prefetch before admission.
  const [password, access] = await Promise.allSettled([
    Sb.passwordChangeRequired(), Sb.myAccess(),
  ]);
  if (password.status === 'rejected') throw password.reason;
  return { passwordRequired: password.value, access };
}

async function performProductionEntry() {
  const user = Sb.authUser() || {};
  const email = String(user.email || "").trim().toLowerCase();
  const preserveWork = typeof state !== 'undefined' && state.access?.loaded && state.access.email?.toLowerCase() === email && $('#appShell').hidden === false;
  const priorScope = preserveWork ? JSON.stringify([state.access.role, state.access.companies]) : null;
  showConnectingGate('กำลังตรวจสิทธิ์ · เก็บหน้าทำงานและข้อความร่างไว้ ยังบันทึกไม่ได้จนกว่าจะตรวจสำเร็จ', null, preserveWork);
  if (!email) {
    Sb.signOut();
    showLoginGate("ไม่พบอีเมลของบัญชี กรุณาเข้าสู่ระบบใหม่");
    return false;
  }
  const accessWaitTimer = setTimeout(() => {
    if (!$('#connectionGate').hidden) $('#connectionMessage').textContent = 'ฐานข้อมูลตรวจสิทธิ์ตอบกลับช้า กำลังรอแบบจำกัดเวลา — ยังไม่ได้ออกจากระบบ ไม่ต้องรีเฟรชหรือเข้าสู่ระบบซ้ำ';
  }, 10000);
  try {
    const entryChecks = await readProductionEntryChecks();
    if(entryChecks.passwordRequired){
      $('#accessWaitNotice')?.remove?.();
      for (const id of ['#drawer', '#modal', '#drawerOverlay', '#modalOverlay']) { const node = $(id); if (node) node.hidden = true; }
      $('#connectionGate').hidden=true;$('#appShell').hidden=true;$('#loginGate').hidden=false;
      $('#loginForm').hidden=true;$('#resetForm').hidden=false;
      $('#resetForm').dataset.firstPassword='true';$('#resetError').hidden=true;
      $('#resetForm h1, #resetForm h2').textContent='ตั้งรหัสผ่านส่วนตัวก่อนเริ่มใช้งาน';
      $('#resetForm .login-lead').textContent='ตั้งรหัสใหม่อย่างน้อย 9 ตัว มีตัวอักษรและตัวเลข ไม่ใช้รหัสเริ่มต้นเดิม ยังไม่เปิดข้อมูลจนกว่าจะบันทึกสำเร็จ';
      return false;
    }
    await applyAuthenticatedRole(entryChecks.access);
  } catch (error) {
    if (error.code === 'APP_ACCESS_DENIED') {
      Sb.signOut();
      showLoginGate(error.message);
    } else {
      showConnectingGate('เชื่อมต่อเพื่อตรวจสิทธิ์ยังไม่สำเร็จ — ไม่ได้ออกจากระบบ และยังไม่ได้ยืนยันว่าบันทึกงานสำเร็จ: ' + (error.message || 'การเชื่อมต่อขัดข้อง'), () => enterProductionApp(), preserveWork);
    }
    return false;
  } finally { clearTimeout(accessWaitTimer); }
  $('#accessWaitNotice')?.remove?.();
  $('#appShell').inert = false;
  for (const id of ['#drawer', '#modal']) { const node = $(id); if (node) node.inert = false; }
  if (preserveWork && priorScope === JSON.stringify([state.access.role, state.access.companies])) return true;
  prepareProductionData();
  $('#connectionGate').hidden = true;
  $("#loginGate").hidden = true;
  $("#appShell").hidden = false;
  state.route = parseHash();
  if (!ROUTE_ROLES[state.role].includes(state.route)) state.route = "cloud";
  if (!location.hash || parseHash() !== state.route) location.hash = "#/" + state.route;
  cloudState.batches = null;
  cloudState.caseAttachments = null;
  cloudState.evidenceError = null;
  cloudState.daily = null;
  cloudState.operations = null;
  cloudState.key = "";
  cloudState.error = null;
  cloudState.partialError = null;
  liveOverviewState.daily = null;
  liveOverviewState.operations = null;
  liveOverviewState.quality = null;
  liveOverviewState.checklist = null;
  liveOverviewState.caseCounts = null;
  liveOverviewState.settings = null;
  liveOverviewState.damages = null;
  liveOverviewState.logs = null;
  liveOverviewState.notifications = null;
  liveOverviewState.matchEvidence = [];
  liveOverviewState.matchedStaleExceptions = 0;
  liveOverviewState.exceptionsReady = false;
  liveOverviewState.damagesReady = false;
  liveOverviewState.logsReady = false;
  liveOverviewState.coreErrors = [];
  liveOverviewState.key = "";
  dailyCompanyState.date = "";
  dailyCompanyState.company = "";
  dailyCompanyState.batches = null;
  dailyCompanyState.matchEvidence = [];
  dailyCompanyState.matchedStaleExceptions = 0;
  dailyCompanyState.quality = null;
  dailyCompanyState.operations = null;
  dailyCompanyState.checklist = null;
  dailyCompanyState.caseCounts = null;
  dailyCompanyState.boFirst = null;
  dailyCompanyState.exceptions = null;
  dailyCompanyState.damages = null;
  dailyCompanyState.coreError = null;
  dailyCompanyState.error = null;
  updateBell();
  render();
  // A restored Google/Supabase session bypasses the legacy sign-in handler.
  // Start the reconciliation worker for every authenticated app entry so
  // queued jobs continue after a refresh, browser restart, or OAuth return.
  startCloudWorker();
  // The company worksheet loads its own committed run. Do not also start
  // thirty days of all-company aggregates/evidence while opening that sheet.
  // Other routes retain their normal overview loaders; unknown badges stay —.
  if (!['exceptions', 'cloud', 'daily-summary', 'mc8-sheets', 'finance','source-upload','source-run'].includes(state.route)) loadLiveOverview().catch(() => {});
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
  let restored = false;
  let restoreError = null;
  if (!authCallback) {
    try { restored = await Sb.restore(); }
    catch (error) { restoreError = error; }
  }
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
    const firstPassword=$('#resetForm').dataset.firstPassword==='true';
    if (password.length < (firstPassword?9:8) || password !== confirm || (firstPassword&&(!/[a-z]/i.test(password)||!/[0-9]/.test(password)))) {
      error.textContent = firstPassword ? 'รหัสใหม่ต้องมีอย่างน้อย 9 ตัว มีตัวอักษรและตัวเลข และทั้งสองช่องตรงกัน' : password.length < 8 ? "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" : "รหัสผ่านทั้งสองช่องไม่ตรงกัน";
      error.hidden = false;
      return;
    }
    const button = $("#resetSubmit");
    button.disabled = true;
    try {
      if(firstPassword){await Sb.passwordAccount({action:'change_first',password});delete $('#resetForm').dataset.firstPassword;}
      else await Sb.updatePassword(password);
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
    cloudState.caseAttachments = null;
    cloudState.evidenceError = null;
    cloudState.requestId++;
    cloudState.loading = false;
    location.hash = "#/cloud";
    showLoginGate();
  });
  $("#autoStatus").addEventListener("click", () => go("cloud"));
  $("#navToggle").addEventListener("click", () => {
    const sb = $("#sidebar");
    if (window.matchMedia("(max-width: 1080px)").matches) {
      sb.classList.toggle("open");
      AuditUi.syncNav();
      return;
    }
    setSidebarCollapsed(!$("#appShell").classList.contains("sidebar-collapsed"));
    AuditUi.syncNav();
  });

  if (!window.matchMedia("(max-width: 1080px)").matches) {
    let collapsed = false;
    try { collapsed = localStorage.getItem("audit-sidebar-collapsed") === "1"; } catch (_) {}
    setSidebarCollapsed(collapsed);
  }

  AuditUi.syncNav();
  window.matchMedia('(max-width: 1080px)').addEventListener('change', () => { $('#sidebar').classList.remove('open'); AuditUi.syncNav(); });
  if (authCallback === "recovery") showPasswordResetGate();
  else if (authCallback) await enterProductionApp();
  else if (restored) await enterProductionApp();
  else if (restoreError) showConnectingGate('คืนสถานะเข้าสู่ระบบยังไม่สำเร็จ — ไม่ได้ล้างล็อกอิน: ' + (restoreError.message || 'การเชื่อมต่อขัดข้อง'), async () => {
    try {
      if (await Sb.restore()) await enterProductionApp();
      else showLoginGate('ไม่พบสถานะเข้าสู่ระบบที่ใช้ต่อได้ กรุณาเข้าสู่ระบบ');
    } catch (error) {
      $('#connectionMessage').textContent = 'ยังเชื่อมต่อไม่ได้ — เก็บสถานะเดิมไว้แล้ว: ' + (error.message || 'การเชื่อมต่อขัดข้อง');
    }
  });
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
function statementNeedsBoReview(file) {
  const reason = String(file.parse_error || "");
  return /อ่านรายการได้ [1-9]\d* รายการ แต่ไม่มีรายการวันที่/.test(reason)
    && !/อ่านได้บางส่วน|อ่านไฟล์ไม่สำเร็จ|อ่านไม่ได้|ไฟล์เสีย/.test(reason);
}

function statementReviewLabel(file) {
  return statementNeedsBoReview(file)
    ? "ได้รับไฟล์แล้ว — ไม่พบรายการในวันตรวจ รอเทียบ BO"
    : "อ่านไฟล์ไม่สำเร็จ";
}

