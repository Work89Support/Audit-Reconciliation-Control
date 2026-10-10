/* =============================================================
   Engine - parser + bank rule engine + reconciliation
   Phase 1 ของ roadmap ทำงานจริงในเบราว์เซอร์
   - อ่าน CSV (และ XLSX ถ้ามี SheetJS)
   - ตรวจจับรูปแบบไฟล์และธนาคารจาก header
   - ใช้กฎธนาคารกรองบรรทัดขยะและตีความ direction
   - จับคู่ 3 จุด (account + time + amount) แบบคำนวณสด พร้อม progress
   ============================================================= */

const Engine = (() => {
  // Only transfer descriptions identify a counterparty; never use the statement header account.
  function statementCustomer(row) {
    const description = String(row.desc || row.raw || "");
    const hit = description.match(/(?:รับโอนจาก|โอนจาก|โอนไป|จาก|ไป|from|to)\s*(KBANK|KBNK|KTB|SCB|BBL|GSB|BAAC|TTB|BAY|KKP|UOB|CIMB|LHB|TISCO|GHB)\s*[xX×*]+\s*(\d{4})(?!\d)(?:\s+([^\r\n]+))?/i);
    if (!hit) return { ...row };
    return { ...row, custAccountLast4: hit[2],
      custBank: row.custBank || (hit[1].toUpperCase() === 'KBNK' ? 'KBANK' : hit[1].toUpperCase()),
      custName: row.custName || (hit[3] || '').trim(), customerDescription: description,
      customerIdentitySource: 'statement-description' };
  }
  function customerEvidence(row) {
    return { account: row.custAccount || '', last4: row.custAccountLast4 || '',
      bank: row.custBank || '', name: row.custName || '', user: row.memberCode || '',
      reference: row.ref || '', transactionReference: row.transactionRef || row.ref || '',
      transactionId: row.transactionId || '', providerReference: row.providerRef || '', sourceId: row.sourceId || '',
      description: row.customerDescription || '',
      identitySource: row.customerIdentitySource || '' };
  }
  /* ---------------- CSV parser (รองรับ quote และ \r\n) ---------------- */
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const rows = [];
    let row = [];
    let field = "";
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuote) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else inQuote = false;
        } else field += c;
      } else if (c === '"') inQuote = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
      } else if (c !== "\r") field += c;
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
  }

  /* อ่าน .xlsx — ใช้ตัวอ่านในตัว (XlsxReader) ทำงานได้แม้ออฟไลน์ */
  async function parseSheet(arrayBuffer) {
    if (typeof XlsxReader !== "undefined") return XlsxReader.read(arrayBuffer);
    if (typeof XLSX === "undefined") throw new Error("ยังโหลดตัวอ่านไฟล์ Excel ไม่ได้ — กรุณาใช้ไฟล์ .csv แทน");
    const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: false, raw: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" }).map((r) => r.map((c) => String(c ?? "")));
  }

  /* ---------------- header mapping ---------------- */
  const DICT = {
    datetime: ["datetime", "วันที่เวลา", "วันเวลา", "date_time", "timestamp"],
    date: ["วันที่", "date", "วันที่ทำรายการ", "transaction date"],
    time: ["เวลา", "time"],
    desc: ["รายการ", "รายละเอียด", "หมายเหตุ", "description", "detail", "narrative", "merchant"],
    debit: ["ถอน", "ถอนเงิน", "โอนออก", "debit", "withdraw"],
    credit: ["ฝาก", "ฝากเงิน", "รับเข้า", "credit", "deposit"],
    balance: ["คงเหลือ", "ยอดคงเหลือ", "balance"],
    channel: ["ช่องทาง", "channel"],
    account: ["เลขที่บัญชี", "เลขบัญชีสมาชิก", "บัญชี", "ธนาคาร", "account", "account_no"],
    amount: ["จำนวนเงิน", "จำนวน", "ยอดเงิน", "amount", "ยอด"],
    username: ["username", "ยูสเซอร์", "ผู้ใช้", "user", "employee"],
    company: ["company", "บริษัท", "merchant"],
    status: ["status", "สถานะ"],
    bank: ["bank", "ธนาคาร"],
    txid: ["transaction_id", "txid", "ref", "รหัส", "เลขที่รายการ", "reference"],
    direction: ["direction", "ประเภทรายการ", "type"],
  };

  function mapHeaders(headerRow) {
    const map = {};
    if (!Array.isArray(headerRow)) return map;
    headerRow.forEach((raw, idx) => {
      const cell = String(raw).trim().toLowerCase();
      if (!cell) return;
      for (const [key, words] of Object.entries(DICT)) {
        if (map[key] !== undefined) continue;
        if (words.some((w) => cell === w.toLowerCase() || cell.includes(w.toLowerCase()))) {
          map[key] = idx;
          break;
        }
      }
    });
    return map;
  }

  /* ---------------- format detection ---------------- */
  const BANK_HINTS = [
    { code: "SCB", words: ["scb", "ไทยพาณิชย์"] },
    { code: "KBANK", words: ["kbank", "kasikorn", "กสิกร"] },
    { code: "GSB", words: ["gsb", "ออมสิน", "mymo"] },
    { code: "BBL", words: ["bbl", "bangkok bank", "กรุงเทพ"] },
    { code: "KTB", words: ["ktb", "krungthai", "กรุงไทย"] },
  ];

  function detectFormat(fileName, rows) {
    rows = Array.isArray(rows) ? rows.filter(Array.isArray) : [];
    const name = String(fileName || "").toLowerCase();
    const headerIdx = rows.findIndex((r) => mapHeaders(r).account !== undefined || mapHeaders(r).amount !== undefined || mapHeaders(r).balance !== undefined);
    const header = rows[headerIdx >= 0 ? headerIdx : 0] || [];
    const map = mapHeaders(header);
    const blob = (name + " " + rows.slice(0, 8).flat().join(" ")).toLowerCase();

    let source = "unknown";
    if (map.txid !== undefined && map.username !== undefined) source = "bo";
    else if (map.status !== undefined && map.amount !== undefined && map.username === undefined) source = "pm";
    else if (map.balance !== undefined || (map.debit !== undefined && map.credit !== undefined)) source = "stm";
    if (name.startsWith("pm_") || blob.includes("autopeer") || blob.includes("azpay") || blob.includes("cyberplus") || blob.includes("12pay") || blob.includes("mypay") || blob.includes(" atp ")) source = "pm";
    if (name.startsWith("bo_")) source = "bo";

    let bank = null;
    if (source !== "bo") for (const b of BANK_HINTS) if (b.words.some((w) => blob.includes(w))) bank = b.code;
    if (!bank && source !== "bo" && map.account !== undefined) {
      const sampleAcc = (rows[headerIdx + 2] || rows[headerIdx + 1] || [])[map.account] || "";
      const m = String(sampleAcc).split("-")[0].toUpperCase();
      if (BANK_HINTS.some((b) => b.code === m)) bank = m;
    }

    let company = null;
    ["AUTOPEER", "AZPAY", "COREPAY", "CPPAY", "CPXM", "CYBERPLUS", "12PAY", "MYPAY", "SYS123"].forEach((c) => {
      if (blob.toUpperCase().includes(c)) company = c;
    });

    return { source, bank, company, headerIdx: headerIdx >= 0 ? headerIdx : 0, map };
  }

  /* ---------------- helpers ---------------- */
  const numOf = (v) => {
    const n = parseFloat(String(v ?? "").replace(/[,\s฿]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  function secOf(dateStr, timeStr) {
    const t = String(timeStr || "").trim();
    if (/^\d{5}(?:\.\d+)?$/.test(t) && typeof Formats !== "undefined") {
      const stamp = Formats.stamp(t);
      if (stamp) return stamp.sec;
    }
    const m = t.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    return +m[1] * 3600 + +m[2] * 60 + (+m[3] || 0);
  }
  function isoDateOf(v) {
    const s = String(v || "").trim();
    if (/^\d{5}(?:\.\d+)?$/.test(s) && typeof Formats !== "undefined") {
      const stamp = Formats.stamp(s);
      if (stamp) return stamp.date;
    }
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
    return null;
  }
  const pad = (n) => String(n).padStart(2, "0");
  const hhmmss = (sec) => `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`;

  /* ---------------- normalize + bank rules ---------------- */
  const CARRY_FORWARD = ["ยอดยกมา", "ยอดยกไป", "balance b/f", "brought forward"];
  const CYCLE_LINE = ["รอบวันที่", "statement period", "รอบบัญชี"];

  function normalize(fileName, rows, settings, businessDate) {
    /* 1) ลองรูปแบบรายงานจริงของแผนกก่อน (AT4 / FR8 / บริษัทอื่นใช้ร่วมกัน) */
    if (typeof Formats !== "undefined") {
      const real = Formats.parse(fileName, rows, businessDate);
      if (real) {
        const pmOnly = Object.entries(real.channels).filter(([, c]) => c.isPm);
        const warnings = real.warnings.slice();
        if (pmOnly.length) {
          warnings.push("ช่องทาง PM ที่พบ: " + pmOnly.map(([k, c]) => `${k} ${c.count} รายการ`).join(", ") + " — ต้องมีไฟล์ statement ของช่องทางนี้จึงจะจับคู่ได้");
        }
        return {
          fileName,
          format: {
            // ใช้ side ที่ตัวอ่านรูปแบบจริงระบุ: PM provider เป็น STM, รายงานหลังบ้านเป็น BO
            source: real.side === "aux" ? "aux" : real.side === "stm" ? "stm" : "bo",
            bank: null,
            company: real.company,
            headerIdx: real.headerIdx,
            map: {},
            realCode: real.code,
            realLabel: real.label,
            channels: real.channels,
          },
          records: real.records,
          aux: real.aux,
          dropped: real.dropped,
          warnings,
        };
      }
    }

    const fmt = detectFormat(fileName, rows);
    const map = fmt.map;
    const records = [];
    const dropped = {};
    const warnings = [];
    const drop = (reason) => (dropped[reason] = (dropped[reason] || 0) + 1);

    for (let i = fmt.headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      const joined = r.join(" ").toLowerCase();
      const desc = String(r[map.desc] ?? "").trim();

      if (settings.rules.filterCarryForward && CARRY_FORWARD.some((w) => joined.includes(w.toLowerCase()))) {
        drop("กรองบรรทัดยอดยกมา");
        continue;
      }
      if (settings.rules.filterCarryForward && CYCLE_LINE.some((w) => joined.includes(w.toLowerCase()))) {
        drop("กรองบรรทัดรอบวันที่");
        continue;
      }
      if (fmt.source !== "bo" && /fee[_\s-]*p2p[_\s-]*receive/i.test(joined)) {
        drop("กรองค่าธรรมเนียมรับ P2P ซึ่งไม่ใช่รายการลูกค้า");
        continue;
      }

      // วันที่และเวลา
      const dateVal = map.datetime !== undefined ? r[map.datetime] : r[map.date];
      const timeVal = map.time !== undefined ? r[map.time] : dateVal;
      const iso = isoDateOf(dateVal);
      const sec = secOf(iso, timeVal);
      if (sec === null) {
        drop("ไม่มีเวลาที่อ่านได้");
        continue;
      }
      if (businessDate && iso && iso !== businessDate) {
        drop("วันที่ไม่ตรงกับวันที่ตรวจ");
        continue;
      }

      // ยอดและทิศทาง
      let amount = null;
      let direction = null;
      if (map.debit !== undefined || map.credit !== undefined) {
        const dr = numOf(r[map.debit]);
        const cr = numOf(r[map.credit]);
        if (cr) {
          amount = cr;
          direction = "deposit";
        } else if (dr) {
          amount = dr;
          direction = "withdraw";
        }
      }
      if (amount === null && map.amount !== undefined) amount = numOf(r[map.amount]);
      if (amount === null || amount === 0) {
        drop("ไม่มียอดเงิน");
        continue;
      }
      // Statement บางแหล่งส่งยอดถอนเป็นค่าติดลบ แต่ direction แยกไว้อยู่แล้ว
      // การจับคู่ต้องเทียบมูลค่าเงินจริงกับ BO ซึ่งเก็บเป็นค่าบวก
      amount = Math.abs(amount);

      // กฎรายธนาคาร: ตีความ direction จาก marker (ใช้เฉพาะฝั่งธนาคาร)
      const account0 = String(r[map.account] ?? "").trim();
      const rowBank = map.bank !== undefined ? String(r[map.bank] ?? "").trim().toUpperCase() : "";
      const bank = fmt.source === "bo" ? rowBank || account0.split("-")[0].toUpperCase() : fmt.bank || rowBank || account0.split("-")[0].toUpperCase();
      let adjustment = false;
      if (fmt.source !== "bo" && bank === "SCB") {
        const marker = desc.toUpperCase();
        if (marker.includes("X1")) direction = "deposit";
        else if (marker.includes("X2")) direction = "withdraw";
        else if (marker.includes("XB")) {
          adjustment = true;
          direction = "adjustment";
        }
      } else if (fmt.source !== "bo" && bank === "GSB") {
        const d = desc.toLowerCase();
        if (d.includes("transfer sav deposit") || d.includes("transfer from sav")) direction = "deposit";
        else if (d.includes("sav withdraw")) direction = "withdraw";
      }
      if (adjustment) {
        drop("รายการปรับปรุงยอด (XB) แยกออกจากการจับคู่");
        continue;
      }

      // PM: เฉพาะรายการสำเร็จ
      if (map.status !== undefined) {
        const st = String(r[map.status]).trim().toUpperCase();
        if (settings.rules.pmSuccessOnly && st && st !== "SUCCESS" && st !== "สำเร็จ") {
          drop("รายการไม่สำเร็จ (PM)");
          continue;
        }
      }

      if (map.direction !== undefined) {
        const d = String(r[map.direction]).toUpperCase();
        if (d.includes("DEPOSIT") || d.includes("ฝาก")) direction = "deposit";
        else if (d.includes("WITHDRAW") || d.includes("ถอน")) direction = "withdraw";
      }

      const account = account0 || "UNKNOWN";
      records.push({
        rowNo: i + 1,
        sec,
        date: iso || businessDate,
        amount: Math.round(amount * 100) / 100,
        direction: direction || "deposit",
        account,
        bank: bank || account.split("-")[0].toUpperCase(),
        company: fmt.company || String(r[map.company] ?? "").trim() || null,
        username: String(r[map.username] ?? "").trim() || null,
        ref: String(r[map.txid] ?? "").trim() || null,
        desc,
        crossDay: sec >= 82800,
        raw: r.join(" | "),
      });
    }

    if (!records.length) warnings.push("อ่านไฟล์ได้แต่ไม่พบรายการที่ใช้จับคู่ได้ — ตรวจหัวคอลัมน์อีกครั้ง");
    if (fmt.source === "unknown") warnings.push("ระบุไม่ได้ว่าเป็น STM, BO หรือ PM — ระบบจะถือว่าเป็น STM");
    return { fileName, format: fmt, records, dropped, warnings };
  }

  /* ---------------- reconciliation ---------------- */
  const TYPE_NAME = {
    manual_review: "เติมมือ — รอ Audit ตรวจเอกสารชี้แจง",
    time_diff: "เวลาเกิน tolerance",
    missing_bo: "STM มากกว่า BO",
    missing_stm: "BO มากกว่า STM",
    amount_diff: "ยอดเงินไม่ตรง",
    cross_day: "รายการข้ามวัน (BO กับธนาคารคนละวัน)",
    duplicate: "เติมซ้ำ / รายการซ้ำ",
    wrong_bank: "เลือกธนาคารผิด",
    wrong_account: "ลูกค้าฝากผิดบัญชี",
  };
  const BASE_SEVERITY = {
    manual_review: "medium",
    time_diff: "low",
    missing_bo: "high",
    missing_stm: "high",
    amount_diff: "critical",
    cross_day: "medium",
    duplicate: "critical",
    wrong_bank: "medium",
    wrong_account: "medium",
  };
  const SLA_OF = { critical: 4, high: 8, medium: 48, low: 72 };
  const shiftOf = (h) => (h >= 8 && h < 16 ? "morning" : h >= 16 ? "afternoon" : "night");
  const key2 = (a, amt) => a + "|" + amt.toFixed(2);
  const identityText = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
  // CSV exports generated from Excel often preserve text cells as formulas
  // such as ="ma85027".  The wrapper is presentation syntax, not part of the
  // member identity.  Normalize it before the XB cross-member guard compares
  // PM with BO, while keeping the guard itself strict for genuinely different
  // users.
  const memberIdentityText = (value) => identityText(value)
    .replace(/^=["']/, "")
    .replace(/["']$/, "");
  // BO can contain a long note such as
  // `Sapan: 6aa... | โอนจริง 1300 สำเร็จ 1265.99 คืน 34.01`.
  // Treat the colon as a Text-to-Columns boundary and retain only the exact
  // provider `_id`; surrounding words and payout details are not identity.
  const sapanProviderId = (value) => {
    // Historical BO exports are not perfectly consistent: most rows use
    // `Sapan: 6aa...`, while some omit the colon or spell the label `Spean`.
    // The label is only a boundary marker.  Return the exact 24-character
    // provider id and never include payout/refund text that follows it.
    const hit = String(value ?? "").match(/\b(?:sapan|spean)\s*[:：]?\s*(6aa[a-f0-9]{21})\b/i);
    return hit ? hit[1].toLowerCase() : "";
  };
  const referenceInBo = (reference, bo) => {
    const ref = identityText(reference);
    if (ref.length < 6) return false;
    const boRef = identityText(bo && bo.ref);
    const boNote = identityText(bo && bo.note);
    const boProviderId = sapanProviderId(bo && bo.note) || sapanProviderId(bo && bo.raw);
    return boRef === ref || boRef.includes(ref) || boNote.includes(ref) || boProviderId === ref;
  };
  // Keep matching resilient when an upstream Excel node preserves the 6aa value
  // in the raw row but drops or renames the `_id` header. The parser normally
  // populates providerRef; this last-mile recovery prevents a valid Sapan pair
  // from becoming two false exceptions in production.
  const providerIdOf = (statement) => {
    const explicit = identityText(statement && statement.providerRef);
    if (/^6aa[a-f0-9]{21}$/.test(explicit)) return explicit;
    const rawIds = [...new Set(String(statement && statement.raw || "")
      .toLowerCase().match(/\b6aa[a-f0-9]{21}\b/g) || [])];
    return rawIds.length === 1 ? rawIds[0] : "";
  };
  const providerRefMatches = (statement, bo) => {
    const references = [providerIdOf(statement), statement && statement.providerRef, statement && statement.ref]
      .map(identityText).filter((value, index, rows) => value.length >= 6 && rows.indexOf(value) === index);
    return references.some((ref) => referenceInBo(ref, bo));
  };
  const isIsoDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
  const canonicalDirection = (v) => (/ถอน|withdraw/i.test(String(v || "")) ? "withdraw" : /ฝาก|deposit/i.test(String(v || "")) ? "deposit" : String(v || ""));
  const recordKey = (r) =>
    [r.account || "-", Number(r.amount || 0).toFixed(2), r.date || "", Number.isFinite(Number(r.sec)) ? Number(r.sec) : "", canonicalDirection(r.direction)].join("|");
  /* เทียบ timestamp จริงเมื่อมีวันที่ทั้งสองฝั่ง เพื่อรองรับ 23:59 -> 00:01
     ถ้าวันที่ขาด ใช้เวลาในวันแทน และปล่อย quality gate เป็นผู้แจ้งปัญหาวันที่ */
  const timeDistance = (a, b) => {
    if (!a || !b) return Infinity;
    const aSec = Number(a.sec);
    const bSec = Number(b.sec);
    if (!Number.isFinite(aSec) || !Number.isFinite(bSec)) return Infinity;
    if (isIsoDate(a.date) && isIsoDate(b.date)) {
      const aDay = Date.parse(a.date + "T00:00:00Z");
      const bDay = Date.parse(b.date + "T00:00:00Z");
      if (Number.isFinite(aDay) && Number.isFinite(bDay)) return Math.abs(aDay / 1000 + aSec - (bDay / 1000 + bSec));
    }
    return Math.abs(aSec - bSec);
  };

  function chunked(items, size, worker, onProgress, label) {
    return new Promise((resolve) => {
      let i = 0;
      function step() {
        const end = Math.min(i + size, items.length);
        for (; i < end; i++) worker(items[i], i);
        if (onProgress) onProgress(i / (items.length || 1), label);
        if (i < items.length) setTimeout(step, 0);
        else resolve();
      }
      step();
    });
  }

  // BBL has no clock. Only a unique, continuous multi-row balance anchor
  // proves an overlap; a repeated amount or closing balance alone never does.
  function prepareBblStatements(records) {
    const groups = new Map(), removed = new Set(), evidence = [], issues = [];
    const cents = n => n !== null && n !== undefined && n !== '' && Number.isFinite(Number(n)) ? Math.round(Number(n) * 100) : null;
    const key = r => JSON.stringify([r.date, r.direction, cents(r.amount), cents(r.balance)]);
    const continuous = (a, b) => cents(a.balance) !== null && cents(b.balance) !== null
      && cents(b.amount) > 0 && ['deposit', 'withdraw'].includes(b.direction)
      && cents(a.balance) + (b.direction === 'deposit' ? 1 : -1) * cents(b.amount) === cents(b.balance);
    for (const r of records) {
      if (String(r.bank || r.channel || '').toUpperCase() !== 'BBL' || r.noTime !== true || r.isPmChannel
          || r.source !== 'stm' || r.formatCode !== 'stm_pdf') continue;
      const company = String(r.subco || r.company || '').toUpperCase();
      if (!company || !r.account || r.account === 'UNKNOWN' || !isIsoDate(r.date)
          || cents(r.amount) === null || cents(r.balance) === null || !['deposit', 'withdraw'].includes(r.direction)) {
        issues.push({row:r.rowNo, reason:'BBL ไม่มีเวลา: วันที่ บัญชี ยอด หรือยอดคงเหลือยังไม่ครบ'}); continue;
      }
      const groupKey = JSON.stringify([company, r.account, r.date]);
      const segments = groups.get(groupKey) || new Map();
      // Missing source/page identity must not collapse real repeated entries.
      const source = r.source_file_id || r.source_file || r.fileName || 'single-document';
      const segmentKey = JSON.stringify([source, r.page || 1]);
      const segment = segments.get(segmentKey) || {source, page:r.page || 1, created:r.source_created_at || '', rows:[]};
      segment.rows.push(r); segments.set(segmentKey, segment); groups.set(groupKey, segments);
    }
    for (const [groupKey, segments] of groups) {
      const ordered = [...segments.values()].sort((a,b) => a.created.localeCompare(b.created)
        || (a.source === b.source ? a.page - b.page : 0));
      const accepted = [];
      for (const segment of ordered) {
        const rows = segment.rows.slice().sort((a,b) => Number(a.rowNo || 0) - Number(b.rowNo || 0));
        let valid = true;
        for (let i=1;i<rows.length;i++) if (!continuous(rows[i-1], rows[i])) {
          valid=false; issues.push({source:segment.source,page:segment.page,row:rows[i].rowNo,reason:'BBL ยอดคงเหลือไม่ต่อเนื่อง ห้ามเดาหรือข้ามแถว'});
        }
        if (!valid) { accepted.push(...rows); continue; }
        if (!accepted.length) { accepted.push(...rows); continue; }
        // Find the longest prefix already present in the accepted source order.
        const hits=[];
        for(let start=0;start<accepted.length;start++) {
          let length=0;
          while(length<rows.length && start+length<accepted.length && key(rows[length])===key(accepted[start+length])) length++;
          if(length) hits.push({start,length});
        }
        const longest=Math.max(0,...hits.map(h=>h.length));
        if (longest) {
          const best=hits.filter(h=>h.length===longest);
          const anchor=rows.slice(0,longest).map(key);
          let occurrences=0;
          for(let start=0;start+longest<=rows.length;start++) if(anchor.every((k,i)=>k===key(rows[start+i]))) occurrences++;
          const hit=best[0], remainder=rows.slice(longest);
          const proven=longest>=3 && best.length===1 && occurrences===1
            && rows.slice(1,longest).every((r,i)=>continuous(rows[i],r))
            && (!remainder.length || (hit.start+longest===accepted.length && continuous(accepted.at(-1),remainder[0])));
          if (proven) {
            for(let i=0;i<longest;i++) {
              removed.add(rows[i]);
              evidence.push({source:segment.source,page:segment.page,row:rows[i].rowNo,
                retainedSource:accepted[hit.start+i].source_file_id || accepted[hit.start+i].source_file || null,
                retainedRow:accepted[hit.start+i].rowNo,tuple:JSON.parse(key(rows[i])),anchorRows:longest});
            }
            accepted.push(...remainder); continue;
          }
          issues.push({group:JSON.parse(groupKey),source:segment.source,page:segment.page,reason:'BBL ช่วงซ้อนยังยืนยันไม่ได้แบบ 1:1 (ต้องมีอย่างน้อย 3 แถวต่อเนื่อง)'});
        } else if (!continuous(accepted.at(-1),rows[0])) {
          issues.push({group:JSON.parse(groupKey),source:segment.source,page:segment.page,reason:'BBL รอยต่อไฟล์/หน้าไม่ต่อเนื่อง ต้องตรวจเอกสารก่อน'});
        }
        accepted.push(...rows);
      }
    }
    return {records:records.filter(r=>!removed.has(r)),removed:evidence,issues};
  }

  async function reconcile(stmRecords, boRecords, settings, masterAccounts, onProgress) {
    const bblControl = prepareBblStatements(stmRecords);
    if (bblControl.issues.length) throw new Error('BBL ต้องตรวจลำดับ/ยอดคงเหลือก่อนกระทบยอด: '+bblControl.issues[0].reason);
    stmRecords = bblControl.records;
    /* ตัวอ่านไฟล์บางชนิด (โดยเฉพาะ statement ถอน/TMN) ส่งยอดถอนเป็นค่าติดลบ
       เข้ามาที่ reconcile โดยตรงโดยไม่ผ่าน Engine.normalize จึงต้อง canonicalize
       อีกชั้นตรงขอบเขตนี้ เพื่อให้ -1,020 ฝั่ง STM จับกับ 1,020 ฝั่ง BO ได้จริง */
    const absoluteAmount = (row) => ({ ...row, amount: Math.abs(Number(row && row.amount) || 0) });
    stmRecords = stmRecords.map(absoluteAmount).map(statementCustomer);
    boRecords = boRecords.map(absoluteAmount);
    const auditCompanyOf = (r) => {
      /* PM เก็บ company เป็นชื่อ provider และเก็บบริษัทจริงไว้ที่ subco */
      const raw = String(r && (r.subco || r.company) || "").trim().toUpperCase();
      return raw === "3X" ? "3XB" : raw;
    };
    const isSevenMTmnOcr = (r) => ['7M', 'UFABET7M'].includes(auditCompanyOf(r))
      && !r.isPmChannel && !!r.ocrWalletScreenshot
      && /^(?:TMN|TRUEMONEY)$/.test(String(r.channel || r.bank || "").trim().toUpperCase());
    /* Provider exports can be attached more than once while carrying the same
       immutable `_id`. If those duplicate rows enter the matcher together,
       the 1:1 guard rejects the real Sapan pair and a later generic time pass
       can create a false `time_diff`. Collapse only rows whose exact provider
       id and normalized amount agree. Conflicting amounts stay visible. */
    const providerSeen = new Map();
    let xbProviderDuplicateRowsSuppressed = 0;
    stmRecords = stmRecords.filter((row) => {
      const id = providerIdOf(row);
      if (!id) return true;
      const amount = Math.abs(Number(row && row.amount) || 0);
      const prior = providerSeen.get(id);
      if (!prior) {
        providerSeen.set(id, { amount });
        return true;
      }
      if (prior.amount !== amount) return true;
      xbProviderDuplicateRowsSuppressed++;
      return false;
    });
    /* A DOCX can contain overlapping phone screenshots of the same TMN row.
       The OCR service then emits that exact transaction twice from one source
       file.  Collapse only byte-equivalent transaction evidence from the same
       source file; rows with a different description, amount, time or source
       remain separate because TMN has no immutable transaction id. */
    const tmnOcrSeen = new Set();
    let tmnOcrDuplicateRowsSuppressed = 0;
    stmRecords = stmRecords.filter((row) => {
      if (!isSevenMTmnOcr(row)) return true;
      const sourceId = String(row.source_file_id || "").trim();
      const rawEvidence = identityText(row.raw);
      if (!sourceId || !rawEvidence) return true;
      const key = [sourceId, recordKey(row), rawEvidence].join("|");
      if (!tmnOcrSeen.has(key)) {
        tmnOcrSeen.add(key);
        return true;
      }
      tmnOcrDuplicateRowsSuppressed++;
      return false;
    });
    // TMN Word screenshots can contain the right transaction under a calendar
    // heading flattened from an adjacent screenshot. Keep those rows outside
    // every ordinary matching pass. They may be promoted only after all normal
    // STM rows have had first claim on BO and a strict reciprocal pair remains.
    const tmnDateCandidates = stmRecords.filter((row) => !!row.ocrDateCandidateOnly);
    const ktbNextDayCandidates = stmRecords.filter((row) => !!row.ktbNextDayCandidateOnly);
    stmRecords = stmRecords.filter((row) => !row.ocrDateCandidateOnly && !row.ktbNextDayCandidateOnly);
    const t0 = Date.now();
    const tolDep = settings.toleranceDeposit;
    const tolWit = settings.toleranceWithdraw;
    /* กรอบผ่อนปรนสำหรับคู่ exact ที่ไม่กำกวม: ใช้เมื่อ account/provider + ยอด +
       ทิศทางตรง และทั้งสองฝั่งมีผู้สมัครเพียงคู่เดียวเท่านั้น เพื่อไม่ให้ยอดกลม ๆ
       ที่เกิดซ้ำ (100/500/1,000) ถูกจับผิดรายการ */
    const exactUniqueTol = Math.max(tolDep, tolWit, Number(settings.exactUniqueTolerance || 0));
    /* อายุเคสสำหรับ SLA: ถ้าผู้เรียกส่ง settings.asOf (เวลาจริง เป็น epoch ms) มา จะคิดอายุจากเวลาที่ผ่านจริง
       ถ้าไม่ส่งมา จะ fallback เป็นสูตรเดิม (สมมติ "ตอนนี้" = ปลายวันที่ตรวจ) เพื่อความเข้ากันได้กับข้อมูลย้อนหลัง/ตัวอย่าง */
    const asOf = settings && settings.asOf ? Number(settings.asOf) : null;
    const ageHoursOf = (src) => {
      if (asOf && src && src.date) {
        const base = Date.parse(src.date + "T00:00:00");
        if (Number.isFinite(base)) return Math.max(1, Math.floor((asOf - (base + src.sec * 1000)) / 3600000));
      }
      return 1 + Math.floor((86400 - src.sec) / 3600);
    };
    /* statement ของ KBANK/SCB ให้เวลาแค่ HH:MM — ต้องเผื่ออย่างน้อย 1 นาที */
    const minuteFloor = settings.minuteTolerance ?? 60;
    const tolOf = (d, s, b) => {
      // สเตทเมนต์ไม่มีเวลา (เช่น BBL): จับคู่ด้วยบัญชี+ยอด+ทิศทางภายในวัน (กรอบเวลาทั้งวัน)
      if ((s && s.noTime) || (b && b.noTime)) return 86400;
      const base = d === "withdraw" ? tolWit : tolDep;
      const coarse = (s && s.minutePrecision) || (b && b.minutePrecision);
      return coarse ? Math.max(base, minuteFloor) : base;
    };
    const masterSet = new Set((masterAccounts || []).map((a) => a.id));

    /* บัญชี/ช่องทางที่มีไฟล์ฝั่ง statement จริง — ที่ไม่มีจะไม่ถูกนับเป็น exception */
    const statementCoverageRecords = stmRecords.concat(tmnDateCandidates, ktbNextDayCandidates);
    const stmAccounts = new Set(statementCoverageRecords.map((r) => r.account));
    const stmChannels = new Set(statementCoverageRecords.map((r) => (r.channel || r.bank || "").toUpperCase()).filter(Boolean));
    const hasStmSide = (b) => stmAccounts.has(b.account) || (b.channel && stmChannels.has(String(b.channel).toUpperCase()));
    const noStmSide = [];

    // index BO
    const exactIdx = new Map();
    const accIdx = new Map();
    const boUsed = new Uint8Array(boRecords.length);
    await chunked(
      boRecords,
      20000,
      (b, i) => {
        const k = key2(b.account, b.amount);
        let arr = exactIdx.get(k);
        if (!arr) exactIdx.set(k, (arr = []));
        arr.push(i);
        let arr2 = accIdx.get(b.account);
        if (!arr2) accIdx.set(b.account, (arr2 = []));
        arr2.push(i);
      },
      onProgress,
      "สร้างดัชนีฝั่ง BO",
    );

    const matched = [];
    const exceptions = [];
    const stmLeft = [];
    const tmnDateCandidateMatched = new Set();
    const ktbNextDayCandidateMatched = new Set();
    let timeDiffCount = 0;
    const xbCompanies = new Set(["3XB", "MC8", "MR9", "PS8", "UR9"]);
    const timeVarianceAutoPassCompanies = new Set([...xbCompanies, "AT4", "FR8", "SK8"]);
    const sameCompany = (s, b) => String(s.subco || s.company || "").toUpperCase() === String(b.subco || b.company || "").toUpperCase();
    const plausibleTmnOcrAmount = (ocrAmount, boAmount) => {
      if (!Number.isInteger(ocrAmount) || !Number.isInteger(boAmount) || ocrAmount <= boAmount || boAmount <= 0) return false;
      const ratio = ocrAmount / boAmount;
      if ([10, 100, 1000].includes(ratio)) return true;
      const ocrText = String(ocrAmount), boText = String(boAmount);
      return ocrText.length === boText.length + 1 && ocrText.endsWith(boText);
    };

    /* 7M internal transfers are recorded twice on each source: money leaves one
       company account and reaches another.  BO labels these rows as โยกเงิน/รับยอด,
       while TMN uses promptpay_*_fundout.  They are not customer transactions.
       Close them only when the complete reciprocal statement evidence exists;
       amount-only or text-only matches remain open for Audit review. */
    const internalTransferTol = Math.max(60, Number(settings.internalTransferTolerance ?? 300));
    const internalText = (r) => [r && r.note, r && r.desc, r && r.raw, r && r.ref, r && r.via]
      .filter(Boolean).join(" ");
    const internalBoHint = (r) => /(?:โยก(?:เงิน)?(?:เข้า|ออก)?|รับยอด|ย้ายเงิน|internal\s*transfer)/i.test(internalText(r));
    const internalStmHint = (r) => !!(r && r.internalTransferHint)
      || /(?:fundout|โยก(?:เงิน)?(?:เข้า|ออก)?|รับยอด|ย้ายเงิน)/i.test(internalText(r));
    const oppositeDirection = (a, b) => !!a && !!b && a !== b
      && [a, b].every((d) => d === "deposit" || d === "withdraw");
    const reciprocalStatementLegs = new Map();
    stmRecords.forEach((s) => {
      if (!['7M', 'UFABET7M'].includes(auditCompanyOf(s)) || s.isPmChannel) return;
      const peers = stmRecords.filter((other) => other !== s
        && !other.isPmChannel && sameCompany(s, other)
        && s.date === other.date && s.account !== other.account
        && s.amount === other.amount && oppositeDirection(s.direction, other.direction)
        && timeDistance(s, other) <= internalTransferTol
        && (internalStmHint(s) || internalStmHint(other)));
      reciprocalStatementLegs.set(s, peers);
    });
    const internalTransferCandidate = (s, b) => ['7M', 'UFABET7M'].includes(auditCompanyOf(s))
      && !s.isPmChannel && !b.isPmChannel && sameCompany(s, b)
      && s.date === b.date && isIsoDate(s.date)
      && s.account === b.account && s.amount > 0 && s.amount === b.amount
      && oppositeDirection(s.direction, b.direction)
      && !s.noTime && !b.noTime && Number.isFinite(s.sec) && Number.isFinite(b.sec)
      && timeDistance(s, b) <= internalTransferTol
      && internalBoHint(b)
      && (reciprocalStatementLegs.get(s) || []).length === 1;
    const internalTransferCandidates = new Map();
    const internalTransferPeers = new Map();
    stmRecords.forEach((s) => {
      const rows = (exactIdx.get(key2(s.account, s.amount)) || [])
        .filter((i) => internalTransferCandidate(s, boRecords[i]));
      internalTransferCandidates.set(s, rows);
      rows.forEach((i) => {
        let peers = internalTransferPeers.get(i);
        if (!peers) internalTransferPeers.set(i, (peers = []));
        peers.push(s);
      });
    });
    const internalTransferMatched = new Set();
    stmRecords.forEach((s) => {
      const rows = internalTransferCandidates.get(s) || [];
      if (rows.length !== 1 || (internalTransferPeers.get(rows[0]) || []).length !== 1 || boUsed[rows[0]]) return;
      const i = rows[0], b = boRecords[i];
      boUsed[i] = 1;
      internalTransferMatched.add(s);
      matched.push({ s, b, dt: timeDistance(s, b), internalTransferMatch: true });
    });

    // Repeated internal transfers need whole-group proof, not a guessed nearest
    // row. Require two accounts, equal multiplicity on both STM/BO legs, distinct
    // source rows and consecutive running balances. Pair by source chronology;
    // identical minute timestamps do not identify duplicate transactions.
    const transferGroups = new Map();
    const sourceRowId = (r) => r.source_file_id && Number.isInteger(r.rowNo)
      ? JSON.stringify([r.source_file_id, r.rowNo]) : null;
    stmRecords.forEach((s) => {
      if (!['7M', 'UFABET7M'].includes(auditCompanyOf(s)) || s.isPmChannel
        || internalTransferMatched.has(s) || s.noTime || !isIsoDate(s.date)
        || !Number.isFinite(s.sec) || !(s.amount > 0)) return;
      const key = JSON.stringify([auditCompanyOf(s), s.date, s.amount]);
      if (!transferGroups.has(key)) transferGroups.set(key, []);
      transferGroups.get(key).push(s);
    });
    const chronological = (a, b) => a.sec - b.sec || a.rowNo - b.rowNo;
    const balanceChain = (rows) => rows.every((r, i) => {
      if (!Number.isFinite(r.balance) || !sourceRowId(r)) return false;
      if (!i) return true;
      const prev = rows[i - 1];
      return r.source_file_id === prev.source_file_id && r.rowNo === prev.rowNo + 1
        && Math.round((r.balance - prev.balance) * 100)
          === Math.round(r.amount * 100) * (r.direction === 'deposit' ? 1 : -1);
    });
    for (const group of transferGroups.values()) {
      group.sort(chronological);
      const clusters = [];
      for (const s of group) {
        const last = clusters.at(-1);
        if (!last || s.sec - last.at(-1).sec > internalTransferTol) clusters.push([s]);
        else last.push(s);
      }
      for (const cluster of clusters) {
        if (cluster.at(-1).sec - cluster[0].sec > internalTransferTol) continue;
        const accounts = [...new Set(cluster.map(s => s.account))];
        if (accounts.length !== 2 || !cluster.some(internalStmHint)) continue;
        const legs = accounts.map(account => cluster.filter(s => s.account === account).sort(chronological));
        const n = legs[0].length;
        if (n < 2 || legs[1].length !== n
          || !oppositeDirection(legs[0][0].direction, legs[1][0].direction)
          || legs.some(rows => rows.some(r => r.direction !== rows[0].direction) || !balanceChain(rows))
          || new Set(cluster.map(sourceRowId)).size !== cluster.length) continue;
        const planned = [];
        for (const rows of legs) {
          const s = rows[0];
          const candidates = boRecords.map((b, i) => ({ b, i })).filter(({ b, i }) => !boUsed[i]
            && !b.isPmChannel && !b.noTime && Number.isFinite(b.sec)
            && sameCompany(s, b) && b.date === s.date && b.account === s.account
            && b.amount === s.amount && oppositeDirection(s.direction, b.direction)
            && internalBoHint(b) && rows.some(row => timeDistance(row, b) <= internalTransferTol))
            .sort((a, b) => chronological(a.b, b.b));
          if (candidates.length !== n || candidates.some(({ b }) => !sourceRowId(b))
            || new Set(candidates.map(({ b }) => sourceRowId(b))).size !== n
            || candidates.some(({ b }, i) => timeDistance(rows[i], b) > internalTransferTol)) break;
          candidates.forEach(({ b, i }, k) => planned.push({ s: rows[k], b, i }));
        }
        if (planned.length !== n * 2 || new Set(planned.map(p => sourceRowId(p.b))).size !== n * 2) continue;
        const groupEvidence = { countPerLeg: n, amountPerLeg: n * cluster[0].amount,
          accounts, stmRows: cluster.map(s => ({ fileId: s.source_file_id, row: s.rowNo, balance: s.balance })),
          boRows: planned.map(p => ({ fileId: p.b.source_file_id, row: p.b.rowNo })) };
        planned.forEach(({ s, b, i }) => {
          boUsed[i] = 1;
          internalTransferMatched.add(s);
          matched.push({ s, b, dt: timeDistance(s, b), internalTransferMatch: true, internalTransferGroup: groupEvidence });
        });
      }
    }

    /* TrueMoney phone screenshots are OCR evidence, not native financial
       text. Repair only the known extra-digit class (10->1,000, 53->953,
       40->4,000) when BO independently proves a unique reciprocal pair with
       the same company/account/direction/date and time within one minute.
       Decimal differences such as 280.41 vs 280 remain visible for review. */
    const tmnOcrAmountMatched = new Set();
    const tmnOcrAmountCandidates = new Map();
    const tmnOcrAmountPeers = new Map();
    /* Exact amount evidence owns its BO row before OCR amount repair.  Without
       this reservation, 1,000 at 23:51 can be interpreted as a ten-times OCR
       error against BO 100 at 23:52 and steal the row from the real STM 100;
       the same defect crosses 500/50. */
    const tmnExactAmountClaims = new Map();
    const tmnExactAmountPeers = new Map();
    stmRecords.forEach((s) => {
      if (!isSevenMTmnOcr(s) || internalTransferMatched.has(s)) return;
      const rows = (exactIdx.get(key2(s.account, s.amount)) || []).filter((i) => {
        if (boUsed[i]) return false;
        const b = boRecords[i];
        return sameCompany(s, b) && s.date === b.date && s.direction === b.direction
          && Number.isFinite(s.sec) && Number.isFinite(b.sec) && timeDistance(s, b) <= 60;
      });
      tmnExactAmountClaims.set(s, rows);
      rows.forEach((i) => {
        let peers = tmnExactAmountPeers.get(i);
        if (!peers) tmnExactAmountPeers.set(i, (peers = []));
        peers.push(s);
      });
    });
    stmRecords.forEach((s) => {
      if (!isSevenMTmnOcr(s) || internalTransferMatched.has(s)) return;
      if ((tmnExactAmountClaims.get(s) || []).length) {
        tmnOcrAmountCandidates.set(s, []);
        return;
      }
      const candidates = (accIdx.get(s.account) || []).filter((i) => {
        if (boUsed[i]) return false;
        if ((tmnExactAmountPeers.get(i) || []).length) return false;
        const b = boRecords[i];
        return sameCompany(s, b) && s.date === b.date && s.direction === b.direction
          && Number.isFinite(s.sec) && Number.isFinite(b.sec) && timeDistance(s, b) <= 60
          && plausibleTmnOcrAmount(s.amount, b.amount);
      });
      tmnOcrAmountCandidates.set(s, candidates);
      candidates.forEach((i) => {
        let peers = tmnOcrAmountPeers.get(i);
        if (!peers) tmnOcrAmountPeers.set(i, (peers = []));
        peers.push(s);
      });
    });
    stmRecords.forEach((s) => {
      const candidates = tmnOcrAmountCandidates.get(s) || [];
      if (candidates.length !== 1) return;
      const i = candidates[0];
      if (boUsed[i] || (tmnOcrAmountPeers.get(i) || []).length !== 1) return;
      const b = boRecords[i];
      boUsed[i] = 1;
      tmnOcrAmountMatched.add(s);
      matched.push({ s, b, dt: timeDistance(s, b), tmnOcrAmountCorrection: true });
    });

    /* PM เครือ XB โดยเฉพาะฝั่งถอนเก็บตัวตนธุรกรรมสองค่าแยกกัน:
       - `id`/Ref ธุรกรรม เช่น P2C... (คอลัมน์ A)
       - `_id` ของรายการ Provider เช่น 6aa... (คอลัมน์ O/P/Q ตามแบบไฟล์)
       BO ใส่ `_id` ไว้ภายในหมายเหตุ `Sapan: 6aa...` และอาจมีข้อความอื่นต่อท้าย
       จับคู่จากทิศทาง + ยอดจริง + `_id` ที่พบในหมายเหตุ โดยต้องเป็นคู่ 1:1
       เท่านั้น `_id` 24 ตัวเป็นตัวตนธุรกรรมหลัก จึงไม่ให้ metadata บริษัทที่
       upstream ตั้งชื่อไม่ตรงกันขวางคู่จริง และยังไม่สลับกับยอดซ้ำรายการอื่น */
    const xbProviderRefMatched = new Set();
    // An exact Sapan/Spean provider id is stronger than inconsistent upstream
    // company/provider labels (for example `3xbet` instead of `3XB`).
    const xbProviderRefCandidate = (s, b) => Number.isFinite(s.amount) && Math.abs(s.amount) > 0
      // The 24-character provider `_id` is the transaction identity. Some BO
      // exports keep withdrawals as a signed amount or classify their type
      // inconsistently, so compare the absolute amount and do not let those
      // presentation fields override an otherwise exact id match.
      && Number.isFinite(b.amount) && Math.abs(s.amount) === Math.abs(b.amount)
      && providerIdOf(s).length >= 6 && referenceInBo(providerIdOf(s), b);
    // A different explicit Sapan id is a hard conflict. Never let the generic
    // amount/time passes cross-pair two provider transactions.
    const xbProviderRefConflict = (s, b) => {
      const boProviderId = sapanProviderId(b.note) || sapanProviderId(b.raw);
      if (!boProviderId) return false;
      // A BO row carrying Sapan evidence is reserved for that exact provider
      // transaction. A statement row with a missing `_id` must not consume it
      // through the legacy amount/time rule before the correct row is examined.
      return providerIdOf(s) !== boProviderId;
    };
    // For XB PM rows, the member/user is transaction identity, not merely
    // descriptive metadata. Repeated amounts around the same minute are common;
    // allowing the generic time/amount passes to cross different users can make
    // both rows look matched while attaching each BO transaction to the wrong PM
    // transaction. Keep exact Sapan/_id matching above as the stronger rule, but
    // reject every generic fallback when both sides expose different users.
    const xbMemberConflict = (s, b) => {
      if (!xbCompanies.has(auditCompanyOf(s)) || !s.isPmChannel || !b.isPmChannel) return false;
      const stmMember = memberIdentityText(s && (s.memberCode || s.username));
      const boMember = memberIdentityText(b && (b.memberCode || b.username));
      return !!(stmMember && boMember && stmMember !== boMember);
    };
    const xbRefCandidates = new Map();
    const xbRefPeers = new Map();
    const xbBoByProviderRef = new Map();
    const xbBoByTransactionId = new Map();
    boRecords.forEach((b, i) => {
      const ids = [...new Set([
        sapanProviderId(b && b.note),
        sapanProviderId(b && b.raw),
        ...(`${b && b.ref || ''}`.toLowerCase().match(/\b6aa[a-f0-9]{21}\b/g) || []),
      ].filter(Boolean))];
      ids.forEach((id) => {
        let rows = xbBoByProviderRef.get(id);
        if (!rows) xbBoByProviderRef.set(id, (rows = []));
        rows.push(i);
      });
      const boProviderId = sapanProviderId(b && b.note) || sapanProviderId(b && b.raw);
      const boTransactionId = identityText(b && b.ref);
      // Only index a BO transaction id when that BO row also carries explicit
      // Sapan/Spean evidence. This prevents an ordinary numeric BO reference
      // from being used as a provider-id recovery hint.
      if (boProviderId && boTransactionId.length >= 6) {
        let rows = xbBoByTransactionId.get(boTransactionId);
        if (!rows) xbBoByTransactionId.set(boTransactionId, (rows = []));
        rows.push(i);
      }
    });
    stmRecords.forEach((s) => {
      const providerId = providerIdOf(s);
      const transactionId = identityText(s && s.transactionId);
      const canRecover = !providerId && xbCompanies.has(auditCompanyOf(s)) && s.isPmChannel && transactionId.length >= 6;
      if (!providerId && !canRecover) return;
      const sourceRows = providerId
        ? (xbBoByProviderRef.get(providerId) || [])
        : (xbBoByTransactionId.get(transactionId) || []);
      const rows = sourceRows.filter((i) => {
        if (boUsed[i]) return false;
        const b = boRecords[i];
        if (providerId) return xbProviderRefCandidate(s, b);
        const boProviderId = sapanProviderId(b && b.note) || sapanProviderId(b && b.raw);
        return !!boProviderId
          && identityText(b && b.ref) === transactionId
          && Number.isFinite(s.amount) && Math.abs(s.amount) > 0
          && Number.isFinite(b.amount) && Math.abs(s.amount) === Math.abs(b.amount);
      });
      xbRefCandidates.set(s, rows);
      rows.forEach((i) => {
        let peers = xbRefPeers.get(i);
        if (!peers) xbRefPeers.set(i, (peers = []));
        peers.push(s);
      });
    });
    stmRecords.forEach((s) => {
      const rows = xbRefCandidates.get(s) || [];
      if (rows.length !== 1 || (xbRefPeers.get(rows[0]) || []).length !== 1 || boUsed[rows[0]]) return;
      const i = rows[0], b = boRecords[i];
      const recoveredProviderId = !providerIdOf(s)
        ? (sapanProviderId(b && b.note) || sapanProviderId(b && b.raw))
        : '';
      if (recoveredProviderId) s.providerRef = recoveredProviderId;
      boUsed[i] = 1;
      xbProviderRefMatched.add(s);
      matched.push({
        s, b, dt: timeDistance(s, b), xbProviderRefMatch: true,
        providerSignedAmountNormalized: s.amount !== b.amount,
        providerDirectionMetadataIgnored: !!s.direction && !!b.direction && s.direction !== b.direction,
        providerRefRecoveredFromTransactionId: !!recoveredProviderId,
      });
    });

    /* PM ของเครือ 7M ยืนยันคู่ด้วย 3 จุดจากข้อมูลจริง ไม่ผูกกับถ้อยคำรอบ Ref:
       Ref ใน STM PM ต้องปรากฏใน Ref/โน้ต BO + User ตรง + ยอดจริงตรง
       จึงรองรับทั้งข้อความตรง, "P2P สำเร็จจากรายการ ..." และ
       "MyPay สำเร็จจากรายการ ..." โดยไม่ต้องแยก BOT/พนักงานเป็นคนละชีต */
    const providerIdentityMatched = new Set();
    const providerNearTimeMatched = new Set();
    const sys123ProviderMatched = new Set();
    const providerCandidates = new Map();
    const providerPeers = new Map();
    const providerIdentityCandidate = (s, b) => ['7M','UFABET7M'].includes(auditCompanyOf(s)) && s.isPmChannel && b.isPmChannel
      && sameCompany(s, b)
      && s.account === b.account
      && !!s.direction && s.direction === b.direction
      && Number.isFinite(s.amount) && s.amount > 0 && s.amount === b.amount
      && !!identityText(s.memberCode) && identityText(s.memberCode) === identityText(b.memberCode)
      && providerRefMatches(s, b);
    stmRecords.forEach((s) => {
      if (!s.isPmChannel) return;
      const rows = (exactIdx.get(key2(s.account, s.amount)) || []).filter((i) => providerIdentityCandidate(s, boRecords[i]));
      providerCandidates.set(s, rows);
      rows.forEach((i) => {
        let peers = providerPeers.get(i);
        if (!peers) providerPeers.set(i, (peers = []));
        peers.push(s);
      });
    });
    stmRecords.forEach((s) => {
      const rows = providerCandidates.get(s) || [];
      if (rows.length !== 1 || (providerPeers.get(rows[0]) || []).length !== 1 || boUsed[rows[0]]) return;
      const i = rows[0], b = boRecords[i];
      boUsed[i] = 1;
      providerIdentityMatched.add(s);
      matched.push({ s, b, dt: timeDistance(s, b), providerIdentityMatch: true });
    });

    /* Fallback สำหรับ PM เครือ 7M เมื่อไฟล์ต้นทางไม่มี Ref/User ครบ:
       ใช้ provider + ทิศทาง + วัน + ยอด + เวลาใกล้กันไม่เกิน 10 นาที
       และต้องเป็นคู่ nearest แบบ reciprocal เพียงคู่เดียวเท่านั้น ห้ามจับเมื่อ
       User/Ref ที่มีอยู่ขัดกัน, สถานะไม่สำเร็จ, มี partial หรือเวลาเสมอกัน */
    const providerNearTimeTol = Math.max(0, Number(settings.providerNearTimeTolerance ?? 600));
    const providerStatusOk = (r) => {
      if (r && r.partial) return false;
      const status = String(r && r.status || '').trim().toUpperCase();
      return !/(?:PARTIAL|FAILED|PENDING|CANCELLED|CANCELED|REJECTED)/.test(status);
    };
    const providerIdentityConflict = (s, b) => {
      const su = identityText(s && s.memberCode), bu = identityText(b && b.memberCode);
      if (su && bu && su !== bu) return true;
      const sr = identityText(s && s.ref);
      const br = identityText(b && b.ref);
      const bn = identityText(b && b.note);
      return !!(sr && (br || bn) && !providerRefMatches(s, b));
    };
    const providerNearCandidate = (s, b) => ['7M','UFABET7M'].includes(auditCompanyOf(s))
      && !s.identityOnly
      && s.isPmChannel && b.isPmChannel && sameCompany(s, b)
      && s.date === b.date && isIsoDate(s.date)
      && s.account === b.account && !!s.direction && s.direction === b.direction
      && Number.isFinite(s.amount) && s.amount > 0 && s.amount === b.amount
      && !s.noTime && !b.noTime && Number.isFinite(s.sec) && Number.isFinite(b.sec)
      && timeDistance(s, b) <= providerNearTimeTol
      && providerStatusOk(s) && providerStatusOk(b)
      && !providerIdentityConflict(s, b);
    const providerNearCandidates = new Map();
    const providerNearPeers = new Map();
    stmRecords.forEach((s) => {
      if (providerIdentityMatched.has(s) || !s.isPmChannel) return;
      const rows = (exactIdx.get(key2(s.account, s.amount)) || [])
        .filter((i) => !boUsed[i] && providerNearCandidate(s, boRecords[i]))
        .map((i) => ({ i, dt: timeDistance(s, boRecords[i]) }));
      providerNearCandidates.set(s, rows);
      rows.forEach(({ i, dt }) => {
        let peers = providerNearPeers.get(i);
        if (!peers) providerNearPeers.set(i, (peers = []));
        peers.push({ s, dt });
      });
    });
    const uniqueProviderNearest = (rows, valueOf) => {
      if (!rows.length) return null;
      let best = rows[0], tied = false;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i].dt < best.dt) { best = rows[i]; tied = false; }
        else if (rows[i].dt === best.dt) tied = true;
      }
      return tied ? null : valueOf(best);
    };
    stmRecords.forEach((s) => {
      if (providerIdentityMatched.has(s)) return;
      const i = uniqueProviderNearest(providerNearCandidates.get(s) || [], (row) => row.i);
      if (i == null || boUsed[i]) return;
      const reciprocal = uniqueProviderNearest(providerNearPeers.get(i) || [], (row) => row.s);
      if (reciprocal !== s) return;
      const b = boRecords[i];
      boUsed[i] = 1;
      providerNearTimeMatched.add(s);
      matched.push({ s, b, dt: timeDistance(s, b), providerNearTimeMatch: true });
    });

    /* PM เครือ 123 ใช้ตัวตนลูกค้าแทน Ref/เวลาเป็นคีย์หลัก:
       - AUTOPEER / COREPAY / LOCALPAY ฝาก-ถอน และ AZPAY ฝาก:
         รหัสสมาชิก + เลขบัญชีสมาชิก + ยอดเงินจริง
       - CYBERPLUS ฝากใช้ 3 จุดเหมือนกัน ส่วนถอนใช้รหัสสมาชิก + ยอด
       ทุกกรณีต้องเป็นบริษัท/Provider/ทิศทางเดียวกัน
       ถ้าตัวตน+ยอดซ้ำ ให้จับคู่เวลาที่ใกล้ที่สุดแบบ reciprocal 1:1 ภายใน 60 นาที;
       คู่เสมอหรือไม่มีเวลายังคงเป็นเคส */
    const sys123Companies = new Set(["AT4", "FR8", "SK8"]);
    const sys123Directions = new Map([
      ["AUTOPEER", new Set(["deposit", "withdraw"])],
      ["AZPAY", new Set(["deposit"])],
      ["COREPAY", new Set(["deposit", "withdraw"])],
      ["CYBERPLUS", new Set(["deposit", "withdraw"])],
      ["LOCALPAY", new Set(["deposit", "withdraw"])],
    ]);
    /* BO เครือ 123 บางไฟล์ถูก normalize เป็นรายการ BO ปกติ (isPmChannel=false)
       แต่ยังมี Provider ชัดเจนใน account. ต้องให้กฎตัวตน 3 จุดรับรายการนี้ด้วย
       ไม่เช่นนั้นระบบจะตกไปใช้กฎเวลาและสร้าง missing_bo/missing_stm เท็จ */
    const isSys123ProviderRecord = (r) => !!(r && (r.isPmChannel
      || sys123Directions.has(String(r.account || "").trim().toUpperCase())));
    const sys123GenericProvider = (value) => {
      const provider = String(value || "").trim().toUpperCase();
      return !provider || provider === "PM" || provider === "SYS123" || provider === "UNKNOWN";
    };
    /* บางไฟล์ 123 ไม่มีชื่อ Provider และถูก normalize เป็น PM แม้ฝั่ง BO ระบุ
       Provider ชัดเจน อนุญาตให้อนุมานได้เฉพาะเมื่ออีกฝั่งมี Provider ที่รองรับ;
       ห้ามจับถ้าทั้งสองฝั่งเป็นชื่อกว้างหรือระบุ Provider ขัดกัน */
    const sys123ProviderOfPair = (s, b) => {
      const stmProvider = String(s && s.account || "").trim().toUpperCase();
      const boProvider = String(b && b.account || "").trim().toUpperCase();
      const stmGeneric = sys123GenericProvider(stmProvider);
      const boGeneric = sys123GenericProvider(boProvider);
      if (stmGeneric && boGeneric) return null;
      if (!stmGeneric && !boGeneric && stmProvider !== boProvider) return null;
      const provider = stmGeneric ? boProvider : stmProvider;
      return sys123Directions.has(provider) ? provider : null;
    };
    const accountIdentity = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9ก-๙]+/g, "");
    const accountIdentityMatches = (left, right) => {
      const a = accountIdentity(left), b = accountIdentity(right);
      if (!a || !b) return false;
      if (a === b) return true;
      /* ไฟล์ 123 บางแหล่งส่งเลขบัญชีเต็ม แต่อีกแหล่งส่งเฉพาะ 4 หลักท้าย
         อนุญาตรูปแบบนี้ได้เมื่อกฎยังบังคับสมาชิก/ยอด/Provider เดียวกัน */
      return Math.min(a.length, b.length) >= 4 && (a.endsWith(b) || b.endsWith(a));
    };
    const isSys123PmPair = (s, b) => sys123Companies.has(auditCompanyOf(s))
      && sys123Companies.has(auditCompanyOf(b)) && isSys123ProviderRecord(s) && isSys123ProviderRecord(b);
    const sys123ProviderCandidate = (s, b) => {
      if (!isSys123PmPair(s, b) || !sameCompany(s, b)) return false;
      const provider = sys123ProviderOfPair(s, b);
      if (!provider) return false;
      if (!sys123Directions.get(provider)?.has(s.direction) || s.direction !== b.direction) return false;
      if (!Number.isFinite(s.amount) || s.amount <= 0 || s.amount !== b.amount) return false;
      const stmMember = identityText(s.memberCode), boMember = identityText(b.memberCode);
      if (!stmMember || stmMember !== boMember) return false;
      if (provider === "CYBERPLUS" && s.direction === "withdraw") return true;
      return accountIdentityMatches(s.custAccount || s.custAccountLast4, b.custAccount || b.custAccountLast4);
    };
    const sys123AmountIndex = new Map();
    boRecords.forEach((b, i) => {
      if (!sys123Companies.has(auditCompanyOf(b)) || !isSys123ProviderRecord(b) || !Number.isFinite(b.amount)) return;
      const key = Number(b.amount).toFixed(2);
      const rows = sys123AmountIndex.get(key) || [];
      rows.push(i);
      sys123AmountIndex.set(key, rows);
    });
    const sys123BoRows = (s) => sys123AmountIndex.get(Number(s.amount).toFixed(2)) || [];
    const sys123Candidates = new Map();
    const sys123Peers = new Map();
    stmRecords.forEach((s) => {
      if (!sys123Companies.has(auditCompanyOf(s)) || !isSys123ProviderRecord(s)) return;
      const rows = sys123BoRows(s)
        .filter((i) => !boUsed[i] && sys123ProviderCandidate(s, boRecords[i]));
      sys123Candidates.set(s, rows);
      rows.forEach((i) => {
        let peers = sys123Peers.get(i);
        if (!peers) sys123Peers.set(i, (peers = []));
        peers.push(s);
      });
    });
    stmRecords.forEach((s) => {
      const rows = sys123Candidates.get(s) || [];
      if (rows.length !== 1 || (sys123Peers.get(rows[0]) || []).length !== 1 || boUsed[rows[0]]) return;
      const i = rows[0], b = boRecords[i];
      boUsed[i] = 1;
      sys123ProviderMatched.add(s);
      matched.push({
        s,
        b,
        dt: timeDistance(s, b),
        sys123ProviderMatch: true,
        sys123MatchMethod: (() => {
          const provider = sys123ProviderOfPair(s, b);
          const inferred = sys123GenericProvider(s.account) || sys123GenericProvider(b.account);
          const base = provider === "CYBERPLUS" && s.direction === "withdraw"
            ? "sys123-member-amount"
            : "sys123-member-account-amount";
          return inferred ? base.replace("sys123-", "sys123-provider-inferred-") : base;
        })(),
      });
    });

    /* รายการ 123 มักมียอดกลมๆ ของสมาชิก/บัญชีเดิมซ้ำกันหลายครั้ง
       กฎเดิมจะปฏิเสธทั้งกลุ่มเมื่อไม่ใช่ 1:1 ทำให้เกิด missing_bo/missing_stm
       เท็จจำนวนมาก ขั้นนี้จึงลองจับซ้ำด้วยเวลาใกล้สุดเฉพาะคู่ที่:
       - อยู่วันเดียวกัน มี timestamp จริง และไม่เกินกรอบที่กำหนด
       - เป็น nearest ที่ไม่เสมอกันทั้งสองทิศ (STM -> BO และ BO -> STM)
       วนซ้ำหลังจับแต่ละชุด เพื่อให้คู่ที่เหลือถูกประเมินจากสถานะล่าสุด */
    const sys123DuplicateTimeTol = Math.max(0, Number(settings.sys123DuplicateTimeTolerance ?? 3600));
    const sys123TimedCandidate = (s, b) => sys123ProviderCandidate(s, b)
      && isIsoDate(s.date) && isIsoDate(b.date)
      && !s.noTime && !b.noTime
      && Number.isFinite(s.sec) && Number.isFinite(b.sec)
      && timeDistance(s, b) <= sys123DuplicateTimeTol;
    /* ตัดสินยอดซ้ำทั้งกลุ่มก่อน greedy reciprocal-nearest:
       reciprocal รายแถวอาจค้างทั้งกลุ่มเมื่อ STM หนึ่งแถวห่างจาก BO สองแถว
       เท่ากัน แม้ว่าการจัดคู่รวมจะมีคำตอบที่ดีที่สุดเพียงชุดเดียว (เช่น SK8
       CYBERPLUS 333 เวลา 12:45/12:48). ในทางกลับกัน greedy อาจเริ่มจับได้
       ทั้งที่ต้นทุนรวมของสองชุดเสมอกัน ขั้นนี้จึงหา minimum-cost perfect
       matching ของ connected component และปิดเฉพาะเมื่อ optimum มีชุดเดียว.
       จำกัดขนาดเพื่อไม่ให้ bitmask โตเกินควบคุม; กลุ่มใหญ่ยังคงใช้กฎเดิม. */
    const sys123GroupBlockedStm = new Set();
    const sys123GroupBlockedBo = new Set();
    const sys123GroupCandidates = new Map();
    const sys123GroupPeers = new Map();
    stmRecords.forEach((s) => {
      if (sys123ProviderMatched.has(s) || !sys123Companies.has(auditCompanyOf(s)) || !isSys123ProviderRecord(s)) return;
      const rows = sys123BoRows(s)
        .filter((i) => !boUsed[i] && sys123TimedCandidate(s, boRecords[i]))
        .map((i) => ({ i, dt: timeDistance(s, boRecords[i]) }));
      if (!rows.length) return;
      sys123GroupCandidates.set(s, rows);
      rows.forEach(({ i, dt }) => {
        let peers = sys123GroupPeers.get(i);
        if (!peers) sys123GroupPeers.set(i, (peers = []));
        peers.push({ s, dt });
      });
    });
    const visitedGroupStm = new Set();
    const visitedGroupBo = new Set();
    sys123GroupCandidates.forEach((initialRows, start) => {
      if (visitedGroupStm.has(start)) return;
      const groupStm = [];
      const groupBo = [];
      const queue = [{ side: 'stm', value: start }];
      while (queue.length) {
        const node = queue.shift();
        if (node.side === 'stm') {
          const s = node.value;
          if (visitedGroupStm.has(s)) continue;
          visitedGroupStm.add(s);
          groupStm.push(s);
          (sys123GroupCandidates.get(s) || []).forEach(({ i }) => {
            if (!visitedGroupBo.has(i)) queue.push({ side: 'bo', value: i });
          });
        } else {
          const i = node.value;
          if (visitedGroupBo.has(i)) continue;
          visitedGroupBo.add(i);
          groupBo.push(i);
          (sys123GroupPeers.get(i) || []).forEach(({ s }) => {
            if (!visitedGroupStm.has(s)) queue.push({ side: 'stm', value: s });
          });
        }
      }
      if (groupStm.length < 2 || groupStm.length !== groupBo.length || groupStm.length > 12) return;
      groupStm.sort((a, b) => (String(a.date).localeCompare(String(b.date)))
        || (Number(a.sec) - Number(b.sec)) || (Number(a.rowNo || 0) - Number(b.rowNo || 0)));
      groupBo.sort((a, b) => (String(boRecords[a].date).localeCompare(String(boRecords[b].date)))
        || (Number(boRecords[a].sec) - Number(boRecords[b].sec))
        || (Number(boRecords[a].rowNo || 0) - Number(boRecords[b].rowNo || 0)));
      const boPosition = new Map(groupBo.map((i, position) => [i, position]));
      const memo = new Map();
      const solve = (position, usedMask) => {
        if (position === groupStm.length) return { cost: 0, count: 1, choice: -1 };
        const memoKey = `${position}|${usedMask}`;
        if (memo.has(memoKey)) return memo.get(memoKey);
        let bestCost = Infinity;
        let bestCount = 0;
        let bestChoice = -1;
        for (const candidate of sys123GroupCandidates.get(groupStm[position]) || []) {
          const boPos = boPosition.get(candidate.i);
          if (boPos == null || (usedMask & (1 << boPos))) continue;
          const tail = solve(position + 1, usedMask | (1 << boPos));
          if (!Number.isFinite(tail.cost)) continue;
          const total = candidate.dt + tail.cost;
          if (total < bestCost) {
            bestCost = total;
            bestCount = Math.min(2, tail.count);
            bestChoice = tail.count === 1 ? boPos : -1;
          } else if (total === bestCost) {
            bestCount = Math.min(2, bestCount + tail.count);
            bestChoice = -1;
          }
        }
        const result = { cost: bestCost, count: bestCount, choice: bestChoice };
        memo.set(memoKey, result);
        return result;
      };
      const optimum = solve(0, 0);
      if (!Number.isFinite(optimum.cost)) return;
      if (optimum.count !== 1) {
        groupStm.forEach((s) => sys123GroupBlockedStm.add(s));
        groupBo.forEach((i) => sys123GroupBlockedBo.add(i));
        return;
      }
      let usedMask = 0;
      groupStm.forEach((s, position) => {
        const state = solve(position, usedMask);
        const boPos = state.choice;
        if (boPos < 0) return;
        usedMask |= (1 << boPos);
        const i = groupBo[boPos], b = boRecords[i];
        boUsed[i] = 1;
        sys123ProviderMatched.add(s);
        const provider = sys123ProviderOfPair(s, b);
        const inferred = sys123GenericProvider(s.account) || sys123GenericProvider(b.account);
        const base = provider === "CYBERPLUS" && s.direction === "withdraw"
          ? "sys123-member-amount-group-min-cost"
          : "sys123-member-account-amount-group-min-cost";
        matched.push({
          s, b, dt: timeDistance(s, b), sys123ProviderMatch: true,
          sys123ProviderGroupMatch: true,
          sys123MatchMethod: inferred ? base.replace("sys123-", "sys123-provider-inferred-") : base,
        });
      });
    });
    let sys123Progress = true;
    while (sys123Progress) {
      sys123Progress = false;
      const candidates = new Map();
      const peers = new Map();
      stmRecords.forEach((s) => {
        if (sys123ProviderMatched.has(s) || sys123GroupBlockedStm.has(s)
          || !sys123Companies.has(auditCompanyOf(s)) || !isSys123ProviderRecord(s)) return;
        const rows = sys123BoRows(s)
          .filter((i) => !boUsed[i] && !sys123GroupBlockedBo.has(i) && sys123TimedCandidate(s, boRecords[i]))
          .map((i) => ({ i, dt: timeDistance(s, boRecords[i]) }));
        candidates.set(s, rows);
        rows.forEach(({ i, dt }) => {
          let list = peers.get(i);
          if (!list) peers.set(i, (list = []));
          list.push({ s, dt });
        });
      });
      const proposals = [];
      candidates.forEach((rows, s) => {
        const i = uniqueProviderNearest(rows, (row) => row.i);
        if (i == null || boUsed[i]) return;
        if (uniqueProviderNearest(peers.get(i) || [], (row) => row.s) !== s) return;
        proposals.push({ s, i });
      });
      proposals.forEach(({ s, i }) => {
        if (sys123ProviderMatched.has(s) || boUsed[i]) return;
        const b = boRecords[i];
        boUsed[i] = 1;
        sys123ProviderMatched.add(s);
        matched.push({
          s,
          b,
          dt: timeDistance(s, b),
          sys123ProviderMatch: true,
          sys123MatchMethod: (() => {
            const provider = sys123ProviderOfPair(s, b);
            const inferred = sys123GenericProvider(s.account) || sys123GenericProvider(b.account);
            const base = provider === "CYBERPLUS" && s.direction === "withdraw"
              ? "sys123-member-amount-reciprocal-nearest"
              : "sys123-member-account-amount-reciprocal-nearest";
            return inferred ? base.replace("sys123-", "sys123-provider-inferred-") : base;
          })(),
        });
        sys123Progress = true;
      });
    }

    /* Fallback ที่ปลอดภัยสำหรับ PM เครือ 123 เมื่อไฟล์ต้นทางเว้นสมาชิกหรือ
       เลขบัญชีไว้หนึ่งฝั่ง: ยังต้องตรงบริษัท Provider ทิศทางและยอด และต้องมี
       identity อย่างน้อยหนึ่งจุดที่ตรงจริง โดยข้อมูลที่มีอยู่ห้ามขัดกัน
       จากนั้นเลือกเฉพาะคู่เวลาใกล้ที่สุดแบบ reciprocal 1:1 เท่านั้น
       รองรับคู่ก่อน/หลังเที่ยงคืนจาก timestamp จริง แต่ไม่เดาคู่จากยอดล้วน */
    /* เมื่อมี identity เพียงหนึ่งจุด คู่ยังต้องไม่ขัดกันและต้องเลือกกันเองแบบ
       reciprocal 1:1 จึงขยายหน้าต่างเฉพาะเครือ 123 เป็น 60 นาทีได้อย่างปลอดภัย
       เพื่อรองรับเวลา Provider/BO เหลื่อม โดยไม่จับจากยอดล้วน */
    const sys123FallbackTimeTol = Math.max(0, Number(settings.sys123FallbackTimeTolerance ?? 3600));
    const sys123IdentityState = (s, b) => {
      const sm = identityText(s && s.memberCode), bm = identityText(b && b.memberCode);
      const memberMatch = !!sm && !!bm && sm === bm;
      const memberConflict = !!sm && !!bm && sm !== bm;
      const provider = sys123ProviderOfPair(s, b) || String(s && s.account || "").trim().toUpperCase();
      const accountIgnored = provider === "CYBERPLUS" && s.direction === "withdraw";
      const sa = accountIdentity(s && (s.custAccount || s.custAccountLast4));
      const ba = accountIdentity(b && (b.custAccount || b.custAccountLast4));
      const accountMatch = !accountIgnored && accountIdentityMatches(sa, ba);
      const accountConflict = !accountIgnored && !!sa && !!ba && !accountMatch;
      return { memberMatch, memberConflict, accountMatch, accountConflict, accountIgnored };
    };
    const sys123FallbackCandidate = (s, b) => {
      if (!isSys123PmPair(s, b) || !sameCompany(s, b)) return false;
      const provider = sys123ProviderOfPair(s, b);
      if (!provider) return false;
      if (!sys123Directions.get(provider)?.has(s.direction) || s.direction !== b.direction) return false;
      if (!Number.isFinite(s.amount) || s.amount <= 0 || s.amount !== b.amount) return false;
      const sys123StatusOk = (r) => String(r && r.status || "").trim().toUpperCase() === "PENDING" || providerStatusOk(r);
      if (!sys123StatusOk(s) || !sys123StatusOk(b)) return false;
      if (s.noTime || b.noTime || !Number.isFinite(s.sec) || !Number.isFinite(b.sec)) return false;
      if (!isIsoDate(s.date) || !isIsoDate(b.date) || timeDistance(s, b) > sys123FallbackTimeTol) return false;
      const identity = sys123IdentityState(s, b);
      if (identity.memberConflict || identity.accountConflict) return false;
      return identity.memberMatch || identity.accountMatch;
    };
    const sys123FallbackCandidates = new Map();
    const sys123FallbackPeers = new Map();
    stmRecords.forEach((s) => {
      if (sys123ProviderMatched.has(s) || sys123GroupBlockedStm.has(s)
        || !sys123Companies.has(auditCompanyOf(s)) || !isSys123ProviderRecord(s)) return;
      const rows = sys123BoRows(s)
        .filter((i) => !boUsed[i] && !sys123GroupBlockedBo.has(i) && sys123FallbackCandidate(s, boRecords[i]))
        .map((i) => ({ i, dt: timeDistance(s, boRecords[i]) }));
      sys123FallbackCandidates.set(s, rows);
      rows.forEach(({ i, dt }) => {
        let peers = sys123FallbackPeers.get(i);
        if (!peers) sys123FallbackPeers.set(i, (peers = []));
        peers.push({ s, dt });
      });
    });
    stmRecords.forEach((s) => {
      if (sys123ProviderMatched.has(s) || sys123GroupBlockedStm.has(s)) return;
      const i = uniqueProviderNearest(sys123FallbackCandidates.get(s) || [], (row) => row.i);
      if (i == null || boUsed[i]) return;
      if (uniqueProviderNearest(sys123FallbackPeers.get(i) || [], (row) => row.s) !== s) return;
      const b = boRecords[i];
      boUsed[i] = 1;
      sys123ProviderMatched.add(s);
      matched.push({
        s,
        b,
        dt: timeDistance(s, b),
        sys123ProviderMatch: true,
        sys123MatchMethod: (sys123GenericProvider(s.account) || sys123GenericProvider(b.account))
          ? "sys123-provider-inferred-partial-identity-reciprocal-near-time"
          : "sys123-partial-identity-reciprocal-near-time",
      });
    });

    /* ทิศทางต้องตรงกัน (ฝากจับคู่ฝาก / ถอนจับคู่ถอน) — ถ้าฝั่งใดไม่มี direction ให้ผ่าน (กันรายการที่ระบุทิศไม่ได้) */
    const crossCandidate = (s, b) => {
      if (!sameCompany(s, b) || !String(s.company || s.subco || "").trim()) return false;
      if (!s.direction || s.direction !== b.direction || s.account !== b.account || s.amount !== b.amount) return false;
      if (s.noTime || b.noTime || !isIsoDate(s.date) || !isIsoDate(b.date)) return false;
      if (s.sec == null || b.sec == null) return false;
      return timeDistance(s, b) <= Math.max(tolOf(s.direction, s, b), exactUniqueTol);
    };
    // Count candidates against the original inputs, not only unused rows:
    // processing order must never turn an ambiguous cross-day pair into a match.
    const crossSafe = new Map();
    const stmByExact = new Map();
    stmRecords.forEach((s) => {
      const key = key2(s.account, s.amount);
      if (!stmByExact.has(key)) stmByExact.set(key, []);
      stmByExact.get(key).push(s);
    });
    const customerAccount = (r) => {
      const value = String(r.custAccount || "").trim().replace(/[\s-]/g, "");
      return /^\d{5,}$/.test(value) ? value : "";
    };
    const customerNameIdentity = (value) => String(value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/^(?:นาย|นางสาว|นาง|น\.\s*ส\.|mr\.?|mrs\.?|miss)\s*/i, "")
      .replace(/[^a-z0-9ก-๙]+/g, "");
    const customerTail = (row) => {
      const full = customerAccount(row);
      if (full) return full.slice(-4);
      const tail = String(row && row.custAccountLast4 || "").replace(/\D/g, "");
      return /^\d{4}$/.test(tail) ? tail : "";
    };
    const isSys123NormalBankPair = (s, b) => sys123Companies.has(auditCompanyOf(s))
      && sys123Companies.has(auditCompanyOf(b)) && !s.isPmChannel && !b.isPmChannel;
    const sys123BankCustomerIdentity = (s, b) => {
      const stmTail = customerTail(s), boTail = customerTail(b);
      const stmName = customerNameIdentity(s && s.custName), boName = customerNameIdentity(b && b.custName);
      return {
        tailMatch: !!stmTail && !!boTail && stmTail === boTail,
        tailConflict: !!stmTail && !!boTail && stmTail !== boTail,
        nameMatch: stmName.length >= 4 && stmName === boName,
        nameConflict: stmName.length >= 4 && boName.length >= 4 && stmName !== boName,
      };
    };
    // Last-four is the strongest customer identity available in normal-bank
    // statements. Thai/English spellings, titles and OCR differences can make
    // the display names differ even when the account tail is identical. Keep
    // the name as searchable evidence, but do not let it veto an exact tail.
    const sys123BankIdentityConflict = (identity) =>
      identity.tailConflict || (!identity.tailMatch && identity.nameConflict);
    const identityCandidate = (s, b) => {
      if (!sameCompany(s, b) || !String(s.company || s.subco || "").trim()) return false;
      if (isSys123PmPair(s, b) || xbProviderRefConflict(s, b) || xbMemberConflict(s, b)) return false;
      if (s.date !== b.date || !isIsoDate(s.date)) return false;
      if (!s.direction || s.direction !== b.direction || s.account !== b.account) return false;
      if (!Number.isFinite(s.amount) || s.amount <= 0 || s.amount !== b.amount) return false;
      if (s.noTime || b.noTime || !Number.isFinite(s.sec) || !Number.isFinite(b.sec)) return false;
      if (s.sec < 0 || s.sec >= 86400 || b.sec < 0 || b.sec >= 86400) return false;
      const bankConflict = !!s.custBank && !!b.custBank
        && String(s.custBank).toUpperCase().replace('KBNK','KBANK') !== String(b.custBank).toUpperCase().replace('KBNK','KBANK');
      if (bankConflict) return false;
      if (isSys123NormalBankPair(s, b)) {
        const identity = sys123BankCustomerIdentity(s, b);
        if (sys123BankIdentityConflict(identity)) return false;
        return (identity.tailMatch || identity.nameMatch) && timeDistance(s, b) <= exactUniqueTol;
      }
      const boAccount = customerAccount(b), stmAccount = customerAccount(s);
      if (!boAccount) return false;
      if (stmAccount ? stmAccount !== boAccount
        : !/^\d{4}$/.test(s.custAccountLast4 || '') || !boAccount.endsWith(s.custAccountLast4)) return false;
      return timeVarianceAutoPassCompanies.has(auditCompanyOf(s)) || timeDistance(s, b) <= 3600;
    };
    const identityMatched = new Set();
    const identityAmbiguous = new Set();
    // Count on original inputs on BOTH sides, before consumption, to avoid order-dependent matches.
    for (const s of stmRecords) {
      if (xbProviderRefMatched.has(s)) continue;
      const candidates = (exactIdx.get(key2(s.account, s.amount)) || []).filter(i => identityCandidate(s, boRecords[i]));
      if (!candidates.length) continue;
      const i = candidates[0], b = boRecords[i];
      const peers = (stmByExact.get(key2(b.account, b.amount)) || []).filter(other => identityCandidate(other, b));
      if (candidates.length !== 1 || peers.length !== 1) {
        identityAmbiguous.add(s);
        candidates.forEach(ci => identityAmbiguous.add(boRecords[ci]));
        peers.forEach(other => identityAmbiguous.add(other));
        continue;
      }
      boUsed[i] = 1;
      identityMatched.add(s);
      const sys123Identity = isSys123NormalBankPair(s, b) ? sys123BankCustomerIdentity(s, b) : null;
      matched.push({
        s, b, dt: timeDistance(s, b), customerIdentityMatch: true,
        sys123BankIdentityMatch: !!sys123Identity,
        sys123CustomerLast4Match: !!sys123Identity?.tailMatch,
        sys123CustomerNameMatch: !!sys123Identity?.nameMatch,
      });
    }
    const dirOK = (s, b) => {
      if (identityAmbiguous.has(s) || identityAmbiguous.has(b)) return false;
      if (xbProviderRefConflict(s, b)) return false;
      if (xbMemberConflict(s, b)) return false;
      if (isSys123NormalBankPair(s, b)) {
        const identity = sys123BankCustomerIdentity(s, b);
        if (sys123BankIdentityConflict(identity)) return false;
      }
      if (['7M','UFABET7M'].includes(auditCompanyOf(s)) && s.isPmChannel && b.isPmChannel
          && providerIdentityConflict(s, b)) return false;
      /* คู่ PM 7M ที่ปลอดภัยถูกใช้ไปแล้วใน provider identity / reciprocal
         near-time pass ด้านบน ที่เหลือต้องเปิดไว้ตรวจ ห้าม generic pass เดาคู่ */
      if (['7M','UFABET7M'].includes(auditCompanyOf(s)) && s.isPmChannel && b.isPmChannel) return false;
      /* PM เครือ 123 ที่ไม่ผ่านกฎเฉพาะด้านบนต้องคงเป็นเคส ห้าม generic pass
         ลดหลักฐานเหลือเพียงยอด/เวลาแล้วปิดแทน */
      if (isSys123PmPair(s, b)) return false;
      if (s.custAccountLast4 && customerAccount(b) && !identityCandidate(s, b)) return false;
      if (customerAccount(s) && customerAccount(b) && customerAccount(s) !== customerAccount(b)) return false;
      if (customerAccount(s) && customerAccount(b) && !identityCandidate(s, b)) return false;
      if (!sameCompany(s, b)) return false;
      if (s.date === b.date) return !s.direction || !b.direction || s.direction === b.direction;
      if (!crossCandidate(s, b)) return false;
      let candidates = crossSafe.get(s);
      if (!candidates) {
        candidates = (exactIdx.get(key2(s.account, s.amount)) || []).map((i) => boRecords[i]).filter((other) => crossCandidate(s, other));
        crossSafe.set(s, candidates);
      }
      return candidates.length === 1 && (stmByExact.get(key2(b.account, b.amount)) || []).filter((other) => crossCandidate(other, b)).length === 1;
    };

    // pass 1a: จับคู่ exact (บัญชี+ยอด+ทิศทาง) ที่อยู่ "ในเกณฑ์เวลา" ให้ครบก่อน
    //   ทำก่อนขั้น time_diff เพื่อกันรายการที่เวลาใกล้กว่าถูกแย่ง BO ไปโดยรายการที่อยู่ไกลกว่า
    const stmMid = [];
    await chunked(
      stmRecords,
      10000,
      (s) => {
        if (internalTransferMatched.has(s)) return;
        if (tmnOcrAmountMatched.has(s)) return;
        if (xbProviderRefMatched.has(s)) return;
        if (providerIdentityMatched.has(s)) return;
        if (providerNearTimeMatched.has(s)) return;
        if (sys123ProviderMatched.has(s)) return;
        if (identityMatched.has(s)) return;
        const cands = exactIdx.get(key2(s.account, s.amount));
        let best = -1;
        let bestDt = Infinity;
        if (cands) {
          for (const ci of cands) {
            if (boUsed[ci]) continue;
            const b = boRecords[ci];
            if (!dirOK(s, b)) continue;
            const dt = timeDistance(b, s);
            if (dt <= tolOf(s.direction, s, b) && dt < bestDt) {
              bestDt = dt;
              best = ci;
            }
          }
        }
        if (best >= 0) {
          boUsed[best] = 1;
          matched.push({ s, b: boRecords[best], dt: bestDt });
          if (bestDt > tolOf(s.direction, s, boRecords[best]) * 0.6) timeDiffCount++;
        } else {
          stmMid.push(s);
        }
      },
      onProgress,
      "จับคู่ 3 จุด (ในเกณฑ์)",
    );

    // pass 1b: ผ่อนเวลาให้คู่ exact ที่มีเพียงคู่เดียว (ค่าใช้งานจริง 10 นาที)
    const stmFar = [];
    const pendingByKey = new Map();
    stmMid.forEach((s) => {
      const k = key2(s.account, s.amount) + "|" + (s.direction || "");
      let arr = pendingByKey.get(k);
      if (!arr) pendingByKey.set(k, (arr = []));
      arr.push(s);
    });
    const extendedMatched = new Set();
    await chunked(
      stmMid,
      10000,
      (s) => {
        const cands = exactIdx.get(key2(s.account, s.amount)) || [];
        const eligible = cands.filter((ci) => {
          if (boUsed[ci]) return false;
          const b = boRecords[ci];
          return dirOK(s, b) && timeDistance(b, s) <= exactUniqueTol;
        });
        if (exactUniqueTol > tolOf(s.direction, s, null) && eligible.length === 1) {
          const ci = eligible[0];
          const b = boRecords[ci];
          const key = key2(s.account, s.amount) + "|" + (s.direction || "");
          const competingStm = (pendingByKey.get(key) || []).some((other) =>
            other !== s && !extendedMatched.has(other) && timeDistance(other, b) <= exactUniqueTol,
          );
          if (!competingStm) {
            boUsed[ci] = 1;
            extendedMatched.add(s);
            matched.push({ s, b, dt: timeDistance(b, s), extendedTimeMatch: true });
            return;
          }
        }
        stmFar.push(s);
      },
      onProgress,
      "จับคู่ยอดตรงที่ไม่กำกวม",
    );

    // pass 1c: รายการที่ยังไม่แม็ป — หากบัญชี+ยอด+ทิศทางตรงและห่างไม่เกิน 1 ชม.
    // ถือว่าจับคู่ได้ตามนโยบาย Audit ของ 5 บริษัท เก็บหลักฐานเวลาคลาดไว้ใน match evidence
    // แต่ไม่เปิด time_diff ให้ Audit ต้องยืนยันทีละรายการ
    await chunked(
      stmFar,
      10000,
      (s) => {
        const cands = exactIdx.get(key2(s.account, s.amount));
        let best = -1;
        let bestDt = Infinity;
        if (cands) {
          for (const ci of cands) {
            if (boUsed[ci]) continue;
            const b = boRecords[ci];
            if (!dirOK(s, b)) continue;
            const dt = timeDistance(b, s);
            if (dt < bestDt) {
              bestDt = dt;
              best = ci;
            }
          }
        }
        if (best >= 0 && bestDt < 3600) {
          const b = boRecords[best];
          // Do not consume a TMN screenshot row as time_diff. Leave it for the
          // reciprocal 1:1 rescue below, which can safely correct cases such
          // as an OCR time 20:53 whose actual row is 21:15.
          if (isSevenMTmnOcr(s)) {
            stmLeft.push(s);
          } else if (timeVarianceAutoPassCompanies.has(auditCompanyOf(s))) {
            boUsed[best] = 1;
            matched.push({ s, b, dt: bestDt, timeVarianceAccepted: true });
          } else {
            boUsed[best] = 1;
            exceptions.push(mkException("time_diff", s, b, bestDt));
          }
        } else {
          stmLeft.push(s);
        }
      },
      onProgress,
      "จับคู่ 3 จุด (ต่างเวลา)",
    );

    // pass 2: ยอดไม่ตรง (บัญชีเดียวกัน เวลาใกล้กัน แต่ยอดต่าง)
    const stmLeft2 = [];
    await chunked(
      stmLeft,
      10000,
      (s) => {
        const cands = accIdx.get(s.account);
        let best = -1;
        let bestDt = Infinity;
        if (cands) {
          for (const ci of cands) {
            if (boUsed[ci]) continue;
            const b = boRecords[ci];
            if (!dirOK(s, b)) continue;
            const dt = timeDistance(b, s);
            if (dt < bestDt) {
              bestDt = dt;
              best = ci;
            }
          }
        }
        if (best >= 0 && bestDt <= tolOf(s.direction, s, boRecords[best])) {
          boUsed[best] = 1;
          exceptions.push(mkException("amount_diff", s, boRecords[best], bestDt));
        } else {
          stmLeft2.push(s);
        }
      },
      onProgress,
      "ตรวจยอดไม่ตรง",
    );

    /* pass 2b: กู้คู่ที่เคยหลุดเป็น missing_bo + missing_stm
       บางชุดมีข้อมูลลูกค้าซ้ำจน identity pass ตั้งใจหยุดไว้ แม้รายการที่เหลือจะมี
       คู่เวลาใกล้ที่สุดแบบ 1:1 ชัดเจนแล้ว จึงลองจับซ้ำก่อนสร้าง exception โดย:
       - บริษัท/บัญชีหรือ provider/ยอด/ทิศทาง/วันที่ต้องตรง
       - ข้อมูลบัญชีหรือธนาคารลูกค้าที่มีอยู่ทั้งสองฝั่งต้องไม่ขัดกัน
       - ต้องเป็นคู่ที่ต่างฝ่ายต่างเลือกกันเป็นเวลาที่ใกล้ที่สุดเพียงหนึ่งเดียว
       เวลาห่างเกิน 10 นาทีไม่ใช่เหตุเปิดเคส หากคู่ยังชัดเจนตามเงื่อนไขข้างต้น
       คู่กำกวมและคู่เวลาเท่ากันยังคงส่งให้ Audit ตรวจ */
    const rescueCustomerConflict = (s, b) => {
      const sa = customerAccount(s), ba = customerAccount(b);
      if (sa && ba && sa !== ba) return true;
      if (!sa && /^\d{4}$/.test(s.custAccountLast4 || "") && ba && !ba.endsWith(s.custAccountLast4)) return true;
      if (isSys123NormalBankPair(s, b)) {
        const identity = sys123BankCustomerIdentity(s, b);
        if (sys123BankIdentityConflict(identity)) return true;
      }
      const sb = String(s.custBank || "").toUpperCase().replace("KBNK", "KBANK");
      const bb = String(b.custBank || "").toUpperCase().replace("KBNK", "KBANK");
      return !!(sb && bb && sb !== bb);
    };
    const rescueCandidates = new Map();
    const rescuePeers = new Map();
    const rescueGroupKey = (r) => [auditCompanyOf(r),r.date,r.account,r.amount,r.direction].join('|');
    const rescueStmGroupCount = new Map(), rescueBoGroupCount = new Map();
    stmLeft2.forEach(s => rescueStmGroupCount.set(rescueGroupKey(s),(rescueStmGroupCount.get(rescueGroupKey(s))||0)+1));
    boRecords.forEach((b,ci) => {
      if (!boUsed[ci]) rescueBoGroupCount.set(rescueGroupKey(b),(rescueBoGroupCount.get(rescueGroupKey(b))||0)+1);
    });
    const rescueEligible = (s, b) => sameCompany(s, b)
      && !!String(s.company || s.subco || "").trim()
      && !xbProviderRefConflict(s, b)
      && !xbMemberConflict(s, b)
      && !(['7M','UFABET7M'].includes(auditCompanyOf(s)) && s.isPmChannel && b.isPmChannel)
      && !isSys123PmPair(s, b)
      && s.date === b.date && isIsoDate(s.date)
      && !!s.direction && s.direction === b.direction
      && s.account === b.account && s.amount === b.amount
      && !s.noTime && !b.noTime
      && Number.isFinite(s.sec) && Number.isFinite(b.sec)
      && (timeVarianceAutoPassCompanies.has(auditCompanyOf(s)) || timeDistance(s, b) < 3600)
      && (isSys123NormalBankPair(s,b)
        || rescueStmGroupCount.get(rescueGroupKey(s)) === rescueBoGroupCount.get(rescueGroupKey(b)))
      && !rescueCustomerConflict(s, b);
    stmLeft2.forEach((s) => {
      const list = (exactIdx.get(key2(s.account, s.amount)) || [])
        .filter((ci) => !boUsed[ci] && rescueEligible(s, boRecords[ci]))
        .map((ci) => ({ ci, dt: timeDistance(s, boRecords[ci]) }));
      rescueCandidates.set(s, list);
      list.forEach(({ ci, dt }) => {
        let peers = rescuePeers.get(ci);
        if (!peers) rescuePeers.set(ci, (peers = []));
        peers.push({ s, dt });
      });
    });
    // Balance the connected identity/time candidate group, not every equal
    // amount on this account/day. An unrelated customer's missing BO must not
    // block two independently identifiable receipts. Surplus compatible rows
    // still block the entire component; equal-distance ties remain blocked.
    const rescueBalanced = new Set();
    const rescueVisited = new Set();
    stmLeft2.forEach((start) => {
      if (rescueVisited.has(start)) return;
      const statements = new Set(), backoffice = new Set(), pending = [start];
      while (pending.length) {
        const s = pending.pop();
        if (statements.has(s)) continue;
        statements.add(s);
        rescueVisited.add(s);
        for (const { ci } of rescueCandidates.get(s) || []) {
          if (backoffice.has(ci)) continue;
          backoffice.add(ci);
          for (const peer of rescuePeers.get(ci) || []) pending.push(peer.s);
        }
      }
      if (backoffice.size > 0 && statements.size === backoffice.size)
        statements.forEach((s) => rescueBalanced.add(s));
    });
    const uniqueNearest = (rows, valueOf) => {
      if (!rows.length) return null;
      let best = rows[0], tied = false;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i].dt < best.dt) {
          best = rows[i];
          tied = false;
        } else if (rows[i].dt === best.dt) tied = true;
      }
      return tied ? null : valueOf(best);
    };
    const rescuedStm = new Set();
    stmLeft2.forEach((s) => {
      if (rescuedStm.has(s) || !rescueBalanced.has(s)) return;
      const ci = uniqueNearest(rescueCandidates.get(s) || [], (row) => row.ci);
      if (ci == null || boUsed[ci]) return;
      const reciprocal = uniqueNearest(rescuePeers.get(ci) || [], (row) => row.s);
      if (reciprocal !== s) return;
      const b = boRecords[ci];
      boUsed[ci] = 1;
      rescuedStm.add(s);
      matched.push({ s, b, dt: timeDistance(s, b), rescueMatch: true, tmnOcrTimeCorrection: isSevenMTmnOcr(s) });
    });

    /* FR8 statement ธนาคารปกติแสดงเลขบัญชีผู้โอนเพียง 4 หลักท้าย ขณะที่ BO
       อาจเก็บบัญชีสมาชิกคนละเลข (เช่นบัญชีที่ลงทะเบียนไว้) ทั้งที่ชื่อผู้โอน,
       ยอด และเวลาเป็นรายการเดียวกัน กฎ customer-account conflict ด้านบนจึง
       ตั้งใจไม่จับไว้ก่อน ขั้นนี้กู้เฉพาะคู่ที่ปลอดภัยด้วยชื่อเต็มที่ตรงกัน +
       account บริษัท/ยอด/ทิศทาง/วันเดียวกัน และ reciprocal nearest ไม่เกิน
       10 นาที รองรับยอดซ้ำที่จำนวนสองฝั่งไม่เท่ากันโดยเหลือเฉพาะส่วนต่างจริง */
    const fr8BankNameCandidate = (s, b) => {
      if (auditCompanyOf(s) !== "FR8" || auditCompanyOf(b) !== "FR8") return false;
      if (s.isPmChannel || b.isPmChannel || !sameCompany(s, b)) return false;
      if (s.date !== b.date || !isIsoDate(s.date)) return false;
      if (!s.direction || s.direction !== b.direction || s.account !== b.account || s.amount !== b.amount) return false;
      if (s.noTime || b.noTime || !Number.isFinite(s.sec) || !Number.isFinite(b.sec)) return false;
      if (timeDistance(s, b) > exactUniqueTol) return false;
      const stmName = customerNameIdentity(s.custName);
      const boName = customerNameIdentity(b.custName);
      return stmName.length >= 4 && stmName === boName;
    };
    const fr8BankNameMatched = new Set();
    let fr8BankNameProgress = true;
    while (fr8BankNameProgress) {
      fr8BankNameProgress = false;
      const candidates = new Map();
      const peers = new Map();
      stmLeft2.forEach((s) => {
        if (rescuedStm.has(s) || fr8BankNameMatched.has(s)) return;
        const rows = (exactIdx.get(key2(s.account, s.amount)) || [])
          .filter((ci) => !boUsed[ci] && fr8BankNameCandidate(s, boRecords[ci]))
          .map((ci) => ({ ci, dt: timeDistance(s, boRecords[ci]) }));
        candidates.set(s, rows);
        rows.forEach(({ ci, dt }) => {
          let list = peers.get(ci);
          if (!list) peers.set(ci, (list = []));
          list.push({ s, dt });
        });
      });
      const proposals = [];
      candidates.forEach((rows, s) => {
        const ci = uniqueNearest(rows, (row) => row.ci);
        if (ci == null || boUsed[ci]) return;
        if (uniqueNearest(peers.get(ci) || [], (row) => row.s) !== s) return;
        proposals.push({ s, ci });
      });
      proposals.forEach(({ s, ci }) => {
        if (rescuedStm.has(s) || fr8BankNameMatched.has(s) || boUsed[ci]) return;
        const b = boRecords[ci];
        boUsed[ci] = 1;
        fr8BankNameMatched.add(s);
        matched.push({ s, b, dt: timeDistance(s, b), fr8BankNameMatch: true });
        fr8BankNameProgress = true;
      });
    }

    /* TMN OCR rows whose calendar heading disagreed with the requested round
       are evidence candidates, not statement rows. Promote one only after all
       normal matches, when both sides have exactly one unused reciprocal pair:
       - same 7M company, statement account and direction
       - exact amount within 60 minutes, or the known extra-digit OCR class
         within 60 seconds
       Unmatched/ambiguous candidates are ignored and never create an exception
       or inflate the STM denominator. */
    const tmnDateCandidatePairs = new Map();
    const tmnDateCandidatePeers = new Map();
    tmnDateCandidates.forEach((s) => {
      if (!isSevenMTmnOcr(s)) return;
      const rows = (accIdx.get(s.account) || []).filter((ci) => {
        if (boUsed[ci]) return false;
        const b = boRecords[ci];
        if (!sameCompany(s, b) || s.date !== b.date || s.direction !== b.direction) return false;
        if (!Number.isFinite(s.sec) || !Number.isFinite(b.sec)) return false;
        const dt = timeDistance(s, b);
        return (s.amount === b.amount && dt < 3600)
          || (plausibleTmnOcrAmount(s.amount, b.amount) && dt <= 60);
      });
      tmnDateCandidatePairs.set(s, rows);
      rows.forEach((ci) => {
        let peers = tmnDateCandidatePeers.get(ci);
        if (!peers) tmnDateCandidatePeers.set(ci, (peers = []));
        peers.push(s);
      });
    });

    /* KTB may book a late-night System 123 transaction on the next calendar
       date. These candidate rows are never normal STM rows. Promote only a
       strict reciprocal 1:1 pair whose BO explicitly uses the bank timestamp,
       crosses from the previous BO date and has the same account/direction/
       amount/time. An unmatched candidate remains evidence only. */
    const ktbCandidatePairs = new Map();
    const ktbCandidatePeers = new Map();
    ktbNextDayCandidates.forEach((s) => {
      if (!sys123Companies.has(auditCompanyOf(s)) || String(s.bank || s.channel || '').toUpperCase() !== 'KTB') return;
      const rows = (exactIdx.get(key2(s.account, s.amount)) || []).filter((ci) => {
        if (boUsed[ci]) return false;
        const b = boRecords[ci];
        return sameCompany(s, b)
          && s.account === b.account && s.direction === b.direction
          && s.date === b.date && b.crossDay === true
          && b.bankDate === s.date && b.boDate && b.boDate !== b.bankDate
          && b.matchTimeColumn === 'วันที่ธนาคาร'
          && Number.isFinite(s.sec) && Number.isFinite(b.sec)
          && timeDistance(s, b) <= tolOf(s.direction, s, b);
      });
      ktbCandidatePairs.set(s, rows);
      rows.forEach((ci) => {
        let peers = ktbCandidatePeers.get(ci);
        if (!peers) ktbCandidatePeers.set(ci, (peers = []));
        peers.push(s);
      });
    });
    ktbNextDayCandidates.forEach((s) => {
      const rows = ktbCandidatePairs.get(s) || [];
      if (rows.length !== 1) return;
      const ci = rows[0];
      if (boUsed[ci] || (ktbCandidatePeers.get(ci) || []).length !== 1) return;
      const b = boRecords[ci];
      boUsed[ci] = 1;
      ktbNextDayCandidateMatched.add(s);
      matched.push({ s, b, dt: timeDistance(s, b), ktbNextDayBankTimeMatch: true });
    });
    tmnDateCandidates.forEach((s) => {
      const rows = tmnDateCandidatePairs.get(s) || [];
      if (rows.length !== 1) return;
      const ci = rows[0];
      if (boUsed[ci] || (tmnDateCandidatePeers.get(ci) || []).length !== 1) return;
      const b = boRecords[ci];
      const amountCorrected = s.amount !== b.amount;
      boUsed[ci] = 1;
      tmnDateCandidateMatched.add(s);
      matched.push({
        s, b, dt: timeDistance(s, b), tmnOcrDateRecovery: true,
        tmnOcrAmountCorrection: amountCorrected,
        tmnOcrTimeCorrection: !amountCorrected && s.sec !== b.sec,
      });
    });

    // pass 3: STM ที่เหลือ = ไม่มีฝั่ง BO
    stmLeft2.forEach((s) => {
      if (!rescuedStm.has(s) && !fr8BankNameMatched.has(s)) exceptions.push(mkException(s.crossDay ? "cross_day" : "missing_bo", s, null, 0));
    });

    // pass 4: BO ที่เหลือ = ไม่มีฝั่ง STM หรือเป็นรายการซ้ำ
    /* "ซ้ำ" = มีคู่ที่แม็ปไปแล้ว บัญชี+ยอด+ทิศทางเดียวกัน และเวลาใกล้กัน (ในเกณฑ์ tolerance)
       ถ้ายอดเท่ากันแต่คนละเวลา ถือเป็นคนละรายการ = missing_stm ไม่ใช่ duplicate */
    const dupKey = (a, amt, dir) => a + "|" + amt.toFixed(2) + "|" + (dir || "");
    const matchedTimes = new Map();
    matched.forEach((m) => {
      const k = dupKey(m.b.account, m.b.amount, m.b.direction);
      let arr = matchedTimes.get(k);
      if (!arr) matchedTimes.set(k, (arr = []));
      arr.push(m.b);
    });
    await chunked(
      boRecords,
      20000,
      (b, i) => {
        if (boUsed[i]) return;
        if (!hasStmSide(b)) {
          noStmSide.push(b);
          return;
        }
        const times = matchedTimes.get(dupKey(b.account, b.amount, b.direction));
        const dupWin = Math.max(tolOf(b.direction, b, b), 120);
        // Repeated PM amounts from different customers are not duplicates.
        // Require the same complete customer identity for provider records;
        // missing identity remains an unmatched case, never an accusation.
        const dup = times && times.some((other) => Math.abs(other.sec - b.sec) <= dupWin
          && (!(other.isPmChannel || b.isPmChannel || isSys123ProviderRecord(b))
            || (identityText(b.memberCode) && identityText(b.memberCode) === identityText(other.memberCode)
              && accountIdentityMatches(b.custAccount, other.custAccount))));
        /* รายการ 23:00-23:59 หรือข้ามวัน ให้ถือเป็น cross_day ก่อน แม้ยอดจะซ้ำกับรายการอื่น */
        exceptions.push(mkException(b.lateNight || b.crossDay ? "cross_day" : dup ? "duplicate" : "missing_stm", null, b, 0));
      },
      onProgress,
      "ตรวจรายการที่ไม่มีฝั่ง STM",
    );

    // pass 5: กฎเพิ่มเติมบนคู่ที่จับได้ — เทียบกับ master list ของบัญชี ไม่ใช่ธนาคารที่เดาจากชื่อไฟล์
    const masterBank = new Map((masterAccounts || []).map((a) => [a.id, a.bank]));
    /* ข้อความในสลิปธนาคาร: 'จาก GSB X3463 ...' / 'รับโอนจาก KBANK x4845 ...' */
    const FROM_RE = /(?:จาก|ไป|from|to)\s*([A-Z]{2,6})?\s*[xX](\d{3,4})/;
    const BANK_ALIAS = { KBANK: "KBANK", KPLUS: "KBANK", SCB: "SCB", GSB: "GSB", BBL: "BBL", KTB: "KTB", BAAC: "BAAC", TTB: "TTB", BAY: "BAY", KK: "KKP", KKP: "KKP", UOB: "UOB", CIMB: "CIMB", LHB: "LHB", TISCO: "TISCO", GHB: "GHB" };
    matched.forEach((m) => {
      const truth = masterBank.get(m.s.account);
      /* ไฟล์ PM ใช้ชื่อ provider (เช่น AUTOPEER/CYBERPLUS) เป็น match key ไม่ใช่
         เลขบัญชีธนาคารบริษัท จึงห้ามนำ provider ไปเทียบกับ master account list
         มิฉะนั้นคู่ที่ยอด/เวลา/ช่องทางตรงกันจะถูกสร้าง wrong_account เท็จเกือบทั้งหมด */
      const sourceAssignedToCompany = !m.s.isPmChannel
        && !!String(m.s.source_file_id || m.s.source_file || "").trim()
        && sameCompany(m.s, m.b);
      if (masterSet.size && !truth && !m.s.isPmChannel && !sourceAssignedToCompany) {
        exceptions.push(mkException("wrong_account", m.s, m.b, m.dt));
        return;
      }
      /* จุดตรวจที่ 4: ธนาคารและเลขบัญชีปลายทางของลูกค้าต้องตรงกับที่สลิปธนาคารระบุ */
      const hit = String(m.s.desc || m.s.raw || "").match(FROM_RE);
      if (!hit) return;
      const stmBank = hit[1]?.toUpperCase() === 'KBNK' ? 'KBANK' : BANK_ALIAS[(hit[1] || "").toUpperCase()] || (hit[1] || "").toUpperCase();
      const stmTail = hit[2];
      const boBank = BANK_ALIAS[String(m.b.custBank || "").toUpperCase()] || String(m.b.custBank || "").toUpperCase();
      const boTail = String(m.b.custAccount || "").replace(/\D/g, "").slice(-stmTail.length);
      if (boBank && stmBank && boBank !== stmBank) exceptions.push(mkException("wrong_bank", m.s, m.b, m.dt));
      else if (boTail && stmTail && boTail !== stmTail) exceptions.push(mkException("wrong_account", m.s, m.b, m.dt));
    });

    /* รายการฝากมือเป็นขั้นตอนปกติของแอดมินในระบบ 123 จึงไม่ควรเปิดเคสเพียง
       เพราะ BO ระบุว่าเติมมือ เมื่อคู่ STM/BO เดิมจับกันได้ด้วยยอดและเวลา
       ธนาคารจริงภายในกรอบ และหลักฐานท้าย 4 ตัว/ชื่อที่มีอยู่ไม่ขัดกัน
       ส่วน BBL/GSB ที่ STM ไม่มีเวลา ให้ใช้คู่ที่ Engine จับด้วยบริษัท + บัญชี
       + วัน + ทิศทาง + ยอดตรงกัน โดยไม่บังคับเวลา/User/ชื่อ เพราะต้นทางไม่มี
       หลักฐานเหล่านั้นให้ตรวจ. ยอดหรือจำนวนรายการที่เกินคู่จริงยังคงเป็นเคส. */
    const sys123NoTimeManualGuardedAccounts = new Set([
      'AT4|2090879114', // KTB เบญจพร D
    ]);
    const isManualBo = (row) => /เติม\s*มือ|เติมเอง|manual/i.test(String(row && (row.via || row.channel) || ''));
    const manualAutoCloseEligible = (m) => {
      const company = auditCompanyOf(m.b);
      const account = String(m.b.account || '').replace(/\D/g, '');
      if (!sys123Companies.has(company)) return false;
      if (m.b.isPmChannel || m.s.isPmChannel || m.b.direction !== 'deposit' || m.s.direction !== 'deposit') return false;
      if (!Number.isFinite(m.b.amount) || m.b.amount <= 0 || m.b.amount !== m.s.amount) return false;
      const identity = sys123BankCustomerIdentity(m.s, m.b);
      const sameGroup = (row) => auditCompanyOf(row) === company
        && String(row.account || '').replace(/\D/g, '') === account
        && row.date === m.b.date && row.direction === 'deposit';
      const boGroup = boRecords.filter(sameGroup);
      const stmGroup = stmRecords.concat([...ktbNextDayCandidateMatched]).filter(sameGroup);
      const manualGroup = boGroup.filter(isManualBo);
      if (!m.s.noTime && !m.b.noTime && Number.isFinite(m.s.sec) && Number.isFinite(m.b.sec)) {
        if (sys123BankIdentityConflict(identity)) return false;
        if (m.b.matchTimeColumn !== 'วันที่ธนาคาร' && !m.ktbNextDayBankTimeMatch) return false;
        if (m.dt > exactUniqueTol) return false;
        const timedCandidate = (left, right) => left.amount === right.amount
          && !left.noTime && !right.noTime && Number.isFinite(left.sec) && Number.isFinite(right.sec)
          && timeDistance(left, right) <= exactUniqueTol;
        const stmCandidates = stmGroup.filter((row) => timedCandidate(row, m.b));
        const boCandidates = manualGroup.filter((row) => timedCandidate(m.s, row));
        const identityAssisted = identity.tailMatch || identity.nameMatch || m.sys123BankIdentityMatch;
        // Repeated manual amounts are common in System 123. They remain safe
        // to close when the pair already selected by the matcher is the unique
        // nearest choice from both sides. Equal-distance ties remain review
        // cases, so this does not weaken the ambiguity guard.
        const reciprocalUniqueNearest = (target, candidates, timeOf) => {
          if (!candidates.length) return false;
          let best = null;
          let bestDt = Infinity;
          let tied = false;
          candidates.forEach((candidate) => {
            const dt = timeDistance(timeOf(candidate), target);
            if (dt < bestDt) {
              best = candidate;
              bestDt = dt;
              tied = false;
            } else if (dt === bestDt) tied = true;
          });
          return !tied && best === target;
        };
        if (!identityAssisted) {
          const stmNearest = reciprocalUniqueNearest(m.s, stmCandidates, (row) => row);
          const boNearest = reciprocalUniqueNearest(m.b, boCandidates, (row) => row);
          if (!stmNearest || !boNearest) return false;
        }
        m.sys123ManualBankTimeMatched = true;
        m.sys123CustomerLast4Match = m.sys123CustomerLast4Match || identity.tailMatch;
        m.sys123CustomerNameMatch = m.sys123CustomerNameMatch || identity.nameMatch;
        return true;
      }
      const noTimeBank = String(m.s.bank || m.s.channel || m.b.bank || m.b.channel || '').trim().toUpperCase();
      if (noTimeBank === 'BBL' || noTimeBank === 'GSB') return true;
      if (!sys123NoTimeManualGuardedAccounts.has(`${company}|${account}`)) return false;
      if (sys123BankIdentityConflict(identity)) return false;
      const users = manualGroup.map((row) => identityText(row.memberCode));
      const amounts = manualGroup.map((row) => Number(row.amount).toFixed(2));
      const currentUser = identityText(m.b.memberCode);
      const currentAmount = Number(m.b.amount).toFixed(2);
      if (!manualGroup.length || !currentUser) return false;
      if (users.filter((user) => user === currentUser).length !== 1) return false;
      if (amounts.filter((amount) => amount === currentAmount).length !== 1) return false;
      if (stmGroup.filter((row) => row.amount === m.s.amount).length !== 1) return false;
      const boTotal = boGroup.reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const stmTotal = stmGroup.reduce((sum, row) => sum + Number(row.amount || 0), 0);
      return boTotal <= stmTotal + 0.001;
    };
    matched.forEach((m) => {
      if (isManualBo(m.b)) {
        if (manualAutoCloseEligible(m)) {
          m.sys123ManualAutoClosed = true;
          return;
        }
        const review = mkException("manual_review", m.s, m.b, m.dt);
        review.riskAmount = 0;
        review.severity = "medium";
        review.slaHours = SLA_OF.medium;
        review.overSla = review.ageHours > review.slaHours;
        review.cause = "ยอดจับคู่แล้ว แต่รายการเติมมือต้องตรวจเอกสารชี้แจงก่อนปิด";
        exceptions.push(review);
      }
    });

    // สถิติรายชั่วโมงเพื่อให้ dashboard ตรงกับผลจับคู่จริง
    const hourlyStm = new Array(24).fill(0);
    const hourlyMatched = new Array(24).fill(0);
    let crossDayWindow = 0;
    stmRecords.concat([...tmnDateCandidateMatched], [...ktbNextDayCandidateMatched]).forEach((r) => {
      hourlyStm[Math.floor(r.sec / 3600)]++;
      if (r.crossDay) crossDayWindow++;
    });
    matched.forEach((m) => hourlyMatched[Math.floor(m.s.sec / 3600)]++);

    // จัดรหัสและ metadata
    exceptions.sort((a, b) => a.sortSec - b.sortSec);
    exceptions.forEach((e, i) => (e.id = "EX-" + String(3001 + i)));

    const elapsed = Math.round(Date.now() - t0);
    const reconciledStmCount = stmRecords.length + tmnDateCandidateMatched.size + ktbNextDayCandidateMatched.size;
    return {
      matched: matched.length,
      internalTransferMatched: matched.filter(m => m.internalTransferMatch).length,
      xbProviderRefMatched: matched.filter(m => m.xbProviderRefMatch).length,
      xbProviderDuplicateRowsSuppressed,
      tmnOcrDuplicateRowsSuppressed,
      customerIdentityMatched: matched.filter(m => m.customerIdentityMatch).length,
      sys123ProviderMatched: matched.filter(m => m.sys123ProviderMatch).length,
      exceptions,
      stmCount: reconciledStmCount,
      boCount: boRecords.length,
      elapsedMs: elapsed,
      matchRate: reconciledStmCount ? (matched.length / reconciledStmCount) * 100 : 0,
      nearTolerance: timeDiffCount,
      hourlyStm,
      hourlyMatched,
      crossDayWindow,
      noStmSide: summarizeNoStm(noStmSide),
      waitingBo: noStmSide.map(b => ({
        ...mkException("missing_stm", null, b, 0), status: "waiting_source", riskAmount: 0,
        detail: "อ่าน BO แล้ว · รอ STM/PM ของบัญชีนี้ก่อนกระทบยอด ยังไม่ยืนยันความเสียหาย"
      })),
      noStmCount: noStmSide.length,
      /* ใช้เฉพาะใน Worker เพื่อไม่ให้ Rules เปิด cross_day ซ้ำกับคู่ที่ Engine จับสำเร็จ */
      matchedBoKeys: matched.map((m) => recordKey(m.b)),
      crossDayMatched: matched.filter((m) => m.s.date !== m.b.date).length,
      // Evidence only. This does not reserve transactions or authorize closure
      // across separately committed runs. A database uniqueness gate is required.
      matchEvidence: matched.map((m) => ({
        company: m.b.company || m.b.subco || null,
        account: m.b.account,
        direction: m.b.direction,
        amount: m.b.amount,
        pmPayout: m.s.isPmChannel ? { status: m.s.status || null, partial: !!m.s.partial, requested: m.s.requested ?? null, paid: m.s.paidAmount ?? m.s.amount, unpaid: m.s.unpaidAmount ?? null, refundConfirmed: false } : null,
        settlementCrossDay: !!(m.s.settlementDate && m.s.settlementDate !== m.b.date),
        requestDate: m.s.requestDate || null,
        requestSec: m.s.requestSec ?? null,
        settlementDate: m.s.settlementDate || null,
        settlementSec: m.s.settlementSec ?? null,
        crossDay: m.s.date !== m.b.date,
        timeDifferenceSeconds: m.s.noTime || m.b.noTime ? null : m.dt,
        method: m.sys123ManualBankTimeMatched ? "sys123-manual-bank-time-amount" : m.ktbNextDayBankTimeMatch ? "sys123-ktb-next-day-bank-time-reciprocal" : m.tmnOcrDateRecovery ? (m.tmnOcrAmountCorrection ? "seven-m-tmn-ocr-offdate-amount-reciprocal" : "seven-m-tmn-ocr-offdate-reciprocal") : m.tmnOcrAmountCorrection ? "seven-m-tmn-ocr-amount-reciprocal" : m.tmnOcrTimeCorrection ? "seven-m-tmn-ocr-time-reciprocal" : m.internalTransferMatch ? "seven-m-internal-transfer-reciprocal" : m.xbProviderRefMatch ? "xb-provider-_id-note-amount" : m.providerIdentityMatch ? "provider-ref-user-amount" : m.providerNearTimeMatch ? "provider-amount-reciprocal-near-time" : m.sys123ProviderMatch ? m.sys123MatchMethod : m.customerIdentityMatch ? (m.sys123BankIdentityMatch ? "sys123-bank-time-amount-customer-identity" : "customer-account-amount-same-day-60m") : m.rescueMatch ? "reciprocal-nearest-rescue" : m.fr8BankNameMatch ? "fr8-bank-name-amount-reciprocal-near-time" : m.timeVarianceAccepted ? "account-amount-direction-time-under-60m" : "legacy-rule",
        tmnOcrDateRecovered: !!m.tmnOcrDateRecovery,
        ocrSourceDate: m.tmnOcrDateRecovery ? m.s.sourceDate || null : null,
        tmnOcrAmountCorrected: !!m.tmnOcrAmountCorrection,
        tmnOcrTimeCorrected: !!m.tmnOcrTimeCorrection,
        ocrOriginalAmount: m.tmnOcrAmountCorrection ? m.s.amount : null,
        correctedAmount: m.tmnOcrAmountCorrection ? m.b.amount : null,
        internalTransferMatched: !!m.internalTransferMatch,
        internalTransferGroup: m.internalTransferGroup || null,
        xbProviderRefMatched: !!m.xbProviderRefMatch,
        providerSignedAmountNormalized: !!m.providerSignedAmountNormalized,
        providerDirectionMetadataIgnored: !!m.providerDirectionMetadataIgnored,
        providerRefRecoveredFromTransactionId: !!m.providerRefRecoveredFromTransactionId,
        providerIdentityMatched: !!m.providerIdentityMatch,
        providerNearTimeMatched: !!m.providerNearTimeMatch,
        sys123ProviderMatched: !!m.sys123ProviderMatch,
        sys123ProviderGroupMatched: !!m.sys123ProviderGroupMatch,
        rescueMatched: !!m.rescueMatch,
        fr8BankNameMatched: !!m.fr8BankNameMatch,
        timeVarianceAccepted: !!m.timeVarianceAccepted,
        ktbNextDayBankTimeMatched: !!m.ktbNextDayBankTimeMatch,
        sys123ManualBankTimeMatched: !!m.sys123ManualBankTimeMatched,
        sys123CustomerLast4Matched: !!m.sys123CustomerLast4Match,
        sys123CustomerNameMatched: !!m.sys123CustomerNameMatch,
        sys123ManualAutoClosed: !!m.sys123ManualAutoClosed,
        manualReview: isManualBo(m.b) && !m.sys123ManualAutoClosed,
        customer: {
          bo: { account: m.b.custAccount || "", name: m.b.custName || "", user: m.b.memberCode || "", reference: m.b.ref || "", performedBy: m.b.performedBy || "", providerReference: sapanProviderId(m.b.note) || sapanProviderId(m.b.raw), note: sapanProviderId(m.b.note) || sapanProviderId(m.b.raw) || m.b.note || "" },
          stm: customerEvidence(m.s),
        },
        boAmount: m.b.amount,
        stmAmount: m.s.amount,
        stm: { fileId: m.s.source_file_id || null, checksum: m.s.source_checksum || null, row: m.s.rowNo ?? null, date: m.s.date, sec: m.s.noTime ? null : m.s.sec, noTime: !!m.s.noTime, timeColumn: m.s.timeColumn || null, amountColumn: m.s.amountColumn || null },
        bo: { fileId: m.b.source_file_id || null, checksum: m.b.source_checksum || null, row: m.b.rowNo ?? null, date: m.b.date, sec: m.b.noTime ? null : m.b.sec, noTime: !!m.b.noTime, timeColumn: m.b.matchTimeColumn || null, boDate: m.b.boDate || null, bankDate: m.b.bankDate || null },
      })),
    };

    function summarizeNoStm(list) {
      const by = {};
      list.forEach((b) => {
        const k = (b.channel || b.bank || b.account || "ไม่ระบุ") + " / " + (b.company || "-");
        const g = by[k] || (by[k] = { key: k, channel: b.channel || b.bank || "-", company: b.company || "-", count: 0, amount: 0, accounts: new Set() });
        g.count++;
        g.amount += b.amount;
        g.accounts.add(b.account);
      });
      return Object.values(by)
        .map((g) => ({ ...g, amount: Math.round(g.amount * 100) / 100, accounts: [...g.accounts] }))
        .sort((a, b) => b.count - a.count);
    }

    function mkException(type, s, b, dt) {
      const src = s || b;
      const sec = src.sec;
      const hour = Math.floor(sec / 3600);
      const severityBase = BASE_SEVERITY[type];
      const sysAmount = b ? b.amount : null;
      const bankAmount = s ? s.amount : null;
      const riskAmount = type === "time_diff" || type === "cross_day" ? 0 : type === "amount_diff" ? Math.abs(sysAmount - bankAmount) : src.amount;
      let severity = severityBase;
      if (severity !== "critical" && riskAmount > 10000) severity = "critical";
      const slaHours = SLA_OF[severity];
      const ageHours = ageHoursOf(src);
      return {
        sortSec: sec,
        date: src.date,
        time: hhmmss(sec),
        hour,
        /* ใช้บริษัทย่อย (subco) จากทะเบียนก่อน — company ของ statement ธนาคารเป็นรหัสธนาคาร (SCB/TMN/BAY) ไม่ใช่บริษัท */
        company: src.subco || src.company || (b && (b.subco || b.company)) || "SYS123",
        bank: src.bank,
        account: src.account,
        direction: src.direction === "withdraw" ? "ถอน" : src.direction === "deposit" ? "ฝาก" : "PM",
        systemAmount: sysAmount,
        bankAmount,
        amountDiff: sysAmount === null || bankAmount === null ? 0 : sysAmount - bankAmount,
        riskAmount,
        timeDiffSec: (s && s.noTime) || (b && b.noTime) ? null : Math.round(dt),
        type,
        typeName: TYPE_NAME[type],
        severity,
        status: "open",
        shift: shiftOf(hour),
        employee: (b && b.username) || (s && s.username) || "ไม่ระบุ",
        customerDetails: {
          bo: b ? { user: b.memberCode || "", account: b.custAccount || "", name: b.custName || "", reference: b.ref || "", providerReference: sapanProviderId(b.note) || sapanProviderId(b.raw), origin: b.via || "", performedBy: b.performedBy || "", note: sapanProviderId(b.note) || sapanProviderId(b.raw) || b.note || "" } : null,
          stm: s ? { ...customerEvidence(s), sourceFileId: s.source_file_id || null, sourceRow: s.rowNo ?? null } : null,
        },
        assignee: "audit_som",
        track: null, // แอปจะเติมให้จากระบบต้นทางของบริษัท (XB = รายวัน, 123 = รายรอบ)
        cause: causeOf(type),
        ageHours,
        slaHours,
        overSla: ageHours > slaHours,
        hasEvidence: false,
        stmRaw: s ? s.raw : "— ไม่พบรายการฝั่ง STM ในช่วงเวลาที่ตรวจ —",
        boRaw: b ? b.raw : "— ไม่พบรายการฝั่ง BO ในช่วงเวลาที่ตรวจ —",
        boSource: b ? { fileId: b.source_file_id || null, row: b.rowNo ?? null } : null,
        stmSource: s ? { fileId: s.source_file_id || null, row: s.rowNo ?? null } : null,
        boTime: b && !b.noTime ? hhmmss(b.sec) : "-",
        boDate: b ? b.date : "",
        stmTime: s && !s.noTime ? hhmmss(s.sec) : "-",
        stmDate: s ? s.date : "",
        notes: [],
        evidence: [],
        fromImport: true,
      };
    }
  }

  function causeOf(type) {
    return (
      {
        amount_diff: "คีย์ยอดผิดจากต้นฉบับ",
        missing_bo: "รายการฝั่งระบบหลังบ้านหายไป",
        missing_stm: "ยังไม่พบรายการ STM/PM คู่กัน ต้องตรวจความครบของไฟล์และหลักฐานก่อนระบุสาเหตุ",
        time_diff: "เวลาระหว่างธนาคารกับระบบต่างกันเกินเกณฑ์",
        cross_day: "รายการค้างข้ามวันจากธนาคาร",
        duplicate: "ทำรายการซ้ำในระบบหลังบ้าน",
        wrong_bank: "เลือกธนาคารผิดตอนกดอนุมัติ",
        wrong_account: "ลูกค้าโอนเข้าบัญชีที่เลิกใช้",
      }[type] || "รอระบุสาเหตุ"
    );
  }

  return { parseCSV, parseSheet, detectFormat, normalize, reconcile, prepareBblStatements, TYPE_NAME, hhmmss, statementCustomer };
})();
