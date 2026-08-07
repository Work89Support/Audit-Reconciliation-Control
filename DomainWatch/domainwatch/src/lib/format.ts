// ตัวช่วยจัดรูปแบบ (ใช้ได้ทั้ง server/client)

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtMinutes(min: number | null | undefined): string {
  if (min === null || min === undefined) return "-";
  if (min < 60) return `${min} นาที`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} ชม.` : `${h} ชม. ${m} นาที`;
}

export function minutesBetween(a: Date | string, b: Date | string): number {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
  return Math.max(0, Math.round((db.getTime() - da.getTime()) / 60000));
}
