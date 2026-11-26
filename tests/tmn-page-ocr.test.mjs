import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {sha256,patchTmnPageOcr,PAGE_NODE,collectCode} from '../scripts/tmn-page-ocr-workflow.mjs';
const require=createRequire(import.meta.url),OCR=require('../tmn-page-ocr.js');
for(const input of ['', 'abc','a'.repeat(1000)]) assert.equal(sha256(Buffer.from(input)),crypto.createHash('sha256').update(input).digest('hex'));
const file={id:'test-source',file_name:'UFABET7M_STM_TMN_รุ่งฟ้า_DW_2026-11-22.pdf',kind:'stm_pdf'};
const job={company:'UFABET7M',business_date:'2026-11-22'};
const page=(n,text)=>({page:n,pageCount:2,sourceFileId:file.id,sourceSha256:'a'.repeat(64),pageSha256:String(n).repeat(64),text});
const row=(amount,time='08:44')=>`รับเงินจาก ตัวอย่าง ก*** +฿ ${amount}\n${time}`;
const input={version:'tmn-page-ocr-v1',sourceFileId:file.id,sourceSha256:'a'.repeat(64),pageCount:2,pages:[
 page(1,'รายการ\n22 พฤศจิกายน 2569\nเมื่อวานนี้\n'+row('4,000.00')+'\nค่าธรรมเนียมการรับเงินโอน -฿ 0.58\n08:44'),
 page(2,row('4,000.00')+'\n'+row('10.00')+'\n'+row('1,000.00')+'\n'+row('40.00')+'\n'+row('53.00')+'\n'+row('953.00'))]};
const parse=x=>OCR.normalize(x,file,job),out=parse(input);
assert.deepEqual(out.records.map(r=>r.amount),[4000,4000,10,1000,40,53,953]);
assert.equal(out.quality.pages[0].feeCount,1);
assert.equal(out.records[0].sourceRowId,'P1-R1');assert.equal(out.records[1].sourceRowId,'P2-R1');
assert.equal(out.quality.pages[0].rows[1].sourceRowId,'P1-R2');
assert.equal(out.records[0].account,'0812792075');
assert.deepEqual(parse({...input,pages:input.pages.toReversed()}),out,'arrival order must not change physical page order');
function rejects(change,pattern){const x=structuredClone(input);change(x);assert.throws(()=>parse(x),pattern);}
rejects(x=>x.pages.pop(),/coverage/);
rejects(x=>x.pages[1].page=1,/duplicated/);
rejects(x=>x.pages[1].sourceSha256='b'.repeat(64),/missing/);
rejects(x=>x.pages[1].error='timeout',/failed/);
rejects(x=>x.pages[1].text='',/empty/);
rejects(x=>x.pages[1].text+='\nรับเงินจาก ตัดขอบ ข***',/coverage mismatch/);
rejects(x=>x.pages[1].text+='\n+฿ 200.00',/coverage mismatch/);
rejects(x=>x.pages[0].text=x.pages[0].text.replace('22 พฤศจิกายน 2569',''),/absolute date/);
rejects(x=>x.pages[1].text=x.pages[1].text.replace('+฿ 4,000.00','-฿ 4,000.00'),/direction/);
rejects(x=>x.pages[1].text=x.pages[1].text.replace('1,000.00','10,00.00'),/grouping/);
rejects(x=>x.pages[1].text+='\n+฿ 5.',/unreadable/);
rejects(x=>x.pages[1].text+='\nโดเพริมให้ ตัวอย่าง\nbonnnn',/unreadable row/);
rejects(x=>x.pages[1].text='รายการ แชร์รายการ\n9 0/:43\n'+x.pages[1].text,/unreadable row/);
assert.throws(()=>OCR.normalize(input,{...file,checksum:'b'.repeat(64)},job),/identity/);
assert.throws(()=>OCR.normalize(input,file,{...job,company:'FR8'}),/identity/);
const grouped=structuredClone(input);
grouped.pages[1].text='รับเงินจาก ตัวอย่าง ก***\nโอนเงินให้ ตัวอย่าง ข***\n+฿ 20.00\n-฿ 250.00\n08:44\n08:45';
assert.throws(()=>parse(grouped),/ambiguous row fields/,'matching column counts must never invent source-row bindings');
const source=JSON.parse(fs.readFileSync('n8n/audit-headless-worker.json','utf8'));
const candidate=patchTmnPageOcr(source);
assert.equal(candidate.nodes.length,source.nodes.length+9);
assert.deepEqual(candidate.settings,source.settings);
const mutable=new Set(['จัดผล OCR','แปลงรายการเป็นมาตรฐาน','กระทบยอดและสร้าง Exception','ตรวจรายการ PDF ก่อน OCR']);
for(const old of source.nodes){const next=candidate.nodes.find(n=>n.id===old.id);if(!mutable.has(old.name))assert.deepEqual(next,old);else assert.deepEqual({...next,parameters:{}},{...old,parameters:{}});}
assert.ok(candidate.nodes.find(n=>n.name===PAGE_NODE));
assert.equal(candidate.nodes.find(n=>n.name==='TMN OCR วนทีละหน้า').parameters.batchSize,1);
assert.equal(candidate.nodes.find(n=>n.name==='TMN OCR เว้นช่วงและรอข้อความ').parameters.amount,8);
assert.equal(candidate.nodes.find(n=>n.name==='TMN OCR ส่งภาพหนึ่งหน้า').waitBetweenTries,15000);
for(const n of candidate.nodes.filter(n=>n.parameters?.jsCode)) new vm.Script('(async function(){'+n.parameters.jsCode+'\n})');
assert.throws(()=>patchTmnPageOcr(candidate),/already installed/);
// Execute the actual embedded splitter, not a mirror implementation.
const PDF=require('../vendor/pdf-lib-1.17.1.min.js');
const doc=await PDF.PDFDocument.create();for(let i=0;i<3;i++)doc.addPage([100,200]);
const bytes=Buffer.from(await doc.save());
const context=vm.createContext({Buffer,Uint8Array,DataView,setTimeout,clearTimeout,console,
 $:()=>({item:{json:{file}}}),helpers:{getBinaryDataBuffer:async()=>bytes,prepareBinaryData:async(data,fileName,mimeType)=>({data:data.toString('base64'),fileName,mimeType})}});
const split=candidate.nodes.find(n=>n.name===PAGE_NODE).parameters.jsCode;
const actual=await vm.runInContext('(async function(){'+split+'\n}).call({helpers})',context);
const repeat=await vm.runInContext('(async function(){'+split+'\n}).call({helpers})',context);
assert.equal(actual.length,3);
for(let i=0;i<3;i++){
 assert.equal(actual[i].json.tmn_page.page,i+1);assert.equal(actual[i].json.tmn_page.sourceSha256,sha256(bytes));
 assert.equal(actual[i].json.tmn_page.pageSha256,repeat[i].json.tmn_page.pageSha256,'page hashes must be deterministic');
 assert.equal((await PDF.PDFDocument.load(Buffer.from(actual[i].binary.data.data,'base64'))).getPageCount(),1);
}
// Word can put native blank text alongside a screenshot. Keep the original
// lossless image stream, while retaining full pages when real native text exists.
const imageDoc=await PDF.PDFDocument.create();
const png=await imageDoc.embedPng(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'));
for(const meaningful of [false,true]){
 const p=imageDoc.addPage([100,200]);const key=p.node.newXObject('Image1',png.ref);
 p.pushOperators(PDF.pushGraphicsState(),PDF.scale(100,200),PDF.drawObject(key),PDF.popGraphicsState());
 if(meaningful)p.drawText('Keep this evidence',{x:5,y:5,size:3});
 else p.pushOperators(PDF.beginText(),PDF.showText(PDF.PDFString.of(' ')),PDF.endText());
}
const imageBytes=Buffer.from(await imageDoc.save());
context.helpers.getBinaryDataBuffer=async()=>imageBytes;
const imagePages=await vm.runInContext('(async function(){'+split+'\n}).call({helpers})',context);
assert.equal(imagePages[0].json.tmn_page.imageOnly,true,'blank native text must not suppress screenshot OCR');
assert.equal(imagePages[1].json.tmn_page.imageOnly,false,'meaningful native evidence must remain on the complete page');
const imagePagePdf=await PDF.PDFDocument.load(Buffer.from(imagePages[0].binary.data.data,'base64'));
const copiedImages=imagePagePdf.getPage(0).node.Resources().lookup(PDF.PDFName.of('XObject'));
const copiedImage=copiedImages.lookup(copiedImages.keys()[0]);
const originalImage=imageDoc.context.lookup(png.ref);
assert.equal(sha256(copiedImage.contents),sha256(originalImage.contents),'original screenshot bytes must not be re-encoded');
const linked=[input.pages[1],input.pages[0]];
const collector=vm.createContext({$input:{all:()=>linked.map(p=>({json:{text:p.text}}))},
 $:name=>name===PAGE_NODE?{itemMatching:i=>({json:{tmn_page:linked[i]}})}:{item:{json:{file:{...file,ext:'pdf'},job}}}});
const collected=await vm.runInContext('(async function(){'+collectCode+'\n})()',collector);
assert.equal(collected[0].json.tmn_page_ocr.pages[0].page,2,'item linkage must survive reordered responses');
assert.equal(parse(JSON.parse(JSON.stringify(collected[0].json.tmn_page_ocr))).records.length,7);
assert.ok(candidate.nodes.find(n=>n.name==='แปลงรายการเป็นมาตรฐาน').parameters.jsCode.includes('TMN page OCR row count regressed'));
console.log('PASS TMN page identity, coverage, duplicate occurrences, fees, date/sign/amount gates and actual n8n splitter; no services or case writes');
