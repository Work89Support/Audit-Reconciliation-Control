"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runManualCheck } from "@/app/actions";

export default function RunCheckButton() {
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function run() {
    setMsg(null);
    startTransition(async () => {
      try {
        const data = await runManualCheck();
        setMsg(`เช็คแล้ว ${data.checked} ลิงก์ · ใช้ได้ ${data.up} · ล่ม ${data.down}`);
        router.refresh();
      } catch {
        setMsg("เกิดข้อผิดพลาดในการเช็ค");
      }
      setTimeout(() => setMsg(null), 6000);
    });
  }

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
      <button onClick={run} disabled={isPending} className="btn-primary disabled:opacity-60">
        {isPending ? "กำลังเช็ค..." : "▶ เช็คตอนนี้"}
      </button>
    </div>
  );
}
