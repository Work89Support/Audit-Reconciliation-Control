/* =============================================================
   Sample data generator
   สร้างไฟล์ STM / BO / PM ตัวอย่างที่มีลักษณะเหมือนไฟล์จริง
   (ยอดยกมา, รอบวันที่, X1/X2/XB, วันที่ปน, รายการซ้ำ, ขาดฝั่ง)
   ใช้ทั้งเพื่อดาวน์โหลดไปทดสอบ import และเพื่อทดสอบ performance
   ============================================================= */

const Sample = (() => {
  function rngFrom(seed) {
    let a = seed;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pad = (n) => String(n).padStart(2, "0");
  const hhmmss = (sec) => `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`;
  const thDate = (iso) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };
  const amt = (n) => n.toFixed(2);

  const ACCOUNTS = [
    { id: "SCB-2048", bank: "SCB", company: "SYS123", direction: "deposit" },
    { id: "SCB-3391", bank: "SCB", company: "SYS123", direction: "withdraw" },
    { id: "KBANK-7711", bank: "KBANK", company: "SYS123", direction: "deposit" },
    { id: "KBANK-7712", bank: "KBANK", company: "SYS123", direction: "withdraw" },
    { id: "GSB-5520", bank: "GSB", company: "SYS123", direction: "deposit" },
    { id: "BBL-1180", bank: "BBL", company: "SYS123", direction: "withdraw" },
  ];
  const PM_ACCOUNTS = [
    { id: "AP-PM-01", bank: "SCB", company: "AUTOPEER", direction: "deposit" },
    { id: "AZ-PM-01", bank: "SCB", company: "AZPAY", direction: "deposit" },
    { id: "CY-PM-01", bank: "GSB", company: "CYBERPLUS", direction: "withdraw" },
  ];
  const USERS = ["user_morning_01", "user_morning_03", "user_morning_07", "user_mid_01", "user_mid_04", "user_night_02", "user_night_05", "user_night_08"];

  /* ---------- ground truth + การใส่ข้อบกพร่องแบบตั้งใจ ---------- */
  function buildScenario(date, count, seed = 99001, accounts = ACCOUNTS) {
    const rnd = rngFrom(seed);
    const stm = []; // แถวฝั่งธนาคาร
    const bo = []; // แถวฝั่งระบบหลังบ้าน
    const expected = {
      total: count,
      missing_bo: 0,
      missing_stm: 0,
      amount_diff: 0,
      time_diff: 0,
      duplicate: 0,
      wrong_bank: 0,
      cross_day: 0,
    };

    for (let i = 0; i < count; i++) {
      const acc = accounts[Math.floor(rnd() * accounts.length)];
      const crossDay = rnd() < 0.012;
      const sec = crossDay ? 82800 + Math.floor(rnd() * 3599) : Math.floor(rnd() * 86400);
      const amount = Math.round(([100, 300, 500, 740, 1000, 2450, 5000, 12000, 25000][Math.floor(rnd() * 9)] + rnd() * 99) * 100) / 100;
      const user = USERS[Math.floor(rnd() * USERS.length)];
      const ref = `TX${String(i).padStart(7, "0")}`;

      let stmRow = { sec, amount, acc, ref, user };
      let boRow = { sec, amount, acc, ref, user, bank: acc.bank };
      let skipStm = false;
      let skipBo = false;
      let dupBo = false;

      const d = rnd();
      if (d < 0.0075) {
        skipBo = true;
        expected.missing_bo++;
      } else if (d < 0.014) {
        skipStm = true;
        expected.missing_stm++;
      } else if (d < 0.02) {
        boRow = { ...boRow, amount: Math.round((amount / (rnd() > 0.5 ? 10 : 1) - 10 - rnd() * 500) * 100) / 100 };
        expected.amount_diff++;
      } else if (d < 0.028) {
        boRow = { ...boRow, sec: (sec + 120 + Math.floor(rnd() * 500)) % 86400 };
        expected.time_diff++;
      } else if (d < 0.032) {
        dupBo = true;
        expected.duplicate++;
      } else if (d < 0.036) {
        boRow = { ...boRow, bank: acc.bank === "SCB" ? "KBANK" : "SCB" };
        expected.wrong_bank++;
      }
      if (crossDay) expected.cross_day++;

      if (!skipStm) stm.push(stmRow);
      if (!skipBo) {
        bo.push(boRow);
        if (dupBo) bo.push({ ...boRow, ref: boRow.ref + "-D", sec: (boRow.sec + 5) % 86400 });
      }
    }
    stm.sort((a, b) => a.sec - b.sec);
    bo.sort((a, b) => a.sec - b.sec);
    return { date, stm, bo, expected };
  }

  /* ---------- ตัวสร้าง CSV รายรูปแบบ ---------- */

  function stmSCB(scn, accountFilter) {
    const rows = scn.stm.filter((r) => r.acc.bank === "SCB" && (!accountFilter || r.acc.id === accountFilter));
    let bal = 1250000;
    const out = ["วันที่,เวลา,รายการ,ช่องทาง,ถอนเงิน,ฝากเงิน,ยอดคงเหลือ,เลขที่บัญชี"];
    out.push(`${thDate(scn.date)},,ยอดยกมา,,,,${amt(bal)},`);
    rows.forEach((r, i) => {
      const isDeposit = r.acc.direction === "deposit";
      bal += isDeposit ? r.amount : -r.amount;
      const marker = i % 97 === 96 ? "XB" : isDeposit ? "X1" : "X2";
      out.push(
        [thDate(scn.date), hhmmss(r.sec), marker, "MOBILE", isDeposit ? "" : amt(r.amount), isDeposit ? amt(r.amount) : "", amt(bal), r.acc.id].join(","),
      );
    });
    return out.join("\r\n");
  }

  function stmKBANK(scn) {
    const rows = scn.stm.filter((r) => r.acc.bank === "KBANK");
    let bal = 880000;
    const out = ["วันที่,เวลา,รายละเอียด,ถอน,ฝาก,คงเหลือ,เลขที่บัญชี"];
    out.push(`${thDate(scn.date)},00:00:00,ยอดยกมา,,,${amt(bal)},`);
    rows.forEach((r) => {
      const isDeposit = r.acc.direction === "deposit";
      bal += isDeposit ? r.amount : -r.amount;
      out.push(
        [thDate(scn.date), hhmmss(r.sec), isDeposit ? "รับโอนเงิน" : "โอนเงินออก", isDeposit ? "" : amt(r.amount), isDeposit ? amt(r.amount) : "", amt(bal), r.acc.id].join(","),
      );
    });
    out.push(`${thDate(scn.date)},23:59:59,ยอดยกมา,,,${amt(bal)},`);
    return out.join("\r\n");
  }

  function stmGSB(scn) {
    const rows = scn.stm.filter((r) => r.acc.bank === "GSB");
    let bal = 640000;
    const out = ["วันที่,เวลา,รายการ,ถอน,ฝาก,ยอดคงเหลือ,เลขที่บัญชี"];
    out.push(`รอบวันที่ ${thDate(scn.date)},,,,,,`);
    rows.forEach((r, i) => {
      const isDeposit = r.acc.direction === "deposit";
      bal += isDeposit ? r.amount : -r.amount;
      const desc = isDeposit ? (i % 3 === 0 ? "MyMo Transfer from SAV" : "Transfer SAV Deposit") : "MyMo SAV Withdraw";
      out.push([thDate(scn.date), hhmmss(r.sec), desc, isDeposit ? "" : amt(r.amount), isDeposit ? amt(r.amount) : "", amt(bal), r.acc.id].join(","));
      if (i > 0 && i % 250 === 0) out.push(`รอบวันที่ ${thDate(scn.date)},,,,,,`);
    });
    return out.join("\r\n");
  }

  function stmBBL(scn) {
    const rows = scn.stm.filter((r) => r.acc.bank === "BBL");
    let bal = 420000;
    const out = ["วันที่,เวลา,รายการ,ถอน,ฝาก,ยอดคงเหลือ,เลขที่บัญชี"];
    rows.forEach((r) => {
      const isDeposit = r.acc.direction === "deposit";
      bal += isDeposit ? r.amount : -r.amount;
      out.push([thDate(scn.date), hhmmss(r.sec), isDeposit ? "รับโอนเงิน" : "โอนเงินออก", isDeposit ? "" : amt(r.amount), isDeposit ? amt(r.amount) : "", amt(bal), r.acc.id].join(","));
    });
    return out.join("\r\n");
  }

  function boCSV(scn, direction) {
    const rows = scn.bo.filter((r) => (direction ? r.acc.direction === direction : true));
    const out = ["transaction_id,datetime,company,username,bank,account,amount,direction,status"];
    rows.forEach((r) => {
      out.push(
        [r.ref, `${scn.date} ${hhmmss(r.sec)}`, r.acc.company, r.user, r.bank, r.acc.id, amt(r.amount), r.acc.direction === "deposit" ? "DEPOSIT" : "WITHDRAW", "SUCCESS"].join(","),
      );
    });
    return out.join("\r\n");
  }

  /* PM: ฝั่งผู้ให้บริการ มีรายการไม่สำเร็จและวันที่อื่นปนมา */
  function pmCSV(scn, company) {
    const rnd = rngFrom(4242 + company.length);
    const rows = scn.stm.filter((r) => r.acc.company === company);
    const out = ["datetime,merchant,ref,amount,status,account"];
    const prevDate = shiftDate(scn.date, -1);
    rows.forEach((r, i) => {
      out.push([`${scn.date} ${hhmmss(r.sec)}`, company, r.ref, amt(r.amount), "SUCCESS", r.acc.id].join(","));
      // รายการที่ไม่สำเร็จ และรายการของวันก่อนหน้าที่ปนมาในไฟล์เดียวกัน
      if (rnd() < 0.09) out.push([`${scn.date} ${hhmmss((r.sec + 37) % 86400)}`, company, `F${String(i).padStart(6, "0")}`, amt(r.amount), "FAILED", r.acc.id].join(","));
      if (rnd() < 0.06) out.push([`${prevDate} ${hhmmss((r.sec + 61) % 86400)}`, company, `O${String(i).padStart(6, "0")}`, amt(r.amount), "SUCCESS", r.acc.id].join(","));
    });
    return out.join("\r\n");
  }

  function shiftDate(iso, days) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + days));
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  }

  /* ---------- ชุดไฟล์ที่ดาวน์โหลดได้ ---------- */
  function buildFileSet(date, count) {
    const scn = buildScenario(date, count);
    const pmScn = buildScenario(date, Math.round(count / 4), 55501, PM_ACCOUNTS);
    return {
      scenario: scn,
      pmScenario: pmScn,
      files: [
        { name: `STM_SCB_${date}.csv`, kind: "STM ธนาคาร (SCB)", content: stmSCB(scn), note: "มีบรรทัดยอดยกมา และ marker X1/X2/XB" },
        { name: `STM_KBANK_${date}.csv`, kind: "STM ธนาคาร (KBANK)", content: stmKBANK(scn), note: "มียอดยกมาทั้งหัวและท้ายไฟล์" },
        { name: `STM_GSB_${date}.csv`, kind: "STM ธนาคาร (GSB)", content: stmGSB(scn), note: 'มีบรรทัด "รอบวันที่" คั่นเป็นระยะ' },
        { name: `STM_BBL_${date}.csv`, kind: "STM ธนาคาร (BBL)", content: stmBBL(scn), note: "รูปแบบมาตรฐาน ไม่มีบรรทัดขยะ" },
        { name: `BO_DEPOSIT_${date}.csv`, kind: "รายงาน BO ฝาก", content: boCSV(scn, "deposit"), note: "ฝั่งระบบหลังบ้าน เฉพาะรายการฝาก" },
        { name: `BO_WITHDRAW_${date}.csv`, kind: "รายงาน BO ถอน", content: boCSV(scn, "withdraw"), note: "ฝั่งระบบหลังบ้าน เฉพาะรายการถอน" },
        { name: `PM_AUTOPEER_${date}.csv`, kind: "STM PM (AUTOPEER)", content: pmCSV(pmScn, "AUTOPEER"), note: "มีรายการ FAILED และวันที่ของวันก่อนหน้าปนมา" },
        { name: `PM_AZPAY_${date}.csv`, kind: "STM PM (AZPAY)", content: pmCSV(pmScn, "AZPAY"), note: "ฝาก-ถอนอยู่ในบัญชีเดียวกัน" },
        { name: `PM_CYBERPLUS_${date}.csv`, kind: "STM PM (Cyberplus)", content: pmCSV(pmScn, "CYBERPLUS"), note: "ต้องแนบไฟล์ชี้แจงยอดถอนทุกวัน" },
        { name: `BO_PM_${date}.csv`, kind: "รายงาน BO ฝั่ง PM", content: boCSV(pmScn, null), note: "ฝั่งระบบหลังบ้านของบัญชี PM ทั้ง 3 บริษัท" },
      ],
    };
  }

  return { buildScenario, buildFileSet, ACCOUNTS, PM_ACCOUNTS, USERS, hhmmss, shiftDate };
})();
