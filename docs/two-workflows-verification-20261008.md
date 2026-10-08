# ขอบเขตที่ยืนยัน: จับคู่ข้ามวัน + อัปไฟล์

ผู้ใช้ยืนยันสองเรื่องนี้ ไม่รวมต้นแบบตรวจยอด PM ต่างจาก BO ไม่มีการแก้ PM เพิ่มในงานรอบนี้

## ผลตรวจโค้ดและเบราว์เซอร์

- จับคู่ข้ามวัน: เปิด BO ซ้าย / เอกสารขวา เตรียมสองคู่ ส่งคู่แรกแล้วเหลือ 1 เคส / 1 คู่เตรียม / ส่งแล้ว 1 คู่ อีกคู่ยังติ๊กอยู่ แถว STM ที่ส่งแล้วถูกปิดการเลือกซ้ำ ไม่เปลี่ยน URL และไม่เรียก page reload
- เก็บพรีวิวและ signed URL เดิมขณะสลับ BO / เตรียม / ส่งคู่ในไฟล์เดียวกัน ไม่ขอ signed URL ใหม่ทุกครั้ง (การวาด modal ใหม่ยังมีการย้าย iframe จึงไม่ได้ยืนยันว่า PDF viewer จะไม่โหลดซ้ำ)
- แยกร่างตามบัญชีที่เข้าสู่ระบบ ห้ามยอดศูนย์ ห้ามจับคู่วันที่ธุรกรรมจริงต่างกัน
- แนบไฟล์: ใช้ฟังก์ชันจริงจาก supabase.js ใน browser fixture จำลอง Storage สำเร็จ / DB timeout จากนั้นกด resume บันทึกทะเบียนด้วย UUID เดิม จำนวน Storage POST ยังคง 1 และไม่มี pending receipt
- Node: cross-day-workbench, attachment-resume, clarification-save, head-attachment-capability, manual-pairing-ui, manual-pairing-rpc-transport, approval-persistence-navigation, app-shell (92 checks) ผ่าน; syntax และ git diff --check ผ่าน

## หลักฐานภาพ

- `/private/tmp/audit-cross-day-sequential-proof-20261008.jpg`
- `/private/tmp/audit-attachment-resume-proof-20261008.jpg`

ภาพทั้งสองมาจากเบราว์เซอร์ที่รันโค้ดจริงกับข้อมูล/transport จำลอง ไม่ใช่หลักฐานบันทึก production; เอกสารใน cross-day fixture เป็น HTML จำลอง ไม่ใช่ PDF ลูกค้า

## ยังไม่ยืนยัน / ไม่เผยแพร่

- RPC และ trigger ของ migration ข้ามวันยังไม่ได้ทดสอบกับ PostgreSQL/staging จริง รวมถึง worker rerun ขณะมีคำขอ pending และป้องกันอนุมัติซ้ำจากหลายบัญชี
- ระบบต้นทางยืนยันเฉพาะ native SCB; BBL ที่ยังไม่มีแถวตรวจยืนยันเปิดดูได้แต่ส่งคู่ไม่ได้
- timeout ฐานข้อมูลจริงยังไม่ทราบสาเหตุ ต้องตรวจ index / RLS execution plan; migration index ยังไม่รัน
- ร่างและคำขออัปโหลดค้างอยู่ในหน่วยความจำแท็บ ไม่รับประกันการกู้หลัง reload/ปิดแท็บ
- ไม่มี psql/docker ใน environment นี้และไม่มี connector SQL ให้ใช้สำหรับ staging; ไม่ทำธุรกรรมหรือทดลองปิดเคสลูกค้าบน production
- ไม่มี deploy ในรอบนี้
