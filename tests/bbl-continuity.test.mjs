import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context=vm.createContext({console,setTimeout});
vm.runInContext(fs.readFileSync(new URL('../engine.js',import.meta.url),'utf8')+';globalThis.E=Engine;',context);
vm.runInContext(fs.readFileSync(new URL('../pdf-stm.js',import.meta.url),'utf8')+';globalThis.P=PdfStm;',context);
const row=(amount,balance,extra={})=>({source:'stm',formatCode:'stm_pdf',bank:'BBL',noTime:true,
  company:'3XB',account:'1234567890',date:'2026-10-01',direction:'deposit',sec:0,amount,balance,...extra});
const file=(id,rows,page=1)=>rows.map((r,i)=>({...r,source_file_id:id,page,rowNo:i+1}));
const first=file('old',[row(10,110),row(20,130),row(30,160),row(40,200)]);
const continuation=file('next',[row(20,130),row(30,160),row(40,200),row(50,250)]);
let result=context.E.prepareBblStatements([...first,...continuation]);
assert.equal(result.records.length,5); assert.equal(result.removed.length,3); assert.equal(result.issues.length,0);
assert.equal(result.records.at(-1).date,'2026-10-01'); assert.equal(result.records.at(-1).sec,0);
assert.equal(result.removed[0].retainedSource,'old');
// Missing time remains missing; a later batch date never rewrites the printed date.
const pdf=await context.P.parseText('3XB_STM_BBL.pdf','ธนาคารกรุงเทพ\nAccount No. 1234567890\n01/10/26 TRF FR OTH BK 10.00 110.00 mPhone\f01/10/26 TRF FR OTH BK 20.00 130.00 mPhone','2026-10-01');
assert.equal(pdf.records[0].page,1); assert.equal(pdf.records[1].page,2);
assert.ok(pdf.records.every(r=>r.noTime && r.sec===0 && r.date==='2026-10-01'));
const outside=await context.P.parseText('3XB_STM_BBL.pdf','ธนาคารกรุงเทพ\nAccount No. 1234567890\n30/09/26 TRF FR OTH BK 10.00 110.00 mPhone','2026-10-01');
assert.equal(outside.records.length,0);
const brokenDirection=await context.P.parseText('3XB_STM_BBL.pdf','ธนาคารกรุงเทพ\nAccount No. 1234567890\n01/10/26 TRF FR OTH BK 10.00 110.00 mPhone\n01/10/26 TRF TO OTH BK 20.00 130.00 mPhone','2026-10-01');
assert.equal(brokenDirection.records[1].direction,'withdraw');
assert.ok(context.E.prepareBblStatements(brokenDirection.records.map(r=>({...r,company:'3XB'}))).issues.length);
// One balance or two rows is not a sufficient anchor. Preserve, block, never drop.
result=context.E.prepareBblStatements([...first,...file('late',[row(40,200),row(50,250)])]);
assert.equal(result.removed.length,0); assert.equal(result.records.length,6); assert.ok(result.issues.length);
result=context.E.prepareBblStatements([...first,...file('late',[row(30,160),row(40,200),row(50,250)])]);
assert.equal(result.removed.length,0); assert.ok(result.issues.length);
// Balance gaps, missing balances and missing company are not safe evidence.
for(const invalid of [row(10,999),row(10,null),row(10,110,{company:''})]) {
  result=context.E.prepareBblStatements([...first,...file('late',[invalid])]);
  assert.ok(result.issues.length); assert.equal(result.removed.length,0);
}
// Legitimate identical deposits remain distinct when running balances differ.
result=context.E.prepareBblStatements(file('a',[row(50,150),row(50,200),row(50,250)]));
assert.equal(result.records.length,3); assert.equal(result.issues.length,0);
// Full-document overlap is proven, but repeated cycles are ambiguous.
result=context.E.prepareBblStatements([...first,...file('copy',first)]);
assert.equal(result.removed.length,4); assert.equal(result.issues.length,0);
const cycle=[row(10,110),row(10,100,{direction:'withdraw'}),row(10,110)];
result=context.E.prepareBblStatements([...file('a',[...cycle,row(10,100,{direction:'withdraw'}),...cycle.slice(0,2)]),...file('b',cycle)]);
assert.equal(result.removed.length,0); assert.ok(result.issues.length);
// Only BBL PDFs with no time: other banks, providers and BO must stay untouched.
for(const change of [{bank:'SCB'},{bank:'GSB'},{bank:'KTB'},{noTime:false},{isPmChannel:true},{source:'bo'}]) {
  const rows=[...file('a',first.map(r=>({...r,...change}))),...file('b',first.map(r=>({...r,...change})))];
  result=context.E.prepareBblStatements(rows); assert.equal(result.records.length,8); assert.equal(result.issues.length,0);
}
// No deduplication across company/account/date boundaries.
for(const change of [{company:'MR9'},{account:'9876543210'},{date:'2026-10-02'}]) {
  result=context.E.prepareBblStatements([...first,...file('b',first.map(r=>({...r,...change})))]);
  assert.equal(result.records.length,8); assert.equal(result.removed.length,0);
}
// Overlapping page borders use the same rule; intact non-overlapping pages append.
result=context.E.prepareBblStatements([...first,...file('old',continuation,2)]);
assert.equal(result.removed.length,3); assert.equal(result.issues.length,0);
result=context.E.prepareBblStatements([...first,...file('next',[row(50,250),row(10,260)])]);
assert.equal(result.records.length,6); assert.equal(result.issues.length,0);
// Reconciliation consumes the de-overlapped sequence, not two copies of BO.
const bo=[10,20,30,40,50].map((amount,i)=>({source:'bo',company:'3XB',account:'1234567890',
  bank:'BBL',date:'2026-10-01',direction:'deposit',amount,sec:80000+i,rowNo:i+1,memberCode:'u'+i}));
const matched=await context.E.reconcile([...first,...continuation],bo,
  {toleranceDeposit:90,toleranceWithdraw:180,diffAlert:1,rules:{crossDay:true}},[],null);
assert.equal(matched.matched,5); assert.equal(matched.exceptions.length,0);
await assert.rejects(()=>context.E.reconcile([...first,...file('gap',[row(10,999)])],bo,{},[],null),/BBL/);
// Source selection reads only adjacent BBL PDFs (plus the existing KTB policy).
const workflow=JSON.parse(fs.readFileSync(new URL('../n8n/audit-headless-worker.json',import.meta.url),'utf8'));
const select=new Function('$','$input',workflow.nodes.find(n=>n.name==='เลือกไฟล์ของบริษัท').parameters.jsCode);
const choose=(company,batches)=>select(()=>({first:()=>({json:{company,business_date:'2026-10-01'}})}),{all:()=>batches.map(json=>({json}))});
const attachment=(id,bank)=>({id,file_name:`3XB_STM_${bank}.pdf`,kind:'stm_pdf',company:'3XB',parsed:true,created_at:'2026-10-03T00:00:00Z'});
const selected=choose('3XB',[{company:'3XB',business_date:'2026-10-01',source_files:[attachment('old','BBL')]},
  {company:'3XB',business_date:'2026-10-02',source_files:[attachment('new','BBL'),attachment('scb','SCB'),attachment('bo','BO')]}]);
assert.deepEqual(selected.map(x=>x.json.file.id),['old','new']);
assert.ok(workflow.nodes.find(n=>n.name==='กระทบยอดและสร้าง Exception').parameters.jsCode.includes('bbl_overlap_evidence:bblControl.removed'));
console.log('BBL no-time balance continuity, conservative overlaps, engine/Worker and scope regression: OK');
