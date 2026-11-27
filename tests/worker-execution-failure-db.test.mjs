import fs from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role;
create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$;
create table daily_recon_jobs(id uuid primary key,company text,business_date date,status text,is_archived boolean default false,claimed_by text,claimed_at timestamptz,attempt_count integer,last_run_id uuid,last_error text,rerun_requested_at timestamptz,updated_at timestamptz default now());
create table recon_runs(id uuid primary key,company text,business_date date,created_at timestamptz,summary jsonb);
create table exceptions(id uuid primary key,status text,amount numeric);
create table case_evidence(id uuid primary key,exception_id uuid,content text);
create table audit_log(id bigint generated always as identity,at timestamptz default now(),actor text,action text,entity text,target text,company text,detail text,meta jsonb);
create table recon_notifications(id bigint generated always as identity,dedupe_key text unique,level text,title text,detail text,business_date date,company text,job_id uuid);
insert into exceptions values('${id(90)}','closed',200);insert into case_evidence values('${id(91)}','${id(90)}','original proof');
insert into daily_recon_jobs values
('${id(1)}','PS8','2026-11-26','running',false,'n8n-cloud-worker:111',now()-interval '5 minutes',1,null,null,now(),now()),
('${id(2)}','AT4','2026-11-26','running',false,'n8n-cloud-worker:222',now()-interval '5 minutes',1,null,null,null,now()),
('${id(3)}','3XB','2026-11-26','completed',false,null,null,1,'${id(30)}',null,null,now()),
('${id(4)}','FR8','2026-11-26','running',true,'n8n-cloud-worker:333',now(),1,null,null,null,now()),
('${id(5)}','MR9','2026-11-26','running',false,'n8n-cloud-worker:444',now()-interval '5 minutes',1,'${id(31)}',null,null,now()),
('${id(6)}','SK8','2026-11-26','running',false,'n8n-cloud-worker:666',now(),3,null,null,null,now());
insert into recon_runs values('${id(50)}','MR9','2026-11-26',now(),'{"job_id":"${id(5)}"}');
select set_config('test.role','authenticated',false);`);
const patch=fs.readFileSync('supabase/20261127_worker_execution_failure_receipt.sql','utf8');
await db.exec(patch);await db.exec(patch);
const snapshot=async()=>JSON.stringify((await db.query('select (select jsonb_agg(e) from exceptions e) cases,(select jsonb_agg(e) from case_evidence e) evidence,(select jsonb_agg(r) from recon_runs r) runs')).rows);
const before=await snapshot();
const fail=(execution,workflow='hggaOLqKPXB5roGM')=>db.query('select fail_daily_recon_execution($1,$2,$3,$4) receipt',[execution,workflow,'Task request timed out','คืนชื่อไฟล์ต้นฉบับ']);
await assert.rejects(fail('111'),/Worker only/);
await db.exec("select set_config('test.role','service_role',false)");
assert.equal((await fail('111','another-workflow')).rows[0].receipt.status,'ignored_unrecognized_execution');
assert.equal((await fail('../111')).rows[0].receipt.status,'ignored_unrecognized_execution');
assert.equal((await fail('111')).rows[0].receipt.status,'queued');
let job=(await db.query('select * from daily_recon_jobs where id=$1',[id(1)])).rows[0];
assert.equal(job.claimed_by,null);assert.equal(job.claimed_at,null);assert.equal(job.rerun_requested_at,null);assert.match(job.last_error,/111/);
assert.equal((await db.query('select status from daily_recon_jobs where id=$1',[id(2)])).rows[0].status,'running','failure cannot release another active execution');
assert.equal((await fail('111')).rows[0].receipt.status,'ignored_not_current','network retry is idempotent');
assert.equal((await db.query('select count(*) n from audit_log')).rows[0].n,1);
await db.query("update daily_recon_jobs set status='running',claimed_by='n8n-cloud-worker:555',claimed_at=now() where id=$1",[id(1)]);
assert.equal((await fail('111')).rows[0].receipt.status,'ignored_not_current','delayed callback cannot clear a newer lease');
assert.equal((await fail('333')).rows[0].receipt.status,'ignored_not_current','archived jobs stay untouched');
const partial=(await fail('444')).rows[0].receipt;
assert.equal(partial.status,'needs_review');assert.equal(partial.partial_result,true);
assert.equal((await db.query('select last_run_id from daily_recon_jobs where id=$1',[id(5)])).rows[0].last_run_id,id(31),'accepted pointer is preserved');
assert.equal((await fail('666')).rows[0].receipt.status,'error','bounded retries never loop forever');
assert.equal((await fail('777')).rows[0].receipt.status,'ignored_not_current');
assert.equal((await db.query('select status from daily_recon_jobs where id=$1',[id(3)])).rows[0].status,'completed');
assert.equal(await snapshot(),before,'all runs, closed cases, amounts and evidence remain byte-for-byte unchanged');
assert.equal((await db.query("select has_function_privilege('authenticated','fail_daily_recon_execution(text,text,text,text)','EXECUTE') allowed")).rows[0].allowed,false);
assert.equal((await db.query("select has_function_privilege('service_role','fail_daily_recon_execution(text,text,text,text)','EXECUTE') allowed")).rows[0].allowed,true);
console.log('PASS execution-bound failure recovery: roles, stale lease, idempotence, partial-write gate, retry cap and retained financial history.');
await db.close();
