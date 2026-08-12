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

/* ---- LBK = LINE BK : สเตทเมนต์ฟอร์แมตเดียวกับกสิกร (เคลียริงเดียวกัน) ต้องแท็กเป็น LBK ----
   ตรวจ "LINE BK" ในคอลัมน์ช่องทาง แล้วส่งเข้า parser กสิกร (parseKbank) */
const LBK = `
หน้าที่ (PAGE/OF) 12/14
ชื่อบัญชี น.ส. เพ็ญศรี เกิดนิมิตร เลขที่อ้างอิง 26081104446463387474
เลขที่บัญชีเงินฝาก 195-3-16715-4
09-08-26 ยอดยกมา 8,078.04
09-08-26 07:06 โอนเงิน 211.00 7,867.04 LINE BK โอนไป SCB X2448 นาย สุชาติ สัง
09-08-26 09:57 รับโอนเงิน 7,000.00 13,803.04 ต่างธนาคาร จาก BAY X5104 Rungfa
`;
const lbkPages = toPages(LBK);
const lbkHead = P.header(lbkPages);
eq("LBK: ตรวจเจอจากช่องทาง 'LINE BK' (ก่อน KBANK แม้มี 'เลขที่บัญชีเงินฝาก')", lbkHead.bank, "LBK");
eq("LBK: อ่านเลขบัญชีจาก 'เลขที่บัญชีเงินฝาก'", lbkHead.account, "1953167154");
const lbkRows = P.parseKbank(lbkPages);
P.applyDirection(lbkRows, lbkHead.bank);
eq("LBK: parseKbank อ่านได้ 2 รายการ (ข้าม 'ยอดยกมา')", lbkRows.length, 2);
eq("LBK: รายการแรก ยอด = 211", lbkRows[0] && lbkRows[0].amount, 211);
eq("LBK: รายการแรก เป็น withdraw", lbkRows[0] && lbkRows[0].direction, "withdraw");
eq("LBK: รายการสอง ยอด = 7000", lbkRows[1] && lbkRows[1].amount, 7000);
eq("LBK: รายการสอง เป็น deposit (รับโอนเงิน)", lbkRows[1] && lbkRows[1].direction, "deposit");

/* ---- KBANK ปกติ (K PLUS) ที่ไม่มี "LINE BK" ต้องยังเป็น KBANK ไม่ใช่ LBK ---- */
const KPLUS = `
เลขที่บัญชีเงินฝาก 123-4-56789-0
09-08-26 07:06 โอนเงิน 50.00 1,000.00 K PLUS โอนไป SCB X1
`;
eq("KBANK: ไม่มี 'LINE BK' ยังตรวจเป็น KBANK", P.header(toPages(KPLUS)).bank, "KBANK");

/* ---- BAY edge: ยอดจำนวนเต็ม + มีเลขทศนิยมในรายละเอียด (ต้องไม่แย่งคอลัมน์ยอด) ---- */
const BAY_EDGE = `
19/06/2026 22:28:12 ค่าโอน 5.50 โอนเงิน 144 1278 MOBILE SCB PIMPORN
`;
const be = P.parseBAY(toPages(BAY_EDGE));
eq("BAY edge: อ่านได้ 1 รายการ", be.length, 1);
eq("BAY edge: ยอด = 144 (จำนวนเต็ม ไม่โดนเลข 5.50 ในรายละเอียดแย่ง)", be[0] && be[0].amount, 144);
eq("BAY edge: ยอดคงเหลือ = 1278", be[0] && be[0].balance, 1278);

console.log("\nPdfStm unit tests");
console.log(out.join("\n"));
console.log(`\n${passed} ผ่าน, ${failed} ล้มเหลว\n`);
process.exit(failed ? 1 : 0);
