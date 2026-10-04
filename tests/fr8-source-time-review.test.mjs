import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
const context = vm.createContext({console, performance});
for (const file of ['formats.js', 'engine.js']) vm.runInContext(fs.readFileSync(new URL('../'+file, import.meta.url),'utf8'), context);
const engine = vm.runInContext('Engine', context);
const settings={toleranceDeposit:90,toleranceWithdraw:180,exactUniqueTolerance:600,sys123DuplicateTimeTolerance:3600,rules:{}};
const day='2026-10-03';
const headers=['วันที่ทำรายการ','วันที่ธนาคาร','จำนวนเงินฝากจริง','จำนวนเงินถอนจริง','ชื่อธนาคาร','สมาชิก','บัญชีลูกค้า','เกิดโดย','รหัสอ้างอิง'];
const normalize=(rows)=>engine.normalize('FR8_BO_2026-10-03.xlsx',[headers,...rows],settings,day).records;
const bo=normalize([
  [day+' 00:49:59',day+' 01:04:44',200,0,'CPXM-598 : CP','nick | member-a','0011223344 | Customer','เติม ออโต้','bo-second'],
  [day+' 00:40:21',day+' 01:17:22',200,0,'CPXM-598 : CP','nick | member-a','0011223344 | Customer','เติม ออโต้','bo-first'],
]);
assert.equal(bo.length,2);
assert.equal(bo[0].matchTimeColumn,'วันที่ทำรายการ');
assert.equal(bo[0].bankSec,3884,'delayed posting timestamp remains available');
const pm=bo.map((b,i)=>({...b,source:'stm',sec:b.sec+2,ref:'pm-'+i,rowNo:100+i,isPmChannel:true,formatCode:'pm_statement',raw:'PM successful deposit'}));
const paired=await engine.reconcile(pm,bo,settings,[],null);
assert.equal(paired.matched,2,'repeated CP deposits must map one-to-one');
assert.equal(paired.exceptions.length,0);
assert.ok(paired.matchEvidence.every(m=>m.timeDiffSec===2||m.dt===2||m.bo.sec+2===m.stm.sec));

// A different customer's equal amount near a matched transaction is not a duplicate.
const other={...bo[0],memberCode:'member-b',custAccount:'0099887766',sec:bo[0].sec+20,ref:'other-customer',rowNo:900};
const unmatched=await engine.reconcile([pm[0]],[bo[0],other],settings,[],null);
assert.equal(unmatched.exceptions.filter(e=>e.type==='duplicate').length,0);
assert.equal(unmatched.exceptions.filter(e=>e.type==='missing_stm').length,1);

for(const [amount,created,bank] of [[38,'22:57:36','23:05:00'],[52,'22:59:09','23:06:00']]){
  const [withdraw]=normalize([[day+' '+created,day+' '+bank,0,amount,'4311918665 : Manual','nick | member-w','0011223344 | Customer','ถอน ออโต้','withdraw-'+amount]]);
  assert.equal(withdraw.lateNight,true,'late-night classification must follow the matching timestamp');
  assert.equal(withdraw.matchTimeColumn,'วันที่ธนาคาร');
  const result=await engine.reconcile([{...withdraw,source:'stm',amount:999,sec:70000,lateNight:false}], [withdraw], settings, [],null);
  const ex=result.exceptions.find(e=>e.systemAmount===amount);
  assert.equal(ex.type,'cross_day');
  assert.equal(ex.riskAmount,0,'waiting for next-day evidence is not a loss');
}

// Manual-review wording and export tone do not waive evidence or close the case.
const require=createRequire(import.meta.url);
const sheet=require('../mc8-live-sheets.js');
const schema=require('../mc8-sheet-schema.js');
const rows=sheet.rowsOf({cases:[{id:'manual',company:'FR8',account:'4311918665',direction:'ฝาก',ex_type:'manual_review',status:'open',system_amount:50,bank_amount:50,bo_date:day,bo_time:'21:42:00',stm_date:day,stm_time:'21:42:00',bo_raw:'manual credit',stm_raw:'bank credit',customer_details:{bo:{reference:'manual-ref'}}}]},'FR8');
const exported=sheet.buildAuditExportSheets(rows,'FR8',day,true,schema).find(s=>s.name==='ข้อมูลทั้งหมด');
assert.equal(exported.rowTones[0],'warning');
assert.ok(exported.rows[0].some(cell=>String(cell).includes('ยอดจับคู่แล้ว · รอตรวจหลักฐานเติมมือ')));
assert.equal(rows[0].case.status,'open');
const evidence={company:'FR8',account:'4311918665',direction:'deposit',boAmount:92,stmAmount:92,bo:{date:day,sec:62460},stm:{date:day,sec:62460},customer:{bo:{reference:'verified-bo',user:'correct-user'}}};
const duplicateCases=[
  {id:'manual-92',code:'manual-92',company:'FR8',account:'4311918665',direction:'ฝาก',ex_type:'manual_review',status:'open',system_amount:92,bank_amount:92,bo_date:day,bo_time:'17:21:00',stm_date:day,stm_time:'17:21:00',bo_raw:'verified manual',stm_raw:'verified STM',customer_details:{bo:{reference:'verified-bo',user:'correct-user'}}},
  {id:'excess-92',code:'excess-92',company:'FR8',account:'4311918665',direction:'ฝาก',ex_type:'duplicate',status:'open',system_amount:92,bo_date:day,bo_time:'17:21:00',bo_raw:'excess BO',customer_details:{bo:{reference:'excess-bo',user:'wrong-user'}}},
];
const merged=sheet.rowsOf({run:{summary:{match_evidence:[evidence]}},cases:duplicateCases},'FR8');
assert.equal(merged.length,2,'one matched/manual row plus one excess row, not three transactions');
assert.equal(merged.filter(r=>r.exType==='duplicate').length,1);
assert.equal(merged.filter(r=>r.exType==='manual_review').length,1);
assert.equal(merged.find(r=>r.exType==='manual_review').case.status,'open');
const totals=sheet.summarize(merged);
assert.equal(totals.boCount,2);
assert.equal(totals.boCents,18400);
assert.equal(totals.pmCount,1);
assert.equal(totals.pmCents,9200);
const wrongPair=sheet.rowsOf({run:{summary:{match_evidence:[{...evidence,customer:{bo:{reference:'unrelated',user:'correct-user'}}}]}},cases:duplicateCases},'FR8');
assert.equal(wrongPair.length,3,'never merge unrelated evidence by amount/time alone');
console.log('FR8 CP 1:1 timing, cross-customer duplicate guard, late-night withdrawals and manual-review export passed.');
