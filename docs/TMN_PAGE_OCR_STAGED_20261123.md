# TMN รุ่งฟ้า: OCR ผูกแถวจากภาพต้นฉบับ

สถานะ 23 พ.ย. 2026: **Publish เข้า Production ทั้ง auto และ manual แล้ว** หลังรอบธุรกิจ 22 พ.ย. จบครบ 9 บริษัท ไม่มีงานกระทบยอดกำลังรัน และไม่มีการสั่งกระทบยอดใหม่ระหว่างติดตั้ง

| เส้นทาง | Workflow ID | เวอร์ชันที่ Published | เวลาไทย |
| --- | --- | --- | --- |
| อัตโนมัติ | `hggaOLqKPXB5roGM` | `TMN physical row OCR v1 - auto` | 11:02:51 |
| รันมือ | `bAhaQiTdEkuXF2bC` | `TMN physical row OCR v1 - manual` | 11:06:29 |

เป็นการเปลี่ยนขั้นอ่านภาพเท่านั้น กฎจับคู่ จุดบันทึกผล credentials settings ตารางเวลา และ reviewed-source cache เดิมยังอยู่เหมือนเดิม ไม่มี SQL migration หรือคำสั่งเปิด/ปิดเคสในการติดตั้ง

## ขอบเขตและวิธีทำงาน

- เฉพาะ UFABET7M, TMN รุ่งฟ้า/รุ้งฟ้า PDF ที่แต่ละหน้ามี screenshot เดียวและเข้าเงื่อนไขภาพที่รองรับ ไม่อ้างว่าครอบคลุมไฟล์ภาพทุก layout หรือ DOCX ทุกแบบ
- ตรวจ SHA-256 ของไฟล์จริง จำนวนหน้าจริง และ hash ทุกหน้า/ภาพ ก่อนเชื่อมข้อมูลกลับต้นฉบับ
- ถอดภาพ JPEG/Flate RGB8 จาก PDF แล้วตรวจขอบเขตแถวจาก pixels ต้นทาง แยกบริเวณคำอธิบาย ยอด และเวลา ก่อน OCR ไม่จับคู่คอลัมน์ตามลำดับจาก plain text อย่างเดียว
- จัดสำเนา pixel ของแต่ละแถวให้อยู่ต่อกันในหน้า OCR พร้อม marker `ROW n` ไม่สร้างหรือเติมตัวเลขทางการเงินใหม่ ภาพต้นฉบับไม่ถูกเปลี่ยน
- ส่งผ่าน Google Drive credential เดิม ครั้งละหน้า รอ 8 วินาทีและ retry API สูงสุด 5 ครั้ง ห่างครั้งละ 15 วินาที เมื่อ upload ไม่คืน document ID จะไม่ export ด้วย ID ว่าง
- ตรวจ marker ครบและไม่ซ้ำ พร้อมยอด/เวลา/ทิศทางที่ชัดเจนเพียงค่าเดียวต่อแถว
- ทุกแถวมี `sourceRowId`, เลขหน้า, hash ไฟล์/หน้า/ภาพ, พิกัด crop ของ field, ข้อความ OCR ดิบ และหลักฐานเศษแถวที่ต่อกัน
- ต่อเวลาในภาพหน้าถัดไปได้เฉพาะเศษแถวขอบภาพที่พิสูจน์ได้ว่าหน้าก่อนมีคำอธิบายและยอดครบ แต่ไม่มีเวลา และหัวหน้าถัดไปมีเวลาเดียวโดยไม่มียอดหรือคำอธิบายใหม่ ห้ามใช้เศษเวลานี้เติมยอดที่หาย
- วันที่ใช้หัววันที่ absolute ในต้นฉบับตามกฎ TMN เดิม ไม่เดาจากชื่อไฟล์ วันที่ BO หรือเวลาโทรศัพท์
- รายการที่ชื่อ เวลา ยอดเหมือนกันอยู่คนละ source row เสมอ ไม่ dedup จาก tuple เหล่านั้น
- ค่าธรรมเนียมเก็บใน page audit แต่ไม่เข้า records สำหรับจับคู่
- ตรวจจนครบทุกหน้าแม้หน้าก่อนมี error แล้วรวม diagnostics ถ้าฟิลด์สำคัญของแถวใดไม่ครบ ทั้งไฟล์เป็น `needs_review` และไม่รับผลการเงินบางส่วน
- Google Drive text OCR ไม่มีค่าความมั่นใจราย field จากโมเดล การตรวจโครงสร้าง/เครื่องหมาย/วันที่ไม่ใช่ confidence 100%
- reviewed-source cache ที่เคยยืนยันไว้ถูกใช้ก่อน OCR สดตามเดิม การติดตั้งไม่ลบหรือแทนที่แหล่งที่ยืนยันแล้ว

## ผลทดสอบที่ยืนยันได้

### Provider จริงใน workflow แยก

ทดสอบผ่าน Google Drive และ n8n จริงใน workflow ที่ไม่มี database/result/case write nodes และไม่ Published จากนั้น Archive แบบกู้คืนได้

- ตรวจครบ 15/15 หน้าจริง ใช้เวลาประมาณ 3 นาที 29 วินาที
- พบ 129 events: อ่านได้ 128 คือ principal 77 แถว และค่าธรรมเนียม 51 แถว
- วันที่ เวลา ยอด และทิศทางของ 77 principal ที่อ่านได้ตรงกับต้นฉบับที่เคยตรวจภาพแล้วทั้งหมด ไม่พบผลต่าง และค่าธรรมเนียม 51 แถวตรง
- แถว P14-R10 มีตัวเลขยอดถูกแถบนำทางโทรศัพท์บัง หน้า 15 เหลือเฉพาะเวลา จึงพิสูจน์ยอดจาก OCR ไม่ได้ ผลไฟล์ต้นฉบับ 15 หน้าถูกหยุด `needs_review`, records เป็น 0 อย่างถูกต้อง
- **ไม่ได้ทดสอบให้ต้นฉบับ 15 หน้าที่ตัวเลขถูกบังผ่านอัตโนมัติ และห้ามอ้างว่าผ่านครบทุกแถว**

### Auto/manual parity และ regression

- รัน Code node จริงที่ติดตั้งทั้งสองเส้นทางใน VM โดยไม่เขียน Production
- positive fixture เป็น PDF 13 หน้าจริงจากภาพเดิมที่ครบ ไม่ใช่การเปลี่ยนเลขหน้าของต้นฉบับ 15 หน้า: ทั้งสองเส้นทางรับ principal 65 แถว ตัดค่าธรรมเนียม 51 แถว พร้อมพิกัดต้นทางครบ
- ต้นฉบับ 15 หน้าที่ถูกบังถูกปฏิเสธตรงกันทั้งสองเส้นทาง
- reviewed-source cache เดิม 78 แถวยังรับได้ครบและไม่เปลี่ยน records
- ผล auto/manual ตรงกัน
- Golden/negative tests ครอบคลุม 10/1,000, 40/4,000, 53/953, ยอด 4,000 สองแถวเวลา/ชื่อซ้ำ, ค่าธรรมเนียม, sign/date conflict, หน้าไม่ครบ/ซ้ำ/สลับ, hash ไม่ตรง, marker/field กำกวม และเศษแถว
- `npm test` ทั้งชุดผ่าน พร้อม `tests/tmn-row-geometry.test.mjs` และ `tests/tmn-page-ocr.test.mjs`

## รูปแบบภาพเดิมยังใช้ได้ แต่ข้อจำกัดต้นฉบับยังมี

ผู้ใช้ยืนยันว่าต้องใช้ภาพรูปแบบเดิม จึงไม่บังคับเปลี่ยนเป็น statement ใหม่ ระบบใหม่นี้อ่านแถวที่เห็นครบและผูกกลับตำแหน่งภาพได้อัตโนมัติ แต่ไม่สามารถอ่าน pixels ที่ไม่มีอยู่จริงได้

เพื่อให้รอบถัดไปเดินอัตโนมัติด้วยภาพรูปแบบเดิม ควรถ่ายให้เลื่อนซ้อนอย่างน้อยหนึ่งรายการเต็ม โดยชื่อ ยอด และเวลาของแต่ละรายการต้องเห็นครบในภาพใดภาพหนึ่ง หากยอดยังถูกบังทุกภาพ จะต้องทบทวนตามจริง ไม่คัดลอกยอดก่อนหน้า ไม่ใช้ BO เดา ไม่ตัดแถวนั้นทิ้ง และไม่ลด Quality Gate เพื่อบังคับผ่าน

## การติดตั้งและตรวจหลัง Publish

1. สำรอง export Production สดของ auto/manual และตรวจไม่ต่างจาก baseline ที่ใช้ทดสอบ
2. ใช้ patch เดียวกันกับทั้งสอง export โดยคง finish compact และ operational fields เดิม ห้ามสร้างทับจาก builder เก่าที่ wrapper ต่างจาก Production
3. แทนกราฟภายใน Workflow ID เดิม: auto 47 → 55 nodes, manual 28 → 36 nodes; n8n clipboard paste สร้าง node IDs ใหม่ แต่ชื่อ/เส้นเชื่อม/credentials/settings/finish path ถูกตรวจเท่ากับ candidate ที่ทดสอบ
4. Export หลัง Publish แล้วเทียบ code ทุก node, connections, settings และ credentials กับ candidate อีกครั้ง ทั้งสองเส้นทางตรงกัน (ยกเว้น node IDs/ตำแหน่ง/webhook ID และ default batchSize=1/unit=seconds ที่ n8n normalize; webhook path เดิม)
5. อ่าน daily jobs หลัง Publish: 9 บริษัทคง run IDs, completed และจำนวนไฟล์เดิม ต้นฉบับ TMN ที่ยืนยันแล้วคง checksum/parsed/78 แถว ไม่มีงาน auto/manual กำลังรัน
6. ตรวจชุดเคส closed เดิมครบด้วย count/hash: ระหว่างตรวจมี MC8 ปิดเพิ่ม 1 เคสแบบ `auto_closed=false` เวลา 11:09:46; เมื่อตัดเคสที่เพิ่งปิดนี้ออก ชุด IDs/status ของเคสเดิมตรงก่อนติดตั้งทุกตัว ไม่ใช่การปิดโดยตัวติดตั้ง
7. ไม่มีการสั่งรัน Production ใหม่ ยืนยันผลหลัก หรือเปิด/ปิดเคสระหว่างติดตั้ง และไม่ได้นำ partial diagnostic มาใช้เป็นผลจริง

## ไฟล์และคำสั่งสำหรับผู้ดูแล

- `tmn-row-geometry.js`: ถอดภาพ ตรวจ geometry และจัด pixel crop ตามแถว
- `tmn-page-ocr.js`: validator/normalizer ไม่มี network หรือ database write
- `scripts/tmn-page-ocr-workflow.mjs`: patch fresh exported workflow ทั้ง auto/manual ด้วย `--row-layout`
- `tests/tmn-row-geometry.test.mjs`, `tests/tmn-page-ocr.test.mjs`: positive/negative tests
- `vendor/pdf-lib-1.17.1.min.js`, `vendor/jpeg-js-0.4.4-decoder.cjs` และไฟล์ license: pin dependencies ที่ใช้จริง
- `vendor/tmn-ocr-marker-glyphs.json` และ license: glyph สำหรับ marker ที่ไม่ใช่ข้อมูลการเงิน

```sh
node tests/tmn-row-geometry.test.mjs
node tests/tmn-page-ocr.test.mjs
node scripts/tmn-page-ocr-workflow.mjs private-auto-export.json private-auto-candidate.json --row-layout
node scripts/tmn-page-ocr-workflow.mjs private-manual-export.json private-manual-candidate.json --row-layout
npm test
```

ข้อมูลการเงินจริง ต้นฉบับ OCR fixtures ภาพและ Production exports เก็บใน private temp เท่านั้น ห้าม commit หรือเผยแพร่เข้า repository
