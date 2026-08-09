/* =============================================================
   PdfStm - อ่าน statement ธนาคารที่เป็นไฟล์ PDF (ข้อความจริง ไม่ใช่ภาพสแกน)
   รองรับรูปแบบที่แผนกใช้จริง
     KBANK : 19-07-26 | 00:00 | รับโอนเงิน | 100.00 | 1,035.25 | K PLUS | จาก ...
     SCB   : 18/07/26 07:04 | X2 | ENET | 5,000.00 | 23,932.00   (+ บรรทัดรายละเอียดด้านบน)
   ใช้ pdf.js ที่ฝังมากับระบบ (vendor/) จึงทำงานได้แม้ไม่มีอินเทอร์เน็ต
   ============================================================= */

const PdfStm = (() => {
  const LIB = "vendor/pdf.min.js";
  const WORKER = "vendor/pdf.worker.min.js";
  let loading = null;

  function loadLib() {
    if (typeof pdfjsLib !== "undefined") return Promise.resolve(pdfjsLib);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = LIB;
      s.onload = () => {
        if (typeof pdfjsLib === "undefined") return reject(new Error("โหลดตัวอ่าน PDF ไม่สำเร็จ"));
        pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER;
        resolve(pdfjsLib);
      };
      s.onerror = () => reject(new Error("ไม่พบไฟล์ตัวอ่าน PDF (vendor/pdf.min.js)"));
      document.head.appendChild(s);
    });
    return loading;
  }

  /* ---------------- ดึงข้อความเป็นบรรทัด พร้อมตำแหน่ง x ---------------- */
  async function textLines(arrayBuffer) {
    const lib = await loadLib();
    const doc = await lib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const pages = [];
    for (let pn = 1; pn <= doc.numPages; pn++) {
      const page = await doc.getPage(pn);
      const tc = await page.getTextContent();
      const buckets = new Map();
      tc.items.forEach((it) => {
        const y = Math.round(it.transform[5]);
        let hit = null;
        for (const key of buckets.keys()) if (Math.abs(key - y) <= 2) hit = key;
        const k = hit === null ? y : hit;
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push({ x: Math.round(it.transform[4]), s: it.str });
      });
      const lines = [...buckets.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([y, items]) => {
          const sorted = items.sort((a, b) => a.x - b.x);
          return { y, items: sorted, text: sorted.map((i) => i.s).join(" ").replace(/\s+/g, " ").trim() };
        });
      pages.push(lines);
    }
    return pages;
  }

  /* ---------------- helper ---------------- */
  const digits = (s) => String(s || "").replace(/\D/g, "");
  const numOf = (s) => {
    const n = parseFloat(String(s || "").replace(/[,\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const AMT = /^-?[\d,]+\.\d{2}$/;

  /* '19-07-26' / '18/07/26' / '19/07/2026' -> ISO (รองรับ พ.ศ. 2 หลัก) */
  function isoOf(v) {
    const m = String(v || "").match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (!m) return null;
    let y = +m[3];
    if (y < 100) y += 2000; // 26 -> 2026 (statement ใช้ปี 2 หลักเป็น ค.ศ. 20xx)
    if (y > 2400) y -= 543;
    return `${y}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  }
  const secOf = (v) => {
    const m = String(v || "").match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    return m ? +m[1] * 3600 + +m[2] * 60 + (+m[3] || 0) : null;
  };

  /* ---------------- ตรวจธนาคารและเลขบัญชี ---------------- */
  function header(pages) {
    const blob = (pages[0] || []).map((l) => l.text).join("\n");
    let bank = null;
    if (/ไทยพาณิชย์|SIAM COMMERCIAL/i.test(blob)) bank = "SCB";
    else if (/กสิกร|KASIKORN|K PLUS|เลขที่บัญชีเงินฝาก/i.test(blob)) bank = "KBANK";
    else if (/ออมสิน|MyMo|GSB/i.test(blob)) bank = "GSB";
    else if (/กรุงเทพ|BANGKOK BANK/i.test(blob)) bank = "BBL";
    else if (/กรุงไทย|KRUNGTHAI/i.test(blob)) bank = "KTB";
    /* TrueMoney Wallet: หัวข้อ "ใบแสดงรายการ / Statement of Account" + คอลัมน์ เงินเข้า/เงินออก + ยอดคงเหลือ (เลขบัญชี = เบอร์มือถือ) */
    else if (/เงินเข้า/.test(blob) && /เงินออก/.test(blob) && /ยอดคงเหลือ/.test(blob)) bank = "TMN";

    let account = "";
    const am = blob.match(/(?:เลขที่บัญชี(?:เงินฝาก)?|Account No\.?)\s*[:\s]*([\d-]{9,20})/i) || blob.match(/\b(\d{3}-\d{1,6}-\d{1,2})\b/);
    if (am) account = digits(am[1]);

    let holder = "";
    const hm = blob.match(/ชื่อ\s*-?\s*สกุล\s*([^\n]{3,60})/) || blob.match(/ชื่อบัญชี\s*([^\n]{2,40}?)\s*เลขที่บัญชี/) || blob.match(/ชื่อบัญชี\s*([^\n]{3,60})/);
    if (hm) holder = hm[1].trim();

    let period = "";
    const pm = blob.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (pm) period = `${isoOf(pm[1])} ถึง ${isoOf(pm[2])}`;

    return { bank, account, holder, period };
  }

  /* ---------------- SCB ----------------
     บรรทัดรายการ: 18/07/26 07:04 | X2 | ENET | 5,000.00 | 23,932.00
     คำอธิบายอยู่บรรทัดเหนือขึ้นไปหนึ่งบรรทัด                                */
  function parseScb(pages) {
    const rows = [];
    pages.forEach((lines) => {
      lines.forEach((l, i) => {
        const t = l.text;
        const m = t.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}:\d{2})\s+(X[0-9B]|[A-Z]{1,3})\s+([A-Z/]+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/);
        if (!m) return;
        const prev = lines[i - 1];
        rows.push({
          date: isoOf(m[1]),
          sec: secOf(m[2]),
          code: m[3],
          channel: m[4],
          amount: numOf(m[5]),
          balance: numOf(m[6]),
          desc: prev && !/^\d{1,2}\/\d{1,2}\//.test(prev.text) ? prev.text : "",
          raw: (prev && !/^\d{1,2}\/\d{1,2}\//.test(prev.text) ? prev.text + " | " : "") + t,
        });
      });
    });
    return rows;
  }

  /* ---------------- KBANK ----------------
     19-07-26 | 00:00 | รับโอนเงิน | 100.00 | 1,035.25 | K PLUS | จาก ...       */
  function parseKbank(pages) {
    const rows = [];
    pages.forEach((lines) => {
      lines.forEach((l) => {
        const t = l.text;
        if (!/^\d{2}-\d{2}-\d{2}\b/.test(t)) return;
        if (/ยอดยกมา|ยอดยกไป/.test(t)) return;
        const time = (t.match(/\b(\d{1,2}:\d{2})\b/) || [])[1];
        if (!time) return;
        const amts = l.items.filter((i) => AMT.test(i.s.trim()));
        if (amts.length < 2) return;
        const amount = numOf(amts[amts.length - 2].s);
        const balance = numOf(amts[amts.length - 1].s);
        const kind = (t.match(/(รับโอนเงิน|โอนเงิน|ฝากเงิน|ถอนเงิน|หักบัญชี|ดอกเบี้ย|ค่าธรรมเนียม)/) || [])[1] || "";
        const chIdx = l.items.findIndex((i) => i === amts[amts.length - 1]);
        const tail = l.items.slice(chIdx + 1).map((i) => i.s).join(" ").trim();
        rows.push({
          date: isoOf(t.slice(0, 8)),
          sec: secOf(time),
          code: kind,
          channel: tail.split(" จาก ")[0].split(" ไป ")[0].trim(),
          amount,
          balance,
          desc: tail,
          raw: t,
        });
      });
    });
    return rows;
  }

  /* ---------------- TrueMoney Wallet (TMN) ----------------
     03/06/2026 13:50:45 | เงินเข้า | 10.00 | 0952178672 | 34,210.07 | 34,220.07
     03/06/2026 13:50:46 | เงินออก | -0.29 | fee_p2p_receive | 34,220.07 | 34,219.78
     คอลัมน์: วันที่+เวลา · ประเภท · ยอด(±) · รายละเอียด(เบอร์/โค้ด) · ยอดก่อน · ยอดหลัง   */
  const TMN_FEE = /^(fee_|.*_fee$|promptpay_.*_fundout$|.*_fundout$)/i;
  function parseTMN(pages) {
    const rows = [];
    const re = /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})\s+(เงินเข้า|เงินออก)\s+(-?[\d,]+\.\d{2})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;
    pages.forEach((lines) => {
      lines.forEach((l) => {
        const m = l.text.match(re);
        if (!m) return;
        const detail = m[5].trim();
        rows.push({
          date: isoOf(m[1]),
          sec: secOf(m[2]),
          code: m[3], // เงินเข้า/เงินออก
          channel: "TMN",
          amount: Math.abs(numOf(m[4])),
          balance: numOf(m[7]),
          desc: detail,
          isFee: TMN_FEE.test(detail), // ค่าธรรมเนียม/โยกเงินออกธนาคาร ไม่ใช่รายการลูกค้า
          raw: l.text,
        });
      });
    });
    return rows;
  }

  /* ---------------- ทั่วไป (สำรอง) ---------------- */
  function parseGeneric(pages) {
    const rows = [];
    pages.forEach((lines) =>
      lines.forEach((l) => {
        const t = l.text;
        const d = t.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/);
        const tm = t.match(/\b(\d{1,2}:\d{2})\b/);
        const amts = l.items.filter((i) => AMT.test(i.s.trim()));
        if (!d || !tm || amts.length < 2) return;
        rows.push({
          date: isoOf(d[1]),
          sec: secOf(tm[1]),
          code: "",
          channel: "",
          amount: numOf(amts[amts.length - 2].s),
          balance: numOf(amts[amts.length - 1].s),
          desc: t,
          raw: t,
        });
      }),
    );
    return rows;
  }

  /* ---------------- ทิศทาง: ใช้ผลต่างยอดคงเหลือเป็นหลัก ---------------- */
  function applyDirection(rows, bank) {
    let prevBal = null;
    rows.forEach((r, i) => {
      let dir = null;
      if (prevBal !== null && r.balance !== null && Math.abs(Math.abs(r.balance - prevBal) - r.amount) < 0.01) {
        dir = r.balance > prevBal ? "deposit" : "withdraw";
      }
      if (!dir) {
        const c = String(r.code || "").toUpperCase();
        if (bank === "SCB") {
          if (c === "X1") dir = "deposit";
          else if (c === "X2") dir = "withdraw";
          else if (c === "XB") dir = "adjustment";
        }
        if (!dir) {
          if (/รับโอน|ฝากเงิน|เงินเข้า|deposit/i.test(r.code + " " + r.desc)) dir = "deposit";
          else if (/โอนเงิน|โอนไป|ถอน|เงินออก|หักบัญชี|ค่าธรรมเนียม|withdraw/i.test(r.code + " " + r.desc)) dir = "withdraw";
        }
      }
      r.direction = dir || "deposit";
      if (r.balance !== null) prevBal = r.balance;
      r.seq = i;
    });
    return rows;
  }

  /* ---------------- public ---------------- */
  async function parse(fileName, arrayBuffer, businessDate) {
    const pages = await textLines(arrayBuffer);
    const head = header(pages);
    let rows =
      head.bank === "SCB" ? parseScb(pages) : head.bank === "KBANK" ? parseKbank(pages) : head.bank === "TMN" ? parseTMN(pages) : parseGeneric(pages);
    if (!rows.length) rows = parseGeneric(pages);
    applyDirection(rows, head.bank);

    const company = typeof Formats !== "undefined" ? Formats.companyOf(fileName) : null;
    const dropped = {};
    const drop = (w) => (dropped[w] = (dropped[w] || 0) + 1);
    const records = [];
    rows.forEach((r, i) => {
      if (r.sec === null || r.amount === null) return drop("อ่านเวลาหรือยอดไม่ได้");
      if (r.direction === "adjustment") return drop("รายการปรับปรุงยอด (XB) แยกออกจากการจับคู่");
      if (r.isFee) return drop("ค่าธรรมเนียม/โยกเงินออกธนาคาร TrueMoney (ไม่ใช่รายการลูกค้า)");
      if (businessDate && r.date && r.date !== businessDate) return drop("วันที่ไม่ตรงกับวันที่ตรวจ");
      records.push({
        rowNo: i + 1,
        source: "stm",
        formatCode: "stm_pdf",
        date: r.date,
        sec: r.sec,
        amount: Math.round(r.amount * 100) / 100,
        balance: r.balance,
        direction: r.direction,
        account: head.account || "UNKNOWN",
        bank: head.bank || "",
        channel: r.channel || head.bank || "",
        company,
        username: null,
        ref: null,
        desc: r.desc,
        code: r.code,
        crossDay: false,
        lateNight: r.sec >= 82800,
        minutePrecision: true, // statement ให้เวลาแค่ HH:MM
        raw: r.raw,
      });
    });

    const warnings = [];
    if (!head.bank) warnings.push("ระบุธนาคารจากหัวกระดาษไม่ได้ — ใช้ตัวอ่านแบบทั่วไป");
    if (!head.account) warnings.push("อ่านเลขบัญชีจากหัวกระดาษไม่ได้ — ต้องระบุเองในหน้าตั้งค่าบัญชี");
    if (!records.length) warnings.push("ไม่พบบรรทัดรายการใน PDF — อาจเป็นไฟล์สแกนภาพ ต้องขอไฟล์ที่เป็นข้อความ");

    return {
      fileName,
      header: head,
      format: {
        source: "stm",
        bank: head.bank,
        company,
        headerIdx: 0,
        map: {},
        realCode: "stm_pdf",
        realLabel: `Statement PDF ${head.bank || ""} ${head.account || ""}`.trim(),
        channels: {},
        holder: head.holder,
        period: head.period,
      },
      records,
      aux: [],
      dropped,
      warnings,
      pageCount: pages.length,
    };
  }

  return { parse, textLines, header, isoOf };
})();

if (typeof window !== "undefined") window.PdfStm = PdfStm;
