/* =============================================================
   Engine - parser + bank rule engine + reconciliation
   Phase 1 ของ roadmap ทำงานจริงในเบราว์เซอร์
   - อ่าน CSV (และ XLSX ถ้ามี SheetJS)
   - ตรวจจับรูปแบบไฟล์และธนาคารจาก header
   - ใช้กฎธนาคารกรองบรรทัดขยะและตีความ direction
   - จับคู่ 3 จุด (account + time + amount) แบบคำนวณสด พร้อม progress
   ============================================================= */

const Engine = (() => {
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

  function parseSheet(arrayBuffer) {
    if (typeof XLSX === "undefined") throw new Error("ยังโหลดตัวอ่านไฟล์ Excel ไม่ได้ (ต้องต่ออินเทอร์เน็ต) — กรุณาใช้ไฟล์ .csv แทน");
    const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: false, raw: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" }).map((r) => r.map((c) => String(c ?? "")));
  }

  /* ---------------- header mapping ---------------- */
  const DICT = {
    datetime: ["datetime", "วันที่เวลา", "date_time", "timestamp"],
    date: ["วันที่", "date", "วันที่ทำรายการ", "transaction date"],
    time: ["เวลา", "time"],
    desc: ["รายการ", "รายละเอียด", "description", "detail", "narrative", "merchant"],
    debit: ["ถอน", "ถอนเงิน", "โอนออก", "debit", "withdraw"],
    credit: ["ฝาก", "ฝากเงิน", "รับเข้า", "credit", "deposit"],
    balance: ["คงเหลือ", "ยอดคงเหลือ", "balance"],
    channel: ["ช่องทาง", "channel"],
    account: ["เลขที่บัญชี", "บัญชี", "account", "account_no"],
    amount: ["จำนวนเงิน", "ยอดเงิน", "amount", "ยอด"],
    username: ["username", "ผู้ใช้", "user", "employee"],
    company: ["company", "บริษัท", "merchant"],
    status: ["status", "สถานะ"],
    bank: ["bank", "ธนาคาร"],
    txid: ["transaction_id", "txid", "ref", "เลขที่รายการ", "reference"],
    direction: ["direction", "ประเภทรายการ", "type"],
  };

  function mapHeaders(headerRow) {
    const map = {};
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
    const name = fileName.toLowerCase();
    const headerIdx = rows.findIndex((r) => mapHeaders(r).account !== undefined || mapHeaders(r).amount !== undefined || mapHeaders(r).balance !== undefined);
    const header = rows[headerIdx >= 0 ? headerIdx : 0];
    const map = mapHeaders(header);
    const blob = (name + " " + rows.slice(0, 8).flat().join(" ")).toLowerCase();

    let source = "unknown";
    if (map.txid !== undefined && map.username !== undefined) source = "bo";
    else if (map.status !== undefined && map.amount !== undefined && map.username === undefined) source = "pm";
    else if (map.balance !== undefined || (map.debit !== undefined && map.credit !== undefined)) source = "stm";
    if (name.startsWith("pm_") || blob.includes("autopeer") || blob.includes("azpay") || blob.includes("cyberplus")) source = "pm";
    if (name.startsWith("bo_")) source = "bo";

    let bank = null;
    if (source !== "bo") for (const b of BANK_HINTS) if (b.words.some((w) => blob.includes(w))) bank = b.code;
    if (!bank && source !== "bo" && map.account !== undefined) {
      const sampleAcc = (rows[headerIdx + 2] || rows[headerIdx + 1] || [])[map.account] || "";
      const m = String(sampleAcc).split("-")[0].toUpperCase();
      if (BANK_HINTS.some((b) => b.code === m)) bank = m;
    }

    let company = null;
    ["AUTOPEER", "AZPAY", "CYBERPLUS", "SYS123"].forEach((c) => {
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
    const m = t.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    return +m[1] * 3600 + +m[2] * 60 + (+m[3] || 0);
  }
  function isoDateOf(v) {
    const s = String(v || "").trim();
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
    time_diff: "เวลาเกิน tolerance",
    missing_bo: "STM มากกว่า BO",
    missing_stm: "BO มากกว่า STM",
    amount_diff: "ยอดเงินไม่ตรง",
    cross_day: "รายการข้ามวัน 23:00-23:59",
    duplicate: "เติมซ้ำ / รายการซ้ำ",
    wrong_bank: "เลือกธนาคารผิด",
    wrong_account: "ลูกค้าฝากผิดบัญชี",
  };
  const BASE_SEVERITY = {
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

  async function reconcile(stmRecords, boRecords, settings, masterAccounts, onProgress) {
    const t0 = performance.now();
    const tolDep = settings.toleranceDeposit;
    const tolWit = settings.toleranceWithdraw;
    const tolOf = (d) => (d === "withdraw" ? tolWit : tolDep);
    const masterSet = new Set((masterAccounts || []).map((a) => a.id));

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
    let timeDiffCount = 0;

    // pass 1: exact account+amount, ภายใน tolerance
    await chunked(
      stmRecords,
      10000,
      (s) => {
        const cands = exactIdx.get(key2(s.account, s.amount));
        let best = -1;
        let bestDt = Infinity;
        if (cands) {
          for (const ci of cands) {
            if (boUsed[ci]) continue;
            const dt = Math.abs(boRecords[ci].sec - s.sec);
            if (dt < bestDt) {
              bestDt = dt;
              best = ci;
            }
          }
        }
        if (best >= 0 && bestDt <= tolOf(s.direction)) {
          boUsed[best] = 1;
          matched.push({ s, b: boRecords[best], dt: bestDt });
          if (bestDt > tolOf(s.direction) * 0.6) timeDiffCount++;
        } else if (best >= 0 && bestDt < 3600) {
          boUsed[best] = 1;
          exceptions.push(mkException("time_diff", s, boRecords[best], bestDt));
        } else {
          stmLeft.push(s);
        }
      },
      onProgress,
      "จับคู่ 3 จุด",
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
            const dt = Math.abs(boRecords[ci].sec - s.sec);
            if (dt < bestDt) {
              bestDt = dt;
              best = ci;
            }
          }
        }
        if (best >= 0 && bestDt <= tolOf(s.direction)) {
          boUsed[best] = 1;
          exceptions.push(mkException("amount_diff", s, boRecords[best], bestDt));
        } else {
          stmLeft2.push(s);
        }
      },
      onProgress,
      "ตรวจยอดไม่ตรง",
    );

    // pass 3: STM ที่เหลือ = ไม่มีฝั่ง BO
    stmLeft2.forEach((s) => exceptions.push(mkException(s.crossDay ? "cross_day" : "missing_bo", s, null, 0)));

    // pass 4: BO ที่เหลือ = ไม่มีฝั่ง STM หรือเป็นรายการซ้ำ
    const seenPair = new Set();
    matched.forEach((m) => seenPair.add(key2(m.b.account, m.b.amount)));
    await chunked(
      boRecords,
      20000,
      (b, i) => {
        if (boUsed[i]) return;
        const dup = seenPair.has(key2(b.account, b.amount));
        exceptions.push(mkException(dup ? "duplicate" : b.crossDay ? "cross_day" : "missing_stm", null, b, 0));
      },
      onProgress,
      "ตรวจรายการที่ไม่มีฝั่ง STM",
    );

    // pass 5: กฎเพิ่มเติมบนคู่ที่จับได้ — เทียบกับ master list ของบัญชี ไม่ใช่ธนาคารที่เดาจากชื่อไฟล์
    const masterBank = new Map((masterAccounts || []).map((a) => [a.id, a.bank]));
    matched.forEach((m) => {
      const truth = masterBank.get(m.s.account);
      if (masterSet.size && !truth) exceptions.push(mkException("wrong_account", m.s, m.b, m.dt));
      else if (truth && m.b.bank && m.b.bank !== truth) exceptions.push(mkException("wrong_bank", m.s, m.b, m.dt));
    });

    // สถิติรายชั่วโมงเพื่อให้ dashboard ตรงกับผลจับคู่จริง
    const hourlyStm = new Array(24).fill(0);
    const hourlyMatched = new Array(24).fill(0);
    let crossDayWindow = 0;
    stmRecords.forEach((r) => {
      hourlyStm[Math.floor(r.sec / 3600)]++;
      if (r.crossDay) crossDayWindow++;
    });
    matched.forEach((m) => hourlyMatched[Math.floor(m.s.sec / 3600)]++);

    // จัดรหัสและ metadata
    exceptions.sort((a, b) => a.sortSec - b.sortSec);
    exceptions.forEach((e, i) => (e.id = "EX-" + String(3001 + i)));

    const elapsed = Math.round(performance.now() - t0);
    return {
      matched: matched.length,
      exceptions,
      stmCount: stmRecords.length,
      boCount: boRecords.length,
      elapsedMs: elapsed,
      matchRate: stmRecords.length ? (matched.length / stmRecords.length) * 100 : 0,
      nearTolerance: timeDiffCount,
      hourlyStm,
      hourlyMatched,
      crossDayWindow,
    };

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
      const ageHours = 1 + Math.floor((86400 - sec) / 3600);
      return {
        sortSec: sec,
        date: src.date,
        time: hhmmss(sec),
        hour,
        company: src.company || (b && b.company) || "SYS123",
        bank: src.bank,
        account: src.account,
        direction: src.direction === "withdraw" ? "ถอน" : src.direction === "deposit" ? "ฝาก" : "PM",
        systemAmount: sysAmount,
        bankAmount,
        amountDiff: sysAmount === null || bankAmount === null ? 0 : sysAmount - bankAmount,
        riskAmount,
        timeDiffSec: Math.round(dt),
        type,
        typeName: TYPE_NAME[type],
        severity,
        status: "open",
        shift: shiftOf(hour),
        employee: (b && b.username) || (s && s.username) || "ไม่ระบุ",
        assignee: "audit_som",
        cause: causeOf(type),
        ageHours,
        slaHours,
        overSla: ageHours > slaHours,
        hasEvidence: false,
        stmRaw: s ? s.raw : "— ไม่พบรายการฝั่ง STM ในช่วงเวลาที่ตรวจ —",
        boRaw: b ? b.raw : "— ไม่พบรายการฝั่ง BO ในช่วงเวลาที่ตรวจ —",
        boTime: b ? hhmmss(b.sec) : "-",
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
        missing_stm: "auto ไม่เข้า แล้วทำ manual ซ้ำ",
        time_diff: "เวลาระหว่างธนาคารกับระบบต่างกันเกินเกณฑ์",
        cross_day: "รายการค้างข้ามวันจากธนาคาร",
        duplicate: "ทำรายการซ้ำในระบบหลังบ้าน",
        wrong_bank: "เลือกธนาคารผิดตอนกดอนุมัติ",
        wrong_account: "ลูกค้าโอนเข้าบัญชีที่เลิกใช้",
      }[type] || "รอระบุสาเหตุ"
    );
  }

  return { parseCSV, parseSheet, detectFormat, normalize, reconcile, TYPE_NAME, hhmmss };
})();
