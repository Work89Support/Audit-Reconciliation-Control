/* =============================================================
   Formats - ตัวอ่านรูปแบบไฟล์จริงของแผนกออดิท (19-07-69 เป็นต้นแบบ)
   ครอบคลุมรายงาน 6 ชนิดที่ออกจากระบบหลังบ้าน (ใช้ร่วมกันได้ทุกบริษัท)
     1. รายงานบัญชีฝาก / รายงานบัญชีถอน      -> bo_main
     2. ขอถอนค่าคอมมิชชั่น (สำเร็จ/ยกเลิก)   -> comm_req
     3. รายงานถอนเครดิต                      -> credit_out
     4. รายงานฝากมือ_รายการเครดิต            -> manual_credit
     5. รายงานฝากมือ_รายการ Payment          -> manual_payment
     6. รายงานฝากมือ_รายการโบนัส             -> manual_bonus
   ============================================================= */

const Formats = (() => {
  const norm = (s) =>
    String(s ?? "")
      .replace(/​/g, "")
      .replace(/[\s_./\\:()\[\]-]+/g, "")
      .trim()
      .toLowerCase();

  const HEADER_ALIASES = {
    "เวลา": ["เวลา"],
    "ประเภท": ["ประเภท"],
    "ยูสเซอร์": ["ยูสเซอร์", "username", "user"],
    "บัญชีลูกค้าแบบย่อ": ["บัญชี"],
    "บัญชีบริษัทแบบย่อ": ["บัญชีบริษัท"],
    "ยอดเงินแบบย่อ": ["ยอดเงิน"],
    "โน้ต": ["โน้ต", "note", "หมายเหตุ"],
    "ผู้ดำเนินการ": ["ผู้ดำเนินการ", "operator"],
    "วันที่ทำรายการ": ["วันที่ทำรายการ", "วันเวลาทำรายการ", "เวลาทำรายการ", "createdat", "createtime", "requesttime"],
    "วันที่ธนาคาร": ["วันที่ธนาคาร", "วันเวลาธนาคาร", "เวลาธนาคาร", "paymenttime", "banktime", "transfertime"],
    "จำนวนเงินฝากจริง": ["จำนวนเงินฝากจริง", "ยอดฝากจริง", "ยอดฝาก", "depositamount", "realamount", "โอนจริง"],
    "จำนวนเงินถอนจริง": ["จำนวนเงินถอนจริง", "ยอดถอนจริง", "ยอดถอน", "withdrawamount", "payoutamount", "p2pจ่าย", "รวมหักเงิน"],
    "ชื่อธนาคาร": ["ชื่อธนาคาร", "ธนาคาร", "ช่องทาง", "provider", "paymentchannel"],
    "เวลาทำรายการ": ["เวลาทำรายการ", "วันที่ทำรายการ", "วันเวลาทำรายการ", "createdat", "requesttime"],
    "เวลาธนาคาร": ["เวลาธนาคาร", "วันที่ธนาคาร", "วันเวลาธนาคาร", "paymenttime", "banktime"],
    "จำนวน": ["จำนวน", "จำนวนเงิน", "amount", "ยอดเงิน"],
    "สถานะ": ["สถานะ", "status"],
  };
  const aliasesOf = (name) => (HEADER_ALIASES[name] || [name]).map(norm);
  const hasHeader = (cells, name) => aliasesOf(name).some((want) => cells.some((cell) => cell === want || cell.startsWith(want)));

  /* ---------------- นิยามรูปแบบ ---------------- */
  const SPECS = [
    {
      code: "bo_compact",
      label: "รายงานบัญชีฝาก-ถอน (BO แบบย่อ)",
      side: "bo",
      need: ["เวลา", "ประเภท", "ยูสเซอร์", "บัญชีบริษัทแบบย่อ", "ยอดเงินแบบย่อ"],
    },
    {
      code: "bo_main",
      label: "รายงานบัญชีฝาก-ถอน (BO)",
      side: "bo",
      need: ["วันที่ทำรายการ", "วันที่ธนาคาร", "จำนวนเงินฝากจริง", "จำนวนเงินถอนจริง", "ชื่อธนาคาร"],
    },
    {
      code: "manual_credit",
      label: "ฝากมือ - รายการเครดิต",
      side: "bo",
      need: ["เวลาทำรายการ", "เวลาธนาคาร", "เลขบัญชีธนาคารสมาชิก", "เลขบัญชีธนาคารบริษัท", "จำนวน"],
    },
    {
      code: "manual_payment",
      label: "ฝากมือ - รายการ Payment",
      side: "bo",
      need: ["เวลาทำรายการ", "เลขคำสั่งชำระ", "ช่องทาง", "บัญชีบริษัท", "จำนวน"],
    },
    {
      code: "manual_bonus",
      label: "ฝากมือ - รายการโบนัส",
      side: "aux",
      need: ["เวลาทำรายการ", "โปรโมชั่น", "ยอดก่อนเติม", "โบนัส"],
    },
    {
      code: "comm_req",
      label: "ขอถอนค่าคอมมิชชั่น",
      side: "aux",
      need: ["วัน/เวลา", "รหัสสมาชิก", "จำนวนเงิน", "สถานะ", "ดำเนินการโดย"],
    },
    {
      code: "credit_out",
      label: "รายงานถอนเครดิต",
      side: "aux",
      need: ["เวลาทำรายการ", "รหัสสมาชิก", "เครดิตก่อน", "จำนวน", "เครดิตหลัง"],
    },
  ];

  /* ---------------- PM gateway (ยืดหยุ่น: แต่ละเจ้าคอลัมน์ต่างกัน) ----------------
     เช่น MYPAY(id,amount,provider,status,requestTime) · ATP(วันที่,Ref,Username,ธนาคาร,สร้างฝาก,โอนจริง,Status)
          CBY(วันที่ทำรายการ,Ref Id,จำนวนเงิน,สถานะ) · CBY ถอน(...,จำนวนเงิน,ค่าธรรมเนียม,รวมหักเงิน,สถานะ)
     ตรวจจับจาก: มีคอลัมน์วันที่ + สถานะ + ยอด (และไม่เข้า SPEC อื่น) */
  const PM_DATE = ["paymenttime", "updatetime", "วันเวลาอัพเดต", "วันเวลา", "วันที่ทำรายการ", "วันที่", "requesttime"];
  const PM_STATUS = ["status", "สถานะ"];
  const PM_AMT_DEP = ["โอนจริง", "จำนวนเงิน", "amount", "สร้างฝาก", "realamount"];
  const PM_AMT_WIT = ["transferredamount", "p2pจ่าย", "p2p จ่าย", "โอนจริง", "รวมหักเงิน", "จำนวนเงิน", "amount"];
  const anyCol = (cells, names) => names.some((n) => cells.some((c) => c === norm(n) || c.startsWith(norm(n))));
  function detectPM(rows) {
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const cells = (rows[i] || []).map(norm).filter(Boolean);
      if (cells.length < 3) continue;
      if (anyCol(cells, PM_DATE) && anyCol(cells, PM_STATUS) && anyCol(cells, [...PM_AMT_DEP, ...PM_AMT_WIT])) {
        const idx = {};
        (rows[i] || []).forEach((raw, j) => {
          const k = norm(raw);
          if (k && idx[k] === undefined) idx[k] = j;
        });
        // ชื่อบริษัทย่อยจากแถวหัวเรื่องด้านบน (เช่น UFABET7M)
        let title = "";
        for (let k = 0; k < i; k++) {
          const first = String((rows[k] || [])[0] || "").trim();
          if (first) { title = first; break; }
        }
        // รายงานจาก Provider คือ statement ฝั่ง PM ที่ต้องนำไปชนกับ BO
        // ไม่ใช่ BO เอง มิฉะนั้นระบบจะเอารายงานทั้งสองฝั่งไปรวมกันและแจ้ง missing ผิดจำนวนมาก
        return { spec: { code: "pm_provider", label: "รายการ PM (payment gateway)", side: "stm" }, headerIdx: i, idx, title };
      }
    }
    return null;
  }

  /* หา header row ภายใน 30 บรรทัดแรก รองรับหัวเรื่อง/แถวว่าง/merged cells ด้านบน */
  function detect(rows) {
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const cells = (rows[i] || []).map(norm);
      if (!cells.length) continue;
      for (const spec of SPECS) {
        if (spec.need.every((w) => hasHeader(cells, w))) {
          const idx = {};
          (rows[i] || []).forEach((raw, j) => {
            const k = norm(raw);
            if (k && idx[k] === undefined) idx[k] = j;
          });
          return { spec, headerIdx: i, idx };
        }
      }
    }
    return null;
  }

  const col = (f, name) => {
    for (const k of aliasesOf(name)) {
      if (f.idx[k] !== undefined) return f.idx[k];
      for (const key of Object.keys(f.idx)) if (key.startsWith(k)) return f.idx[key];
    }
    return undefined;
  };
  const val = (f, r, name) => {
    const c = col(f, name);
    return c === undefined ? "" : String(r[c] ?? "").trim();
  };
  // อ่านค่าจากคอลัมน์แรกที่เจอในรายชื่อ (สำหรับไฟล์ PM ที่แต่ละเจ้าตั้งชื่อคอลัมน์ต่างกัน)
  const valAny = (f, r, names) => {
    for (const n of names) {
      const v = val(f, r, n);
      if (v !== "") return v;
    }
    return "";
  };
  const num = (v) => {
    const n = parseFloat(String(v ?? "").replace(/[,\s฿]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  /* '2026-07-19 23:52:23' -> { date, sec } ; รองรับ 19/07/2026 และ 19-07-69 ด้วย */
  function stamp(v) {
    const s = String(v || "").trim();
    if (!s) return null;
    let date = null;
    let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      let y = +m[1];
      if (y > 2400) y -= 543; // พ.ศ. -> ค.ศ. (กรณี BO ส่งปี พ.ศ. มาในรูปแบบ ISO)
      date = `${y}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
    }
    if (!date) {
      m = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
      if (m) {
        let y = +m[3];
        if (y < 100) y += 2500; // 69 -> 2569 (พ.ศ.)
        if (y > 2400) y -= 543; // พ.ศ. -> ค.ศ.
        date = `${y}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
      }
    }
    const t = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    const sec = t ? +t[1] * 3600 + +t[2] * 60 + (+t[3] || 0) : null;
    if (!date && sec === null) return null;
    return { date, sec: sec === null ? 0 : sec, hasTime: !!t, secPrecision: t && t[3] !== undefined };
  }

  /* 'ม่วย | AFF19007' -> { nick, code } ; '020256062892 | กรณ์วิภา' -> { code:เลขบัญชี, nick:ชื่อ } */
  function pipe(v) {
    const parts = String(v || "")
      .split("|")
      .map((x) => x.trim());
    return { left: parts[0] || "", right: parts[1] || "" };
  }

  /* 'Cyberplus-4 : Cyberplus' -> { terminal:'Cyberplus-4', channel:'CYBERPLUS' }
     '6517248040 : Manual'     -> { terminal:'6517248040', channel:'MANUAL' }        */
  function channelOf(v) {
    const s = String(v || "").trim();
    if (!s) return { terminal: "", channel: "", isBankAccount: false };
    const i = s.lastIndexOf(":");
    const terminal = (i >= 0 ? s.slice(0, i) : s).trim();
    const channel = (i >= 0 ? s.slice(i + 1) : "").trim().toUpperCase();
    return { terminal, channel: channel || terminal.toUpperCase(), isBankAccount: /^\d{9,15}$/.test(terminal) };
  }

  const PM_CHANNELS = ["CYBERPLUS", "CYNERPLUS", "CYBER", "AUTOPEER", "AZPAY", "ATP", "12PAY", "MYPAY"];
  const canonicalPm = (ch) => {
    const s = String(ch || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (/CYBER|CYNER|CBY/.test(s)) return "CYBERPLUS";
    if (/AUTOPEER|ATP/.test(s)) return "AUTOPEER";
    if (/AZPAY|^AZ$/.test(s)) return "AZPAY";
    if (/MYPAY/.test(s)) return "MYPAY";
    if (/12PAY/.test(s)) return "12PAY";
    return "";
  };
  const isPm = (ch) => !!canonicalPm(ch);

  /* ชื่อบริษัทจากชื่อไฟล์ เช่น 'AT4 รายงานบัญชีฝาก ...' / 'FR8 ...' */
  function companyOf(fileName) {
    const m = String(fileName || "").match(/\b([A-Z]{2,4}\d{0,2})\b/);
    return m ? m[1].toUpperCase() : null;
  }

  const OK_STATUS = ["สำเร็จ", "ถอนสำเร็จ", "success", "อนุมัติ"];
  const okStatus = (s) => {
    const v = String(s || "").trim().toLowerCase();
    if (!v) return true;
    return OK_STATUS.some((w) => v.includes(w.toLowerCase()));
  };

  /* ---------------- ตัวแปลงต่อรูปแบบ ---------------- */
  const PM_PROVIDERS = [["mypay", "MYPAY"], ["autopeer", "AUTOPEER"], ["atp", "AUTOPEER"], ["azpay", "AZPAY"], ["cyberplus", "CYBERPLUS"], ["cby", "CYBERPLUS"], ["12pay", "12PAY"]];
  function pmProviderOf(fileName) {
    const s = String(fileName || "").toLowerCase();
    const hit = PM_PROVIDERS.find(([k]) => s.includes(k));
    return hit ? hit[1] : null;
  }
  function subcoOf(fileName, title) {
    // จากหัวเรื่องในไฟล์ก่อน (เช่น UFABET7M -> 7M) แล้วค่อยจากชื่อไฟล์
    const t = String(title || "").replace(/^ufabet/i, "").trim().toUpperCase();
    if (t) return t;
    const m = String(fileName || "").match(/\b([0-9]?[A-Z]{1,3}[0-9]?)\b/);
    return m ? m[1].toUpperCase() : "";
  }

  function parse(fileName, rows, businessDate) {
    const f = detect(rows) || detectPM(rows);
    if (!f) return null;
    const company = companyOf(fileName);
    const out = {
      fileName,
      company,
      code: f.spec.code,
      label: f.spec.label,
      side: f.spec.side,
      records: [],
      aux: [],
      dropped: {},
      warnings: [],
      channels: {},
    };
    const drop = (why) => (out.dropped[why] = (out.dropped[why] || 0) + 1);
    // Provider exports also use compact D/W tokens, for example
    // UFABET7M_PM_AUTOPEER_W_2026-08-27.xlsx. Treat those tokens as the
    // direction before falling back to the long Thai/English words.
    const fileDir = /(?:^|[_\-\s])W(?:[_\-\s.]|$)|ถอน|withdraw|payout/i.test(fileName)
      ? "withdraw"
      : /(?:^|[_\-\s])D(?:[_\-\s.]|$)|ฝาก|deposit|payin/i.test(fileName)
        ? "deposit"
        : null;
    const pmMeta = { dir: fileDir, provider: pmProviderOf(fileName), subco: subcoOf(fileName, f.title) };
    if (f.spec.code === "pm_provider" && pmMeta.subco) out.company = pmMeta.subco;

    for (let i = f.headerIdx + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      if (!r.some((c) => String(c).trim() !== "")) continue;
      const rec = ROW[f.spec.code](f, r, i, company, drop, fileDir, pmMeta);
      if (!rec) continue;
      if (businessDate && rec.date && rec.date !== businessDate && !rec.crossDay) {
        drop("วันที่ไม่ตรงกับวันที่ตรวจ");
        continue;
      }
      if (f.spec.side === "aux") out.aux.push(rec);
      else {
        out.records.push(rec);
        const key = rec.channel || "ไม่ระบุ";
        const c = out.channels[key] || (out.channels[key] = { count: 0, amount: 0, isPm: isPm(key), hasStmSide: !isPm(key) });
        c.count++;
        c.amount += rec.amount;
      }
    }

    if (!out.records.length && !out.aux.length) out.warnings.push("อ่านหัวคอลัมน์ได้แต่ไม่มีบรรทัดข้อมูลที่ใช้ได้");
    return out;
  }

  const ROW = {
    bo_compact(f, r, i, company, drop) {
      const t = stamp(val(f, r, "เวลา"));
      if (!t) return drop("ไม่มีเวลาที่อ่านได้"), null;
      const amount = num(val(f, r, "ยอดเงินแบบย่อ"));
      if (!amount) return drop("ยอดเงินเป็นศูนย์"), null;
      const type = val(f, r, "ประเภท");
      const companyAccount = val(f, r, "บัญชีบริษัทแบบย่อ");
      const customerAccount = val(f, r, "บัญชีลูกค้าแบบย่อ");
      const note = val(f, r, "โน้ต");
      const pm = canonicalPm(companyAccount);
      const direction = /ถอน|withdraw|payout/i.test(type + " " + companyAccount)
        ? "withdraw"
        : "deposit";
      const ref = (note.match(/\b(?:P2C|DEP|WD|WIT)[-A-Z0-9]+\b/i) || [])[0] || note;
      return {
        rowNo: i + 1,
        source: "bo",
        formatCode: "bo_compact",
        date: t.date,
        sec: t.sec,
        boDate: t.date,
        boSec: t.sec,
        amount: Math.round(amount * 100) / 100,
        direction,
        account: pm || companyAccount || "UNKNOWN",
        channel: pm || companyAccount,
        isPmChannel: !!pm,
        bank: "",
        company,
        memberCode: val(f, r, "ยูสเซอร์"),
        custAccount: customerAccount,
        ref,
        username: val(f, r, "ผู้ดำเนินการ"),
        note,
        crossDay: false,
        lateNight: t.sec >= 82800,
        minutePrecision: !t.secPrecision,
        raw: r.join(" | "),
      };
    },

    /* ไฟล์ export จาก payment gateway (MYPAY/12PAY/ATP/AZPAY/CYBERPLUS)
       คอลัมน์: id, amount, provider, status, requestTime, fee, reference, customerId, realAmount, payee, paymentTime ...
       กรองเฉพาะ Success · ทิศทางจากชื่อไฟล์ (ฝาก/ถอน) หรือ prefix ของ id (DEP/WD) */
    pm_provider(f, r, i, company, drop, fileDir, meta) {
      const status = valAny(f, r, ["status", "สถานะ"]).toLowerCase();
      const submitStatus = valAny(f, r, ["submitStatus", "สถานะส่งจ่าย"]).toLowerCase();
      const transferred = num(valAny(f, r, ["transferredAmount", "ยอดโอนจริง"]));
      // MYPAY ใช้ PARTIAL + SENDED เมื่อจ่ายเงินจริงบางส่วนสำเร็จ ยอดจริงอยู่ใน transferredAmount
      // จึงต้องรับเป็นรายการถอนที่เกิดขึ้นจริง แทนการทิ้งทั้งแถวเพราะ status ไม่ใช่ SUCCESS
      const paidPartial = /partial/.test(status) && /sended|sent|success|สำเร็จ/.test(submitStatus) && transferred > 0;
      if (!/success|สำเร็จ/.test(status) && !paidPartial) {
        return drop("รายการไม่สำเร็จ (PM: " + (status || "-") + (submitStatus ? "/" + submitStatus : "") + ")"), null;
      }
      const t = stamp(valAny(f, r, ["paymentTime", "updateTime", "วันเวลาอัพเดต", "วันเวลา", "วันที่ทำรายการ", "วันที่", "requestTime"]));
      if (!t) return drop("ไม่มีเวลาที่อ่านได้"), null;
      const id = valAny(f, r, ["id", "OrderId", "Ref Id", "Ref", "reference"]);
      const dir = (meta && meta.dir) || (/^wd|^wit|^wtd/i.test(id) ? "withdraw" : "deposit");
      /* ยอดที่ใช้จับคู่: ถอน = จ่ายจริง (รองรับ SUCCESS-PARTIAL / ยอดซอยย่อย), ฝาก = โอนจริง */
      const amount =
        dir === "withdraw"
          ? num(valAny(f, r, ["transferredAmount", "ยอดโอนจริง", "P2P จ่าย", "p2pจ่าย", "โอนจริง", "จำนวนเงิน", "รวมหักเงิน", "amount"]))
          : num(valAny(f, r, ["โอนจริง", "จำนวนเงิน", "amount", "สร้างฝาก", "realAmount"]));
      if (!amount) return drop("ยอดเงินเป็นศูนย์"), null;
      const provRaw = valAny(f, r, ["provider"]).toLowerCase();
      const provider = (meta && meta.provider) || (PM_PROVIDERS.find(([k]) => provRaw.includes(k)) || [])[1] || (provRaw ? provRaw.toUpperCase() : "PM");
      return {
        rowNo: i + 1,
        source: "bo",
        formatCode: "pm_provider",
        date: t.date,
        sec: t.sec,
        amount: Math.round(amount * 100) / 100,
        requested: num(valAny(f, r, ["แจ้งถอน", "สร้างฝาก", "amount"])) || null,
        fee: num(valAny(f, r, ["ค่าธรรมเนียม", "fee"])),
        direction: dir,
        account: provider,
        channel: provider,
        isPmChannel: true,
        bank: "",
        company: provider,
        subco: (meta && meta.subco) || "",
        memberCode: valAny(f, r, ["Username", "user ที่ฝาก", "ยูสเซอร์", "customerId"]),
        custName: valAny(f, r, ["ชื่อ - นามสกุล ผู้รับ", "payee"]),
        custBank: valAny(f, r, ["ธนาคาร", "ธนาคารต้นทาง"]),
        ref: valAny(f, r, ["Ref", "Ref Id", "reference", "id"]),
        status,
        partial: /partial/.test(status),
        submitStatus,
        crossDay: false,
        lateNight: t.sec >= 82800,
        minutePrecision: !t.secPrecision,
        raw: r.join(" | "),
      };
    },
    bo_main(f, r, i, company, drop) {
      const boT = stamp(val(f, r, "วันที่ทำรายการ"));
      const bankT = stamp(val(f, r, "วันที่ธนาคาร")) || boT;
      if (!boT) return drop("ไม่มีเวลาที่อ่านได้"), null;
      const dep = num(val(f, r, "จำนวนเงินฝากจริง"));
      const wit = num(val(f, r, "จำนวนเงินถอนจริง"));
      const amount = dep || wit;
      if (!amount) return drop("ยอดเงินเป็นศูนย์"), null;
      const ch = channelOf(val(f, r, "ชื่อธนาคาร"));
      const mem = pipe(val(f, r, "สมาชิก"));
      const cust = pipe(val(f, r, "บัญชีลูกค้า"));
      return {
        rowNo: i + 1,
        source: "bo",
        formatCode: "bo_main",
        date: bankT.date || boT.date,
        sec: bankT.sec,
        boDate: boT.date,
        boSec: boT.sec,
        amount: Math.round(amount * 100) / 100,
        direction: dep ? "deposit" : "withdraw",
        account: canonicalPm(ch.channel) || ch.terminal || "UNKNOWN",
        channel: canonicalPm(ch.channel) || ch.channel,
        isPmChannel: isPm(ch.channel),
        bank: ch.isBankAccount ? "" : ch.channel,
        company,
        memberCode: mem.right || mem.left,
        memberNick: mem.left,
        custAccount: cust.left,
        custName: cust.right,
        bonus: num(val(f, r, "โบนัส/โปรโมชั่น")),
        promo: val(f, r, "ชื่อโปรโมชั่น"),
        ref: val(f, r, "รหัสอ้างอิง"),
        via: val(f, r, "เกิดโดย"),
        username: val(f, r, "ทำรายการโดย") || val(f, r, "สร้างโดย") || "",
        note: val(f, r, "หมายเหตุ"),
        crossDay: !!(boT.date && bankT.date && boT.date !== bankT.date),
        lateNight: bankT.sec >= 82800,
        minutePrecision: !bankT.secPrecision,
        raw: r.join(" | "),
      };
    },

    manual_credit(f, r, i, company, drop) {
      const boT = stamp(val(f, r, "เวลาทำรายการ"));
      const bankT = stamp(val(f, r, "เวลาธนาคาร")) || boT;
      if (!boT) return drop("ไม่มีเวลาที่อ่านได้"), null;
      const amount = num(val(f, r, "จำนวน"));
      if (!amount) return drop("ยอดเงินเป็นศูนย์"), null;
      if (!okStatus(val(f, r, "สถานะ"))) return drop("รายการไม่สำเร็จ"), null;
      const coAcc = val(f, r, "เลขบัญชีธนาคารบริษัท");
      return {
        rowNo: i + 1,
        source: "bo",
        formatCode: "manual_credit",
        date: bankT.date || boT.date,
        sec: bankT.sec,
        boDate: boT.date,
        boSec: boT.sec,
        amount: Math.round(amount * 100) / 100,
        direction: "deposit",
        account: coAcc || "UNKNOWN",
        channel: "MANUAL",
        isPmChannel: false,
        bank: "", // ธนาคารของบัญชีบริษัท ไม่ได้อยู่ในรายงานนี้
        custBank: (val(f, r, "ชื่อธนาคารสมาชิก") || "").toUpperCase(),
        company,
        memberCode: val(f, r, "รหัสสมาชิก"),
        memberNick: val(f, r, "ชื่อเล่นสมาชิก"),
        custAccount: val(f, r, "เลขบัญชีธนาคารสมาชิก"),
        custName: val(f, r, "ชื่อบัญชีธนาคารสมาชิก"),
        ref: val(f, r, "รหัสรายการ"),
        username: val(f, r, "ดำเนินการโดย"),
        note: val(f, r, "หมายเหตุ"),
        creditBefore: num(val(f, r, "เครดิตก่อน")),
        creditAfter: num(val(f, r, "เครดิตหลัง")),
        manual: true,
        crossDay: !!(boT.date && bankT.date && boT.date !== bankT.date),
        lateNight: bankT.sec >= 82800,
        minutePrecision: !bankT.secPrecision,
        raw: r.join(" | "),
      };
    },

    manual_payment(f, r, i, company, drop) {
      const boT = stamp(val(f, r, "เวลาทำรายการ"));
      const bankT = stamp(val(f, r, "เวลาธนาคาร")) || boT;
      if (!boT) return drop("ไม่มีเวลาที่อ่านได้"), null;
      const amount = num(val(f, r, "จำนวน"));
      if (!amount) return drop("ยอดเงินเป็นศูนย์"), null;
      if (!okStatus(val(f, r, "สถานะ"))) return drop("รายการไม่สำเร็จ"), null;
      const ch = channelOf(val(f, r, "ช่องทาง"));
      return {
        rowNo: i + 1,
        source: "bo",
        formatCode: "manual_payment",
        date: bankT.date || boT.date,
        sec: bankT.sec,
        boDate: boT.date,
        boSec: boT.sec,
        amount: Math.round(amount * 100) / 100,
        direction: "deposit",
        account: canonicalPm(ch.channel) || val(f, r, "บัญชีบริษัท") || ch.terminal || "UNKNOWN",
        channel: canonicalPm(ch.channel) || ch.channel || "MANUAL",
        isPmChannel: isPm(ch.channel),
        bank: "",
        company,
        memberCode: val(f, r, "รหัสสมาชิก"),
        memberNick: val(f, r, "ชื่อเล่นสมาชิก"),
        payOrder: val(f, r, "เลขคำสั่งชำระ"),
        ref: val(f, r, "รหัสรายการ"),
        username: val(f, r, "ดำเนินการโดย"),
        note: val(f, r, "หมายเหตุ"),
        manual: true,
        crossDay: !!(boT.date && bankT.date && boT.date !== bankT.date),
        lateNight: bankT.sec >= 82800,
        raw: r.join(" | "),
      };
    },

    manual_bonus(f, r, i, company, drop) {
      const t = stamp(val(f, r, "เวลาทำรายการ"));
      if (!t) return drop("ไม่มีเวลาที่อ่านได้"), null;
      return {
        kind: "bonus",
        rowNo: i + 1,
        date: t.date,
        sec: t.sec,
        company,
        memberCode: val(f, r, "รหัสสมาชิก"),
        memberNick: val(f, r, "ชื่อเล่นสมาชิก"),
        promo: val(f, r, "โปรโมชั่น"),
        status: val(f, r, "สถานะ"),
        before: num(val(f, r, "ยอดก่อนเติม")),
        credit: num(val(f, r, "เครดิต")),
        bonus: num(val(f, r, "โบนัส")),
        after: num(val(f, r, "ยอดหลังเติม")),
        username: val(f, r, "ดำเนินการโดย"),
        note: val(f, r, "หมายเหตุ"),
        raw: r.join(" | "),
      };
    },

    comm_req(f, r, i, company, drop) {
      const t = stamp(val(f, r, "วัน/เวลา"));
      if (!t) return drop("ไม่มีเวลาที่อ่านได้"), null;
      const amount = num(val(f, r, "จำนวนเงิน"));
      const note = val(f, r, "หมายเหตุ");
      // 'ได้รับยอดภายในเดือน 21 บาท' -> ยอดที่มีสิทธิ์รับจริง
      const hints = noteHints(note);
      return {
        kind: "comm",
        rowNo: i + 1,
        date: t.date,
        sec: t.sec,
        company,
        memberCode: val(f, r, "รหัสสมาชิก"),
        memberNick: val(f, r, "ชื่อเล่นสมาชิก"),
        memberName: val(f, r, "ชื่อสมาชิก"),
        amount: Math.round(amount * 100) / 100,
        status: val(f, r, "สถานะ"),
        approved: okStatus(val(f, r, "สถานะ")),
        entitled: hints.entitled,
        excess: hints.excess,
        username: val(f, r, "ดำเนินการโดย"),
        ref: val(f, r, "รหัสรายการ"),
        note,
        raw: r.join(" | "),
      };
    },

    credit_out(f, r, i, company, drop) {
      const t = stamp(val(f, r, "เวลาทำรายการ"));
      if (!t) return drop("ไม่มีเวลาที่อ่านได้"), null;
      return {
        kind: "creditout",
        rowNo: i + 1,
        date: t.date,
        sec: t.sec,
        company,
        memberCode: val(f, r, "รหัสสมาชิก"),
        memberNick: val(f, r, "ชื่อเล่นสมาชิก"),
        memberName: val(f, r, "ชื่อสมาชิก"),
        amount: num(val(f, r, "จำนวน")),
        before: num(val(f, r, "เครดิตก่อน")),
        after: num(val(f, r, "เครดิตหลัง")),
        status: val(f, r, "สถานะ"),
        username: val(f, r, "สร้างโดย") || val(f, r, "ดำเนินการโดย"),
        ref: val(f, r, "รหัสรายการ"),
        note: val(f, r, "หมายเหตุ"),
        ...noteHints(val(f, r, "หมายเหตุ")),
        raw: r.join(" | "),
      };
    },
  };

  /* ดึงตัวเลขจากหมายเหตุที่พนักงานเขียน เช่น
     'ได้รับยอดภายในเดือน 21 บาท สะสมเกิน 79 บาท' / 'สะสมเกินเดือน ได้รับจริง 108 บาท' */
  function noteHints(note) {
    const n = String(note || "");
    const grab = (re) => {
      const m = n.match(re);
      return m ? num(m[1]) : null;
    };
    return {
      entitled: grab(/ได้รับ(?:ยอด)?(?:จริง|ภายในเดือน)\s*([\d,]+(?:\.\d+)?)/),
      excess: grab(/สะสมเกิน(?:เดือน)?\s*([\d,]+(?:\.\d+)?)\s*บาท/),
    };
  }

  /* -------------------------------------------------------------
     รวมรายการข้ามรายงาน
     รายงานฝากมือ_* คือรายละเอียดของแถว "เติมมือ" ในรายงานบัญชีฝาก
     ทั้งสองใช้ UUID เดียวกัน (รหัสอ้างอิง = รหัสรายการ) จึงยุบเป็นรายการเดียว
     โดยยึดแถวจากรายงานบัญชีเป็นหลัก แล้วเติมข้อมูลบัญชีลูกค้า/เครดิตจากฝากมือ
     ------------------------------------------------------------- */
  const RANK = { bo_main: 3, manual_credit: 2, manual_payment: 1 };

  function merge(records) {
    const byRef = new Map();
    const noRef = [];
    records.forEach((r) => {
      const ref = String(r.ref || "").trim();
      if (!ref) return noRef.push(r);
      const prev = byRef.get(ref);
      if (!prev) return byRef.set(ref, { ...r, mergedFrom: [r.formatCode] });
      const keepNew = (RANK[r.formatCode] || 0) > (RANK[prev.formatCode] || 0);
      const base = keepNew ? { ...r } : prev;
      const extra = keepNew ? prev : r;
      // เติมช่องที่ฝั่งหลักไม่มี
      ["custAccount", "custName", "bank", "creditBefore", "creditAfter", "memberCode", "memberNick", "note", "payOrder"].forEach((k) => {
        if ((base[k] === undefined || base[k] === "" || base[k] === null) && extra[k] !== undefined && extra[k] !== "") base[k] = extra[k];
      });
      base.mergedFrom = [...new Set([...(prev.mergedFrom || [prev.formatCode]), r.formatCode])];
      base.manual = base.manual || extra.manual || /มือ/.test(String(base.via || "") + String(extra.via || ""));
      byRef.set(ref, base);
    });
    return [...byRef.values(), ...noRef];
  }

  return { SPECS, detect, parse, stamp, channelOf, companyOf, canonicalPm, isPm, pipe, merge };
})();

if (typeof window !== "undefined") window.Formats = Formats;
