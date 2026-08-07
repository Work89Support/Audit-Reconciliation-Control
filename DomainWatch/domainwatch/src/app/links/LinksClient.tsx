"use client";

import { useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import CompanyFilter from "@/components/CompanyFilter";

type LineGroup = { id: string; name: string };
type Company = { id: string; name: string; lineGroups: LineGroup[] };

type LinkRow = {
  id: string;
  companyId: string;
  lineGroupId: string | null;
  name: string;
  url: string;
  category: string | null;
  backupUrl: string | null;
  note: string | null;
  isActive: boolean;
  lastStatus: string;
  lastCheckedAt: string | null;
  company: { id: string; name: string };
  lineGroup: { id: string; name: string } | null;
};

type Form = {
  id: string;
  companyId: string;
  lineGroupId: string;
  name: string;
  url: string;
  category: string;
  backupUrl: string;
  note: string;
  isActive: boolean;
};

const emptyForm = (companyId: string): Form => ({
  id: "",
  companyId,
  lineGroupId: "",
  name: "",
  url: "",
  category: "",
  backupUrl: "",
  note: "",
  isActive: true,
});

export default function LinksClient({
  initialLinks,
  companies,
  currentCompany,
}: {
  initialLinks: LinkRow[];
  companies: Company[];
  currentCompany?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<Form | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const noCompany = companies.length === 0;
  const defaultCompany = currentCompany || companies[0]?.id || "";

  const links = initialLinks.filter((l) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      l.name.toLowerCase().includes(s) ||
      l.url.toLowerCase().includes(s) ||
      (l.category || "").toLowerCase().includes(s) ||
      (l.company?.name || "").toLowerCase().includes(s) ||
      (l.lineGroup?.name || "").toLowerCase().includes(s)
    );
  });

  const modalGroups =
    companies.find((c) => c.id === modal?.companyId)?.lineGroups || [];

  // จัดกลุ่มลิงก์ตามห้อง LINE ภายในบริษัท (ห้องที่ไม่ระบุจะไปอยู่กลุ่ม "ไม่ระบุห้อง")
  const groupsFor = (companyId: string) => {
    const cl = links.filter((l) => l.companyId === companyId);
    const company = companies.find((c) => c.id === companyId);
    const groups: { key: string; name: string; links: LinkRow[] }[] = [];
    (company?.lineGroups || []).forEach((g) => {
      const gl = cl.filter((l) => l.lineGroupId === g.id);
      if (gl.length) groups.push({ key: g.id, name: g.name, links: gl });
    });
    const validIds = new Set((company?.lineGroups || []).map((g) => g.id));
    const none = cl.filter((l) => !l.lineGroupId || !validIds.has(l.lineGroupId));
    if (none.length) groups.push({ key: "none", name: "ไม่ระบุห้อง", links: none });
    return groups;
  };

  const visibleCompanies = companies.filter((c) =>
    links.some((l) => l.companyId === c.id)
  );

  const renderRow = (l: LinkRow) => (
    <tr key={l.id} className="border-t border-slate-50 hover:bg-slate-50/50">
      <td className="py-3 px-4 pl-8">
        <div className="font-medium text-slate-700">{l.name}</div>
        <a href={l.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline break-all">
          {l.url}
        </a>
        {l.backupUrl && <div className="text-xs text-slate-400 break-all">สำรอง: {l.backupUrl}</div>}
      </td>
      <td className="py-3 px-4 text-slate-600">{l.category || "-"}</td>
      <td className="py-3 px-4"><StatusBadge status={l.lastStatus} /></td>
      <td className="py-3 px-4 text-slate-500 text-xs">{fmtDateTime(l.lastCheckedAt)}</td>
      <td className="py-3 px-4">
        <button
          onClick={() => toggleActive(l)}
          className={`badge ${l.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}
        >
          {l.isActive ? "เปิด" : "ปิด"}
        </button>
      </td>
      <td className="py-3 px-4 text-right whitespace-nowrap">
        <button
          className="text-brand-600 hover:underline text-xs mr-3"
          onClick={() =>
            setModal({
              id: l.id,
              companyId: l.companyId,
              lineGroupId: l.lineGroupId || "",
              name: l.name,
              url: l.url,
              category: l.category || "",
              backupUrl: l.backupUrl || "",
              note: l.note || "",
              isActive: l.isActive,
            })
          }
        >
          แก้ไข
        </button>
        <button className="text-red-500 hover:underline text-xs" onClick={() => remove(l.id, l.name)}>
          ลบ
        </button>
      </td>
    </tr>
  );

  async function save() {
    if (!modal) return;
    if (!modal.companyId) return alert("กรุณาเลือกบริษัท");
    if (!modal.name.trim() || !modal.url.trim()) return alert("กรุณากรอกชื่อและลิงก์");
    setSaving(true);
    const isEdit = !!modal.id;
    const res = await fetch(isEdit ? `/api/links/${modal.id}` : "/api/links", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...modal, lineGroupId: modal.lineGroupId || null }),
    });
    setSaving(false);
    if (res.ok) {
      setModal(null);
      router.refresh();
    } else {
      const e = await res.json();
      alert(e.error || "บันทึกไม่สำเร็จ");
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`ลบลิงก์ "${name}" ?`)) return;
    const res = await fetch(`/api/links/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  async function toggleActive(l: LinkRow) {
    await fetch(`/api/links/${l.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !l.isActive }),
    });
    router.refresh();
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Master Data ลิงก์"
        subtitle="คลังข้อมูลลิงก์ทั้งหมด รู้ทันทีว่าลิงก์ไหนคืออะไร บริษัทอะไร มาจากห้อง LINE ไหน และมีลิงก์สำรองอะไร"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <CompanyFilter companies={companies} value={currentCompany} />
            <button className="btn-ghost" disabled={noCompany} onClick={() => setImportOpen(true)}>
              ⬆ นำเข้า CSV
            </button>
            <button className="btn-primary" disabled={noCompany} onClick={() => setModal(emptyForm(defaultCompany))}>
              + เพิ่มลิงก์
            </button>
          </div>
        }
      />

      {noCompany && (
        <div className="card p-6 text-center text-slate-500 mb-4">
          ยังไม่มีบริษัท — ไปที่เมนู <b>บริษัท / ห้อง LINE</b> เพื่อเพิ่มบริษัทก่อน แล้วค่อยเพิ่มลิงก์
        </div>
      )}

      <div className="card p-4 mb-4">
        <input
          className="input"
          placeholder="ค้นหา: ชื่อ / url / หมวด / บริษัท / ห้อง LINE"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {!noCompany && links.length === 0 && (
        <div className="card p-10 text-center text-slate-400">
          ไม่พบลิงก์ — กด “เพิ่มลิงก์” หรือ “นำเข้า CSV” เพื่อเริ่ม
        </div>
      )}

      {/* จัดกลุ่มเป็นการ์ดต่อบริษัท → ซอยย่อยตามห้อง LINE */}
      <div className="space-y-5">
        {visibleCompanies.map((c) => {
          const cl = links.filter((l) => l.companyId === c.id);
          const up = cl.filter((l) => l.lastStatus === "UP").length;
          const down = cl.filter((l) => l.lastStatus === "DOWN").length;
          return (
            <div key={c.id} className="card overflow-hidden">
              {/* หัวการ์ดบริษัท */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-brand-600 text-white">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">🏢</span>
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-xs text-brand-100">{cl.length} ลิงก์</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="badge bg-white/20 text-white">ใช้ได้ {up}</span>
                  {down > 0 && <span className="badge bg-red-500 text-white">ใช้ไม่ได้ {down}</span>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 bg-slate-50">
                      <th className="py-2.5 px-4 pl-8 font-medium">ชื่อ / ลิงก์</th>
                      <th className="py-2.5 px-4 font-medium">หมวด</th>
                      <th className="py-2.5 px-4 font-medium">สถานะ</th>
                      <th className="py-2.5 px-4 font-medium">เช็คล่าสุด</th>
                      <th className="py-2.5 px-4 font-medium">เฝ้าดู</th>
                      <th className="py-2.5 px-4 font-medium text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupsFor(c.id).map((g) => (
                      <Fragment key={g.key}>
                        {/* หัวข้อย่อย: ห้อง LINE */}
                        <tr className="bg-brand-50/60">
                          <td colSpan={6} className="px-4 py-2 text-xs font-semibold text-brand-700">
                            💬 ห้อง LINE: {g.name}
                            <span className="ml-1 font-normal text-slate-400">· {g.links.length} ลิงก์</span>
                          </td>
                        </tr>
                        {g.links.map((l) => renderRow(l))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal เพิ่ม/แก้ไข */}
      {modal && (
        <Modal onClose={() => setModal(null)} title={modal.id ? "แก้ไขลิงก์" : "เพิ่มลิงก์ใหม่"}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="บริษัท *">
                <select
                  className="input"
                  value={modal.companyId}
                  onChange={(e) => setModal({ ...modal, companyId: e.target.value, lineGroupId: "" })}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="ห้อง LINE">
                <select
                  className="input"
                  value={modal.lineGroupId}
                  onChange={(e) => setModal({ ...modal, lineGroupId: e.target.value })}
                >
                  <option value="">— ไม่ระบุ —</option>
                  {modalGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="ชื่อลิงก์ *">
              <input className="input" value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} placeholder="เช่น หน้าเข้าเล่นหลัก" />
            </Field>
            <Field label="ลิงก์ (URL) *">
              <input className="input" value={modal.url} onChange={(e) => setModal({ ...modal, url: e.target.value })} placeholder="https://..." />
            </Field>
            <Field label="หมวดหมู่">
              <input className="input" value={modal.category} onChange={(e) => setModal({ ...modal, category: e.target.value })} placeholder="ทางเข้า / โปรโมชัน" />
            </Field>
            <Field label="ลิงก์สำรอง">
              <input className="input" value={modal.backupUrl} onChange={(e) => setModal({ ...modal, backupUrl: e.target.value })} placeholder="https://... (ถ้ามี)" />
            </Field>
            <Field label="หมายเหตุ">
              <textarea className="input" rows={2} value={modal.note} onChange={(e) => setModal({ ...modal, note: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button className="btn-ghost" onClick={() => setModal(null)}>ยกเลิก</button>
            <button className="btn-primary disabled:opacity-60" disabled={saving} onClick={save}>
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </Modal>
      )}

      {importOpen && (
        <ImportModal
          companies={companies}
          defaultCompany={defaultCompany}
          onClose={() => setImportOpen(false)}
          onDone={() => { setImportOpen(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function ImportModal({
  companies,
  defaultCompany,
  onClose,
  onDone,
}: {
  companies: Company[];
  defaultCompany: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [companyId, setCompanyId] = useState(defaultCompany);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function upload() {
    if (!file || !companyId) return;
    setBusy(true);
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("companyId", companyId);
    const res = await fetch("/api/links/import", { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setResult(`นำเข้าสำเร็จ ${data.imported} รายการ` + (data.errors?.length ? ` (ข้าม ${data.errors.length})` : ""));
      setTimeout(onDone, 1200);
    } else {
      setResult(data.error || "นำเข้าไม่สำเร็จ");
    }
  }

  const template =
    "name,url,category,lineGroup,backupUrl,note\nหน้าเข้าเล่นหลัก,https://example.com,ทางเข้า,ห้องแอดมิน A,https://backup.example.com,ลิงก์หลัก";

  return (
    <Modal title="นำเข้าลิงก์จาก CSV" onClose={onClose}>
      <label className="label">นำเข้าเข้าบริษัท *</label>
      <select className="input mb-3" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <p className="text-sm text-slate-500 mb-3">
        ไฟล์ CSV ต้องมีคอลัมน์อย่างน้อย <b>name</b> (ชื่อ) และ <b>url</b> (ลิงก์)
        เพิ่มได้: category, lineGroup (ชื่อห้อง LINE — ถ้ายังไม่มีจะสร้างให้อัตโนมัติ), backupUrl, note
      </p>
      <a
        className="text-sm text-brand-600 hover:underline"
        href={"data:text/csv;charset=utf-8," + encodeURIComponent(template)}
        download="domainwatch_template.csv"
      >
        ⬇ ดาวน์โหลดไฟล์ตัวอย่าง (template)
      </a>
      <div className="mt-4">
        <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
      </div>
      {result && <div className="mt-3 text-sm text-slate-600">{result}</div>}
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-ghost" onClick={onClose}>ปิด</button>
        <button className="btn-primary disabled:opacity-60" disabled={!file || !companyId || busy} onClick={upload}>
          {busy ? "กำลังนำเข้า..." : "นำเข้า"}
        </button>
      </div>
    </Modal>
  );
}
