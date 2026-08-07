import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// แปลง CSV แบบง่าย (รองรับ field ที่มีเครื่องหมายคำพูด "")
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  // ตัด BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
        // ข้าม
      } else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// map header (รองรับทั้งอังกฤษและไทย)
const HEADER_ALIASES: Record<string, string> = {
  name: "name",
  "ชื่อ": "name",
  "ชื่อลิงก์": "name",
  url: "url",
  link: "url",
  "ลิงก์": "url",
  "ลิ้งค์": "url",
  category: "category",
  "หมวด": "category",
  "หมวดหมู่": "category",
  linegroup: "lineGroup",
  "line": "lineGroup",
  "ห้อง": "lineGroup",
  "ห้องline": "lineGroup",
  "ที่มา": "lineGroup",
  backupurl: "backupUrl",
  "ลิงก์สำรอง": "backupUrl",
  "สำรอง": "backupUrl",
  note: "note",
  "หมายเหตุ": "note",
};

export async function POST(req: NextRequest) {
  let csvText = "";
  let companyId = "";
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    companyId = String(form.get("companyId") || "");
    if (file && typeof file !== "string") {
      csvText = await (file as File).text();
    }
  } else {
    const body = await req.json().catch(() => ({}));
    csvText = body.csv || "";
    companyId = body.companyId || "";
  }

  if (!companyId) {
    return NextResponse.json(
      { error: "ต้องเลือกบริษัทที่จะนำเข้า" },
      { status: 400 }
    );
  }
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return NextResponse.json({ error: "ไม่พบบริษัท" }, { status: 400 });
  }

  if (!csvText.trim()) {
    return NextResponse.json({ error: "ไม่พบข้อมูล CSV" }, { status: 400 });
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return NextResponse.json(
      { error: "CSV ต้องมีบรรทัดหัวตาราง + ข้อมูลอย่างน้อย 1 แถว" },
      { status: 400 }
    );
  }

  const header = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()] || h.trim());
  const nameIdx = header.indexOf("name");
  const urlIdx = header.indexOf("url");
  if (nameIdx === -1 || urlIdx === -1) {
    return NextResponse.json(
      { error: "ต้องมีคอลัมน์ name (ชื่อ) และ url (ลิงก์)" },
      { status: 400 }
    );
  }

  // เตรียม find-or-create ห้อง LINE ตามชื่อในไฟล์ (ภายในบริษัทนี้)
  const existingGroups = await prisma.lineGroup.findMany({ where: { companyId } });
  const groupByName = new Map<string, string>();
  for (const g of existingGroups) groupByName.set(g.name.toLowerCase(), g.id);

  const get = (r: string[], key: string) => {
    const idx = header.indexOf(key);
    return idx >= 0 ? (r[idx] || "").trim() || null : null;
  };

  type Rec = {
    companyId: string;
    lineGroupId: string | null;
    name: string;
    url: string;
    category: string;
    backupUrl: string | null;
    note: string | null;
  };
  const records: Rec[] = [];
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = (r[nameIdx] || "").trim();
    const url = (r[urlIdx] || "").trim();
    if (!name || !url) {
      errors.push(`แถว ${i + 1}: ขาดชื่อหรือ url`);
      continue;
    }
    const groupName = get(r, "lineGroup");
    let lineGroupId: string | null = null;
    if (groupName) {
      const key = groupName.toLowerCase();
      if (!groupByName.has(key)) {
        const g = await prisma.lineGroup.create({
          data: { companyId, name: groupName },
        });
        groupByName.set(key, g.id);
      }
      lineGroupId = groupByName.get(key) || null;
    }
    records.push({
      companyId,
      lineGroupId,
      name,
      url,
      category: get(r, "category") || "ทั่วไป",
      backupUrl: get(r, "backupUrl"),
      note: get(r, "note"),
    });
  }

  if (records.length === 0) {
    return NextResponse.json(
      { error: "ไม่มีข้อมูลที่นำเข้าได้", errors },
      { status: 400 }
    );
  }

  const created = await prisma.link.createMany({ data: records });
  return NextResponse.json({ imported: created.count, errors });
}
