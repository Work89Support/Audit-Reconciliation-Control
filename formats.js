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
      .replace(/\s+/g, "")
      .trim()
      .toLowerCase();

  /* ---------------- นิยามรูปแบบ ---------------- */
  const SPECS = [
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

  /* หา header row (ภายใน 10 บรรทัดแรก) ที่ตรงกับ spec */
  function detect(rows) {
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const cells = (rows[i] || []).map(norm);
      if (!cells.length) continue;
      for (const spec of SPECS) {
        if (spec.need.every((w) => cells.some((c) => c === norm(w) || c.startsWith(norm(w))))) {
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
    const k = norm(name);
    if (f.idx[k] !== undefined) return f.idx[k];
    for (const key of Object.keys(f.idx)) if (key.startsWith(k)) return f.idx[key];
    return undefined;
  };
  const val = (f, r, name) => {
    const c = col(f, name);
    return c === undefined ? "" : String(r[c] ?? "").trim();
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

  const PM_CHANNELS = ["CYBERPLUS", "AUTOPEER", "AZPAY", "ATP"];
  const isPm = (ch) => PM_CHANNELS.some((p) => (ch || "").toUpperCase().includes(p));

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
  function parse(fileName, rows, businessDate) {
    const f = detect(rows);
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

    for (let i = f.headerIdx + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      if (!r.some((c) => String(c).trim() !== "")) continue;
      const rec = ROW[f.spec.code](f, r, i, company, drop);
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
        account: ch.terminal || "UNKNOWN",
        channel: ch.channel,
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
        account: val(f, r, "บัญชีบริษัท") || ch.terminal || "UNKNOWN",
        channel: ch.channel || "MANUAL",
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

  return { SPECS, detect, parse, stamp, channelOf, companyOf, isPm, pipe, merge };
})();

if (typeof window !== "undefined") window.Formats = Formats;
