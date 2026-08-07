import React from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "brand",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "brand" | "green" | "red" | "slate" | "amber";
}) {
  const tones: Record<string, string> = {
    brand: "text-brand-700",
    green: "text-emerald-600",
    red: "text-red-600",
    slate: "text-slate-700",
    amber: "text-amber-600",
  };
  return (
    <div className="card p-5">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-2 text-3xl font-bold ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    UP: { text: "ใช้งานได้", cls: "bg-emerald-50 text-emerald-700" },
    DOWN: { text: "ใช้ไม่ได้", cls: "bg-red-50 text-red-600" },
    UNKNOWN: { text: "ยังไม่เช็ค", cls: "bg-slate-100 text-slate-500" },
  };
  const s = map[status] || map.UNKNOWN;
  return <span className={`badge ${s.cls}`}>● {s.text}</span>;
}

export function IncidentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    OPEN: { text: "เปิด (รอจัดการ)", cls: "bg-red-50 text-red-600" },
    ADMIN_UPDATED: { text: "แอดมินอัพเดตแล้ว", cls: "bg-amber-50 text-amber-700" },
    IT_RESOLVED: { text: "IT ชี้แจงแล้ว", cls: "bg-brand-50 text-brand-700" },
    CLOSED: { text: "ปิดเคส", cls: "bg-emerald-50 text-emerald-700" },
  };
  const s = map[status] || map.OPEN;
  return <span className={`badge ${s.cls}`}>{s.text}</span>;
}
