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
eq("byAccount: 4311918665 -> FR8/SCB จิตติพัฒน์", [R.byAccount("4311918665")?.subco,R.byAccount("4311918665")?.bank,R.byAccount("4311918665")?.name].join("/"), "FR8/SCB/จิตติพัฒน์");
eq("byAccount: 5034674009 -> MR9/SCB คุณากร", [R.byAccount("5034674009")?.subco,R.byAccount("5034674009")?.bank,R.byAccount("5034674009")?.name].join("/"), "MR9/SCB/คุณากร");
eq("byAccount: 4201154177 -> UR9/SCB คมสัน", [R.byAccount("4201154177")?.subco,R.byAccount("4201154177")?.bank,R.byAccount("4201154177")?.name].join("/"), "UR9/SCB/คมสัน");
eq("byAccount: TMN 0812792075 -> 7M", (R.byAccount("0812792075") || {}).subco, "7M");

/* ---- matchFile: bank ---- */
const m1 = R.matchFile("SCB สิริพร ถอน-ฝาก 05-06-2026.pdf");
eq("bank: SCB สิริพร -> 4142322778 (FR8)", m1.match && m1.match.account, "4142322778");
const m2 = R.matchFile("KB นราธิป ถอน-ฝาก 05-06-2026.pdf"); // KB=KBANK แยกจาก KTB นราธิป
eq("bank: KB นราธิป -> KBANK/3XB", m2.match && m2.match.bank + "/" + m2.match.subco, "KBANK/3XB");
const m3 = R.matchFile("TMN รุ่งฟ้า ถอน-ฝาก 05-06-2026.pdf"); // title คุณ ติดชื่อ
eq("bank: TMN รุ่งฟ้า -> 0812792075 (7M)", m3.match && m3.match.account, "0812792075");
const m4 = R.matchFile("รายการถอน_KB_เพ็ญศรี_10_08_69.pdf");
eq("bank legacy: KB เพ็ญศรี -> KBANK/7M", m4.match && m4.match.bank + "/" + m4.match.subco, "KBANK/7M");
eq("bank legacy: รายการถอน -> withdraw", m4.direction, "withdraw");
const m5 = R.matchFile("UFABET7M_STM_KB_เพ็ญศรี_D_2026-08-10.pdf");
eq("bank standard D: KB เพ็ญศรี -> KBANK/7M", m5.match && m5.match.bank + "/" + m5.match.subco, "KBANK/7M");
eq("bank standard D: direction deposit", m5.direction, "deposit");
const m6 = R.matchFile("UFABET7M_STM_KB_เพ็ญศรี_W_2026-08-10.pdf");
eq("bank standard W: direction withdraw", m6.direction, "withdraw");
const m7 = R.matchFile("UFABET7M_STM_KB_เพ็ญศรี_DW_2026-08-10.pdf");
eq("bank standard DW: direction both", m7.direction, "both");
const m8 = R.matchFile("KB กิตติ W.pdf");
eq("7M: KB กิตติ W -> canonical KBANK account", m8.match && m8.match.bank + "/" + m8.match.account, "KBANK/1953583301");
const m9 = R.matchFile("UFABET7M_STM_SCB_สมภพ_DW_2026-09-27.pdf");
eq("7M: SCB สมภพ -> canonical SCB account", m9.match && m9.match.bank + "/" + m9.match.account, "SCB/5034633891");
const m10 = R.matchFile("FR8_STM_SCB_จิตติพัฒน์_DW_2026-09-27.pdf");
eq("FR8: SCB จิตติพัฒน์ -> canonical SCB account", m10.match && m10.match.bank + "/" + m10.match.account, "SCB/4311918665");
const m11 = R.matchFile("MR9_STM_SCB_คุณากร_DW_2026-09-27.pdf");
eq("MR9: SCB คุณากร -> canonical SCB account", m11.match && m11.match.bank + "/" + m11.match.account, "SCB/5034674009");
const m12 = R.matchFile("UR9_STM_SCB_คมสัน_DW_2026-09-27.pdf");
eq("UR9: SCB คมสัน -> canonical SCB account", m12.match && m12.match.bank + "/" + m12.match.account, "SCB/4201154177");
const phantom = R.matchFile("STM KTB จ.ส.อ.เอกพล D-W.pdf");
ok("7M: KTB เอกพลไม่ใช่บัญชีในทะเบียน", !phantom.match, JSON.stringify(phantom));

/* ---- matchFile: PM ---- */
const p1 = R.matchFile("3XB 12PAY ถอน 05-06-2026.csv");
eq("pm: 3XB 12PAY -> provider", p1.match && p1.match.provider, "12PAY");
eq("pm: 3XB 12PAY -> subco", p1.match && p1.match.subco, "3XB");
eq("pm: ทิศทางจากชื่อไฟล์ = withdraw", p1.direction, "withdraw");
const p2 = R.matchFile("MR9 MYPAY ฝาก 05-06-2026.csv");
eq("pm: MR9 MYPAY -> MYPAY/MR9", p2.match && p2.match.provider + "/" + p2.match.subco, "MYPAY/MR9");
const p2b = R.matchFile("SK Mypay ถอน 05-06-2026.xlsx"); // ตัวย่อ SK -> SK8 (ตัดเลขท้าย)
eq("pm: SK (ตัวย่อ) -> MYPAY/SK8", p2b.match && p2b.match.provider + "/" + p2b.match.subco, "MYPAY/SK8");
const p3 = R.matchFile("รายการฝากCBY PM 05-06-2026.xlsx"); // เขียนติดกัน + ไม่มีบริษัทย่อย
ok("pm: ไม่มีบริษัทย่อย -> เตือน ambiguousSubco", !p3.match && Array.isArray(p3.ambiguousSubco), JSON.stringify(p3));
const p4 = R.matchFile("AT4_PM_AZPAY_D_2026-08-24.xlsx");
eq("pm standard D: AZPAY/AT4", p4.match && p4.match.provider + "/" + p4.match.subco, "AZPAY/AT4");
eq("pm standard D: direction deposit", p4.direction, "deposit");
const p5 = R.matchFile("AT4_PM_AZPAY_W_2026-08-24.xlsx");
eq("pm standard W: direction withdraw", p5.direction, "withdraw");
const p6 = R.matchFile("3XB_PM_LOCALPAY_D_2026-09-17.xlsx");
eq("pm LOCALPAY: provider/subco", p6.match && p6.match.provider + "/" + p6.match.subco, "LOCALPAY/3XB");
eq("pm LOCALPAY: direction deposit", p6.direction, "deposit");

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
ok(`self-match: ผิด ${wrong} (ต้อง 0) · ถูก ${good}/${R.ACCOUNTS.length} · หาไม่เจอ ${none} · PM-no-subco ${noSub}`, wrong === 0);
ok(`self-match: แม็ปถูกเกิน 80% (${good}/${R.ACCOUNTS.length})`, good >= Math.floor(R.ACCOUNTS.length * 0.8), `${good}/${R.ACCOUNTS.length}`);

console.log("\nRegistry unit tests");
console.log(out.join("\n"));
console.log(`\n${passed} ผ่าน, ${failed} ล้มเหลว\n`);
process.exit(failed ? 1 : 0);
