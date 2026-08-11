/* =============================================================
   Unit tests สำหรับ PdfStm — เน้นการตรวจหัวรายงาน + parser BAY
   รัน: node tests/pdfstm.test.mjs
   ============================================================= */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(dir, "..", "pdf-stm.js"), "utf8");
const sb = { console };
vm.createContext(sb);
vm.runInContext(src + "\n;globalThis.__P = PdfStm;", sb);
const P = sb.__P;

let passed = 0, failed = 0;
const out = [];
const ok = (n, c, extra) => (c ? (passed++, out.push("  ✓ " + n)) : (failed++, out.push("  ✗ " + n + (extra ? "  → " + extra : ""))));
const eq = (n, a, b) => ok(n, a === b, `ได้ ${JSON.stringify(a)} คาดหวัง ${JSON.stringify(b)}`);

/* แปลงข้อความหลายบรรทัด -> โครงสร้าง pages ([[{text, items}]]) แบบเดียวกับที่ textLines คืน */
const toPages = (text) => [text.trim().split("\n").map((ln) => ({ text: ln.trim(), items: ln.trim().split(/\s+/).map((s) => ({ s })) }))];

/* ---- ตัวอย่างจริง BAY (กรุงศรีอยุธยา) — มี "กรุงเทพฯ" ในที่อยู่สำนักงานใหญ่ ---- */
const BAY = `
บริการรับรายการเดินบัญชีทางอีเมล
เลขบัญชีเงินฝาก 170-1-69461-0
ชื่อบัญชี นาย อภิเชษฐ์ จันทร์สำราญ
รอบบัญชีระหว่างวันที่ 19/06/2026 - 19/06/2026
เวลาทำรายการ รายการ ถอน/ฝาก ยอดคงเหลือ ช่องทาง รายละเอียด
19/06/2026 22:28:12 โอนเงิน 144.00 1,278.86 MOBILE SCB PIMPORN KAEWS
บัญชีปลายทาง : X532003
19/06/2026 22:29:19 โอนเงิน 150.00 1,128.86 MOBILE BAY ONANONG
บัญชีปลายทาง : X298361
รายการถอนเงิน 2 รายการ 294.00
รายการฝากเงิน 0 รายการ 0.00
ธนาคารกรุงศรีอยุธยา จำกัด (มหาชน)
สำนักงานใหญ่ 1222 ถนนพระรามที่ 3 แขวงบางโพงพาง เขตยานนาวา กรุงเทพฯ 10120
`;
const bayPages = toPages(BAY);
const bayHead = P.header(bayPages);
eq("BAY: ตรวจธนาคาร = BAY (ไม่ใช่ BBL แม้มี 'กรุงเทพฯ' ในที่อยู่)", bayHead.bank, "BAY");
eq("BAY: อ่านเลขบัญชีจาก 'เลขบัญชีเงินฝาก' (ไม่มี 'ที่')", bayHead.account, "1701694610");

const bayRows = P.parseBAY(bayPages);
P.applyDirection(bayRows, bayHead.bank);
eq("BAY: จำนวนรายการ = 2", bayRows.length, 2);
eq("BAY: รายการแรก ยอด = 144", bayRows[0] && bayRows[0].amount, 144);
eq("BAY: รายการแรก เวลา = 22:28:12 (เก็บวินาที)", bayRows[0] && bayRows[0].sec, 22 * 3600 + 28 * 60 + 12);
ok("BAY: ทั้งสองรายการเป็น withdraw (คำนวณจากยอดคงเหลือ)", bayRows.every((r) => r.direction === "withdraw"), JSON.stringify(bayRows.map((r) => r.direction)));
const witSum = bayRows.filter((r) => r.direction === "withdraw").reduce((s, r) => s + r.amount, 0);
eq("BAY: ยอดถอนรวม = 294", Math.round(witSum * 100) / 100, 294);
eq("BAY: รายการแรก ช่องทาง = MOBILE", bayRows[0] && bayRows[0].channel, "MOBILE");

/* ---- BBL ยังต้องตรวจเจอเมื่อมีชื่อ 'ธนาคารกรุงเทพ' จริง ---- */
const BBL = `
เลขที่บัญชี 123-4-56789-0
ธนาคารกรุงเทพ จำกัด (มหาชน)
`;
eq("BBL: ตรวจเจอเมื่อมี 'ธนาคารกรุงเทพ'", P.header(toPages(BBL)).bank, "BBL");

/* ---- LBK header ---- */
const LBK = `
เลขที่บัญชี 100-2-34567-8
ธนาคารแลนด์ แอนด์ เฮ้าส์ จำกัด (มหาชน)
`;
eq("LBK: ตรวจเจอจากชื่อ 'แลนด์ แอนด์ เฮ้าส์'", P.header(toPages(LBK)).bank, "LBK");

console.log("\nPdfStm unit tests");
console.log(out.join("\n"));
console.log(`\n${passed} ผ่าน, ${failed} ล้มเหลว\n`);
process.exit(failed ? 1 : 0);
