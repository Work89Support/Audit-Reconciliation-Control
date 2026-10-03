const assert=require('node:assert/strict');
const {rowsOf,summarize,tableView}=require('../mc8-live-sheets.js');
const schema=require('../mc8-sheet-schema.js');
const pair={company:'3XB',account:'6517247760',direction:'withdraw',amount:500,bo:{fileId:'bo-file',row:8025,date:'2026-10-01',sec:84600},stm:{fileId:'stm-file',row:58,date:'2026-10-01',sec:null,noTime:true},customer:{bo:{reference:'10595966',user:'3fx389473'},stm:{}}};
const closed={id:'closed-case',company:'3XB',account:pair.account,direction:'ถอน',status:'closed',ex_type:'cross_day',closure_rule:'bbl-continuity-exact-bo-evidence',system_amount:500,bank_amount:null,bo_date:'2026-10-01',bo_time:'23:30:00',customer_details:{bo:pair.customer.bo},resolution_note:'ตรวจความต่อเนื่องแล้ว'};
const data={run:{summary:{match_evidence:[pair]}},cases:[closed]},original=JSON.stringify(data);
const rows=rowsOf(data,'3XB');
assert.equal(rows.length,1);assert.equal(rows[0].case.id,closed.id);assert.equal(rows[0].pmAmount,500);
assert.equal(rows[0].pmTime,'2026-10-01 (ไม่มีเวลา)');assert.match(rows[0].reason,/stm-file · แถว 58/);
assert.equal(summarize(rows).boCents,50000);assert.equal(summarize(rows).pmCents,50000);
assert.equal(JSON.stringify(data),original,'must not mutate saved run/case');
const standalone=rowsOf({...data,cases:[]},'3XB');
assert.equal(standalone[0].pmTime,'2026-10-01 (ไม่มีเวลา)');
const view=tableView(standalone,'3XB','2026-10-01',true,'statement:6517247760',schema);
assert.equal(view.rows[0][view.headers.indexOf('ต่างเวลา')],'');
assert.match(view.rows[0][view.headers.indexOf('เงื่อนไขที่จับคู่')],/ไม่มีเวลาใน STM/);
for(const change of [{status:'open'},{closure_rule:'manual'},{bo_time:'23:31:00'},{system_amount:300},{customer_details:{bo:{...pair.customer.bo,user:'other'}}}]){
  assert.equal(rowsOf({...data,cases:[{...closed,...change}]},'3XB').length,2,'unproven history stays visible');
}
assert.equal(rowsOf({...data,run:{summary:{match_evidence:[pair,{...pair,stm:{...pair.stm,row:59}}]}}},'3XB').length,3,'ambiguous pair is not linked');
console.log('BBL closed evidence view tests passed');
