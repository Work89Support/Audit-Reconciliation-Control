const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('supabase.js','utf8');
const fn=source.slice(source.indexOf('async function requestClarification('),source.indexOf('async function manualPairCandidates('));
let total=0;
(async()=>{
for(const company of ['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'])for(const origin of ['manual','system'])for(const status of ['open','pending_next_day']){
 const id=company+'-'+origin,receipt={id,company,status:'clarifying',requested_at:'2026-10-17T03:00:00Z',requested_by:'actor'};
 let writes=0,reads=0,mode='ok';
 const ctx={rpc:async(name,args)=>{assert.equal(name,'request_current_case_clarification');assert.equal(args.p_case,id);assert.equal(args.p_previous_status,status);return write();},json:async(path,opts)=>{
  if(opts?.method==='PATCH'){assert.ok(path.includes('status=eq.'+status));return [write()];}
  reads++;assert.equal(opts.recoverRead,true);assert.ok(path.includes('id=eq.'+id));
  if(mode==='read-timeout')throw Error('Supabase timeout');
  if(mode==='missing')return [];
  if(mode==='stale')return [{...receipt,status:'closed'}];
  if(mode==='wrong-actor')return [{...receipt,requested_by:'other'}];
  return [receipt];
 }};
 function write(){writes++;if(mode==='write-timeout')throw Error('Supabase timeout');if(mode==='bad-response')return {...receipt,requested_at:null};return receipt;}
 vm.createContext(ctx);vm.runInContext(fn,ctx);
 const body={requested_at:receipt.requested_at,requested_by:'actor'};
 assert.equal((await ctx.requestClarification(id,status,body)).id,id);assert.equal(writes,1);assert.equal(reads,1);
 for(mode of ['read-timeout','missing','stale','wrong-actor','write-timeout','bad-response']){
  const before=writes;await assert.rejects(()=>ctx.requestClarification(id,status,body),/ยังยืนยันการส่งไม่ได้/);
  assert.equal(writes,before+1,'never retries ambiguous writes');total++;
 }
}
{
 const ctx={rpc:async()=>{throw Error('must not write');},json:async()=>{throw Error('must not read');}};
 vm.createContext(ctx);vm.runInContext(fn,ctx);
 await assert.rejects(()=>ctx.requestClarification('answered-case','answered',{}),/ปุ่มตีกลับ/);
}
console.log(`PASS ${total} negative checks: nine companies, manual/system, open/answered/cross-day; no success without persisted receipt; no write replay. Mock transport only, no production writes.`);
})().catch(e=>{console.error(e);process.exit(1);});
