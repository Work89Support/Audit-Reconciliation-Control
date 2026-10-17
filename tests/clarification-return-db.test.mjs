import fs from 'node:fs';import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);const db=new PGlite();
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
await db.exec(`create schema auth;create role anon;create role authenticated;
create table auth.users(id uuid primary key);
create table app_profiles(user_id uuid,role text,active boolean,full_name text,email text);
create table user_company_access(user_id uuid,company text);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create function current_user_active() returns boolean language sql stable security definer as $$select coalesce((select active from app_profiles where user_id=auth.uid()),false)$$;
create function current_app_role() returns text language sql stable security definer as $$select role from app_profiles where user_id=auth.uid()$$;
create function has_company_access(c text) returns boolean language sql stable security definer as $$select exists(select 1 from user_company_access where user_id=auth.uid() and company=c)$$;
create table exceptions(id uuid primary key,company text,business_date date,run_id uuid,status text,updated_at timestamptz,
responded_at timestamptz,responded_by uuid,response_text text,requested_at timestamptz,requested_by uuid,document_due_at timestamptz,
manual_pair_id uuid,case_closure_request_id uuid,cross_day_request_id uuid,cross_day_image_request_id uuid,
superseded_by_exception_id uuid,customer_details jsonb,clarification_file_id uuid,account text,system_amount numeric,bank_amount numeric);
create table case_closure_requests(exception_id uuid,status text);create table cross_day_pair_requests(exception_id uuid,status text);create table cross_day_image_reviews(exception_id uuid,status text);
create table daily_recon_jobs(company text,business_date date,is_archived boolean);
create table audit_log(id uuid default gen_random_uuid(),at timestamptz default now(),actor text,actor_user_id uuid,company text,action text,entity text,target text,detail text,meta jsonb);
create table company_case_sla(company text,document_days int);
create table case_evidence(id uuid,exception_id uuid,storage_path text);
create function primary_case_is_current(p uuid) returns boolean language sql stable as $$select coalesce(customer_details->>'current','true')='true' from exceptions where id=p$$;
create function cross_day_current_manual_case(e exceptions) returns boolean language sql stable as $$select coalesce(e.customer_details->>'current','true')='true' and e.customer_details->>'manual_primary_id' is not null$$;
create function account_review_hold_for_case(p uuid) returns uuid language sql stable as $$select case when account='HOLD' then p else null end from exceptions where id=p$$;
create function case_has_stored_document(p uuid) returns boolean language sql stable as $$select exists(select 1 from case_evidence where exception_id=p)$$;
create function touch_updated_at() returns trigger language plpgsql as $$begin new.updated_at:=now();return new;end$$;
create trigger exceptions_touch before update on exceptions for each row execute function touch_updated_at();`);
const oldDeadline=fs.readFileSync('supabase/20261005_document_closure_workflow.sql','utf8').match(/create function public.set_document_case_deadline\(\)[\s\S]*?create trigger exceptions_document_deadline[^;]+;/)[0];
await db.exec(oldDeadline);
await db.exec(fs.readFileSync('supabase/20261013_clarification_instructions.sql','utf8'));
const migration=fs.readFileSync('supabase/20261017_return_clarification.sql','utf8');await db.exec(migration);await db.exec(migration);
const companies=['3XB','FR8','AT4','SK8','MR9','MC8','UR9','PS8','UFABET7M'];
for(const [n,role,active] of [[1,'monitor',true],[2,'audit_assistant',true],[3,'lead',true],[4,'admin',true],[5,'shift_lead',true],[6,'monitor',false],[7,'monitor',true]]){
 await db.query('insert into auth.users values($1)',[id(n)]);await db.query('insert into app_profiles values($1,$2,$3,$4,$4)',[id(n),role,active,'Actor'+n]);
 for(const c of (n===7?['PS8']:companies))await db.query('insert into user_company_access values($1,$2)',[id(n),c]);
}
const actor=async n=>{await db.exec('reset role');await db.query("select set_config('test.actor',$1,false)",[id(n)]);await db.exec('set role authenticated');};
await db.exec('grant select on exceptions,audit_log,case_evidence to authenticated');
const seed=async(n,c='FR8',manual=false,deadline='2026-10-31T04:00Z')=>{
 await db.exec('reset role');await db.query(`insert into exceptions(id,company,business_date,status,updated_at,responded_at,responded_by,response_text,requested_at,requested_by,document_due_at,customer_details,clarification_file_id,account,system_amount,bank_amount)
 values($1,$2,'2026-10-16','answered','2026-10-17T07:00Z','2026-10-17T06:00Z',$3,'คำตอบเดิมและประวัติเดิม','2026-10-16T04:00Z',$3,$6,$4,$5,'TEST',100,100)`,[id(n),c,id(5),JSON.stringify(manual?{manual_primary_id:id(99),current:true}:{}),id(90),deadline]);
 await db.query('insert into case_evidence values($1,$2,$3)',[id(n+2000),id(n),'original-proof']);
};
const reason='กรุณาแนบหลักฐานรายการธนาคารและระบุเวลาตามรายการให้ครบ';
const call=async(n,k=n+1000,text=reason)=> (await db.query('select return_case_for_clarification($1,$2,$3,$4,$5) r',[id(k),id(n),text,'2026-10-17T07:00Z','2026-10-17T06:00Z'])).rows[0].r;
for(const [i,c] of companies.entries())for(const manual of [false,true]){
 const n=100+i*2+Number(manual);await seed(n,c,manual);await actor(1+i%4);
 const before=(await db.query('select * from exceptions where id=$1',[id(n)])).rows[0];
 assert.equal((await call(n)).status,'clarifying');assert.equal((await call(n)).replayed,true);
 const after=(await db.query('select * from exceptions where id=$1',[id(n)])).rows[0];
 const strip=({status,updated_at,...rest})=>rest;assert.deepEqual(strip(after),strip(before),'only status and updated_at change');
 assert.equal((await db.query('select count(*) n from case_clarification_returns where exception_id=$1',[id(n)])).rows[0].n,1);
 assert.equal((await db.query("select count(*) n from audit_log where action='case_note' and target=$1",[id(n)])).rows[0].n,1);
 assert.equal((await db.query("select count(*) n from audit_log where action='clarification_returned' and target=$1",[id(n)])).rows[0].n,1);
 // Instruction RPC historically excludes assistant reads, but company responders must always see the reason.
 await actor(5);assert.equal((await db.query('select case_clarification_instructions($1) x',[id(n)])).rows[0].x.at(-1).text,reason);
}
await seed(300);for(const n of [5,6,7]){await actor(n);await assert.rejects(call(300),/สิทธิ์|บริษัท/);}
await actor(1);await assert.rejects(call(300,1300,'สั้น'),/10/);
await db.exec("reset role;update exceptions set status='closed' where id='"+id(300)+"'");await actor(1);await assert.rejects(call(300),/สถานะ/);
for(const [n,change,pattern] of [[301,"account='HOLD'",/พักตรวจ/],[302,"manual_pair_id='"+id(98)+"'",/คำขอ/],[303,`customer_details='{"current":false}'`,/ผลหลัก/],[304,"responded_at=now()",/คำชี้แจง/],[305,"case_closure_request_id='"+id(98)+"'",/คำขอ/]]){
 await seed(n);await db.exec('alter table exceptions disable trigger exceptions_touch;update exceptions set '+change+' where id=\''+id(n)+'\';alter table exceptions enable trigger exceptions_touch');await actor(1);await assert.rejects(call(n),pattern);
}
await seed(306);await db.query("insert into cross_day_pair_requests values($1,'pending')",[id(306)]);await actor(1);await assert.rejects(call(306),/คำขอ/);
// Null old SLA + proof: a return must retain null, not invent/reset a deadline.
await seed(307,'FR8',false,null);await actor(1);
// touch_updated_at changed the version above, so call with the current version explicitly.
let fresh=(await db.query('select * from exceptions where id=$1',[id(307)])).rows[0];
await db.query('select return_case_for_clarification($1,$2,$3,$4,$5)',[id(1307),id(307),reason,fresh.updated_at,fresh.responded_at]);
assert.equal((await db.query('select document_due_at from exceptions where id=$1',[id(307)])).rows[0].document_due_at,null);
await assert.rejects(db.query('insert into case_clarification_returns(id) values($1)',[id(999)]),/permission denied/);
await db.exec('reset role;set role anon');await assert.rejects(call(300),/permission denied/);
await db.exec('reset role');assert.equal((await db.query('select count(*) n from case_clarification_returns')).rows[0].n,19);
assert.equal((await db.query('select count(*) n from case_evidence')).rows[0].n,26);
await db.close();console.log('PASS return clarification: nine companies x manual/system; scoped Audit roles; immutable receipts; atomic instruction/status; original answers, evidence, financial values and SLA retained; retries/stale/holds/reservations/denials covered. Synthetic DB only.');

