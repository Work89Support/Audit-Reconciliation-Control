/* =============================================================
   XlsxWriter - สร้างไฟล์ .xlsx จริงในเบราว์เซอร์ โดยไม่ต้องพึ่ง library ภายนอก
   ไฟล์ xlsx คือไฟล์ zip ที่ข้างในเป็น XML — ตัวนี้เขียน zip เองแบบ store (ไม่บีบอัด)
   รองรับ: หลายชีต, หัวตารางตัวหนา, ตรึงหัวตาราง, autofilter,
           ความกว้างคอลัมน์, ตัวเลขเป็นตัวเลขจริงที่ SUM ได้, รูปแบบเงิน
   ============================================================= */

const XlsxWriter = (() => {
  /* ---------- CRC32 ---------- */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  const enc = new TextEncoder();
  const utf8 = (s) => enc.encode(s);

  /* ---------- ZIP (store) ---------- */
  function zip(files) {
    const chunks = [];
    const central = [];
    let offset = 0;

    files.forEach((f) => {
      const nameBytes = utf8(f.name);
      const data = f.data;
      const crc = crc32(data);

      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true); // version needed
      lv.setUint16(6, 0x0800, true); // UTF-8 filename
      lv.setUint16(8, 0, true); // stored
      lv.setUint16(10, 0, true); // time
      lv.setUint16(12, 0x21, true); // date (1 Jan 1980-ish)
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);

      chunks.push(local, data);

      const cd = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0x21, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint32(42, offset, true);
      cd.set(nameBytes, 46);
      central.push(cd);

      offset += local.length + data.length;
    });

    const centralSize = central.reduce((a, c) => a + c.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);

    return new Blob([...chunks, ...central, eocd], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  /* ---------- XML helpers ---------- */
  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      // ตัดอักขระควบคุมที่ Excel ไม่ยอมรับ
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");

  function colName(n) {
    let s = "";
    n += 1;
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  /* ชื่อชีตต้องไม่มี : \ / ? * [ ] และยาวไม่เกิน 31 ตัว */
  const safeSheetName = (n, i) => (String(n).replace(/[:\\/?*[\]]/g, " ").trim() || "Sheet" + (i + 1)).slice(0, 31);

  /* ---------- styles ---------- */
  /* 0 = ปกติ, 1 = หัวตาราง (หนา พื้นฟ้า), 2 = ตัวเลขทศนิยม 2, 3 = ชื่อรายงาน, 4 = คำอธิบาย, 5 = จำนวนเต็ม */
  const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="#,##0"/></numFmts>
<fonts count="4">
<font><sz val="11"/><name val="Tahoma"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Tahoma"/></font>
<font><b/><sz val="14"/><color rgb="FF0F2238"/><name val="Tahoma"/></font>
<font><sz val="10"/><color rgb="FF63748A"/><name val="Tahoma"/></font>
</fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF0066CC"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFD9E8F7"/></left><right style="thin"><color rgb="FFD9E8F7"/></right><top style="thin"><color rgb="FFD9E8F7"/></top><bottom style="thin"><color rgb="FFD9E8F7"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  /* ---------- worksheet ---------- */
  function sheetXml(sheet) {
    const rows = [];
    let r = 0;
    const push = (cells) => rows.push({ index: ++r, cells });

    if (sheet.title) {
      push([{ v: sheet.title, s: 3 }]);
      if (sheet.meta) push([{ v: sheet.meta, s: 4 }]);
      push([]);
    }
    const headerRowIndex = r + 1;
    push(sheet.headers.map((hh) => ({ v: hh, s: 1 })));

    sheet.rows.forEach((row) => {
      push(
        row.map((v) => {
          if (typeof v === "number" && Number.isFinite(v)) {
            return { v, n: true, s: Number.isInteger(v) ? 5 : 2 };
          }
          return { v: v ?? "" };
        }),
      );
    });

    const body = rows
      .map((row) => {
        const cells = row.cells
          .map((c, ci) => {
            const ref = colName(ci) + row.index;
            const st = c.s ? ` s="${c.s}"` : "";
            if (c.n) return `<c r="${ref}"${st}><v>${c.v}</v></c>`;
            if (c.v === "" || c.v === null || c.v === undefined) return `<c r="${ref}"${st}/>`;
            return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`;
          })
          .join("");
        return `<row r="${row.index}"${row.index === headerRowIndex ? ' ht="26" customHeight="1"' : ""}>${cells}</row>`;
      })
      .join("");

    const widths = sheet.widths || sheet.headers.map(() => 18);
    const cols = `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`;

    const lastCol = colName(sheet.headers.length - 1);
    const lastRow = headerRowIndex + sheet.rows.length;
    const filter = sheet.rows.length ? `<autoFilter ref="A${headerRowIndex}:${lastCol}${lastRow}"/>` : "";
    const pane = `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRowIndex}" topLeftCell="A${headerRowIndex + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${headerRowIndex + 1}" sqref="A${headerRowIndex + 1}"/></sheetView></sheetViews>`;

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastCol}${Math.max(lastRow, 1)}"/>${pane}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${body}</sheetData>${filter}</worksheet>`;
  }

  /* ---------- build workbook ---------- */
  function build(sheets, meta) {
    const named = sheets.map((sh, i) => ({ ...sh, meta: sh.meta || meta, _name: safeSheetName(sh.name, i) }));
    // กันชื่อชีตซ้ำ
    const seen = new Set();
    named.forEach((sh, i) => {
      let n = sh._name;
      let k = 2;
      while (seen.has(n.toLowerCase())) n = sh._name.slice(0, 28) + " " + k++;
      seen.add(n.toLowerCase());
      sh._name = n;
    });

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${named.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${named.map((sh, i) => `<sheet name="${esc(sh._name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>
</workbook>`;

    const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${named.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}
<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

    const files = [
      { name: "[Content_Types].xml", data: utf8(contentTypes) },
      { name: "_rels/.rels", data: utf8(rootRels) },
      { name: "xl/workbook.xml", data: utf8(workbook) },
      { name: "xl/_rels/workbook.xml.rels", data: utf8(wbRels) },
      { name: "xl/styles.xml", data: utf8(STYLES_XML) },
      ...named.map((sh, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: utf8(sheetXml(sh)) })),
    ];

    return zip(files);
  }

  return { build, colName };
})();
