// ส่งข้อความแจ้งเตือนผ่าน Telegram Bot API
// ตั้งค่า TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, TELEGRAM_IT_CHAT_ID ใน .env

type Audience = "admin" | "it" | "all";

function chatIdsFor(audience: Audience): string[] {
  const admin = (process.env.TELEGRAM_ADMIN_CHAT_ID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const it = (process.env.TELEGRAM_IT_CHAT_ID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (audience === "admin") return admin;
  if (audience === "it") return it;
  return Array.from(new Set([...admin, ...it]));
}

export async function sendTelegram(
  text: string,
  audience: Audience = "all"
): Promise<{ ok: boolean; sent: number; skipped?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[telegram] ไม่ได้ตั้ง TELEGRAM_BOT_TOKEN — ข้ามการส่ง");
    return { ok: false, sent: 0, skipped: "no_token" };
  }

  const ids = chatIdsFor(audience);
  if (ids.length === 0) {
    console.warn(`[telegram] ไม่มี chat id สำหรับ audience=${audience}`);
    return { ok: false, sent: 0, skipped: "no_chat_id" };
  }

  let sent = 0;
  for (const chatId of ids) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        }
      );
      if (res.ok) sent++;
      else console.error("[telegram] ส่งไม่สำเร็จ", await res.text());
    } catch (e) {
      console.error("[telegram] error", e);
    }
  }
  return { ok: sent > 0, sent };
}

// ข้อความแจ้งเตือนเมื่อพบลิงก์ล่ม
export function downAlertMessage(opts: {
  name: string;
  url: string;
  category?: string | null;
  httpCode?: number | null;
  error?: string | null;
  detectedAt: Date;
  appBaseUrl: string;
}): string {
  const t = opts.detectedAt.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
  });
  const reason = opts.error || (opts.httpCode ? `HTTP ${opts.httpCode}` : "ไม่ตอบสนอง");
  return [
    `🔴 <b>ลิงก์ใช้งานไม่ได้</b>`,
    ``,
    `📌 <b>${escapeHtml(opts.name)}</b>`,
    `🏷️ หมวด: ${escapeHtml(opts.category || "ทั่วไป")}`,
    `🔗 ${escapeHtml(opts.url)}`,
    `⚠️ สาเหตุเบื้องต้น: ${escapeHtml(reason)}`,
    `🕒 ตรวจพบ: ${t}`,
    ``,
    `👉 เข้าระบบเพื่อรับเรื่อง/อัพเดตลิงก์:`,
    `${opts.appBaseUrl}/incidents`,
  ].join("\n");
}

export function recoveredMessage(opts: {
  name: string;
  url: string;
  downMinutes: number;
  appBaseUrl: string;
}): string {
  return [
    `🟢 <b>ลิงก์กลับมาใช้งานได้แล้ว</b>`,
    ``,
    `📌 <b>${escapeHtml(opts.name)}</b>`,
    `🔗 ${escapeHtml(opts.url)}`,
    `⏱️ ล่มไปประมาณ ${opts.downMinutes} นาที`,
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
