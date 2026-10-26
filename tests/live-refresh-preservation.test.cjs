const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('app.js','utf8');
const load=app.slice(app.indexOf('async function loadLiveOverview('),app.indexOf('function ensureLiveOverview('));
const entry=app.slice(app.indexOf('async function enterProductionApp()'),app.indexOf('async function boot()'));
(async()=>{
 for(const company of ['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9']) {
  let release,reads=0,limit,hydrations=0;
  const old=[{id:'old',date:'2026-10-15',draft:'not raw; preserve this object'}];
  const state={dataset:'production',route:'clarify',filters:{from:'2026-10-15',to:'2026-10-15',company}};
  const context={state,DB:{exceptions:old,damages:[],auditLog:[]},liveOverviewState:{key:`2026-10-15|2026-10-15|${company}`,quality:[],exceptionsReady:true,requestId:0},
   moreCaseState:{},VISIBLE_DATE_FROM:'2026-10-15',liveInteractionVersion:0,AccountReviewHolds:{set(){}},isLiveCompanyRow:()=>true,actionableAuditRows:r=>r,informationalAuditRows:()=>[],matchedStaleAuditCount:()=>0,
   Sb:{dailyStatus:async()=>[],operations:async()=>[],quality:async()=>[],dailyChecklist:async()=>[],currentCaseCounts:async()=>[],boFirstCoverage:async()=>[],runtimeSettings:async()=>[],reviewHoldScopes:async()=>[],
    currentExceptionsSummary:async args=>{reads++;limit=args.limit;return new Promise((resolve,reject)=>release={resolve,reject});},damages:async()=>[],auditLogs:async()=>[],notifications:async()=>[],clarificationMatches:async()=>[],reconciliationEvidence:async()=>[]},
   hydrateLiveData:(q,o,e)=>{hydrations++;context.DB.exceptions=e;},updateBell(){},offerLiveOverviewUpdate(){},Date};
  vm.createContext(context);vm.runInContext(load,context);
  const first=context.loadLiveOverview(true);await new Promise(r=>setImmediate(r));
  assert.strictEqual(context.DB.exceptions,old,'phase 1 must not clear/remap last loaded case objects');
  assert.equal(hydrations,0);await context.loadLiveOverview(true);assert.equal(reads,1,'no overlapping auxiliary read');assert.equal(limit,5000,'clarification list is not truncated at 250 across companies');
  release.reject(Error('read timeout'));await first;
  assert.strictEqual(context.DB.exceptions,old,'failed refresh retains last loaded cases and draft objects');assert(context.liveOverviewState.exceptionsReady);assert.match(context.liveOverviewState.auxiliaryError,/timeout/);
  const next=context.loadLiveOverview(true);await new Promise(r=>setImmediate(r));release.resolve([{id:'new',company}]);await next;
  assert.equal(context.DB.exceptions[0].id,'new');assert.equal(context.liveOverviewState.auxiliaryError,null);assert.equal(state.filters.company,company);
 }
 // Revalidating an already admitted actor must preserve the actual DOM and
 // drafts, not re-run data preparation or silently admit after a timeout.
 const nodes={'#appShell':{hidden:false},'#connectionGate':{},'#accessWaitNotice':{remove(){}}};
 const state={access:{loaded:true,email:'audit@example.invalid',role:'admin',companies:['3XB']},filters:{company:'3XB'}};
 let prepared=0,retry,transient=true,signouts=0;
 const context={state,setTimeout,clearTimeout,$:s=>nodes[s]||{},Sb:{authUser:()=>({email:'audit@example.invalid'}),passwordChangeRequired:async()=>false,signOut(){signouts++;}},
  showConnectingGate:(message,action,preserve)=>{assert(preserve);retry=action;nodes['#appShell'].inert=true;},prepareProductionData:()=>prepared++,applyAuthenticatedRole:async()=>{if(transient)throw Error('timeout');}};
 context.Sb.myAccess=async()=>({});
 vm.createContext(context);vm.runInContext(entry,context);
 assert.equal(await context.enterProductionApp(),false);assert.equal(prepared,0);assert.equal(nodes['#appShell'].hidden,false);assert.equal(nodes['#appShell'].inert,true);assert.equal(signouts,0);
 transient=false;assert.equal(await retry(),true);assert.equal(prepared,0);assert.equal(nodes['#appShell'].inert,false);assert.equal(state.filters.company,'3XB');
 const clarify=app.slice(app.indexOf('VIEWS.clarify ='),app.indexOf('VIEWS.clarify =')+1600);
 assert.match(clarify,/if \(!liveOverviewState.exceptionsReady\)/);assert.match(clarify,/ยังไม่สรุปว่าไม่มีเคสหรือยอดเป็นศูนย์/);
 console.log('PASS all 9 companies: no zero/clear during pending read, no overlapping load, complete clarification scope, failed refresh retains objects, successful refresh updates, slow access retains DOM/drafts but blocks actions, same-scope recovery avoids reset. Mock reads only.');
})().catch(e=>{console.error(e);process.exit(1)});
