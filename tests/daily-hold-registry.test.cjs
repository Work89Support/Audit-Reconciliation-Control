const assert=require('node:assert/strict'),H=require('../account-review-holds.js');
const companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
function fixture(company){
 const nodes={},node=s=>nodes[s]??={value:s==='[data-hold-company]'?'ALL':s==='[data-hold-from]'?'2026-10-14':s==='[data-hold-to]'?'2026-10-31':'',textContent:'',innerHTML:'',querySelector:node};
 const host={isConnected:true,innerHTML:'',querySelector:node};let actor='actor',fail=false;
 const rows=[{company,date:'2026-10-15',account:'TEST',item_kind:'case',code:'EX-TEST',exception_id:'fixture'}],snapshot=JSON.stringify(rows),calls=[];
 const ctx={actor:()=>actor,role:()=> 'lead',companies:async()=>[company],scopes:async()=>[{company,business_date:'2026-10-14'}],report:async(...args)=>{calls.push(args);if(fail)throw Error('timeout');return{company,items:rows};},view:H.view,csv:H.csv,saveBlob:()=>{},from:'2026-10-15',to:'2026-10-31'};
 return{host,ctx,nodes,node,calls,rows,snapshot,setActor:v=>actor=v,setFail:v=>fail=v};
}
(async()=>{
for(const company of companies){const f=fixture(company);await H.mountReadOnly(f.host,f.ctx);
 assert.match(f.host.innerHTML,/ทุกบริษัทตามสิทธิ์/);assert.match(f.host.innerHTML,/2026-10-14/,'keep access to legacy suspended ledger');
 assert.deepEqual(f.calls,[[company,'2026-10-14','2026-10-31']]);assert.match(f.node('[data-hold-state]').textContent,/ทะเบียน 1 รายการ/);
 f.setFail(true);await f.node('[data-hold-load]').onclick();assert.match(f.node('[data-hold-state]').textContent,/ยังอ่านทะเบียนไม่สำเร็จ/);assert.equal(f.node('[data-hold-body]').innerHTML,'');assert.equal(JSON.stringify(f.rows),f.snapshot);
 f.setFail(false);f.ctx.report=async()=>({company:'FOREIGN',items:f.rows});await f.node('[data-hold-load]').onclick();assert.match(f.node('[data-hold-state]').textContent,/บริษัทไม่ตรง/);
}
const f=fixture('FR8');f.ctx.companies=async()=>{throw Error('ไม่มีสิทธิ์');};await H.mountReadOnly(f.host,f.ctx);assert.match(f.host.innerHTML,/ยังเปิดทะเบียนไม่ได้/);assert.equal(f.calls.length,0);
console.log('PASS read-only hold registry: all nine scopes, legacy dates included, no record mutation, explicit timeout (not empty zero), foreign-company rejection and permission failure. Mock reads only.');
})().catch(e=>{console.error(e);process.exit(1);});
