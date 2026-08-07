# คู่มือติดตั้ง DomainWatch

ระบบเฝ้าระวังโดเมนและลิงก์กลาง — สำหรับฝ่ายไอที
เวอร์ชัน 1.0 · 4 สิงหาคม 2569

---

## ภาพรวมสถาปัตยกรรม

```
VPS จุดตรวจ AIS   ─┐
VPS จุดตรวจ True  ─┤
VPS จุดตรวจ 3BB   ─┼─→  n8n (webhook)  ─→  Supabase (probe_results / incidents)
VPS จุดตรวจ SG    ─┘         │
                             ├─→  Telegram กลุ่ม War Room
                             ├─→  Twilio โทร + SMS (เฉพาะ P1)
                             └─→  API สลับลิงก์กลาง (Phase 2)

Uptime Kuma  ─→  หน้า Status Dashboard และการตรวจ SSL / โดเมน
Playwright   ─→  Synthetic Journey ล็อกอิน + เปิดหน้าฝาก/ถอน (ชั้น L5)
```

**หลักการสำคัญ:** จุดตรวจต้องอยู่ในประเทศไทยและคนละผู้ให้บริการ เพราะการบล็อกเกิดที่ระดับ ISP
ถ้าตรวจจากต่างประเทศจุดเดียว ระบบจะรายงานว่าปกติตลอดเวลา ทั้งที่ลูกค้าไทยเข้าไม่ได้

---

## ขั้นตอนที่ 1 — เตรียมฐานข้อมูล Supabase

รัน SQL ต่อไปนี้ใน SQL Editor ของ Supabase

```sql
create table if not exists probe_results (
  id            bigserial primary key,
  ts            timestamptz not null default now(),
  domain        text not null,
  checkpoint    text not null,
  isp           text,
  region        text not null default 'TH',
  resolver      text,
  resolved_ip   text,
  dns_ok        boolean,
  tcp_ok        boolean,
  http_ok       boolean,
  keyword_ok    boolean,
  status_code   integer,
  latency_ms    integer,
  ssl_days_left integer,
  ok            boolean not null
);

create index if not exists idx_probe_domain_cp_ts
  on probe_results (domain, checkpoint, ts desc);

create table if not exists incidents (
  id                  bigserial primary key,
  code                text unique,
  opened_at           timestamptz not null default now(),
  acked_at            timestamptz,
  acked_by            text,
  resolved_at         timestamptz,
  domain              text,
  severity            text,
  type                text,
  action              text,
  failing_checkpoints jsonb,
  root_cause          text,
  notes               text
);

create index if not exists idx_incidents_opened on incidents (opened_at desc);
```

**ข้อควรระวังด้านความปลอดภัย:** ระบบนี้ใช้ service key ในการเขียนข้อมูล
ห้ามนำ service key ไปวางไว้ในฝั่งที่ผู้ใช้ทั่วไปเข้าถึงได้ และควรเปิด Row Level Security
สำหรับตารางที่จะให้หน้า Dashboard อ่านโดยตรง

---

## ขั้นตอนที่ 2 — นำเข้า workflow ใน n8n

1. เปิด n8n → เมนู **Workflows** → **Import from File**
2. เลือกไฟล์ `02_n8n_workflow_domainwatch.json`
3. แก้ค่าที่เป็นตัวยึดในโหนดต่อไปนี้ให้เป็นค่าจริง

| โหนด | ค่าที่ต้องแก้ |
|---|---|
| บันทึกผลตรวจลง Supabase | `YOUR-PROJECT.supabase.co` และ `YOUR_SUPABASE_SERVICE_KEY` |
| ดึงผลตรวจล่าสุดของโดเมนนี้ | URL และ service key เดียวกัน |
| บันทึก Incident ลง Supabase | URL และ service key เดียวกัน |
| แจ้งเตือนเข้ากลุ่ม War Room | `YOUR_BOT_TOKEN` และ `YOUR_WARROOM_CHAT_ID` |
| โทรแจ้ง IT เวร (เฉพาะ P1) | `YOUR_ACCOUNT_SID`, `Basic YOUR_BASE64_SID_COLON_TOKEN`, เบอร์ `To` และ `From` |

4. กด **Active** เพื่อเปิดใช้งาน แล้วคัดลอก **Production URL** ของโหนด Webhook เก็บไว้
   (จะมีรูปแบบประมาณ `https://n8n.example.com/webhook/domainwatch/probe`)

> **แนะนำ:** เมื่อระบบเสถียรแล้ว ควรย้ายค่า token ทั้งหมดไปเก็บใน Credentials ของ n8n
> แทนการวางไว้ในโหนดตรง ๆ เพื่อไม่ให้ token ติดไปกับไฟล์เวลา export workflow

---

## ขั้นตอนที่ 3 — ติดตั้ง Agent ที่ VPS จุดตรวจแต่ละจุด

ทำซ้ำขั้นตอนนี้ที่ VPS ทุกจุด โดยเปลี่ยนค่า `CHECKPOINT`, `ISP`, `REGION` และ `RESOLVER` ให้ตรงกับจุดนั้น

```bash
# 3.1 ติดตั้งเครื่องมือที่จำเป็น
sudo apt-get update
sudo apt-get install -y dnsutils curl openssl

# 3.2 วางสคริปต์
sudo mkdir -p /etc/domainwatch
sudo cp 03_agent_domainwatch.sh /usr/local/bin/dw-agent.sh
sudo chmod +x /usr/local/bin/dw-agent.sh

# 3.3 สร้างไฟล์ตั้งค่า
sudo nano /etc/domainwatch/agent.conf
```

เนื้อหาไฟล์ `agent.conf` (ตัวอย่างสำหรับจุดตรวจ AIS)

```bash
CHECKPOINT="th-ais-bkk"
ISP="AIS"
REGION="TH"
RESOLVER="203.113.11.11"          # ใส่ resolver ของ ISP นั้นจริง ๆ
KEYWORD="เข้าสู่ระบบ"              # ข้อความที่ต้องมีในหน้าเว็บปกติ
DOMAINS="domain-a.com domain-b.com link.short-a.co"
N8N_WEBHOOK="https://n8n.example.com/webhook/domainwatch/probe"
TIMEOUT_HTTP=10
```

ตั้งค่าให้รันทุก 1 นาที

```bash
sudo chmod 600 /etc/domainwatch/agent.conf
( sudo crontab -l 2>/dev/null; echo "* * * * * /usr/local/bin/dw-agent.sh >/dev/null 2>&1" ) | sudo crontab -
```

ทดสอบว่ารันได้จริง

```bash
sudo /usr/local/bin/dw-agent.sh
sudo journalctl -t domainwatch -n 20
```

### ตารางค่าที่ต้องตั้งต่างกันในแต่ละจุดตรวจ

| จุดตรวจ | CHECKPOINT | ISP | REGION | หมายเหตุ |
|---|---|---|---|---|
| จุดที่ 1 | `th-ais-bkk` | AIS | TH | ใช้ resolver ของ AIS |
| จุดที่ 2 | `th-true-bkk` | True | TH | ใช้ resolver ของ True |
| จุดที่ 3 | `th-3bb-bkk` | 3BB หรือ NT | TH | ใช้ resolver ของค่ายนั้น |
| จุดที่ 4 | `sg-compare` | — | SG | **จำเป็น** ใช้เป็นตัวเทียบเพื่อแยกบล็อกกับล่ม |

> ต้องมีจุดตรวจต่างประเทศอย่างน้อย 1 จุดเสมอ มิฉะนั้นระบบจะแยกไม่ออกว่า
> "ถูกบล็อกในไทย" หรือ "เซิร์ฟเวอร์ล่มทั้งโลก" ซึ่งเป็นสองเหตุที่แก้คนละวิธี

---

## ขั้นตอนที่ 4 — ติดตั้ง Uptime Kuma (หน้า Status และการตรวจ SSL)

```bash
docker run -d --restart=always -p 3001:3001 \
  -v uptime-kuma:/app/data --name uptime-kuma \
  louislam/uptime-kuma:1
```

ตั้ง Monitor ตามนี้

| ชนิด Monitor | ใช้ตรวจ | ความถี่ |
|---|---|---|
| HTTP(s) - Keyword | โดเมนหลักและลิงก์กลาง (ตรวจคำสำคัญในหน้า) | 60 วินาที |
| DNS | โดเมนทุกตัวใน Domain Pool | 60 วินาที |
| TCP Port | พอร์ต 443 ของเซิร์ฟเวอร์ | 60 วินาที |
| HTTP(s) | ใบรับรอง SSL (เปิดแจ้งเตือนล่วงหน้า 30/14/7 วัน) | วันละครั้ง |

เปิด **Status Page** เพื่อใช้เป็นหน้า Dashboard สำหรับทีมงาน

---

## ขั้นตอนที่ 5 — Synthetic Journey ด้วย Playwright (ชั้น L5)

สร้างสคริปต์จำลองผู้ใช้จริง รันทุก 5 นาทีจาก VPS จุดตรวจในไทย 1 จุด

```js
// dw-journey.js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let ok = false, step = 'start';
  try {
    step = 'open';   await page.goto('https://domain-a.com/', { timeout: 20000 });
    step = 'login';  await page.fill('#username', process.env.DW_USER);
                     await page.fill('#password', process.env.DW_PASS);
                     await page.click('#login-button');
    step = 'wallet'; await page.waitForSelector('#deposit-panel', { timeout: 15000 });
    ok = true;
  } catch (e) {
    step = step + ': ' + e.message;
  }
  await browser.close();

  await fetch(process.env.DW_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain: 'domain-a.com', checkpoint: 'th-journey', region: 'TH',
      dns_ok: true, tcp_ok: true, http_ok: ok, keyword_ok: ok,
      status_code: ok ? 200 : 500, latency_ms: 0, note: step
    })
  });
})();
```

**ข้อควรระวัง:** ใช้บัญชีทดสอบเฉพาะสำหรับงานนี้ ห้ามใช้บัญชีลูกค้าจริง
และเก็บรหัสผ่านไว้ในตัวแปรสภาพแวดล้อม ห้ามเขียนลงในไฟล์สคริปต์

---

## ขั้นตอนที่ 6 — ทดสอบก่อนใช้งานจริง

ทดสอบตามลำดับนี้ และบันทึกผลไว้เป็นหลักฐานการส่งมอบ

| # | สิ่งที่ทดสอบ | วิธีทดสอบ | ผลที่ควรได้ |
|---|---|---|---|
| 1 | Agent ส่งข้อมูลถึง n8n | รันสคริปต์ด้วยมือ 1 ครั้ง | มีแถวใหม่ใน `probe_results` |
| 2 | กฎยืนยัน 2 ครั้ง 2 จุดตรวจ | แก้ `DOMAINS` เป็นโดเมนที่ไม่มีอยู่จริง แล้วรัน 2 รอบที่ 2 จุดตรวจ | มีแจ้งเตือนเข้า Telegram ในรอบที่ 2 ไม่ใช่รอบแรก |
| 3 | ไม่แจ้งเตือนหลอน | ทำให้ 1 จุดตรวจล้มเหลวจุดเดียว | **ไม่มี**แจ้งเตือน |
| 4 | แยกบล็อกกับล่มได้ถูก | จำลองให้จุดตรวจไทยล้มเหลวแต่ SG ปกติ | ข้อความระบุ "ถูกบล็อกระดับ ISP" |
| 5 | โทรแจ้งเฉพาะ P1 | จำลองเหตุ P2 | ได้ Telegram แต่**ไม่มี**สายโทรเข้า |
| 6 | บันทึก Incident ครบ | ดูตาราง `incidents` | มีแถวใหม่พร้อมรหัส INC-xxxx |

---

## การดูแลรักษาต่อเนื่อง

| งาน | ความถี่ | ผู้รับผิดชอบ |
|---|---|---|
| ตรวจว่า Agent ทุกจุดยังส่งข้อมูลอยู่ (ไม่มีจุดไหนเงียบเกิน 5 นาที) | ทุกวัน | IT เวร |
| ทบทวนอัตราแจ้งเตือนผิดพลาด และปรับเกณฑ์ | ทุกเดือน | หัวหน้าไอที |
| ต่ออายุ SSL และโดเมนที่ใกล้หมด | ตามที่บอทเตือน | IT |
| เติมโดเมนสำรองให้ครบ 3 ชื่อหลังเกิดเหตุ | ภายใน 24 ชั่วโมง | IT |
| ซ้อมแผนเสมือนจริง | เดือนละครั้ง | ทั้งทีม |

---

## สิ่งที่ยังไม่ได้ทำในเวอร์ชันนี้

- Auto-Failover ให้ n8n สลับลิงก์กลางเองอัตโนมัติ (อยู่ใน Phase 2)
- ระบบ Escalation อัตโนมัติเมื่อไม่มีคนกด Acknowledge ใน 5 นาที (อยู่ใน Phase 2)
- ชั้น L7 (WHOIS) และ L8 (สถานะลิงก์ในแอป LINE) ยังต้องเพิ่มเป็น workflow แยก
- หน้า Dashboard ตามภาพร่าง ยังต้องพัฒนาจริง (ระหว่างนี้ใช้ Status Page ของ Uptime Kuma แทนได้)
