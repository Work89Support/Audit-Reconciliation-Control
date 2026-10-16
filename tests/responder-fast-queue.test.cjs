const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('app.js','utf8');
const source=app.slice(app.indexOf('// Read-only responder model.'),app.indexOf('async function loadLiveOverview('));
const companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
function fixture(){
 let actor='responder-A',now=100000,reads=0,paints=0,filters=0;const pending=[];
 const ctx={state:{dataset:'production',route:'clarify',role:'shift_lead',access:{email:'qa@example.invalid',companies:['*']},filters:{from:'2026-10-15',to:'2026-10-15',company:'ALL'}},DB:{exceptions:[]},liveOverviewState:{requestId:0},moreCaseState:{},
  Sb:new Proxy({signedIn:()=>true,authUser:()=>({id:actor}),currentExceptionsSummary:scope=>{reads++;assert.equal(scope.company,'ALL');assert.equal(scope.limit,5000);return new Promise((resolve,reject)=>pending.push({resolve,reject,scope}));}},{get(t,k){if(k in t)return t[k];throw Error('Unexpected read/write '+String(k))}}),
  canAccessCompany:c=>ctx.state.access.companies.includes('*')||ctx.state.access.companies.includes(c),mapLiveException:r=>({...r,dbId:r.id,company:r.company,date:r.business_date}),renderFilters:()=>filters++,offerLiveOverviewUpdate:()=>paints++,Date:class extends Date{static now(){return now}}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,pending,get reads(){return reads},get paints(){return paints},get filters(){return filters},advance:n=>now+=n,actor:a=>actor=a};
}
(async()=>{
 const f=fixture();const rows=companies.map((company,i)=>({id:String(i),company,business_date:'2026-10-15',status:'clarifying',requested_at:'2026-10-16'}));
 const first=f.ctx.loadResponderQueue();const duplicate=f.ctx.loadResponderQueue();assert.equal(f.reads,1,'in-flight request shared');assert.equal(f.ctx.liveOverviewState.exceptionsReady,false,'initial load is not zero');
 f.pending.shift().resolve([...rows,{...rows[0],id:'unsent',requested_at:null},{...rows[0],id:'closed',status:'closed'},{...rows[0],id:'approval',case_closure_request_id:'linked'}]);await Promise.all([first,duplicate]);assert.equal(f.ctx.DB.exceptions.length,9);
 const filters=JSON.stringify(f.ctx.state.filters);for(const company of companies){f.ctx.state.filters.company=company;await f.ctx.loadResponderQueue();assert.equal(f.ctx.DB.exceptions.filter(x=>x.company===company).length,1);assert.equal(f.ctx.state.filters.company,company);}
 assert.equal(f.reads,1,'nine company switches require zero extra network reads');assert.equal(f.filters,9);assert.equal(f.ctx.liveOverviewState.responderOnly,true);
 f.advance(31000);const refresh=f.ctx.loadResponderQueue();assert.equal(f.reads,2);assert.equal(f.ctx.DB.exceptions.length,9,'keep prior data while revalidating');f.pending.shift().reject(Error('temporary timeout'));await refresh;assert.equal(f.ctx.DB.exceptions.length,9);assert.match(f.ctx.liveOverviewState.auxiliaryError,/timeout/);
 await f.ctx.loadResponderQueue();assert.equal(f.reads,2,'failed refresh cannot create render/retry storm');
 const retry=f.ctx.loadResponderQueue(true);assert.equal(f.reads,3);f.pending.shift().resolve([rows[0]]);await retry;assert.equal(f.ctx.DB.exceptions.length,1);assert.equal(f.ctx.liveOverviewState.auxiliaryError,null);
 f.ctx.state.filters.to='2026-10-16';const old=f.ctx.loadResponderQueue();assert.equal(f.ctx.DB.exceptions.length,0,'date change cannot show old-period rows');f.actor('responder-B');f.ctx.state.access.companies=['FR8'];const fresh=f.ctx.loadResponderQueue();assert.equal(f.reads,5,'new actor/scope does not reuse old cache');
 f.pending.shift().resolve(rows);await old;assert.equal(f.ctx.DB.exceptions.length,0,'late old actor result discarded');f.pending.shift().resolve(rows);await fresh;assert.deepEqual(f.ctx.DB.exceptions.map(x=>x.company),['FR8'],'client also enforces current scope in addition to server RLS');
 f.ctx.state.route='cloud';assert.equal(f.ctx.responderQueueMode(),false);f.ctx.state.route='clarify';f.ctx.state.role='admin';assert.equal(f.ctx.responderQueueMode(),false);
 assert.doesNotMatch(source,/localStorage|sessionStorage|Sb\.(post|request|submit|close|decide|dailyChecklist|auditLogs|quality|reconciliationEvidence)/,'no persistence, business writes or heavy dashboard reads');
 assert.match(app,/if \(state.route === 'clarify' && state.role === 'shift_lead'\) return loadResponderQueue\(force\)/);
 console.log('PASS responder fast queue: all nine filters, one shared scoped read, 30s memory freshness, no heavy dashboard reads, force retry, failure backoff, pending-data retention, date/actor/access isolation, stale-response rejection, requested-only queue, no writes. Mocks only.');
})().catch(e=>{console.error(e);process.exit(1)});
