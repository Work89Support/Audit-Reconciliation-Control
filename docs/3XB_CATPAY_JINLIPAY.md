# CATPAY และ JINLIPAY เฉพาะบริษัท 3XB

บัญชี BO ที่รองรับ: `3xbet_catpay(catpay)(P2P)` และ `พร้อมเพย์-JLP(jinlipay)(P2P)` แยกฝาก/ถอนตามต้นทาง ไม่เปิดใช้กับบริษัทอื่น

| ประเภท | PM | BO |
|---|---|---|
| ฝาก | customerId | ยูสเซอร์ |
| ฝาก | realAmount | จำนวน |
| ฝาก | paymentTime | เวลา |
| ถอน | amount | จำนวน |
| ถอน | updateTime | เวลา |
| ถอน | transactionId | รหัส |

ต้องตรงบริษัท Provider ทิศทาง วัน และทั้งสามเงื่อนไข เวลาเทียบตามความละเอียดที่ต้นทางมีจริง (BO ระดับนาทีเทียบกับนาทีเดียวกัน; ถ้าทั้งสองฝั่งมีวินาทีต้องตรงวินาที) จับเฉพาะคู่ 1:1 ที่ไม่กำกวม ไม่ใช้ `_id`/Sapan หรือยอดอย่างเดียวข้ามเงื่อนไข ไม่ใช้ expiredTime/requestTime หรือยอดอื่นแทนช่องที่กำหนด ข้อมูลสำคัญขาดต้องพักตรวจ เก็บทุกแถวจริงแยกกัน

ชื่อ CATPAY ต้องจำแนกก่อน ATP/AUTOPEER เพราะมีตัวอักษร ATP อยู่ภายใน รองรับชื่อ JLP เป็น alias ของ JINLIPAY

ใช้ `scripts/sync-3xb-provider-rules.mjs` กับ export Production ล่าสุดเพื่อแก้เฉพาะส่วนกฎใน normalizer และ matcher โดยรักษากราฟ credentials ตารางเวลา จุดบันทึกผล และส่วนแก้ไขเฉพาะ Production เดิม ตรวจ diff ก่อน Publish เสมอ อัปเดตตัวจำแนกไฟล์เมลด้วย

ทดสอบด้วย `tests/three-xb-catpay-jinlipay.test.mjs` ตั้ง `XB_NEW_PROVIDER_WORKFLOW` เพื่อตรวจโมดูลจริงจาก candidate ของออโต้และรันมือได้ ใช้ข้อมูลจำลองใน repo เท่านั้น ไฟล์ตัวอย่าง/ผลทดสอบจริงและ Production export ต้องอยู่นอก repo สาธารณะ
