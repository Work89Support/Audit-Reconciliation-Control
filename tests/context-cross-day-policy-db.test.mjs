import fs from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);const db=new PGlite();
// Reuse the existing preflight fixture schema; never connect this test to production.
const fixture=fs.readFileSync('tests/preflight-review-gate-db.test.mjs','utf8').match(/await db\.exec\(`([\s\S]*?)`\);/);
assert.ok(fixture);await db.exec(fixture[1]);
await db.exec("create function worker_primary_scope_protected(text,date) returns boolean language sql as $$select false$$;");
await db.exec(fs.readFileSync('supabase/20261019_preflight_review_gate.sql','utf8'));
const patch=fs.readFileSync('supabase/20261020_context_cross_day_intake_policy.sql','utf8');
await db.exec(patch);await db.exec(patch);
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
for(const [i,c] of companies.entries()){
 const job=id(i*100+1),batch=id(i*100+2),file=id(i*100+3),run=id(i*100+4),ex=id(i*100+5);
 await db.query("insert into daily_recon_jobs(id,company,business_date) values($1,$2,'2026-10-19')",[job,c]);
 await db.query("insert into mail_batches values($1,$2,'2026-10-19')",[batch,c]);
 await db.query("insert into source_files(id,batch_id,company,file_name,kind,created_at) values($1,$2,$3,$4,'bo_main','2026-10-20 01:00Z')",[file,batch,c,c+'_BO_D_2026-10-19.xlsx']);
 const context={company:c,business_date:'2026-10-18',ex_type:'cross_day',code:'DAY-CONTEXT',account:'A',system_amount:20,status:'open',customer_details:{source_rows:{bo:{fileId:file,row:53}}}};
 const report={file_ids:[file],bo_count:29,stm_count:20};
 const stage=async row=>(await db.query('select stage_daily_recon_preflight($1,$2,$3) s',[job,JSON.stringify(report),JSON.stringify([row])])).rows[0].s;
 const result=await stage(context);assert.equal(result.proceed,true,c);assert.equal(result.context_review_required,true);assert.equal(result.cross_day_count,1);
 assert.equal((await db.query('select status from daily_recon_jobs where id=$1',[job])).rows[0].status,'running');
 assert.equal((await db.query('select count(*)::int n from audit_run_preflight_drafts')).rows[0].n,0);
 await assert.rejects(stage({...context,company:'FOREIGN'}),/company mismatch/);
 await assert.rejects(stage({...context,business_date:null}),/Missing or invalid report row date/);
 await assert.rejects(stage({...context,business_date:'not-a-date'}),/Missing or invalid report row date/);
 const unverified=await stage({...context,customer_details:{source_rows:{bo:null,stm:null}}});
 assert.equal(unverified.proceed,false);assert.ok(unverified.warnings.some(w=>w.code==='cross_day_context_unverified'));
 await db.query('delete from audit_run_preflight_drafts where job_id=$1',[job]);
 await db.query("update daily_recon_jobs set status='running' where id=$1",[job]);
 // Auxiliary intake is evidence even with a misleading PM subject/kind. Preserve original kind.
 const aux=id(i*100+6);
 await db.query("insert into source_files(id,batch_id,company,file_name,kind,parse_error,created_at) values($1,$2,$3,$4,'manual_credit','old auxiliary parser error','2026-10-20 01:01Z')",[aux,batch,c,c+'_MANUAL_CREDIT_2026-10-19.xlsx']);
 const receipt=(await db.query('select kind,intake_original_kind from source_files where id=$1',[aux])).rows[0];
 assert.deepEqual(receipt,{kind:'doc_clarify',intake_original_kind:'manual_credit'});
 assert.equal((await stage(context)).proceed,true,'evidence errors do not hold reconciliation');
 await db.query("update source_files set parse_error='unreadable core' where id=$1",[file]);
 const held=await stage(context);assert.equal(held.proceed,false);assert.equal(held.case_writes,0);
 assert.equal(held.warnings.some(w=>w.code==='parse_error'),true);
 await db.query("update source_files set parse_error=null where id=$1",[file]);
 // Clear only disposable synthetic draft to isolate the persisted-report test.
 await db.query('delete from audit_run_preflight_drafts where job_id=$1',[job]);
 await db.query("update daily_recon_jobs set status='running' where id=$1",[job]);
 await db.query("insert into recon_runs values($1,$2,'2026-10-19',$3,'2026-10-20 02:00Z',$4)",[run,c,JSON.stringify({job_id:job}),[file]]);
 await db.query("update daily_recon_jobs set last_run_id=$1 where id=$2",[run,job]);
 await db.query("insert into exceptions values($1,'OLD-CONTEXT','2026-10-18',$2,$3,'A','ฝาก',20,'closed',$4,'23:52','cross_day',null)",[ex,c,run,JSON.stringify(context.customer_details)]);
 const before=(await db.query('select to_jsonb(e) v from exceptions e where id=$1',[ex])).rows[0].v;
 const p=async()=>(await db.query("select audit_run_preflight_review($1,'2026-10-19') p",[c])).rows[0].p;
 let view=await p();assert.equal(view.blocked,false);assert.equal(view.informational[0].code,'cross_day_scope');assert.equal(view.cross_day_queue[0].source_date,'2026-10-18');
 await db.query("insert into audit_run_holds values($1,'2026-10-19',true)",[c]);
 view=await p();assert.equal(view.blocked,true);assert.ok(view.warnings.some(w=>w.code==='source_held'));
 assert.deepEqual((await db.query('select to_jsonb(e) v from exceptions e where id=$1',[ex])).rows[0].v,before);
 await db.query('delete from audit_run_holds where company=$1',[c]);
 // An existing blocked draft is NOT auto-released by installation/new policy.
 await db.query("insert into audit_run_preflight_drafts(job_id,company,business_date,source_token,result,exceptions,warnings) values($1,$2,'2026-10-19','legacy',$3,$4,$5)",[job,c,JSON.stringify(report),JSON.stringify([context]),JSON.stringify([{code:'cross_day_scope',detail:'legacy review pending'}])]);
 assert.equal((await p()).blocked,true,'pending historical review remains under human control');
 await db.query('delete from audit_run_preflight_drafts where job_id=$1',[job]);
}
for(const [name,kind,expected] of [
 ['AT4_BO_W_2026-10-19.xlsx','unknown','bo_main'],['7M_PM_CP2_D.xlsx','unknown','pm_statement'],
 ['FR8_STM_SCB_DW.pdf','unknown','stm_pdf'],['7M_STM_TMN_DW.docx','unknown','stm_pdf'],
 ['AT4_MANUAL_PAYMENT_PM_AUTOPEER.xlsx','pm_statement','doc_clarify'],['SK8_MANUAL_BONUS.xlsx','unknown','doc_clarify'],
 ['FR8_COMMISSION_WITHDRAW.xlsx','comm_req','doc_clarify'],['FR8_CREDIT_OUT.xlsx','credit_out','doc_clarify'],
 ['unknown.xlsx','unknown','doc_clarify'],['FR8_EVIDENCE_BO_D.xlsx','bo_main','doc_clarify'],
 ['wrong-name.xlsx','pm_statement','pm_statement'],['document.pdf','unknown','doc_clarify'],
 ['FR8_PM_AUTOPEER_D.xlsx','manual_credit','doc_clarify']
])assert.equal((await db.query('select audit_intake_source_kind($1,$2) k',[name,kind])).rows[0].k,expected,name);
await db.exec("create or replace function worker_primary_scope_protected(text,date) returns boolean language sql as $$select true$$;");
const history=(await db.query('select stage_daily_recon_preflight($1,$2,$3) s',[id(801),JSON.stringify({file_ids:[id(803)]}),JSON.stringify([{company:'UR9',ex_type:'cross_day',business_date:'2026-10-18',customer_details:{source_rows:{bo:{fileId:id(803),row:53}}}}])])).rows[0].s;
assert.equal(history.proceed,false);assert.ok(history.warnings.some(w=>w.code==='historical_primary_protected'));
assert.equal((await db.query('select count(*)::int n from exceptions')).rows[0].n,9);
assert.equal((await db.query('select sum(system_amount)::int n from exceptions')).rows[0].n,180);
console.log('PASS context policy all 9: cross-day alone proceeds, real warnings/holds block, pending drafts preserved, no case writes; new auxiliary receipts are evidence with original kind retained');
await db.close();
