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

/* Counterparty bank names in body rows must not replace the statement owner. */
const KBANK_WITH_COUNTERPARTIES = `
ธนาคารกสิกรไทย
เลขที่บัญชีเงินฝาก 195-3-58330-1
ชื่อบัญชี นาย กิตติ ปานแสงทอง
27/09/2026 01:51 รับโอนเงิน 50.00 1000.00 K PLUS จาก KTB จ.ส.อ.เอกพล
27/09/2026 02:42 รับโอนเงิน 66.00 1066.00 K PLUS จาก SCB ลูกค้า
`;
const kbankOwner = P.header(toPages(KBANK_WITH_COUNTERPARTIES));
eq("KBANK: ธนาคารคู่โอน KTB/SCB ไม่สร้างบัญชีเจ้าของปลอม", kbankOwner.bank, "KBANK");
eq("KBANK: ยึดเลขบัญชีเจ้าของ 1953583301", kbankOwner.account, "1953583301");

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

const TMN_FUNDOUT = `
ใบแสดงรายการ / Statement of Account
เงินเข้า เงินออก ยอดคงเหลือ
20/09/2026 17:50:23 เงินออก -7,000.00 promptpay_bay_fundout 39,082.75 32,082.75
`;
const tmnFundout = await P.parseText("UFABET7M_STM_TMN_รุ่งฟ้า_W.pdf", TMN_FUNDOUT, "2026-09-20");
eq("TMN fundout: เก็บขาโยกเงินไว้จับคู่", tmnFundout.records.length, 1);
eq("TMN fundout: ระบุ internalTransferHint", tmnFundout.records[0]?.internalTransferHint, true);
eq("TMN fundout: ยังเป็นรายการถอน", tmnFundout.records[0]?.direction, "withdraw");

const TMN_NON_CUSTOMER_ROWS = `
ใบแสดงรายการ / Statement of Account
เงินเข้า เงินออก ยอดคงเหลือ
20/09/2026 12:00:00 เงินออก -0.29 p2p receive fee 100.29 100.00
20/09/2026 12:01:00 เงินออก -0.01 ยอดคงเหลือ 100.00 99.99
20/09/2026 12:02:00 เงินออก -100.00 0891234567 99.99 0.00
`;
const tmnNonCustomer = await P.parseText("UFABET7M_STM_TMN_รุ่งฟ้า_W.pdf", TMN_NON_CUSTOMER_ROWS, "2026-09-20");
eq("TMN non-customer: ตัด fee และยอดประกอบ ไม่สร้างเคสเทียม", tmnNonCustomer.records.length, 1);
eq("TMN non-customer: คงรายการลูกค้าจริง", tmnNonCustomer.records[0]?.amount, 100);

// รูปแบบที่ n8n Extract PDF คืนมาจริงอาจไม่มีหัวคอลัมน์ TMN แต่ชื่อไฟล์ยัง
// ระบุ STM_TMN ชัดเจน ต้องใช้ parser ของ TMN เพื่อไม่ให้นับ fee_p2p_receive.
const TMN_NO_HEADING = `
20/09/2026 12:00:00 เงินออก -0.29 fee_p2p_receive 100.29 100.00
20/09/2026 12:02:00 เงินออก -100.00 SCB 0891234567 100.00 0.00
`;
const tmnNoHeading = await P.parseText("UFABET7M_STM_TMN_รุ่งฟ้า_DW_2026-09-20.pdf", TMN_NO_HEADING, "2026-09-20");
eq("TMN filename fallback: ตัด fee เมื่อ n8n ทำหัวคอลัมน์หาย", tmnNoHeading.records.length, 1);
eq("TMN filename fallback: คงยอดลูกค้าจริง", tmnNoHeading.records[0]?.amount, 100);
const staleTmnOcr = P.parseStructuredOcr(
  "UFABET7M_STM_TMN_รุ่งฟ้า_DW_2026-09-20.pdf",
  { rows: [{ date: "2026-09-20", sec: 43200, direction: "withdraw", amount: 0.29, balance: 100 }] },
  TMN_NO_HEADING,
  "2026-09-20",
);
eq("TMN structured OCR: ไม่ใช้แถวเก่าที่ทำข้อมูล fee หาย", staleTmnOcr, null);

const TMN_N8N_LAYOUT = `
20/09/2026 01:34:31 เงิน เข้า -2.67 fee_p2p_receive 2,354.53 2,351.86 20/09/2026 01:35:00 เงิน ออก -100.00 0891234567 2,351.86 2,251.86
`;
const tmnN8nLayout = await P.parseText("UFABET7M_STM_TMN_รุ่งฟ้า_W.pdf", TMN_N8N_LAYOUT, "2026-09-20");
eq("TMN n8n layout: อ่านหลายแถวที่ถูก flatten", tmnN8nLayout.quality.parsedRows, 2);
eq("TMN n8n layout: ตัด fee หลัง normalize ช่องว่างภาษาไทย", tmnN8nLayout.records.length, 1);
eq("TMN n8n layout: คงยอดลูกค้าจริง", tmnN8nLayout.records[0]?.amount, 100);

const TMN_COLUMN_LAYOUT = `
ใบแสดงรายการ
Statement of Account
ชื่อบัญชี
(Account Name)
คุณทดสอบ ระบบ
วันที่
ประเภท
20/09/2026 10:00:00
เงินเข้า
20/09/2026 10:00:01
เงินออก
20/09/2026 10:05:00
เงินออก
20/09/2026 10:10:00
เงินเข้า
เลขที่บัญชี
(Account no)
0812792075
รายละเอียด
100.00 0611934999
-2.90
fee_p2p_receive
-7,000.00
promptpay_bay_fundout
50.00 0628298580
8,000.00
8,100.00
8,100.00
8,097.10
8,097.10
1,097.10
1,097.10
1,147.10
ยอดคงเหลือ
`;
const tmnColumnLayout = await P.parseText("UFABET7M_STM_TMN_รุ่งฟ้า_W.pdf", TMN_COLUMN_LAYOUT, "2026-09-20");
eq("TMN column layout: อ่านเลขบัญชีที่แยกบรรทัด", tmnColumnLayout.header.account, "0812792075");
eq("TMN column layout: ยืนยันครบทุกแถวก่อนกรอง", tmnColumnLayout.quality.parsedRows, 4);
eq("TMN column layout: ตัด fee แต่คงรายการลูกค้า", tmnColumnLayout.records.length, 3);
eq("TMN column layout: คง fundout ไว้จับขาโยกเงิน", tmnColumnLayout.records[1]?.internalTransferHint, true);
eq("TMN column layout: ยอด fundout มาจากผลต่าง balance", tmnColumnLayout.records[1]?.amount, 7000);

const TMN_UNREADABLE = `
20/09/2026 01:35:00 เงินออก 100.00 ข้อมูลไม่ครบ
`;
const tmnUnreadable = await P.parseText("UFABET7M_STM_TMN_รุ่งฟ้า_W.pdf", TMN_UNREADABLE, "2026-09-20");
eq("TMN safety: ไม่ fallback ไปอ่านยอดผิดด้วย generic parser", tmnUnreadable.records.length, 0);

const TMN_WALLET_SCREENSHOT = `
03:05
รายการ
รับเงินจาก บิเด็น อ***
01:32
ค่าธรรมเนียมการรับเงินโอน
01:13
แชร์รายการ
+฿ 134.00
-฿ 0.87
รับเงินจาก สกนธ์ เ***
+฿ 30.00
01:13
ค่าธรรมเนียมการรับเงินโอน
-฿ 1.28
01:09
รับเงินจาก สมพร แ***
+฿ 44.00
01:09
ค่าธรรมเนียมการรับเงินโอน
00:30
รับเงินจาก บิเด็น อ***
00:30
ค่าธรรมเนียมการรับเงินโอน
00:09
-฿ 4.64
+฿ 160.00
-฿ 1.45
รับเงินจาก สมพร แ***
+฿ 50.00
00:09
23 กันยายน 2569
`;
const tmnWalletScreenshot = await P.parseText("UFABET7M_STM_TMN_รุ่งฟ้า_DW_2026-09-24.docx", TMN_WALLET_SCREENSHOT, "2026-09-23");
eq("TMN screenshot: อ่านรายการลูกค้าและตัด fee", tmnWalletScreenshot.records.length, 5);
eq("TMN screenshot: แปลงวันที่ พ.ศ.", tmnWalletScreenshot.records[0]?.sourceDate, "2026-09-23");
eq("TMN screenshot: จับเวลาแถวแรก", tmnWalletScreenshot.records[0]?.sec, 1 * 3600 + 32 * 60);
eq("TMN screenshot: จับยอดจากเครื่องหมายบวก", tmnWalletScreenshot.records[0]?.amount, 134);
eq("TMN screenshot: คงยอดช่วงท้ายภาพ", tmnWalletScreenshot.records[3]?.amount, 160);

const TMN_WALLET_OCR_PAGES = `
รายการ
รับเงินจาก คนแรก ก***
22:03.
+B 120.00
-B 1.20
ค่าธรรมเนียมการรับเงินโอน
23 กันยายน 2569
\f
รายการ
รับเงินจาก คนสอง ข*** 15:21
+B 90.00
-B 0.90
ค่าธรรมเนียมการรับเงินโอน
รับเงินจาก แถวภาพตัด ค***
\f
รายการ
รับเงินจาก คนสาม ง***
09:05
+B 50.00
24 กันยายน 2569
`;
const tmnWalletOcrPages = await P.parseText("UFABET7M_STM_TMN_รุ่งฟ้า_DW_2026-09-24.docx", TMN_WALLET_OCR_PAGES);
eq("TMN OCR: รับสัญลักษณ์ B และข้ามเศษค่าธรรมเนียม", tmnWalletOcrPages.records.length, 3);
eq("TMN OCR: วันที่หัวท้ายภาพแรก", tmnWalletOcrPages.records[0]?.sourceDate, "2026-09-23");
eq("TMN OCR: หน้าต่อเนื่องคงวันที่ล่าสุดที่พบ", tmnWalletOcrPages.records[1]?.sourceDate, "2026-09-23");
eq("TMN OCR: อ่านเวลาในบรรทัดรายการ", tmnWalletOcrPages.records[1]?.sec, 15 * 3600 + 21 * 60);
eq("TMN OCR: ไม่สร้างรายการจากแถวภาพตัดที่ยอดไม่ครบ", tmnWalletOcrPages.records.some((row) => /แถวภาพตัด/.test(row.desc)), false);
const tmnWalletOcrBusinessDate = await P.parseText("UFABET7M_STM_TMN_รุ่งฟ้า_DW_2026-09-24.docx", TMN_WALLET_OCR_PAGES, "2026-09-24");
eq("TMN OCR: รอบวันที่ 24 มีรายการปกติหนึ่งรายการ", tmnWalletOcrBusinessDate.records.filter((row) => !row.ocrDateCandidateOnly).length, 1);
eq("TMN OCR: วันที่ 23 ถูกเก็บเป็น candidate เท่านั้น", tmnWalletOcrBusinessDate.records.filter((row) => row.ocrDateCandidateOnly).length, 2);

const TMN_WALLET_INITIAL_UNDATED_PAGE = `
รายการ
รับเงินจาก หน้าแรก ก***
08:15
+B 75.00
\f
รายการ
รับเงินจาก หน้าสอง ข***
09:20
+B 80.00
24 กันยายน 2569
`;
const tmnWalletInitialUndatedPage = await P.parseText("UFABET7M_STM_TMN_สรวิศา_DW_2026-09-24.docx", TMN_WALLET_INITIAL_UNDATED_PAGE, "2026-09-24");
eq("TMN OCR: เติมวันที่ให้เฉพาะหน้าต้นที่ยังไม่มีหัววันที่", tmnWalletInitialUndatedPage.records.length, 2);
eq("TMN OCR: หน้าต้นใช้วันที่แรกที่พิสูจน์ได้", tmnWalletInitialUndatedPage.records[0]?.sourceDate, "2026-09-24");

const TMN_WALLET_FLATTENED_DATES = `
รายการ
รับเงินจาก วันที่ยี่สิบสาม ก***
23:55
+B 20.00
23 กันยายน 2569
รายการ
รับเงินจาก วันที่ยี่สิบสี่ ข***
00:05
+B 30.00
รับเงินจาก วันที่ยี่สิบสี่ ค*** 01:04
+B 40.00
24 กันยายน 2569
เมื่อวานนี้
รับเงินจาก ช่วงก่อนหน้า ง***
23:53
+B 10.00
`;
const tmnWalletFlattenedDates = await P.parseText("UFABET7M_STM_TMN_สรวิศา_DW_2026-09-24.docx", TMN_WALLET_FLATTENED_DATES, "2026-09-24");
eq("TMN OCR: แบ่งหลายวันที่อยู่ใน OCR ก้อนเดียว", tmnWalletFlattenedDates.records.filter((row) => !row.ocrDateCandidateOnly).length, 2);
eq("TMN OCR: รายการหลังหัววันก่อนหน้าใช้หัววันที่ถัดไป", tmnWalletFlattenedDates.records.find((row) => !row.ocrDateCandidateOnly)?.sourceDate, "2026-09-24");
eq("TMN OCR: ช่วงเมื่อวานเป็น candidate ไม่ใช่รายการจริง", tmnWalletFlattenedDates.records.find((row) => row.amount === 10)?.ocrDateCandidateOnly, true);

const TMN_OCR_IMAGE_BOUNDARY = TMN_WALLET_INITIAL_UNDATED_PAGE.replace("\f", "\n---OCR_IMAGE---\n");
eq("TMN OCR: marker ระหว่างภาพจาก n8n เป็นขอบหน้า", P.pagesFromText(TMN_OCR_IMAGE_BOUNDARY).length, 2);

const TMN_WALLET_COLUMN_GROUPED = `
รายการ
รับเงินจาก คนแรก ก***
รับเงินจาก คนสอง ข***
รับเงินจาก คนสาม ค***
+B 1,000.00
+B 74.00
+B 53.00
14:09
14:28
14:21
28 กันยายน 2569
`;
const tmnWalletColumnGrouped = await P.parseText("UFABET7M_STM_TMN_สรวิศา_DW_2026-09-28.docx", TMN_WALLET_COLUMN_GROUPED, "2026-09-28");
eq("TMN OCR column group: คงยอดตามลำดับแถว ไม่ย้อนใส่คนท้าย", tmnWalletColumnGrouped.records.map((row) => row.amount).join(","), "1000,74,53");
eq("TMN OCR column group: คงเวลาตามลำดับแถว", tmnWalletColumnGrouped.records.map((row) => row.sec).join(","), `${14 * 3600 + 9 * 60},${14 * 3600 + 28 * 60},${14 * 3600 + 21 * 60}`);

const TMN_WALLET_WITHDRAW_COLUMN_GROUPED = `
รายการ
โอนเงินให้ คนถอนหนึ่ง ก***
โอนเงินให้ คนถอนสอง ข***
โอนเงินให้ คนถอนสาม ค***
-B 2,030.00
-B 300.00
-B 100.00
01:42
07:52
08:42
28 กันยายน 2569
`;
const tmnWalletWithdrawColumnGrouped = await P.parseText("UFABET7M_STM_TMN_สรวิศา_DW_2026-09-28.docx", TMN_WALLET_WITHDRAW_COLUMN_GROUPED, "2026-09-28");
eq("TMN OCR withdraw column group: อ่านรายการถอนครบ 3 ยอด", tmnWalletWithdrawColumnGrouped.records.length, 3);
eq("TMN OCR withdraw column group: คงยอดถอนตามแถว", tmnWalletWithdrawColumnGrouped.records.map((row) => row.amount).join(","), "2030,300,100");
eq("TMN OCR withdraw column group: ระบุทิศทางถอนครบ", tmnWalletWithdrawColumnGrouped.records.every((row) => row.direction === "withdraw"), true);

const TMN_WALLET_DATE_AT_TOP = `
รายการ
28 กันยายน 2569
รับเงินจาก คนหนึ่ง ก***
+B 280.41
02:03
รับเงินจาก คนสอง ข***
+B 10.00
07:53
`;
const tmnWalletDateAtTop = await P.parseText("UFABET7M_STM_TMN_รุ่งฟ้า_D_2026-09-28.docx", TMN_WALLET_DATE_AT_TOP, "2026-09-28");
eq("TMN OCR date at top: อ่านรายการหลังหัววันที่ครบ", tmnWalletDateAtTop.records.length, 2);
eq("TMN OCR date at top: คงทศนิยม 280.41", tmnWalletDateAtTop.records[0]?.amount, 280.41);
eq("TMN OCR date at top: เก็บ provenance ของภาพ", tmnWalletDateAtTop.records.every((row) => row.ocrWalletScreenshot), true);

const TMN_WALLET_CONTINUATION_NO_HEADER = `
โอนเงินให้ คนถอนหนึ่ง ก***
-B 100.00
08:42
โอนเงินให้ คนถอนสอง ข***
-B 300.00
07:52
`;
const tmnWalletContinuation = await P.parseText("UFABET7M_STM_TMN_สรวิศา_W_2026-09-28.docx", TMN_WALLET_CONTINUATION_NO_HEADER, "2026-09-28");
eq("TMN OCR continuation: ไม่มีคำว่ารายการก็อ่านแถวที่มีหลักฐานครบ", tmnWalletContinuation.records.length, 2);
eq("TMN OCR continuation: คงทิศทางถอน", tmnWalletContinuation.records.every((row) => row.direction === "withdraw"), true);

/* ---- KBANK ปกติ (K PLUS) ที่ไม่มี "LINE BK" ต้องยังเป็น KBANK ไม่ใช่ LBK ---- */
const KPLUS = `
เลขที่บัญชีเงินฝาก 123-4-56789-0
09-08-26 07:06 โอนเงิน 50.00 1,000.00 K PLUS โอนไป SCB X1
`;
eq("KBANK: ไม่มี 'LINE BK' ยังตรวจเป็น KBANK", P.header(toPages(KPLUS)).bank, "KBANK");

const KBANK_SLASH_DIRECTION = `
KASIKORNBANK
เลขที่บัญชีเงินฝาก 195-3-58330-1
20/09/26 17:50 รับโอนจาก 7,000.00 10,000.00 K PLUS TMN รุ่งฟ้า
20/09/26 18:00 โอนไป 500.00 9,500.00 K PLUS SCB X1234
`;
const kbankSlashDirection = await P.parseText("UFABET7M_STM_KB_กิตติ_DW.pdf", KBANK_SLASH_DIRECTION, "2026-09-20");
eq("KBANK slash date: อ่านรายการรูปแบบ / ได้ครบ", kbankSlashDirection.records.length, 2);
eq("KBANK description: รับโอนจาก = ฝาก", kbankSlashDirection.records[0]?.direction, "deposit");
eq("KBANK description: โอนไป = ถอน", kbankSlashDirection.records[1]?.direction, "withdraw");

/* n8n native extraction: KBANK SMS fee puts balance before description and
   the real debit amount on the following line. */
const KBANK_SMS_FEE = `
ชื่อบัญชี น.ส. ปาหนัน สุขใจ
เลขที่บัญชีเงินฝาก 196-8-76505-8
รอบระหว่างวันที่ 01/09/2026 - 16/09/2026
16-09-26 18:49 โอนเข้า/หักบัญชีอัตโนมัติ480.61 ค่าธรรมเนียมบริการ SMS ALERT*ค่าธรรมเนียม SMS ขยันบอก /
อื่น ๆ
20.00
`;
const kbankSmsFee = await P.parseText("SK8_STM_KB_ปาหนัน_DW_2026-09-16.pdf", KBANK_SMS_FEE, "2026-09-16");
eq("KBANK SMS fee: อ่านรายการที่ n8n แยกยอดไว้ท้ายบรรทัดได้", kbankSmsFee.records.length, 1);
eq("KBANK SMS fee: ยอดรายการ = 20 ไม่ใช่ยอดคงเหลือ", kbankSmsFee.records[0]?.amount, 20);
eq("KBANK SMS fee: ยอดคงเหลือ = 480.61", kbankSmsFee.records[0]?.balance, 480.61);
eq("KBANK SMS fee: เป็นรายการถอน", kbankSmsFee.records[0]?.direction, "withdraw");
eq("KBANK SMS fee: ผ่าน quality gate", kbankSmsFee.quality.complete, true);

/* Google Drive OCR may flatten the opening balance and the SMS-fee row. */
const KBANK_SMS_FEE_FLAT = `
ชื่อบัญชี น.ส. ปาหนัน สุขใจ เลขที่บัญชีเงินฝาก 196-8-76505-8
01-09-26 16-09-26 18:49 ยอดยกมา ค่าธรรมเนียม SMS ขยันบอก / อื่น ๆ 20.00 500.61 480.61 โอนเข้า/หักบัญชีอัตโนมัติ ค่าธรรมเนียมบริการ SMS ALERT*
`;
const kbankSmsFeeFlat = await P.parseText("SK8_STM_KB_ปาหนัน_DW_2026-09-16.pdf", KBANK_SMS_FEE_FLAT, "2026-09-16");
eq("KBANK SMS fee flat: ไม่ใช้วันยอดยกมาเป็นวันรายการ", kbankSmsFeeFlat.records[0]?.sourceDate, "2026-09-16");
eq("KBANK SMS fee flat: ยอดรายการถูกต้อง", kbankSmsFeeFlat.records[0]?.amount, 20);
eq("KBANK SMS fee flat: ยอดคงเหลือถูกต้อง", kbankSmsFeeFlat.records[0]?.balance, 480.61);
eq("KBANK SMS fee flat: ผ่าน quality gate", kbankSmsFeeFlat.quality.complete, true);

const KBANK_SMS_FEE_OCR_LINES = `
ชื่อบัญชี น.ส. ปาหนัน สุขใจ
เลขที่บัญชีเงินฝาก 196-8-76505-8
01-09-26 16-09-26
18:49
ยอดยกมา
ค่าธรรมเนียม SMS ขยันบอก / อื่น ๆ
20.00
500.61
480.61 โอนเข้า/หักบัญชีอัตโนมัติ
ค่าธรรมเนียมบริการ SMS ALERT*
`;
const kbankSmsFeeOcrLines = await P.parseText("SK8_STM_KB_ปาหนัน_DW_2026-09-16.pdf", KBANK_SMS_FEE_OCR_LINES, "2026-09-16");
eq("KBANK SMS fee OCR lines: รวมยอดคงเหลือบรรทัดถัดไป", kbankSmsFeeOcrLines.records.length, 1);
eq("KBANK SMS fee OCR lines: วันที่ธุรกรรมถูกต้อง", kbankSmsFeeOcrLines.records[0]?.sourceDate, "2026-09-16");
eq("KBANK SMS fee OCR lines: ยอดรายการถูกต้อง", kbankSmsFeeOcrLines.records[0]?.amount, 20);
eq("KBANK SMS fee OCR lines: ยอดคงเหลือถูกต้อง", kbankSmsFeeOcrLines.records[0]?.balance, 480.61);
eq("KBANK SMS fee OCR lines: ผ่าน quality gate", kbankSmsFeeOcrLines.quality.complete, true);

const KBANK_LEADING_BALANCE_DATE = `
เลขที่บัญชีเงินฝาก 196-8-76505-8
01-09-26 สรุป 16-09-26 18:49 ถอนเงิน 20.00 480.61
`;
const kbankLeadingDate = await P.parseText("SK8_STM_KB_ปาหนัน_DW_2026-09-16.pdf", KBANK_LEADING_BALANCE_DATE, "2026-09-16");
eq("KBANK flattened: ใช้วันธุรกรรมที่มีเวลากำกับ", kbankLeadingDate.records[0]?.sourceDate, "2026-09-16");
eq("KBANK flattened: ไม่ใช้วันยอดยกมา", kbankLeadingDate.records.length, 1);

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

const SCB_PREVIOUS_DAY_ONLY = `
ธนาคารไทยพาณิชย์ SIAM COMMERCIAL BANK
เลขที่บัญชี 4311918665
30/09/26 23:50 X1 ENET 50.00 4,336.73
30/09/26 23:52 X1 ENET 100.00 4,436.73
`;
const scbPreviousDay = await workerSb.__P.parse("FR8_STM_SCB_จิตติพัฒน์_D_2026-10-01.pdf", toPages(SCB_PREVIOUS_DAY_ONLY), "2026-10-01");
eq("SCB previous-day block: ไม่เปลี่ยนวันที่ 30 ก.ย. เป็น 1 ต.ค.", scbPreviousDay.records.length, 0);
eq("SCB previous-day block: แยกรายการนอกวันอย่างตรวจสอบได้", scbPreviousDay.dropped["วันที่ไม่ตรงกับวันที่ตรวจ"], 2);

const SCB_MIXED_DAYS = `
ธนาคารไทยพาณิชย์ SIAM COMMERCIAL BANK
เลขที่บัญชี 4311918665
30/09/26 23:50 X1 ENET 50.00 4,336.73
01/10/26 00:05 X1 ENET 70.00 4,406.73
`;
const scbMixedDays = await workerSb.__P.parse("FR8_STM_SCB_จิตติพัฒน์_D_2026-10-01.pdf", toPages(SCB_MIXED_DAYS), "2026-10-01");
eq("SCB mixed-day statement: รับเฉพาะวันรอบงาน", scbMixedDays.records.length, 1);
eq("SCB mixed-day statement: เก็บวันจริงของแถวที่รับ", scbMixedDays.records[0]?.sourceDate, "2026-10-01");
eq("SCB mixed-day statement: ตัดแถววันก่อนหน้า", scbMixedDays.dropped["วันที่ไม่ตรงกับวันที่ตรวจ"], 1);

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
const ktbNextDay = await P.parseText("AT4_STM_KTB_เบญจพร_D_2026-09-28.pdf", `
บริษัท ธนาคารกรุงไทย จำกัด มหาชน
เลขที่บัญชี 209-0879-114 รหัสสาขา 209
29/09/69 เงินโอนเข้า (IORSDT) 014-6444474223 100.00 16,592.01 209
00:02
`, "2026-09-28");
eq("KTB next-day: เก็บรายการวันที่ถัดไปเป็น candidate", ktbNextDay.records[0]?.ktbNextDayCandidateOnly, true);
eq("KTB next-day: คงวันที่ธนาคารจริงไว้", ktbNextDay.records[0]?.date, "2026-09-29");

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

const scbText = `SIAM COMMERCIAL BANK\nAccount No. 1234567890\n04/09/26 10:00 X1 ENET 100.00 1,100.00 รับโอนจาก KBANK x1111 TEST A\n04/09/26 10:01 X2 ENET 50.00 1,050.00 โอนไป SCB x2222 TEST B`;
const completeScb = await P.parseText("3XB_STM_SCB.pdf", scbText, "2026-09-04");
eq("SCB text: อ่านครบ 2 รายการ", completeScb.records.length, 2);
eq("SCB text: quality ผ่าน", completeScb.quality.complete, true);
const scbOcrMissingColumns = await P.parseText(
  "UFABET7M_STM_SCB.pdf",
  "SIAM COMMERCIAL BANK\nAccount No. 5034633891\n23/09/26 02:14 437.00 2,934.40 โอนไป BAY\n23/09/26 03:35 235.00 2,699.40 โอนไป KBANK\n23/09/26 12:17 200.00 2,899.40 รับโอนจาก KTB",
  "2026-09-23",
);
eq("SCB OCR: อ่านแถวที่ Code/Channel หายได้", scbOcrMissingColumns.records.length, 3);
eq("SCB OCR: ใช้ยอดคงเหลือต่อเนื่องระบุทิศทาง", scbOcrMissingColumns.records.map((r) => r.direction).join(","), "withdraw,withdraw,deposit");
eq("SCB OCR: continuity ครบจึงผ่าน quality", scbOcrMissingColumns.quality.complete, true);
const scbFlattenedColumns = await P.parseText(
  "UFABET7M_STM_SCB_สมภพ_DW_2026-09-23.pdf",
  "SIAM COMMERCIAL BANK\nAccount No. 5034633891\nยอดเงินคงเหลือยกมา (BALANCE BROUGHT FORWARD)\n22/09/26 23:25 X1 ENET 50.00 23/09/26 02:14 X2 ENET 437.00 23/09/26 03:35 X2 ENET 235.00\n2,749.40\n2,804.40\n2,367.40\n2,132.40\nรับโอนจาก KBANK x8766 TEST\nโอนไป BAY x9718 TEST\nโอนไป KBANK x9993 TEST",
  "2026-09-23",
);
eq("SCB OCR flattened: อ่านหลายธุรกรรมในบรรทัดเดียว", scbFlattenedColumns.quality.parsedRows, 3);
eq("SCB OCR flattened: เก็บเฉพาะวันที่ตรวจ", scbFlattenedColumns.records.length, 2);
eq("SCB OCR flattened: ใช้ X1/X2 ยืนยันทิศทาง", scbFlattenedColumns.records.map((r) => r.direction).join(","), "withdraw,withdraw");
eq("SCB OCR flattened: ไม่แจ้งบรรทัดเดิมว่าอ่านไม่สำเร็จ", scbFlattenedColumns.quality.complete, true);
const scbOcrGap = await P.parseText(
  "UFABET7M_STM_SCB.pdf",
  "SIAM COMMERCIAL BANK\nAccount No. 5034633891\n23/09/26 02:14 437.00 2,934.40 โอนไป BAY\n23/09/26 12:17 200.00 3,500.00 รับโอนจาก KTB",
  "2026-09-23",
);
eq("SCB OCR: ยอดคงเหลือขาดช่วงต้องไม่ผ่าน", scbOcrGap.quality.complete, false);
const scbCounter = await P.parseText("3XB_STM_SCB.pdf", scbText + "\n04/09/26 10:02 C1 TELL 200.00 1,250.00 Counter Service at 7-11", "2026-09-04");
eq("SCB C1: อ่านรหัส Counter Service เป็นรายการ", scbCounter.records.length, 3);
eq("SCB C1: ใช้ยอดคงเหลือยืนยันทิศทางฝาก", scbCounter.records[2]?.direction, "deposit");
eq("SCB C1: quality ผ่านโดยไม่ส่ง OCR", scbCounter.quality.complete, true);
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
const kbCurrentLayout = await P.parseText("MC8_STM_KB_ทินกร_DW_2026-09-27.pdf", `
เลขที่บัญชีเงินฝาก 199-8-54539-7
27-09-26 23:38 LINE BK14,192.52 รหัสอ้างอิง KLI20001โอนเงิน 100.00
27-09-26 23:39 K PLUS18,092.52 จาก X1234 นาย ทดสอบรับโอนเงิน 3,900.00
27-09-26 23:40 LINE BK17,992.52 รหัสอ้างอิง KLI20002โอนเงิน 100.00
`, "2026-09-27");
eq("KB current layout: อ่านแถวที่ไม่มี ++ ครบ", kbCurrentLayout.records.length, 3);
eq("KB current layout: ยอด 3,900 เป็นยอดรายการ", kbCurrentLayout.records[1]?.amount, 3900);
eq("KB current layout: 18,092.52 เป็นยอดคงเหลือ", kbCurrentLayout.records[1]?.balance, 18092.52);
eq("KB current layout: ฝากถูกทิศทาง", kbCurrentLayout.records[1]?.direction, "deposit");
eq("KB current layout: quality ผ่านครบทุกแถว", kbCurrentLayout.quality.complete, true);
const kbPdfiumHeaderReordered = await P.parseText("MC8_STM_KB_ทินกร_DW_2026-09-28.pdf", `
ชื่อบัญชี นาย ทินกร โฉมสะอาด
199-8-54539-7
01/09/2026 - 28/09/2026
เลขที่บัญชีเงินฝาก
28-09-26 00:01 Internet/Mobile SCB3,733.52 จาก SCB X0001 นาย ทดสอบ++รับโอนเงิน 30.00
`, "2026-09-28");
eq("KB PDFium reordered header: ใช้รหัส STM_KB เมื่อหัว PDF ไม่มีชื่อธนาคาร", kbPdfiumHeaderReordered.header.bank, "KBANK");
eq("KB PDFium reordered header: เลขบัญชียังถูกต้อง", kbPdfiumHeaderReordered.header.account, "1998545397");
eq("KB PDFium reordered header: ผ่าน quality gate", kbPdfiumHeaderReordered.quality.complete, true);
eq("KB PDFium reordered header: ยอดรายการไม่ใช่ยอดคงเหลือ", kbPdfiumHeaderReordered.records[0]?.amount, 30);
const kbPdfiumMixedLayout = await P.parseText("MC8_STM_KB_ทินกร_DW_2026-09-27.pdf", `
เลขที่บัญชีเงินฝาก 199-8-54539-7
27-09-26 08:29 K PLUS8,038.52 รหัสอ้างอิง KMP21983รับโอนเงิน 1,900.00
27-09-26 08:45 K PLUS10,038.52 จาก X8509 นาย ทดสอบ++รับโอนเงิน 2,000.00
27-09-26 10:42 LINE BK9,248.52 รหัสอ้างอิง KLI20571โอนเงิน 790.00
27-09-26 22:43 Internet/Mobile ต่าง
ธนาคาร
9,548.52 จาก CLCX X1530 TEST USER++รับโอนเงิน 300.00
27-09-26 23:39 Internet/Mobile GSB13,448.52 รหัสอ้างอิง Q0305918รับโอนเงิน 3,900.00
`, "2026-09-27");
eq("KB PDFium mixed: อ่านทั้งแบบมีและไม่มี ++ รวมบรรทัดตัด", kbPdfiumMixedLayout.records.length, 5);
eq("KB PDFium mixed: ยอดรายการถูกลำดับ", kbPdfiumMixedLayout.records.map((r) => r.amount).join(","), "1900,2000,790,300,3900");
eq("KB PDFium mixed: ยอดคงเหลือถูกลำดับ", kbPdfiumMixedLayout.records.map((r) => r.balance).join(","), "8038.52,10038.52,9248.52,9548.52,13448.52");
eq("KB PDFium mixed: ผ่าน quality gate", kbPdfiumMixedLayout.quality.complete, true);
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

const kbColumnOcr = `KASIKORNBANK\nเลขที่บัญชีเงินฝาก 193-8-71380-0\n17-09-26 00:20 รับโอนเงิน\n900.00\n10,287.01 K PLUS\n17-09-26 00:22 รับโอนเงิน\n900.00\n11,517.01 K PLUS`;
const kbStructuredRows = [
  { date: "2026-09-17", sec: 1200, direction: "deposit", amount: 900, balance: 10287.01, account: "1938713800", bank: "KBANK", desc: "K PLUS", raw: "17-09-26 00:20 รับโอนเงิน 900.00 10,287.01 K PLUS" },
  { date: "2026-09-17", sec: 1320, direction: "deposit", amount: 900, balance: 11517.01, account: "1938713800", bank: "KBANK", desc: "K PLUS", raw: "17-09-26 00:22 รับโอนเงิน 900.00 11,517.01 K PLUS" },
];
const kbStructured = P.parseStructuredOcr("3XB_STM_KB.pdf", { rows: kbStructuredRows, page_count: 2 }, kbColumnOcr, "2026-09-17");
eq("KB structured OCR: ตรวจ marker ครบก่อนใช้แถว", kbStructured?.quality.structuredOcrVerified, true);
eq("KB structured OCR: เก็บรายการยอดซ้ำคนละเวลา", kbStructured?.records.length, 2);
eq("KB structured OCR: ยอด 900 ไม่สลับกับยอดคงเหลือ", kbStructured?.records[0]?.balance, 10287.01);
eq("KB structured OCR: ปฏิเสธชุดแถวที่ OCR ปัจจุบันมี marker ไม่ครบ", P.parseStructuredOcr("3XB_STM_KB.pdf", { rows: kbStructuredRows.slice(0, 1) }, kbColumnOcr, "2026-09-17"), null);
const kbTrueColumnOcr = `KASIKORNBANK\nเลขที่บัญชีเงินฝาก 193-8-71380-0\n17-09-26 00:20\n17-09-26 00:22\nรับโอนเงิน\nรับโอนเงิน\n900.00\n900.00\n10,287.01\n11,517.01\nK PLUS\nK PLUS`;
const kbStructuredColumn = P.parseStructuredOcr("3XB_STM_KB.pdf", { rows: kbStructuredRows, page_count: 2 }, kbTrueColumnOcr, "2026-09-17");
eq("KB structured OCR column-major: ยืนยันด้วยวันเวลาและยอดคงเหลือ", kbStructuredColumn?.quality.columnLayoutVerified, true);
eq("KB structured OCR column-major: เก็บสองยอด 900", kbStructuredColumn?.records.length, 2);
eq("KB structured OCR column-major: ปฏิเสธเมื่อยอดคงเหลือใน PDF ไม่ตรง", P.parseStructuredOcr("3XB_STM_KB.pdf", { rows: kbStructuredRows, page_count: 2 }, kbTrueColumnOcr.replace("11,517.01", "99,999.99"), "2026-09-17"), null);
const kbDamagedTimeOcr = `KASIKORNBANK\nเลขที่บัญชีเงินฝาก 193-8-71380-0\n17-09-26 00:20\n17-09-26\nรับโอนเงิน\nรับโอนเงิน\n900.00\n900.00\n10,287.01\n11,517.01\nK PLUS\nK PLUS`;
const kbStructuredDamagedTime = P.parseStructuredOcr("3XB_STM_KB.pdf", { rows: kbStructuredRows, page_count: 2 }, kbDamagedTimeOcr, "2026-09-17");
eq("KB structured OCR damaged time: ใช้ชนิดรายการครบและยอดคงเหลือครบแทนเวลา OCR ที่หลุด", kbStructuredDamagedTime?.records.length, 2);
eq("KB structured OCR damaged time: ปฏิเสธแถวบางส่วนแม้ยอดของแถวนั้นมีใน PDF", P.parseStructuredOcr("3XB_STM_KB.pdf", { rows: kbStructuredRows.slice(0, 1), page_count: 2 }, kbDamagedTimeOcr, "2026-09-17"), null);
const kbManyRows = Array.from({ length: 10 }, (_, index) => ({
  date: "2026-09-17", sec: 1200 + index * 60, direction: "deposit", amount: 100 + index,
  balance: 10000 + index, account: "1938713800", bank: "KBANK", desc: "K PLUS",
}));
const kbPageBoundaryOcr = `KASIKORNBANK\nเลขที่บัญชีเงินฝาก 193-8-71380-0\n${kbManyRows.map((row) => `17-09-26 ${String(Math.floor(row.sec / 3600)).padStart(2, "0")}:${String(Math.floor((row.sec % 3600) / 60)).padStart(2, "0")}`).join("\n")}\n${Array(11).fill("รับโอนเงิน").join("\n")}\n${kbManyRows.map((row) => row.balance.toFixed(2)).join("\n")}`;
const kbPageBoundaryComplete = `${kbPageBoundaryOcr}\n${kbManyRows.map((row) => row.amount.toFixed(2)).join("\n")}`;
eq("KB structured OCR page boundary: ยอมรับคำประเภทรายการซ้ำในคำอธิบาย", P.parseStructuredOcr("3XB_STM_KB.pdf", { rows: kbManyRows, page_count: 2 }, kbPageBoundaryComplete, "2026-09-17")?.records.length, 10);
eq("KB structured OCR page boundary: ปฏิเสธถ้ายอดรายการไม่ครบ", P.parseStructuredOcr("3XB_STM_KB.pdf", { rows: kbManyRows, page_count: 2 }, kbPageBoundaryComplete.replace("109.00", "missing"), "2026-09-17"), null);

const scbHeader = 'SIAM COMMERCIAL BANK\nAccount No. 1234567890\n';
const scbRows = ['08/09/26 00:02 X1 ENET 55.00 9,529.48', '08/09/26 00:05 X2 ENET 3,500.00 6,029.48', '08/09/26 00:09 X1 ENET 99.00 6,128.48', '08/09/26 00:11 X1 ENET 80.00 6,208.48', '08/09/26 00:14 X1 ENET 70.00 6,278.48'];
const scbDescriptions = ['รับโอนจาก KBANK x1631 TEST A', 'โอนไป BBL x0736 TEST B', 'รับโอนจาก KBANK x2621 TEST C', 'รับโอนจาก KBANK x0561 TEST D', 'รับโอนจาก SCB x2052 TEST E'];
for (const layout of ['inline','before','after']) {
  const text = scbHeader + scbRows.map((r,i)=>layout==='inline'?r+' '+scbDescriptions[i]:layout==='before'?scbDescriptions[i]+'\n'+r:r+'\n'+scbDescriptions[i]).join('\n');
  const result = await P.parseText('FR8_SCB.pdf',text,'2026-09-08');
  eq(`SCB ${layout}: complete`,result.quality.complete,true);
  eq(`SCB ${layout}: identities stay on their rows`,JSON.stringify(result.records.map(r=>r.desc)),JSON.stringify(scbDescriptions));
  eq(`SCB ${layout}: explicit directions`,result.records.map(r=>r.direction).join(','),'deposit,withdraw,deposit,deposit,deposit');
}
const ambiguousScb=await P.parseText('SCB.pdf',scbHeader+scbRows[0]+'\n'+scbRows[1]+'\n'+scbDescriptions[1],'2026-09-08');
eq('SCB missing description: core transaction evidence still passes',ambiguousScb.quality.complete,true);
eq('SCB ambiguous identities: retain both rows without guessing descriptions',ambiguousScb.records.length,2);
eq('SCB ambiguous identities: description remains blank',ambiguousScb.records.every(r=>!r.desc),true);
const pageBoundaryScb=await P.parseText('SCB.pdf',scbHeader+scbDescriptions[0]+'\f'+scbHeader+scbRows[0],'2026-09-08');
eq('SCB never carry a description across pages',pageBoundaryScb.records[0]?.desc,'');
eq('SCB page boundary: core row remains reconcilable',pageBoundaryScb.records.length,1);
const scbSomphopLate = await P.parseText('UFABET7M_STM_SCB_สมภพ_DW_2026-09-28.pdf', `${scbHeader}
28/09/26 21:59 X1 ENET 80.00 4,408.40 รับโอนจาก KTB x9249 PORNPIPHAT KINGPIKUN
28/09/26 23:23 X1 ENET 37.00 4,445.40 รับโอนจาก KTB x0128 NATTAPHONG PANSUEBPH
29/09/26 00:28 X1 ENET 4.80 4,450.20 รับโอนจาก SCB x2403 TEST USER`, '2026-09-28');
eq('SCB สมภพ: อ่านยอดท้ายวัน 23:23 จำนวน 37 บาท', scbSomphopLate.records.at(-1)?.amount, 37);
eq('SCB สมภพ: รอบวันที่ 28 ไม่ปนรายการวันที่ 29', scbSomphopLate.records.length, 2);
const reverseScb=P.applyDirection([{code:'X1',amount:100,balance:1100},{code:'X1',amount:100,balance:1000}],'SCB');
eq('SCB explicit X1 wins over reversed balances',reverseScb[1].direction,'deposit');

console.log("\nPdfStm unit tests");
console.log(out.join("\n"));
console.log(`\n${passed} ผ่าน, ${failed} ล้มเหลว\n`);
process.exit(failed ? 1 : 0);
