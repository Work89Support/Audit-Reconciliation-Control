# DomainWatch — ระบบบอทตรวจเช็คสถานะหน้าเว็บ/ลิงก์

ระบบเฝ้าดูลิงก์แบบครบวงจร: เก็บ **Master data** ของลิงก์ทั้งหมด, บอทคอยเช็คว่าลิงก์ยัง
ใช้งานได้ไหม, เมื่อล่มจะ **แจ้งเตือนผ่าน Telegram** ถึงแอดมินและไอที, จับ **KPI** เวลาการ
ตอบสนอง และมี **Dashboard** สรุปภาพรวม — ธีมน้ำเงิน-ขาว ฟอนต์ Kanit

Stack: **Next.js 14 (App Router) + TypeScript + Prisma + PostgreSQL + Tailwind + Recharts**

---

## ระบบตอบโจทย์อะไรบ้าง (ตามที่วางไว้)

0. **แยกตามบริษัท** → รองรับหลายบริษัท แต่ละบริษัทมีได้หลายห้อง LINE และหลายลิงก์
   (โครงสร้าง: บริษัท → ห้อง LINE → ลิงก์) กรองดู/วัด KPI แยกรายบริษัทได้ในทุกหน้า
1. **พนักงานไม่รู้ว่าลิงก์ใน LINE คืออะไร / หาลิงก์เสียเวลา** → หน้า *Master Data ลิงก์*
   เก็บชื่อที่เข้าใจง่าย, บริษัท, ห้อง LINE ที่มา, หมวดหมู่, ลิงก์สำรอง, หมายเหตุ ค้นหาได้ทันที
2. **เก็บว่าลิงก์ใช้ไม่ได้ตอนไหน + แจ้งเตือน + จับ KPI** → บอทเช็คทุกลิงก์ บันทึกเวลาที่ล่ม
   สร้าง *เหตุการณ์ (Incident)* และส่งแจ้งเตือน Telegram
   - **KPI แอดมิน**: ตั้งแต่ตรวจพบ/แจ้งเตือน → แอดมินกด "บันทึกลิงก์ใหม่" (จบหน้าที่แอดมิน)
     เมื่อบันทึกลิงก์ใหม่ ระบบจะอัปเดต Master data ให้บอทไปอ่านเว็บใหม่รอบถัดไปอัตโนมัติ
   - **KPI ไอที**: ตั้งแต่ตรวจพบ/แจ้งเตือน → ไอทีชี้แจงสาเหตุ + ให้ลิงก์สำรอง
3. **แจ้งเตือนผ่าน Telegram** และ UI ระบบเป็นธีม **น้ำเงิน-ขาว ฟอนต์ Kanit**
4. **Dashboard** สรุปปัญหา ภาพรวม KPI: จำนวนลิงก์/สถานะ, เหตุการณ์เปิดค้าง,
   KPI เฉลี่ยของแอดมินและไอที, กราฟเหตุการณ์รายวัน และสถานะแยกตามหมวด

---

## เริ่มใช้งานในเครื่องตัวเอง (Local + VSCode)

### 0) สิ่งที่ต้องมี
- Node.js 18+ (แนะนำ 20+)
- Docker Desktop (สำหรับรัน PostgreSQL) หรือ PostgreSQL ที่ติดตั้งเอง

### 1) ติดตั้ง dependency
```bash
npm install
```

### 2) ตั้งค่า .env
```bash
cp .env.example .env
```
แก้ค่าใน `.env` (อย่างน้อย `DATABASE_URL`; ส่วน Telegram ใส่ทีหลังได้)

### 3) รันฐานข้อมูล PostgreSQL (ใช้ Docker ที่เตรียมไว้)
```bash
docker compose up -d
```
> ถ้าใช้ PostgreSQL ของตัวเอง ให้แก้ `DATABASE_URL` ใน `.env` ให้ตรง แล้วข้ามขั้นนี้

### 4) สร้างตารางในฐานข้อมูล + ใส่ข้อมูลตัวอย่าง
```bash
npm run db:push      # สร้างตารางตาม schema
npm run db:seed      # (ไม่บังคับ) ใส่ลิงก์ตัวอย่าง 4 รายการ
```

### 5) รันเว็บ
```bash
npm run dev
```
เปิด http://localhost:3000

### 6) กดปุ่ม “▶ เช็คตอนนี้” บนแดชบอร์ด เพื่อให้บอทเริ่มเช็คลิงก์

---

## ตั้งค่า Telegram แจ้งเตือน

1. เปิด Telegram หา **@BotFather** → `/newbot` → ได้ **TOKEN**
2. เอาบอทเข้ากลุ่มแอดมิน และกลุ่มไอที (หรือแชทส่วนตัว)
3. หา **chat id**: ส่งข้อความในกลุ่ม แล้วเปิด
   `https://api.telegram.org/bot<TOKEN>/getUpdates` เพื่อดู `chat.id`
   (กลุ่มมักเป็นเลขติดลบ เช่น `-1001234567890`)
4. ใส่ค่าใน `.env`:
```
TELEGRAM_BOT_TOKEN="123456:ABC..."
TELEGRAM_ADMIN_CHAT_ID="-100..."      # ใส่หลายห้องได้ คั่นด้วย ,
TELEGRAM_IT_CHAT_ID="-100..."
```
> ถ้ายังไม่ใส่ ระบบจะทำงานปกติแต่จะข้ามการส่งแจ้งเตือน (มี log บอก)

---

## ให้บอทเช็คอัตโนมัติทุก ๆ กี่นาที

บอทจะเช็คเมื่อมีการเรียก endpoint **`/api/check`** วิธีตั้งให้อัตโนมัติ:

**ก) รันเป็นสคริปต์ + cron ของเครื่อง/เซิร์ฟเวอร์**
```bash
npm run check        # เช็ค 1 รอบ
```
ตัวอย่าง crontab (ทุก 5 นาที):
```
*/5 * * * * cd /path/to/domainwatch && /usr/bin/npm run check >> /var/log/domainwatch.log 2>&1
```

**ข) เรียกผ่าน HTTP** (เหมาะกับ uptime service ภายนอก หรือ Vercel Cron)
```
GET https://<โดเมนของคุณ>/api/check?token=<CRON_SECRET>
```
ตั้ง `CRON_SECRET` ใน `.env` เพื่อกันคนอื่นยิงมั่ว (ต้องแนบ token ให้ตรง)

---

## นำขึ้น GitHub แล้ว Deploy

### ขึ้น GitHub
```bash
git init
git add .
git commit -m "DomainWatch v1"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

### Deploy บน Vercel (แนะนำ ง่ายสุด)
1. เข้า vercel.com → New Project → เลือก repo นี้
2. ต้องมี PostgreSQL: ใช้ **Vercel Postgres**, **Neon** หรือ **Supabase** (ฟรี)
   แล้วเอา connection string มาใส่เป็น Environment Variable ชื่อ `DATABASE_URL`
3. ใส่ env อื่น ๆ: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`,
   `TELEGRAM_IT_CHAT_ID`, `CRON_SECRET`, `APP_BASE_URL` (= โดเมนที่ deploy)
4. หลัง deploy ครั้งแรก รัน migrate ให้ฐานข้อมูล:
   - ในเครื่อง ตั้ง `DATABASE_URL` ให้ชี้ DB production แล้วสั่ง `npm run db:push`
5. ไฟล์ `vercel.json` ตั้ง **Cron ทุก 5 นาที** ให้เรียก `/api/check` อยู่แล้ว
   (Vercel จะแนบ `Authorization: Bearer <CRON_SECRET>` ให้อัตโนมัติเมื่อมี env `CRON_SECRET`)

> deploy บนโฮสต์อื่น (Railway/Render/VPS) ก็ได้ ใช้ `npm run build` แล้ว `npm start`
> และตั้ง cron เรียก `/api/check` เอง

---

## โครงสร้างโปรเจกต์

```
domainwatch/
├─ prisma/
│  ├─ schema.prisma        # โครงฐานข้อมูล (Link, CheckLog, Incident, User)
│  └─ seed.ts              # ข้อมูลตัวอย่าง
├─ scripts/
│  └─ check.ts             # สคริปต์เช็คลิงก์ (ใช้กับ cron)
├─ src/
│  ├─ app/
│  │  ├─ page.tsx          # แดชบอร์ด
│  │  ├─ links/            # หน้า Master Data ลิงก์
│  │  ├─ incidents/        # หน้าเหตุการณ์ + จัดการ KPI
│  │  ├─ actions.ts        # server action ปุ่มเช็คตอนนี้
│  │  └─ api/
│  │     ├─ links/         # CRUD + import CSV
│  │     ├─ incidents/     # อัปเดตสถานะ/KPI
│  │     └─ check/         # endpoint ให้บอทเช็ค
│  ├─ components/          # Sidebar, การ์ด, กราฟ ฯลฯ
│  └─ lib/
│     ├─ checker.ts        # ตรรกะเช็คลิงก์ + สร้าง incident
│     ├─ telegram.ts       # ส่งแจ้งเตือน Telegram
│     ├─ kpi.ts            # รวมข้อมูล Dashboard
│     └─ format.ts         # จัดรูปแบบวันเวลา/นาที
├─ docker-compose.yml      # PostgreSQL สำหรับ dev
├─ vercel.json             # ตั้ง cron เช็คทุก 5 นาที
└─ .env.example
```

## เริ่มใช้งาน: สร้างบริษัทก่อน
ไปที่เมนู **บริษัท / ห้อง LINE** → เพิ่มบริษัท และเพิ่มห้อง LINE ของบริษัทนั้น
จากนั้นค่อยไปเพิ่มลิงก์ในหน้า *Master Data* (ลิงก์ทุกอันต้องสังกัดบริษัท)

## นำเข้าลิงก์จำนวนมากจาก CSV
หน้า *Master Data* มีปุ่ม “นำเข้า CSV” (เลือกบริษัทปลายทางก่อนนำเข้า) และมีปุ่มดาวน์โหลดไฟล์ตัวอย่าง
คอลัมน์ที่รองรับ: `name, url, category, lineGroup, backupUrl, note`
โดย `lineGroup` = ชื่อห้อง LINE (ถ้ายังไม่มีในบริษัทนั้น ระบบจะสร้างให้อัตโนมัติ)
(หัวคอลัมน์ภาษาไทยก็ได้ เช่น ชื่อ, ลิงก์, หมวด, ห้อง, ลิงก์สำรอง, หมายเหตุ)

---

จัดทำโครงระบบเวอร์ชัน 1.0 — พร้อมต่อยอด (เพิ่มระบบล็อกอิน/สิทธิ์, รายงานส่งออก,
บันทึก uptime %, ฯลฯ)
