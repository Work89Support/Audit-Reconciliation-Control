import fs from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);
const baseline=fs.readFileSync('tests/all-company-primary-handoff-db.test.mjs','utf8');
const setup=baseline.slice(baseline.indexOf('const db='),baseline.indexOf('const companies='));
const {db,id}=await new (Object.getPrototypeOf(async function(){}).constructor)('PGlite','fs',setup+';return {db,id};')(PGlite,fs);
await db.exec(`alter table exceptions add column superseded_by_exception_id uuid;
create schema storage;create table storage.objects(bucket_id text,name text);
create table source_files(id uuid,company text,kind text,storage_path text,is_archived boolean);
create function manual_primary_report_projection(j jsonb) returns jsonb language sql immutable as $$select j$$;
create table case_evidence(exception_id uuid);create table case_clarification_returns(exception_id uuid);
create table manual_pair_members(exception_id uuid);create table damages(exception_id uuid);
create table finance_action_events(exception_id uuid);create table account_review_hold_items(exception_id uuid);`);
const guard=fs.readFileSync('supabase/20261014_pending_cross_day_actions.sql','utf8');
await db.exec(guard.slice(guard.indexOf('create or replace function public.cross_day_current_manual_case'),guard.indexOf('revoke all on function public.cross_day_current_manual_case'))
 .replace('v.base_run_id=e.run_id','v.base_run_id is not distinct from e.run_id')
 .replace('j.last_run_id=v.base_run_id','j.last_run_id is not distinct from v.base_run_id')
 .replace('q.result=v.report','public.manual_primary_report_projection(q.result)=v.report'));
for(const file of ['20261019_manual_primary_reuse_cases.sql','20261105_manual_primary_exact_duplicate_candidate.sql','20261105_manual_primary_unworked_case_successor.sql']){
 const sql=fs.readFileSync('supabase/'+file,'utf8');await db.exec(sql);await db.exec(sql);
}
const company='FR8',date='2026-11-04',run=id(600),bo=id(601),request=id(602);
const files=[{id:bo,physical_source_file_id:bo,company,business_date:date,kind:'bo_main',checksum:'same-file'}];
await db.query('insert into test_manifest values($1,$2)',[company,JSON.stringify(files)]);
await db.query("insert into daily_recon_jobs(id,company,business_date,last_run_id,status) values($1,$2,$3,$4,'completed')",[id(603),company,date,run]);
await db.query('insert into recon_runs values($1,$2,$3,0,3,0,3)',[run,company,date]);
const source=row=>({bo:{fileId:bo,row},stm:null});
const entry=(row,old)=>({company,business_date:date,account:row===3?'BBL':'CYBERPLUS',direction:'ฝาก',ex_type:row===3?'missing_stm':'cross_day',system_amount:row===3?150:100,
 bank_amount:old?(row===3?150:null):(row===3?null:100),amount_diff:0,risk_amount:0,customer_details:{source_rows:source(row)}});
const report={quality:'passed',company,date,account:'ALL',direction:'all',bo_count:3,stm_count:0,matched:0,match_evidence:[],exceptions:[entry(1,false),entry(2,false),entry(3,false)],summary:{waiting_bo:[]}};
for(let row=1;row<=3;row++){
 const x=entry(row,true);
 await db.query("insert into exceptions(id,run_id,code,company,business_date,account,direction,status,ex_type,system_amount,bank_amount,customer_details) values($1,$2,$3,$4,$5,$6,'ฝาก','open',$7,$8,$9,$10)",
 [id(610+row),run,'EX-'+row,company,date,x.account,x.ex_type,x.system_amount,x.bank_amount,JSON.stringify(x.customer_details)]);
}
await db.query("insert into account_recheck_jobs values($1,$2,$3,'ALL','all','account','confirmed',1,$4,$5,$6,$7)",[request,company,date,run,JSON.stringify({effective_files:files}),[bo],JSON.stringify(report)]);
const p=(await db.query('select manual_primary_preview($1) p',[request])).rows[0].p;
assert.equal(p.allowed,true,JSON.stringify(p.problems));
const old=(await db.query("select jsonb_agg(to_jsonb(e) order by code) j from exceptions e where code like 'EX-%'")).rows[0].j;
const result=(await db.query("select accept_manual_primary_with_cases($1,$2,'Reviewed corrected BO-only cases with no prior actions',true) r",[request,p.token])).rows[0].r;
assert.equal(result.case_set.created,3);assert.equal(result.case_set.reused,0);
assert.equal((await db.query('select count(*)::int n from active_audit_exceptions')).rows[0].n,3);
assert.deepEqual((await db.query("select jsonb_agg(to_jsonb(e) order by code) j from exceptions e where code like 'EX-%'")).rows[0].j,old);
assert.equal((await db.query("select count(*)::int n from exceptions where customer_details ? 'replaces_unworked_case_id'")).rows[0].n,3);
for(let row=1;row<=3;row++)assert.equal((await db.query('select primary_case_is_current($1) yes',[id(610+row)])).rows[0].yes,false);
// A worked case must still fail atomically even if another row could migrate.
const blocked=structuredClone(report);blocked.exceptions.push({...entry(4,false),customer_details:{source_rows:source(4)}});blocked.bo_count=4;
const oldFour=entry(4,true);
await db.query("insert into exceptions(id,run_id,code,company,business_date,account,direction,status,ex_type,system_amount,bank_amount,customer_details) values($1,$2,'EX-4',$3,$4,'CYBERPLUS','ฝาก','open','cross_day',100,null,$5)",[id(614),run,company,date,JSON.stringify(oldFour.customer_details)]);
await db.query('insert into case_evidence values($1)',[id(614)]);
await db.query("insert into account_recheck_jobs values($1,$2,$3,'ALL','all','account','confirmed',1,$4,$5,$6,$7)",[id(604),company,date,run,JSON.stringify({effective_files:files}),[bo],JSON.stringify(blocked)]);
const p2=(await db.query('select manual_primary_preview($1) p',[id(604)])).rows[0].p;
assert.equal(p2.allowed,true);
await assert.rejects(db.query("select accept_manual_primary_with_cases($1,$2,'Reviewed corrected BO-only cases with no prior actions',true)",[id(604),p2.token]),/ยอดเปลี่ยน/);
assert.equal((await db.query('select count(*)::int n from manual_primary_results')).rows[0].n,1);
console.log('PASS unworked BO-only successor: corrected current cases, immutable history, evidence guard and atomic rollback');
await db.close();
