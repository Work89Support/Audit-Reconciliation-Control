"use server";

import { runCheck } from "@/lib/checker";
import { revalidatePath } from "next/cache";

// เรียกจากปุ่ม "เช็คตอนนี้" ในแอป (รันฝั่งเซิร์ฟเวอร์โดยตรง ไม่ต้องใช้ token)
export async function runManualCheck() {
  const summary = await runCheck();
  revalidatePath("/");
  revalidatePath("/links");
  revalidatePath("/incidents");
  return summary;
}
