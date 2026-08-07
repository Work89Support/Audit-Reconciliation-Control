import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// PATCH /api/links/[id] — แก้ไขลิงก์
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of [
    "name",
    "url",
    "category",
    "backupUrl",
    "note",
  ] as const) {
    if (key in body) {
      const v = body[key];
      data[key] = typeof v === "string" ? v.trim() || null : v;
    }
  }
  if ("companyId" in body && body.companyId) data.companyId = String(body.companyId);
  if ("lineGroupId" in body) data.lineGroupId = body.lineGroupId || null;
  if ("isActive" in body) data.isActive = !!body.isActive;

  try {
    const link = await prisma.link.update({
      where: { id: params.id },
      data: data as unknown as Prisma.LinkUpdateInput,
    });
    return NextResponse.json(link);
  } catch (e) {
    return NextResponse.json(
      { error: "แก้ไขไม่สำเร็จ", detail: String(e) },
      { status: 500 }
    );
  }
}

// DELETE /api/links/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.link.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: "ลบไม่สำเร็จ", detail: String(e) },
      { status: 500 }
    );
  }
}
