// สคริปต์เช็คลิงก์แบบ standalone — ใช้กับ cron ของเครื่อง/เซิร์ฟเวอร์
// รัน: npm run check   (หรือ tsx scripts/check.ts)
import { runCheck } from "../src/lib/checker";

async function main() {
  console.log(`[DomainWatch] เริ่มเช็ค ${new Date().toISOString()}`);
  const summary = await runCheck();
  console.log("[DomainWatch] เสร็จสิ้น:", JSON.stringify(summary, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error("[DomainWatch] error:", e);
  process.exit(1);
});
