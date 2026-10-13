import fs from 'node:fs';import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);const db=new PGlite(),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`create schema auth;create schema storage;create role anon;create role authenticated;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create table app_profiles(user_id uuid,full_name text,role text,active boolean);
create table user_company_access(user_id uuid,company text);
create function current_user_active() returns boolean language sql as $$select active from app_profiles where user_id=auth.uid()$$;
create function current_app_role() returns text language sql as $$select role from app_profiles where user_id=auth.uid()$$;
create function has_company_access(c text) returns boolean language sql as $$select exists(select 1 from user_company_access where user_id=auth.uid() and company=c)$$;
create table exceptions(id uuid primary key,company text,status text,clarification_file_id uuid,response_text text,resolution_note text,resolved_by text,responded_by uuid,responded_at timestamptz,created_at timestamptz default now(),updated_at timestamptz,system_amount numeric,bank_amount numeric);
create table source_files(id uuid primary key,company text,kind text,size_bytes bigint,storage_path text,file_name text);
create table case_evidence(exception_id uuid,storage_path text,size_bytes bigint);
create table storage.objects(bucket_id text,name text);
create table audit_log(actor text,actor_user_id uuid,action text,entity text,target text,company text,detail text,meta jsonb,at timestamptz default now());`);
for(const [n,role,company] of [[1,'shift_lead','TEST'],[2,'monitor','TEST'],[3,'shift_lead','OTHER']]){
 await db.query('insert into app_profiles values($1,$2,$3,true)',[id(n),'Dummy '+n,role]);await db.query('insert into user_company_access values($1,$2)',[id(n),company]);
}
await db.query("insert into exceptions(id,company,status,resolution_note,system_amount,bank_amount) values($1,'TEST','clarifying','ข้อความเลือกไฟล์เดิมที่ต้องเห็น',100,100)",[id(10)]);
for(const [n,c] of [[20,'TEST'],[21,'TEST'],[22,'OTHER']]){await db.query("insert into source_files values($1,$2,'doc_clarify',10,$3,'dummy.pdf')",[id(n),c,'dummy-'+n]);await db.query("insert into storage.objects values('audit-files',$1)",['dummy-'+n]);}
await db.exec(fs.readFileSync('supabase/20261013_clarification_submit_flow.sql','utf8'));
const actor=async n=>db.query("select set_config('test.actor',$1,false)",[id(n)]);await actor(1);
const submit=(file=id(20),status='clarifying',previous=null,text='ตัวอย่างสาเหตุที่ตรงกับหลักฐาน')=>db.query('select submit_case_clarification($1,$2,$3,$4,$5) as v',[id(10),text,file,status,previous]);
await assert.rejects(submit(id(22)),/ไม่ตรงบริษัท/);await assert.rejects(submit(id(20),'closed'),/สถานะ/);await assert.rejects(submit(id(20),'clarifying',null,'สั้น'),/สาเหตุ/);
await actor(3);await assert.rejects(submit(),/ไม่มีสิทธิ์/);await assert.rejects(db.query('select case_clarification_history($1)',[id(10)]),/ไม่มีสิทธิ์/);
await actor(1);const saved=(await submit()).rows[0].v;assert.equal(saved.status,'answered');assert.equal(saved.responded_by,id(1));assert.equal(saved.clarification_file_id,id(20));assert.equal(saved.system_amount,100);
await assert.rejects(submit(),/สถานะหรือหลักฐานเปลี่ยน/);
await submit(id(21),'answered',id(20),'คำตอบเพิ่มเติมพร้อมเอกสารใหม่');
await actor(2);const history=(await db.query('select case_clarification_history($1) as v',[id(10)])).rows[0].v;
assert(history.some(r=>r.text==='ข้อความเลือกไฟล์เดิมที่ต้องเห็น'));assert(history.some(r=>r.text==='ตัวอย่างสาเหตุที่ตรงกับหลักฐาน'));assert(history.some(r=>r.text==='คำตอบเพิ่มเติมพร้อมเอกสารใหม่'));
assert.equal((await db.query('select count(*)::int n from source_files')).rows[0].n,3);
await db.query("update exceptions set status='closed' where id=$1",[id(10)]);await actor(1);await assert.rejects(submit(id(21),'closed',id(21)),/สถานะ/);
const amounts=(await db.query('select system_amount,bank_amount from exceptions where id=$1',[id(10)])).rows[0];assert.equal(Number(amounts.system_amount),100);assert.equal(Number(amounts.bank_amount),100);
console.log('PASS synthetic DB: atomic response+file, real proof guard, company denial, latest status/file conflict, legacy and previous history, unchanged amounts/original files. No production writes.');await db.close();
