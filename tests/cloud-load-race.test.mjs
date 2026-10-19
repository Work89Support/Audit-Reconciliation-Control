import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const code=app.slice(app.indexOf('async function cloudLoad('),app.indexOf('/* โหลดไฟล์จาก Storage'));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function setup(){
  const calls=[],timers=new Map();let nextTimer=0,renders=0;
  const state={route:'cloud',filters:{from:'2026-10-17',to:'2026-10-17',company:'SK8'}};
  const cloudState={batches:null,caseAttachments:null,daily:null,operations:null,loading:false,auxiliaryLoading:false,key:'',requestId:0,picked:{keep:true}};
  const Sb=Object.fromEntries(['batches','dailyStatus','operations','caseEvidenceLibrary'].map(name=>[name,args=>{const d=deferred();calls.push({name,args,...d});return d.promise;}]));
  const context={state,cloudState,Sb,DB:{BUSINESS_DATE:'2026-10-18'},cloudQueryKey:()=>JSON.stringify(state.filters),render(){renders++;},setTimeout(fn,ms){assert.equal(ms,35000);const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}};
  vm.createContext(context);vm.runInContext(code,context);
  return {...context,calls,timers,get renders(){return renders;}};
}
{
  const c=setup(),old=c.cloudLoad();await flush();assert.equal(c.calls.length,4);
  const duplicate=c.cloudLoad();await duplicate;assert.equal(c.calls.length,4);
  c.calls[0].resolve([{id:'SK8-file',source_files:[{kind:'pm_statement'}]}]);await flush();
  assert.equal(c.cloudState.batches[0].id,'SK8-file');assert.equal(c.cloudState.loading,false,'Files do not wait for primary/queue reads');
  assert.equal(c.cloudState.auxiliaryLoading,true);
  c.state.filters.company='AT4';const current=c.cloudLoad();await flush();
  assert.equal(c.calls.length,8,'Changing scope starts immediately while old auxiliary reads are pending');
  assert.equal(c.cloudState.batches,null,'Old scope files cannot be shown in new scope');
  c.calls.slice(4).forEach((x,i)=>x.resolve(i===0?[{id:'AT4-file'}]:[]));await current;
  c.calls.slice(1,4).forEach(x=>x.resolve([{id:'OLD'}]));await old;
  assert.equal(c.cloudState.batches[0].id,'AT4-file');assert.equal(c.cloudState.loading,false);assert.equal(c.cloudState.auxiliaryLoading,false);
  assert.equal(c.timers.size,0);
}
{
  const c=setup(),old=c.cloudLoad();await flush();
  c.state.filters.to='2026-10-18';const current=c.cloudLoad();await flush();
  c.calls.slice(0,4).forEach(x=>x.resolve([{id:'stale'}]));await old;
  assert.equal(c.cloudState.loading,true,'Stale request must not clear current spinner');
  c.calls.slice(4).forEach(x=>x.resolve([]));await current;
  assert.equal(c.cloudState.loading,false);
}
{
  const c=setup(),p=c.cloudLoad();await flush();
  c.calls[0].reject(new Error('network timeout'));c.calls[1].resolve([]);c.calls[2].resolve([]);c.calls[3].resolve([]);await p;
  assert.match(c.cloudState.error,/network timeout/);assert.equal(c.cloudState.batches,null);assert.equal(c.cloudState.loading,false);
  const retry=c.cloudLoad(true);await flush();assert.equal(c.calls.length,8);
  c.calls.slice(4).forEach(x=>x.resolve([]));await retry;assert.equal(c.cloudState.error,null);
}
{
  const c=setup(),p=c.cloudLoad();await flush();c.calls[0].resolve([{id:'files'}]);await flush();
  for(const fn of [...c.timers.values()])fn();await p;
  assert.equal(c.cloudState.loading,false);assert.equal(c.cloudState.auxiliaryLoading,false);
  assert.equal(c.cloudState.batches[0].id,'files');assert.match(c.cloudState.partialError,/หมดเวลารอข้อมูล/);
  c.calls.slice(1).forEach(x=>x.resolve([{id:'late'}]));await flush();assert.equal(c.cloudState.daily,null,'Late timed-out reads cannot overwrite error state');
}
assert.match(app,/cloudState\.key !== cloudQueryKey\(\) \|\| \(cloudState\.batches === null && !cloudState\.loading && !cloudState\.error\)/,'No automatic failure/retry/render loop');
assert.doesNotMatch(code,/Sb\.(rpc|markParsed|setAuditRunHold|correctAuditSource|run|confirm)/,'Load-only path cannot mutate business state');
console.log('Cloud load: filter races, partial-first rendering, time bounds, explicit retry, stale isolation and no writes passed');
