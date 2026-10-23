const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('case-closure.js','utf8');
function fixture(role='lead',change={},preview={allowed:true,problems:[]}){
 let reads=0,previews=0,writes=0,modal='',warnings=[];
 const nodes={};for(const key of ['#closureCancel','#closureSend','#closureOutcome','#closureLossFields','#closureAuditReason','#closureAuditChecked','#closureLossAmount','#closureLossCategory'])nodes[key]={value:'',checked:false,querySelector:()=>({disabled:false}),parentElement:{before(){}}};
 nodes['#closureOutcome'].value='no_loss';const fresh={id:'case',status:'pending_next_day',ex_type:'cross_day',company:'FR8',...change};
 const ctx={Sb:{signedIn:()=>true,exceptionDetail:async()=>{reads++;return fresh},pendingDocumentClosurePreview:async()=>{previews++;return preview},closeDocumentCase:async()=>{writes++;throw Error('unexpected write')},submitCaseClosure:async()=>{writes++;throw Error('unexpected write')}},state:{dataset:'production',role},money:String,can:()=>true,canAccessCompany:()=>true,caseLabel:e=>e.id,h:v=>String(v??''),crypto:{randomUUID:()=> 'request'},DamageSummary:{categories:{external:'External'},shiftKey:()=>''},openModal:(t,b)=>{modal=t+b},closeModal(){},toast:t=>warnings.push(t),$:s=>nodes[s],document:{createElement:()=>({setAttribute(){}})}};
 vm.createContext(ctx);vm.runInContext(source+';this.api=CaseClosure;',ctx);return {ctx,nodes,get modal(){return modal},get warnings(){return warnings},get previews(){return previews},get writes(){return writes}};
}
(async()=>{
 for(const company of ['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9']){
  const f=fixture('lead',{company});await f.ctx.api.openSubmit({id:'case',dbId:'case',notes:[]});assert.match(f.modal,/ผลตรวจ Audit \/ หลักฐานอ้างอิง \(10–2,000/);assert.equal(f.previews,1);assert.equal(f.writes,0);assert.equal(f.nodes['#closureAuditChecked'].checked,false);
  f.nodes['#closureAuditChecked'].checked=true;await f.nodes['#closureSend'].onclick({target:{}});assert.equal(f.writes,0,'pending case cannot use an auto-filled generic reason');
 }
 for(const role of ['monitor','audit_assistant','shift_lead']){const f=fixture(role);await f.ctx.api.openSubmit({dbId:'case'});assert.equal(f.modal,'');assert.equal(f.previews,0);assert.equal(f.writes,0);}
 const missing=fixture('lead',{}, {allowed:false,problems:['ไม่มีหลักฐานจริง']});await missing.ctx.api.openSubmit({dbId:'case'});assert.equal(missing.modal,'');assert.match(missing.warnings.join(' '),/ไม่มีหลักฐานจริง/);
 const reserved=fixture('lead',{case_closure_request_id:'old'});await reserved.ctx.api.openSubmit({dbId:'case'});assert.match(reserved.warnings.join(' '),/คำขอปิดหรือจับคู่ค้าง/);assert.equal(reserved.previews,0);
 const normal=fixture('lead',{status:'open',ex_type:'missing_stm'});await normal.ctx.api.openSubmit({dbId:'case'});assert.equal(normal.previews,0);assert.match(normal.modal,/ไม่บังคับ/,'normal role flow unchanged');
 const host={textContent:'old warning'};await normal.ctx.api.mountReview({},host);assert.equal(host.textContent,'','no pending request is normal, not a refresh error');
 console.log('PASS pending close UI: nine companies, head-only read-only preflight, exact blocked reasons, mandatory reason and unchecked confirmation, no automatic closure/write; normal cases unchanged.');
})().catch(e=>{console.error(e);process.exit(1)});
