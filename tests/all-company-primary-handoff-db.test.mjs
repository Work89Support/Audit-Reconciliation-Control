import fs from 'node:fs';import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`create schema auth;create role anon;create role authenticated;
create function auth.uid() returns uuid language sql stable as $$select current_setting('test.actor')::uuid$$;
create table app_profiles(user_id uuid primary key,role text,active boolean);
create table user_company_access(user_id uuid,company text);
create function current_user_active() returns boolean language sql stable security definer as $$select exists(select 1 from app_profiles where user_id=auth.uid() and active)$$;
create function current_app_role() returns text language sql stable security definer as $$select role from app_profiles where user_id=auth.uid() and active$$;
create function has_company_access(c text) returns boolean language sql stable security definer as $$select current_app_role()='admin' or exists(select 1 from user_company_access where user_id=auth.uid() and company=c)$$;
create table recon_runs(id uuid primary key,company text,business_date date,stm_count integer,bo_count integer,matched integer,exception_count integer);
create table daily_recon_jobs(id uuid primary key,company text,business_date date,last_run_id uuid,status text,is_archived boolean default false);
alter table daily_recon_jobs add column error_count integer default 0;
create table account_recheck_jobs(id uuid primary key,company text,business_date date,account text,direction text,mode text,status text,revision integer,base_run_id uuid,snapshot jsonb,selected_file_ids uuid[],result jsonb);
create table exceptions(id uuid primary key,run_id uuid,code text,business_date date,occurred_at time,company text,bank text,account text,direction text,member_code text,ex_type text,type_name text,severity text,status text,track text,system_amount numeric,bank_amount numeric,amount_diff numeric,risk_amount numeric,currency text,time_diff_sec integer,employee text,shift text,cause text,detail text,bo_raw text,stm_raw text,bo_date date,bo_time time,stm_date date,stm_time time,customer_details jsonb,unique(run_id,code));
create table case_closure_requests(exception_id uuid);create table cross_day_pair_requests(exception_id uuid);create table cross_day_image_reviews(exception_id uuid);create table manual_case_pairs(bo_case_id uuid,stm_case_id uuid);
create table audit_log(actor text,action text,entity text,target text,company text,detail text,meta jsonb);
create table test_manifest(company text primary key,files jsonb);
create function effective_audit_source_files(text,date) returns jsonb language sql stable security definer as $$select files from test_manifest where company=$1$$;
grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;
grant select on app_profiles,user_company_access,exceptions,recon_runs,daily_recon_jobs,test_manifest,case_closure_requests,cross_day_pair_requests,cross_day_image_reviews,manual_case_pairs to authenticated;
insert into app_profiles values('${id(1)}','admin',true),('${id(2)}','lead',true),('${id(3)}','monitor',true),('${id(4)}','admin',false);
insert into user_company_access values('${id(2)}','3XB'),('${id(3)}','3XB');
select set_config('test.actor','${id(1)}',false);`);
for(const file of ['20261013_manual_primary_result.sql','20261016_manual_primary_review_annotations.sql','20261013_manual_primary_case_sets.sql','20261016_all_company_primary_case_handoff.sql'])await db.exec(fs.readFileSync('supabase/'+file,'utf8'));
// Applying definitions again must not backfill cases or require company-specific SQL.
await db.exec(fs.readFileSync('supabase/20261016_all_company_primary_case_handoff.sql','utf8'));
const companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
const scopes=[];
for(const [index,company] of companies.entries()){
 const n=100+index*20,run=id(n),request=id(n+1),bo=id(n+2),pm=id(n+3),old=id(n+4),date='2026-10-15';
 const files=[{id:bo,physical_source_file_id:bo,company,business_date:date,kind:'bo_main',checksum:'BO-v1'}, {id:pm,physical_source_file_id:pm,company,business_date:date,kind:'pm_statement',checksum:'PM-v1'}];
 const exception=(row,type)=>({company,business_date:date,account:'SCB-A',direction:'ฝาก',ex_type:type,severity:'medium',system_amount:100,bank_amount:null,amount_diff:0,risk_amount:100,bo_date:date,bo_time:'23:00:00',customer_details:{source_rows:{bo:{fileId:bo,row,date}}}});
 const report={quality:'passed',company,date,account:'ALL',direction:'all',bo_count:3,stm_count:0,matched:0,match_evidence:[],exceptions:[exception(1,'missing_stm'),exception(2,'cross_day')],summary:{waiting_bo:[{account:'SCB-A',direction:'deposit',systemAmount:50,bankAmount:null,amountDiff:0,riskAmount:50,boDate:date,boTime:'23:01:00',boSource:{fileId:bo,row:3,date}}]}};
 await db.query('insert into test_manifest values($1,$2)',[company,JSON.stringify(files)]);
 await db.query('insert into recon_runs values($1,$2,$3,0,3,0,2)',[run,company,date]);
 await db.query("insert into daily_recon_jobs(id,company,business_date,last_run_id,status,is_archived) values($1,$2,$3,$4,'completed',false)",[id(n+5),company,date,run]);
 await db.query("insert into account_recheck_jobs values($1,$2,$3,'ALL','all','account','confirmed',1,$4,$5,$6,$7)",[request,company,date,run,JSON.stringify({effective_files:files}),[bo,pm],JSON.stringify(report)]);
 await db.query("insert into exceptions(id,run_id,code,company,business_date,status,system_amount,customer_details) values($1,$2,'history',$3,$4,'closed',100,'{\"proof\":\"preserve\"}')",[old,run,company,date]);
 scopes.push({n,run,request,bo,pm,old,date,company,report,files});
}
const actor=async n=>{await db.exec('reset role');await db.query("select set_config('test.actor',$1,false)",[id(n)]);await db.exec('set role authenticated');};
const preview=async s=>(await db.query('select manual_primary_preview($1) p',[s.request])).rows[0].p;
const accept=async(s,p,reviewed=true)=>(await db.query("select accept_manual_primary_with_cases($1,$2,'Reviewed complete files and all source findings',$3) result",[s.request,p.token,reviewed])).rows[0].result;
const preserved=async()=>JSON.stringify((await db.query(`select (select jsonb_agg(to_jsonb(r) order by id) from recon_runs r) runs,(select jsonb_agg(to_jsonb(j) order by id) from daily_recon_jobs j) jobs,(select jsonb_agg(to_jsonb(e) order by id) from exceptions e where code='history') history,(select jsonb_agg(to_jsonb(f) order by company) from test_manifest f) files`)).rows);
await actor(3);await assert.rejects(accept(scopes[0],{token:'x'}),/หัวหน้า/);
await actor(4);await assert.rejects(accept(scopes[0],{token:'x'}),/หัวหน้า/);
await actor(2);await assert.rejects(accept(scopes[1],{token:'x'}),/สิทธิ์/);
await actor(1);const before=await preserved();
for(const scope of scopes){
 const p=await preview(scope);assert.equal(p.allowed,true,scope.company);
 await assert.rejects(accept(scope,p,false),/ทบทวน/);
 await assert.rejects(accept(scope,{token:'stale'}),/เปลี่ยน/);
 if(scope===scopes[0]){
  await db.query("select accept_manual_primary($1,$2,'Legacy report accepted without any cases',true)",[scope.request,p.token]);
  assert.equal((await db.query('select count(*) n from manual_primary_case_items')).rows[0].n,0);
  assert.equal((await db.query('select primary_case_is_current($1) yes',[scope.old])).rows[0].yes,false,'report-only legacy versions must not expose old cases as current');
 }
 const result=await accept(scope,p);assert.equal(result.cases_ready,true);assert.equal(result.case_set.created,3);
 assert.equal(result.case_set.case_count,3);
 const replay=await accept(scope,p);assert.equal(replay.case_set.created,0);assert.equal(replay.case_set.replayed,true);
 const rows=(await db.query('select e.* from manual_primary_case_items i join exceptions e on e.id=i.exception_id where i.primary_id=$1',[result.id])).rows;
 assert.equal(rows.length,3);assert.equal(new Set(rows.map(e=>e.id)).size,3);assert.equal(rows.filter(e=>e.status==='pending_next_day').length,1);assert.equal(rows.filter(e=>e.status==='open').length,2);
 assert.deepEqual(rows.filter(e=>e.ex_type!=='cross_day').map(e=>e.system_amount).sort(),['100','50']);
 assert.equal((await db.query('select primary_case_is_current($1) yes',[scope.old])).rows[0].yes,false);
 for(const e of rows)assert.equal((await db.query('select primary_case_is_current($1) yes',[e.id])).rows[0].yes,true);
 scope.primary=result.id;scope.newCases=rows;
}
assert.equal(await preserved(),before,'source amounts, runs, jobs and historical rows must be byte-for-byte unchanged');
// A fresh preview can pass but case materialization can still fail. Everything
// including acceptance and audit entries must roll back in that transaction.
const s=scopes[0],bad=structuredClone(s.report);bad.exceptions[0].account=null;
await db.exec('reset role');await db.query("insert into account_recheck_jobs values($1,$2,$3,'ALL','all','account','confirmed',1,$4,$5,$6,$7)",[id(900),s.company,s.date,s.run,JSON.stringify({effective_files:s.files}),[s.bo,s.pm],JSON.stringify(bad)]);
await actor(1);const badScope={...s,request:id(900)};const bp=await preview(badScope);assert.equal(bp.allowed,true);
await assert.rejects(accept(badScope,bp),/ขอบเขต/);
assert.equal((await db.query('select count(*) n from manual_primary_results where recheck_id=$1',[id(900)])).rows[0].n,0);
assert.equal((await db.query('select count(*) n from manual_primary_case_items')).rows[0].n,27);
// System -> manual -> newer system: use already-persisted system cases, never
// manufacture another set; an incomplete newer job stays blocked.
await db.exec('reset role');
for(const scope of scopes){
 const next=id(scope.n+10),systemCase=id(scope.n+11);
 await db.query('insert into recon_runs values($1,$2,$3,0,3,0,1)',[next,scope.company,scope.date]);
 await db.query("insert into exceptions(id,run_id,code,company,business_date,status,system_amount,customer_details) values($1,$2,'new-system',$3,$4,'open',100,'{}')",[systemCase,next,scope.company,scope.date]);
 await db.query("update daily_recon_jobs set last_run_id=$1,status='running' where company=$2",[next,scope.company]);
 assert.equal((await db.query('select primary_case_is_current($1) yes',[systemCase])).rows[0].yes,false);
 assert.equal((await db.query('select read_manual_primary($1,$2) p',[scope.company,scope.date])).rows[0].p.stale,true);
 await db.query("update daily_recon_jobs set status='completed',error_count=1 where company=$1",[scope.company]);
 assert.equal((await db.query('select primary_case_is_current($1) yes',[systemCase])).rows[0].yes,false);
 assert.equal((await db.query('select read_manual_primary($1,$2) p',[scope.company,scope.date])).rows[0].p.stale,true);
 await db.query("update daily_recon_jobs set status='completed',error_count=0 where company=$1",[scope.company]);
 assert.equal((await db.query('select read_manual_primary($1,$2) p',[scope.company,scope.date])).rows[0].p,null);
 assert.equal((await db.query('select primary_case_is_current($1) yes',[systemCase])).rows[0].yes,true);
 assert.equal((await db.query('select primary_case_is_current($1) yes',[scope.newCases[0].id])).rows[0].yes,false);
}
assert.equal((await db.query('select count(*) n from manual_primary_case_items')).rows[0].n,27,'switching to system must not create cases');
// The collection loader must have exactly the scalar guard's semantics without
// invoking it per historical row. Exercise manual, newer-system, blocked and
// no-manual scopes under real RLS roles, including inactive and out-of-scope.
await db.exec('reset role');
for(const scope of scopes.slice(0,3))await db.query("update daily_recon_jobs set last_run_id=$1,status='queued',error_count=0 where company=$2",[scope.run,scope.company]);
await db.query("update daily_recon_jobs set status='running' where company=$1",[scopes[3].company]);
await db.query("update daily_recon_jobs set error_count=1 where company=$1",[scopes[4].company]);
await db.query("insert into recon_runs values($1,'3XB','2026-10-16',1,1,0,1)",[id(980)]);
await db.query("insert into daily_recon_jobs values($1,'3XB','2026-10-16',$2,'needs_review',false,0)",[id(981),id(980)]);
await db.query("insert into daily_recon_jobs values($1,'AT4','2026-10-16',null,'waiting_files',false,0)",[id(983)]);
await db.query("insert into exceptions(id,run_id,code,company,business_date,status,system_amount,customer_details) values($1,$2,'no-manual','3XB','2026-10-16','open',100,'{}')",[id(982),id(980)]);
await db.exec(`alter table exceptions add column superseded_by_exception_id uuid;
 alter table exceptions enable row level security;
 create policy case_read on exceptions for select to authenticated using(current_user_active() and has_company_access(company));
 alter table daily_recon_jobs enable row level security;
 create policy job_read on daily_recon_jobs for select to authenticated using(current_user_active() and has_company_access(company));
 alter table recon_runs enable row level security;
 create policy run_read on recon_runs for select to authenticated using(current_user_active() and has_company_access(company));
 create function audit_daily_checklist(p_from date,p_to date,p_company text default null,p_limit integer default 5000)
 returns table(company text,exception_count integer,resolved_count integer,open_count integer) language sql stable security invoker as $fn$
 select j.company,e.* from public.daily_recon_jobs j cross join lateral(
 select count(*)::integer exception_count,count(*) filter(where status='closed')::integer resolved_count,
 count(*) filter(where status<>'closed')::integer open_count from public.exceptions
 where run_id=j.last_run_id and company=j.company and business_date=j.business_date
 ) e where j.business_date between p_from and p_to and not j.is_archived
 and (p_company is null or j.company=p_company) order by j.company limit p_limit $fn$;
 grant execute on function audit_daily_checklist(date,date,text,integer) to authenticated;`);
const loaderBefore=JSON.stringify((await db.query('select (select jsonb_agg(e order by id) from exceptions e) cases,(select jsonb_agg(v order by id) from manual_primary_results v) reports,(select jsonb_agg(i order by primary_id,row_kind,row_index) from manual_primary_case_items i) items')).rows);
const loaderMigration=fs.readFileSync('supabase/20261016_set_based_current_case_loader.sql','utf8');
await db.exec(loaderMigration);await db.exec(loaderMigration);
for(const n of [1,2,3,4]){
 await actor(n);
 const expected=(await db.query('select id from exceptions where primary_case_is_current(id) order by id')).rows;
 const actual=(await db.query('select id from active_audit_exceptions order by id')).rows;
 assert.deepEqual(actual,expected,'set-based loader matches authoritative guard for role '+n);
 assert.equal(new Set(actual.map(r=>r.id)).size,actual.length,'UNION branches cannot duplicate a case');
 const checklist=(await db.query("select * from audit_daily_checklist('2026-10-15','2026-10-16',null,5000)")).rows;
 const summed=checklist.reduce((sum,r)=>sum+r.exception_count,0);
 const current=(await db.query('select count(*)::integer n from active_audit_exceptions e join daily_recon_jobs j on e.run_id=j.last_run_id and e.company=j.company and e.business_date=j.business_date')).rows[0].n;
 assert.equal(summed,current,'checklist and collection select exactly the same authorized current cases');
 if(n===1)await assert.rejects(db.query('select * from audit_current_case_rows(array[]::uuid[])'),/Invalid current-run scope/);
 if(n===4){assert.equal(actual.length,0,'inactive account remains denied');await assert.rejects(db.query('select * from audit_current_case_rows($1)',[[scopes[0].run]]),/Active authenticated/);continue;}
 const rpc=(await db.query('select id from audit_current_case_rows(array(select last_run_id from daily_recon_jobs where last_run_id is not null)) order by id')).rows;
 const expectedRpc=(await db.query('select e.id from active_audit_exceptions e join daily_recon_jobs j on e.run_id=j.last_run_id and e.company=j.company and e.business_date=j.business_date where e.superseded_by_exception_id is null order by e.id')).rows;
 assert.deepEqual(rpc,expectedRpc,'bounded-run loader has identical authorized current-case membership');
 const paged=[];for(let offset=0;offset<rpc.length;offset+=2)paged.push(...(await db.query('select id from audit_current_cases(array(select last_run_id from daily_recon_jobs where last_run_id is not null),2,$1)',[offset])).rows);
 assert.equal(new Set(paged.map(r=>r.id)).size,rpc.length,'stable pages neither duplicate nor drop a case');
 if(n===2||n===3)assert.equal((await db.query("select count(*)::integer n from active_audit_exceptions where company<>'3XB'")).rows[0].n,0,'scoped role cannot read another company');
 if(n===4)assert.equal(actual.length,0,'inactive account remains denied');
}
await db.exec('reset role');
assert.equal(JSON.stringify((await db.query('select (select jsonb_agg(e order by id) from exceptions e) cases,(select jsonb_agg(v order by id) from manual_primary_results v) reports,(select jsonb_agg(i order by primary_id,row_kind,row_index) from manual_primary_case_items i) items')).rows),loaderBefore,'loader migration never modifies cases, reports, or case history');
await db.exec('set role anon');await assert.rejects(db.query('select * from active_audit_exceptions'),/permission denied/);await assert.rejects(db.query('select * from audit_current_cases(array[]::uuid[],1000,0)'),/permission denied/);await db.exec('reset role');
console.log('PASS set-based loader: scalar parity, disjoint branches, 9-company mixed sources, checklist parity, RLS roles, inactive/anonymous denial, idempotent migration, immutable data.');
console.log('PASS all 9 companies: atomic accept+cases, replay, equal amounts, waiting/cross-day, roles, rollback, immutable history, and manual-to-system handoff. Synthetic database only.');
await db.close();
