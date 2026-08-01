# Audit AI Reconciliation - System Requirements

เอกสารนี้สรุปขอบเขตระบบจาก MOM วันที่ 1/8/2026 และไฟล์รายละเอียดงานแผนกออดิทระบบ 123 / PM

## เป้าหมายระบบ

ระบบต้องช่วยแผนกออดิทตรวจบัญชีฝาก-ถอนจากหลายบริษัทในเครือ ลดงาน Excel manual และทำให้การหายอด Diff / Missing ทำได้เร็วขึ้นจากระดับ T+2 ถึง T+4 ให้เข้าใกล้ T+0 / T+1

## ผู้ใช้งานหลัก

- Audit Monitor: ตรวจรายการ, ใส่ note, ส่งรายการให้หัวหน้ากะชี้แจง
- Audit Lead: ตรวจทานผล, ปิดรอบความเสียหาย, ส่งสรุปให้การเงินและบุคคล
- Shift Lead / Admin Lead: ชี้แจงยอดผิดปกติและแนบหลักฐาน
- Executive / Finance / HR: ดูรายงานความเสียหาย, KPI, แนวโน้มรายเดือน
- System Admin: ตั้งค่า data source, rule engine, user permission

## Data Sources

- Email กลางที่ได้รับไฟล์ประจำวัน
- STM ธนาคารปกติ แยกบัญชีฝาก-ถอน
- BO / หน้าหลังบ้าน / รายงานบัญชีฝาก-ถอน
- ไฟล์แก้ไขรายการฝากมือ
- ไฟล์แก้ไขรายการถอนมือ
- ไฟล์ค่าคอมมิชชั่น
- ไฟล์ชี้แจงปัญหาประจำวัน
- STM PM: AUTOPEER, AZPAY, Cyberplus

## Functional Requirements

### 1. Intake Control

- ดึงไฟล์จาก Email กลางตามวันที่และบริษัท
- ตรวจว่ามี STM / BO / ไฟล์ชี้แจงครบหรือไม่
- ตรวจว่าไฟล์ถูกบริษัทและถูกประเภทหรือไม่
- แจ้งเตือนกรณีส่ง STM ผิดบริษัท, BO ผิดบริษัท, หรือไฟล์ไม่ครบ
- แสดง checklist รายวันให้ Audit Monitor เห็นก่อนเริ่ม reconcile

### 2. Data Normalization

- แปลงไฟล์ Excel / CSV / PDF copy table เป็นโครงสร้างเดียวกัน
- จัดเรียงข้อมูลตามเวลา
- แยก direction เป็น deposit / withdraw / transfer / adjustment
- Normalize ชื่อธนาคาร, เลขบัญชี, จำนวนเงิน, เวลา, balance, username, company
- เก็บ raw file และ normalized records เพื่อ audit ย้อนหลัง

### 3. Bank Rule Engine

- SCB: X1 = รับเงิน, X2 = โอนเงิน, XB = ปรับปรุงยอด
- KBANK: กรองคำว่า "ยอดยกมา" ก่อนจัดเรียง, ตรวจเวลา 00:00-23:59
- GSB: กรองคำว่า "รอบวันที่", ใช้ Transfer SAV Deposit / MyMo Transfer from SAV เป็นรับเงิน และ MyMo SAV Withdraw เป็นโอนเงิน
- SCB / GSB: ช่วง 23:00-23:59 ต้องตรวจร่วมกับข้อมูลวันถัดไป
- PM: กรองเฉพาะรายการสำเร็จและวันที่ที่ต้องการตรวจสอบ

### 4. Reconciliation

- ทำ 3-point match จาก account, time, amount
- รองรับ time tolerance ระดับวินาทีหรือนาทีตามกฎธนาคาร
- ตรวจ Missing Item จาก STM มากกว่า BO หรือ BO มากกว่า STM
- ตรวจยอดโอนออกว่าปลายทางเป็นบัญชีที่บริษัทใช้งานหรือไม่
- แยก exception type เช่น amount diff, time diff, missing STM, missing BO, duplicated transaction, manual correction, cross-day transaction
- แสดง evidence ของแต่ละ exception พร้อม raw source

### 5. Exception Workflow

- Audit Monitor เปิดรายการผิดปกติ
- ใส่ manual note ได้ แต่ลบข้อมูลไม่ได้
- ส่งรายการให้ Shift Lead / Admin Lead ชี้แจง
- แนบหลักฐานและไฟล์ชี้แจง
- Audit Lead อนุมัติหรือส่งกลับ
- เก็บ audit log ทุกการแก้ไข note / status / approval

### 6. Damage Register

- บันทึกความเสียหายรายวัน
- ระบุ employee, username, shift, company, transaction, cause, amount, evidence
- รอบชี้แจงระบบ 123:
  - รอบ 1: วันที่ 1-15
  - รอบ 2: วันที่ 16-25
  - รอบ 3: วันที่ 26-30/31 หรือวันที่ 2 ของเดือนถัดไปตามการปิดรอบ
- ให้เวลาแนบหลักฐาน 2-3 วัน
- สรุปยอดสิ้นเดือนส่งการเงินและบุคคล

### 7. Dashboard & Reporting

- Daily dashboard: transactions, matched, diff/missing, files checked, latency
- Exception queue แยกตาม severity
- KPI ตาม shift / employee / company
- Monthly damage summary
- Quarterly / yearly trend พร้อม % เปรียบเทียบ
- Export Excel / PDF report

### 8. Talk to Data

- ผู้บริหารถามข้อมูลด้วยภาษาไทย เช่น "วันนี้ยอดผิดปกติกะดึกเท่าไหร่"
- ระบบตอบจากข้อมูลที่ผ่าน reconcile แล้ว
- ต้องอ้างอิงตัวเลขและช่วงวันที่ชัดเจน
- คำตอบที่กระทบการลงโทษหรือการเงินต้องมีลิงก์กลับไป evidence

## Permission Requirements

- Audit Monitor: อ่านข้อมูล, ใส่ note, เปลี่ยน status บางขั้น, ส่งชี้แจง
- Audit Lead: อนุมัติ, ปิดเคส, ปิดรอบความเสียหาย
- Shift Lead: ตอบชี้แจงและแนบหลักฐาน
- Executive: อ่าน dashboard และรายงานเท่านั้น
- Admin: ตั้งค่า rule, data source, user, role

## Non-Functional Requirements

- รองรับ 100,000-200,000 transactions ต่อวัน
- Daily report ควรเสร็จใน 1-2 ชั่วโมงหลังไฟล์ครบ
- เก็บข้อมูลย้อนหลังอย่างน้อย 12 เดือน
- ห้าม bot login mobile banking หรือระบบที่ต้องใส่ password โดยตรง
- ใช้ email/export file เป็น data ingestion หลักเพื่อความปลอดภัย
- ทุก action สำคัญต้องมี audit log
- ข้อมูลการเงินต้องเข้ารหัสและจำกัดสิทธิ์ตาม role

## Manual Review Still Required

- ตรวจว่าไฟล์ที่ส่งมาครบ ถูกบริษัท และรูปแบบถูกต้อง
- อ่านไฟล์ชี้แจงที่มีบริบทเฉพาะ
- ตัดสินใจว่าเคสใดเป็นความเสียหายจริง
- อนุมัติการแก้ไขรายการหรือการลงโทษ
- ตรวจเคสที่ธนาคารไม่มีเวลาระบุหรือข้อมูลไม่เป็น pattern
