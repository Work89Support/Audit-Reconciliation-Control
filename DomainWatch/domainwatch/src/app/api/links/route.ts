import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/links?companyId=... — รายการลิงก์ (กรองตามบริษัทได้)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId") || undefined;
  const links = await prisma.link.findMany({
    where: companyId ? { companyId } : {},
    orderBy: { createdAt: "desc" },
    include: { company: true, lineGroup: true },
  });
  return NextResponse.json(links);
}

// POST /api/links — เพิ่มลิงก์ใหม่
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.name || !body?.url || !body?.companyId) {
    return NextResponse.json(
      { error: "ต้องระบุ companyId, name และ url" },
      { status: 400 }
    );
  }
  try {
    const link = await prisma.link.create({
      data: {
        companyId: String(body.companyId),
        lineGroupId: body.lineGroupId || null,
        name: String(body.name).trim(),
        url: String(body.url).trim(),
        category: body.category?.trim() || "ทั่วไป",
        backupUrl: body.backupUrl?.trim() || null,
        note: body.note?.trim() || null,
        isActive: body.isActive ?? true,
      },
    });
    return NextResponse.json(link, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "บันทึกไม่สำเร็จ", detail: String(e) },
      { status: 500 }
    );
  }
}
