const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('clarification-return.js','utf8');
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fixture(role='monitor',company='FR8',extra={}){
 let writes=[],warnings=[],modal='',readback=0,actor='audit';const nodes={};
 for(const n of ['Reason','Checked','Send','State','Cancel'])nodes['#clarificationReturn'+n]={value:'',checked:false,disabled:false,textContent:''};
 const e={id:'case',dbId:'case',status:'answered',company,...extra};
 const fresh={id:'case',company,status:'answered',updated_at:'2026-10-17T07:00Z',responded_at:'2026-10-17T06:00Z'};
 const ctx={state:{role,dataset:'production',route:'audit-review',filters:{company,from:'2026-10-15',to:'2026-10-31'}},Sb:{signedIn:()=>true,authUser:()=>({id:actor}),exceptionDetail:async()=>fresh,returnClarification:async body=>{writes.push(body);return{id:'case',request_id:body.p_id,status:'clarifying'}}},can:()=>true,canAccessCompany:c=>c===company,caseLabel:()=>'<CASE>',h:escape,toast:t=>warnings.push(t),crypto:{randomUUID:()=> 'nonce'},openModal:(title,body,buttons)=>{modal=title+body+buttons},closeModal:()=>{modal=''},$:s=>nodes[s],captureCaseOpenDraft(){},openEvidenceRelatedCase:async()=>{readback++}};
 vm.createContext(ctx);vm.runInContext(source+';this.api=ClarificationReturn',ctx);
 return{ctx,e,fresh,nodes,writes,warnings,get modal(){return modal},get readback(){return readback},setActor:a=>actor=a};
}
(async()=>{
 for(const company of ['3XB','FR8','AT4','SK8','MR9','MC8','UR9','PS8','UFABET7M'])for(const manual of [false,true]){
  const f=fixture('monitor',company,{hasEvidence:true,manualPrimaryId:manual?'primary':null});const filters=JSON.stringify(f.ctx.state.filters);
  await f.ctx.api.open(f.e);assert.equal(f.writes.length,0);assert.match(f.modal,/ตีกลับให้ชี้แจงเพิ่มเติม/);assert.match(f.modal,/&lt;CASE&gt;/);
  assert.equal(f.nodes['#clarificationReturnChecked'].checked,false);
  f.nodes['#clarificationReturnReason'].value='ร่างเหตุผลเพิ่มเติมของบริษัท';f.nodes['#clarificationReturnReason'].oninput();
  f.nodes['#clarificationReturnCancel'].onclick();assert.equal(f.writes.length,0);
  await f.ctx.api.open(f.e);assert.match(f.modal,/ร่างเหตุผลเพิ่มเติมของบริษัท/);assert.equal(JSON.stringify(f.ctx.state.filters),filters);
  await f.nodes['#clarificationReturnSend'].onclick();assert.equal(f.writes.length,0,'no unchecked submit');
 }
 const f=fixture();await f.ctx.api.open(f.e);f.nodes['#clarificationReturnReason'].value='ขอหลักฐานรายการธนาคารเพิ่มเติมให้ครบ';f.nodes['#clarificationReturnChecked'].checked=true;
 await Promise.all([f.nodes['#clarificationReturnSend'].onclick(),f.nodes['#clarificationReturnSend'].onclick()]);assert.equal(f.writes.length,1);assert.equal(f.readback,1);assert.equal(f.writes[0].p_expected_updated_at,f.fresh.updated_at);
 for(const role of ['shift_lead','viewer']){const f=fixture(role);await f.ctx.api.open(f.e);assert.equal(f.modal,'');assert.equal(f.writes.length,0);}
 for(const extra of [{status:'closed'},{status:'clarifying'},{closureRequestId:'pending'},{manualPairId:'pending'},{reviewHold:{id:'hold'}}])assert.equal(fixture('lead','FR8',extra).ctx.api.eligible({...f.e,...extra}),false);
 const changed=fixture();await changed.ctx.api.open(changed.e);changed.setActor('other');changed.nodes['#clarificationReturnChecked'].checked=true;changed.nodes['#clarificationReturnReason'].value='ต้องการหลักฐานรายการเพิ่มเติม';await changed.nodes['#clarificationReturnSend'].onclick();assert.equal(changed.writes.length,0);
 const stale=fixture();stale.fresh.status='closed';await stale.ctx.api.open(stale.e);assert.equal(stale.modal,'');
 const review=fs.readFileSync('audit-review.js','utf8'),app=fs.readFileSync('app.js','utf8'),index=fs.readFileSync('index.html','utf8'),sb=fs.readFileSync('supabase.js','utf8');
 assert.match(review,/data-audit-return/);assert.match(app,/btnReturnClarification/);assert.match(app,/canReturn:e=>ClarificationReturn.eligible/);assert.ok(index.indexOf('clarification-return.js')<index.indexOf('app.js'));assert.match(sb,/returnClarification=body=>rpc\('return_case_for_clarification',body\)/);
 console.log('PASS clarification return UI: all nine companies/manual/system; explicit reason+unchecked confirmation; cancel/open no writes; actor/stale/reservation/hold guards; one write on repeated submit; drafts and filters retained. Mock writes only.');
})().catch(e=>{console.error(e);process.exit(1)});

