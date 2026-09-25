/* =============================================================
   Unit tests สำหรับ Engine (parser + reconciliation)
   รันด้วย:  node tests/engine.test.mjs
   ไม่ต้องมี dependency ภายนอก — โหลด engine.js (IIFE) ผ่าน vm
   ============================================================= */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const engineSrc = fs.readFileSync(path.join(__dirname, "..", "engine.js"), "utf8");
const formatsSrc = fs.readFileSync(path.join(__dirname, "..", "formats.js"), "utf8");

/* engine.js เป็น IIFE: `const Engine = (() => {...})()`
   ประเมินในกล่อง sandbox แล้วดึงตัวแปร Engine ออกมา
   (โค้ดใช้ typeof Formats/XlsxReader/XLSX แบบ guard อยู่แล้ว จึงไม่ต้อง stub) */
const sandbox = { performance, console };
vm.createContext(sandbox);
vm.runInContext(formatsSrc + "\n" + engineSrc + "\n;globalThis.__Engine = Engine;", sandbox);
const Engine = sandbox.__Engine;

/* ---------------- mini test harness ---------------- */
let passed = 0,
  failed = 0;
const results = [];
function ok(name, cond, extra) {
  if (cond) {
    passed++;
    results.push("  ✓ " + name);
  } else {
    failed++;
    results.push("  ✗ " + name + (extra ? "  → " + extra : ""));
  }
}
const eq = (name, a, b) => ok(name, a === b, `ได้ ${JSON.stringify(a)} คาดหวัง ${JSON.stringify(b)}`);

/* ---------------- record helper ---------------- */
let _id = 0;
const rec = (o) => ({
  rowNo: ++_id,
  date: "2026-08-01",
  direction: "deposit",
  company: "C",
  bank: "SCB",
  username: "u",
  ref: "r",
  desc: "",
  raw: "raw",
  crossDay: false,
  ...o,
});

const settings = { toleranceDeposit: 120, toleranceWithdraw: 120, minuteTolerance: 60 };
const run = (stm, bo, s = settings, masterAccounts = []) => Engine.reconcile(stm, bo, s, masterAccounts, null);

/* ================= 1) parseCSV ================= */
(function () {
  const a = Engine.parseCSV("a,b\n1,2\n");
  eq("parseCSV: จำนวนแถว", a.length, 2);
  eq("parseCSV: เซลล์", a[1][1], "2");

  const q = Engine.parseCSV('a,"b,c"\n"x""y",z');
  eq("parseCSV: ลูกน้ำในเครื่องหมายคำพูด", q[0][1], "b,c");
  eq('parseCSV: escape ""', q[1][0], 'x"y');

  const bom = Engine.parseCSV("﻿a,b\n1,2");
  eq("parseCSV: ตัด BOM ทิ้ง", bom[0][0], "a");

  const blanks = Engine.parseCSV("a,b\n\n \n1,2\n");
  eq("parseCSV: กรองบรรทัดว่าง", blanks.length, 2);

  const empty = Engine.normalize("MR9 azpay-report-withdraw.csv", [], {}, "2026-08-24");
  ok("normalize: ไฟล์ว่างไม่ทำให้ parser ล้ม", empty && empty.format && empty.format.source === "pm", JSON.stringify(empty));
})();

/* ================= 2) normalize ================= */
(function () {
  const rows = [
    ["วันที่", "เวลา", "ฝาก", "ถอน", "เลขที่บัญชี"],
    ["2026-08-01", "01:00:00", "100", "", "SCB-1"],
    ["2026-08-01", "02:00:00", "", "50", "SCB-1"],
    ["2026-07-31", "03:00:00", "70", "", "SCB-1"], // คนละวัน → ต้องถูกกรอง
  ];
  const st = { rules: { filterCarryForward: true, pmSuccessOnly: true } };
  const n = Engine.normalize("scb_stm.csv", rows, st, "2026-08-01");
  eq("normalize: จำนวนรายการที่ใช้ได้", n.records.length, 2);
  eq("normalize: ยอดฝาก", n.records[0].amount, 100);
  eq("normalize: ทิศทางฝาก", n.records[0].direction, "deposit");
  eq("normalize: ทิศทางถอน", n.records[1].direction, "withdraw");
  eq("normalize: บัญชี", n.records[0].account, "SCB-1");
  ok("normalize: กรองรายการคนละวันออก", n.dropped["วันที่ไม่ตรงกับวันที่ตรวจ"] === 1, JSON.stringify(n.dropped));

  const signed = Engine.normalize("tmn_statement.csv", [
    ["วันที่", "เวลา", "ฝาก", "ถอน", "เลขที่บัญชี", "รายละเอียด"],
    ["2026-08-01", "04:00:00", "", "-900", "TMN-1", "ถอนเงินลูกค้า"],
    ["2026-08-01", "04:01:00", "", "-10", "TMN-1", "fee_p2p_receive"],
  ], st, "2026-08-01");
  eq("normalize: STM withdrawal signed amount becomes positive", signed.records[0]?.amount, 900);
  eq("normalize: STM withdrawal direction remains withdraw", signed.records[0]?.direction, "withdraw");
  eq("normalize: fee_p2p_receive is excluded", signed.records.length, 1);
  eq("normalize: fee filter reason is auditable", signed.dropped["กรองค่าธรรมเนียมรับ P2P ซึ่งไม่ใช่รายการลูกค้า"], 1);
})();

/* ================= 3) reconcile: exact match ================= */
await (async function () {
  const r = await run([rec({ account: "SCB-1", amount: 100, sec: 3600 })], [rec({ account: "SCB-1", amount: 100, sec: 3630 })]);
  eq("exact: matched", r.matched, 1);
  eq("exact: ไม่มี exception", r.exceptions.length, 0);
  eq("exact: matchRate", Math.round(r.matchRate), 100);
  eq("exact: ส่ง key ของ BO ที่จับสำเร็จให้ Worker", r.matchedBoKeys.length, 1);
})();

await (async function () {
  const r = await run(
    [rec({ account: "TMN-1", amount: -1020, sec: 3600, direction: "withdraw", company: "UFABET7M" })],
    [rec({ account: "TMN-1", amount: 1020, sec: 3630, direction: "withdraw", company: "UFABET7M" })],
  );
  eq("signed withdrawal: STM -1,020 จับกับ BO 1,020", r.matched, 1);
  eq("signed withdrawal: ไม่สร้างยอดต่างเท็จ", r.exceptions.length, 0);
  eq("signed withdrawal: หลักฐานเก็บยอดเป็นค่าบวก", r.matchEvidence[0]?.stmAmount, 1020);
})();

await (async function () {
  const common = { date: "2026-09-20", company: "UFABET7M", subco: "UFABET7M", amount: 7000 };
  const stm = [
    rec({ ...common, account: "1953583301", sec: 17 * 3600 + 50 * 60, direction: "deposit", raw: "รับโอนเงิน 7,000 Rungfa Saeta" }),
    rec({ ...common, account: "0812792075", sec: 17 * 3600 + 50 * 60 + 23, direction: "withdraw", raw: "เงินออก -7,000 promptpay_bay_fundout", internalTransferHint: true }),
  ];
  const bo = [
    rec({ ...common, account: "1953583301", sec: 17 * 3600 + 50 * 60, direction: "withdraw", raw: "โยกเงินเข้า | รับยอด TMN รุ่งฟ้า 7000" }),
    rec({ ...common, account: "0812792075", sec: 17 * 3600 + 50 * 60, direction: "deposit", raw: "โยกเงินออก | โยกเข้า KB กิตติ 7000" }),
  ];
  const r = await run(stm, bo, { ...settings, internalTransferTolerance: 300 });
  eq("7M internal transfer: ปิดคู่ KB +7,000 / TMN -7,000 ครบสองฝั่ง", r.matched, 2);
  eq("7M internal transfer: ไม่สร้าง Exception ซ้ำ", r.exceptions.length, 0);
  eq("7M internal transfer: นับหลักฐาน internal transfer", r.internalTransferMatched, 2);
  ok("7M internal transfer: เก็บวิธีจับคู่ใน Audit Log",
    r.matchEvidence.every((e) => e.method === "seven-m-internal-transfer-reciprocal" && e.internalTransferMatched));
})();

await (async function () {
  const common = { date: "2026-09-20", company: "UFABET7M", subco: "UFABET7M", amount: 7000, account: "1953583301", sec: 17 * 3600 + 50 * 60 };
  const r = await run(
    [rec({ ...common, direction: "deposit", raw: "รับโอน 7,000" })],
    [rec({ ...common, direction: "withdraw", raw: "โยกเงินเข้า 7,000" })],
  );
  eq("7M internal transfer safety: ไม่ปิดจากยอดเดียวเมื่อไม่มีขา statement ตอบกลับ", r.matched, 0);
})();

/* รายการก่อน/หลังเที่ยงคืนต้องเทียบ timestamp จริง ไม่ใช่ลบเฉพาะวินาทีในวัน */
await (async function () {
  const r = await run(
    [rec({ account: "MID-1", amount: 200, date: "2026-08-30", sec: 60, direction: "deposit" })],
    [rec({ account: "MID-1", amount: 200, date: "2026-08-29", sec: 86340, direction: "deposit", crossDay: true })],
  );
  eq("midnight exact: 23:59 กับ 00:01 ต่าง 120 วินาที = matched", r.matched, 1);
  eq("midnight exact: ไม่สร้าง cross_day ซ้ำ", r.exceptions.length, 0);
  eq("midnight exact: ระบุจำนวนคู่ข้ามวัน", r.crossDayMatched, 1);
  eq("midnight evidence: preserve BO date", r.matchEvidence[0].bo.date, "2026-08-29");
  eq("midnight evidence: preserve STM date", r.matchEvidence[0].stm.date, "2026-08-30");
  eq("midnight evidence: unknown file ID is not invented", r.matchEvidence[0].stm.fileId, null);
})();

await (async function () {
  const s = rec({ account: "MID-SAFE", amount: 100, date: "2026-09-02", sec: 60 });
  const b = rec({ account: "MID-SAFE", amount: 100, date: "2026-09-01", sec: 86340 });
  eq("cross-day: ambiguous BO is not auto-matched", (await run([s], [b, {...b, sec: 86350}])).matched, 0);
  eq("cross-day: ambiguous STM is not auto-matched", (await run([s, {...s, sec: 50}], [b])).matched, 0);
  eq("cross-day: unknown time is not auto-matched", (await run([{...s, noTime: true}], [b])).matched, 0);
  eq("cross-day: different company is not auto-matched", (await run([{...s, company: "OTHER"}], [b])).matched, 0);
  eq("cross-day: different direction is not auto-matched", (await run([{...s, direction: "withdraw"}], [b])).matched, 0);
  eq("cross-day: originals preserved", b.date, "2026-09-01");
})();

/* ===== 18) รายงาน PM เป็น statement ฝั่ง STM และใช้ provider เป็น match key ===== */
(function () {
  const rows = [
    ["id", "amount", "provider", "status", "requestTime"],
    ["DEP-1", "100", "Autopeer", "Success", "2026-08-01 10:00:00"],
  ];
  const n = Engine.normalize("AT4 Autopeer ฝาก.xlsx", rows, { rules: { filterCarryForward: true, pmSuccessOnly: true } }, "2026-08-01");
  eq("PM: เป็นฝั่ง STM", n.format.source, "stm");
  eq("PM: account เป็น provider มาตรฐาน", n.records[0]?.account, "AUTOPEER");
})();

/* PM provider เป็น match key ไม่ใช่เลขบัญชีบริษัท จึงไม่ควรถูก master list
   ตีความเป็น wrong_account หลังจับคู่สำเร็จ */
await (async function () {
  const pm = rec({ account: "AUTOPEER", amount: 500, sec: 3600 });
  pm.isPmChannel = true;
  pm.channel = "AUTOPEER";
  const bo = rec({ account: "AUTOPEER", amount: 500, sec: 3605 });
  bo.isPmChannel = true;
  bo.channel = "AUTOPEER";
  const r = await run([pm], [bo], settings, [{ id: "0123456789", bank: "SCB" }]);
  eq("PM provider: จับคู่สำเร็จ", r.matched, 1);
  eq("PM provider: ไม่สร้าง wrong_account เท็จ", r.exceptions.filter((x) => x.type === "wrong_account").length, 0);
})();

(function () {
  const rows = [
    ["วันเวลา", "รหัสสมาชิก", "เลขบัญชีสมาชิก", "ชื่อธนาคารสมาชิก", "OrderId", "จำนวนเงินฝาก", "ค่าธรรมเนียม", "รับสุทธิ", "สถานะ"],
    ["2026-08-24 17:35:46", "AFF26263", "0112601873", "scb", "260824173545-69151724-CP", "100", "2.6", "97.4", "Success"],
  ];
  const n = Engine.normalize("AT4 CPXM-599 ฝาก.xlsx", rows, { rules: { filterCarryForward: true, pmSuccessOnly: true } }, "2026-08-24");
  eq("PM CPXM: อ่านหัววันเวลาได้", n.records.length, 1);
  eq("PM CPXM: ยอดฝาก", n.records[0]?.amount, 100);
  eq("PM CPXM: เป็นฝั่ง STM", n.format.source, "stm");
})();

(function () {
  const rows = [
    ["รหัส", "เวลา", "ประเภท", "ประเภทดำเนินการ", "ยูสเซอร์", "ธนาคาร", "จำนวน", "จำนวนที่ได้รับ", "ค่าธรรรมเนียม", "เวลาทำรายการ", "หมายเหตุ", "ผู้ดำเนินการ"],
    ["2692707", "2026-08-24 00:05", "ฝาก", "ฝากมือ", "3win42543", "KBANK 1998545397 (ทินกร โฉมสะอาด)(P2P)", "49.00", "49.00", "0", "2026-08-24 00:08", "เติมล่วงหน้า", "PLOY X5"],
  ];
  const n = Engine.normalize("MC.xlsx", rows, { rules: { filterCarryForward: true, pmSuccessOnly: true } }, "2026-08-24");
  eq("BO แบบย่อ: ตรวจเป็น BO", n.format.source, "bo");
  eq("BO แบบย่อ: อ่านรายการ", n.records.length, 1);
  eq("BO แบบย่อ: อ่านยอด", n.records[0]?.amount, 49);
})();

/* ================= 4) reconcile: time variance auto-pass ================= */
await (async function () {
  const r = await run([rec({ account: "SCB-1", amount: 100, sec: 3600, company: "MC8" })], [rec({ account: "SCB-1", amount: 100, sec: 3800, company: "MC8" })]);
  eq("time variance: matched=1", r.matched, 1);
  eq("time variance: ไม่เปิดเคส Audit", r.exceptions.length, 0);
  eq("time variance: เก็บวิธีจับคู่ในหลักฐาน", r.matchEvidence[0]?.method, "account-amount-direction-time-under-60m");
})();

/* คู่ยอดตรงที่ไม่กำกวม: ผ่อนเวลาได้โดยไม่เดาคู่จากยอดซ้ำ */
await (async function () {
  const extended = { ...settings, exactUniqueTolerance: 600 };
  const unique = await run(
    [rec({ account: "EXT-1", amount: 500, sec: 3600 })],
    [rec({ account: "EXT-1", amount: 500, sec: 4096 })],
    extended,
  );
  eq("extended exact: ห่าง 496 วินาทีแต่มีคู่เดียว = matched", unique.matched, 1);
  eq("extended exact: ไม่สร้าง time_diff", unique.exceptions.length, 0);

  const ambiguous = await run(
    [rec({ account: "EXT-2", amount: 100, sec: 3600, company: "MC8" }), rec({ account: "EXT-2", amount: 100, sec: 3650, company: "MC8" })],
    [rec({ account: "EXT-2", amount: 100, sec: 3900, company: "MC8" })],
    extended,
  );
  eq("extended exact: ยอดซ้ำรับผ่านตามคู่เวลาที่ใกล้สุด", ambiguous.matched, 1);
  eq("extended exact: ไม่ส่ง time_diff ให้ Audit", ambiguous.exceptions.filter((row) => row.type === "time_diff").length, 0);
})();

/* ================= 5) reconcile: amount_diff ================= */
await (async function () {
  const r = await run([rec({ account: "SCB-2", amount: 100, sec: 3600 })], [rec({ account: "SCB-2", amount: 105, sec: 3610 })]);
  eq("amount_diff: ชนิด", r.exceptions[0]?.type, "amount_diff");
  eq("amount_diff: ส่วนต่างยอด", r.exceptions[0]?.amountDiff, 5);
})();

/* คู่ยอดซ้ำที่ identity pass กันไว้ ต้องถูกลองจับใหม่ด้วย reciprocal nearest
   ก่อนแตกเป็น missing_bo + missing_stm โดยยังห้ามเดาคู่เมื่อเวลาเสมอกันหรือข้อมูลลูกค้าขัดกัน */
await (async function () {
  const s1 = rec({ account: "RESCUE-1", amount: 100, sec: 3600, company: "MC8", custAccountLast4: "3723" });
  const s2 = rec({ account: "RESCUE-1", amount: 100, sec: 7200, company: "MC8", custAccountLast4: "3723" });
  const b1 = rec({ account: "RESCUE-1", amount: 100, sec: 3610, company: "MC8", custAccount: "0012343723" });
  const b2 = rec({ account: "RESCUE-1", amount: 100, sec: 7210, company: "MC8", custAccount: "0012343723" });
  const rescued = await run([s1, s2], [b1, b2]);
  eq("rescue: reciprocal nearest จับคู่ซ้ำได้ครบ", rescued.matched, 2);
  eq("rescue: ไม่เหลือ missing สองฝั่ง", rescued.exceptions.filter((e) => ["missing_bo", "missing_stm"].includes(e.type)).length, 0);
  eq("rescue: เก็บวิธีจับคู่ในหลักฐาน", rescued.matchEvidence.filter((e) => e.method === "reciprocal-nearest-rescue").length, 2);

  const farButUnique = await run(
    [rec({ account: "RESCUE-FAR", amount: 900, sec: 2 * 3600, company: "3XB" })],
    [rec({ account: "RESCUE-FAR", amount: 900, sec: 14 * 3600, company: "3XB" })],
  );
  eq("rescue: คู่ชัดเจนปิดได้แม้ห่างเกิน 10 นาที", farButUnique.matched, 1);
  eq("rescue: คู่ชัดเจนไกลไม่เปิด missing", farButUnique.exceptions.filter((e) => ["missing_bo", "missing_stm", "time_diff"].includes(e.type)).length, 0);

  const tied = await run(
    [rec({ account: "RESCUE-TIE", amount: 100, sec: 3600, company: "MC8", custAccountLast4: "1111" })],
    [
      rec({ account: "RESCUE-TIE", amount: 100, sec: 3590, company: "MC8", custAccount: "0000001111" }),
      rec({ account: "RESCUE-TIE", amount: 100, sec: 3610, company: "MC8", custAccount: "0000001111" }),
    ],
  );
  eq("rescue: เวลาห่างเท่ากันไม่เดาคู่", tied.matched, 0);

  const conflict = await run(
    [rec({ account: "RESCUE-CONFLICT", amount: 100, sec: 3600, company: "MC8", custAccountLast4: "1111", custBank: "SCB" })],
    [rec({ account: "RESCUE-CONFLICT", amount: 100, sec: 3610, company: "MC8", custAccount: "0000002222", custBank: "KBANK" })],
  );
  eq("rescue: ข้อมูลลูกค้าขัดกันยังคงไม่จับ", conflict.matched, 0);
})();

/* Statement ที่ระบบรับเข้าและผูกบริษัทจากไฟล์แล้วเป็นแหล่งข้อมูลที่เชื่อถือได้
   ไม่ควรถูกเปิด wrong_account เพียงเพราะทะเบียนเดิมยังไม่มีเลขบัญชี */
await (async function () {
  const stm = rec({ account: "5034674009", amount: 500, sec: 3600, source_file: "MR9_STM_SCB.pdf", company: "MR9" });
  const bo = rec({ account: "5034674009", amount: 500, sec: 3605, company: "MR9" });
  const r = await run([stm], [bo], settings, [{ id: "1998218930", bank: "KBANK", company: "MR9" }]);
  eq("statement source: จับคู่สำเร็จ", r.matched, 1);
  eq("statement source: ไม่สร้าง wrong_account เท็จ", r.exceptions.filter((x) => x.type === "wrong_account").length, 0);
})();

/* ================= 6) reconcile: missing_bo ================= */
await (async function () {
  const r = await run([rec({ account: "SCB-3", amount: 50, sec: 100 })], []);
  eq("missing_bo: ชนิด", r.exceptions[0]?.type, "missing_bo");
})();

/* ================= 7) reconcile: missing_stm ================= */
await (async function () {
  const stm = [rec({ account: "SCB-4", amount: 100, sec: 1000 })];
  const bo = [rec({ account: "SCB-4", amount: 100, sec: 1000 }), rec({ account: "SCB-4", amount: 200, sec: 2000 })];
  const r = await run(stm, bo);
  eq("missing_stm: matched", r.matched, 1);
  const types = r.exceptions.map((e) => e.type);
  ok("missing_stm: มี exception missing_stm", types.includes("missing_stm"), JSON.stringify(types));
})();

/* ================= 8) SLA aging: asOf จริง vs fallback ================= */
await (async function () {
  const base = { account: "SCB-9", amount: 50, sec: 3600, date: "2026-08-01" }; // 01:00 น.
  const rFallback = await run([rec(base)], []);
  eq("aging: fallback (ปลายวัน) = 24 ชม.", rFallback.exceptions[0].ageHours, 24);

  const asOf = Date.parse("2026-08-01T05:00:00"); // 4 ชม.หลังรายการ
  const rReal = await run([rec(base)], [], { ...settings, asOf });
  eq("aging: asOf จริง = 4 ชม.", rReal.exceptions[0].ageHours, 4);
})();

/* ===== 9) ทิศทางต้องตรงกัน: ฝาก ไม่จับคู่กับ ถอน (แม้บัญชี+ยอด+เวลาตรง) ===== */
await (async function () {
  const r = await run(
    [rec({ account: "DIR-1", amount: 500, sec: 3600, direction: "deposit" })],
    [rec({ account: "DIR-1", amount: 500, sec: 3610, direction: "withdraw" })],
  );
  ok("direction: ฝากไม่จับคู่กับถอน (matched=0)", r.matched === 0, `matched=${r.matched}`);
  const types = r.exceptions.map((e) => e.type);
  ok("direction: ขึ้นเป็น exception ทั้งสองฝั่ง", types.includes("missing_bo") && types.includes("missing_stm"), JSON.stringify(types));
})();

/* ===== 10) ทิศทาง: ถอนจับคู่ถอนได้ปกติ (คุมว่าไม่ได้บล็อกการแม็ปที่ถูกต้อง) ===== */
await (async function () {
  const r = await run(
    [rec({ account: "DIR-2", amount: 300, sec: 3600, direction: "withdraw" })],
    [rec({ account: "DIR-2", amount: 300, sec: 3630, direction: "withdraw" })],
    { toleranceDeposit: 120, toleranceWithdraw: 120, minuteTolerance: 60 },
  );
  ok("direction: ถอนจับคู่ถอนได้ปกติ (matched=1)", r.matched === 1, `matched=${r.matched}`);
})();

/* ===== 11) greedy: รายการที่เวลาใกล้กว่าต้องไม่ถูกแย่ง BO โดยรายการที่อยู่ไกลกว่า ===== */
await (async function () {
  const r = await run(
    [
      rec({ account: "GR-1", amount: 500, sec: 3400, direction: "deposit" }), // ไกล (นอกเกณฑ์ 120)
      rec({ account: "GR-1", amount: 500, sec: 3650, direction: "deposit" }), // ใกล้ (ในเกณฑ์)
    ],
    [rec({ account: "GR-1", amount: 500, sec: 3600, direction: "deposit" })],
    { toleranceDeposit: 120, toleranceWithdraw: 120, minuteTolerance: 60 },
  );
  ok("greedy: รายการที่ใกล้กว่ายังแม็ปได้ (matched=1)", r.matched === 1, `matched=${r.matched}`);
})();

/* ===== 12) duplicate: ยอดเท่ากันแต่คนละเวลา = missing_stm ไม่ใช่ duplicate ===== */
await (async function () {
  const r = await run(
    [rec({ account: "DUP-1", amount: 500, sec: 32400, direction: "deposit" })],
    [
      rec({ account: "DUP-1", amount: 500, sec: 32400, direction: "deposit" }), // แม็ป
      rec({ account: "DUP-1", amount: 500, sec: 54000, direction: "deposit" }), // คนละเวลา = คนละรายการ
    ],
  );
  const types = r.exceptions.map((e) => e.type);
  ok("duplicate: ยอดเท่ากันคนละเวลา = missing_stm", types.includes("missing_stm") && !types.includes("duplicate"), JSON.stringify(types));
})();

/* ===== 13) duplicate จริง: ยอดเท่ากัน เวลาใกล้กัน ยังถูกจับเป็น duplicate ===== */
await (async function () {
  const r = await run(
    [rec({ account: "DUP-2", amount: 100, sec: 1000, direction: "deposit" })],
    [
      rec({ account: "DUP-2", amount: 100, sec: 1000, direction: "deposit" }), // แม็ป
      rec({ account: "DUP-2", amount: 100, sec: 1030, direction: "deposit" }), // ซ้ำจริง (ใกล้กัน)
    ],
  );
  const types = r.exceptions.map((e) => e.type);
  ok("duplicate จริง: ยังจับเป็น duplicate (matched=1)", r.matched === 1 && types.includes("duplicate"), `matched=${r.matched} ${JSON.stringify(types)}`);
})();

/* ===== 14) company: exception ใช้บริษัทย่อย (subco) ไม่ใช่รหัสธนาคาร ===== */
await (async function () {
  const r = await run(
    [rec({ account: "MC8-BAY", amount: 144, sec: 3600, direction: "withdraw", company: "BAY", subco: "MC8" })],
    [],
  );
  ok("company: exception.company = subco (MC8) ไม่ใช่ BAY", r.exceptions[0] && r.exceptions[0].company === "MC8", JSON.stringify(r.exceptions[0] && r.exceptions[0].company));
})();

/* ===== 15) noTime (BBL ไม่มีเวลา): ผ่อนกรอบเวลาเป็นทั้งวัน ===== */
await (async function () {
  const r = await run(
    [rec({ account: "BBL-1", amount: 100, sec: 0, noTime: true })],
    [rec({ account: "BBL-1", amount: 100, sec: 50000 })],
  );
  eq("noTime: จับคู่ได้แม้เวลาต่างกันมาก (matched=1)", r.matched, 1);
  eq("noTime: ไม่มี exception", r.exceptions.length, 0);
})();

/* ===== 16) ควบคุม: ไม่มี noTime + เวลาต่างมาก ต้องเป็น time_diff ===== */
await (async function () {
  const r = await run(
    [rec({ account: "BBL-2", amount: 100, sec: 0 })],
    [rec({ account: "BBL-2", amount: 100, sec: 50000 })],
  );
  // dt ~14 ชม. เกิน 1 ชม. -> ไม่ใช่ time_diff แต่เป็น missing_bo ; ประเด็นคือถ้าไม่มี noTime จะไม่แมตช์
  eq("noTime control: ไม่มี noTime + เวลาห่างมาก -> ไม่แมตช์ (matched=0)", r.matched, 0);
  eq("noTime control: STM ค้างเป็น missing_bo", r.exceptions[0]?.type, "missing_bo");
})();

/* ===== 17) noTime หลายรายการยอดเท่ากัน จับคู่ 1:1 ครบ ===== */
await (async function () {
  const r = await run(
    [rec({ account: "BBL-3", amount: 50, sec: 0, noTime: true }), rec({ account: "BBL-3", amount: 50, sec: 0, noTime: true })],
    [rec({ account: "BBL-3", amount: 50, sec: 10 }), rec({ account: "BBL-3", amount: 50, sec: 70000 })],
  );
  eq("noTime 1:1: matched = 2", r.matched, 2);
  eq("noTime 1:1: ไม่มี exception", r.exceptions.length, 0);
})();

await (async () => {
  const s = rec({account:'AUTOPEER',custAccount:'0012345678',amount:123,sec:7200});
  const b = rec({account:'AUTOPEER',custAccount:'0012345678',amount:123,sec:3600});
  let r = await run([s],[b]);
  eq('customer: exactly 60 minutes matches',r.customerIdentityMatched,1);
  eq('customer: only one consumed pair',r.matched,1);
  eq('customer: evidence method',r.matchEvidence[0].method,'customer-account-amount-same-day-60m');
  r=await run([s],[{...b,sec:3599}]);
  eq('customer: 60 minutes plus 1 second rejected',r.matched,0);
  r=await run([s],[{...b,sec:7200,custAccount:'9912345678'}]);
  eq('customer: same tail but different full account rejected',r.matched,0);
  r=await run([s],[b,{...b,rowNo:999,sec:3700}]);
  eq('customer: ambiguous BO not greedily matched',r.matched,0);
  r=await run([s,{...s,rowNo:998,sec:7100}],[b]);
  eq('customer: ambiguous STM not reused',r.matched,0);
  for (const patch of [{date:'2026-08-02'},{company:'OTHER'},{direction:'withdraw'},{custAccount:'5678'},{noTime:true},{amount:124}]) {
    r=await run([s],[{...b,...patch}]);
    eq('customer: disallow '+JSON.stringify(patch),r.customerIdentityMatched,0);
  }
})();

await (async () => {
  const s=rec({account:'AUTOPEER',custAccount:'0012345678',amount:123,sec:7200,timeColumn:'paymentTime',amountColumn:'realAmount'});
  const b=rec({account:'AUTOPEER',custAccount:'0012345678',amount:123,sec:7200,via:'เติมมือ',performedBy:'Meta X8',note:'รอเอกสาร'});
  const r=await run([s],[b]);
  const review=r.exceptions.find(e=>e.type==='manual_review');
  eq('manual: matched amount retained',r.matched,1);
  eq('manual: documentary review stays open',review?.status,'open');
  eq('manual: no assumed financial loss',review?.riskAmount,0);
  eq('manual: operator N preserved',review?.customerDetails.bo.performedBy,'Meta X8');
  eq('manual: note O preserved',review?.customerDetails.bo.note,'รอเอกสาร');
  eq('pair evidence: retain leading zeros',r.matchEvidence[0].customer.bo.account,'0012345678');
  eq('pair evidence: manual is not approved',r.matchEvidence[0].manualReview,true);
  eq('pair evidence: actual BO amount',r.matchEvidence[0].boAmount,123);
  eq('pair evidence: actual STM amount',r.matchEvidence[0].stmAmount,123);
  eq('pair evidence: PM time source retained',r.matchEvidence[0].stm.timeColumn,'paymentTime');
  eq('pair evidence: PM amount source retained',r.matchEvidence[0].stm.amountColumn,'realAmount');
  eq('pair evidence: missing name stays empty',r.matchEvidence[0].customer.stm.name,'');
})();

await (async () => {
  const s=rec({account:'4311918665',amount:3,sec:27000,direction:'withdraw',desc:'โอนไป KBNK x6460 น.ส. กนิชา วงศ์วานิช'});
  const b=rec({account:'4311918665',amount:3,sec:27005,direction:'withdraw',custAccount:'1251516460',custBank:'KBANK'});
  let r=await run([s],[b]);
  eq('STM description: matches customer tail',r.customerIdentityMatched,1);
  eq('STM description: tail evidence',r.matchEvidence[0].customer.stm.last4,'6460');
  eq('STM description: never invent full account',r.matchEvidence[0].customer.stm.account,'');
  eq('STM description: bank alias',r.matchEvidence[0].customer.stm.bank,'KBANK');
  eq('STM description: direction retained',r.matchEvidence[0].direction,'withdraw');
  eq('STM description: source retained',r.matchEvidence[0].customer.stm.description,s.desc);
  eq('STM description: input not mutated',s.custAccountLast4,undefined);
  for (const patch of [{custAccount:'1251519999'},{direction:'deposit'},{account:'different'},{custBank:'SCB'},{sec:30601}]) {
    r=await run([s],[{...b,...patch}]);
    eq('STM tail: reject '+JSON.stringify(patch),r.matched,0);
  }
  r=await run([s],[b,{...b,custAccount:'9999916460'}]);
  eq('STM tail: ambiguity stays unmatched',r.matched,0);
  eq('STM header: not customer identity',Engine.statementCustomer({desc:'Account No. 4311918665',account:'4311918665'}).custAccountLast4,undefined);
})();

await (async () => {
  const providerRef='6aaac4bfed5cd6e1fd9d67a6';
  const stm=rec({company:'AUTOPEER',subco:'MC8',account:'AUTOPEER',isPmChannel:true,direction:'withdraw',amount:2200,sec:100,ref:'P2C-20260916-233303-UIHHCL',transactionRef:'P2C-20260916-233303-UIHHCL',sourceId:'P2C-20260916-233303-UIHHCL',providerRef});
  const bo=rec({company:'MC8',account:'AUTOPEER',isPmChannel:true,direction:'withdraw',amount:2200,sec:80000,ref:'2718608',note:`ตรวจแล้ว Sapan: ${providerRef} | โอนจริง 2500 สำเร็จ 2200 คืน 300`});
  let r=await run([stm],[bo]);
  eq('XB provider: _id inside longer Sapan note closes despite time difference',r.matched,1);
  eq('XB provider: evidence records _id/Sapan method',r.matchEvidence[0]?.method,'xb-provider-_id-note-amount');
  eq('XB provider: evidence preserves P2C transaction id',r.matchEvidence[0]?.customer?.stm?.transactionReference,'P2C-20260916-233303-UIHHCL');
  eq('XB provider: evidence preserves 6aa provider _id',r.matchEvidence[0]?.customer?.stm?.providerReference,providerRef);
  r=await run([stm],[{...bo,note:'Sapan: 6aaac4bfed5cd6e1fd9d67ff | ข้อความอื่น'}]);
  eq('XB provider: different Sapan _id stays open',r.matched,0);
  r=await run([stm],[{...bo,amount:2201}]);
  eq('XB provider: same _id but different amount stays open',r.matched,0);

  const firstRef='6aa95a5bed5cd6e1fd9d25ce',secondRef='6aa95f3e6f7ddd65ebf18744';
  const duplicateAmountStm=[
    rec({company:'AUTOPEER',subco:'3XB',account:'AUTOPEER',isPmChannel:true,direction:'withdraw',amount:500,sec:8*3600,ref:'P2C-FIRST',providerRef:firstRef}),
    rec({company:'AUTOPEER',subco:'3XB',account:'AUTOPEER',isPmChannel:true,direction:'withdraw',amount:500,sec:21*3600,ref:'P2C-SECOND',providerRef:secondRef}),
  ];
  const duplicateAmountBo=[
    rec({company:'3XB',account:'AUTOPEER',isPmChannel:true,direction:'withdraw',amount:500,sec:8*3600+10,note:`Sapan: ${secondRef}`}),
    rec({company:'3XB',account:'AUTOPEER',isPmChannel:true,direction:'withdraw',amount:500,sec:21*3600+10,note:`Sapan: ${firstRef}`}),
  ];
  r=await run(duplicateAmountStm,duplicateAmountBo);
  eq('XB provider: duplicate amounts close both rows by _id before time matching',r.matched,2);
  eq('XB provider: duplicate amount rows both use provider id rule',r.matchEvidence.filter(e=>e.method==='xb-provider-_id-note-amount').length,2);
  eq('XB provider: duplicate amount rows leave no false exception',r.exceptions.length,0);
})();

await (async () => {
  const reference='P2C-20260920-120000-ABC123';
  const stm=rec({company:'7M',account:'AUTOPEER',isPmChannel:true,direction:'withdraw',amount:900,sec:60,memberCode:'seven-user',ref:reference});
  const bo=rec({company:'7M',account:'AUTOPEER',isPmChannel:true,direction:'withdraw',amount:900,sec:80000,memberCode:'seven-user',ref:'',note:`P2P สำเร็จจากรายการ ${reference}`});
  let r=await run([stm],[bo]);
  eq('7M provider: Ref + User + Amount closes even when time is far apart',r.matched,1);
  eq('7M provider: evidence records three-point rule',r.matchEvidence[0]?.method,'provider-ref-user-amount');
  r=await run([stm],[{...bo,memberCode:'different-user'}]);
  eq('7M provider: different user is not auto-matched',r.matched,0);
  r=await run([stm],[{...bo,amount:901}]);
  eq('7M provider: different amount is not auto-matched',r.matched,0);
  r=await run(
    [{...stm,company:'AUTOPEER',subco:'UFABET7M'}],
    [{...bo,company:'UFABET7M',subco:undefined}],
  );
  eq('7M provider: parsed provider company uses subco scope',r.matched,1);
})();

await (async () => {
  const base={company:'UFABET7M',account:'COREPAY',isPmChannel:true,direction:'deposit',amount:700,date:'2026-09-20'};
  const s1=rec({...base,sec:3600,memberCode:'',ref:''});
  const s2=rec({...base,sec:4200,memberCode:'',ref:''});
  const b1=rec({...base,sec:3630,memberCode:'',ref:'',note:''});
  const b2=rec({...base,sec:4230,memberCode:'',ref:'',note:''});
  let r=await run([s1,s2],[b1,b2],{...settings,providerNearTimeTolerance:600});
  eq('7M PM near-time: reciprocal nearest pairs close safely',r.matched,2);
  eq('7M PM near-time: evidence records fallback method',r.matchEvidence.filter(e=>e.method==='provider-amount-reciprocal-near-time').length,2);

  const tied=await run(
    [rec({...base,sec:3600,memberCode:'',ref:''})],
    [rec({...base,sec:3570,memberCode:'',ref:''}),rec({...base,sec:3630,memberCode:'',ref:''})],
    {...settings,providerNearTimeTolerance:600},
  );
  eq('7M PM near-time: tied candidates remain open',tied.matched,0);

  const conflict=await run(
    [rec({...base,sec:3600,memberCode:'user-a',ref:'REF-123456'})],
    [rec({...base,sec:3630,memberCode:'user-b',ref:'REF-999999',note:''})],
    {...settings,providerNearTimeTolerance:600},
  );
  eq('7M PM near-time: conflicting User/Ref never auto-closes',conflict.matched,0);

  const far=await run(
    [rec({...base,sec:3600,memberCode:'',ref:''})],
    [rec({...base,sec:4300,memberCode:'',ref:'',note:''})],
    {...settings,providerNearTimeTolerance:600},
  );
  eq('7M PM near-time: more than 10 minutes remains open',far.matched,0);
})();

await (async () => {
  const base={company:'AT4',subco:'AT4',isPmChannel:true,date:'2026-09-20'};
  const stm=rec({...base,account:'AUTOPEER',direction:'deposit',amount:900,sec:60,memberCode:'member-123',custAccount:'001-234-5678'});
  const bo=rec({...base,account:'AUTOPEER',direction:'deposit',amount:900,sec:80000,memberCode:'member-123',custAccount:'0012345678'});
  let r=await run([stm],[bo]);
  eq('123 AUTOPEER: member + account + deposit amount closes despite time difference',r.matched,1);
  eq('123 AUTOPEER: evidence records three-point method',r.matchEvidence[0]?.method,'sys123-member-account-amount');
  eq('123 AUTOPEER: dedicated match counter',r.sys123ProviderMatched,1);

  r=await run([stm],[{...bo,custAccount:'9999999999'}]);
  eq('123 AUTOPEER: conflicting customer account stays open',r.matched,0);
  r=await run([stm],[{...bo,memberCode:'different-member'}]);
  eq('123 AUTOPEER: conflicting member stays open',r.matched,0);

  const cyberStm=rec({...base,account:'CYBERPLUS',direction:'withdraw',amount:750,sec:60,memberCode:'cy-user',custAccount:''});
  const cyberBo=rec({...base,account:'CYBERPLUS',direction:'withdraw',amount:750,sec:70000,memberCode:'cy-user',custAccount:'9999999999'});
  r=await run([cyberStm],[cyberBo]);
  eq('123 CYBERPLUS withdrawal: member + amount closes without account',r.matched,1);
  eq('123 CYBERPLUS withdrawal: evidence records two-point method',r.matchEvidence[0]?.method,'sys123-member-amount');
  r=await run([cyberStm],[{...cyberBo,memberCode:'other-user'}]);
  eq('123 CYBERPLUS withdrawal: member mismatch stays open',r.matched,0);

  const azWithdraw=rec({...base,account:'AZPAY',direction:'withdraw',amount:500,sec:100,memberCode:'az-user',custAccount:'1234567890'});
  r=await run([azWithdraw],[{...azWithdraw,sec:101}]);
  eq('123 AZPAY withdrawal: unsupported direction is not generic auto-closed',r.matched,0);

  r=await run([stm],[bo,{...bo,rowNo:bo.rowNo+100,sec:79000}]);
  eq('123 PM: duplicate candidates outside safe time window remain open',r.matched,0);

  const repeatedStm=[
    rec({...stm,sec:3600,rowNo:1001}),
    rec({...stm,sec:4200,rowNo:1002}),
  ];
  const repeatedBo=[
    rec({...bo,sec:3660,rowNo:2001}),
    rec({...bo,sec:4260,rowNo:2002}),
  ];
  r=await run(repeatedStm,repeatedBo);
  eq('123 PM: repeated identity closes by reciprocal nearest time',r.matched,2);
  eq('123 PM: repeated identity leaves no false missing cases',r.exceptions.length,0);
  ok('123 PM: repeated identity records auditable method',r.matchEvidence.every(e=>e.method==='sys123-member-account-amount-reciprocal-nearest'));

  const tiedStm=rec({...stm,sec:3600,rowNo:3001});
  r=await run([tiedStm],[
    rec({...bo,sec:3540,rowNo:3002}),
    rec({...bo,sec:3660,rowNo:3003}),
  ]);
  eq('123 PM: equal-distance tie remains open',r.matched,0);

  r=await run([rec({...stm,sec:3600,rowNo:4001})],[
    rec({...bo,sec:3660,rowNo:4002}),
    rec({...bo,sec:8000,rowNo:4003}),
  ]);
  eq('123 PM: unique near row closes while distant duplicate remains open',r.matched,1);
  eq('123 PM: unmatched duplicate remains visible for Audit',r.exceptions.filter(e=>e.type==='missing_stm').length,1);

  const tailStm=rec({...stm,rowNo:5001,custAccount:'5678',sec:5000});
  const fullBo=rec({...bo,rowNo:5002,custAccount:'0012345678',sec:70000});
  r=await run([tailStm],[fullBo]);
  eq('123 PM: full customer account matches statement last four with member + amount',r.matched,1);
  eq('123 PM: account-tail match keeps the strict three-point method',r.matchEvidence[0]?.method,'sys123-member-account-amount');

  const missingAccountStm=rec({...stm,rowNo:5101,custAccount:'',sec:7200});
  const nearBo=rec({...bo,rowNo:5102,custAccount:'0012345678',sec:7350});
  r=await run([missingAccountStm],[nearBo],{...settings,sys123FallbackTimeTolerance:600});
  eq('123 PM: one missing identity field closes by reciprocal near time',r.matched,1);
  eq('123 PM: partial identity fallback is auditable',r.matchEvidence[0]?.method,'sys123-partial-identity-reciprocal-near-time');

  r=await run(
    [rec({...missingAccountStm,rowNo:5201,memberCode:'member-a'})],
    [rec({...nearBo,rowNo:5202,memberCode:'member-b'})],
    {...settings,sys123FallbackTimeTolerance:600},
  );
  eq('123 PM: conflicting populated member never closes through fallback',r.matched,0);

  const crossStm=[
    rec({...stm,rowNo:5301,date:'2026-09-21',sec:60}),
    rec({...stm,rowNo:5302,date:'2026-09-21',sec:180}),
  ];
  const crossBo=[
    rec({...bo,rowNo:5303,date:'2026-09-20',sec:86340}),
    rec({...bo,rowNo:5304,date:'2026-09-21',sec:240}),
  ];
  r=await run(crossStm,crossBo,{...settings,sys123DuplicateTimeTolerance:3600});
  eq('123 PM: repeated identities around midnight close by reciprocal nearest',r.matched,2);
  eq('123 PM: cross-day reciprocal evidence is retained',r.matchEvidence.filter(e=>e.crossDay).length,1);

  r=await run(
    [rec({company:'FR8',subco:'FR8',account:'4311918665',direction:'deposit',amount:100,date:'2026-09-20',sec:3600})],
    [rec({company:'FR8',subco:'FR8',account:'4311918665',direction:'deposit',amount:100,date:'2026-09-20',sec:5400})],
  );
  eq('123 bank statement: unique same-account amount within one hour closes without Audit time case',r.matched,1);
  eq('123 bank statement: time variance is evidence only',r.exceptions.length,0);
})();

/* ---------------- report ---------------- */
console.log("\nEngine unit tests");
console.log(results.join("\n"));
console.log(`\n${passed} ผ่าน, ${failed} ล้มเหลว\n`);
process.exit(failed ? 1 : 0);
