/* =============================================================
   Docs - ออกเอกสารจากระบบเป็น PDF
   1) ใบขอให้ชี้แจง  : ออดิทออกให้หัวหน้ากะ ระบุรายการที่ต้องชี้แจงและกำหนดส่งคืน
   2) เอกสารชี้แจง   : ฉบับสมบูรณ์ตามฟอร์มเดิม พร้อมหลักฐานแนบและช่องลงนาม
   ใช้การพิมพ์ของเบราว์เซอร์ (บันทึกเป็น PDF) จึงได้ฟอนต์ไทยครบและไม่ต้องพึ่ง library ภายนอก
   ============================================================= */

const Docs = (() => {
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const money = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* วันที่แบบที่ทีมใช้ในเอกสาร: 19-07-69 (วัน-เดือน-ปี พ.ศ. สองหลัก) */
  function thShort(iso) {
    if (!iso) return "-";
    const [y, m, d] = String(iso).slice(0, 10).split("-");
    return `${d}-${m}-${String(+y + 543).slice(-2)}`;
  }
  const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  function thLong(iso) {
    if (!iso) return "-";
    const [y, m, d] = String(iso).slice(0, 10).split("-");
    return `${+d} ${TH_MONTH[+m - 1]} ${+y + 543}`;
  }

  const CSS = `
  @page { size: A4; margin: 15mm 14mm 16mm; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:"Kanit","Tahoma","TH Sarabun New",sans-serif; color:#17212e; font-size:10.5pt; line-height:1.5;
         -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .sheet { padding: 0; }
  .hd { display:flex; justify-content:space-between; align-items:flex-start; gap:18px;
        border-bottom:2.5px solid #0066cc; padding-bottom:9px; margin-bottom:13px; }
  .hd .eyebrow { font-size:8.6pt; color:#6b7c8f; letter-spacing:.05em; text-transform:uppercase; margin:0 0 2px; }
  .hd h1 { margin:0; font-size:19pt; color:#003b76; line-height:1.15; }
  .hd .sub { margin:3px 0 0; font-size:9.4pt; color:#4a6076; }
  .meta { text-align:right; font-size:9.2pt; color:#3d5166; min-width:200px; }
  .meta div { display:flex; justify-content:space-between; gap:14px; padding:1px 0; }
  .meta b { color:#17212e; }

  .box { border:1px solid #d6e4f2; border-radius:6px; padding:9px 12px; background:#f8fbff; margin-bottom:12px; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }
  .kv { display:grid; grid-template-columns:auto 1fr; gap:3px 10px; font-size:9.6pt; }
  .kv span { color:#7a8b9e; }
  .kv b { font-weight:600; }
  h2.sec { font-size:11pt; color:#003b76; margin:14px 0 7px; padding-bottom:3px; border-bottom:1px solid #d6e4f2; }

  table { width:100%; border-collapse:collapse; }
  th { background:#0066cc; color:#fff; font-weight:normal; font-size:8.8pt; padding:6px 7px; text-align:left; }
  td { padding:6px 7px; border-bottom:1px solid #e5eef7; font-size:9pt; vertical-align:top; }
  tr:nth-child(even) td { background:#fafcff; }
  .r { text-align:right; } .c { text-align:center; }
  tr, .avoid { break-inside:avoid; }
  tfoot td { background:#eef6ff; font-weight:600; border-top:1.5px solid #0066cc; }

  .fillrow td { height:26px; }
  .writein { border:1px dashed #9fb3c8; border-radius:5px; min-height:74px; padding:8px 10px; background:#fff; font-size:9.4pt; color:#55697e; }
  .narrative { border:1px solid #d6e4f2; border-radius:6px; padding:11px 13px; background:#fff; font-size:10pt; line-height:1.7; white-space:pre-wrap; min-height:70px; }

  .note { background:#fffbf2; border-left:4px solid #e0a11a; padding:8px 12px; border-radius:4px; font-size:9.2pt; color:#4a4030; margin-bottom:12px; }
  .note b { color:#8a6408; }
  .alert { background:#fff6f6; border-left:4px solid #d03b3b; padding:8px 12px; border-radius:4px; font-size:9.4pt; margin-bottom:12px; }
  .ok { background:#f4fcf6; border-left:4px solid #0ca30c; padding:8px 12px; border-radius:4px; font-size:9.4pt; margin-bottom:12px; }

  .ev { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .ev figure { margin:0; border:1px solid #d6e4f2; border-radius:6px; padding:7px; background:#fff; break-inside:avoid; }
  .ev img { display:block; width:100%; height:auto; border-radius:4px; }
  .ev figcaption { margin-top:5px; font-size:8.6pt; color:#7a8b9e; }
  .ev .placeholder { display:grid; place-items:center; height:118px; border:1px dashed #9fb3c8; border-radius:4px; color:#9fb3c8; font-size:9pt; }

  .sign { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; margin-top:24px; break-inside:avoid; }
  .sign.two { grid-template-columns:repeat(2,1fr); }
  .sign div { text-align:center; }
  .sign .line { border-bottom:1px dotted #7a8b9e; height:38px; margin-bottom:5px; }
  .sign .who { font-weight:600; font-size:9.4pt; }
  .sign .sm { font-size:8.8pt; color:#55697e; }
  .foot { margin-top:14px; padding-top:7px; border-top:1px solid #d6e4f2; font-size:8.2pt; color:#8fa0b3; text-align:center; }
  @media print { .noprint { display:none !important; } }
  `;

  /* ---------------- ใบขอให้ชี้แจง ---------------- */
  function requestHtml(o) {
    const rows = o.items
      .map(
        (e, i) => `<tr>
      <td class="c">${i + 1}</td>
      <td><b>${esc(e.id)}</b></td>
      <td>${esc(e.time)}</td>
      <td>${esc(e.account)}<br><span style="color:#7a8b9e;font-size:8.4pt">${esc(e.bank)} · ${esc(e.direction)}</span></td>
      <td>${esc(e.typeName)}</td>
      <td class="r">${e.riskAmount ? money(e.riskAmount) : "-"}</td>
      <td>${esc(e.employee)}</td>
      <td style="min-width:150px"></td>
    </tr>`,
      )
      .join("");
    const total = o.items.reduce((a, c) => a + (c.riskAmount || 0), 0);

    return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(o.docNo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body><div class="sheet">

<div class="hd">
  <div>
    <p class="eyebrow">Clarification Request</p>
    <h1>ใบขอให้ชี้แจงรายการผิดปกติ</h1>
    <p class="sub">แผนกออดิท · ${esc(o.trackName)}</p>
  </div>
  <div class="meta">
    <div><span>เลขที่</span><b>${esc(o.docNo)}</b></div>
    <div><span>วันที่ออกเอกสาร</span><b>${thLong(o.issuedAt)}</b></div>
    <div><span>ข้อมูลวันที่</span><b>${esc(o.periodLabel)}</b></div>
    <div><span>กำหนดส่งคืน</span><b style="color:#b02a2a">${esc(o.dueLabel)}</b></div>
  </div>
</div>

<div class="grid2">
  <div class="box"><div class="kv">
    <span>เรียน</span><b>${esc(o.toName)}</b>
    <span>กะ</span><b>${esc(o.shiftName)}</b>
    <span>บริษัท / ระบบ</span><b>${esc(o.companyName)}</b>
  </div></div>
  <div class="box"><div class="kv">
    <span>จาก</span><b>${esc(o.fromName)}</b>
    <span>ผู้ออกเอกสาร</span><b>${esc(o.issuer)}</b>
    <span>จำนวนรายการ</span><b>${o.items.length} รายการ</b>
  </div></div>
</div>

<div class="note"><b>ขั้นตอน:</b> กรุณาชี้แจงสาเหตุของแต่ละรายการในช่องขวาสุด แนบสลิปหรือหลักฐานประกอบ แล้วส่งกลับแผนกออดิทภายในกำหนด หากเลยกำหนดระบบจะบันทึกเป็นรายการค้างชี้แจงและนับเข้ารอบสรุปความเสียหาย</div>

<h2 class="sec">รายการที่ต้องชี้แจง</h2>
<table>
  <thead><tr>
    <th class="c" style="width:26px">#</th><th style="width:74px">เลขเคส</th><th style="width:58px">เวลา</th>
    <th style="width:112px">บัญชี</th><th>ประเภทปัญหา</th><th class="r" style="width:80px">ยอดที่ต้องตรวจ</th>
    <th style="width:96px">ผู้เกี่ยวข้อง</th><th style="width:150px">คำชี้แจง (กรอก)</th>
  </tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr><td colspan="5">รวม ${o.items.length} รายการ</td><td class="r">${money(total)}</td><td colspan="2"></td></tr></tfoot>
</table>



<h2 class="sec">คำชี้แจงเพิ่มเติม / เอกสารแนบ</h2>
<div class="writein">โปรดระบุรายละเอียดเพิ่มเติม และรายการหลักฐานที่แนบมาพร้อมเอกสารฉบับนี้</div>

<div class="sign">
  <div><div class="line"></div><div class="who">ผู้ออกเอกสาร (ออดิท)</div><div class="sm">${esc(o.issuer)}</div><div class="sm">วันที่ ......./......./..........</div></div>
  <div><div class="line"></div><div class="who">ผู้ชี้แจง (หัวหน้ากะ)</div><div class="sm">${esc(o.toName)}</div><div class="sm">วันที่ ......./......./..........</div></div>
  <div><div class="line"></div><div class="who">ผู้ตรวจทาน (Audit Lead)</div><div class="sm">&nbsp;</div><div class="sm">วันที่ ......./......./..........</div></div>
</div>

<p class="foot">${esc(o.docNo)} · ออกจากระบบ Audit AI Reconciliation เมื่อ ${esc(o.stamp)} · เอกสารนี้อ้างอิงข้อมูลที่ผ่านการกระทบยอดแล้ว</p>
</div></body></html>`;
  }

  function clarificationHtml(o) {
    const e = o.ex;
    const evid = (e.evidence || []).filter((f) => f.url && /\.(png|jpe?g|gif|webp)$/i.test(f.name));
    const evHtml = evid.length
      ? `<div class="ev">${evid
          .map((f) => `<figure><img src="${esc(f.url)}" alt=""><figcaption>${esc(f.name)} · แนบเมื่อ ${esc(f.at)}</figcaption></figure>`)
          .join("")}</div>`
      : `<div class="ev">
          <figure><div class="placeholder">แนบสลิปรายการที่เป็นปัญหา</div><figcaption>หลักฐานที่ 1</figcaption></figure>
          <figure><div class="placeholder">แนบสลิปการแก้ไข</div><figcaption>หลักฐานที่ 2</figcaption></figure>
        </div>`;

    const notes = (e.notes || []).map((n) => `${n.text}  (${n.by} · ${n.at})`).join("\n");
    const damage = o.damage;

    return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(o.docNo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body><div class="sheet">

<div class="hd">
  <div>
    <p class="eyebrow">Clarification Report</p>
    <h1>เอกสารชี้แจงรายการผิดปกติ</h1>
    <p class="sub">${esc(o.brand)} · วันที่ ${thShort(e.date)} · กะ ${esc(o.shiftName)} · ผู้ดำเนินการ ${esc(e.employee)}</p>
  </div>
  <div class="meta">
    <div><span>เลขที่</span><b>${esc(o.docNo)}</b></div>
    <div><span>เลขเคส</span><b>${esc(e.id)}</b></div>
    <div><span>วันที่ออกเอกสาร</span><b>${thLong(o.issuedAt)}</b></div>
    <div><span>รอบชี้แจง</span><b>${esc(o.trackName)}</b></div>
  </div>
</div>

<h2 class="sec">หัวข้อ</h2>
<div class="box" style="background:#eef6ff"><b style="font-size:11.5pt;color:#003b76">${esc(o.title)}</b></div>

<h2 class="sec">ข้อมูลรายการ</h2>
<table>
  <thead><tr><th>รายการ</th><th>ฝั่งธนาคาร (STM)</th><th>ฝั่งระบบหลังบ้าน (BO)</th></tr></thead>
  <tbody>
    <tr><td>เวลา</td><td>${esc(e.bankAmount === null ? "-" : e.time)}</td><td>${esc(e.systemAmount === null ? "-" : e.boTime || e.time)}</td></tr>
    <tr><td>จำนวนเงิน</td><td>${e.bankAmount === null ? "ไม่พบรายการ" : money(e.bankAmount)}</td><td>${e.systemAmount === null ? "ไม่พบรายการ" : money(e.systemAmount)}</td></tr>
    <tr><td>บัญชี / ช่องทาง</td><td colspan="2">${esc(e.account)} · ${esc(e.bank)} · ${esc(e.direction)}</td></tr>
    <tr><td>ประเภทปัญหา</td><td colspan="2">${esc(e.typeName)} · ระดับ ${esc(o.severityName)}</td></tr>
    <tr><td>ผลต่างเวลา</td><td colspan="2">${e.timeDiffSec} วินาที</td></tr>
    <tr><td>ยอดที่ต้องตรวจ</td><td colspan="2"><b>${e.riskAmount ? money(e.riskAmount) + " บาท" : "ไม่กระทบยอดเงิน"}</b></td></tr>
  </tbody>
</table>

<h2 class="sec">คำชี้แจง</h2>
<div class="narrative">${esc(o.narrative || notes || "")}</div>

<h2 class="sec">หลักฐานประกอบ</h2>
${evHtml}

<h2 class="sec">สรุปผล</h2>
${
  damage
    ? `<div class="alert"><b>เป็นความเสียหาย</b> — ยอดความเสียหาย <b>${money(e.riskAmount)} บาท</b> · บันทึกเข้าทะเบียนความเสียหาย ${esc(o.cycleName)} และส่งต่อฝ่ายการเงิน/บุคคลตามรอบ</div>`
    : `<div class="ok"><b>ไม่เสียหาย</b> — ได้แก้ไขให้ลูกค้าเรียบร้อยแล้ว ไม่มีผลกระทบต่อยอดเงินของบริษัท</div>`
}
<div class="box"><div class="kv">
  <span>สาเหตุที่บันทึก</span><b>${esc(e.cause)}</b>
  <span>สถานะเคส</span><b>${esc(o.statusName)}</b>
  <span>อายุเคส / SLA</span><b>${e.ageHours} ชม. / เกณฑ์ ${e.slaHours} ชม.</b>
</div></div>

<div class="sign">
  <div><div class="line"></div><div class="who">ผู้ชี้แจง</div><div class="sm">${esc(o.responder || "หัวหน้ากะ " + o.shiftName)}</div><div class="sm">วันที่ ......./......./..........</div></div>
  <div><div class="line"></div><div class="who">ผู้ตรวจสอบ (ออดิท)</div><div class="sm">${esc(o.issuer)}</div><div class="sm">วันที่ ......./......./..........</div></div>
  <div><div class="line"></div><div class="who">ผู้อนุมัติ (Audit Lead)</div><div class="sm">&nbsp;</div><div class="sm">วันที่ ......./......./..........</div></div>
</div>

<p class="foot">${esc(o.docNo)} · ออกจากระบบ Audit AI Reconciliation เมื่อ ${esc(o.stamp)} · ข้อมูลดิบและประวัติการแก้ไขทั้งหมดตรวจสอบย้อนกลับได้จากเลขเคส ${esc(e.id)}</p>
</div></body></html>`;
  }

  /* ---------------- สั่งพิมพ์ / บันทึกเป็น PDF ---------------- */
  function print(html, filename) {
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;";
    document.body.appendChild(frame);
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    const go = () => {
      try {
        frame.contentWindow.document.title = filename;
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (e) {}
      setTimeout(() => frame.remove(), 60000);
    };
    // รอให้ฟอนต์และรูปโหลดก่อน ไม่งั้น PDF จะได้หน้าเปล่า
    if (frame.contentWindow.document.readyState === "complete") setTimeout(go, 700);
    else frame.onload = () => setTimeout(go, 700);
  }

  function preview(html) {
    const w = window.open("", "_blank");
    if (!w) return false;
    w.document.write(html);
    w.document.close();
    return true;
  }

  return { requestHtml, clarificationHtml, print, preview, thShort, thLong };
})();
