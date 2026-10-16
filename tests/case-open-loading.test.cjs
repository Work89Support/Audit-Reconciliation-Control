const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('app.js','utf8');
const prefix=app.slice(app.indexOf('const caseOpenDrafts ='),app.indexOf('  const queue = reviewQueueIds',app.indexOf('async function openException(')));
function fixture(){
 const e={id:'EX-1',dbId:'one',company:'FR8',status:'open',systemAmount:100,notes:[],evidence:[]};
 const drawer={hidden:true,dataset:{},classList:{add(){}},_html:''};let form=false;
 Object.defineProperty(drawer,'innerHTML',{get(){return this._html},set(v){this._html=v;form=false}});
 const fields={'#noteText':{value:'ร่าง Audit <เดิม>'},'#responseText':{value:'คำชี้แจงร่างเดิม'}};
 const nodes={'#drawer':drawer,'#drawerOverlay':{},'#drawerClose':{},'#caseOpenRetry':{}};
 const pending=[],calls=[];let actor='actor-A';
 const read=name=>{calls.push(name);return new Promise((resolve,reject)=>pending.push({name,resolve,reject}));};
 const ctx={state:{dataset:'production',role:'admin',route:'mc8-sheets'},DB:{exceptions:[e]},caseUiKey:r=>r.dbId||r.id,
  Sb:{authUser:()=>({id:actor}),exceptionDetail:()=>read('detail'),reviewHoldForCase:()=>read('hold'),caseNotes:()=>read('notes'),clarificationInstructions:()=>read('instructions'),clarificationHistory:()=>read('history'),caseEvidence:()=>read('evidence')},
  $:id=>fields[id]?(form?fields[id]:null):nodes[id],h:s=>String(s??'').replaceAll('<','&lt;'),clearTimeout(){},AuditUi:{open(){}},closeDrawer(){},canAccessCompany:()=>true,toast(){},mapLiveException:x=>x,refreshQuickCloseEvidence:async()=>{}};
 vm.createContext(ctx);vm.runInContext(prefix+'if(caseOpenTicket===ticket)caseOpenTicket=null;return e;})();return ticket.promise;}\nthis.drafts=caseOpenDrafts;this.cancel=()=>caseOpenTicket=null;',ctx);
 const finish=()=>pending.splice(0).forEach(p=>p.resolve(p.name==='detail'?{...e,status:'open'}:p.name==='hold'?null:[]));
 return {ctx,e,drawer,fields,calls,pending,finish,setActor:a=>actor=a,setForm:()=>{form=true;drawer.dataset.caseDraftKey=ctx.caseOpenDraftKey(e)}};
}
(async()=>{
 const f=fixture();f.setForm();f.ctx.captureCaseOpenDraft();
 const first=f.ctx.openException('EX-1'),duplicate=f.ctx.openException('EX-1');
 assert.match(f.drawer.innerHTML,/กำลังโหลดรายละเอียดเคส/,'loading shell appears synchronously');
 assert.equal(f.drawer.hidden,false);assert.equal(f.calls.length,6,'all independent reads start before any response');
 assert.doesNotMatch(f.drawer.innerHTML,/btnClarify|btnApprove|btnRespond/,'no business actions while loading');
 f.finish();await Promise.all([first,duplicate]);assert.equal(f.calls.length,6,'double click uses one load');
 assert.equal(f.e._detailLoaded,true);assert.equal(f.e._caseEvidenceLoaded,true,'support view will not recursively reload detail/evidence');
 assert.equal(f.ctx.drafts.get(f.ctx.caseOpenDraftKey(f.e)).note,'ร่าง Audit <เดิม>');
 assert.equal(f.ctx.drafts.get(f.ctx.caseOpenDraftKey(f.e)).response,'คำชี้แจงร่างเดิม');
 await Promise.resolve();const again=f.ctx.openException('EX-1');assert.equal(f.calls.length,12,'reopen revalidates, no stale completed cache');f.finish();await again;
 f.setForm();f.fields['#noteText'].value='ข้อความใหม่ระหว่างบันทึก';f.ctx.captureCaseOpenDraft();f.ctx.clearSavedCaseDraft(f.e,'note','ร่าง Audit <เดิม>');
 assert.equal(f.fields['#noteText'].value,'ข้อความใหม่ระหว่างบันทึก','late save cannot erase newer typing');
 const cancelled=fixture();const p=cancelled.ctx.openException('EX-1');cancelled.ctx.cancel();cancelled.finish();assert.equal(await p,undefined,'closing while loading cannot resurrect a case');
 const responder=fixture();responder.ctx.state.role='shift_lead';const rp=responder.ctx.openException('EX-1');assert.equal(responder.calls.includes('notes'),false,'company responder never reads full internal note log');responder.finish();await rp;
 const changed=fixture();const q=changed.ctx.openException('EX-1');changed.setActor('other-user');changed.finish();assert.equal(await q,undefined,'late response is ignored after identity switch');
 assert.equal(changed.ctx.drafts.get(changed.ctx.caseOpenDraftKey(changed.e)),undefined,'drafts isolated by user');
 const failed=fixture();const z=failed.ctx.openException('EX-1');failed.pending.find(p=>p.name==='hold').reject(Error('hold timeout'));failed.pending.splice(failed.pending.findIndex(p=>p.name==='hold'),1);failed.finish();await z;
 assert.match(failed.drawer.innerHTML,/ยังเปิดเคสไม่ได้/);assert.match(failed.drawer.innerHTML,/caseOpenRetry/,'critical read failure stays fail-closed and retryable');
 const quick=app.slice(app.indexOf('async function refreshQuickCloseEvidence('),app.indexOf('// Completion is a positive assertion'));
 let reads=0;const c={state:{dataset:'production'},Sb:{reconciliationOverview:async()=>{reads++;return {cases:[]}},evidenceCaseRecommendations:async()=>{reads++;return []}}};vm.createContext(c);vm.runInContext(quick,c);
 for(const status of ['pending_next_day','answered','closed','open'])await c.refreshQuickCloseEvidence({dbId:'x',_detailLoaded:true,status,systemAmount:100,bankAmount:null});
 assert.equal(reads,0,'missing-side/non-open cases avoid whole-day reads');
 await c.refreshQuickCloseEvidence({dbId:'x',_detailLoaded:true,status:'open',systemAmount:100,bankAmount:100});assert.equal(reads,2,'eligible complete pair still verifies authoritative evidence');
 console.log('PASS case opening: immediate loading, six parallel reads, duplicate single-flight, fresh reopening, no recursive detail/evidence reload, draft/user isolation, cancelled/stale response guard, fail-closed retry, unnecessary full-day reads skipped. Mocks only.');
})().catch(e=>{console.error(e);process.exit(1)});
