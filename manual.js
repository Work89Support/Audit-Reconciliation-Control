/* =============================================================
   Manual - คู่มือการใช้งานในระบบ
   - หน้าต่างลอย ใช้งานระบบไปพร้อมกันได้ (ไม่บังหน้าจอ)
   - สารบัญด้านซ้าย กดแล้วเลื่อนไปหัวข้อนั้น และไฮไลต์ตามที่เลื่อนอยู่
   - ย่อเป็นปุ่มกลม ลากไปวางตรงไหนก็ได้ และจำตำแหน่งไว้
   ============================================================= */

const Manual = (() => {
  const IMG = (n) => `manual/${n}.png`;
  /* ขนาดจริงของภาพ ใช้จองพื้นที่ล่วงหน้าเพื่อไม่ให้เลย์เอาต์ขยับตอนภาพโหลด */
  const IMG_SIZE = {"01-overview": [1180, 781], "02-sidebar": [264, 900], "03-topbar": [1044, 88], "04-filters": [1044, 215], "05-import-before": [1180, 781], "06-import-after": [1180, 781], "07-parse-result": [514, 622], "08-engine-validation": [1044, 451], "09-dashboard": [1180, 781], "10-kpi-tiles": [1044, 166], "11-hourly-chart": [514, 493], "12-intake": [1180, 781], "13-exceptions": [1180, 781], "14-drawer": [560, 900], "15-drawer-checklist": [560, 900], "16-matching": [1180, 781], "17-approvals": [1180, 781], "18-damage": [1180, 781], "19-pm": [1180, 781], "20-kpi": [1180, 781], "21-reports": [1180, 781], "22-export-dialog": [560, 756], "23-panel-camera": [476, 42], "24-talk": [1180, 781], "25-rules": [1180, 781], "26-users": [1180, 781], "27-notifications": [1180, 781], "28-schedule": [1180, 781], "29-auditlog": [1180, 781], "30-roadmap": [1180, 781]};

  /* ---------------- เนื้อหาคู่มือ ---------------- */
  const SECTIONS = [
    {
      id: "start",
      group: "เริ่มต้น",
      title: "ภาพรวมระบบ",
      blocks: [
        { t: "p", text: "ระบบนี้ช่วยแผนกออดิทตรวจบัญชีฝาก-ถอนของหลายบริษัทในเครือ โดยเอารายการฝั่งธนาคาร (STM) มากระทบยอดกับรายการฝั่งระบบหลังบ้าน (BO) ให้อัตโนมัติ แล้วยกเฉพาะรายการที่ไม่ตรงขึ้นมาเป็นคิวให้คนตรวจ" },
        { t: "img", src: IMG("01-overview"), cap: "หน้าแดชบอร์ด — หน้าแรกที่เปิดขึ้นมา" },
        { t: "p", text: "หน้าจอแบ่งเป็น 3 ส่วนหลัก" },
        {
          t: "ul",
          items: [
            "<b>เมนูซ้าย</b> — เปลี่ยนหน้าจอ แบ่งเป็น 4 กลุ่ม: งานประจำวัน, ตรวจสอบและอนุมัติ, รายงาน, ระบบ",
            "<b>แถบบน</b> — ชื่อหน้า, กระดิ่งแจ้งเตือน, มุมมองสิทธิ์, ปุ่ม Export และสถานะการทำงานอัตโนมัติ",
            "<b>แถบตัวกรอง</b> — วันที่ตรวจ ช่วงข้อมูล บริษัท ประเภทบัญชี และกะ ซึ่งมีผลกับทุกหน้าที่เกี่ยวข้อง",
          ],
        },
        { t: "tip", text: "งานประจำวันปกติจะไล่จากบนลงล่างตามเมนู: นำเข้าข้อมูล → ตรวจไฟล์ → ดูแดชบอร์ด → เคลียร์รายการผิดปกติ → อนุมัติ → ปิดรอบความเสียหาย" },
      ],
    },
    {
      id: "nav",
      group: "เริ่มต้น",
      title: "เมนูและการเปลี่ยนหน้า",
      blocks: [
        { t: "img", src: IMG("02-sidebar"), cap: "เมนูซ้าย ตัวเลขข้างเมนูคือจำนวนงานที่ค้างอยู่", small: true },
        { t: "p", text: "ตัวเลขสีจาง ๆ ข้างเมนูคือจำนวนงานค้าง — ข้าง “รายการผิดปกติ” คือเคสที่ยังไม่ปิด ข้าง “อนุมัติ / ปิดเคส” คือเคสที่รอคุณตรวจทาน" },
        { t: "p", text: "แต่ละหน้ามีที่อยู่ของตัวเอง (เช่น <code>#/exceptions</code>) จึงคัดลอกลิงก์ส่งให้เพื่อนร่วมทีมเปิดหน้าเดียวกันได้ และปุ่มย้อนกลับของเบราว์เซอร์ใช้ได้ตามปกติ" },
        { t: "p", text: "บนจอเล็กหรือมือถือ เมนูจะยุบเป็นปุ่ม ☰ ที่มุมบนซ้าย" },
      ],
    },
    {
      id: "filters",
      group: "เริ่มต้น",
      title: "แถบตัวกรอง และช่วงวันที่",
      blocks: [
        { t: "img", src: IMG("04-filters"), cap: "แถบตัวกรองด้านบนของหน้า" },
        { t: "p", text: "ตัวกรองนี้ไม่ได้เป็นแค่ของประดับ — เปลี่ยนแล้วมีผลกับตัวเลขทุกหน้า รวมถึงไฟล์ที่ export ออกไปด้วย" },
        {
          t: "ul",
          items: [
            "<b>วันที่ตรวจ</b> — วันที่ของข้อมูลที่กำลังกระทบยอด",
            "<b>ช่วงข้อมูล</b> — เลือกสำเร็จรูปได้: วันที่ตรวจ, 7 วัน, 30 วัน, เดือนนี้, เดือนก่อน, ไตรมาสนี้, ปีนี้ หรือกำหนดเอง",
            "<b>ตั้งแต่ / ถึงวันที่</b> — กรอกเองได้ ระบบจะสลับเป็น “กำหนดเอง” ให้อัตโนมัติ",
            "<b>บริษัท / ประเภทบัญชี / กะ</b> — จำกัดขอบเขตข้อมูลที่กำลังดู",
          ],
        },
        { t: "p", text: "บรรทัดสรุปใต้ตัวกรองจะบอกเสมอว่ากำลังดูช่วงไหน มีกี่เคส เกิน SLA เท่าไร และความเสียหายในช่วงนั้นรวมเท่าไร" },
        { t: "tip", text: "จะออกรายงานรายเดือนให้การเงิน ให้เลือก “เดือนก่อน” ก่อนกด Export ตัวเลขในไฟล์จะตรงกับช่วงนั้นทันที" },
      ],
    },
    {
      id: "roles",
      group: "เริ่มต้น",
      title: "บทบาทและสิทธิ์",
      blocks: [
        { t: "img", src: IMG("26-users"), cap: "ตารางสิทธิ์เต็มอยู่ในเมนู “ผู้ใช้ & สิทธิ์”" },
        { t: "p", text: "ช่อง “มุมมองสิทธิ์” มุมบนขวาใช้สลับบทบาทเพื่อดูว่าผู้ใช้แต่ละกลุ่มจะเห็นและทำอะไรได้บ้าง เมนูและปุ่มจะเปลี่ยนตามจริง" },
        {
          t: "table",
          head: ["บทบาท", "ทำอะไรได้"],
          rows: [
            ["Audit Monitor", "ตรวจรายการ ใส่ note ส่งให้หัวหน้ากะชี้แจง export ข้อมูล"],
            ["Audit Lead", "ทุกอย่างของ Monitor + อนุมัติ ปิดเคส ปิดรอบความเสียหาย แก้ tolerance และกฎธนาคาร"],
            ["Shift Lead", "ตอบชี้แจงและแนบหลักฐานในเคสที่ถูกส่งมา"],
            ["Executive / Finance", "อ่านแดชบอร์ด KPI และรายงานเท่านั้น"],
            ["System Admin", "ตั้งค่าระบบ กฎธนาคาร ผู้ใช้ และนโยบายข้อมูล"],
          ],
        },
        { t: "warn", text: "ไม่มีบทบาทใดลบ transaction หรือหลักฐานได้ แก้ไขได้เฉพาะการเพิ่ม note และเปลี่ยนสถานะ ซึ่งถูกบันทึกไว้ใน Audit Log ทุกครั้ง" },
        { t: "p", text: "ถ้าปุ่มไหนจางลงและกดไม่ได้ แปลว่าบทบาทที่เลือกอยู่ไม่มีสิทธิ์นั้น เอาเมาส์ชี้ค้างจะบอกว่าต้องมีสิทธิ์อะไร" },
      ],
    },

    {
      id: "import",
      group: "งานประจำวัน",
      title: "นำเข้าข้อมูล",
      blocks: [
        { t: "p", text: "หน้านี้คือจุดเริ่มของงานทุกวัน มี 2 ทางในการเอาข้อมูลเข้าระบบ" },
        { t: "img", src: IMG("05-import-before"), cap: "ซ้าย: กล่องอีเมลกลาง ขวา: ช่องอัปโหลดไฟล์เอง" },
        {
          t: "steps",
          items: [
            "<b>ดึงจากกล่องอีเมลกลาง</b> — กด “ดึงไฟล์ทั้งหมด” เพื่อดึงทุกฉบับเข้าระบบทีเดียว หรือกด “ดึงเข้าระบบ” ทีละฉบับ",
            "<b>อัปโหลดเอง</b> — ลากไฟล์มาวางในกรอบเส้นประ หรือคลิกเพื่อเลือกไฟล์ รองรับ .csv และ .xlsx",
            "ระบบจะอ่านหัวคอลัมน์เองว่าเป็น STM ของธนาคารไหน รายงาน BO หรือ STM PM ไม่ต้องเลือกชนิดไฟล์",
          ],
        },
        { t: "p", text: "ปุ่ม “ดาวน์โหลด” ข้างแต่ละฉบับใช้เปิดดูโครงสร้างไฟล์ตัวอย่างได้ ไฟล์เหล่านี้จงใจใส่ความไม่สมบูรณ์แบบที่เจอจริงไว้ เช่น บรรทัดยอดยกมา บรรทัดรอบวันที่ marker X1/X2/XB รายการ FAILED และวันที่ของวันอื่นปนมา" },
        { t: "img", src: IMG("07-parse-result"), cap: "ตารางผลการอ่านไฟล์ — บอกว่าแต่ละไฟล์ใช้ได้กี่แถว และถูกกฎไหนกรองออกไปกี่แถว" },
        { t: "tip", text: "คอลัมน์ “ถูกกรองออกด้วยกฎ” สำคัญมาก เพราะทำให้เห็นว่าระบบตัดอะไรทิ้งไปบ้าง ไม่ใช่หายเงียบ ๆ ถ้าตัวเลขผิดปกติให้ย้อนไปดูกฎธนาคารในเมนู Bank Rules" },
      ],
    },
    {
      id: "auto",
      group: "งานประจำวัน",
      title: "การกระทบยอดอัตโนมัติ",
      blocks: [
        { t: "p", text: "ระบบไม่มีปุ่มสั่งกระทบยอด เพราะทำงานให้เองเมื่อเงื่อนไขครบ ดูสถานะได้ที่ชิปมุมบนขวา" },
        { t: "img", src: IMG("03-topbar"), cap: "ชิปสถานะอัตโนมัติอยู่ขวาสุดของแถบบน" },
        {
          t: "table",
          head: ["สถานะ", "หมายความว่า"],
          rows: [
            ["รอไฟล์", "ยังไม่มีไฟล์เข้าระบบ"],
            ["รอ STM", "มีไฟล์ฝั่ง BO แล้ว แต่ยังไม่มีฝั่งธนาคาร"],
            ["รอ BO", "มีไฟล์ฝั่งธนาคารแล้ว แต่ยังไม่มีฝั่งระบบหลังบ้าน"],
            ["กำลังกระทบยอด", "ระบบกำลังจับคู่รายการอยู่"],
            ["กระทบยอดแล้ว", "เสร็จแล้ว ตัวเลขทุกหน้าอัปเดตตามผลล่าสุด"],
          ],
        },
        { t: "p", text: "สิ่งที่ทำให้ระบบกระทบยอดใหม่ให้เอง:" },
        {
          t: "ul",
          items: [
            "ไฟล์เข้าครบทั้งฝั่งธนาคารและฝั่ง BO",
            "มีไฟล์เพิ่มเข้ามาทีหลัง — จะกระทบยอดใหม่ทั้งชุด",
            "เปลี่ยนกฎธนาคารหรือ tolerance — ระบบจะอ่านไฟล์เดิมใหม่ด้วยกฎใหม่แล้วกระทบยอดใหม่",
            "ถึงเวลาตามตารางที่ตั้งไว้ในหน้า “ตั้งเวลา & ความปลอดภัย”",
          ],
        },
        { t: "img", src: IMG("08-engine-validation"), cap: "ตารางตรวจความถูกต้องของเครื่องจับคู่ ท้ายหน้านำเข้าข้อมูล" },
        { t: "p", text: "ตารางนี้เทียบจำนวนที่ระบบตรวจพบ กับจำนวนข้อบกพร่องที่จงใจใส่ไว้ในไฟล์ตัวอย่าง ใช้ยืนยันว่าเครื่องจับคู่ทำงานถูก ไม่ใช่แค่แสดงตัวเลขสวย ๆ" },
        { t: "warn", text: "ถ้าไฟล์ยังไม่ครบทั้งสองฝั่ง ระบบจะรอ ไม่กระทบยอดครึ่ง ๆ กลาง ๆ เพราะจะทำให้เกิดรายการผิดปกติปลอมเต็มไปหมด" },
      ],
    },
    {
      id: "intake",
      group: "งานประจำวัน",
      title: "ตรวจไฟล์ (Intake Control)",
      blocks: [
        { t: "img", src: IMG("12-intake"), cap: "เช็คลิสต์ไฟล์รายบริษัท" },
        { t: "p", text: "หน้านี้ตอบคำถามเดียว: วันนี้ได้ไฟล์ครบและถูกต้องหรือยัง" },
        {
          t: "table",
          head: ["สถานะไฟล์", "ต้องทำอะไร"],
          rows: [
            ["รับแล้ว", "ผ่าน quality gate ไม่ต้องทำอะไร"],
            ["ส่งช้า", "รับแล้วแต่เกินเวลาที่ตกลง ควรแจ้งผู้ส่ง"],
            ["ผิดบริษัท", "ไฟล์ไม่ตรงกับบริษัทที่ระบุ ต้องขอไฟล์ใหม่"],
            ["ไม่ได้ส่ง", "กด “ทวงไฟล์” เพื่อแจ้งเตือนผู้ส่ง"],
          ],
        },
        { t: "p", text: "ส่วนล่างของหน้าแยกให้ชัดว่าอะไรที่ระบบตรวจอัตโนมัติ (ไฟล์ถูกบริษัทไหม วันที่ตรงไหม checksum ซ้ำไหม) และอะไรที่ยังต้องใช้คนตรวจ (อ่านไฟล์ชี้แจง ตัดสินว่าเป็นความเสียหายจริงไหม อนุมัติการลงโทษ)" },
      ],
    },
    {
      id: "dashboard",
      group: "งานประจำวัน",
      title: "แดชบอร์ด",
      blocks: [
        { t: "img", src: IMG("10-kpi-tiles"), cap: "ตัวเลขสรุป 5 ตัวบนสุด" },
        {
          t: "ul",
          items: [
            "<b>Transactions</b> — จำนวนรายการฝั่งธนาคารทั้งวัน",
            "<b>Matched</b> — จับคู่สำเร็จกี่รายการ และคิดเป็นกี่เปอร์เซ็นต์",
            "<b>Diff / Missing</b> — รายการที่ไม่ตรง ต้องเข้าไปเคลียร์ในคิว",
            "<b>เกิน SLA</b> — เคสที่เลยกำหนดชี้แจงแล้ว ต้องเร่งวันนี้",
            "<b>ไฟล์ที่ตรวจแล้ว</b> — สัดส่วนไฟล์ที่ผ่าน quality gate",
          ],
        },
        { t: "img", src: IMG("11-hourly-chart"), cap: "กราฟรายการต่อชั่วโมง แยกเป็นสองกราฟที่ใช้แกนของตัวเอง" },
        { t: "p", text: "เจตนาแยกเป็นสองกราฟ ไม่ได้ใส่แกน y คู่ในกราฟเดียว เพราะปริมาณรายการกับจำนวนที่ไม่ match ต่างสเกลกันหลายสิบเท่า ถ้าวาดทับกันจะอ่านผิดได้ง่าย" },
        { t: "img", src: IMG("09-dashboard"), cap: "ส่วนล่าง: แยกตามประเภท กะ บัญชี ความรุนแรง SLA และความเสียหาย" },
        { t: "tip", text: "แถบสัดส่วนความรุนแรงและแถวใต้แถบกดได้ กดแล้วจะพาไปหน้ารายการผิดปกติที่กรองระดับนั้นไว้ให้แล้ว เอาเมาส์ชี้กราฟทุกอันจะขึ้นตัวเลขให้ดู" },
      ],
    },

    {
      id: "queue",
      group: "ตรวจสอบ",
      title: "คิวรายการผิดปกติ",
      blocks: [
        { t: "img", src: IMG("13-exceptions"), cap: "คิวรายการผิดปกติ พร้อมค้นหาและตัวกรอง" },
        { t: "p", text: "คิวนี้คือรายการที่ไม่ผ่านการจับคู่ หรือผ่านการจับคู่แต่ผิดกฎธุรกิจ ทำงานได้จริงทั้งหมด: พิมพ์ค้นหา, กรองตามประเภท/ระดับ/สถานะ, ติ๊กเฉพาะที่เลย SLA, กดหัวคอลัมน์เพื่อเรียง และแบ่งหน้า" },
        { t: "p", text: "คอลัมน์ <b>ผลต่าง / ยอดที่ต้องตรวจ</b> แสดงตามความหมายของแต่ละประเภท เช่น รายการที่เวลาเกินเกณฑ์จะแสดงเป็นวินาที รายการที่หาไม่เจอจะบอกว่าไม่พบฝั่งไหน และมีบรรทัดเล็กบอกยอดเงินที่ต้องตรวจกำกับไว้" },
        {
          t: "table",
          head: ["ระดับ", "ความหมาย", "SLA"],
          rows: [
            ["Critical", "มีโอกาสเสียหายทางการเงินจริง", "4 ชม."],
            ["High", "หัวหน้ากะต้องชี้แจงภายในวันเดียวกัน", "8 ชม."],
            ["Medium", "รอหลักฐานได้ 2-3 วัน", "48 ชม."],
            ["Low", "known issue หรือเป็นเรื่องเวลาเหลื่อมกัน", "72 ชม."],
          ],
        },
        { t: "p", text: "แถวที่มีขีดแดงด้านซ้ายและจุดแดงข้างเลขเคส คือเคสที่เลย SLA แล้ว" },
      ],
    },
    {
      id: "case",
      group: "ตรวจสอบ",
      title: "เปิดดูรายละเอียดเคส",
      blocks: [
        { t: "p", text: "คลิกที่แถวใดก็ได้ในคิว จะเปิดแผงรายละเอียดด้านขวา" },
        { t: "img", src: IMG("14-drawer"), cap: "แผงรายละเอียดเคส ส่วนบน: ข้อมูลสรุปและ Evidence Timeline", small: true },
        { t: "p", text: "<b>Evidence Timeline</b> คือหัวใจของหน้านี้ — เห็นข้อมูลดิบทั้งฝั่งธนาคารและฝั่ง BO ที่ระบบใช้ตัดสิน พร้อมเหตุผลว่าไม่ผ่านเกณฑ์ข้อไหน และ tolerance ที่ใช้ตอนนั้นเป็นเท่าไร ทำให้ตรวจย้อนกลับได้เสมอว่าทำไมเคสนี้ถึงถูกยกขึ้นมา" },
        { t: "img", src: IMG("15-drawer-checklist"), cap: "ส่วนล่าง: หลักฐานแนบ, Close Checklist และช่องใส่ note", small: true },
        {
          t: "steps",
          items: [
            "<b>แนบหลักฐาน</b> — กด “แนบสลิป / ไฟล์ชี้แจง” เลือกไฟล์ได้หลายไฟล์ แนบแล้วกด “เปิดดู” เพื่อดูภาพได้",
            "<b>ใส่ note</b> — พิมพ์สิ่งที่ตรวจพบแล้วกดบันทึก note เดิมลบไม่ได้ ทุกอันจะไปต่อท้าย timeline พร้อมชื่อและเวลา",
            "<b>ส่งให้หัวหน้ากะชี้แจง</b> — เปลี่ยนสถานะเป็น “รอชี้แจง”",
            "<b>ตอบชี้แจง + แนบหลักฐาน</b> — ปุ่มนี้สำหรับ Shift Lead",
            "<b>บันทึกเป็นความเสียหาย</b> — ส่งเคสเข้าทะเบียนความเสียหาย ต้องมีหลักฐานก่อน",
            "<b>อนุมัติและปิดเคส</b> — ปิดได้ต่อเมื่อ Close Checklist ครบทุกข้อ",
          ],
        },
        { t: "warn", text: "Close Checklist บังคับให้มีครบ 6 ข้อก่อนปิดเคส: ข้อมูลดิบทั้งสองฝั่ง, สาเหตุ, ผู้รับผิดชอบ, หลักฐาน, note จาก Audit และการระบุยอดเสียหาย เป็นกฎที่ตั้งใจไว้ไม่ให้ปิดเคสลอย ๆ" },
        { t: "tip", text: "กดปุ่ม Esc เพื่อปิดแผงรายละเอียดได้เร็ว ๆ" },
      ],
    },
    {
      id: "match",
      group: "ตรวจสอบ",
      title: "ตรวจการจับคู่ 3 จุด",
      blocks: [
        { t: "img", src: IMG("16-matching"), cap: "หน้าตรวจการจับคู่ทีละรายการ" },
        { t: "p", text: "หน้านี้ใช้ตอนอยากรู้ว่า “ทำไมรายการนี้ถึงไม่ match” โดยดูทีละรายการแล้วกดลูกศรเลื่อนไปเรื่อย ๆ" },
        {
          t: "table",
          head: ["จุดที่ตรวจ", "ดูอะไร"],
          rows: [
            ["Bank Account", "เลขบัญชีตรงกับ master list ของบริษัทหรือไม่"],
            ["Time Window", "เวลาทั้งสองฝั่งห่างกันเกิน tolerance หรือไม่"],
            ["Amount", "ยอดเงินต่างกันเกินเกณฑ์แจ้งเตือนหรือไม่"],
            ["Business Rule", "ผิดกฎธุรกิจข้ออื่นหรือไม่ เช่น เติมซ้ำ เติมย้อนหลัง ข้ามวัน บัญชีปลายทางผิด"],
          ],
        },
        { t: "p", text: "จุดที่ 4 มีไว้เพราะรายการบางประเภทผ่านครบ 3 จุดหลักได้ แต่ยังผิดกฎอยู่ เช่นรายการที่ถูกเติมซ้ำ — บัญชี เวลา และยอดตรงกันหมด แต่ฝั่ง BO มีสองรายการ" },
        { t: "p", text: "ด้านล่างปรับ tolerance ได้ทันที (เฉพาะบทบาทที่มีสิทธิ์) พอกดบันทึก ระบบจะอ่านไฟล์เดิมใหม่และกระทบยอดใหม่ให้เอง จึงลองปรับเกณฑ์ดูผลได้เลย" },
      ],
    },
    {
      id: "approve",
      group: "ตรวจสอบ",
      title: "อนุมัติ / ปิดเคส",
      blocks: [
        { t: "img", src: IMG("17-approvals"), cap: "คิวรออนุมัติ" },
        { t: "p", text: "หน้านี้รวมเคสที่รอชี้แจง ชี้แจงแล้ว และที่บันทึกเป็นความเสียหายไว้ในที่เดียว สำหรับ Audit Lead ใช้เคลียร์งานรวดเดียว" },
        {
          t: "ul",
          items: [
            "<b>อนุมัติ</b> — ปิดเคส จะกดได้ต่อเมื่อมีหลักฐานครบ ถ้ายังไม่มีปุ่มจะจางและกดไม่ได้",
            "<b>ส่งกลับ</b> — ส่งกลับให้ชี้แจงเพิ่ม เปลี่ยนสถานะเป็น “รอชี้แจง”",
            "กดที่เลขเคสเพื่อเปิดรายละเอียดเต็มก่อนตัดสินใจ",
          ],
        },
      ],
    },

    {
      id: "damage",
      group: "ความเสียหาย",
      title: "ทะเบียนความเสียหาย",
      blocks: [
        { t: "img", src: IMG("18-damage"), cap: "ทะเบียนความเสียหาย แยกตามรอบชี้แจง" },
        { t: "p", text: "แบ่งเป็น 3 รอบตามที่ตกลงกับแผนก คลิกที่การ์ดรอบเพื่อสลับดูข้อมูลของรอบนั้น" },
        {
          t: "table",
          head: ["รอบ", "ช่วงวันที่"],
          rows: [
            ["รอบ 1", "วันที่ 1-15"],
            ["รอบ 2", "วันที่ 16-25"],
            ["รอบ 3", "วันที่ 26 ถึงสิ้นเดือน"],
          ],
        },
        { t: "p", text: "กราฟสองอันบนบอกว่าความเสียหายกระจุกอยู่ที่กะไหนและพนักงานคนไหน ใช้หาสาเหตุเชิงกระบวนการ" },
        { t: "warn", text: "ปิดรอบไม่ได้ถ้ายังมีเคสที่ไม่มีหลักฐาน และเมื่อปิดรอบแล้วข้อมูลจะถูกล็อก การแก้ย้อนหลังต้องมีเหตุผลและการอนุมัติใหม่" },
        { t: "tip", text: "ปุ่ม “Export ส่งการเงิน” จะออกไฟล์ Excel ของรอบที่เลือกอยู่ ตามช่วงวันที่ในแถบตัวกรอง" },
      ],
    },
    {
      id: "pm",
      group: "ความเสียหาย",
      title: "บัญชี PM",
      blocks: [
        { t: "img", src: IMG("19-pm"), cap: "หน้า PM Monitor" },
        { t: "p", text: "รวมบัญชี PM ของ AUTOPEER, AZPAY และ Cyberplus ซึ่งมีกฎเฉพาะต่างจากบัญชีธนาคารปกติ" },
        {
          t: "ul",
          items: [
            "เก็บเฉพาะรายการที่สถานะสำเร็จ รายการ FAILED จะถูกกรองออกตั้งแต่ตอนอ่านไฟล์",
            "ต้องกรองวันที่ให้ตรงกับวันที่ตรวจ เพราะ STM ของ PM มักมีวันอื่นปนมา",
            "AZPAY ฝากและถอนอยู่ในบัญชีเดียวกัน ต้องแยกทิศทางจาก marker",
            "ยอดโอนออกต้องตรวจว่าปลายทางเป็นบัญชีของบริษัทหรือไม่",
          ],
        },
        { t: "p", text: "กด “ดูรายการ” ที่การ์ดใดการ์ดหนึ่งเพื่อกระโดดไปคิวรายการผิดปกติที่กรองเฉพาะบริษัทนั้นไว้แล้ว" },
      ],
    },

    {
      id: "kpi",
      group: "รายงาน",
      title: "KPI ตามกะและพนักงาน",
      blocks: [
        { t: "img", src: IMG("20-kpi"), cap: "หน้า KPI" },
        { t: "p", text: "ดูได้ 3 มุม: ตามกะ ตามพนักงาน และตามบริษัท ส่วนตารางด้านล่างสรุปรายคนพร้อมระดับความเสี่ยง" },
        { t: "warn", text: "KPI นี้มีไว้หาสาเหตุเชิงกระบวนการ ไม่ควรใช้ตัดสินลงโทษโดยไม่ผ่านรอบชี้แจงและการอนุมัติ เพราะเคสหนึ่งอาจเกิดจากระบบหรือจากธนาคาร ไม่ใช่ความผิดของคนทำรายการ" },
      ],
    },
    {
      id: "reports",
      group: "รายงาน",
      title: "รายงานและ Export Excel",
      blocks: [
        { t: "img", src: IMG("21-reports"), cap: "หน้ารายงาน" },
        { t: "p", text: "กดปุ่ม <b>Export</b> มุมบนขวา (หรือ “เลือกชุดข้อมูล & Export Excel” ในหน้ารายงาน) จะเปิดหน้าต่างให้เลือก" },
        { t: "img", src: IMG("22-export-dialog"), cap: "หน้าต่าง Export", small: true },
        {
          t: "steps",
          items: [
            "เลือกช่วงวันที่ — มีช่วงสำเร็จรูปให้เลือก หรือกรอกวันเริ่มต้นและสิ้นสุดเอง",
            "ติ๊กชุดข้อมูลที่ต้องการ — แต่ละชุดจะเป็น 1 ชีตในไฟล์เดียวกัน และบอกจำนวนแถวให้เห็นก่อนกด",
            "เลือกรูปแบบไฟล์ Excel หรือ CSV แล้วกดดาวน์โหลด",
          ],
        },
        { t: "p", text: "ไฟล์ Excel ที่ได้จะมีหัวตารางตัวหนา ตรึงหัวตารางไว้ตอนเลื่อน มี autofilter ทุกคอลัมน์ ความกว้างคอลัมน์ตั้งไว้ให้แล้ว และตัวเลขเป็นตัวเลขจริงที่ SUM ได้ทันที พร้อมบรรทัดกำกับว่าเป็นข้อมูลช่วงไหน ใครออก และออกเมื่อไร" },
        { t: "tip", text: "ปุ่ม Export เฉพาะทางในแต่ละหน้า (ความเสียหาย, KPI, Audit Log, รายงานรายวัน/รายเดือน) ก็ออกเป็น Excel ตามช่วงวันที่ที่เลือกอยู่เช่นกัน" },
      ],
    },
    {
      id: "image",
      group: "รายงาน",
      title: "บันทึกรายงานเป็นภาพ",
      blocks: [
        { t: "img", src: IMG("23-panel-camera"), cap: "ปุ่มกล้องจะโผล่ที่มุมขวาบนของการ์ดเมื่อเอาเมาส์ชี้", small: true },
        { t: "p", text: "ทุกการ์ดในทุกหน้ามีปุ่มกล้อง กดแล้วได้ไฟล์ภาพ PNG เฉพาะส่วนนั้น ความละเอียด 2 เท่า เหมาะกับการแปะในไลน์ อีเมล หรือสไลด์รายงาน" },
        { t: "p", text: "ในหน้ารายงานมีปุ่ม <b>บันทึกทั้งหน้าเป็นภาพ</b> ซึ่งจะรวมทุกการ์ดเป็นภาพเดียวเรียงลงมา พร้อมหัวเรื่องและช่วงวันที่กำกับไว้ด้านบน" },
        { t: "p", text: "ชื่อไฟล์จะเป็นภาษาอังกฤษเสมอ เช่น <code>dashboard_severity_2026-08-01.png</code> เพราะเบราว์เซอร์จะตั้งชื่อไฟล์ภาษาไทยเป็น “download” เฉย ๆ ส่วนเนื้อหาในภาพยังเป็นภาษาไทยครบ" },
      ],
    },
    {
      id: "talk",
      group: "รายงาน",
      title: "ถามข้อมูลด้วยภาษาไทย",
      blocks: [
        { t: "img", src: IMG("24-talk"), cap: "หน้า Talk to Data" },
        { t: "p", text: "พิมพ์คำถามเป็นภาษาไทย หรือกดคำถามตัวอย่างด้านล่างช่องพิมพ์ ทุกคำตอบจะอ้างอิงตัวเลขจริงและช่วงวันที่ พร้อมลิงก์กลับไปยังหน้าที่กรองข้อมูลไว้ให้แล้ว" },
        {
          t: "ul",
          items: [
            "“ยอดผิดปกติกะดึกมีเท่าไหร่”",
            "“สาเหตุหลักวันนี้คืออะไร”",
            "“ไฟล์ไหนยังไม่ได้ส่ง”",
            "“ความเสียหายเดือนนี้เท่าไหร่”",
            "“เคสไหนเลย SLA บ้าง”",
            "“บัญชีไหนเกิด diff บ่อยที่สุด”",
          ],
        },
        { t: "warn", text: "ตอนนี้ระบบตอบจากการจับคำสำคัญบนข้อมูลที่ผ่านการกระทบยอดแล้ว ยังไม่ใช่ AI ที่เข้าใจภาษาเต็มรูปแบบ ถ้าถามนอกขอบเขตจะบอกให้ทราบว่าตอบเรื่องอะไรได้บ้าง" },
      ],
    },

    {
      id: "rules",
      group: "ตั้งค่าระบบ",
      title: "กฎธนาคารและ Tolerance",
      blocks: [
        { t: "img", src: IMG("25-rules"), cap: "หน้า Bank Rules" },
        { t: "p", text: "หน้านี้ทำให้ Audit Lead หรือ Admin ปรับกฎได้เองโดยไม่ต้องแก้โปรแกรม" },
        {
          t: "table",
          head: ["ธนาคาร", "กฎที่ใช้"],
          rows: [
            ["SCB", "X1 = รับเงิน, X2 = โอนเงิน, XB = ปรับปรุงยอด (แยกออกจากการจับคู่)"],
            ["KBANK", "กรองบรรทัด “ยอดยกมา” ก่อนจัดเรียง ตรวจเวลา 00:00-23:59"],
            ["GSB", "กรองบรรทัด “รอบวันที่”, Transfer SAV Deposit = รับเงิน, MyMo SAV Withdraw = โอนเงิน"],
            ["BBL / KTB", "ใช้กฎมาตรฐาน จับคู่ตาม account + time + amount"],
          ],
        },
        { t: "p", text: "ด้านล่างมีสวิตช์กฎการทำงาน เช่น บังคับแนบหลักฐานก่อนปิดเคส, ห้ามลบข้อมูลหลัง import, ตรวจช่วงข้ามวัน 23:00-23:59 และกรองเฉพาะรายการ PM ที่สำเร็จ" },
        { t: "tip", text: "ทุกครั้งที่เปลี่ยนกฎ ระบบจะอ่านไฟล์เดิมใหม่ด้วยกฎใหม่แล้วกระทบยอดใหม่ให้เอง จึงเห็นผลกระทบทันทีว่ากฎนั้นทำให้เคสเพิ่มหรือลด" },
      ],
    },
    {
      id: "notify",
      group: "ตั้งค่าระบบ",
      title: "การแจ้งเตือน",
      blocks: [
        { t: "img", src: IMG("27-notifications"), cap: "ศูนย์การแจ้งเตือน" },
        { t: "p", text: "กระดิ่งมุมบนขวาจะขึ้นตัวเลขสีแดงเมื่อมีเรื่องที่ยังไม่อ่าน กดกระดิ่งเพื่อเข้าหน้านี้" },
        {
          t: "ul",
          items: [
            "แจ้งเมื่อไฟล์ขาดหรือส่งผิดบริษัท",
            "แจ้งเมื่อพบรายการระดับ Critical",
            "แจ้งเมื่อมีเคสเลย SLA",
            "แจ้งเมื่อใกล้ครบรอบชี้แจง",
          ],
        },
        { t: "p", text: "เปิดปิดแต่ละเงื่อนไขและเลือกช่องทางได้ที่การ์ดขวามือ ปุ่ม “ตรวจเงื่อนไขเดี๋ยวนี้” ใช้สั่งให้ระบบประเมินสถานการณ์ปัจจุบันใหม่ทันที" },
      ],
    },
    {
      id: "schedule",
      group: "ตั้งค่าระบบ",
      title: "ตั้งเวลาและความปลอดภัย",
      blocks: [
        { t: "img", src: IMG("28-schedule"), cap: "หน้าตารางเวลาและความปลอดภัย" },
        { t: "p", text: "<b>ตารางเวลา</b> — เปิดใช้แล้วกำหนดว่าให้ทำงานทุกกี่นาที ระบบจะดึงไฟล์จากกล่องอีเมลกลางแล้วกระทบยอดให้เอง พร้อมแจ้งเตือนเมื่อเสร็จ และแสดงเวลารอบถัดไป" },
        { t: "p", text: "<b>นโยบายข้อมูล</b> — ตั้งระยะเวลาเก็บข้อมูลย้อนหลัง เปิดการสำรองรายวัน การเข้ารหัสข้อมูลการเงิน และการปิดบังเลขบัญชีสำหรับบทบาทที่ไม่จำเป็นต้องเห็น" },
        { t: "p", text: "<b>ทดสอบ performance</b> — เลือกจำนวนรายการ 50,000 / 100,000 / 200,000 แล้วกดเริ่มทดสอบ ระบบจะสร้างชุดข้อมูลและกระทบยอดจริง แล้วรายงานเวลาที่ใช้ อัตราการจับคู่ และความเร็วต่อวินาที" },
        { t: "warn", text: "ตัวตั้งเวลานี้ทำงานขณะเปิดหน้าเว็บไว้เท่านั้น ในระบบจริงที่มี server จะย้ายไปเป็น cron หรือ job queue ที่ทำงานตลอดเวลา" },
      ],
    },
    {
      id: "log",
      group: "ตั้งค่าระบบ",
      title: "Audit Log",
      blocks: [
        { t: "img", src: IMG("29-auditlog"), cap: "บันทึกการใช้งานระบบ" },
        { t: "p", text: "ทุกการกระทำสำคัญถูกบันทึกไว้: การนำเข้าไฟล์, การกระทบยอด, การใส่ note, การเปลี่ยนสถานะ, การแนบหลักฐาน, การอนุมัติ, การแก้ตั้งค่า และการ export" },
        { t: "p", text: "แต่ละบรรทัดเก็บเวลา ผู้ทำรายการ ประเภทการกระทำ เป้าหมาย และรายละเอียด ใช้ช่องค้นหาด้านบนกรองได้ และ export เป็น Excel ได้" },
        { t: "warn", text: "Audit Log เขียนได้อย่างเดียว ไม่มีบทบาทใดแก้หรือลบได้ ตามข้อกำหนดด้านการควบคุมภายใน" },
      ],
    },

    {
      id: "faq",
      group: "อื่น ๆ",
      title: "คำถามที่พบบ่อย",
      blocks: [
        {
          t: "qa",
          items: [
            ["ทำไมกดแล้วไม่มีอะไรเกิดขึ้น / ปุ่มจาง ๆ", "บทบาทที่เลือกอยู่ไม่มีสิทธิ์นั้น ลองสลับ “มุมมองสิทธิ์” มุมบนขวาเป็น Audit Lead แล้วลองใหม่"],
            ["ปุ่มสั่งกระทบยอดหายไปไหน", "ตัดออกแล้ว เพราะระบบทำงานเองเมื่อไฟล์เข้าครบทั้งสองฝั่ง ดูสถานะได้ที่ชิปมุมบนขวา"],
            ["ตัวเลขในหน้าต่าง ๆ ไม่ตรงกับที่คาด", "เช็คแถบตัวกรองก่อน โดยเฉพาะช่วงวันที่ บรรทัดสรุปใต้ตัวกรองจะบอกว่ากำลังดูช่วงไหนอยู่"],
            ["รีเฟรชแล้วข้อมูลที่นำเข้าหายไป", "ข้อมูลที่นำเข้ายังอยู่ในหน่วยความจำเบราว์เซอร์เท่านั้น เพราะยังไม่มีฐานข้อมูล ส่วนสถานะเคส การแจ้งเตือน และการตั้งค่าจะถูกเก็บไว้ให้"],
            ["อัปโหลดไฟล์ .xlsx แล้วขึ้นว่าอ่านไม่ได้", "การอ่านไฟล์ Excel ต้องต่ออินเทอร์เน็ตครั้งแรกเพื่อโหลดตัวอ่าน ถ้าออฟไลน์ให้บันทึกไฟล์เป็น .csv ก่อน (การเขียนไฟล์ Excel ใช้ได้ออฟไลน์เสมอ)"],
            ["ไฟล์ที่ดาวน์โหลดชื่อ “download” เฉย ๆ", "เกิดกับไฟล์ชื่อภาษาไทย ระบบจึงตั้งชื่อไฟล์เป็นภาษาอังกฤษทั้งหมด ถ้ายังเจอให้แจ้งทีมพัฒนา"],
            ["อยากได้ข้อมูลย้อนหลังหลายเดือนในไฟล์เดียว", "ตั้งช่วงวันที่ในแถบตัวกรองหรือในหน้าต่าง Export ให้ครอบคลุมช่วงที่ต้องการ แล้วเลือกชุดข้อมูลที่ต้องการทั้งหมดในครั้งเดียว"],
          ],
        },
        { t: "p", text: "ยังไม่เจอคำตอบ ให้ดูหัวข้อ “สิ่งที่ต้องพัฒนาต่อ” ในเมนูระบบ ซึ่งสรุปไว้ว่าอะไรทำได้แล้วและอะไรต้องรอเฟสถัดไป" },
      ],
    },
  ];

  /* ---------------- state ---------------- */
  const st = {
    open: false,
    x: null,
    y: null,
    w: 1000,
    h: 660,
    fabX: null,
    fabY: null,
    section: SECTIONS[0].id,
  };
  const store = () => (typeof Store !== "undefined" ? Store : null);
  function load() {
    const s = store();
    if (s && s.data.manual) Object.assign(st, s.data.manual);
  }
  function save() {
    const s = store();
    if (!s) return;
    s.data.manual = { ...st };
    s.persist();
  }

  const esc = (v) => String(v ?? "");

  /* ---------------- render blocks ---------------- */
  function blockHtml(b) {
    switch (b.t) {
      case "p":
        return `<p>${b.text}</p>`;
      case "ul":
        return `<ul class="mn-ul">${b.items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
      case "steps":
        return `<ol class="mn-steps">${b.items.map((i) => `<li>${i}</li>`).join("")}</ol>`;
      case "img": {
        const key = String(b.src).replace(/^manual\//, "").replace(/\.png$/, "");
        const sz = IMG_SIZE[key] || [1180, 700];
        return `<figure class="mn-fig ${b.small ? "small" : ""}"><img src="${esc(b.src)}" alt="${esc(b.cap || "")}" width="${sz[0]}" height="${sz[1]}" loading="lazy" data-zoom="${esc(b.src)}" /><figcaption>${esc(b.cap || "")} <span class="mn-zoom-hint">คลิกเพื่อดูภาพใหญ่</span></figcaption></figure>`;
      }
      case "tip":
        return `<div class="mn-note tip"><b>เคล็ดลับ</b><span>${b.text}</span></div>`;
      case "warn":
        return `<div class="mn-note warn"><b>ข้อควรระวัง</b><span>${b.text}</span></div>`;
      case "table":
        return `<table class="mn-table"><thead><tr>${b.head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${b.rows
          .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`;
      case "qa":
        return `<div class="mn-qa">${b.items.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</div>`;
      default:
        return "";
    }
  }

  function contentHtml() {
    let lastGroup = "";
    return SECTIONS.map((s) => {
      const head = s.group !== lastGroup ? `<div class="mn-group-mark">${s.group}</div>` : "";
      lastGroup = s.group;
      return `<section class="mn-section" id="mn-${s.id}">${head}<h3>${s.title}</h3>${s.blocks.map(blockHtml).join("")}</section>`;
    }).join("");
  }

  function tocHtml() {
    let lastGroup = "";
    return SECTIONS.map((s) => {
      const head = s.group !== lastGroup ? `<span class="mn-toc-group">${s.group}</span>` : "";
      lastGroup = s.group;
      return `${head}<a href="#mn-${s.id}" data-mn-goto="${s.id}" class="${st.section === s.id ? "on" : ""}">${s.title}</a>`;
    }).join("");
  }

  /* ---------------- build DOM ---------------- */
  let win, fab, body, tocEl;
  function build() {
    fab = document.createElement("button");
    fab.className = "mn-fab";
    fab.type = "button";
    fab.title = "เปิดคู่มือการใช้งาน (ลากเพื่อย้ายตำแหน่ง)";
    fab.setAttribute("aria-label", "เปิดคู่มือการใช้งาน");
    fab.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm.1 15.6a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Zm.2-11.6c2.3 0 3.9 1.4 3.9 3.4 0 1.4-.7 2.3-1.9 3.1-.9.6-1.2 1-1.2 1.8v.4h-2v-.6c0-1.4.5-2.2 1.7-3 .9-.6 1.3-1 1.3-1.7 0-.9-.7-1.5-1.8-1.5s-1.9.7-2 1.8H8.3C8.4 7.5 10 6 12.3 6Z"/></svg><span>คู่มือ</span>`;
    document.body.appendChild(fab);

    win = document.createElement("section");
    win.className = "mn-win";
    win.hidden = true;
    win.setAttribute("role", "dialog");
    win.setAttribute("aria-label", "คู่มือการใช้งาน");
    win.innerHTML = `
      <header class="mn-head">
        <div class="mn-title">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h9l5 5v15H6V2Zm8 1.5V8h4.5L14 3.5ZM8.5 11h7v1.6h-7V11Zm0 3.4h7V16h-7v-1.6Z"/></svg>
          <div><b>คู่มือการใช้งาน</b><span>Audit AI Reconciliation</span></div>
        </div>
        <div class="mn-actions">
          <input type="search" class="mn-search" id="mnSearch" placeholder="ค้นหาหัวข้อ..." />
          <button class="mn-btn" id="mnMin" title="ย่อเป็นปุ่มกลม">—</button>
          <button class="mn-btn" id="mnClose" title="ปิด">✕</button>
        </div>
      </header>
      <div class="mn-body">
        <nav class="mn-toc" id="mnToc">${tocHtml()}</nav>
        <div class="mn-content" id="mnContent">${contentHtml()}</div>
      </div>
      <div class="mn-resize" id="mnResize" title="ลากเพื่อปรับขนาด"></div>`;
    document.body.appendChild(win);

    body = win.querySelector("#mnContent");
    tocEl = win.querySelector("#mnToc");

    /* สารบัญ */
    tocEl.addEventListener("click", (e) => {
      const a = e.target.closest("[data-mn-goto]");
      if (!a) return;
      e.preventDefault();
      const target = body.querySelector("#mn-" + a.dataset.mnGoto);
      if (!target) return;
      const top = target.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 10;
      body.scrollTo({ top, behavior: "smooth" });
    });

    /* ไฮไลต์หัวข้อตามที่เลื่อนอยู่ */
    let ticking = false;
    body.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const base = body.getBoundingClientRect().top + 60;
        let cur = SECTIONS[0].id;
        for (const s of SECTIONS) {
          const el = body.querySelector("#mn-" + s.id);
          if (el && el.getBoundingClientRect().top <= base) cur = s.id;
        }
        if (cur !== st.section) {
          st.section = cur;
          tocEl.querySelectorAll("a").forEach((a) => a.classList.toggle("on", a.dataset.mnGoto === cur));
          const active = tocEl.querySelector("a.on");
          if (active) active.scrollIntoView({ block: "nearest" });
        }
        ticking = false;
      });
    });

    /* ค้นหาหัวข้อ */
    win.querySelector("#mnSearch").addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      tocEl.querySelectorAll("a").forEach((a) => {
        const s = SECTIONS.find((x) => x.id === a.dataset.mnGoto);
        const hay = (s.title + " " + s.group + " " + JSON.stringify(s.blocks)).toLowerCase();
        a.style.display = !q || hay.includes(q) ? "" : "none";
      });
      tocEl.querySelectorAll(".mn-toc-group").forEach((g) => (g.style.display = q ? "none" : ""));
    });

    /* ดูภาพใหญ่ */
    body.addEventListener("click", (e) => {
      const img = e.target.closest("[data-zoom]");
      if (!img) return;
      const lb = document.createElement("div");
      lb.className = "mn-lightbox";
      lb.innerHTML = `<img src="${img.dataset.zoom}" alt="" /><button class="mn-btn" aria-label="ปิด">✕</button>`;
      lb.addEventListener("click", () => lb.remove());
      document.body.appendChild(lb);
    });

    win.querySelector("#mnMin").addEventListener("click", () => close());
    win.querySelector("#mnClose").addEventListener("click", () => close());

    makeDraggable(win.querySelector(".mn-head"), win, (x, y) => {
      st.x = x;
      st.y = y;
      save();
    });
    makeResizable(win.querySelector("#mnResize"), win, (w, h) => {
      st.w = w;
      st.h = h;
      save();
    });
    makeFabDraggable();

    applyPosition();
  }

  /* ---------------- ลากและปรับขนาด ---------------- */
  function makeDraggable(handle, target, onEnd) {
    handle.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button, input")) return;
      const r = target.getBoundingClientRect();
      const dx = e.clientX - r.left;
      const dy = e.clientY - r.top;
      handle.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const x = Math.min(Math.max(ev.clientX - dx, 4), window.innerWidth - r.width - 4);
        const y = Math.min(Math.max(ev.clientY - dy, 4), window.innerHeight - 48);
        target.style.left = x + "px";
        target.style.top = y + "px";
        target.style.right = "auto";
        target.style.bottom = "auto";
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        onEnd(parseInt(target.style.left, 10), parseInt(target.style.top, 10));
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });
  }

  function makeResizable(handle, target, onEnd) {
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const r = target.getBoundingClientRect();
      const sx = e.clientX;
      const sy = e.clientY;
      handle.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const w = Math.max(560, Math.min(r.width + ev.clientX - sx, window.innerWidth - 20));
        const h = Math.max(360, Math.min(r.height + ev.clientY - sy, window.innerHeight - 20));
        target.style.width = w + "px";
        target.style.height = h + "px";
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        onEnd(Math.round(target.getBoundingClientRect().width), Math.round(target.getBoundingClientRect().height));
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });
  }

  /* ปุ่มกลม: ลากเพื่อย้าย ถ้าไม่ได้ลากถือว่าคลิก */
  function makeFabDraggable() {
    let moved = false;
    fab.addEventListener("pointerdown", (e) => {
      const r = fab.getBoundingClientRect();
      const dx = e.clientX - r.left;
      const dy = e.clientY - r.top;
      moved = false;
      fab.setPointerCapture(e.pointerId);
      const move = (ev) => {
        if (Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) > 4) moved = true;
        if (!moved) return;
        const x = Math.min(Math.max(ev.clientX - dx, 6), window.innerWidth - r.width - 6);
        const y = Math.min(Math.max(ev.clientY - dy, 6), window.innerHeight - r.height - 6);
        fab.style.left = x + "px";
        fab.style.top = y + "px";
        fab.style.right = "auto";
        fab.style.bottom = "auto";
        fab.classList.add("dragging");
      };
      const up = () => {
        fab.removeEventListener("pointermove", move);
        fab.removeEventListener("pointerup", up);
        fab.classList.remove("dragging");
        if (moved) {
          st.fabX = parseInt(fab.style.left, 10);
          st.fabY = parseInt(fab.style.top, 10);
          save();
        } else open();
      };
      fab.addEventListener("pointermove", move);
      fab.addEventListener("pointerup", up);
    });
  }

  function applyPosition() {
    if (st.fabX !== null && st.fabY !== null) {
      fab.style.left = Math.min(st.fabX, window.innerWidth - 70) + "px";
      fab.style.top = Math.min(st.fabY, window.innerHeight - 70) + "px";
      fab.style.right = "auto";
      fab.style.bottom = "auto";
    }
    win.style.width = st.w + "px";
    win.style.height = st.h + "px";
    if (st.x !== null && st.y !== null) {
      win.style.left = Math.min(st.x, Math.max(window.innerWidth - st.w - 8, 8)) + "px";
      win.style.top = Math.min(st.y, Math.max(window.innerHeight - 80, 8)) + "px";
      win.style.right = "auto";
      win.style.bottom = "auto";
    }
  }

  /* ---------------- เปิด / ปิด ---------------- */
  function open(sectionId) {
    if (!win) build();
    win.hidden = false;
    fab.classList.add("hidden");
    st.open = true;
    requestAnimationFrame(() => win.classList.add("on"));
    if (sectionId) {
      const t = body.querySelector("#mn-" + sectionId);
      if (t) body.scrollTop = t.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 10;
    }
    save();
  }
  function close() {
    if (!win) return;
    win.classList.remove("on");
    st.open = false;
    setTimeout(() => (win.hidden = true), 180);
    fab.classList.remove("hidden");
    save();
  }
  function toggle() {
    st.open ? close() : open();
  }

  function init() {
    load();
    build();
    if (st.open) open();
    window.addEventListener("resize", applyPosition);
    document.addEventListener("keydown", (e) => {
      if (e.key === "F1") {
        e.preventDefault();
        toggle();
      }
    });
  }

  return { init, open, close, toggle, SECTIONS };
})();
