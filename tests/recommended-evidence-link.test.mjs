import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../supabase/20260917_link_recommended_case_evidence.sql',import.meta.url),'utf8');
const start=app.indexOf('const candidates=(await Sb.evidenceFiles');
const code=app.slice(start,app.indexOf("const list=document.createElement('section')",start));
const e={dbId:'case',runId:'run',date:'2026-09-15',company:'MC8'};
const valid={exception_id:'case',exceptions:{run_id:'run',company:'MC8',business_date:e.date},evidence_recommendations:{id:'rec',source_file_id:'file',status:'pending_audit',business_date:e.date,company:'SK8',payer_company:'MC8'}};
async function check(link,access=true){
  let reads=0;
  const ctx=vm.createContext({e,from:'2026-09-01',to:'2026-09-30',canAccessCompany:()=>access,Sb:{evidenceFiles:async()=>[],evidenceCaseRecommendations:async()=>[link],exceptionFiles:async()=>{reads++;return [{id:'file',kind:'doc_clarify'}];}}});
  const result=await vm.runInContext(`(async()=>{${code};return {n:candidates.length,id:recommended.get('file')};})()`,ctx);
  return {...result,reads};
}
assert.deepEqual(await check(valid),{n:1,id:'rec',reads:1});
assert.equal((await check(valid,false)).reads,0);
assert.equal((await check({...valid,exception_id:'other'})).reads,0);
assert.equal((await check({...valid,exceptions:{...valid.exceptions,run_id:'old'}})).reads,0);
assert.equal((await check({...valid,evidence_recommendations:{...valid.evidence_recommendations,business_date:'2026-09-14'}})).reads,0);
for(const guard of ['auth.uid() is null','has_company_access(r.company)','has_company_access(r.payer_company)','for update','last_run_id=e.run_id','exception_id=e.id','e.clarification_file_id<>f.id'])assert.ok(sql.includes(guard),guard);
assert.ok(!/set\s+status\s*=/i.test(sql));
assert.ok(!sql.includes('delete from'));
assert.ok(app.includes('e._uploadResult = `แนบสำเร็จ'));
assert.ok(app.includes('มีเอกสารชี้แจงผูกกับเคสแล้ว'));
console.log('Recommended evidence: exact case/run/date, access, status isolation, upload feedback passed');
