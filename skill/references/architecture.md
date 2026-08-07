# สถาปัตยกรรมและรายละเอียดโค้ด

## ลำดับ script ใน index.html

ลำดับสำคัญ — โมดูลล่างพึ่งโมดูลบน

```html
<!-- CDN สองตัวนี้เป็นแค่ของเสริม ไม่มีก็ทำงานได้ -->
xlsx.full.min.js        SheetJS (ถ้ามีจะใช้ก่อน XlsxReader)
html2canvas.min.js      ถ้าไม่มีจะใช้ตัวจับภาพ SVG foreignObject แทน

xlsx-reader.js          ต้องมาก่อน engine
formats.js              ต้องมาก่อน engine และ pdf-stm
pdf-stm.js
rules.js
data.js                 สร้าง DB
sample.js
engine.js
store.js                ต้องมาก่อน fx / supabase (ทั้งคู่เก็บ config ใน Store)
fx.js
supabase.js
gmail.js
charts.js
xlsx-writer.js
export.js
docs.js
app.js                  ต้องมาหลังทุกอย่าง
manual.js
vendor/pdf.min.js       โหลดแบบ lazy ตอนอ่าน PDF ครั้งแรก
```

---

## เส้นทางข้อมูลตอนนำไฟล์เข้า

```
ingestRaw(name, buffer)
  ├─ .pdf   → PdfStm.parse()          → registerAccountFromStatement()
  └─ อื่นๆ  → Engine.parseSheet()      → Engine.normalize()
                                            ├─ Formats.parse()   ← ลองรูปแบบจริงก่อน
                                            └─ generic path      ← ตกมาที่นี่ถ้าไม่ตรง
  ↓
ImportState.files[]
  ↓
scheduleAutoReconcile()  ← ทำงานเองเมื่อไฟล์เข้าครบ (ไม่มีปุ่ม Run)
  ↓
runReconcileFromImport()
  ├─ Formats.merge(bo)              ยุบรายการซ้ำข้ามรายงานด้วย UUID
  ├─ Engine.reconcile(stm, bo)      จับคู่ 5 pass
  ├─ runBusinessRules()             Rules.run()
  ├─ ยุบ exception ที่ซ้ำกัน          key: type|account|time|systemAmount
  └─ applyRunResult()
        ├─ retagTracks()            เติม track จากระบบของบริษัท
        ├─ เลื่อน state.filters ไปวันที่ของข้อมูล
        └─ checkFxCoverage()
```

**ถ้ามีแต่ไฟล์ BO ยังไม่มี statement** ระบบยังตรวจกฎธุรกิจให้ได้ (`autoReadiness().rulesOnly`)

---

## Engine.reconcile — 5 pass

1. จับคู่ตรง `account+amount` เลือกตัวที่เวลาใกล้สุดภายใน tolerance
2. ยอดไม่ตรง — บัญชีเดียวกัน เวลาใกล้กัน แต่ยอดต่าง → `amount_diff`
3. STM ที่เหลือ → `missing_bo` (หรือ `cross_day` ถ้าอยู่ช่วง 23:00-23:59)
4. BO ที่เหลือ — **ถ้าช่องทางนั้นไม่มีไฟล์ statement เลย ให้เข้า `noStmSide` ไม่ใช่ exception**
5. จุดตรวจที่ 4 — ธนาคาร/เลขท้ายบัญชีลูกค้าเทียบกับข้อความในสลิป

`tolOf(direction, s, b)` — ถ้าฝั่งใดฝั่งหนึ่ง `minutePrecision` จะยกพื้นเป็น `settings.minuteTolerance` (60 วิ)

---

## สิทธิ์ตาม role

| role | ทำอะไรได้ |
|---|---|
| `monitor` | view, note, status, request_clarify, export, fx |
| `lead` | ของ monitor + approve, close_case, close_cycle, rules |
| `shift_lead` | view, respond, attach — ตอบชี้แจงและแนบหลักฐานเท่านั้น |
| `exec` | view, export |
| `admin` | view, rules, users, settings, export, fx |

`can(cap)` เช็คสิทธิ์ · `deny(what)` ขึ้น toast แจ้งเตือน

---

## Store (localStorage)

key `audit-ai-state-v1` มี fallback เป็น in-memory ถ้า localStorage ใช้ไม่ได้

```js
{
  exOverrides, extraDamages, auditLog, settings, notifications, notifyRules,
  schedule, retention,
  fxRates: [],            // อัตรา USDT/THB รายวัน
  companySystems: {},     // { AT4: "SYS123", FR8: "XB" }
  gmail: {...},           // clientId, query, pulledIds
  supabase: {...},        // url, anonKey, bucket, email
  sbSession: {...}
}
```

---

## Supabase (ดึงไฟล์จากเมลอัตโนมัติ)

```
Gmail work.ltd89 label AUDIT 2
  → n8n Cloud (poll 10 นาที)
      → แกะบริษัท+วันที่จากหัวข้อ → แตก zip → เดาชนิดไฟล์
      → Supabase Storage `audit-files/<date>/<company>/<file>`
      → Google Drive (สำเนา)
      → ทะเบียน mail_batches + source_files
  → ระบบ Audit หน้า "คลังไฟล์จากเมล"
      → โหลดไฟล์จาก Storage → แปลงในเบราว์เซอร์ → เขียนผลกลับ
```

**เจตนาของการแบ่งงาน**: n8n ทำแค่ขนไฟล์กับทำทะเบียน ไม่ย้าย parser ไปเพราะตัวอ่านใน
เบราว์เซอร์ทดสอบกับไฟล์จริงผ่านแล้ว และ PDF parsing ใน n8n ทำยากกว่ามาก

### ตาราง

| ตาราง | หมายเหตุ |
|---|---|
| `mail_batches` | unique `gmail_message_id` — กันเมลซ้ำ |
| `source_files` | unique (batch, file_name, from_zip) |
| `recon_runs` | ผลกระทบยอดแต่ละครั้ง |
| `exceptions` | unique (run_id, code) |
| `fx_rates` | unique `rate_date` + trigger `fx_keep_revision()` เก็บค่าเดิมลง `revisions` |
| `damages` | มี currency + fx_rate + amount_thb |
| `clarify_docs` | |
| `audit_log` | **ไม่มี policy update** จึงแก้ย้อนหลังไม่ได้ |

view: `v_batch_files`, `v_daily_status`

### RLS

ทุกตารางเปิด RLS · policy ให้ `authenticated` เท่านั้น · `anon` อ่านอะไรไม่ได้เลย
Storage bucket `audit-files` เป็น private เปิดไฟล์ผ่าน signed URL 5 นาที
n8n เขียนด้วย `service_role` ซึ่งข้าม RLS อยู่แล้ว

---

## n8n workflow (14 โหนด)

```
Gmail Trigger (label AUDIT 2, downloadAttachments)
  → Code: แกะบริษัท+วันที่จากหัวข้อ
  → HTTP: insert mail_batches (Prefer: resolution=merge-duplicates)
  → Code: แยกไฟล์แนบทีละไฟล์
  → IF: เป็น zip?
       ├─ true  → Compression(decompress) → Code: แยกไฟล์ในzip
       └─ false ─────────────────────────────┐
  → Merge → Code: เดาชนิดไฟล์และตั้ง path ────┘
  → [Storage upload] + [Drive upload] → Merge
  → HTTP: insert source_files
  → HTTP: patch mail_batches status='stored'
```

ค่าที่ต้องแทนก่อน import: `{{ $vars.SUPABASE_URL }}`, `{{ $vars.SUPABASE_SERVICE_KEY }}`,
`{{ $vars.DRIVE_FOLDER_ID }}` — n8n Cloud แพ็กเกจฟรีไม่มีเมนู Variables ต้อง Find & Replace ในไฟล์

การเดาชนิดไฟล์ (โหนด classify) ใช้ชื่อไฟล์:
```
.pdf + /ฝาก\s*-\s*ถอน|statement|stm/  → stm_pdf     อื่นๆ .pdf/.docx → doc_clarify
/รายงานบัญชี(ฝาก|ถอน)/                 → bo_main
/ฝากมือ.*เครดิต/                       → manual_credit
/ฝากมือ.*Payment/i                     → manual_payment
/ฝากมือ.*โบนัส/                        → manual_bonus
/ขอถอนค่าคอม/                          → comm_req
/ถอนเครดิต/                            → credit_out
```

---

## เอกสารที่ระบบออก (docs.js)

พิมพ์ผ่าน hidden iframe → `contentWindow.print()` → ผู้ใช้เลือก "Save as PDF"
เลือกวิธีนี้เพราะฟอนต์ไทยคมชัดที่สุดและไม่ต้องพึ่ง library

- `requestHtml()` — ใบขอให้ชี้แจง เลขที่ `REQ-yyyymmdd-xxx` ตารางรายการ + ช่องว่างให้เขียนตอบ + เซ็น 3 ฝ่าย
- `clarificationHtml()` — เอกสารชี้แจง เลขที่ `CLR-yyyymmdd-xxx` ตารางเทียบ STM/BO + หลักฐาน + สรุปเสียหาย/ไม่เสียหาย

วันที่ในเอกสารใช้รูปแบบของแผนก `dd-mm-yy` พ.ศ. (`thShort()`) เช่น `19-07-69`
ทั้งสองแบบพิมพ์บรรทัดอัตราแลกเปลี่ยนที่ใช้ลงไปด้วย (`fxLine()`)

---

## Export

- **Excel** — `xlsx-writer.js` เขียนเอง (ZIP store + CRC32 + OOXML) ชีตปัจจุบัน:
  Exception, ความเสียหาย, KPI, รายชั่วโมง, อัตราแลกเปลี่ยน (+ รายเดือน, Intake, Audit Log ตามที่เลือก)
- **ภาพ** — `Exporter.capture()` ลอง html2canvas ก่อน ถ้าไม่มีใช้ SVG `foreignObject`
  ถ้ายังไม่ได้ใช้ stitch จาก canvas ของแต่ละ panel

---

## ทดสอบ

Playwright headless Chromium อยู่ใน sandbox แล้ว (`/opt/pw-browsers`)

แพตเทิร์นที่ใช้ประจำ:
```js
await p.goto('file:///home/claude/audit/index.html');
p.on('pageerror', e => errs.push(e.message));
// วนทุก route
const routes = await p.evaluate(() => Object.keys(VIEWS));
// ตรวจ overflow
document.documentElement.scrollWidth - document.documentElement.clientWidth === 0
// โหลดไฟล์จริง
await ingestRaw(name, arrayBuffer, size)
await runReconcileFromImport({ reason: 'test' })
```

**หมายเหตุ**: `go(route)` ตั้ง `location.hash` แล้ว router ทำงานตอน hashchange (async)
ถ้าจะอ่าน DOM ทันทีให้ `location.hash = '#/xxx'` แล้ว `waitForTimeout(300)` หรือเรียก `render()` ตรงๆ

จำลอง Supabase ด้วย `p.route('**/rest/v1/**', route => route.fulfill({json: [...]}))`

---

## ฟอนต์ไทยใน sandbox

`fonts-thai-tlwg` (Garuda/Loma) ติดตั้งแล้ว ใช้ตอนสร้าง PDF ผ่าน Playwright
DOCX ใช้ Tahoma · UI ใช้ Kanit จาก Google Fonts
