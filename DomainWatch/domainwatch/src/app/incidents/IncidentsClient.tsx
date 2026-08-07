"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, IncidentStatusBadge } from "@/components/ui";
import { fmtDateTime, fmtMinutes } from "@/lib/format";
import CompanyFilter from "@/components/CompanyFilter";

type Incident = {
  id: string;
  status: string;
  detectedAt: string;
  notifiedAt: string | null;
  adminAckAt: string | null;
  adminUpdatedAt: string | null;
  itAckAt: string | null;
  itResolvedAt: string | null;
  resolvedAt: string | null;
  cause: string | null;
  newUrl: string | null;
  backupUrl: string | null;
  adminResponseMin: number | null;
  itResponseMin: number | null;
  link: {
    id: string;
    name: string;
    url: string;
    category: string | null;
    company: { id: string; name: string };
  };
};

type Company = { id: string; name: string };

export default function IncidentsClient({
  initial,
  companies,
  currentCompany,
}: {
  initial: Incident[];
  companies: Company[];
  currentCompany?: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [selected, setSelected] = useState<Incident | null>(null);

  const list = initial.filter((i) => (filter === "open" ? i.status !== "CLOSED" : true));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="เหตุการณ์ & KPI"
        subtitle="ติดตามลิงก์ที่ล่ม จับเวลาการตอบสนองของแอดมินและไอที"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <CompanyFilter companies={companies} value={currentCompany} />
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              {(["open", "all"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-sm rounded-md ${filter === f ? "bg-white shadow text-brand-700 font-medium" : "text-slate-500"}`}
                >
                  {f === "open" ? "เปิดค้าง" : "ทั้งหมด"}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {list.length === 0 && (
          <div className="card p-10 text-center text-slate-400 lg:col-span-2">
            ไม่มีเหตุการณ์ในหมวดนี้
          </div>
        )}
        {list.map((i) => (
          <div key={i.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-slate-800">{i.link.name}</div>
                <div className="text-xs text-brand-600 break-all">{i.link.url}</div>
                <div className="text-xs text-slate-400 mt-1">
                  🏢 {i.link.company.name} · 🏷️ {i.link.category || "ทั่วไป"} · ตรวจพบ {fmtDateTime(i.detectedAt)}
                </div>
              </div>
              <IncidentStatusBadge status={i.status} />
            </div>

            {/* Timeline KPI */}
            <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
              <KpiPill label="แอดมินอัพเดต" value={fmtMinutes(i.adminResponseMin)} done={!!i.adminUpdatedAt} />
              <KpiPill label="ไอทีชี้แจง/สำรอง" value={fmtMinutes(i.itResponseMin)} done={!!i.itResolvedAt} />
            </div>

            {i.cause && (
              <div className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-lg p-2">
                <b>สาเหตุ (IT):</b> {i.cause}
                {i.backupUrl && <div className="text-brand-600 break-all mt-1">สำรอง: {i.backupUrl}</div>}
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
              <button className="btn-ghost text-xs py-1.5" onClick={() => setSelected(i)}>
                จัดการเคส →
              </button>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <IncidentPanel
          incident={selected}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function KpiPill({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${done ? "bg-emerald-50" : "bg-amber-50"}`}>
      <div className="text-slate-400">{label}</div>
      <div className={`font-semibold ${done ? "text-emerald-700" : "text-amber-600"}`}>
        {done ? value : "รอดำเนินการ"}
      </div>
    </div>
  );
}

function IncidentPanel({
  incident,
  onClose,
  onDone,
}: {
  incident: Incident;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [newUrl, setNewUrl] = useState(incident.newUrl || "");
  const [cause, setCause] = useState(incident.cause || "");
  const [backupUrl, setBackupUrl] = useState(incident.backupUrl || "");

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    const res = await fetch(`/api/incidents/${incident.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setBusy(false);
    if (res.ok) onDone();
    else {
      const e = await res.json();
      alert(e.error || "ทำรายการไม่สำเร็จ");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-xl p-6 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{incident.link.name}</h3>
            <div className="text-xs text-slate-400">🏢 {incident.link.company.name}</div>
            <div className="text-xs text-brand-600 break-all">{incident.link.url}</div>
          </div>
          <IncidentStatusBadge status={incident.status} />
        </div>

        {/* Timeline */}
        <div className="space-y-2 text-sm mb-5">
          <TimelineRow label="ตรวจพบล่ม" time={incident.detectedAt} active />
          <TimelineRow label="ส่งแจ้งเตือน" time={incident.notifiedAt} />
          <TimelineRow label="แอดมินรับเรื่อง" time={incident.adminAckAt} />
          <TimelineRow label="แอดมินอัพเดตลิงก์ (จบหน้าที่แอดมิน)" time={incident.adminUpdatedAt} />
          <TimelineRow label="ไอทีรับเรื่อง" time={incident.itAckAt} />
          <TimelineRow label="ไอทีชี้แจงสาเหตุ + ลิงก์สำรอง" time={incident.itResolvedAt} />
          <TimelineRow label="ปิดเคส (กลับมาใช้ได้)" time={incident.resolvedAt} />
        </div>

        {/* ส่วนแอดมิน */}
        <div className="border border-slate-100 rounded-xl p-4 mb-3">
          <div className="text-sm font-semibold text-slate-700 mb-2">👤 ส่วนของแอดมิน</div>
          {!incident.adminAckAt && (
            <button className="btn-ghost text-xs mb-3" disabled={busy} onClick={() => act("admin_ack")}>
              รับเรื่อง (เริ่มจับ KPI)
            </button>
          )}
          <label className="label">เปลี่ยนเป็นลิงก์ใหม่ (จะอัพเดตใน Master data ให้บอทอ่านใหม่)</label>
          <input className="input mb-2" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://ลิงก์ใหม่..." />
          <button
            className="btn-primary text-xs w-full disabled:opacity-60"
            disabled={busy}
            onClick={() => act("admin_update", { newUrl: newUrl || undefined })}
          >
            บันทึกลิงก์ใหม่ + จบหน้าที่แอดมิน
          </button>
        </div>

        {/* ส่วนไอที */}
        <div className="border border-slate-100 rounded-xl p-4 mb-3">
          <div className="text-sm font-semibold text-slate-700 mb-2">🛠️ ส่วนของไอที</div>
          {!incident.itAckAt && (
            <button className="btn-ghost text-xs mb-3" disabled={busy} onClick={() => act("it_ack")}>
              รับเรื่อง (เริ่มจับ KPI)
            </button>
          )}
          <label className="label">สาเหตุ</label>
          <input className="input mb-2" value={cause} onChange={(e) => setCause(e.target.value)} placeholder="เช่น โดเมนถูกบล็อก" />
          <label className="label">ลิงก์สำรองที่เตรียมให้แอดมิน</label>
          <input className="input mb-2" value={backupUrl} onChange={(e) => setBackupUrl(e.target.value)} placeholder="https://ลิงก์สำรอง..." />
          <button
            className="btn-primary text-xs w-full disabled:opacity-60"
            disabled={busy}
            onClick={() => act("it_resolve", { cause: cause || undefined, backupUrl: backupUrl || undefined })}
          >
            บันทึกสาเหตุ + ลิงก์สำรอง (จบหน้าที่ไอที)
          </button>
        </div>

        <div className="flex justify-between gap-2 mt-4">
          {incident.status !== "CLOSED" ? (
            <button className="btn-danger text-xs" disabled={busy} onClick={() => act("close")}>
              ปิดเคส (ลิงก์กลับมาใช้ได้)
            </button>
          ) : <span />}
          <button className="btn-ghost text-xs" onClick={onClose}>ปิดหน้าต่าง</button>
        </div>
      </div>
    </div>
  );
}

function TimelineRow({ label, time, active }: { label: string; time: string | null; active?: boolean }) {
  const done = !!time;
  return (
    <div className="flex items-center gap-3">
      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${done ? "bg-emerald-500" : active ? "bg-red-500" : "bg-slate-200"}`} />
      <span className={`${done ? "text-slate-700" : "text-slate-400"}`}>{label}</span>
      <span className="ml-auto text-xs text-slate-400">{time ? fmtDateTime(time) : "-"}</span>
    </div>
  );
}
