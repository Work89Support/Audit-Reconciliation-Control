import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/companies — บริษัททั้งหมด (พร้อมห้อง LINE และจำนวนลิงก์)
export async function GET() {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      lineGroups: { orderBy: { createdAt: "asc" } },
      _count: { select: { links: true } },
    },
  });
  return NextResponse.json(companies);
}

// POST /api/companies — เพิ่มบริษัท
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "ต้องระบุชื่อบริษัท" }, { status: 400 });
  }
  const company = await prisma.company.create({
    data: {
      name: String(body.name).trim(),
      note: body.note?.trim() || null,
    },
  });
  return NextResponse.json(company, { status: 201 });
}
