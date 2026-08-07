// ข้อมูลตัวอย่างเริ่มต้น — รัน: npm run db:seed
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.company.count();
  if (count > 0) {
    console.log(`มีบริษัทอยู่แล้ว ${count} รายการ — ข้ามการ seed`);
    return;
  }

  // บริษัท A
  const companyA = await prisma.company.create({
    data: { name: "บริษัท A", note: "ตัวอย่างบริษัทแรก" },
  });
  const a_admin = await prisma.lineGroup.create({
    data: { companyId: companyA.id, name: "ห้องแอดมิน A" },
  });
  const a_market = await prisma.lineGroup.create({
    data: { companyId: companyA.id, name: "ห้องการตลาด A" },
  });

  // บริษัท B
  const companyB = await prisma.company.create({
    data: { name: "บริษัท B", note: "ตัวอย่างบริษัทที่สอง" },
  });
  const b_admin = await prisma.lineGroup.create({
    data: { companyId: companyB.id, name: "ห้องแอดมิน B" },
  });

  await prisma.link.createMany({
    data: [
      {
        companyId: companyA.id,
        lineGroupId: a_admin.id,
        name: "หน้าเข้าเล่นหลัก",
        url: "https://example.com",
        category: "ทางเข้า",
        backupUrl: "https://example.org",
        note: "ลิงก์หลักที่ลูกค้าใช้บ่อยสุด",
      },
      {
        companyId: companyA.id,
        lineGroupId: a_market.id,
        name: "หน้าโปรโมชันเดือนนี้",
        url: "https://example.com/promo",
        category: "โปรโมชัน",
      },
      {
        companyId: companyA.id,
        lineGroupId: a_admin.id,
        name: "หน้าสมัครสมาชิก",
        url: "https://httpstat.us/503",
        category: "สมัคร",
        note: "ตัวอย่างลิงก์ที่จะขึ้นสถานะล่ม (503) เพื่อทดสอบระบบ",
      },
      {
        companyId: companyB.id,
        lineGroupId: b_admin.id,
        name: "หน้าคู่มือการใช้งาน",
        url: "https://example.net",
        category: "ทั่วไป",
      },
      {
        companyId: companyB.id,
        lineGroupId: b_admin.id,
        name: "หน้าทางเข้าสำรอง",
        url: "https://httpstat.us/200",
        category: "ทางเข้า",
      },
    ],
  });

  console.log("seed สำเร็จ — บริษัท 2, ห้อง LINE 3, ลิงก์ 5 รายการ");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
