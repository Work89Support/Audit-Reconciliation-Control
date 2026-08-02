/* =============================================================
   XlsxReader - อ่านไฟล์ .xlsx ในเบราว์เซอร์โดยไม่ต้องพึ่ง library ภายนอก
   - แตก zip เองจาก central directory
   - คลาย deflate ด้วย DecompressionStream ของเบราว์เซอร์ (native)
   - อ่าน OOXML: workbook / sharedStrings / worksheet / styles (numFmt วันที่)
   - คืนค่าเป็น string[][] เหมือน parseCSV เพื่อให้ Engine ใช้ต่อได้ทันที
   หมายเหตุ: ถ้ามี SheetJS (XLSX) อยู่แล้วจะใช้ตัวนั้นก่อนเพราะรองรับกว้างกว่า
   ============================================================= */

const XlsxReader = (() => {
  const dec = new TextDecoder("utf-8");

  /* ---------------- ZIP ---------------- */
  function findEOCD(dv, len) {
    const max = Math.min(len, 66000);
    for (let i = len - 22; i >= len - max && i >= 0; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) return i;
    }
    return -1;
  }

  function listEntries(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(buf);
    const eocd = findEOCD(dv, u8.length);
    if (eocd < 0) throw new Error("ไฟล์ไม่ใช่ .xlsx ที่ถูกต้อง (หา End of Central Directory ไม่พบ)");
    let count = dv.getUint16(eocd + 10, true);
    let cdOfs = dv.getUint32(eocd + 16, true);

    // ZIP64: ถ้าค่าเป็น 0xFFFF/0xFFFFFFFF ให้อ่านจาก ZIP64 EOCD
    if (count === 0xffff || cdOfs === 0xffffffff) {
      for (let i = eocd - 20; i >= 0; i--) {
        if (dv.getUint32(i, true) === 0x07064b50) {
          const z64 = Number(dv.getBigUint64(i + 8, true));
          if (dv.getUint32(z64, true) === 0x06064b50) {
            count = Number(dv.getBigUint64(z64 + 32, true));
            cdOfs = Number(dv.getBigUint64(z64 + 48, true));
          }
          break;
        }
      }
    }

    const out = {};
    let p = cdOfs;
    for (let i = 0; i < count && p + 46 <= u8.length; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const compSize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true);
      const extraLen = dv.getUint16(p + 30, true);
      const cmtLen = dv.getUint16(p + 32, true);
      const localOfs = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
      out[name] = { method, compSize, localOfs };
      p += 46 + nameLen + extraLen + cmtLen;
    }
    return { u8, dv, entries: out };
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("เบราว์เซอร์นี้ยังไม่รองรับการอ่าน .xlsx โดยตรง — กรุณาบันทึกไฟล์เป็น .csv ก่อน");
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function readEntry(zip, name) {
    const e = zip.entries[name];
    if (!e) return null;
    const { u8, dv } = zip;
    const lo = e.localOfs;
    if (dv.getUint32(lo, true) !== 0x04034b50) return null;
    const nameLen = dv.getUint16(lo + 26, true);
    const extraLen = dv.getUint16(lo + 28, true);
    const start = lo + 30 + nameLen + extraLen;
    const raw = u8.subarray(start, start + e.compSize);
    const data = e.method === 0 ? raw : await inflateRaw(raw);
    return dec.decode(data);
  }

  /* ---------------- XML helper (regex-based, เร็วพอสำหรับไฟล์รายงาน) ---------------- */
  const unesc = (s) =>
    s
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&amp;/g, "&");

  function sharedStrings(xml) {
    if (!xml) return [];
    const out = [];
    const si = xml.match(/<si\b[^>]*>[\s\S]*?<\/si>|<si\b[^>]*\/>/g) || [];
    for (const block of si) {
      let s = "";
      const ts = block.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || [];
      for (const t of ts) s += unesc(t.replace(/<t\b[^>]*>/, "").replace(/<\/t>$/, ""));
      out.push(s);
    }
    return out;
  }

  /* numFmt ที่เป็นวันที่ → ต้องแปลง serial เป็นข้อความ */
  const BUILTIN_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
  function dateStyles(xml) {
    const set = new Set();
    if (!xml) return set;
    const custom = {};
    for (const m of xml.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) {
      custom[+m[1]] = unesc(m[2]);
    }
    const block = (xml.match(/<cellXfs\b[\s\S]*?<\/cellXfs>/) || [""])[0];
    const xfs = block.match(/<xf\b[^>]*\/?>/g) || [];
    xfs.forEach((xf, idx) => {
      const m = xf.match(/numFmtId="(\d+)"/);
      if (!m) return;
      const id = +m[1];
      const code = custom[id] || "";
      if (BUILTIN_DATE.has(id) || /[dmyhs]/i.test(code.replace(/\[[^\]]*\]|"[^"]*"/g, "")) === false) {
        if (BUILTIN_DATE.has(id)) set.add(idx);
        return;
      }
      if (/(y{2,}|d{1,2}|m{3,}|h{1,2}:)/.test(code)) set.add(idx);
    });
    return set;
  }

  const p2 = (n) => String(n).padStart(2, "0");
  function serialToText(v, withTime) {
    // Excel serial (1900 system) → 'YYYY-MM-DD HH:MM:SS'
    const days = Math.floor(v);
    const frac = v - days;
    const ms = Math.round((days - 25569) * 86400000);
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return String(v);
    const date = `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
    if (!withTime && frac < 1e-9) return date;
    let sec = Math.round(frac * 86400);
    const h = Math.floor(sec / 3600);
    sec -= h * 3600;
    const mi = Math.floor(sec / 60);
    return `${date} ${p2(h)}:${p2(mi)}:${p2(sec - mi * 60)}`;
  }

  const colOf = (ref) => {
    let n = 0;
    for (let i = 0; i < ref.length; i++) {
      const c = ref.charCodeAt(i);
      if (c < 65 || c > 90) break;
      n = n * 26 + (c - 64);
    }
    return n - 1;
  };

  function sheetRows(xml, sst, dstyles) {
    const rows = [];
    /* ต้องเป็น non-greedy และรองรับแท็กปิดในตัว <c r="E2"/> ไม่งั้นคอลัมน์จะเลื่อน */
    const rowRe = /<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g;
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let rm;
    while ((rm = rowRe.exec(xml))) {
      const inner = rm[1] || "";
      const cells = [];
      let cm;
      cellRe.lastIndex = 0;
      while ((cm = cellRe.exec(inner))) {
        const attr = cm[1] || "";
        const body = cm[2] || "";
        const ref = (attr.match(/r="([A-Z]+)/) || [])[1] || "";
        const idx = ref ? colOf(ref) : cells.length;
        const type = (attr.match(/t="([^"]+)"/) || [])[1] || "n";
        const style = +((attr.match(/s="(\d+)"/) || [])[1] || -1);
        let val = "";
        if (type === "inlineStr") {
          const ts = body.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || [];
          val = ts.map((t) => unesc(t.replace(/<t\b[^>]*>/, "").replace(/<\/t>$/, ""))).join("");
        } else {
          const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
          if (v === undefined) val = "";
          else if (type === "s") val = sst[+v] ?? "";
          else if (type === "str" || type === "e") val = unesc(v);
          else if (type === "b") val = v === "1" ? "TRUE" : "FALSE";
          else {
            const num = parseFloat(v);
            val = dstyles.has(style) && Number.isFinite(num) && num > 20000 ? serialToText(num, true) : v;
          }
        }
        while (cells.length < idx) cells.push("");
        cells[idx] = val;
      }
      rows.push(cells);
    }
    return rows;
  }

  /* ---------------- public ---------------- */
  async function readWorkbook(arrayBuffer) {
    const zip = listEntries(arrayBuffer);
    const wbXml = (await readEntry(zip, "xl/workbook.xml")) || "";
    const relsXml = (await readEntry(zip, "xl/_rels/workbook.xml.rels")) || "";
    const sst = sharedStrings(await readEntry(zip, "xl/sharedStrings.xml"));
    const dstyles = dateStyles(await readEntry(zip, "xl/styles.xml"));

    const rels = {};
    for (const m of relsXml.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
      rels[m[1]] = m[2].replace(/^\/?xl\//, "").replace(/^\.\//, "");
    }

    const sheets = [];
    for (const m of wbXml.matchAll(/<sheet\b[^>]*\/?>/g)) {
      const tag = m[0];
      const name = unesc((tag.match(/name="([^"]*)"/) || [])[1] || "Sheet");
      const rid = (tag.match(/r:id="([^"]+)"/) || [])[1];
      const target = rels[rid];
      if (target) sheets.push({ name, path: "xl/" + target });
    }
    if (!sheets.length) {
      Object.keys(zip.entries)
        .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
        .sort()
        .forEach((p, i) => sheets.push({ name: "Sheet" + (i + 1), path: p }));
    }

    const out = [];
    for (const s of sheets) {
      const xml = await readEntry(zip, s.path);
      if (!xml) continue;
      out.push({ name: s.name, rows: sheetRows(xml, sst, dstyles) });
    }
    return out;
  }

  /* คืนแผ่นแรกที่มีข้อมูล เป็น string[][] */
  async function read(arrayBuffer) {
    if (typeof XLSX !== "undefined" && XLSX.read) {
      try {
        const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: false, raw: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });
        if (rows.length) return rows.map((r) => r.map((c) => String(c ?? "")));
      } catch (_) {
        /* ตกไปใช้ตัวอ่านในตัว */
      }
    }
    const sheets = await readWorkbook(arrayBuffer);
    const best = sheets.find((s) => s.rows.length > 1) || sheets[0];
    if (!best) throw new Error("ไม่พบชีตข้อมูลในไฟล์ Excel");
    return best.rows.filter((r) => r.some((c) => String(c).trim() !== "")).map((r) => r.map((c) => String(c ?? "")));
  }

  return { read, readWorkbook };
})();

if (typeof window !== "undefined") window.XlsxReader = XlsxReader;
