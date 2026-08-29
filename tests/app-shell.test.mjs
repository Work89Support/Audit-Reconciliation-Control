import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(root, "app.js"), "utf8");
const html = readFileSync(join(root, "index.html"), "utf8");

assert.match(app, /const DEFAULT_RANGE_FROM[\s\S]+d - 30/, "ค่าเริ่มต้นต้องครอบคลุมย้อนหลัง 30 วัน");
assert.match(app, /Exception ในคิว[\s\S]+sorted\.length/, "การ์ด Exception ต้องตรงกับรายการที่กรองแล้ว");
assert.match(app, /ขยายย้อนหลัง 90 วัน/, "หน้าไม่มีข้อมูลต้องแนะนำให้ขยายช่วงวัน");
assert.match(html, /หน้านี้ใช้ข้อมูลจริงจาก Supabase/, "หน้า login ต้องอธิบายสาเหตุที่ต้องเข้าสู่ระบบ");
assert.doesNotMatch(html, /gmail\.js/, "หน้าเว็บต้องไม่โหลดตัวอ่าน Gmail ที่เลิกใช้แล้ว");
assert.equal(existsSync(join(root, "gmail.js")), false, "ต้องลบ gmail.js ที่ไม่ได้ใช้แล้ว");
assert.equal(existsSync(join(root, "fx.js")), false, "ต้องลบ fx.js placeholder ที่ไม่ได้ใช้แล้ว");

console.log("App shell QA follow-up: 7 checks passed");
