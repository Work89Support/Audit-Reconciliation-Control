"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "แดชบอร์ด", icon: "📊" },
  { href: "/companies", label: "บริษัท / ห้อง LINE", icon: "🏢" },
  { href: "/links", label: "Master Data ลิงก์", icon: "🔗" },
  { href: "/incidents", label: "เหตุการณ์ / KPI", icon: "🚨" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col bg-brand-800 text-white">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-brand-700">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-700 text-xl font-bold">
          D
        </div>
        <div>
          <div className="text-lg font-semibold leading-tight">DomainWatch</div>
          <div className="text-xs text-brand-200">เฝ้าดูสถานะลิงก์</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-white text-brand-800 shadow"
                  : "text-brand-100 hover:bg-brand-700"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-4 text-xs text-brand-300 border-t border-brand-700">
        เวอร์ชัน 1.0
      </div>
    </aside>
  );
}
