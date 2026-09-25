/* =============================================================
   Unit tests สำหรับโมดูลอื่น: Formats.stamp, Rules (duplicate), Charts.spark
   ครอบคลุมบั๊กที่เพิ่งแก้ (ปี พ.ศ. ISO, duplicate ข้ามวัน, sparkline จุดเดียว)
   รัน:  node tests/units.test.mjs
   ============================================================= */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const load = (rel) => fs.readFileSync(path.join(dir, "..", rel), "utf8");

/* stub DOM ขั้นต่ำ: charts.js ผูก window.addEventListener("resize") ตอนโหลด (ฟังก์ชันวาดจริงไม่ถูกเรียกในเทสนี้) */
const sandbox = {
  performance,
  console,
  window: { addEventListener() {}, innerWidth: 1200, innerHeight: 800 },
  document: { createElement: () => ({ style: {}, appendChild() {} }), body: { appendChild() {} } },
};
vm.createContext(sandbox);
/* โหลดโมดูล (เป็น IIFE ผูกกับ const ในสโคปไฟล์) แล้วดึงออกมาทาง globalThis */
vm.runInContext(load("formats.js") + "\n;globalThis.__Formats = Formats;", sandbox);
vm.runInContext(load("rules.js") + "\n;globalThis.__Rules = Rules;", sandbox);
vm.runInContext(load("charts.js") + "\n;globalThis.__Charts = Charts;", sandbox);
const Formats = sandbox.__Formats,
  Rules = sandbox.__Rules,
  Charts = sandbox.__Charts;

let passed = 0,
  failed = 0;
const out = [];
const ok = (n, c, extra) => (c ? (passed++, out.push("  ✓ " + n)) : (failed++, out.push("  ✗ " + n + (extra ? "  → " + extra : ""))));
const eq = (n, a, b) => ok(n, a === b, `ได้ ${JSON.stringify(a)} คาดหวัง ${JSON.stringify(b)}`);

/* ---------- Formats.stamp: ปี พ.ศ. ---------- */
const serial = (Date.UTC(2026, 8, 6, 18, 48, 49) - Date.UTC(1899, 11, 30)) / 86400000;
eq("Excel serial: original date, not US formatted date", Formats.stamp(String(serial)).date, "2026-09-06");
eq("Excel serial: preserve seconds", Formats.stamp(serial).sec, 18 * 3600 + 48 * 60 + 49);
const serialPm = Formats.parse("3X_PM_AUTOPEER_D_2026-09-06.xlsx", [
  ["id", "amount", "realAmount", "provider", "status", "requestTime", "paymentTime"],
  ["REF-1", 999, 100, "autopeer", "successed", serial - 420 / 86400, serial],
  ["REF-2", 999, 200, "autopeer", "create_failed", serial, ""],
], "2026-09-06");
eq("PM raw Excel: successful row retained", serialPm.records.length, 1);
eq("PM raw Excel: payment time retained", serialPm.records[0].sec, 18 * 3600 + 48 * 60 + 49);
eq("PM raw Excel: failed payment excluded", serialPm.dropped["รายการไม่สำเร็จ (PM: create_failed)"], 1);
const xbAutopeerIds = Formats.parse("MC8_PM_AUTOPEER_W_2026-09-16.xlsx", [
  ["id", "amount", "provider", "status", "requestTime", "fee", "transactionId", "bankCode", "bankAccountNo", "bankAccountName", "updateTime", "gatewayId", "site", "transferredAmount", "_id", "submitStatus"],
  ["P2C-20260916-233303-UIHHCL", 2500, "autopeer", "PARTIAL", "2026-09-16 23:33:03", 25, "2718608", "KBANK", "5732081463", "ตัวอย่าง", "2026-09-16 23:53:38", "3xwin_autopeer", "3xwin", 2200, "6aaac4bfed5cd6e1fd9d67a6", "SENDED"],
], "2026-09-16");
eq("XB AUTOPEER: column A id remains P2C", xbAutopeerIds.records[0]?.sourceId, "P2C-20260916-233303-UIHHCL");
eq("XB AUTOPEER: transaction reference remains P2C", xbAutopeerIds.records[0]?.transactionRef, "P2C-20260916-233303-UIHHCL");
eq("XB AUTOPEER: transactionId is preserved separately", xbAutopeerIds.records[0]?.transactionId, "2718608");
eq("XB AUTOPEER: exact _id column is not collapsed into id", xbAutopeerIds.records[0]?.providerRef, "6aaac4bfed5cd6e1fd9d67a6");
const xbAutopeerLostHeader = Formats.parse("3XB_PM_AUTOPEER_W_2026-09-15.xlsx", [
  ["id", "amount", "provider", "status", "requestTime", "fee", "transactionId", "bankCode", "bankAccountNo", "bankAccountName", "updateTime", "gatewayId", "site", "transferredAmount", "providerRecord", "submitStatus"],
  ["P2C-20260915-212400-TEST01", 500, "autopeer", "SUCCESS", "2026-09-15 21:24:00", 0, "1049001", "SCB", "1234567890", "ตัวอย่าง", "2026-09-15 21:24:32", "3xbet_autopeer", "3xbet", 500, "6aa95a5bed5cd6e1fd9d25ce", "SENDED"],
], "2026-09-15");
eq("XB AUTOPEER: recover one 6aa provider id when n8n loses _id header", xbAutopeerLostHeader.records[0]?.providerRef, "6aa95a5bed5cd6e1fd9d25ce");
const xbAutopeerMissingIdCell = Formats.parse("3XB_PM_AUTOPEER_W_2026-09-15.xlsx", [
  ["id", "amount", "provider", "status", "requestTime", "transactionId", "updateTime", "transferredAmount", "_id"],
  ["P2C-20260915-213500-TEST03", 100, "autopeer", "SUCCESS", "2026-09-15 21:35:00", "10495821", "2026-09-15 21:35:27", 100, ""],
], "2026-09-15");
eq("XB AUTOPEER: blank _id still preserves transactionId for safe recovery", xbAutopeerMissingIdCell.records[0]?.transactionId, "10495821");
eq("XB AUTOPEER: blank _id is not fabricated during parsing", xbAutopeerMissingIdCell.records[0]?.providerRef, "");
const xbAutopeerAmbiguousIds = Formats.parse("3XB_PM_AUTOPEER_W_2026-09-15.xlsx", [
  ["id", "amount", "provider", "status", "requestTime", "updateTime", "transferredAmount", "providerRecord", "otherRecord"],
  ["P2C-20260915-212400-TEST02", 100, "autopeer", "SUCCESS", "2026-09-15 21:35:00", "2026-09-15 21:35:27", 100, "6aa95f3e6f7ddd65ebf18744", "6aa95a5bed5cd6e1fd9d25ce"],
], "2026-09-15");
eq("XB AUTOPEER: ambiguous raw 6aa values do not auto-select", xbAutopeerAmbiguousIds.records[0]?.providerRef, "");
eq("stamp: ISO พ.ศ. -> ค.ศ.", Formats.stamp("2569-07-19 10:00:00").date, "2026-07-19");
eq("stamp: ISO ค.ศ. ไม่แตะ", Formats.stamp("2026-07-19 10:00:00").date, "2026-07-19");
eq("stamp: DD/MM/YY พ.ศ. 2 หลัก", Formats.stamp("19/07/69 10:00").date, "2026-07-19");
eq("stamp: เวลาถูก", Formats.stamp("2026-07-19 10:30:15").sec, 10 * 3600 + 30 * 60 + 15);
const n8nMidnight = Formats.stamp("2026-09-16T17:37:04.000Z");
eq("n8n UTC: คืนวัน/เวลา Bangkok ตาม PM", n8nMidnight.date, "2026-09-17");
eq("n8n UTC: 17:37Z ต้องเป็น 00:37 Bangkok", n8nMidnight.sec, 37 * 60 + 4);
const n8nOffset = Formats.stamp("2026-09-16T18:38:06+01:00");
eq("timestamp with offset: normalize to Bangkok date", n8nOffset.date, "2026-09-17");
eq("timestamp with offset: normalize to Bangkok time", n8nOffset.sec, 38 * 60 + 6);

/* ---------- Formats.pm_provider: MYPAY ถอนสำเร็จบางส่วน ---------- */
for (const [token, direction] of [["D", "deposit"], ["W", "withdraw"]]) {
  const cyber = Formats.parse(`SK8_PM_CYBERPAY_${token}_2026-09-06.xlsx`, [
    ["วันที่ทำรายการ", "Ref Id", "จำนวนเงิน", "สถานะ"],
    ["2026-09-06 10:03:08", "test-cyber", 100, "success"],
  ], "2026-09-06");
  eq(`CYBERPAY ${token}: same identity as BO CYBERPLUS`, cyber.records[0].account, "CYBERPLUS");
  eq(`CYBERPAY ${token}: direction preserved`, cyber.records[0].direction, direction);
  eq(`CYBERPAY ${token}: amount preserved`, cyber.records[0].amount, 100);
}
const mypayRows = [
  ["id", "amount", "provider", "status", "requestTime", "updateTime", "transferredAmount", "submitStatus"],
  ['="p2p-test"', "10000", "mypays24", "PARTIAL", "2026-08-26 07:54:04", "2026-08-26 08:55:07", "8700", "SENDED"],
];
const mypayPartial = Formats.parse("MC mypays24-report-withdraw.csv", mypayRows, "2026-08-26");
eq("MYPAY partial+sended: use actual payout", mypayPartial.records.length, 1);
eq("MYPAY partial+sended: partial marker retained", mypayPartial.records[0].partial, true);

const autopeerWithdrawRows = [
  ["UFABET7M"],
  ["วันที่", "Ref", "Username", "ธนาคาร", "เลขบัญชี", "ชื่อ - นามสกุล ผู้รับ", "แจ้งถอน", "P2P จ่าย", "Progress", "Status"],
  ["27/08/2026 23:42", "P2C-20260827-234211-EUBLWK", "ufpyo7mm146703", "ธนาคารกรุงเทพ", "6940541482", "ศราวุธ เทพกิจ", "1000", "1000", "1000/1000", "SUCCESS"],
  ["27/08/2026 23:32", "P2C-20260827-233242-YQPJGV", "ufpyo7mm106968", "ธนาคารไทยพาณิชย์", "4341146018", "ชัยณรงค์ ชัยทัศน์", "1920", "1600", "1600/1920", "SUCCESS-PARTIAL"],
];
const autopeerWithdraw = Formats.parse("UFABET7M_PM_AUTOPEER_W_2026-08-27.xlsx", autopeerWithdrawRows, "2026-08-27");
eq("AUTOPEER _W_: Success and partial actual payouts", autopeerWithdraw.records.length, 2);
eq("AUTOPEER _W_: partial uses P2P paid, not requested", autopeerWithdraw.records[1].amount, 1600);
eq("AUTOPEER _W_: ใช้ยอด P2P จ่าย", autopeerWithdraw.records[0].amount, 1000);
eq("AUTOPEER _W_: เก็บยอดที่แจ้งถอน", autopeerWithdraw.records[0].requested, 1000);
eq("AUTOPEER _W_: ระบุทิศทางถอน", autopeerWithdraw.records[0].direction, "withdraw");

const compactBoRows = [
  ["UFABET7M"],
  ["เวลา", "ประเภท", "ยูสเซอร์", "บัญชี", "บัญชีบริษัท", "ยอดเงิน", "โบนัส", "โน้ต", "ผู้ดำเนินการ", "แก้ไข"],
  ["2026-08-27 23:42", "ถอน", "ufpyo7mm146703", "ศราวุธ เทพกิจ (BBL) 6940541482", "ATP PAYMENT ถอน 00000ATP", "1000", "0", "P2C-20260827-234211-EUBLWK", "ไว", "แก้ไข"],
];
const compactBo = Formats.parse("UFABET7M_BO_DW_2026-08-27.xlsx", compactBoRows, "2026-08-27");
eq("BO แบบย่อ: ตรวจรูปแบบ", compactBo.code, "bo_compact");
eq("BO แบบย่อ: provider ATP เป็น AUTOPEER", compactBo.records[0].account, "AUTOPEER");
eq("BO แบบย่อ: ทิศทางถอน", compactBo.records[0].direction, "withdraw");
eq("BO แบบย่อ: อ่าน ref จากโน้ต", compactBo.records[0].ref, "P2C-20260827-234211-EUBLWK");

const transactionBoRows = [
  ["รหัส", "เวลา", "ประเภท", "ประเภทดำเนินการ", "ยูสเซอร์", "ธนาคาร", "จำนวน", "จำนวนที่ได้รับ", "ค่าธรรมเนียม", "เวลาทำรายการ", "หมายเหตุ", "ผู้ดำเนินการ"],
  ["10383583", "2026-08-31 00:11", "ถอน", "ถอน", "3fx33323", "KBANK 1968766313 (นราธิป บุญอาจ)(kob-deposit)", "650", "0", "0", "2026-08-30 22:56", "", "ไกด์ x5"],
  ["10383834", "2026-08-31 00:01", "ฝาก", "ออโต้", "3fx55889", "SCB 6242596342 (แววดาว ประกายทรัพย์)(kob-deposit)", "500", "500", "13", "2026-08-31 00:02", "", "Admin"],
  ["10383528", "2026-08-31 01:03", "ถอน", "ออโต้", "3fx366079", "พร้อมเพย์-CP(corepay)(QR)", "41350", "0", "10", "2026-08-30 22:43", "", "cake x5"],
];
const transactionBo = Formats.parse("3X_BO_2026-08-31.xlsx", transactionBoRows, "2026-08-31");
eq("BO ธุรกรรม: ตรวจรูปแบบ 12 คอลัมน์", transactionBo.code, "bo_transaction_export");
eq("BO ธุรกรรม: ดึงเลข KBANK จากคอลัมน์ธนาคาร", transactionBo.records[0].account, "1968766313");
eq("BO ธุรกรรม: ไม่รวมเลขจากข้อความวงเล็บ", transactionBo.records[1].account, "6242596342");
eq("BO ธุรกรรม: ระบุธนาคาร", transactionBo.records[0].bank, "KBANK");
eq("BO ธุรกรรม: เก็บชื่อเต็มจาก BO ไว้รีเช็ก", transactionBo.records[0].boIdentityRaw, "KBANK 1968766313 (นราธิป บุญอาจ)(kob-deposit)");
eq("BO ธุรกรรม: PM ใช้ provider เป็นตัวตน", transactionBo.records[2].account, "COREPAY");
eq("BO ธุรกรรม: ใช้เวลารายการ BO เป็นเวลาจับคู่", transactionBo.records[0].sec, 11 * 60);
eq("BO ธุรกรรม: เก็บเวลาธนาคารแยกไว้เป็นหลักฐาน", transactionBo.records[0].bankSec, 22 * 3600 + 56 * 60);
eq("BO ธุรกรรม: PM ไม่ใช้เลขใน P2P/QR", transactionBo.records[2].isPmChannel, true);
const sapanBo = Formats.parse("3X_BO_2026-09-15.xlsx", [
  transactionBoRows[0],
  ["1049603", "2026-09-15 21:35", "ถอน", "ถอน", "3xb-user", "พร้อมเพย์-ATP(autopeer)(P2P)", "100", "0", "0", "2026-09-15 21:35", "sapan: 6aa8a28b6f7ddd65ebf16ce8 | โอนจริง 1300 สำเร็จ 1265.99 คืน 34.01", "Admin"],
], "2026-09-15");
eq("BO Sapan: แยก provider id หลัง colon เท่านั้น", sapanBo.records[0].providerRef, "6aa8a28b6f7ddd65ebf16ce8");
eq("BO Sapan: เก็บหมายเหตุต้นฉบับไว้เป็นหลักฐาน", sapanBo.records[0].note, "sapan: 6aa8a28b6f7ddd65ebf16ce8 | โอนจริง 1300 สำเร็จ 1265.99 คืน 34.01");

/* ---------- Rules: duplicate ต้องไม่ข้ามวัน ---------- */
const recBase = (o) => ({ date: "2026-08-01", boSec: 36000, sec: 36000, account: "A-1", amount: 500, direction: "deposit", memberCode: "M1", ref: "r", manual: true, raw: "raw", company: "C", username: "u", ...o });
const dupCount = (records) => Rules.run([{ records, aux: [] }], { businessRules: { dupWindowSec: 300, largeThreshold: 0 } }).exceptions.filter((e) => e.type === "duplicate").length;

eq("duplicate: คนละวัน ไม่ใช่ซ้ำ", dupCount([recBase({ date: "2026-08-01", ref: "r1" }), recBase({ date: "2026-08-02", ref: "r2" })]), 0);
eq("duplicate: วันเดียวกัน+ใกล้กัน = ซ้ำ", dupCount([recBase({ boSec: 36000, sec: 36000, ref: "r1" }), recBase({ boSec: 36100, sec: 36100, ref: "r2" })]), 1);
eq("duplicate: ref เดียวกัน ไม่นับ", dupCount([recBase({ ref: "same" }), recBase({ boSec: 36100, sec: 36100, ref: "same" })]), 0);

/* ---------- Rules: cross-day ต้องมีวันที่จริงครบสองฝั่ง ---------- */
const crossDayCount = (record) =>
  Rules.run([{ records: [recBase({ crossDay: true, largeThreshold: 0, ...record })], aux: [] }], { businessRules: { largeThreshold: 0 } }).exceptions.filter((e) => e.type === "cross_day");
eq("cross-day: วันที่ BO หาย ไม่เปิดเคสเท็จ", crossDayCount({ boDate: undefined, date: "2026-08-29" }).length, 0);
eq("cross-day: วันเดียวกัน ไม่เปิดเคส", crossDayCount({ boDate: "2026-08-29", date: "2026-08-29" }).length, 0);
const validCrossDay = crossDayCount({ boDate: "2026-08-29", date: "2026-08-30", boSec: 86340, sec: 60 });
eq("cross-day: คนละวันจริงยังเปิดเคส", validCrossDay.length, 1);
ok("cross-day: BO timestamp has its own date", /^\d{4}-\d{2}-\d{2}$/.test(validCrossDay[0]?.boDate || ""));
ok("cross-day: รายละเอียดไม่มี undefined/NaN", !/undefined|NaN/.test(validCrossDay[0]?.detail || ""), validCrossDay[0]?.detail);

/* ---------- Charts.spark: กัน NaN ---------- */
ok("spark: จุดเดียว ไม่มี NaN", !Charts.spark([5]).includes("NaN"), Charts.spark([5]));
ok("spark: ว่าง คืน <svg ไม่ throw", Charts.spark([]).includes("<svg"));
ok("spark: หลายจุด ไม่มี NaN", !Charts.spark([1, 2, 3, 4]).includes("NaN"));

const thaiDepositRows = [["วันเวลา", "OrderId", "จำนวนเงินฝาก", "ค่าธรรมเนียม", "รับสุทธิ", "สถานะ"],
  ["2026-09-03 12:00:00", "P2C-test", 125, 5, 120, "Success"]];
const thaiDeposit = Formats.parse("AT4_PM_AUTOPEER_D_2026-09-03.xlsx", thaiDepositRows, "2026-09-03");
eq("PM Thai deposit: use gross deposit, not net", thaiDeposit.records[0]?.amount, 125);
thaiDepositRows[1][2] = 0;
eq("PM Thai deposit: zero is not a matching transaction", Formats.parse("AT4_PM_AUTOPEER_D_2026-09-03.xlsx", thaiDepositRows, "2026-09-03").records.length, 0);
const customerHeaders = ["No.", "วันที่ทำรายการ", "วันที่ธนาคาร", "รหัสอ้างอิง", "สมาชิก", "บัญชีลูกค้า", "จำนวนเงินฝากจริง", "จำนวนเงินถอนจริง", "ชื่อธนาคาร"];
eq("CPXM maps to COREPAY", Formats.canonicalPm("CPXM-598 : CP"), "COREPAY");
eq("CP2 maps to COREPAY", Formats.canonicalPm("CP2 PAYMENT ถอน"), "COREPAY");
eq("BO channel uses full bank field, not CP suffix", Formats.channelOf("CPXM-598 : CP").channel, "COREPAY");
for (const [token,dep,wit,direction] of [["D",100,0,"deposit"],["W",0,100,"withdraw"]]) {
  const r = Formats.parse(`FR8_BO_${token}_2026-09-07.xlsx`, [customerHeaders,[1,"2026-09-07 12:00:00","2026-09-07 12:00:00","ref","user","1262976366 | ชาญชัย ตนเล็ก",dep,wit,"CPXM-598 : CP"]],"2026-09-07").records[0];
  eq(`CPXM ${token}: provider`,r?.account,"COREPAY");
  eq(`CPXM ${token}: company`,r?.company,"FR8");
  eq(`CPXM ${token}: direction`,r?.direction,direction);
  eq(`CPXM ${token}: date`,r?.date,"2026-09-07");
  eq(`CPXM ${token}: original label`,r?.boIdentityRaw,"CPXM-598 : CP");
}
{
  const r = Formats.parse("FR8_BO_D_2026-09-07.xlsx", [customerHeaders,
    [1,"2026-09-07 23:58:00","2026-09-08 00:03:00","ref","user","1262976366 | ชาญชัย ตนเล็ก",100,0,"4311918665 : Manual"]], "2026-09-07").records[0];
  eq("BO main: reconciliation date uses transaction date", r?.date, "2026-09-07");
  eq("BO main: reconciliation time uses transaction time", r?.sec, 23 * 3600 + 58 * 60);
  eq("BO main: bank date remains available for cross-day evidence", r?.bankDate, "2026-09-08");
  eq("BO main: different bank date marks cross-day evidence", r?.crossDay, true);
}
for (const [raw, tail] of [["1262976366 | ชาญชัย ตนเล็ก", "6366"], ["0012345678 | ตัวอย่าง", "5678"], [" | ตัวอย่าง", null], ["xxx6366 | ตัวอย่าง", null]]) {
  const row = Formats.parse("FR8_BO_W_2026-09-07.xlsx", [customerHeaders, [1, "2026-09-07 23:57:45", "2026-09-07 23:59:11", "test-ref", "เจมส์ | FAZ330483", raw, 0, 800, "4311918665 : Manual"]], "2026-09-07").records[0];
  eq("BO customer: combined text preserved " + raw, row?.custAccountRaw, raw.trim());
  eq("BO customer: separate account " + raw, row?.custAccount, raw.split("|")[0].trim());
  eq("BO customer: separate name " + raw, row?.custName, raw.split("|")[1].trim());
  eq("BO customer: last four " + raw, row?.custAccountLast4, tail);
  eq("BO customer: withdrawal preserved", row?.direction, "withdraw");
}
for (const [token, label, direction] of [["D", "ฝาก", "deposit"], ["W", "ถอน", "withdraw"]]) {
  const headers = ["วันเวลา", "รหัสสมาชิก", "เลขบัญชีสมาชิก", "ชื่อบัญชีสมาชิก", "ชื่อธนาคารสมาชิก", "OrderId", "PaymentId", "Ref1", "Ref2", `จำนวนเงิน${label}`, "ค่าธรรมเนียม", token === "D" ? "รับสุทธิ" : "ถอนสุทธิ", "สถานะ"];
  const entries = ["Success", "Cancel", "Time out", "unsuccessful", "SUCCESS-PARTIAL"].map(status => ["2026-09-07 12:00:00", "TEST-USER", "0012345678", "ทดสอบ", "KBANK", "TEST-ORDER", "TEST-PAYMENT", "", "", 100, 2, 98, status]);
  const parsed = Formats.parse(`FR8_PM_AUTOPEER_${token}_2026-09-07.xlsx`, [headers, ...entries], "2026-09-07");
  eq(`AUTOPEER ${token}: one Success`, parsed.records.length, 1);
  eq(`AUTOPEER ${token}: gross amount`, parsed.records[0]?.amount, 100);
  eq(`AUTOPEER ${token}: direction`, parsed.records[0]?.direction, direction);
  eq(`AUTOPEER ${token}: customer account not company`, parsed.records[0]?.custAccount, "0012345678");
  eq(`AUTOPEER ${token}: user retained`, parsed.records[0]?.memberCode, "TEST-USER");
  eq(`AUTOPEER ${token}: reference retained`, parsed.records[0]?.ref, "TEST-ORDER");
}
const sevenCorepayDeposit = Formats.parse('7M_COREPAY_D_2026-09-20.xlsx', [
  ['วันที่ทำรายการ','Ref Id','user ที่ฝาก','จำนวนที่ฝาก','จำนวนที่ได้รับ','เลขบัญชีที่โอน','ธนาคารต้นทาง','สถานะ'],
  ['2026-09-20 10:00:00','CP-REF-1','seven-user',505,500,'1234567890','SCB','SUCCESSED'],
], '2026-09-20');
eq('7M COREPAY deposit: received amount is matching amount',sevenCorepayDeposit.records[0]?.amount,500);
eq('7M COREPAY deposit: amount source is preserved',sevenCorepayDeposit.records[0]?.amountColumn,'จำนวนที่ได้รับ');
const sevenCorepayPendingDeposit = Formats.parse('UFABET7M_PM_CP2_D_2026-09-21.xlsx', [
  ['วันที่ทำรายการ','Ref Id','user ที่ฝาก','จำนวนที่ฝาก','จำนวนที่ได้รับ','เลขบัญชีที่โอน','ธนาคารต้นทาง','สถานะ'],
  ['2026-09-21 17:52:37','260921175236-06354025-CP','ufpyo7mm110058',200,200,'0682590900','SCB','pending'],
  ['2026-09-21 17:50:54','260921175053-21523366-CP','ufpyo7mm104192',5000,5000,'4070193308','SCB','pending'],
  ['2026-09-21 17:50:36','260921175034-93622497-CP','ufpyo7mm138387',5000,5000,'0618073246','KBANK','pending'],
], '2026-09-21');
eq('7M COREPAY deposit: pending rows remain eligible for reconciliation',sevenCorepayPendingDeposit.records.length,3);
eq('7M COREPAY deposit: pending received amount is used',sevenCorepayPendingDeposit.records[1]?.amount,5000);
eq('7M COREPAY deposit: pending Ref Id is retained',sevenCorepayPendingDeposit.records[2]?.ref,'260921175034-93622497-CP');
const sevenCorepayGenericFile = Formats.parse('20-09-26 7MPM.xlsx', [
  ['UFABET7M'],
  ['วันที่ทำรายการ','Ref Id','user ที่ฝาก','จำนวนที่ได้รับ','สถานะ'],
  ['2026-09-20 10:00:00','260920-TEST-CP','seven-user',500,'SUCCESSED'],
], '2026-09-20');
eq('7M generic PM: Ref ending -CP infers COREPAY',sevenCorepayGenericFile.records[0]?.account,'COREPAY');
const sevenAutopeerPartialGenericFile = Formats.parse('20-09-26 7MPM.xlsx', [
  ['วันที่','Ref','Username','ธนาคาร','เลขบัญชี','ชื่อ - นามสกุล ผู้รับ','แจ้งถอน','P2P จ่าย','Progress','Status'],
  ['20/09/2026 23:39','P2C-20260920-233935-TVA7VJ','seven-user','KBANK','2082779178','ทดสอบ',500,493,'493/500','SUCCESS-PARTIAL'],
], '2026-09-20');
eq('7M generic PM: 7MPM filename sets UFABET7M subcompany',sevenAutopeerPartialGenericFile.records[0]?.subco,'UFABET7M');
eq('7M generic PM: P2C/BO account infers AUTOPEER',sevenAutopeerPartialGenericFile.records[0]?.account,'AUTOPEER');
eq('7M generic PM: partial uses P2P paid amount',sevenAutopeerPartialGenericFile.records[0]?.amount,493);
eq('7M generic PM: partial status is retained',sevenAutopeerPartialGenericFile.records[0]?.partial,true);

const sharedSplitRef = Formats.merge([
  { formatCode:'bo_transaction_export', ref:'PARENT-REF', amount:300, rowNo:1 },
  { formatCode:'bo_transaction_export', ref:'PARENT-REF', amount:600, rowNo:2 },
]);
eq('BO split payout: rows sharing parent Ref are preserved',sharedSplitRef.length,2);
eq('BO split payout: first amount is preserved',sharedSplitRef[0]?.amount,300);
eq('BO split payout: second amount is preserved',sharedSplitRef[1]?.amount,600);
const sevenCyberDeposit = Formats.parse('7M_CYBERPLUS_D_2026-09-20.xlsx', [
  ['วันที่ทำรายการ','Ref Id','user ที่ฝาก','จำนวนเงิน','เลขบัญชีที่โอน','ธนาคารต้นทาง','สถานะ'],
  ['2026-09-20 10:00:00','CY-REF-1','seven-user',700,'1234567890','SCB','SUCCESSED'],
], '2026-09-20');
eq('7M CYBERPLUS deposit: จำนวนเงิน is supported',sevenCyberDeposit.records[0]?.amount,700);
console.log("\nUnit tests (Formats / Rules / Charts)");
console.log(out.join("\n"));
console.log(`\n${passed} ผ่าน, ${failed} ล้มเหลว\n`);
process.exit(failed ? 1 : 0);
