const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('app.js','utf8');
const code=app.slice(app.indexOf('let liveQueueUpdatePending'),app.indexOf('function offerLiveOverviewUpdate()'));
let count=0,loads=0,timer,scroll;const elements={};const fields=[];
const ctx={state:{dataset:'production',route:'audit-review',filters:{company:'FR8'},page:3},Sb:{signedIn:()=>true},liveOverviewState:{loading:false,exceptionsReady:true},
 document:{visibilityState:'visible',activeElement:null,addEventListener:()=>{}},$:s=>elements[s],window:{scrollX:12,scrollY:640,scrollTo:(...args)=>scroll=args},
 render:()=>count++,requestAnimationFrame:fn=>fn(),setInterval:fn=>timer=fn,
 CaseClosure:{queueState:{at:10}},ManualPairing:{queueState:{at:20}},CrossDayWorkbench:{queueState:{at:30}},loadLiveOverview:async()=>{loads++;},Date};
elements['#viewRoot']={querySelectorAll:selector=>selector==='*'?[]:fields,querySelector:()=>null};
vm.createContext(ctx);vm.runInContext(code,ctx);
(async()=>{
 assert.equal(ctx.applyLiveQueueUpdate(),true);assert.equal(count,1);assert.deepEqual(scroll,[12,640]);assert.equal(ctx.state.page,3);assert.equal(ctx.state.filters.company,'FR8');
 for(const key of ['#drawer','#modal']){elements[key]={hidden:false};assert.equal(ctx.applyLiveQueueUpdate(),false);elements[key].hidden=true;}
 fields.push({type:'text',value:'ข้อความร่าง',defaultValue:'',tagName:'INPUT'});assert.equal(ctx.applyLiveQueueUpdate(),false);await ctx.pollLiveQueues();assert.equal(loads,0,'do not fetch or redraw while editing');fields.length=0;
 fields.push({type:'checkbox',checked:true});assert.equal(ctx.applyLiveQueueUpdate(),false);fields.length=0;
 ctx.liveOverviewState.loading=true;assert.equal(ctx.applyLiveQueueUpdate(),false);ctx.liveOverviewState.loading=false;
 ctx.liveOverviewState.auxiliaryError='timeout';assert.equal(ctx.applyLiveQueueUpdate(),false);ctx.liveOverviewState.auxiliaryError=null;
 await ctx.pollLiveQueues();await ctx.pollLiveQueues();assert.equal(loads,1,'poll coalesced within 30 seconds');
 ctx.state.route='approvals';vm.runInContext('liveQueueLastPoll=0',ctx);await ctx.pollLiveQueues();assert.equal(loads,2);assert.equal(ctx.CaseClosure.queueState.at,0);
 ctx.state.route='mc8-sheets';assert.equal(ctx.applyLiveQueueUpdate(),false);await ctx.pollLiveQueues();assert.equal(loads,2,'other pages unchanged');
 assert.match(app,/await loadLiveOverview\(true\);\s+if\(state.route!==savedRoute\)/);
 assert.doesNotMatch(code,/Sb\.(decide|close|post|request|submit)/);
 // A confirmed save reloads the latest read model before painting the queue.
 ctx.state.route='audit-review';ctx.DB={exceptions:[{id:'fixture',status:'answered'}]};ctx.toast=()=>{};
 ctx.closeModal=()=>{};ctx.closeDrawer=()=>{};
 ctx.render=()=>{ctx.visible=ctx.DB.exceptions.filter(e=>e.status==='answered').map(e=>e.id);};
 ctx.loadLiveOverview=async()=>{ctx.DB.exceptions=[{id:'fixture',status:'closed'}];};
 const finish=app.slice(app.indexOf('async function refreshCaseView()'),app.indexOf('function closeDrawer()',app.indexOf('async function finishApprovalReview()')));
 vm.runInContext(finish,ctx);await ctx.finishApprovalReview();assert.deepEqual(ctx.visible,[],'confirmed row disappears from latest queue without clicking apply');
 console.log('PASS queue auto update: Audit/approvals only, initial data readiness, polling throttle, drafts/modals/selections protected, scroll/filters retained and no writes. Mock reads only.');
})().catch(e=>{console.error(e);process.exit(1);});
