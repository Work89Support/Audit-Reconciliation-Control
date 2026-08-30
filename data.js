/* =============================================================
   Audit AI Reconciliation - Mock data layer
   ผลิตข้อมูลจำลองแบบ deterministic (seeded) เพื่อให้ทุกครั้งที่เปิด
   หน้าจอได้ตัวเลขชุดเดียวกัน และทุกหน้าจออ้างอิงข้อมูลชุดเดียวกัน
   ============================================================= */

const DB = (() => {
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20260801);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));
  const pad = (n) => String(n).padStart(2, "0");

  const BUSINESS_DATE = "2026-08-01";

  /* ---------- master data ---------- */

  /* system: บริษัทนี้อยู่ระบบไหน — XB ส่งชี้แจงทุกวัน, SYS123 รวบเป็นรอบ
     ตั้งค่าได้เองในหน้า "งานชี้แจง" ไม่ต้องแก้โค้ดเวลาเพิ่มบริษัทใหม่ */
  /* มิติบริษัท = บริษัทย่อย (subco) ตามทะเบียนบัญชีจริง */
  const companies = [
    { code: "3XB", name: "3XB", type: "main", system: null },
    { code: "FR8", name: "FR8", type: "main", system: null },
    { code: "AT4", name: "AT4", type: "main", system: null },
    { code: "SK8", name: "SK8", type: "main", system: null },
    { code: "MR9", name: "MR9", type: "main", system: null },
    { code: "MC8", name: "MC8", type: "main", system: null },
    { code: "UR9", name: "UR9", type: "main", system: null },
    { code: "PS8", name: "PS8", type: "main", system: null },
    { code: "7M", name: "7M", type: "main", system: null },
  ];

  const banks = [
    { code: "SCB", name: "ไทยพาณิชย์", rule: "X1 = รับเงิน, X2 = โอนเงิน, XB = ปรับปรุงยอด" },
    { code: "KBANK", name: "กสิกรไทย", rule: 'กรอง "ยอดยกมา" ก่อนจัดเรียง ตรวจ 00:00-23:59' },
    { code: "GSB", name: "ออมสิน", rule: 'กรอง "รอบวันที่" / Transfer SAV Deposit = รับเงิน' },
    { code: "BBL", name: "กรุงเทพ", rule: "ใช้กฎมาตรฐาน จับคู่ตาม account + time + amount" },
    { code: "KTB", name: "กรุงไทย", rule: "ใช้กฎมาตรฐาน ตรวจ balance ต่อเนื่อง" },
  ];

  const accounts = [
    { id: "SCB-2048", bank: "SCB", company: "3XB", type: "deposit", active: true },
    { id: "SCB-3391", bank: "SCB", company: "FR8", type: "withdraw", active: true },
    { id: "KBANK-7711", bank: "KBANK", company: "AT4", type: "deposit", active: true },
    { id: "KBANK-7712", bank: "KBANK", company: "SK8", type: "withdraw", active: true },
    { id: "GSB-5520", bank: "GSB", company: "MR9", type: "deposit", active: true },
    { id: "BBL-1180", bank: "BBL", company: "MC8", type: "withdraw", active: true },
    { id: "KTB-9042", bank: "KTB", company: "UR9", type: "deposit", active: false },
    { id: "AP-PM-01", bank: "SCB", company: "PS8", type: "pm", active: true },
    { id: "AP-PM-02", bank: "KBANK", company: "7M", type: "pm", active: true },
    { id: "AZ-PM-01", bank: "SCB", company: "3XB", type: "pm", active: true },
    { id: "CY-PM-01", bank: "GSB", company: "FR8", type: "pm", active: true },
    { id: "CY-PM-02", bank: "BBL", company: "AT4", type: "pm", active: true },
  ];

  const shifts = [
    { code: "morning", name: "กะเช้า", range: "08:00-16:00", from: 8, to: 16 },
    { code: "afternoon", name: "กะบ่าย", range: "16:00-24:00", from: 16, to: 24 },
    { code: "night", name: "กะดึก", range: "00:00-08:00", from: 0, to: 8 },
  ];

  const roles = {
    monitor: {
      name: "เจ้าหน้าที่ Audit",
      desc: "ตรวจไฟล์และรายการ ใส่หมายเหตุ และส่งให้บริษัทชี้แจง",
      can: ["view", "note", "status", "request_clarify", "export"],
    },
    lead: {
      name: "Audit Lead",
      desc: "ตรวจทาน อนุมัติ ปิดเคส ปิดรอบความเสียหาย",
      can: ["view", "note", "status", "request_clarify", "approve", "close_case", "close_cycle", "export", "rules"],
    },
    shift_lead: {
      name: "ผู้ชี้แจงบริษัท",
      desc: "เห็นเฉพาะบริษัทที่รับผิดชอบ ตอบชี้แจงและแนบหลักฐาน",
      can: ["view", "respond", "attach"],
    },
    exec: { name: "ผู้บริหาร / การเงิน", desc: "อ่านภาพรวมและรายงานโดยแก้ข้อมูลไม่ได้", can: ["view", "export"] },
    admin: {
      name: "ผู้ดูแลระบบ",
      desc: "เห็นทุกหน้าและทุกบริษัท ช่วยทำงานได้ทุกขั้นตอน รวมจัดการผู้ใช้ โดยไม่มีสิทธิ์ลบหลักฐานถาวร",
      can: ["view", "note", "status", "request_clarify", "respond", "attach", "approve", "close_case", "close_cycle", "rules", "users", "settings", "export"],
    },
  };

  const users = [
    { username: "audit_som", name: "สมชาย ว.", role: "monitor", shift: "morning" },
    { username: "audit_nan", name: "นันทิดา ก.", role: "monitor", shift: "night" },
    { username: "audit_lead_01", name: "ปิยะ ธ.", role: "lead", shift: "morning" },
    { username: "shift_morning_01", name: "กิตติ ส.", role: "shift_lead", shift: "morning" },
    { username: "shift_after_01", name: "วราภรณ์ พ.", role: "shift_lead", shift: "afternoon" },
    { username: "shift_night_01", name: "ธนกร ม.", role: "shift_lead", shift: "night" },
    { username: "exec_fin_01", name: "ผู้บริหารการเงิน", role: "exec", shift: "morning" },
    { username: "sysadmin", name: "ทีมระบบ", role: "admin", shift: "morning" },
  ];

  const employees = [
    { username: "user_morning_01", shift: "morning" },
    { username: "user_morning_03", shift: "morning" },
    { username: "user_morning_07", shift: "morning" },
    { username: "user_mid_01", shift: "afternoon" },
    { username: "user_mid_04", shift: "afternoon" },
    { username: "user_night_02", shift: "night" },
    { username: "user_night_05", shift: "night" },
    { username: "user_night_08", shift: "night" },
  ];

  /* ---------- exception taxonomy ---------- */

  const exceptionTypes = [
    { code: "time_diff", name: "เวลาเกิน tolerance", baseSeverity: "low", weight: 22 },
    { code: "missing_bo", name: "STM มากกว่า BO", baseSeverity: "high", weight: 16 },
    { code: "missing_stm", name: "BO มากกว่า STM", baseSeverity: "high", weight: 14 },
    { code: "amount_diff", name: "ยอดเงินไม่ตรง", baseSeverity: "critical", weight: 12 },
    { code: "cross_day", name: "รายการข้ามวัน 23:00-23:59", baseSeverity: "medium", weight: 9 },
    { code: "backdated", name: "เติมย้อนหลัง", baseSeverity: "high", weight: 7 },
    { code: "wrong_bank", name: "เลือกธนาคารผิด", baseSeverity: "medium", weight: 6 },
    { code: "wrong_account", name: "ลูกค้าฝากผิดบัญชี", baseSeverity: "medium", weight: 6 },
    { code: "duplicate", name: "เติมซ้ำ / รายการซ้ำ", baseSeverity: "critical", weight: 5 },
    { code: "unexplained_out", name: "ยอดโอนออกไม่มีชี้แจง", baseSeverity: "critical", weight: 3 },
  ];
  const typeWeightTotal = exceptionTypes.reduce((a, c) => a + c.weight, 0);
  const pickType = () => {
    let r = rnd() * typeWeightTotal;
    for (const t of exceptionTypes) {
      r -= t.weight;
      if (r <= 0) return t;
    }
    return exceptionTypes[0];
  };

  const severities = [
    { code: "critical", name: "Critical", sla: 4, desc: "มีโอกาสเสียหายทางการเงินจริง" },
    { code: "high", name: "High", sla: 8, desc: "หัวหน้ากะต้องชี้แจงภายในวันเดียวกัน" },
    { code: "medium", name: "Medium", sla: 48, desc: "รอหลักฐานได้ 2-3 วัน" },
    { code: "low", name: "Low", sla: 72, desc: "known issue หรือ timing diff" },
  ];

  const statuses = [
    { code: "open", name: "รอตรวจ", tone: "amber" },
    { code: "clarifying", name: "รอชี้แจง", tone: "blue" },
    { code: "answered", name: "ชี้แจงแล้ว", tone: "violet" },
    { code: "approved", name: "อนุมัติแล้ว", tone: "green" },
    { code: "closed", name: "ปิดเคส", tone: "grey" },
    { code: "damage", name: "เป็นความเสียหาย", tone: "red" },
  ];

  const causes = [
    "คีย์ยอดผิดจากต้นฉบับ",
    "auto ไม่เข้า แล้วทำ manual ซ้ำ",
    "ลูกค้าโอนเข้าบัญชีที่เลิกใช้",
    "เลือกธนาคารผิดตอนกดอนุมัติ",
    "รายการค้างข้ามวันจากธนาคาร",
    "หลักฐานสลิปไม่ตรงกับยอดจริง",
    "ระบบ PM ส่งวันที่ปนมาใน STM",
  ];

  /* ---------- transactions summary per hour ---------- */
  /* exception ต่อชั่วโมงจะถูกคำนวณใหม่จาก exception จริงด้านล่าง เพื่อให้ทุกหน้าจอเห็นตัวเลขชุดเดียวกัน */

  const hourly = [];
  for (let h = 0; h < 24; h++) {
    const base = h >= 18 || h < 2 ? int(9000, 13000) : h >= 8 && h < 18 ? int(6000, 9500) : int(3000, 6000);
    hourly.push({ hour: h, label: pad(h) + ":00", total: base, exception: 0, matched: base });
  }

  const shiftOf = (h) => (h >= 8 && h < 16 ? "morning" : h >= 16 ? "afternoon" : "night");

  /* ---------- exceptions ---------- */

  const exceptions = [];
  const EX_COUNT = 168;
  for (let i = 0; i < EX_COUNT; i++) {
    const t = pickType();
    const acc = pick(accounts.filter((a) => a.active));
    const h = t.code === "cross_day" ? 23 : int(0, 23);
    const m = int(0, 59);
    const s = int(0, 59);
    const emp = pick(employees.filter((e) => e.shift === shiftOf(h))) || pick(employees);
    const base = [100, 300, 500, 740, 1000, 2450, 5000, 12000, 25000][int(0, 8)] + int(0, 99);
    let sysAmount = base; // ฝั่ง BO
    let bankAmount = base; // ฝั่ง STM
    let timeDiff = int(0, 40);
    if (t.code === "amount_diff") bankAmount = Math.round(base / (rnd() > 0.5 ? 10 : 1) - int(10, 900));
    if (t.code === "missing_bo") sysAmount = null; // STM มี แต่ BO ไม่มี
    if (t.code === "missing_stm") bankAmount = null; // BO มี แต่ STM ไม่มี
    if (t.code === "time_diff") timeDiff = int(95, 640);
    if (t.code === "cross_day") timeDiff = int(40, 120);

    // ยอดที่ต้องตรวจสอบ / อาจกลายเป็นความเสียหาย
    const riskAmount =
      t.code === "amount_diff"
        ? Math.abs(sysAmount - bankAmount)
        : t.code === "time_diff" || t.code === "cross_day"
          ? 0
          : base;

    let severity = t.baseSeverity;
    if (severity !== "critical" && riskAmount > 10000) severity = "critical";
    if (severity === "low" && timeDiff > 400) severity = "medium";

    const r = rnd();
    let status = "open";
    if (r > 0.86 && riskAmount > 0) status = "damage";
    else if (r > 0.86) status = "closed";
    else if (r > 0.7) status = "closed";
    else if (r > 0.56) status = "approved";
    else if (r > 0.38) status = "answered";
    else if (r > 0.18) status = "clarifying";

    // เวลาฝั่ง BO = เวลาฝั่ง STM บวกผลต่างเวลา (คำนวณให้เป็นเวลาที่ถูกต้องเสมอ)
    const totalSec = (h * 3600 + m * 60 + s + timeDiff) % 86400;
    const boTime = `${pad(Math.floor(totalSec / 3600))}:${pad(Math.floor((totalSec % 3600) / 60))}:${pad(totalSec % 60)}`;

    const slaHours = severities.find((x) => x.code === severity).sla;
    const ageHours = 1 + Math.round(Math.pow(rnd(), 2.2) * 88);

    exceptions.push({
      id: "EX-" + String(2601 + i),
      date: BUSINESS_DATE,
      time: `${pad(h)}:${pad(m)}:${pad(s)}`,
      hour: h,
      company: acc.company,
      bank: acc.bank,
      account: acc.id,
      direction: acc.type === "withdraw" ? "ถอน" : acc.type === "pm" ? "PM" : "ฝาก",
      systemAmount: sysAmount,
      bankAmount,
      amountDiff: sysAmount === null || bankAmount === null ? 0 : sysAmount - bankAmount,
      riskAmount,
      timeDiffSec: timeDiff,
      type: t.code,
      typeName: t.name,
      severity,
      status,
      shift: shiftOf(h),
      employee: emp.username,
      assignee: pick(users.filter((u) => u.role === "monitor")).username,
      cause: pick(causes),
      ageHours,
      slaHours,
      overSla: ageHours > slaHours && !["closed", "approved"].includes(status),
      /* สายชี้แจงมาจากระบบต้นทางของบริษัท (XB/123) — แอปเติมให้ตอนโหลด */
      track: null,
      hasEvidence: rnd() > 0.42,
      stmRaw:
        bankAmount === null
          ? "— ไม่พบรายการฝั่ง STM ในช่วงเวลาที่ตรวจ —"
          : `${pad(h)}:${pad(m)}:${pad(s)} | ${acc.bank} | ${acc.id} | ${bankAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} | ${acc.bank === "SCB" ? "X1" : acc.bank === "GSB" ? "Transfer SAV Deposit" : "รับโอนเงิน"}`,
      boTime,
      boRaw:
        sysAmount === null
          ? "— ไม่พบรายการฝั่ง BO ในช่วงเวลาที่ตรวจ —"
          : `${boTime} | ${acc.company} | ${emp.username} | ${sysAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} | ${acc.type === "withdraw" ? "WITHDRAW" : "DEPOSIT"}`,
      notes: [],
      evidence: [],
    });
  }

  /* คำนวณ exception ต่อชั่วโมงจากรายการจริง เพื่อให้ dashboard ตรงกับ exception queue */
  exceptions.forEach((e) => {
    hourly[e.hour].exception += 1;
  });
  hourly.forEach((x) => (x.matched = x.total - x.exception));

  /* ---------- intake files ---------- */

  const fileTypes = [
    "STM ฝาก",
    "STM ถอน",
    "BO ฝาก",
    "BO ถอน",
    "ไฟล์แก้ไขฝากมือ",
    "ไฟล์แก้ไขถอนมือ",
    "ไฟล์ค่าคอมมิชชั่น",
    "ไฟล์ชี้แจงประจำวัน",
  ];
  const files = [];
  companies.forEach((c) => {
    fileTypes.forEach((ft) => {
      if (c.type === "pm" && ["ไฟล์ค่าคอมมิชชั่น", "ไฟล์แก้ไขฝากมือ", "ไฟล์แก้ไขถอนมือ"].includes(ft)) return;
      const r = rnd();
      let status = "received";
      if (r > 0.93) status = "missing";
      else if (r > 0.9) status = "wrong_company";
      else if (r > 0.84) status = "late";
      const smallFile = ft === "ไฟล์ชี้แจงประจำวัน" || ft === "ไฟล์ค่าคอมมิชชั่น";
      files.push({
        id: `${c.code}-${ft}`,
        company: c.code,
        companyName: c.name,
        fileType: ft,
        status,
        rows: status === "missing" ? 0 : smallFile ? int(3, 60) : int(400, 24000),
        receivedAt: status === "missing" ? "-" : `${pad(int(6, 10))}:${pad(int(0, 59))}`,
        sender: pick(users.filter((u) => u.role === "shift_lead")).username,
        checksum: Math.floor(rnd() * 0xffffffff).toString(16).padStart(8, "0"),
      });
    });
  });

  /* ---------- damage records ---------- */
  /* รอบสรุปความเสียหาย — ตรงกับรอบตีไฟล์ของระบบ 123 */
  const damageCycles = [
    { code: "C1", name: "รอบ 1 (1-15)", status: "open" },
    { code: "C2", name: "รอบ 2 (16-25)", status: "closed" },
    { code: "C3", name: "รอบ 3 (26-สิ้นเดือน)", status: "closed" },
  ];

  /* ---- 2 ระบบที่แผนกตรวจ ----
     XB     : ตรวจเสร็จส่งหัวหน้ากะทุกวันภายใน 17:00 — ทุกเคส ไม่ดูความรุนแรง
     SYS123 : ออดิท 1/2/3 รวบเป็นรอบ 1-15 / 16-25 / 26-สิ้นเดือน แล้วตีไฟล์ให้ชี้แจง */
  const systems = [
    {
      code: "XB",
      name: "ระบบ XB — ส่งหัวหน้ากะทุกวัน",
      short: "XB (รายวัน)",
      track: "daily",
      desc: "ตรวจให้เสร็จภายในวัน ส่งรายการทั้งหมดให้หัวหน้ากะภายในเวลาที่กำหนด จากนั้นหัวหน้ากะทำไฟล์ชี้แจงกลับมา — ส่งทุกเคสไม่ว่าจะรุนแรงแค่ไหน",
      owner: "หัวหน้ากะ",
      tone: "amber",
    },
    {
      code: "SYS123",
      name: "ระบบ 123 — ออดิท 1/2/3 ตีไฟล์เป็นรอบ",
      short: "123 (รายรอบ)",
      track: "cycle",
      desc: "ออดิทรวบรวมรายการเป็นรอบ 1-15 / 16-25 / 26-สิ้นเดือน แล้วตีไฟล์ให้ชี้แจง รอบละ 2-3 วัน ก่อนสรุปความเสียหาย",
      owner: "ออดิท 1 / 2 / 3",
      tone: "blue",
    },
  ];

  const damages = [];
  exceptions
    .filter((e) => e.status === "damage")
    .forEach((e, i) => {
      damages.push({
        id: "DMG-" + String(801 + i),
        exceptionId: e.id,
        date: e.date,
        company: e.company,
        employee: e.employee,
        shift: e.shift,
        amount: e.riskAmount || Math.abs(e.amountDiff),
        cause: e.cause,
        cycle: "C1",
        evidence: e.hasEvidence,
        hrStatus: e.hasEvidence ? "ส่งบุคคลแล้ว" : "รอหลักฐาน",
        financeStatus: e.hasEvidence ? "รอปิดรอบ" : "-",
      });
    });

  /* ประวัติความเสียหายของรอบที่ปิดไปแล้ว (ใช้เทียบรอบและทำรายงานย้อนหลัง) */
  ["C2", "C3"].forEach((cycle, ci) => {
    const n = 9 + ci * 3;
    for (let i = 0; i < n; i++) {
      const emp = pick(employees);
      damages.push({
        id: `DMG-${cycle}-${String(101 + i)}`,
        exceptionId: "-",
        date: cycle === "C2" ? "2026-07-" + pad(int(16, 25)) : "2026-07-" + pad(int(26, 31)),
        company: pick(companies).code,
        employee: emp.username,
        shift: emp.shift,
        amount: [500, 900, 1200, 2400, 5000, 12000, 25000][int(0, 6)] + int(0, 99),
        cause: pick(causes),
        cycle,
        evidence: true,
        hrStatus: "ปิดรอบแล้ว",
        financeStatus: "ส่งการเงินแล้ว",
      });
    }
  });

  /* ---------- monthly trend ---------- */

  const months = ["ก.ย.68", "ต.ค.68", "พ.ย.68", "ธ.ค.68", "ม.ค.69", "ก.พ.69", "มี.ค.69", "เม.ย.69", "พ.ค.69", "มิ.ย.69", "ก.ค.69", "ส.ค.69"];
  const monthYm = ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"];
  const monthlyTrend = months.map((m, i) => ({
    month: m,
    ym: monthYm[i],
    damage: Math.round(420000 - i * 21000 + (rnd() - 0.5) * 90000),
    prevented: Math.round(180000 + i * 16000 + (rnd() - 0.5) * 60000),
    cases: int(28, 96),
  }));

  /* ---------- audit log ---------- */

  const auditLog = [
    { at: "2026-08-01 08:04:12", user: "sysadmin", action: "import", entity: "source_file", target: "SYS123-STM ฝาก", detail: "นำเข้าไฟล์ 18,204 แถว checksum ตรง" },
    { at: "2026-08-01 08:20:45", user: "audit_som", action: "run_reconcile", entity: "match_run", target: "MR-20260801-01", detail: "3-point match 184,392 รายการ" },
    { at: "2026-08-01 09:15:02", user: "audit_som", action: "note", entity: "exception", target: "EX-2601", detail: "เพิ่ม note: ตรวจสลิปกับหัวหน้ากะเช้า" },
    { at: "2026-08-01 10:02:33", user: "shift_morning_01", action: "respond", entity: "clarification", target: "EX-2603", detail: "แนบหลักฐานสลิป 2 ไฟล์" },
    { at: "2026-08-01 11:40:10", user: "audit_lead_01", action: "approve", entity: "exception", target: "EX-2607", detail: "อนุมัติปิดเคส ระบุสาเหตุคีย์ยอดผิด" },
  ];

  /* ---------- settings ---------- */

  const settings = {
    toleranceDeposit: 90,
    toleranceWithdraw: 180,
    exactUniqueTolerance: 600,
    diffAlert: 1,
    slaEvidenceDays: 3,
    /* สายงานชี้แจง 2 แบบตามที่แผนกใช้จริง */
    clarify: {
      dailyCutoff: "17:00", // ตรวจเสร็จส่งหัวหน้ากะภายในเวลานี้ของทุกวัน
      dailyRespondHours: 24, // หัวหน้ากะทำไฟล์ชี้แจงกลับภายในกี่ชั่วโมง
      cycleRespondDays: 3, // แต่ละรอบให้เวลาชี้แจงกี่วันหลังปิดรอบ
    },
    rules: {
      crossDay: true,
      lockDelete: true,
      requireEvidence: true,
      notifyTelegram: false,
      pmSuccessOnly: true,
      filterCarryForward: true,
    },
    bankRules: [
      { bank: "SCB", enabled: true, detail: "X1 = รับเงิน, X2 = โอนเงิน, XB = ปรับปรุงยอด, ตรวจ 23:00-23:59 ร่วมวันถัดไป" },
      { bank: "KBANK", enabled: true, detail: 'กรอง "ยอดยกมา" ก่อนจัดเรียง, ตรวจเวลา 00:00-23:59' },
      { bank: "GSB", enabled: true, detail: 'กรอง "รอบวันที่", Transfer SAV Deposit / MyMo Transfer from SAV = รับเงิน, MyMo SAV Withdraw = โอนเงิน' },
      { bank: "BBL", enabled: true, detail: "ใช้กฎมาตรฐาน account + time + amount" },
      { bank: "KTB", enabled: false, detail: "ยังไม่เปิดใช้ รอ sample file" },
    ],
  };

  const pmAccounts = [
    { company: "AUTOPEER", note: "Success only, ต้องกรองวันที่ปน", match: 98.4, pending: 12 },
    { company: "AZPAY", note: "ฝาก-ถอนอยู่ในบัญชีเดียวกัน", match: 96.9, pending: 34 },
    { company: "CYBERPLUS", note: "ต้องแนบชี้แจงยอดถอนทุกวัน", match: 94.1, pending: 58 },
  ];

  return {
    BUSINESS_DATE,
    companies,
    banks,
    accounts,
    shifts,
    roles,
    users,
    employees,
    exceptionTypes,
    severities,
    statuses,
    hourly,
    exceptions,
    fileTypes,
    files,
    damageCycles,
    systems,
    damages,
    monthlyTrend,
    auditLog,
    settings,
    pmAccounts,
  };
})();
