# Implementation Roadmap

## Phase 0 - Prototype & Scope Lock

- สรุป requirement จากเอกสารออดิท
- ทำ clickable static prototype สำหรับคุย scope
- ยืนยัน data source จริงและตัวอย่างไฟล์ 1 เดือน
- นิยาม exception type และ role permission

## Phase 1 - MVP Reconciliation

ระยะเวลาแนะนำ: 4-6 สัปดาห์

- Upload / import ไฟล์ Excel, CSV, PDF copy text
- Intake checklist รายวัน
- Parser สำหรับ STM / BO รูปแบบหลัก
- Rule engine สำหรับ SCB, KBANK, GSB
- 3-point match: account, time, amount
- Exception queue
- Manual note และ audit log
- Daily report export

## Phase 2 - PM & Damage Workflow

ระยะเวลาแนะนำ: 3-5 สัปดาห์

- เพิ่ม PM account: AUTOPEER, AZPAY, Cyberplus
- กรองเฉพาะรายการสำเร็จ
- รองรับวันที่ปนและรายการข้ามวัน
- Clarification workflow ให้หัวหน้ากะตอบชี้แจง
- Evidence attachment
- Damage register
- รอบชี้แจง 1-15, 16-25, 26-สิ้นเดือน
- Monthly report ส่ง Finance / HR

## Phase 3 - Analytics & Talk to Data

ระยะเวลาแนะนำ: 3-4 สัปดาห์

- Dashboard รายวัน / รายเดือน
- KPI ตาม employee, username, shift, company
- Trend รายไตรมาสและรายปี
- Talk to Data ภาษาไทย
- คำตอบพร้อม reference กลับไปยัง evidence
- Fraud risk scoring เบื้องต้น

## Phase 4 - Automation & Hardening

ระยะเวลาแนะนำ: 4-6 สัปดาห์

- Email ingestion อัตโนมัติ
- Scheduled reconcile
- Notification เมื่อไฟล์ขาดหรือพบ exception severity สูง
- Permission hardening
- Encryption / backup / retention
- Performance tuning สำหรับ 100,000-200,000 transactions ต่อวัน
- UAT และ training ทีม Audit

## Recommended Tech Stack

- Frontend: React หรือ Next.js, Kanit font, role-based dashboard
- Backend: Node.js/NestJS หรือ Python/FastAPI
- Database: PostgreSQL
- Queue: Redis / BullMQ หรือ Cloud task queue
- File Storage: S3-compatible / GitHub ไม่ควรเก็บข้อมูลจริง
- AI Layer: semantic query + controlled SQL generation + evidence citation
- Deploy Prototype: GitHub Pages
- Deploy Production: Cloud VM, managed container, หรือ Vercel/Supabase ตาม security policy

## Acceptance Criteria

- Import ข้อมูล 1 วันครบและตรวจไฟล์ขาดได้
- Match รายการฝาก-ถอนอย่างน้อย 95% ในกลุ่มข้อมูลที่ format ถูกต้อง
- Exception queue แสดงรายการ missing/diff พร้อมหลักฐานย้อนกลับ
- Audit Monitor ใส่ note ได้แต่ลบข้อมูลไม่ได้
- Audit Lead อนุมัติ/ปิดเคสได้
- Monthly damage report export ได้
- ทุก action สำคัญมี audit log
