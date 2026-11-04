/* =============================================================
   Audit AI Reconciliation - Application shell
   - hash router à¹à¸¢à¸à¸«à¸™à¹‰à¸²à¸ˆà¸­à¸ˆà¸£à¸´à¸‡à¹€à¸¡à¸·à¹ˆà¸­à¸à¸”à¹€à¸¡à¸™à¸¹ (#/dashboard, #/exceptions ...)
   - à¸ªà¸´à¸—à¸˜à¸´à¹Œà¸•à¸²à¸¡ role, à¸Ÿà¸±à¸‡à¸à¹Œà¸Šà¸±à¸™à¸—à¸³à¸‡à¸²à¸™à¸ˆà¸£à¸´à¸‡à¸šà¸™à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸³à¸¥à¸­à¸‡, audit log à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´
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
  const thaiDigits = { "à¹": "0", "à¹‘": "1", "à¹’": "2", "à¹“": "3", "à¹”": "4", "à¹•": "5", "à¹–": "6", "à¹—": "7", "à¹˜": "8", "à¹™": "9" };
  return String(value ?? "").toLocaleLowerCase("th-TH")
    .replace(/[à¹-à¹™]/g, (digit) => thaiDigits[digit])
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function evidenceAmountLabel(value) {
  const amount = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(amount) && amount > 0
    ? `à¸¢à¸­à¸” ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} à¸šà¸²à¸—`
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
    group: "à¸‡à¸²à¸™à¸›à¸£à¸°à¸ˆà¸³à¸§à¸±à¸™",
    items: [
      { id: "dashboard", label: "à¹à¸”à¸Šà¸šà¸­à¸£à¹Œà¸”", icon: "dashboard", title: "à¹à¸”à¸Šà¸šà¸­à¸£à¹Œà¸”à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸›à¸£à¸°à¸ˆà¸³à¸§à¸±à¸™", desc: "à¸ à¸²à¸žà¸£à¸§à¸¡à¸£à¸²à¸¢à¸à¸²à¸£ à¸œà¸¥à¸ˆà¸±à¸šà¸„à¸¹à¹ˆ à¹à¸¥à¸°à¸£à¸²à¸¢à¸à¸²à¸£à¸œà¸´à¸”à¸›à¸à¸•à¸´ à¹à¸¢à¸à¸•à¸²à¸¡à¸šà¸£à¸´à¸©à¸±à¸—", filters: true },
      { id: "daily-summary", label: "à¸ªà¸£à¸¸à¸›à¸£à¸²à¸¢à¸§à¸±à¸™", icon: "reports", title: "à¸ªà¸£à¸¸à¸› 1 à¸šà¸£à¸´à¸©à¸±à¸— 1 à¸§à¸±à¸™", desc: "à¸”à¸¹à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¹„à¸”à¹‰à¸£à¸±à¸š à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸” à¹à¸¥à¸°à¸ªà¸–à¸²à¸™à¸°à¸à¸²à¸£à¹à¸à¹‰à¹„à¸‚à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¸‚à¸­à¸‡à¸šà¸£à¸´à¸©à¸±à¸—à¹ƒà¸™à¸§à¸±à¸™à¹€à¸”à¸µà¸¢à¸§ à¸žà¸£à¹‰à¸­à¸¡ Export", filters: false },
      { id: "mc8-sheets", label: "à¸Šà¸µà¸• AUDIT à¸—à¸¸à¸à¸šà¸£à¸´à¸©à¸±à¸—", icon: "reports", title: "à¸Šà¸µà¸• AUDIT à¸—à¸¸à¸à¸šà¸£à¸´à¸©à¸±à¸—", desc: "à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸” STM / PM à¸à¸±à¸š BO à¹à¸¢à¸ PM à¸•à¸²à¸¡ Provider à¹à¸¥à¸°à¹à¸¢à¸ STM à¸˜à¸™à¸²à¸„à¸²à¸£à¸—à¸µà¸¥à¸°à¸šà¸±à¸à¸Šà¸µ à¸žà¸£à¹‰à¸­à¸¡à¸¢à¸­à¸”à¸£à¸§à¸¡à¸—à¹‰à¸²à¸¢à¸•à¸²à¸£à¸²à¸‡", filters: false },
      { id: "cloud", label: "à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸°à¸ªà¸–à¸²à¸™à¸°", icon: "cloud", title: "à¸•à¸£à¸§à¸ˆà¹„à¸Ÿà¸¥à¹Œà¸ˆà¸²à¸à¹€à¸¡à¸¥", desc: "à¹€à¸›à¸´à¸”à¸”à¸¹à¹„à¸Ÿà¸¥à¹Œà¸•à¹‰à¸™à¸‰à¸šà¸±à¸š à¸•à¸£à¸§à¸ˆà¸šà¸£à¸´à¸©à¸±à¸— à¸›à¸£à¸°à¹€à¸ à¸— à¹à¸¥à¸°à¸ªà¸–à¸²à¸™à¸°à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¸ˆà¸²à¸ Supabase à¸à¹ˆà¸­à¸™à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”", filters: true },
      { id: "source-upload", label: "à¸£à¸±à¸šà¹à¸¥à¸°à¸ˆà¸±à¸”à¹„à¸Ÿà¸¥à¹Œ", icon: "cloud", title: "à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œà¹ƒà¸«à¹‰à¸–à¸¹à¸ à¸à¹ˆà¸­à¸™à¹€à¸£à¸´à¹ˆà¸¡à¸•à¸£à¸§à¸ˆ", desc: "à¸­à¸±à¸›à¹‚à¸«à¸¥à¸”à¹à¸¢à¸à¸šà¸£à¸´à¸©à¸±à¸— à¸§à¸±à¸™à¹à¸¥à¸°à¸›à¸£à¸°à¹€à¸ à¸— à¹€à¸à¹‡à¸šà¸•à¹‰à¸™à¸‰à¸šà¸±à¸šà¹à¸¥à¸°à¸›à¸£à¸°à¸§à¸±à¸•à¸´ à¹‚à¸”à¸¢à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸£à¸±à¸™", filters: false },
      { id: "source-run", label: "à¹€à¸•à¸£à¸µà¸¢à¸¡à¸£à¸±à¸™à¸¡à¸·à¸­", icon: "matching", title: "à¹€à¸¥à¸·à¸­à¸à¸Šà¸¸à¸”à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸°à¹€à¸•à¸£à¸µà¸¢à¸¡à¸£à¸±à¸™à¸¡à¸·à¸­", desc: "à¹€à¸¥à¸·à¸­à¸à¸ˆà¸²à¸à¹€à¸¡à¸¥ à¸­à¸±à¸›à¹‚à¸«à¸¥à¸” à¸«à¸£à¸·à¸­à¸œà¸ªà¸¡à¸à¸±à¸™ à¸ªà¹ˆà¸‡à¹€à¸‰à¸žà¸²à¸°à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸à¹„à¸›à¸—à¸šà¸—à¸§à¸™à¸£à¸±à¸™à¸£à¸­à¸šà¹ƒà¸«à¸¡à¹ˆ", filters: false },
      { id: "intake", label: "à¸•à¸£à¸§à¸ˆà¹„à¸Ÿà¸¥à¹Œà¹€à¸‚à¹‰à¸²", icon: "intake", title: "à¸•à¸£à¸§à¸ˆà¹„à¸Ÿà¸¥à¹Œà¸à¹ˆà¸­à¸™à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”", desc: "à¸”à¸¹à¹„à¸Ÿà¸¥à¹Œà¸ˆà¸£à¸´à¸‡à¹à¸¢à¸à¸•à¸²à¸¡à¸šà¸£à¸´à¸©à¸±à¸—à¹à¸¥à¸°à¸›à¸£à¸°à¹€à¸ à¸— PM / à¸à¸²à¸ / à¸–à¸­à¸™ à¸«à¸²à¸à¸¢à¸±à¸‡à¸­à¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆà¸£à¸°à¸šà¸šà¸ˆà¸°à¹à¸ˆà¹‰à¸‡à¹ƒà¸«à¹‰à¸•à¸£à¸§à¸ˆà¸•à¹ˆà¸­", filters: true, hidden: true },
      { id: "exceptions", label: "à¸œà¸¥à¸•à¸£à¸§à¸ˆà¹à¸¥à¸°à¹€à¸„à¸ª", icon: "exceptions", title: "à¸ à¸²à¸žà¸£à¸§à¸¡à¸œà¸¥à¸•à¸£à¸§à¸ˆà¹à¸¥à¸°à¹€à¸„à¸ª", desc: "à¸”à¸¹à¸„à¸¹à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆà¹à¸¥à¸°à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆ à¹à¸¢à¸à¸šà¸£à¸´à¸©à¸±à¸— à¸§à¸±à¸™à¸—à¸µà¹ˆ à¸à¸²à¸â€“à¸–à¸­à¸™ à¹à¸¥à¸°à¸ªà¸–à¸²à¸™à¸°", filters: true },
      { id: "matching", label: "3-Point Match", icon: "matching", title: "à¸•à¸£à¸§à¸ˆà¸à¸²à¸£à¸ˆà¸±à¸šà¸„à¸¹à¹ˆ 3 à¸ˆà¸¸à¸”", desc: "à¹€à¸—à¸µà¸¢à¸š account, time, amount à¸£à¸°à¸«à¸§à¹ˆà¸²à¸‡ STM à¸à¸±à¸š BO à¸—à¸µà¸¥à¸°à¸£à¸²à¸¢à¸à¸²à¸£à¸žà¸£à¹‰à¸­à¸¡ tolerance à¸—à¸µà¹ˆà¹ƒà¸Šà¹‰", filters: true, hidden: true },
    ],
  },
  {
    group: "à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹à¸¥à¸°à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´",
    items: [
      { id: "clarify", label: "à¸•à¸´à¸”à¸•à¸²à¸¡à¸„à¸³à¸Šà¸µà¹‰à¹à¸ˆà¸‡", icon: "clarify", title: "à¸‡à¸²à¸™à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¹à¸¢à¸à¸•à¸²à¸¡à¸šà¸£à¸´à¸©à¸±à¸—", desc: "à¸ªà¹ˆà¸‡à¹à¸¥à¸°à¸•à¸´à¸”à¸•à¸²à¸¡à¹€à¸­à¸à¸ªà¸²à¸£à¸ˆà¸²à¸à¸œà¸¹à¹‰à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸•à¸²à¸¡ SLA à¸šà¸£à¸´à¸©à¸±à¸— à¹€à¸¡à¸·à¹ˆà¸­à¸ªà¹ˆà¸‡à¸à¸¥à¸±à¸šà¹ƒà¸«à¹‰ Audit à¸•à¸£à¸§à¸ˆà¹ƒà¸™à¸«à¸™à¹‰à¸² Audit à¸£à¸­à¸•à¸£à¸§à¸ˆ", filters: true },
      { id: "audit-review", label: "Audit à¸£à¸­à¸•à¸£à¸§à¸ˆ", icon: "exceptions", title: "Audit à¸£à¸­à¸•à¸£à¸§à¸ˆà¹€à¸­à¸à¸ªà¸²à¸£", desc: "à¹€à¸­à¸à¸ªà¸²à¸£à¸«à¸£à¸·à¸­à¸„à¸³à¸•à¸­à¸šà¸ˆà¸²à¸à¸œà¸¹à¹‰à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸à¸¥à¸±à¸šà¸¡à¸²à¹à¸¥à¹‰à¸§ à¸•à¸£à¸§à¸ˆà¹ƒà¸™à¹€à¸„à¸ªà¹€à¸”à¸´à¸¡à¸à¹ˆà¸­à¸™à¸ªà¹ˆà¸‡à¸«à¸±à¸§à¸«à¸™à¹‰à¸²à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¸›à¸´à¸”", filters: true },
      { id: "approvals", label: "à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´ / à¸›à¸´à¸”à¹€à¸„à¸ª", icon: "approvals", title: "à¸„à¸³à¸‚à¸­à¸£à¸­à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´", desc: "à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¸Šà¸µà¹‰à¹à¸ˆà¸‡à¹à¸¥à¹‰à¸§à¸£à¸­ Audit Lead à¸•à¸£à¸§à¸ˆà¸—à¸²à¸™ à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´ à¸«à¸£à¸·à¸­à¸ªà¹ˆà¸‡à¸à¸¥à¸±à¸š", filters: true },
      { id: "damage", label: "à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢", icon: "damage", title: "Damage Register", desc: "à¸šà¸±à¸™à¸—à¸¶à¸à¸œà¸¥à¸•à¸£à¸§à¸ˆà¹à¸¥à¸°à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢à¹à¸šà¸šà¹€à¸£à¸µà¸¢à¸¥à¹„à¸—à¸¡à¹Œ à¸„à¹‰à¸™à¸¢à¹‰à¸­à¸™à¸«à¸¥à¸±à¸‡à¸•à¸²à¸¡à¸Šà¹ˆà¸§à¸‡à¸§à¸±à¸™", filters: true },
    ],
  },
  {
    group: "à¸£à¸²à¸¢à¸‡à¸²à¸™",
    items: [
      { id: "finance", label: "à¸à¸²à¸£à¹€à¸‡à¸´à¸™ & à¸œà¸¹à¹‰à¸šà¸£à¸´à¸«à¸²à¸£", icon: "kpi", title: "à¸à¸²à¸£à¹€à¸‡à¸´à¸™à¹à¸¥à¸°à¸ à¸²à¸žà¸£à¸§à¸¡à¸œà¸¹à¹‰à¸šà¸£à¸´à¸«à¸²à¸£", desc: "BO à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¹ˆà¸¢à¸‡ à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢ à¸žà¸™à¸±à¸à¸‡à¸²à¸™ à¹à¸¥à¸° Action à¹à¸¢à¸à¸•à¸²à¸¡à¸šà¸£à¸´à¸©à¸±à¸—à¸—à¸µà¹ˆà¸¡à¸µà¸ªà¸´à¸—à¸˜à¸´à¹Œ Â· à¹„à¸¡à¹ˆà¹à¸à¹‰à¸¢à¸­à¸”à¸«à¸£à¸·à¸­à¸ªà¸–à¸²à¸™à¸°à¹€à¸„à¸ª", filters: false },
      { id: "monthly-audit", label: "à¸ªà¸¸à¹ˆà¸¡à¸•à¸£à¸§à¸ˆà¸£à¸²à¸¢à¹€à¸”à¸·à¸­à¸™", icon: "reports", title: "à¸ªà¸¸à¹ˆà¸¡à¸•à¸£à¸§à¸ˆ Audit à¸£à¸²à¸¢à¹€à¸”à¸·à¸­à¸™", desc: "à¹€à¸à¹‡à¸šà¸Šà¸¸à¸”à¸ªà¸¸à¹ˆà¸¡ à¸œà¸¹à¹‰à¸•à¸£à¸§à¸ˆ à¸œà¸¥à¸›à¸£à¸°à¹€à¸¡à¸´à¸™ à¸«à¸¡à¸²à¸¢à¹€à¸«à¸•à¸¸ à¸«à¸¥à¸±à¸à¸à¸²à¸™ à¹à¸¥à¸°à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¹à¸¢à¸à¸šà¸£à¸´à¸©à¸±à¸—/à¹€à¸”à¸·à¸­à¸™", filters: false },
      { id: "kpi", label: "KPI à¸šà¸£à¸´à¸©à¸±à¸—", icon: "kpi", title: "KPI à¸•à¸²à¸¡à¸šà¸£à¸´à¸©à¸±à¸—à¹à¸¥à¸°à¸žà¸™à¸±à¸à¸‡à¸²à¸™", desc: "à¸„à¸§à¸²à¸¡à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¸•à¸²à¸¡à¸šà¸£à¸´à¸©à¸±à¸— à¸›à¸£à¸°à¹€à¸ à¸— à¹à¸¥à¸°à¸œà¸¹à¹‰à¸•à¸£à¸§à¸ˆ à¹€à¸žà¸·à¹ˆà¸­à¹ƒà¸Šà¹‰à¸›à¸£à¸°à¹€à¸¡à¸´à¸™à¹à¸¥à¸°à¸¥à¸”à¸„à¸§à¸²à¸¡à¸œà¸´à¸”à¸‹à¹‰à¸³", filters: true, hidden: true },
      { id: "reports", label: "à¸£à¸²à¸¢à¸‡à¸²à¸™ & Export", icon: "reports", title: "à¸£à¸²à¸¢à¸‡à¸²à¸™à¸£à¸²à¸¢à¸§à¸±à¸™ / à¸£à¸²à¸¢à¹€à¸”à¸·à¸­à¸™", desc: "à¸ªà¸£à¸¸à¸›à¸œà¸¥à¸•à¸£à¸§à¸ˆ, à¹à¸™à¸§à¹‚à¸™à¹‰à¸¡à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢ à¹à¸¥à¸° export à¹ƒà¸«à¹‰à¸à¸²à¸£à¹€à¸‡à¸´à¸™ / à¸šà¸¸à¸„à¸„à¸¥", filters: true },
      { id: "talk", label: "Talk to Data", icon: "talk", title: "à¸–à¸²à¸¡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸”à¹‰à¸§à¸¢à¸ à¸²à¸©à¸²à¹„à¸—à¸¢", desc: "à¸–à¸²à¸¡à¸ˆà¸²à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸—à¸µà¹ˆ reconcile à¹à¸¥à¹‰à¸§ à¸—à¸¸à¸à¸„à¸³à¸•à¸­à¸šà¸­à¹‰à¸²à¸‡à¸­à¸´à¸‡à¸•à¸±à¸§à¹€à¸¥à¸‚ à¸Šà¹ˆà¸§à¸‡à¸§à¸±à¸™à¸—à¸µà¹ˆ à¹à¸¥à¸°à¸¥à¸´à¸‡à¸à¹Œà¸à¸¥à¸±à¸šà¸«à¸¥à¸±à¸à¸à¸²à¸™", filters: false, hidden: true },
    ],
  },
  {
    group: "à¸£à¸°à¸šà¸š",
    items: [
      { id: "rules", label: "Bank Rules", icon: "rules", title: "à¸à¸Žà¸˜à¸™à¸²à¸„à¸²à¸£à¹à¸¥à¸° Tolerance", desc: "à¸›à¸£à¸±à¸šà¸à¸Žà¸£à¸²à¸¢à¸˜à¸™à¸²à¸„à¸²à¸£à¹„à¸”à¹‰à¹‚à¸”à¸¢à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¹à¸à¹‰à¹‚à¸›à¸£à¹à¸à¸£à¸¡ à¸—à¸¸à¸à¸à¸²à¸£à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸–à¸¹à¸à¸šà¸±à¸™à¸—à¸¶à¸à¹ƒà¸™ audit log", filters: false },
      { id: "account-holds", label: "à¸žà¸±à¸à¸šà¸±à¸à¸Šà¸µ STM", icon: "clock", title: "à¸ˆà¸±à¸”à¸à¸²à¸£à¸šà¸±à¸à¸Šà¸µà¸žà¸±à¸à¸•à¸£à¸§à¸ˆ / à¸£à¸­ STM", desc: "à¸«à¸±à¸§à¸«à¸™à¹‰à¸²à¸­à¸­à¸”à¸´à¸—à¹à¸¥à¸°à¸œà¸¹à¹‰à¸”à¸¹à¹à¸¥à¸£à¸°à¸šà¸šà¹€à¸›à¸´à¸”à¸«à¸£à¸·à¸­à¸›à¸¥à¸”à¸žà¸±à¸à¸šà¸±à¸à¸Šà¸µà¸—à¸µà¹ˆà¸–à¸¹à¸à¸£à¸°à¸‡à¸±à¸š à¹‚à¸”à¸¢à¹„à¸¡à¹ˆà¸£à¸±à¸™à¸‹à¹‰à¸³à¸«à¸£à¸·à¸­à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸¢à¸­à¸”à¹à¸¥à¸°à¸ªà¸–à¸²à¸™à¸°à¹€à¸„à¸ª", filters: false },
      { id: "notifications", label: "à¸à¸²à¸£à¹à¸ˆà¹‰à¸‡à¹€à¸•à¸·à¸­à¸™", icon: "bell", title: "à¸¨à¸¹à¸™à¸¢à¹Œà¸à¸²à¸£à¹à¸ˆà¹‰à¸‡à¹€à¸•à¸·à¸­à¸™", desc: "à¹à¸ˆà¹‰à¸‡à¹€à¸¡à¸·à¹ˆà¸­à¹„à¸Ÿà¸¥à¹Œà¸‚à¸²à¸” à¸žà¸š exception à¸£à¸°à¸”à¸±à¸šà¸ªà¸¹à¸‡ à¸«à¸£à¸·à¸­à¹€à¸„à¸ªà¹€à¸¥à¸¢ SLA à¸žà¸£à¹‰à¸­à¸¡à¸•à¸±à¹‰à¸‡à¸à¸Žà¹à¸¥à¸°à¸Šà¹ˆà¸­à¸‡à¸—à¸²à¸‡à¹„à¸”à¹‰", filters: false },
      { id: "audit-log", label: "Audit Log", icon: "log", title: "à¸šà¸±à¸™à¸—à¸¶à¸à¸à¸²à¸£à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸£à¸°à¸šà¸š", desc: "à¸—à¸¸à¸ note, status, approval, à¸à¸²à¸£à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸² à¸–à¸¹à¸à¸šà¸±à¸™à¸—à¸¶à¸à¸žà¸£à¹‰à¸­à¸¡à¹€à¸§à¸¥à¸²à¹à¸¥à¸°à¸œà¸¹à¹‰à¸—à¸³à¸£à¸²à¸¢à¸à¸²à¸£", filters: true },
      { id: "mail-intake", label: "à¸•à¸£à¸§à¸ˆà¹€à¸¡à¸¥à¹€à¸‚à¹‰à¸²", icon: "intake", title: "à¸•à¸£à¸§à¸ˆà¸œà¸¹à¹‰à¸ªà¹ˆà¸‡à¹à¸¥à¸°à¸”à¸¶à¸‡à¹€à¸¡à¸¥à¹€à¸‚à¹‰à¸²à¸„à¸¥à¸±à¸‡", desc: "à¹€à¸žà¸´à¹ˆà¸¡à¸­à¸µà¹€à¸¡à¸¥à¸œà¸¹à¹‰à¸ªà¹ˆà¸‡à¹à¸¥à¸°à¸ªà¸±à¹ˆà¸‡à¸”à¸¶à¸‡à¹€à¸¡à¸¥à¸—à¸µà¹ˆà¸•à¸à¸«à¸¥à¹ˆà¸™à¹€à¸‚à¹‰à¸²à¸„à¸¥à¸±à¸‡ à¹à¸¢à¸à¸ˆà¸²à¸à¸à¸²à¸£à¸£à¸±à¸™à¸«à¸£à¸·à¸­à¸¢à¸·à¸™à¸¢à¸±à¸™à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”", filters: false },
      { id: "users", label: "à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¹à¸¥à¸°à¸ªà¸´à¸—à¸˜à¸´à¹Œ", icon: "users", title: "à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰ à¸šà¸—à¸šà¸²à¸— à¹à¸¥à¸°à¸šà¸£à¸´à¸©à¸±à¸—", desc: "à¸à¸³à¸«à¸™à¸”à¸«à¸™à¹‰à¸²à¸—à¸µà¹ˆà¹à¸¥à¸°à¸šà¸£à¸´à¸©à¸±à¸—à¸—à¸µà¹ˆà¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¹à¸•à¹ˆà¸¥à¸°à¸„à¸™à¸£à¸±à¸šà¸œà¸´à¸”à¸Šà¸­à¸š à¸ªà¸´à¸—à¸˜à¸´à¹Œà¸–à¸¹à¸à¸šà¸±à¸‡à¸„à¸±à¸šà¸‹à¹‰à¸³à¸—à¸µà¹ˆà¸à¸²à¸™à¸‚à¹‰à¸­à¸¡à¸¹à¸¥", filters: false },
      { id: "case-settings", label: "à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²à¹€à¸„à¸ª / SLA", icon: "rules", title: "à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸² SLA à¹à¸¢à¸à¸šà¸£à¸´à¸©à¸±à¸—", desc: "à¸à¸³à¸«à¸™à¸”à¹€à¸§à¸¥à¸²à¸‚à¸­à¹€à¸­à¸à¸ªà¸²à¸£à¸‚à¸­à¸‡à¹à¸•à¹ˆà¸¥à¸°à¸šà¸£à¸´à¸©à¸±à¸— à¹„à¸¡à¹ˆà¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸à¸³à¸«à¸™à¸”à¹€à¸„à¸ªà¹€à¸à¹ˆà¸²à¹à¸¥à¸°à¹„à¸¡à¹ˆà¸›à¸´à¸”à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´", filters: false },
    ],
  },
];
const ROUTE_MAP = {};
ROUTES.forEach((g) => g.items.forEach((it) => (ROUTE_MAP[it.id] = it)));

/* à¹‚à¸„à¸£à¸‡à¸ªà¸£à¹‰à¸²à¸‡à¹€à¸„à¸£à¸·à¸­à¸šà¸£à¸´à¸©à¸±à¸—à¹à¸¥à¸°à¸à¸Žà¸•à¸£à¸§à¸ˆà¸—à¸µà¹ˆ Audit à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹à¸¥à¹‰à¸§
   à¹à¸•à¹ˆà¸¥à¸°à¹€à¸„à¸£à¸·à¸­à¹ƒà¸Šà¹‰à¸à¸Žà¸‚à¸­à¸‡à¸•à¸±à¸§à¹€à¸­à¸‡ à¸«à¹‰à¸²à¸¡à¸¢à¸·à¸¡à¸à¸Žà¸‚à¹‰à¸²à¸¡à¹€à¸„à¸£à¸·à¸­ */
const AUDIT_COMPANY_GROUPS = Object.freeze([
  {
    id: "XB",
    name: "à¹€à¸„à¸£à¸·à¸­ XB",
    status: "active",
    companies: ["3XB", "MC8", "MR9", "PS8", "UR9"],
    rules: [
      "à¸ˆà¸±à¸šà¸„à¸¹à¹ˆ STM / PM à¸à¸±à¸š BO à¸ à¸²à¸¢à¹ƒà¸™à¸šà¸£à¸´à¸©à¸±à¸— à¸šà¸±à¸à¸Šà¸µ/Provider à¸—à¸´à¸¨à¸—à¸²à¸‡ à¹à¸¥à¸°à¸¢à¸­à¸”à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™ à¹‚à¸”à¸¢à¹„à¸¡à¹ˆà¸‚à¹‰à¸²à¸¡à¸šà¸£à¸´à¸©à¸±à¸—",
      "PM à¸à¸²à¸: à¹ƒà¸Šà¹‰ paymentTime à¸à¹ˆà¸­à¸™; à¹ƒà¸Šà¹‰ expiredTime à¹€à¸‰à¸žà¸²à¸°à¹€à¸¡à¸·à¹ˆà¸­à¹„à¸¡à¹ˆà¸¡à¸µ paymentTime Â· PM à¸–à¸­à¸™: à¹ƒà¸Šà¹‰ updateTime",
      "à¸¢à¸­à¸”à¸à¸²à¸à¸—à¸¸à¸ Provider à¹ƒà¸Šà¹‰ realAmount Â· à¸¢à¸­à¸”à¸–à¸­à¸™ AT/M à¹ƒà¸Šà¹‰ transferredAmount Â· à¸¢à¸­à¸”à¸–à¸­à¸™ AZ/CP/LP/12PAY à¹ƒà¸Šà¹‰ amount",
      "3XB: 12PAY à¸à¸²à¸à¹à¸¥à¸° 123PAY à¸–à¸­à¸™à¸„à¸·à¸­ Provider/à¸šà¸±à¸à¸Šà¸µà¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™à¸Šà¸·à¹ˆà¸­ 12PAY; à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œ PM à¹€à¸žà¸µà¸¢à¸‡ 2 à¹„à¸Ÿà¸¥à¹Œ à¹à¸¥à¹‰à¸§à¹à¸¢à¸à¸—à¸´à¸¨à¸—à¸²à¸‡à¸•à¸²à¸¡à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸° BO à¸à¹ˆà¸­à¸™à¸ˆà¸±à¸šà¸”à¹‰à¸§à¸¢à¸šà¸±à¸à¸Šà¸µ + à¹€à¸§à¸¥à¸² + à¸¢à¸­à¸”",
      "PM à¸‚à¸­à¸‡à¸—à¸¸à¸ Provider à¹€à¸à¹‡à¸šà¸£à¸«à¸±à¸ªà¸ªà¸­à¸‡à¸Šà¹ˆà¸­à¸‡à¹à¸¢à¸à¸à¸±à¸™: id à¹€à¸›à¹‡à¸™à¸£à¸«à¸±à¸ªà¸˜à¸¸à¸£à¸à¸£à¸£à¸¡ à¹€à¸Šà¹ˆà¸™ P2C... à¹à¸¥à¸° _id à¹€à¸›à¹‡à¸™à¸£à¸«à¸±à¸ª 6aa...; à¸à¸±à¹ˆà¸‡ BO à¹à¸¢à¸à¹€à¸‰à¸žà¸²à¸°à¸£à¸«à¸±à¸ª 6aa... à¸«à¸¥à¸±à¸‡ Sapan:/Spean: à¹€à¸«à¸¡à¸·à¸­à¸™ Text to Columns à¹à¸¥à¸°à¸•à¸±à¸”à¸„à¸³à¸­à¸˜à¸´à¸šà¸²à¸¢à¸—à¸µà¹ˆà¸•à¸²à¸¡à¸«à¸¥à¸±à¸‡à¸­à¸­à¸",
      "à¸à¸Ž Sapan/_id à¹ƒà¸Šà¹‰à¸à¸±à¸š PM à¸–à¸­à¸™à¸‚à¸­à¸‡ XB à¸—à¸µà¹ˆà¸¡à¸µ _id à¹„à¸”à¹‰à¹à¸à¹ˆ AT/AZ/CP/M/LP: _id à¸à¸±à¹ˆà¸‡ PM à¸•à¹‰à¸­à¸‡à¸•à¸£à¸‡à¸à¸±à¸šà¸£à¸«à¸±à¸ªà¸—à¸µà¹ˆà¹à¸¢à¸à¸ˆà¸²à¸à¸«à¸¡à¸²à¸¢à¹€à¸«à¸•à¸¸ BO à¹à¸¥à¸°à¸¢à¸­à¸”à¸ˆà¸£à¸´à¸‡à¸•à¹‰à¸­à¸‡à¸•à¸£à¸‡à¸à¸±à¸™à¹à¸šà¸šà¸„à¸¹à¹ˆ 1:1 à¸ˆà¸¶à¸‡à¸›à¸´à¸”à¹„à¸”à¹‰ à¹à¸¡à¹‰à¹€à¸§à¸¥à¸²/à¸Šà¸·à¹ˆà¸­ Provider à¹€à¸”à¸´à¸¡à¸„à¸¥à¸²à¸”à¹€à¸„à¸¥à¸·à¹ˆà¸­à¸™",
      "3XB à¹€à¸›à¸´à¸”à¹ƒà¸Šà¹‰ LOCALPAY à¸à¸²à¸/à¸–à¸­à¸™ (à¸à¸²à¸à¹ƒà¸Šà¹‰ realAmount Â· à¸–à¸­à¸™à¹ƒà¸Šà¹‰ amount) Â· QPAY à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œà¹„à¸§à¹‰à¹„à¸”à¹‰à¹à¸•à¹ˆà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸™à¸³à¸¡à¸²à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸ˆà¸™à¸à¸§à¹ˆà¸²à¹à¸­à¸”à¸¡à¸´à¸™à¹€à¸›à¸´à¸”à¹ƒà¸Šà¹‰",
      "à¸£à¸²à¸¢à¸à¸²à¸£à¸‚à¹‰à¸²à¸¡à¸§à¸±à¸™à¹€à¸›à¸´à¸”à¹€à¸›à¹‡à¸™ â€œà¸„à¹‰à¸²à¸‡à¸£à¸­à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸‚à¹‰à¸²à¸¡à¸§à¸±à¸™â€; à¹€à¸¡à¸·à¹ˆà¸­à¸§à¸±à¸™à¸–à¸±à¸”à¹„à¸›à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¹à¸šà¸š 1:1 à¹„à¸”à¹‰à¸ˆà¸¶à¸‡à¸›à¸´à¸”à¸‡à¸²à¸™à¸„à¹‰à¸²à¸‡à¹à¸¥à¸°à¹€à¸à¹‡à¸š Audit Log",
      "à¸¢à¸­à¸”à¸ªà¸¹à¸‡à¹à¸¥à¸°à¹€à¸§à¸¥à¸²à¸„à¸¥à¸²à¸”à¹€à¸„à¸¥à¸·à¹ˆà¸­à¸™à¸—à¸µà¹ˆà¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¹„à¸”à¹‰à¸•à¸²à¸¡à¸à¸Žà¹€à¸›à¹‡à¸™à¸ªà¸–à¸²à¸™à¸°à¹à¸ˆà¹‰à¸‡à¸œà¸¥ à¹„à¸¡à¹ˆà¸ªà¹ˆà¸‡à¹ƒà¸«à¹‰ Audit à¸¢à¸·à¸™à¸¢à¸±à¸™; à¸„à¸¹à¹ˆà¸‹à¹‰à¸³à¸«à¸£à¸·à¸­à¸„à¸¥à¸¸à¸¡à¹€à¸„à¸£à¸·à¸­à¸ˆà¸°à¹„à¸¡à¹ˆà¸›à¸´à¸”à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´",
      "STM à¸˜à¸™à¸²à¸„à¸²à¸£à¸‚à¸­à¸‡ XB à¸£à¸§à¸¡à¸£à¸²à¸¢à¸à¸²à¸£à¸à¸²à¸à¹à¸¥à¸°à¸–à¸­à¸™ (D-W) à¹„à¸§à¹‰à¸Šà¸µà¸•à¹€à¸”à¸µà¸¢à¸§à¸•à¹ˆà¸­à¸šà¸±à¸à¸Šà¸µ à¹€à¸Šà¹ˆà¸™ KB A D-W à¸«à¸£à¸·à¸­ SCB B D-W",
    ],
  },
  { id: "SYS123", name: "à¹€à¸„à¸£à¸·à¸­ 123", status: "active", companies: ["AT4", "FR8", "SK8"], rules: [
    "AUTOPEER à¸à¸²à¸/à¸–à¸­à¸™: à¸£à¸«à¸±à¸ªà¸ªà¸¡à¸²à¸Šà¸´à¸ â†” à¸ªà¸¡à¸²à¸Šà¸´à¸ BO, à¹€à¸¥à¸‚à¸šà¸±à¸à¸Šà¸µà¸ªà¸¡à¸²à¸Šà¸´à¸ â†” à¸šà¸±à¸à¸Šà¸µà¸¥à¸¹à¸à¸„à¹‰à¸² BO à¹à¸¥à¸°à¸¢à¸­à¸”à¸à¸²à¸/à¸–à¸­à¸™ â†” à¸ˆà¸³à¸™à¸§à¸™à¹€à¸‡à¸´à¸™à¸à¸²à¸/à¸ˆà¸³à¸™à¸§à¸™à¹€à¸‡à¸´à¸™à¸–à¸­à¸™à¸ˆà¸£à¸´à¸‡ BO",
    "AZPAY à¸à¸²à¸: à¸£à¸«à¸±à¸ªà¸ªà¸¡à¸²à¸Šà¸´à¸ + à¹€à¸¥à¸‚à¸šà¸±à¸à¸Šà¸µà¸ªà¸¡à¸²à¸Šà¸´à¸ + à¸ˆà¸³à¸™à¸§à¸™à¹€à¸‡à¸´à¸™à¸à¸²à¸ à¸•à¹‰à¸­à¸‡à¸•à¸£à¸‡à¸à¸±à¸š à¸ªà¸¡à¸²à¸Šà¸´à¸ + à¸šà¸±à¸à¸Šà¸µà¸¥à¸¹à¸à¸„à¹‰à¸² + à¸ˆà¸³à¸™à¸§à¸™à¹€à¸‡à¸´à¸™à¸à¸²à¸ BO (à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹€à¸›à¸´à¸”à¸à¸Žà¸–à¸­à¸™)",
    "COREPAY à¸à¸²à¸/à¸–à¸­à¸™: à¸£à¸«à¸±à¸ªà¸ªà¸¡à¸²à¸Šà¸´à¸ + à¹€à¸¥à¸‚à¸šà¸±à¸à¸Šà¸µà¸ªà¸¡à¸²à¸Šà¸´à¸ + à¸¢à¸­à¸”à¸à¸²à¸/à¸–à¸­à¸™ à¸•à¹‰à¸­à¸‡à¸•à¸£à¸‡à¸à¸±à¸šà¸ªà¸¡à¸²à¸Šà¸´à¸ + à¸šà¸±à¸à¸Šà¸µà¸¥à¸¹à¸à¸„à¹‰à¸² + à¸¢à¸­à¸”à¸ˆà¸£à¸´à¸‡à¸à¸±à¹ˆà¸‡ BO",
    "CYBERPLUS à¸à¸²à¸à¹ƒà¸Šà¹‰ 3 à¸ˆà¸¸à¸”à¹€à¸«à¸¡à¸·à¸­à¸™ COREPAY; CYBERPLUS à¸–à¸­à¸™à¹ƒà¸Šà¹‰ 2 à¸ˆà¸¸à¸”à¸„à¸·à¸­à¸£à¸«à¸±à¸ªà¸ªà¸¡à¸²à¸Šà¸´à¸à¹à¸¥à¸°à¸ˆà¸³à¸™à¸§à¸™à¹€à¸‡à¸´à¸™à¸–à¸­à¸™à¸ˆà¸£à¸´à¸‡ à¹‚à¸”à¸¢à¹„à¸¡à¹ˆà¸šà¸±à¸‡à¸„à¸±à¸šà¹€à¸¥à¸‚à¸šà¸±à¸à¸Šà¸µà¸ªà¸¡à¸²à¸Šà¸´à¸",
    "LOCALPAY à¸à¸²à¸/à¸–à¸­à¸™: à¸£à¸«à¸±à¸ªà¸ªà¸¡à¸²à¸Šà¸´à¸ + à¹€à¸¥à¸‚à¸šà¸±à¸à¸Šà¸µà¸ªà¸¡à¸²à¸Šà¸´à¸ + à¸¢à¸­à¸”à¸à¸²à¸/à¸–à¸­à¸™ à¸•à¹‰à¸­à¸‡à¸•à¸£à¸‡à¸à¸±à¸šà¸ªà¸¡à¸²à¸Šà¸´à¸ + à¸šà¸±à¸à¸Šà¸µà¸¥à¸¹à¸à¸„à¹‰à¸² + à¸¢à¸­à¸”à¸ˆà¸£à¸´à¸‡à¸à¸±à¹ˆà¸‡ BO",
    "à¸—à¸¸à¸à¸„à¸¹à¹ˆà¸•à¹‰à¸­à¸‡à¸­à¸¢à¸¹à¹ˆà¸šà¸£à¸´à¸©à¸±à¸— Provider à¹à¸¥à¸°à¸—à¸´à¸¨à¸—à¸²à¸‡à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™; à¹€à¸¥à¸‚à¸šà¸±à¸à¸Šà¸µà¹€à¸•à¹‡à¸¡à¸ˆà¸±à¸šà¸à¸±à¸š 4 à¸«à¸¥à¸±à¸à¸—à¹‰à¸²à¸¢à¹„à¸”à¹‰à¹€à¸¡à¸·à¹ˆà¸­à¸ªà¸¡à¸²à¸Šà¸´à¸à¹à¸¥à¸°à¸¢à¸­à¸”à¸•à¸£à¸‡à¸à¸±à¸™",
    "à¸–à¹‰à¸²à¸ªà¸¡à¸²à¸Šà¸´à¸à¸«à¸£à¸·à¸­à¹€à¸¥à¸‚à¸šà¸±à¸à¸Šà¸µà¸‚à¸²à¸”à¹€à¸žà¸µà¸¢à¸‡à¸«à¸™à¸¶à¹ˆà¸‡à¸à¸±à¹ˆà¸‡ à¸£à¸°à¸šà¸šà¹ƒà¸Šà¹‰à¸ˆà¸¸à¸”à¸—à¸µà¹ˆà¹€à¸«à¸¥à¸·à¸­à¸£à¹ˆà¸§à¸¡à¸à¸±à¸šà¸¢à¸­à¸”à¹à¸¥à¸°à¸„à¸¹à¹ˆà¹€à¸§à¸¥à¸²à¹ƒà¸à¸¥à¹‰à¸—à¸µà¹ˆà¸ªà¸¸à¸”à¹„à¸¡à¹ˆà¹€à¸à¸´à¸™ 10 à¸™à¸²à¸—à¸µà¹à¸šà¸š reciprocal 1:1; à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸‚à¸±à¸”à¸à¸±à¸™ à¸„à¸¹à¹ˆà¹€à¸§à¸¥à¸²à¹€à¸ªà¸¡à¸­ à¸«à¸£à¸·à¸­à¸¡à¸µà¹à¸•à¹ˆà¸¢à¸­à¸”à¸ˆà¸°à¹„à¸¡à¹ˆà¸›à¸´à¸”",
    "à¸£à¸²à¸¢à¸à¸²à¸£à¸‹à¹‰à¸³à¸à¹ˆà¸­à¸™/à¸«à¸¥à¸±à¸‡à¹€à¸—à¸µà¹ˆà¸¢à¸‡à¸„à¸·à¸™à¸ˆà¸±à¸šà¸•à¹ˆà¸­à¹„à¸”à¹‰à¹€à¸¡à¸·à¹ˆà¸­ identity à¸•à¸£à¸‡à¹à¸¥à¸°à¹€à¸›à¹‡à¸™à¸„à¸¹à¹ˆà¹€à¸§à¸¥à¸²à¹ƒà¸à¸¥à¹‰à¸—à¸µà¹ˆà¸ªà¸¸à¸”à¸ à¸²à¸¢à¹ƒà¸™ 60 à¸™à¸²à¸—à¸µ; à¹€à¸à¹‡à¸šà¸«à¸¥à¸±à¸à¸à¸²à¸™à¸‚à¹‰à¸²à¸¡à¸§à¸±à¸™à¹ƒà¸™ Audit Log",
    "STM à¸˜à¸™à¸²à¸„à¸²à¸£à¸›à¸à¸•à¸´à¸ˆà¸±à¸šà¹€à¸§à¸¥à¸²à¸à¸±à¸šà¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œà¸§à¸±à¸™à¸—à¸µà¹ˆà¸˜à¸™à¸²à¸„à¸²à¸£à¹ƒà¸™à¸£à¸²à¸¢à¸‡à¸²à¸™à¸à¸²à¸/à¸–à¸­à¸™; BBL à¹à¸¥à¸° GSB à¸—à¸µà¹ˆà¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸§à¸¥à¸²à¹ƒà¸Šà¹‰à¸šà¸±à¸à¸Šà¸µ+à¸§à¸±à¸™+à¸—à¸´à¸¨à¸—à¸²à¸‡+à¸¢à¸­à¸”",
    "à¸£à¸²à¸¢à¸à¸²à¸£ KTB à¹€à¸§à¸¥à¸² 23:00-23:59 à¸—à¸µà¹ˆà¸˜à¸™à¸²à¸„à¸²à¸£à¸¥à¸‡à¸§à¸±à¸™à¸—à¸µà¹ˆà¸–à¸±à¸”à¹„à¸› à¹€à¸à¹‡à¸šà¹€à¸›à¹‡à¸™ candidate à¹à¸¥à¸°à¸›à¸´à¸”à¹„à¸”à¹‰à¹€à¸‰à¸žà¸²à¸°à¹€à¸¡à¸·à¹ˆà¸­à¸šà¸±à¸à¸Šà¸µ à¸—à¸´à¸¨à¸—à¸²à¸‡ à¸¢à¸­à¸” à¹à¸¥à¸°à¹€à¸§à¸¥à¸²à¸˜à¸™à¸²à¸„à¸²à¸£à¹€à¸›à¹‡à¸™à¸„à¸¹à¹ˆ 1:1 à¸à¸±à¸š BO à¸‚à¸­à¸‡à¸§à¸±à¸™à¸à¹ˆà¸­à¸™à¸«à¸™à¹‰à¸²",
    "à¸¢à¸­à¸”à¸•à¸£à¸‡à¸—à¸µà¹ˆà¹€à¸§à¸¥à¸²à¹à¸•à¸à¸•à¹ˆà¸²à¸‡à¹à¸•à¹ˆà¸£à¸°à¸šà¸¸à¸„à¸¹à¹ˆà¹„à¸”à¹‰à¸Šà¸±à¸”à¹€à¸ˆà¸™à¹€à¸›à¹‡à¸™à¸œà¸¥à¸à¸²à¸£à¸ˆà¸±à¸šà¸„à¸¹à¹ˆ à¹„à¸¡à¹ˆà¸ªà¹ˆà¸‡à¹ƒà¸«à¹‰ Audit à¸¢à¸·à¸™à¸¢à¸±à¸™; à¸«à¸¥à¸±à¸à¸à¸²à¸™à¸‚à¸±à¸”à¸à¸±à¸™à¸«à¸£à¸·à¸­à¸„à¸¹à¹ˆà¸à¸³à¸à¸§à¸¡à¸¢à¸±à¸‡à¸„à¸‡à¹€à¸›à¹‡à¸™à¹€à¸„à¸ª",
    "à¸£à¸²à¸¢à¸à¸²à¸£à¸à¸²à¸à¸¡à¸·à¸­à¸˜à¸™à¸²à¸„à¸²à¸£à¸›à¸à¸•à¸´: à¹ƒà¸Šà¹‰à¸¢à¸­à¸”à¸à¸±à¸šà¹€à¸§à¸¥à¸²à¸˜à¸™à¸²à¸„à¸²à¸£à¹ƒà¸™ BO à¸ˆà¸±à¸šà¸„à¸¹à¹ˆ STM; à¸—à¹‰à¸²à¸¢ 4 à¸•à¸±à¸§à¹à¸¥à¸°à¸Šà¸·à¹ˆà¸­à¸¥à¸¹à¸à¸„à¹‰à¸²à¹ƒà¸Šà¹‰à¸Šà¹ˆà¸§à¸¢à¹à¸¢à¸à¸£à¸²à¸¢à¸à¸²à¸£à¸‹à¹‰à¸³ à¹à¸¥à¸°à¸ˆà¸°à¹„à¸¡à¹ˆà¹€à¸›à¸´à¸”à¹€à¸„à¸ªà¹€à¸žà¸µà¸¢à¸‡à¹€à¸žà¸£à¸²à¸°à¸£à¸°à¸šà¸¸à¸§à¹ˆà¸²à¹€à¸•à¸´à¸¡à¸¡à¸·à¸­",
    "BBL/GSB à¸—à¸µà¹ˆ STM à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸§à¸¥à¸²: AT4 BBL à¸™à¸£à¸§à¸£à¸à¸²à¸, AT4 KTB à¹€à¸šà¸à¸ˆà¸žà¸£à¸à¸²à¸ à¹à¸¥à¸° SK8 BBL à¸”à¸¥à¸¢à¸²à¸à¸²à¸à¸¢à¸±à¸‡à¹ƒà¸Šà¹‰à¸à¸Žà¹€à¸‰à¸žà¸²à¸°à¹à¸šà¸šà¸¢à¸­à¸”à¹„à¸¡à¹ˆà¸‹à¹‰à¸³ à¸„à¸™à¸¥à¸°à¸¢à¸¹à¸ª à¹à¸¥à¸°à¸¢à¸­à¸” BO à¹„à¸¡à¹ˆà¹€à¸à¸´à¸™ STM",
    "STM à¸˜à¸™à¸²à¸„à¸²à¸£à¸›à¸à¸•à¸´à¹à¸¢à¸à¸Šà¸µà¸•à¸•à¸²à¸¡à¸šà¸±à¸à¸Šà¸µà¹à¸¥à¸°à¹à¸¢à¸à¸à¸²à¸ (D) / à¸–à¸­à¸™ (W)",
  ] },
  { id: "SYS7M", name: "à¹€à¸„à¸£à¸·à¸­ 7M", status: "active", companies: ["UFABET7M"], rules: [
    "PM à¸à¸²à¸à¹à¸¥à¸°à¸–à¸­à¸™à¸•à¹‰à¸­à¸‡à¸ˆà¸±à¸šà¸„à¸¹à¹ˆ 3 à¸ˆà¸¸à¸”: Ref/Ref Id à¹ƒà¸™ STM PM à¸à¸±à¸š Note à¸‚à¸­à¸‡ BO, User/Username à¸à¸±à¸š User à¹ƒà¸™ BO à¹à¸¥à¸°à¸¢à¸­à¸”à¸•à¸²à¸¡à¸Šà¹ˆà¸­à¸‡à¹€à¸‡à¸´à¸™à¸ˆà¸£à¸´à¸‡à¸‚à¸­à¸‡ Provider à¸à¸±à¸šà¸¢à¸­à¸” BO",
    "ATP à¸à¸²à¸à¹ƒà¸Šà¹‰à¸¢à¸­à¸” à¹‚à¸­à¸™à¸ˆà¸£à¸´à¸‡ Â· ATP à¸–à¸­à¸™à¹ƒà¸Šà¹‰à¸¢à¸­à¸” P2P à¸ˆà¹ˆà¸²à¸¢",
    "COREPAY à¹à¸¥à¸° CYBERPLUS à¸à¸²à¸à¹ƒà¸Šà¹‰ à¸ˆà¸³à¸™à¸§à¸™à¸—à¸µà¹ˆà¹„à¸”à¹‰à¸£à¸±à¸š Â· à¸–à¸­à¸™à¹ƒà¸Šà¹‰ à¸ˆà¸³à¸™à¸§à¸™à¹€à¸‡à¸´à¸™",
    "AZPAY à¸à¸²à¸à¹ƒà¸Šà¹‰ à¸ˆà¸³à¸™à¸§à¸™à¹€à¸‡à¸´à¸™ Â· MYPAY à¹à¸¥à¸° LOCALPAY à¸à¸²à¸/à¸–à¸­à¸™à¹ƒà¸Šà¹‰ à¸ˆà¸³à¸™à¸§à¸™à¹€à¸‡à¸´à¸™à¸•à¸²à¸¡à¸Šà¹ˆà¸­à¸‡à¸£à¸²à¸¢à¸à¸²à¸£",
    "Note à¸‚à¸­à¸‡ BO à¸­à¸²à¸ˆà¸¡à¸µà¸„à¸³à¸­à¸˜à¸´à¸šà¸²à¸¢ à¹€à¸Šà¹ˆà¸™ P2P à¸ªà¸³à¹€à¸£à¹‡à¸ˆà¸ˆà¸²à¸à¸£à¸²à¸¢à¸à¸²à¸£ P2C à¸«à¸£à¸·à¸­ MyPay à¸ªà¸³à¹€à¸£à¹‡à¸ˆà¸ˆà¸²à¸à¸£à¸²à¸¢à¸à¸²à¸£ à¸£à¸°à¸šà¸šà¸•à¹‰à¸­à¸‡à¸„à¹‰à¸™à¸«à¸² Ref à¸ à¸²à¸¢à¹ƒà¸™à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡ à¹„à¸¡à¹ˆà¹€à¸—à¸µà¸¢à¸šà¸—à¸±à¹‰à¸‡à¸Šà¹ˆà¸­à¸‡à¹à¸šà¸šà¸•à¸£à¸‡à¸•à¸±à¸§",
    "à¹€à¸§à¸¥à¸²à¹€à¸›à¹‡à¸™à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸›à¸£à¸°à¸à¸­à¸š à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸„à¸µà¸¢à¹Œà¸«à¸¥à¸±à¸ à¸–à¹‰à¸² Ref + User + à¸¢à¸­à¸”à¹€à¸‡à¸´à¸™à¸•à¸£à¸‡à¸à¸±à¸™à¹ƒà¸«à¹‰à¸›à¸´à¸”à¹„à¸”à¹‰ à¹à¸¡à¹‰à¹€à¸§à¸¥à¸²à¸•à¹ˆà¸²à¸‡à¸à¸±à¸™; à¸–à¹‰à¸² User à¹„à¸¡à¹ˆà¸„à¸£à¸š à¹ƒà¸Šà¹‰ Ref + à¸¢à¸­à¸”à¹€à¸‡à¸´à¸™à¹„à¸”à¹‰à¹€à¸¡à¸·à¹ˆà¸­à¹€à¸›à¹‡à¸™à¸„à¸¹à¹ˆà¹€à¸”à¸µà¸¢à¸§à¸—à¸µà¹ˆà¹„à¸¡à¹ˆà¸‹à¹‰à¸³",
    "à¸„à¹‰à¸™à¸«à¸²à¸„à¸¹à¹ˆà¸‚à¹‰à¸²à¸¡à¹à¸–à¸§/à¸‚à¹‰à¸²à¸¡à¸Šà¸µà¸•à¹„à¸”à¹‰ à¹à¸•à¹ˆà¸„à¸¹à¹ˆà¸‹à¹‰à¸³à¸«à¸£à¸·à¸­à¸„à¸¥à¸¸à¸¡à¹€à¸„à¸£à¸·à¸­à¸ˆà¸°à¸„à¸‡à¹„à¸§à¹‰à¹ƒà¸«à¹‰à¸•à¸£à¸§à¸ˆà¹€à¸žà¸´à¹ˆà¸¡ à¹„à¸¡à¹ˆà¸›à¸´à¸”à¸ˆà¸²à¸à¹€à¸§à¸¥à¸²à¹ƒà¸à¸¥à¹‰à¹€à¸„à¸µà¸¢à¸‡à¹€à¸žà¸µà¸¢à¸‡à¸­à¸¢à¹ˆà¸²à¸‡à¹€à¸”à¸µà¸¢à¸§",
    "STM à¸˜à¸™à¸²à¸„à¸²à¸£à¸›à¸à¸•à¸´à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¸”à¹‰à¸§à¸¢à¸¢à¸­à¸”à¹€à¸‡à¸´à¸™à¹à¸¥à¸°à¸à¸²à¸/à¸–à¸­à¸™à¸ à¸²à¸¢à¹ƒà¸™à¸šà¸±à¸à¸Šà¸µà¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™ à¸£à¸­à¸‡à¸£à¸±à¸š BO/STM à¹€à¸£à¸µà¸¢à¸‡à¹à¸–à¸§à¹„à¸¡à¹ˆà¸•à¸£à¸‡à¸à¸±à¸™ à¹‚à¸”à¸¢à¹ƒà¸Šà¹‰à¹€à¸§à¸¥à¸²à¸—à¸µà¹ˆà¹ƒà¸à¸¥à¹‰à¸—à¸µà¹ˆà¸ªà¸¸à¸”à¸Šà¹ˆà¸§à¸¢à¹€à¸¥à¸·à¸­à¸à¸„à¸¹à¹ˆ",
    "à¹€à¸‰à¸žà¸²à¸° TMN à¹à¸¢à¸à¸Šà¸µà¸•à¸à¸²à¸ (D) à¹à¸¥à¸°à¸–à¸­à¸™ (W); STM à¸˜à¸™à¸²à¸„à¸²à¸£à¸›à¸à¸•à¸´à¸­à¸·à¹ˆà¸™à¸£à¸§à¸¡à¸à¸²à¸-à¸–à¸­à¸™ (D-W) à¹„à¸§à¹‰à¸Šà¸µà¸•à¹€à¸”à¸µà¸¢à¸§à¸•à¹ˆà¸­à¸šà¸±à¸à¸Šà¸µ; à¹à¸ªà¸”à¸‡à¸ªà¸–à¸²à¸™à¸° à¸§à¸´à¸˜à¸µà¸ˆà¸±à¸šà¸„à¸¹à¹ˆ à¹€à¸«à¸•à¸¸à¸œà¸¥ à¹à¸¥à¸°à¸¢à¸­à¸”à¸£à¸§à¸¡à¸—à¹‰à¸²à¸¢à¸Šà¸µà¸•"
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
    return `<optgroup label="${h(group.name)}${group.status === "pending" ? " Â· à¸£à¸­à¹€à¸‡à¸·à¹ˆà¸­à¸™à¹„à¸‚" : ""}">${members.map((code) => `<option value="${h(code)}" ${code === selected ? "selected" : ""}>${h(code)}</option>`).join("")}</optgroup>`;
  }).join("");
  const grouped = new Set(AUDIT_COMPANY_GROUPS.flatMap((group) => group.companies));
  const ungrouped = [...available].filter((code) => !grouped.has(code)).sort((a, b) => a.localeCompare(b, "th"));
  return groups + (ungrouped.length ? `<optgroup label="à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸ˆà¸±à¸”à¹€à¸„à¸£à¸·à¸­">${ungrouped.map((code) => `<option value="${h(code)}" ${code === selected ? "selected" : ""}>${h(code)}</option>`).join("")}</optgroup>` : "");
}

function reviewCompanyGroupsMarkup(companies) {
  const available = new Map((companies || []).map((company) => [String(company.code || "").trim().toUpperCase(), company]));
  const configured = new Set(AUDIT_COMPANY_GROUPS.flatMap((group) => group.companies));
  const groupCards = AUDIT_COMPANY_GROUPS.map((group) => {
    const members = group.companies.map((code) => available.get(code)).filter(Boolean);
    if (!members.length) return "";
    return `<article class="company-group-card review-company-group ${group.status === "pending" ? "pending" : "active"}">
      <div class="company-group-head"><div><strong>${h(group.name)}</strong><span>${num(members.length)} à¸šà¸£à¸´à¸©à¸±à¸—</span></div><span class="badge ${group.status === "active" ? "green" : "grey"}">${group.status === "active" ? "à¹ƒà¸Šà¹‰à¸à¸Žà¹à¸¥à¹‰à¸§" : "à¸£à¸­à¹€à¸‡à¸·à¹ˆà¸­à¸™à¹„à¸‚"}</span></div>
      <div class="company-subcompany-list">${members.map((company) => `<button type="button" class="company-subcompany" data-review-company="${h(company.code)}"><span><b>${h(company.code)}</b><small>${h(company.name || company.code)}</small></span><i>à¹€à¸›à¸´à¸”à¸Šà¸µà¸—à¸‚à¸­à¸‡à¸šà¸£à¸´à¸©à¸±à¸—à¸™à¸µà¹‰</i></button>`).join("")}</div>
      ${group.status === "active" ? `<details class="company-rule-details" open><summary>à¹€à¸‡à¸·à¹ˆà¸­à¸™à¹„à¸‚à¸•à¸£à¸§à¸ˆà¸‚à¸­à¸‡${h(group.name)}</summary><ol>${group.rules.map((rule) => `<li>${h(rule)}</li>`).join("")}</ol><p>à¹ƒà¸Šà¹‰à¸à¸±à¸š ${num(members.length)} à¸šà¸£à¸´à¸©à¸±à¸—à¹ƒà¸™à¸à¸¥à¸¸à¹ˆà¸¡à¸™à¸µà¹‰ Â· à¸«à¸¥à¸±à¸à¸à¸²à¸™à¹„à¸¡à¹ˆà¸„à¸£à¸šà¸«à¸£à¸·à¸­à¸¡à¸µà¸«à¸¥à¸²à¸¢à¸„à¸¹à¹ˆà¸•à¹‰à¸­à¸‡à¸„à¸‡à¹€à¸„à¸ªà¹ƒà¸«à¹‰ Audit à¸•à¸£à¸§à¸ˆ</p></details>` : `<div class="company-group-pending"><b>à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹€à¸›à¸´à¸”à¸à¸Žà¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´</b><span>à¸£à¸­à¹€à¸‡à¸·à¹ˆà¸­à¸™à¹„à¸‚à¸ˆà¸²à¸ Audit à¹à¸¥à¸°à¸ˆà¸°à¹„à¸¡à¹ˆà¹ƒà¸Šà¹‰à¸à¸Žà¸‚à¸­à¸‡à¸à¸¥à¸¸à¹ˆà¸¡à¸­à¸·à¹ˆà¸™à¹à¸—à¸™</span></div>`}
    </article>`;
  }).join("");
  const ungrouped = [...available.entries()].filter(([code]) => !configured.has(code)).map(([, company]) => company);
  const ungroupedCard = ungrouped.length ? `<article class="company-group-card review-company-group pending"><div class="company-group-head"><div><strong>à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸ˆà¸±à¸”à¹€à¸„à¸£à¸·à¸­</strong><span>${num(ungrouped.length)} à¸šà¸£à¸´à¸©à¸±à¸—</span></div><span class="badge grey">à¸£à¸­à¸ˆà¸±à¸”à¸à¸¥à¸¸à¹ˆà¸¡</span></div><div class="company-subcompany-list">${ungrouped.map((company) => `<button type="button" class="company-subcompany" data-review-company="${h(company.code)}"><span><b>${h(company.code)}</b><small>${h(company.name || company.code)}</small></span><i>à¹€à¸›à¸´à¸”à¸Šà¸µà¸—à¸‚à¸­à¸‡à¸šà¸£à¸´à¸©à¸±à¸—à¸™à¸µà¹‰</i></button>`).join("")}</div></article>` : "";
  return groupCards + ungroupedCard;
}

function auditRuleBookMarkup(selectedCompany = "") {
  const selectedGroup = auditCompanyGroupOf(selectedCompany);
  const activeGroups = AUDIT_COMPANY_GROUPS.filter((group) => group.status === "active");
  return `<section class="panel audit-rule-book" aria-label="à¹€à¸‡à¸·à¹ˆà¸­à¸™à¹„à¸‚à¸à¸²à¸£à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸—à¸µà¹ˆà¸£à¸°à¸šà¸šà¹ƒà¸Šà¹‰à¸ˆà¸£à¸´à¸‡">
    <div class="panel-heading"><div><p class="eyebrow">à¸à¸•à¸´à¸à¸²à¸—à¸µà¹ˆà¸£à¸°à¸šà¸šà¹ƒà¸Šà¹‰à¸ˆà¸£à¸´à¸‡</p><h2>à¹€à¸‡à¸·à¹ˆà¸­à¸™à¹„à¸‚à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸” XB Â· 123 Â· 7M</h2><small class="head-sub">à¹à¸ªà¸”à¸‡à¸à¸Žà¸—à¸µà¹ˆà¹€à¸›à¸´à¸”à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¹à¸¥à¹‰à¸§à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ Â· à¸„à¸¹à¹ˆà¸‹à¹‰à¸³ à¸«à¸¥à¸±à¸à¸à¸²à¸™à¹„à¸¡à¹ˆà¸„à¸£à¸š à¸«à¸£à¸·à¸­à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸‚à¸±à¸”à¸à¸±à¸™à¸ˆà¸°à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸›à¸´à¸”à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´</small></div><span class="health ok">${num(activeGroups.length)} à¹€à¸„à¸£à¸·à¸­à¹€à¸›à¸´à¸”à¹ƒà¸Šà¹‰</span></div>
    <div class="audit-rule-book-grid">
      ${activeGroups.map((group) => `<article class="audit-rule-book-card ${selectedGroup?.id === group.id ? "selected" : ""}">
        <header><div><strong>${h(group.name)}</strong><small>${h(group.companies.join(" Â· "))}</small></div><span class="badge green">à¹ƒà¸Šà¹‰à¸à¸Žà¹à¸¥à¹‰à¸§</span></header>
        <ol>${group.rules.map((rule) => `<li>${h(rule)}</li>`).join("")}</ol>
      </article>`).join("")}
    </div>
    <div class="cross-day-rule-flow">
      <strong>à¸§à¸‡à¸ˆà¸£à¸£à¸²à¸¢à¸à¸²à¸£à¸‚à¹‰à¸²à¸¡à¸§à¸±à¸™</strong>
      <span><b>1</b> à¸§à¸±à¸™à¹à¸£à¸: à¸„à¹‰à¸²à¸‡à¸£à¸­à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸‚à¹‰à¸²à¸¡à¸§à¸±à¸™à¹à¸¥à¸°à¹à¸ˆà¹‰à¸‡ Audit</span>
      <i>â†’</i>
      <span><b>2</b> à¸§à¸±à¸™à¸–à¸±à¸”à¹„à¸›: à¸„à¹‰à¸™à¸«à¸²à¸„à¸¹à¹ˆà¹€à¸”à¸´à¸¡à¸”à¹‰à¸§à¸¢à¸šà¸±à¸à¸Šà¸µ/Provider à¸—à¸´à¸¨à¸—à¸²à¸‡ à¸¢à¸­à¸” à¹à¸¥à¸°à¸«à¸¥à¸±à¸à¸à¸²à¸™à¸­à¹‰à¸²à¸‡à¸­à¸´à¸‡</span>
      <i>â†’</i>
      <span><b>3</b> à¸žà¸šà¸„à¸¹à¹ˆà¹€à¸”à¸µà¸¢à¸§: à¸›à¸´à¸”à¸£à¸²à¸¢à¸à¸²à¸£à¸„à¹‰à¸²à¸‡ à¸™à¸³à¸­à¸­à¸à¸ˆà¸²à¸à¸„à¸´à¸§ à¹à¸¥à¸°à¹€à¸à¹‡à¸šà¸›à¸£à¸°à¸§à¸±à¸•à¸´à¹ƒà¸™ Audit Log</span>
      <em>à¹„à¸¡à¹ˆà¸žà¸šà¸„à¸¹à¹ˆà¸«à¸£à¸·à¸­à¸žà¸šà¸«à¸¥à¸²à¸¢à¸„à¸¹à¹ˆ: à¸„à¸‡à¹„à¸§à¹‰à¹ƒà¸«à¹‰ Audit à¸•à¸£à¸§à¸ˆ à¹„à¸¡à¹ˆà¸šà¸±à¸‡à¸„à¸±à¸šà¸›à¸´à¸”</em>
    </div>
  </section>`;
}

/* à¸«à¸™à¹‰à¸²à¸—à¸µà¹ˆà¹à¸•à¹ˆà¸¥à¸° role à¸¡à¸­à¸‡à¹€à¸«à¹‡à¸™ */
const ROUTE_ROLES = {
  monitor: ["cloud", "dashboard", "daily-summary", "mc8-sheets", "exceptions", "matching", "clarify", "audit-review", "reports", "monthly-audit", "notifications"],
  audit_assistant: ["cloud", "dashboard", "daily-summary", "mc8-sheets", "exceptions", "matching", "clarify", "audit-review", "approvals", "reports", "monthly-audit", "notifications"],
  lead: ["cloud", "dashboard", "daily-summary", "mc8-sheets", "intake", "exceptions", "matching", "clarify", "audit-review", "approvals", "damage", "kpi", "reports", "monthly-audit", "talk", "rules", "account-holds", "notifications", "audit-log", "case-settings", "users", "finance"],
  shift_lead: ["cloud", "daily-summary", "clarify", "notifications"],
  exec: ["dashboard", "daily-summary", "kpi", "reports", "damage", "notifications", "finance"],
  /* à¸œà¸¹à¹‰à¸”à¸¹à¹à¸¥à¸£à¸°à¸šà¸šà¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹à¸¥à¸°à¸Šà¹ˆà¸§à¸¢à¸‡à¸²à¸™à¹„à¸”à¹‰à¸—à¸¸à¸à¸«à¸™à¹‰à¸² à¸£à¸§à¸¡à¸«à¸™à¹‰à¸²à¸§à¸´à¹€à¸„à¸£à¸²à¸°à¸«à¹Œà¸—à¸µà¹ˆà¸‹à¹ˆà¸­à¸™à¸ˆà¸²à¸à¸šà¸—à¸šà¸²à¸—à¸—à¸±à¹ˆà¸§à¹„à¸› */
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

/* à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¸›à¸£à¸°à¹€à¸ à¸— exception à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” = à¸—à¸µà¹ˆà¸•à¸±à¹‰à¸‡à¹„à¸§à¹‰à¹ƒà¸™à¸£à¸°à¸šà¸š + à¸—à¸µà¹ˆà¹€à¸à¸´à¸”à¸ˆà¸£à¸´à¸‡à¸ˆà¸²à¸à¸à¸Žà¸˜à¸¸à¸£à¸à¸´à¸ˆ */
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
  username: state.access.email || (typeof Sb !== "undefined" ? Sb.currentEmail() : "") || "à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸£à¸°à¸šà¸š",
  name: state.access.fullName || state.access.email || "à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸£à¸°à¸šà¸š",
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

/* à¸šà¸±à¸™à¸—à¸¶à¸à¸ªà¸–à¸²à¸™à¸°à¹€à¸„à¸ªà¸—à¸µà¹ˆà¸–à¸¹à¸à¹à¸à¹‰ à¹ƒà¸«à¹‰à¸­à¸¢à¸¹à¹ˆà¸£à¸­à¸”à¸‚à¹‰à¸²à¸¡à¸à¸²à¸£à¸£à¸µà¹€à¸Ÿà¸£à¸Š */
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
      response_text: e.responseText || e.resolutionNote || (e.notes || []).map((note) => note.text).filter(Boolean).join("\n") || "à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸žà¸£à¹‰à¸­à¸¡à¸«à¸¥à¸±à¸à¸à¸²à¸™",
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
      toast("à¸šà¸±à¸™à¸—à¸¶à¸à¸ªà¸–à¸²à¸™à¸°à¸à¸¥à¸±à¸š Supabase à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: " + err.message, "warn");
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
  toast(`à¸ªà¸´à¸—à¸˜à¸´à¹Œ ${DB.roles[state.role].name} à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–${what}à¹„à¸”à¹‰`, "warn");
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
/* ---------------- à¸Šà¹ˆà¸§à¸‡à¸§à¸±à¸™à¸—à¸µà¹ˆ ---------------- */
const DATE_PRESETS = [
  { code: "day", name: "à¸§à¸±à¸™à¸—à¸µà¹ˆà¸•à¸£à¸§à¸ˆ (à¸§à¸±à¸™à¹€à¸”à¸µà¸¢à¸§)" },
  { code: "last7", name: "7 à¸§à¸±à¸™à¸¥à¹ˆà¸²à¸ªà¸¸à¸”" },
  { code: "last30", name: "30 à¸§à¸±à¸™à¸¥à¹ˆà¸²à¸ªà¸¸à¸”" },
  { code: "thisMonth", name: "à¹€à¸”à¸·à¸­à¸™à¸™à¸µà¹‰" },
  { code: "lastMonth", name: "à¹€à¸”à¸·à¸­à¸™à¸à¹ˆà¸­à¸™" },
  { code: "thisQuarter", name: "à¹„à¸•à¸£à¸¡à¸²à¸ªà¸™à¸µà¹‰" },
  { code: "thisYear", name: "à¸›à¸µà¸™à¸µà¹‰" },
  { code: "custom", name: "à¸à¸³à¸«à¸™à¸”à¹€à¸­à¸‡" },
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
  state.filters.from === state.filters.to ? state.filters.from : `${state.filters.from} à¸–à¸¶à¸‡ ${state.filters.to}`;

/* à¹à¸ªà¸”à¸‡à¸œà¸¥à¸•à¹ˆà¸²à¸‡à¹ƒà¸«à¹‰à¸•à¸£à¸‡à¸à¸±à¸šà¸„à¸§à¸²à¸¡à¸«à¸¡à¸²à¸¢à¸‚à¸­à¸‡ exception à¹à¸•à¹ˆà¸¥à¸°à¸›à¸£à¸°à¹€à¸ à¸— */
function diffLabel(e) {
  switch (e.type) {
    case "amount_diff":
      return `<span class="danger">${money(e.amountDiff)}</span>`;
    case "time_diff":
      return `${e.timeDiffSec} à¸§à¸´`;
    case "cross_day":
      return `<span class="muted">à¸‚à¹‰à¸²à¸¡à¸§à¸±à¸™ ${e.timeDiffSec} à¸§à¸´</span>`;
    case "missing_bo":
      return `<span class="danger">à¹„à¸¡à¹ˆà¸žà¸šà¹ƒà¸™ BO</span>`;
    case "missing_stm":
      return `<span class="danger">à¹„à¸¡à¹ˆà¸žà¸šà¹ƒà¸™ STM</span>`;
    case "duplicate":
      return `<span class="danger">à¸‹à¹‰à¸³ ${money(e.riskAmount)}</span>`;
    default:
      return `<span class="danger">${money(e.riskAmount)}</span>`;
  }
}
function hasComparableExceptionTimes(e) {
  return !!(e && e.boTime && e.stmTime && e.boTime !== "-" && e.stmTime !== "-");
}
function exceptionTimeDiffLabel(e) {
  return hasComparableExceptionTimes(e) ? `${num(e.timeDiffSec)} à¸§à¸´` : "à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸§à¸¥à¸²";
}
function evidenceTimeDiffLabel(e) {
  return e?.bo?.noTime || e?.stm?.noTime || !Number.isFinite(Number(e?.timeDifferenceSeconds))
    ? "à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸§à¸¥à¸²"
    : `${num(e.timeDifferenceSeconds)} à¸§à¸´à¸™à¸²à¸—à¸µ`;
}
const sumRisk = (list) => list.reduce((a, c) => a + (c.riskAmount || 0), 0);
const severityColor = (s) => Charts.STATUS[s] || "#7c8ea2";
const statusMeta = (code) => DB.statuses.find((s) => s.code === code) || { name: code, tone: "grey" };
const caseStatusMeta = (e) => (e.reviewHold || window.AccountReviewHolds?.match(e)) ? {name:AccountReviewHolds.label,tone:'amber'} : e.closureRequestId && e.status === 'answered' ? {name:'à¸£à¸­à¸«à¸±à¸§à¸«à¸™à¹‰à¸²à¸›à¸´à¸”à¹€à¸„à¸ª',tone:'grey'} : statusMeta(e.status);
const sevMeta = (code) => DB.severities.find((s) => s.code === code) || { name: code };
const isEmptyPmFile = (file) => file?.parsed && !file?.parse_error && file?.kind === "pm_statement" && Number(file?.row_count || 0) === 0 && Number(file?.size_bytes || 0) <= 16;
const parsedFileLabel = (file) => isEmptyPmFile(file) ? "à¹„à¸¡à¹ˆà¸¡à¸µà¸£à¸²à¸¢à¸à¸²à¸£ (0)" : "à¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™";

/* à¸›à¸´à¸”à¸”à¹ˆà¸§à¸™à¹„à¸”à¹‰à¹€à¸¡à¸·à¹ˆà¸­à¸¡à¸µà¸£à¸²à¸¢à¸à¸²à¸£à¸„à¸£à¸šà¸—à¸±à¹‰à¸‡à¸ªà¸­à¸‡à¸à¸±à¹ˆà¸‡à¹à¸¥à¸°à¸¢à¸­à¸”à¹€à¸—à¹ˆà¸²à¸à¸±à¸™ à¸œà¸¹à¹‰à¸•à¸£à¸§à¸ˆà¸¢à¸±à¸‡à¸•à¹‰à¸­à¸‡à¸à¸”à¸¢à¸·à¸™à¸¢à¸±à¸™à¹€à¸­à¸‡ */
function isQuickCloseEligible(e) {
  if (typeof state !== "undefined" && state.dataset === "production") return !!e?._quickSourceEvidence && e.status === "open";
  const realEvidence = (raw) => {
    const value = String(raw || "").trim();
    return value.length > 1 && !/^[â€”â€“-]|à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸²à¸¢à¸à¸²à¸£|à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¹ƒà¸Šà¹‰\s*statement|à¸•à¸£à¸§à¸ˆà¸ˆà¸²à¸à¸£à¸²à¸¢à¸‡à¸²à¸™à¸«à¸¥à¸±à¸‡à¸šà¹‰à¸²à¸™|à¸£à¸­à¸‚à¹‰à¸­à¸¡à¸¹à¸¥|à¹„à¸¡à¹ˆà¸¡à¸µà¸‚à¹‰à¸­à¸¡à¸¹à¸¥/i.test(value);
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
  if (!data.files.length) blockers.push("à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œ");
  if (!data.checklist) blockers.push("Checklist à¸¢à¸±à¸‡à¹‚à¸«à¸¥à¸”à¹„à¸¡à¹ˆà¸„à¸£à¸š");
  if (!data.reconciliationFiles.length || data.reconciliationFiles.some((f) => !f.parsed || f.parse_error)) blockers.push("à¸¢à¸±à¸‡à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¹„à¸¡à¹ˆà¸„à¸£à¸š");
  if (!data.quality.length || data.quality.some((r) => !r.run_id || r.status !== "completed")) blockers.push("à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸ªà¸³à¹€à¸£à¹‡à¸ˆà¸„à¸£à¸š");
  if (!data.boFirst || data.boFirst.complete !== true || (data.boFirst.missing || []).length) blockers.push("à¸¢à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸„à¸¹à¹ˆ STM/PM à¸•à¸²à¸¡ BO à¹„à¸¡à¹ˆà¸„à¸£à¸š");
  if ((data.checklist?.missing_items || []).length) blockers.push("à¸¡à¸µà¹€à¸­à¸à¸ªà¸²à¸£à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸•à¸´à¸”à¸•à¸²à¸¡");
  if (data.stillOpen > 0) blockers.push(`à¸¢à¸±à¸‡à¸¡à¸µ ${data.stillOpen} à¹€à¸„à¸ªà¸„à¹‰à¸²à¸‡`);
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
  if(!context.date||!canAccessCompany(context.company))throw Error('à¹„à¸¡à¹ˆà¸žà¸šà¸‚à¸­à¸šà¹€à¸‚à¸•à¸šà¸£à¸´à¸©à¸±à¸—à¹à¸¥à¸°à¸§à¸±à¸™à¸—à¸µà¹ˆà¸‚à¸­à¸‡à¹€à¸„à¸ª');
  const [raw,scopes]=await Promise.all([
    Sb.currentExceptions({company:context.company,from:context.date,to:context.date,limit:10000}),
    Sb.reviewHoldScopes(),
  ]);
  if(!Array.isArray(raw)||raw.length>=10000||!Array.isArray(scopes))throw Error('à¸¢à¸±à¸‡à¹‚à¸«à¸¥à¸”à¸£à¸²à¸¢à¸à¸²à¸£à¹€à¸„à¸ªà¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™à¹„à¸¡à¹ˆà¸„à¸£à¸š à¸à¸£à¸¸à¸“à¸²à¸¥à¸­à¸‡à¸•à¸£à¸§à¸ˆà¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡');
  if(context.actor!==(Sb.authUser()?.id||null)||context.route!==state.route)throw Error('à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸«à¸£à¸·à¸­à¸«à¸™à¹‰à¸²à¸£à¸²à¸¢à¸à¸²à¸£à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¹à¸¥à¹‰à¸§');
  AccountReviewHolds.set(scopes);
  const rows=raw.map(mapLiveException).filter(row=>row.company===context.company&&row.date===context.date);
  const index=rows.findIndex(row=>caseUiKey(row)===caseUiKey(e));
  const ordered=index<0?rows:rows.slice(index+1).concat(rows.slice(0,index));
  const candidates=ordered.filter(row=>caseUiKey(row)!==caseUiKey(e)&&isUnsentClarificationCase(row)&&!AccountReviewHolds.match(row));
  if(context.readOnlyQueue){
    const flags=await Sb.caseEvidenceFlags(candidates.map(row=>row.dbId));
    if(context.actor!==(Sb.authUser()?.id||null)||context.route!==state.route)throw Error('à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸«à¸£à¸·à¸­à¸«à¸™à¹‰à¸²à¸£à¸²à¸¢à¸à¸²à¸£à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¹à¸¥à¹‰à¸§');
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
  if(!can('request_clarify')||!canAccessCompany(e.company))return deny('à¸”à¸¹à¸„à¸´à¸§à¹€à¸„à¸ªà¸–à¸±à¸”à¹„à¸›');
  if(state.dataset==='production'&&!Sb.signedIn())return deny('à¸”à¸¹à¸„à¸´à¸§à¹€à¸„à¸ªà¸–à¸±à¸”à¹„à¸›');
  captureCaseOpenDraft();
  const context=captureClarificationRequestContext(e);
  context.readOnlyQueue=true;
  return showClarificationRequestReceipt(e,context,{readOnly:true});
}
async function showClarificationRequestReceipt(e, context, {readOnly=false} = {}) {
  const next=()=>context.nextKeys.map(key=>DB.exceptions.find(row=>caseUiKey(row)===key)).find(row=>row
    && row.company===context.company && isUnsentClarificationCase(row)
    && canAccessCompany(row.company));
  openModal(readOnly?'à¸”à¸¹à¸„à¸´à¸§à¹€à¸„à¸ªà¸–à¸±à¸”à¹„à¸› â€” à¸­à¹ˆà¸²à¸™à¸­à¸¢à¹ˆà¸²à¸‡à¹€à¸”à¸µà¸¢à¸§':'à¸ªà¹ˆà¸‡à¸‚à¸­à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸ªà¸³à¹€à¸£à¹‡à¸ˆà¹à¸¥à¹‰à¸§', `<div role="status"><p><strong>${h(caseLabel(e))}</strong></p><p>${readOnly?'à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸ªà¹ˆà¸‡à¸„à¸³à¸‚à¸­à¹ƒà¸” à¹† Â· à¹€à¸›à¸´à¸”à¸”à¸¹à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ à¹„à¸¡à¹ˆà¸ªà¸£à¹‰à¸²à¸‡à¹€à¸„à¸ª à¹„à¸¡à¹ˆà¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸¢à¸­à¸” à¹à¸¥à¸°à¹„à¸¡à¹ˆà¸›à¸´à¸”à¹€à¸„à¸ª':'à¸ªà¹ˆà¸‡à¸„à¸³à¸‚à¸­à¹ƒà¸«à¹‰à¸œà¸¹à¹‰à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¹ƒà¸™à¹€à¸„à¸ªà¹€à¸”à¸´à¸¡à¹à¸¥à¹‰à¸§ à¹„à¸¡à¹ˆà¸ªà¸£à¹‰à¸²à¸‡à¹€à¸„à¸ªà¸‹à¹‰à¸³ à¹„à¸¡à¹ˆà¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸¢à¸­à¸” à¹à¸¥à¸°à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸›à¸´à¸”à¹€à¸„à¸ª'}</p><p id="requestReceiptStatus">à¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆà¹€à¸„à¸ªà¸–à¸±à¸”à¹„à¸›à¸ˆà¸²à¸à¸œà¸¥à¸«à¸¥à¸±à¸à¸¥à¹ˆà¸²à¸ªà¸¸à¸”â€¦</p><small>à¸„à¸‡à¸šà¸£à¸´à¸©à¸±à¸— à¸§à¸±à¸™à¸—à¸µà¹ˆ à¸•à¸±à¸§à¸à¸£à¸­à¸‡ à¸«à¸™à¹‰à¸²à¸£à¸²à¸¢à¸à¸²à¸£ à¹à¸¥à¸°à¸•à¸³à¹à¸«à¸™à¹ˆà¸‡à¹€à¸¥à¸·à¹ˆà¸­à¸™à¹€à¸”à¸´à¸¡ Â· à¸„à¸´à¸§à¸„à¸£à¸­à¸šà¸„à¸¥à¸¸à¸¡à¸—à¸¸à¸à¸šà¸±à¸à¸Šà¸µà¹ƒà¸™à¸šà¸£à¸´à¸©à¸±à¸—/à¸§à¸±à¸™à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™ à¸•à¸£à¸§à¸ˆà¸šà¸±à¸à¸Šà¸µà¹€à¸”à¸´à¸¡à¸à¹ˆà¸­à¸™ Â· à¹„à¸Ÿà¸¥à¹Œà¹à¸™à¸šà¸­à¸¢à¹ˆà¸²à¸‡à¹€à¸”à¸µà¸¢à¸§à¸¢à¸±à¸‡à¸–à¸·à¸­à¸§à¹ˆà¸²à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸ªà¹ˆà¸‡</small></div>${readOnly?'<div id="readOnlyCaseQueue" aria-label="à¸¥à¸³à¸”à¸±à¸šà¹€à¸„à¸ªà¸–à¸±à¸”à¹„à¸›"></div>':''}`,
    `<button class="ghost-button" id="requestReceiptReturn">${readOnly?'à¸à¸¥à¸±à¸šà¹€à¸„à¸ª / à¸£à¸²à¸¢à¸à¸²à¸£à¹€à¸”à¸´à¸¡':'à¸à¸¥à¸±à¸šà¸«à¸™à¹‰à¸²à¸£à¸²à¸¢à¸à¸²à¸£'}</button><button class="primary-button" id="requestReceiptNext" disabled>à¸•à¸£à¸§à¸ˆà¹€à¸„à¸ªà¸–à¸±à¸”à¹„à¸›à¸‚à¸­à¸‡à¸šà¸£à¸´à¸©à¸±à¸—à¸™à¸µà¹‰</button>`);
  const nextButton=$('#requestReceiptNext'),status=$('#requestReceiptStatus');
  let acted=false,busy=false,failed=false;
  $('#modal')._contentCleanup=()=>{acted=true;};
  const active=()=>!acted&&state.route===context.route&&(Sb.authUser()?.id||null)===context.actor&&$('#requestReceiptNext')===nextButton;
  const returnToList=()=>{closeModal();if(!readOnly)closeDrawer();if(!readOnly&&context.route!=='mc8-sheets')render();restoreClarificationRequestScroll(context);};
  const refresh=async()=>{
    busy=true;nextButton.disabled=true;status.textContent='à¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆà¹€à¸„à¸ªà¸–à¸±à¸”à¹„à¸›à¸ˆà¸²à¸à¸œà¸¥à¸«à¸¥à¸±à¸à¸¥à¹ˆà¸²à¸ªà¸¸à¸”â€¦';
    try{
      await loadClarificationReceiptCandidates(e,context);
      if(!active())return;
      failed=false;const row=next();nextButton.disabled=!row;nextButton.textContent=readOnly?'à¹€à¸›à¸´à¸”à¸”à¸¹à¹€à¸„à¸ªà¸–à¸±à¸”à¹„à¸› (à¹„à¸¡à¹ˆà¸ªà¹ˆà¸‡à¸„à¸³à¸‚à¸­)':'à¸•à¸£à¸§à¸ˆà¹€à¸„à¸ªà¸–à¸±à¸”à¹„à¸›à¸‚à¸­à¸‡à¸šà¸£à¸´à¸©à¸±à¸—à¸™à¸µà¹‰';
      status.textContent=row?`à¹€à¸„à¸ªà¸–à¸±à¸”à¹„à¸›: ${caseLabel(row)} Â· ${row.account||'à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸'} Â· ${!clarificationAccountKey(e)?'à¹€à¸£à¸´à¹ˆà¸¡à¸ˆà¸²à¸à¸„à¸´à¸§à¸‚à¸­à¸‡à¸šà¸£à¸´à¸©à¸±à¸—à¸™à¸µà¹‰':clarificationAccountKey(row)===clarificationAccountKey(e)?'à¸•à¸£à¸§à¸ˆà¸šà¸±à¸à¸Šà¸µà¹€à¸”à¸´à¸¡à¸•à¹ˆà¸­':'à¸šà¸±à¸à¸Šà¸µà¹€à¸”à¸´à¸¡à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸„à¸ªà¸—à¸µà¹ˆà¸ªà¹ˆà¸‡à¸•à¹ˆà¸­à¹„à¸”à¹‰ à¹„à¸›à¸šà¸±à¸à¸Šà¸µà¸­à¸·à¹ˆà¸™à¸‚à¸­à¸‡à¸šà¸£à¸´à¸©à¸±à¸—à¸™à¸µà¹‰'}`:'à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸„à¸ªà¸—à¸µà¹ˆà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸ªà¹ˆà¸‡à¸‚à¸­à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¹ƒà¸™à¸‚à¸­à¸šà¹€à¸‚à¸•à¸™à¸µà¹‰à¹à¸¥à¹‰à¸§ (à¹„à¸¡à¹ˆà¸£à¸§à¸¡à¹€à¸„à¸ªà¸žà¸±à¸à¸•à¸£à¸§à¸ˆ)';
      if(readOnly){
        const queue=context.nextKeys.map(key=>DB.exceptions.find(row=>caseUiKey(row)===key)).filter(row=>row&&row.company===context.company&&canAccessCompany(row.company)&&isUnsentClarificationCase(row));
        const stats=context.queueStats||{};
        $('#readOnlyCaseQueue').innerHTML=`<p>à¹€à¸„à¸ªà¹ƒà¸™à¸œà¸¥à¸«à¸¥à¸±à¸ ${num(stats.total||0)} Â· à¸žà¸±à¸à¸•à¸£à¸§à¸ˆ ${num(stats.held||0)} Â· à¸„à¸´à¸§à¸–à¸±à¸”à¹„à¸› ${num(queue.length)} (à¹„à¸¡à¹ˆà¸£à¸§à¸¡à¹€à¸„à¸ªà¸—à¸µà¹ˆà¸à¸³à¸¥à¸±à¸‡à¹€à¸›à¸´à¸”)</p><div class="table-wrap"><table><thead><tr><th>à¸¥à¸³à¸”à¸±à¸š</th><th>à¹€à¸„à¸ª</th><th>à¸šà¸±à¸à¸Šà¸µ</th><th>à¸«à¸¥à¸±à¸à¸à¸²à¸™</th></tr></thead><tbody>${queue.slice(0,100).map((row,i)=>`<tr data-next-queue-case="${h(row.dbId||row.id)}"><td>${i+1}${clarificationAccountKey(row)===clarificationAccountKey(e)?' Â· à¸šà¸±à¸à¸Šà¸µà¹€à¸”à¸´à¸¡':''}</td><td>${h(row.code||row.id)}</td><td>${h(row.account||'à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸')}</td><td>${row.hasEvidence?'à¹à¸™à¸šà¹à¸¥à¹‰à¸§ â€” à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸ªà¹ˆà¸‡':'à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹à¸™à¸š â€” à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸ªà¹ˆà¸‡'}</td></tr>`).join('')||'<tr><td colspan="4">à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸„à¸ªà¸–à¸±à¸”à¹„à¸›à¸—à¸µà¹ˆà¸ªà¹ˆà¸‡à¸•à¹ˆà¸­à¹„à¸”à¹‰</td></tr>'}</tbody></table></div>${queue.length>100?'<p>à¹à¸ªà¸”à¸‡ 100 à¹€à¸„à¸ªà¹à¸£à¸à¸ˆà¸²à¸à¸„à¸´à¸§à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” Â· à¸›à¸¸à¹ˆà¸¡à¸–à¸±à¸”à¹„à¸›à¹ƒà¸Šà¹‰à¸„à¸´à¸§à¸„à¸£à¸šà¸—à¸¸à¸à¹€à¸„à¸ª</p>':''}`;
      }
    }catch(error){if(active()){failed=true;status.textContent='à¸¢à¸±à¸‡à¸•à¸£à¸§à¸ˆà¹€à¸„à¸ªà¸–à¸±à¸”à¹„à¸›à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: '+error.message+(readOnly?' Â· à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸ªà¹ˆà¸‡à¸„à¸³à¸‚à¸­':' Â· à¸„à¸³à¸‚à¸­à¹€à¸”à¸´à¸¡à¸ªà¹ˆà¸‡à¸ªà¸³à¹€à¸£à¹‡à¸ˆà¹à¸¥à¹‰à¸§ à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¸ªà¹ˆà¸‡à¸‹à¹‰à¸³');nextButton.disabled=false;nextButton.textContent='à¸¥à¸­à¸‡à¸•à¸£à¸§à¸ˆà¹€à¸„à¸ªà¸–à¸±à¸”à¹„à¸›à¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡';if(readOnly)$('#readOnlyCaseQueue').innerHTML='';}}
    finally{busy=false;}
  };
  $('#requestReceiptReturn').onclick=()=>{if(acted)return;acted=true;returnToList();};
  $('#requestReceiptNext').onclick=async()=>{
    if(!active()||busy)return;
    if(!can('request_clarify'))return deny('à¸•à¸£à¸§à¸ˆà¹€à¸„à¸ªà¸–à¸±à¸”à¹„à¸›');
    if(failed)return refresh();
    // Re-read the accepted current case set on navigation, not another send.
    await refresh();if(!active()||failed)return;
    const row=next();if(!row){$('#requestReceiptNext').disabled=true;return toast('à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸„à¸ªà¸–à¸±à¸”à¹„à¸›à¹ƒà¸™à¸šà¸£à¸´à¸©à¸±à¸—à¹à¸¥à¸°à¸•à¸±à¸§à¸à¸£à¸­à¸‡à¹€à¸”à¸´à¸¡à¹à¸¥à¹‰à¸§','warn');}
    acted=true;if(readOnly)captureCaseOpenDraft();returnToList();await openException(row.id);
  };
  await refresh();
}
function showCaseSubmissionReceipt(kind, label = '') {
  const receipts = {
    request: ['à¸ªà¹ˆà¸‡à¸‚à¸­à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¸›à¸´à¸”à¹€à¸„à¸ªà¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢', 'à¸„à¸³à¸‚à¸­à¸›à¸´à¸”à¹€à¸„à¸ªà¸–à¸¹à¸à¸šà¸±à¸™à¸—à¸¶à¸à¹à¸¥à¸°à¸ªà¹ˆà¸‡à¹€à¸‚à¹‰à¸²à¸„à¸´à¸§à¸«à¸±à¸§à¸«à¸™à¹‰à¸²à¹à¸¥à¹‰à¸§ à¹€à¸„à¸ªà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸›à¸´à¸”à¸ˆà¸™à¸à¸§à¹ˆà¸²à¸«à¸±à¸§à¸«à¸™à¹‰à¸²à¸ˆà¸°à¸•à¸£à¸§à¸ˆà¹à¸¥à¸°à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¸ªà¸³à¹€à¸£à¹‡à¸ˆ'],
    clarification: ['à¸ªà¹ˆà¸‡à¸„à¸³à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸žà¸£à¹‰à¸­à¸¡à¸«à¸¥à¸±à¸à¸à¸²à¸™à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢ â€” à¸£à¸­ Audit à¸•à¸£à¸§à¸ˆ', 'à¸„à¸³à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸žà¸£à¹‰à¸­à¸¡à¸«à¸¥à¸±à¸à¸à¸²à¸™à¸–à¸¹à¸à¸šà¸±à¸™à¸—à¸¶à¸à¹à¸¥à¹‰à¸§ à¹à¸•à¹ˆà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸ªà¹ˆà¸‡à¸„à¸³à¸‚à¸­à¹ƒà¸«à¹‰à¸«à¸±à¸§à¸«à¸™à¹‰à¸²à¸›à¸´à¸”à¹€à¸„à¸ª à¹ƒà¸«à¹‰ Audit à¸•à¸£à¸§à¸ˆà¹€à¸­à¸à¸ªà¸²à¸£à¹à¸¥à¸°à¸œà¸¥à¸¢à¸­à¸” à¹à¸¥à¹‰à¸§à¸à¸”à¸ªà¹ˆà¸‡à¸«à¸±à¸§à¸«à¸™à¹‰à¸²à¸£à¸­à¸›à¸´à¸”à¹€à¸„à¸ª à¹€à¸„à¸ªà¹€à¸”à¸´à¸¡à¸¢à¸±à¸‡à¸­à¸¢à¸¹à¹ˆà¹ƒà¸™à¸ à¸²à¸žà¸£à¸§à¸¡'],
    evidence: ['à¹à¸™à¸šà¸«à¸¥à¸±à¸à¸à¸²à¸™à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢', 'à¸šà¸±à¸™à¸—à¸¶à¸à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸°à¸œà¸¹à¸à¸à¸±à¸šà¹€à¸„à¸ªà¹à¸¥à¹‰à¸§ à¹à¸•à¹ˆà¸à¸²à¸£à¹à¸™à¸šà¹„à¸Ÿà¸¥à¹Œà¸«à¸£à¸·à¸­à¸šà¸±à¸™à¸—à¸¶à¸ Note à¸­à¸¢à¹ˆà¸²à¸‡à¹€à¸”à¸µà¸¢à¸§à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸ªà¹ˆà¸‡à¸„à¸³à¸‚à¸­à¸›à¸´à¸”à¹€à¸„à¸ª à¹ƒà¸«à¹‰à¸ªà¹ˆà¸‡à¸„à¸³à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸«à¸£à¸·à¸­à¸„à¸³à¸‚à¸­à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¸•à¸²à¸¡à¸›à¸£à¸°à¹€à¸ à¸—à¹€à¸„à¸ª'],
    additional_evidence: ['à¹€à¸žà¸´à¹ˆà¸¡à¸«à¸¥à¸±à¸à¸à¸²à¸™à¹ƒà¸™à¹€à¸„à¸ªà¸£à¸­à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢', 'à¸šà¸±à¸™à¸—à¸¶à¸à¸«à¸¥à¸±à¸à¸à¸²à¸™à¹€à¸žà¸´à¹ˆà¸¡à¹à¸¥à¹‰à¸§ à¸„à¸³à¸‚à¸­à¹€à¸”à¸´à¸¡à¸¢à¸±à¸‡à¸£à¸­à¸«à¸±à¸§à¸«à¸™à¹‰à¸²à¸•à¸£à¸§à¸ˆ à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¸ªà¹ˆà¸‡à¸‹à¹‰à¸³ à¹à¸¥à¸°à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸à¸²à¸£à¸›à¸´à¸”à¹€à¸„à¸ª'],
    review_evidence: ['à¸ªà¹ˆà¸‡à¸«à¸¥à¸±à¸à¸à¸²à¸™à¹€à¸‚à¹‰à¸²à¸„à¸´à¸§à¸•à¸£à¸§à¸ˆà¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢', 'à¸œà¸¹à¸à¹€à¸­à¸à¸ªà¸²à¸£à¸à¸±à¸šà¹€à¸„à¸ªà¹à¸¥à¸°à¸£à¸­à¸œà¸¹à¹‰à¸•à¸£à¸§à¸ˆà¸—à¸²à¸™à¹à¸¥à¹‰à¸§ à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸à¸²à¸£à¸¢à¸·à¸™à¸¢à¸±à¸™à¸¢à¸­à¸”à¸«à¸£à¸·à¸­à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¸›à¸´à¸”à¹€à¸„à¸ª'],
  };
  const receipt = receipts[kind];
  if (!receipt) throw new Error('Unknown case submission receipt');
  openModal(receipt[0], `<div role="status"><p>${h(label)}</p><p>${h(receipt[1])}</p><p>à¸à¸¥à¸±à¸šà¹„à¸›à¸«à¸™à¹‰à¸²à¸ à¸²à¸žà¸£à¸§à¸¡à¹€à¸„à¸ªà¹€à¸žà¸·à¹ˆà¸­à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£à¹€à¸„à¸ªà¸–à¸±à¸”à¹„à¸›</p></div>`, '<button class="ghost-button" id="receiptViewCase">à¸”à¸¹à¹€à¸„à¸ªà¸™à¸µà¹‰à¸•à¹ˆà¸­</button><button class="primary-button" id="receiptOverview">à¸à¸¥à¸±à¸šà¹„à¸›à¸«à¸™à¹‰à¸²à¸ à¸²à¸žà¸£à¸§à¸¡à¹€à¸„à¸ª</button>');
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
      if (typeof Sb === "undefined" || !Sb.signedIn() || !e.dbId) throw new Error("à¸¢à¸±à¸‡à¸¢à¸·à¸™à¸¢à¸±à¸™à¸šà¸±à¸à¸Šà¸µà¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸«à¸£à¸·à¸­à¹€à¸„à¸ªà¸•à¹‰à¸™à¸—à¸²à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰");
      await Sb.closeException(e.dbId, e.status, {
        resolution_note: note, resolved_at: stamp, resolved_by: actor,
        approved_by: Sb.authUser()?.id, approved_at: stamp, updated_at: stamp,
      });
    }
    Object.assign(e, { status: "closed", resolutionNote: note, resolvedAt: stamp, resolvedBy: actor });
    recordCaseUiResult(e, 'à¸¢à¸·à¸™à¸¢à¸±à¸™à¸›à¸´à¸”à¹€à¸„à¸ªà¸ªà¸³à¹€à¸£à¹‡à¸ˆ â€” à¸•à¸£à¸§à¸ˆà¸«à¸¥à¸±à¸à¸à¸²à¸™à¹à¸¥à¸°à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¸à¸²à¸£à¸›à¸´à¸”à¹„à¸”à¹‰à¹ƒà¸™à¹€à¸„à¸ªà¸™à¸µà¹‰');
    if (state.dataset !== "production") saveOverride(e);
    else {
      delete Store.data.exOverrides[e.id];
      Store.persist();
    }
    return true;
  } catch (err) {
    toast("à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¢à¸·à¸™à¸¢à¸±à¸™à¸à¸²à¸£à¸›à¸´à¸”à¹€à¸„à¸ª: " + err.message + " â€” à¸£à¸µà¹€à¸Ÿà¸£à¸Šà¹€à¸žà¸·à¹ˆà¸­à¸•à¸£à¸§à¸ˆà¸ªà¸–à¸²à¸™à¸°à¸ˆà¸£à¸´à¸‡", "warn");
    return false;
  } finally {
    e._closing = false;
  }
}

async function completeQuickClose(e) {
  if (!can("approve")) return deny("à¸›à¸´à¸”à¹€à¸„à¸ª");
  try { await refreshQuickCloseEvidence(e); }
  catch (err) { return toast("à¸•à¸£à¸§à¸ˆà¸«à¸¥à¸±à¸à¸à¸²à¸™à¸¥à¹ˆà¸²à¸ªà¸¸à¸”à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: " + err.message, "warn"); }
  if (state.dataset === "production" && e._quickVerifiedStatus !== "open") return toast("à¸ªà¸–à¸²à¸™à¸°à¹€à¸„à¸ªà¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¹à¸¥à¹‰à¸§ à¸à¸£à¸¸à¸“à¸²à¹€à¸›à¸´à¸”à¸•à¸£à¸§à¸ˆà¹ƒà¸«à¸¡à¹ˆ", "warn");
  if (!isQuickCloseEligible(e)) return toast("à¹€à¸„à¸ªà¸™à¸µà¹‰à¸¢à¸±à¸‡à¸›à¸´à¸”à¸”à¹ˆà¸§à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰ à¸à¸£à¸¸à¸“à¸²à¸•à¸£à¸§à¸ˆà¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸à¹ˆà¸­à¸™", "warn");
  const note = "Audit à¸¢à¸·à¸™à¸¢à¸±à¸™à¸„à¸¹à¹ˆ BO/PM à¹à¸¥à¸°à¸›à¸´à¸”à¹€à¸„à¸ª â€” à¸¢à¸­à¸¡à¸£à¸±à¸šà¹€à¸§à¸¥à¸²à¸•à¹ˆà¸²à¸‡à¸«à¸£à¸·à¸­à¸‚à¹‰à¸²à¸¡à¸§à¸±à¸™ à¸•à¸£à¸§à¸ˆà¸¢à¸­à¸” à¸­à¹‰à¸²à¸‡à¸­à¸´à¸‡à¹à¸¥à¸°à¸„à¸¹à¹ˆà¸‹à¹‰à¸³à¹à¸¥à¹‰à¸§; à¸¢à¸­à¸” " + e.systemAmount + " à¸šà¸²à¸—; à¹€à¸§à¸¥à¸² " + exceptionTimeDiffLabel(e) + "; BO: " + e.boRaw + "; PM: " + e.stmRaw;
  if (!await persistCaseClosure(e, note)) return;
  e.resolutionNote = note;
  e.resolvedAt = new Date().toISOString();
  e.resolvedBy = (typeof Sb !== "undefined" && Sb.signedIn() ? Sb.currentEmail() : "") || currentUser().username;
  e.notes = e.notes || [];
  e.notes.push({ by: currentUser().username, at: nowStamp(), text: note });
  logAction("quick_close", "exception", e.id, `${note} Â· STM ${money(e.bankAmount)} Â· BO ${money(e.systemAmount)} Â· à¹€à¸§à¸¥à¸² ${exceptionTimeDiffLabel(e)}`);
  closeModal();
  toast(`à¸›à¸´à¸”à¹€à¸„à¸ª ${e.id} à¹à¸¥à¹‰à¸§ â€” à¸¢à¸­à¸”à¸ªà¸­à¸‡à¸à¸±à¹ˆà¸‡à¸•à¸£à¸‡à¸à¸±à¸™`);
  renderNav();
  await refreshCaseView();
  await openException(e.id);
}

let bulkCaseApprovalRunning = false;
let auditStatusBatchRunning = false;
function confirmAuditStatusBatch(items, {company,date,onComplete}) {
  if(auditStatusBatchRunning || !items.length)return;
  const snapshot=items.map(({row,action})=>({row:row?{...row}:null,action}));
  openModal('à¸šà¸±à¸™à¸—à¸¶à¸à¸ªà¸–à¸²à¸™à¸°à¸—à¸µà¹ˆà¹€à¸•à¸£à¸µà¸¢à¸¡à¹„à¸§à¹‰', `<p>${h(company)} Â· ${h(date)} Â· ${snapshot.length} à¸£à¸²à¸¢à¸à¸²à¸£</p><p>à¸•à¸£à¸§à¸ˆà¸ªà¸–à¸²à¸™à¸°à¸¥à¹ˆà¸²à¸ªà¸¸à¸”à¸à¹ˆà¸­à¸™à¸šà¸±à¸™à¸—à¸¶à¸à¸—à¸µà¸¥à¸°à¸£à¸²à¸¢à¸à¸²à¸£ à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¹„à¸¡à¹ˆà¸œà¹ˆà¸²à¸™à¸ˆà¸°à¹„à¸¡à¹ˆà¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸ªà¸–à¸²à¸™à¸° à¹„à¸¡à¹ˆà¸ªà¹ˆà¸‡à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸ à¸²à¸¢à¸™à¸­à¸</p>${snapshot.map(({row,action})=>`<p>${h(row?.code||'à¹„à¸¡à¹ˆà¸žà¸šà¹€à¸„à¸ª')} â†’ ${action==='close'?'à¸¢à¸·à¸™à¸¢à¸±à¸™à¸›à¸´à¸”à¹€à¸„à¸ª':'à¸ªà¹ˆà¸‡à¹€à¸‚à¹‰à¸²à¸Šà¸µà¸—à¸£à¸­à¸Šà¸µà¹‰à¹à¸ˆà¸‡'}</p>`).join('')}<p id="auditBatchProgress" role="status"></p>`, '<button id="auditBatchCancel" class="ghost-button">à¸¢à¸à¹€à¸¥à¸´à¸</button><button id="auditBatchConfirm" class="primary-button">à¸¢à¸·à¸™à¸¢à¸±à¸™à¸šà¸±à¸™à¸—à¸¶à¸à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”</button>');
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
          if(!Sb.signedIn())throw new Error('à¹€à¸‹à¸ªà¸Šà¸±à¸™à¸«à¸¡à¸”à¸­à¸²à¸¢à¸¸ à¸à¸£à¸¸à¸“à¸²à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸šà¹ƒà¸«à¸¡à¹ˆ');
          if(!row)throw new Error('à¹„à¸¡à¹ˆà¸žà¸šà¹€à¸„à¸ªà¹ƒà¸™à¸Šà¸¸à¸”à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸¥à¹ˆà¸²à¸ªà¸¸à¸” à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸à¹€à¸„à¸ªà¹ƒà¸«à¸¡à¹ˆ');
          if(row.company!==company)throw new Error(`à¹€à¸„à¸ªà¹€à¸›à¹‡à¸™à¸‚à¸­à¸‡ ${row.company} à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆ ${company}`);
          if(row.business_date!==date)throw new Error(`à¹€à¸„à¸ªà¸­à¸¢à¸¹à¹ˆà¸§à¸±à¸™à¸—à¸µà¹ˆ ${row.business_date} à¹à¸•à¹ˆà¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸§à¸±à¸™à¸—à¸µà¹ˆ ${date} à¸à¸£à¸¸à¸“à¸²à¹€à¸›à¸´à¸”à¸§à¸±à¸™à¸—à¸µà¹ˆà¸‚à¸­à¸‡à¹€à¸„à¸ª`);
          if(action==='close'){
            const result=await BulkCaseReview.run([row],{company,date},{allowed:()=>can('approve')&&Sb.signedIn(),cancelled:()=>cancelled,load:Sb.reconciliationOverview,candidates:PreliminaryReview.manualCandidates,links:id=>Sb.evidenceCaseRecommendations({caseId:id}),progress:()=>{},save:async fresh=>{
              const e=mapLiveException(fresh);e.id=fresh.id;
              return persistCaseClosure(e,`Audit à¸¢à¸·à¸™à¸¢à¸±à¸™à¸›à¸´à¸”à¸ˆà¸²à¸à¸•à¸²à¸£à¸²à¸‡ â€” à¸„à¸¹à¹ˆ BO/PM à¸¢à¸­à¸”à¹à¸¥à¸°à¸•à¸±à¸§à¸•à¸™à¸•à¸£à¸‡ à¹„à¸¡à¹ˆà¸‹à¹‰à¸³ à¸¢à¸­à¸¡à¸£à¸±à¸šà¹€à¸§à¸¥à¸²à¸•à¹ˆà¸²à¸‡à¸«à¸£à¸·à¸­à¸‚à¹‰à¸²à¸¡à¸§à¸±à¸™; BO: ${e.boRaw}; PM: ${e.stmRaw}`);
            }});
            results.push({code:row.code,ok:result[0]?.status==='closed',message:result[0]?.status==='closed'?'à¸›à¸´à¸”à¹€à¸„à¸ªà¹à¸¥à¹‰à¸§':result[0]?.reason||'à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸›à¸´à¸”'});
          }else if(action==='clarify'){
            if(!can('request_clarify'))throw new Error('à¹„à¸¡à¹ˆà¸¡à¸µà¸ªà¸´à¸—à¸˜à¸´à¹Œà¸ªà¹ˆà¸‡à¸Šà¸µà¹‰à¹à¸ˆà¸‡');
            const fresh=await Sb.exceptionDetail(row.id);
            if(!fresh||fresh.company!==company||fresh.business_date!==date||fresh.run_id!==row.run_id||fresh.status!==row.status||!['open','answered','pending_next_day'].includes(fresh.status))throw new Error('à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹€à¸„à¸ªà¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¹à¸¥à¹‰à¸§ à¸à¸£à¸¸à¸“à¸²à¸•à¸£à¸§à¸ˆà¹ƒà¸«à¸¡à¹ˆ');
            if(cancelled)break;
            const at=new Date().toISOString();
            await Sb.requestClarification(row.id,fresh.status,{requested_at:at,requested_by:Sb.authUser()?.id,updated_at:at});
            results.push({code:row.code,ok:true,message:'à¸ªà¹ˆà¸‡à¹€à¸‚à¹‰à¸²à¸Šà¸µà¸—à¸£à¸­à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¹à¸¥à¹‰à¸§'});
          }else throw new Error('à¹„à¸¡à¹ˆà¸£à¸­à¸‡à¸£à¸±à¸šà¸ªà¸–à¸²à¸™à¸°à¸™à¸µà¹‰');
        }catch(error){results.push({code:row?.code,ok:false,message:error.message});}
        if(!cancelled&&$('#auditBatchProgress'))$('#auditBatchProgress').textContent=`à¸•à¸£à¸§à¸ˆà¹à¸¥à¹‰à¸§ ${results.length}/${snapshot.length}`;
      }
      await onComplete();
      if(cancelled)return toast(`à¸šà¸±à¸™à¸—à¸¶à¸à¸ªà¸³à¹€à¸£à¹‡à¸ˆ ${results.filter(r=>r.ok).length} à¸£à¸²à¸¢à¸à¸²à¸£ â€” à¸«à¸¢à¸¸à¸”à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¹€à¸«à¸¥à¸·à¸­à¹à¸¥à¹‰à¸§`);
      openModal('à¸œà¸¥à¸šà¸±à¸™à¸—à¸¶à¸à¸ªà¸–à¸²à¸™à¸°',`<p>à¸ªà¸³à¹€à¸£à¹‡à¸ˆ ${results.filter(r=>r.ok).length}/${snapshot.length} à¸£à¸²à¸¢à¸à¸²à¸£</p>${results.map(r=>`<p>${h(r.code)} â€” ${h(r.message)}</p>`).join('')}`,'<button id="auditBatchDone" class="primary-button">à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸´à¹‰à¸™</button>');
      $('#auditBatchDone').onclick=closeModal;
    } finally {auditStatusBatchRunning=false;}
  };
}
function confirmBulkCaseClose(rows, {company, date, onComplete}) {
  if (!can("approve")) return deny("à¸›à¸´à¸”à¹€à¸„à¸ª");
  if (bulkCaseApprovalRunning || !rows.length || state.dataset !== "production") return;
  const snapshot = JSON.parse(JSON.stringify(rows));
  const total = snapshot.reduce((sum,row)=>sum+Math.round(Number(row.system_amount)*100),0)/100;
  openModal(`à¸¢à¸·à¸™à¸¢à¸±à¸™à¸›à¸´à¸” ${num(snapshot.length)} à¹€à¸„à¸ªà¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸`,
    `<p>${h(company)} Â· ${h(date)} Â· à¸£à¸§à¸¡ ${money(total)} à¸šà¸²à¸—</p><p>à¸•à¸£à¸§à¸ˆà¸­à¹‰à¸²à¸‡à¸­à¸´à¸‡ BO/PM à¸¢à¸­à¸” à¸•à¸±à¸§à¸•à¸™ à¹à¸¥à¸°à¸„à¸¹à¹ˆà¸‹à¹‰à¸³à¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡ à¹‚à¸”à¸¢à¸¢à¸­à¸¡à¸£à¸±à¸šà¹€à¸§à¸¥à¸²à¸•à¹ˆà¸²à¸‡à¸«à¸£à¸·à¸­à¸‚à¹‰à¸²à¸¡à¸§à¸±à¸™à¸à¹ˆà¸­à¸™à¸šà¸±à¸™à¸—à¸¶à¸à¹à¸•à¹ˆà¸¥à¸°à¸£à¸²à¸¢à¸à¸²à¸£ à¹€à¸„à¸ªà¸—à¸µà¹ˆà¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸ªà¸–à¸²à¸™à¸°à¸«à¸£à¸·à¸­à¸¡à¸µà¸«à¸¥à¸±à¸à¸à¸²à¸™à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¹‚à¸¢à¸‡à¸ˆà¸°à¸‚à¹‰à¸²à¸¡à¹„à¸§à¹‰ à¹„à¸¡à¹ˆà¸ªà¹ˆà¸‡à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¹à¸¥à¸°à¹„à¸¡à¹ˆà¸šà¸±à¸™à¸—à¸¶à¸à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢</p><details><summary>à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸</summary>${snapshot.map(row=>`<p>${h(row.code || row.id)} Â· ${money(row.system_amount)} à¸šà¸²à¸—</p>`).join('')}</details><p id="bulkCaseProgress" role="status"></p>`,
    '<button id="bulkCaseCancel" class="ghost-button">à¸¢à¸à¹€à¸¥à¸´à¸</button><button id="bulkCaseConfirm" class="primary-button">à¸¢à¸·à¸™à¸¢à¸±à¸™à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹à¸¥à¸°à¸›à¸´à¸”à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¸œà¹ˆà¸²à¸™à¹€à¸à¸“à¸‘à¹Œ</button>');
  let cancelled = false;
  $("#modal")._contentCleanup = () => { cancelled = true; };
  $("#bulkCaseCancel").onclick = closeModal;
  $("#bulkCaseConfirm").onclick = async () => {
    if (bulkCaseApprovalRunning) return;
    bulkCaseApprovalRunning = true;
    $("#bulkCaseConfirm").disabled = true;
    $("#bulkCaseCancel").textContent = 'à¸«à¸¢à¸¸à¸”à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¹€à¸«à¸¥à¸·à¸­';
    try {
      const results = await BulkCaseReview.run(snapshot,{company,date},{
        allowed:()=>can('approve') && Sb.signedIn(), cancelled:()=>cancelled,
        load:Sb.reconciliationOverview, candidates:PreliminaryReview.manualCandidates,
        links:id=>Sb.evidenceCaseRecommendations({caseId:id}),
        progress:(done,count)=>{if(!cancelled && $('#bulkCaseProgress')) $('#bulkCaseProgress').textContent=`à¸•à¸£à¸§à¸ˆà¹à¸¥à¹‰à¸§ ${done}/${count} à¸£à¸²à¸¢à¸à¸²à¸£`;},
        save:async row=>{
          const e=mapLiveException(row);e.id=row.id;
          const note=`Audit à¸¢à¸·à¸™à¸¢à¸±à¸™à¹à¸šà¸šà¸«à¸¥à¸²à¸¢à¸£à¸²à¸¢à¸à¸²à¸£ â€” à¸„à¸¹à¹ˆ BO/PM à¸¢à¸­à¸”à¹à¸¥à¸°à¸•à¸±à¸§à¸•à¸™à¸•à¸£à¸‡ à¹„à¸¡à¹ˆà¸‹à¹‰à¸³ à¸¢à¸­à¸¡à¸£à¸±à¸šà¹€à¸§à¸¥à¸²à¸•à¹ˆà¸²à¸‡à¸«à¸£à¸·à¸­à¸‚à¹‰à¸²à¸¡à¸§à¸±à¸™; à¸¢à¸­à¸” ${e.systemAmount} à¸šà¸²à¸—; à¹€à¸§à¸¥à¸² ${exceptionTimeDiffLabel(e)}; BO: ${e.boRaw}; PM: ${e.stmRaw}`;
          return persistCaseClosure(e,note);
        },
      });
      const closed=results.filter(r=>r.status==='closed'), skipped=results.filter(r=>r.status!=='closed');
      await onComplete();
      if(cancelled) return toast(`à¸›à¸´à¸”à¹à¸¥à¹‰à¸§ ${closed.length} à¹€à¸„à¸ª Â· à¹„à¸¡à¹ˆà¸›à¸´à¸” ${skipped.length} à¹€à¸„à¸ª`);
      openModal('à¸œà¸¥à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸',`<p role="status">à¸›à¸´à¸”à¹à¸¥à¹‰à¸§ ${closed.length} à¹€à¸„à¸ª Â· ${money(closed.reduce((n,r)=>n+r.amount,0))} à¸šà¸²à¸— Â· à¹„à¸¡à¹ˆà¸›à¸´à¸” ${skipped.length} à¹€à¸„à¸ª</p>${results.map(r=>`<p>${h(r.code)} â€” ${r.status==='closed'?'à¸›à¸´à¸”à¹€à¸„à¸ªà¹à¸¥à¹‰à¸§':h(r.reason)}</p>`).join('')}`, '<button id="bulkCaseDone" class="primary-button">à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸´à¹‰à¸™</button>');
      $('#bulkCaseDone').onclick=closeModal;
    } catch(error) { toast('à¸•à¸£à¸§à¸ˆà¸œà¸¥à¸¥à¹ˆà¸²à¸ªà¸¸à¸”à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: '+error.message+' â€” à¸à¸£à¸¸à¸“à¸²à¸£à¸µà¹€à¸Ÿà¸£à¸Šà¸à¹ˆà¸­à¸™à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆ','warn'); }
    finally { bulkCaseApprovalRunning=false; }
  };
}

function confirmQuickClose(e) {
  if (!can("approve")) return deny("à¸›à¸´à¸”à¹€à¸„à¸ª");
  if (!isQuickCloseEligible(e)) return toast("à¹€à¸„à¸ªà¸™à¸µà¹‰à¸¢à¸±à¸‡à¸›à¸´à¸”à¸”à¹ˆà¸§à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰ à¸à¸£à¸¸à¸“à¸²à¸•à¸£à¸§à¸ˆà¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸à¹ˆà¸­à¸™", "warn");
  openModal(
    `à¸¢à¸·à¸™à¸¢à¸±à¸™à¸›à¸´à¸”à¹€à¸„à¸ª ${h(e.id)}`,
    `<div class="quick-close-box"><strong>à¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸„à¸£à¸šà¸—à¸±à¹‰à¸‡à¸ªà¸­à¸‡à¸à¸±à¹ˆà¸‡à¹à¸¥à¸°à¸¢à¸­à¸”à¸•à¸£à¸‡à¸à¸±à¸™</strong><div class="quick-close-grid"><div><span>STM / à¸˜à¸™à¸²à¸„à¸²à¸£</span><b>${money(e.bankAmount)}</b></div><div><span>BO / à¸£à¸°à¸šà¸š</span><b>${money(e.systemAmount)}</b></div><div><span>à¸œà¸¥à¸•à¹ˆà¸²à¸‡à¸¢à¸­à¸”</span><b>${money(Number(e.systemAmount) - Number(e.bankAmount))}</b></div><div><span>à¸œà¸¥à¸•à¹ˆà¸²à¸‡à¹€à¸§à¸¥à¸²</span><b>${h(exceptionTimeDiffLabel(e))}</b></div></div><small>à¸£à¸°à¸šà¸šà¸ˆà¸°à¸šà¸±à¸™à¸—à¸¶à¸à¸œà¸¹à¹‰à¸¢à¸·à¸™à¸¢à¸±à¸™ à¹€à¸§à¸¥à¸² à¹à¸¥à¸°à¹€à¸«à¸•à¸¸à¸œà¸¥à¹„à¸§à¹‰à¹ƒà¸™ Audit Log à¸à¸²à¸£à¸›à¸´à¸”à¸™à¸µà¹‰à¹€à¸›à¹‡à¸™à¸à¸²à¸£à¸•à¸±à¸”à¸ªà¸´à¸™à¹ƒà¸ˆà¸‚à¸­à¸‡à¸œà¸¹à¹‰à¸•à¸£à¸§à¸ˆ à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸à¸²à¸£à¸›à¸´à¸”à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´</small></div>`,
    `<button class="ghost-button" id="quickCloseCancel">à¸à¸¥à¸±à¸šà¹„à¸›à¸•à¸£à¸§à¸ˆ</button><button class="primary-button" id="quickCloseConfirm">à¸¢à¸·à¸™à¸¢à¸±à¸™à¸¢à¸­à¸”à¸•à¸£à¸‡à¹à¸¥à¸°à¸›à¸´à¸”à¹€à¸„à¸ª</button>`,
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
  const countsReady = Array.isArray(liveOverviewState.caseCounts) && !hasLiveCoreError("à¸¢à¸­à¸”à¹€à¸„à¸ªà¸Šà¸¸à¸”à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™");
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
              ${it.id === "exceptions" ? `<b class="nav-count">${workflow.openAvailable ? num(workflow.open) : "â€”"}</b>` : ""}
              ${it.id === "audit-review" ? `<b class="nav-count" title="à¹€à¸„à¸ªà¸£à¸­ Audit à¸•à¸£à¸§à¸ˆà¹ƒà¸™à¸šà¸£à¸´à¸©à¸±à¸—à¹à¸¥à¸°à¸§à¸±à¸™à¸—à¸µà¹ˆà¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸">${liveOverviewState.exceptionsReady ? num(AuditReview.rows(DB.exceptions, {filters:state.filters,canAccessCompany}).length) : "â€”"}</b>` : ""}
              ${it.id === "approvals" ? `<b class="nav-count" title="à¸„à¸³à¸‚à¸­à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¸—à¸¸à¸à¸§à¸±à¸™à¸—à¸µà¹ˆà¸•à¸²à¸¡à¸ªà¸´à¸—à¸˜à¸´à¹Œ à¸£à¸§à¸¡à¹€à¸„à¸ªà¸Šà¸µà¹‰à¹à¸ˆà¸‡à¹à¸¥à¹‰à¸§à¹ƒà¸™à¸‚à¸­à¸šà¹€à¸‚à¸•à¸—à¸µà¹ˆà¹‚à¸«à¸¥à¸”">${workflow.approvalsAvailable ? num(workflow.approvals) : "â€”"}</b>` : ""}
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
  button.setAttribute("aria-label", collapsed ? "à¹à¸ªà¸”à¸‡à¹à¸–à¸šà¹€à¸¡à¸™à¸¹" : "à¸‹à¹ˆà¸­à¸™à¹à¸–à¸šà¹€à¸¡à¸™à¸¹");
  button.title = collapsed ? "à¹à¸ªà¸”à¸‡à¹à¸–à¸šà¹€à¸¡à¸™à¸¹" : "à¸‹à¹ˆà¸­à¸™à¹à¸–à¸šà¹€à¸¡à¸™à¸¹";
  try { localStorage.setItem("audit-sidebar-collapsed", collapsed ? "1" : "0"); } catch (_) {}
}

function renderAuditFlow() {
  const files = (cloudState.batches || []).flatMap((batch) => batch.source_files || []);
  const fileIssues = files.filter((file) => (file.parse_error && !statementNeedsBoReview(file)) || file.kind === "unknown").length;
  const fileReview = files.filter(statementNeedsBoReview).length;
  const fileWaiting = files.filter((file) => !file.parsed && !file.parse_error && !["unknown", "doc_clarify"].includes(file.kind)).length;
  const workflow = scopedWorkflowMetrics();
  const steps = [
    { route: "cloud", no: 1, label: "à¸•à¸£à¸§à¸ˆà¹„à¸Ÿà¸¥à¹Œ", meta: files.length ? `${num(files.length)} à¹„à¸Ÿà¸¥à¹Œ${fileIssues ? ` Â· à¸›à¸±à¸à¸«à¸² ${num(fileIssues)}` : ""}${fileReview ? ` Â· à¸£à¸­à¹€à¸—à¸µà¸¢à¸š BO ${num(fileReview)}` : ""}${fileWaiting ? ` Â· à¸£à¸­à¸£à¸°à¸šà¸š ${num(fileWaiting)}` : fileIssues || fileReview ? "" : " Â· à¸žà¸£à¹‰à¸­à¸¡"}` : "à¸•à¸£à¸§à¸ˆà¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¹„à¸”à¹‰à¸£à¸±à¸š", tone: fileIssues || fileReview ? "warn" : files.length ? "ok" : "" },
    { route: "dashboard", no: 2, label: "à¸”à¸¹à¸ à¸²à¸žà¸£à¸§à¸¡", meta: "à¹à¸¢à¸à¸•à¸²à¸¡à¸šà¸£à¸´à¸©à¸±à¸—", tone: "" },
    { route: "exceptions", no: 3, label: "à¸•à¸£à¸§à¸ˆà¸‚à¹‰à¸­à¸œà¸´à¸”à¸›à¸à¸•à¸´", meta: workflow.openAvailable ? `${num(workflow.open)} à¹€à¸„à¸ªà¹€à¸›à¸´à¸”` : "à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”à¸¢à¸­à¸”à¹€à¸„à¸ª", tone: !workflow.openAvailable ? "" : workflow.open ? "warn" : "ok" },
    { route: "clarify", no: 4, label: "à¸•à¸´à¸”à¸•à¸²à¸¡/à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´", meta: workflow.approvalsAvailable ? `${num(workflow.followUps)} à¸‡à¸²à¸™` : "à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”à¸‡à¸²à¸™à¸•à¸´à¸”à¸•à¸²à¸¡", tone: !workflow.approvalsAvailable ? "" : workflow.followUps ? "warn" : "ok" },
    { route: "reports", no: 5, label: "à¸­à¸­à¸à¸£à¸²à¸¢à¸‡à¸²à¸™", meta: "Export à¸«à¸¥à¸±à¸à¸à¸²à¸™", tone: "" },
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
  if (unread.length) return { route: "cloud", label: `à¸•à¸£à¸§à¸ˆà¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸¡à¸µà¸›à¸±à¸à¸«à¸² ${num(unread.length)} à¹„à¸Ÿà¸¥à¹Œ`, detail: "à¸à¸”à¸”à¸¹à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¹„à¸Ÿà¸¥à¹Œà¸›à¸±à¸à¸«à¸²à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¹à¸¥à¸°à¸ªà¸²à¹€à¸«à¸•à¸¸à¸à¹ˆà¸­à¸™ à¹à¸¥à¹‰à¸§à¸„à¹ˆà¸­à¸¢à¹€à¸›à¸´à¸”à¸•à¸£à¸§à¸ˆà¸—à¸µà¸¥à¸°à¸£à¸²à¸¢à¸à¸²à¸£", tone: "bad" };
  if (needsBoReview.length) return { route: "cloud", label: `à¹€à¸—à¸µà¸¢à¸š BO à¸ªà¸³à¸«à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸­à¹ˆà¸²à¸™à¹à¸¥à¹‰à¸§ ${num(needsBoReview.length)} à¹„à¸Ÿà¸¥à¹Œ`, detail: "à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸²à¸¢à¸à¸²à¸£à¹ƒà¸™à¸§à¸±à¸™à¸•à¸£à¸§à¸ˆ à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¹„à¸Ÿà¸¥à¹Œà¹€à¸ªà¸µà¸¢ â€” à¸•à¸£à¸§à¸ˆà¸šà¸±à¸à¸Šà¸µà¹à¸¥à¸°à¸§à¸±à¸™à¸à¸±à¸š BO à¸à¹ˆà¸­à¸™à¸ªà¸£à¸¸à¸› à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¸£à¸±à¸™à¹„à¸Ÿà¸¥à¹Œà¹€à¸”à¸´à¸¡à¸‹à¹‰à¸³", tone: "warn" };
  if (waiting.length) return { route: "daily-summary", label: `à¸”à¸¹à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¸¢à¸±à¸‡à¸‚à¸²à¸” ${num(waiting.length)} à¸šà¸£à¸´à¸©à¸±à¸—/à¸§à¸±à¸™`, detail: "à¸•à¸£à¸§à¸ˆ Checklist à¹à¸¥à¹‰à¸§à¸•à¸²à¸¡ STM à¸«à¸£à¸·à¸­ BO à¸—à¸µà¹ˆà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸„à¸£à¸š", tone: "warn" };
  if (workflow.approvalsAvailable && workflow.approvals && can('approve')) return { route: "approvals", label: `à¸•à¸£à¸§à¸ˆà¸„à¸³à¸Šà¸µà¹‰à¹à¸ˆà¸‡ / à¸„à¸³à¸‚à¸­à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´ ${num(workflow.approvals)} à¸‡à¸²à¸™`, detail: "à¹€à¸›à¸´à¸”à¹€à¸„à¸ªà¹à¸¥à¸°à¹€à¸­à¸à¸ªà¸²à¸£à¸—à¸µà¹ˆà¸œà¸¹à¸à¹„à¸§à¹‰ à¸•à¸£à¸§à¸ˆà¸«à¸¥à¸±à¸à¸à¸²à¸™à¸à¹ˆà¸­à¸™à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´", tone: "warn" };
  const auditWaiting = AuditReview.rows(DB.exceptions, { filters: state.filters, canAccessCompany }).length;
  if (auditWaiting && ROUTE_ROLES[state.role].includes('audit-review')) return { route: 'audit-review', label: `Audit à¸£à¸­à¸•à¸£à¸§à¸ˆ ${num(auditWaiting)} à¹€à¸„à¸ª`, detail: 'à¸•à¸£à¸§à¸ˆà¸„à¸³à¸•à¸­à¸šà¹à¸¥à¸°à¸«à¸¥à¸±à¸à¸à¸²à¸™à¹ƒà¸™à¹€à¸„à¸ªà¹€à¸”à¸´à¸¡à¸à¹ˆà¸­à¸™à¸ªà¹ˆà¸‡à¸«à¸±à¸§à¸«à¸™à¹‰à¸²', tone: 'warn' };
  if (workflow.followUps) return { route: "clarify", label: `à¸•à¸´à¸”à¸•à¸²à¸¡à¸„à¸³à¸Šà¸µà¹‰à¹à¸ˆà¸‡ ${num(workflow.followUps)} à¸‡à¸²à¸™`, detail: "à¸•à¸´à¸”à¸•à¸²à¸¡à¸„à¸³à¸•à¸­à¸šà¹à¸¥à¸°à¸«à¸¥à¸±à¸à¸à¸²à¸™à¸ˆà¸²à¸à¸œà¸¹à¹‰à¸Šà¸µà¹‰à¹à¸ˆà¸‡", tone: "warn" };
  if (workflow.openAvailable && workflow.open) return { route: "exceptions", label: `à¸•à¸£à¸§à¸ˆà¸£à¸²à¸¢à¸à¸²à¸£à¸œà¸´à¸”à¸›à¸à¸•à¸´ ${num(workflow.open)} à¹€à¸„à¸ª`, detail: "à¹€à¸›à¸´à¸”à¸«à¸¥à¸±à¸à¸à¸²à¸™ à¸•à¸£à¸§à¸ˆà¸¢à¸­à¸”à¸•à¹ˆà¸²à¸‡ à¹à¸¥à¸°à¸ªà¹ˆà¸‡à¸•à¸´à¸”à¸•à¸²à¸¡à¸„à¸³à¸Šà¸µà¹‰à¹à¸ˆà¸‡", tone: "warn" };
  if (!workflow.openAvailable) return { route: "dashboard", label: "à¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸¢à¸­à¸”à¹€à¸„à¸ªà¸ˆà¸²à¸à¸à¸²à¸™à¸‚à¹‰à¸­à¸¡à¸¹à¸¥", detail: "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸ªà¸£à¸¸à¸›à¸§à¹ˆà¸²à¸‡à¸²à¸™à¸«à¸¡à¸”à¸ˆà¸™à¸à¸§à¹ˆà¸²à¸ˆà¸°à¹‚à¸«à¸¥à¸”à¸¢à¸­à¸”à¸ˆà¸£à¸´à¸‡à¸ªà¸³à¹€à¸£à¹‡à¸ˆ", tone: "warn" };
  return { route: "reports", label: "à¸”à¸¹à¸ªà¸£à¸¸à¸›à¹à¸¥à¸°à¸­à¸­à¸à¸£à¸²à¸¢à¸‡à¸²à¸™", detail: "à¸‡à¸²à¸™à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£à¸«à¸¡à¸”à¹à¸¥à¹‰à¸§ à¸•à¸£à¸§à¸ˆà¸£à¸²à¸¢à¸§à¸±à¸™à¹à¸¥à¸° Export à¸«à¸¥à¸±à¸à¸à¸²à¸™", tone: "ok" };
}

function renderNextAction(root) {
  if (state.route === "mc8-sheets") return;
  if (state.dataset !== "production" || !Sb.signedIn()) return;
  const action = nextActionForState();
  const route = ROUTE_ROLES[state.role].includes(action.route) ? action.route : "dashboard";
  const buttonLabel = route === "cloud" ? "à¸”à¸¹à¹„à¸Ÿà¸¥à¹Œà¸›à¸±à¸à¸«à¸²à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” â†’" : "à¹„à¸›à¸•à¹ˆà¸­ â†’";
  root.insertAdjacentHTML("afterbegin", `<section class="next-action-bar ${action.tone}" data-next-route="${h(route)}" role="link" tabindex="0" aria-label="à¸‚à¸±à¹‰à¸™à¸–à¸±à¸”à¹„à¸› ${h(action.label)}"><div><span>à¸‚à¸±à¹‰à¸™à¸–à¸±à¸”à¹„à¸›à¸—à¸µà¹ˆà¹à¸™à¸°à¸™à¸³</span><b>${h(action.label)}</b><small>${h(action.detail)}</small></div><button class="primary-button sm" type="button">${buttonLabel}</button></section>`);
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
  const companyLabel = f.company === "ALL" ? "à¸—à¸¸à¸à¸šà¸£à¸´à¸©à¸±à¸—" : f.company;
  const directionLabel = f.direction === "ALL" ? "à¸—à¸¸à¸à¸›à¸£à¸°à¹€à¸ à¸—" : f.direction;
  box.innerHTML = `
    <div class="filter-bar-head">
      <div><strong>1. à¹€à¸¥à¸·à¸­à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸—à¸µà¹ˆà¸ˆà¸°à¸•à¸£à¸§à¸ˆ</strong><span>${h(rangeLabel())} Â· ${h(companyLabel)} Â· ${h(directionLabel)}</span></div>
      <button class="ghost-button xs" id="filterToggle" type="button" aria-expanded="${state.filtersOpen}">${state.filtersOpen ? "à¸¢à¹ˆà¸­" : "à¸›à¸£à¸±à¸šà¸•à¸±à¸§à¸à¸£à¸­à¸‡"}</button>
    </div>
    <div class="filter-fields" ${state.filtersOpen ? "" : "hidden"}>
      <label>à¸§à¸±à¸™à¸—à¸µà¹ˆà¸•à¸±à¹‰à¸‡à¸•à¹‰à¸™à¸‚à¸­à¸‡à¸Šà¹ˆà¸§à¸‡
        <input type="date" id="fDate" value="${f.date}" min="${VISIBLE_DATE_FROM}" max="${VISIBLE_DATE_TO}" />
      </label>
      <label>à¹€à¸¥à¸·à¸­à¸à¸Šà¹ˆà¸§à¸‡à¸§à¸±à¸™à¸—à¸µà¹ˆ
        <select id="fPreset">
          ${DATE_PRESETS.map((p) => `<option value="${p.code}" ${f.preset === p.code ? "selected" : ""}>${h(p.name)}</option>`).join("")}
        </select>
      </label>
      <label>à¸§à¸±à¸™à¹€à¸£à¸´à¹ˆà¸¡à¸•à¹‰à¸™
        <input type="date" id="fFrom" value="${f.from}" min="${VISIBLE_DATE_FROM}" max="${f.to}" />
      </label>
      <label>à¸§à¸±à¸™à¸ªà¸´à¹‰à¸™à¸ªà¸¸à¸”
        <input type="date" id="fTo" value="${f.to}" min="${f.from}" max="${VISIBLE_DATE_TO}" />
      </label>
      <label>à¸šà¸£à¸´à¸©à¸±à¸—
        <select id="fCompany">
          <option value="ALL">à¸—à¸¸à¸à¸šà¸£à¸´à¸©à¸±à¸—</option>
          ${companyMaster().map((c) => `<option value="${c.code}" ${f.company === c.code ? "selected" : ""}>${h(c.name)}</option>`).join("")}
        </select>
      </label>
      <label>à¸˜à¸¸à¸£à¸à¸£à¸£à¸¡ / à¸Šà¹ˆà¸­à¸‡à¸—à¸²à¸‡
        <select id="fDirection">
          <option value="ALL">à¸à¸²à¸à¹à¸¥à¸°à¸–à¸­à¸™ Â· à¸—à¸¸à¸à¸Šà¹ˆà¸­à¸‡à¸—à¸²à¸‡</option>
          <option value="PM" ${f.direction === "PM" ? "selected" : ""}>à¹€à¸‰à¸žà¸²à¸° Payment (PM)</option>
          <option value="à¸à¸²à¸" ${f.direction === "à¸à¸²à¸" ? "selected" : ""}>à¸à¸²à¸</option>
          <option value="à¸–à¸­à¸™" ${f.direction === "à¸–à¸­à¸™" ? "selected" : ""}>à¸–à¸­à¸™</option>
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
    toast("à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸§à¸±à¸™à¸—à¸µà¹ˆà¸•à¸£à¸§à¸ˆà¹€à¸›à¹‡à¸™ " + e.target.value);
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
    $("#filterSummary").innerHTML = `à¸Šà¹ˆà¸§à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ <b>${h(rangeLabel())}</b> Â· à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢à¸—à¸µà¹ˆà¸¢à¸·à¸™à¸¢à¸±à¸™à¹à¸¥à¹‰à¸§ <b>${ready ? num(rows.length) : "â€”"}</b> à¸£à¸²à¸¢à¸à¸²à¸£ Â· à¸¢à¸­à¸”à¸£à¸§à¸¡ <b>${ready ? `${money0(total)} à¸šà¸²à¸—` : "à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸£à¸´à¸‡"}</b>`;
    return;
  }
  const scoped = scopedExceptions();
  if (state.dataset === 'production' && Sb.signedIn() && (!liveOverviewState.exceptionsReady || liveOverviewState.key !== `${state.filters.from}|${state.filters.to}|${state.filters.company}`)) {
    $('#filterSummary').innerHTML = `à¸Šà¹ˆà¸§à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ <b>${h(rangeLabel())}</b> Â· à¸£à¸²à¸¢à¸à¸²à¸£à¹€à¸„à¸ª <b>â€”</b> Â· SLA <b>â€”</b> Â· à¸¢à¸­à¸” <b>â€”</b> Â· à¸à¸³à¸¥à¸±à¸‡à¸£à¸­à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸£à¸´à¸‡ à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸¨à¸¹à¸™à¸¢à¹Œ`;
    return;
  }
  if (state.dataset === 'production' && state.route === 'clarify' && state.role === 'shift_lead') {
    $('#filterSummary').innerHTML = `à¸Šà¹ˆà¸§à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ <b>${h(rangeLabel())}</b> Â· à¸„à¸´à¸§à¸„à¸³à¸‚à¸­à¸—à¸µà¹ˆ Audit à¸ªà¹ˆà¸‡à¸¡à¸² <b>${num(scoped.length)}</b> à¹€à¸„à¸ªà¹ƒà¸™à¸šà¸£à¸´à¸©à¸±à¸—à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸ Â· à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸¢à¸­à¸”à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸«à¸£à¸·à¸­à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢`;
    return;
  }
  if (typeof fastReviewQueueMode === 'function' && fastReviewQueueMode()) {
    $('#filterSummary').innerHTML = `à¸Šà¹ˆà¸§à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ <b>${h(rangeLabel())}</b> Â· à¸£à¸²à¸¢à¸à¸²à¸£à¹€à¸„à¸ªà¸—à¸µà¹ˆà¹‚à¸«à¸¥à¸”à¹ƒà¸™à¸šà¸£à¸´à¸©à¸±à¸—à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸ <b>${num(scoped.length)}</b> Â· à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸¢à¸­à¸”à¸£à¸§à¸¡à¸à¸²à¸£à¹€à¸‡à¸´à¸™à¸«à¸£à¸·à¸­à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢`;
    return;
  }
  $("#filterSummary").innerHTML = `à¸Šà¹ˆà¸§à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ <b>${h(rangeLabel())}</b> Â· à¸à¸³à¸¥à¸±à¸‡à¸”à¸¹ <b>${num(scoped.length)}</b> exception Â· à¹€à¸à¸´à¸™ SLA <b>${num(scoped.filter((e) => e.overSla).length)}</b> à¸£à¸²à¸¢à¸à¸²à¸£ Â· à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢à¹ƒà¸™à¸Šà¹ˆà¸§à¸‡à¸™à¸µà¹‰ <b>${money0(DB.damages.filter((d) => inRange(d.date)).reduce((a, c) => a + c.amount, 0))}</b> à¸šà¸²à¸—`;
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
    toast(`à¸ªà¸´à¸—à¸˜à¸´à¹Œ ${DB.roles[state.role].name} à¹€à¸‚à¹‰à¸²à¸«à¸™à¹‰à¸²à¸™à¸µà¹‰à¹„à¸¡à¹ˆà¹„à¸”à¹‰`, "warn");
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
 if(state.dataset!=='production'||!Sb.signedIn()){host.innerHTML='<section class="panel">à¸«à¸™à¹‰à¸²à¸™à¸µà¹‰à¹ƒà¸Šà¹‰à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¸ˆà¸£à¸´à¸‡à¸«à¸¥à¸±à¸‡à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸š à¹„à¸¡à¹ˆà¸¡à¸µà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸³à¸¥à¸­à¸‡</section>';return;}
 const companies=MC8LiveSheets.COMPANIES.filter(canAccessCompany);if(!companies.length){host.innerHTML='<section class="panel">à¹„à¸¡à¹ˆà¸¡à¸µà¸ªà¸´à¸—à¸˜à¸´à¹Œà¸šà¸£à¸´à¸©à¸±à¸—</section>';return;}
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
 if(state.dataset!=='production'||!Sb.signedIn()) {root.innerHTML='<section class="panel">à¸£à¸²à¸¢à¸‡à¸²à¸™à¸™à¸µà¹‰à¹ƒà¸Šà¹‰à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸£à¸´à¸‡à¸«à¸¥à¸±à¸‡à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸šà¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ à¹„à¸¡à¹ˆà¸¡à¸µà¸•à¸±à¸§à¹€à¸¥à¸‚à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡</section>';return;}
 FinanceExecutive.mount(root,{role:()=>state.role,actor:()=>Sb.authUser()?.id,active:()=>state.route==='finance'&&Sb.signedIn(),today:PROD_TODAY,
  context:Sb.financeReportingCompanies,bo:Sb.financeReportBoWindow,cases:Sb.financeCaseReport,formatTime:displayTime,saveBlob:Exporter.saveBlob,buildWorkbook:XlsxWriter.build,archive:XlsxWriter.archive,
  boManifest:Sb.financeBoReportManifest,acceptBoReport:Sb.acceptFinanceBoReport,boHistory:Sb.financeBoReportHistory,
  boDownload:async file=>{if(state.route!=='finance'||!['lead','admin'].includes(state.role)||!canAccessCompany(file.company))throw Error('à¹„à¸¡à¹ˆà¸¡à¸µà¸ªà¸´à¸—à¸˜à¸´à¹Œà¸­à¹ˆà¸²à¸™ BO à¸£à¸²à¸¢à¸‡à¸²à¸™');return Sb.download(file.storage_path,{force:true});},
  boReadXlsx:async bytes=>{const sheets=(await XlsxReader.readWorkbook(bytes,{includeMetadata:true})).filter(s=>s.rows.some(r=>r.some(v=>String(v??'').trim())));if(sheets.length!==1)throw Error('BO à¸«à¸¥à¸²à¸¢à¸Šà¸µà¸•/à¹„à¸¡à¹ˆà¸¡à¸µà¸Šà¸µà¸•à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ à¸•à¹‰à¸­à¸‡à¸—à¸šà¸—à¸§à¸™à¸‚à¸­à¸šà¹€à¸‚à¸•à¸£à¸²à¸¢à¸‡à¸²à¸™à¸à¹ˆà¸­à¸™ à¹„à¸¡à¹ˆà¸­à¹ˆà¸²à¸™à¹à¸„à¹ˆà¸Šà¸µà¸•à¹à¸£à¸');return sheets[0];},boParse:Formats.parse,boSha256:async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join(''),
  holds:Sb.reviewHoldReport,actions:Sb.financeActionReport,actionCase:Sb.financeActionCase,findActionCase:Sb.findFinanceActionCase,saveAction:Sb.saveFinanceAction,uploadAction:Sb.uploadFinanceActionEvidence,actionUrl:Sb.financeActionUrl});
};
function openAccountRecheck({company,date,accounts,fileIds=null,initialJobId=null,onPrimaryReady=null}) {
  if(state.dataset!=='production'||!Sb.signedIn()||!canAccessCompany(company))return deny('à¸•à¸£à¸§à¸ˆà¹€à¸‰à¸žà¸²à¸°à¸šà¸±à¸à¸Šà¸µ');
  openModal('à¸•à¸£à¸§à¸ˆà¸‹à¹‰à¸³ / à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¹€à¸‰à¸žà¸²à¸°à¸šà¸±à¸à¸Šà¸µ', '<div id="accountRecheckPanel"></div>', '<button id="accountRecheckDismiss">à¸›à¸´à¸”à¸«à¸™à¹‰à¸²à¸—à¸šà¸—à¸§à¸™</button>');
  const dispose=AccountRecheck.mount($('#accountRecheckPanel'),{
    company,date,accounts:['ALL',...accounts.filter(a=>a!=='ALL')],fileIds,initialJobId,role:()=>state.role,actor:()=>Sb.authUser()?.id,
    request:Sb.requestAccountRecheck,list:Sb.listAccountRechecks,loadState:Sb.fileRunManagement,confirm:Sb.confirmAccountRecheck,
    detail:Sb.accountRecheckDetail,exportWorkbook:Exporter.workbook,
    finalConfirmation:AccountRecheck.finalConfirmation,
    onPrimary:id=>ManualPrimary.open(id,{actor:()=>Sb.authUser()?.id,role:()=>state.role,
      preview:Sb.manualPrimaryPreview,accept:Sb.acceptManualPrimaryWithCases,withCases:true,
      onAccepted:async value=>{
        toast(`à¹ƒà¸Šà¹‰à¸œà¸¥à¸•à¸£à¸§à¸ˆà¸¡à¸·à¸­à¹€à¸›à¹‡à¸™à¸œà¸¥à¸«à¸¥à¸±à¸à¹à¸¥à¸°à¹€à¸•à¸£à¸µà¸¢à¸¡à¹€à¸„à¸ªà¸žà¸£à¹‰à¸­à¸¡à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£à¹à¸¥à¹‰à¸§ ${value?.case_set?.case_count??0} à¹€à¸„à¸ª`,'ok');
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
  if(!actor||!file?.id||!file.storage_path||!file.revision)throw Error('à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹„à¸Ÿà¸¥à¹Œà¸«à¸£à¸·à¸­à¸ªà¸´à¸—à¸˜à¸´à¹Œà¹„à¸¡à¹ˆà¸„à¸£à¸š à¸à¸£à¸¸à¸“à¸²à¹‚à¸«à¸¥à¸”à¸ªà¸–à¸²à¸™à¸°à¸¥à¹ˆà¸²à¸ªà¸¸à¸”');
  if(!/\.(?:xlsx?|xlsm|csv|pdf)$/i.test(String(file.file_name||'')))throw Error('à¹„à¸Ÿà¸¥à¹Œà¸Šà¸™à¸´à¸”à¸™à¸µà¹‰à¸•à¹‰à¸­à¸‡à¸­à¹ˆà¸²à¸™à¸œà¹ˆà¸²à¸™ Worker à¸¢à¸±à¸‡à¸­à¹ˆà¸²à¸™à¹ƒà¸«à¸¡à¹ˆà¸ˆà¸²à¸à¸«à¸™à¹‰à¸²à¸™à¸µà¹‰à¹„à¸¡à¹ˆà¹„à¸”à¹‰');
  const savedFiles=ImportState.files.slice();
  let norm;
  try{
    const bytes=await Sb.download(file.storage_path);
    if(Sb.authUser()?.id!==actor)throw Error('à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™ à¸à¸£à¸¸à¸“à¸²à¹€à¸›à¸´à¸”à¸«à¸™à¹‰à¸²à¸ˆà¸±à¸”à¸à¸²à¸£à¹„à¸Ÿà¸¥à¹Œà¹ƒà¸«à¸¡à¹ˆ');
    norm=await ingestRaw(file.file_name,bytes,bytes.byteLength,{fileId:file.physical_source_file_id||file.id,storagePath:file.storage_path,businessDate:file.business_date});
    const rowCount=(norm.records||[]).length+(norm.aux||[]).length;
    if(!rowCount&&file.kind!=='pm_statement')throw Error('à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¹‰à¸§à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¹ƒà¸Šà¹‰à¸•à¸£à¸§à¸ˆà¹„à¸”à¹‰');
    const receipt=await Sb.recordAuditSourceReparse({fileId:file.id,expectedRevision:file.revision,expectedChecksum:file.checksum,
      parserVersion:'ui-source-reparse-20261026',rowCount,parseError:null,
      quality:{complete:true,records:(norm.records||[]).length,aux:(norm.aux||[]).length,warnings:norm.warnings||[],dropped:norm.dropped||{}}});
    if(!receipt?.parsed||receipt.file_id!==file.id||Number(receipt.row_count)!==rowCount)throw Error('à¹€à¸‹à¸´à¸£à¹Œà¸Ÿà¹€à¸§à¸­à¸£à¹Œà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¢à¸·à¸™à¸¢à¸±à¸™à¸œà¸¥à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œ à¸à¸£à¸¸à¸“à¸²à¹‚à¸«à¸¥à¸”à¸ªà¸–à¸²à¸™à¸°à¸à¹ˆà¸­à¸™à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆ');
    return receipt;
  }catch(error){
    if(norm===undefined&&Sb.authUser()?.id===actor){
      await Sb.recordAuditSourceReparse({fileId:file.id,expectedRevision:file.revision,expectedChecksum:file.checksum,
        parserVersion:'ui-source-reparse-20261026',rowCount:0,parseError:String(error?.message||'à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ').slice(0,2000),quality:{complete:false}}).catch(()=>{});
    }
    throw error;
  }finally{ImportState.files=savedFiles;}
}
async function openFileExclusion(fileId) {
  if(state.dataset!=='production'||!Sb.signedIn()||!FileExclusion.canManage(state.role))return deny('à¸¢à¸à¹€à¸§à¹‰à¸™à¹„à¸Ÿà¸¥à¹Œà¸ˆà¸²à¸à¸à¸²à¸£à¸£à¸±à¸™');
  return FileExclusion.open({fileId,role:()=>state.role,actor:()=>Sb.authUser()?.id,
    preview:Sb.sourceExclusionPreview,save:Sb.setSourceExcluded,confirm:FileRunManagement.confirmAction});
}
function openFileRunManagement({company,date,accounts,fileId=null,onUpdated=null}) {
  if(state.dataset!=='production'||!Sb.signedIn()||!canAccessCompany(company))return deny('à¸ˆà¸±à¸”à¸à¸²à¸£à¹„à¸Ÿà¸¥à¹Œ/à¸žà¸±à¸à¸£à¸±à¸™');
  openModal('à¹€à¸¥à¸·à¸­à¸à¹„à¸Ÿà¸¥à¹Œ / à¹à¸à¹‰à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ / à¸žà¸±à¸à¸£à¸±à¸™','<div id="fileRunManagementPanel"></div>','<button id="fileRunManagementDismiss">à¸›à¸´à¸”</button>');
  const dispose=FileRunManagement.mount($('#fileRunManagementPanel'),{
    company,date,initialFileId:fileId,onUpdated,role:()=>state.role,load:Sb.fileRunManagement,history:Sb.sourceRevisionHistory,
    companies:MC8LiveSheets.COMPANIES.filter(canAccessCompany),actor:()=>Sb.authUser()?.id,
    setHold:Sb.setAuditRunHold,correct:Sb.correctAuditSource,reparse:reparseStoredAuditSource,
    onExclude:openFileExclusion,
    searchSources:Sb.effectiveAuditFiles,addSource:Sb.addAuditManualSource,
    confirmAddition:b=>FileRunManagement.confirmAction({title:'à¸—à¸šà¸—à¸§à¸™à¹€à¸žà¸´à¹ˆà¸¡à¹„à¸Ÿà¸¥à¹Œà¹ƒà¸™à¸£à¸­à¸šà¸•à¸£à¸§à¸ˆ',message:`${b.name}\nà¸šà¸£à¸´à¸©à¸±à¸— ${b.company} Â· à¸§à¸±à¸™à¸­à¹‰à¸²à¸‡à¸­à¸´à¸‡ ${b.date}\n${b.reason}\nà¹€à¸žà¸´à¹ˆà¸¡à¹„à¸Ÿà¸¥à¹Œà¹‚à¸”à¸¢à¹€à¸à¹‡à¸šà¸•à¹‰à¸™à¸‰à¸šà¸±à¸šà¹à¸¥à¸°à¸•à¸£à¸§à¸ˆà¹„à¸Ÿà¸¥à¹Œà¸‹à¹‰à¸³ à¸žà¸±à¸à¸šà¸­à¸—à¸£à¸­à¸šà¸™à¸µà¹‰ à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸£à¸±à¸™ à¹„à¸¡à¹ˆà¹ƒà¸Šà¹‰à¸œà¸¥à¸«à¸¥à¸±à¸à¸«à¸£à¸·à¸­à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¹€à¸„à¸ª`,confirmLabel:'à¸¢à¸·à¸™à¸¢à¸±à¸™à¹€à¸žà¸´à¹ˆà¸¡à¹„à¸Ÿà¸¥à¹Œ Â· à¹„à¸¡à¹ˆà¸£à¸±à¸™',allowed:()=>Sb.signedIn()&&FileRunManagement.canManage(state.role)&&canAccessCompany(company)}),
    confirmHold:b=>FileRunManagement.confirmAction({title:`${b.paused?'à¸žà¸±à¸':'à¹€à¸›à¸´à¸”'}à¸šà¸­à¸—à¸£à¸­à¸šà¸«à¸¥à¸±à¸ Â· ${company} Â· ${date}`,message:`${b.reason}\nà¹„à¸¡à¹ˆà¹à¸à¹‰à¸¢à¸­à¸”à¸«à¸£à¸·à¸­à¸›à¸´à¸”à¹€à¸„à¸ª\nà¸à¸²à¸£à¸žà¸±à¸à¸šà¸­à¸—à¹„à¸¡à¹ˆà¹€à¸£à¸´à¹ˆà¸¡à¸£à¸±à¸™à¸¡à¸·à¸­à¹ƒà¸«à¹‰à¹€à¸­à¸‡`,confirmLabel:b.paused?'à¸¢à¸·à¸™à¸¢à¸±à¸™à¸žà¸±à¸à¸šà¸­à¸—':'à¸¢à¸·à¸™à¸¢à¸±à¸™à¹€à¸›à¸´à¸”à¸šà¸­à¸—',allowed:()=>Sb.signedIn()&&FileRunManagement.canManage(state.role)&&canAccessCompany(company)}),
    uploadCorrection:Sb.uploadAuditSourceCorrection,
    onFile:file=>openStoredFilePreview({path:file.storage_path,name:file.file_name,mime:file.mime_type,id:file.id,kind:file.kind,company:file.company,date,size:file.size_bytes}),
    confirmCorrection:b=>FileRunManagement.confirmAction({title:'à¸—à¸šà¸—à¸§à¸™à¹à¸à¹‰à¸§à¸±à¸™/à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹„à¸Ÿà¸¥à¹Œ',message:`${b.name}\nà¸šà¸£à¸´à¸©à¸±à¸— ${b.company} Â· à¸§à¸±à¸™à¸­à¹‰à¸²à¸‡à¸­à¸´à¸‡ ${b.date}\n${b.reason}\nà¹€à¸à¹‡à¸šà¸•à¹‰à¸™à¸‰à¸šà¸±à¸š à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸§à¸­à¸£à¹Œà¸Šà¸±à¸™à¹ƒà¸«à¸¡à¹ˆ à¹à¸¥à¸°à¸žà¸±à¸à¸šà¸­à¸—à¸£à¸­à¸šà¸—à¸µà¹ˆà¹€à¸à¸µà¹ˆà¸¢à¸§à¸‚à¹‰à¸­à¸‡ à¹„à¸¡à¹ˆà¸£à¸±à¸™à¸«à¸£à¸·à¸­à¸¢à¸·à¸™à¸¢à¸±à¸™à¸œà¸¥à¸«à¸¥à¸±à¸`,confirmLabel:'à¸¢à¸·à¸™à¸¢à¸±à¸™à¸šà¸±à¸™à¸—à¸¶à¸à¹€à¸§à¸­à¸£à¹Œà¸Šà¸±à¸™à¹ƒà¸«à¸¡à¹ˆ',allowed:()=>Sb.signedIn()&&FileRunManagement.canManage(state.role)&&canAccessCompany(company)}),
    confirmReparse:file=>FileRunManagement.confirmAction({title:'à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¹€à¸”à¸´à¸¡à¹ƒà¸«à¸¡à¹ˆà¸ˆà¸²à¸à¸«à¸™à¹‰à¸²à¸£à¸°à¸šà¸š',message:`${file.file_name}\nà¸šà¸£à¸´à¸©à¸±à¸— ${file.company} Â· à¸§à¸±à¸™à¸­à¹‰à¸²à¸‡à¸­à¸´à¸‡ ${file.business_date}\nà¸­à¹ˆà¸²à¸™à¸”à¹‰à¸§à¸¢à¸à¸Žà¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™à¹à¸¥à¸°à¸šà¸±à¸™à¸—à¸¶à¸à¹€à¸‰à¸žà¸²à¸°à¸œà¸¥ Parse à¹„à¸¡à¹ˆà¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸” à¹„à¸¡à¹ˆà¸ªà¸£à¹‰à¸²à¸‡à¸«à¸£à¸·à¸­à¸›à¸´à¸”à¹€à¸„à¸ª à¹à¸¥à¸°à¹„à¸¡à¹ˆà¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸œà¸¥à¸«à¸¥à¸±à¸`,confirmLabel:'à¸¢à¸·à¸™à¸¢à¸±à¸™à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¹ƒà¸«à¸¡à¹ˆ',allowed:()=>Sb.signedIn()&&FileRunManagement.canManage(state.role)&&canAccessCompany(company)}),
    confirmRunWarnings:b=>FileRunManagement.confirmAction({title:`à¸—à¸šà¸—à¸§à¸™à¸„à¸³à¹€à¸•à¸·à¸­à¸™ Â· ${b.company} Â· ${b.date}`,message:`à¸žà¸šà¸„à¸³à¹€à¸•à¸·à¸­à¸™ ${b.warnings.length} à¸£à¸²à¸¢à¸à¸²à¸£\n${b.warnings.map(w=>[w.file_name,w.detail].filter(Boolean).join(' Â· ')).join('\n')}\nà¹„à¸›à¸—à¸šà¸—à¸§à¸™à¸‚à¸­à¸šà¹€à¸‚à¸•à¸£à¸±à¸™à¸•à¸£à¸§à¸ˆà¸¡à¸·à¸­à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸£à¸±à¸™à¸ˆà¸™à¸à¸”à¸¢à¸·à¸™à¸¢à¸±à¸™à¹ƒà¸™à¸‚à¸±à¹‰à¸™à¸–à¸±à¸”à¹„à¸› à¹„à¸¡à¹ˆà¹€à¸›à¸´à¸”à¸šà¸­à¸— à¹„à¸¡à¹ˆà¸¢à¸·à¸™à¸¢à¸±à¸™à¸œà¸¥à¸«à¸¥à¸±à¸à¸«à¸£à¸·à¸­à¸ªà¹ˆà¸‡à¸Šà¸µà¹‰à¹à¸ˆà¸‡`,confirmLabel:'à¹„à¸›à¹€à¸¥à¸·à¸­à¸à¸‚à¸­à¸šà¹€à¸‚à¸• Â· à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸£à¸±à¸™',allowed:()=>Sb.signedIn()&&canAccessCompany(company)}),
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
  openModal('à¹€à¸¥à¸·à¸­à¸à¸‚à¸­à¸šà¹€à¸‚à¸•à¸ˆà¸±à¸”à¸à¸²à¸£à¹„à¸Ÿà¸¥à¹Œ / à¸žà¸±à¸à¸£à¸±à¸™',`<label>à¸šà¸£à¸´à¸©à¸±à¸—<select id="fileManageCompany">${companies.map(c=>`<option ${c===company?'selected':''}>${h(c)}</option>`).join('')}</select></label><label>à¸§à¸±à¸™à¸—à¸µà¹ˆ<input type="date" id="fileManageDate" value="${h(state.filters.to||state.filters.date||DEFAULT_WORK_DATE)}"></label>`,'<button id="fileManageContinue">à¹€à¸›à¸´à¸”à¹„à¸Ÿà¸¥à¹Œ/à¸ªà¸–à¸²à¸™à¸°à¸‚à¸­à¸‡à¸§à¸±à¸™</button>');
  $('#fileManageContinue').onclick=()=>{const company=$('#fileManageCompany').value,date=$('#fileManageDate').value;if(!company||!/^\d{4}-\d{2}-\d{2}$/.test(date))return toast('à¹€à¸¥à¸·à¸­à¸à¸šà¸£à¸´à¸©à¸±à¸—à¹à¸¥à¸°à¸§à¸±à¸™à¸—à¸µà¹ˆà¹ƒà¸«à¹‰à¸„à¸£à¸š','warn');closeModal();openFileRunManagement({company,date,accounts:[]});};
}
function openAuditSourceArchive(){
  if(state.dataset!=='production'||!Sb.signedIn())return deny('à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹„à¸Ÿà¸¥à¹Œà¸ˆà¸£à¸´à¸‡');
  const companies=MC8LiveSheets.COMPANIES.filter(canAccessCompany),initialActor=Sb.authUser()?.id;
  openModal('à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹„à¸Ÿà¸¥à¹Œà¸ˆà¸£à¸´à¸‡ â€” à¹€à¸œà¸·à¹ˆà¸­à¸—à¸³à¸‡à¸²à¸™à¸¡à¸·à¸­','<div id="auditSourceArchivePanel"></div>','<button id="auditArchiveCancel">à¸›à¸´à¸” / à¸¢à¸à¹€à¸¥à¸´à¸à¸à¸²à¸£à¹€à¸•à¸£à¸µà¸¢à¸¡</button>');
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
  if(state.dataset!=='production'||!Sb.signedIn()||file.kind!=='bo_main'||!canAccessCompany(file.company))throw new Error('à¹„à¸¡à¹ˆà¸¡à¸µà¸ªà¸´à¸—à¸˜à¸´à¹Œà¸­à¹ˆà¸²à¸™ BO à¸•à¹‰à¸™à¸—à¸²à¸‡');
  if(!/\.xlsx$/i.test(file.file_name))throw new Error('à¹„à¸Ÿà¸¥à¹Œ BO à¸™à¸µà¹‰à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆ XLSX à¸—à¸µà¹ˆà¸£à¸­à¸‡à¸£à¸±à¸š');
  const response=await fetch(await Sb.signedUrl(file.storage_path));
  if(!response.ok)throw new Error('à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸” BO à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ ('+response.status+')');
  const result=Formats.parse(file.file_name,await XlsxReader.read(await response.arrayBuffer()),date);
  if(!['bo_compact','bo_transaction_export','bo_main'].includes(result.code))throw new Error('à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸¹à¸›à¹à¸šà¸š BO à¸—à¸µà¹ˆà¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹„à¸”à¹‰');
  return [...result.records,...(result.aux||[]).filter(r=>r.kind==='xb_information')];
}
async function openManualPrimaryCaseSet(id,onReload){
  if(!['lead','admin'].includes(state.role))return deny('à¸¢à¸·à¸™à¸¢à¸±à¸™à¹€à¸„à¸ªà¸Šà¸¸à¸”à¹ƒà¸«à¸¡à¹ˆ');
  return PrimaryCaseSets.open(id,{actor:()=>Sb.authUser()?.id,role:()=>state.role,preview:Sb.manualPrimaryCasesPreview,activate:Sb.activateManualPrimaryCases,onActivated:()=>{toast('à¸ªà¸£à¹‰à¸²à¸‡à¹€à¸„à¸ªà¸Šà¸¸à¸”à¹ƒà¸«à¸¡à¹ˆà¹à¸¥à¹‰à¸§ à¹€à¸à¹‡à¸šà¹€à¸„à¸ªà¹€à¸”à¸´à¸¡à¹€à¸›à¹‡à¸™à¸›à¸£à¸°à¸§à¸±à¸•à¸´');onReload?.();}});
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
    if (!row?.id) throw new Error('à¹„à¸¡à¹ˆà¸žà¸š UUID à¸‚à¸­à¸‡à¹€à¸„à¸ªà¸ˆà¸£à¸´à¸‡');
    await openEvidenceRelatedCase(row.id);
  },
  onNewCaseSet: ['lead','admin'].includes(state.role)?openManualPrimaryCaseSet:null,
  onCaseError: (error) => toast('à¹€à¸›à¸´à¸”à¹€à¸„à¸ªà¸ˆà¸£à¸´à¸‡à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: ' + (error?.message || 'à¹„à¸¡à¹ˆà¸—à¸£à¸²à¸šà¸ªà¸²à¹€à¸«à¸•à¸¸'), 'warn'),
  onFile: (file,date,company) => { if(file?.storage_path) openStoredFilePreview({path:file.storage_path,name:file.file_name,mime:file.mime_type,id:file.id,kind:file.kind,company:file.company||company,date,size:file.size_bytes,status:file.parse_error?'error':file.parsed?'parsed':'waiting'}); },
  exportWorkbook: (sheets, filename, meta) => Exporter.workbook(sheets, filename, meta),
  onExported: ({filename,company,date,rows,sheets,complete}) => {
    logAction('export', 'audit_reconciliation_workbook', `${company}|${date}`, `Excel ${sheets} à¸Šà¸µà¸• Â· ${rows} à¹à¸–à¸§ Â· ${complete?'à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸£à¸­à¸šà¸„à¸£à¸š':'à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸£à¸­à¸šà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸„à¸£à¸š'}`);
    toast(`à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸” ${filename} à¹à¸¥à¹‰à¸§ (${sheets} à¸Šà¸µà¸• Â· ${num(rows)} à¹à¸–à¸§)`);
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
      retry.textContent = 'à¸•à¸£à¸§à¸ˆà¸ªà¸´à¸—à¸˜à¸´à¹Œà¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡';
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
  $('#connectionMessage').textContent = message || 'à¸à¸³à¸¥à¸±à¸‡à¸„à¸·à¸™à¸ªà¸–à¸²à¸™à¸°à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸šà¹à¸¥à¸°à¸•à¸£à¸§à¸ˆà¸ªà¸´à¸—à¸˜à¸´à¹Œ à¸à¸£à¸¸à¸“à¸²à¸£à¸­à¸ªà¸±à¸à¸„à¸£à¸¹à¹ˆ à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸šà¸‹à¹‰à¸³';
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
  document.title = `${route.title} Â· Audit AI Reconciliation`;
  $("#pageDesc").innerHTML =
    h(route.desc) +
    (Sb.signedIn() ? ' <span class="badge green">à¸£à¸°à¸šà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸£à¸´à¸‡</span>' : "");
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
    const entry=document.createElement('button');entry.id='fileManageEntry';entry.className='ghost-button';entry.textContent='à¸£à¸±à¸™à¸¡à¸·à¸­ / à¸ˆà¸±à¸”à¸à¸²à¸£à¹„à¸Ÿà¸¥à¹Œ';entry.onclick=chooseFileRunManagement;$('#btnExport').parentElement.appendChild(entry);
    const backup=document.createElement('button');backup.id='sourceArchiveEntry';backup.className='ghost-button';backup.textContent='à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹„à¸Ÿà¸¥à¹Œà¸ˆà¸£à¸´à¸‡ (à¸—à¸³à¸‡à¸²à¸™à¸¡à¸·à¸­)';backup.onclick=openAuditSourceArchive;$('#btnExport').parentElement.appendChild(backup);
    if(['cloud','intake'].includes(route.id)){
      const card=document.createElement('section');card.className='source-archive-launch';card.innerHTML='<div><h2>à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¸•à¹‰à¸™à¸‰à¸šà¸±à¸šà¹„à¸§à¹‰à¸—à¸³à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸¡à¸·à¸­</h2><p>à¹€à¸¥à¸·à¸­à¸à¸šà¸£à¸´à¸©à¸±à¸—à¹à¸¥à¸°à¸§à¸±à¸™à¸—à¸µà¹ˆ Â· à¹„à¸”à¹‰ ZIP à¹à¸¢à¸à¹‚à¸Ÿà¸¥à¹€à¸”à¸­à¸£à¹Œ STM/PM, BO à¹à¸¥à¸°à¸«à¸¥à¸±à¸à¸à¸²à¸™ Â· à¹„à¸¡à¹ˆà¸£à¸±à¸™à¸šà¸­à¸—à¸«à¸£à¸·à¸­à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¹€à¸„à¸ª</p></div><button>à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹„à¸Ÿà¸¥à¹Œà¸•à¹‰à¸™à¸‰à¸šà¸±à¸š</button>';card.querySelector('button').onclick=openAuditSourceArchive;$('#viewRoot').prepend(card);
      const manual=document.createElement('section');manual.className='source-archive-launch';manual.innerHTML='<div><h2>à¸£à¸±à¸™à¸•à¸£à¸§à¸ˆà¸‹à¹‰à¸³ / à¸ˆà¸±à¸”à¸à¸²à¸£à¹„à¸Ÿà¸¥à¹Œ</h2><p>1 à¹€à¸¥à¸·à¸­à¸à¸šà¸£à¸´à¸©à¸±à¸—à¹à¸¥à¸°à¸§à¸±à¸™ â†’ 2 à¹€à¸¥à¸·à¸­à¸à¹„à¸Ÿà¸¥à¹Œ/à¸šà¸±à¸à¸Šà¸µ â†’ 3 à¸•à¸£à¸§à¸ˆà¹à¸¥à¸°à¸—à¸šà¸—à¸§à¸™à¸œà¸¥ Â· à¸«à¸±à¸§à¸«à¸™à¹‰à¸²/à¸œà¸¹à¹‰à¸”à¸¹à¹à¸¥à¸¢à¸·à¸™à¸¢à¸±à¸™à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™<br>à¹à¸à¹‰à¸Šà¸·à¹ˆà¸­/à¸šà¸£à¸´à¸©à¸±à¸—/à¸‰à¸šà¸±à¸šà¹à¸—à¸™ à¸«à¸£à¸·à¸­à¸žà¸±à¸à¸£à¸±à¸™à¹„à¸”à¹‰ à¹‚à¸”à¸¢à¹€à¸à¹‡à¸šà¸•à¹‰à¸™à¸‰à¸šà¸±à¸šà¹à¸¥à¸°à¸›à¸£à¸°à¸§à¸±à¸•à¸´</p></div><button>à¹€à¸¥à¸·à¸­à¸à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸°à¸£à¸±à¸™à¸•à¸£à¸§à¸ˆà¸‹à¹‰à¸³</button>';manual.querySelector('button').onclick=chooseFileRunManagement;$('#viewRoot').prepend(manual);
    }
  }
  if (state.dataset === "production" && Sb.signedIn() && !["dashboard", "damage", "mc8-sheets", "finance"].includes(route.id)) {
    const liveNotice = liveOverviewState.loading
      ? `<section class="alert live-background-notice"><strong>à¸à¸³à¸¥à¸±à¸‡à¸­à¸±à¸›à¹€à¸”à¸•à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸¥à¹ˆà¸²à¸ªà¸¸à¸”</strong><span>à¸«à¸™à¹‰à¸²à¸™à¸µà¹‰à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¹„à¸”à¹‰à¸•à¸²à¸¡à¸›à¸à¸•à¸´ à¸•à¸±à¸§à¹€à¸¥à¸‚à¸ˆà¸°à¸­à¸±à¸›à¹€à¸”à¸•à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´à¹€à¸¡à¸·à¹ˆà¸­ Supabase à¸•à¸­à¸šà¸à¸¥à¸±à¸š</span></section>`
      : liveOverviewState.error
        ? `<section class="alert warn live-background-notice"><strong>à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸¥à¹ˆà¸²à¸ªà¸¸à¸”à¸¢à¸±à¸‡à¸¡à¸²à¹„à¸¡à¹ˆà¸„à¸£à¸š</strong><span>${h(liveOverviewState.error)}</span><button class="ghost-button sm" id="liveBackgroundRetry">à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆ</button></section>`
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
    if (key === liveOverviewState.key) moreCaseState.error = "à¹‚à¸«à¸¥à¸”à¹€à¸„à¸ªà¹€à¸žà¸´à¹ˆà¸¡à¹€à¸•à¸´à¸¡à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: " + error.message;
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
    liveExceptionSearch.error = error.message || "à¸„à¹‰à¸™à¸«à¸² Supabase à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ";
  }
  liveExceptionSearch.loading = false;
  if (state.route === "exceptions") render();
}

const LIVE_KIND_LABEL = {
  stm_pdf: "STM / à¸à¸²à¸-à¸–à¸­à¸™à¸˜à¸™à¸²à¸„à¸²à¸£",
  bo_main: "à¸£à¸²à¸¢à¸‡à¸²à¸™ BO",
  pm_statement: "à¸£à¸²à¸¢à¸à¸²à¸£à¹€à¸”à¸´à¸™à¸šà¸±à¸à¸Šà¸µ PM",
  manual_credit: "à¸à¸²à¸à¸¡à¸·à¸­ - à¹€à¸„à¸£à¸”à¸´à¸•",
  manual_payment: "à¸à¸²à¸à¸¡à¸·à¸­ - Payment",
  manual_bonus: "à¸à¸²à¸à¸¡à¸·à¸­ - à¹‚à¸šà¸™à¸±à¸ª",
  comm_req: "à¸–à¸­à¸™à¸„à¹ˆà¸²à¸„à¸­à¸¡à¸¡à¸´à¸Šà¸Šà¸±à¹ˆà¸™",
  credit_out: "à¸–à¸­à¸™à¹€à¸„à¸£à¸”à¸´à¸•",
  doc_clarify: "à¹€à¸­à¸à¸ªà¸²à¸£à¸Šà¸µà¹‰à¹à¸ˆà¸‡",
  unknown: "à¸¢à¸±à¸‡à¸ˆà¸³à¹à¸™à¸à¹„à¸¡à¹ˆà¹„à¸”à¹‰",
};

const LIVE_STATUS = {
  completed: { label: "à¸£à¸°à¸šà¸šà¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¹€à¸ªà¸£à¹‡à¸ˆ", tone: "green" },
  completed_review: { label: "à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¹à¸¥à¹‰à¸§ Â· à¸£à¸­à¸•à¸£à¸§à¸ˆà¹€à¸„à¸ª", tone: "amber" },
  needs_review: { label: "à¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š", tone: "red" },
  waiting_files: { label: "à¸£à¸­à¹„à¸Ÿà¸¥à¹Œ", tone: "amber" },
  ready: { label: "à¸žà¸£à¹‰à¸­à¸¡à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”", tone: "blue" },
  queued: { label: "à¹€à¸‚à¹‰à¸²à¸„à¸´à¸§", tone: "blue" },
  running: { label: "à¸à¸³à¸¥à¸±à¸‡à¸—à¸³à¸‡à¸²à¸™", tone: "violet" },
  error: { label: "à¸¥à¹‰à¸¡à¹€à¸«à¸¥à¸§", tone: "red" },
};

// à¸•à¸²à¸£à¸²à¸‡à¸„à¸´à¸§à¸£à¸¸à¹ˆà¸™à¹€à¸à¹ˆà¸²à¹€à¸„à¸¢à¸ªà¸£à¹‰à¸²à¸‡à¹à¸–à¸§à¸£à¸§à¸¡à¸•à¸²à¸¡à¸Šà¸·à¹ˆà¸­à¸£à¸°à¸šà¸š (PM / SYS123 / XXX)
// à¹à¸–à¸§à¹€à¸«à¸¥à¹ˆà¸²à¸™à¸±à¹‰à¸™à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸šà¸£à¸´à¸©à¸±à¸—à¹à¸¥à¸°à¸•à¹‰à¸­à¸‡à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸™à¸³à¹„à¸›à¸›à¸™à¸à¸±à¸šà¸ªà¸£à¸¸à¸› 9 à¸šà¸£à¸´à¸©à¸±à¸—à¸ˆà¸£à¸´à¸‡
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
  return "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸£à¸°à¸šà¸š";
};
const isLiveCompanyRow = (row) => Boolean(normalizeLiveCompanyCode(row?.company));
const actionableAuditRows = (rows, evidence) => window.AuditVisiblePolicy ? window.AuditVisiblePolicy.filter(rows, evidence) : (Array.isArray(rows) ? rows : []);
const informationalAuditRows = (rows) => (Array.isArray(rows) ? rows : []).filter((row) => window.AuditVisiblePolicy?.isInformational(row));
const matchedStaleAuditCount = (rows, evidence) => Math.max(0, actionableAuditRows(rows).length - actionableAuditRows(rows, evidence).length);

const CHECKLIST_STATUS = {
  scheduled: { label: "à¹€à¸•à¸£à¸µà¸¢à¸¡à¸£à¸­à¸§à¸±à¸™à¸—à¸³à¸à¸²à¸£", tone: "grey" },
  receiving: { label: "à¸­à¸¢à¸¹à¹ˆà¹ƒà¸™à¸Šà¹ˆà¸§à¸‡à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œ", tone: "blue" },
  missing_files: { label: "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œ", tone: "red" },
  missing_required: { label: "à¹„à¸Ÿà¸¥à¹Œà¸«à¸¥à¸±à¸à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸„à¸£à¸š", tone: "red" },
  parse_error: { label: "à¸¡à¸µà¹„à¸Ÿà¸¥à¹Œà¸­à¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰", tone: "red" },
  waiting_parse: { label: "à¸à¸³à¸¥à¸±à¸‡à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œ", tone: "amber" },
  waiting_files: { label: "à¸£à¸­à¹„à¸Ÿà¸¥à¹Œ", tone: "amber" },
  ready: { label: "à¸žà¸£à¹‰à¸­à¸¡à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”", tone: "blue" },
  queued: { label: "à¹€à¸‚à¹‰à¸²à¸„à¸´à¸§", tone: "blue" },
  running: { label: "à¸à¸³à¸¥à¸±à¸‡à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”", tone: "violet" },
  needs_review: { label: "à¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š", tone: "red" },
  open_cases: { label: "à¸¡à¸µà¹€à¸„à¸ªà¸•à¹‰à¸­à¸‡à¸›à¸´à¸”", tone: "amber" },
  completed: { label: "à¸£à¸°à¸šà¸šà¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¹€à¸ªà¸£à¹‡à¸ˆ", tone: "green" },
  error: { label: "à¸—à¸³à¸‡à¸²à¸™à¸¥à¹‰à¸¡à¹€à¸«à¸¥à¸§", tone: "red" },
};

const checklistMark = (ok, value, optional = false) =>
  `<span class="check-mark ${ok ? "ok" : optional ? "optional" : "missing"}"><b>${ok ? "âœ“" : optional ? "â€“" : "!"}</b>${h(value)}</span>`;

const expectedBoCount = (row) => Number(row?.expected_bo_count || (["AT4", "FR8", "SK8"].includes(normalizeLiveCompanyCode(row?.company)) ? 2 : 1));
const registeredStmCount = (row) => Number(row?.registered_stm_accounts || 0);
const registeredPmCount = (row) => Number(row?.registered_pm_files || 0);

function safeExceptionDetail(e) {
  const detail = String(e.detail || "");
  if (!/undefined|NaN(?::NaN)*/i.test(detail)) return detail;
  if ((e.ex_type || e.type) === "cross_day") return "à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸§à¸±à¸™à¸—à¸µà¹ˆà¸«à¸£à¸·à¸­à¹€à¸§à¸¥à¸²à¸à¸±à¹ˆà¸‡ BO à¹„à¸¡à¹ˆà¸„à¸£à¸š â€” à¹„à¸¡à¹ˆà¸„à¸§à¸£à¹ƒà¸Šà¹‰à¸£à¸²à¸¢à¸à¸²à¸£à¸™à¸µà¹‰à¸•à¸±à¸”à¸ªà¸´à¸™à¸§à¹ˆà¸²à¹€à¸›à¹‡à¸™à¸£à¸²à¸¢à¸à¸²à¸£à¸‚à¹‰à¸²à¸¡à¸§à¸±à¸™ à¸à¸£à¸¸à¸“à¸²à¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¹ƒà¸«à¸¡à¹ˆà¸”à¹‰à¸§à¸¢ Worker à¹€à¸§à¸­à¸£à¹Œà¸Šà¸±à¸™à¸¥à¹ˆà¸²à¸ªà¸¸à¸”";
  return detail.replace(/undefined/gi, "à¹„à¸¡à¹ˆà¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥").replace(/NaN(?::NaN)*/gi, "à¹„à¸¡à¹ˆà¸žà¸šà¹€à¸§à¸¥à¸²");
}

function caseLabel(e) {
  const company = String(e?.company || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸").trim();
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
  const code = String(e?.code || e?.id || "à¹€à¸„à¸ª").trim();
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
    company: e.company || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸",
    bank: e.bank || "-",
    account: e.account || "-",
    direction: e.direction || "-",
    member: e.member_code || "-",
    customerDetails: e.customer_details || {},
    type: e.ex_type || "unknown",
    typeName: e.type_name || e.ex_type || "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸ˆà¸³à¹à¸™à¸",
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
    employee: e.employee || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸",
    shift: e.shift || "day",
    cause: e.cause || "à¸£à¸­à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸ªà¸²à¹€à¸«à¸•à¸¸",
    detail: safeExceptionDetail(e),
    stmRaw: e.stm_raw || "â€”",
    boRaw: e.bo_raw || "â€”",
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
    company: normalizeLiveCompanyCode(d.company) || d.company || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸",
    employee: d.employee || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸",
    shift: d.shift || "-",
    time: String(d.occurred_at || '').slice(0, 8),
    amount: d.amount_thb == null && d.amount == null ? null : Number(d.amount_thb ?? d.amount),
    cause: d.cause || "à¸£à¸­à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š",
    cycle: d.cycle || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸£à¸­à¸š",
    evidence: !!d.has_evidence,
    hrStatus: d.hr_status || "à¸£à¸­à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£",
    financeStatus: d.finance_status || "à¸£à¸­à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£",
    createdAt: d.created_at || null,
  };
}

function openWrongClosureReversal(e,action) {
  if(state.dataset!=='production'||!Sb.signedIn()||!['lead','admin'].includes(state.role)||!can('approve'))return deny('à¸¢à¸à¹€à¸¥à¸´à¸à¸œà¸¥à¸›à¸´à¸”à¹€à¸„à¸ª');
  if(!['closed','damage'].includes(e.status))return toast('à¹€à¸„à¸ªà¸™à¸µà¹‰à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸­à¸¢à¸¹à¹ˆà¹ƒà¸™à¸ªà¸–à¸²à¸™à¸°à¸›à¸´à¸”à¸«à¸£à¸·à¸­à¸¢à¸·à¸™à¸¢à¸±à¸™à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢à¹à¸¥à¹‰à¸§','warn');
  const returning=action==='return_clarification';
  const title=returning?'à¸•à¸µà¸à¸¥à¸±à¸šà¹ƒà¸«à¹‰à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸•à¸´à¸¡':'à¸¢à¸à¹€à¸¥à¸´à¸à¸œà¸¥à¸›à¸´à¸” â€” à¸„à¸·à¸™à¹ƒà¸«à¹‰ Audit à¸•à¸£à¸§à¸ˆà¹ƒà¸«à¸¡à¹ˆ';
  openModal(title,`<p>${h(caseLabel(e))}</p><p class="alert warn">à¸à¸²à¸£à¸—à¸³à¸£à¸²à¸¢à¸à¸²à¸£à¸™à¸µà¹‰à¹„à¸¡à¹ˆà¸¥à¸šà¸¢à¸­à¸” à¸«à¸¥à¸±à¸à¸à¸²à¸™ à¸«à¸£à¸·à¸­à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¹€à¸”à¸´à¸¡ à¸£à¸°à¸šà¸šà¸ˆà¸°à¸—à¸³à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸«à¸¡à¸²à¸¢à¸œà¸¥à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢à¹€à¸”à¸´à¸¡à¸§à¹ˆà¸² â€œà¸¢à¸à¹€à¸¥à¸´à¸â€ à¹à¸¥à¸°à¸™à¸³à¸­à¸­à¸à¸ˆà¸²à¸à¸¢à¸­à¸”à¸ªà¸£à¸¸à¸›à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™${e.manualPairId?' Â· à¹€à¸„à¸ªà¸™à¸µà¹‰à¸›à¸´à¸”à¸ˆà¸²à¸à¸à¸²à¸£à¸ˆà¸±à¸šà¸„à¸¹à¹ˆ à¸£à¸°à¸šà¸šà¸ˆà¸°à¸¢à¸à¹€à¸¥à¸´à¸à¸œà¸¥à¸„à¸¹à¹ˆ à¸›à¸¥à¸”à¸„à¸¹à¹ˆà¸ˆà¸­à¸‡ à¹à¸¥à¸°à¸„à¸·à¸™à¸—à¸±à¹‰à¸‡à¸ªà¸­à¸‡à¹€à¸„à¸ªà¹ƒà¸«à¹‰à¸•à¸£à¸§à¸ˆà¹ƒà¸«à¸¡à¹ˆ':''}</p><p>${returning?'à¸„à¸·à¸™à¹€à¸„à¸ªà¹„à¸›à¸ªà¸–à¸²à¸™à¸°à¸£à¸­à¸œà¸¹à¹‰à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸ªà¹ˆà¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸•à¸´à¸¡':'à¸„à¸·à¸™à¹€à¸„à¸ªà¹„à¸›à¸ªà¸–à¸²à¸™à¸°à¸•à¸­à¸šà¹à¸¥à¹‰à¸§ à¹€à¸žà¸·à¹ˆà¸­à¹ƒà¸«à¹‰ Audit à¸•à¸£à¸§à¸ˆà¹à¸¥à¸°à¸›à¸´à¸”à¸œà¸¥à¹ƒà¸«à¸¡à¹ˆ'}</p><label>à¹€à¸«à¸•à¸¸à¸œà¸¥à¸—à¸µà¹ˆà¸¢à¸à¹€à¸¥à¸´à¸à¸œà¸¥à¹€à¸”à¸´à¸¡<textarea id="closureReversalReason" maxlength="2000" placeholder="à¸£à¸°à¸šà¸¸à¸§à¹ˆà¸²à¸œà¸¥à¹€à¸”à¸´à¸¡à¸œà¸´à¸”à¸­à¸¢à¹ˆà¸²à¸‡à¹„à¸£ à¹à¸¥à¸°à¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆà¹à¸à¹‰à¸ˆà¸¸à¸”à¹ƒà¸”"></textarea></label><label><input type="checkbox" id="closureReversalChecked">à¸•à¸£à¸§à¸ˆà¹€à¸¥à¸‚à¹€à¸„à¸ª à¸¢à¸­à¸”à¹€à¸”à¸´à¸¡ à¸«à¸¥à¸±à¸à¸à¸²à¸™ à¹à¸¥à¸°à¸¢à¸·à¸™à¸¢à¸±à¸™à¸§à¹ˆà¸²à¸•à¹‰à¸­à¸‡à¸¢à¹‰à¸­à¸™à¸œà¸¥à¸›à¸´à¸”à¹€à¸„à¸ªà¸™à¸µà¹‰${e.manualPairId?'à¸žà¸£à¹‰à¸­à¸¡à¹€à¸„à¸ªà¸„à¸¹à¹ˆ':''}</label><p id="closureReversalStatus" role="status"></p>`,`<button class="ghost-button" id="closureReversalCancel">à¸¢à¸à¹€à¸¥à¸´à¸</button><button class="primary-button" id="closureReversalConfirm">${h(title)}</button>`);
  $('#closureReversalCancel').onclick=closeModal;
  $('#closureReversalConfirm').onclick=async event=>{
    const reason=$('#closureReversalReason').value.trim();
    if(!$('#closureReversalChecked').checked||reason.length<10||reason.length>2000)return toast('à¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆà¸¢à¸·à¸™à¸¢à¸±à¸™à¹à¸¥à¸°à¸£à¸°à¸šà¸¸à¹€à¸«à¸•à¸¸à¸œà¸¥ 10â€“2,000 à¸•à¸±à¸§à¸­à¸±à¸à¸©à¸£','warn');
    event.currentTarget.disabled=true;$('#closureReversalStatus').textContent='à¸à¸³à¸¥à¸±à¸‡à¸šà¸±à¸™à¸—à¸¶à¸à¹à¸¥à¸°à¸­à¹ˆà¸²à¸™à¸ªà¸–à¸²à¸™à¸°à¸¢à¸·à¸™à¸¢à¸±à¸™ â€” à¸«à¹‰à¸²à¸¡à¸à¸”à¸‹à¹‰à¸³';
    try{
      await Sb.reverseWrongCaseClosure({p_id:crypto.randomUUID(),p_case:e.dbId,p_previous_status:e.status,p_action:action,p_reason:reason});
      closeModal();closeDrawer();await loadLiveOverview(true);render();toast(returning?'à¸•à¸µà¸à¸¥à¸±à¸šà¹ƒà¸«à¹‰à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¹à¸¥à¹‰à¸§ à¹à¸¥à¸°à¹€à¸à¹‡à¸šà¸›à¸£à¸°à¸§à¸±à¸•à¸´à¸œà¸¥à¹€à¸”à¸´à¸¡à¸„à¸£à¸š':e.manualPairId?'à¸¢à¸à¹€à¸¥à¸´à¸à¸œà¸¥à¸›à¸´à¸”à¸„à¸¹à¹ˆ à¸›à¸¥à¸”à¸„à¸¹à¹ˆà¸ˆà¸­à¸‡ à¹à¸¥à¸°à¸„à¸·à¸™à¸—à¸±à¹‰à¸‡à¸ªà¸­à¸‡à¹€à¸„à¸ªà¹ƒà¸«à¹‰ Audit à¸•à¸£à¸§à¸ˆà¹ƒà¸«à¸¡à¹ˆà¹à¸¥à¹‰à¸§':'à¸¢à¸à¹€à¸¥à¸´à¸à¸œà¸¥à¸›à¸´à¸”à¹à¸¥à¸°à¸„à¸·à¸™à¹ƒà¸«à¹‰ Audit à¸•à¸£à¸§à¸ˆà¹ƒà¸«à¸¡à¹ˆà¹à¸¥à¹‰à¸§');
    }catch(error){$('#closureReversalStatus').textContent='à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¢à¸·à¸™à¸¢à¸±à¸™à¸œà¸¥: '+error.message;toast('à¸¢à¸±à¸‡à¸¢à¹‰à¸­à¸™à¹€à¸„à¸ªà¹„à¸¡à¹ˆà¹„à¸”à¹‰: '+error.message,'warn');event.currentTarget.disabled=false;}
  };
}

function hydrateLiveData(quality, operations, exceptions, damages, logs) {
  DB.exceptions = actionableAuditRows(exceptions).map(mapLiveException);
  DB.damages = (damages || []).map(mapLiveDamage);
  DB.auditLog = (logs || []).map((l) => ({ at: l.at, user: l.actor || "à¸£à¸°à¸šà¸š", action: l.action, entity: l.entity, target: l.target, detail: l.detail || "" }));
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
    text.textContent = "à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸¥à¹ˆà¸²à¸ªà¸¸à¸”à¸žà¸£à¹‰à¸­à¸¡à¹à¸¥à¹‰à¸§ Â· à¸«à¸™à¹‰à¸²à¸—à¸µà¹ˆà¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸¢à¸±à¸‡à¸„à¸‡à¹€à¸”à¸´à¸¡";
    const button = document.createElement("button");
    button.className = "ghost-button sm";
    button.textContent = "à¹à¸ªà¸”à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸¥à¹ˆà¸²à¸ªà¸¸à¸”";
    button.onclick = () => {
      // Applying is explicit; never discard a form or open case silently.
      if (($('#drawer') && !$('#drawer').hidden) || (typeof liveQueueRoute === 'function' && liveQueueRoute() && liveQueueProtected()) || ($("#modal") && !$("#modal").hidden)) {
        toast("à¸à¸£à¸¸à¸“à¸²à¸šà¸±à¸™à¸—à¸¶à¸à¹à¸¥à¸°à¸›à¸´à¸”à¸«à¸™à¹‰à¸²à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸—à¸µà¹ˆà¹€à¸›à¸´à¸”à¸­à¸¢à¸¹à¹ˆà¸à¹ˆà¸­à¸™ â€” à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸«à¸™à¹‰à¸²à¸«à¸£à¸·à¸­à¸—à¸´à¹‰à¸‡à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡", "warn");
        return;
      }
      if (notice.querySelector("div")) return;
      const confirm = document.createElement("div");
      confirm.setAttribute("role", "group");
      confirm.setAttribute("aria-label", "à¸¢à¸·à¸™à¸¢à¸±à¸™à¹à¸ªà¸”à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸¥à¹ˆà¸²à¸ªà¸¸à¸”");
      const warning = document.createElement("p");
      warning.textContent = "à¹à¸ªà¸”à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸¥à¹ˆà¸²à¸ªà¸¸à¸”? à¸«à¸²à¸à¸¡à¸µà¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸—à¸µà¹ˆà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸šà¸±à¸™à¸—à¸¶à¸ à¹ƒà¸«à¹‰à¸¢à¸à¹€à¸¥à¸´à¸à¹à¸¥à¸°à¸šà¸±à¸™à¸—à¸¶à¸à¸à¹ˆà¸­à¸™";
      const cancel = document.createElement("button");
      cancel.className = "ghost-button sm";
      cancel.textContent = "à¸¢à¸à¹€à¸¥à¸´à¸";
      cancel.onclick = () => confirm.remove();
      const apply = document.createElement("button");
      apply.className = "primary-button sm";
      apply.textContent = "à¸¢à¸·à¸™à¸¢à¸±à¸™à¹à¸ªà¸”à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸¥à¹ˆà¸²à¸ªà¸¸à¸”";
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
    retry.textContent = "à¸¥à¸­à¸‡à¹‚à¸«à¸¥à¸”à¹ƒà¸«à¸¡à¹ˆ";
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
    ? "à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸šà¸²à¸‡à¸ªà¹ˆà¸§à¸™à¹‚à¸«à¸¥à¸”à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: " + errors.join(" Â· ") + " â€” à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸¢à¸­à¸”à¸„à¹‰à¸²à¸‡à¹€à¸›à¹‡à¸™à¸¨à¸¹à¸™à¸¢à¹Œ; à¸à¸”à¸¥à¸­à¸‡à¹‚à¸«à¸¥à¸”à¹ƒà¸«à¸¡à¹ˆà¹‚à¸”à¸¢à¹„à¸¡à¹ˆà¸—à¸´à¹‰à¸‡à¸‡à¸²à¸™à¸—à¸µà¹ˆà¹€à¸›à¸´à¸”à¸­à¸¢à¸¹à¹ˆ"
    : "à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸¥à¹ˆà¸²à¸ªà¸¸à¸”à¸žà¸£à¹‰à¸­à¸¡à¹à¸¥à¹‰à¸§ Â· à¸«à¸™à¹‰à¸²à¸—à¸µà¹ˆà¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸¢à¸±à¸‡à¸„à¸‡à¹€à¸”à¸´à¸¡";
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
        liveOverviewState.auxiliaryError = 'à¸£à¸²à¸¢à¸à¸²à¸£à¹€à¸„à¸ª: ' + (error.message || 'à¹‚à¸«à¸¥à¸”à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ') + ' Â· à¸„à¸‡à¸£à¹ˆà¸²à¸‡à¹à¸¥à¸°à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸—à¸µà¹ˆà¹‚à¸«à¸¥à¸”à¹„à¸”à¹‰à¸„à¸£à¸±à¹‰à¸‡à¸à¹ˆà¸­à¸™';
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
    // Phase 1: à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ªà¸£à¸¸à¸›à¸‚à¸™à¸²à¸”à¹€à¸¥à¹‡à¸à¸•à¹‰à¸­à¸‡à¸‚à¸¶à¹‰à¸™à¸«à¸™à¹‰à¸²à¸ˆà¸­à¸à¹ˆà¸­à¸™ à¹„à¸¡à¹ˆà¸£à¸­ exception/à¸«à¸¥à¸±à¸à¸à¸²à¸™à¸«à¸¥à¸²à¸¢à¸žà¸±à¸™à¹à¸–à¸§
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
    const coreNames = ["à¸¢à¸­à¸”à¹€à¸¡à¸¥à¹à¸¥à¸°à¹„à¸Ÿà¸¥à¹Œ", "à¸„à¸´à¸§à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”", "à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”", "à¹€à¸Šà¹‡à¸à¸¥à¸´à¸ªà¸•à¹Œ", "à¸¢à¸­à¸”à¹€à¸„à¸ªà¸Šà¸¸à¸”à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™", "à¸œà¸¥ BO-first", "à¸à¸²à¸£à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²à¸£à¸°à¸šà¸š", "à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¸žà¸±à¸à¸•à¸£à¸§à¸ˆ"];
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
    liveOverviewState.coreErrors = core.flatMap((item, index) => item.status === "rejected" ? [coreNames[index] + ": " + String(item.reason?.message || "à¸„à¸³à¸‚à¸­à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ").slice(0, 240)] : []);
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
      ? `à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸šà¸²à¸‡à¸ªà¹ˆà¸§à¸™à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸£à¹‰à¸­à¸¡: ${[...new Set(liveOverviewState.coreErrors)].join(", ")} â€” à¸•à¸±à¸§à¹€à¸¥à¸‚à¸ªà¹ˆà¸§à¸™à¸™à¸µà¹‰à¸ˆà¸°à¹à¸ªà¸”à¸‡ â€œâ€”â€ à¹à¸—à¸™à¸¨à¸¹à¸™à¸¢à¹Œ`
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

    // Phase 2: à¹€à¸•à¸´à¸¡à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸«à¸™à¸±à¸à¸”à¹‰à¸²à¸™à¸«à¸¥à¸±à¸‡ à¹‚à¸”à¸¢à¹„à¸¡à¹ˆà¸šà¸¥à¹‡à¸­à¸à¹à¸”à¸Šà¸šà¸­à¸£à¹Œà¸”à¸«à¸¥à¸±à¸
    const aux = await Promise.allSettled([
      // à¹‚à¸«à¸¥à¸”à¹€à¸‰à¸žà¸²à¸°à¸Šà¸¸à¸”à¹à¸£à¸à¹ƒà¸«à¹‰à¸«à¸™à¹‰à¸²à¸‚à¸¶à¹‰à¸™à¹„à¸§; à¸„à¹‰à¸™à¸«à¸²/Export à¸„à¹ˆà¸­à¸¢à¸”à¸¶à¸‡à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸•à¸´à¸¡à¹€à¸¡à¸·à¹ˆà¸­à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸£à¹‰à¸­à¸‡à¸‚à¸­
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
    const auxiliaryNames = ["à¸£à¸²à¸¢à¸à¸²à¸£à¹€à¸„à¸ª", "à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢", "à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¸‡à¸²à¸™", "à¸à¸²à¸£à¹à¸ˆà¹‰à¸‡à¹€à¸•à¸·à¸­à¸™", "à¸„à¸³à¸Šà¸µà¹‰à¹à¸ˆà¸‡", "à¸«à¸¥à¸±à¸à¸à¸²à¸™à¸ˆà¸±à¸šà¸„à¸¹à¹ˆ"];
    const auxiliaryErrors = aux.flatMap((item, index) => item.status === "rejected"
      ? [auxiliaryNames[index] + ": " + String(item.reason?.message || "à¸„à¸³à¸‚à¸­à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ").slice(0, 240)] : []);
    liveOverviewState.auxiliaryError = auxiliaryErrors.length ? auxiliaryErrors.join(" Â· ") : null;
    liveOverviewState.auxiliaryLoading = false;
    liveOverviewState.updatedAt = new Date();
    hydrateLiveData(liveOverviewState.quality || [], liveOverviewState.operations || [], exceptionRows, damageRows, logRows);
    if (!casesSucceeded) DB.exceptions = previousCases;
    if (aux[1].status !== 'fulfilled') DB.damages = previousDamages;
    if (aux[2].status !== 'fulfilled') DB.auditLog = previousLogs;
    updateBell();
  } catch (e) {
    if (requestId === liveOverviewState.requestId) liveOverviewState.error = e.message || "à¹‚à¸«à¸¥à¸”à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸£à¸´à¸‡à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ";
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
  // à¸­à¸¢à¹ˆà¸²à¸›à¸´à¸”à¸—à¸±à¹‰à¸‡à¸«à¸™à¹‰à¸²à¸£à¸°à¸«à¸§à¹ˆà¸²à¸‡à¸£à¸­à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸à¸¥à¸²à¸‡ à¹à¸•à¹ˆà¸¥à¸°à¸«à¸™à¹‰à¸²à¸ˆà¸°à¹à¸ªà¸”à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸—à¸µà¹ˆà¸¡à¸µà¸­à¸¢à¸¹à¹ˆà¸à¹ˆà¸­à¸™
  // à¹à¸¥à¸° render() à¸ˆà¸°à¹€à¸•à¸´à¸¡à¹à¸–à¸šà¹à¸ˆà¹‰à¸‡à¸ªà¸–à¸²à¸™à¸°à¸”à¹‰à¸²à¸™à¸šà¸™à¸ˆà¸™à¸à¸§à¹ˆà¸²à¸à¸²à¸£à¸­à¸±à¸›à¹€à¸”à¸•à¸ˆà¸°à¹€à¸ªà¸£à¹‡à¸ˆ
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
  const manualFollowupReady=Array.isArray(liveOverviewState.checklist)&&!hasLiveCoreError('à¹€à¸Šà¹‡à¸à¸¥à¸´à¸ªà¸•à¹Œ');
  const currentExceptionCount = (row) => {
    const lifecycle = currentCountsByCompanyDate.get(`${row.business_date}|${String(row.company || "").toUpperCase()}`);
    return lifecycle?.total_count != null
      ? Number(lifecycle.total_count || 0)
      : Number(row.exception_count || 0);
  };
  const currentCountsReady = Array.isArray(liveOverviewState.caseCounts) && !hasLiveCoreError("à¸¢à¸­à¸”à¹€à¸„à¸ªà¸Šà¸¸à¸”à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™");
  const exceptionTotal = currentCountsReady
    ? currentCountsInRange.reduce((sum, row) => sum + Number(row.total_count || 0), 0)
    : quality.reduce((sum, x) => sum + Number(x.exception_count || 0), 0);
  const risk = exceptions.reduce((sum, x) => sum + Number(x.riskAmount || 0), 0);
  const dailyAvailable = Array.isArray(liveOverviewState.daily) && !hasLiveCoreError("à¸¢à¸­à¸”à¹€à¸¡à¸¥à¹à¸¥à¸°à¹„à¸Ÿà¸¥à¹Œ");
  const qualityAvailable = Array.isArray(liveOverviewState.quality) && !hasLiveCoreError("à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”");
  const showMetric = (available, value) => available ? num(value) : "â€”";

  const opByKey = new Map(operations.map((x) => [`${x.business_date}|${x.company}|${x.business_system || ""}`, x]));
  const companyMap = new Map();
  quality.forEach((row) => {
    const key = `${row.company}|${row.business_system || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸£à¸°à¸šà¸š"}`;
    if (!companyMap.has(key)) companyMap.set(key, { company: row.company, system: row.business_system || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸£à¸°à¸šà¸š", completed: 0, review: 0, waiting: 0, error: 0, files: 0, latest: row.business_date, kinds: new Set() });
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
    { label: "STM / à¸à¸²à¸-à¸–à¸­à¸™à¸˜à¸™à¸²à¸„à¸²à¸£", kinds: ["stm_pdf"], tone: "blue" },
    { label: "à¸£à¸²à¸¢à¸‡à¸²à¸™ BO", kinds: ["bo_main"], tone: "green" },
    { label: "PM / Payment", kinds: ["pm_statement"], tone: "violet" },
    { label: "Manual / à¸£à¸²à¸¢à¸à¸²à¸£à¸žà¸´à¹€à¸¨à¸©", kinds: ["manual_credit", "manual_payment", "manual_bonus", "comm_req", "credit_out"], tone: "amber" },
    { label: "à¸Šà¸µà¹‰à¹à¸ˆà¸‡ / à¸¢à¸±à¸‡à¸ˆà¸³à¹à¸™à¸à¹„à¸¡à¹ˆà¹„à¸”à¹‰", kinds: ["doc_clarify", "unknown"], tone: "red" },
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
    ? `<section class="alert"><strong>à¸à¸³à¸¥à¸±à¸‡à¸­à¸±à¸›à¹€à¸”à¸•à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸¥à¹ˆà¸²à¸ªà¸¸à¸”</strong><span>à¹€à¸›à¸´à¸”à¸”à¸¹à¹€à¸¡à¸™à¸¹à¹à¸¥à¸°à¸£à¸²à¸¢à¸‡à¸²à¸™à¹„à¸”à¹‰à¸—à¸±à¸™à¸—à¸µ à¸£à¸°à¸šà¸šà¸ˆà¸°à¹€à¸•à¸´à¸¡à¸•à¸±à¸§à¹€à¸¥à¸‚à¸šà¸™à¸«à¸™à¹‰à¸²à¸™à¸µà¹‰à¹€à¸¡à¸·à¹ˆà¸­à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸¡à¸²à¸–à¸¶à¸‡</span></section>`
    : liveOverviewState.error
      ? `<section class="alert warn"><strong>à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸£à¸´à¸‡à¸¡à¸²à¹„à¸¡à¹ˆà¸„à¸£à¸šà¸—à¸¸à¸à¸ªà¹ˆà¸§à¸™</strong><span>${h(liveOverviewState.error)}</span><button class="ghost-button sm" id="liveRetry">à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆ</button></section>`
      : !daily.length && !operations.length && !quality.length
        ? `<section class="alert warn"><strong>à¹„à¸¡à¹ˆà¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹ƒà¸™à¸Šà¹ˆà¸§à¸‡ ${h(rangeLabel())}</strong><span>à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸­à¸²à¸ˆà¸­à¸¢à¸¹à¹ˆà¸à¹ˆà¸­à¸™à¸Šà¹ˆà¸§à¸‡à¸§à¸±à¸™à¸—à¸µà¹ˆà¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸ à¸¥à¸­à¸‡à¸‚à¸¢à¸²à¸¢à¸Šà¹ˆà¸§à¸‡à¸¢à¹‰à¸­à¸™à¸«à¸¥à¸±à¸‡ à¸«à¸£à¸·à¸­à¹€à¸›à¸´à¸”à¸„à¸¥à¸±à¸‡à¹„à¸Ÿà¸¥à¹Œà¹€à¸žà¸·à¹ˆà¸­à¸•à¸£à¸§à¸ˆà¸§à¸±à¸™à¸—à¸µà¹ˆà¸ˆà¸²à¸à¹€à¸¡à¸¥à¸ˆà¸£à¸´à¸‡</span><button class="ghost-button sm" id="expandDateRange">à¸‚à¸¢à¸²à¸¢à¸¢à¹‰à¸­à¸™à¸«à¸¥à¸±à¸‡ 90 à¸§à¸±à¸™</button><button class="ghost-button sm" data-goto="cloud">à¹€à¸›à¸´à¸”à¸„à¸¥à¸±à¸‡à¹„à¸Ÿà¸¥à¹Œ</button></section>`
        : "";

  root.innerHTML = `
    ${loadNotice}
    <section class="status-strip live-status-strip action-tiles">
      <article class="ok" data-action-route="cloud"><span>à¹€à¸¡à¸¥à¹ƒà¸™à¸Šà¹ˆà¸§à¸‡à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸</span><strong>${showMetric(dailyAvailable, totalMail)}</strong><small>${dailyAvailable ? `${num(totalFiles)} à¹„à¸Ÿà¸¥à¹Œ Â· à¸­à¹ˆà¸²à¸™à¹à¸¥à¹‰à¸§ ${num(parsedFiles)}` : "à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹€à¸¡à¸¥à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸£à¹‰à¸­à¸¡"} Â· à¸à¸”à¸”à¸¹à¹„à¸Ÿà¸¥à¹Œ</small></article>
      <article class="ok" data-action-route="daily-summary"><span>à¸£à¸°à¸šà¸šà¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¹€à¸ªà¸£à¹‡à¸ˆ</span><strong>${showMetric(qualityAvailable, completed)}</strong><small>à¸ˆà¸³à¸™à¸§à¸™à¸‡à¸²à¸™à¸£à¸²à¸¢à¸§à¸±à¸™/à¸šà¸£à¸´à¸©à¸±à¸— Â· à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸à¸²à¸£à¸¢à¸·à¸™à¸¢à¸±à¸™à¸ˆà¸²à¸ Audit</small></article>
      <article class="warn" data-action-route="daily-summary"><span>à¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š</span><strong>${showMetric(qualityAvailable, needsReview)}</strong><small>${qualityAvailable ? "à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸¡à¸²à¹à¸¥à¹‰à¸§à¹à¸•à¹ˆà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸„à¸£à¸š" : "à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸£à¹‰à¸­à¸¡"} Â· à¸à¸”à¸”à¸¹à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸‚à¸²à¸”</small></article>
      <article class="bad" data-action-route="cloud"><span>à¸£à¸­à¹„à¸Ÿà¸¥à¹Œ / à¸¥à¹‰à¸¡à¹€à¸«à¸¥à¸§</span><strong>${showMetric(qualityAvailable, waiting + failed)}</strong><small>${qualityAvailable ? `à¸£à¸­ ${num(waiting)} Â· à¸¥à¹‰à¸¡à¹€à¸«à¸¥à¸§ ${num(failed)}` : "à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸£à¹‰à¸­à¸¡"} Â· à¸à¸”à¹à¸à¹‰à¹„à¸Ÿà¸¥à¹Œ</small></article>
      <article class="bad" data-action-route="exceptions"><span>à¹€à¸„à¸ªà¸—à¸µà¹ˆà¸£à¸°à¸šà¸šà¸•à¸£à¸§à¸ˆà¸žà¸š</span><strong>${showMetric(qualityAvailable, exceptionTotal)}</strong><small>${!qualityAvailable ? "à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸£à¹‰à¸­à¸¡" : liveOverviewState.auxiliaryLoading ? "à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸«à¸¥à¸±à¸à¸žà¸£à¹‰à¸­à¸¡à¹à¸¥à¹‰à¸§ Â· à¸à¸³à¸¥à¸±à¸‡à¹€à¸•à¸´à¸¡à¸¢à¸­à¸”à¹€à¸ªà¸µà¹ˆà¸¢à¸‡" : !liveOverviewState.exceptionsReady ? "à¸¢à¸­à¸”à¹€à¸ªà¸µà¹ˆà¸¢à¸‡à¸¢à¸±à¸‡à¹‚à¸«à¸¥à¸”à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ" : `à¸¢à¸­à¸”à¹€à¸ªà¸µà¹ˆà¸¢à¸‡à¹€à¸‰à¸žà¸²à¸° ${num(exceptions.length)} à¹€à¸„à¸ªà¸—à¸µà¹ˆà¹‚à¸«à¸¥à¸” ${money0(risk)} à¸šà¸²à¸— Â· à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸¢à¸­à¸”à¸£à¸§à¸¡à¸—à¸±à¹‰à¸‡à¸£à¸°à¸šà¸š`} Â· à¸à¸”à¸•à¸£à¸§à¸ˆà¹€à¸„à¸ª</small></article>
    </section>

    <section class="panel manual-followup-panel" aria-labelledby="manualFollowupTitle">
      <div class="panel-heading"><div><p class="eyebrow">à¹„à¸¡à¹ˆà¸¥à¸·à¸¡à¸¢à¸·à¸™à¸¢à¸±à¸™à¸œà¸¥à¸£à¸±à¸™à¸¡à¸·à¸­</p><h2 id="manualFollowupTitle">à¸œà¸¥à¸£à¸±à¸™à¸¡à¸·à¸­à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸—à¸³à¸•à¹ˆà¸­ ${manualFollowupReady?`(${num(manualFollowups.length)})`:''}</h2><small class="head-sub">à¸•à¸²à¸¡à¸šà¸£à¸´à¸©à¸±à¸—à¹à¸¥à¸°à¸Šà¹ˆà¸§à¸‡à¸§à¸±à¸™à¸—à¸µà¹ˆà¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸ Â· à¹à¸ªà¸”à¸‡à¸£à¸­à¸šà¸¥à¹ˆà¸²à¸ªà¸¸à¸”à¸‚à¸­à¸‡à¹à¸•à¹ˆà¸¥à¸°à¸‚à¸­à¸šà¹€à¸‚à¸• Â· à¹€à¸›à¸´à¸”à¸—à¸šà¸—à¸§à¸™à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ à¹„à¸¡à¹ˆà¸¢à¸·à¸™à¸¢à¸±à¸™à¸«à¸£à¸·à¸­à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸œà¸¥à¸«à¸¥à¸±à¸à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´</small></div></div>
      ${!manualFollowupReady?'<p role="status">à¸¢à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸ªà¸–à¸²à¸™à¸°à¸£à¸²à¸¢à¸‡à¸²à¸™à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ à¸à¸£à¸¸à¸“à¸²à¸£à¸µà¹€à¸Ÿà¸£à¸Š à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸«à¸¡à¸²à¸¢à¸„à¸§à¸²à¸¡à¸§à¹ˆà¸²à¹„à¸¡à¹ˆà¸¡à¸µà¸‡à¸²à¸™à¸„à¹‰à¸²à¸‡</p>':''}
      ${manualFollowupErrors.map(e=>`<p role="alert">${h(e)} Â· à¸£à¸²à¸¢à¸à¸²à¸£à¸­à¸²à¸ˆà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸„à¸£à¸š</p>`).join('')}
${manualFollowups.map(q=>`<article class="manual-followup-item"><div><strong>${h(q.company)} Â· ${h(q.business_date)}</strong><p>${q.status==='ready'?'à¸£à¸±à¸™à¸¡à¸·à¸­à¸ªà¸³à¹€à¸£à¹‡à¸ˆ Â· à¸£à¸­à¸«à¸±à¸§à¸«à¸™à¹‰à¸²/à¸œà¸¹à¹‰à¸”à¸¹à¹à¸¥à¸¢à¸·à¸™à¸¢à¸±à¸™à¸£à¸²à¸¢à¸‡à¸²à¸™':'à¸¢à¸·à¸™à¸¢à¸±à¸™à¸£à¸²à¸¢à¸‡à¸²à¸™à¹à¸¥à¹‰à¸§ Â· à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹ƒà¸Šà¹‰à¹€à¸›à¹‡à¸™à¸œà¸¥à¸«à¸¥à¸±à¸'}</p><small>${h(q.account==='ALL'?'à¸—à¸¸à¸à¸šà¸±à¸à¸Šà¸µ':q.account)} Â· ${h({all:'à¸à¸²à¸à¹à¸¥à¸°à¸–à¸­à¸™',deposit:'à¸à¸²à¸',withdraw:'à¸–à¸­à¸™'}[q.direction]||q.direction)} Â· à¸£à¸±à¸™à¹€à¸¡à¸·à¹ˆà¸­ ${h(displayTime(q.created_at))}</small>${q.account!=='ALL'||q.direction!=='all'?'<small class="sub">à¸£à¸²à¸¢à¸‡à¸²à¸™à¹€à¸‰à¸žà¸²à¸°à¸‚à¸­à¸šà¹€à¸‚à¸•: à¸¢à¸·à¸™à¸¢à¸±à¸™à¹€à¸à¹‡à¸šà¹€à¸›à¹‡à¸™à¸£à¸²à¸¢à¸‡à¸²à¸™à¹à¸¢à¸à¹„à¸”à¹‰ à¹à¸•à¹ˆà¹ƒà¸Šà¹‰à¹à¸—à¸™à¸œà¸¥à¸«à¸¥à¸±à¸à¸—à¸±à¹‰à¸‡à¸šà¸£à¸´à¸©à¸±à¸—à¹„à¸¡à¹ˆà¹„à¸”à¹‰</small>':''}</div>${['lead','admin'].includes(state.role)&&canAccessCompany(q.company)?`<button class="primary-button" data-manual-followup="${h(q.id)}">${q.status==='ready'?'à¸—à¸šà¸—à¸§à¸™à¹à¸¥à¸°à¸¢à¸·à¸™à¸¢à¸±à¸™à¸£à¸²à¸¢à¸‡à¸²à¸™':q.account!=='ALL'||q.direction!=='all'?'à¹€à¸›à¸´à¸”à¸£à¸²à¸¢à¸‡à¸²à¸™à¹€à¸‰à¸žà¸²à¸°à¸‚à¸­à¸šà¹€à¸‚à¸•':'à¸—à¸šà¸—à¸§à¸™à¹ƒà¸Šà¹‰à¹€à¸›à¹‡à¸™à¸œà¸¥à¸«à¸¥à¸±à¸'}</button>`:'<small>à¹ƒà¸«à¹‰à¸«à¸±à¸§à¸«à¸™à¹‰à¸²/à¸œà¸¹à¹‰à¸”à¸¹à¹à¸¥à¹ƒà¸™à¸šà¸£à¸´à¸©à¸±à¸—à¸™à¸µà¹‰à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£</small>'}</article>`).join('')}
      ${manualFollowupReady&&!manualFollowups.length&&!manualFollowupErrors.length?'<p class="empty">à¹„à¸¡à¹ˆà¸žà¸šà¸œà¸¥à¸£à¸±à¸™à¸¡à¸·à¸­à¸—à¸µà¹ˆà¸£à¸­à¸¢à¸·à¸™à¸¢à¸±à¸™à¸«à¸£à¸·à¸­à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹ƒà¸Šà¹‰à¹€à¸›à¹‡à¸™à¸œà¸¥à¸«à¸¥à¸±à¸à¹ƒà¸™à¸‚à¸­à¸šà¹€à¸‚à¸•à¸™à¸µà¹‰</p>':''}
    </section>

    <section class="action-overview">
      <div><p class="eyebrow">à¸ªà¸£à¸¸à¸›à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸—à¸³</p><h2>${!qualityAvailable ? "à¸à¸³à¸¥à¸±à¸‡à¸£à¸­à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸ˆà¸£à¸´à¸‡" : needsReview + waiting + failed ? `à¸¡à¸µ ${num(needsReview + waiting + failed)} à¸‡à¸²à¸™à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸•à¸²à¸¡` : "à¸•à¸£à¸§à¸ˆà¸œà¸¥à¹à¸¥à¸°à¸à¸²à¸£à¸¢à¸·à¸™à¸¢à¸±à¸™à¸‚à¸­à¸‡ Audit à¸•à¹ˆà¸­à¹ƒà¸™à¸«à¸™à¹‰à¸²à¸£à¸²à¸¢à¸à¸²à¸£"}</h2><p>${!qualityAvailable ? "à¸£à¸°à¸šà¸šà¹„à¸¡à¹ˆà¸ªà¸£à¸¸à¸›à¹€à¸›à¹‡à¸™à¸¨à¸¹à¸™à¸¢à¹Œà¸ˆà¸™à¸à¸§à¹ˆà¸²à¸ˆà¸°à¸­à¹ˆà¸²à¸™à¸œà¸¥à¸ˆà¸£à¸´à¸‡à¸ªà¸³à¹€à¸£à¹‡à¸ˆ" : `${waiting ? `à¸£à¸­à¹„à¸Ÿà¸¥à¹Œ ${num(waiting)} à¸‡à¸²à¸™ Â· ` : ""}${needsReview ? `à¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆ ${num(needsReview)} à¸‡à¸²à¸™ Â· ` : ""}${failed ? `à¸¥à¹‰à¸¡à¹€à¸«à¸¥à¸§ ${num(failed)} à¸‡à¸²à¸™` : "à¹„à¸¡à¹ˆà¸žà¸šà¸‡à¸²à¸™à¸¥à¹‰à¸¡à¹€à¸«à¸¥à¸§"}`}${liveOverviewState.auxiliaryLoading ? " Â· à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”à¹€à¸šà¸·à¹‰à¸­à¸‡à¸«à¸¥à¸±à¸‡" : ""}${liveOverviewState.auxiliaryError ? ` Â· ${h(liveOverviewState.auxiliaryError)}` : ""}</p></div>
      <div class="inline-actions"><button class="primary-button" data-goto="daily-summary">à¸ªà¸£à¸¸à¸› 1 à¸šà¸£à¸´à¸©à¸±à¸—/à¸§à¸±à¸™</button><button class="ghost-button" data-goto="cloud">à¸”à¸¹à¹€à¸¡à¸¥à¹à¸¥à¸°à¹„à¸Ÿà¸¥à¹Œ</button><button class="ghost-button" data-goto="exceptions">à¸”à¸¹ Exception</button><button class="ghost-button" id="liveRefresh">à¸£à¸µà¹€à¸Ÿà¸£à¸Šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥</button></div>
    </section>

    <section class="period-banner">
      <div><p class="eyebrow">à¸£à¸­à¸šà¸›à¸à¸´à¸šà¸±à¸•à¸´à¸‡à¸²à¸™à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™</p><h2>à¹€à¸£à¸´à¹ˆà¸¡à¸•à¸£à¸§à¸ˆà¹ƒà¸«à¸¡à¹ˆà¸•à¸±à¹‰à¸‡à¹à¸•à¹ˆ ${h(activeStart)}</h2><p>à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸–à¸¶à¸‡ ${h(historyCutoff)} à¸–à¸¹à¸à¹€à¸à¹‡à¸šà¹„à¸§à¹‰à¹€à¸›à¹‡à¸™à¸›à¸£à¸°à¸§à¸±à¸•à¸´ à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸¥à¸š à¹à¸¥à¸°à¹„à¸¡à¹ˆà¸›à¸™à¸à¸±à¸šà¸„à¸´à¸§à¸‡à¸²à¸™à¸£à¸­à¸šà¹ƒà¸«à¸¡à¹ˆ</p></div>
      <button class="ghost-button" id="openHistory">à¸”à¸¹à¸›à¸£à¸°à¸§à¸±à¸•à¸´ 1â€“23 à¸ª.à¸„.</button>
    </section>

    <section class="panel operating-timeline">
      <div class="panel-heading"><div><p class="eyebrow">à¸£à¸­à¸šà¸‡à¸²à¸™à¸›à¸£à¸°à¸ˆà¸³à¸§à¸±à¸™</p><h2>${h(checklist[0]?.workflow_phase_label || "à¸•à¸´à¸”à¸•à¸²à¸¡à¸•à¸²à¸¡à¹€à¸§à¸¥à¸²à¸›à¸à¸´à¸šà¸±à¸•à¸´à¸‡à¸²à¸™")}</h2><small class="head-sub">à¸£à¸°à¸šà¸šà¸ˆà¸°à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹à¸ˆà¹‰à¸‡à¸§à¹ˆà¸²à¸‚à¸²à¸”à¹„à¸Ÿà¸¥à¹Œà¸à¹ˆà¸­à¸™à¸ªà¸´à¹‰à¸™à¸ªà¸¸à¸”à¸Šà¹ˆà¸§à¸‡à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œ 08:00 à¸™.</small></div><span class="badge blue">à¹€à¸§à¸¥à¸²à¹„à¸—à¸¢</span></div>
      <div class="operating-timeline-grid">
        <article><b>05:00â€“08:00</b><span>à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œà¸•à¸£à¸§à¸ˆà¸ˆà¸²à¸à¹à¸­à¸”à¸¡à¸´à¸™</span></article>
        <article><b>08:00â€“17:00</b><span>à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸°à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”</span></article>
        <article><b>17:00</b><span>à¸ªà¹ˆà¸‡à¹€à¸„à¸ªà¹ƒà¸«à¹‰à¹à¸­à¸”à¸¡à¸´à¸™à¸Šà¸µà¹‰à¹à¸ˆà¸‡</span></article>
        <article><b>17:00â€“19:00</b><span>à¸­à¸±à¸›à¹‚à¸«à¸¥à¸”à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸­à¸­à¸”à¸´à¸—à¹€à¸ªà¸£à¹‡à¸ˆ</span></article>
        <article><b>à¸«à¸¥à¸±à¸‡ 19:00</b><span>à¸•à¸´à¸”à¸•à¸²à¸¡à¸—à¸µà¸¡à¸­à¸­à¸”à¸´à¸—à¸«à¸²à¸à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸­à¸±à¸›à¹‚à¸«à¸¥à¸”</span></article>
      </div>
    </section>

    <section class="panel daily-checklist-panel">
<div class="panel-heading"><div><p class="eyebrow">Checklist à¸£à¸²à¸¢à¸šà¸£à¸´à¸©à¸±à¸—</p><h2>à¸§à¸±à¸™à¸—à¸µà¹ˆ ${h(checklistDate)} Â· à¸„à¸£à¸šà¸—à¸±à¹‰à¸‡ 9 à¸šà¸£à¸´à¸©à¸±à¸—</h2><small class="head-sub">à¸£à¸°à¸šà¸šà¸­à¹ˆà¸²à¸™ BO à¸à¹ˆà¸­à¸™à¹€à¸žà¸·à¹ˆà¸­à¸£à¸¹à¹‰à¸šà¸±à¸à¸Šà¸µ/Provider à¸—à¸µà¹ˆà¹ƒà¸Šà¹‰à¸ˆà¸£à¸´à¸‡ à¹à¸¥à¹‰à¸§à¸ˆà¸¶à¸‡à¸•à¸£à¸§à¸ˆ STM/PM à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸ªà¹ˆà¸‡ Â· à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œà¹€à¸­à¸à¸ªà¸²à¸£à¹à¸¥à¸°à¸à¸²à¸£à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¹€à¸›à¹‡à¸™à¸£à¸­à¸šà¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´ Â· à¸œà¸¥à¸«à¸¥à¸±à¸à¹à¸¥à¸°à¸œà¸¥à¸£à¸±à¸™à¸¡à¸·à¸­à¹à¸ªà¸”à¸‡à¹à¸¢à¸à¹ƒà¸™à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œà¸ªà¸–à¸²à¸™à¸°</small></div><span class="health ${checklist.some((row) => !row.primaryResult && !["completed", "scheduled", "receiving"].includes(row.checklist_status)) ? "attention" : "ok"}">${num(checklist.filter((row) => row.primaryResult || row.checklist_status === "completed").length)}/${num(checklist.length || 9)} à¸šà¸£à¸´à¸©à¸±à¸—à¸—à¸µà¹ˆà¸£à¸°à¸šà¸šà¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¹€à¸ªà¸£à¹‡à¸ˆ</span></div>
      <div class="table-wrap"><table class="checklist-table"><thead><tr><th>à¸šà¸£à¸´à¸©à¸±à¸— / à¸£à¸°à¸šà¸š</th><th>à¹€à¸¡à¸¥ / à¹„à¸Ÿà¸¥à¹Œ</th><th>STM à¸•à¸²à¸¡ BO</th><th>BO à¸—à¸µà¹ˆà¸£à¸±à¸š / à¸•à¹‰à¸­à¸‡à¸¡à¸µ</th><th>PM à¸•à¸²à¸¡ BO</th><th>à¸šà¸±à¸à¸Šà¸µ/Provider à¸—à¸µà¹ˆ BO à¸£à¸°à¸šà¸¸</th><th>à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œ</th><th>à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸” / à¹€à¸„à¸ª</th><th>à¸ªà¸–à¸²à¸™à¸°</th></tr></thead><tbody>
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
          const boIdentities = requiredCoverage.map((item) => `${item.label || item.identity}${item.direction && item.direction !== "unknown" ? ` ${item.direction === "deposit" ? "à¸à¸²à¸" : "à¸–à¸­à¸™"}` : ""}`);
          const providers = coverage ? (boIdentities.join(", ") || "BO à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸²à¸¢à¸à¸²à¸£à¹ƒà¸Šà¹‰à¸‡à¸²à¸™") : "à¸£à¸­à¸­à¹ˆà¸²à¸™ BO";
          const inactiveProviders = Array.isArray(row.inactive_pm_providers) ? row.inactive_pm_providers.join(", ") : "";
          const pendingProviders = Array.isArray(row.pending_registry_pm_providers) ? row.pending_registry_pm_providers.join(", ") : "";
          const providerNotes = `${!coverage && inactiveProviders ? `<small class="sub">à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸šà¹ƒà¸Šà¹‰: ${h(inactiveProviders)}</small>` : ""}${pendingProviders ? `<small class="sub registry-note">à¸Šà¸·à¹ˆà¸­à¸£à¸­à¸¢à¸·à¸™à¸¢à¸±à¸™à¹ƒà¸™à¸Šà¸µà¸•: ${h(pendingProviders)}</small>` : ""}`;
          const boFirstMissing = missingCoverage.map((item) => `à¸‚à¸²à¸” ${item.kind} ${item.label || item.identity}${item.direction && item.direction !== "unknown" ? ` ${item.direction === "deposit" ? "à¸à¸²à¸" : "à¸–à¸­à¸™"}` : ""}`);
          const pending = () => checklistMark(false, "à¸£à¸­à¸§à¸±à¸™à¸—à¸³à¸à¸²à¸£", true);
return `<tr class="checklist-row" data-check-date="${h(row.business_date)}" data-check-company="${h(row.company)}"><td><b>${h(row.display_name || row.company)}</b><small class="sub">à¸£à¸°à¸šà¸š ${h(row.business_system || "-")} Â· ${future ? "à¸£à¸­à¹€à¸£à¸´à¹ˆà¸¡à¸§à¸±à¸™à¸—à¸³à¸à¸²à¸£" : `à¸£à¸±à¸šà¸¥à¹ˆà¸²à¸ªà¸¸à¸” ${h(displayTime(row.last_mail_at))}`}</small></td><td>${future ? pending() : checklistMark(Number(row.file_count)>0, `${num(row.mail_count)} à¹€à¸¡à¸¥ Â· ${num(row.file_count)} à¹„à¸Ÿà¸¥à¹Œ`)}</td><td>${future ? pending() : coverage ? checklistMark(stmCoverage.missing.length === 0, `${num(stmCoverage.received)}/${num(stmCoverage.required.length)} à¸à¸¥à¸¸à¹ˆà¸¡`) : checklistMark(false, "à¸£à¸­à¸­à¹ˆà¸²à¸™ BO", true)}</td><td>${future ? pending() : checklistMark(boOk, `${num(row.bo_count)}/${num(boExpected)} à¹„à¸Ÿà¸¥à¹Œ`)}</td><td>${future ? pending() : coverage ? checklistMark(pmCoverage.missing.length === 0, `${num(pmCoverage.received)}/${num(pmCoverage.required.length)} à¸à¸¥à¸¸à¹ˆà¸¡`) : checklistMark(false, "à¸£à¸­à¸­à¹ˆà¸²à¸™ BO", true)}</td><td><small>${h(providers)}</small>${providerNotes}</td><td>${future ? pending() : checklistMark(parsedOk, Number(row.error_count) ? `à¸­à¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰ ${num(row.error_count)}` : `${num(row.parsed_count)}/${num(reconFileCount)}`)}</td><td>${future ? pending() : checklistMark((resultStatus.primary || row.job_status==="completed") && currentOpen===0, resultStatus.primary || row.job_status==="completed" ? `à¸ˆà¸±à¸šà¸„à¸¹à¹ˆ ${num(resultStatus.primary?.report?.matched ?? row.matched_count)} Â· à¸„à¹‰à¸²à¸‡ ${num(currentOpen)}` : (LIVE_STATUS[row.job_status]?.label || "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸£à¸±à¸™"))}</td><td><span class="badge ${status.tone}">${h(status.label)}</span><small class="sub">${h(resultStatus.automatic)}</small>${!future && boFirstMissing.length ? `<small class="sub danger">${h(boFirstMissing.join(" Â· "))}</small>` : !future && Array.isArray(row.missing_items) && row.missing_items.length ? `<small class="sub danger">${h(cloudMissingGroupsText(row.missing_items))}</small>` : ""}${row.registry_warning ? `<small class="sub registry-note">à¸—à¸°à¹€à¸šà¸µà¸¢à¸™: ${h(row.registry_warning)}</small>` : ""}</td></tr>`;
        }).join("") || `<tr><td colspan="9" class="empty">à¸à¸³à¸¥à¸±à¸‡à¹€à¸•à¸£à¸µà¸¢à¸¡à¹€à¸Šà¹‡à¸à¸¥à¸´à¸ªà¸•à¹Œà¸£à¸­à¸šà¹ƒà¸«à¸¡à¹ˆ</td></tr>`}
      </tbody></table></div>
      <p class="hint">à¸à¸”à¹à¸–à¸§à¸šà¸£à¸´à¸©à¸±à¸—à¹€à¸žà¸·à¹ˆà¸­à¹€à¸›à¸´à¸”à¸ªà¸£à¸¸à¸› 1 à¸šà¸£à¸´à¸©à¸±à¸— 1 à¸§à¸±à¸™ Â· à¸£à¸°à¸šà¸šà¸­à¹ˆà¸²à¸™à¸šà¸±à¸à¸Šà¸µà¸—à¸µà¹ˆà¹ƒà¸Šà¹‰à¸ˆà¸£à¸´à¸‡à¸ˆà¸²à¸ BO/à¸£à¸²à¸¢à¸‡à¸²à¸™à¸à¸²à¸-à¸–à¸­à¸™ à¹à¸¥à¹‰à¸§à¸•à¸£à¸§à¸ˆà¸«à¸² STM/PM à¸„à¸¹à¹ˆà¸à¸±à¸™ à¸ªà¹ˆà¸§à¸™ BO à¸•à¸£à¸§à¸ˆà¸•à¸²à¸¡à¸à¸Ž 1 à¸«à¸£à¸·à¸­ 2 à¹„à¸Ÿà¸¥à¹Œà¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´</p>
    </section>

    <section class="grid-2 live-main-grid company-rule-layout">
      <div class="panel company-group-panel">
        <div class="panel-heading"><div><p class="eyebrow">à¸šà¸£à¸´à¸©à¸±à¸—à¹à¸¥à¸°à¸£à¸°à¸šà¸š</p><h2>3 à¹€à¸„à¸£à¸·à¸­à¸šà¸£à¸´à¸©à¸±à¸— Â· à¹à¸¢à¸à¸šà¸£à¸´à¸©à¸±à¸—à¸¢à¹ˆà¸­à¸¢</h2><small class="head-sub">à¸à¸”à¸Šà¸·à¹ˆà¸­à¸šà¸£à¸´à¸©à¸±à¸—à¹€à¸žà¸·à¹ˆà¸­à¹€à¸›à¸´à¸”à¸ªà¸£à¸¸à¸›à¸£à¸²à¸¢à¸§à¸±à¸™à¸‚à¸­à¸‡à¸šà¸£à¸´à¸©à¸±à¸—à¸™à¸±à¹‰à¸™</small></div><span class="health ${needsReview + waiting ? "attention" : "ok"}">${num(AUDIT_COMPANY_GROUPS.length)} à¹€à¸„à¸£à¸·à¸­</span></div>
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
              <div class="company-group-head"><div><strong>${h(group.name)}</strong><span>${num(group.companies.length)} à¸šà¸£à¸´à¸©à¸±à¸—</span></div><span class="badge ${group.status === "active" ? "green" : "grey"}">${group.status === "active" ? "à¹ƒà¸Šà¹‰à¸à¸Žà¹à¸¥à¹‰à¸§" : "à¸£à¸­à¹€à¸‡à¸·à¹ˆà¸­à¸™à¹„à¸‚"}</span></div>
              <div class="company-subcompany-list">${members.map(({ code, data }) => `<button type="button" class="company-subcompany ${data ? "has-data" : ""}" data-summary-company="${h(code)}" data-summary-date="${h(data?.latest || latestCompanyDate(group.companies))}"><span><b>${h(code)}</b><small>${data ? `à¸¥à¹ˆà¸²à¸ªà¸¸à¸” ${h(data.latest)}` : "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸šà¸‡à¸²à¸™à¹ƒà¸™à¸Šà¹ˆà¸§à¸‡à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸"}</small></span><i>${data ? `à¸ªà¸³à¹€à¸£à¹‡à¸ˆ ${num(data.completed)} Â· à¸•à¸£à¸§à¸ˆ ${num(data.review)} Â· à¸£à¸­ ${num(data.waiting + data.error)}` : "à¹€à¸›à¸´à¸”à¸”à¸¹à¸šà¸£à¸´à¸©à¸±à¸—"}</i></button>`).join("")}</div>
              ${group.status === "active" ? `<details class="company-rule-details" open><summary>à¹€à¸‡à¸·à¹ˆà¸­à¸™à¹„à¸‚à¸•à¸£à¸§à¸ˆà¸‚à¸­à¸‡${h(group.name)}</summary><ol>${group.rules.map((rule) => `<li>${h(rule)}</li>`).join("")}</ol><p>à¹ƒà¸Šà¹‰à¸à¸±à¸š ${num(group.companies.length)} à¸šà¸£à¸´à¸©à¸±à¸—à¹ƒà¸™à¸à¸¥à¸¸à¹ˆà¸¡à¸™à¸µà¹‰ Â· à¸«à¸²à¸à¸«à¸¥à¸±à¸à¸à¸²à¸™à¹„à¸¡à¹ˆà¸„à¸£à¸šà¸«à¸£à¸·à¸­à¸¡à¸µà¸«à¸¥à¸²à¸¢à¸„à¸¹à¹ˆ à¸£à¸°à¸šà¸šà¸•à¹‰à¸­à¸‡à¸„à¸‡à¹€à¸„à¸ªà¹ƒà¸«à¹‰ Audit à¸•à¸£à¸§à¸ˆ</p></details>` : `<div class="company-group-pending"><b>à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹€à¸›à¸´à¸”à¸à¸Žà¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´</b><span>à¸£à¸­à¹€à¸‡à¸·à¹ˆà¸­à¸™à¹„à¸‚à¸ˆà¸²à¸ Audit à¹à¸¥à¸°à¸ˆà¸°à¹„à¸¡à¹ˆà¹ƒà¸Šà¹‰à¸à¸Žà¸‚à¸­à¸‡à¸à¸¥à¸¸à¹ˆà¸¡à¸­à¸·à¹ˆà¸™à¹à¸—à¸™</span></div>`}
              <div class="company-group-totals"><span class="ok">à¸ªà¸³à¹€à¸£à¹‡à¸ˆ <b>${num(totals.completed)}</b></span><span class="warn">à¸•à¸£à¸§à¸ˆ <b>${num(totals.review)}</b></span><span class="bad">à¸£à¸­/à¸žà¸¥à¸²à¸” <b>${num(totals.waiting)}</b></span></div>
            </article>`;
          }).join("")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">à¸¥à¸±à¸à¸©à¸“à¸°à¸‡à¸²à¸™à¸ˆà¸²à¸à¹€à¸¡à¸¥</p><h2>à¹€à¸¡à¸¥à¸—à¸µà¹ˆà¹„à¸”à¹‰à¸£à¸±à¸šà¹€à¸›à¹‡à¸™à¸‡à¸²à¸™à¸›à¸£à¸°à¹€à¸ à¸—à¹ƒà¸”</h2></div></div>
        <div class="behavior-list">${behaviorGroups.map((x) => `<div><span class="badge ${x.tone}">${h(x.label)}</span><b>${num(x.value)}</b><small>à¸Šà¸¸à¸”à¸‡à¸²à¸™</small></div>`).join("")}</div>
        <p class="hint">â€œà¸à¸²à¸-à¸–à¸­à¸™à¸˜à¸™à¸²à¸„à¸²à¸£â€ à¸ˆà¸±à¸”à¹€à¸›à¹‡à¸™ STM à¸•à¸²à¸¡à¸à¸•à¸´à¸à¸²à¸‚à¸­à¸‡à¸—à¸µà¸¡ à¸ªà¹ˆà¸§à¸™à¸žà¸¤à¸•à¸´à¸à¸£à¸£à¸¡à¸£à¸²à¸¢à¸à¸²à¸£à¸à¸²à¸/à¸–à¸­à¸™à¸£à¸²à¸¢à¸šà¸¸à¸„à¸„à¸¥à¸ˆà¸°à¹à¸ªà¸”à¸‡à¸«à¸¥à¸±à¸‡à¸£à¸°à¸šà¸šà¸­à¹ˆà¸²à¸™à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹ƒà¸™à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸°à¸ªà¸£à¹‰à¸²à¸‡ Exception à¹à¸¥à¹‰à¸§</p>
        <div class="exception-summary">
          <h3>à¸ªà¸²à¹€à¸«à¸•à¸¸ Exception à¸—à¸µà¹ˆà¸žà¸šà¸¡à¸²à¸</h3>
          ${typeSummary.map(([label, value]) => `<div><span>${h(label)}</span><b>${num(value)}</b></div>`).join("") || `<p class="empty">à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µ Exception à¹ƒà¸™à¸Šà¹ˆà¸§à¸‡à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸</p>`}
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-heading"><div><p class="eyebrow">à¸£à¸²à¸¢à¸à¸²à¸£à¸¥à¹ˆà¸²à¸ªà¸¸à¸”</p><h2>à¸ªà¸–à¸²à¸™à¸°à¸£à¸²à¸¢à¸§à¸±à¸™à¹à¸¢à¸à¸šà¸£à¸´à¸©à¸±à¸—</h2><small class="head-sub">à¸­à¸±à¸›à¹€à¸”à¸• ${liveOverviewState.updatedAt ? displayTime(liveOverviewState.updatedAt) : "-"}</small></div><span class="health ok">à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸£à¸´à¸‡ Supabase</span></div>
      <div class="table-wrap"><table class="live-table">
        <thead><tr><th>à¸§à¸±à¸™à¸—à¸µà¹ˆ</th><th>à¸šà¸£à¸´à¸©à¸±à¸— / à¸£à¸°à¸šà¸š</th><th>à¸ªà¸–à¸²à¸™à¸°</th><th class="right">à¹„à¸Ÿà¸¥à¹Œ</th><th>à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸¢à¸±à¸‡à¸‚à¸²à¸”</th><th>à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”</th></tr></thead>
        <tbody>${recent.map((row) => {
          const checklistRow = checklistByCompanyDate.get(`${row.business_date}|${String(row.company || "").toUpperCase()}`);
          const lifecycle = currentCountsByCompanyDate.get(`${row.business_date}|${String(row.company || "").toUpperCase()}`);
          const rowStatus = row.status === "completed" && Number(lifecycle?.open_count || 0) > 0 ? "completed_review" : row.status;
          const resultStatus = dailyResultStatus(checklistRow||{},row);
          const status = resultStatus.primary ? {label:resultStatus.label,tone:'green'} : resultStatus.manual ? {label:resultStatus.manual,tone:'blue'} : LIVE_STATUS[rowStatus] || { label: rowStatus || "à¹„à¸¡à¹ˆà¸—à¸£à¸²à¸š", tone: "grey" };
return `<tr class="action-row" data-summary-company="${h(row.company)}" data-summary-date="${h(row.business_date)}" role="link" tabindex="0"><td><b>${h(row.business_date)}</b></td><td><b>${h(row.company)}</b><small class="sub">${h(row.business_system || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸£à¸°à¸šà¸š")}</small></td><td><span class="badge ${status.tone}">${h(status.label)}</span><small class="sub">${h(resultStatus.automatic)}</small>${resultStatus.review?`<small class="sub danger">${h(resultStatus.review)}</small>`:''}${resultStatus.error?`<small class="sub danger">${h(resultStatus.error)}</small>`:''}${resultStatus.primary&&resultStatus.manual?`<small class="sub">${h(resultStatus.manual)}</small>`:''}</td><td class="right tnum">à¸£à¸±à¸šà¹€à¸‚à¹‰à¸² ${num(row.file_count)}${resultStatus.primary?`<small class="sub">à¸œà¸¥à¸«à¸¥à¸±à¸ ${checklistRow?.primaryFileCount==null?'à¸£à¸­à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸³à¸™à¸§à¸™à¹„à¸Ÿà¸¥à¹Œ':num(checklistRow.primaryFileCount)+' à¹„à¸Ÿà¸¥à¹Œ'}</small>`:''}</td><td class="${missingText(row) === "à¸„à¸£à¸š" ? "muted" : "danger"}">${resultStatus.primary?'<b class="success">à¸Šà¸¸à¸”à¸œà¸¥à¸«à¸¥à¸±à¸à¸„à¸£à¸š Â· à¸¢à¸·à¸™à¸¢à¸±à¸™à¹à¸¥à¹‰à¸§</b><small class="sub">à¸£à¸­à¸šà¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´: '+h(missingText(row))+'</small>':h(missingText(row))}</td><td>${row.match_rate == null ? "-" : `${Number(row.match_rate).toFixed(2)}% Â· ${num(currentExceptionCount(row))} à¹€à¸„à¸ªà¸£à¸§à¸¡à¸Šà¸¸à¸”à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™`}${lifecycle?.open_count!=null&&lifecycle?.resolved_count!=null?`<small class="sub">à¸„à¹‰à¸²à¸‡ ${num(lifecycle.open_count)} Â· à¸›à¸´à¸”à¹à¸¥à¹‰à¸§ ${num(lifecycle.resolved_count)}</small>`:'<small class="sub">à¸ªà¸–à¸²à¸™à¸°à¹€à¸„à¸ªà¸£à¸²à¸¢à¸£à¸²à¸¢à¸à¸²à¸£à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸£à¹‰à¸­à¸¡</small>'}</td></tr>`;
        }).join("") || `<tr><td colspan="6" class="empty">à¹„à¸¡à¹ˆà¸¡à¸µà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹ƒà¸™à¸Šà¹ˆà¸§à¸‡à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸</td></tr>`}</tbody>
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
  root.querySelectorAll('[data-manual-followup]').forEach(button=>button.addEventListener('click',async()=>{
    const q=manualFollowups.find(x=>x.id===button.dataset.manualFollowup),actor=Sb.authUser()?.id;
    const allowed=()=>actor===Sb.authUser()?.id&&['lead','admin'].includes(state.role)&&q&&canAccessCompany(q.company);
    if(!allowed())return deny('à¸—à¸šà¸—à¸§à¸™à¸œà¸¥à¸£à¸±à¸™à¸¡à¸·à¸­');
    button.disabled=true;
    try{
      const [items,primary]=await Promise.all([Sb.listAccountRechecks(q.company,q.business_date),Sb.readManualPrimary(q.company,q.business_date)]);
      if(!allowed())throw Error('à¸šà¸±à¸à¸Šà¸µà¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸«à¸£à¸·à¸­à¸ªà¸´à¸—à¸˜à¸´à¹Œà¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™ à¸à¸£à¸¸à¸“à¸²à¹€à¸›à¸´à¸”à¹ƒà¸«à¸¡à¹ˆ');
      if(primary?.stale)throw Error(primary.message);
      const current=manualFollowupItems([{company:q.company,business_date:q.business_date,rechecks:items,primaryResult:primary}]).find(x=>x.id===q.id);
      if(!current)throw Error('à¸£à¸²à¸¢à¸‡à¸²à¸™à¸™à¸µà¹‰à¸¡à¸µà¸ªà¸–à¸²à¸™à¸°à¸«à¸£à¸·à¸­à¸£à¸­à¸šà¹ƒà¸«à¸¡à¹ˆà¹à¸¥à¹‰à¸§ à¸à¸£à¸¸à¸“à¸²à¸£à¸µà¹€à¸Ÿà¸£à¸Š Dashboard');
      openAccountRecheck({company:q.company,date:q.business_date,accounts:[current.account],initialJobId:current.id});
    }catch(error){toast(error.message,'warn');}finally{if(button.isConnected)button.disabled=false;}
  }));
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
      label: "Transactions à¸§à¸±à¸™à¸™à¸µà¹‰",
      value: num(totalTx),
      sub: run ? `à¸à¸±à¹ˆà¸‡à¸˜à¸™à¸²à¸„à¸²à¸£ ${num(run.stmCount)} Â· à¸à¸±à¹ˆà¸‡ BO ${num(run.boCount)}` : "à¸™à¸³à¹€à¸‚à¹‰à¸²à¹à¸¥à¹‰à¸§ 98.7% à¸‚à¸­à¸‡à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸£à¸±à¸š",
      spark: DB.hourly.map((x) => x.total),
      color: Charts.PALETTE.s1,
    },
    {
      label: "Matched (3-point)",
      value: num(matched),
      sub: `à¸­à¸±à¸•à¸£à¸²à¸ˆà¸±à¸šà¸„à¸¹à¹ˆ ${((matched / matchBase) * 100).toFixed(2)}%${run && run.noStmCount ? ` Â· à¸£à¸­à¹„à¸Ÿà¸¥à¹Œà¸˜à¸™à¸²à¸„à¸²à¸£à¸­à¸µà¸ ${num(run.noStmCount)}` : ""}`,
      spark: DB.hourly.map((x) => x.matched),
      color: Charts.PALETTE.s3,
    },
    { label: "Diff / Missing", value: num(totalEx), sub: `à¹€à¸›à¸´à¸”à¸„à¹‰à¸²à¸‡ ${num(ex.filter((e) => !["closed", "approved"].includes(e.status)).length)} à¹€à¸„à¸ªà¹ƒà¸™à¸„à¸´à¸§`, spark: DB.hourly.map((x) => x.exception), color: Charts.PALETTE.s2, tone: "warn" },
    { label: "à¹€à¸à¸´à¸™ SLA", value: num(overSla), sub: "à¸•à¹‰à¸­à¸‡à¹€à¸£à¹ˆà¸‡à¸•à¸´à¸”à¸•à¸²à¸¡à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸§à¸±à¸™à¸™à¸µà¹‰", spark: DB.hourly.map((x) => Math.round(x.exception * 0.3)), color: "#d03b3b", tone: overSla ? "bad" : "" },
    { label: "à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸•à¸£à¸§à¸ˆà¹à¸¥à¹‰à¸§", value: `${filesOk}/${DB.files.length}`, sub: filesBad ? `à¸¢à¸±à¸‡à¸¡à¸µà¸›à¸±à¸à¸«à¸² ${filesBad} à¹„à¸Ÿà¸¥à¹Œ` : "à¸„à¸£à¸šà¸—à¸¸à¸à¹„à¸Ÿà¸¥à¹Œ", color: Charts.PALETTE.s4, tone: filesBad ? "warn" : "" },
  ];

  const byType = DB.exceptionTypes
    .map((t) => ({ label: t.name, value: ex.filter((e) => e.type === t.code).length, code: t.code }))
    .filter((x) => x.value)
    .sort((a, b) => b.value - a.value);
  const bySeverity = DB.severities.map((s) => ({ label: s.name, value: ex.filter((e) => e.severity === s.code).length, color: severityColor(s.code), code: s.code }));
  const byShift = DB.shifts.map((s) => ({ label: `${s.name}\n${s.range}`, value: ex.filter((e) => e.shift === s.code).length, hint: "à¸„à¸¥à¸´à¸à¸à¸£à¸²à¸Ÿà¹€à¸žà¸·à¹ˆà¸­à¸”à¸¹à¸•à¸±à¸§à¹€à¸¥à¸‚à¹€à¸—à¸µà¸¢à¸šà¸à¸±à¸™" }));
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

    <section class="pipeline" aria-label="à¸‚à¸±à¹‰à¸™à¸•à¸­à¸™à¸à¸²à¸£à¸—à¸³à¸‡à¸²à¸™">
      ${["à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œà¸ˆà¸²à¸ Email", "à¸•à¸£à¸§à¸ˆà¸„à¸§à¸²à¸¡à¸„à¸£à¸šà¸–à¹‰à¸§à¸™", "Normalize STM / BO", "3-Point Match", "à¸ªà¹ˆà¸‡à¸Šà¸µà¹‰à¹à¸ˆà¸‡ / à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´", "à¸ªà¸£à¸¸à¸›à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢"]
        .map((s, i) => `<div class="${i < 4 ? "done" : i === 4 ? "active" : ""}"><strong>${i + 1}</strong><span>${h(s)}</span></div>`)
        .join("")}
    </section>

    <section class="grid-2">
      <div class="panel">
        <div class="panel-heading">
          <div><p class="eyebrow">Volume vs Exception</p><h2>à¸£à¸²à¸¢à¸à¸²à¸£à¸•à¹ˆà¸­à¸Šà¸±à¹ˆà¸§à¹‚à¸¡à¸‡</h2></div>
          <span class="health ok">à¸­à¸±à¸›à¹€à¸”à¸•à¸¥à¹ˆà¸²à¸ªà¸¸à¸” 1 à¸Šà¸¡.à¸—à¸µà¹ˆà¹à¸¥à¹‰à¸§</span>
        </div>
        <p class="small-mult-title" style="--dot:${Charts.PALETTE.s1}">à¸›à¸£à¸´à¸¡à¸²à¸“à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”</p>
        <div class="chart" id="chHourly"></div>
        <p class="small-mult-title" style="--dot:${Charts.PALETTE.s2}">à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¹„à¸¡à¹ˆ match (à¸„à¸™à¸¥à¸°à¸ªà¹€à¸à¸¥)</p>
        <div class="chart" id="chHourlyEx"></div>
        <p class="chart-note">à¹à¸¢à¸à¹€à¸›à¹‡à¸™à¸ªà¸­à¸‡à¸à¸£à¸²à¸Ÿà¸—à¸µà¹ˆà¹ƒà¸Šà¹‰à¹à¸à¸™ y à¸‚à¸­à¸‡à¸•à¸±à¸§à¹€à¸­à¸‡ à¹€à¸žà¸£à¸²à¸°à¸ªà¸­à¸‡à¸„à¹ˆà¸²à¸™à¸µà¹‰à¸•à¹ˆà¸²à¸‡à¸ªà¹€à¸à¸¥à¸à¸±à¸™à¸¡à¸²à¸ à¸à¸²à¸£à¹ƒà¸ªà¹ˆà¹à¸à¸™à¸„à¸¹à¹ˆà¹ƒà¸™à¸à¸£à¸²à¸Ÿà¹€à¸”à¸µà¸¢à¸§à¸ˆà¸°à¸­à¹ˆà¸²à¸™à¸œà¸´à¸”à¹„à¸”à¹‰ Â· à¸Šà¹ˆà¸§à¸‡ 22:00-06:00 à¸¡à¸µà¸ªà¸±à¸”à¸ªà¹ˆà¸§à¸™ exception à¸ªà¸¹à¸‡à¸à¸§à¹ˆà¸²à¸Šà¹ˆà¸§à¸‡à¸­à¸·à¹ˆà¸™</p>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Severity</p><h2>à¸£à¸°à¸”à¸±à¸šà¸„à¸§à¸²à¸¡à¸£à¸¸à¸™à¹à¸£à¸‡</h2></div></div>
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
        <p class="chart-note">à¸„à¸¥à¸´à¸à¸—à¸µà¹ˆà¸£à¸°à¸”à¸±à¸šà¹ƒà¸”à¸£à¸°à¸”à¸±à¸šà¸«à¸™à¸¶à¹ˆà¸‡à¹€à¸žà¸·à¹ˆà¸­à¸à¸£à¸­à¸‡ Exception Queue à¸•à¸²à¸¡à¸£à¸°à¸”à¸±à¸šà¸™à¸±à¹‰à¸™à¸—à¸±à¸™à¸—à¸µ Â· à¸£à¸°à¸”à¸±à¸šà¸„à¸§à¸²à¸¡à¸£à¸¸à¸™à¹à¸£à¸‡à¸à¸³à¸«à¸™à¸”à¸ˆà¸²à¸à¸›à¸£à¸°à¹€à¸ à¸— exception à¹à¸¥à¸°à¸¢à¸­à¸” diff à¹‚à¸”à¸¢à¸£à¸°à¸šà¸šà¸ˆà¸°à¸¢à¸à¸£à¸°à¸”à¸±à¸šà¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´à¹€à¸¡à¸·à¹ˆà¸­à¸¢à¸­à¸”à¹€à¸à¸´à¸™ 10,000 à¸šà¸²à¸—</p>
        <div class="sla-mini">
          <div><span>SLA Critical</span><b>4 à¸Šà¸¡.</b></div>
          <div><span>High</span><b>8 à¸Šà¸¡.</b></div>
          <div><span>Medium</span><b>48 à¸Šà¸¡.</b></div>
          <div><span>Low</span><b>72 à¸Šà¸¡.</b></div>
        </div>
      </div>
    </section>

    <section class="grid-3">
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Exception Type</p><h2>à¹à¸¢à¸à¸•à¸²à¸¡à¸›à¸£à¸°à¹€à¸ à¸—</h2></div></div>
        <div class="chart" id="chType"></div>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Shift</p><h2>à¹€à¸—à¸µà¸¢à¸šà¸•à¸²à¸¡à¸à¸°</h2></div></div>
        <div class="chart" id="chShift"></div>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Account Risk</p><h2>à¸šà¸±à¸à¸Šà¸µà¸—à¸µà¹ˆà¹€à¸à¸´à¸” diff à¸šà¹ˆà¸­à¸¢</h2></div></div>
        <div class="chart" id="chAccount"></div>
      </div>
    </section>

    <section class="grid-2">
      <div class="panel">
        <div class="panel-heading">
          <div><p class="eyebrow">SLA Watch</p><h2>à¹€à¸„à¸ªà¸—à¸µà¹ˆà¹€à¸¥à¸¢à¸à¸³à¸«à¸™à¸”à¸Šà¸µà¹‰à¹à¸ˆà¸‡</h2></div>
          <button class="ghost-button sm" data-goto="exceptions" data-sla="1">à¸”à¸¹à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>à¹€à¸„à¸ª / à¸œà¸¹à¹‰à¹€à¸à¸µà¹ˆà¸¢à¸§à¸‚à¹‰à¸­à¸‡</th><th>à¸›à¸£à¸°à¹€à¸ à¸—</th><th>à¸£à¸°à¸”à¸±à¸š</th><th>à¸­à¸²à¸¢à¸¸à¹€à¸„à¸ª</th></tr></thead>
            <tbody>
              ${ex
                .filter((e) => e.overSla)
                .sort((a, b) => b.ageHours / b.slaHours - a.ageHours / a.slaHours)
                .slice(0, 6)
                .map(
                  (e) => `<tr class="clickable" data-ex="${e.id}">
                  <td><b>${h(caseLabel(e))}</b><small class="sub">${h(e.employee)}</small></td>
                  <td>${h(e.typeName)}</td>
                  <td><span class="badge ${e.severity}">${h(sevMeta(e.severity).name)}</span></td>
                  <td class="danger">${e.ageHours} à¸Šà¸¡. / SLA ${e.slaHours} à¸Šà¸¡.</td></tr>`,
                )
                .join("") || `<tr><td colspan="4" class="empty">à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸„à¸ªà¹€à¸¥à¸¢ SLA à¹ƒà¸™à¸•à¸±à¸§à¸à¸£à¸­à¸‡à¸™à¸µà¹‰</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      <div class="panel">
        <div class="panel-heading">
          <div><p class="eyebrow">Damage</p><h2>à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢à¸£à¸­à¸šà¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™</h2></div>
          <button class="ghost-button sm" data-goto="damage">à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢</button>
        </div>
        <div class="big-stat"><span>à¸¢à¸­à¸”à¸—à¸µà¹ˆà¸­à¸²à¸ˆà¹€à¸›à¹‡à¸™à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢</span><strong>${money0(damageSum)} à¸šà¸²à¸—</strong><small>${DB.damages.length} à¹€à¸„à¸ª Â· à¸£à¸­à¸š 1 (1-15 à¸ª.à¸„. 2026)</small></div>
        <div class="chart" id="chDamageCause"></div>
      </div>
    </section>`;

  Charts.draw("#chHourly", "line", {
    label: "à¸›à¸£à¸´à¸¡à¸²à¸“à¸£à¸²à¸¢à¸à¸²à¸£à¸•à¹ˆà¸­à¸Šà¸±à¹ˆà¸§à¹‚à¸¡à¸‡",
    xLabels: DB.hourly.map((x) => x.label),
    short: true,
    hideXLabels: true,
    series: [{ name: "à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”", color: Charts.PALETTE.s1, values: DB.hourly.map((x) => x.total), area: true }],
    height: 150,
  });
  Charts.draw("#chHourlyEx", "line", {
    label: "à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¹„à¸¡à¹ˆ match à¸•à¹ˆà¸­à¸Šà¸±à¹ˆà¸§à¹‚à¸¡à¸‡",
    xLabels: DB.hourly.map((x) => x.label),
    series: [{ name: "à¹„à¸¡à¹ˆ match", color: Charts.PALETTE.s2, values: DB.hourly.map((x) => x.exception), area: true }],
    height: 150,
  });
  Charts.draw("#chSeverity", "stack", { label: "à¸ªà¸±à¸”à¸ªà¹ˆà¸§à¸™à¸„à¸§à¸²à¸¡à¸£à¸¸à¸™à¹à¸£à¸‡", items: bySeverity });
  Charts.draw("#chType", "hbars", { label: "exception à¹à¸¢à¸à¸•à¸²à¸¡à¸›à¸£à¸°à¹€à¸ à¸—", items: byType.slice(0, 7), color: Charts.PALETTE.s1, metric: "à¸ˆà¸³à¸™à¸§à¸™à¹€à¸„à¸ª" });
  Charts.draw("#chShift", "bars", { label: "exception à¹à¸¢à¸à¸•à¸²à¸¡à¸à¸°", items: byShift, color: Charts.PALETTE.s4, metric: "à¸ˆà¸³à¸™à¸§à¸™à¹€à¸„à¸ª", height: 232 });
  Charts.draw("#chAccount", "hbars", { label: "à¸šà¸±à¸à¸Šà¸µà¸—à¸µà¹ˆà¹€à¸à¸´à¸” diff à¸šà¹ˆà¸­à¸¢", items: byAccount, color: Charts.PALETTE.s2, metric: "à¸ˆà¸³à¸™à¸§à¸™à¹€à¸„à¸ª" });

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
  Charts.draw("#chDamageCause", "hbars", { label: "à¸ªà¸²à¹€à¸«à¸•à¸¸à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢", items: causeAgg, color: "#d03b3b", money: true, metric: "à¸¢à¸­à¸” (à¸šà¸²à¸—)" });

  root.querySelectorAll(".sev-row").forEach((b) =>
    b.addEventListener("click", () => go("exceptions", { exFilter: { severity: b.dataset.sev, status: "ALL" } })),
  );
  root.querySelectorAll("[data-goto]").forEach((b) =>
    b.addEventListener("click", () => go(b.dataset.goto, b.dataset.sla ? { exFilter: { sla: true } } : {})),
  );
  root.querySelectorAll("tr[data-ex]").forEach((tr) => tr.addEventListener("click", (event) => {
    if (event.target.closest("details,button,a,input")) return;
    openException(tr.dataset.ex);
  }));
};

/* =============================================================
   VIEW: Daily company summary - 1 à¸šà¸£à¸´à¸©à¸±à¸— / 1 à¸§à¸±à¸™
   ============================================================= */
const dailyCompanyState = { date: "", company: "", batches: null, quality: null, operations: null, checklist: null, caseCounts: null, boFirst: null, exceptions: null, informationalExceptions: [], matchEvidence: [], matchedStaleExceptions: 0, damages: null, loading: false, detailsLoading: false, coreError: null, detailsError: null, requestId: 0, error: null, updatedAt: null };
dailyCompanyState.confirmedRechecks=[];
dailyCompanyState.recheckReportError='';

async function loadDailyCompanySummary(force = false) {
  const date = state.dailySummary.date = visibleDate(state.dailySummary.date || PROD_TODAY);
  const company = state.dailySummary.company || companyMaster()[0]?.code || "3XB";
  const sameSelection = dailyCompanyState.date === date && dailyCompanyState.company === company;
  if ((dailyCompanyState.loading && sameSelection) || (!force && sameSelection && dailyCompanyState.batches)) return;
  const requestId = ++dailyCompanyState.requestId;
  dailyCompanyState.confirmedRechecks=[];dailyCompanyState.recheckReportError='';
  if (!sameSelection) {
    dailyCompanyState.batches = null;
    dailyCompanyState.quality = null;
    dailyCompanyState.operations = null;
    dailyCompanyState.checklist = null;
    dailyCompanyState.caseCounts = null;
    dailyCompanyState.boFirst = null;
    dailyCompanyState.exceptions = null;
    dailyCompanyState.informationalExceptions = [];
    dailyCompanyState.matchEvidence = [];
    dailyCompanyState.matchedStaleExceptions = 0;
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
      // à¸”à¸¶à¸‡à¸—à¸¸à¸à¸šà¸£à¸´à¸©à¸±à¸—à¸‚à¸­à¸‡à¸§à¸±à¸™à¸—à¸µà¹ˆà¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™ à¹€à¸žà¸·à¹ˆà¸­à¹ƒà¸«à¹‰ Audit Sheet à¸ à¸²à¸žà¸£à¸§à¸¡à¹à¸¥à¸°à¸£à¸²à¸¢à¸‡à¸²à¸™
      // à¸šà¸£à¸´à¸©à¸±à¸—à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸à¸­à¹‰à¸²à¸‡à¸­à¸´à¸‡ snapshot à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™ à¹„à¸¡à¹ˆà¸‚à¸¶à¹‰à¸™ 0 à¸šà¸£à¸´à¸©à¸±à¸—à¸—à¸±à¹‰à¸‡à¸—à¸µà¹ˆà¸¡à¸µà¸œà¸¥à¸ˆà¸£à¸´à¸‡
      Sb.quality({ from: date, to: date, limit: 500 }),
      Sb.operations({ from: date, to: date, limit: 500 }),
      Sb.dailyChecklist({ from: date, to: date, limit: 100 }),
      Sb.currentCaseCounts({ from: date, to: date, company: "ALL" }),
      Sb.boFirstCoverage({ from: date, to: date, company, limit: 20 }),
    ]);
    if (requestId !== dailyCompanyState.requestId) return;
    const fulfilled = core.filter((item) => item.status === "fulfilled").length;
    if (!fulfilled) throw new Error("Supabase à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸•à¸­à¸šà¸à¸¥à¸±à¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸‚à¸­à¸‡à¸§à¸±à¸™à¸—à¸µà¹ˆà¹à¸¥à¸°à¸šà¸£à¸´à¸©à¸±à¸—à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸");
    const valueAt = (index) => core[index].status === "fulfilled" ? (core[index].value || []) : [];
    const selectedQuality = valueAt(1).filter((row) => row.business_date === date);
    /* à¸«à¸™à¹‰à¸²à¹€à¸›à¸´à¸”à¸„à¸£à¸±à¹‰à¸‡à¹à¸£à¸à¸¢à¸¶à¸”à¸§à¸±à¸™à¸—à¸µà¹ˆà¸§à¸±à¸™à¸™à¸µà¹‰ à¹à¸•à¹ˆà¸œà¸¥à¸£à¸±à¸™à¸­à¸²à¸ˆà¹€à¸žà¸´à¹ˆà¸‡à¹€à¸ªà¸£à¹‡à¸ˆà¸–à¸¶à¸‡à¸§à¸±à¸™à¸à¹ˆà¸­à¸™à¸«à¸™à¹‰à¸²
       à¸–à¹‰à¸²à¸§à¸±à¸™à¸™à¸µà¹‰à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸œà¸¥ à¹ƒà¸«à¹‰à¸žà¸²à¹„à¸›à¸§à¸±à¸™à¸—à¸µà¹ˆà¸¥à¹ˆà¸²à¸ªà¸¸à¸”à¸—à¸µà¹ˆà¸šà¸£à¸´à¸©à¸±à¸—à¸™à¸µà¹‰à¸¡à¸µà¸œà¸¥à¸ˆà¸£à¸´à¸‡à¸—à¸±à¸™à¸—à¸µ */
    if (date === PROD_TODAY && !selectedQuality.some((row) => row.company === company && row.run_id)) {
      const latestRows = await Sb.quality({ from: VISIBLE_DATE_FROM, to: VISIBLE_DATE_TO, company, limit: 100 });
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
    dailyCompanyState.caseCounts = valueAt(4).filter((row) => row.business_date === date);
    dailyCompanyState.boFirst = valueAt(5).filter((row) => row.business_date === date);
    const failedCore = ["à¸£à¸²à¸¢à¸à¸²à¸£à¹„à¸Ÿà¸¥à¹Œ", "à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”", "à¸ªà¸–à¸²à¸™à¸°à¸‡à¸²à¸™", "Checklist", "à¸¢à¸­à¸”à¹€à¸„à¸ªà¸Šà¸¸à¸”à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™", "à¸šà¸±à¸à¸Šà¸µà¸—à¸µà¹ˆà¸žà¸šà¸ˆà¸²à¸ BO"].filter((_, index) => core[index].status === "rejected");
    dailyCompanyState.coreError = failedCore.length ? `${failedCore.join(" / ")} à¸•à¸­à¸šà¸à¸¥à¸±à¸šà¸Šà¹‰à¸² à¸ˆà¸¶à¸‡à¹à¸ªà¸”à¸‡à¸ªà¹ˆà¸§à¸™à¸—à¸µà¹ˆà¹‚à¸«à¸¥à¸”à¸ªà¸³à¹€à¸£à¹‡à¸ˆà¸à¹ˆà¸­à¸™` : null;
    dailyCompanyState.exceptions = [];
    dailyCompanyState.damages = [];
    dailyCompanyState.updatedAt = new Date();
    dailyCompanyState.loading = false;
    dailyCompanyState.detailsLoading = true;
    if (state.route === "daily-summary") render();

    const details = await Promise.allSettled([
      Sb.currentExceptionsSummary({ from: date, to: date, company, limit: 250 }),
      Sb.damages({ from: date, to: date, company, limit: 500 }),
      Sb.matchedEvidence(company,date),
      company==='ALL'||!['monitor','audit_assistant','lead','admin'].includes(state.role)?Promise.resolve([]):Sb.listAccountRechecks(company,date),
    ]);
    if (requestId !== dailyCompanyState.requestId) return;
    const rawExceptions = details[0].status === "fulfilled" ? (details[0].value || []) : [];
    const matchEvidence = details[2].status === "fulfilled" && Array.isArray(details[2].value?.summary?.match_evidence) ? details[2].value.summary.match_evidence : [];
    dailyCompanyState.informationalExceptions = informationalAuditRows(rawExceptions);
    dailyCompanyState.matchEvidence = matchEvidence;
    dailyCompanyState.matchedStaleExceptions = matchedStaleAuditCount(rawExceptions,matchEvidence);
    dailyCompanyState.exceptions = actionableAuditRows(rawExceptions,matchEvidence).map(mapLiveException);
    dailyCompanyState.damages = details[1].status === "fulfilled" ? (details[1].value || []) : [];
    dailyCompanyState.confirmedRechecks=details[3].status==='fulfilled'?(details[3].value||[]).filter(q=>q.status==='confirmed'):[];
    dailyCompanyState.recheckReportError=details[3].status==='rejected'?'à¸¢à¸±à¸‡à¹‚à¸«à¸¥à¸”à¸£à¸²à¸¢à¸‡à¸²à¸™à¸•à¸£à¸§à¸ˆà¸‹à¹‰à¸³à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸•à¸´à¸¡à¹„à¸¡à¹ˆà¹„à¸”à¹‰':'';
    dailyCompanyState.detailsError = details.slice(0,3).some((item) => item.status === "rejected") ? "à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸” Exception à¸«à¸£à¸·à¸­à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢à¸šà¸²à¸‡à¸ªà¹ˆà¸§à¸™à¸•à¸­à¸šà¸à¸¥à¸±à¸šà¸Šà¹‰à¸²" : null;
    dailyCompanyState.detailsLoading = false;
    dailyCompanyState.updatedAt = new Date();
  } catch (error) {
    if (requestId === dailyCompanyState.requestId) dailyCompanyState.error = error.message || "à¹‚à¸«à¸¥à¸”à¸ªà¸£à¸¸à¸›à¸£à¸²à¸¢à¸§à¸±à¸™à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ";
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
    resolvedCompany: intakeCompanyOf(file, batch) || file.company || batch.company || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸",
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
  const caseCountsAvailable = Array.isArray(dailyCompanyState.caseCounts);
  const currentCounts = (dailyCompanyState.caseCounts || []).find((row) => row.company === company)
    || (!caseCountsAvailable && checklist?.open_count != null && checklist?.resolved_count != null
      ? {total_count:Number(checklist.open_count || 0)+Number(checklist.resolved_count || 0),open_count:checklist.open_count,resolved_count:checklist.resolved_count}
      : null);
  const boFirst = (dailyCompanyState.boFirst || []).find((row) => row.company === company) || null;
  const reportedExceptionTotal = quality.reduce((sum, row) => sum + Number(row.exception_count || 0), 0);
  const informationalCount = (dailyCompanyState.informationalExceptions || []).filter((row) => normalizeLiveCompanyCode(row.company) === company).length;
  const computedCurrentTotal = Math.max(exceptions.length, reportedExceptionTotal - informationalCount - Number(dailyCompanyState.matchedStaleExceptions || 0));
  const fixed = exceptions.filter((row) => ["closed", "approved"].includes(row.status));
  const confirmedDamage = exceptions.filter((row) => row.status === "damage");
  /* All screens use the same current-primary resolver as the case queue.
     Checklist lifecycle is accumulated history and must never override it. */
  const hasCurrentCounts = currentCounts?.total_count != null;
  const resolvedTotal = hasCurrentCounts ? Number(currentCounts.resolved_count || 0) : fixed.length;
  const stillOpen = hasCurrentCounts ? Number(currentCounts.open_count || 0) : Math.max(0, computedCurrentTotal - resolvedTotal);
  const exceptionTotal = hasCurrentCounts ? Number(currentCounts.total_count || 0) : computedCurrentTotal;
  const reconciliationFiles = files.filter((file) => file.kind !== "doc_clarify");
  const evidenceFiles = files.filter((file) => file.kind === "doc_clarify");
  return { company, files, reconciliationFiles, evidenceFiles, batches: ownBatches, quality, operations, checklist, currentCounts, boFirst, exceptions, damages, exceptionTotal, fixed, resolvedTotal, confirmedDamage, stillOpen };
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

function manualFollowupItems(rows) {
  const output=[],seen=new Set();
  for(const row of rows){
    const latest=new Map(),primary=row.primaryResult;
    const jobs=[...(row.rechecks||[])].filter(q=>q.mode==='account'&&q.company===row.company&&q.business_date===row.business_date).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))||String(b.id).localeCompare(String(a.id)));
    for(const q of jobs){const scope=JSON.stringify([q.account,q.direction]);if(latest.has(scope))continue;latest.set(scope,q);
      if(!['ready','confirmed'].includes(q.status)||q.id===primary?.recheck_id||seen.has(q.id))continue;
      if(primary&&Date.parse(q.created_at)<=Date.parse(primary.accepted_at))continue;
      seen.add(q.id);output.push({...q});
    }
  }
  return output.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))||String(b.id).localeCompare(String(a.id)));
}

function dailyResultStatus(row,run={}) {
  const unavailable=run.primaryUnavailable||row.primaryUnavailable;
  const primary=unavailable?null:run.primaryResult||row.primaryResult;
  const manual=row.latestRecheck;
  const labels={ready:'à¸£à¸±à¸™à¸¡à¸·à¸­à¸ªà¸³à¹€à¸£à¹‡à¸ˆ Â· à¸£à¸­à¸«à¸±à¸§à¸«à¸™à¹‰à¸²/à¸œà¸¹à¹‰à¸”à¸¹à¹à¸¥à¸¢à¸·à¸™à¸¢à¸±à¸™',confirmed:'à¸£à¸²à¸¢à¸‡à¸²à¸™à¸£à¸±à¸™à¸¡à¸·à¸­à¸¢à¸·à¸™à¸¢à¸±à¸™à¹à¸¥à¹‰à¸§ Â· à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹ƒà¸Šà¹‰à¹€à¸›à¹‡à¸™à¸œà¸¥à¸«à¸¥à¸±à¸',queued:'à¸£à¸±à¸™à¸¡à¸·à¸­à¹€à¸‚à¹‰à¸²à¸„à¸´à¸§',running:'à¸à¸³à¸¥à¸±à¸‡à¸£à¸±à¸™à¸¡à¸·à¸­',failed:'à¸£à¸±à¸™à¸¡à¸·à¸­à¸¥à¹‰à¸¡à¹€à¸«à¸¥à¸§ Â· à¸•à¸£à¸§à¸ˆà¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”',stale:'à¹„à¸Ÿà¸¥à¹Œà¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™ Â· à¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆà¸¡à¸·à¸­à¹ƒà¸«à¸¡à¹ˆ'};
  return {primary, label:primary?'à¹ƒà¸Šà¹‰à¸œà¸¥à¸£à¸±à¸™à¸¡à¸·à¸­à¹€à¸›à¹‡à¸™à¸œà¸¥à¸«à¸¥à¸±à¸à¹à¸¥à¹‰à¸§':null,
    manual:unavailable?(unavailable.stale?'à¸œà¸¥à¸«à¸¥à¸±à¸à¹€à¸”à¸´à¸¡à¸•à¹‰à¸­à¸‡à¸—à¸šà¸—à¸§à¸™ Â· à¸¡à¸µà¹„à¸Ÿà¸¥à¹Œ/à¸£à¸­à¸šà¹ƒà¸«à¸¡à¹ˆ':'à¸¢à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸œà¸¥à¸«à¸¥à¸±à¸à¹„à¸¡à¹ˆà¹„à¸”à¹‰ Â· à¹‚à¸«à¸¥à¸”à¹ƒà¸«à¸¡à¹ˆà¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡'):manual&&manual.id!==primary?.recheck_id?labels[manual.status]||manual.status:null,
    review:primary?.review_needed?(primary.review_reason||'à¸¡à¸µà¹„à¸Ÿà¸¥à¹Œà¹€à¸žà¸´à¹ˆà¸¡à¸«à¸¥à¸±à¸‡à¸¢à¸·à¸™à¸¢à¸±à¸™ Â· à¸à¸£à¸¸à¸“à¸²à¸—à¸šà¸—à¸§à¸™'):null,
    automatic:row.autoPaused?'à¸£à¸­à¸šà¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´: à¸žà¸±à¸à¸£à¸±à¸™':`à¸£à¸­à¸šà¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´: ${(LIVE_STATUS[row.job_status||run.status]||{}).label||row.job_status||run.status||'à¸£à¸­à¹„à¸Ÿà¸¥à¹Œ'}`,
    error:[...new Set([row.workflowStatusError,unavailable?.message].filter(Boolean))].join(' Â· ')};
}

function dailyAuditSheetRows(date) {
  const checklist = (dailyCompanyState.checklist || []).filter((row) => row.business_date === date && isLiveCompanyRow(row));
  const currentCounts = (dailyCompanyState.caseCounts || []).filter((row) => row.business_date === date && isLiveCompanyRow(row));
  const caseCountsAvailable = Array.isArray(dailyCompanyState.caseCounts);
  const quality = (dailyCompanyState.quality || []).filter((row) => row.business_date === date && isLiveCompanyRow(row));
  const checklistByCompany = new Map(checklist.map((row) => [row.company, row]));
  const currentCountsByCompany = new Map(currentCounts.map((row) => [row.company, row]));
  const qualityByCompany = new Map(quality.map((row) => [row.company, row]));
  const companies = [...new Set([...checklistByCompany.keys(), ...qualityByCompany.keys()])];
  return companies.map((company) => {
    const row = checklistByCompany.get(company) || { company };
    const run = qualityByCompany.get(company) || {};
    const resultStatus = dailyResultStatus(row,run);
    const primary=resultStatus.primary;
    const legacyCurrentCounts = (!primary || !!primary.case_set) && row.open_count != null && row.resolved_count != null;
    const lifecycle = currentCountsByCompany.get(company) || (!caseCountsAvailable && legacyCurrentCounts
      ? {total_count:Number(row.open_count || 0)+Number(row.resolved_count || 0),open_count:row.open_count,resolved_count:row.resolved_count}
      : null);
    const generatedExceptionCount = primary ? (primary.report?.exceptions?.length || 0) + (primary.report?.summary?.waiting_bo?.length || 0) : Number(run.exception_count ?? row.exception_count ?? 0);
    const hasCurrentCounts = (!primary || !!primary.case_set) && lifecycle?.total_count != null;
    const resolvedCount = hasCurrentCounts ? Number(lifecycle.resolved_count || 0) : 0;
    const openCount = hasCurrentCounts ? Number(lifecycle.open_count || 0) : Math.max(0, generatedExceptionCount - resolvedCount);
    const exceptionCount = hasCurrentCounts ? Number(lifecycle.total_count || 0) : generatedExceptionCount;
    const runStatus = row.job_status || run.status || "waiting_files";
    return {
      ...row,
      resultStatus,
      status: openCount > 0 && runStatus === "completed" ? "completed_review" : (row.checklist_status || runStatus),
      fileCount: primary ? row.primaryFileCount??null : Number(run.file_count || row.file_count || 0),
      parsedCount: primary ? row.primaryFileCount??null : Math.max(
        Number(run.parsed_count || 0),
        Number(row.parsed_count || 0),
        run.run_id && runStatus === "completed" && !Number(run.error_count || row.error_count || 0)
          ? Number(run.file_count || row.file_count || 0)
          : 0,
      ),
      stmCount: Number(run.stm_count ?? row.stm_count ?? 0),
      boCount: Number(run.bo_count ?? row.bo_count ?? 0),
      matched: Number(run.matched ?? row.matched_count ?? 0),
      exceptionCount,
      generatedExceptionCount,
      currentCountsReady: hasCurrentCounts && [lifecycle.open_count,lifecycle.resolved_count,lifecycle.total_count].every(v=>Number.isFinite(Number(v))&&Number(v)>=0),
      caseSetPending: !!primary && !primary.case_set,
      historicalOpenCount: primary && !primary.case_set ? row.open_count ?? null : null,
      openCount,
      resolvedCount,
      missing: Array.isArray(row.missing_items) ? row.missing_items : [],
    };
  }).sort((a, b) => String(a.company).localeCompare(String(b.company), "th"));
}

function exportDailyCompanySummary(data) {
  if (!can("export")) return deny("export à¸‚à¹‰à¸­à¸¡à¸¹à¸¥");
  const date = state.dailySummary.date;
  const parsed = data.reconciliationFiles.filter((file) => file.parsed).length;
  const fileErrors = data.reconciliationFiles.filter((file) => file.parse_error && !statementNeedsBoReview(file)).length;
  const fileBoReview = data.reconciliationFiles.filter(statementNeedsBoReview).length;
  const matched = data.quality.reduce((sum, row) => sum + Number(row.matched || 0), 0);
  const stm = data.quality.reduce((sum, row) => sum + Number(row.stm_count || 0), 0);
  const bo = data.quality.reduce((sum, row) => sum + Number(row.bo_count || 0), 0);
  const damageTotal = data.damages.reduce((sum, row) => sum + Number(row.amount_thb ?? row.amount ?? 0), 0);
  const sheets = [
    {
      name: "à¸ªà¸£à¸¸à¸›",
      title: `à¸ªà¸£à¸¸à¸› Audit ${data.company} à¸§à¸±à¸™à¸—à¸µà¹ˆ ${date}`,
      headers: ["à¸«à¸±à¸§à¸‚à¹‰à¸­", "à¸œà¸¥à¸£à¸§à¸¡", "à¸„à¸³à¸­à¸˜à¸´à¸šà¸²à¸¢"],
      widths: [34, 18, 55],
      rows: [
        ["à¸­à¸µà¹€à¸¡à¸¥à¸—à¸µà¹ˆà¹„à¸”à¹‰à¸£à¸±à¸š", data.batches.length, "à¸™à¸±à¸šà¸Šà¸¸à¸”à¸­à¸µà¹€à¸¡à¸¥à¸—à¸µà¹ˆà¸¡à¸µà¹„à¸Ÿà¸¥à¹Œà¸‚à¸­à¸‡à¸šà¸£à¸´à¸©à¸±à¸—à¸™à¸µà¹‰"],
        ["à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¹„à¸”à¹‰à¸£à¸±à¸š", data.files.length, "à¹„à¸Ÿà¸¥à¹Œà¸ˆà¸£à¸´à¸‡à¹ƒà¸™ Supabase Storage"],
        ["à¹„à¸Ÿà¸¥à¹Œà¸ªà¸³à¸«à¸£à¸±à¸šà¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”", data.reconciliationFiles.length, "à¹„à¸¡à¹ˆà¸™à¸±à¸šà¹„à¸Ÿà¸¥à¹Œà¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸«à¸£à¸·à¸­à¸«à¸¥à¸±à¸à¸à¸²à¸™à¸›à¸£à¸°à¸à¸­à¸š"],
        ["à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸£à¸°à¸šà¸šà¸­à¹ˆà¸²à¸™à¸ªà¸³à¹€à¸£à¹‡à¸ˆ", parsed, "à¹„à¸Ÿà¸¥à¹Œà¸ªà¸³à¸«à¸£à¸±à¸šà¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸—à¸µà¹ˆà¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™"],
        ["à¹„à¸Ÿà¸¥à¹Œà¹„à¸¡à¹ˆà¸žà¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸§à¸±à¸™à¸•à¸£à¸§à¸ˆ à¸£à¸­à¹€à¸—à¸µà¸¢à¸š BO", fileBoReview, "à¹„à¸”à¹‰à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¹‰à¸§ à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¢à¸·à¸™à¸¢à¸±à¸™à¸§à¹ˆà¸² BO à¹„à¸¡à¹ˆà¸¡à¸µà¸£à¸²à¸¢à¸à¸²à¸£à¸«à¸£à¸·à¸­à¹„à¸Ÿà¸¥à¹Œà¸„à¸£à¸­à¸šà¸„à¸¥à¸¸à¸¡à¸§à¸±à¸™à¸•à¸£à¸§à¸ˆ"],
        ["à¹„à¸Ÿà¸¥à¹Œà¸Šà¸µà¹‰à¹à¸ˆà¸‡/à¸«à¸¥à¸±à¸à¸à¸²à¸™", data.evidenceFiles.length, "à¹€à¸à¹‡à¸šà¹„à¸§à¹‰à¹€à¸›à¸´à¸”à¸•à¸£à¸§à¸ˆà¹à¸¥à¸°à¹ƒà¸Šà¹‰à¸›à¸£à¸°à¸à¸­à¸šà¸à¸²à¸£à¸›à¸´à¸”à¹€à¸„à¸ª à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¸­à¹ˆà¸²à¸™à¹€à¸›à¹‡à¸™à¸£à¸²à¸¢à¸à¸²à¸£"],
        ["à¹„à¸Ÿà¸¥à¹Œà¸­à¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ", fileErrors, "à¸•à¹‰à¸­à¸‡à¹€à¸›à¸´à¸”à¸•à¹‰à¸™à¸‰à¸šà¸±à¸šà¸«à¸£à¸·à¸­à¸•à¸£à¸§à¸ˆà¸£à¸¹à¸›à¹à¸šà¸šà¹„à¸Ÿà¸¥à¹Œ"],
        ["à¸£à¸²à¸¢à¸à¸²à¸£à¸à¸±à¹ˆà¸‡ STM", stm, "à¸£à¸²à¸¢à¸à¸²à¸£à¸à¸²à¸-à¸–à¸­à¸™/PM à¸—à¸µà¹ˆà¸£à¸°à¸šà¸šà¸­à¹ˆà¸²à¸™à¹„à¸”à¹‰"],
        ["à¸£à¸²à¸¢à¸à¸²à¸£à¸à¸±à¹ˆà¸‡ BO", bo, "à¸£à¸²à¸¢à¸à¸²à¸£à¸£à¸°à¸šà¸šà¸«à¸¥à¸±à¸‡à¸šà¹‰à¸²à¸™à¸—à¸µà¹ˆà¸£à¸°à¸šà¸šà¸­à¹ˆà¸²à¸™à¹„à¸”à¹‰"],
        ["à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ", matched, "à¸œà¹ˆà¸²à¸™à¹€à¸‡à¸·à¹ˆà¸­à¸™à¹„à¸‚ account + time + amount"],
        ["Exception à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”", data.exceptionTotal, "à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆà¸•à¹ˆà¸­"],
        ["à¹à¸à¹‰à¹„à¸‚à¹à¸¥à¸°à¸›à¸´à¸”à¹à¸¥à¹‰à¸§", data.resolvedTotal, "à¸ªà¸–à¸²à¸™à¸° approved à¸«à¸£à¸·à¸­ closed"],
        ["à¸¢à¸±à¸‡à¹à¸à¹‰à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ", data.stillOpen, "à¸£à¸§à¸¡à¸à¸³à¸¥à¸±à¸‡à¸•à¸´à¸”à¸•à¸²à¸¡à¹à¸¥à¸°à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¸¢à¸±à¸‡à¸›à¸´à¸”à¹„à¸¡à¹ˆà¹„à¸”à¹‰"],
        ["à¸¢à¸·à¸™à¸¢à¸±à¸™à¹€à¸›à¹‡à¸™à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢", data.confirmedDamage.length, "à¸ªà¹ˆà¸§à¸™à¸«à¸™à¸¶à¹ˆà¸‡à¸‚à¸­à¸‡à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¸¢à¸±à¸‡à¹à¸à¹‰à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ"],
        ["à¸¡à¸¹à¸¥à¸„à¹ˆà¸²à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢à¸—à¸µà¹ˆà¸šà¸±à¸™à¸—à¸¶à¸", damageTotal, "à¸šà¸²à¸—"],
      ],
    },
    {
      name: "à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¹„à¸”à¹‰à¸£à¸±à¸š",
      title: `à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¹„à¸”à¹‰à¸£à¸±à¸š ${data.company} à¸§à¸±à¸™à¸—à¸µà¹ˆ ${date}`,
      headers: ["à¸£à¸±à¸šà¹€à¸¡à¸·à¹ˆà¸­", "à¸«à¸±à¸§à¸‚à¹‰à¸­à¹€à¸¡à¸¥", "à¸œà¸¹à¹‰à¸ªà¹ˆà¸‡", "à¸Šà¸·à¹ˆà¸­à¹„à¸Ÿà¸¥à¹Œ", "à¸›à¸£à¸°à¹€à¸ à¸—", "à¸‚à¸™à¸²à¸” (KB)", "à¹à¸–à¸§", "à¸ªà¸–à¸²à¸™à¸°à¸­à¹ˆà¸²à¸™", "à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”", "Storage path"],
      widths: [22, 42, 28, 38, 24, 14, 12, 18, 42, 50],
      rows: data.files.map((file) => [file.receivedAt, file.batch.subject || "", file.batch.sender || "", file.file_name || "", LIVE_KIND_LABEL[file.kind] || file.kind || "", Math.round(Number(file.size_bytes || 0) / 1024), Number(file.row_count || 0), file.kind === "doc_clarify" ? "à¸«à¸¥à¸±à¸à¸à¸²à¸™à¸žà¸£à¹‰à¸­à¸¡à¸•à¸£à¸§à¸ˆ" : statementNeedsBoReview(file) ? statementReviewLabel(file) : file.parse_error ? "à¸­à¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ" : file.parsed ? parsedFileLabel(file) : "à¸£à¸­à¸­à¹ˆà¸²à¸™", file.parse_error || "", file.storage_path || ""]),
    },
    {
      name: "à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”",
      title: `à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸” ${data.company} à¸§à¸±à¸™à¸—à¸µà¹ˆ ${date}`,
      headers: ["à¸£à¸°à¸šà¸š", "à¸ªà¸–à¸²à¸™à¸°", "STM", "BO", "à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ", "à¸­à¸±à¸•à¸£à¸²à¸ˆà¸±à¸šà¸„à¸¹à¹ˆ (%)", "Exception", "à¹„à¸Ÿà¸¥à¹Œ", "à¹„à¸Ÿà¸¥à¹Œà¸­à¹ˆà¸²à¸™à¸œà¸´à¸”à¸žà¸¥à¸²à¸”", "à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸¢à¸±à¸‡à¸‚à¸²à¸”", "à¹€à¸§à¸¥à¸²à¸£à¸±à¸™"],
      widths: [18, 20, 12, 12, 16, 18, 14, 12, 18, 44, 22],
      rows: data.quality.map((row) => [row.business_system || "", LIVE_STATUS[row.status]?.label || row.status || "", Number(row.stm_count || 0), Number(row.bo_count || 0), Number(row.matched || 0), Number(row.match_rate || 0), Number(row.exception_count || 0), Number(row.file_count || 0), Number(row.error_count || 0), dailyMissingKinds([row]).join(", "), row.run_at || ""]),
    },
    {
      name: "Exception",
      title: `Exception ${data.company} à¸§à¸±à¸™à¸—à¸µà¹ˆ ${date}`,
      headers: ["à¹€à¸„à¸ª", "à¹€à¸§à¸¥à¸²", "à¸˜à¸™à¸²à¸„à¸²à¸£", "à¸šà¸±à¸à¸Šà¸µ", "à¸à¸²à¸/à¸–à¸­à¸™", "à¸›à¸£à¸°à¹€à¸ à¸—", "à¸¢à¸­à¸” BO", "à¸¢à¸­à¸” STM", "à¸œà¸¥à¸•à¹ˆà¸²à¸‡", "à¸£à¸°à¸”à¸±à¸š", "à¸ªà¸–à¸²à¸™à¸°", "à¸œà¸¹à¹‰à¹€à¸à¸µà¹ˆà¸¢à¸§à¸‚à¹‰à¸­à¸‡", "à¸ªà¸²à¹€à¸«à¸•à¸¸", "à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”"],
      widths: [16, 12, 14, 18, 12, 28, 16, 16, 16, 12, 18, 22, 35, 60],
      rows: data.exceptions.map((row) => [row.id, row.time, row.bank, row.account, row.direction, row.typeName, row.systemAmount ?? "", row.bankAmount ?? "", row.amountDiff, row.severity, statusMeta(row.status).name, row.employee, row.cause, row.detail]),
    },
    {
      name: "à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢",
      title: `à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢ ${data.company} à¸§à¸±à¸™à¸—à¸µà¹ˆ ${date}`,
      headers: ["à¸£à¸«à¸±à¸ª", "à¹€à¸„à¸ª", "à¸¢à¸­à¸” (à¸šà¸²à¸—)", "à¸ªà¸²à¹€à¸«à¸•à¸¸", "à¸œà¸¹à¹‰à¹€à¸à¸µà¹ˆà¸¢à¸§à¸‚à¹‰à¸­à¸‡", "à¸«à¸¥à¸±à¸à¸à¸²à¸™", "à¸ªà¸–à¸²à¸™à¸°à¸à¸²à¸£à¹€à¸‡à¸´à¸™"],
      widths: [16, 16, 18, 42, 22, 14, 20],
      rows: data.damages.map((row) => [row.code || row.id, row.exception_id || "", Number(row.amount_thb ?? row.amount ?? 0), row.cause || "", row.employee || "", row.has_evidence ? "à¸„à¸£à¸š" : "à¸£à¸­", row.finance_status || ""]),
    },
  ];
  const filename = `daily-audit_${date}_${data.company}.xlsx`;
  sheets.push(...AccountRecheck.confirmedSheets((dailyCompanyState.confirmedRechecks||[]).filter(q=>q.company===data.company&&q.business_date===date)));
  for(const row of data.quality.filter(r=>r.primaryResult))sheets.push(...ManualPrimary.sheets(row.primaryResult));
  const meta = `à¸šà¸£à¸´à¸©à¸±à¸— ${data.company} Â· à¸§à¸±à¸™à¸—à¸µà¹ˆ ${date} Â· à¸­à¸­à¸à¹‚à¸”à¸¢ ${currentUser().username} à¹€à¸¡à¸·à¹ˆà¸­ ${nowStamp()}`;
  const result = Exporter.workbook(sheets, filename, meta);
  if (result.ok) {
    logAction("export", "daily_company_summary", `${date}|${data.company}`, `Excel ${sheets.length} à¸Šà¸µà¸• Â· ${data.files.length} à¹„à¸Ÿà¸¥à¹Œ Â· ${data.exceptionTotal} exception`);
    toast(`à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸” ${filename} à¹à¸¥à¹‰à¸§`);
  } else {
    Exporter.csv(sheets[0].headers, sheets[0].rows, filename.replace(".xlsx", ".csv"));
    toast("à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¸ªà¸£à¸¸à¸›à¹€à¸›à¹‡à¸™ CSV à¹ƒà¸«à¹‰à¹à¸—à¸™ à¹€à¸™à¸·à¹ˆà¸­à¸‡à¸ˆà¸²à¸à¸•à¸±à¸§à¹€à¸‚à¸µà¸¢à¸™ Excel à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸£à¹‰à¸­à¸¡", "warn");
  }
}

function renderDailyCompanySummary(root) {
  let openBoFollowUp = () => {};
  if (!Sb.signedIn()) {
    root.innerHTML = `<section class="panel"><div class="alert bad"><strong>à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸š</strong><span>à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸šà¸à¹ˆà¸­à¸™à¹€à¸žà¸·à¹ˆà¸­à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸°à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸ˆà¸£à¸´à¸‡à¸ˆà¸²à¸ Supabase</span></div></section>`;
    return;
  }
  if ((!dailyCompanyState.batches || dailyCompanyState.date !== state.dailySummary.date || dailyCompanyState.company !== state.dailySummary.company) && !dailyCompanyState.loading) loadDailyCompanySummary();
  const companies = dailyCompanyOptions();
  const company = companies.includes(state.dailySummary.company) ? state.dailySummary.company : (companies[0] || "3XB");
  state.dailySummary.company = company;
  const controls = `<section class="panel daily-summary-controls no-capture"><div><p class="eyebrow">Daily Audit Pack</p><h2>à¹€à¸¥à¸·à¸­à¸ 1 à¸šà¸£à¸´à¸©à¸±à¸— à¹à¸¥à¸° 1 à¸§à¸±à¸™</h2><small>à¸—à¸¸à¸à¸•à¸±à¸§à¹€à¸¥à¸‚à¹à¸¥à¸°à¹„à¸Ÿà¸¥à¹Œà¸”à¹‰à¸²à¸™à¸¥à¹ˆà¸²à¸‡à¸ˆà¸°à¸¢à¸¶à¸”à¸•à¸±à¸§à¹€à¸¥à¸·à¸­à¸à¸ªà¸­à¸‡à¸Šà¹ˆà¸­à¸‡à¸™à¸µà¹‰à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™</small></div><label>à¸§à¸±à¸™à¸—à¸µà¹ˆ<input type="date" id="dailySummaryDate" min="${VISIBLE_DATE_FROM}" max="${VISIBLE_DATE_TO}" value="${h(state.dailySummary.date)}" /></label><label>à¹€à¸„à¸£à¸·à¸­ / à¸šà¸£à¸´à¸©à¸±à¸—<select id="dailySummaryCompany">${groupedCompanyOptions(companies, company)}</select></label><button class="ghost-button" id="dailySummaryRefresh">à¸£à¸µà¹€à¸Ÿà¸£à¸Š</button><button class="ghost-button" id="dailySummaryHolds">à¸žà¸±à¸à¸šà¸±à¸à¸Šà¸µ / à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¸žà¸±à¸à¸•à¸£à¸§à¸ˆ (à¸­à¹ˆà¸²à¸™à¸­à¸¢à¹ˆà¸²à¸‡à¹€à¸”à¸µà¸¢à¸§)</button><button class="primary-button" id="dailySummaryExport" ${dailyCompanyState.loading || dailyCompanyState.error ? "disabled" : ""}>Export à¸£à¸²à¸¢à¸§à¸±à¸™</button></section>`;
  const rulesPanel = auditRuleBookMarkup(company);
  if (dailyCompanyState.loading && !dailyCompanyState.batches) {
    root.innerHTML = controls + rulesPanel + `<section class="panel"><div class="alert"><strong>à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸«à¸¥à¸±à¸à¸‚à¸­à¸‡à¸£à¸²à¸¢à¸‡à¸²à¸™</strong><span>à¸«à¸™à¹‰à¸²à¸™à¸µà¹‰à¸¢à¸±à¸‡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¹€à¸¡à¸™à¸¹à¸­à¸·à¹ˆà¸™à¹„à¸”à¹‰à¸•à¸²à¸¡à¸›à¸à¸•à¸´ à¹à¸¥à¸°à¸ˆà¸°à¹€à¸›à¸´à¸”à¸£à¸²à¸¢à¸‡à¸²à¸™à¹ƒà¸«à¹‰à¸—à¸±à¸™à¸—à¸µà¹€à¸¡à¸·à¹ˆà¸­à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸«à¸¥à¸±à¸à¸¡à¸²à¸–à¸¶à¸‡</span></div></section>`;
  } else if (dailyCompanyState.error) {
    root.innerHTML = controls + rulesPanel + `<section class="panel"><div class="alert bad"><strong>à¹‚à¸«à¸¥à¸”à¸ªà¸£à¸¸à¸›à¸£à¸²à¸¢à¸§à¸±à¸™à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ</strong><span>${h(dailyCompanyState.error)}</span></div></section>`;
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
    const riskIsPartial = data.exceptionTotal > data.exceptions.length;
    const damageTotal = data.damages.reduce((sum, row) => sum + Number(row.amount_thb ?? row.amount ?? 0), 0);
    const scheduled = data.checklist?.checklist_status === "scheduled";
    const missing = scheduled ? [] : data.checklist?.missing_items?.length
      ? data.checklist.missing_items
      : dailyMissingKinds(data.quality.length ? data.quality : data.operations);
    const latestStatus = data.quality[0]?.status || data.operations[0]?.status || (data.files.length ? "ready" : "waiting_files");
    const selectedResultStatus=dailyResultStatus(data.checklist||{},data.quality[0]||{});
    const status = selectedResultStatus.primary ? {label:selectedResultStatus.label,tone:'green'} : selectedResultStatus.manual ? {label:selectedResultStatus.manual,tone:'blue'} : latestStatus === "completed" && data.stillOpen > 0
      ? { label: "à¸£à¸°à¸šà¸šà¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¹€à¸ªà¸£à¹‡à¸ˆ Â· à¸£à¸­ Audit à¸•à¸£à¸§à¸ˆà¹€à¸„à¸ª", tone: "amber" }
      : LIVE_STATUS[latestStatus] || { label: latestStatus || "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸‡à¸²à¸™", tone: "grey" };
    const kindCounts = Object.entries(data.files.reduce((acc, file) => {
      const label = LIVE_KIND_LABEL[file.kind] || file.kind || "à¸¢à¸±à¸‡à¸ˆà¸³à¹à¸™à¸à¹„à¸¡à¹ˆà¹„à¸”à¹‰";
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
    const completionBlockers = dailyCompletionBlockers(data);
    const dayComplete = completionBlockers.length === 0;
    const coverageComplete = reconciliationReady && checklistReady && Boolean(data.boFirst?.complete) && boMissing.length === 0 && missing.length === 0 && boFiles >= boExpected;
    const boRequiredByKind = (kind) => boRequired.filter((item) => item.kind === kind);
    const boMissingByKind = (kind) => boMissing.filter((item) => item.kind === kind);
    const stmRequiredByBo = boRequiredByKind("STM");
    const pmRequiredByBo = boRequiredByKind("PM");
    const stmMissingByBo = boMissingByKind("STM");
    const pmMissingByBo = boMissingByKind("PM");
    const businessSystem = data.checklist?.business_system || data.quality[0]?.business_system || data.operations[0]?.business_system || businessSystemOfCompany(company);
    const damageDisplay = damageTotal
      ? `${money0(damageTotal)} à¸šà¸²à¸—`
      : evidenceFiles
        ? "à¸£à¸­à¸•à¸£à¸§à¸ˆà¸«à¸¥à¸±à¸à¸à¸²à¸™"
        : "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸šà¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢";
    const directionLabel = (value) => value === "deposit" ? "à¸à¸²à¸" : value === "withdraw" ? "à¸–à¸­à¸™" : "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸—à¸´à¸¨à¸—à¸²à¸‡";
    const sourceFilesFor = (kind) => data.files.filter((file) => kind === "PM" ? file.kind === "pm_statement" : file.kind === "stm_pdf");
    const pairInfo = (item, received, missingItem) => {
      if (!missingItem) return {
        code: "matched", tone: "green", title: "à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¹à¸«à¸¥à¹ˆà¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹à¸¥à¹‰à¸§",
        detail: `${num(received?.rows || 0)} à¸£à¸²à¸¢à¸à¸²à¸£`,
        sourceNames: Array.isArray(received?.source_files) ? received.source_files.filter(Boolean) : [],
      };
      const files = sourceFilesFor(item.kind);
      const errors = files.filter((file) => file.parse_error && !statementNeedsBoReview(file));
      const needsBoReview = files.filter(statementNeedsBoReview);
      const parsedFiles = files.filter((file) => file.parsed);
      const sameIdentity = boReceived.find((candidate) => candidate.kind === item.kind && candidate.identity === item.identity);
      const sameNames = Array.isArray(sameIdentity?.source_files) ? sameIdentity.source_files.filter(Boolean) : [];
      const allNames = files.map((file) => file.file_name).filter(Boolean);
      if (!files.length) return { code: "missing_file", tone: "red", title: `à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œ ${item.kind || "STM"}`, detail: "à¹„à¸¡à¹ˆà¸žà¸šà¹„à¸Ÿà¸¥à¹Œà¸•à¹‰à¸™à¸—à¸²à¸‡à¸‚à¸­à¸‡à¸šà¸£à¸´à¸©à¸±à¸—/à¸§à¸±à¸™à¸—à¸µà¹ˆà¸™à¸µà¹‰", sourceNames: [] };
      if (errors.length) return { code: "read_error", tone: "red", title: "à¹„à¸”à¹‰à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¹‰à¸§ à¹à¸•à¹ˆà¸­à¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰", detail: `${num(files.length)} à¹„à¸Ÿà¸¥à¹Œ Â· à¸œà¸´à¸”à¸žà¸¥à¸²à¸” ${num(errors.length)}`, sourceNames: allNames };
      if (needsBoReview.length) return { code: "needs_bo_review", tone: "amber", title: "à¹„à¸”à¹‰à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¹‰à¸§ Â· à¸¡à¸µà¹„à¸Ÿà¸¥à¹Œà¹„à¸¡à¹ˆà¸žà¸šà¸£à¸²à¸¢à¸à¸²à¸£à¹ƒà¸™à¸§à¸±à¸™à¸•à¸£à¸§à¸ˆ", detail: `${num(needsBoReview.length)} à¹„à¸Ÿà¸¥à¹Œà¸£à¸­à¹€à¸—à¸µà¸¢à¸š BO à¹à¸¥à¸°à¸•à¸£à¸§à¸ˆà¸Šà¹ˆà¸§à¸‡à¸§à¸±à¸™à¸—à¸µà¹ˆ â€” à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¢à¸·à¸™à¸¢à¸±à¸™à¸§à¹ˆà¸²à¹€à¸›à¹‡à¸™à¸šà¸±à¸à¸Šà¸µà¸„à¸¹à¹ˆà¸à¸±à¸™à¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆà¸¡à¸µà¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸±à¹‰à¸‡à¸ªà¸­à¸‡à¸à¸±à¹ˆà¸‡`, sourceNames: allNames };
      if (parsedFiles.length < files.length) return { code: "waiting", tone: "amber", title: "à¹„à¸”à¹‰à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¹‰à¸§ Â· à¸£à¸­à¸­à¹ˆà¸²à¸™", detail: `à¸­à¹ˆà¸²à¸™à¹à¸¥à¹‰à¸§ ${num(parsedFiles.length)}/${num(files.length)} à¹„à¸Ÿà¸¥à¹Œ`, sourceNames: allNames };
      if (sameIdentity) return { code: "wrong_direction", tone: "red", title: "à¸žà¸šà¸šà¸±à¸à¸Šà¸µà¹à¸¥à¹‰à¸§ à¹à¸•à¹ˆà¸—à¸´à¸¨à¸—à¸²à¸‡à¹„à¸¡à¹ˆà¸•à¸£à¸‡", detail: `BO ${directionLabel(item.direction)} Â· à¹„à¸Ÿà¸¥à¹Œ ${directionLabel(sameIdentity.direction)}`, sourceNames: sameNames.length ? sameNames : allNames };
      return { code: "identity_not_found", tone: "red", title: "à¸¡à¸µà¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¹‰à¸§ Â· à¹„à¸¡à¹ˆà¸žà¸šà¹€à¸¥à¸‚à¸šà¸±à¸à¸Šà¸µà¸„à¸¹à¹ˆ", detail: `à¹„à¸”à¹‰à¸£à¸±à¸šà¹à¸¥à¸°à¸­à¹ˆà¸²à¸™à¹à¸¥à¹‰à¸§ ${num(files.length)} à¹„à¸Ÿà¸¥à¹Œ`, sourceNames: allNames };
    };
    const pairStatus = (info, followIndex) => `<span class="badge ${h(info.tone)}">${h(info.title)}</span><small class="sub">${h(info.detail)}${info.sourceNames.length && info.code === "matched" ? ` Â· ${h(info.sourceNames.join(" Â· "))}` : ""}</small><button type="button" class="bo-follow-button" data-bo-follow="${followIndex}">à¸”à¸¹à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸” / à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£</button>`;
    const fullBoIdentity = (item) => {
      const labels = Array.isArray(item?.source_labels) ? item.source_labels.filter(Boolean) : [];
      if (!labels.length) return `<span class="muted">â€“</span><small class="sub">à¸£à¸±à¸™à¹ƒà¸«à¸¡à¹ˆà¹€à¸žà¸·à¹ˆà¸­à¹€à¸à¹‡à¸šà¸Šà¸·à¹ˆà¸­à¹€à¸•à¹‡à¸¡</small>`;
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
    const unmatchedReceivedRows = unmatchedReceived.map((item) => `<tr><td><b>${h(item.system || businessSystem)}</b></td><td><b>${h(normalizeLiveCompanyCode(item.company) || company)}</b></td><td><b>${h(item.label || item.identity || "-")}</b><small class="sub">${h(item.kind || "STM")}</small></td><td>${h(directionLabel(item.direction))}</td><td class="right tnum">${num(item.rows || 0)}</td><td>${Array.isArray(item.source_files) && item.source_files.length ? h(item.source_files.join(" Â· ")) : "à¹„à¸Ÿà¸¥à¹Œà¸–à¸¹à¸à¸­à¹ˆà¸²à¸™à¹à¸¥à¹‰à¸§ à¹à¸•à¹ˆà¸œà¸¥à¸£à¸±à¸™à¹€à¸”à¸´à¸¡à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¹€à¸à¹‡à¸šà¸Šà¸·à¹ˆà¸­à¹„à¸Ÿà¸¥à¹Œ"}</td></tr>`).join("");
    const boFileCards = boSourceFiles.map((file) => {
      const fileStatus = file.parse_error ? "error" : file.parsed ? "parsed" : "waiting";
      const statusLabel = statementNeedsBoReview(file) ? statementReviewLabel(file) : file.parse_error ? "à¸­à¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰" : file.parsed ? parsedFileLabel(file) : "à¸£à¸­à¸­à¹ˆà¸²à¸™";
      const tone = statementNeedsBoReview(file) ? "amber" : file.parse_error ? "red" : file.parsed ? "green" : "amber";
      return `<button type="button" class="bo-file-card" data-storage-open="${h(file.storage_path)}" data-file-id="${h(file.id)}" data-file-name="${h(file.file_name)}" data-file-mime="${h(file.mime_type || "")}" data-file-size="${h(file.size_bytes || "")}" data-file-kind="${h(file.kind || "")}" data-file-company="${h(company)}" data-file-date="${h(state.dailySummary.date)}" data-file-status="${fileStatus}" ${file.storage_path ? "" : "disabled"}><span><b>${h(file.file_name || "à¹„à¸Ÿà¸¥à¹Œ BO")}</b><small>${h(displayTime(file.receivedAt))} Â· ${num(file.row_count || 0)} à¹à¸–à¸§</small></span><em class="badge ${tone}">${h(statusLabel)}</em></button>`;
    }).join("");
    const boPreviewButton = (file, sourceLabel) => {
      if (!file) return "";
      const fileStatus = file.parse_error ? "error" : file.parsed ? "parsed" : "waiting";
      return `<button type="button" class="bo-follow-file" data-bo-preview data-storage-open="${h(file.storage_path)}" data-file-id="${h(file.id)}" data-file-name="${h(file.file_name)}" data-file-mime="${h(file.mime_type || "")}" data-file-size="${h(file.size_bytes || "")}" data-file-kind="${h(file.kind || "")}" data-file-company="${h(company)}" data-file-date="${h(state.dailySummary.date)}" data-file-status="${fileStatus}" ${file.storage_path ? "" : "disabled"}><span><small>${h(sourceLabel)}</small><b>${h(file.file_name || "à¹„à¸Ÿà¸¥à¹Œà¸•à¹‰à¸™à¸—à¸²à¸‡")}</b></span><em>Preview â†’</em></button>`;
    };
    openBoFollowUp = (followIndex) => {
      const follow = boFollowUps[Number(followIndex)];
      if (!follow) return;
      const { item, info, sourceFiles } = follow;
      const labels = Array.isArray(item.source_labels) ? item.source_labels.filter(Boolean) : [];
      const identity = item.label || item.identity || "-";
      const uniqueNames = (names) => [...new Set((names || []).map((name) => String(name || "").trim()).filter(Boolean))];
      const boFileNames = uniqueNames(boSourceFiles.map((file) => file.file_name));
      const stmFileNames = uniqueNames(info.sourceNames);
      const totalRelatedFiles = boFileNames.length + stmFileNames.length;
      const numberedFileText = (title, names, emptyText) => [
        `${title} (${num(names.length)} à¹„à¸Ÿà¸¥à¹Œ)`,
        ...(names.length ? names.map((name, index) => `${index + 1}. ${name}`) : [`- ${emptyText}`]),
      ];
      const numberedFileHtml = (names, emptyText) => names.length
        ? `<ol class="bo-follow-file-list">${names.map((name) => `<li>${h(name)}</li>`).join("")}</ol>`
        : `<p class="bo-follow-file-empty">${h(emptyText)}</p>`;
      const previewStatus = !stmFileNames.length
        ? "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œ STM/PM à¸ªà¸³à¸«à¸£à¸±à¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸™à¸µà¹‰"
        : sourceFiles.length
          ? `à¹€à¸›à¸´à¸” Preview à¹„à¸”à¹‰ ${num(sourceFiles.length)} à¸ˆà¸²à¸ ${num(stmFileNames.length)} à¹„à¸Ÿà¸¥à¹Œ`
          : `à¹„à¸”à¹‰à¸£à¸±à¸šà¸Šà¸·à¹ˆà¸­à¹„à¸Ÿà¸¥à¹Œ ${num(stmFileNames.length)} à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¹‰à¸§ à¹à¸•à¹ˆà¸œà¸¥à¹‚à¸«à¸¥à¸”à¸Šà¸¸à¸”à¸™à¸µà¹‰à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¸ªà¸³à¸«à¸£à¸±à¸šà¹€à¸›à¸´à¸” Preview`;
      const requiredFile = `${item.kind || "STM"} à¸‚à¸­à¸‡ ${identity} à¸à¸±à¹ˆà¸‡${directionLabel(item.direction)}`;
      const missingSummary = info.code === "matched"
        ? `à¹„à¸¡à¹ˆà¸‚à¸²à¸”à¹„à¸Ÿà¸¥à¹Œ Â· à¸ˆà¸±à¸šà¸„à¸¹à¹ˆ ${requiredFile} à¹à¸¥à¹‰à¸§`
        : info.code === "missing_file"
          ? `à¸‚à¸²à¸”à¹„à¸Ÿà¸¥à¹Œ ${requiredFile}`
          : info.code === "read_error"
            ? `à¸•à¹‰à¸­à¸‡à¸ªà¹ˆà¸‡à¹ƒà¸«à¸¡à¹ˆà¸«à¸£à¸·à¸­à¹à¸à¹‰à¹„à¸Ÿà¸¥à¹Œ ${requiredFile} à¹€à¸žà¸£à¸²à¸°à¸£à¸°à¸šà¸šà¸­à¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰`
            : info.code === "waiting"
              ? `à¸¢à¸±à¸‡à¸ªà¸£à¸¸à¸›à¸§à¹ˆà¸²à¸‚à¸²à¸”à¹„à¸¡à¹ˆà¹„à¸”à¹‰ Â· à¸£à¸­à¸£à¸°à¸šà¸šà¸­à¹ˆà¸²à¸™ ${requiredFile}`
              : info.code === "wrong_direction"
                ? `à¸¡à¸µà¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¹‰à¸§ à¹à¸•à¹ˆà¹€à¸›à¹‡à¸™à¸„à¸™à¸¥à¸°à¸—à¸´à¸¨à¸—à¸²à¸‡à¸à¸±à¸š ${requiredFile}`
                : `à¸¡à¸µà¹„à¸Ÿà¸¥à¹Œà¸„à¸£à¸šà¹à¸¥à¹‰à¸§ à¹à¸•à¹ˆà¸£à¸°à¸šà¸šà¸ˆà¸±à¸šà¸„à¸¹à¹ˆ ${requiredFile} à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ`;
      const summaryLabel = ["identity_not_found", "wrong_direction"].includes(info.code) ? "à¸ªà¸£à¸¸à¸›à¸œà¸¥à¸•à¸£à¸§à¸ˆ" : "à¸ªà¸£à¸¸à¸›à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸‚à¸²à¸”";
      const nextStepSummary = info.code === "identity_not_found"
        ? "à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¸•à¸²à¸¡à¹„à¸Ÿà¸¥à¹Œà¹ƒà¸«à¸¡à¹ˆ Â· à¸à¸” â€œà¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¹ƒà¸«à¸¡à¹ˆâ€ à¸à¹ˆà¸­à¸™ à¸«à¸²à¸à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆà¹ƒà¸«à¹‰à¸•à¸£à¸§à¸ˆà¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¸Šà¸·à¹ˆà¸­à¹à¸¥à¸°à¹€à¸¥à¸‚à¸šà¸±à¸à¸Šà¸µ"
        : info.code === "wrong_direction"
          ? "à¸à¸”à¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¹ƒà¸«à¸¡à¹ˆà¸à¹ˆà¸­à¸™ Â· à¸«à¸²à¸à¸œà¸¥à¹€à¸”à¸´à¸¡à¹ƒà¸«à¹‰à¸•à¸£à¸§à¸ˆà¸§à¹ˆà¸²à¹„à¸Ÿà¸¥à¹Œà¸à¸²à¸/à¸–à¸­à¸™à¸–à¸¹à¸à¸•à¸±à¹‰à¸‡à¸›à¸£à¸°à¹€à¸ à¸—à¸–à¸¹à¸à¸•à¹‰à¸­à¸‡à¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ"
          : info.code === "matched"
            ? "à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£à¹€à¸žà¸´à¹ˆà¸¡"
            : `à¸•à¸´à¸”à¸•à¸²à¸¡à¸«à¸£à¸·à¸­à¹à¸à¹‰à¹„à¸‚ ${requiredFile} à¹à¸¥à¹‰à¸§à¸à¸” â€œà¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¹ƒà¸«à¸¡à¹ˆâ€`;
      const receivedSummary = `à¸£à¸°à¸šà¸šà¹„à¸”à¹‰à¸£à¸±à¸š BO ${num(boFileNames.length)} à¹„à¸Ÿà¸¥à¹Œ à¹à¸¥à¸° STM/PM ${num(stmFileNames.length)} à¹„à¸Ÿà¸¥à¹Œ Â· ${info.detail}`;
      const copyText = [
        "[à¸•à¸´à¸”à¸•à¸²à¸¡à¹€à¸­à¸à¸ªà¸²à¸£à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸” BO-first]",
        `${summaryLabel}: ${missingSummary}`,
        `à¸•à¹‰à¸­à¸‡à¸—à¸³à¸•à¹ˆà¸­: ${nextStepSummary}`,
        `à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¹„à¸”à¹‰à¸£à¸±à¸š: ${receivedSummary}`,
        "",
        "=== 1) à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¸­à¹ˆà¸²à¸™à¸ˆà¸²à¸ BO ===",
        `à¸­à¹‰à¸²à¸‡à¸­à¸´à¸‡à¸ˆà¸²à¸à¹„à¸Ÿà¸¥à¹Œ BO à¸•à¹‰à¸™à¸‰à¸šà¸±à¸š: ${num(boFileNames.length)} à¹„à¸Ÿà¸¥à¹Œ`,
        `à¸§à¸±à¸™à¸—à¸µà¹ˆ: ${state.dailySummary.date}`,
        `à¸£à¸°à¸šà¸š: ${item.system || businessSystem}`,
        `à¸šà¸£à¸´à¸©à¸±à¸—: ${normalizeLiveCompanyCode(item.company) || company}`,
        `à¸šà¸±à¸à¸Šà¸µ/Provider: ${identity}`,
        `à¸Šà¸·à¹ˆà¸­à¹€à¸•à¹‡à¸¡à¸ˆà¸²à¸ BO: ${labels.join(" | ") || "-"}`,
        `à¸›à¸£à¸°à¹€à¸ à¸—: ${item.kind || "STM"} ${directionLabel(item.direction)}`,
        "",
        "=== 2) à¸œà¸¥à¸•à¸£à¸§à¸ˆà¸ˆà¸²à¸ BO ===",
        `à¸£à¸²à¸¢à¸à¸²à¸£à¹ƒà¸™ BO: ${num(item.rows || 0)} à¸£à¸²à¸¢à¸à¸²à¸£`,
        `à¸¢à¸­à¸”à¸£à¸§à¸¡ BO: ${money0(item.amount || 0)} à¸šà¸²à¸—`,
        `à¸ªà¸–à¸²à¸™à¸°: ${info.title}`,
        `à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”: ${info.detail}`,
        "",
        `=== 3) à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸£à¸°à¸šà¸šà¹„à¸”à¹‰à¸£à¸±à¸šà¹à¸¥à¸°à¹ƒà¸Šà¹‰à¸•à¸£à¸§à¸ˆ: à¸£à¸§à¸¡ ${num(totalRelatedFiles)} à¹„à¸Ÿà¸¥à¹Œ ===`,
        ...numberedFileText("à¹„à¸Ÿà¸¥à¹Œ BO à¸•à¹‰à¸™à¸‰à¸šà¸±à¸š", boFileNames, "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸šà¹„à¸Ÿà¸¥à¹Œ BO à¸•à¹‰à¸™à¸‰à¸šà¸±à¸š"),
        "",
        ...numberedFileText("à¹„à¸Ÿà¸¥à¹Œ STM/PM à¸—à¸µà¹ˆà¹„à¸”à¹‰à¸£à¸±à¸š", stmFileNames, "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œ STM/PM à¸ªà¸³à¸«à¸£à¸±à¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸™à¸µà¹‰"),
        `à¸ªà¸–à¸²à¸™à¸° Preview: ${previewStatus}`,
        "",
        "=== 4) à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸‚à¸­à¹ƒà¸«à¹‰à¸—à¸µà¸¡à¸•à¸£à¸§à¸ˆ ===",
        "1. à¸¢à¸·à¸™à¸¢à¸±à¸™à¹€à¸¥à¸‚à¸šà¸±à¸à¸Šà¸µà¸«à¸£à¸·à¸­ Provider à¸§à¹ˆà¸²à¸•à¸£à¸‡à¸à¸±à¸š BO à¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ",
        "2. à¸¢à¸·à¸™à¸¢à¸±à¸™à¸—à¸´à¸¨à¸—à¸²à¸‡à¸à¸²à¸/à¸–à¸­à¸™à¸‚à¸­à¸‡à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸ªà¹ˆà¸‡à¸¡à¸²",
        "3. à¸«à¸²à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹„à¸¡à¹ˆà¸•à¸£à¸‡ à¸à¸£à¸¸à¸“à¸²à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸ªà¸²à¹€à¸«à¸•à¸¸à¹à¸¥à¸°à¹à¸™à¸šà¸«à¸¥à¸±à¸à¸à¸²à¸™à¸—à¸µà¹ˆà¹€à¸à¸µà¹ˆà¸¢à¸§à¸‚à¹‰à¸­à¸‡",
      ].join("\n");
      const sourceFileHtml = sourceFiles.length
        ? sourceFiles.map((file) => boPreviewButton(file, "à¹„à¸Ÿà¸¥à¹Œ STM/PM à¸—à¸µà¹ˆà¸£à¸°à¸šà¸šà¸žà¸š")).join("")
        : info.sourceNames.length
          ? `<div class="bo-follow-file-names"><b>à¸Šà¸·à¹ˆà¸­à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸œà¸¥à¸£à¸±à¸™à¸£à¸°à¸šà¸¸</b><span>${info.sourceNames.map(h).join("<br>")}</span><small>à¹„à¸¡à¹ˆà¸žà¸š metadata à¸ªà¸³à¸«à¸£à¸±à¸šà¹€à¸›à¸´à¸” Preview à¹ƒà¸™à¸œà¸¥à¹‚à¸«à¸¥à¸”à¸Šà¸¸à¸”à¸™à¸µà¹‰ à¹ƒà¸«à¹‰à¹€à¸›à¸´à¸”à¸„à¸¥à¸±à¸‡à¹„à¸Ÿà¸¥à¹Œà¹€à¸žà¸·à¹ˆà¸­à¸•à¸£à¸§à¸ˆà¸•à¹ˆà¸­</small></div>`
          : `<div class="empty-box">à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¹„à¸Ÿà¸¥à¹Œ STM/PM à¸ªà¸³à¸«à¸£à¸±à¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸™à¸µà¹‰</div>`;
      openModal(
        `à¸•à¸´à¸”à¸•à¸²à¸¡ ${h(identity)} Â· ${h(directionLabel(item.direction))}`,
        `<div class="bo-follow-detail"><div class="bo-follow-missing-summary ${h(info.tone)}"><span>${h(summaryLabel)}</span><strong>${h(missingSummary)}</strong><small>${h(receivedSummary)}</small><em>${h(nextStepSummary)}</em></div><div class="bo-follow-grid"><div><span>à¸£à¸°à¸šà¸š / à¸šà¸£à¸´à¸©à¸±à¸—</span><b>${h(item.system || businessSystem)} Â· ${h(normalizeLiveCompanyCode(item.company) || company)}</b></div><div><span>à¸šà¸±à¸à¸Šà¸µ / Provider</span><b>${h(identity)}</b></div><div class="wide"><span>à¸Šà¸·à¹ˆà¸­à¹€à¸•à¹‡à¸¡à¸ˆà¸²à¸ BO</span><b>${labels.length ? labels.map(h).join("<br>") : "-"}</b></div><div><span>à¸›à¸£à¸°à¹€à¸ à¸—</span><b>${h(item.kind || "STM")} Â· ${h(directionLabel(item.direction))}</b></div><div><span>à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ BO</span><b>${num(item.rows || 0)} à¸£à¸²à¸¢à¸à¸²à¸£ Â· ${money0(item.amount || 0)} à¸šà¸²à¸—</b></div></div><div class="bo-follow-files"><h3>à¹€à¸›à¸´à¸”à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸£à¸´à¸‡à¹€à¸žà¸·à¹ˆà¸­à¸£à¸µà¹€à¸Šà¹‡à¸</h3>${boSourceFiles.map((file) => boPreviewButton(file, "à¹„à¸Ÿà¸¥à¹Œ BO à¸•à¹‰à¸™à¸‰à¸šà¸±à¸š")).join("")}${sourceFileHtml}</div><div class="bo-follow-copy"><div class="bo-follow-copy-head"><div><span>à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸žà¸£à¹‰à¸­à¸¡à¸ªà¹ˆà¸‡à¹ƒà¸«à¹‰à¸—à¸µà¸¡</span><small>à¸­à¹ˆà¸²à¸™à¸œà¸¥à¸•à¸£à¸§à¸ˆà¹à¸¥à¸°à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸—à¸³à¸•à¹ˆà¸­à¸à¹ˆà¸­à¸™ à¹à¸¥à¹‰à¸§à¸„à¹ˆà¸­à¸¢à¸”à¸¹à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¹„à¸Ÿà¸¥à¹Œà¸›à¸£à¸°à¸à¸­à¸š</small></div></div><div class="bo-follow-message"><section><div class="bo-follow-section-head"><div><h3>1. à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¸­à¹ˆà¸²à¸™à¸ˆà¸²à¸ BO</h3><small>à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ªà¹ˆà¸§à¸™à¸™à¸µà¹‰à¸¡à¸²à¸ˆà¸²à¸à¹„à¸Ÿà¸¥à¹Œ BO à¸•à¹‰à¸™à¸‰à¸šà¸±à¸š ${num(boFileNames.length)} à¹„à¸Ÿà¸¥à¹Œ à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸£à¸²à¸¢à¸à¸²à¸£à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸‚à¸²à¸”</small></div></div><dl><div><dt>à¸§à¸±à¸™à¸—à¸µà¹ˆ</dt><dd>${h(state.dailySummary.date)}</dd></div><div><dt>à¸£à¸°à¸šà¸š / à¸šà¸£à¸´à¸©à¸±à¸—</dt><dd>${h(item.system || businessSystem)} Â· ${h(normalizeLiveCompanyCode(item.company) || company)}</dd></div><div><dt>à¸šà¸±à¸à¸Šà¸µ / Provider</dt><dd>${h(identity)}</dd></div><div><dt>à¸Šà¸·à¹ˆà¸­à¹€à¸•à¹‡à¸¡à¸ˆà¸²à¸ BO</dt><dd>${labels.length ? labels.map(h).join("<br>") : "-"}</dd></div><div><dt>à¸›à¸£à¸°à¹€à¸ à¸—</dt><dd>${h(item.kind || "STM")} Â· ${h(directionLabel(item.direction))}</dd></div></dl></section><section><h3>2. à¸œà¸¥à¸•à¸£à¸§à¸ˆà¸ˆà¸²à¸ BO</h3><dl><div><dt>${h(summaryLabel)}</dt><dd class="danger">${h(missingSummary)}</dd></div><div><dt>à¸•à¹‰à¸­à¸‡à¸—à¸³à¸•à¹ˆà¸­</dt><dd>${h(nextStepSummary)}</dd></div><div><dt>à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¹„à¸”à¹‰à¸£à¸±à¸š</dt><dd>${h(receivedSummary)}</dd></div><div><dt>à¸ªà¸–à¸²à¸™à¸°à¹€à¸”à¸´à¸¡</dt><dd>${h(info.title)}</dd></div></dl></section><section><div class="bo-follow-section-head"><h3>3. à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸£à¸°à¸šà¸šà¹„à¸”à¹‰à¸£à¸±à¸šà¹à¸¥à¸°à¹ƒà¸Šà¹‰à¸•à¸£à¸§à¸ˆ</h3><b class="bo-follow-count">à¸£à¸§à¸¡ ${num(totalRelatedFiles)} à¹„à¸Ÿà¸¥à¹Œ</b></div><div class="bo-follow-file-group"><h4>à¹„à¸Ÿà¸¥à¹Œ BO à¸•à¹‰à¸™à¸‰à¸šà¸±à¸š <span>${num(boFileNames.length)} à¹„à¸Ÿà¸¥à¹Œ</span></h4>${numberedFileHtml(boFileNames, "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸šà¹„à¸Ÿà¸¥à¹Œ BO à¸•à¹‰à¸™à¸‰à¸šà¸±à¸š")}</div><div class="bo-follow-file-group"><h4>à¹„à¸Ÿà¸¥à¹Œ STM/PM à¸—à¸µà¹ˆà¹„à¸”à¹‰à¸£à¸±à¸š <span>${num(stmFileNames.length)} à¹„à¸Ÿà¸¥à¹Œ</span></h4>${numberedFileHtml(stmFileNames, "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œ STM/PM à¸ªà¸³à¸«à¸£à¸±à¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸™à¸µà¹‰")}</div><p class="bo-follow-file-state"><b>à¸ªà¸–à¸²à¸™à¸° Preview:</b> ${h(previewStatus)}</p></section><section class="action"><h3>4. à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸‚à¸­à¹ƒà¸«à¹‰à¸—à¸µà¸¡à¸•à¸£à¸§à¸ˆ</h3><ol><li>à¸¢à¸·à¸™à¸¢à¸±à¸™à¹€à¸¥à¸‚à¸šà¸±à¸à¸Šà¸µà¸«à¸£à¸·à¸­ Provider à¸§à¹ˆà¸²à¸•à¸£à¸‡à¸à¸±à¸š BO à¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ</li><li>à¸¢à¸·à¸™à¸¢à¸±à¸™à¸—à¸´à¸¨à¸—à¸²à¸‡à¸à¸²à¸/à¸–à¸­à¸™à¸‚à¸­à¸‡à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸ªà¹ˆà¸‡à¸¡à¸²</li><li>à¸«à¸²à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹„à¸¡à¹ˆà¸•à¸£à¸‡ à¸à¸£à¸¸à¸“à¸²à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸ªà¸²à¹€à¸«à¸•à¸¸à¹à¸¥à¸°à¹à¸™à¸šà¸«à¸¥à¸±à¸à¸à¸²à¸™à¸—à¸µà¹ˆà¹€à¸à¸µà¹ˆà¸¢à¸§à¸‚à¹‰à¸­à¸‡</li></ol></section></div><details class="bo-follow-raw"><summary>à¸”à¸¹à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¹à¸šà¸šà¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸¥à¹‰à¸§à¸™</summary><textarea id="boFollowCopyText" readonly>${h(copyText)}</textarea></details></div></div>`,
        `<button class="ghost-button" id="boFollowClose">à¸›à¸´à¸”</button><button class="ghost-button" id="boFollowCloud">à¹€à¸›à¸´à¸”à¸„à¸¥à¸±à¸‡à¹„à¸Ÿà¸¥à¹Œ</button><button class="ghost-button" id="boFollowCases">à¹€à¸›à¸´à¸”à¸«à¸™à¹‰à¸²à¸•à¸´à¸”à¸•à¸²à¸¡à¹€à¸„à¸ª</button>${info.code !== "matched" ? `<button class="primary-button" id="boFollowRetry">à¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¹ƒà¸«à¸¡à¹ˆ</button>` : ""}<button class="primary-button" id="boFollowCopy">à¸„à¸±à¸”à¸¥à¸­à¸à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡</button>`,
      );
      $("#boFollowClose").addEventListener("click", closeModal);
      const retryButton = $("#boFollowRetry");
      if (retryButton) retryButton.addEventListener("click", async () => {
        // The checklist view can legitimately omit job_id even though the
        // selected daily job is present in v_recon_operations. Resolve the
        // exact company/date job from that authoritative row before retrying.
        const selectedOperation = data.operations.find((row) =>
          row.business_date === state.dailySummary.date &&
          normalizeLiveCompanyCode(row.company) === company &&
          !row.is_archived
        );
        const resolvedJob = data.checklist?.job_id || selectedOperation?.id
          ? null
          : await Sb.dailyJob(company, state.dailySummary.date);
        const jobId = data.checklist?.job_id || selectedOperation?.id || resolvedJob?.id;
        if (!jobId) {
          toast("à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸«à¸±à¸ªà¸‡à¸²à¸™à¸£à¸²à¸¢à¸§à¸±à¸™ à¸à¸£à¸¸à¸“à¸²à¹€à¸›à¸´à¸”à¸„à¸¥à¸±à¸‡à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸°à¸à¸”à¸£à¸µà¹€à¸Ÿà¸£à¸Šà¸à¹ˆà¸­à¸™", "warn");
          return;
        }
        retryButton.disabled = true;
        retryButton.textContent = "à¸à¸³à¸¥à¸±à¸‡à¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¹ƒà¸«à¸¡à¹ˆâ€¦";
        try {
          await Sb.retryJob(jobId);
          toast(`à¹€à¸‚à¹‰à¸²à¸„à¸´à¸§à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¹ƒà¸«à¸¡à¹ˆà¹à¸¥à¹‰à¸§ Â· ${state.dailySummary.date} Â· ${company}`);
          closeModal();
          await cloudWorkerTick();
          liveOverviewState.key = "";
          dailyCompanyState.batches = null;
          dailyCompanyState.quality = null;
          dailyCompanyState.operations = null;
          dailyCompanyState.checklist = null;
          dailyCompanyState.caseCounts = null;
          dailyCompanyState.boFirst = null;
          await loadDailyCompanySummary(true);
          render();
        } catch (error) {
          retryButton.disabled = false;
          retryButton.textContent = "à¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¹ƒà¸«à¸¡à¹ˆ";
          toast(`à¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¹ƒà¸«à¸¡à¹ˆà¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: ${error.message}`, "warn");
        }
      });
      $("#boFollowCopy").addEventListener("click", async (event) => {
        await copyPlainText(copyText);
        event.currentTarget.textContent = "à¸„à¸±à¸”à¸¥à¸­à¸à¹à¸¥à¹‰à¸§ âœ“";
        toast("à¸„à¸±à¸”à¸¥à¸­à¸à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸•à¸´à¸”à¸•à¸²à¸¡à¹à¸¥à¹‰à¸§", "ok");
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
    const nextWork = !data.files.length
      ? { route: "cloud", tone: "warn", title: "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œà¸‚à¸­à¸‡à¸§à¸±à¸™à¸™à¸µà¹‰", detail: `à¸£à¸­à¸­à¸µà¹€à¸¡à¸¥/à¹„à¸Ÿà¸¥à¹Œà¸‚à¸­à¸‡ ${company} à¸à¹ˆà¸­à¸™ à¸ˆà¸¶à¸‡à¸ˆà¸°à¸•à¸£à¸§à¸ˆà¸„à¸§à¸²à¸¡à¸„à¸£à¸šà¸–à¹‰à¸§à¸™à¹à¸¥à¸°à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¹„à¸”à¹‰`, button: "à¸•à¸£à¸§à¸ˆà¹„à¸Ÿà¸¥à¹Œà¹€à¸‚à¹‰à¸²" }
      : !boFiles
        ? { route: "cloud", tone: "bad", title: "à¸¢à¸±à¸‡à¸‚à¸²à¸”à¸£à¸²à¸¢à¸‡à¸²à¸™ BO", detail: "BO à¹€à¸›à¹‡à¸™à¹„à¸Ÿà¸¥à¹Œà¸«à¸¥à¸±à¸à¸ªà¸³à¸«à¸£à¸±à¸šà¸£à¸°à¸šà¸¸à¸šà¸±à¸à¸Šà¸µà¹à¸¥à¸° Provider à¸—à¸µà¹ˆà¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸ˆà¸£à¸´à¸‡à¸‚à¸­à¸‡à¸§à¸±à¸™à¸™à¸µà¹‰", button: "à¸•à¸£à¸§à¸ˆà¹„à¸Ÿà¸¥à¹Œ BO" }
        : fileErrors
          ? { route: "cloud", tone: "bad", title: `à¹à¸à¹‰à¹„à¸Ÿà¸¥à¹Œà¸­à¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰ ${num(fileErrors)} à¹„à¸Ÿà¸¥à¹Œ`, detail: "à¹€à¸›à¸´à¸”à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡ à¹€à¸¥à¸·à¸­à¸à¸šà¸£à¸´à¸©à¸±à¸—/à¸›à¸£à¸°à¹€à¸ à¸— à¹à¸¥à¹‰à¸§à¸šà¸±à¸™à¸—à¸¶à¸à¹à¸¥à¸°à¸£à¸±à¸™à¸•à¹ˆà¸­", button: "à¸•à¸£à¸§à¸ˆà¹„à¸Ÿà¸¥à¹Œ" }
      : waitingFiles
        ? { route: "cloud", tone: "warn", title: `à¸£à¸­à¸£à¸°à¸šà¸šà¸­à¹ˆà¸²à¸™ ${num(waitingFiles)} à¹„à¸Ÿà¸¥à¹Œ`, detail: "à¸•à¸£à¸§à¸ˆà¸ªà¸–à¸²à¸™à¸°à¹„à¸Ÿà¸¥à¹Œà¸à¹ˆà¸­à¸™à¹€à¸£à¸´à¹ˆà¸¡à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”", button: "à¸”à¸¹à¹„à¸Ÿà¸¥à¹Œ" }
        : missing.length
          ? { route: "cloud", tone: "warn", title: `à¸•à¸²à¸¡à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸¢à¸±à¸‡à¸‚à¸²à¸” ${num(missing.length)} à¸›à¸£à¸°à¹€à¸ à¸—`, detail: missing.join(" Â· "), button: "à¸”à¸¹à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸‚à¸²à¸”" }
          : data.stillOpen
            ? { route: "exceptions", tone: "warn", title: `à¸•à¸£à¸§à¸ˆà¸£à¸²à¸¢à¸à¸²à¸£à¸„à¹‰à¸²à¸‡ ${num(data.stillOpen)} à¹€à¸„à¸ª`, detail: "à¹€à¸›à¸´à¸”à¸«à¸¥à¸±à¸à¸à¸²à¸™à¹à¸¥à¸°à¸•à¸´à¸”à¸•à¸²à¸¡à¸œà¸¥à¸à¸²à¸£à¸Šà¸µà¹‰à¹à¸ˆà¸‡", button: "à¸•à¸£à¸§à¸ˆà¹€à¸„à¸ª" }
            : !dayComplete
              ? { route: "cloud", tone: "warn", title: "à¸¢à¸±à¸‡à¸¢à¸·à¸™à¸¢à¸±à¸™à¸›à¸´à¸”à¸‡à¸²à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰", detail: completionBlockers.join(" Â· "), button: "à¸•à¸£à¸§à¸ˆà¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸„à¹‰à¸²à¸‡" }
            : { route: "reports", tone: "ok", title: "à¸•à¸£à¸§à¸ˆà¸„à¸£à¸šà¹à¸¥à¹‰à¸§ à¸žà¸£à¹‰à¸­à¸¡à¸­à¸­à¸à¸£à¸²à¸¢à¸‡à¸²à¸™", detail: "à¸•à¸£à¸§à¸ˆà¸¢à¸­à¸”à¸ªà¸£à¸¸à¸›à¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡à¹à¸¥à¹‰à¸§ Export à¹€à¸à¹‡à¸šà¹€à¸›à¹‡à¸™à¸«à¸¥à¸±à¸à¸à¸²à¸™", button: "à¸”à¸¹à¸£à¸²à¸¢à¸‡à¸²à¸™" };
    const sheetRows = dailyAuditSheetRows(state.dailySummary.date);
    const selectedCaseSummary=sheetRows.find(row=>row.company===company);
    const currentCaseCountsReady=selectedCaseSummary?.currentCountsReady&&!selectedCaseSummary.caseSetPending;
    const currentCaseCount=currentCaseCountsReady?num(selectedCaseSummary.openCount):'à¸£à¸­à¸‚à¹‰à¸­à¸¡à¸¹à¸¥';
    const closedCaseCount=currentCaseCountsReady?num(selectedCaseSummary.resolvedCount):'à¸£à¸­à¸‚à¹‰à¸­à¸¡à¸¹à¸¥';
    const auditSheetHtml = `
      <section class="panel audit-sheet-panel">
        <div class="panel-heading"><div><p class="eyebrow">Audit Sheet Â· à¸ à¸²à¸žà¸£à¸§à¸¡à¸—à¸¸à¸à¸šà¸£à¸´à¸©à¸±à¸—</p><h2>à¸ªà¸–à¸²à¸™à¸°à¸‡à¸²à¸™à¸§à¸±à¸™à¸—à¸µà¹ˆ ${h(state.dailySummary.date)}</h2><small class="head-sub">à¸ªà¸£à¸¸à¸›à¸‚à¸¶à¹‰à¸™à¸à¹ˆà¸­à¸™à¸—à¸±à¸™à¸—à¸µ à¸ªà¹ˆà¸§à¸™à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¹à¸•à¹ˆà¸¥à¸°à¸£à¸²à¸¢à¸‡à¸²à¸™à¸ˆà¸°à¹‚à¸«à¸¥à¸”à¹€à¸¡à¸·à¹ˆà¸­à¸à¸”à¹€à¸›à¸´à¸”</small></div><span class="badge blue">${num(sheetRows.length)} à¸šà¸£à¸´à¸©à¸±à¸—</span></div>
        <p class="hint">à¸ˆà¸³à¸™à¸§à¸™à¹€à¸”à¹ˆà¸™à¸„à¸·à¸­à¹€à¸„à¸ªà¸„à¹‰à¸²à¸‡à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™ Â· à¸›à¸´à¸”à¹à¸¥à¹‰à¸§à¸™à¸±à¸šà¸ˆà¸²à¸à¸Šà¸¸à¸”à¹€à¸„à¸ªà¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™ Â· à¸œà¸¥à¸•à¸£à¸§à¸ˆà¸•à¸­à¸™à¸£à¸±à¸™à¹€à¸›à¹‡à¸™à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¸„à¸™à¸¥à¸°à¸ˆà¸³à¸™à¸§à¸™ à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¹€à¸„à¸ªà¸„à¹‰à¸²à¸‡à¸«à¸£à¸·à¸­à¸¢à¸­à¸”à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢</p>
        <div class="table-wrap audit-sheet-wrap"><table class="audit-sheet"><thead><tr><th>à¸šà¸£à¸´à¸©à¸±à¸—</th><th>à¹„à¸Ÿà¸¥à¹Œ</th><th class="right">STM/PM</th><th class="right">BO</th><th class="right">à¸ˆà¸±à¸šà¸„à¸¹à¹ˆ</th><th>à¹€à¸„à¸ªà¸„à¹‰à¸²à¸‡à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™ / à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¸œà¸¥à¸•à¸£à¸§à¸ˆ</th><th>à¸ªà¸–à¸²à¸™à¸°</th><th>à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸—à¸³</th></tr></thead><tbody>
          ${sheetRows.map((row) => {
            const meta = row.resultStatus.primary ? {label:row.resultStatus.label,tone:'green'} : row.resultStatus.manual ? {label:row.resultStatus.manual,tone:'blue'} : row.status === "completed_review"
              ? { label: "à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¹à¸¥à¹‰à¸§ Â· à¸£à¸­à¸•à¸£à¸§à¸ˆà¹€à¸„à¸ª", tone: "amber" }
              : CHECKLIST_STATUS[row.status] || LIVE_STATUS[row.status] || { label: row.status || "à¸£à¸­à¸•à¸£à¸§à¸ˆ", tone: "grey" };
            const fileOk = row.fileCount > 0 && row.parsedCount >= row.fileCount;
            const action = row.resultStatus.primary ? 'à¸”à¸¹à¸œà¸¥à¸«à¸¥à¸±à¸' : row.missing.length || !fileOk ? "à¹à¸à¹‰à¹„à¸Ÿà¸¥à¹Œ" : row.openCount ? "à¸•à¸£à¸§à¸ˆ/à¹à¸ˆà¹‰à¸‡à¹à¸à¹‰" : row.exceptionCount ? "à¹€à¸›à¸´à¸”à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´" : "à¸”à¸¹à¸£à¸²à¸¢à¸‡à¸²à¸™";
return `<tr data-sheet-company="${h(row.company)}"><td><b>${h(row.company)}</b></td><td>${row.resultStatus.primary?'<small class="sub">à¸Šà¸¸à¸”à¹„à¸Ÿà¸¥à¹Œà¸œà¸¥à¸«à¸¥à¸±à¸</small>':'<small class="sub">à¸£à¸­à¸šà¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´</small>'}<span class="sheet-progress ${fileOk ? "ok" : "warn"}">${row.fileCount==null?'à¸£à¸­à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸Šà¸¸à¸”à¹„à¸Ÿà¸¥à¹Œ':`${num(row.parsedCount)}/${num(row.fileCount)}`}</span></td><td class="right tnum">${num(row.stmCount)}</td><td class="right tnum">${num(row.boCount)}</td><td class="right"><b class="${row.matched ? "success" : "muted"}">${num(row.matched)}</b></td><td>${DailyCaseSummary.markup(row)}</td><td><span class="badge ${h(meta.tone)}">${h(meta.label)}</span>${row.resultStatus.review?`<small role="alert">${h(row.resultStatus.review)}</small>`:''}${row.resultStatus.manual?`<small class="sub">${h(row.resultStatus.manual)}</small>`:''}<small class="sub">${h(row.resultStatus.automatic)}</small>${row.resultStatus.error?`<small role="alert">${h(row.resultStatus.error)}</small>`:''}</td><td class="nowrap"><button class="ghost-button xs" data-sheet-open="${h(row.company)}">à¸”à¸¹à¸£à¸²à¸¢à¸‡à¸²à¸™</button><button class="${row.openCount || row.missing.length ? "primary-button" : "ghost-button"} xs" data-sheet-action="${h(row.company)}" data-sheet-mode="${row.resultStatus.primary ? "report" : row.missing.length || !fileOk ? "files" : row.openCount ? "issues" : row.exceptionCount ? "approve" : "report"}">${h(action)}</button></td></tr>`;
          }).join("") || `<tr><td colspan="8" class="empty">à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸ªà¸–à¸²à¸™à¸°à¸šà¸£à¸´à¸©à¸±à¸—à¹ƒà¸™à¸§à¸±à¸™à¸™à¸µà¹‰ â€” à¸£à¸°à¸šà¸šà¸ˆà¸°à¹à¸ªà¸”à¸‡à¹€à¸¡à¸·à¹ˆà¸­à¹„à¸”à¹‰à¸£à¸±à¸šà¸­à¸µà¹€à¸¡à¸¥à¸«à¸£à¸·à¸­à¸¡à¸µà¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”</td></tr>`}
        </tbody></table></div>
      </section>`;
    root.innerHTML = controls + rulesPanel + `
      ${auditSheetHtml}
      <section class="daily-summary-head"><div><p class="eyebrow">à¸ªà¸£à¸¸à¸›à¸›à¸£à¸°à¸ˆà¸³à¸§à¸±à¸™</p><h2>${h(company)} Â· ${h(state.dailySummary.date)}</h2><p>à¸­à¸±à¸›à¹€à¸”à¸•à¸ˆà¸²à¸ Supabase ${dailyCompanyState.updatedAt ? displayTime(dailyCompanyState.updatedAt) : "-"}${dailyCompanyState.detailsLoading ? " Â· à¸à¸³à¸¥à¸±à¸‡à¹€à¸•à¸´à¸¡à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¹€à¸„à¸ª" : ""}</p></div><span class="badge ${status.tone}">${h(status.label)}</span></section>
      ${dailyCompanyState.coreError ? `<section class="alert warn"><strong>à¹à¸ªà¸”à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸—à¸µà¹ˆà¹‚à¸«à¸¥à¸”à¸ªà¸³à¹€à¸£à¹‡à¸ˆà¸à¹ˆà¸­à¸™</strong><span>${h(dailyCompanyState.coreError)} à¸à¸”à¸£à¸µà¹€à¸Ÿà¸£à¸Šà¹€à¸žà¸·à¹ˆà¸­à¸¥à¸­à¸‡à¹€à¸‰à¸žà¸²à¸°à¸ªà¹ˆà¸§à¸™à¸—à¸µà¹ˆà¸¢à¸±à¸‡à¸‚à¸²à¸”à¹„à¸”à¹‰</span></section>` : ""}
      ${dailyCompanyState.detailsError ? `<section class="alert warn"><strong>à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸«à¸¥à¸±à¸à¸žà¸£à¹‰à¸­à¸¡à¹à¸¥à¹‰à¸§</strong><span>${h(dailyCompanyState.detailsError)} â€” à¸•à¸±à¸§à¹€à¸¥à¸‚à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸°à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸«à¸¥à¸±à¸à¸¢à¸±à¸‡à¹€à¸›à¸´à¸”à¸”à¸¹à¹„à¸”à¹‰</span></section>` : ""}
      <section class="primary-result-note"><strong>à¹à¸¢à¸à¸ªà¸–à¸²à¸™à¸°à¸£à¸­à¸šà¸‡à¸²à¸™</strong><p>à¸œà¸¥à¸«à¸¥à¸±à¸: ${selectedResultStatus.primary?'à¹ƒà¸Šà¹‰à¸œà¸¥à¸£à¸±à¸™à¸¡à¸·à¸­à¸—à¸µà¹ˆà¸«à¸±à¸§à¸«à¸™à¹‰à¸²/à¸œà¸¹à¹‰à¸”à¸¹à¹à¸¥à¸¢à¸·à¸™à¸¢à¸±à¸™à¹à¸¥à¹‰à¸§':'à¸¢à¸±à¸‡à¹ƒà¸Šà¹‰à¸œà¸¥à¸£à¸­à¸šà¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´à¹€à¸”à¸´à¸¡ à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸™à¸³à¸œà¸¥à¸£à¸±à¸™à¸¡à¸·à¸­à¸¡à¸²à¹à¸—à¸™'}</p>${selectedResultStatus.review?`<p role="alert" class="mc8-warning">${h(selectedResultStatus.review)}</p>`:''}${selectedResultStatus.manual?`<p>${h(selectedResultStatus.manual)}</p>`:''}<p>${h(selectedResultStatus.automatic)} Â· à¸ªà¸–à¸²à¸™à¸°à¸™à¸µà¹‰à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸ªà¸–à¸²à¸™à¸°à¸‚à¸­à¸‡à¸œà¸¥à¸£à¸±à¸™à¸¡à¸·à¸­</p>${selectedResultStatus.error?`<p role="alert">${h(selectedResultStatus.error)}</p>`:''}</section>
      ${AccountRecheck.reportPanel((dailyCompanyState.confirmedRechecks||[]).filter(q=>q.company===company&&q.business_date===state.dailySummary.date))}
${data.quality.filter(r=>r.primaryResult).map(r=>`<section class="primary-result-note"><strong>à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸«à¸¥à¸±à¸à¹ƒà¸Šà¹‰à¸œà¸¥à¸•à¸£à¸§à¸ˆà¸¡à¸·à¸­à¹à¸¥à¹‰à¸§</strong>${window.ManualPrimary.noticeInfo(r.primaryResult)}<p>${r.primaryResult.case_set?'à¸£à¸²à¸¢à¸à¸²à¸£à¸‡à¸²à¸™à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™à¹ƒà¸Šà¹‰à¹€à¸„à¸ªà¸Šà¸¸à¸”à¹ƒà¸«à¸¡à¹ˆ Â· à¹€à¸„à¸ªà¹€à¸”à¸´à¸¡à¸”à¸¹à¹„à¸”à¹‰à¹ƒà¸™à¸«à¸™à¹‰à¸²à¸Šà¸µà¸• Audit':'à¸£à¸²à¸¢à¸à¸²à¸£à¹€à¸„à¸ªà¸”à¹‰à¸²à¸™à¸¥à¹ˆà¸²à¸‡à¹€à¸›à¹‡à¸™à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¹€à¸„à¸ªà¹€à¸”à¸´à¸¡'}</p></section>`).join('')}
      ${dailyCompanyState.recheckReportError?`<p role="alert">${h(dailyCompanyState.recheckReportError)} Â· à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸¢à¸­à¸”à¸¨à¸¹à¸™à¸¢à¹Œ</p>`:''}
      <section class="panel daily-focus-board">
        <div class="daily-focus-title"><div><p class="eyebrow">à¸ à¸²à¸žà¸£à¸§à¸¡à¸à¸²à¸£à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸” 3 à¸ˆà¸¸à¸”</p><h2>STM / PM â†” à¹€à¸§à¸¥à¸²à¹à¸¥à¸°à¸šà¸±à¸à¸Šà¸µ â†” BO</h2><small>à¸•à¸±à¸§à¹€à¸¥à¸‚à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¸¡à¸²à¸ˆà¸²à¸à¸œà¸¥à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸°à¸œà¸¥à¸£à¸±à¸™à¸ˆà¸£à¸´à¸‡à¸‚à¸­à¸‡ ${h(company)} à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™</small></div><span class="badge ${status.tone}">${h(status.label)}</span></div>
        <div class="daily-reconcile-tiles action-tiles">
          <article data-action-route="cloud"><span>à¸£à¸²à¸¢à¸à¸²à¸£ STM / PM</span><strong>${num(stm)}</strong><small>${num(stmFiles + pmFiles)} à¹„à¸Ÿà¸¥à¹Œà¸•à¹‰à¸™à¸—à¸²à¸‡</small></article>
          <article data-action-route="cloud"><span>à¸£à¸²à¸¢à¸à¸²à¸£ BO</span><strong>${num(bo)}</strong><small>${num(boFiles)} à¹„à¸Ÿà¸¥à¹Œà¸•à¹‰à¸™à¸—à¸²à¸‡</small></article>
          <article data-scroll-daily="dailyReconcileResult" class="ok"><span>à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¸œà¹ˆà¸²à¸™ 3 à¸ˆà¸¸à¸”</span><strong>${num(matched)}</strong><small>${matchRate.toFixed(2)}% à¸‚à¸­à¸‡ STM / PM</small></article>
          <article data-action-route="exceptions" class="${data.stillOpen ? "warn" : "ok"}"><span>à¹€à¸„à¸ªà¸„à¹‰à¸²à¸‡à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™</span><strong>${h(currentCaseCount)}</strong><small>à¹„à¸¡à¹ˆà¸£à¸§à¸¡à¹€à¸„à¸ªà¸›à¸´à¸”à¹à¸¥à¹‰à¸§ Â· à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸ˆà¸³à¸™à¸§à¸™à¸œà¸¥à¸•à¸£à¸§à¸ˆà¸•à¸­à¸™à¸£à¸±à¸™</small></article>
          <article data-action-route="clarify" class="ok"><span>à¹€à¸„à¸ªà¸›à¸´à¸”à¹à¸¥à¹‰à¸§</span><strong>${h(closedCaseCount)}</strong><small>à¹€à¸‰à¸žà¸²à¸°à¸Šà¸¸à¸”à¹€à¸„à¸ªà¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™ Â· à¹„à¸¡à¹ˆà¸£à¸§à¸¡à¹€à¸„à¸ªà¸£à¸¸à¹ˆà¸™à¹€à¸à¹ˆà¸²à¸—à¸µà¹ˆà¸–à¸¹à¸à¹à¸—à¸™</small></article>
        </div>
        ${riskIsPartial?`<p class="hint">à¸¢à¸­à¸”à¸—à¸µà¹ˆà¸•à¸£à¸§à¸ˆà¸žà¸šà¹ƒà¸™ ${num(data.exceptions.length)} à¹€à¸„à¸ªà¹à¸£à¸ à¸­à¸¢à¹ˆà¸²à¸‡à¸™à¹‰à¸­à¸¢ ${money0(risk)} à¸šà¸²à¸— Â· à¹€à¸›à¹‡à¸™à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸šà¸²à¸‡à¸ªà¹ˆà¸§à¸™à¸£à¸§à¸¡à¹€à¸„à¸ªà¸›à¸´à¸”à¹à¸¥à¹‰à¸§ à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸¢à¸­à¸”à¹€à¸„à¸ªà¸„à¹‰à¸²à¸‡à¸«à¸£à¸·à¸­à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢à¸¢à¸·à¸™à¸¢à¸±à¸™</p>`:''}
        <div class="daily-difference-strip"><div class="${stm === bo ? "ok" : "warn"}"><span>à¸ˆà¸³à¸™à¸§à¸™à¸£à¸²à¸¢à¸à¸²à¸£ STM/PM à¹€à¸—à¸µà¸¢à¸š BO</span><b>${num(stm - bo)}</b></div><div class="${data.stillOpen ? "bad" : "ok"}"><span>à¹€à¸„à¸ªà¸„à¹‰à¸²à¸‡à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸•à¸´à¸”à¸•à¸²à¸¡</span><b>${h(currentCaseCount)}</b></div><div class="${damageTotal ? "bad" : evidenceFiles ? "warn" : "ok"}"><span>à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢à¸—à¸µà¹ˆà¸¢à¸·à¸™à¸¢à¸±à¸™à¹à¸¥à¹‰à¸§</span><b>${h(damageDisplay)}</b></div></div>
        <button type="button" class="daily-next-work ${nextWork.tone}" data-action-route="${nextWork.route}"><span><small>à¸‚à¸±à¹‰à¸™à¸–à¸±à¸”à¹„à¸›à¸—à¸µà¹ˆà¹à¸™à¸°à¸™à¸³</small><b>${h(nextWork.title)}</b><em>${h(nextWork.detail)}</em></span><strong>${h(nextWork.button)} â†’</strong></button>
      </section>
      <section class="daily-source-summary" aria-label="à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¹„à¸”à¹‰à¸£à¸±à¸š"><article><span>à¸­à¸µà¹€à¸¡à¸¥à¸—à¸µà¹ˆà¹„à¸”à¹‰à¸£à¸±à¸š</span><b>${num(data.batches.length)} à¸‰à¸šà¸±à¸š</b><small>à¹€à¸­à¸à¸ªà¸²à¸£à¹à¸™à¸šà¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” ${num(data.files.length)} à¹„à¸Ÿà¸¥à¹Œ</small></article><article><span>STM à¸˜à¸™à¸²à¸„à¸²à¸£</span><b>${num(stmFiles)} à¹„à¸Ÿà¸¥à¹Œ</b></article><article><span>BO à¸«à¸¥à¸±à¸‡à¸šà¹‰à¸²à¸™</span><b>${num(boFiles)} à¹„à¸Ÿà¸¥à¹Œ</b></article><article><span>PM à¸à¸²à¸/à¸–à¸­à¸™</span><b>${num(pmFiles)} à¹„à¸Ÿà¸¥à¹Œ</b></article><article><span>à¸«à¸¥à¸±à¸à¸à¸²à¸™à¸Šà¸µà¹‰à¹à¸ˆà¸‡</span><b>${num(evidenceFiles)} à¹„à¸Ÿà¸¥à¹Œ</b><small>${evidenceFiles ? "à¸£à¸­à¸œà¸¹à¹‰à¸•à¸£à¸§à¸ˆà¸¢à¸·à¸™à¸¢à¸±à¸™à¸à¹ˆà¸­à¸™à¸šà¸±à¸™à¸—à¸¶à¸à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢" : "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸«à¸¥à¸±à¸à¸à¸²à¸™à¸Šà¸µà¹‰à¹à¸ˆà¸‡"}</small></article><article class="${fileErrors ? "bad" : reconciliationReady ? "ok" : "warn"}"><span>à¹„à¸Ÿà¸¥à¹Œà¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸—à¸µà¹ˆà¸­à¹ˆà¸²à¸™à¸ªà¸³à¹€à¸£à¹‡à¸ˆ</span><b>${num(parsed)}/${num(data.reconciliationFiles.length)}</b></article>
      </section>
      <section class="daily-audit-flow" aria-label="à¸ªà¸–à¸²à¸™à¸°à¸‡à¸²à¸™à¸£à¸²à¸¢à¸§à¸±à¸™"><button type="button" data-daily-route="cloud" class="${data.files.length ? "done" : "bad"}"><b>1</b><span>à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œ<small>${num(data.files.length)} à¹„à¸Ÿà¸¥à¹Œ Â· à¸à¸”à¸•à¸£à¸§à¸ˆ</small></span></button><button type="button" data-daily-route="cloud" class="${reconciliationReady ? "done" : "warn"}"><b>2</b><span>à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”<small>${num(parsed)}/${num(data.reconciliationFiles.length)} à¸ªà¸³à¹€à¸£à¹‡à¸ˆ Â· à¸«à¸¥à¸±à¸à¸à¸²à¸™ ${num(evidenceFiles)} à¹„à¸Ÿà¸¥à¹Œ</small></span></button><button type="button" data-scroll-daily="dailyReconcileResult" class="${data.quality.length ? "done" : "warn"}"><b>3</b><span>à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”<small>${h(status.label)} Â· à¸à¸”à¸”à¸¹à¸œà¸¥</small></span></button><button type="button" data-daily-route="exceptions" class="${data.exceptionTotal ? "warn" : "done"}"><b>4</b><span>à¸•à¸£à¸§à¸ˆ Exception<small>${num(data.exceptionTotal)} à¹€à¸„à¸ª Â· à¸à¸”à¸•à¸£à¸§à¸ˆ</small></span></button><button type="button" data-daily-route="clarify" class="${data.stillOpen ? "warn" : "done"}"><b>5</b><span>à¸›à¸´à¸”à¸‡à¸²à¸™<small>à¸›à¸´à¸”à¹à¸¥à¹‰à¸§ ${num(data.resolvedTotal)} Â· à¸à¸”à¸•à¸´à¸”à¸•à¸²à¸¡</small></span></button></section>

      <section class="panel bo-document-summary">
        <div class="panel-heading"><div><p class="eyebrow">BO-first document check</p><h2>à¸ªà¸£à¸¸à¸›à¹€à¸­à¸à¸ªà¸²à¸£ BO à¸—à¸µà¹ˆà¸•à¸£à¸§à¸ˆ</h2><small class="head-sub">à¸£à¸°à¸šà¸š ${h(businessSystem)} Â· à¸šà¸£à¸´à¸©à¸±à¸— ${h(company)} Â· BO à¹€à¸›à¹‡à¸™à¸«à¸¥à¸±à¸à¹ƒà¸™à¸à¸²à¸£à¸£à¸°à¸šà¸¸à¸šà¸±à¸à¸Šà¸µà¹à¸¥à¸° Provider à¸—à¸µà¹ˆà¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸ˆà¸£à¸´à¸‡ à¹à¸¥à¹‰à¸§à¸ˆà¸¶à¸‡à¸•à¸²à¸¡à¸«à¸² STM/PM à¸‚à¸­à¸‡à¸šà¸£à¸´à¸©à¸±à¸—à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™</small></div><span class="health ${boSourceFiles.length >= boExpected && !boMissing.length ? "ok" : "attention"}">${num(boSourceFiles.length)}/${num(boExpected)} à¹„à¸Ÿà¸¥à¹Œ BO</span></div>
        <div class="bo-document-metrics"><article><span>à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¸­à¹ˆà¸²à¸™à¸ˆà¸²à¸ BO</span><b>${num(bo)}</b></article><article><span>à¸šà¸±à¸à¸Šà¸µ/Provider à¸—à¸µà¹ˆà¸žà¸š</span><b>${num(boRequired.length)}</b></article><article class="${boMissing.length ? "bad" : "ok"}"><span>à¸¢à¸±à¸‡à¸ˆà¸±à¸šà¸„à¸¹à¹ˆ STM/PM à¹„à¸¡à¹ˆà¹„à¸”à¹‰</span><b>${num(boMissing.length)}</b></article><article class="${data.boFirst?.complete ? "ok" : "warn"}"><span>à¸œà¸¥à¸•à¸£à¸§à¸ˆ BO-first</span><b>${data.boFirst ? (data.boFirst.complete ? "à¸„à¸£à¸š" : "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸„à¸£à¸š") : "à¸£à¸­à¸œà¸¥à¸£à¸±à¸™"}</b></article></div>
        <div class="bo-document-layout"><div><h3>à¹„à¸Ÿà¸¥à¹Œ BO à¸•à¹‰à¸™à¸‰à¸šà¸±à¸š</h3><div class="bo-file-list">${boFileCards || `<div class="empty-box">à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸šà¹„à¸Ÿà¸¥à¹Œ BO à¸‚à¸­à¸‡ ${h(company)} à¸§à¸±à¸™à¸—à¸µà¹ˆ ${h(state.dailySummary.date)}</div>`}</div></div><div><h3>à¸šà¸±à¸à¸Šà¸µ/Provider à¸—à¸µà¹ˆ BO à¸£à¸°à¸šà¸¸</h3><div class="table-wrap compact-table"><table><thead><tr><th>à¸£à¸°à¸šà¸š</th><th>à¸šà¸£à¸´à¸©à¸±à¸—</th><th>à¸šà¸±à¸à¸Šà¸µ / Provider</th><th>à¸Šà¸·à¹ˆà¸­à¹€à¸•à¹‡à¸¡à¸ˆà¸²à¸ BO</th><th>à¸›à¸£à¸°à¹€à¸ à¸—</th><th class="right">à¸£à¸²à¸¢à¸à¸²à¸£ BO</th><th class="right">à¸¢à¸­à¸”à¸£à¸§à¸¡</th><th>STM/PM à¸„à¸¹à¹ˆà¸à¸±à¸™</th></tr></thead><tbody>${boRequirementRows || `<tr><td colspan="8" class="empty">à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸œà¸¥à¸­à¹ˆà¸²à¸™ BO-first â€” à¹€à¸¡à¸·à¹ˆà¸­à¸­à¹ˆà¸²à¸™ BO à¸ªà¸³à¹€à¸£à¹‡à¸ˆ à¸£à¸°à¸šà¸šà¸ˆà¸°à¹à¸ªà¸”à¸‡à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆà¸•à¸£à¸‡à¸™à¸µà¹‰</td></tr>`}</tbody></table></div></div></div>
        ${unmatchedReceived.length ? `<div class="bo-unmatched-received"><h3>à¹„à¸Ÿà¸¥à¹Œ STM/PM à¸—à¸µà¹ˆà¹„à¸”à¹‰à¸£à¸±à¸šà¹à¸¥à¸°à¸­à¹ˆà¸²à¸™à¹à¸¥à¹‰à¸§ à¹à¸•à¹ˆà¸¢à¸±à¸‡à¸ˆà¸±à¸šà¸à¸±à¸š BO à¹„à¸¡à¹ˆà¹„à¸”à¹‰</h3><div class="table-wrap compact-table"><table><thead><tr><th>à¸£à¸°à¸šà¸š</th><th>à¸šà¸£à¸´à¸©à¸±à¸—</th><th>à¸šà¸±à¸à¸Šà¸µ / Provider à¸—à¸µà¹ˆà¸­à¹ˆà¸²à¸™à¹„à¸”à¹‰</th><th>à¸›à¸£à¸°à¹€à¸ à¸—</th><th class="right">à¸£à¸²à¸¢à¸à¸²à¸£</th><th>à¹„à¸Ÿà¸¥à¹Œà¸•à¹‰à¸™à¸—à¸²à¸‡</th></tr></thead><tbody>${unmatchedReceivedRows}</tbody></table></div></div>` : ""}
        <div class="alert ${data.boFirst?.complete ? "ok" : "warn"} bo-follow-summary"><div><strong>${data.boFirst?.complete ? "à¸žà¸šà¹„à¸Ÿà¸¥à¹Œà¸„à¸¹à¹ˆà¸„à¸£à¸šà¸•à¸²à¸¡ BO" : boMissing.length ? `à¸•à¹‰à¸­à¸‡à¸•à¸²à¸¡ STM/PM à¸­à¸µà¸ ${num(boMissing.length)} à¸à¸¥à¸¸à¹ˆà¸¡` : "à¸£à¸­à¸­à¹ˆà¸²à¸™ BO à¸«à¸£à¸·à¸­à¸£à¸­à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”"}</strong><span>${data.boFirst?.complete ? "à¸£à¸°à¸šà¸šà¸•à¸£à¸§à¸ˆà¸šà¸±à¸à¸Šà¸µ/Provider à¹à¸¥à¸°à¸—à¸´à¸¨à¸—à¸²à¸‡à¸à¸²à¸-à¸–à¸­à¸™à¸ˆà¸²à¸ BO à¹à¸¥à¹‰à¸§à¸žà¸šà¸à¸±à¹ˆà¸‡ STM/PM à¸„à¸£à¸š" : boMissing.length ? boMissing.map((item) => `${item.label || item.identity} ${directionLabel(item.direction)}`).join(" Â· ") : "à¸£à¸°à¸šà¸šà¸ˆà¸°à¹„à¸¡à¹ˆà¸ªà¸£à¸¸à¸›à¸§à¹ˆà¸²à¸‚à¸²à¸”à¸ˆà¸²à¸à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” à¹à¸•à¹ˆà¸ˆà¸°à¸¢à¸¶à¸”à¹€à¸‰à¸žà¸²à¸°à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸žà¸šà¸§à¹ˆà¸²à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸ˆà¸£à¸´à¸‡à¹ƒà¸™ BO à¸‚à¸­à¸‡à¸§à¸±à¸™à¸™à¸µà¹‰"}</span></div>${boMissing.length ? `<button type="button" class="primary-button sm" id="boOpenFirstFollow">à¹€à¸›à¸´à¸”à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸à¸¥à¸¸à¹ˆà¸¡à¹à¸£à¸</button>` : ""}</div>
      </section>

      <section class="panel company-day-checklist">
        <div class="panel-heading"><div><p class="eyebrow">à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸„à¸£à¸šà¹ƒà¸™à¸§à¸±à¸™à¸™à¸µà¹‰</p><h2>Checklist ${h(company)}</h2></div><span class="health ${dayComplete ? "ok" : "attention"}">${!checklistReady ? "Checklist à¸à¸³à¸¥à¸±à¸‡à¸­à¸±à¸›à¹€à¸”à¸•" : missing.length ? `à¸•à¹‰à¸­à¸‡à¸•à¸²à¸¡ ${num(missing.length)} à¹€à¸£à¸·à¹ˆà¸­à¸‡` : data.stillOpen ? `à¸£à¸­à¸•à¸£à¸§à¸ˆ ${num(data.stillOpen)} à¹€à¸„à¸ª` : dayComplete ? "Checklist à¸„à¸£à¸š Â· à¸•à¸£à¸§à¸ˆà¸à¸²à¸£à¸¢à¸·à¸™à¸¢à¸±à¸™ Audit à¸•à¹ˆà¸­" : "à¸¢à¸±à¸‡à¸•à¸£à¸§à¸ˆà¹„à¸¡à¹ˆà¸„à¸£à¸š"}</span></div>
        <div class="checklist-cards">
          ${[
            ["à¹€à¸¡à¸¥à¹à¸¥à¸°à¹„à¸Ÿà¸¥à¹Œ", data.files.length > 0, `${num(data.batches.length)} à¹€à¸¡à¸¥ Â· ${num(data.files.length)} à¹„à¸Ÿà¸¥à¹Œ`, false],
            ["STM à¸‚à¸­à¸‡à¸šà¸±à¸à¸Šà¸µà¸—à¸µà¹ˆà¸žà¸šà¹ƒà¸™ BO", Boolean(data.boFirst) && stmRequiredByBo.length > 0 && stmMissingByBo.length === 0, data.boFirst ? `${num(stmRequiredByBo.length - stmMissingByBo.length)}/${num(stmRequiredByBo.length)} à¸à¸¥à¸¸à¹ˆà¸¡à¸•à¸²à¸¡ BO Â· à¸£à¸±à¸š ${num(checklistStmCount)} à¹„à¸Ÿà¸¥à¹Œ` : `${num(checklistStmCount)} à¹„à¸Ÿà¸¥à¹Œ Â· à¸£à¸­à¸­à¹ˆà¸²à¸™ BO`, !data.boFirst || !stmRequiredByBo.length],
            ["à¸£à¸²à¸¢à¸‡à¸²à¸™ BO à¸šà¸±à¸‡à¸„à¸±à¸š", checklistBoCount >= boExpected, `${num(checklistBoCount)}/${num(boExpected)} à¹„à¸Ÿà¸¥à¹Œ`, false],
            ["PM D/W à¸‚à¸­à¸‡ Provider à¸—à¸µà¹ˆà¸žà¸šà¹ƒà¸™ BO", Boolean(data.boFirst) && pmRequiredByBo.length > 0 && pmMissingByBo.length === 0, data.boFirst ? `${num(pmRequiredByBo.length - pmMissingByBo.length)}/${num(pmRequiredByBo.length)} à¸à¸¥à¸¸à¹ˆà¸¡à¸•à¸²à¸¡ BO Â· à¸£à¸±à¸š ${num(checklistPmCount)} à¹„à¸Ÿà¸¥à¹Œ` : `${num(checklistPmCount)} à¹„à¸Ÿà¸¥à¹Œ Â· à¸£à¸­à¸­à¹ˆà¸²à¸™ BO`, !data.boFirst || !pmRequiredByBo.length],
            ["à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¸ªà¸³à¸«à¸£à¸±à¸šà¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”", reconciliationReady, fileErrors ? `à¸­à¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰ ${num(fileErrors)}` : `${num(parsed)}/${num(data.reconciliationFiles.length)} à¸ªà¸³à¹€à¸£à¹‡à¸ˆ Â· à¸«à¸¥à¸±à¸à¸à¸²à¸™ ${num(evidenceFiles)} à¹„à¸Ÿà¸¥à¹Œà¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¹à¸›à¸¥à¸‡à¸£à¸²à¸¢à¸à¸²à¸£`, false],
            ["à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¹à¸¥à¸°à¸›à¸´à¸”à¹€à¸„à¸ª", dayComplete, latestStatus === "completed" ? `à¸ˆà¸±à¸šà¸„à¸¹à¹ˆ ${num(matched)} Â· à¸„à¹‰à¸²à¸‡ ${num(data.stillOpen)}` : h(status.label), false],
          ].map(([label, ok, detail, optional]) => scheduled
            ? `<article class="optional"><i>â€“</i><div><b>${h(label)}</b><small>à¸£à¸­à¸§à¸±à¸™à¸—à¸³à¸à¸²à¸£</small></div></article>`
            : `<article class="${ok ? "ok" : optional ? "optional" : "missing"}"><i>${ok ? "âœ“" : optional ? "â€“" : "!"}</i><div><b>${h(label)}</b><small>${h(detail)}${optional && !ok ? " Â· à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸›à¸£à¸°à¸à¸­à¸š" : ""}</small></div></article>`).join("")}
        </div>
        ${scheduled ? `<div class="alert"><strong>à¹€à¸•à¸£à¸µà¸¢à¸¡ Checklist à¹à¸¥à¹‰à¸§</strong><span>à¸£à¸°à¸šà¸šà¸ˆà¸°à¹€à¸£à¸´à¹ˆà¸¡à¸šà¸±à¸™à¸—à¸¶à¸à¸ªà¸–à¸²à¸™à¸°à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´à¹€à¸¡à¸·à¹ˆà¸­à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸§à¸±à¸™à¸—à¸µà¹ˆ ${h(state.dailySummary.date)}</span></div>` : !checklistReady ? `<div class="alert warn"><strong>Checklist à¸£à¸²à¸¢à¸šà¸±à¸à¸Šà¸µà¸¢à¸±à¸‡à¹‚à¸«à¸¥à¸”à¹„à¸¡à¹ˆà¸„à¸£à¸š</strong><span>à¸œà¸¥à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸°à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸”à¹‰à¸²à¸™à¸šà¸™à¹€à¸›à¹‡à¸™à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸£à¸´à¸‡à¹à¸¥à¸°à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¹„à¸”à¹‰ à¸£à¸°à¸šà¸šà¸à¸³à¸¥à¸±à¸‡à¸­à¸±à¸›à¹€à¸”à¸•à¸£à¸²à¸¢à¸à¸²à¸£à¸šà¸±à¸à¸Šà¸µà¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸„à¸£à¸šà¹à¸¢à¸à¸•à¹ˆà¸²à¸‡à¸«à¸²à¸</span></div>` : missing.length ? `<div class="alert warn"><strong>à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸•à¸²à¸¡</strong><span>${h(missing.join(" Â· "))}</span></div>` : data.stillOpen ? `<div class="alert warn"><strong>à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸°à¸à¸²à¸£à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸žà¸£à¹‰à¸­à¸¡à¹à¸¥à¹‰à¸§</strong><span>à¸¢à¸±à¸‡à¸¡à¸µ ${num(data.stillOpen)} à¹€à¸„à¸ªà¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆ à¸Šà¸µà¹‰à¹à¸ˆà¸‡ à¸«à¸£à¸·à¸­à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¸à¹ˆà¸­à¸™à¸›à¸´à¸”à¸‡à¸²à¸™</span></div>` : !dayComplete ? `<div class="alert warn"><strong>à¸¢à¸±à¸‡à¸¢à¸·à¸™à¸¢à¸±à¸™à¸›à¸´à¸”à¸‡à¸²à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰</strong><span>${h(completionBlockers.join(" Â· "))}</span></div>` : `<div class="alert ok"><strong>Checklist à¸šà¸±à¸‡à¸„à¸±à¸šà¸„à¸£à¸š Â· à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸à¸²à¸£à¸¢à¸·à¸™à¸¢à¸±à¸™à¸ˆà¸²à¸ Audit</strong><span>BO à¸„à¸£à¸šà¸•à¸²à¸¡à¸£à¸°à¸šà¸š à¹„à¸Ÿà¸¥à¹Œà¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸­à¹ˆà¸²à¸™à¸ªà¸³à¹€à¸£à¹‡à¸ˆ à¹à¸¥à¸°à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸„à¸ªà¸„à¹‰à¸²à¸‡ Â· STM/PM à¸•à¸£à¸§à¸ˆà¹€à¸—à¸µà¸¢à¸šà¸à¸±à¸šà¸šà¸±à¸à¸Šà¸µà¸—à¸µà¹ˆà¹ƒà¸Šà¹‰à¸ˆà¸£à¸´à¸‡à¸‚à¸­à¸‡à¸§à¸±à¸™à¸™à¸µà¹‰</span></div>`}
        ${data.checklist?.registry_warning ? `<div class="alert warn registry-alert"><strong>à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¸—à¸µà¹ˆà¸„à¸§à¸£à¸¢à¸·à¸™à¸¢à¸±à¸™</strong><span>${h(data.checklist.registry_warning)}</span></div>` : ""}
      </section>

      <section class="grid-2 daily-summary-grid">
        <div class="panel"><div class="panel-heading"><div><p class="eyebrow">File coverage</p><h2>à¹„à¸”à¹‰à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œà¸›à¸£à¸°à¹€à¸ à¸—à¹ƒà¸”à¸šà¹‰à¸²à¸‡</h2></div><span class="health ${coverageComplete ? "ok" : "attention"}">${coverageComplete ? "à¸„à¸£à¸šà¸•à¸²à¸¡ BO à¹à¸¥à¸°à¸à¸Ž" : boMissing.length ? `à¸¢à¸±à¸‡à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¹„à¸¡à¹ˆà¹„à¸”à¹‰ ${num(boMissing.length)} à¸à¸¥à¸¸à¹ˆà¸¡` : missing.length ? `à¸¢à¸±à¸‡à¸‚à¸²à¸” ${num(missing.length)} à¸›à¸£à¸°à¹€à¸ à¸—` : "à¸¢à¸±à¸‡à¸¢à¸·à¸™à¸¢à¸±à¸™à¸„à¸§à¸²à¸¡à¸„à¸£à¸šà¸–à¹‰à¸§à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰"}</span></div><div class="daily-kind-list">${kindCounts.map(([label, count]) => `<div><span>${h(label)}</span><b>${num(count)} à¹„à¸Ÿà¸¥à¹Œ</b></div>`).join("") || `<p class="empty-box">à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸šà¹„à¸Ÿà¸¥à¹Œà¸‚à¸­à¸‡ ${h(company)} à¹ƒà¸™à¸§à¸±à¸™à¸™à¸µà¹‰</p>`}</div>${missing.length ? `<div class="alert warn"><strong>à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸£à¸°à¸šà¸šà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸š</strong><span>${h(missing.join(", "))}</span><small>à¸­à¸²à¸ˆà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹€à¸‚à¹‰à¸² à¸«à¸£à¸·à¸­à¸£à¸°à¸šà¸šà¸¢à¸±à¸‡à¸ˆà¸³à¹à¸™à¸à¸šà¸£à¸´à¸©à¸±à¸—/à¸›à¸£à¸°à¹€à¸ à¸—à¹„à¸¡à¹ˆà¸–à¸¹à¸ à¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆà¸ˆà¸²à¸à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¹„à¸Ÿà¸¥à¹Œà¸”à¹‰à¸²à¸™à¸¥à¹ˆà¸²à¸‡à¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡</small></div>` : ""}</div>
        <div class="panel" id="dailyReconcileResult"><div class="panel-heading"><div><p class="eyebrow">Reconciliation result</p><h2>à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”</h2></div><span class="badge ${status.tone}">${h(status.label)}</span></div><ul class="report-list compact"><li><span>à¸£à¸²à¸¢à¸à¸²à¸£à¸à¸±à¹ˆà¸‡à¸à¸²à¸-à¸–à¸­à¸™/PM (STM)</span><b>${num(stm)}</b></li><li><span>à¸£à¸²à¸¢à¸à¸²à¸£à¸à¸±à¹ˆà¸‡ BO</span><b>${num(bo)}</b></li><li><span>à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¸œà¹ˆà¸²à¸™ 3 à¸ˆà¸¸à¸”</span><b>${num(matched)}</b></li><li><span>à¸­à¸±à¸•à¸£à¸²à¸ˆà¸±à¸šà¸„à¸¹à¹ˆ</span><b>${matchRate.toFixed(2)}%</b></li><li><span>Exception à¸£à¸§à¸¡à¸ˆà¸²à¸à¸—à¸±à¹‰à¸‡à¸ªà¸­à¸‡à¸à¸±à¹ˆà¸‡</span><b>${num(data.exceptionTotal)}</b><small class="sub">à¸£à¸§à¸¡à¸£à¸²à¸¢à¸à¸²à¸£à¹„à¸¡à¹ˆà¸žà¸šà¸„à¸¹à¹ˆ à¸¢à¸­à¸”à¸•à¹ˆà¸²à¸‡ à¹€à¸§à¸¥à¸²à¸•à¹ˆà¸²à¸‡ à¹à¸¥à¸°à¸£à¸²à¸¢à¸à¸²à¸£à¸‹à¹‰à¸³ à¸ˆà¸¶à¸‡à¹„à¸¡à¹ˆà¹€à¸—à¹ˆà¸²à¸à¸±à¸š STM à¸¥à¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¹€à¸ªà¸¡à¸­</small></li><li><span>à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢à¸—à¸µà¹ˆà¸œà¸¹à¹‰à¸•à¸£à¸§à¸ˆà¸¢à¸·à¸™à¸¢à¸±à¸™à¹à¸¥à¹‰à¸§</span><b>${h(damageDisplay)}</b></li></ul></div>
      </section>

      <section class="panel"><div class="panel-heading"><div><p class="eyebrow">Source files</p><h2>à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¹„à¸”à¹‰à¸£à¸±à¸šà¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”</h2><small class="head-sub">à¸à¸”à¸Šà¸·à¹ˆà¸­à¹„à¸Ÿà¸¥à¹Œà¹€à¸žà¸·à¹ˆà¸­à¸”à¸¹à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡à¸à¹ˆà¸­à¸™à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸” Â· à¹„à¸Ÿà¸¥à¹Œà¸Šà¸µà¹‰à¹à¸ˆà¸‡à¹ƒà¸Šà¹‰à¹€à¸›à¹‡à¸™à¸«à¸¥à¸±à¸à¸à¸²à¸™à¹à¸¥à¸°à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¹à¸›à¸¥à¸‡à¹€à¸›à¹‡à¸™à¸£à¸²à¸¢à¸à¸²à¸£</small></div><span class="health ok">${num(data.files.length)} à¹„à¸Ÿà¸¥à¹Œ</span></div><div class="table-wrap daily-detail-table"><table><thead><tr><th>à¸£à¸±à¸šà¹€à¸¡à¸·à¹ˆà¸­</th><th>à¸«à¸±à¸§à¸‚à¹‰à¸­à¹€à¸¡à¸¥ / à¸œà¸¹à¹‰à¸ªà¹ˆà¸‡</th><th>à¸Šà¸·à¹ˆà¸­à¹„à¸Ÿà¸¥à¹Œ</th><th>à¸›à¸£à¸°à¹€à¸ à¸—</th><th class="right">à¹à¸–à¸§</th><th>à¸ªà¸–à¸²à¸™à¸°</th></tr></thead><tbody>${data.files.map((file) => {
        const evidence = file.kind === "doc_clarify";
        const fileStatus = evidence ? "evidence" : file.parse_error ? "error" : file.parsed ? "parsed" : "waiting";
        const statusHtml = evidence
          ? `<span class="badge blue">à¸«à¸¥à¸±à¸à¸à¸²à¸™à¸žà¸£à¹‰à¸­à¸¡à¸•à¸£à¸§à¸ˆ</span><small class="sub">à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¸­à¹ˆà¸²à¸™à¹€à¸›à¹‡à¸™à¸£à¸²à¸¢à¸à¸²à¸£</small>`
          : statementNeedsBoReview(file)
            ? `<span class="badge amber">${h(statementReviewLabel(file))}</span><small class="sub">${h(file.parse_error)} Â· à¸•à¹‰à¸­à¸‡à¸¢à¸·à¸™à¸¢à¸±à¸™à¸§à¹ˆà¸²à¸•à¹‰à¸™à¸‰à¸šà¸±à¸šà¸„à¸£à¸­à¸šà¸„à¸¥à¸¸à¸¡à¸§à¸±à¸™à¸•à¸£à¸§à¸ˆ à¹à¸¥à¸°à¹€à¸—à¸µà¸¢à¸š BO à¸šà¸±à¸à¸Šà¸µà¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™ à¹à¸¢à¸à¸à¸²à¸â€“à¸–à¸­à¸™à¸à¹ˆà¸­à¸™à¸ªà¸£à¸¸à¸›à¸§à¹ˆà¸²à¹„à¸¡à¹ˆà¸¡à¸µà¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸±à¹‰à¸‡à¸ªà¸­à¸‡à¸à¸±à¹ˆà¸‡</small>`
          : file.parse_error
            ? `<span class="badge red">à¸­à¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰</span><small class="sub danger">${h(file.parse_error)}</small>`
            : file.parsed
              ? `<span class="badge green">${h(parsedFileLabel(file))}</span>`
              : `<span class="badge amber">à¸£à¸­à¸­à¹ˆà¸²à¸™</span>`;
        return `<tr><td>${h(displayTime(file.receivedAt))}</td><td><b>${h(file.batch.subject || "-")}</b><small class="sub">${h(file.batch.sender || "-")}</small></td><td><button class="file-name-link" data-storage-open="${h(file.storage_path)}" data-file-id="${h(file.id)}" data-file-name="${h(file.file_name)}" data-file-mime="${h(file.mime_type || "")}" data-file-size="${h(file.size_bytes || "")}" data-file-kind="${h(file.kind || "")}" data-file-company="${h(company)}" data-file-date="${h(state.dailySummary.date)}" data-file-status="${fileStatus}" ${file.storage_path ? "" : "disabled"}><span>${h(file.file_name)}</span><small>à¸”à¸¹à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡</small></button></td><td>${h(LIVE_KIND_LABEL[file.kind] || file.kind || "à¸¢à¸±à¸‡à¸ˆà¸³à¹à¸™à¸à¹„à¸¡à¹ˆà¹„à¸”à¹‰")}</td><td class="right tnum">${evidence || file.row_count == null ? "-" : num(file.row_count)}</td><td>${statusHtml}</td></tr>`;
      }).join("") || `<tr><td colspan="6" class="empty">à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¹„à¸Ÿà¸¥à¹Œà¸‚à¸­à¸‡à¸šà¸£à¸´à¸©à¸±à¸—à¸™à¸µà¹‰à¹ƒà¸™à¸§à¸±à¸™à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸</td></tr>`}</tbody></table></div></section>

      <section class="panel"><div class="panel-heading"><div><p class="eyebrow">Exception resolution</p><h2>à¸œà¸¥à¸à¸²à¸£à¸•à¸£à¸§à¸ˆà¹à¸¥à¸°à¹à¸à¹‰à¹„à¸‚à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”</h2><small class="head-sub">à¹à¸à¹‰à¹„à¸‚à¹à¸¥à¹‰à¸§ ${num(data.resolvedTotal)} Â· à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸›à¸´à¸” ${num(data.stillOpen)} Â· à¹à¸ªà¸”à¸‡à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸Šà¸¸à¸”à¹à¸£à¸ ${num(data.exceptions.length)}/${num(data.exceptionTotal)}</small></div><button class="ghost-button sm" id="dailyGoExceptions">à¹€à¸›à¸´à¸”à¸«à¸™à¹‰à¸²à¸•à¸´à¸”à¸•à¸²à¸¡à¹€à¸„à¸ª</button></div><div class="table-wrap daily-detail-table"><table><thead><tr><th>à¹€à¸„à¸ª / à¹€à¸§à¸¥à¸²</th><th>à¸›à¸£à¸°à¹€à¸ à¸—</th><th>à¸šà¸±à¸à¸Šà¸µ</th><th class="right">à¸¢à¸­à¸” BO</th><th class="right">à¸¢à¸­à¸” STM</th><th class="right">à¸œà¸¥à¸•à¹ˆà¸²à¸‡</th><th>à¸£à¸°à¸”à¸±à¸š</th><th>à¸ªà¸–à¸²à¸™à¸°à¸à¸²à¸£à¹à¸à¹‰à¹„à¸‚</th><th>à¸œà¸¹à¹‰à¹€à¸à¸µà¹ˆà¸¢à¸§à¸‚à¹‰à¸­à¸‡ / à¸ªà¸²à¹€à¸«à¸•à¸¸</th></tr></thead><tbody>${data.exceptions.map((row) => `<tr class="clickable" data-daily-ex="${h(row.id)}"><td><b>${h(row.id)}</b><small class="sub">${h(row.time || "-")}</small></td><td>${h(row.typeName)}</td><td>${h(row.account)}<small class="sub">${h(row.bank)} Â· ${h(row.direction)}</small></td><td class="right tnum">${row.systemAmount == null ? "-" : money(row.systemAmount)}</td><td class="right tnum">${row.bankAmount == null ? "-" : money(row.bankAmount)}</td><td class="right tnum danger">${money(row.amountDiff || row.riskAmount)}</td><td><span class="badge ${h(row.severity)}">${h(sevMeta(row.severity).name)}</span></td><td><span class="badge ${h(statusMeta(row.status).tone)}">${h(statusMeta(row.status).name)}</span></td><td>${h(row.employee)}<small class="sub">${h(row.cause)}</small></td></tr>`).join("") || `<tr><td colspan="9" class="empty">${data.exceptionTotal ? `à¸œà¸¥à¸£à¸±à¸™à¸£à¸°à¸šà¸¸ ${num(data.exceptionTotal)} Exception à¹à¸•à¹ˆà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¹€à¸„à¸ªà¸—à¸µà¹ˆà¹€à¸›à¸´à¸”à¸”à¸¹à¹„à¸”à¹‰` : "à¹„à¸¡à¹ˆà¸žà¸š Exception à¸‚à¸­à¸‡à¸šà¸£à¸´à¸©à¸±à¸—à¸™à¸µà¹‰à¹ƒà¸™à¸§à¸±à¸™à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸"}</td></tr>`}</tbody></table></div></section>`;

    // à¹à¸–à¸šà¸ªà¸–à¸²à¸™à¸°à¸ªà¹ˆà¸§à¸™à¸«à¸±à¸§à¸•à¹‰à¸­à¸‡à¸¢à¸¶à¸”à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ live à¸‚à¸­à¸‡à¸šà¸£à¸´à¸©à¸±à¸—/à¸§à¸±à¸™à¸—à¸µà¹ˆà¸—à¸µà¹ˆà¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸à¸³à¸¥à¸±à¸‡à¸”à¸¹
    // à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆ ImportState à¹ƒà¸™à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡ à¸‹à¸¶à¹ˆà¸‡à¸­à¸²à¸ˆà¹€à¸›à¹‡à¸™à¸œà¸¥à¸ˆà¸²à¸à¸§à¸±à¸™à¸à¹ˆà¸­à¸™à¹à¸¥à¸°à¸—à¸³à¹ƒà¸«à¹‰à¸§à¸±à¸™à¸§à¹ˆà¸²à¸‡à¸‚à¸¶à¹‰à¸™à¸§à¹ˆà¸²à¹€à¸ªà¸£à¹‡à¸ˆà¹à¸¥à¹‰à¸§
    const liveHeader = !data.files.length
      ? { text: "à¸£à¸­à¹„à¸Ÿà¸¥à¹Œ", tone: "idle", why: `à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œà¸‚à¸­à¸‡ ${company} à¸§à¸±à¸™à¸—à¸µà¹ˆ ${state.dailySummary.date}` }
      : !boFiles
        ? { text: "à¸£à¸­ BO", tone: "wait", why: "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸£à¸²à¸¢à¸‡à¸²à¸™ BO à¸ªà¸³à¸«à¸£à¸±à¸šà¸£à¸°à¸šà¸¸à¸šà¸±à¸à¸Šà¸µà¹à¸¥à¸° Provider à¸—à¸µà¹ˆà¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸ˆà¸£à¸´à¸‡" }
        : !data.quality.length
          ? { text: "à¸£à¸­à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”", tone: "wait", why: "à¹„à¸”à¹‰à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¹‰à¸§ à¹à¸•à¹ˆà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸‚à¸­à¸‡à¸§à¸±à¸™à¹à¸¥à¸°à¸šà¸£à¸´à¸©à¸±à¸—à¸™à¸µà¹‰" }
          : { text: status.label, tone: status.tone === "green" ? "ok" : status.tone === "red" ? "wait" : status.tone, why: `à¸ªà¸–à¸²à¸™à¸°à¸ˆà¸£à¸´à¸‡à¸ˆà¸²à¸ Supabase: ${status.label}` };
    const liveAutoStatus = $("#autoStatus");
    if (liveAutoStatus) {
      liveAutoStatus.className = `auto-status ${liveHeader.tone}`;
      liveAutoStatus.title = liveHeader.why;
      $("#autoStatusText").textContent = liveHeader.text;
    }
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
  $('#dailySummaryHolds')?.addEventListener('click',()=>{
    openModal('à¸žà¸±à¸à¸šà¸±à¸à¸Šà¸µ / à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¸žà¸±à¸à¸•à¸£à¸§à¸ˆ â€” à¸­à¹ˆà¸²à¸™à¸­à¸¢à¹ˆà¸²à¸‡à¹€à¸”à¸µà¸¢à¸§','<div id="dailyHoldRegistry"></div>','<button id="dailyHoldRegistryClose">à¸›à¸´à¸”</button>');
    $('#dailyHoldRegistryClose').onclick=closeModal;
    AccountReviewHolds.mountReadOnly($('#dailyHoldRegistry'),{
      actor:()=>Sb.authUser()?.id,role:()=>state.role,companies:Sb.reviewHoldRegistryCompanies,
      scopes:Sb.reviewHoldScopes,report:Sb.reviewHoldRegistryReport,view:AccountReviewHolds.view,
      csv:AccountReviewHolds.csv,saveBlob:Exporter.saveBlob,from:state.dailySummary.date,to:state.dailySummary.date,
    });
  });
  const matchedButton = document.createElement("button");
  matchedButton.className = "primary-button";
  matchedButton.textContent = "à¸”à¸¹à¸£à¸²à¸¢à¸à¸²à¸£à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ";
  $("#dailySummaryRefresh")?.after(matchedButton);
  matchedButton.addEventListener("click", async () => {
    matchedButton.disabled = true;
    const company = state.dailySummary.company, date = state.dailySummary.date;
    try {
      const run = await Sb.matchedEvidence(company, date);
      const evidence = run?.summary?.match_evidence;
      if (!Array.isArray(evidence) || !evidence.length) {
        openModal("à¸£à¸²à¸¢à¸à¸²à¸£à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ", `<p>${h(company)} Â· ${h(date)}</p><p>à¸œà¸¥à¸£à¸­à¸šà¸™à¸µà¹‰à¸¡à¸µà¸„à¸¹à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ ${num(run?.matched || 0)} à¸£à¸²à¸¢à¸à¸²à¸£ à¹à¸•à¹ˆ${run ? "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¹€à¸à¹‡à¸šà¸«à¸¥à¸±à¸à¸à¸²à¸™à¸£à¸²à¸¢à¸„à¸¹à¹ˆà¸ªà¸³à¸«à¸£à¸±à¸šà¸¡à¸¸à¸¡à¸¡à¸­à¸‡à¸™à¸µà¹‰" : "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸œà¸¥à¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥"} à¸ˆà¸¶à¸‡à¸¢à¸±à¸‡à¹à¸ªà¸”à¸‡à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¹„à¸¡à¹ˆà¹„à¸”à¹‰ à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸¢à¸·à¸™à¸¢à¸±à¸™à¸§à¹ˆà¸²à¹„à¸¡à¹ˆà¸¡à¸µà¸„à¸¹à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ</p><p>à¸•à¹‰à¸­à¸‡à¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¸”à¹‰à¸§à¸¢ Worker à¸—à¸µà¹ˆà¹€à¸à¹‡à¸šà¸«à¸¥à¸±à¸à¸à¸²à¸™à¸£à¸²à¸¢à¸„à¸¹à¹ˆà¸à¹ˆà¸­à¸™ à¹„à¸¡à¹ˆà¸ªà¸£à¹‰à¸²à¸‡à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸”à¹à¸—à¸™à¸ˆà¸²à¸à¸¢à¸­à¸”à¸£à¸§à¸¡</p>`);
        return;
      }
      const time = side => side?.date ? `${side.date} ${Number.isFinite(side.sec) ? new Date(side.sec * 1000).toISOString().slice(11,19) : "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¹€à¸§à¸¥à¸²"}` : "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸";
      const person = p => p ? `à¸šà¸±à¸à¸Šà¸µ: ${h(p.account || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸")}<br>à¸Šà¸·à¹ˆà¸­: ${h(p.name || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸")}<br>User: ${h(p.user || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸")}<br>à¸­à¹‰à¸²à¸‡à¸­à¸´à¸‡: ${h(p.reference || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸")}` : "à¸œà¸¥à¹€à¸à¹ˆà¸²à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¹€à¸à¹‡à¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸¥à¸¹à¸à¸„à¹‰à¸²";
      let direction = "deposit", page = 0;
      const draw = () => {
        const rows = evidence.filter(e => e.direction === direction);
        openModal(`à¸„à¸¹à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ Â· ${h(company)} Â· ${h(date)}`, `<p>à¸«à¸¥à¸±à¸à¸à¸²à¸™à¸à¸²à¸£à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¸‚à¸­à¸‡à¸£à¸°à¸šà¸š à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸à¸²à¸£à¸£à¸±à¸šà¸£à¸­à¸‡ 100% à¸«à¸£à¸·à¸­à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¸›à¸´à¸”à¹€à¸„à¸ª à¸£à¸²à¸¢à¸à¸²à¸£à¹€à¸•à¸´à¸¡à¸¡à¸·à¸­à¸—à¸±à¹ˆà¸§à¹„à¸›à¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆà¹€à¸­à¸à¸ªà¸²à¸£ à¸¢à¸à¹€à¸§à¹‰à¸™à¸šà¸±à¸à¸Šà¸µà¸£à¸°à¸šà¸š 123 à¸—à¸µà¹ˆà¸œà¹ˆà¸²à¸™à¸à¸Žà¸›à¸´à¸”à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´à¸‹à¸¶à¹ˆà¸‡ Audit à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹„à¸§à¹‰</p><button id="matchedDeposit">à¸à¸²à¸</button> <button id="matchedWithdraw">à¸–à¸­à¸™</button><p>${direction === "deposit" ? "à¸à¸²à¸" : "à¸–à¸­à¸™"} ${num(rows.length)} à¸„à¸¹à¹ˆ Â· à¸«à¸™à¹‰à¸² ${page + 1}/${Math.max(1, Math.ceil(rows.length / 50))}</p><div style="overflow:auto"><table><thead><tr><th>à¸šà¸±à¸à¸Šà¸µ/Provider</th><th>BO</th><th>STM/PM</th><th>à¸•à¹ˆà¸²à¸‡à¹€à¸§à¸¥à¸²</th><th>à¹€à¸à¸“à¸‘à¹Œ</th></tr></thead><tbody>${rows.slice(page * 50, page * 50 + 50).map(e => `<tr><td>${h(e.account)}</td><td>${h(time(e.bo))}<br>${money(e.boAmount ?? e.amount)}<br>${person(e.customer?.bo)}<br>à¹à¸–à¸§ ${h(e.bo?.row ?? "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸")}</td><td>${h(time(e.stm))}<br>${e.stmAmount == null ? "à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¹€à¸à¹‡à¸šà¸¢à¸­à¸”à¸à¸±à¹ˆà¸‡ STM" : money(e.stmAmount)}<br>${person(e.customer?.stm)}<br>à¹à¸–à¸§ ${h(e.stm?.row ?? "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸")}</td><td>${h(evidenceTimeDiffLabel(e))}</td><td>${h(e.method === "customer-account-amount-same-day-60m" ? "à¸šà¸±à¸à¸Šà¸µà¸¥à¸¹à¸à¸„à¹‰à¸² + à¸¢à¸­à¸” + à¸§à¸±à¸™à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™ à¸ à¸²à¸¢à¹ƒà¸™ 60 à¸™à¸²à¸—à¸µ" : "à¸à¸Žà¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¹€à¸”à¸´à¸¡ â€” à¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆà¹€à¸à¸“à¸‘à¹Œà¸›à¸£à¸°à¸à¸­à¸š")}${e.manualReview ? "<br>à¹€à¸•à¸´à¸¡à¸¡à¸·à¸­: à¸£à¸­à¸«à¸¥à¸±à¸à¸à¸²à¸™" : e.sys123ManualAutoClosed ? "<br>à¹€à¸•à¸´à¸¡à¸¡à¸·à¸­ 123: à¸œà¹ˆà¸²à¸™à¸à¸Žà¸›à¸´à¸”à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´" : ""}</td></tr>`).join("") || '<tr><td colspan="5">à¹„à¸¡à¹ˆà¸¡à¸µà¸„à¸¹à¹ˆà¹ƒà¸™à¸›à¸£à¸°à¹€à¸ à¸—à¸™à¸µà¹‰</td></tr>'}</tbody></table></div>`, `<button id="matchedPrev" ${page === 0 ? "disabled" : ""}>à¸à¹ˆà¸­à¸™à¸«à¸™à¹‰à¸²</button><button id="matchedNext" ${(page + 1) * 50 >= rows.length ? "disabled" : ""}>à¸–à¸±à¸”à¹„à¸›</button>`);
        $("#matchedDeposit").onclick = () => { direction = "deposit"; page = 0; draw(); };
        $("#matchedWithdraw").onclick = () => { direction = "withdraw"; page = 0; draw(); };
        $("#matchedPrev").onclick = () => { page--; draw(); };
        $("#matchedNext").onclick = () => { page++; draw(); };
      };
      draw();
    } catch (error) { toast(`à¹‚à¸«à¸¥à¸”à¸„à¸¹à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆà¹„à¸¡à¹ˆà¹„à¸”à¹‰: ${error.message}`); }
    finally { matchedButton.disabled = false; }
  });
  $("#dailySummaryExport")?.addEventListener("click", async () => {
    let data = dailyCompanyData(state.dailySummary.company);
    if (data.exceptionTotal > data.exceptions.length) {
      toast("à¸à¸³à¸¥à¸±à¸‡à¸”à¸¶à¸‡à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¸ªà¸³à¸«à¸£à¸±à¸š Export â€” à¸«à¸™à¹‰à¸²à¸ˆà¸­à¸¢à¸±à¸‡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸•à¹ˆà¸­à¹„à¸”à¹‰");
      try {
        const rows = await Sb.currentExceptionsSummary({ from: state.dailySummary.date, to: state.dailySummary.date, company: state.dailySummary.company, limit: 5000 });
        dailyCompanyState.informationalExceptions = informationalAuditRows(rows);
        dailyCompanyState.matchedStaleExceptions = matchedStaleAuditCount(rows,dailyCompanyState.matchEvidence);
        dailyCompanyState.exceptions = actionableAuditRows(rows,dailyCompanyState.matchEvidence).map(mapLiveException);
        data = dailyCompanyData(state.dailySummary.company);
      } catch (error) {
        toast("à¸”à¸¶à¸‡à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ à¸ˆà¸¶à¸‡ Export à¹€à¸‰à¸žà¸²à¸°à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸—à¸µà¹ˆà¹‚à¸«à¸¥à¸”à¹à¸¥à¹‰à¸§: " + error.message, "warn");
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
    liveIntakeState.batches = await Sb.batches({ from: state.filters.from, to: state.filters.to, company: state.filters.company, force });
    liveIntakeState.updatedAt = new Date();
  } catch (e) {
    liveIntakeState.error = e.message || "à¹‚à¸«à¸¥à¸”à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¹„à¸Ÿà¸¥à¹Œà¸ˆà¸£à¸´à¸‡à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ";
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
  const both = /à¸à¸²à¸\s*[-â€“â€”/]?\s*à¸–à¸­à¸™|à¸–à¸­à¸™\s*[-â€“â€”/]?\s*à¸à¸²à¸|à¸à¸²à¸à¸–à¸­à¸™|à¸–à¸­à¸™à¸à¸²à¸|statement|\bstm\b/.test(text);
  if (both || /à¸à¸²à¸|deposit/.test(text)) out.push("à¸à¸²à¸");
  if (both || /à¸–à¸­à¸™|withdraw|\bwd\b/.test(text)) out.push("à¸–à¸­à¸™");
  if (!out.length && ["stm_pdf", "bo_main"].includes(file.kind)) out.push("à¸à¸²à¸", "à¸–à¸­à¸™");
  return [...new Set(out)];
}

function renderLiveIntake(root) {
  if (!liveIntakeState.batches && !liveIntakeState.loading) loadLiveIntake();
  if (liveIntakeState.loading && !liveIntakeState.batches) {
    root.innerHTML = `<section class="panel live-loading"><span class="spinner"></span><div><h2>à¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆà¹„à¸Ÿà¸¥à¹Œà¸ˆà¸£à¸´à¸‡</h2><p class="hint">à¸ˆà¸±à¸”à¸à¸¥à¸¸à¹ˆà¸¡ PM à¸à¸²à¸ à¹à¸¥à¸°à¸–à¸­à¸™à¸•à¸²à¸¡à¸šà¸£à¸´à¸©à¸±à¸—...</p></div></section>`;
    return;
  }
  if (liveIntakeState.error && !liveIntakeState.batches) {
    root.innerHTML = `<section class="panel"><div class="alert bad"><strong>à¹‚à¸«à¸¥à¸”à¹„à¸Ÿà¸¥à¹Œà¸ˆà¸£à¸´à¸‡à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ</strong><span>${h(liveIntakeState.error)}</span><button class="ghost-button sm" id="intakeRetry">à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆ</button></div></section>`;
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
  const visibleTypes = state.filters.direction === "ALL" ? ["PM", "à¸à¸²à¸", "à¸–à¸­à¸™"] : [state.filters.direction];
  const selectedFiles = typedFiles.filter((file) => file.intakeTypes.some((type) => visibleTypes.includes(type)));
  const companies = companyMaster().filter((company) => state.filters.company === "ALL" || company.code === state.filters.company);
  const rows = companies.map((company) => {
    const own = selectedFiles.filter((file) => file.intakeCompany === company.code);
    const counts = Object.fromEntries(["PM", "à¸à¸²à¸", "à¸–à¸­à¸™"].map((type) => [type, own.filter((file) => file.intakeTypes.includes(type)).length]));
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
      <article><span>à¸šà¸£à¸´à¸©à¸±à¸—à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆ</span><strong>${num(rows.length)}</strong><small>${h(state.filters.company === "ALL" ? "à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¸šà¸£à¸´à¸©à¸±à¸—à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”" : state.filters.company)}</small></article>
      <article class="ok"><span>à¸šà¸£à¸´à¸©à¸±à¸—à¸—à¸µà¹ˆà¸žà¸šà¹„à¸Ÿà¸¥à¹Œ</span><strong>${num(foundCompanies)}</strong><small>à¸ˆà¸²à¸à¹„à¸Ÿà¸¥à¹Œà¸ˆà¸£à¸´à¸‡à¹ƒà¸™ Supabase</small></article>
      <article class="${waitingRead ? "warn" : "ok"}"><span>à¹„à¸Ÿà¸¥à¹Œ PM / à¸à¸²à¸ / à¸–à¸­à¸™</span><strong>${num(selectedFiles.length)}</strong><small>à¸£à¸­à¸­à¹ˆà¸²à¸™ ${num(waitingRead)} à¹„à¸Ÿà¸¥à¹Œ</small></article>
      <article class="${errors || missingCompanies ? "bad" : "ok"}"><span>à¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆà¹€à¸žà¸´à¹ˆà¸¡</span><strong>${num(errors + missingCompanies)}</strong><small>à¹„à¸¡à¹ˆà¸žà¸šà¸šà¸£à¸´à¸©à¸±à¸— ${num(missingCompanies)} Â· à¸­à¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰ ${num(errors)}</small></article>
    </section>

    ${
      !selectedFiles.length
        ? `<div class="alert bad"><strong>à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸šà¹„à¸Ÿà¸¥à¹Œ PM à¸à¸²à¸ à¸«à¸£à¸·à¸­à¸–à¸­à¸™</strong><span>à¸Šà¹ˆà¸§à¸‡ ${h(rangeLabel())} à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸ˆà¸³à¹à¸™à¸à¹€à¸‚à¹‰à¸²à¸šà¸£à¸´à¸©à¸±à¸—à¹„à¸”à¹‰ à¸à¸£à¸¸à¸“à¸²à¸•à¸£à¸§à¸ˆà¸Šà¹ˆà¸§à¸‡à¸§à¸±à¸™à¸—à¸µà¹ˆà¸«à¸£à¸·à¸­à¹€à¸›à¸´à¸”à¸„à¸¥à¸±à¸‡à¹„à¸Ÿà¸¥à¹Œà¸ˆà¸²à¸à¹€à¸¡à¸¥</span></div>`
        : errors || waitingRead || missingCompanies
          ? `<div class="alert bad"><strong>à¸¢à¸±à¸‡à¸ªà¸£à¸¸à¸›à¸§à¹ˆà¸²à¹„à¸Ÿà¸¥à¹Œà¸„à¸£à¸šà¹„à¸¡à¹ˆà¹„à¸”à¹‰</strong><span>à¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸£à¸´à¸‡à¹à¸¥à¹‰à¸§ à¹à¸•à¹ˆà¸¢à¸±à¸‡à¸¡à¸µà¸šà¸£à¸´à¸©à¸±à¸—à¹„à¸¡à¹ˆà¸žà¸šà¹„à¸Ÿà¸¥à¹Œ à¹„à¸Ÿà¸¥à¹Œà¸£à¸­à¸­à¹ˆà¸²à¸™ à¸«à¸£à¸·à¸­à¹„à¸Ÿà¸¥à¹Œà¸­à¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ à¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆà¸•à¹ˆà¸­à¸à¹ˆà¸­à¸™à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”</span></div>`
          : `<div class="alert ok"><strong>à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸žà¸šà¸žà¸£à¹‰à¸­à¸¡à¸•à¸£à¸§à¸ˆ</strong><span>à¹„à¸Ÿà¸¥à¹Œà¹ƒà¸™à¸Šà¹ˆà¸§à¸‡à¸™à¸µà¹‰à¸­à¹ˆà¸²à¸™à¸ªà¸³à¹€à¸£à¹‡à¸ˆà¹à¸¥à¹‰à¸§ à¹à¸•à¹ˆà¸„à¸§à¸²à¸¡à¸„à¸£à¸šà¸–à¹‰à¸§à¸™à¸ªà¸¸à¸”à¸—à¹‰à¸²à¸¢à¹ƒà¸«à¹‰à¸¢à¸·à¸™à¸¢à¸±à¸™à¸ˆà¸²à¸à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸‚à¸­à¸‡à¹à¸•à¹ˆà¸¥à¸°à¸šà¸£à¸´à¸©à¸±à¸—</span></div>`
    }

    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸£à¸´à¸‡à¸•à¸²à¸¡à¸šà¸£à¸´à¸©à¸±à¸—</p><h2>à¸ªà¸–à¸²à¸™à¸° PM à¸à¸²à¸ à¹à¸¥à¸°à¸–à¸­à¸™</h2><small class="head-sub">à¸­à¸±à¸›à¹€à¸”à¸• ${liveIntakeState.updatedAt ? displayTime(liveIntakeState.updatedAt) : "-"}</small></div>
        <div class="inline-actions"><button class="ghost-button sm" id="intakeRefresh">à¸£à¸µà¹€à¸Ÿà¸£à¸Š</button><button class="primary-button sm" id="intakeCloud">à¹€à¸›à¸´à¸”à¸„à¸¥à¸±à¸‡à¹„à¸Ÿà¸¥à¹Œ</button></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>à¸šà¸£à¸´à¸©à¸±à¸—</th>${visibleTypes.map((type) => `<th class="right">${h(type)}</th>`).join("")}<th class="right">à¸£à¸§à¸¡à¹„à¸Ÿà¸¥à¹Œ</th><th class="right">à¸­à¹ˆà¸²à¸™à¹à¸¥à¹‰à¸§</th><th>à¸£à¸±à¸šà¸¥à¹ˆà¸²à¸ªà¸¸à¸”</th><th>à¸ªà¸–à¸²à¸™à¸°</th></tr></thead>
        <tbody>${rows.map((row) => {
          const tone = !row.own.length ? "grey" : row.errors ? "red" : row.parsed < row.own.length ? "amber" : "green";
          const label = !row.own.length ? "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸šà¹„à¸Ÿà¸¥à¹Œ" : row.errors ? "à¸¡à¸µà¹„à¸Ÿà¸¥à¹Œà¸­à¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰" : row.parsed < row.own.length ? "à¸£à¸­à¸­à¹ˆà¸²à¸™" : "à¸žà¸£à¹‰à¸­à¸¡à¸•à¸£à¸§à¸ˆ";
          return `<tr><td><b>${h(row.company)}</b></td>${visibleTypes.map((type) => `<td class="right tnum">${num(row.counts[type])}</td>`).join("")}<td class="right tnum">${num(row.own.length)}</td><td class="right tnum">${num(row.parsed)}</td><td>${row.latest ? h(displayTime(row.latest)) : "-"}</td><td><span class="badge ${tone}">${label}</span></td></tr>`;
        }).join("")}</tbody>
      </table></div>
      <p class="hint">à¸ˆà¸³à¸™à¸§à¸™à¹ƒà¸™à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œà¸„à¸·à¸­à¸ˆà¸³à¸™à¸§à¸™à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸£à¸°à¸šà¸šà¸ˆà¸³à¹à¸™à¸à¹„à¸”à¹‰ à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸ˆà¸³à¸™à¸§à¸™à¸˜à¸¸à¸£à¸à¸£à¸£à¸¡; à¹„à¸Ÿà¸¥à¹Œà¸Šà¸·à¹ˆà¸­ â€œà¸à¸²à¸-à¸–à¸­à¸™â€ à¸ˆà¸°à¸™à¸±à¸šà¹„à¸”à¹‰à¸—à¸±à¹‰à¸‡à¸à¸²à¸à¹à¸¥à¸°à¸–à¸­à¸™ à¸ªà¹ˆà¸§à¸™ PM à¹à¸¢à¸à¹€à¸›à¹‡à¸™à¸›à¸£à¸°à¹€à¸ à¸—à¸‚à¸­à¸‡à¸•à¸±à¸§à¹€à¸­à¸‡</p>
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
  const statusText = { received: "à¸£à¸±à¸šà¹à¸¥à¹‰à¸§", missing: "à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸ªà¹ˆà¸‡", wrong_company: "à¸œà¸´à¸”à¸šà¸£à¸´à¸©à¸±à¸—", late: "à¸ªà¹ˆà¸‡à¸Šà¹‰à¸²" };
  const statusTone = { received: "green", missing: "red", wrong_company: "red", late: "amber" };
  const blocked = stat("missing") + stat("wrong_company");

  root.innerHTML = `
    <section class="status-strip four">
      <article><span>à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¹„à¸”à¹‰à¸£à¸±à¸š</span><strong>${files.length}</strong><small>${DB.companies.length} à¸šà¸£à¸´à¸©à¸±à¸— Ã— à¸›à¸£à¸°à¹€à¸ à¸—à¹„à¸Ÿà¸¥à¹Œ</small></article>
      <article class="ok"><span>à¸£à¸±à¸šà¸„à¸£à¸šà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡</span><strong>${stat("received")}</strong><small>à¸œà¹ˆà¸²à¸™ quality gate</small></article>
      <article class="warn"><span>à¸ªà¹ˆà¸‡à¸Šà¹‰à¸²à¸à¸§à¹ˆà¸²à¸à¸³à¸«à¸™à¸”</span><strong>${stat("late")}</strong><small>à¸£à¸±à¸šà¹à¸¥à¹‰à¸§à¹à¸•à¹ˆà¹€à¸à¸´à¸™à¹€à¸§à¸¥à¸² 09:00</small></article>
      <article class="bad"><span>à¸‚à¸²à¸” / à¸œà¸´à¸”à¸šà¸£à¸´à¸©à¸±à¸—</span><strong>${blocked}</strong><small>à¸•à¹‰à¸­à¸‡à¹à¸à¹‰à¸à¹ˆà¸­à¸™à¹€à¸£à¸´à¹ˆà¸¡ reconcile</small></article>
    </section>

    ${
      blocked
        ? `<div class="alert bad">
        <strong>à¸¢à¸±à¸‡à¹€à¸£à¸´à¹ˆà¸¡ reconcile à¹à¸šà¸šà¹€à¸•à¹‡à¸¡à¸£à¸­à¸šà¹„à¸¡à¹ˆà¹„à¸”à¹‰</strong>
        <span>à¸žà¸šà¹„à¸Ÿà¸¥à¹Œà¸‚à¸²à¸”à¸«à¸£à¸·à¸­à¸ªà¹ˆà¸‡à¸œà¸´à¸”à¸šà¸£à¸´à¸©à¸±à¸— ${blocked} à¸£à¸²à¸¢à¸à¸²à¸£ à¸£à¸°à¸šà¸šà¸ˆà¸°à¹„à¸¡à¹ˆà¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¹€à¸‡à¸µà¸¢à¸š à¹† à¹à¸•à¹ˆà¸£à¸­à¸ˆà¸™à¸à¸§à¹ˆà¸²à¹„à¸Ÿà¸¥à¹Œà¸ˆà¸°à¸„à¸£à¸š à¹à¸¥à¹‰à¸§à¸ˆà¸¶à¸‡à¸—à¸³à¸‡à¸²à¸™à¹ƒà¸«à¹‰à¹€à¸­à¸‡à¸—à¸±à¸™à¸—à¸µ</span>
        <button class="ghost-button sm" id="btnRemind">à¸ªà¹ˆà¸‡à¹à¸ˆà¹‰à¸‡à¹€à¸•à¸·à¸­à¸™à¸œà¸¹à¹‰à¸ªà¹ˆà¸‡à¹„à¸Ÿà¸¥à¹Œ</button>
      </div>`
        : `<div class="alert ok"><strong>à¹„à¸Ÿà¸¥à¹Œà¸„à¸£à¸šà¸•à¸²à¸¡à¹€à¸Šà¹‡à¸„à¸¥à¸´à¸ªà¸•à¹Œ</strong><span>à¸£à¸°à¸šà¸šà¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¹ƒà¸«à¹‰à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´à¹à¸¥à¹‰à¸§à¹€à¸¡à¸·à¹ˆà¸­à¹„à¸Ÿà¸¥à¹Œà¹€à¸‚à¹‰à¸²à¸„à¸£à¸šà¸—à¸±à¹‰à¸‡à¸ªà¸­à¸‡à¸à¸±à¹ˆà¸‡ à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¸ªà¸±à¹ˆà¸‡à¹€à¸­à¸‡</span></div>`
    }

    <section class="panel">
      <div class="panel-heading">
        <div><p class="eyebrow">Daily Checklist</p><h2>à¸ªà¸–à¸²à¸™à¸°à¹„à¸Ÿà¸¥à¹Œà¸£à¸²à¸¢à¸šà¸£à¸´à¸©à¸±à¸—</h2></div>
        <div class="inline-actions">
          <button class="ghost-button sm" id="btnRecheck">à¸•à¸£à¸§à¸ˆà¹„à¸Ÿà¸¥à¹Œà¹ƒà¸«à¸¡à¹ˆ</button>
          <button class="primary-button sm" id="btnUpload">à¹„à¸›à¸«à¸™à¹‰à¸²à¸™à¸³à¹€à¸‚à¹‰à¸²à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸£à¸´à¸‡</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>à¸šà¸£à¸´à¸©à¸±à¸—</th><th>à¸›à¸£à¸°à¹€à¸ à¸—à¹„à¸Ÿà¸¥à¹Œ</th><th>à¹€à¸§à¸¥à¸²à¸—à¸µà¹ˆà¸£à¸±à¸š</th><th>à¸ˆà¸³à¸™à¸§à¸™à¹à¸–à¸§</th><th>à¸œà¸¹à¹‰à¸ªà¹ˆà¸‡</th><th>Checksum</th><th>à¸ªà¸–à¸²à¸™à¸°</th><th></th></tr></thead>
          <tbody>
            ${files
              .map(
                (x) => `<tr>
              <td>${h(x.companyName)}</td>
              <td>${h(x.fileType)}</td>
              <td>${h(displayTime(x.receivedAt))}</td>
              <td class="tnum">${x.rows ? num(x.rows) : "-"}</td>
              <td>${h(x.sender)}</td>
              <td class="mono">${h(x.checksum)}</td>
              <td><span class="badge ${statusTone[x.status]}">${statusText[x.status]}</span></td>
              <td>${x.status === "received" ? "" : `<button class="link-btn" data-fix="${h(x.id)}">à¸—à¸§à¸‡à¹„à¸Ÿà¸¥à¹Œ</button>`}</td>
            </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="grid-2">
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Quality Gate</p><h2>à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸£à¸°à¸šà¸šà¸•à¸£à¸§à¸ˆà¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´</h2></div></div>
        <ul class="tick-list">
          <li>à¹„à¸Ÿà¸¥à¹Œà¸–à¸¹à¸à¸šà¸£à¸´à¸©à¸±à¸—à¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ (à¹€à¸—à¸µà¸¢à¸šà¹€à¸¥à¸‚à¸šà¸±à¸à¸Šà¸µà¹ƒà¸™ master list)</li>
          <li>à¸›à¸£à¸°à¹€à¸ à¸—à¹„à¸Ÿà¸¥à¹Œà¸•à¸£à¸‡à¸à¸±à¸šà¸—à¸µà¹ˆà¸£à¸°à¸šà¸¸à¹ƒà¸™ subject email</li>
          <li>à¸Šà¹ˆà¸§à¸‡à¸§à¸±à¸™à¸—à¸µà¹ˆà¹ƒà¸™à¹„à¸Ÿà¸¥à¹Œà¸•à¸£à¸‡à¸à¸±à¸šà¸§à¸±à¸™à¸—à¸µà¹ˆà¸•à¸£à¸§à¸ˆ (à¸à¸±à¸™à¸§à¸±à¸™à¸—à¸µà¹ˆà¸›à¸™à¸ˆà¸²à¸ PM)</li>
          <li>checksum à¸‹à¹‰à¸³à¸à¸±à¸šà¹„à¸Ÿà¸¥à¹Œà¹€à¸”à¸´à¸¡à¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ (à¸à¸±à¸™à¸ªà¹ˆà¸‡à¹„à¸Ÿà¸¥à¹Œà¹€à¸à¹ˆà¸²à¸‹à¹‰à¸³)</li>
          <li>à¸ˆà¸³à¸™à¸§à¸™à¹à¸–à¸§à¸œà¸´à¸”à¸›à¸à¸•à¸´à¹€à¸—à¸µà¸¢à¸šà¸„à¹ˆà¸²à¹€à¸‰à¸¥à¸µà¹ˆà¸¢ 7 à¸§à¸±à¸™</li>
        </ul>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><p class="eyebrow">Manual Review</p><h2>à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸¢à¸±à¸‡à¸•à¹‰à¸­à¸‡à¹ƒà¸Šà¹‰à¸„à¸™à¸•à¸£à¸§à¸ˆ</h2></div></div>
        <ul class="tick-list warn">
          <li>à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸—à¸µà¹ˆà¸¡à¸µà¸šà¸£à¸´à¸šà¸—à¹€à¸‰à¸žà¸²à¸°à¸‚à¸­à¸‡à¸«à¸±à¸§à¸«à¸™à¹‰à¸²à¸à¸°</li>
          <li>à¸•à¸±à¸”à¸ªà¸´à¸™à¸§à¹ˆà¸²à¹€à¸„à¸ªà¹ƒà¸”à¹€à¸›à¹‡à¸™à¸„à¸§à¸²à¸¡à¹€à¸ªà¸µà¸¢à¸«à¸²à¸¢à¸ˆà¸£à¸´à¸‡</li>
          <li>à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¸à¸²à¸£à¹à¸à¹‰à¹„à¸‚à¸£à¸²à¸¢à¸à¸²à¸£à¸«à¸£à¸·à¸­à¸à¸²à¸£à¸¥à¸‡à¹‚à¸—à¸©</li>
          <li>à¹€à¸„à¸ªà¸—à¸µà¹ˆà¸˜à¸™à¸²à¸„à¸²à¸£à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¹€à¸§à¸¥à¸² à¸«à¸£à¸·à¸­à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹„à¸¡à¹ˆà¹€à¸›à¹‡à¸™ pattern</li>
        </ul>
      </div>
    </section>`;

  $("#btnRecheck")?.addEventListener("click", () => {
    logAction("recheck", "source_file", "ALL", "à¸•à¸£à¸§à¸ˆà¸„à¸§à¸²à¸¡à¸„à¸£à¸šà¸–à¹‰à¸§à¸™à¹„à¸Ÿà¸¥à¹Œà¹ƒà¸«à¸¡à¹ˆ");
    toast("à¸•à¸£à¸§à¸ˆà¹„à¸Ÿà¸¥à¹Œà¹ƒà¸«à¸¡à¹ˆà¹€à¸ªà¸£à¹‡à¸ˆ: à¸ªà¸–à¸²à¸™à¸°à¹„à¸¡à¹ˆà¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¹à¸›à¸¥à¸‡");
  });
  $("#btnUpload")?.addEventListener("click", () => go("import"));
  $("#btnRemind")?.addEventListener("click", () => {
    logAction("notify", "source_file", "missing", "à¸ªà¹ˆà¸‡à¹à¸ˆà¹‰à¸‡à¹€à¸•à¸·à¸­à¸™à¸œà¸¹à¹‰à¸ªà¹ˆà¸‡à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸¢à¸±à¸‡à¸‚à¸²à¸”");
    toast("à¸ªà¹ˆà¸‡à¹à¸ˆà¹‰à¸‡à¹€à¸•à¸·à¸­à¸™à¹„à¸›à¸¢à¸±à¸‡à¸«à¸±à¸§à¸«à¸™à¹‰à¸²à¸à¸°à¸—à¸µà¹ˆà¹€à¸à¸µà¹ˆà¸¢à¸§à¸‚à¹‰à¸­à¸‡à¹à¸¥à¹‰à¸§");
  });
  root.querySelectorAll("[data-fix]").forEach((b) =>
    b.addEventListener("click", () => {
      logAction("notify", "source_file", b.dataset.fix, "à¸—à¸§à¸‡à¹„à¸Ÿà¸¥à¹Œà¸£à¸²à¸¢à¸£à¸²à¸¢à¸à¸²à¸£");
      toast("à¸—à¸§à¸‡à¹„à¸Ÿà¸¥à¹Œ " + b.dataset.fix + " à¹à¸¥à¹‰à¸§");
    }),
  );
};

/* =============================================================
   VIEW: Exceptions
   ============================================================= */
function exceptionSideTimestamp(e, side) {
  const time = e[`${side}Time`];
  const date = e[`${side}Date`];
  return time && time !== "-" && date ? `${date} ${time}` : "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸§à¸¥à¸²à¸•à¹‰à¸™à¸‰à¸šà¸±à¸š â€” à¹€à¸›à¸´à¸”à¸«à¸¥à¸±à¸à¸à¸²à¸™à¸•à¸£à¸§à¸ˆ";
}

function reviewCustomer(e, side) {
  const value = e.customerDetails?.[side] || {};
  const account = String(value.account || "").trim();
  const digits = account.replace(/[\s-]/g, "");
  return { user: String(value.user || ""), account, name: String(value.name || ""),
    tail: /^\d{4,}$/.test(digits) ? digits.slice(-4) : "", reference: String(value.reference || "") };
}
function reviewAccountHtml(e) {
  const account = String(e.account || "").trim();
  const isPm = /^(AUTOPEER|ATP|AZPAY|COREPAY|CPXM|CYBERPLUS|MYPAY|12PAY|PM)$/i.test(account);
  const bo = reviewCustomer(e, "bo");
  const stm = reviewCustomer(e, "stm");
  const isSys123 = ["AT4", "FR8", "SK8"].includes(String(e.company || "").toUpperCase());
  const tails = [...new Set([bo.tail, stm.tail].filter(Boolean))];
  const names = [...new Set([bo.name, stm.name].filter(Boolean))];
  const searchTags = isSys123 && (tails.length || names.length)
    ? `<small class="sub">${tails.map((tail) => `<span class="badge blue">à¸—à¹‰à¸²à¸¢ 4: ${h(tail)}</span>`).join(" ")} ${names.map((name) => `<span class="badge violet">à¸Šà¸·à¹ˆà¸­: ${h(name)}</span>`).join(" ")}</small>`
    : "";
  const customerBlock = (label, c) => `<span><b>${label}</b><br>à¹€à¸¥à¸‚à¸šà¸±à¸à¸Šà¸µ: ${h(c.account || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¹ƒà¸™à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹€à¸„à¸ª")}<br>à¸Šà¸·à¹ˆà¸­à¸¥à¸¹à¸à¸„à¹‰à¸²: ${h(c.name || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¹ƒà¸™à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹€à¸„à¸ª")}<br>à¸—à¹‰à¸²à¸¢ 4 à¸•à¸±à¸§: <b>${h(c.tail || "à¸¢à¸±à¸‡à¸¢à¸·à¸™à¸¢à¸±à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰")}</b></span>`;
  return `<div class="review-account-details"><b>${isPm ? "à¸œà¸¹à¹‰à¹ƒà¸«à¹‰à¸šà¸£à¸´à¸à¸²à¸£ PM" : "à¸šà¸±à¸à¸Šà¸µà¸—à¸µà¹ˆà¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”"}: ${h(account || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸")}</b>${searchTags}${isPm ? '<small>à¸šà¸±à¸à¸Šà¸µà¸£à¸±à¸šâ€“à¸ˆà¹ˆà¸²à¸¢à¸‚à¸­à¸‡à¸šà¸£à¸´à¸©à¸±à¸—: à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸¢à¸·à¸™à¸¢à¸±à¸™à¹ƒà¸™à¹€à¸„à¸ª</small>' : ""}${customerBlock("à¸šà¸±à¸à¸Šà¸µà¸¥à¸¹à¸à¸„à¹‰à¸²à¹ƒà¸™ BO", bo)}${customerBlock("à¸šà¸±à¸à¸Šà¸µà¸¥à¸¹à¸à¸„à¹‰à¸²à¹ƒà¸™ STM/PM", stm)}</div>`;
}
function reviewCustomerHtml(e, side) {
  const c = reviewCustomer(e, side);
  const source = e.customerDetails?.[side] || {};
  const manual = side === "bo" && /à¹€à¸•à¸´à¸¡\s*à¸¡à¸·à¸­|à¹€à¸•à¸´à¸¡à¹€à¸­à¸‡|manual/i.test(String(source.origin || ""));
  const manualHtml = manual ? `<div class="review-account-details"><b>à¸£à¸²à¸¢à¸à¸²à¸£à¹€à¸•à¸´à¸¡à¸¡à¸·à¸­</b><span>à¸—à¸³à¸£à¸²à¸¢à¸à¸²à¸£à¹‚à¸”à¸¢ (N): <b>${h(source.performedBy || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¹ƒà¸™à¸•à¹‰à¸™à¸‰à¸šà¸±à¸š")}</b></span><span style="white-space:pre-wrap">à¸«à¸¡à¸²à¸¢à¹€à¸«à¸•à¸¸ (O): ${h(source.note || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¹ƒà¸™à¸•à¹‰à¸™à¸‰à¸šà¸±à¸š")}</span><small>à¸«à¸¡à¸²à¸¢à¹€à¸«à¸•à¸¸à¸ˆà¸²à¸ BO à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¹€à¸­à¸à¸ªà¸²à¸£à¸Šà¸µà¹‰à¹à¸ˆà¸‡</small></div>` : "";
  if (!Object.values(c).some(Boolean)) return manualHtml + '<small>à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸¥à¸¹à¸à¸„à¹‰à¸² â€” à¹€à¸›à¸´à¸”à¹„à¸Ÿà¸¥à¹Œà¸•à¹‰à¸™à¸‰à¸šà¸±à¸šà¸•à¸£à¸§à¸ˆ</small>';
  return manualHtml + `<details><summary>à¸”à¸¹ User / à¸šà¸±à¸à¸Šà¸µà¸¥à¸¹à¸à¸„à¹‰à¸²</summary><dl><dt>User</dt><dd>${h(c.user || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸")}</dd><dt>à¹€à¸¥à¸‚à¸šà¸±à¸à¸Šà¸µà¸¥à¸¹à¸à¸„à¹‰à¸²</dt><dd>${h(c.account || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸")}</dd><dt>à¸Šà¸·à¹ˆà¸­à¸¥à¸¹à¸à¸„à¹‰à¸²</dt><dd>${h(c.name || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸")}</dd><dt>à¸—à¹‰à¸²à¸¢ 4 à¸•à¸±à¸§</dt><dd>${h(c.tail || "à¸¢à¸±à¸‡à¸¢à¸·à¸™à¸¢à¸±à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰")}</dd><dt>à¸£à¸«à¸±à¸ªà¸­à¹‰à¸²à¸‡à¸­à¸´à¸‡à¸•à¹‰à¸™à¸‰à¸šà¸±à¸š</dt><dd>${h(c.reference || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸")}</dd></dl></details>`;
}

function groupReviewCases(rows) {
  const groups = new Map();
  for (const row of rows) {
    // Unknown accounts must not be combined as if they were the same account.
    const account = row.account && row.account !== "-" ? row.account : row.id;
    const key = JSON.stringify([row.company, row.date, account, row.direction, row.type, row.status]);
    if (!groups.has(key)) groups.set(key, { first: row, ids: [], overdue: 0 });
    const group = groups.get(key);
    group.ids.push(row.id);
    if (row.overSla) group.overdue++;
  }
  return [...groups.values()];
}

let reviewQueueIds = [];
VIEWS.exceptions = (root) => {
  // A work sheet always belongs to one authorized company; ALL is a picker, not a mixed queue.
  if (state.filters.company === "ALL" || !canAccessCompany(state.filters.company)) {
    reviewQueueIds = [];
    const companies = companyMaster();
    root.innerHTML = `<section class="panel"><div class="panel-heading"><div><p class="eyebrow">à¸‚à¸­à¸šà¹€à¸‚à¸•à¸à¸²à¸£à¸•à¸£à¸§à¸ˆ</p><h2>3 à¹€à¸„à¸£à¸·à¸­à¸šà¸£à¸´à¸©à¸±à¸— Â· à¹€à¸¥à¸·à¸­à¸à¸šà¸£à¸´à¸©à¸±à¸—à¸¢à¹ˆà¸­à¸¢</h2><p>à¹€à¸›à¸´à¸”à¸‡à¸²à¸™à¸—à¸µà¸¥à¸°à¸šà¸£à¸´à¸©à¸±à¸— â†’ à¹€à¸¥à¸·à¸­à¸à¸Šà¸µà¸—à¸à¸²à¸à¸«à¸£à¸·à¸­à¸–à¸­à¸™ â†’ à¸•à¸£à¸§à¸ˆ BO à¹€à¸—à¸µà¸¢à¸š STM / PM</p></div><span class="health ok">${num(AUDIT_COMPANY_GROUPS.length)} à¹€à¸„à¸£à¸·à¸­</span></div><div class="review-company-groups">${reviewCompanyGroupsMarkup(companies) || "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸šà¸£à¸´à¸©à¸±à¸—à¸—à¸µà¹ˆà¸„à¸¸à¸“à¸¡à¸µà¸ªà¸´à¸—à¸˜à¸´à¹Œà¸•à¸£à¸§à¸ˆ"}</div></section>`;
    root.querySelectorAll('[data-review-company]').forEach((button) => button.addEventListener('click', () => {
      if (!canAccessCompany(button.dataset.reviewCompany)) return;
      state.filters.company = button.dataset.reviewCompany;
      state.filters.direction = "à¸à¸²à¸";
      state.reviewSheet = "normal";
      state.auditDocumentView = MC8LiveSheets.COMPANIES.includes(button.dataset.reviewCompany) ? "excel" : "review";
      state.exFilter.status = "ACTION";
      state.page = 1;
      render();
    }));
    return;
  }
  if (state.dataset === "production" && Sb.signedIn()) {
    const company = state.filters.company;
    const supportsExcelView = MC8LiveSheets.COMPANIES.includes(company);
    const auditView = supportsExcelView ? state.auditDocumentView : 'review';
    root.innerHTML = `<section class="audit-view-switcher" aria-label="à¸£à¸¹à¸›à¹à¸šà¸šà¸«à¸™à¹‰à¸²à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”">
      <div><b>${h(company)} Â· ${h(state.filters.to || DEFAULT_WORK_DATE)}</b><small>à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸Šà¸¸à¸”à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™à¸—à¸±à¹‰à¸‡à¸«à¸™à¹‰à¸²à¸ˆà¸­à¹à¸¥à¸°à¹„à¸Ÿà¸¥à¹Œ Excel</small></div>
      <div class="audit-view-switcher-actions">
        <button type="button" class="ghost-button" data-audit-view="companies">à¸à¸¥à¸±à¸šà¹€à¸¥à¸·à¸­à¸à¸šà¸£à¸´à¸©à¸±à¸—</button>
        <button type="button" class="${auditView === "excel" ? "primary-button" : "ghost-button"}" data-audit-view="excel" aria-pressed="${auditView === "excel"}" ${supportsExcelView?'':'disabled title="à¸£à¸­à¹€à¸‡à¸·à¹ˆà¸­à¸™à¹„à¸‚à¸‚à¸­à¸‡à¹€à¸„à¸£à¸·à¸­à¸šà¸£à¸´à¸©à¸±à¸—à¸™à¸µà¹‰"'}>à¸¡à¸¸à¸¡à¸¡à¸­à¸‡à¹€à¸­à¸à¸ªà¸²à¸£ Excel</button>
        <button type="button" class="${auditView === "review" ? "primary-button" : "ghost-button"}" data-audit-view="review" aria-pressed="${auditView === "review"}">à¸•à¸£à¸§à¸ˆ / à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹€à¸„à¸ª</button>
      </div>
    </section><div id="auditViewBody"></div>`;
    root.querySelectorAll('[data-audit-view]').forEach(button => button.addEventListener('click', () => {
      if (button.dataset.auditView === 'companies') state.filters.company = 'ALL';
      else state.auditDocumentView = button.dataset.auditView;
      render();
    }));
    const workspace = root.querySelector('#auditViewBody');
    if (auditView === 'excel') {
      MC8LiveSheets.mount(workspace, {
        date: state.filters.to || DEFAULT_WORK_DATE,
        company,
        companies: [company],
        signedIn: () => state.dataset === 'production' && Sb.signedIn(),
        load: Sb.reconciliationOverview,
        loadFiles: runId => Sb.exceptionFiles(runId),
        readBoRecords: readAuditBoOperatorRecords,
        onRecheck: openAccountRecheck,
        onManageFiles: openFileRunManagement,
        exportBoWaitingCases: downloadBoWaitingCaseRequest,
        onNewCaseSet: ['lead','admin'].includes(state.role)?openManualPrimaryCaseSet:null,
        isActive: () => state.route === 'exceptions' && state.filters.company === company && state.auditDocumentView === 'excel',
        onDate: date => { state.filters.date = date; state.filters.from = date; state.filters.to = date; },
        onCase: async row => {
          if (!row?.id) throw new Error('à¹„à¸¡à¹ˆà¸žà¸š UUID à¸‚à¸­à¸‡à¹€à¸„à¸ªà¸ˆà¸£à¸´à¸‡');
          await openEvidenceRelatedCase(row.id, {focusFiles: true});
        },
        onCaseError: error => toast('à¹€à¸›à¸´à¸”à¹€à¸„à¸ªà¸ˆà¸£à¸´à¸‡à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: ' + (error?.message || 'à¹„à¸¡à¹ˆà¸—à¸£à¸²à¸šà¸ªà¸²à¹€à¸«à¸•à¸¸'), 'warn'),
        onFile: (file,dateValue,companyValue) => { if(file?.storage_path) openStoredFilePreview({path:file.storage_path,name:file.file_name,mime:file.mime_type,id:file.id,kind:file.kind,company:file.company||companyValue,date:dateValue,size:file.size_bytes,status:file.parse_error?'error':file.parsed?'parsed':'waiting'}); },
        exportWorkbook: (sheets, filename, meta) => Exporter.workbook(sheets, filename, meta),
        onExported: ({filename,company:exportCompany,date,rows,sheets,complete}) => {
          logAction('export', 'audit_reconciliation_workbook', `${exportCompany}|${date}`, `Excel ${sheets} à¸Šà¸µà¸• Â· ${rows} à¹à¸–à¸§ Â· ${complete?'à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸£à¸­à¸šà¸„à¸£à¸š':'à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸£à¸­à¸šà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸„à¸£à¸š'}`);
          toast(`à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸” ${filename} à¹à¸¥à¹‰à¸§ (${sheets} à¸Šà¸µà¸• Â· ${num(rows)} à¹à¸–à¸§)`);
        },
      });
      return;
    }
    ReviewOverview.mount(workspace, {
      company,
      date: state.filters.to || DEFAULT_WORK_DATE,
      minDate: VISIBLE_DATE_FROM,
      load: async (company,date) => {
        const [data,scopes]=await Promise.all([Sb.reconciliationOverview(company,date),Sb.reviewHoldScopes()]);
        AccountReviewHolds.set(scopes);return data;
      },
      loadRecommendations: Sb.evidenceCaseRecommendations,
      onRecommendation: links => EvidenceRecommendations.showCaseLinks(links, Sb, openStoredFilePreview, openEvidenceRelatedCase),
      onExport: exportSheets,
      onConfirm: Sb.confirmAuditPairs,
      onBulkClose: can('approve') ? confirmBulkCaseClose : undefined,
      onBatchStatus: confirmAuditStatusBatch,
      onCrossDay: row => row && CrossDayWorkbench.open(mapLiveException(row)),
      canReviewClosed: ['lead','admin'].includes(state.role),
      onDateChange: date => { state.filters.date=date; state.filters.from=date; state.filters.to=date; },
      isActive: () => state.route === "exceptions" && state.filters.company === company && auditView === 'review',
      onCompany: () => { state.filters.company = "ALL"; render(); },
      onCase: (row, {action = 'files', onComplete = async () => {}} = {}) => {
        if (!row) return;
        if (action === 'close') {
          if (!can('approve')) return deny('à¸›à¸´à¸”à¹€à¸„à¸ª');
          return confirmBulkCaseClose([row], {company: row.company, date: row.business_date, onComplete});
        }
        if (action === 'clarify') {
          if (!can('request_clarify')) return deny('à¸ªà¹ˆà¸‡à¸Šà¸µà¹‰à¹à¸ˆà¸‡');
          if (!['open', 'answered', 'pending_next_day'].includes(row.status)) return toast('à¸ªà¸–à¸²à¸™à¸°à¸™à¸µà¹‰à¸ªà¹ˆà¸‡à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰ à¸«à¸£à¸·à¸­à¸ªà¹ˆà¸‡à¹à¸¥à¹‰à¸§ à¸à¸£à¸¸à¸“à¸²à¸£à¸µà¹€à¸Ÿà¸£à¸Š', 'warn');
          openModal('à¸ªà¹ˆà¸‡à¸‚à¸­à¸Šà¸µà¹‰à¹à¸ˆà¸‡', `<p>${h(row.code)} Â· ${h(row.company)} Â· ${h(row.business_date)}</p><p>à¸ªà¹ˆà¸‡à¹€à¸‚à¹‰à¸²à¹€à¸›à¹‡à¸™à¸‡à¸²à¸™à¹ƒà¸™à¸Šà¸µà¸—à¸‚à¸­à¸‡à¸œà¸¹à¹‰à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸šà¸£à¸´à¸©à¸±à¸— ${h(row.company)} à¹‚à¸”à¸¢à¹ƒà¸Šà¹‰à¹€à¸„à¸ªà¹€à¸”à¸´à¸¡ à¹„à¸¡à¹ˆà¸ªà¹ˆà¸‡à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸ à¸²à¸¢à¸™à¸­à¸</p><p id="inlineClarifyResult" role="status"></p>`, '<button id="inlineClarifyCancel" class="ghost-button">à¸¢à¸à¹€à¸¥à¸´à¸</button><button id="inlineClarifyConfirm" class="primary-button">à¸¢à¸·à¸™à¸¢à¸±à¸™à¸ªà¹ˆà¸‡à¸‚à¸­à¸Šà¸µà¹‰à¹à¸ˆà¸‡</button>');
          $('#inlineClarifyCancel').onclick = closeModal;
          $('#inlineClarifyConfirm').onclick = async (event) => {
            const button = event.currentTarget;
            button.disabled = true;
            $('#inlineClarifyResult').textContent = 'à¸à¸³à¸¥à¸±à¸‡à¸ªà¹ˆà¸‡à¹à¸¥à¸°à¸­à¹ˆà¸²à¸™à¸¢à¸·à¸™à¸¢à¸±à¸™à¸ˆà¸²à¸à¸£à¸°à¸šà¸š â€” à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸–à¸·à¸­à¸§à¹ˆà¸²à¸ªà¹ˆà¸‡à¸ªà¸³à¹€à¸£à¹‡à¸ˆ';
            try {
              const requestedAt = new Date().toISOString();
              await Sb.requestClarification(row.id, row.status, {requested_at: requestedAt, requested_by: Sb.authUser()?.id, updated_at: requestedAt});
            } catch (error) {
              $('#inlineClarifyResult').textContent = error.message;
              return;
            }
            closeModal();
            toast('à¸ªà¹ˆà¸‡à¹€à¸‚à¹‰à¸² à¸Šà¸µà¸—à¸£à¸­à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¹à¸¥à¹‰à¸§ â€” à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¸à¸”à¸ªà¹ˆà¸‡à¸‹à¹‰à¸³');
            await onComplete();
          };
          return;
        }
        const item = mapLiveException(row);
        // EX codes repeat between runs/companies; use the persisted UUID here.
        item.id = row.id;
        reviewQueueIds = [];
        const index = DB.exceptions.findIndex(e => e.dbId === item.dbId);
        if (index < 0) DB.exceptions.push(item); else DB.exceptions[index] = item;
        openException(item.id, {focusFiles: action === 'files'});
        if (action !== 'files') {
          const target = action === 'answer' ? '#btnRespond' : '#caseSummarySection';
          $(target)?.scrollIntoView({block:'center',behavior:'smooth'});
          toast('à¸•à¸£à¸§à¸ˆà¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¹à¸¥à¸°à¸à¸”à¸¢à¸·à¸™à¸¢à¸±à¸™à¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡ â€” à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸ªà¸–à¸²à¸™à¸°à¸«à¸£à¸·à¸­à¸ªà¹ˆà¸‡à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡');
        }
      },
    });
    return;
  }
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
  reviewQueueIds = sorted.map((row) => row.id);
  const reviewGroups = groupReviewCases(sorted);
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
  const qualityAvailable = Array.isArray(liveOverviewState.quality) && !hasLiveCoreError("à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”");
  const exceptionsAvailable = liveOverviewState.exceptionsReady;
  const resultMetric = (available, value) => available ? num(value) : "â€”";
  const reconMessage = liveOverviewState.loading && !qualityRows.length
    ? "à¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸ªà¸–à¸²à¸™à¸°à¸‡à¸²à¸™à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸ˆà¸²à¸ Supabase"
    : !qualityAvailable
      ? "à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸ˆà¸£à¸´à¸‡à¸¢à¸±à¸‡à¹‚à¸«à¸¥à¸”à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ â€” à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸ªà¸£à¸¸à¸›à¹€à¸›à¹‡à¸™à¸¨à¸¹à¸™à¸¢à¹Œ"
    : !qualityRows.length
      ? "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸‡à¸²à¸™à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¹ƒà¸™à¸§à¸±à¸™à¸—à¸µà¹ˆà¹à¸¥à¸°à¸šà¸£à¸´à¸©à¸±à¸—à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸"
      : !finishedRuns.length
        ? `à¸žà¸šà¸„à¸´à¸§à¸‡à¸²à¸™ ${num(qualityRows.length)} à¸‡à¸²à¸™ à¹à¸•à¹ˆà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸œà¸¥à¸£à¸±à¸™ â€” à¹€à¸¥à¸‚ 0 à¸”à¹‰à¸²à¸™à¸¥à¹ˆà¸²à¸‡à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸œà¸¥à¸ªà¸³à¹€à¸£à¹‡à¸ˆ`
        : `à¸¡à¸µà¸œà¸¥à¸£à¸±à¸™à¹à¸¥à¹‰à¸§ ${num(finishedRuns.length)} à¸‡à¸²à¸™ Â· à¸ªà¸³à¹€à¸£à¹‡à¸ˆ ${num(completedJobs)} Â· à¸¢à¸±à¸‡à¸£à¸­ ${num(waitingJobs)} Â· à¸¥à¹‰à¸¡à¹€à¸«à¸¥à¸§ ${num(failedJobs)}`;
  const overviewLoading = liveOverviewState.loading || liveOverviewState.auxiliaryLoading;

  const th = (key, label) =>
    `<th class="sortable ${state.sort.key === key ? "sorted " + state.sort.dir : ""}" data-sort="${key}">${label}</th>`;

  const auditSheetRows = rows.map((e) => {
    const hasStm = e.bankAmount !== null;
    const hasBo = e.systemAmount !== null;
    const result = hasStm && hasBo
      ? e.type === "time_diff" ? "à¸¢à¸­à¸”à¸•à¸£à¸‡ Â· à¹€à¸§à¸¥à¸²à¸•à¹ˆà¸²à¸‡" : e.type === "amount_diff" ? "à¹€à¸§à¸¥à¸²à¹ƒà¸à¸¥à¹‰ Â· à¸¢à¸­à¸”à¸•à¹ˆà¸²à¸‡" : e.typeName
      : hasStm ? "à¹„à¸¡à¹ˆà¸žà¸šà¸à¸±à¹ˆà¸‡ BO" : "à¹„à¸¡à¹ˆà¸žà¸šà¸à¸±à¹ˆà¸‡ STM";
    const explanation = e.responseText || e.resolutionNote || (e.notes || []).at(-1)?.text || "";
    return `<tr class="clickable ${e.status==='pair_pending'?'pair-pending-row':''} ${e.overSla ? "over-sla" : ""}" data-ex="${h(e.id)}">
      <td class="sheet-state"><span class="badge ${caseStatusMeta(e).tone}">${h(caseStatusMeta(e).name)}</span><small>${h(caseLabel(e))}</small></td>
      <td>${h(e.date)}</td><td><b>${h(e.company)}</b><small class="sub">${h(e.direction)}</small></td><td>${reviewAccountHtml(e)}</td>
      <td class="sheet-side ${hasBo ? "has-value" : "is-blank"}">${hasBo ? `<b>${h(exceptionSideTimestamp(e, "bo"))}</b><small>${h(e.employee)}</small>${reviewCustomerHtml(e, "bo")}` : ""}</td>
      <td class="right tnum sheet-side ${hasBo ? "has-value" : "is-blank"}">${hasBo ? money(e.systemAmount) : ""}</td>
      <td class="sheet-side ${hasStm ? "has-value" : "is-blank"}">${hasStm ? `<b>${h(exceptionSideTimestamp(e, "stm"))}</b><small>${h(e.bank)}</small>${reviewCustomerHtml(e, "stm")}` : ""}</td>
      <td class="right tnum sheet-side ${hasStm ? "has-value" : "is-blank"}">${hasStm ? money(e.bankAmount) : ""}</td>
      <td class="right tnum">${hasStm && hasBo ? h(exceptionTimeDiffLabel(e)) : ""}</td>
      <td class="right tnum ${e.amountDiff ? "danger" : ""}">${hasStm && hasBo ? money(e.amountDiff) : ""}</td>
      <td><b class="${hasStm && hasBo && !e.amountDiff && e.type !== "time_diff" ? "success" : "danger"}">${h(result)}</b><small class="sub">${h(e.typeName)}</small></td>
      <td class="sheet-explanation ${explanation ? "answered" : "waiting"}">${explanation ? h(explanation) : "<span>à¹€à¸§à¹‰à¸™à¹„à¸§à¹‰à¸£à¸­à¸Šà¸µà¹‰à¹à¸ˆà¸‡</span>"}</td>
      <td><div class="case-actions"><button class="primary-button xs" data-case-open="${h(e.id)}">à¸•à¸£à¸§à¸ˆ</button><button class="ghost-button xs" data-case-files="${h(e.id)}">à¹„à¸Ÿà¸¥à¹Œ</button>${isQuickCloseEligible(e) && can("approve") ? `<button class="primary-button xs quick-close" data-case-quick-close="${h(e.id)}">à¸›à¸´à¸”à¹€à¸„à¸ª</button>` : ""}</div></td>
    </tr>`;
  }).join("") || `<tr><td colspan="13" class="empty">à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸•à¸²à¸¡à¸•à¸±à¸§à¸à¸£à¸­à¸‡</td></tr>`;

  const caseQueueRows = rows.map((e) => `<tr class="clickable ${e.status==='pair_pending'?'pair-pending-row':''} ${e.overSla ? "over-sla" : ""}" data-ex="${e.id}">
    <td><b>${h(caseLabel(e))}</b>${e.overSla ? '<span class="sla-flag" title="à¹€à¸à¸´à¸™ SLA">!</span>' : ""}</td><td class="tnum">${e.time}</td>
    <td>${h(e.account)}<small class="sub">${h(e.direction)}</small></td><td>${h(e.typeName)}</td>
    <td class="right tnum">${e.systemAmount === null ? '<span class="muted">â€”</span>' : money(e.systemAmount)}</td>
    <td class="right tnum">${e.bankAmount === null ? '<span class="muted">â€”</span>' : money(e.bankAmount)}</td>
    <td class="right tnum">${diffLabel(e)}${e.riskAmount ? `<small class="sub">à¸•à¸£à¸§à¸ˆ ${money(e.riskAmount)}</small>` : ""}</td>
    <td><span class="badge ${e.severity}">${h(sevMeta(e.severity).name)}</span></td>
    <td>${h(e.employee)}<small class="sub">${h((DB.shifts.find((s) => s.code === e.shift) || {}).name || e.shift || "-")}</small></td>
    <td><span class="badge ${caseStatusMeta(e).tone}">${h(caseStatusMeta(e).name)}</span></td>
    <td><div class="case-actions"><button class="primary-button xs" data-case-open="${h(e.id)}">à¸•à¸£à¸§à¸ˆà¹€à¸„à¸ª</button><button class="ghost-button xs" data-case-files="${h(e.id)}">à¸”à¸¹à¹„à¸Ÿà¸¥à¹Œ</button></div></td>
  </tr>`).join("") || `<tr><td colspan="11" class="empty">à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸•à¸²à¸¡à¸•à¸±à¸§à¸à¸£à¸­à¸‡</td></tr>`;

  root.innerHTML = `
    ${overviewLoading ? `<section class="recon-loading-banner" role="status" aria-live="polite"><span class="spinner"></span><div><b>à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸£à¸´à¸‡â€¦</b><small>${liveOverviewState.loading ? "à¸à¸³à¸¥à¸±à¸‡à¸­à¹ˆà¸²à¸™à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¹à¸¥à¸°à¸£à¸²à¸¢à¸à¸²à¸£à¸œà¸´à¸”à¸›à¸à¸•à¸´à¸ˆà¸²à¸ Supabase" : "à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸«à¸¥à¸±à¸à¸¡à¸²à¹à¸¥à¹‰à¸§ à¸à¸³à¸¥à¸±à¸‡à¹€à¸•à¸´à¸¡à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸°à¸ªà¸–à¸²à¸™à¸°à¸¥à¹ˆà¸²à¸ªà¸¸à¸”"}</small></div><span class="recon-loading-pulse" aria-hidden="true"></span></section>` : ""}
    <section class="panel recon-result-summary">
      <div class="panel-heading"><div><p class="eyebrow">à¸œà¸¥à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¹ƒà¸™à¸Šà¹ˆà¸§à¸‡à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸</p><h2>${h(reconMessage)}</h2><small class="head-sub">à¸Šà¹ˆà¸§à¸‡ ${h(state.filters.from)} à¸–à¸¶à¸‡ ${h(state.filters.to)} Â· ${state.filters.company === "ALL" ? "à¸—à¸¸à¸à¸šà¸£à¸´à¸©à¸±à¸—" : h(state.filters.company)}</small></div><button class="primary-button sm" id="openDailyResult">à¹€à¸›à¸´à¸”à¸ªà¸£à¸¸à¸› 1 à¸šà¸£à¸´à¸©à¸±à¸—/à¸§à¸±à¸™</button></div>
      <div class="recon-kpi-grid">
        <article class="recon-kpi run"><span>à¸‡à¸²à¸™à¸—à¸µà¹ˆà¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¹à¸¥à¹‰à¸§</span><strong>${resultMetric(qualityAvailable, finishedRuns.length)}<small> / ${qualityAvailable ? num(qualityRows.length) : "â€”"} à¸‡à¸²à¸™</small></strong><p>${qualityAvailable ? `à¸ªà¸³à¹€à¸£à¹‡à¸ˆ ${num(completedJobs)} Â· à¸£à¸­ ${num(waitingJobs)} Â· à¸¥à¹‰à¸¡à¹€à¸«à¸¥à¸§ ${num(failedJobs)}` : "à¸à¸³à¸¥à¸±à¸‡à¸£à¸­à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸£à¸´à¸‡"}</p></article>
        <article class="recon-kpi"><span>à¸£à¸²à¸¢à¸à¸²à¸£ STM / PM</span><strong>${resultMetric(qualityAvailable, stmTotal)}</strong><p>à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸à¸²à¸à¹à¸¥à¸°à¸–à¸­à¸™à¸—à¸µà¹ˆà¸£à¸°à¸šà¸šà¸­à¹ˆà¸²à¸™à¹„à¸”à¹‰</p></article>
        <article class="recon-kpi"><span>à¸£à¸²à¸¢à¸à¸²à¸£ BO</span><strong>${resultMetric(qualityAvailable, boTotal)}</strong><p>à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸£à¸²à¸¢à¸à¸²à¸£à¸ˆà¸²à¸à¸£à¸°à¸šà¸šà¸«à¸¥à¸±à¸‡à¸šà¹‰à¸²à¸™</p></article>
        <article class="recon-kpi match"><span>à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ</span><strong>${resultMetric(qualityAvailable, matchedTotal)}</strong><p>${qualityAvailable ? `${stmTotal ? ((matchedTotal / stmTotal) * 100).toFixed(2) : "0.00"}% à¸‚à¸­à¸‡à¸£à¸²à¸¢à¸à¸²à¸£ STM / PM` : "à¸à¸³à¸¥à¸±à¸‡à¸£à¸­à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸£à¸´à¸‡"}</p></article>
      </div>
      <div class="recon-work-grid">
        <button type="button" class="warn" data-action-route="exceptions"><i>${resultMetric(exceptionsAvailable, sorted.length)}</i><span><b>à¸£à¸²à¸¢à¸à¸²à¸£à¸£à¸­à¸•à¸£à¸§à¸ˆ</b><small>${qualityAvailable ? `à¸ªà¸£à¹‰à¸²à¸‡à¸ˆà¸²à¸à¸œà¸¥à¸£à¸±à¸™ ${num(generatedExceptionTotal)} à¸£à¸²à¸¢à¸à¸²à¸£` : "à¸à¸³à¸¥à¸±à¸‡à¸£à¸­à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸£à¸´à¸‡"}</small></span><em>à¸”à¸¹à¸£à¸²à¸¢à¸à¸²à¸£à¸”à¹‰à¸²à¸™à¸¥à¹ˆà¸²à¸‡ â†“</em></button>
        <button type="button" class="amber" data-action-route="audit-review"><i>${num(answeredCount)}</i><span><b>Audit à¸£à¸­à¸•à¸£à¸§à¸ˆ</b><small>à¸¡à¸µà¸„à¸³à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸«à¸£à¸·à¸­à¸«à¸¥à¸±à¸à¸à¸²à¸™à¹à¸¥à¹‰à¸§ Â· à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸›à¸´à¸”à¹€à¸„à¸ª</small></span><em>à¹€à¸›à¸´à¸”à¸•à¸£à¸§à¸ˆ â†’</em></button>
        <button type="button" class="red" data-action-route="clarify"><i>${num(reviewCount)}</i><span><b>à¸•à¹‰à¸­à¸‡à¹ƒà¸«à¹‰à¸„à¸¸à¸“à¸•à¸£à¸§à¸ˆ</b><small>à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸à¸³à¸à¸§à¸¡à¸«à¸£à¸·à¸­à¹„à¸Ÿà¸¥à¹Œà¸­à¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰</small></span><em>à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£ â†’</em></button>
        <button type="button" class="green" data-action-route="daily-summary"><i>${num(autoClosedCount)}</i><span><b>à¸›à¸´à¸”à¹€à¸„à¸ªà¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´</b><small>à¸¢à¸·à¸™à¸¢à¸±à¸™à¸ˆà¸²à¸à¹„à¸Ÿà¸¥à¹Œà¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸ªà¸³à¹€à¸£à¹‡à¸ˆ</small></span><em>à¸”à¸¹à¸ªà¸£à¸¸à¸› â†’</em></button>
      </div>
    </section>
    <section class="panel">
      <div class="case-filter-heading"><strong>2. à¹€à¸¥à¸·à¸­à¸à¹€à¸„à¸ªà¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸”à¸¹</strong><p>à¹€à¸„à¸ªà¹€à¸”à¸´à¸¡à¸¢à¸±à¸‡à¸­à¸¢à¸¹à¹ˆà¹ƒà¸™à¸ à¸²à¸žà¸£à¸§à¸¡à¹€à¸ªà¸¡à¸­ Â· à¹€à¸¥à¸·à¸­à¸ â€œà¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”â€ à¹à¸¥à¸° â€œà¸—à¸¸à¸à¸ªà¸–à¸²à¸™à¸°â€ à¹€à¸žà¸·à¹ˆà¸­à¸¢à¹‰à¸­à¸™à¸”à¸¹à¸£à¸§à¸¡à¸›à¸´à¸”à¹à¸¥à¹‰à¸§ Â· à¸£à¸­à¸«à¸±à¸§à¸«à¸™à¹‰à¸²à¸•à¸£à¸§à¸ˆà¹„à¸”à¹‰à¸—à¸µà¹ˆ â€œà¸­à¸™à¸¸à¸¡à¸±à¸•à¸´ / à¸›à¸´à¸”à¹€à¸„à¸ªâ€</p></div>
      <div class="case-filter-fields">
        <label class="case-filter-search" for="exSearch">à¸„à¹‰à¸™à¸«à¸²à¹€à¸„à¸ªà¸«à¸£à¸·à¸­à¸šà¸±à¸à¸Šà¸µ
        <input type="search" id="exSearch" placeholder="à¹€à¸¥à¸‚à¹€à¸„à¸ª / à¹€à¸¥à¸‚à¸šà¸±à¸à¸Šà¸µ / à¸—à¹‰à¸²à¸¢ 4 / à¸Šà¸·à¹ˆà¸­à¸¥à¸¹à¸à¸„à¹‰à¸² / à¸ªà¸¡à¸²à¸Šà¸´à¸ / Provider" value="${h(x.q)}" /></label>
        <label for="exStatus">à¸ªà¸–à¸²à¸™à¸°à¸‡à¸²à¸™
        <select id="exStatus">
          <option value="ACTION" ${x.status === "ACTION" ? "selected" : ""}>à¸¢à¸±à¸‡à¸•à¹‰à¸­à¸‡à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£ (à¹„à¸¡à¹ˆà¸£à¸§à¸¡à¸›à¸´à¸”à¹à¸¥à¹‰à¸§)</option>
          <option value="ALL" ${x.status === "ALL" ? "selected" : ""}>à¸—à¸¸à¸à¸ªà¸–à¸²à¸™à¸° Â· à¸£à¸§à¸¡à¸›à¸´à¸”à¹à¸¥à¹‰à¸§</option>
          <option value="CLOSURE_PENDING" ${x.status === 'CLOSURE_PENDING' ? 'selected' : ''}>à¸£à¸­à¸«à¸±à¸§à¸«à¸™à¹‰à¸²à¸›à¸´à¸”à¹€à¸„à¸ª</option>
          ${DB.statuses.map((s) => `<option value="${s.code}" ${x.status === s.code ? "selected" : ""}>${h(s.name)}</option>`).join("")}
        </select></label>
        <label for="exType">à¸›à¸£à¸°à¹€à¸ à¸—à¸›à¸±à¸à¸«à¸²à¸—à¸µà¹ˆà¸žà¸š
        <select id="exType">
          <option value="ALL">à¸—à¸¸à¸à¸›à¸±à¸à¸«à¸²</option>
          ${allExceptionTypes().map((t) => `<option value="${t.code}" ${x.type === t.code ? "selected" : ""}>${h(t.name)}</option>`).join("")}
        </select></label>
        <label for="exSeverity">à¸£à¸°à¸”à¸±à¸šà¸„à¸§à¸²à¸¡à¸£à¸¸à¸™à¹à¸£à¸‡
        <select id="exSeverity">
          <option value="ALL">à¸—à¸¸à¸à¸£à¸°à¸”à¸±à¸š</option>
          ${DB.severities.map((s) => `<option value="${s.code}" ${x.severity === s.code ? "selected" : ""}>${h(s.name)}</option>`).join("")}
        </select></label>
      </div>
      <div class="case-filter-actions">
        <label class="chk"><input type="checkbox" id="exSla" ${x.sla ? "checked" : ""} /> à¹€à¸‰à¸žà¸²à¸°à¹€à¸„à¸ªà¹€à¸à¸´à¸™à¸à¸³à¸«à¸™à¸”à¸•à¸­à¸š (SLA)</label>
        <button class="ghost-button sm" id="exReset">à¸„à¸·à¸™à¸„à¹ˆà¸²à¸•à¸±à¸§à¸à¸£à¸­à¸‡à¹€à¸„à¸ªà¹€à¸£à¸´à¹ˆà¸¡à¸•à¹‰à¸™</button>
        <small>à¹„à¸¡à¹ˆà¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸§à¸±à¸™à¸—à¸µà¹ˆà¹à¸¥à¸°à¸šà¸£à¸´à¸©à¸±à¸— Â· à¸à¸¥à¸±à¸šà¹„à¸›à¸”à¸¹à¹€à¸„à¸ªà¸—à¸µà¹ˆà¸¢à¸±à¸‡à¸•à¹‰à¸­à¸‡à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£</small>
      </div>
      <div class="case-filter-current" role="status" aria-live="polite"><b>à¸à¸³à¸¥à¸±à¸‡à¹à¸ªà¸”à¸‡</b>
        <span>${h(rangeLabel())} Â· ${h(state.filters.company === "ALL" ? "à¸—à¸¸à¸à¸šà¸£à¸´à¸©à¸±à¸—à¸•à¸²à¸¡à¸ªà¸´à¸—à¸˜à¸´à¹Œ" : state.filters.company)}</span>
        <span>${h(state.filters.direction === "ALL" ? "à¸—à¸¸à¸à¸˜à¸¸à¸£à¸à¸£à¸£à¸¡" : state.filters.direction)}</span>
        <span>${h(x.status === "ACTION" ? "à¸¢à¸±à¸‡à¸•à¹‰à¸­à¸‡à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£" : x.status === "ALL" ? "à¸—à¸¸à¸à¸ªà¸–à¸²à¸™à¸° à¸£à¸§à¸¡à¸›à¸´à¸”à¹à¸¥à¹‰à¸§" : statusMeta(x.status).name)}</span>
        <span>${h(x.type === "ALL" ? "à¸—à¸¸à¸à¸›à¸±à¸à¸«à¸²" : allExceptionTypes().find((t) => t.code === x.type)?.name || x.type)}</span>
        <span>${h(x.severity === "ALL" ? "à¸—à¸¸à¸à¸£à¸°à¸”à¸±à¸š" : DB.severities.find((s) => s.code === x.severity)?.name || x.severity)}</span>
        ${x.sla ? '<span>à¹€à¸à¸´à¸™à¸à¸³à¸«à¸™à¸”à¸•à¸­à¸šà¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™</span>' : ""}${query ? `<span>à¸„à¹‰à¸™à¸«à¸²: ${h(query)}</span>` : ""}
      </div>

      <div class="review-workbench" aria-label="à¹‚à¸•à¹Šà¸°à¸•à¸£à¸§à¸ˆà¹€à¸„à¸ª">
        <div><b>à¸šà¸£à¸´à¸©à¸±à¸— ${h(state.filters.company)} Â· à¹‚à¸•à¹Šà¸°à¸•à¸£à¸§à¸ˆà¹€à¸„à¸ª</b><small>à¸—à¸¸à¸à¸Šà¸µà¸—à¹ƒà¸™à¸«à¸™à¹‰à¸²à¸™à¸µà¹‰à¹€à¸›à¹‡à¸™à¸‚à¸­à¸‡à¸šà¸£à¸´à¸©à¸±à¸—à¸™à¸µà¹‰à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™</small><button type="button" class="ghost-button sm" id="reviewChangeCompany">à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸šà¸£à¸´à¸©à¸±à¸—</button></div>
        <div class="audit-view-switch" role="group" aria-label="à¸Šà¸µà¸—à¸à¸²à¸£à¸—à¸³à¸‡à¸²à¸™">
          <button type="button" data-review-sheet="all" aria-pressed="${state.reviewSheet === 'all'}" class="${state.reviewSheet === 'all' ? 'active' : ''}">à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” Â· à¸£à¸§à¸¡à¸£à¸­à¸›à¸´à¸”à¹à¸¥à¸°à¸›à¸£à¸°à¸§à¸±à¸•à¸´</button>
          <button type="button" data-review-sheet="normal" aria-pressed="${state.reviewSheet === "normal"}" class="${state.reviewSheet === "normal" ? "active" : ""}">1. à¸•à¸£à¸§à¸ˆà¸›à¸à¸•à¸´</button>
          <button type="button" data-review-sheet="clarification" aria-pressed="${state.reviewSheet === "clarification"}" class="${state.reviewSheet === "clarification" ? "active" : ""}">2. à¸•à¹‰à¸­à¸‡à¸Šà¸µà¹‰à¹à¸ˆà¸‡</button>
        </div>
        <div class="audit-view-switch" role="group" aria-label="à¹à¸¢à¸à¸•à¸£à¸§à¸ˆà¸à¸²à¸à¹à¸¥à¸°à¸–à¸­à¸™">
          ${[["à¸à¸²à¸", "à¸Šà¸µà¸—à¸à¸²à¸ (à¸)"], ["à¸–à¸­à¸™", "à¸Šà¸µà¸—à¸–à¸­à¸™ (à¸–)"], ["ALL", "à¸Šà¸µà¸—à¸£à¸§à¸¡"]].map(([value, label]) => `<button type="button" data-review-direction="${value}" aria-pressed="${state.filters.direction === value}" class="${state.filters.direction === value ? "active" : ""}">${label}</button>`).join("")}
        </div>
        <div class="review-workbench-actions">
          ${state.reviewSheet === "clarification" ? `<button class="ghost-button sm" data-review-status="clarifying">à¸£à¸­à¸•à¸­à¸š</button><button class="ghost-button sm" data-review-status="answered">à¸•à¸­à¸šà¹à¸¥à¹‰à¸§</button><button class="ghost-button sm" data-review-status="closed">à¸›à¸´à¸”à¹à¸¥à¹‰à¸§</button>` : `<button class="ghost-button sm" data-review-status="open">à¸£à¸­ Audit à¸•à¸£à¸§à¸ˆ</button>`}
          <button class="primary-button sm" id="reviewStart" ${sorted.length ? "" : "disabled"}>à¹€à¸£à¸´à¹ˆà¸¡à¸•à¸£à¸§à¸ˆ ${num(sorted.length)} à¹€à¸„à¸ªà¸•à¸²à¸¡à¸•à¸±à¸§à¸à¸£à¸­à¸‡</button>
        </div>
      </div>
      <p class="head-sub">${state.reviewSheet === "clarification" ? "à¹€à¸„à¸ªà¸—à¸µà¹ˆà¸ªà¹ˆà¸‡à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¹à¸¥à¹‰à¸§ Â· à¸”à¸¹à¸„à¸³à¸•à¸­à¸šà¹à¸¥à¸°à¹€à¸›à¸´à¸”à¸«à¸¥à¸±à¸à¸à¸²à¸™à¸ˆà¸²à¸à¹€à¸„à¸ªà¹€à¸”à¸´à¸¡ Â· à¸•à¸­à¸šà¹à¸¥à¹‰à¸§à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¹à¸›à¸¥à¸§à¹ˆà¸²à¸›à¸´à¸”à¹€à¸„à¸ª" : "à¸•à¸£à¸§à¸ˆ BO à¹€à¸—à¸µà¸¢à¸š STM/PM à¸à¹ˆà¸­à¸™ à¸«à¸²à¸à¸•à¹‰à¸­à¸‡à¸–à¸²à¸¡à¸ˆà¸¶à¸‡à¹€à¸›à¸´à¸”à¹€à¸„à¸ªà¹à¸¥à¹‰à¸§à¸à¸” â€œà¸ªà¹ˆà¸‡à¹„à¸›à¸Šà¸µà¸—à¸Šà¸µà¹‰à¹à¸ˆà¸‡â€ Â· à¸«à¸™à¹‰à¸²à¸™à¸µà¹‰à¹à¸ªà¸”à¸‡à¹€à¸„à¸ªà¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆ à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆà¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”"}</p>
      <div class="result-line">
        à¸žà¸š <b>${num(sorted.length)}</b> à¸£à¸²à¸¢à¸à¸²à¸£ Â· à¸¢à¸­à¸”à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆà¸£à¸§à¸¡ <b>${money0(sumRisk(sorted))}</b> à¸šà¸²à¸—
        Â· à¹€à¸à¸´à¸™ SLA <b class="danger">${num(sorted.filter((e) => e.overSla).length)}</b>
        ${query ? ` Â· à¸„à¹‰à¸™à¸ˆà¸²à¸ Supabase à¹‚à¸”à¸¢à¸•à¸£à¸‡ ${liveExceptionSearch.loading ? '<span class="badge blue">à¸à¸³à¸¥à¸±à¸‡à¸„à¹‰à¸™à¸«à¸²...</span>' : liveExceptionSearch.error ? `<span class="badge red">${h(liveExceptionSearch.error)}</span>` : '<span class="badge green">à¸„à¹‰à¸™à¹à¸¥à¹‰à¸§</span>'}` : ""}
      </div>

      <div class="audit-view-bar">
        <div><b>à¸£à¸¹à¸›à¹à¸šà¸šà¸à¸²à¸£à¸•à¸£à¸§à¸ˆ</b><span>${state.exceptionView === "sheet" ? "à¸•à¸²à¸£à¸²à¸‡à¸£à¸§à¸¡à¹€à¸«à¸¡à¸·à¸­à¸™ Excel â€” à¸Šà¹ˆà¸­à¸‡à¸§à¹ˆà¸²à¸‡à¸„à¸·à¸­à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸šà¸„à¸¹à¹ˆà¹à¸¥à¸°à¸•à¹‰à¸­à¸‡à¸£à¸­à¸Šà¸µà¹‰à¹à¸ˆà¸‡" : "à¸„à¸´à¸§à¹€à¸„à¸ªà¸ªà¸³à¸«à¸£à¸±à¸šà¸•à¸´à¸”à¸•à¸²à¸¡ SLA à¸«à¸¥à¸±à¸à¸à¸²à¸™ à¹à¸¥à¸°à¸à¸²à¸£à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´"}</span></div>
        <div class="audit-view-switch" role="group" aria-label="à¹€à¸¥à¸·à¸­à¸à¸£à¸¹à¸›à¹à¸šà¸šà¸à¸²à¸£à¸•à¸£à¸§à¸ˆ">
          <button type="button" class="${state.exceptionView === "sheet" ? "active" : ""}" data-ex-view="sheet">à¸•à¸²à¸£à¸²à¸‡à¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”</button>
          <button type="button" class="${state.exceptionView === "cases" ? "active" : ""}" data-ex-view="cases">à¸„à¸´à¸§à¹€à¸„à¸ª</button>
        </div>
      </div>

      ${query && fileMatches.length ? `<div class="related-files"><div><b>à¸žà¸šà¹„à¸Ÿà¸¥à¹Œà¸•à¹‰à¸™à¸‰à¸šà¸±à¸šà¸—à¸µà¹ˆà¹€à¸à¸µà¹ˆà¸¢à¸§à¸‚à¹‰à¸­à¸‡ ${num(fileMatches.length)} à¹„à¸Ÿà¸¥à¹Œ</b><small>${sorted.length ? "à¹à¸ªà¸”à¸‡à¸—à¸±à¹‰à¸‡ Exception à¹à¸¥à¸°à¹„à¸Ÿà¸¥à¹Œà¸«à¸¥à¸±à¸à¸à¸²à¸™" : "à¹„à¸¡à¹ˆà¸žà¸š Exception à¹à¸•à¹ˆà¸žà¸šà¹„à¸Ÿà¸¥à¹Œà¸ˆà¸£à¸´à¸‡ â€” à¹€à¸›à¸´à¸”à¹„à¸Ÿà¸¥à¹Œà¹€à¸žà¸·à¹ˆà¸­à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹„à¸”à¹‰"}</small></div><div class="related-file-list">${fileMatches.map((file) => `<button class="file-result" data-storage-open="${h(file.storage_path)}" data-file-id="${h(file.id)}" data-file-name="${h(file.file_name)}" data-file-mime="${h(file.mime_type || "")}" data-file-size="${h(file.size_bytes || "")}" data-file-kind="${h(file.kind || "")}" data-file-company="${h(file.batchCompany || file.company || "")}" data-file-date="${h(file.business_date || "")}" data-file-status="${file.parse_error ? "error" : file.parsed ? "parsed" : "waiting"}"><span>${h(file.file_name)}</span><small>${h(file.batchCompany || file.company || "à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸šà¸£à¸´à¸©à¸±à¸—")} Â· ${h(file.business_date || "-")} Â· ${file.parsed ? "à¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™" : file.parse_error ? "à¸­à¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰" : "à¸£à¸­à¸•à¸£à¸§à¸ˆ"}</small></button>`).join("")}</div></div>` : ""}

      ${query && !sorted.length && !fileMatches.length && !liveExceptionSearch.loading && !liveIntakeState.loading ? `<div class="search-empty-help"><b>à¹„à¸¡à¹ˆà¸žà¸š â€œ${h(query)}â€ à¹ƒà¸™à¸Šà¹ˆà¸§à¸‡à¹à¸¥à¸°à¸šà¸£à¸´à¸©à¸±à¸—à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸</b><span>à¸¥à¸­à¸‡à¸¥à¹‰à¸²à¸‡à¸•à¸±à¸§à¸à¸£à¸­à¸‡à¸šà¸£à¸´à¸©à¸±à¸—/à¸›à¸£à¸°à¹€à¸ à¸— à¸«à¸£à¸·à¸­à¸‚à¸¢à¸²à¸¢à¸Šà¹ˆà¸§à¸‡à¸§à¸±à¸™à¸—à¸µà¹ˆ à¸«à¸²à¸à¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸”à¸¹à¹„à¸Ÿà¸¥à¹Œà¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¹ƒà¸«à¹‰à¹„à¸›à¸—à¸µà¹ˆ â€œà¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸°à¸ªà¸–à¸²à¸™à¸°â€</span><button class="ghost-button sm" id="searchGoFiles">à¹€à¸›à¸´à¸”à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸°à¸ªà¸–à¸²à¸™à¸°</button></div>` : ""}

      <details class="review-groups">
        <summary>à¸•à¸£à¸§à¸ˆà¹€à¸›à¹‡à¸™à¸à¸¥à¸¸à¹ˆà¸¡ Â· ${num(reviewGroups.length)} à¸à¸¥à¸¸à¹ˆà¸¡ / ${num(sorted.length)} à¹€à¸„à¸ªà¸—à¸µà¹ˆà¹‚à¸«à¸¥à¸”</summary>
        <p>à¹à¸¢à¸à¸šà¸£à¸´à¸©à¸±à¸— à¸§à¸±à¸™ à¸šà¸±à¸à¸Šà¸µ à¸à¸²à¸/à¸–à¸­à¸™ à¸›à¸£à¸°à¹€à¸ à¸—à¸›à¸±à¸à¸«à¸² à¹à¸¥à¸°à¸ªà¸–à¸²à¸™à¸°à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™ à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸à¸²à¸£à¸¢à¸·à¸™à¸¢à¸±à¸™à¸§à¹ˆà¸²à¹€à¸›à¹‡à¸™à¸ªà¸²à¹€à¸«à¸•à¸¸à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™ à¹à¸¥à¸°à¹„à¸¡à¹ˆà¸›à¸´à¸”à¹€à¸„à¸ªà¸£à¸§à¸¡</p>
        <div class="review-group-list">${reviewGroups.map((group, index) => `<article class="review-group"><div><b>${h(group.first.company)} Â· ${h(group.first.date)}</b><p>${h(group.first.account)} Â· ${h(group.first.direction)}</p><p>${h(group.first.typeName)} Â· ${h(statusMeta(group.first.status).name)}</p><small>${num(group.ids.length)} à¹€à¸„à¸ª Â· à¹€à¸à¸´à¸™ SLA ${num(group.overdue)} à¹€à¸„à¸ª</small></div><button class="primary-button sm" data-review-group="${index}">à¸•à¸£à¸§à¸ˆà¸à¸¥à¸¸à¹ˆà¸¡à¸™à¸µà¹‰ â†’</button></article>`).join("") || "à¹„à¸¡à¹ˆà¸žà¸šà¹€à¸„à¸ªà¸•à¸²à¸¡à¸•à¸±à¸§à¸à¸£à¸­à¸‡"}</div>
      </details>
      <div class="table-wrap ${state.exceptionView === "sheet" ? "reconciliation-sheet-wrap" : ""}">
        ${state.exceptionView === "sheet" ? `<table class="rows reconciliation-sheet">
          <thead><tr><th rowspan="2">à¸ªà¸–à¸²à¸™à¸°</th><th rowspan="2">à¸§à¸±à¸™à¸—à¸µà¹ˆ</th><th rowspan="2">à¸šà¸£à¸´à¸©à¸±à¸—</th><th rowspan="2">à¸šà¸±à¸à¸Šà¸µ / Provider</th><th colspan="2" class="sheet-group bo">à¸à¸±à¹ˆà¸‡ BO / à¸£à¸°à¸šà¸š (à¸•à¸±à¹‰à¸‡à¸•à¹‰à¸™)</th><th colspan="2" class="sheet-group stm">à¸à¸±à¹ˆà¸‡ STM / à¸˜à¸™à¸²à¸„à¸²à¸£</th><th rowspan="2" class="right">à¸•à¹ˆà¸²à¸‡à¹€à¸§à¸¥à¸²</th><th rowspan="2" class="right">à¸•à¹ˆà¸²à¸‡à¸¢à¸­à¸”</th><th rowspan="2">à¸œà¸¥à¸à¸²à¸£à¸ˆà¸±à¸šà¸„à¸¹à¹ˆ</th><th rowspan="2">à¸„à¸³à¸Šà¸µà¹‰à¹à¸ˆà¸‡ / à¸«à¸¡à¸²à¸¢à¹€à¸«à¸•à¸¸</th><th rowspan="2">à¸—à¸³à¸£à¸²à¸¢à¸à¸²à¸£</th></tr><tr><th>à¸§à¸±à¸™à¸—à¸µà¹ˆ / à¹€à¸§à¸¥à¸²</th><th class="right">à¸¢à¸­à¸”</th><th>à¸§à¸±à¸™à¸—à¸µà¹ˆ / à¹€à¸§à¸¥à¸²</th><th class="right">à¸¢à¸­à¸”</th></tr></thead><tbody>${auditSheetRows}</tbody>
        </table>` : `<table class="rows"><thead><tr>${th("id", "à¹€à¸„à¸ª")}${th("time", "à¹€à¸§à¸¥à¸²")}<th>à¸šà¸±à¸à¸Šà¸µ</th>${th("typeName", "à¸›à¸£à¸°à¹€à¸ à¸—")}<th class="right">à¸¢à¸­à¸” BO</th><th class="right">à¸¢à¸­à¸” STM</th>${th("riskAmount", "à¸œà¸¥à¸•à¹ˆà¸²à¸‡ / à¸¢à¸­à¸”à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸•à¸£à¸§à¸ˆ")}${th("severity", "à¸£à¸°à¸”à¸±à¸š")}<th>à¸œà¸¹à¹‰à¹€à¸à¸µà¹ˆà¸¢à¸§à¸‚à¹‰à¸­à¸‡</th>${th("status", "à¸ªà¸–à¸²à¸™à¸°")}<th class="center">à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£</th></tr></thead><tbody>${caseQueueRows}</tbody></table>`}
      </div>

      <div class="pager">
        ${state.dataset === "production" ? `<button class="ghost-button sm" id="loadMoreCases" ${moreCaseState.loading || liveOverviewState.auxiliaryLoading || !liveOverviewState.exceptionsReady || !moreCaseState.hasMore ? "disabled" : ""}>${moreCaseState.loading ? "à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”â€¦" : moreCaseState.hasMore ? "à¹‚à¸«à¸¥à¸”à¹€à¸„à¸ªà¸–à¸±à¸”à¹„à¸›à¸­à¸µà¸ 250" : "à¹‚à¸«à¸¥à¸”à¸„à¸£à¸šà¹ƒà¸™à¸‚à¸­à¸šà¹€à¸‚à¸•à¸™à¸µà¹‰à¹à¸¥à¹‰à¸§"}</button><span role="status">${h(moreCaseState.error)}</span>` : ""}
        <button class="ghost-button sm" id="pgPrev" ${state.page === 1 ? "disabled" : ""}>à¸à¹ˆà¸­à¸™à¸«à¸™à¹‰à¸²</button>
        <span>à¸«à¸™à¹‰à¸² ${state.page} / ${pages}</span>
        <button class="ghost-button sm" id="pgNext" ${state.page === pages ? "disabled" : ""}>à¸–à¸±à¸”à¹„à¸›</button>
        <span class="grow"></span>
        <button class="ghost-button sm" id="exExport">Export à¸£à¸²à¸¢à¸à¸²à¸£à¸™à¸µà¹‰</button>
      </div>
    </section>`;

  const rerender = () => {
    state.page = 1;
    render();
  };
  $('#loadMoreCases')?.addEventListener('click', loadMoreCases);
  if(state.dataset==='production'&&['monitor','audit_assistant','lead','admin'].includes(state.role)){
    const historyHost=document.createElement('section');historyHost.className='panel';historyHost.id='overviewClosureHistory';root.prepend(historyHost);CaseClosure.mountQueue(historyHost);
  }
  root.querySelectorAll('[data-review-sheet]').forEach((button) => button.addEventListener('click', () => {
    state.reviewSheet = button.dataset.reviewSheet;
    state.exFilter.status = state.reviewSheet === "normal" ? "ACTION" : "ALL";
    reviewQueueIds = [];
    rerender();
  }));
  $('#reviewChangeCompany')?.addEventListener('click', () => {
    state.filters.company = "ALL";
    reviewQueueIds = [];
    rerender();
  });
  root.querySelectorAll('[data-review-direction]').forEach((button) => button.addEventListener('click', () => {
    state.filters.direction = button.dataset.reviewDirection;
    reviewQueueIds = [];
    rerender();
  }));
  root.querySelectorAll('[data-review-status]').forEach((button) => button.addEventListener('click', () => {
    state.exFilter.status = button.dataset.reviewStatus;
    rerender();
  }));
  $('#reviewStart')?.addEventListener('click', () => {
    reviewQueueIds = sorted.map((row) => row.id);
    openException(reviewQueueIds[0]);
  });
  root.querySelectorAll('[data-review-group]').forEach((button) => button.addEventListener('click', () => {
    const group = reviewGroups[Number(button.dataset.reviewGroup)];
    if (!group) return;
    reviewQueueIds = [...group.ids];
    openException(reviewQueueIds[0]);
  }));
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
  $("#exExport").addEventListener("click", () => exportSheets("à¸£à¸²à¸¢à¸à¸²à¸£à¸œà¸´à¸”à¸›à¸à¸•à¸´", buildReviewExportSheets()));
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
  return `data-storage-open="${h(file.storage_path || "")}" data-file-id="${h(file.id || "")}" data-file-name="${h(file.file_name || "à¹„à¸Ÿà¸¥à¹Œà¸•à¹‰à¸™à¸‰à¸šà¸±à¸š")}" data-file-mime="${h(file.mime_type || "")}" data-file-size="${h(file.size_bytes || "")}" data-file-kind="${h(file.kind || "")}" data-file-company="${h(file.company || e.company || "")}" data-file-date="${h(e.date || "")}" data-file-status="${file.parse_error ? "error" : file.parsed ? "parsed" : "waiting"}"`;
}

function exceptionFilesMarkup(files, e) {
  if (!files.length) return `<div class="case-files-empty"><b>à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸šà¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸œà¸¹à¸à¸à¸±à¸šà¸œà¸¥à¸£à¸±à¸™à¸™à¸µà¹‰</b><span>à¹ƒà¸Šà¹‰à¸›à¸¸à¹ˆà¸¡ â€œà¸”à¸¹à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸°à¸ªà¸–à¸²à¸™à¸°à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”â€ à¹€à¸žà¸·à¹ˆà¸­à¸•à¸£à¸§à¸ˆà¹„à¸Ÿà¸¥à¹Œà¸‚à¸­à¸‡à¸šà¸£à¸´à¸©à¸±à¸—à¹à¸¥à¸°à¸§à¸±à¸™à¸—à¸µà¹ˆà¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™</span><button class="ghost-button sm" id="caseGoAllFiles">à¸”à¸¹à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸°à¸ªà¸–à¸²à¸™à¸°à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”</button></div>`;
  return `<div class="case-file-list">${files.map((file) => {
    const extension = String(file.file_name || "FILE").split(".").pop().toUpperCase().slice(0, 4);
    const status = file.parsed ? "à¸­à¹ˆà¸²à¸™à¸ªà¸³à¹€à¸£à¹‡à¸ˆ" : file.parse_error ? statementReviewLabel(file) : "à¸£à¸­à¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥";
    const tone = file.parsed ? "ok" : file.parse_error ? "bad" : "wait";
    return `<button type="button" class="case-file-row" ${exceptionFileAttrs(file, e)} ${file.storage_path ? "" : "disabled"}><span class="case-file-icon">${h(extension)}</span><span class="case-file-main"><b title="${h(file.file_name)}">${h(file.file_name)}</b><small>${h(LIVE_KIND_LABEL[file.kind] || file.kind || "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸—à¸£à¸²à¸šà¸›à¸£à¸°à¹€à¸ à¸—")}</small></span><span class="case-file-state ${tone}">${status}</span><span class="case-file-open">à¸”à¸¹à¹„à¸Ÿà¸¥à¹Œ â†’</span></button>`;
  }).join("")}</div>`;
}

function exceptionSourceFileIds(e) {
  const rows=e?.customerDetails?.source_rows;
  if(!rows||typeof rows!=='object')return [];
  return [...new Set(Object.values(rows).flatMap(row=>row&&typeof row==='object'?[row.fileId,row.sourceFileId]:[]).filter(Boolean))];
}

async function loadExceptionSupport(e, options = {}) {
  const host = $("#caseSourceFiles");
  if (!host || state.dataset !== "production" || !Sb.signedIn()) return;
  const sourceFileIds=exceptionSourceFileIds(e);
  const cacheKey = `${e.runId || ""}|${e.clarificationFileId || ""}|${sourceFileIds.sort().join(',')}`;
  try {
    const detailPromise = e._detailLoaded || !e.dbId ? Promise.resolve(null) : Sb.exceptionDetail(e.dbId);
    const filesPromise = exceptionSupportCache.has(cacheKey)
      ? Promise.resolve(exceptionSupportCache.get(cacheKey))
      : (sourceFileIds.length
        ? Sb.exceptionFiles(e.runId, e.clarificationFileId, sourceFileIds)
        : Sb.exceptionFiles(e.runId, e.clarificationFileId))
        .then((files) => (exceptionSupportCache.set(cacheKey, files || []), files || []));
    const evidencePromise = e._caseEvidenceLoaded ? Promise.resolve(null) : Sb.caseEvidence(e.dbId);
    const [detail, files, storedEvidence] = await Promise.all([detailPromise, filesPromise, evidencePromise]);
    if (storedEvidence) {
      e.evidence = storedEvidence.map(f => ({ id: f.id, name: f.file_name, size: f.size_bytes, at: f.created_at, storagePath: f.storage_path, correctionReason:f.correction_reason, replacesEvidenceId:f.replaces_evidence_id, replacesSourceFileId:f.replaces_source_file_id, uploadedBy:f.uploaded_by, replacedBy:storedEvidence.find(next=>next.replaces_evidence_id===f.id)?.id }));
      e._caseEvidenceLoaded = true;
    }
    if (detail) {
      const notes = e.notes || [];
      const evidence = e.evidence || [];
      // Preserve the drawer/queue key; dbId remains the database UUID.
      Object.assign(e, mapLiveException(detail), { id: e.id, notes, evidence, _detailLoaded: true });
      e.hasEvidence = e.hasEvidence || evidence.some(f => f.storagePath);
      const stm = $("#caseRawStm");
      const bo = $("#caseRawBo");
      if (stm) stm.textContent = e.stmRaw || "â€” à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸à¸±à¹ˆà¸‡ STM â€”";
      if (bo) bo.textContent = e.boRaw || "â€” à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸à¸±à¹ˆà¸‡ BO â€”";
      // Recompute the closure checklist after loading actual transaction evidence.
      if (state.selected === e.id && document.body.contains(host)) {
        openException(e.id, options);
        return;
      }
    }
    if (!document.body.contains(host)) return;
    if (storedEvidence && !detail && state.selected === e.id) {
      e.hasEvidence = !!e.clarificationFileId || e.evidence.some(f => f.storagePath);
      openException(e.id, options);
      return;
    }
    host.className = 'case-files-ready';
    host.innerHTML = exceptionFilesMarkup(files, e);
    const selectedFile=files.find(f=>f.id===e.clarificationFileId);
    e._clarificationFileName=selectedFile?.file_name||'';
    if(selectedFile){
      const summary=document.createElement('section');summary.className='case-selected-evidence';
      summary.innerHTML=`<b>à¹€à¸­à¸à¸ªà¸²à¸£à¸—à¸µà¹ˆà¸œà¸¹à¸à¸à¸±à¸šà¹€à¸„à¸ªà¸™à¸µà¹‰</b><p>${h(selectedFile.file_name)}</p><p>${h(e.responseText || e.resolutionNote || 'à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸—à¸µà¹ˆà¸šà¸±à¸™à¸—à¸¶à¸à¹„à¸§à¹‰')}</p><button class="ghost-button sm" ${exceptionFileAttrs(selectedFile,e)}>à¹€à¸›à¸´à¸”à¹€à¸­à¸à¸ªà¸²à¸£à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸</button><small>à¹€à¸­à¸à¸ªà¸²à¸£à¹€à¸”à¸´à¸¡à¸¢à¸±à¸‡à¸­à¸¢à¸¹à¹ˆà¸„à¸£à¸š Â· à¸­à¹ˆà¸²à¸™à¸ªà¸²à¹€à¸«à¸•à¸¸à¹à¸¥à¸°à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¹€à¸”à¸´à¸¡à¹ƒà¸™à¸ªà¹ˆà¸§à¸™à¸„à¸³à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸”à¹‰à¸²à¸™à¸¥à¹ˆà¸²à¸‡ Â· à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸à¸²à¸£à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¸›à¸´à¸”à¹€à¸„à¸ª</small>`;
      host.prepend(summary);
    }
    const mailButton=document.createElement('button');
    mailButton.id='caseMailEvidenceButton';mailButton.className='primary-button case-mail-open'; mailButton.textContent='à¹€à¸¥à¸·à¸­à¸à¹€à¸­à¸à¸ªà¸²à¸£à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¹ƒà¸«à¹‰à¹€à¸„à¸ªà¸™à¸µà¹‰';
    const evidenceRange=document.createElement('div');
    evidenceRange.className='case-evidence-range';
    const headFilePicker=['lead','admin'].includes(state.role);
    const fileCompanies=headFilePicker?companyMaster():companyMaster().filter(c=>c.code===e.company);
    evidenceRange.innerHTML=`<label>à¸šà¸£à¸´à¸©à¸±à¸—à¹€à¸ˆà¹‰à¸²à¸‚à¸­à¸‡à¹„à¸Ÿà¸¥à¹Œ <select aria-label="à¸šà¸£à¸´à¸©à¸±à¸—à¹€à¸ˆà¹‰à¸²à¸‚à¸­à¸‡à¹„à¸Ÿà¸¥à¹Œ">${fileCompanies.map(c=>`<option value="${h(c.code)}" ${c.code===e.company?'selected':''}>${h(c.code)}</option>`).join('')}</select></label><label>à¹€à¸­à¸à¸ªà¸²à¸£à¸•à¸±à¹‰à¸‡à¹à¸•à¹ˆ <input type="date" aria-label="à¹€à¸­à¸à¸ªà¸²à¸£à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸•à¸±à¹‰à¸‡à¹à¸•à¹ˆ" value="${h(e.date.slice(0,7)+'-01')}"></label><label>à¸–à¸¶à¸‡ <input type="date" aria-label="à¹€à¸­à¸à¸ªà¸²à¸£à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸–à¸¶à¸‡" value="${h(e.date>bangkokDate()?e.date:bangkokDate())}"></label>`;
    host.append(evidenceRange,mailButton);
    mailButton.onclick=async()=>{
      mailButton.disabled=true;
      try {
        const [from,to]=[...evidenceRange.querySelectorAll('input')].map(input=>input.value);
        const fileCompany=evidenceRange.querySelector('select').value;
        if(!canAccessCompany(fileCompany)||(!headFilePicker&&fileCompany!==e.company))throw new Error('à¹„à¸¡à¹ˆà¸¡à¸µà¸ªà¸´à¸—à¸˜à¸´à¹Œà¹€à¸¥à¸·à¸­à¸à¸šà¸£à¸´à¸©à¸±à¸—à¹€à¸ˆà¹‰à¸²à¸‚à¸­à¸‡à¹„à¸Ÿà¸¥à¹Œà¸™à¸µà¹‰');
        if(!from||!to||from>to)throw new Error('à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸à¸Šà¹ˆà¸§à¸‡à¸§à¸±à¸™à¸—à¸µà¹ˆà¹€à¸­à¸à¸ªà¸²à¸£à¹ƒà¸«à¹‰à¸–à¸¹à¸à¸•à¹‰à¸­à¸‡');
        const [candidateFiles,amountRecommendations]=await Promise.all([
          Sb.evidenceFiles({from,to,company:fileCompany,includeSourceFiles:headFilePicker}),
          Sb.evidenceRecommendations({from,to,company:fileCompany,limit:2000}),
        ]);
        const candidates=candidateFiles.filter(f=>(f.company||f.batch_company)===fileCompany);
        const amountsByFile=new Map();
        const rememberAmount=(fileId,value)=>{
          const amount=Number(value);if(!fileId||!Number.isFinite(amount)||amount<=0)return;
          const values=amountsByFile.get(fileId)||[];
          if(!values.includes(amount))values.push(amount);
          amountsByFile.set(fileId,values);
        };
        for(const recommendation of amountRecommendations||[])rememberAmount(recommendation.source_file_id,recommendation.amount);
        // Only exact, current-case recommendation links; never browse every company's evidence.
        const linked=await Sb.evidenceCaseRecommendations({caseId:e.dbId});
        const recommended=new Map();
        for(const link of linked){
          const r=link.evidence_recommendations, c=link.exceptions;
          if(link.exception_id!==e.dbId || c?.run_id!==e.runId || c?.company!==e.company || c?.business_date!==e.date
            || r?.status!=='pending_audit' || r.business_date!==e.date
            || ![r.company,r.payer_company].includes(e.company)
            || !canAccessCompany(r.company) || !canAccessCompany(r.payer_company))continue;
          const extra=await Sb.exceptionFiles(null,r.source_file_id);
          for(const f of extra){
            if(f.id!==r.source_file_id || f.kind!=='doc_clarify')continue;
            if(!candidates.some(x=>x.id===f.id))candidates.push(f);
            recommended.set(f.id,r.id);
            rememberAmount(f.id,r.amount);
          }
        }
        const list=document.createElement('section');list.className='case-mail-evidence';
        list.innerHTML=`<h4>à¹€à¸­à¸à¸ªà¸²à¸£à¸Šà¸µà¹‰à¹à¸ˆà¸‡ Â· ${h(e.company)} Â· ${h(e.date)}</h4><p>à¹€à¸¥à¸·à¸­à¸à¹„à¸Ÿà¸¥à¹Œà¸­à¹‰à¸²à¸‡à¸­à¸´à¸‡à¹€à¸žà¸·à¹ˆà¸­à¸œà¸¹à¸à¸à¸±à¸šà¹€à¸„à¸ªà¸™à¸µà¹‰ à¸£à¸°à¸šà¸šà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸›à¸´à¸”à¹€à¸„à¸ªà¹à¸¥à¸°à¹„à¸¡à¹ˆà¸ªà¹ˆà¸‡à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸­à¸­à¸</p>${candidates.length?'':'<p>à¹„à¸¡à¹ˆà¸žà¸šà¹€à¸­à¸à¸ªà¸²à¸£à¹ƒà¸™à¸Šà¹ˆà¸§à¸‡à¸™à¸µà¹‰ à¸¥à¸­à¸‡à¸‚à¸¢à¸²à¸¢à¸Šà¹ˆà¸§à¸‡à¸§à¸±à¸™à¸—à¸µà¹ˆ à¸«à¸£à¸·à¸­à¹à¸™à¸šà¸«à¸¥à¸±à¸à¸à¸²à¸™à¹€à¸žà¸´à¹ˆà¸¡</p>'}${candidates.map(f=>{const amountLabels=(amountsByFile.get(f.id)||[]).map(evidenceAmountLabel).filter(Boolean);const searchKey=normalizeEvidenceSearch([f.file_name,f.subject||f.mail_batches?.subject,f.sender||f.mail_batches?.sender,...amountLabels].filter(Boolean).join(' '));return `<article data-evidence-search="${h(searchKey)}"><div class="case-mail-file"><b>${h(f.file_name)}</b><p>${h(f.subject||f.mail_batches?.subject||'à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸«à¸±à¸§à¸‚à¹‰à¸­')}<br>${h(f.sender||f.mail_batches?.sender||'à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸œà¸¹à¹‰à¸ªà¹ˆà¸‡')} Â· ${h(displayTime(f.mail_batches?.received_at))}${amountLabels.length?`<br>${amountLabels.map(label=>`<span class="badge blue">${h(label)}</span>`).join(' ')}`:''}</p></div><div class="case-mail-actions"><button class="ghost-button sm" ${exceptionFileAttrs(f,e)}>à¸”à¸¹à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡</button><button class="primary-button sm" data-link-mail="${h(f.id)}">à¹€à¸¥à¸·à¸­à¸à¹€à¸­à¸à¸ªà¸²à¸£à¸™à¸µà¹‰</button></div></article>`;}).join('')}`;
        host.querySelector('.case-mail-evidence')?.remove();
        mailButton.after(list);bindStoredFileLinks(list);
        list.querySelector('h4').textContent=`à¹„à¸Ÿà¸¥à¹Œà¸‚à¸­à¸‡ ${fileCompany} Â· ${from} à¸–à¸¶à¸‡ ${to} (${candidates.length} à¹„à¸Ÿà¸¥à¹Œ) â†’ à¹€à¸„à¸ª ${caseLabel(e)}`;
        list.querySelector('p').textContent=state.role==='shift_lead'?'à¹€à¸¥à¸·à¸­à¸à¹„à¸Ÿà¸¥à¹Œà¹„à¸§à¹‰à¸à¹ˆà¸­à¸™à¹„à¸”à¹‰à¹‚à¸”à¸¢à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¸à¸£à¸­à¸à¹€à¸«à¸•à¸¸à¸œà¸¥à¸•à¸£à¸‡à¸™à¸µà¹‰ Â· à¸ˆà¸²à¸à¸™à¸±à¹‰à¸™à¸à¸£à¸­à¸à¸ªà¸²à¹€à¸«à¸•à¸¸à¹à¸¥à¸°à¸à¸”à¸ªà¹ˆà¸‡à¸„à¸³à¸Šà¸µà¹‰à¹à¸ˆà¸‡à¸žà¸£à¹‰à¸­à¸¡à¸«à¸¥à¸±à¸à¸à¸²à¸™à¹ƒà¸™à¸‚à¸±à¹‰à¸™à¸•à¸­à¸™à¸–à¸±à¸”à¹„à¸›':'à¹à¸à¹‰à¸Šà¹ˆà¸§à¸‡à¸§à¸±à¸™à¸—à¸µà¹ˆà¸”à¹‰à¸²à¸™à¸šà¸™à¹à¸¥à¹‰à¸§à¸à¸”à¸„à¹‰à¸™à¸«à¸²à¹ƒà¸«à¸¡à¹ˆà¹„à¸”à¹‰ Â· à¸„à¹‰à¸™à¸«à¸²à¸Šà¸·à¹ˆà¸­à¹„à¸Ÿà¸¥à¹Œ à¸«à¸±à¸§à¸‚à¹‰à¸­à¹€à¸¡à¸¥ à¸œà¸¹à¹‰à¸ªà¹ˆà¸‡ à¸«à¸£à¸·à¸­à¸¢à¸­à¸”à¹€à¸‡à¸´à¸™à¹„à¸”à¹‰ à¹€à¸­à¸à¸ªà¸²à¸£à¹€à¸”à¸µà¸¢à¸§à¹ƒà¸Šà¹‰à¸›à¸£à¸°à¸à¸­à¸šà¸«à¸¥à¸²à¸¢à¹€à¸„à¸ªà¹„à¸”à¹‰ à¹à¸•à¹ˆà¸•à¹‰à¸­à¸‡à¸£à¸°à¸šà¸¸à¹€à¸«à¸•à¸¸à¸œà¸¥à¸•à¹ˆà¸­à¹€à¸„à¸ª';
        if(candidates.length>=2000){const limitNote=document.createElement('p');limitNote.textContent='à¹à¸ªà¸”à¸‡à¹„à¸”à¹‰à¸ªà¸¹à¸‡à¸ªà¸¸à¸” 2,000 à¹„à¸Ÿà¸¥à¹Œà¸•à¹ˆà¸­à¸Šà¹ˆà¸§à¸‡ à¸à¸£à¸¸à¸“à¸²à¸¥à¸”à¸Šà¹ˆà¸§à¸‡à¸§à¸±à¸™à¸—à¸µà¹ˆà¹€à¸žà¸·à¹ˆà¸­à¸„à¹‰à¸™à¸«à¸²à¹ƒà¸«à¹‰à¸„à¸£à¸š';list.prepend(limitNote);}
        const search=document.createElement('input');search.type='search';search.placeholder='à¸„à¹‰à¸™à¸«à¸²à¸Šà¸·à¹ˆà¸­à¹„à¸Ÿà¸¥à¹Œ / à¸«à¸±à¸§à¸‚à¹‰à¸­à¹€à¸¡à¸¥ / à¸œà¸¹à¹‰à¸ªà¹ˆà¸‡ / à¸¢à¸­à¸”à¹€à¸‡à¸´à¸™';search.setAttribute('aria-label','à¸„à¹‰à¸™à¸«à¸²à¹€à¸­à¸à¸ªà¸²à¸£à¸Šà¸µà¹‰à¹à¸ˆà¸‡ à¸£à¸§à¸¡à¸¢à¸­à¸”à¹€à¸‡à¸´à¸™');list.querySelector('h4').after(search);
        search.oninput=()=>{const q=normalizeEvidenceSearch(search.value);list.querySelectorAll('article').forEach(article=>{article.hidden=!!q&&!String(article.dataset.evidenceSearch||normalizeEvidenceSearch(article.textContent)).includes(q);});};
        list.querySelectorAll('[data-link-mail]').forEach(button=>{if(button.dataset.linkMail===e.clarificationFileId){button.textContent=state.role==='shift_lead'?'à¹€à¸¥à¸·à¸­à¸à¹„à¸Ÿà¸¥à¹Œà¹€à¸”à¸´à¸¡à¸™à¸µà¹‰ (à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸ªà¹ˆà¸Û­|ñ¼­zÊ&ŠÛ^u…¹•ÍÍ½µÁ…¹ä¡”¹½µÁ…¹ä¤ì(€ÍÑ…Ñ”¹Í•±•Ñ•€ô¥ì(€Ñ¥­•Ð¹ÁÉ½µ¥Í”ô¡…Íå¹Œ ¤ôùì(€¥˜€¡ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€‰ÁÉ½‘ÕÑ¥½¸ˆ€˜˜”¹‘‰%¤ì(€€€Í¡½Ý…Í•=Á•¹1½…‘¥¹œ¡”¤ì(€€€ÑÉäì(€€€€€½¹ÍÐÉ•ÍÕ±ÑÌõ…Ý…¥Ð±½…‘…Í•=Á•¹M¹…ÁÍ¡½Ð¡”¤ì(€€€€€¥˜ …ÕÉÉ•¹Ð ¤¥É•ÑÕÉ¸ì(€€€€€…ÁÁ±å…Í•=Á•¹M¹…ÁÍ¡½Ð¡”±É•ÍÕ±ÑÌ¤ì(€€€€€ÑÉäì…Ý…¥ÐÉ•™É•Í¡EÕ¥­±½Í•Ù¥‘•¹”¡”¤ìô(€€€€€…Ñ ¡•ÉÈ¥í”¹}ÅÕ¥­M½ÕÉ•Ù¥‘•¹”õ™…±Í”íÑ½…ÍÐ Ÿ‚â‹‚âÇ‚â‚âW‚â‚âŸ‚â#‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚âo‚âÓ‚âS‚âS‚æ#‚âŸ‚âg‚æ‚â‡‚æ#‚â‚â‚âhè€œ­•ÉÈ¹µ•ÍÍ…”°Ý…É¸œ¤íô(€€€€€¥˜ …ÕÉÉ•¹Ð ¤¥É•ÑÕÉ¸ì(€€€õ…Ñ ¡•ÉÈ¥í¥˜¡ÕÉÉ•¹Ð ¤¥í…Í•=Á•¹Q¥­•Ðõ¹Õ±°íÍ¡½Ý…Í•=Á•¹1½…‘¥¹œ¡”±•ÉÈ¹µ•ÍÍ…”¤íõÉ•ÑÕÉ¸íô(€ô(€¥˜ …ÕÉÉ•¹Ð ¤¥É•ÑÕÉ¸ì(€½¹ÍÐÅÕ•Õ”€ôÉ•Ù¥•ÝEÕ•Õ•%‘Ì¹™¥±Ñ•È ¡­•ä¤€ôø¹•á•ÁÑ¥½¹Ì¹Í½µ” ¡É½Ü¤€ôøÉ½Ü¹¥€ôôô­•ä€˜˜…¹•ÍÍ½µÁ…¹ä¡É½Ü¹½µÁ…¹ä¤¤¤ì(€½¹ÍÐÅÕ•Õ•%¹‘•à€ôÅÕ•Õ”¹¥¹‘•á=˜¡¥¤ì(€ÍÑ…Ñ”¹Í•±•Ñ•€ô¥ì(€½¹ÍÐ‘É…Ý•È€ô€ ˆ‘É…Ý•Èˆ¤ì(€½¹ÍÐ½Ù•É±…ä€ô€ ˆ‘É…Ý•É=Ù•É±…äˆ¤ì(€½¹ÍÐ±½Í•€ôl‰±½Í•ˆ°€‰…ÁÁÉ½Ù•‰t¹¥¹±Õ‘•Ì¡”¹ÍÑ…ÑÕÌ¤ì(€½¹ÍÐÍ½ÕÉ•Ù¥‘•¹”€ô€„…”¹}ÅÕ¥­M½ÕÉ•Ù¥‘•¹”ì(€½¹ÍÐ…µ½Õ¹Ñ=ÕÑ½µ•I•½É‘•€ô¡…ÍI•½É‘•‘µ½Õ¹Ñ=ÕÑ½µ”¡”¤ì(€½¹ÍÐ¡•­±¥ÍÐ€ôl(€€€ì­•äè€‰É…Üˆ°±…‰•°è€‹‚æ‚â¯‚â—‚âS‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âS‚æ‚â‚â«‚æ‚â—‚âÃ‚â‚æ'‚â·‚â‡‚âç‚â—‚âW‚æ'‚âg‚â_‚âË‚â‚â_‚â×‚æ#‚â‡‚â×‚â·‚â‹‚âç‚æ#‚æ‚â—‚æ'‚âœˆ°½¬è€„…”¹}‘•Ñ…¥±1½…‘•ñð€„„¡”¹ÍÑµI…Ü€˜˜”¹ÍÑµI…Ü€„ôô€‹ŠPˆ¤ñð€„„¡”¹‰½I…Ü€˜˜”¹‰½I…Ü€„ôô€‹ŠPˆ¤ô°(€€€ì­•äè€‰…ÕÍ”ˆ°±…‰•°è€‹‚â‚âÃ‚âk‚âã‚â«‚âË‚æ‚â¯‚âW‚âã‚æ‚â—‚æ'‚âœˆ°½¬è€„…”¹…ÕÍ”€˜˜”¹…ÕÍ”€„ôô€‹‚â‚â·‚âW‚â‚âŸ‚â#‚â«‚â·‚âk‚â«‚âË‚æ‚â¯‚âW‚âàˆô°(€€€ì­•äè€‰½Ý¹•Èˆ°±…‰•°è€‹‚â‚âÃ‚âk‚âã‚âs‚âç‚æ'‚â‚âÇ‚âk‚âs‚âÓ‚âS‚â+‚â·‚âk‚æ‚â—‚æ'‚âœˆ°½¬è€„…”¹•µÁ±½å•”€˜˜”¹•µÁ±½å•”€„ôô€‹‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âàˆô°(€€€ì­•äè€‰•Ù¥‘•¹”ˆ°±…‰•°èÍ½ÕÉ•Ù¥‘•¹”€ü€‹‚æ‚â+‚æ'‚â¯‚â—‚âÇ‚â‚âC‚âË‚âd	<½A4ƒ‚âW‚æ'‚âg‚â_‚âË‚âƒŠPƒ‚â‚âç‚æ#‚âW‚â‚âƒ‚æ‚â‡‚æ#‚â/‚æ'‚âÌƒ‚â‹‚â·‚â‡‚â‚âÇ‚âk‚æ‚âŸ‚â—‚âË‚âW‚æ#‚âË‚â‚â¯‚â‚âß‚â·‚â‚æ'‚âË‚â‡‚âŸ‚âÇ‚âdˆ€è€‹‚æ‚âg‚âk‚â¯‚â—‚âÇ‚â‚âC‚âË‚âd€¼ƒ‚æ‚â‚â—‚æ3‚â+‚â×‚æ'‚æ‚â#‚âˆ°½¬è”¹¡…ÍÙ¥‘•¹”ñðÍ½ÕÉ•Ù¥‘•¹”ô°(€€€ì­•äè€‰¹½Ñ”ˆ°±…‰•°èÍ½ÕÉ•Ù¥‘•¹”€˜˜€…±½Í•€ü€‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚âs‚âç‚æ'‚â‹‚âß‚âg‚â‹‚âÇ‚âdƒ‚æ‚âŸ‚â—‚âÈƒ‚æ‚â—‚âÃ‚æ‚â¯‚âW‚âã‚âs‚â—‚æ‚â‡‚âß‚æ#‚â´Õ‘¥Ðƒ‚â‚âS‚â‹‚âß‚âg‚â‹‚âÇ‚âdˆ€è€‹‚â‡‚âÔ¹½Ñ”ƒ‚â#‚âË‚âÕ‘¥Ðˆ°½¬è”¹¹½Ñ•Ì¹±•¹Ñ €ø€Àñð€„…”¹É•Í½±ÕÑ¥½¹9½Ñ”ñð€¡Í½ÕÉ•Ù¥‘•¹”€˜˜€…±½Í•¤ô°(€€€ì­•äè€‰…µ½Õ¹Ðˆ°±…‰•°è”¹±½ÍÕÉ•I•ÅÕ•ÍÑ%€ü€‹‚â«‚æ#‚â‚âs‚â—‚âW‚â‚âŸ‚â#‚æ‚â—‚æ'‚âœƒŠPƒ‚â‚â·‚â¯‚âÇ‚âŸ‚â¯‚âg‚æ'‚âË‚â‚âÇ‚âk‚â‚â·‚â‚âs‚â—‚â‹‚â·‚âS‚æ‚â—‚âÃ‚âo‚âÓ‚âS‚æ‚â‚â¨ˆ€è”¹ÍÑ…ÑÕÌôôôÁ…¥É}Á•¹‘¥¹œœ€ü€‹‚â‚â·‚â¯‚âÇ‚âŸ‚â¯‚âg‚æ'‚âË‚âW‚â‚âŸ‚â#‚â‚âÏ‚â‚â·‚â#‚âÇ‚âk‚â‚âç‚æ €¼ƒ‚â‹‚â·‚â‡‚â‚âÇ‚âk‚â‹‚â·‚âS‚âW‚æ#‚âË‚âˆ€è…µ½Õ¹Ñ=ÕÑ½µ•I•½É‘•€ü€‹‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âs‚â—‚âW‚â‚âŸ‚â#‚â‹‚â·‚âS‚æ‚â—‚æ'‚âœˆ€è€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âs‚â—‚âW‚â‚âŸ‚â#‚â‹‚â·‚âPƒŠPƒ‚æ‚â—‚âß‚â·‚â‚âs‚â—‚æ‚â—‚âÃ‚âW‚âÓ‚æ+‚â‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚æ‚âg‚â‚âÇ‚æ'‚âg‚âW‚â·‚âg‚â[‚âÇ‚âS‚æ‚âlˆ°½¬è…µ½Õ¹Ñ=ÕÑ½µ•I•½É‘•ô°(€tì(€½¹ÍÐÅÕ¥­±½Í•±¥¥‰±”€ô¥ÍEÕ¥­±½Í•±¥¥‰±”¡”¤€˜˜…¸ ‰…ÁÁÉ½Ù”ˆ¤ì(€½¹ÍÐÉ•Ù¥•ÝAÉ•É•ÅÕ¥Í¥Ñ•Ì€ô¡•­±¥ÍÐ¹™¥±Ñ•È ¡¥Ñ•´¤€ôø¥Ñ•´¹­•ä€„ôô€‰…µ½Õ¹Ðˆ¤ì(€½¹ÍÐ±½ÍÕÉ•I•Ù¥•ÝI•…‘ä€ô€…”¹É•Ù¥•Ý!½±€˜˜€…±½Í•€˜˜€…”¹±½ÍÕÉ•I•ÅÕ•ÍÑ%€˜˜”¹ÍÑ…ÑÕÌ„ôôÁ…¥É}Á•¹‘¥¹œœ(€€€€˜˜É•Ù¥•ÝAÉ•É•ÅÕ¥Í¥Ñ•Ì¹•Ù•Éä ¡¥Ñ•´¤€ôø¥Ñ•´¹½¬¤€˜˜€¡”¹¡…ÍÙ¥‘•¹”ñðÍ½ÕÉ•Ù¥‘•¹”¤ì(€½¹ÍÐ±½ÍÕÉ•Ñ¥½¹I•…‘ä€ôÅÕ¥­±½Í•±¥¥‰±”ñð±½ÍÕÉ•I•Ù¥•ÝI•…‘äì(€½¹ÍÐµ¥ÍÍ¥¹¡•­Ì€ô±½Í•ñð”¹±½ÍÕÉ•I•ÅÕ•ÍÑ%ñð”¹ÍÑ…ÑÕÌôôôÁ…¥É}Á•¹‘¥¹œœ€ümt€èÉ•Ù¥•ÝAÉ•É•ÅÕ¥Í¥Ñ•Ì¹™¥±Ñ•È ¡¥Ñ•´¤€ôø€…¥Ñ•´¹½¬¤ì(€½¹ÍÐ±…ÍÑU¥I•ÍÕ±Ð€ô…Í•U¥I•ÍÕ±ÑÌ¹•Ð¡…Í•U¥-•ä¡”¤¤ì(€½¹ÍÐÕ¥I•ÍÕ±Ð€ô±…ÍÑU¥I•ÍÕ±Ðü¹ÍÑ…ÑÕÌôôõ”¹ÍÑ…ÑÕÌ€ü±…ÍÑU¥I•ÍÕ±Ð€è¹Õ±°ì((€‘É…Ý•È¹¥¹¹•É!Q50€ô€(€€€€ñ¡•…‘•È±…ÍÌô‰‘É…Ý•Èµ¡•…ˆø(€€€€€€ñ‘¥Øø(€€€€€€€€ñÀ±…ÍÌô‰•å•‰É½Üˆø‘í ¡”¹ÑåÁ•9…µ”¥ôƒ
Ü€‘í ¡”¹½µÁ…¹ä¥ôð½Àø(€€€€€€€€ñ È¥ô‰‘É…Ý•ÉQ¥Ñ±”ˆø‘í ¡…Í•1…‰•°¡”¤¥ô€ñÍÁ…¸±…ÍÌô‰‰…‘”€‘í”¹Í•Ù•É¥Ñåôˆø‘í ¡Í•Ù5•Ñ„¡”¹Í•Ù•É¥Ñä¤¹¹…µ”¥ôð½ÍÁ…¸ø€ñÍÁ…¸±…ÍÌô‰‰…‘”€‘í…Í•MÑ…ÑÕÍ5•Ñ„¡”¤¹Ñ½¹•ôˆø‘í ¡…Í•MÑ…ÑÕÍ5•Ñ„¡”¤¹¹…µ”¥ôð½ÍÁ…¸øð½ Èø(€€€€€€ð½‘¥Øø(€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¥½¸µ‰Ñ¸ˆ¥ô‰‘É…Ý•É±½Í”ˆ…É¥„µ±…‰•°ô‹‚âo‚âÓ‚âPˆûŠrTð½‰ÕÑÑ½¸ø(€€€€ð½¡•…‘•Èø((€€€€ñ‘¥Ø±…ÍÌô‰‘É…Ý•Èµ‰½‘äˆø(€€€€€€‘í…¸ É•ÅÕ•ÍÑ}±…É¥™äœ¤üœñÀøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰…Í•9•áÑEÕ•Õ”ˆû‚âS‚âç‚â‚âÓ‚âŸ‚æ‚â‚â«‚â[‚âÇ‚âS‚æ‚âl€£‚â·‚æ#‚âË‚âg‚â·‚â‹‚æ#‚âË‚â‚æ‚âS‚â×‚â‹‚âœ¤ð½‰ÕÑÑ½¸øð½Àøœèœô(€€€€€€‘í½Õ¹ÑI•Ù¥•Ý!½±‘Ì¹‰…¹¹•È¡”¹É•Ù¥•Ý!½±¥ô(€€€€€€ñÍ•Ñ¥½¸±…ÍÌô‰…Í”µÝ½É¬µÍÑ…ÑÕÌˆ…É¥„µ±…‰•°ô‹‚â«‚â[‚âË‚âg‚âÃ‚æ‚â—‚âÃ‚â¯‚âg‚æ'‚âË‚â_‚â×‚æ#‚â‚â·‚â‚âs‚âç‚æ'‚æ‚â+‚æ'‚â‚âË‚âdˆø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚âs‚â—‚â‚âÃ‚âk‚âhð½ÍÁ…¸øñˆø‘í”¹ÍÑ…ÑÕÌôôô‘…µ…”œ€ü€Ÿ‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚â—‚æ'‚âœƒŠPƒ‚âS‚âç‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚æ‚â—‚âÃ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdœ€è±½Í•€ü€Ÿ‚âS‚âç‚âs‚â—‚æ‚â—‚âÃ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚âW‚æ'‚âg‚â_‚âË‚âœ€è€Ÿ‚â‡‚â×‚â‚æ'‚â·‚âs‚âÓ‚âS‚âo‚â‚âW‚âÓ‚æ‚â¯‚æ'‚âW‚â‚âŸ‚â ƒŠPƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆôð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚â‚âÏ‚â+‚â×‚æ'‚æ‚â#‚âð½ÍÁ…¸øñˆø‘í”¹ÍÑ…ÑÕÌôôô…¹ÍÝ•É•œ€ü€Ÿ‚âW‚â·‚âk‚æ‚â—‚æ'‚âœƒŠPƒ‚â‚â´Õ‘¥Ðƒ‚âW‚â‚âŸ‚â#‚â‚âÏ‚âW‚â·‚âhœ€è”¹ÍÑ…ÑÕÌôôô±…É¥™å¥¹œœ€ü€Ÿ‚â‚â·‚âs‚âç‚æ'‚â‡‚â×‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚âW‚â·‚âk‚â+‚â×‚æ'‚æ‚â#‚âœ€è”¹É•ÍÁ½¹Í•Q•áÐ€ü€Ÿ‚â‡‚â×‚â‚âÏ‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚â¯‚æ'‚âW‚â‚âŸ‚â œ€è”¹±…É¥™¥…Ñ¥½¹¥±•%€ü€Ÿ‚â‡‚â×‚æ‚â·‚â‚â«‚âË‚â‚âs‚âç‚â‚æ‚â—‚æ'‚âœƒŠPƒ‚âW‚æ'‚â·‚â‚â·‚æ#‚âË‚âg‚æ‚â—‚âÃ‚âW‚â‚âŸ‚â œ€è€Ÿ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚â‚âÏ‚â+‚â×‚æ'‚æ‚â#‚âôð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚â‚âË‚â‚âo‚âÓ‚âS‚æ‚â‚â¨ð½ÍÁ…¸øñˆø‘í±½Í•€ü€Ÿ‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âo‚âÓ‚âS‚æ‚â—‚æ'‚âœœ€è€Ÿ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚âo‚âÓ‚âS‚æ‚â‚â¨ôð½ˆøð½‘¥Øø(€€€€€€€€ñÀ±…ÍÌô‰…Í”µÁ•Éµ¥ÍÍ¥½¸µ¡•±Àˆû‚â¯‚âg‚æ'‚âË‚â_‚â×‚æ#‚â‚â·‚â‚â‚âã‚âLè€‘í…¸ ¹½Ñ”œ¤€ü€Ÿ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚âs‚â—‚âW‚â‚âŸ‚â#‚æ‚âS‚æ$œ€è€Ÿ‚âS‚âç‚â‚æ'‚â·‚â‡‚âç‚â—‚æ‚âS‚æ$ôƒ
Ü€‘í…¸ É•ÍÁ½¹œ¤€ü€Ÿ‚âW‚â·‚âk‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚âS‚æ'‚æ‚â‡‚âß‚æ#‚â·‚æ‚â‚â«‚â‚â·‚â+‚â×‚æ'‚æ‚â#‚âœ€è€Ÿ‚â«‚æ#‚â‚âs‚âç‚æ'‚â‡‚â×‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚âW‚â·‚âk‚â‚âÏ‚â+‚â×‚æ'‚æ‚â#‚âôƒ
Ü€‘í…¸ …ÁÁÉ½Ù”œ¤€ü€Ÿ‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âo‚âÓ‚âS‚æ‚âS‚æ'‚æ‚â‡‚âß‚æ#‚â·‚âs‚æ#‚âË‚âg‚æ‚â‚âO‚âG‚æ0œ€è€Ÿ‚âW‚æ'‚â·‚â‚â«‚æ#‚â‚âs‚âç‚æ'‚â‡‚â×‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚âo‚âÓ‚âS‚æ‚â‚â¨ôð½Àø(€€€€€€ð½Í•Ñ¥½¸ø(€€€€€€‘íÕ¥I•ÍÕ±Ð€ü€ñÍ•Ñ¥½¸±…ÍÌô‰…Í”µÍ…Ù”µÉ•ÍÕ±ÐˆÉ½±”ô‰ÍÑ…ÑÕÌˆøñˆø‘í ¡Õ¥I•ÍÕ±Ð¹µ•ÍÍ…”¥ôð½ˆøñÍµ…±°û‚âs‚â—‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚âg‚â‚âË‚â‚æ‚â+‚æ'‚â‚âË‚âg‚â‚â‚âÇ‚æ'‚â‚âg‚â×‚æ$ƒ
Ü€‘í ¡Õ¥I•ÍÕ±Ð¹…Ñ½È¥ôƒ
Ü€‘í ¡‘¥ÍÁ±…åQ¥µ”¡Õ¥I•ÍÕ±Ð¹…Ð¤¥ôð½Íµ…±°øð½Í•Ñ¥½¸ù€€è€œô(€€€€€€‘í±½Í•€ü€ñÀ±…ÍÌô‰…Í”µ±½Í•µ¡¥ÍÑ½Éäˆû‚âo‚âÓ‚âS‚æ‚âS‚âˆ€‘í ¡”¹É•Í½±Ù•‘	äñð€Ÿ‚âS‚âç‚âo‚â‚âÃ‚âŸ‚âÇ‚âW‚âÓ‚âs‚âç‚æ'‚â‹‚âß‚âg‚â‹‚âÇ‚âdœ¥ôƒ
Ü€‘í ¡”¹É•Í½±Ù•‘Ð€ü‘¥ÍÁ±…åQ¥µ”¡”¹É•Í½±Ù•‘Ð¤€è€Ÿ‚âS‚âç‚âo‚â‚âÃ‚âŸ‚âÇ‚âW‚âÓ‚æ‚âŸ‚â—‚âË‚âk‚âÇ‚âg‚â_‚âÛ‚âœ¥ôƒ
Ü€‘í ¡”¹É•Í½±ÕÑ¥½¹9½Ñ”ñð€œœ¥ôð½Àù€€è€œô(€€€€€€‘íÅÕ•Õ•%¹‘•à€øô€À€ü€ñ¹…Ø±…ÍÌô‰É•Ù¥•Üµ…Í”µ¹…Øˆ…É¥„µ±…‰•°ô‹‚æ‚â—‚âß‚æ#‚â·‚âg‚æ‚â‚â«‚æ‚âg‚â‚âÓ‚âœˆøñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰É•Ù¥•ÝAÉ•Ù¥½ÕÌˆ€‘íÅÕ•Õ•%¹‘•à€ôôô€À€ü€‰‘¥Í…‰±•ˆ€è€ˆ‰ôûŠ@ƒ‚æ‚â‚â«‚â‚æ#‚â·‚âg‚â¯‚âg‚æ'‚âÈð½‰ÕÑÑ½¸øñÍÁ…¸û‚æ‚â‚â¨€‘íÅÕ•Õ•%¹‘•à€¬€Åô€¼€‘íÅÕ•Õ”¹±•¹Ñ¡ôñÍµ…±°û‚â‚âË‚â‚æ‚â—‚âß‚æ#‚â·‚âg‚æ‚â‚â«‚æ‚â‡‚æ#‚æ‚â+‚æ#‚â‚âË‚â‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚â¯‚â‚âß‚â·‚âo‚âÓ‚âS‚æ‚â‚â¨ð½Íµ…±°øð½ÍÁ…¸øñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰É•Ù¥•Ý9•áÐˆ€‘íÅÕ•Õ•%¹‘•à€ôôôÅÕ•Õ”¹±•¹Ñ €´€Ä€ü€‰‘¥Í…‰±•ˆ€è€ˆ‰ôû‚æ‚â‚â«‚â[‚âÇ‚âS‚æ‚âlƒŠHð½‰ÕÑÑ½¸øð½¹…Øù€€è€ˆ‰ô(€€€€€€ñ‘¥Ø±…ÍÌô‰…Í”µÉ•Ù¥•Üµ™±½Üˆ…É¥„µ±…‰•°ô‹‚â‚âÇ‚æ'‚âg‚âW‚â·‚âg‚âW‚â‚âŸ‚â#‚æ‚â‚â¨ˆøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘…Ñ„µ…Í”µÍÑ•Àô‰ÍÕµµ…Éäˆøñ¤øÄð½¤øñÍÁ…¸øñˆû‚æ‚â+‚æ‚â‚â‹‚â·‚âS‚æ‚â—‚âÃ‚æ‚âŸ‚â—‚âÈð½ˆøñÍµ…±°û‚âS‚âä	<ƒ‚æ‚â_‚â×‚â‹‚âhMQ4ð½Íµ…±°øð½ÍÁ…¸øð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘…Ñ„µ…Í”µÍÑ•Àô‰™¥±•Ìˆøñ¤øÈð½¤øñÍÁ…¸øñˆû‚æ‚âo‚âÓ‚âS‚æ‚â‚â—‚æ3‚âo‚â‚âÃ‚â‚â·‚âhð½ˆøñÍµ…±°ùAÉ•Ù¥•Üƒ‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚æ‚â+‚æ'‚â‚âÇ‚âdð½Íµ…±°øð½ÍÁ…¸øð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘…Ñ„µ…Í”µÍÑ•Àô‰…Ñ¥½¸ˆøñ¤øÌð½¤øñÍÁ…¸øñˆû‚æ‚â—‚âß‚â·‚â‚âs‚â—‚âS‚âÏ‚æ‚âg‚âÓ‚âg‚â‚âË‚âŒð½ˆøñÍµ…±°û‚â+‚â×‚æ'‚æ‚â#‚â€¼ƒ‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆ€¼ƒ‚âo‚âÓ‚âS‚æ‚â‚â¨ð½Íµ…±°øð½ÍÁ…¸øð½‰ÕÑÑ½¸øð½‘¥Øø(€€€€€€ñÍ•Ñ¥½¸±…ÍÌô‰±…É¥™¥…Ñ¥½¸µ¥¹ÍÑÉÕÑ¥½¹Ìˆ…É¥„µ±…‰•°ô‹‚â«‚âÓ‚æ#‚â‚â_‚â×‚æ Õ‘¥Ðƒ‚â‚â·‚æ‚â¯‚æ'‚â+‚â×‚æ'‚æ‚â#‚âˆø(€€€€€€€€ñ Ìû‚â«‚âÓ‚æ#‚â‚â_‚â×‚æ Õ‘¥Ðƒ‚â‚â·‚æ‚â¯‚æ'‚â+‚â×‚æ'‚æ‚â#‚âð½ Ìø(€€€€€€€€‘í”¹±…É¥™¥…Ñ¥½¹%¹ÍÑÉÕÑ¥½¹ÍÉÉ½Èý€ñÀÉ½±”ô‰…±•ÉÐˆû‚æ‚â¯‚â—‚âS‚â‚âÏ‚â‚â·‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â è€‘í ¡”¹±…É¥™¥…Ñ¥½¹%¹ÍÑÉÕÑ¥½¹ÍÉÉ½È¥ôƒ‚â‚â‚âã‚âO‚âË‚æ‚â¯‚â—‚âS‚æ‚â‚â«‚æ‚â¯‚â‡‚æ#‚â‚æ#‚â·‚âg‚âW‚â·‚âhð½Àù€è¡”¹±…É¥™¥…Ñ¥½¹%¹ÍÑÉÕÑ¥½¹Íññmt¤¹±•¹Ñ ý€ñ½°ø‘í”¹±…É¥™¥…Ñ¥½¹%¹ÍÑÉÕÑ¥½¹Ì¹µ…À¡¸ôù€ñ±¤øñÀ±…ÍÌô‰±…É¥™¥…Ñ¥½¸µÉ•ÅÕ•ÍÐµÑ•áÐˆø‘í ¡¸¹Ñ•áÐ¥ôð½ÀøñÍµ…±°ùÕ‘¥Ð€‘í ¡¸¹‰ä¥ôƒ
Ü€‘í ¡‘¥ÍÁ±…åQ¥µ”¡¸¹…Ð¤¥ôð½Íµ…±°øð½±¤ù€¤¹©½¥¸ œœ¥ôð½½°ù€èœñÀû‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âS‚â‚âÏ‚â‚â·‚â+‚â×‚æ'‚æ‚â#‚â‚â_‚â×‚æ#‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚âŸ‚æ$ƒ‚â‚â‚âã‚âO‚âË‚â«‚â·‚âk‚â[‚âË‚â„Õ‘¥Ðƒ‚æ‚âS‚â‹‚â·‚æ'‚âË‚â‚â·‚âÓ‚â‚æ‚â—‚â‚æ‚â‚â«‚âg‚â×‚æ$ð½Àøô(€€€€€€ð½Í•Ñ¥½¸ø(€€€€€€ñ‘¥Ø±…ÍÌô‰…Í”µÍÕµµ…ÉäµÉ¥ˆ¥ô‰…Í•MÕµµ…ÉåM•Ñ¥½¸ˆø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚âŸ‚âÇ‚âg‚â_‚â×‚æ €¼ƒ‚æ‚âŸ‚â—‚âÈð½ÍÁ…¸øñˆø‘í”¹‘…Ñ•ô€‘í”¹Ñ¥µ•ôð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚âk‚â‚âÓ‚â§‚âÇ‚â\ð½ÍÁ…¸øñˆø‘í ¡”¹½µÁ…¹äñð€‹‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âàˆ¥ôð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚âk‚âÇ‚â7‚â+‚âÔ€¼ƒ‚â_‚âÓ‚â£‚â_‚âË‚âð½ÍÁ…¸øñˆø‘í ¡”¹…½Õ¹Ð¥ô€ ‘í ¡”¹‰…¹¬¥ô¤ƒ
Ü€‘í ¡”¹‘¥É•Ñ¥½¸¥ôð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚âs‚â—‚âW‚æ#‚âË‚â‚æ‚âŸ‚â—‚âÈð½ÍÁ…¸øñˆø‘í ¡•á•ÁÑ¥½¹Q¥µ•¥™™1…‰•°¡”¤¥ôð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚â‹‚â·‚âS‚â‚âÃ‚âk‚âh€¡	<¤ð½ÍÁ…¸øñˆø‘í”¹ÍåÍÑ•µµ½Õ¹Ð€ôôô¹Õ±°€ü€‹‚æ‚â‡‚æ#‚â{‚âk‚â‚âË‚â‹‚â‚âË‚âŒˆ€èµ½¹•ä¡”¹ÍåÍÑ•µµ½Õ¹Ð¥ôð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚â‹‚â·‚âS‚âc‚âg‚âË‚â‚âË‚âŒ€¡MQ4¤ð½ÍÁ…¸øñˆø‘í”¹‰…¹­µ½Õ¹Ð€ôôô¹Õ±°€ü€‹‚æ‚â‡‚æ#‚â{‚âk‚â‚âË‚â‹‚â‚âË‚âŒˆ€èµ½¹•ä¡”¹‰…¹­µ½Õ¹Ð¥ôð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚âs‚â—‚âW‚æ#‚âË‚âð½ÍÁ…¸øñˆø‘í‘¥™™1…‰•°¡”¥ôð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰…Í”µÍÕµµ…ÉäµÉ¥Í¬ˆøñÍÁ…¸û‚â‹‚â·‚âS‚â_‚â×‚æ#‚âW‚æ'‚â·‚â‚âW‚â‚âŸ‚â ð½ÍÁ…¸øñˆ±…ÍÌô‰‘…¹•Èˆø‘í”¹É¥Í­µ½Õ¹Ð€üµ½¹•ä¡”¹É¥Í­µ½Õ¹Ð¤€è€‹‚æ‚â‡‚æ#‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚æ‚â‚âÓ‚âd‰ôð½ˆøð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘•Ñ…¥±Ì±…ÍÌô‰…Í”µµ•Ñ„µµ½É”ˆøñÍÕµµ…Éäû‚â‚âÏ‚â¯‚âg‚âS‚â«‚æ#‚â‚æ‚â—‚âÃ‚âs‚âç‚æ'‚â‚âÇ‚âk‚âs‚âÓ‚âS‚â+‚â·‚âhð½ÍÕµµ…Éäøñ‘¥ØøñÍÁ…¸û‚â{‚âg‚âÇ‚â‚â‚âË‚âd€ñˆø‘í ¡”¹•µÁ±½å•”ñð€‹‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âàˆ¥ôð½ˆøð½ÍÁ…¸øñÍÁ…¸ùM1€ñˆ±…ÍÌôˆ‘í”¹½Ù•ÉM±„€ü€‰‘…¹•Èˆ€è€ˆ‰ôˆø‘í”¹…•!½ÕÉÍôƒ‚â+‚â„¸€¼€‘í”¹Í±…!½ÕÉÍôƒ‚â+‚â„¸ð½ˆøð½ÍÁ…¸øñÍÁ…¸û‚â«‚âË‚â‹‚â+‚â×‚æ'‚æ‚â#‚â€ñˆø‘í ¡ÑÉ…­5•Ñ„¡”¹ÑÉ…¬¤¹Í¡½ÉÐ¥ô‘í”¹ÍåÍÑ•µU¹…ÍÍ¥¹•€ü€ˆ€£‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‚âÏ‚â¯‚âg‚âS‚â‚âÃ‚âk‚âh¤ˆ€è€ˆ‰ôð½ˆøð½ÍÁ…¸øñÍÁ…¸û‚â‚âÏ‚â¯‚âg‚âS‚â«‚æ#‚â‚â‚âß‚âd€ñˆ±…ÍÌôˆ‘í”¹½Ù•ÉM±„€ü€‰‘…¹•Èˆ€è€ˆ‰ôˆø‘í ¡‘Õ•=˜¡”¤¹Í¡½ÉÐ¥ôð½ˆøð½ÍÁ…¸øð½‘¥ØøñÀø‘í ¡‘Õ•=˜¡”¤¹‘•Ñ…¥°¥ôð½Àøð½‘•Ñ…¥±Ìø(€€€€€€‘í”¹‘•Ñ…¥°€ü€ñ‘¥Ø±…ÍÌô‰ÉÕ±”µ‘•Ñ…¥°ˆøñˆû‚â«‚âÓ‚æ#‚â‚â_‚â×‚æ#‚â‚âÃ‚âk‚âk‚âW‚â‚âŸ‚â#‚â{‚âhð½ˆøñÀø‘í ¡”¹‘•Ñ…¥°¥ôð½Àø‘í”¹µ•µ‰•È€ü€ñÍµ…±°û‚â«‚â‡‚âË‚â+‚âÓ‚â€‘í ¡”¹µ•µ‰•È¥ô‘í”¹µ•µ‰•É9¥¬€ü€ˆ€ ˆ€¬ ¡”¹µ•µ‰•É9¥¬¤€¬€ˆ¤ˆ€è€ˆ‰ôð½Íµ…±°ù€€è€ˆ‰ôð½‘¥Øù€€è€ˆ‰ô(€€€€€€‘í”¹±…É¥™¥…Ñ¥½¹¥±•%€ü€ñ‘¥Ø±…ÍÌô‰…±•ÉÐ€‘í”¹…ÕÑ½±½Í•€ü€‰½¬ˆ€è€‰Ý…É¸‰ôˆøñÍÑÉ½¹œø‘í”¹…ÕÑ½±½Í•€ü€‹‚âo‚âÓ‚âS‚æ‚â‚â«‚â#‚âË‚â‚æ‚â‚â—‚æ3‚â+‚â×‚æ'‚æ‚â#‚â‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÐˆ€è€‹‚â{‚âk‚æ‚â‚â—‚æ3‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚â—‚âÃ‚â#‚âÇ‚âk‚â‚âç‚æ#‚æ‚â‚â«‚æ‚â—‚æ'‚âœ‰ôð½ÍÑÉ½¹œøñÍÁ…¸ø‘í ¡”¹É•Í½±ÕÑ¥½¹9½Ñ”ñð€‹‚â‡‚â×‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â#‚âË‚â‚â·‚â×‚æ‚â‡‚â”ˆ¥ôƒ
Üƒ‚â‚âŸ‚âË‚â‡‚â‡‚âÇ‚æ#‚âg‚æ‚â €‘í¹Õ´¡”¹µ…Ñ¡½¹™¥‘•¹”¥ô”‘í”¹É•Í½±Ù•‘	ä€ü€ƒ
Üƒ‚æ‚âS‚âˆ€‘í ¡”¹É•Í½±Ù•‘	ä¥õ€€è€ˆ‰ôñ‰Èø‘í”¹ÍÑ…ÑÕÌ€ôôô€‰‘…µ…”ˆ€ü€‹‚âs‚âç‚æ'‚âW‚â‚âŸ‚â#‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚æ‚âo‚æ‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚â—‚æ'‚âœˆ€è€‹‚â‡‚â×‚â‚âÏ‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚â—‚æ'‚âœƒŠPƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚âg‚âÇ‚âk‚æ‚âo‚æ‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆƒ‚â#‚âg‚â‚âŸ‚æ#‚âÈÕ‘¥Ðƒ‚â#‚âÃ‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚æ‚â—‚âÃ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â‚æ'‚âË‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âd‰ôð½ÍÁ…¸øð½‘¥Øù€€è€ˆ‰ô((€€€€€€ñÍ•Ñ¥½¸±…ÍÌô‰…Í”µÍ½ÕÉ”µÍ•Ñ¥½¸ˆ¥ô‰…Í•¥±•ÍM•Ñ¥½¸ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰…Í”µÍ•Ñ¥½¸µ¡•…ˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆû‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚æ‚â+‚æ'‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âPð½Àøñ Ìû‚æ‚â‚â—‚æ3‚âo‚â‚âÃ‚â‚â·‚âk‚â‚â·‚â‚æ‚â‚â«‚âg‚â×‚æ$ð½ Ìøð½‘¥Øøñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰…Í•=Á•¹±±¥±•Ìˆû‚âS‚âç‚æ‚â‚â—‚æ3‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âS‚â‚â·‚â‚âk‚â‚âÓ‚â§‚âÇ‚â\¿‚âŸ‚âÇ‚âdð½‰ÕÑÑ½¸øð½‘¥Øø(€€€€€€€€ñ‘¥Ø¥ô‰…Í•M½ÕÉ•¥±•Ìˆ±…ÍÌô‰…Í”µ™¥±•Ìµ±½…‘¥¹œˆøñÍÁ…¸±…ÍÌô‰ÍÁ¥¹¹•Èˆøð½ÍÁ…¸øñÍÁ…¸û‚â‚âÏ‚â—‚âÇ‚â‚â¯‚âË‚æ‚â‚â—‚æ0MQ4€¼	<€¼A4ƒ‚â_‚â×‚æ#‚æ‚â+‚æ'‚â«‚â‚æ'‚âË‚â‚æ‚â‚â¨¸¸¸ð½ÍÁ…¸øð½‘¥Øø(€€€€€€ð½Í•Ñ¥½¸ø((€€€€€€ñ Ì±…ÍÌô‰‘É…Ý•Èµ Ìˆû‚â‚æ'‚â·‚â‡‚âç‚â—‚â_‚â×‚æ#‚â‚âÃ‚âk‚âk‚æ‚â+‚æ'‚âW‚âÇ‚âS‚â«‚âÓ‚âdð½ Ìø(€€€€€€ñ½°±…ÍÌô‰Ñ¥µ•±¥¹”ˆø(€€€€€€€€ñ±¤øñÍÁ…¸±…ÍÌô‰Ðµ‘½Ðˆøð½ÍÁ…¸øñ‘¥Øøñˆû‚â‚âË‚â‹‚â‚âË‚â‚âw‚âÇ‚æ#‚âMQ4€¼A4ð½ˆøñ½‘”¥ô‰…Í•I…ÝMÑ´ˆø‘í ¡”¹ÍÑµI…Ü¥ôð½½‘”øð½‘¥Øøð½±¤ø(€€€€€€€€ñ±¤øñÍÁ…¸±…ÍÌô‰Ðµ‘½Ðˆøð½ÍÁ…¸øñ‘¥Øøñˆû‚â‚âË‚â‹‚â‚âË‚â‚âw‚âÇ‚æ#‚â	<ð½ˆøñ½‘”¥ô‰…Í•I…Ý	¼ˆø‘í ¡”¹‰½I…Ü¥ôð½½‘”øð½‘¥Øøð½±¤ø(€€€€€€€€ñ±¤øñÍÁ…¸±…ÍÌô‰Ðµ‘½Ðˆøð½ÍÁ…¸øñ‘¥Øøñˆû‚âs‚â—‚â‚âË‚â‚â#‚âÇ‚âk‚â‚âç‚æ ð½ˆøñÍÁ…¸ø‘ì(€€€€€€€€€”¹ÉÕ±•	…Í•(€€€€€€€€€€€€üƒ‚âW‚â‚âŸ‚â#‚âS‚æ'‚âŸ‚â‹‚â‚â;‚âc‚âã‚â‚â‚âÓ‚â#‚â#‚âË‚â‚â‚âË‚â‹‚â‚âË‚âg‚â¯‚â—‚âÇ‚â‚âk‚æ'‚âË‚âd€£‚æ‚â‡‚æ#‚âW‚æ'‚â·‚â‚æ‚â+‚æ$ÍÑ…Ñ•µ•¹Ð¤è€‘í ¡”¹ÑåÁ•9…µ”¥õ€(€€€€€€€€€€€€èƒ‚æ‚â‡‚æ#‚âs‚æ#‚âË‚âg‚æ‚â‚âO‚âG‚æ0è€‘í ¡”¹ÑåÁ•9…µ”¥ôƒŠPÑ½±•É…¹”ƒ‚â_‚â×‚æ#‚æ‚â+‚æ$€‘í”¹‘¥É•Ñ¥½¸€ôôô€‹‚â[‚â·‚âdˆ€ü¹Í•ÑÑ¥¹Ì¹Ñ½±•É…¹•]¥Ñ¡‘É…Ü€è¹Í•ÑÑ¥¹Ì¹Ñ½±•É…¹••Á½Í¥Ñôƒ‚âŸ‚âÓ‚âg‚âË‚â_‚âÕ€(€€€€€€€ôð½ÍÁ…¸øð½‘¥Øøð½±¤ø(€€€€€€€€ñ±¤øñÍÁ…¸±…ÍÌô‰Ðµ‘½Ðˆøð½ÍÁ…¸øñ‘¥Øøñˆû‚â«‚âË‚æ‚â¯‚âW‚âã‚â_‚â×‚æ#‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚âŸ‚æ$ð½ˆøñÍÁ…¸ø‘í ¡”¹…ÕÍ”¥ôð½ÍÁ…¸øð½‘¥Øøð½±¤ø(€€€€€€€€‘í”¹¡…ÍÙ¥‘•¹”ñðÍ½ÕÉ•Ù¥‘•¹”€ü€ñ±¤øñÍÁ…¸±…ÍÌô‰Ðµ‘½Ð½¬ˆøð½ÍÁ…¸øñ‘¥Øøñˆû‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚âg‚âhð½ˆøñÍÁ…¸ø‘íÍ½ÕÉ•Ù¥‘•¹”€ü€‰	<½A4ƒ‚âW‚æ'‚âg‚â_‚âË‚âƒŠPƒ‚âW‚â‚âŸ‚â#‚â·‚æ'‚âË‚â‚â·‚âÓ‚âƒ‚â‹‚â·‚âPƒ‚âŸ‚âÇ‚âdƒ‚æ‚âŸ‚â—‚âÈƒ‚æ‚â—‚âÃ‚â‚âç‚æ#‚â/‚æ'‚âÏ‚æ‚â—‚æ'‚âœˆ€è€‹‚â‡‚â×‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚âg‚â‚âÃ‚âk‚âh‰ôð½ÍÁ…¸øð½‘¥Øøð½±¤ù€€è€ñ±¤øñÍÁ…¸±…ÍÌô‰Ðµ‘½Ð‰…ˆøð½ÍÁ…¸øñ‘¥Øøñˆû‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdð½ˆøñÍÁ…¸±…ÍÌô‰‘…¹•Èˆû‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚âg‚âhð½ÍÁ…¸øð½‘¥Øøð½±¤ùô(€€€€€€€€‘í”¹¹½Ñ•Ì¹µ…À ¡¸¤€ôø€ñ±¤øñÍÁ…¸±…ÍÌô‰Ðµ‘½Ðˆøð½ÍÁ…¸øñ‘¥Øøñˆù9½Ñ”ƒ‚æ‚âS‚âˆ€‘í ¡¸¹‰ä¥ôƒ
Ü€‘í ¡‘¥ÍÁ±…åQ¥µ”¡¸¹…Ð¤¥ôð½ˆøñÍÁ…¸ø‘í ¡¸¹Ñ•áÐ¥ôð½ÍÁ…¸øð½‘¥Øøð½±¤ù€¤¹©½¥¸ ˆˆ¥ô(€€€€€€ð½½°ø((€€€€€€ñÍ•Ñ¥½¸€‘íÍÑ…Ñ”¹É½±”ôôôÍ¡¥™Ñ}±•…œü¡¥‘‘•¸œèœôø(€€€€€€ñ Ì±…ÍÌô‰‘É…Ý•Èµ Ìˆû‚â«‚âÓ‚æ#‚â‚â_‚â×‚æ#‚âW‚æ'‚â·‚â‚â‚â‚âk‚â‚æ#‚â·‚âg‚âo‚âÓ‚âS‚æ‚â‚â¨ð½ Ìø(€€€€€€‘íÍ½ÕÉ•Ù¥‘•¹”€ü€ñÀ±…ÍÌô‰ÅÕ¥¬µ±½Í”µ¡¥¹Ðˆøñˆø‘í±½Í•€ü€‹‚âs‚â—‚â‚âË‚â‚âW‚â‚âŸ‚â èˆ€è€‹‚â{‚â‚æ'‚â·‚â‡‚æ‚â¯‚æ$Õ‘¥Ðƒ‚â‹‚âß‚âg‚â‹‚âÇ‚âdè‰ôð½ˆø€‘í±½Í•€ü€‰Õ‘¥Ðƒ‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âo‚âÓ‚âS‚æ‚â—‚æ'‚âœƒŠPƒ‚æ‚â+‚æ'‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â‚âç‚æ 	<½A4ƒ‚âW‚æ'‚âg‚â_‚âË‚âˆ€è€‹‚â‚âç‚æ 	<½A4ƒ‚âW‚â‚â‚â‚âÇ‚âdƒ‚æ‚â‡‚æ#‚â{‚âk‚â‚âç‚æ#‚â/‚æ'‚âÌƒŠPÕ‘¥Ðƒ‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âo‚âÓ‚âS‚æ‚âS‚æ'‚æ‚â‡‚æ'‚æ‚âŸ‚â—‚âË‚âW‚æ#‚âË‚â‚â¯‚â‚âß‚â·‚â‚æ'‚âË‚â‡‚âŸ‚âÇ‚âd‰ôð½Àù€€è€ˆ‰ô(€€€€€€ñÕ°±…ÍÌô‰±½Í”µ¡•¬ˆ¥ô‰…Í•¡•­±¥ÍÑM•Ñ¥½¸ˆø(€€€€€€€€‘í¡•­±¥ÍÐ¹µ…À ¡Œ¤€ôø€ñ±¤±…ÍÌôˆ‘íŒ¹½¬€ü€‰½¬ˆ€è€‰¹¼‰ôˆøñ¤ø‘íŒ¹½¬€ü€‹ŠrLˆ€è€‹ŠrT‰ôð½¤ø‘í ¡Œ¹±…‰•°¥ôð½±¤ù€¤¹©½¥¸ ˆˆ¥ô(€€€€€€ð½Õ°ø(€€€€€€‘í±½ÍÕÉ•I•Ù¥•ÝI•…‘ä€˜˜€……µ½Õ¹Ñ=ÕÑ½µ•I•½É‘•€ü€ñÀ±…ÍÌô‰¡¥¹Ðˆû‚â‡‚â×‚â‚æ'‚â·‚â‡‚âç‚â—‚æ‚â—‚âÃ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â«‚âÏ‚â¯‚â‚âÇ‚âk‚âW‚â‚âŸ‚â#‚âW‚æ#‚â·‚æ‚â—‚æ'‚âœƒ
Üƒ‚âW‚æ'‚â·‚â‚æ‚â—‚âß‚â·‚â‚âs‚â—‚â‹‚â·‚âS‚æ‚â—‚âÃ‚âW‚âÓ‚æ+‚â‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚æ‚âg‚â¯‚âg‚æ'‚âË‚âW‚æ#‚âË‚â‚â‚âÇ‚æ'‚âg‚âW‚â·‚âg‚â[‚âÇ‚âS‚æ‚âo‚â‚æ#‚â·‚âg‚âk‚âÇ‚âg‚â_‚âÛ‚âð½Àù€€è±½ÍÕÉ•Ñ¥½¹I•…‘äñð±½Í•€ü€ˆˆ€è€ñÀ±…ÍÌô‰¡¥¹Ðˆû‚â‹‚âÇ‚â‚æ‚âo‚âÓ‚âS‚â‚âÇ‚æ'‚âg‚âW‚â·‚âg‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âs‚â—‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â#‚âg‚â‚âŸ‚æ#‚âË‚â‚æ'‚â·‚â‡‚âç‚â—‚æ‚â—‚âÃ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â#‚âÃ‚â‚â‚âhð½Àùô(€€€€€€ð½Í•Ñ¥½¸ø((€€€€€€ñ Ì±…ÍÌô‰‘É…Ý•Èµ Ìˆû‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚âg‚âhð½ Ìø(€€€€€€‘íÍÑ…Ñ”¹‘…Ñ…Í•ÐôôôÁÉ½‘ÕÑ¥½¸œ˜™±½Í•˜™l±•…œ°…‘µ¥¸t¹¥¹±Õ‘•Ì¡ÍÑ…Ñ”¹É½±”¤üœñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰‰Ñ¹½ÉÉ•Ñ±½Í•‘Ù¥‘•¹”ˆû‚æ‚â‚æ'‚æ‚â‚â¯‚â—‚âÇ‚â‚âC‚âË‚âd€£‚æ‚â‚â«‚âo‚âÓ‚âS‚æ‚â—‚æ'‚âœ¤ð½‰ÕÑÑ½¸øñÀ±…ÍÌô‰¡¥¹Ðˆû‚æ‚â‚æ‚âk‚æ‚â‚â—‚æ3‚æ‚âS‚âÓ‚â‡‚æ‚â—‚âÃ‚âo‚â‚âÃ‚âŸ‚âÇ‚âW‚âÐƒ
Üƒ‚âW‚æ'‚â·‚â‚â‚âÃ‚âk‚âã‚æ‚â¯‚âW‚âã‚âs‚â”ƒ
Üƒ‚æ‚â‡‚æ#‚æ‚âo‚âÓ‚âS‚æ‚â‚â«‚æ‚â¯‚â‡‚æ#‚â¯‚â‚âß‚â·‚æ‚â‚æ'‚â‹‚â·‚âPð½Àøœèœô(€€€€€€ñÀ¥ô‰…Í•UÁ±½…‘AÉ½É•ÍÌˆÉ½±”ô‰ÍÑ…ÑÕÌˆ…É¥„µ±¥Ù”ô‰Á½±¥Ñ”ˆø‘í ¡”¹}ÕÁ±½…‘I•ÍÕ±Ðñð€œœ¥ôð½Àø(€€€€€€‘íÍÑ…Ñ”¹‘…Ñ…Í•ÐôôôÁÉ½‘ÕÑ¥½¸œü¡Mˆ¹Á•¹‘¥¹…Í•Ù¥‘•¹”¡”¹‘‰%¥ññmt¤¹µ…À¡Àôù€ñ‘¥Ø±…ÍÌô‰…±•ÉÐÝ…É¸ˆøñÀø‘í ¡À¹¹…µ”¥ôƒ
Ü€‘íÀ¹ÕÁ±½…‘•üŸ‚æ‚â‚â—‚æ3‚â·‚â‹‚âç‚æ#‚æ‚âg‚â‚â—‚âÇ‚â‚æ‚â—‚æ'‚âœƒ‚â‹‚âÇ‚â‚â‚â·‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âdœèŸ‚â‹‚âÇ‚â‚â‚â·‚âW‚â‚âŸ‚â#‚âs‚â—‚â«‚æ#‚â‚æ‚â‚â—‚æ0ôƒ
Üƒ‚â‚â¯‚âÇ‚â¨€‘í ¡À¹¥¥ôð½Àøñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ‘…Ñ„µÉ•ÍÕµ”µ•Ù¥‘•¹”ôˆ‘í ¡À¹¥¥ôˆ€‘íÀ¹‰ÕÍäü‘¥Í…‰±•œèœôû‚âW‚â‚âŸ‚â €¼ƒ‚â—‚â·‚â‚âk‚âÇ‚âg‚â_‚âÛ‚â‚âW‚æ#‚â·‚æ‚âS‚â‹‚æ‚â‡‚æ#‚æ‚âg‚âk‚æ‚â‚â—‚æ3‚â/‚æ'‚âÌð½‰ÕÑÑ½¸øñÍµ…±°û‚â‚âÏ‚â‚â·‚æ‚âS‚âÓ‚â‡‚æ‚â‚æ‚âk‚æ‚âg‚â¯‚âg‚æ'‚âË‚âW‚æ#‚âË‚â‚âg‚â×‚æ$ƒ‚â·‚â‹‚æ#‚âË‚â‚â×‚æ‚â‚â‚â+‚â¯‚â‚âß‚â·‚âo‚âÓ‚âS‚â¯‚âg‚æ'‚âË‚âW‚æ#‚âË‚â‚â#‚âg‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âs‚â—‚æ‚âS‚æ$ð½Íµ…±°øð½‘¥Øù€¤¹©½¥¸ œœ¤èœô(€€€€€€ñ‘¥Ø±…ÍÌô‰•Ù¥‘•¹”µ‰½àˆø(€€€€€€€€‘ì¡”¹•Ù¥‘•¹•ññmt¤¹™¥±Ñ•È¡˜ôù˜¹É•Á±…•ÍM½ÕÉ•¥±•%¤¹µ…À¡˜ôù€ñÀ±…ÍÌô‰¡¥¹ÐˆøñÍÁ…¸±…ÍÌô‰‰…‘”…µ‰•Èˆû‚æ‚â‚â—‚æ3‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚âS‚âÓ‚â‡‚æ‚â_‚âg‚â_‚â×‚æ#‚æ‚â—‚æ'‚âœƒ
Üƒ‚æ‚â‚æ‚âk‚âW‚æ'‚âg‚â'‚âk‚âÇ‚âhð½ÍÁ…¸ø€‘í ¡˜¹É•Á±…•ÍM½ÕÉ•¥±•%¥ôƒŠH€‘í ¡˜¹¹…µ”¥ôð½Àù€¤¹©½¥¸ œœ¥ô(€€€€€€€€‘ì(€€€€€€€€€€¡”¹•Ù¥‘•¹”ñðmt¤¹±•¹Ñ (€€€€€€€€€€€€ü€ñÕ°±…ÍÌô‰•Ù¥‘•¹”µ±¥ÍÐˆø‘í”¹•Ù¥‘•¹”(€€€€€€€€€€€€€€€€¹µ…À (€€€€€€€€€€€€€€€€€€¡˜¤€ôø(€€€€€€€€€€€€€€€€€€€€ñ±¤øñÍÁ…¸±…ÍÌô‰•Øµ¥¼ˆø‘í˜¹¹…µ”¹µ…Ñ  ½p¸¡Á¹ñ©Á”ýñ¥™ñÝ•‰À¤½¤¤€ü€‹Â~Zðˆ€è€‹Â~N‰ôð½ÍÁ…¸øñ‘¥Øøñˆø‘í ¡˜¹¹…µ”¥ôð½ˆø‘í˜¹É•Á±…•‘	äüœñÍÁ…¸±…ÍÌô‰‰…‘”…µ‰•Èˆû‚æ‚â_‚âg‚â_‚â×‚æ#‚æ‚â—‚æ'‚âœƒ
Üƒ‚æ‚â‚æ‚âk‚âW‚æ'‚âg‚â'‚âk‚âÇ‚âhð½ÍÁ…¸øœèœô‘í˜¹½ÉÉ•Ñ¥½¹I•…Í½¸ý€ñÍÁ…¸±…ÍÌô‰‰…‘”‰±Õ”ˆû‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â‚æ'‚æ‚â‚æ‚â¯‚â‡‚æ ð½ÍÁ…¸øñÍµ…±°û‚æ‚â¯‚âW‚âã‚âs‚â”è€‘í ¡˜¹½ÉÉ•Ñ¥½¹I•…Í½¸¥ôƒ
Üƒ‚æ‚â_‚âg‚æ‚â‚â—‚æ0€‘í ¡˜¹É•Á±…•ÍÙ¥‘•¹•%‘ññ˜¹É•Á±…•ÍM½ÕÉ•¥±•%¥ôƒ
Üƒ‚æ‚âS‚âˆ€‘í ¡˜¹ÕÁ±½…‘•‘	ä¥ôð½Íµ…±°ù€èœôñÍµ…±°ø‘ì¡˜¹Í¥é”€¼€ÄÀÈÐ¤¹Ñ½¥á• À¥ô-ƒ
Üƒ‚æ‚âg‚âk‚æ‚â‡‚âß‚æ#‚â´€‘í ¡‘¥ÍÁ±…åQ¥µ”¡˜¹…Ð¤¥ôð½Íµ…±°øð½‘¥Øø‘í˜¹ÍÑ½É…•A…Ñ €ü€ñ‰ÕÑÑ½¸±…ÍÌô‰±¥¹¬µ‰Ñ¸ˆ‘…Ñ„µ…Í”µ•Ù¥‘•¹”ôˆ‘í ¡˜¹ÍÑ½É…•A…Ñ ¥ôˆû‚æ‚âo‚âÓ‚âS‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdð½‰ÕÑÑ½¸ù€€è˜¹ÕÉ°€ü€ñ„±…ÍÌô‰±¥¹¬µ‰Ñ¸ˆ¡É•˜ôˆ‘í ¡˜¹ÕÉ°¥ôˆÑ…É•Ðô‰}‰±…¹¬ˆÉ•°ô‰¹½½Á•¹•Èˆû‚æ‚âo‚âÓ‚âS‚âS‚âäð½„ù€€è€œñÍÁ…¸±…ÍÌô‰µÕÑ•ˆû‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚âŸ‚æ'‚æ‚â'‚â{‚âË‚âÃ‚â‚âË‚â‹‚â‚âË‚âŒð½ÍÁ…¸øôð½±¤ù€°(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹©½¥¸ ˆˆ¥ôð½Õ°ù€(€€€€€€€€€€€€è€ñÀ±…ÍÌô‰µÕÑ•Íµ…±°µ¹½Ñ”ˆø‘íÍÑ…Ñ”¹‘…Ñ…Í•ÐôôôÁÉ½‘ÕÑ¥½¸œ€˜˜Mˆ¹Á•¹‘¥¹…Í•Ù¥‘•¹”¡”¹‘‰%¤¹±•¹Ñ €ü€‹‚â‡‚â×‚â‚âÏ‚â‚â·‚æ‚âg‚âk‚æ‚â‚â—‚æ3‚â‚æ'‚âË‚â‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âdƒŠPƒ‚â‚âS‚âW‚â‚âŸ‚â €¼ƒ‚â—‚â·‚â‚âk‚âÇ‚âg‚â_‚âÛ‚â‚âW‚æ#‚â·‚âS‚æ'‚âË‚âg‚âk‚âdƒ‚æ‚â‡‚æ#‚âW‚æ'‚â·‚â‚æ‚âg‚âk‚â/‚æ'‚âÌƒ‚æ‚â—‚âÃ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚âg‚âÇ‚âk‚æ‚âo‚æ‚âg‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â_‚â×‚æ#‚âs‚âç‚â‚æ‚â‚â«‚â«‚âÏ‚æ‚â‚æ‚â ˆ€è”¹±…É¥™¥…Ñ¥½¹¥±•%€ü€‹‚â‡‚â×‚æ‚â·‚â‚â«‚âË‚â‚â+‚â×‚æ'‚æ‚â#‚â‚âs‚âç‚â‚â‚âÇ‚âk‚æ‚â‚â«‚æ‚â—‚æ'‚âœƒŠPƒ‚æ‚âo‚âÓ‚âS‚æ‚âS‚æ'‚æ‚âg‚æ‚â‚â—‚æ3‚âo‚â‚âÃ‚â‚â·‚âk‚â‚â·‚â‚æ‚â‚â«‚âg‚â×‚æ$ˆ€èÍ½ÕÉ•Ù¥‘•¹”€ü€‹‚æ‚â‡‚æ#‚âW‚æ'‚â·‚â‚æ‚âg‚âk‚æ‚â‚â—‚æ3‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚â{‚âÓ‚æ#‚â‡‚æ‚âW‚âÓ‚â„ƒŠPƒ‚æ‚â+‚æ'‚â‚æ'‚â·‚â‡‚âç‚â—‚âW‚æ'‚âg‚â'‚âk‚âÇ‚âh	<½A4ƒ‚â_‚â×‚æ#‚âs‚æ#‚âË‚âg‚æ‚â‚âO‚âG‚æ3‚âW‚â‚âŸ‚â ˆ€è€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚æ‚â‚â—‚æ3‚æ‚âg‚âhƒŠPƒ‚âW‚æ'‚â·‚â‚âW‚â‚âŸ‚â#‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â—‚âÃ‚æ‚â‚âß‚æ#‚â·‚âg‚æ‚â‚âo‚âÓ‚âS‚æ‚â‚â«‚æ‚â¯‚æ'‚â‚â‚âh‰ôð½Àù€(€€€€€€€ô(€€€€€€€€ñ±…‰•°±…ÍÌô‰…ÑÑ… µ‰Ñ¸€‘í…¸ ‰…ÑÑ… ˆ¤ñð…¸ ‰¹½Ñ”ˆ¤€ü€ˆˆ€è€‰±½­•‰ôˆø(€€€€€€€€€€ñ¥¹ÁÕÐÑåÁ”ô‰™¥±”ˆ¥ô‰•Ù%¹ÁÕÐˆµÕ±Ñ¥Á±”¡¥‘‘•¸…•ÁÐô‰¥µ…”¼¨°¹Á‘˜°¹‘½à°¹ÍØ°¹á±Íà°¹ÑáÐˆ€‘í…¸ ‰…ÑÑ… ˆ¤ñð…¸ ‰¹½Ñ”ˆ¤€ü€ˆˆ€è€‰‘¥Í…‰±•‰ô€¼ø(€€€€€€€€€ƒ‚æ‚âg‚âk‚æ‚â·‚â‚â«‚âË‚âŒ€¼ƒ‚â«‚â—‚âÓ‚âl€¼ƒ‚æ‚â‚â—‚æ3‚â+‚â×‚æ'‚æ‚â#‚â(€€€€€€€€ð½±…‰•°ø(€€€€€€€€ñÀ±…ÍÌô‰µÕÑ•Íµ…±°µ¹½Ñ”ˆû‚æ‚âg‚âk‚æ‚âS‚æ'‚â¯‚â—‚âË‚â‹‚æ‚â‚â—‚æ0èA°]½É€ ¹‘½à¤°ƒ‚â‚âç‚âo‚âƒ‚âË‚âx°á•°°MXƒ‚â¯‚â‚âß‚â´QaPƒ
Üƒ‚æ‚â‚â—‚æ3‚â—‚âÃ‚æ‚â‡‚æ#‚æ‚â‚âÓ‚âd€ÈÀ5ƒ
Üƒ‚â‚âË‚â‚æ‚âg‚âk‚æ‚â‡‚æ#‚æ‚â+‚æ#‚â‚âË‚â‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚â¯‚â‚âß‚â·‚âo‚âÓ‚âS‚æ‚â‚â¨ð½Àø(€€€€€€ð½‘¥Øø((€€€€€€ñ Ì±…ÍÌô‰‘É…Ý•Èµ Ìˆ€‘íÍÑ…Ñ”¹É½±”ôôôÍ¡¥™Ñ}±•…œü¡¥‘‘•¸œèœôû‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âS‚â_‚â×‚æ Õ‘¥Ðƒ‚â‚â·‚æ‚â¯‚æ'‚âk‚â‚âÓ‚â§‚âÇ‚â_‚â+‚â×‚æ'‚æ‚â#‚âð½ Ìø(€€€€€€ñÀ±…ÍÌô‰¡¥¹Ðˆ€‘íÍÑ…Ñ”¹É½±”ôôôÍ¡¥™Ñ}±•…œü¡¥‘‘•¸œèœôû‚â‚æ'‚â·‚â‚âŸ‚âË‚â‡‚â_‚â×‚æ#‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â#‚âÃ‚æ‚â«‚âS‚â‚æ‚â‚æ#‚âs‚âç‚æ'‚â+‚â×‚æ'‚æ‚â#‚â‚â‚â·‚â‚âk‚â‚âÓ‚â§‚âÇ‚â_‚âg‚â×‚æ$ƒ‚æ‚â‚æ‚âk‚âo‚â‚âÃ‚âŸ‚âÇ‚âW‚âÓ‚æ‚âS‚âÓ‚â„ƒ‚æ‚â‡‚æ#‚â«‚æ#‚â‚â‚âÏ‚âW‚â·‚âk‚æ‚â—‚âÃ‚æ‚â‡‚æ#‚âo‚âÓ‚âS‚æ‚â‚â¨ƒ‚â¯‚âË‚â‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â«‚æ#‚â‚æ‚â‚â¨ƒ‚æ‚â¯‚æ'‚â‚âS‚â«‚æ#‚â‚â‚â·‚â+‚â×‚æ'‚æ‚â#‚â‚âW‚æ#‚â´ð½Àø(€€€€€€ñ‘¥Ø±…ÍÌô‰¹½Ñ”µ™½É´ˆ€‘íÍÑ…Ñ”¹É½±”ôôôÍ¡¥™Ñ}±•…œü¡¥‘‘•¸œèœôø(€€€€€€€€ñÑ•áÑ…É•„¥ô‰¹½Ñ•Q•áÐˆÉ½ÝÌôˆÌˆµ…á±•¹Ñ ôˆÈÀÀÀˆÁ±…•¡½±‘•Èô‹‚â‚âÃ‚âk‚âã‚â«‚âÓ‚æ#‚â‚â_‚â×‚æ#‚âW‚æ'‚â·‚â‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚â—‚âÃ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â_‚â×‚æ#‚âW‚æ'‚â·‚â‚â‚âË‚âŒ¸¸¸ˆ€‘í±½Í•ü‘¥Í…‰±•œèœôø‘í ¡…Í•=Á•¹É…™ÑÌ¹•Ð¡…Í•=Á•¹É…™Ñ-•ä¡”¤¤ü¹¹½Ñ•ñðœœ¥ôð½Ñ•áÑ…É•„ø(€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰‰Ñ¹9½Ñ”ˆ€‘í±½Í•ü‘¥Í…‰±•œèœôû‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âS‚â‚âÏ‚â‚â·‚â+‚â×‚æ'‚æ‚â#‚âð½‰ÕÑÑ½¸ø(€€€€€€ð½‘¥Øø(€€€€€€ñÍ•Ñ¥½¸±…ÍÌô‰…Í”µÉ•ÍÁ½¹Í”µÍ•Ñ¥½¸ˆ¥ô‰…Í•I•ÍÁ½¹Í•M•Ñ¥½¸ˆø(€€€€€€€€ñ Ìû‚â‚âÏ‚â+‚â×‚æ'‚æ‚â#‚â‚â«‚âÏ‚â¯‚â‚âÇ‚âk‚â«‚æ#‚â‚æ‚â¯‚æ$Õ‘¥Ðð½ ÌøñÀøÄƒ‚æ‚â—‚âß‚â·‚â‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdƒŠH€Èƒ‚â‚âÃ‚âk‚âã‚â«‚âË‚æ‚â¯‚âW‚âàƒŠH€Ìƒ‚â«‚æ#‚â‚â‚âÏ‚â+‚â×‚æ'‚æ‚â#‚â‚â{‚â‚æ'‚â·‚â‡‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdƒ
Üƒ‚â‚âË‚â‚æ‚â—‚âß‚â·‚â‚æ‚â‚â—‚æ3‚â·‚â‹‚æ#‚âË‚â‚æ‚âS‚â×‚â‹‚âŸ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â«‚æ#‚â‚æ‚â—‚âÃ‚æ‚â‡‚æ#‚âo‚âÓ‚âS‚æ‚â‚â¨ð½Àø(€€€€€€€€‘í±…É¥™¥…Ñ¥½¹±½Ü¹‘É…™Ñ5…É­ÕÀ¡”¹}±…É¥™¥…Ñ¥½¹É…™Ñ¥±”¥ô(€€€€€€€€‘í”¹É•ÍÁ½¹Í•Q•áÐ€ü€ñ‘¥Ø±…ÍÌô‰…Í”µÉ•ÍÁ½¹Í”µÍ…Ù•ˆøñˆû‚â‚âÏ‚â+‚â×‚æ'‚æ‚â#‚â‚â_‚â×‚æ#‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚âŸ‚æ$ð½ˆøñÀø‘í ¡”¹É•ÍÁ½¹Í•Q•áÐ¥ôð½ÀøñÍµ…±°ø‘í ¡‘¥ÍÁ±…åQ¥µ”¡”¹É•ÍÁ½¹‘•‘Ð¤¥ôð½Íµ…±°øð½‘¥Øù€€è€œô(€€€€€€€€‘í”¹±…É¥™¥…Ñ¥½¹!¥ÍÑ½ÉåÉÉ½Èý€ñÀÉ½±”ô‰…±•ÉÐˆû‚â‹‚âÇ‚â‚â·‚æ#‚âË‚âg‚â‚æ'‚â·‚â‚âŸ‚âË‚â‡‚æ‚âS‚âÓ‚â‡‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â è€‘í ¡”¹±…É¥™¥…Ñ¥½¹!¥ÍÑ½ÉåÉÉ½È¥ôƒ‚â‚â‚âã‚âO‚âË‚æ‚âo‚âÓ‚âS‚æ‚â‚â«‚æ‚â¯‚â‡‚æ#‚â‚æ#‚â·‚âg‚â«‚æ#‚âð½Àù€é±…É¥™¥…Ñ¥½¹±½Ü¹¡¥ÍÑ½Éå5…É­ÕÀ¡”¹±…É¥™¥…Ñ¥½¹!¥ÍÑ½Éä±‘¥ÍÁ±…åQ¥µ”¥ô(€€€€€€€€ñ±…‰•°€‘ì…±…É¥™¥…Ñ¥½¹±½Ü¹…¹I•ÍÁ½¹¡”¹ÍÑ…ÑÕÌ±ÍÑ…Ñ”¹É½±”¤ü¡¥‘‘•¸œèœôû‚âW‚æ'‚â·‚â‚â‚âË‚â‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚â‚â«‚âg‚â×‚æ$ƒ‚æ‚âS‚â‹‚â«‚âË‚æ‚â¯‚âW‚âãŠ˜ñÑ•áÑ…É•„¥ô‰É•ÍÁ½¹Í•Q•áÐˆÉ½ÝÌôˆÐˆµ…á±•¹Ñ ôˆÈÀÀÀˆÁ±…•¡½±‘•Èô‹‚â‚âÃ‚âk‚âã‚â«‚âË‚æ‚â¯‚âW‚âàƒ‚â‚æ'‚â·‚æ‚â_‚æ‚â#‚â#‚â‚âÓ‚âƒ‚â‹‚â·‚âPƒ‚âŸ‚âÇ‚âg‚â_‚â×‚æ ƒ‚æ‚â—‚â‚â·‚æ'‚âË‚â‚â·‚âÓ‚âƒ‚æ‚â—‚âÃ‚â«‚âÓ‚æ#‚â‚â_‚â×‚æ#‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â‹‚âß‚âg‚â‹‚âÇ‚âdˆ€‘ì…±…É¥™¥…Ñ¥½¹±½Ü¹…¹I•ÍÁ½¹¡”¹ÍÑ…ÑÕÌ±ÍÑ…Ñ”¹É½±”¥ñð……¸ É•ÍÁ½¹œ¤ü‘¥Í…‰±•œèœôø‘í ¡…Í•=Á•¹É…™ÑÌ¹•Ð¡…Í•=Á•¹É…™Ñ-•ä¡”¤¤ü¹É•ÍÁ½¹Í”üý”¹}±…É¥™¥…Ñ¥½¹É…™ÑQ•áÐüüœœ¥ôð½Ñ•áÑ…É•„øð½±…‰•°ø(€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ¥ô‰‰Ñ¹I•ÍÁ½¹ˆ€‘ì…±…É¥™¥…Ñ¥½¹±½Ü¹…¹I•ÍÁ½¹¡”¹ÍÑ…ÑÕÌ±ÍÑ…Ñ”¹É½±”¥ñð……¸ É•ÍÁ½¹œ¤ü‘¥Í…‰±•œèœôû‚â«‚æ#‚â‚â‚âÏ‚â+‚â×‚æ'‚æ‚â#‚â‚â{‚â‚æ'‚â·‚â‡‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdð½‰ÕÑÑ½¸ø(€€€€€€€€ñÍµ…±°û‚â«‚æ#‚â‚â«‚âÏ‚æ‚â‚æ‚â#‚æ‚â—‚æ'‚âŸ‚â#‚âÃ‚â‚â´Õ‘¥Ðƒ‚âW‚â‚âŸ‚â#‚â‚âÏ‚âW‚â·‚âk‚æ‚â—‚âÃ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â{‚â‚æ'‚â·‚â‡‚â‚âÇ‚âdƒ‚æ‚â‚æ‚âk‚â‚æ'‚â·‚â‚âŸ‚âË‚â‡‚æ‚âS‚âÓ‚â‡‚æ‚â—‚âÃ‚æ‚â‚â—‚æ3‚æ‚âS‚âÓ‚â‡‚â‚â‚âhƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚âo‚âÓ‚âS‚æ‚â‚â¨ð½Íµ…±°ø(€€€€€€ð½Í•Ñ¥½¸ø(€€€€ñ™½½Ñ•È±…ÍÌô‰‘É…Ý•Èµ™½½Ðˆ¥ô‰…Í•Ñ¥½¹M•Ñ¥½¸ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰‘É…Ý•Èµ¹•áÐˆøñÍÁ…¸û‚â‚âÇ‚æ'‚âg‚âW‚â·‚âg‚â[‚âÇ‚âS‚æ‚âlð½ÍÁ…¸øñˆø‘íÍÑ…Ñ”¹É½±”ôôôÍ¡¥™Ñ}±•…œü¡±½Í•üŸ‚âo‚âÓ‚âS‚æ‚â‚â«‚æ‚â—‚æ'‚âœƒŠPƒ‚âS‚âç‚âo‚â‚âÃ‚âŸ‚âÇ‚âW‚âÓ‚æ‚âS‚âÓ‚â„ƒ‚æ‚â‡‚æ#‚â«‚æ#‚â‚â‚âÏ‚âW‚â·‚âk‚â/‚æ'‚âÌœé”¹ÍÑ…ÑÕÌôôô±…É¥™å¥¹œœüŸ‚â·‚æ#‚âË‚âg‚â‚âÏ‚â‚â´Õ‘¥Ðƒ‚æ‚âg‚âk‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdƒ‚æ‚â—‚æ'‚âŸ‚â‚âS‚â«‚æ#‚â‚â‚âÏ‚â+‚â×‚æ'‚æ‚â#‚â‚â{‚â‚æ'‚â·‚â‡‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdœé”¹ÍÑ…ÑÕÌôôô…¹ÍÝ•É•œüŸ‚â«‚æ#‚â‚â‚âÏ‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚â—‚æ'‚âœƒŠPƒ‚â‚â´Õ‘¥Ðƒ‚âW‚â‚âŸ‚â#‚â‚âÏ‚âW‚â·‚âhœèŸ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â·‚â‹‚âç‚æ#‚æ‚âg‚â«‚â[‚âË‚âg‚âÃ‚â«‚æ#‚â‚â‚âÏ‚â+‚â×‚æ'‚æ‚â#‚âƒ‚â‚â‚âã‚âO‚âË‚âW‚âÓ‚âS‚âW‚æ#‚â´Õ‘¥Ðœ¤é±½Í•€ü€‹‚âo‚âÓ‚âS‚æ‚â‚â«‚æ‚â—‚æ'‚âœƒŠPƒ‚âS‚âç‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â—‚âÃ‚âo‚â‚âÃ‚âŸ‚âÇ‚âW‚âÓ‚â‚âË‚â‚â‹‚âß‚âg‚â‹‚âÇ‚âdˆ€è”¹±½ÍÕÉ•I•ÅÕ•ÍÑ%€ü€‹‚â«‚æ#‚â‚âs‚â—‚âW‚â‚âŸ‚â#‚æ‚â—‚æ'‚âœƒŠPƒ‚â¯‚âÇ‚âŸ‚â¯‚âg‚æ'‚âË‚âW‚â‚âŸ‚â#‚æ‚â—‚âÃ‚âo‚âÓ‚âS‚æ‚â‚â«‚âS‚æ'‚âË‚âg‚â—‚æ#‚âË‚âƒ‚æ‚â‡‚æ#‚â«‚æ#‚â‚æ‚â‚æ'‚âË‚â‚âÓ‚âŸ‚âW‚æ#‚â´ˆ€è”¹ÍÑ…ÑÕÌôôôÁ…¥É}Á•¹‘¥¹œœ€ü€‹‚âW‚â‚âŸ‚â#‚â‚âÏ‚â‚â·‚â#‚âÇ‚âk‚â‚âç‚æ#‚âS‚æ'‚âË‚âg‚â—‚æ#‚âË‚âƒŠPƒ‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚â¯‚â‚âß‚â·‚â«‚æ#‚â‚â‚â—‚âÇ‚âk‚âs‚æ#‚âË‚âg‚â‚âÏ‚â‚â·‚æ‚âS‚âÓ‚â„ˆ€èÅÕ¥­±½Í•±¥¥‰±”€ü€‹‚â·‚æ'‚âË‚â‚â·‚âÓ‚â‚æ‚â—‚âÃ‚â‹‚â·‚âS‚âW‚â‚âƒŠPÕ‘¥Ðƒ‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âo‚âÓ‚âS‚æ‚â‚â«‚âW‚æ#‚âË‚â‚æ‚âŸ‚â—‚âË‚æ‚âS‚æ$ˆ€è”¹¡…ÍÙ¥‘•¹”€ü€¡…¸ …ÁÁÉ½Ù”œ¤€ü€‹‚âW‚â‚âŸ‚â#‚æ‚â·‚â‚â«‚âË‚â‚æ‚â—‚âÃ‚âs‚â—‚â‹‚â·‚âPƒ‚æ‚â—‚æ'‚âŸ‚âo‚âÓ‚âS‚æ‚â‚â«‚æ‚âS‚æ'‚æ‚âg‚â‚âÇ‚æ'‚âg‚âW‚â·‚âg‚æ‚âS‚â×‚â‹‚âœˆ€è€‰Õ‘¥Ðƒ‚âW‚â‚âŸ‚â#‚æ‚â·‚â‚â«‚âË‚â‚æ‚â—‚âÃ‚âs‚â—‚â‹‚â·‚âPƒ‚æ‚â—‚æ'‚âŸ‚â«‚æ#‚â‚â¯‚âÇ‚âŸ‚â¯‚âg‚æ'‚âË‚â‚â·‚âo‚âÓ‚âS‚æ‚â‚â¨ˆ¤€è€‹‚æ‚âo‚âÓ‚âS‚æ‚â‚â«‚â#‚â‚âÓ‚â€¼ƒ‚â«‚æ#‚â‚â‚â·‚æ‚â·‚â‚â«‚âË‚â‚âs‚âç‚æ'‚â+‚â×‚æ'‚æ‚â#‚â‰ôð½ˆøð½‘¥Øø(€€€€€€ñÀ±…ÍÌô‰…Í”µ…Ñ¥½¸µ¡•±Àˆû‚â‡‚â×‚æ‚â‚â—‚æ3‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚æ‚âo‚â—‚âŸ‚æ#‚âË‚â‹‚â·‚âS‚âs‚æ#‚âË‚âg‚æ‚â—‚æ'‚âœƒŠPƒ‚â¯‚âË‚â‚æ‚âo‚æ‚âg‚æ‚â‚â¨	<ƒ‚â‚âÇ‚âhMQ4½A4ƒ‚â‚âg‚â—‚âÃ‚âw‚âÇ‚æ#‚âƒ‚æ‚â¯‚æ'‚æ‚â+‚æ$ƒŠs‚â#‚âÇ‚âk‚â‚âç‚æ#‚æ‚â·‚âŠtƒ‚æ‚â—‚âß‚â·‚â‚æ‚â‚â«‚â‚âç‚æ ƒ‚æ‚â¯‚âW‚âã‚âs‚â”ƒ‚æ‚â—‚âÃ‚âW‚âÓ‚æ+‚â‚â‹‚âß‚âg‚â‹‚âÇ‚âdƒ‚â‚âÃ‚âk‚âk‚â#‚âÃ‚âW‚â‚âŸ‚â#‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚â‚âÇ‚âk‚âW‚æ'‚âg‚â_‚âË‚â‚â#‚â‚âÓ‚â‚æ‚â‹‚â‚â#‚âË‚â‚æ‚â+‚æ‚â‚â—‚âÓ‚â«‚âW‚æ3‚âo‚âÓ‚âS‚æ‚â‚â«‚â_‚âÇ‚æ#‚âŸ‚æ‚âlƒ‚æ‚â‡‚æ#‚âW‚æ'‚â·‚â‚â‚â‚â·‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚â«‚â‡‚â‡‚âW‚âÓ‚â¯‚â‚âß‚â·‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚â{‚âß‚æ#‚â·‚æ‚â¯‚æ'‚âs‚æ#‚âË‚âdð½Àø(€€€€€€‘íµ¥ÍÍ¥¹¡•­Ì¹±•¹Ñ €ü€ñ‘¥Ø±…ÍÌô‰…Í”µ±½Í”µ‰±½­•ÉÌˆøñˆû‚â‹‚âÇ‚â‚âo‚âÓ‚âS‚æ‚â‡‚æ#‚æ‚âS‚æ$èƒ‚â‚âË‚âP€‘íµ¥ÍÍ¥¹¡•­Ì¹±•¹Ñ¡ôƒ‚â‚æ'‚â´ð½ˆøñÕ°ø‘íµ¥ÍÍ¥¹¡•­Ì¹µ…À¡¥Ñ•´ôù€ñ±¤ø‘í ¡¥Ñ•´¹±…‰•°¥ôð½±¤ù€¤¹©½¥¸ œœ¥ôð½Õ°ø‘íµ¥ÍÍ¥¹¡•­Ì¹Í½µ”¡¥Ñ•´ôùl…ÕÍ”œ°½Ý¹•Èt¹¥¹±Õ‘•Ì¡¥Ñ•´¹­•ä¤¤üœñÀû‚â[‚æ'‚âË‚æ‚â‡‚æ#‚â‡‚â×‚â+‚æ#‚â·‚â‚æ‚â‚æ'‚â«‚âË‚æ‚â¯‚âW‚âã‚â¯‚â‚âß‚â·‚âs‚âç‚æ'‚â‚âÇ‚âk‚âs‚âÓ‚âS‚â+‚â·‚âhƒ‚æ‚â¯‚æ'‚â«‚æ#‚â‚æ‚â—‚â‚æ‚â‚â«‚æ‚â—‚âÃ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â‚æ#‚âs‚âç‚æ'‚âS‚âç‚æ‚â”ƒ‚æ‚â‡‚æ#‚â‚â‚â·‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚â«‚â‡‚â‡‚âW‚âÓ‚æ‚â{‚âß‚æ#‚â·‚æ‚â¯‚æ'‚âs‚æ#‚âË‚âdð½Àøœèœôñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰‰Ñ¹½5¥ÍÍ¥¹œˆû‚æ‚âo‚âW‚â‚âŸ‚â#‚â«‚âÓ‚æ#‚â‚â_‚â×‚æ#‚â‚âË‚âPð½‰ÕÑÑ½¸øð½‘¥Øù€€è€œô(€€€€€€‘íl±•…œ°…‘µ¥¸t¹¥¹±Õ‘•Ì¡ÍÑ…Ñ”¹É½±”¤˜™l±½Í•œ°‘…µ…”t¹¥¹±Õ‘•Ì¡”¹ÍÑ…ÑÕÌ¤üœñ‘¥Ø±…ÍÌô‰…±•ÉÐÝ…É¸ˆøñˆû‚âs‚â—‚âo‚âÓ‚âS‚âs‚âÓ‚âS‚â«‚âË‚â‡‚âË‚â‚â[‚â‹‚æ'‚â·‚âg‚â‚â—‚âÇ‚âk‚æ‚âS‚æ'‚æ‚âS‚â‹‚â¯‚âÇ‚âŸ‚â¯‚âg‚æ'‚âË‚â·‚â·‚âS‚âÓ‚â\¿‚âs‚âç‚æ'‚âS‚âç‚æ‚â—‚â‚âÃ‚âk‚âhð½ˆøñ‘¥Ø±…ÍÌô‰¥¹±¥¹”µ…Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰‰Ñ¹I•½Á•¹±½Í•‘…Í”ˆû‚â‹‚â‚æ‚â—‚âÓ‚â‚âs‚â—‚âo‚âÓ‚âPƒŠPƒ‚â‚âß‚âdÕ‘¥Ðƒ‚âW‚â‚âŸ‚â ð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰‰Ñ¹I•ÑÕÉ¹±½Í•‘…Í”ˆû‚âW‚â×‚â‚â—‚âÇ‚âk‚æ‚â¯‚æ'‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚â{‚âÓ‚æ#‚â‡‚æ‚âW‚âÓ‚â„ð½‰ÕÑÑ½¸øð½‘¥ØøñÍµ…±°û‚â‹‚â·‚âS‚æ‚â—‚âÃ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚âS‚âÓ‚â‡‚æ‚â‡‚æ#‚â[‚âç‚â‚â—‚âhƒ‚æ‚âW‚æ#‚â#‚âÃ‚æ‚â‚æ‚âk‚æ‚âo‚æ‚âg‚âo‚â‚âÃ‚âŸ‚âÇ‚âW‚âÓ‚â_‚â×‚æ#‚â‹‚â‚æ‚â—‚âÓ‚â‚æ‚â—‚âÃ‚æ‚â‡‚æ#‚âg‚âÇ‚âk‚æ‚âg‚â‹‚â·‚âS‚âo‚âÇ‚â#‚â#‚âã‚âk‚âÇ‚âdð½Íµ…±°øð½‘¥Øøœèœô(€€€€€€ñ‘¥Ø±…ÍÌô‰‘É…Ý•ÈµÁÉ¥µ…Éäµ…Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰‰Ñ¹¡½½Í•±…É¥™¥…Ñ¥½¸ˆ€‘í±½Í•ü‘¥Í…‰±•œèœôû‚æ‚â—‚âß‚â·‚â‚æ‚â·‚â‚â«‚âË‚â‚â+‚â×‚æ'‚æ‚â#‚âð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰‰Ñ¹5…¹Õ…±A…¥Èˆ€‘ì…5…¹Õ…±A…¥É¥¹œ¹•±¥¥‰±”¡”¤ü‘¥Í…‰±•œèœôø‘í”¹ÑåÁ”ôôô…µ½Õ¹Ñ}‘¥™˜œüŸ‚âW‚â‚âŸ‚â#‚â‹‚â·‚âS‚âW‚æ#‚âË‚â€¼ƒ‚â#‚âÇ‚âk‚â‚âç‚æ#‚æ‚â·‚âœèŸ‚â#‚âÇ‚âk‚â‚âç‚æ#‚æ‚â·‚âôð½‰ÕÑÑ½¸ø‘ílœÝ4œ°U	PÝ4t¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡”¹½µÁ…¹ä¤¹Ñ½UÁÁ•É…Í” ¤¤ý€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰‰Ñ¹%¹Ñ•É¹…±QÉ…¹Í™•ÉA…¥Èˆ€‘ì…5…¹Õ…±A…¥É¥¹œ¹•±¥¥‰±”¡”¤ü‘¥Í…‰±•œèœôû‚â#‚âÇ‚âk‚â‚âç‚æ#‚â‚æ'‚âË‚â‡‚âk‚âÇ‚â7‚â+‚â×‚âƒ‚âË‚â‹‚æ‚âg‚âk‚â‚âÓ‚â§‚âÇ‚â\ð½‰ÕÑÑ½¸ù€èœôñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰‰Ñ¹É½ÍÍ½µÁ…¹åA…¥Èˆ€‘í”¹ÍÑ…ÑÕÌ„ôô½Á•¸œü‘¥Í…‰±•œèœôû‚â#‚âÇ‚âk‚â‚âç‚æ#‚â‚æ'‚âË‚â‡‚âk‚â‚âÓ‚â§‚âÇ‚â\ð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰‰Ñ¹±…É¥™äˆû‚â«‚æ#‚â‚â‚â·‚â+‚â×‚æ'‚æ‚â#‚âð½‰ÕÑÑ½¸ø‘í±…É¥™¥…Ñ¥½¹I•ÑÕÉ¸¹•±¥¥‰±”¡”¤üœñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰‰Ñ¹I•ÑÕÉ¹±…É¥™¥…Ñ¥½¸ˆû‚âW‚â×‚â‚â—‚âÇ‚âk‚æ‚â¯‚æ'‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚â{‚âÓ‚æ#‚â‡‚æ‚âW‚âÓ‚â„ð½‰ÕÑÑ½¸øœèœôñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ¥ô‰‰Ñ¹ÁÁÉ½Ù”ˆ€‘í±½ÍÕÉ•Ñ¥½¹I•…‘ä€ü€ˆˆ€è€‰‘¥Í…‰±•‰ôø‘í±½Í•€ü€‹‚âo‚âÓ‚âS‚æ‚â‚â«‚æ‚â—‚æ'‚âœˆ€èÅÕ¥­±½Í•±¥¥‰±”€ü€‹‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âo‚âÓ‚âS‚æ‚â‚â«‚âW‚æ#‚âË‚â‚æ‚âŸ‚â—‚âÈˆ€è±½ÍÕÉ•I•Ù¥•ÝI•…‘ä€ü€‹‚âW‚â‚âŸ‚â#‚âs‚â—‚æ‚â—‚âÃ‚âo‚âÓ‚âS‚æ‚â‚â¨ˆ€è€‹‚â‹‚âÇ‚â‚âW‚â‚âŸ‚â#‚âs‚â—‚æ‚â‡‚æ#‚æ‚âS‚æ$‰ôð½‰ÕÑÑ½¸øð½‘¥Øø(€€€€€€ñ‘¥Ø¥ô‰µ…¹Õ…±A…¥ÉI•Ù¥•Üˆøð½‘¥Øø(€€€€€€ñ‘¥Ø¥ô‰…Í•±½ÍÕÉ•I•Ù¥•Üˆøð½‘¥Øø(€€€€€€‘ì…±½Í•˜˜…”¹µ…¹Õ…±A…¥É%˜˜…”¹±½ÍÕÉ•I•ÅÕ•ÍÑ%˜™lµ½¹¥Ñ½Èœ°…Õ‘¥Ñ}…ÍÍ¥ÍÑ…¹Ðœ°±•…œ°…‘µ¥¸t¹¥¹±Õ‘•Ì¡ÍÑ…Ñ”¹É½±”¤ý€ñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ¥ô‰‰Ñ¹M•¹‘±½ÍÕÉ”ˆø‘í…¸ …ÁÁÉ½Ù”œ¤üŸ‚âo‚âÓ‚âS‚æ‚â‚â¨œèÕ‘¥Ðƒ‚âW‚â‚âŸ‚â#‚æ‚â·‚â‚â«‚âË‚âŒ€¼ƒ‚âs‚â—‚â‹‚â·‚âPƒ‚æ‚â—‚æ'‚âŸ‚â«‚æ#‚â‚â¯‚âÇ‚âŸ‚â¯‚âg‚æ'‚âË‚â‚â·‚âo‚âÓ‚âS‚æ‚â‚â¨ôð½‰ÕÑÑ½¸ù€èœô(€€€€€€ñ‘•Ñ…¥±Ì±…ÍÌô‰‘É…Ý•Èµµ½É”µ…Ñ¥½¹ÌˆøñÍÕµµ…Éäû‚æ‚âg‚âk‚æ‚â‚â—‚æ3‚æ‚â—‚âÃ‚æ‚â‚â‚âß‚æ#‚â·‚â‚â‡‚âß‚â·‚â·‚âß‚æ#‚âdð½ÍÕµµ…Éäøñ‘¥Øøñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰‰Ñ¹)ÕµÁ¥±•Ìˆû‚âS‚âç‚æ‚â‚â—‚æ3‚âo‚â‚âÃ‚â‚â·‚âhð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰‰Ñ¹ÑÑ…¡EÕ¥¬ˆû‚æ‚âg‚âk‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰‰Ñ¹½I•Äˆû‚æ‚âk‚â‚â·‚æ‚â¯‚æ'‚â+‚â×‚æ'‚æ‚â#‚â€¡A¤ð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰‰Ñ¹½±Èˆû‚æ‚â·‚â‚â«‚âË‚â‚â+‚â×‚æ'‚æ‚â#‚â€¡A¤ð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰‰Ñ¹…µ…”ˆû‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚âo‚æ‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆð½‰ÕÑÑ½¸øð½‘¥Øøð½‘•Ñ…¥±Ìø(€€€€ð½™½½Ñ•Èø(€€€€ð½‘¥Øù€ì((€‘É…Ý•È¹‘…Ñ…Í•Ð¹…Í•É…™Ñ-•äõ…Í•=Á•¹É…™Ñ-•ä¡”¤ì(€€ œ¹½Ñ•Q•áÐœ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ¥¹ÁÕÐœ±…ÁÑÕÉ•…Í•=Á•¹É…™Ð¤ì(€€ œÉ•ÍÁ½¹Í•Q•áÐœ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ¥¹ÁÕÐœ±…ÁÑÕÉ•…Í•=Á•¹É…™Ð¤ì(€‘É…Ý•È¹¡¥‘‘•¸€ô™…±Í”ì(€½Ù•É±…ä¹¡¥‘‘•¸€ô™…±Í”ì(€É•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ”  ¤€ôø‘É…Ý•È¹±…ÍÍ1¥ÍÐ¹…‘ ‰½¸ˆ¤¤ì(€Õ‘¥ÑU¤¹½Á•¸¡‘É…Ý•È¤ì((€€ ˆ‘É…Ý•É±½Í”ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°±½Í•É…Ý•È¤ì(€€ œ‰Ñ¹I•ÑÕÉ¹±…É¥™¥…Ñ¥½¸œ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ° ¤ôù±…É¥™¥…Ñ¥½¹I•ÑÕÉ¸¹½Á•¸¡”¤¹…Ñ ¡•ÉÈôùÑ½…ÍÐ¡•ÉÈ¹µ•ÍÍ…”°Ý…É¸œ¤¤¤ì(€€ œ‰Ñ¹I•½Á•¹±½Í•‘…Í”œ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ° ¤ôù½Á•¹]É½¹±½ÍÕÉ•I•Ù•ÉÍ…°¡”°É•½Á•¹}…Õ‘¥Ðœ¤¤ì(€€ œ‰Ñ¹I•ÑÕÉ¹±½Í•‘…Í”œ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ° ¤ôù½Á•¹]É½¹±½ÍÕÉ•I•Ù•ÉÍ…°¡”°É•ÑÕÉ¹}±…É¥™¥…Ñ¥½¸œ¤¤ì(€€ œ…Í•9•áÑEÕ•Õ”œ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ° ¤ôùÍ¡½ÝI•…‘=¹±å…Í•EÕ•Õ”¡”¤¤ì(€€ œ‰Ñ¹½5¥ÍÍ¥¹œœ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ° ¤ôùì(€€€½¹ÍÐ™¥ÉÍÐõµ¥ÍÍ¥¹¡•­ÍlÁtü¹­•äì(€€€½¹ÍÐÑ…É•Ðõ™¥ÉÍÐôôôÉ…Üññ™¥ÉÍÐôôô•Ù¥‘•¹”œüœ…Í•¥±•ÍM•Ñ¥½¸œé™¥ÉÍÐôôô¹½Ñ”œüœ¹½Ñ•Q•áÐœèœ…Í•¡•­±¥ÍÑM•Ñ¥½¸œì(€€€€¡Ñ…É•Ð¤ü¹ÍÉ½±±%¹Ñ½Y¥•Ü¡í‰•¡…Ù¥½ÈèÍµ½½Ñ œ±‰±½¬è•¹Ñ•Èô¤ì(€€€¥˜¡™¥ÉÍÐôôô¹½Ñ”œ¤ œ¹½Ñ•Q•áÐœ¤ü¹™½ÕÌ ¤ì(€ô¤ì(€½¹ÍÐµ½Ù•I•Ù¥•Ü€ô€¡½™™Í•Ð¤€ôøì(€€€¥˜€¡MÑÉ¥¹œ  œ¹½Ñ•Q•áÐœ¤ü¹Ù…±Õ”ñð€œœ¤¹ÑÉ¥´ ¤ñðMÑÉ¥¹œ  œÉ•ÍÁ½¹Í•Q•áÐœ¤ü¹Ù…±Õ”ñð€œœ¤¹ÑÉ¥´ ¤¤É•ÑÕÉ¸Ñ½…ÍÐ Ÿ‚â‡‚â×‚â‚æ'‚â·‚â‚âŸ‚âË‚â‡‚â_‚â×‚æ#‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚âk‚âÇ‚âg‚â_‚âÛ‚âƒ‚â‚â‚âã‚âO‚âË‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â¯‚â‚âß‚â·‚â—‚æ'‚âË‚â‚â‚æ'‚â·‚â‚âŸ‚âË‚â‡‚â‚æ#‚â·‚âg‚æ‚âo‚â—‚â×‚æ#‚â‹‚âg‚æ‚â‚â¨œ°€Ý…É¸œ¤ì(€€€½¹ÍÐ¹•áÑ%€ôÅÕ•Õ•mÅÕ•Õ•%¹‘•à€¬½™™Í•Ñtì(€€€¥˜€¡¹•áÑ%¤½Á•¹á•ÁÑ¥½¸¡¹•áÑ%¤ì(€ôì(€€ œÉ•Ù¥•ÝAÉ•Ù¥½ÕÌœ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøµ½Ù•I•Ù¥•Ü ´Ä¤¤ì(€€ œÉ•Ù¥•Ý9•áÐœ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøµ½Ù•I•Ù¥•Ü Ä¤¤ì(€½Ù•É±…ä¹½¹±¥¬õ±½Í•É…Ý•Èì(€€ ˆ‰Ñ¹)ÕµÁ¥±•Ìˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø€ ˆ…Í•¥±•ÍM•Ñ¥½¸ˆ¤ü¹ÍÉ½±±%¹Ñ½Y¥•Ü¡ì‰•¡…Ù¥½Èè€‰Íµ½½Ñ ˆ°‰±½¬è€‰ÍÑ…ÉÐˆô¤¤ì(€€ ˆ‰Ñ¹ÑÑ…¡EÕ¥¬ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø±½Í•ýÑ½…ÍÐ Ÿ‚æ‚â‚â«‚âo‚âÓ‚âS‚æ‚â—‚æ'‚âœƒ‚âW‚æ'‚â·‚â‚æ‚â+‚æ'‚âo‚âã‚æ#‚â‡‚æ‚â‚æ'‚æ‚â‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â«‚âÏ‚â¯‚â‚âÇ‚âk‚â¯‚âÇ‚âŸ‚â¯‚âg‚æ'‚âÈ¿‚âs‚âç‚æ'‚âS‚âç‚æ‚â”œ°Ý…É¸œ¤è ˆ•Ù%¹ÁÕÐˆ¤ü¹±¥¬ ¤¤ì(€€ œ‰Ñ¹½ÉÉ•Ñ±½Í•‘Ù¥‘•¹”œ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ° ¤ôù½Á•¹±½Í•‘Ù¥‘•¹•½ÉÉ•Ñ¥½¸¡”¤¹…Ñ ¡•ÉÈôùÑ½…ÍÐ¡•ÉÈ¹µ•ÍÍ…”°Ý…É¸œ¤¤¤ì(€€ ˆ‰Ñ¹¡½½Í•±…É¥™¥…Ñ¥½¸ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€¥˜€ ……¸ ‰…ÑÑ… ˆ¤€˜˜€……¸ ‰¹½Ñ”ˆ¤¤É•ÑÕÉ¸‘•¹ä ‹‚æ‚â—‚âß‚â·‚â‚æ‚â·‚â‚â«‚âË‚â‚â+‚â×‚æ'‚æ‚â#‚âˆ¤ì(€€€€ ˆ…Í•¥±•ÍM•Ñ¥½¸ˆ¤ü¹ÍÉ½±±%¹Ñ½Y¥•Ü¡ì‰•¡…Ù¥½Èè€‰Íµ½½Ñ ˆ°‰±½¬è€‰ÍÑ…ÉÐˆô¤ì(€€€½¹ÍÐÁ¥­•È€ô€ ˆ…Í•5…¥±Ù¥‘•¹•	ÕÑÑ½¸ˆ¤ì(€€€¥˜€¡Á¥­•È¤Á¥­•È¹±¥¬ ¤ì(€€€•±Í”ì”¹}½Á•¹±…É¥™¥…Ñ¥½¹A¥­•È€ôÑÉÕ”ìÑ½…ÍÐ ‹‚â‚âÏ‚â—‚âÇ‚â‚æ‚â¯‚â—‚âS‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚æ‚â·‚â‚â«‚âË‚â‚â+‚â×‚æ'‚æ‚â#‚â‚â‚â·‚â‚âk‚â‚âÓ‚â§‚âÇ‚â_‚âg‚â×‚æ'Š˜ˆ¤ìô(€ô¤ì(€¥˜¡É½ÍÍ…å]½É­‰•¹ ¹•±¥¥‰±”¡”¤¥ì(€€€€ œ‰Ñ¹5…¹Õ…±A…¥Èœ¤¹‘¥Í…‰±•õ™…±Í”ì(€€€€ œ‰Ñ¹5…¹Õ…±A…¥Èœ¤¹Ñ•áÑ½¹Ñ•¹ÐôŸ‚â#‚âÇ‚âk‚â‚âç‚æ#‚â‚æ'‚âË‚â‡‚âŸ‚âÇ‚âd€¼ƒ‚æ‚âW‚â‚â×‚â‹‚â‡‚â¯‚â—‚âË‚â‹‚â‚âç‚æ œì(€ô(€€ œ‰Ñ¹5…¹Õ…±A…¥Èœ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ° ¤ôùÉ½ÍÍ…å]½É­‰•¹ ¹•±¥¥‰±”¡”¤ýÉ½ÍÍ…å]½É­‰•¹ ¹½Á•¸¡”¤é5…¹Õ…±A…¥É¥¹œ¹½Á•¸¡”°Í…µ”œ¤¤ì(€€ œ‰Ñ¹%¹Ñ•É¹…±QÉ…¹Í™•ÉA…¥Èœ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ° ¤ôù5…¹Õ…±A…¥É¥¹œ¹½Á•¸¡”°¥¹Ñ•É¹…°œ¤¤ì(€€ œ‰Ñ¹É½ÍÍ½µÁ…¹åA…¥Èœ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ° ¤ôù5…¹Õ…±A…¥É¥¹œ¹½Á•¸¡”°É½ÍÌœ¤¤ì(€¥˜¡l±•…œ°…‘µ¥¸t¹¥¹±Õ‘•Ì¡ÍÑ…Ñ”¹É½±”¤˜™…¸ …ÁÁÉ½Ù”œ¤˜˜…±½Í•¥ì(€€€½¹ÍÐ¡•…‘±½Í”õ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰ÕÑÑ½¸œ¤ì(€€€¡•…‘±½Í”¹¥ô‰Ñ¹!•…‘±½Í”œí¡•…‘±½Í”¹ÑåÁ”ô‰ÕÑÑ½¸œí¡•…‘±½Í”¹±…ÍÍ9…µ”ôÁÉ¥µ…Éäµ‰ÕÑÑ½¸œì(€€€¡•…‘±½Í”¹Ñ•áÑ½¹Ñ•¹ÐôŸ‚âo‚âÓ‚âS‚æ‚â‚â¨€£‚â¯‚âÇ‚âŸ‚â¯‚âg‚æ'‚âÈ€¼ƒ‚âs‚âç‚æ'‚âS‚âç‚æ‚â—‚â‚âÃ‚âk‚âh¤œì(€€€¡•…‘±½Í”¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ° ¤ôùì(€€€€€¥˜ …l±•…œ°…‘µ¥¸t¹¥¹±Õ‘•Ì¡ÍÑ…Ñ”¹É½±”¥ñð……¸ …ÁÁÉ½Ù”œ¤¥É•ÑÕÉ¸‘•¹ä Ÿ‚âo‚âÓ‚âS‚æ‚â‚â¨œ¤ì(€€€€€¥˜¡ÅÕ¥­±½Í•±¥¥‰±”¥É•ÑÕÉ¸½¹™¥ÉµEÕ¥­±½Í”¡”¤ì(€€€€€¥˜€¡ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€ÁÉ½‘ÕÑ¥½¸œ¤É•ÑÕÉ¸…Í•±½ÍÕÉ”¹½Á•¹MÕ‰µ¥Ð¡”¤¹…Ñ ¡•ÉÈôùÑ½…ÍÐ¡•ÉÈ¹µ•ÍÍ…”°Ý…É¸œ¤¤ì(€€€€€€ œ‰Ñ¹ÁÁÉ½Ù”œ¤ü¹±¥¬ ¤ì(€€€ô¤ì(€€€€ œ‰Ñ¹É½ÍÍ½µÁ…¹åA…¥Èœ¤¹…™Ñ•È¡¡•…‘±½Í”¤ì(€ô(€¥˜¡ÍÑ…Ñ”¹É½±”„ôôÍ¡¥™Ñ}±•…œ¥ì(€€€5…¹Õ…±A…¥É¥¹œ¹µ½Õ¹ÑI•Ù¥•Ü¡”° œµ…¹Õ…±A…¥ÉI•Ù¥•Üœ¤¤ì(€€€…Í•±½ÍÕÉ”¹µ½Õ¹ÑI•Ù¥•Ü¡”° œ…Í•±½ÍÕÉ•I•Ù¥•Üœ¤¤ì(€ô(€€ œ‰Ñ¹M•¹‘±½ÍÕÉ”œ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ° ¤ôù…Í•±½ÍÕÉ”¹½Á•¹MÕ‰µ¥Ð¡”¤¹…Ñ ¡•ÉÈôùÑ½…ÍÐ¡•ÉÈ¹µ•ÍÍ…”°Ý…É¸œ¤¤¤ì(€€ ˆ…Í•=Á•¹±±¥±•Ìˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø€¡±½Í•É…Ý•È ¤°¼ ‰±½Õˆ°ì™¥±Ñ•ÉÌèì‘…Ñ”è”¹‘…Ñ”°™É½´è”¹‘…Ñ”°Ñ¼è”¹‘…Ñ”°½µÁ…¹äè”¹½µÁ…¹äôô¤¤¤ì(€‘É…Ý•È¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µ…Í”µÍÑ•Átˆ¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€½¹ÍÐÑ…É•Ð€ô‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹…Í•MÑ•À€ôôô€‰™¥±•Ìˆ€ü€ ˆ…Í•¥±•ÍM•Ñ¥½¸ˆ¤€è‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹…Í•MÑ•À€ôôô€‰…Ñ¥½¸ˆ€ü€ ˆ…Í•Ñ¥½¹M•Ñ¥½¸ˆ¤€è€ ˆ…Í•MÕµµ…ÉåM•Ñ¥½¸ˆ¤ì(€€€Ñ…É•Ðü¹ÍÉ½±±%¹Ñ½Y¥•Ü¡ì‰•¡…Ù¥½Èè€‰Íµ½½Ñ ˆ°‰±½¬è€‰ÍÑ…ÉÐˆô¤ì(€ô¤¤ì(€±½…‘á•ÁÑ¥½¹MÕÁÁ½ÉÐ¡”°½ÁÑ¥½¹Ì¤ì(€¥˜¡ÍÑ…Ñ”¹‘…Ñ…Í•ÐôôôÁÉ½‘ÕÑ¥½¸œ€˜˜”¹‘‰%¤Ù¥‘•¹•I•½µµ•¹‘…Ñ¥½¹Ì¹µ½Õ¹Ñ…Í•	…¹¹•È¡‘É…Ý•È¹ÅÕ•ÉåM•±•Ñ½È œ¹‘É…Ý•Èµ‰½‘äœ¤ñð‘É…Ý•È°”°Mˆ°½Á•¹MÑ½É•‘¥±•AÉ•Ù¥•Ü°½Á•¹Ù¥‘•¹•I•±…Ñ•‘…Í”¤ì(€‘É…Ý•È¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µ…Í”µ•Ù¥‘•¹•tœ¤¹™½É… ¡‰ÕÑÑ½¸€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°…Íå¹Œ€ ¤€ôøì(€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ôÑÉÕ”ì(€€€ÑÉäì(€€€€€½¹ÍÐ™¥±”€ô€¡”¹•Ù¥‘•¹”ñðmt¤¹™¥¹¡˜€ôø˜¹ÍÑ½É…•A…Ñ €ôôô‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹…Í•Ù¥‘•¹”¤ì(€€€€€…Ý…¥Ð½Á•¹MÑ½É•‘¥±•AÉ•Ù¥•Ü¡íÁ…Ñ é‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹…Í•Ù¥‘•¹”°¹…µ”é™¥±”ü¹¹…µ”ñð€Ÿ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â#‚âË‚â‚æ‚â‚â¨œ°(€€€€€€€Í¥é”é™¥±”ü¹Í¥é”°½µÁ…¹äé”¹½µÁ…¹ä°‘…Ñ”é”¹‘…Ñ”°­¥¹è‘½}±…É¥™äœ°ÍÑ…ÑÕÌèÁ…ÉÍ•œ°(€€€€€€€É•…‘=¹±äéÑÉÕ”°…Í•½‘”é”¹¥°•Ù¥‘•¹•=É¥¥¸èŸ‚æ‚âg‚âk‚âs‚æ#‚âË‚âg‚æ‚â‚â¨€¼ƒ‚âs‚âç‚æ'‚â+‚â×‚æ'‚æ‚â#‚âô¤ì(€€€ô…Ñ €¡•ÉÉ½È¤ìÑ½…ÍÐ ‹‚æ‚âo‚âÓ‚âS‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â‡‚æ#‚æ‚âS‚æ$è€ˆ€¬•ÉÉ½È¹µ•ÍÍ…”°€‰Ý…É¸ˆ¤ìô(€€€™¥¹…±±äì‰ÕÑÑ½¸¹‘¥Í…‰±•€ô™…±Í”ìô(€ô¤¤ì((€½¹ÍÐ…•ÁÑMÑ½É•‘Ù¥‘•¹”€ô™¥±”€ôøì(€€€”¹•Ù¥‘•¹”õ”¹•Ù¥‘•¹•ññmtì(€€€¥˜ …”¹•Ù¥‘•¹”¹Í½µ”¡¥Ñ•´ôù¥Ñ•´¹¥ôôõ™¥±”¹¥¤¥”¹•Ù¥‘•¹”¹ÁÕÍ ¡í¥é™¥±”¹¥±¹…µ”é™¥±”¹™¥±•}¹…µ”±Í¥é”é™¥±”¹Í¥é•}‰åÑ•Ì±…Ðé™¥±”¹É•…Ñ•‘}…Ñññ¹½ÝMÑ…µÀ ¤±ÍÑ½É…•A…Ñ é™¥±”¹ÍÑ½É…•}Á…Ñ¡ô¤ì(€€€”¹¡…ÍÙ¥‘•¹”õÑÉÕ”ì(€ôì(€‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µÉ•ÍÕµ”µ•Ù¥‘•¹•tœ¤¹™½É… ¡‰ÕÑÑ½¸ôù‰ÕÑÑ½¸¹½¹±¥¬õ…Íå¹Œ ¤ôùì(€€€‰ÕÑÑ½¸¹‘¥Í…‰±•õÑÉÕ”ì(€€€ÑÉåí…•ÁÑMÑ½É•‘Ù¥‘•¹”¡…Ý…¥ÐMˆ¹É•ÍÕµ•…Í•Ù¥‘•¹”¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹É•ÍÕµ•Ù¥‘•¹”¤¤í”¹}…Í•Ù¥‘•¹•1½…‘•õ™…±Í”í”¹}ÕÁ±½…‘I•ÍÕ±ÐôŸ‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚âS‚âÓ‚â‡‚æ‚â—‚âÃ‚âs‚âç‚â‚æ‚â‚â«‚â«‚âÏ‚æ‚â‚æ‚â#‚æ‚â—‚æ'‚âœƒŠPƒ‚æ‚â‡‚æ#‚â·‚âÇ‚âo‚æ‚â‚â—‚æ3‚â/‚æ'‚âÌœíÑ½…ÍÐ¡”¹}ÕÁ±½…‘I•ÍÕ±Ð¤íô(€€€…Ñ ¡•ÉÉ½È¥í”¹}ÕÁ±½…‘I•ÍÕ±Ðõ•ÉÉ½È¹µ•ÍÍ…”íÑ½…ÍÐ¡•ÉÉ½È¹µ•ÍÍ…”°Ý…É¸œ¤íô(€€€™¥¹…±±åí¥˜¡ÍÑ…Ñ”¹Í•±•Ñ•ôôõ”¹¥¥…Ý…¥Ð½Á•¹á•ÁÑ¥½¸¡”¹¥¤í•±Í”‰ÕÑÑ½¸¹‘¥Í…‰±•õ™…±Í”íô(€ô¤ì(€€ ˆ•Ù%¹ÁÕÐˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¡…¹”ˆ°…Íå¹Œ€¡•ÙÐ¤€ôøì(€€€¥˜€ ……¸ ‰…ÑÑ… ˆ¤€˜˜€……¸ ‰¹½Ñ”ˆ¤¤É•ÑÕÉ¸‘•¹ä ‹‚æ‚âg‚âk‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdˆ¤ì(€€€½¹ÍÐ™¥±•Ì€ôl¸¸¹•ÙÐ¹Ñ…É•Ð¹™¥±•Ítì(€€€¥˜€ …™¥±•Ì¹±•¹Ñ ¤É•ÑÕÉ¸ì(€€€¥˜€¡ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€‰ÁÉ½‘ÕÑ¥½¸ˆ¤ì(€€€€€½¹ÍÐ¥¹ÁÕÐ€ô•ÙÐ¹Ñ…É•Ðì(€€€€€¥¹ÁÕÐ¹‘¥Í…‰±•€ôÑÉÕ”ì(€€€€€±•ÐÍ…Ù•€ô€Àì(€€€€€½¹ÍÐÕÁ±½…‘Ñ½È€ôMˆ¹…ÕÑ¡UÍ•È ¤ü¹¥ì(€€€€€”¹}ÕÁ±½…‘I•ÍÕ±Ð€ôƒ‚â‚âÏ‚â—‚âÇ‚â‚æ‚âg‚âk‚â¯‚â—‚âÇ‚â‚âC‚âË‚âd€‘í™¥±•Ì¹±•¹Ñ¡ôƒ‚æ‚â‚â—‚æ3Š™€ì(€€€€€±•ÐÕÁ±½…‘½µÁ±•Ñ”€ô™…±Í”ì(€€€€€½¹ÍÐÕÁ±½…‘ÉÉ½ÉÌ€ômtì(€€€€€ÑÉäì(€€€€€€€™½È€¡½¹ÍÐm™¥±•%¹‘•à±™¥±•t½˜™¥±•Ì¹•¹ÑÉ¥•Ì ¤¤ì(€€€€€€€€€¥˜¡Mˆ¹…ÕÑ¡UÍ•È ¤ü¹¥„ôõÕÁ±½…‘Ñ½È¥Ñ¡É½Ü¹•ÜÉÉ½È Ÿ‚âk‚âÇ‚â7‚â+‚â×‚âs‚âç‚æ'‚æ‚â+‚æ'‚æ‚âo‚â—‚â×‚æ#‚â‹‚âg‚â‚âÃ‚â¯‚âŸ‚æ#‚âË‚â‚æ‚âg‚âk‚æ‚â‚â—‚æ0ƒ‚â¯‚â‹‚âã‚âS‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚æ‚â¯‚â—‚âß‚â´ƒ‚æ‚â‡‚æ#‚âs‚âç‚â‚æ‚â‚â«‚â‚æ'‚âË‚â‡‚âk‚âÇ‚â7‚â+‚âÔœ¤ì(€€€€€€€€€ÑÉäì…•ÁÑMÑ½É•‘Ù¥‘•¹”¡…Ý…¥ÐMˆ¹ÕÁ±½…‘…Í•Ù¥‘•¹”¡”¹‘‰%°™¥±”°€¡ÍÑ…”¤€ôøì(€€€€€€€€€€€”¹}ÕÁ±½…‘I•ÍÕ±Ð€ôƒ‚æ‚â‚â—‚æ0€‘í™¥±•%¹‘•à€¬€Åô¼‘í™¥±•Ì¹±•¹Ñ¡ôè€‘í™¥±”¹¹…µ•ôƒ
Ü€‘íÍÑ…•õ€ì(€€€€€€€€€€€½¹ÍÐÁÉ½É•ÍÌ€ô€ œ…Í•UÁ±½…‘AÉ½É•ÍÌœ¤ì(€€€€€€€€€€€¥˜€¡ÁÉ½É•ÍÌ€˜˜ÍÑ…Ñ”¹Í•±•Ñ•€ôôô”¹¥¤ÁÉ½É•ÍÌ¹Ñ•áÑ½¹Ñ•¹Ð€ô”¹}ÕÁ±½…‘I•ÍÕ±Ðì(€€€€€€€€€ô¤¤ì(€€€€€€€€€Í…Ù•¬¬ì(€€€€€€€€€ô…Ñ ¡•ÉÉ½È¤ìÕÁ±½…‘ÉÉ½ÉÌ¹ÁÕÍ ¡€‘í™¥±”¹¹…µ•ôè€‘í•ÉÉ½È¹µ•ÍÍ…•õ€¤ìô(€€€€€€€ô(€€€€€€€¥˜¡ÕÁ±½…‘ÉÉ½ÉÌ¹±•¹Ñ ¥Ñ¡É½Ü¹•ÜÉÉ½È¡ÕÁ±½…‘ÉÉ½ÉÌ¹©½¥¸ q¸œ¤¤ì(€€€€€€€ÕÁ±½…‘½µÁ±•Ñ”€ôÍ…Ù•€ôôô™¥±•Ì¹±•¹Ñ ì(€€€€€€€”¹}ÕÁ±½…‘I•ÍÕ±Ð€ôƒ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â—‚âÃ‚âs‚âç‚â‚æ‚â‚â«‚æ‚â—‚æ'‚âœ€‘íÍ…Ù•‘ôƒ‚æ‚â‚â—‚æ1€ì(€€€€€€€É•½É‘…Í•U¥I•ÍÕ±Ð¡”°ƒ‚æ‚âg‚âk‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â«‚âÏ‚æ‚â‚æ‚â €‘íÍ…Ù•‘ôƒ‚æ‚â‚â—‚æ0ƒŠPƒ‚â‚â·‚âW‚â‚âŸ‚â ƒ‚æ‚â‡‚æ#‚æ‚â+‚æ#‚âo‚âÓ‚âS‚æ‚â‚â©€¤ì(€€€€€€€Ñ½…ÍÐ¡ƒ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â—‚âÃ‚âs‚âç‚â‚æ‚â‚â«‚æ‚â—‚æ'‚âœ€‘íÍ…Ù•‘ôƒ‚æ‚â‚â—‚æ1€¤ì(€€€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€€€”¹}ÕÁ±½…‘I•ÍÕ±Ð€ôƒ‚æ‚âg‚âk‚â«‚âÏ‚æ‚â‚æ‚â €‘íÍ…Ù•‘ô¼‘í™¥±•Ì¹±•¹Ñ¡ôƒ‚æ‚â‚â—‚æ0ƒ
Ü€‘í•ÉÉ½È¹µ•ÍÍ…•ôƒ
Üƒ‚â¯‚âË‚â‚âs‚â—‚æ‚â‡‚æ#‚æ‚âg‚æ#‚âg‚â·‚âdƒ‚æ‚âo‚â‚âS‚âW‚â‚âŸ‚â#‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â‚æ#‚â·‚âg‚â·‚âÇ‚âo‚â/‚æ'‚âÍ€ì(€€€€€€€Ñ½…ÍÐ¡ƒ‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â«‚âÏ‚æ‚â‚æ‚â €‘íÍ…Ù•‘ô¼‘í™¥±•Ì¹±•¹Ñ¡ôƒ‚æ‚â‚â—‚æ0ƒ
Ü€‘í•ÉÉ½È¹µ•ÍÍ…•õ€°€‰Ý…É¸ˆ¤ì(€€€€€ô™¥¹…±±äì(€€€€€€€¥¹ÁÕÐ¹Ù…±Õ”€ô€ˆˆì(€€€€€€€¥¹ÁÕÐ¹‘¥Í…‰±•€ô™…±Í”ì(€€€€€€€”¹}…Í•Ù¥‘•¹•1½…‘•€ô™…±Í”ì(€€€€€€€¥˜€¡ÍÑ…Ñ”¹Í•±•Ñ•€ôôô”¹¥¤ì(€€€€€€€€€…Ý…¥Ð½Á•¹á•ÁÑ¥½¸¡”¹¥¤ì(€€€€€€€€€¥˜€¡ÕÁ±½…‘½µÁ±•Ñ”¤Í¡½Ý…Í•MÕ‰µ¥ÍÍ¥½¹I••¥ÁÐ¡lÁ…¥É}Á•¹‘¥¹œœ°…¹ÍÝ•É•t¹¥¹±Õ‘•Ì¡”¹ÍÑ…ÑÕÌ¤ü…‘‘¥Ñ¥½¹…±}•Ù¥‘•¹”œè•Ù¥‘•¹”œ±”¹¥¤ì(€€€€€€€ô(€€€€€ô(€€€€€É•ÑÕÉ¸ì(€€€ô(€€€”¹•Ù¥‘•¹”€ô”¹•Ù¥‘•¹”ñðmtì(€€€™¥±•Ì¹™½É…  ¡˜¤€ôø”¹•Ù¥‘•¹”¹ÁÕÍ ¡ì¹…µ”è˜¹¹…µ”°Í¥é”è˜¹Í¥é”°…Ðè¹½ÝMÑ…µÀ ¤°ÕÉ°èUI0¹É•…Ñ•=‰©•ÑUI0¡˜¤ô¤¤ì(€€€”¹¡…ÍÙ¥‘•¹”€ôÑÉÕ”ì(€€€±½Ñ¥½¸ ‰…ÑÑ… ˆ°€‰•Ù¥‘•¹”ˆ°”¹¥°ƒ‚æ‚âg‚âk‚æ‚â‚â—‚æ0€‘í™¥±•Ì¹µ…À ¡˜¤€ôø˜¹¹…µ”¤¹©½¥¸ ˆ°€ˆ¥õ€¤ì(€€€Í…Ù•=Ù•ÉÉ¥‘”¡”¤ì(€€€É•½É‘…Í•U¥I•ÍÕ±Ð¡”°ƒ‚æ‚âg‚âk‚â¯‚â—‚âÇ‚â‚âC‚âË‚âd€‘í™¥±•Ì¹±•¹Ñ¡ôƒ‚æ‚â‚â—‚æ3‚æ‚â—‚æ'‚âœƒŠPƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚âo‚âÓ‚âS‚æ‚â‚â©€¤ì(€€€Ñ½…ÍÐ¡ƒ‚æ‚âg‚âk‚â¯‚â—‚âÇ‚â‚âC‚âË‚âd€‘í™¥±•Ì¹±•¹Ñ¡ôƒ‚æ‚â‚â—‚æ3‚æ‚â—‚æ'‚â€¤ì(€€€½Á•¹á•ÁÑ¥½¸¡¥¤ì(€ô¤ì((€€ ˆ‰Ñ¹9½Ñ”ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°…Íå¹Œ€ ¤€ôøì(€€€¥˜€ ……¸ ‰¹½Ñ”ˆ¤¤É•ÑÕÉ¸‘•¹ä ‹‚æ‚â{‚âÓ‚æ#‚â„¹½Ñ”ˆ¤ì(€€€½¹ÍÐÑáÐ€ô€ ˆ¹½Ñ•Q•áÐˆ¤¹Ù…±Õ”¹ÑÉ¥´ ¤ì(€€€¥˜€ …ÑáÐ¤É•ÑÕÉ¸Ñ½…ÍÐ ‹‚â‚â‚âã‚âO‚âË‚â{‚âÓ‚â‡‚â{‚æ0¹½Ñ”ƒ‚â‚æ#‚â·‚âdˆ°€‰Ý…É¸ˆ¤ì(€€€½¹ÍÐ‰ÕÑÑ½¸€ô€ ˆ‰Ñ¹9½Ñ”ˆ¤ì(€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ôÑÉÕ”ì(€€€ÑÉäì(€€€€€¥˜€¡ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€‰ÁÉ½‘ÕÑ¥½¸ˆ¤ì(€€€€€€€¥˜€ …”¹‘‰%¤Ñ¡É½Ü¹•ÜÉÉ½È ‹‚æ‚â‡‚æ#‚â{‚âk‚â‚â¯‚âÇ‚â«‚æ‚â‚â«‚âC‚âË‚âg‚â‚æ'‚â·‚â‡‚âç‚â”ˆ¤ì(€€€€€€€…Ý…¥ÐMˆ¹…ÁÁ•¹‘…Í•9½Ñ”¡”¹‘‰%°ÑáÐ¤ì(€€€€€ô•±Í”ì(€€€€€€€”¹¹½Ñ•Ì¹ÁÕÍ ¡ì‰äèÕÉÉ•¹ÑUÍ•È ¤¹ÕÍ•É¹…µ”°…Ðè¹½ÝMÑ…µÀ ¤°Ñ•áÐèÑáÐô¤ì(€€€€€€€±½Ñ¥½¸ ‰¹½Ñ”ˆ°€‰•á•ÁÑ¥½¸ˆ°”¹¥°€‹‚æ‚â{‚âÓ‚æ#‚â„¹½Ñ”è€ˆ€¬ÑáÐ¹Í±¥” À°€ØÀ¤¤ì(€€€€€€€Í…Ù•=Ù•ÉÉ¥‘”¡”¤ì(€€€€€ô(€€€€€É•½É‘…Í•U¥I•ÍÕ±Ð¡”°€Ÿ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âS‚â‚âÏ‚â‚â·‚æ‚â—‚æ'‚âœƒŠPƒ‚âs‚âç‚æ'‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚â¯‚æ‚âg‚æ‚âg‚æ‚â‚â«‚â_‚â×‚æ#‚â«‚æ#‚â‚æ‚â—‚æ'‚âœƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚âo‚âÓ‚âS‚æ‚â‚â¨œ¤ì(€€€€€±•…ÉM…Ù•‘…Í•É…™Ð¡”°¹½Ñ”œ±ÑáÐ¤ì(€€€€€Ñ½…ÍÐ ‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âS‚â‚âÏ‚â‚â·‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚â—‚æ'‚âœˆ¤ì(€€€€€¥˜€¡ÍÑ…Ñ”¹Í•±•Ñ•€ôôô¥¤…Ý…¥Ð½Á•¹á•ÁÑ¥½¸¡¥¤ì(€€€ô…Ñ €¡•ÉÈ¤ì(€€€€€Ñ½…ÍÐ ‹‚âk‚âÇ‚âg‚â_‚âÛ‚â9½Ñ”ƒ‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â è€ˆ€¬•ÉÈ¹µ•ÍÍ…”°€‰Ý…É¸ˆ¤ì(€€€ô™¥¹…±±äì(€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ô™…±Í”ì(€€€ô(€ô¤ì(€€ ˆ‰Ñ¹½I•Äˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€½¹ÍÐ€ô‘Õ•=˜¡”¤ì(€€€¥ÍÍÕ•I•ÅÕ•ÍÑ½Œ¡m•t°ì(€€€€€­•äè”¹¥°(€€€€€Í¡¥™Ñ9…µ”è€¡¹Í¡¥™ÑÌ¹™¥¹ ¡Ì¤€ôøÌ¹½‘”€ôôô”¹Í¡¥™Ð¤ñðíô¤¹¹…µ”ñð”¹Í¡¥™Ð°(€€€€€Ñ½9…µ”è€¡¹ÕÍ•ÉÌ¹™¥¹ ¡Ô¤€ôøÔ¹É½±”€ôôô€‰Í¡¥™Ñ}±•…ˆ€˜˜Ô¹Í¡¥™Ð€ôôô”¹Í¡¥™Ð¤ñðíô¤¹¹…µ”°(€€€€€Á•É¥½‘1…‰•°èƒ‚âŸ‚âÇ‚âg‚â_‚â×‚æ €‘í”¹‘…Ñ•ôƒ
Üƒ‚æ‚â‚â¨€‘í”¹¥‘õ€°(€€€ô¤ì(€ô¤ì(€€ ˆ‰Ñ¹½±Èˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø(€€€¥ÍÍÕ•±…É¥™¥…Ñ¥½¹½Œ¡”°€  ˆÉ•ÍÁ½¹Í•Q•áÐˆ¤¹Ù…±Õ”ñð€ˆˆ¤¹ÑÉ¥´ ¤ñð”¹É•ÍÁ½¹Í•Q•áÐñð€œœ¤°(€€¤ì((€€ ˆ‰Ñ¹±…É¥™äˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô”¹¡…ÍÙ¥‘•¹”€˜˜€…¥ÍU¹Í•¹Ñ±…É¥™¥…Ñ¥½¹…Í”¡”¤€ü€¡…¸ …ÁÁÉ½Ù”œ¤üŸ‚âo‚âÓ‚âS‚æ‚â‚â¨œèŸ‚âW‚â‚âŸ‚â#‚æ‚â·‚â‚â«‚âË‚â‚æ‚â—‚æ'‚âœƒ‚â«‚æ#‚â‚â¯‚âÇ‚âŸ‚â¯‚âg‚æ'‚âË‚â‚â·‚âo‚âÓ‚âS‚æ‚â‚â¨œ¤€è€‹‚æ‚âo‚âÓ‚âS‚æ‚â‚â«‚â#‚â‚âÓ‚â€¼ƒ‚â«‚æ#‚â‚â‚â·‚æ‚â·‚â‚â«‚âË‚â‚âs‚âç‚æ'‚â+‚â×‚æ'‚æ‚â#‚âˆì(€¥˜¡”¹¡…ÍÙ¥‘•¹”€˜˜¥ÍU¹Í•¹Ñ±…É¥™¥…Ñ¥½¹…Í”¡”¤¤ œ¹‘É…Ý•Èµ¹•áÐˆœ¤¹Ñ•áÑ½¹Ñ•¹ÐôŸ‚â‡‚â×‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚âg‚âk‚æ‚â—‚æ'‚âœƒ‚æ‚âW‚æ#‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â«‚æ#‚â‚â‚â·‚â+‚â×‚æ'‚æ‚â#‚âƒ
Üƒ‚âW‚â‚âŸ‚â#‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âS‚æ‚â—‚æ'‚âŸ‚â‚âS‚â«‚æ#‚â‚â‚â·‚æ‚â·‚â‚â«‚âË‚â‚âs‚âç‚æ'‚â+‚â×‚æ'‚æ‚â#‚âœì(€€ ˆ‰Ñ¹±…É¥™äˆ¤¹‘¥Í…‰±•€ô€…l‰½Á•¸ˆ°€‰Á•¹‘¥¹}¹•áÑ}‘…ä‰t¹¥¹±Õ‘•Ì¡”¹ÍÑ…ÑÕÌ¤ì(€½¹ÍÐ±…É¥™¥…Ñ¥½¹M•¹‘MÑ…ÑÕÌ€ô‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð Àœ¤ì(€±…É¥™¥…Ñ¥½¹M•¹‘MÑ…ÑÕÌ¹¥€ô€±…É¥™¥…Ñ¥½¹M•¹‘MÑ…ÑÕÌœì(€±…É¥™¥…Ñ¥½¹M•¹‘MÑ…ÑÕÌ¹Í•ÑÑÑÉ¥‰ÕÑ” É½±”œ°ÍÑ…ÑÕÌœ¤ì(€±…É¥™¥…Ñ¥½¹M•¹‘MÑ…ÑÕÌ¹Í•ÑÑÑÉ¥‰ÕÑ” …É¥„µ±¥Ù”œ°Á½±¥Ñ”œ¤ì(€€ œ‰Ñ¹±…É¥™äœ¤¹Á…É•¹Ñ±•µ•¹Ð¹…™Ñ•È¡±…É¥™¥…Ñ¥½¹M•¹‘MÑ…ÑÕÌ¤ì(€€ ˆ‰Ñ¹±…É¥™äˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°…Íå¹Œ€¡•Ù•¹Ð¤€ôøì(€€€¥˜€ ……¸ ‰É•ÅÕ•ÍÑ}±…É¥™äˆ¤¤É•ÑÕÉ¸‘•¹ä ‹‚â«‚æ#‚â‚â+‚â×‚æ'‚æ‚â#‚âˆ¤ì(€€€¥˜¡”¹¡…ÍÙ¥‘•¹”€˜˜€…¥ÍU¹Í•¹Ñ±…É¥™¥…Ñ¥½¹…Í”¡”¤¥É•ÑÕÉ¸…Í•±½ÍÕÉ”¹½Á•¹MÕ‰µ¥Ð¡”¤¹…Ñ ¡•ÉÈôùÑ½…ÍÐ¡•ÉÈ¹µ•ÍÍ…”°Ý…É¸œ¤¤ì(€€€¥˜€ …l‰½Á•¸ˆ°€‰Á•¹‘¥¹}¹•áÑ}‘…ä‰t¹¥¹±Õ‘•Ì¡”¹ÍÑ…ÑÕÌ¤¤É•ÑÕÉ¸ì(€€€¥˜€  œ¹½Ñ•Q•áÐœ¤¹Ù…±Õ”¹ÑÉ¥´ ¤¤É•ÑÕÉ¸Ñ½…ÍÐ Ÿ‚â‡‚â×‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âS‚â‚âÏ‚â‚â·‚â_‚â×‚æ#‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚âk‚âÇ‚âg‚â_‚âÛ‚âƒ‚â‚â‚âã‚âO‚âË‚â‚âS‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âS‚â‚âÏ‚â‚â·‚â+‚â×‚æ'‚æ‚â#‚â‚â‚æ#‚â·‚âg‚â«‚æ#‚â‚æ‚â‚â¨œ°Ý…É¸œ¤ì(€€€½¹ÍÐÉ•ÅÕ•ÍÑ-•äõ…Í•U¥-•ä¡”¤ì(€€€¥˜¡±…É¥™¥…Ñ¥½¹I•ÅÕ•ÍÑ±¥¡ÑÌ¹¡…Ì¡É•ÅÕ•ÍÑ-•ä¤¥É•ÑÕÉ¸ì(€€€½¹ÍÐ½¹Ñ•áÐõ…ÁÑÕÉ•±…É¥™¥…Ñ¥½¹I•ÅÕ•ÍÑ½¹Ñ•áÐ¡”¤ì(€€€±…É¥™¥…Ñ¥½¹I•ÅÕ•ÍÑ±¥¡ÑÌ¹…‘¡É•ÅÕ•ÍÑ-•ä¤ì(€€€½¹ÍÐ‰ÕÑÑ½¸€ô•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ðì(€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ôÑÉÕ”ì(€€€½¹ÍÐÍ•¹‘MÑ…ÑÕÌ€ô€ œ±…É¥™¥…Ñ¥½¹M•¹‘MÑ…ÑÕÌœ¤ì(€€€¥˜¡Í•¹‘MÑ…ÑÕÌ¥Í•¹‘MÑ…ÑÕÌ¹Ñ•áÑ½¹Ñ•¹Ð€ô€Ÿ‚â‚âÏ‚â—‚âÇ‚â‚â«‚æ#‚â‚æ‚â—‚âÃ‚â·‚æ#‚âË‚âg‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â#‚âË‚â‚â‚âÃ‚âk‚âhƒŠPƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â[‚âß‚â·‚âŸ‚æ#‚âË‚â«‚æ#‚â‚â«‚âÏ‚æ‚â‚æ‚â œì(€€€ÑÉäì(€€€€€½¹ÍÐÁÉ•Ù¥½ÕÍMÑ…ÑÕÌõ”¹ÍÑ…ÑÕÌì(€€€€€±•Ð½¹™¥Éµ•‘I•ÅÕ•ÍÐì(€€€€€½¹ÍÐÉ•ÅÕ•ÍÑ•‘Ð€ô¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤ì(€€€€€½¹ÍÐÉ•ÅÕ•ÍÑ•‘	ä€ôÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€‰ÁÉ½‘ÕÑ¥½¸ˆ€üMˆ¹…ÕÑ¡UÍ•È ¤ü¹¥€è¹Õ±°ì(€€€€€¥˜€¡ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€‰ÁÉ½‘ÕÑ¥½¸ˆ¤ì(€€€€€€€¥˜€ …Mˆ¹Í¥¹•‘%¸ ¤ñð€…”¹‘‰%¤Ñ¡É½Ü¹•ÜÉÉ½È ‹‚âW‚æ'‚â·‚â‚æ‚â‚æ'‚âË‚â«‚âç‚æ#‚â‚âÃ‚âk‚âk‚æ‚â—‚âÃ‚æ‚â¯‚â—‚âS‚æ‚â‚â«‚â#‚â‚âÓ‚â‚â‚æ#‚â·‚âdˆ¤ì(€€€€€€€½¹™¥Éµ•‘I•ÅÕ•ÍÐõ…Ý…¥ÐMˆ¹É•ÅÕ•ÍÑ±…É¥™¥…Ñ¥½¸¡”¹‘‰%°”¹ÍÑ…ÑÕÌ°ì(€€€€€€€€€ÍÑ…ÑÕÌè€‰±…É¥™å¥¹œˆ°É•ÅÕ•ÍÑ•‘}…ÐèÉ•ÅÕ•ÍÑ•‘Ð°É•ÅÕ•ÍÑ•‘}‰äèÉ•ÅÕ•ÍÑ•‘	ä°ÕÁ‘…Ñ•‘}…ÐèÉ•ÅÕ•ÍÑ•‘Ð°(€€€€€€€ô¤ì(€€€€€ô(€€€€€”¹ÍÑ…ÑÕÌ€ô€‰±…É¥™å¥¹œˆì(€€€€€”¹É•ÅÕ•ÍÑ•‘Ð€ô½¹™¥Éµ•‘I•ÅÕ•ÍÐü¹É•ÅÕ•ÍÑ•‘}…ÐñðÉ•ÅÕ•ÍÑ•‘Ðì(€€€€€”¹É•ÅÕ•ÍÑ•‘	ä€ô½¹™¥Éµ•‘I•ÅÕ•ÍÐü¹É•ÅÕ•ÍÑ•‘}‰äñðÉ•ÅÕ•ÍÑ•‘	äì(€€€€€É•½É‘…Í•U¥I•ÍÕ±Ð¡”°€Ÿ‚â«‚æ#‚â‚æ‚â‚æ'‚âË‚â+‚â×‚â_‚â‚â·‚â+‚â×‚æ'‚æ‚â#‚â‚â«‚âÏ‚æ‚â‚æ‚â ƒŠPƒ‚â‚â·‚âs‚âç‚æ'‚â‡‚â×‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚âW‚â·‚âk‚â{‚â‚æ'‚â·‚â‡‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdœ¤ì(€€€€€Í…Ù•=Ù•ÉÉ¥‘”¡”°™…±Í”¤ì(€€€€€¥˜¡ÁÉ•Ù¥½ÕÍMÑ…ÑÕÌ„ôôÁ•¹‘¥¹}¹•áÑ}‘…äœñðÍÑ…Ñ”¹‘…Ñ…Í•Ð„ôô‰ÁÉ½‘ÕÑ¥½¸ˆ¤±½Ñ¥½¸ ‰É•ÅÕ•ÍÑ}±…É¥™äˆ°€‰•á•ÁÑ¥½¸ˆ°”¹¥°€‰Õ‘¥Ðƒ‚â‚â×‚âŸ‚âÓ‚âŸ‚æ‚â—‚æ'‚âœƒ‚â‚â·‚âs‚âç‚æ'‚â+‚â×‚æ'‚æ‚â#‚â‚âk‚â‚âÓ‚â§‚âÇ‚â\€ˆ€¬”¹½µÁ…¹ä¤ì(€€€€€Ñ½…ÍÐ ‹‚â«‚æ#‚â‚æ‚âo‚â+‚â×‚â_‚âW‚æ'‚â·‚â‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚â—‚æ'‚âœƒŠPƒ‚æ‚â+‚æ'‚æ‚â‚â«‚æ‚âS‚âÓ‚â„ƒ‚æ‚â‡‚æ#‚â«‚â‚æ'‚âË‚â‚â/‚æ'‚âÌˆ¤ì(€€€€€…Ý…¥ÐÍ¡½Ý±…É¥™¥…Ñ¥½¹I•ÅÕ•ÍÑI••¥ÁÐ¡”±½¹Ñ•áÐ¤ì(€€€ô…Ñ €¡•ÉÈ¤ì(€€€€€½¹ÍÐµ•ÍÍ…”€ô•ÉÈ¹µ•ÍÍ…”¹ÍÑ…ÉÑÍ]¥Ñ  Ÿ‚â‹‚âÇ‚â‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â‚âË‚â‚â«‚æ#‚â‚æ‚â‡‚æ#‚æ‚âS‚æ$œ¤€ü•ÉÈ¹µ•ÍÍ…”€è€Ÿ‚â‹‚âÇ‚â‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â‚âË‚â‚â«‚æ#‚â‚æ‚â‡‚æ#‚æ‚âS‚æ$ƒŠPƒ‚â‚â‚âã‚âO‚âË‚æ‚âo‚âÓ‚âS‚æ‚â‚â«‚â—‚æ#‚âË‚â«‚âã‚âS‚â‚æ#‚â·‚âg‚â—‚â·‚â‚æ‚â¯‚â‡‚æ è€œ€¬•ÉÈ¹µ•ÍÍ…”ì(€€€€€¥˜¡Í•¹‘MÑ…ÑÕÌ¥Í•¹‘MÑ…ÑÕÌ¹Ñ•áÑ½¹Ñ•¹Ð€ôµ•ÍÍ…”ì(€€€€€Ñ½…ÍÐ¡µ•ÍÍ…”°€‰Ý…É¸ˆ¤ì(€€€€€€¼¼-••ÀÑ¡¥Ì…ÑÑ•µÁÐ±½­•Õ¹Ñ¥°„™É•Í …Í”¥Ì±½…‘•¸Ñ¥µ•½ÕÐ…¸(€€€€€€¼¼¡…ÁÁ•¸…™Ñ•È½µµ¥Ð°Í¼…¸…ÕÑ½µ…Ñ¥Œ½È¥µµ•‘¥…Ñ”É•ÑÉä¥ÌÕ¹Í…™”¸(€€€ô™¥¹…±±äì(€€€€€±…É¥™¥…Ñ¥½¹I•ÅÕ•ÍÑ±¥¡ÑÌ¹‘•±•Ñ”¡É•ÅÕ•ÍÑ-•ä¤ì(€€€ô(€ô¤ì(€€ œÉ•ÍÁ½¹Í•Q•áÐœ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ¥¹ÁÕÐœ±•Ù•¹Ðôù”¹}±…É¥™¥…Ñ¥½¹É…™ÑQ•áÐõ•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¤ì(€¥˜¡½ÁÑ¥½¹Ì¹™½ÕÍI•ÍÁ½¹Í”¥Í•ÑQ¥µ•½ÕÐ  ¤ôø œ…Í•I•ÍÁ½¹Í•M•Ñ¥½¸œ¤ü¹ÍÉ½±±%¹Ñ½Y¥•Ü¡í‰•¡…Ù¥½ÈèÍµ½½Ñ œ±‰±½¬èÍÑ…ÉÐô¤°ÄÀÀ¤ì(€€ ˆ‰Ñ¹I•ÍÁ½¹ˆ¤¹‘¥Í…‰±•€ô€…±…É¥™¥…Ñ¥½¹±½Ü¹…¹I•ÍÁ½¹¡”¹ÍÑ…ÑÕÌ±ÍÑ…Ñ”¹É½±”¤ñð€„…”¹±…É¥™¥…Ñ¥½¹%¹ÍÑÉÕÑ¥½¹ÍÉÉ½Èñð€„…”¹±…É¥™¥…Ñ¥½¹!¥ÍÑ½ÉåÉÉ½Èñð€……¸ É•ÍÁ½¹œ¤ì(€€ ˆ‰Ñ¹I•ÍÁ½¹ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°…Íå¹Œ€¡•Ù•¹Ð¤€ôøì(€€€¥˜€ ……¸ ‰É•ÍÁ½¹ˆ¤¤É•ÑÕÉ¸‘•¹ä ‹‚âW‚â·‚âk‚â+‚â×‚æ'‚æ‚â#‚âˆ¤ì(€€€¥˜€ …±…É¥™¥…Ñ¥½¹±½Ü¹…¹I•ÍÁ½¹¡”¹ÍÑ…ÑÕÌ±ÍÑ…Ñ”¹É½±”¤¤É•ÑÕÉ¸ì(€€€¥˜¡”¹±…É¥™¥…Ñ¥½¹%¹ÍÑÉÕÑ¥½¹ÍÉÉ½È¤É•ÑÕÉ¸Ñ½…ÍÐ Ÿ‚â‹‚âÇ‚â‚â·‚æ#‚âË‚âg‚â‚âÏ‚â‚â·‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚â‡‚æ#‚æ‚âS‚æ$ƒ‚â‚â‚âã‚âO‚âË‚æ‚â¯‚â—‚âS‚æ‚â‚â«‚æ‚â¯‚â‡‚æ#‚â‚æ#‚â·‚âg‚âW‚â·‚âhœ°Ý…É¸œ¤ì(€€€½¹ÍÐ…¹ÍÝ•ÉQ•áÐ€ô€ ˆÉ•ÍÁ½¹Í•Q•áÐˆ¤¹Ù…±Õ”¹ÑÉ¥´ ¤ì(€€€¥˜€¡…¹ÍÝ•ÉQ•áÐ¹±•¹Ñ ðÄÁññ…¹ÍÝ•ÉQ•áÐ¹±•¹Ñ øÈÀÀÀ¤É•ÑÕÉ¸Ñ½…ÍÐ ‹‚â‚â‚â·‚â‚â«‚âË‚æ‚â¯‚âW‚âà€ÄÃŠLÈ°ÀÀÀƒ‚âW‚âÇ‚âŸ‚â·‚âÇ‚â‚â§‚â‚â‚æ#‚â·‚âg‚â«‚æ#‚âˆ°€‰Ý…É¸ˆ¤ì(€€€½¹ÍÐ…¹ÍÝ•É¥¹I½±”õÕÉÉ•¹ÑUÍ•È ¤¹É½±”ì(€€€½¹ÍÐÉ•ÍÁ½¹Í”õlµ½¹¥Ñ½Èœ°…Õ‘¥Ñ}…ÍÍ¥ÍÑ…¹Ðœ°±•…œ°…‘µ¥¸t¹¥¹±Õ‘•Ì¡…¹ÍÝ•É¥¹I½±”¤(€€€€€€üo‚â‚âÏ‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚âS‚âˆ€‘í…¹ÍÝ•É¥¹I½±”ôôô…‘µ¥¸œüŸ‚æ‚â·‚âS‚â‡‚âÓ‚âg‚â‚âÃ‚âk‚âhœèÕ‘¥ÐôƒŠPƒ‚æ‚â‡‚æ#‚æ‚â+‚æ#‚â‚âË‚â‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚âo‚âÓ‚âS‚æ‚â‚â©uq¸‘í…¹ÍÝ•ÉQ•áÑõ€€è…¹ÍÝ•ÉQ•áÐì(€€€½¹ÍÐÍ•±•Ñ•‘¥±•%õ”¹}±…É¥™¥…Ñ¥½¹É…™Ñ¥±”ü¹¥‘ññ”¹±…É¥™¥…Ñ¥½¹¥±•%ì(€€€¥˜€¡ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€‰ÁÉ½‘ÕÑ¥½¸ˆ€˜˜€…Í•±•Ñ•‘¥±•%€˜˜€„¡”¹•Ù¥‘•¹”ñðmt¤¹Í½µ”¡˜€ôø˜¹ÍÑ½É…•A…Ñ ¤¤É•ÑÕÉ¸Ñ½…ÍÐ ‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚æ‚â‚â—‚æ3‚â+‚â×‚æ'‚æ‚â#‚â‚â_‚â×‚æ#‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚âg‚â‚âÃ‚âk‚âhƒ‚â‚â‚âã‚âO‚âË‚æ‚â—‚âß‚â·‚â‚æ‚â‚â—‚æ3‚â¯‚â‚âß‚â·‚æ‚âg‚âk‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â‚æ#‚â·‚âg‚â«‚æ#‚âˆ°€‰Ý…É¸ˆ¤ì(€€€½¹ÍÐ‰ÕÑÑ½¸€ô•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ðì(€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ôÑÉÕ”ì(€€€ÑÉäì(€€€€€½¹ÍÐÍÑ…µÀ€ô¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤ì(€€€€€¥˜€¡ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€‰ÁÉ½‘ÕÑ¥½¸ˆ¤ì(€€€€€€€¥˜€ …Mˆ¹Í¥¹•‘%¸ ¤ñð€…”¹‘‰%¤Ñ¡É½Ü¹•ÜÉÉ½È ‹‚âW‚æ'‚â·‚â‚æ‚â‚æ'‚âË‚â«‚âç‚æ#‚â‚âÃ‚âk‚âk‚æ‚â—‚âÃ‚æ‚â¯‚â—‚âS‚æ‚â‚â«‚â#‚â‚âÓ‚â‚â‚æ#‚â·‚âdˆ¤ì(€€€€€€€¥˜¡”¹±…É¥™¥…Ñ¥½¹!¥ÍÑ½ÉåÉÉ½È¥Ñ¡É½ÜÉÉ½È Ÿ‚â‹‚âÇ‚â‚â·‚æ#‚âË‚âg‚â‚æ'‚â·‚â‚âŸ‚âË‚â‡‚æ‚âS‚âÓ‚â‡‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ƒ‚â‚â‚âã‚âO‚âË‚æ‚âo‚âÓ‚âS‚æ‚â‚â«‚æ‚â¯‚â‡‚æ#‚â‚æ#‚â·‚âg‚â«‚æ#‚âœ¤ì(€€€€€€€½¹ÍÐÍ…Ù•õ…Ý…¥ÐMˆ¹ÍÕ‰µ¥Ñ±…É¥™¥…Ñ¥½¹]¥Ñ¡¥±”¡”¹‘‰%±É•ÍÁ½¹Í”±Í•±•Ñ•‘¥±•%±”¹ÍÑ…ÑÕÌ±”¹±…É¥™¥…Ñ¥½¹¥±•%¤ì(€€€€€€€¥˜¡Í…Ù•¹¥„ôõ”¹‘‰%‘ññÍ…Ù•¹ÍÑ…ÑÕÌ„ôô…¹ÍÝ•É•ññÍ…Ù•¹É•ÍÁ½¹Í•}Ñ•áÐ„ôõÉ•ÍÁ½¹Í”¥Ñ¡É½ÜÉÉ½È Ÿ‚â‹‚âÇ‚â‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â‚âË‚â‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âÏ‚âW‚â·‚âk‚æ‚â‡‚æ#‚æ‚âS‚æ$œ¤ì(€€€€€€€”¹±…É¥™¥…Ñ¥½¹¥±•%õÍ…Ù•¹±…É¥™¥…Ñ¥½¹}™¥±•}¥ì(€€€€€ô(€€€€€‘•±•Ñ””¹}±…É¥™¥…Ñ¥½¹É…™Ñ¥±”í‘•±•Ñ””¹}±…É¥™¥…Ñ¥½¹É…™ÑQ•áÐì(€€€€€±•…ÉM…Ù•‘…Í•É…™Ð¡”°É•ÍÁ½¹Í”œ±…¹ÍÝ•ÉQ•áÐ¤ì(€€€€€”¹ÍÑ…ÑÕÌ€ô€‰…¹ÍÝ•É•ˆì(€€€€€”¹É•ÍÁ½¹Í•Q•áÐ€ôÉ•ÍÁ½¹Í”ì(€€€€€”¹É•ÍÁ½¹‘•‘Ð€ôÍÑ…µÀì(€€€€€”¹É•ÍÁ½¹‘•‘	ä€ôMˆ¹…ÕÑ¡UÍ•È ¤ü¹¥ñðÕÉÉ•¹ÑUÍ•È ¤¹ÕÍ•É¹…µ”ì(€€€€€É•½É‘…Í•U¥I•ÍÕ±Ð¡”°€Ÿ‚â«‚æ#‚â‚â‚âÏ‚â+‚â×‚æ'‚æ‚â#‚â‚â«‚âÏ‚æ‚â‚æ‚â ƒŠPƒ‚â‚â´Õ‘¥Ðƒ‚âW‚â‚âŸ‚â#‚â‚âÏ‚âW‚â·‚âhƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚âo‚âÓ‚âS‚æ‚â‚â¨œ¤ì(€€€€€Í…Ù•=Ù•ÉÉ¥‘”¡”°™…±Í”¤ì(€€€€€±½Ñ¥½¸ ‰É•ÍÁ½¹ˆ°€‰±…É¥™¥…Ñ¥½¸ˆ°”¹¥°€‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âÏ‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚â—‚æ'‚âœƒ‚â‚â´Õ‘¥Ðƒ‚âW‚â‚âŸ‚â#‚â‚âÏ‚âW‚â·‚âhˆ¤ì(€€€€€É•¹‘•È ¤ì(€€€€€…Ý…¥Ð½Á•¹á•ÁÑ¥½¸¡¥¤ì(€€€€€Í¡½Ý…Í•MÕ‰µ¥ÍÍ¥½¹I••¥ÁÐ ±…É¥™¥…Ñ¥½¸œ°”¹¥¤ì(€€€ô…Ñ €¡•ÉÈ¤ì(€€€€€Ñ½…ÍÐ ‹‚â‹‚âÇ‚â‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â‚âË‚â‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ$è€ˆ€¬•ÉÈ¹µ•ÍÍ…”°€‰Ý…É¸ˆ¤ì(€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ô™…±Í”ì(€€€ô(€ô¤ì(€€ ˆ‰Ñ¹…µ…”ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°…Íå¹Œ€ ¤€ôøì(€€€¥˜€¡ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€ÁÉ½‘ÕÑ¥½¸œ€˜˜lµ½¹¥Ñ½Èœ°…Õ‘¥Ñ}…ÍÍ¥ÍÑ…¹Ðœ°±•…œ°…‘µ¥¸t¹¥¹±Õ‘•Ì¡ÍÑ…Ñ”¹É½±”¤¤É•ÑÕÉ¸…Í•±½ÍÕÉ”¹½Á•¹MÕ‰µ¥Ð¡”°‘…µ…”œ¤ì(€€€¥˜€ ……¸ ‰±½Í•}…Í”ˆ¤¤É•ÑÕÉ¸‘•¹ä ‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆˆ¤ì(€€€¥˜€ …”¹¡…ÍÙ¥‘•¹”¤É•ÑÕÉ¸Ñ½…ÍÐ ‹‚âW‚æ'‚â·‚â‚â‡‚â×‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â‚æ#‚â·‚âg‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚âo‚æ‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆˆ°€‰Ý…É¸ˆ¤ì(€€€¥˜€¡”¹ÍÑ…ÑÕÌ€ôôô€‰‘…µ…”ˆ¤É•ÑÕÉ¸Ñ½…ÍÐ ‹‚æ‚â‚â«‚âg‚â×‚æ'‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚âo‚æ‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚â—‚æ'‚âœˆ¤ì(€€€½Á•¹5½‘…° ‹‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆˆ°€ñÀû‚â‚âÃ‚âk‚âã‚â‹‚â·‚âS‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â_‚â×‚æ#‚âW‚â‚âŸ‚â#‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â—‚æ'‚âœƒ‚æ‚â‡‚æ#‚æ‚â+‚æ#‚â‹‚â·‚âS‚â[‚â·‚âg‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âS‚â¯‚â‚âß‚â·‚â‹‚â·‚âS‚â_‚â×‚æ#‚â‚âÃ‚âk‚âk‚â‹‚âÇ‚â‚â#‚âÇ‚âk‚â‚âç‚æ#‚æ‚â‡‚æ#‚æ‚âS‚æ$ð½Àø(€€€€€€ñ±…‰•°û‚âo‚â‚âÃ‚æ‚âƒ‚â_‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆñÍ•±•Ð¥ô‰‘…µ…•…Ñ•½Éäˆøñ½ÁÑ¥½¸Ù…±Õ”ôˆˆû‚æ‚â—‚âß‚â·‚â‚âo‚â‚âÃ‚æ‚âƒ‚â\ð½½ÁÑ¥½¸ø‘í=‰©•Ð¹•¹ÑÉ¥•Ì¡…µ…•MÕµµ…Éä¹…Ñ•½É¥•Ì¤¹™¥±Ñ•È ¡m­•åt¤ôø…lÕ¹±…ÍÍ¥™¥•œ°ÍåÍÑ•´t¹¥¹±Õ‘•Ì¡­•ä¤¤¹µ…À ¡m­•ä±±…‰•±t¤ôù€ñ½ÁÑ¥½¸Ù…±Õ”ôˆ‘í­•åôˆø‘í ¡±…‰•°¥ôð½½ÁÑ¥½¸ù€¤¹©½¥¸ œœ¥ôð½Í•±•Ðøð½±…‰•°ø(€€€€€€ñ‘¥Ø±…ÍÌô‰‘…µ…”µ™½É´µÉ¥ˆøñ±…‰•°û‚â{‚âg‚âÇ‚â‚â‚âË‚âd€¼ƒ‚âs‚âç‚æ'‚æ‚â‚â×‚æ#‚â‹‚âŸ‚â‚æ'‚â·‚âñ¥¹ÁÕÐ¥ô‰‘…µ…•µÁ±½å•”ˆµ…á±•¹Ñ ôˆÈÀÀˆÁ±…•¡½±‘•Èô‹‚â‚â·‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âs‚âç‚æ'‚æ‚â‚â×‚æ#‚â‹‚âŸ‚â‚æ'‚â·‚âƒŠPƒ‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âã‚âs‚âç‚æ'‚â‚âÇ‚âk‚âs‚âÓ‚âS‚æ‚âS‚â‹‚æ‚âS‚âÈˆøð½±…‰•°ø(€€€€€€ñ±…‰•°û‚â‚âÃ‚â_‚âÏ‚â‚âË‚âdñÍ•±•Ð¥ô‰‘…µ…•M¡¥™Ðˆøñ½ÁÑ¥½¸Ù…±Õ”ôˆˆû‚æ‚â—‚âß‚â·‚â‚â‚âÃ‚â#‚âË‚â‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdð½½ÁÑ¥½¸øñ½ÁÑ¥½¸Ù…±Õ”ô‰‘…äˆû‚â‚âÃ‚æ‚â+‚æ'‚âÈ€ÀàèÀÃŠLÈÀèÀÀð½½ÁÑ¥½¸øñ½ÁÑ¥½¸Ù…±Õ”ô‰¹¥¡Ðˆû‚â‚âÃ‚âS‚âÛ‚â€ÈÀèÀÃŠLÀàèÀÀð½½ÁÑ¥½¸øð½Í•±•Ðøð½±…‰•°ø(€€€€€€ñ±…‰•°û‚æ‚âŸ‚â—‚âË‚â_‚â×‚æ#‚æ‚â‚âÓ‚âS‚æ‚â¯‚âW‚âàñ¥¹ÁÕÐ¥ô‰‘…µ…•Q¥µ”ˆÑåÁ”ô‰Ñ¥µ”ˆÍÑ•ÀôˆÄˆÙ…±Õ”ôˆ‘í  ½yq‘ìÉôéq‘ìÉô éq‘ìÉô¤ü¼¹Ñ•ÍÐ¡”¹Ñ¥µ”ñð€œœ¤€ü”¹Ñ¥µ”€è€œœ¥ôˆøð½±…‰•°øð½‘¥Øø(€€€€€€ñÀ±…ÍÌô‰¡¥¹Ðˆû‚âW‚â‚âŸ‚â#‚â«‚â·‚âk‚â+‚âß‚æ#‚â·‚æ‚â—‚âÃ‚â‚âÃ‚â#‚âË‚â‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdƒ‚âLƒ‚âŸ‚âÇ‚âg‚â_‚â×‚æ#‚æ‚â‚âÓ‚âS‚æ‚â¯‚âW‚âàƒ‚æ‚â‡‚æ#‚æ‚â+‚æ'‚âs‚âç‚æ'‚âW‚â‚âŸ‚â#‚â¯‚â‚âß‚â·‚âs‚âç‚æ'‚æ‚âg‚âk‚æ‚â·‚â‚â«‚âË‚â‚æ‚â_‚âg‚âs‚âç‚æ'‚æ‚â‚â×‚æ#‚â‹‚âŸ‚â‚æ'‚â·‚âƒ‚æ‚âŸ‚â—‚âË‚â_‚â×‚æ#‚æ‚â‡‚æ#‚â_‚â‚âË‚âk‚æ‚â¯‚æ'‚æ‚âŸ‚æ'‚âg‚âŸ‚æ#‚âË‚âƒ‚æ‚â‡‚æ#‚æ‚â+‚æ$€ÀÀèÀÀƒ‚æ‚â_‚âdð½Àø(€€€€€€ñ±…‰•°û‚â‹‚â·‚âS‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â_‚â×‚æ#‚â‹‚âß‚âg‚â‹‚âÇ‚âd€£‚âk‚âË‚â\¤ñ¥¹ÁÕÐ¥ô‰‘…µ…•½¹™¥Éµ•‘µ½Õ¹ÐˆÑåÁ”ô‰¹Õµ‰•Èˆµ¥¸ôˆÀ¸ÀÄˆÍÑ•ÀôˆÀ¸ÀÄˆ¥¹ÁÕÑµ½‘”ô‰‘•¥µ…°ˆøð½±…‰•°ø(€€€€€€ñ±…‰•°û‚â«‚âË‚æ‚â¯‚âW‚âà€¼ƒ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â·‚æ'‚âË‚â‚â·‚âÓ‚âñÑ•áÑ…É•„¥ô‰‘…µ…•½¹™¥Éµ•‘…ÕÍ”ˆø‘í ¡”¹…ÕÍ”ñð€œœ¥ôð½Ñ•áÑ…É•„øð½±…‰•°ø(€€€€€€ñÀ±…ÍÌô‰¡¥¹Ðˆû‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â‚æ'‚âË‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚æ‚â_‚æ#‚âË‚âg‚âÇ‚æ'‚âdƒ‚æ‚â‡‚æ#‚â«‚æ#‚â‚â‚æ'‚â·‚â‚âŸ‚âË‚â‡‚æ‚â¯‚æ'‚âk‚âã‚â‚â‚â—‚â¯‚â‚âß‚â·‚â‚âË‚â‚æ‚â‚âÓ‚âdð½Àù€°€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰‘…µ…•…¹•°ˆû‚â‹‚â‚æ‚â—‚âÓ‚âð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ¥ô‰‘…µ…•½¹™¥É´ˆû‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âk‚âÇ‚âg‚â_‚âÛ‚âð½‰ÕÑÑ½¸ù€¤ì(€€€€ ˆ‘…µ…•…¹•°ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°±½Í•5½‘…°¤ì(€€€€ ˆ‘…µ…•½¹™¥É´ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°…Íå¹Œ€¡•Ù•¹Ð¤€ôøì(€€€±•Ð½¹™¥Éµ•‘…ÕÍ”ì(€€€½¹ÍÐ½¹™¥Éµ•‘•¹ÑÌ€ô…µ…•MÕµµ…Éä¹•¹ÑÌ  ˆ‘…µ…•½¹™¥Éµ•‘µ½Õ¹Ðˆ¤¹Ù…±Õ”¤ì(€€€¥˜€¡½¹™¥Éµ•‘•¹ÑÌ€ôôô¹Õ±°ñð½¹™¥Éµ•‘•¹ÑÌ€ðô€À¤É•ÑÕÉ¸Ñ½…ÍÐ ‹‚â‚â‚â·‚â‚â‹‚â·‚âS‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â‡‚âË‚â‚â‚âŸ‚æ#‚âÈ€Àƒ‚æ‚â—‚âÃ‚æ‚â‡‚æ#‚æ‚â‚âÓ‚âd€Èƒ‚âW‚âÏ‚æ‚â¯‚âg‚æ#‚â‚â_‚â£‚âg‚âÓ‚â‹‚â„ˆ°€‰Ý…É¸ˆ¤ì(€€€ÑÉäì½¹™¥Éµ•‘…ÕÍ”€ô…µ…•MÕµµ…Éä¹•¹½‘••Ñ…¥±Ì  ˆ‘…µ…•…Ñ•½Éäˆ¤¹Ù…±Õ”°€ ˆ‘…µ…•½¹™¥Éµ•‘…ÕÍ”ˆ¤¹Ù…±Õ”¤ìô(€€€…Ñ €¡•ÉÉ½È¤ìÉ•ÑÕÉ¸Ñ½…ÍÐ¡•ÉÉ½È¹µ•ÍÍ…”°€‰Ý…É¸ˆ¤ìô(€€€¥˜€  œ‘…µ…•…Ñ•½Éäœ¤¹Ù…±Õ”ôôô•µÁ±½å•”œ€˜˜€ „ œ‘…µ…•µÁ±½å•”œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤ñð€……µ…•MÕµµ…Éä¹Í¡¥™Ñ-•ä¡íÍ¡¥™Ðè œ‘…µ…•M¡¥™Ðœ¤¹Ù…±Õ•ô¤(€€€€€€€ñðlœ´œ°Ÿ‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âàœ°Ÿ‚â‚â·‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âs‚âç‚æ'‚æ‚â‚â×‚æ#‚â‹‚âŸ‚â‚æ'‚â·‚ât¹¥¹±Õ‘•Ì  œ‘…µ…•µÁ±½å•”œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤¤(€€€€€€€ñðlœ´œ°Ÿ‚â‚â·‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â‚âÀt¹¥¹±Õ‘•Ì  œ‘…µ…•M¡¥™Ðœ¤¹Ù…±Õ”¹ÑÉ¥´ ¤¤¤¤É•ÑÕÉ¸Ñ½…ÍÐ Ÿ‚âo‚â‚âÃ‚æ‚âƒ‚â_‚â{‚âg‚âÇ‚â‚â‚âË‚âg‚âW‚æ'‚â·‚â‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â+‚âß‚æ#‚â·‚æ‚â—‚âÃ‚â‚âÃ‚â#‚âË‚â‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â‚æ#‚â·‚âdƒ‚æ‚â{‚âß‚æ#‚â·‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âã‚âs‚âÓ‚âS‚â‚âdœ°Ý…É¸œ¤ì(€€€¥˜€¡ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€ÁÉ½‘ÕÑ¥½¸œ€˜˜€ …Mˆ¹Í¥¹•‘%¸ ¤ñð€…”¹‘‰%¤¤É•ÑÕÉ¸Ñ½…ÍÐ Ÿ‚âW‚æ'‚â·‚â‚æ‚â‚æ'‚âË‚â«‚âç‚æ#‚â‚âÃ‚âk‚âk‚æ‚â—‚âÃ‚æ‚â¯‚â—‚âS‚æ‚â‚â«‚â#‚â‚âÓ‚â‚â‚æ#‚â·‚âdœ°€Ý…É¸œ¤ì(€€€•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ð¹‘¥Í…‰±•€ôÑÉÕ”ì(€€€¥˜€¡”¹ÍÑ…ÑÕÌ€„ôô€‰‘…µ…”ˆ¤ì(€€€€€½¹ÍÐÁÉ•Ù¥½ÕÍMÑ…ÑÕÌ€ô”¹ÍÑ…ÑÕÌì(€€€€€½¹ÍÐ‘…µ…”€ôì(€€€€€€€¥è€‰5´ˆ€¬€¡”¹‘‰%ñð”¹¥¤°(€€€€€€€•á•ÁÑ¥½¹%è”¹¥°(€€€€€€€‘…Ñ”è”¹‘…Ñ”°(€€€€€€€½µÁ…¹äè”¹½µÁ…¹ä°(€€€€€€€•µÁ±½å•”è€ ˆ‘…µ…•µÁ±½å•”ˆ¤¹Ù…±Õ”¹ÑÉ¥´ ¤°(€€€€€€€Í¡¥™Ðè€ ˆ‘…µ…•M¡¥™Ðˆ¤¹Ù…±Õ”¹ÑÉ¥´ ¤°(€€€€€€€Ñ¥µ”è€ ˆ‘…µ…•Q¥µ”ˆ¤¹Ù…±Õ”°(€€€€€€€…µ½Õ¹Ðè½¹™¥Éµ•‘•¹ÑÌ€¼€ÄÀÀ°(€€€€€€€…ÕÍ”è½¹™¥Éµ•‘…ÕÍ”°(€€€€€€€å±”è9Õµ‰•È¡”¹‘…Ñ”ü¹Í±¥” à°ÄÀ¤¤€ðô€ÄÔ€ü€‰Äˆ€è9Õµ‰•È¡”¹‘…Ñ”ü¹Í±¥” à°ÄÀ¤¤€ðô€ÈÔ€ü€‰Èˆ€è€‰Ìˆ°(€€€€€€€•Ù¥‘•¹”èÑÉÕ”°(€€€€€€€¡ÉMÑ…ÑÕÌè€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â«‚æ#‚â‚âk‚âã‚â‚â‚â”ˆ°(€€€€€€€™¥¹…¹•MÑ…ÑÕÌè€‹‚â‚â·‚âo‚âÓ‚âS‚â‚â·‚âhˆ°(€€€€€ôì(€€€€€¥˜€¡ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€‰ÁÉ½‘ÕÑ¥½¸ˆ€˜˜Mˆ¹Í¥¹•‘%¸ ¤¤ì(€€€€€€€ÑÉäì(€€€€€€€€€½¹ÍÐÍ…Ù•€ô…Ý…¥ÐMˆ¹½¹™¥Éµ…µ…”¡”¹‘‰%°ÁÉ•Ù¥½ÕÍMÑ…ÑÕÌ°‘…µ…”¹…µ½Õ¹Ð°‘…µ…”¹…ÕÍ”°‘…µ…”¤ì(€€€€€€€€€‘…µ…”¹‘‰%€ôÍ…Ù•¹¥ì(€€€€€€€ô…Ñ €¡•ÉÈ¤ì(€€€€€€€€€Ñ½…ÍÐ ‹‚â‹‚âÇ‚â‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âs‚â—‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ$ƒ‚â‚â‚âã‚âO‚âË‚â‚â×‚æ‚â‚â‚â+‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚â‚æ#‚â·‚âg‚â—‚â·‚â‚æ‚â¯‚â‡‚æ è€ˆ€¬•ÉÈ¹µ•ÍÍ…”°€‰Ý…É¸ˆ¤ì(€€€€€€€€€±½Í•5½‘…° ¤ì(€€€€€€€€€½Á•¹á•ÁÑ¥½¸¡¥¤ì(€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€”¹ÍÑ…ÑÕÌ€ô€‰‘…µ…”ˆì(€€€€€€€É•½É‘…Í•U¥I•ÍÕ±Ð¡”°€Ÿ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â«‚âÏ‚æ‚â‚æ‚â ƒŠPƒ‚âS‚âç‚â‚âË‚â‹‚â‚âË‚â‚æ‚âg‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆœ¤ì(€€€€€€€¹‘…µ…•Ì¹ÁÕÍ ¡‘…µ…”¤ì(€€€€€€€Í…Ù•=Ù•ÉÉ¥‘”¡”°™…±Í”¤ì(€€€€€€€±½Ñ¥½¸ ‰‘…µ…”ˆ°€‰‘…µ…•}É•½Éˆ°”¹¥°€‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆ€ˆ€¬µ½¹•ä¡‘…µ…”¹…µ½Õ¹Ð¤€¬€ˆƒ‚âk‚âË‚â\ˆ¤ì(€€€€€€€…Ý…¥Ð±½…‘1¥Ù•…µ…”¡ÑÉÕ”¤¹…Ñ   ¤€ôøÑ½…ÍÐ Ÿ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â—‚æ'‚âœƒ‚æ‚âW‚æ#‚æ‚â¯‚â—‚âS‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚æ‚â¯‚â‡‚æ#‚æ‚â‡‚æ#‚æ‚âS‚æ$ƒ‚â‚â‚âã‚âO‚âË‚â‚â×‚æ‚â‚â‚â(œ°€Ý…É¸œ¤¤ì(€€€€€€€±½…‘1¥Ù•=Ù•ÉÙ¥•Ü¡ÑÉÕ”¤ì(€€€€€€€Ñ½…ÍÐ ‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â‚æ'‚âË‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚â—‚æ'‚âœˆ¤ì(€€€€€ô•±Í”ì(€€€€€€€”¹ÍÑ…ÑÕÌ€ô€‰‘…µ…”ˆì(€€€€€€€É•½É‘…Í•U¥I•ÍÕ±Ð¡”°€Ÿ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚âg‚â‚æ'‚â·‚â‡‚âç‚â—‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚â‚æ‚â—‚æ'‚âœœ¤ì(€€€€€€€¹‘…µ…•Ì¹ÁÕÍ ¡‘…µ…”¤ì(€€€€€€€MÑ½É”¹‘…Ñ„¹•áÑÉ……µ…•Ì¹ÁÕÍ ¡‘…µ…”¤ì(€€€€€€€Í…Ù•=Ù•ÉÉ¥‘”¡”¤ì(€€€€€€€±½Ñ¥½¸ ‰‘…µ…”ˆ°€‰‘…µ…•}É•½Éˆ°”¹¥°€‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆ€ˆ€¬µ½¹•ä¡‘…µ…”¹…µ½Õ¹Ð¤€¬€ˆƒ‚âk‚âË‚â\ˆ¤ì(€€€€€€€Ñ½…ÍÐ ‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â‚æ'‚âË‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚â—‚æ'‚âœˆ¤ì(€€€€€ô(€€€ô(€€€±½Í•5½‘…° ¤ì(€€€½Á•¹á•ÁÑ¥½¸¡¥¤ì(€€€ô¤ì(€ô¤ì(€€ ˆ‰Ñ¹ÁÁÉ½Ù”ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°…Íå¹Œ€ ¤€ôøì(€€€¥˜€ ……¸ ‰…ÁÁÉ½Ù”ˆ¤¤É•ÑÕÉ¸‘•¹ä ‹‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÐ¿‚âo‚âÓ‚âS‚æ‚â‚â¨ˆ¤ì(€€€¥˜€¡ÅÕ¥­±½Í•±¥¥‰±”¤É•ÑÕÉ¸½¹™¥ÉµEÕ¥­±½Í”¡”¤ì(€€€¥˜€¡ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€ÁÉ½‘ÕÑ¥½¸œ¤ì(€€€€€¥˜€ …±½ÍÕÉ•I•Ù¥•ÝI•…‘ä¤É•ÑÕÉ¸Ñ½…ÍÐ ‹‚â‚æ'‚â·‚â‡‚âç‚â—‚â¯‚â‚âß‚â·‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‚â‚âhƒ‚æ‚âo‚âÓ‚âS‚â‚âÇ‚æ'‚âg‚âW‚â·‚âg‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âs‚â—‚æ‚â‡‚æ#‚æ‚âS‚æ$ˆ°€‰Ý…É¸ˆ¤ì(€€€€€É•ÑÕÉ¸…Í•±½ÍÕÉ”¹½Á•¹MÕ‰µ¥Ð¡”¤ì(€€€ô(€€€¥˜€ …±½ÍÕÉ•Ñ¥½¹I•…‘ä¤É•ÑÕÉ¸Ñ½…ÍÐ ‹‚æ‚â+‚æ‚â‚â—‚âÓ‚â«‚âW‚æ3‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‚â‚âhƒ‚âo‚âÓ‚âS‚æ‚â‚â«‚æ‚â‡‚æ#‚æ‚âS‚æ$ˆ°€‰Ý…É¸ˆ¤ì(€€€¥˜€ ……Ý…¥ÐÁ•ÉÍ¥ÍÑ…Í•±½ÍÕÉ”¡”°”¹É•Í½±ÕÑ¥½¹9½Ñ”ñð”¹¹½Ñ•Ì¹µ…À ¡¹½Ñ”¤€ôø¹½Ñ”¹Ñ•áÐ¤¹™¥±Ñ•È¡	½½±•…¸¤¹©½¥¸ ‰q¸ˆ¤¤¤É•ÑÕÉ¸ì(€€€±½Ñ¥½¸ ‰…ÁÁÉ½Ù”ˆ°€‰•á•ÁÑ¥½¸ˆ°”¹¥°€‹‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚æ‚â—‚âÃ‚âo‚âÓ‚âS‚æ‚â‚â¨ˆ¤ì(€€€Ñ½…ÍÐ ‹‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚æ‚â—‚âÃ‚âo‚âÓ‚âS‚æ‚â‚â¨€ˆ€¬”¹¥€¬€ˆƒ‚æ‚â—‚æ'‚âœˆ¤ì(€€€É•¹‘•È ¤ì(€€€…Ý…¥Ð½Á•¹á•ÁÑ¥½¸¡”¹¥¤ì(€ô¤ì((€½¹ÍÐ…Ñ”€ôì‰Ñ¹9½Ñ”è€‰¹½Ñ”ˆ°‰Ñ¹±…É¥™äè€‰É•ÅÕ•ÍÑ}±…É¥™äˆ°‰Ñ¹I•ÍÁ½¹è€‰É•ÍÁ½¹ˆ°‰Ñ¹…µ…”è€‰±½Í•}…Í”ˆ°‰Ñ¹ÁÁÉ½Ù”è€‰…ÁÁÉ½Ù”ˆ°‰Ñ¹½I•Äè€‰É•ÅÕ•ÍÑ}±…É¥™äˆôì(€¥˜¡”¹É•Ù¥•Ý!½±¤™½È¡½¹ÍÐ¥½˜l‰Ñ¹ÁÁÉ½Ù”œ°‰Ñ¹…µ…”t¤í½¹ÍÐ‰ÕÑÑ½¸ô œŒœ­¥¤í¥˜¡‰ÕÑÑ½¸¥í‰ÕÑÑ½¸¹‘¥Í…‰±•õÑÉÕ”í‰ÕÑÑ½¸¹Ñ¥Ñ±”õ½Õ¹ÑI•Ù¥•Ý!½±‘Ì¹±…‰•°íõô(€=‰©•Ð¹•¹ÑÉ¥•Ì¡…Ñ”¤¹™½É…  ¡m‰Ñ¸°…Át¤€ôøì(€€€½¹ÍÐ•°€ô€ ˆŒˆ€¬‰Ñ¸¤ì(€€€¥˜€ ……¸¡…À¤¤ì(€€€€€•°¹±…ÍÍ1¥ÍÐ¹…‘ ‰±½­•ˆ¤ì(€€€€€•°¹‘¥Í…‰±•€ôÑÉÕ”ì(€€€€€•°¹Ñ¥Ñ±”€ôƒ‚âW‚æ'‚â·‚â‚â‡‚â×‚â«‚âÓ‚â_‚âc‚âÓ‚æ0è€‘í…Áô€£‚âk‚â_‚âk‚âË‚â_‚âo‚âÇ‚â#‚â#‚âã‚âk‚âÇ‚âd€‘í¹É½±•ÍmÍÑ…Ñ”¹É½±•t¹¹…µ•ôƒ‚æ‚â‡‚æ#‚â‡‚â×‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚âg‚â×‚æ$¥€ì(€€€ô(€ô¤ì(€¥˜¡…Í•=Á•¹Q¥­•ÐôôõÑ¥­•Ð¥…Í•=Á•¹Q¥­•Ðõ¹Õ±°ì(€ô¤ ¤ì(€É•ÑÕÉ¸Ñ¥­•Ð¹ÁÉ½µ¥Í”ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸½Á•¹ÁÁÉ½Ù…±I•Ù¥•Ü¡•á•ÁÑ¥½¹%°­¥¹°É•ÅÕ•ÍÑ%¤ì(€¥˜€ ……¸ …ÁÁÉ½Ù”œ¤¤É•ÑÕÉ¸Ñ½…ÍÐ Ÿ‚æ‚â'‚â{‚âË‚âÃ‚â¯‚âÇ‚âŸ‚â¯‚âg‚æ'‚âË‚â_‚â×‚â„€¼ƒ‚âs‚âç‚æ'‚âS‚âç‚æ‚â—‚â‚âÃ‚âk‚âk‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚æ‚âS‚æ$œ°€Ý…É¸œ¤ì(€½¹ÍÐÉ½Ü€ô…Ý…¥ÐMˆ¹•á•ÁÑ¥½¹•Ñ…¥°¡•á•ÁÑ¥½¹%¤ì(€¥˜€ …É½Ü¤Ñ¡É½Ü¹•ÜÉÉ½È Ÿ‚æ‚â‡‚æ#‚â{‚âk‚æ‚â‚â«‚â‚â·‚â‚â‚âÏ‚â‚â·‚âg‚â×‚æ$ƒ‚â‚â‚âã‚âO‚âË‚â‚â×‚æ‚â‚â‚â+‚â‚âÓ‚âœœ¤ì(€½¹ÍÐ”€ôµ…Á1¥Ù•á•ÁÑ¥½¸¡É½Ü¤ì(€€¼¼Q¡”ÅÕ•Õ”¥‘•¹Ñ¥™¥•Ì„É•ÅÕ•ÍÐ°¹½Ð©ÕÍÐ„…Í”Ý¡½Í”Á½¥¹Ñ•Èµ…ä¡…¹”¸(€¥˜€¡­¥¹€ôôô€±½ÍÕÉ”œ€˜˜É•ÅÕ•ÍÑ%¤”¹±½ÍÕÉ•I•ÅÕ•ÍÑ%€ôÉ•ÅÕ•ÍÑ%ì(€½Á•¹5½‘…° Ÿ‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÐœ°€œñ‘¥Ø¥ô‰…ÁÁÉ½Ù…±EÕ•Õ•I•Ù¥•Üˆøð½‘¥Øøœ°€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰…ÁÁÉ½Ù…±I•Ù¥•ÝÙ¥‘•¹”ˆû‚âS‚âç‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âS‚æ‚â—‚âÃ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰…ÁÁÉ½Ù…±I•Ù¥•Ý…¹•°ˆû‚â‹‚â‚æ‚â—‚âÓ‚âð½‰ÕÑÑ½¸øœ¤ì(€€ œ…ÁÁÉ½Ù…±I•Ù¥•Ý…¹•°œ¤¹½¹±¥¬€ô±½Í•5½‘…°ì(€€ œ…ÁÁÉ½Ù…±I•Ù¥•ÝÙ¥‘•¹”œ¤¹½¹±¥¬€ô…Íå¹Œ€ ¤€ôøì(€€€±½Í•5½‘…° ¤ì(€€€ÑÉäì…Ý…¥Ð½Á•¹Ù¥‘•¹•I•±…Ñ•‘…Í”¡•á•ÁÑ¥½¹%°í™½ÕÍ¥±•ÌéÑÉÕ•ô¤ìô(€€€…Ñ €¡•ÉÈ¤ìÑ½…ÍÐ¡•ÉÈ¹µ•ÍÍ…”°€Ý…É¸œ¤ìô(€ôì(€½¹ÍÐ¡½ÍÐ€ô€ œ…ÁÁÉ½Ù…±EÕ•Õ•I•Ù¥•Üœ¤ì(€…Ý…¥Ð€¡­¥¹€ôôô€Á…¥Èœ€ü5…¹Õ…±A…¥É¥¹œ€è…Í•±½ÍÕÉ”¤¹µ½Õ¹ÑI•Ù¥•Ü¡”°¡½ÍÐ¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸É•™É•Í¡…Í•Y¥•Ü ¤ì(€½¹ÍÐÉ½½Ð€ô€ œÙ¥•ÝI½½Ðœ¤ì(€¥˜¡ÍÑ…Ñ”¹É½ÕÑ”ôôô…Õ‘¥ÐµÉ•Ù¥•Üœ˜™ÑåÁ•½˜É½½Ðü¹…Õ‘¥ÑEÕ•Õ•UÁ‘…Ñ•%¹A±…”ôôô™Õ¹Ñ¥½¸œ¥ì(€€€É½½Ð¹…Õ‘¥ÑEÕ•Õ•UÁ‘…Ñ•%¹A±…” ¤íÉ•ÑÕÉ¸ì(€ô(€€¼¼Q¡”½µÁ…¹äÉ•Ù¥•Ü€¼á•°Ñ…‰±”¥Ìµ½Õ¹Ñ•¥¹Í¥‘”…Õ‘¥ÑY¥•Ý	½‘ä¸(€€¼¼I•™É•Í ¥ÑÌ•á¥ÍÑ¥¹œ¥¹ÍÑ…¹”É…Ñ¡•ÈÑ¡…¸É•µ½Õ¹Ñ¥¹œÑ¡”Á…É•¹ÐÍ¡•±°¸(€½¹ÍÐÝ½É­ÍÁ…”€ôÑåÁ•½˜É½½Ðü¹…Õ‘¥ÑI•™É•Í¡%¹A±…”€ôôô€™Õ¹Ñ¥½¸œ(€€€€üÉ½½Ð€èÉ½½Ðü¹ÅÕ•ÉåM•±•Ñ½Èü¸ œ…Õ‘¥ÑY¥•Ý	½‘äœ¤ì(€¥˜€¡ÑåÁ•½˜Ý½É­ÍÁ…”ü¹…Õ‘¥ÑI•™É•Í¡%¹A±…”€ôôô€™Õ¹Ñ¥½¸œ¤ì(€€€…Ý…¥ÐÝ½É­ÍÁ…”¹…Õ‘¥ÑI•™É•Í¡%¹A±…” ¤ì(€€€É•ÑÕÉ¸ì€¼¼%¹…Ñ¥Ù”½ÍÑ…±”¥¹ÍÑ…¹”¥Ì¹½ÐÁ•Éµ¥ÍÍ¥½¸Ñ¼É•‘É…Ü„¹•ÜÁ…”¸(€ô(€½¹ÍÐà€ôÝ¥¹‘½Ü¹ÍÉ½±±`°ä€ôÝ¥¹‘½Ü¹ÍÉ½±±dì(€É•¹‘•È ¤ì(€Ý¥¹‘½Ü¹ÍÉ½±±Q¼¡à°ä¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸™¥¹¥Í¡ÁÁÉ½Ù…±I•Ù¥•Ü ¤ì(€€¼¼Í…Ù•‘•¥Í¥½¸µÕÍÐ¹½ÐÉ•½Á•¸Ñ¡”½±…Í”½ÈÍ•¹Ñ¡”¡•……Ý…ä(€€¼¼™É½´Ñ¡”ÅÕ•Õ”¸É•™É•Í ™…¥±ÕÉ”¥Ì¹½Ð„™…¥±•‘…Ñ…‰…Í”‘•¥Í¥½¸¸(€±½Í•5½‘…° ¤ì(€±½Í•É…Ý•È ¤ì(€½¹ÍÐÍ…Ù•‘I½ÕÑ”õÍÑ…Ñ”¹É½ÕÑ”ì(€ÑÉäì(€€€¥˜¡ÑåÁ•½˜±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”„ôôÕ¹‘•™¥¹•œ¥ì(€€€€€½¹ÍÐ‘•…‘±¥¹”õ…Ñ”¹¹½Ü ¤¬ÌÀÀÀÀì(€€€€€Ý¡¥±”¡±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹±½…‘¥¹ññ±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹…Õá¥±¥…Éå1½…‘¥¹œ¥ì(€€€€€€€¥˜¡…Ñ”¹¹½Ü ¤ù‘•…‘±¥¹”¥Ñ¡É½ÜÉÉ½È Ÿ‚â‚â·‚âk‚æ‚â¯‚â—‚âS‚â‚æ#‚â·‚âg‚â¯‚âg‚æ'‚âË‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚â«‚â‚æ‚â œ¤ì(€€€€€€€…Ý…¥Ð¹•ÜAÉ½µ¥Í”¡É•Í½±Ù”ôùÍ•ÑQ¥µ•½ÕÐ¡É•Í½±Ù”°ÄÀÀ¤¤ì(€€€€€ô(€€€ô(€€€¥˜¡ÑåÁ•½˜±¥Ù•EÕ•Õ•I½ÕÑ”ôôô™Õ¹Ñ¥½¸œ˜™±¥Ù•EÕ•Õ•I½ÕÑ” ¤¥ì(€€€€€™½È¡½¹ÍÐÅÕ•Õ”½˜m…Í•±½ÍÕÉ”±5…¹Õ…±A…¥É¥¹œ±É½ÍÍ…å]½É­‰•¹¡t¥ÅÕ•Õ”¹ÅÕ•Õ•MÑ…Ñ”¹…ÐôÀì(€€€ô(€€€…Ý…¥Ð±½…‘1¥Ù•=Ù•ÉÙ¥•Ü¡ÑÉÕ”¤ì(€€€¥˜¡ÍÑ…Ñ”¹É½ÕÑ”„ôõÍ…Ù•‘I½ÕÑ”¥É•ÑÕÉ¸ÑÉÕ”ì(€€€¥˜¡ÑåÁ•½˜±¥Ù•EÕ•Õ•I½ÕÑ”ôôô™Õ¹Ñ¥½¸œ˜™±¥Ù•EÕ•Õ•I½ÕÑ” ¤˜™±¥Ù•EÕ•Õ•AÉ½Ñ•Ñ• ¤¥ì(€€€€€±¥Ù•EÕ•Õ•UÁ‘…Ñ•A•¹‘¥¹œõÑÉÕ”íÉ•ÑÕÉ¸ÑÉÕ”ì(€€€ô(€€€…Ý…¥ÐÉ•™É•Í¡…Í•Y¥•Ü ¤ì(€€€É•ÑÕÉ¸ÑÉÕ”ì(€ô(€…Ñ €¡•ÉÈ¤ìÑ½…ÍÐ Ÿ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚æ‚â—‚æ'‚âœƒ‚æ‚âW‚æ#‚æ‚â¯‚â—‚âS‚âƒ‚âË‚â{‚â‚âŸ‚â‡‚æ‚â¯‚â‡‚æ#‚æ‚â‡‚æ#‚æ‚âS‚æ$ƒ‚â‚â‚âã‚âO‚âË‚â‚â×‚æ‚â‚â‚â+‚â‚âÓ‚âœè€œ€¬•ÉÈ¹µ•ÍÍ…”°€Ý…É¸œ¤ìÉ•ÑÕÉ¸™…±Í”ìô)ô)™Õ¹Ñ¥½¸±½Í•É…Ý•È ¤ì(€…ÁÑÕÉ•…Í•=Á•¹É…™Ð ¤ì(€…Í•=Á•¹Q¥­•Ðõ¹Õ±°ì(€½¹ÍÐ€ô€ ˆ‘É…Ý•Èˆ¤ì(€¥˜€ …ñð¹¡¥‘‘•¸¤É•ÑÕÉ¸ì(€¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰½¸ˆ¤ì(€€ ˆ‘É…Ý•É=Ù•É±…äˆ¤¹¡¥‘‘•¸€ôÑÉÕ”ì(€Õ‘¥ÑU¤¹±½Í”¡¤ì(€±•…ÉQ¥µ•½ÕÐ¡¹}¡¥‘•Q¥µ•È¤ì(€¹}¡¥‘•Q¥µ•È€ôÍ•ÑQ¥µ•½ÕÐ  ¤€ôøì¹¡¥‘‘•¸€ôÑÉÕ”ì¹}¡¥‘•Q¥µ•È€ô¹Õ±°ìô°€ÈÈÀ¤ì)ô)‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰­•å‘½Ý¸ˆ°€¡”¤€ôøì(€¥˜€¡”¹­•ä€ôôô€‰Í…Á”ˆ¤ì(€€€¥˜€¡Õ‘¥ÑU¤¹Ñ½À ¤ü¹¥€ôôô€µ½‘…°œ¤±½Í•5½‘…° ¤ì(€€€•±Í”±½Í•É…Ý•È ¤ì(€ô)ô¤ì((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€Y%\è€ÌµA½¥¹Ð5…Ñ (€€€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼)Y%]L¹µ…Ñ¡¥¹œ€ô€¡É½½Ð¤€ôøì(€¥˜€ …•¹ÍÕÉ•1¥Ù•=Ù•ÉÙ¥•Ü¡É½½Ð¤¤É•ÑÕÉ¸ì(€½¹ÍÐÉÕ±•‘¥Ñ…‰±”€ô…¸ ‰ÉÕ±•Ìˆ¤€˜˜ÍÑ…Ñ”¹‘…Ñ…Í•Ð€„ôô€‰ÁÉ½‘ÕÑ¥½¸ˆì(€½¹ÍÐ±¥ÍÐ€ôÍ½Á•‘á•ÁÑ¥½¹Ì ¤¹™¥±Ñ•È ¡”¤€ôø”¹ÑåÁ”€„ôô€‰µ¥ÍÍ¥¹}ÍÑ´ˆ¤ì(€¥˜€ …±¥ÍÐ¹±•¹Ñ ¤ì(€€€É½½Ð¹¥¹¹•É!Q50€ô€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆøñÀ±…ÍÌô‰•µÁÑäˆû‚æ‚â‡‚æ#‚â‡‚â×‚â‚âË‚â‹‚â‚âË‚â‚æ‚â¯‚æ'‚âW‚â‚âŸ‚â#‚æ‚âg‚âW‚âÇ‚âŸ‚â‚â‚â·‚â‚âg‚â×‚æ$ð½Àøð½‘¥Øù€ì(€€€É•ÑÕÉ¸ì(€ô(€ÍÑ…Ñ”¹µ…Ñ¡%¹‘•à€ô5…Ñ ¹µ¥¸¡ÍÑ…Ñ”¹µ…Ñ¡%¹‘•à°±¥ÍÐ¹±•¹Ñ €´€Ä¤ì(€½¹ÍÐ”€ô±¥ÍÑmÍÑ…Ñ”¹µ…Ñ¡%¹‘•átì(€½¹ÍÐÑ½°€ô”¹‘¥É•Ñ¥½¸€ôôô€‹‚â[‚â·‚âdˆ€ü¹Í•ÑÑ¥¹Ì¹Ñ½±•É…¹•]¥Ñ¡‘É…Ü€è¹Í•ÑÑ¥¹Ì¹Ñ½±•É…¹••Á½Í¥Ðì(€½¹ÍÐ‰…¹­IÕ±”€ô€¡¹‰…¹­Ì¹™¥¹ ¡‰…¹¬¤€ôø‰…¹¬¹½‘”€ôôô”¹‰…¹¬¤ñðíô¤¹ÉÕ±”ñð€‹‚æ‚â+‚æ'‚â‚â;‚â‡‚âË‚âW‚â‚âC‚âË‚âg‚â#‚âË‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚â_‚â×‚æ#‚â‡‚â×‚æ‚âg‚æ‚â‚â—‚æ0ˆì(€½¹ÍÐÉÕ±•	É•… €ôì(€€€‘ÕÁ±¥…Ñ”è€‹‚â{‚âk‚â‚âË‚â‹‚â‚âË‚â‚â‹‚â·‚âS‚æ‚âS‚â×‚â‹‚âŸ‚â‚âÇ‚âg‚â/‚æ'‚âÏ‚æ‚âg‚âw‚âÇ‚æ#‚â	<ƒŠPƒ‚æ‚â‚æ'‚âË‚æ‚â‚âß‚æ#‚â·‚âg‚æ‚â‚æ‚âW‚âÓ‚â‡‚â/‚æ'‚âÌˆ°(€€€‰…­‘…Ñ•è€‹‚â‚âË‚â‹‚â‚âË‚â‚â[‚âç‚â‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‹‚æ'‚â·‚âg‚â¯‚â—‚âÇ‚â‚â¯‚â—‚âÇ‚â‚âo‚âÓ‚âS‚â‹‚â·‚âS‚â‚â·‚â‚â+‚æ#‚âŸ‚â‚æ‚âŸ‚â—‚âË‚âg‚âÇ‚æ'‚âdˆ°(€€€É½ÍÍ}‘…äè€‹‚â·‚â‹‚âç‚æ#‚æ‚âg‚â+‚æ#‚âŸ‚â€ÈÌèÀÀ´ÈÌèÔäƒ‚âW‚æ'‚â·‚â‚âW‚â‚âŸ‚â#‚â‚æ#‚âŸ‚â‡‚â‚âÇ‚âk‚æ‚â‚â—‚æ3‚â‚â·‚â‚âŸ‚âÇ‚âg‚â[‚âÇ‚âS‚æ‚âlˆ°(€€€ÝÉ½¹}‰…¹¬è€‹‚âc‚âg‚âË‚â‚âË‚â‚âo‚â—‚âË‚â‹‚â_‚âË‚â‚æ‚â‡‚æ#‚âW‚â‚â‚â‚âÇ‚âk‚â_‚â×‚æ#‚â‚âÃ‚âk‚âã‚æ‚âg‚â‚âË‚â‹‚â‚âË‚âŒ	<ˆ°(€€€ÝÉ½¹}…½Õ¹Ðè€‹‚âk‚âÇ‚â7‚â+‚â×‚âo‚â—‚âË‚â‹‚â_‚âË‚â‚æ‚â‡‚æ#‚â·‚â‹‚âç‚æ#‚æ‚âdµ…ÍÑ•È±¥ÍÐƒ‚â‚â·‚â‚âk‚â‚âÓ‚â§‚âÇ‚â\ˆ°(€€€Õ¹•áÁ±…¥¹•‘}½ÕÐè€‹‚â‹‚â·‚âS‚æ‚â·‚âg‚â·‚â·‚â‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚æ‚â‚â—‚æ3‚â+‚â×‚æ'‚æ‚â#‚â‚âo‚â‚âÃ‚â‚â·‚âhˆ°(€€€µ¥ÍÍ¥¹}‰¼è€‹‚â‡‚â×‚â‚âË‚â‹‚â‚âË‚â‚âw‚âÇ‚æ#‚âMQ4ƒ‚æ‚âW‚æ#‚æ‚â‡‚æ#‚â{‚âk‚âw‚âÇ‚æ#‚â	<ˆ°(€€€µ¥ÍÍ¥¹}ÍÑ´è€‹‚â‡‚â×‚â‚âË‚â‹‚â‚âË‚â‚âw‚âÇ‚æ#‚â	<ƒ‚æ‚âW‚æ#‚æ‚â‡‚æ#‚â{‚âk‚âw‚âÇ‚æ#‚âMQ4ˆ°(€ôì(€½¹ÍÐ¡•­Ì€ôl(€€€ì¹…µ”è€‰	…¹¬½Õ¹Ðˆ°½¬èÑÉÕ”°‘•Ñ…¥°è€‘í”¹…½Õ¹Ñôƒ‚âW‚â‚â‚â‚âÇ‚âhµ…ÍÑ•È±¥ÍÐƒ‚â‚â·‚â€‘í”¹½µÁ…¹åõ€ô°(€€€ì¹…µ”è€‰Q¥µ”]¥¹‘½Üˆ°½¬è€…¡…Í½µÁ…É…‰±•á•ÁÑ¥½¹Q¥µ•Ì¡”¤ñð”¹Ñ¥µ•¥™™M•Œ€ðôÑ½°°‘•Ñ…¥°è¡…Í½µÁ…É…‰±•á•ÁÑ¥½¹Q¥µ•Ì¡”¤€üƒ‚âW‚æ#‚âË‚â‚â‚âÇ‚âd€‘í”¹Ñ¥µ•¥™™M•ôƒ‚âŸ‚âÓ‚âg‚âË‚â_‚âÔƒ
ÜÑ½±•É…¹”€‘íÑ½±ôƒ‚âŸ‚âÓ‚âg‚âË‚â_‚âÕ€€è€‹‚âW‚æ'‚âg‚â_‚âË‚â‚æ‚â‡‚æ#‚â‡‚â×‚æ‚âŸ‚â—‚âÈƒŠPƒ‚æ‚â‡‚æ#‚æ‚â+‚æ'‚æ‚âŸ‚â—‚âË‚æ‚âo‚æ‚âg‚æ‚â‚âß‚æ#‚â·‚âg‚æ‚âˆô°(€€€ì(€€€€€¹…µ”è€‰µ½Õ¹Ðˆ°(€€€€€½¬è”¹‰…¹­µ½Õ¹Ð€„ôô¹Õ±°€˜˜”¹ÍåÍÑ•µµ½Õ¹Ð€„ôô¹Õ±°€˜˜5…Ñ ¹…‰Ì¡”¹…µ½Õ¹Ñ¥™˜¤€ð¹Í•ÑÑ¥¹Ì¹‘¥™™±•ÉÐ°(€€€€€‘•Ñ…¥°è(€€€€€€€”¹‰…¹­µ½Õ¹Ð€ôôô¹Õ±°(€€€€€€€€€€ü€‹‚æ‚â‡‚æ#‚â{‚âk‚â‚âË‚â‹‚â‚âË‚â‚âw‚âÇ‚æ#‚âMQ4€¡	<ƒ‚â‡‚âË‚â‚â‚âŸ‚æ#‚âÈMQ4¤ˆ(€€€€€€€€€€è”¹ÍåÍÑ•µµ½Õ¹Ð€ôôô¹Õ±°(€€€€€€€€€€€€ü€‹‚æ‚â‡‚æ#‚â{‚âk‚â‚âË‚â‹‚â‚âË‚â‚âw‚âÇ‚æ#‚â	<€¡MQ4ƒ‚â‡‚âË‚â‚â‚âŸ‚æ#‚âÈ	<¤ˆ(€€€€€€€€€€€€èƒ‚âW‚æ#‚âË‚â‚â‚âÇ‚âd€‘íµ½¹•ä¡5…Ñ ¹…‰Ì¡”¹…µ½Õ¹Ñ¥™˜¤¥ôƒ‚âk‚âË‚â\ƒ
Üƒ‚æ‚â‚âO‚âG‚æ3‚æ‚â#‚æ'‚â‚æ‚âW‚âß‚â·‚âd€‘í¹Í•ÑÑ¥¹Ì¹‘¥™™±•ÉÑôƒ‚âk‚âË‚â]€°(€€€ô°(€tì(€¡•­Ì¹ÁÕÍ ¡ì(€€€¹…µ”è€‰	ÕÍ¥¹•ÍÌIÕ±”ˆ°(€€€½¬è€…ÉÕ±•	É•…¡m”¹ÑåÁ•t°(€€€‘•Ñ…¥°èÉÕ±•	É•…¡m”¹ÑåÁ•tñð€‹‚âs‚æ#‚âË‚âg‚â‚â;‚âc‚âg‚âË‚â‚âË‚â‚æ‚â—‚âÃ‚â‚â;‚âc‚âã‚â‚â‚âÓ‚â#‚æ‚â{‚âÓ‚æ#‚â‡‚æ‚âW‚âÓ‚â‡‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âPˆ°(€ô¤ì(€½¹ÍÐÁ…ÍÍ•€ô¡•­Ì¹™¥±Ñ•È ¡Œ¤€ôøŒ¹½¬¤¹±•¹Ñ ì((€É½½Ð¹¥¹¹•É!Q50€ô€(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆû‚â‚âË‚â‹‚â‚âË‚â‚â_‚â×‚æ €‘íÍÑ…Ñ”¹µ…Ñ¡%¹‘•à€¬€Åôƒ‚â#‚âË‚â€‘í±¥ÍÐ¹±•¹Ñ¡ôð½Àøñ Èø‘í ¡…Í•1…‰•°¡”¤¥ôƒ
Ü€‘í ¡”¹ÑåÁ•9…µ”¥ôð½ Èøð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹±¥¹”µ…Ñ¥½¹Ìˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰µAÉ•Øˆ€‘íÍÑ…Ñ”¹µ…Ñ¡%¹‘•à€ôôô€À€ü€‰‘¥Í…‰±•ˆ€è€ˆ‰ôûŠ@ƒ‚â‚æ#‚â·‚âg‚â¯‚âg‚æ'‚âÈð½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰µ9•áÐˆ€‘íÍÑ…Ñ”¹µ…Ñ¡%¹‘•à€ôôô±¥ÍÐ¹±•¹Ñ €´€Ä€ü€‰‘¥Í…‰±•ˆ€è€ˆ‰ôû‚â[‚âÇ‚âS‚æ‚âlƒŠHð½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸Í´ˆ¥ô‰µ=Á•¸ˆû‚æ‚âo‚âÓ‚âS‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âS‚æ‚âW‚æ‚â„ð½‰ÕÑÑ½¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€ð½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÌô‰µ…Ñ µÍ½É”€‘íÁ…ÍÍ•€ôôô€Ð€ü€‰½¬ˆ€èÁ…ÍÍ•€ôôô€Ì€ü€‰Ý…É¸ˆ€è€‰‰…‰ôˆø(€€€€€€€€ñÍÑÉ½¹œø‘íÁ…ÍÍ•‘ô¼Ðð½ÍÑÉ½¹œøñÍÁ…¸û‚æ‚â‚âO‚âG‚æ3‚â_‚â×‚æ#‚âs‚æ#‚âË‚âdƒŠP€Ìƒ‚â#‚âã‚âS‚â¯‚â—‚âÇ‚â€¡…½Õ¹Ð€¼Ñ¥µ”€¼…µ½Õ¹Ð¤ƒ‚æ‚â—‚âÃ‚â‚â;‚âc‚âã‚â‚â‚âÓ‚â#‚æ‚â{‚âÓ‚æ#‚â‡‚æ‚âW‚âÓ‚â„ð½ÍÁ…¸ø(€€€€€€ð½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÌô‰µ…Ñ ´Ìˆø(€€€€€€€€‘í¡•­Ì(€€€€€€€€€€¹µ…À (€€€€€€€€€€€€¡Œ¤€ôø€ñ‘¥Ø±…ÍÌô‰µ…Ñ µ…É€‘íŒ¹½¬€ü€‰½¬ˆ€è€‰‰…‰ôˆø(€€€€€€€€€€ñ¤ø‘íŒ¹½¬€ü€‹ŠrLˆ€è€‹ŠrT‰ôð½¤ø(€€€€€€€€€€ñÍÑÉ½¹œø‘í ¡Œ¹¹…µ”¥ôð½ÍÑÉ½¹œø(€€€€€€€€€€ñÍÁ…¸ø‘í ¡Œ¹‘•Ñ…¥°¥ôð½ÍÁ…¸ø(€€€€€€€€ð½‘¥Øù€°(€€€€€€€€€€¤(€€€€€€€€€€¹©½¥¸ ˆˆ¥ô(€€€€€€ð½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÌô‰½µÁ…É”ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰½µÁ…É”µ½°ˆø(€€€€€€€€€€ñ Ìû‚âw‚âÇ‚æ#‚â‚âc‚âg‚âË‚â‚âË‚âŒ€¡MQ4¤ð½ Ìø(€€€€€€€€€€ñ½‘”ø‘í ¡”¹ÍÑµI…Ü¥ôð½½‘”ø(€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰­Øµ±¥¹”ˆøñÍÁ…¸û‚æ‚âŸ‚â—‚âÈð½ÍÁ…¸øñˆø‘í”¹‰…¹­µ½Õ¹Ð€ôôô¹Õ±°€ü€ˆ´ˆ€è”¹Ñ¥µ•ôð½ˆøð½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰­Øµ±¥¹”ˆøñÍÁ…¸û‚â‹‚â·‚âPð½ÍÁ…¸øñˆø‘í”¹‰…¹­µ½Õ¹Ð€ôôô¹Õ±°€ü€ˆ´ˆ€èµ½¹•ä¡”¹‰…¹­µ½Õ¹Ð¥ôð½ˆøð½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰­Øµ±¥¹”ˆøñÍÁ…¸û‚â‚â;‚â_‚â×‚æ#‚æ‚â+‚æ$ð½ÍÁ…¸øñˆø‘í ¡‰…¹­IÕ±”¥ôð½ˆøð½‘¥Øø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰½µÁ…É”µµ¥ˆøñÍÁ…¸û‚æ‚â_‚â×‚â‹‚âk‚â‚âÇ‚âhð½ÍÁ…¸øð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰½µÁ…É”µ½°ˆø(€€€€€€€€€€ñ Ìû‚âw‚âÇ‚æ#‚â‚â‚âÃ‚âk‚âk‚â¯‚â—‚âÇ‚â‚âk‚æ'‚âË‚âd€¡	<¤ð½ Ìø(€€€€€€€€€€ñ½‘”ø‘í ¡”¹‰½I…Ü¥ôð½½‘”ø(€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰­Øµ±¥¹”ˆøñÍÁ…¸û‚æ‚âŸ‚â—‚âÈð½ÍÁ…¸øñˆø‘í”¹ÍåÍÑ•µµ½Õ¹Ð€ôôô¹Õ±°€ü€ˆ´ˆ€è ¡•á•ÁÑ¥½¹M¥‘•Q¥µ•ÍÑ…µÀ¡”°€‰‰¼ˆ¤¥ôð½ˆøð½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰­Øµ±¥¹”ˆøñÍÁ…¸û‚â‹‚â·‚âPð½ÍÁ…¸øñˆø‘í”¹ÍåÍÑ•µµ½Õ¹Ð€ôôô¹Õ±°€ü€‹‚æ‚â‡‚æ#‚â{‚âk‚â‚âË‚â‹‚â‚âË‚âŒˆ€èµ½¹•ä¡”¹ÍåÍÑ•µµ½Õ¹Ð¥ôð½ˆøð½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰­Øµ±¥¹”ˆøñÍÁ…¸û‚âs‚âç‚æ'‚â_‚âÏ‚â‚âË‚â‹‚â‚âË‚âŒð½ÍÁ…¸øñˆø‘í ¡”¹•µÁ±½å•”¥ôð½ˆøð½‘¥Øø(€€€€€€€€ð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰É¥´Èˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùQ½±•É…¹”ð½Àøñ Èû‚æ‚â‚âO‚âG‚æ3‚â#‚âÇ‚âk‚â‚âç‚æ#‚â_‚â×‚æ#‚æ‚â+‚æ'‚â‚âË‚âg‚â·‚â‹‚âç‚æ ð½ Èøð½‘¥ØøñÍÁ…¸±…ÍÌô‰¡•…±Ñ €‘íÉÕ±•‘¥Ñ…‰±”€ü€‰½¬ˆ€è€‰…ÑÑ•¹Ñ¥½¸‰ôˆø‘íÉÕ±•‘¥Ñ…‰±”€ü€‹‚æ‚â‚æ'‚æ‚â‚æ‚âS‚æ$ˆ€è€‹‚â‚æ#‚âË‚â_‚â×‚æ ‘•Á±½äƒ
Üƒ‚â·‚æ#‚âË‚âg‚â·‚â‹‚æ#‚âË‚â‚æ‚âS‚â×‚â‹‚âœ‰ôð½ÍÁ…¸øð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í•ÑÑ¥¹œµ±¥ÍÐˆø(€€€€€€€€€€ñ±…‰•°øñÍÁ…¸ùQ¥µ”Ñ½±•É…¹”ƒ‚âw‚âË‚âð½ÍÁ…¸øñ¥¹ÁÕÐÑåÁ”ô‰¹Õµ‰•Èˆ¥ô‰Ñ½±ˆÙ…±Õ”ôˆ‘í¹Í•ÑÑ¥¹Ì¹Ñ½±•É…¹••Á½Í¥Ñôˆ€‘íÉÕ±•‘¥Ñ…‰±”€ü€ˆˆ€è€‰‘¥Í…‰±•‰ô€¼øñˆû‚âŸ‚âÓ‚âg‚âË‚â_‚âÔð½ˆøð½±…‰•°ø(€€€€€€€€€€ñ±…‰•°øñÍÁ…¸ùQ¥µ”Ñ½±•É…¹”ƒ‚â[‚â·‚âdð½ÍÁ…¸øñ¥¹ÁÕÐÑåÁ”ô‰¹Õµ‰•Èˆ¥ô‰Ñ½±\ˆÙ…±Õ”ôˆ‘í¹Í•ÑÑ¥¹Ì¹Ñ½±•É…¹•]¥Ñ¡‘É…Ýôˆ€‘íÉÕ±•‘¥Ñ…‰±”€ü€ˆˆ€è€‰‘¥Í…‰±•‰ô€¼øñˆû‚âŸ‚âÓ‚âg‚âË‚â_‚âÔð½ˆøð½±…‰•°ø(€€€€€€€€€€ñ±…‰•°øñÍÁ…¸û‚â‚âç‚æ#‚â‹‚â·‚âS‚âW‚â‚â‚â_‚â×‚æ#‚æ‚â‡‚æ#‚â‚âÏ‚â‚âŸ‚â„ð½ÍÁ…¸øñ¥¹ÁÕÐÑåÁ”ô‰¹Õµ‰•ÈˆÙ…±Õ”ôˆ‘í¹Í•ÑÑ¥¹Ì¹•á…ÑU¹¥ÅÕ•Q½±•É…¹”ñð€ØÀÁôˆ‘¥Í…‰±•€¼øñˆû‚âŸ‚âÓ‚âg‚âË‚â_‚âÔð½ˆøð½±…‰•°ø(€€€€€€€€€€ñ±…‰•°øñÍÁ…¸û‚â‹‚â·‚âP¥™˜ƒ‚â_‚â×‚æ#‚âW‚æ'‚â·‚â‚æ‚â#‚æ'‚â‚æ‚âW‚âß‚â·‚âdð½ÍÁ…¸øñ¥¹ÁÕÐÑåÁ”ô‰¹Õµ‰•Èˆ¥ô‰Ñ½±ˆÙ…±Õ”ôˆ‘í¹Í•ÑÑ¥¹Ì¹‘¥™™±•ÉÑôˆ€‘íÉÕ±•‘¥Ñ…‰±”€ü€ˆˆ€è€‰‘¥Í…‰±•‰ô€¼øñˆû‚âk‚âË‚â\ð½ˆøð½±…‰•°ø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ¥ô‰Ñ½±M…Ù”ˆ€‘íÉÕ±•‘¥Ñ…‰±”€ü€ˆˆ€è€‰‘¥Í…‰±•‰ôû‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â—‚âÃ‚â‚âÏ‚âg‚âŸ‚âO‚âs‚â—‚æ‚â¯‚â‡‚æ ð½‰ÕÑÑ½¸ø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆû‚â—‚âÏ‚âS‚âÇ‚âk‚â‚âË‚â‚â#‚âÇ‚âk‚â‚âç‚æ ð½Àøñ Èû‚â‚âÃ‚âk‚âk‚â_‚âÏ‚â·‚âÃ‚æ‚â‚âk‚æ'‚âË‚âð½ Èøð½‘¥Øøð½‘¥Øø(€€€€€€€€ñ½°±…ÍÌô‰ÍÑ•Àµ±¥ÍÐˆø(€€€€€€€€€€ñ±¤û‚æ‚â—‚âß‚â·‚â‰ÕÍ¥¹•ÍÌ‘…Ñ”ƒ‚æ‚â—‚âÀ½µÁ…¹äð½±¤ø(€€€€€€€€€€ñ±¤û‚âW‚â‚âŸ‚â Í½ÕÉ”™¥±”½µÁ±•Ñ•¹•ÍÌ€¡ÅÕ…±¥Ñä…Ñ”¤ð½±¤ø(€€€€€€€€€€ñ±¤ù9½Éµ…±¥é”MQ4ƒ‚æ‚â—‚âÀ	<ƒ‚æ‚âo‚æ‚âdÍ¡•µ„ƒ‚æ‚âS‚â×‚â‹‚âŸ‚â‚âÇ‚âdð½±¤ø(€€€€€€€€€€ñ±¤ùÁÁ±ä‰…¹¬ÉÕ±”€¡`Ä½`È½a°ƒ‚â‹‚â·‚âS‚â‹‚â‚â‡‚âÈ°ƒ‚â‚â·‚âk‚âŸ‚âÇ‚âg‚â_‚â×‚æ ¤ð½±¤ø(€€€€€€€€€€ñ±¤û‚â«‚â‚æ'‚âË‚â…¹‘¥‘…Ñ”ƒ‚â#‚âË‚â…½Õ¹Ð€¬…µ½Õ¹Ðð½±¤ø(€€€€€€€€€€ñ±¤û‚â‚âÏ‚âg‚âŸ‚âLÑ¥µ”‘¥™™•É•¹”ƒ‚æ‚â—‚âÃ‚æ‚â¯‚æ'‚â‚âÃ‚æ‚âg‚âdð½±¤ø(€€€€€€€€€€ñ±¤û‚â[‚æ'‚âË‚âk‚âÇ‚â7‚â+‚âÔ½AÉ½Ù¥‘•È€¬ƒ‚âw‚âË‚âŠO‚â[‚â·‚âd€¬ƒ‚â‹‚â·‚âS‚âW‚â‚âƒ‚æ‚â—‚âÃ‚â‡‚â×‚âs‚âç‚æ'‚â«‚â‡‚âÇ‚â‚â‚æ‚â{‚â×‚â‹‚â‚â‚âç‚æ#‚æ‚âS‚â×‚â‹‚âœƒ‚â‚âÃ‚âk‚âk‚â#‚âÇ‚âk‚æ‚â¯‚æ'‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÓ‚æ‚âS‚æ'‚â[‚âÛ‚â€‘í¹Õ´¡¹Í•ÑÑ¥¹Ì¹•á…ÑU¹¥ÅÕ•Q½±•É…¹”ñð€ØÀÀ¥ôƒ‚âŸ‚âÓ‚âg‚âË‚â_‚âÔð½±¤ø(€€€€€€€€€€ñ±¤û‚â[‚æ'‚âË‚â‡‚â×‚â‹‚â·‚âS‚â/‚æ'‚âÏ‚â¯‚â—‚âË‚â‹‚â‚âË‚â‹‚â‚âË‚âŒƒ‚â‚âÃ‚âk‚âk‚æ‚â‡‚æ#‚æ‚âS‚âË‚â‚âç‚æ#‚æ‚â—‚âÃ‚â‹‚âÇ‚â‚â«‚æ#‚â‚æ‚â¯‚æ$Õ‘¥Ðƒ‚âW‚â‚âŸ‚â ð½±¤ø(€€€€€€€€€€ñ±¤û‚âs‚æ#‚âË‚âdÑ¡É•Í¡½±€ôµ…Ñ¡•°ƒ‚æ‚â‡‚æ#‚âs‚æ#‚âË‚âd€ô•á•ÁÑ¥½¸ð½±¤ø(€€€€€€€€€€ñ±¤û‚â«‚æ#‚â•á•ÁÑ¥½¸ƒ‚æ‚â‚æ'‚âÈÝ½É­™±½Üƒ‚â+‚â×‚æ'‚æ‚â#‚âð½±¤ø(€€€€€€€€ð½½°ø(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ù€ì((€€ ˆµAÉ•Øˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø€ ¡ÍÑ…Ñ”¹µ…Ñ¡%¹‘•à€ô5…Ñ ¹µ…à À°ÍÑ…Ñ”¹µ…Ñ¡%¹‘•à€´€Ä¤¤°É•¹‘•È ¤¤¤ì(€€ ˆµ9•áÐˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø€ ¡ÍÑ…Ñ”¹µ…Ñ¡%¹‘•à€ô5…Ñ ¹µ¥¸¡±¥ÍÐ¹±•¹Ñ €´€Ä°ÍÑ…Ñ”¹µ…Ñ¡%¹‘•à€¬€Ä¤¤°É•¹‘•È ¤¤¤ì(€€ ˆµ=Á•¸ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø½Á•¹á•ÁÑ¥½¸¡”¹¥¤¤ì(€€ ˆÑ½±M…Ù”ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€€€¥˜€ …ÉÕ±•‘¥Ñ…‰±”¤É•ÑÕÉ¸‘•¹ä ‹‚æ‚â‚æ$Ñ½±•É…¹”ˆ¤ì(€€€¹Í•ÑÑ¥¹Ì¹Ñ½±•É…¹••Á½Í¥Ð€ô€¬ ˆÑ½±ˆ¤¹Ù…±Õ”ñð€Àì(€€€¹Í•ÑÑ¥¹Ì¹Ñ½±•É…¹•]¥Ñ¡‘É…Ü€ô€¬ ˆÑ½±\ˆ¤¹Ù…±Õ”ñð€Àì(€€€¹Í•ÑÑ¥¹Ì¹‘¥™™±•ÉÐ€ô€¬ ˆÑ½±ˆ¤¹Ù…±Õ”ñð€Àì(€€€MÑ½É”¹‘…Ñ„¹Í•ÑÑ¥¹Ì€ôì€¸¸¹¹Í•ÑÑ¥¹Ìôì(€€€MÑ½É”¹Á•ÉÍ¥ÍÐ ¤ì(€€€±½Ñ¥½¸ ‰ÕÁ‘…Ñ”ˆ°€‰Í•ÑÑ¥¹Ìˆ°€‰Ñ½±•É…¹”ˆ°ƒ‚âw‚âË‚â€‘í¹Í•ÑÑ¥¹Ì¹Ñ½±•É…¹••Á½Í¥ÑõÌ€¼ƒ‚â[‚â·‚âd€‘í¹Í•ÑÑ¥¹Ì¹Ñ½±•É…¹•]¥Ñ¡‘É…ÝõÌ€¼‘¥™˜€‘í¹Í•ÑÑ¥¹Ì¹‘¥™™±•ÉÑôƒ‚âk‚âË‚â]€¤ì(€€€Ñ½…ÍÐ ‹‚âk‚âÇ‚âg‚â_‚âÛ‚âÑ½±•É…¹”ƒ‚æ‚â—‚æ'‚âœƒ‚â‚âÃ‚âk‚âk‚â‚âÏ‚â—‚âÇ‚â‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚æ‚â¯‚â‡‚æ#‚æ‚â¯‚æ$ˆ¤ì(€€€É•¹½Éµ…±¥é•±° ¤ì(€€€Í¡•‘Õ±•ÕÑ½I•½¹¥±” ‹‚æ‚âo‚â—‚â×‚æ#‚â‹‚âdÑ½±•É…¹”ˆ¤ì(€€€É•¹‘•È ¤ì(€ô¤ì)ôì((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€Y%\èÁÁÉ½Ù…±Ì(€€€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼)Y%]Ml…Õ‘¥ÐµÉ•Ù¥•Üt€ô€¡É½½Ð¤€ôøì(€¥˜€ …•¹ÍÕÉ•1¥Ù•=Ù•ÉÙ¥•Ü¡É½½Ð¤¤É•ÑÕÉ¸ì(€Õ‘¥ÑI•Ù¥•Ü¹µ½Õ¹Ð¡É½½Ð°ì(€€€•Ð•á•ÁÑ¥½¹Ì ¥íÉ•ÑÕÉ¸¹•á•ÁÑ¥½¹Ìíô°•Ð™¥±Ñ•ÉÌ ¥íÉ•ÑÕÉ¸ÍÑ…Ñ”¹™¥±Ñ•ÉÌíô°½µÁ…¹¥•Ìé½µÁ…¹å5…ÍÑ•È ¤¹µ…À¡ŒôùÑåÁ•½˜ŒôôôÍÑÉ¥¹œœýŒéŒ¹½‘”¤¹™¥±Ñ•È¡…¹•ÍÍ½µÁ…¹ä¤°…¹•ÍÍ½µÁ…¹ä° °µ½¹•ä°…Í•1…‰•°°½Á•¹á•ÁÑ¥½¸°Ñ½…ÍÐ°(€€€…¹I•ÑÕÉ¸é”ôù±…É¥™¥…Ñ¥½¹I•ÑÕÉ¸¹•±¥¥‰±”¡”¤±É•ÑÕÉ¹…Í”é¥ôùí½¹ÍÐ”õ¹•á•ÁÑ¥½¹Ì¹™¥¹¡àôùà¹¥ôôõ¥¤í¥˜¡”¥É•ÑÕÉ¸±…É¥™¥…Ñ¥½¹I•ÑÕÉ¸¹½Á•¸¡”¤¹…Ñ ¡•ÉÈôùÑ½…ÍÐ¡•ÉÈ¹µ•ÍÍ…”°Ý…É¸œ¤¤íô°(€€€¥ÍÑ¥Ù”è ¤ôùÍÑ…Ñ”¹É½ÕÑ”ôôô…Õ‘¥ÐµÉ•Ù¥•Üœ°(€€€¥ÍI•…‘äè ¤ôùÍÑ…Ñ”¹‘…Ñ…Í•Ð„ôôÁÉ½‘ÕÑ¥½¸ñð¡±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹•á•ÁÑ¥½¹ÍI•…‘ä˜™±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹­•äôôõ€‘íÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½µõð‘íÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹Ñ½õð‘íÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹åõ€¤°(€€€±½…‘5•ÍÍ…”è ¤ôù±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹•ÉÉ½Éññ±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹…Õá¥±¥…ÉåÉÉ½ÉñðŸ‚â‚âÏ‚â—‚âÇ‚â‚æ‚â¯‚â—‚âS‚â‚âÓ‚âŸ‚âk‚â‚âÓ‚â§‚âÇ‚â_‚â_‚â×‚æ#‚æ‚â—‚âß‚â·‚âƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â«‚â‚âã‚âo‚âŸ‚æ#‚âË‚æ‚â‡‚æ#‚â‡‚â×‚æ‚â‚â¨œ°(€€€Í•±•Ñ½µÁ…¹äé…Íå¹Œ½µÁ…¹äôùí¥˜¡½µÁ…¹ä„ôô10œ˜˜……¹•ÍÍ½µÁ…¹ä¡½µÁ…¹ä¤¥Ñ¡É½ÜÉÉ½È Ÿ‚æ‚â‡‚æ#‚â‡‚â×‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚âk‚â‚âÓ‚â§‚âÇ‚â_‚âg‚â×‚æ$œ¤íÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹äõ½µÁ…¹äíÉ•¹‘•É¥±Ñ•ÉÌ ¤í¥˜¡ÍÑ…Ñ”¹‘…Ñ…Í•ÐôôôÁÉ½‘ÕÑ¥½¸œ¥…Ý…¥Ð±½…‘I•ÍÁ½¹‘•ÉEÕ•Õ” ¤íô°(€€€½Á•¹=Ù•ÉÙ¥•Üè€ ¤€ôøìÍÑ…Ñ”¹É•Ù¥•ÝM¡••Ð€ô€…±°œì¼ •á•ÁÑ¥½¹Ìœ°ì•á¥±Ñ•ÈèìÍÑ…ÑÕÌè€10œ°Äè€œœ°Í±„è™…±Í”°ÑåÁ”è€10œ°Í•Ù•É¥Ñäè€10œôô¤ìô°(€€€É•™É•Í è…Íå¹Œ€ ¤€ôøì…Ý…¥Ð±½…‘1¥Ù•=Ù•ÉÙ¥•Ü¡ÑÉÕ”¤ìô°(€ô¤ì(€É½½Ð¹¥¹Í•ÉÑ‘©…•¹Ñ!Q50 …™Ñ•É‰•¥¸œ°œñÀ±…ÍÌô‰¡¥¹ÐˆÉ½±”ô‰ÍÑ…ÑÕÌˆû‚â‚âÓ‚âŸ‚â·‚âÇ‚âo‚æ‚âS‚âW‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÓ‚â_‚âã‚â€ÌÀƒ‚âŸ‚âÓ‚âg‚âË‚â_‚âÔƒ
Üƒ‚â{‚âÇ‚â‚â‚âË‚â‚â·‚âÇ‚âo‚æ‚âS‚âW‚â‚âÃ‚â¯‚âŸ‚æ#‚âË‚â‚æ‚âo‚âÓ‚âS‚æ‚â‚â«‚â¯‚â‚âß‚â·‚æ‚â‚æ'‚â‚æ'‚â·‚â‡‚âç‚â”ƒ‚æ‚â{‚âß‚æ#‚â·‚æ‚â‡‚æ#‚â_‚âÇ‚âk‚â‚æ'‚â·‚â‚âŸ‚âË‚â‡‚â‚æ#‚âË‚âð½Àøœ¤ì)ôì((()Y%]L¹…ÁÁÉ½Ù…±Ì€ô€¡É½½Ð¤€ôøì(€¥˜€ …•¹ÍÕÉ•1¥Ù•=Ù•ÉÙ¥•Ü¡É½½Ð¤¤É•ÑÕÉ¸ì(€¥˜¡ÍÑ…Ñ”¹‘…Ñ…Í•ÐôôôÁÉ½‘ÕÑ¥½¸œ˜˜…±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹•á•ÁÑ¥½¹ÍI•…‘ä¥íÉ½½Ð¹¥¹¹•É!Q50ôœñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆÉ½±”ô‰ÍÑ…ÑÕÌˆû‚â‚âÏ‚â—‚âÇ‚â‚æ‚â¯‚â—‚âS‚â‚âÓ‚âŸ‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚â#‚â‚âÓ‚âŠ˜ƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â«‚â‚âã‚âo‚æ‚âo‚æ‚âg‚â£‚âç‚âg‚â‹‚æ0ð½Í•Ñ¥½¸øœíÉ•ÑÕÉ¸íô(€½¹ÍÐ…ÁÁÉ½Ù…±…Í•Ì€ôÍ½Á•‘á•ÁÑ¥½¹Ì ¤ì(€½¹ÍÐÅÕ•Õ”€ô…ÁÁÉ½Ù…±…Í•Ì¹™¥±Ñ•È ¡”¤€ôø€…”¹±½ÍÕÉ•I•ÅÕ•ÍÑ%€˜˜”¹ÍÑ…ÑÕÌ€ôôô€‘…µ…”œ¤ì(€É½½Ð¹¥¹¹•É!Q50€ô€(€€€€ñ‘¥Ø±…ÍÌô‰…±•ÉÐÝ…É¸ˆøñÍÑÉ½¹œû‚â‚â·‚âk‚æ‚â‚âW‚â‚âÓ‚âŸ‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÐð½ÍÑÉ½¹œøñÍÁ…¸û‚æ‚â«‚âS‚â‚æ‚â'‚â{‚âË‚âÀ€‘í¹Õ´¡…ÁÁÉ½Ù…±…Í•Ì¹±•¹Ñ ¥ôƒ‚æ‚â‚â«‚â_‚â×‚æ#‚æ‚â¯‚â—‚âS‚âW‚âË‚â‡‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚æ‚â—‚âÃ‚âW‚âÇ‚âŸ‚â‚â‚â·‚â‚âo‚âÇ‚â#‚â#‚âã‚âk‚âÇ‚âdƒ‚æ‚â‡‚æ#‚æ‚â+‚æ#‚â‹‚â·‚âS‚â‚â‚âk‚â_‚âÇ‚æ'‚â‚â‚âÃ‚âk‚âhƒ‚â¯‚âË‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚â‹‚âÇ‚â‚æ‚â¯‚â—‚âS‚æ‚â‡‚æ#‚â‚â‚âhƒ‚â¯‚æ'‚âË‚â‡‚æ‚â+‚æ'‚â‹‚â·‚âS‚â£‚âç‚âg‚â‹‚æ3‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âo‚âÓ‚âS‚â‚âË‚âdð½ÍÁ…¸øð½‘¥Øø(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆ¥ô‰Á•¹‘¥¹5…¹Õ…±A…¥ÉEÕ•Õ”ˆøð½Í•Ñ¥½¸ø(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆ¥ô‰Á•¹‘¥¹É½ÍÍ…åEÕ•Õ”ˆøð½Í•Ñ¥½¸ø(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆ¥ô‰Á•¹‘¥¹½Õµ•¹Ñ±½ÍÕÉ•EÕ•Õ”ˆøð½Í•Ñ¥½¸ø(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰ÍÑ…ÑÕÌµÍÑÉ¥À™½ÕÈˆø(€€€€€€ñ…ÉÑ¥±”øñÍÁ…¸û‚â‚â·‚â+‚â×‚æ'‚æ‚â#‚âð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡…ÁÁÉ½Ù…±…Í•Ì¹™¥±Ñ•È ¡”¤€ôø”¹ÍÑ…ÑÕÌ€ôôô€‰±…É¥™å¥¹œˆ¤¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚â«‚æ#‚â‚æ‚â¯‚æ'‚âs‚âç‚æ'‚âS‚âç‚æ‚â—‚âk‚â‚âÓ‚â§‚âÇ‚â_‚æ‚â—‚æ'‚âœð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”±…ÍÌô‰Ý…É¸ˆøñÍÁ…¸ùÕ‘¥Ðƒ‚â‚â·‚âW‚â‚âŸ‚â#‚æ‚â·‚â‚â«‚âË‚âŒð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡Õ‘¥ÑI•Ù¥•Ü¹É½ÝÌ¡¹•á•ÁÑ¥½¹Ì°ì™¥±Ñ•ÉÌèÍÑ…Ñ”¹™¥±Ñ•ÉÌ°…¹•ÍÍ½µÁ…¹äô¤¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°øñ„¡É•˜ôˆŒ½…Õ‘¥ÐµÉ•Ù¥•Üˆû‚æ‚âo‚âÓ‚âS‚â‚âÓ‚âœÕ‘¥Ðƒ‚â‚â·‚âW‚â‚âŸ‚â ƒŠHð½„øƒ
Üƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚â+‚æ#‚â‚âÏ‚â‚â·‚â¯‚âÇ‚âŸ‚â¯‚âg‚æ'‚âË‚âo‚âÓ‚âPð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”±…ÍÌô‰‰…ˆøñÍÁ…¸û‚â‚â·‚âo‚âÓ‚âS‚æ‚âo‚æ‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡…ÁÁÉ½Ù…±…Í•Ì¹™¥±Ñ•È ¡”¤€ôø”¹ÍÑ…ÑÕÌ€ôôô€‰‘…µ…”ˆ¤¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚æ‚â‚æ'‚âË‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚æ‚â—‚æ'‚âœƒ‚â‚â·‚âo‚âÓ‚âS‚â‚â·‚âhð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”±…ÍÌô‰½¬ˆøñÍÁ…¸û‚âo‚âÓ‚âS‚æ‚â—‚æ'‚âŸ‚æ‚âg‚â‚âË‚â‹‚â‚âË‚â‚â_‚â×‚æ#‚æ‚â¯‚â—‚âPð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡…ÁÁÉ½Ù…±…Í•Ì¹™¥±Ñ•È ¡”¤€ôøl‰±½Í•ˆ°€‰…ÁÁÉ½Ù•‰t¹¥¹±Õ‘•Ì¡”¹ÍÑ…ÑÕÌ¤¤¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚â‡‚â×‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â—‚âÃ‚âs‚âç‚æ'‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚â‚â‚âhð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€ð½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùÁÁÉ½Ù…°EÕ•Õ”ð½Àøñ Èû‚â‚âË‚â‹‚â‚âË‚â‚â‚â·‚âW‚â‚âŸ‚â#‚â_‚âË‚âg‚æ‚â—‚âÃ‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÐð½ Èøð½‘¥Øø(€€€€€€€€ñÍÁ…¸±…ÍÌô‰¡•…±Ñ €‘í…¸ ‰…ÁÁÉ½Ù”ˆ¤€ü€‰½¬ˆ€è€‰…ÑÑ•¹Ñ¥½¸‰ôˆø‘í…¸ ‰…ÁÁÉ½Ù”ˆ¤€ü€‹‚â‚âã‚âO‚â‡‚â×‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÐˆ€è€‹‚âk‚â_‚âk‚âË‚â_‚âg‚â×‚æ'‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚æ‚â‡‚æ#‚æ‚âS‚æ$‰ôð½ÍÁ…¸ø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…Àˆø(€€€€€€€€ñÑ…‰±”ø(€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ û‚æ‚â‚â¨ð½Ñ øñÑ û‚âo‚â‚âÃ‚æ‚âƒ‚â\ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚â‹‚â·‚âP¥™˜ð½Ñ øñÑ û‚â‚âÃ‚âS‚âÇ‚âhð½Ñ øñÑ û‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdð½Ñ øñÑ û‚â«‚â[‚âË‚âg‚âÀð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚â‚âË‚â‚â_‚âÏ‚â‚âË‚âdð½Ñ øð½ÑÈøð½Ñ¡•…ø(€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€€‘ì(€€€€€€€€€€€€€ÅÕ•Õ”(€€€€€€€€€€€€€€€€¹Í±¥” À°€ÈÀ¤(€€€€€€€€€€€€€€€€¹µ…À (€€€€€€€€€€€€€€€€€€¡”¤€ôø€ñÑÈø(€€€€€€€€€€€€€€ñÑøñ‰ÕÑÑ½¸±…ÍÌô‰±¥¹¬µ‰Ñ¸ˆ‘…Ñ„µ•àôˆ‘í ¡”¹¥¥ôˆø‘í ¡…Í•1…‰•°¡”¤¥ôð½‰ÕÑÑ½¸øð½Ñø(€€€€€€€€€€€€€€ñÑø‘í ¡”¹ÑåÁ•9…µ”¥ôð½Ñø(€€€€€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í”¹É¥Í­µ½Õ¹Ð€üµ½¹•ä¡”¹É¥Í­µ½Õ¹Ð¤€è€‹ŠP‰ôð½Ñø(€€€€€€€€€€€€€€ñÑøñÍÁ…¸±…ÍÌô‰‰…‘”€‘í”¹Í•Ù•É¥Ñåôˆø‘í ¡Í•Ù5•Ñ„¡”¹Í•Ù•É¥Ñä¤¹¹…µ”¥ôð½ÍÁ…¸øð½Ñø(€€€€€€€€€€€€€€ñÑø‘í”¹±…É¥™¥…Ñ¥½¹¥±•%€ü€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸áÌˆ‘…Ñ„µÉ•Ù¥•Üµ•Ù¥‘•¹”ôˆ‘í ¡”¹‘‰%‘ññ”¹¥¥ôˆû‚æ‚âo‚âÓ‚âS‚æ‚â·‚â‚â«‚âË‚â‚â_‚â×‚æ#‚æ‚â—‚âß‚â·‚âð½‰ÕÑÑ½¸ù€€è”¹¡…ÍÙ¥‘•¹”€ü€œñÍÁ…¸±…ÍÌô‰‰…‘”É••¸ˆû‚â‡‚â×‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚âg‚âhð½ÍÁ…¸øœ€è€œñÍÁ…¸±…ÍÌô‰‰…‘”É•ˆû‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚âÔð½ÍÁ…¸øôð½Ñø(€€€€€€€€€€€€€€ñÑøñÍÁ…¸±…ÍÌô‰‰…‘”€‘í…Í•MÑ…ÑÕÍ5•Ñ„¡”¤¹Ñ½¹•ôˆø‘í ¡…Í•MÑ…ÑÕÍ5•Ñ„¡”¤¹¹…µ”¥ôð½ÍÁ…¸øð½Ñø(€€€€€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡Ð¹½ÝÉ…Àˆø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸áÌˆ‘…Ñ„µÉ•©•Ðôˆ‘í”¹¥‘ôˆû‚â«‚æ#‚â‚â‚â—‚âÇ‚âhð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸áÌˆ‘…Ñ„µ…ÁÁÉ½Ù”ôˆ‘í”¹¥‘ôˆ€‘í”¹ÍÑ…ÑÕÌ„ôôÁ…¥É}Á•¹‘¥¹œœ˜˜…”¹¡…ÍÙ¥‘•¹”€˜˜¹Í•ÑÑ¥¹Ì¹ÉÕ±•Ì¹É•ÅÕ¥É•Ù¥‘•¹”€ü€‘¥Í…‰±•Ñ¥Ñ±”ô‹‚â‚â;‚âk‚âÇ‚â‚â‚âÇ‚âk‚æ‚âg‚âk‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â‚æ#‚â·‚âg‚âo‚âÓ‚âS‚æ‚â‚â¨ˆœ€è€ˆ‰ôø‘í”¹ÍÑ…ÑÕÌôôôÁ…¥É}Á•¹‘¥¹œœüŸ‚âW‚â‚âŸ‚â#‚â‚âç‚æ#‚â‚â·‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÐœèŸ‚âo‚âÓ‚âS‚æ‚â‚â¨ôð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ð½Ñø(€€€€€€€€€€€€ð½ÑÈù€°(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹©½¥¸ ˆˆ¤ñð€ñÑÈøñÑ½±ÍÁ…¸ôˆÜˆ±…ÍÌô‰•µÁÑäˆû‚æ‚â‡‚æ#‚â{‚âk‚â‚âË‚â‹‚â‚âË‚â‚â‚â·‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚æ‚âg‚â‚æ'‚â·‚â‡‚âç‚â—‚â_‚â×‚æ#‚æ‚â¯‚â—‚âPƒŠPƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚â+‚æ#‚â‚âË‚â‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âŸ‚æ#‚âË‚æ‚â‡‚æ#‚â‡‚â×‚æ‚â‚â«‚â‚æ'‚âË‚â‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âPð½Ñøð½ÑÈù€(€€€€€€€€€€€ô(€€€€€€€€€€ð½Ñ‰½‘äø(€€€€€€€€ð½Ñ…‰±”ø(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ù€ì((€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µ•átˆ¤¹™½É…  ¡ˆ¤€ôøˆ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø½Á•¹á•ÁÑ¥½¸¡ˆ¹‘…Ñ…Í•Ð¹•à¤¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µÉ•Ù¥•Üµ•Ù¥‘•¹•tœ¤¹™½É… ¡ˆôùˆ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ° ¤ôù½Á•¹Ù¥‘•¹•I•±…Ñ•‘…Í”¡ˆ¹‘…Ñ…Í•Ð¹É•Ù¥•ÝÙ¥‘•¹”±í™½ÕÍ¥±•ÌéÑÉÕ•ô¤¹…Ñ ¡•ÉÈôùÑ½…ÍÐ Ÿ‚æ‚âo‚âÓ‚âS‚æ‚â·‚â‚â«‚âË‚â‚â_‚â×‚æ#‚âs‚âç‚â‚æ‚âŸ‚æ'‚æ‚â‡‚æ#‚æ‚âS‚æ$è€œ­•ÉÈ¹µ•ÍÍ…”°Ý…É¸œ¤¤¤¤ì(€½¹ÍÐ…ÁÁÉ½Ù…±M½Á”€ôí½µÁ…¹äéÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä±™É½´éÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½´±Ñ¼éÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹Ñ½ôì(€½¹ÍÐ‘É…™Ñ-•äõ™…ÍÑEÕ•Õ•É…™Ñ-•ä ¤ì(€5…¹Õ…±A…¥É¥¹œ¹µ½Õ¹ÑEÕ•Õ”  œÁ•¹‘¥¹5…¹Õ…±A…¥ÉEÕ•Õ”œ¤±¹Õ±°±…ÁÁÉ½Ù…±M½Á”¤¹Ñ¡•¸  ¤ôùÉ•ÍÑ½É•…ÍÑEÕ•Õ•É…™ÑÌ¡‘É…™Ñ-•ä¤¤ì(€É½ÍÍ…å]½É­‰•¹ ¹µ½Õ¹ÑEÕ•Õ”  œÁ•¹‘¥¹É½ÍÍ…åEÕ•Õ”œ¤±…ÁÁÉ½Ù…±M½Á”¤¹Ñ¡•¸  ¤ôùÉ•ÍÑ½É•…ÍÑEÕ•Õ•É…™ÑÌ¡‘É…™Ñ-•ä¤¤ì(€…Í•±½ÍÕÉ”¹µ½Õ¹ÑEÕ•Õ”  œÁ•¹‘¥¹½Õµ•¹Ñ±½ÍÕÉ•EÕ•Õ”œ¤±íÍ½Á”é…ÁÁÉ½Ù…±M½Á•ô¤¹Ñ¡•¸  ¤ôùÉ•ÍÑ½É•…ÍÑEÕ•Õ•É…™ÑÌ¡‘É…™Ñ-•ä¤¤ì(€É½½Ð¹¥¹Í•ÉÑ‘©…•¹Ñ!Q50 …™Ñ•É‰•¥¸œ°œñÀ±…ÍÌô‰¡¥¹ÐˆÉ½±”ô‰ÍÑ…ÑÕÌˆû‚â‚âÓ‚âŸ‚â·‚âÇ‚âo‚æ‚âS‚âW‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÓ‚â_‚âã‚â€ÌÀƒ‚âŸ‚âÓ‚âg‚âË‚â_‚âÔƒ
Üƒ‚â{‚âÇ‚â‚â‚âË‚â‚â·‚âÇ‚âo‚æ‚âS‚âW‚â‚âÃ‚â¯‚âŸ‚æ#‚âË‚â‚æ‚âo‚âÓ‚âS‚æ‚â‚â«‚â¯‚â‚âß‚â·‚æ‚â‚æ'‚â‚æ'‚â·‚â‡‚âç‚â”ƒ‚æ‚â{‚âß‚æ#‚â·‚æ‚â‡‚æ#‚â_‚âÇ‚âk‚â‚æ'‚â·‚â‚âŸ‚âË‚â‡‚â‚æ#‚âË‚âð½Àøœ¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µ…ÁÁÉ½Ù•tˆ¤¹™½É…  ¡ˆ¤€ôø(€€€ˆ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€€€¥˜€ ……¸ ‰…ÁÁÉ½Ù”ˆ¤¤É•ÑÕÉ¸‘•¹ä ‹‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÐˆ¤ì(€€€€€½¹ÍÐ”õ¹•á•ÁÑ¥½¹Ì¹™¥¹¡àôùà¹¥ôôõˆ¹‘…Ñ…Í•Ð¹…ÁÁÉ½Ù”¤ì(€€€€€¥˜ …”¥É•ÑÕÉ¸Ñ½…ÍÐ Ÿ‚æ‚â‡‚æ#‚â{‚âk‚æ‚â‚â¨ƒ‚â‚â‚âã‚âO‚âË‚æ‚â¯‚â—‚âS‚æ‚â¯‚â‡‚æ œ°Ý…É¸œ¤ì(€€€€€¥˜¡”¹µ…¹Õ…±A…¥É%¥É•ÑÕÉ¸½Á•¹ÁÁÉ½Ù…±I•Ù¥•Ü¡”¹‘‰%°Á…¥Èœ¤¹…Ñ ¡•ÉÈôùÑ½…ÍÐ¡•ÉÈ¹µ•ÍÍ…”°Ý…É¸œ¤¤ì(€€€€€¥˜¡”¹±½ÍÕÉ•I•ÅÕ•ÍÑ%¥É•ÑÕÉ¸½Á•¹ÁÁÉ½Ù…±I•Ù¥•Ü¡”¹‘‰%°±½ÍÕÉ”œ¤¹…Ñ ¡•ÉÈôùÑ½…ÍÐ¡•ÉÈ¹µ•ÍÍ…”°Ý…É¸œ¤¤ì(€€€€€€¼¼½Õµ•¹ÐÉ•Ù¥•Ü‰ä„±½Í•È¥Ì½¹”…Ñ½µ¥Œ±½Í”°¹½Ð…¹½Ñ¡•ÈÁ•¹‘¥¹œÅÕ•Õ”¸(€€€€€…Í•±½ÍÕÉ”¹½Á•¹MÕ‰µ¥Ð¡”¤¹…Ñ ¡•ÉÈôùÑ½…ÍÐ¡•ÉÈ¹µ•ÍÍ…”°Ý…É¸œ¤¤ì(€€€ô¤°(€€¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µÉ•©•Ñtˆ¤¹™½É…  ¡ˆ¤€ôø(€€€ˆ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€€€¥˜€ ……¸ ‰…ÁÁÉ½Ù”ˆ¤¤É•ÑÕÉ¸‘•¹ä ‹‚â«‚æ#‚â‚â‚â—‚âÇ‚âhˆ¤ì(€€€€€½¹ÍÐ”€ô¹•á•ÁÑ¥½¹Ì¹™¥¹ ¡à¤€ôøà¹¥€ôôôˆ¹‘…Ñ…Í•Ð¹É•©•Ð¤ì(€€€€€¥˜¡”¹ÍÑ…ÑÕÌôôôÁ…¥É}Á•¹‘¥¹œœ¤É•ÑÕÉ¸½Á•¹á•ÁÑ¥½¸¡”¹¥¤ì(€€€€€”¹ÍÑ…ÑÕÌ€ô€‰±…É¥™å¥¹œˆì(€€€€€±½Ñ¥½¸ ‰É•©•Ðˆ°€‰•á•ÁÑ¥½¸ˆ°”¹¥°€‹‚â«‚æ#‚â‚â‚â—‚âÇ‚âk‚æ‚â¯‚æ'‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚â{‚âÓ‚æ#‚â„ˆ¤ì(€€€€€Í…Ù•=Ù•ÉÉ¥‘”¡”¤ì(€€€€€Ñ½…ÍÐ ‹‚â«‚æ#‚â‚â‚â—‚âÇ‚âk‚æ‚â¯‚æ'‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚â{‚âÓ‚æ#‚â‡‚æ‚â—‚æ'‚âœˆ¤ì(€€€€€É•¹‘•È ¤ì(€€€ô¤°(€€¤ì)ôì((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€Y%\è…µ…”É•¥ÍÑ•È(€€€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼(¼¨ƒ‚â‹‚â·‚âS‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆ€£‚âk‚âË‚â\¤€¨¼)™Õ¹Ñ¥½¸‘µQ!¡¤ì(€É•ÑÕÉ¸¹…µ½Õ¹Ðì)ô)™Õ¹Ñ¥½¸å±•EÕ½Ñ•1…‰•° ¤ì(€É•ÑÕÉ¸€ˆˆì)ô()½¹ÍÐ±¥Ù•…µ…•MÑ…Ñ”€ôì(€É½ÝÌè¹Õ±°°(€•Ù¥‘•¹”è¹Õ±°°(€•Ù¥‘•¹•I•…‘äè™…±Í”°(€±½…‘¥¹œè™…±Í”°(€É•…‘äè™…±Í”°(€•ÉÉ½Èè¹Õ±°°(€­•äè€ˆˆ°(€É•ÅÕ•ÍÑ%è€À°(€ÕÁ‘…Ñ•‘Ðè¹Õ±°°(€…Ñ•½Éäè€‰10ˆ°(€Ñ•…´è€‰10ˆ°(€•µÁ±½å•”è€‰10ˆ°(€½±±•Ñ¥½¹ÉÉ½Èè¹Õ±°°)ôì()™Õ¹Ñ¥½¸‘…µ…•EÕ•Éå-•ä ¤ì(€É•ÑÕÉ¸€‘íÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½µõð‘íÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹Ñ½õð‘íÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹åõ€ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸±½…‘1¥Ù•…µ…”¡™½É”€ô™…±Í”¤ì(€½¹ÍÐ­•ä€ô‘…µ…•EÕ•Éå-•ä ¤ì(€¥˜€¡±¥Ù•…µ…•MÑ…Ñ”¹±½…‘¥¹œñð€ …™½É”€˜˜±¥Ù•…µ…•MÑ…Ñ”¹É•…‘ä€˜˜±¥Ù•…µ…•MÑ…Ñ”¹­•ä€ôôô­•ä¤¤É•ÑÕÉ¸ì(€½¹ÍÐ¡…¹•‘¥±Ñ•È€ô±¥Ù•…µ…•MÑ…Ñ”¹­•ä€„ôô­•äì(€½¹ÍÐÉ•ÅÕ•ÍÑ%€ô€¬­±¥Ù•…µ…•MÑ…Ñ”¹É•ÅÕ•ÍÑ%ì(€±¥Ù•…µ…•MÑ…Ñ”¹­•ä€ô­•äì(€±¥Ù•…µ…•MÑ…Ñ”¹±½…‘¥¹œ€ôÑÉÕ”ì(€±¥Ù•…µ…•MÑ…Ñ”¹É•…‘ä€ô™…±Í”ì(€±¥Ù•…µ…•MÑ…Ñ”¹•ÉÉ½È€ô¹Õ±°ì(€¥˜€¡¡…¹•‘¥±Ñ•È¤ì(€€€±¥Ù•…µ…•MÑ…Ñ”¹É½ÝÌ€ô¹Õ±°ì(€€€±¥Ù•…µ…•MÑ…Ñ”¹•Ù¥‘•¹”€ô¹Õ±°ì(€€€±¥Ù•…µ…•MÑ…Ñ”¹•Ù¥‘•¹•I•…‘ä€ô™…±Í”ì(€ô(€¥˜€¡ÍÑ…Ñ”¹É½ÕÑ”€ôôô€‰‘…µ…”ˆ¤É•¹‘•È ¤ì(€ÑÉäì(€€€½¹ÍÐÉ•ÍÕ±Ð€ô…Ý…¥ÐAÉ½µ¥Í”¹…±±M•ÑÑ±•¡l(€€€€€Mˆ¹‘…µ…•Ì¡ì(€€€€€€€™É½´èÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½´°(€€€€€€€Ñ¼èÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹Ñ¼°(€€€€€€€½µÁ…¹äèÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä°(€€€€€€€±¥µ¥Ðè€ÔÀÀÀ°(€€€€€ô¤°(€€€€€Mˆ¹•Ù¥‘•¹•¥±•Ì¡ì™É½´èÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½´°Ñ¼èÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹Ñ¼°±¥µ¥Ðè€ÈÀÀÀô¤°(€€€t¤ì(€€€¥˜€¡É•ÅÕ•ÍÑ%€„ôô±¥Ù•…µ…•MÑ…Ñ”¹É•ÅÕ•ÍÑ%ñð­•ä€„ôô‘…µ…•EÕ•Éå-•ä ¤¤É•ÑÕÉ¸ì(€€€¥˜€¡É•ÍÕ±ÑlÁt¹ÍÑ…ÑÕÌ€ôôô€‰É•©•Ñ•ˆ¤Ñ¡É½ÜÉ•ÍÕ±ÑlÁt¹É•…Í½¸ì(€€€±¥Ù•…µ…•MÑ…Ñ”¹É½ÝÌ€ô€¡É•ÍÕ±ÑlÁt¹Ù…±Õ”ñðmt¤¹µ…À¡µ…Á1¥Ù•…µ…”¤ì(€€€±¥Ù•…µ…•MÑ…Ñ”¹½±±•Ñ¥½¹ÉÉ½È€ô¹Õ±°ì(€€€ÑÉäì(€€€€€½¹ÍÐ±•‘•È€ô…Ý…¥ÐMˆ¹‘…µ…•½±±•Ñ¥½¹Ì¡±¥Ù•…µ…•MÑ…Ñ”¹É½ÝÌ¹µ…À¡ôù¹‘‰%¤¤ì(€€€€€¥˜€¡É•ÅÕ•ÍÑ%€„ôô±¥Ù•…µ…•MÑ…Ñ”¹É•ÅÕ•ÍÑ%ñð­•ä€„ôô‘…µ…•EÕ•Éå-•ä ¤¤É•ÑÕÉ¸ì(€€€€€™½È€¡½¹ÍÐÉ½Ü½˜±¥Ù•…µ…•MÑ…Ñ”¹É½ÝÌ¤ì(€€€€€€€É½Ü¹½±±•Ñ¥½¹I•…‘äõÑÉÕ”ì(€€€€€€€½¹ÍÐ½±±•Ñ¥½¸õ±•‘•È¹½±±•Ñ¥½¹Ì¹™¥¹¡ŒôùŒ¹‘…µ…•}¥ôôõÉ½Ü¹‘‰%¤ì(€€€€€€€É½Ü¹É••¥ÁÑÌõ±•‘•È¹É••¥ÁÑÌ¹™¥±Ñ•È¡ÈôùÈ¹‘…µ…•}¥ôôõÉ½Ü¹‘‰%¤ì(€€€€€€€¥˜¡½±±•Ñ¥½¸¤ì(€€€€€€€€€¥˜¡½±±•Ñ¥½¸¹½µÁ…¹ä„ôõÉ½Ü¹½µÁ…¹äñð½±±•Ñ¥½¸¹…Ñ•½Éä„ôõ…µ…•MÕµµ…Éä¹±…ÍÍ¥™ä¡É½Ü¹…ÕÍ”¤¹…Ñ•½Éä¤Ñ¡É½Ü¹•ÜÉÉ½È Ÿ‚âk‚â‚âÓ‚â§‚âÇ‚â_‚â¯‚â‚âß‚â·‚âo‚â‚âÃ‚æ‚âƒ‚â_‚æ‚â‚â«‚æ‚â‡‚æ#‚âW‚â‚â‚â‹‚â·‚âS‚æ‚â‚â×‚â‹‚â‚æ‚â‚æ‚âk‚â_‚â×‚æ#‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÐƒ‚âW‚æ'‚â·‚â‚âW‚â‚âŸ‚â#‚â«‚â·‚âk‚â‚æ#‚â·‚âdœ¤ì(€€€€€€€€€½¹ÍÐÁ…¥‘•¹ÑÌõÉ½Ü¹É••¥ÁÑÌ¹™¥±Ñ•È¡Èôø…È¹Ù½¥‘•‘}…Ð¤¹É•‘Õ” ¡Ì±È¤ôùÌ­…µ…•MÕµµ…Éä¹•¹ÑÌ¡È¹…µ½Õ¹Ð¤°À¤ì(€€€€€€€€€É½Ü¹½±±•Ñ¥½¸õì¸¸¹½±±•Ñ¥½¸±Á…¥‘}…µ½Õ¹Ðè¡Á…¥‘•¹ÑÌ¼ÄÀÀ¤¹Ñ½¥á• È¥ôì(€€€€€€€€€€¼¼µÁ±½å•”¥‘•¹Ñ¥Ñä½µ•Ì½¹±ä™É½´•áÁ±¥¥Ñ±ä…ÁÁÉ½Ù•½±±•Ñ¥½¸‘•Ñ…¥±Ì¸(€€€€€€€€€¥˜¡½±±•Ñ¥½¸¹…Ñ•½Éäôôô•µÁ±½å•”œ¤É½Ü¹•µÁ±½å••½‘”õ½±±•Ñ¥½¸¹Á…ÉÑå}½‘”ì(€€€€€€€ô(€€€€€ô(€€€ô…Ñ ¡•ÉÉ½È¤ì±¥Ù•…µ…•MÑ…Ñ”¹½±±•Ñ¥½¹ÉÉ½Èõ•ÉÉ½È¹µ•ÍÍ…”ñð€Ÿ‚æ‚â¯‚â—‚âS‚â«‚â‡‚âã‚âS‚â‹‚â·‚âS‚æ‚â·‚âg‚â‚âß‚âg‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â œìô(€€€±¥Ù•…µ…•MÑ…Ñ”¹•Ù¥‘•¹”€ôÉ•ÍÕ±ÑlÅt¹ÍÑ…ÑÕÌ€ôôô€‰™Õ±™¥±±•ˆ€ü€¡É•ÍÕ±ÑlÅt¹Ù…±Õ”ñðmt¤€èmtì(€€€±¥Ù•…µ…•MÑ…Ñ”¹•Ù¥‘•¹•I•…‘ä€ôÉ•ÍÕ±ÑlÅt¹ÍÑ…ÑÕÌ€ôôô€‰™Õ±™¥±±•ˆì(€€€±¥Ù•…µ…•MÑ…Ñ”¹É•…‘ä€ôÑÉÕ”ì(€€€±¥Ù•…µ…•MÑ…Ñ”¹ÕÁ‘…Ñ•‘Ð€ô¹•Ü…Ñ” ¤ì(€€€¹‘…µ…•Ì€ô±¥Ù•…µ…•MÑ…Ñ”¹É½ÝÌ¹Í±¥” ¤ì(€ô…Ñ €¡•ÉÉ½È¤ì(€€€¥˜€¡É•ÅÕ•ÍÑ%€„ôô±¥Ù•…µ…•MÑ…Ñ”¹É•ÅÕ•ÍÑ%¤É•ÑÕÉ¸ì(€€€±¥Ù•…µ…•MÑ…Ñ”¹É½ÝÌ€ô¹Õ±°ì(€€€±¥Ù•…µ…•MÑ…Ñ”¹•ÉÉ½È€ô•ÉÉ½È¹µ•ÍÍ…”ñð€‹‚æ‚â¯‚â—‚âS‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ˆì(€ô™¥¹…±±äì(€€€¥˜€¡É•ÅÕ•ÍÑ%€ôôô±¥Ù•…µ…•MÑ…Ñ”¹É•ÅÕ•ÍÑ%¤ì(€€€€€±¥Ù•…µ…•MÑ…Ñ”¹±½…‘¥¹œ€ô™…±Í”ì(€€€€€¥˜€¡ÍÑ…Ñ”¹É½ÕÑ”€ôôô€‰‘…µ…”ˆ¤É•¹‘•È ¤ì(€€€ô(€ô)ô()…Íå¹Œ™Õ¹Ñ¥½¸½Á•¹…µ…•½±±•Ñ¥½¸¡É½Ü¤ì(€¥˜€ ……¸ ±½Í•}…Í”œ¤ñð€…Mˆ¹Í¥¹•‘%¸ ¤¤É•ÑÕÉ¸‘•¹ä Ÿ‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚â‹‚â·‚âS‚æ‚â‚â×‚â‹‚â‚æ‚â‚æ‚âhœ¤ì(€¥˜€ …É½Ü¹½±±•Ñ¥½¹I•…‘äñð±¥Ù•…µ…•MÑ…Ñ”¹½±±•Ñ¥½¹ÉÉ½È¤É•ÑÕÉ¸Ñ½…ÍÐ Ÿ‚æ‚â¯‚â—‚âS‚â«‚â‡‚âã‚âS‚â‹‚â·‚âS‚æ‚â·‚âg‚â‚âß‚âg‚æ‚â¯‚æ'‚â‚â‚âk‚â‚æ#‚â·‚âdœ°Ý…É¸œ¤ì(€½¹ÍÐ±…ÍÍ¥™¥…Ñ¥½¸õ…µ…•MÕµµ…Éä¹±…ÍÍ¥™ä¡É½Ü¹…ÕÍ”¤±…Ñ•½Éäõ±…ÍÍ¥™¥…Ñ¥½¸¹…Ñ•½Éäì(€¥˜€¡±…ÍÍ¥™¥…Ñ¥½¸¹½‰Í•ÉÙ…Ñ¥½¸¤É•ÑÕÉ¸Ñ½…ÍÐ Ÿ‚â‚âË‚â‹‚â‚âË‚â‚âg‚â×‚æ'‚æ‚âo‚æ‚âg‚â‚æ'‚â·‚â«‚âÇ‚â‚æ‚â‚âT€Àƒ‚âk‚âË‚â\ƒ‚â#‚âÛ‚â‚æ‚â‡‚æ#‚â«‚æ#‚â‚æ‚â‚æ'‚âË‚â‚âË‚â‚æ‚â‚âÓ‚âg‚â¯‚â‚âß‚â·‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚æ‚â‚â×‚â‹‚â‚æ‚â‚æ‚âhœ°Ý…É¸œ¤ì(€¥˜€ …l•µÁ±½å•”œ°‰…­½™™¥”œ°Á´œ°…µ”œ°•áÑ•É¹…°t¹¥¹±Õ‘•Ì¡…Ñ•½Éä¤¤É•ÑÕÉ¸Ñ½…ÍÐ Ÿ‚âo‚â‚âÃ‚æ‚âƒ‚â_‚æ‚âS‚âÓ‚â‡‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â+‚âÇ‚âS‚æ‚â#‚âdƒ‚æ‚â‡‚æ#‚æ‚â‚â×‚â‹‚â‚æ‚â‚æ‚âk‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÐœ°Ý…É¸œ¤ì(€½¹ÍÐ½±±•Ñ¥½¸õÉ½Ü¹½±±•Ñ¥½¸ì(€¥˜€ …½±±•Ñ¥½¸¤ì(€€€½Á•¹5½‘…° Ÿ‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚âs‚âç‚æ'‚â‚âÇ‚âk‚âs‚âÓ‚âS‚â+‚â·‚âk‚æ‚â—‚âÃ‚â‹‚â·‚âS‚æ‚â‚â×‚â‹‚â‚æ‚â‚æ‚âhœ°€ñÀû‚æ‚â‚â¨€‘í ¡É½Ü¹¥¥ôƒ
Ü€‘í ¡É½Ü¹½µÁ…¹ä¥ôƒ
Ü€‘í ¡…µ…•MÕµµ…Éä¹…Ñ•½É¥•Ím…Ñ•½Éåt¥ôƒ
Üƒ‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚âS‚âÓ‚â„€‘íµ½¹•ä¡É½Ü¹…µ½Õ¹Ð¥ôƒ‚âk‚âË‚â\ð½Àø(€€€€€€ñÀ±…ÍÌô‰¡¥¹Ðˆû‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â#‚âË‚â‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdƒ‚æ‚â‡‚æ#‚æ‚â+‚æ'‚â+‚âß‚æ#‚â·‚âs‚âç‚æ'‚âW‚â‚âŸ‚â#‚â¯‚â‚âß‚â·‚âs‚âç‚æ'‚â«‚æ#‚â‚æ‚â‡‚â—‚æ‚â_‚âg‚âs‚âç‚æ'‚â‚âÇ‚âk‚âs‚âÓ‚âS‚â+‚â·‚âhƒ‚â¯‚â—‚âÇ‚â‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚â#‚âÃ‚æ‚â‡‚æ#‚æ‚â‚â×‚â‹‚âg‚â_‚âÇ‚âk‚âW‚âÇ‚âŸ‚â‚âg‚æ‚âS‚âÓ‚â„ð½Àø(€€€€€€ñ±…‰•°û‚â‚â¯‚âÇ‚â«‚â{‚âg‚âÇ‚â‚â‚âË‚âd€¼ƒ‚â‚â¯‚âÇ‚â«‚âs‚âç‚æ'‚â‚âÇ‚âk‚âs‚âÓ‚âS‚â+‚â·‚âhñ¥¹ÁÕÐ¥ô‰½±±•Ñ¥½¹A…ÉÑå½‘”ˆµ…á±•¹Ñ ôˆÄÀÀˆÁ±…•¡½±‘•Èô‹‚â‚â¯‚âÇ‚â«‚âo‚â‚âÃ‚â#‚âÏ‚âW‚âÇ‚âŸ‚â_‚â×‚æ#‚âW‚â‚âŸ‚â#‚â«‚â·‚âk‚æ‚â—‚æ'‚âœƒ‚æ‚â‡‚æ#‚æ‚â+‚æ'‚â+‚âß‚æ#‚â·‚â·‚â‹‚æ#‚âË‚â‚æ‚âS‚â×‚â‹‚âœˆøð½±…‰•°ø(€€€€€€ñ±…‰•°û‚â+‚âß‚æ#‚â·‚âs‚âç‚æ'‚â‚âÇ‚âk‚âs‚âÓ‚âS‚â+‚â·‚âhñ¥¹ÁÕÐ¥ô‰½±±•Ñ¥½¹A…ÉÑå9…µ”ˆµ…á±•¹Ñ ôˆÈÀÀˆÙ…±Õ”ôˆ‘í ¡…Ñ•½Éäôôô•µÁ±½å•”œýÉ½Ü¹•µÁ±½å•”èœœ¥ôˆ€‘í…Ñ•½Éäôôô•µÁ±½å•”œüÉ•…‘½¹±äœèœôøð½±…‰•°ø(€€€€€€ñ±…‰•°û‚â‚âÀƒ‚âLƒ‚âŸ‚âÇ‚âg‚æ‚â‚âÓ‚âS‚æ‚â¯‚âW‚âàñ¥¹ÁÕÐ¥ô‰½±±•Ñ¥½¹M¡¥™Ðˆµ…á±•¹Ñ ôˆÌÈˆÙ…±Õ”ôˆ‘í ¡É½Ü¹Í¡¥™Ðôôôœ´œüœœéÉ½Ü¹Í¡¥™Ð¥ôˆ€‘í…Ñ•½Éäôôô•µÁ±½å•”œüÉ•…‘½¹±äœèœôøð½±…‰•°ø(€€€€€€ñ±…‰•°û‚â‹‚â·‚âS‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚æ‚â¯‚æ'‚æ‚â‚â×‚â‹‚â‚æ‚â‚æ‚âh€£‚âk‚âË‚â\¤ñ¥¹ÁÕÐ¥ô‰½±±•Ñ¥½¹ÁÁÉ½Ù•ˆÑåÁ”ô‰¹Õµ‰•Èˆµ¥¸ôˆÀˆµ…àôˆ‘í ¡É½Ü¹…µ½Õ¹Ð¥ôˆÍÑ•ÀôˆÀ¸ÀÄˆøð½±…‰•°ø(€€€€€€ñ±…‰•°û‚æ‚â¯‚âW‚âã‚âs‚â—‚æ‚â—‚âÃ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âW‚âÇ‚âŸ‚âW‚âd€¼ƒ‚â‹‚â·‚âPñÑ•áÑ…É•„¥ô‰½±±•Ñ¥½¹I•…Í½¸ˆøð½Ñ•áÑ…É•„øð½±…‰•°ø(€€€€€€ñ±…‰•°øñ¥¹ÁÕÐÑåÁ”ô‰¡•­‰½àˆ¥ô‰½±±•Ñ¥½¹%‘•¹Ñ¥Ñå¡•­•ˆû‚âW‚â‚âŸ‚â#‚âk‚â‚âÓ‚â§‚âÇ‚â\ƒ‚â‚â¯‚âÇ‚â¨ƒ‚â+‚âß‚æ#‚â´ƒ‚â‚âÀƒ‚æ‚â—‚âÃ‚â‹‚â·‚âS‚â#‚âË‚â‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â—‚æ'‚âœƒ‚æ‚âo‚æ‚âg‚âs‚âç‚æ'‚â‚âÇ‚âk‚âs‚âÓ‚âS‚â+‚â·‚âk‚â_‚â×‚æ#‚â[‚âç‚â‚âW‚æ'‚â·‚âð½±…‰•°ù€°€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰½±±•Ñ¥½¹…¹•°ˆû‚â‹‚â‚æ‚â—‚âÓ‚âð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ¥ô‰½±±•Ñ¥½¹M…Ù”ˆû‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚â‹‚â·‚âS‚æ‚â‚â×‚â‹‚â‚æ‚â‚æ‚âhð½‰ÕÑÑ½¸øœ¤ì(€€€€ œ½±±•Ñ¥½¹…¹•°œ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ±±½Í•5½‘…°¤ì(€€€€ œ½±±•Ñ¥½¹M…Ù”œ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ±…Íå¹Œ•Ù•¹Ðôùì(€€€€€¥˜ „ œ½±±•Ñ¥½¹%‘•¹Ñ¥Ñå¡•­•œ¤¹¡•­•¤É•ÑÕÉ¸Ñ½…ÍÐ Ÿ‚âW‚æ'‚â·‚â‚âW‚â‚âŸ‚â#‚æ‚â—‚âÃ‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âW‚âÇ‚âŸ‚âW‚âg‚â‚æ#‚â·‚âdœ°Ý…É¸œ¤ì(€€€€€½¹ÍÐ…µ½Õ¹Ðõ…µ…•MÕµµ…Éä¹•¹ÑÌ  œ½±±•Ñ¥½¹ÁÁÉ½Ù•œ¤¹Ù…±Õ”¤ì(€€€€€¥˜¡…µ½Õ¹Ðôôõ¹Õ±°ñð…µ½Õ¹Ðù…µ…•MÕµµ…Éä¹•¹ÑÌ¡É½Ü¹…µ½Õ¹Ð¤¤É•ÑÕÉ¸Ñ½…ÍÐ Ÿ‚â‹‚â·‚âS‚æ‚â‚â×‚â‹‚â‚æ‚â‚æ‚âk‚æ‚â‡‚æ#‚â[‚âç‚â‚âW‚æ'‚â·‚âœ°Ý…É¸œ¤ì(€€€€€½¹ÍÐ‰½‘äõíÁ}‘…µ…•}¥éÉ½Ü¹‘‰%±Á}Á…ÉÑå}½‘”è œ½±±•Ñ¥½¹A…ÉÑå½‘”œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤±Á}Á…ÉÑå}¹…µ”è œ½±±•Ñ¥½¹A…ÉÑå9…µ”œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤±Á}Í¡¥™Ðè œ½±±•Ñ¥½¹M¡¥™Ðœ¤¹Ù…±Õ”¹ÑÉ¥´ ¤±Á}…µ½Õ¹Ðé…µ½Õ¹Ð¼ÄÀÀ±Á}É•…Í½¸è œ½±±•Ñ¥½¹I•…Í½¸œ¤¹Ù…±Õ”¹ÑÉ¥´ ¥ôì(€€€€€¥˜ …‰½‘ä¹Á}Á…ÉÑå}½‘”ñð€…‰½‘ä¹Á}Á…ÉÑå}¹…µ”ñð‰½‘ä¹Á}É•…Í½¸¹±•¹Ñ ðÄÀñð€¡…Ñ•½Éäôôô•µÁ±½å•”œ€˜˜€ …‰½‘ä¹Á}Í¡¥™Ðñð‰½‘ä¹Á}Á…ÉÑå}¹…µ”ôôôŸ‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âàœ¤¤¤É•ÑÕÉ¸Ñ½…ÍÐ Ÿ‚â‚â¯‚âÇ‚â¨ƒ‚â+‚âß‚æ#‚â´ƒ‚â‚âÀƒ‚æ‚â—‚âÃ‚æ‚â¯‚âW‚âã‚âs‚â—‚âW‚æ'‚â·‚â‚â‚â‚âhƒ‚â¯‚æ'‚âË‚â‡‚æ‚âS‚âË‚âW‚âÇ‚âŸ‚â‚âdœ°Ý…É¸œ¤ì(€€€€€•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ð¹‘¥Í…‰±•õÑÉÕ”ì(€€€€€ÑÉäì…Ý…¥ÐMˆ¹…ÁÁÉ½Ù•…µ…•½±±•Ñ¥½¸¡‰½‘ä¤ì±½Í•5½‘…° ¤ì…Ý…¥Ð±½…‘1¥Ù•…µ…”¡ÑÉÕ”¤ìÑ½…ÍÐ Ÿ‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚â‹‚â·‚âS‚æ‚â‚â×‚â‹‚â‚æ‚â‚æ‚âk‚æ‚â—‚æ'‚âœƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚â‚âË‚â‚â‚âÇ‚âk‚æ‚â·‚âg‚â‚âß‚âdœ¤ìô(€€€€€…Ñ ¡•ÉÉ½È¤ì±½Í•5½‘…° ¤ì…Ý…¥Ð±½…‘1¥Ù•…µ…”¡ÑÉÕ”¤ìÑ½…ÍÐ Ÿ‚â‹‚âÇ‚â‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â‚âË‚â‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚æ‚â‡‚æ#‚æ‚âS‚æ$ƒ‚â‚â‚âã‚âO‚âË‚âW‚â‚âŸ‚â#‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚â‚æ#‚â·‚âg‚â—‚â·‚â‚æ‚â¯‚â‡‚æ è€œ­•ÉÉ½È¹µ•ÍÍ…”°Ý…É¸œ¤ìô(€€€ô¤ì(€€€É•ÑÕÉ¸ì(€ô(€±•Ð™¥±•Ìì(€ÑÉäì™¥±•Ìô¡…Ý…¥ÐMˆ¹•Ù¥‘•¹•¥±•Ì¡í™É½´éÉ½Ü¹‘…Ñ”±½µÁ…¹äéÉ½Ü¹½µÁ…¹ä±±¥µ¥ÐèÈÀÀÁô¤¤¹™¥±Ñ•È¡˜ôù˜¹½µÁ…¹äôôõÉ½Ü¹½µÁ…¹ä€˜˜˜¹ÍÑ½É…•}Á…Ñ €˜˜€…˜¹¥Í}…É¡¥Ù•¤ìô(€…Ñ ¡•ÉÉ½È¤ìÉ•ÑÕÉ¸Ñ½…ÍÐ Ÿ‚â‹‚âÇ‚â‚æ‚â¯‚â—‚âS‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â·‚âg‚â‚âß‚âg‚æ‚â‡‚æ#‚æ‚âS‚æ$è€œ­•ÉÉ½È¹µ•ÍÍ…”°Ý…É¸œ¤ìô(€½¹ÍÐÑ½Ñ…±Ìõ…µ…•MÕµµ…Éä¹½±±•Ñ¥½¹Q½Ñ…±Ì¡É½Ü¤°É•ÅÕ•ÍÑ%õÉåÁÑ¼¹É…¹‘½µUU% ¤ì(€½Á•¹5½‘…° Ÿ‚âW‚â‚âŸ‚â#‚â‹‚â·‚âS‚æ‚â·‚âg‚â‚âß‚âdƒŠPƒ‚æ‚â‡‚æ#‚æ‚â+‚æ#‚â‚âÏ‚â«‚âÇ‚æ#‚â‚æ‚â·‚âg‚æ‚â‚âÓ‚âdœ°€ñÀû‚æ‚â‚â¨€‘í ¡É½Ü¹¥¥ôƒ
Ü€‘í ¡É½Ü¹½µÁ…¹ä¥ôƒ
Ü€‘í ¡½±±•Ñ¥½¸¹Á…ÉÑå}¹…µ”¥ôƒ
Üƒ‚â‚â¯‚âÇ‚â¨€‘í ¡½±±•Ñ¥½¸¹Á…ÉÑå}½‘”¥ôƒ
Üƒ‚â‚âÀ€‘í ¡½±±•Ñ¥½¸¹Í¡¥™Ðñð€Ÿ‚æ‚â‡‚æ#‚æ‚â‚â×‚æ#‚â‹‚âŸ‚â‚âÇ‚âk‚â‚âÀœ¥ôð½Àø(€€€€ñÀû‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÐ€‘íµ½¹•ä¡Ñ½Ñ…±Ì¹…ÁÁÉ½Ù•¥ôƒ
Üƒ‚â‚âÇ‚âk‚â‚âß‚âg‚æ‚â—‚æ'‚âœ€‘íµ½¹•ä¡Ñ½Ñ…±Ì¹Á…¥¥ôƒ
Üƒ‚â‚â‚æ‚â¯‚â—‚âß‚â´€‘íµ½¹•ä¡Ñ½Ñ…±Ì¹¹•Ð¥ôƒ‚âk‚âË‚â\ð½Àø(€€€€ñÀ±…ÍÌô‰¡¥¹Ðˆû‚æ‚â—‚âß‚â·‚â‚æ‚â'‚â{‚âË‚âÃ‚â«‚â—‚âÓ‚âo‚â¯‚â‚âß‚â·‚æ‚â·‚â‚â«‚âË‚â‚â_‚â×‚æ#‚âW‚â‚âŸ‚â#‚âŸ‚æ#‚âË‚â‚âÇ‚âk‚æ‚â‚âÓ‚âg‚â#‚â‚âÓ‚â‚æ‚â—‚æ'‚âŸ‚â‚â·‚â‚â‚âË‚â‹‚â‚âË‚â‚âg‚â×‚æ$ƒ‚â‚â¯‚âÇ‚â«‚æ‚â·‚âg‚æ‚â—‚âÃ‚æ‚â‚â—‚æ3‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â¯‚âg‚âÛ‚æ#‚â‚â‚âË‚â‹‚â‚âË‚â‚â¯‚âÇ‚â‚æ‚âS‚æ'‚â‚â‚âÇ‚æ'‚â‚æ‚âS‚â×‚â‹‚âœƒ‚â¯‚âË‚â‚æ‚â·‚âg‚â‚âŸ‚â‡‚â¯‚â—‚âË‚â‹‚æ‚â‚â«‚æ‚â¯‚æ'‚â«‚æ#‚â‚âW‚â‚âŸ‚â#‚â#‚âÇ‚âS‚â«‚â‚âŒƒ‚æ‚â‡‚æ#‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â/‚æ'‚âÌð½Àø(€€€€ñ±…‰•°û‚âŸ‚âÇ‚âg‚â_‚â×‚æ#‚æ‚â·‚âg‚â‚âß‚âdñ¥¹ÁÕÐ¥ô‰É••¥ÁÑ…Ñ”ˆÑåÁ”ô‰‘…Ñ”ˆµ¥¸ôˆ‘í ¡É½Ü¹‘…Ñ”¥ôˆøð½±…‰•°ø(€€€€ñ±…‰•°û‚â‹‚â·‚âS‚æ‚â·‚âg‚â‚âß‚âg‚â_‚â×‚æ#‚â‹‚âß‚âg‚â‹‚âÇ‚âd€£‚âk‚âË‚â\¤ñ¥¹ÁÕÐ¥ô‰É••¥ÁÑµ½Õ¹ÐˆÑåÁ”ô‰¹Õµ‰•Èˆµ¥¸ôˆÀ¸ÀÄˆµ…àôˆ‘í ¡Ñ½Ñ…±Ì¹¹•Ð¥ôˆÍÑ•ÀôˆÀ¸ÀÄˆøð½±…‰•°ø(€€€€ñ±…‰•°û‚æ‚â—‚â‚â·‚æ'‚âË‚â‚â·‚âÓ‚â‚â‚âË‚â‚æ‚â·‚âg‚â#‚âË‚â‚âc‚âg‚âË‚â‚âË‚âŒñ¥¹ÁÕÐ¥ô‰É••¥ÁÑI•™•É•¹”ˆµ…á±•¹Ñ ôˆÈÀÀˆøð½±…‰•°ø(€€€€ñ±…‰•°û‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚âg‚â‚âÃ‚âk‚âk‚âk‚â‚âÓ‚â§‚âÇ‚â_‚æ‚âS‚â×‚â‹‚âŸ‚â‚âÇ‚âdñÍ•±•Ð¥ô‰É••¥ÁÑÙ¥‘•¹”ˆøñ½ÁÑ¥½¸Ù…±Õ”ôˆˆû‚æ‚â—‚âß‚â·‚â‚æ‚â‚â—‚æ3‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â·‚âg‚â‚âß‚âdð½½ÁÑ¥½¸ø‘í™¥±•Ì¹µ…À¡˜ôù€ñ½ÁÑ¥½¸Ù…±Õ”ôˆ‘í ¡˜¹¥¥ôˆø‘í ¡˜¹™¥±•}¹…µ”¥ôð½½ÁÑ¥½¸ù€¤¹©½¥¸ œœ¥ôð½Í•±•Ðøð½±…‰•°ø(€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰É••¥ÁÑAÉ•Ù¥•Üˆû‚æ‚âo‚âÓ‚âS‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â·‚âg‚â‚âß‚âg‚æ‚âg‚â¯‚âg‚æ'‚âË‚âW‚æ#‚âË‚â‚æ‚â¯‚â‡‚æ ð½‰ÕÑÑ½¸ø(€€€€ñ±…‰•°û‚âs‚â—‚âW‚â‚âŸ‚â#‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â—‚âÃ‚âs‚âç‚æ'‚â+‚âÏ‚â‚âÀñÑ•áÑ…É•„¥ô‰É••¥ÁÑ9½Ñ”ˆøð½Ñ•áÑ…É•„øð½±…‰•°ø(€€€€ñ±…‰•°øñ¥¹ÁÕÐ¥ô‰É••¥ÁÑ¡•­•ˆÑåÁ”ô‰¡•­‰½àˆû‚âW‚â‚âŸ‚â#‚âŸ‚æ#‚âË‚â‚âÇ‚âk‚æ‚â‚âÓ‚âg‚â#‚â‚âÓ‚â‚æ‚â—‚æ'‚âœƒ‚æ‚â—‚âÃ‚âW‚â‚â‚âk‚â‚âÓ‚â§‚âÇ‚â\€¼ƒ‚âs‚âç‚æ'‚â‚âÇ‚âk‚âs‚âÓ‚âS‚â+‚â·‚âh€¼ƒ‚æ‚â‚â«‚âg‚â×‚æ$ƒ‚æ‚â‡‚æ#‚æ‚â+‚æ#‚â‹‚â·‚âS‚â_‚â×‚æ#‚â‚âË‚âS‚âŸ‚æ#‚âË‚â#‚âÃ‚æ‚â·‚âdð½±…‰•°ø(€€€€ñ Ìû‚âo‚â‚âÃ‚âŸ‚âÇ‚âW‚âÓ‚â‚âË‚â‚â‚âÇ‚âk‚â‚âß‚âdð½ Ìø‘ì¡É½Ü¹É••¥ÁÑÌñðmt¤¹µ…À¡Èôù€ñÀø‘í ¡‘¥ÍÁ±…åQ¥µ”¡È¹Á…¥‘}…Ð¤¥ôƒ
Ü€‘íµ½¹•ä¡È¹…µ½Õ¹Ð¥ôƒ
Ü€‘í ¡È¹ÑÉ…¹Í™•É}É•™•É•¹”¥ôƒ
Ü€‘íÈ¹Ù½¥‘•‘}…ÐüŸ‚â‹‚â‚æ‚â—‚âÓ‚â‚æ‚â—‚æ'‚âœè€œ­ ¡È¹Ù½¥‘}É•…Í½¸¤éƒ‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚æ‚â—‚æ'‚âœ€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ‘…Ñ„µÙ½¥µÉ••¥ÁÐôˆ‘í ¡È¹¥¥ôˆû‚â‹‚â‚æ‚â—‚âÓ‚â‚âk‚âÇ‚âg‚â_‚âÛ‚â‚âs‚âÓ‚âPð½‰ÕÑÑ½¸ùôð½Àù€¤¹©½¥¸ œœ¤ñð€œñÀû‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚â‚âË‚â‹‚â‚âË‚â‚æ‚â·‚âg‚â‚âß‚âdð½Àøõ€°€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰É••¥ÁÑ…¹•°ˆû‚â‹‚â‚æ‚â—‚âÓ‚âð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ¥ô‰É••¥ÁÑM…Ù”ˆû‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â‚âÇ‚âk‚æ‚â·‚âg‚â‚âß‚âg‚âW‚âË‚â‡‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdð½‰ÕÑÑ½¸øœ¤ì(€€ œÉ••¥ÁÑ…¹•°œ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ±±½Í•5½‘…°¤ì(€€ œÉ••¥ÁÑÙ¥‘•¹”œ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ¡…¹”œ° ¤ôùì€ œÉ••¥ÁÑ¡•­•œ¤¹¡•­•õ™…±Í”ìô¤ì(€€ œÉ••¥ÁÑAÉ•Ù¥•Üœ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ±…Íå¹Œ ¤ôùì(€€€½¹ÍÐ™¥±”õ™¥±•Ì¹™¥¹¡˜ôù˜¹¥ôôô œÉ••¥ÁÑÙ¥‘•¹”œ¤¹Ù…±Õ”¤ì(€€€¥˜ …™¥±”¤É•ÑÕÉ¸Ñ½…ÍÐ Ÿ‚æ‚â—‚âß‚â·‚â‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â‚æ#‚â·‚âdœ°Ý…É¸œ¤ì(€€€½¹ÍÐÁÉ•Ù¥•ÜõÝ¥¹‘½Ü¹½Á•¸ …‰½ÕÐé‰±…¹¬œ°}‰±…¹¬œ¤ì(€€€¥˜¡ÁÉ•Ù¥•Ü¤ÁÉ•Ù¥•Ü¹½Á•¹•Èõ¹Õ±°ì(€€€ÑÉäì½¹ÍÐÕÉ°õ…Ý…¥ÐMˆ¹Í¥¹•‘UÉ°¡™¥±”¹ÍÑ½É…•}Á…Ñ ¤ì¥˜¡ÁÉ•Ù¥•Ü¤ÁÉ•Ù¥•Ü¹±½…Ñ¥½¸¹¡É•˜õÕÉ°ì•±Í”Ñ½…ÍÐ Ÿ‚æ‚âk‚â‚âË‚âŸ‚æ3‚æ‚â/‚â·‚â‚æ3‚âk‚â—‚æ‚â·‚â‚â¯‚âg‚æ'‚âË‚âW‚æ#‚âË‚âƒ‚â‚â‚âã‚âO‚âË‚æ‚âo‚âÓ‚âS‚æ‚â‚â—‚æ3‚â#‚âË‚â‚â‚â—‚æ#‚â·‚â‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdœ°Ý…É¸œ¤ìô(€€€…Ñ ¡•ÉÉ½È¤ì¥˜¡ÁÉ•Ù¥•Ü¤ÁÉ•Ù¥•Ü¹±½Í” ¤ìÑ½…ÍÐ Ÿ‚æ‚âo‚âÓ‚âS‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â‡‚æ#‚æ‚âS‚æ$è€œ­•ÉÉ½È¹µ•ÍÍ…”°Ý…É¸œ¤ìô(€ô¤ì(€‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µÙ½¥µÉ••¥ÁÑtœ¤¹™½É… ¡‰ÕÑÑ½¸ôù‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ° ¤ôùì(€€€½¹ÍÐÉ••¥ÁÑ%õ‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹Ù½¥‘I••¥ÁÐì(€€€½Á•¹5½‘…° Ÿ‚â‹‚â‚æ‚â—‚âÓ‚â‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â·‚âg‚â‚âß‚âg‚âs‚âÓ‚âPƒŠPƒ‚æ‚â‚æ‚âk‚âo‚â‚âÃ‚âŸ‚âÇ‚âW‚âÓ‚æ‚âS‚âÓ‚â„œ°€œñ±…‰•°û‚æ‚â¯‚âW‚âã‚âs‚â—‚æ‚â—‚âÃ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â_‚â×‚æ#‚âW‚â‚âŸ‚â#‚âŸ‚æ#‚âË‚âk‚âÇ‚âg‚â_‚âÛ‚â‚âs‚âÓ‚âPñÑ•áÑ…É•„¥ô‰É••¥ÁÑY½¥‘I•…Í½¸ˆøð½Ñ•áÑ…É•„øð½±…‰•°øœ°€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰É••¥ÁÑY½¥‘…¹•°ˆû‚â‹‚â‚æ‚â—‚âÓ‚âð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ¥ô‰É••¥ÁÑY½¥‘M…Ù”ˆû‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â‹‚â‚æ‚â—‚âÓ‚â‚â‚âË‚â‹‚â‚âË‚âŒð½‰ÕÑÑ½¸øœ¤ì(€€€€ œÉ••¥ÁÑY½¥‘…¹•°œ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ±±½Í•5½‘…°¤ì(€€€€ œÉ••¥ÁÑY½¥‘M…Ù”œ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ±…Íå¹Œ•Ù•¹Ðôùì(€€€€€½¹ÍÐÉ•…Í½¸ô œÉ••¥ÁÑY½¥‘I•…Í½¸œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤ì(€€€€€¥˜¡É•…Í½¸¹±•¹Ñ ðÄÀ¤É•ÑÕÉ¸Ñ½…ÍÐ Ÿ‚â‚âÃ‚âk‚âã‚æ‚â¯‚âW‚âã‚âs‚â—‚â·‚â‹‚æ#‚âË‚â‚âg‚æ'‚â·‚âˆ€ÄÀƒ‚âW‚âÇ‚âŸ‚â·‚âÇ‚â‚â§‚âŒœ°Ý…É¸œ¤ì(€€€€€•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ð¹‘¥Í…‰±•õÑÉÕ”ì(€€€€€ÑÉäì…Ý…¥ÐMˆ¹Ù½¥‘…µ…•I••¥ÁÐ¡É••¥ÁÑ%±É•…Í½¸¤ì±½Í•5½‘…° ¤ì…Ý…¥Ð±½…‘1¥Ù•…µ…”¡ÑÉÕ”¤ìÑ½…ÍÐ Ÿ‚â‹‚â‚æ‚â—‚âÓ‚â‚âk‚âÇ‚âg‚â_‚âÛ‚â‚âs‚âÓ‚âS‚æ‚â—‚âÃ‚æ‚â‚æ‚âk‚âo‚â‚âÃ‚âŸ‚âÇ‚âW‚âÓ‚æ‚â—‚æ'‚âœœ¤ìô(€€€€€…Ñ ¡•ÉÉ½È¤ì±½Í•5½‘…° ¤ì…Ý…¥Ð±½…‘1¥Ù•…µ…”¡ÑÉÕ”¤ìÑ½…ÍÐ Ÿ‚â‹‚âÇ‚â‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âs‚â—‚æ‚â‡‚æ#‚æ‚âS‚æ$è€œ­•ÉÉ½È¹µ•ÍÍ…”°Ý…É¸œ¤ìô(€€€ô¤ì(€ô¤¤ì(€€ œÉ••¥ÁÑM…Ù”œ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ±…Íå¹Œ•Ù•¹Ðôùì(€€€½¹ÍÐ…µ½Õ¹Ðõ…µ…•MÕµµ…Éä¹•¹ÑÌ  œÉ••¥ÁÑµ½Õ¹Ðœ¤¹Ù…±Õ”¤ì(€€€¥˜ „ œÉ••¥ÁÑ¡•­•œ¤¹¡•­•ñð…µ½Õ¹Ðôôõ¹Õ±°ñð…µ½Õ¹ÐðôÀñð…µ½Õ¹Ðù…µ…•MÕµµ…Éä¹•¹ÑÌ¡Ñ½Ñ…±Ì¹¹•Ð¤¤É•ÑÕÉ¸Ñ½…ÍÐ Ÿ‚âW‚â‚âŸ‚â#‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â—‚âÃ‚â‚âÃ‚âk‚âã‚â‹‚â·‚âS‚æ‚â‡‚æ#‚æ‚â‚âÓ‚âg‚â‚â‚æ‚â¯‚â—‚âß‚â´œ°Ý…É¸œ¤ì(€€€½¹ÍÐ‰½‘äõíÁ}¥éÉ•ÅÕ•ÍÑ%±Á}‘…µ…•}¥éÉ½Ü¹‘‰%±Á}Á…¥‘}…Ðè œÉ••¥ÁÑ…Ñ”œ¤¹Ù…±Õ”±Á}…µ½Õ¹Ðé…µ½Õ¹Ð¼ÄÀÀ±Á}É•™•É•¹”è œÉ••¥ÁÑI•™•É•¹”œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤±Á}Í½ÕÉ•}™¥±•}¥è œÉ••¥ÁÑÙ¥‘•¹”œ¤¹Ù…±Õ”±Á}¹½Ñ”è œÉ••¥ÁÑ9½Ñ”œ¤¹Ù…±Õ”¹ÑÉ¥´ ¥ôì(€€€¥˜ …‰½‘ä¹Á}Á…¥‘}…Ðñð€…‰½‘ä¹Á}É•™•É•¹”ñð€…‰½‘ä¹Á}Í½ÕÉ•}™¥±•}¥ñð‰½‘ä¹Á}¹½Ñ”¹±•¹Ñ ðÄÀ¤É•ÑÕÉ¸Ñ½…ÍÐ Ÿ‚âŸ‚âÇ‚âg‚â_‚â×‚æ ƒ‚â‚â¯‚âÇ‚â«‚æ‚â·‚âdƒ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdƒ‚æ‚â—‚âÃ‚æ‚â¯‚âW‚âã‚âs‚â—‚âW‚æ'‚â·‚â‚â‚â‚âhœ°Ý…É¸œ¤ì(€€€•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ð¹‘¥Í…‰±•õÑÉÕ”ì(€€€ÑÉäì…Ý…¥ÐMˆ¹½¹™¥Éµ…µ…•I••¥ÁÐ¡‰½‘ä¤ì±½Í•5½‘…° ¤ì…Ý…¥Ð±½…‘1¥Ù•…µ…”¡ÑÉÕ”¤ìÑ½…ÍÐ Ÿ‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â‹‚â·‚âS‚æ‚â·‚âg‚â‚âß‚âg‚æ‚â—‚æ'‚âœƒ‚æ‚â‡‚æ#‚æ‚âo‚â—‚â×‚æ#‚â‹‚âg‚â‹‚â·‚âS‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚âS‚âÓ‚â„œ¤ìô(€€€…Ñ ¡•ÉÉ½È¤ì±½Í•5½‘…° ¤ì…Ý…¥Ð±½…‘1¥Ù•…µ…”¡ÑÉÕ”¤ìÑ½…ÍÐ Ÿ‚â‹‚âÇ‚â‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â‹‚â·‚âS‚æ‚â·‚âg‚æ‚â‡‚æ#‚æ‚âS‚æ$ƒ‚âW‚â‚âŸ‚â#‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚â‚æ#‚â·‚âg‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â/‚æ'‚âÌè€œ­•ÉÉ½È¹µ•ÍÍ…”°Ý…É¸œ¤ìô(€ô¤ì)ô()™Õ¹Ñ¥½¸É•¹‘•É1¥Ù•…µ…”¡É½½Ð¤ì(€½¹ÍÐ­•ä€ô‘…µ…•EÕ•Éå-•ä ¤ì(€½¹ÍÐÍÑ…±”€ô±¥Ù•…µ…•MÑ…Ñ”¹­•ä€„ôô­•äì(€¥˜€ ¡ÍÑ…±”ñð€…±¥Ù•…µ…•MÑ…Ñ”¹É•…‘ä¤€˜˜€…±¥Ù•…µ…•MÑ…Ñ”¹±½…‘¥¹œ€˜˜€ …±¥Ù•…µ…•MÑ…Ñ”¹•ÉÉ½ÈñðÍÑ…±”¤¤±½…‘1¥Ù•…µ…”¡ÍÑ…±”¤ì(€¥˜€¡±¥Ù•…µ…•MÑ…Ñ”¹±½…‘¥¹œ€˜˜€¡ÍÑ…±”ñð€…±¥Ù•…µ…•MÑ…Ñ”¹É½ÝÌ¤¤ì(€€€É½½Ð¹¥¹¹•É!Q50€ô€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°±¥Ù”µ±½…‘¥¹œˆøñÍÁ…¸±…ÍÌô‰ÍÁ¥¹¹•Èˆøð½ÍÁ…¸øñ‘¥Øøñ Èû‚â‚âÏ‚â—‚âÇ‚â‚æ‚â¯‚â—‚âS‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â#‚â‚âÓ‚âð½ ÈøñÀ±…ÍÌô‰¡¥¹Ðˆû‚â·‚æ#‚âË‚âg‚æ‚â'‚â{‚âË‚âÃ‚â‚æ'‚â·‚â‡‚âç‚â—‚â_‚â×‚æ#‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚æ‚âo‚æ‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚â—‚æ'‚âŸ‚â#‚âË‚âMÕÁ…‰…Í”¸¸¸ð½Àøð½‘¥Øøð½Í•Ñ¥½¸ù€ì(€€€É•ÑÕÉ¸ì(€ô(€¥˜€¡±¥Ù•…µ…•MÑ…Ñ”¹•ÉÉ½È€˜˜€…±¥Ù•…µ…•MÑ…Ñ”¹É½ÝÌ¤ì(€€€É½½Ð¹¥¹¹•É!Q50€ô€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆøñ‘¥Ø±…ÍÌô‰…±•ÉÐ‰…ˆøñÍÑÉ½¹œû‚æ‚â¯‚â—‚âS‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ð½ÍÑÉ½¹œøñÍÁ…¸ø‘í ¡±¥Ù•…µ…•MÑ…Ñ”¹•ÉÉ½È¥ôð½ÍÁ…¸øñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰‘…µ…•I•ÑÉäˆû‚â—‚â·‚â‚æ‚â¯‚â‡‚æ ð½‰ÕÑÑ½¸øð½‘¥Øøð½Í•Ñ¥½¸ù€ì(€€€€ ˆ‘…µ…•I•ÑÉäˆ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø±½…‘1¥Ù•…µ…”¡ÑÉÕ”¤¤ì(€€€É•ÑÕÉ¸ì(€ô(€½¹ÍÐÍ½Á•‘I½ÝÌ€ô€¡±¥Ù•…µ…•MÑ…Ñ”¹É½ÝÌñðmt¤¹™¥±Ñ•È ¡¤€ôø¥¹I…¹”¡¹‘…Ñ”¤€˜˜€¡ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä€ôôô€‰10ˆñð¹½µÁ…¹ä€ôôôÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä¤¤ì(€½¹ÍÐ…Ñ•½ÉåI½ÝÌ€ôÍ½Á•‘I½ÝÌ¹™¥±Ñ•È¡€ôø±¥Ù•…µ…•MÑ…Ñ”¹…Ñ•½Éä€ôôô€10œñð…µ…•MÕµµ…Éä¹±…ÍÍ¥™ä¡¹…ÕÍ”¤¹…Ñ•½Éä€ôôô±¥Ù•…µ…•MÑ…Ñ”¹…Ñ•½Éä¤ì(€½¹ÍÐÑ•…µI½ÝÌ€ô…Ñ•½ÉåI½ÝÌ¹™¥±Ñ•È¡€ôø€…±¥Ù•…µ…•MÑ…Ñ”¹Ñ•…´ñð±¥Ù•…µ…•MÑ…Ñ”¹Ñ•…´€ôôô€10œñð…µ…•MÕµµ…Éä¹Ñ•…µ½‘”¡¤€ôôô±¥Ù•…µ…•MÑ…Ñ”¹Ñ•…´¤ì(€½¹ÍÐÉ½ÝÌ€ôÑ•…µI½ÝÌ¹™¥±Ñ•È¡€ôø€…±¥Ù•…µ…•MÑ…Ñ”¹•µÁ±½å•”ñð±¥Ù•…µ…•MÑ…Ñ”¹•µÁ±½å•”€ôôô€10œñð…µ…•MÕµµ…Éä¹•µÁ±½å••-•ä¡¤€ôôô±¥Ù•…µ…•MÑ…Ñ”¹•µÁ±½å•”¤ì(€½¹ÍÐ½‰Í•ÉÙ…Ñ¥½¹I½ÝÌõÉ½ÝÌ¹™¥±Ñ•È¡ôù…µ…•MÕµµ…Éä¹±…ÍÍ¥™ä¡¹…ÕÍ”¤¹½‰Í•ÉÙ…Ñ¥½¸¤ì(€½¹ÍÐ™¥¹…¹¥…±I½ÝÌõÉ½ÝÌ¹™¥±Ñ•È¡ôø……µ…•MÕµµ…Éä¹±…ÍÍ¥™ä¡¹…ÕÍ”¤¹½‰Í•ÉÙ…Ñ¥½¸¤ì(€½¹ÍÐ±…ÍÍ¥™¥•‘MÕµµ…Éä€ô…µ…•MÕµµ…Éä¹ÍÕµµ…É¥é”¡É½ÝÌ¤ì(€½¹ÍÐ‘É¥±±Q…‰±”€ô€¡É•½É‘Ì°™¥•±°Ñ¥Ñ±”¤€ôøì(€€€½¹ÍÐÍÕµµ…Éä€ô…µ…•MÕµµ…Éä¹É½ÕÁ	ä¡É•½É‘Ì°™¥•±¤ì(€€€É•ÑÕÉ¸€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°‘…µ…”µ‘É¥±°ˆøñ Èø‘íÑ¥Ñ±•ôð½ ÈøñÀ±…ÍÌô‰¡¥¹Ðˆû‚â‚âS‚â‹‚â·‚âS‚â‚âŸ‚â‡‚æ‚â{‚âß‚æ#‚â·‚âS‚âç‚â#‚âÏ‚âg‚âŸ‚âg‚â‚â‚âÇ‚æ'‚âƒ‚âŸ‚âÇ‚âdƒ‚æ‚âŸ‚â—‚âÈƒ‚æ‚â—‚âÃ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdƒ
Üƒ‚â+‚âß‚æ#‚â·‚â/‚æ'‚âÏ‚æ‚â‹‚â‚âW‚âË‚â‡‚âk‚â‚âÓ‚â§‚âÇ‚â\ƒ‚â‚â¯‚âÇ‚â¨ƒ‚æ‚â—‚âÃ‚â‚âÀƒ
Üƒ‚æ‚â‡‚æ#‚â_‚â‚âË‚âk‚â‚â¯‚âÇ‚â«‚â#‚âÃ‚æ‚â‹‚â‚æ‚âŸ‚æ'‚â‚âË‚â‹‚æ‚â‚â¨ƒ‚æ‚â‡‚æ#‚â‚âŸ‚â‡‚æ‚âo‚æ‚âg‚â‚âg‚æ‚âS‚â×‚â‹‚âŸ‚â‚âÇ‚âdð½Àøñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…ÀˆøñÑ…‰±”øñÑ¡•…øñÑÈøñÑ ø‘í™¥•±ôôôÑ•…´œüŸ‚â‚â¯‚âÇ‚â«‚â_‚â×‚â„œèŸ‚â+‚âß‚æ#‚â´ƒ
Üƒ‚â‚âÀƒ
Üƒ‚âk‚â‚âÓ‚â§‚âÇ‚â\ƒ
Üƒ‚â‚â¯‚âÇ‚â¨ôð½Ñ øñÑ û‚â#‚âÏ‚âg‚âŸ‚âg‚â‚â‚âÇ‚æ'‚âð½Ñ øñÑ û‚â‹‚â·‚âS‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚âS‚âÓ‚â„ð½Ñ ø‘í=‰©•Ð¹•¹ÑÉ¥•Ì¡…µ…•MÕµµ…Éä¹…Ñ•½É¥•Ì¤¹™¥±Ñ•È ¡m­•åt¤ôø…lÍåÍÑ•´œ°Õ¹±…ÍÍ¥™¥•t¹¥¹±Õ‘•Ì¡­•ä¤¤¹µ…À ¡l±±…‰•±t¤ôù€ñÑ ±…ÍÌô‰É¥¡Ðˆø‘í ¡±…‰•°¥÷‚â«‚âã‚â_‚âc‚âÓ‚â‚â‚æ‚â¯‚â—‚âß‚â´ð½Ñ ù€¤¹©½¥¸ œœ¥ôñÑ û‚â‚âÇ‚âk‚æ‚â·‚âg‚â‚âß‚âg‚æ‚â—‚æ'‚âœð½Ñ øñÑ û‚â‚â·‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â‹‚â·‚âS‚æ‚â‚â×‚â‹‚â‚æ‚â‚æ‚âhð½Ñ øð½ÑÈøð½Ñ¡•…øñÑ‰½‘äø‘íÍÕµµ…Éä¹µ…À¡œôù€ñÑÈøñÑø‘í ¡œ¹±…‰•°¥ôð½ÑøñÑø‘í¹Õ´¡œ¹É½ÕÁÌ¹É•‘Õ” ¡Ì±Œ¤ôùÌ­Œ¹½Õ¹Ð°À¤¥ôð½ÑøñÑ±…ÍÌô‰É¥¡Ðˆøñ‰ÕÑÑ½¸±…ÍÌô‰±¥¹¬µ‰Ñ¸Ñ¹Õ´ˆ‘…Ñ„µ‘…µ…”µ‘É¥±°ôˆ‘í™¥•±‘ôˆ‘…Ñ„µ‘…µ…”µÙ…±Õ”ôˆ‘í ¡œ¹­•ä¥ôˆø‘íµ½¹•ä¡œ¹Ñ½Ñ…°¥ôð½‰ÕÑÑ½¸øð½Ñø‘íœ¹¹•ÑÉ½ÕÁÌ¹™¥±Ñ•È¡Œôø…lÍåÍÑ•´œ°Õ¹±…ÍÍ¥™¥•t¹¥¹±Õ‘•Ì¡Œ¹…Ñ•½Éä¤¤¹µ…À¡Œôù€ñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í±¥Ù•…µ…•MÑ…Ñ”¹½±±•Ñ¥½¹ÉÉ½ÈüŸŠPœéµ½¹•ä¡Œ¹¹•Ð¥ô‘íŒ¹Á•¹‘¥¹œý€ñÍµ…±°±…ÍÌô‰ÍÕˆˆû‚â‚â·‚â‹‚âß‚âg‚â‹‚âÇ‚âd€‘í¹Õ´¡Œ¹Á•¹‘¥¹œ¥ôƒ‚æ‚â‚â¨ð½Íµ…±°ù€èœôð½Ñù€¤¹©½¥¸ œœ¥ôñÑø‘í±¥Ù•…µ…•MÑ…Ñ”¹½±±•Ñ¥½¹ÉÉ½ÈüŸŠPœéµ½¹•ä¡œ¹¹•ÑÉ½ÕÁÌ¹É•‘Õ” ¡Ì±Œ¤ôùÌ­Œ¹Á…¥°À¤¥ôð½ÑøñÑø‘í¹Õ´¡œ¹¹•ÑÉ½ÕÁÌ¹É•‘Õ” ¡Ì±Œ¤ôùÌ­Œ¹Á•¹‘¥¹œ°À¤¥ôƒ‚æ‚â‚â¨ð½Ñøð½ÑÈù€¤¹©½¥¸ œœ¤ñð€ñÑÈøñÑ½±ÍÁ…¸ôˆÄÀˆ±…ÍÌô‰•µÁÑäˆû‚æ‚â‡‚æ#‚â‡‚â×‚â‚âË‚â‹‚â‚âË‚â‚â_‚â×‚æ#‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚æ‚â—‚æ'‚âœð½Ñøð½ÑÈùôð½Ñ‰½‘äøð½Ñ…‰±”øð½‘¥Øøð½Í•Ñ¥½¸ù€ì(€ôì(€½¹ÍÐ•Ù¥‘•¹•I½ÝÌ€ô€¡±¥Ù•…µ…•MÑ…Ñ”¹•Ù¥‘•¹”ñðmt¤¹™¥±Ñ•È ¡™¥±”¤€ôøì(€€€½¹ÍÐ½µÁ…¹ä€ô¹½Éµ…±¥é•1¥Ù•½µÁ…¹å½‘”¡™¥±”¹½µÁ…¹äñð™¥±”¹‰…Ñ¡}½µÁ…¹ä¤ì(€€€É•ÑÕÉ¸™¥±”¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”€˜˜¥¹I…¹”¡™¥±”¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”¤€˜˜…¹•ÍÍ½µÁ…¹ä¡½µÁ…¹ä¤€˜˜€¡ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä€ôôô€‰10ˆñð½µÁ…¹ä€ôôôÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä¤ì(€ô¤ì(€½¹ÍÐÑ½Ñ…°€ô±…ÍÍ¥™¥•‘MÕµµ…Éä¹Ñ½Ñ…°ì(€½¹ÍÐ‰å½µÁ…¹ä€ô½µÁ…¹å5…ÍÑ•È ¤¹µ…À ¡½µÁ…¹ä¤€ôø€¡ì±…‰•°è½µÁ…¹ä¹½‘”°Ù…±Õ”èÉ½ÝÌ¹™¥±Ñ•È ¡É½Ü¤€ôøÉ½Ü¹½µÁ…¹ä€ôôô½µÁ…¹ä¹½‘”¤¹É•‘Õ” ¡ÍÕ´°É½Ü¤€ôøÍÕ´€¬9Õµ‰•È¡É½Ü¹…µ½Õ¹Ðñð€À¤°€À¤ô¤¤¹™¥±Ñ•È ¡¥Ñ•´¤€ôø¥Ñ•´¹Ù…±Õ”¤ì(€½¹ÍÐ½Á•¸€ô™¥¹…¹¥…±I½ÝÌ¹™¥±Ñ•È ¡É½Ü¤€ôø€……µ…•MÕµµ…Éä¹™¥¹…¹•½µÁ±•Ñ”¡É½Ü¹™¥¹…¹•MÑ…ÑÕÌ¤¤¹±•¹Ñ ì(€½¹ÍÐ±½…‘•‘Ð€ô±¥Ù•…µ…•MÑ…Ñ”¹ÕÁ‘…Ñ•‘Ð€ü‘¥ÍÁ±…åQ¥µ”¡±¥Ù•…µ…•MÑ…Ñ”¹ÕÁ‘…Ñ•‘Ð¤€è€ˆ´ˆì(€É½½Ð¹¥¹¹•É!Q50€ô€(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°‘…µ…”µÁ•É¥½ˆøñ‘¥Øøñ Èû‚â«‚â‚âã‚âo‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â‚âË‚â‹‚æ‚âS‚âß‚â·‚âdð½ ÈøñÀ±…ÍÌô‰¡¥¹Ðˆû‚âk‚â‚âÓ‚â§‚âÇ‚â_‚âW‚âË‚â‡‚âW‚âÇ‚âŸ‚â‚â‚â·‚â‚âS‚æ'‚âË‚âg‚âk‚âdƒ
Üƒ‚â+‚æ#‚âŸ‚â‚â_‚â×‚æ#‚æ‚â+‚æ'‚â·‚â‹‚âç‚æ €‘í ¡É…¹•1…‰•° ¤¥ôƒ
Üƒ‚â‚âÇ‚âg‚â‹‚âË‚â‹‚âd€ÈÔØäƒ‚æ‚â«‚âS‚â‚âW‚âÇ‚æ'‚â‚æ‚âW‚æ €ÄÔ¼Àäƒ‚âW‚âË‚â‡‚â‚â·‚âk‚æ‚â‚âW‚â‚âÃ‚âk‚âhð½Àøð½‘¥Øøñ±…‰•°û‚æ‚â—‚âß‚â·‚â‚æ‚âS‚âß‚â·‚âdñ¥¹ÁÕÐÑåÁ”ô‰µ½¹Ñ ˆ¥ô‰‘…µ…•5½¹Ñ ˆµ¥¸ôˆÈÀÈØ´ÀäˆÙ…±Õ”ôˆ‘í ¡ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½´¹Í±¥” À°Ü¤¥ôˆøð½±…‰•°øñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸Í´ˆ¥ô‰‘…µ…•5½¹Ñ¡ÁÁ±äˆû‚æ‚â«‚âS‚â‚â_‚âÇ‚æ'‚â‚æ‚âS‚âß‚â·‚âdð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰‘…µ…•É¥±±I•Í•Ðˆû‚â—‚æ'‚âË‚â‚âW‚âÇ‚âŸ‚â‚â‚â·‚â‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âPð½‰ÕÑÑ½¸øð½Í•Ñ¥½¸ø(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰‘…µ…”µ‘•™¥¹¥Ñ¥½¸Á…¹•°ˆø(€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆû‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚âs‚â—‚âW‚â‚âŸ‚â ð½Àøñ Èû‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â#‚â‚âÓ‚â‚æ‚â—‚âÃ‚â‚æ'‚â·‚â«‚âÇ‚â‚æ‚â‚âT€Àƒ‚âk‚âË‚â\ð½ ÈøñÀ±…ÍÌô‰¡¥¹Ðˆû‚â‚æ'‚â·‚â«‚âÇ‚â‚æ‚â‚âW‚æ‚â‚æ‚âk‚â+‚âß‚æ#‚â´ƒ‚â‚âÀƒ‚æ‚â¯‚âW‚âã‚â‚âË‚â‚âO‚æ0ƒ‚æ‚â—‚âÃ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdƒ‚æ‚âW‚æ#‚æ‚â‡‚æ#‚æ‚â{‚âÓ‚æ#‚â‡‚â‹‚â·‚âS‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚â—‚âÃ‚æ‚â‡‚æ#‚â«‚æ#‚â‚æ‚â‚æ'‚âË‚â‚âË‚â‚æ‚â‚âÓ‚âdƒ
Üƒ‚â·‚âÇ‚âo‚æ‚âS‚âW‚â—‚æ#‚âË‚â«‚âã‚âP€‘í ¡±½…‘•‘Ð¥ôð½Àøð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹±¥¹”µ…Ñ¥½¹Ìˆøñ±…‰•°û‚âo‚â‚âÃ‚æ‚âƒ‚â\ñÍ•±•Ð¥ô‰‘…µ…•…Ñ•½Éå¥±Ñ•Èˆøñ½ÁÑ¥½¸Ù…±Õ”ô‰10ˆû‚â_‚âã‚â‚âo‚â‚âÃ‚æ‚âƒ‚â\ð½½ÁÑ¥½¸ø‘í=‰©•Ð¹•¹ÑÉ¥•Ì¡…µ…•MÕµµ…Éä¹…Ñ•½É¥•Ì¤¹µ…À ¡m­•ä±±…‰•±t¤ôù€ñ½ÁÑ¥½¸Ù…±Õ”ôˆ‘í­•åôˆ€‘í±¥Ù•…µ…•MÑ…Ñ”¹…Ñ•½Éäôôõ­•äüÍ•±•Ñ•œèœôø‘í ¡±…‰•°¥ôð½½ÁÑ¥½¸ù€¤¹©½¥¸ œœ¥ôð½Í•±•Ðøð½±…‰•°øñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰‘…µ…•áÁ½ÉÑ1¥Ù”ˆùáÁ½ÉÐá•°ð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰‘…µ…•I•™É•Í ˆû‚â‚â×‚æ‚â‚â‚â+‚â‚æ'‚â·‚â‡‚âç‚â”ð½‰ÕÑÑ½¸øð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø(€€€€‘í±¥Ù•…µ…•MÑ…Ñ”¹½±±•Ñ¥½¹ÉÉ½È€ü€ñ‘¥Ø±…ÍÌô‰…±•ÉÐ‰…ˆû‚â‹‚âÇ‚â‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â‹‚â·‚âS‚â«‚âã‚â_‚âc‚âÓ‚æ‚â‡‚æ#‚æ‚âS‚æ$è€‘í ¡±¥Ù•…µ…•MÑ…Ñ”¹½±±•Ñ¥½¹ÉÉ½È¥ôƒ
Üƒ‚æ‚â‡‚æ#‚æ‚â«‚âS‚â‚æ‚âo‚æ‚âg‚â£‚âç‚âg‚â‹‚æ3‚æ‚â—‚âÃ‚æ‚â‡‚æ#‚â·‚âg‚âã‚â7‚âË‚âW‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â{‚âÓ‚æ#‚â‡‚â#‚âg‚â‚âŸ‚æ#‚âË‚â#‚âÃ‚æ‚â¯‚â—‚âS‚â«‚â‡‚âã‚âS‚â‹‚â·‚âS‚â«‚âÏ‚æ‚â‚æ‚â ð½‘¥Øù€€è€œô(€€€€ñ‘¥Ø±…ÍÌô‰…±•ÉÐˆû‚â‹‚â·‚âS‚â«‚âã‚â_‚âc‚âÓ‚â‚â‚æ‚â¯‚â—‚âß‚â´€ôƒ‚â‹‚â·‚âS‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚æ‚â‚â×‚â‹‚â‚æ‚â‚æ‚âhƒŠ"Hƒ‚â‹‚â·‚âS‚æ‚â·‚âg‚â‚âß‚âg‚â_‚â×‚æ#‚âW‚â‚âŸ‚â#‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â—‚æ'‚âœƒ
Üƒ‚â‹‚âÛ‚âS‚æ‚âS‚âß‚â·‚âg‚â_‚â×‚æ#‚æ‚â‚âÓ‚âS‚æ‚â¯‚âW‚âàƒ‚æ‚â‡‚æ'‚æ‚â·‚âg‚â‚âß‚âg‚æ‚âg‚æ‚âS‚âß‚â·‚âg‚â[‚âÇ‚âS‚æ‚âlƒ
Üƒ‚â‚âË‚â‹‚â‚âË‚â‚â_‚â×‚æ#‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚æ‚â‡‚æ#‚â[‚âß‚â·‚âŸ‚æ#‚âË‚â‹‚â·‚âS‚æ‚â‚â×‚â‹‚â‚æ‚â‚æ‚âk‚æ‚âo‚æ‚âg‚â£‚âç‚âg‚â‹‚æ0ð½‘¥Øø(€€€€‘í±…ÍÍ¥™¥•‘MÕµµ…Éä¹¥ÍÍÕ•Ì¹±•¹Ñ €ü€ñ‘¥Ø±…ÍÌô‰…±•ÉÐ‰…ˆû‚â{‚âh€‘í¹Õ´¡±…ÍÍ¥™¥•‘MÕµµ…Éä¹¥ÍÍÕ•Ì¹±•¹Ñ ¥ôƒ‚â‚âË‚â‹‚â‚âË‚â‚â‚â¯‚âÇ‚â«‚â¯‚â‚âß‚â·‚â‹‚â·‚âS‚æ‚â‡‚æ#‚â[‚âç‚â‚âW‚æ'‚â·‚âƒ‚â‹‚â·‚âS‚â‚âŸ‚â‡‚âS‚æ'‚âË‚âg‚â—‚æ#‚âË‚â‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‚â‚âhð½‘¥Øù€€è€œô(€€€€‘íÍ½Á•‘I½ÝÌ¹±•¹Ñ €øô€ÔÀÀÀ€ü€œñ‘¥Ø±…ÍÌô‰…±•ÉÐÝ…É¸ˆû‚â[‚âÛ‚â‚â‚â×‚âS‚â#‚âÏ‚â‚âÇ‚âP€Ô°ÀÀÀƒ‚â‚âË‚â‹‚â‚âË‚âŒƒ‚â‚â‚âã‚âO‚âË‚â—‚âS‚â+‚æ#‚âŸ‚â‚âŸ‚âÇ‚âg‚â_‚â×‚æ#‚â‚æ#‚â·‚âg‚â«‚â‚âã‚âo‚â¯‚â‚âß‚â´áÁ½ÉÐð½‘¥Øøœ€è€œô(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆøñ Èû‚â«‚â‚âã‚âo‚âW‚âË‚â‡‚âo‚â‚âÃ‚æ‚âƒ‚â_‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆð½ ÈøñÀ±…ÍÌô‰¡¥¹Ðˆû‚æ‚â'‚â{‚âË‚âÃ‚â‚âË‚â‹‚â‚âË‚â‚â_‚â×‚æ#‚âs‚âç‚æ'‚âW‚â‚âŸ‚â#‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚æ‚â—‚æ'‚âœƒ
Üƒ‚â_‚â×‚â„€‘í  …±¥Ù•…µ…•MÑ…Ñ”¹Ñ•…´ñð±¥Ù•…µ…•MÑ…Ñ”¹Ñ•…´ôôô10œ€ü€Ÿ‚â_‚âã‚â‚â_‚â×‚â„œ€è±¥Ù•…µ…•MÑ…Ñ”¹Ñ•…´¥ôƒ
Üƒ‚âs‚âç‚æ'‚æ‚â‚â×‚æ#‚â‹‚âŸ‚â‚æ'‚â·‚â€‘í  …±¥Ù•…µ…•MÑ…Ñ”¹•µÁ±½å•”ñð±¥Ù•…µ…•MÑ…Ñ”¹•µÁ±½å•”ôôô10œ€ü€Ÿ‚â_‚âã‚â‚â‚âdœ€è±¥Ù•…µ…•MÑ…Ñ”¹•µÁ±½å•”¥ôƒ
Üƒ‚â‚æ'‚â·‚â‡‚âç‚â—‚æ‚â‚æ#‚âË‚æ‚â‡‚æ#‚â#‚âÇ‚âS‚âo‚â‚âÃ‚æ‚âƒ‚â_‚æ‚â¯‚â‡‚æ#‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÐð½Àøñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…ÀˆøñÑ…‰±”øñÑ¡•…øñÑÈøñÑ û‚âo‚â‚âÃ‚æ‚âƒ‚â\ð½Ñ øñÑ û‚â#‚âÏ‚âg‚âŸ‚âdð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚â‹‚â·‚âS‚â_‚â×‚æ#‚âk‚âÇ‚âg‚â_‚âÛ‚â€£‚âk‚âË‚â\¤ð½Ñ øð½ÑÈøð½Ñ¡•…øñÑ‰½‘äø‘í±…ÍÍ¥™¥•‘MÕµµ…Éä¹É½ÕÁÌ¹µ…À¡œôù€ñÑÈøñÑø‘í ¡œ¹…Ñ•½ÉäôôôÍåÍÑ•´œüŸ‚â‚âÃ‚âk‚âk‚æ‚âS‚âÓ‚â„€£‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚â‹‚â‚â¯‚â—‚âÇ‚â‚âk‚æ'‚âË‚âd€¼A4€¼ƒ‚æ‚â‚â„¤œéœ¹±…‰•°¥ôð½ÑøñÑø‘í¹Õ´¡œ¹½Õ¹Ð¥ôð½ÑøñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆøñ‰ÕÑÑ½¸±…ÍÌô‰±¥¹¬µ‰Ñ¸ˆ‘…Ñ„µ‘…µ…”µ‘É¥±°ô‰…Ñ•½Éäˆ‘…Ñ„µ‘…µ…”µÙ…±Õ”ôˆ‘í ¡œ¹…Ñ•½Éä¥ôˆø‘íµ½¹•ä¡œ¹…µ½Õ¹Ð¥ôð½‰ÕÑÑ½¸øð½Ñøð½ÑÈù€¤¹©½¥¸ œœ¥ôð½Ñ‰½‘äøñÑ™½½ÐøñÑÈøñÑ û‚â‚âŸ‚â„ð½Ñ øñÑ ø‘í¹Õ´¡±…ÍÍ¥™¥•‘MÕµµ…Éä¹É½ÕÁÌ¹É•‘Õ” ¡Ì±œ¤ôùÌ­œ¹½Õ¹Ð°À¤¥ôð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆø‘íµ½¹•ä¡Ñ½Ñ…°¥ôð½Ñ øð½ÑÈøð½Ñ™½½Ðøð½Ñ…‰±”øð½‘¥ØøñÀ±…ÍÌô‰¡¥¹Ðˆû‚â‹‚â·‚âS‚âg‚â×‚æ'‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚â+‚æ#‚â‹‚â·‚âS‚â«‚âã‚â_‚âc‚âÓ‚â¯‚â—‚âÇ‚â‚æ‚âS‚æ'‚â‚âÇ‚âk‚â‚âß‚âdƒ‚â¯‚âË‚â‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚â‚âË‚â‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â—‚âÃ‚â#‚âÏ‚âg‚âŸ‚âg‚æ‚â‚âÓ‚âg‚â‚âÇ‚âk‚â‚âß‚âg‚æ‚â‹‚â‚âW‚æ#‚âË‚â‚â¯‚âË‚âð½Àøð½Í•Ñ¥½¸ø(€€€€‘í‘É¥±±Q…‰±”¡…Ñ•½ÉåI½ÝÌ°€Ñ•…´œ°€Ÿ‚â‹‚â·‚âS‚â‚âŸ‚â‡‚æ‚â‹‚â‚â‚â¯‚âÇ‚â«‚â_‚â×‚â„œ¥ô(€€€€‘í‘É¥±±Q…‰±”¡Ñ•…µI½ÝÌ°€•µÁ±½å•”œ°€Ÿ‚â‹‚â·‚âS‚â‚âŸ‚â‡‚æ‚â‹‚â‚â{‚âg‚âÇ‚â‚â‚âË‚âd€¼ƒ‚âs‚âç‚æ'‚æ‚â‚â×‚æ#‚â‹‚âŸ‚â‚æ'‚â·‚âœ¥ô(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆøñ Èû‚â‹‚â·‚âS‚æ‚â‚â×‚â‹‚â‚æ‚â‚æ‚âk‚æ‚â—‚âÃ‚â‹‚â·‚âS‚æ‚â·‚âg‚â‚âß‚âg‚â‚âË‚â‹‚æ‚â‚â¨ð½ ÈøñÀ±…ÍÌô‰¡¥¹Ðˆû‚æ‚â«‚âS‚â‚æ‚â'‚â{‚âË‚âÃ‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â#‚â‚âÓ‚âƒ
Üƒ‚â‚æ'‚â·‚â«‚âÇ‚â‚æ‚â‚âT€Àƒ‚âk‚âË‚â_‚æ‚â‡‚æ#‚æ‚â‚æ'‚âË‚â‚âË‚â‚æ‚â‚âÓ‚âdð½Àøñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…ÀˆøñÑ…‰±”øñÑ¡•…øñÑÈøñÑ û‚æ‚â‚â¨€¼ƒ‚âk‚â‚âÓ‚â§‚âÇ‚â\ð½Ñ øñÑ û‚âs‚âç‚æ'‚â‚âÇ‚âk‚âs‚âÓ‚âS‚â+‚â·‚âk‚â_‚â×‚æ#‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÐð½Ñ øñÑ û‚âo‚â‚âÃ‚æ‚âƒ‚â\ð½Ñ øñÑ û‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚æ‚â‚â×‚â‹‚â‚æ‚â‚æ‚âhð½Ñ øñÑ û‚æ‚â·‚âg‚â‚âß‚âg‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚æ‚â—‚æ'‚âœð½Ñ øñÑ û‚â«‚âã‚â_‚âc‚âÓ‚â‚â‚æ‚â¯‚â—‚âß‚â´ð½Ñ øñÑ û‚âS‚âÏ‚æ‚âg‚âÓ‚âg‚â‚âË‚âŒð½Ñ øð½ÑÈøð½Ñ¡•…øñÑ‰½‘äø‘í™¥¹…¹¥…±I½ÝÌ¹µ…À¡ôùí½¹ÍÐÐõ…µ…•MÕµµ…Éä¹½±±•Ñ¥½¹Q½Ñ…±Ì¡¤íÉ•ÑÕÉ¸€ñÑÈøñÑø‘í ¡¹¥¥ôƒ
Ü€‘í ¡¹½µÁ…¹ä¥ôð½ÑøñÑø‘í¹½±±•Ñ¥½¸ý€‘í ¡¹½±±•Ñ¥½¸¹Á…ÉÑå}¹…µ”¥ôƒ
Ü€‘í ¡¹½±±•Ñ¥½¸¹Á…ÉÑå}½‘”¥ôƒ
Ü€‘í ¡¹½±±•Ñ¥½¸¹Í¡¥™Ðñð€Ÿ‚æ‚â‡‚æ#‚æ‚â‚â×‚æ#‚â‹‚âŸ‚â‚âÇ‚âk‚â‚âÀœ¥õ€èŸ‚â‚â·‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âs‚âç‚æ'‚â‚âÇ‚âk‚âs‚âÓ‚âS‚â+‚â·‚âhôð½ÑøñÑø‘í ¡…µ…•MÕµµ…Éä¹…Ñ•½É¥•Ím…µ…•MÕµµ…Éä¹±…ÍÍ¥™ä¡¹…ÕÍ”¤¹…Ñ•½Éåt¥ôð½Ñø‘íl…ÁÁÉ½Ù•œ°Á…¥œ°¹•Ðt¹µ…À¡¬ôù€ñÑ±…ÍÌô‰É¥¡Ðˆø‘íÑm­tôôõ¹Õ±°üŸ‚â‚â·‚â‹‚âß‚âg‚â‹‚âÇ‚âdœéµ½¹•ä¡Ñm­t¥ôð½Ñù€¤¹©½¥¸ œœ¥ôñÑø‘í…¸ ±½Í•}…Í”œ¤ý€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ‘…Ñ„µ‘…µ…”µ½±±•Ñ¥½¸ôˆ‘í ¡¹‘‰%¥ôˆ€‘ì…¹½±±•Ñ¥½¹I•…‘äñð±¥Ù•…µ…•MÑ…Ñ”¹½±±•Ñ¥½¹ÉÉ½Èü‘¥Í…‰±•œèœôø‘í¹½±±•Ñ¥½¸üŸ‚âk‚âÇ‚âg‚â_‚âÛ‚â€¼ƒ‚âW‚â‚âŸ‚â#‚â‹‚â·‚âS‚æ‚â·‚âg‚â‚âß‚âdœèŸ‚âW‚â‚âŸ‚â#‚âW‚âÇ‚âŸ‚â‚âg‚æ‚â—‚âÃ‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚æ‚â‚â×‚â‹‚â‚æ‚â‚æ‚âhôð½‰ÕÑÑ½¸ù€èŸ‚æ‚â'‚â{‚âË‚âÃ‚âs‚âç‚æ'‚â‡‚â×‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÐôð½Ñøð½ÑÈù€íô¤¹©½¥¸ œœ¤ñð€œñÑÈøñÑ½±ÍÁ…¸ôˆÜˆû‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â#‚â‚âÓ‚â‚â_‚â×‚æ#‚âW‚æ'‚â·‚â‚æ‚â‚â×‚â‹‚â‚æ‚â‚æ‚âhð½Ñøð½ÑÈøôð½Ñ‰½‘äøð½Ñ…‰±”øð½‘¥Øøð½Í•Ñ¥½¸ø(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰ÍÑ…ÑÕÌµÍÑÉ¥À™½ÕÈˆø(€€€€€€ñ…ÉÑ¥±”øñÍÁ…¸û‚â‚âË‚â‹‚â‚âË‚â‚æ‚âg‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âdð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡É½ÝÌ¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚â+‚æ#‚âŸ‚â€‘í ¡É…¹•1…‰•° ¤¥ôð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”±…ÍÌô‰‰…ˆøñÍÁ…¸û‚â‹‚â·‚âS‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â‚âŸ‚â„ð½ÍÁ…¸øñÍÑÉ½¹œø‘íµ½¹•äÀ¡Ñ½Ñ…°¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚âk‚âË‚â\ð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”±…ÍÌôˆ‘í½‰Í•ÉÙ…Ñ¥½¹I½ÝÌ¹±•¹Ñ €ü€‰Ý…É¸ˆ€è€‰½¬‰ôˆøñÍÁ…¸û‚â‚æ'‚â·‚â«‚âÇ‚â‚æ‚â‚âT€Àƒ‚âk‚âË‚â\ð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡½‰Í•ÉÙ…Ñ¥½¹I½ÝÌ¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚æ‚â‡‚æ#‚â«‚æ#‚â‚æ‚â‚æ'‚âË‚â‚âË‚â‚æ‚â‚âÓ‚âdð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”±…ÍÌôˆ‘í½Á•¸€ü€‰Ý…É¸ˆ€è€‰½¬‰ôˆøñÍÁ…¸û‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â‚â·‚â‚âË‚â‚æ‚â‚âÓ‚âdð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡½Á•¸¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚æ‚â‡‚æ#‚â‚âŸ‚â‡‚â‚æ'‚â·‚â«‚âÇ‚â‚æ‚â‚âTð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€ð½Í•Ñ¥½¸ø(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰É¥´Èˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆøñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆû‚âW‚âË‚â‡‚âk‚â‚âÓ‚â§‚âÇ‚â\ð½Àøñ Èû‚â‹‚â·‚âS‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆð½ Èøð½‘¥Øøð½‘¥Øøñ‘¥Ø±…ÍÌô‰¡…ÉÐˆ¥ô‰±¥Ù•…µ…•½µÁ…¹äˆø‘íÉ½ÝÌ¹±•¹Ñ €ü€ˆˆ€è€œñ‘¥Ø±…ÍÌô‰•µÁÑäµ‰½àˆû‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚â‚æ'‚â·‚â‡‚âç‚â—‚â«‚âÏ‚â¯‚â‚âÇ‚âk‚â«‚â‚æ'‚âË‚â‚â‚â‚âË‚â|ð½‘¥Øøôð½‘¥Øøð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆøñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆû‚â«‚âË‚æ‚â¯‚âW‚âàð½Àøñ Èû‚â‚âË‚â‹‚â‚âË‚â‚â_‚â×‚æ#‚â{‚âhð½ Èøð½‘¥Øøð½‘¥Øøñ‘¥Ø±…ÍÌô‰•á•ÁÑ¥½¸µÍÕµµ…Éäˆø‘í=‰©•Ð¹•¹ÑÉ¥•Ì¡É½ÝÌ¹É•‘Õ” ¡…Œ°É½Ü¤€ôøì½¹ÍÐ‘•Ñ…¥°õ…µ…•MÕµµ…Éä¹±…ÍÍ¥™ä¡É½Ü¹…ÕÍ”¤¹‘•Ñ…¥°ì…m‘•Ñ…¥±tô¡…m‘•Ñ…¥±uñðÀ¤¬ÄìÉ•ÑÕÉ¸…Œìô°íô¤¤¹Í½ÉÐ ¡„±ˆ¤ôù‰lÅtµ…lÅt¤¹Í±¥” À°à¤¹µ…À ¡m…ÕÍ”±½Õ¹Ñt¤ôù€ñ‘¥ØøñÍÁ…¸ø‘í ¡…ÕÍ”¥ôð½ÍÁ…¸øñˆø‘í¹Õ´¡½Õ¹Ð¥ôð½ˆøð½‘¥Øù€¤¹©½¥¸ ˆˆ¤ñð€ñÀ±…ÍÌô‰•µÁÑäˆû‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚â‚âË‚â‹‚â‚âË‚â‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚âg‚â+‚æ#‚âŸ‚â‚âg‚â×‚æ$ð½Àùôð½‘¥Øøð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆøñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùÙ¥‘•¹”¥¹‰½àð½Àøñ Èû‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â_‚â×‚æ#‚æ‚âS‚æ'‚â‚âÇ‚âk‚æ‚â—‚âÃ‚â‚â·‚âs‚âç‚æ'‚âW‚â‚âŸ‚â#‚â‹‚âß‚âg‚â‹‚âÇ‚âdð½ ÈøñÍµ…±°±…ÍÌô‰¡•…µÍÕˆˆû‚â‚âË‚â‹‚â‚âË‚â‚âg‚â×‚æ'‚æ‚â«‚âS‚â‚âŸ‚æ#‚âË‚æ‚âS‚æ'‚â‚âÇ‚âk‚æ‚â‚â—‚æ3‚æ‚â—‚æ'‚âœƒ‚æ‚âW‚æ#‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â[‚âß‚â·‚æ‚âo‚æ‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â#‚âg‚â‚âŸ‚æ#‚âË‚â#‚âÃ‚âs‚âç‚â‚â‚âÇ‚âk‚æ‚â‚â«‚æ‚â—‚âÃ‚âs‚âç‚æ'‚âW‚â‚âŸ‚â#‚â‹‚âß‚âg‚â‹‚âÇ‚âdð½Íµ…±°øð½‘¥Øøñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰‘…µ…•½±…É¥™äˆû‚æ‚âo‚âÓ‚âS‚â¯‚âg‚æ'‚âË‚âW‚âÓ‚âS‚âW‚âË‚â‡‚æ‚â‚â¨ð½‰ÕÑÑ½¸øð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…ÀˆøñÑ…‰±”øñÑ¡•…øñÑÈøñÑ û‚âŸ‚âÇ‚âg‚â_‚â×‚æ ð½Ñ øñÑ û‚âk‚â‚âÓ‚â§‚âÇ‚â\ð½Ñ øñÑ û‚æ‚â‚â—‚æ3‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdð½Ñ øñÑ û‚â¯‚âÇ‚âŸ‚â‚æ'‚â·‚æ‚â‡‚â”ð½Ñ øñÑ û‚â«‚â[‚âË‚âg‚âÀð½Ñ øð½ÑÈøð½Ñ¡•…øñÑ‰½‘äø‘í•Ù¥‘•¹•I½ÝÌ¹µ…À ¡™¥±”¤€ôøì(€€€€€€€½¹ÍÐ½µÁ…¹ä€ô¹½Éµ…±¥é•1¥Ù•½µÁ…¹å½‘”¡™¥±”¹½µÁ…¹äñð™¥±”¹‰…Ñ¡}½µÁ…¹ä¤ñð€‹‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âàˆì(€€€€€€€É•ÑÕÉ¸€ñÑÈøñÑø‘í ¡™¥±”¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”¥ôð½ÑøñÑøñˆø‘í ¡½µÁ…¹ä¥ôð½ˆøð½ÑøñÑøñ‰ÕÑÑ½¸±…ÍÌô‰™¥±”µ¹…µ”µ±¥¹¬ˆ‘…Ñ„µÍÑ½É…”µ½Á•¸ôˆ‘í ¡™¥±”¹ÍÑ½É…•}Á…Ñ ¥ôˆ‘…Ñ„µ™¥±”µ¥ôˆ‘í ¡™¥±”¹¥¥ôˆ‘…Ñ„µ™¥±”µ¹…µ”ôˆ‘í ¡™¥±”¹™¥±•}¹…µ”¥ôˆ‘…Ñ„µ™¥±”µµ¥µ”ôˆ‘í ¡™¥±”¹µ¥µ•}ÑåÁ”ñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µÍ¥é”ôˆ‘í ¡™¥±”¹Í¥é•}‰åÑ•Ìñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µ­¥¹ô‰‘½}±…É¥™äˆ‘…Ñ„µ™¥±”µ½µÁ…¹äôˆ‘í ¡½µÁ…¹ä¥ôˆ‘…Ñ„µ™¥±”µ‘…Ñ”ôˆ‘í ¡™¥±”¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”¥ôˆ‘…Ñ„µ™¥±”µÍÑ…ÑÕÌô‰•Ù¥‘•¹”ˆ€‘í™¥±”¹ÍÑ½É…•}Á…Ñ €ü€ˆˆ€è€‰‘¥Í…‰±•‰ôøñÍÁ…¸ø‘í ¡™¥±”¹™¥±•}¹…µ”¥ôð½ÍÁ…¸øñÍµ…±°û‚âS‚âç‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚â‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdð½Íµ…±°øð½‰ÕÑÑ½¸øð½ÑøñÑø‘í ¡™¥±”¹ÍÕ‰©•Ðñð€ˆ´ˆ¥ôñÍµ…±°±…ÍÌô‰ÍÕˆˆø‘í ¡™¥±”¹Í•¹‘•Èñð€ˆ´ˆ¥ôð½Íµ…±°øð½ÑøñÑøñÍÁ…¸±…ÍÌô‰‰…‘”…µ‰•Èˆû‚â‚â·‚âs‚âç‚â‚æ‚â—‚âÃ‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚æ‚â‚â¨ð½ÍÁ…¸øð½Ñøð½ÑÈù€ì(€€€€€ô¤¹©½¥¸ ˆˆ¤ñð€ñÑÈøñÑ½±ÍÁ…¸ôˆÔˆ±…ÍÌô‰•µÁÑäˆø‘í±¥Ù•…µ…•MÑ…Ñ”¹•Ù¥‘•¹•I•…‘ä€ü€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚æ‚â‚â—‚æ3‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚âg‚â+‚æ#‚âŸ‚â‚âg‚â×‚æ$ˆ€è€‹‚â‹‚âÇ‚â‚æ‚â¯‚â—‚âS‚â‚âË‚â‹‚â‚âË‚â‚æ‚â‚â—‚æ3‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ƒŠPƒ‚â‚âS‚â‚â×‚æ‚â‚â‚â+‚æ‚â{‚âß‚æ#‚â·‚â—‚â·‚â‚æ‚â¯‚â‡‚æ ‰ôð½Ñøð½ÑÈùôð½Ñ‰½‘äøð½Ñ…‰±”øð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆøñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùMÕÁ…‰…Í”‘…µ…•Ìð½Àøñ Èû‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚âs‚â—‚âW‚â‚âŸ‚â#‚æ‚â—‚âÃ‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆð½ Èøð½‘¥ØøñÍÁ…¸±…ÍÌô‰¡•…±Ñ ½¬ˆû‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚â‚âÓ‚âð½ÍÁ…¸øð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…ÀˆøñÑ…‰±”øñÑ¡•…øñÑÈøñÑ û‚âŸ‚âÇ‚âg‚â_‚â×‚æ €¼ƒ‚æ‚âŸ‚â—‚âË‚æ‚â‚âÓ‚âS‚æ‚â¯‚âW‚âàð½Ñ øñÑ û‚â‚â¯‚âÇ‚â¨€¼ƒ‚æ‚âo‚âÓ‚âS‚æ‚â‚â«‚æ‚â—‚âÃ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdð½Ñ øñÑ û‚âk‚â‚âÓ‚â§‚âÇ‚â\ð½Ñ øñÑ û‚âs‚â—‚âW‚â‚âŸ‚â ð½Ñ øñÑ û‚âs‚âç‚æ'‚æ‚â‚â×‚æ#‚â‹‚âŸ‚â‚æ'‚â·‚â€¼ƒ‚â‚âÀð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚â‹‚â·‚âP€£‚âk‚âË‚â\¤ð½Ñ øñÑ û‚â«‚âË‚æ‚â¯‚âW‚âàð½Ñ øñÑ û‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdð½Ñ øñÑ û‚â‚âË‚â‚æ‚â‚âÓ‚âdð½Ñ øð½ÑÈøð½Ñ¡•…ø(€€€€€€ñÑ‰½‘äø‘íÉ½ÝÌ¹µ…À ¡¤ôùí½¹ÍÐŒõ…µ…•MÕµµ…Éä¹±…ÍÍ¥™ä¡¹…ÕÍ”¤íÉ•ÑÕÉ¸€ñÑÈøñÑø‘í ¡¹‘…Ñ”¥ôñÍµ…±°±…ÍÌô‰ÍÕˆˆø‘í ¡¹Ñ¥µ”ñð€Ÿ‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âã‚æ‚âŸ‚â—‚âÈœ¥ôð½Íµ…±°øð½ÑøñÑø‘í¹•á•ÁÑ¥½¹%€ôôô€ˆ´ˆ€ü€ñÍÁ…¸±…ÍÌô‰µ½¹¼ˆø‘í ¡¹¥¥ôð½ÍÁ…¸ù€€è€ñ‰ÕÑÑ½¸±…ÍÌô‰±¥¹¬µ‰Ñ¸µ½¹¼ˆ‘…Ñ„µ‘…µ…”µ•àôˆ‘í ¡¹•á•ÁÑ¥½¹%¥ôˆø‘í ¡¹¥¥ôð½‰ÕÑÑ½¸ùôð½ÑøñÑøñˆø‘í ¡¹½µÁ…¹ä¥ôð½ˆøð½ÑøñÑøñÍÁ…¸±…ÍÌô‰‰…‘”€‘íŒ¹½‰Í•ÉÙ…Ñ¥½¸ü…µ‰•ÈœèÉ•ôˆø‘íŒ¹½‰Í•ÉÙ…Ñ¥½¸üŸ‚â_‚âÏ‚â‚âË‚âg‚âs‚âÓ‚âS‚â{‚â—‚âË‚âPƒ
Üƒ‚æ‚â‡‚æ#‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆœèŸ‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆôð½ÍÁ…¸øð½ÑøñÑø‘í ¡…µ…•MÕµµ…Éä¹•µÁ±½å••1…‰•°¡¤¥ôñÍµ…±°±…ÍÌô‰ÍÕˆˆø‘í ¡…µ…•MÕµµ…Éä¹Í¡¥™Ñ1…‰•°¡¤¥ôð½Íµ…±°øð½ÑøñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í¹…µ½Õ¹Ð€ôô¹Õ±°€ü€Ÿ‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âàœ€èµ½¹•ä¡¹…µ½Õ¹Ð¥ôð½ÑøñÑø‘í ¡…µ…•MÕµµ…Éä¹…Ñ•½É¥•ÍmŒ¹…Ñ•½Éåt¥ô‘íŒ¹ÍÕ‰…Ñ•½Éäüœ€¼ƒ‚â‚â¯‚âÇ‚â«‚æ‚âS‚âÓ‚â„€œ­ ¡Œ¹ÍÕ‰…Ñ•½Éä¤èœôñÍµ…±°±…ÍÌô‰ÍÕˆˆø‘í ¡Œ¹‘•Ñ…¥°¥ôð½Íµ…±°øð½ÑøñÑøñÍÁ…¸±…ÍÌô‰‰…‘”€‘í¹•Ù¥‘•¹”ü‰É••¸ˆè‰…µ‰•È‰ôˆø‘í¹•Ù¥‘•¹”ü‹‚â‡‚âÔˆè‹‚â‚â´‰ôð½ÍÁ…¸øð½ÑøñÑø‘í ¡¹™¥¹…¹•MÑ…ÑÕÌ¥ôð½Ñøð½ÑÈù€íô¤¹©½¥¸ ˆˆ¤ñð€ñÑÈøñÑ½±ÍÁ…¸ôˆäˆøñ‘¥Ø±…ÍÌô‰‘…µ…”µ•µÁÑäˆøñÍÑÉ½¹œû‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â_‚â×‚æ#‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚æ‚â—‚æ'‚âŸ‚æ‚âg‚â+‚æ#‚âŸ‚â‚âg‚â×‚æ$ð½ÍÑÉ½¹œøñÍÁ…¸û‚â‚âŸ‚â‡‚â[‚âÛ‚â‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚â‚æ'‚â·‚â«‚âÇ‚â‚æ‚â‚âT€Àƒ‚âk‚âË‚â_‚âW‚âË‚â‡‚âW‚âÇ‚âŸ‚â‚â‚â·‚âƒ
Üƒ‚â—‚â·‚â‚â—‚æ'‚âË‚â‚âW‚âÇ‚âŸ‚â‚â‚â·‚âƒ‚â¯‚â‚âß‚â·‚æ‚âo‚âÓ‚âS‚æ‚â‚â«‚æ‚â{‚âß‚æ#‚â·‚âW‚â‚âŸ‚â#‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdð½ÍÁ…¸øñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸Í´ˆ¥ô‰‘…µ…•½á•ÁÑ¥½¹Ìˆû‚æ‚âo‚âW‚â‚âŸ‚â#‚â‚âË‚â‹‚â‚âË‚â‚âs‚âÓ‚âS‚âo‚â‚âW‚âÐð½‰ÕÑÑ½¸øð½‘¥Øøð½Ñøð½ÑÈùôð½Ñ‰½‘äøð½Ñ…‰±”øð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ù€ì(€¥˜€¡É½ÝÌ¹±•¹Ñ ¤¡…ÉÑÌ¹‘É…Ü ˆ±¥Ù•…µ…•½µÁ…¹äˆ°€‰¡‰…ÉÌˆ°ì±…‰•°è€‹‚â‹‚â·‚âS‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚âW‚âË‚â‡‚âk‚â‚âÓ‚â§‚âÇ‚â\ˆ°¥Ñ•µÌè‰å½µÁ…¹ä°½±½Èè€ˆÀÍˆÍˆˆ°µ½¹•äèÑÉÕ”°µ•ÑÉ¥Œè€‹‚â‹‚â·‚âP€£‚âk‚âË‚â\¤ˆô¤ì(€€ ˆ‘…µ…•I•™É•Í ˆ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø±½…‘1¥Ù•…µ…”¡ÑÉÕ”¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µ‘…µ…”µ½±±•Ñ¥½¹tœ¤¹™½É… ¡‰ÕÑÑ½¸ôù‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ° ¤ôù½Á•¹…µ…•½±±•Ñ¥½¸¡É½ÝÌ¹™¥¹¡ôù¹‘‰%ôôõ‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹‘…µ…•½±±•Ñ¥½¸¤¤¤¤ì(€€ ˆ‘…µ…•5½¹Ñ¡ÁÁ±äˆ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì(€€€ÑÉäì½¹ÍÐÉ…¹”õ…µ…•MÕµµ…Éä¹µ½¹Ñ¡I…¹”  ˆ‘…µ…•5½¹Ñ ˆ¤¹Ù…±Õ”¤ì=‰©•Ð¹…ÍÍ¥¸¡ÍÑ…Ñ”¹™¥±Ñ•ÉÌ±É…¹”¤ì±¥Ù•…µ…•MÑ…Ñ”¹Ñ•…´õ±¥Ù•…µ…•MÑ…Ñ”¹•µÁ±½å•”õ±¥Ù•…µ…•MÑ…Ñ”¹…Ñ•½Éäô10œìÉ•¹‘•È ¤ìô(€€€…Ñ ¡•ÉÉ½È¤ìÑ½…ÍÐ¡•ÉÉ½È¹µ•ÍÍ…”°Ý…É¸œ¤ìô(€ô¤ì(€€ ˆ‘…µ…•É¥±±I•Í•Ðˆ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì±¥Ù•…µ…•MÑ…Ñ”¹Ñ•…´õ±¥Ù•…µ…•MÑ…Ñ”¹•µÁ±½å•”õ±¥Ù•…µ…•MÑ…Ñ”¹…Ñ•½Éäô10œìÉ•¹‘•É1¥Ù•…µ…”¡É½½Ð¤ìô¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° m‘…Ñ„µ‘…µ…”µ‘É¥±±tœ¤¹™½É… ¡‰ÕÑÑ½¸€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì(€€€±¥Ù•…µ…•MÑ…Ñ•m‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹‘…µ…•É¥±±tõ‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹‘…µ…•Y…±Õ”ì(€€€¥˜¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹‘…µ…•É¥±°ôôôÑ•…´œ¤±¥Ù•…µ…•MÑ…Ñ”¹•µÁ±½å•”ô10œì(€€€¥˜¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹‘…µ…•É¥±°ôôô…Ñ•½Éäœ¤±¥Ù•…µ…•MÑ…Ñ”¹Ñ•…´õ±¥Ù•…µ…•MÑ…Ñ”¹•µÁ±½å•”ô10œì(€€€É•¹‘•É1¥Ù•…µ…”¡É½½Ð¤ì(€ô¤¤ì(€€ ˆ‘…µ…•…Ñ•½Éå¥±Ñ•Èˆ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ¡…¹”œ°•Ù•¹Ð€ôøì±¥Ù•…µ…•MÑ…Ñ”¹…Ñ•½Éäõ•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ì±¥Ù•…µ…•MÑ…Ñ”¹Ñ•…´õ±¥Ù•…µ…•MÑ…Ñ”¹•µÁ±½å•”ô10œìÉ•¹‘•É1¥Ù•…µ…”¡É½½Ð¤ìô¤ì(€€ ˆ‘…µ…•áÁ½ÉÑ1¥Ù”ˆ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì(€€€¥˜€¡±…ÍÍ¥™¥•‘MÕµµ…Éä¹¥ÍÍÕ•Ì¹±•¹Ñ ñð±¥Ù•…µ…•MÑ…Ñ”¹½±±•Ñ¥½¹ÉÉ½ÈñðÍ½Á•‘I½ÝÌ¹±•¹Ñ €øô€ÔÀÀÀ¤É•ÑÕÉ¸Ñ½…ÍÐ Ÿ‚â‹‚âÇ‚â‚â«‚â‚âã‚âo‚æ‚â‡‚æ#‚â‚â‚âhƒ‚â‚â‚âã‚âO‚âË‚âW‚â‚âŸ‚â#‚â‚æ'‚â·‚â‡‚âç‚â—‚â¯‚â‚âß‚â·‚â—‚âS‚â+‚æ#‚âŸ‚â‚âŸ‚âÇ‚âg‚â_‚â×‚æ#‚â‚æ#‚â·‚âdáÁ½ÉÐœ°€Ý…É¸œ¤ì(€€€•áÁ½ÉÑM¡••ÑÌ ½¹™¥Éµ•µ‘…µ…•Ìœ°l(€€€€€í¹…µ”èŸ‚â«‚â‚âã‚âo‚âo‚â‚âÃ‚æ‚âƒ‚â\œ±¡•…‘•ÉÌélŸ‚âo‚â‚âÃ‚æ‚âƒ‚â\œ°Ÿ‚â#‚âÏ‚âg‚âŸ‚âdœ°Ÿ‚â‹‚â·‚âS‚â_‚â×‚æ#‚âk‚âÇ‚âg‚â_‚âÛ‚â€£‚âk‚âË‚â\¤t±Ý¥‘Ñ¡ÌélÌà°ÄÐ°ÈÑt±É½ÝÌé±…ÍÍ¥™¥•‘MÕµµ…Éä¹É½ÕÁÌ¹µ…À¡œôùmœ¹±…‰•°±œ¹½Õ¹Ð±œ¹…µ½Õ¹Ñt¥ô°(€€€€€í¹…µ”èŸ‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âPœ±¡•…‘•ÉÌélŸ‚âŸ‚âÇ‚âg‚â_‚â×‚æ œ°Ÿ‚âk‚â‚âÓ‚â§‚âÇ‚â\œ°Ÿ‚â‚â¯‚âÇ‚â¨œ°Ÿ‚æ‚â‚â¨œ°Ÿ‚âs‚â—‚âW‚â‚âŸ‚â œ°Ÿ‚âo‚â‚âÃ‚æ‚âƒ‚â\œ°Ÿ‚â‚â¯‚âÇ‚â«‚âo‚â‚âÃ‚æ‚âƒ‚â_‚æ‚âS‚âÓ‚â„œ°Ÿ‚â‹‚â·‚âS‚â_‚â×‚æ#‚âk‚âÇ‚âg‚â_‚âÛ‚â€£‚âk‚âË‚â\¤œ°Ÿ‚â«‚âË‚æ‚â¯‚âW‚âàœ°Ÿ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdœ°Ÿ‚â‚âË‚â‚æ‚â‚âÓ‚âdœ°Ÿ‚æ‚âŸ‚â—‚âË‚æ‚â‚âÓ‚âS‚æ‚â¯‚âW‚âàœ°Ÿ‚âs‚âç‚æ'‚æ‚â‚â×‚æ#‚â‹‚âŸ‚â‚æ'‚â·‚âœ°Ÿ‚â‚âÀœ°Ÿ‚â‚â¯‚âÇ‚â«‚â_‚â×‚â„t±Ý¥‘Ñ¡ÌélÄØ°ÄÐ°ÐÈ°ÐÈ°ÌÐ°ÌÀ°Äà°ÈÐ°ØÀ°ÄÐ°ÈÐ°ÄØ°ÈÐ°ÈÈ°Äát±É½ÝÌéÉ½ÝÌ¹µ…À¡ôùí½¹ÍÐŒõ…µ…•MÕµµ…Éä¹±…ÍÍ¥™ä¡¹…ÕÍ”¤íÉ•ÑÕÉ¹m¹‘…Ñ”±¹½µÁ…¹ä±¹¥±¹•á•ÁÑ¥½¹%±Œ¹½‰Í•ÉÙ…Ñ¥½¸üŸ‚â_‚âÏ‚â‚âË‚âg‚âs‚âÓ‚âS‚â{‚â—‚âË‚âPƒ
Üƒ‚æ‚â‡‚æ#‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆœèŸ‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆœ±…µ…•MÕµµ…Éä¹…Ñ•½É¥•ÍmŒ¹…Ñ•½Éåt±Œ¹ÍÕ‰…Ñ•½Éä±¹…µ½Õ¹Ð±Œ¹‘•Ñ…¥°±¹•Ù¥‘•¹”üŸ‚â‡‚âÔœèŸ‚â‚â´œ±¹™¥¹…¹•MÑ…ÑÕÌ±¹Ñ¥µ”ñð€Ÿ‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âã‚æ‚âŸ‚â—‚âÈœ±…µ…•MÕµµ…Éä¹•µÁ±½å••1…‰•°¡¤±…µ…•MÕµµ…Éä¹Í¡¥™Ñ1…‰•°¡¤±…µ…•MÕµµ…Éä¹Ñ•…µ½‘”¡¥tíô¥ô°(€€€€€€¸¸¹lÑ•…´œ°•µÁ±½å•”t¹µ…À¡™¥•±ôø¡í¹…µ”é™¥•±ôôôÑ•…´œüŸ‚â«‚â‚âã‚âo‚â‚â¯‚âÇ‚â«‚â_‚â×‚â„œèŸ‚â«‚â‚âã‚âo‚â{‚âg‚âÇ‚â‚â‚âË‚âdœ±¡•…‘•ÉÌém™¥•±ôôôÑ•…´œüŸ‚â‚â¯‚âÇ‚â«‚â_‚â×‚â„œèŸ‚â+‚âß‚æ#‚â´ƒ
Üƒ‚â‚âÀƒ
Üƒ‚âk‚â‚âÓ‚â§‚âÇ‚â\ƒ
Üƒ‚â‚â¯‚âÇ‚â¨œ°¸¸¹=‰©•Ð¹Ù…±Õ•Ì¡…µ…•MÕµµ…Éä¹…Ñ•½É¥•Ì¤°Ÿ‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚âS‚âÓ‚â‡‚â‚âŸ‚â„œ°¸¸¹=‰©•Ð¹Ù…±Õ•Ì¡…µ…•MÕµµ…Éä¹…Ñ•½É¥•Ì¤¹µ…À¡ŒôùŒ¬Ÿ‚â«‚âã‚â_‚âc‚âÓ‚â‚â‚æ‚â¯‚â—‚âß‚â´œ¤°Ÿ‚æ‚â·‚âg‚â‚âß‚âg‚æ‚â—‚æ'‚âœœ°Ÿ‚â‚â·‚â‹‚âß‚âg‚â‹‚âÇ‚âd€£‚æ‚â‚â¨¤t±Ý¥‘Ñ¡ÌélÐà°¸¸¹ÉÉ…ä ÄÜ¤¹™¥±° ÈÐ¥t±É½ÝÌé…µ…•MÕµµ…Éä¹É½ÕÁ	ä¡É½ÝÌ±™¥•±¤¹µ…À¡œôùmœ¹±…‰•°°¸¸¹œ¹É½ÕÁÌ¹µ…À¡ŒôùŒ¹…µ½Õ¹Ð¤±œ¹Ñ½Ñ…°°¸¸¹œ¹¹•ÑÉ½ÕÁÌ¹µ…À¡ŒôùŒ¹Á•¹‘¥¹œýƒ‚â‚â·‚â‹‚âß‚âg‚â‹‚âÇ‚âd€‘íŒ¹Á•¹‘¥¹ôƒ‚æ‚â‚â¨ìƒ‚â‚â‚æ‚â¯‚â—‚âß‚â·‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚æ‚â—‚æ'‚âœ€‘íŒ¹¹•Ñõ€éŒ¹¹•Ð¤±œ¹¹•ÑÉ½ÕÁÌ¹É•‘Õ” ¡Ì±Œ¤ôùÌ­Œ¹Á…¥°À¤±œ¹¹•ÑÉ½ÕÁÌ¹É•‘Õ” ¡Ì±Œ¤ôùÌ­Œ¹Á•¹‘¥¹œ°À¥t¥ô¤¤°(€€€€€í¹…µ”èŸ‚æ‚â‚â×‚â‹‚â‚æ‚â‚æ‚âk‚â‚âË‚â‹‚æ‚â‚â¨œ±¡•…‘•ÉÌélŸ‚æ‚â‚â¨œ°Ÿ‚âk‚â‚âÓ‚â§‚âÇ‚â\œ°Ÿ‚âo‚â‚âÃ‚æ‚âƒ‚â\œ°Ÿ‚âs‚âç‚æ'‚â‚âÇ‚âk‚âs‚âÓ‚âS‚â+‚â·‚âhœ°Ÿ‚â‚â¯‚âÇ‚â¨œ°Ÿ‚â‚âÀœ°Ÿ‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚æ‚â‚â×‚â‹‚â‚æ‚â‚æ‚âhœ°Ÿ‚æ‚â·‚âg‚â‚âß‚âg‚æ‚â—‚æ'‚âœœ°Ÿ‚â«‚âã‚â_‚âc‚âÓ‚â‚â‚æ‚â¯‚â—‚âß‚â´t±Ý¥‘Ñ¡ÌélÐÈ°ÄÐ°ÌÀ°ÌÀ°ÈÐ°Äà°ÈÐ°ÈÐ°ÈÑt±É½ÝÌé™¥¹…¹¥…±I½ÝÌ¹µ…À¡ôùí½¹ÍÐÐõ…µ…•MÕµµ…Éä¹½±±•Ñ¥½¹Q½Ñ…±Ì¡¤íÉ•ÑÕÉ¹m¹¥±¹½µÁ…¹ä±…µ…•MÕµµ…Éä¹…Ñ•½É¥•Ím…µ…•MÕµµ…Éä¹±…ÍÍ¥™ä¡¹…ÕÍ”¤¹…Ñ•½Éåt±¹½±±•Ñ¥½¸ü¹Á…ÉÑå}¹…µ”ñð€Ÿ‚â‚â·‚â‹‚âß‚âg‚â‹‚âÇ‚âdœ±¹½±±•Ñ¥½¸ü¹Á…ÉÑå}½‘”ñð€œœ±¹½±±•Ñ¥½¸ü¹Í¡¥™Ðñð€œœ°¸¸¹l…ÁÁÉ½Ù•œ°Á…¥œ°¹•Ðt¹µ…À¡¬ôùÑm­tüüŸ‚â‚â·‚â‹‚âß‚âg‚â‹‚âÇ‚âdœ¥tíô¥ô°(€€€€€í¹…µ”èŸ‚âo‚â‚âÃ‚âŸ‚âÇ‚âW‚âÓ‚æ‚â·‚âg‚â‚âß‚âdœ±¡•…‘•ÉÌélŸ‚æ‚â‚â¨œ°Ÿ‚âk‚â‚âÓ‚â§‚âÇ‚â\œ°Ÿ‚âŸ‚âÇ‚âg‚â_‚â×‚æ#‚æ‚â·‚âdœ°Ÿ‚â‹‚â·‚âPœ°Ÿ‚â‚â¯‚âÇ‚â«‚æ‚â·‚âdœ°Ÿ‚æ‚â‚â—‚æ3‚â¯‚â—‚âÇ‚â‚âC‚âË‚âd%œ°Ÿ‚â«‚â[‚âË‚âg‚âÀœ°Ÿ‚æ‚â¯‚âW‚âã‚âs‚â—‚â‹‚â‚æ‚â—‚âÓ‚ât±Ý¥‘Ñ¡ÌélÐÈ°ÄÐ°ÄØ°ÈÐ°ÐÈ°ÐÈ°ÈÀ°ØÁt±É½ÝÌé™¥¹…¹¥…±I½ÝÌ¹™±…Ñ5…À¡ôø¡¹É••¥ÁÑÌñðmt¤¹µ…À¡Èôùm¹¥±¹½µÁ…¹ä±È¹Á…¥‘}…Ð±9Õµ‰•È¡È¹…µ½Õ¹Ð¤±È¹ÑÉ…¹Í™•É}É•™•É•¹”±È¹Í½ÕÉ•}™¥±•}¥±È¹Ù½¥‘•‘}…ÐüŸ‚â‹‚â‚æ‚â—‚âÓ‚â‚æ‚â—‚æ'‚âœœèŸ‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚æ‚â—‚æ'‚âœœ±È¹Ù½¥‘}É•…Í½¸ñð€œt¤¥ô(€€€t¤ì(€ô¤ì(€€ ˆ‘…µ…•½á•ÁÑ¥½¹Ìˆ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø¼ ‰•á•ÁÑ¥½¹Ìˆ¤¤ì(€€ ˆ‘…µ…•½±…É¥™äˆ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø¼ ‰±…É¥™äˆ¤¤ì(€‰¥¹‘MÑ½É•‘¥±•1¥¹­Ì¡É½½Ð¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µ‘…µ…”µ•átˆ¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø½Á•¹á•ÁÑ¥½¸¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹‘…µ…•à¤¤¤ì)ô()Y%]L¹‘…µ…”€ô€¡É½½Ð¤€ôøì(€¥˜€¡ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€‰ÁÉ½‘ÕÑ¥½¸ˆ€˜˜Mˆ¹Í¥¹•‘%¸ ¤¤ì(€€€É•¹‘•É1¥Ù•…µ…”¡É½½Ð¤ì(€€€É•ÑÕÉ¸ì(€ô(€½¹ÍÐÍÕ´€ô€¡…ÉÈ¤€ôø…ÉÈ¹É•‘Õ” ¡„°Œ¤€ôø„€¬‘µQ!¡Œ¤°€À¤ì(€½¹ÍÐ‰åå±”€ô¹‘…µ…•å±•Ì¹µ…À ¡Œ¤€ôø€¡ì€¸¸¹Œ°É•½É‘Ìè¹‘…µ…•Ì¹™¥±Ñ•È ¡¤€ôø¹å±”€ôôôŒ¹½‘”€˜˜¥¹I…¹”¡¹‘…Ñ”¤¤ô¤¤ì(€½¹ÍÐå±”€ô¹‘…µ…•å±•Ì¹™¥¹ ¡Œ¤€ôøŒ¹½‘”€ôôôÍÑ…Ñ”¹‘…µ…•å±”¤ñð¹‘…µ…•å±•ÍlÁtì(€½¹ÍÐÉ½ÝÌ€ô¹‘…µ…•Ì¹™¥±Ñ•È ¡¤€ôø¹å±”€ôôôå±”¹½‘”€˜˜¥¹I…¹”¡¹‘…Ñ”¤¤ì(€½¹ÍÐ‰åM¡¥™Ð€ô¹Í¡¥™ÑÌ¹µ…À ¡Ì¤€ôø€¡ì±…‰•°èÌ¹¹…µ”°Ù…±Õ”èÍÕ´¡É½ÝÌ¹™¥±Ñ•È ¡¤€ôø¹Í¡¥™Ð€ôôôÌ¹½‘”¤¤ô¤¤ì(€½¹ÍÐ‰åµÀ€ô=‰©•Ð¹•¹ÑÉ¥•Ì (€€€É½ÝÌ¹É•‘Õ” ¡„°¤€ôøì(€€€€€…m¹•µÁ±½å••t€ô€¡…m¹•µÁ±½å••tñð€À¤€¬‘µQ!¡¤ì(€€€€€É•ÑÕÉ¸„ì(€€€ô°íô¤°(€€¤(€€€€¹µ…À ¡m¬°Ùt¤€ôø€¡ì±…‰•°è¬°Ù…±Õ”èØô¤¤(€€€€¹Í½ÉÐ ¡„°ˆ¤€ôøˆ¹Ù…±Õ”€´„¹Ù…±Õ”¤(€€€€¹Í±¥” À°€Ø¤ì((€É½½Ð¹¥¹¹•É!Q50€ô€(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰å±”µ…É‘Ìˆø(€€€€€€‘í‰åå±”(€€€€€€€€¹µ…À (€€€€€€€€€€¡Œ¤€ôø€ñ…ÉÑ¥±”±…ÍÌô‰Á…¹•°å±”€‘íŒ¹ÍÑ…ÑÕÍô€‘íŒ¹½‘”€ôôôå±”¹½‘”€ü€‰Í•±•Ñ•ˆ€è€ˆ‰ôˆ‘…Ñ„µå±”ôˆ‘íŒ¹½‘•ôˆø(€€€€€€€€ñÀ±…ÍÌô‰•å•‰É½Üˆø‘íŒ¹ÍÑ…ÑÕÌ€ôôô€‰½Á•¸ˆ€ü€‹‚â‚â·‚âk‚â_‚â×‚æ#‚æ‚âo‚âÓ‚âS‚â·‚â‹‚âç‚æ ˆ€è€‹‚âo‚âÓ‚âS‚â‚â·‚âk‚æ‚â—‚æ'‚âœ‰ôð½Àø(€€€€€€€€ñ Èø‘í ¡Œ¹¹…µ”¥ôð½ Èø(€€€€€€€€ñÍÑÉ½¹œø‘íµ½¹•äÀ¡ÍÕ´¡Œ¹É•½É‘Ì¤¥ôƒ‚âk‚âË‚â\ð½ÍÑÉ½¹œø(€€€€€€€€ñÍµ…±°ø‘íå±•EÕ½Ñ•1…‰•°¡Œ¹É•½É‘Ì¥ô‘íŒ¹É•½É‘Ì¹±•¹Ñ¡ôƒ‚æ‚â‚â¨ƒ
Üƒ‚æ‚â¯‚æ'‚æ‚âŸ‚â—‚âË‚æ‚âg‚âk‚â¯‚â—‚âÇ‚â‚âC‚âË‚âd€‘í¹Í•ÑÑ¥¹Ì¹Í±…Ù¥‘•¹•…åÍôƒ‚âŸ‚âÇ‚âdð½Íµ…±°ø(€€€€€€€€‘ì(€€€€€€€€€Œ¹ÍÑ…ÑÕÌ€ôôô€‰½Á•¸ˆ(€€€€€€€€€€€€ü€ñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸Í´ˆ‘…Ñ„µ±½Í”µå±”ôˆ‘íŒ¹½‘•ôˆû‚âo‚âÓ‚âS‚â‚â·‚âk‚æ‚â—‚âÃ‚â«‚æ#‚â‚â‚âË‚â‚æ‚â‚âÓ‚âd¿‚âk‚âã‚â‚â‚â”ð½‰ÕÑÑ½¸ù€(€€€€€€€€€€€€è€ñÍÁ…¸±…ÍÌô‰±½¬µÑ…œˆûÂ~RHƒ‚â—‚æ‚â·‚â‚æ‚â—‚æ'‚âœƒ‚æ‚â‚æ'‚â‹‚æ'‚â·‚âg‚â¯‚â—‚âÇ‚â‚âW‚æ'‚â·‚â‚â‡‚â×‚æ‚â¯‚âW‚âã‚âs‚â—‚æ‚â—‚âÀ…ÁÁÉ½Ù…°ƒ‚æ‚â¯‚â‡‚æ ð½ÍÁ…¸ù€(€€€€€€€ô(€€€€€€ð½…ÉÑ¥±”ù€°(€€€€€€€€¤(€€€€€€€€¹©½¥¸ ˆˆ¥ô(€€€€ð½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰É¥´Èˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆû‚âW‚âË‚â‡‚â‚âÀð½Àøñ Èû‚â‹‚â·‚âS‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚â‹‚â‚â‚âÀð½ Èøð½‘¥Øøð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¡…ÉÐˆ¥ô‰¡µM¡¥™Ðˆøð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆû‚âW‚âË‚â‡‚â{‚âg‚âÇ‚â‚â‚âË‚âdð½Àøñ Èû‚âs‚âç‚æ'‚â_‚â×‚æ#‚æ‚â‚âÓ‚âS‚æ‚â‚â«‚â/‚æ'‚âÌð½ Èøð½‘¥Øøð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¡…ÉÐˆ¥ô‰¡µµÀˆøð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆù…µ…”I•¥ÍÑ•Èð½Àøñ Èû‚â‚âË‚â‹‚â‚âË‚â‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆ€‘í ¡å±”¹¹…µ”¥ôð½ ÈøñÍµ…±°±…ÍÌô‰¡•…µÍÕˆˆû‚â+‚æ#‚âŸ‚â‚â‚æ'‚â·‚â‡‚âç‚â”€‘í ¡É…¹•1…‰•° ¤¥ôð½Íµ…±°øð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹±¥¹”µ…Ñ¥½¹Ìˆø(€€€€€€€€€€ñÍ•±•Ð¥ô‰‘µå±”ˆ…É¥„µ±…‰•°ô‹‚æ‚â—‚âß‚â·‚â‚â‚â·‚âk‚â+‚â×‚æ'‚æ‚â#‚âˆø(€€€€€€€€€€€€‘í¹‘…µ…•å±•Ì¹µ…À ¡Œ¤€ôø€ñ½ÁÑ¥½¸Ù…±Õ”ôˆ‘íŒ¹½‘•ôˆ€‘íŒ¹½‘”€ôôôå±”¹½‘”€ü€‰Í•±•Ñ•ˆ€è€ˆ‰ôø‘í ¡Œ¹¹…µ”¥ôð½½ÁÑ¥½¸ù€¤¹©½¥¸ ˆˆ¥ô(€€€€€€€€€€ð½Í•±•Ðø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰‘µáÁ½ÉÐˆùáÁ½ÉÐƒ‚â«‚æ#‚â‚â‚âË‚â‚æ‚â‚âÓ‚âdð½‰ÕÑÑ½¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…Àˆø(€€€€€€€€ñÑ…‰±”ø(€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ û‚â‚â¯‚âÇ‚â¨ð½Ñ øñÑ û‚æ‚â‚â«‚â·‚æ'‚âË‚â‚â·‚âÓ‚âð½Ñ øñÑ û‚âk‚â‚âÓ‚â§‚âÇ‚â\ð½Ñ øñÑ û‚â{‚âg‚âÇ‚â‚â‚âË‚âdð½Ñ øñÑ û‚â‚âÀð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚â‹‚â·‚âS‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆ€£‚âk‚âË‚â\¤ð½Ñ øñÑ û‚â«‚âË‚æ‚â¯‚âW‚âàð½Ñ øñÑ û‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdð½Ñ øñÑ û‚â«‚â[‚âË‚âg‚âÀ!Hð½Ñ øð½ÑÈøð½Ñ¡•…ø(€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€€‘íÉ½ÝÌ(€€€€€€€€€€€€€€¹µ…À (€€€€€€€€€€€€€€€€¡¤€ôø€ñÑÈø(€€€€€€€€€€€€€€ñÑøñˆø‘í¹¥‘ôð½ˆøð½Ñø(€€€€€€€€€€€€€€ñÑø‘í¹•á•ÁÑ¥½¹%€ôôô€ˆ´ˆ€ü€œñÍÁ…¸±…ÍÌô‰µÕÑ•ˆø´ð½ÍÁ…¸øœ€è€ñ‰ÕÑÑ½¸±…ÍÌô‰±¥¹¬µ‰Ñ¸ˆ‘…Ñ„µ•àôˆ‘í¹•á•ÁÑ¥½¹%‘ôˆø‘í¹•á•ÁÑ¥½¹%‘ôð½‰ÕÑÑ½¸ùôð½Ñø(€€€€€€€€€€€€€€ñÑø‘í ¡¹½µÁ…¹¥•Ì¹™¥¹ ¡Œ¤€ôøŒ¹½‘”€ôôô¹½µÁ…¹ä¤ü¹¹…µ”ñð¹½µÁ…¹ä¥ôð½Ñø(€€€€€€€€€€€€€€ñÑø‘í ¡¹•µÁ±½å•”¥ôð½Ñø(€€€€€€€€€€€€€€ñÑø‘í ¡¹Í¡¥™ÑÌ¹™¥¹ ¡Ì¤€ôøÌ¹½‘”€ôôô¹Í¡¥™Ð¤¹¹…µ”¥ôð½Ñø(€€€€€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘íµ½¹•ä¡‘µQ!¡¤¥ôð½Ñø(€€€€€€€€€€€€€€ñÑø‘í ¡¹…ÕÍ”¥ôð½Ñø(€€€€€€€€€€€€€€ñÑø‘í¹•Ù¥‘•¹”€ü€œñÍÁ…¸±…ÍÌô‰‰…‘”É••¸ˆû‚â‚â‚âhð½ÍÁ…¸øœ€è€œñÍÁ…¸±…ÍÌô‰‰…‘”…µ‰•Èˆû‚â‚â´ð½ÍÁ…¸øôð½Ñø(€€€€€€€€€€€€€€ñÑø‘í ¡¹¡ÉMÑ…ÑÕÌ¥ôð½Ñø(€€€€€€€€€€€€ð½ÑÈù€°(€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€¹©½¥¸ ˆˆ¥ô(€€€€€€€€€€ð½Ñ‰½‘äø(€€€€€€€€€€ñÑ™½½ÐøñÑÈøñÑ½±ÍÁ…¸ôˆÔˆû‚â‚âŸ‚â„€‘íÉ½ÝÌ¹±•¹Ñ¡ôƒ‚æ‚â‚â¨ð½ÑøñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆøñˆø‘íµ½¹•ä¡ÍÕ´¡É½ÝÌ¤¥ôð½ˆøð½ÑøñÑ½±ÍÁ…¸ôˆÌˆøð½Ñøð½ÑÈøð½Ñ™½½Ðø(€€€€€€€€ð½Ñ…‰±”ø(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ù€ì((€¡…ÉÑÌ¹‘É…Ü ˆ¡µM¡¥™Ðˆ°€‰‰…ÉÌˆ°ì±…‰•°è€‹‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚âW‚âË‚â‡‚â‚âÀˆ°¥Ñ•µÌè‰åM¡¥™Ð°½±½Èè€ˆÀÍˆÍˆˆ°µ½¹•äèÑÉÕ”°µ•ÑÉ¥Œè€‹‚â‹‚â·‚âP€£‚âk‚âË‚â\¤ˆ°¡•¥¡Ðè€ÈÈÀô¤ì(€¡…ÉÑÌ¹‘É…Ü ˆ¡µµÀˆ°€‰¡‰…ÉÌˆ°ì±…‰•°è€‹‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚âW‚âË‚â‡‚â{‚âg‚âÇ‚â‚â‚âË‚âdˆ°¥Ñ•µÌè‰åµÀ°½±½Èè¡…ÉÑÌ¹A1QQ¹ÌÈ°µ½¹•äèÑÉÕ”°µ•ÑÉ¥Œè€‹‚â‹‚â·‚âP€£‚âk‚âË‚â\¤ˆô¤ì((€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µ•átˆ¤¹™½É…  ¡ˆ¤€ôøˆ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø½Á•¹á•ÁÑ¥½¸¡ˆ¹‘…Ñ…Í•Ð¹•à¤¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µå±•tˆ¤¹™½É…  ¡Œ¤€ôø(€€€Œ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€¡•ÙÐ¤€ôøì(€€€€€¥˜€¡•ÙÐ¹Ñ…É•Ð¹±½Í•ÍÐ ‰‰ÕÑÑ½¸ˆ¤¤É•ÑÕÉ¸ì(€€€€€ÍÑ…Ñ”¹‘…µ…•å±”€ôŒ¹‘…Ñ…Í•Ð¹å±”ì(€€€€€É•¹‘•È ¤ì(€€€ô¤°(€€¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µ±½Í”µå±•tˆ¤¹™½É…  ¡ˆ¤€ôø(€€€ˆ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€€€¥˜€ ……¸ ‰±½Í•}å±”ˆ¤¤É•ÑÕÉ¸‘•¹ä ‹‚âo‚âÓ‚âS‚â‚â·‚âk‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆˆ¤ì(€€€€€½¹ÍÐŒ€ô¹‘…µ…•å±•Ì¹™¥¹ ¡à¤€ôøà¹½‘”€ôôôˆ¹‘…Ñ…Í•Ð¹±½Í•å±”¤ì(€€€€€½¹ÍÐ¹½Ù¥‘•¹”€ô¹‘…µ…•Ì¹™¥±Ñ•È ¡¤€ôø¹å±”€ôôôŒ¹½‘”€˜˜€…¹•Ù¥‘•¹”¤¹±•¹Ñ ì(€€€€€¥˜€¡¹½Ù¥‘•¹”¤É•ÑÕÉ¸Ñ½…ÍÐ¡ƒ‚â‹‚âÇ‚â‚â‡‚âÔ€‘í¹½Ù¥‘•¹•ôƒ‚æ‚â‚â«‚æ‚â‡‚æ#‚â‡‚â×‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdƒ‚âo‚âÓ‚âS‚â‚â·‚âk‚æ‚â‡‚æ#‚æ‚âS‚æ%€°€‰Ý…É¸ˆ¤ì(€€€€€Œ¹ÍÑ…ÑÕÌ€ô€‰±½­•ˆì(€€€€€±½Ñ¥½¸ ‰±½Í•}å±”ˆ°€‰‘…µ…•}å±”ˆ°Œ¹½‘”°€‹‚âo‚âÓ‚âS‚â‚â·‚âk‚æ‚â—‚âÃ‚â«‚æ#‚â‚â«‚â‚âã‚âo‚æ‚â¯‚æ'‚â‚âË‚â‚æ‚â‚âÓ‚âd¿‚âk‚âã‚â‚â‚â”ˆ¤ì(€€€€€Ñ½…ÍÐ ‹‚âo‚âÓ‚âS‚â‚â·‚âh€ˆ€¬Œ¹¹…µ”€¬€ˆƒ‚æ‚â—‚âÃ‚â—‚æ‚â·‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚æ‚â—‚æ'‚âœˆ¤ì(€€€€€É•¹‘•È ¤ì(€€€ô¤°(€€¤ì(€€ ˆ‘µå±”ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€¡”¤€ôø”¹ÍÑ½ÁAÉ½Á……Ñ¥½¸ ¤¤ì(€€ ˆ‘µå±”ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¡…¹”ˆ°€¡”¤€ôøì(€€€ÍÑ…Ñ”¹‘…µ…•å±”€ô”¹Ñ…É•Ð¹Ù…±Õ”ì(€€€É•¹‘•È ¤ì(€ô¤ì(€€ ˆ‘µáÁ½ÉÐˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø(€€€•áÁ½ÉÑM¡••ÑÌ ‹‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‰|ˆ€¬å±”¹½‘”°l(€€€€€ì(€€€€€€€¹…µ”è€‹‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆ€ˆ€¬å±”¹½‘”°(€€€€€€€Ñ¥Ñ±”è€‹‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆ€ˆ€¬å±”¹¹…µ”°(€€€€€€€¡•…‘•ÉÌèl‹‚â‚â¯‚âÇ‚â¨ˆ°€‹‚æ‚â‚â«‚â·‚æ'‚âË‚â‚â·‚âÓ‚âˆ°€‹‚âŸ‚âÇ‚âg‚â_‚â×‚æ ˆ°€‹‚âk‚â‚âÓ‚â§‚âÇ‚â\ˆ°€‹‚â{‚âg‚âÇ‚â‚â‚âË‚âdˆ°€‹‚â‚âÀˆ°€‹‚â‹‚â·‚âS‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆˆ°€‹‚â«‚âË‚æ‚â¯‚âW‚âàˆ°€‹‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdˆ°€‹‚â«‚â[‚âË‚âg‚âÀ!Hˆ°€‹‚â«‚â[‚âË‚âg‚âÃ‚â‚âË‚â‚æ‚â‚âÓ‚âd‰t°(€€€€€€€Ý¥‘Ñ¡ÌèlÄÐ°€ÄÈ°€ÄÈ°€ÄÐ°€ÄÜ°€ÄÀ°€ÄÐ°€ÌÈ°€ÄÀ°€ÄØ°€ÄÙt°(€€€€€€€É½ÝÌèÉ½ÝÌ¹µ…À ¡¤€ôøm¹¥°¹•á•ÁÑ¥½¹%°¹‘…Ñ”°€¡¹½µÁ…¹¥•Ì¹™¥¹ ¡Œ¤€ôøŒ¹½‘”€ôôô¹½µÁ…¹ä¤ñðíô¤¹¹…µ”ñð¹½µÁ…¹ä°¹•µÁ±½å•”°€¡¹Í¡¥™ÑÌ¹™¥¹ ¡Í ¤€ôøÍ ¹½‘”€ôôô¹Í¡¥™Ð¤ñðíô¤¹¹…µ”ñð¹Í¡¥™Ð°¹…µ½Õ¹Ð°¹…ÕÍ”°¹•Ù¥‘•¹”€ü€‹‚â‚â‚âhˆ€è€‹‚â‚â´ˆ°¹¡ÉMÑ…ÑÕÌ°¹™¥¹…¹•MÑ…ÑÕÍt¤°(€€€€€ô°(€€€t¤°(€€¤ì)ôì()™Õ¹Ñ¥½¸ÁµAÉ½Ù¥‘•É=˜¡Ù…±Õ”¤ì(€½¹ÍÐÑ•áÐ€ôMÑÉ¥¹œ¡Ù…±Õ”ñð€ˆˆ¤¹Ñ½UÁÁ•É…Í” ¤ì(€¥˜€ ¼ üéyñmyµhÀ´åt¤ üé9Qñ9eAd¤ üô‘ñmyµhÀ´åt¤¼¹Ñ•ÍÐ¡Ñ•áÐ¤¤É•ÑÕÉ¸€‰9Pˆì(€¥˜€ ½UQ=AIñq‰QAqˆ¼¹Ñ•ÍÐ¡Ñ•áÐ¤¤É•ÑÕÉ¸€‰UQ=AHˆì(€¥˜€ ½iAd¼¹Ñ•ÍÐ¡Ñ•áÐ¤¤É•ÑÕÉ¸€‰iAdˆì(€¥˜€ ½=IAeñAl|µtýAd¼¹Ñ•ÍÐ¡Ñ•áÐ¤¤É•ÑÕÉ¸€‰=IAdˆì(€¥˜€ ½Aa4¼¹Ñ•ÍÐ¡Ñ•áÐ¤¤É•ÑÕÉ¸€‰=IAdˆì(€¥˜€ ½e	IA1UMñe9IA1UMñq‰	eqˆ¼¹Ñ•ÍÐ¡Ñ•áÐ¤¤É•ÑÕÉ¸€‰e	IA1ULˆì(€¥˜€ ½5eAd¼¹Ñ•ÍÐ¡Ñ•áÐ¤¤É•ÑÕÉ¸€‰5eAdˆì(€¥˜€ ¼ üèÄÉðÄÈÌ¥Ad¼¹Ñ•ÍÐ¡Ñ•áÐ¤¤É•ÑÕÉ¸€ˆÄÉAdˆì(€É•ÑÕÉ¸¹Õ±°ì)ô((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€Y%\è-A$(€€€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼)™Õ¹Ñ¥½¸É•¹‘•É1¥Ù•-Á¤¡É½½Ð¤ì(€¥˜€ …•¹ÍÕÉ•1¥Ù•=Ù•ÉÙ¥•Ü¡É½½Ð¤¤É•ÑÕÉ¸ì(€½¹ÍÐ•à€ôÍ½Á•‘á•ÁÑ¥½¹Ì ¤ì(€½¹ÍÐ‰å½µÁ…¹ä€ô½µÁ…¹å5…ÍÑ•È ¤¹µ…À ¡½µÁ…¹ä¤€ôø€¡ì±…‰•°è½µÁ…¹ä¹½‘”°Ù…±Õ”è•à¹™¥±Ñ•È ¡”¤€ôø”¹½µÁ…¹ä€ôôô½µÁ…¹ä¹½‘”¤¹±•¹Ñ ô¤¤¹™¥±Ñ•È ¡¥Ñ•´¤€ôø¥Ñ•´¹Ù…±Õ”¤ì(€½¹ÍÐ‰å¥É•Ñ¥½¸€ôl‰A4ˆ°€‹‚âw‚âË‚âˆ°€‹‚â[‚â·‚âd‰t¹µ…À ¡‘¥É•Ñ¥½¸¤€ôø€¡ì±…‰•°è‘¥É•Ñ¥½¸°Ù…±Õ”è•à¹™¥±Ñ•È ¡”¤€ôø”¹‘¥É•Ñ¥½¸€ôôô‘¥É•Ñ¥½¸¤¹±•¹Ñ ô¤¤ì(€½¹ÍÐ•µÁ±½å••9…µ•Ì€ôl¸¸¹¹•ÜM•Ð¡•à¹µ…À ¡”¤€ôø”¹•µÁ±½å•”ñð€‹‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âàˆ¤¥tì(€½¹ÍÐ•µÁ±½å••Ì€ô•µÁ±½å••9…µ•Ì¹µ…À ¡•µÁ±½å•”¤€ôøì(€€€½¹ÍÐÉ½ÝÌ€ô•à¹™¥±Ñ•È ¡”¤€ôø€¡”¹•µÁ±½å•”ñð€‹‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âàˆ¤€ôôô•µÁ±½å•”¤ì(€€€É•ÑÕÉ¸ì•µÁ±½å•”°É½ÝÌ°É¥Ñ¥…°èÉ½ÝÌ¹™¥±Ñ•È ¡”¤€ôø”¹Í•Ù•É¥Ñä€ôôô€‰É¥Ñ¥…°ˆ¤¹±•¹Ñ °Í±„èÉ½ÝÌ¹™¥±Ñ•È ¡”¤€ôø”¹½Ù•ÉM±„¤¹±•¹Ñ °…µ½Õ¹ÐèÍÕµI¥Í¬¡É½ÝÌ¤ôì(€ô¤¹Í½ÉÐ ¡„±ˆ¤ôùˆ¹É½ÝÌ¹±•¹Ñ µ„¹É½ÝÌ¹±•¹Ñ ¤ì(€É½½Ð¹¥¹¹•É!Q50€ô€(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰ÍÑ…ÑÕÌµÍÑÉ¥À™½ÕÈˆø(€€€€€€ñ…ÉÑ¥±”øñÍÁ…¸û‚æ‚â‚â«‚â_‚â×‚æ#‚â‚âÃ‚âk‚âk‚âW‚â‚âŸ‚â#‚â{‚âhð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡•à¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°ø‘í ¡É…¹•1…‰•° ¤¥ôð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”±…ÍÌô‰‰…ˆøñÍÁ…¸ùÉ¥Ñ¥…°ð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡•à¹™¥±Ñ•È ¡”¤ôù”¹Í•Ù•É¥Ñäôôô‰É¥Ñ¥…°ˆ¤¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚âW‚æ'‚â·‚â‚âW‚â‚âŸ‚â#‚æ‚â‚æ#‚â‚âS‚æ#‚âŸ‚âdð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”±…ÍÌô‰Ý…É¸ˆøñÍÁ…¸û‚æ‚â‚âÓ‚âdM1ð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡•à¹™¥±Ñ•È ¡”¤ôù”¹½Ù•ÉM±„¤¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚â‚âÏ‚âg‚âŸ‚âO‚â#‚âË‚âÉ•…Ñ•‘}…Ðƒ‚â#‚â‚âÓ‚âð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”øñÍÁ…¸û‚â‹‚â·‚âS‚æ‚â«‚â×‚æ#‚â‹‚â‚â‚âŸ‚â„ð½ÍÁ…¸øñÍÑÉ½¹œø‘íµ½¹•äÀ¡ÍÕµI¥Í¬¡•à¤¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚âk‚âË‚â\ð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€ð½Í•Ñ¥½¸ø(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰É¥´Èˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆøñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆû‚âk‚â‚âÓ‚â§‚âÇ‚â\ð½Àøñ Èùá•ÁÑ¥½¸ƒ‚âW‚âË‚â‡‚âk‚â‚âÓ‚â§‚âÇ‚â\ð½ Èøð½‘¥Øøð½‘¥Øøñ‘¥Ø±…ÍÌô‰¡…ÉÐˆ¥ô‰±¥Ù•-Á¥½µÁ…¹äˆøð½‘¥Øøð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆøñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆû‚âo‚â‚âÃ‚æ‚âƒ‚â\ð½Àøñ ÈùA4€¼ƒ‚âw‚âË‚â€¼ƒ‚â[‚â·‚âdð½ Èøð½‘¥Øøð½‘¥Øøñ‘¥Ø±…ÍÌô‰¡…ÉÐˆ¥ô‰±¥Ù•-Á¥¥É•Ñ¥½¸ˆøð½‘¥Øøð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆøñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆû‚âs‚âç‚æ'‚æ‚â‚â×‚æ#‚â‹‚âŸ‚â‚æ'‚â·‚â‚â#‚âË‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚â‚âÓ‚âð½Àøñ Èû‚â«‚â‚âã‚âo‚âW‚âË‚â„•µÁ±½å•”ƒ‚æ‚âdá•ÁÑ¥½¸ð½ Èøð½‘¥Øøð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…ÀˆøñÑ…‰±”øñÑ¡•…øñÑÈøñÑ û‚âs‚âç‚æ'‚æ‚â‚â×‚æ#‚â‹‚âŸ‚â‚æ'‚â·‚âð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚æ‚â‚â¨ð½Ñ øñÑ ±…ÍÌô‰É¥¡ÐˆùÉ¥Ñ¥…°ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚æ‚â‚âÓ‚âdM1ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚â‹‚â·‚âS‚æ‚â«‚â×‚æ#‚â‹‚âð½Ñ øð½ÑÈøð½Ñ¡•…ø(€€€€€€ñÑ‰½‘äø‘í•µÁ±½å••Ì¹Í±¥” À°ÄÀÀ¤¹µ…À ¡É½Ü¤ôù€ñÑÈøñÑø‘í ¡É½Ü¹•µÁ±½å•”¥ôð½ÑøñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í¹Õ´¡É½Ü¹É½ÝÌ¹±•¹Ñ ¥ôð½ÑøñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í¹Õ´¡É½Ü¹É¥Ñ¥…°¥ôð½ÑøñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í¹Õ´¡É½Ü¹Í±„¥ôð½ÑøñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘íµ½¹•ä¡É½Ü¹…µ½Õ¹Ð¥ôð½Ñøð½ÑÈù€¤¹©½¥¸ ˆˆ¤ñð€ñÑÈøñÑ½±ÍÁ…¸ôˆÔˆ±…ÍÌô‰•µÁÑäˆû‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚âÔá•ÁÑ¥½¸ƒ‚æ‚âg‚â+‚æ#‚âŸ‚â‚âg‚â×‚æ$ð½Ñøð½ÑÈùôð½Ñ‰½‘äøð½Ñ…‰±”øð½‘¥Øø(€€€€€€ñÀ±…ÍÌô‰¡¥¹Ðˆû‚âW‚âË‚â‚âË‚â‚âg‚â×‚æ'‚æ‚â+‚æ'‚â‚æ#‚âË‚â_‚â×‚æ#‚â·‚â‹‚âç‚æ#‚æ‚âg‚â‚âÓ‚â—‚âS‚æ0•µÁ±½å•”ƒ‚â‚â·‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚â‚âÓ‚â‚æ‚â_‚æ#‚âË‚âg‚âÇ‚æ'‚âdƒ‚æ‚â‡‚æ#‚â‡‚â×‚â‚âË‚â‹‚â+‚âß‚æ#‚â·‚â{‚âg‚âÇ‚â‚â‚âË‚âg‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚âð½Àø(€€€€ð½Í•Ñ¥½¸ù€ì(€¡…ÉÑÌ¹‘É…Ü ˆ±¥Ù•-Á¥½µÁ…¹äˆ°€‰¡‰…ÉÌˆ°ì±…‰•°è€‰á•ÁÑ¥½¸ƒ‚âW‚âË‚â‡‚âk‚â‚âÓ‚â§‚âÇ‚â\ˆ°¥Ñ•µÌè‰å½µÁ…¹ä°½±½Èè¡…ÉÑÌ¹A1QQ¹ÌÄ°µ•ÑÉ¥Œè€‹‚â#‚âÏ‚âg‚âŸ‚âg‚æ‚â‚â¨ˆô¤ì(€¡…ÉÑÌ¹‘É…Ü ˆ±¥Ù•-Á¥¥É•Ñ¥½¸ˆ°€‰‰…ÉÌˆ°ì±…‰•°è€‰á•ÁÑ¥½¸ƒ‚âW‚âË‚â‡‚âo‚â‚âÃ‚æ‚âƒ‚â\ˆ°¥Ñ•µÌè‰å¥É•Ñ¥½¸°½±½Èè¡…ÉÑÌ¹A1QQ¹ÌÌ°µ•ÑÉ¥Œè€‹‚â#‚âÏ‚âg‚âŸ‚âg‚æ‚â‚â¨ˆ°¡•¥¡Ðè€ÈÌÀô¤ì)ô()Y%]L¹­Á¤€ô€¡É½½Ð¤€ôøì(€¥˜€¡ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€‰ÁÉ½‘ÕÑ¥½¸ˆ€˜˜Mˆ¹Í¥¹•‘%¸ ¤¤ì(€€€É•¹‘•É1¥Ù•-Á¤¡É½½Ð¤ì(€€€É•ÑÕÉ¸ì(€ô(€½¹ÍÐ•à€ôÍ½Á•‘á•ÁÑ¥½¹Ì ¤ì(€½¹ÍÐ‰åM¡¥™Ð€ô¹Í¡¥™ÑÌ¹µ…À ¡Ì¤€ôø€¡ì(€€€±…‰•°è€‘íÌ¹¹…µ•õq¸‘íÌ¹É…¹•õ€°(€€€Ù…±Õ”è•à¹™¥±Ñ•È ¡”¤€ôø”¹Í¡¥™Ð€ôôôÌ¹½‘”¤¹±•¹Ñ °(€€€½‘”èÌ¹½‘”°(€ô¤¤ì(€½¹ÍÐ‰åµÀ€ô=‰©•Ð¹•¹ÑÉ¥•Ì (€€€•à¹É•‘Õ” ¡„°”¤€ôøì(€€€€€…m”¹•µÁ±½å••t€ô€¡…m”¹•µÁ±½å••tñð€À¤€¬€Äì(€€€€€É•ÑÕÉ¸„ì(€€€ô°íô¤°(€€¤(€€€€¹µ…À ¡m¬°Ùt¤€ôø€¡ì±…‰•°è¬°Ù…±Õ”èØô¤¤(€€€€¹Í½ÉÐ ¡„°ˆ¤€ôøˆ¹Ù…±Õ”€´„¹Ù…±Õ”¤ì(€½¹ÍÐ‰å½µÁ…¹ä€ô½µÁ…¹å5…ÍÑ•È ¤¹µ…À ¡Œ¤€ôø€¡ì±…‰•°èŒ¹¹…µ”°Ù…±Õ”è•à¹™¥±Ñ•È ¡”¤€ôø”¹½µÁ…¹ä€ôôôŒ¹½‘”¤¹±•¹Ñ ô¤¤¹™¥±Ñ•È ¡à¤€ôøà¹Ù…±Õ”¤ì((€É½½Ð¹¥¹¹•É!Q50€ô€(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰É¥´Ìˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùM¡¥™Ðð½Àøñ Èû‚æ‚â‚â«‚âW‚âË‚â‡‚â‚âÀð½ Èøð½‘¥Øøð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¡…ÉÐˆ¥ô‰­M¡¥™Ðˆøð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùµÁ±½å•”ð½Àøñ Èû‚â{‚âg‚âÇ‚â‚â‚âË‚âg‚â_‚â×‚æ#‚æ‚â‚âÓ‚âS‚æ‚â‚â«‚â‡‚âË‚â‚â_‚â×‚æ#‚â«‚âã‚âPð½ Èøð½‘¥Øøð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¡…ÉÐˆ¥ô‰­µÀˆøð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆù½µÁ…¹äð½Àøñ Èû‚æ‚â‚â«‚âW‚âË‚â‡‚âk‚â‚âÓ‚â§‚âÇ‚â\ð½ Èøð½‘¥Øøð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¡…ÉÐˆ¥ô‰­½µÁ…¹äˆøð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆù-A$Q…‰±”ð½Àøñ Èû‚â«‚â‚âã‚âo‚â‚âË‚â‹‚â{‚âg‚âÇ‚â‚â‚âË‚âdð½ Èøð½‘¥Øø(€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰­Á¥áÁ½ÉÐˆùáÁ½ÉÐMXð½‰ÕÑÑ½¸ø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…Àˆø(€€€€€€€€ñÑ…‰±”ø(€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ û‚â{‚âg‚âÇ‚â‚â‚âË‚âdð½Ñ øñÑ û‚â‚âÀð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚æ‚â‚â«‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âPð½Ñ øñÑ ±…ÍÌô‰É¥¡ÐˆùÉ¥Ñ¥…°ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚æ‚â‚âÓ‚âdM1ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚â‹‚â·‚âP‘¥™˜ƒ‚â‚âŸ‚â„ð½Ñ øñÑ û‚â‚âÃ‚âS‚âÇ‚âk‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚æ#‚â‹‚âð½Ñ øð½ÑÈøð½Ñ¡•…ø(€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€€‘í¹•µÁ±½å••Ì(€€€€€€€€€€€€€€¹µ…À ¡•µÀ¤€ôøì(€€€€€€€€€€€€€€€½¹ÍÐÉ½ÝÌ€ô•à¹™¥±Ñ•È ¡”¤€ôø”¹•µÁ±½å•”€ôôô•µÀ¹ÕÍ•É¹…µ”¤ì(€€€€€€€€€€€€€€€½¹ÍÐÉ¥Ð€ôÉ½ÝÌ¹™¥±Ñ•È ¡”¤€ôø”¹Í•Ù•É¥Ñä€ôôô€‰É¥Ñ¥…°ˆ¤¹±•¹Ñ ì(€€€€€€€€€€€€€€€½¹ÍÐÍ±„€ôÉ½ÝÌ¹™¥±Ñ•È ¡”¤€ôø”¹½Ù•ÉM±„¤¹±•¹Ñ ì(€€€€€€€€€€€€€€€½¹ÍÐ…µÐ€ôÍÕµI¥Í¬¡É½ÝÌ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÉ¥Í¬€ôÉ¥Ð€øô€ÐñðÍ±„€øô€Ô€ü€‹‚â«‚âç‚âˆ€èÉ¥Ð€øô€È€ü€‹‚â‚â—‚âË‚âˆ€è€‹‚âW‚æ#‚âÌˆì(€€€€€€€€€€€€€€€½¹ÍÐÑ½¹”€ôÉ¥Í¬€ôôô€‹‚â«‚âç‚âˆ€ü€‰É•ˆ€èÉ¥Í¬€ôôô€‹‚â‚â—‚âË‚âˆ€ü€‰…µ‰•Èˆ€è€‰É••¸ˆì(€€€€€€€€€€€€€€€É•ÑÕÉ¸€ñÑÈøñÑø‘í ¡•µÀ¹ÕÍ•É¹…µ”¥ôð½ÑøñÑø‘í ¡¹Í¡¥™ÑÌ¹™¥¹ ¡Ì¤€ôøÌ¹½‘”€ôôô•µÀ¹Í¡¥™Ð¤¹¹…µ”¥ôð½Ñø(€€€€€€€€€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘íÉ½ÝÌ¹±•¹Ñ¡ôð½ÑøñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘íÉ¥Ñôð½Ñø(€€€€€€€€€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´€‘íÍ±„€ü€‰‘…¹•Èˆ€è€ˆ‰ôˆø‘íÍ±…ôð½ÑøñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘íµ½¹•äÀ¡…µÐ¥ôð½Ñø(€€€€€€€€€€€€€€€€€€ñÑøñÍÁ…¸±…ÍÌô‰‰…‘”€‘íÑ½¹•ôˆø‘íÉ¥Í­ôð½ÍÁ…¸øð½Ñøð½ÑÈù€ì(€€€€€€€€€€€€€ô¤(€€€€€€€€€€€€€€¹©½¥¸ ˆˆ¥ô(€€€€€€€€€€ð½Ñ‰½‘äø(€€€€€€€€ð½Ñ…‰±”ø(€€€€€€ð½‘¥Øø(€€€€€€ñÀ±…ÍÌô‰¡…ÉÐµ¹½Ñ”ˆù-A$ƒ‚âg‚â×‚æ'‚æ‚â+‚æ'‚âo‚â‚âÃ‚â‚â·‚âk‚â‚âË‚â‚â¯‚âË‚â«‚âË‚æ‚â¯‚âW‚âã‚æ‚â+‚âÓ‚â‚â‚â‚âÃ‚âk‚âŸ‚âg‚â‚âË‚âŒƒ‚æ‚â‡‚æ#‚â‚âŸ‚â‚æ‚â+‚æ'‚âW‚âÇ‚âS‚â«‚âÓ‚âg‚â—‚â‚æ‚â_‚â§‚æ‚âS‚â‹‚æ‚â‡‚æ#‚âs‚æ#‚âË‚âg‚â‚âË‚â‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÓ‚æ‚â—‚âÃ‚âW‚â‚âŸ‚â#‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚âW‚âË‚â‡‚â‚â·‚âk‚â+‚â×‚æ'‚æ‚â#‚âð½Àø(€€€€ð½Í•Ñ¥½¸ù€ì((€¡…ÉÑÌ¹‘É…Ü ˆ­M¡¥™Ðˆ°€‰‰…ÉÌˆ°ì±…‰•°è€‹‚æ‚â‚â«‚âW‚âË‚â‡‚â‚âÀˆ°¥Ñ•µÌè‰åM¡¥™Ð°½±½Èè¡…ÉÑÌ¹A1QQ¹ÌÐ°µ•ÑÉ¥Œè€‹‚â#‚âÏ‚âg‚âŸ‚âg‚æ‚â‚â¨ˆ°¡•¥¡Ðè€ÈÌÀô¤ì(€¡…ÉÑÌ¹‘É…Ü ˆ­µÀˆ°€‰¡‰…ÉÌˆ°ì±…‰•°è€‹‚æ‚â‚â«‚âW‚âË‚â‡‚â{‚âg‚âÇ‚â‚â‚âË‚âdˆ°¥Ñ•µÌè‰åµÀ¹Í±¥” À°€à¤°½±½Èè¡…ÉÑÌ¹A1QQ¹ÌÈ°µ•ÑÉ¥Œè€‹‚â#‚âÏ‚âg‚âŸ‚âg‚æ‚â‚â¨ˆô¤ì(€¡…ÉÑÌ¹‘É…Ü ˆ­½µÁ…¹äˆ°€‰¡‰…ÉÌˆ°ì±…‰•°è€‹‚æ‚â‚â«‚âW‚âË‚â‡‚âk‚â‚âÓ‚â§‚âÇ‚â\ˆ°¥Ñ•µÌè‰å½µÁ…¹ä°½±½Èè¡…ÉÑÌ¹A1QQ¹ÌÄ°µ•ÑÉ¥Œè€‹‚â#‚âÏ‚âg‚âŸ‚âg‚æ‚â‚â¨ˆô¤ì((€€ ˆ­Á¥áÁ½ÉÐˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø•áÁ½ÉÑM¡••ÑÌ ‰-A$ˆ°mM!Q}	U%1IL¹­Á¤¹‰Õ¥± ¥t¤¤ì)ôì((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€Y%\èI•Á½ÉÑÌ(€€€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼)™Õ¹Ñ¥½¸É•¹‘•É1¥Ù•I•Á½ÉÑÌ¡É½½Ð¤ì(€¥˜€ …•¹ÍÕÉ•1¥Ù•=Ù•ÉÙ¥•Ü¡É½½Ð¤¤É•ÑÕÉ¸ì(€½¹ÍÐ¥¹M½Á”€ô€¡É½Ü¤€ôøÉ½Ü¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”€øôÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½´€˜˜É½Ü¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”€ðôÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹Ñ¼€˜˜€¡ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä€ôôô€‰10ˆñðÉ½Ü¹½µÁ…¹ä€ôôôÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä¤ì(€½¹ÍÐÅÕ…±¥Ñä€ô€¡±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹ÅÕ…±¥Ñäñðmt¤¹™¥±Ñ•È¡¥¹M½Á”¤ì(€½¹ÍÐ½Á•É…Ñ¥½¹Ì€ô€¡±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹½Á•É…Ñ¥½¹Ìñðmt¤¹™¥±Ñ•È¡¥¹M½Á”¤ì(€½¹ÍÐ•á•ÁÑ¥½¹Ì€ôÍ½Á•‘á•ÁÑ¥½¹Ì ¤ì(€½¹ÍÐ‘…µ…•Ì€ô¹‘…µ…•Ì¹™¥±Ñ•È ¡¤€ôø¥¹I…¹”¡¹‘…Ñ”¤€˜˜€¡ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä€ôôô€‰10ˆñð¹½µÁ…¹ä€ôôôÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä¤¤ì(€½¹ÍÐµ…Ñ¡•€ôÅÕ…±¥Ñä¹É•‘Õ” ¡ÍÕ´±É½Ü¤ôùÍÕ´­9Õµ‰•È¡É½Ü¹µ…Ñ¡•‘ñðÀ¤°À¤ì(€½¹ÍÐÍÑ´€ôÅÕ…±¥Ñä¹É•‘Õ” ¡ÍÕ´±É½Ü¤ôùÍÕ´­9Õµ‰•È¡É½Ü¹ÍÑµ}½Õ¹ÑñðÀ¤°À¤ì(€½¹ÍÐÑ½Ñ…±…µ…”€ô‘…µ…•Ì¹É•‘Õ” ¡ÍÕ´±É½Ü¤ôùÍÕ´­9Õµ‰•È¡É½Ü¹…µ½Õ¹ÑñðÀ¤°À¤ì(€½¹ÍÐÅÕ…±¥ÑåÙ…¥±…‰±”€ôÉÉ…ä¹¥ÍÉÉ…ä¡±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹ÅÕ…±¥Ñä¤€˜˜€…¡…Í1¥Ù•½É•ÉÉ½È ‹‚âs‚â—‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âPˆ¤ì(€½¹ÍÐ½Á•É…Ñ¥½¹ÍÙ…¥±…‰±”€ôÉÉ…ä¹¥ÍÉÉ…ä¡±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹½Á•É…Ñ¥½¹Ì¤€˜˜€…¡…Í1¥Ù•½É•ÉÉ½È ‹‚â‚âÓ‚âŸ‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âPˆ¤ì(€½¹ÍÐ•á•ÁÑ¥½¹ÍÙ…¥±…‰±”€ô±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹•á•ÁÑ¥½¹ÍI•…‘äì(€½¹ÍÐ‘…µ…•ÍÙ…¥±…‰±”€ô±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹‘…µ…•ÍI•…‘äì(€½¹ÍÐÉ•Á½ÉÑ5•ÑÉ¥Œ€ô€¡…Ù…¥±…‰±”°Ù…±Õ”°™½Éµ…ÑÑ•È€ô¹Õ´¤€ôø…Ù…¥±…‰±”€ü™½Éµ…ÑÑ•È¡Ù…±Õ”¤€è€‹ŠPˆì(€½¹ÍÐ…±±½µÁ…¹å=Ù•ÉÙ¥•Ü€ôÕ‘¥Ñ½µÁ…¹å=Ù•ÉÙ¥•Ü¹‰Õ¥±¡íÉ½ÕÁÌéU%Q}=5A9e}I=UAL±½µÁ…¹¥•Ìé½µÁ…¹å5…ÍÑ•È ¤¹™¥±Ñ•È¡½µÁ…¹äôù…¹•ÍÍ½µÁ…¹ä¡½µÁ…¹ä¹½‘”¤˜˜¡ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹äôôô10ññ½µÁ…¹ä¹½‘”ôôõÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä¤¤±ÅÕ…±¥Ñä±…Ù…¥±…‰±”éÅÕ…±¥ÑåÙ…¥±…‰±•ô¤ì(€½¹ÍÐ‘…Ñ•5…À€ô¹•Ü5…À ¤ì(€½Á•É…Ñ¥½¹Ì¹™½É…  ¡É½Ü¤ôùì(€€€½¹ÍÐ¥Ñ•´õ‘…Ñ•5…À¹•Ð¡É½Ü¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”¥ññí‘…Ñ”éÉ½Ü¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”±µ…¥±ÌèÀ±™¥±•ÌèÀ±½µÁ±•Ñ•èÀ±É•Ù¥•ÜèÀ±Ý…¥Ñ¥¹œèÀ±•ÉÉ½ÈèÁôì(€€€¥Ñ•´¹µ…¥±Ì¬õ9Õµ‰•È¡É½Ü¹µ…¥±}½Õ¹ÑñðÀ¤ì¥Ñ•´¹™¥±•Ì¬õ9Õµ‰•È¡É½Ü¹™¥±•}½Õ¹ÑñðÀ¤ì(€€€¥˜¡É½Ü¹ÍÑ…ÑÕÌôôô‰½µÁ±•Ñ•ˆ¤¥Ñ•´¹½µÁ±•Ñ•¬¬ì•±Í”¥˜¡É½Ü¹ÍÑ…ÑÕÌôôô‰Ý…¥Ñ¥¹}™¥±•Ìˆ¤¥Ñ•´¹Ý…¥Ñ¥¹œ¬¬ì•±Í”¥˜¡É½Ü¹ÍÑ…ÑÕÌôôô‰•ÉÉ½Èˆ¤¥Ñ•´¹•ÉÉ½È¬¬ì•±Í”¥Ñ•´¹É•Ù¥•Ü¬¬ì(€€€‘…Ñ•5…À¹Í•Ð¡É½Ü¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”±¥Ñ•´¤ì(€ô¤ì(€½¹ÍÐ‘…¥±äõl¸¸¹‘…Ñ•5…À¹Ù…±Õ•Ì ¥t¹Í½ÉÐ ¡„±ˆ¤ôùˆ¹‘…Ñ”¹±½…±•½µÁ…É”¡„¹‘…Ñ”¤¤ì(€½¹ÍÐµ½¹Ñ¡5…Àõ¹•Ü5…À ¤ì(€‘…µ…•Ì¹™½É…  ¡É½Ü¤ôùí½¹ÍÐå´õMÑÉ¥¹œ¡É½Ü¹‘…Ñ•ñðˆˆ¤¹Í±¥” À°Ü¤íµ½¹Ñ¡5…À¹Í•Ð¡å´°¡µ½¹Ñ¡5…À¹•Ð¡å´¥ñðÀ¤­9Õµ‰•È¡É½Ü¹…µ½Õ¹ÑñðÀ¤¤íô¤ì(€½¹ÍÐµ½¹Ñ¡±äõl¸¸¹µ½¹Ñ¡5…À¹•¹ÑÉ¥•Ì ¥t¹Í½ÉÐ ¤¹µ…À ¡m±…‰•°±Ù…±Õ•t¤ôø¡í±…‰•°±Ù…±Õ•ô¤¤ì(€É½½Ð¹¥¹¹•É!Q50õ€(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰ÍÑ…ÑÕÌµÍÑÉ¥À™½ÕÈ…Ñ¥½¸µÑ¥±•Ìˆø(€€€€€€ñ…ÉÑ¥±”‘…Ñ„µ…Ñ¥½¸µÉ½ÕÑ”ô‰±½ÕˆøñÍÁ…¸û‚â‚âË‚â‹‚â‚âË‚âŒMQ4ƒ‚â#‚â‚âÓ‚âð½ÍÁ…¸øñÍÑÉ½¹œø‘íÉ•Á½ÉÑ5•ÑÉ¥Œ¡ÅÕ…±¥ÑåÙ…¥±…‰±”°ÍÑ´¥ôð½ÍÑÉ½¹œøñÍµ…±°ø‘íÅÕ…±¥ÑåÙ…¥±…‰±”€ü€‘íÅÕ…±¥Ñä¹±•¹Ñ¡ôƒ‚â‚âË‚âe€€è€‹‚â‚âÏ‚â—‚âÇ‚â‚â‚â·‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚â‚âÓ‚â‰ôƒ
Üƒ‚â‚âS‚âS‚âç‚æ‚â‚â—‚æ3‚âW‚æ'‚âg‚â_‚âË‚âð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”±…ÍÌô‰½¬ˆ‘…Ñ„µ…Ñ¥½¸µÉ½ÕÑ”ô‰‘…¥±äµÍÕµµ…ÉäˆøñÍÁ…¸û‚â#‚âÇ‚âk‚â‚âç‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ð½ÍÁ…¸øñÍÑÉ½¹œø‘íÉ•Á½ÉÑ5•ÑÉ¥Œ¡ÅÕ…±¥ÑåÙ…¥±…‰±”°µ…Ñ¡•¥ôð½ÍÑÉ½¹œøñÍµ…±°ø‘íÅÕ…±¥ÑåÙ…¥±…‰±”€ü€‘íÍÑ´ü ¡µ…Ñ¡•½ÍÑ´¤¨ÄÀÀ¤¹Ñ½¥á• È¤èˆÀ¸ÀÀ‰ô•€€è€‹‚â‚âÏ‚â—‚âÇ‚â‚â‚â·‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚â‚âÓ‚â‰ôƒ
Üƒ‚â‚âS‚âS‚âç‚âs‚â—‚â‚âË‚â‹‚âŸ‚âÇ‚âdð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”±…ÍÌô‰‰…ˆ‘…Ñ„µ…Ñ¥½¸µÉ½ÕÑ”ô‰•á•ÁÑ¥½¹ÌˆøñÍÁ…¸ùá•ÁÑ¥½¸ð½ÍÁ…¸øñÍÑÉ½¹œø‘íÉ•Á½ÉÑ5•ÑÉ¥Œ¡•á•ÁÑ¥½¹ÍÙ…¥±…‰±”°•á•ÁÑ¥½¹Ì¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°ø‘í•á•ÁÑ¥½¹ÍÙ…¥±…‰±”€üƒ‚æ‚â‚âÓ‚âdM1€‘í¹Õ´¡•á•ÁÑ¥½¹Ì¹™¥±Ñ•È ¡”¤ôù”¹½Ù•ÉM±„¤¹±•¹Ñ ¥õ€€è€‹‚â‚âÏ‚â—‚âÇ‚â‚â‚â·‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚â‚âÓ‚â‰ôƒ
Üƒ‚â‚âS‚âW‚â‚âŸ‚â#‚æ‚â‚â¨ð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”±…ÍÌô‰‰…ˆ‘…Ñ„µ…Ñ¥½¸µÉ½ÕÑ”ô‰‘…µ…”ˆøñÍÁ…¸û‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â_‚â×‚æ#‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â#‚â‚âÓ‚âð½ÍÁ…¸øñÍÑÉ½¹œø‘íÉ•Á½ÉÑ5•ÑÉ¥Œ¡‘…µ…•ÍÙ…¥±…‰±”°Ñ½Ñ…±…µ…”°µ½¹•äÀ¥ôð½ÍÑÉ½¹œøñÍµ…±°ø‘í‘…µ…•ÍÙ…¥±…‰±”€üƒ‚âk‚âË‚â\ƒ
Ü€‘í¹Õ´¡‘…µ…•Ì¹±•¹Ñ ¥ôƒ‚â‚âË‚â‹‚â‚âË‚â€€è€‹‚â‚âÏ‚â—‚âÇ‚â‚â‚â·‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚â‚âÓ‚â‰ôƒ
Üƒ‚â‚âS‚âS‚âç‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âdð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€ð½Í•Ñ¥½¸ø(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°•áÁ½ÉÐµ‰…È¹¼µ…ÁÑÕÉ”ˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆû‚â‚âË‚â‹‚â‚âË‚âg‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚â‚âÓ‚âð½Àøñ Èû‚â+‚æ#‚âŸ‚â€‘í ¡É…¹•1…‰•° ¤¥ôð½ ÈøñÍÁ…¸±…ÍÌô‰µÕÑ•ˆû‚â«‚â‚âã‚âo‚â#‚âË‚âMÕÁ…‰…Í”ƒ‚âW‚âË‚â‡‚âk‚â‚âÓ‚â§‚âÇ‚â_‚æ‚â—‚âÃ‚âŸ‚âÇ‚âg‚â_‚â×‚æ#‚â_‚â×‚æ#‚æ‚â—‚âß‚â·‚âð½ÍÁ…¸øð½‘¥Øøñ‘¥Ø±…ÍÌô‰¥¹±¥¹”µ…Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰±¥Ù•I•Áá•ÁÑ¥½¸ˆùáÁ½ÉÐá•ÁÑ¥½¸ð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ¥ô‰±¥Ù•I•Á…µ…”ˆùáÁ½ÉÐƒ‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆð½‰ÕÑÑ½¸øð½‘¥Øøð½Í•Ñ¥½¸ø(€€€€‘íÕ‘¥Ñ½µÁ…¹å=Ù•ÉÙ¥•Ü¹µ…É­ÕÀ¡…±±½µÁ…¹å=Ù•ÉÙ¥•Ü±í ±¹Õµô¥ô(€€€€‘íµ½¹Ñ¡±ä¹±•¹Ñ ý€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆøñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆù…µ…”QÉ•¹ð½Àøñ Èû‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â‚âË‚â‹‚æ‚âS‚âß‚â·‚âg‚â#‚âË‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚â‚âÓ‚âð½ Èøð½‘¥Øøð½‘¥Øøñ‘¥Ø±…ÍÌô‰¡…ÉÐˆ¥ô‰±¥Ù•I•Á½ÉÑ…µ…”ˆøð½‘¥Øøð½Í•Ñ¥½¸ù€èˆ‰ô(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆøñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆû‚â‚âË‚â‹‚âŸ‚âÇ‚âdð½Àøñ Èû‚â«‚â[‚âË‚âg‚âÃ‚æ‚â‚â—‚æ3‚æ‚â—‚âÃ‚â‚âË‚âg‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âPð½ Èøð½‘¥ØøñÍÁ…¸±…ÍÌô‰¡•…±Ñ ½¬ˆû‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚â‚âÓ‚âð½ÍÁ…¸øð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…ÀˆøñÑ…‰±”øñÑ¡•…øñÑÈøñÑ û‚âŸ‚âÇ‚âg‚â_‚â×‚æ ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚æ‚â‡‚â”ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚æ‚â‚â—‚æ0ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚â«‚âÏ‚æ‚â‚æ‚â ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚âW‚æ'‚â·‚â‚âW‚â‚âŸ‚â ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚â‚â·‚æ‚â‚â—‚æ0ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚â—‚æ'‚â‡‚æ‚â¯‚â—‚âœð½Ñ øð½ÑÈøð½Ñ¡•…ø(€€€€€€ñÑ‰½‘äø‘í‘…¥±ä¹µ…À ¡É½Ü¤ôù€ñÑÈ±…ÍÌô‰…Ñ¥½¸µÉ½Üˆ‘…Ñ„µÉ•Á½ÉÐµ‘…Ñ”ôˆ‘í ¡É½Ü¹‘…Ñ”¥ôˆÉ½±”ô‰±¥¹¬ˆÑ…‰¥¹‘•àôˆÀˆøñÑøñˆø‘í ¡É½Ü¹‘…Ñ”¥ôð½ˆøñÍµ…±°±…ÍÌô‰ÍÕˆˆû‚â‚âS‚âS‚âç‚â«‚â‚âã‚âo‚â‚âË‚â‹‚âŸ‚âÇ‚âdð½Íµ…±°øð½ÑøñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í¹Õ´¡É½Ü¹µ…¥±Ì¥ôð½ÑøñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í¹Õ´¡É½Ü¹™¥±•Ì¥ôð½ÑøñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í¹Õ´¡É½Ü¹½µÁ±•Ñ•¥ôð½ÑøñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í¹Õ´¡É½Ü¹É•Ù¥•Ü¥ôð½ÑøñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í¹Õ´¡É½Ü¹Ý…¥Ñ¥¹œ¥ôð½ÑøñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í¹Õ´¡É½Ü¹•ÉÉ½È¥ôð½Ñøð½ÑÈù€¤¹©½¥¸ ˆˆ¥ññ€ñÑÈøñÑ½±ÍÁ…¸ôˆÜˆ±…ÍÌô‰•µÁÑäˆø‘í½Á•É…Ñ¥½¹ÍÙ…¥±…‰±”€ü€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚â‚æ'‚â·‚â‡‚âç‚â—‚æ‚âg‚â+‚æ#‚âŸ‚â‚âg‚â×‚æ$ˆ€è€‹‚â‚æ'‚â·‚â‡‚âç‚â—‚â‚âÓ‚âŸ‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚â‹‚âÇ‚â‚æ‚â¯‚â—‚âS‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ƒŠPƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â«‚â‚âã‚âo‚æ‚âo‚æ‚âg‚â£‚âç‚âg‚â‹‚æ0‰ôð½Ñøð½ÑÈùôð½Ñ‰½‘äøð½Ñ…‰±”øð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ù€ì(€¥˜¡µ½¹Ñ¡±ä¹±•¹Ñ ¤¡…ÉÑÌ¹‘É…Ü ˆ±¥Ù•I•Á½ÉÑ…µ…”ˆ°‰‰…ÉÌˆ±í±…‰•°è‹‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â‚âË‚â‹‚æ‚âS‚âß‚â·‚âdˆ±¥Ñ•µÌéµ½¹Ñ¡±ä±½±½ÈèˆÀÍˆÍˆˆ±µ½¹•äéÑÉÕ”±µ•ÑÉ¥Œè‹‚âk‚âË‚â\ˆ±¡•¥¡ÐèÈÐÁô¤ì(€€ ˆ±¥Ù•I•Áá•ÁÑ¥½¸ˆ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ° ¤ôù•áÁ½ÉÑM¡••ÑÌ ‰á•ÁÑ¥½¹‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚â‚âÓ‚âˆ±mí¹…µ”è‰á•ÁÑ¥½¸ˆ±Ñ¥Ñ±”éá•ÁÑ¥½¸€‘íÉ…¹•1…‰•° ¥õ€±¡•…‘•ÉÌél‹‚âŸ‚âÇ‚âg‚â_‚â×‚æ ˆ°‹‚æ‚âŸ‚â—‚âÈˆ°‹‚âk‚â‚âÓ‚â§‚âÇ‚â\ˆ°‹‚âo‚â‚âÃ‚æ‚âƒ‚â\ˆ°‹‚â‚âÃ‚âS‚âÇ‚âhˆ°‹‚â«‚â[‚âË‚âg‚âÀˆ°‹‚â‹‚â·‚âS‚æ‚â«‚â×‚æ#‚â‹‚âˆ°‹‚â«‚âË‚æ‚â¯‚âW‚âà‰t±É½ÝÌé•á•ÁÑ¥½¹Ì¹µ…À ¡”¤ôùm”¹‘…Ñ”±”¹Ñ¥µ”±”¹½µÁ…¹ä±”¹ÑåÁ•9…µ”±”¹Í•Ù•É¥Ñä±”¹ÍÑ…ÑÕÌ±”¹É¥Í­µ½Õ¹Ð±”¹…ÕÍ•t¥õt¤¤ì(€€ ˆ±¥Ù•I•Á…µ…”ˆ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ° ¤ôù•áÁ½ÉÑM¡••ÑÌ ‹‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‰‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚â‚âÓ‚âˆ±mí¹…µ”è‹‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆˆ±Ñ¥Ñ±”éƒ‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆ€‘íÉ…¹•1…‰•° ¥õ€±¡•…‘•ÉÌél‹‚âŸ‚âÇ‚âg‚â_‚â×‚æ ˆ°‹‚â‚â¯‚âÇ‚â¨ˆ°‹‚âk‚â‚âÓ‚â§‚âÇ‚â\ˆ°‹‚âs‚âç‚æ'‚æ‚â‚â×‚æ#‚â‹‚âŸ‚â‚æ'‚â·‚âˆ°‹‚â‹‚â·‚âPˆ°‹‚â«‚âË‚æ‚â¯‚âW‚âàˆ°‹‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdˆ°‹‚â«‚â[‚âË‚âg‚âÃ‚â‚âË‚â‚æ‚â‚âÓ‚âd‰t±É½ÝÌé‘…µ…•Ì¹µ…À ¡¤ôùm¹‘…Ñ”±¹¥±¹½µÁ…¹ä±¹•µÁ±½å•”±¹…µ½Õ¹Ð±¹…ÕÍ”±¹•Ù¥‘•¹”ü‹‚â‡‚âÔˆè‹‚â‚â´ˆ±¹™¥¹…¹•MÑ…ÑÕÍt¥õt¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µ…Ñ¥½¸µÉ½ÕÑ•tˆ¤¹™½É…  ¡¥Ñ•´¤ôù¥Ñ•´¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ° ¤ôù¼¡¥Ñ•´¹‘…Ñ…Í•Ð¹…Ñ¥½¹I½ÕÑ”¤¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µÉ•Á½ÉÐµ‘…Ñ•tˆ¤¹™½É…  ¡É½Ü¤ôùì(€€€½¹ÍÐ½Á•¸ô ¤ôùíÍÑ…Ñ”¹‘…¥±åMÕµµ…Éä¹‘…Ñ”õÉ½Ü¹‘…Ñ…Í•Ð¹É•Á½ÉÑ…Ñ”í¼ ‰‘…¥±äµÍÕµµ…Éäˆ¤íôì(€€€É½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±½Á•¸¤ì(€€€É½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰­•å‘½Ý¸ˆ°¡•Ù•¹Ð¤ôùí¥˜¡•Ù•¹Ð¹­•äôôô‰¹Ñ•È‰ññ•Ù•¹Ð¹­•äôôôˆ€ˆ¥í•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤í½Á•¸ ¤íõô¤ì(€ô¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µÉ•½¸µ½µÁ…¹åtˆ¤¹™½É…  ¡¥Ñ•´¤€ôøì(€€€½¹ÍÐ½Á•¸€ô€ ¤€ôøì(€€€€€¥˜€ …¥Ñ•´¹‘…Ñ…Í•Ð¹É•½¹…Ñ”¤É•ÑÕÉ¸ì(€€€€€ÍÑ…Ñ”¹‘…¥±åMÕµµ…Éä¹½µÁ…¹ä€ô¥Ñ•´¹‘…Ñ…Í•Ð¹É•½¹½µÁ…¹äì(€€€€€ÍÑ…Ñ”¹‘…¥±åMÕµµ…Éä¹‘…Ñ”€ô¥Ñ•´¹‘…Ñ…Í•Ð¹É•½¹…Ñ”ì(€€€€€¼ ‰‘…¥±äµÍÕµµ…Éäˆ¤ì(€€€ôì(€€€¥Ñ•´¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°½Á•¸¤ì(€€€¥Ñ•´¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰­•å‘½Ý¸ˆ°€¡•Ù•¹Ð¤€ôøì(€€€€€¥˜€¡•Ù•¹Ð¹­•ä€ôôô€‰¹Ñ•Èˆñð•Ù•¹Ð¹­•ä€ôôô€ˆ€ˆ¤ì•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì½Á•¸ ¤ìô(€€€ô¤ì(€ô¤ì)ô()Y%]L¹É•Á½ÉÑÌ€ô€¡É½½Ð¤€ôøì(€¥˜€¡ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€‰ÁÉ½‘ÕÑ¥½¸ˆ€˜˜Mˆ¹Í¥¹•‘%¸ ¤¤ì(€€€É•¹‘•É1¥Ù•I•Á½ÉÑÌ¡É½½Ð¤ì(€€€É•ÑÕÉ¸ì(€ô(€½¹ÍÐ…±°€ô¹µ½¹Ñ¡±åQÉ•¹ì(€½¹ÍÐ¥¹5½¹Ñ¡Ì€ô…±°¹™¥±Ñ•È ¡´¤€ôø´¹å´€øôÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½´¹Í±¥” À°€Ü¤€˜˜´¹å´€ðôÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹Ñ¼¹Í±¥” À°€Ü¤¤ì(€½¹ÍÐÐ€ô¥¹5½¹Ñ¡Ì¹±•¹Ñ €øô€È€ü¥¹5½¹Ñ¡Ì€è…±°ì(€½¹ÍÐ±…ÍÐ€ôÑmÐ¹±•¹Ñ €´€Åtì(€½¹ÍÐÁÉ•Ø€ôÑmÐ¹±•¹Ñ €´€Étñð±…ÍÐì(€½¹ÍÐ‘•±Ñ„€ôÁÉ•Ø€ôôô±…ÍÐ€ü€ˆÀ¸Àˆ€è€  ¡±…ÍÐ¹‘…µ…”€´ÁÉ•Ø¹‘…µ…”¤€¼ÁÉ•Ø¹‘…µ…”¤€¨€ÄÀÀ¤¹Ñ½¥á• Ä¤ì((€É½½Ð¹¥¹¹•É!Q50€ô€(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°•áÁ½ÉÐµ‰…È¹¼µ…ÁÑÕÉ”ˆø(€€€€€€ñ‘¥Øø(€€€€€€€€ñÀ±…ÍÌô‰•å•‰É½ÜˆùáÁ½ÉÐð½Àø(€€€€€€€€ñ Èû‚â·‚â·‚â‚â‚âË‚â‹‚â‚âË‚âg‚â+‚æ#‚âŸ‚â€‘í ¡É…¹•1…‰•° ¤¥ôð½ Èø(€€€€€€€€ñÍÁ…¸±…ÍÌô‰µÕÑ•ˆû‚æ‚â—‚âß‚â·‚â‚â+‚æ#‚âŸ‚â‚âŸ‚âÇ‚âg‚â_‚â×‚æ#‚æ‚âS‚æ'‚â#‚âË‚â‚æ‚â[‚âk‚âW‚âÇ‚âŸ‚â‚â‚â·‚â‚âS‚æ'‚âË‚âg‚âk‚âdƒ
Üƒ‚æ‚â‚â—‚æ0á•°ƒ‚â#‚âÃ‚â‡‚â×‚â¯‚â—‚âË‚â‹‚â+‚â×‚âW‚æ‚âg‚æ‚â‚â—‚æ3‚æ‚âS‚â×‚â‹‚âœƒ
Üƒ‚â_‚âã‚â‚â‚âË‚â‚æ3‚âS‚æ‚âg‚â¯‚âg‚æ'‚âË‚âg‚â×‚æ'‚â‡‚â×‚âo‚âã‚æ#‚â‡‚â‚â—‚æ'‚â·‚â‚â«‚âÏ‚â¯‚â‚âÇ‚âk‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â'‚â{‚âË‚âÃ‚â«‚æ#‚âŸ‚âg‚âg‚âÇ‚æ'‚âg‚æ‚âo‚æ‚âg‚âƒ‚âË‚âxð½ÍÁ…¸ø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹±¥¹”µ…Ñ¥½¹Ìˆø(€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰É•Á%µ…”ˆû‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â_‚âÇ‚æ'‚â‚â¯‚âg‚æ'‚âË‚æ‚âo‚æ‚âg‚âƒ‚âË‚âxð½‰ÕÑÑ½¸ø(€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ¥ô‰É•Á±°ˆû‚æ‚â—‚âß‚â·‚â‚â+‚âã‚âS‚â‚æ'‚â·‚â‡‚âç‚â”€˜áÁ½ÉÐá•°ð½‰ÕÑÑ½¸ø(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰ÍÑ…ÑÕÌµÍÑÉ¥À™½ÕÈˆø(€€€€€€ñ…ÉÑ¥±”øñÍÁ…¸û‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚âS‚âß‚â·‚âg‚âg‚â×‚æ$ð½ÍÁ…¸øñÍÑÉ½¹œø‘íµ½¹•äÀ¡±…ÍÐ¹‘…µ…”¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚âk‚âË‚â\ƒ
Ü€‘í±…ÍÐ¹…Í•Íôƒ‚æ‚â‚â¨ð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”±…ÍÌôˆ‘í‘•±Ñ„€ð€À€ü€‰½¬ˆ€è€‰‰…‰ôˆøñÍÁ…¸û‚æ‚â_‚â×‚â‹‚âk‚æ‚âS‚âß‚â·‚âg‚â‚æ#‚â·‚âdð½ÍÁ…¸øñÍÑÉ½¹œø‘í‘•±Ñ„€ø€À€ü€ˆ¬ˆ€è€ˆ‰ô‘í‘•±Ñ…ô”ð½ÍÑÉ½¹œøñÍµ…±°ø‘í‘•±Ñ„€ð€À€ü€‹‚â—‚âS‚â—‚âˆ€è€‹‚æ‚â{‚âÓ‚æ#‚â‡‚â‚âÛ‚æ'‚âd‰÷‚â#‚âË‚â€‘íµ½¹•äÀ¡ÁÉ•Ø¹‘…µ…”¥ôƒ‚âk‚âË‚â\ð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”±…ÍÌô‰½¬ˆøñÍÁ…¸û‚â‡‚âç‚â—‚â‚æ#‚âË‚â_‚â×‚æ#‚âo‚æ'‚â·‚â‚â‚âÇ‚âg‚æ‚âS‚æ$ð½ÍÁ…¸øñÍÑÉ½¹œø‘íµ½¹•äÀ¡±…ÍÐ¹ÁÉ•Ù•¹Ñ•¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚â#‚âË‚â‚â‚âË‚â‚âW‚â‚âŸ‚â#‚â{‚âk‚æ‚â‚æ‚âœð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”øñÍÁ…¸û‚æ‚â‚â«‚â_‚â×‚æ#‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚âo‚âÓ‚âPð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡¹•á•ÁÑ¥½¹Ì¹™¥±Ñ•È ¡”¤€ôø€…l‰±½Í•ˆ°€‰…ÁÁÉ½Ù•‰t¹¥¹±Õ‘•Ì¡”¹ÍÑ…ÑÕÌ¤¤¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚âW‚æ'‚â·‚â‚â‚âÃ‚âk‚âã‚æ‚â¯‚âW‚âã‚âs‚â—‚æ‚âg‚â‚âË‚â‹‚â‚âË‚âdð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€ð½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùQÉ•¹€ÄÈƒ‚æ‚âS‚âß‚â·‚âdð½Àøñ Èû‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚â_‚â×‚â‹‚âk‚â‡‚âç‚â—‚â‚æ#‚âË‚â_‚â×‚æ#‚âo‚æ'‚â·‚â‚â‚âÇ‚âg‚æ‚âS‚æ$ð½ Èøð½‘¥ØøñÍÁ…¸±…ÍÌô‰¡•…±Ñ ½¬ˆø‘íÐ¹±•¹Ñ¡ôƒ‚æ‚âS‚âß‚â·‚âdƒ
Ü€‘í ¡É…¹•1…‰•° ¤¥ôð½ÍÁ…¸øð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰¡…ÉÐˆ¥ô‰ÉQÉ•¹ˆøð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Œµ±••¹ÍÑ…Ñ¥ŒˆøñÍÁ…¸±…ÍÌô‰Œµ±•œˆøñ¤ÍÑå±”ô‰‰…­É½Õ¹è‘í¡…ÉÑÌ¹A1QQ¹ÌÉôˆøð½¤û‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â#‚â‚âÓ‚âð½ÍÁ…¸øñÍÁ…¸±…ÍÌô‰Œµ±•œˆøñ¤ÍÑå±”ô‰‰…­É½Õ¹è‘í¡…ÉÑÌ¹A1QQ¹ÌÍôˆøð½¤û‚â‡‚âç‚â—‚â‚æ#‚âË‚â_‚â×‚æ#‚âo‚æ'‚â·‚â‚â‚âÇ‚âg‚æ‚âS‚æ$ð½ÍÁ…¸øð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰É¥´Èˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆù…¥±äI•Á½ÉÐð½Àøñ Èû‚â‚âË‚â‹‚â‚âË‚âg‚â+‚æ#‚âŸ‚â€‘í ¡É…¹•1…‰•° ¤¥ôð½ Èøð½‘¥Øøð½‘¥Øø(€€€€€€€€ñÕ°±…ÍÌô‰É•Á½ÉÐµ±¥ÍÐˆø(€€€€€€€€€€ñ±¤øñÍÁ…¸û‚â‚âË‚â‹‚â‚âË‚â‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âPð½ÍÁ…¸øñˆø‘í¹Õ´¡¹¡½ÕÉ±ä¹É•‘Õ” ¡„°Œ¤€ôø„€¬Œ¹Ñ½Ñ…°°€À¤¥ôð½ˆøð½±¤ø(€€€€€€€€€€ñ±¤øñÍÁ…¸û‚â#‚âÇ‚âk‚â‚âç‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ð½ÍÁ…¸øñˆø‘í¹Õ´¡¹¡½ÕÉ±ä¹É•‘Õ” ¡„°Œ¤€ôø„€¬Œ¹µ…Ñ¡•°€À¤¥ôð½ˆøð½±¤ø(€€€€€€€€€€ñ±¤øñÍÁ…¸ùá•ÁÑ¥½¸ð½ÍÁ…¸øñˆø‘í¹Õ´¡¹¡½ÕÉ±ä¹É•‘Õ” ¡„°Œ¤€ôø„€¬Œ¹•á•ÁÑ¥½¸°€À¤¥ôð½ˆøð½±¤ø(€€€€€€€€€€ñ±¤øñÍÁ…¸û‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚â‡‚â×‚âo‚âÇ‚â7‚â¯‚âÈð½ÍÁ…¸øñˆø‘í¹™¥±•Ì¹™¥±Ñ•È ¡˜¤€ôø˜¹ÍÑ…ÑÕÌ€„ôô€‰É••¥Ù•ˆ¤¹±•¹Ñ¡ôð½ˆøð½±¤ø(€€€€€€€€€€ñ±¤øñÍÁ…¸û‚æ‚â‚â«‚æ‚â‚âÓ‚âdM1ð½ÍÁ…¸øñˆø‘í¹•á•ÁÑ¥½¹Ì¹™¥±Ñ•È ¡”¤€ôø”¹½Ù•ÉM±„¤¹±•¹Ñ¡ôð½ˆøð½±¤ø(€€€€€€€€€€ñ±¤øñÍÁ…¸û‚â‹‚â·‚âS‚â_‚â×‚æ#‚â·‚âË‚â#‚æ‚âo‚æ‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆð½ÍÁ…¸øñˆø‘íµ½¹•äÀ¡¹‘…µ…•Ì¹É•‘Õ” ¡„°Œ¤€ôø„€¬Œ¹…µ½Õ¹Ð°€À¤¥ôƒ‚âk‚âË‚â\ð½ˆøð½±¤ø(€€€€€€€€ð½Õ°ø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹±¥¹”µ…Ñ¥½¹Ìˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰É•Á…¥±äˆùá•°ƒ‚â‚âË‚â‹‚â‚âË‚âg‚â‚âË‚â‹‚âŸ‚âÇ‚âdð½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰É•Áàˆùá•°á•ÁÑ¥½¸ð½‰ÕÑÑ½¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆù5½¹Ñ¡±äA…­…”ð½Àøñ Èû‚â+‚âã‚âS‚â‚âË‚â‹‚â‚âË‚âg‚â«‚æ#‚â‚âs‚âç‚æ'‚âk‚â‚âÓ‚â¯‚âË‚âŒð½ Èøð½‘¥Øøð½‘¥Øø(€€€€€€€€ñÕ°±…ÍÌô‰Ñ¥¬µ±¥ÍÐˆø(€€€€€€€€€€ñ±¤û‚â‡‚âç‚â—‚â‚æ#‚âË‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â#‚â‚âÓ‚â‚æ‚â—‚âÃ‚â_‚â×‚æ#‚âo‚æ'‚â·‚â‚â‚âÇ‚âg‚æ‚âS‚æ$ð½±¤ø(€€€€€€€€€€ñ±¤ùQ½À…ÕÍ”ƒ‚æ‚â—‚âÀQ½À•µÁ±½å•”€¼Í¡¥™ÐÉ¥Í¬ð½±¤ø(€€€€€€€€€€ñ±¤ùQÉ•¹ƒ‚æ‚â_‚â×‚â‹‚âk‚æ‚âS‚âß‚â·‚âg‚â‚æ#‚â·‚âg‚æ‚â—‚âÃ‚æ‚âW‚â‚â‡‚âË‚â«‚â‚æ#‚â·‚âdð½±¤ø(€€€€€€€€€€ñ±¤û‚æ‚â‚â«‚â_‚â×‚æ#‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚âo‚âÓ‚âS‚â{‚â‚æ'‚â·‚â‡‚æ‚â¯‚âW‚âã‚âs‚â”ð½±¤ø(€€€€€€€€€€ñ±¤û‚â‚æ'‚â·‚æ‚â«‚âg‚â·‚âo‚â‚âÇ‚âhÁÉ½•ÍÌƒ‚æ‚â{‚âß‚æ#‚â·‚â—‚âS‚â‚âŸ‚âË‚â‡‚âs‚âÓ‚âS‚â/‚æ'‚âÌð½±¤ø(€€€€€€€€ð½Õ°ø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹±¥¹”µ…Ñ¥½¹Ìˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰É•Á5½¹Ñ¡±äˆùá•°ƒ‚â«‚â‚âã‚âo‚â‚âË‚â‹‚æ‚âS‚âß‚â·‚âdð½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ¥ô‰É•ÁM•¹ˆû‚â«‚æ#‚â‚æ‚â¯‚æ'‚â‚âË‚â‚æ‚â‚âÓ‚âd€¼ƒ‚âk‚âã‚â‚â‚â”ð½‰ÕÑÑ½¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñÀ±…ÍÌô‰¡¥¹Ðˆû‚â‚âË‚â‹‚â‚âË‚âg‚â«‚âÏ‚â¯‚â‚âÇ‚âh¥¹…¹”€¼!Hƒ‚â#‚âÃ‚âS‚âÛ‚â‚æ‚â'‚â{‚âË‚âÀ‘…µ…”É•½Éƒ‚â_‚â×‚æ#‚âo‚âÓ‚âS‚â‚â·‚âk‚æ‚â—‚æ'‚âŸ‚æ‚â_‚æ#‚âË‚âg‚âÇ‚æ'‚âdð½Àø(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ù€ì((€¡…ÉÑÌ¹‘É…Ü ˆÉQÉ•¹ˆ°€‰±¥¹”ˆ°ì(€€€±…‰•°è€‹‚æ‚âg‚âŸ‚æ‚âg‚æ'‚â‡‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â‚âË‚â‹‚æ‚âS‚âß‚â·‚âdˆ°(€€€á1…‰•±ÌèÐ¹µ…À ¡à¤€ôøà¹µ½¹Ñ ¤°(€€€Í¡½ÉÐèÑÉÕ”°(€€€Í•É¥•Ìèl(€€€€€ì¹…µ”è€‹‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â#‚â‚âÓ‚âˆ°½±½Èè¡…ÉÑÌ¹A1QQ¹ÌÈ°Ù…±Õ•ÌèÐ¹µ…À ¡à¤€ôøà¹‘…µ…”¤°…É•„èÑÉÕ”ô°(€€€€€ì¹…µ”è€‹‚âo‚æ'‚â·‚â‚â‚âÇ‚âg‚æ‚âS‚æ$ˆ°½±½Èè¡…ÉÑÌ¹A1QQ¹ÌÌ°Ù…±Õ•ÌèÐ¹µ…À ¡à¤€ôøà¹ÁÉ•Ù•¹Ñ•¤ô°(€€€t°(€€€¡•¥¡Ðè€ÈØÀ°(€ô¤ì((€€ ˆÉ•Á…¥±äˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø(€€€•áÁ½ÉÑM¡••ÑÌ ‹‚â‚âË‚â‹‚â‚âË‚âg‚â‚âË‚â‹‚âŸ‚âÇ‚âdˆ°mM!Q}	U%1IL¹‘…¥±ä¹‰Õ¥± ¤°M!Q}	U%1IL¹•á•ÁÑ¥½¹Ì¹‰Õ¥± ¤°M!Q}	U%1IL¹¥¹Ñ…­”¹‰Õ¥± ¥t¤°(€€¤ì(€€ ˆÉ•Áàˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø•áÁ½ÉÑM¡••ÑÌ ‹‚â‚âË‚â‹‚â‚âË‚â‚âs‚âÓ‚âS‚âo‚â‚âW‚âÐˆ°‰Õ¥±‘I•Ù¥•ÝáÁ½ÉÑM¡••ÑÌ ¤¤¤ì(€€ ˆÉ•Á5½¹Ñ¡±äˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø(€€€•áÁ½ÉÑM¡••ÑÌ ‹‚â«‚â‚âã‚âo‚â‚âË‚â‹‚æ‚âS‚âß‚â·‚âdˆ°mM!Q}	U%1IL¹µ½¹Ñ¡±ä¹‰Õ¥± ¤°M!Q}	U%1IL¹‘…µ…”¹‰Õ¥± ¤°M!Q}	U%1IL¹­Á¤¹‰Õ¥± ¥t¤°(€€¤ì(€€ ˆÉ•Á±°ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°½Á•¹áÁ½ÉÑ¥…±½œ¤ì(€€ ˆÉ•Á%µ…”ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°…ÁÑÕÉ•A…”¤ì(€€ ˆÉ•ÁM•¹ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€¥˜€ ……¸ ‰•áÁ½ÉÐˆ¤¤É•ÑÕÉ¸‘•¹ä ‹‚â«‚æ#‚â‚â‚âË‚â‹‚â‚âË‚âdˆ¤ì(€€€½¹ÍÐ½Á•¸€ô¹‘…µ…•å±•Ì¹™¥±Ñ•È ¡Œ¤€ôøŒ¹ÍÑ…ÑÕÌ€ôôô€‰½Á•¸ˆ¤¹±•¹Ñ ì(€€€¥˜€¡½Á•¸¤É•ÑÕÉ¸Ñ½…ÍÐ ‹‚â‹‚âÇ‚â‚â‡‚â×‚â‚â·‚âk‚â_‚â×‚æ#‚æ‚â‡‚æ#‚æ‚âS‚æ'‚âo‚âÓ‚âPƒŠPƒ‚âo‚âÓ‚âS‚â‚â·‚âk‚â‚æ#‚â·‚âg‚â#‚âÛ‚â‚â«‚æ#‚â‚â‚âË‚â‚æ‚â‚âÓ‚âd¿‚âk‚âã‚â‚â‚â—‚æ‚âS‚æ$ˆ°€‰Ý…É¸ˆ¤ì(€€€±½Ñ¥½¸ ‰Í•¹‘}É•Á½ÉÐˆ°€‰É•Á½ÉÐˆ°€‰µ½¹Ñ¡±äˆ°€‹‚â«‚æ#‚â‚â«‚â‚âã‚âo‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚â¯‚æ'‚â‚âË‚â‚æ‚â‚âÓ‚âg‚æ‚â—‚âÃ‚âk‚âã‚â‚â‚â”ˆ¤ì(€€€Ñ½…ÍÐ ‹‚â«‚æ#‚â‚â+‚âã‚âS‚â‚âË‚â‹‚â‚âË‚âg‚æ‚â¯‚æ'‚â‚âË‚â‚æ‚â‚âÓ‚âg‚æ‚â—‚âÃ‚âk‚âã‚â‚â‚â—‚æ‚â—‚æ'‚âœˆ¤ì(€ô¤ì)ôì((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€Y%\èQ…±¬Ñ¼…Ñ„(€€€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼)½¹ÍÐMUMQ%=9L€ôl(€€‹‚âk‚â‚âÓ‚â§‚âÇ‚â_‚æ‚â¯‚âg‚â‡‚â×‚â‚âË‚â‹‚â‚âË‚â‚âs‚âÓ‚âS‚âo‚â‚âW‚âÓ‚â‡‚âË‚â‚â_‚â×‚æ#‚â«‚âã‚âPˆ°(€€‹‚â«‚âË‚æ‚â¯‚âW‚âã‚â¯‚â—‚âÇ‚â‚æ‚âg‚â+‚æ#‚âŸ‚â‚âg‚â×‚æ'‚â‚âß‚â·‚â·‚âÃ‚æ‚âŒˆ°(€€‹‚æ‚â‚â—‚æ3‚æ‚â¯‚âg‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â«‚æ#‚âˆ°(€€‹‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚âS‚âß‚â·‚âg‚âg‚â×‚æ'‚æ‚â_‚æ#‚âË‚æ‚â¯‚â‚æ ˆ°(€€‹‚æ‚â‚â«‚æ‚â¯‚âg‚æ‚â—‚âˆM1ƒ‚âk‚æ'‚âË‚âˆ°(€€‹‚âk‚âÇ‚â7‚â+‚â×‚æ‚â¯‚âg‚æ‚â‚âÓ‚âP‘¥™˜ƒ‚âk‚æ#‚â·‚â‹‚â_‚â×‚æ#‚â«‚âã‚âPˆ°)tì()™Õ¹Ñ¥½¸…¹ÍÝ•ÉEÕ•ÍÑ¥½¸¡Ä¤ì(€½¹ÍÐÐ€ôÄ¹Ñ½1½Ý•É…Í” ¤ì(€½¹ÍÐ±¥Ù”€ôÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€‰ÁÉ½‘ÕÑ¥½¸ˆ€˜˜Mˆ¹Í¥¹•‘%¸ ¤ì(€½¹ÍÐ•à€ô±¥Ù”€üÍ½Á•‘á•ÁÑ¥½¹Ì ¤€è¹•á•ÁÑ¥½¹Ìì(€½¹ÍÐ¡…Ì€ô€ ¸¸¹Ü¤€ôøÜ¹Í½µ” ¡à¤€ôøÐ¹¥¹±Õ‘•Ì¡à¤¤ì((€¥˜€¡¡…Ì ‹‚âk‚â‚âÓ‚â§‚âÇ‚â\ˆ°€‰½µÁ…¹äˆ¤¤ì(€€€½¹ÍÐ…œ€ô=‰©•Ð¹•¹ÑÉ¥•Ì¡•à¹É•‘Õ” ¡„±”¤ôø ¡…m”¹½µÁ…¹åtô¡…m”¹½µÁ…¹åuñðÀ¤¬Ä¤±„¤±íô¤¤¹Í½ÉÐ ¡„±ˆ¤ôù‰lÅtµ…lÅt¤ì(€€€É•ÑÕÉ¸ì(€€€€€Ñ•áÐè…œ¹±•¹Ñ €üƒ‚â+‚æ#‚âŸ‚â€‘íÉ…¹•1…‰•° ¥ôƒ‚âk‚â‚âÓ‚â§‚âÇ‚â_‚â_‚â×‚æ#‚â‡‚âÔá•ÁÑ¥½¸ƒ‚â‡‚âË‚â‚â_‚â×‚æ#‚â«‚âã‚âS‚â‚âß‚â´€‘í…œ¹Í±¥” À°Ì¤¹µ…À ¡m½µÁ…¹ä±½Õ¹Ñt¤ôù€‘í½µÁ…¹åô€‘í¹Õ´¡½Õ¹Ð¥ôƒ‚æ‚â‚â©€¤¹©½¥¸ ˆ°€ˆ¥õ€€èƒ‚â+‚æ#‚âŸ‚â€‘íÉ…¹•1…‰•° ¥ôƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚âÔá•ÁÑ¥½¸ƒ‚â_‚â×‚æ#‚â‚âÃ‚âk‚âã‚âk‚â‚âÓ‚â§‚âÇ‚â]€°(€€€€€±¥¹¬èì±…‰•°è€‹‚âS‚âä-A$ƒ‚âk‚â‚âÓ‚â§‚âÇ‚â\ˆ°É½ÕÑ”è€‰­Á¤ˆô°(€€€ôì(€ô(€¥˜€¡¡…Ì ‹‚â«‚âË‚æ‚â¯‚âW‚âàˆ°€‰…ÕÍ”ˆ°€‹‚â_‚âÏ‚æ‚â„ˆ¤¤ì(€€€½¹ÍÐ…œ€ô=‰©•Ð¹•¹ÑÉ¥•Ì¡•à¹É•‘Õ” ¡„°”¤€ôø€ ¡…m”¹…ÕÍ•t€ô€¡…m”¹…ÕÍ•tñð€À¤€¬€Ä¤°„¤°íô¤¤¹Í½ÉÐ ¡„°ˆ¤€ôø‰lÅt€´…lÅt¤ì(€€€É•ÑÕÉ¸ì(€€€€€Ñ•áÐè…œ¹±•¹Ñ €üƒ‚â«‚âË‚æ‚â¯‚âW‚âã‚â·‚âÇ‚âg‚âS‚âÇ‚âk‚âW‚æ'‚âg‚â+‚æ#‚âŸ‚â€‘íÉ…¹•1…‰•° ¥ôƒ‚â‚âß‚â´€‘í…œ¹Í±¥” À°Ì¤¹µ…À ¡m…ÕÍ”±½Õ¹Ñt¤ôù€ˆ‘í…ÕÍ•ôˆ€‘í¹Õ´¡½Õ¹Ð¥ôƒ‚æ‚â‚â©€¤¹©½¥¸ ˆ°€ˆ¥õ€€èƒ‚â+‚æ#‚âŸ‚â€‘íÉ…¹•1…‰•° ¥ôƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚âÔá•ÁÑ¥½¹€°(€€€€€±¥¹¬èì±…‰•°è€‹‚âS‚âç‚â‚âË‚â‹‚â‚âË‚â‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âPˆ°É½ÕÑ”è€‰•á•ÁÑ¥½¹Ìˆô°(€€€ôì(€ô(€¥˜€¡¡…Ì ‹‚æ‚â‚â—‚æ0ˆ°€‰™¥±”ˆ°€‰ÍÑ´ˆ°€‰‰¼€ˆ¤¤ì(€€€¥˜€¡±¥Ù”¤ì(€€€€€½¹ÍÐ½ÁÌô¡±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹½Á•É…Ñ¥½¹Íññmt¤¹™¥±Ñ•È ¡É½Ü¤ôùÉ½Ü¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”øõÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½´˜™É½Ü¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”ðõÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹Ñ¼˜˜¡ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹äôôô‰10‰ññÉ½Ü¹½µÁ…¹äôôõÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä¤¤ì(€€€€€½¹ÍÐ‰…õ½ÁÌ¹™¥±Ñ•È ¡É½Ü¤ôùl‰Ý…¥Ñ¥¹}™¥±•Ìˆ°‰¹••‘Í}É•Ù¥•Üˆ°‰•ÉÉ½È‰t¹¥¹±Õ‘•Ì¡É½Ü¹ÍÑ…ÑÕÌ¤¤ì(€€€€€É•ÑÕÉ¸íÑ•áÐé‰…¹±•¹Ñ ýƒ‚â+‚æ#‚âŸ‚â€‘íÉ…¹•1…‰•° ¥ôƒ‚â‡‚âÔ€‘í¹Õ´¡‰…¹±•¹Ñ ¥ôƒ‚â‚âË‚âg‚â_‚â×‚æ#‚âW‚æ'‚â·‚â‚âW‚âË‚â„è€‘í‰…¹Í±¥” À°Ô¤¹µ…À ¡É½Ü¤ôù€‘íÉ½Ü¹‰ÕÍ¥¹•ÍÍ}‘…Ñ•ô€‘íÉ½Ü¹½µÁ…¹åô€ ‘íÉ½Ü¹ÍÑ…ÑÕÍô¥€¤¹©½¥¸ ˆ°€ˆ¥õ€éƒ‚â+‚æ#‚âŸ‚â€‘íÉ…¹•1…‰•° ¥ôƒ‚æ‚â‡‚æ#‚â{‚âk‚â‚âË‚âg‚â‚â·‚æ‚â‚â—‚æ3‚â¯‚â‚âß‚â·‚â—‚æ'‚â‡‚æ‚â¯‚â—‚âŸ‚æ‚âdMÕÁ…‰…Í•€±±¥¹¬éí±…‰•°è‹‚æ‚âo‚âÓ‚âS‚â¯‚âg‚æ'‚âË‚âW‚â‚âŸ‚â#‚æ‚â‚â—‚æ3‚æ‚â‚æ'‚âÈˆ±É½ÕÑ”è‰¥¹Ñ…­”‰õôì(€€€ô(€€€½¹ÍÐ‰…€ô¹™¥±•Ì¹™¥±Ñ•È ¡˜¤€ôø˜¹ÍÑ…ÑÕÌ€„ôô€‰É••¥Ù•ˆ¤ì(€€€É•ÑÕÉ¸ì(€€€€€Ñ•áÐè‰…¹±•¹Ñ (€€€€€€€€üƒ‚â‹‚âÇ‚â‚â‡‚â×‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚â‡‚â×‚âo‚âÇ‚â7‚â¯‚âÈ€‘í‰…¹±•¹Ñ¡ôƒ‚â‚âË‚â‹‚â‚âË‚âŒè€‘í‰…¹Í±¥” À°€Ô¤¹µ…À ¡ˆ¤€ôø€‘íˆ¹½µÁ…¹å9…µ•ô€´€‘íˆ¹™¥±•QåÁ•ô€ ‘íˆ¹ÍÑ…ÑÕÌ€ôôô€‰µ¥ÍÍ¥¹œˆ€ü€‹‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â«‚æ#‚âˆ€èˆ¹ÍÑ…ÑÕÌ€ôôô€‰±…Ñ”ˆ€ü€‹‚â«‚æ#‚â‚â+‚æ'‚âÈˆ€è€‹‚âs‚âÓ‚âS‚âk‚â‚âÓ‚â§‚âÇ‚â\‰ô¥€¤¹©½¥¸ ˆ°€ˆ¥ô‘í‰…¹±•¹Ñ €ø€Ô€ü€ˆƒ‚æ‚â—‚âÃ‚â·‚âß‚æ#‚âdƒ‚æˆ€è€ˆ‰õ€(€€€€€€€€è€‹‚æ‚â‚â—‚æ3‚â‚â‚âk‚â_‚âã‚â‚âk‚â‚âÓ‚â§‚âÇ‚â_‚æ‚â—‚âÃ‚â_‚âã‚â‚âo‚â‚âÃ‚æ‚âƒ‚â_‚æ‚â—‚æ'‚âœˆ°(€€€€€±¥¹¬èì±…‰•°è€‹‚æ‚âo‚âÓ‚âS‚â¯‚âg‚æ'‚âÈ%¹Ñ…­”½¹ÑÉ½°ˆ°É½ÕÑ”è€‰¥¹Ñ…­”ˆô°(€€€ôì(€ô(€¥˜€¡¡…Ì ‹‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆˆ°€‰‘…µ…”ˆ°€‹‚æ‚âS‚âß‚â·‚âg‚âg‚â×‚æ$ˆ¤¤ì(€€€½¹ÍÐÍÕ´€ô¹‘…µ…•Ì¹É•‘Õ” ¡„°Œ¤€ôø„€¬Œ¹…µ½Õ¹Ð°€À¤ì(€€€¥˜€¡±¥Ù”¤É•ÑÕÉ¸ìÑ•áÐèƒ‚â+‚æ#‚âŸ‚â€‘íÉ…¹•1…‰•° ¥ôƒ‚â‡‚â×‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â_‚â×‚æ#‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚âdMÕÁ…‰…Í”€‘íµ½¹•äÀ¡ÍÕ´¥ôƒ‚âk‚âË‚â\ƒ‚â#‚âË‚â€‘í¹Õ´¡¹‘…µ…•Ì¹±•¹Ñ ¥ôƒ‚â‚âË‚â‹‚â‚âË‚â€°±¥¹¬èì±…‰•°è€‹‚æ‚âo‚âÓ‚âS‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆˆ°É½ÕÑ”è€‰‘…µ…”ˆôôì(€€€½¹ÍÐ±…ÍÐ€ô¹µ½¹Ñ¡±åQÉ•¹‘m¹µ½¹Ñ¡±åQÉ•¹¹±•¹Ñ €´€Åtì(€€€É•ÑÕÉ¸ì(€€€€€Ñ•áÐèƒ‚â‚â·‚âh€Ä€ Ä´ÄÔƒ‚â¨»‚â¸€ÈÀÈØ¤ƒ‚â‡‚â×‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â_‚â×‚æ#‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â—‚æ'‚âœ€‘íµ½¹•äÀ¡ÍÕ´¥ôƒ‚âk‚âË‚â\ƒ‚â#‚âË‚â€‘í¹‘…µ…•Ì¹±•¹Ñ¡ôƒ‚æ‚â‚â¨ƒ‚â«‚âÏ‚â¯‚â‚âÇ‚âk‚â_‚âÇ‚æ'‚â‚æ‚âS‚âß‚â·‚âg‚â—‚æ#‚âË‚â«‚âã‚âS‚æ‚âg‚â‚âÃ‚âk‚âk‚â·‚â‹‚âç‚æ#‚â_‚â×‚æ €‘íµ½¹•äÀ¡±…ÍÐ¹‘…µ…”¥ôƒ‚âk‚âË‚â\€‘í±…ÍÐ¹…Í•Íôƒ‚æ‚â‚â¨ƒ‚æ‚â—‚âÃ‚âo‚æ'‚â·‚â‚â‚âÇ‚âg‚æ‚âS‚æ$€‘íµ½¹•äÀ¡±…ÍÐ¹ÁÉ•Ù•¹Ñ•¥ôƒ‚âk‚âË‚â]€°(€€€€€±¥¹¬èì±…‰•°è€‹‚æ‚âo‚âÓ‚âS‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆˆ°É½ÕÑ”è€‰‘…µ…”ˆô°(€€€ôì(€ô(€¥˜€¡¡…Ì ‰Í±„ˆ°€‹‚æ‚â—‚â‹‚â‚âÏ‚â¯‚âg‚âPˆ°€‹‚â+‚æ'‚âÈˆ¤¤ì(€€€½¹ÍÐ½Ù•È€ô•à¹™¥±Ñ•È ¡”¤€ôø”¹½Ù•ÉM±„¤ì(€€€É•ÑÕÉ¸ì(€€€€€Ñ•áÐèƒ‚â‡‚â×‚æ‚â‚â«‚æ‚â‚âÓ‚âdM1€‘í½Ù•È¹±•¹Ñ¡ôƒ‚â‚âË‚â‹‚â‚âË‚âŒƒ‚æ‚â‹‚â‚æ‚âo‚æ‚âdÉ¥Ñ¥…°€‘í½Ù•È¹™¥±Ñ•È ¡”¤€ôø”¹Í•Ù•É¥Ñä€ôôô€‰É¥Ñ¥…°ˆ¤¹±•¹Ñ¡ô°!¥ €‘í½Ù•È¹™¥±Ñ•È ¡”¤€ôø”¹Í•Ù•É¥Ñä€ôôô€‰¡¥ ˆ¤¹±•¹Ñ¡ô°5•‘¥Õ´€‘í½Ù•È¹™¥±Ñ•È ¡”¤€ôø”¹Í•Ù•É¥Ñä€ôôô€‰µ•‘¥Õ´ˆ¤¹±•¹Ñ¡ôƒ‚æ‚â‚â«‚â_‚â×‚æ#‚â‚æ'‚âË‚â‚âg‚âË‚âg‚â_‚â×‚æ#‚â«‚âã‚âS‚â‚âß‚â´€‘í½Ù•È¹Í½ÉÐ ¡„°ˆ¤€ôøˆ¹…•!½ÕÉÌ€´„¹…•!½ÕÉÌ¥lÁtü¹¥ñð€ˆ´‰õ€°(€€€€€±¥¹¬èì±…‰•°è€‹‚â‚â‚â·‚â‚æ‚â'‚â{‚âË‚âÃ‚æ‚â‚â«‚æ‚â—‚âˆM1ˆ°É½ÕÑ”è€‰•á•ÁÑ¥½¹Ìˆ°•á¥±Ñ•ÈèìÍ±„èÑÉÕ”ôô°(€€€ôì(€ô(€¥˜€¡¡…Ì ‹‚âk‚âÇ‚â7‚â+‚âÔˆ°€‰…½Õ¹Ðˆ°€‰‘¥™˜ƒ‚âk‚æ#‚â·‚âˆˆ¤¤ì(€€€½¹ÍÐ…œ€ô=‰©•Ð¹•¹ÑÉ¥•Ì¡•à¹É•‘Õ” ¡„°”¤€ôø€ ¡…m”¹…½Õ¹Ñt€ô€¡…m”¹…½Õ¹Ñtñð€À¤€¬€Ä¤°„¤°íô¤¤¹Í½ÉÐ ¡„°ˆ¤€ôø‰lÅt€´…lÅt¤ì(€€€É•ÑÕÉ¸ì(€€€€€Ñ•áÐèƒ‚âk‚âÇ‚â7‚â+‚â×‚â_‚â×‚æ#‚æ‚â‚âÓ‚âP‘¥™˜ƒ‚âk‚æ#‚â·‚â‹‚â_‚â×‚æ#‚â«‚âã‚âS‚â‚âß‚â´€‘í…lÁulÁuôƒ‚â#‚âÏ‚âg‚âŸ‚âd€‘í…lÁulÅuôƒ‚æ‚â‚â¨ƒ‚â‚â·‚â‚â—‚â‚â‡‚âÈ€‘í…lÅulÁuô€‘í…lÅulÅuôƒ‚æ‚â‚â¨ƒ‚æ‚â—‚âÀ€‘í…lÉulÁuô€‘í…lÉulÅuôƒ‚æ‚â‚â¨ƒ‚â‚âŸ‚â‚âW‚â‚âŸ‚â#‚âŸ‚æ#‚âË‚æ‚âo‚æ‚âg‚âo‚âÇ‚â7‚â¯‚âË‚â_‚â×‚æ#‚â‚âç‚âo‚æ‚âk‚âk‚æ‚â‚â—‚æ3‚âc‚âg‚âË‚â‚âË‚â‚â¯‚â‚âß‚â·‚â‚âÇ‚æ'‚âg‚âW‚â·‚âg‚â‚âË‚â‚â_‚âÏ‚â‚âË‚âg‚â‚â·‚â‚â_‚â×‚â…€°(€€€€€±¥¹¬èì±…‰•°è€‹‚âS‚âç‚â¯‚âg‚æ'‚âÈ-A$ˆ°É½ÕÑ”è€‰­Á¤ˆô°(€€€ôì(€ô(€¥˜€¡¡…Ì ‰µ…Ñ¡•ˆ°€‹‚â#‚âÇ‚âk‚â‚âç‚æ ˆ°€‹‚â‚â×‚æ#‚â‚âË‚â‹‚â‚âË‚âŒˆ°€‹‚âŸ‚âÇ‚âg‚âg‚â×‚æ$ˆ¤¤ì(€€€¥˜€¡±¥Ù”¤ì(€€€€€½¹ÍÐÄô¡±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹ÅÕ…±¥Ñåññmt¤¹™¥±Ñ•È ¡É½Ü¤ôùÉ½Ü¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”øõÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½´˜™É½Ü¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”ðõÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹Ñ¼˜˜¡ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹äôôô‰10‰ññÉ½Ü¹½µÁ…¹äôôõÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä¤¤ì(€€€€€½¹ÍÐÑ½ÐõÄ¹É•‘Õ” ¡ÍÕ´±É½Ü¤ôùÍÕ´­9Õµ‰•È¡É½Ü¹ÍÑµ}½Õ¹ÑñðÀ¤°À¤±´õÄ¹É•‘Õ” ¡ÍÕ´±É½Ü¤ôùÍÕ´­9Õµ‰•È¡É½Ü¹µ…Ñ¡•‘ñðÀ¤°À¤ì(€€€€€É•ÑÕÉ¸íÑ•áÐéƒ‚â+‚æ#‚âŸ‚â€‘íÉ…¹•1…‰•° ¥ôƒ‚â‡‚â×‚â‚âË‚â‹‚â‚âË‚âŒMQ4€‘í¹Õ´¡Ñ½Ð¥ôƒ‚â#‚âÇ‚âk‚â‚âç‚æ#‚â«‚âÏ‚æ‚â‚æ‚â €‘í¹Õ´¡´¥ôƒ‚â‚âÓ‚âS‚æ‚âo‚æ‚âd€‘íÑ½Ðü ¡´½Ñ½Ð¤¨ÄÀÀ¤¹Ñ½¥á• È¤èˆÀ¸ÀÀ‰ô”ƒ‚æ‚â—‚âÃ‚â‡‚âÔá•ÁÑ¥½¸€‘í¹Õ´¡•à¹±•¹Ñ ¥ôƒ‚â‚âË‚â‹‚â‚âË‚â€±±¥¹¬éí±…‰•°è‹‚æ‚âo‚âÓ‚âS‚æ‚âS‚â+‚âk‚â·‚â‚æ3‚âPˆ±É½ÕÑ”è‰‘…Í¡‰½…É‰õôì(€€€ô(€€€½¹ÍÐÑ½Ð€ô¹¡½ÕÉ±ä¹É•‘Õ” ¡„°Œ¤€ôø„€¬Œ¹Ñ½Ñ…°°€À¤ì(€€€½¹ÍÐ´€ô¹¡½ÕÉ±ä¹É•‘Õ” ¡„°Œ¤€ôø„€¬Œ¹µ…Ñ¡•°€À¤ì(€€€É•ÑÕÉ¸ì(€€€€€Ñ•áÐèƒ‚âŸ‚âÇ‚âg‚â_‚â×‚æ €‘í¹	UM%9MM}Qôƒ‚â‡‚â×‚â‚âË‚â‹‚â‚âË‚â‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âP€‘í¹Õ´¡Ñ½Ð¥ôƒ‚â#‚âÇ‚âk‚â‚âç‚æ#‚â«‚âÏ‚æ‚â‚æ‚â €‘í¹Õ´¡´¥ôƒ‚â‚âÓ‚âS‚æ‚âo‚æ‚âd€‘ì ¡´€¼Ñ½Ð¤€¨€ÄÀÀ¤¹Ñ½¥á• È¥ô”ƒ‚æ‚â¯‚â—‚âß‚â´•á•ÁÑ¥½¸€‘í¹Õ´¡Ñ½Ð€´´¥ôƒ‚â‚âË‚â‹‚â‚âË‚â‚â_‚â×‚æ#‚âW‚æ'‚â·‚â‚âW‚â‚âŸ‚â!€°(€€€€€±¥¹¬èì±…‰•°è€‹‚æ‚âo‚âÓ‚âS‚æ‚âS‚â+‚âk‚â·‚â‚æ3‚âPˆ°É½ÕÑ”è€‰‘…Í¡‰½…Éˆô°(€€€ôì(€ô(€É•ÑÕÉ¸ì(€€€Ñ•áÐèƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚â‚æ'‚â·‚â‡‚âç‚â—‚âW‚â‚â‚â‚âÇ‚âk‚â‚âÏ‚â[‚âË‚â‡‚âg‚â×‚æ$ƒ‚â—‚â·‚â‚â[‚âË‚â‡‚æ‚â‚â×‚æ#‚â‹‚âŸ‚â‚âÇ‚âk‚âk‚â‚âÓ‚â§‚âÇ‚â\ƒ‚â«‚âË‚æ‚â¯‚âW‚âàƒ‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚â‚âË‚âPƒ‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆM1ƒ‚âk‚âÇ‚â7‚â+‚â×‚â_‚â×‚æ#‚æ‚â‚âÓ‚âP‘¥™˜ƒ‚âk‚æ#‚â·‚âˆƒ‚â¯‚â‚âß‚â·‚â·‚âÇ‚âW‚â‚âË‚â#‚âÇ‚âk‚â‚âç‚æ#‚æ‚âg‚â+‚æ#‚âŸ‚â€‘íÉ…¹•1…‰•° ¥õ€°(€€€±¥¹¬è¹Õ±°°(€ôì)ô()Y%]L¹Ñ…±¬€ô€¡É½½Ð¤€ôøì(€¥˜€ …•¹ÍÕÉ•1¥Ù•=Ù•ÉÙ¥•Ü¡É½½Ð¤¤É•ÑÕÉ¸ì(€É½½Ð¹¥¹¹•É!Q50€ô€(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰É¥µÑ…±¬ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùQ…±¬Ñ¼…Ñ„ð½Àøñ Èû‚â[‚âË‚â‡‚â‚æ'‚â·‚â‡‚âç‚â—‚â_‚â×‚æ#‚âs‚æ#‚âË‚âdÉ•½¹¥±”ƒ‚æ‚â—‚æ'‚âœð½ Èøð½‘¥Øø(€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰¡•…±Ñ ½¬ˆû‚â‚æ'‚â·‚â‡‚âç‚â”€‘í¹	UM%9MM}Qôð½ÍÁ…¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¡…Ðµ‰½à‰¥œˆ¥ô‰¡…Ñ	½àˆø(€€€€€€€€€€‘ì(€€€€€€€€€€€ÍÑ…Ñ”¹¡…Ð¹±•¹Ñ (€€€€€€€€€€€€€€üÍÑ…Ñ”¹¡…Ð(€€€€€€€€€€€€€€€€€€¹µ…À (€€€€€€€€€€€€€€€€€€€€¡´¤€ôø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰µ•ÍÍ…”€‘í´¹ÑåÁ•ôˆø‘í ¡´¹Ñ•áÐ¥ô‘í´¹±¥¹¬€ü€ñ‰ÕÑÑ½¸±…ÍÌô‰¡…Ðµ±¥¹¬ˆ‘…Ñ„µÉ½ÕÑ”ôˆ‘í´¹±¥¹¬¹É½ÕÑ•ôˆ‘…Ñ„µÁ…å±½…ôœ‘í ¡)M=8¹ÍÑÉ¥¹¥™ä¡´¹±¥¹¬¤¥ôœø‘í ¡´¹±¥¹¬¹±…‰•°¥ôƒŠHð½‰ÕÑÑ½¸ù€€è€ˆ‰ôð½‘¥Øù€°(€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€¹©½¥¸ ˆˆ¤(€€€€€€€€€€€€€€è€ñ‘¥Ø±…ÍÌô‰µ•ÍÍ…”ÍåÍÑ•´ˆû‚â—‚â·‚â‚â[‚âË‚â‡‚âŸ‚æ#‚âÈ€‹‚âk‚â‚âÓ‚â§‚âÇ‚â_‚æ‚â¯‚âg‚â‡‚â×‚â‚âË‚â‹‚â‚âË‚â‚âs‚âÓ‚âS‚âo‚â‚âW‚âÓ‚â‡‚âË‚â‚â_‚â×‚æ#‚â«‚âã‚âPˆƒ‚â¯‚â‚âß‚â´€‹‚æ‚â‚â—‚æ3‚æ‚â¯‚âg‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â«‚æ#‚âˆƒŠPƒ‚â_‚âã‚â‚â‚âÏ‚âW‚â·‚âk‚â#‚âÃ‚â·‚æ'‚âË‚â‚â·‚âÓ‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚â‚âÓ‚â‚æ‚âg‚â+‚æ#‚âŸ‚â‚â_‚â×‚æ#‚æ‚â—‚âß‚â·‚âð½‘¥Øù€(€€€€€€€€€ô(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ™½É´±…ÍÌô‰…Í¬µ™½É´ˆ¥ô‰…Í­½É´ˆø(€€€€€€€€€€ñ¥¹ÁÕÐ¥ô‰…Í­%¹ÁÕÐˆÑåÁ”ô‰Ñ•áÐˆÁ±…•¡½±‘•Èô‹‚â{‚âÓ‚â‡‚â{‚æ3‚â‚âÏ‚â[‚âË‚â‡‚â[‚âÛ‚â‚â‚æ'‚â·‚â‡‚âç‚â”¸¸¸ˆ…ÕÑ½½µÁ±•Ñ”ô‰½™˜ˆ€¼ø(€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰ÍÕ‰µ¥Ðˆ±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆû‚â[‚âË‚â„ð½‰ÕÑÑ½¸ø(€€€€€€€€ð½™½É´ø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¡¥ÁÌˆø‘íMUMQ%=9L¹µ…À ¡Ì¤€ôø€ñ‰ÕÑÑ½¸±…ÍÌô‰¡¥Àˆ‘…Ñ„µÄôˆ‘í ¡Ì¥ôˆø‘í ¡Ì¥ôð½‰ÕÑÑ½¸ù€¤¹©½¥¸ ˆˆ¥ôð½‘¥Øø(€€€€€€ð½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆû‚â‚æ'‚â·‚â‚âÏ‚â¯‚âg‚âPð½Àøñ Èû‚â‚âW‚âÓ‚â‚âË‚â‚â·‚â‚â‚âÏ‚âW‚â·‚âhð½ Èøð½‘¥Øøð½‘¥Øø(€€€€€€€€ñÕ°±…ÍÌô‰Ñ¥¬µ±¥ÍÐˆø(€€€€€€€€€€ñ±¤û‚âW‚â·‚âk‚â#‚âË‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚â_‚â×‚æ#‚âs‚æ#‚âË‚âdÉ•½¹¥±”ƒ‚æ‚â—‚æ'‚âŸ‚æ‚â_‚æ#‚âË‚âg‚âÇ‚æ'‚âdð½±¤ø(€€€€€€€€€€ñ±¤û‚âW‚æ'‚â·‚â‚â‚âÃ‚âk‚âã‚âW‚âÇ‚âŸ‚æ‚â—‚â‚æ‚â—‚âÃ‚â+‚æ#‚âŸ‚â‚âŸ‚âÇ‚âg‚â_‚â×‚æ#‚â+‚âÇ‚âS‚æ‚â#‚âdð½±¤ø(€€€€€€€€€€ñ±¤û‚â‚âÏ‚âW‚â·‚âk‚â_‚â×‚æ#‚â‚â‚âÃ‚â_‚âk‚â‚âË‚â‚â—‚â‚æ‚â_‚â§‚â¯‚â‚âß‚â·‚â‚âË‚â‚æ‚â‚âÓ‚âdƒ‚âW‚æ'‚â·‚â‚â‡‚â×‚â—‚âÓ‚â‚â‚æ3‚â‚â—‚âÇ‚âk‚æ‚âo‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdð½±¤ø(€€€€€€€€€€ñ±¤û‚æ‚â‡‚æ#‚âW‚â·‚âk‚â#‚âË‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚âS‚âÓ‚âk‚â_‚â×‚æ#‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚âs‚æ#‚âË‚âdÅÕ…±¥Ñä…Ñ”ð½±¤ø(€€€€€€€€ð½Õ°ø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œµÐˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆû‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚â‚â_‚â×‚æ#‚âW‚â·‚âk‚æ‚âS‚æ$ð½Àøñ Èû‚â‚â·‚âk‚æ‚â‚âW‚âo‚âÇ‚â#‚â#‚âã‚âk‚âÇ‚âdð½ Èøð½‘¥Øøð½‘¥Øø(€€€€€€€€ñÕ°±…ÍÌô‰Ñ¥¬µ±¥ÍÐˆø(€€€€€€€€€€ñ±¤û‚â‹‚â·‚âPá•ÁÑ¥½¸ƒ‚æ‚â‹‚â‚âW‚âË‚â‡‚âk‚â‚âÓ‚â§‚âÇ‚â\€¼ƒ‚âo‚â‚âÃ‚æ‚âƒ‚â\€¼ƒ‚âk‚âÇ‚â7‚â+‚âÔð½±¤ø(€€€€€€€€€€ñ±¤û‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚â‚âË‚âS‚â¯‚â‚âß‚â·‚â«‚æ#‚â‚âs‚âÓ‚âS‚âk‚â‚âÓ‚â§‚âÇ‚â\ð½±¤ø(€€€€€€€€€€ñ±¤û‚â‹‚â·‚âS‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚æ‚â—‚âÃ‚æ‚âg‚âŸ‚æ‚âg‚æ'‚â‡‚â‚âË‚â‹‚æ‚âS‚âß‚â·‚âdð½±¤ø(€€€€€€€€€€ñ±¤û‚æ‚â‚â«‚â_‚â×‚æ#‚æ‚â—‚âˆM1ƒ‚æ‚â—‚âÃ‚æ‚â‚â«‚â_‚â×‚æ#‚â‚æ'‚âË‚â‚âg‚âË‚âg‚â_‚â×‚æ#‚â«‚âã‚âPð½±¤ø(€€€€€€€€ð½Õ°ø(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ù€ì((€½¹ÍÐÍ•¹€ô€¡Ä¤€ôøì(€€€ÍÑ…Ñ”¹¡…Ð¹ÁÕÍ ¡ìÑåÁ”è€‰ÕÍ•Èˆ°Ñ•áÐèÄô¤ì(€€€½¹ÍÐ„€ô…¹ÍÝ•ÉEÕ•ÍÑ¥½¸¡Ä¤ì(€€€ÍÑ…Ñ”¹¡…Ð¹ÁÕÍ ¡ìÑåÁ”è€‰ÍåÍÑ•´ˆ°Ñ•áÐè„¹Ñ•áÐ°±¥¹¬è„¹±¥¹¬ô¤ì(€€€±½Ñ¥½¸ ‰ÅÕ•Éäˆ°€‰Ñ…±­}Ñ½}‘…Ñ„ˆ°Ä¹Í±¥” À°€ÐÀ¤°„¹Ñ•áÐ¹Í±¥” À°€àÀ¤¤ì(€€€É•¹‘•È ¤ì(€€€½¹ÍÐ‰½à€ô€ ˆ¡…Ñ	½àˆ¤ì(€€€¥˜€¡‰½à¤‰½à¹ÍÉ½±±Q½À€ô‰½à¹ÍÉ½±±!•¥¡Ðì(€ôì((€€ ˆ…Í­½É´ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰ÍÕ‰µ¥Ðˆ°€¡”¤€ôøì(€€€”¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€½¹ÍÐØ€ô€ ˆ…Í­%¹ÁÕÐˆ¤¹Ù…±Õ”¹ÑÉ¥´ ¤ì(€€€¥˜€¡Ø¤Í•¹¡Ø¤ì(€ô¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ˆ¹¡¥Àˆ¤¹™½É…  ¡Œ¤€ôøŒ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøÍ•¹¡Œ¹‘…Ñ…Í•Ð¹Ä¤¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ˆ¹¡…Ðµ±¥¹¬ˆ¤¹™½É…  ¡ˆ¤€ôø(€€€ˆ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€€€½¹ÍÐÀ€ô)M=8¹Á…ÉÍ”¡ˆ¹‘…Ñ…Í•Ð¹Á…å±½…¤ì(€€€€€¼¡À¹É½ÕÑ”°ì™¥±Ñ•ÉÌèÀ¹™¥±Ñ•ÉÌ°•á¥±Ñ•ÈèÀ¹•á¥±Ñ•Èô¤ì(€€€ô¤°(€€¤ì(€½¹ÍÐ‰½à€ô€ ˆ¡…Ñ	½àˆ¤ì(€¥˜€¡‰½à¤‰½à¹ÍÉ½±±Q½À€ô‰½à¹ÍÉ½±±!•¥¡Ðì)ôì((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€Y%\è	…¹¬ÉÕ±•Ì(€€€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼)Y%]L¹ÉÕ±•Ì€ô€¡É½½Ð¤€ôøì(€¥˜€ …•¹ÍÕÉ•1¥Ù•=Ù•ÉÙ¥•Ü¡É½½Ð¤¤É•ÑÕÉ¸ì(€½¹ÍÐ•‘¥Ñ…‰±”€ô…¸ ‰ÉÕ±•Ìˆ¤€˜˜ÍÑ…Ñ”¹‘…Ñ…Í•Ð€„ôô€‰ÁÉ½‘ÕÑ¥½¸ˆì(€É½½Ð¹¥¹¹•É!Q50€ô€(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùIÕ±”¹¥¹”ð½Àøñ Èû‚â‚â;‚â‚âË‚â‹‚âc‚âg‚âË‚â‚âË‚âŒð½ Èøð½‘¥Øø(€€€€€€€€ñÍÁ…¸±…ÍÌô‰¡•…±Ñ €‘í•‘¥Ñ…‰±”€ü€‰½¬ˆ€è€‰…ÑÑ•¹Ñ¥½¸‰ôˆø‘í•‘¥Ñ…‰±”€ü€‹‚æ‚â‚æ'‚æ‚â‚æ‚âS‚æ$ˆ€è€‹‚â‚â;‚â_‚â×‚æ#‚æ‚â+‚æ'‚â‚âË‚âg‚â#‚â‚âÓ‚âƒ
Üƒ‚â·‚æ#‚âË‚âg‚â·‚â‹‚æ#‚âË‚â‚æ‚âS‚â×‚â‹‚âœ‰ôð½ÍÁ…¸ø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰ÉÕ±”µÉ½ÝÌˆø(€€€€€€€€‘í¹Í•ÑÑ¥¹Ì¹‰…¹­IÕ±•Ì(€€€€€€€€€€¹µ…À (€€€€€€€€€€€€¡È¤€ôø€ñ‘¥Ø±…ÍÌô‰ÉÕ±”µÉ½Üˆø(€€€€€€€€€€ñ±…‰•°±…ÍÌô‰ÍÝ¥Ñ ˆøñ¥¹ÁÕÐÑåÁ”ô‰¡•­‰½àˆ‘…Ñ„µ‰…¹¬ôˆ‘íÈ¹‰…¹­ôˆ€‘íÈ¹•¹…‰±•€ü€‰¡•­•ˆ€è€ˆ‰ô€‘í•‘¥Ñ…‰±”€ü€ˆˆ€è€‰‘¥Í…‰±•‰ô€¼øñÍÁ…¸øð½ÍÁ…¸øð½±…‰•°ø(€€€€€€€€€€ñ‘¥ØøñÍÑÉ½¹œø‘í ¡È¹‰…¹¬¥ôð½ÍÑÉ½¹œøñÍÁ…¸ø‘í ¡È¹‘•Ñ…¥°¥ôð½ÍÁ…¸øð½‘¥Øø(€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰‰…‘”€‘íÈ¹•¹…‰±•€ü€‰É••¸ˆ€è€‰É•ä‰ôˆø‘íÈ¹•¹…‰±•€ü€‹‚æ‚âo‚âÓ‚âS‚æ‚â+‚æ$ˆ€è€‹‚âo‚âÓ‚âP‰ôð½ÍÁ…¸ø(€€€€€€€€ð½‘¥Øù€°(€€€€€€€€€€¤(€€€€€€€€€€¹©½¥¸ ˆˆ¥ô(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰É¥´Èˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùIÕ±”AÉ•Í•Ðð½Àøñ Èû‚â‚â;‚â‚âŸ‚âk‚â‚âã‚â‡‚â‚âË‚â‚â_‚âÏ‚â‚âË‚âdð½ Èøð½‘¥Øøð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ½±”µ±¥ÍÐˆø(€€€€€€€€€€‘íl(€€€€€€€€€€€l‰É½ÍÍ…äˆ°€‹‚âW‚â‚âŸ‚â#‚â+‚æ#‚âŸ‚â‚â‚æ'‚âË‚â‡‚âŸ‚âÇ‚âd€ÈÌèÀÀ´ÈÌèÔäƒ‚â‚æ#‚âŸ‚â‡‚â‚âÇ‚âk‚âŸ‚âÇ‚âg‚â[‚âÇ‚âS‚æ‚âl‰t°(€€€€€€€€€€€l‰±½­•±•Ñ”ˆ°€‹‚â¯‚æ'‚âË‚â‡‚â—‚âk‚â‚æ'‚â·‚â‡‚âç‚â—‚â¯‚â—‚âÇ‚â¥µÁ½ÉÐ€£‚æ‚â«‚æ ¹½Ñ”ƒ‚æ‚âS‚æ'‚æ‚â_‚æ#‚âË‚âg‚âÇ‚æ'‚âd¤‰t°(€€€€€€€€€€€l‰É•ÅÕ¥É•Ù¥‘•¹”ˆ°€‹‚âk‚âÇ‚â‚â‚âÇ‚âk‚æ‚âg‚âk‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â‚æ#‚â·‚âg‚âo‚âÓ‚âS‚æ‚â‚â¨‰t°(€€€€€€€€€€€l‰ÁµMÕ•ÍÍ=¹±äˆ°€‰A4èƒ‚â‚â‚â·‚â‚æ‚â'‚â{‚âË‚âÃ‚â‚âË‚â‹‚â‚âË‚â‚â«‚âÏ‚æ‚â‚æ‚â ‰t°(€€€€€€€€€€€l‰™¥±Ñ•É…ÉÉå½ÉÝ…Éˆ°€Ÿ‚â‚â‚â·‚â€‹‚â‹‚â·‚âS‚â‹‚â‚â‡‚âÈˆƒ‚æ‚â—‚âÀ€‹‚â‚â·‚âk‚âŸ‚âÇ‚âg‚â_‚â×‚æ ˆƒ‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÐt°(€€€€€€€€€€€l‰¹½Ñ¥™åQ•±•É…´ˆ°€‹‚æ‚â#‚æ'‚â‚æ‚âW‚âß‚â·‚âdQ•±•É…´ƒ‚æ‚â‡‚âß‚æ#‚â´Í•Ù•É¥Ñäƒ‚â«‚âç‚â‰t°(€€€€€€€€€t(€€€€€€€€€€€€¹µ…À (€€€€€€€€€€€€€€¡m¬°±…‰•±t¤€ôø(€€€€€€€€€€€€€€€€ñ±…‰•°øñ¥¹ÁÕÐÑåÁ”ô‰¡•­‰½àˆ‘…Ñ„µÉÕ±”ôˆ‘í­ôˆ€‘í¹Í•ÑÑ¥¹Ì¹ÉÕ±•Ím­t€ü€‰¡•­•ˆ€è€ˆ‰ô€‘í•‘¥Ñ…‰±”€ü€ˆˆ€è€‰‘¥Í…‰±•‰ô€¼ø€‘í ¡±…‰•°¥ôð½±…‰•°ù€°(€€€€€€€€€€€€¤(€€€€€€€€€€€€¹©½¥¸ ˆˆ¥ô(€€€€€€€€ð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùQ…á½¹½µäð½Àøñ Èû‚âo‚â‚âÃ‚æ‚âƒ‚â\•á•ÁÑ¥½¸ƒ‚æ‚â—‚âÀM1ð½ Èøð½‘¥Øøð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…Àˆø(€€€€€€€€€€ñÑ…‰±”ø(€€€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ û‚âo‚â‚âÃ‚æ‚âƒ‚â\ð½Ñ øñÑ û‚â‚âÃ‚âS‚âÇ‚âk‚æ‚â‚âÓ‚æ#‚â‡‚âW‚æ'‚âdð½Ñ øñÑ ±…ÍÌô‰É¥¡ÐˆùM1€£‚â+‚â„¸¤ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚æ‚â‚â«‚âŸ‚âÇ‚âg‚âg‚â×‚æ$ð½Ñ øð½ÑÈøð½Ñ¡•…ø(€€€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€€€€‘í¹•á•ÁÑ¥½¹QåÁ•Ì(€€€€€€€€€€€€€€€€¹µ…À (€€€€€€€€€€€€€€€€€€¡Ð¤€ôø€ñÑÈøñÑø‘í ¡Ð¹¹…µ”¥ôð½Ñø(€€€€€€€€€€€€€€€€ñÑøñÍÁ…¸±…ÍÌô‰‰…‘”€‘íÐ¹‰…Í•M•Ù•É¥Ñåôˆø‘í ¡Í•Ù5•Ñ„¡Ð¹‰…Í•M•Ù•É¥Ñä¤¹¹…µ”¥ôð½ÍÁ…¸øð½Ñø(€€€€€€€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘íÍ•Ù5•Ñ„¡Ð¹‰…Í•M•Ù•É¥Ñä¤¹Í±…ôð½Ñø(€€€€€€€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í¹•á•ÁÑ¥½¹Ì¹™¥±Ñ•È ¡”¤€ôø”¹ÑåÁ”€ôôôÐ¹½‘”¤¹±•¹Ñ¡ôð½Ñøð½ÑÈù€°(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹©½¥¸ ˆˆ¥ô(€€€€€€€€€€€€ð½Ñ‰½‘äø(€€€€€€€€€€ð½Ñ…‰±”ø(€€€€€€€€ð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ù€ì((€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µ‰…¹­tˆ¤¹™½É…  ¡Œ¤€ôø(€€€Œ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¡…¹”ˆ°€ ¤€ôøì(€€€€€½¹ÍÐÈ€ô¹Í•ÑÑ¥¹Ì¹‰…¹­IÕ±•Ì¹™¥¹ ¡à¤€ôøà¹‰…¹¬€ôôôŒ¹‘…Ñ…Í•Ð¹‰…¹¬¤ì(€€€€€È¹•¹…‰±•€ôŒ¹¡•­•ì(€€€€€±½Ñ¥½¸ ‰ÕÁ‘…Ñ”ˆ°€‰‰…¹­}ÉÕ±”ˆ°È¹‰…¹¬°€¡Œ¹¡•­•€ü€‹‚æ‚âo‚âÓ‚âS‚æ‚â+‚æ$ˆ€è€‹‚âo‚âÓ‚âPˆ¤€¬€‹‚â‚â;‚âc‚âg‚âË‚â‚âË‚âŒˆ¤ì(€€€€€Ñ½…ÍÐ¡€‘íÈ¹‰…¹­ôè€‘íŒ¹¡•­•€ü€‹‚æ‚âo‚âÓ‚âS‚æ‚â+‚æ$ˆ€è€‹‚âo‚âÓ‚âP‰÷‚â‚â;‚æ‚â—‚æ'‚â€¤ì(€€€€€É•¹½Éµ…±¥é•±° ¤ì(€€€€€Í¡•‘Õ±•ÕÑ½I•½¹¥±” ‹‚æ‚âo‚â—‚â×‚æ#‚â‹‚âg‚â‚â;‚âc‚âg‚âË‚â‚âË‚âŒ€ˆ€¬È¹‰…¹¬¤ì(€€€€€É•¹‘•È ¤ì(€€€ô¤°(€€¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µÉÕ±•tˆ¤¹™½É…  ¡Œ¤€ôø(€€€Œ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¡…¹”ˆ°€ ¤€ôøì(€€€€€¹Í•ÑÑ¥¹Ì¹ÉÕ±•ÍmŒ¹‘…Ñ…Í•Ð¹ÉÕ±•t€ôŒ¹¡•­•ì(€€€€€MÑ½É”¹‘…Ñ„¹Í•ÑÑ¥¹Ì€ôì€¸¸¹¹Í•ÑÑ¥¹Ìôì(€€€€€MÑ½É”¹Á•ÉÍ¥ÍÐ ¤ì(€€€€€±½Ñ¥½¸ ‰ÕÁ‘…Ñ”ˆ°€‰ÉÕ±•}ÁÉ•Í•Ðˆ°Œ¹‘…Ñ…Í•Ð¹ÉÕ±”°Œ¹¡•­•€ü€‹‚æ‚âo‚âÓ‚âPˆ€è€‹‚âo‚âÓ‚âPˆ¤ì(€€€€€Ñ½…ÍÐ ‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âË‚â‚âW‚âÇ‚æ'‚â‚â‚æ#‚âË‚â‚â;‚æ‚â—‚æ'‚âœˆ¤ì(€€€€€É•¹½Éµ…±¥é•±° ¤ì(€€€€€Í¡•‘Õ±•ÕÑ½I•½¹¥±” ‹‚æ‚âo‚â—‚â×‚æ#‚â‹‚âg‚â‚â;‚â‚âË‚â‚â_‚âÏ‚â‚âË‚âdˆ¤ì(€€€ô¤°(€€¤ì)ôì()Y%]Ml…½Õ¹Ðµ¡½±‘Ìt€ô€¡É½½Ð¤€ôø½Õ¹ÑI•Ù¥•Ý!½±‘Ì¹µ½Õ¹Ñ5…¹…•È¡É½½Ð±ì(€…Ñ½Èè ¤ôùMˆ¹…ÕÑ¡UÍ•È ¤ü¹¥°(€É½±”è ¤ôùÍÑ…Ñ”¹É½±”°(€Ñ½‘…äéAI=}Q=d°(€½µÁ…¹¥•ÌéMˆ¹É•Ù¥•Ý!½±‘I•¥ÍÑÉå½µÁ…¹¥•Ì°(€…½Õ¹ÑÌéMˆ¹‰…¹­½Õ¹ÑI•¥ÍÑÉåI½ÝÌ°(€µ…¹…•½Õ¹ÐéMˆ¹µ…¹…•	…¹­½Õ¹ÑI•¥ÍÑÉä°(€Í½Á•ÌéMˆ¹É•Ù¥•Ý!½±‘M½Á•Ì°(€Í…Ù”éMˆ¹µ…¹…•½Õ¹ÑI•Ù¥•Ý!½±°)ô¤ì((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€Y%\èUÍ•ÉÌ€˜Á•Éµ¥ÍÍ¥½¸(€€€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼)Y%]Ml…Í”µÍ•ÑÑ¥¹Ìt€ô€¡É½½Ð¤€ôø…Í•±½ÍÕÉ”¹µ½Õ¹ÑM•ÑÑ¥¹Ì¡É½½Ð¤ì)Y%]L¹ÕÍ•ÉÌ€ô…Íå¹Œ€¡É½½Ð¤€ôøì(€¥˜¡ÍÑ…Ñ”¹É½±”ôôô±•…œ¥ì(€€€É½½Ð¹¥¹¹•É!Q50ôœñ‘¥Ø±…ÍÌô‰™•…ÑÕÉ”µÝ½É­ÍÁ…”ˆ¥ô‰Í½Á•‘UÍ•ÉÍ!½ÍÐˆøð½‘¥Øøœì(€€€M½Á•‘UÍ•É5…¹…•µ•¹Ð¹µ½Õ¹Ð¡É½½Ð¹ÅÕ•ÉåM•±•Ñ½È œÍ½Á•‘UÍ•ÉÍ!½ÍÐœ¤±í…Ñ½Èè ¤ôùMˆ¹…ÕÑ¡UÍ•È ¤ü¹¥±É½±”è ¤ôùÍÑ…Ñ”¹É½±”±±½…éMˆ¹±•…‘UÍ•É5…¹…•µ•¹Ñ½¹Ñ•áÐ±ÕÁ‘…Ñ”éMˆ¹±•…‘UÁ‘…Ñ•UÍ•É•ÍÌ±É•…Ñ”éMˆ¹±•…‘É•…Ñ•UÍ•Éô¤ì(€€€É•ÑÕÉ¸ì(€ô(€½¹ÍÐ…ÁÌ€ôl(€€€l‰Ù¥•Üˆ°€‹‚âS‚âç‚â¯‚âg‚æ'‚âË‚â_‚â×‚æ#‚æ‚âS‚æ'‚â‚âÇ‚âk‚â«‚âÓ‚â_‚âc‚âÓ‚æ0€¼‘…Í¡‰½…É‰t°(€€€l‰¹½Ñ”ˆ°€‹‚æ‚â«‚æ ¹½Ñ”‰t°(€€€l‰ÍÑ…ÑÕÌˆ°€‹‚æ‚âo‚â—‚â×‚æ#‚â‹‚âg‚â«‚â[‚âË‚âg‚âÀ‰t°(€€€l‰É•ÅÕ•ÍÑ}±…É¥™äˆ°€‹‚â«‚æ#‚â‚æ‚â¯‚æ'‚â+‚â×‚æ'‚æ‚â#‚â‰t°(€€€l‰É•ÍÁ½¹ˆ°€‹‚âW‚â·‚âk‚â+‚â×‚æ'‚æ‚â#‚â‰t°(€€€l‰…ÑÑ… ˆ°€‹‚æ‚âg‚âk‚â¯‚â—‚âÇ‚â‚âC‚âË‚âd‰t°(€€€l‰…ÁÁÉ½Ù”ˆ°€‹‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÐ‰t°(€€€l‰±½Í•}…Í”ˆ°€‹‚âo‚âÓ‚âS‚æ‚â‚â¨‰t°(€€€l‰±½Í•}å±”ˆ°€‹‚âo‚âÓ‚âS‚â‚â·‚âk‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆ‰t°(€€€l‰ÉÕ±•Ìˆ°€‹‚æ‚â‚æ$ÉÕ±”€¼Ñ½±•É…¹”‰t°(€€€l‰ÕÍ•ÉÌˆ°€‹‚â#‚âÇ‚âS‚â‚âË‚â‚âs‚âç‚æ'‚æ‚â+‚æ$‰t°(€€€l‰Í•ÑÑ¥¹Ìˆ°€‹‚âW‚âÇ‚æ'‚â‚â‚æ#‚âË‚â‚âÃ‚âk‚âh‰t°(€€€l‰•áÁ½ÉÐˆ°€‰•áÁ½ÉÐƒ‚â‚âË‚â‹‚â‚âË‚âd‰t°(€tì(€É½½Ð¹¥¹¹•É!Q50€ô€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆøñ‘¥Ø±…ÍÌô‰±½…‘¥¹œµ‰±½¬ˆøñÍÁ…¸±…ÍÌô‰ÍÁ¥¹¹•Èˆøð½ÍÁ…¸øñÍÑÉ½¹œû‚â‚âÏ‚â—‚âÇ‚â‚æ‚â¯‚â—‚âS‚âs‚âç‚æ'‚æ‚â+‚æ'‚æ‚â—‚âÃ‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚â#‚â‚âÓ‚â‚â#‚âË‚âMÕÁ…‰…Í”ð½ÍÑÉ½¹œøð½‘¥Øøð½Í•Ñ¥½¸ù€ì(€±•ÐÕÍ•ÉÌ€ômtì(€±•Ð±½…‘ÉÉ½È€ô€ˆˆì(€ÑÉäì(€€€ÕÍ•ÉÌ€ô…Ý…¥ÐMˆ¹…‘µ¥¹UÍ•É•ÍÌ ¤ì(€€€¥˜€ …ÉÉ…ä¹¥ÍÉÉ…ä¡ÕÍ•ÉÌ¤¤ÕÍ•ÉÌ€ôÕÍ•ÉÌ€ümÕÍ•ÉÍt€èmtì(€ô…Ñ €¡•ÉÉ½È¤ì(€€€±½…‘ÉÉ½È€ô•ÉÉ½È¹µ•ÍÍ…”ñð€‹‚æ‚â¯‚â—‚âS‚âs‚âç‚æ'‚æ‚â+‚æ'‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ˆì(€ô(€É½½Ð¹¥¹¹•É!Q50€ô€(€€€€‘í±½…‘ÉÉ½È€ü€ñÍ•Ñ¥½¸±…ÍÌô‰…±•ÉÐÝ…É¸ˆøñÍÑÉ½¹œû‚â‹‚âÇ‚â‚æ‚â¯‚â—‚âS‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚âs‚âç‚æ'‚æ‚â+‚æ'‚æ‚â‡‚æ#‚æ‚âS‚æ$ð½ÍÑÉ½¹œøñÍÁ…¸ø‘í ¡±½…‘ÉÉ½È¥ôð½ÍÁ…¸øð½Í•Ñ¥½¸ù€€è€ˆ‰ô(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°…•ÍÌµ…‘µ¥¸µÁ…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùUÍ•È…•ÍÌð½Àøñ È¥ô‰…•ÍÍ½ÉµQ¥Ñ±”ˆû‚æ‚â{‚âÓ‚æ#‚â‡‚âs‚âç‚æ'‚æ‚â+‚æ'‚æ‚â¯‚â‡‚æ ð½ ÈøñÍµ…±°±…ÍÌô‰¡•…µÍÕˆˆû‚â‚â‚â·‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚â‚â‚âÇ‚æ'‚â‚æ‚âS‚â×‚â‹‚âœƒ‚â‚âÃ‚âk‚âk‚â#‚âÃ‚â«‚æ#‚â‚â·‚â×‚æ‚â‡‚â—‚æ‚â+‚âÓ‚â7‚æ‚â‚æ'‚âË‚æ‚â+‚æ'‚â‚âË‚âg‚æ‚â—‚âÃ‚â‚âÏ‚â¯‚âg‚âS‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚æ‚â¯‚æ'‚â_‚âÇ‚âg‚â_‚âÔƒ‚æ‚â‡‚æ#‚âW‚æ'‚â·‚â‚æ‚âo‚âÓ‚âS‚â¯‚âg‚æ'‚âÈMÕÁ…‰…Í”ð½Íµ…±°øð½‘¥Øø(€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆ¥ô‰¹•Ý•ÍÍUÍ•Èˆø¬ƒ‚æ‚â{‚âÓ‚æ#‚â‡‚âs‚âç‚æ'‚æ‚â+‚æ$ð½‰ÕÑÑ½¸øð½‘¥Øø(€€€€€€ñ™½É´¥ô‰…•ÍÍUÍ•É½É´ˆ±…ÍÌô‰…•ÍÌµÕÍ•Èµ™½É´ˆø(€€€€€€€€ñÀ¥ô‰…•ÍÍ½ÉµÉÉ½Èˆ±…ÍÌô‰™½É´µ•ÉÉ½ÈˆÉ½±”ô‰…±•ÉÐˆÑ…‰¥¹‘•àôˆ´Äˆ¡¥‘‘•¸øð½Àø(€€€€€€€€ñ±…‰•°û‚âŸ‚âÓ‚âc‚â×‚â«‚â‚æ'‚âË‚â‚âk‚âÇ‚â7‚â+‚âÔñÍ•±•Ð¥ô‰…•ÍÍ1½¥¹5½‘”ˆøñ½ÁÑ¥½¸Ù…±Õ”ô‰•µ…¥°ˆû‚â·‚â×‚æ‚â‡‚â”€¼ƒ‚â«‚æ#‚â‚â‚âÏ‚æ‚â+‚âÓ‚â4ð½½ÁÑ¥½¸øñ½ÁÑ¥½¸Ù…±Õ”ô‰ÕÍ•É¹…µ”ˆû‚â+‚âß‚æ#‚â·‚âs‚âç‚æ'‚æ‚â+‚æ$€¼ƒ‚æ‚â‡‚æ#‚æ‚â+‚æ'‚â·‚â×‚æ‚â‡‚â”ð½½ÁÑ¥½¸øð½Í•±•Ðøð½±…‰•°ø(€€€€€€€€ñ±…‰•°øñÍÁ…¸¥ô‰…•ÍÍ%‘•¹Ñ¥Ñå1…‰•°ˆû‚â·‚â×‚æ‚â‡‚â”ð½ÍÁ…¸øñ¥¹ÁÕÐ¥ô‰…•ÍÍµ…¥°ˆÑåÁ”ô‰•µ…¥°ˆÉ•ÅÕ¥É•Á±…•¡½±‘•Èô‰¹…µ•½µÁ…¹ä¹½´ˆ…ÕÑ½½µÁ±•Ñ”ô‰½™˜ˆøð½±…‰•°ø(€€€€€€€€ñ±…‰•°¥ô‰…•ÍÍA…ÍÍÝ½É‘1…‰•°ˆ¡¥‘‘•¸û‚â‚â¯‚âÇ‚â«‚âs‚æ#‚âË‚âg‚âk‚âÇ‚â7‚â+‚â×‚æ‚â¯‚â‡‚æ ñ¥¹ÁÕÐ¥ô‰…•ÍÍA…ÍÍÝ½ÉˆÑåÁ”ô‰Á…ÍÍÝ½Éˆ…ÕÑ½½µÁ±•Ñ”ô‰¹•ÜµÁ…ÍÍÝ½Éˆµ¥¹±•¹Ñ ôˆäˆµ…á±•¹Ñ ôˆÄÈàˆøñÍµ…±°û‚â·‚â‹‚æ#‚âË‚â‚âg‚æ'‚â·‚âˆ€äƒ‚âW‚âÇ‚âœƒ‚â‡‚â×‚âW‚âÇ‚âŸ‚â·‚âÇ‚â‚â§‚â‚æ‚â—‚âÃ‚âW‚âÇ‚âŸ‚æ‚â—‚âƒ‚æ‚â‡‚æ#‚æ‚â+‚æ'‚â‚â¯‚âÇ‚â«‚æ‚âS‚â×‚â‹‚âŸ‚â‚âÇ‚âk‚âk‚âÇ‚â7‚â+‚â×‚â·‚âß‚æ#‚âdð½Íµ…±°øð½±…‰•°ø(€€€€€€€€ñ±…‰•°û‚â+‚âß‚æ#‚â·‚â_‚â×‚æ#‚æ‚â«‚âS‚âñ¥¹ÁÕÐ¥ô‰…•ÍÍ9…µ”ˆÑåÁ”ô‰Ñ•áÐˆÉ•ÅÕ¥É•Á±…•¡½±‘•Èô‹‚â+‚âß‚æ#‚â´·‚âg‚âË‚â‡‚â«‚â‚âã‚â”ˆøð½±…‰•°ø(€€€€€€€€ñ±…‰•°û‚âk‚â_‚âk‚âË‚â\ñÍ•±•Ð¥ô‰…•ÍÍI½±”ˆø‘í=‰©•Ð¹•¹ÑÉ¥•Ì¡¹É½±•Ì¤¹µ…À ¡m­•ä°É½±•t¤€ôø€ñ½ÁÑ¥½¸Ù…±Õ”ôˆ‘í­•åôˆø‘í ¡É½±”¹¹…µ”¥ôð½½ÁÑ¥½¸ù€¤¹©½¥¸ ˆˆ¥ôð½Í•±•Ðøð½±…‰•°ø(€€€€€€€€ñ±…‰•°±…ÍÌô‰…•ÍÌµ…Ñ¥Ù”ˆøñ¥¹ÁÕÐ¥ô‰…•ÍÍÑ¥Ù”ˆÑåÁ”ô‰¡•­‰½àˆ¡•­•øƒ‚æ‚âo‚âÓ‚âS‚æ‚â+‚æ'‚â‚âË‚âdð½±…‰•°ø(€€€€€€€€ñ™¥•±‘Í•Ðøñ±••¹û‚âk‚â‚âÓ‚â§‚âÇ‚â_‚â_‚â×‚æ#‚â‚âÇ‚âk‚âs‚âÓ‚âS‚â+‚â·‚âhð½±••¹øñ‘¥Ø±…ÍÌô‰½µÁ…¹äµ…•ÍÌµÉ¥ˆø(€€€€€€€€€€‘í½µÁ…¹å5…ÍÑ•È ¤¹µ…À ¡½µÁ…¹ä¤€ôø€ñ±…‰•°øñ¥¹ÁÕÐÑåÁ”ô‰¡•­‰½àˆ¹…µ”ô‰…•ÍÍ½µÁ…¹äˆÙ…±Õ”ôˆ‘í ¡½µÁ…¹ä¹½‘”¥ôˆø€‘í ¡½µÁ…¹ä¹½‘”¥ôð½±…‰•°ù€¤¹©½¥¸ ˆˆ¥ô(€€€€€€€€ð½‘¥ØøñÍµ…±°ùÕ‘¥Ð1•…°ƒ‚âs‚âç‚æ'‚âk‚â‚âÓ‚â¯‚âË‚âŒƒ‚æ‚â—‚âÃ‚âs‚âç‚æ'‚âS‚âç‚æ‚â—‚â‚âÃ‚âk‚âk‚æ‚â¯‚æ‚âg‚â_‚âã‚â‚âk‚â‚âÓ‚â§‚âÇ‚â_‚æ‚âS‚â‹‚âW‚âÏ‚æ‚â¯‚âg‚æ#‚â‚â·‚â‹‚âç‚æ#‚æ‚â—‚æ'‚âœð½Íµ…±°øð½™¥•±‘Í•Ðø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰…•ÍÌµÍÕ‰µ¥ÐˆøñÍµ…±°¥ô‰…•ÍÍMÕ‰µ¥Ñ!¥¹Ðˆû‚âs‚âç‚æ'‚æ‚â+‚æ'‚æ‚â¯‚â‡‚æ#‚â#‚âÃ‚æ‚âS‚æ'‚â‚âÇ‚âk‚â·‚â×‚æ‚â‡‚â—‚æ‚â+‚âÓ‚â7‚æ‚â{‚âß‚æ#‚â·‚âW‚âÇ‚æ'‚â‚â‚â¯‚âÇ‚â«‚âs‚æ#‚âË‚âdð½Íµ…±°øñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆÑåÁ”ô‰ÍÕ‰µ¥Ðˆû‚â«‚æ#‚â‚â‚âÏ‚æ‚â+‚âÓ‚â7‚æ‚â—‚âÃ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â«‚âÓ‚â_‚âc‚âÓ‚æ0ð½‰ÕÑÑ½¸øð½‘¥Øø(€€€€€€ð½™½É´ø(€€€€ð½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùA•Éµ¥ÍÍ¥½¸5…ÑÉ¥àð½Àøñ Èû‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚âW‚âË‚â‡‚âk‚â_‚âk‚âË‚â\ð½ Èøð½‘¥Øø(€€€€€€ñÍÁ…¸±…ÍÌô‰¡•…±Ñ ½¬ˆû‚æ‚â‡‚æ#‚â‡‚â×‚âk‚â_‚âk‚âË‚â_‚æ‚âS‚â—‚âk‚â‚æ'‚â·‚â‡‚âç‚â—‚æ‚âS‚æ$ð½ÍÁ…¸øð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…Àˆø(€€€€€€€€ñÑ…‰±”±…ÍÌô‰µ…ÑÉ¥àˆø(€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ û‚â‚âŸ‚âË‚â‡‚â«‚âË‚â‡‚âË‚â‚âXð½Ñ ø‘í=‰©•Ð¹Ù…±Õ•Ì¡¹É½±•Ì¤¹µ…À ¡È¤€ôø€ñÑ ±…ÍÌô‰•¹Ñ•Èˆø‘í ¡È¹¹…µ”¥ôð½Ñ ù€¤¹©½¥¸ ˆˆ¥ôð½ÑÈøð½Ñ¡•…ø(€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€€‘í…ÁÌ(€€€€€€€€€€€€€€¹µ…À (€€€€€€€€€€€€€€€€¡m¬°±…‰•±t¤€ôø(€€€€€€€€€€€€€€€€€€ñÑÈøñÑø‘í ¡±…‰•°¥ôð½Ñø‘í=‰©•Ð¹­•åÌ¡¹É½±•Ì¤(€€€€€€€€€€€€€€€€€€€€¹µ…À ¡É¬¤€ôø€ñÑ±…ÍÌô‰•¹Ñ•Èˆø‘í¹É½±•ÍmÉ­t¹…¸¹¥¹±Õ‘•Ì¡¬¤€ü€œñÍÁ…¸±…ÍÌô‰å•ÌˆûŠrLð½ÍÁ…¸øœ€è€œñÍÁ…¸±…ÍÌô‰¹¼ˆûŠLð½ÍÁ…¸øôð½Ñù€¤(€€€€€€€€€€€€€€€€€€€€¹©½¥¸ ˆˆ¥ôð½ÑÈù€°(€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€¹©½¥¸ ˆˆ¥ô(€€€€€€€€€€€€ñÑÈ±…ÍÌô‰‘•¹äµÉ½ÜˆøñÑû‚â—‚âhÑÉ…¹Í…Ñ¥½¸€¼ƒ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdð½Ñø‘í=‰©•Ð¹­•åÌ¡¹É½±•Ì¤¹µ…À  ¤€ôø€ñÑ±…ÍÌô‰•¹Ñ•ÈˆøñÍÁ…¸±…ÍÌô‰¹¼ˆûŠrTð½ÍÁ…¸øð½Ñù€¤¹©½¥¸ ˆˆ¥ôð½ÑÈø(€€€€€€€€€€ð½Ñ‰½‘äø(€€€€€€€€ð½Ñ…‰±”ø(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùUÍ•ÉÌð½Àøñ Èû‚âs‚âç‚æ'‚æ‚â+‚æ'‚â‚âË‚âg‚æ‚âg‚â‚âÃ‚âk‚âhð½ Èøð½‘¥Øøð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…Àˆø(€€€€€€€€ñÑ…‰±”ø(€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ û‚â+‚âß‚æ#‚â·‚âs‚âç‚æ'‚æ‚â+‚æ$€¼ƒ‚â·‚â×‚æ‚â‡‚â”ð½Ñ øñÑ û‚â+‚âß‚æ#‚â´ð½Ñ øñÑ û‚âk‚â_‚âk‚âË‚â\ð½Ñ øñÑ û‚âk‚â‚âÓ‚â§‚âÇ‚â_‚â_‚â×‚æ#‚â‚âÇ‚âk‚âs‚âÓ‚âS‚â+‚â·‚âhð½Ñ øñÑ û‚â«‚â[‚âË‚âg‚âÀð½Ñ øð½ÑÈøð½Ñ¡•…ø(€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€€‘íÕÍ•ÉÌ(€€€€€€€€€€€€€€¹µ…À (€€€€€€€€€€€€€€€€¡Ô¤€ôø€ñÑÈ±…ÍÌô‰…•ÍÌµÕÍ•ÈµÉ½Üˆ‘…Ñ„µ•µ…¥°ôˆ‘í ¡Ô¹•µ…¥°¥ôˆøñÑ±…ÍÌô‰µ½¹¼ˆø‘í ¡Mˆ¹‘¥ÍÁ±…å1½¥¸¡Ô¹•µ…¥°¤¥ôð½ÑøñÑø‘í ¡Ô¹™Õ±±}¹…µ”ñð€ˆ´ˆ¥ôð½Ñø(€€€€€€€€€€€€€€ñÑøñÍÁ…¸±…ÍÌô‰‰…‘”‰±Õ”ˆø‘í ¡¹É½±•ÍmÔ¹É½±•tü¹¹…µ”ñðÔ¹É½±”¥ôð½ÍÁ…¸øð½Ñø(€€€€€€€€€€€€€€ñÑø‘ì¡Ô¹½µÁ…¹¥•Ìñðmt¤¹±•¹Ñ €ü€¡Ô¹½µÁ…¹¥•Ìñðmt¤¹µ…À ¡½µÁ…¹ä¤€ôø€ñÍÁ…¸±…ÍÌô‰‰…‘”ˆø‘í ¡½µÁ…¹ä¥ôð½ÍÁ…¸ù€¤¹©½¥¸ ˆ€ˆ¤€è€œñÍÁ…¸±…ÍÌô‰µÕÑ•ˆû‚â_‚âã‚â‚âk‚â‚âÓ‚â§‚âÇ‚â_‚âW‚âË‚â‡‚âk‚â_‚âk‚âË‚â\ð½ÍÁ…¸øôð½Ñø(€€€€€€€€€€€€€€ñÑø‘íÔ¹…Ñ¥Ù”€ü€œñÍÁ…¸±…ÍÌô‰‰…‘”É••¸ˆû‚æ‚â+‚æ'‚â‚âË‚âdð½ÍÁ…¸øœ€è€œñÍÁ…¸±…ÍÌô‰‰…‘”É•ˆû‚â‚âÃ‚â‚âÇ‚âhð½ÍÁ…¸øôð½Ñøð½ÑÈù€°(€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€¹©½¥¸ ˆˆ¤ñð€ñÑÈøñÑ½±ÍÁ…¸ôˆÔˆ±…ÍÌô‰•µÁÑäˆû‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚âs‚âç‚æ'‚æ‚â+‚æ'‚æ‚âg‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚â«‚âÓ‚â_‚âc‚âÓ‚æ0ð½Ñøð½ÑÈùô(€€€€€€€€€€ð½Ñ‰½‘äø(€€€€€€€€ð½Ñ…‰±”ø(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ù€ì((€¥˜¡ÍÑ…Ñ”¹É½±”ôôô…‘µ¥¸œ¥ì(€€€½¹ÍÐÁ…ÍÍÝ½É‘!½ÍÐõ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‘¥Øœ¤íÉ½½Ð¹ÁÉ•Á•¹¡Á…ÍÍÝ½É‘!½ÍÐ¤ì(€€€A…ÍÍÝ½É‘½Õ¹ÑÌ¹µ½Õ¹Ð¡Á…ÍÍÝ½É‘!½ÍÐ±íÕÍ•ÉÌ±½µÁ…¹¥•Ìé½µÁ…¹å5…ÍÑ•È ¤¹µ…À¡ŒôùŒ¹½‘”¤±…Ñ½Èè ¤ôùMˆ¹…ÕÑ¡UÍ•È ¤ü¹¥±É½±”è ¤ôùÍÑ…Ñ”¹É½±”±…±°éMˆ¹Á…ÍÍÝ½É‘½Õ¹Ñô¤ì(€ô(€½¹ÍÐÍ•Ñ•ÍÍ5½‘”€ô€¡•‘¥Ñ¥¹œõ™…±Í”¤€ôøì(€€€½¹ÍÐÕÍ•É¹…µ”€ô€ œ…•ÍÍ1½¥¹5½‘”œ¤¹Ù…±Õ”€ôôô€ÕÍ•É¹…µ”œì(€€€€ œ…•ÍÍµ…¥°œ¤¹ÑåÁ”€ôÕÍ•É¹…µ”€ü€Ñ•áÐœ€è€•µ…¥°œì(€€€€ œ…•ÍÍ%‘•¹Ñ¥Ñå1…‰•°œ¤¹Ñ•áÑ½¹Ñ•¹Ð€ôÕÍ•É¹…µ”€ü€Ÿ‚â+‚âß‚æ#‚â·‚âs‚âç‚æ'‚æ‚â+‚æ$œ€è€Ÿ‚â·‚â×‚æ‚â‡‚â”œì(€€€€ œ…•ÍÍµ…¥°œ¤¹Á±…•¡½±‘•È€ôÕÍ•É¹…µ”€ü€Ÿ‚â+‚âß‚æ#‚â·‚âs‚âç‚æ'‚æ‚â+‚æ$œ€è€¹…µ•½µÁ…¹ä¹½´œì(€€€€ œ…•ÍÍA…ÍÍÝ½É‘1…‰•°œ¤¹¡¥‘‘•¸€ô€…ÕÍ•É¹…µ”ñð•‘¥Ñ¥¹œì(€€€€ œ…•ÍÍA…ÍÍÝ½Éœ¤¹É•ÅÕ¥É•€ôÕÍ•É¹…µ”€˜˜€…•‘¥Ñ¥¹œì(€€€€ œ…•ÍÍA…ÍÍÝ½Éœ¤¹‘¥Í…‰±•€ô€…ÕÍ•É¹…µ”ñð•‘¥Ñ¥¹œì(€€€€ œ…•ÍÍMÕ‰µ¥Ñ!¥¹Ðœ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô•‘¥Ñ¥¹œ€ü€Ÿ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚æ‚âS‚â‹‚æ‚â‡‚æ#‚æ‚âo‚â—‚â×‚æ#‚â‹‚âg‚â‚â¯‚âÇ‚â«‚âs‚æ#‚âË‚âdœ€èÕÍ•É¹…µ”€ü€Ÿ‚â«‚â‚æ'‚âË‚â‚â+‚âß‚æ#‚â·‚âs‚âç‚æ'‚æ‚â+‚æ'‚â_‚âÇ‚âg‚â_‚âÔƒ‚æ‚â‡‚æ#‚â«‚æ#‚â‚â·‚â×‚æ‚â‡‚â”€¼ƒ‚â—‚âß‚â‡‚â‚â¯‚âÇ‚â«‚âs‚æ#‚âË‚âg‚æ‚â¯‚æ'‚âW‚âÓ‚âS‚âW‚æ#‚â·‚âs‚âç‚æ'‚âS‚âç‚æ‚â”œ€è€Ÿ‚âs‚âç‚æ'‚æ‚â+‚æ'‚æ‚â¯‚â‡‚æ#‚â#‚âÃ‚æ‚âS‚æ'‚â‚âÇ‚âk‚â·‚â×‚æ‚â‡‚â—‚æ‚â+‚âÓ‚â7‚æ‚â{‚âß‚æ#‚â·‚âW‚âÇ‚æ'‚â‚â‚â¯‚âÇ‚â«‚âs‚æ#‚âË‚âdœì(€€€€ ˆ…•ÍÍUÍ•É½É´‰ÕÑÑ½¹mÑåÁ”ôÍÕ‰µ¥Ðtˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô•‘¥Ñ¥¹œ€ü€Ÿ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âË‚â‚æ‚âo‚â—‚â×‚æ#‚â‹‚âg‚æ‚âo‚â—‚âœ€èÕÍ•É¹…µ”€ü€Ÿ‚â«‚â‚æ'‚âË‚â‚âs‚âç‚æ'‚æ‚â+‚æ'‚æ‚â—‚âÃ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â«‚âÓ‚â_‚âc‚âÓ‚æ0œ€è€Ÿ‚â«‚æ#‚â‚â‚âÏ‚æ‚â+‚âÓ‚â7‚æ‚â—‚âÃ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â«‚âÓ‚â_‚âc‚âÓ‚æ0œì(€ôì(€€ œ…•ÍÍ1½¥¹5½‘”œ¤¹½¹¡…¹”€ô€ ¤€ôøì€ œ…•ÍÍA…ÍÍÝ½Éœ¤¹Ù…±Õ”ôœœìÍ•Ñ•ÍÍ5½‘” ¤ìôì(€½¹ÍÐÉ•Í•Ñ•ÍÍ½É´€ô€ ¤€ôøì(€€€€ ˆ…•ÍÍUÍ•É½É´ˆ¤¹É•Í•Ð ¤ì(€€€€ ˆ…•ÍÍÑ¥Ù”ˆ¤¹¡•­•€ôÑÉÕ”ì(€€€€ ˆ…•ÍÍI½±”ˆ¤¹Ù…±Õ”€ô€‰µ½¹¥Ñ½Èˆì(€€€€ ˆ…•ÍÍµ…¥°ˆ¤¹É•…‘=¹±ä€ô™…±Í”ì(€€€€ œ…•ÍÍ1½¥¹5½‘”œ¤¹‘¥Í…‰±•õ™…±Í”ì(€€€Í•Ñ•ÍÍ5½‘” ¤ì(€€€€ ˆ…•ÍÍ½ÉµQ¥Ñ±”ˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô€‹‚æ‚â{‚âÓ‚æ#‚â‡‚âs‚âç‚æ'‚æ‚â+‚æ'‚æ‚â¯‚â‡‚æ ˆì(€€€€ ˆ…•ÍÍMÕ‰µ¥Ñ!¥¹Ðˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô€‹‚âs‚âç‚æ'‚æ‚â+‚æ'‚æ‚â¯‚â‡‚æ#‚â#‚âÃ‚æ‚âS‚æ'‚â‚âÇ‚âk‚â·‚â×‚æ‚â‡‚â—‚æ‚â+‚âÓ‚â7‚æ‚â{‚âß‚æ#‚â·‚âW‚âÇ‚æ'‚â‚â‚â¯‚âÇ‚â«‚âs‚æ#‚âË‚âdˆì(€€€€ ˆ…•ÍÍUÍ•É½É´‰ÕÑÑ½¹mÑåÁ”ôÍÕ‰µ¥Ðtˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô€‹‚â«‚æ#‚â‚â‚âÏ‚æ‚â+‚âÓ‚â7‚æ‚â—‚âÃ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â«‚âÓ‚â_‚âc‚âÓ‚æ0ˆì(€ôì(€€ ˆ¹•Ý•ÍÍUÍ•Èˆ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€É•Í•Ñ•ÍÍ½É´ ¤ì(€€€€ ˆ…•ÍÍµ…¥°ˆ¤¹™½ÕÌ ¤ì(€ô¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ˆ¹…•ÍÌµÕÍ•ÈµÉ½Üˆ¤¹™½É…  ¡É½Ü¤€ôøÉ½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€½¹ÍÐÕÍ•È€ôÕÍ•ÉÌ¹™¥¹ ¡¥Ñ•´¤€ôø¥Ñ•´¹•µ…¥°€ôôôÉ½Ü¹‘…Ñ…Í•Ð¹•µ…¥°¤ì(€€€¥˜€ …ÕÍ•È¤É•ÑÕÉ¸ì(€€€€ œ…•ÍÍ1½¥¹5½‘”œ¤¹Ù…±Õ”€ôMˆ¹‘¥ÍÁ±…å1½¥¸¡ÕÍ•È¹•µ…¥°¤€ôôôÕÍ•È¹•µ…¥°€ü€•µ…¥°œ€è€ÕÍ•É¹…µ”œì(€€€€ œ…•ÍÍ1½¥¹5½‘”œ¤¹‘¥Í…‰±•õÑÉÕ”ì(€€€€ ˆ…•ÍÍµ…¥°ˆ¤¹Ù…±Õ”€ôMˆ¹‘¥ÍÁ±…å1½¥¸¡ÕÍ•È¹•µ…¥°¤ì(€€€€ œ…•ÍÍA…ÍÍÝ½Éœ¤¹Ù…±Õ”ôœœì(€€€Í•Ñ•ÍÍ5½‘”¡ÑÉÕ”¤ì(€€€€ ˆ…•ÍÍ9…µ”ˆ¤¹Ù…±Õ”€ôÕÍ•È¹™Õ±±}¹…µ”ñð€ˆˆì(€€€€ ˆ…•ÍÍI½±”ˆ¤¹Ù…±Õ”€ôÕÍ•È¹É½±”ñð€‰µ½¹¥Ñ½Èˆì(€€€€ ˆ…•ÍÍÑ¥Ù”ˆ¤¹¡•­•€ôÕÍ•È¹…Ñ¥Ù”€„ôô™…±Í”ì(€€€€ ˆ…•ÍÍµ…¥°ˆ¤¹É•…‘=¹±ä€ôÑÉÕ”ì(€€€€ ˆ…•ÍÍ½ÉµQ¥Ñ±”ˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô€‹‚æ‚â‚æ'‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚âs‚âç‚æ'‚æ‚â+‚æ$ˆì(€€€€ ˆ…•ÍÍMÕ‰µ¥Ñ!¥¹Ðˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô€‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âË‚â‚æ‚âo‚â—‚â×‚æ#‚â‹‚âg‚æ‚âo‚â—‚â‚æ‚âS‚â‹‚æ‚â‡‚æ#‚â«‚æ#‚â‚â‚âÏ‚æ‚â+‚âÓ‚â7‚â/‚æ'‚âÌˆì(€€€€ ˆ…•ÍÍUÍ•É½É´‰ÕÑÑ½¹mÑåÁ”ôÍÕ‰µ¥Ðtˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô€‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âË‚â‚æ‚âo‚â—‚â×‚æ#‚â‹‚âg‚æ‚âo‚â—‚âˆì(€€€½¹ÍÐÍ•±•Ñ•€ô¹•ÜM•Ð¡ÕÍ•È¹½µÁ…¹¥•Ìñðmt¤ì(€€€€ m¹…µ”ô‰…•ÍÍ½µÁ…¹ä‰tœ°É½½Ð¤¹™½É…  ¡‰½à¤€ôøì‰½à¹¡•­•€ôÍ•±•Ñ•¹¡…Ì¡‰½à¹Ù…±Õ”¤ìô¤ì(€€€€ ˆ…•ÍÍµ…¥°ˆ¤¹ÍÉ½±±%¹Ñ½Y¥•Ü¡ì‰•¡…Ù¥½Èè€‰Íµ½½Ñ ˆ°‰±½¬è€‰•¹Ñ•Èˆô¤ì(€ô¤¤ì(€€ ˆ…•ÍÍUÍ•É½É´ˆ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰ÍÕ‰µ¥Ðˆ°…Íå¹Œ€¡•Ù•¹Ð¤€ôøì(€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€½¹ÍÐ‰ÕÑÑ½¸€ô•Ù•¹Ð¹ÍÕ‰µ¥ÑÑ•Èì(€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ôÑÉÕ”ì(€€€‰ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô€‹‚â‚âÏ‚â—‚âÇ‚â‚âk‚âÇ‚âg‚â_‚âÛ‚â¸¸¸ˆì(€€€€ œ…•ÍÍ½ÉµÉÉ½Èœ¤¹¡¥‘‘•¸€ôÑÉÕ”ì(€€€ÑÉäì(€€€€€½¹ÍÐ½µÁ…¹¥•Ì€ô€ m¹…µ”ô‰…•ÍÍ½µÁ…¹ä‰té¡•­•œ°É½½Ð¤¹µ…À ¡‰½à¤€ôø‰½à¹Ù…±Õ”¤ì(€€€€€½¹ÍÐÕÍ•É¹…µ•5½‘”€ô€ œ…•ÍÍ1½¥¹5½‘”œ¤¹Ù…±Õ”€ôôô€ÕÍ•É¹…µ”œì(€€€€€½¹ÍÐ¥‘•¹Ñ¥Ñä€ô€ ˆ…•ÍÍµ…¥°ˆ¤¹Ù…±Õ”¹ÑÉ¥´ ¤¹Ñ½1½Ý•É…Í” ¤ì(€€€€€½¹ÍÐ•µ…¥°€ôÕÍ•É¹…µ•5½‘”€üMˆ¹±½¥¹%‘•¹Ñ¥Ñä¡¥‘•¹Ñ¥Ñä¤€è¥‘•¹Ñ¥Ñäì(€€€€€½¹ÍÐ•á¥ÍÑ¥¹œ€ôÕÍ•ÉÌ¹Í½µ” ¡ÕÍ•È¤€ôøMÑÉ¥¹œ¡ÕÍ•È¹•µ…¥°ñð€ˆˆ¤¹Ñ½1½Ý•É…Í” ¤€ôôô•µ…¥°¤ì(€€€€€¥˜€¡•á¥ÍÑ¥¹œ¤ì(€€€€€€€…Ý…¥ÐMˆ¹…‘µ¥¹M…Ù•UÍ•É•ÍÌ¡•µ…¥°°€ ˆ…•ÍÍ9…µ”ˆ¤¹Ù…±Õ”°€ ˆ…•ÍÍI½±”ˆ¤¹Ù…±Õ”°€ ˆ…•ÍÍÑ¥Ù”ˆ¤¹¡•­•°½µÁ…¹¥•Ì¤ì(€€€€€ô•±Í”¥˜€¡ÕÍ•É¹…µ•5½‘”¤ì(€€€€€€€…Ý…¥ÐMˆ¹…‘µ¥¹É•…Ñ•UÍ•É¹…µ•UÍ•È¡¥‘•¹Ñ¥Ñä° œ…•ÍÍA…ÍÍÝ½Éœ¤¹Ù…±Õ”° œ…•ÍÍ9…µ”œ¤¹Ù…±Õ”° œ…•ÍÍI½±”œ¤¹Ù…±Õ”° œ…•ÍÍÑ¥Ù”œ¤¹¡•­•±½µÁ…¹¥•Ì¤ì(€€€€€€€€ œ…•ÍÍA…ÍÍÝ½Éœ¤¹Ù…±Õ”ôœœì(€€€€€ô•±Í”ì(€€€€€€€…Ý…¥ÐMˆ¹…‘µ¥¹%¹Ù¥Ñ•UÍ•È¡•µ…¥°°€ ˆ…•ÍÍ9…µ”ˆ¤¹Ù…±Õ”°€ ˆ…•ÍÍI½±”ˆ¤¹Ù…±Õ”°€ ˆ…•ÍÍÑ¥Ù”ˆ¤¹¡•­•°½µÁ…¹¥•Ì¤ì(€€€€€ô(€€€€€Ñ½…ÍÐ¡•á¥ÍÑ¥¹œ€ü€‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚âk‚â_‚âk‚âË‚â_‚æ‚â—‚âÃ‚âk‚â‚âÓ‚â§‚âÇ‚â_‚â_‚â×‚æ#‚â‚âÇ‚âk‚âs‚âÓ‚âS‚â+‚â·‚âk‚æ‚â—‚æ'‚âœˆ€èÕÍ•É¹…µ•5½‘”€ü€Ÿ‚â«‚â‚æ'‚âË‚â‚â+‚âß‚æ#‚â·‚âs‚âç‚æ'‚æ‚â+‚æ'‚æ‚â—‚âÃ‚â‚âÏ‚â¯‚âg‚âS‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚æ‚â—‚æ'‚âœœ€è€‹‚â«‚æ#‚â‚â·‚â×‚æ‚â‡‚â—‚æ‚â+‚âÓ‚â7‚æ‚â—‚âÃ‚â‚âÏ‚â¯‚âg‚âS‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚æ‚â—‚æ'‚âœˆ¤ì(€€€€€±½Ñ¥½¸ ‰ÕÁ‘…Ñ”ˆ°€‰ÕÍ•É}…•ÍÌˆ°€ ˆ…•ÍÍµ…¥°ˆ¤¹Ù…±Õ”°€‘ì ˆ…•ÍÍI½±”ˆ¤¹Ù…±Õ•ôƒ
Ü€‘í½µÁ…¹¥•Ì¹©½¥¸ ˆ°€ˆ¤ñð€‹‚â_‚âã‚â‚âk‚â‚âÓ‚â§‚âÇ‚â_‚âW‚âË‚â‡‚âk‚â_‚âk‚âË‚â\‰õ€¤ì(€€€€€Y%]L¹ÕÍ•ÉÌ¡É½½Ð¤ì(€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€½¹ÍÐ™••‘‰…¬€ô€ œ…•ÍÍ½ÉµÉÉ½Èœ¤ì(€€€€€™••‘‰…¬¹Ñ•áÑ½¹Ñ•¹Ð€ô€Ÿ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â è€œ€¬•ÉÉ½È¹µ•ÍÍ…”€¬€œƒŠPƒ‚â‚æ'‚â·‚â‡‚âç‚â—‚æ‚âg‚â‚â·‚â‚æ3‚â‡‚â‹‚âÇ‚â‚â·‚â‹‚âç‚æ ƒ‚â‚â‚âã‚âO‚âË‚âW‚â‚âŸ‚â#‚â«‚â·‚âk‚â‚æ#‚â·‚âg‚â—‚â·‚â‚â·‚â×‚â‚â‚â‚âÇ‚æ'‚âœì(€€€€€™••‘‰…¬¹¡¥‘‘•¸€ô™…±Í”ì(€€€€€™••‘‰…¬¹™½ÕÌ¡íÁÉ•Ù•¹ÑMÉ½±°éÑÉÕ•ô¤ì(€€€€€Ñ½…ÍÐ ‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â è€ˆ€¬•ÉÉ½È¹µ•ÍÍ…”°€‰Ý…É¸ˆ¤ì(€€€ô™¥¹…±±äì(€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ô™…±Í”ì(€€€€€Í•Ñ•ÍÍ5½‘”  œ…•ÍÍµ…¥°œ¤¹É•…‘=¹±ä¤ì(€€€ô(€ô¤ì)ôì((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€Y%\èÕ‘¥Ð±½œ(€€€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼)Y%]Ml‰…Õ‘¥Ðµ±½œ‰t€ô€¡É½½Ð¤€ôøì(€¥˜€ …•¹ÍÕÉ•1¥Ù•=Ù•ÉÙ¥•Ü¡É½½Ð¤¤É•ÑÕÉ¸ì(€½¹ÍÐ±½Ì€ô¹…Õ‘¥Ñ1½œ¹™¥±Ñ•È ¡°¤€ôø¥¹I…¹”¡MÑÉ¥¹œ¡°¹…Ð¤¹Í±¥” À°€ÄÀ¤¤¤ì(€½¹ÍÐ±½ÍÙ…¥±…‰±”€ô±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹±½ÍI•…‘äì(€É½½Ð¹¥¹¹•É!Q50€ô€(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùÕ‘¥Ð1½œð½Àøñ Èø‘í±½ÍÙ…¥±…‰±”€üƒ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â_‚âã‚â‚â‚âË‚â‚æ‚âo‚â—‚â×‚æ#‚â‹‚âg‚æ‚âo‚â—‚â€ ‘í±½Ì¹±•¹Ñ¡ôƒ‚â#‚âË‚â€‘í¹…Õ‘¥Ñ1½œ¹±•¹Ñ¡ôƒ‚â‚âË‚â‹‚â‚âË‚âŒ¥€€è€‹‚â‚âÏ‚â—‚âÇ‚â‚â‚â·‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â#‚âË‚â‚âC‚âË‚âg‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚â‚âÓ‚â‰ôð½ ÈøñÍµ…±°±…ÍÌô‰¡•…µÍÕˆˆû‚â+‚æ#‚âŸ‚â‚â‚æ'‚â·‚â‡‚âç‚â”€‘í ¡É…¹•1…‰•° ¤¥ô‘í±½ÍÙ…¥±…‰±”€ü€ˆˆ€è€ˆƒ
Üƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â«‚â‚âã‚âo‚æ‚âo‚æ‚âd€À‰ôð½Íµ…±°øð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹±¥¹”µ…Ñ¥½¹Ìˆø(€€€€€€€€€€ñ¥¹ÁÕÐÑåÁ”ô‰Í•…É ˆ¥ô‰±½M•…É ˆÁ±…•¡½±‘•Èô‹‚â‚æ'‚âg‚â¯‚âÈÕÍ•È€¼ƒ‚æ‚â‚â¨€¼…Ñ¥½¸ˆ€¼ø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰±½áÁ½ÉÐˆùáÁ½ÉÐMXð½‰ÕÑÑ½¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…Àˆø(€€€€€€€€ñÑ…‰±”¥ô‰±½Q…‰±”ˆø(€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ û‚æ‚âŸ‚â—‚âÈð½Ñ øñÑ û‚âs‚âç‚æ'‚æ‚â+‚æ$ð½Ñ øñÑ ùÑ¥½¸ð½Ñ øñÑ ù¹Ñ¥Ñäð½Ñ øñÑ û‚æ‚âo‚æ'‚âË‚â¯‚â‡‚âË‚âˆð½Ñ øñÑ û‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âPð½Ñ øð½ÑÈøð½Ñ¡•…ø(€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€€‘í±½Ì(€€€€€€€€€€€€€€¹µ…À (€€€€€€€€€€€€€€€€¡°¤€ôø€ñÑÈøñÑ±…ÍÌô‰µ½¹¼ˆø‘í ¡‘¥ÍÁ±…åQ¥µ”¡°¹…Ð¤¥ôð½ÑøñÑø‘í ¡°¹ÕÍ•È¥ôð½Ñø(€€€€€€€€€€€€€€ñÑøñÍÁ…¸±…ÍÌô‰‰…‘”‰±Õ”ˆø‘í ¡°¹…Ñ¥½¸¥ôð½ÍÁ…¸øð½ÑøñÑø‘í ¡°¹•¹Ñ¥Ñä¥ôð½Ñø(€€€€€€€€€€€€€€ñÑ±…ÍÌô‰µ½¹¼ˆø‘í ¡°¹Ñ…É•Ð¥ôð½ÑøñÑ±…ÍÌô‰µÕÑ•ˆø‘í ¡°¹‘•Ñ…¥°¥ôð½Ñøð½ÑÈù€°(€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€¹©½¥¸ ˆˆ¤ñð€ñÑÈøñÑ½±ÍÁ…¸ôˆØˆ±…ÍÌô‰•µÁÑäˆø‘í±½ÍÙ…¥±…‰±”€ü€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚âg‚â+‚æ#‚âŸ‚â‚âg‚â×‚æ$ˆ€è€‹‚â‚æ'‚â·‚â‡‚âç‚â”Õ‘¥Ð1½œƒ‚â‹‚âÇ‚â‚æ‚â¯‚â—‚âS‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ƒŠPƒ‚â‚âS‚â—‚â·‚â‚æ‚â¯‚â‡‚æ#‚â#‚âË‚â‚æ‚â[‚âk‚æ‚â#‚æ'‚â‚æ‚âW‚âß‚â·‚âg‚âS‚æ'‚âË‚âg‚âk‚âd‰ôð½Ñøð½ÑÈùô(€€€€€€€€€€ð½Ñ‰½‘äø(€€€€€€€€ð½Ñ…‰±”ø(€€€€€€ð½‘¥Øø(€€€€€€ñÀ±…ÍÌô‰¡¥¹ÐˆùÕ‘¥Ð±½œƒ‚æ‚â‚â×‚â‹‚âg‚æ‚âS‚æ'‚â·‚â‹‚æ#‚âË‚â‚æ‚âS‚â×‚â‹‚âœ€¡…ÁÁ•¹µ½¹±ä¤ƒ‚æ‚â‡‚æ#‚â‡‚â×‚âk‚â_‚âk‚âË‚â_‚æ‚âS‚æ‚â‚æ'‚â¯‚â‚âß‚â·‚â—‚âk‚æ‚âS‚æ$ƒ‚âW‚âË‚â‡‚â‚æ'‚â·‚â‚âÏ‚â¯‚âg‚âP¹½¸µ™Õ¹Ñ¥½¹…°ð½Àø(€€€€ð½Í•Ñ¥½¸ù€ì((€€ ˆ±½M•…É ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¥¹ÁÕÐˆ°€¡”¤€ôøì(€€€½¹ÍÐÄ€ô”¹Ñ…É•Ð¹Ù…±Õ”¹Ñ½1½Ý•É…Í” ¤ì(€€€€ ˆ±½Q…‰±”Ñ‰½‘äÑÈˆ¤¹™½É…  ¡ÑÈ¤€ôø€¡ÑÈ¹ÍÑå±”¹‘¥ÍÁ±…ä€ôÑÈ¹Ñ•áÑ½¹Ñ•¹Ð¹Ñ½1½Ý•É…Í” ¤¹¥¹±Õ‘•Ì¡Ä¤€ü€ˆˆ€è€‰¹½¹”ˆ¤¤ì(€ô¤ì(€€ ˆ±½áÁ½ÉÐˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø(€€€•áÁ½ÉÑM¡••ÑÌ ‰…Õ‘¥Ðµ±½œˆ°l(€€€€€ì(€€€€€€€¹…µ”è€‰Õ‘¥Ð1½œˆ°(€€€€€€€Ñ¥Ñ±”è€‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âË‚â‚æ‚â+‚æ'‚â‚âË‚âg‚â‚âÃ‚âk‚âhˆ°(€€€€€€€¡•…‘•ÉÌèl‹‚æ‚âŸ‚â—‚âÈˆ°€‹‚âs‚âç‚æ'‚æ‚â+‚æ$ˆ°€‰…Ñ¥½¸ˆ°€‰•¹Ñ¥Ñäˆ°€‰Ñ…É•Ðˆ°€‹‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âP‰t°(€€€€€€€Ý¥‘Ñ¡ÌèlÈÀ°€Äà°€ÄØ°€ÄØ°€ÈÈ°€ØÁt°(€€€€€€€É½ÝÌè±½Ì¹µ…À ¡°¤€ôøm°¹…Ð°°¹ÕÍ•È°°¹…Ñ¥½¸°°¹•¹Ñ¥Ñä°°¹Ñ…É•Ð°°¹‘•Ñ…¥±t¤°(€€€€€ô°(€€€t¤°(€€¤ì)ôì((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€Y%\è±½Õ€´ƒ‚â‚â—‚âÇ‚â‚æ‚â‚â—‚æ3‚â#‚âË‚âMÕÁ…‰…Í”€¡¸á¸ƒ‚â«‚æ#‚â‚æ‚â‚æ'‚âË‚â‡‚âË‚â#‚âË‚â‚æ‚â‡‚â”¤(€€€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼)½¹ÍÐ±½Õ‘MÑ…Ñ”€ôì‰…Ñ¡•Ìè¹Õ±°°…Í•ÑÑ…¡µ•¹ÑÌè¹Õ±°°•Ù¥‘•¹•ÉÉ½Èè¹Õ±°°‘…¥±äè¹Õ±°°½Á•É…Ñ¥½¹Ìè¹Õ±°°±½…‘¥¹œè™…±Í”°…Õá¥±¥…Éå1½…‘¥¹œè™…±Í”°•ÉÉ½Èè¹Õ±°°Á…ÉÑ¥…±ÉÉ½Èè¹Õ±°°­•äè€ˆˆ°É•ÅÕ•ÍÑ%è€À°Á¥­•èíô°‰ÕÍäè€ˆˆ°…Ñ¥Ù•)½ˆè¹Õ±°°™¥±•Y¥•Üè€‰…±°ˆôì()½¹ÍÐ±½Õ‘EÕ•Éå-•ä€ô€ ¤€ôø€‘íMˆ¹…ÕÑ¡UÍ•È ¤ü¹¥ñð€œõð‘íÍÑ…Ñ”¹É½±•õð‘íÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½´ñð€ˆ‰õð‘íÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹Ñ¼ñð€ˆ‰õð‘íÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹äñð€‰10‰õ€ì()™Õ¹Ñ¥½¸¥ÍQÉ…¹Í¥•¹Ñ¥±•ÉÉ½È¡•ÉÉ½È¤ì(€É•ÑÕÉ¸€½Ñ¥µ•½ÕÑñÑ¥µ•½ÕÑñ…‰½ÉÑñ¹•ÑÝ½É­ñ™•Ñ¡ñ½¹¹•Ñ¥½¹ñÑ•µÁ½É…Éñ…Ñ•Ý…åñ‘…Ñ…‰…Í”½¤¹Ñ•ÍÐ¡MÑÉ¥¹œ¡•ÉÉ½Èü¹µ•ÍÍ…”ñð•ÉÉ½Èñð€ˆˆ¤¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸É•ÑÉåQÉ…¹Í¥•¹Ñ¥±•I•ÅÕ•ÍÐ¡…Ñ¥½¸°…ÑÑ•µÁÑÌ€ô€Ì¤ì(€±•Ð±…ÍÑÉÉ½Èì(€™½È€¡±•Ð…ÑÑ•µÁÐ€ô€Äì…ÑÑ•µÁÐ€ðô…ÑÑ•µÁÑÌì…ÑÑ•µÁÐ¬¬¤ì(€€€ÑÉäìÉ•ÑÕÉ¸…Ý…¥Ð…Ñ¥½¸ ¤ìô(€€€…Ñ €¡•ÉÉ½È¤ì(€€€€€±…ÍÑÉÉ½È€ô•ÉÉ½Èì(€€€€€¥˜€¡…ÑÑ•µÁÐ€øô…ÑÑ•µÁÑÌñð€…¥ÍQÉ…¹Í¥•¹Ñ¥±•ÉÉ½È¡•ÉÉ½È¤¤Ñ¡É½Ü•ÉÉ½Èì(€€€€€…Ý…¥Ð¹•ÜAÉ½µ¥Í” ¡É•Í½±Ù”¤€ôøÍ•ÑQ¥µ•½ÕÐ¡É•Í½±Ù”°€ÌÔÀ€¨…ÑÑ•µÁÐ¤¤ì(€€€ô(€ô(€Ñ¡É½Ü±…ÍÑÉÉ½Èì)ô()™Õ¹Ñ¥½¸™¥±•AÉ•Ù¥•ÝQ…‰±”¡É½ÝÌ¤ì(€½¹ÍÐÕÍ”€ô€¡É½ÝÌñðmt¤¹Í±¥” À°€ÔÀ¤¹µ…À ¡É½Ü¤€ôø€¡É½Üñðmt¤¹Í±¥” À°€ÈÀ¤¤ì(€½¹ÍÐÝ¥‘Ñ €ô5…Ñ ¹µ…à Ä°€¸¸¹ÕÍ”¹µ…À ¡É½Ü¤€ôøÉ½Ü¹±•¹Ñ ¤¤ì(€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÌô‰™¥±”µÁÉ•Ù¥•Üµ¹½Ñ”ˆû‚æ‚â«‚âS‚â‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚â€‘í¹Õ´¡ÕÍ”¹±•¹Ñ ¥ôƒ‚æ‚â[‚âŸ‚æ‚â‚âƒ
Üƒ‚â«‚âç‚â‚â«‚âã‚âP€‘í¹Õ´¡Ý¥‘Ñ ¥ôƒ‚â‚â·‚â—‚âÇ‚â‡‚âg‚æ0ð½‘¥Øøñ‘¥Ø±…ÍÌô‰™¥±”µÁÉ•Ù¥•ÜµÑ…‰±”ˆøñÑ…‰±”øñÑ‰½‘äø‘íÕÍ”¹µ…À ¡É½Ü°¥¹‘•à¤€ôø€ñÑÈø‘íÉÉ…ä¹™É½´¡ì±•¹Ñ èÝ¥‘Ñ ô°€¡|°½°¤€ôø€ð‘í¥¹‘•à€ôôô€À€ü€‰Ñ ˆ€è€‰Ñ‰ôø‘í ¡É½Ým½±t€üü€ˆˆ¥ôð¼‘í¥¹‘•à€ôôô€À€ü€‰Ñ ˆ€è€‰Ñ‰ôù€¤¹©½¥¸ ˆˆ¥ôð½ÑÈù€¤¹©½¥¸ ˆˆ¤ñð€ñÑÈøñÑ±…ÍÌô‰•µÁÑäˆû‚æ‚â‚â—‚æ3‚æ‚â‡‚æ#‚â‡‚â×‚â‚æ'‚â·‚â‡‚âç‚â—‚â_‚â×‚æ#‚æ‚â«‚âS‚â‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚â‚æ‚âS‚æ$ð½Ñøð½ÑÈùôð½Ñ‰½‘äøð½Ñ…‰±”øð½‘¥Øù€ì)ô()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•M½ÕÉ•¥±•…¡•Ì¡™¥±•%°¡…¹•Ì¤ì(€½¹ÍÐÍ••¸€ô¹•ÜM•Ð ¤ì(€m±½Õ‘MÑ…Ñ”¹‰…Ñ¡•Ì°±¥Ù•%¹Ñ…­•MÑ…Ñ”¹‰…Ñ¡•Ì°‘…¥±å½µÁ…¹åMÑ…Ñ”¹‰…Ñ¡•Ít¹™½É…  ¡‰…Ñ¡•Ì¤€ôøì(€€€¥˜€ …ÉÉ…ä¹¥ÍÉÉ…ä¡‰…Ñ¡•Ì¤ñðÍ••¸¹¡…Ì¡‰…Ñ¡•Ì¤¤É•ÑÕÉ¸ì(€€€Í••¸¹…‘¡‰…Ñ¡•Ì¤ì(€€€‰…Ñ¡•Ì¹™½É…  ¡‰…Ñ ¤€ôø€¡‰…Ñ ¹Í½ÕÉ•}™¥±•Ìñðmt¤¹™½É…  ¡™¥±”¤€ôøì(€€€€€¥˜€¡™¥±”¹¥€ôôô™¥±•%¤=‰©•Ð¹…ÍÍ¥¸¡™¥±”°¡…¹•Ì¤ì(€€€ô¤¤ì(€ô¤ì)ô()™Õ¹Ñ¥½¸•áÁ½ÉÑ=Éá•°¡µ•Ñ„°½È¤ì(€½¹ÍÐÁ…ÉÍ•‘I½ÝÌ€ôÉÉ…ä¹¥ÍÉÉ…ä¡½È¹É½ÝÌ¤€ü½È¹É½ÝÌ€èmtì(€±•Ð¡•…‘•ÉÌì(€±•ÐÉ½ÝÌì(€¥˜€¡Á…ÉÍ•‘I½ÝÌ¹±•¹Ñ ¤ì(€€€¡•…‘•ÉÌ€ôl‹‚âŸ‚âÇ‚âg‚â_‚â×‚æ ˆ°€‹‚æ‚âŸ‚â—‚âÈˆ°€‹‚âk‚â‚âÓ‚â§‚âÇ‚â\ˆ°€‹‚âc‚âg‚âË‚â‚âË‚âŒ¿‚â+‚æ#‚â·‚â‚â_‚âË‚âˆ°€‹‚âk‚âÇ‚â7‚â+‚âÔˆ°€‹‚â_‚âÓ‚â£‚â_‚âË‚âˆ°€‹‚â#‚âÏ‚âg‚âŸ‚âg‚æ‚â‚âÓ‚âdˆ°€‹‚â‹‚â·‚âS‚â‚â‚æ‚â¯‚â—‚âß‚â´ˆ°€‹‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âPˆ°€‹‚æ‚â[‚âŸ‚âW‚æ'‚âg‚â'‚âk‚âÇ‚âh‰tì(€€€½¹ÍÐÑ¥µ•=˜€ô€¡Í•Œ¤€ôø9Õµ‰•È¹¥Í¥¹¥Ñ”¡9Õµ‰•È¡Í•Œ¤¤€ü¹¥¹”¹¡¡µµÍÌ¡9Õµ‰•È¡Í•Œ¤¤€è€ˆˆì(€€€É½ÝÌ€ôÁ…ÉÍ•‘I½ÝÌ¹µ…À ¡É½Ü¤€ôøl(€€€€€É½Ü¹‘…Ñ”ñðµ•Ñ„¹‘…Ñ”ñð€ˆˆ°Ñ¥µ•=˜¡É½Ü¹Í•Œ¤°É½Ü¹ÍÕ‰¼ñðÉ½Ü¹½µÁ…¹äñðµ•Ñ„¹½µÁ…¹äñð€ˆˆ°(€€€€€É½Ü¹‰…¹¬ñðÉ½Ü¹¡…¹¹•°ñð€ˆˆ°É½Ü¹…½Õ¹Ðñð€ˆˆ°É½Ü¹‘¥É•Ñ¥½¸ñð€ˆˆ°É½Ü¹…µ½Õ¹Ð€üü€ˆˆ°(€€€€€É½Ü¹‰…±…¹”€üü€ˆˆ°É½Ü¹‘•ÍŒñðÉ½Ü¹‘•Ñ…¥°ñð€ˆˆ°É½Ü¹É…Üñð€ˆˆ°(€€€t¤ì(€ô•±Í”ì(€€€¡•…‘•ÉÌ€ôl‹‚â—‚âÏ‚âS‚âÇ‚âhˆ°€‹‚â‚æ'‚â·‚â‚âŸ‚âË‚â‡‚â_‚â×‚æ =Hƒ‚â·‚æ#‚âË‚âg‚æ‚âS‚æ$‰tì(€€€É½ÝÌ€ôMÑÉ¥¹œ¡½È¹•áÑÉ…Ñ•‘}Ñ•áÐñð€ˆˆ¤¹ÍÁ±¥Ð ½qÈýq¸¼¤¹™¥±Ñ•È ¡±¥¹”¤€ôø±¥¹”¹ÑÉ¥´ ¤¤¹µ…À ¡±¥¹”°¥¹‘•à¤€ôøm¥¹‘•à€¬€Ä°±¥¹•t¤ì(€ô(€½¹ÍÐÉ•ÍÕ±Ð€ôáÁ½ÉÑ•È¹Ý½É­‰½½¬¡mì¹…µ”è€‰=Hˆ°¡•…‘•ÉÌ°É½ÝÌ°Ý¥‘Ñ¡Ìè¡•…‘•ÉÌ¹µ…À ¡|°¥¹‘•à¤€ôø¥¹‘•à€ôôô¡•…‘•ÉÌ¹±•¹Ñ €´€Ä€ü€ÔÈ€è€Äà¤õt°(€€€€‘íMÑÉ¥¹œ¡µ•Ñ„¹¹…µ”ñð€‰Á‘˜µ½Èˆ¤¹É•Á±…” ½p¹Á‘˜½¤°€ˆˆ¥ôµ=H¹á±Íá€°(€€€ìÑ¥Ñ±”èƒ‚âs‚â”=Hè€‘íµ•Ñ„¹¹…µ”ñð€‰A‰õ€°ÍÕ‰©•Ðè½½±”½Õµ•¹Ð$ƒ
Üƒ‚â‚âŸ‚âË‚â‡‚â‡‚âÇ‚æ#‚âg‚æ‚â €‘í5…Ñ ¹É½Õ¹¡9Õµ‰•È¡½È¹½¹™¥‘•¹”ñð€À¤€¨€ÄÀÀ¥ô•€ô¤ì(€¥˜€ …É•ÍÕ±Ð¹½¬¤Ñ¡É½Ü¹•ÜÉÉ½È¡É•ÍÕ±Ð¹É•…Í½¸ñð€‹‚â«‚â‚æ'‚âË‚âá•°ƒ‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ˆ¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸Ù…±¥‘…Ñ•I•Á±…•µ•¹Ñ¥±”¡™¥±”¤ì(€¥˜€ …™¥±”ñð€…™¥±”¹Í¥é”¤Ñ¡É½Ü¹•ÜÉÉ½È ‹‚æ‚â‚â—‚æ3‚æ‚â¯‚â‡‚æ#‚æ‚â‡‚æ#‚â‡‚â×‚â‚æ'‚â·‚â‡‚âç‚â”ˆ¤ì(€¥˜€¡™¥±”¹Í¥é”€ø€ÔÀ€¨€ÄÀÈÐ€¨€ÄÀÈÐ¤Ñ¡É½Ü¹•ÜÉÉ½È ‹‚æ‚â‚â—‚æ3‚æ‚â¯‚â‡‚æ#‚âW‚æ'‚â·‚â‚â‡‚â×‚â‚âg‚âË‚âS‚æ‚â‡‚æ#‚æ‚â‚âÓ‚âd€ÔÀ5ˆ¤ì(€½¹ÍÐ•áÐ€ô€¡MÑÉ¥¹œ¡™¥±”¹¹…µ”ñð€ˆˆ¤¹ÍÁ±¥Ð ˆ¸ˆ¤¹Á½À ¤ñð€ˆˆ¤¹Ñ½1½Ý•É…Í” ¤ì(€¥˜€ …l‰á±Íàˆ°€‰á±Í´ˆ°€‰ÍØˆ°€‰ÑáÐˆ°€‰Á‘˜ˆ°€‰‘½à‰t¹¥¹±Õ‘•Ì¡•áÐ¤¤ì(€€€Ñ¡É½Ü¹•ÜÉÉ½È ‹‚â‚â·‚â‚â‚âÇ‚âk‚æ‚â‚â—‚æ0a1M`°a1M4°MX°QaP°Aƒ‚æ‚â—‚âÀ=`ƒ‚æ‚â_‚æ#‚âË‚âg‚âÇ‚æ'‚âdˆ¤ì(€ô(€½¹ÍÐ‰Õ™™•È€ô…Ý…¥Ð™¥±”¹…ÉÉ…å	Õ™™•È ¤ì(€¥˜€¡l‰á±Íàˆ°€‰á±Í´‰t¹¥¹±Õ‘•Ì¡•áÐ¤¤ì(€€€ÑÉäì…Ý…¥Ða±ÍáI•…‘•È¹É•…¡‰Õ™™•È¤ìô(€€€…Ñ €¡•ÉÉ½È¤ìÑ¡É½Ü¹•ÜÉÉ½È ‹‚æ‚â‚â—‚æ0á•°ƒ‚æ‚â¯‚â‡‚æ#‚â‹‚âÇ‚â‚æ‚âo‚âÓ‚âS‚æ‚â‡‚æ#‚æ‚âS‚æ$ƒ‚â‚â‚âã‚âO‚âË‚æ‚âo‚âÓ‚âS‚æ‚âdá•°ƒ‚æ‚â—‚æ'‚âœM…Ù”Ìƒ‚æ‚âo‚æ‚âd€¹á±Íàƒ‚â‚æ#‚â·‚âg‚â·‚âÇ‚âo‚æ‚â¯‚â—‚âPˆ¤ìô(€ô•±Í”¥˜€¡•áÐ€ôôô€‰Á‘˜ˆ¤ì(€€€½¹ÍÐÍ¥¹…ÑÕÉ”€ô¹•ÜQ•áÑ•½‘•È ‰±…Ñ¥¸Äˆ¤¹‘•½‘”¡¹•ÜU¥¹ÐáÉÉ…ä¡‰Õ™™•È¹Í±¥” À°€Ô¤¤¤ì(€€€¥˜€¡Í¥¹…ÑÕÉ”€„ôô€ˆ•A´ˆ¤Ñ¡É½Ü¹•ÜÉÉ½È ‹‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚æ‚â—‚âß‚â·‚â‚æ‚â+‚æ'‚âg‚âË‚â‡‚â«‚â‚âã‚â”Aƒ‚æ‚âW‚æ#‚æ‚âg‚âß‚æ'‚â·‚â¯‚âË‚æ‚â‡‚æ#‚æ‚â+‚æ Aƒ‚â_‚â×‚æ#‚â«‚â‡‚âk‚âç‚â‚âO‚æ0ˆ¤ì(€ô•±Í”¥˜€¡•áÐ€ôôô€‰‘½àˆ¤ì(€€€½¹ÍÐ‰åÑ•Ì€ô¹•ÜU¥¹ÐáÉÉ…ä¡‰Õ™™•È¹Í±¥” À°€È¤¤ì(€€€¥˜€¡‰åÑ•ÍlÁt€„ôô€ÁàÔÀñð‰åÑ•ÍlÅt€„ôô€ÁàÑˆ¤Ñ¡É½Ü¹•ÜÉÉ½È ‹‚æ‚â‚â—‚æ0=`ƒ‚æ‚â¯‚â‡‚æ#‚æ‚â‡‚æ#‚â«‚â‡‚âk‚âç‚â‚âO‚æ0ƒ‚â‚â‚âã‚âO‚âË‚æ‚âo‚âÓ‚âS‚æ‚â—‚âÃ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â¯‚â‡‚æ#‚â‚æ#‚â·‚âg‚â·‚âÇ‚âo‚æ‚â¯‚â—‚âPˆ¤ì(€ô(€É•ÑÕÉ¸ÑÉÕ”ì)ô()Y%]Ml‰µ½¹Ñ¡±äµ…Õ‘¥Ð‰t€ô…Íå¹Œ€¡É½½Ð¤€ôøì(€É½½Ð¹¥¹¹•É!Q50ôœñ‘¥Ø±…ÍÌô‰™•…ÑÕÉ”µÝ½É­ÍÁ…”ˆ¥ô‰µ½¹Ñ¡±åÕ‘¥Ñ!½ÍÐˆøð½‘¥Øøœì(€5½¹Ñ¡±åÕ‘¥Ð¹µ½Õ¹Ð¡É½½Ð¹ÅÕ•ÉåM•±•Ñ½È œµ½¹Ñ¡±åÕ‘¥Ñ!½ÍÐœ¤±ì(€€€…Ñ½Èè ¤ôùMˆ¹…ÕÑ¡UÍ•È ¤ü¹¥±É½±”è ¤ôùÍÑ…Ñ”¹É½±”±Ñ½‘…äéAI=}Q=d°(€€€±½…éMˆ¹µ½¹Ñ¡±åÕ‘¥Ñ½¹Ñ•áÐ±É•…Ñ”éMˆ¹É•…Ñ•5½¹Ñ¡±åÕ‘¥ÑM•Ð±‘•Ñ…¥°éMˆ¹µ½¹Ñ¡±åÕ‘¥Ñ•Ñ…¥°±É•Ù¥•ÜéMˆ¹µ½¹Ñ¡±åÕ‘¥Ñ%Ñ•µI•Ù¥•Ü°(€€€…ÍÍ¥¸éMˆ¹…ÍÍ¥¹5½¹Ñ¡±åÕ‘¥ÑI•Ù¥•Ý•È±Í…Ù”éMˆ¹Í…Ù•5½¹Ñ¡±åÕ‘¥ÑÍÍ•ÍÍµ•¹Ð±ÕÁ±½…éMˆ¹ÕÁ±½…‘5½¹Ñ¡±åÕ‘¥ÑÙ¥‘•¹”°(€€€ÁÉ•Ù¥•Üéµ•Ñ„ôù½Á•¹MÑ½É•‘¥±•AÉ•Ù¥•Ü¡í¥éµ•Ñ„¹¥±¹…µ”éµ•Ñ„¹™¥±•}¹…µ”±Á…Ñ éµ•Ñ„¹ÍÑ½É…•}Á…Ñ ±Í¥é”éµ•Ñ„¹Í¥é•}‰åÑ•Ì±µ¥µ”éµ•Ñ„¹µ¥µ•}ÑåÁ”±½µÁ…¹äéµ•Ñ„¹½µÁ…¹ä±­¥¹éµ•Ñ„¹­¥¹‘ñð‘½}±…É¥™äœ±É•…‘=¹±äéÑÉÕ•ô¤°(€ô¤ì)ôì()…Íå¹Œ™Õ¹Ñ¥½¸½Á•¹MÑ½É•‘¥±•AÉ•Ù¥•Ü¡µ•Ñ„¤ì(€½¹ÍÐ¹…µ”€ôµ•Ñ„¹¹…µ”ñð€‹‚æ‚â‚â—‚æ3‚âW‚æ'‚âg‚â'‚âk‚âÇ‚âhˆì(€½¹ÍÐ•áÐ€ô€¡¹…µ”¹ÍÁ±¥Ð ˆ¸ˆ¤¹Á½À ¤ñð€ˆˆ¤¹Ñ½1½Ý•É…Í” ¤ì(€½¹ÍÐÍ¥é•1…‰•°€ôµ•Ñ„¹Í¥é”€ü€‘í5…Ñ ¹É½Õ¹¡9Õµ‰•È¡µ•Ñ„¹Í¥é”¤€¼€ÄÀÈÐ¤¹Ñ½1½…±•MÑÉ¥¹œ ¥ô-	€€è€‹‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âã‚â‚âg‚âË‚âPˆì(€½¹ÍÐÍÑ…ÑÕÌ€ôµ•Ñ„¹ÍÑ…ÑÕÌ€ôôô€‰•ÉÉ½Èˆ€ü€‹‚â·‚æ#‚âË‚âg‚æ‚â‡‚æ#‚æ‚âS‚æ$ˆ€èµ•Ñ„¹ÍÑ…ÑÕÌ€ôôô€‰Á…ÉÍ•ˆ€ü€‹‚â{‚â‚æ'‚â·‚â‡‚æ‚â+‚æ'‚â‚âË‚âdˆ€è€‹‚â‚â·‚âW‚â‚âŸ‚â ˆì(€½¹ÍÐ½µÁ…¹å=ÁÑ¥½¹Ì€ô½µÁ…¹å5…ÍÑ•È ¤¹µ…À ¡½µÁ…¹ä¤€ôø½µÁ…¹ä¹½‘”¤¹™¥±Ñ•È ¡½‘”°¥¹‘•à°É½ÝÌ¤€ôøÉ½ÝÌ¹¥¹‘•á=˜¡½‘”¤€ôôô¥¹‘•à¤ì(€¥˜€¡µ•Ñ„¹½µÁ…¹ä€˜˜€…½µÁ…¹å=ÁÑ¥½¹Ì¹¥¹±Õ‘•Ì¡µ•Ñ„¹½µÁ…¹ä¤¤½µÁ…¹å=ÁÑ¥½¹Ì¹Õ¹Í¡¥™Ð¡µ•Ñ„¹½µÁ…¹ä¤ì(€½¹ÍÐ­¥¹‘=ÁÑ¥½¹Ì€ôl(€€€l‰ÍÑµ}Á‘˜ˆ°€‰MQ4ƒ‚âw‚âË‚â·‚â[‚â·‚âdˆ°€‰MÑ…Ñ•µ•¹Ðƒ‚â¯‚â‚âß‚â·‚â‚âË‚â‹‚â‚âË‚â‚æ‚âS‚âÓ‚âg‚âk‚âÇ‚â7‚â+‚â×‚âc‚âg‚âË‚â‚âË‚âŒ‰t°(€€€l‰‰½}µ…¥¸ˆ°€‰	<ƒ‚â‚âË‚â‹‚â‚âË‚âg‚â¯‚â—‚âÇ‚â‚âk‚æ'‚âË‚âdˆ°€‹‚â‚âË‚â‹‚â‚âË‚âg‚â¯‚âg‚æ'‚âÈ	<ƒ‚â‚â·‚â‚âk‚â‚âÓ‚â§‚âÇ‚â\‰t°(€€€l‰Áµ}ÍÑ…Ñ•µ•¹Ðˆ°€‰A4ƒ‚âw‚âË‚â¿‚â[‚â·‚âdˆ°€‰UQ=AH°iAd°e	IA1UL°5eAdƒ‚â¯‚â‚âß‚â´€ÄÉAd‰t°(€€€l‰µ…¹Õ…±}É•‘¥Ðˆ°€‹‚âw‚âË‚â‚â‡‚âß‚â´€´ƒ‚æ‚â‚â‚âS‚âÓ‚âTˆ°€‹‚â‚âË‚â‹‚â‚âË‚â‚æ‚âW‚âÓ‚â‡‚æ‚â‚â‚âS‚âÓ‚âW‚âS‚æ'‚âŸ‚â‹‚â‡‚âß‚â´‰t°(€€€l‰µ…¹Õ…±}Á…åµ•¹Ðˆ°€‹‚âw‚âË‚â‚â‡‚âß‚â´€´A…åµ•¹Ðˆ°€‹‚â‚âË‚â‹‚â‚âË‚â‚âw‚âË‚â‚â‡‚âß‚â·‚âw‚âÇ‚æ#‚âA…åµ•¹Ð‰t°(€€€l‰µ…¹Õ…±}‰½¹ÕÌˆ°€‹‚âw‚âË‚â‚â‡‚âß‚â´€´ƒ‚æ‚âk‚âg‚âÇ‚â¨ˆ°€‹‚â‚âË‚â‹‚â‚âË‚â‚æ‚âk‚âg‚âÇ‚â¨‰t°(€€€l‰½µµ}É•Äˆ°€‹‚â[‚â·‚âg‚â‚æ#‚âË‚â‚â·‚â‡‚â‡‚âÓ‚â+‚â+‚âÇ‚æ#‚âdˆ°€‹‚â‚âË‚â‹‚â‚âË‚â‚â[‚â·‚âg‚â‚â·‚â‡‚â‡‚âÓ‚â+‚â+‚âÇ‚æ#‚âd‰t°(€€€l‰É•‘¥Ñ}½ÕÐˆ°€‹‚â[‚â·‚âg‚æ‚â‚â‚âS‚âÓ‚âTˆ°€‹‚â‚âË‚â‹‚â‚âË‚âg‚â[‚â·‚âg‚æ‚â‚â‚âS‚âÓ‚âT‰t°(€€€l‰‘½}±…É¥™äˆ°€‹‚æ‚â‚â—‚æ3‚â+‚â×‚æ'‚æ‚â#‚â¿‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdˆ°€‹‚æ‚â·‚â‚â«‚âË‚â‚âW‚â·‚âk‚â‚æ'‚â·‚â«‚â‚â«‚âÇ‚â‹‚â¯‚â‚âß‚â·‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â{‚âÓ‚æ#‚â‡‚æ‚âW‚âÓ‚â„‰t°(€€€l‰Õ¹­¹½Ý¸ˆ°€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â_‚â‚âË‚âk‚âo‚â‚âÃ‚æ‚âƒ‚â\ˆ°€‹‚æ‚â+‚æ'‚æ‚â‡‚âß‚æ#‚â·‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â«‚âË‚â‡‚âË‚â‚â[‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âo‚â‚âÃ‚æ‚âƒ‚â_‚æ‚â‚â—‚æ3‚æ‚âS‚æ$‰t°(€tì(€½¹ÍÐÍ•±•Ñ•‘-¥¹‘!•±À€ô€¡­¥¹‘=ÁÑ¥½¹Ì¹™¥¹ ¡m­¥¹‘t¤€ôø­¥¹€ôôôµ•Ñ„¹­¥¹¤ñð­¥¹‘=ÁÑ¥½¹Ím­¥¹‘=ÁÑ¥½¹Ì¹±•¹Ñ €´€Åt¥lÉtì(€½¹ÍÐ…¹I•±…ÍÍ¥™ä€ô€…µ•Ñ„¹É•…‘=¹±ä€˜˜€…MÑÉ¥¹œ¡µ•Ñ„¹Á…Ñ ñð€œœ¤¹ÍÑ…ÉÑÍ]¥Ñ  …Í”µ•Ù¥‘•¹”¼œ¤€˜˜ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€‰ÁÉ½‘ÕÑ¥½¸ˆ€˜˜µ•Ñ„¹¥€˜˜ÑåÁ•½˜Mˆ€„ôô€‰Õ¹‘•™¥¹•ˆ€˜˜Mˆ¹Í¥¹•‘%¸ ¤ì(€½¹ÍÐ…¹5…Ñ¡±…É¥™¥…Ñ¥½¸€ô…¹I•±…ÍÍ¥™ä€˜˜µ•Ñ„¹­¥¹€ôôô€‰‘½}±…É¥™äˆì(€½¹ÍÐ±…É¥™¥…Ñ¥½¹A…¹•°€ô…¹5…Ñ¡±…É¥™¥…Ñ¥½¸€ü€ñÍ•Ñ¥½¸±…ÍÌô‰™¥±”µ±…É¥™¥…Ñ¥½¸µµ…Ñ ˆ¥ô‰™¥±•±…É¥™¥…Ñ¥½¹5…Ñ ˆø(€€€€ñ‘¥Ø±…ÍÌô‰™¥±”µ±…É¥™¥…Ñ¥½¸µ¡•…ˆøñ‘¥ØøñÍµ…±°û‚æ‚â+‚æ'‚æ‚â‚â—‚æ3‚âg‚â×‚æ'‚æ‚âo‚æ‚âg‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdð½Íµ…±°øñˆû‚â#‚âÇ‚âk‚â‚âç‚æ#‚â‚âÇ‚âk‚æ‚â‚â«‚â_‚â×‚æ#‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â{‚âk‚â‚âç‚æ#‚â‚â·‚â€‘í ¡µ•Ñ„¹½µÁ…¹äñð€‹‚âk‚â‚âÓ‚â§‚âÇ‚â_‚âg‚â×‚æ$ˆ¥ôð½ˆøñÍÁ…¸û‚æ‚â—‚âß‚â·‚â‚æ‚âS‚æ'‚â¯‚â—‚âË‚â‹‚æ‚â‚â«‚â¯‚â‚âß‚â·‚æ‚â—‚âß‚â·‚â‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âPƒ‚â‚âÃ‚âk‚âk‚â#‚âÃ‚â«‚æ#‚â‚â«‚â[‚âË‚âg‚âÃ‚æ‚âo‚æ‚âdƒŠs‚â‡‚â×‚â‚âÏ‚â+‚â×‚æ'‚æ‚â#‚âŠS‚â‚â´Õ‘¥Ðƒ‚âW‚â‚âŸ‚â#Štƒ‚æ‚â—‚âÃ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚âo‚âÓ‚âS‚æ‚â‚â«‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÐð½ÍÁ…¸øð½‘¥ØøñÍÁ…¸±…ÍÌô‰ÍÁ¥¹¹•Èˆ¥ô‰™¥±•±…É¥™¥…Ñ¥½¹MÁ¥¹¹•Èˆøð½ÍÁ…¸øð½‘¥Øø(€€€€ñ‘¥Ø±…ÍÌô‰™¥±”µ±…É¥™¥…Ñ¥½¸µÑ½½±Ìˆø(€€€€€€ñ±…‰•°øñ¥¹ÁÕÐÑåÁ”ô‰¡•­‰½àˆ¥ô‰™¥±•±…É¥™¥…Ñ¥½¹M…µ•…äˆ¡•­•øƒ‚æ‚â'‚â{‚âË‚âÃ‚âŸ‚âÇ‚âg‚â_‚â×‚æ €‘í ¡µ•Ñ„¹‘…Ñ”ñð€‹‚æ‚âS‚â×‚â‹‚âŸ‚â‚âÇ‚âk‚æ‚â‚â—‚æ0ˆ¥ôð½±…‰•°ø(€€€€€€ñ±…‰•°øñ¥¹ÁÕÐÑåÁ”ô‰¡•­‰½àˆ¥ô‰™¥±•±…É¥™¥…Ñ¥½¹5¥ÍÍ¥¹=¹±äˆ¡•­•øƒ‚æ‚â'‚â{‚âË‚âÃ‚æ‚â‚â«‚â_‚â×‚æ#‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â{‚âk‚â‚âç‚æ ð½±…‰•°ø(€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰™¥±•±…É¥™¥…Ñ¥½¹M•±•Ñ±°ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆû‚æ‚â—‚âß‚â·‚â‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âS‚â_‚â×‚æ#‚æ‚â«‚âS‚âð½‰ÕÑÑ½¸ø(€€€€€€ñˆ¥ô‰™¥±•±…É¥™¥…Ñ¥½¹½Õ¹Ðˆû‚â‚âÏ‚â—‚âÇ‚â‚â‚æ'‚âg‚â¯‚âË‚æ‚â‚â¨¸¸¸ð½ˆø(€€€€ð½‘¥Øø(€€€€ñ‘¥Ø±…ÍÌô‰™¥±”µ±…É¥™¥…Ñ¥½¸µ±¥ÍÐˆ¥ô‰™¥±•±…É¥™¥…Ñ¥½¹1¥ÍÐˆøñ‘¥Ø±…ÍÌô‰•µÁÑäˆû‚â‚âÏ‚â—‚âÇ‚â‚æ‚â¯‚â—‚âS‚æ‚â‚â«‚â‚â·‚â‚âk‚â‚âÓ‚â§‚âÇ‚â\¸¸¸ð½‘¥Øøð½‘¥Øø(€€€€ñ±…‰•°±…ÍÌô‰™¥±”µ±…É¥™¥…Ñ¥½¸µ¹½Ñ”ˆû‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â«‚âÏ‚â¯‚â‚âÇ‚âk‚âs‚âç‚æ'‚âW‚â‚âŸ‚â ñÑ•áÑ…É•„¥ô‰™¥±•±…É¥™¥…Ñ¥½¹9½Ñ”ˆÉ½ÝÌôˆÈˆû‚æ‚âg‚âk‚æ‚â‚â—‚æ3‚â+‚â×‚æ'‚æ‚â#‚â‚â#‚âË‚â‚â_‚â×‚â„ƒŠPƒ‚â‚â´Õ‘¥Ðƒ‚âW‚â‚âŸ‚â#‚â«‚â·‚âk‚æ‚â—‚âÃ‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÐð½Ñ•áÑ…É•„øð½±…‰•°ø(€€ð½Í•Ñ¥½¸ù€€è€ˆˆì(€½Á•¹5½‘…° (€€€ ¡¹…µ”¤°(€€€€ñ‘¥Ø±…ÍÌô‰™¥±”µÁÉ•Ù¥•Üµµ•Ñ„ˆøñÍÁ…¸øñˆû‚âk‚â‚âÓ‚â§‚âÇ‚â\ð½ˆø‘í ¡µ•Ñ„¹½µÁ…¹äñð€‹‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âàˆ¥ôð½ÍÁ…¸øñÍÁ…¸øñˆû‚âŸ‚âÇ‚âg‚â_‚â×‚æ ð½ˆø‘í ¡µ•Ñ„¹‘…Ñ”ñð€ˆ´ˆ¥ôð½ÍÁ…¸øñÍÁ…¸øñˆû‚âo‚â‚âÃ‚æ‚âƒ‚â\ð½ˆø‘í ¡-%9}1	1mµ•Ñ„¹­¥¹‘tñðµ•Ñ„¹­¥¹ñð•áÐ¹Ñ½UÁÁ•É…Í” ¤ñð€ˆ´ˆ¥ôð½ÍÁ…¸øñÍÁ…¸øñˆû‚â‚âg‚âË‚âPð½ˆøñ¤¥ô‰™¥±•AÉ•Ù¥•ÝM¥é”ˆø‘í ¡Í¥é•1…‰•°¥ôð½¤øð½ÍÁ…¸øñÍÁ…¸øñˆû‚â«‚â[‚âË‚âg‚âÀð½ˆøñ¤¥ô‰™¥±•AÉ•Ù¥•ÝMÑ…ÑÕÌˆø‘í ¡ÍÑ…ÑÕÌ¥ôð½¤øð½ÍÁ…¸øð½‘¥Øø‘í±…É¥™¥…Ñ¥½¹A…¹•±ô‘í…¹I•±…ÍÍ¥™ä€ü€ñ‘¥Ø±…ÍÌô‰™¥±”µÉ•Á±…•µ•¹ÐµÉ•…‘äˆ¥ô‰™¥±•I•Á±…•µ•¹ÑI•…‘äˆ¡¥‘‘•¸øñ‘¥Ø±…ÍÌô‰™¥±”µÉ•Á±…•µ•¹ÐµÉ•…‘äµ¡•…ˆøñ¤…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆûŠrLð½¤øñ‘¥Øøñˆû‚æ‚â‚â—‚æ3‚æ‚â¯‚â‡‚æ#‚â{‚â‚æ'‚â·‚â‡‚âW‚â‚âŸ‚â ð½ˆøñÍµ…±°û‚â‚âÃ‚âk‚âk‚â‹‚âÇ‚â‚æ‚â‚æ‚âk‚æ‚â‚â—‚æ3‚æ‚âS‚âÓ‚â‡‚æ‚âŸ‚æ$ƒ‚â#‚âg‚â‚âŸ‚æ#‚âË‚â‚âã‚âO‚â#‚âÃ‚â‚âPƒŠs‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â—‚âÃ‚â‚âÇ‚âg‚âW‚æ#‚â·Štð½Íµ…±°øð½‘¥Øøð½‘¥Øøñ‘¥Ø±…ÍÌô‰™¥±”µÉ•Á±…•µ•¹Ðµ½µÁ…É”ˆøñ‘¥ØøñÍµ…±°û‚æ‚â‚â—‚æ3‚æ‚âS‚âÓ‚â„ð½Íµ…±°øñÍÁ…¸ø‘í ¡¹…µ”¥ôð½ÍÁ…¸øð½‘¥Øøñ¤…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆûŠHð½¤øñ‘¥ØøñÍµ…±°û‚æ‚â‚â—‚æ3‚æ‚â¯‚â‡‚æ ð½Íµ…±°øñÍÁ…¸¥ô‰™¥±•I•Á±…•µ•¹ÑI•…‘å9…µ”ˆøð½ÍÁ…¸øð½‘¥Øøð½‘¥Øøð½‘¥Øøñ‘¥Ø±…ÍÌô‰™¥±”µÁÉ•Ù¥•Üµ•‘¥Ñ½Èˆøñ‘¥Øøñ±…‰•°™½Èô‰™¥±•½µÁ…¹åM•±•Ðˆû‚âk‚â‚âÓ‚â§‚âÇ‚â\ð½±…‰•°øñÍ•±•Ð¥ô‰™¥±•½µÁ…¹åM•±•Ðˆø‘í½µÁ…¹å=ÁÑ¥½¹Ì¹µ…À ¡½µÁ…¹ä¤€ôø€ñ½ÁÑ¥½¸Ù…±Õ”ôˆ‘í ¡½µÁ…¹ä¥ôˆ€‘í½µÁ…¹ä€ôôôµ•Ñ„¹½µÁ…¹ä€ü€‰Í•±•Ñ•ˆ€è€ˆ‰ôø‘í ¡½µÁ…¹ä¥ôð½½ÁÑ¥½¸ù€¤¹©½¥¸ ˆˆ¥ôð½Í•±•Ðøð½‘¥Øøñ‘¥Øøñ±…‰•°™½Èô‰™¥±•-¥¹‘M•±•Ðˆû‚âo‚â‚âÃ‚æ‚âƒ‚â_‚æ‚â‚â—‚æ0ð½±…‰•°øñÍ•±•Ð¥ô‰™¥±•-¥¹‘M•±•Ðˆø‘í­¥¹‘=ÁÑ¥½¹Ì¹µ…À ¡m­¥¹°±…‰•°°‘•ÍÉ¥ÁÑ¥½¹t¤€ôø€ñ½ÁÑ¥½¸Ù…±Õ”ôˆ‘í ¡­¥¹¥ôˆÑ¥Ñ±”ôˆ‘í ¡‘•ÍÉ¥ÁÑ¥½¸¥ôˆ€‘í­¥¹€ôôôµ•Ñ„¹­¥¹€ü€‰Í•±•Ñ•ˆ€è€ˆ‰ôø‘í ¡±…‰•°¥ôð½½ÁÑ¥½¸ù€¤¹©½¥¸ ˆˆ¥ôð½Í•±•ÐøñÍµ…±°±…ÍÌô‰™¥±”µ­¥¹µ¡•±Àˆ¥ô‰™¥±•-¥¹‘!•±Àˆø‘í ¡Í•±•Ñ•‘-¥¹‘!•±À¥ôð½Íµ…±°øð½‘¥ØøñÀû‚æ‚â—‚âß‚â·‚â‚æ‚â¯‚æ'‚â[‚âç‚â‚âW‚æ'‚â·‚â‚æ‚â—‚æ'‚âŸ‚â‚âPƒŠs‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â—‚âÃ‚â‚âÇ‚âg‚âW‚æ#‚â·Štƒ‚â‚âÃ‚âk‚âk‚â#‚âÃ‚â—‚æ'‚âË‚â‚â‚æ'‚â·‚âs‚âÓ‚âS‚â{‚â—‚âË‚âS‚æ‚âS‚âÓ‚â‡‚æ‚â—‚âÃ‚â«‚æ#‚â‚æ‚â‚â—‚æ3‚â‚â—‚âÇ‚âk‚æ‚âo‚âW‚â‚âŸ‚â#‚æ‚â¯‚â‡‚æ ð½Àøð½‘¥Øù€€è€ˆ‰ôñ‘¥Ø±…ÍÌô‰™¥±”µÁÉ•Ù¥•Üµ½¹Ñ•¹Ðˆ¥ô‰™¥±•AÉ•Ù¥•Ý½¹Ñ•¹ÐˆøñÍÁ…¸±…ÍÌô‰ÍÁ¥¹¹•Èˆøð½ÍÁ…¸øñÀû‚â‚âÏ‚â—‚âÇ‚â‚æ‚âW‚â‚â×‚â‹‚â‡‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚â‚æ‚â‚â—‚æ0¸¸¸ð½Àøð½‘¥Øù€°(€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰™¥±•AÉ•Ù¥•Ý±½Í”ˆû‚âo‚âÓ‚âPð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰™¥±•=Á•¹=É¥¥¹…°ˆû‚æ‚âo‚âÓ‚âS‚âW‚æ'‚âg‚â'‚âk‚âÇ‚âk‚æ‚âg‚æ‚â_‚æ‚âk‚æ‚â¯‚â‡‚æ ð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰™¥±•½Ý¹±½…ˆû‚âS‚âË‚âŸ‚âg‚æ3‚æ‚â¯‚â—‚âS‚æ‚â‚â—‚æ0ð½‰ÕÑÑ½¸ø‘í…¹I•±…ÍÍ¥™ä€ü€ñ¥¹ÁÕÐ¥ô‰™¥±•I•Á±…•µ•¹Ñ%¹ÁÕÐˆÑåÁ”ô‰™¥±”ˆ…•ÁÐôˆ¹á±Íà°¹á±Í´°¹ÍØ°¹ÑáÐ°¹Á‘˜°¹‘½àˆ¡¥‘‘•¸øñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰™¥±•I•Á±…•UÁ±½…ˆû‚â·‚âÇ‚âo‚æ‚â¯‚â—‚âS‚æ‚â‚â—‚æ3‚æ‚â¯‚â‡‚æ#‚æ‚â_‚âg‚â_‚â×‚æ ð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ¥ô‰™¥±•I•±…ÍÍ¥™äˆû‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â—‚âÃ‚â‚âÇ‚âg‚âW‚æ#‚â´ð½‰ÕÑÑ½¸ù€€è€ˆ‰ô‘í…¹5…Ñ¡±…É¥™¥…Ñ¥½¸€ü€ñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ¥ô‰™¥±•5…Ñ¡±…É¥™¥…Ñ¥½¸ˆ‘¥Í…‰±•û‚â#‚âÇ‚âk‚â‚âç‚æ#‚â‚âÇ‚âk‚æ‚â‚â«‚â_‚â×‚æ#‚æ‚â—‚âß‚â·‚âð½‰ÕÑÑ½¸ù€€è€ˆ‰õ€°(€€¤ì(€€ ˆµ½‘…°ˆ¤¹±…ÍÍ1¥ÍÐ¹…‘ ‰™¥±”µÁÉ•Ù¥•Üµµ½‘…°ˆ¤ì(€¥˜¡µ•Ñ„¹É•…‘=¹±ä¤€ œ™¥±•AÉ•Ù¥•Ý½¹Ñ•¹Ðœ¤¹¥¹Í•ÉÑ‘©…•¹Ñ!Q50 ‰•™½É•‰•¥¸œ°(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆøñˆû‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚âg‚â‚â—‚âÇ‚âƒ
Üƒ‚æ‚âo‚âÓ‚âS‚â·‚æ#‚âË‚âg‚æ‚â_‚æ#‚âË‚âg‚âÇ‚æ'‚âdð½ˆøñÀø‘í ¡µ•Ñ„¹•Ù¥‘•¹•=É¥¥¸ñð€Ÿ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdœ¥ôƒ
Ü€‘í ¡µ•Ñ„¹…Í•½‘”ñð€Ÿ‚æ‚â‚â—‚æ3‚â#‚âË‚â‚æ‚â‡‚â”œ¥ôƒ
Üƒ‚æ‚â‡‚æ#‚â·‚æ#‚âË‚âg‚æ‚âo‚æ‚âg‚â‚âË‚â‹‚â‚âË‚â‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âPð½Àø‘íµ•Ñ„¹ÕÁ±½…‘•‘	ä€ü€ñÍµ…±°û‚âs‚âç‚æ'‚æ‚âg‚âh¿‚âs‚âç‚æ'‚â«‚æ#‚âè€‘í ¡µ•Ñ„¹ÕÁ±½…‘•‘	ä¥ôƒ
Üƒ‚æ‚âŸ‚â—‚âÈè€‘í ¡µ•Ñ„¹ÕÁ±½…‘•‘Ðñð€ŸŠPœ¥ôð½Íµ…±°ù€€è€œô‘íµ•Ñ„¹½ÉÉ•Ñ¥½¹I•…Í½¸€ü€ñÀû‚æ‚â¯‚âW‚âã‚âs‚â—‚æ‚â‚æ'‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdè€‘í ¡µ•Ñ„¹½ÉÉ•Ñ¥½¹I•…Í½¸¥ôð½ÀøñÍµ…±°û‚â·‚æ'‚âË‚â‚â[‚âÛ‚â‚æ‚â‚â—‚æ3‚æ‚âS‚âÓ‚â„è€‘í ¡µ•Ñ„¹É•Á±…•ÍÙ¥‘•¹•%ñðµ•Ñ„¹É•Á±…•ÍM½ÕÉ•¥±•%ñð€ŸŠPœ¥ôƒ
Üƒ‚æ‚â‚â—‚æ3‚æ‚âS‚âÓ‚â‡‚â‹‚âÇ‚â‚â·‚â‹‚âç‚æ#‚æ‚âg‚â‚â—‚âÇ‚âð½Íµ…±°ù€€è€œôð½Í•Ñ¥½¸ù€¤ì(€¥˜€¡…¹5…Ñ¡±…É¥™¥…Ñ¥½¸¤Ù¥‘•¹•I•½µµ•¹‘…Ñ¥½¹Ì¹µ½Õ¹Ð  ˆµ½‘…°€¹µ½‘…°µ‰½‘äˆ¤°µ•Ñ„°½µÁ…¹å=ÁÑ¥½¹Ì°Mˆ°½Á•¹MÑ½É•‘¥±•AÉ•Ù¥•Ü¤ì(€€ ˆ™¥±•AÉ•Ù¥•Ý±½Í”ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°±½Í•5½‘…°¤ì(€±•ÐÍ¥¹•‘UÉ°€ô€ˆˆì(€±•Ð‘½Ý¹±½…‘•€ô¹Õ±°ì(€±•ÐÁ•¹‘¥¹I•Á±…•µ•¹Ñ¥±”€ô¹Õ±°ì(€±•ÐÁ•¹‘¥¹I•Á±…•µ•¹Ñ=‰©•ÑUÉ°€ô€ˆˆì(€½¹ÍÐ•ÑM¥¹•€ô…Íå¹Œ€ ¤€ôøÍ¥¹•‘UÉ°ñð€¡Í¥¹•‘UÉ°€ô…Ý…¥ÐÉ•ÑÉåQÉ…¹Í¥•¹Ñ¥±•I•ÅÕ•ÍÐ  ¤€ôøMˆ¹Í¥¹•‘UÉ°¡µ•Ñ„¹Á…Ñ °€ØÀÀ¤¤¤ì(€½¹ÍÐ•Ñ½Ý¹±½…€ô…Íå¹Œ€ ¤€ôø‘½Ý¹±½…‘•ñð€¡‘½Ý¹±½…‘•€ô…Ý…¥ÐÉ•ÑÉåQÉ…¹Í¥•¹Ñ¥±•I•ÅÕ•ÍÐ  ¤€ôøMˆ¹‘½Ý¹±½…¡µ•Ñ„¹Á…Ñ ¤¤¤ì(€¥˜€¡…¹5…Ñ¡±…É¥™¥…Ñ¥½¸¤ì(€€€½¹ÍÐÍ•±•Ñ•‘…Í•Ì€ô¹•ÜM•Ð ¤ì(€€€±•Ð±…É¥™¥…Ñ¥½¹…¹‘¥‘…Ñ•Ì€ômtì(€€€½¹ÍÐ¥Í=Á•¸€ô€¡É½Ü¤€ôø€…l‰±½Í•ˆ°€‰…ÁÁÉ½Ù•ˆ°€‰‘…µ…”‰t¹¥¹±Õ‘•Ì¡É½Ü¹ÍÑ…ÑÕÌ¤ì(€€€½¹ÍÐ¥Í5¥ÍÍ¥¹A…¥È€ô€¡É½Ü¤€ôøÉ½Ü¹‰…¹­µ½Õ¹Ð€ôô¹Õ±°ñðÉ½Ü¹ÍåÍÑ•µµ½Õ¹Ð€ôô¹Õ±°ñð€¿‚æ‚â‡‚æ#‚â{‚âió‚â‡‚âË‚â‚â‚âŸ‚æ#‚âÉñµ¥ÍÍ¥¹œ½¤¹Ñ•ÍÐ¡€‘íÉ½Ü¹ÑåÁ•ô€‘íÉ½Ü¹ÑåÁ•9…µ•õ€¤ì(€€€½¹ÍÐÙ¥Í¥‰±•…¹‘¥‘…Ñ•Ì€ô€ ¤€ôø±…É¥™¥…Ñ¥½¹…¹‘¥‘…Ñ•Ì¹™¥±Ñ•È ¡É½Ü¤€ôøì(€€€€€¥˜€ …¥Í=Á•¸¡É½Ü¤¤É•ÑÕÉ¸™…±Í”ì(€€€€€¥˜€  ˆ™¥±•±…É¥™¥…Ñ¥½¹M…µ•…äˆ¤ü¹¡•­•€˜˜µ•Ñ„¹‘…Ñ”€˜˜É½Ü¹‘…Ñ”€„ôôµ•Ñ„¹‘…Ñ”¤É•ÑÕÉ¸™…±Í”ì(€€€€€¥˜€  ˆ™¥±•±…É¥™¥…Ñ¥½¹5¥ÍÍ¥¹=¹±äˆ¤ü¹¡•­•€˜˜€…¥Í5¥ÍÍ¥¹A…¥È¡É½Ü¤¤É•ÑÕÉ¸™…±Í”ì(€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô¤ì(€€€½¹ÍÐÉ•¹‘•É±…É¥™¥…Ñ¥½¹…¹‘¥‘…Ñ•Ì€ô€ ¤€ôøì(€€€€€½¹ÍÐ±¥ÍÐ€ô€ ˆ™¥±•±…É¥™¥…Ñ¥½¹1¥ÍÐˆ¤ì(€€€€€¥˜€ …±¥ÍÐ¤É•ÑÕÉ¸ì(€€€€€½¹ÍÐÙ¥Í¥‰±”€ôÙ¥Í¥‰±•…¹‘¥‘…Ñ•Ì ¤ì(€€€€€±¥ÍÐ¹¥¹¹•É!Q50€ôÙ¥Í¥‰±”¹±•¹Ñ €üÙ¥Í¥‰±”¹µ…À ¡É½Ü¤€ôø€ñ±…‰•°±…ÍÌô‰™¥±”µ±…É¥™¥…Ñ¥½¸µ…Í”€‘íÍ•±•Ñ•‘…Í•Ì¹¡…Ì¡É½Ü¹‘‰%¤€ü€‰Í•±•Ñ•ˆ€è€ˆ‰ôˆø(€€€€€€€€ñ¥¹ÁÕÐÑåÁ”ô‰¡•­‰½àˆÙ…±Õ”ôˆ‘í ¡É½Ü¹‘‰%¥ôˆ€‘íÍ•±•Ñ•‘…Í•Ì¹¡…Ì¡É½Ü¹‘‰%¤€ü€‰¡•­•ˆ€è€ˆ‰ôø(€€€€€€€€ñÍÁ…¸øñˆø‘í ¡É½Ü¹¥¥ôð½ˆøñÍµ…±°ø‘í ¡É½Ü¹‘…Ñ”¥ôƒ
Ü€‘í ¡É½Ü¹ÑåÁ•9…µ”¥ôð½Íµ…±°øð½ÍÁ…¸ø(€€€€€€€€ñÍÁ…¸øñˆø‘í ¡É½Ü¹…½Õ¹ÐñðÉ½Ü¹‰…¹¬ñð€ˆ´ˆ¥ôð½ˆøñÍµ…±°ø‘í ¡É½Ü¹‘¥É•Ñ¥½¸ñð€ˆ´ˆ¥ôð½Íµ…±°øð½ÍÁ…¸ø(€€€€€€€€ñÍÁ…¸±…ÍÌô‰™¥±”µ±…É¥™¥…Ñ¥½¸µ…µ½Õ¹ÐˆøñˆùMQ4€‘íÉ½Ü¹‰…¹­µ½Õ¹Ð€ôô¹Õ±°€ü€‹ŠPˆ€èµ½¹•ä¡É½Ü¹‰…¹­µ½Õ¹Ð¥ôð½ˆøñÍµ…±°ù	<€‘íÉ½Ü¹ÍåÍÑ•µµ½Õ¹Ð€ôô¹Õ±°€ü€‹ŠPˆ€èµ½¹•ä¡É½Ü¹ÍåÍÑ•µµ½Õ¹Ð¥ôð½Íµ…±°øð½ÍÁ…¸ø(€€€€€€ð½±…‰•°ù€¤¹©½¥¸ ˆˆ¤€è€ñ‘¥Ø±…ÍÌô‰•µÁÑäˆû‚æ‚â‡‚æ#‚â{‚âk‚æ‚â‚â«‚â‚æ'‚âË‚â‚âW‚âË‚â‡‚âW‚âÇ‚âŸ‚â‚â‚â·‚â‚âg‚â×‚æ$ƒ‚â—‚â·‚â‚âo‚âÓ‚âPƒŠs‚æ‚â'‚â{‚âË‚âÃ‚âŸ‚âÇ‚âg‚â_‚â×‚æ#Štƒ‚â¯‚â‚âß‚â´ƒŠs‚æ‚â'‚â{‚âË‚âÃ‚æ‚â‚â«‚â_‚â×‚æ#‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â{‚âk‚â‚âç‚æ#Štð½‘¥Øù€ì(€€€€€±¥ÍÐ¹ÅÕ•ÉåM•±•Ñ½É±° ¥¹ÁÕÑmÑåÁ”ô‰¡•­‰½à‰tœ¤¹™½É…  ¡¥¹ÁÕÐ¤€ôø¥¹ÁÕÐ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¡…¹”ˆ°€ ¤€ôøì(€€€€€€€¥˜€¡¥¹ÁÕÐ¹¡•­•¤Í•±•Ñ•‘…Í•Ì¹…‘¡¥¹ÁÕÐ¹Ù…±Õ”¤ì•±Í”Í•±•Ñ•‘…Í•Ì¹‘•±•Ñ”¡¥¹ÁÕÐ¹Ù…±Õ”¤ì(€€€€€€€É•¹‘•É±…É¥™¥…Ñ¥½¹…¹‘¥‘…Ñ•Ì ¤ì(€€€€€ô¤¤ì(€€€€€€ ˆ™¥±•±…É¥™¥…Ñ¥½¹½Õ¹Ðˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ôƒ‚æ‚â—‚âß‚â·‚â€‘í¹Õ´¡Í•±•Ñ•‘…Í•Ì¹Í¥é”¥ôƒ‚â#‚âË‚â€‘í¹Õ´¡Ù¥Í¥‰±”¹±•¹Ñ ¥ôƒ‚æ‚â‚â«‚â_‚â×‚æ#‚æ‚â«‚âS‚â€ì(€€€€€€ ˆ™¥±•5…Ñ¡±…É¥™¥…Ñ¥½¸ˆ¤¹‘¥Í…‰±•€ôÍ•±•Ñ•‘…Í•Ì¹Í¥é”€ôôô€Àì(€€€ôì(€€€€ ˆ™¥±•±…É¥™¥…Ñ¥½¹M…µ•…äˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¡…¹”ˆ°É•¹‘•É±…É¥™¥…Ñ¥½¹…¹‘¥‘…Ñ•Ì¤ì(€€€€ ˆ™¥±•±…É¥™¥…Ñ¥½¹5¥ÍÍ¥¹=¹±äˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¡…¹”ˆ°É•¹‘•É±…É¥™¥…Ñ¥½¹…¹‘¥‘…Ñ•Ì¤ì(€€€€ ˆ™¥±•±…É¥™¥…Ñ¥½¹M•±•Ñ±°ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€€€½¹ÍÐÙ¥Í¥‰±”€ôÙ¥Í¥‰±•…¹‘¥‘…Ñ•Ì ¤ì(€€€€€½¹ÍÐ…±±M•±•Ñ•€ôÙ¥Í¥‰±”¹±•¹Ñ €˜˜Ù¥Í¥‰±”¹•Ù•Éä ¡É½Ü¤€ôøÍ•±•Ñ•‘…Í•Ì¹¡…Ì¡É½Ü¹‘‰%¤¤ì(€€€€€Ù¥Í¥‰±”¹™½É…  ¡É½Ü¤€ôø…±±M•±•Ñ•€üÍ•±•Ñ•‘…Í•Ì¹‘•±•Ñ”¡É½Ü¹‘‰%¤€èÍ•±•Ñ•‘…Í•Ì¹…‘¡É½Ü¹‘‰%¤¤ì(€€€€€É•¹‘•É±…É¥™¥…Ñ¥½¹…¹‘¥‘…Ñ•Ì ¤ì(€€€ô¤ì(€€€€ ˆ™¥±•5…Ñ¡±…É¥™¥…Ñ¥½¸ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°…Íå¹Œ€¡•Ù•¹Ð¤€ôøì(€€€€€½¹ÍÐ‰ÕÑÑ½¸€ô•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ðì(€€€€€½¹ÍÐ¥‘Ì€ôl¸¸¹Í•±•Ñ•‘…Í•Ítì(€€€€€¥˜€ …¥‘Ì¹±•¹Ñ ¤É•ÑÕÉ¸ì(€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ôÑÉÕ”ì(€€€€€‰ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ôƒ‚â‚âÏ‚â—‚âÇ‚â‚â#‚âÇ‚âk‚â‚âç‚æ €‘í¹Õ´¡¥‘Ì¹±•¹Ñ ¥ôƒ‚æ‚â‚â¨¸¸¹€ì(€€€€€ÑÉäì(€€€€€€€½¹ÍÐ¹½Ñ”€ô€ ˆ™¥±•±…É¥™¥…Ñ¥½¹9½Ñ”ˆ¤¹Ù…±Õ”¹ÑÉ¥´ ¤ì(€€€€€€€½¹ÍÐÉ•ÍÕ±Ð€ô…Ý…¥ÐMˆ¹µ…¹Õ…±5…Ñ¡±…É¥™¥…Ñ¥½¹¥±”¡µ•Ñ„¹¥°¥‘Ì°¹½Ñ”¤ì(€€€€€€€¹•á•ÁÑ¥½¹Ì¹™½É…  ¡É½Ü¤€ôøì(€€€€€€€€€¥˜€ …¥‘Ì¹¥¹±Õ‘•Ì¡É½Ü¹‘‰%¤¤É•ÑÕÉ¸ì(€€€€€€€€€=‰©•Ð¹…ÍÍ¥¸¡É½Ü°ì(€€€€€€€€€€€ÍÑ…ÑÕÌè€‰…¹ÍÝ•É•ˆ°¡…ÍÙ¥‘•¹”èÑÉÕ”°±…É¥™¥…Ñ¥½¹¥±•%èµ•Ñ„¹¥°(€€€€€€€€€€€É•Í½±ÕÑ¥½¹9½Ñ”è¹½Ñ”°É•Í½±Ù•‘	äèMˆ¹ÕÉÉ•¹Ñµ…¥° ¤ñð€‰Ý•ˆµ…Õ‘¥Ñ½Èˆ°µ…Ñ¡½¹™¥‘•¹”è€ÄÀÀ°(€€€€€€€€€ô¤ì(€€€€€€€ô¤ì(€€€€€€€•á•ÁÑ¥½¹MÕÁÁ½ÉÑ…¡”¹±•…È ¤ì(€€€€€€€±½Ñ¥½¸ ‰±…É¥™¥…Ñ¥½¹}µ…¹Õ…±}µÕ±Ñ¥}µ…Ñ ˆ°€‰Í½ÕÉ•}™¥±”ˆ°µ•Ñ„¹¥°ƒ‚â#‚âÇ‚âk‚â‚âç‚æ €‘í¹…µ•ôƒ‚â‚âÇ‚âh€‘í¥‘Ì¹±•¹Ñ¡ôƒ‚æ‚â‚â«‚â‚â·‚â€‘íµ•Ñ„¹½µÁ…¹åõ€¤ì(€€€€€€€±½Í•5½‘…° ¤ì(€€€€€€€É•¹‘•È ¤ì(€€€€€€€Í¡½Ý…Í•MÕ‰µ¥ÍÍ¥½¹I••¥ÁÐ ±…É¥™¥…Ñ¥½¸œ±ƒ‚â«‚æ#‚â‚æ‚â·‚â‚â«‚âË‚â‚æ‚â¯‚æ'‚âW‚â‚âŸ‚â €‘í¹Õ´¡É•ÍÕ±Ðü¹µ…Ñ¡•‘}½Õ¹Ðñð¥‘Ì¹±•¹Ñ ¥ôƒ‚æ‚â‚â©€¤ì(€€€€€€€Í•ÑQ¥µ•½ÕÐ  ¤€ôø±½…‘1¥Ù•=Ù•ÉÙ¥•Ü¡ÑÉÕ”¤°€ÌÀÀ¤ì(€€€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ô™…±Í”ì(€€€€€€€‰ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô€‹‚â#‚âÇ‚âk‚â‚âç‚æ#‚â‚âÇ‚âk‚æ‚â‚â«‚â_‚â×‚æ#‚æ‚â—‚âß‚â·‚âˆì(€€€€€€€Ñ½…ÍÐ¡ƒ‚â#‚âÇ‚âk‚â‚âç‚æ#‚æ‚â‚â—‚æ3‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â è€‘í•ÉÉ½È¹µ•ÍÍ…•õ€°€‰Ý…É¸ˆ¤ì(€€€€€ô(€€€ô¤ì(€€€½¹ÍÐ±½…±I½ÝÌ€ô¹•á•ÁÑ¥½¹Ì¹™¥±Ñ•È ¡É½Ü¤€ôøMÑÉ¥¹œ¡É½Ü¹½µÁ…¹ä¤¹Ñ½UÁÁ•É…Í” ¤€ôôôMÑÉ¥¹œ¡µ•Ñ„¹½µÁ…¹äñð€ˆˆ¤¹Ñ½UÁÁ•É…Í” ¤¤ì(€€€±…É¥™¥…Ñ¥½¹…¹‘¥‘…Ñ•Ì€ô±½…±I½ÝÌì(€€€É•¹‘•É±…É¥™¥…Ñ¥½¹…¹‘¥‘…Ñ•Ì ¤ì(€€€Mˆ¹ÕÉÉ•¹Ñá•ÁÑ¥½¹ÍMÕµµ…Éä¡ì™É½´èY%M%	1}Q}I=4°Ñ¼èU1Q}]=I-}Q°½µÁ…¹äèµ•Ñ„¹½µÁ…¹ä°±¥µ¥Ðè€ÔÀÀÀô¤(€€€€€€¹Ñ¡•¸ ¡É½ÝÌ¤€ôøì(€€€€€€€½¹ÍÐµ•É•€ô¹•Ü5…À¡±½…±I½ÝÌ¹µ…À ¡É½Ü¤€ôømÉ½Ü¹‘‰%°É½Ýt¤¤ì(€€€€€€€…Ñ¥½¹…‰±•Õ‘¥ÑI½ÝÌ¡É½ÝÌ¤¹µ…À¡µ…Á1¥Ù•á•ÁÑ¥½¸¤¹™½É…  ¡É½Ü¤€ôøµ•É•¹Í•Ð¡É½Ü¹‘‰%°É½Ü¤¤ì(€€€€€€€±…É¥™¥…Ñ¥½¹…¹‘¥‘…Ñ•Ì€ôl¸¸¹µ•É•¹Ù…±Õ•Ì ¥t¹Í½ÉÐ ¡„°ˆ¤€ôø€¡„¹‘…Ñ”€ôôôµ•Ñ„¹‘…Ñ”€ü€´Ä€è€À¤€´€¡ˆ¹‘…Ñ”€ôôôµ•Ñ„¹‘…Ñ”€ü€´Ä€è€À¤ñðMÑÉ¥¹œ¡ˆ¹‘…Ñ”¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡„¹‘…Ñ”¤¤ñðMÑÉ¥¹œ¡„¹Ñ¥µ”¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡ˆ¹Ñ¥µ”¤¤¤ì(€€€€€€€€ ˆ™¥±•±…É¥™¥…Ñ¥½¹MÁ¥¹¹•Èˆ¤ü¹É•µ½Ù” ¤ì(€€€€€€€É•¹‘•É±…É¥™¥…Ñ¥½¹…¹‘¥‘…Ñ•Ì ¤ì(€€€€€ô¤(€€€€€€¹…Ñ  ¡•ÉÉ½È¤€ôøì(€€€€€€€€ ˆ™¥±•±…É¥™¥…Ñ¥½¹MÁ¥¹¹•Èˆ¤ü¹É•µ½Ù” ¤ì(€€€€€€€€ ˆ™¥±•±…É¥™¥…Ñ¥½¹½Õ¹Ðˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô±½…±I½ÝÌ¹±•¹Ñ €üƒ‚æ‚â«‚âS‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚â_‚â×‚æ#‚æ‚â¯‚â—‚âS‚æ‚âŸ‚æ$€‘í¹Õ´¡±½…±I½ÝÌ¹±•¹Ñ ¥ôƒ‚æ‚â‚â©€€èƒ‚æ‚â¯‚â—‚âS‚æ‚â‚â«‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â è€‘í•ÉÉ½È¹µ•ÍÍ…•õ€ì(€€€€€ô¤ì(€ô(€€ ˆ™¥±•=Á•¹=É¥¥¹…°ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°…Íå¹Œ€ ¤€ôøì(€€€ÑÉäì(€€€€€Ý¥¹‘½Ü¹½Á•¸¡…Ý…¥Ð•ÑM¥¹• ¤°€‰}‰±…¹¬ˆ°€‰¹½½Á•¹•Èˆ¤ì(€€€€€±½Ñ¥½¸ ‰Ù¥•Ý}™¥±”ˆ°€‰Í½ÕÉ•}™¥±”ˆ°µ•Ñ„¹¥ñðµ•Ñ„¹Á…Ñ °ƒ‚æ‚âo‚âÓ‚âS‚æ‚â‚â—‚æ3‚âW‚æ'‚âg‚â'‚âk‚âÇ‚âh€‘í¹…µ•ôƒ‚æ‚âg‚æ‚â_‚æ‚âk‚æ‚â¯‚â‡‚æ!€¤ì(€€€ô…Ñ €¡•ÉÉ½È¤ìÑ½…ÍÐ¡•ÉÉ½È¹µ•ÍÍ…”°€‰Ý…É¸ˆ¤ìô(€ô¤ì(€€ ˆ™¥±•½Ý¹±½…ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°…Íå¹Œ€¡•Ù•¹Ð¤€ôøì(€€€½¹ÍÐ‰ÕÑÑ½¸€ô•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ðì(€€€½¹ÍÐ½±€ô‰ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ðì(€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ôÑÉÕ”ì(€€€‰ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô€‹‚â‚âÏ‚â—‚âÇ‚â‚âS‚âË‚âŸ‚âg‚æ3‚æ‚â¯‚â—‚âP¸¸¸ˆì(€€€ÑÉäì(€€€€€½¹ÍÐ‰Õ™™•È€ô…Ý…¥Ð•Ñ½Ý¹±½… ¤ì(€€€€€½¹ÍÐ‰±½ˆ€ô¹•Ü	±½ˆ¡m‰Õ™™•Ét°ìÑåÁ”èµ•Ñ„¹µ¥µ”ñð€‰…ÁÁ±¥…Ñ¥½¸½½Ñ•ÐµÍÑÉ•…´ˆô¤ì(€€€€€½¹ÍÐÕÉ°€ôUI0¹É•…Ñ•=‰©•ÑUI0¡‰±½ˆ¤ì(€€€€€½¹ÍÐ…¹¡½È€ô‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰„ˆ¤ì(€€€€€…¹¡½È¹¡É•˜€ôÕÉ°ì(€€€€€…¹¡½È¹‘½Ý¹±½…€ô¹…µ”ì(€€€€€‘½Õµ•¹Ð¹‰½‘ä¹…ÁÁ•¹‘¡¥±¡…¹¡½È¤ì(€€€€€…¹¡½È¹±¥¬ ¤ì(€€€€€Í•ÑQ¥µ•½ÕÐ  ¤€ôøìUI0¹É•Ù½­•=‰©•ÑUI0¡ÕÉ°¤ì…¹¡½È¹É•µ½Ù” ¤ìô°€ÄÀÀÀ¤ì(€€€€€±½Ñ¥½¸ ‰‘½Ý¹±½…‘}™¥±”ˆ°€‰Í½ÕÉ•}™¥±”ˆ°µ•Ñ„¹¥ñðµ•Ñ„¹Á…Ñ °ƒ‚âS‚âË‚âŸ‚âg‚æ3‚æ‚â¯‚â—‚âS‚æ‚â‚â—‚æ0€‘í¹…µ•õ€¤ì(€€€€€Ñ½…ÍÐ ‹‚æ‚â‚âÓ‚æ#‚â‡‚âS‚âË‚âŸ‚âg‚æ3‚æ‚â¯‚â—‚âP€ˆ€¬¹…µ”¤ì(€€€ô…Ñ €¡•ÉÉ½È¤ìÑ½…ÍÐ¡•ÉÉ½È¹µ•ÍÍ…”°€‰Ý…É¸ˆ¤ìô(€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ô™…±Í”ì(€€€‰ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô½±ì(€ô¤ì(€¥˜€¡…¹I•±…ÍÍ¥™ä¤€ ˆ™¥±•-¥¹‘M•±•Ðˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¡…¹”ˆ°€¡•Ù•¹Ð¤€ôøì(€€€½¹ÍÐ½ÁÑ¥½¸€ô­¥¹‘=ÁÑ¥½¹Ì¹™¥¹ ¡m­¥¹‘t¤€ôø­¥¹€ôôô•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¤ì(€€€€ ˆ™¥±•-¥¹‘!•±Àˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô½ÁÑ¥½¸€ü½ÁÑ¥½¹lÉt€è€‹‚âW‚â‚âŸ‚â#‚æ‚âg‚âß‚æ'‚â·‚â¯‚âË‚æ‚â‚â—‚æ3‚â‚æ#‚â·‚âg‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âo‚â‚âÃ‚æ‚âƒ‚â\ˆì(€ô¤ì(€¥˜€¡…¹I•±…ÍÍ¥™ä¤€ ˆ™¥±•I•±…ÍÍ¥™äˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°…Íå¹Œ€¡•Ù•¹Ð¤€ôøì(€€€½¹ÍÐ‰ÕÑÑ½¸€ô•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ðì(€€€½¹ÍÐ½±€ô‰ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ðì(€€€½¹ÍÐ½µÁ…¹ä€ô€ ˆ™¥±•½µÁ…¹åM•±•Ðˆ¤¹Ù…±Õ”ì(€€€½¹ÍÐ­¥¹€ô€ ˆ™¥±•-¥¹‘M•±•Ðˆ¤¹Ù…±Õ”ì(€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ôÑÉÕ”ì(€€€‰ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ôÁ•¹‘¥¹I•Á±…•µ•¹Ñ¥±”€ü€‹‚â‚âÏ‚â—‚âÇ‚â‚â·‚âÇ‚âo‚æ‚â¯‚â—‚âS‚æ‚â—‚âÃ‚âk‚âÇ‚âg‚â_‚âÛ‚â¸¸¸ˆ€è€‹‚â‚âÏ‚â—‚âÇ‚â‚âk‚âÇ‚âg‚â_‚âÛ‚â¸¸¸ˆì(€€€ÑÉäì(€€€€€½¹ÍÐÉ•Á±…•µ•¹Ð€ôÁ•¹‘¥¹I•Á±…•µ•¹Ñ¥±”ì(€€€€€½¹ÍÐÉ•ÍÕ±Ð€ôÉ•Á±…•µ•¹Ð(€€€€€€€€ü…Ý…¥ÐMˆ¹É•Á±…•M½ÕÉ•¥±”¡µ•Ñ„¹¥°µ•Ñ„¹Á…Ñ °É•Á±…•µ•¹Ð°½µÁ…¹ä°­¥¹¤(€€€€€€€€è…Ý…¥ÐMˆ¹É•±…ÍÍ¥™åM½ÕÉ•¥±”¡µ•Ñ„¹¥°½µÁ…¹ä°­¥¹¤ì(€€€€€±½Ñ¥½¸ (€€€€€€€É•Á±…•µ•¹Ð€ü€‰É•Á±…•}Í½ÕÉ•}™¥±•}…¹‘}É•ÑÉäˆ€è€‰É•±…ÍÍ¥™å}…¹‘}É•ÑÉäˆ°(€€€€€€€€‰Í½ÕÉ•}™¥±”ˆ°(€€€€€€€µ•Ñ„¹¥°(€€€€€€€É•Á±…•µ•¹Ð€ü€‘í¹…µ•ôƒŠH€‘íÉ•Á±…•µ•¹Ð¹¹…µ•õ€€è€‘í¹…µ•ôƒŠH€‘í½µÁ…¹åô€¼€‘í­¥¹‘õ€°(€€€€€€¤ì(€€€€€ÕÁ‘…Ñ•M½ÕÉ•¥±•…¡•Ì¡µ•Ñ„¹¥°ì(€€€€€€€€¸¸¸¡É•Á±…•µ•¹Ð€üì(€€€€€€€€€™¥±•}¹…µ”èÉ•ÍÕ±Ðü¹™¥±•}¹…µ”ñðÉ•Á±…•µ•¹Ð¹¹…µ”°(€€€€€€€€€µ¥µ•}ÑåÁ”èÉ•ÍÕ±Ðü¹µ¥µ•}ÑåÁ”ñðÉ•Á±…•µ•¹Ð¹ÑåÁ”ñð€‰…ÁÁ±¥…Ñ¥½¸½½Ñ•ÐµÍÑÉ•…´ˆ°(€€€€€€€€€Í¥é•}‰åÑ•ÌèÉ•ÍÕ±Ðü¹Í¥é•}‰åÑ•ÌñðÉ•Á±…•µ•¹Ð¹Í¥é”°(€€€€€€€€€ÍÑ½É…•}Á…Ñ èÉ•ÍÕ±Ðü¹ÍÑ½É…•}Á…Ñ °(€€€€€€€€€¡•­ÍÕ´èÉ•ÍÕ±Ðü¹¡•­ÍÕ´ñð¹Õ±°°(€€€€€€€ô€èíô¤°(€€€€€€€½µÁ…¹ä°(€€€€€€€­¥¹°(€€€€€€€Á…ÉÍ•è™…±Í”°(€€€€€€€Á…ÉÍ•‘}…Ðè¹Õ±°°(€€€€€€€É½Ý}½Õ¹Ðè¹Õ±°°(€€€€€€€Á…ÉÍ•}•ÉÉ½Èè¹Õ±°°(€€€€€ô¤ì(€€€€€±½Í•5½‘…° ¤ì(€€€€€½¹ÍÐÅÕ•Õ•€ôÉ•ÍÕ±Ð€˜˜É•ÍÕ±Ð¹ÅÕ•Õ•ì(€€€€€Ñ½…ÍÐ (€€€€€€€É•Á±…•µ•¹Ð(€€€€€€€€€€ü€¡ÅÕ•Õ•€ü€‹‚æ‚â_‚âg‚â_‚â×‚æ#‚æ‚â‚â—‚æ3‚æ‚â—‚æ'‚âœƒ‚æ‚â—‚âÃ‚â«‚æ#‚â‚æ‚â‚â—‚æ3‚æ‚â¯‚â‡‚æ#‚æ‚â‚æ'‚âË‚â‚âÓ‚âŸ‚âW‚â‚âŸ‚â#‚æ‚â—‚æ'‚âœˆ€è€‹‚æ‚â_‚âg‚â_‚â×‚æ#‚æ‚â‚â—‚æ3‚æ‚â—‚æ'‚âœƒŠPƒ‚â‹‚âÇ‚â‚â‚â·‚æ‚â‚â—‚æ3‚âk‚âÇ‚â‚â‚âÇ‚âk‚æ‚â¯‚æ'‚â‚â‚âk‚â‚æ#‚â·‚âg‚æ‚â‚æ'‚âË‚â‚âÓ‚âœˆ¤(€€€€€€€€€€è€¡ÅÕ•Õ•€ü€‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â—‚æ'‚âœƒ‚æ‚â—‚âÃ‚â«‚æ#‚â‚æ‚â‚æ'‚âË‚â‚âÓ‚âŸ‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚æ‚â—‚æ'‚âœˆ€è€‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â—‚æ'‚âœƒŠPƒ‚â‹‚âÇ‚â‚â‚â·‚æ‚â‚â—‚æ3‚âk‚âÇ‚â‚â‚âÇ‚âk‚æ‚â¯‚æ'‚â‚â‚âk‚â‚æ#‚â·‚âg‚æ‚â‚æ'‚âË‚â‚âÓ‚âœˆ¤°(€€€€€€€ÅÕ•Õ•€ü€‰½¬ˆ€è€‰Ý…É¸ˆ°(€€€€€€¤ì(€€€€€É•¹‘•È ¤ì(€€€€€€¼¼M…Ù”™••±Ì¥µµ•‘¥…Ñ”ìÉ•™É•Í ½¹±äÑ¡”Á…”ÕÉÉ•¹Ñ±ä¥¸ÕÍ”¥¹ÍÑ•…(€€€€€€¼¼½˜É•±½…‘¥¹œ‘…Í¡‰½…É°¥¹Ñ…­”°‘…¥±äÍÕµµ…Éä…¹±½Õ½¹ÕÉÉ•¹Ñ±ä¸(€€€€€Í•ÑQ¥µ•½ÕÐ  ¤€ôøì(€€€€€€€¥˜€¡ÍÑ…Ñ”¹É½ÕÑ”€ôôô€‰±½Õˆ¤±½Õ‘1½… ¤ì(€€€€€€€•±Í”¥˜€¡ÍÑ…Ñ”¹É½ÕÑ”€ôôô€‰‘…¥±äµÍÕµµ…Éäˆ¤±½…‘…¥±å½µÁ…¹åMÕµµ…Éä¡ÑÉÕ”¤ì(€€€€€€€•±Í”¥˜€¡ÍÑ…Ñ”¹É½ÕÑ”€ôôô€‰¥¹Ñ…­”ˆ¤±½…‘1¥Ù•%¹Ñ…­”¡ÑÉÕ”¤ì(€€€€€€€•±Í”±½…‘1¥Ù•=Ù•ÉÙ¥•Ü¡ÑÉÕ”¤ì(€€€€€ô°€ÌÀÀ¤ì(€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€½¹ÍÐ…Ñ¥½¸€ôÁ•¹‘¥¹I•Á±…•µ•¹Ñ¥±”€ü€‹‚æ‚â_‚âg‚â_‚â×‚æ#‚æ‚â‚â—‚æ3‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ˆ€è€‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚âo‚â‚âÃ‚æ‚âƒ‚â_‚æ‚â‚â—‚æ3‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ˆì(€€€€€½¹ÍÐ‘•Ñ…¥°€ôMÑÉ¥¹œ¡•ÉÉ½Èü¹µ•ÍÍ…”ñð€‹‚æ‚â‚âÓ‚âS‚â‚æ'‚â·‚âs‚âÓ‚âS‚â{‚â—‚âË‚âPƒ‚â‚â‚âã‚âO‚âË‚â—‚â·‚â‚æ‚â¯‚â‡‚æ ˆ¤ì(€€€€€Ñ½…ÍÐ¡€‘í…Ñ¥½¹ôè€‘í‘•Ñ…¥±õ€°€‰Ý…É¸ˆ¤ì(€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ô™…±Í”ì(€€€€€‰ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô½±ì(€€€ô(€ô¤ì(€¥˜€¡…¹I•±…ÍÍ¥™ä¤ì(€€€½¹ÍÐÉ•Á±…•µ•¹Ñ%¹ÁÕÐ€ô€ ˆ™¥±•I•Á±…•µ•¹Ñ%¹ÁÕÐˆ¤ì(€€€½¹ÍÐÉ•Á±…•µ•¹Ñ	ÕÑÑ½¸€ô€ ˆ™¥±•I•Á±…•UÁ±½…ˆ¤ì(€€€É•Á±…•µ•¹Ñ	ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€€€É•Á±…•µ•¹Ñ%¹ÁÕÐ¹Ù…±Õ”€ô€ˆˆì(€€€€€É•Á±…•µ•¹Ñ%¹ÁÕÐ¹±¥¬ ¤ì(€€€ô¤ì(€€€É•Á±…•µ•¹Ñ%¹ÁÕÐ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¡…¹”ˆ°…Íå¹Œ€ ¤€ôøì(€€€€€½¹ÍÐ™¥±”€ôÉ•Á±…•µ•¹Ñ%¹ÁÕÐ¹™¥±•Ì€˜˜É•Á±…•µ•¹Ñ%¹ÁÕÐ¹™¥±•ÍlÁtì(€€€€€¥˜€ …™¥±”¤É•ÑÕÉ¸ì(€€€€€½¹ÍÐÍ…Ù•	ÕÑÑ½¸€ô€ ˆ™¥±•I•±…ÍÍ¥™äˆ¤ì(€€€€€½¹ÍÐ½±‘1…‰•°€ôÉ•Á±…•µ•¹Ñ	ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ðì(€€€€€ÑÉäì(€€€€€€€É•Á±…•µ•¹Ñ	ÕÑÑ½¸¹‘¥Í…‰±•€ôÑÉÕ”ì(€€€€€€€Í…Ù•	ÕÑÑ½¸¹‘¥Í…‰±•€ôÑÉÕ”ì(€€€€€€€É•Á±…•µ•¹Ñ	ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô€‹‚â‚âÏ‚â—‚âÇ‚â‚âW‚â‚âŸ‚â#‚æ‚â‚â—‚æ3‚æ‚â¯‚â‡‚æ ¸¸¸ˆì(€€€€€€€…Ý…¥ÐÙ…±¥‘…Ñ•I•Á±…•µ•¹Ñ¥±”¡™¥±”¤ì(€€€€€€€Á•¹‘¥¹I•Á±…•µ•¹Ñ¥±”€ô™¥±”ì(€€€€€€€½¹ÍÐÑ…É•Ð€ô€ ˆ™¥±•AÉ•Ù¥•Ý½¹Ñ•¹Ðˆ¤ì(€€€€€€€½¹ÍÐÉ•Á±…•µ•¹ÑáÐ€ô€¡™¥±”¹¹…µ”¹ÍÁ±¥Ð ˆ¸ˆ¤¹Á½À ¤ñð€ˆˆ¤¹Ñ½1½Ý•É…Í” ¤ì(€€€€€€€½¹ÍÐ‰Õ™™•È€ô…Ý…¥Ð™¥±”¹…ÉÉ…å	Õ™™•È ¤ì(€€€€€€€Ñ…É•Ð¹¥¹¹•É!Q50€ô€ñÍÁ…¸±…ÍÌô‰ÍÁ¥¹¹•Èˆøð½ÍÁ…¸øñÀû‚â‚âÏ‚â—‚âÇ‚â‚æ‚â«‚âS‚â‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚â‚æ‚â‚â—‚æ3‚æ‚â¯‚â‡‚æ ¸¸¸ð½Àù€ì(€€€€€€€¥˜€¡Á•¹‘¥¹I•Á±…•µ•¹Ñ=‰©•ÑUÉ°¤UI0¹É•Ù½­•=‰©•ÑUI0¡Á•¹‘¥¹I•Á±…•µ•¹Ñ=‰©•ÑUÉ°¤ì(€€€€€€€Á•¹‘¥¹I•Á±…•µ•¹Ñ=‰©•ÑUÉ°€ô€ˆˆì(€€€€€€€¥˜€¡É•Á±…•µ•¹ÑáÐ€ôôô€‰Á‘˜ˆ¤ì(€€€€€€€€€Á•¹‘¥¹I•Á±…•µ•¹Ñ=‰©•ÑUÉ°€ôUI0¹É•…Ñ•=‰©•ÑUI0¡™¥±”¤ì(€€€€€€€€€Ñ…É•Ð¹¥¹¹•É!Q50€ô€ñ¥™É…µ”±…ÍÌô‰™¥±”µÁÉ•Ù¥•Üµ™É…µ”ˆÍÉŒôˆ‘í ¡Á•¹‘¥¹I•Á±…•µ•¹Ñ=‰©•ÑUÉ°¥ôˆÑ¥Ñ±”ô‹‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚â€‘í ¡™¥±”¹¹…µ”¥ôˆøð½¥™É…µ”ù€ì(€€€€€€€ô•±Í”¥˜€¡l‰á±Íàˆ°€‰á±Í´‰t¹¥¹±Õ‘•Ì¡É•Á±…•µ•¹ÑáÐ¤¤ì(€€€€€€€€€Ñ…É•Ð¹¥¹¹•É!Q50€ô™¥±•AÉ•Ù¥•ÝQ…‰±”¡…Ý…¥Ða±ÍáI•…‘•È¹É•…¡‰Õ™™•È¤¤ì(€€€€€€€ô•±Í”¥˜€¡l‰ÍØˆ°€‰ÑáÐ‰t¹¥¹±Õ‘•Ì¡É•Á±…•µ•¹ÑáÐ¤¤ì(€€€€€€€€€½¹ÍÐÑ•áÐ€ô¹•ÜQ•áÑ•½‘•È ‰ÕÑ˜´àˆ¤¹‘•½‘”¡‰Õ™™•È¤ì(€€€€€€€€€Ñ…É•Ð¹¥¹¹•É!Q50€ô™¥±•AÉ•Ù¥•ÝQ…‰±”¡É•Á±…•µ•¹ÑáÐ€ôôô€‰ÍØˆ€ü¹¥¹”¹Á…ÉÍ•MX¡Ñ•áÐ¤€èÑ•áÐ¹ÍÁ±¥Ð ½qÈýq¸¼¤¹µ…À ¡±¥¹”¤€ôøm±¥¹•t¤¤ì(€€€€€€€ô•±Í”¥˜€¡É•Á±…•µ•¹ÑáÐ€ôôô€‰‘½àˆ¤ì(€€€€€€€€€½¹ÍÐÁÉ•Ù¥•Ü€ô…Ý…¥Ð½áI•…‘•È¹É•¹‘•È¡‰Õ™™•È¤ì(€€€€€€€€€Ñ…É•Ð¹É•Á±…•¡¥±‘É•¸¡ÁÉ•Ù¥•Ü¹•±•µ•¹Ð¤ì(€€€€€€€€€€ ˆµ½‘…°ˆ¤¹}½¹Ñ•¹Ñ±•…¹ÕÀ€ô€ ¤€ôøì(€€€€€€€€€€€ÁÉ•Ù¥•Ü¹±•…¹ÕÀ ¤ì(€€€€€€€€€€€¥˜€¡Á•¹‘¥¹I•Á±…•µ•¹Ñ=‰©•ÑUÉ°¤UI0¹É•Ù½­•=‰©•ÑUI0¡Á•¹‘¥¹I•Á±…•µ•¹Ñ=‰©•ÑUÉ°¤ì(€€€€€€€€€ôì(€€€€€€€ô(€€€€€€€¥˜€¡É•Á±…•µ•¹ÑáÐ€„ôô€‰‘½àˆ¤€ ˆµ½‘…°ˆ¤¹}½¹Ñ•¹Ñ±•…¹ÕÀ€ô€ ¤€ôøì(€€€€€€€€€¥˜€¡Á•¹‘¥¹I•Á±…•µ•¹Ñ=‰©•ÑUÉ°¤UI0¹É•Ù½­•=‰©•ÑUI0¡Á•¹‘¥¹I•Á±…•µ•¹Ñ=‰©•ÑUÉ°¤ì(€€€€€€€ôì(€€€€€€€€ ˆµ½‘…±Q¥Ñ±”ˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô™¥±”¹¹…µ”ì(€€€€€€€€ ˆ™¥±•AÉ•Ù¥•ÝM¥é”ˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô€‘í5…Ñ ¹µ…à Ä°5…Ñ ¹É½Õ¹¡™¥±”¹Í¥é”€¼€ÄÀÈÐ¤¤¹Ñ½1½…±•MÑÉ¥¹œ ¥ô-	€ì(€€€€€€€€ ˆ™¥±•AÉ•Ù¥•ÝMÑ…ÑÕÌˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô€‹‚æ‚â‚â—‚æ3‚æ‚â¯‚â‡‚æ#‚â{‚â‚æ'‚â·‚â‡‚âk‚âÇ‚âg‚â_‚âÛ‚âˆì(€€€€€€€€ ˆ™¥±•I•Á±…•µ•¹ÑI•…‘å9…µ”ˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô™¥±”¹¹…µ”ì(€€€€€€€€ ˆ™¥±•I•Á±…•µ•¹ÑI•…‘äˆ¤¹¡¥‘‘•¸€ô™…±Í”ì(€€€€€€€É•Á±…•µ•¹Ñ	ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô€‹‚æ‚âo‚â—‚â×‚æ#‚â‹‚âg‚æ‚â‚â—‚æ3‚æ‚â¯‚â‡‚æ#‚â·‚â×‚â‚â‚â‚âÇ‚æ'‚âˆì(€€€€€€€€ ˆ™¥±•=Á•¹=É¥¥¹…°ˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô€‹‚æ‚âo‚âÓ‚âS‚æ‚â‚â—‚æ3‚æ‚âS‚âÓ‚â‡‚æ‚âg‚æ‚â_‚æ‚âk‚æ‚â¯‚â‡‚æ ˆì(€€€€€€€€ ˆ™¥±•½Ý¹±½…ˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô€‹‚âS‚âË‚âŸ‚âg‚æ3‚æ‚â¯‚â—‚âS‚æ‚â‚â—‚æ3‚æ‚âS‚âÓ‚â„ˆì(€€€€€€€Ñ½…ÍÐ ‹‚æ‚â«‚âS‚â‚æ‚â‚â—‚æ3‚æ‚â¯‚â‡‚æ#‚æ‚â—‚æ'‚âœƒ‚âW‚â‚âŸ‚â#‚â‚æ'‚â·‚â‡‚âç‚â—‚â‚æ#‚â·‚âg‚â‚âS‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â—‚âÃ‚â‚âÇ‚âg‚âW‚æ#‚â´ˆ°€‰½¬ˆ¤ì(€€€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€€€Á•¹‘¥¹I•Á±…•µ•¹Ñ¥±”€ô¹Õ±°ì(€€€€€€€Ñ½…ÍÐ ‹‚âW‚â‚âŸ‚â#‚æ‚â‚â—‚æ3‚æ‚â¯‚â‡‚æ#‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â è€ˆ€¬•ÉÉ½È¹µ•ÍÍ…”°€‰Ý…É¸ˆ¤ì(€€€€€ô™¥¹…±±äì(€€€€€€€¥˜€¡É•Á±…•µ•¹Ñ	ÕÑÑ½¸€˜˜‘½Õµ•¹Ð¹‰½‘ä¹½¹Ñ…¥¹Ì¡É•Á±…•µ•¹Ñ	ÕÑÑ½¸¤¤ì(€€€€€€€€€É•Á±…•µ•¹Ñ	ÕÑÑ½¸¹‘¥Í…‰±•€ô™…±Í”ì(€€€€€€€€€¥˜€ …Á•¹‘¥¹I•Á±…•µ•¹Ñ¥±”¤É•Á±…•µ•¹Ñ	ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô½±‘1…‰•°ì(€€€€€€€ô(€€€€€€€¥˜€¡Í…Ù•	ÕÑÑ½¸€˜˜‘½Õµ•¹Ð¹‰½‘ä¹½¹Ñ…¥¹Ì¡Í…Ù•	ÕÑÑ½¸¤¤Í…Ù•	ÕÑÑ½¸¹‘¥Í…‰±•€ô™…±Í”ì(€€€€€ô(€€€ô¤ì(€ô((€ÑÉäì(€€€½¹ÍÐÑ…É•Ð€ô€ ˆ™¥±•AÉ•Ù¥•Ý½¹Ñ•¹Ðˆ¤ì(€€€¥˜€ …Ñ…É•Ð¤É•ÑÕÉ¸ì(€€€¥˜€¡l‰Á‘˜‰t¹¥¹±Õ‘•Ì¡•áÐ¤ñðMÑÉ¥¹œ¡µ•Ñ„¹µ¥µ”¤¹¥¹±Õ‘•Ì ‰Á‘˜ˆ¤¤ì(€€€€€¥˜¡µ•Ñ„¹É•…‘=¹±ä¤ì(€€€€€€€€¼¼I•¹‘•È…ÕÑ¡•¹Ñ¥…Ñ•‰åÑ•Ì¥¸Ñ¡”…ÁÀì‘¼¹½Ð‘•Á•¹½¸„‰É½ÝÍ•ÈAÁ±Õœµ¥¸¸(€€€€€€€½¹ÍÐ±•…¹ÕÀ€ô…Ý…¥ÐMÑ…Ñ•µ•¹ÑAÉ•Ù¥•Ü¹µ½Õ¹Ð¡Ñ…É•Ð°í¥éµ•Ñ„¹¥ñðµ•Ñ„¹Á…Ñ °ÍÑ½É…•}Á…Ñ éµ•Ñ„¹Á…Ñ¡ô¤ì(€€€€€€€¥˜¡Ñ…É•Ð¹¥Í½¹¹•Ñ•¤€ œµ½‘…°œ¤¹}½¹Ñ•¹Ñ±•…¹ÕÀ€ô±•…¹ÕÀì(€€€€€€€•±Í”±•…¹ÕÀü¸ ¤ì(€€€€€€€±½Ñ¥½¸ ÁÉ•Ù¥•Ý}™¥±”œ°…Í•}•Ù¥‘•¹”œ±µ•Ñ„¹¥ñðµ•Ñ„¹Á…Ñ ±ƒ‚âS‚âäAƒ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âd€‘í¹…µ•õ€¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€€€ô(€€€€€½¹ÍÐ½É¥¥¹…±UÉ°€ô…Ý…¥Ð•ÑM¥¹• ¤ì(€€€€€¥˜€¡Á•¹‘¥¹I•Á±…•µ•¹Ñ¥±”¤É•ÑÕÉ¸ì(€€€€€Ñ…É•Ð¹¥¹¹•É!Q50€ô€ñ¥™É…µ”±…ÍÌô‰™¥±”µÁÉ•Ù¥•Üµ™É…µ”ˆÍÉŒôˆ‘í ¡½É¥¥¹…±UÉ°¥ôˆÑ¥Ñ±”ô‹‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚â€‘í ¡¹…µ”¥ôˆøð½¥™É…µ”ù€ì(€€€€€¥˜€¡…¹I•±…ÍÍ¥™ä€˜˜ÑåÁ•½˜Mˆ¹™¥±•=È€ôôô€‰™Õ¹Ñ¥½¸ˆ¤ì(€€€€€€€ÑÉäì(€€€€€€€€€½¹ÍÐ½È€ô…Ý…¥ÐMˆ¹™¥±•=È¡µ•Ñ„¹¥¤ì(€€€€€€€€€¥˜€¡Á•¹‘¥¹I•Á±…•µ•¹Ñ¥±”ñð€…Ñ…É•Ð¹¥Í½¹¹•Ñ•¤É•ÑÕÉ¸ì(€€€€€€€€€A‘™I•Ù¥•Ü¹µ½Õ¹Ð¡Ñ…É•Ð°ìÕÉ°è½É¥¥¹…±UÉ°°•Ù¥‘•¹”è½È°¹…µ”ô¤ì(€€€€€€€€€¥˜€¡µ•Ñ„¹­¥¹€ôôô€ÍÑµ}Á‘˜œ€˜˜lµ½¹¥Ñ½Èœ°…Õ‘¥Ñ}…ÍÍ¥ÍÑ…¹Ðœ°±•…œ°…‘µ¥¸t¹¥¹±Õ‘•Ì¡ÍÑ…Ñ”¹É½±”¤¤ì(€€€€€€€€€€€A‘™M½ÕÉ•ÁÁÉ½Ù…°¹µ½Õ¹Ð¡Ñ…É•Ð°ì(€€€€€€€€€€€€€±½…‘M½ÕÉ”è€ ¤€ôøMˆ¹É•½Ù•ÉåM½ÕÉ”¡µ•Ñ„¹¥¤°(€€€€€€€€€€€€€‘½Ý¹±½…è•Ñ½Ý¹±½…°(€€€€€€€€€€€€€…ÁÁÉ½Ù”è€¡Á…å±½…°¹½Ñ”¤€ôøì(€€€€€€€€€€€€€€€¥˜€¡Á•¹‘¥¹I•Á±…•µ•¹Ñ¥±”¤Ñ¡É½Ü¹•ÜÉÉ½È Ÿ‚â‚â‚âã‚âO‚âË‚âo‚âÓ‚âS‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚æ‚â—‚âß‚â·‚â‚æ‚â_‚âg‚â‚æ#‚â·‚âg‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âW‚æ'‚âg‚â'‚âk‚âÇ‚âk‚æ‚âS‚âÓ‚â„œ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸Mˆ¹…ÁÁÉ½Ù•A‘™I•½Ù•Éä¡Á…å±½…°¹½Ñ”¤ì(€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€½¹A…”èÁ…”€ôøìÑ…É•Ð¹ÅÕ•ÉåM•±•Ñ½È ¥™É…µ”œ¤¹ÍÉŒ€ô½É¥¥¹…±UÉ°¹ÍÁ±¥Ð œŒœ¥lÁt€¬€œÁ…”ôœ€¬Á…”ìô°(€€€€€€€€€€€ô¤ì(€€€€€€€€€ô(€€€€€€€€€¥˜€¡½È¤ì(€€€€€€€€€€€½¹ÍÐ•áÁ½ÉÑ	ÕÑÑ½¸€ô‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰ÕÑÑ½¸œ¤ì(€€€€€€€€€€€•áÁ½ÉÑ	ÕÑÑ½¸¹±…ÍÍ9…µ”€ô€¡½ÍÐµ‰ÕÑÑ½¸œì(€€€€€€€€€€€•áÁ½ÉÑ	ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô€Ÿ‚âS‚âË‚âŸ‚âg‚æ3‚æ‚â¯‚â—‚âPá•°=Hœì(€€€€€€€€€€€•áÁ½ÉÑ	ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì(€€€€€€€€€€€€€ÑÉäì•áÁ½ÉÑ=Éá•°¡µ•Ñ„°½È¤ìÑ½…ÍÐ Ÿ‚â«‚â‚æ'‚âË‚âá•°ƒ‚â#‚âË‚â‚âs‚â”=Hƒ‚æ‚â—‚æ'‚âœœ°€½¬œ¤ìô(€€€€€€€€€€€€€…Ñ €¡•ÉÉ½È¤ìÑ½…ÍÐ¡•ÉÉ½È¹µ•ÍÍ…”°€Ý…É¸œ¤ìô(€€€€€€€€€€€ô¤ì(€€€€€€€€€€€Ñ…É•Ð¹ÅÕ•ÉåM•±•Ñ½È œ¹Á‘˜µÉ•Ù¥•Üµ¡•…‘¥¹œœ¤¹…ÁÁ•¹¡•áÁ½ÉÑ	ÕÑÑ½¸¤ì(€€€€€€€€€ô(€€€€€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€€€€€½¹Í½±”¹Ý…É¸ ‰1½…=H•Ù¥‘•¹”™…¥±•ˆ°•ÉÉ½È¤ì(€€€€€€€€€¥˜€¡Ñ…É•Ð¹¥Í½¹¹•Ñ•€˜˜€…Á•¹‘¥¹I•Á±…•µ•¹Ñ¥±”¤Ñ…É•Ð¹¥¹Í•ÉÑ‘©…•¹Ñ!Q50 ‰…™Ñ•É‰•¥¸ˆ°€œñÀÉ½±”ô‰…±•ÉÐˆû‚æ‚â¯‚â—‚âS‚â‚æ'‚â·‚â‡‚âç‚â—‚â_‚â×‚æ#‚â·‚æ#‚âË‚âg‚â#‚âË‚âAƒ‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ƒ‚â‹‚âÇ‚â‚âW‚â‚âŸ‚â#‚âƒ‚âË‚â{‚âW‚æ'‚âg‚â'‚âk‚âÇ‚âk‚æ‚âS‚æ$ƒ‚æ‚â—‚âÃ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âŸ‚æ#‚âË‚æ‚â‡‚æ#‚â‡‚â×‚â‚âË‚â‹‚â‚âË‚âŒð½Àøœ¤ì(€€€€€€€ô(€€€€€ô(€€€ô•±Í”¥˜€¡l‰Á¹œˆ°€‰©Áœˆ°€‰©Á•œˆ°€‰¥˜ˆ°€‰Ý•‰À‰t¹¥¹±Õ‘•Ì¡•áÐ¤ñðMÑÉ¥¹œ¡µ•Ñ„¹µ¥µ”¤¹ÍÑ…ÉÑÍ]¥Ñ  ‰¥µ…”¼ˆ¤¤ì(€€€€€½¹ÍÐ½É¥¥¹…±UÉ°€ô…Ý…¥Ð•ÑM¥¹• ¤ì(€€€€€¥˜€¡Á•¹‘¥¹I•Á±…•µ•¹Ñ¥±”¤É•ÑÕÉ¸ì(€€€€€Ñ…É•Ð¹¥¹¹•É!Q50€ô€ñ¥µœ±…ÍÌô‰™¥±”µÁÉ•Ù¥•Üµ¥µ…”ˆÍÉŒôˆ‘í ¡½É¥¥¹…±UÉ°¥ôˆ…±Ðô‹‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚â€‘í ¡¹…µ”¥ôˆ€¼ù€ì(€€€ô•±Í”¥˜€¡l‰á±Íàˆ°€‰á±Í´‰t¹¥¹±Õ‘•Ì¡•áÐ¤¤ì(€€€€€½¹ÍÐ½É¥¥¹…±I½ÝÌ€ô…Ý…¥Ða±ÍáI•…‘•È¹É•…¡…Ý…¥Ð•Ñ½Ý¹±½… ¤¤ì(€€€€€¥˜€¡Á•¹‘¥¹I•Á±…•µ•¹Ñ¥±”¤É•ÑÕÉ¸ì(€€€€€Ñ…É•Ð¹¥¹¹•É!Q50€ô™¥±•AÉ•Ù¥•ÝQ…‰±”¡½É¥¥¹…±I½ÝÌ¤ì(€€€ô•±Í”¥˜€¡l‰ÍØˆ°€‰ÑáÐ‰t¹¥¹±Õ‘•Ì¡•áÐ¤¤ì(€€€€€½¹ÍÐÑ•áÐ€ô¹•ÜQ•áÑ•½‘•È ‰ÕÑ˜´àˆ¤¹‘•½‘”¡…Ý…¥Ð•Ñ½Ý¹±½… ¤¤ì(€€€€€¥˜€¡Á•¹‘¥¹I•Á±…•µ•¹Ñ¥±”¤É•ÑÕÉ¸ì(€€€€€Ñ…É•Ð¹¥¹¹•É!Q50€ô™¥±•AÉ•Ù¥•ÝQ…‰±”¡•áÐ€ôôô€‰ÍØˆ€ü¹¥¹”¹Á…ÉÍ•MX¡Ñ•áÐ¤€èÑ•áÐ¹ÍÁ±¥Ð ½qÈýq¸¼¤¹µ…À ¡±¥¹”¤€ôøm±¥¹•t¤¤ì(€€€ô•±Í”¥˜€¡•áÐ€ôôô€‰‘½àˆñðMÑÉ¥¹œ¡µ•Ñ„¹µ¥µ”¤¹¥¹±Õ‘•Ì ‰Ý½É‘ÁÉ½•ÍÍ¥¹µ°ˆ¤¤ì(€€€€€½¹ÍÐÁÉ•Ù¥•Ü€ô…Ý…¥Ð½áI•…‘•È¹É•¹‘•È¡…Ý…¥Ð•Ñ½Ý¹±½… ¤¤ì(€€€€€¥˜€¡Á•¹‘¥¹I•Á±…•µ•¹Ñ¥±”¤ìÁÉ•Ù¥•Ü¹±•…¹ÕÀ ¤ìÉ•ÑÕÉ¸ìô(€€€€€Ñ…É•Ð¹É•Á±…•¡¥±‘É•¸¡ÁÉ•Ù¥•Ü¹•±•µ•¹Ð¤ì(€€€€€€ ˆµ½‘…°ˆ¤¹}½¹Ñ•¹Ñ±•…¹ÕÀ€ôÁÉ•Ù¥•Ü¹±•…¹ÕÀì(€€€ô•±Í”ì(€€€€€Ñ…É•Ð¹¥¹¹•É!Q50€ô€ñ‘¥Ø±…ÍÌô‰™¥±”µÁÉ•Ù¥•ÜµÕ¹…Ù…¥±…‰±”ˆøñˆû‚æ‚â‚â—‚æ3‚â+‚âg‚âÓ‚âS‚âg‚â×‚æ'‚â‹‚âÇ‚â‚æ‚â«‚âS‚â‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚â‚æ‚âg‚â¯‚âg‚æ'‚âË‚æ‚âŸ‚æ‚âk‚æ‚â‡‚æ#‚æ‚âS‚æ$ð½ˆøñÍÁ…¸û‚âW‚â‚âŸ‚â#‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âS‚âS‚æ'‚âË‚âg‚âk‚âdƒ‚æ‚â—‚æ'‚âŸ‚æ‚â—‚âß‚â·‚âƒŠs‚æ‚âo‚âÓ‚âS‚âW‚æ'‚âg‚â'‚âk‚âÇ‚âkŠtƒ‚â¯‚â‚âß‚â´ƒŠs‚âS‚âË‚âŸ‚âg‚æ3‚æ‚â¯‚â—‚âS‚æ‚â‚â—‚æ3Štƒ‚æ‚â‡‚âß‚æ#‚â·‚âW‚æ'‚â·‚â‚â‚âË‚âŒð½ÍÁ…¸øð½‘¥Øù€ì(€€€ô(€€€±½Ñ¥½¸ ‰ÁÉ•Ù¥•Ý}™¥±”ˆ°€‰Í½ÕÉ•}™¥±”ˆ°µ•Ñ„¹¥ñðµ•Ñ„¹Á…Ñ °ƒ‚âS‚âç‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚â‚æ‚â‚â—‚æ0€‘í¹…µ•õ€¤ì(€ô…Ñ €¡•ÉÉ½È¤ì(€€€½¹ÍÐÑ…É•Ð€ô€ ˆ™¥±•AÉ•Ù¥•Ý½¹Ñ•¹Ðˆ¤ì(€€€¥˜€¡Ñ…É•Ð¤Ñ…É•Ð¹¥¹¹•É!Q50€ô€ñ‘¥Ø±…ÍÌô‰™¥±”µÁÉ•Ù¥•ÜµÕ¹…Ù…¥±…‰±”‰…ˆøñˆû‚â«‚â‚æ'‚âË‚â‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚â‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â#‚â¯‚â—‚âÇ‚â‚â—‚â·‚â‚æ‚â¯‚â‡‚æ €Ìƒ‚â‚â‚âÇ‚æ'‚âð½ˆøñÍÁ…¸ø‘í ¡•ÉÉ½È¹µ•ÍÍ…”¥ôð½ÍÁ…¸øñÍµ…±°û‚â‹‚âÇ‚â‚â«‚âË‚â‡‚âË‚â‚â[‚æ‚âo‚âÓ‚âS‚âW‚æ'‚âg‚â'‚âk‚âÇ‚âk‚â¯‚â‚âß‚â·‚âS‚âË‚âŸ‚âg‚æ3‚æ‚â¯‚â—‚âS‚æ‚âS‚æ'‚â#‚âË‚â‚âo‚âã‚æ#‚â‡‚âS‚æ'‚âË‚âg‚â—‚æ#‚âË‚âƒ‚â¯‚â‚âß‚â·‚âo‚âÓ‚âS‚æ‚â—‚æ'‚âŸ‚æ‚âo‚âÓ‚âPAÉ•Ù¥•Üƒ‚æ‚â¯‚â‡‚æ ð½Íµ…±°øð½‘¥Øù€ì(€ô)ô()™Õ¹Ñ¥½¸‰¥¹‘MÑ½É•‘¥±•1¥¹­Ì¡É½½Ð°Í•±•Ñ½È€ô€‰m‘…Ñ„µÍÑ½É…”µ½Á•¹tˆ¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±°¡Í•±•Ñ½È¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø½Á•¹MÑ½É•‘¥±•AÉ•Ù¥•Ü¡ì(€€€Á…Ñ è‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹ÍÑ½É…•=Á•¸°(€€€¥è‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹™¥±•%°(€€€¹…µ”è‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹™¥±•9…µ”°(€€€µ¥µ”è‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹™¥±•5¥µ”°(€€€Í¥é”è‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹™¥±•M¥é”°(€€€­¥¹è‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹™¥±•-¥¹°(€€€½µÁ…¹äè‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹™¥±•½µÁ…¹ä°(€€€‘…Ñ”è‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹™¥±•…Ñ”°(€€€ÍÑ…ÑÕÌè‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹™¥±•MÑ…ÑÕÌ°(€ô¤¤¤ì)ô()™Õ¹Ñ¥½¸±½Õ‘5¥ÍÍ¥¹É½ÕÁÍQ•áÐ¡É½ÕÁÌ¤ì(€½¹ÍÐ±…‰•°€ô€¡É½ÕÀ¤€ôøì(€€€¥˜€¡ÉÉ…ä¹¥ÍÉÉ…ä¡É½ÕÀ¤¤É•ÑÕÉ¸É½ÕÀ¹µ…À¡±…‰•°¤¹©½¥¸ ˆ€¼€ˆ¤ì(€€€¥˜€¡ÑåÁ•½˜É½ÕÀ€ôôô€‰ÍÑÉ¥¹œˆ¤É•ÑÕÉ¸É½ÕÀñð€‹‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âã‚â‚â—‚âã‚æ#‚â‡‚æ‚â‚â—‚æ0ˆì(€€€¥˜€ …É½ÕÀñðÑåÁ•½˜É½ÕÀ€„ôô€‰½‰©•Ðˆ¤É•ÑÕÉ¸€‹‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âã‚â‚â—‚âã‚æ#‚â‡‚æ‚â‚â—‚æ0ˆì(€€€½¹ÍÐ¹…µ•Ì€ôÉÉ…ä¹¥ÍÉÉ…ä¡É½ÕÀ¹Í½ÕÉ•}±…‰•±Ì¤(€€€€€€üÉ½ÕÀ¹Í½ÕÉ•}±…‰•±Ì¹™¥±Ñ•È ¡Ù…±Õ”¤€ôøÑåÁ•½˜Ù…±Õ”€ôôô€‰ÍÑÉ¥¹œˆ€˜˜Ù…±Õ”¹ÑÉ¥´ ¤¤¹©½¥¸ ˆ€¼€ˆ¤€è€ˆˆì(€€€½¹ÍÐ…½Õ¹Ð€ô¹…µ•Ìñð€¡ÑåÁ•½˜É½ÕÀ¹±…‰•°€ôôô€‰ÍÑÉ¥¹œˆ€˜˜É½ÕÀ¹±…‰•°¤(€€€€€ñð€¡ÑåÁ•½˜É½ÕÀ¹¥‘•¹Ñ¥Ñä€ôôô€‰ÍÑÉ¥¹œˆ€˜˜É½ÕÀ¹¥‘•¹Ñ¥Ñä¤ñð€‹‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âã‚âk‚âÇ‚â7‚â+‚âÔˆì(€€€½¹ÍÐ‘¥É•Ñ¥½¸€ôì‘•Á½Í¥Ðè€‹‚âw‚âË‚âˆ°Ý¥Ñ¡‘É…Üè€‹‚â[‚â·‚âdˆ°ƒ‚âw‚âË‚âè€‹‚âw‚âË‚âˆ°ƒ‚â[‚â·‚âdè€‹‚â[‚â·‚âdˆõmÉ½ÕÀ¹‘¥É•Ñ¥½¹tñð€ˆˆì(€€€É•ÑÕÉ¸mÑåÁ•½˜É½ÕÀ¹­¥¹€ôôô€‰ÍÑÉ¥¹œˆ€üÉ½ÕÀ¹­¥¹€è€ˆˆ°…½Õ¹Ð°‘¥É•Ñ¥½¹t¹™¥±Ñ•È¡	½½±•…¸¤¹©½¥¸ ˆƒ
Ü€ˆ¤ì(€ôì(€¥˜€ …ÉÉ…ä¹¥ÍÉÉ…ä¡É½ÕÁÌ¤¤É•ÑÕÉ¸€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚â‚æ'‚â·‚â‡‚âç‚â—‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚â‚âË‚âPˆì(€É•ÑÕÉ¸É½ÕÁÌ¹±•¹Ñ €üÉ½ÕÁÌ¹µ…À¡±…‰•°¤¹©½¥¸ ˆ°€ˆ¤€è€‹‚â‚â‚âhˆì)ô()…Íå¹Œ™Õ¹Ñ¥½¸±½Õ‘1½…¡™½É”€ô™…±Í”¤ì(€½¹ÍÐ­•ä€ô±½Õ‘EÕ•Éå-•ä ¤ì(€€¼¼¹•Ü™¥±Ñ•È½Ý¹Ì„¹•ÜÉ•ÅÕ•ÍÐ•Ù•¸Ý¡¥±”Ñ¡”ÁÉ•Ù¥½ÕÌÍ½Á”¥ÌÁ•¹‘¥¹œ¸(€€¼¼=Ñ¡•ÉÝ¥Í”¥ÑÌÍÑ…±”É•ÍÁ½¹Í”É•ÑÕÉ¹ÌÝ¥Ñ¡½ÕÐ•Ù•ÈÉ•±•…Í¥¹œÑ¡”ÍÁ¥¹¹•È¸(€¥˜€¡±½Õ‘MÑ…Ñ”¹­•ä€ôôô­•ä€˜˜€¡±½Õ‘MÑ…Ñ”¹±½…‘¥¹œñð±½Õ‘MÑ…Ñ”¹…Õá¥±¥…Éå1½…‘¥¹œ¤€˜˜€…™½É”¤É•ÑÕÉ¸ì(€¥˜€ …™½É”€˜˜±½Õ‘MÑ…Ñ”¹­•ä€ôôô­•ä€˜˜±½Õ‘MÑ…Ñ”¹‰…Ñ¡•Ì€„ôô¹Õ±°¤É•ÑÕÉ¸ì(€½¹ÍÐÉ•ÅÕ•ÍÑ%€ô€¬­±½Õ‘MÑ…Ñ”¹É•ÅÕ•ÍÑ%ì(€½¹ÍÐ¡…¹•‘¥±Ñ•È€ô±½Õ‘MÑ…Ñ”¹­•ä€„ôô­•äì(€±½Õ‘MÑ…Ñ”¹­•ä€ô­•äì(€±½Õ‘MÑ…Ñ”¹±½…‘¥¹œ€ôÑÉÕ”ì(€±½Õ‘MÑ…Ñ”¹…Õá¥±¥…Éå1½…‘¥¹œ€ôÑÉÕ”ì(€±½Õ‘MÑ…Ñ”¹•ÉÉ½È€ô¹Õ±°ì(€±½Õ‘MÑ…Ñ”¹Á…ÉÑ¥…±ÉÉ½È€ô¹Õ±°ì(€±½Õ‘MÑ…Ñ”¹•Ù¥‘•¹•ÉÉ½È€ô¹Õ±°ì(€±½Õ‘MÑ…Ñ”¹…Í•ÑÑ…¡µ•¹ÑÌ€ô¹Õ±°ì(€¥˜€¡¡…¹•‘¥±Ñ•È¤ì(€€€±½Õ‘MÑ…Ñ”¹‰…Ñ¡•Ì€ô¹Õ±°ì(€€€±½Õ‘MÑ…Ñ”¹‘…¥±ä€ô¹Õ±°ì(€€€±½Õ‘MÑ…Ñ”¹½Á•É…Ñ¥½¹Ì€ô¹Õ±°ì(€€€±½Õ‘MÑ…Ñ”¹Á¥­•€ôíôì(€ô(€É•¹‘•È ¤ì(€½¹ÍÐÑ¼€ôÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹Ñ¼ñð¹	UM%9MM}Qì(€½¹ÍÐ™É½´€ôÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½´ñðÑ¼ì(€½¹ÍÐ½µÁ…¹ä€ôÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹äì(€½¹ÍÐÕÉÉ•¹Ð€ô€ ¤€ôø€„¡É•ÅÕ•ÍÑ%€„ôô±½Õ‘MÑ…Ñ”¹É•ÅÕ•ÍÑ%ñð­•ä€„ôô±½Õ‘EÕ•Éå-•ä ¤¤ì(€½¹ÍÐ™…¥±•€ô¹•Ü5…À ¤ì(€½¹ÍÐ¹…µ•Ì€ôl‹‚â‚âË‚â‹‚â‚âË‚â‚æ‚â‡‚â”¿‚æ‚â‚â—‚æ0ˆ°€‹‚â«‚â‚âã‚âo‚â‚âË‚â‹‚âŸ‚âÇ‚âdˆ°€‹‚â‚âÓ‚âŸ‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âPˆ°€‹‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â#‚âË‚â‚æ‚â‚â¨‰tì(€€¼¼	½Õ¹•… É•…É½ÕÀ°¥¹±Õ‘¥¹œµÕ±Ñ¤µÉ•ÅÕ•ÍÐÁÉ¥µ…Éä½Ù•É±…åÌ¸9¼ÝÉ¥Ñ•Ì(€€¼¼½ÈÉ•½¹¥±¥…Ñ¥½¸…É”É•ÑÉ¥•¡•É”¸1…Ñ”É•ÍÁ½¹Í•Ì…¹¹½ÐÉ•Á±…”„Í½Á”¸(€½¹ÍÐÉ•…€ô…Íå¹Œ€¡¥¹‘•à°±½…°…ÁÁ±ä¤€ôøì(€€€±•ÐÑ¥µ•Èì(€€€ÑÉäì(€€€€€½¹ÍÐÙ…±Õ”€ô…Ý…¥ÐAÉ½µ¥Í”¹É…”¡l(€€€€€€€AÉ½µ¥Í”¹É•Í½±Ù” ¤¹Ñ¡•¸¡±½…¤°(€€€€€€€¹•ÜAÉ½µ¥Í” ¡|°É•©•Ð¤€ôøìÑ¥µ•È€ôÍ•ÑQ¥µ•½ÕÐ  ¤€ôøÉ•©•Ð¡¹•ÜÉÉ½È Ÿ‚â¯‚â‡‚âS‚æ‚âŸ‚â—‚âË‚â‚â·‚â‚æ'‚â·‚â‡‚âç‚â”ƒ‚â‚â‚âã‚âO‚âË‚â‚â×‚æ‚â‚â‚â(œ¤¤°€ÌÔÀÀÀ¤ìô¤°(€€€€€t¤ì(€€€€€¥˜€¡ÕÉÉ•¹Ð ¤¤…ÁÁ±ä¡Ù…±Õ”¤ì(€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€¥˜€¡ÕÉÉ•¹Ð ¤¤™…¥±•¹Í•Ð¡¥¹‘•à°€‘í¹…µ•Ím¥¹‘•áuô€ ‘í•ÉÉ½Èü¹µ•ÍÍ…”ñð€Ÿ‚â·‚æ#‚âË‚âg‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ô¥€¤ì(€€€ô™¥¹…±±äì(€€€€€±•…ÉQ¥µ•½ÕÐ¡Ñ¥µ•È¤ì(€€€€€¥˜€¡ÕÉÉ•¹Ð ¤¤ì(€€€€€€€±½Õ‘MÑ…Ñ”¹Á…ÉÑ¥…±ÉÉ½È€ô™…¥±•¹Í¥é”€üƒ‚æ‚â¯‚â—‚âS‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â è€‘íl¸¸¹™…¥±•¹Ù…±Õ•Ì ¥t¹©½¥¸ ˆ°€ˆ¥õ€€è¹Õ±°ì(€€€€€€€±½Õ‘MÑ…Ñ”¹•ÉÉ½È€ô™…¥±•¹¡…Ì À¤€ü€‘í™…¥±•¹•Ð À¥ôƒŠPƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚â«‚âS‚â‚â#‚âÏ‚âg‚âŸ‚âg‚æ‚â‚â—‚æ3‚æ‚â{‚âß‚æ#‚â·‚âo‚æ'‚â·‚â‚â‚âÇ‚âg‚â‹‚â·‚âS‚â£‚âç‚âg‚â‹‚æ3‚âo‚â—‚â·‚â…€€è¹Õ±°ì(€€€€€€€¥˜€¡¥¹‘•à€ôôô€À¤±½Õ‘MÑ…Ñ”¹±½…‘¥¹œ€ô™…±Í”ì(€€€€€€€¥˜€¡¥¹‘•à€ôôô€Ì€˜˜™…¥±•¹¡…Ì Ì¤¤±½Õ‘MÑ…Ñ”¹•Ù¥‘•¹•ÉÉ½È€ô€Ÿ‚æ‚â¯‚â—‚âS‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â#‚âË‚â‚æ‚â‚â«‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ƒ‚â‚â‚âã‚âO‚âË‚â‚â×‚æ‚â‚â‚â(ƒ‚æ‚â‡‚æ#‚æ‚â+‚æ#‚â‚âË‚â‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âŸ‚æ#‚âË‚æ‚â‡‚æ#‚â‡‚â×‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdœì(€€€€€€€¥˜€¡ÍÑ…Ñ”¹É½ÕÑ”€ôôô€±½Õœ¤É•¹‘•È ¤ì(€€€€€ô(€€€ô(€ôì(€…Ý…¥ÐAÉ½µ¥Í”¹…±°¡l(€€€É•… À°€ ¤€ôøMˆ¹‰…Ñ¡•Ì¡í™É½´°Ñ¼°½µÁ…¹ä°™½É•ô¤°Ù…±Õ”€ôøì±½Õ‘MÑ…Ñ”¹‰…Ñ¡•Ì€ôÙ…±Õ”ñðmtìô¤°(€€€É•… Ä°€ ¤€ôøMˆ¹‘…¥±åMÑ…ÑÕÌ¡í™É½´°Ñ¼°½µÁ…¹ä°±¥µ¥ÐèÄÀÁô¤°Ù…±Õ”€ôøì±½Õ‘MÑ…Ñ”¹‘…¥±ä€ôÙ…±Õ”ñðmtìô¤°(€€€É•… È°€ ¤€ôøMˆ¹½Á•É…Ñ¥½¹Ì¡í™É½´°Ñ¼°½µÁ…¹ä°±¥µ¥ÐèÈÀÁô¤°Ù…±Õ”€ôøì±½Õ‘MÑ…Ñ”¹½Á•É…Ñ¥½¹Ì€ôÙ…±Õ”ñðmtìô¤°(€€€É•… Ì°€ ¤€ôøMˆ¹…Í•Ù¥‘•¹•1¥‰É…Éä¡í™É½´°Ñ¼°½µÁ…¹åô¤°Ù…±Õ”€ôøì±½Õ‘MÑ…Ñ”¹…Í•ÑÑ…¡µ•¹ÑÌ€ôÙ…±Õ”ìô¤°(€t¤ì(€¥˜€ …ÕÉÉ•¹Ð ¤¤É•ÑÕÉ¸ì(€±½Õ‘MÑ…Ñ”¹…Õá¥±¥…Éå1½…‘¥¹œ€ô™…±Í”ì(€¥˜€¡ÍÑ…Ñ”¹É½ÕÑ”€ôôô€±½Õœ¤É•¹‘•È ¤ì)ô((¼¨ƒ‚æ‚â¯‚â—‚âS‚æ‚â‚â—‚æ3‚â#‚âË‚âMÑ½É…”ƒ‚æ‚â—‚æ'‚âŸ‚â«‚æ#‚â‚æ‚â‚æ'‚âË‚âW‚âÇ‚âŸ‚â·‚æ#‚âË‚âg‚æ‚âS‚âÓ‚â„€¨¼)…Íå¹Œ™Õ¹Ñ¥½¸±½Õ‘%µÁ½ÉÐ¡™¥±•Ì°½ÁÑÌ€ôíô¤ì(€¥˜¡™¥±•Ì¹Í½µ”¡™¥±”ôù™¥±”¹•á±Õ‘•¤¥Ñ¡É½ÜÉÉ½È Ÿ‚â‡‚â×‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚â‹‚â‚æ‚âŸ‚æ'‚âg‚â#‚âË‚â‚â‚âË‚â‚â‚âÇ‚âdƒ‚â‚â‚âã‚âO‚âË‚æ‚â¯‚â—‚âS‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚â—‚æ#‚âË‚â«‚âã‚âS‚æ‚â—‚âÃ‚æ‚â—‚âß‚â·‚â‚æ‚â¯‚â‡‚æ œ¤ì(€€¼¼Ù¥‘•¹”µÕÍÐ¹•Ù•È•¹Ñ•ÈÁ…ÉÍ•ÉÌ°µ…É­A…ÉÍ•½ÈÉ•½¹¥±¥…Ñ¥½¸°•Ù•¸¥˜ÍÕÁÁ±¥•µ…¹Õ…±±ä¸(€™¥±•Ì€ô™¥±•Ì¹™¥±Ñ•È¡™¥±”€ôø™¥±”¹­¥¹€„ôô€‘½}±…É¥™äœ€˜˜€…MÑÉ¥¹œ¡™¥±”¹ÍÑ½É…•}Á…Ñ ñð€œœ¤¹ÍÑ…ÉÑÍ]¥Ñ  …Í”µ•Ù¥‘•¹”¼œ¤¤ì(€½¹ÍÐ‰±½­•€ô™¥±•Ì¹™¥±Ñ•È ¡™¥±”¤€ôø™¥±”¹Á…ÉÍ•}•ÉÉ½Èñð™¥±”¹­¥¹€ôôô€‰Õ¹­¹½Ý¸ˆ¤ì(€™¥±•Ì€ô™¥±•Ì¹™¥±Ñ•È ¡™¥±”¤€ôø€…™¥±”¹Á…ÉÍ•}•ÉÉ½È€˜˜™¥±”¹­¥¹€„ôô€‰Õ¹­¹½Ý¸ˆ¤ì(€¥˜€¡‰±½­•¹±•¹Ñ ¤Ñ½…ÍÐ¡ƒ‚â{‚âÇ‚â‚æ‚â‚â—‚æ3‚âo‚âÇ‚â7‚â¯‚âÈ€‘í¹Õ´¡‰±½­•¹±•¹Ñ ¥ôƒ‚æ‚â‚â—‚æ3‚æ‚âŸ‚æ'‚â‚æ#‚â·‚âdƒŠPƒ‚âW‚æ'‚â·‚â‚æ‚â‚æ'‚âo‚â‚âÃ‚æ‚âƒ‚â_‚â¯‚â‚âß‚â·‚â‚æ'‚â·‚âs‚âÓ‚âS‚â{‚â—‚âË‚âS‚â‚æ#‚â·‚âg‚â‚âÇ‚âe€°€‰Ý…É¸ˆ¤ì(€¥˜€ …™¥±•Ì¹±•¹Ñ ¤ì(€€€¥˜€¡½ÁÑÌ¹©½ˆ¤Ñ¡É½Ü¹•ÜÉÉ½È¡ƒ‚â{‚âÇ‚â‚â‚âÓ‚âŸ‚æ‚âŸ‚æ'‚â‚æ#‚â·‚âdèƒ‚â‡‚â×‚æ‚â‚â—‚æ3‚âo‚âÇ‚â7‚â¯‚âÈ€‘í‰±½­•¹±•¹Ñ¡ôƒ‚æ‚â‚â—‚æ3‚æ‚â—‚âÃ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚æ‚â‚â—‚æ3‚â{‚â‚æ'‚â·‚â‡‚â‚âÇ‚âe€¤ì(€€€É•ÑÕÉ¸Ñ½…ÍÐ ‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚â{‚â‚æ'‚â·‚â‡‚â‚âÇ‚âdˆ°€‰Ý…É¸ˆ¤ì(€ô(€¥˜€¡½ÁÑÌ¹±•…È¤ì(€€€%µÁ½ÉÑMÑ…Ñ”¹™¥±•Ì€ômtì(€€€%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸€ô¹Õ±°ì(€ô(€±½Õ‘MÑ…Ñ”¹…Ñ¥Ù•)½ˆ€ô½ÁÑÌ¹©½ˆñð¹Õ±°ì(€Í¡½ÝAÉ½É•ÍÌ ‹‚â‚âÏ‚â—‚âÇ‚â‚âS‚âÛ‚â‚æ‚â‚â—‚æ3‚â#‚âË‚â‚â‚â—‚âÇ‚â‚æ‚â—‚âÃ‚â·‚æ#‚âË‚âg‚æ‚â‚æ'‚âË‚â‚âÃ‚âk‚âhˆ¤ì(€±•Ð½¬€ô€Àì(€½¹ÍÐ™…¥±•€ômtì(€™½È€¡±•Ð¤€ô€Àì¤€ð™¥±•Ì¹±•¹Ñ ì¤¬¬¤ì(€€€½¹ÍÐ˜€ô™¥±•Ím¥tì(€€€Í•ÑAÉ½É•ÍÌ ¡¤€¬€Ä¤€¼™¥±•Ì¹±•¹Ñ °˜¹™¥±•}¹…µ”¤ì(€€€ÑÉäì(€€€€€½¹ÍÐ‰Õ˜€ô…Ý…¥ÐMˆ¹‘½Ý¹±½…¡˜¹ÍÑ½É…•}Á…Ñ ¤ì(€€€€€½¹ÍÐ¹½É´€ô…Ý…¥Ð¥¹•ÍÑI…Ü¡˜¹™¥±•}¹…µ”°‰Õ˜°‰Õ˜¹‰åÑ•1•¹Ñ °ì(€€€€€€€™¥±•%è˜¹¥°(€€€€€€€ÍÑ½É…•A…Ñ è˜¹ÍÑ½É…•}Á…Ñ °(€€€€€€€‰ÕÍ¥¹•ÍÍ…Ñ”è½ÁÑÌ¹©½ˆü¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”°(€€€€€ô¤ì(€€€€€½¹ÍÐ¸€ô¹½É´¹É•½É‘Ì¹±•¹Ñ €¬€¡¹½É´¹…Õàñðmt¤¹±•¹Ñ ì(€€€€€½¬¬¬ì(€€€€€Mˆ¹µ…É­A…ÉÍ•¡˜¹¥°¸°¹Õ±°¤¹…Ñ   ¤€ôøíô¤ì(€€€ô…Ñ €¡”¤ì(€€€€€™…¥±•¹ÁÕÍ ¡€‘í˜¹™¥±•}¹…µ•ôè€‘í”¹µ•ÍÍ…•õ€¤ì(€€€€€Mˆ¹µ…É­A…ÉÍ•¡˜¹¥°¹Õ±°°”¹µ•ÍÍ…”¤¹…Ñ   ¤€ôøíô¤ì(€€€ô(€ô(€¡¥‘•AÉ½É•ÍÌ ¤ì(€±½Ñ¥½¸ ‰±½Õ‘}¥µÁ½ÉÐˆ°€‰Í½ÕÉ•}™¥±”ˆ°€‘í½­ôƒ‚æ‚â‚â—‚æ1€°ƒ‚âS‚âÛ‚â‚â#‚âË‚â‚â‚â—‚âÇ‚âMÕÁ…‰…Í”€‘í½­ôƒ‚æ‚â‚â—‚æ0‘í‰±½­•¹±•¹Ñ €ü€ƒ
Üƒ‚â{‚âÇ‚â‚æ‚â‚â—‚æ3‚âo‚âÇ‚â7‚â¯‚âÈ€‘í‰±½­•¹±•¹Ñ¡õ€€è€ˆ‰ô‘í™…¥±•¹±•¹Ñ €ü€ƒ
Üƒ‚âs‚âÓ‚âS‚â{‚â—‚âË‚âP€‘í™…¥±•¹±•¹Ñ¡õ€€è€ˆ‰õ€¤ì(€Ñ½…ÍÐ¡ƒ‚â·‚æ#‚âË‚âg‚æ‚â‚æ'‚âË‚â‚âÃ‚âk‚âk‚æ‚â—‚æ'‚âœ€‘í½­ôƒ‚æ‚â‚â—‚æ0‘í‰±½­•¹±•¹Ñ €ü€ƒ
Üƒ‚â{‚âÇ‚â‚æ‚â‚â—‚æ3‚âo‚âÇ‚â7‚â¯‚âÈ€‘í‰±½­•¹±•¹Ñ¡õ€€è€ˆ‰ô‘í™…¥±•¹±•¹Ñ €ü€ƒ
Üƒ‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â €‘í™…¥±•¹±•¹Ñ¡õ€€è€ˆ‰õ€¤ì(€¥˜€¡™…¥±•¹±•¹Ñ ¤½¹Í½±”¹Ý…É¸¡™…¥±•¤ì(€±½Õ‘MÑ…Ñ”¹Á¥­•€ôíôì(€…Ý…¥ÐÉÕ¹I•½¹¥±•É½µ%µÁ½ÉÐ¡ìÉ•…Í½¸è½ÁÑÌ¹©½ˆ€ü€‹‚â‚âÓ‚âŸ‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚â‚âË‚â‹‚âŸ‚âÇ‚âdˆ€è€‹‚âS‚âÛ‚â‚â#‚âË‚â‚â‚â—‚âÇ‚â‚æ‚â‚â—‚æ0ˆ°©½ˆè½ÁÑÌ¹©½ˆñð¹Õ±°ô¤ì)ô()Y%]L¹±½Õ€ô€¡É½½Ð¤€ôøì(€½¹ÍÐŒ€ôMˆ¹™œ ¤ì(€½¹ÍÐÉ•…‘ä€ôMˆ¹½¹™¥ÕÉ• ¤ì(€½¹ÍÐ¥¹M•ÍÍ¥½¸€ôMˆ¹Í¥¹•‘%¸ ¤ì((€¥˜€ …É•…‘äñð€…¥¹M•ÍÍ¥½¸¤ì(€€€Í¡½Ý1½¥¹…Ñ” ¤ì(€€€É½½Ð¹¥¹¹•É!Q50€ô€ˆˆì(€€€É•ÑÕÉ¸ì(€ô((€€¼¨ƒ‚â¯‚âg‚æ'‚âÈAÉ½‘ÕÑ¥½¸ƒ‚æ‚â‡‚æ#‚æ‚âo‚âÓ‚âS‚æ‚â¯‚æ'‚æ‚â‚æ$UI0½­•äƒ‚â#‚âË‚â‚â¯‚âg‚æ'‚âË‚æ‚âŸ‚æ‚âh€¨¼(€¥˜€¡™…±Í”¤ì(€€€É½½Ð¹¥¹¹•É!Q50€ô€(€€€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆù±½Õ%¹‰½àð½Àøñ Èû‚æ‚â+‚âß‚æ#‚â·‚â‡‚âW‚æ#‚â·‚â‚â—‚âÇ‚â‚æ‚â‚â—‚æ0ð½ Èøð½‘¥Øø(€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰¡•…±Ñ €‘íÉ•…‘ä€ü€‰…ÑÑ•¹Ñ¥½¸ˆ€è€‰…ÑÑ•¹Ñ¥½¸‰ôˆø‘íÉ•…‘ä€ü€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â—‚æ‚â·‚â‚â·‚âÓ‚âdˆ€è€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚âW‚âÇ‚æ'‚â‚â‚æ#‚âÈ‰ôð½ÍÁ…¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñÀ±…ÍÌô‰¡¥¹Ðˆû‚æ‚â‚â—‚æ3‚â#‚âË‚â‚æ‚â‡‚â”€ñˆùU%P€Èð½ˆøƒ‚â#‚âÃ‚â[‚âç‚â¸á¸ƒ‚âS‚âÛ‚â‚â‡‚âË‚æ‚â‚æ‚âk‚æ‚âŸ‚æ'‚æ‚âdMÕÁ…‰…Í”MÑ½É…”ƒ‚æ‚â—‚âÀ½½±”É¥Ù”ƒ‚æ‚â¯‚æ'‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÐƒ‚â¯‚âg‚æ'‚âË‚âg‚â×‚æ'‚æ‚â+‚æ'‚âS‚âÛ‚â‚æ‚â‚â—‚æ3‚æ‚â¯‚â—‚æ#‚âË‚âg‚âÇ‚æ'‚âg‚æ‚â‚æ'‚âË‚â‡‚âË‚âW‚â‚âŸ‚â#‚æ‚âS‚â‹‚æ‚â‡‚æ#‚âW‚æ'‚â·‚â‚âS‚âË‚âŸ‚âg‚æ3‚æ‚â¯‚â—‚âS‚æ‚â·‚âð½Àø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í•ÑÑ¥¹œµ±¥ÍÐµÐˆø(€€€€€€€€€€ñ±…‰•°øñÍÁ…¸ùMÕÁ…‰…Í”UI0ð½ÍÁ…¸øñ¥¹ÁÕÐÑåÁ”ô‰Ñ•áÐˆ¥ô‰Í‰UÉ°ˆÙ…±Õ”ôˆ‘í ¡Œ¹ÕÉ°ñð€ˆˆ¥ôˆÁ±…•¡½±‘•Èô‰¡ÑÑÁÌè¼½áááà¹ÍÕÁ…‰…Í”¹¼ˆ€¼øñˆøð½ˆøð½±…‰•°ø(€€€€€€€€€€ñ±…‰•°±…ÍÌô‰Ý¥‘”ˆøñÍÁ…¸ù…¹½¸ÁÕ‰±¥Œ­•äð½ÍÁ…¸øñ¥¹ÁÕÐÑåÁ”ô‰Á…ÍÍÝ½Éˆ¥ô‰Í‰-•äˆÙ…±Õ”ôˆ‘í ¡Œ¹…¹½¹-•äñð€ˆˆ¥ôˆÁ±…•¡½±‘•Èô‰•å)¡‰¥=¤¸¸¸ˆ€¼øñˆøð½ˆøð½±…‰•°ø(€€€€€€€€€€ñ±…‰•°øñÍÁ…¸ùMÑ½É…”‰Õ­•Ðð½ÍÁ…¸øñ¥¹ÁÕÐÑåÁ”ô‰Ñ•áÐˆ¥ô‰Í‰	Õ­•ÐˆÙ…±Õ”ôˆ‘í ¡Œ¹‰Õ­•Ðñð€‰…Õ‘¥Ðµ™¥±•Ìˆ¥ôˆ€¼øñˆøð½ˆøð½±…‰•°ø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í•ÑÑ¥¹œµ±¥ÍÐˆø(€€€€€€€€€€ñ±…‰•°øñÍÁ…¸û‚â·‚â×‚æ‚â‡‚â—‚âs‚âç‚æ'‚æ‚â+‚æ$ð½ÍÁ…¸øñ¥¹ÁÕÐÑåÁ”ô‰•µ…¥°ˆ¥ô‰Í‰µ…¥°ˆÙ…±Õ”ôˆ‘í ¡Œ¹•µ…¥°ñð€ˆˆ¥ôˆÁ±…•¡½±‘•Èô‰…Õ‘¥Ñ½µÁ…¹ä¹½´ˆ€¼øñˆøð½ˆøð½±…‰•°ø(€€€€€€€€€€ñ±…‰•°øñÍÁ…¸û‚â‚â¯‚âÇ‚â«‚âs‚æ#‚âË‚âdð½ÍÁ…¸øñ¥¹ÁÕÐÑåÁ”ô‰Á…ÍÍÝ½Éˆ¥ô‰Í‰A…ÍÌˆÁ±…•¡½±‘•Èô‹Š‹Š‹Š‹Š‹Š‹Š‹Š‹Šˆˆ€¼øñˆøð½ˆøð½±…‰•°ø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹±¥¹”µ…Ñ¥½¹Ìˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ¥ô‰Í‰1½¥¸ˆû‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â—‚âÃ‚â—‚æ‚â·‚â‚â·‚âÓ‚âdð½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰Í‰A¥¹œˆû‚â_‚âS‚â«‚â·‚âk‚â‚âË‚â‚æ‚â+‚âß‚æ#‚â·‚â‡‚âW‚æ#‚â´ð½‰ÕÑÑ½¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‘¥Ø¥ô‰Í‰A¥¹=ÕÐˆøð½‘¥Øø(€€€€€€€€ñÀ±…ÍÌô‰¡…ÉÐµ¹½Ñ”ˆû‚æ‚â«‚æ#‚æ‚âS‚æ'‚æ‚â'‚â{‚âË‚âÀ€ñˆù…¹½¸ÁÕ‰±¥Œ­•äð½ˆøƒ‚æ‚â_‚æ#‚âË‚âg‚âÇ‚æ'‚âdƒŠP€ñˆùÍ•ÉÙ¥•}É½±”­•äð½ˆøƒ‚âW‚æ'‚â·‚â‚â·‚â‹‚âç‚æ#‚æ‚âd¸á¸ƒ‚æ‚â_‚æ#‚âË‚âg‚âÇ‚æ'‚âdƒ‚â¯‚æ'‚âË‚â‡‚æ‚â«‚æ#‚æ‚âg‚â¯‚âg‚æ'‚âË‚æ‚âŸ‚æ‚âhƒ‚æ‚â{‚â‚âË‚âÃ‚â#‚âÃ‚â‚æ'‚âË‚â„I1Lƒ‚æ‚â—‚âÃ‚æ‚âo‚âÓ‚âS‚â‚æ'‚â·‚â‡‚âç‚â—‚â—‚âç‚â‚â‚æ'‚âË‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âPð½Àø(€€€€€€ð½Í•Ñ¥½¸ù€ì((€€€€ ˆÍ‰1½¥¸ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°…Íå¹Œ€ ¤€ôøì(€€€€€Mˆ¹Í…Ù•½¹™¥œ¡ìÕÉ°è€ ˆÍ‰UÉ°ˆ¤¹Ù…±Õ”¹ÑÉ¥´ ¤°…¹½¹-•äè€ ˆÍ‰-•äˆ¤¹Ù…±Õ”¹ÑÉ¥´ ¤°‰Õ­•Ðè€ ˆÍ‰	Õ­•Ðˆ¤¹Ù…±Õ”¹ÑÉ¥´ ¤ñð€‰…Õ‘¥Ðµ™¥±•Ìˆô¤ì(€€€€€ÑÉäì(€€€€€€€…Ý…¥ÐMˆ¹Í¥¹%¸  ˆÍ‰µ…¥°ˆ¤¹Ù…±Õ”¹ÑÉ¥´ ¤°€ ˆÍ‰A…ÍÌˆ¤¹Ù…±Õ”¤ì(€€€€€€€ÍÑ…ÉÑ±½Õ‘]½É­•È ¤ì(€€€€€€€Ñ½…ÍÐ ‹‚â—‚æ‚â·‚â‚â·‚âÓ‚âdMÕÁ…‰…Í”ƒ‚â«‚âÏ‚æ‚â‚æ‚â ˆ¤ì(€€€€€€€±½Ñ¥½¸ ‰±½Õ‘}±½¥¸ˆ°€‰ÍÕÁ…‰…Í”ˆ°€ ˆÍ‰µ…¥°ˆ¤¹Ù…±Õ”¹ÑÉ¥´ ¤°€‹‚æ‚â+‚âß‚æ#‚â·‚â‡‚âW‚æ#‚â·‚â‚â—‚âÇ‚â‚æ‚â‚â—‚æ0ˆ¤ì(€€€€€€€±½Õ‘1½… ¤ì(€€€€€ô…Ñ €¡”¤ì(€€€€€€€Ñ½…ÍÐ¡”¹µ•ÍÍ…”°€‰Ý…É¸ˆ¤ì(€€€€€ô(€€€ô¤ì(€€€€ ˆÍ‰A¥¹œˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°…Íå¹Œ€ ¤€ôøì(€€€€€Mˆ¹Í…Ù•½¹™¥œ¡ìÕÉ°è€ ˆÍ‰UÉ°ˆ¤¹Ù…±Õ”¹ÑÉ¥´ ¤°…¹½¹-•äè€ ˆÍ‰-•äˆ¤¹Ù…±Õ”¹ÑÉ¥´ ¤°‰Õ­•Ðè€ ˆÍ‰	Õ­•Ðˆ¤¹Ù…±Õ”¹ÑÉ¥´ ¤ñð€‰…Õ‘¥Ðµ™¥±•Ìˆô¤ì(€€€€€½¹ÍÐÈ€ô…Ý…¥ÐMˆ¹Á¥¹œ ¤ì(€€€€€€ ˆÍ‰A¥¹=ÕÐˆ¤¹¥¹¹•É!Q50€ô€ñÕ°±…ÍÌô‰Ñ¥¬µ±¥ÍÐµÐˆø(€€€€€€€€ñ±¤±…ÍÌôˆ‘íÈ¹ÕÉ°€ü€ˆˆ€è€‰¹¼‰ôˆùUI0€‘íÈ¹ÕÉ°€ü€‹‚æ‚â«‚æ#‚æ‚â—‚æ'‚âœˆ€è€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚æ‚â«‚æ ‰ôð½±¤ø(€€€€€€€€ñ±¤±…ÍÌôˆ‘íÈ¹­•ä€ü€ˆˆ€è€‰¹¼‰ôˆù…¹½¸­•ä€‘íÈ¹­•ä€ü€‹‚æ‚â«‚æ#‚æ‚â—‚æ'‚âœˆ€è€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚æ‚â«‚æ ‰ôð½±¤ø(€€€€€€€€ñ±¤±…ÍÌôˆ‘íÈ¹…ÕÑ €ü€ˆˆ€è€‰¹¼‰ôˆû‚â—‚æ‚â·‚â‚â·‚âÓ‚âd€‘íÈ¹…ÕÑ €ü€‹‚æ‚â—‚æ'‚âœˆ€è€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â—‚æ‚â·‚â‚â·‚âÓ‚âd‰ôð½±¤ø(€€€€€€€€ñ±¤±…ÍÌôˆ‘íÈ¹Ñ…‰±•Ì€ü€ˆˆ€è€‰¹¼‰ôˆû‚â·‚æ#‚âË‚âg‚âW‚âË‚â‚âË‚â‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âd€‘íÈ¹Ñ…‰±•Ì€ü€‹‚æ‚âS‚æ$ˆ€è€‹‚æ‚â‡‚æ#‚æ‚âS‚æ$‰ôð½±¤ø(€€€€€€€€ñ±¤±…ÍÌôˆ‘íÈ¹ÍÑ½É…”€ü€ˆˆ€è€‰¹¼‰ôˆû‚â·‚æ#‚âË‚âd‰Õ­•Ð€‘íÈ¹ÍÑ½É…”€ü€‹‚æ‚âS‚æ$ˆ€è€‹‚æ‚â‡‚æ#‚æ‚âS‚æ$‰ôð½±¤ø(€€€€€€€€‘íÈ¹•ÉÉ½È€ü€ñ±¤±…ÍÌô‰¹¼ˆø‘í ¡È¹•ÉÉ½È¥ôð½±¤ù€€è€ˆ‰ô(€€€€€€ð½Õ°ù€ì(€€€ô¤ì(€€€É•ÑÕÉ¸ì(€ô((€¥˜€¡±½Õ‘MÑ…Ñ”¹­•ä€„ôô±½Õ‘EÕ•Éå-•ä ¤ñð€¡±½Õ‘MÑ…Ñ”¹‰…Ñ¡•Ì€ôôô¹Õ±°€˜˜€…±½Õ‘MÑ…Ñ”¹±½…‘¥¹œ€˜˜€…±½Õ‘MÑ…Ñ”¹•ÉÉ½È¤¤ì(€€€±½Õ‘1½… ¤ì(€ô((€½¹ÍÐ‰…Ñ¡•Ì€ô±½Õ‘MÑ…Ñ”¹‰…Ñ¡•Ìñðmtì(€½¹ÍÐ…±±¥±•Ì€ô‰…Ñ¡•Ì¹™±…Ñ5…À ¡ˆ¤€ôø€¡ˆ¹Í½ÕÉ•}™¥±•Ìñðmt¤¹µ…À ¡˜¤€ôø€¡ì€¸¸¹˜°‰ÕÍ¥¹•ÍÍ}‘…Ñ”èˆ¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”°½µÁ…¹äè˜¹½µÁ…¹äñðˆ¹½µÁ…¹ä°ÍÕ‰©•Ðèˆ¹ÍÕ‰©•Ðô¤¤¤ì(€½¹ÍÐ¥ÍAÉ½‰±•µ¥±”€ô€¡™¥±”¤€ôø	½½±•…¸ ¡™¥±”¹Á…ÉÍ•}•ÉÉ½È€˜˜€…ÍÑ…Ñ•µ•¹Ñ9••‘Í	½I•Ù¥•Ü¡™¥±”¤¤ñð™¥±”¹­¥¹€ôôô€‰Õ¹­¹½Ý¸ˆ¤ì(€½¹ÍÐ¥ÍI•…‘å¥±”€ô€¡™¥±”¤€ôø€…ÍÑ…Ñ•µ•¹Ñ9••‘Í	½I•Ù¥•Ü¡™¥±”¤€˜˜€…¥ÍAÉ½‰±•µ¥±”¡™¥±”¤€˜˜	½½±•…¸¡™¥±”¹Á…ÉÍ•ñð™¥±”¹­¥¹€ôôô€‰‘½}±…É¥™äˆ¤ì(€½¹ÍÐ¥Í]…¥Ñ¥¹¥±”€ô€¡™¥±”¤€ôø€…ÍÑ…Ñ•µ•¹Ñ9••‘Í	½I•Ù¥•Ü¡™¥±”¤€˜˜€…¥ÍAÉ½‰±•µ¥±”¡™¥±”¤€˜˜€…¥ÍI•…‘å¥±”¡™¥±”¤ì(€½¹ÍÐÉ•Ù¥•Ý¥±•Ì€ô…±±¥±•Ì¹™¥±Ñ•È¡ÍÑ…Ñ•µ•¹Ñ9••‘Í	½I•Ù¥•Ü¤ì(€½¹ÍÐÁÉ½‰±•µ¥±•Ì€ô…±±¥±•Ì(€€€€¹™¥±Ñ•È¡¥ÍAÉ½‰±•µ¥±”¤(€€€€¹Í½ÉÐ ¡„°ˆ¤€ôøMÑÉ¥¹œ¡ˆ¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”ñð€ˆˆ¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡„¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”ñð€ˆˆ¤¤ñðMÑÉ¥¹œ¡„¹½µÁ…¹äñð€ˆˆ¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡ˆ¹½µÁ…¹äñð€ˆˆ¤°€‰Ñ ˆ¤ñðMÑÉ¥¹œ¡„¹™¥±•}¹…µ”ñð€ˆˆ¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡ˆ¹™¥±•}¹…µ”ñð€ˆˆ¤°€‰Ñ ˆ¤¤ì(€½¹ÍÐÉ•…‘…‰±”€ô…±±¥±•Ì¹™¥±Ñ•È ¡˜¤€ôø€…˜¹•á±Õ‘•€˜˜€½p¸¡á±Íáñá±Íµñá±ÍñÍÙñÑáÑñÁ‘˜¤½¤¹Ñ•ÍÐ¡˜¹™¥±•}¹…µ”¤€˜˜˜¹­¥¹€„ôô€‰‘½}±…É¥™äˆ¤ì(€½¹ÍÐÉ•…‘å¥±•Ì€ô…±±¥±•Ì¹™¥±Ñ•È¡¥ÍI•…‘å¥±”¤ì(€½¹ÍÐÝ…¥Ñ¥¹¥±•Ì€ô…±±¥±•Ì¹™¥±Ñ•È¡¥Í]…¥Ñ¥¹¥±”¤ì(€½¹ÍÐÅÕ•Õ•…‰±•¥±•Ì€ôÉ•…‘…‰±”¹™¥±Ñ•È ¡˜¤€ôø€…˜¹Á…ÉÍ•€˜˜€…˜¹Á…ÉÍ•}•ÉÉ½È€˜˜˜¹­¥¹€„ôô€‰Õ¹­¹½Ý¸ˆ¤ì(€½¹ÍÐÁ¥­•‘¥±•Ì€ôÅÕ•Õ•…‰±•¥±•Ì¹™¥±Ñ•È ¡˜¤€ôø±½Õ‘MÑ…Ñ”¹Á¥­•‘m˜¹¥‘t¤ì(€½¹ÍÐÙ¥Í¥‰±•¥±”€ô€¡™¥±”¤€ôø±½Õ‘MÑ…Ñ”¹™¥±•Y¥•Ü€ôôô€‰É•Ù¥•Üˆ(€€€€üÍÑ…Ñ•µ•¹Ñ9••‘Í	½I•Ù¥•Ü¡™¥±”¤(€€€€è±½Õ‘MÑ…Ñ”¹™¥±•Y¥•Ü€ôôô€‰ÁÉ½‰±•´ˆ(€€€€ü¥ÍAÉ½‰±•µ¥±”¡™¥±”¤(€€€€è±½Õ‘MÑ…Ñ”¹™¥±•Y¥•Ü€ôôô€‰É•…‘äˆ(€€€€€€ü¥ÍI•…‘å¥±”¡™¥±”¤(€€€€€€è±½Õ‘MÑ…Ñ”¹™¥±•Y¥•Ü€ôôô€‰Ý…¥Ñ¥¹œˆ(€€€€€€€€ü¥Í]…¥Ñ¥¹¥±”¡™¥±”¤(€€€€€€€€èÑÉÕ”ì(€½¹ÍÐÙ¥Í¥‰±•	…Ñ¡•Ì€ô‰…Ñ¡•Ì¹µ…À ¡‰…Ñ ¤€ôø€¡ì€¸¸¹‰…Ñ °Í½ÕÉ•}™¥±•Ìè€¡‰…Ñ ¹Í½ÕÉ•}™¥±•Ìñðmt¤¹™¥±Ñ•È¡Ù¥Í¥‰±•¥±”¤ô¤¤¹™¥±Ñ•È ¡‰…Ñ ¤€ôø‰…Ñ ¹Í½ÕÉ•}™¥±•Ì¹±•¹Ñ ¤ì(€½¹ÍÐ‘…¥±ä€ô±½Õ‘MÑ…Ñ”¹‘…¥±äñðmtì(€½¹ÍÐ½Á•É…Ñ¥½¹Ì€ô±½Õ‘MÑ…Ñ”¹½Á•É…Ñ¥½¹Ìñðmtì(€½¹ÍÐ™¥±•M¹…ÁÍ¡½Ð€ôMˆ¹™¥±•M¹…ÁÍ¡½Ñ%¹™¼¡ì(€€€™É½´èÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½´ñðÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹Ñ¼ñð¹	UM%9MM}Q°(€€€Ñ¼èÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹Ñ¼ñð¹	UM%9MM}Q°(€€€½µÁ…¹äèÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä°(€ô¤ì(€½¹ÍÐ©½‰1…‰•°€ôìÝ…¥Ñ¥¹}™¥±•Ìè€‹‚â‚â·‚æ‚â‚â—‚æ0ˆ°É•…‘äè€‹‚â{‚â‚æ'‚â·‚â„ˆ°ÅÕ•Õ•è€‹‚æ‚â‚æ'‚âË‚â‚âÓ‚âœˆ°ÉÕ¹¹¥¹œè€‹‚â‚âÏ‚â—‚âÇ‚â‚â‚âÇ‚âdˆ°½µÁ±•Ñ•è€‹‚â«‚âÏ‚æ‚â‚æ‚â ˆ°¹••‘Í}É•Ù¥•Üè€‹‚âW‚æ'‚â·‚â‚âW‚â‚âŸ‚â#‚â«‚â·‚âhˆ°•ÉÉ½Èè€‹‚â—‚æ'‚â‡‚æ‚â¯‚â—‚âœˆôì(€½¹ÍÐ©½‰Q½¹”€ôìÝ…¥Ñ¥¹}™¥±•Ìè€‰…µ‰•Èˆ°É•…‘äè€‰‰±Õ”ˆ°ÅÕ•Õ•è€‰‰±Õ”ˆ°ÉÕ¹¹¥¹œè€‰Ù¥½±•Ðˆ°½µÁ±•Ñ•è€‰É••¸ˆ°¹••‘Í}É•Ù¥•Üè€‰É•ˆ°•ÉÉ½Èè€‰É•ˆôì((€É½½Ð¹¥¹¹•É!Q50€ô€(€€€€‘í½Á•É…Ñ¥½¹Ì¹Í½µ”¡¨ôù¨¹ÉÕ¹9½Ñ¥•ÉÉ½Éññ¨¹ÉÕ¹9½Ñ¥”ü¹¡½±ü¹Á…ÕÍ•‘ññ¨¹ÉÕ¹9½Ñ¥”ü¹µ…¹Õ…±=¹±åññ¨¹ÍÑ…ÑÕÌôôô•ÉÉ½Èñð¡lÅÕ•Õ•œ°•ÉÉ½Èt¹¥¹±Õ‘•Ì¡¨¹ÍÑ…ÑÕÌ¤˜™9Õµ‰•È¡¨¹ÉÕ¹9½Ñ¥”ü¹…ÑÑ•µÁÑ}½Õ¹Ð¤øôÌ¤¤ý€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆ…É¥„µ±…‰•°ô‹‚æ‚â#‚æ'‚â‚æ‚â¯‚âW‚âã‚â_‚â×‚æ#‚â‚âË‚âg‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‚âÇ‚âdˆøñ Èû‚â‚âË‚âg‚â_‚â×‚æ#‚âW‚æ'‚â·‚â‚â_‚â‚âË‚âk‚â‚æ#‚â·‚âg‚â‚âÇ‚âdð½ ÈøñÀû‚æ‚â‹‚â‚â‚âÓ‚âŸ‚â‚â·‚âk‚â¯‚â—‚âÇ‚â‚â‚âÇ‚âk‚â‚âË‚âg‚âW‚â‚âŸ‚â#‚â‡‚âß‚â´ƒ
Üƒ‚âW‚â‚âŸ‚â#‚æ‚â¯‚âW‚âã‚âs‚â—‚æ‚â—‚âÃ‚â‚âÇ‚æ'‚âg‚âW‚â·‚âg‚âW‚æ#‚â·‚æ‚âo‚âS‚æ'‚âË‚âg‚â—‚æ#‚âË‚âð½Àø‘í½Á•É…Ñ¥½¹Ì¹™¥±Ñ•È¡¨ôù¨¹ÉÕ¹9½Ñ¥•ÉÉ½Éññ¨¹ÉÕ¹9½Ñ¥”ü¹¡½±ü¹Á…ÕÍ•‘ññ¨¹ÉÕ¹9½Ñ¥”ü¹µ…¹Õ…±=¹±åññ¨¹ÍÑ…ÑÕÌôôô•ÉÉ½Èñð¡lÅÕ•Õ•œ°•ÉÉ½Èt¹¥¹±Õ‘•Ì¡¨¹ÍÑ…ÑÕÌ¤˜™9Õµ‰•È¡¨¹ÉÕ¹9½Ñ¥”ü¹…ÑÑ•µÁÑ}½Õ¹Ð¤øôÌ¤¤¹µ…À¡¨ôù€ñ Ìø‘í ¡¨¹½µÁ…¹ä¥ôƒ
Ü€‘í ¡¨¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”¥ôð½ Ìø‘í¥±•IÕ¹5…¹…•µ•¹Ð¹¹½Ñ¥•!Ñµ°¡¨¹ÉÕ¹9½Ñ¥”¥õ€¤¹©½¥¸ œœ¥ôñÀû‚âs‚âç‚æ'‚â‡‚â×‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚â«‚âÇ‚æ#‚â‚âW‚â‚âŸ‚â#‚æ‚â+‚æ'‚æ‚â‡‚âg‚âäƒŠs‚â‚âÇ‚âg‚â‡‚âß‚â´€¼ƒ‚â#‚âÇ‚âS‚â‚âË‚â‚æ‚â‚â—‚æ3Štƒ
Üƒ‚âs‚âç‚æ'‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚â#‚æ'‚âÕ‘¥Ð¿‚â¯‚âÇ‚âŸ‚â¯‚âg‚æ'‚âË‚æ‚âS‚æ'‚â#‚âË‚â‚æ‚â¯‚âW‚âã‚âs‚â—‚âg‚â×‚æ$ð½Àøð½Í•Ñ¥½¸ù€èœô(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆ¥ô‰…Í•Ù¥‘•¹•1¥‰É…ÉåA…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùÙ¥‘•¹”1¥‰É…Éäð½Àøñ Èû‚â‚â—‚âÇ‚â‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdƒ
Üƒ‚æ‚â‡‚â—‚æ‚â—‚âÃ‚âs‚âç‚æ'‚â+‚â×‚æ'‚æ‚â#‚âð½ ÈøñÍµ…±°û‚æ‚â+‚æ'‚âk‚â‚âÓ‚â§‚âÇ‚â_‚æ‚â—‚âÃ‚âŸ‚âÇ‚âg‚â_‚â×‚æ#‚æ‚â‚â«‚â#‚âË‚â‚âW‚âÇ‚âŸ‚â‚â‚â·‚â‚âS‚æ'‚âË‚âg‚âk‚âdƒ
Üƒ‚æ‚â‚æ‚âk‚æ‚â‚â—‚æ3‚æ‚âS‚âÓ‚â‡‚æ‚â—‚âÃ‚âo‚â‚âÃ‚âŸ‚âÇ‚âW‚âÓ‚â‚â‚âhƒ
Üƒ‚æ‚â‡‚æ#‚æ‚â‚æ'‚âË‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âPð½Íµ…±°øð½‘¥Øøð½‘¥Øø(€€€€€€‘í±½Õ‘MÑ…Ñ”¹•Ù¥‘•¹•ÉÉ½È€ü€ñÀÉ½±”ô‰…±•ÉÐˆø‘í ¡±½Õ‘MÑ…Ñ”¹•Ù¥‘•¹•ÉÉ½È¥ôð½Àù€€è±½Õ‘MÑ…Ñ”¹…Í•ÑÑ…¡µ•¹ÑÌ€ôôô¹Õ±°€ü€œñÀÉ½±”ô‰ÍÑ…ÑÕÌˆû‚â‚âÏ‚â—‚âÇ‚â‚æ‚â¯‚â—‚âS‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â#‚âË‚â‚æ‚â‚â«Š˜ð½Àøœ€è€œô(€€€€€€ñ‘¥Ø¥ô‰…Í•Ù¥‘•¹•1¥‰É…Éäˆøð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰ÍÑ…ÑÕÌµÍÑÉ¥À™½ÕÈ…Ñ¥½¸µÑ¥±•Ìˆø(€€€€€€ñ…ÉÑ¥±”±…ÍÌô‰½¬ˆ‘…Ñ„µÍÉ½±°µ±½Õô‰±½Õ‘%¹‰½àˆøñÍÁ…¸û‚æ‚â‡‚â—‚â_‚â×‚æ#‚âS‚âÛ‚â‚æ‚â‚æ'‚âË‚â‡‚âË‚æ‚â—‚æ'‚âœð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡‰…Ñ¡•Ì¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚â+‚æ#‚âŸ‚â€‘í ¡É…¹•1…‰•° ¤¥ôƒ
Üƒ‚â‚âS‚âS‚âç‚æ‚â‡‚â”ð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”‘…Ñ„µ±½ÕµÙ¥•Üô‰…±°ˆøñÍÁ…¸û‚æ‚â‚â—‚æ3‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âPð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡…±±¥±•Ì¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚â‚âS‚âS‚âç‚â_‚âã‚â‚â«‚â[‚âË‚âg‚âÀð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”±…ÍÌôˆ‘íÉ•…‘å¥±•Ì¹±•¹Ñ €ü€‰½¬ˆ€è€ˆ‰ôˆ‘…Ñ„µ±½ÕµÙ¥•Üô‰É•…‘äˆøñÍÁ…¸û‚â{‚â‚æ'‚â·‚â‡‚æ‚â+‚æ'‚â‚âË‚âdð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡É•…‘å¥±•Ì¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚â·‚æ#‚âË‚âg‚â«‚âÏ‚æ‚â‚æ‚â ƒ
Üƒ‚â‚âS‚âS‚âç‚â‚âË‚â‹‚â‚âË‚âŒð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”‘…Ñ„µ±½ÕµÙ¥•Üô‰Ý…¥Ñ¥¹œˆøñÍÁ…¸û‚â‚â·‚âo‚â‚âÃ‚â‡‚âŸ‚â—‚âs‚â”ð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡Ý…¥Ñ¥¹¥±•Ì¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚æ‚â‡‚æ#‚æ‚â+‚æ#‚æ‚â‚â—‚æ3‚æ‚â«‚â×‚âˆƒ
Üƒ‚â‚â·‚â‚âÃ‚âk‚âk‚â·‚æ#‚âË‚âdð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”‘…Ñ„µ±½ÕµÙ¥•Üô‰É•Ù¥•ÜˆøñÍÁ…¸û‚â·‚æ#‚âË‚âg‚æ‚â—‚æ'‚âœƒ
Üƒ‚â‚â·‚æ‚â_‚â×‚â‹‚âh	<ð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡É•Ù¥•Ý¥±•Ì¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚æ‚â‡‚æ#‚â{‚âk‚â‚âË‚â‹‚â‚âË‚â‚æ‚âg‚âŸ‚âÇ‚âg‚âW‚â‚âŸ‚â ƒ
Üƒ‚æ‚â‡‚æ#‚âW‚æ'‚â·‚â‚â‚âÇ‚âg‚æ‚â‚â—‚æ3‚æ‚âS‚âÓ‚â‡‚â/‚æ'‚âÌð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”±…ÍÌôˆ‘íÁÉ½‰±•µ¥±•Ì¹±•¹Ñ €ü€‰‘…¹•Èˆ€è€ˆ‰ôˆ‘…Ñ„µ±½ÕµÙ¥•Üô‰ÁÉ½‰±•´ˆøñÍÁ…¸û‚â‡‚â×‚âo‚âÇ‚â7‚â¯‚âË‚âW‚æ'‚â·‚â‚æ‚â‚æ$ð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡ÁÉ½‰±•µ¥±•Ì¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°ø‘íÁÉ½‰±•µ¥±•Ì¹±•¹Ñ €ü€‹‚æ‚â‡‚æ#‚â«‚æ#‚â‚æ‚âo‚â‚âÇ‚âg‚â#‚âg‚â‚âŸ‚æ#‚âË‚â#‚âÃ‚æ‚â‚æ$ˆ€è€‹‚æ‚â‡‚æ#‚â‡‚â×‚âo‚âÇ‚â7‚â¯‚âÈ‰ôð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€ð½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰…Õ‘¥Ðµ™¥±”µÕ¥‘”…Ñ¥½¸µÕ¥‘”ˆø(€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘…Ñ„µÍÉ½±°µ±½Õô‰±½Õ‘%¹‰½àˆøñ¤øÄð½¤øñÍÁ…¸øñˆû‚æ‚âo‚âÓ‚âS‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚æ‚âS‚æ'‚â‚âÇ‚âhð½ˆøñÍµ…±°û‚â‚âS‚æ‚â{‚âß‚æ#‚â·‚æ‚âo‚â‹‚âÇ‚â‚æ‚â‚â—‚æ3‚â#‚âË‚â‚æ‚â‡‚â”ð½Íµ…±°øð½ÍÁ…¸øð½‰ÕÑÑ½¸ø(€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘…Ñ„µÍÉ½±°µ±½Õôˆ‘íÁÉ½‰±•µ¥±•Ì¹±•¹Ñ €ü€‰ÁÉ½‰±•µ¥±•MÕµµ…Éäˆ€è€‰±½Õ‘%¹‰½à‰ôˆøñ¤øÈð½¤øñÍÁ…¸øñˆû‚âS‚âç‚æ‚â‚â—‚æ3‚âo‚âÇ‚â7‚â¯‚âË‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âPð½ˆøñÍµ…±°û‚âW‚â‚âŸ‚â#‚â‚âË‚â‹‚â+‚âß‚æ#‚â·‚æ‚â—‚âÃ‚â«‚âË‚æ‚â¯‚âW‚âã‚â‚æ#‚â·‚âg‚æ‚â‚æ'‚â_‚â×‚â—‚âÃ‚æ‚â‚â—‚æ0ð½Íµ…±°øð½ÍÁ…¸øð½‰ÕÑÑ½¸ø(€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘…Ñ„µ…Ñ¥½¸µÉ½ÕÑ”ô‰‘…¥±äµÍÕµµ…Éäˆøñ¤øÌð½¤øñÍÁ…¸øñˆû‚âS‚âç‚âs‚â—‚â¯‚â—‚âÇ‚â‚âk‚âÇ‚âg‚â_‚âÛ‚âð½ˆøñÍµ…±°û‚æ‚âo‚â«‚â‚âã‚âl€Äƒ‚âk‚â‚âÓ‚â§‚âÇ‚â\€Äƒ‚âŸ‚âÇ‚âdð½Íµ…±°øð½ÍÁ…¸øð½‰ÕÑÑ½¸ø(€€€€ð½Í•Ñ¥½¸ø((€€€€‘íÁÉ½‰±•µ¥±•Ì¹±•¹Ñ €ü€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ÁÉ½‰±•´µ™¥±”µÍÕµµ…Éäˆ¥ô‰ÁÉ½‰±•µ¥±•MÕµµ…Éäˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùAÉ½‰±•´™¥±•Ìð½Àøñ Èû‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚â{‚âk‚âo‚âÇ‚â7‚â¯‚âË‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âPð½ ÈøñÍµ…±°±…ÍÌô‰¡•…µÍÕˆˆû‚â‚âŸ‚â„€‘í¹Õ´¡ÁÉ½‰±•µ¥±•Ì¹±•¹Ñ ¥ôƒ‚æ‚â‚â—‚æ3‚æ‚âg‚â+‚æ#‚âŸ‚â€‘í ¡É…¹•1…‰•° ¤¥ôƒ
Üƒ‚âW‚â‚âŸ‚â#‚â‚âË‚â‹‚â+‚âß‚æ#‚â·‚æ‚â—‚âÃ‚â«‚âË‚æ‚â¯‚âW‚âã‚â‚æ#‚â·‚âg‚æ‚â‚âÓ‚æ#‚â‡‚æ‚â‚æ$ð½Íµ…±°øð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹±¥¹”µ…Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸Í´ˆ¥ô‰I•Ù¥•Ý%ÍÍÕ•Ìˆû‚æ‚â‚âÓ‚æ#‚â‡‚âW‚â‚âŸ‚â#‚â_‚â×‚â—‚âÃ‚æ‚â‚â—‚æ0ð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘…Ñ„µÍÉ½±°µ±½Õô‰±½Õ‘%¹‰½àˆû‚âS‚âç‚æ‚â‚â—‚æ3‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âS‚â#‚âË‚â‚æ‚â‡‚â”ð½‰ÕÑÑ½¸øð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…ÀÁÉ½‰±•´µ™¥±”µÑ…‰±”ˆøñÑ…‰±”ø(€€€€€€€€ñÑ¡•…øñÑÈøñÑ øŒð½Ñ øñÑ û‚âŸ‚âÇ‚âg‚â_‚â×‚æ ð½Ñ øñÑ û‚âk‚â‚âÓ‚â§‚âÇ‚â\ð½Ñ øñÑ û‚â+‚âß‚æ#‚â·‚æ‚â‚â—‚æ0ð½Ñ øñÑ û‚âo‚â‚âÃ‚æ‚âƒ‚â_‚âo‚âÇ‚â#‚â#‚âã‚âk‚âÇ‚âdð½Ñ øñÑ û‚âo‚âÇ‚â7‚â¯‚âË‚â_‚â×‚æ#‚â{‚âhð½Ñ øñÑ øð½Ñ øð½ÑÈøð½Ñ¡•…ø(€€€€€€€€ñÑ‰½‘äø‘íÁÉ½‰±•µ¥±•Ì¹µ…À ¡™¥±”°¥¹‘•à¤€ôø€ñÑÈ±…ÍÌô‰‰…ˆø(€€€€€€€€€€ñÑ±…ÍÌô‰Ñ¹Õ´ˆø‘í¹Õ´¡¥¹‘•à€¬€Ä¥ôð½ÑøñÑøñˆø‘í ¡™¥±”¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”ñð€ˆ´ˆ¥ôð½ˆøð½ÑøñÑø‘í ¡™¥±”¹½µÁ…¹äñð€‹‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âàˆ¥ôð½Ñø(€€€€€€€€€€ñÑøñ‰ÕÑÑ½¸±…ÍÌô‰™¥±”µ¹…µ”µ±¥¹¬ˆ‘…Ñ„µÍÑ½É…”µ½Á•¸ôˆ‘í ¡™¥±”¹ÍÑ½É…•}Á…Ñ ¥ôˆ‘…Ñ„µ™¥±”µ¥ôˆ‘í ¡™¥±”¹¥¥ôˆ‘…Ñ„µ™¥±”µ¹…µ”ôˆ‘í ¡™¥±”¹™¥±•}¹…µ”¥ôˆ‘…Ñ„µ™¥±”µµ¥µ”ôˆ‘í ¡™¥±”¹µ¥µ•}ÑåÁ”ñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µÍ¥é”ôˆ‘í ¡™¥±”¹Í¥é•}‰åÑ•Ìñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µ­¥¹ôˆ‘í ¡™¥±”¹­¥¹ñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µ½µÁ…¹äôˆ‘í ¡™¥±”¹½µÁ…¹äñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µ‘…Ñ”ôˆ‘í ¡™¥±”¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”ñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µÍÑ…ÑÕÌôˆ‘í™¥±”¹Á…ÉÍ•}•ÉÉ½È€ü€‰•ÉÉ½Èˆ€è€‰Ý…¥Ñ¥¹œ‰ôˆ€‘í™¥±”¹ÍÑ½É…•}Á…Ñ €ü€ˆˆ€è€‰‘¥Í…‰±•‰ôøñÍÁ…¸ø‘í ¡™¥±”¹™¥±•}¹…µ”¥ôð½ÍÁ…¸øñÍµ…±°ø‘í ¡™¥±”¹ÍÕ‰©•Ðñð€‹‚â‚âS‚æ‚â{‚âß‚æ#‚â·‚âS‚âç‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚âˆ¥ôð½Íµ…±°øð½‰ÕÑÑ½¸øð½Ñø(€€€€€€€€€€ñÑø‘í ¡-%9}1	1m™¥±”¹­¥¹‘tñð™¥±”¹­¥¹ñð€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â_‚â‚âË‚âk‚âo‚â‚âÃ‚æ‚âƒ‚â\ˆ¥ôð½Ñø(€€€€€€€€€€ñÑøñÍÁ…¸±…ÍÌô‰‰…‘”É•ˆø‘í™¥±”¹Á…ÉÍ•}•ÉÉ½È€ü ¡ÍÑ…Ñ•µ•¹ÑI•Ù¥•Ý1…‰•°¡™¥±”¤¤€è€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â_‚â‚âË‚âk‚âo‚â‚âÃ‚æ‚âƒ‚â\‰ôð½ÍÁ…¸øñÍµ…±°±…ÍÌô‰ÍÕˆ‘…¹•Èˆø‘í ¡™¥±”¹Á…ÉÍ•}•ÉÉ½Èñð€‹‚âW‚æ'‚â·‚â‚æ‚âo‚âÓ‚âPAÉ•Ù¥•Üƒ‚æ‚â—‚æ'‚âŸ‚æ‚â—‚âß‚â·‚â‚âo‚â‚âÃ‚æ‚âƒ‚â_‚æ‚â‚â—‚æ0ˆ¥ôð½Íµ…±°øð½Ñø(€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡Ðˆøñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸áÌˆ‘…Ñ„µÍÑ½É…”µ½Á•¸ôˆ‘í ¡™¥±”¹ÍÑ½É…•}Á…Ñ ¥ôˆ‘…Ñ„µ™¥±”µ¥ôˆ‘í ¡™¥±”¹¥¥ôˆ‘…Ñ„µ™¥±”µ¹…µ”ôˆ‘í ¡™¥±”¹™¥±•}¹…µ”¥ôˆ‘…Ñ„µ™¥±”µµ¥µ”ôˆ‘í ¡™¥±”¹µ¥µ•}ÑåÁ”ñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µÍ¥é”ôˆ‘í ¡™¥±”¹Í¥é•}‰åÑ•Ìñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µ­¥¹ôˆ‘í ¡™¥±”¹­¥¹ñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µ½µÁ…¹äôˆ‘í ¡™¥±”¹½µÁ…¹äñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µ‘…Ñ”ôˆ‘í ¡™¥±”¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”ñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µÍÑ…ÑÕÌôˆ‘í™¥±”¹Á…ÉÍ•}•ÉÉ½È€ü€‰•ÉÉ½Èˆ€è€‰Ý…¥Ñ¥¹œ‰ôˆ€‘í™¥±”¹ÍÑ½É…•}Á…Ñ €ü€ˆˆ€è€‰‘¥Í…‰±•‰ôû‚æ‚âo‚âÓ‚âS‚âW‚â‚âŸ‚â ð½‰ÕÑÑ½¸øð½Ñø(€€€€€€€€ð½ÑÈù€¤¹©½¥¸ ˆˆ¥ôð½Ñ‰½‘äø(€€€€€€ð½Ñ…‰±”øð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ù€€è€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ÁÉ½‰±•´µ™¥±”µÍÕµµ…Éä½¬ˆ¥ô‰ÁÉ½‰±•µ¥±•MÕµµ…Éäˆøñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùAÉ½‰±•´™¥±•Ìð½Àøñ Èû‚æ‚â‡‚æ#‚â{‚âk‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚â‡‚â×‚âo‚âÇ‚â7‚â¯‚âÈð½ ÈøñÍµ…±°±…ÍÌô‰¡•…µÍÕˆˆû‚æ‚â‚â—‚æ3‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âS‚â‡‚â×‚âo‚â‚âÃ‚æ‚âƒ‚â_‚æ‚â—‚æ'‚âŸ‚æ‚â—‚âÃ‚æ‚â‡‚æ#‚â‡‚â×‚â‚æ'‚â·‚âs‚âÓ‚âS‚â{‚â—‚âË‚âS‚â#‚âË‚â‚â‚âË‚â‚â·‚æ#‚âË‚âdð½Íµ…±°øð½‘¥Øøñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘…Ñ„µÍÉ½±°µ±½Õô‰±½Õ‘%¹‰½àˆû‚âS‚âç‚æ‚â‚â—‚æ3‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âS‚â#‚âË‚â‚æ‚â‡‚â”ð½‰ÕÑÑ½¸øð½‘¥Øøð½Í•Ñ¥½¸ùô((€€€€‘ì(€€€€€½Á•É…Ñ¥½¹Ì¹±•¹Ñ (€€€€€€€€ü€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆù…¥±ä=Á•É…Ñ¥½¹Ìð½Àøñ Èû‚â‚âÓ‚âŸ‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÐð½ Èøð½‘¥ØøñÍÁ…¸±…ÍÌô‰¡•…±Ñ €‘í½Á•É…Ñ¥½¹Ì¹Í½µ” ¡à¤€ôøà¹ÍÑ…ÑÕÌ€ôôô€‰•ÉÉ½Èˆñðà¹ÍÑ…ÑÕÌ€ôôô€‰¹••‘Í}É•Ù¥•Üˆ¤€ü€‰…ÑÑ•¹Ñ¥½¸ˆ€è€‰½¬‰ôˆø‘í½Á•É…Ñ¥½¹Ì¹™¥±Ñ•È ¡à¤€ôøà¹ÍÑ…ÑÕÌ€ôôô€‰ÅÕ•Õ•ˆñðà¹ÍÑ…ÑÕÌ€ôôô€‰ÉÕ¹¹¥¹œˆ¤¹±•¹Ñ¡ôƒ‚â‚âË‚âg‚â‚âÏ‚â—‚âÇ‚â‚âS‚âÏ‚æ‚âg‚âÓ‚âg‚â‚âË‚âŒð½ÍÁ…¸øð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…ÀˆøñÑ…‰±”ø(€€€€€€€€ñÑ¡•…øñÑÈøñÑ û‚âŸ‚âÇ‚âg‚â_‚â×‚æ ð½Ñ øñÑ û‚âk‚â‚âÓ‚â§‚âÇ‚â\¿‚â‚âÃ‚âk‚âhð½Ñ øñÑ û‚â«‚â[‚âË‚âg‚âÀð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚æ‚â‡‚â”ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚æ‚â‚â—‚æ0ð½Ñ øñÑ û‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚â‚âË‚âPð½Ñ øñÑ û‚âs‚â—‚â—‚æ#‚âË‚â«‚âã‚âPð½Ñ øð½ÑÈøð½Ñ¡•…ø(€€€€€€€€ñÑ‰½‘äø‘í½Á•É…Ñ¥½¹Ì(€€€€€€€€€€¹µ…À (€€€€€€€€€€€€¡¨¤€ôø€ñÑÈ±…ÍÌô‰…Ñ¥½¸µÉ½Üˆ‘…Ñ„µÍÕµµ…Éäµ½µÁ…¹äôˆ‘í ¡¨¹½µÁ…¹ä¥ôˆ‘…Ñ„µÍÕµµ…Éäµ‘…Ñ”ôˆ‘í ¡¨¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”¥ôˆÉ½±”ô‰±¥¹¬ˆÑ…‰¥¹‘•àôˆÀˆø(€€€€€€€€€€€€ñÑøñˆø‘í ¡¨¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”¥ôð½ˆø‘í¨¹±…Ñ•}™¥±”€ü€œñÍµ…±°±…ÍÌô‰ÍÕˆ‘…¹•Èˆû‚â‡‚â×‚æ‚â‚â—‚æ3‚â‡‚âË‚â+‚æ'‚âÈƒ
Üƒ‚âW‚â‚âŸ‚â#‚â«‚â[‚âË‚âg‚âÃ‚â‚âÇ‚âg‚â‚æ#‚â·‚âdð½Íµ…±°øœ€è€ˆ‰ôð½Ñø(€€€€€€€€€€€€ñÑø‘í ¡¨¹½µÁ…¹ä¥ô‘í¨¹‰ÕÍ¥¹•ÍÍ}ÍåÍÑ•´€ü€ñÍµ…±°±…ÍÌô‰ÍÕˆˆø‘í ¡¨¹‰ÕÍ¥¹•ÍÍ}ÍåÍÑ•´¥ôð½Íµ…±°ù€€è€ˆ‰ôð½Ñø(€€€€€€€€€€€€ñÑøñÍÁ…¸±…ÍÌô‰‰…‘”€‘í¨¹ÉÕ¹9½Ñ¥”ü¹¡½±ü¹Á…ÕÍ•‘ññ¨¹ÉÕ¹9½Ñ¥”ü¹µ…¹Õ…±=¹±äü…µ‰•Èœé©½‰Q½¹•m¨¹ÍÑ…ÑÕÍtñð€‰É•ä‰ôˆø‘í ¡¨¹ÉÕ¹9½Ñ¥”ü¹¡½±ü¹Á…ÕÍ•‘ññ¨¹ÉÕ¹9½Ñ¥”ü¹µ…¹Õ…±=¹±äüŸ‚â{‚âÇ‚â‚âk‚â·‚â_‚â‚â·‚âk‚â¯‚â—‚âÇ‚âœé©½‰1…‰•±m¨¹ÍÑ…ÑÕÍtñð¨¹ÍÑ…ÑÕÌ¥ôð½ÍÁ…¸ø‘í¨¹ÉÕ¹9½Ñ¥•ÉÉ½ÈüœñÍµ…±°±…ÍÌô‰ÍÕˆ‘…¹•Èˆû‚â‹‚âÇ‚â‚âW‚â‚âŸ‚â#‚â«‚â[‚âË‚âg‚âÃ‚â{‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ$ƒ
Üƒ‚æ‚â¯‚â—‚âS‚â«‚â[‚âË‚âg‚âÃ‚â—‚æ#‚âË‚â«‚âã‚âS‚â‚æ#‚â·‚âg‚â«‚âÇ‚æ#‚â‚â‚âË‚âdð½Íµ…±°øœé¨¹ÉÕ¹9½Ñ¥”˜˜¡¨¹ÉÕ¹9½Ñ¥”¹¡½±ü¹Á…ÕÍ•‘ññ¨¹ÉÕ¹9½Ñ¥”¹µ…¹Õ…±=¹±åññ¨¹ÍÑ…ÑÕÌôôô•ÉÉ½Èññ9Õµ‰•È¡¨¹ÉÕ¹9½Ñ¥”¹…ÑÑ•µÁÑ}½Õ¹Ð¤øôÌ¤ý¥±•IÕ¹5…¹…•µ•¹Ð¹¹½Ñ¥•!Ñµ°¡¨¹ÉÕ¹9½Ñ¥”¤èœô‘í¨¹±…ÍÑ}•ÉÉ½È€˜˜€…¨¹ÉÕ¹9½Ñ¥”ü¹Ý½É­•É…¥±ÕÉ”€˜˜€…¨¹±…ÍÑ}•ÉÉ½È¹¥¹±Õ‘•Ì ‹‚âW‚â‚âŸ‚â#‚â‚âç‚âo‚æ‚âk‚âk‚æ‚â‚â—‚æ3‚â¯‚â‚âß‚â·‚æ‚â{‚âÓ‚æ#‚â‡‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚â[‚âç‚â‚âW‚æ'‚â·‚âˆ¤€ü€ñÍµ…±°±…ÍÌô‰ÍÕˆ‘…¹•ÈˆÑ¥Ñ±”ôˆ‘í ¡¨¹±…ÍÑ}•ÉÉ½È¥ôˆø‘í ¡¨¹±…ÍÑ}•ÉÉ½È¹Í±¥” À°€àÀ¤¥ôð½Íµ…±°ù€€è€ˆ‰ôð½Ñø(€€€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í¹Õ´¡¨¹µ…¥±}½Õ¹Ð¥ôð½ÑøñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í¹Õ´¡¨¹™¥±•}½Õ¹Ð¥ôð½Ñø(€€€€€€€€€€€€ñÑ±…ÍÌô‰µÕÑ•ˆø‘í ¡±½Õ‘5¥ÍÍ¥¹É½ÕÁÍQ•áÐ¡¨¹µ¥ÍÍ¥¹}É½ÕÁÌ¤¥ôð½Ñø(€€€€€€€€€€€€ñÑø‘í¨¹µ…Ñ¡}É…Ñ”€ôô¹Õ±°€ü€ˆ´ˆ€è€‘í9Õµ‰•È¡¨¹µ…Ñ¡}É…Ñ”¤¹Ñ½¥á• È¥ô”ƒ
Ü•á•ÁÑ¥½¸€‘í¹Õ´¡¨¹•á•ÁÑ¥½¹}½Õ¹Ð¥õôð½Ñø(€€€€€€€€€€ð½ÑÈù€°(€€€€€€€€€€¤(€€€€€€€€€€¹©½¥¸ ˆˆ¥ôð½Ñ‰½‘äø(€€€€€€ð½Ñ…‰±”øð½‘¥Øø(€€€€€€ñÀ±…ÍÌô‰¡¥¹Ðˆû‚â‚âÓ‚âŸ‚â‚â·‚âk‚â¯‚â—‚âÇ‚â‚â‚âÇ‚âk‚â‚âË‚âg‚âW‚â‚âŸ‚â#‚â‡‚âß‚â·‚æ‚âo‚æ‚âg‚â‚âg‚â—‚âÃ‚â‚âË‚âdƒ
Üƒ‚â‚âË‚âg‚â{‚âÇ‚â¿‚æ‚â‚â—‚æ3‚æ‚â‚æ'‚æ‚â‚â#‚âÃ‚æ‚â‡‚æ#‚â‚âÇ‚âg‚â¯‚â—‚âÇ‚â‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÐƒ‚æ‚â—‚âß‚â·‚âƒŠs‚â‚âÇ‚âg‚â‡‚âß‚â´€¼ƒ‚â#‚âÇ‚âS‚â‚âË‚â‚æ‚â‚â—‚æ3Štƒ‚æ‚â{‚âß‚æ#‚â·‚âS‚âç‚æ‚â¯‚âW‚âã‚âs‚â—‚æ‚â—‚âÃ‚â‚âÇ‚âg‚â‚âË‚â‹‚â‚âË‚âg‚æ‚â‹‚âð½Àø(€€€€ð½Í•Ñ¥½¸ù€(€€€€€€€€è€ˆˆ(€€€ô((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆ¥ô‰±½Õ‘%¹‰½àˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆù±½Õ%¹‰½àð½Àøñ Èû‚æ‚â‚â—‚æ3‚â#‚âË‚â‚æ‚â‡‚â”U%P€Èð½ ÈøñÍµ…±°±…ÍÌô‰¡•…µÍÕˆˆû‚â—‚æ‚â·‚â‚â·‚âÓ‚âg‚æ‚âo‚æ‚âd€‘í ¡Mˆ¹ÕÉÉ•¹Ñµ…¥° ¤¥ôƒ
Ü€‘í±½Õ‘MÑ…Ñ”¹•ÉÉ½È€ü€‹‚æ‚â¯‚â—‚âS‚â‚æ'‚â·‚â‡‚âç‚â—‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ˆ€è±½Õ‘MÑ…Ñ”¹Á…ÉÑ¥…±ÉÉ½È€ü ¡±½Õ‘MÑ…Ñ”¹Á…ÉÑ¥…±ÉÉ½È¤€è€‹‚â·‚âÇ‚âo‚æ‚âS‚âW‚â—‚æ#‚âË‚â«‚âã‚âP€ˆ€¬€¡Œ¹±…ÍÑMå¹Œ€ü‘¥ÍÁ±…åQ¥µ”¡Œ¹±…ÍÑMå¹Œ¤€è€ˆ´ˆ¥ôð½Íµ…±°øð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹±¥¹”µ…Ñ¥½¹Ìˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰I•±½…ˆ€‘í±½Õ‘MÑ…Ñ”¹±½…‘¥¹œ€ü€‰‘¥Í…‰±•ˆ€è€ˆ‰ôø‘í±½Õ‘MÑ…Ñ”¹±½…‘¥¹œ€ü€‹‚â‚âÏ‚â—‚âÇ‚â‚æ‚â¯‚â—‚âP¸¸¸ˆ€è€‹‚â‚â×‚æ‚â‚â‚â(‰ôð½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰Ù¥‘•¹•I•½µµ•¹‘…Ñ¥½¹Ìˆû‚â‚âç‚æ#‚æ‚âg‚âÃ‚âg‚âÏ‚â#‚âË‚â‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdð½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰A¥­9•Üˆû‚æ‚â—‚âß‚â·‚â‚æ‚â'‚â{‚âË‚âÃ‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚â{‚â‚æ'‚â·‚â‡‚â‚âÇ‚âdð½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸Í´ˆ¥ô‰%µÁ½ÉÐˆ€‘íÁ¥­•‘¥±•Ì¹±•¹Ñ €ü€ˆˆ€è€‰‘¥Í…‰±•‰ôû‚â·‚æ#‚âË‚âg‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚æ‚â—‚âß‚â·‚â€‘íÁ¥­•‘¥±•Ì¹±•¹Ñ €ü€ ‘íÁ¥­•‘¥±•Ì¹±•¹Ñ¡ô¥€€è€ˆ‰ôð½‰ÕÑÑ½¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€€€ñÀ±…ÍÌô‰¡¥¹ÐˆÉ½±”ô‰ÍÑ…ÑÕÌˆû‚â«‚æ‚âg‚âo‚â+‚æ‚â·‚âW‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚æ‚â‚â—‚æ3‚æ‚âg‚æ‚â_‚æ‚âk‚âg‚â×‚æ$‘í™¥±•M¹…ÁÍ¡½Ð€ü€œƒ
Üƒ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â‡‚âß‚æ#‚â´€œ€¬ ¡‘¥ÍÁ±…åQ¥µ”¡™¥±•M¹…ÁÍ¡½Ð¹ÕÁ‘…Ñ•‘Ð¤¤€è€œôƒ
Üƒ‚æ‚âo‚â—‚â×‚æ#‚â‹‚âg‚â¯‚âg‚æ'‚âË‚æ‚â+‚æ'‚â‚æ'‚â·‚â‡‚âç‚â—‚æ‚âS‚âÓ‚â„ƒ
Üƒ‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚â‚âW‚æ'‚âg‚â'‚âk‚âÇ‚âk‚â{‚âÇ‚â‚æ‚âg‚â¯‚âg‚æ#‚âŸ‚â‹‚â‚âŸ‚âË‚â‡‚â#‚âÏ‚æ‚â‡‚æ#‚æ‚â‚âÓ‚âd€Ôƒ‚âg‚âË‚â_‚âÔƒ
Üƒ‚â‚âS‚â‚â×‚æ‚â‚â‚â+‚æ‚â{‚âß‚æ#‚â·‚â·‚æ#‚âË‚âg‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚â—‚æ#‚âË‚â«‚âã‚âPƒ
Üƒ‚æ‚â‡‚æ#‚æ‚â+‚æ#‚â‚âË‚â‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â«‚â[‚âË‚âg‚âÃ‚âo‚âÓ‚âS‚æ‚â‚â¨ð½Àø(€€€€€€‘í±½Õ‘MÑ…Ñ”¹…Õá¥±¥…Éå1½…‘¥¹œ€ü€œñÀÉ½±”ô‰ÍÑ…ÑÕÌˆû‚â‚âÏ‚â—‚âÇ‚â‚æ‚â¯‚â—‚âS‚â«‚â‚âã‚âl¿‚â‚âÓ‚âŸ‚æ‚â—‚âÃ‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚â{‚âÓ‚æ#‚â‡‚æ‚âW‚âÓ‚â„ƒ
Üƒ‚â‚âË‚â‹‚â‚âË‚â‚æ‚â‚â—‚æ3‚æ‚â«‚âS‚â‚æ‚â‹‚â‚æ‚âS‚æ$ƒ‚æ‚â‡‚æ#‚â‚âÇ‚âg‚â‚âË‚âdð½Àøœ€è€œô(€€€€€€ñ‘¥Ø±…ÍÌô‰±½Õµ™¥±”µÑ…‰ÌˆÉ½±”ô‰Ñ…‰±¥ÍÐˆ…É¥„µ±…‰•°ô‹‚â‚â‚â·‚â‚â«‚â[‚âË‚âg‚âÃ‚æ‚â‚â—‚æ0ˆø(€€€€€€€€‘íml‰…±°ˆ°€‹‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âPˆ°…±±¥±•Ì¹±•¹Ñ¡t°l‰É•…‘äˆ°€‹‚â{‚â‚æ'‚â·‚â‡‚æ‚â+‚æ'‚â‚âË‚âdˆ°É•…‘å¥±•Ì¹±•¹Ñ¡t°l‰Ý…¥Ñ¥¹œˆ°€‹‚â‚â·‚âo‚â‚âÃ‚â‡‚âŸ‚â—‚âs‚â”ˆ°Ý…¥Ñ¥¹¥±•Ì¹±•¹Ñ¡t°l‰É•Ù¥•Üˆ°€‹‚â·‚æ#‚âË‚âg‚æ‚â—‚æ'‚âœƒ
Üƒ‚â‚â·‚æ‚â_‚â×‚â‹‚âh	<ˆ°É•Ù¥•Ý¥±•Ì¹±•¹Ñ¡t°l‰ÁÉ½‰±•´ˆ°€‹‚â‡‚â×‚âo‚âÇ‚â7‚â¯‚âË‚âW‚æ'‚â·‚â‚æ‚â‚æ$ˆ°ÁÉ½‰±•µ¥±•Ì¹±•¹Ñ¡ut¹µ…À ¡mÙ…±Õ”°±…‰•°°½Õ¹Ñt¤€ôø€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆÉ½±”ô‰Ñ…ˆˆ‘…Ñ„µ±½Õµ™¥±”µÙ¥•Üôˆ‘íÙ…±Õ•ôˆ…É¥„µÍ•±•Ñ•ôˆ‘í±½Õ‘MÑ…Ñ”¹™¥±•Y¥•Ü€ôôôÙ…±Õ•ôˆ±…ÍÌôˆ‘í±½Õ‘MÑ…Ñ”¹™¥±•Y¥•Ü€ôôôÙ…±Õ”€ü€‰…Ñ¥Ù”ˆ€è€ˆ‰ôˆø‘í±…‰•±ô€ñˆø‘í¹Õ´¡½Õ¹Ð¥ôð½ˆøð½‰ÕÑÑ½¸ù€¤¹©½¥¸ ˆˆ¥ô(€€€€€€ð½‘¥Øø(€€€€€€‘í±½Õ‘MÑ…Ñ”¹•ÉÉ½È€ü€ñÀ±…ÍÌô‰¡¥¹Ð‘…¹•Èˆø‘í ¡±½Õ‘MÑ…Ñ”¹•ÉÉ½È¥ôð½Àù€€è±½Õ‘MÑ…Ñ”¹Á…ÉÑ¥…±ÉÉ½È€ü€ñÀ±…ÍÌô‰¡¥¹ÐÝ…É¸ˆø‘í ¡±½Õ‘MÑ…Ñ”¹Á…ÉÑ¥…±ÉÉ½È¥ôƒ
Üƒ‚â«‚æ#‚âŸ‚âg‚â_‚â×‚æ#‚æ‚â¯‚â—‚âS‚â«‚âÏ‚æ‚â‚æ‚â#‚â‹‚âÇ‚â‚æ‚âo‚âÓ‚âS‚âS‚âç‚æ‚âS‚æ$ð½Àù€€è€ˆ‰ô(€€€€€€‘ì(€€€€€€€Ù¥Í¥‰±•	…Ñ¡•Ì¹±•¹Ñ (€€€€€€€€€€üÙ¥Í¥‰±•	…Ñ¡•Ì(€€€€€€€€€€€€€€¹µ…À (€€€€€€€€€€€€€€€€¡ˆ¤€ôø€ñ‘¥Ø±…ÍÌô‰µ…¥°µ…Éˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰µ…¥°µ¡•…ˆø(€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€ñÍÑÉ½¹œø‘í ¡ˆ¹ÍÕ‰©•Ðñð€ˆ£‚æ‚â‡‚æ#‚â‡‚â×‚â¯‚âÇ‚âŸ‚â‚æ'‚â´¤ˆ¥ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€ñÍÁ…¸ø‘í ¡ˆ¹Í•¹‘•Èñð€ˆ´ˆ¥ôƒ
Üƒ‚â‚âÇ‚âk‚æ‚â‡‚âß‚æ#‚â´€‘í ¡‘¥ÍÁ±…åQ¥µ”¡ˆ¹É••¥Ù•‘}…Ð¤¥ôð½ÍÁ…¸ø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰µ…¥°µÑ…Ìˆø(€€€€€€€€€€€€‘íˆ¹½µÁ…¹ä€ü€ñÍÁ…¸±…ÍÌô‰‰…‘”Ù¥½±•Ðˆø‘í ¡ˆ¹½µÁ…¹ä¥ôð½ÍÁ…¸ù€€è€ˆ‰ô(€€€€€€€€€€€€‘íˆ¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”€ü€ñÍÁ…¸±…ÍÌô‰‰…‘”‰±Õ”ˆø‘í ¡ˆ¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”¥ôð½ÍÁ…¸ù€€è€ˆ‰ô(€€€€€€€€€€€€‘íˆ¹¥Í}ÍÕÁÁ±•µ•¹Ð€ü€ñÍÁ…¸±…ÍÌô‰‰…‘”…µ‰•Èˆû‚æ‚â{‚âÓ‚æ#‚â‡‚æ‚âW‚âÓ‚â„ð½ÍÁ…¸ù€€è€ˆ‰ô(€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰‰…‘”€‘íˆ¹ÍÑ…ÑÕÌ€ôôô€‰ÍÑ½É•ˆ€ü€‰É••¸ˆ€è€‰É•ä‰ôˆø‘í ¡ˆ¹ÍÑ…ÑÕÌ¥ôð½ÍÁ…¸ø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…Àˆø(€€€€€€€€€€ñÑ…‰±”ø(€€€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ ÍÑå±”ô‰Ý¥‘Ñ èÌÑÁàˆøð½Ñ øñÑ û‚æ‚â‚â—‚æ0ð½Ñ øñÑ û‚â+‚âg‚âÓ‚âS‚â_‚â×‚æ#‚â‚âÃ‚âk‚âk‚æ‚âS‚âÈð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚â‚âg‚âË‚âPð½Ñ øñÑ û‚â«‚â[‚âË‚âg‚âÀð½Ñ øñÑ øð½Ñ øð½ÑÈøð½Ñ¡•…ø(€€€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€€€€‘ì¡ˆ¹Í½ÕÉ•}™¥±•Ìñðmt¤(€€€€€€€€€€€€€€€€¹Í½ÉÐ ¡à°ä¤€ôøMÑÉ¥¹œ¡à¹™¥±•}¹…µ”¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡ä¹™¥±•}¹…µ”¤°€‰Ñ ˆ¤¤(€€€€€€€€€€€€€€€€¹µ…À ¡˜¤€ôøì(€€€€€€€€€€€€€€€€€½¹ÍÐ…¹I•…€ô€½p¸¡á±Íáñá±Íµñá±ÍñÍÙñÑáÑñÁ‘˜¤½¤¹Ñ•ÍÐ¡˜¹™¥±•}¹…µ”¤€˜˜˜¹­¥¹€„ôô€‰‘½}±…É¥™äˆì(€€€€€€€€€€€€€€€€€½¹ÍÐ…¹EÕ•Õ”€ô…¹I•…€˜˜€…˜¹•á±Õ‘•€˜˜€…˜¹Á…ÉÍ•€˜˜€…˜¹Á…ÉÍ•}•ÉÉ½È€˜˜˜¹­¥¹€„ôô€‰Õ¹­¹½Ý¸ˆì(€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ñÑÈ±…ÍÌôˆ‘í˜¹Á…ÉÍ•}•ÉÉ½È€˜˜€…ÍÑ…Ñ•µ•¹Ñ9••‘Í	½I•Ù¥•Ü¡˜¤€ü€‰‰…ˆ€è€ˆ‰ôˆø(€€€€€€€€€€€€€€€€€€ñÑø‘í…¹EÕ•Õ”€ü€ñ¥¹ÁÕÐÑåÁ”ô‰¡•­‰½àˆ‘…Ñ„µÁ¥¬ôˆ‘í ¡˜¹¥¥ôˆ€‘í±½Õ‘MÑ…Ñ”¹Á¥­•‘m˜¹¥‘t€ü€‰¡•­•ˆ€è€ˆ‰ô€¼ù€€è€ˆ‰ôð½Ñø(€€€€€€€€€€€€€€€€€€ñÑøñ‰ÕÑÑ½¸±…ÍÌô‰™¥±”µ¹…µ”µ±¥¹¬ˆ‘…Ñ„µÍÑ½É…”µ½Á•¸ôˆ‘í ¡˜¹ÍÑ½É…•}Á…Ñ ¥ôˆ‘…Ñ„µ™¥±”µ¥ôˆ‘í ¡˜¹¥¥ôˆ‘…Ñ„µ™¥±”µ¹…µ”ôˆ‘í ¡˜¹™¥±•}¹…µ”¥ôˆ‘…Ñ„µ™¥±”µµ¥µ”ôˆ‘í ¡˜¹µ¥µ•}ÑåÁ”ñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µÍ¥é”ôˆ‘í ¡˜¹Í¥é•}‰åÑ•Ìñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µ­¥¹ôˆ‘í ¡˜¹­¥¹ñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µ½µÁ…¹äôˆ‘í ¡˜¹½µÁ…¹äñðˆ¹½µÁ…¹äñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µ‘…Ñ”ôˆ‘í ¡ˆ¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”ñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µÍÑ…ÑÕÌôˆ‘í˜¹Á…ÉÍ•}•ÉÉ½È€ü€‰•ÉÉ½Èˆ€è˜¹Á…ÉÍ•€ü€‰Á…ÉÍ•ˆ€è€‰Ý…¥Ñ¥¹œ‰ôˆ€‘í˜¹ÍÑ½É…•}Á…Ñ €ü€ˆˆ€è€‰‘¥Í…‰±•‰ôøñÍÁ…¸ø‘í ¡˜¹™¥±•}¹…µ”¥ôð½ÍÁ…¸øñÍµ…±°û‚â‚âS‚âS‚âç‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚âƒŠ\‘í˜¹¡•­ÍÕ´€ü€ƒ
Ü¡•­ÍÕ´€‘í ¡MÑÉ¥¹œ¡˜¹¡•­ÍÕ´¤¹Í±¥” À°€ÄÀ¤¥÷Š™€€è€ˆ‰ôð½Íµ…±°øð½‰ÕÑÑ½¸ø‘í˜¹™É½µ}é¥À€ü€ñÍµ…±°±…ÍÌô‰ÍÕˆˆû‚â#‚âË‚â€‘í ¡˜¹™É½µ}é¥À¥ôð½Íµ…±°ù€€è€ˆ‰ôð½Ñø(€€€€€€€€€€€€€€€€€€ñÑø‘í ¡-%9}1	1m˜¹­¥¹‘tñð˜¹­¥¹ñð€ˆ´ˆ¥ô‘í˜¹É•™•É•¹•}‘…Ñ”ý€ñÍµ…±°±…ÍÌô‰ÍÕˆˆû‚âŸ‚âÇ‚âg‚â·‚æ'‚âË‚â‚â·‚âÓ‚â€‘í ¡˜¹É•™•É•¹•}‘…Ñ”¥ôð½Íµ…±°ù€èœô‘í˜¹•á±Õ‘•üœñÍµ…±°±…ÍÌô‰ÍÕˆˆû‚â‹‚â‚æ‚âŸ‚æ'‚âg‚â#‚âË‚â‚â‚âË‚â‚â‚âÇ‚âdƒ
Üƒ‚æ‚â‚æ‚âk‚âW‚æ'‚âg‚â'‚âk‚âÇ‚âhð½Íµ…±°øœèœôð½Ñø(€€€€€€€€€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í˜¹Í¥é•}‰åÑ•Ì€ü5…Ñ ¹É½Õ¹¡˜¹Í¥é•}‰åÑ•Ì€¼€ÄÀÈÐ¤¹Ñ½1½…±•MÑÉ¥¹œ ¤€¬€ˆ-ˆ€è€ˆ´‰ôð½Ñø(€€€€€€€€€€€€€€€€€€ñÑø‘ì(€€€€€€€€€€€€€€€€€€€˜¹•á±Õ‘•€ü€œñÍÁ…¸±…ÍÌô‰™¥±”µÍÑ…Ñ”Ý…¥ÐˆøñÍÁ…¸øñˆû‚â‹‚â‚æ‚âŸ‚æ'‚âg‚â#‚âË‚â‚â‚âË‚â‚â‚âÇ‚âdð½ˆøñÍµ…±°û‚æ‚â‡‚æ#‚â—‚âk‚æ‚â‚â—‚æ3‚æ‚â—‚âÃ‚æ‚â‡‚æ#‚æ‚âo‚â—‚â×‚æ#‚â‹‚âg‚æ‚â‚â¨ð½Íµ…±°øð½ÍÁ…¸øð½ÍÁ…¸øœ€è˜¹Á…ÉÍ•}•ÉÉ½È(€€€€€€€€€€€€€€€€€€€€€€ü€ñÍÁ…¸±…ÍÌô‰™¥±”µÍÑ…Ñ”Ý…¥ÐˆÑ¥Ñ±”ôˆ‘í ¡˜¹Á…ÉÍ•}•ÉÉ½È¥ôˆøñ¤ø„ð½¤øñÍÁ…¸øñˆø‘í ¡ÍÑ…Ñ•µ•¹ÑI•Ù¥•Ý1…‰•°¡˜¤¥ôð½ˆøñÍµ…±°û‚â‚âS‚âW‚â‚âŸ‚â#‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âPƒŠPƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âs‚â—‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âPð½Íµ…±°øð½ÍÁ…¸øð½ÍÁ…¸ù€(€€€€€€€€€€€€€€€€€€€€€€è˜¹­¥¹€ôôô€‰Õ¹­¹½Ý¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€ü€ñÍÁ…¸±…ÍÌô‰™¥±”µÍÑ…Ñ”‰…ˆøñ¤ø„ð½¤øñÍÁ…¸øñˆû‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â_‚â‚âË‚âk‚âo‚â‚âÃ‚æ‚âƒ‚â\ð½ˆøñÍµ…±°û‚âW‚æ'‚â·‚â‚æ‚âo‚âÓ‚âPAÉ•Ù¥•Üƒ‚æ‚â—‚âÃ‚æ‚â—‚âß‚â·‚â‚âo‚â‚âÃ‚æ‚âƒ‚â\ð½Íµ…±°øð½ÍÁ…¸øð½ÍÁ…¸ù€(€€€€€€€€€€€€€€€€€€€€€€è˜¹­¥¹€ôôô€‰‘½}±…É¥™äˆ(€€€€€€€€€€€€€€€€€€€€€€€€ü€ñÍÁ…¸±…ÍÌô‰™¥±”µÍÑ…Ñ”½¬ˆøñ¤ûŠrLð½¤øñÍÁ…¸øñˆû‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚â{‚â‚æ'‚â·‚â‡‚âW‚â‚âŸ‚â ð½ˆøñÍµ…±°û‚æ‚â‡‚æ#‚âW‚æ'‚â·‚â‚â«‚æ#‚â‚æ‚â‚æ'‚âË‚æ‚â‚â‚âß‚æ#‚â·‚â‚â·‚æ#‚âË‚âg‚â‚âË‚â‹‚â‚âË‚âŒð½Íµ…±°øð½ÍÁ…¸øð½ÍÁ…¸ù€(€€€€€€€€€€€€€€€€€€€€€€è˜¹Á…ÉÍ•(€€€€€€€€€€€€€€€€€€€€€€€€ü€ñÍÁ…¸±…ÍÌô‰™¥±”µÍÑ…Ñ”½¬ˆøñ¤ûŠrLð½¤øñÍÁ…¸øñˆø‘í ¡Á…ÉÍ•‘¥±•1…‰•°¡˜¤¥ôð½ˆøñÍµ…±°ø‘í¥ÍµÁÑåAµ¥±”¡˜¤€ü€‰AÉ½Ù¥‘•Èƒ‚â«‚æ#‚â‚æ‚â‚â—‚æ3‚âŸ‚æ#‚âË‚âƒŠPƒ‚æ‚â‡‚æ#‚â‡‚â×‚â‚âË‚â‹‚â‚âË‚â‚æ‚âg‚â‚â·‚âk‚âg‚â×‚æ$ˆ€è˜¹É½Ý}½Õ¹Ð€üƒ‚â‚âÃ‚âk‚âk‚â·‚æ#‚âË‚âd€‘í¹Õ´¡˜¹É½Ý}½Õ¹Ð¥ôƒ‚æ‚â[‚â€€è€‹‚â‚âÃ‚âk‚âk‚â·‚æ#‚âË‚âg‚â«‚âÏ‚æ‚â‚æ‚â ‰ôð½Íµ…±°øð½ÍÁ…¸øð½ÍÁ…¸ù€(€€€€€€€€€€€€€€€€€€€€€€€€è€ñÍÁ…¸±…ÍÌô‰™¥±”µÍÑ…Ñ”Ý…¥Ðˆøñ¤ûŠˆð½¤øñÍÁ…¸øñˆû‚â‚â·‚âW‚â‚âŸ‚â#‚æ‚â‚â—‚æ0ð½ˆøñÍµ…±°û‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â·‚æ#‚âË‚âg‚æ‚â‚æ'‚âË‚â‚âÃ‚âk‚âhð½Íµ…±°øð½ÍÁ…¸øð½ÍÁ…¸ù€(€€€€€€€€€€€€€€€€€ôð½Ñø(€€€€€€€€€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡Ðˆøñ‘¥Ø±…ÍÌô‰™¥±”µ…Ñ¥½¹Ìˆø‘í˜¹‘É¥Ù•}ÕÉ°€ü€ñ„±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸áÌˆ¡É•˜ôˆ‘í ¡˜¹‘É¥Ù•}ÕÉ°¥ôˆÑ…É•Ðô‰}‰±…¹¬ˆÉ•°ô‰¹½½Á•¹•ÈˆùÉ¥Ù”ð½„ù€€è€ˆ‰ôñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸áÌˆ‘…Ñ„µÍÑ½É…”µ½Á•¸ôˆ‘í ¡˜¹ÍÑ½É…•}Á…Ñ ¥ôˆ‘…Ñ„µ™¥±”µ¥ôˆ‘í ¡˜¹¥¥ôˆ‘…Ñ„µ™¥±”µ¹…µ”ôˆ‘í ¡˜¹™¥±•}¹…µ”¥ôˆ‘…Ñ„µ™¥±”µµ¥µ”ôˆ‘í ¡˜¹µ¥µ•}ÑåÁ”ñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µÍ¥é”ôˆ‘í ¡˜¹Í¥é•}‰åÑ•Ìñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µ­¥¹ôˆ‘í ¡˜¹­¥¹ñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µ½µÁ…¹äôˆ‘í ¡˜¹½µÁ…¹äñðˆ¹½µÁ…¹äñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µ‘…Ñ”ôˆ‘í ¡ˆ¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”ñð€ˆˆ¥ôˆ‘…Ñ„µ™¥±”µÍÑ…ÑÕÌôˆ‘í˜¹Á…ÉÍ•}•ÉÉ½È€ü€‰•ÉÉ½Èˆ€è˜¹Á…ÉÍ•€ü€‰Á…ÉÍ•ˆ€è€‰Ý…¥Ñ¥¹œ‰ôˆû‚âS‚âç‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚âð½‰ÕÑÑ½¸øð½‘¥Øøð½Ñø(€€€€€€€€€€€€€€€€ð½ÑÈù€ì(€€€€€€€€€€€€€€€ô¤(€€€€€€€€€€€€€€€€¹©½¥¸ ˆˆ¥ô(€€€€€€€€€€€€ð½Ñ‰½‘äø(€€€€€€€€€€ð½Ñ…‰±”ø(€€€€€€€€ð½‘¥Øø(€€€€€€ð½‘¥Øù€°(€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€¹©½¥¸ ˆˆ¤(€€€€€€€€€€è€ñÀ±…ÍÌô‰•µÁÑäµ‰½àˆø‘í±½Õ‘MÑ…Ñ”¹±½…‘¥¹œ€ü€‹‚â‚âÏ‚â—‚âÇ‚â‚æ‚â¯‚â—‚âP¸¸¸ˆ€è±½Õ‘MÑ…Ñ”¹™¥±•Y¥•Ü€ôôô€‰…±°ˆ€ü€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚æ‚â‡‚â—‚æ‚âg‚â+‚æ#‚âŸ‚â‚âŸ‚âÇ‚âg‚â_‚â×‚æ#‚âg‚â×‚æ$ƒŠPƒ‚â—‚â·‚â‚â‚â‹‚âË‚â‹‚â+‚æ#‚âŸ‚â‚âŸ‚âÇ‚âg‚â_‚â×‚æ#‚æ‚âg‚æ‚â[‚âk‚âW‚âÇ‚âŸ‚â‚â‚â·‚â‚âS‚æ'‚âË‚âg‚âk‚âdƒ‚â¯‚â‚âß‚â·‚âW‚â‚âŸ‚â#‚âŸ‚æ#‚âÈÝ½É­™±½Üƒ‚æ‚âd¸á¸ƒ‚â‚âÇ‚âg‚æ‚â—‚æ'‚âœˆ€è€‹‚æ‚â‡‚æ#‚â‡‚â×‚æ‚â‚â—‚æ3‚æ‚âg‚â«‚â[‚âË‚âg‚âÃ‚â_‚â×‚æ#‚æ‚â—‚âß‚â·‚â‰ôð½Àù€(€€€€€ô(€€€€ð½Í•Ñ¥½¸ø((€€€€‘ì(€€€€€™…±Í”€˜˜‘…¥±ä¹±•¹Ñ (€€€€€€€€ü€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆù½Ù•É…”ð½Àøñ Èû‚æ‚â‚â—‚æ3‚æ‚â‚æ'‚âË‚â‚â‚âk‚â‚âË‚â‹‚âŸ‚âÇ‚âdð½ Èøð½‘¥ØøñÍÁ…¸±…ÍÌô‰¡•…±Ñ ½¬ˆø‘í¹Õ´¡‘…¥±ä¹±•¹Ñ ¥ôƒ‚â‚âË‚â‹‚â‚âË‚âŒð½ÍÁ…¸øð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…Àˆø(€€€€€€€€ñÑ…‰±”ø(€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ û‚âŸ‚âÇ‚âg‚â_‚â×‚æ ð½Ñ øñÑ û‚âk‚â‚âÓ‚â§‚âÇ‚â\ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚æ‚â‡‚â”ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚æ‚â‚â—‚æ0ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚â·‚æ#‚âË‚âg‚æ‚â—‚æ'‚âœð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚â‡‚â×‚âo‚âÇ‚â7‚â¯‚âÈð½Ñ øñÑ û‚æ‚â‡‚â—‚â—‚æ#‚âË‚â«‚âã‚âPð½Ñ øð½ÑÈøð½Ñ¡•…ø(€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€€‘í‘…¥±ä(€€€€€€€€€€€€€€¹µ…À (€€€€€€€€€€€€€€€€¡¤€ôø€ñÑÈø(€€€€€€€€€€€€€€ñÑøñˆø‘í ¡¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”ñð€ˆ´ˆ¥ôð½ˆøð½Ñø(€€€€€€€€€€€€€€ñÑø‘í ¡¹½µÁ…¹äñð€ˆ´ˆ¥ôð½Ñø(€€€€€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í¹Õ´¡¹µ…¥±}½Õ¹Ð¥ôð½Ñø(€€€€€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í¹Õ´¡¹™¥±•}½Õ¹Ð¥ôð½Ñø(€€€€€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í¹Õ´¡¹Á…ÉÍ•‘}½Õ¹Ð¥ôð½Ñø(€€€€€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´€‘í¹•ÉÉ½É}½Õ¹Ð€ü€‰‘…¹•Èˆ€è€ˆ‰ôˆø‘í¹Õ´¡¹•ÉÉ½É}½Õ¹Ð¥ôð½Ñø(€€€€€€€€€€€€€€ñÑ±…ÍÌô‰µÕÑ•ˆø‘í ¡‘¥ÍÁ±…åQ¥µ”¡¹±…ÍÑ}µ…¥±}…Ð¤¥ôð½Ñø(€€€€€€€€€€€€ð½ÑÈù€°(€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€¹©½¥¸ ˆˆ¥ô(€€€€€€€€€€ð½Ñ‰½‘äø(€€€€€€€€ð½Ñ…‰±”ø(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ù€(€€€€€€€€è€ˆˆ(€€€õ€ì((€¥˜¡±½Õ‘MÑ…Ñ”¹…Í•ÑÑ…¡µ•¹ÑÌ€„ôô¹Õ±°¤…Í•Ù¥‘•¹•1¥‰É…Éä¹µ½Õ¹Ð  œ…Í•Ù¥‘•¹•1¥‰É…Éäœ¤°…Í•Ù¥‘•¹•1¥‰É…Éä¹•¹ÑÉ¥•Ì¡±½Õ‘MÑ…Ñ”¹‰…Ñ¡•Ì°±½Õ‘MÑ…Ñ”¹…Í•ÑÑ…¡µ•¹ÑÌ¤°½Á•¹MÑ½É•‘¥±•AÉ•Ù¥•Ü¤ì(€€¼¼ÁÁ•¹„‘¥ÍÑ¥¹Ðµ•Ñ…‘…Ñ„…Ñ¥½¸ì¹•Ù•ÈÉ•ÕÍ”ÁÉ•Ù¥•Ü½¥µÁ½ÉÐ‰ÕÑÑ½¹Ì¸(€¥˜¡¥±•á±ÕÍ¥½¸¹…¹5…¹…”¡ÍÑ…Ñ”¹É½±”¤¤É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ÑÈœ¤¹™½É… ¡É½Üôùì(€€€½¹ÍÐÁÉ•Ù¥•ÜõÉ½Ü¹ÅÕ•ÉåM•±•Ñ½È m‘…Ñ„µ™¥±”µ¥‘tœ¤í¥˜ …ÁÉ•Ù¥•Ü¥É•ÑÕÉ¸ì(€€€½¹ÍÐ™¥±”õ…±±¥±•Ì¹™¥¹¡˜ôù˜¹¥ôôõÁÉ•Ù¥•Ü¹‘…Ñ…Í•Ð¹™¥±•%¤í¥˜ …™¥±”¥É•ÑÕÉ¸ì(€€€½¹ÍÐ‰ÕÑÑ½¸õ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰ÕÑÑ½¸œ¤í‰ÕÑÑ½¸¹±…ÍÍ9…µ”ô¡½ÍÐµ‰ÕÑÑ½¸áÌœí‰ÕÑÑ½¸¹ÑåÁ”ô‰ÕÑÑ½¸œì(€€€‰ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ðõ™¥±”¹•á±Õ‘•üŸ‚â‚âß‚âg‚æ‚â‚â—‚æ3‚æ‚â¯‚æ'‚æ‚â—‚âß‚â·‚â‚æ‚â+‚æ$œèŸ‚â‹‚â‚æ‚âŸ‚æ'‚âg‚æ‚â‚â—‚æ3‚â#‚âË‚â‚â‚âË‚â‚â‚âÇ‚âdœì(€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹•á±Õ‘•¥±”õ™¥±”¹¥í‰ÕÑÑ½¸¹½¹±¥¬õ…Íå¹Œ ¤ôùí¥˜¡…Ý…¥Ð½Á•¹¥±•á±ÕÍ¥½¸¡™¥±”¹¥¤¥±½Õ‘1½…¡ÑÉÕ”¤íôì(€€€É½Ü¹ÅÕ•ÉåM•±•Ñ½È œ¹™¥±”µ…Ñ¥½¹Ìœ¤ü¹…ÁÁ•¹‘¡¥±¡‰ÕÑÑ½¸¤ì(€ô¤ì(€€ ˆI•±½…ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø±½Õ‘1½…¡ÑÉÕ”¤¤ì(€€ ˆÙ¥‘•¹•I•½µµ•¹‘…Ñ¥½¹Ìˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøÙ¥‘•¹•I•½µµ•¹‘…Ñ¥½¹Ì¹‰É½ÝÍ”¡Mˆ°ÍÑ…Ñ”¹‘…Ñ”ñðU1Q}]=I-}Q°½Á•¹MÑ½É•‘¥±•AÉ•Ù¥•Ü¤¤ì(€€ ˆA¥­9•Üˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€±½Õ‘MÑ…Ñ”¹Á¥­•€ôíôì(€€€ÅÕ•Õ•…‰±•¥±•Ì¹™½É…  ¡˜¤€ôø€¡±½Õ‘MÑ…Ñ”¹Á¥­•‘m˜¹¥‘t€ôÑÉÕ”¤¤ì(€€€É•¹‘•È ¤ì(€ô¤ì(€€ ˆ%µÁ½ÉÐˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø±½Õ‘%µÁ½ÉÐ¡Á¥­•‘¥±•Ì¤¤ì(€€ ˆI•Ù¥•Ý%ÍÍÕ•Ìˆ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€½¹ÍÐ™¥ÉÍÐ€ôÁÉ½‰±•µ¥±•ÍlÁtì(€€€½¹ÍÐ‰ÕÑÑ½¸€ôÉÉ…ä¹™É½´¡É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µÍÑ½É…”µ½Á•¹um‘…Ñ„µ™¥±”µ¥‘tˆ¤¤¹™¥¹ ¡¥Ñ•´¤€ôø¥Ñ•´¹‘…Ñ…Í•Ð¹™¥±•%€ôôô™¥ÉÍÐü¹¥¤ì(€€€¥˜€ …‰ÕÑÑ½¸¤É•ÑÕÉ¸Ñ½…ÍÐ ‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â{‚âk‚æ‚â‚â—‚æ3‚âo‚âÇ‚â7‚â¯‚âË‚æ‚âg‚â‚âË‚â‹‚â‚âË‚â‚âo‚âÇ‚â#‚â#‚âã‚âk‚âÇ‚âdˆ°€‰Ý…É¸ˆ¤ì(€€€‰ÕÑÑ½¸¹ÍÉ½±±%¹Ñ½Y¥•Ü¡ì‰•¡…Ù¥½Èè€‰Íµ½½Ñ ˆ°‰±½¬è€‰•¹Ñ•Èˆô¤ì(€€€‰ÕÑÑ½¸¹±¥¬ ¤ì(€ô¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µ…Ñ¥½¸µÉ½ÕÑ•tˆ¤¹™½É…  ¡¥Ñ•´¤€ôø¥Ñ•´¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø¼¡¥Ñ•´¹‘…Ñ…Í•Ð¹…Ñ¥½¹I½ÕÑ”¤¤¤ì(€Õ‘¥ÑU¤¹Ñ…‰Ì¡É½½Ð¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µ±½ÕµÙ¥•Ýtˆ¤¹™½É…  ¡¥Ñ•´¤€ôø¥Ñ•´¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€±½Õ‘MÑ…Ñ”¹™¥±•Y¥•Ü€ô¥Ñ•´¹‘…Ñ…Í•Ð¹±½Õ‘Y¥•Üì(€€€É•¹‘•È ¤ì(€€€É•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ”  ¤€ôø‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å%¡±½Õ‘MÑ…Ñ”¹™¥±•Y¥•Ü€ôôô€‰ÁÉ½‰±•´ˆ€ü€‰ÁÉ½‰±•µ¥±•MÕµµ…Éäˆ€è€‰±½Õ‘%¹‰½àˆ¤ü¹ÍÉ½±±%¹Ñ½Y¥•Ü¡ì‰•¡…Ù¥½Èè€‰Íµ½½Ñ ˆ°‰±½¬è€‰ÍÑ…ÉÐˆô¤¤ì(€ô¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µ±½Õµ™¥±”µÙ¥•Ýtˆ¤¹™½É…  ¡¥Ñ•´¤€ôø¥Ñ•´¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€±½Õ‘MÑ…Ñ”¹™¥±•Y¥•Ü€ô¥Ñ•´¹‘…Ñ…Í•Ð¹±½Õ‘¥±•Y¥•Üì(€€€É•¹‘•È ¤ì(€€€É•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ”  ¤€ôø‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰±½Õ‘%¹‰½àˆ¤ü¹ÍÉ½±±%¹Ñ½Y¥•Ü¡ì‰•¡…Ù¥½Èè€‰Íµ½½Ñ ˆ°‰±½¬è€‰ÍÑ…ÉÐˆô¤¤ì(€ô¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µÍÉ½±°µ±½Õ‘tˆ¤¹™½É…  ¡¥Ñ•´¤€ôø¥Ñ•´¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å%¡¥Ñ•´¹‘…Ñ…Í•Ð¹ÍÉ½±±±½Õ¤ü¹ÍÉ½±±%¹Ñ½Y¥•Ü¡ì‰•¡…Ù¥½Èè€‰Íµ½½Ñ ˆ°‰±½¬è€‰ÍÑ…ÉÐˆô¤¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µÍÕµµ…Éäµ½µÁ…¹åtˆ¤¹™½É…  ¡É½Ü¤€ôøì(€€€½¹ÍÐ½Á•¸€ô€ ¤€ôøìÍÑ…Ñ”¹‘…¥±åMÕµµ…Éä¹‘…Ñ”€ôÉ½Ü¹‘…Ñ…Í•Ð¹ÍÕµµ…Éå…Ñ”ìÍÑ…Ñ”¹‘…¥±åMÕµµ…Éä¹½µÁ…¹ä€ôÉ½Ü¹‘…Ñ…Í•Ð¹ÍÕµµ…Éå½µÁ…¹äì¼ ‰‘…¥±äµÍÕµµ…Éäˆ¤ìôì(€€€É½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°½Á•¸¤ì(€€€É½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰­•å‘½Ý¸ˆ°€¡•Ù•¹Ð¤€ôøì¥˜€¡•Ù•¹Ð¹­•ä€ôôô€‰¹Ñ•Èˆñð•Ù•¹Ð¹­•ä€ôôô€ˆ€ˆ¤ì•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì½Á•¸ ¤ìôô¤ì(€ô¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µÁ¥­tˆ¤¹™½É…  ¡ˆ¤€ôø(€€€ˆ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¡…¹”ˆ°€ ¤€ôøì(€€€€€±½Õ‘MÑ…Ñ”¹Á¥­•‘mˆ¹‘…Ñ…Í•Ð¹Á¥­t€ôˆ¹¡•­•ì(€€€€€É•¹‘•È ¤ì(€€€ô¤°(€€¤ì(€‰¥¹‘MÑ½É•‘¥±•1¥¹­Ì¡É½½Ð¤ì)ôì()½¹ÍÐ-%9}1	0€ôì(€‰½}µ…¥¸è€‹‚â‚âË‚â‹‚â‚âË‚âg‚âk‚âÇ‚â7‚â+‚â×‚âw‚âË‚â·‚â[‚â·‚âdˆ°(€Áµ}ÍÑ…Ñ•µ•¹Ðè€‹‚â‚âË‚â‹‚â‚âË‚â‚æ‚âS‚âÓ‚âg‚âk‚âÇ‚â7‚â+‚âÔA4ˆ°(€µ…¹Õ…±}É•‘¥Ðè€‹‚âw‚âË‚â‚â‡‚âß‚â´€´ƒ‚æ‚â‚â‚âS‚âÓ‚âTˆ°(€µ…¹Õ…±}Á…åµ•¹Ðè€‹‚âw‚âË‚â‚â‡‚âß‚â´€´A…åµ•¹Ðˆ°(€µ…¹Õ…±}‰½¹ÕÌè€‹‚âw‚âË‚â‚â‡‚âß‚â´€´ƒ‚æ‚âk‚âg‚âÇ‚â¨ˆ°(€½µµ}É•Äè€‹‚â‚â·‚â[‚â·‚âg‚â‚æ#‚âË‚â‚â·‚â‡‚â‡‚âÓ‚â+‚â+‚âÇ‚æ#‚âdˆ°(€É•‘¥Ñ}½ÕÐè€‹‚â‚âË‚â‹‚â‚âË‚âg‚â[‚â·‚âg‚æ‚â‚â‚âS‚âÓ‚âTˆ°(€ÍÑµ}Á‘˜è€‰MÑ…Ñ•µ•¹Ðƒ‚âc‚âg‚âË‚â‚âË‚âŒ€¡A¤ˆ°(€‘½}±…É¥™äè€‹‚æ‚â·‚â‚â«‚âË‚â‚â+‚â×‚æ'‚æ‚â#‚âˆ°(€Õ¹­¹½Ý¸è€‹‚â‹‚âÇ‚â‚â‚âÃ‚âk‚âã‚æ‚â‡‚æ#‚æ‚âS‚æ$ˆ°)ôì((¼¨ƒ‚â«‚â[‚âË‚âg‚âÃ‚â‚â·‚â‚â¯‚âg‚æ'‚âË‚â‚âÇ‚âk‚æ‚â‚â—‚æ3‚â#‚â‚âÓ‚â‚æ‚â—‚âÀÁÉ½É•ÍÌ½Ù•É±…ä(€€ƒ‚âW‚æ'‚â·‚â‚âo‚â‚âÃ‚â‚âË‚â£‚â‚æ#‚â·‚âdÍÑ…ÉÑI•…±Q•ÍÐ ¤½Y%]L¹¥µÁ½ÉÐƒ‚â/‚âÛ‚æ#‚â‚æ‚â‚â×‚â‹‚â‚æ‚â+‚æ'‚â‚æ#‚âË‚â+‚âã‚âS‚âg‚â×‚æ$€¨¼)½¹ÍÐ%µÁ½ÉÑMÑ…Ñ”€ôì(€™¥±•Ìèmt°(€±…ÍÑIÕ¸è¹Õ±°°(€¥¹‰½àè¹Õ±°°(€ÉÕ¹¹¥¹œè™…±Í”°)ôì()™Õ¹Ñ¥½¸Í¡½ÝAÉ½É•ÍÌ¡Ñ¥Ñ±”¤ì(€€ ˆÁÉ½Q¥Ñ±”ˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ôÑ¥Ñ±”ì(€€ ˆÁÉ½1…‰•°ˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô€‹‚æ‚âW‚â‚â×‚â‹‚â‡‚â‚æ'‚â·‚â‡‚âç‚â”¸¸¸ˆì(€€ ˆÁÉ½¥±°ˆ¤¹ÍÑå±”¹Ý¥‘Ñ €ô€ˆÀ”ˆì(€€ ˆÁÉ½AÐˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô€ˆÀ”ˆì(€€ ˆÁÉ½É•ÍÍ=Ù•É±…äˆ¤¹¡¥‘‘•¸€ô™…±Í”ì)ô()™Õ¹Ñ¥½¸Í•ÑAÉ½É•ÍÌ¡ÁÐ°±…‰•°¤ì(€½¹ÍÐÀ€ô5…Ñ ¹É½Õ¹¡5…Ñ ¹µ¥¸ Ä°5…Ñ ¹µ…à À°ÁÐ¤¤€¨€ÄÀÀ¤ì(€€ ˆÁÉ½¥±°ˆ¤¹ÍÑå±”¹Ý¥‘Ñ €ôÀ€¬€ˆ”ˆì(€€ ˆÁÉ½AÐˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ôÀ€¬€ˆ”ˆì(€¥˜€¡±…‰•°¤€ ˆÁÉ½1…‰•°ˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô±…‰•°ì)ô()™Õ¹Ñ¥½¸¡¥‘•AÉ½É•ÍÌ ¤ì(€€ ˆÁÉ½É•ÍÍ=Ù•É±…äˆ¤¹¡¥‘‘•¸€ôÑÉÕ”ì)ô()™Õ¹Ñ¥½¸‰Õ¥±‘%¹‰½à ¤ì(€½¹ÍÐÍ•Ð€ôM…µÁ±”¹‰Õ¥±‘¥±•M•Ð¡ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹‘…Ñ”°€ÈÐÀÀ¤ì(€½¹ÍÐ•áÁ•Ñ•€ôì€¸¸¹Í•Ð¹Í•¹…É¥¼¹•áÁ•Ñ•ôì(€=‰©•Ð¹­•åÌ¡Í•Ð¹ÁµM•¹…É¥¼¹•áÁ•Ñ•¤¹™½É…  ¡­•ä¤€ôø€¡•áÁ•Ñ•‘m­•åt€¬ôÍ•Ð¹ÁµM•¹…É¥¼¹•áÁ•Ñ•‘m­•åt¤¤ì(€%µÁ½ÉÑMÑ…Ñ”¹¥¹‰½à€ôì(€€€‘…Ñ”èÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹‘…Ñ”°(€€€Í•¹…É¥¼èÍ•Ð¹Í•¹…É¥¼°(€€€ÁµM•¹…É¥¼èÍ•Ð¹ÁµM•¹…É¥¼°(€€€•áÁ•Ñ•°(€€€µ•ÍÍ…•ÌèÍ•Ð¹™¥±•Ì¹µ…À ¡™¥±”°¥¹‘•à¤€ôø€¡ì(€€€€€¥è€‰4ˆ€¬€¡¥¹‘•à€¬€Ä¤°(€€€€€™É½´è(€€€€€€€l(€€€€€€€€€€‰½ÁÍ}Í‰‰…¹¬µÉ•Á½ÉÐˆ°(€€€€€€€€€€‰½ÁÍ}­‰…¹­‰…¹¬µÉ•Á½ÉÐˆ°(€€€€€€€€€€‰½ÁÍ}Í‰‰…¹¬µÉ•Á½ÉÐˆ°(€€€€€€€€€€‰½ÁÍ}‰‰±‰…¹¬µÉ•Á½ÉÐˆ°(€€€€€€€€€€‰‰…­½™™¥•ÍåÌÄÈÌˆ°(€€€€€€€€€€‰‰…­½™™¥•ÍåÌÄÈÌˆ°(€€€€€€€€€€‰É•Á½ÉÑ…ÕÑ½Á••Èˆ°(€€€€€€€€€€‰É•Á½ÉÑ…éÁ…äˆ°(€€€€€€€€€€‰É•Á½ÉÑå‰•ÉÁ±ÕÌˆ°(€€€€€€€€€€‰‰…­½™™¥•ÍåÌÄÈÌˆ°(€€€€€€€um¥¹‘•átñð€‰‰…­½™™¥•ÍåÌÄÈÌˆ°(€€€€€ÍÕ‰©•Ðè€‘í™¥±”¹­¥¹‘ôƒ‚âo‚â‚âÃ‚â#‚âÏ‚âŸ‚âÇ‚âg‚â_‚â×‚æ €‘íÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹‘…Ñ•õ€°(€€€€€™¥±”°(€€€€€ÁÕ±±•è™…±Í”°(€€€ô¤¤°(€ôì(€É•ÑÕÉ¸%µÁ½ÉÑMÑ…Ñ”¹¥¹‰½àì)ô(((¼¨ƒ‚âk‚âÇ‚â7‚â+‚â×‚â_‚â×‚æ#‚â‡‚âÔÍÑ…Ñ•µ•¹Ðƒ‚æ‚â‚æ'‚âË‚â‡‚âÈƒ‚â[‚âß‚â·‚æ‚âo‚æ‚âg‚âk‚âÇ‚â7‚â+‚â×‚â‚â·‚â‚âk‚â‚âÓ‚â§‚âÇ‚â_‚æ‚âS‚â‹‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÐ(€€ƒ‚æ‚â‡‚æ#‚â‚âÇ‚æ'‚âg‚â‚â8€‹‚â—‚âç‚â‚â‚æ'‚âË‚âw‚âË‚â‚âs‚âÓ‚âS‚âk‚âÇ‚â7‚â+‚âÔˆƒ‚â#‚âÃ‚â‚æ'‚â·‚â‚â_‚âã‚â‚æ‚â[‚âŸ‚æ‚â{‚â‚âË‚âÃ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚æ‚âg‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚âk‚âÇ‚â7‚â+‚âÔ€¨¼)™Õ¹Ñ¥½¸É•¥ÍÑ•É½Õ¹ÑÉ½µMÑ…Ñ•µ•¹Ð¡¹½É´¤ì(€½¹ÍÐ €ô¹½É´¹¡•…‘•Èñðíôì(€¥˜€ … ¹…½Õ¹Ð¤É•ÑÕÉ¸ì(€¥˜€¡¹…½Õ¹ÑÌ¹Í½µ” ¡„¤€ôø„¹¥€ôôô ¹…½Õ¹Ð¤¤É•ÑÕÉ¸ì(€¹…½Õ¹ÑÌ¹ÁÕÍ ¡ì(€€€¥è ¹…½Õ¹Ð°(€€€‰…¹¬è ¹‰…¹¬ñð€ˆ´ˆ°(€€€½µÁ…¹äè¹½É´¹™½Éµ…Ð¹½µÁ…¹äñð€ˆ´ˆ°(€€€ÑåÁ”è€‰‘•Á½Í¥Ðˆ°(€€€…Ñ¥Ù”èÑÉÕ”°(€€€¡½±‘•Èè ¹¡½±‘•Èñð€ˆˆ°(€€€…ÕÑ½‘‘•èÑÉÕ”°(€ô¤ì(€±½Ñ¥½¸ ‰…½Õ¹Ñ}…‘ˆ°€‰…½Õ¹Ðˆ° ¹…½Õ¹Ð°ƒ‚æ‚â{‚âÓ‚æ#‚â‡‚âk‚âÇ‚â7‚â+‚â×‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÓ‚â#‚âË‚âÍÑ…Ñ•µ•¹Ð€‘í ¹‰…¹¬ñð€ˆ‰ô€‘í ¹¡½±‘•Èñð€ˆ‰õ€¹ÑÉ¥´ ¤¤ì)ô((¼¨ƒ‚æ‚â¯‚â—‚âS‚âk‚âÇ‚â7‚â+‚â×‚â#‚â‚âÓ‚â‚â#‚âË‚â‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âd€¡É•¥ÍÑÉä¹©Ì¤ƒ‚â‡‚âË‚æ‚âo‚æ‚âdµ…ÍÑ•È…½Õ¹ÑÌƒ‚â‚â·‚â‚â‚âÃ‚âk‚âh€¨¼)™Õ¹Ñ¥½¸±½…‘I•¥ÍÑÉå½Õ¹ÑÌ ¤ì(€¥˜€¡ÑåÁ•½˜I•¥ÍÑÉä€ôôô€‰Õ¹‘•™¥¹•ˆñð€…I•¥ÍÑÉä¹=U9QL¤É•ÑÕÉ¸¹Õ±°ì(€½¹ÍÐ‰…¹­Ì€ôI•¥ÍÑÉä¹=U9QL¹™¥±Ñ•È ¡„¤€ôø„¹Í½ÕÉ”€ôôô€‰‰…¹¬ˆ€˜˜„¹…½Õ¹Ð¤ì(€¥˜€ …‰…¹­Ì¹±•¹Ñ ¤É•ÑÕÉ¸¹Õ±°ì(€É•ÑÕÉ¸‰…¹­Ì¹µ…À ¡„¤€ôø€¡ì¥è„¹…½Õ¹Ð°‰…¹¬è„¹‰…¹¬°½µÁ…¹äè„¹ÍÕ‰¼ñð„¹ÁÉ½Ù¥‘•Èñð€ˆ´ˆ°ÑåÁ”è„¹ÑåÁ”ñð€‰‰½Ñ ˆ°…Ñ¥Ù”èÑÉÕ”°¡½±‘•Èè„¹¹…µ”ñð€ˆˆ°™É½µI•¥ÍÑÉäèÑÉÕ”ô¤¤ì)ô((¼¨ƒ‚â—‚æ'‚âË‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚â¿‚æ‚â‚æ#‚âË‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âPƒ‚æ‚â—‚æ'‚âŸ‚æ‚â‚âÓ‚æ#‚â‡‚â«‚â[‚âË‚âg‚âÃ‚â«‚âÃ‚â·‚âË‚âS‚â«‚âÏ‚â¯‚â‚âÇ‚âk‚æ‚â_‚â«‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚â‚âÓ‚â€¨¼)™Õ¹Ñ¥½¸ÍÑ…ÉÑI•…±Q•ÍÐ ¤ì(€MÑ½É”¹É•Í•Ð ¤ì(€%µÁ½ÉÑMÑ…Ñ”¹™¥±•Ì€ômtì(€%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸€ô¹Õ±°ì(€%µÁ½ÉÑMÑ…Ñ”¹¥¹‰½à€ô¹Õ±°ì(€¹•á•ÁÑ¥½¹Ì€ômtì(€¹‘…µ…•Ì€ômtì(€¹™¥±•Ì€ômtì(€¹ÕÉÉ•¹ÑIÕ¸€ô¹Õ±°ì(€¥˜€¡ÉÉ…ä¹¥ÍÉÉ…ä¡¹¡½ÕÉ±ä¤¤¹¡½ÕÉ±ä¹™½É…  ¡à¤€ôøìà¹Ñ½Ñ…°€ô€Àìà¹µ…Ñ¡•€ô€Àìà¹•á•ÁÑ¥½¸€ô€Àìô¤ì(€½¹ÍÐÉ•…°€ô±½…‘I•¥ÍÑÉå½Õ¹ÑÌ ¤ì(€¥˜€¡É•…°¤¹…½Õ¹ÑÌ€ôÉ•…°ì(€ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ô€‰¥µÁ½ÉÑ•ˆì(€¥˜€¡ÑåÁ•½˜ÕÁ‘…Ñ•ÕÑ½MÑ…ÑÕÌ€ôôô€‰™Õ¹Ñ¥½¸ˆ¤ÕÁ‘…Ñ•ÕÑ½MÑ…ÑÕÌ ¤ì(€Ñ½…ÍÐ¡ƒ‚â—‚æ'‚âË‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚æ‚â‚æ#‚âË‚æ‚â—‚æ'‚âœƒŠPƒ‚æ‚â¯‚â—‚âS‚âk‚âÇ‚â7‚â+‚â×‚â#‚â‚âÓ‚â€‘íÉ•…°€üÉ•…°¹±•¹Ñ €è€Áôƒ‚âk‚âÇ‚â7‚â+‚â×‚â#‚âË‚â‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âdƒ
Üƒ‚â{‚â‚æ'‚â·‚â‡‚âg‚âÏ‚æ‚â‚æ'‚âË‚æ‚â‚â—‚æ3‚â#‚â‚âÓ‚â€¤ì(€¼ ‰¥µÁ½ÉÐˆ¤ì)ô()™Õ¹Ñ¥½¸É•…‘¥±•Q•áÐ¡™¥±”¤ì(€É•ÑÕÉ¸¹•ÜAÉ½µ¥Í” ¡É•Í½±Ù”°É•©•Ð¤€ôøì(€€€½¹ÍÐÈ€ô¹•Ü¥±•I•…‘•È ¤ì(€€€È¹½¹±½…€ô€ ¤€ôøÉ•Í½±Ù”¡È¹É•ÍÕ±Ð¤ì(€€€È¹½¹•ÉÉ½È€ô€ ¤€ôøÉ•©•Ð¡¹•ÜÉÉ½È ‹‚â·‚æ#‚âË‚âg‚æ‚â‚â—‚æ3‚æ‚â‡‚æ#‚æ‚âS‚æ$ˆ¤¤ì(€€€È¹É•…‘ÍQ•áÐ¡™¥±”°€‰ÕÑ˜´àˆ¤ì(€ô¤ì)ô)™Õ¹Ñ¥½¸É•…‘¥±•	Õ™™•È¡™¥±”¤ì(€É•ÑÕÉ¸¹•ÜAÉ½µ¥Í” ¡É•Í½±Ù”°É•©•Ð¤€ôøì(€€€½¹ÍÐÈ€ô¹•Ü¥±•I•…‘•È ¤ì(€€€È¹½¹±½…€ô€ ¤€ôøÉ•Í½±Ù”¡È¹É•ÍÕ±Ð¤ì(€€€È¹½¹•ÉÉ½È€ô€ ¤€ôøÉ•©•Ð¡¹•ÜÉÉ½È ‹‚â·‚æ#‚âË‚âg‚æ‚â‚â—‚æ3‚æ‚â‡‚æ#‚æ‚âS‚æ$ˆ¤¤ì(€€€È¹É•…‘ÍÉÉ…å	Õ™™•È¡™¥±”¤ì(€ô¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸¥¹•ÍÑI…Ü¡¹…µ”°Ñ•áÐ°Í¥é”°µ•Ñ„€ôíô¤ì(€±•ÐÉ½ÝÌ€ômtì(€±•Ð¹½É´ì(€½¹ÍÐ‰ÕÍ¥¹•ÍÍ…Ñ”€ôµ•Ñ„¹‰ÕÍ¥¹•ÍÍ…Ñ”ñðÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹‘…Ñ”ì(€¥˜€ ½p¹Á‘˜½¤¹Ñ•ÍÐ¡¹…µ”¤¤ì(€€€€¼¨ÍÑ…Ñ•µ•¹Ðƒ‚âc‚âg‚âË‚â‚âË‚â‚æ‚âo‚æ‚âdAƒŠPƒ‚æ‚â+‚æ'‚âW‚âÇ‚âŸ‚â·‚æ#‚âË‚âg‚æ‚â'‚â{‚âË‚âÀ€¨¼(€€€¹½É´€ô…Ý…¥ÐA‘™MÑ´¹Á…ÉÍ”¡¹…µ”°Ñ•áÐ°‰ÕÍ¥¹•ÍÍ…Ñ”¤ì(€€€¥˜€¡¹½É´¹ÅÕ…±¥Ñä€˜˜€…¹½É´¹ÅÕ…±¥Ñä¹½µÁ±•Ñ”¤Ñ¡É½Ü¹•ÜÉÉ½È¡Aƒ‚â·‚æ#‚âË‚âg‚æ‚âS‚æ'‚âk‚âË‚â‚â«‚æ#‚âŸ‚âdè€‘í¹½É´¹ÅÕ…±¥Ñä¹Õ¹É•…‘I½ÝÌ¹±•¹Ñ¡ôƒ‚âk‚â‚â‚â_‚âÇ‚âS‚â‹‚âÇ‚â‚â·‚æ#‚âË‚âg‚æ‚â‡‚æ#‚æ‚âS‚æ$€¼€‘í¹½É´¹ÅÕ…±¥Ñä¹¥¹Ù…±¥‘I½ÝÌ¹±•¹Ñ¡ôƒ‚â‚âË‚â‹‚â‚âË‚â‚âW‚æ'‚â·‚â‚â‹‚âß‚âg‚â‹‚âÇ‚âdƒŠPƒ‚â«‚æ#‚â‚â·‚æ#‚âË‚âg‚âs‚æ#‚âË‚âd=Hƒ‚â¯‚â‚âß‚â·‚âW‚â‚âŸ‚â#‚âW‚æ'‚âg‚â'‚âk‚âÇ‚âk‚â‚æ#‚â·‚âg‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âQ€¤ì(€€€É•¥ÍÑ•É½Õ¹ÑÉ½µMÑ…Ñ•µ•¹Ð¡¹½É´¤ì(€ô•±Í”ì(€€€¥˜€ ½p¸¡á±Íáñá±Íµñá±Ì¤½¤¹Ñ•ÍÐ¡¹…µ”¤¤É½ÝÌ€ô…Ý…¥Ð¹¥¹”¹Á…ÉÍ•M¡••Ð¡Ñ•áÐ¤ì(€€€•±Í”ì(€€€€€€¼¨ƒ‚æ‚â‚â—‚æ0MX½QaPƒ‚â_‚â×‚æ#‚â‡‚âË‚â#‚âË‚â¥¹ÁÕÑmÑåÁ”õ™¥±•tƒ‚â[‚âç‚â‚â·‚æ#‚âË‚âg‚æ‚âo‚æ‚âdÍÑÉ¥¹œƒ‚æ‚âW‚æ#‚æ‚â‚â—‚æ3‚â#‚âË‚â(€€€€€€€€MÕÁ…‰…Í”MÑ½É…”ƒ‚â[‚âç‚â‚âS‚âË‚âŸ‚âg‚æ3‚æ‚â¯‚â—‚âS‚æ‚âo‚æ‚âdÉÉ…å	Õ™™•ÈƒŠPƒ‚æ‚âo‚â—‚â‚æ‚â¯‚æ'‚æ‚âo‚æ‚âg‚â‚æ'‚â·‚â‚âŸ‚âË‚â‡‚â‚æ#‚â·‚âd(€€€€€€€€ƒ‚â«‚æ#‚â‚æ‚â‚æ'‚âÈÁ…ÉÍ•Èƒ‚æ‚â{‚âß‚æ#‚â·‚æ‚â¯‚æ'‚â_‚âÇ‚æ'‚â‚â«‚â·‚â‚æ‚â«‚æ'‚âg‚â_‚âË‚â‚æ‚â+‚æ'‚âW‚âÇ‚âŸ‚â·‚æ#‚âË‚âg‚æ‚âS‚â×‚â‹‚âŸ‚â‚âÇ‚âg‚æ‚âS‚æ$€¨¼(€€€€€½¹ÍÐÍÙQ•áÐ€ôÑåÁ•½˜Ñ•áÐ€ôôô€‰ÍÑÉ¥¹œˆ€üÑ•áÐ€è¹•ÜQ•áÑ•½‘•È ‰ÕÑ˜´àˆ¤¹‘•½‘”¡Ñ•áÐ¤ì(€€€€€É½ÝÌ€ô¹¥¹”¹Á…ÉÍ•MX¡ÍÙQ•áÐ¤ì(€€€ô(€€€¹½É´€ô¹¥¹”¹¹½Éµ…±¥é”¡¹…µ”°É½ÝÌ°¹Í•ÑÑ¥¹Ì°‰ÕÍ¥¹•ÍÍ…Ñ”¤ì(€ô(€€¼¨ƒ‚æ‚â_‚æ‚â‚âS‚æ'‚âŸ‚â‹‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚âk‚âÇ‚â7‚â+‚âÔ€£‚âk‚â‚âÓ‚â§‚âÇ‚â_‚â‹‚æ#‚â·‚âˆ¿‚âk‚âÇ‚â7‚â+‚âÔ¿‚âs‚âç‚æ'‚æ‚â¯‚æ'‚âk‚â‚âÓ‚â‚âË‚âŒ¤€¬¹½Éµ…±¥é”ƒ‚æ‚â—‚â‚âk‚âÇ‚â7‚â+‚â×‚æ‚â¯‚æ'‚æ‚âo‚æ‚âg‚â‚âç‚âo‚æ‚âk‚âk‚æ‚âS‚â×‚â‹‚âœ(€€€€ƒ‚æ‚â{‚âß‚æ#‚â·‚æ‚â¯‚æ$MQ4€£‚âc‚âg‚âË‚â‚âË‚âŒ¤ƒ‚â‚âÇ‚âh	<½A4ƒ‚â#‚âÇ‚âk‚â‚âç‚æ#‚â‚âÇ‚âg‚æ‚âS‚æ'‚æ‚â‡‚æ'‚æ‚â‚â×‚â‹‚âg‚æ‚â—‚â‚âk‚âÇ‚â7‚â+‚â×‚âW‚æ#‚âË‚â‚â‚âç‚âo‚æ‚âk‚âh€£‚â‚â×‚âP¿‚æ‚âk‚â·‚â‚æ0QÉÕ•5½¹•ä¤€¨¼(€±•ÐÑ…MÕ‰¼€ô€ˆˆ°(€€€Ñ…AÉ½Ù¥‘•È€ô€ˆˆ°(€€€Ñ…½Õ¹Ð€ô€ˆˆì(€¥˜€¡ÑåÁ•½˜I•¥ÍÑÉä€„ôô€‰Õ¹‘•™¥¹•ˆ¤ì(€€€±•ÐÑ…œ€ô¹Õ±°ì(€€€¥˜€ ½p¹Á‘˜½¤¹Ñ•ÍÐ¡¹…µ”¤€˜˜¹½É´¹¡•…‘•È€˜˜¹½É´¹¡•…‘•È¹…½Õ¹Ð¤ì(€€€€€Ñ…½Õ¹Ð€ôI•¥ÍÑÉä¹¹½Éµ…±¥é•½Õ¹Ð¡¹½É´¹¡•…‘•È¹…½Õ¹Ð°¹½É´¹¡•…‘•È¹‰…¹¬¤ì(€€€€€Ñ…œ€ôI•¥ÍÑÉä¹‰å½Õ¹Ð¡Ñ…½Õ¹Ð¤ñðI•¥ÍÑÉä¹µ…Ñ¡¥±”¡¹…µ”¤¹µ…Ñ ì(€€€ô•±Í”ì(€€€€€Ñ…œ€ôI•¥ÍÑÉä¹µ…Ñ¡¥±”¡¹…µ”¤¹µ…Ñ ì(€€€ô(€€€½¹ÍÐ‰¬€ô€¡¹½É´¹™½Éµ…Ð€˜˜¹½É´¹™½Éµ…Ð¹‰…¹¬¤ñð€¡Ñ…œ€˜˜Ñ…œ¹‰…¹¬¤ñð€¡¹½É´¹¡•…‘•È€˜˜¹½É´¹¡•…‘•È¹‰…¹¬¤ñð€ˆˆì(€€€€¡¹½É´¹É•½É‘Ìñðmt¤¹™½É…  ¡È¤€ôøì(€€€€€¥˜€¡È¹…½Õ¹Ð€˜˜€…È¹¥ÍAµ¡…¹¹•°€˜˜€½q¼¹Ñ•ÍÐ¡MÑÉ¥¹œ¡È¹…½Õ¹Ð¤¤¤È¹…½Õ¹Ð€ôI•¥ÍÑÉä¹¹½Éµ…±¥é•½Õ¹Ð¡È¹…½Õ¹Ð°‰¬ñðÈ¹‰…¹¬¤ì(€€€ô¤ì(€€€Ñ…MÕ‰¼€ô€¡Ñ…œ€˜˜Ñ…œ¹ÍÕ‰¼¤ñð€¡¹½É´¹™½Éµ…Ð€˜˜¹½É´¹™½Éµ…Ð¹½µÁ…¹ä¤ñð€ˆˆì(€€€½¹ÍÐÈÀ€ô€¡¹½É´¹É•½É‘Ìñðmt¥lÁtì(€€€Ñ…AÉ½Ù¥‘•È€ô€¡ÈÀ€˜˜ÈÀ¹¥ÍAµ¡…¹¹•°€˜˜ÈÀ¹¡…¹¹•°¤ñð€¡Ñ…œ€˜˜Ñ…œ¹ÁÉ½Ù¥‘•È¤ñð€ˆˆì(€€€¥˜€¡Ñ…MÕ‰¼¤€¡¹½É´¹É•½É‘Ìñðmt¤¹™½É…  ¡È¤€ôøì¥˜€ …È¹ÍÕ‰¼¤È¹ÍÕ‰¼€ôÑ…MÕ‰¼ìô¤ì(€ô((€%µÁ½ÉÑMÑ…Ñ”¹™¥±•Ì€ô%µÁ½ÉÑMÑ…Ñ”¹™¥±•Ì¹™¥±Ñ•È ¡˜¤€ôø€¡µ•Ñ„¹™¥±•%€ü˜¹±½Õ‘¥±•%€„ôôµ•Ñ„¹™¥±•%€è˜¹¹…µ”€„ôô¹…µ”¤¤ì(€%µÁ½ÉÑMÑ…Ñ”¹™¥±•Ì¹ÁÕÍ ¡ì(€€€¹…µ”°(€€€±½Õ‘¥±•%èµ•Ñ„¹™¥±•%ñð¹Õ±°°(€€€ÍÑ½É…•A…Ñ èµ•Ñ„¹ÍÑ½É…•A…Ñ ñð¹Õ±°°(€€€‰ÕÍ¥¹•ÍÍ…Ñ”°(€€€Í¥é”èÍ¥é”€üü€¡Ñ•áÐ¹‰åÑ•1•¹Ñ ñðÑ•áÐ¹±•¹Ñ ¤°(€€€É½Ý½Õ¹ÐèÉ½ÝÌ¹±•¹Ñ °(€€€É½ÝÌ°€¼¼ƒ‚æ‚â‚æ‚âk‚æ‚â[‚âŸ‚âS‚âÓ‚âk‚æ‚âŸ‚æ$ƒ‚æ‚â{‚âß‚æ#‚â´¹½Éµ…±¥é”ƒ‚æ‚â¯‚â‡‚æ#‚æ‚â‡‚âß‚æ#‚â·‚â‚â;‚âc‚âg‚âË‚â‚âË‚â‚æ‚âo‚â—‚â×‚æ#‚â‹‚âd(€€€™½Éµ…Ðè¹½É´¹™½Éµ…Ð°(€€€É•½É‘Ìè¹½É´¹É•½É‘Ì°(€€€…Õàè¹½É´¹…Õàñðmt°(€€€‘É½ÁÁ•è¹½É´¹‘É½ÁÁ•°(€€€Ý…É¹¥¹Ìè¹½É´¹Ý…É¹¥¹Ì°(€€€ÍÕ‰¼èÑ…MÕ‰¼°(€€€ÁÉ½Ù¥‘•ÈèÑ…AÉ½Ù¥‘•È°(€€€Ñ…½Õ¹Ð°(€ô¤ì(€½¹ÍÐ­¥¹€ô¹½É´¹™½Éµ…Ð¹É•…±1…‰•°ñð¹½É´¹™½Éµ…Ð¹Í½ÕÉ”¹Ñ½UÁÁ•É…Í” ¤€¬€¡¹½É´¹™½Éµ…Ð¹‰…¹¬€ü€ˆ€¼€ˆ€¬¹½É´¹™½Éµ…Ð¹‰…¹¬€è€ˆˆ¤ì(€±½Ñ¥½¸ ‰¥µÁ½ÉÐˆ°€‰Í½ÕÉ•}™¥±”ˆ°¹…µ”°ƒ‚âg‚âÏ‚æ‚â‚æ'‚âÈ€‘ì¡¹½É´¹É•½É‘Ì¹±•¹Ñ ñð€¡¹½É´¹…Õàñðmt¤¹±•¹Ñ ¥ôƒ‚â‚âË‚â‹‚â‚âË‚âŒ€ ‘í­¥¹‘ô¥€¤ì(€É•ÑÕÉ¸¹½É´ì)ô((¼¨ƒ‚â·‚æ#‚âË‚âg‚æ‚â‚â—‚æ3‚æ‚âS‚âÓ‚â‡‚æ‚â¯‚â‡‚æ#‚âS‚æ'‚âŸ‚â‹‚â‚â;‚âo‚âÇ‚â#‚â#‚âã‚âk‚âÇ‚âdƒŠPƒ‚æ‚â+‚æ'‚æ‚â‡‚âß‚æ#‚â·‚âs‚âç‚æ'‚æ‚â+‚æ'‚æ‚âo‚â—‚â×‚æ#‚â‹‚âg‚â‚â;‚âc‚âg‚âË‚â‚âË‚â‚â¯‚â‚âß‚â´Ñ½±•É…¹”€¨¼)™Õ¹Ñ¥½¸É•¹½Éµ…±¥é•±° ¤ì(€%µÁ½ÉÑMÑ…Ñ”¹™¥±•Ì€ô%µÁ½ÉÑMÑ…Ñ”¹™¥±•Ì¹µ…À ¡˜¤€ôøì(€€€¥˜€ …˜¹É½ÝÌñð€…˜¹É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸˜ì(€€€½¹ÍÐ¹½É´€ô¹¥¹”¹¹½Éµ…±¥é”¡˜¹¹…µ”°˜¹É½ÝÌ°¹Í•ÑÑ¥¹Ì°˜¹‰ÕÍ¥¹•ÍÍ…Ñ”ñðÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹‘…Ñ”¤ì(€€€É•ÑÕÉ¸ì€¸¸¹˜°™½Éµ…Ðè¹½É´¹™½Éµ…Ð°É•½É‘Ìè¹½É´¹É•½É‘Ì°…Õàè¹½É´¹…Õàñðmt°‘É½ÁÁ•è¹½É´¹‘É½ÁÁ•°Ý…É¹¥¹Ìè¹½É´¹Ý…É¹¥¹Ìôì(€ô¤ì)ô((¼¨ƒ‚æ‚â‚âß‚æ#‚â·‚âg‚æ‚â‚â_‚â×‚æ#‚â_‚âÏ‚æ‚â¯‚æ'‚â‚âÃ‚âk‚âk‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚æ‚â·‚â‚æ‚âS‚æ$€¨¼)™Õ¹Ñ¥½¸…ÕÑ½I•…‘¥¹•ÍÌ ¤ì(€½¹ÍÐ™¥±•Ì€ô%µÁ½ÉÑMÑ…Ñ”¹™¥±•Ìì(€½¹ÍÐ¡…ÍMÑ´€ô™¥±•Ì¹Í½µ” ¡˜¤€ôø˜¹™½Éµ…Ð¹Í½ÕÉ”€„ôô€‰‰¼ˆ€˜˜˜¹™½Éµ…Ð¹Í½ÕÉ”€„ôô€‰…Õàˆ€˜˜˜¹É•½É‘Ì¹±•¹Ñ ¤ì(€½¹ÍÐ¡…Í	¼€ô™¥±•Ì¹Í½µ” ¡˜¤€ôø˜¹™½Éµ…Ð¹Í½ÕÉ”€ôôô€‰‰¼ˆ€˜˜˜¹É•½É‘Ì¹±•¹Ñ ¤ì(€½¹ÍÐ¡…ÍÕà€ô™¥±•Ì¹Í½µ” ¡˜¤€ôø€¡˜¹…Õàñðmt¤¹±•¹Ñ ¤ì(€¥˜€ …™¥±•Ì¹±•¹Ñ ¤É•ÑÕÉ¸ìÉ•…‘äè™…±Í”°Ñ•áÐè€‹‚â‚â·‚æ‚â‚â—‚æ0ˆ°Ñ½¹”è€‰¥‘±”ˆ°Ý¡äè€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚æ‚â‚â—‚æ3‚æ‚â‚æ'‚âË‚â‚âÃ‚âk‚âhˆôì(€¥˜€ …¡…ÍMÑ´€˜˜€¡¡…Í	¼ñð¡…ÍÕà¤¤(€€€É•ÑÕÉ¸ì(€€€€€É•…‘äèÑÉÕ”°(€€€€€ÉÕ±•Í=¹±äèÑÉÕ”°(€€€€€Ñ•áÐè%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸€ü€‹‚âW‚â‚âŸ‚â#‚â‚â;‚æ‚â—‚æ'‚âœˆ€è€‹‚âW‚â‚âŸ‚â#‚â‚â;‚âc‚âã‚â‚â‚âÓ‚â ˆ°(€€€€€Ñ½¹”è€‰Ý…¥Ðˆ°(€€€€€Ý¡äè€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚æ‚â‚â—‚æ3‚âw‚âÇ‚æ#‚â‚âc‚âg‚âË‚â‚âË‚âŒƒŠPƒ‚â‚âÃ‚âk‚âk‚âW‚â‚âŸ‚â#‚â‚â;‚âc‚âã‚â‚â‚âÓ‚â#‚â#‚âË‚â‚â‚âË‚â‹‚â‚âË‚âg‚â¯‚â—‚âÇ‚â‚âk‚æ'‚âË‚âg‚æ‚â¯‚æ'‚â‚æ#‚â·‚âd€£‚â‚æ#‚âË‚â‚â·‚â„¿‚âW‚âÇ‚âS‚æ‚â‚â‚âS‚âÓ‚âT¿‚â‚æ'‚âË‚â‡‚âŸ‚âÇ‚âd¿‚â/‚æ'‚âÌ¤ˆ°(€€€ôì(€¥˜€ …¡…ÍMÑ´¤É•ÑÕÉ¸ìÉ•…‘äè™…±Í”°Ñ•áÐè€‹‚â‚â´MQ4ˆ°Ñ½¹”è€‰Ý…¥Ðˆ°Ý¡äè€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚æ‚â‚â—‚æ3‚âw‚âÇ‚æ#‚â‚âc‚âg‚âË‚â‚âË‚âŒ€¡MQ4ƒ‚â¯‚â‚âß‚â´A4¤ˆôì(€¥˜€ …¡…Í	¼¤É•ÑÕÉ¸ìÉ•…‘äè™…±Í”°Ñ•áÐè€‹‚â‚â´	<ˆ°Ñ½¹”è€‰Ý…¥Ðˆ°Ý¡äè€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚æ‚â‚â—‚æ3‚âw‚âÇ‚æ#‚â‚â‚âÃ‚âk‚âk‚â¯‚â—‚âÇ‚â‚âk‚æ'‚âË‚âd€¡	<¤ˆôì(€É•ÑÕÉ¸ìÉ•…‘äèÑÉÕ”°Ñ•áÐè%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸€ü€‹‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚æ‚â—‚æ'‚âœˆ€è€‹‚â{‚â‚æ'‚â·‚â‡‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âPˆ°Ñ½¹”è€‰½¬ˆ°Ý¡äè€‹‚æ‚â‚â—‚æ3‚â‚â‚âk‚â_‚âÇ‚æ'‚â‚â«‚â·‚â‚âw‚âÇ‚æ#‚âƒ‚â‚âÃ‚âk‚âk‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚æ‚â¯‚æ'‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÐˆôì)ô((¼¨ƒ‚â‚âŸ‚âk‚â‚âŸ‚â‡‚âs‚â—‚âW‚â‚âŸ‚â#‚â‚â;‚âc‚âã‚â‚â‚âÓ‚â#‚â#‚âË‚â‚æ‚â‚â—‚æ3‚â‚âË‚â‹‚â‚âË‚âg‚â¯‚â—‚âÇ‚â‚âk‚æ'‚âË‚âd€£‚æ‚â‡‚æ#‚âW‚æ'‚â·‚â‚æ‚â+‚æ$ÍÑ…Ñ•µ•¹Ð¤€¨¼)™Õ¹Ñ¥½¸ÉÕ¹	ÕÍ¥¹•ÍÍIÕ±•Ì ¤ì(€¥˜€¡ÑåÁ•½˜IÕ±•Ì€ôôô€‰Õ¹‘•™¥¹•ˆ¤É•ÑÕÉ¸ì•á•ÁÑ¥½¹Ìèmt°½Õ¹ÑÌèíôôì(€½¹ÍÐÁ…ÉÍ•€ô%µÁ½ÉÑMÑ…Ñ”¹™¥±•Ì(€€€€¹™¥±Ñ•È ¡˜¤€ôø˜¹™½Éµ…Ð€˜˜€¡˜¹™½Éµ…Ð¹Í½ÕÉ”€ôôô€‰‰¼ˆñð˜¹™½Éµ…Ð¹Í½ÕÉ”€ôôô€‰…Õàˆ¤¤(€€€€¹µ…À ¡˜¤€ôø€¡ìÉ•½É‘Ìè˜¹™½Éµ…Ð¹Í½ÕÉ”€ôôô€‰‰¼ˆ€ü˜¹É•½É‘Ì€èmt°…Õàè˜¹…Õàñðmtô¤¤ì(€É•ÑÕÉ¸IÕ±•Ì¹ÉÕ¸¡Á…ÉÍ•°¹Í•ÑÑ¥¹Ì¤ì)ô((¼¨	<µ™¥ÉÍÐ½Ù•É…”è	<ƒ‚â‚âß‚â·‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚âŸ‚æ#‚âË‚âk‚âÇ‚â7‚â+‚âÔ½AÉ½Ù¥‘•Èƒ‚æ‚âS‚â[‚âç‚â‚æ‚â+‚æ'‚â#‚â‚âÓ‚â‚æ‚âg‚âŸ‚âÇ‚âg‚âg‚âÇ‚æ'‚âd(€€½½±”M¡••Ðƒ‚æ‚âo‚æ‚âg‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â+‚âß‚æ#‚â·‚â‡‚âË‚âW‚â‚âC‚âË‚âdƒ‚â«‚æ#‚âŸ‚âg‚â+‚âß‚æ#‚â·‚æ‚â‡‚â—‚æ‚â—‚âÃ‚â+‚âß‚æ#‚â·‚æ‚â‚â—‚æ3‚æ‚âo‚æ‚âg‚æ‚â{‚â×‚â‹‚â¡¥¹Ð€¨¼)™Õ¹Ñ¥½¸‰Õ¥±‘	½¥ÉÍÑ½Ù•É…”¡ÍÑµI•½É‘Ì°‰½I•½É‘Ì¤ì(€½¹ÍÐ±•…¸€ô€¡Ù…±Õ”¤€ôøMÑÉ¥¹œ¡Ù…±Õ”ñð€ˆˆ¤¹ÑÉ¥´ ¤¹Ñ½UÁÁ•É…Í” ¤ì(€½¹ÍÐ½µÁ…¹å=˜€ô€¡É•½É¤€ôø¹½Éµ…±¥é•1¥Ù•½µÁ…¹å½‘”¡É•½Éü¹ÍÕ‰¼ñðÉ•½Éü¹½µÁ…¹ä¤ñð±•…¸¡É•½Éü¹ÍÕ‰¼ñðÉ•½Éü¹½µÁ…¹ä¤ñð€‹‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âã‚âk‚â‚âÓ‚â§‚âÇ‚â\ˆì(€½¹ÍÐ‘¥É•Ñ¥½¸€ô€¡É•½É¤€ôøÉ•½Éü¹‘¥É•Ñ¥½¸€ôôô€‰Ý¥Ñ¡‘É…Üˆ€ü€‰Ý¥Ñ¡‘É…Üˆ€èÉ•½Éü¹‘¥É•Ñ¥½¸€ôôô€‰‘•Á½Í¥Ðˆ€ü€‰‘•Á½Í¥Ðˆ€è€‰Õ¹­¹½Ý¸ˆì(€½¹ÍÐ¥‘•¹Ñ¥Ñä€ô€¡É•½É¤€ôøì(€€€½¹ÍÐÉ…Ü€ôÉ•½Éü¹¡…¹¹•°ñðÉ•½Éü¹…½Õ¹ÐñðÉ•½Éü¹‰…¹¬ñð€ˆˆì(€€€½¹ÍÐÁ´€ôÑåÁ•½˜½Éµ…ÑÌ€„ôô€‰Õ¹‘•™¥¹•ˆ€˜˜½Éµ…ÑÌ¹…¹½¹¥…±A´€ü½Éµ…ÑÌ¹…¹½¹¥…±A´¡É…Ü¤€è€ˆˆì(€€€¥˜€¡Á´ñðÉ•½Éü¹¥ÍAµ¡…¹¹•°¤É•ÑÕÉ¸ì­¥¹è€‰A4ˆ°¥èÁ´ñð±•…¸¡É…Ü¤°±…‰•°èÁ´ñð±•…¸¡É…Ü¤ôì(€€€½¹ÍÐ…½Õ¹Ð€ôMÑÉ¥¹œ¡É•½Éü¹…½Õ¹Ðñð€ˆˆ¤¹É•Á±…” ½q½œ°€ˆˆ¤ì(€€€½¹ÍÐ‰…¹¬€ô±•…¸¡É•½Éü¹‰…¹¬ñðÉ•½Éü¹¡…¹¹•°¤ì(€€€É•ÑÕÉ¸ì­¥¹è€‰MQ4ˆ°¥è…½Õ¹Ðñð‰…¹¬°±…‰•°èm‰…¹¬°…½Õ¹Ð€üƒŠ‹Šˆ‘í…½Õ¹Ð¹Í±¥” ´Ð¥õ€€è€ˆ‰t¹™¥±Ñ•È¡	½½±•…¸¤¹©½¥¸ ˆ€ˆ¤ôì(€ôì(€½¹ÍÐ½±±•Ð€ô€¡É•½É‘Ì¤€ôøì(€€€½¹ÍÐµ…À€ô¹•Ü5…À ¤ì(€€€€¡É•½É‘Ìñðmt¤¹™½É…  ¡É•½É¤€ôøì(€€€€€½¹ÍÐ¥€ô¥‘•¹Ñ¥Ñä¡É•½É¤ì(€€€€€¥˜€ …¥¹¥ñð¥¹¥€ôôô€‰U9-9=]8ˆ¤É•ÑÕÉ¸ì(€€€€€½¹ÍÐ½µÁ…¹ä€ô½µÁ…¹å=˜¡É•½É¤ì(€€€€€½¹ÍÐÍåÍÑ•´€ô‰ÕÍ¥¹•ÍÍMåÍÑ•µ=™½µÁ…¹ä¡½µÁ…¹ä¤ì(€€€€€½¹ÍÐ‘¥È€ô‘¥É•Ñ¥½¸¡É•½É¤ì(€€€€€½¹ÍÐ­•ä€ô€‘íÍåÍÑ•µõð‘í½µÁ…¹åõð‘í¥¹­¥¹‘õð‘í¥¹¥‘õð‘í‘¥Éõ€ì(€€€€€½¹ÍÐ¥Ñ•´€ôµ…À¹•Ð¡­•ä¤ñðì­•ä°ÍåÍÑ•´°½µÁ…¹ä°­¥¹è¥¹­¥¹°¥‘•¹Ñ¥Ñäè¥¹¥°±…‰•°è¥¹±…‰•°°‘¥É•Ñ¥½¸è‘¥È°É½ÝÌè€À°…µ½Õ¹Ðè€À°Í½ÕÉ•}™¥±•Ìèmtôì(€€€€€¥Ñ•´¹É½ÝÌ€¬ô€Äì(€€€€€¥Ñ•´¹…µ½Õ¹Ð€ô5…Ñ ¹É½Õ¹ ¡¥Ñ•´¹…µ½Õ¹Ð€¬9Õµ‰•È¡É•½Éü¹…µ½Õ¹Ðñð€À¤¤€¨€ÄÀÀ¤€¼€ÄÀÀì(€€€€€½¹ÍÐÍ½ÕÉ•¥±”€ôMÑÉ¥¹œ¡É•½Éü¹Í½ÕÉ•}™¥±”ñðÉ•½Éü¹™¥±•9…µ”ñð€ˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€¥˜€¡Í½ÕÉ•¥±”€˜˜€…¥Ñ•´¹Í½ÕÉ•}™¥±•Ì¹¥¹±Õ‘•Ì¡Í½ÕÉ•¥±”¤¤¥Ñ•´¹Í½ÕÉ•}™¥±•Ì¹ÁÕÍ ¡Í½ÕÉ•¥±”¤ì(€€€€€µ…À¹Í•Ð¡­•ä°¥Ñ•´¤ì(€€€ô¤ì(€€€É•ÑÕÉ¸l¸¸¹µ…À¹Ù…±Õ•Ì ¥t¹Í½ÉÐ ¡„°ˆ¤€ôø„¹­•ä¹±½…±•½µÁ…É”¡ˆ¹­•ä¤¤ì(€ôì(€½¹ÍÐÉ•ÅÕ¥É•€ô½±±•Ð¡‰½I•½É‘Ì¤ì(€½¹ÍÐÉ••¥Ù•€ô½±±•Ð¡ÍÑµI•½É‘Ì¤ì(€½¹ÍÐÉ••¥Ù•‘-•åÌ€ô¹•ÜM•Ð¡É••¥Ù•¹µ…À ¡¥Ñ•´¤€ôø¥Ñ•´¹­•ä¤¤ì(€½¹ÍÐµ¥ÍÍ¥¹œ€ôÉ•ÅÕ¥É•¹™¥±Ñ•È ¡¥Ñ•´¤€ôø€…É••¥Ù•‘-•åÌ¹¡…Ì¡¥Ñ•´¹­•ä¤¤ì(€É•ÑÕÉ¸ì(€€€µ•Ñ¡½è€‰	=}%IMPˆ°(€€€É•¥ÍÑÉå}Í½ÕÉ”è€‰¡ÑÑÁÌè¼½‘½Ì¹½½±”¹½´½ÍÁÉ•…‘Í¡••ÑÌ½¼ÅA±á•É% åÕ äÍá(Á1!µ¼´åQ$äÌÅ¡)á‘­	é™…5ˆ°(€€€É•ÅÕ¥É•°(€€€É••¥Ù•°(€€€µ¥ÍÍ¥¹œ°(€€€½µÁ±•Ñ”èÉ•ÅÕ¥É•¹±•¹Ñ €ø€À€˜˜µ¥ÍÍ¥¹œ¹±•¹Ñ €ôôô€À°(€ôì)ô()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•ÕÑ½MÑ…ÑÕÌ ¤ì(€½¹ÍÐ•°€ô€ ˆ…ÕÑ½MÑ…ÑÕÌˆ¤ì(€¥˜€ …•°¤É•ÑÕÉ¸ì(€½¹ÍÐÈ€ô%µÁ½ÉÑMÑ…Ñ”¹ÉÕ¹¹¥¹œ€üìÑ•áÐè€‹‚â‚âÏ‚â—‚âÇ‚â‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âPˆ°Ñ½¹”è€‰ÉÕ¸ˆ°Ý¡äè€ˆˆô€è…ÕÑ½I•…‘¥¹•ÍÌ ¤ì(€•°¹±…ÍÍ9…µ”€ô€‰…ÕÑ¼µÍÑ…ÑÕÌ€ˆ€¬È¹Ñ½¹”ì(€€ ˆ…ÕÑ½MÑ…ÑÕÍQ•áÐˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ôÈ¹Ñ•áÐì(€•°¹Ñ¥Ñ±”€ôÈ¹Ý¡äñð€‹‚â‚âÃ‚âk‚âk‚â‚âÏ‚â—‚âÇ‚â‚â#‚âÇ‚âk‚â‚âç‚æ#‚â‚âË‚â‹‚â‚âË‚â‚â·‚â‹‚âç‚æ ˆì)ô((¼¨ƒ‚â_‚â‚âÓ‚â‚æ‚â‚â·‚â‚æ3‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÐƒŠPƒ‚æ‚â‚â×‚â‹‚â‚â_‚âã‚â‚â‚â‚âÇ‚æ'‚â‚â_‚â×‚æ#‚æ‚â‚â—‚æ3‚æ‚â‚æ'‚âË‚â¯‚â‚âß‚â·‚â‚â;‚æ‚âo‚â—‚â×‚æ#‚â‹‚âd€¨¼)±•Ð…ÕÑ½Q¥µ•È€ô¹Õ±°ì)™Õ¹Ñ¥½¸Í¡•‘Õ±•ÕÑ½I•½¹¥±”¡É•…Í½¸¤ì(€±•…ÉQ¥µ•½ÕÐ¡…ÕÑ½Q¥µ•È¤ì(€ÕÁ‘…Ñ•ÕÑ½MÑ…ÑÕÌ ¤ì(€¥˜€ ……ÕÑ½I•…‘¥¹•ÍÌ ¤¹É•…‘äñð%µÁ½ÉÑMÑ…Ñ”¹ÉÕ¹¹¥¹œ¤É•ÑÕÉ¸ì(€…ÕÑ½Q¥µ•È€ôÍ•ÑQ¥µ•½ÕÐ  ¤€ôøÉÕ¹I•½¹¥±•É½µ%µÁ½ÉÐ¡ì…ÕÑ¼èÑÉÕ”°É•…Í½¸ô¤°€ÌÔÀ¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸ÉÕ¹I•½¹¥±•É½µ%µÁ½ÉÐ¡½ÁÑÌ€ôíô¤ì(€½¹ÍÐÍÑ´€ômtì(€½¹ÍÐ‰¼€ômtì(€%µÁ½ÉÑMÑ…Ñ”¹™¥±•Ì¹™½É…  ¡˜¤€ôøì(€€€¥˜€¡˜¹™½Éµ…Ð¹Í½ÕÉ”€ôôô€‰…Õàˆ¤É•ÑÕÉ¸ì(€€€¥˜€¡˜¹™½Éµ…Ð¹Í½ÕÉ”€ôôô€‰‰¼ˆ¤‰¼¹ÁÕÍ  ¸¸¹˜¹É•½É‘Ì¤ì(€€€•±Í”ÍÑ´¹ÁÕÍ  ¸¸¹˜¹É•½É‘Ì¤ì(€ô¤ì(€€¼¨ƒ‚â‚âË‚â‹‚â‚âË‚â‚æ‚âS‚â×‚â‹‚âŸ‚â‚âÇ‚âg‚â·‚âË‚â#‚â·‚â‹‚âç‚æ#‚æ‚âg‚â¯‚â—‚âË‚â‹‚â‚âË‚â‹‚â‚âË‚âd€£‚âk‚âÇ‚â7‚â+‚â×‚âw‚âË‚â€¬ƒ‚âw‚âË‚â‚â‡‚âß‚â´¤ƒ‚âW‚æ'‚â·‚â‚â‹‚âã‚âk‚â‚æ#‚â·‚âg‚â#‚âÇ‚âk‚â‚âç‚æ €¨¼(€¥˜€¡ÑåÁ•½˜½Éµ…ÑÌ€„ôô€‰Õ¹‘•™¥¹•ˆ€˜˜‰¼¹Í½µ” ¡È¤€ôøÈ¹™½Éµ…Ñ½‘”¤¤ì(€€€½¹ÍÐ´€ô½Éµ…ÑÌ¹µ•É”¡‰¼¤ì(€€€‰¼¹±•¹Ñ €ô€Àì(€€€´¹Í½ÉÐ ¡„°ˆ¤€ôø€¡„¹Í•Œñð€À¤€´€¡ˆ¹Í•Œñð€À¤¤¹™½É…  ¡È¤€ôø‰¼¹ÁÕÍ ¡È¤¤ì(€ô(€½¹ÍÐÉ•…‘ä€ô…ÕÑ½I•…‘¥¹•ÍÌ ¤ì(€¥˜€ …É•…‘ä¹É•…‘ä¤ì(€€€¥˜€¡½ÁÑÌ¹©½ˆ¤ì(€€€€€½¹ÍÐµ•ÍÍ…”€ôƒ‚æ‚â‚â—‚æ3‚æ‚âg‚â‚âÓ‚âŸ‚æ‚â‡‚æ#‚â{‚â‚æ'‚â·‚â‡‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âPè€‘íÉ•…‘ä¹Ý¡åõ€ì(€€€€€…Ý…¥ÐMˆ¹™…¥±)½ˆ¡½ÁÑÌ¹©½ˆ¹¥°µ•ÍÍ…”¤¹…Ñ   ¤€ôøíô¤ì(€€€€€±½Õ‘MÑ…Ñ”¹…Ñ¥Ù•)½ˆ€ô¹Õ±°ì(€€€ô(€€€ÕÁ‘…Ñ•ÕÑ½MÑ…ÑÕÌ ¤ì(€€€É•ÑÕÉ¸ì(€ô(€%µÁ½ÉÑMÑ…Ñ”¹ÉÕ¹¹¥¹œ€ôÑÉÕ”ì(€ÕÁ‘…Ñ•ÕÑ½MÑ…ÑÕÌ ¤ì(€Í¡½ÝAÉ½É•ÍÌ¡É•…‘ä¹ÉÕ±•Í=¹±ä€ü€‹‚â‚âÏ‚â—‚âÇ‚â‚âW‚â‚âŸ‚â#‚â‚â;‚âc‚âã‚â‚â‚âÓ‚â#‚â#‚âË‚â‚â‚âË‚â‹‚â‚âË‚âg‚â¯‚â—‚âÇ‚â‚âk‚æ'‚âË‚âdˆ€è€‹‚â‚âÃ‚âk‚âk‚â‚âÏ‚â—‚âÇ‚â‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚æ‚â¯‚æ'‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÐˆ¤ì(€…Ý…¥Ð¹•ÜAÉ½µ¥Í” ¡È¤€ôøÍ•ÑQ¥µ•½ÕÐ¡È°€ÐÀ¤¤ì((€½¹ÍÐ‰¥è€ôÉÕ¹	ÕÍ¥¹•ÍÍIÕ±•Ì ¤ì(€±•ÐÉ•ÍÕ±Ðì(€¥˜€¡É•…‘ä¹ÉÕ±•Í=¹±ä¤ì(€€€½¹ÍÐ¡½ÕÉ±åMÑ´€ô¹•ÜÉÉ…ä ÈÐ¤¹™¥±° À¤ì(€€€½¹ÍÐ¡½ÕÉ±å5…Ñ¡•€ô¹•ÜÉÉ…ä ÈÐ¤¹™¥±° À¤ì(€€€‰¼¹™½É…  ¡È¤€ôø¡½ÕÉ±åMÑµm5…Ñ ¹™±½½È¡È¹Í•Œ€¼€ÌØÀÀ¥t¬¬¤ì(€€€É•ÍÕ±Ð€ôì(€€€€€µ…Ñ¡•è€À°(€€€€€•á•ÁÑ¥½¹Ìèmt°(€€€€€ÍÑµ½Õ¹Ðè€À°(€€€€€‰½½Õ¹Ðè‰¼¹±•¹Ñ °(€€€€€•±…ÁÍ•‘5Ìè€À°(€€€€€µ…Ñ¡I…Ñ”è€À°(€€€€€¹•…ÉQ½±•É…¹”è€À°(€€€€€¡½ÕÉ±åMÑ´°(€€€€€¡½ÕÉ±å5…Ñ¡•°(€€€€€É½ÍÍ…å]¥¹‘½Üè‰¼¹™¥±Ñ•È ¡È¤€ôøÈ¹É½ÍÍ…äñðÈ¹±…Ñ•9¥¡Ð¤¹±•¹Ñ °(€€€€€¹½MÑµM¥‘”èmt°(€€€€€¹½MÑµ½Õ¹Ðè‰¼¹±•¹Ñ °(€€€€€ÉÕ±•Í=¹±äèÑÉÕ”°(€€€ôì(€ô•±Í”ì(€€€¹Í•ÑÑ¥¹Ì¹…Í=˜€ô…Ñ”¹¹½Ü ¤ì€¼¼ƒ‚â‚âÓ‚âS‚â·‚âË‚â‹‚âàM1ƒ‚â#‚âË‚â‚æ‚âŸ‚â—‚âË‚â#‚â‚âÓ‚â‚â‚â·‚â‚â‚âË‚â‚âW‚â‚âŸ‚â (€€€É•ÍÕ±Ð€ô…Ý…¥Ð¹¥¹”¹É•½¹¥±”¡ÍÑ´°‰¼°¹Í•ÑÑ¥¹Ì°¹…½Õ¹ÑÌ°€¡ÁÐ°±…‰•°¤€ôøÍ•ÑAÉ½É•ÍÌ¡ÁÐ°±…‰•°¤¤ì(€ô(€€¼¨ƒ‚â‚âŸ‚â„•á•ÁÑ¥½¸ƒ‚â#‚âË‚â‚â‚â;‚âc‚âã‚â‚â‚âÓ‚â#‚æ‚â‚æ'‚âË‚â‚âÇ‚âk‚âs‚â—‚â#‚âÇ‚âk‚â‚âç‚æ ƒ‚æ‚â—‚æ'‚âŸ‚â·‚â·‚â‚â‚â¯‚âÇ‚â«‚æ‚â¯‚â‡‚æ#‚æ‚â¯‚æ'‚âW‚æ#‚â·‚æ‚âg‚âß‚æ#‚â·‚â€¨¼(€€¼¨ƒ‚â‚âŸ‚â‡‚æ‚â—‚æ'‚âŸ‚â‹‚âã‚âk‚â‚âË‚â‹‚â‚âË‚â‚â_‚â×‚æ#‚â/‚æ'‚âÏ‚â‚âÇ‚âd€£‚â‚â;‚âc‚âã‚â‚â‚âÓ‚â#‚â‚âÇ‚âk‚â‚âË‚â‚â#‚âÇ‚âk‚â‚âç‚æ#‚â·‚âË‚â#‚â#‚âÇ‚âk‚æ‚â‚â«‚æ‚âS‚â×‚â‹‚âŸ‚â‚âÇ‚âd¤€¨¼(€½¹ÍÐ‰•ÍÑà€ô¹•Ü5…À ¤ì(€É•ÍÕ±Ð¹•á•ÁÑ¥½¹Ì¹½¹…Ð¡‰¥è¹•á•ÁÑ¥½¹Ì¤¹™½É…  ¡”¤€ôøì(€€€½¹ÍÐ¬€ôm”¹ÑåÁ”°”¹…½Õ¹Ð°”¹Ñ¥µ”°”¹ÍåÍÑ•µµ½Õ¹Ð€üü€ˆ‰t¹©½¥¸ ‰ðˆ¤ì(€€€½¹ÍÐÁÉ•Ø€ô‰•ÍÑà¹•Ð¡¬¤ì(€€€€¼¨ƒ‚â[‚æ'‚âË‚â/‚æ'‚âÏ‚â‚âÇ‚âdƒ‚æ‚â‚æ‚âk‚â·‚âÇ‚âg‚â_‚â×‚æ#‚â‡‚â×‚â‚âÏ‚â·‚âc‚âÓ‚âk‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âS‚â‚âŸ‚æ#‚âË‚æ‚âŸ‚æ$€¨¼(€€€¥˜€ …ÁÉ•Øñð€ …ÁÉ•Ø¹‘•Ñ…¥°€˜˜”¹‘•Ñ…¥°¤¤‰•ÍÑà¹Í•Ð¡¬°”¤ì(€ô¤ì(€É•ÍÕ±Ð¹•á•ÁÑ¥½¹Ì€ôl¸¸¹‰•ÍÑà¹Ù…±Õ•Ì ¥t¹Í½ÉÐ ¡„°ˆ¤€ôø„¹Í½ÉÑM•Œ€´ˆ¹Í½ÉÑM•Œ¤ì(€É•ÍÕ±Ð¹•á•ÁÑ¥½¹Ì¹™½É…  ¡”°¤¤€ôø€¡”¹¥€ô€‰`´ˆ€¬MÑÉ¥¹œ ÌÀÀÄ€¬¤¤¤¤ì(€É•ÍÕ±Ð¹ÉÕ±•á•ÁÑ¥½¹Ì€ô‰¥è¹•á•ÁÑ¥½¹Ì¹±•¹Ñ ì(€É•ÍÕ±Ð¹…Õá½Õ¹ÑÌ€ô‰¥è¹½Õ¹ÑÌì(€É•ÍÕ±Ð¹‰½¥ÉÍÐ€ô‰Õ¥±‘	½¥ÉÍÑ½Ù•É…”¡ÍÑ´°‰¼¤ì((€¡¥‘•AÉ½É•ÍÌ ¤ì(€%µÁ½ÉÑMÑ…Ñ”¹ÉÕ¹¹¥¹œ€ô™…±Í”ì(€…ÁÁ±åIÕ¹I•ÍÕ±Ð¡É•ÍÕ±Ð°ÍÑ´°‰¼¤ì(€¥˜€¡½ÁÑÌ¹©½ˆ¤ì(€€€ÑÉäì(€€€€€É•ÍÕ±Ð¹‰ÕÍ¥¹•ÍÍ…Ñ”€ô½ÁÑÌ¹©½ˆ¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”ì(€€€€€¥˜€¡É•ÍÕ±Ð¹ÉÕ±•Í=¹±ä¤ì(€€€€€€€…Ý…¥ÐMˆ¹™¥¹¥Í¡A…ÉÍ•=¹±ä¡½ÁÑÌ¹©½ˆ¹¥¤ì(€€€€€€€±½Õ‘MÑ…Ñ”¹…Ñ¥Ù•)½ˆ€ô¹Õ±°ì(€€€€€€€±½Õ‘MÑ…Ñ”¹½Á•É…Ñ¥½¹Ì€ô¹Õ±°ì(€€€€€€€%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸¹É•…Í½¸€ô½ÁÑÌ¹É•…Í½¸ñð€‹‚â·‚æ#‚âË‚âd	<ƒ‚æ‚â{‚âß‚æ#‚â·‚â‚â´MQ4ˆì(€€€€€€€ÕÁ‘…Ñ•ÕÑ½MÑ…ÑÕÌ ¤ì(€€€€€€€Ñ½…ÍÐ¡ƒ‚â·‚æ#‚âË‚âd	<ƒ‚æ‚â—‚æ'‚âœƒ
Üƒ‚â{‚âk‚âk‚âÇ‚â7‚â+‚âÔ½AÉ½Ù¥‘•Èƒ‚â_‚â×‚æ#‚æ‚â+‚æ'‚â#‚â‚âÓ‚â€‘í¹Õ´¡É•ÍÕ±Ð¹‰½¥ÉÍÐ¹É•ÅÕ¥É•¹±•¹Ñ ¥ôƒ‚â‚â—‚âã‚æ#‚â„ƒ
Üƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â«‚â‚æ'‚âË‚â‚âs‚â—‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚â#‚âg‚â‚âŸ‚æ#‚âÈMQ4ƒ‚â#‚âÃ‚â‡‚âÉ€¤ì(€€€€€€€¥˜€¡ÍÑ…Ñ”¹É½ÕÑ”€ôôô€‰¥µÁ½ÉÐˆñð½ÁÑÌ¹½…Í¡‰½…É¤¼ ‰‘…Í¡‰½…Éˆ¤ì(€€€€€€€•±Í”É•¹‘•È ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€€€ô(€€€€€½¹ÍÐÉÕ¹%€ô…Ý…¥ÐMˆ¹Í…Ù•IÕ¸¡É•ÍÕ±Ð°É•ÍÕ±Ð¹•á•ÁÑ¥½¹Ì°ì(€€€€€€€½µÁ…¹äè½ÁÑÌ¹©½ˆ¹½µÁ…¹ä°(€€€€€€€™¥±•%‘Ìè%µÁ½ÉÑMÑ…Ñ”¹™¥±•Ì¹µ…À ¡˜¤€ôø˜¹±½Õ‘¥±•%¤¹™¥±Ñ•È¡	½½±•…¸¤°(€€€€€€€ÍÕµµ…ÉäèìÉ•…Í½¸è½ÁÑÌ¹É•…Í½¸ñð€‹‚â‚âÓ‚âŸ‚â‚âË‚â‹‚âŸ‚âÇ‚âdˆ°©½‰}¥è½ÁÑÌ¹©½ˆ¹¥°±…Ñ•}™¥±”è€„…½ÁÑÌ¹©½ˆ¹±…Ñ•}™¥±”°‰½}™¥ÉÍÐèÉ•ÍÕ±Ð¹‰½¥ÉÍÐô°(€€€€€ô¤ì(€€€€€…Ý…¥ÐMˆ¹™¥¹¥Í¡)½ˆ¡½ÁÑÌ¹©½ˆ¹¥°ÉÕ¹%¤ì(€€€€€±½Õ‘MÑ…Ñ”¹…Ñ¥Ù•)½ˆ€ô¹Õ±°ì(€€€€€±½Õ‘MÑ…Ñ”¹½Á•É…Ñ¥½¹Ì€ô¹Õ±°ì(€€€ô…Ñ €¡”¤ì(€€€€€…Ý…¥ÐMˆ¹™…¥±)½ˆ¡½ÁÑÌ¹©½ˆ¹¥°”¹µ•ÍÍ…”¤¹…Ñ   ¤€ôøíô¤ì(€€€€€±½Õ‘MÑ…Ñ”¹…Ñ¥Ù•)½ˆ€ô¹Õ±°ì(€€€€€Ñ½…ÍÐ¡ƒ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚âs‚â—‚â‚âÓ‚âŸ‚â‚âË‚â‹‚âŸ‚âÇ‚âg‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â è€‘í”¹µ•ÍÍ…•õ€°€‰Ý…É¸ˆ¤ì(€€€ô(€ô(€%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸¹É•…Í½¸€ô½ÁÑÌ¹É•…Í½¸ñð€‹‚æ‚â‚â—‚æ3‚æ‚â‚æ'‚âË‚æ‚â¯‚â‡‚æ ˆì(€ÕÁ‘…Ñ•ÕÑ½MÑ…ÑÕÌ ¤ì(€Ñ½…ÍÐ (€€€É•ÍÕ±Ð¹ÉÕ±•Í=¹±ä(€€€€€€üƒ‚âW‚â‚âŸ‚â#‚â‚â;‚âc‚âã‚â‚â‚âÓ‚â#‚æ‚â—‚æ'‚âœƒ
Üƒ‚â{‚âh€‘í¹Õ´¡É•ÍÕ±Ð¹•á•ÁÑ¥½¹Ì¹±•¹Ñ ¥ôƒ‚â‚âË‚â‹‚â‚âË‚â‚âW‚æ'‚â·‚â‚â+‚â×‚æ'‚æ‚â#‚âƒ
Üƒ‚â‹‚âÇ‚â‚â‚â·‚æ‚â‚â—‚æ3‚âw‚âÇ‚æ#‚â‚âc‚âg‚âË‚â‚âË‚â‚æ‚â{‚âß‚æ#‚â·‚â#‚âÇ‚âk‚â‚âç‚æ!€(€€€€€€èƒ‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÓ‚æ‚â—‚æ'‚âœ€ ‘í½ÁÑÌ¹É•…Í½¸ñð€‹‚æ‚â‚â—‚æ3‚æ‚â‚æ'‚âË‚æ‚â¯‚â‡‚æ ‰ô¤ƒ
Üƒ‚â#‚âÇ‚âk‚â‚âç‚æ €‘í¹Õ´¡É•ÍÕ±Ð¹µ…Ñ¡•¥ôƒ‚â‚âË‚â‹‚â‚âË‚âŒƒ
Ü•á•ÁÑ¥½¸€‘í¹Õ´¡É•ÍÕ±Ð¹•á•ÁÑ¥½¹Ì¹±•¹Ñ ¥ôƒ
Ü€‘íÉ•ÍÕ±Ð¹•±…ÁÍ•‘5ÍôµÍ€°(€€¤ì(€¥˜€¡ÍÑ…Ñ”¹É½ÕÑ”€ôôô€‰¥µÁ½ÉÐˆñð½ÁÑÌ¹½…Í¡‰½…É¤¼ ‰‘…Í¡‰½…Éˆ¤ì(€•±Í”É•¹‘•È ¤ì)ô()™Õ¹Ñ¥½¸…ÁÁ±åIÕ¹I•ÍÕ±Ð¡É•ÍÕ±Ð°ÍÑ´°‰¼¤ì(€¹•á•ÁÑ¥½¹Ì€ôÉ•ÍÕ±Ð¹•á•ÁÑ¥½¹Ìì(€¹¡½ÕÉ±ä¹™½É…  ¡à°¤¤€ôøì(€€€à¹Ñ½Ñ…°€ôÉ•ÍÕ±Ð¹¡½ÕÉ±åMÑµm¥tì(€€€à¹µ…Ñ¡•€ôÉ•ÍÕ±Ð¹¡½ÕÉ±å5…Ñ¡•‘m¥tì(€€€à¹•á•ÁÑ¥½¸€ô€Àì(€ô¤ì(€É•ÍÕ±Ð¹•á•ÁÑ¥½¹Ì¹™½É…  ¡”¤€ôø¹¡½ÕÉ±åm”¹¡½ÕÉt¹•á•ÁÑ¥½¸¬¬¤ì(€¹‘…µ…•Ì€ô¹‘…µ…•Ì¹™¥±Ñ•È ¡¤€ôø¹å±”€„ôô€‰Äˆ¤ì(€¹ÕÉÉ•¹ÑIÕ¸€ôÉ•ÍÕ±Ðì((€€¼¼%¹Ñ…­”¡•­±¥ÍÐƒ‚â«‚âÃ‚â_‚æ'‚â·‚âg‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚âg‚âÏ‚æ‚â‚æ'‚âË‚â#‚â‚âÓ‚â(€½¹ÍÐÍÉ1…‰•°€ôìÍÑ´è€‰MQ4ƒ‚âc‚âg‚âË‚â‚âË‚âŒˆ°‰¼è€‹‚â‚âË‚â‹‚â‚âË‚âd	<ˆ°Á´è€‰MQ4A4ˆ°Õ¹­¹½Ý¸è€‹‚æ‚â‡‚æ#‚â_‚â‚âË‚âk‚â+‚âg‚âÓ‚âPˆôì(€¹™¥±•Ì€ô%µÁ½ÉÑMÑ…Ñ”¹™¥±•Ì¹µ…À ¡˜¤€ôø€¡ì(€€€¥è˜¹¹…µ”°(€€€½µÁ…¹äè˜¹™½Éµ…Ð¹½µÁ…¹äñð€‰MeLÄÈÌˆ°(€€€½µÁ…¹å9…µ”è€¡¹½µÁ…¹¥•Ì¹™¥¹ ¡Œ¤€ôøŒ¹½‘”€ôôô€¡˜¹™½Éµ…Ð¹½µÁ…¹äñð€‰MeLÄÈÌˆ¤¤ñðíô¤¹¹…µ”ñð˜¹™½Éµ…Ð¹½µÁ…¹äñð€‹‚â‚âÃ‚âk‚âh€ÄÈÌˆ°(€€€™¥±•QåÁ”èÍÉ1…‰•±m˜¹™½Éµ…Ð¹Í½ÕÉ•t€¬€¡˜¹™½Éµ…Ð¹‰…¹¬€ü€€ ‘í˜¹™½Éµ…Ð¹‰…¹­ô¥€€è€ˆˆ¤°(€€€ÍÑ…ÑÕÌè˜¹É•½É‘Ì¹±•¹Ñ €ü€‰É••¥Ù•ˆ€è€‰µ¥ÍÍ¥¹œˆ°(€€€É½ÝÌè˜¹É•½É‘Ì¹±•¹Ñ °(€€€É••¥Ù•‘Ðè¹½ÝMÑ…µÀ ¤¹Í±¥” ÄÄ°€ÄØ¤°(€€€Í•¹‘•Èè€‰•µ…¥°ƒ‚â‚â—‚âË‚âˆ°(€€€¡•­ÍÕ´èMÑÉ¥¹œ¡˜¹Í¥é”¤¹Á…‘MÑ…ÉÐ à°€ˆÀˆ¤¹Í±¥” ´à¤°(€ô¤¤ì(€%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸€ôì(€€€…Ðè¹½ÝMÑ…µÀ ¤°(€€€€¸¸¹É•ÍÕ±Ð°(€€€™¥±•Ìè%µÁ½ÉÑMÑ…Ñ”¹™¥±•Ì¹µ…À ¡˜¤€ôø€¡ì¹…µ”è˜¹¹…µ”°Í½ÕÉ”è˜¹™½Éµ…Ð¹Í½ÕÉ”°‰…¹¬è˜¹™½Éµ…Ð¹‰…¹¬°É•½É‘Ìè˜¹É•½É‘Ì¹±•¹Ñ °‘É½ÁÁ•è˜¹‘É½ÁÁ•ô¤¤°(€ôì(€ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ô€‰¥µÁ½ÉÑ•ˆì(€ÍÑ…Ñ”¹Á…”€ô€Äì(€€¼¨ƒ‚æ‚â—‚âß‚æ#‚â·‚âg‚âW‚âÇ‚âŸ‚â‚â‚â·‚â‚æ‚âo‚â_‚â×‚æ#‚âŸ‚âÇ‚âg‚â_‚â×‚æ#‚â‚â·‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚â_‚â×‚æ#‚æ‚â{‚âÓ‚æ#‚â‚âg‚âÏ‚æ‚â‚æ'‚âÈƒ‚æ‚â‡‚æ#‚â‚âÇ‚æ'‚âg‚â¯‚âg‚æ'‚âË‚â#‚â·‚â#‚âÃ‚âŸ‚æ#‚âË‚â‚æ‚â{‚â‚âË‚âÃ‚â‚â‚â·‚â‚âS‚æ'‚âŸ‚â‹‚âŸ‚âÇ‚âg‚âg‚â×‚æ$€¨¼(€½¹ÍÐ‘…Ñ•Ì€ôl¸¸¹¹•ÜM•Ð¡É•ÍÕ±Ð¹•á•ÁÑ¥½¹Ì¹µ…À ¡”¤€ôø”¹‘…Ñ”¤¹½¹…Ð¡ÍÑ´¹µ…À ¡È¤€ôøÈ¹‘…Ñ”¤°‰¼¹µ…À ¡È¤€ôøÈ¹‘…Ñ”¤¤¹™¥±Ñ•È¡	½½±•…¸¤¥t¹Í½ÉÐ ¤ì(€¥˜€¡‘…Ñ•Ì¹±•¹Ñ ¤ì(€€€½¹ÍÐµ…¥¸€ô‘…Ñ•Ím5…Ñ ¹™±½½È¡‘…Ñ•Ì¹±•¹Ñ €¼€È¥tì(€€€ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹‘…Ñ”€ôµ…¥¸ì(€€€ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½´€ô‘…Ñ•ÍlÁtì(€€€ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹Ñ¼€ô‘…Ñ•Ím‘…Ñ•Ì¹±•¹Ñ €´€Åtì(€€€ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹ÁÉ•Í•Ð€ô‘…Ñ•Ì¹±•¹Ñ €ø€Ä€ü€‰ÕÍÑ½´ˆ€è€‰‘…äˆì(€ô(€±½Ñ¥½¸ ‰…ÕÑ½}É•½¹¥±”ˆ°€‰µ…Ñ¡}ÉÕ¸ˆ°€‰5H´ˆ€¬…Ñ”¹¹½Ü ¤°ƒ‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÐèƒ‚â#‚âÇ‚âk‚â‚âç‚æ €‘íÉ•ÍÕ±Ð¹µ…Ñ¡•‘ôƒ‚â‚âË‚â‹‚â‚âË‚âŒ°•á•ÁÑ¥½¸€‘íÉ•ÍÕ±Ð¹•á•ÁÑ¥½¹Ì¹±•¹Ñ¡ô°€‘íÉ•ÍÕ±Ð¹•±…ÁÍ•‘5ÍôµÍ€¤ì(€É•Ñ…QÉ…­Ì ¤ì(€ÉÕ¹9½Ñ¥™¥…Ñ¥½¹IÕ±•Ì ¤ì(€MÑ½É”¹Á•ÉÍ¥ÍÐ ¤ì)ô()Y%]L¹¥µÁ½ÉÐ€ô€¡É½½Ð¤€ôøì(€½¹ÍÐ¥¹‰½à€ô%µÁ½ÉÑMÑ…Ñ”¹¥¹‰½àñð‰Õ¥±‘%¹‰½à ¤ì(€½¹ÍÐ™¥±•Ì€ô%µÁ½ÉÑMÑ…Ñ”¹™¥±•Ìì(€½¹ÍÐÑ½Ñ…±I•½É‘Ì€ô™¥±•Ì¹É•‘Õ” ¡„°˜¤€ôø„€¬˜¹É•½É‘Ì¹±•¹Ñ °€À¤ì(€½¹ÍÐ¡…ÍMÑ´€ô™¥±•Ì¹Í½µ” ¡˜¤€ôø˜¹™½Éµ…Ð¹Í½ÕÉ”€„ôô€‰‰¼ˆ¤ì(€½¹ÍÐ¡…Í	¼€ô™¥±•Ì¹Í½µ” ¡˜¤€ôø˜¹™½Éµ…Ð¹Í½ÕÉ”€ôôô€‰‰¼ˆ¤ì(€½¹ÍÐÉ•…‘ä€ô…ÕÑ½I•…‘¥¹•ÍÌ ¤ì(€½¹ÍÐÍÉ9…µ”€ôìÍÑ´è€‰MQ4ƒ‚âc‚âg‚âË‚â‚âË‚âŒˆ°‰¼è€‹‚â‚âË‚â‹‚â‚âË‚âd	<ˆ°Á´è€‰MQ4A4ˆ°…Õàè€‹‚â‚âË‚â‹‚â‚âË‚âg‚âo‚â‚âÃ‚â‚â·‚âhˆ°Õ¹­¹½Ý¸è€‹‚æ‚â‡‚æ#‚â_‚â‚âË‚âk‚â+‚âg‚âÓ‚âPˆôì(€€¼¨ƒ‚æ‚â‚â—‚æ3‚â#‚â‚âÓ‚â‚â#‚âË‚â‚æ‚âs‚âg‚â‚æ‚â‡‚æ#‚â‡‚â×‚â‚æ'‚â·‚âk‚â‚â{‚â‚æ#‚â·‚â‚â_‚â×‚æ#‚â#‚â‚æ‚â#‚æ‚â«‚æ#‚æ‚âŸ‚æ$ƒ‚â#‚âÛ‚â‚æ‚â‡‚æ#‚âW‚æ'‚â·‚â‚æ‚â«‚âS‚â‚âW‚âË‚â‚âË‚â‚æ‚â_‚â×‚â‹‚âk‚â‚â·‚â‚æ‚â‚â—‚æ3‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚â€¨¼(€½¹ÍÐÕÍ¥¹I•…±¥±•Ì€ô™¥±•Ì¹Í½µ” ¡˜¤€ôø˜¹™½Éµ…Ð¹É•…±½‘”¤ì((€É½½Ð¹¥¹¹•É!Q50€ô€(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰ÍÑ…ÑÕÌµÍÑÉ¥À™½ÕÈˆø(€€€€€€ñ…ÉÑ¥±”øñÍÁ…¸û‚æ‚â‚â—‚æ3‚æ‚âg‚â‚â—‚æ#‚â·‚â‚â·‚â×‚æ‚â‡‚â”ð½ÍÁ…¸øñÍÑÉ½¹œø‘í¥¹‰½à¹µ•ÍÍ…•Ì¹±•¹Ñ¡ôð½ÍÑÉ½¹œøñÍµ…±°û‚âŸ‚âÇ‚âg‚â_‚â×‚æ €‘í ¡¥¹‰½à¹‘…Ñ”¥ôð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”±…ÍÌôˆ‘í™¥±•Ì¹±•¹Ñ €ü€‰½¬ˆ€è€ˆ‰ôˆøñÍÁ…¸û‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚âg‚âÏ‚æ‚â‚æ'‚âË‚æ‚â—‚æ'‚âœð½ÍÁ…¸øñÍÑÉ½¹œø‘í™¥±•Ì¹±•¹Ñ¡ôð½ÍÑÉ½¹œøñÍµ…±°ø‘í¡…ÍMÑ´€ü€‹‚â‡‚â×‚âw‚âÇ‚æ#‚â‚âc‚âg‚âË‚â‚âË‚âŒˆ€è€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚âw‚âÇ‚æ#‚â‚âc‚âg‚âË‚â‚âË‚âŒ‰ôƒ
Ü€‘í¡…Í	¼€ü€‹‚â‡‚â×‚âw‚âÇ‚æ#‚â	<ˆ€è€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚âw‚âÇ‚æ#‚â	<‰ôð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”øñÍÁ…¸û‚â‚âË‚â‹‚â‚âË‚â‚â_‚â×‚æ ¹½Éµ…±¥é”ƒ‚æ‚â—‚æ'‚âœð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡Ñ½Ñ…±I•½É‘Ì¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚âs‚æ#‚âË‚âg‚â‚â;‚âc‚âg‚âË‚â‚âË‚â‚â_‚â×‚æ#‚æ‚âo‚âÓ‚âS‚æ‚â+‚æ$ð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”±…ÍÌôˆ‘í%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸€ü€‰½¬ˆ€èÉ•…‘ä¹É•…‘ä€ü€‰Ý…É¸ˆ€è€ˆ‰ôˆøñÍÁ…¸û‚âs‚â—‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚â—‚æ#‚âË‚â«‚âã‚âPð½ÍÁ…¸øñÍÑÉ½¹œø‘í%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸€ü%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸¹µ…Ñ¡I…Ñ”¹Ñ½¥á• È¤€¬€ˆ”ˆ€è€ˆ´‰ôð½ÍÑÉ½¹œøñÍµ…±°ø‘í%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸€ü%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸¹•±…ÁÍ•‘5Ì€¬€ˆµÌƒ
Ü€ˆ€¬%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸¹…Ð€è ¡É•…‘ä¹Ý¡ä¥ôð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€ð½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰É¥´Èˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆùµ…¥°%¹•ÍÑ¥½¸ð½Àøñ Èû‚â‚â—‚æ#‚â·‚â‚â·‚â×‚æ‚â‡‚â—‚â‚â—‚âË‚â‚â‚â·‚â‚æ‚âs‚âg‚âð½ Èøð½‘¥Øø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰ÁÕ±±±°ˆû‚âS‚âÛ‚â‚æ‚â‚â—‚æ3‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âPð½‰ÕÑÑ½¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹‰½àµ±¥ÍÐˆø(€€€€€€€€€€‘í¥¹‰½à¹µ•ÍÍ…•Ì(€€€€€€€€€€€€¹µ…À (€€€€€€€€€€€€€€¡´¤€ôø€ñ‘¥Ø±…ÍÌô‰¥¹‰½àµ¥Ñ•´€‘í´¹ÁÕ±±•€ü€‰ÁÕ±±•ˆ€è€ˆ‰ôˆø(€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€ñÍÑÉ½¹œø‘í ¡´¹ÍÕ‰©•Ð¥ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€ñÍÁ…¸ø‘í ¡´¹™É½´¥ôƒ
Ü€‘í ¡´¹™¥±”¹¹…µ”¥ôð½ÍÁ…¸ø(€€€€€€€€€€€€€€ñÍµ…±°ø‘í ¡´¹™¥±”¹¹½Ñ”¥ôð½Íµ…±°ø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹‰½àµ…Ñ¥½¹Ìˆø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰±¥¹¬µ‰Ñ¸ˆ‘…Ñ„µ‘°ôˆ‘í ¡´¹¥¥ôˆû‚âS‚âË‚âŸ‚âg‚æ3‚æ‚â¯‚â—‚âPð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸áÌˆ‘…Ñ„µÁÕ±°ôˆ‘í ¡´¹¥¥ôˆ€‘í´¹ÁÕ±±•€ü€‰‘¥Í…‰±•ˆ€è€ˆ‰ôø‘í´¹ÁÕ±±•€ü€‹‚âS‚âÛ‚â‚æ‚â—‚æ'‚âœˆ€è€‹‚âS‚âÛ‚â‚æ‚â‚æ'‚âË‚â‚âÃ‚âk‚âh‰ôð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ð½‘¥Øù€°(€€€€€€€€€€€€¤(€€€€€€€€€€€€¹©½¥¸ ˆˆ¥ô(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñÀ±…ÍÌô‰¡¥¹Ðˆû‚æ‚â‚â—‚æ3‚æ‚â¯‚â—‚æ#‚âË‚âg‚â×‚æ'‚â[‚âç‚â‚â«‚â‚æ'‚âË‚â‚æ‚â¯‚æ'‚â‡‚â×‚â—‚âÇ‚â‚â§‚âO‚âÃ‚æ‚â¯‚â‡‚âß‚â·‚âg‚æ‚â‚â—‚æ3‚â#‚â‚âÓ‚âƒŠPƒ‚â‡‚â×‚âk‚â‚â‚â_‚âÇ‚âS‚â‹‚â·‚âS‚â‹‚â‚â‡‚âÈ°ƒ‚âk‚â‚â‚â_‚âÇ‚âS‚â‚â·‚âk‚âŸ‚âÇ‚âg‚â_‚â×‚æ °µ…É­•È`Ä½`È½a°ƒ‚â‚âË‚â‹‚â‚âË‚âŒ%1ƒ‚æ‚â—‚âÃ‚âŸ‚âÇ‚âg‚â_‚â×‚æ#‚â‚â·‚â‚âŸ‚âÇ‚âg‚â·‚âß‚æ#‚âg‚âo‚âg‚â‡‚âÈƒ‚æ‚â{‚âß‚æ#‚â·‚æ‚â¯‚æ'‚â_‚âS‚â«‚â·‚âhÁ…ÉÍ•Èƒ‚æ‚â—‚âÃ‚â‚â;‚âc‚âg‚âË‚â‚âË‚â‚æ‚âS‚æ'‚â#‚â‚âÓ‚âƒ‚âS‚âË‚âŸ‚âg‚æ3‚æ‚â¯‚â—‚âS‚æ‚âo‚æ‚âo‚âÓ‚âS‚âS‚âç‚â¯‚â‚âß‚â·‚â·‚âÇ‚âo‚æ‚â¯‚â—‚âS‚â‚â—‚âÇ‚âk‚æ‚â‚æ'‚âË‚â‡‚âË‚â‚æ‚æ‚âS‚æ$ð½Àø(€€€€€€ð½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùUÁ±½…ð½Àøñ Èû‚â·‚âÇ‚âo‚æ‚â¯‚â—‚âS‚æ‚â‚â—‚æ3‚â‚â·‚â‚â‚âã‚âO‚æ‚â·‚âð½ Èøð½‘¥Øøð½‘¥Øø(€€€€€€€€ñ±…‰•°±…ÍÌô‰‘É½Áé½¹”ˆ¥ô‰‘É½Áé½¹”ˆø(€€€€€€€€€€ñ¥¹ÁÕÐÑåÁ”ô‰™¥±”ˆ¥ô‰™¥±•%¹ÁÕÐˆµÕ±Ñ¥Á±”…•ÁÐôˆ¹ÍØ°¹ÑáÐ°¹á±Íà°¹á±Ì°¹Á‘˜ˆ¡¥‘‘•¸€¼ø(€€€€€€€€€€ñÍÑÉ½¹œû‚â—‚âË‚â‚æ‚â‚â—‚æ3‚â‡‚âË‚âŸ‚âË‚âƒ‚â¯‚â‚âß‚â·‚â‚â—‚âÓ‚â‚æ‚â{‚âß‚æ#‚â·‚æ‚â—‚âß‚â·‚â‚æ‚â‚â—‚æ0ð½ÍÑÉ½¹œø(€€€€€€€€€€ñÍÁ…¸û‚â‚â·‚â‚â‚âÇ‚âh€¹á±Íà€¹ÍØƒ‚æ‚â—‚âÀÍÑ…Ñ•µ•¹Ðƒ‚âc‚âg‚âË‚â‚âË‚â‚â_‚â×‚æ#‚æ‚âo‚æ‚âd€¹Á‘˜ƒŠPƒ‚â‚âÃ‚âk‚âk‚â·‚æ#‚âË‚âg‚â¯‚âÇ‚âŸ‚â‚â·‚â—‚âÇ‚â‡‚âg‚æ3‚æ‚â·‚â‚âŸ‚æ#‚âË‚æ‚âo‚æ‚âg‚â‚âË‚â‹‚â‚âË‚âg‚âk‚âÇ‚â7‚â+‚â×‚âw‚âË‚â·‚â[‚â·‚âd°ƒ‚âw‚âË‚â‚â‡‚âß‚â´°ƒ‚â‚â·‚â[‚â·‚âg‚â‚æ#‚âË‚â‚â·‚â„°ƒ‚â[‚â·‚âg‚æ‚â‚â‚âS‚âÓ‚âTƒ‚â¯‚â‚âß‚â´ÍÑ…Ñ•µ•¹Ðƒ‚â‚â·‚â‚âc‚âg‚âË‚â‚âË‚â‚æ‚â¯‚âdð½ÍÁ…¸ø(€€€€€€€€ð½±…‰•°ø((€€€€€€€€ñ‘¥Ø±…ÍÌô‰…ÕÑ¼µ‰…¹¹•È€‘íÉ•…‘ä¹Ñ½¹•ôˆø(€€€€€€€€€€ñ¤øð½¤ø(€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€ñÍÑÉ½¹œø‘íÉ•…‘ä¹É•…‘ä€ü€‹‚â‚âÃ‚âk‚âk‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚æ‚â¯‚æ'‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÐˆ€è€‹‚â‚âÃ‚âk‚âk‚â‹‚âÇ‚â‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚æ‚â‡‚æ#‚æ‚âS‚æ$‰ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€ñÍÁ…¸ø‘í ¡É•…‘ä¹Ý¡ä¥ôð½ÍÁ…¸ø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñÕ°±…ÍÌô‰Ñ¥¬µ±¥ÍÐµÐˆø(€€€€€€€€€€ñ±¤û‚æ‚â‚â—‚æ3‚æ‚â‚æ'‚âË‚â‚âÃ‚âk‚âk‚â‚â‚âk‚â_‚âÇ‚æ'‚â‚âw‚âÇ‚æ#‚â‚âc‚âg‚âË‚â‚âË‚â‚æ‚â—‚âÃ‚âw‚âÇ‚æ#‚â	<ƒŠPƒ‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚â_‚âÇ‚âg‚â_‚âÔð½±¤ø(€€€€€€€€€€ñ±¤û‚â‡‚â×‚æ‚â‚â—‚æ3‚æ‚â{‚âÓ‚æ#‚â‡‚æ‚â‚æ'‚âË‚â‡‚âË‚â_‚â×‚â¯‚â—‚âÇ‚âƒŠPƒ‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚æ‚â¯‚â‡‚æ#‚â_‚âÇ‚æ'‚â‚â+‚âã‚âS‚æ‚âS‚â‹‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÐð½±¤ø(€€€€€€€€€€ñ±¤û‚æ‚âo‚â—‚â×‚æ#‚â‹‚âg‚â‚â;‚âc‚âg‚âË‚â‚âË‚â‚â¯‚â‚âß‚â´Ñ½±•É…¹”ƒŠPƒ‚â·‚æ#‚âË‚âg‚æ‚â‚â—‚æ3‚æ‚âS‚âÓ‚â‡‚æ‚â¯‚â‡‚æ#‚æ‚â—‚æ'‚âŸ‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚æ‚â¯‚â‡‚æ#‚æ‚â¯‚æ'‚æ‚â·‚âð½±¤ø(€€€€€€€€€€ñ±¤û‚â[‚âÛ‚â‚æ‚âŸ‚â—‚âË‚âW‚âË‚â‡‚âW‚âË‚â‚âË‚â‚â_‚â×‚æ#‚âW‚âÇ‚æ'‚â‚æ‚âŸ‚æ$ƒŠPƒ‚âS‚âÛ‚â‚æ‚â‚â—‚æ3‚â#‚âË‚â‚â·‚â×‚æ‚â‡‚â—‚â‚â—‚âË‚â‚æ‚â—‚æ'‚âŸ‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚æ‚â·‚âð½±¤ø(€€€€€€€€ð½Õ°ø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹±¥¹”µ…Ñ¥½¹ÌµÐˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰±•…É¥±•Ìˆ€‘í™¥±•Ì¹±•¹Ñ €ü€ˆˆ€è€‰‘¥Í…‰±•‰ôû‚â—‚æ'‚âË‚â‚æ‚â‚â—‚æ3‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âPð½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰‰…­Q½•µ¼ˆ€‘íÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€‰¥µÁ½ÉÑ•ˆ€ü€ˆˆ€è€‰‘¥Í…‰±•‰ôû‚â‚â—‚âÇ‚âk‚æ‚âo‚æ‚â+‚æ'‚â‚æ'‚â·‚â‡‚âç‚â—‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚âð½‰ÕÑÑ½¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùA…ÉÍ”I•ÍÕ±Ðð½Àøñ Èû‚âs‚â—‚â‚âË‚â‚â·‚æ#‚âË‚âg‚æ‚â‚â—‚æ3‚æ‚â—‚âÃ‚â‚â;‚â_‚â×‚æ#‚â[‚âç‚â‚æ‚â+‚æ$ð½ Èøð½‘¥Øø(€€€€€€€€ñÍÁ…¸±…ÍÌô‰¡•…±Ñ €‘í™¥±•Ì¹±•¹Ñ €ü€‰½¬ˆ€è€‰…ÑÑ•¹Ñ¥½¸‰ôˆø‘í™¥±•Ì¹±•¹Ñ €ü¹Õ´¡Ñ½Ñ…±I•½É‘Ì¤€¬€ˆƒ‚â‚âË‚â‹‚â‚âË‚â‚â{‚â‚æ'‚â·‚â‡‚â#‚âÇ‚âk‚â‚âç‚æ ˆ€è€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚æ‚â‚â—‚æ0‰ôð½ÍÁ…¸ø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…Àˆø(€€€€€€€€ñÑ…‰±”ø(€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ û‚æ‚â‚â—‚æ0ð½Ñ øñÑ û‚â+‚âg‚âÓ‚âS‚â_‚â×‚æ#‚âW‚â‚âŸ‚â#‚æ‚âS‚æ$ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚æ‚â[‚âŸ‚âS‚âÓ‚âhð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚æ‚â+‚æ'‚â#‚âÇ‚âk‚â‚âç‚æ#‚æ‚âS‚æ$ð½Ñ øñÑ û‚â[‚âç‚â‚â‚â‚â·‚â‚â·‚â·‚â‚âS‚æ'‚âŸ‚â‹‚â‚â8ð½Ñ øñÑ øð½Ñ øð½ÑÈøð½Ñ¡•…ø(€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€€‘ì(€€€€€€€€€€€€€™¥±•Ì(€€€€€€€€€€€€€€€€¹µ…À (€€€€€€€€€€€€€€€€€€¡˜¤€ôø€ñÑÈø(€€€€€€€€€€€€€€ñÑøñˆø‘í ¡˜¹¹…µ”¥ôð½ˆø‘í˜¹Ý…É¹¥¹Ì¹±•¹Ñ €ü€ñÍµ…±°±…ÍÌô‰ÍÕˆ‘…¹•Èˆø‘í ¡˜¹Ý…É¹¥¹ÍlÁt¥ôð½Íµ…±°ù€€è€ˆ‰ôð½Ñø(€€€€€€€€€€€€€€ñÑø‘í ¡˜¹™½Éµ…Ð¹É•…±1…‰•°ñðÍÉ9…µ•m˜¹™½Éµ…Ð¹Í½ÕÉ•tñð€ˆˆ¥ô‘í˜¹™½Éµ…Ð¹‰…¹¬€ü€€ñÍÁ…¸±…ÍÌô‰‰…‘”‰±Õ”ˆø‘í ¡˜¹™½Éµ…Ð¹‰…¹¬¥ôð½ÍÁ…¸ù€€è€ˆ‰ô‘í˜¹™½Éµ…Ð¹½µÁ…¹ä€ü€€ñÍÁ…¸±…ÍÌô‰‰…‘”Ù¥½±•Ðˆø‘í ¡˜¹™½Éµ…Ð¹½µÁ…¹ä¥ôð½ÍÁ…¸ù€€è€ˆ‰ô‘í˜¹ÍÕ‰¼ñð˜¹Ñ…½Õ¹Ðñð˜¹ÁÉ½Ù¥‘•È€ü€€ñÍÁ…¸±…ÍÌô‰‰…‘”É••¸ˆÑ¥Ñ±”ô‹‚æ‚â_‚æ‚â‚â#‚âË‚â‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚âk‚âÇ‚â7‚â+‚âÔˆø‘í ¡m˜¹ÍÕ‰¼°˜¹Ñ…½Õ¹Ðñð˜¹ÁÉ½Ù¥‘•Ét¹™¥±Ñ•È¡	½½±•…¸¤¹©½¥¸ ˆƒ
Ü€ˆ¤¥ôð½ÍÁ…¸ù€€è€ˆ‰ôð½Ñø(€€€€€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í¹Õ´¡˜¹É½Ý½Õ¹Ðñð€¡˜¹É•½É‘Ì¹±•¹Ñ €¬€¡˜¹…Õàñðmt¤¹±•¹Ñ ¤¥ôð½Ñø(€€€€€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í¹Õ´¡˜¹É•½É‘Ì¹±•¹Ñ €¬€¡˜¹…Õàñðmt¤¹±•¹Ñ ¥ôð½Ñø(€€€€€€€€€€€€€€ñÑ±…ÍÌô‰ÝÉ…Àˆø‘í=‰©•Ð¹•¹ÑÉ¥•Ì¡˜¹‘É½ÁÁ•¤¹µ…À ¡m¬°Ùt¤€ôø€ñÍÁ…¸±…ÍÌô‰‘É½ÀµÑ…œˆø‘í ¡¬¥ô€‘íÙôð½ÍÁ…¸ù€¤¹©½¥¸ ˆˆ¤ñð€œñÍÁ…¸±…ÍÌô‰µÕÑ•ˆû‚æ‚â‡‚æ#‚â‡‚âÔð½ÍÁ…¸øôð½Ñø(€€€€€€€€€€€€€€ñÑøñ‰ÕÑÑ½¸±…ÍÌô‰±¥¹¬µ‰Ñ¸ˆ‘…Ñ„µÉ´ôˆ‘í ¡˜¹¹…µ”¥ôˆû‚æ‚â·‚âË‚â·‚â·‚âð½‰ÕÑÑ½¸øð½Ñø(€€€€€€€€€€€€ð½ÑÈù€°(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹©½¥¸ ˆˆ¤ñð€ñÑÈøñÑ½±ÍÁ…¸ôˆØˆ±…ÍÌô‰•µÁÑäˆû‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚æ‚â‚â—‚æ0ƒŠPƒ‚âS‚âÛ‚â‚â#‚âË‚â‚â‚â—‚æ#‚â·‚â‚â·‚â×‚æ‚â‡‚â—‚â¯‚â‚âß‚â·‚â·‚âÇ‚âo‚æ‚â¯‚â—‚âS‚æ‚â·‚âð½Ñøð½ÑÈù€(€€€€€€€€€€€ô(€€€€€€€€€€ð½Ñ‰½‘äø(€€€€€€€€ð½Ñ…‰±”ø(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø((€€€€‘ì(€€€€€%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸(€€€€€€€€ü€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆù5…Ñ IÕ¸ð½Àøñ Èû‚âs‚â—‚â‚âË‚â‚â‚âÇ‚âg‚â—‚æ#‚âË‚â«‚âã‚âPð½ Èøð½‘¥ØøñÍÁ…¸±…ÍÌô‰¡•…±Ñ ½¬ˆø‘í ¡‘¥ÍÁ±…åQ¥µ”¡%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸¹…Ð¤¥ôð½ÍÁ…¸øð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰ÉÕ¸µÉ¥ˆø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚â‚âË‚â‹‚â‚âË‚â‚âw‚âÇ‚æ#‚â‚âc‚âg‚âË‚â‚âË‚âŒð½ÍÁ…¸øñˆø‘í¹Õ´¡%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸¹ÍÑµ½Õ¹Ð¥ôð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚â‚âË‚â‹‚â‚âË‚â‚âw‚âÇ‚æ#‚â	<ð½ÍÁ…¸øñˆø‘í¹Õ´¡%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸¹‰½½Õ¹Ð¥ôð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚â#‚âÇ‚âk‚â‚âç‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ð½ÍÁ…¸øñˆø‘í¹Õ´¡%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸¹µ…Ñ¡•¥ôð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚â·‚âÇ‚âW‚â‚âË‚â#‚âÇ‚âk‚â‚âç‚æ ð½ÍÁ…¸øñˆø‘í%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸¹µ…Ñ¡I…Ñ”¹Ñ½¥á• È¥ô”ð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸ùá•ÁÑ¥½¸ð½ÍÁ…¸øñˆø‘í¹Õ´¡%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸¹•á•ÁÑ¥½¹Ì¹±•¹Ñ ¥ôð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚æ‚âŸ‚â—‚âË‚â_‚â×‚æ#‚æ‚â+‚æ$ð½ÍÁ…¸øñˆø‘í%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸¹•±…ÁÍ•‘5ÍôµÌð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚â‚âË‚â‹‚â‚âË‚â‚â+‚æ#‚âŸ‚â€ÈÌèÀÀ´ÈÌèÔäð½ÍÁ…¸øñˆø‘í¹Õ´¡%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸¹É½ÍÍ…å]¥¹‘½Üñð€À¥ôð½ˆøð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€€€ñÀ±…ÍÌô‰¡…ÉÐµ¹½Ñ”ˆû‚â‚âË‚â‹‚â‚âË‚â‚â+‚æ#‚âŸ‚â€ÈÌèÀÀ´ÈÌèÔäƒ‚âW‚æ'‚â·‚â‚âW‚â‚âŸ‚â#‚â‚æ#‚âŸ‚â‡‚â‚âÇ‚âk‚æ‚â‚â—‚æ3‚â‚â·‚â‚âŸ‚âÇ‚âg‚â[‚âÇ‚âS‚æ‚âlƒŠPƒ‚â_‚â×‚æ#‚â#‚âÇ‚âk‚â‚âç‚æ#‚æ‚âS‚æ'‚æ‚â—‚æ'‚âŸ‚â[‚âß‚â·‚âŸ‚æ#‚âË‚âo‚â‚âW‚âÐƒ‚â«‚æ#‚âŸ‚âg‚â_‚â×‚æ#‚â#‚âÇ‚âk‚â‚âç‚æ#‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â#‚âÃ‚â[‚âç‚â‚â‹‚â‚æ‚âo‚æ‚âd•á•ÁÑ¥½¸ƒ‚âo‚â‚âÃ‚æ‚âƒ‚â\€‹‚â‚âË‚â‹‚â‚âË‚â‚â‚æ'‚âË‚â‡‚âŸ‚âÇ‚âdˆð½Àø(€€€€€€ñ‘¥Ø±…ÍÌô‰¡…ÉÐµÐˆ¥ô‰ÉÕ¹	åQåÁ”ˆøð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø((€€€€‘ì(€€€€€€¡%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸¹¹½MÑµM¥‘”ñðmt¤¹±•¹Ñ (€€€€€€€€ü€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆù½Ù•É…”ð½Àøñ Èû‚â+‚æ#‚â·‚â‚â_‚âË‚â‚â_‚â×‚æ#‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚æ‚â‚â—‚æ3‚âw‚âÇ‚æ#‚â‚âc‚âg‚âË‚â‚âË‚âŒð½ Èøð½‘¥Øø(€€€€€€€€ñÍÁ…¸±…ÍÌô‰¡•…±Ñ …ÑÑ•¹Ñ¥½¸ˆø‘í¹Õ´¡%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸¹¹½MÑµ½Õ¹Ðñð€À¥ôƒ‚â‚âË‚â‹‚â‚âË‚â‚â‹‚âÇ‚â‚âW‚â‚âŸ‚â#‚æ‚â‡‚æ#‚æ‚âS‚æ$ð½ÍÁ…¸ø(€€€€€€ð½‘¥Øø(€€€€€€ñÀ±…ÍÌô‰¡…ÉÐµ¹½Ñ”ˆû‚â‚âË‚â‹‚â‚âË‚â‚æ‚â¯‚â—‚æ#‚âË‚âg‚â×‚æ$€ñˆû‚æ‚â‡‚æ#‚â[‚âç‚â‚âg‚âÇ‚âk‚æ‚âo‚æ‚âd•á•ÁÑ¥½¸ð½ˆøƒ‚æ‚â{‚â‚âË‚âÃ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚æ‚â‚â—‚æ0ÍÑ…Ñ•µ•¹Ðƒ‚â‚â·‚â‚â+‚æ#‚â·‚â‚â_‚âË‚â‚âg‚âÇ‚æ'‚âg‚æ‚â¯‚æ'‚æ‚â_‚â×‚â‹‚âhƒ‚â[‚æ'‚âË‚æ‚âS‚æ'‚æ‚â‚â—‚æ3‚â‚â·‚âå‰•ÉÁ±ÕÌ€¼UQ=AH€¼iAdƒ‚â‡‚âË‚æ‚â{‚âÓ‚æ#‚â„ƒ‚â‚âÃ‚âk‚âk‚â#‚âÃ‚â#‚âÇ‚âk‚â‚âç‚æ#‚æ‚â¯‚æ'‚â_‚âÇ‚âg‚â_‚â×‚æ‚âS‚â‹‚æ‚â‡‚æ#‚âW‚æ'‚â·‚â‚âW‚âÇ‚æ'‚â‚â‚æ#‚âË‚â·‚âÃ‚æ‚âŒð½Àø(€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…Àˆø(€€€€€€€€ñÑ…‰±”ø(€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ û‚â+‚æ#‚â·‚â‚â_‚âË‚âð½Ñ øñÑ û‚âk‚â‚âÓ‚â§‚âÇ‚â\ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚â#‚âÏ‚âg‚âŸ‚âg‚â‚âË‚â‹‚â‚âË‚âŒð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚â‹‚â·‚âS‚â‚âŸ‚â„€£‚âk‚âË‚â\¤ð½Ñ øñÑ û‚âk‚âÇ‚â7‚â+‚âÔ¿‚æ‚â_‚â·‚â‚æ3‚â‡‚âÓ‚âg‚âÇ‚â”ð½Ñ øð½ÑÈøð½Ñ¡•…ø(€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€€‘í%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸¹¹½MÑµM¥‘”(€€€€€€€€€€€€€€¹µ…À (€€€€€€€€€€€€€€€€¡œ¤€ôø€ñÑÈø(€€€€€€€€€€€€€€ñÑøñˆø‘í ¡œ¹¡…¹¹•°¥ôð½ˆøð½Ñø(€€€€€€€€€€€€€€ñÑø‘í ¡œ¹½µÁ…¹ä¥ôð½Ñø(€€€€€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í¹Õ´¡œ¹½Õ¹Ð¥ôð½Ñø(€€€€€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘íµ½¹•ä¡œ¹…µ½Õ¹Ð¥ôð½Ñø(€€€€€€€€€€€€€€ñÑ±…ÍÌô‰ÝÉ…ÀˆøñÍÁ…¸±…ÍÌô‰µÕÑ•ˆø‘í ¡œ¹…½Õ¹ÑÌ¹Í±¥” À°€Ð¤¹©½¥¸ ˆ°€ˆ¤¥ô‘íœ¹…½Õ¹ÑÌ¹±•¹Ñ €ø€Ð€ü€ˆ€¬ˆ€¬€¡œ¹…½Õ¹ÑÌ¹±•¹Ñ €´€Ð¤€è€ˆ‰ôð½ÍÁ…¸øð½Ñø(€€€€€€€€€€€€ð½ÑÈù€°(€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€¹©½¥¸ ˆˆ¥ô(€€€€€€€€€€ð½Ñ‰½‘äø(€€€€€€€€ð½Ñ…‰±”ø(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ù€(€€€€€€€€è€ˆˆ(€€€ô((€€€€‘ì(€€€€€ÕÍ¥¹I•…±¥±•Ì(€€€€€€€€ü€ˆˆ(€€€€€€€€è€(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆù¹¥¹”Y…±¥‘…Ñ¥½¸ð½Àøñ Èû‚âW‚â‚âŸ‚â#‚âŸ‚æ#‚âË‚æ‚â‚â‚âß‚æ#‚â·‚â‚â#‚âÇ‚âk‚â‚âç‚æ#‚â_‚âÏ‚â‚âË‚âg‚â[‚âç‚â‚â¯‚â‚âß‚â·‚æ‚â‡‚æ ð½ Èøð½‘¥Øø(€€€€€€€€ñÍÁ…¸±…ÍÌô‰¡•…±Ñ ½¬ˆû‚æ‚â_‚â×‚â‹‚âk‚â‚âÇ‚âk‚â‚æ'‚â·‚âk‚â‚â{‚â‚æ#‚â·‚â‚â_‚â×‚æ#‚â#‚â‚æ‚â#‚æ‚â«‚æ#‚æ‚âŸ‚æ'‚æ‚âg‚æ‚â‚â—‚æ3‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚âð½ÍÁ…¸ø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…Àˆø(€€€€€€€€ñÑ…‰±”ø(€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ û‚âo‚â‚âÃ‚æ‚âƒ‚â\•á•ÁÑ¥½¸ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚æ‚â«‚æ#‚æ‚âŸ‚æ'‚æ‚âg‚æ‚â‚â—‚æ0ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚â‚âÃ‚âk‚âk‚âW‚â‚âŸ‚â#‚â{‚âhð½Ñ øñÑ û‚âs‚â”ð½Ñ øð½ÑÈøð½Ñ¡•…ø(€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€€‘í=‰©•Ð¹•¹ÑÉ¥•Ì¡¥¹‰½à¹•áÁ•Ñ•¤(€€€€€€€€€€€€€€¹™¥±Ñ•È ¡m­t¤€ôø¬€„ôô€‰Ñ½Ñ…°ˆ€˜˜¬€„ôô€‰É½ÍÍ}‘…äˆ¤(€€€€€€€€€€€€€€¹µ…À ¡m¬°Ùt¤€ôøì(€€€€€€€€€€€€€€€½¹ÍÐ™½Õ¹€ô%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸¹•á•ÁÑ¥½¹Ì¹™¥±Ñ•È ¡”¤€ôø”¹ÑåÁ”€ôôô¬¤¹±•¹Ñ ì(€€€€€€€€€€€€€€€½¹ÍÐ½¬€ô™½Õ¹€øôØ€¨€À¸à€˜˜™½Õ¹€ðôØ€¨€Ä¸Øì(€€€€€€€€€€€€€€€É•ÑÕÉ¸€ñÑÈøñÑø‘í ¡¹¥¹”¹QeA}95m­tñð¬¥ôð½ÑøñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘íÙôð½ÑøñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í™½Õ¹‘ôð½Ñø(€€€€€€€€€€€€€€€€€€ñÑøñÍÁ…¸±…ÍÌô‰‰…‘”€‘í½¬€ü€‰É••¸ˆ€è€‰…µ‰•È‰ôˆø‘í½¬€ü€‹‚âW‚â‚â‚âW‚âË‚â‡‚â_‚â×‚æ#‚æ‚â«‚æ#‚æ‚âŸ‚æ$ˆ€è€‹‚âW‚æ#‚âË‚â‚â#‚âË‚â‚â_‚â×‚æ#‚æ‚â«‚æ#‚æ‚âŸ‚æ$‰ôð½ÍÁ…¸øð½Ñøð½ÑÈù€ì(€€€€€€€€€€€€€ô¤(€€€€€€€€€€€€€€¹©½¥¸ ˆˆ¥ô(€€€€€€€€€€ð½Ñ‰½‘äø(€€€€€€€€ð½Ñ…‰±”ø(€€€€€€ð½‘¥Øø(€€€€€€ñÀ±…ÍÌô‰¡…ÉÐµ¹½Ñ”ˆû‚âW‚âÇ‚âŸ‚æ‚â—‚â‚â«‚â·‚â‚âw‚âÇ‚æ#‚â‚æ‚â‡‚æ#‚â#‚âÏ‚æ‚âo‚æ‚âg‚âW‚æ'‚â·‚â‚æ‚â_‚æ#‚âË‚â‚âÇ‚âg‚æ‚âo‚æ+‚âÀƒ‚æ‚â{‚â‚âË‚âÃ‚â‚æ'‚â·‚âk‚â‚â{‚â‚æ#‚â·‚â‚âk‚âË‚â‚â·‚â‹‚æ#‚âË‚â‚â/‚æ'‚â·‚âg‚â‚âÇ‚âg‚æ‚âS‚æ$ƒ‚æ‚â+‚æ#‚âdƒ‚â‚âË‚â‹‚â‚âË‚â‚â_‚â×‚æ#‚â‹‚â·‚âS‚æ‚â‡‚æ#‚âW‚â‚â‚æ‚â—‚âÃ‚â·‚â‹‚âç‚æ#‚â+‚æ#‚âŸ‚â‚â‚æ'‚âË‚â‡‚âŸ‚âÇ‚âg‚â{‚â‚æ'‚â·‚â‡‚â‚âÇ‚âdƒ‚â‚âÃ‚âk‚âk‚â#‚âÛ‚â‚â‹‚â‚æ‚âo‚æ‚âg‚æ‚â‚â«‚âW‚âË‚â‡‚â‚â;‚â_‚â×‚æ#‚â‚âã‚âg‚æ‚â‚â‚â‚âŸ‚æ#‚âÈð½Àø(€€€€ð½Í•Ñ¥½¸ù€(€€€õ€(€€€€€€€€è€ˆˆ(€€€õ€ì((€¥˜€¡%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸¤ì(€€€½¹ÍÐ…œ€ôíôì(€€€%µÁ½ÉÑMÑ…Ñ”¹±…ÍÑIÕ¸¹•á•ÁÑ¥½¹Ì¹™½É…  ¡”¤€ôø€¡…m”¹ÑåÁ•9…µ•t€ô€¡…m”¹ÑåÁ•9…µ•tñð€À¤€¬€Ä¤¤ì(€€€¡…ÉÑÌ¹‘É…Ü ˆÉÕ¹	åQåÁ”ˆ°€‰¡‰…ÉÌˆ°ì(€€€€€±…‰•°è€‰•á•ÁÑ¥½¸ƒ‚â#‚âË‚â‚â‚âË‚â‚â‚âÇ‚âg‚â—‚æ#‚âË‚â«‚âã‚âPˆ°(€€€€€¥Ñ•µÌè=‰©•Ð¹•¹ÑÉ¥•Ì¡…œ¤¹µ…À ¡m¬°Ùt¤€ôø€¡ì±…‰•°è¬°Ù…±Õ”èØô¤¤¹Í½ÉÐ ¡„°ˆ¤€ôøˆ¹Ù…±Õ”€´„¹Ù…±Õ”¤°(€€€€€½±½Èè¡…ÉÑÌ¹A1QQ¹ÌÈ°(€€€€€µ•ÑÉ¥Œè€‹‚â#‚âÏ‚âg‚âŸ‚âg‚æ‚â‚â¨ˆ°(€€€ô¤ì(€ô((€½¹ÍÐÁÕ±°€ô…Íå¹Œ€¡´¤€ôøì(€€€…Ý…¥Ð¥¹•ÍÑI…Ü¡´¹™¥±”¹¹…µ”°´¹™¥±”¹½¹Ñ•¹Ð°´¹™¥±”¹½¹Ñ•¹Ð¹±•¹Ñ ¤ì(€€€´¹ÁÕ±±•€ôÑÉÕ”ì(€ôì((€€ ˆÁÕ±±±°ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°…Íå¹Œ€ ¤€ôøì(€€€Í¡½ÝAÉ½É•ÍÌ ‹‚â‚âÏ‚â—‚âÇ‚â‚âS‚âÛ‚â‚æ‚â—‚âÀÁ…ÉÍ”ƒ‚æ‚â‚â—‚æ0ˆ¤ì(€€€½¹ÍÐÁ•¹‘¥¹œ€ô¥¹‰½à¹µ•ÍÍ…•Ì¹™¥±Ñ•È ¡´¤€ôø€…´¹ÁÕ±±•¤ì(€€€™½È€¡±•Ð¤€ô€Àì¤€ðÁ•¹‘¥¹œ¹±•¹Ñ ì¤¬¬¤ì(€€€€€Í•ÑAÉ½É•ÍÌ ¡¤€¬€Ä¤€¼Á•¹‘¥¹œ¹±•¹Ñ °Á•¹‘¥¹m¥t¹™¥±”¹¹…µ”¤ì(€€€€€…Ý…¥ÐÁÕ±°¡Á•¹‘¥¹m¥t¤ì(€€€€€…Ý…¥Ð¹•ÜAÉ½µ¥Í” ¡È¤€ôøÍ•ÑQ¥µ•½ÕÐ¡È°€ÄÀ¤¤ì(€€€ô(€€€¡¥‘•AÉ½É•ÍÌ ¤ì(€€€Ñ½…ÍÐ¡ƒ‚âS‚âÛ‚â‚æ‚â—‚âÀÁ…ÉÍ”ƒ‚æ‚â‚â—‚æ3‚æ‚â—‚æ'‚âœ€‘íÁ•¹‘¥¹œ¹±•¹Ñ¡ôƒ‚æ‚â‚â—‚æ1€¤ì(€€€É•¹‘•È ¤ì(€€€Í¡•‘Õ±•ÕÑ½I•½¹¥±” ‹‚âS‚âÛ‚â‚æ‚â‚â—‚æ3‚â#‚âË‚â‚â·‚â×‚æ‚â‡‚â—‚â‚â—‚âË‚âˆ¤ì(€ô¤ì((€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µÁÕ±±tˆ¤¹™½É…  ¡ˆ¤€ôø(€€€ˆ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°…Íå¹Œ€ ¤€ôøì(€€€€€½¹ÍÐ´€ô¥¹‰½à¹µ•ÍÍ…•Ì¹™¥¹ ¡à¤€ôøà¹¥€ôôôˆ¹‘…Ñ…Í•Ð¹ÁÕ±°¤ì(€€€€€…Ý…¥ÐÁÕ±°¡´¤ì(€€€€€Ñ½…ÍÐ¡ƒ‚âg‚âÏ‚æ‚â‚æ'‚âÈ€‘í´¹™¥±”¹¹…µ•ôƒ‚æ‚â—‚æ'‚â€¤ì(€€€€€É•¹‘•È ¤ì(€€€€€Í¡•‘Õ±•ÕÑ½I•½¹¥±” ‹‚æ‚â‚â—‚æ0€ˆ€¬´¹™¥±”¹¹…µ”€¬€ˆƒ‚æ‚â‚æ'‚âË‚â‚âÃ‚âk‚âhˆ¤ì(€€€ô¤°(€€¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µ‘±tˆ¤¹™½É…  ¡ˆ¤€ôø(€€€ˆ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€€€½¹ÍÐ´€ô¥¹‰½à¹µ•ÍÍ…•Ì¹™¥¹ ¡à¤€ôøà¹¥€ôôôˆ¹‘…Ñ…Í•Ð¹‘°¤ì(€€€€€‘½Ý¹±½…‘Q•áÐ¡´¹™¥±”¹¹…µ”°´¹™¥±”¹½¹Ñ•¹Ð¤ì(€€€ô¤°(€€¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µÉµtˆ¤¹™½É…  ¡ˆ¤€ôø(€€€ˆ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€€€%µÁ½ÉÑMÑ…Ñ”¹™¥±•Ì€ô%µÁ½ÉÑMÑ…Ñ”¹™¥±•Ì¹™¥±Ñ•È ¡˜¤€ôø˜¹¹…µ”€„ôôˆ¹‘…Ñ…Í•Ð¹É´¤ì(€€€€€É•¹‘•È ¤ì(€€€ô¤°(€€¤ì((€½¹ÍÐ‘è€ô€ ˆ‘É½Áé½¹”ˆ¤ì(€½¹ÍÐ¥¹ÁÕÐ€ô€ ˆ™¥±•%¹ÁÕÐˆ¤ì(€‘è¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø¥¹ÁÕÐ¹±¥¬ ¤¤ì(€l‰‘É…•¹Ñ•Èˆ°€‰‘É…½Ù•È‰t¹™½É…  ¡•Ø¤€ôø(€€€‘è¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È¡•Ø°€¡”¤€ôøì(€€€€€”¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€€€‘è¹±…ÍÍ1¥ÍÐ¹…‘ ‰½Ù•Èˆ¤ì(€€€ô¤°(€€¤ì(€l‰‘É…±•…Ù”ˆ°€‰‘É½À‰t¹™½É…  ¡•Ø¤€ôø(€€€‘è¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È¡•Ø°€¡”¤€ôøì(€€€€€”¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€€€‘è¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰½Ù•Èˆ¤ì(€€€ô¤°(€€¤ì(€½¹ÍÐ¡…¹‘±•¥±•Ì€ô…Íå¹Œ€¡±¥ÍÐ¤€ôøì(€€€Í¡½ÝAÉ½É•ÍÌ ‹‚â‚âÏ‚â—‚âÇ‚â‚â·‚æ#‚âË‚âg‚æ‚â‚â—‚æ0ˆ¤ì(€€€™½È€¡±•Ð¤€ô€Àì¤€ð±¥ÍÐ¹±•¹Ñ ì¤¬¬¤ì(€€€€€½¹ÍÐ˜€ô±¥ÍÑm¥tì(€€€€€Í•ÑAÉ½É•ÍÌ ¡¤€¬€Ä¤€¼±¥ÍÐ¹±•¹Ñ °˜¹¹…µ”¤ì(€€€€€ÑÉäì(€€€€€€€½¹ÍÐÁ…å±½…€ô€½p¸¡á±Íáñá±Íµñá±ÍñÁ‘˜¤½¤¹Ñ•ÍÐ¡˜¹¹…µ”¤€ü…Ý…¥ÐÉ•…‘¥±•	Õ™™•È¡˜¤€è…Ý…¥ÐÉ•…‘¥±•Q•áÐ¡˜¤ì(€€€€€€€…Ý…¥Ð¥¹•ÍÑI…Ü¡˜¹¹…µ”°Á…å±½…°˜¹Í¥é”¤ì(€€€€€ô…Ñ €¡•ÉÈ¤ì(€€€€€€€Ñ½…ÍÐ¡€‘í˜¹¹…µ•ôè€‘í•ÉÈ¹µ•ÍÍ…•õ€°€‰Ý…É¸ˆ¤ì(€€€€€ô(€€€ô(€€€¡¥‘•AÉ½É•ÍÌ ¤ì(€€€É•¹‘•È ¤ì(€€€Í¡•‘Õ±•ÕÑ½I•½¹¥±”¡ƒ‚â·‚âÇ‚âo‚æ‚â¯‚â—‚âP€‘í±¥ÍÐ¹±•¹Ñ¡ôƒ‚æ‚â‚â—‚æ1€¤ì(€ôì(€‘è¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰‘É½Àˆ°€¡”¤€ôø¡…¹‘±•¥±•Ì¡l¸¸¹”¹‘…Ñ…QÉ…¹Í™•È¹™¥±•Ít¤¤ì(€¥¹ÁÕÐ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¡…¹”ˆ°€¡”¤€ôø¡…¹‘±•¥±•Ì¡l¸¸¹”¹Ñ…É•Ð¹™¥±•Ít¤¤ì((€€ ˆ±•…É¥±•Ìˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€%µÁ½ÉÑMÑ…Ñ”¹™¥±•Ì€ômtì(€€€É•¹‘•È ¤ì(€€€ÕÁ‘…Ñ•ÕÑ½MÑ…ÑÕÌ ¤ì(€ô¤ì(€€ ˆ‰…­Q½•µ¼ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€±½…Ñ¥½¸¹É•±½… ¤ì(€ô¤ì)ôì((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€A¡…Í”€ÐƒŠPƒ‚â‚âË‚â‚æ‚â#‚æ'‚â‚æ‚âW‚âß‚â·‚âd(€€€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸ÉÕ¹9½Ñ¥™¥…Ñ¥½¹IÕ±•Ì ¤ì(€½¹ÍÐÈ€ôMÑ½É”¹‘…Ñ„¹¹½Ñ¥™åIÕ±•Ìì(€¥˜€¡È¹™¥±•5¥ÍÍ¥¹œ¤ì(€€€½¹ÍÐ‰…€ô¹™¥±•Ì¹™¥±Ñ•È ¡˜¤€ôø˜¹ÍÑ…ÑÕÌ€ôôô€‰µ¥ÍÍ¥¹œˆñð˜¹ÍÑ…ÑÕÌ€ôôô€‰ÝÉ½¹}½µÁ…¹äˆ¤ì(€€€¥˜€¡‰…¹±•¹Ñ ¤MÑ½É”¹¹½Ñ¥™ä ‰‰…ˆ°ƒ‚æ‚â‚â—‚æ3‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‚â‚âh€‘í‰…¹±•¹Ñ¡ôƒ‚â‚âË‚â‹‚â‚âË‚â€°‰…¹µ…À ¡ˆ¤€ôø€‘íˆ¹½µÁ…¹å9…µ•ô€´€‘íˆ¹™¥±•QåÁ•õ€¤¹©½¥¸ ˆ°€ˆ¤°€‰¥¹Ñ…­”ˆ¤ì(€ô(€¥˜€¡È¹É¥Ñ¥…±á•ÁÑ¥½¸¤ì(€€€½¹ÍÐÉ¥Ð€ô¹•á•ÁÑ¥½¹Ì¹™¥±Ñ•È ¡”¤€ôø”¹Í•Ù•É¥Ñä€ôôô€‰É¥Ñ¥…°ˆ€˜˜€…l‰±½Í•ˆ°€‰…ÁÁÉ½Ù•‰t¹¥¹±Õ‘•Ì¡”¹ÍÑ…ÑÕÌ¤¤ì(€€€¥˜€¡É¥Ð¹±•¹Ñ ¤MÑ½É”¹¹½Ñ¥™ä ‰‰…ˆ°ƒ‚â{‚âh•á•ÁÑ¥½¸ƒ‚â‚âÃ‚âS‚âÇ‚âhÉ¥Ñ¥…°€‘íÉ¥Ð¹±•¹Ñ¡ôƒ‚â‚âË‚â‹‚â‚âË‚â€°ƒ‚â‹‚â·‚âS‚â_‚â×‚æ#‚âW‚æ'‚â·‚â‚âW‚â‚âŸ‚â#‚â‚âŸ‚â„€‘íµ½¹•äÀ¡ÍÕµI¥Í¬¡É¥Ð¤¥ôƒ‚âk‚âË‚â]€°€‰•á•ÁÑ¥½¹Ìˆ¤ì(€ô(€¥˜€¡È¹Í±…	É•… ¤ì(€€€½¹ÍÐ½Ù•È€ô¹•á•ÁÑ¥½¹Ì¹™¥±Ñ•È ¡”¤€ôø”¹½Ù•ÉM±„€˜˜€…l‰±½Í•ˆ°€‰…ÁÁÉ½Ù•‰t¹¥¹±Õ‘•Ì¡”¹ÍÑ…ÑÕÌ¤¤ì(€€€¥˜€¡½Ù•È¹±•¹Ñ ¤MÑ½É”¹¹½Ñ¥™ä ‰Ý…É¸ˆ°ƒ‚æ‚â‚â«‚æ‚â—‚âˆM1€‘í½Ù•È¹±•¹Ñ¡ôƒ‚â‚âË‚â‹‚â‚âË‚â€°€‹‚âW‚æ'‚â·‚â‚æ‚â‚æ#‚â‚âW‚âÓ‚âS‚âW‚âË‚â‡‚â+‚â×‚æ'‚æ‚â#‚â‚âƒ‚âË‚â‹‚æ‚âg‚âŸ‚âÇ‚âg‚âg‚â×‚æ$ˆ°€‰•á•ÁÑ¥½¹Ìˆ¤ì(€ô(€ÕÁ‘…Ñ•	•±° ¤ì)ô()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•	•±° ¤ì(€½¹ÍÐ¸€ôÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€‰ÁÉ½‘ÕÑ¥½¸ˆ€˜˜±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹¹½Ñ¥™¥…Ñ¥½¹Ì€ü±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹¹½Ñ¥™¥…Ñ¥½¹Ì¹™¥±Ñ•È ¡É½Ü¤€ôø€…É½Ü¹É•…‘}…Ð¤¹±•¹Ñ €èMÑ½É”¹Õ¹É•… ¤ì(€½¹ÍÐˆ€ô€ ˆ‰•±±½Õ¹Ðˆ¤ì(€¥˜€ …ˆ¤É•ÑÕÉ¸ì(€ˆ¹Ñ•áÑ½¹Ñ•¹Ð€ô¸€ø€ää€ü€ˆää¬ˆ€è¸ì(€ˆ¹¡¥‘‘•¸€ô¸€ôôô€Àì)ô()™Õ¹Ñ¥½¸É•¹‘•É1¥Ù•9½Ñ¥™¥…Ñ¥½¹Ì¡É½½Ð¤ì(€¥˜€ …•¹ÍÕÉ•1¥Ù•=Ù•ÉÙ¥•Ü¡É½½Ð¤¤É•ÑÕÉ¸ì(€½¹ÍÐ±¥ÍÐ€ô±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹¹½Ñ¥™¥…Ñ¥½¹Ìñðmtì(€½¹ÍÐÑ½¹”€ôì¥¹™¼è€‰‰±Õ”ˆ°Ý…É¹¥¹œè€‰…µ‰•Èˆ°•ÉÉ½Èè€‰É•ˆ°ÍÕ•ÍÌè€‰É••¸ˆôì(€É½½Ð¹¥¹¹•É!Q50€ô€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùMÕÁ…‰…Í”É•½¹}¹½Ñ¥™¥…Ñ¥½¹Ìð½Àøñ Èû‚â‚âË‚â‚æ‚â#‚æ'‚â‚æ‚âW‚âß‚â·‚âg‚â#‚â‚âÓ‚â€ ‘í¹Õ´¡±¥ÍÐ¹±•¹Ñ ¥ô¤ð½ ÈøñÍµ…±°±…ÍÌô‰¡•…µÍÕˆˆû‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â·‚æ#‚âË‚âd€‘í¹Õ´¡±¥ÍÐ¹™¥±Ñ•È ¡É½Ü¤ôø…É½Ü¹É•…‘}…Ð¤¹±•¹Ñ ¥ôð½Íµ…±°øð½‘¥Øøñ‘¥Ø±…ÍÌô‰¥¹±¥¹”µ…Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰±¥Ù•9½Ñ¥™I•™É•Í ˆû‚â‚â×‚æ‚â‚â‚â(ð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰±¥Ù•9½Ñ¥™I•…ˆû‚â·‚æ#‚âË‚âg‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âPð½‰ÕÑÑ½¸øð½‘¥Øøð½‘¥Øø(€€€€ñ‘¥Ø±…ÍÌô‰¹½Ñ¥˜µ±¥ÍÐˆø‘í±¥ÍÐ¹µ…À ¡É½Ü¤ôù€ñ‘¥Ø±…ÍÌô‰¹½Ñ¥˜€‘íÉ½Ü¹É•…‘}…Ðüˆˆè‰Õ¹É•…‰ôˆøñÍÁ…¸±…ÍÌô‰‰…‘”€‘íÑ½¹•mÉ½Ü¹±•Ù•±uñð‰É•ä‰ôˆø‘í ¡É½Ü¹±•Ù•°¥ôð½ÍÁ…¸øñ‘¥ØøñÍÑÉ½¹œø‘í ¡É½Ü¹Ñ¥Ñ±”¥ôð½ÍÑÉ½¹œøñÍÁ…¸ø‘í ¡É½Ü¹‘•Ñ…¥±ñðˆˆ¥ôð½ÍÁ…¸øñÍµ…±°ø‘í ¡‘¥ÍÁ±…åQ¥µ”¡É½Ü¹É•…Ñ•‘}…Ð¤¥ô‘íÉ½Ü¹½µÁ…¹äý€ƒ
Ü€‘í ¡É½Ü¹½µÁ…¹ä¥õ€èˆ‰ôð½Íµ…±°øð½‘¥Øø‘íÉ½Ü¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”ý€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸áÌˆ‘…Ñ„µ¹½Ñ¥˜µ‘…Ñ”ôˆ‘í ¡É½Ü¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”¥ôˆ‘…Ñ„µ¹½Ñ¥˜µ½µÁ…¹äôˆ‘í ¡É½Ü¹½µÁ…¹åñð‰10ˆ¥ôˆû‚æ‚âo‚âÓ‚âS‚âS‚âäð½‰ÕÑÑ½¸ù€èˆ‰ôð½‘¥Øù€¤¹©½¥¸ ˆˆ¥ññ€ñÀ±…ÍÌô‰•µÁÑäˆû‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚â‚âË‚â‚æ‚â#‚æ'‚â‚æ‚âW‚âß‚â·‚âg‚â#‚âË‚â‚â‚âÃ‚âk‚âhð½Àùôð½‘¥Øø(€€€€ñÀ±…ÍÌô‰¡¥¹Ðˆû‚â‚âË‚â‹‚â‚âË‚â‚âg‚â×‚æ'‚â·‚æ#‚âË‚âg‚â#‚âË‚â‚âC‚âË‚âg‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚â‚âÓ‚âƒ‚â‚âË‚â‚æ‚â#‚æ'‚âQ•±•É…´ƒ‚â_‚âÏ‚â‚âË‚âg‚â#‚âË‚â¸á¸ƒ‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â#‚âÏ‚â—‚â·‚â‚æ‚âg‚æ‚âk‚â‚âË‚âŸ‚æ3‚æ‚â/‚â·‚â‚æ0ð½Àø(€€ð½Í•Ñ¥½¸ù€ì(€€ ˆ±¥Ù•9½Ñ¥™I•™É•Í ˆ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ° ¤ôù±½…‘1¥Ù•=Ù•ÉÙ¥•Ü¡ÑÉÕ”¤¤ì(€€ ˆ±¥Ù•9½Ñ¥™I•…ˆ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±…Íå¹Œ ¤ôùì(€€€½¹ÍÐÕ¹É•…õ±¥ÍÐ¹™¥±Ñ•È ¡É½Ü¤ôø…É½Ü¹É•…‘}…Ð¤ì¥˜ …Õ¹É•…¹±•¹Ñ ¥É•ÑÕÉ¸Ñ½…ÍÐ ‹‚â·‚æ#‚âË‚âg‚â‚â‚âk‚æ‚â—‚æ'‚âœˆ¤ì(€€€…Ý…¥ÐAÉ½µ¥Í”¹…±°¡Õ¹É•…¹µ…À ¡É½Ü¤ôùMˆ¹Á…Ñ  ‰É•½¹}¹½Ñ¥™¥…Ñ¥½¹Ìˆ±¥õ•Ä¸‘íÉ½Ü¹¥‘õ€±íÉ•…‘}…Ðé¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¥ô¤¤¤ì(€€€…Ý…¥Ð±½…‘1¥Ù•=Ù•ÉÙ¥•Ü¡ÑÉÕ”¤ìÑ½…ÍÐ ‹‚â_‚âÏ‚æ‚â‚â‚âß‚æ#‚â·‚â‚â¯‚â‡‚âË‚â‹‚â·‚æ#‚âË‚âg‚æ‚â—‚æ'‚âœˆ¤ì(€ô¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µ¹½Ñ¥˜µ‘…Ñ•tˆ¤¹™½É…  ¡‰ÕÑÑ½¸¤ôù‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ° ¤ôùíÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹‘…Ñ”õ‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹¹½Ñ¥™…Ñ”íÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½´õ‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹¹½Ñ¥™…Ñ”íÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹Ñ¼õ‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹¹½Ñ¥™…Ñ”íÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹äõ‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹¹½Ñ¥™½µÁ…¹åñð‰10ˆíÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹ÁÉ•Í•Ðô‰‘…äˆí¼ ‰‘…Í¡‰½…Éˆ¤íô¤¤ì)ô()Y%]L¹¹½Ñ¥™¥…Ñ¥½¹Ì€ô€¡É½½Ð¤€ôøì(€¥˜€¡ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€‰ÁÉ½‘ÕÑ¥½¸ˆ€˜˜Mˆ¹Í¥¹•‘%¸ ¤¤ì(€€€É•¹‘•É1¥Ù•9½Ñ¥™¥…Ñ¥½¹Ì¡É½½Ð¤ì(€€€É•ÑÕÉ¸ì(€ô(€½¹ÍÐ±¥ÍÐ€ôMÑ½É”¹‘…Ñ„¹¹½Ñ¥™¥…Ñ¥½¹Ìì(€½¹ÍÐÉÕ±•Ì€ôMÑ½É”¹‘…Ñ„¹¹½Ñ¥™åIÕ±•Ìì(€½¹ÍÐ­¥¹‘Q½¹”€ôì‰…è€‰É•ˆ°Ý…É¸è€‰…µ‰•Èˆ°¥¹™¼è€‰‰±Õ”ˆ°½¬è€‰É••¸ˆ°™àè€‰Ù¥½±•Ðˆôì(€½¹ÍÐ­¥¹‘1…‰•°€ôì‰…è€‹‚âW‚æ'‚â·‚â‚æ‚â‚æ'‚â_‚âÇ‚âg‚â_‚âÔˆ°Ý…É¸è€‹‚æ‚âw‚æ'‚âË‚â‚âÃ‚âŸ‚âÇ‚âˆ°¥¹™¼è€‹‚æ‚â#‚æ'‚â‚æ‚â¯‚æ'‚â_‚â‚âË‚âhˆ°½¬è€‹‚âo‚â‚âW‚âÐˆôì((€É½½Ð¹¥¹¹•É!Q50€ô€(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰É¥´Èˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆù%¹‰½àð½Àøñ Èû‚â‚âË‚â‚æ‚â#‚æ'‚â‚æ‚âW‚âß‚â·‚âd€ ‘í±¥ÍÐ¹±•¹Ñ¡ô¤ð½ Èøð½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹±¥¹”µ…Ñ¥½¹Ìˆø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰¹¡•¬ˆû‚âW‚â‚âŸ‚â#‚æ‚â‚âß‚æ#‚â·‚âg‚æ‚â‚æ‚âS‚â×‚æ/‚â‹‚âŸ‚âg‚â×‚æ$ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸Í´ˆ¥ô‰¹I•…ˆû‚â_‚âÏ‚æ‚â‚â‚âß‚æ#‚â·‚â‚â¯‚â‡‚âË‚â‹‚â·‚æ#‚âË‚âg‚æ‚â—‚æ'‚âœð½‰ÕÑÑ½¸ø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¹½Ñ¥˜µ±¥ÍÐˆø(€€€€€€€€€€‘ì(€€€€€€€€€€€±¥ÍÐ(€€€€€€€€€€€€€€¹µ…À (€€€€€€€€€€€€€€€€¡¸¤€ôø€ñ‘¥Ø±…ÍÌô‰¹½Ñ¥˜€‘í¸¹É•…€ü€ˆˆ€è€‰Õ¹É•…‰ôˆø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰‰…‘”€‘í­¥¹‘Q½¹•m¸¹­¥¹‘uôˆø‘í­¥¹‘1…‰•±m¸¹­¥¹‘uôð½ÍÁ…¸ø(€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€ñÍÑÉ½¹œø‘í ¡¸¹Ñ¥Ñ±”¥ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€ñÍÁ…¸ø‘í ¡¸¹‘•Ñ…¥°¥ôð½ÍÁ…¸ø(€€€€€€€€€€€€€€ñÍµ…±°ø‘í ¡‘¥ÍÁ±…åQ¥µ”¡¸¹…Ð¤¥ôð½Íµ…±°ø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€‘í¸¹±¥¹¬€ü€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸áÌˆ‘…Ñ„µ¹±¥¹¬ôˆ‘í ¡¸¹±¥¹¬¥ôˆû‚æ‚âo‚âÓ‚âS‚âS‚âäð½‰ÕÑÑ½¸ù€€è€ˆ‰ô(€€€€€€€€€€ð½‘¥Øù€°(€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€¹©½¥¸ ˆˆ¤ñð€ñÀ±…ÍÌô‰•µÁÑäˆû‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚â‚âË‚â‚æ‚â#‚æ'‚â‚æ‚âW‚âß‚â·‚âdð½Àù€(€€€€€€€€€ô(€€€€€€€€ð½‘¥Øø(€€€€€€ð½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùIÕ±•Ìð½Àøñ Èû‚æ‚â‚âß‚æ#‚â·‚âg‚æ‚â‚æ‚â—‚âÃ‚â+‚æ#‚â·‚â‚â_‚âË‚âð½ Èøð½‘¥Øøð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ½±”µ±¥ÍÐˆø(€€€€€€€€€€‘íl(€€€€€€€€€€€l‰™¥±•5¥ÍÍ¥¹œˆ°€‹‚æ‚â#‚æ'‚â‚æ‚â‡‚âß‚æ#‚â·‚æ‚â‚â—‚æ3‚â‚âË‚âS‚â¯‚â‚âß‚â·‚â«‚æ#‚â‚âs‚âÓ‚âS‚âk‚â‚âÓ‚â§‚âÇ‚â\‰t°(€€€€€€€€€€€l‰É¥Ñ¥…±á•ÁÑ¥½¸ˆ°€‹‚æ‚â#‚æ'‚â‚æ‚â‡‚âß‚æ#‚â·‚â{‚âh•á•ÁÑ¥½¸ƒ‚â‚âÃ‚âS‚âÇ‚âhÉ¥Ñ¥…°‰t°(€€€€€€€€€€€l‰Í±…	É•… ˆ°€‹‚æ‚â#‚æ'‚â‚æ‚â‡‚âß‚æ#‚â·‚â‡‚â×‚æ‚â‚â«‚æ‚â—‚âˆM1‰t°(€€€€€€€€€t(€€€€€€€€€€€€¹µ…À ¡m¬°±t¤€ôø€ñ±…‰•°øñ¥¹ÁÕÐÑåÁ”ô‰¡•­‰½àˆ‘…Ñ„µ¹ÉÕ±”ôˆ‘í­ôˆ€‘íÉÕ±•Ím­t€ü€‰¡•­•ˆ€è€ˆ‰ô€¼ø€‘í ¡°¥ôð½±…‰•°ù€¤(€€€€€€€€€€€€¹©½¥¸ ˆˆ¥ô(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ Ì±…ÍÌô‰‘É…Ý•Èµ Ìˆû‚â+‚æ#‚â·‚â‚â_‚âË‚â‚â«‚æ#‚âð½ Ìø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ½±”µ±¥ÍÐˆø(€€€€€€€€€€‘íl(€€€€€€€€€€€l‰¡…¹¹•±%¹ÁÀˆ°€‹‚æ‚â«‚âS‚â‚æ‚âg‚â‚âÃ‚âk‚âh€£‚â‚â‚âÃ‚âS‚âÓ‚æ#‚â‚â‡‚âã‚â‡‚âk‚âg‚â‚âŸ‚âÈ¤‰t°(€€€€€€€€€€€l‰¡…¹¹•±µ…¥°ˆ°€‹‚â«‚æ#‚â‚â·‚â×‚æ‚â‡‚â—‚â[‚âÛ‚â‚âs‚âç‚æ'‚â‚âÇ‚âk‚âs‚âÓ‚âS‚â+‚â·‚âh‰t°(€€€€€€€€€€€l‰¡…¹¹•±Q•±•É…´ˆ°€‹‚â«‚æ#‚âQ•±•É…´ƒ‚æ‚â‡‚âß‚æ#‚â´Í•Ù•É¥Ñäƒ‚â«‚âç‚â‰t°(€€€€€€€€€t(€€€€€€€€€€€€¹µ…À ¡m¬°±t¤€ôø€ñ±…‰•°øñ¥¹ÁÕÐÑåÁ”ô‰¡•­‰½àˆ‘…Ñ„µ¹ÉÕ±”ôˆ‘í­ôˆ€‘íÉÕ±•Ím­t€ü€‰¡•­•ˆ€è€ˆ‰ô€¼ø€‘í ¡°¥ôð½±…‰•°ù€¤(€€€€€€€€€€€€¹©½¥¸ ˆˆ¥ô(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñÀ±…ÍÌô‰¡¥¹Ðˆû‚æ‚âg‚â‚âÃ‚âk‚âk‚â#‚â‚âÓ‚âƒ‚â+‚æ#‚â·‚â‚â_‚âË‚â‚â·‚â×‚æ‚â‡‚â—‚æ‚â—‚âÀQ•±•É…´ƒ‚â#‚âÃ‚â‹‚âÓ‚â‚â#‚âË‚â‚âw‚âÇ‚æ#‚â‰…­•¹ƒ‚âW‚â·‚âg‚âg‚â×‚æ'‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âË‚â‚âW‚âÇ‚æ'‚â‚â‚æ#‚âË‚æ‚âŸ‚æ'‚æ‚â—‚âÃ‚æ‚â«‚âS‚â‚âs‚â—‚æ‚âg‚â‚âÃ‚âk‚âk‚æ‚â_‚æ#‚âË‚âg‚âÇ‚æ'‚âdð½Àø(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ù€ì((€€ ˆ¹¡•¬ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€ÉÕ¹9½Ñ¥™¥…Ñ¥½¹IÕ±•Ì ¤ì(€€€Ñ½…ÍÐ ‹‚âW‚â‚âŸ‚â#‚æ‚â‚âß‚æ#‚â·‚âg‚æ‚â‚æ‚â—‚âÃ‚â«‚â‚æ'‚âË‚â‚â‚âË‚â‚æ‚â#‚æ'‚â‚æ‚âW‚âß‚â·‚âg‚æ‚â¯‚â‡‚æ#‚æ‚â—‚æ'‚âœˆ¤ì(€€€É•¹‘•È ¤ì(€ô¤ì(€€ ˆ¹I•…ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€MÑ½É”¹µ…É­±±I•… ¤ì(€€€ÕÁ‘…Ñ•	•±° ¤ì(€€€É•¹‘•È ¤ì(€ô¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µ¹ÉÕ±•tˆ¤¹™½É…  ¡Œ¤€ôø(€€€Œ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¡…¹”ˆ°€ ¤€ôøì(€€€€€MÑ½É”¹‘…Ñ„¹¹½Ñ¥™åIÕ±•ÍmŒ¹‘…Ñ…Í•Ð¹¹ÉÕ±•t€ôŒ¹¡•­•ì(€€€€€MÑ½É”¹Á•ÉÍ¥ÍÐ ¤ì(€€€€€Ñ½…ÍÐ ‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âË‚â‚âW‚âÇ‚æ'‚â‚â‚æ#‚âË‚æ‚â#‚æ'‚â‚æ‚âW‚âß‚â·‚âg‚æ‚â—‚æ'‚âœˆ¤ì(€€€ô¤°(€€¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µ¹±¥¹­tˆ¤¹™½É…  ¡ˆ¤€ôøˆ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø¼¡ˆ¹‘…Ñ…Í•Ð¹¹±¥¹¬¤¤¤ì)ôì((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€A¡…Í”€ÐƒŠPƒ‚âW‚âÇ‚æ'‚â‚æ‚âŸ‚â—‚âÈ°É•Ñ•¹Ñ¥½¸°Á•É™½Éµ…¹”(€€€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()±•ÐÍ¡•‘Õ±•Q¥µ•È€ô¹Õ±°ì)±•Ð±½Õ‘]½É­•ÉQ¥µ•È€ô¹Õ±°ì()™Õ¹Ñ¥½¸‰…¹­½­…Ñ”¡½™™Í•Ñ…åÌ€ô€À¤ì(€½¹ÍÐÁ…ÉÑÌ€ô¹•Ü%¹Ñ°¹…Ñ•Q¥µ•½Éµ…Ð ‰•¸µˆ°ìÑ¥µ•i½¹”è€‰Í¥„½	…¹­½¬ˆ°å•…Èè€‰¹Õµ•É¥Œˆ°µ½¹Ñ è€ˆÈµ‘¥¥Ðˆ°‘…äè€ˆÈµ‘¥¥Ðˆô¤¹™½Éµ…ÑQ½A…ÉÑÌ¡¹•Ü…Ñ” ¤¤ì(€½¹ÍÐ‰…Í”€ô€‘íÁ…ÉÑÌ¹™¥¹ ¡À¤€ôøÀ¹ÑåÁ”€ôôô€‰å•…Èˆ¤¹Ù…±Õ•ô´‘íÁ…ÉÑÌ¹™¥¹ ¡À¤€ôøÀ¹ÑåÁ”€ôôô€‰µ½¹Ñ ˆ¤¹Ù…±Õ•ô´‘íÁ…ÉÑÌ¹™¥¹ ¡À¤€ôøÀ¹ÑåÁ”€ôôô€‰‘…äˆ¤¹Ù…±Õ•õ€ì(€½¹ÍÐ€ô¹•Ü…Ñ”¡‰…Í”€¬€‰PÀÀèÀÀèÀÁhˆ¤ì(€¹Í•ÑUQ…Ñ”¡¹•ÑUQ…Ñ” ¤€¬½™™Í•Ñ…åÌ¤ì(€É•ÑÕÉ¸¹Ñ½%M=MÑÉ¥¹œ ¤¹Í±¥” À°€ÄÀ¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸±½Õ‘]½É­•ÉQ¥¬ ¤ì(€€¼¼±½Õ½Ý¹Ì…ÕÑ½µ…Ñ¥Œ©½‰Ì¸	É½ÝÍ•ÉÌµÕÍÐ¹•Ù•È±…¥´Ñ¡”Í…µ”ÅÕ•Õ”è(€€¼¼ÕÍ•ÈµÍ½Á•I1L…¹ÍÑ…±”Ñ…‰Ì…¸½Ñ¡•ÉÝ¥Í”™…¥°„©½ˆ‰•™½É”¸á¸Í••Ì¥Ð¸(€¥˜€¡Mˆ¹½¹™¥ÕÉ• ¤€˜˜Mˆ¹Í¥¹•‘%¸ ¤¤…Ý…¥ÐMˆ¹ÅÕ•Õ•Õ•)½‰Ì¡‰…¹­½­…Ñ” ´ÄÐ¤°‰…¹­½­…Ñ” Ä¤¤ì)ô()™Õ¹Ñ¥½¸ÍÑ…ÉÑ±½Õ‘]½É­•È ¤ì(€±•…ÉQ¥µ•½ÕÐ¡±½Õ‘]½É­•ÉQ¥µ•È¤ì(€€¼¼Q¡”ÁÕ‰±¥Í¡•¸á¸Í¡•‘Õ±”ÉÕ¹ÌÝ¥Ñ¡½ÕÐ…¸½Á•¸‰É½ÝÍ•È¸)ô()™Õ¹Ñ¥½¸ÍÑ…ÉÑM¡•‘Õ±•È ¤ì(€±•…É%¹Ñ•ÉÙ…°¡Í¡•‘Õ±•Q¥µ•È¤ì(€½¹ÍÐÍŒ€ôMÑ½É”¹‘…Ñ„¹Í¡•‘Õ±”ì(€¥˜€ …ÍŒ¹•¹…‰±•¤É•ÑÕÉ¸ì(€½¹ÍÐµÌ€ô5…Ñ ¹µ…à Ä°ÍŒ¹¥¹Ñ•ÉÙ…±5¥¹ÕÑ•Ì¤€¨€ØÀÀÀÀì(€ÍŒ¹¹•áÑIÕ¸€ô¹•Ü…Ñ”¡…Ñ”¹¹½Ü ¤€¬µÌ¤¹Ñ½%M=MÑÉ¥¹œ ¤ì(€MÑ½É”¹Á•ÉÍ¥ÍÐ ¤ì(€Í¡•‘Õ±•Q¥µ•È€ôÍ•Ñ%¹Ñ•ÉÙ…°¡…Íå¹Œ€ ¤€ôøì(€€€ÍŒ¹±…ÍÑIÕ¸€ô¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤ì(€€€ÍŒ¹¹•áÑIÕ¸€ô¹•Ü…Ñ”¡…Ñ”¹¹½Ü ¤€¬µÌ¤¹Ñ½%M=MÑÉ¥¹œ ¤ì(€€€MÑ½É”¹Á•ÉÍ¥ÍÐ ¤ì(€€€¥˜€¡ÍŒ¹…ÕÑ½%¹•ÍÐ¤ì(€€€€€½¹ÍÐ¥¹‰½à€ô%µÁ½ÉÑMÑ…Ñ”¹¥¹‰½àñð‰Õ¥±‘%¹‰½à ¤ì(€€€€€½¹ÍÐÁ•¹‘¥¹œ€ô¥¹‰½à¹µ•ÍÍ…•Ì¹™¥±Ñ•È ¡´¤€ôø€…´¹ÁÕ±±•¤ì(€€€€€™½È€¡½¹ÍÐ´½˜Á•¹‘¥¹œ¤ì(€€€€€€€…Ý…¥Ð¥¹•ÍÑI…Ü¡´¹™¥±”¹¹…µ”°´¹™¥±”¹½¹Ñ•¹Ð°´¹™¥±”¹½¹Ñ•¹Ð¹±•¹Ñ ¤ì(€€€€€€€´¹ÁÕ±±•€ôÑÉÕ”ì(€€€€€ô(€€€€€¥˜€¡Á•¹‘¥¹œ¹±•¹Ñ ¤±½Ñ¥½¸ ‰Í¡•‘Õ±•‘}¥¹•ÍÐˆ°€‰Í½ÕÉ•}™¥±”ˆ°€‰¥¹‰½àˆ°ƒ‚âS‚âÛ‚â‚æ‚â‚â—‚æ3‚â#‚âË‚â‚â·‚â×‚æ‚â‡‚â—‚â‚â—‚âË‚â€‘íÁ•¹‘¥¹œ¹±•¹Ñ¡ôƒ‚æ‚â‚â—‚æ1€¤ì(€€€ô(€€€MÑ½É”¹¹½Ñ¥™ä ‰½¬ˆ°€‹‚â_‚âÏ‚â‚âË‚âg‚âW‚âË‚â‡‚âW‚âË‚â‚âË‚â‚æ‚âŸ‚â—‚âË‚æ‚â—‚æ'‚âœˆ°ƒ‚âS‚âÛ‚â‚æ‚â‚â—‚æ3‚æ‚â—‚âÃ‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÐƒ
Üƒ‚â‚â·‚âk‚â[‚âÇ‚âS‚æ‚âo‚â·‚â×‚â€‘íÍŒ¹¥¹Ñ•ÉÙ…±5¥¹ÕÑ•Íôƒ‚âg‚âË‚â_‚âÕ€°€‰‘…Í¡‰½…Éˆ¤ì(€€€ÕÁ‘…Ñ•	•±° ¤ì(€€€¥˜€¡…ÕÑ½I•…‘¥¹•ÍÌ ¤¹É•…‘ä¤…Ý…¥ÐÉÕ¹I•½¹¥±•É½µ%µÁ½ÉÐ¡ì…ÕÑ¼èÑÉÕ”°É•…Í½¸è€‹‚â[‚âÛ‚â‚æ‚âŸ‚â—‚âË‚âW‚âË‚â‡‚âW‚âË‚â‚âË‚âˆô¤ì(€€€•±Í”¥˜€¡ÍÑ…Ñ”¹É½ÕÑ”€ôôô€‰Í¡•‘Õ±”ˆ¤É•¹‘•È ¤ì(€ô°µÌ¤ì)ô()Y%]L¹Í¡•‘Õ±”€ô€¡É½½Ð¤€ôøì(€½¹ÍÐÍŒ€ôMÑ½É”¹‘…Ñ„¹Í¡•‘Õ±”ì(€½¹ÍÐÉÐ€ôMÑ½É”¹‘…Ñ„¹É•Ñ•¹Ñ¥½¸ì(€½¹ÍÐ•‘¥Ñ…‰±”€ô…¸ ‰Í•ÑÑ¥¹Ìˆ¤ñð…¸ ‰ÉÕ±•Ìˆ¤ì(€½¹ÍÐ™µÑQ¥µ”€ô€¡¥Í¼¤€ôø€¡¥Í¼€ü‘¥ÍÁ±…åQ¥µ”¡¥Í¼¤€è€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚â‚â‹‚â‚âÇ‚âdˆ¤ì((€É½½Ð¹¥¹¹•É!Q50€ô€(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰É¥´Èˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùM¡•‘Õ±•I•½¹¥±”ð½Àøñ Èû‚âS‚âÛ‚â‚æ‚â‚â—‚æ3‚æ‚â—‚âÃ‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚âW‚âË‚â‡‚æ‚âŸ‚â—‚âÈð½ Èøð½‘¥Øø(€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰¡•…±Ñ €‘íÍŒ¹•¹…‰±•€ü€‰½¬ˆ€è€‰…ÑÑ•¹Ñ¥½¸‰ôˆø‘íÍŒ¹•¹…‰±•€ü€‹‚æ‚âo‚âÓ‚âS‚æ‚â+‚æ'‚â‚âË‚âdˆ€è€‹‚âo‚âÓ‚âS‚â·‚â‹‚âç‚æ ‰ôð½ÍÁ…¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ½±”µ±¥ÍÐˆø(€€€€€€€€€€ñ±…‰•°øñ¥¹ÁÕÐÑåÁ”ô‰¡•­‰½àˆ¥ô‰Í¹…‰±•ˆ€‘íÍŒ¹•¹…‰±•€ü€‰¡•­•ˆ€è€ˆ‰ô€‘í•‘¥Ñ…‰±”€ü€ˆˆ€è€‰‘¥Í…‰±•‰ô€¼øƒ‚æ‚âo‚âÓ‚âS‚â‚âË‚â‚â_‚âÏ‚â‚âË‚âg‚âW‚âË‚â‡‚âW‚âË‚â‚âË‚â‚æ‚âŸ‚â—‚âÈð½±…‰•°ø(€€€€€€€€€€ñ±…‰•°øñ¥¹ÁÕÐÑåÁ”ô‰¡•­‰½àˆ¥ô‰Í%¹•ÍÐˆ€‘íÍŒ¹…ÕÑ½%¹•ÍÐ€ü€‰¡•­•ˆ€è€ˆ‰ô€‘í•‘¥Ñ…‰±”€ü€ˆˆ€è€‰‘¥Í…‰±•‰ô€¼øƒ‚âS‚âÛ‚â‚æ‚â‚â—‚æ3‚â#‚âË‚â‚â·‚â×‚æ‚â‡‚â—‚â‚â—‚âË‚â‚â‚æ#‚â·‚âg‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚â_‚âã‚â‚â‚â‚âÇ‚æ'‚âð½±…‰•°ø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í•ÑÑ¥¹œµ±¥ÍÐµÐˆø(€€€€€€€€€€ñ±…‰•°øñÍÁ…¸û‚â‚âÇ‚âg‚â_‚âã‚âð½ÍÁ…¸øñ¥¹ÁÕÐÑåÁ”ô‰¹Õµ‰•Èˆ¥ô‰Í%¹Ñ•ÉÙ…°ˆÙ…±Õ”ôˆ‘íÍŒ¹¥¹Ñ•ÉÙ…±5¥¹ÕÑ•Íôˆµ¥¸ôˆÄˆ€‘í•‘¥Ñ…‰±”€ü€ˆˆ€è€‰‘¥Í…‰±•‰ô€¼øñˆû‚âg‚âË‚â_‚âÔð½ˆøð½±…‰•°ø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰ÉÕ¸µÉ¥ˆø(€€€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚â‚âÇ‚âg‚â—‚æ#‚âË‚â«‚âã‚âPð½ÍÁ…¸øñˆø‘í ¡™µÑQ¥µ”¡ÍŒ¹±…ÍÑIÕ¸¤¥ôð½ˆøð½‘¥Øø(€€€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚â‚â·‚âk‚â[‚âÇ‚âS‚æ‚âlð½ÍÁ…¸øñˆø‘í ¡ÍŒ¹•¹…‰±•€ü™µÑQ¥µ”¡ÍŒ¹¹•áÑIÕ¸¤€è€ˆ´ˆ¥ôð½ˆøð½‘¥Øø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹±¥¹”µ…Ñ¥½¹ÌµÐˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ¥ô‰ÍM…Ù”ˆ€‘í•‘¥Ñ…‰±”€ü€ˆˆ€è€‰‘¥Í…‰±•‰ôû‚âk‚âÇ‚âg‚â_‚âÛ‚â‚âW‚âË‚â‚âË‚â‚æ‚âŸ‚â—‚âÈð½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰Í9½Üˆû‚â_‚âÏ‚â‚âË‚âg‚æ‚âS‚â×‚æ/‚â‹‚âŸ‚âg‚â×‚æ$ð½‰ÕÑÑ½¸ø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñÀ±…ÍÌô‰¡¥¹Ðˆù¸á¸ƒ‚âW‚â‚âŸ‚â#‚â‚âŸ‚âË‚â‡‚â‚â‚âk‚â[‚æ'‚âŸ‚âg‚æ‚â—‚âÃ‚â#‚âÇ‚âS‚â‚âÓ‚âŸ‚â[‚âË‚âŸ‚â‚â_‚âã‚â€ÄÀƒ‚âg‚âË‚â_‚âÔƒ‚â«‚æ#‚âŸ‚âg‚âW‚âÇ‚âŸ‚â·‚æ#‚âË‚âdA½a1M`ƒ‚â#‚âÃ‚â‚âÇ‚âk‚â‚âË‚âg‚â#‚âË‚â‚â‚âÓ‚âŸ‚æ‚â‡‚âß‚æ#‚â·‚â¯‚âg‚æ'‚âË‚æ‚âŸ‚æ‚âk‚â_‚â×‚æ#‚â—‚æ‚â·‚â‚â·‚âÓ‚âg‚æ‚âo‚âÓ‚âS‚â·‚â‹‚âç‚æ ƒ
Üƒ‚æ‚â‚â—‚æ3‚â‡‚âË‚â+‚æ'‚âË‚â#‚âÃ‚â[‚âç‚â‚âW‚âÓ‚âS‚âc‚â‚æ‚â—‚âÃ‚â‚âÇ‚âg‚â/‚æ'‚âÏ‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÐð½Àø(€€€€€€ð½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆù…Ñ„AÉ½Ñ•Ñ¥½¸ð½Àøñ Èû‚æ‚â‚æ‚âk‚â‚æ'‚â·‚â‡‚âç‚â”ƒ‚â«‚âÏ‚â‚â·‚âƒ‚æ‚â—‚âÃ‚æ‚â‚æ'‚âË‚â‚â¯‚âÇ‚â¨ð½ Èøð½‘¥Øøð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í•ÑÑ¥¹œµ±¥ÍÐˆø(€€€€€€€€€€ñ±…‰•°øñÍÁ…¸û‚æ‚â‚æ‚âk‚â‚æ'‚â·‚â‡‚âç‚â—‚â‹‚æ'‚â·‚âg‚â¯‚â—‚âÇ‚âð½ÍÁ…¸øñ¥¹ÁÕÐÑåÁ”ô‰¹Õµ‰•Èˆ¥ô‰ÉÑ5½¹Ñ¡ÌˆÙ…±Õ”ôˆ‘íÉÐ¹µ½¹Ñ¡Íôˆµ¥¸ôˆÄˆ€‘í•‘¥Ñ…‰±”€ü€ˆˆ€è€‰‘¥Í…‰±•‰ô€¼øñˆû‚æ‚âS‚âß‚â·‚âdð½ˆøð½±…‰•°ø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ½±”µ±¥ÍÐˆø(€€€€€€€€€€ñ±…‰•°øñ¥¹ÁÕÐÑåÁ”ô‰¡•­‰½àˆ¥ô‰ÉÑ	…­ÕÀˆ€‘íÉÐ¹‰…­ÕÁ…¥±ä€ü€‰¡•­•ˆ€è€ˆ‰ô€‘í•‘¥Ñ…‰±”€ü€ˆˆ€è€‰‘¥Í…‰±•‰ô€¼øƒ‚â«‚âÏ‚â‚â·‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÓ‚â_‚âã‚â‚âŸ‚âÇ‚âdð½±…‰•°ø(€€€€€€€€€€ñ±…‰•°øñ¥¹ÁÕÐÑåÁ”ô‰¡•­‰½àˆ¥ô‰ÉÑ¹ÉåÁÐˆ€‘íÉÐ¹•¹ÉåÁÑÑI•ÍÐ€ü€‰¡•­•ˆ€è€ˆ‰ô€‘í•‘¥Ñ…‰±”€ü€ˆˆ€è€‰‘¥Í…‰±•‰ô€¼øƒ‚æ‚â‚æ'‚âË‚â‚â¯‚âÇ‚â«‚â‚æ'‚â·‚â‡‚âç‚â—‚â‚âË‚â‚æ‚â‚âÓ‚âg‚â‚âO‚âÃ‚â#‚âÇ‚âS‚æ‚â‚æ‚âhð½±…‰•°ø(€€€€€€€€€€ñ±…‰•°øñ¥¹ÁÕÐÑåÁ”ô‰¡•­‰½àˆ¥ô‰ÉÑ5…Í¬ˆ€‘íÉÐ¹µ…Í­½Õ¹Ð€ü€‰¡•­•ˆ€è€ˆ‰ô€‘í•‘¥Ñ…‰±”€ü€ˆˆ€è€‰‘¥Í…‰±•‰ô€¼øƒ‚âo‚âÓ‚âS‚âk‚âÇ‚â‚æ‚â—‚â‚âk‚âÇ‚â7‚â+‚â×‚â«‚âÏ‚â¯‚â‚âÇ‚âk‚âk‚â_‚âk‚âË‚â_‚â_‚â×‚æ#‚æ‚â‡‚æ#‚â#‚âÏ‚æ‚âo‚æ‚âg‚âW‚æ'‚â·‚â‚æ‚â¯‚æ‚âdð½±…‰•°ø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñÕ°±…ÍÌô‰Ñ¥¬µ±¥ÍÐµÐˆø(€€€€€€€€€€ñ±¤û‚æ‚â‡‚æ#‚â‡‚âÔ‰½Ð±½¥¸µ½‰¥±”‰…¹­¥¹œƒŠPƒ‚â‚âÇ‚âk‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚âË‚â•µ…¥°€¼•áÁ½ÉÐƒ‚æ‚â_‚æ#‚âË‚âg‚âÇ‚æ'‚âdð½±¤ø(€€€€€€€€€€ñ±¤û‚â_‚âã‚â…Ñ¥½¸ƒ‚â«‚âÏ‚â‚âÇ‚â7‚â‡‚âÔ…Õ‘¥Ð±½œƒ‚æ‚âk‚âk‚æ‚â‚â×‚â‹‚âg‚æ‚âS‚æ'‚â·‚â‹‚æ#‚âË‚â‚æ‚âS‚â×‚â‹‚âœð½±¤ø(€€€€€€€€€€ñ±¤û‚æ‚â‡‚æ#‚â‡‚â×‚âk‚â_‚âk‚âË‚â_‚æ‚âS‚â—‚âhÑÉ…¹Í…Ñ¥½¸ƒ‚â¯‚â‚âß‚â·‚â¯‚â—‚âÇ‚â‚âC‚âË‚âg‚æ‚âS‚æ$ð½±¤ø(€€€€€€€€ð½Õ°ø(€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸µÐˆ¥ô‰ÉÑM…Ù”ˆ€‘í•‘¥Ñ…‰±”€ü€ˆˆ€è€‰‘¥Í…‰±•‰ôû‚âk‚âÇ‚âg‚â_‚âÛ‚â‚âg‚æ‚â‹‚âk‚âË‚âˆð½‰ÕÑÑ½¸ø(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùA•É™½Éµ…¹”ð½Àøñ Èû‚â_‚âS‚â«‚â·‚âk‚â‚âÃ‚âS‚âÇ‚âh€ÄÀÀ°ÀÀÀ´ÈÀÀ°ÀÀÀƒ‚â‚âË‚â‹‚â‚âË‚â‚âW‚æ#‚â·‚âŸ‚âÇ‚âdð½ Èøð½‘¥Øø(€€€€€€€€ñÍÁ…¸±…ÍÌô‰¡•…±Ñ ½¬ˆû‚æ‚â‚âO‚âG‚æ0è‘…¥±äÉ•Á½ÉÐƒ‚æ‚â«‚â‚æ‚â#‚æ‚âd€Ä´Èƒ‚â+‚âÇ‚æ#‚âŸ‚æ‚â‡‚âð½ÍÁ…¸ø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹±¥¹”µ…Ñ¥½¹Ìˆø(€€€€€€€€ñ±…‰•°±…ÍÌô‰¡¬µ¥¹±¥¹”ˆû‚â#‚âÏ‚âg‚âŸ‚âg‚â‚âË‚â‹‚â‚âË‚â‚â_‚â×‚æ#‚â#‚âÃ‚â_‚âS‚â«‚â·‚âh(€€€€€€€€€€ñÍ•±•Ð¥ô‰Á•É™M¥é”ˆø(€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ôˆÔÀÀÀÀˆøÔÀ°ÀÀÀð½½ÁÑ¥½¸ø(€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ôˆÄÀÀÀÀÀˆÍ•±•Ñ•øÄÀÀ°ÀÀÀð½½ÁÑ¥½¸ø(€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ôˆÈÀÀÀÀÀˆøÈÀÀ°ÀÀÀð½½ÁÑ¥½¸ø(€€€€€€€€€€ð½Í•±•Ðø(€€€€€€€€ð½±…‰•°ø(€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ¥ô‰Á•É™IÕ¸ˆû‚æ‚â‚âÓ‚æ#‚â‡‚â_‚âS‚â«‚â·‚âhð½‰ÕÑÑ½¸ø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø¥ô‰Á•É™I•ÍÕ±Ðˆøð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùM•ÍÍ¥½¸ð½Àøñ Èû‚â‚âË‚â‚æ‚â‚æ‚âk‚â«‚â[‚âË‚âg‚âÃ‚æ‚â—‚âÃ‚â‚âË‚â‚â—‚æ'‚âË‚â‚â‚æ'‚â·‚â‡‚âç‚â”ð½ Èøð½‘¥Øø(€€€€€€€€ñÍÁ…¸±…ÍÌô‰¡•…±Ñ €‘íMÑ½É”¹…Ù…¥±…‰±”€ü€‰½¬ˆ€è€‰…ÑÑ•¹Ñ¥½¸‰ôˆø‘íMÑ½É”¹…Ù…¥±…‰±”€ü€‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚âg‚æ‚â‚â‚âß‚æ#‚â·‚â‚æ‚âS‚æ$ˆ€è€‹‚æ‚âk‚â‚âË‚âŸ‚æ3‚æ‚â/‚â·‚â‚æ3‚âg‚â×‚æ'‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ$ƒ‚æ‚â+‚æ'‚â¯‚âg‚æ#‚âŸ‚â‹‚â‚âŸ‚âË‚â‡‚â#‚âÏ‚â+‚âÇ‚æ#‚âŸ‚â‚â‚âË‚âœ‰ôð½ÍÁ…¸ø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰ÉÕ¸µÉ¥ˆø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â—‚æ#‚âË‚â«‚âã‚âPð½ÍÁ…¸øñˆø‘í ¡MÑ½É”¹‘…Ñ„¹±…ÍÑM…Ù•‘Ð€ü‘¥ÍÁ±…åQ¥µ”¡MÑ½É”¹‘…Ñ„¹±…ÍÑM…Ù•‘Ð¤€è€ˆ´ˆ¥ôð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸ùÕ‘¥Ð±½œƒ‚â_‚â×‚æ#‚æ‚â‚æ‚âk‚æ‚âŸ‚æ$ð½ÍÁ…¸øñˆø‘í¹Õ´¡MÑ½É”¹‘…Ñ„¹…Õ‘¥Ñ1½œ¹±•¹Ñ ¥ôð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚â‚âË‚â‚æ‚â#‚æ'‚â‚æ‚âW‚âß‚â·‚âdð½ÍÁ…¸øñˆø‘í¹Õ´¡MÑ½É”¹‘…Ñ„¹¹½Ñ¥™¥…Ñ¥½¹Ì¹±•¹Ñ ¥ôð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚â«‚â[‚âË‚âg‚âÃ‚æ‚â‚â«‚â_‚â×‚æ#‚æ‚â‚æ'‚æ‚âŸ‚æ$ð½ÍÁ…¸øñˆø‘í¹Õ´¡=‰©•Ð¹­•åÌ¡MÑ½É”¹‘…Ñ„¹•á=Ù•ÉÉ¥‘•Ì¤¹±•¹Ñ ¥ôð½ˆøð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸µÐˆ¥ô‰Ý¥Á”ˆû‚â—‚æ'‚âË‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚â_‚â×‚æ#‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚âŸ‚æ'‚æ‚âg‚æ‚â‚â‚âß‚æ#‚â·‚âð½‰ÕÑÑ½¸ø(€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸µÐˆ¥ô‰ÍÑ…ÉÑI•…°ˆû‚â—‚æ'‚âË‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚æ‚â‚æ#‚âÈ€¬ƒ‚æ‚â‚âÓ‚æ#‚â‡‚æ‚â_‚â«‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚â‚âÓ‚âð½‰ÕÑÑ½¸ø(€€€€€€ñÀ±…ÍÌô‰¡…ÉÐµ¹½Ñ”ˆû‚âo‚âã‚æ#‚â‡‚âg‚â×‚æ'‚â#‚âÃ‚â—‚æ'‚âË‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚â¿‚â«‚â[‚âË‚âg‚âÃ‚æ‚â‚æ#‚âË‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âPƒ‚æ‚â—‚âÃ‚æ‚â¯‚â—‚âS‚âk‚âÇ‚â7‚â+‚â×‚â#‚â‚âÓ‚â‚â#‚âË‚â‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚æ‚âo‚æ‚âdµ…ÍÑ•Èƒ‚æ‚â—‚æ'‚âŸ‚â{‚âË‚æ‚âo‚â¯‚âg‚æ'‚âË‚âg‚âÏ‚æ‚â‚æ'‚âË‚æ‚â‚â—‚æ0ƒ‚æ‚â{‚âß‚æ#‚â·‚æ‚â‚âÓ‚æ#‚â‡‚æ‚â_‚â«‚âS‚æ'‚âŸ‚â‹‚æ‚â‚â—‚æ3‚â#‚â‚âÓ‚â‚â#‚âË‚â‚â£‚âç‚âg‚â‹‚æ0ð½Àø(€€€€ð½Í•Ñ¥½¸ù€ì((€€ ˆÍM…Ù”ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€¥˜€ …•‘¥Ñ…‰±”¤É•ÑÕÉ¸‘•¹ä ‹‚æ‚â‚æ'‚âW‚âË‚â‚âË‚â‚æ‚âŸ‚â—‚âÈˆ¤ì(€€€ÍŒ¹•¹…‰±•€ô€ ˆÍ¹…‰±•ˆ¤¹¡•­•ì(€€€ÍŒ¹…ÕÑ½%¹•ÍÐ€ô€ ˆÍ%¹•ÍÐˆ¤¹¡•­•ì(€€€ÍŒ¹¥¹Ñ•ÉÙ…±5¥¹ÕÑ•Ì€ô5…Ñ ¹µ…à Ä°€¬ ˆÍ%¹Ñ•ÉÙ…°ˆ¤¹Ù…±Õ”ñð€ØÀ¤ì(€€€MÑ½É”¹Á•ÉÍ¥ÍÐ ¤ì(€€€ÍÑ…ÉÑM¡•‘Õ±•È ¤ì(€€€±½Ñ¥½¸ ‰ÕÁ‘…Ñ”ˆ°€‰Í¡•‘Õ±”ˆ°€‰É•½¹¥±”ˆ°€‘íÍŒ¹•¹…‰±•€ü€‹‚æ‚âo‚âÓ‚âPˆ€è€‹‚âo‚âÓ‚âP‰ôƒ
Üƒ‚â_‚âã‚â€‘íÍŒ¹¥¹Ñ•ÉÙ…±5¥¹ÕÑ•Íôƒ‚âg‚âË‚â_‚âÕ€¤ì(€€€Ñ½…ÍÐ ‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚âW‚âË‚â‚âË‚â‚æ‚âŸ‚â—‚âË‚æ‚â—‚æ'‚âœˆ¤ì(€€€É•¹‘•È ¤ì(€ô¤ì(€€ ˆÍ9½Üˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€ÍŒ¹±…ÍÑIÕ¸€ô¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤ì(€€€MÑ½É”¹Á•ÉÍ¥ÍÐ ¤ì(€€€±½Ñ¥½¸ ‰Í¡•‘Õ±•‘}ÉÕ¸ˆ°€‰µ…Ñ¡}ÉÕ¸ˆ°€‰59U0´ˆ€¬…Ñ”¹¹½Ü ¤°€‹‚â«‚âÇ‚æ#‚â‚â_‚âÏ‚â‚âË‚âg‚âg‚â·‚â‚âW‚âË‚â‚âË‚â‚æ‚âŸ‚â—‚âÈˆ¤ì(€€€MÑ½É”¹¹½Ñ¥™ä ‰½¬ˆ°€‹‚â«‚âÇ‚æ#‚â‚â_‚âÏ‚â‚âË‚âg‚âg‚â·‚â‚âW‚âË‚â‚âË‚â‚æ‚âŸ‚â—‚âÈˆ°€‹‚âS‚âÛ‚â‚æ‚â‚â—‚æ3‚æ‚â—‚âÃ‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚â#‚âË‚â‚â¯‚âg‚æ'‚âË‚âW‚âË‚â‚âË‚â‚æ‚âŸ‚â—‚âÈˆ°€‰‘…Í¡‰½…Éˆ¤ì(€€€ÕÁ‘…Ñ•	•±° ¤ì(€€€¥˜€¡…ÕÑ½I•…‘¥¹•ÍÌ ¤¹É•…‘ä¤ÉÕ¹I•½¹¥±•É½µ%µÁ½ÉÐ¡ì…ÕÑ¼èÑÉÕ”°É•…Í½¸è€‹‚â«‚âÇ‚æ#‚â‚âg‚â·‚â‚âW‚âË‚â‚âË‚âˆô¤ì(€€€•±Í”ì(€€€€€Ñ½…ÍÐ ‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚â×‚æ‚â‚â—‚æ3‚â‚â‚âk‚â_‚âÇ‚æ'‚â‚â«‚â·‚â‚âw‚âÇ‚æ#‚âƒŠPƒ‚â‚âÃ‚âk‚âk‚â#‚âÃ‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚æ‚â¯‚æ'‚æ‚â‡‚âß‚æ#‚â·‚æ‚â‚â—‚æ3‚æ‚â‚æ'‚âË‚â‚â‚âhˆ°€‰Ý…É¸ˆ¤ì(€€€€€É•¹‘•È ¤ì(€€€ô(€ô¤ì(€€ ˆÉÑM…Ù”ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€¥˜€ …•‘¥Ñ…‰±”¤É•ÑÕÉ¸‘•¹ä ‹‚æ‚â‚æ'‚âg‚æ‚â‹‚âk‚âË‚â‹‚â‚æ'‚â·‚â‡‚âç‚â”ˆ¤ì(€€€ÉÐ¹µ½¹Ñ¡Ì€ô5…Ñ ¹µ…à Ä°€¬ ˆÉÑ5½¹Ñ¡Ìˆ¤¹Ù…±Õ”ñð€ÄÈ¤ì(€€€ÉÐ¹‰…­ÕÁ…¥±ä€ô€ ˆÉÑ	…­ÕÀˆ¤¹¡•­•ì(€€€ÉÐ¹•¹ÉåÁÑÑI•ÍÐ€ô€ ˆÉÑ¹ÉåÁÐˆ¤¹¡•­•ì(€€€ÉÐ¹µ…Í­½Õ¹Ð€ô€ ˆÉÑ5…Í¬ˆ¤¹¡•­•ì(€€€MÑ½É”¹Á•ÉÍ¥ÍÐ ¤ì(€€€±½Ñ¥½¸ ‰ÕÁ‘…Ñ”ˆ°€‰Í•ÑÑ¥¹Ìˆ°€‰É•Ñ•¹Ñ¥½¸ˆ°ƒ‚æ‚â‚æ‚âh€‘íÉÐ¹µ½¹Ñ¡Íôƒ‚æ‚âS‚âß‚â·‚âe€¤ì(€€€Ñ½…ÍÐ ‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚âg‚æ‚â‹‚âk‚âË‚â‹‚â‚æ'‚â·‚â‡‚âç‚â—‚æ‚â—‚æ'‚âœˆ¤ì(€ô¤ì(€€ ˆÁ•É™IÕ¸ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°…Íå¹Œ€ ¤€ôøì(€€€½¹ÍÐ¸€ô€¬ ˆÁ•É™M¥é”ˆ¤¹Ù…±Õ”ì(€€€Í¡½ÝAÉ½É•ÍÌ¡ƒ‚â_‚âS‚â«‚â·‚âhÁ•É™½Éµ…¹”€‘í¹Õ´¡¸¥ôƒ‚â‚âË‚â‹‚â‚âË‚â€¤ì(€€€Í•ÑAÉ½É•ÍÌ À¸ÀÈ°€‹‚â«‚â‚æ'‚âË‚â‚â+‚âã‚âS‚â‚æ'‚â·‚â‡‚âç‚â—‚â_‚âS‚â«‚â·‚âhˆ¤ì(€€€…Ý…¥Ð¹•ÜAÉ½µ¥Í” ¡È¤€ôøÍ•ÑQ¥µ•½ÕÐ¡È°€ÌÀ¤¤ì(€€€½¹ÍÐÑ•¸€ôÁ•É™½Éµ…¹”¹¹½Ü ¤ì(€€€½¹ÍÐÍ¸€ôM…µÁ±”¹‰Õ¥±‘M•¹…É¥¼¡¹	UM%9MM}Q°¸°€ÜÜÜÜ¤ì(€€€½¹ÍÐ•¹5Ì€ô5…Ñ ¹É½Õ¹¡Á•É™½Éµ…¹”¹¹½Ü ¤€´Ñ•¸¤ì(€€€½¹ÍÐÑ½I•Œ€ô€¡È°Í¥‘”¤€ôø€¡ì(€€€€€Í•ŒèÈ¹Í•Œ°(€€€€€‘…Ñ”è¹	UM%9MM}Q°(€€€€€…µ½Õ¹ÐèÈ¹…µ½Õ¹Ð°(€€€€€‘¥É•Ñ¥½¸èÈ¹…Œ¹‘¥É•Ñ¥½¸°(€€€€€…½Õ¹ÐèÈ¹…Œ¹¥°(€€€€€‰…¹¬èÍ¥‘”€ôôô€‰‰¼ˆ€üÈ¹‰…¹¬€èÈ¹…Œ¹‰…¹¬°(€€€€€½µÁ…¹äèÈ¹…Œ¹½µÁ…¹ä°(€€€€€ÕÍ•É¹…µ”èÈ¹ÕÍ•È°(€€€€€É•˜èÈ¹É•˜°(€€€€€‘•ÍŒè€ˆˆ°(€€€€€É½ÍÍ…äèÈ¹Í•Œ€øô€àÈàÀÀ°(€€€€€É…Üè€ˆˆ°(€€€ô¤ì(€€€½¹ÍÐÍÑ´€ôÍ¸¹ÍÑ´¹µ…À ¡È¤€ôøÑ½I•Œ¡È°€‰ÍÑ´ˆ¤¤ì(€€€½¹ÍÐ‰¼€ôÍ¸¹‰¼¹µ…À ¡È¤€ôøÑ½I•Œ¡È°€‰‰¼ˆ¤¤ì(€€€‘•±•Ñ”¹Í•ÑÑ¥¹Ì¹…Í=˜ì€¼¼Í•¹…É¥¼ƒ‚â#‚âÏ‚â—‚â·‚â‚æ‚â+‚æ'‚â«‚âç‚âW‚â‚â·‚âË‚â‹‚âã‚æ‚âk‚âk‚âo‚â—‚âË‚â‹‚âŸ‚âÇ‚âdƒ‚æ‚â‡‚æ#‚âs‚âç‚â‚æ‚âŸ‚â—‚âË‚â#‚â‚âÓ‚â(€€€½¹ÍÐÉ•Ì€ô…Ý…¥Ð¹¥¹”¹É•½¹¥±”¡ÍÑ´°‰¼°¹Í•ÑÑ¥¹Ì°¹…½Õ¹ÑÌ°€¡À°°¤€ôøÍ•ÑAÉ½É•ÍÌ À¸Ä€¬À€¨€À¸ä°°¤¤ì(€€€¡¥‘•AÉ½É•ÍÌ ¤ì(€€€½¹ÍÐÁ•ÉM•Œ€ô5…Ñ ¹É½Õ¹ ¡ÍÑ´¹±•¹Ñ €¬‰¼¹±•¹Ñ ¤€¼€¡É•Ì¹•±…ÁÍ•‘5Ì€¼€ÄÀÀÀ¤¤ì(€€€€ ˆÁ•É™I•ÍÕ±Ðˆ¤¹¥¹¹•É!Q50€ô€(€€€€€€ñ‘¥Ø±…ÍÌô‰ÉÕ¸µÉ¥µÐˆø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚â‚âË‚â‹‚â‚âË‚â‚âw‚âÇ‚æ#‚â‚âc‚âg‚âË‚â‚âË‚âŒð½ÍÁ…¸øñˆø‘í¹Õ´¡ÍÑ´¹±•¹Ñ ¥ôð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚â‚âË‚â‹‚â‚âË‚â‚âw‚âÇ‚æ#‚â	<ð½ÍÁ…¸øñˆø‘í¹Õ´¡‰¼¹±•¹Ñ ¥ôð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚â«‚â‚æ'‚âË‚â‚â+‚âã‚âS‚â_‚âS‚â«‚â·‚âhð½ÍÁ…¸øñˆø‘í•¹5ÍôµÌð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚æ‚âŸ‚â—‚âË‚â#‚âÇ‚âk‚â‚âç‚æ ð½ÍÁ…¸øñˆø‘íÉ•Ì¹•±…ÁÍ•‘5ÍôµÌð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚â‚âŸ‚âË‚â‡‚æ‚â‚æ‚âœð½ÍÁ…¸øñˆø‘í¹Õ´¡Á•ÉM•Œ¥ôƒ‚â‚âË‚â‹‚â‚âË‚âŒ¿‚âŸ‚âÓ‚âg‚âË‚â_‚âÔð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚â·‚âÇ‚âW‚â‚âË‚â#‚âÇ‚âk‚â‚âç‚æ ð½ÍÁ…¸øñˆø‘íÉ•Ì¹µ…Ñ¡I…Ñ”¹Ñ½¥á• È¥ô”ð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸ùá•ÁÑ¥½¸ƒ‚â_‚â×‚æ#‚â{‚âhð½ÍÁ…¸øñˆø‘í¹Õ´¡É•Ì¹•á•ÁÑ¥½¹Ì¹±•¹Ñ ¥ôð½ˆøð½‘¥Øø(€€€€€€€€ñ‘¥ØøñÍÁ…¸û‚âs‚â—‚æ‚â_‚â×‚â‹‚âk‚æ‚â‚âO‚âG‚æ0ð½ÍÁ…¸øñˆ±…ÍÌôˆ‘íÉ•Ì¹•±…ÁÍ•‘5Ì€ð€ØÀÀÀÀ€ü€‰½¬µÑáÐˆ€è€‰‘…¹•È‰ôˆø‘íÉ•Ì¹•±…ÁÍ•‘5Ì€ð€ØÀÀÀÀ€ü€‹‚âs‚æ#‚âË‚âdˆ€è€‹‚âW‚æ'‚â·‚â‚âo‚â‚âÇ‚âh‰ôð½ˆøð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€€€ñÀ±…ÍÌô‰¡…ÉÐµ¹½Ñ”ˆû‚â_‚âS‚â«‚â·‚âk‚âk‚âg‚æ‚â‚â‚âß‚æ#‚â·‚â‚âs‚âç‚æ'‚æ‚â+‚æ'‚âS‚æ'‚âŸ‚âˆ)…Ù…MÉ¥ÁÐƒ‚â—‚æ'‚âŸ‚âdƒ‚æ‚âg‚â‚âÃ‚âk‚âk‚â#‚â‚âÓ‚â‚â‚âË‚âg‚âg‚â×‚æ'‚â#‚âÃ‚â‹‚æ'‚âË‚â‹‚æ‚âo‚âw‚âÇ‚æ#‚âÍ•ÉÙ•Èƒ‚â{‚â‚æ'‚â·‚â„¥¹‘•àƒ‚â‚â·‚â‚âC‚âË‚âg‚â‚æ'‚â·‚â‡‚âç‚â”ƒ‚â/‚âÛ‚æ#‚â‚â#‚âÃ‚æ‚â‚æ‚âŸ‚â‚âŸ‚æ#‚âË‚âg‚â×‚æ'‚â·‚â×‚âð½Àù€ì(€€€±½Ñ¥½¸ ‰Á•É™}Ñ•ÍÐˆ°€‰µ…Ñ¡}ÉÕ¸ˆ°€‰AI´ˆ€¬¸°€‘íÉ•Ì¹•±…ÁÍ•‘5ÍôµÌƒ
Ü€‘íÁ•ÉM•ôƒ‚â‚âË‚â‹‚â‚âË‚âŒ¿‚âŸ‚âÓ‚âg‚âË‚â_‚âÕ€¤ì(€€€Ñ½…ÍÐ¡ƒ‚â_‚âS‚â«‚â·‚âk‚æ‚â«‚â‚æ‚â è€‘í¹Õ´¡Á•ÉM•Œ¥ôƒ‚â‚âË‚â‹‚â‚âË‚âŒ¿‚âŸ‚âÓ‚âg‚âË‚â_‚âÕ€¤ì(€ô¤ì(€€ ˆÝ¥Á”ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€MÑ½É”¹É•Í•Ð ¤ì(€€€Ñ½…ÍÐ ‹‚â—‚æ'‚âË‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚â_‚â×‚æ#‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚âŸ‚æ'‚æ‚â—‚æ'‚âœƒ‚â‚â×‚æ‚â‚â‚â+‚â¯‚âg‚æ'‚âË‚æ‚â{‚âß‚æ#‚â·‚æ‚â‚âÓ‚æ#‚â‡‚æ‚â¯‚â‡‚æ ˆ¤ì(€€€É•¹‘•È ¤ì(€ô¤ì(€€ ˆÍÑ…ÉÑI•…°ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€¥˜€ …½¹™¥É´ ‹‚â—‚æ'‚âË‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚âW‚âÇ‚âŸ‚â·‚â‹‚æ#‚âË‚â‚æ‚â—‚âÃ‚â«‚â[‚âË‚âg‚âÃ‚æ‚â‚æ#‚âË‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âPƒ‚æ‚â—‚æ'‚âŸ‚æ‚â‚âÓ‚æ#‚â‡‚æ‚â_‚â«‚âS‚æ'‚âŸ‚â‹‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚â‚âÓ‚âýq¸£‚âk‚âÇ‚â7‚â+‚â×‚â#‚â‚âÓ‚â‚â#‚âË‚â‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚â#‚âÃ‚â[‚âç‚â‚æ‚â¯‚â—‚âS‚æ‚âo‚æ‚âdµ…ÍÑ•È¤ˆ¤¤É•ÑÕÉ¸ì(€€€ÍÑ…ÉÑI•…±Q•ÍÐ ¤ì(€ô¤ì)ôì()™Õ¹Ñ¥½¸‘½Ý¹±½…‘	½]…¥Ñ¥¹…Í•I•ÅÕ•ÍÐ¡ÉÕ¹%°É½ÝÌ¤ì(€½¹ÍÐ‰±½ˆ€ô¹•Ü	±½ˆ¡m)M=8¹ÍÑÉ¥¹¥™ä¡íÉÕ¹}¥èÉÕ¹%°É½ÝÍô°¹Õ±°°€È¥t°íÑåÁ”è€…ÁÁ±¥…Ñ¥½¸½©Í½¸ô¤ì(€½¹ÍÐÕÉ°€ôUI0¹É•…Ñ•=‰©•ÑUI0¡‰±½ˆ¤°±¥¹¬€ô‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð „œ¤ì(€±¥¹¬¹¡É•˜€ôÕÉ°ì±¥¹¬¹‘½Ý¹±½…€ô‰¼µÝ…¥Ñ¥¹œ´‘íÉ½ÝÍlÁtü¹½µÁ…¹äñð€½µÁ…¹äô´‘íÉ½ÝÍlÁtü¹‰½…Ñ”ñð€‘…Ñ”ô¹©Í½¹€ì(€±¥¹¬¹±¥¬ ¤ìÍ•ÑQ¥µ•½ÕÐ  ¤€ôøUI0¹É•Ù½­•=‰©•ÑUI0¡ÕÉ°¤°€ÄÀÀÀ¤ì)ô)™Õ¹Ñ¥½¸‘½Ý¹±½…‘Q•áÐ¡™¥±•¹…µ”°Ñ•áÐ¤ì(€½¹ÍÐ‰±½ˆ€ô¹•Ü	±½ˆ¡l‹¾îüˆ€¬Ñ•áÑt°ìÑåÁ”è€‰Ñ•áÐ½ÍØí¡…ÉÍ•ÐõÕÑ˜´àìˆô¤ì(€½¹ÍÐ„€ô‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰„ˆ¤ì(€„¹¡É•˜€ôUI0¹É•…Ñ•=‰©•ÑUI0¡‰±½ˆ¤ì(€„¹‘½Ý¹±½…€ô™¥±•¹…µ”ì(€‘½Õµ•¹Ð¹‰½‘ä¹…ÁÁ•¹‘¡¥±¡„¤ì(€„¹±¥¬ ¤ì(€Í•ÑQ¥µ•½ÕÐ  ¤€ôøì(€€€UI0¹É•Ù½­•=‰©•ÑUI0¡„¹¡É•˜¤ì(€€€„¹É•µ½Ù” ¤ì(€ô°€ÔÀÀ¤ì)ô((((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒ‚â‚âË‚âg‚â+‚â×‚æ'‚æ‚â#‚âƒŠPƒ‚â‚âÃ‚âk‚âha€£‚â«‚æ#‚â‚â_‚âã‚â‚âŸ‚âÇ‚âd€ÄÜèÀÀ¤ƒ‚æ‚â—‚âÃ‚â‚âÃ‚âk‚âh€ÄÈÌ€£‚â‚âŸ‚âk‚æ‚âo‚æ‚âg‚â‚â·‚âh€Ä´ÄÔ€¼€ÄØ´ÈÔ€¼€ÈØ·‚â«‚âÓ‚æ'‚âg‚æ‚âS‚âß‚â·‚âd¤(€€€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼((¼¨€´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´(€€€Èƒ‚â‚âÃ‚âk‚âk‚â_‚â×‚æ#‚æ‚âs‚âg‚â‚âW‚â‚âŸ‚â ƒŠPƒ‚â«‚âË‚â‹‚â+‚â×‚æ'‚æ‚â#‚â‚â‡‚âË‚â#‚âË‚â€‹‚â‚âÃ‚âk‚âk‚âW‚æ'‚âg‚â_‚âË‚â‚â‚â·‚â‚âk‚â‚âÓ‚â§‚âÇ‚â\ˆƒ‚æ‚â‡‚æ#‚æ‚â+‚æ#‚â‚âŸ‚âË‚â‡‚â‚âã‚âg‚æ‚â‚â(€€€€a€€€€€´øƒ‚â«‚æ#‚â‚â¯‚âÇ‚âŸ‚â¯‚âg‚æ'‚âË‚â‚âÃ‚â_‚âã‚â‚âŸ‚âÇ‚âdƒ‚â_‚âã‚â‚æ‚â‚â¨(€€€€MeLÄÈÌ€´øƒ‚â·‚â·‚âS‚âÓ‚â\€Ä¼È¼Ìƒ‚â‚âŸ‚âk‚æ‚âo‚æ‚âg‚â‚â·‚âk‚æ‚â—‚æ'‚âŸ‚âW‚â×‚æ‚â‚â—‚æ0(€€€´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´€¨¼)½¹ÍÐÍåÍ5•Ñ„€ô€¡½‘”¤€ôø¹ÍåÍÑ•µÌ¹™¥¹ ¡à¤€ôøà¹½‘”€ôôô½‘”¤ñð¹Õ±°ì)½¹ÍÐÑÉ…­5•Ñ„€ô€¡½‘”¤€ôø¹ÍåÍÑ•µÌ¹™¥¹ ¡à¤€ôøà¹ÑÉ…¬€ôôô½‘”¤ñð¹ÍåÍÑ•µÍlÅtì((¼¨ƒ‚âk‚â‚âÓ‚â§‚âÇ‚â_‚âg‚â×‚æ'‚â·‚â‹‚âç‚æ#‚â‚âÃ‚âk‚âk‚æ‚â¯‚âd€¡¹Õ±°€ôƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â‚âÏ‚â¯‚âg‚âP¤€¨¼)™Õ¹Ñ¥½¸ÍåÍÑ•µ=™½µÁ…¹ä¡½‘”¤ì(€½¹ÍÐŒ€ô¹½µÁ…¹¥•Ì¹™¥¹ ¡à¤€ôøà¹½‘”€ôôô½‘”¤ì(€É•ÑÕÉ¸Œ€üŒ¹ÍåÍÑ•´ñð¹Õ±°€è¹Õ±°ì)ô)™Õ¹Ñ¥½¸Í•Ñ½µÁ…¹åMåÍÑ•´¡½‘”°ÍåÍÑ•´¤ì(€±•ÐŒ€ô¹½µÁ…¹¥•Ì¹™¥¹ ¡à¤€ôøà¹½‘”€ôôô½‘”¤ì(€¥˜€ …Œ¤ì(€€€Œ€ôì½‘”°¹…µ”è½‘”°ÑåÁ”è€‰µ…¥¸ˆ°ÍåÍÑ•´è¹Õ±°ôì(€€€¹½µÁ…¹¥•Ì¹ÁÕÍ ¡Œ¤ì(€ô(€½¹ÍÐ½±€ôŒ¹ÍåÍÑ•´ì(€Œ¹ÍåÍÑ•´€ôÍåÍÑ•´ñð¹Õ±°ì(€MÑ½É”¹‘…Ñ„¹½µÁ…¹åMåÍÑ•µÌ€ôMÑ½É”¹‘…Ñ„¹½µÁ…¹åMåÍÑ•µÌñðíôì(€MÑ½É”¹‘…Ñ„¹½µÁ…¹åMåÍÑ•µÍm½‘•t€ôŒ¹ÍåÍÑ•´ì(€MÑ½É”¹Á•ÉÍ¥ÍÐ ¤ì(€±½Ñ¥½¸ ‰Í•Ñ}ÍåÍÑ•´ˆ°€‰½µÁ…¹äˆ°½‘”°ƒ‚â‚âÏ‚â¯‚âg‚âS‚æ‚â¯‚æ'‚âk‚â‚âÓ‚â§‚âÇ‚â\€‘í½‘•ôƒ‚â·‚â‹‚âç‚æ#‚â‚âÃ‚âk‚âh€‘íÍåÍÑ•´€üÍåÍ5•Ñ„¡ÍåÍÑ•´¤¹Í¡½ÉÐ€è€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âà‰ô‘í½±€ü€€£‚æ‚âS‚âÓ‚â„€‘í½±‘ô¥€€è€ˆ‰õ€¤ì(€É•Ñ…QÉ…­Ì ¤ì)ô((¼¨ƒ‚â‚âß‚âg‚â‚æ#‚âË‚â«‚âË‚â‹‚â+‚â×‚æ'‚æ‚â#‚â‚â‚â·‚â‚æ‚â‚â«‚â¯‚âg‚âÛ‚æ#‚âƒŠPƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â‚âÏ‚â¯‚âg‚âS‚â‚âÃ‚âk‚âk‚æ‚â¯‚æ'‚â[‚âß‚â·‚æ‚âo‚æ‚âg‚â‚âË‚â‹‚â‚â·‚âk‚æ‚âŸ‚æ'‚â‚æ#‚â·‚âg‚æ‚â—‚âÃ‚âW‚âÓ‚âS‚âc‚â‚æ‚âŸ‚æ$€¨¼)™Õ¹Ñ¥½¸ÑÉ…­=™á•ÁÑ¥½¸¡”¤ì(€½¹ÍÐÍåÌ€ôÍåÍÑ•µ=™½µÁ…¹ä¡”¹½µÁ…¹ä¤ì(€É•ÑÕÉ¸ìÑÉ…¬è€‰‘…¥±äˆ°ÍåÍÑ•´èÍåÌ°Õ¹…ÍÍ¥¹•è€…ÍåÌôì)ô((¼¨ƒ‚æ‚âW‚âÓ‚â„ÑÉ…¬ƒ‚æ‚â¯‚æ'‚â_‚âã‚â‚æ‚â‚â«‚âW‚âË‚â‡‚â‚âÃ‚âk‚âk‚â‚â·‚â‚âk‚â‚âÓ‚â§‚âÇ‚â\ƒŠPƒ‚æ‚â‚â×‚â‹‚â‚â_‚âã‚â‚â‚â‚âÇ‚æ'‚â‚â_‚â×‚æ#‚â‚æ'‚â·‚â‡‚âç‚â—‚â¯‚â‚âß‚â·‚â‚âË‚â‚æ‚â‡‚âo‚æ‚âo‚â—‚â×‚æ#‚â‹‚âd€¨¼)™Õ¹Ñ¥½¸É•Ñ…QÉ…­Ì ¤ì(€€¡¹•á•ÁÑ¥½¹Ìñðmt¤¹™½É…  ¡”¤€ôøì(€€€½¹ÍÐÐ€ôÑÉ…­=™á•ÁÑ¥½¸¡”¤ì(€€€”¹ÑÉ…¬€ôÐ¹ÑÉ…¬ì(€€€”¹ÍåÍÑ•´€ôÐ¹ÍåÍÑ•´ì(€€€”¹ÍåÍÑ•µU¹…ÍÍ¥¹•€ôÐ¹Õ¹…ÍÍ¥¹•ì(€ô¤ì)ô((¼¨ƒ‚âk‚â‚âÓ‚â§‚âÇ‚â_‚â_‚â×‚æ#‚æ‚âs‚â—‚æ#‚æ‚âg‚â‚æ'‚â·‚â‡‚âç‚â—‚æ‚âW‚æ#‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚âk‚â·‚â‚âŸ‚æ#‚âË‚â·‚â‹‚âç‚æ#‚â‚âÃ‚âk‚âk‚æ‚â¯‚âd€¨¼)™Õ¹Ñ¥½¸Õ¹…ÍÍ¥¹•‘½µÁ…¹¥•Ì ¤ì(€½¹ÍÐÍ••¸€ô¹•ÜM•Ð ¡¹•á•ÁÑ¥½¹Ìñðmt¤¹µ…À ¡”¤€ôø”¹½µÁ…¹ä¤¹™¥±Ñ•È¡	½½±•…¸¤¤ì(€%µÁ½ÉÑMÑ…Ñ”¹™¥±•Ì¹™½É…  ¡˜¤€ôø˜¹™½Éµ…Ð€˜˜˜¹™½Éµ…Ð¹½µÁ…¹ä€˜˜Í••¸¹…‘¡˜¹™½Éµ…Ð¹½µÁ…¹ä¤¤ì(€É•ÑÕÉ¸l¸¸¹Í••¹t¹™¥±Ñ•È ¡Œ¤€ôøŒ€„ôô€ˆ´ˆ€˜˜€…ÍåÍÑ•µ=™½µÁ…¹ä¡Œ¤¤ì)ô((¼¨ƒ‚â‚â·‚âk‚â+‚â×‚æ'‚æ‚â#‚â‚â_‚â×‚æ#‚âŸ‚âÇ‚âg‚â_‚â×‚æ#‚âg‚â×‚æ'‚âW‚â‚â·‚â‹‚âç‚æ €¨¼)™Õ¹Ñ¥½¸å±•=˜¡¥Í¼¤ì(€½¹ÍÐ€ô€­MÑÉ¥¹œ¡¥Í¼¤¹Í±¥” à°€ÄÀ¤ì(€½¹ÍÐå´€ôMÑÉ¥¹œ¡¥Í¼¤¹Í±¥” À°€Ü¤ì(€¥˜€¡€ðô€ÄÔ¤É•ÑÕÉ¸ì½‘”è€‰Äˆ°¹…µ”è€‹‚â‚â·‚âh€Ä€ Ä´ÄÔ¤ˆ°™É½´èå´€¬€ˆ´ÀÄˆ°Ñ¼èå´€¬€ˆ´ÄÔˆ°±½Í•…äè€ÄÔôì(€¥˜€¡€ðô€ÈÔ¤É•ÑÕÉ¸ì½‘”è€‰Èˆ°¹…µ”è€‹‚â‚â·‚âh€È€ ÄØ´ÈÔ¤ˆ°™É½´èå´€¬€ˆ´ÄØˆ°Ñ¼èå´€¬€ˆ´ÈÔˆ°±½Í•…äè€ÈÔôì(€½¹ÍÐ±…ÍÐ€ô¹•Ü…Ñ”¡…Ñ”¹UQ ­å´¹Í±¥” À°€Ð¤°€­å´¹Í±¥” Ô°€Ü¤°€À¤¤¹•ÑUQ…Ñ” ¤ì(€É•ÑÕÉ¸ì½‘”è€‰Ìˆ°¹…µ”èƒ‚â‚â·‚âh€Ì€ ÈØ´‘í±…ÍÑô¥€°™É½´èå´€¬€ˆ´ÈØˆ°Ñ¼è€‘íåµô´‘í±…ÍÑõ€°±½Í•…äè±…ÍÐôì)ô((¼¨ƒ‚â‚âÏ‚â¯‚âg‚âS‚â«‚æ#‚â‚â‚âß‚âg‚â‚â·‚â‚æ‚âW‚æ#‚â—‚âÃ‚â«‚âË‚âˆ€¨¼)™Õ¹Ñ¥½¸‘Õ•=˜¡”¤ì(€¥˜¡”¹‘½Õµ•¹ÑÕ•Ð¥í½¹ÍÐ±…‰•°õ‘¥ÍÁ±…åQ¥µ”¡”¹‘½Õµ•¹ÑÕ•Ð¤íÉ•ÑÕÉ¸í±…‰•°±Í¡½ÉÐé±…‰•°±‘•Ñ…¥°èM1ƒ‚æ‚â·‚â‚â«‚âË‚â‚âW‚âË‚â‡‚âk‚â‚âÓ‚â§‚âÇ‚â\ƒ‚âLƒ‚âŸ‚âÇ‚âg‚â«‚æ#‚â‚â‚âÏ‚â‚â´ƒ‚æ‚â‡‚æ#‚æ‚âo‚â—‚â×‚æ#‚â‹‚âg‚æ‚â‡‚âß‚æ#‚â·‚â«‚æ#‚â‚â/‚æ'‚âÏ‚â¯‚â‚âß‚â·‚æ‚â‚æ'‚âW‚âÇ‚æ'‚â‚â‚æ#‚âÈƒ‚æ‚â—‚âÃ‚æ‚â‡‚æ#‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÐôíô(€½¹ÍÐŒ€ô¹Í•ÑÑ¥¹Ì¹±…É¥™äì(€É•ÑÕÉ¸ì±…‰•°è€‘í”¹‘…Ñ•ôƒ‚æ‚âŸ‚â—‚âÈ€‘íŒ¹‘…¥±åÕÑ½™™ôƒ‚âd¹€°Í¡½ÉÐèŒ¹‘…¥±åÕÑ½™˜€¬€ˆƒ‚âd¸ˆ°‘•Ñ…¥°èƒ‚âW‚âÓ‚âS‚âW‚âË‚â‡‚æ‚âk‚âk‚æ‚â‚â×‚â‹‚â—‚æ‚â_‚â‡‚æ0ƒŠPƒ‚â«‚æ#‚â‚æ‚â¯‚æ'‚â¯‚âÇ‚âŸ‚â¯‚âg‚æ'‚âË‚â‚âÃ‚âƒ‚âË‚â‹‚æ‚âd€‘íŒ¹‘…¥±åÕÑ½™™ôƒ‚â‚â·‚â‚âŸ‚âÇ‚âg‚âW‚â‚âŸ‚â ƒ‚æ‚â—‚âÃ‚â+‚â×‚æ'‚æ‚â#‚â‚â‚â—‚âÇ‚âk‚âƒ‚âË‚â‹‚æ‚âd€‘íŒ¹‘…¥±åI•ÍÁ½¹‘!½ÕÉÍôƒ‚â+‚â„¹€ôì)ô((¼¨ƒ‚æ‚â·‚â‚â«‚âË‚âŒèƒ‚â«‚â‚æ'‚âË‚â‚æ‚â—‚â‚â_‚â×‚æ €¨¼)™Õ¹Ñ¥½¸‘½9¼¡ÁÉ•™¥à°­•ä¤ì(€É•ÑÕÉ¸€‘íÁÉ•™¥áô´‘íMÑÉ¥¹œ¡ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹‘…Ñ”¤¹É•Á±…” ¼´½œ°€ˆˆ¥ô´‘í­•åõ€ì)ô()™Õ¹Ñ¥½¸¥ÍÍÕ•I•ÅÕ•ÍÑ½Œ¡¥Ñ•µÌ°½ÁÑÌ¤ì(€¥˜€ ……¸ ‰É•ÅÕ•ÍÑ}±…É¥™äˆ¤€˜˜€……¸ ‰…ÁÁÉ½Ù”ˆ¤¤É•ÑÕÉ¸‘•¹ä ‹‚â·‚â·‚â‚æ‚âk‚â‚â·‚æ‚â¯‚æ'‚â+‚â×‚æ'‚æ‚â#‚âˆ¤ì(€¥˜€ …¥Ñ•µÌ¹±•¹Ñ ¤É•ÑÕÉ¸Ñ½…ÍÐ ‹‚æ‚â‡‚æ#‚â‡‚â×‚â‚âË‚â‹‚â‚âË‚â‚â_‚â×‚æ#‚âW‚æ'‚â·‚â‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚âg‚â‚â—‚âã‚æ#‚â‡‚âg‚â×‚æ$ˆ°€‰Ý…É¸ˆ¤ì(€½¹ÍÐÍ¡¥™Ñ9…µ”€ô½ÁÑÌ¹Í¡¥™Ñ9…µ”ñð€‹‚â_‚âã‚â‚â‚âÀˆì(€½¹ÍÐ‘Õ”€ô‘Õ•=˜¡¥Ñ•µÍlÁt¤ì(€½¹ÍÐ¡Ñµ°€ô½Ì¹É•ÅÕ•ÍÑ!Ñµ°¡ì(€€€‘½9¼è‘½9¼ ‰IDˆ°½ÁÑÌ¹­•ä¤°(€€€ÑÉ…­9…µ”èÑÉ…­5•Ñ„¡¥Ñ•µÍlÁt¹ÑÉ…¬¤¹¹…µ”°(€€€¥ÍÍÕ•‘ÐèÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹‘…Ñ”°(€€€Á•É¥½‘1…‰•°è½ÁÑÌ¹Á•É¥½‘1…‰•°°(€€€‘Õ•1…‰•°è‘Õ”¹±…‰•°°(€€€Ñ½9…µ”è½ÁÑÌ¹Ñ½9…µ”ñð€‹‚â¯‚âÇ‚âŸ‚â¯‚âg‚æ'‚âË‚â‚âÀ€ˆ€¬Í¡¥™Ñ9…µ”°(€€€Í¡¥™Ñ9…µ”°(€€€½µÁ…¹å9…µ”èÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä€ôôô€‰10ˆ€ü€‹‚â_‚âã‚â‚âk‚â‚âÓ‚â§‚âÇ‚â\ˆ€èÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä°(€€€™É½µ9…µ”è€‹‚æ‚âs‚âg‚â‚â·‚â·‚âS‚âÓ‚â\ˆ°(€€€¥ÍÍÕ•ÈèÕÉÉ•¹ÑUÍ•È ¤¹¹…µ”€¬€ˆ€ ˆ€¬ÕÉÉ•¹ÑUÍ•È ¤¹ÕÍ•É¹…µ”€¬€ˆ¤ˆ°(€€€¥Ñ•µÌè¥Ñ•µÌ¹µ…À ¡¥Ñ•´¤€ôø€¡ì€¸¸¹¥Ñ•´°‘¥ÍÁ±…å…Í”è…Í•1…‰•°¡¥Ñ•´¤ô¤¤°(€€€‘…Ñ”è¥Ñ•µÍlÁt¹‘…Ñ”ñðÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹‘…Ñ”°(€€€ÍÑ…µÀè¹½ÝMÑ…µÀ ¤°(€ô¤ì(€½Ì¹ÁÉ¥¹Ð¡¡Ñµ°°‘½9¼ ‰IDˆ°½ÁÑÌ¹­•ä¤¤ì(€¥Ñ•µÌ¹™½É…  ¡”¤€ôøì(€€€¥˜€¡”¹ÍÑ…ÑÕÌ€ôôô€‰½Á•¸ˆ¤”¹ÍÑ…ÑÕÌ€ô€‰±…É¥™å¥¹œˆì(€€€Í…Ù•=Ù•ÉÉ¥‘”¡”¤ì(€ô¤ì(€±½Ñ¥½¸ ‰¥ÍÍÕ•}‘½Œˆ°€‰±…É¥™¥…Ñ¥½¸ˆ°‘½9¼ ‰IDˆ°½ÁÑÌ¹­•ä¤°ƒ‚â·‚â·‚â‚æ‚âk‚â‚â·‚æ‚â¯‚æ'‚â+‚â×‚æ'‚æ‚â#‚â€‘í¥Ñ•µÌ¹±•¹Ñ¡ôƒ‚â‚âË‚â‹‚â‚âË‚âŒƒ
Ü€‘í½ÁÑÌ¹Á•É¥½‘1…‰•±õ€¤ì(€Ñ½…ÍÐ¡ƒ‚â·‚â·‚â‚æ‚âk‚â‚â·‚æ‚â¯‚æ'‚â+‚â×‚æ'‚æ‚â#‚â€‘í¥Ñ•µÌ¹±•¹Ñ¡ôƒ‚â‚âË‚â‹‚â‚âË‚â‚æ‚â—‚æ'‚âœƒŠPƒ‚æ‚â—‚âß‚â·‚â€‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚âo‚æ‚âdAˆƒ‚æ‚âg‚â¯‚âg‚æ'‚âË‚âW‚æ#‚âË‚â‚â{‚âÓ‚â‡‚â{‚æ1€¤ì(€É•¹‘•È ¤ì)ô()™Õ¹Ñ¥½¸¥ÍÍÕ•±…É¥™¥…Ñ¥½¹½Œ¡”°¹…ÉÉ…Ñ¥Ù”¤ì(€½¹ÍÐä€ôå±•=˜¡”¹‘…Ñ”¤ì(€½¹ÍÐ¡Ñµ°€ô½Ì¹±…É¥™¥…Ñ¥½¹!Ñµ°¡ì(€€€‘½9¼è‘½9¼ ‰1Hˆ°”¹¥¤°(€€€•àèì€¸¸¹”°‘¥ÍÁ±…å…Í”è…Í•1…‰•°¡”¤ô°(€€€‰É…¹è€¡¹½µÁ…¹¥•Ì¹™¥¹ ¡Œ¤€ôøŒ¹½‘”€ôôô”¹½µÁ…¹ä¤ñðíô¤¹¹…µ”ñð”¹½µÁ…¹ä°(€€€Í¡¥™Ñ9…µ”è€¡¹Í¡¥™ÑÌ¹™¥¹ ¡Ì¤€ôøÌ¹½‘”€ôôô”¹Í¡¥™Ð¤ñðíô¤¹¹…µ”ñð”¹Í¡¥™Ð°(€€€ÑÉ…­9…µ”èÑÉ…­5•Ñ„¡”¹ÑÉ…¬¤¹¹…µ”°(€€€å±•9…µ”èä¹¹…µ”°(€€€Ñ¥Ñ±”è€‘í”¹ÑåÁ•9…µ•ôƒŠP€‘í”¹…½Õ¹Ñôƒ‚â‹‚â·‚âP€‘íµ½¹•ä¡”¹É¥Í­µ½Õ¹Ðñð5…Ñ ¹…‰Ì¡”¹…µ½Õ¹Ñ¥™˜¤¥ôƒ‚âk‚âË‚â\ƒ‚æ‚âŸ‚â—‚âÈ€‘í”¹Ñ¥µ•õ€°(€€€Í•Ù•É¥Ñå9…µ”èÍ•Ù5•Ñ„¡”¹Í•Ù•É¥Ñä¤¹¹…µ”°(€€€ÍÑ…ÑÕÍ9…µ”è…Í•MÑ…ÑÕÍ5•Ñ„¡”¤¹¹…µ”°(€€€‘…µ…”è”¹ÍÑ…ÑÕÌ€ôôô€‰‘…µ…”ˆ°(€€€¹…ÉÉ…Ñ¥Ù”è¹…ÉÉ…Ñ¥Ù”°(€€€É•ÍÁ½¹‘•Èè€¡¹ÕÍ•ÉÌ¹™¥¹ ¡Ô¤€ôøÔ¹É½±”€ôôô€‰Í¡¥™Ñ}±•…ˆ€˜˜Ô¹Í¡¥™Ð€ôôô”¹Í¡¥™Ð¤ñðíô¤¹¹…µ”°(€€€¥ÍÍÕ•ÈèÕÉÉ•¹ÑUÍ•È ¤¹¹…µ”€¬€ˆ€ ˆ€¬ÕÉÉ•¹ÑUÍ•È ¤¹ÕÍ•É¹…µ”€¬€ˆ¤ˆ°(€€€¥ÍÍÕ•‘ÐèÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹‘…Ñ”°(€€€ÍÑ…µÀè¹½ÝMÑ…µÀ ¤°(€ô¤ì(€½Ì¹ÁÉ¥¹Ð¡¡Ñµ°°‘½9¼ ‰1Hˆ°”¹¥¤¤ì(€±½Ñ¥½¸ ‰¥ÍÍÕ•}‘½Œˆ°€‰±…É¥™¥…Ñ¥½¸ˆ°‘½9¼ ‰1Hˆ°”¹¥¤°€‹‚â·‚â·‚â‚æ‚â·‚â‚â«‚âË‚â‚â+‚â×‚æ'‚æ‚â#‚â‚â'‚âk‚âÇ‚âk‚â«‚â‡‚âk‚âç‚â‚âO‚æ0ˆ¤ì(€Ñ½…ÍÐ¡ƒ‚â·‚â·‚â‚æ‚â·‚â‚â«‚âË‚â‚â+‚â×‚æ'‚æ‚â#‚â€‘í”¹¥‘ôƒ‚æ‚â—‚æ'‚âœƒŠPƒ‚æ‚â—‚âß‚â·‚â€‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚âo‚æ‚âdAˆƒ‚æ‚âg‚â¯‚âg‚æ'‚âË‚âW‚æ#‚âË‚â‚â{‚âÓ‚â‡‚â{‚æ1€¤ì)ô()Y%]L¹±…É¥™ä€ô€¡É½½Ð¤€ôøì(€¥˜€ …•¹ÍÕÉ•1¥Ù•=Ù•ÉÙ¥•Ü¡É½½Ð¤¤É•ÑÕÉ¸ì(€¥˜€¡ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€‰ÁÉ½‘ÕÑ¥½¸ˆ€˜˜Mˆ¹Í¥¹•‘%¸ ¤¤ì(€€€¥˜€ …±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹•á•ÁÑ¥½¹ÍI•…‘ä¤ì(€€€€€É½½Ð¹¥¹¹•É!Q50€ô€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆÉ½±”ô‰ÍÑ…ÑÕÌˆ…É¥„µ‰ÕÍäôˆ‘í±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹±½…‘¥¹œñð±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹…Õá¥±¥…Éå1½…‘¥¹ôˆøñ Èø‘í±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹…Õá¥±¥…ÉåÉÉ½È€ü€Ÿ‚â‹‚âÇ‚â‚æ‚â¯‚â—‚âS‚â‚âË‚â‹‚â‚âË‚â‚æ‚â‚â«‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â œ€è€Ÿ‚â‚âÏ‚â—‚âÇ‚â‚æ‚â¯‚â—‚âS‚â‚âË‚â‹‚â‚âË‚â‚æ‚â‚â«‚â#‚â‚âÓ‚âŠ˜ôð½ ÈøñÀûŠPƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â«‚â‚âã‚âo‚âŸ‚æ#‚âË‚æ‚â‡‚æ#‚â‡‚â×‚æ‚â‚â«‚â¯‚â‚âß‚â·‚â‹‚â·‚âS‚æ‚âo‚æ‚âg‚â£‚âç‚âg‚â‹‚æ0ƒ
Üƒ‚â‚â‚âk‚â‚âÓ‚â§‚âÇ‚â_‚æ‚â—‚âÃ‚â+‚æ#‚âŸ‚â‚âŸ‚âÇ‚âg‚â_‚â×‚æ#‚â_‚â×‚æ#‚æ‚â—‚âß‚â·‚âð½ÀøñÀø‘í ¡±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹…Õá¥±¥…ÉåÉÉ½Èñð€œœ¥ôð½Àøñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰±…É¥™å1½…‘I•ÑÉäˆû‚â—‚â·‚â‚æ‚â¯‚â—‚âS‚â‚âË‚â‹‚â‚âË‚â‚â·‚â×‚â‚â‚â‚âÇ‚æ'‚âð½‰ÕÑÑ½¸øð½Í•Ñ¥½¸ù€ì(€€€€€€ œ±…É¥™å1½…‘I•ÑÉäœ¤¹½¹±¥¬€ô€ ¤€ôø±½…‘1¥Ù•=Ù•ÉÙ¥•Ü¡ÑÉÕ”¤ì(€€€€€É•ÑÕÉ¸ì(€€€ô(€€€½¹ÍÐÉ½ÝÌ€ôÍ½Á•‘á•ÁÑ¥½¹Ì ¤¹™¥±Ñ•È ¡”¤€ôø€…”¹±½ÍÕÉ•I•ÅÕ•ÍÑ%˜™l‰½Á•¸ˆ°€‰±…É¥™å¥¹œˆ°€‰…¹ÍÝ•É•‰t¹¥¹±Õ‘•Ì¡”¹ÍÑ…ÑÕÌ¤˜˜¡ÍÑ…Ñ”¹É½±”„ôôÍ¡¥™Ñ}±•…ñð„…”¹É•ÅÕ•ÍÑ•‘Ð¤¤ì(€€€½¹ÍÐ¹•ÝI½ÝÌ€ôÉ½ÝÌ¹™¥±Ñ•È ¡”¤€ôø”¹ÍÑ…ÑÕÌ€ôôô€‰½Á•¸ˆ¤ì(€€€½¹ÍÐÝ…¥Ñ¥¹I½ÝÌ€ôÉ½ÝÌ¹™¥±Ñ•È ¡”¤€ôø”¹ÍÑ…ÑÕÌ€ôôô€‰±…É¥™å¥¹œˆ¤ì(€€€½¹ÍÐ…¹ÍÝ•É•‘I½ÝÌ€ôÉ½ÝÌ¹™¥±Ñ•È ¡”¤€ôø”¹ÍÑ…ÑÕÌ€ôôô€‰…¹ÍÝ•É•ˆ¤ì(€€€½¹ÍÐÉ½ÕÁÌ€ôl¸¸¹¹•ÜM•Ð¡É½ÝÌ¹µ…À ¡”¤€ôø”¹½µÁ…¹äñð€‹‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âàˆ¤¥t¹Í½ÉÐ ¡„°ˆ¤€ôø„¹±½…±•½µÁ…É”¡ˆ°€‰Ñ ˆ¤¤ì(€€€É½½Ð¹¥¹¹•É!Q50€ô€(€€€€€€‘í±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹…Õá¥±¥…ÉåÉÉ½È€ü€ñÍ•Ñ¥½¸±…ÍÌô‰…±•ÉÐÝ…É¸ˆÉ½±”ô‰ÍÑ…ÑÕÌˆû‚â‚æ'‚â·‚â‡‚âç‚â—‚â—‚æ#‚âË‚â«‚âã‚âS‚â‹‚âÇ‚â‚â‡‚âË‚æ‚â‡‚æ#‚â‚â‚âhƒ
Üƒ‚æ‚â«‚âS‚â‚â‚æ'‚â·‚â‡‚âç‚â—‚â_‚â×‚æ#‚æ‚â¯‚â—‚âS‚æ‚âS‚æ'‚â‚â‚âÇ‚æ'‚â‚â‚æ#‚â·‚âdƒ‚æ‚â‡‚æ#‚æ‚â+‚æ#‚â‹‚â·‚âS‚â£‚âç‚âg‚â‹‚æ0è€‘í ¡±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹…Õá¥±¥…ÉåÉÉ½È¥ôð½Í•Ñ¥½¸ù€€è€œô(€€€€€€‘íµ½É•…Í•MÑ…Ñ”¹¡…Í5½É”€ü€œñÍ•Ñ¥½¸±…ÍÌô‰…±•ÉÐÝ…É¸ˆû‚â‚âË‚â‹‚â‚âË‚â‚â_‚â×‚æ#‚æ‚â¯‚â—‚âS‚â·‚âË‚â#‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‚â‚âhƒ‚â‚â‚âã‚âO‚âË‚â‚â‚â·‚â‚âk‚â‚âÓ‚â§‚âÇ‚â_‚â¯‚â‚âß‚â·‚â+‚æ#‚âŸ‚â‚âŸ‚âÇ‚âg‚â_‚â×‚æ#‚æ‚â¯‚æ'‚æ‚â‚âk‚â—‚â‚â‚æ#‚â·‚âg‚â«‚â‚âã‚âo‚â#‚âÏ‚âg‚âŸ‚âg‚â‚âŸ‚â„ð½Í•Ñ¥½¸øœ€è€œô(€€€€€€ñÍ•Ñ¥½¸±…ÍÌô‰ÍÑ…ÑÕÌµÍÑÉ¥À™½ÕÈˆø(€€€€€€€€ñ…ÉÑ¥±”±…ÍÌô‰Ý…É¸ˆøñÍÁ…¸û‚æ‚â‚â«‚æ‚â¯‚â‡‚æ ƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â«‚æ#‚â‚â+‚â×‚æ'‚æ‚â#‚âð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡¹•ÝI½ÝÌ¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚âW‚æ'‚â·‚â‚âW‚â‚âŸ‚â#‚æ‚â—‚âÃ‚â«‚æ#‚â‚æ‚â¯‚æ'‚â_‚â×‚â„ð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€€€ñ…ÉÑ¥±”øñÍÁ…¸û‚âk‚â‚âÓ‚â§‚âÇ‚â_‚â_‚â×‚æ#‚æ‚â‚â×‚æ#‚â‹‚âŸ‚â‚æ'‚â·‚âð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡É½ÕÁÌ¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚æ‚â‡‚æ#‚æ‚âk‚æ#‚â‚â‚âÀð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€€€ñ…ÉÑ¥±”øñÍÁ…¸û‚â«‚æ#‚â‚æ‚â—‚æ'‚âœƒ‚â‚â·‚â_‚â×‚â‡‚âW‚â·‚âhð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡Ý…¥Ñ¥¹I½ÝÌ¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚â‚âÏ‚â—‚âÇ‚â‚âW‚âÓ‚âS‚âW‚âË‚â‡‚â‚âÏ‚â+‚â×‚æ'‚æ‚â#‚âð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€€€ñ…ÉÑ¥±”±…ÍÌô‰½¬ˆøñÍÁ…¸û‚â_‚â×‚â‡‚âW‚â·‚âk‚æ‚â—‚æ'‚âœð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡…¹ÍÝ•É•‘I½ÝÌ¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚â‚â´Õ‘¥Ðƒ‚âW‚â‚âŸ‚â#‚æ‚â—‚âÃ‚â·‚âg‚âã‚â‡‚âÇ‚âW‚âÐð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ð½Í•Ñ¥½¸ø(€€€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆù½µÁ…¹äÝ½É­™±½Üð½Àøñ Èû‚â‚âË‚âg‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚â‹‚â‚âW‚âË‚â‡‚âk‚â‚âÓ‚â§‚âÇ‚â\ð½ ÈøñÍµ…±°±…ÍÌô‰¡•…µÍÕˆˆû‚â‚âS‚â‚âË‚â‚æ3‚âS‚âk‚â‚âÓ‚â§‚âÇ‚â_‚æ‚â{‚âß‚æ#‚â·‚æ‚âo‚âÓ‚âS‚â‚âË‚â‹‚â‚âË‚â‚â_‚â×‚æ#‚âW‚æ'‚â·‚â‚âS‚âÏ‚æ‚âg‚âÓ‚âg‚â‚âË‚â‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âPð½Íµ…±°øð½‘¥Øøñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸Í´ˆ¥ô‰½Á•¹ÁÁÉ½Ù…±EÕ•Õ”ˆ€‘í…¹ÍÝ•É•‘I½ÝÌ¹±•¹Ñ €ü€ˆˆ€è€‰‘¥Í…‰±•‰ôû‚âW‚â‚âŸ‚â#‚â‚âÏ‚â+‚â×‚æ'‚æ‚â#‚â‚â_‚â×‚æ#‚âW‚â·‚âk‚æ‚â—‚æ'‚âœ€ ‘í¹Õ´¡…¹ÍÝ•É•‘I½ÝÌ¹±•¹Ñ ¥ô¤ð½‰ÕÑÑ½¸øð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰½µÁ…¹äµ½Ù•ÉÙ¥•ÜµÉ¥ˆø‘íÉ½ÕÁÌ¹µ…À ¡½µÁ…¹ä¤€ôøì(€€€€€€€€€½¹ÍÐ½Ý¸€ôÉ½ÝÌ¹™¥±Ñ•È ¡”¤€ôø€¡”¹½µÁ…¹äñð€‹‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âàˆ¤€ôôô½µÁ…¹ä¤ì(€€€€€€€€€½¹ÍÐ½Ý¹9•Ü€ô½Ý¸¹™¥±Ñ•È ¡”¤€ôø”¹ÍÑ…ÑÕÌ€ôôô€‰½Á•¸ˆ¤¹±•¹Ñ ì(€€€€€€€€€½¹ÍÐ½Ý¹]…¥Ñ¥¹œ€ô½Ý¸¹™¥±Ñ•È ¡”¤€ôø”¹ÍÑ…ÑÕÌ€ôôô€‰±…É¥™å¥¹œˆ¤¹±•¹Ñ ì(€€€€€€€€€½¹ÍÐ½Ý¹¹ÍÝ•É•€ô½Ý¸¹™¥±Ñ•È ¡”¤€ôø”¹ÍÑ…ÑÕÌ€ôôô€‰…¹ÍÝ•É•ˆ¤¹±•¹Ñ ì(€€€€€€€€€É•ÑÕÉ¸€ñ…ÉÑ¥±”±…ÍÌô‰½µÁ…¹äµ½Ù•ÉÙ¥•Üµ…É…Ñ¥½¸µ…ÉˆÉ½±”ô‰‰ÕÑÑ½¸ˆÑ…‰¥¹‘•àôˆÀˆ‘…Ñ„µ±…É¥™äµ½µÁ…¹äôˆ‘í ¡½µÁ…¹ä¥ôˆ…É¥„µ±…‰•°ô‹‚æ‚âo‚âÓ‚âS‚æ‚â‚â«‚â‚â·‚â‚âk‚â‚âÓ‚â§‚âÇ‚â\€‘í ¡½µÁ…¹ä¥ôˆøñ‘¥Ø±…ÍÌô‰½µÁ…¹äµ…Éµ¡•…ˆøñ‘¥ØøñÍÑÉ½¹œø‘í ¡½µÁ…¹ä¥ôð½ÍÑÉ½¹œøñÍÁ…¸ø‘í¹Õ´¡½Ý¸¹±•¹Ñ ¥ôƒ‚æ‚â‚â¨ð½ÍÁ…¸øð½‘¥ØøñÍµ…±°±…ÍÌôˆ‘í½Ý¸¹Í½µ” ¡”¤€ôø”¹½Ù•ÉM±„¤€ü€‰‘…¹•Èˆ€è€ˆ‰ôˆû‚æ‚â‚âÓ‚âdM1€‘í¹Õ´¡½Ý¸¹™¥±Ñ•È ¡”¤€ôø”¹½Ù•ÉM±„¤¹±•¹Ñ ¥ôð½Íµ…±°øð½‘¥Øøñ‘¥Ø±…ÍÌô‰½µÁ…¹äµµ•ÑÉ¥ÌˆøñÍÁ…¸û‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â«‚æ#‚â€ñˆø‘í¹Õ´¡½Ý¹9•Ü¥ôð½ˆøð½ÍÁ…¸øñÍÁ…¸±…ÍÌô‰Ý…É¸ˆû‚â‚â·‚â_‚â×‚â‡‚âW‚â·‚âh€ñˆø‘í¹Õ´¡½Ý¹]…¥Ñ¥¹œ¥ôð½ˆøð½ÍÁ…¸øñÍÁ…¸±…ÍÌô‰½¬ˆû‚âW‚â·‚âk‚æ‚â—‚æ'‚âœ€ñˆø‘í¹Õ´¡½Ý¹¹ÍÝ•É•¥ôð½ˆøð½ÍÁ…¸øñÍÁ…¸±…ÍÌô‰‰…ˆû‚â‹‚â·‚âS‚æ‚â«‚â×‚æ#‚â‹‚â€ñˆø‘íµ½¹•äÀ¡ÍÕµI¥Í¬¡½Ý¸¤¥ôð½ˆøð½ÍÁ…¸øð½‘¥Øøñ‘¥Ø±…ÍÌô‰½µÁ…¹äµ…Éµ…Ñ¥½¸ˆû‚âS‚âç‚æ‚â‚â«‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âP€ñÍÁ…¸…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆûŠHð½ÍÁ…¸øð½‘¥Øøð½…ÉÑ¥±”ù€ì(€€€€€€€ô¤¹©½¥¸ ˆˆ¤ñð€ñÀ±…ÍÌô‰•µÁÑäµ‰½àˆû‚æ‚â‡‚æ#‚â‡‚â×‚â‚âË‚âg‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚âg‚â+‚æ#‚âŸ‚â‚â_‚â×‚æ#‚æ‚â—‚âß‚â·‚âð½Àùôð½‘¥Øø(€€€€€€ð½Í•Ñ¥½¸ø(€€€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆøñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆû‚â‚âË‚â‹‚â‚âË‚â‚â#‚â‚âÓ‚âð½Àøñ Èû‚æ‚â‚â«‚â_‚â×‚æ#‚âW‚æ'‚â·‚â‚âW‚âÓ‚âS‚âW‚âË‚â„ð½ Èøð½‘¥Øøð½‘¥Øøñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…ÀˆøñÑ…‰±”øñÑ¡•…øñÑÈøñÑ û‚æ‚â‚â¨ð½Ñ øñÑ û‚âŸ‚âÇ‚âg‚â_‚â×‚æ ð½Ñ øñÑ û‚âk‚â‚âÓ‚â§‚âÇ‚â\ð½Ñ øñÑ û‚âo‚â‚âÃ‚æ‚âƒ‚â\ð½Ñ øñÑ û‚âs‚âç‚æ'‚æ‚â‚â×‚æ#‚â‹‚âŸ‚â‚æ'‚â·‚âð½Ñ øñÑ û‚â«‚â[‚âË‚âg‚âÀð½Ñ øñÑ ùM1ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚â‹‚â·‚âS‚â_‚â×‚æ#‚âW‚æ'‚â·‚â‚âW‚â‚âŸ‚â ð½Ñ øð½ÑÈøð½Ñ¡•…øñÑ‰½‘äø‘íÉ½ÝÌ¹µ…À ¡”¤€ôø€ñÑÈøñÑøñ‰ÕÑÑ½¸±…ÍÌô‰±¥¹¬µ‰Ñ¸ˆ‘…Ñ„µ½Á•¸µ•àôˆ‘í ¡”¹¥¥ôˆø‘í ¡…Í•1…‰•°¡”¤¥ôð½‰ÕÑÑ½¸øð½ÑøñÑø‘í ¡”¹‘…Ñ”¥ô€‘í ¡”¹Ñ¥µ”¥ôð½ÑøñÑøñˆø‘í ¡”¹½µÁ…¹ä¥ôð½ˆøð½ÑøñÑø‘í ¡”¹ÑåÁ•9…µ”¥ôð½ÑøñÑø‘í ¡”¹•µÁ±½å•”¥ôð½ÑøñÑøñÍÁ…¸±…ÍÌô‰‰…‘”€‘í…Í•MÑ…ÑÕÍ5•Ñ„¡”¤¹Ñ½¹•ôˆø‘í ¡…Í•MÑ…ÑÕÍ5•Ñ„¡”¤¹¹…µ”¥ôð½ÍÁ…¸øð½ÑøñÑ±…ÍÌôˆ‘í”¹½Ù•ÉM±„€ü€‰‘…¹•Èˆ€è€ˆ‰ôˆø‘í”¹½Ù•ÉM±„€ü€‹‚æ‚â‚âÓ‚âd€ˆ€è€ˆ‰ô‘í¹Õ´¡”¹…•!½ÕÉÌ¥ô¼‘í¹Õ´¡”¹Í±…!½ÕÉÌ¥ôƒ‚â+‚â„¸ð½ÑøñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘íµ½¹•äÀ¡”¹É¥Í­µ½Õ¹Ðñð5…Ñ ¹…‰Ì¡”¹…µ½Õ¹Ñ¥™˜¤¥ôð½Ñøð½ÑÈù€¤¹©½¥¸ ˆˆ¤ñð€ñÑÈøñÑ½±ÍÁ…¸ôˆàˆ±…ÍÌô‰•µÁÑäˆû‚æ‚â‡‚æ#‚â‡‚â×‚â‚âË‚â‹‚â‚âË‚âŒð½Ñøð½ÑÈùôð½Ñ‰½‘äøð½Ñ…‰±”øð½‘¥Øøð½Í•Ñ¥½¸ù€ì(€€€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µ½Á•¸µ•átˆ¤¹™½É…  ¡‰ÕÑÑ½¸¤€ôø‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°…Íå¹Œ€ ¤€ôøì(€€€€€½¹ÍÐ¥õ‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹½Á•¹àì(€€€€€€¼¼½µÁ…¹äÉ•™É•Í µ…ä±•…ÈÑ¡”É½Ü…¡”Ý¡¥±”¥ÑÌÁÉ•Í•ÉÙ•=4¥Ì(€€€€€€¼¼ÍÑ¥±°Ù¥Í¥‰±”¸I”µÉ•…Ñ¡”Í•±•Ñ•UU%Õ¹‘•ÈI1L¥¹ÍÑ•…½˜±…¥µ¥¹œ(€€€€€€¼¼Ñ¡”Á•ÉÍ¥ÍÑ•…Í”¥Ìµ¥ÍÍ¥¹œ¸9¼•áÑÉ„É•…½¸Ñ¡”¹½Éµ…°Á…Ñ ¸(€€€€€ÑÉäì(€€€€€€€¥˜¡¹•á•ÁÑ¥½¹Ì¹Í½µ”¡É½ÜôùÉ½Ü¹¥ôôõ¥¤¥…Ý…¥Ð½Á•¹á•ÁÑ¥½¸¡¥¤ì(€€€€€€€•±Í”…Ý…¥Ð½Á•¹Ù¥‘•¹•I•±…Ñ•‘…Í”¡¥¤ì(€€€€€ô…Ñ ¡•ÉÉ½È¤ìÑ½…ÍÐ Ÿ‚æ‚âo‚âÓ‚âS‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âS‚æ‚â‚â«‚æ‚â‡‚æ#‚æ‚âS‚æ$è€œ­•ÉÉ½È¹µ•ÍÍ…”°Ý…É¸œ¤ìô(€€€ô¤¤ì(€€€½¹ÍÐ½Á•¹½µÁ…¹å…Í•Ì€ô€¡½µÁ…¹ä¤€ôøì(€€€€€¥˜€¡ÍÑ…Ñ”¹É½±”€ôôô€Í¡¥™Ñ}±•…œ¤ì(€€€€€€€€¼¼M…µ”µÉ½ÕÑ”¡…Í …ÍÍ¥¹µ•¹Ð•µ¥ÑÌ¹¼¡…Í¡¡…¹”¸I•Á…¥¹ÐÑ¡”…±É•…‘ä(€€€€€€€€¼¼Í½Á•É•…µ½¹±äÍ¹…ÁÍ¡½Ð°­••Á¥¹œ‘…Ñ•Ì°‘É…™ÑÌ…¹…Í”ÍÑ…Ñ”¸(€€€€€€€ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä€ô½µÁ…¹äì(€€€€€€€É•¹‘•È ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€€€ô(€€€€€¼ ‰•á•ÁÑ¥½¹Ìˆ°ì(€€€€€€€™¥±Ñ•ÉÌèì½µÁ…¹äô°(€€€€€€€•á¥±Ñ•ÈèìÄè€ˆˆ°ÑåÁ”è€‰10ˆ°Í•Ù•É¥Ñäè€‰10ˆ°ÍÑ…ÑÕÌè€‰Q%=8ˆ°Í±„è™…±Í”ô°(€€€€€ô¤ì(€€€ôì(€€€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µ±…É¥™äµ½µÁ…¹åtˆ¤¹™½É…  ¡…É¤€ôøì(€€€€€…É¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø½Á•¹½µÁ…¹å…Í•Ì¡…É¹‘…Ñ…Í•Ð¹±…É¥™å½µÁ…¹ä¤¤ì(€€€€€…É¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰­•å‘½Ý¸ˆ°€¡•Ù•¹Ð¤€ôøì(€€€€€€€¥˜€¡•Ù•¹Ð¹­•ä€ôôô€‰¹Ñ•Èˆñð•Ù•¹Ð¹­•ä€ôôô€ˆ€ˆ¤ì(€€€€€€€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€€€€€€€½Á•¹½µÁ…¹å…Í•Ì¡…É¹‘…Ñ…Í•Ð¹±…É¥™å½µÁ…¹ä¤ì(€€€€€€€ô(€€€€€ô¤ì(€€€ô¤ì(€€€¥˜¡ÍÑ…Ñ”¹É½±”ôôôÍ¡¥™Ñ}±•…œ¤€ œ½Á•¹ÁÁÉ½Ù…±EÕ•Õ”œ¤¹¡¥‘‘•¸õÑÉÕ”ì(€€€€ ˆ½Á•¹ÁÁÉ½Ù…±EÕ•Õ”ˆ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøí¥˜¡ÍÑ…Ñ”¹É½±”„ôôÍ¡¥™Ñ}±•…œ¥¼¡…¸ …ÁÁÉ½Ù”œ¤ü‰…ÁÁÉ½Ù…±Ìˆè‰…Õ‘¥ÐµÉ•Ù¥•Üˆ¤íô¤ì(€€€É•ÑÕÉ¸ì(€ô(€É•Ñ…QÉ…­Ì ¤ì(€½¹ÍÐ…±°€ôÍ½Á•‘á•ÁÑ¥½¹Ì ¤¹™¥±Ñ•È ¡”¤€ôø€…l‰±½Í•ˆ°€‰…ÁÁÉ½Ù•‰t¹¥¹±Õ‘•Ì¡”¹ÍÑ…ÑÕÌ¤¤ì(€½¹ÍÐ‘…¥±ä€ô…±°ì(€½¹ÍÐåŒ€ômtì(€½¹ÍÐŒ€ô¹Í•ÑÑ¥¹Ì¹±…É¥™äì(€½¹ÍÐa€ôÍåÍ5•Ñ„ ‰aˆ¤ì(€½¹ÍÐLÄÈÌ€ôÍåÍ5•Ñ„ ‰MeLÄÈÌˆ¤ì(€½¹ÍÐ­¹½Ý¸€ôl¸¸¹¹•ÜM•Ð¡½µÁ…¹å5…ÍÑ•È ¤¹µ…À ¡à¤€ôøà¹½‘”¤¹½¹…Ð¡…±°¹µ…À ¡”¤€ôø”¹½µÁ…¹ä¤¤¥t¹™¥±Ñ•È ¡à¤€ôøà€˜˜à€„ôô€ˆ´ˆ¤ì(€½¹ÍÐÁ•¹‘¥¹œ€ô­¹½Ý¸¹™¥±Ñ•È ¡½‘”¤€ôø€…ÍåÍÑ•µ=™½µÁ…¹ä¡½‘”¤¤ì(€½¹ÍÐÁ•¹‘¥¹Ñ¥Ù”€ôÕ¹…ÍÍ¥¹•‘½µÁ…¹¥•Ì ¤ì€¼¼ƒ‚â_‚â×‚æ#‚â‡‚â×‚â‚æ'‚â·‚â‡‚âç‚â—‚æ‚â‚æ'‚âË‚â‡‚âË‚æ‚â—‚æ'‚âŸ‚æ‚âW‚æ#‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â‚âÏ‚â¯‚âg‚âP((€€¼¨ƒ‚â‚âÃ‚âk‚âhaèƒ‚â#‚âÇ‚âS‚â‚â—‚âã‚æ#‚â‡‚âW‚âË‚â‡‚â‚âÃ‚æ‚â{‚âß‚æ#‚â·‚â«‚æ#‚â‚â¯‚âÇ‚âŸ‚â¯‚âg‚æ'‚âË‚â‚âÃ‚æ‚âW‚æ#‚â—‚âÃ‚â‚âÀ€¨¼(€½¹ÍÐ‰åM¡¥™Ð€ô¹Í¡¥™ÑÌ¹µ…À ¡Ì¤€ôø€¡ì(€€€Í¡¥™ÐèÌ°(€€€¥Ñ•µÌè‘…¥±ä¹™¥±Ñ•È ¡”¤€ôø”¹Í¡¥™Ð€ôôôÌ¹½‘”¤°(€€€±•…è¹ÕÍ•ÉÌ¹™¥¹ ¡Ô¤€ôøÔ¹É½±”€ôôô€‰Í¡¥™Ñ}±•…ˆ€˜˜Ô¹Í¡¥™Ð€ôôôÌ¹½‘”¤°(€ô¤¤ì((€€¼¨ƒ‚â‚âÃ‚âk‚âh€ÄÈÌèƒ‚â#‚âÇ‚âS‚â‚â—‚âã‚æ#‚â‡‚âW‚âË‚â‡‚â‚â·‚âk‚âW‚â×‚æ‚â‚â—‚æ0€¨¼(€½¹ÍÐå±•Ì€ôíôì(€åŒ¹™½É…  ¡”¤€ôøì(€€€½¹ÍÐä€ôå±•=˜¡”¹‘…Ñ”¤ì(€€€€¡å±•Ímä¹½‘•t€ôå±•Ímä¹½‘•tñðìä°¥Ñ•µÌèmtô¤¹¥Ñ•µÌ¹ÁÕÍ ¡”¤ì(€ô¤ì(€½¹ÍÐå±•1¥ÍÐ€ô=‰©•Ð¹Ù…±Õ•Ì¡å±•Ì¤¹Í½ÉÐ ¡„°ˆ¤€ôø„¹ä¹½‘”¹±½…±•½µÁ…É”¡ˆ¹ä¹½‘”¤¤ì((€É½½Ð¹¥¹¹•É!Q50€ô€(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰ÍÑ…ÑÕÌµÍÑÉ¥À™½ÕÈˆø(€€€€€€ñ…ÉÑ¥±”±…ÍÌôˆ‘í‘…¥±ä¹±•¹Ñ €ü€‰Ý…É¸ˆ€è€‰½¬‰ôˆøñÍÁ…¸û‚â‚âË‚â‹‚â‚âË‚â‚â+‚â×‚æ'‚æ‚â#‚â‚æ‚âk‚âk‚æ‚â‚â×‚â‹‚â—‚æ‚â_‚â‡‚æ0ð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡‘…¥±ä¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚æ‚â‡‚æ#‚â‚âŸ‚âk‚â‚â·‚â‚âË‚â‹‚æ‚âS‚âß‚â·‚âdð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”øñÍÁ…¸û‚â‚âÏ‚â¯‚âg‚âS‚âW‚âÓ‚âS‚âW‚âË‚â„ð½ÍÁ…¸øñÍÑÉ½¹œø‘í ¡Œ¹‘…¥±åÕÑ½™˜¥ôƒ‚âd¸ð½ÍÑÉ½¹œøñÍµ…±°û‚æ‚â+‚æ'‚â‚âÇ‚âk‚â_‚âã‚â‚â‚âÃ‚âk‚âk‚æ‚â—‚âÃ‚â_‚âã‚â‚âk‚â‚âÓ‚â§‚âÇ‚â\ð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”øñÍÁ…¸û‚â+‚â×‚æ'‚æ‚â#‚â‚â‚â—‚âÇ‚âk‚â‡‚âË‚æ‚â—‚æ'‚âœð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡…±°¹™¥±Ñ•È ¡”¤€ôø”¹ÍÑ…ÑÕÌ€ôôô€‰…¹ÍÝ•É•ˆ¤¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚â‚â·‚â·‚â·‚âS‚âÓ‚â_‚âW‚â‚âŸ‚â#‚â_‚âË‚âdð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€€€ñ…ÉÑ¥±”±…ÍÌô‰‰…ˆøñÍÁ…¸û‚â‚æ'‚âË‚â‚æ‚â‚âÓ‚âg‚â‚âÏ‚â¯‚âg‚âPð½ÍÁ…¸øñÍÑÉ½¹œø‘í¹Õ´¡…±°¹™¥±Ñ•È ¡”¤€ôø”¹½Ù•ÉM±„¤¹±•¹Ñ ¥ôð½ÍÑÉ½¹œøñÍµ…±°û‚âW‚æ'‚â·‚â‚æ‚â‚æ#‚â‚âW‚âÓ‚âS‚âW‚âË‚â„ð½Íµ…±°øð½…ÉÑ¥±”ø(€€€€ð½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½ÜˆùMåÍÑ•´5…ÁÁ¥¹œð½Àøñ Èû‚âk‚â‚âÓ‚â§‚âÇ‚â_‚æ‚â¯‚âg‚â·‚â‹‚âç‚æ#‚â‚âÃ‚âk‚âk‚æ‚â¯‚âdð½ Èø(€€€€€€€€ñÍµ…±°±…ÍÌô‰¡•…µÍÕˆˆû‚â«‚âË‚â‹‚â+‚â×‚æ'‚æ‚â#‚â‚â‡‚âË‚â#‚âË‚â‚â‚âÃ‚âk‚âk‚âW‚æ'‚âg‚â_‚âË‚âƒ‚æ‚â‡‚æ#‚æ‚â+‚æ#‚â‚âŸ‚âË‚â‡‚â‚âã‚âg‚æ‚â‚âƒŠPƒ‚âW‚âÇ‚æ'‚â‚â‚â‚âÇ‚æ'‚â‚æ‚âS‚â×‚â‹‚âœƒ‚â‚âÃ‚âk‚âk‚â#‚âÏ‚æ‚âŸ‚æ'‚æ‚â¯‚æ$ð½Íµ…±°øð½‘¥Øø(€€€€€€€€ñÍÁ…¸±…ÍÌô‰¡•…±Ñ €‘íÁ•¹‘¥¹Ñ¥Ù”¹±•¹Ñ €ü€‰…ÑÑ•¹Ñ¥½¸ˆ€èÁ•¹‘¥¹œ¹±•¹Ñ €ü€ˆˆ€è€‰½¬‰ôˆø‘íÁ•¹‘¥¹œ¹±•¹Ñ €üƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â‚âÏ‚â¯‚âg‚âP€‘íÁ•¹‘¥¹œ¹±•¹Ñ¡ôƒ‚âk‚â‚âÓ‚â§‚âÇ‚â]€€è€‹‚â‚âÏ‚â¯‚âg‚âS‚â‚â‚âk‚æ‚â—‚æ'‚âœ‰ôð½ÍÁ…¸ø(€€€€€€ð½‘¥Øø(€€€€€€‘íÁ•¹‘¥¹Ñ¥Ù”¹±•¹Ñ €ü€ñÀ±…ÍÌô‰¡¥¹Ð‘…¹•Èˆû‚âk‚â‚âÓ‚â§‚âÇ‚â\€ñˆø‘í ¡Á•¹‘¥¹Ñ¥Ù”¹©½¥¸ ˆ°€ˆ¤¥ôð½ˆøƒ‚â‡‚â×‚â‚æ'‚â·‚â‡‚âç‚â—‚æ‚â‚æ'‚âË‚â‡‚âË‚æ‚â—‚æ'‚âŸ‚æ‚âW‚æ#‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â‚âÏ‚â¯‚âg‚âS‚â‚âÃ‚âk‚âk‚âW‚æ'‚âg‚â_‚âË‚âƒŠPƒ‚â‹‚âÇ‚â‚â‚â‚âW‚âÓ‚âS‚âW‚âË‚â‡‚æ‚âk‚âk‚æ‚â‚â×‚â‹‚â—‚æ‚â_‚â‡‚æ0ð½Àù€€è€ˆ‰ô(€€€€€€ñ‘¥Ø±…ÍÌô‰ÍåÍµ…Àˆø(€€€€€€€€‘í­¹½Ý¸(€€€€€€€€€€¹µ…À ¡½‘”¤€ôøì(€€€€€€€€€€€½¹ÍÐÕÈ€ôÍåÍÑ•µ=™½µÁ…¹ä¡½‘”¤ì(€€€€€€€€€€€½¹ÍÐ¼€ô¹½µÁ…¹¥•Ì¹™¥¹ ¡à¤€ôøà¹½‘”€ôôô½‘”¤ñðì¹…µ”è½‘”ôì(€€€€€€€€€€€½¹ÍÐ¸€ô…±°¹™¥±Ñ•È ¡”¤€ôø”¹½µÁ…¹ä€ôôô½‘”¤¹±•¹Ñ ì(€€€€€€€€€€€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÌô‰ÍåÍµ…ÀµÉ½Ü€‘íÕÈ€ü€ˆˆ€è€‰Ñ½‘¼‰ôˆø(€€€€€€€€€€€€€€ñ‘¥ØøñÍÑÉ½¹œø‘í ¡¼¹¹…µ”ñð½‘”¥ôð½ÍÑÉ½¹œøñÍÁ…¸ø‘í¹Õ´¡¸¥ôƒ‚æ‚â‚â«‚æ‚âg‚â+‚æ#‚âŸ‚â‚âg‚â×‚æ$ð½ÍÁ…¸øð½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰ÍåÍµ…Àµ‰Ñ¹Ìˆø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡¥Àµ‰Ñ¸€‘íÕÈ€ôôô€‰aˆ€ü€‰½¸…µ‰•Èˆ€è€ˆ‰ôˆ‘…Ñ„µÍåÌôˆ‘í ¡½‘”¥ôˆ‘…Ñ„µÙ…°ô‰aˆùaƒ
Üƒ‚â‚âË‚â‹‚âŸ‚âÇ‚âdð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡¥Àµ‰Ñ¸€‘íÕÈ€ôôô€‰MeLÄÈÌˆ€ü€‰½¸‰±Õ”ˆ€è€ˆ‰ôˆ‘…Ñ„µÍåÌôˆ‘í ¡½‘”¥ôˆ‘…Ñ„µÙ…°ô‰MeLÄÈÌˆøÄÈÌƒ
Üƒ‚æ‚â‚â×‚â‹‚â—‚æ‚â_‚â‡‚æ0ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡¥Àµ‰Ñ¸€‘íÕÈ€ü€ˆˆ€è€‰½¸‰ôˆ‘…Ñ„µÍåÌôˆ‘í ¡½‘”¥ôˆ‘…Ñ„µÙ…°ôˆˆû‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âàð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ð½‘¥Øù€ì(€€€€€€€€€ô¤(€€€€€€€€€€¹©½¥¸ ˆˆ¥ô(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆø‘í ¡a¹¹…µ”¥ôð½Àøñ Èû‚â‚âË‚â‹‚â‚âË‚â‚â_‚â×‚æ#‚âW‚æ'‚â·‚â‚â«‚æ#‚â‚â¯‚âÇ‚âŸ‚â¯‚âg‚æ'‚âË‚â‚âÃ‚âŸ‚âÇ‚âg‚âg‚â×‚æ$ð½ Èø(€€€€€€€€ñÍµ…±°±…ÍÌô‰¡•…µÍÕˆˆø‘í ¡a¹‘•ÍŒ¥ôð½Íµ…±°øð½‘¥Øø(€€€€€€€€ñÍÁ…¸±…ÍÌô‰¡•…±Ñ €‘í‘…¥±ä¹±•¹Ñ €ü€‰…ÑÑ•¹Ñ¥½¸ˆ€è€‰½¬‰ôˆû‚â‚âÏ‚â¯‚âg‚âS‚â«‚æ#‚â€‘í ¡Œ¹‘…¥±åÕÑ½™˜¥ôƒ‚âd¸ƒ‚â‚â·‚â€‘í ¡ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹‘…Ñ”¥ôð½ÍÁ…¸ø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰ÑÉ…¬µÉ¥ˆø(€€€€€€€€‘í‰åM¡¥™Ð(€€€€€€€€€€¹µ…À (€€€€€€€€€€€€¡œ¤€ôø€ñ‘¥Ø±…ÍÌô‰ÑÉ…¬µ…É€‘íœ¹¥Ñ•µÌ¹±•¹Ñ €ü€ˆˆ€è€‰•µÁÑä‰ôˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰ÑÉ…¬µ¡•…ˆø(€€€€€€€€€€€€ñ‘¥ØøñÍÑÉ½¹œø‘í ¡œ¹Í¡¥™Ð¹¹…µ”¥ôð½ÍÑÉ½¹œøñÍÁ…¸ø‘í ¡œ¹Í¡¥™Ð¹É…¹”¥ôð½ÍÁ…¸øð½‘¥Øø(€€€€€€€€€€€€ñˆø‘íœ¹¥Ñ•µÌ¹±•¹Ñ¡ôð½ˆø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰ÑÉ…¬µ‰½‘äˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰­Øµ±¥¹”ˆøñÍÁ…¸û‚â¯‚âÇ‚âŸ‚â¯‚âg‚æ'‚âË‚â‚âÀð½ÍÁ…¸øñˆø‘í ¡œ¹±•…€üœ¹±•…¹¹…µ”€è€ˆ´ˆ¥ôð½ˆøð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰­Øµ±¥¹”ˆøñÍÁ…¸û‚â‹‚â·‚âS‚â_‚â×‚æ#‚âW‚æ'‚â·‚â‚âW‚â‚âŸ‚â ð½ÍÁ…¸øñˆø‘íµ½¹•äÀ¡ÍÕµI¥Í¬¡œ¹¥Ñ•µÌ¤¥ôƒ‚âk‚âË‚â\ð½ˆøð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰­Øµ±¥¹”ˆøñÍÁ…¸ùÉ¥Ñ¥…°€¼!¥ ð½ÍÁ…¸øñˆø‘íœ¹¥Ñ•µÌ¹™¥±Ñ•È ¡”¤€ôø”¹Í•Ù•É¥Ñä€ôôô€‰É¥Ñ¥…°ˆ¤¹±•¹Ñ¡ô€¼€‘íœ¹¥Ñ•µÌ¹™¥±Ñ•È ¡”¤€ôø”¹Í•Ù•É¥Ñä€ôôô€‰¡¥ ˆ¤¹±•¹Ñ¡ôð½ˆøð½‘¥Øø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸Í´ˆ‘…Ñ„µÉ•ÄµÍ¡¥™Ðôˆ‘íœ¹Í¡¥™Ð¹½‘•ôˆ€‘íœ¹¥Ñ•µÌ¹±•¹Ñ €ü€ˆˆ€è€‰‘¥Í…‰±•‰ôû‚â·‚â·‚â‚æ‚âk‚â‚â·‚æ‚â¯‚æ'‚â+‚â×‚æ'‚æ‚â#‚âð½‰ÕÑÑ½¸ø(€€€€€€€€ð½‘¥Øù€°(€€€€€€€€€€¤(€€€€€€€€€€¹©½¥¸ ˆˆ¥ô(€€€€€€ð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆ¡¥‘‘•¸…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆø‘í ¡LÄÈÌ¹¹…µ”¥ôð½Àøñ Èû‚âo‚â‚âÃ‚âŸ‚âÇ‚âW‚âÓ‚â‚âË‚â‹‚â‚â·‚âk‚æ‚âS‚âÓ‚â„ð½ Èø(€€€€€€€€ñÍµ…±°±…ÍÌô‰¡•…µÍÕˆˆø‘í ¡LÄÈÌ¹‘•ÍŒ¥ôð½Íµ…±°øð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€€€‘ì(€€€€€€€å±•1¥ÍÐ¹±•¹Ñ (€€€€€€€€€€ü€ñ‘¥Ø±…ÍÌô‰ÑÉ…¬µÉ¥ˆø‘íå±•1¥ÍÐ(€€€€€€€€€€€€€€¹µ…À ¡œ¤€ôøì(€€€€€€€€€€€€€€€½¹ÍÐ‘Õ”€ôÍ¡¥™Ñ…åÌ¡œ¹ä¹Ñ¼°Œ¹å±•I•ÍÁ½¹‘…åÌ¤ì(€€€€€€€€€€€€€€€½¹ÍÐ±…Ñ”€ô‘Õ”€ðÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹‘…Ñ”ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÌô‰ÑÉ…¬µ…Éˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰ÑÉ…¬µ¡•…ˆøñ‘¥ØøñÍÑÉ½¹œø‘í ¡œ¹ä¹¹…µ”¥ôð½ÍÑÉ½¹œøñÍÁ…¸ø‘í ¡œ¹ä¹™É½´¥ôƒ‚â[‚âÛ‚â€‘í ¡œ¹ä¹Ñ¼¥ôð½ÍÁ…¸øð½‘¥Øøñˆø‘íœ¹¥Ñ•µÌ¹±•¹Ñ¡ôð½ˆøð½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰ÑÉ…¬µ‰½‘äˆø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰­Øµ±¥¹”ˆøñÍÁ…¸û‚âo‚âÓ‚âS‚â‚â·‚âhð½ÍÁ…¸øñˆø‘í ¡œ¹ä¹Ñ¼¥ôð½ˆøð½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰­Øµ±¥¹”ˆøñÍÁ…¸û‚â‚âÏ‚â¯‚âg‚âS‚â+‚â×‚æ'‚æ‚â#‚âð½ÍÁ…¸øñˆ±…ÍÌôˆ‘í±…Ñ”€ü€‰‘…¹•Èˆ€è€ˆ‰ôˆø‘í ¡‘Õ”¥ôð½ˆøð½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰­Øµ±¥¹”ˆøñÍÁ…¸û‚â‹‚â·‚âS‚â_‚â×‚æ#‚âW‚æ'‚â·‚â‚âW‚â‚âŸ‚â ð½ÍÁ…¸øñˆø‘íµ½¹•äÀ¡ÍÕµI¥Í¬¡œ¹¥Ñ•µÌ¤¥ôƒ‚âk‚âË‚â\ð½ˆøð½‘¥Øø(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸Í´ˆ‘…Ñ„µÉ•Äµå±”ôˆ‘íœ¹ä¹½‘•ôˆû‚â·‚â·‚â‚æ‚âk‚â‚â·‚æ‚â¯‚æ'‚â+‚â×‚æ'‚æ‚â#‚â‚â_‚âÇ‚æ'‚â‚â‚â·‚âhð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ð½‘¥Øù€ì(€€€€€€€€€€€€€ô¤(€€€€€€€€€€€€€€¹©½¥¸ ˆˆ¥ôð½‘¥Øù€(€€€€€€€€€€è€ñÀ±…ÍÌô‰•µÁÑäˆû‚æ‚â‡‚æ#‚â‡‚â×‚â‚âË‚â‹‚â‚âË‚â‚â‚â·‚â‚â‚âÃ‚âk‚âh€ÄÈÌƒ‚âW‚âË‚â‡‚âW‚âÇ‚âŸ‚â‚â‚â·‚â‚âg‚â×‚æ$ð½Àù€(€€€€€ô(€€€€ð½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Á…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÌô‰Á…¹•°µ¡•…‘¥¹œˆø(€€€€€€€€ñ‘¥ØøñÀ±…ÍÌô‰•å•‰É½Üˆù±…É¥™¥…Ñ¥½¸EÕ•Õ”ð½Àøñ Èû‚â‚âË‚â‹‚â‚âË‚â‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âS‚â{‚â‚æ'‚â·‚â‡‚â‚âÏ‚â¯‚âg‚âS‚â«‚æ#‚âð½ Èø(€€€€€€€€ñÍµ…±°±…ÍÌô‰¡•…µÍÕˆˆû‚â‚âS‚â_‚â×‚æ#‚æ‚â—‚â‚æ‚â‚â«‚æ‚â{‚âß‚æ#‚â·‚æ‚âo‚âÓ‚âS‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âPƒ
Üƒ‚âo‚âã‚æ#‚â‡‚â‚âŸ‚âË‚â«‚âã‚âS‚â·‚â·‚â‚æ‚â·‚â‚â«‚âË‚â‚â+‚â×‚æ'‚æ‚â#‚â‚â‚âË‚â‹‚æ‚â‚â«‚æ‚âo‚æ‚âdAð½Íµ…±°øð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ…‰±”µÝÉ…Àˆø(€€€€€€€€ñÑ…‰±”ø(€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ û‚æ‚â‚â¨ð½Ñ øñÑ û‚â«‚âË‚âˆð½Ñ øñÑ û‚æ‚âŸ‚â—‚âÈð½Ñ øñÑ û‚âo‚â‚âÃ‚æ‚âƒ‚â\ð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚â‹‚â·‚âS‚â_‚â×‚æ#‚âW‚æ'‚â·‚â‚âW‚â‚âŸ‚â ð½Ñ øñÑ û‚â‚âÀ€¼ƒ‚âs‚âç‚æ'‚æ‚â‚â×‚æ#‚â‹‚âŸ‚â‚æ'‚â·‚âð½Ñ øñÑ û‚â‚âÏ‚â¯‚âg‚âS‚â«‚æ#‚âð½Ñ øñÑ û‚â«‚â[‚âË‚âg‚âÀð½Ñ øñÑ ±…ÍÌô‰É¥¡Ðˆû‚æ‚â·‚â‚â«‚âË‚âŒð½Ñ øð½ÑÈøð½Ñ¡•…ø(€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€€‘ì(€€€€€€€€€€€€€…±°(€€€€€€€€€€€€€€€€¹Í±¥” À°€ÐÀ¤(€€€€€€€€€€€€€€€€¹µ…À ¡”¤€ôøì(€€€€€€€€€€€€€€€€€½¹ÍÐ€ô‘Õ•=˜¡”¤ì(€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ñÑÈø(€€€€€€€€€€€€€€€€ñÑøñ‰ÕÑÑ½¸±…ÍÌô‰±¥¹¬µ‰Ñ¸ˆ‘…Ñ„µ•àôˆ‘í ¡”¹¥¥ôˆø‘í ¡…Í•1…‰•°¡”¤¥ôð½‰ÕÑÑ½¸øð½Ñø(€€€€€€€€€€€€€€€€ñÑøñÍÁ…¸±…ÍÌô‰‰…‘”€‘í”¹ÑÉ…¬€ôôô€‰‘…¥±äˆ€ü€‰…µ‰•Èˆ€è€‰‰±Õ”‰ôˆø‘í ¡ÑÉ…­5•Ñ„¡”¹ÑÉ…¬¤¹Í¡½ÉÐ¥ôð½ÍÁ…¸øð½Ñø(€€€€€€€€€€€€€€€€ñÑ±…ÍÌô‰Ñ¹Õ´ˆø‘í”¹Ñ¥µ•ôð½Ñø(€€€€€€€€€€€€€€€€ñÑø‘í ¡”¹ÑåÁ•9…µ”¥ôð½Ñø(€€€€€€€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡ÐÑ¹Õ´ˆø‘í”¹É¥Í­µ½Õ¹Ð€üµ½¹•ä¡”¹É¥Í­µ½Õ¹Ð¤€è€‹ŠP‰ôð½Ñø(€€€€€€€€€€€€€€€€ñÑø‘í  ¡¹Í¡¥™ÑÌ¹™¥¹ ¡Ì¤€ôøÌ¹½‘”€ôôô”¹Í¡¥™Ð¤ñðíô¤¹¹…µ”ñð”¹Í¡¥™Ð¥ôñÍµ…±°±…ÍÌô‰ÍÕˆˆø‘í ¡”¹•µÁ±½å•”¥ôð½Íµ…±°øð½Ñø(€€€€€€€€€€€€€€€€ñÑ±…ÍÌôˆ‘í”¹½Ù•ÉM±„€ü€‰‘…¹•Èˆ€è€ˆ‰ôˆø‘í ¡¹Í¡½ÉÐ¥ôð½Ñø(€€€€€€€€€€€€€€€€ñÑøñÍÁ…¸±…ÍÌô‰‰…‘”€‘í…Í•MÑ…ÑÕÍ5•Ñ„¡”¤¹Ñ½¹•ôˆø‘í ¡…Í•MÑ…ÑÕÍ5•Ñ„¡”¤¹¹…µ”¥ôð½ÍÁ…¸øð½Ñø(€€€€€€€€€€€€€€€€ñÑ±…ÍÌô‰É¥¡Ð¹½ÝÉ…Àˆøñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸áÌˆ‘…Ñ„µ±Èôˆ‘í”¹¥‘ôˆû‚æ‚â·‚â‚â«‚âË‚â‚â+‚â×‚æ'‚æ‚â#‚âð½‰ÕÑÑ½¸øð½Ñø(€€€€€€€€€€€€€€ð½ÑÈù€ì(€€€€€€€€€€€€€€€ô¤(€€€€€€€€€€€€€€€€¹©½¥¸ ˆˆ¤ñð€ñÑÈøñÑ½±ÍÁ…¸ôˆäˆ±…ÍÌô‰•µÁÑäˆû‚æ‚â‡‚æ#‚â‡‚â×‚â‚âË‚â‹‚â‚âË‚â‚â‚æ'‚âË‚â‚â+‚â×‚æ'‚æ‚â#‚âð½Ñøð½ÑÈù€(€€€€€€€€€€€ô(€€€€€€€€€€ð½Ñ‰½‘äø(€€€€€€€€ð½Ñ…‰±”ø(€€€€€€ð½‘¥Øø(€€€€€€‘í…±°¹±•¹Ñ €ø€ÐÀ€ü€ñÀ±…ÍÌô‰¡¥¹Ðˆû‚æ‚â«‚âS‚â€ÐÀƒ‚â‚âË‚â‹‚â‚âË‚â‚æ‚â‚â‚â#‚âË‚â‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âP€‘í¹Õ´¡…±°¹±•¹Ñ ¥ôƒ‚â‚âË‚â‹‚â‚âË‚âŒƒŠPƒ‚æ‚â+‚æ'‚âW‚âÇ‚âŸ‚â‚â‚â·‚â‚âS‚æ'‚âË‚âg‚âk‚âg‚æ‚â{‚âß‚æ#‚â·‚â—‚âS‚â‚â·‚âk‚æ‚â‚âTð½Àù€€è€ˆ‰ô(€€€€ð½Í•Ñ¥½¸ù€ì((€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µÍåÍtˆ¤¹™½É…  ¡ˆ¤€ôø(€€€ˆ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€€€¥˜€ ……¸ ‰ÉÕ±•Ìˆ¤€˜˜€……¸ ‰Í•ÑÑ¥¹Ìˆ¤€˜˜€……¸ ‰…ÁÁÉ½Ù”ˆ¤¤É•ÑÕÉ¸‘•¹ä ‹‚â‚âÏ‚â¯‚âg‚âS‚â‚âÃ‚âk‚âk‚â‚â·‚â‚âk‚â‚âÓ‚â§‚âÇ‚â\ˆ¤ì(€€€€€Í•Ñ½µÁ…¹åMåÍÑ•´¡ˆ¹‘…Ñ…Í•Ð¹ÍåÌ°ˆ¹‘…Ñ…Í•Ð¹Ù…°ñð¹Õ±°¤ì(€€€€€Ñ½…ÍÐ¡€‘íˆ¹‘…Ñ…Í•Ð¹ÍåÍôƒŠH€‘íˆ¹‘…Ñ…Í•Ð¹Ù…°€üÍåÍ5•Ñ„¡ˆ¹‘…Ñ…Í•Ð¹Ù…°¤¹Í¡½ÉÐ€è€‹‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âà‰õ€¤ì(€€€€€É•¹‘•È ¤ì(€€€ô¤°(€€¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µÉ•ÄµÍ¡¥™Ñtˆ¤¹™½É…  ¡ˆ¤€ôø(€€€ˆ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€€€½¹ÍÐœ€ô‰åM¡¥™Ð¹™¥¹ ¡à¤€ôøà¹Í¡¥™Ð¹½‘”€ôôôˆ¹‘…Ñ…Í•Ð¹É•ÅM¡¥™Ð¤ì(€€€€€¥ÍÍÕ•I•ÅÕ•ÍÑ½Œ¡œ¹¥Ñ•µÌ°ì(€€€€€€€­•äèœ¹Í¡¥™Ð¹½‘”¹Ñ½UÁÁ•É…Í” ¤°(€€€€€€€Í¡¥™Ñ9…µ”èœ¹Í¡¥™Ð¹¹…µ”°(€€€€€€€Ñ½9…µ”èœ¹±•…€üœ¹±•…¹¹…µ”€è€‹‚â¯‚âÇ‚âŸ‚â¯‚âg‚æ'‚âË‚â‚âÀ€ˆ€¬œ¹Í¡¥™Ð¹¹…µ”°(€€€€€€€Á•É¥½‘1…‰•°èƒ‚âŸ‚âÇ‚âg‚â_‚â×‚æ €‘íÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹‘…Ñ•ô€ ‘íœ¹Í¡¥™Ð¹¹…µ•ô€‘íœ¹Í¡¥™Ð¹É…¹•ô¥€°(€€€€€ô¤ì(€€€ô¤°(€€¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µÉ•Äµå±•tˆ¤¹™½É…  ¡ˆ¤€ôø(€€€ˆ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€€€½¹ÍÐœ€ôå±•1¥ÍÐ¹™¥¹ ¡à¤€ôøà¹ä¹½‘”€ôôôˆ¹‘…Ñ…Í•Ð¹É•Åå±”¤ì(€€€€€¥ÍÍÕ•I•ÅÕ•ÍÑ½Œ¡œ¹¥Ñ•µÌ°ì­•äèœ¹ä¹½‘”°Í¡¥™Ñ9…µ”è€‹‚â_‚âã‚â‚â‚âÀˆ°Á•É¥½‘1…‰•°è€‘íœ¹ä¹¹…µ•ôƒ
Ü€‘íœ¹ä¹™É½µôƒ‚â[‚âÛ‚â€‘íœ¹ä¹Ñ½õ€ô¤ì(€€€ô¤°(€€¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µ•átˆ¤¹™½É…  ¡ˆ¤€ôøˆ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø½Á•¹á•ÁÑ¥½¸¡ˆ¹‘…Ñ…Í•Ð¹•à¤¤¤ì(€É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µ±Étˆ¤¹™½É…  ¡ˆ¤€ôø(€€€ˆ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€€€½¹ÍÐ”€ô¹•á•ÁÑ¥½¹Ì¹™¥¹ ¡à¤€ôøà¹¥€ôôôˆ¹‘…Ñ…Í•Ð¹±È¤ì(€€€€€¥ÍÍÕ•±…É¥™¥…Ñ¥½¹½Œ¡”°€¡”¹¹½Ñ•Ìñðmt¤¹µ…À ¡¸¤€ôø¸¹Ñ•áÐ¤¹©½¥¸ ‰q¸ˆ¤¤ì(€€€ô¤°(€€¤ì)ôì((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€áÁ½ÉÐèá•°ƒ‚â¯‚â—‚âË‚â‹‚â+‚â×‚âT€¬ƒ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚âo‚æ‚âg‚âƒ‚âË‚âx(€€€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸½Á•¹5½‘…°¡Ñ¥Ñ±”°‰½‘å!Ñµ°°™½½Ñ!Ñµ°¤ì(€½¹ÍÐ´€ô€ ˆµ½‘…°ˆ¤ì(€±•…ÉQ¥µ•½ÕÐ¡´¹}¡¥‘•Q¥µ•È¤ì(€´¹}¡¥‘•Q¥µ•È€ô¹Õ±°ì(€¥˜€¡ÑåÁ•½˜´¹}½¹Ñ•¹Ñ±•…¹ÕÀ€ôôô€‰™Õ¹Ñ¥½¸ˆ¤´¹}½¹Ñ•¹Ñ±•…¹ÕÀ ¤ì(€´¹}½¹Ñ•¹Ñ±•…¹ÕÀ€ô¹Õ±°ì(€´¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰™¥±”µÁÉ•Ù¥•Üµµ½‘…°ˆ¤ì(€´¹¥¹¹•É!Q50€ô€(€€€€ñ¡•…‘•È±…ÍÌô‰µ½‘…°µ¡•…ˆø(€€€€€€ñ È¥ô‰µ½‘…±Q¥Ñ±”ˆø‘íÑ¥Ñ±•ôð½ Èø(€€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¥½¸µ‰Ñ¸ˆ¥ô‰µ½‘…±±½Í”ˆ…É¥„µ±…‰•°ô‹‚âo‚âÓ‚âPˆûŠrTð½‰ÕÑÑ½¸ø(€€€€ð½¡•…‘•Èø(€€€€ñ‘¥Ø±…ÍÌô‰µ½‘…°µ‰½‘äˆø‘í‰½‘å!Ñµ±ôð½‘¥Øø(€€€€‘í™½½Ñ!Ñµ°€ü€ñ™½½Ñ•È±…ÍÌô‰µ½‘…°µ™½½Ðˆø‘í™½½Ñ!Ñµ±ôð½™½½Ñ•Èù€€è€ˆ‰õ€ì(€´¹¡¥‘‘•¸€ô™…±Í”ì(€€ ˆµ½‘…±=Ù•É±…äˆ¤¹¡¥‘‘•¸€ô™…±Í”ì(€É•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ”  ¤€ôø´¹±…ÍÍ1¥ÍÐ¹…‘ ‰½¸ˆ¤¤ì(€Õ‘¥ÑU¤¹½Á•¸¡´¤ì(€€ ˆµ½‘…±±½Í”ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°±½Í•5½‘…°¤ì(€€ ˆµ½‘…±=Ù•É±…äˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°±½Í•5½‘…°°ì½¹”èÑÉÕ”ô¤ì)ô)™Õ¹Ñ¥½¸±½Í•5½‘…° ¤ì(€½¹ÍÐ´€ô€ ˆµ½‘…°ˆ¤ì(€¥˜€ …´ñð´¹¡¥‘‘•¸¤É•ÑÕÉ¸ì(€¥˜€¡ÑåÁ•½˜´¹}½¹Ñ•¹Ñ±•…¹ÕÀ€ôôô€‰™Õ¹Ñ¥½¸ˆ¤´¹}½¹Ñ•¹Ñ±•…¹ÕÀ ¤ì(€´¹}½¹Ñ•¹Ñ±•…¹ÕÀ€ô¹Õ±°ì(€´¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰½¸ˆ¤ì(€€ ˆµ½‘…±=Ù•É±…äˆ¤¹¡¥‘‘•¸€ôÑÉÕ”ì(€Õ‘¥ÑU¤¹±½Í”¡´¤ì(€±•…ÉQ¥µ•½ÕÐ¡´¹}¡¥‘•Q¥µ•È¤ì(€´¹}¡¥‘•Q¥µ•È€ôÍ•ÑQ¥µ•½ÕÐ  ¤€ôøì´¹¡¥‘‘•¸€ôÑÉÕ”ì´¹}¡¥‘•Q¥µ•È€ô¹Õ±°ìô°€ÈÀÀ¤ì)ô((¼¼I•ÕÍ”Ñ¡”•á…ÐÙ¥Í¥‰±”½™¥±Ñ•ÈµÍ½Á•É½ÝÌ¸¼¹½Ð•áÁ…¹…•ÍÌ½È‘…Ñ”Í½Á”½¸•áÁ½ÉÐ¸)™Õ¹Ñ¥½¸‰Õ¥±‘I•Ù¥•ÝáÁ½ÉÑM¡••ÑÌ ¤ì(€½¹ÍÐ½µ‰¥¹•€ôM!Q}	U%1IL¹•á•ÁÑ¥½¹Ì¹‰Õ¥± ¤ì(€½¹ÍÐ‘¥É•Ñ¥½¹½±Õµ¸€ô½µ‰¥¹•¹¡•…‘•ÉÌ¹¥¹‘•á=˜ ‹‚â_‚âÓ‚â£‚â_‚âË‚âˆ¤ì(€½¹ÍÐÍÁ±¥Ð€ô€¡¹…µ”°‘¥É•Ñ¥½¸¤€ôø€¡ì€¸¸¹½µ‰¥¹•°¹…µ”°(€€€Ñ¥Ñ±”è€‘í¹…µ•ôƒŠP€‘í½µ‰¥¹•¹Ñ¥Ñ±•õ€°(€€€É½ÝÌè½µ‰¥¹•¹É½ÝÌ¹™¥±Ñ•È ¡É½Ü¤€ôøÉ½Ým‘¥É•Ñ¥½¹½±Õµ¹t€ôôô‘¥É•Ñ¥½¸¤ô¤ì(€½¹ÍÐÍ¡••ÑÌ€ômÍÁ±¥Ð ‹‚âw‚âË‚â€£‚ât¤ˆ°€‹‚âw‚âË‚âˆ¤°ÍÁ±¥Ð ‹‚â[‚â·‚âd€£‚âX¤ˆ°€‹‚â[‚â·‚âdˆ¥tì(€½¹ÍÐÕ¹­¹½Ý¸€ô½µ‰¥¹•¹É½ÝÌ¹™¥±Ñ•È ¡É½Ü¤€ôø€…l‹‚âw‚âË‚âˆ°€‹‚â[‚â·‚âd‰t¹¥¹±Õ‘•Ì¡É½Ým‘¥É•Ñ¥½¹½±Õµ¹t¤¤ì(€¥˜€¡Õ¹­¹½Ý¸¹±•¹Ñ ¤Í¡••ÑÌ¹ÁÕÍ ¡ì€¸¸¹½µ‰¥¹•°¹…µ”è€‹‚â‚â·‚â‚âÃ‚âk‚âã‚âo‚â‚âÃ‚æ‚âƒ‚â\ˆ°É½ÝÌèÕ¹­¹½Ý¸ô¤ì(€Í¡••ÑÌ¹ÁÕÍ ¡ì€¸¸¹½µ‰¥¹•°¹…µ”è€‹‚â‚âŸ‚â„ˆô¤ì(€É•ÑÕÉ¸Í¡••ÑÌì)ô((¼¨ƒ‚âW‚âÇ‚âŸ‚â«‚â‚æ'‚âË‚â‚â+‚âã‚âS‚â‚æ'‚â·‚â‡‚âç‚â—‚æ‚âW‚æ#‚â—‚âÃ‚â+‚â×‚âTƒ‚âW‚âË‚â‡‚â+‚æ#‚âŸ‚â‚âŸ‚âÇ‚âg‚â_‚â×‚æ#‚âo‚âÇ‚â#‚â#‚âã‚âk‚âÇ‚âd€¨¼)½¹ÍÐM!Q}	U%1IL€ôì(€•á•ÁÑ¥½¹Ìèì(€€€±…‰•°è€‹‚âW‚âË‚â‚âË‚â‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âP€¼ƒ‚â‚âË‚â‹‚â‚âË‚â‚âs‚âÓ‚âS‚âo‚â‚âW‚âÐˆ°(€€€‰Õ¥±è€ ¤€ôøì(€€€€€½¹ÍÐÉ½ÝÌ€ô™¥±Ñ•É•‘á•ÁÑ¥½¹Ì ¤ì(€€€€€É•ÑÕÉ¸ì(€€€€€€€¹…µ”è€‹‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âPˆ°(€€€€€€€Ñ¥Ñ±”è€‹‚âW‚âË‚â‚âË‚â‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âPƒŠPƒ‚â+‚æ#‚â·‚â‚âŸ‚æ#‚âË‚â‚â¯‚â‡‚âË‚â‹‚â[‚âÛ‚â‚æ‚â‡‚æ#‚â{‚âk‚â‚âç‚æ#‚æ‚â—‚âÃ‚â‚â·‚â+‚â×‚æ'‚æ‚â#‚âˆ°(€€€€€€€¡•…‘•ÉÌèl‹‚â«‚â[‚âË‚âg‚âÀˆ°€‹‚æ‚â‚â¨ˆ°€‹‚âŸ‚âÇ‚âg‚â_‚â×‚æ ˆ°€‹‚âk‚â‚âÓ‚â§‚âÇ‚â\ˆ°€‹‚â_‚âÓ‚â£‚â_‚âË‚âˆ°€‹‚âk‚âÇ‚â7‚â+‚âÔ€¼AÉ½Ù¥‘•Èˆ°€‰	<ƒ‚âŸ‚âÇ‚âg‚â_‚â×‚æ €¼ƒ‚æ‚âŸ‚â—‚âÈˆ°€‰	<ƒ‚âs‚âç‚æ'‚â_‚âÏ‚â‚âË‚â‹‚â‚âË‚âŒˆ°€‹‚â‹‚â·‚âP	<ˆ°€‰MQ4ƒ‚âŸ‚âÇ‚âg‚â_‚â×‚æ €¼ƒ‚æ‚âŸ‚â—‚âÈˆ°€‰MQ4ƒ‚âc‚âg‚âË‚â‚âË‚âŒˆ°€‹‚â‹‚â·‚âPMQ4ˆ°€‹‚âW‚æ#‚âË‚â‚æ‚âŸ‚â—‚âÈ€£‚âŸ‚âÐ¤ˆ°€‹‚âW‚æ#‚âË‚â‚â‹‚â·‚âPˆ°€‹‚âs‚â—‚â‚âË‚â‚â#‚âÇ‚âk‚â‚âç‚æ ˆ°€‹‚â‚âÏ‚â+‚â×‚æ'‚æ‚â#‚â€¼ƒ‚â¯‚â‡‚âË‚â‹‚æ‚â¯‚âW‚âàˆ°€‹‚â‚âÃ‚âS‚âÇ‚âhˆ°€‹‚â‚âÏ‚â¯‚âg‚âS‚â«‚æ#‚âˆ°€‹‚æ‚â‚âÓ‚âdM1ˆ°€‰	<UÍ•Èˆ°€‰	<ƒ‚âk‚âÇ‚â7‚â+‚â×‚â—‚âç‚â‚â‚æ'‚âÈˆ°€‰	<ƒ‚â+‚âß‚æ#‚â·‚â—‚âç‚â‚â‚æ'‚âÈˆ°€‰	<ƒ‚â_‚æ'‚âË‚âˆ€Ðƒ‚âW‚âÇ‚âœˆ°€‰	<ƒ‚â‚â¯‚âÇ‚â«‚â·‚æ'‚âË‚â‚â·‚âÓ‚âˆ°€‰MQ4½A4UÍ•Èˆ°€‰MQ4½A4ƒ‚âk‚âÇ‚â7‚â+‚â×‚â—‚âç‚â‚â‚æ'‚âÈˆ°€‰MQ4½A4ƒ‚â+‚âß‚æ#‚â·‚â—‚âç‚â‚â‚æ'‚âÈˆ°€‰MQ4½A4ƒ‚â_‚æ'‚âË‚âˆ€Ðƒ‚âW‚âÇ‚âœˆ°€‰MQ4½A4ƒ‚â‚â¯‚âÇ‚â«‚â·‚æ'‚âË‚â‚â·‚âÓ‚â‰t°(€€€€€€€Ý¥‘Ñ¡ÌèlÄÐ°€ÄÄ°€ÄÈ°€ÄÈ°€ä°€Äà°€ÈÄ°€ÄÔ°€ÄÌ°€ÈÄ°€Äà°€ÄÌ°€ÄÌ°€ÄÌ°€ÈÐ°€ÐÈ°€ÄÀ°€ÄÐ°€ÄÀ°€Äà°€ÈÀ°€ÈÔ°€ÄÐ°€ÌÔ°€Äà°€ÈÀ°€ÈÔ°€ÄÐ°€ÌÕt°(€€€€€€€É½ÝÌèÉ½ÝÌ¹µ…À ¡”¤€ôøì(€€€€€€€€€½¹ÍÐ¡…ÍMÑ´€ô”¹‰…¹­µ½Õ¹Ð€„ôô¹Õ±°ì(€€€€€€€€€½¹ÍÐ¡…Í	¼€ô”¹ÍåÍÑ•µµ½Õ¹Ð€„ôô¹Õ±°ì(€€€€€€€€€½¹ÍÐ•áÁ±…¹…Ñ¥½¸€ô”¹É•Í½±ÕÑ¥½¹9½Ñ”ñð€¡”¹¹½Ñ•Ìñðmt¤¹…Ð ´Ä¤ü¹Ñ•áÐñð€ˆˆì(€€€€€€€€€½¹ÍÐÉ•ÍÕ±Ð€ô¡…ÍMÑ´€˜˜¡…Í	¼(€€€€€€€€€€€€ü”¹ÑåÁ”€ôôô€‰Ñ¥µ•}‘¥™˜ˆ€ü€‹‚â‹‚â·‚âS‚âW‚â‚âƒ
Üƒ‚æ‚âŸ‚â—‚âË‚âW‚æ#‚âË‚âˆ€è”¹ÑåÁ”€ôôô€‰…µ½Õ¹Ñ}‘¥™˜ˆ€ü€‹‚æ‚âŸ‚â—‚âË‚æ‚â‚â—‚æ$ƒ
Üƒ‚â‹‚â·‚âS‚âW‚æ#‚âË‚âˆ€è”¹ÑåÁ•9…µ”(€€€€€€€€€€€€è¡…ÍMÑ´€ü€‹‚æ‚â‡‚æ#‚â{‚âk‚âw‚âÇ‚æ#‚â	<ˆ€è€‹‚æ‚â‡‚æ#‚â{‚âk‚âw‚âÇ‚æ#‚âMQ4ˆì(€€€€€€€€€É•ÑÕÉ¸l(€€€€€€€€€€€…Í•MÑ…ÑÕÍ5•Ñ„¡”¤¹¹…µ”°”¹¥°”¹‘…Ñ”°”¹½µÁ…¹ä°”¹‘¥É•Ñ¥½¸°”¹…½Õ¹Ð°(€€€€€€€€€€€¡…Í	¼€ü•á•ÁÑ¥½¹M¥‘•Q¥µ•ÍÑ…µÀ¡”°€‰‰¼ˆ¤€è€ˆˆ°¡…Í	¼€ü”¹•µÁ±½å•”€è€ˆˆ°¡…Í	¼€ü”¹ÍåÍÑ•µµ½Õ¹Ð€è€ˆˆ°(€€€€€€€€€€€¡…ÍMÑ´€ü•á•ÁÑ¥½¹M¥‘•Q¥µ•ÍÑ…µÀ¡”°€‰ÍÑ´ˆ¤€è€ˆˆ°¡…ÍMÑ´€ü”¹‰…¹¬€è€ˆˆ°¡…ÍMÑ´€ü”¹‰…¹­µ½Õ¹Ð€è€ˆˆ°(€€€€€€€€€€€¡…ÍMÑ´€˜˜¡…Í	¼€ü•á•ÁÑ¥½¹Q¥µ•¥™™1…‰•°¡”¤€è€ˆˆ°¡…ÍMÑ´€˜˜¡…Í	¼€ü”¹…µ½Õ¹Ñ¥™˜€è€ˆˆ°É•ÍÕ±Ð°(€€€€€€€€€€€•áÁ±…¹…Ñ¥½¸ñð€‹‚æ‚âŸ‚æ'‚âg‚æ‚âŸ‚æ'‚â‚â·‚â+‚â×‚æ'‚æ‚â#‚âˆ°Í•Ù5•Ñ„¡”¹Í•Ù•É¥Ñä¤¹¹…µ”°‘Õ•=˜¡”¤¹Í¡½ÉÐ°”¹½Ù•ÉM±„€ü€‹‚æ‚â‚âÓ‚âdˆ€è€‹‚âo‚â‚âW‚âÐˆ°(€€€€€€€€€€€€¸¸¹l‰‰¼ˆ°€‰ÍÑ´‰t¹™±…Ñ5…À ¡Í¥‘”¤€ôøì½¹ÍÐŒ€ôÉ•Ù¥•ÝÕÍÑ½µ•È¡”°Í¥‘”¤ìÉ•ÑÕÉ¸mŒ¹ÕÍ•È°Œ¹…½Õ¹Ð°Œ¹¹…µ”°Œ¹Ñ…¥°°Œ¹É•™•É•¹•tìô¤°(€€€€€€€€€tì(€€€€€€€ô¤°(€€€€€ôì(€€€ô°(€ô°(€‘…µ…”èì(€€€±…‰•°è€‹‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆˆ°(€€€‰Õ¥±è€ ¤€ôøì(€€€€€½¹ÍÐÉ½ÝÌ€ô¹‘…µ…•Ì¹™¥±Ñ•È ¡¤€ôø¥¹I…¹”¡¹‘…Ñ”¤¤ì(€€€€€É•ÑÕÉ¸ì(€€€€€€€¹…µ”è€‹‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆˆ°(€€€€€€€Ñ¥Ñ±”è€‹‚â_‚âÃ‚æ‚âk‚â×‚â‹‚âg‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆˆ°(€€€€€€€¡•…‘•ÉÌèl‹‚â‚â¯‚âÇ‚â¨ˆ°€‹‚æ‚â‚â«‚â·‚æ'‚âË‚â‚â·‚âÓ‚âˆ°€‹‚âŸ‚âÇ‚âg‚â_‚â×‚æ ˆ°€‹‚â‚â·‚âhˆ°€‹‚âk‚â‚âÓ‚â§‚âÇ‚â\ˆ°€‹‚â{‚âg‚âÇ‚â‚â‚âË‚âdˆ°€‹‚â‚âÀˆ°€‹‚â‹‚â·‚âS‚æ‚â«‚â×‚â‹‚â¯‚âË‚âˆ€£‚âk‚âË‚â\¤ˆ°€‹‚â«‚âË‚æ‚â¯‚âW‚âàˆ°€‹‚â¯‚â—‚âÇ‚â‚âC‚âË‚âdˆ°€‹‚â«‚â[‚âË‚âg‚âÀ!Hˆ°€‹‚â«‚â[‚âË‚âg‚âÃ‚â‚âË‚â‚æ‚â‚âÓ‚âd‰t°(€€€€€€€Ý¥‘Ñ¡ÌèlÄÐ°€ÄÈ°€ÄÈ°€à°€ÄÈ°€ÄÜ°€ÄÀ°€ÄÜ°€ÌÈ°€ÄÀ°€ÄØ°€ÄÙt°(€€€€€€€É½ÝÌèÉ½ÝÌ¹µ…À ¡¤€ôøì(€€€€€€€€€É•ÑÕÉ¸l(€€€€€€€€€€€¹¥°¹•á•ÁÑ¥½¹%°¹‘…Ñ”°¹å±”°(€€€€€€€€€€€€¡¹½µÁ…¹¥•Ì¹™¥¹ ¡Œ¤€ôøŒ¹½‘”€ôôô¹½µÁ…¹ä¤ñðíô¤¹¹…µ”ñð¹½µÁ…¹ä°(€€€€€€€€€€€¹•µÁ±½å•”°€¡¹Í¡¥™ÑÌ¹™¥¹ ¡Í ¤€ôøÍ ¹½‘”€ôôô¹Í¡¥™Ð¤ñðíô¤¹¹…µ”ñð¹Í¡¥™Ð°(€€€€€€€€€€€‘µQ!¡¤°(€€€€€€€€€€€¹…ÕÍ”°¹•Ù¥‘•¹”€ü€‹‚â‚â‚âhˆ€è€‹‚â‚â´ˆ°¹¡ÉMÑ…ÑÕÌ°¹™¥¹…¹•MÑ…ÑÕÌ°(€€€€€€€€€tì(€€€€€€€ô¤°(€€€€€ôì(€€€ô°(€ô°(€­Á¤èì(€€€±…‰•°è€‰-A$ƒ‚â‚âË‚â‹‚â{‚âg‚âÇ‚â‚â‚âË‚âdˆ°(€€€‰Õ¥±è€ ¤€ôøì(€€€€€½¹ÍÐ•à€ôÍ½Á•‘á•ÁÑ¥½¹Ì ¤ì(€€€€€É•ÑÕÉ¸ì(€€€€€€€¹…µ”è€‰-A$ˆ°(€€€€€€€Ñ¥Ñ±”è€‰-A$ƒ‚â‚âË‚â‹‚â{‚âg‚âÇ‚â‚â‚âË‚âdˆ°(€€€€€€€¡•…‘•ÉÌèl‹‚â{‚âg‚âÇ‚â‚â‚âË‚âdˆ°€‹‚âk‚â‚âÓ‚â§‚âÇ‚â\ˆ°€‹‚æ‚â‚â«‚â_‚âÇ‚æ'‚â‚â¯‚â‡‚âPˆ°€‰É¥Ñ¥…°ˆ°€‰!¥ ˆ°€‹‚æ‚â‚âÓ‚âdM1ˆ°€‹‚â‹‚â·‚âS‚â_‚â×‚æ#‚âW‚æ'‚â·‚â‚âW‚â‚âŸ‚â ˆ°€‹‚â‚âÃ‚âS‚âÇ‚âk‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚æ#‚â‹‚â‰t°(€€€€€€€Ý¥‘Ñ¡ÌèlÄà°€Äà°€ÄÈ°€ÄÀ°€ÄÀ°€ÄÀ°€ÄØ°€ÄÑt°(€€€€€€€É½ÝÌèl¸¸¹¹•ÜM•Ð¡•à¹µ…À ¡”¤€ôø”¹•µÁ±½å•”ñð€‹‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âàˆ¤¥t¹µ…À ¡•µÁ±½å•”¤€ôøì(€€€€€€€€€½¹ÍÐÈ€ô•à¹™¥±Ñ•È ¡”¤€ôø€¡”¹•µÁ±½å•”ñð€‹‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âàˆ¤€ôôô•µÁ±½å•”¤ì(€€€€€€€€€½¹ÍÐÉ¥Ð€ôÈ¹™¥±Ñ•È ¡”¤€ôø”¹Í•Ù•É¥Ñä€ôôô€‰É¥Ñ¥…°ˆ¤¹±•¹Ñ ì(€€€€€€€€€½¹ÍÐÍ±„€ôÈ¹™¥±Ñ•È ¡”¤€ôø”¹½Ù•ÉM±„¤¹±•¹Ñ ì(€€€€€€€€€É•ÑÕÉ¸m•µÁ±½å•”°l¸¸¹¹•ÜM•Ð¡È¹µ…À ¡”¤€ôø”¹½µÁ…¹ä¤¥t¹©½¥¸ ˆ°€ˆ¤°È¹±•¹Ñ °É¥Ð°È¹™¥±Ñ•È ¡”¤€ôø”¹Í•Ù•É¥Ñä€ôôô€‰¡¥ ˆ¤¹±•¹Ñ °Í±„°ÍÕµI¥Í¬¡È¤°É¥Ð€øô€ÐñðÍ±„€øô€Ô€ü€‹‚â«‚âç‚âˆ€èÉ¥Ð€øô€È€ü€‹‚â‚â—‚âË‚âˆ€è€‹‚âW‚æ#‚âÌ‰tì(€€€€€€€ô¤°(€€€€€ôì(€€€ô°(€ô°(€‘…¥±äèì(€€€±…‰•°è€‹‚â«‚â‚âã‚âo‚â‚âË‚â‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚â‚âË‚â‹‚âŸ‚âÇ‚âdˆ°(€€€‰Õ¥±è€ ¤€ôø€¡ì(€€€€€¹…µ”è€‹‚â‚âË‚â‹‚âŸ‚âÇ‚âdˆ°(€€€€€Ñ¥Ñ±”è€‹‚â«‚â‚âã‚âo‚â‚âË‚â‚â‚â‚âÃ‚â_‚âk‚â‹‚â·‚âS‚â‚âË‚â‹‚âŸ‚âÇ‚âg‚â#‚âË‚âMÕÁ…‰…Í”ˆ°(€€€€€¡•…‘•ÉÌèl‹‚âŸ‚âÇ‚âg‚â_‚â×‚æ ˆ°€‹‚âk‚â‚âÓ‚â§‚âÇ‚â\ˆ°€‹‚â‚âÃ‚âk‚âhˆ°€‹‚â«‚â[‚âË‚âg‚âÀˆ°€‹‚æ‚â‚â—‚æ0ˆ°€‹‚â·‚æ#‚âË‚âg‚â«‚âÏ‚æ‚â‚æ‚â ˆ°€‹‚â‚æ'‚â·‚âs‚âÓ‚âS‚â{‚â—‚âË‚âPˆ°€‹‚âo‚â‚âÃ‚æ‚âƒ‚â_‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚â{‚âh‰t°(€€€€€Ý¥‘Ñ¡ÌèlÄÈ°€ÄØ°€Äà°€ÄØ°€ÄÀ°€ÄÈ°€ÄÈ°€ÐÁt°(€€€€€É½ÝÌè€¡±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹½Á•É…Ñ¥½¹Ìñðmt¤¹™¥±Ñ•È ¡à¤€ôø¥¹I…¹”¡à¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”¤€˜˜€¡ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä€ôôô€‰10ˆñðà¹½µÁ…¹ä€ôôôÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä¤¤¹µ…À ¡à¤€ôømà¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”°à¹½µÁ…¹ä°à¹‰ÕÍ¥¹•ÍÍ}ÍåÍÑ•´ñð€ˆˆ°à¹ÍÑ…ÑÕÌñð€ˆˆ°9Õµ‰•È¡à¹™¥±•}½Õ¹Ðñð€À¤°9Õµ‰•È¡à¹Á…ÉÍ•‘}½Õ¹Ðñð€À¤°9Õµ‰•È¡à¹•ÉÉ½É}½Õ¹Ðñð€À¤°€¡à¹ÁÉ•Í•¹Ñ}­¥¹‘Ìñðmt¤¹©½¥¸ ˆ°€ˆ¥t¤°(€€€ô¤°(€ô°(€µ½¹Ñ¡±äèì(€€€±…‰•°è€‹‚æ‚âg‚âŸ‚æ‚âg‚æ'‚â‡‚â‚âË‚â‹‚æ‚âS‚âß‚â·‚âdˆ°(€€€‰Õ¥±è€ ¤€ôøì(€€€€€½¹ÍÐ‰å5½¹Ñ €ô¹‘…µ…•Ì¹™¥±Ñ•È ¡¤€ôø¥¹I…¹”¡¹‘…Ñ”¤¤¹É•‘Õ” ¡…Œ°¤€ôøì(€€€€€€€½¹ÍÐå´€ôMÑÉ¥¹œ¡¹‘…Ñ”ñð€ˆˆ¤¹Í±¥” À°€Ü¤ñð€‹‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âàˆì(€€€€€€€…måµt€ô…måµtñðì…µ½Õ¹Ðè€À°…Í•Ìè€Àôì(€€€€€€€…måµt¹…µ½Õ¹Ð€¬ô‘µQ!¡¤ì(€€€€€€€…måµt¹…Í•Ì¬¬ì(€€€€€€€É•ÑÕÉ¸…Œì(€€€€€ô°íô¤ì(€€€€€É•ÑÕÉ¸ì(€€€€€€€¹…µ”è€‹‚æ‚âg‚âŸ‚æ‚âg‚æ'‚â‡‚â‚âË‚â‹‚æ‚âS‚âß‚â·‚âdˆ°(€€€€€€€Ñ¥Ñ±”è€‹‚æ‚âg‚âŸ‚æ‚âg‚æ'‚â‡‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â‚âË‚â‹‚æ‚âS‚âß‚â·‚âdˆ°(€€€€€€€¡•…‘•ÉÌèl‹‚æ‚âS‚âß‚â·‚âdˆ°€‹‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‹‚â#‚â‚âÓ‚â€£‚âk‚âË‚â\¤ˆ°€‹‚â#‚âÏ‚âg‚âŸ‚âg‚æ‚â‚â¨‰t°(€€€€€€€Ý¥‘Ñ¡ÌèlÄÐ°€ÈÈ°€ÄÉt°(€€€€€€€É½ÝÌè=‰©•Ð¹•¹ÑÉ¥•Ì¡‰å5½¹Ñ ¤¹Í½ÉÐ ¡m…t°m‰t¤€ôø„¹±½…±•½µÁ…É”¡ˆ¤¤¹µ…À ¡må´°µt¤€ôømå´°´¹…µ½Õ¹Ð°´¹…Í•Ít¤°(€€€€€ôì(€€€ô°(€ô°(€¥¹Ñ…­”èì(€€€±…‰•°è€‹‚â«‚â[‚âË‚âg‚âÃ‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚â‚âÇ‚âhˆ°(€€€‰Õ¥±è€ ¤€ôø€¡ì(€€€€€¹…µ”è€‹‚æ‚â‚â—‚æ3‚â_‚â×‚æ#‚â‚âÇ‚âhˆ°(€€€€€Ñ¥Ñ±”è€‹‚â«‚â[‚âË‚âg‚âÃ‚æ‚â‚â—‚æ3‚âo‚â‚âÃ‚â#‚âÏ‚âŸ‚âÇ‚âdˆ°(€€€€€¡•…‘•ÉÌèl‹‚âŸ‚âÇ‚âg‚â_‚â×‚æ#‚âc‚âã‚â‚â‚âÓ‚â ˆ°€‹‚âk‚â‚âÓ‚â§‚âÇ‚â\ˆ°€‹‚â+‚âß‚æ#‚â·‚æ‚â‚â—‚æ0ˆ°€‹‚âo‚â‚âÃ‚æ‚âƒ‚â\ˆ°€‹‚æ‚âŸ‚â—‚âË‚â_‚â×‚æ#‚â‚âÇ‚âhˆ°€‹‚â«‚â[‚âË‚âg‚âÃ‚â·‚æ#‚âË‚âg‚æ‚â‚â—‚æ0ˆ°€‹‚â‚æ'‚â·‚âs‚âÓ‚âS‚â{‚â—‚âË‚âPˆ°€‰MÑ½É…”Á…Ñ ‰t°(€€€€€Ý¥‘Ñ¡ÌèlÄÐ°€ÄØ°€ÌÐ°€Äà°€ÈÈ°€ÄØ°€ÌÔ°€ÐÕt°(€€€€€É½ÝÌè€¡±¥Ù•%¹Ñ…­•MÑ…Ñ”¹‰…Ñ¡•Ìñðmt¤¹™±…Ñ5…À ¡ˆ¤€ôø€¡ˆ¹Í½ÕÉ•}™¥±•Ìñðmt¤¹µ…À ¡˜¤€ôømˆ¹‰ÕÍ¥¹•ÍÍ}‘…Ñ”°¥¹Ñ…­•½µÁ…¹å=˜¡˜°ˆ¤ñðˆ¹½µÁ…¹äñð€ˆˆ°˜¹™¥±•}¹…µ”ñð€ˆˆ°˜¹­¥¹ñð€ˆˆ°˜¹É••¥Ù•‘}…Ðñðˆ¹É••¥Ù•‘}…Ðñð€ˆˆ°˜¹Á…ÉÍ•€ü€‹‚â·‚æ#‚âË‚âg‚â«‚âÏ‚æ‚â‚æ‚â ˆ€è€‹‚â‚â·‚â·‚æ#‚âË‚âdˆ°˜¹Á…ÉÍ•}•ÉÉ½Èñð€ˆˆ°˜¹ÍÑ½É…•}Á…Ñ ñð€ˆ‰t¤¤°(€€€ô¤°(€ô°(€…Õ‘¥Ðèì(€€€±…‰•°è€‰Õ‘¥Ð1½œˆ°(€€€‰Õ¥±è€ ¤€ôø€¡ì(€€€€€¹…µ”è€‰Õ‘¥Ð1½œˆ°(€€€€€Ñ¥Ñ±”è€‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âË‚â‚æ‚â+‚æ'‚â‚âË‚âg‚â‚âÃ‚âk‚âhˆ°(€€€€€¡•…‘•ÉÌèl‹‚æ‚âŸ‚â—‚âÈˆ°€‹‚âs‚âç‚æ'‚æ‚â+‚æ$ˆ°€‰…Ñ¥½¸ˆ°€‰•¹Ñ¥Ñäˆ°€‰Ñ…É•Ðˆ°€‹‚â‚âË‚â‹‚â—‚âÃ‚æ‚â·‚â×‚â‹‚âP‰t°(€€€€€Ý¥‘Ñ¡ÌèlÈÀ°€Äà°€ÄØ°€ÄØ°€ÈÈ°€ØÁt°(€€€€€É½ÝÌè¹…Õ‘¥Ñ1½œ¹™¥±Ñ•È ¡°¤€ôø¥¹I…¹”¡MÑÉ¥¹œ¡°¹…Ð¤¹Í±¥” À°€ÄÀ¤¤¤¹µ…À ¡°¤€ôøm°¹…Ð°°¹ÕÍ•È°°¹…Ñ¥½¸°°¹•¹Ñ¥Ñä°°¹Ñ…É•Ð°°¹‘•Ñ…¥±t¤°(€€€ô¤°(€ô°)ôì()½¹ÍÐU1Q}M!QL€ôì•á•ÁÑ¥½¹ÌèÑÉÕ”°‘…µ…”èÑÉÕ”°­Á¤èÑÉÕ”°‘…¥±äèÑÉÕ”°µ½¹Ñ¡±äè™…±Í”°¥¹Ñ…­”è™…±Í”°…Õ‘¥Ðè™…±Í”ôì)½¹ÍÐ•áÁ½ÉÑ¡½¥”€ôì€¸¸¹U1Q}M!QLôì()½¹ÍÐ%1}M1U€ôì(€€‹‚â‚âË‚â‹‚â‚âË‚âe}Õ‘¥Ðˆè€‰…Õ‘¥ÐµÉ•Á½ÉÐˆ°(€€‹‚â‚âË‚â‹‚â‚âË‚â‚âs‚âÓ‚âS‚âo‚â‚âW‚âÐˆè€‰•á•ÁÑ¥½¹Ìˆ°(€-A$è€‰­Á¤ˆ°(€€‹‚â‚âË‚â‹‚â‚âË‚âg‚â‚âË‚â‹‚âŸ‚âÇ‚âdˆè€‰‘…¥±äµÉ•Á½ÉÐˆ°(€€‹‚â«‚â‚âã‚âo‚â‚âË‚â‹‚æ‚âS‚âß‚â·‚âdˆè€‰µ½¹Ñ¡±äµÍÕµµ…Éäˆ°(€€‰…Õ‘¥Ðµ±½œˆè€‰…Õ‘¥Ðµ±½œˆ°(€€‹‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‰}Äˆè€‰‘…µ…”µå±”´Äˆ°(€€‹‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‰}Èˆè€‰‘…µ…”µå±”´Èˆ°(€€‹‚â‚âŸ‚âË‚â‡‚æ‚â«‚â×‚â‹‚â¯‚âË‚â‰}Ìˆè€‰‘…µ…”µå±”´Ìˆ°)ôì)™Õ¹Ñ¥½¸•áÁ½ÉÑM¡••ÑÌ¡‰…Í•9…µ”°Í¡••ÑÌ°½¹Ñ•áÐ€ôíô¤ì(€¥˜€ ……¸ ‰•áÁ½ÉÐˆ¤¤É•ÑÕÉ¸‘•¹ä ‰•áÁ½ÉÐƒ‚â‚æ'‚â·‚â‡‚âç‚â”ˆ¤ì(€½¹ÍÐ…Í¥¤€ô(€€€%1}M1Um‰…Í•9…µ•tñð(€€€‰…Í•9…µ”(€€€€€€¹É•Á±…” ½myqàÈÀµqàÝt¬½œ°€ˆ´ˆ¤(€€€€€€¹É•Á±…” ½myqÜ¸µt¬½œ°€ˆ´ˆ¤(€€€€€€¹É•Á±…” ¼´¬½œ°€ˆ´ˆ¤(€€€€€€¹É•Á±…” ½x´­ð´¬½œ°€ˆˆ¤ñð(€€€€‰É•Á½ÉÐˆì(€½¹ÍÐÍÑ…µÀ€ô½¹Ñ•áÐ¹‘…Ñ”ñð€¡ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½´€ôôôÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹Ñ¼€üÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½´€è€‘íÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½µõ}Ñ½|‘íÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹Ñ½õ€¤ì(€½¹ÍÐµ•Ñ„€ôƒ‚â+‚æ#‚âŸ‚â‚â‚æ'‚â·‚â‡‚âç‚â”€‘í½¹Ñ•áÐ¹‘…Ñ”ñðÉ…¹•1…‰•° ¥ôƒ
Üƒ‚âk‚â‚âÓ‚â§‚âÇ‚â\€‘í½¹Ñ•áÐ¹½µÁ…¹äñð€¡ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä€ôôô€‰10ˆ€ü€‹‚â_‚âã‚â‚âk‚â‚âÓ‚â§‚âÇ‚â\ˆ€èÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä¥ôƒ
Üƒ‚â·‚â·‚â‚æ‚âS‚âˆ€‘íÕÉÉ•¹ÑUÍ•È ¤¹ÕÍ•É¹…µ•ôƒ‚æ‚â‡‚âß‚æ#‚â´€‘í¹½ÝMÑ…µÀ ¥õ€ì(€½¹ÍÐÉ•Ì€ôáÁ½ÉÑ•È¹Ý½É­‰½½¬¡Í¡••ÑÌ°€‘í…Í¥¥õ|‘íÍÑ…µÁô¹á±Íá€°µ•Ñ„¤ì(€¥˜€¡É•Ì¹½¬¤ì(€€€±½Ñ¥½¸ ‰•áÁ½ÉÐˆ°€‰É•Á½ÉÐˆ°‰…Í•9…µ”°á•°€‘íÍ¡••ÑÌ¹±•¹Ñ¡ôƒ‚â+‚â×‚âTƒ
Ü€‘íÍ¡••ÑÌ¹É•‘Õ” ¡„°Œ¤€ôø„€¬Œ¹É½ÝÌ¹±•¹Ñ °€À¥ôƒ‚æ‚â[‚âœƒ
Ü€‘íÉ…¹•1…‰•° ¥õ€¤ì(€€€Ñ½…ÍÐ¡ƒ‚âS‚âË‚âŸ‚âg‚æ3‚æ‚â¯‚â—‚âP€‘í…Í¥¥õ|‘íÍÑ…µÁô¹á±Íàƒ‚æ‚â—‚æ'‚âœ€ ‘íÍ¡••ÑÌ¹±•¹Ñ¡ôƒ‚â+‚â×‚âTƒ
Ü€‘í¹Õ´¡Í¡••ÑÌ¹É•‘Õ” ¡„°Œ¤€ôø„€¬Œ¹É½ÝÌ¹±•¹Ñ °€À¤¥ôƒ‚æ‚â[‚âœ¥€¤ì(€€€É•ÑÕÉ¸ÑÉÕ”ì(€ô(€€¼¼ƒ‚â·‚â·‚â‚æ‚â—‚âg‚æ0èƒ‚â[‚â·‚â‹‚æ‚âo‚æ‚âdMXƒ‚â‚â·‚â‚â+‚â×‚âW‚æ‚â‚â(€½¹ÍÐ™¥ÉÍÐ€ôÍ¡••ÑÍlÁtì(€áÁ½ÉÑ•È¹ÍØ¡™¥ÉÍÐ¹¡•…‘•ÉÌ°™¥ÉÍÐ¹É½ÝÌ°€‘í…Í¥¥õ|‘íÍÑ…µÁô¹ÍÙ€¤ì(€±½Ñ¥½¸ ‰•áÁ½ÉÐˆ°€‰É•Á½ÉÐˆ°‰…Í•9…µ”°MX€£‚â‹‚âÇ‚â‚æ‚â¯‚â—‚âS‚âW‚âÇ‚âŸ‚æ‚â‚â×‚â‹‚âdá•°ƒ‚æ‚â‡‚æ#‚æ‚âS‚æ$¤ƒ
Ü€‘í™¥ÉÍÐ¹É½ÝÌ¹±•¹Ñ¡ôƒ‚æ‚â[‚â€¤ì(€Ñ½…ÍÐ ‹‚â‹‚âÇ‚â‚æ‚â¯‚â—‚âS‚âW‚âÇ‚âŸ‚æ‚â‚â×‚â‹‚âg‚æ‚â‚â—‚æ0á•°ƒ‚æ‚â‡‚æ#‚æ‚âS‚æ$€£‚âW‚æ'‚â·‚â‚âW‚æ#‚â·‚â·‚âÓ‚âg‚æ‚â_‚â·‚â‚æ3‚æ‚âg‚æ‚âT¤ƒŠPƒ‚âS‚âË‚âŸ‚âg‚æ3‚æ‚â¯‚â—‚âS‚æ‚âo‚æ‚âdMXƒ‚æ‚â¯‚æ'‚æ‚â_‚âdˆ°€‰Ý…É¸ˆ¤ì(€É•ÑÕÉ¸™…±Í”ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸½Á•¹áÁ½ÉÑ¥…±½œ ¤ì(€¥˜€ ……¸ ‰•áÁ½ÉÐˆ¤¤É•ÑÕÉ¸‘•¹ä ‰•áÁ½ÉÐƒ‚â‚æ'‚â·‚â‡‚âç‚â”ˆ¤ì(€¥˜€¡ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ôôô€‰ÁÉ½‘ÕÑ¥½¸ˆ€˜˜Mˆ¹Í¥¹•‘%¸ ¤¤ì(€€€ÑÉäì(€€€€€¥˜€ …±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹ÅÕ…±¥Ñä¤ì(€€€€€€€Ñ½…ÍÐ ‹‚â‚âÏ‚â—‚âÇ‚â‚æ‚â¯‚â—‚âS‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚â‚âÓ‚â‚â‚æ#‚â·‚âg‚æ‚âo‚âÓ‚âPáÁ½ÉÐ¸¸¸ˆ¤ì(€€€€€€€…Ý…¥Ð±½…‘1¥Ù•=Ù•ÉÙ¥•Ü¡ÑÉÕ”¤ì(€€€€€ô(€€€€€¥˜€ …±¥Ù•%¹Ñ…­•MÑ…Ñ”¹‰…Ñ¡•Ì¤ì(€€€€€€€±¥Ù•%¹Ñ…­•MÑ…Ñ”¹‰…Ñ¡•Ì€ô…Ý…¥ÐMˆ¹‰…Ñ¡•Ì¡ì™É½´èÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½´°Ñ¼èÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹Ñ¼°½µÁ…¹äèÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹äô¤ì(€€€€€ô(€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€É•ÑÕÉ¸Ñ½…ÍÐ ‹‚æ‚âW‚â‚â×‚â‹‚â‡‚â‚æ'‚â·‚â‡‚âç‚â”áÁ½ÉÐƒ‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â è€ˆ€¬•ÉÉ½È¹µ•ÍÍ…”°€‰Ý…É¸ˆ¤ì(€€€ô(€ô(€½¹ÍÐ˜€ôÍÑ…Ñ”¹™¥±Ñ•ÉÌì(€½Á•¹5½‘…° (€€€€‰áÁ½ÉÐƒ‚â‚âË‚â‹‚â‚âË‚âdˆ°(€€€€(€€€€ñ‘¥Ø±…ÍÌô‰•áÀµÍ•Ñ¥½¸ˆø(€€€€€€ñ Ìû‚â+‚æ#‚âŸ‚â‚âŸ‚âÇ‚âg‚â_‚â×‚æ ð½ Ìø(€€€€€€ñ‘¥Ø±…ÍÌô‰•áÀµÉ…¹”ˆø(€€€€€€€€ñ±…‰•°û‚â+‚æ#‚âŸ‚â‚â«‚âÏ‚æ‚â‚æ‚â#‚â‚âç‚âl(€€€€€€€€€€ñÍ•±•Ð¥ô‰•áÁAÉ•Í•Ðˆø‘íQ}AIMQL¹µ…À ¡À¤€ôø€ñ½ÁÑ¥½¸Ù…±Õ”ôˆ‘íÀ¹½‘•ôˆ€‘í˜¹ÁÉ•Í•Ð€ôôôÀ¹½‘”€ü€‰Í•±•Ñ•ˆ€è€ˆ‰ôø‘í ¡À¹¹…µ”¥ôð½½ÁÑ¥½¸ù€¤¹©½¥¸ ˆˆ¥ôð½Í•±•Ðø(€€€€€€€€ð½±…‰•°ø(€€€€€€€€ñ±…‰•°û‚âW‚âÇ‚æ'‚â‚æ‚âW‚æ ñ¥¹ÁÕÐÑåÁ”ô‰‘…Ñ”ˆ¥ô‰•áÁÉ½´ˆÙ…±Õ”ôˆ‘í˜¹™É½µôˆµ¥¸ôˆ‘íY%M%	1}Q}I=5ôˆµ…àôˆ‘íY%M%	1}Q}Q=ôˆ€¼øð½±…‰•°ø(€€€€€€€€ñ±…‰•°û‚â[‚âÛ‚âñ¥¹ÁÕÐÑåÁ”ô‰‘…Ñ”ˆ¥ô‰•áÁQ¼ˆÙ…±Õ”ôˆ‘í˜¹Ñ½ôˆµ¥¸ôˆ‘íY%M%	1}Q}I=5ôˆµ…àôˆ‘íY%M%	1}Q}Q=ôˆ€¼øð½±…‰•°ø(€€€€€€ð½‘¥Øø(€€€€€€ñÀ±…ÍÌô‰¡¥¹Ðˆ¥ô‰•áÁMÕµµ…Éäˆøð½Àø(€€€€ð½‘¥Øø((€€€€ñ‘¥Ø±…ÍÌô‰•áÀµÍ•Ñ¥½¸ˆø(€€€€€€ñ Ìû‚â+‚âã‚âS‚â‚æ'‚â·‚â‡‚âç‚â—‚â_‚â×‚æ#‚âW‚æ'‚â·‚â‚â‚âË‚âŒ€£‚æ‚âW‚æ#‚â—‚âÃ‚â+‚âã‚âS‚æ‚âo‚æ‚âd€Äƒ‚â+‚â×‚âW‚æ‚âg‚æ‚â‚â—‚æ3‚æ‚âS‚â×‚â‹‚âœ¤ð½ Ìø(€€€€€€ñ‘¥Ø±…ÍÌô‰Ñ½±”µ±¥ÍÐˆø(€€€€€€€€‘í=‰©•Ð¹•¹ÑÉ¥•Ì¡M!Q}	U%1IL¤(€€€€€€€€€€¹µ…À ¡m¬°Ùt¤€ôø€ñ±…‰•°øñ¥¹ÁÕÐÑåÁ”ô‰¡•­‰½àˆ‘…Ñ„µÍ¡••Ðôˆ‘í­ôˆ€‘í•áÁ½ÉÑ¡½¥•m­t€ü€‰¡•­•ˆ€è€ˆ‰ô€¼ø€‘í ¡Ø¹±…‰•°¥ô€ñˆ±…ÍÌô‰Í¡••Ðµ½Õ¹Ðˆ‘…Ñ„µ½Õ¹Ðôˆ‘í­ôˆøð½ˆøð½±…‰•°ù€¤(€€€€€€€€€€¹©½¥¸ ˆˆ¥ô(€€€€€€ð½‘¥Øø(€€€€ð½‘¥Øø((€€€€ñ‘¥Ø±…ÍÌô‰•áÀµÍ•Ñ¥½¸ˆø(€€€€€€ñ Ìû‚â‚âç‚âo‚æ‚âk‚âk‚æ‚â‚â—‚æ0ð½ Ìø(€€€€€€ñ‘¥Ø±…ÍÌô‰Í•œˆø(€€€€€€€€ñ±…‰•°øñ¥¹ÁÕÐÑåÁ”ô‰É…‘¥¼ˆ¹…µ”ô‰•áÁµÐˆÙ…±Õ”ô‰á±Íàˆ¡•­•€¼øá•°€ ¹á±Íà¤ƒŠPƒ‚æ‚âg‚âÃ‚âg‚âÌð½±…‰•°ø(€€€€€€€€ñ±…‰•°øñ¥¹ÁÕÐÑåÁ”ô‰É…‘¥¼ˆ¹…µ”ô‰•áÁµÐˆÙ…±Õ”ô‰ÍØˆ€¼øMX€£‚â+‚â×‚âW‚æ‚â‚â‚æ‚â_‚æ#‚âË‚âg‚âÇ‚æ'‚âd¤ð½±…‰•°ø(€€€€€€ð½‘¥Øø(€€€€€€ñÀ±…ÍÌô‰¡¥¹Ðˆø‘íáÁ½ÉÑ•È¹¡…Ía1M` ¤€ü€‹‚æ‚â‚â—‚æ0á•°ƒ‚â#‚âÃ‚â‡‚âÔ…ÕÑ½™¥±Ñ•Èƒ‚â_‚âã‚â‚â‚â·‚â—‚âÇ‚â‡‚âg‚æ0ƒ‚âW‚â‚âÛ‚â‚â¯‚âÇ‚âŸ‚âW‚âË‚â‚âË‚âƒ‚æ‚â—‚âÃ‚âW‚âÇ‚âŸ‚æ‚â—‚â‚æ‚âo‚æ‚âg‚âW‚âÇ‚âŸ‚æ‚â—‚â‚â#‚â‚âÓ‚â‚â_‚â×‚æ MU4ƒ‚æ‚âS‚æ'‚â_‚âÇ‚âg‚â_‚âÔˆ€è€‹‚â‹‚âÇ‚â‚æ‚â¯‚â—‚âS‚âW‚âÇ‚âŸ‚æ‚â‚â×‚â‹‚âg‚æ‚â‚â—‚æ0á•°ƒ‚æ‚â‡‚æ#‚æ‚âS‚æ$ƒŠPƒ‚âW‚æ'‚â·‚â‚âW‚æ#‚â·‚â·‚âÓ‚âg‚æ‚â_‚â·‚â‚æ3‚æ‚âg‚æ‚âW‚â‚â‚âÇ‚æ'‚â‚æ‚â‚âƒ‚â‚âÃ‚â¯‚âŸ‚æ#‚âË‚â‚âg‚â×‚æ'‚â#‚âÃ‚æ‚âS‚æ'‚æ‚â‚â—‚æ0MXƒ‚æ‚â_‚âd‰ôð½Àø(€€€€ð½‘¥Øù€°(€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰¡½ÍÐµ‰ÕÑÑ½¸ˆ¥ô‰•áÁ…¹•°ˆû‚â‹‚â‚æ‚â—‚âÓ‚âð½‰ÕÑÑ½¸ø(€€€€€ñ‰ÕÑÑ½¸±…ÍÌô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ¥ô‰•áÁ¼ˆû‚âS‚âË‚âŸ‚âg‚æ3‚æ‚â¯‚â—‚âPð½‰ÕÑÑ½¸ù€°(€€¤ì((€½¹ÍÐÉ•™É•Í €ô€ ¤€ôøì(€€€=‰©•Ð¹­•åÌ¡M!Q}	U%1IL¤¹™½É…  ¡¬¤€ôøì(€€€€€½¹ÍÐ•°€ô€¡m‘…Ñ„µ½Õ¹Ðôˆ‘í­ô‰u€¤ì(€€€€€¥˜€¡•°¤•°¹Ñ•áÑ½¹Ñ•¹Ð€ô€ ‘í¹Õ´¡M!Q}	U%1IMm­t¹‰Õ¥± ¤¹É½ÝÌ¹±•¹Ñ ¥ôƒ‚æ‚â[‚âœ¥€ì(€€€ô¤ì(€€€½¹ÍÐÍÕ´€ô€ ˆ•áÁMÕµµ…Éäˆ¤ì(€€€¥˜€¡ÍÕ´¤ÍÕ´¹Ñ•áÑ½¹Ñ•¹Ð€ôƒ‚â+‚æ#‚âŸ‚â‚â_‚â×‚æ#‚æ‚â—‚âß‚â·‚âè€‘íÉ…¹•1…‰•° ¥õ€ì(€ôì(€É•™É•Í  ¤ì((€€ ˆ•áÁAÉ•Í•Ðˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¡…¹”ˆ°€¡”¤€ôøì(€€€…ÁÁ±åAÉ•Í•Ð¡”¹Ñ…É•Ð¹Ù…±Õ”¤ì(€€€€ ˆ•áÁÉ½´ˆ¤¹Ù…±Õ”€ôÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½´ì(€€€€ ˆ•áÁQ¼ˆ¤¹Ù…±Õ”€ôÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹Ñ¼ì(€€€É•™É•Í  ¤ì(€ô¤ì(€€ ˆ•áÁÉ½´ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¡…¹”ˆ°€¡”¤€ôøì(€€€ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½´€ôÙ¥Í¥‰±•…Ñ”¡”¹Ñ…É•Ð¹Ù…±Õ”¤ì(€€€ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹ÁÉ•Í•Ð€ô€‰ÕÍÑ½´ˆì(€€€É•™É•Í  ¤ì(€ô¤ì(€€ ˆ•áÁQ¼ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¡…¹”ˆ°€¡”¤€ôøì(€€€ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹Ñ¼€ôÙ¥Í¥‰±•…Ñ”¡”¹Ñ…É•Ð¹Ù…±Õ”¤ì(€€€ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹ÁÉ•Í•Ð€ô€‰ÕÍÑ½´ˆì(€€€É•™É•Í  ¤ì(€ô¤ì(€€ ‰m‘…Ñ„µÍ¡••Ñtˆ¤¹™½É…  ¡Œ¤€ôøŒ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¡…¹”ˆ°€ ¤€ôø€¡•áÁ½ÉÑ¡½¥•mŒ¹‘…Ñ…Í•Ð¹Í¡••Ñt€ôŒ¹¡•­•¤¤¤ì(€€ ˆ•áÁ…¹•°ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°±½Í•5½‘…°¤ì(€€ ˆ•áÁ¼ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€½¹ÍÐÁ¥­•€ô=‰©•Ð¹­•åÌ¡M!Q}	U%1IL¤¹™¥±Ñ•È ¡¬¤€ôø•áÁ½ÉÑ¡½¥•m­t¤ì(€€€¥˜€ …Á¥­•¹±•¹Ñ ¤É•ÑÕÉ¸Ñ½…ÍÐ ‹‚æ‚â—‚âß‚â·‚â‚â·‚â‹‚æ#‚âË‚â‚âg‚æ'‚â·‚âˆ€Äƒ‚â+‚âã‚âS‚â‚æ'‚â·‚â‡‚âç‚â”ˆ°€‰Ý…É¸ˆ¤ì(€€€½¹ÍÐ™µÐ€ô€ ¥¹ÁÕÑm¹…µ”ô‰•áÁµÐ‰tœ¤¹™¥¹ ¡È¤€ôøÈ¹¡•­•¤¹Ù…±Õ”ì(€€€½¹ÍÐÍ¡••ÑÌ€ôÁ¥­•¹µ…À ¡¬¤€ôøM!Q}	U%1IMm­t¹‰Õ¥± ¤¤ì(€€€¥˜€¡™µÐ€ôôô€‰ÍØˆ¤ì(€€€€€½¹ÍÐ™¥ÉÍÐ€ôÍ¡••ÑÍlÁtì(€€€€€áÁ½ÉÑ•È¹ÍØ¡™¥ÉÍÐ¹¡•…‘•ÉÌ°™¥ÉÍÐ¹É½ÝÌ°…Õ‘¥ÐµÉ•Á½ÉÑ|‘íÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½µô¹ÍÙ€¤ì(€€€€€±½Ñ¥½¸ ‰•áÁ½ÉÐˆ°€‰É•Á½ÉÐˆ°€‰ÍØˆ°€‘í™¥ÉÍÐ¹É½ÝÌ¹±•¹Ñ¡ôƒ‚æ‚â[‚âœƒ
Ü€‘íÉ…¹•1…‰•° ¥õ€¤ì(€€€€€Ñ½…ÍÐ ‹‚âS‚âË‚âŸ‚âg‚æ3‚æ‚â¯‚â—‚âPMXƒ‚æ‚â—‚æ'‚âœˆ¤ì(€€€ô•±Í”ì(€€€€€•áÁ½ÉÑM¡••ÑÌ ‹‚â‚âË‚â‹‚â‚âË‚âe}Õ‘¥Ðˆ°Í¡••ÑÌ¤ì(€€€ô(€€€±½Í•5½‘…° ¤ì(€€€É•¹‘•È ¤ì(€ô¤ì)ô((¼¨€´´´´´´´´´´ƒ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚âo‚æ‚âg‚âƒ‚âË‚âx€´´´´´´´´´´€¨¼(¼¨ƒ‚â+‚âß‚æ#‚â·‚æ‚â‚â—‚æ3‚âW‚æ'‚â·‚â‚æ‚âo‚æ‚âdM%$ƒ‚æ‚â_‚æ#‚âË‚âg‚âÇ‚æ'‚âdƒ‚æ‚â‡‚æ#‚â‚âÇ‚æ'‚âg‚æ‚âk‚â‚âË‚âŸ‚æ3‚æ‚â/‚â·‚â‚æ3‚â#‚âÃ‚âW‚âÇ‚æ'‚â‚â+‚âß‚æ#‚â·‚æ‚â‚â—‚æ3‚æ‚â¯‚æ'‚æ‚âo‚æ‚âd€‰‘½Ý¹±½…ˆ€¨¼)™Õ¹Ñ¥½¸…Í¥¥M±Õœ¡Ð¤ì(€É•ÑÕÉ¸MÑÉ¥¹œ¡Ðñð€ˆˆ¤(€€€€¹¹½Éµ…±¥é” ‰9-ˆ¤(€€€€¹É•Á±…” ½myµi„µèÀ´åt¬½œ°€ˆ´ˆ¤(€€€€¹É•Á±…” ½x´­ð´¬½œ°€ˆˆ¤(€€€€¹Ñ½1½Ý•É…Í” ¤(€€€€¹Í±¥” À°€ÐÀ¤ì)ô)™Õ¹Ñ¥½¸Á…¹•±¥±•9…µ”¡Á…¹•°¤ì(€½¹ÍÐ•å•‰É½Ü€ô…Í¥¥M±Õœ ¡Á…¹•°¹ÅÕ•ÉåM•±•Ñ½È ˆ¹•å•‰É½Üˆ¤ñðíô¤¹Ñ•áÑ½¹Ñ•¹Ð¤ì(€¥˜€¡•å•‰É½Ü¹±•¹Ñ €øô€Ì¤É•ÑÕÉ¸€‘íÍÑ…Ñ”¹É½ÕÑ•õ|‘í•å•‰É½Ýõ€ì(€½¹ÍÐ¥‘à€ô€ ˆÙ¥•ÝI½½Ð€¹Á…¹•°ˆ¤¹¥¹‘•á=˜¡Á…¹•°¤€¬€Äì(€É•ÑÕÉ¸€‘íÍÑ…Ñ”¹É½ÕÑ•õ}Í•Ñ¥½¸´‘í¥‘áõ€ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸…ÁÑÕÉ•A…¹•°¡Á…¹•°¤ì(€½¹ÍÐÑ¥Ñ±”€ô€¡Á…¹•°¹ÅÕ•ÉåM•±•Ñ½È ‰ Èˆ¤ñðíô¤¹Ñ•áÑ½¹Ñ•¹ÐñðI=UQ}5AmÍÑ…Ñ”¹É½ÕÑ•t¹Ñ¥Ñ±”ì(€½¹ÍÐ¹…µ”€ô€‘íÁ…¹•±¥±•9…µ”¡Á…¹•°¥õ|‘íÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½µô¹Á¹€ì(€Ñ½…ÍÐ ‹‚â‚âÏ‚â—‚âÇ‚â‚â«‚â‚æ'‚âË‚â‚âƒ‚âË‚âx¸¸¸ˆ¤ì(€½¹ÍÐÉ•Ì€ô…Ý…¥ÐáÁ½ÉÑ•È¹…ÁÑÕÉ”¡Á…¹•°°¹…µ”°ì‰…­É½Õ¹è€ˆ™™™™™˜ˆô¤ì(€¥˜€¡É•Ì¹½¬¤ì(€€€±½Ñ¥½¸ ‰•áÁ½ÉÐˆ°€‰¥µ…”ˆ°Ñ¥Ñ±”°ƒ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â«‚æ#‚âŸ‚âg‚â‚âË‚â‹‚â‚âË‚âg‚æ‚âo‚æ‚âg‚âƒ‚âË‚âx€ ‘íÉ•Ì¹µ½‘•ô¥€¤ì(€€€Ñ½…ÍÐ¡É•Ì¹µ½‘”€ôôô€‰¡…ÉÐµ½¹±äˆ€üƒ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚â‚âË‚â‚æ‚âo‚æ‚âg‚âƒ‚âË‚â{‚æ‚â—‚æ'‚âœè€‘í¹…µ•õ€€èƒ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚âƒ‚âË‚âx€‘í¹…µ•ôƒ‚æ‚â—‚æ'‚â€¤ì(€ô•±Í”ì(€€€Ñ½…ÍÐ ‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚âƒ‚âË‚â{‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â è€ˆ€¬É•Ì¹É•…Í½¸°€‰Ý…É¸ˆ¤ì(€ô)ô)…Íå¹Œ™Õ¹Ñ¥½¸…ÁÑÕÉ•A…” ¤ì(€½¹ÍÐÉ½½Ð€ô€ ˆÙ¥•ÝI½½Ðˆ¤ì(€½¹ÍÐ¹…µ”€ô€‘íÍÑ…Ñ”¹É½ÕÑ•õ}™Õ±°µÁ…•|‘íÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹™É½µô¹Á¹€ì(€Ñ½…ÍÐ ‹‚â‚âÏ‚â—‚âÇ‚â‚â«‚â‚æ'‚âË‚â‚âƒ‚âË‚â{‚â_‚âÇ‚æ'‚â‚â¯‚âg‚æ'‚âÈ¸¸¸ˆ¤ì(€¥˜€¡áÁ½ÉÑ•È¹¡…Í…¹Ù…Ì ¤¤ì(€€€½¹ÍÐÉ•Ì€ô…Ý…¥ÐáÁ½ÉÑ•È¹…ÁÑÕÉ”¡É½½Ð°¹…µ”°ì‰…­É½Õ¹è€ˆ˜É˜Ý™ˆ°Í…±”è€Ä¸Øô¤ì(€€€¥˜€¡É•Ì¹½¬¤ì(€€€€€±½Ñ¥½¸ ‰•áÁ½ÉÐˆ°€‰¥µ…”ˆ°I=UQ}5AmÍÑ…Ñ”¹É½ÕÑ•t¹Ñ¥Ñ±”°€‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â_‚âÇ‚æ'‚â‚â¯‚âg‚æ'‚âË‚æ‚âo‚æ‚âg‚âƒ‚âË‚âxˆ¤ì(€€€€€É•ÑÕÉ¸Ñ½…ÍÐ¡ƒ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚âƒ‚âË‚âx€‘í¹…µ•ôƒ‚æ‚â—‚æ'‚â€¤ì(€€€ô(€ô(€€¼¼ƒ‚â_‚âË‚â‚â«‚âÏ‚â‚â·‚âèƒ‚âW‚æ#‚â·‚âƒ‚âË‚â{‚â_‚â×‚â—‚âÃ‚â‚âË‚â‚æ3‚âS‚æ‚â‚â×‚â‹‚â‚â—‚â‚â‡‚âÈƒ‚æ‚â¯‚æ'‚âs‚â—‚æ‚âg‚æ#‚âg‚â·‚âg‚â‚âŸ‚æ#‚âË‚â‚âË‚âŒÉ•¹‘•Èƒ‚â_‚âÇ‚æ'‚â‚â¯‚âg‚æ'‚âË‚æ‚âg‚â‚â‚âË‚âŸ‚æ‚âS‚â×‚â‹‚âœ(€ÑÉäì(€€€½¹ÍÐÁ…¹•±Ì€ô€ ˆÙ¥•ÝI½½Ð€¹Á…¹•°°€Ù¥•ÝI½½Ð€¹ÍÑ…ÑÕÌµÍÑÉ¥À°€Ù¥•ÝI½½Ð€¹Á¥Á•±¥¹”ˆ¤¹™¥±Ñ•È ¡•°¤€ôø€…•°¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰¹¼µ…ÁÑÕÉ”ˆ¤€˜˜€…•°¹±½Í•ÍÐ ˆ¹¹¼µ…ÁÑÕÉ”ˆ¤¤ì(€€€½¹ÍÐ¸€ô…Ý…¥ÐáÁ½ÉÑ•È¹ÍÑ¥Ñ ¡Á…¹•±Ì°¹…µ”°ì(€€€€€‰…­É½Õ¹è€ˆ˜É˜Ý™ˆ°(€€€€€Í…±”è€Ä¸Ø°(€€€€€¡•…‘¥¹œèI=UQ}5AmÍÑ…Ñ”¹É½ÕÑ•t¹Ñ¥Ñ±”°(€€€€€ÍÕ‰¡•…‘¥¹œèƒ‚â+‚æ#‚âŸ‚â‚â‚æ'‚â·‚â‡‚âç‚â”€‘íÉ…¹•1…‰•° ¥ôƒ
Üƒ‚â·‚â·‚â‚æ‚âS‚âˆ€‘íÕÉÉ•¹ÑUÍ•È ¤¹ÕÍ•É¹…µ•ôƒ‚æ‚â‡‚âß‚æ#‚â´€‘í¹½ÝMÑ…µÀ ¥õ€°(€€€ô¤ì(€€€±½Ñ¥½¸ ‰•áÁ½ÉÐˆ°€‰¥µ…”ˆ°I=UQ}5AmÍÑ…Ñ”¹É½ÕÑ•t¹Ñ¥Ñ±”°ƒ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â_‚âÇ‚æ'‚â‚â¯‚âg‚æ'‚âË‚æ‚âo‚æ‚âg‚âƒ‚âË‚âx€‘í¹ôƒ‚â«‚æ#‚âŸ‚âe€¤ì(€€€Ñ½…ÍÐ¡ƒ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚âƒ‚âË‚âx€‘í¹…µ•ôƒ‚æ‚â—‚æ'‚âœ€ ‘í¹ôƒ‚â«‚æ#‚âŸ‚âd¥€¤ì(€ô…Ñ €¡”¤ì(€€€Ñ½…ÍÐ ‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚âƒ‚âË‚â{‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â è€ˆ€¬”¹µ•ÍÍ…”°€‰Ý…É¸ˆ¤ì(€ô)ô((¼¨ƒ‚æ‚â«‚æ#‚âo‚âã‚æ#‚â‡‚â‚â—‚æ'‚â·‚â‚æ‚â¯‚æ'‚â_‚âã‚â‚â‚âË‚â‚æ3‚âS‚æ‚âS‚â‹‚â·‚âÇ‚âW‚æ‚âg‚â‡‚âÇ‚âW‚âÓ‚â¯‚â—‚âÇ‚âÉ•¹‘•È€¨¼)™Õ¹Ñ¥½¸…‘‘A…¹•±…ÁÑÕÉ•	ÕÑÑ½¹Ì ¤ì(€€ ˆÙ¥•ÝI½½Ð€¹Á…¹•°ˆ¤¹™½É…  ¡Á…¹•°¤€ôøì(€€€¥˜€¡Á…¹•°¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰¹¼µ…ÁÑÕÉ”ˆ¤ñðÁ…¹•°¹ÅÕ•ÉåM•±•Ñ½È ˆ¹Á…¹•°µ…´ˆ¤¤É•ÑÕÉ¸ì(€€€½¹ÍÐ¡•…€ôÁ…¹•°¹ÅÕ•ÉåM•±•Ñ½È ˆ¹Á…¹•°µ¡•…‘¥¹œˆ¤ì(€€€½¹ÍÐ‰Ñ¸€ô‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‰ÕÑÑ½¸ˆ¤ì(€€€‰Ñ¸¹±…ÍÍ9…µ”€ô€‰Á…¹•°µ…´¹¼µ…ÁÑÕÉ”ˆ€¬€¡¡•…€ü€ˆˆ€è€ˆ™±½…Ðˆ¤ì(€€€‰Ñ¸¹ÑåÁ”€ô€‰‰ÕÑÑ½¸ˆì(€€€‰Ñ¸¹Ñ¥Ñ±”€ô€‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â«‚æ#‚âŸ‚âg‚âg‚â×‚æ'‚æ‚âo‚æ‚âg‚âƒ‚âË‚âxA9ˆì(€€€‰Ñ¸¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ°€‹‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â«‚æ#‚âŸ‚âg‚âg‚â×‚æ'‚æ‚âo‚æ‚âg‚âƒ‚âË‚âxˆ¤ì(€€€‰Ñ¸¹¥¹¹•É!Q50€ô€ñÍÙœÙ¥•Ý	½àôˆÀ€À€ÈÐ€ÈÐˆ…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆøñÁ…Ñ ô‰4ä€Ì€Ü¸È€Õ Ñ„È€È€À€À€À´È€ÉØÄÅ„È€È€À€À€À€È€É ÄÙ„È€È€À€À€À€È´ÉXÝ„È€È€À€À€À´È´É ´Ì¸É0ÄÔ€Í åi´Ì€Ô¸Õ„Ô€Ô€À€Ä€Ä€À€ÄÀ€Ô€Ô€À€À€Ä€À´ÄÁi´À€É„Ì€Ì€À€Ä€À€À€Ø€Ì€Ì€À€À€À€À´Ùhˆ¼øð½ÍÙœù€ì(€€€‰Ñ¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€¡”¤€ôøì(€€€€€”¹ÍÑ½ÁAÉ½Á……Ñ¥½¸ ¤ì(€€€€€…ÁÑÕÉ•A…¹•°¡Á…¹•°¤ì(€€€ô¤ì(€€€€¡¡•…ñðÁ…¹•°¤¹…ÁÁ•¹‘¡¥±¡‰Ñ¸¤ì(€ô¤ì)ô((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€áÁ½ÉÐ¡•±Á•ÉÌ(€€€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼)™Õ¹Ñ¥½¸‘½Ý¹±½…‘MX¡™¥±•¹…µ”°¡•…‘•ÉÌ°É½ÝÌ°Í¡••Ñ9…µ”¤ì(€É•ÑÕÉ¸•áÁ½ÉÑM¡••ÑÌ¡™¥±•¹…µ”¹É•Á±…” ½p¸¡ÍÙñá±Íà¤½¤°€ˆˆ¤°l(€€€ì¹…µ”èÍ¡••Ñ9…µ”ñð€‹‚â‚æ'‚â·‚â‡‚âç‚â”ˆ°Ñ¥Ñ±”èÍ¡••Ñ9…µ”ñð™¥±•¹…µ”¹É•Á±…” ½p¸¡ÍÙñá±Íà¤½¤°€ˆˆ¤°¡•…‘•ÉÌ°É½ÝÌ°Ý¥‘Ñ¡Ìè¡•…‘•ÉÌ¹µ…À  ¤€ôø€Äà¤ô°(€t¤ì)ô)™Õ¹Ñ¥½¸•áÁ½ÉÑá•ÁÑ¥½¹Ì ¤ì(€•áÁ½ÉÑM¡••ÑÌ ‹‚â‚âË‚â‹‚â‚âË‚â‚âs‚âÓ‚âS‚âo‚â‚âW‚âÐˆ°‰Õ¥±‘I•Ù¥•ÝáÁ½ÉÑM¡••ÑÌ ¤¤ì)ô((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€	½½Ð(€€€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼)±•ÐÁÉ½‘ÕÑ¥½¹…Ñ…I•…‘ä€ô™…±Í”ì()™Õ¹Ñ¥½¸ÁÉ•Á…É•AÉ½‘ÕÑ¥½¹…Ñ„ ¤ì(€¥˜€¡ÁÉ½‘ÕÑ¥½¹…Ñ…I•…‘ä¤É•ÑÕÉ¸ì(€ÁÉ½‘ÕÑ¥½¹…Ñ…I•…‘ä€ôÑÉÕ”ì(€¹•á•ÁÑ¥½¹Ì€ômtì(€¹‘…µ…•Ì€ômtì(€¹™¥±•Ì€ômtì(€¹…Õ‘¥Ñ1½œ€ômtì(€¹ÕÉÉ•¹ÑIÕ¸€ô¹Õ±°ì(€¥˜€¡ÉÉ…ä¹¥ÍÉÉ…ä¡¹¡½ÕÉ±ä¤¤¹¡½ÕÉ±ä¹™½É…  ¡à¤€ôøìà¹Ñ½Ñ…°€ô€Àìà¹µ…Ñ¡•€ô€Àìà¹•á•ÁÑ¥½¸€ô€Àìô¤ì(€½¹ÍÐ…½Õ¹ÑÌ€ô±½…‘I•¥ÍÑÉå½Õ¹ÑÌ ¤ì(€¥˜€¡…½Õ¹ÑÌ¤¹…½Õ¹ÑÌ€ô…½Õ¹ÑÌì(€ÍÑ…Ñ”¹‘…Ñ…Í•Ð€ô€‰ÁÉ½‘ÕÑ¥½¸ˆì)ô()…Íå¹Œ™Õ¹Ñ¥½¸…ÁÁ±åÕÑ¡•¹Ñ¥…Ñ•‘I½±”¡•¹ÑÉå•ÍÌ¤ì(€½¹ÍÐÕÍ•È€ôMˆ¹…ÕÑ¡UÍ•È ¤ñðíôì(€½¹ÍÐ•µ…¥°€ôMÑÉ¥¹œ¡ÕÍ•È¹•µ…¥°ñð€ˆˆ¤¹Ñ½1½Ý•É…Í” ¤ì(€½¹ÍÐ…ÁÀ€ôÝ¥¹‘½Ü¹AA}=9%ñðíôì(€±•Ð…•ÍÌ€ô¹Õ±°ì(€ÑÉäì(€€€¥˜€¡•¹ÑÉå•ÍÌü¹ÍÑ…ÑÕÌ€ôôô€É•©•Ñ•œ¤Ñ¡É½Ü•¹ÑÉå•ÍÌ¹É•…Í½¸ì(€€€…•ÍÌ€ô•¹ÑÉå•ÍÌü¹ÍÑ…ÑÕÌ€ôôô€™Õ±™¥±±•œ€ü•¹ÑÉå•ÍÌ¹Ù…±Õ”€è…Ý…¥ÐMˆ¹µå•ÍÌ ¤ì(€€€¥˜€¡ÉÉ…ä¹¥ÍÉÉ…ä¡…•ÍÌ¤¤…•ÍÌ€ô…•ÍÍlÁtñð¹Õ±°ì(€ô…Ñ €¡•ÉÉ½È¤ì(€€€€¼¨ƒ‚â+‚æ#‚âŸ‚â‘•Á±½äµ¥É…Ñ¥½¸ƒ‚æ‚â¯‚æ'‚âk‚âÇ‚â7‚â+‚âÔ‰½½ÑÍÑÉ…Àƒ‚æ‚âS‚âÓ‚â‡‚â‹‚âÇ‚â‚æ‚â‚æ'‚âË‚æ‚âo‚âW‚âÓ‚âS‚âW‚âÇ‚æ'‚âÍ¡•µ„ƒ‚æ‚âS‚æ$(€€€€€€ƒ‚âk‚âÇ‚â7‚â+‚â×‚â·‚âß‚æ#‚âg‚â#‚âÃ‚æ‚â‡‚æ#‚â[‚âç‚â‚â·‚âg‚âã‚â7‚âË‚âW‚â#‚âË‚â‚â‚æ#‚âÈ‘•™…Õ±Ðƒ‚â¯‚â‚âß‚â´µ•Ñ…‘…Ñ„ƒ‚æ‚âd‰É½ÝÍ•È€¨¼(€€€½¹ÍÐ‰½½ÑÍÑÉ…ÁI½±”€ô…ÁÀ¹É½±•	åµ…¥°ü¹m•µ…¥±tì(€€€¥˜€ …‰½½ÑÍÑÉ…ÁI½±”¤Ñ¡É½Ü•ÉÉ½Èì(€€€…•ÍÌ€ôì•µ…¥°°™Õ±±}¹…µ”è•µ…¥°°É½±”è‰½½ÑÍÑÉ…ÁI½±”°…Ñ¥Ù”èÑÉÕ”°½µÁ…¹¥•Ìèlˆ¨‰t°µ¥É…Ñ¥½¹}Á•¹‘¥¹œèÑÉÕ”ôì(€ô(€¥˜€ ……•ÍÌü¹…Ñ¥Ù”¤ì(€€€½¹ÍÐ•ÉÉ½È€ô¹•ÜÉÉ½È ‹‚âk‚âÇ‚â7‚â+‚â×‚âg‚â×‚æ'‚â[‚âç‚â‚â‚âÃ‚â‚âÇ‚âk‚â¯‚â‚âß‚â·‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â‚âÏ‚â¯‚âg‚âS‚â«‚âÓ‚â_‚âc‚âÓ‚æ0ƒ‚â‚â‚âã‚âO‚âË‚âW‚âÓ‚âS‚âW‚æ#‚â·‚âs‚âç‚æ'‚âS‚âç‚æ‚â—‚â‚âÃ‚âk‚âhˆ¤ì(€€€•ÉÉ½È¹½‘”€ô€AA}MM}9%œì(€€€Ñ¡É½Ü•ÉÉ½Èì(€ô(€½¹ÍÐÉ•ÅÕ•ÍÑ•€ôI=UQ}I=1Mm…•ÍÌ¹É½±•t€ü…•ÍÌ¹É½±”€è€‰µ½¹¥Ñ½Èˆì(€ÍÑ…Ñ”¹É½±”€ôÉ•ÅÕ•ÍÑ•ì(€ÍÑ…Ñ”¹…•ÍÌ€ôì(€€€•µ…¥°è…•ÍÌ¹•µ…¥°ñð•µ…¥°°(€€€™Õ±±9…µ”è…•ÍÌ¹™Õ±±}¹…µ”ñð…•ÍÌ¹•µ…¥°ñð•µ…¥°°(€€€É½±”èÉ•ÅÕ•ÍÑ•°(€€€½µÁ…¹¥•ÌèÉÉ…ä¹¥ÍÉÉ…ä¡…•ÍÌ¹½µÁ…¹¥•Ì¤€ü…•ÍÌ¹½µÁ…¹¥•Ì¹µ…À ¡Ù…±Õ”¤€ôøMÑÉ¥¹œ¡Ù…±Õ”¤¹Ñ½UÁÁ•É…Í” ¤¤€èmt°(€€€…Ñ¥Ù”èÑÉÕ”°(€€€±½…‘•è€……•ÍÌ¹µ¥É…Ñ¥½¹}Á•¹‘¥¹œ°(€ôì(€¥˜€¡ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä€„ôô€‰10ˆ€˜˜€……¹•ÍÍ½µÁ…¹ä¡ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä¤¤ÍÑ…Ñ”¹™¥±Ñ•ÉÌ¹½µÁ…¹ä€ô€‰10ˆì(€¥˜€¡ÍÑ…Ñ”¹‘…¥±åMÕµµ…Éä¹½µÁ…¹ä€˜˜€……¹•ÍÍ½µÁ…¹ä¡ÍÑ…Ñ”¹‘…¥±åMÕµµ…Éä¹½µÁ…¹ä¤¤ÍÑ…Ñ”¹‘…¥±åMÕµµ…Éä¹½µÁ…¹ä€ô½µÁ…¹å5…ÍÑ•È ¥lÁtü¹½‘”ñð€ˆˆì(€€ ˆÍ¥¹•‘UÍ•Èˆ¤¹¥¹¹•É!Q50€ô€‘í ¡ÍÑ…Ñ”¹…•ÍÌ¹™Õ±±9…µ”¥ôñÍµ…±°ø‘í ¡¹É½±•ÍmÍÑ…Ñ”¹É½±•t¹¹…µ”¥ôð½Íµ…±°ù€ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸•¹Ñ•ÉAÉ½‘ÕÑ¥½¹ÁÀ ¤ì(€¥˜€¡•¹Ñ•ÉAÉ½‘ÕÑ¥½¹ÁÀ¹Á•¹‘¥¹œ¤É•ÑÕÉ¸•¹Ñ•ÉAÉ½‘ÕÑ¥½¹ÁÀ¹Á•¹‘¥¹œì(€½¹ÍÐÁ•¹‘¥¹œ€ôÁ•É™½ÉµAÉ½‘ÕÑ¥½¹¹ÑÉä ¤ì(€•¹Ñ•ÉAÉ½‘ÕÑ¥½¹ÁÀ¹Á•¹‘¥¹œ€ôÁ•¹‘¥¹œì(€ÑÉäìÉ•ÑÕÉ¸…Ý…¥ÐÁ•¹‘¥¹œìô(€™¥¹…±±äì¥˜€¡•¹Ñ•ÉAÉ½‘ÕÑ¥½¹ÁÀ¹Á•¹‘¥¹œ€ôôôÁ•¹‘¥¹œ¤•¹Ñ•ÉAÉ½‘ÕÑ¥½¹ÁÀ¹Á•¹‘¥¹œ€ô¹Õ±°ìô)ô()…Íå¹Œ™Õ¹Ñ¥½¸É•…‘AÉ½‘ÕÑ¥½¹¹ÑÉå¡•­Ì ¤ì(€€¼¼	½Ñ ¡•­ÌµÕÍÐ™¥¹¥Í ‰•™½É”…‘µ¥ÍÍ¥½¸¸M•ÑÑ±”…•ÍÌ•ÉÉ½ÉÌ¥µµ•‘¥…Ñ•±ä(€€¼¼•Ù•¸Ý¡•¸Ñ¡”Á…ÍÍÝ½É…Ñ”¥ÌÍ±½Ý•Èì¹¼‘…Ñ„ÁÉ•™•Ñ ‰•™½É”…‘µ¥ÍÍ¥½¸¸(€½¹ÍÐmÁ…ÍÍÝ½É°…•ÍÍt€ô…Ý…¥ÐAÉ½µ¥Í”¹…±±M•ÑÑ±•¡l(€€€Mˆ¹Á…ÍÍÝ½É‘¡…¹•I•ÅÕ¥É• ¤°Mˆ¹µå•ÍÌ ¤°(€t¤ì(€¥˜€¡Á…ÍÍÝ½É¹ÍÑ…ÑÕÌ€ôôô€É•©•Ñ•œ¤Ñ¡É½ÜÁ…ÍÍÝ½É¹É•…Í½¸ì(€É•ÑÕÉ¸ìÁ…ÍÍÝ½É‘I•ÅÕ¥É•èÁ…ÍÍÝ½É¹Ù…±Õ”°…•ÍÌôì)ô()™Õ¹Ñ¥½¸¥ÍQ•Éµ¥¹…±M•ÍÍ¥½¹ÉÉ½È¡•ÉÉ½È¤ì(€½¹ÍÐµ•ÍÍ…”€ôMÑÉ¥¹œ¡•ÉÉ½Èü¹µ•ÍÍ…”ñð€œœ¤¹Ñ½1½Ý•É…Í” ¤ì(€É•ÑÕÉ¸µ•ÍÍ…”¹¥¹±Õ‘•Ì ¥¹Ù…±¥É•™É•Í Ñ½­•¸œ¤ñð(€€€µ•ÍÍ…”¹¥¹±Õ‘•Ì É•™É•Í Ñ½­•¸¹½Ð™½Õ¹œ¤ñð(€€€µ•ÍÍ…”¹¥¹±Õ‘•Ì É•™É•Í¡}Ñ½­•¹}¹½Ñ}™½Õ¹œ¤ñð(€€€µ•ÍÍ…”¹¥¹±Õ‘•Ì …±É•…‘äÕÍ•œ¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸Á•É™½ÉµAÉ½‘ÕÑ¥½¹¹ÑÉä ¤ì(€½¹ÍÐÕÍ•È€ôMˆ¹…ÕÑ¡UÍ•È ¤ñðíôì(€½¹ÍÐ•µ…¥°€ôMÑÉ¥¹œ¡ÕÍ•È¹•µ…¥°ñð€ˆˆ¤¹ÑÉ¥´ ¤¹Ñ½1½Ý•É…Í” ¤ì(€½¹ÍÐÁÉ•Í•ÉÙ•]½É¬€ôÑåÁ•½˜ÍÑ…Ñ”€„ôô€Õ¹‘•™¥¹•œ€˜˜ÍÑ…Ñ”¹…•ÍÌü¹±½…‘•€˜˜ÍÑ…Ñ”¹…•ÍÌ¹•µ…¥°ü¹Ñ½1½Ý•É…Í” ¤€ôôô•µ…¥°€˜˜€ œ…ÁÁM¡•±°œ¤¹¡¥‘‘•¸€ôôô™…±Í”ì(€½¹ÍÐÁÉ¥½ÉM½Á”€ôÁÉ•Í•ÉÙ•]½É¬€ü)M=8¹ÍÑÉ¥¹¥™ä¡mÍÑ…Ñ”¹…•ÍÌ¹É½±”°ÍÑ…Ñ”¹…•ÍÌ¹½µÁ…¹¥•Ít¤€è¹Õ±°ì(€Í¡½Ý½¹¹•Ñ¥¹…Ñ” Ÿ‚â‚âÏ‚â—‚âÇ‚â‚âW‚â‚âŸ‚â#‚â«‚âÓ‚â_‚âc‚âÓ‚æ0ƒ
Üƒ‚æ‚â‚æ‚âk‚â¯‚âg‚æ'‚âË‚â_‚âÏ‚â‚âË‚âg‚æ‚â—‚âÃ‚â‚æ'‚â·‚â‚âŸ‚âË‚â‡‚â‚æ#‚âË‚â‚æ‚âŸ‚æ$ƒ‚â‹‚âÇ‚â‚âk‚âÇ‚âg‚â_‚âÛ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â#‚âg‚â‚âŸ‚æ#‚âË‚â#‚âÃ‚âW‚â‚âŸ‚â#‚â«‚âÏ‚æ‚â‚æ‚â œ°¹Õ±°°ÁÉ•Í•ÉÙ•]½É¬¤ì(€¥˜€ …•µ…¥°¤ì(€€€Mˆ¹Í¥¹=ÕÐ ¤ì(€€€Í¡½Ý1½¥¹…Ñ” ‹‚æ‚â‡‚æ#‚â{‚âk‚â·‚â×‚æ‚â‡‚â—‚â‚â·‚â‚âk‚âÇ‚â7‚â+‚âÔƒ‚â‚â‚âã‚âO‚âË‚æ‚â‚æ'‚âË‚â«‚âç‚æ#‚â‚âÃ‚âk‚âk‚æ‚â¯‚â‡‚æ ˆ¤ì(€€€É•ÑÕÉ¸™…±Í”ì(€ô(€½¹ÍÐ…•ÍÍ]…¥ÑQ¥µ•È€ôÍ•ÑQ¥µ•½ÕÐ  ¤€ôøì(€€€¥˜€ „ œ½¹¹•Ñ¥½¹…Ñ”œ¤¹¡¥‘‘•¸¤€ œ½¹¹•Ñ¥½¹5•ÍÍ…”œ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô€Ÿ‚âC‚âË‚âg‚â‚æ'‚â·‚â‡‚âç‚â—‚âW‚â‚âŸ‚â#‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚âW‚â·‚âk‚â‚â—‚âÇ‚âk‚â+‚æ'‚âÈƒ‚â‚âÏ‚â—‚âÇ‚â‚â‚â·‚æ‚âk‚âk‚â#‚âÏ‚â‚âÇ‚âS‚æ‚âŸ‚â—‚âÈƒŠPƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â·‚â·‚â‚â#‚âË‚â‚â‚âÃ‚âk‚âhƒ‚æ‚â‡‚æ#‚âW‚æ'‚â·‚â‚â‚â×‚æ‚â‚â‚â+‚â¯‚â‚âß‚â·‚æ‚â‚æ'‚âË‚â«‚âç‚æ#‚â‚âÃ‚âk‚âk‚â/‚æ'‚âÌœì(€ô°€ÄÀÀÀÀ¤ì(€ÑÉäì(€€€½¹ÍÐ•¹ÑÉå¡•­Ì€ô…Ý…¥ÐÉ•…‘AÉ½‘ÕÑ¥½¹¹ÑÉå¡•­Ì ¤ì(€€€¥˜¡•¹ÑÉå¡•­Ì¹Á…ÍÍÝ½É‘I•ÅÕ¥É•¥ì(€€€€€€ œ…•ÍÍ]…¥Ñ9½Ñ¥”œ¤ü¹É•µ½Ù”ü¸ ¤ì(€€€€€™½È€¡½¹ÍÐ¥½˜lœ‘É…Ý•Èœ°€œµ½‘…°œ°€œ‘É…Ý•É=Ù•É±…äœ°€œµ½‘…±=Ù•É±…ät¤ì½¹ÍÐ¹½‘”€ô€¡¥¤ì¥˜€¡¹½‘”¤¹½‘”¹¡¥‘‘•¸€ôÑÉÕ”ìô(€€€€€€ œ½¹¹•Ñ¥½¹…Ñ”œ¤¹¡¥‘‘•¸õÑÉÕ”ì œ…ÁÁM¡•±°œ¤¹¡¥‘‘•¸õÑÉÕ”ì œ±½¥¹…Ñ”œ¤¹¡¥‘‘•¸õ™…±Í”ì(€€€€€€ œ±½¥¹½É´œ¤¹¡¥‘‘•¸õÑÉÕ”ì œÉ•Í•Ñ½É´œ¤¹¡¥‘‘•¸õ™…±Í”ì(€€€€€€ œÉ•Í•Ñ½É´œ¤¹‘…Ñ…Í•Ð¹™¥ÉÍÑA…ÍÍÝ½ÉôÑÉÕ”œì œÉ•Í•ÑÉÉ½Èœ¤¹¡¥‘‘•¸õÑÉÕ”ì(€€€€€€ œÉ•Í•Ñ½É´ Ä°€É•Í•Ñ½É´ Èœ¤¹Ñ•áÑ½¹Ñ•¹ÐôŸ‚âW‚âÇ‚æ'‚â‚â‚â¯‚âÇ‚â«‚âs‚æ#‚âË‚âg‚â«‚æ#‚âŸ‚âg‚âW‚âÇ‚âŸ‚â‚æ#‚â·‚âg‚æ‚â‚âÓ‚æ#‚â‡‚æ‚â+‚æ'‚â‚âË‚âdœì(€€€€€€ œÉ•Í•Ñ½É´€¹±½¥¸µ±•…œ¤¹Ñ•áÑ½¹Ñ•¹ÐôŸ‚âW‚âÇ‚æ'‚â‚â‚â¯‚âÇ‚â«‚æ‚â¯‚â‡‚æ#‚â·‚â‹‚æ#‚âË‚â‚âg‚æ'‚â·‚âˆ€äƒ‚âW‚âÇ‚âœƒ‚â‡‚â×‚âW‚âÇ‚âŸ‚â·‚âÇ‚â‚â§‚â‚æ‚â—‚âÃ‚âW‚âÇ‚âŸ‚æ‚â—‚âƒ‚æ‚â‡‚æ#‚æ‚â+‚æ'‚â‚â¯‚âÇ‚â«‚æ‚â‚âÓ‚æ#‚â‡‚âW‚æ'‚âg‚æ‚âS‚âÓ‚â„ƒ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âo‚âÓ‚âS‚â‚æ'‚â·‚â‡‚âç‚â—‚â#‚âg‚â‚âŸ‚æ#‚âË‚â#‚âÃ‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â«‚âÏ‚æ‚â‚æ‚â œì(€€€€€É•ÑÕÉ¸™…±Í”ì(€€€ô(€€€…Ý…¥Ð…ÁÁ±åÕÑ¡•¹Ñ¥…Ñ•‘I½±”¡•¹ÑÉå¡•­Ì¹…•ÍÌ¤ì(€ô…Ñ €¡•ÉÉ½È¤ì(€€€¥˜€¡•ÉÉ½È¹½‘”€ôôô€AA}MM}9%œ¤ì(€€€€€Mˆ¹Í¥¹=ÕÐ ¤ì(€€€€€Í¡½Ý1½¥¹…Ñ”¡•ÉÉ½È¹µ•ÍÍ…”¤ì(€€€ô•±Í”¥˜€¡¥ÍQ•Éµ¥¹…±M•ÍÍ¥½¹ÉÉ½È¡•ÉÉ½È¤¤ì(€€€€€Mˆ¹Í¥¹=ÕÐ ¤ì(€€€€€Í¡½Ý1½¥¹…Ñ” Ÿ‚â«‚â[‚âË‚âg‚âÃ‚æ‚â‚æ'‚âË‚â«‚âç‚æ#‚â‚âÃ‚âk‚âk‚â¯‚â‡‚âS‚â·‚âË‚â‹‚âã‚â¯‚â‚âß‚â·‚â[‚âç‚â‚æ‚â+‚æ'‚â‚âË‚âg‚â#‚âË‚â‚æ‚â_‚æ‚âk‚â·‚âß‚æ#‚âg‚æ‚â—‚æ'‚âœƒ‚â‚â‚âã‚âO‚âË‚æ‚â‚æ'‚âË‚â«‚âç‚æ#‚â‚âÃ‚âk‚âk‚æ‚â¯‚â‡‚æ œ¤ì(€€€ô•±Í”ì(€€€€€Í¡½Ý½¹¹•Ñ¥¹…Ñ” Ÿ‚æ‚â+‚âß‚æ#‚â·‚â‡‚âW‚æ#‚â·‚æ‚â{‚âß‚æ#‚â·‚âW‚â‚âŸ‚â#‚â«‚âÓ‚â_‚âc‚âÓ‚æ3‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ƒŠPƒ‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â·‚â·‚â‚â#‚âË‚â‚â‚âÃ‚âk‚âhƒ‚æ‚â—‚âÃ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â‹‚âß‚âg‚â‹‚âÇ‚âg‚âŸ‚æ#‚âË‚âk‚âÇ‚âg‚â_‚âÛ‚â‚â‚âË‚âg‚â«‚âÏ‚æ‚â‚æ‚â è€œ€¬€¡•ÉÉ½È¹µ•ÍÍ…”ñð€Ÿ‚â‚âË‚â‚æ‚â+‚âß‚æ#‚â·‚â‡‚âW‚æ#‚â·‚â‚âÇ‚âS‚â‚æ'‚â·‚âœ¤°€ ¤€ôø•¹Ñ•ÉAÉ½‘ÕÑ¥½¹ÁÀ ¤°ÁÉ•Í•ÉÙ•]½É¬¤ì(€€€ô(€€€É•ÑÕÉ¸™…±Í”ì(€ô™¥¹…±±äì±•…ÉQ¥µ•½ÕÐ¡…•ÍÍ]…¥ÑQ¥µ•È¤ìô(€€ œ…•ÍÍ]…¥Ñ9½Ñ¥”œ¤ü¹É•µ½Ù”ü¸ ¤ì(€€ œ…ÁÁM¡•±°œ¤¹¥¹•ÉÐ€ô™…±Í”ì(€™½È€¡½¹ÍÐ¥½˜lœ‘É…Ý•Èœ°€œµ½‘…°t¤ì½¹ÍÐ¹½‘”€ô€¡¥¤ì¥˜€¡¹½‘”¤¹½‘”¹¥¹•ÉÐ€ô™…±Í”ìô(€¥˜€¡ÁÉ•Í•ÉÙ•]½É¬€˜˜ÁÉ¥½ÉM½Á”€ôôô)M=8¹ÍÑÉ¥¹¥™ä¡mÍÑ…Ñ”¹…•ÍÌ¹É½±”°ÍÑ…Ñ”¹…•ÍÌ¹½µÁ…¹¥•Ít¤¤É•ÑÕÉ¸ÑÉÕ”ì(€ÁÉ•Á…É•AÉ½‘ÕÑ¥½¹…Ñ„ ¤ì(€€ œ½¹¹•Ñ¥½¹…Ñ”œ¤¹¡¥‘‘•¸€ôÑÉÕ”ì(€€ ˆ±½¥¹…Ñ”ˆ¤¹¡¥‘‘•¸€ôÑÉÕ”ì(€€ ˆ…ÁÁM¡•±°ˆ¤¹¡¥‘‘•¸€ô™…±Í”ì(€ÍÑ…Ñ”¹É½ÕÑ”€ôÁ…ÉÍ•!…Í  ¤ì(€¥˜€ …I=UQ}I=1MmÍÑ…Ñ”¹É½±•t¹¥¹±Õ‘•Ì¡ÍÑ…Ñ”¹É½ÕÑ”¤¤ÍÑ…Ñ”¹É½ÕÑ”€ô€‰±½Õˆì(€¥˜€ …±½…Ñ¥½¸¹¡…Í ñðÁ…ÉÍ•!…Í  ¤€„ôôÍÑ…Ñ”¹É½ÕÑ”¤±½…Ñ¥½¸¹¡…Í €ô€ˆŒ¼ˆ€¬ÍÑ…Ñ”¹É½ÕÑ”ì(€±½Õ‘MÑ…Ñ”¹‰…Ñ¡•Ì€ô¹Õ±°ì(€±½Õ‘MÑ…Ñ”¹…Í•ÑÑ…¡µ•¹ÑÌ€ô¹Õ±°ì(€±½Õ‘MÑ…Ñ”¹•Ù¥‘•¹•ÉÉ½È€ô¹Õ±°ì(€±½Õ‘MÑ…Ñ”¹‘…¥±ä€ô¹Õ±°ì(€±½Õ‘MÑ…Ñ”¹½Á•É…Ñ¥½¹Ì€ô¹Õ±°ì(€±½Õ‘MÑ…Ñ”¹­•ä€ô€ˆˆì(€±½Õ‘MÑ…Ñ”¹•ÉÉ½È€ô¹Õ±°ì(€±½Õ‘MÑ…Ñ”¹Á…ÉÑ¥…±ÉÉ½È€ô¹Õ±°ì(€±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹‘…¥±ä€ô¹Õ±°ì(€±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹½Á•É…Ñ¥½¹Ì€ô¹Õ±°ì(€±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹ÅÕ…±¥Ñä€ô¹Õ±°ì(€±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹¡•­±¥ÍÐ€ô¹Õ±°ì(€±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹…Í•½Õ¹ÑÌ€ô¹Õ±°ì(€±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹Í•ÑÑ¥¹Ì€ô¹Õ±°ì(€±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹‘…µ…•Ì€ô¹Õ±°ì(€±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹±½Ì€ô¹Õ±°ì(€±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹¹½Ñ¥™¥…Ñ¥½¹Ì€ô¹Õ±°ì(€±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹µ…Ñ¡Ù¥‘•¹”€ômtì(€±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹µ…Ñ¡•‘MÑ…±•á•ÁÑ¥½¹Ì€ô€Àì(€±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹•á•ÁÑ¥½¹ÍI•…‘ä€ô™…±Í”ì(€±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹‘…µ…•ÍI•…‘ä€ô™…±Í”ì(€±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹±½ÍI•…‘ä€ô™…±Í”ì(€±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹½É•ÉÉ½ÉÌ€ômtì(€±¥Ù•=Ù•ÉÙ¥•ÝMÑ…Ñ”¹­•ä€ô€ˆˆì(€‘…¥±å½µÁ…¹åMÑ…Ñ”¹‘…Ñ”€ô€ˆˆì(€‘…¥±å½µÁ…¹åMÑ…Ñ”¹½µÁ…¹ä€ô€ˆˆì(€‘…¥±å½µÁ…¹åMÑ…Ñ”¹‰…Ñ¡•Ì€ô¹Õ±°ì(€‘…¥±å½µÁ…¹åMÑ…Ñ”¹µ…Ñ¡Ù¥‘•¹”€ômtì(€‘…¥±å½µÁ…¹åMÑ…Ñ”¹µ…Ñ¡•‘MÑ…±•á•ÁÑ¥½¹Ì€ô€Àì(€‘…¥±å½µÁ…¹åMÑ…Ñ”¹ÅÕ…±¥Ñä€ô¹Õ±°ì(€‘…¥±å½µÁ…¹åMÑ…Ñ”¹½Á•É…Ñ¥½¹Ì€ô¹Õ±°ì(€‘…¥±å½µÁ…¹åMÑ…Ñ”¹¡•­±¥ÍÐ€ô¹Õ±°ì(€‘…¥±å½µÁ…¹åMÑ…Ñ”¹…Í•½Õ¹ÑÌ€ô¹Õ±°ì(€‘…¥±å½µÁ…¹åMÑ…Ñ”¹‰½¥ÉÍÐ€ô¹Õ±°ì(€‘…¥±å½µÁ…¹åMÑ…Ñ”¹•á•ÁÑ¥½¹Ì€ô¹Õ±°ì(€‘…¥±å½µÁ…¹åMÑ…Ñ”¹‘…µ…•Ì€ô¹Õ±°ì(€‘…¥±å½µÁ…¹åMÑ…Ñ”¹½É•ÉÉ½È€ô¹Õ±°ì(€‘…¥±å½µÁ…¹åMÑ…Ñ”¹•ÉÉ½È€ô¹Õ±°ì(€ÕÁ‘…Ñ•	•±° ¤ì(€É•¹‘•È ¤ì(€€¼¼É•ÍÑ½É•½½±”½MÕÁ…‰…Í”Í•ÍÍ¥½¸‰åÁ…ÍÍ•ÌÑ¡”±•…äÍ¥¸µ¥¸¡…¹‘±•È¸(€€¼¼MÑ…ÉÐÑ¡”É•½¹¥±¥…Ñ¥½¸Ý½É­•È™½È•Ù•Éä…ÕÑ¡•¹Ñ¥…Ñ•…ÁÀ•¹ÑÉäÍ¼(€€¼¼ÅÕ•Õ•©½‰Ì½¹Ñ¥¹Õ”…™Ñ•È„É•™É•Í °‰É½ÝÍ•ÈÉ•ÍÑ…ÉÐ°½È=ÕÑ É•ÑÕÉ¸¸(€ÍÑ…ÉÑ±½Õ‘]½É­•È ¤ì(€€¼¼Q¡”½µÁ…¹äÝ½É­Í¡••Ð±½…‘Ì¥ÑÌ½Ý¸½µµ¥ÑÑ•ÉÕ¸¸¼¹½Ð…±Í¼ÍÑ…ÉÐ(€€¼¼Ñ¡¥ÉÑä‘…åÌ½˜…±°µ½µÁ…¹ä…É•…Ñ•Ì½•Ù¥‘•¹”Ý¡¥±”½Á•¹¥¹œÑ¡…ÐÍ¡••Ð¸(€€¼¼=Ñ¡•ÈÉ½ÕÑ•ÌÉ•Ñ…¥¸Ñ¡•¥È¹½Éµ…°½Ù•ÉÙ¥•Ü±½…‘•ÉÌìÕ¹­¹½Ý¸‰…‘•ÌÍÑ…äƒŠP¸(€¥˜€ …l•á•ÁÑ¥½¹Ìœ°€±½Õœ°€‘…¥±äµÍÕµµ…Éäœ°€µŒàµÍ¡••ÑÌœ°€™¥¹…¹”œ°Í½ÕÉ”µÕÁ±½…œ°Í½ÕÉ”µÉÕ¸t¹¥¹±Õ‘•Ì¡ÍÑ…Ñ”¹É½ÕÑ”¤¤±½…‘1¥Ù•=Ù•ÉÙ¥•Ü ¤¹…Ñ   ¤€ôøíô¤ì(€É•ÑÕÉ¸ÑÉÕ”ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸‰½½Ð ¤ì(€…ÁÁ±åMÑ½É•‘MÑ…Ñ” ¤ì(€±•Ð…ÕÑ¡…±±‰…¬€ô¹Õ±°ì(€ÑÉäì(€€€…ÕÑ¡…±±‰…¬€ô…Ý…¥ÐMˆ¹½¹ÍÕµ•ÕÑ¡!…Í  ¤ì(€ô…Ñ €¡”¤ì(€€€Í¡½Ý1½¥¹…Ñ”¡”¹µ•ÍÍ…”¤ì(€ô(€±•ÐÉ•ÍÑ½É•€ô™…±Í”ì(€±•ÐÉ•ÍÑ½É•ÉÉ½È€ô¹Õ±°ì(€¥˜€ ……ÕÑ¡…±±‰…¬¤ì(€€€ÑÉäìÉ•ÍÑ½É•€ô…Ý…¥ÐMˆ¹É•ÍÑ½É” ¤ìô(€€€…Ñ €¡•ÉÉ½È¤ìÉ•ÍÑ½É•ÉÉ½È€ô•ÉÉ½Èìô(€ô(€€ ˆ±½¥¹µ…¥°ˆ¤¹Ù…±Õ”€ôMˆ¹™œ ¤¹•µ…¥°ñð€ˆˆì(€€ ˆ±½¥¹½É´ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰ÍÕ‰µ¥Ðˆ°…Íå¹Œ€¡•Ù•¹Ð¤€ôøì(€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€½¹ÍÐ‰ÕÑÑ½¸€ô€ ˆ±½¥¹MÕ‰µ¥Ðˆ¤ì(€€€½¹ÍÐ•ÉÉ½È€ô€ ˆ±½¥¹ÉÉ½Èˆ¤ì(€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ôÑÉÕ”ì(€€€‰ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô€‹‚â‚âÏ‚â—‚âÇ‚â‚æ‚â‚æ'‚âË‚â«‚âç‚æ#‚â‚âÃ‚âk‚âh¸¸¸ˆì(€€€•ÉÉ½È¹¡¥‘‘•¸€ôÑÉÕ”ì(€€€ÑÉäì(€€€€€…Ý…¥ÐMˆ¹Í¥¹%¸  ˆ±½¥¹µ…¥°ˆ¤¹Ù…±Õ”¹ÑÉ¥´ ¤°€ ˆ±½¥¹A…ÍÍÝ½Éˆ¤¹Ù…±Õ”¤ì(€€€€€…Ý…¥Ð•¹Ñ•ÉAÉ½‘ÕÑ¥½¹ÁÀ ¤ì(€€€ô…Ñ €¡”¤ì(€€€€€Í¡½Ý1½¥¹…Ñ”¡”¹µ•ÍÍ…”ñð€‹‚æ‚â‚æ'‚âË‚â«‚âç‚æ#‚â‚âÃ‚âk‚âk‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ˆ¤ì(€€€ô™¥¹…±±äì(€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ô™…±Í”ì(€€€€€‰ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô€‹‚æ‚â‚æ'‚âË‚â«‚âç‚æ#‚â‚âÃ‚âk‚âk‚âS‚æ'‚âŸ‚â‹‚â‚â¯‚âÇ‚â«‚âs‚æ#‚âË‚âdˆì(€€€ô(€ô¤ì(€€ ˆ½½±•1½¥¸ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€½¹ÍÐ‰ÕÑÑ½¸€ô€ ˆ½½±•1½¥¸ˆ¤ì(€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ôÑÉÕ”ì(€€€€ ˆ±½¥¹ÉÉ½Èˆ¤¹¡¥‘‘•¸€ôÑÉÕ”ì(€€€ÑÉäì(€€€€€Mˆ¹Í¥¹%¹]¥Ñ¡½½±” ¤ì(€€€ô…Ñ €¡”¤ì(€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ô™…±Í”ì(€€€€€Í¡½Ý1½¥¹…Ñ”¡”¹µ•ÍÍ…”ñð€‹‚æ‚â+‚âß‚æ#‚â·‚â‡‚âW‚æ#‚â´½½±”ƒ‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ˆ¤ì(€€€ô(€ô¤ì(€€ ˆ™½É½ÑA…ÍÍÝ½Éˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°…Íå¹Œ€ ¤€ôøì(€€€½¹ÍÐ•µ…¥°€ô€ ˆ±½¥¹µ…¥°ˆ¤¹Ù…±Õ”¹ÑÉ¥´ ¤ì(€€€½¹ÍÐ•ÉÉ½È€ô€ ˆ±½¥¹ÉÉ½Èˆ¤ì(€€€•ÉÉ½È¹¡¥‘‘•¸€ôÑÉÕ”ì(€€€¥˜€ …•µ…¥°¤ì(€€€€€Í¡½Ý1½¥¹…Ñ” ‹‚â‚â‚âã‚âO‚âË‚â‚â‚â·‚â‚â·‚â×‚æ‚â‡‚â—‚â‚æ#‚â·‚âg‚â‚â·‚â‚â¯‚âÇ‚â«‚âs‚æ#‚âË‚âg‚æ‚â¯‚â‡‚æ ˆ¤ì(€€€€€É•ÑÕÉ¸ì(€€€ô(€€€ÑÉäì(€€€€€…Ý…¥ÐMˆ¹É•ÅÕ•ÍÑA…ÍÍÝ½É‘I•Í•Ð¡•µ…¥°¤ì(€€€€€Í¡½Ý1½¥¹…Ñ” ‹‚â«‚æ#‚â‚â—‚âÓ‚â‚â‚æ3‚âW‚âÇ‚æ'‚â‚â‚â¯‚âÇ‚â«‚âs‚æ#‚âË‚âg‚æ‚â¯‚â‡‚æ#‚æ‚â—‚æ'‚âœƒ‚â‚â‚âã‚âO‚âË‚âW‚â‚âŸ‚â %¹‰½àƒ‚â¯‚â‚âß‚â´MÁ…´ˆ¤ì(€€€ô…Ñ €¡”¤ì(€€€€€Í¡½Ý1½¥¹…Ñ”¡”¹µ•ÍÍ…”ñð€‹‚â«‚æ#‚â‚â—‚âÓ‚â‚â‚æ3‚âW‚âÇ‚æ'‚â‚â‚â¯‚âÇ‚â«‚âs‚æ#‚âË‚âg‚æ‚â¯‚â‡‚æ#‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ˆ¤ì(€€€ô(€ô¤ì(€€ ˆÉ•Í•Ñ½É´ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰ÍÕ‰µ¥Ðˆ°…Íå¹Œ€¡•Ù•¹Ð¤€ôøì(€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€½¹ÍÐÁ…ÍÍÝ½É€ô€ ˆ¹•ÝA…ÍÍÝ½Éˆ¤¹Ù…±Õ”ì(€€€½¹ÍÐ½¹™¥É´€ô€ ˆ½¹™¥ÉµA…ÍÍÝ½Éˆ¤¹Ù…±Õ”ì(€€€½¹ÍÐ•ÉÉ½È€ô€ ˆÉ•Í•ÑÉÉ½Èˆ¤ì(€€€½¹ÍÐ™¥ÉÍÑA…ÍÍÝ½Éô œÉ•Í•Ñ½É´œ¤¹‘…Ñ…Í•Ð¹™¥ÉÍÑA…ÍÍÝ½ÉôôôÑÉÕ”œì(€€€¥˜€¡Á…ÍÍÝ½É¹±•¹Ñ €ð€¡™¥ÉÍÑA…ÍÍÝ½Éüäèà¤ñðÁ…ÍÍÝ½É€„ôô½¹™¥É´ñð€¡™¥ÉÍÑA…ÍÍÝ½É˜˜ „½m„µét½¤¹Ñ•ÍÐ¡Á…ÍÍÝ½É¥ñð„½lÀ´åt¼¹Ñ•ÍÐ¡Á…ÍÍÝ½É¤¤¤¤ì(€€€€€•ÉÉ½È¹Ñ•áÑ½¹Ñ•¹Ð€ô™¥ÉÍÑA…ÍÍÝ½É€ü€Ÿ‚â‚â¯‚âÇ‚â«‚æ‚â¯‚â‡‚æ#‚âW‚æ'‚â·‚â‚â‡‚â×‚â·‚â‹‚æ#‚âË‚â‚âg‚æ'‚â·‚âˆ€äƒ‚âW‚âÇ‚âœƒ‚â‡‚â×‚âW‚âÇ‚âŸ‚â·‚âÇ‚â‚â§‚â‚æ‚â—‚âÃ‚âW‚âÇ‚âŸ‚æ‚â—‚âƒ‚æ‚â—‚âÃ‚â_‚âÇ‚æ'‚â‚â«‚â·‚â‚â+‚æ#‚â·‚â‚âW‚â‚â‚â‚âÇ‚âdœ€èÁ…ÍÍÝ½É¹±•¹Ñ €ð€à€ü€‹‚â‚â¯‚âÇ‚â«‚âs‚æ#‚âË‚âg‚âW‚æ'‚â·‚â‚â‡‚â×‚â·‚â‹‚æ#‚âË‚â‚âg‚æ'‚â·‚âˆ€àƒ‚âW‚âÇ‚âŸ‚â·‚âÇ‚â‚â§‚âŒˆ€è€‹‚â‚â¯‚âÇ‚â«‚âs‚æ#‚âË‚âg‚â_‚âÇ‚æ'‚â‚â«‚â·‚â‚â+‚æ#‚â·‚â‚æ‚â‡‚æ#‚âW‚â‚â‚â‚âÇ‚âdˆì(€€€€€•ÉÉ½È¹¡¥‘‘•¸€ô™…±Í”ì(€€€€€É•ÑÕÉ¸ì(€€€ô(€€€½¹ÍÐ‰ÕÑÑ½¸€ô€ ˆÉ•Í•ÑMÕ‰µ¥Ðˆ¤ì(€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ôÑÉÕ”ì(€€€ÑÉäì(€€€€€¥˜¡™¥ÉÍÑA…ÍÍÝ½É¥í…Ý…¥ÐMˆ¹Á…ÍÍÝ½É‘½Õ¹Ð¡í…Ñ¥½¸è¡…¹•}™¥ÉÍÐœ±Á…ÍÍÝ½É‘ô¤í‘•±•Ñ”€ œÉ•Í•Ñ½É´œ¤¹‘…Ñ…Í•Ð¹™¥ÉÍÑA…ÍÍÝ½Éíô(€€€€€•±Í”…Ý…¥ÐMˆ¹ÕÁ‘…Ñ•A…ÍÍÝ½É¡Á…ÍÍÝ½É¤ì(€€€€€Mˆ¹Í¥¹=ÕÐ ¤ì(€€€€€€ ˆ¹•ÝA…ÍÍÝ½Éˆ¤¹Ù…±Õ”€ô€ˆˆì(€€€€€€ ˆ½¹™¥ÉµA…ÍÍÝ½Éˆ¤¹Ù…±Õ”€ô€ˆˆì(€€€€€Í¡½Ý1½¥¹…Ñ” ‹‚âW‚âÇ‚æ'‚â‚â‚â¯‚âÇ‚â«‚âs‚æ#‚âË‚âg‚æ‚â¯‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â#‚æ‚â—‚æ'‚âœƒ‚â‚â‚âã‚âO‚âË‚æ‚â‚æ'‚âË‚â«‚âç‚æ#‚â‚âÃ‚âk‚âhˆ¤ì(€€€ô…Ñ €¡”¤ì(€€€€€•ÉÉ½È¹Ñ•áÑ½¹Ñ•¹Ð€ô”¹µ•ÍÍ…”ì(€€€€€•ÉÉ½È¹¡¥‘‘•¸€ô™…±Í”ì(€€€ô™¥¹…±±äì(€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ô™…±Í”ì(€€€ô(€ô¤ì(€€ ˆ‰Ñ¹	•±°ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø¼ ‰¹½Ñ¥™¥…Ñ¥½¹Ìˆ¤¤ì(€€ ˆ‰Ñ¹áÁ½ÉÐˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°½Á•¹áÁ½ÉÑ¥…±½œ¤ì(€€ ˆ‰Ñ¹1½½ÕÐˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€Mˆ¹Í¥¹=ÕÐ ¤ì(€€€±½Õ‘MÑ…Ñ”¹‰…Ñ¡•Ì€ô¹Õ±°ì(€€€±½Õ‘MÑ…Ñ”¹…Í•ÑÑ…¡µ•¹ÑÌ€ô¹Õ±°ì(€€€±½Õ‘MÑ…Ñ”¹•Ù¥‘•¹•ÉÉ½È€ô¹Õ±°ì(€€€±½Õ‘MÑ…Ñ”¹É•ÅÕ•ÍÑ%¬¬ì(€€€±½Õ‘MÑ…Ñ”¹±½…‘¥¹œ€ô™…±Í”ì(€€€±½…Ñ¥½¸¹¡…Í €ô€ˆŒ½±½Õˆì(€€€Í¡½Ý1½¥¹…Ñ” ¤ì(€ô¤ì(€€ ˆ…ÕÑ½MÑ…ÑÕÌˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôø¼ ‰±½Õˆ¤¤ì(€€ ˆ¹…ÙQ½±”ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ°€ ¤€ôøì(€€€½¹ÍÐÍˆ€ô€ ˆÍ¥‘•‰…Èˆ¤ì(€€€¥˜€¡Ý¥¹‘½Ü¹µ…Ñ¡5•‘¥„ ˆ¡µ…àµÝ¥‘Ñ è€ÄÀàÁÁà¤ˆ¤¹µ…Ñ¡•Ì¤ì(€€€€€Íˆ¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰½Á•¸ˆ¤ì(€€€€€Õ‘¥ÑU¤¹Íå¹9…Ø ¤ì(€€€€€É•ÑÕÉ¸ì(€€€ô(€€€Í•ÑM¥‘•‰…É½±±…ÁÍ• „ ˆ…ÁÁM¡•±°ˆ¤¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰Í¥‘•‰…Èµ½±±…ÁÍ•ˆ¤¤ì(€€€Õ‘¥ÑU¤¹Íå¹9…Ø ¤ì(€ô¤ì((€¥˜€ …Ý¥¹‘½Ü¹µ…Ñ¡5•‘¥„ ˆ¡µ…àµÝ¥‘Ñ è€ÄÀàÁÁà¤ˆ¤¹µ…Ñ¡•Ì¤ì(€€€±•Ð½±±…ÁÍ•€ô™…±Í”ì(€€€ÑÉäì½±±…ÁÍ•€ô±½…±MÑ½É…”¹•Ñ%Ñ•´ ‰…Õ‘¥ÐµÍ¥‘•‰…Èµ½±±…ÁÍ•ˆ¤€ôôô€ˆÄˆìô…Ñ €¡|¤íô(€€€Í•ÑM¥‘•‰…É½±±…ÁÍ•¡½±±…ÁÍ•¤ì(€ô((€Õ‘¥ÑU¤¹Íå¹9…Ø ¤ì(€Ý¥¹‘½Ü¹µ…Ñ¡5•‘¥„ œ¡µ…àµÝ¥‘Ñ è€ÄÀàÁÁà¤œ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ¡…¹”œ°€ ¤€ôøì€ œÍ¥‘•‰…Èœ¤¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ½Á•¸œ¤ìÕ‘¥ÑU¤¹Íå¹9…Ø ¤ìô¤ì(€¥˜€¡…ÕÑ¡…±±‰…¬€ôôô€‰É•½Ù•Éäˆ¤Í¡½ÝA…ÍÍÝ½É‘I•Í•Ñ…Ñ” ¤ì(€•±Í”¥˜€¡…ÕÑ¡…±±‰…¬¤…Ý…¥Ð•¹Ñ•ÉAÉ½‘ÕÑ¥½¹ÁÀ ¤ì(€•±Í”¥˜€¡É•ÍÑ½É•¤…Ý…¥Ð•¹Ñ•ÉAÉ½‘ÕÑ¥½¹ÁÀ ¤ì(€•±Í”¥˜€¡É•ÍÑ½É•ÉÉ½È¤Í¡½Ý½¹¹•Ñ¥¹…Ñ” Ÿ‚â‚âß‚âg‚â«‚â[‚âË‚âg‚âÃ‚æ‚â‚æ'‚âË‚â«‚âç‚æ#‚â‚âÃ‚âk‚âk‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ƒŠPƒ‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â—‚æ'‚âË‚â‚â—‚æ‚â·‚â‚â·‚âÓ‚âdè€œ€¬€¡É•ÍÑ½É•ÉÉ½È¹µ•ÍÍ…”ñð€Ÿ‚â‚âË‚â‚æ‚â+‚âß‚æ#‚â·‚â‡‚âW‚æ#‚â·‚â‚âÇ‚âS‚â‚æ'‚â·‚âœ¤°…Íå¹Œ€ ¤€ôøì(€€€ÑÉäì(€€€€€¥˜€¡…Ý…¥ÐMˆ¹É•ÍÑ½É” ¤¤…Ý…¥Ð•¹Ñ•ÉAÉ½‘ÕÑ¥½¹ÁÀ ¤ì(€€€€€•±Í”Í¡½Ý1½¥¹…Ñ” Ÿ‚æ‚â‡‚æ#‚â{‚âk‚â«‚â[‚âË‚âg‚âÃ‚æ‚â‚æ'‚âË‚â«‚âç‚æ#‚â‚âÃ‚âk‚âk‚â_‚â×‚æ#‚æ‚â+‚æ'‚âW‚æ#‚â·‚æ‚âS‚æ$ƒ‚â‚â‚âã‚âO‚âË‚æ‚â‚æ'‚âË‚â«‚âç‚æ#‚â‚âÃ‚âk‚âhœ¤ì(€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€€ œ½¹¹•Ñ¥½¹5•ÍÍ…”œ¤¹Ñ•áÑ½¹Ñ•¹Ð€ô€Ÿ‚â‹‚âÇ‚â‚æ‚â+‚âß‚æ#‚â·‚â‡‚âW‚æ#‚â·‚æ‚â‡‚æ#‚æ‚âS‚æ$ƒŠPƒ‚æ‚â‚æ‚âk‚â«‚â[‚âË‚âg‚âÃ‚æ‚âS‚âÓ‚â‡‚æ‚âŸ‚æ'‚æ‚â—‚æ'‚âœè€œ€¬€¡•ÉÉ½È¹µ•ÍÍ…”ñð€Ÿ‚â‚âË‚â‚æ‚â+‚âß‚æ#‚â·‚â‡‚âW‚æ#‚â·‚â‚âÇ‚âS‚â‚æ'‚â·‚âœ¤ì(€€€ô(€ô¤ì(€•±Í”Í¡½Ý1½¥¹…Ñ” ¤ì(€€¼¨ƒ‚â‚âç‚æ'‚â‚âË‚â‚æ‚â‡‚âl€‹‚âk‚â‚âÓ‚â§‚âÇ‚â_‚æ‚â¯‚âg‚â·‚â‹‚âç‚æ#‚â‚âÃ‚âk‚âk‚æ‚â¯‚âdˆƒ‚â_‚â×‚æ#‚âs‚âç‚æ'‚æ‚â+‚æ'‚âW‚âÇ‚æ'‚â‚æ‚âŸ‚æ$€¨¼(€½¹ÍÐÍ…Ù•‘MåÌ€ôMÑ½É”¹‘…Ñ„¹½µÁ…¹åMåÍÑ•µÌñðíôì(€=‰©•Ð¹•¹ÑÉ¥•Ì¡Í…Ù•‘MåÌ¤¹™½É…  ¡m½‘”°ÍåÍ½‘•t¤€ôøì(€€€±•ÐŒ€ô¹½µÁ…¹¥•Ì¹™¥¹ ¡à¤€ôøà¹½‘”€ôôô½‘”¤ì(€€€¥˜€ …Œ¤¹½µÁ…¹¥•Ì¹ÁÕÍ  ¡Œ€ôì½‘”°¹…µ”è½‘”°ÑåÁ”è€‰µ…¥¸ˆ°ÍåÍÑ•´è¹Õ±°ô¤¤ì(€€€Œ¹ÍåÍÑ•´€ôÍåÍ½‘”ñð¹Õ±°ì(€ô¤ì(€É•Ñ…QÉ…­Ì ¤ì)ô)‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ°‰½½Ð¤ì)™Õ¹Ñ¥½¸ÍÑ…Ñ•µ•¹Ñ9••‘Í	½I•Ù¥•Ü¡™¥±”¤ì(€½¹ÍÐÉ•…Í½¸€ôMÑÉ¥¹œ¡™¥±”¹Á…ÉÍ•}•ÉÉ½Èñð€ˆˆ¤ì(€É•ÑÕÉ¸€¿‚â·‚æ#‚âË‚âg‚â‚âË‚â‹‚â‚âË‚â‚æ‚âS‚æ$lÄ´åuq¨ƒ‚â‚âË‚â‹‚â‚âË‚âŒƒ‚æ‚âW‚æ#‚æ‚â‡‚æ#‚â‡‚â×‚â‚âË‚â‹‚â‚âË‚â‚âŸ‚âÇ‚âg‚â_‚â×‚æ ¼¹Ñ•ÍÐ¡É•…Í½¸¤(€€€€˜˜€„¿‚â·‚æ#‚âË‚âg‚æ‚âS‚æ'‚âk‚âË‚â‚â«‚æ#‚âŸ‚âeó‚â·‚æ#‚âË‚âg‚æ‚â‚â—‚æ3‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â!ó‚â·‚æ#‚âË‚âg‚æ‚â‡‚æ#‚æ‚âS‚æ%ó‚æ‚â‚â—‚æ3‚æ‚â«‚â×‚âˆ¼¹Ñ•ÍÐ¡É•…Í½¸¤ì)ô()™Õ¹Ñ¥½¸ÍÑ…Ñ•µ•¹ÑI•Ù¥•Ý1…‰•°¡™¥±”¤ì(€É•ÑÕÉ¸ÍÑ…Ñ•µ•¹Ñ9••‘Í	½I•Ù¥•Ü¡™¥±”¤(€€€€ü€‹‚æ‚âS‚æ'‚â‚âÇ‚âk‚æ‚â‚â—‚æ3‚æ‚â—‚æ'‚âœƒŠPƒ‚æ‚â‡‚æ#‚â{‚âk‚â‚âË‚â‹‚â‚âË‚â‚æ‚âg‚âŸ‚âÇ‚âg‚âW‚â‚âŸ‚â ƒ‚â‚â·‚æ‚â_‚â×‚â‹‚âh	<ˆ(€€€€è€‹‚â·‚æ#‚âË‚âg‚æ‚â‚â—‚æ3‚æ‚â‡‚æ#‚â«‚âÏ‚æ‚â‚æ‚â ˆì)ô((