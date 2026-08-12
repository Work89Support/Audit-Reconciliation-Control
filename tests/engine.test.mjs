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

/* engine.js เป็น IIFE: `const Engine = (() => {...})()`
   ประเมินในกล่อง sandbox แล้วดึงตัวแปร Engine ออกมา
   (โค้ดใช้ typeof Formats/XlsxReader/XLSX แบบ guard อยู่แล้ว จึงไม่ต้อง stub) */
const sandbox = { performance, console };
vm.createContext(sandbox);
vm.runInContext(engineSrc + "\n;globalThis.__Engine = Engine;", sandbox);
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
const run = (stm, bo, s = settings) => Engine.reconcile(stm, bo, s, [], null);

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
})();

/* ================= 3) reconcile: exact match ================= */
await (async function () {
  const r = await run([rec({ account: "SCB-1", amount: 100, sec: 3600 })], [rec({ account: "SCB-1", amount: 100, sec: 3630 })]);
  eq("exact: matched", r.matched, 1);
  eq("exact: ไม่มี exception", r.exceptions.length, 0);
  eq("exact: matchRate", Math.round(r.matchRate), 100);
})();

/* ================= 4) reconcile: time_diff ================= */
await (async function () {
  const r = await run([rec({ account: "SCB-1", amount: 100, sec: 3600 })], [rec({ account: "SCB-1", amount: 100, sec: 3800 })]);
  eq("time_diff: matched=0", r.matched, 0);
  eq("time_diff: 1 exception", r.exceptions.length, 1);
  eq("time_diff: ชนิด", r.exceptions[0].type, "time_diff");
})();

/* ================= 5) reconcile: amount_diff ================= */
await (async function () {
  const r = await run([rec({ account: "SCB-2", amount: 100, sec: 3600 })], [rec({ account: "SCB-2", amount: 105, sec: 3610 })]);
  eq("amount_diff: ชนิด", r.exceptions[0]?.type, "amount_diff");
  eq("amount_diff: ส่วนต่างยอด", r.exceptions[0]?.amountDiff, 5);
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

/* ---------------- report ---------------- */
console.log("\nEngine unit tests");
console.log(results.join("\n"));
console.log(`\n${passed} ผ่าน, ${failed} ล้มเหลว\n`);
process.exit(failed ? 1 : 0);
