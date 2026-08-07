"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Company = { id: string; name: string };

export default function CompanyFilter({
  companies,
  value,
}: {
  companies: Company[];
  value?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function change(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("company", id);
    else params.delete("company");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400">บริษัท:</span>
      <select
        className="input !w-auto py-1.5 text-sm"
        value={value || ""}
        onChange={(e) => change(e.target.value)}
      >
        <option value="">ทุกบริษัท</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
