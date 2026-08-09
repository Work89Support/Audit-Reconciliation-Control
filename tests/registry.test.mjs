/* =============================================================
   Unit tests สำหรับ Registry (mapping ชื่อไฟล์ -> บัญชี/ช่องทาง)
   รัน: node tests/registry.test.mjs
   ============================================================= */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(dir, "..", "registry.js"), "utf8");
const sb = { console };
vm.createContext(sb);
vm.runInContext(src + "\n;globalThis.__R = Registry;", sb);
const R = sb.__R;

let passed = 0, failed = 0;
const out = [];
const ok = (n, c, extra) => (c ? (passed++, out.push("  ✓ " + n)) : (failed++, out.push("  ✗ " + n + (extra ? "  → " + extra : ""))));
const eq = (n, a, b) => ok(n, a === b, `ได้ ${JSON.stringify(a)} คาดหวัง ${JSON.stringify(b)}`);

/* ---- normalizeAccount ---- */
eq("normalize: ตัดขีดออก", R.normalizeAccount("414-232277-8", "SCB"), "4142322778");
eq("normalize: TMN เติม 0 หน้า", R.normalizeAccount("812792075", "TMN"), "0812792075");

/* ---- byAccount ---- */
eq("byAccount: 4142322778 -> FR8", (R.byAccount("4142322778") || {}).subco, "FR8");
eq("byAccount: TMN 0812792075 -> 7M", (R.byAccount("0812792075") || {}).subco, "7M");

/* ---- matchFile: bank ---- */
const m1 = R.matchFile("SCB สิริพร ถอน-ฝาก 05-06-2026.pdf");
eq("bank: SCB สิริพร -> 4142322778 (FR8)", m1.match && m1.match.account, "4142322778");
const m2 = R.matchFile("KB นราธิป ถอน-ฝาก 05-06-2026.pdf"); // KB=KBANK แยกจาก KTB นราธิป
eq("bank: KB นราธิป -> KBANK/3XB", m2.match && m2.match.bank + "/" + m2.match.subco, "KBANK/3XB");
const m3 = R.matchFile("TMN รุ่งฟ้า ถอน-ฝาก 05-06-2026.pdf"); // title คุณ ติดชื่อ
eq("bank: TMN รุ่งฟ้า -> 0812792075 (7M)", m3.match && m3.match.account, "0812792075");

/* ---- matchFile: PM ---- */
const p1 = R.matchFile("3XB 12PAY ถอน 05-06-2026.csv");
eq("pm: 3XB 12PAY -> provider", p1.match && p1.match.provider, "12PAY");
eq("pm: 3XB 12PAY -> subco", p1.match && p1.match.subco, "3XB");
eq("pm: ทิศทางจากชื่อไฟล์ = withdraw", p1.direction, "withdraw");
const p2 = R.matchFile("MR9 MYPAY ฝาก 05-06-2026.csv");
eq("pm: MR9 MYPAY -> MYPAY/MR9", p2.match && p2.match.provider + "/" + p2.match.subco, "MYPAY/MR9");
const p3 = R.matchFile("รายการฝากCBY PM 05-06-2026.xlsx"); // เขียนติดกัน + ไม่มีบริษัทย่อย
ok("pm: ไม่มีบริษัทย่อย -> เตือน ambiguousSubco", !p3.match && Array.isArray(p3.ambiguousSubco), JSON.stringify(p3));

/* ---- self-match ทุกไฟล์ในทะเบียน ---- */
let good = 0, wrong = 0, none = 0, noSub = 0;
for (const a of R.ACCOUNTS) {
  const fn = a.file.replace(/ว\/ด\/ป/g, "05-06-2026");
  const r = R.matchFile(fn);
  const g = r.match && (a.source === "bank" ? r.match.account === a.account && r.match.bank === a.bank : r.match.provider === a.provider && r.match.subco === a.subco);
  if (g) good++;
  else if (r.ambiguousSubco) noSub++;
  else if (!r.match) none++;
  else wrong++;
}
ok(`self-match: ถูก ${good}/${R.ACCOUNTS.length}, ผิด ${wrong}, หาไม่เจอ ${none}`, wrong === 0 && none === 0);
ok(`self-match: PM ไม่มีบริษัทย่อย = ${noSub} (คาดว่า 6 ของ 7M)`, noSub === 6, String(noSub));

console.log("\nRegistry unit tests");
console.log(out.join("\n"));
console.log(`\n${passed} ผ่าน, ${failed} ล้มเหลว\n`);
process.exit(failed ? 1 : 0);
