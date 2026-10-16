import fs from 'node:fs';import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);const db=new PGlite();
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`create schema auth;create role anon;create role authenticated;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create table profiles(id uuid,role text,active boolean,company text);
create function current_user_active() returns boolean language sql stable security definer as $$select coalesce((select active from profiles where id=auth.uid()),false)$$;
create function current_app_role() returns text language sql stable security definer as $$select role from profiles where id=auth.uid()$$;
create function has_company_access(c text) returns boolean language sql stable security definer as $$select exists(select 1 from profiles where id=auth.uid() and (role='admin' or company=c))$$;
create table exceptions(id uuid primary key,company text,business_date date,run_id uuid,account text,bo_time time,occurred_at time,status text,requested_at timestamptz,requested_by uuid,responded_at timestamptz,updated_at timestamptz,system_amount numeric,bank_amount numeric,detail text,document_due_at timestamptz,current_case boolean default true,reserved boolean default false,held boolean default false);
create table daily_recon_jobs(company text,business_date date,is_archived boolean default false);
create table audit_log(actor text,action text,entity text,target text,company text,detail text,meta jsonb);
create function primary_case_is_current(p uuid) returns boolean language sql stable as $$select current_case from exceptions where id=p$$;
create function can_attach_waiting_cross_day_evidence(p uuid) returns boolean language sql stable as $$select exists(select 1 from exceptions where id=p and status='pending_next_day' and current_case and not reserved and current_user_active() and has_company_access(company))$$;
create function account_review_hold_id(c text,d date,a text,t text) returns uuid language sql stable as $$select id from exceptions where company=c and business_date=d and account=a and held limit 1$$;
create function account_review_hold_for_case(p uuid) returns jsonb language sql stable as $$select case when held then jsonb_build_object('id',id) else null end from exceptions where id=p$$;
alter table exceptions enable row level security;
create policy case_read on exceptions for select to authenticated using(current_user_active() and has_company_access(company));
create policy case_write on exceptions for update to authenticated using(current_user_active() and has_company_access(company) and current_app_role() in ('admin','lead','monitor'));
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
grant select,update on exceptions,daily_recon_jobs to authenticated;grant insert,select on audit_log to authenticated;
insert into profiles values('${uuid(1)}','admin',true,null),('${uuid(2)}','monitor',true,'FR8'),('${uuid(3)}','shift_lead',true,'FR8'),('${uuid(4)}','admin',false,null);`);
await db.exec(`create table company_case_sla(company text,document_days integer);
create function case_has_stored_document(uuid) returns boolean language sql stable as $$select true$$;`);
const deadlines=fs.readFileSync('supabase/20261005_document_closure_workflow.sql','utf8');
await db.exec(deadlines.slice(deadlines.indexOf('create function public.set_document_case_deadline()'),deadlines.indexOf('create function public.case_has_stored_document(')));
const migration=fs.readFileSync('supabase/20261016_waiting_cross_day_clarification.sql','utf8');
await db.exec(migration);await db.exec(migration);
const companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
for(const [n,c] of companies.entries()){
 await db.query("insert into daily_recon_jobs(company,business_date) values($1,'2026-10-15')",[c]);
 await db.query("insert into exceptions(id,company,business_date,run_id,account,status,system_amount,bank_amount,detail) values($1,$2,'2026-10-15',$3,$2,'pending_next_day',100,null,'original Audit note')",[uuid(100+n),c,uuid(999)]);
}
const actor=async n=>{await db.exec('reset role');await db.query("select set_config('test.actor',$1,false)",[uuid(n)]);await db.exec('set role authenticated');};
const send=async id=>(await db.query('select request_waiting_cross_day_clarification($1) r',[id])).rows[0].r;
await actor(3);await assert.rejects(send(uuid(102)),/สิทธิ์/);
await actor(4);await assert.rejects(send(uuid(102)),/สิทธิ์/);
await actor(2);await assert.rejects(send(uuid(100)),/ไม่พบเคส/);
await actor(1);
for(const [n,c] of companies.entries()){
 const id=uuid(100+n),before=(await db.query('select * from exceptions where id=$1',[id])).rows[0];
 assert.equal((await db.query('select waiting_cross_day_clarification_ready($1) ready',[id])).rows[0].ready,true,c);
 const result=await send(id);assert.equal(result.status,'clarifying');assert.equal(result.replayed,false);
 const after=(await db.query('select * from exceptions where id=$1',[id])).rows[0];
 for(const key of Object.keys(before).filter(k=>!['status','requested_at','requested_by','updated_at','document_due_at'].includes(k)))assert.deepEqual(after[key],before[key],`${c} preserve ${key}`);
 assert.ok(after.document_due_at,'existing SLA trigger sets deadline even with attached document');
 const replay=await send(id);assert.equal(replay.replayed,true);assert.equal(replay.requested_at,result.requested_at);
 assert.deepEqual((await db.query('select document_due_at from exceptions where id=$1',[id])).rows[0].document_due_at,after.document_due_at,'replay preserves SLA');
}
assert.equal((await db.query('select count(*) n from audit_log')).rows[0].n,9);
await db.exec('reset role');
for(const [n,extra] of [[200,"current_case=false"],[201,"reserved=true"],[202,"held=true"],[203,"responded_at=now()"],[204,"requested_at=now()"],[205,"status='closed'"]]){
 await db.query("insert into exceptions(id,company,business_date,account,status) values($1,'FR8','2026-10-15',$2,'pending_next_day')",[uuid(n),String(n)]);
 await db.exec(`update exceptions set ${extra} where id='${uuid(n)}'`);
}
await actor(1);for(let n=200;n<=205;n++)await assert.rejects(send(uuid(n)),/ผลหลักเปลี่ยน|ไม่พร้อม/);
assert.equal((await db.query('select count(*) n from audit_log')).rows[0].n,9,'blocked requests add no history');
await db.exec('reset role;set role anon');await assert.rejects(send(uuid(102)),/permission denied/);
console.log('PASS synthetic DB: nine companies, current manual/system gate contract, RLS/roles, reserved/held/stale/answered guards, replay, no amount/source/history overwrite. No production requests.');
await db.close();
