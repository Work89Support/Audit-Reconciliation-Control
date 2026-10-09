import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const source=fs.readFileSync(new URL('supabase.js',root),'utf8');
const app=fs.readFileSync(new URL('app.js',root),'utf8');
assert.match(app,/const DEFAULT_RANGE_FROM = DEFAULT_WORK_DATE/);
const dates=app.slice(app.indexOf('const PROD_TODAY ='),app.indexOf('const state ='));
for(const [instant,expected] of [['2026-10-08T16:59:00Z','2026-10-07'],['2026-10-08T17:00:00Z','2026-10-08'],['2027-01-01T00:00:00Z','2026-12-31']]){
 class Clock extends Date {constructor(...args){super(...(args.length?args:[instant]));}}
 const dateContext={Date:Clock,Intl};vm.runInNewContext(dates+'; result = DEFAULT_WORK_DATE;',dateContext);
 assert.equal(dateContext.result,expected,'Thai midnight and year rollover Day-1');
}
assert.match(app,/\['exceptions', 'cloud', 'daily-summary', 'mc8-sheets'\]\.includes\(state.route\)/);
let active=0,maxActive=0; const urls=[];
const context={window:{APP_CONFIG:{}},Store:{data:{supabase:{url:'https://test.invalid',anonKey:'test-public'}},persist(){}},localStorage:{getItem(){return null},setItem(){},removeItem(){}},AbortController,setTimeout,clearTimeout,fetch:async url=>{
 urls.push(url); active++;maxActive=Math.max(active,maxActive);
 await new Promise(resolve=>setTimeout(resolve,1));
 let rows=[];
 if(url.includes('/daily_recon_jobs?')) rows=Array.from({length:23},(_,i)=>({last_run_id:'run-'+i}));
 if(url.includes('/exceptions?')) rows=Array.from({length:url.includes('offset=0')?1000:3},(_,i)=>({id:'case-'+i}));
 if(url.includes('/recon_runs?')) rows=[{id:'run',match_evidence:[{id:'pair'}]}];
 active--;return {ok:true,status:200,text:async()=>JSON.stringify(rows)};
}};
vm.runInNewContext(source,context);
const rows=await context.window.Sb.currentExceptionsSummary({from:'2026-10-07',to:'2026-10-07',company:'FR8',limit:5000});
assert.equal(rows.length,1003);assert.equal(maxActive,1,'pages are serialized and stop at first short page');
const pages=urls.filter(u=>u.includes('/exceptions?'));
assert.equal(pages.length,2);
for(const url of pages){assert.match(url,/business_date=gte.2026-10-07/);assert.match(url,/business_date=lte.2026-10-07/);assert.match(url,/company=eq.FR8/);}
urls.length=0;
const evidence=await context.window.Sb.reconciliationEvidence({from:'2026-10-07',to:'2026-10-07',company:'FR8'});
assert.equal(evidence.length,3);
const chunks=urls.filter(u=>u.includes('/recon_runs?'));
assert.equal(chunks.length,3);
for(const url of chunks){assert.match(url,/match_evidence:summary->match_evidence/);assert.doesNotMatch(url,/select=id,summary&/);assert.ok(url.split('id=in.(')[1].split(')')[0].split(',').length<=10);}
const rounds=JSON.parse(fs.readFileSync(new URL('n8n/audit-round-dispatcher.json',root),'utf8'));
assert.equal(rounds.nodes.find(n=>n.id==='call-worker').parameters.options.waitForSubWorkflow,true);
assert.equal(rounds.nodes.find(n=>n.id==='round-pause').parameters.amount,5);
assert.equal(rounds.connections['ทำงานแล้วจึงดูคิวถัดไป'].main[0][0].node,'พักก่อนงานถัดไป');
for(const id of ['queue','peek-queue']){const node=rounds.nodes.find(n=>n.id===id);assert.equal(node.maxTries,2);assert.equal(node.waitBetweenTries,10000);assert.equal(node.parameters.options.timeout,30000);}
const sql=fs.readFileSync(new URL('supabase/20261009_single_recon_worker.sql',root),'utf8');
assert.match(sql,/pg_try_advisory_xact_lock/);assert.match(sql,/where not is_archived and status='running'\) then return/);assert.match(sql,/for update skip locked limit 1/);
assert.doesNotMatch(sql,/update public.exceptions|delete from|alter policy/);
console.log('Read budgets: one-day start, route-owned loading, scoped serial pages, small projected evidence batches, paced worker, global claim guard passed (mock/static).');
