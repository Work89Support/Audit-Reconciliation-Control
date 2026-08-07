import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/linegroups?companyId=... — ห้อง LINE ของบริษัท
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId") || undefined;
  const groups = await prisma.lineGroup.findMany({
    where: companyId ? { companyId } : {},
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(groups);
}

// POST /api/linegroups — เพิ่มห้อง LINE
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.companyId || !body?.name?.trim()) {
    return NextResponse.json(
      { error: "ต้องระบุ companyId และชื่อห้อง" },
      { status: 400 }
    );
  }
  const group = await prisma.lineGroup.create({
    data: {
      companyId: String(body.companyId),
      name: String(body.name).trim(),
      note: body.note?.trim() || null,
    },
  });
  return NextResponse.json(group, { status: 201 });
}
