import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type DashboardData = {
  totalLinks: number;
  activeLinks: number;
  upCount: number;
  downCount: number;
  unknownCount: number;
  openIncidents: number;
  incidents30d: number;
  avgAdminMin: number | null;
  avgItMin: number | null;
  categoryBreakdown: { category: string; up: number; down: number; total: number }[];
  companyBreakdown: {
    companyId: string;
    company: string;
    total: number;
    up: number;
    down: number;
    openIncidents: number;
  }[];
  incidentsPerDay: { date: string; count: number }[];
  recentIncidents: {
    id: string;
    linkName: string;
    company: string;
    url: string;
    status: string;
    detectedAt: string;
    adminResponseMin: number | null;
    itResponseMin: number | null;
  }[];
};

// companyId = undefined => รวมทุกบริษัท
export async function getDashboardData(companyId?: string): Promise<DashboardData> {
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const linkWhere: Prisma.LinkWhereInput = companyId ? { companyId } : {};
  const incWhere: Prisma.IncidentWhereInput = companyId
    ? { link: { companyId } }
    : {};

  const [links, companies, openIncidents, incidents30d, closedWithKpi, recent] =
    await Promise.all([
      prisma.link.findMany({ where: linkWhere, include: { company: true } }),
      prisma.company.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.incident.count({ where: { ...incWhere, status: { not: "CLOSED" } } }),
      prisma.incident.count({ where: { ...incWhere, detectedAt: { gte: since30 } } }),
      prisma.incident.findMany({
        where: { ...incWhere, detectedAt: { gte: since30 } },
        select: { adminResponseMin: true, itResponseMin: true },
      }),
      prisma.incident.findMany({
        where: incWhere,
        orderBy: { detectedAt: "desc" },
        take: 8,
        include: { link: { include: { company: true } } },
      }),
    ]);

  const upCount = links.filter((l) => l.lastStatus === "UP").length;
  const downCount = links.filter((l) => l.lastStatus === "DOWN").length;
  const unknownCount = links.filter((l) => l.lastStatus === "UNKNOWN").length;
  const activeLinks = links.filter((l) => l.isActive).length;

  const adminVals = closedWithKpi
    .map((i) => i.adminResponseMin)
    .filter((v): v is number => v !== null);
  const itVals = closedWithKpi
    .map((i) => i.itResponseMin)
    .filter((v): v is number => v !== null);
  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  // แยกตามหมวด
  const catMap = new Map<string, { up: number; down: number; total: number }>();
  for (const l of links) {
    const c = l.category || "ทั่วไป";
    const cur = catMap.get(c) || { up: 0, down: 0, total: 0 };
    cur.total++;
    if (l.lastStatus === "UP") cur.up++;
    if (l.lastStatus === "DOWN") cur.down++;
    catMap.set(c, cur);
  }
  const categoryBreakdown = Array.from(catMap.entries()).map(([category, v]) => ({
    category,
    ...v,
  }));

  // แยกตามบริษัท (เฉพาะเมื่อดูรวมทุกบริษัท จะได้เห็นภาพเทียบกัน)
  const openByCompany = new Map<string, number>();
  const openList = await prisma.incident.findMany({
    where: { status: { not: "CLOSED" } },
    select: { link: { select: { companyId: true } } },
  });
  for (const o of openList) {
    const cid = o.link.companyId;
    openByCompany.set(cid, (openByCompany.get(cid) || 0) + 1);
  }
  const companyBreakdown = companies
    .map((co) => {
      const cl = links.filter((l) => l.companyId === co.id);
      return {
        companyId: co.id,
        company: co.name,
        total: cl.length,
        up: cl.filter((l) => l.lastStatus === "UP").length,
        down: cl.filter((l) => l.lastStatus === "DOWN").length,
        openIncidents: openByCompany.get(co.id) || 0,
      };
    })
    .filter((c) => (companyId ? c.companyId === companyId : true));

  // incident ต่อวัน 14 วันล่าสุด
  const since14 = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
  const incs14 = await prisma.incident.findMany({
    where: { ...incWhere, detectedAt: { gte: since14 } },
    select: { detectedAt: true },
  });
  const dayMap = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(since14.getTime() + i * 24 * 60 * 60 * 1000);
    dayMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const inc of incs14) {
    const key = inc.detectedAt.toISOString().slice(0, 10);
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) || 0) + 1);
  }
  const incidentsPerDay = Array.from(dayMap.entries()).map(([date, count]) => ({
    date: date.slice(5),
    count,
  }));

  return {
    totalLinks: links.length,
    activeLinks,
    upCount,
    downCount,
    unknownCount,
    openIncidents,
    incidents30d,
    avgAdminMin: avg(adminVals),
    avgItMin: avg(itVals),
    categoryBreakdown,
    companyBreakdown,
    incidentsPerDay,
    recentIncidents: recent.map((i) => ({
      id: i.id,
      linkName: i.link.name,
      company: i.link.company.name,
      url: i.link.url,
      status: i.status,
      detectedAt: i.detectedAt.toISOString(),
      adminResponseMin: i.adminResponseMin,
      itResponseMin: i.itResponseMin,
    })),
  };
}
