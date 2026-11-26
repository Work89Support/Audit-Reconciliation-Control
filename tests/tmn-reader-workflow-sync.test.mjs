import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {syncTmnReader} from '../scripts/sync-worker-tmn-reader.mjs';
const file={id:'synthetic',kind:'stm_pdf',ext:'pdf',file_name:'UFABET7M_STM_TMN_รุ่งฟ้า_DW_2026-11-25.pdf'},job={id:'synthetic-job',company:'UFABET7M',business_date:'2026-11-25'};
const page=(i,time,heading='')=>({page:i,pageCount:2,sourceFileId:file.id,sourceSha256:'a'.repeat(64),pageSha256:String(i).repeat(64),sourceImageSha256:'b'.repeat(64),rowLayout:true,
 sourceGraphics:{version:'tmn-single-image-graphics-v1'},geometry:{version:'tmn-pixel-row-v1',header:[0,0,400,100],rows:[{row:1,desc:[0,100,300,20],amount:[300,100,100,20],time:[0,130,100,20]}]},
 text:`HEAD\n${heading}\nROW 1\nรับเงินจาก ตัวอย่าง\n+฿ 50.00\n${time}\nTAIL`});
const envelope={version:'tmn-page-ocr-v1',sourceFileId:file.id,sourceSha256:'a'.repeat(64),pageCount:2,pages:[page(1,'18:40'),page(2,'23:19','25 พฤศจิกายน 2569')]};
const run=async(code,input,helpers={})=>{
 const c=vm.createContext({console,Buffer,Uint8Array,ArrayBuffer,DataView,setTimeout,clearTimeout,TextEncoder,TextDecoder,
  $:()=>({item:{json:{file,job}}}),$json:input[0]?.json,$vars:{},$input:{all:()=>input,first:()=>input[0]},helpers});
 return vm.runInContext('(async function(){'+code+'\n}).call({helpers})',c);
};
const signatures=[];
for(const name of ['audit-headless-worker.json','audit-round-worker.json','audit-account-recheck.json']){
 const original=JSON.parse(fs.readFileSync('n8n/'+name,'utf8')),baseline=JSON.stringify(original),candidate=syncTmnReader(original);
 assert.equal(JSON.stringify(original),baseline);assert.deepEqual(syncTmnReader(candidate),candidate,'ติดตั้งซ้ำต้องไม่เพิ่มเส้นทางหรือโหนด');
 assert.deepEqual(candidate.settings,original.settings);
 for(const node of candidate.nodes.filter(n=>n.parameters?.jsCode))new vm.Script('(async function(){'+node.parameters.jsCode+'\n})');
 const split=candidate.nodes.find(n=>n.name==='แยกหน้า TMN สำหรับ OCR'),format=candidate.nodes.find(n=>n.name==='จัดผล OCR'),normal=candidate.nodes.find(n=>n.name==='แปลงรายการเป็นมาตรฐาน');
 const failed=await run(split.parameters.jsCode,[],{getBinaryDataBuffer:async()=>Buffer.from('invalid PDF')});
 assert.equal(failed[0].json.tmn_split_error,true);assert.equal(failed[0].json.sourceFileId,file.id);assert.equal(failed[0].binary,undefined);
 const receipt=await run(format.parameters.jsCode,failed);assert.ok(receipt[0].json.error);assert.equal(receipt[0].json.text,'');
 const bad=(await run(normal.parameters.jsCode,receipt))[0].json;
 assert.equal(bad.parsed,false);assert.equal(bad.records.length,0);assert.match(bad.parse_error,/TMN/);
 const result=(await run(normal.parameters.jsCode,[{json:{text:envelope.pages.map(p=>p.text).join('\f'),tmn_page_ocr:envelope,ocr_used:true,ocr_page_count:2}}]))[0].json;
 assert.equal(result.parsed,true,result.parse_error);assert.equal(result.records.length,2);assert.ok(result.records.every(r=>r.sourceDateEvidence?.page===2),name);
 signatures.push(JSON.stringify(result.records.map(r=>[r.account,r.date,r.sec,r.amount,r.direction,r.sourceRowId])));
 const gate='TMN แยกหน้าล้มเหลว?';
 assert.equal(candidate.connections['แยกหน้า TMN สำหรับ OCR'].main[0][0].node,gate);
 assert.equal(candidate.connections[gate].main[0][0].node,'จัดผล OCR');
 assert.equal(candidate.connections[gate].main[1][0].node,'TMN OCR วนทีละหน้า');
 // ข้อผิดพลาดต้องกลับไป Quality Gate เดิม ห้ามมีเส้นลัดไปเขียนผลหรือเคส
 for(const node of original.nodes){
  const next=candidate.nodes.find(n=>n.id===node.id);
  if(!['จัดผล OCR','แปลงรายการเป็นมาตรฐาน','กระทบยอดและสร้าง Exception','ตรวจรายการ PDF ก่อน OCR'].includes(node.name))assert.deepEqual(next,node);
  else assert.deepEqual({...next,parameters:{}},{...node,parameters:{}},'คง credentials และ node metadata เดิม');
 }
}
assert.equal(new Set(signatures).size,1);
console.log('PASS shared TMN reader in automatic/manual wrappers, source-bound dates and split-error quality receipts without financial writes');
