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

/* LINE BK must be identified by the document heading, not a transaction channel. */
const LBK = `
LINE BK Statement
หน้าที่ (PAGE/OF) 12/14
ชื่อบัญชี น.ส. เพ็ญศรี เกิดนิมิตร เลขที่อ้างอิง 26081104446463387474
เลขที่บัญชีเงินฝาก 195-3-16715-4
09-08-26 ยอดยกมา 8,078.04
09-08-26 07:06 โอนเงิน 211.00 7,867.04 LINE BK โอนไป SCB X2448 นาย สุชาติ สัง
09-08-26 09:57 รับโอนเงิน 7,000.00 13,803.04 ต่างธนาคาร จาก BAY X5104 Rungfa
`;
const lbkPages = toPages(LBK);
const lbkHead = P.header(lbkPages);
eq("LBK: ตรวจเจอจากหัวเอกสาร LINE BK", lbkHead.bank, "LBK");
eq("KBANK: ช่องทาง LINE BK ไม่เปลี่ยนธนาคารเจ้าของบัญชี", P.header(toPages(LBK.replace('LINE BK Statement', 'KASIKORNBANK'))).bank, "KBANK");
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

/* Worker รับ pages ที่ Extract PDF คืนมาโดยตรง: statement วันก่อนหน้าทั้งฉบับ
   ต้องเข้าในรอบวันที่รายงาน และยังเก็บ sourceDate ไว้ตรวจย้อนหลัง */
const workerSrc = src.replace(
  "async function parse(fileName, arrayBuffer, businessDate) {\n    const pages = await textLines(arrayBuffer);",
  "async function parse(fileName, pages, businessDate) {",
);
const workerSb = { console };
vm.createContext(workerSb);
vm.runInContext(workerSrc + "\n;globalThis.__P = PdfStm;", workerSb);
const lagged = await workerSb.__P.parse("KB report.pdf", toPages(KPLUS), "2026-08-10");
eq("KBANK reporting lag: อ่านรายการวันก่อนหน้าได้", lagged.records.length, 1);
eq("KBANK reporting lag: จัดเข้าวันที่รายงาน", lagged.records[0] && lagged.records[0].date, "2026-08-10");
eq("KBANK reporting lag: เก็บวันที่ต้นฉบับ", lagged.records[0] && lagged.records[0].sourceDate, "2026-08-09");

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

/* ---- KTB แบบไม่แสดงเวลา (บางบัญชีตามหมายเหตุในทะเบียน) -> โหมด noTime ---- */
const KTB_NT = `
บริษัท ธนาคารกรุงไทย จำกัด มหาชน
เลขที่บัญชี 6640748576 รหัสสาขา 664
30/06/69 เงินโอนเข้า (IORSDT) 014-6444474223 30.00 16,492.01 664
30/06/69 โอนเงินออก (IORSWT) 004-0491469471 127.00 16,365.01 664
`;
const ktbNtPages = toPages(KTB_NT);
const ktbNt = P.parseKtb(ktbNtPages);
P.applyDirection(ktbNt, "KTB");
eq("KTB(noTime): อ่านได้ 2 รายการ (ไม่ถูกตัดเพราะไม่มีเวลา)", ktbNt.length, 2);
eq("KTB(noTime): ตั้ง noTime = true", ktbNt[0] && ktbNt[0].noTime, true);
eq("KTB(noTime): sec = 0", ktbNt[0] && ktbNt[0].sec, 0);
eq("KTB(noTime): รายการแรก = deposit ยอด 30", ktbNt[0] && ktbNt[0].direction + ":" + ktbNt[0].amount, "deposit:30");
eq("KTB(noTime): รายการสอง = withdraw ยอด 127", ktbNt[1] && ktbNt[1].direction + ":" + ktbNt[1].amount, "withdraw:127");

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

const scbText = `SIAM COMMERCIAL BANK\nAccount No. 1234567890\n04/09/26 10:00 X1 ENET 100.00 1,100.00\n04/09/26 10:01 X2 ENET 50.00 1,050.00`;
const completeScb = await P.parseText("3XB_STM_SCB.pdf", scbText, "2026-09-04");
eq("SCB text: อ่านครบ 2 รายการ", completeScb.records.length, 2);
eq("SCB text: quality ผ่าน", completeScb.quality.complete, true);
const wrappedScb = await P.parseText("SCB.pdf", scbText.replace("100.00 1,100.00", "100.00\n1,100.00"), "2026-09-04");
eq("SCB wrapped: ต่อคอลัมน์ที่ตัดบรรทัด", wrappedScb.records.length, 2);
eq("SCB wrapped: ยอดไม่เปลี่ยน", wrappedScb.records[0].amount, 100);
const partialScb = await P.parseText("SCB.pdf", scbText + "\n04/09/26 10:02 X2 ENET unreadable", "2026-09-04");
eq("partial: อ่านได้ 2 แถวแต่ห้ามผ่านเป็นไฟล์ครบ", partialScb.quality.complete, false);
eq("partial: เก็บบรรทัดที่อ่านไม่ได้", partialScb.quality.unreadRows.length, 1);
const multiPage = await P.parseText("SCB.pdf", scbText + "\fSIAM COMMERCIAL BANK\n04/09/26 10:02 unreadable", "2026-09-04");
eq("multi-page: เก็บจำนวนหน้า", multiPage.pageCount, 2);
eq("multi-page: ระบุหน้าที่มีปัญหา", multiPage.quality.unreadRows[0].page, 2);
const kbNative = await P.parseText("KB.pdf", "KASIKORN BANK\nAccount No. 1234567890\n04-09-2026 10:00 K PLUS1,100.00 จากบัญชี ++รับโอนเงิน 100.00", "2026-09-04");
eq("KB native: รองรับปี 4 หลักและยอดสลับตำแหน่ง", kbNative.records.length, 1);
eq("KB native: แยกยอดจากยอดคงเหลือ", kbNative.records[0]?.amount, 100);
eq("KB native: ยอดคงเหลือ", kbNative.records[0]?.balance, 1100);
const unknownDirection = await P.parseText("unknown.pdf", "Account No. 1234567890\n04/09/26 10:00 UNKNOWN 100.00 1,100.00", "2026-09-04");
eq("unknown direction: ไม่เดาเป็นฝาก", unknownDirection.records.length, 0);
eq("unknown direction: ไม่ผ่าน quality", unknownDirection.quality.complete, false);

const kbWrapped = await P.parseText("KB.pdf", "KASIKORN BANK\n123-4-56789-0\n01/09/2026 - 04/09/2026\nเลขที่บัญชีเงินฝาก\n04-09-26 10:00 Internet/Mobile KTB1,134.00 จาก TEST+\n+\nรับโอนเงิน 134.00", "2026-09-04");
eq("KB cloud: four-part account", kbWrapped.header.account, "1234567890");
eq("KB cloud: period is not a transaction", kbWrapped.quality.complete, true);
eq("KB cloud: split plus marker preserves row", kbWrapped.records.length, 1);
eq("KB cloud: amount not balance", kbWrapped.records[0]?.amount, 134);
eq("KB cloud: balance preserved", kbWrapped.records[0]?.balance, 1134);

const bblOpening = await P.parseText("BBL.pdf", "BANGKOK BANK\nAccount No. 1234567890\n01/09/26 B/F 494.95\n02/09/26 TRF FR OTH BK 70.00 564.95 mPhone", "2026-09-02");
eq("BBL B/F: opening balance is not an unread transaction", bblOpening.quality.complete, true);
eq("BBL B/F: preserve actual transaction", bblOpening.records.length, 1);
eq("BBL B/F: preserve deposit amount", bblOpening.records[0]?.amount, 70);
const bblBroken = await P.parseText("BBL.pdf", "BANGKOK BANK\n01/09/26 B/F unreadable", "2026-09-01");
eq("BBL B/F: unreadable balance is not silently accepted", bblBroken.quality.complete, false);
const outOfPeriod = await P.parseText("SCB.pdf", scbText, "2026-09-02");
ok("out-of-period: explain date mismatch, not an image-scan failure", outOfPeriod.warnings.some(w => w.includes("ไม่มีรายการวันที่ 2026-09-02")));
ok("out-of-period: not a missing file or automatic zero-activity approval", outOfPeriod.warnings.some(w => w.includes("ไม่ใช่ไฟล์ขาด") && w.includes("BO แยกฝากและถอน")));
eq("out-of-period: does not invent transactions", outOfPeriod.records.length, 0);

const kbFeeText = "KASIKORN BANK\nAccount No. 1234567890\n01-09-26 619.01ยอดยกมา\n03-09-26 02:55 ATM369.01 รหัสอ้างอิง ATM99001ค่าธรรมเนียมรายปีบัตรเดบิต 250.00";
const kbFee = await P.parseText("KB.pdf", kbFeeText, "2026-09-03");
eq("KB annual fee: native quality complete", kbFee.quality.complete, true);
eq("KB annual fee: one transaction", kbFee.records.length, 1);
eq("KB annual fee: preserve transaction date", kbFee.records[0]?.sourceDate, "2026-09-03");
eq("KB annual fee: amount not balance", kbFee.records[0]?.amount, 250);
eq("KB annual fee: balance preserved", kbFee.records[0]?.balance, 369.01);
eq("KB annual fee: withdrawal not deposit", kbFee.records[0]?.direction, "withdraw");
const kbFeeBroken = await P.parseText("KB.pdf", kbFeeText.replace("250.00", "unreadable"), "2026-09-03");
eq("KB annual fee: missing amount must fail quality", kbFeeBroken.quality.complete, false);

console.log("\nPdfStm unit tests");
console.log(out.join("\n"));
console.log(`\n${passed} ผ่าน, ${failed} ล้มเหลว\n`);
process.exit(failed ? 1 : 0);
