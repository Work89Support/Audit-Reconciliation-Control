import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { minutesBetween } from "@/lib/format";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/incidents/[id]
 * body: { action, ...fields }
 * action:
 *  - admin_ack      : แอดมินกดรับเรื่อง
 *  - admin_update   : แอดมินอัพเดตลิงก์ใหม่ในระบบ (จบหน้าที่แอดมิน) -> อัพเดต url ของ Link ด้วย
 *  - it_ack         : IT รับเรื่อง
 *  - it_resolve     : IT ชี้แจงสาเหตุ + ให้ลิงก์สำรอง
 *  - close          : ปิดเคส
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const action = body.action as string;
  const incident = await prisma.incident.findUnique({
    where: { id: params.id },
    include: { link: true },
  });
  if (!incident) {
    return NextResponse.json({ error: "ไม่พบเหตุการณ์" }, { status: 404 });
  }

  const now = new Date();
  // ฐานเวลาในการคิด KPI = เวลาที่แจ้งเตือน (ถ้ามี) มิฉะนั้นใช้เวลาที่ตรวจพบ
  const baseTime = incident.notifiedAt || incident.detectedAt;

  const data: Record<string, unknown> = {};

  switch (action) {
    case "admin_ack":
      data.adminAckAt = incident.adminAckAt || now;
      if (body.adminUserId) data.adminUserId = body.adminUserId;
      break;

    case "admin_update": {
      data.adminUpdatedAt = now;
      data.status = "ADMIN_UPDATED";
      data.adminResponseMin = minutesBetween(baseTime, now);
      if (!incident.adminAckAt) data.adminAckAt = now;
      if (body.newUrl) data.newUrl = String(body.newUrl).trim();
      if (body.adminUserId) data.adminUserId = body.adminUserId;
      // อัพเดต url หลักของลิงก์ เพื่อให้บอทอ่านเว็บใหม่รอบถัดไป
      if (body.newUrl) {
        await prisma.link.update({
          where: { id: incident.linkId },
          data: {
            url: String(body.newUrl).trim(),
            lastStatus: "UNKNOWN", // ให้บอทเช็คใหม่รอบหน้า
          },
        });
      }
      break;
    }

    case "it_ack":
      data.itAckAt = incident.itAckAt || now;
      if (body.itUserId) data.itUserId = body.itUserId;
      break;

    case "it_resolve": {
      data.itResolvedAt = now;
      data.itResponseMin = minutesBetween(baseTime, now);
      if (!incident.itAckAt) data.itAckAt = now;
      if (incident.status === "OPEN") data.status = "IT_RESOLVED";
      if (body.cause) data.cause = String(body.cause).trim();
      if (body.backupUrl) data.backupUrl = String(body.backupUrl).trim();
      if (body.itUserId) data.itUserId = body.itUserId;
      // เก็บลิงก์สำรองไว้ที่ master data ของลิงก์ด้วย
      if (body.backupUrl) {
        await prisma.link.update({
          where: { id: incident.linkId },
          data: { backupUrl: String(body.backupUrl).trim() },
        });
      }
      break;
    }

    case "close":
      data.status = "CLOSED";
      data.resolvedAt = incident.resolvedAt || now;
      break;

    default:
      return NextResponse.json(
        { error: "action ไม่ถูกต้อง" },
        { status: 400 }
      );
  }

  const updated = await prisma.incident.update({
    where: { id: params.id },
    data: data as unknown as Prisma.IncidentUpdateInput,
    include: { link: true },
  });
  return NextResponse.json(updated);
}
