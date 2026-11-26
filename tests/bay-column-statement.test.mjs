import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {configureBayWorker} from '../scripts/bay-owner-config.mjs';
const root=new URL('../',import.meta.url);
const context=vm.createContext({console,Uint8Array,ArrayBuffer});
vm.runInContext(fs.readFileSync(new URL('formats.js',root),'utf8')+'\n'+fs.readFileSync(new URL('pdf-stm.js',root),'utf8')+';this.P=PdfStm',context);
const P=context.P;
// ข้อมูลสังเคราะห์เท่านั้น ไม่ใช้บัญชีหรือรายการลูกค้าจริง
const name='3XB_STM_BAY_บจก_ตัวอย่าง_DW_2026_11_25.pdf';
const owner={company:'3XB',account:'1234567890',holder:'บริษัท ตัวอย่าง จำกัด',aliases:['บจก ตัวอย่าง'],sourceRef:'verified-test-statement'};
const heading='วันที่/เวลา ถอน ฝาก ยอดเงินในบัญชี รหัส คำอธิบายรายละเอียด ช่องทาง รหัสสาขา';
const footer='ธนาคารกรุงศรีอยุธยา จำกัด (มหาชน)';
const text=`${heading}
24/11/2026 50.00 150.00 TN รับโอนเงิน MOBILE 0700
23:59:00 BAY ผู้โอนตัวอย่าง
บัญชีต้นทาง : X123456
หมายเลขอ้างอิง : 0123123456
25/11/2026 50.00 200.00 TN รับโอนเงิน MOBILE 0700
00:01:00 BAY ผู้โอนตัวอย่าง
บัญชีต้นทาง : X123456
${footer}\f${heading}
25/11/2026 50.00 250.00 TN รับโอนเงิน MOBILE 0700
00:01:00 BAY ผู้โอนตัวอย่าง
บัญชีต้นทาง : X123456
25/11/2026 125.00 125.00 TW โอนเงิน INTERNET 0700
00:02:03 BAY ผู้รับตัวอย่าง
บัญชีปลายทาง : X654321
ถอนเงินรวม 9,999.00 จำนวน 900 รายการ
ฝากเงินรวม 9,999.00 จำนวน 900 รายการ
${footer}`;
P.configureBayOwners([owner]);
const parse=(value=text,file=name)=>P.parseText(file,value,'2026-11-25');
const r=await parse();
assert.equal(r.quality.complete,true);assert.equal(r.quality.parsedRows,4);
assert.equal(r.records.length,3);assert.equal(r.dropped['วันที่ไม่ตรงกับวันที่ตรวจ'],1);
assert.equal(r.header.account,owner.account);assert.equal(r.header.accountSourceRef,owner.sourceRef);
assert.deepEqual(Array.from(r.records,x=>[x.amount,x.direction,x.sec]),[[50,'deposit',60],[50,'deposit',60],[125,'withdraw',123]]);
assert.deepEqual(Array.from(r.records,x=>x.page),[1,2,2]);
assert.ok(r.records.every(x=>x.raw.includes('บัญชี')&&x.account===owner.account));
// คงรายการจริงที่ชื่อ เวลา และยอดซ้ำ ไม่ใช้ยอดรวมทั้งเดือนมาสร้างรายการ
assert.equal(r.records.filter(x=>x.amount===50&&x.sec===60).length,2);
for(const broken of [
 text.replace('00:01:00 BAY','BAY'),
 text.replace('00:02:03','24:02:03'),
 text.replace('125.00 125.00 TW','125.00 TW'),
 text.replace('125.00 125.00 TW','1,25.00 125.00 TW'),
 text.replace('125.00 125.00 TW','125.00 126.00 TW'),
 text.replace('50.00 250.00 TN รับโอนเงิน','50.00 250.00 TW รับโอนเงิน'),
 text.replace('25/11/2026 50.00 200.00 TN รับโอนเงิน MOBILE 0700\n00:01:00 BAY ผู้โอนตัวอย่าง\nบัญชีต้นทาง : X123456\n',''),
 text.replace('25/11/2026 125.00','31/11/2026 125.00'),
 text.replace('125.00 125.00 TW','125.00 125.00 XX'),
 text.replace('00:02:03 BAY','00:02:03 00:03:03 BAY'),
 text+'\n25/11/2026 unreadable',
]) assert.equal((await parse(broken)).quality.complete,false,'ข้อมูลขาดหรือขัดแย้งต้องพักตรวจ');
// ทั้งการแยกวันที่ เวลา และยอดเป็นบรรทัด และรูปแบบรวมเวลาไว้แถวเดียว
for(const value of [text.replace(/(\d{2}\/11\/2026) /g,'$1\n').replace(/(\d+\.00) (\d+\.00) /g,'$1\n$2\n'),
 text.replace(/(25\/11\/2026) (125\.00 125\.00 TW โอนเงิน INTERNET 0700)\n00:02:03/,'$1 00:02:03 $2')]){
 const n=await parse(value);assert.equal(n.quality.complete,true);assert.equal(n.records.length,3);
}
// การผูกเจ้าของต้องตรงชื่อไฟล์และบริษัทอย่างชัดเจน ไม่ใช้บัญชีคู่โอน
for(const file of [name.replace('3XB','MR9'),name.replace('ตัวอย่าง','ตัวอื่น'),name.replace('_DW_','_D_')]){
 assert.equal((await parse(text,file)).quality.complete,false);
}
P.configureBayOwners([]);assert.equal((await parse()).quality.complete,false);
const printed='ชื่อบัญชี บริษัท ตัวอย่าง จำกัด\nเลขบัญชี 123-4-56789-0\n'+text;
assert.equal((await parse(printed)).quality.complete,true);
P.configureBayOwners([owner,{...owner,account:'9999999999'}]);assert.equal((await parse()).quality.complete,false);
P.configureBayOwners([owner]);assert.equal((await parse(printed.replace('123-4-56789-0','999-9-99999-9'))).quality.complete,false);
assert.throws(()=>P.configureBayOwners([{...owner,sourceRef:''}]));
// พิกัดจริงต้องตรงคอลัมน์ฝาก/ถอน แม้ยอดคงเหลือกับรหัสจะดูถูกต้อง
const positioned=P.pagesFromText(printed);
for(const page of positioned){
 const h=page.find(x=>x.text===heading);if(h)h.items=[{s:'ถอน',x:136},{s:'ฝาก',x:220},{s:'ยอดเงินในบัญชี',x:272}];
 for(const line of page.filter(x=>/^\d{2}\/11\//.test(x.text))){
  const amounts=[...line.text.matchAll(/[\d,]+\.\d{2}/g)];
  line.items=[{s:amounts[0][0],x:line.text.includes(' TW ')?110:210},{s:amounts[1][0],x:280}];
 }
}
assert.equal((await P.parse(name,positioned,'2026-11-25')).quality.complete,true);
positioned[0].find(x=>/^25\/11/.test(x.text)).items[0].x=110;
assert.equal((await P.parse(name,positioned,'2026-11-25')).quality.complete,false);
// ตรวจทั้ง probe และ normalizer จริงในสาม workflow ด้วยข้อมูลสังเคราะห์
const signatures=[];
for(const file of ['audit-headless-worker.json','audit-round-worker.json','audit-account-recheck.json']){
 const workflow=JSON.parse(fs.readFileSync(new URL('n8n/'+file,root),'utf8'));
 assert.deepEqual(configureBayWorker(workflow),workflow,'ทุก workflow ต้องโหลดทะเบียนชุดเดียวกัน');
 const meta={file:{id:'synthetic-source',file_name:name,ext:'pdf',kind:'stm_pdf'},job:{company:'3XB',business_date:'2026-11-25'}};
 const input={text,numpages:2};
 for(const node of workflow.nodes.filter(x=>x.parameters?.jsCode?.includes('const PdfStm = (() => {'))){
  const c=vm.createContext({console,Uint8Array,ArrayBuffer,Buffer,TextDecoder,
   $:()=>({item:{json:meta}}),$json:input,$input:{all:()=>[{json:input}],first:()=>({json:input})},
   $vars:{AUDIT_BAY_STATEMENT_OWNERS_JSON:JSON.stringify([owner])}});
  const output=(await vm.runInContext('(async()=>{'+node.parameters.jsCode+'})()',c))[0].json;
  if(node.name==='ตรวจรายการ PDF ก่อน OCR')assert.equal(output.pdf_readable,true);
  else{assert.equal(output.parsed,true,output.parse_error);assert.equal(output.records.length,3);
   signatures.push(JSON.stringify(output.records.map(x=>[x.date,x.sec,x.amount,x.direction,x.account,x.company])));}
 }
}
assert.equal(new Set(signatures).size,1,'ผลแถวต้องตรงกันทั้งออโต้และรันมือ');
console.log('BAY column statements: dates, amounts, balances, repeated events, lineage and scoped owner guards passed');
