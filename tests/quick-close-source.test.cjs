const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const source=fs.readFileSync(process.env.QUICK_CLOSE_APP || 'app.js','utf8');
const P=require('../preliminary-review.js');
const ref='6aa832a1fe4dfb71d1a5c4d8';
const row={id:'c',company:'MC8',run_id:'r',status:'open',direction:'ถอน',ex_type:'time_diff',business_date:'2026-09-15',bo_date:'2026-09-15',stm_date:'2026-09-15',time_diff_sec:3038,account:'COREPAY',system_amount:3300,bank_amount:3300,bo_raw:`2716759 | date | ถอน | ออโต้ | user | provider | 3300 | 0 | 0 | date | sapan: ${ref}`,stm_raw:`uuid | 3300 | corepay | SUCCESSED | 2716759 | ${ref}`};
let data,links;
const ctx={state:{dataset:'production'},PreliminaryReview:P,Sb:{reconciliationOverview:async()=>data,evidenceCaseRecommendations:async()=>links}};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('function isQuickCloseEligible('),source.indexOf('// Completion is a positive assertion')),ctx);
const reset=()=>{data={complete:true,run:{id:'r',jobStatus:'completed',matched:0,summary:{match_evidence:[]}},cases:[{...row}]};links=[];return {dbId:'c',company:'MC8',date:'2026-09-15',status:'open',_detailLoaded:true};};
(async()=>{
 let e=reset();await ctx.refreshQuickCloseEvidence(e);assert.equal(ctx.isQuickCloseEligible(e),true);
 for(const change of [{time_diff_sec:3601},{stm_date:'2026-09-16'}]) {e=reset();Object.assign(data.cases[0],change);await ctx.refreshQuickCloseEvidence(e);assert.equal(ctx.isQuickCloseEligible(e),true);}
 for(const change of [{bank_amount:20},{stm_raw:row.stm_raw.replace('SUCCESSED','PARTIAL')},{ex_type:'amount_diff'}]) {e=reset();Object.assign(data.cases[0],change);await ctx.refreshQuickCloseEvidence(e);assert.equal(ctx.isQuickCloseEligible(e),false);}
 e=reset();links=[{reason:'จ่ายแทน'}];await ctx.refreshQuickCloseEvidence(e);assert.equal(ctx.isQuickCloseEligible(e),false);
 e=reset();data.cases.push({...row,id:'duplicate'});await ctx.refreshQuickCloseEvidence(e);assert.equal(ctx.isQuickCloseEligible(e),false);
 e=reset();data.complete=false;await ctx.refreshQuickCloseEvidence(e);assert.equal(ctx.isQuickCloseEligible(e),false);
 e=reset();e.status='closed';data.cases[0].status='closed';await ctx.refreshQuickCloseEvidence(e);assert.equal(e._quickSourceEvidence,true);assert.equal(ctx.isQuickCloseEligible(e),false);
 console.log('Quick-close source gates: allowed, time/date/amount/status, duplicate, linked evidence, incomplete, closed display passed');
})();
