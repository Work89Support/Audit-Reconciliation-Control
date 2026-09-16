const assert=require('node:assert/strict');
const Bulk=require('../bulk-case-review.js');
const P=require('../preliminary-review.js');
const scope={company:'MR9',date:'2026-09-15'};
const make=i=>({id:'id'+i,code:'EX-'+i,company:'MR9',business_date:scope.date,run_id:'r',status:'open',direction:'ถอน',ex_type:'time_diff',bo_date:scope.date,stm_date:scope.date,time_diff_sec:300,account:'COREPAY',system_amount:100,bank_amount:100,bo_raw:`${2717119+i} | d | ถอน | ออโต้ | u | cp | 100 | 0 | 0 | d | sapan: ${i.toString(16).padStart(24,'0')}`,stm_raw:`uuid${i} | 100 | corepay | SUCCESSED | ${2717119+i} | ${i.toString(16).padStart(24,'0')}`});
(async()=>{
 const rows=[make(1),make(2)];let saved=[];
 const deps={allowed:()=>true,load:async()=>({complete:true,run:{id:'r',matched:0,jobStatus:'completed',summary:{match_evidence:[]}},cases:rows}),candidates:P.candidates,links:async()=>[],save:async r=>{saved.push(r.id);return true;}};
 let result=await Bulk.run([...rows,rows[0]],scope,deps);
 assert.equal(result.length,2);assert.equal(saved.length,2);assert(result.every(r=>r.status==='closed'));
 for(const overrides of [
   {allowed:()=>false}, {cancelled:()=>true}, {links:async()=>[{}]},
   {links:async()=>null}, {load:async()=>{throw Error('timeout');}},
   {load:async()=>({complete:false,cases:rows})},
   {load:async()=>({cases:rows.map(r=>({...r,status:'closed'}))})},
   {load:async()=>({cases:rows.map(r=>({...r,bank_amount:200}))})},
 ]) {saved=[];result=await Bulk.run(rows,scope,{...deps,...overrides});assert.equal(saved.length,0);assert(result.every(r=>r.status==='skipped'));}
 saved=[];result=await Bulk.run(rows,{...scope,date:'2026-09-16'},deps);assert.equal(saved.length,0);
 result=await Bulk.run(rows,scope,{...deps,save:async r=>r.id===rows[1].id});assert.deepEqual(result.map(r=>r.status),['skipped','closed']);
 let cancelled=false;result=await Bulk.run(rows,scope,{...deps,cancelled:()=>cancelled,save:async()=>{cancelled=true;return true;}});assert.deepEqual(result.map(r=>r.status),['closed','skipped']);
 assert(rows.every(r=>r.status==='open'),'runner must not fabricate local persisted status');
 console.log('Bulk approval: scope, fresh data, auth, links, incomplete/failed reads, partial save, deduplication and cancellation passed');
})();
