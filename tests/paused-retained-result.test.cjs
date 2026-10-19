const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('supabase.js','utf8');
const start=source.indexOf('  function retainedRunState('),end=source.indexOf('  async function reconciliationEvidence(',start);
const ctx={};vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
const {resultComplete,rowsOf,summaries}=require('../mc8-live-sheets.js');
for(const company of ['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9']){
 const job={company,business_date:'2026-10-18',last_run_id:'committed',status:'queued',error_count:0,completed_at:'2026-10-19T02:36:47Z'};
 const run={id:'committed',company,business_date:job.business_date,created_at:'2026-10-19T02:36:43Z',matched:1,summary:{match_evidence:[{account:'AT',amount:100,stmAmount:100,boAmount:100,direction:'deposit',bo:{fileId:'bo',row:2},stm:{fileId:'pm',row:3}}]}};
 const state={hold:{paused:true},manualOnly:false,job:{status:'queued',last_run_id:run.id}},before=JSON.stringify({job,run,state});
 const result=ctx.retainedRunState(job,run,state);assert.equal(result.retainedCompletedResult,true);assert.equal(result.resultStatus,'completed');
 const data={run:{...run,...result,jobStatus:job.status},cases:[],complete:true};
 assert.equal(resultComplete(data),true);const prior=rowsOf({...data,run:{...run,jobStatus:'completed'}});assert.deepEqual(rowsOf(data),prior);assert.deepEqual(summaries(rowsOf(data)),summaries(prior));
 assert.equal(resultComplete({...data,complete:false}),false);assert.equal(resultComplete({...data,run:{...data.run,matched:2}}),false);
 for(const changed of [{...state,hold:{paused:false}},{...state,manualOnly:true},{...state,job:{status:'running',last_run_id:run.id}},null])assert.equal(ctx.retainedRunState(job,run,changed).retainedCompletedResult,false);
 for(const changed of [{...job,status:'running'},{...job,completed_at:null},{...job,completed_at:run.created_at.replace('43Z','40Z')},{...job,last_run_id:'other'},{...job,company:'OTHER'},{...job,error_count:1}])assert.equal(ctx.retainedRunState(changed,run,state).retainedCompletedResult,false);
 assert.equal(JSON.stringify({job,run,state}),before);
}
// Exercise actual read transport: completion remains separate from raw queue state.
let fail=false,calls=[];const read={ManualPrimary:{},readManualPrimary:async()=>null,
 json:async path=>{calls.push(path);return path.includes('daily_recon_jobs')?[{company:'PS8',business_date:'2026-10-18',last_run_id:'r',status:'queued',completed_at:'2026-10-19T02:36:47Z',error_count:0}]:[{id:'r',company:'PS8',business_date:'2026-10-18',created_at:'2026-10-19T02:36:43Z'}];},
 fileRunManagement:async()=>{if(fail)throw Error('read timeout');return {hold:{paused:true},manualOnly:false,job:{last_run_id:'r',status:'queued'}};}};
vm.createContext(read);vm.runInContext(source.slice(source.indexOf('  async function matchedEvidence('),end),read);
(async()=>{const r=await read.matchedEvidence('PS8','2026-10-18');assert.equal(r.jobStatus,'queued');assert.equal(r.resultStatus,'completed');fail=true;const denied=await read.matchedEvidence('PS8','2026-10-18');assert.equal(denied.retainedCompletedResult,false);assert.equal(denied.retainedResultError,'read timeout');assert.ok(calls.every(x=>x.startsWith('/rest/v1/')));console.log('PASS all nine: pause retains only the same committed result; incomplete reads/evidence, changed sources, running job, foreign scope and missing completion stay blocked; rows/amounts unchanged; read-only transport.');})().catch(e=>{console.error(e);process.exitCode=1;});
