import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href),db=await PGlite.create();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function current_user_active() returns boolean language sql stable as $$select current_setting('test.active',true)='true'$$;
 create function current_app_role() returns text language sql stable as $$select current_setting('test.role',true)$$;
 create function has_company_access(c text) returns boolean language sql stable as $$select c='UFABET7M' and current_setting('test.access',true)='true'$$;
 create table exceptions(id uuid primary key,company text,business_date date,occurred_at time,run_id uuid,
 account text,direction text,currency text,ex_type text,status text,system_amount numeric,bank_amount numeric,
 bo_raw text,stm_raw text,customer_details jsonb,superseded_by_exception_id uuid,case_closure_request_id uuid,
 auto_closed boolean,approved_by uuid,approved_at timestamptz,resolved_by text,resolved_at timestamptz,
 resolution_note text,updated_at timestamptz,response_text text,clarification_file_id uuid);
 create table daily_recon_jobs(company text,business_date date,is_archived boolean,status text,last_run_id uuid);
 create table recon_runs(id uuid primary key,summary jsonb,file_ids uuid[]);
 create table source_files(id uuid,parsed boolean,parse_error text);
 create table storage.objects(name text,bucket_id text);
 create table case_evidence(id uuid primary key,exception_id uuid,storage_path text,size_bytes bigint);
 create table damages(exception_id uuid);
 create table audit_log(actor text,actor_user_id uuid,action text,entity text,target text,detail text);
 create function manual_pair_scoped_source_ready(p uuid,s text) returns boolean language sql stable as $$
 select exists(select 1 from exceptions e where e.id=p and e.customer_details->>'source_ready'='true'
  and e.run_id=nullif(current_setting('test.current_run',true),'')::uuid and s in ('BO','STM'))$$;
 create function manual_pair_source_ready(p uuid,s text) returns boolean language sql stable as $$select manual_pair_scoped_source_ready(p,upper(s))$$;
 insert into auth.users values('${id(1)}');
 select set_config('test.uid','${id(1)}',false),set_config('test.role','lead',false),set_config('test.active','true',false),set_config('test.access','true',false),set_config('test.current_run','${id(99)}',false);`);
// Use the real submission/locking/idempotency, trigger and closing functions.
for(const file of ['20261004_manual_case_pairing.sql','20261004_manual_amount_difference.sql','20261005_head_evidence_pair_review.sql'])await db.exec(fs.readFileSync('supabase/'+file,'utf8'));
// Only the pairing part of this historical migration is needed by this fixture.
const crossDay=fs.readFileSync('supabase/20261021_manual_run_cross_day_pairing.sql','utf8');
await db.exec('do $patch$ declare definition text;old_anchor text;new_anchor text;signature text; begin\n'+crossDay.slice(crossDay.indexOf(" signature:='public.submit_manual_case_pair"),crossDay.indexOf('end $patch$;'))+'end $patch$;');
for(const file of ['20261025_7m_internal_transfer_manual_pair.sql','20261025_7m_internal_transfer_same_account_pair.sql','20261025_7m_internal_transfer_clarifying_pair.sql'])await db.exec(fs.readFileSync('supabase/'+file,'utf8'));
async function fixture(){
 await db.query(`insert into exceptions(id,company,business_date,occurred_at,run_id,account,direction,currency,ex_type,status,system_amount,bank_amount,bo_raw,stm_raw,customer_details,response_text,clarification_file_id) values
 ($1,'UFABET7M','2099-01-01','06:59:00',$3,'BANK-NEW','ถอน','THB','missing_stm','open',4000,null,'2099-01-01 06:59 | โยกเงินเข้า | BANK-NEW | 4000 | note',null,$4,'เก็บคำชี้แจงเดิม',$5),
 ($2,'UFABET7M','2099-01-01','06:58:12',$3,'TMN-TEST','ถอน','THB','missing_bo','open',null,4000,null,'2099-01-01 เงินออก 4000',$6,'keep STM',$5)`,[id(10),id(11),id(99),{source_ready:true,source_rows:{bo:{fileId:id(50),row:1}}},id(51),{source_ready:true,source_rows:{stm:{fileId:id(52),row:2}}}]);
}
await fixture();
const snapshot=async()=>JSON.stringify((await db.query('select * from exceptions order by id')).rows);
const before=await snapshot(),migration=fs.readFileSync('supabase/20261106_7m_internal_cross_account_pair.sql','utf8');
await db.exec(migration);await db.exec(migration);assert.equal(await snapshot(),before,'migration must not mutate a case');
const proof=async()=> (await db.query('select validate_7m_internal_transfer_pair($1,$2) as p',[id(10),id(11)])).rows[0].p;
assert.equal((await proof()).method,'manual-seven-m-internal-transfer-cross-account-v2');
assert.equal(await snapshot(),before,'validation is read only');
for(const status of ['open','clarifying','answered'])for(const account of ['BANK-NEW','SCB-TEST','KB-TEST','AUTOPEER','UNREGISTERED-ACCOUNT'])for(const direction of ['ฝาก','ถอน']){
 await db.exec('begin');
 await db.query('update exceptions set status=$1',[status]);
 await db.query("update exceptions set account=$1,bo_raw=$2 where id=$3",[account,`2099-01-01 06:59 | ${direction==='ถอน'?'โยกเงินเข้า':'โยกเงินออก'} | note`,id(10)]);
 await db.query('update exceptions set direction=$1 where id=$2',[direction,id(11)]);
 assert.equal((await proof()).same_account,false);
 const args=[id(20),id(10),id(11),'internal','ทดสอบข้อมูลสมมติการโอนภายในบริษัท',null];
 const close=()=>db.query('select (close_internal_transfer_pair($1,$2,$3,$4,$5,$6)).*',args);
 assert.equal((await close()).rows[0].status,'approved');assert.equal((await close()).rows[0].status,'approved','same request retry idempotent');
 const rows=(await db.query('select * from exceptions order by id')).rows;
 assert.ok(rows.every(e=>e.status==='closed'));assert.equal(rows[0].system_amount,'4000');assert.equal(rows[1].bank_amount,'4000');assert.equal(rows[0].response_text,'เก็บคำชี้แจงเดิม');assert.equal(rows[0].clarification_file_id,id(51));
 assert.equal((await db.query("select count(*) n from audit_log where action='manual_7m_internal_transfer_close'")).rows[0].n,1);
 await db.exec('rollback');
}
for(const change of [
 "update exceptions set system_amount=4001 where ex_type='missing_stm'",
 "update exceptions set system_amount='NaN' where ex_type='missing_stm'",
 "update exceptions set company='FOREIGN' where ex_type='missing_stm'",
 "update exceptions set business_date='2099-01-02' where ex_type='missing_stm'",
 "update exceptions set currency='USDT' where ex_type='missing_stm'",
 "update exceptions set bo_raw='ordinary customer deposit' where ex_type='missing_stm'",
 "update exceptions set bo_raw='โยกเงินออก' where ex_type='missing_stm'",
 "update exceptions set occurred_at='07:03:13' where ex_type='missing_stm'",
 "update exceptions set occurred_at=null where ex_type='missing_stm'",
 "update exceptions set status='closed' where ex_type='missing_stm'",
 "update exceptions set superseded_by_exception_id='00000000-0000-4000-8000-000000000080' where ex_type='missing_stm'",
 "update exceptions set case_closure_request_id='00000000-0000-4000-8000-000000000080' where ex_type='missing_stm'",
 "update exceptions set customer_details='{}' where ex_type='missing_stm'",
 "select set_config('test.current_run','00000000-0000-4000-8000-000000000098',true)",
 "insert into damages values('00000000-0000-4000-8000-000000000010')",
]){
 await db.exec('begin');await db.exec(change);await assert.rejects(proof,undefined,change);await db.exec('rollback');
}
for(const role of ['monitor','audit_assistant','exec']){
 await db.exec('begin');await db.query("select set_config('test.role',$1,true)",[role]);
 await assert.rejects(()=>db.query("select close_internal_transfer_pair($1,$2,$3,'internal','ทดสอบสิทธิ์ข้อมูลสมมติ',null)",[id(20),id(10),id(11)]),/เฉพาะหัวหน้า/);await db.exec('rollback');
}
// Same-account adjustments retain their original movement semantics.
await db.exec('begin');await db.exec("update exceptions set account='TMN-TEST',bo_raw='2099-01-01 | โยกเงินออก | note โยกเงินเข้า BANK-NEW' where ex_type='missing_stm'");assert.equal((await proof()).same_account,true);await db.exec('rollback');
assert.equal(await snapshot(),before,'all synthetic closes were rolled back');
assert.equal((await db.query("select has_function_privilege('authenticated','validate_7m_internal_transfer_pair(uuid,uuid)','execute') allowed")).rows[0].allowed,false);
await db.close();console.log('PASS PostgreSQL: real migrations + submit/locks/trigger/direct-close/retry, all account types/directions/statuses, source/permission/amount/time/damage guards; migrations and rollback leave fixture cases unchanged.');
