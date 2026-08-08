/* =============================================================
   Rules - กฎธุรกิจที่ตรวจได้จากไฟล์ BO อย่างเดียว (ไม่ต้องรอ statement)
   ใช้กับผลลัพธ์ของ Formats.parse()
     R1 ค่าคอมมิชชั่น  : ขอถอน vs ตัดเครดิต  (สะสมเกินเดือน)
     R2 ตัดเครดิตลอย   : ตัดเครดิตโดยไม่มีคำขอถอนค่าคอมของสมาชิกคนนั้น
     R3 คณิตเครดิต     : เครดิตก่อน - จำนวน != เครดิตหลัง
     R4 คณิตโบนัส      : ยอดก่อนเติม + เครดิต + โบนัส != ยอดหลังเติม
     R5 ข้ามวัน        : วันที่ทำรายการ != วันที่ธนาคาร
     R6 รายการซ้ำ      : บัญชี+ยอด+สมาชิก ซ้ำภายในช่วงเวลาสั้น
     R7 ยอดใหญ่ผิดปกติ : ยอดเกินเกณฑ์ที่ตั้งไว้ ต้องมีเอกสารกำกับ
   ============================================================= */

const Rules = (() => {
  const NAME = {
    comm_cut_missing: "ค่าคอมสะสมเกิน ไม่มีรายการตัดยอด",
    comm_cut_mismatch: "ยอดตัดเครดิตไม่เท่ากับส่วนต่างค่าคอม",
    credit_orphan: "ตัดเครดิตโดยไม่มีคำขอถอนค่าคอม",
    credit_math: "ยอดเครดิตก่อน-หลัง ไม่สมดุล",
    bonus_math: "ยอดโบนัสก่อน-หลัง ไม่สมดุล",
    cross_day: "รายการข้ามวัน (BO กับธนาคารคนละวัน)",
    duplicate: "เติมซ้ำ / รายการซ้ำ",
    large_amount: "ยอดสูงผิดปกติ ต้องมีเอกสารกำกับ",
  };
  const SEV = {
    comm_cut_missing: "high",
    comm_cut_mismatch: "critical",
    credit_orphan: "high",
    credit_math: "critical",
    bonus_math: "high",
    cross_day: "medium",
    duplicate: "critical",
    large_amount: "medium",
  };
  const CAUSE = {
    comm_cut_missing: "อนุมัติถอนค่าคอมเกินสิทธิ์แต่ยังไม่ได้ตัดยอดส่วนเกิน",
    comm_cut_mismatch: "คีย์ยอดตัดไม่ตรงกับส่วนต่างที่คำนวณได้",
    credit_orphan: "ตัดเครดิตด้วยเหตุอื่น ต้องมีเอกสารชี้แจงกำกับ",
    credit_math: "ยอดเครดิตในรายงานไม่สมดุล อาจแก้ไขหลังบันทึก",
    bonus_math: "โปรโมชั่นคำนวณไม่ตรงกับยอดที่เติมจริง",
    cross_day: "ธนาคารบันทึกคนละวันกับระบบหลังบ้าน ต้องตรวจร่วมกับวันถัดไป",
    duplicate: "ทำรายการซ้ำในระบบหลังบ้าน",
    large_amount: "ยอดสูงกว่าเกณฑ์ ต้องแนบเอกสารอนุมัติ",
  };

  const round2 = (n) => Math.round(n * 100) / 100;
  const pad = (n) => String(n).padStart(2, "0");
  const hhmmss = (s) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  const shiftOf = (h) => (h >= 8 && h < 16 ? "morning" : h >= 16 ? "afternoon" : "night");
  const SLA_OF = { critical: 4, high: 8, medium: 48, low: 72 };

  function mk(type, o) {
    const sec = o.sec || 0;
    const hour = Math.floor(sec / 3600);
    let severity = SEV[type];
    if (severity !== "critical" && (o.riskAmount || 0) > 10000) severity = "critical";
    const slaHours = SLA_OF[severity];
    const ageHours = 1 + Math.floor((86400 - sec) / 3600);
    return {
      sortSec: sec,
      date: o.date,
      time: hhmmss(sec),
      hour,
      company: o.company || "-",
      bank: o.bank || o.channel || "-",
      account: o.account || o.memberCode || "-",
      direction: o.direction || "-",
      systemAmount: o.systemAmount ?? null,
      bankAmount: o.bankAmount ?? null,
      amountDiff: o.amountDiff ?? 0,
      riskAmount: o.riskAmount || 0,
      timeDiffSec: 0,
      type,
      typeName: NAME[type],
      severity,
      status: "open",
      shift: shiftOf(hour),
      employee: o.username || "ไม่ระบุ",
      assignee: "audit_som",
      track: null, // แอปจะเติมให้จากระบบต้นทางของบริษัท
      cause: CAUSE[type],
      detail: o.detail || "",
      member: o.memberCode || "",
      memberNick: o.memberNick || "",
      ageHours,
      slaHours,
      overSla: ageHours > slaHours,
      hasEvidence: false,
      stmRaw: o.stmRaw || "— ตรวจจากรายงานหลังบ้าน ไม่ต้องใช้ statement —",
      boRaw: o.boRaw || o.raw || "",
      boTime: hhmmss(o.boSec ?? sec),
      notes: [],
      evidence: [],
      fromImport: true,
      ruleBased: true,
    };
  }

  /* ---------------- R1 + R2 ค่าคอมมิชชั่น ---------------- */
  function commissionChecks(comms, cuts, out, tol) {
    const usedCut = new Set();
    comms.forEach((c) => {
      if (!c.approved) return;
      const cand = cuts.filter((k, i) => !usedCut.has(i) && k.memberCode === c.memberCode && k.date === c.date);
      const cut = cand[0];
      const cutIdx = cut ? cuts.indexOf(cut) : -1;

      /* ยอดที่มีสิทธิ์รับจริง อาจถูกเขียนไว้ในหมายเหตุของคำขอ หรือของรายการตัดเครดิต */
      const entitled = c.entitled ?? (cut ? cut.entitled : null) ?? null;
      const excessNote = c.excess ?? (cut ? cut.excess : null) ?? null;

      if (entitled !== null || excessNote !== null) {
        const expect = entitled !== null ? round2(c.amount - entitled) : excessNote;
        c = { ...c, entitled: entitled !== null ? entitled : round2(c.amount - expect) };
        if (!cut) {
          out.push(
            mk("comm_cut_missing", {
              ...c,
              riskAmount: expect,
              systemAmount: c.amount,
              detail: `ขอถอน ${c.amount.toLocaleString()} บาท มีสิทธิ์รับ ${c.entitled.toLocaleString()} บาท ส่วนเกิน ${expect.toLocaleString()} บาท แต่ไม่พบรายการตัดเครดิต`,
            }),
          );
          return;
        }
        usedCut.add(cutIdx);
        if (Math.abs(cut.amount - expect) > tol) {
          out.push(
            mk("comm_cut_mismatch", {
              ...c,
              riskAmount: round2(Math.abs(cut.amount - expect)),
              systemAmount: cut.amount,
              bankAmount: expect,
              amountDiff: round2(cut.amount - expect),
              detail: `ขอถอน ${c.amount.toLocaleString()} มีสิทธิ์ ${c.entitled.toLocaleString()} ส่วนเกินที่ควรตัด ${expect.toLocaleString()} แต่ตัดจริง ${cut.amount.toLocaleString()} บาท`,
              boRaw: c.raw + "  ||  ตัดเครดิต: " + cut.raw,
            }),
          );
        }
      } else if (cut) usedCut.add(cutIdx);
    });

    cuts.forEach((k, i) => {
      if (usedCut.has(i)) return;
      const linked = comms.some((c) => c.memberCode === k.memberCode && c.date === k.date);
      if (linked) return;
      out.push(
        mk("credit_orphan", {
          ...k,
          riskAmount: k.amount,
          systemAmount: k.amount,
          detail: `ตัดเครดิต ${k.amount.toLocaleString()} บาท จาก ${k.memberCode} (${k.memberNick || "-"}) โดยไม่มีคำขอถอนค่าคอมในวันเดียวกัน — หมายเหตุ: ${k.note || "ไม่มี"}`,
        }),
      );
    });
  }

  /* ---------------- R3 คณิตเครดิต ---------------- */
  function creditMath(cuts, out, tol) {
    cuts.forEach((k) => {
      if (!k.before && !k.after) return;
      const expect = round2(k.before - k.amount);
      if (Math.abs(expect - k.after) > tol) {
        out.push(
          mk("credit_math", {
            ...k,
            riskAmount: round2(Math.abs(expect - k.after)),
            systemAmount: k.after,
            bankAmount: expect,
            amountDiff: round2(k.after - expect),
            detail: `เครดิตก่อน ${k.before} − ตัด ${k.amount} ควรเหลือ ${expect} แต่ระบบบันทึก ${k.after}`,
          }),
        );
      }
    });
  }

  /* ---------------- R4 คณิตโบนัส ---------------- */
  function bonusMath(bonuses, out, tol) {
    bonuses.forEach((b) => {
      const expect = round2(b.before + b.credit + b.bonus);
      if (Math.abs(expect - b.after) > tol) {
        out.push(
          mk("bonus_math", {
            ...b,
            riskAmount: round2(Math.abs(expect - b.after)),
            systemAmount: b.after,
            bankAmount: expect,
            amountDiff: round2(b.after - expect),
            detail: `ยอดก่อน ${b.before} + เครดิต ${b.credit} + โบนัส ${b.bonus} ควรได้ ${expect} แต่ระบบบันทึก ${b.after} (${b.promo || "-"})`,
          }),
        );
      }
    });
  }

  /* ---------------- R5 ข้ามวัน ---------------- */
  function crossDay(records, out) {
    records.forEach((r) => {
      if (!r.crossDay) return;
      out.push(
        mk("cross_day", {
          ...r,
          riskAmount: 0,
          systemAmount: r.amount,
          bankAmount: r.amount,
          direction: r.direction === "withdraw" ? "ถอน" : "ฝาก",
          detail: `ระบบบันทึก ${r.boDate} ${hhmmss(r.boSec)} แต่ธนาคารบันทึก ${r.date} ${hhmmss(r.sec)} — ต้องตรวจร่วมกับไฟล์วันถัดไป`,
        }),
      );
    });
  }

  /* ---------------- R6 รายการซ้ำ ---------------- */
  const isManual = (r) => r.manual === true || /มือ|manual/i.test(String(r.via || "") + " " + String(r.channel || ""));

  function duplicates(records, out, windowSec) {
    const seen = new Map();
    /* นับเฉพาะรายการที่คนกดเอง (เติมมือ/ถอนมือ/manual) — auto ที่ลูกค้าฝากซ้ำเป็นเรื่องปกติ */
    records.filter(isManual).forEach((r) => {
      const k = [r.date, r.account, r.amount.toFixed(2), r.direction, r.memberCode || r.custAccount || ""].join("|");
      const prev = seen.get(k);
      if (prev && r.date === prev.date && Math.abs(r.boSec - prev.boSec) <= windowSec && r.ref !== prev.ref) {
        out.push(
          mk("duplicate", {
            ...r,
            riskAmount: r.amount,
            systemAmount: r.amount,
            direction: r.direction === "withdraw" ? "ถอน" : "ฝาก",
            detail: `ยอด ${r.amount.toLocaleString()} บาท บัญชี ${r.account} สมาชิก ${r.memberCode || "-"} เกิด 2 ครั้งห่างกัน ${Math.abs(r.boSec - prev.boSec)} วินาที`,
            boRaw: prev.raw + "  ||  " + r.raw,
          }),
        );
      }
      seen.set(k, r);
    });
  }

  /* ---------------- R7 ยอดใหญ่ ---------------- */
  function largeAmount(records, out, threshold, withdrawOnly) {
    if (!threshold) return;
    records.forEach((r) => {
      if (r.amount < threshold) return;
      if (withdrawOnly && r.direction !== "withdraw") return;
      out.push(
        mk("large_amount", {
          ...r,
          riskAmount: r.amount,
          systemAmount: r.amount,
          direction: r.direction === "withdraw" ? "ถอน" : "ฝาก",
          detail: `ยอด ${r.amount.toLocaleString()} บาท เกินเกณฑ์ ${threshold.toLocaleString()} บาท — ต้องแนบเอกสารอนุมัติ`,
        }),
      );
    });
  }

  /* ---------------- entry ---------------- */
  function run(parsed, settings) {
    const opt = Object.assign({ amountTolerance: 1, dupWindowSec: 300, largeThreshold: 100000, largeWithdrawOnly: true }, (settings && settings.businessRules) || {});
    const out = [];
    const comms = [];
    const cuts = [];
    const bonuses = [];
    const records = [];

    parsed.forEach((p) => {
      if (!p) return;
      (p.aux || []).forEach((a) => {
        if (a.kind === "comm") comms.push(a);
        else if (a.kind === "creditout") cuts.push(a);
        else if (a.kind === "bonus") bonuses.push(a);
      });
      (p.records || []).forEach((r) => records.push(r));
    });
    /* ยุบรายการที่ปรากฏซ้ำในหลายรายงาน (UUID เดียวกัน) ก่อนตรวจกฎ */
    const merged = typeof Formats !== "undefined" ? Formats.merge(records) : records;
    merged.sort((a, b) => (a.boSec || 0) - (b.boSec || 0));
    records.length = 0;
    merged.forEach((r) => records.push(r));

    commissionChecks(comms, cuts, out, opt.amountTolerance);
    creditMath(cuts, out, opt.amountTolerance);
    bonusMath(bonuses, out, opt.amountTolerance);
    crossDay(records, out);
    duplicates(records, out, opt.dupWindowSec);
    largeAmount(records, out, opt.largeThreshold, opt.largeWithdrawOnly);

    out.sort((a, b) => a.sortSec - b.sortSec);
    return {
      exceptions: out,
      counts: { comm: comms.length, creditOut: cuts.length, bonus: bonuses.length, bo: records.length },
    };
  }

  return { run, NAME, SEV, CAUSE };
})();

if (typeof window !== "undefined") window.Rules = Rules;
