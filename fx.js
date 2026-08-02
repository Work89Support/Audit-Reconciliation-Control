/* =============================================================
   Fx - บันทึกอัตราแลกเปลี่ยน USDT/THB ประจำวัน
   ระบบมีทั้งเงินบาทและ USDT (เช่น ถอนจาก Azpay เป็น USDT เข้าหลัก B10)
   ทุกยอดที่บันทึกเป็น USDT ต้องอ้างอิงเรตของ "วันนั้น" เสมอ
   จึงต้องเก็บ log ไว้ย้อนกลับได้ว่าใครกรอก เวลาไหน และเทียบกับเรตตลาดเท่าไร

   - กรอกเองเป็นหลัก (ค่าที่บริษัทใช้จริง = ค่าที่ถูกต้อง)
   - ดึงเรตตลาดจากเว็บมาแสดงข้างๆ ไว้เทียบเท่านั้น ไม่เขียนทับของที่กรอก
   - แก้ไขได้ แต่เก็บประวัติทุกครั้ง (revisions)
   ============================================================= */

const Fx = (() => {
  const QUOTE = "USDT";
  const BASE = "THB";

  /* ---------------- แหล่งเรตอ้างอิง ---------------- */
  const SOURCES = [
    {
      code: "bitkub",
      name: "Bitkub (USDT/THB)",
      note: "ราคาซื้อขายจริงในตลาดไทย",
      url: "https://api.bitkub.com/api/v3/market/ticker?sym=usdt_thb",
      pick: (j) => {
        const row = Array.isArray(j) ? j[0] : j;
        const v = row && (row.last ?? row.close ?? row.highest_bid);
        return v ? parseFloat(v) : null;
      },
    },
    {
      code: "erapi",
      name: "ExchangeRate API (USD/THB)",
      note: "อัตรากลางดอลลาร์ ใช้เทียบว่าเรต USDT ห่างจากดอลลาร์แค่ไหน",
      url: "https://open.er-api.com/v6/latest/USD",
      pick: (j) => (j && j.rates && j.rates.THB ? parseFloat(j.rates.THB) : null),
    },
    {
      code: "coingecko",
      name: "CoinGecko (USDT/THB)",
      note: "ราคาเฉลี่ยทั่วโลก",
      url: "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=thb",
      pick: (j) => (j && j.tether && j.tether.thb ? parseFloat(j.tether.thb) : null),
    },
  ];

  async function fetchOne(src, timeoutMs = 7000) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const res = await fetch(src.url, { signal: ctrl ? ctrl.signal : undefined, cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const rate = src.pick(await res.json());
      if (!rate || !Number.isFinite(rate)) throw new Error("อ่านค่าจากผลลัพธ์ไม่ได้");
      return { code: src.code, name: src.name, note: src.note, rate: Math.round(rate * 10000) / 10000, at: new Date().toISOString(), ok: true };
    } catch (e) {
      return { code: src.code, name: src.name, note: src.note, rate: null, at: new Date().toISOString(), ok: false, error: e.name === "AbortError" ? "หมดเวลารอ" : e.message };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /* ดึงทุกแหล่งพร้อมกัน — แหล่งไหนล่มก็ยังได้ที่เหลือ */
  function fetchReference() {
    return Promise.all(SOURCES.map((s) => fetchOne(s)));
  }

  /* ---------------- log ---------------- */
  const store = () => Store.data;
  const all = () => (store().fxRates || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));

  function rateOf(date) {
    return (store().fxRates || []).find((r) => r.date === date) || null;
  }

  /* เรตที่ใช้ได้จริง: ของวันนั้น ถ้าไม่มีให้ย้อนไปวันล่าสุดก่อนหน้า */
  function effectiveRate(date) {
    const exact = rateOf(date);
    if (exact) return { ...exact, exact: true };
    const prev = all().find((r) => r.date < date);
    return prev ? { ...prev, exact: false } : null;
  }

  function setRate(date, rate, opts = {}) {
    const value = Math.round(parseFloat(rate) * 10000) / 10000;
    if (!date || !Number.isFinite(value) || value <= 0) return { ok: false, error: "กรอกวันที่และอัตราให้ถูกต้อง" };
    if (value < 1 || value > 1000) return { ok: false, error: `อัตรา ${value} ดูผิดปกติ — ควรอยู่ระหว่าง 1 ถึง 1,000 บาทต่อ 1 ${QUOTE}` };

    if (!store().fxRates) store().fxRates = [];
    const list = store().fxRates;
    const idx = list.findIndex((r) => r.date === date);
    const now = new Date().toISOString();
    const entry = {
      date,
      quote: QUOTE,
      base: BASE,
      rate: value,
      by: opts.by || "-",
      at: now,
      note: opts.note || "",
      ref: opts.ref || null,
      revisions: [],
    };

    let action = "fx_set";
    let detail = `บันทึกอัตรา ${QUOTE} วันที่ ${date} = ${value} ${BASE}`;
    if (idx >= 0) {
      const old = list[idx];
      if (old.rate === value && (old.note || "") === entry.note) return { ok: true, unchanged: true, entry: old };
      entry.revisions = (old.revisions || []).concat([{ rate: old.rate, by: old.by, at: old.at, note: old.note || "" }]);
      list[idx] = entry;
      action = "fx_update";
      detail = `แก้อัตรา ${QUOTE} วันที่ ${date} จาก ${old.rate} เป็น ${value} ${BASE}`;
    } else {
      list.push(entry);
    }
    if (opts.log) opts.log(action, "fx_rate", date, detail + (entry.note ? ` · หมายเหตุ: ${entry.note}` : ""));
    Store.persist();
    return { ok: true, entry, action };
  }

  /* ---------------- แปลงสกุล ---------------- */
  function toTHB(amount, currency, date) {
    const n = Number(amount) || 0;
    if ((currency || BASE).toUpperCase() === BASE) return { value: n, rate: null, ok: true };
    const r = effectiveRate(date);
    if (!r) return { value: null, rate: null, ok: false, error: `ยังไม่ได้บันทึกอัตรา ${QUOTE} ของวันที่ ${date}` };
    return { value: Math.round(n * r.rate * 100) / 100, rate: r.rate, exact: r.exact, rateDate: r.date, ok: true };
  }

  function toQuote(amountTHB, date) {
    const r = effectiveRate(date);
    if (!r) return { value: null, rate: null, ok: false, error: `ยังไม่ได้บันทึกอัตรา ${QUOTE} ของวันที่ ${date}` };
    return { value: Math.round(((Number(amountTHB) || 0) / r.rate) * 10000) / 10000, rate: r.rate, exact: r.exact, rateDate: r.date, ok: true };
  }

  const fmtTHB = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtQuote = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  /* แสดงคู่กัน เช่น '3,380.00 บาท (100.00 USDT @ 33.80)' */
  function dual(amount, currency, date) {
    const cur = (currency || BASE).toUpperCase();
    if (cur === BASE) {
      const q = toQuote(amount, date);
      return q.ok ? `${fmtTHB(amount)} บาท (≈ ${fmtQuote(q.value)} ${QUOTE} @ ${q.rate})` : `${fmtTHB(amount)} บาท`;
    }
    const t = toTHB(amount, cur, date);
    return t.ok ? `${fmtQuote(amount)} ${QUOTE} (= ${fmtTHB(t.value)} บาท @ ${t.rate})` : `${fmtQuote(amount)} ${QUOTE} — ยังไม่มีอัตราของวันนี้`;
  }

  /* ---------------- ตรวจสอบความครบถ้วน ---------------- */
  /* วันไหนมีรายการเกี่ยวกับ USDT แต่ยังไม่ได้ลงเรต ต้องเตือน */
  const USD_HINT = /usdt|usd|ดอลลาร์|เหรียญ/i;

  function missingRateDates(records) {
    const need = new Set();
    (records || []).forEach((r) => {
      const blob = `${r.note || ""} ${r.desc || ""} ${r.promo || ""} ${r.channel || ""} ${r.raw || ""}`;
      if (r.currency && r.currency.toUpperCase() !== BASE) need.add(r.date);
      else if (USD_HINT.test(blob)) need.add(r.date);
    });
    return [...need].filter((d) => d && !rateOf(d)).sort();
  }

  function stats() {
    const list = all();
    if (!list.length) return { count: 0 };
    const rates = list.map((r) => r.rate);
    return {
      count: list.length,
      latest: list[0],
      min: Math.min(...rates),
      max: Math.max(...rates),
      avg: Math.round((rates.reduce((a, c) => a + c, 0) / rates.length) * 10000) / 10000,
      first: list[list.length - 1],
    };
  }

  return { QUOTE, BASE, SOURCES, fetchReference, fetchOne, all, rateOf, effectiveRate, setRate, toTHB, toQuote, dual, fmtTHB, fmtQuote, missingRateDates, stats };
})();

if (typeof window !== "undefined") window.Fx = Fx;
