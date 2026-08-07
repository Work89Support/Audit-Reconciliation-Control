import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// PATCH /api/companies/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("name" in body) data.name = String(body.name).trim();
  if ("note" in body) data.note = body.note?.trim() || null;
  if ("isActive" in body) data.isActive = !!body.isActive;
  const company = await prisma.company.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(company);
}

// DELETE /api/companies/[id] — ลบบริษัท (ลบห้อง LINE + ลิงก์ในบริษัทด้วย)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.company.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: "ลบไม่สำเร็จ", detail: String(e) },
      { status: 500 }
    );
  }
}
