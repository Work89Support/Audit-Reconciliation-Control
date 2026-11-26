import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),G=require('../tmn-row-geometry.js'),P=require('../tmn-page-ocr.js');
const file={id:'synthetic-source',kind:'stm_pdf',file_name:'UFABET7M_STM_TMN_รุ่งฟ้า_DW_2026-11-25.pdf'};
const job={company:'UFABET7M',business_date:'2026-11-25'},hash='a'.repeat(64);
const page=(n,clocks,heading='')=>({page:n,pageCount:3,sourceFileId:file.id,sourceSha256:hash,pageSha256:String(n).repeat(64),sourceImageSha256:'b'.repeat(64),
 rowLayout:true,sourceGraphics:{version:'tmn-single-image-graphics-v1'},
 geometry:{version:'tmn-pixel-row-v1',header:[0,0,500,100],rows:clocks.map((_,i)=>({row:i+1,desc:[0,100+i*100,300,20],amount:[300,100+i*100,100,20],time:[0,130+i*100,100,20]}))},
 text:'HEAD\n'+heading+'\n'+clocks.map((time,i)=>`ROW ${i+1}\n${n===2&&i===0?'ค่าธรรมเนียมการรับเงินโอน\n-฿ 1.00':'รับเงินจาก ตัวอย่าง\n+฿ 100.00'}\n${time}`).join('\n')});
const envelope={version:'tmn-page-ocr-v1',sourceFileId:file.id,sourceSha256:hash,pageCount:3,pages:[page(1,['18:40','09:33']),page(2,['23:15','20:02']),page(3,['23:52','23:19'],'25 พฤศจิกายน 2569')]};
const run=e=>P.normalize(G.bind(e),file,job);
const out=run(envelope);
assert.equal(out.records.length,5);assert.equal(out.quality.pages.length,3);
assert.equal(out.dropped['ค่าธรรมเนียม TMN (ไม่นำเข้ากระทบยอด)'],1);
assert.ok(out.records.every(r=>r.date==='2026-11-25'&&r.sourceDateEvidence.page===3));
assert.equal(out.quality.dateEvidence.sourcePageSha256,'3'.repeat(64));
assert.deepEqual(out.records.map(r=>r.sourceRowId),['P1-R1','P1-R2','P2-R2','P3-R1','P3-R2']);
for(const change of [
 e=>e.pages[2].text=e.pages[2].text.replace('25 พฤศจิกายน 2569','เมื่อวานนี้'),
 e=>e.pages[1].text=e.pages[1].text.replace('HEAD','HEAD\n24 พฤศจิกายน 2569'),
 e=>e.pages[1].text=e.pages[1].text.replace('20:02','17:00'),
 e=>e.pages[0].text=e.pages[0].text.replace('09:33','19:00'),
 e=>delete e.pages[0].sourceGraphics,
 e=>e.pages[1].text=e.pages[1].text.replace('23:15',''),
 e=>e.pages[1].text=e.pages[1].text.replace('-฿ 1.00',''),
 e=>e.pages[2].text=e.pages[2].text.replace('25 พฤศจิกายน 2569','').replace('23:52','23:52\n25 พฤศจิกายน 2569'),
]){const changed=structuredClone(envelope);change(changed);assert.throws(()=>run(changed),/TMN|Row/);}
const repeat=structuredClone(envelope);repeat.pages[0]=page(1,['18:40','18:40']);repeat.pages[1]=page(2,['23:19','20:02']);
assert.equal(run(repeat).records.filter(r=>r.sec===18*3600+40*60).length,2,'เวลาและคนซ้ำยังเป็นคนละแถว');
// หัววันที่ที่หน้าแรกยังใช้การต่อหน้าปกติ ไม่เปลี่ยนวันที่ตามชื่อไฟล์
const normal=structuredClone(envelope);normal.pages[0].text=normal.pages[0].text.replace('HEAD','HEAD\n24 พฤศจิกายน 2569');
assert.equal(run(normal).records[0].sourceDate,'2026-11-24');assert.equal(run(normal).records.at(-1).sourceDate,'2026-11-25');
console.log('PASS TMN last-page absolute date, strict page chronology, source provenance, duplicates and fail-closed date guards');
