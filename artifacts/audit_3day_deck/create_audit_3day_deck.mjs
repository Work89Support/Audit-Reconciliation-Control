import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "/Users/a/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const OUT = "/Users/a/Documents/GitHub/Audit-Reconciliation-Control/artifacts/audit_3day_deck";
const W = 1280;
const H = 720;
const FONT = "Kanit";

const C = {
  navy: "#0B2B4B",
  blue: "#0867D0",
  blue2: "#2B84E6",
  sky: "#EAF4FF",
  ink: "#102A43",
  muted: "#627D98",
  line: "#D9E7F5",
  bg: "#F5F9FD",
  white: "#FFFFFF",
  green: "#118A52",
  greenBg: "#E8F7EF",
  amber: "#A76600",
  amberBg: "#FFF3D7",
  red: "#C53A3A",
  redBg: "#FDECEC",
};

const companies = [
  { name: "3XB", files: [15, 13, 9], stm: [5110, 5716, 5320], bo: [5841, 6515, 6817], matched: [1938, 3052, 3211], rate: [37.93, 53.39, 60.36], evidence29: 0, level: "ติดตาม", color: C.amber, ask: ["ยืนยันว่า 29 ส.ค. ส่งไฟล์ PM/Provider ครบ แม้จำนวนลดเหลือ 9 ไฟล์", "ตรวจว่ามีไฟล์ BO/PM ส่งตามหลังรอบประมวลผลหรือไม่", "ถ้าครบ ให้ใช้ผลวันที่ 29 ต่อได้"] },
  { name: "AT4", files: [15, 13, 10], stm: [471, 457, 410], bo: [470, 461, 429], matched: [113, 194, 174], rate: [23.99, 42.45, 42.44], evidence29: 0, level: "ติดตาม", color: C.amber, ask: ["ยืนยันชุดไฟล์ฝาก/ถอนของทุก Provider วันที่ 29", "ตรวจบัญชีและทิศทาง D/W ในชื่อไฟล์", "สอบถามว่าจำนวนไฟล์ลด 15 → 10 เป็นปกติหรือไม่"] },
  { name: "FR8", files: [14, 16, 15], stm: [4150, 4556, 4491], bo: [4164, 4569, 4513], matched: [1109, 1182, 1070], rate: [26.72, 25.94, 23.83], evidence29: 5, level: "เร่งตรวจ", color: C.red, ask: ["ไฟล์ปริมาณใกล้เคียงเดิม แต่จับคู่ต่ำต่อเนื่อง—ตรวจ mapping บัญชี/Provider", "ยืนยันคอลัมน์เวลาและ timezone ระหว่าง BO กับ STM", "นำไฟล์ชี้แจง 5 ไฟล์มาผูกกับเคสที่ไม่พบคู่"] },
  { name: "MC8", files: [8, 10, 10], stm: [813, 1040, 1099], bo: [886, 1114, 1373], matched: [449, 578, 418], rate: [55.23, 55.58, 38.04], evidence29: 1, level: "ติดตาม", color: C.amber, ask: ["อัตราจับคู่ลดชัดในวันที่ 29 แม้จำนวนไฟล์ปกติ", "ตรวจคอลัมน์เวลา NaN/undefined และ Provider corepay", "ใช้ไฟล์ชี้แจง 1 ไฟล์ยืนยันเคสที่ตรงยอดแต่ผิดรูปแบบเวลา"] },
  { name: "MR9", files: [11, 10, 10], stm: [1062, 902, 947], bo: [1129, 989, 1017], matched: [525, 519, 446], rate: [49.44, 57.54, 47.10], evidence29: 6, level: "ติดตาม", color: C.amber, ask: ["จำนวนไฟล์หลักคงที่ แต่มีหลักฐานเพิ่ม 6 ไฟล์", "ผูกไฟล์ชี้แจงกับรายการไม่พบคู่ก่อนปิดเคส", "ยืนยันว่าชุด Provider ใน BO และ PM ครบทั้งฝาก/ถอน"] },
  { name: "PS8", files: [11, 11, 11], stm: [312, 331, 305], bo: [363, 371, 366], matched: [214, 229, 183], rate: [68.59, 69.18, 60.00], evidence29: 0, level: "ปกติ", color: C.green, ask: ["จำนวนไฟล์คงที่ 11 ไฟล์ทุกวัน", "ยืนยันความครบถ้วนกับทีม แล้วใช้เป็น baseline เปรียบเทียบบริษัทอื่น", "สุ่มตรวจเคสไม่พบคู่เพื่อยืนยัน tolerance"] },
  { name: "SK8", files: [18, 12, 10], stm: [572, 504, 535], bo: [570, 505, 547], matched: [22, 69, 62], rate: [3.85, 13.69, 11.59], evidence29: 1, level: "เร่งตรวจ", color: C.red, ask: ["อัตราจับคู่ต่ำมากทั้ง 3 วัน—ตรวจ rule/mapping ก่อนสรุปผล", "ยืนยันไฟล์ทุก Provider และทั้ง D/W โดยเฉพาะวันที่ 29", "ตรวจชนิดข้อมูลยอด เวลา และรหัสบัญชีว่าตรง BO หรือไม่"] },
  { name: "UFABET7M", files: [7, 7, 7], stm: [1981, 2274, 2757], bo: [1966, 2163, 2698], matched: [1738, 1857, 1691], rate: [87.73, 81.66, 61.34], evidence29: 3, level: "ติดตาม", color: C.amber, ask: ["จำนวนไฟล์คงที่ แต่ match rate ลดลงต่อเนื่อง", "ตรวจ distribution เวลา/ยอดของวันที่ 29 และค่า tolerance", "นำหลักฐาน 3 ไฟล์มาผูกเคสก่อนอนุมัติ"] },
  { name: "UR9", files: [11, 11, 11], stm: [496, 609, 521], bo: [544, 658, 563], matched: [155, 329, 283], rate: [31.25, 54.02, 54.32], evidence29: 0, level: "ปกติ", color: C.green, ask: ["จำนวนไฟล์คงที่และแนวโน้มดีขึ้น", "ยืนยัน BO + PM ครบตามอีเมลวันที่ 27–29", "สุ่มตรวจ Provider ที่ยังไม่พบคู่ก่อนปิดรอบ"] },
];

const daily = [
  { date: "27 ส.ค.", files: 110, stm: 14967, bo: 15933, matched: 6263, rate: 41.85 },
  { date: "28 ส.ค.", files: 103, stm: 16389, bo: 17345, matched: 8009, rate: 48.87 },
  { date: "29 ส.ค.", files: 92, stm: 16385, bo: 18323, matched: 7538, rate: 46.01 },
];

const fmt = n => n.toLocaleString("en-US");
const avg = a => a.reduce((s, v) => s + v, 0) / a.length;

function rect(slide, x, y, w, h, fill, line = "none", radius = 12) {
  return slide.shapes.add({ geometry: "roundRect", position: { left: x, top: y, width: w, height: h }, fill, line: { style: "solid", fill: line, width: line === "none" ? 0 : 1 }, borderRadius: radius });
}

function txt(slide, text, x, y, w, h, size = 22, color = C.ink, bold = false, align = "left", valign = "top") {
  const s = slide.shapes.add({ geometry: "textbox", position: { left: x, top: y, width: w, height: h }, fill: "none", line: { style: "solid", fill: "none", width: 0 } });
  s.text = String(text);
  s.text.style = { fontSize: size, typeface: FONT, color, bold, alignment: align, verticalAlignment: valign, autoFit: "shrinkText", wrap: true, insets: { left: 0, right: 0, top: 0, bottom: 0 } };
  return s;
}

function line(slide, x, y, w, color = C.line, width = 1) {
  return slide.shapes.add({ geometry: "straightConnector1", position: { left: x, top: y, width: w, height: 0 }, fill: "none", line: { style: "solid", fill: color, width } });
}

function header(slide, title, subtitle, section, page) {
  slide.background.fill = C.bg;
  txt(slide, section.toUpperCase(), 56, 36, 380, 24, 14, C.blue, true);
  txt(slide, title, 56, 66, 890, 55, 34, C.navy, true);
  txt(slide, subtitle, 56, 126, 1050, 34, 17, C.muted);
  txt(slide, String(page).padStart(2, "0"), 1180, 40, 45, 24, 13, C.muted, true, "right");
  line(slide, 56, 174, 1168, C.line, 1);
}

function pill(slide, label, x, y, w, color, bg) {
  rect(slide, x, y, w, 30, bg, "none", 15);
  txt(slide, label, x, y + 4, w, 22, 14, color, true, "center", "middle");
}

function metric(slide, label, value, note, x, y, w, accent = C.blue) {
  rect(slide, x, y, w, 118, C.white, C.line, 12);
  slide.shapes.add({ geometry: "rect", position: { left: x, top: y, width: 6, height: 118 }, fill: accent, line: { style: "solid", fill: accent, width: 0 } });
  txt(slide, label, x + 22, y + 16, w - 36, 22, 15, C.muted);
  txt(slide, value, x + 22, y + 43, w - 36, 38, 28, C.navy, true);
  txt(slide, note, x + 22, y + 88, w - 36, 20, 12, C.muted);
}

function notes(slide, extra = "") {
  slide.speakerNotes.textFrame.setText(`[Sources]\n- Internal Supabase production data: daily_recon_jobs, recon_runs, source_files, mail_batches; checked 2026-08-30.\n${extra ? `- ${extra}\n` : ""}[/Sources]`);
}

function tableGrid(slide, cols, rows, x, y, widths, rowH = 38) {
  const total = widths.reduce((a, b) => a + b, 0);
  rect(slide, x, y, total, rowH * (rows.length + 1), C.white, C.line, 8);
  let cx = x;
  cols.forEach((c, i) => {
    txt(slide, c, cx + 8, y + 9, widths[i] - 16, 20, 13, C.navy, true, i === 0 ? "left" : "center");
    cx += widths[i];
  });
  line(slide, x, y + rowH, total, C.line, 1);
  rows.forEach((row, ri) => {
    const yy = y + rowH * (ri + 1);
    if (ri % 2 === 1) slide.shapes.add({ geometry: "rect", position: { left: x + 1, top: yy, width: total - 2, height: rowH }, fill: "#F8FBFE", line: { style: "solid", fill: "none", width: 0 } });
    let xx = x;
    row.forEach((v, ci) => {
      txt(slide, v, xx + 8, yy + 9, widths[ci] - 16, 20, 13, ci === 0 ? C.ink : C.muted, ci === 0, ci === 0 ? "left" : "center");
      xx += widths[ci];
    });
    if (ri < rows.length - 1) line(slide, x, yy + rowH, total, C.line, 1);
  });
}

function rateBars(slide, rates, x, y, w, h) {
  const labels = ["27", "28", "29"];
  const bw = 42;
  const gap = 46;
  const base = y + h - 28;
  line(slide, x, base, w, C.line, 1);
  rates.forEach((r, i) => {
    const bh = Math.max(4, (h - 62) * r / 100);
    const bx = x + 45 + i * (bw + gap);
    slide.shapes.add({ geometry: "roundRect", position: { left: bx, top: base - bh, width: bw, height: bh }, fill: r < 30 ? C.red : r < 60 ? C.amber : C.green, line: { style: "solid", fill: "none", width: 0 }, borderRadius: 6 });
    txt(slide, `${r.toFixed(1)}%`, bx - 10, base - bh - 24, bw + 20, 20, 12, C.ink, true, "center");
    txt(slide, labels[i], bx, base + 6, bw, 18, 12, C.muted, false, "center");
  });
}

function addTitleSlide(p) {
  const s = p.slides.add();
  s.background.fill = C.navy;
  slideAccent(s);
  txt(s, "AUDIT RECONCILIATION", 64, 54, 420, 26, 15, "#82BFFF", true);
  txt(s, "สรุปการกระทบยอด\n27–29 สิงหาคม 2026", 64, 164, 760, 165, 52, C.white, true);
  txt(s, "ภาพรวม • เช็กลิสต์ 9 บริษัท • ประเด็นถามทีม • วิธีดำเนินงาน 1 หน้า", 68, 354, 805, 60, 22, "#C7DBEE");
  rect(s, 64, 507, 1110, 120, "#123A60", "#27577F", 14);
  txt(s, "ข้อสรุปสำคัญ", 88, 528, 180, 24, 15, "#82BFFF", true);
  txt(s, "ทุกบริษัทอ่านไฟล์และรันครบทั้ง 3 วัน แต่คุณภาพการจับคู่ยังต่างกันมาก—ต้องแยก “ครบไฟล์” ออกจาก “จับคู่ครบ”", 88, 561, 1010, 42, 22, C.white, true);
  notes(s);
}

function slideAccent(slide) {
  slide.shapes.add({ geometry: "rect", position: { left: 0, top: 0, width: 12, height: H }, fill: C.blue, line: { style: "solid", fill: C.blue, width: 0 } });
}

function addOverview(p, page) {
  const s = p.slides.add(); header(s, "ภาพรวม 3 วัน", "อ่านไฟล์ครบ 305 ไฟล์หลัก และสร้างผลกระทบยอดครบทั้ง 9 บริษัท", "Executive overview", page);
  const totals = { files: 305, stm: 47741, bo: 51601, matched: 21810, rate: 45.68 };
  metric(s, "ไฟล์หลักที่อ่านสำเร็จ", fmt(totals.files), "ไม่รวมไฟล์ชี้แจง/หลักฐาน", 56, 205, 215, C.green);
  metric(s, "รายการ STM / PM", fmt(totals.stm), "ข้อมูลฝาก–ถอนฝั่งธนาคาร", 285, 205, 215, C.blue);
  metric(s, "รายการ BO", fmt(totals.bo), "ข้อมูลจากระบบหลังบ้าน", 514, 205, 215, C.blue);
  metric(s, "จับคู่สำเร็จ", fmt(totals.matched), `${totals.rate.toFixed(2)}% ของ STM / PM`, 743, 205, 215, C.green);
  metric(s, "บริษัท / วัน", "9 × 3", "ทุก job สถานะ completed", 972, 205, 215, C.green);
  txt(s, "แนวโน้มรายวัน", 56, 358, 300, 30, 19, C.navy, true);
  tableGrid(s, ["วัน", "ไฟล์", "STM / PM", "BO", "จับคู่", "อัตราจับคู่"], daily.map(d => [d.date, fmt(d.files), fmt(d.stm), fmt(d.bo), fmt(d.matched), `${d.rate.toFixed(2)}%`]), 56, 398, [190, 120, 190, 190, 190, 210], 48);
  pill(s, "หมายเหตุ", 56, 603, 90, C.amber, C.amberBg);
  txt(s, "29 ส.ค. มีไฟล์ชี้แจงเพิ่ม 17 ไฟล์ ซึ่งเก็บเป็นหลักฐานและไม่ถูกนับใน 92 ไฟล์ธุรกรรม", 160, 608, 930, 24, 15, C.muted);
  notes(s);
}

function addStatusSlide(p, page) {
  const s = p.slides.add(); header(s, "อ่านสถานะให้ถูกก่อนถามทีม", "คำว่า completed ยืนยันว่าอ่านไฟล์และรันจบ ไม่ได้ยืนยันว่าทุกรายการจับคู่สำเร็จ", "Control interpretation", page);
  const blocks = [
    ["1", "ครบไฟล์", "ไฟล์หลักถูกบันทึกและอ่านสำเร็จ", C.green, C.greenBg],
    ["2", "รันครบ", "สร้างผล STM, BO, match และ exception", C.blue, C.sky],
    ["3", "จับคู่ครบ", "ต้องดู match rate + exception แยกอีกชั้น", C.amber, C.amberBg],
  ];
  blocks.forEach((b, i) => {
    const x = 56 + i * 390;
    rect(s, x, 214, 360, 190, C.white, C.line, 12);
    pill(s, b[0], x + 24, 236, 38, b[3], b[4]);
    txt(s, b[1], x + 78, 234, 230, 34, 24, C.navy, true);
    txt(s, b[2], x + 24, 294, 305, 68, 18, C.muted);
  });
  rect(s, 56, 444, 1138, 150, C.white, C.line, 12);
  txt(s, "สิ่งที่ต้องถามทีม", 82, 468, 250, 28, 20, C.navy, true);
  txt(s, "• จำนวนไฟล์น้อยลงเป็นปกติหรือมีส่งตกหล่น\n• ชื่อ Provider / บัญชี / ทิศทางฝาก–ถอนตรงกันหรือไม่\n• ไฟล์ชี้แจงต้องผูกกับเคสใด ก่อนอนุมัติและปิดเคส", 82, 510, 1030, 72, 17, C.ink);
  notes(s);
}

function addPriorityMatrix(p, page) {
  const s = p.slides.add(); header(s, "เช็กลิสต์ภาพรวม 9 บริษัท", "ใช้หน้านี้เป็นรายการโทร/ถามทีมก่อน แล้วเปิดหน้ารายบริษัทเพื่อดูรายละเอียด", "Company checklist", page);
  const rows = companies.map(c => [c.name, c.files.join(" → "), `${avg(c.rate).toFixed(1)}%`, c.level, c.ask[0]]);
  tableGrid(s, ["บริษัท", "ไฟล์ 27→28→29", "เฉลี่ยจับคู่", "ระดับ", "คำถามแรกที่ต้องถาม"], rows, 56, 205, [110, 180, 140, 120, 588], 44);
  notes(s);
}

function addCompanySlide(p, c, page) {
  const s = p.slides.add();
  header(s, `${c.name} — ผล 3 วันและรายการถามทีม`, `ไฟล์หลักครบทุก job • ค่าเฉลี่ยจับคู่ ${avg(c.rate).toFixed(2)}% • วันที่ 29 มีหลักฐาน ${c.evidence29} ไฟล์`, "Company detail", page);
  pill(s, c.level, 1032, 70, 120, c.color, c.level === "เร่งตรวจ" ? C.redBg : c.level === "ปกติ" ? C.greenBg : C.amberBg);
  tableGrid(s, ["วันที่", "ไฟล์", "STM / PM", "BO", "จับคู่", "อัตรา"], [0,1,2].map(i => [["27 ส.ค.","28 ส.ค.","29 ส.ค."][i], fmt(c.files[i]), fmt(c.stm[i]), fmt(c.bo[i]), fmt(c.matched[i]), `${c.rate[i].toFixed(2)}%`]), 56, 205, [135, 95, 145, 145, 145, 145], 44);
  rect(s, 855, 205, 339, 176, C.white, C.line, 12);
  txt(s, "แนวโน้ม Match rate", 878, 222, 285, 26, 17, C.navy, true);
  rateBars(s, c.rate, 875, 250, 280, 122);
  rect(s, 56, 418, 1138, 206, C.white, C.line, 12);
  txt(s, "เช็กลิสต์ถามทีม", 80, 440, 280, 30, 20, C.navy, true);
  c.ask.forEach((a, i) => {
    pill(s, String(i + 1), 82, 486 + i * 42, 30, C.blue, C.sky);
    txt(s, a, 126, 489 + i * 42, 1018, 30, 16, C.ink, i === 0 && c.level === "เร่งตรวจ");
  });
  notes(s);
}

function addActions(p, page) {
  const s = p.slides.add(); header(s, "ลำดับการติดตามทีม", "ถามตามความเสี่ยงและความเป็นไปได้ของข้อมูลตกหล่น", "Action plan", page);
  const items = [
    ["เร่งด่วน", "SK8", "Match 3.85–13.69% ต่ำผิดปกติทั้ง 3 วัน", C.red, C.redBg],
    ["เร่งด่วน", "FR8", "ไฟล์ครบ แต่ match ลด 26.72% → 23.83%", C.red, C.redBg],
    ["ตรวจวันนี้", "MC8", "วันที่ 29 match ลดเหลือ 38.04% และพบปัญหาเวลา", C.amber, C.amberBg],
    ["ยืนยันไฟล์", "3XB / AT4 / SK8", "วันที่ 29 จำนวนไฟล์ลดลงจากวันที่ 27", C.amber, C.amberBg],
    ["ผูกหลักฐาน", "FR8 / MR9 / UFABET7M", "มีไฟล์ชี้แจงรวม 14 ไฟล์ในวันที่ 29", C.blue, C.sky],
    ["สุ่มยืนยัน", "PS8 / UR9", "ไฟล์คงที่และแนวโน้มปกติ", C.green, C.greenBg],
  ];
  items.forEach((it, i) => {
    const y = 204 + i * 70;
    rect(s, 56, y, 1138, 56, C.white, C.line, 10);
    pill(s, it[0], 74, y + 13, 108, it[3], it[4]);
    txt(s, it[1], 205, y + 14, 245, 28, 17, C.navy, true);
    txt(s, it[2], 470, y + 14, 690, 28, 16, C.muted);
  });
  notes(s);
}

function addProcess(p, page) {
  const s = p.slides.add(); header(s, "วิธีดำเนินงานของระบบ — 1 หน้า", "ผู้ใช้งานทำตามซ้ายไปขวา และหยุดเฉพาะจุดที่ระบบขึ้นสีเหลือง/แดง", "Operating guide", page);
  const steps = [
    ["1", "รับเมล", "n8n ดึงเมล\nเก็บไฟล์จริง"],
    ["2", "จัดประเภท", "บริษัท • วันที่\nSTM / BO / PM"],
    ["3", "ตรวจไฟล์", "Preview และแก้\nประเภท/บริษัท"],
    ["4", "อ่านข้อมูล", "Excel / CSV / PDF\nผ่าน quality gate"],
    ["5", "กระทบยอด", "ยอด • บัญชี\nเวลาใน tolerance"],
    ["6", "จัดการเคส", "ผูกหลักฐาน\nชี้แจง/ความเสียหาย"],
    ["7", "อนุมัติ", "ปิดเคสและ\nExport รายวัน"],
  ];
  steps.forEach((st, i) => {
    const x = 56 + i * 162;
    rect(s, x, 210, 142, 184, C.white, C.line, 12);
    pill(s, st[0], x + 16, 226, 34, C.blue, C.sky);
    txt(s, st[1], x + 16, 274, 112, 28, 18, C.navy, true);
    txt(s, st[2], x + 16, 316, 112, 58, 14, C.muted);
    if (i < steps.length - 1) txt(s, "→", x + 144, 286, 18, 28, 18, C.blue, true, "center");
  });
  rect(s, 56, 434, 1138, 170, C.white, C.line, 12);
  txt(s, "ผู้ใช้งานต้องทำอะไรเมื่อพบปัญหา", 80, 456, 420, 30, 20, C.navy, true);
  const ops = [
    ["ไฟล์อ่านไม่ได้", "เปิด Preview → อัปไฟล์ใหม่แทนที่ → บันทึกและรับต่อ"],
    ["ผิดประเภท/บริษัท", "เลือกค่าใหม่ → บันทึกและรับต่อ → ระบบส่งกลับคิวอัตโนมัติ"],
    ["ไม่พบคู่", "เปิดเคส → ดูไฟล์ประกอบ → ผูกไฟล์ชี้แจง → อนุมัติหรือส่งถามทีม"],
    ["ยอด/เวลาตรง", "ถ้าอยู่ใน tolerance ให้ปิดอัตโนมัติ; ถ้า format เสียให้คนยืนยันก่อน"],
  ];
  ops.forEach((o, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 80 + col * 555, y = 504 + row * 46;
    txt(s, o[0], x, y, 145, 24, 15, C.blue, true);
    txt(s, o[1], x + 150, y, 380, 30, 14, C.ink);
  });
  notes(s);
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const p = Presentation.create({ slideSize: { width: W, height: H } });
  addTitleSlide(p);
  addOverview(p, 2);
  addStatusSlide(p, 3);
  addPriorityMatrix(p, 4);
  companies.forEach((c, i) => addCompanySlide(p, c, 5 + i));
  addActions(p, 14);
  addProcess(p, 15);

  for (const [i, slide] of p.slides.items.entries()) {
    const stem = `slide-${String(i + 1).padStart(2, "0")}`;
    const png = await p.export({ slide, format: "png", scale: 1 });
    await fs.writeFile(`${OUT}/${stem}.png`, new Uint8Array(await png.arrayBuffer()));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(`${OUT}/${stem}.layout.json`, await layout.text());
  }
  const montage = await p.export({ format: "webp", montage: true, scale: 1 });
  await fs.writeFile(`${OUT}/audit-3day-montage.webp`, new Uint8Array(await montage.arrayBuffer()));
  const pptx = await PresentationFile.exportPptx(p);
  await pptx.save(`${OUT}/Audit-Reconciliation_27-29Aug2026_Kanit.pptx`);
}

main().catch(err => { console.error(err); process.exitCode = 1; });
