// Ephemeral PostgreSQL execution, synthetic fixtures only. Pass installed PGlite module path.
import fs from 'node:fs';import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);const db=await PGlite.create();
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const q=(sql,args=[])=>db.query(sql,args);const exec=sql=>db.exec(sql);
await exec(`create role anon;create role authenticated;create role service_role;
create schema auth;create schema storage;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('app.user',true),'')::uuid$$;
create function public.current_user_active() returns boolean language sql as $$select coalesce(current_setting('app.active',true),'true')='true'$$;
create function public.current_app_role() returns text language sql as $$select current_setting('app.role',true)$$;
create function public.has_company_access(c text) returns boolean language sql as $$select c=current_setting('app.company',true)$$;
create table public.exceptions(id uuid primary key,run_id uuid,company text,business_date date,occurred_at time,direction text,account text,currency text,system_amount numeric,bank_amount numeric,bo_raw text,stm_raw text,customer_details jsonb,lifecycle_key text,ex_type text,status text,superseded_by_exception_id uuid,previous_exception_id uuid,manual_pair_id uuid,case_closure_request_id uuid,cross_day_request_id uuid,auto_closed boolean,approved_by uuid,approved_at timestamptz,resolved_by text,resolved_at timestamptz,closure_rule text,resolution_note text,updated_at timestamptz);
create table public.daily_recon_jobs(id uuid primary key,company text,business_date date,last_run_id uuid,is_archived boolean default false);
create table public.source_files(id uuid primary key,company text,kind text,storage_path text,file_name text,is_archived boolean default false);
create table storage.objects(bucket_id text,name text,metadata jsonb);
create table public.audit_log(actor text,actor_user_id uuid,action text,entity text,target text,detail text);
create table public.cross_day_pair_requests(id uuid,exception_id uuid,status text,submitted_by uuid,decided_by uuid);
create function public.cross_day_request_no_delete() returns trigger language plpgsql as $$begin raise exception 'ห้ามลบ';end$$;
grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;
grant update,select on public.exceptions to authenticated;`);
const native=fs.readFileSync('supabase/20261008_cross_day_workbench.sql','utf8');
await exec(native.slice(native.indexOf('create function public.guard_cross_day_request()'),native.indexOf('-- Request history is append-only')));
await exec(fs.readFileSync('supabase/20261009_cross_day_image_review.sql','utf8'));
await q('insert into auth.users values ($1),($2)',[uid(1),uid(2)]);
await q('insert into source_files values ($1,\'TEST\',\'stm_pdf\',\'test.pdf\',\'TEST.pdf\',false)',[uid(10)]);
await exec(`insert into storage.objects values ('audit-files','test.pdf','{"eTag":"test-original-hash"}');`);
await q('insert into daily_recon_jobs values ($1,\'TEST\',\'2026-10-07\',$2,false)',[uid(20),uid(30)]);
const seed=async(id,run,amount=65,raw='original-bo',sourceRow=1)=>q(`insert into exceptions(id,run_id,company,business_date,occurred_at,direction,account,currency,system_amount,bank_amount,bo_raw,stm_raw,customer_details,lifecycle_key,ex_type,status) values($1,$2,'TEST','2026-10-07','23:01:00','ฝาก','TEST-SCB','THB',$3,0,$4,'unreadable stm',jsonb_build_object('source_rows',jsonb_build_object('bo',jsonb_build_object('fileId','bo-file','row',$5::int))),'identity-1','cross_day','open')`,[uid(id),uid(run),amount,raw,sourceRow]);
const actor=async(n,role,company='TEST')=>{await exec('reset role');await q("select set_config('app.user',$1,false),set_config('app.role',$2,false),set_config('app.company',$3,false)",[uid(n),role,company]);await exec('set role authenticated');};
const submit=(request,caseId)=>q('select (public.submit_cross_day_image_review($1,$2,$3,1,\'\')).*',[uid(request),uid(caseId),uid(10)]);
const decide=(request,action='approve')=>q('select (public.decide_cross_day_image_review($1,$2,\'checked original image\')).*',[uid(request),action]);
await seed(40,30);await seed(41,30,37,'bo-2',2);
await actor(1,'audit_assistant');assert.equal((await submit(50,40)).rows[0].status,'pending');
assert.equal((await submit(50,40)).rows[0].id,uid(50),'same UUID is idempotent');
await assert.rejects(submit(51,40),/ดำเนินการแล้ว/);
await assert.rejects(decide(50),/เฉพาะหัวหน้า/);
await assert.rejects(q('update exceptions set system_amount=999 where id=$1',[uid(40)]),/ต้นทางถูกจอง/);
await actor(1,'lead');await assert.rejects(decide(50),/อีกบัญชี/);
await actor(2,'lead','OTHER');await assert.rejects(decide(50),/อีกบัญชี/);assert.equal((await q('select * from cross_day_image_reviews')).rows.length,0,'RLS company isolation');
await actor(2,'lead');assert.equal((await decide(50)).rows[0].status,'approved');
assert.equal((await decide(50)).rows[0].status,'approved','decision retry reads original decision');
assert.equal((await q('select system_amount,status from exceptions where id=$1',[uid(40)])).rows[0].system_amount,'65');
await actor(1,'audit_assistant');await submit(52,41);await actor(2,'lead');await decide(52,'reject');
assert.equal((await q('select status from exceptions where id=$1',[uid(41)])).rows[0].status,'open');
await exec('reset role');await seed(42,31);await seed(43,31,66,'changed-bo',3);
await q('update daily_recon_jobs set last_run_id=$1 where id=$2',[uid(31),uid(20)]);
assert.equal((await q('select status from exceptions where id=$1',[uid(42)])).rows[0].status,'closed','identical accepted rerun preserves original decision');
assert.equal((await q('select status from exceptions where id=$1',[uid(43)])).rows[0].status,'open','changed BO is never carried as closed');
await seed(44,32);await exec(`update storage.objects set metadata='{"eTag":"changed-file"}';`);
await q('update daily_recon_jobs set last_run_id=$1 where id=$2',[uid(32),uid(20)]);
assert.equal((await q('select status from exceptions where id=$1',[uid(44)])).rows[0].status,'open','changed PDF blocks preservation');
await actor(1,'audit_assistant');await assert.rejects(submit(53,44),/cross_day_image_bo_reserved/);
await exec('reset role');await seed(45,32,99,'bo-3',4);await actor(1,'audit_assistant');await submit(54,45);
await exec('reset role');await exec(`update storage.objects set metadata='{"eTag":"another-file"}';`);await actor(2,'lead');
await assert.rejects(decide(54),/ไฟล์ต้นฉบับเปลี่ยน/);await decide(54,'reject');
await exec('reset role');assert.equal((await q("select has_function_privilege('anon','public.submit_cross_day_image_review(uuid,uuid,uuid,integer,text)','EXECUTE') allowed")).rows[0].allowed,false);
// New workflow preserves all guards, but permits lead/admin direct review.
await exec('reset role');
await exec(`alter table cross_day_pair_requests add primary key(id), alter status set default 'pending',
 add column company text,add column stm_file_id uuid,add column stm_row integer,add column reason text,
 add column snapshot jsonb,add column bo_key text,add column stm_key text,add column logical_key text,
 add column difference numeric,add column decided_at timestamptz,add column decision_note text,
 add check(decided_by is null or decided_by<>submitted_by);
create table source_file_ocr(source_file_id uuid);
create table cross_day_closure_evidence(exception_id uuid,evidence_run_id uuid,evidence_key text,stm_key text,bo_key text,evidence jsonb);
-- Stub only the pre-existing native parser validator; exercise actual submit,
-- decision, reservation trigger and direct-close transaction below.
create function validate_cross_day_row(c uuid,f uuid,r integer) returns jsonb language plpgsql as $$
declare proof jsonb; n integer;
begin
 n:=coalesce(nullif(current_setting('test.validation_calls',true),''),'0')::integer+1;
 perform set_config('test.validation_calls',n::text,true);
 if current_setting('test.fail_decision',true)='true' and n=2 then raise exception 'source rejected at decision';end if;
 select jsonb_build_object('bo',to_jsonb(e),'stm',jsonb_build_object('row',r),'bo_key',e.id::text,'stm_key',f::text||':'||r,'logical_key',f::text||':'||r,'difference',0) into proof from exceptions e where id=c;
 return proof;
end$$;`);
await exec(native.slice(native.indexOf('create function public.submit_cross_day_pair('),native.indexOf('create function public.decide_cross_day_pair(')));
await exec(native.slice(native.indexOf('create function public.decide_cross_day_pair('),native.indexOf('create function public.guard_cross_day_request()')));
await exec(fs.readFileSync('supabase/20261009_cross_day_bulk_head.sql','utf8'));
await seed(46,32,88,'head-direct-bo',6);await actor(1,'audit_assistant');
await assert.rejects(q('select public.close_cross_day_image_review($1,$2,$3,1,\'checked\')',[uid(56),uid(46),uid(10)]),/เฉพาะหัวหน้า/);
await actor(1,'lead');
const direct=()=>q('select (public.close_cross_day_image_review($1,$2,$3,1,\'checked\')).*',[uid(56),uid(46),uid(10)]);
assert.equal((await direct()).rows[0].status,'approved','lead closes own prepared pair atomically');
assert.equal((await direct()).rows[0].id,uid(56),'direct retry is same receipt');
await seedAsOwner();
async function seedAsOwner(){await exec('reset role');await seed(47,32,77,'helper-bo',7);await actor(1,'audit_assistant');await submit(57,47);await assert.rejects(decide(57),/เฉพาะหัวหน้า/);await actor(2,'lead');assert.equal((await decide(57)).rows[0].status,'approved','helper still requires head');}
await exec('reset role');assert.equal((await q("select has_function_privilege('anon','public.close_cross_day_image_review(uuid,uuid,uuid,integer,text)','EXECUTE') allowed")).rows[0].allowed,false);
await seed(48,32,66,'native-head-bo',8);await actor(1,'lead');
const nativeDirect=(request,caseId,row)=>q('select (public.close_cross_day_pair($1,$2,$3,$4,\'checked source rows\')).*',[uid(request),uid(caseId),uid(10),row]);
assert.equal((await nativeDirect(58,48,1)).rows[0].status,'approved');
assert.equal((await nativeDirect(58,48,1)).rows[0].id,uid(58),'native direct retry idempotent');
await exec('reset role');await seed(49,32,55,'native-rollback-bo',9);await actor(1,'lead');
await q("select set_config('test.validation_calls','0',false),set_config('test.fail_decision','true',false)");
await assert.rejects(nativeDirect(59,49,2),/source rejected/);
await exec('reset role');assert.equal((await q('select status from exceptions where id=$1',[uid(49)])).rows[0].status,'open','failed approval rolls back submission');
assert.equal((await q('select count(*)::int n from cross_day_pair_requests where id=$1',[uid(59)])).rows[0].n,0);
await db.close();console.log('PASS: ephemeral PostgreSQL migrations, roles/RLS, immutable amounts/sources, idempotence, head direct closure, helper separation and rerun guards. Synthetic schema; not a complete Supabase stack or multi-session concurrency test.');
