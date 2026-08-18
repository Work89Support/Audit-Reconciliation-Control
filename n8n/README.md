# n8n — Gmail ingestion

ชุดนี้แยกงานเป็น 2 workflow เพื่อให้เมลใหม่ไม่ต้องรอ backfill:

- `audit-mail-ingest.json` รับเมลใหม่ เก็บไฟล์ใน Supabase Storage บันทึก `mail_batches`/`source_files` แล้วติด label `ingested`
- `audit-mail-backfill.json` ค้นเมลเก่าทีละช่วงวัน จำกัดรอบละ 20 เมล และส่งทีละเมลเข้า workflow แรก
- `audit-daily-reconcile.json` ตรวจความครบถ้วนและจัดคิวกระทบยอดทุก 10 นาที รวมไฟล์มาช้าและงานที่เลยเวลาปิดรับ
- `audit-headless-worker.json` อ่าน PDF/Excel/CSV จาก Storage, กระทบยอด, บันทึก Exception และปิดคิวบน n8n Cloud โดยไม่ต้องเปิดหน้าเว็บ

## ตั้งค่าครั้งแรก

1. รัน `supabase/schema.sql` ใน Supabase SQL Editor และสร้าง private bucket ชื่อ `audit-files`.
2. ใน n8n สร้าง Gmail OAuth2 credential และ **Supabase API** credential โดยใส่ Project URL ใน `Host` และ secret/service-role key ใน `Secret Key`.
3. สร้าง n8n Variable เฉพาะ `SUPABASE_URL`. ห้ามสร้าง `SUPABASE_SERVICE_KEY` เป็น Variable และห้ามวาง key เป็นข้อความใน Code หรือ HTTP node.
4. ใน Gmail สร้าง label `ingested`, เปิดรายละเอียด label ใน n8n แล้วแทน `REPLACE_INGESTED_LABEL_ID` ใน node **Gmail: ติด label ingested** ด้วย ID จริง.
5. Import `audit-mail-ingest.json`, เลือก credential Gmail/Supabase ให้ทุก node แล้ว Save. ยังไม่ต้อง Active.
6. ทดสอบเมล 1 ฉบับด้วย Execute Node/Workflow. ตรวจว่ามี 1 แถวใน `mail_batches`, จำนวนแถวใน `source_files` ตรงกับไฟล์หลังแตก zip, object เปิดได้ และ Gmail มี label `ingested`.
7. เมื่อผ่านแล้วจึง Active workflow live.

## งานกระทบยอดรายวัน

1. หลังรัน `supabase/schema.sql` ให้ Import `audit-daily-reconcile.json`.
2. เลือก Supabase credential ที่ node **Supabase: ตรวจไฟล์และจัดคิว** แล้วกดทดสอบด้วยมือ 1 ครั้ง.
3. ตรวจหน้า Cloud ว่ามีตาราง **คิวกระทบยอดอัตโนมัติ** และสถานะตรงกับไฟล์จริง.
4. เปิด Active. Workflow จะตรวจย้อนหลัง 14 วันทุก 10 นาที: ไฟล์ครบจะเข้าคิว, ไฟล์ไม่ครบหลังเวลาปิดรับจะเป็น `needs_review`, และไฟล์ที่มาหลังรันสำเร็จจะเข้าคิวซ้ำ.
5. Import `audit-headless-worker.json`, เลือก Supabase credential เดิมให้ทุก HTTP node แล้วทดสอบด้วยมือ. Worker จะทำสูงสุด 5 งานต่อ execution และรองรับ PDF/XLSX/XLSM/XLS/CSV.
6. เมื่อทดสอบผ่าน ให้ Publish. Worker จะรันทุก 10 นาทีบน n8n Cloud แม้ปิดหน้าเว็บหรือออกจากระบบหน้า Audit แล้ว.
7. ไฟล์ PDF ต้องเป็น PDF ที่เลือกข้อความได้; ไฟล์สแกนภาพต้องผ่าน OCR ก่อนจึงอ่านรายการได้.

ทะเบียนผู้ส่งจริงอยู่ใน `mail_sources` และตั้งค่าผ่าน Supabase SQL Editor เท่านั้น เพื่อไม่ให้อีเมลส่วนบุคคลติดไปกับ source code สาธารณะ. แก้ชนิดรายงานที่คาดหวังได้ในตารางนี้โดยไม่ต้องแก้ workflow.

## Backfill เมลเก่า

1. Import `audit-mail-backfill.json` และเลือก Gmail credential.
2. ที่ node **ส่งเข้า Workflow Live** เลือก workflow live ที่ import ในขั้นก่อนหน้า (แทน placeholder workflow ID).
3. ตั้ง Variables `BACKFILL_AFTER` และ `BACKFILL_BEFORE` เป็น `YYYY/MM/DD`. Gmail ใช้ช่วง `after` แบบไม่รวมขอบต้น และ `before` แบบไม่รวมขอบปลาย จึงควรเดินช่วงละ 1–3 วันและตรวจยอดทุกช่วง.
4. กด Execute Workflow. หนึ่งรอบดึงไม่เกิน 20 เมล, ทำทีละเมล และพัก 2 วินาที. รันซ้ำจนผลค้นหาเป็น 0 แล้วจึงเลื่อนช่วงวัน.
5. เริ่มจากช่วงล่าสุดที่มีข้อมูลน้อยก่อน 1 รอบ จากนั้นค่อยไล่ย้อนหลัง. ถ้า execution ล้ม ให้แก้สาเหตุแล้วรันช่วงเดิมซ้ำได้ เพราะ path ผูกกับ Gmail Message ID และฐานข้อมูล upsert.

## เกณฑ์ก่อนเปิดทั้งชุด

- จำนวน `mail_batches` เท่ากับจำนวนเมลที่ติด label `ingested` ในช่วงทดสอบ
- `sum(mail_batches.file_count)` เทียบกับจำนวนไฟล์ต้นทางได้ และไฟล์ zip ต้องเทียบกับจำนวนไฟล์หลังแตกต่างหาก
- `source_files.storage_path` ไม่ซ้ำ ใช้เฉพาะอักขระ ASCII-safe และจำนวนไฟล์ตรงกับ Storage
- ไม่มี `mail_batches.status = 'error'`; เมลจะถูกติด label หลังบันทึกสถานะ `stored` สำเร็จเท่านั้น
- อย่า backfill ทั้ง 300+ เมลใน execution เดียว เพื่อป้องกัน memory สูงและจำกัดผลกระทบเมื่อไฟล์ใดไฟล์หนึ่งเสีย

อ้างอิง flow และข้อควรระวังจาก `n8n-setup.pdf`; ชุดนี้ใช้ path แบบ idempotent/ASCII-safe และแยก backfill ออกจาก live เพื่อรองรับประมาณ 4,370 ไฟล์อย่างปลอดภัยขึ้น. ค่า `checksum` เว้นว่างในเฟสรับไฟล์ เพราะ Crypto node ของ n8n ตัด binary ออกจาก item; ให้คำนวณ checksum ในเฟส parse ภายหลัง.
