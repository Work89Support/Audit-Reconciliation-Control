import { getDashboardData } from "@/lib/kpi";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard, IncidentStatusBadge } from "@/components/ui";
import { fmtDateTime, fmtMinutes } from "@/lib/format";
import DashboardCharts from "@/components/DashboardCharts";
import RunCheckButton from "@/components/RunCheckButton";
import CompanyFilter from "@/components/CompanyFilter";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { company?: string };
}) {
  const companyId = searchParams.company || undefined;
  const [d, companies] = await Promise.all([
    getDashboardData(companyId),
    prisma.company.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="แดชบอร์ดภาพรวม"
        subtitle="สรุปสถานะลิงก์ เหตุการณ์ และ KPI การตอบสนอง"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <CompanyFilter companies={companies} value={companyId} />
            <RunCheckButton />
          </div>
        }
      />

      {/* แถวสถานะลิงก์ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="ลิงก์ทั้งหมด" value={d.totalLinks} hint={`เฝ้าดูอยู่ ${d.activeLinks}`} tone="slate" />
        <StatCard label="ใช้งานได้" value={d.upCount} tone="green" />
        <StatCard label="ใช้ไม่ได้" value={d.downCount} tone="red" />
        <StatCard label="ยังไม่เช็ค" value={d.unknownCount} tone="slate" />
      </div>

      {/* แถว KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="เหตุการณ์เปิดค้าง"
          value={d.openIncidents}
          hint="รอแอดมิน/IT จัดการ"
          tone={d.openIncidents > 0 ? "amber" : "green"}
        />
        <StatCard label="เหตุการณ์ 30 วัน" value={d.incidents30d} tone="brand" />
        <StatCard
          label="KPI แอดมิน (เฉลี่ย)"
          value={fmtMinutes(d.avgAdminMin)}
          hint="ตรวจพบ → อัพเดตลิงก์"
          tone="brand"
        />
        <StatCard
          label="KPI ไอที (เฉลี่ย)"
          value={fmtMinutes(d.avgItMin)}
          hint="ตรวจพบ → ชี้แจง/สำรอง"
          tone="brand"
        />
      </div>

      <DashboardCharts
        incidentsPerDay={d.incidentsPerDay}
        categoryBreakdown={d.categoryBreakdown}
        up={d.upCount}
        down={d.downCount}
        unknown={d.unknownCount}
      />

      {/* สรุปแยกตามบริษัท (แสดงเมื่อดูรวมทุกบริษัท) */}
      {!companyId && d.companyBreakdown.length > 0 && (
        <div className="card p-5 mt-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">สรุปแยกตามบริษัท</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-4 font-medium">บริษัท</th>
                  <th className="py-2 pr-4 font-medium">ลิงก์</th>
                  <th className="py-2 pr-4 font-medium">ใช้ได้</th>
                  <th className="py-2 pr-4 font-medium">ใช้ไม่ได้</th>
                  <th className="py-2 pr-4 font-medium">เคสเปิดค้าง</th>
                  <th className="py-2 pr-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {d.companyBreakdown.map((c) => (
                  <tr key={c.companyId} className="border-b border-slate-50">
                    <td className="py-2.5 pr-4 font-medium text-slate-700">{c.company}</td>
                    <td className="py-2.5 pr-4 text-slate-500">{c.total}</td>
                    <td className="py-2.5 pr-4 text-emerald-600">{c.up}</td>
                    <td className="py-2.5 pr-4 text-red-600">{c.down}</td>
                    <td className="py-2.5 pr-4">
                      <span className={c.openIncidents > 0 ? "text-amber-600 font-medium" : "text-slate-400"}>
                        {c.openIncidents}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <Link href={`/?company=${c.companyId}`} className="text-xs text-brand-600 hover:underline">
                        ดูเฉพาะบริษัทนี้ →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* เหตุการณ์ล่าสุด */}
      <div className="card p-5 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">เหตุการณ์ล่าสุด</h2>
          <Link href="/incidents" className="text-sm text-brand-600 hover:underline">
            ดูทั้งหมด →
          </Link>
        </div>
        {d.recentIncidents.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">
            ยังไม่มีเหตุการณ์ — เยี่ยมมาก ทุกลิงก์ปกติ 🎉
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-4 font-medium">ลิงก์ / บริษัท</th>
                  <th className="py-2 pr-4 font-medium">สถานะ</th>
                  <th className="py-2 pr-4 font-medium">ตรวจพบ</th>
                  <th className="py-2 pr-4 font-medium">KPI แอดมิน</th>
                  <th className="py-2 pr-4 font-medium">KPI ไอที</th>
                </tr>
              </thead>
              <tbody>
                {d.recentIncidents.map((i) => (
                  <tr key={i.id} className="border-b border-slate-50">
                    <td className="py-2.5 pr-4">
                      <div className="font-medium text-slate-700">{i.linkName}</div>
                      <div className="text-xs text-slate-400">{i.company} · <span className="truncate">{i.url}</span></div>
                    </td>
                    <td className="py-2.5 pr-4"><IncidentStatusBadge status={i.status} /></td>
                    <td className="py-2.5 pr-4 text-slate-500">{fmtDateTime(i.detectedAt)}</td>
                    <td className="py-2.5 pr-4 text-slate-500">{fmtMinutes(i.adminResponseMin)}</td>
                    <td className="py-2.5 pr-4 text-slate-500">{fmtMinutes(i.itResponseMin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
