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
eq("stamp: ISO พ.ศ. -> ค.ศ.", Formats.stamp("2569-07-19 10:00:00").date, "2026-07-19");
eq("stamp: ISO ค.ศ. ไม่แตะ", Formats.stamp("2026-07-19 10:00:00").date, "2026-07-19");
eq("stamp: DD/MM/YY พ.ศ. 2 หลัก", Formats.stamp("19/07/69 10:00").date, "2026-07-19");
eq("stamp: เวลาถูก", Formats.stamp("2026-07-19 10:30:15").sec, 10 * 3600 + 30 * 60 + 15);

/* ---------- Formats.pm_provider: MYPAY ถอนสำเร็จบางส่วน ---------- */
const mypayRows = [
  ["id", "amount", "provider", "status", "requestTime", "updateTime", "transferredAmount", "submitStatus"],
  ['="p2p-test"', "10000", "mypays24", "PARTIAL", "2026-08-26 07:54:04", "2026-08-26 08:55:07", "8700", "SENDED"],
];
const mypayPartial = Formats.parse("MC mypays24-report-withdraw.csv", mypayRows, "2026-08-26");
eq("MYPAY partial+sended: อ่านเป็นรายการถอน", mypayPartial.records.length, 1);
eq("MYPAY partial+sended: ใช้ยอดที่โอนจริง", mypayPartial.records[0].amount, 8700);
eq("MYPAY partial+sended: ใช้เวลาอัปเดต", mypayPartial.records[0].sec, 8 * 3600 + 55 * 60 + 7);

/* ---------- Rules: duplicate ต้องไม่ข้ามวัน ---------- */
const recBase = (o) => ({ date: "2026-08-01", boSec: 36000, sec: 36000, account: "A-1", amount: 500, direction: "deposit", memberCode: "M1", ref: "r", manual: true, raw: "raw", company: "C", username: "u", ...o });
const dupCount = (records) => Rules.run([{ records, aux: [] }], { businessRules: { dupWindowSec: 300, largeThreshold: 0 } }).exceptions.filter((e) => e.type === "duplicate").length;

eq("duplicate: คนละวัน ไม่ใช่ซ้ำ", dupCount([recBase({ date: "2026-08-01", ref: "r1" }), recBase({ date: "2026-08-02", ref: "r2" })]), 0);
eq("duplicate: วันเดียวกัน+ใกล้กัน = ซ้ำ", dupCount([recBase({ boSec: 36000, sec: 36000, ref: "r1" }), recBase({ boSec: 36100, sec: 36100, ref: "r2" })]), 1);
eq("duplicate: ref เดียวกัน ไม่นับ", dupCount([recBase({ ref: "same" }), recBase({ boSec: 36100, sec: 36100, ref: "same" })]), 0);

/* ---------- Charts.spark: กัน NaN ---------- */
ok("spark: จุดเดียว ไม่มี NaN", !Charts.spark([5]).includes("NaN"), Charts.spark([5]));
ok("spark: ว่าง คืน <svg ไม่ throw", Charts.spark([]).includes("<svg"));
ok("spark: หลายจุด ไม่มี NaN", !Charts.spark([1, 2, 3, 4]).includes("NaN"));

console.log("\nUnit tests (Formats / Rules / Charts)");
console.log(out.join("\n"));
console.log(`\n${passed} ผ่าน, ${failed} ล้มเหลว\n`);
process.exit(failed ? 1 : 0);
