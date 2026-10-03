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
await save('case-1','open',34,'[damage:v2:employee] reviewed',{employee:'A',shift:'X8',time:'23:59'});
assert.equal(calls.at(-1).url,'/rest/v1/rpc/confirm_damage_details');
assert.equal(calls.at(-1).body.p_employee,'A');
assert.equal(calls.at(-1).body.p_shift,'X8');
assert.equal(calls.at(-1).body.p_occurred_at,'23:59');
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
const detailsSql=read('../supabase/20261003_damage_details.sql');
for(const contract of ['security invoker','for update','public.has_company_access(e.company)',"('lead','admin')",'public.case_evidence','return next d; return;','from public, anon','d.employee is not distinct from employee_value','add column if not exists occurred_at time']) assert.ok(detailsSql.includes(contract),contract);
assert.ok(!detailsSql.includes('update public.damages'));
console.log('Damage save: RPC payload, retry, failure, no optimistic closure and SQL safety contracts passed (not a live database test)');
