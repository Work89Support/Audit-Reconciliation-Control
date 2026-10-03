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
    if (y < 100) y += y > 50 ? 1957 : 2000; // ค.ศ.ย่อ 26->2026 ; พ.ศ.ย่อ (KTB) 69->2026 (2569-543=1957+69)
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
    const heading = blob.split(/\n\s*\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/)[0];
    let bank = null;
    // Identify the statement owner from the heading, not transaction details.
    // A KBANK statement can contain descriptions such as "รับโอนจาก SCB" or
    // "รับโอนจาก KTB"; scanning the whole document creates phantom accounts.
    if (/ไทยพาณิชย์|SIAM COMMERCIAL/i.test(heading)) bank = "SCB";
    // LINE BK in a transaction channel does not identify the statement's bank.
    else if (/LINE\s*BK|ไลน์\s*บีเค/i.test(heading)) bank = "LBK";
    else if (/กสิกร|KASIKORN|K PLUS|เลขที่บัญชีเงินฝาก/i.test(heading)) bank = "KBANK";
    else if (/ออมสิน|MyMo|GSB/i.test(heading)) bank = "GSB";
    else if (/ธนาคารกรุงเทพ|BANGKOK BANK/i.test(heading)) bank = "BBL"; // ต้องมีคำว่า "ธนาคาร" นำ กัน "กรุงเทพฯ" ในที่อยู่สำนักงานใหญ่ธนาคารอื่น
    else if (/กรุงไทย|KRUNGTHAI/i.test(heading)) bank = "KTB";
    else if (/กรุงศรี|อยุธยา|KRUNGSRI|AYUDHYA/i.test(heading)) bank = "BAY";
    // Some BAY exports print the bank legal name only in the footer. Use this
    // fallback only after no owner brand was found in the heading.
    else if (/ธนาคารกรุงศรีอยุธยา|BANK OF AYUDHYA/i.test(blob)) bank = "BAY";
    /* TrueMoney Wallet: หัวข้อ "ใบแสดงรายการ / Statement of Account" + คอลัมน์ เงินเข้า/เงินออก + ยอดคงเหลือ (เลขบัญชี = เบอร์มือถือ) */
    else if (/เงินเข้า/.test(blob) && /เงินออก/.test(blob) && /ยอดคงเหลือ/.test(blob)) bank = "TMN";

    let account = "";
    const am = blob.match(/(?:เลข(?:ที่)?บัญชี(?:เงินฝาก)?|Account No\.?)\s*(?:\(Account no\)\s*)?[:\s]*([\d-]{9,20})/i) || blob.match(/\b(\d{3}-\d-\d{5}-\d)\b/) || blob.match(/\b(\d{3}-\d{1,6}-\d{1,2})\b/);
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
     ผูกคำอธิบายจากแถวเดียวกัน หรือรูปแบบแยกบรรทัดที่ยืนยันได้ทั้งช่วงเท่านั้น */
  function parseScb(pages) {
    const rows = [];
    pages.forEach((lines) => {
      const tokens = [];
      const description = /^(?:รับโอนจาก|โอนจาก|โอนไป|ดอกเบี้ย|ค่าธรรมเนียม|ปรับปรุง)/;
      lines.forEach((l) => {
        const t = l.text;
        // Google Drive OCR can flatten SCB's transaction columns so several
        // complete tuples land on one physical text line while balances and
        // descriptions are emitted in later column blocks.  Read every exact
        // date/time/code/channel/amount tuple.  X1/X2 is explicit bank
        // evidence for direction, so a balance is optional in this layout.
        const exactRe = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}:\d{2})\s+(X[0-9B]|[A-Z]{1,3}|[A-Z][0-9])\s+([A-Z/]+)\s+([\d,]+\.\d{2})(?:\s+([\d,]+\.\d{2}))?/g;
        const exactMatches = [...t.matchAll(exactRe)];
        if (exactMatches.length) {
          exactMatches.forEach((match) => {
            const inline = exactMatches.length === 1 ? t.slice(match.index + match[0].length).trim() : "";
            const row = {
              date: isoOf(match[1]),
              sec: secOf(match[2]),
              code: match[3],
              channel: match[4],
              amount: numOf(match[5]),
              balance: match[6] ? numOf(match[6]) : null,
              desc: inline,
              // Keep the complete source line so the quality scan can prove
              // that a flattened line was consumed without reporting it as
              // unread after the individual tuples have been recovered.
              raw: t,
              descriptionUncertain: !inline && /^X[12]$/.test(match[3]),
              ocrColumnSeparated: !match[6] || exactMatches.length > 1,
            };
            rows.push(row);
            tokens.push({ row, inline: !!inline });
          });
          return;
        }
        // SCB also emits counter-service codes such as C1. Keep the code
        // generic enough for one optional digit, then derive direction from
        // the running balance when it is not an explicit X1/X2 transaction.
        const m = null;
        // Google Drive OCR ของ statement SCB แบบภาพบางฉบับอ่านคอลัมน์
        // Code/Channel ไม่ครบ แต่ยังอ่านวันที่ เวลา ยอดรายการ และยอดคงเหลือ
        // ต่อเนื่องกันครบได้ ให้รับรูปแบบนี้ไว้ก่อน แล้วตรวจ continuity ทั้งไฟล์
        // ด้านล่างอีกชั้นเพื่อไม่ให้แถวที่ OCR ตกหล่นผ่าน Quality Gate.
        const fallback = !m && t.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}:\d{2})(?:\s+(X[0-9B]|[A-Z]{1,3}|[A-Z][0-9]))?(?:\s+([A-Z/]+))?\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/);
        const rowMatch = m || fallback;
        if (!rowMatch) {
          if (description.test(t)) tokens.push({ desc: t });
          return;
        }
        const inline = t.slice(rowMatch[0].length).trim();
        const row = {
          date: isoOf(rowMatch[1]),
          sec: secOf(rowMatch[2]),
          code: rowMatch[3] || "",
          channel: rowMatch[4] || "",
          amount: numOf(rowMatch[5]),
          balance: numOf(rowMatch[6]),
          desc: inline,
          raw: t,
          descriptionUncertain: !inline && /^X[12]$/.test(rowMatch[3] || ""),
          ocrMissingColumns: !!fallback,
        };
        rows.push(row);
        tokens.push({ row, inline: !!inline });
      });
      // Native extraction may emit all descriptions AFTER rows; older files
      // emit them BEFORE rows. Never borrow the preceding text unconditionally.
      // Inline rows form boundaries, so a missing description cannot shift
      // identities across an already complete transaction or a PDF page.
      let segment = [];
      const flush = () => {
        if (segment.length && segment.length % 2 === 0) {
          const before = !!segment[0].desc;
          const alternating = segment.every((token, i) => !!token.desc === (i % 2 === 0 ? before : !before));
          if (alternating) for (let i = 0; i < segment.length; i += 2) {
            const row = segment[i + (before ? 1 : 0)].row;
            const desc = segment[i + (before ? 0 : 1)].desc;
            row.desc = desc;
            row.raw += " | " + desc;
            row.descriptionUncertain = false;
          }
        }
        segment = [];
      };
      tokens.forEach((token) => { if (token.inline) flush(); else segment.push(token); });
      flush();
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
        const dateMatch = t.match(/^(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/);
        if (!dateMatch) return;
        if (/ยอดยกมา|ยอดยกไป/.test(t)) return;
        const time = (t.match(/\b(\d{1,2}:\d{2})\b/) || [])[1];
        if (!time) return;
        const amts = l.items.filter((i) => AMT.test(i.s.trim()));
        if (amts.length < 2) return;
        const amount = numOf(amts[amts.length - 2].s);
        const balance = numOf(amts[amts.length - 1].s);
        const kind = (t.match(/(รับโอนเงิน|รับโอนจาก|เงินโอนเข้า|โอนเงิน|โอนไป|ฝากเงิน|ถอนเงิน|หักบัญชี|ดอกเบี้ย|ค่าธรรมเนียม)/) || [])[1] || "";
        const chIdx = l.items.findIndex((i) => i === amts[amts.length - 1]);
        const tail = l.items.slice(chIdx + 1).map((i) => i.s).join(" ").trim();
        rows.push({
          date: isoOf(dateMatch[1]),
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
  /* fundout is not a fee: it is the TMN leg of a transfer to a bank account.
     Keep it in the evidence set so the reconciliation engine can pair it with
     the receiving bank leg.  Dropping it here creates two false one-sided
     exceptions (for example TMN -7,000 / KBANK +7,000). */
  const TMN_FEE = /^(fee_|.*_fee$)/i;
  const TMN_NON_CUSTOMER = /(?:^|[_\s-])fee(?:[_\s-]|$)|ค่าธรรมเนียม|ยอด(?:ยกมา|ยกไป|คงเหลือ)|opening[_\s-]?balance|closing[_\s-]?balance|balance[_\s-]?(?:forward|brought|carried)/i;
  const TMN_INTERNAL_TRANSFER = /(?:^|_)promptpay_.*_fundout$|(?:^|_).*_fundout$/i;
  function parseTMNWalletScreenshots(pages, businessDate) {
    const rows = [];
    const thaiMonths = {
      "มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4,
      "พฤษภาคม": 5, "มิถุนายน": 6, "กรกฎาคม": 7, "สิงหาคม": 8,
      "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12,
    };
    const dateOf = (text) => {
      const match = String(text || "").match(/(\d{1,2})\s+(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s+(\d{4})/);
      if (!match) return null;
      let year = Number(match[3]);
      if (year > 2400) year -= 543;
      return `${year}-${String(thaiMonths[match[2]]).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}`;
    };
    const timeOnly = /^(\d{1,2}:\d{2})(?::\d{2})?[.\s]*$/;
    // Google Drive OCR commonly renders the baht glyph as a Latin B in
    // screenshots embedded in Word.  Keep the sign mandatory: unsigned OCR
    // fragments must never become financial evidence.
    const signedAmount = /(?:^|\s)([+-])\s*(?:฿|B|บาท)?\s*([\d,]+(?:\.\d{2})?)(?:\s|$)/i;
    const feeText = /ค่าธรรมเนียม/;
    const depositText = /รับเงินจาก|รับโอนเงิน|เงินโอนเข้า|เติมเงินเข้า/;
    const withdrawText = /โอนเงินออก|โอนเงินให้|ส่งเงินให้|ถอนเงิน|จ่ายเงิน|ชำระเงิน/;

    const previousIsoDate = (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      date.setUTCDate(date.getUTCDate() - 1);
      return date.toISOString().slice(0, 10);
    };

    const parseSegment = (cells, segmentDate) => {
      if (!segmentDate) return;
      const events = [];
      const amounts = [];
      const times = [];
      let sawSignedAmount = false;
      for (const cell of cells) {
        if (/^รายการ$/.test(cell) || dateOf(cell) || /^เมื่อวานนี้$/.test(cell)) continue;
        if (feeText.test(cell)) {
          events.push({ kind: "fee", direction: "withdraw", desc: cell });
          continue;
        }
        if (depositText.test(cell)) {
          const inlineTime = cell.match(/(?:^|\s)(\d{1,2}:\d{2})(?::\d{2})?[.\s]*$/);
          events.push({ kind: "customer", direction: "deposit", desc: cell, time: inlineTime?.[1] || null });
          continue;
        }
        if (withdrawText.test(cell)) {
          const inlineTime = cell.match(/(?:^|\s)(\d{1,2}:\d{2})(?::\d{2})?[.\s]*$/);
          events.push({ kind: "customer", direction: "withdraw", desc: cell, time: inlineTime?.[1] || null });
          continue;
        }
        const amountMatch = cell.match(signedAmount);
        if (amountMatch) {
          sawSignedAmount = true;
          const direction = amountMatch[1] === "+" ? "deposit" : "withdraw";
          amounts.push({ direction, amount: Math.abs(numOf(amountMatch[2])) });
          continue;
        }
        const timeMatch = cell.match(timeOnly);
        if (timeMatch) {
          times.push(timeMatch[1]);
        }
      }
      // OCR from screenshots embedded in Word is not guaranteed to be
      // row-major. It commonly emits all descriptions, then all amounts, then
      // all times. Assigning each value to the latest preceding description
      // reverses or shifts transactions (for example 1,000 becoming 10,000 on
      // a neighbouring row). Within each screenshot the visual row order is
      // preserved inside every column, so align values to events in that same
      // order. Keep fees in the withdrawal sequence so their negative amounts
      // cannot leak into customer withdrawals.
      const amountIndex = { deposit: 0, withdraw: 0 };
      const amountsByDirection = {
        deposit: amounts.filter((item) => item.direction === "deposit"),
        withdraw: amounts.filter((item) => item.direction === "withdraw"),
      };
      for (const event of events) {
        const candidates = amountsByDirection[event.direction] || [];
        const item = candidates[amountIndex[event.direction] || 0];
        if (item) {
          event.amount = item.amount;
          amountIndex[event.direction] = (amountIndex[event.direction] || 0) + 1;
        }
      }
      let timeIndex = 0;
      for (const event of events) {
        if (event.time != null) continue;
        if (timeIndex < times.length) event.time = times[timeIndex++];
      }
      // Screenshot crops can contain a partial row from the adjacent screen.
      // Keep only customer events whose own time and signed amount are both
      // proven. Orphan amounts and incomplete descriptions are never promoted.
      const customer = events.filter((event) => event.kind === "customer"
        && event.time != null && Number.isFinite(event.amount));
      if (!sawSignedAmount || !customer.length) return;
      customer.forEach((event) => rows.push({
        date: segmentDate,
        sec: secOf(event.time),
        code: event.direction === "deposit" ? "เงินเข้า" : "เงินออก",
        channel: "TMN",
        amount: event.amount,
        balance: null,
        direction: event.direction,
        desc: event.desc,
        isFee: false,
        isNonCustomer: false,
        // Preserve provenance so the reconciliation engine may apply only
        // tightly-scoped OCR repairs to phone screenshots. Native PDF rows
        // must never be changed by those rules.
        ocrWalletScreenshot: true,
        internalTransferHint: event.direction === "withdraw" && /โยก|fundout/i.test(event.desc),
        raw: `${segmentDate} ${event.time} ${event.direction} ${event.amount.toFixed(2)} ${event.desc}`,
      }));
    };

    const explicitDates = pages.map((lines) => dateOf(lines.map((line) => line.text).join("\n")));
    const inferredDates = [...explicitDates];
    // TMN Word exports are a chronological sequence of phone screenshots. A
    // date label usually appears near the bottom of the first screenshot for
    // that day; continuation screenshots keep the most recently proven date.
    // Backfill only an initial undated prefix from the first explicit date.
    // Backfilling every gap from the next label incorrectly turns late rows of
    // Sep 23 into Sep 24 when the Sep 24 label is on the final screenshot.
    let previousDate = null;
    for (let i = 0; i < inferredDates.length; i++) {
      if (inferredDates[i]) previousDate = inferredDates[i];
      else if (previousDate) inferredDates[i] = previousDate;
    }
    const firstExplicitIndex = explicitDates.findIndex(Boolean);
    if (firstExplicitIndex > 0) {
      for (let i = 0; i < firstExplicitIndex; i++) inferredDates[i] = explicitDates[firstExplicitIndex];
    }
    if (!explicitDates.some(Boolean) && /^\d{4}-\d{2}-\d{2}$/.test(String(businessDate || ""))) {
      inferredDates.fill(businessDate);
    }

    pages.forEach((lines, pageIndex) => {
      const cells = lines.map((line) => String(line.text || "").replace(/\s+/g, " ").trim()).filter(Boolean);
      const listStart = cells.findIndex((cell) => /^รายการ$/.test(cell));
      const pageDate = inferredDates[pageIndex];
      if (!pageDate) return;
      // Continuation screenshots frequently omit the app title/header. The
      // signed amount + customer description + time quality gate in
      // parseSegment is strong enough to read those pages without inventing
      // transactions from ordinary document text.
      const content = listStart < 0 ? cells : cells.slice(listStart + 1);
      const boundaries = content.map((cell, index) => ({ index, date: dateOf(cell) })).filter((item) => item.date);
      if (!boundaries.length) {
        parseSegment(content, pageDate);
        return;
      }

      // TrueMoney lists newest items first and prints the calendar heading
      // below the rows that belong to it. Google OCR can flatten several Word
      // screenshots into one text item, so one OCR page may contain multiple
      // date headings. Assign every completed segment to the heading that ends
      // it instead of applying the first heading to the whole OCR blob.
      let start = 0;
      for (const boundary of boundaries) {
        parseSegment(content.slice(start, boundary.index), boundary.date);
        start = boundary.index + 1;
      }
      const trailing = content.slice(start);
      if (trailing.some((cell) => /^เมื่อวานนี้$/.test(cell))) {
        parseSegment(trailing, previousIsoDate(boundaries[boundaries.length - 1].date));
      } else {
        // Newer TrueMoney screenshots print the calendar heading above the
        // transactions, while older captures print it below. The completed
        // segments above preserve the old layout; this trailing segment is
        // the rows belonging to a heading at the top of the screenshot.
        parseSegment(trailing, boundaries[boundaries.length - 1].date);
      }
    });
    return rows;
  }
  function parseTMN(pages, businessDate) {
    const rows = [];
    const seen = new Set();
    // n8n/PDF.js occasionally inserts spaces or zero-width characters inside
    // the Thai transaction type ("เงิน เข้า") and can flatten more than one
    // visual row into the same text line.  Normalize only layout whitespace;
    // monetary columns and the description are kept verbatim for audit.
    const normalize = (value) => String(value || "")
      .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/เงิน\s+(เข้า|ออก)/g, "เงิน$1")
      .replace(/\s+/g, " ").trim();
    const source = "(\\d{1,2}\\/\\d{1,2}\\/\\d{4})\\s+(\\d{1,2}:\\d{2}:\\d{2})\\s+(เงินเข้า|เงินออก)\\s+(-?[\\d,]+\\.\\d{2})\\s+(.+?)\\s+([\\d,]+\\.\\d{2})\\s+([\\d,]+\\.\\d{2})";
    const exact = new RegExp("^" + source + "$");
    const flattened = new RegExp(source + "(?=\\s+\\d{1,2}\\/\\d{1,2}\\/\\d{4}\\s+\\d{1,2}:\\d{2}:\\d{2}|$)", "g");
    const add = (m, raw) => {
      const detail = m[5].trim();
      const key = `${m[1]}|${m[2]}|${m[3]}|${Math.abs(numOf(m[4]))}|${numOf(m[7])}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({
        date: isoOf(m[1]),
        sec: secOf(m[2]),
        code: m[3], // เงินเข้า/เงินออก
        channel: "TMN",
        amount: Math.abs(numOf(m[4])),
        balance: numOf(m[7]),
        desc: detail,
        isFee: TMN_FEE.test(detail),
        isNonCustomer: TMN_NON_CUSTOMER.test(detail),
        internalTransferHint: TMN_INTERNAL_TRANSFER.test(detail),
        raw,
      });
    };
    pages.forEach((lines) => {
      lines.forEach((l) => {
        const raw = normalize(l.text);
        // Run the bounded global matcher first: an anchored expression would
        // otherwise accept a flattened two-row line as one very long first
        // row and use the last two balances as that row's monetary columns.
        flattened.lastIndex = 0;
        let part;
        let matched = false;
        while ((part = flattened.exec(raw))) { matched = true; add(part, part[0]); }
        if (!matched) {
          const m = raw.match(exact);
          if (m) add(m, l.text);
        }
      });
    });

    /* n8n's native PDF extractor can return TrueMoney statements in visual
       column order instead of row order.  In that representation all
       date/type cells appear first, followed by movement/detail cells and the
       opening/closing balance columns.  Reconstruct only when every row can
       be proven by a continuous before -> after balance chain and when the
    signed movement/detail columns agree row-for-row.  This deliberately
    fails closed on an incomplete or ambiguous page. */
    const amountLine = /^-?[\d,]+\.\d{2}$/;
    const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.011;
    let previousColumnRow = null;
    pages.forEach((lines) => {
      const cells = lines.map((line) => normalize(line.text)).filter(Boolean);
      const flat = cells.join("\n");
      const dates = [...flat.matchAll(/(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}:\d{2})/g)];
      const dateCells = cells.filter((cell) => /\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}/.test(cell));
      const typeSource = flat.replace(/เงิน\s*ออก\s*\/\s*เงิน\s*เข้า/g, " ");
      const types = [...typeSource.matchAll(/เงิน\s*(เข้า|ออก)/g)];
      if (!dates.length || dates.length !== types.length) return;
      // A normal row-oriented page was already parsed above.  The fallback is
      // only for pages where native extraction separated the visual columns.
      if (dates.every((date) => rows.some((row) => row.date === isoOf(date[1]) && row.sec === secOf(date[2])))) return;

      const deposits = [...flat.matchAll(/(?:^|\s)([\d,]+\.\d{2})\s+(\d{10})(?=\s|$)/gm)]
        .map((m) => ({ amount: numOf(m[1]), desc: m[2] }));
      const moneyMatches = [...flat.matchAll(/(?:^|\s)(-?[\d,]+\.\d{2})(?=\s|$)/gm)]
        .map((m) => ({ token: m[1], index: m.index }));
      const moneyTokens = moneyMatches.map((match) => match.token);
      const negativeAmounts = moneyTokens.filter((cell) => /^-/.test(cell)).map((cell) => Math.abs(numOf(cell)));
      const depositCount = types.filter((m) => m[1] === "เข้า").length;
      const withdrawalCount = types.length - depositCount;
      if (deposits.length < depositCount || negativeAmounts.length !== withdrawalCount) return;

      const values = moneyTokens.filter((cell) => amountLine.test(cell)).map((cell) => numOf(cell));
      const candidates = [];
      for (let i = 0; i + 1 < values.length; i++) {
        if (!close(values[i], values[i + 1])) candidates.push({
          index: i, before: values[i], after: values[i + 1],
          beforePos: moneyMatches[i].index, afterPos: moneyMatches[i + 1].index,
        });
      }
      const directionMatches = (candidate, type) => type === "เข้า"
        ? candidate.after > candidate.before : candidate.after < candidate.before;
      let best = null;
      candidates.filter((candidate) => directionMatches(candidate, types[0][1])).forEach((start) => {
        const path = [start];
        for (let rowIndex = 1; rowIndex < types.length; rowIndex++) {
          const previous = path[path.length - 1];
          const next = candidates.find((candidate) => candidate.index > previous.index + 1
            && close(candidate.before, previous.after)
            && directionMatches(candidate, types[rowIndex][1]));
          if (!next) break;
          path.push(next);
        }
        const gapCost = start.index + path.reduce((total, candidate, index) => index
          ? total + candidate.index - (path[index - 1].index + 2) : total, 0);
        if (!best || path.length > best.path.length || (path.length === best.path.length && gapCost < best.gapCost)) {
          best = { path, gapCost };
        }
      });
      if (!best || best.path.length !== dates.length) return;

      const sameAmounts = (left, right) => left.length === right.length
        && left.map((value) => Math.round(value * 100) / 100).sort((a, b) => a - b)
          .every((value, index) => close(value, right.map((item) => Math.round(item * 100) / 100).sort((a, b) => a - b)[index]));
      const depositMovements = best.path.filter((_, index) => types[index][1] === "เข้า")
        .map((candidate) => Math.abs(candidate.after - candidate.before));
      const withdrawalMovements = best.path.filter((_, index) => types[index][1] === "ออก")
        .map((candidate) => Math.abs(candidate.after - candidate.before));
      const unmatchedDepositMovements = [...depositMovements];
      const verifiedDeposits = [];
      deposits.forEach((item) => {
        const matchIndex = unmatchedDepositMovements.findIndex((movement) => close(movement, item.amount));
        if (matchIndex < 0) return;
        unmatchedDepositMovements.splice(matchIndex, 1);
        verifiedDeposits.push(item);
      });
      if (unmatchedDepositMovements.length || verifiedDeposits.length !== depositCount
        || !sameAmounts(withdrawalMovements, negativeAmounts)) return;

      const reconstructed = [];
      for (let i = 0; i < dates.length; i++) {
        const direction = types[i][1] === "เข้า" ? "deposit" : "withdraw";
        const movement = Math.round(Math.abs(best.path[i].after - best.path[i].before) * 100) / 100;
        let detail = "";
        if (direction === "deposit") {
          const matchIndex = verifiedDeposits.findIndex((item) => close(item.amount, movement));
          if (matchIndex >= 0) {
            detail = verifiedDeposits[matchIndex].desc;
            verifiedDeposits.splice(matchIndex, 1);
          }
        }
        reconstructed.push({
          date: dates[i][1], time: dates[i][2], type: `เงิน${types[i][1]}`,
          movement, detail, balance: best.path[i].after,
          raw: dateCells[i] || "",
        });
      }
      // TrueMoney receive fees are deterministic: 2.9% of the immediately
      // preceding deposit (capped at 20 baht), posted within two seconds.
      // Require the inferred count to equal the explicit fee markers on the
      // same page before labeling or dropping any row.
      let inferredFees = 0;
      reconstructed.forEach((row, index) => {
        const previous = index ? reconstructed[index - 1] : previousColumnRow;
        if (!previous) return;
        let seconds = secOf(row.time) - secOf(previous.time);
        if (seconds < 0) seconds += 86400;
        const expected = Math.min(Math.round(previous.movement * 0.029 * 100) / 100, 20);
        if (previous.type === "เงินเข้า" && row.type === "เงินออก" && seconds <= 2 && close(row.movement, expected)) {
          row.detail = "fee_p2p_receive";
          inferredFees += 1;
        }
      });
      const feeMarkers = (flat.match(/\bfee_p2p_receive\b/gi) || []).length;
      if (inferredFees !== feeMarkers) return;
      // fundout descriptions can be emitted inside the balance column. Map
      // each marker to the nearest reconstructed withdrawal balance pair.
      const fundoutMarkers = [...flat.matchAll(/\b[A-Za-z0-9_]*fundout\b/gi)];
      fundoutMarkers.forEach((marker) => {
        let bestIndex = -1;
        let bestDistance = Infinity;
        reconstructed.forEach((row, index) => {
          if (row.type !== "เงินออก" || row.detail === "fee_p2p_receive") return;
          const candidate = best.path[index];
          const distance = Math.min(Math.abs((candidate.beforePos || 0) - marker.index), Math.abs((candidate.afterPos || 0) - marker.index));
          if (distance < bestDistance) { bestDistance = distance; bestIndex = index; }
        });
        if (bestIndex >= 0) reconstructed[bestIndex].detail = marker[0];
      });
      reconstructed.forEach((row) => {
        add([null, row.date, row.time, row.type, String(row.movement), row.detail, String(best.path[0].before), String(row.balance)],
          row.raw || `${row.date} ${row.time} ${row.type} ${row.movement.toFixed(2)} ${row.detail} ${row.balance.toFixed(2)}`);
      });
      previousColumnRow = reconstructed[reconstructed.length - 1] || previousColumnRow;
    });
    if (!rows.length) rows.push(...parseTMNWalletScreenshots(pages, businessDate));
    return rows;
  }

  /* ---------------- BAY (กรุงศรีอยุธยา) ----------------
     19/06/2026 22:28:12 | โอนเงิน | 144.00 | 1,278.86 | MOBILE | SCB PIMPORN KAEWS
       (บรรทัดถัดไป "บัญชีปลายทาง : X..." เป็นรายละเอียดต่อ)
     คอลัมน์ ถอน/ฝาก รวมเป็นช่องเดียว -> ทิศทางคำนวณจากผลต่างยอดคงเหลือใน applyDirection */
  function parseBAY(pages) {
    const rows = [];
    /* description ใช้ greedy (.+) เพื่อให้ยอด+ยอดคงเหลือผูกกับ "สองเลขสุดท้ายก่อน channel" เสมอ
       กันกรณีมีเลขทศนิยมในรายละเอียดมาแย่งคอลัมน์ยอด · ทศนิยมเป็น optional เผื่อยอดจำนวนเต็ม */
    const re = /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})\s+(.+)\s+([\d,]+(?:\.\d{2})?)\s+([\d,]+(?:\.\d{2})?)\s+([A-Za-zก-๙/]+)\s*(.*)$/;
    pages.forEach((lines) => {
      lines.forEach((l, i) => {
        const m = l.text.match(re);
        if (!m) return;
        if (/ยอดยกมา|ยอดยกไป|ยอดคงเหลือ/.test(m[3])) return;
        const next = lines[i + 1];
        const extra = next && /^บัญชีปลายทาง/.test(next.text) ? " " + next.text.trim() : "";
        rows.push({
          date: isoOf(m[1]),
          sec: secOf(m[2]),
          code: m[3].trim(), // โอนเงิน/รับโอน/ฝากเงิน ฯลฯ
          channel: m[6],
          amount: numOf(m[4]),
          balance: numOf(m[5]),
          desc: (m[7] || "").trim() + extra,
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
      const scbCode = String(r.code || "").toUpperCase();
      let dir = bank === "SCB" ? ({ X1: "deposit", X2: "withdraw", XB: "adjustment" }[scbCode] || null) : null;
      // A BBL balance error must not silently flip a printed FR/TO direction.
      // Preserve the explicit direction so the continuity gate can reject it.
      if (bank === 'BBL') {
        if (/TRF FR|deposit/i.test(scbCode)) dir='deposit';
        else if (/TRF TO|withdraw/i.test(scbCode)) dir='withdraw';
      }
      if (!dir && prevBal !== null && r.balance !== null && Math.abs(Math.abs(r.balance - prevBal) - r.amount) < 0.01) {
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
          if (/รับโอน|เงินโอนเข้า|ฝากเงิน|เงินเข้า|TRF FR|deposit/i.test(r.code + " " + r.desc)) dir = "deposit";
          else if (/โอนเงิน|โอนไป|ถอน|เงินออก|หักบัญชี|ค่าธรรมเนียม|TRF TO|withdraw/i.test(r.code + " " + r.desc)) dir = "withdraw";
        }
      }
      r.direction = dir;
      if (r.balance !== null) prevBal = r.balance;
      r.seq = i;
    });
    return rows;
  }

  /* ---------------- KTB (กรุงไทย) ----------------
     วันที่กับเวลาอยู่คนละบรรทัด (เวลา HH:MM อยู่บรรทัดถัดไป) ปีเป็น พ.ศ. ย่อ (69 = 2569 = 2026)
       29/06/69 | เงินโอนเข้า (IORSDT) | 014-6444474223 | 30.00 | 16,492.01 | 606
       22:55
     บรรทัดสรุปท้าย ("รายการถอนทั้งหมด ...") ไม่ขึ้นต้นด้วยวันที่ จึงถูกข้ามอัตโนมัติ           */
  function parseKtb(pages) {
    const rows = [];
    pages.forEach((lines) => {
      lines.forEach((l, i) => {
        const t = l.text;
        if (!/^\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(t)) return;              // ต้องขึ้นต้นด้วยวันที่
        const amts = l.items.filter((it) => AMT.test(it.s.trim()));
        if (amts.length < 2) return;                                       // ต้องมี ยอด + คงเหลือ
        // เวลา: ในบรรทัดนี้ก่อน ไม่มีค่อยดูบรรทัดถัดไป (ที่ไม่ใช่แถวใหม่)
        let time = (t.match(/\b(\d{1,2}:\d{2})\b/) || [])[1];
        if (!time) {
          const nx = lines[i + 1];
          if (nx && !/^\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(nx.text)) time = (nx.text.match(/\b(\d{1,2}:\d{2})\b/) || [])[1];
        }
        const kind = (t.match(/(เงินโอนเข้า|โอนเงินออก|รับโอนเงิน|โอนเงิน|ฝากเงิน|ถอนเงิน|หักบัญชี|ดอกเบี้ย|ค่าธรรมเนียม)/) || [])[1] || "";
        const secVal = secOf(time); // KTB บางบัญชีไม่แสดงเวลา -> ถอยไปโหมด noTime เหมือน BBL (จับคู่ด้วยบัญชี+ยอด+ทิศทาง)
        rows.push({
          date: isoOf(t),
          sec: secVal === null ? 0 : secVal,
          noTime: secVal === null,
          code: kind,
          channel: "",
          amount: numOf(amts[amts.length - 2].s),
          balance: numOf(amts[amts.length - 1].s),
          desc: t.replace(/^\d{1,2}\/\d{1,2}\/\d{2,4}\s*/, "").trim(),
          raw: t + (time ? " " + time : ""),
        });
      });
    });
    return rows;
  }

  /* ---------------- BBL (กรุงเทพ) ----------------
     ไม่มีคอลัมน์เวลา — ตั้ง noTime แล้วให้ engine จับคู่ด้วยบัญชี+ยอด+ทิศทางภายในวัน
       10/06/26 | TRF FR OTH BK | 14.00 | 1,313.58 | mPhone     (FR = เงินเข้า, TO = เงินออก) */
  function parseBbl(pages) {
    const rows = [];
    pages.forEach((lines, pageIndex) => {
      lines.forEach((l, lineIndex) => {
        const t = l.text;
        if (!/^\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(t)) return;
        const firstAmtIdx = l.items.findIndex((it) => AMT.test(it.s.trim()));
        const amts = l.items.filter((it) => AMT.test(it.s.trim()));
        if (firstAmtIdx < 1 || amts.length < 2) return;                    // ต้องมี ถอน/ฝาก + คงเหลือ
        const particulars = l.items.slice(1, firstAmtIdx).map((it) => it.s).join(" ").trim();
        const via = (l.items[l.items.length - 1] || {}).s || "";
        rows.push({
          page: pageIndex + 1,
          sourceLine: lineIndex + 1,
          date: isoOf(t),
          sec: 0,
          noTime: true,                                                    // ไม่มีเวลาในสเตทเมนต์
          code: particulars,
          channel: "",
          amount: numOf(amts[amts.length - 2].s),
          balance: numOf(amts[amts.length - 1].s),
          desc: (particulars + " " + via).trim(),
          raw: t,
        });
      });
    });
    return rows;
  }

  // Native n8n and OCR text share the same bank parser. Preserve explicit page
  // breaks, repair only structural line wraps; never replace ambiguous digits.
  function pagesFromText(text) {
    const start = /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/;
    return String(text || "").replace(/\u0000/g, "").split(/\f|\n---OCR_IMAGE---\n/).map((page) => {
      const lines = page.split(/\r?\n/).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
      const joined = [];
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        // Google Drive OCR may flatten the KBANK opening-balance row and the
        // first SMS-fee transaction into one physical line:
        //   01-09-26 16-09-26 18:49 ยอดยกมา ... 20.00 500.61 480.61 ...
        // The first date and 500.61 are the statement opening balance, not the
        // transaction date/amount.  Keep the dated fee (20.00) and closing
        // balance (480.61) as the auditable row.
        const flattenedSmsFee = line.match(/\b(\d{1,2}-\d{1,2}-\d{2,4})\s+(\d{1,2}:\d{2})\s+ยอดยกมา\s+ค่าธรรมเนียม.+?\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(โอนเข้า\/หักบัญชีอัตโนมัติ)\s+(.+)$/);
        if (flattenedSmsFee) line = [flattenedSmsFee[1], flattenedSmsFee[2], "ค่าธรรมเนียม", flattenedSmsFee[3], flattenedSmsFee[5], flattenedSmsFee[6], flattenedSmsFee[7].trim()].join(" ");
        // Only join a wrapped row up to its two monetary columns. A new date,
        // header or footer is never consumed into the preceding transaction.
        if (start.test(line) && !isStatementPeriod(line) && !isBalanceForward(line) && !/ยอดยกมา|ยอดยกไป|balance brought|balance carried/i.test(line)) {
          while (i + 1 < lines.length && !start.test(lines[i + 1])
            && !/ยอดรวม|รวมรายการ|รายการถอนทั้งหมด|รายการฝากทั้งหมด|total|page|statement|วันที่.*รายการ/i.test(lines[i + 1])
            && (line.match(/-?[\d,]+\.\d{2}(?!\d)/g) || []).length < 2) {
            line += " " + lines[++i];
          }
        }
        // Some KBANK OCR output puts the closing balance and transaction code
        // on the next physical line. At this point the joined row already has
        // two numbers (fee + opening balance), so the generic join above stops
        // one line too early. Pull in only that narrowly identified third
        // amount/code line, then apply the existing SMS-fee transform.
        if (/^\d{1,2}-\d{1,2}-\d{2,4}\s+\d{1,2}-\d{1,2}-\d{2,4}\s+\d{1,2}:\d{2}\s+ยอดยกมา\s+ค่าธรรมเนียม/.test(line)
          && (line.match(/-?[\d,]+\.\d{2}(?!\d)/g) || []).length === 2
          && i + 1 < lines.length
          && /^-?[\d,]+\.\d{2}\s+(?:โอนเข้า\/หักบัญชีอัตโนมัติ|รับโอนเงิน|โอนเงิน|ฝากเงิน|ถอนเงิน|หักบัญชี|ค่าธรรมเนียม)/.test(lines[i + 1])) {
          line += " " + lines[++i];
        }
        const joinedSmsFee = line.match(/\b(\d{1,2}-\d{1,2}-\d{2,4})\s+(\d{1,2}:\d{2})\s+ยอดยกมา\s+ค่าธรรมเนียม.+?\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(โอนเข้า\/หักบัญชีอัตโนมัติ)\s*(.*)$/);
        if (joinedSmsFee) line = [joinedSmsFee[1], joinedSmsFee[2], "ค่าธรรมเนียม", joinedSmsFee[3], joinedSmsFee[5], joinedSmsFee[6], joinedSmsFee[7].trim()].filter(Boolean).join(" ");
        // KBANK/PDFium may concatenate the channel with the running balance
        // and the description with the transaction type.  Parse by bounded
        // token positions instead of relying on a separator such as "++":
        //   LINE BK12,638.52 ...++โอนเงิน 1,700.00
        //   K PLUS8,038.52 ...KMP21983รับโอนเงิน 1,900.00
        // The first money is the running balance only when it appears before
        // the transaction type and the second money appears after it.
        const prefix = line.match(/^(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s+(\d{1,2}:\d{2})\s+/);
        const monies = [...line.matchAll(/-?[\d,]+\.\d{2}(?!\d)/g)];
        const kindToken = line.match(/(รับโอนเงิน|รับโอนจาก|เงินโอนเข้า|โอนเงิน|โอนไป|ฝากเงิน|ถอนเงิน|หักบัญชี|ดอกเบี้ย|ค่าธรรมเนียม)/);
        if (prefix && monies.length === 2 && kindToken
          && monies[0].index < kindToken.index && kindToken.index < monies[1].index) {
          const channel = line.slice(prefix[0].length, monies[0].index).trim();
          const detail = line.slice(monies[0].index + monies[0][0].length, kindToken.index)
            .replace(/\+\s*\+\s*$/, "").trim();
          line = [prefix[1], prefix[2], kindToken[1], monies[1][0], monies[0][0], channel, detail]
            .filter(Boolean).join(" ");
        }
        // KBANK native extraction sometimes places balance before amount.
        const m = line.match(/^(\d{1,2}-\d{1,2}-\d{2,4})\s+(\d{1,2}:\d{2})\s+(.+?)(-?[\d,]+\.\d{2})\s+(.*?)\+\s*\+\s*(รับโอนเงิน|โอนเงิน|ฝากเงิน|ถอนเงิน|หักบัญชี|ดอกเบี้ย|ค่าธรรมเนียม)\s+(-?[\d,]+\.\d{2})\s*$/);
        if (m) line = [m[1], m[2], m[6], m[7], m[4], m[3].trim(), m[5].trim()].filter(Boolean).join(" ");
        // The current KBANK PDF layout also puts the running balance before
        // the transaction type and emits the movement amount at the very end,
        // but most rows do not contain the historical "++" separator:
        //   27-09-26 23:39 K PLUS18,092.52 ... รับโอนเงิน 3,900.00
        // Reorder only a complete, bounded two-money row. This prevents the
        // balance from becoming the transaction amount and, critically, keeps
        // rows without "++" from disappearing before reconciliation.
        if (!m) {
          const balanceFirst = line.match(/^(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s+(\d{1,2}:\d{2})\s+(.+?)(-?[\d,]+\.\d{2})\s+(.*?)(รับโอนเงิน|รับโอนจาก|เงินโอนเข้า|โอนเงิน|โอนไป|ฝากเงิน|ถอนเงิน|หักบัญชี|ดอกเบี้ย|ค่าธรรมเนียม)\s+(-?[\d,]+\.\d{2})\s*$/);
          if (balanceFirst && (line.match(/-?[\d,]+\.\d{2}(?!\d)/g) || []).length === 2) {
            line = [balanceFirst[1], balanceFirst[2], balanceFirst[6], balanceFirst[7], balanceFirst[4], balanceFirst[3].trim(), balanceFirst[5].trim()].filter(Boolean).join(" ");
          }
        }
        // KBANK debit-card annual fee has no ++ transfer marker. Native PDF
        // text joins ATM to the balance and places the fee amount last.
        const fee = line.match(/^(\d{1,2}-\d{1,2}-\d{2,4})\s+(\d{1,2}:\d{2})\s+ATM\s*(-?[\d,]+\.\d{2})\s+(.*?)ค่าธรรมเนียมรายปีบัตรเดบิต\s+(-?[\d,]+\.\d{2})\s*$/);
        if (fee) line = [fee[1], fee[2], "ค่าธรรมเนียมรายปีบัตรเดบิต", fee[5], fee[3], "ATM", fee[4].trim()].filter(Boolean).join(" ");
        // KBANK SMS fee statements extracted by n8n put the running balance
        // immediately after the transaction channel and emit the debit amount
        // at the very end (often on the following physical line).  Reorder the
        // two verified monetary columns before the normal KBANK parser sees
        // them; otherwise the balance is incorrectly treated as the fee.
        const smsFee = line.match(/^(\d{1,2}-\d{1,2}-\d{2,4})\s+(\d{1,2}:\d{2})\s+(โอนเข้า\/หักบัญชีอัตโนมัติ)\s*(-?[\d,]+\.\d{2})\s+(.+?ค่าธรรมเนียม.+?)\s+(-?[\d,]+\.\d{2})\s*$/);
        if (smsFee) line = [smsFee[1], smsFee[2], "ค่าธรรมเนียม", smsFee[6], smsFee[4], smsFee[3], smsFee[5].trim()].join(" ");
        joined.push({ text: line, items: line.split(/\s+/).map((s) => ({ s })) });
      }
      return joined;
    });
  }

  async function parseText(fileName, text, businessDate) {
    return parse(fileName, pagesFromText(text), businessDate);
  }

  /* Google Document AI เก็บทั้งข้อความ OCR และแถวตารางที่จัดโครงสร้างแล้วไว้คู่กัน
     สำหรับ PDF ภาพสแกนแบบ KBANK ข้อความ plain text มักเรียงตามคอลัมน์ จึงไม่ควร
     นำบรรทัดนั้นมาประกอบยอดเองถ้ามี structured rows ที่ตรวจย้อนกับ OCR ปัจจุบันได้
     ฟังก์ชันนี้รับแถวเดิมเฉพาะเมื่อจำนวน/วัน/เวลา/ทิศทางตรงกับ marker ใน OCR ใหม่
     ครบทุกแถว และเลขบัญชีตรงกับหัว statement เท่านั้น */
  function parseStructuredOcr(fileName, evidence, freshText, businessDate) {
    // TMN rows carry fee/internal-transfer semantics in their description.
    // Historical structured OCR stores only normalized financial columns and
    // can therefore replay fee rows as customer transactions.  Always parse
    // TMN from the current PDF text so those semantic controls are reapplied.
    if (/(?:^|[_\s-])TMN(?:[_\s-]|$)|TRUEMONEY/i.test(String(fileName || ""))) return null;
    const sourceRows = Array.isArray(evidence?.rows) ? evidence.rows : [];
    if (!sourceRows.length || !freshText || !businessDate) return null;
    const pages = pagesFromText(freshText);
    const head = header(pages);
    const markerCounts = new Map();
    const markerRe = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(\d{1,2}:\d{2})\s+(รับโอนเงิน|โอนเงิน|ฝากเงิน|ถอนเงิน|หักบัญชี|ดอกเบี้ย|ค่าธรรมเนียม)/g;
    let marker;
    while ((marker = markerRe.exec(String(freshText)))) {
      const date = isoOf(marker[1]);
      if (date !== businessDate) continue;
      const direction = /รับโอน|ฝากเงิน|ดอกเบี้ย/.test(marker[3]) ? "deposit" : "withdraw";
      const key = `${date}|${secOf(marker[2])}|${direction}`;
      markerCounts.set(key, (markerCounts.get(key) || 0) + 1);
    }
    const rows = sourceRows.map((row) => {
      const rawDate = String(row.sourceDate || row.date || "");
      const date = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : isoOf(rawDate);
      const sec = Number.isFinite(Number(row.sec)) ? Number(row.sec) : secOf(row.time);
      const direction = ["deposit", "ฝาก"].includes(row.direction) ? "deposit"
        : ["withdraw", "ถอน"].includes(row.direction) ? "withdraw" : null;
      return { ...row, date, sec, direction, amount: Number(row.amount), balance: row.balance === null || row.balance === "" || row.balance === undefined ? null : Number(row.balance) };
    }).filter((row) => row.date === businessDate);
    if (!rows.length) return null;
    if (rows.some((row) => row.sec === null || !Number.isFinite(row.sec) || !Number.isFinite(row.amount) || !row.direction)) return null;
    const used = new Map();
    let strictMarkersMatch = true;
    for (const row of rows) {
      const key = `${row.date}|${row.sec}|${row.direction}`;
      const next = (used.get(key) || 0) + 1;
      if (next > (markerCounts.get(key) || 0)) strictMarkersMatch = false;
      used.set(key, next);
    }
    const markerTotal = [...markerCounts.values()].reduce((sum, count) => sum + count, 0);
    const rowAccounts = new Set(rows.map((row) => digits(row.account)).filter(Boolean));
    if (rowAccounts.size > 1 || (head.account && rowAccounts.size === 1 && !rowAccounts.has(head.account))) return null;
    const compactFresh = String(freshText).replace(/\u00a0/g, " ");
    const visibleAccount = [...rowAccounts][0];
    if (visibleAccount && !digits(compactFresh).includes(visibleAccount)) return null;
    let columnMarkersMatch = false;
    if (!strictMarkersMatch || markerTotal !== rows.length) {
      // Google Drive OCR ของ KBANK บางไฟล์คืนข้อความเรียงตามคอลัมน์:
      // วัน/เวลา, ประเภท, ยอด และยอดคงเหลือจึงไม่ได้อยู่บรรทัดเดียวกัน
      // ยืนยันด้วย multiset วัน/เวลา + ยอดคงเหลือที่อ่านจาก PDF ปัจจุบันแทน
      // (ยอดคงเหลือมีความจำเพาะสูงและป้องกันการนำ OCR เก่าของคนละไฟล์มาใช้)
      const timeCounts = new Map();
      const timeRe = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(\d{1,2}:\d{2})/g;
      let time;
      while ((time = timeRe.exec(compactFresh))) {
        const date = isoOf(time[1]);
        if (date !== businessDate) continue;
        const key = `${date}|${secOf(time[2])}`;
        timeCounts.set(key, (timeCounts.get(key) || 0) + 1);
      }
      const usedTimes = new Map();
      let timesOk = [...timeCounts.values()].reduce((sum, count) => sum + count, 0) === rows.length;
      for (const row of rows) {
        const key = `${row.date}|${row.sec}`;
        const next = (usedTimes.get(key) || 0) + 1;
        if (next > (timeCounts.get(key) || 0)) timesOk = false;
        usedTimes.set(key, next);
      }
      const numberCounts = new Map();
      for (const token of compactFresh.match(/-?[\d,]+\.\d{2}/g) || []) {
        const value = Number(token.replace(/,/g, ""));
        if (!Number.isFinite(value)) continue;
        const key = value.toFixed(2);
        numberCounts.set(key, (numberCounts.get(key) || 0) + 1);
      }
      // Validate the complete financial multiset from the current PDF.  Amounts
      // and balances share one counter so a single visible number cannot prove
      // both fields when their values happen to be equal.
      const expectedNumbers = new Map();
      let financialValuesOk = rows.every((row) => Number.isFinite(row.balance));
      for (const row of rows) {
        for (const value of [row.amount, row.balance]) {
          if (!Number.isFinite(value)) {
            financialValuesOk = false;
            continue;
          }
          const key = Number(value).toFixed(2);
          expectedNumbers.set(key, (expectedNumbers.get(key) || 0) + 1);
        }
      }
      for (const [key, count] of expectedNumbers) {
        if ((numberCounts.get(key) || 0) < count) financialValuesOk = false;
      }
      // Some OCR passes lose or split one or more timestamps even though the
      // transaction-type column remains complete. Require the complete
      // direction multiset plus every balance from the current PDF instead.
      const directionCounts = new Map();
      const directionRe = /(รับโอนเงิน|ฝากเงิน|ดอกเบี้ย|โอนเงิน|ถอนเงิน|หักบัญชี|ค่าธรรมเนียม)/g;
      let directionToken;
      while ((directionToken = directionRe.exec(compactFresh))) {
        const direction = /รับโอน|ฝากเงิน|ดอกเบี้ย/.test(directionToken[1]) ? "deposit" : "withdraw";
        directionCounts.set(direction, (directionCounts.get(direction) || 0) + 1);
      }
      const rowDirectionCounts = rows.reduce((counts, row) => {
        counts.set(row.direction, (counts.get(row.direction) || 0) + 1);
        return counts;
      }, new Map());
      const directionsOk = [...rowDirectionCounts.entries()].every(([direction, count]) => directionCounts.get(direction) === count)
        && [...directionCounts.values()].reduce((sum, count) => sum + count, 0) === rows.length;
      // Descriptions in KBANK OCR can repeat words such as “รับโอนเงิน” after
      // the transaction-type column.  Extra tokens therefore must not reject a
      // document whose account, business date, every amount, every balance and
      // minimum direction counts are all verified against the current PDF.
      const directionsCoverRows = rows.length >= 10
        && [...rowDirectionCounts.entries()].every(([direction, count]) => (directionCounts.get(direction) || 0) >= count)
        && [...directionCounts.values()].reduce((sum, count) => sum + count, 0) >= rows.length;
      const businessDateVisible = compactFresh.includes(businessDate)
        || compactFresh.includes(businessDate.split("-").reverse().join("-"))
        || compactFresh.includes(`${businessDate.slice(8, 10)}-${businessDate.slice(5, 7)}-${businessDate.slice(2, 4)}`);
      columnMarkersMatch = financialValuesOk && businessDateVisible && (directionsOk || directionsCoverRows);
    }
    if (!(strictMarkersMatch && markerTotal === rows.length) && !columnMarkersMatch) return null;
    const company = typeof Formats !== "undefined" ? Formats.companyOf(fileName) : null;
    const account = head.account || [...rowAccounts][0] || "UNKNOWN";
    const bank = head.bank || rows.find((row) => row.bank)?.bank || "";
    const records = rows.map((row, index) => ({
      rowNo: Number(row.rowNo || row.row || index + 1), source: "stm", formatCode: "stm_pdf",
      date: businessDate, sourceDate: row.sourceDate || row.date, reportLagDays: 0,
      sec: row.sec, amount: Math.round(row.amount * 100) / 100, balance: row.balance,
      direction: row.direction, account, bank, channel: row.channel || bank,
      company, username: null, ref: row.ref || null, desc: row.desc || row.descriptionOcr || row.detail || "",
      code: row.code || (row.direction === "deposit" ? "รับโอนเงิน" : "โอนเงิน"),
      crossDay: false, lateNight: row.sec >= 82800, minutePrecision: true, noTime: false,
      raw: row.raw || row.rawOcr || row.desc || "",
      page: Number(row.page) || null,
    }));
    return {
      fileName, header: { ...head, bank, account },
      format: { source: "stm", bank, company, headerIdx: 0, map: {}, realCode: "stm_pdf",
        realLabel: `Statement PDF ${bank} ${account}`.trim(), channels: {}, holder: head.holder, period: head.period },
      records, aux: [], dropped: {},
      warnings: [`ใช้แถว OCR ที่ตรวจย้อนกับข้อความ PDF ปัจจุบันครบ ${rows.length} รายการ${columnMarkersMatch ? " (รูปแบบข้อความแยกคอลัมน์)" : ""}`],
      quality: { complete: true, parsedRows: rows.length, unreadRows: [], invalidRows: [], structuredOcrVerified: true, columnLayoutVerified: columnMarkersMatch },
      pageCount: Number(evidence.page_count) || pages.length,
    };
  }

  function isStatementPeriod(text) {
    return /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\s*[-–]\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\s*$/.test(text);
  }

  // BBL opening/closing balances have one amount, not a transaction amount
  // plus balance. Do not swallow a malformed two-amount transaction here.
  function isBalanceForward(text) {
    return /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\s+(?:B\/F|C\/F)\s+-?[\d,]+\.\d{2}\s*$/i.test(text);
  }

  /* ---------------- public ---------------- */
  async function parse(fileName, arrayBuffer, businessDate) {
    const pages = Array.isArray(arrayBuffer) ? arrayBuffer : await textLines(arrayBuffer);
    const head = header(pages);
    // PDFium can omit the KBANK logo/name and emit the account label only
    // after the statement-period line. `header()` intentionally inspects only
    // the heading (to avoid mistaking counterparty banks for the owner), so in
    // that layout the owner bank is otherwise blank even though every row is
    // parsed completely. Use only the controlled STM filename token as a
    // fallback, and never override a bank identified from the document.
    if (!head.bank && /(?:^|[_\s-])STM[_\s-](?:KB|KBANK)(?:[_\s-]|$)/i.test(String(fileName || ""))) head.bank = "KBANK";
    // n8n's native PDF extractor sometimes omits the TMN column heading while
    // preserving every transaction row.  In that layout content-only bank
    // detection falls through to the generic parser, which cannot label
    // fee_p2p_receive and therefore turns wallet fees into false transactions.
    // The controlled source filename is already classified as STM_TMN.  It
    // must take precedence over bank words in transaction descriptions (for
    // example a TMN transfer whose destination text contains "SCB").
    if (/(?:^|[_\s-])TMN(?:[_\s-]|$)|TRUEMONEY/i.test(String(fileName || ""))) head.bank = "TMN";
    let rows =
      head.bank === "SCB" ? parseScb(pages) : (head.bank === "KBANK" || head.bank === "LBK") ? parseKbank(pages) : head.bank === "KTB" ? parseKtb(pages) : head.bank === "BBL" ? parseBbl(pages) : head.bank === "TMN" ? parseTMN(pages, businessDate) : head.bank === "BAY" ? parseBAY(pages) : parseGeneric(pages);
    // Never reinterpret an unreadable TMN statement with the generic bank
    // parser.  TMN has three monetary columns (movement, opening, closing), so
    // the generic two-column rule turns balances into transactions and can
    // falsely close or open cases.  An unrecognized TMN layout must fail the
    // quality gate instead of producing financial evidence from wrong fields.
    if (!rows.length && head.bank !== "TMN") rows = parseGeneric(pages);
    applyDirection(rows, head.bank);
    // A flattened PDF line can begin with an opening-balance date and later
    // contain the actual transaction date immediately followed by its time.
    // Prefer that exact business-date marker only when it is present in the
    // same raw row; this avoids changing genuine cross-day transactions.
    if (businessDate && (head.bank === "KBANK" || head.bank === "LBK")) {
      const [yyyy, mm, dd] = businessDate.split("-");
      const yy = yyyy.slice(-2);
      const escapedDate = `${Number(dd)}[-/]0?${Number(mm)}[-/](?:${yy}|${yyyy})`;
      const businessDateTime = new RegExp(`(?:^|\\s)${escapedDate}\\s+\\d{1,2}:\\d{2}\\b`);
      rows.forEach((row) => {
        if (row.date !== businessDate && businessDateTime.test(String(row.raw || ""))) row.date = businessDate;
      });
    }
    const remainingRows = [...rows];
    const unreadRows = [];
    pages.forEach((lines, pageIndex) => lines.forEach((line, lineIndex) => {
      if (!/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(line.text) || isStatementPeriod(line.text) || isBalanceForward(line.text) || /ยอดยกมา|ยอดยกไป|balance brought|balance carried/i.test(line.text)) return;
      const matchedIndex = remainingRows.findIndex((row) => String(row.raw).includes(line.text));
      if (matchedIndex >= 0) remainingRows.splice(matchedIndex, 1);
      else unreadRows.push({ page: pageIndex + 1, line: lineIndex + 1, raw: line.text });
    }));
    // Counterparty text is useful evidence, but it is not a matching key.
    // Native PDF extraction can occasionally leave that text on a separate
    // line even though date, time, amount, balance and direction are complete.
    // Do not reject an otherwise auditable bank row or force a lossy OCR pass
    // solely because the optional description could not be attached.
    const invalidRows = rows.filter((r) => !r.date || r.sec === null || !Number.isFinite(r.amount) || !r.direction);
    if (head.bank === "SCB" && rows.some((r) => r.ocrMissingColumns)) {
      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1];
        const row = rows[i];
        if (!Number.isFinite(prev.balance) || !Number.isFinite(row.balance) || !Number.isFinite(row.amount)) continue;
        if (Math.abs(Math.abs(row.balance - prev.balance) - row.amount) >= 0.01) {
          invalidRows.push({ ...row, raw: row.raw, continuityError: true });
        }
      }
    }
    const quality = { complete: unreadRows.length === 0 && invalidRows.length === 0, parsedRows: rows.length,
      unreadRows, invalidRows: invalidRows.map((r) => ({ raw: r.raw, reason: "วันที่ เวลา ยอด หรือทิศทางยังยืนยันไม่ได้" })) };

    // ทีมใช้งานตั้งรอบจากวันที่ในหัวข้ออีเมล แต่ statement ธนาคารบางฉบับ
    // (โดยเฉพาะ KBANK) เป็นรายการของวันก่อนหน้า 1 วันทั้งฉบับ เมื่อทุกแถว
    // เป็นวันก่อนหน้ารอบเดียวกัน ให้ถือเป็น reporting lag ปกติและนำมาชนในรอบ
    // ที่ทีมระบุ โดยเก็บวันที่ต้นฉบับไว้ที่ sourceDate เพื่อสอบทานย้อนหลังได้
    const expectedPreviousDate = businessDate
      ? new Date(Date.parse(businessDate + "T00:00:00Z") - 86400000).toISOString().slice(0, 10)
      : null;
    const expectedNextDate = businessDate
      ? new Date(Date.parse(businessDate + "T00:00:00Z") + 86400000).toISOString().slice(0, 10)
      : null;
    const observedDates = new Set(rows.map((r) => r.date).filter(Boolean));
    // Only KBANK/LBK use the confirmed one-day report-lag convention. SCB
    // statements can contain a trailing block from the previous calendar day;
    // promoting that block to the requested business date creates false STM
    // rows and duplicate/manual-review cases. Preserve SCB's printed date and
    // let the normal outside-day filter exclude it from this run.
    const previousDayReport = !!(
      (head.bank === "KBANK" || head.bank === "LBK")
      && businessDate && expectedPreviousDate
      && observedDates.size === 1 && observedDates.has(expectedPreviousDate)
    );

    const company = typeof Formats !== "undefined" ? Formats.companyOf(fileName) : null;
    const dropped = {};
    const drop = (w) => (dropped[w] = (dropped[w] || 0) + 1);
    const records = [];
    let ocrDateCandidateRows = 0;
    let ktbNextDayCandidateRows = 0;
    rows.forEach((r, i) => {
      if (!r.date || !r.direction || !Number.isFinite(r.amount)) return drop("วันที่ ยอด หรือทิศทางยังยืนยันไม่ได้");
      if (r.sec === null || r.amount === null) return drop("อ่านเวลาหรือยอดไม่ได้");
      if (r.direction === "adjustment") return drop("รายการปรับปรุงยอด (XB) แยกออกจากการจับคู่");
      if (r.isFee || r.isNonCustomer) return drop("ค่าธรรมเนียมหรือยอดประกอบ TrueMoney (ไม่ใช่รายการลูกค้า)");
      const ocrDateCandidateOnly = !!(
        businessDate && r.date && r.date !== businessDate && !previousDayReport && r.ocrWalletScreenshot
      );
      /* KTB may post a 23:00-23:59 transaction under the next calendar date.
         Preserve that row only as a candidate. It never enters normal matching
         or creates an exception; Engine promotes it only when the BO row proves
         the same cross-day bank timestamp, account, direction and amount 1:1. */
      const ktbNextDayCandidateOnly = !!(
        head.bank === "KTB" && businessDate && expectedNextDate
        && r.date === expectedNextDate && !previousDayReport
      );
      if (businessDate && r.date && r.date !== businessDate && !previousDayReport && !ocrDateCandidateOnly && !ktbNextDayCandidateOnly) {
        return drop("วันที่ไม่ตรงกับวันที่ตรวจ");
      }
      if (ocrDateCandidateOnly) ocrDateCandidateRows++;
      if (ktbNextDayCandidateOnly) ktbNextDayCandidateRows++;
      records.push({
        rowNo: i + 1,
        source: "stm",
        formatCode: "stm_pdf",
        // Phone screenshots are sometimes flattened with the next/previous
        // calendar heading. Preserve those rows as candidates for the
        // requested business day, but never let them enter ordinary matching.
        // Engine.reconcile may promote one only when an unused BO row proves a
        // unique reciprocal company/account/direction/amount/time pair.
        date: previousDayReport || ocrDateCandidateOnly ? businessDate : r.date,
        sourceDate: r.date,
        reportLagDays: previousDayReport ? 1 : 0,
        sec: r.sec,
        amount: Math.round(r.amount * 100) / 100,
        balance: r.balance,
        direction: r.direction,
        account: head.account || "UNKNOWN",
        bank: head.bank || "",
        channel: head.bank === "LBK" ? "LBK" : (r.channel || head.bank || ""), // LBK: บังคับ channel = "LBK" ให้ตรง registry (parseKbank คืน channel รก ๆ จากคอลัมน์รายละเอียด)
        company,
        username: null,
        ref: null,
        desc: r.desc,
        code: r.code,
        crossDay: false,
        lateNight: r.sec >= 82800,
        minutePrecision: true, // statement ให้เวลาแค่ HH:MM
        noTime: !!r.noTime, // BBL ไม่มีคอลัมน์เวลา — engine ผ่อนกรอบเวลาเป็นทั้งวัน
        ...(head.bank === 'BBL' ? {page:r.page,sourceLine:r.sourceLine} : {}),
        internalTransferHint: !!r.internalTransferHint,
        ocrWalletScreenshot: !!r.ocrWalletScreenshot,
        ocrDateCandidateOnly,
        ktbNextDayCandidateOnly,
        raw: r.raw,
      });
    });

    const warnings = [];
    if (previousDayReport) warnings.push(`Statement เป็นข้อมูลวันที่ ${expectedPreviousDate} และถูกนำเข้ารอบ ${businessDate} ตามวันที่รายงาน`);
    if (ocrDateCandidateRows) warnings.push(`เก็บรายการภาพ TMN ที่หัววันที่คลาด ${ocrDateCandidateRows} รายการไว้เป็น candidate ตรวจเท่านั้น — ใช้ได้เมื่อ BO ยืนยันคู่เดียว`);
    if (ktbNextDayCandidateRows) warnings.push(`เก็บรายการ KTB วันที่ถัดไป ${ktbNextDayCandidateRows} รายการไว้เป็น candidate ตรวจเท่านั้น — ใช้ได้เมื่อ BO เวลา 23:00-23:59 ยืนยันคู่เดียว`);
    if (!head.bank) warnings.push("ระบุธนาคารจากหัวกระดาษไม่ได้ — ใช้ตัวอ่านแบบทั่วไป");
    if (!head.account) warnings.push("อ่านเลขบัญชีจากหัวกระดาษไม่ได้ — ต้องระบุเองในหน้าตั้งค่าบัญชี");
    if (!records.length) warnings.push(rows.length && dropped["วันที่ไม่ตรงกับวันที่ตรวจ"] === rows.length
      ? `ได้รับไฟล์แล้ว อ่านรายการได้ ${rows.length} รายการ แต่ไม่มีรายการวันที่ ${businessDate} ในข้อมูลที่อ่านได้ — ไม่ใช่ไฟล์ขาด; ตรวจ BO แยกฝากและถอนก่อนยืนยันว่าไม่มีรายการ ไม่ต้องขอไฟล์ซ้ำหากต้นฉบับครบและ BO ไม่มีรายการ`
      : "ไม่พบรายการที่ใช้กระทบยอดได้ — ตรวจรายการที่ถูกกรองและความครบถ้วนของ PDF");

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
      quality,
      pageCount: pages.length,
    };
  }

  return { parse, parseText, parseStructuredOcr, pagesFromText, textLines, header, isoOf, parseBAY, parseKbank, parseKtb, parseBbl, parseGeneric, applyDirection };
})();

if (typeof window !== "undefined") window.PdfStm = PdfStm;
