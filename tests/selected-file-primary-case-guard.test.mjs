import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const root=process.env.AUDIT_TEST_ROOT||fileURLToPath(new URL('../',import.meta.url));
const db=new PGlite();
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
await db.exec(`create schema auth;create schema storage;
create role anon;create role authenticated;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function current_user_active() returns boolean language sql as $$select coalesce(current_setting('test.active',true),'true')='true'$$;
create function current_app_role() returns text language sql as $$select current_setting('test.role',true)$$;
create function has_company_access(c text) returns boolean language sql as $$select c<>'NO_ACCESS'$$;
create table exceptions(id uuid primary key,status text,manual_pair_id uuid,case_closure_request_id uuid,superseded_by_exception_id uuid,company text,business_date date,run_id uuid,clarification_file_id uuid,customer_details jsonb);
create table source_files(id uuid primary key,storage_path text,company text,batch_id uuid,is_archived boolean default false);
create table mail_batches(id uuid primary key,company text);
create table daily_recon_jobs(id uuid primary key,last_run_id uuid,company text,business_date date,is_archived boolean default false,status text,error_count int default 0);
create table recon_runs(id uuid primary key,company text,business_date date);
create table manual_primary_results(id uuid primary key,company text,business_date date,base_run_id uuid,accepted_at timestamptz);
create table manual_primary_case_items(primary_id uuid,exception_id uuid);
create table storage.objects(bucket_id text,name text);
create table audit_log(actor text,actor_user_id uuid,action text,entity text,target text,detail text,meta jsonb);
create function can_attach_waiting_cross_day_evidence(p uuid) returns boolean language sql as $$select exists(select 1 from exceptions where id=p and status='pending_next_day' and primary_case_is_current(id))$$;
` .replace(/create function can_attach_waiting[\s\S]*$/,''));
const handoff=await fs.readFile(root+'/supabase/20261016_all_company_primary_case_handoff.sql','utf8');
await db.exec(handoff.slice(handoff.indexOf('create or replace function public.primary_case_is_current'),handoff.indexOf('revoke all on function public.read_manual_primary')));
await db.exec(`create function can_attach_waiting_cross_day_evidence(p uuid) returns boolean language sql as $$select exists(select 1 from exceptions where id=p and status='pending_next_day' and primary_case_is_current(id))$$;`);
let baseline=await fs.readFile(root+'/supabase/20261009_head_selected_case_file.sql','utf8');
baseline=baseline.replace('f.is_archived',"coalesce((to_jsonb(f)->>'is_archived')::boolean,false)")
 .replace("e.status not in ('open','clarifying','answered')","(e.status not in ('open','clarifying','answered') and not public.can_attach_waiting_cross_day_evidence(e.id))");
await db.exec(baseline);
await db.exec(`set test.role='lead';set test.active='true';set test.uid='${id(1)}';
insert into mail_batches values('${id(2)}','FR8');
insert into source_files(id,storage_path,company,batch_id) values('${id(3)}','synthetic.docx','FR8','${id(2)}');
insert into storage.objects values('audit-files','synthetic.docx');`);
const companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
for(let n=0;n<9;n++){
 const c=companies[n],k=100+n*10;
 await db.query(`insert into daily_recon_jobs(id,last_run_id,company,business_date,status) values($1,null,$2,'2026-10-16','error');`,[id(k),c]);
 await db.query(`insert into manual_primary_results values($1,$2,'2026-10-16',null,'2026-10-17');`,[id(k+1),c]);
 await db.query(`insert into exceptions(id,status,company,business_date) values($1,'open',$2,'2026-10-16'),($3,'pending_next_day',$2,'2026-10-16');`,[id(k+2),c,id(k+3)]);
 await db.query(`insert into manual_primary_case_items values($1,$2),($1,$3);`,[id(k+1),id(k+2),id(k+3)]);
}
const call=e=>db.query('select link_selected_case_file($1,$2,$3) result',[id(e),id(3),'ตรวจหลักฐานจำลองก่อนผูกไฟล์']);
await assert.rejects(()=>call(122),/ผลรอบปัจจุบัน/);
const patch=await fs.readFile(new URL('../supabase/20261017_selected_file_primary_case_guard.sql',import.meta.url),'utf8');
await db.exec(patch);await db.exec(patch);
for(let n=0;n<9;n++)for(const off of [2,3]){
 const e=100+n*10+off,status=off===2?'open':'pending_next_day';
 assert.equal((await call(e)).rows[0].result.status,status);await call(e);
}
assert.equal((await db.query('select count(*)::int n from audit_log')).rows[0].n,18);
// Reject historic, wrong-role, inactive, out-of-scope, closed and replaced cases.
await db.exec("set test.role='monitor'");await assert.rejects(()=>call(122),/เฉพาะหัวหน้า/);
await db.exec("set test.role='lead';set test.active='false'");await assert.rejects(()=>call(122),/เฉพาะหัวหน้า/);
await db.exec("set test.active='true';set test.uid=''");await assert.rejects(()=>call(122),/เฉพาะหัวหน้า/);
await db.exec(`set test.uid='${id(1)}';update exceptions set company='NO_ACCESS' where id='${id(122)}'`);await assert.rejects(()=>call(122),/ไม่มีสิทธิ์บริษัทของเคส/);
await db.exec(`update exceptions set company='FR8',status='closed' where id='${id(122)}'`);await assert.rejects(()=>call(122),/เคสปิดแล้ว/);
await db.exec(`update exceptions set status='open',superseded_by_exception_id='${id(123)}' where id='${id(122)}'`);await assert.rejects(()=>call(122),/เคสปิดแล้ว/);
await db.exec(`update exceptions set superseded_by_exception_id=null where id='${id(122)}';insert into manual_primary_results values('${id(999)}','FR8','2026-10-16',null,'2026-10-18')`);await assert.rejects(()=>call(122),/ผลรอบปัจจุบัน/);
await db.exec(`delete from manual_primary_results where id='${id(999)}';update source_files set is_archived=true`);await assert.rejects(()=>call(122),/ไม่พบไฟล์ที่พร้อมเปิดตรวจ/);
await db.exec(`update source_files set is_archived=false;delete from storage.objects`);await assert.rejects(()=>call(122),/ไฟล์ต้นฉบับ/);
await db.exec(`insert into storage.objects values('audit-files','synthetic.docx');update source_files set company='NO_ACCESS'`);await assert.rejects(()=>call(122),/เจ้าของไฟล์/);
await db.exec(`update source_files set company='FR8';update exceptions set clarification_file_id='${id(444)}' where id='${id(122)}'`);await assert.rejects(()=>call(122),/ไม่เขียนทับหลักฐาน/);
// A newer accepted system run takes over; stale manual cases stay immutable.
await db.exec(`insert into recon_runs values('${id(777)}','FR8','2026-10-16');update daily_recon_jobs set last_run_id='${id(777)}',status='completed' where company='FR8';update exceptions set clarification_file_id=null where id='${id(122)}'`);await assert.rejects(()=>call(122),/ผลรอบปัจจุบัน/);
await db.exec(`insert into exceptions(id,status,company,business_date,run_id) values('${id(778)}','open','FR8','2026-10-16','${id(777)}')`);assert.equal((await call(778)).rows[0].result.status,'open');
// System-only scopes must still match last_run_id, even if the general helper permits history.
await db.exec(`insert into daily_recon_jobs(id,last_run_id,company,business_date,status) values('${id(800)}','${id(801)}','FR8','2026-10-17','completed');insert into exceptions(id,status,company,business_date,run_id) values('${id(802)}','open','FR8','2026-10-17','${id(801)}'),('${id(803)}','open','FR8','2026-10-17','${id(804)}')`);
assert.equal((await call(802)).rows[0].result.status,'open');await assert.rejects(()=>call(803),/ผลรอบปัจจุบัน/);
await db.close();console.log('PASS: reproduced manual-primary attachment rejection; 9 companies, open/pending manual, current system, stale/closed/replaced/scope/role/storage/archive/overwrite guards and retry dedupe. Synthetic DB only.');
