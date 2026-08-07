import { prisma } from "@/lib/prisma";
import {
  sendTelegram,
  downAlertMessage,
  recoveredMessage,
} from "@/lib/telegram";
import type { LinkStatus } from "@prisma/client";

const TIMEOUT_MS = Number(process.env.CHECK_TIMEOUT_MS || 10000);
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

export type ProbeResult = {
  ok: boolean;
  httpCode: number | null;
  responseMs: number;
  error: string | null;
};

// ยิงเช็ค URL 1 อัน — ถือว่า "ใช้ได้" เมื่อ HTTP < 400
export async function probe(url: string): Promise<ProbeResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res: Response;
    try {
      // ลอง HEAD ก่อน (เบากว่า)
      res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "DomainWatch/1.0 (+monitoring)" },
      });
      // บางเว็บไม่รองรับ HEAD -> ลอง GET
      if (res.status === 405 || res.status === 501) {
        res = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: { "User-Agent": "DomainWatch/1.0 (+monitoring)" },
        });
      }
    } catch {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "DomainWatch/1.0 (+monitoring)" },
      });
    }
    const responseMs = Date.now() - start;
    return {
      ok: res.status < 400,
      httpCode: res.status,
      responseMs,
      error: res.status < 400 ? null : `HTTP ${res.status}`,
    };
  } catch (e: unknown) {
    const responseMs = Date.now() - start;
    const err = e as { name?: string; message?: string };
    const message =
      err?.name === "AbortError"
        ? `หมดเวลา (timeout ${TIMEOUT_MS}ms)`
        : err?.message || "เชื่อมต่อไม่ได้";
    return { ok: false, httpCode: null, responseMs, error: message };
  }
}

export type CheckSummary = {
  checked: number;
  up: number;
  down: number;
  newIncidents: number;
  recovered: number;
  ranAt: string;
};

// เช็คลิงก์ทั้งหมดที่เปิดใช้งาน + จัดการ incident + แจ้งเตือน
export async function runCheck(): Promise<CheckSummary> {
  const links = await prisma.link.findMany({ where: { isActive: true } });
  const summary: CheckSummary = {
    checked: 0,
    up: 0,
    down: 0,
    newIncidents: 0,
    recovered: 0,
    ranAt: new Date().toISOString(),
  };

  for (const link of links) {
    const result = await probe(link.url);
    const status: LinkStatus = result.ok ? "UP" : "DOWN";
    const prev = link.lastStatus;
    summary.checked++;
    if (result.ok) summary.up++;
    else summary.down++;

    const now = new Date();

    await prisma.checkLog.create({
      data: {
        linkId: link.id,
        status,
        httpCode: result.httpCode,
        responseMs: result.responseMs,
        error: result.error,
      },
    });

    await prisma.link.update({
      where: { id: link.id },
      data: {
        lastStatus: status,
        lastCheckedAt: now,
        lastHttpCode: result.httpCode,
        lastResponseMs: result.responseMs,
      },
    });

    // เปลี่ยนจากใช้ได้/ไม่รู้ -> ล่ม : เปิด incident + แจ้งเตือน
    if (status === "DOWN" && prev !== "DOWN") {
      const existingOpen = await prisma.incident.findFirst({
        where: { linkId: link.id, status: { not: "CLOSED" } },
      });
      if (!existingOpen) {
        const incident = await prisma.incident.create({
          data: { linkId: link.id, detectedAt: now, status: "OPEN" },
        });
        summary.newIncidents++;

        const msg = downAlertMessage({
          name: link.name,
          url: link.url,
          category: link.category,
          httpCode: result.httpCode,
          error: result.error,
          detectedAt: now,
          appBaseUrl: APP_BASE_URL,
        });
        const sent = await sendTelegram(msg, "all");
        if (sent.ok) {
          await prisma.incident.update({
            where: { id: incident.id },
            data: { notifiedAt: new Date() },
          });
        }
      }
    }

    // เปลี่ยนจากล่ม -> ใช้ได้ : ปิด incident + แจ้งกลับมาปกติ
    if (status === "UP" && prev === "DOWN") {
      const open = await prisma.incident.findFirst({
        where: { linkId: link.id, status: { not: "CLOSED" } },
        orderBy: { detectedAt: "desc" },
      });
      if (open) {
        const downMinutes = Math.max(
          1,
          Math.round((now.getTime() - open.detectedAt.getTime()) / 60000)
        );
        await prisma.incident.update({
          where: { id: open.id },
          data: { status: "CLOSED", resolvedAt: now },
        });
        summary.recovered++;
        await sendTelegram(
          recoveredMessage({
            name: link.name,
            url: link.url,
            downMinutes,
            appBaseUrl: APP_BASE_URL,
          }),
          "all"
        );
      }
    }
  }

  return summary;
}
