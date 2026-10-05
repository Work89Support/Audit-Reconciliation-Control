const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={state:{dataset:'production',role:'lead'},Sb:{signedIn:()=>true,authUser:()=>({id:'lead'}),pendingManualPairs:async()=>[{id:'pending'}]},can:()=>true,Date};
vm.createContext(context);vm.runInContext(fs.readFileSync('manual-pairing.js','utf8')+'\nthis.api=ManualPairing;',context);
(async()=>{
 const rows=[{id:'cross',bo_company:'FR8',stm_company:'UFABET7M',snapshot:{bo:{business_date:'2026-10-01'},stm:{business_date:'2026-10-02'}}}];
 assert.equal(context.api.filterPairs(rows,{company:'UFABET7M',from:'2026-10-02',to:'2026-10-02'}).length,1);
 assert.equal(context.api.filterPairs(rows,{company:'FR8',from:'2026-10-02',to:'2026-10-02'}).length,0);
 assert.equal(context.api.filterPairs(rows,{company:'ALL',from:'2026-10-01',to:'2026-10-02'}).length,1);
 assert.equal(context.api.filterPairs([{bo_company:'FR8'}],{company:'ALL',from:'2026-10-01',to:''}).length,0);
 assert.match(context.api.decisionBlockReason({status:'pending',submitted_by:'lead'}),/คำขอตัวเอง/);
 assert.equal(context.api.decisionBlockReason({status:'pending',submitted_by:'employee'}),'');
 context.can=()=>false;assert.match(context.api.decisionBlockReason({status:'pending',submitted_by:'employee'}),/ไม่มีสิทธิ์/);
 context.can=()=>true;assert.match(context.api.decisionBlockReason({status:'approved',submitted_by:'employee'}),/ไม่ได้รอ/);
 await context.api.loadPending();assert.equal(context.api.queueState.rows.length,1);
 context.Sb.pendingManualPairs=async()=>{throw Error('offline');};await context.api.loadPending(true);assert.equal(context.api.queueState.rows,null);assert.match(context.api.queueState.error,/offline/);
 console.log('Approval guards: self approval, role, status and unavailable count passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
