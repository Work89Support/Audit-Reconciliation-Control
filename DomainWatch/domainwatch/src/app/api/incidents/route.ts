import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/incidents?status=open|all&companyId=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "all";
  const companyId = url.searchParams.get("companyId") || undefined;
  const where: Prisma.IncidentWhereInput = {
    ...(status === "open" ? { status: { not: "CLOSED" } } : {}),
    ...(companyId ? { link: { companyId } } : {}),
  };

  const incidents = await prisma.incident.findMany({
    where,
    orderBy: { detectedAt: "desc" },
    take: 200,
    include: { link: { include: { company: true } } },
  });
  return NextResponse.json(incidents);
}
