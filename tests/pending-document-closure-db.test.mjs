import fs from 'node:fs';import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`create schema auth;create schema storage;create role anon;create role authenticated;
create table auth.users(id uuid primary key);create table audit_companies(code text primary key);
create table app_profiles(id uuid,role text,active boolean);create table user_company_access(id uuid,company text);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create function current_user_active() returns boolean language sql stable security definer as $$select coalesce((select active from app_profiles where id=auth.uid()),false)$$;
create function current_app_role() returns text language sql stable security definer as $$select role from app_profiles where id=auth.uid()$$;
create function current_audit_assistant() returns boolean language sql stable as $$select current_app_role()='audit_assistant'$$;
create function has_company_access(c text) returns boolean language sql stable security definer as $$select exists(select 1 from user_company_access where id=auth.uid() and company=c)$$;
create table exceptions(id uuid primary key,run_id uuid,code text,company text,business_date date,occurred_at time,bo_time time,ex_type text,status text,
 account text,direction text,currency text,system_amount numeric,bank_amount numeric,amount_diff numeric,risk_amount numeric,
 employee text,shift text,bo_raw text,stm_raw text,customer_details jsonb,manual_pair_id uuid,superseded_by_exception_id uuid,
 clarification_file_id uuid,requested_at timestamptz,responded_at timestamptz,updated_at timestamptz,
 approved_by uuid,approved_at timestamptz,resolved_by text,resolved_at timestamptz,resolution_note text,auto_closed boolean);
create table source_files(id uuid primary key,kind text,company text,storage_path text,size_bytes bigint);
create table case_evidence(id uuid primary key,exception_id uuid,storage_path text,size_bytes bigint,uploaded_by uuid);
create table storage.objects(bucket_id text,name text,owner_id text);
create table audit_log(actor text,actor_user_id uuid,action text,entity text,target text,detail text);
create table damages(exception_id uuid,code text,business_date date,company text,employee text,shift text,occurred_at time,amount numeric,currency text,fx_rate numeric,amount_thb numeric,cause text,cycle text,has_evidence boolean,hr_status text,finance_status text);
create table manual_case_pairs(id uuid,status text,bo_case_id uuid,stm_case_id uuid,bo_company text,stm_company text,submitted_by uuid);
create table cross_day_pair_requests(exception_id uuid,status text);create table cross_day_image_reviews(exception_id uuid,status text);
create table daily_recon_jobs(company text,business_date date,last_run_id uuid,is_archived boolean);
create function primary_case_is_current(p uuid) returns boolean language sql stable as $$select exists(select 1 from exceptions where id=p and coalesce(customer_details->>'current','true')='true')$$;
create function cross_day_current_manual_case(e exceptions) returns boolean language sql stable as $$select coalesce(e.customer_details->>'current','false')='true' and e.customer_details->>'manual_primary_id' is not null and (e.customer_details#>>'{source_rows,bo,row}')::integer>0$$;
create function account_review_hold_id(text,date,text,text) returns uuid language sql stable as $$select case when $3='HOLD' then '${id(99)}'::uuid else null end$$;`);
for(const [n,role,active] of [[1,'lead',true],[2,'admin',true],[3,'monitor',true],[4,'audit_assistant',true],[5,'shift_lead',true],[6,'lead',false],[7,'lead',true]]){
 await db.query('insert into auth.users values($1)',[id(n)]);await db.query('insert into app_profiles values($1,$2,$3)',[id(n),role,active]);
}
const companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
for(const c of companies){await db.query('insert into audit_companies values($1)',[c]);for(const n of [1,2,3,4,5,6])await db.query('insert into user_company_access values($1,$2)',[id(n),c]);}
await db.query("insert into user_company_access values($1,'PS8')",[id(7)]);
let base=fs.readFileSync('supabase/20261005_document_closure_workflow.sql','utf8').replace('if q.requested_by=auth.uid() and (','if (q.requested_by=auth.uid() or public.current_audit_assistant()) and (');
await db.exec(base);await db.exec(fs.readFileSync('supabase/20261006_direct_document_close_and_pending_proof.sql','utf8'));
const migration=fs.readFileSync('supabase/20261017_pending_cross_day_document_review.sql','utf8');await db.exec(migration);await db.exec(migration);
const actor=async n=>{await db.exec('reset role');await db.query("select set_config('test.actor',$1,false)",[id(n)]);await db.exec('set role authenticated');};
const preview=async k=>(await db.query('select pending_document_closure_preview($1) p',[id(k)])).rows[0].p;
const close=async(k,outcome='no_loss',amount=0,reason='ตรวจเอกสารและแถวต้นทางครบ ยืนยันผลยอดว่าไม่มีความเสียหาย')=>(await db.query('select to_jsonb(close_document_case($1,$2,$3,$4,$5,null)) q',[id(k+1000),id(k),outcome,amount,reason])).rows[0].q;
const seed=async(k,c='FR8',extra={})=>{
 await db.exec('reset role');await db.query("insert into exceptions(id,code,company,business_date,occurred_at,bo_time,ex_type,status,account,direction,currency,system_amount,bank_amount,amount_diff,customer_details) values($1,$2,$3,'2026-10-16','23:55','23:55','cross_day','pending_next_day','TEST','ถอน','THB',100,null,0,$4)",[id(k),'CASE-'+k,c,JSON.stringify({manual_primary_id:id(800),current:true,source_rows:{bo:{row:k,fileId:id(801)}},...extra})]);
 await db.query('insert into case_evidence values($1,$2,$3,10,$4)',[id(k+2000),id(k),'proof-'+k,id(1)]);await db.query("insert into storage.objects values('audit-files',$1,$2)",['proof-'+k,id(1)]);
};
for(const [i,c] of companies.entries())await seed(100+i,c);
await actor(1);
for(let k=100;k<109;k++){
 assert.equal((await preview(k)).allowed,true);const q=await close(k);assert.equal(q.status,'approved');assert.equal(q.review_origin,'head_direct');
 assert.equal((await close(k)).id,q.id,'retry uses one original request');
}
await db.exec('reset role');const results=(await db.query('select status,system_amount,bank_amount,amount_diff from exceptions order by id')).rows;
assert.equal(results.filter(e=>e.status==='closed').length,9);for(const e of results){assert.equal(Number(e.system_amount),100);assert.equal(e.bank_amount,null);assert.equal(Number(e.amount_diff),0);}
assert.equal((await db.query('select count(*) n from case_closure_requests')).rows[0].n,9);assert.equal((await db.query("select count(*) n from case_closure_requests where status='pending'")).rows[0].n,0);assert.equal((await db.query('select count(*) n from damages')).rows[0].n,0);
await seed(300);for(const n of [3,4,5,6,7]){await actor(n);await assert.rejects(preview(300),/หัวหน้า|สิทธิ์/);await assert.rejects(close(300),/หัวหน้า|สิทธิ์|Audit/);}
await actor(2);await assert.rejects(close(300,'damage',100),/ความเสียหาย|ทางนี้/);await assert.rejects(close(300,'no_loss',0,'สั้น'),/เหตุผล|ถูกต้อง/);
await actor(1);assert.equal((await preview(300)).allowed,true);await db.exec("reset role;delete from storage.objects where name='proof-300'");await actor(1);assert.equal((await preview(300)).allowed,false);await assert.rejects(close(300),/หลักฐาน/,'proof removed after preflight must fail at commit');
await seed(301,'FR8',{current:false});await actor(1);assert.equal((await preview(301)).allowed,false);await assert.rejects(close(301),/ผลหลัก|ต้นทาง/);
await seed(302);await db.exec("update exceptions set account='HOLD' where code='CASE-302'");await actor(1);await assert.rejects(close(302),/พักตรวจ/);
await seed(303);await db.query('update exceptions set manual_pair_id=$1 where id=$2',[id(900),id(303)]);await actor(1);await assert.rejects(close(303),/คำขอ/);
await seed(304);await db.query("insert into cross_day_pair_requests values($1,'pending')",[id(304)]);await actor(1);await assert.rejects(close(304),/คำขอ/);
await seed(305);await db.exec("update exceptions set customer_details='{}',run_id='00000000-0000-4000-8000-000000000850' where code='CASE-305';insert into daily_recon_jobs values('FR8','2026-10-16','00000000-0000-4000-8000-000000000850',false)");await actor(1);assert.equal((await preview(305)).allowed,true);assert.equal((await close(305)).status,'approved','system cases retain the same head review path');
await db.exec('reset role;set role anon');await assert.rejects(preview(300),/permission denied/);
await db.exec('reset role');assert.equal((await db.query('select count(*) n from case_closure_requests')).rows[0].n,10,'all denied calls roll back without requests');
await db.close();console.log('PASS pending document close: all nine manual scopes + system, atomic head-only review, no-loss only, real object required, source/current/hold/reservation guards, duplicate retry, unchanged amounts and no loss records. Synthetic DB only.');
