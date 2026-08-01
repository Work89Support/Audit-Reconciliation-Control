# Audit AI Reconciliation

Prototype เว็บสำหรับระบบ Audit ที่สรุปจาก MOM วันที่ 1/8/2026 โดยเน้นงานตรวจสอบรายการเงินจำนวนมาก, 3-point match, queue รายการผิดปกติ, Talk to Data, KPI ตามกะ และ approval control

## ไฟล์หลัก

- `index.html` - โครงหน้าเว็บ static พร้อมฟอนต์ Kanit
- `styles.css` - design system และ responsive layout
- `app.js` - sample data และ interaction ของ Talk to Data
- `SYSTEM_REQUIREMENTS.md` - requirements จาก MOM และเอกสารงานออดิท
- `ARCHITECTURE.md` - architecture, flowchart และ database schema draft
- `IMPLEMENTATION_ROADMAP.md` - แผนพัฒนาเป็น phase

## Deploy ขึ้น GitHub Pages

1. สร้าง repository ใหม่บน GitHub
2. เปิด terminal ในโฟลเดอร์นี้ แล้วรัน:

```powershell
git init
git add .
git commit -m "Initial audit AI prototype"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

3. ใน GitHub ไปที่ `Settings` > `Pages`
4. เลือก `Deploy from a branch`
5. เลือก branch `main` และ folder `/root`
6. กด `Save`

หลังจากนั้น GitHub จะสร้าง URL สำหรับใช้งาน เช่น `https://YOUR_USERNAME.github.io/YOUR_REPO/`

## แนวทางต่อยอดระบบจริง

- เชื่อม ingestion จาก email กลางและไฟล์ CSV / Excel
- สร้าง matching engine สำหรับบัญชีธนาคาร, เวลา และจำนวนเงิน
- เพิ่ม role-based access เพื่อให้พนักงานบันทึก note ได้ แต่ลบข้อมูลไม่ได้
- เพิ่ม approval workflow สำหรับการแก้ไขรายการ
- ต่อ LLM หรือ semantic query layer สำหรับ Talk to Data
- เพิ่ม audit log และ export daily report
