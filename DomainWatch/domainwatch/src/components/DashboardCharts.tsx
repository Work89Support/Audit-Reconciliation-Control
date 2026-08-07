"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const BRAND = "#2563eb";
const GREEN = "#10b981";
const RED = "#ef4444";
const SLATE = "#cbd5e1";

export default function DashboardCharts({
  incidentsPerDay,
  categoryBreakdown,
  up,
  down,
  unknown,
}: {
  incidentsPerDay: { date: string; count: number }[];
  categoryBreakdown: { category: string; up: number; down: number; total: number }[];
  up: number;
  down: number;
  unknown: number;
}) {
  const pieData = [
    { name: "ใช้งานได้", value: up, color: GREEN },
    { name: "ใช้ไม่ได้", value: down, color: RED },
    { name: "ยังไม่เช็ค", value: unknown, color: SLATE },
  ].filter((d) => d.value > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* เหตุการณ์ต่อวัน */}
      <div className="card p-5 lg:col-span-2">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          จำนวนเหตุการณ์ลิงก์ล่ม (14 วันล่าสุด)
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={incidentsPerDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
              labelStyle={{ color: "#334155" }}
            />
            <Bar dataKey="count" name="เหตุการณ์" fill={BRAND} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* สัดส่วนสถานะ */}
      <div className="card p-5">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">สัดส่วนสถานะลิงก์</h2>
        {pieData.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-16">ยังไม่มีข้อมูล</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 13 }} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* แยกตามหมวด */}
      {categoryBreakdown.length > 0 && (
        <div className="card p-5 lg:col-span-3">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">สถานะแยกตามหมวด</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={categoryBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="category" tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 13 }} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="up" name="ใช้งานได้" stackId="a" fill={GREEN} radius={[0, 0, 0, 0]} />
              <Bar dataKey="down" name="ใช้ไม่ได้" stackId="a" fill={RED} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
