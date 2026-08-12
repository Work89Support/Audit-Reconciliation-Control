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

/* ---- KTB (กรุงไทย): วันที่/เวลาแยกบรรทัด + ปี พ.ศ. ย่อ ---- */
const KTB = `
รายการเดินบัญชี
ชื่อบัญชี นาย นราธิป ขุนอาจ ประเภทบัญชี ออมทรัพย์
เลขที่บัญชี 6060748201 รหัสสาขา 606
บริษัท ธนาคารกรุงไทย จำกัด มหาชน
29/06/69 เงินโอนเข้า (IORSDT) 014-6444474223 30.00 16,492.01 606
22:55
30/06/69 โอนเงินออก (IORSWT) 004-0491469471 127.00 3,155.08 606
06:00
รายการถอนทั้งหมด 1690 1,342,936.60
`;
const ktbPages = toPages(KTB);
const ktbHead = P.header(ktbPages);
eq("KTB: ตรวจธนาคาร = KTB", ktbHead.bank, "KTB");
eq("KTB: อ่านเลขบัญชี = 6060748201", ktbHead.account, "6060748201");
eq("KTB: isoOf ปี พ.ศ. ย่อ '30/06/69' -> 2026-06-30", P.isoOf("30/06/69"), "2026-06-30");
const ktbRows = P.parseKtb(ktbPages);
P.applyDirection(ktbRows, ktbHead.bank);
eq("KTB: อ่านได้ 2 รายการ (ข้ามบรรทัดสรุปท้าย)", ktbRows.length, 2);
eq("KTB: รายการแรก วันที่ = 2026-06-29", ktbRows[0] && ktbRows[0].date, "2026-06-29");
eq("KTB: รายการแรก ยอด = 30", ktbRows[0] && ktbRows[0].amount, 30);
eq("KTB: รายการแรก เวลา (จากบรรทัดถัดไป) = 22:55", ktbRows[0] && ktbRows[0].sec, 22 * 3600 + 55 * 60);
eq("KTB: รายการแรก 'เงินโอนเข้า' = deposit", ktbRows[0] && ktbRows[0].direction, "deposit");
eq("KTB: รายการสอง 'โอนเงินออก' = withdraw", ktbRows[1] && ktbRows[1].direction, "withdraw");
eq("KTB: รายการสอง ยอด = 127", ktbRows[1] && ktbRows[1].amount, 127);

/* ---- BBL (กรุงเทพ): ไม่มีคอลัมน์เวลา -> noTime, ปี ค.ศ. ย่อ ---- */
const BBL2 = `
STATEMENT OF SAVING ACCOUNT
ธนาคารกรุงเทพ จำกัด (มหาชน)
ชื่อ/Name นาย นรวร ผาสุข เลขที่บัญชี/Account No. 651-7-24804-0
10/06/26 TRF FR OTH BK 14.00 1,313.58 mPhone
10/06/26 TRF TO OTH BK 500.00 1,278.58 mPhone
จำนวนรายการถอน/Total No. of Debits 28 จำนวนเงินถอน 24,475.00
`;
const bblPages = toPages(BBL2);
const bblHead = P.header(bblPages);
eq("BBL: ตรวจธนาคาร = BBL", bblHead.bank, "BBL");
eq("BBL: อ่านเลขบัญชีจาก 'Account No.' = 6517248040", bblHead.account, "6517248040");
eq("BBL: isoOf ปี ค.ศ. ย่อ '10/06/26' -> 2026-06-10", P.isoOf("10/06/26"), "2026-06-10");
const bblRows = P.parseBbl(bblPages);
P.applyDirection(bblRows, bblHead.bank);
eq("BBL: อ่านได้ 2 รายการ (ข้ามหัว/สรุป)", bblRows.length, 2);
eq("BBL: ตั้ง noTime = true", bblRows[0] && bblRows[0].noTime, true);
eq("BBL: sec = 0 (ไม่มีเวลา)", bblRows[0] && bblRows[0].sec, 0);
eq("BBL: 'TRF FR' = deposit", bblRows[0] && bblRows[0].direction, "deposit");
eq("BBL: 'TRF FR' ยอด = 14", bblRows[0] && bblRows[0].amount, 14);
eq("BBL: 'TRF TO' = withdraw", bblRows[1] && bblRows[1].direction, "withdraw");
eq("BBL: 'TRF TO' ยอด = 500", bblRows[1] && bblRows[1].amount, 500);

console.log("\nPdfStm unit tests");
console.log(out.join("\n"));
console.log(`\n${passed} ผ่าน, ${failed} ล้มเหลว\n`);
process.exit(failed ? 1 : 0);
