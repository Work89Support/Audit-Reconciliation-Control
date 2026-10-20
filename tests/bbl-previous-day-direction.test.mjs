import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const c=vm.createContext({console,Uint8Array});
vm.runInContext(fs.readFileSync(new URL('../pdf-stm.js',import.meta.url),'utf8')+';globalThis.P=PdfStm',c);
const text=`BANGKOK BANK
Account No. 1234567890
18/10/26 TRANSFER 39.00 856.74 mPhone
18/10/26 TRF TO OTH BK 54.00 802.74 mPhone
18/10/26 TRF TO OTH BK 18.00 784.74 mPhone
18/10/26 TRF FR OTH BK 40.00 824.74 mPhone
18/10/26 TRF TO OTH BK 82.00 742.74 mPhone
18/10/26 TRF TO OTH BK 10.00 732.74 mPhone
18/10/26 TRF FR OTH BK 170.00 902.74 mPhone
18/10/26 TRF TO OTH BK 21.00 881.74 mPhone
18/10/26 TRF FR OTH BK 50.00 931.74 mPhone
18/10/26 TRF TO OTH BK 10.00 921.74 mPhone
18/10/26 TRF TO OTH BK 100.00 821.74 mPhone
18/10/26 TRF TO OTH BK 200.00 621.74 mPhone
19/10/26 TRF FR OTH BK 40.00 661.74 mPhone
19/10/26 TRF FR OTH BK 50.00 711.74 mPhone
19/10/26 TRF TO OTH BK 4.00 707.74 mPhone
19/10/26 TRF FR OTH BK 70.00 777.74 mPhone
19/10/26 TRF TO OTH BK 6.00 771.74 mPhone
19/10/26 TRF TO OTH BK 62.00 709.74 mPhone
19/10/26 TRF FR OTH BK 50.00 759.74 mPhone
19/10/26 TRF TO OTH BK 100.00 659.74 mPhone
19/10/26 TRF FR OTH BK 60.00 719.74 mPhone
19/10/26 TRANSFER 25.00 694.74 mPhone
19/10/26 TRF FR OTH BK 30.00 724.74 mPhone
19/10/26 TRF FR OTH BK 70.00 794.74 mPhone`;
for(const company of ['3XB','AT4','FR8','SK8','MC8','MR9','PS8','UR9','UFABET7M']){
 const r=await c.P.parseText(company+'_STM_BBL.pdf',text,'2026-10-19');
 assert.equal(r.quality.complete,true);
 assert.equal(r.quality.parsedRows,24);assert.equal(r.records.length,12);
 assert.equal(r.quality.outOfDayDirectionRows.length,1);
 assert.equal(r.quality.businessDayPolicy,'bbl_previous_day_direction_v1');
 assert.ok(r.records.every(r=>r.date==='2026-10-19'&&r.sourceDate==='2026-10-19'));
 assert.equal(r.records.filter(r=>r.direction==='deposit').length,7);
 assert.equal(r.records.filter(r=>r.direction==='withdraw').length,5);
 assert.equal(r.records.filter(r=>r.direction==='deposit').reduce((s,r)=>s+r.amount,0),370);
 assert.equal(r.records.filter(r=>r.direction==='withdraw').reduce((s,r)=>s+r.amount,0),197);
 const old=await c.P.parseText(company+'_STM_BBL.pdf',text,'2026-10-18');
 assert.equal(old.quality.complete,false,'same ambiguous row still blocks its own day');
}
for(const extra of ['19/10/26 TRF FR OTH BK unreadable','19/10/26 TRANSFER 12.00 999.00',
 '18/10/26 TRF FR OTH BK unreadable','17/10/26 TRANSFER 12.00 999.00']){
 const r=await c.P.parseText('SK8_STM_BBL.pdf',text+'\n'+extra,'2026-10-19');
 assert.equal(r.quality.complete,false,extra);
}
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
for(const name of ['audit-headless-worker','audit-account-recheck','audit-round-worker']){
 const w=JSON.parse(fs.readFileSync(new URL('../n8n/'+name+'.json',import.meta.url),'utf8'));
 const node=w.nodes.find(n=>n.name==='ตรวจรายการ PDF ก่อน OCR');
 const probe=new AsyncFunction('$','$json',node.parameters.jsCode);
 for(const company of ['3XB','AT4','FR8','SK8','MC8','MR9','PS8','UR9','UFABET7M']){
  const meta=()=>({item:{json:{file:{file_name:company+'_STM_BBL.pdf'},job:{business_date:'2026-10-19'}}}});
  assert.equal((await probe(meta,{text}))[0].json.pdf_readable,true,'keep complete native extraction, do not replace it with OCR');
  assert.equal((await probe(meta,{text:text+'\n19/10/26 TRF FR OTH BK unreadable'}))[0].json.pdf_readable,false);
 }
 const normalized=w.nodes.find(n=>n.name==='แปลงรายการเป็นมาตรฐาน').parameters.jsCode;
 const runtime=vm.createContext({console,Uint8Array});
 vm.runInContext(normalized.slice(0,normalized.indexOf('const meta='))+';globalThis.P=PdfStm',runtime);
 const parsed=await runtime.P.parseText('SK8_STM_BBL.pdf',text,'2026-10-19');
 assert.equal(parsed.quality.complete,true);
 assert.equal(parsed.quality.businessDayPolicy,'bbl_previous_day_direction_v1');
}
// Reproduce with a locally downloaded original when supplied; never commit it.
if(process.argv[2]){
 const pdfjs=require('../vendor/pdf.min.js');
 pdfjs.GlobalWorkerOptions.workerSrc=require.resolve('../vendor/pdf.worker.min.js');
 c.pdfjsLib=pdfjs;
 const r=await c.P.parse('SK8_STM_BBL.pdf',fs.readFileSync(process.argv[2]),'2026-10-19');
 assert.equal(r.records.length,12);assert.equal(r.quality.complete,true);
 assert.equal(r.quality.outOfDayDirectionRows.length,1);
 console.log('Local original PDF: 24 read / 12 current-day / 1 previous-day diagnostic; no production run');
}
console.log('Nine-company BBL previous-day direction isolation and fail-closed regressions: PASS');
