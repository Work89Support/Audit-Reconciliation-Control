import assert from'node:assert/strict';import{createRequire}from'node:module';const require=createRequire(import.meta.url),G=require('../tmn-row-geometry.js'),OCR=require('../tmn-page-ocr.js');
const file={id:'fake-physical-source',kind:'stm_pdf',file_name:'UFABET7M_STM_TMN_รุ่งฟ้า_DW_2026-11-22.pdf'},job={company:'UFABET7M',business_date:'2026-11-22'};
const region={row:1,desc:[10,10,20,20],amount:[50,10,20,20],time:[10,40,20,20],bottomClipped:false};
const page=(i,text,rows=[region])=>({page:i,pageCount:2,sourceFileId:file.id,sourceSha256:'a'.repeat(64),pageSha256:'b'.repeat(64),sourceImageSha256:'c'.repeat(64),rowLayout:true,geometry:{version:'tmn-pixel-row-v1',width:591,height:1280,header:[0,110,591,30],rows},text});
const e={version:'tmn-page-ocr-v1',sourceFileId:file.id,sourceSha256:'a'.repeat(64),pageCount:2,pages:[page(1,'HEAD\n22 พฤศจิกายน 2569\nROW 0001\nรับเงินจาก ทดสอบ\n+฿ 4,000.00\n08:44'),page(2,'HEAD\nROW 0001\nรับเงินจาก ทดสอบ\n+฿ 4,000.00\n08:44\nTAIL')]};
let bound=G.bind(e),out=OCR.normalize(bound,file,job);assert.equal(out.records.length,2);assert.deepEqual(out.records.map(r=>r.sourceRowId),['P1-R1','P2-R1']);assert.deepEqual(out.records[0].sourceRegions.desc,region.desc);assert.equal(out.records[0].sourceImageSha256,'c'.repeat(64));assert.equal(e.pages[0].rowEvidence,undefined,'input must remain unchanged');
const bad=structuredClone(e);bad.pages[1].text=bad.pages[1].text.replace('ROW 0001','ROW 0002');assert.throws(()=>OCR.normalize(G.bind(bad),file,job),/coverage/);
const missing=structuredClone(e);missing.pages[0].text=missing.pages[0].text.replace('+฿ 4,000.00','');assert.throws(()=>OCR.normalize(G.bind(missing),file,job),/missing\/ambiguous amount/);
const two=structuredClone(e);two.pages[0].text+='\n+฿ 4,000.00';assert.throws(()=>OCR.normalize(G.bind(two),file,job),/missing\/ambiguous amount/);
const cut=structuredClone(e);cut.pages[0].geometry.rows[0].bottomClipped=true;cut.pages[0].text=cut.pages[0].text.replace('08:44','');cut.pages[1].text='HEAD\n08:44\n'+cut.pages[1].text;out=OCR.normalize(G.bind(cut),file,job);assert.equal(out.records.length,2);assert.equal(out.records[0].sourceFragments[0].page,2);assert.equal(out.records[1].sourceFragments.length,0);
const noProof=structuredClone(cut);noProof.pages[0].geometry.rows[0].bottomClipped=false;assert.throws(()=>OCR.normalize(G.bind(noProof),file,job),/cropped source row|missing\/ambiguous time/);
const multiple=structuredClone(cut);multiple.pages[1].text=multiple.pages[1].text.replace('HEAD','HEAD\n07:43');assert.throws(()=>OCR.normalize(G.bind(multiple),file,job),/cropped source row|missing\/ambiguous time/);
// Physical band discovery, absence checks and deterministic pixel copying.
const width=400,height=900,pixels=new Uint8Array(width*height*3);pixels.fill(255);
function black(x,y,w,h){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)pixels.fill(0,(yy*width+xx)*3,(yy*width+xx)*3+3);}
for(const y of [140,300]){black(90,y,120,10);black(320,y,30,10);}
const geometry=G.analyze({width,height,data:pixels});assert.equal(geometry.rows.length,2);for(const r of geometry.rows)assert.ok(r.desc.every(Number.isInteger)&&r.time.every(Number.isInteger));
const flow=G.reflow({width,height,data:pixels},geometry),again=G.reflow({width,height,data:pixels},geometry);assert.deepEqual(flow.data,again.data);assert.equal(flow.blocks.length,4);assert.ok(flow.blocks[2].y>flow.blocks[1].y);assert.ok(flow.data.some(x=>x===0),'every later block must actually be painted');
assert.throws(()=>G.analyze({width,height,data:new Uint8Array(width*height*3).fill(255)}),/bands unavailable/);
console.log('PASS physical TMN row crops, duplicate occurrences, source-region evidence, no mutation and strictly proven cropped continuation; no services or database writes');
