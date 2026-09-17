const assert=require('node:assert/strict');
const P=require('../preliminary-review.js');
const Bulk=require('../bulk-case-review.js');
const ref='6aa8e7b5a4c201567499496a';
const row={id:'c',code:'EX-test',run_id:'r',company:'MC8',status:'open',direction:'ถอน',ex_type:'time_diff',business_date:'2026-09-16',bo_date:'2026-09-16',stm_date:'2026-09-17',time_diff_sec:90000,account:'COREPAY',system_amount:100,bank_amount:100,bo_raw:`2717119 | date | ถอน | ออโต้ | user | provider | 100 | 0 | 10 | date | sapan: ${ref}`,stm_raw:`uuid | 100 | corepay | SUCCESSED | 2717119 | ${ref}`,customer_details:{}};
const data=()=>({complete:true,run:{id:'r',jobStatus:'completed',matched:0,summary:{match_evidence:[]}},cases:[structuredClone(row)]});
assert.equal(P.candidates(data()).size,0,'automatic gate remains unchanged');
assert(P.manualCandidates(data()).has('c'),'explicit approval accepts cross-day pair');
for(const change of [{time_diff_sec:3601,stm_date:row.bo_date},{time_diff_sec:-3601},{time_diff_sec:null},{ex_type:'cross_day'}]){
 const d=data();Object.assign(d.cases[0],change);assert(P.manualCandidates(d).has('c'));
}
for(const mutate of [d=>d.complete=false,d=>d.cases[0].bank_amount=99,d=>d.cases.push({...row,id:'dup'}),d=>d.run.summary.match_evidence.push({customer:{bo:{reference:'2717119'}}}),d=>d.cases[0].stm_raw=d.cases[0].stm_raw.replace('SUCCESSED','PARTIAL')]){
 const d=data();mutate(d);assert.equal(P.manualCandidates(d).size,0);
}
const deposit=data();Object.assign(deposit.cases[0],{direction:'ฝาก',bo_raw:'bo-source',stm_raw:'pm-source SUCCESSED',customer_details:{bo:{reference:'shared-ref'},stm:{reference:'shared-ref'}}});
assert(P.manualCandidates(deposit).has('c'),'matched deposit is allowed');
deposit.cases[0].customer_details={};assert.equal(P.manualCandidates(deposit).size,0,'amount alone is insufficient');
(async()=>{
 let saved=0;const deps={allowed:()=>true,load:async()=>data(),candidates:P.manualCandidates,links:async()=>[],save:async()=>{saved++;return true;}};
 const scope={company:row.company,date:row.business_date};
 assert.equal((await Bulk.run([row],scope,deps))[0].status,'closed');assert.equal(saved,1);
 assert.equal((await Bulk.run([row],scope,{...deps,allowed:()=>false}))[0].status,'skipped');
 assert.equal(saved,1);
 console.log('Manual approval: cross-day/time override, deposit, duplicates, amount, identity, auth and persistence passed');
})();
