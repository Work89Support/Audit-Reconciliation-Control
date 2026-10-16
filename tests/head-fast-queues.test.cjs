const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('app.js','utf8'),companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
const source=app.slice(app.indexOf('// Read-only responder model.'),app.indexOf('async function loadLiveOverview('));
(async()=>{
 for(const role of ['monitor','audit_assistant','lead','admin']){
  let reads=0;const ctx={state:{dataset:'production',role,route:'audit-review',access:{companies:['*']},filters:{from:'2026-10-15',to:'2026-10-15',company:'ALL'}},DB:{exceptions:[]},liveOverviewState:{requestId:0},moreCaseState:{},Date,
   Sb:{signedIn:()=>true,authUser:()=>({id:role}),currentExceptionsSummary:async scope=>{reads++;assert.equal(scope.company,'ALL');return companies.flatMap(company=>[{id:company+'-audit',company,status:'answered'},{id:company+'-damage',company,status:'damage'},{id:company+'-file',company,status:'open',clarification_file_id:'file'}]);}},canAccessCompany:()=>true,mapLiveException:r=>r,renderFilters(){},offerLiveOverviewUpdate(){}};
  for(const name of ['ManualPairing','CrossDayWorkbench','CaseClosure'])ctx[name]={loadPending:async()=>{}};
  vm.createContext(ctx);vm.runInContext(source,ctx);await ctx.loadResponderQueue();
  for(const route of ['audit-review','approvals'])for(const company of companies){ctx.state.route=route;ctx.state.filters.company=company;await ctx.loadResponderQueue();assert.equal(ctx.DB.exceptions.filter(r=>r.company===company).length,3);}
  assert.equal(reads,1,'both review pages share one case read across all companies');assert.equal(ctx.DB.exceptions.length,27,'review model must retain damage and source-document cases, not only responder requests');
 }
 for(const [file,name,method] of [['manual-pairing.js','ManualPairing','pendingManualPairs'],['cross-day-workbench.js','CrossDayWorkbench','pendingCrossDayPairs'],['case-closure.js','CaseClosure','pendingCaseClosures']]){
  let actor='A',reads=0;const pending=[];
  const ctx={state:{dataset:'production',role:'admin',access:{companies:['*']}},Sb:{signedIn:()=>true,authUser:()=>({id:actor}),[method]:()=>{reads++;return new Promise(resolve=>pending.push(resolve));}},window:{},Date,renderNav(){}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(file,'utf8')+`;window.mod=${name}`,ctx);const mod=ctx.window.mod;
  const a=mod.loadPending(),b=mod.loadPending();assert.equal(reads,1,file+' coalesces concurrent mounts');pending.shift()([]);await Promise.all([a,b]);
  for(const company of companies){ctx.state.filters={company};await mod.loadPending();}assert.equal(reads,1,file+' does not reread on company-only filter');
  const forced=mod.loadPending(true);assert.equal(reads,2);pending.shift()([]);await forced;
  const old=mod.loadPending(true);actor='B';ctx.state.access.companies=['FR8'];const next=mod.loadPending();assert.equal(reads,4,file+' new actor/access scope cannot reuse old flight');pending.shift()([]);await old;assert.equal(mod.queueState.rows,null,'old actor response ignored');pending.shift()([]);await next;assert.equal(mod.queueState.user,'B');assert.equal(mod.queueState.rows.length,0);
 }
 // Preserve text only, never checked approval confirmations. Different
 // companies and identities have separate draft keys in memory.
 const field={id:'crossDayQueueNote',value:'ร่าง FR8',defaultValue:'ค่าเริ่มต้น'};
 const root={dataset:{},querySelectorAll:selector=>{assert.equal(selector,'textarea');return [field]}};
 const ctx={state:{dataset:'production',route:'approvals',role:'admin',access:{companies:['*']},filters:{company:'FR8'}},Sb:{authUser:()=>({id:'A'})},$:()=>root,document:{activeElement:null}};
 vm.createContext(ctx);vm.runInContext(source,ctx);root.dataset.fastQueueDraftKey=ctx.fastQueueDraftKey();ctx.captureFastQueueDrafts();
 ctx.state.filters.company='UFABET7M';root.dataset.fastQueueDraftKey=ctx.fastQueueDraftKey();field.value=field.defaultValue;ctx.restoreFastQueueDrafts();assert.equal(field.value,'ค่าเริ่มต้น','FR8 note cannot leak into 7M');
 ctx.state.filters.company='FR8';root.dataset.fastQueueDraftKey=ctx.fastQueueDraftKey();ctx.restoreFastQueueDrafts();assert.equal(field.value,'ร่าง FR8');field.value='ร่างใหม่';ctx.restoreFastQueueDrafts();assert.equal(field.value,'ร่างใหม่','late restore cannot overwrite newer typing');
 const review=app.slice(app.indexOf("VIEWS['audit-review']"),app.indexOf('VIEWS.approvals'));
 assert.match(review,/selectCompany:[\s\S]*await loadResponderQueue\(\)/);assert.doesNotMatch(review,/selectCompany:[^\n]+loadLiveOverview\(true\)/);
 assert.match(app,/mountQueue\(\$\('#pendingDocumentClosureQueue'\),\{scope:approvalScope\}\)/);
 console.log('PASS head queues: all nine companies and four authorized review roles, one shared case snapshot across Audit/approvals, three pending queues single-flight + 30s memory cache, force refresh, actor/access race isolation, per-company text drafts and no restored approval checks. Mocks only.');
})().catch(e=>{console.error(e);process.exit(1)});
