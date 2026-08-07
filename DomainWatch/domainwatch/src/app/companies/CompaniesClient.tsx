"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";

type LineGroup = { id: string; name: string; note: string | null; isActive: boolean };
type Company = {
  id: string;
  name: string;
  note: string | null;
  isActive: boolean;
  lineGroups: LineGroup[];
  _count: { links: number };
};

export default function CompaniesClient({ initial }: { initial: Company[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [newCompany, setNewCompany] = useState("");
  const [groupInput, setGroupInput] = useState<Record<string, string>>({});

  async function addCompany() {
    if (!newCompany.trim()) return;
    setBusy(true);
    await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCompany }),
    });
    setBusy(false);
    setNewCompany("");
    router.refresh();
  }

  async function renameCompany(c: Company) {
    const name = prompt("ชื่อบริษัทใหม่", c.name);
    if (!name || name === c.name) return;
    await fetch(`/api/companies/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    router.refresh();
  }

  async function deleteCompany(c: Company) {
    if (!confirm(`ลบบริษัท "${c.name}"? ลิงก์และห้อง LINE ทั้งหมดในบริษัทนี้จะถูกลบด้วย`)) return;
    await fetch(`/api/companies/${c.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function addGroup(companyId: string) {
    const name = (groupInput[companyId] || "").trim();
    if (!name) return;
    await fetch("/api/linegroups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, name }),
    });
    setGroupInput({ ...groupInput, [companyId]: "" });
    router.refresh();
  }

  async function deleteGroup(id: string, name: string) {
    if (!confirm(`ลบห้อง "${name}"? ลิงก์ที่อยู่ในห้องนี้จะยังอยู่ในบริษัท (แต่ไม่ผูกห้อง)`)) return;
    await fetch(`/api/linegroups/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="บริษัท / ห้อง LINE"
        subtitle="จัดการบริษัทและห้อง LINE — ลิงก์ทุกอันจะสังกัดบริษัท และระบุได้ว่ามาจากห้อง LINE ไหน"
      />

      <div className="card p-4 mb-6 flex gap-2">
        <input
          className="input"
          placeholder="ชื่อบริษัทใหม่..."
          value={newCompany}
          onChange={(e) => setNewCompany(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCompany()}
        />
        <button className="btn-primary whitespace-nowrap disabled:opacity-60" disabled={busy} onClick={addCompany}>
          + เพิ่มบริษัท
        </button>
      </div>

      {initial.length === 0 && (
        <div className="card p-10 text-center text-slate-400">ยังไม่มีบริษัท — เพิ่มบริษัทแรกด้านบน</div>
      )}

      <div className="space-y-4">
        {initial.map((c) => (
          <div key={c.id} className="card p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 text-lg">🏢</div>
                <div>
                  <div className="font-semibold text-slate-800">{c.name}</div>
                  <div className="text-xs text-slate-400">
                    {c._count.links} ลิงก์ · {c.lineGroups.length} ห้อง LINE
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="text-xs text-brand-600 hover:underline" onClick={() => renameCompany(c)}>เปลี่ยนชื่อ</button>
                <button className="text-xs text-red-500 hover:underline" onClick={() => deleteCompany(c)}>ลบ</button>
              </div>
            </div>

            <div className="pl-1">
              <div className="text-xs font-medium text-slate-500 mb-2">ห้อง LINE</div>
              <div className="flex flex-wrap gap-2 mb-3">
                {c.lineGroups.length === 0 && <span className="text-xs text-slate-400">ยังไม่มีห้อง</span>}
                {c.lineGroups.map((g) => (
                  <span key={g.id} className="badge bg-brand-50 text-brand-700">
                    {g.name}
                    <button className="ml-1 text-brand-400 hover:text-red-500" onClick={() => deleteGroup(g.id, g.name)}>✕</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 max-w-md">
                <input
                  className="input py-1.5 text-sm"
                  placeholder="เพิ่มห้อง LINE เช่น ห้องแอดมิน A"
                  value={groupInput[c.id] || ""}
                  onChange={(e) => setGroupInput({ ...groupInput, [c.id]: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addGroup(c.id)}
                />
                <button className="btn-ghost text-sm whitespace-nowrap" onClick={() => addGroup(c.id)}>+ ห้อง</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
