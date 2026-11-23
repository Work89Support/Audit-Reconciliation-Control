# ตรวจ TMN จากหน้าระบบโดยไม่เตรียม JSON

ขอบเขต: เพิ่มข้อมูลร่าง OCR และหน้าตรวจหลักฐาน UFABET7M TMN เท่านั้น กฎจับคู่ ยอดต้นทาง ตารางเวลา ผลหลัก และวงจรปิดเคสไม่ถูกแก้

## วิธีใช้

1. ไฟล์และสถานะ → ดูตัวอย่างไฟล์ TMN → ตรวจ TMN ทีละหน้าและแถว → เปิดข้อมูลตรวจ TMN
2. ระบบดาวน์โหลดต้นฉบับ ตรวจ SHA-256 และแสดง PDF ด้วย PDF.js พร้อมจำนวนหน้าจริง
3. จุดที่ OCR ต้องตรวจแสดงเช่น P14-R10 กดเพื่อเปิดหน้าต้นฉบับ แถวที่ยอด/เวลาไม่ครบยังอยู่ ไม่แทนด้วยศูนย์และไม่ตัดทิ้ง
4. ตรวจแก้วัน เวลา ประเภท ยอด และรายละเอียดในตาราง แถวที่ OCR มีปัญหาต้องระบุหลักฐานแก้ไขอย่างน้อย 10 ตัวอักษร ห้ามเดายอดจาก BO หรือแถวใกล้กัน
5. ยืนยันทีละแถวและทีละหน้า การแก้ field ใดจะล้างการยืนยันแถวและหน้านั้น ต้องตรวจใหม่ จำนวนรายการจริงซ้ำยังคงคนละ source row ค่าธรรมเนียมแยกใน audit ไม่เข้ายอด
6. เมื่อครบทุกหน้า/ทุกแถว ให้ยืนยันความครบ ระบุหลักฐานควบคุมและบันทึกผู้ตรวจ แล้วกดปุ่มยืนยัน ไม่ต้องนำเข้า JSON

## หลังยืนยัน

- ถ้ารอบออโต้ยัง needs_review และไฟล์ทุกส่วนผ่าน ไม่มีทะเบียนพัก: ใช้ฟังก์ชันยืนยันต้นฉบับ/จัดคิวเดิม เข้าคิวรอ Dispatcher ไม่อ้างว่าเริ่มทำงานแล้วจนกว่าสถานะเป็น running
- ถ้ารอบออโต้ completed แล้ว แต่มีรันมือ failed ขอบเขตล่าสุดที่อ้างอิงรอบเดียวกัน: ปุ่มระบุว่าจะรันมือต่อเป็นรายงานแยก ใช้บัญชี ทิศทาง mode และ selected file IDs ของคำขอเดิมผ่าน Edge Function เดิม ผลไม่ถูกใช้เป็นผลหลักอัตโนมัติ
- ถ้ายืนยันไว้แล้วและรอบหลัก completed: อ่านอย่างเดียว ไม่ยืนยันข้อมูลทับหรือรันซ้ำ
- ถ้า queued/running, paused หรือรอบหลักเปลี่ยน: ห้ามส่งซ้ำ/ข้ามสถานะพัก
- กรณีส่ง Worker ไม่ทราบผล ใช้ request key เดิมเพื่อตรวจและส่งต่อ ไม่สร้างคำขอใหม่ซ้ำ
- เลขอ้างอิงการยืนยันเก็บจาก server เท่านั้น ห้ามแสดงสำเร็จจากการกดปุ่มเพียงอย่างเดียว

## ข้อมูลร่างและสิทธิ์

- Worker ทั้งสองเพิ่ม `tmn_review_draft` ใน parse receipts จาก geometry ของภาพเดิม มี source ID/checksum/page/row/regions/ข้อความ OCR และ issues
- แถวที่มีค่าหายถูกเก็บเป็น null/ช่องว่างในร่าง ไม่ใช่ normalized record ที่ใช้จับคู่
- `tmn_ocr_review_drafts` เป็น metadata เท่านั้น เขียนผ่าน service_role wrapper ที่เรียก RPC เดิมก่อน ไม่แก้ฐานผลเก่า
- อ่านผ่าน `read_tmn_review_context` ที่ตรวจผู้ใช้ active, บทบาท Audit, สิทธิ์บริษัท และ checksum ปัจจุบัน ไม่มี anonymous read และไม่เปิดสิทธิ์เขียนตารางตรง
- ไม่เปลี่ยน source_file_ocr raw/approved recovery เดิม และไม่ใช้ร่างแทน Quality Gate

## การติดตั้ง

1. ตรวจว่าไม่มี Worker/รันมือทำงานและรอบปัจจุบันจบก่อนติดตั้ง
2. รัน `supabase/20261123_tmn_review_workspace.sql` (เพิ่มตารางและ RPC ไม่มีคำสั่งเปลี่ยนข้อมูลการเงินจริง)
3. Export auto/manual Production ปัจจุบันที่ติดตั้ง `tmn-pixel-row-v1` แล้ว ใช้ `scripts/patch-tmn-review-workflow.mjs auto|manual INPUT OUTPUT` แก้เฉพาะ normalizer/calculation metadata และ URL ของ receipt node รวม 3 nodes ไม่เปลี่ยน matching/finish payload/credentials/settings/connections
4. Publish กราฟเดิม และตรวจ export หลัง Publish เทียบทุก operational field
5. Deploy หน้าเว็บและตรวจ live ผ่านไฟล์ที่ยืนยันไว้แล้วแบบอ่านอย่างเดียว ไม่กดยืนยันซ้ำเพื่อทดสอบ

## การทดสอบ

- `node tests/tmn-review-workspace.test.mjs`
- `node tests/tmn-pdf-review-editor.test.mjs`
- `node tests/pdf-source-approval.test.mjs`
- `npm test`
- `tests/tmn-review-workspace.html` เป็นข้อมูลสมมติ/ไม่มี network ไป Production: ยอดซ้ำ แถวขาดยอด แก้แล้วล้างยืนยัน ยืนยันครบแล้วเข้าคิว รอบ completed ห้ามรัน และ checksum ผิดห้ามยืนยัน
- SQL ทดสอบแยกด้วย PostgreSQL WASM: ติดตั้ง `@electric-sql/pglite@0.3.14` ในโฟลเดอร์ชั่วคราวแล้วตั้ง `PGLITE_MODULE_URL` เป็น file URL ของ module ก่อนรัน `tests/tmn-review-workspace-db.test.mjs` ตรวจ syntax, role/company/RLS, source/hash,สัญญา RPC เดิม และ primary/closed-case fixtures คงเดิม
- ข้อมูล OCR/PDF จริง และ Production exports ต้องเก็บ private เท่านั้น ไม่ commit
