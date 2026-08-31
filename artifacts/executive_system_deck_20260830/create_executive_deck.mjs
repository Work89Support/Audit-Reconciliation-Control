import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "/Users/a/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const OUT = "/Users/a/Documents/GitHub/Audit-Reconciliation-Control/artifacts/executive_system_deck_20260830/Audit_AI_Executive_Overview_2026-08-30_Kanit.pptx";
const W = 1280, H = 720, FONT = "Kanit";
const ASSET = "/Users/a/Documents/GitHub/Audit-Reconciliation-Control";
const imagePaths = {
  dashboard: `${ASSET}/manual/09-dashboard.png`,
  exceptions: `${ASSET}/manual/13-exceptions.png`,
  drawer: `${ASSET}/manual/14-drawer.png`,
};
const imageBytes = Object.fromEntries(await Promise.all(Object.entries(imagePaths).map(async ([key,path]) => {
  const bytes = await fs.readFile(path);
  return [key, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)];
})));

const C = {
  navy: "#0A2A4A", blue: "#0868D1", blue2: "#2E86E6", sky: "#EAF4FF",
  ink: "#102A43", muted: "#627D98", line: "#D7E6F5", bg: "#F5F9FD", white: "#FFFFFF",
  green: "#118A52", greenBg: "#E7F7EE", amber: "#A76600", amberBg: "#FFF3D6",
  red: "#C43636", redBg: "#FDEBEC", dark: "#123A60"
};

const daily = [
  ["27 ส.ค.", 110, 14967, 15933, 6263, 41.85],
  ["28 ส.ค.", 103, 16389, 17345, 8009, 48.87],
  ["29 ส.ค.", 92, 16385, 18323, 7538, 46.01],
];
const companies = [
  ["3XB", "15 / 13 / 9", 50.56, "ติดตาม", "จำนวนไฟล์วันที่ 29 ลดลง"],
  ["AT4", "15 / 13 / 10", 36.29, "ติดตาม", "ยืนยันชุดฝาก/ถอนทุก Provider"],
  ["FR8", "14 / 16 / 15", 25.50, "เร่งตรวจ", "ไฟล์ครบ แต่จับคู่ต่ำต่อเนื่อง"],
  ["MC8", "8 / 10 / 10", 49.62, "ติดตาม", "วันที่ 29 ลดเหลือ 38.04%"],
  ["MR9", "11 / 10 / 10", 51.36, "ติดตาม", "ผูกหลักฐานกับเคสที่ไม่พบคู่"],
  ["PS8", "11 / 11 / 11", 65.92, "ปกติ", "ใช้เป็น baseline"],
  ["SK8", "18 / 12 / 10", 9.71, "เร่งตรวจ", "ตรวจ mapping/rule ก่อนสรุป"],
  ["UFABET7M", "7 / 7 / 7", 76.91, "ติดตาม", "ไฟล์คงที่ แต่อัตราจับคู่ลด"],
  ["UR9", "11 / 11 / 11", 46.53, "ปกติ", "ไฟล์คงที่ แนวโน้มดีขึ้น"],
];

const fmt = n => Number(n).toLocaleString("en-US");

function rect(s,x,y,w,h,fill,line="none",r=12){
  return s.shapes.add({geometry:"roundRect",position:{left:x,top:y,width:w,height:h},fill,line:{style:"solid",fill:line,width:line==="none"?0:1},borderRadius:r});
}
function txt(s,text,x,y,w,h,size=20,color=C.ink,bold=false,align="left",valign="top"){
  const t=s.shapes.add({geometry:"textbox",position:{left:x,top:y,width:w,height:h},fill:"none",line:{style:"solid",fill:"none",width:0}});
  t.text=String(text); t.text.style={fontSize:size,typeface:FONT,color,bold,alignment:align,verticalAlignment:valign,autoFit:"shrinkText",wrap:true,insets:{left:0,right:0,top:0,bottom:0}}; return t;
}
function line(s,x,y,w,color=C.line,width=1){return s.shapes.add({geometry:"straightConnector1",position:{left:x,top:y,width:w,height:0},fill:"none",line:{style:"solid",fill:color,width}});}
function pill(s,label,x,y,w,color,bg){rect(s,x,y,w,30,bg,"none",15);txt(s,label,x,y+3,w,24,14,color,true,"center","middle");}
function header(s,title,subtitle,section,page){
  s.background.fill=C.bg; txt(s,section.toUpperCase(),56,30,450,24,13,C.blue,true); txt(s,title,56,58,965,52,32,C.navy,true);
  txt(s,subtitle,56,115,1080,40,16,C.muted); txt(s,String(page).padStart(2,"0"),1180,34,44,22,12,C.muted,true,"right"); line(s,56,170,1168);
}
function metric(s,label,value,note,x,y,w,accent=C.blue){
  rect(s,x,y,w,118,C.white,C.line,12); s.shapes.add({geometry:"rect",position:{left:x,top:y,width:6,height:118},fill:accent,line:{style:"solid",fill:accent,width:0}});
  txt(s,label,x+22,y+15,w-34,22,14,C.muted); txt(s,value,x+22,y+42,w-34,38,28,C.navy,true); txt(s,note,x+22,y+87,w-34,22,12,C.muted);
}
function notes(s, sources){
  const lines=sources.map(v=>`- ${v}`).join("\n"); s.speakerNotes.textFrame.setText(`[Sources]\n${lines}\n[/Sources]`);
}
function table(s,headers,rows,x,y,widths,rowH=38,font=13){
  const total=widths.reduce((a,b)=>a+b,0); rect(s,x,y,total,rowH*(rows.length+1),C.white,C.line,8);
  let cx=x; headers.forEach((v,i)=>{txt(s,v,cx+8,y+8,widths[i]-16,22,font,C.navy,true,i===0?"left":"center");cx+=widths[i];}); line(s,x,y+rowH,total);
  rows.forEach((row,ri)=>{const yy=y+rowH*(ri+1);if(ri%2===1)s.shapes.add({geometry:"rect",position:{left:x+1,top:yy,width:total-2,height:rowH},fill:"#F8FBFE",line:{style:"solid",fill:"none",width:0}});let xx=x;row.forEach((v,ci)=>{txt(s,v,xx+8,yy+8,widths[ci]-16,22,font,ci===0?C.ink:C.muted,ci===0,ci===0?"left":"center");xx+=widths[ci];});if(ri<rows.length-1)line(s,x,yy+rowH,total);});
}
function image(s,key,x,y,w,h,fit="cover"){return s.images.add({blob:imageBytes[key],contentType:"image/png",alt:"ภาพหน้าจอระบบ Audit AI",fit,position:{left:x,top:y,width:w,height:h},geometry:"roundRect",borderRadius:"rounded-xl"});}
function callout(s,label,title,body,x,y,w,color=C.blue,bg=C.sky){
  rect(s,x,y,w,126,C.white,C.line,12); pill(s,label,x+18,y+16,38,color,bg); txt(s,title,x+70,y+17,w-90,30,19,C.navy,true); txt(s,body,x+20,y+58,w-40,54,15,C.muted);
}

const p=Presentation.create({slideSize:{width:W,height:H}});

// 1 Cover
{
  const s=p.slides.add(); s.background.fill=C.navy;
  s.shapes.add({geometry:"rect",position:{left:0,top:0,width:14,height:H},fill:C.blue,line:{style:"solid",fill:C.blue,width:0}});
  txt(s,"AUDIT AI · RECONCILIATION CONTROL",62,48,600,26,14,"#83C0FF",true);
  txt(s,"ระบบตรวจสอบและ\nกระทบยอดอัตโนมัติ",62,142,590,126,46,C.white,true);
  txt(s,"ภาพรวมผู้บริหาร • ผลจริง 27–29 สิงหาคม 2026\nปัญหาที่พบ • วิธีใช้งาน • การควบคุมสิทธิ์",66,300,560,86,21,"#C7DBEE");
  rect(s,62,535,555,100,"#123A60","#2A577F",14); txt(s,"ข้อสรุป",84,555,100,22,14,"#83C0FF",true);
  txt(s,"ระบบทำงานครบวงจรแล้ว แต่ต้องแยก “ไฟล์ครบ” ออกจาก “จับคู่ครบ” และติดตามคุณภาพข้อมูลรายบริษัท",84,582,500,40,18,C.white,true);
  image(s,"exceptions",690,70,535,570,"cover");
  notes(s,["Internal production results (Supabase), checked 2026-08-30.","Repository UI screenshot: manual/13-exceptions.png."]);
}

// 2 Executive summary
{
  const s=p.slides.add(); header(s,"Executive Summary","ระบบอ่านไฟล์และรันครบ 27 งาน แต่ผลจับคู่ยังต่างกันมากในแต่ละบริษัท","Overview",2);
  metric(s,"ไฟล์หลักอ่านสำเร็จ",fmt(305),"ไม่รวมไฟล์ชี้แจง",56,205,215,C.green);
  metric(s,"STM / PM",fmt(47741),"รายการฝาก–ถอน",285,205,215,C.blue);
  metric(s,"BO",fmt(51601),"รายการหลังบ้าน",514,205,215,C.blue);
  metric(s,"จับคู่สำเร็จ",fmt(21810),"45.68% ของ STM/PM",743,205,215,C.green);
  metric(s,"ขอบเขต", "9 × 3", "9 บริษัท × 3 วัน",972,205,215,C.green);
  rect(s,56,354,1138,245,C.white,C.line,12);
  txt(s,"สาระที่ผู้บริหารควรรู้",80,378,420,30,22,C.navy,true);
  const bullets=[
    ["1","สถานะ completed","หมายถึงอ่านไฟล์และคำนวณจบ ไม่ได้หมายถึงจับคู่ครบทุกธุรกรรม",C.blue,C.sky],
    ["2","จุดเสี่ยงหลัก","SK8 และ FR8 จับคู่ต่ำต่อเนื่อง ควรตรวจ mapping / เวลา / Provider",C.red,C.redBg],
    ["3","การควบคุม","มีหลักฐานย้อนกลับ สิทธิ์ตามบทบาท และไม่มีบทบาทใดลบรายการ/หลักฐานถาวรได้",C.green,C.greenBg],
  ];
  bullets.forEach((b,i)=>{pill(s,b[0],82,427+i*52,32,b[3],b[4]);txt(s,b[1],128,428+i*52,190,25,16,C.navy,true);txt(s,b[2],320,428+i*52,820,32,15,C.muted);});
  notes(s,["Internal production results: 305 core files, 47,741 STM/PM, 51,601 BO, 21,810 matched; checked 2026-08-30.","README.md role and deletion controls."]);
}

// 3 architecture
{
  const s=p.slides.add(); header(s,"ระบบทำงานอย่างไร","จากอีเมลจริงไปสู่รายงานผู้บริหาร พร้อมหลักฐานและร่องรอยการอนุมัติ","End-to-end flow",3);
  const steps=[
    ["1","Gmail","รับเมลและไฟล์แนบ"],["2","n8n","จัดคิวและกันซ้ำ"],["3","Supabase","เก็บไฟล์ + metadata"],
    ["4","Parser","อ่าน Excel/CSV/PDF"],["5","3-Point Match","เทียบยอด บัญชี เวลา"],["6","Case Workflow","ชี้แจง/หลักฐาน/อนุมัติ"],["7","Report","รายวัน + Export"]
  ];
  steps.forEach((st,i)=>{const x=42+i*174;rect(s,x,228,150,180,C.white,C.line,12);pill(s,st[0],x+16,246,34,C.blue,C.sky);txt(s,st[1],x+16,292,118,26,18,C.navy,true);txt(s,st[2],x+16,330,118,52,14,C.muted);if(i<steps.length-1)txt(s,"→",x+150,299,24,30,20,C.blue,true,"center");});
  rect(s,56,458,1138,142,C.white,C.line,12); txt(s,"จุดควบคุมสำคัญ",80,480,270,27,19,C.navy,true);
  txt(s,"• กันไฟล์ซ้ำด้วย message/file identity     • Quality gate ก่อนกระทบยอด     • tolerance เวลา/ยอดตั้งค่าได้\n• ทุกการเปลี่ยนสถานะมี Audit Log     • ไฟล์ต้นฉบับและไฟล์แทนที่เก็บประวัติ",80,520,1060,58,16,C.ink);
  notes(s,["n8n workflow and repository architecture.","Supabase schema and RLS migrations in repository."]);
}

// 4 what leaders see
{
  const s=p.slides.add(); header(s,"ผู้บริหารเห็นอะไรในระบบ","มุมมองเดียวติดตามความครบถ้วน คุณภาพการจับคู่ ความเสี่ยง และหลักฐาน","Management visibility",4);
  image(s,"dashboard",56,205,710,420,"cover");
  rect(s,794,205,400,420,C.white,C.line,12); txt(s,"ข้อมูลที่ใช้ตัดสินใจ",820,230,330,28,21,C.navy,true);
  const items=["ไฟล์ที่ได้รับ / อ่านสำเร็จ / ต้องแก้","จำนวน STM/PM, BO และอัตราจับคู่","Exception ตามบริษัท ประเภท และ SLA","งานรอชี้แจง / รออนุมัติ / ปิดเคส","ทะเบียนความเสียหายและยอดรวม","Export รายวันและ Audit Log"];
  items.forEach((v,i)=>{pill(s,String(i+1),822,276+i*49,30,C.blue,C.sky);txt(s,v,866,278+i*49,292,30,15,C.ink,i<2);});
  pill(s,"ภาพหน้าจอ",820,586,100,C.amber,C.amberBg);txt(s,"ใช้แสดงโครงสร้างหน้าจอ ตัวเลขผลจริงอยู่ในสไลด์ 2, 5–7",934,590,230,28,12,C.muted);
  notes(s,["Repository UI screenshot: manual/09-dashboard.png (layout illustration).","Validated production metrics are reported separately on slides 2, 5–7."]);
}

// 5 daily evidence
{
  const s=p.slides.add(); header(s,"ผลจริง 3 วันแรก","ปริมาณรายการเพิ่มขึ้น แต่ Match rate อยู่ในช่วง 41.85–48.87%","Validated results",5);
  table(s,["วัน","ไฟล์หลัก","STM / PM","BO","จับคู่","อัตราจับคู่"],daily.map(d=>[d[0],fmt(d[1]),fmt(d[2]),fmt(d[3]),fmt(d[4]),`${d[5].toFixed(2)}%`]),56,210,[180,140,190,190,190,220],54,14);
  txt(s,"อัตราจับคู่รายวัน",56,430,260,26,19,C.navy,true);
  const colors=[C.amber,C.green,C.blue]; daily.forEach((d,i)=>{const x=120+i*340;const bw=190;const bh=150*d[5]/100;rect(s,x,600-bh,bw,bh,colors[i],"none",8);txt(s,`${d[5].toFixed(2)}%`,x,565-bh,bw,28,19,C.navy,true,"center");txt(s,d[0],x,610,bw,24,14,C.muted,true,"center");});
  pill(s,"หมายเหตุ",900,443,90,C.amber,C.amberBg);txt(s,"วันที่ 29 มีหลักฐาน 17 ไฟล์ แยกจาก 92 ไฟล์ธุรกรรม",1004,447,190,50,13,C.muted);
  notes(s,["Internal Supabase production data: daily_recon_jobs, recon_runs, source_files; checked 2026-08-30."]);
}

// 6 company table
{
  const s=p.slides.add(); header(s,"ภาพรวมรายบริษัท","สถานะไฟล์ครบไม่เท่ากับคุณภาพการจับคู่—จึงต้องอ่านสองมิติพร้อมกัน","Company view",6);
  const rows=companies.map(c=>[c[0],c[1],`${c[2].toFixed(2)}%`,c[3],c[4]]);
  table(s,["บริษัท","ไฟล์ 27 / 28 / 29","เฉลี่ยจับคู่","สถานะ","ประเด็นติดตาม"],rows,56,200,[110,200,150,120,558],43,13);
  notes(s,["Internal Supabase production data for 9 companies, 2026-08-27 through 2026-08-29."]);
}

// 7 priority
{
  const s=p.slides.add(); header(s,"จุดที่ต้องเร่งติดตาม","จัดลำดับจากความเสี่ยงของข้อมูล ไม่ใช่จากจำนวนไฟล์เพียงอย่างเดียว","Risk focus",7);
  callout(s,"1","SK8 · เร่งตรวจ","เฉลี่ยจับคู่ 9.71% — ตรวจ rule, mapping, ประเภทข้อมูลและทิศทาง D/W",56,205,535,C.red,C.redBg);
  callout(s,"2","FR8 · เร่งตรวจ","เฉลี่ยจับคู่ 25.50% — ไฟล์ครบแต่จับคู่ต่ำ ต้องตรวจเวลาและ Provider",659,205,535,C.red,C.redBg);
  callout(s,"3","MC8 · ติดตาม","วันที่ 29 ลดเหลือ 38.04% และเคยพบรูปแบบเวลา NaN/undefined",56,355,535,C.amber,C.amberBg);
  callout(s,"4","UFABET7M · ติดตาม","จำนวนไฟล์คงที่ แต่อัตราจับคู่ลด 87.73% → 61.34%",659,355,535,C.amber,C.amberBg);
  rect(s,56,522,1138,98,C.white,C.line,12);txt(s,"หลักตัดสินใจ",80,542,180,25,18,C.navy,true);txt(s,"ถ้าไฟล์ครบแต่ Match rate ต่ำ → ตรวจ rule/mapping  |  ถ้าไฟล์ลดลง → เช็ค Gmail/Supabase  |  ถ้ามีหลักฐาน → ผูกกับเคสก่อนปิด",270,542,880,50,15,C.ink);
  notes(s,["Company-level results summarized from production data, checked 2026-08-30."]);
}

// 8 issues and remediation
{
  const s=p.slides.add(); header(s,"ปัญหาที่พบและการควบคุม","แยกเหตุการณ์ในช่วงทดสอบออกจากความเสี่ยงที่ต้องเฝ้าระวังต่อเนื่อง","Issues & controls",8);
  table(s,["ปัญหาที่พบ","ผลกระทบ","สิ่งที่ทำ/ควบคุมแล้ว","สถานะ"],[
    ["n8n quota เต็ม","Gmail/Worker หยุด และ Telegram เงียบ","ลดรอบซ้ำ รวมแจ้งเตือนในรอบเดียว เฝ้าดู usage","เฝ้าระวัง"],
    ["โหลดส่วนกลาง timeout","หน้าเคยแสดง 0 ทั้งที่มีข้อมูล","โหลดแบบแยกส่วน + retry + ไม่แทน missing ด้วย 0","ปรับแล้ว"],
    ["ตัวกรอง/Cache ค้าง","เลือกบริษัทแต่ KPI ยังเป็นยอดรวม","ผูก cache key กับวัน/บริษัท/ประเภท","ปรับแล้ว"],
    ["Preview ไฟล์ไม่ได้","ยืนยันหลักฐานและประเภทไฟล์ยาก","signed URL fallback + ดาวน์โหลด + replace/requeue","ปรับแล้ว"],
    ["หัวตาราง/เวลาไม่มาตรฐาน","อ่านไฟล์ไม่ครบหรือจับคู่ผิด","mapping ต่อ Provider + quality gate + manual override","ต่อเนื่อง"],
  ],56,205,[245,245,475,173],62,12);
  pill(s,"ข้อควรระวัง",56,603,110,C.red,C.redBg);txt(s,"ตัวเลขศูนย์ต้องหมายถึง “โหลดสำเร็จและเป็นศูนย์” เท่านั้น หากข้อมูลไม่พร้อมต้องแสดง — หรือข้อความเตือน",180,607,1000,25,14,C.muted);
  notes(s,["QA-REPORT-2026-08-29.md and test-report screenshots.","Current repository fixes and automated tests reviewed 2026-08-30."]);
}

// 9 use system
{
  const s=p.slides.add(); header(s,"วิธีใช้งานประจำวัน","ผู้ใช้เดินตาม 5 ขั้น และกดไปต่อจากหน้าที่กำลังทำได้","Daily operating flow",9);
  image(s,"exceptions",56,205,690,420,"cover");
  rect(s,774,205,420,420,C.white,C.line,12);txt(s,"ขั้นตอนการทำงาน",800,228,340,28,21,C.navy,true);
  const steps=[["1","ตรวจไฟล์","ดูไฟล์ครบ/อ่านได้/ประเภทถูก"],["2","ดูภาพรวม","เลือก 1 บริษัท + 1 วัน"],["3","ตรวจข้อผิดปกติ","กรองยอด เวลา Provider และ SLA"],["4","ติดตาม/อนุมัติ","ส่งชี้แจง ผูกหลักฐาน ปิดเคส"],["5","ออกรายงาน","Export รายวันและเก็บ Audit Log"]];
  steps.forEach((v,i)=>{pill(s,v[0],800,272+i*63,32,C.blue,C.sky);txt(s,v[1],846,270+i*63,150,24,16,C.navy,true);txt(s,v[2],846,295+i*63,310,28,13,C.muted);});
  notes(s,["Repository UI screenshot: manual/13-exceptions.png (layout illustration).","README.md operational workflow."]);
}

// 10 bad file flow
{
  const s=p.slides.add(); header(s,"เมื่อไฟล์ผิดประเภทหรืออ่านไม่ได้","แก้ที่ไฟล์ต้นทางโดยไม่ทำลายประวัติ และส่งกลับเข้าคิวอัตโนมัติ","File remediation",10);
  const flow=[
    ["1","เปิด Preview","ดูชื่อไฟล์ เนื้อหา บริษัท วันที่"],
    ["2","แก้ Metadata","เลือกบริษัทและประเภทไฟล์ที่ถูก"],
    ["3","แทนที่ไฟล์","อัปโหลดฉบับแก้ หากต้นฉบับเสีย"],
    ["4","บันทึกและรันต่อ","ระบบเก็บเวอร์ชันเดิมและ requeue"],
  ];
  flow.forEach((v,i)=>{const x=56+i*285;callout(s,v[0],v[1],v[2],x,205,260,C.blue,C.sky);if(i<3)txt(s,"→",x+260,248,25,30,20,C.blue,true,"center");});
  rect(s,56,367,1138,240,C.white,C.line,12);txt(s,"ประเภทไฟล์ที่ผู้ใช้เลือกได้",80,390,380,26,20,C.navy,true);
  const kinds=["STM ฝาก-ถอน","BO รายงานหลังบ้าน","PM ฝาก/ถอน","ฝากมือ - เครดิต","ฝากมือ - Payment","ฝากมือ - โบนัส","ถอนค่าคอมมิชชั่น","ถอนเครดิต","ไฟล์ชี้แจง/หลักฐาน","ยังไม่ทราบประเภท"];
  kinds.forEach((k,i)=>{const col=i%2,row=Math.floor(i/2);pill(s,"•",82+col*540,435+row*31,24,C.blue,C.sky);txt(s,k,116+col*540,435+row*31,460,25,14,C.ink);});
  notes(s,["README.md file correction and replacement workflow.","Application file-type definitions in data.js/app.js."]);
}

// 11 exception decision
{
  const s=p.slides.add(); header(s,"วิธีตัดสินใจและปิดเคส","ระบบช่วยจับคู่ก่อน คนตรวจเฉพาะเรื่องที่เกินเกณฑ์หรือไม่มีหลักฐาน","Exception workflow",11);
  image(s,"drawer",56,205,410,430,"contain");
  rect(s,496,205,698,430,C.white,C.line,12);txt(s,"Decision path",522,228,220,26,20,C.navy,true);
  const rows=[
    ["ยอด + บัญชี + เวลาอยู่ใน tolerance","ปิดอัตโนมัติ / ไม่สร้างเคส",C.green,C.greenBg],
    ["ยอดตรง แต่เวลาคลาดเล็กน้อย","Low — ตรวจตาม tolerance",C.amber,C.amberBg],
    ["ไม่พบอีกฝั่ง / บัญชีหรือยอดไม่ตรง","สร้าง Exception และส่งชี้แจง",C.red,C.redBg],
    ["มีไฟล์ชี้แจง/หลักฐาน","Preview → ผูกเคส → Audit Lead อนุมัติ",C.blue,C.sky],
    ["ยืนยันความเสียหาย","บันทึกทะเบียนความเสียหายและปิดรอบ",C.red,C.redBg],
  ];
  rows.forEach((r,i)=>{rect(s,522,276+i*62,640,50,C.bg,C.line,9);pill(s,String(i+1),536,286+i*62,28,r[2],r[3]);txt(s,r[0],580,284+i*62,290,24,14,C.navy,true);txt(s,r[1],875,284+i*62,270,34,13,C.muted);});
  notes(s,["Repository UI screenshot: manual/14-drawer.png (case workflow illustration).","Reconciliation rules and exception workflow in README.md."]);
}

// 12 roles
{
  const s=p.slides.add(); header(s,"บทบาทและสิทธิ์ใช้งาน","เห็นข้อมูลตามหน้าที่ ลดการแก้ไขผิดคน และเก็บผู้ดำเนินการทุกขั้น","Governance",12);
  table(s,["บทบาท","เห็นข้อมูล","ทำรายการได้","ข้อจำกัด"],[
    ["เจ้าหน้าที่ Audit","บริษัทที่รับผิดชอบ","ตรวจไฟล์ ใส่ note ส่งชี้แจง","อนุมัติ/ตั้งค่าไม่ได้"],
    ["Audit Lead","ทุกบริษัทในขอบเขต","อนุมัติ ปิดเคส ปิดรอบความเสียหาย","ลบหลักฐานถาวรไม่ได้"],
    ["ผู้ชี้แจงบริษัท","เฉพาะบริษัทตนเอง","ตอบชี้แจงและแนบหลักฐาน","ไม่เห็นข้อมูลบริษัทอื่น"],
    ["ผู้บริหาร / การเงิน","ภาพรวมและรายงาน","ดูและ Export","ไม่แก้ข้อมูลปฏิบัติการ"],
    ["ผู้ดูแลระบบ","ทุกหน้า ทุกบริษัท","เพิ่มผู้ใช้ กำหนดสิทธิ์ ช่วยทุก workflow","ลบ transaction/หลักฐานถาวรไม่ได้"],
  ],56,205,[190,245,420,283],62,13);
  rect(s,56,548,1138,72,C.greenBg,"none",12);txt(s,"การเพิ่มผู้ใช้",80,570,140,24,17,C.green,true);txt(s,"ระบบ → ผู้ใช้และสิทธิ์ → + เพิ่มผู้ใช้ → กรอกอีเมล/ชื่อ/บทบาท/บริษัท → ส่งคำเชิญ",220,569,920,30,15,C.ink);
  notes(s,["README.md role matrix and user invitation flow.","Supabase RLS migration for role/company access."]);
}

// 13 decisions
{
  const s=p.slides.add(); header(s,"ข้อเสนอเพื่ออนุมัติและทำต่อ","ทำให้ระบบเป็นแหล่งรายงานอย่างเป็นทางการโดยควบคุมข้อมูลตั้งแต่ต้นทาง","Next 30 days",13);
  callout(s,"1","มาตรฐานไฟล์","บังคับ template ชื่อไฟล์ + column mapping ต่อ Provider และตรวจก่อนส่ง",56,205,535,C.blue,C.sky);
  callout(s,"2","Daily sign-off","ทุกวันเลือก 1 บริษัท/วัน ตรวจครบไฟล์ → exception → หลักฐาน → export",659,205,535,C.green,C.greenBg);
  callout(s,"3","SLA และความเสี่ยง","เร่ง SK8/FR8 และตั้งเจ้าของเคสตามบริษัท พร้อม Telegram สรุปรายวัน",56,355,535,C.red,C.redBg);
  callout(s,"4","Capacity control","ติดตาม n8n execution, Supabase storage/database และแจ้งเตือนก่อนเต็ม",659,355,535,C.amber,C.amberBg);
  rect(s,56,520,1138,102,C.navy,"none",12);txt(s,"มติที่ต้องการ",80,540,180,24,15,"#83C0FF",true);txt(s,"อนุมัติให้ใช้ผลตั้งแต่ 27 ส.ค. เป็น baseline จริง พร้อมกำหนดเจ้าของข้อมูล 9 บริษัทและตรวจ Daily sign-off ทุกวัน",80,570,1060,36,21,C.white,true);
  notes(s,["Management recommendations based on validated 3-day results and QA findings."]);
}

await PresentationFile.exportPptx(p).then(buf=>buf.save(OUT));
console.log(OUT);
