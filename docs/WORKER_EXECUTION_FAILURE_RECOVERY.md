# คืนสถานะเมื่อ Automatic Worker ล้มเหลว

Worker ผูก `claimed_by` กับ n8n execution ID ในคำขอจองงาน Error Workflow ใช้ Error Trigger และ HTTP เท่านั้น จึงรับข้อผิดพลาดได้แม้ Code task runner ไม่พร้อม

`fail_daily_recon_execution` เปิดให้ service_role เท่านั้น และรับเฉพาะ Workflow หลักที่กำหนด คืนสถานะได้เฉพาะ running lease ของ execution นั้น ไม่รับ job ID ตามใจผู้เรียก ไม่แก้ archived/completed job หรือ lease ของ execution ใหม่ Callback ซ้ำเป็น no-op

ถ้ายังไม่มีผลของ attempt นี้ คืนเป็น queued พร้อมล้าง lease/คำขอรันซ้ำ และเก็บข้อความ/ขั้นตอนที่ล้มเหลว ครบสามครั้งเปลี่ยนเป็น error เพื่อไม่วนไม่จบ ถ้าพบ recon_run ของ attempt นี้แล้ว พักเป็น needs_review เพื่อให้ตรวจความครบก่อนรันใหม่ ไม่รับรองหรือสร้างผลซ้ำ ไม่แก้ยอด เคส ผลหลัก หลักฐาน หรือทะเบียนไฟล์

ตัว Dispatcher รอ Worker จบจริง และอ่าน worked/job_id จาก summary จึงเดินต่อเฉพาะเมื่อรับงานได้ หาก subworkflow ล้มเหลว ให้เข้าเส้นตรวจสถานะและรอเดิม ไม่หยุดโดยไม่มีตัวรับข้อผิดพลาด

ขั้นตอนเผยแพร่:
1. ทดสอบ migration กับ PostgreSQL จำลอง รวม stale lease, callback ซ้ำ, partial write, สิทธิ์ และ hash หลักฐานเดิม
2. เตรียม Error Workflow จาก export ล่าสุดของ Worker โดยใช้ credential reference เดิม ไม่มี secret ในไฟล์สาธารณะ
3. เมื่อคิวไม่มี active execution จึงติดตั้งฟังก์ชัน/Publish Error Workflow และผูก settings.errorWorkflow ของ Worker ให้ตรง ID ที่ตรวจแล้ว
4. เปลี่ยน claim body, retry เฉพาะโหนดคืนชื่อไฟล์ที่ไม่มี external writes และ summary พร้อม patch Dispatcher แบบจำกัดส่วน เปรียบเทียบกราฟ ตัวอ่าน กฎจับคู่ credentials และตารางเวลาเดิม
5. ตรวจ published export, ทดสอบ HTTP receipt แบบ no-op และเทียบผล/เคส/หลักฐานเดิม การรีเซ็ต lease เก่าที่ไม่ได้ผูก execution ต้องตรวจ execution ล้มเหลวและขอบเขตงานก่อนทุกครั้ง

Builder รับ AUTOMATIC_RECON_ERROR_WORKFLOW_ID สำหรับการผูก Error Workflow ที่ยืนยันแล้ว ห้าม Publish โดยปล่อย ID ตัวอย่างหรือไปผูกกับ failure workflow ของรันมือ
