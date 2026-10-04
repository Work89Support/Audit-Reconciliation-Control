const assert=require('node:assert/strict');
const {rowsOf,summarize}=require('../mc8-live-sheets.js');
const pair={company:'FR8',account:'SCB-QA',direction:'deposit',boAmount:50,stmAmount:50,
 bo:{fileId:'bo',row:1,date:'2026-10-02',sec:600},stm:{fileId:'stm',row:1,date:'2026-10-02',sec:600},
 customer:{bo:{user:'qa',reference:'qa-ref'},stm:{}}};
const alert={id:'duplicate-history',company:'FR8',account:'SCB-QA',direction:'ฝาก',
 status:'closed',auto_closed:true,resolved_by:'system:scb-overlap-repair',
 closure_rule:'scb-overlap-duplicate-source-verified',ex_type:'missing_bo',bank_amount:50,
 stm_date:'2026-10-02',stm_time:'00:10:00',stm_raw:'QA duplicated source row'};
const data={run:{summary:{match_evidence:[pair]}},cases:[alert]};
const original=JSON.stringify(data),rows=rowsOf(data,'FR8');
assert.equal(rows.length,1,'duplicate alert must not add a second financial row');
assert.equal(summarize(rows).pmCents,5000);
assert.equal(JSON.stringify(data),original,'case and run history must remain intact');
for(const change of [{status:'open'},{auto_closed:false},{resolved_by:'audit'},
 {closure_rule:'manual-closure'},{status:'pending_next_day'}]){
 assert.equal(rowsOf({...data,cases:[{...alert,...change}]},'FR8').length,2,
  'unverified or ordinary cases must remain visible');
}
assert.equal(rowsOf({...data,cases:[{...alert,status:'open'},alert]},'FR8').length,2,
 'only verified closed duplicate history is suppressed');
console.log('SCB duplicate alerts: preserved history, no extra sheet/export transaction');
const carry={...alert,id:'cross-day-history',ex_type:'cross_day',
 closure_rule:'reserved-unique-bo-identity-match',closing_run_id:'later-run',
 system_amount:50,bank_amount:null,bo_date:'2026-10-01',business_date:'2026-10-01',
 customer_details:{bo:pair.customer.bo},resolution_note:'verified cross-day proof'};
const carryData={run:{id:'later-run',summary:{match_evidence:[{...pair,
 bo:{...pair.bo,boDate:'2026-10-01'}}]}},cases:[carry]};
assert.equal(rowsOf(carryData).length,1,'closed carry-over links to its reserved accepted pair');
assert.equal(summarize(rowsOf(carryData)).boCents,5000);
for(const change of [{status:'open'},{closing_run_id:'other-run'},{auto_closed:false},
 {bo_date:'2026-09-30'},{customer_details:{bo:{...pair.customer.bo,user:'other'}}}]){
 assert.equal(rowsOf({...carryData,cases:[{...carry,...change}]}).length,2,
 'unproven cross-day history must not be suppressed');
}
