import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const source=read('../supabase.js');
const code=source.slice(source.indexOf('  async function confirmDamage('),source.indexOf('  async function closeException('));
let response=[{id:'damage-1',exception_id:'case-1'}], calls=[];
const save=new Function('json',code+';return confirmDamage;')(async(url,options)=>{
  calls.push({url,body:JSON.parse(options.body)});
  if(response instanceof Error) throw response;
  return response;
});
assert.equal((await save('case-1','open',34,'[damage:v1:system] reviewed')).id,'damage-1');
await save('case-1','open',34,'[damage:v1:system] reviewed');
assert.deepEqual(calls[0],calls[1]);
assert.equal(calls[0].url,'/rest/v1/rpc/confirm_damage');
for(const invalid of [null,[],[{}],[{id:'damage-1',exception_id:'other'}]]){
  response=invalid; await assert.rejects(save('case-1','open',34,'reason'));
}
response=new Error('timeout'); await assert.rejects(save('case-1','open',34,'reason'),/timeout/);
const app=read('../app.js');
const handler=app.slice(app.indexOf('$("#btnDamage").addEventListener'),app.indexOf('$("#btnApprove").addEventListener'));
assert.ok(!handler.includes('Sb.post('));
assert.ok(handler.indexOf('await Sb.confirmDamage(')<handler.indexOf('e.status = "damage"'));
assert.ok(handler.includes('saveOverride(e, false)'));
const sql=read('../supabase/20260912_confirm_damage_atomic.sql');
assert.ok(sql.includes('from anon;'), 'Supabase default anon grants must be explicitly revoked');
for(const contract of ['security invoker','for update','damages_one_per_exception_idx','public.has_company_access(e.company)',"('lead','admin')",'public.case_evidence','return next d; return;',"update public.exceptions set status='damage'",'revoke all']) assert.ok(sql.includes(contract),contract);
console.log('Damage save: RPC payload, retry, failure, no optimistic closure and SQL safety contracts passed (not a live database test)');
