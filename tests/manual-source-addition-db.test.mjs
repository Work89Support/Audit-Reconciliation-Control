import fs from 'node:fs';import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);const db=new PGlite();
await db.exec(`create schema auth;create schema storage;create role anon;create role authenticated;create role service_role;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select current_setting('test.api_role',true)$$;
create table auth.users(id uuid primary key);
create function current_user_active() returns boolean language sql stable as $$select coalesce(current_setting('test.active',true),'true')='true'$$;
create function current_app_role() returns text language sql stable as $$select current_setting('test.role',true)$$;
create function has_company_access(c text) returns boolean language sql stable as $$select c=any(string_to_array(current_setting('test.companies',true),','))$$;
create table audit_companies(code text primary key,active boolean);
create table mail_batches(id uuid primary key,gmail_message_id text unique,subject text,sender text,received_at timestamptz,company text,business_date date,is_supplement boolean,file_count int,status text,note text);
create table source_files(id uuid primary key,batch_id uuid,company text,file_name text,kind text,storage_path text,mime_type text,size_bytes bigint,checksum text,parsed boolean,parse_error text,row_count integer,created_at timestamptz default now());
create table source_file_ocr(source_file_id uuid);create table recon_runs(id uuid primary key,company text,business_date date,summary jsonb);
create table daily_recon_jobs(id uuid primary key,company text,business_date date,status text,last_run_id uuid,is_archived boolean default false,attempt_count integer default 0,last_error text);
create table exceptions(id uuid primary key,run_id uuid,company text,business_date date,account text,status text,system_amount numeric,customer_details jsonb default '{}');
create table case_evidence(id uuid primary key,exception_id uuid);create table account_review_holds(id uuid primary key,company text,detail text);
create table storage.objects(bucket_id text,name text,owner_id text,metadata jsonb,updated_at timestamptz default now());
create table audit_log(actor text,action text,entity text,target text,company text,detail text,meta jsonb);
create function claim_daily_recon_jobs(p_worker text,p_limit integer) returns setof daily_recon_jobs language sql security definer as $$select j.* from daily_recon_jobs j where j.status='queued' limit p_limit$$;
grant usage on schema auth to authenticated,service_role;grant execute on all functions in schema auth to authenticated,service_role;`);
for(const name of ['20261012_account_recheck.sql','20261012_file_run_management.sql','20261013_manual_run_readiness.sql','20261019_manual_source_addition.sql'])await db.exec(fs.readFileSync('supabase/'+name,'utf8'));
await db.exec(fs.readFileSync('supabase/20261019_manual_source_addition.sql','utf8'));
const companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.query('insert into auth.users values($1)',[id(1)]);
async function actor(role='admin',scope=companies,active=true){await db.exec('reset role');await db.query("select set_config('test.actor',$1,false),set_config('test.role',$2,false),set_config('test.companies',$3,false),set_config('test.active',$4,false),set_config('test.api_role','authenticated',false)",[id(1),role,scope.join(','),String(active)]);await db.exec('set role authenticated');}
for(const [i,c] of companies.entries()){
 const n=100+i*20;await db.query('insert into audit_companies values($1,true)',[c]);
 await db.query("insert into daily_recon_jobs(id,company,business_date,status) values($1,$2,'2026-10-18','completed'),($3,$2,'2026-10-17','completed')",[id(n),c,id(n+1)]);
 await db.query("insert into mail_batches(id,company,business_date) values($1,$2,'2026-10-18'),($3,$2,'2026-10-17')",[id(n+2),c,id(n+3)]);
 await db.query("insert into source_files(id,batch_id,company,file_name,kind,storage_path,size_bytes,parsed) values($1,$2,$3,'BO.xlsx','bo_main',$4,4,true),($5,$6,$3,'PM-actual-18.csv','pm_statement',$7,4,false)",[id(n+4),id(n+2),c,c+'/BO',id(n+5),id(n+3),c+'/PM']);
 await db.query("insert into storage.objects values('audit-files',$1,$2,'{\"size\":4}',now()),('audit-files',$3,$2,'{\"size\":4}',now())",[c+'/BO',id(1),c+'/PM']);
 await db.query("insert into exceptions(id,company,business_date,status,system_amount) values($1,$2,'2026-10-18','closed',123.45)",[id(n+6),c]);
 await db.query("insert into account_review_holds values($1,$2,'existing suspension unchanged')",[id(n+7),c]);
}
const fingerprint=async()=>JSON.stringify((await db.query('select (select jsonb_agg(to_jsonb(e) order by id) from exceptions e) cases,(select jsonb_agg(to_jsonb(h) order by id) from account_review_holds h) holds')).rows);
const before=await fingerprint();
for(const [i,c] of companies.entries()){
 const n=100+i*20;await db.exec('reset role');
 const original=(await db.query('select to_jsonb(f) f from source_files f where id=$1',[id(n+5)])).rows[0].f;
 await actor();
 // Correct a wrong header date through the existing reviewed revision path.
 await db.query("select correct_audit_source($1,1,'PM-actual-18.csv',$2,'2026-10-18','pm_statement',null,false,'verified actual row dates 18 October')",[id(n+5),c]);
 await db.exec('reset role');assert.deepEqual((await db.query('select to_jsonb(f) f from source_files f where id=$1',[id(n+5)])).rows[0].f,original);
 const fid=id(n+8),path=`manual-replacements/${id(1)}/${fid}/extra.csv`,checksum=String(i+1).repeat(64);
 await db.query("insert into storage.objects values('audit-files',$1,$2,$3,now())",[path,id(1),JSON.stringify({size:4,eTag:'extra-'+c})]);
 const meta={id:fid,storage_path:path,file_name:'extra.csv',size_bytes:4,mime_type:'text/csv',checksum};
 const add=()=>db.query("select add_audit_manual_source($1,'2026-10-18','pm_statement',$2,'Verified additional file for manual review') r",[c,JSON.stringify(meta)]);
 await actor('monitor');await assert.rejects(add(),/หัวหน้า/);await actor('admin',['NONE']);await assert.rejects(add(),/สิทธิ์/);await actor('admin',companies,false);await assert.rejects(add(),/หัวหน้า/);
 await actor();
 await assert.rejects(db.query("select add_audit_manual_source($1,'2026-10-18','pm_statement',$2,'Reject a forged upload owner')",[c,JSON.stringify({...meta,id:id(n+12),storage_path:`manual-replacements/${id(2)}/${id(n+12)}/extra.csv`})]),/ข้อมูลไฟล์/);
 await assert.rejects(db.query("select add_audit_manual_source($1,'2026-10-18','pm_statement',$2,'Reject missing storage bytes')",[c,JSON.stringify({...meta,id:id(n+12),storage_path:`manual-replacements/${id(1)}/${id(n+12)}/missing.csv`})]),/ไม่พบไฟล์/);
 await assert.rejects(db.query("select add_audit_manual_source($1,'2026-10-18','pm_statement',$2,'Reject size mismatch')",[c,JSON.stringify({...meta,size_bytes:5})]),/ขนาดไม่ตรง/);
 const added=(await add()).rows[0].r;assert.equal(added.reused,false);assert.equal((await add()).rows[0].r.reused,true);
 await assert.rejects(db.query("select add_audit_manual_source($1,'2026-10-18','pm_statement',$2,'Verified additional file for manual review')",[c,JSON.stringify({...meta,file_name:'changed.csv'})]),/คำขอเพิ่มไฟล์เดิมไม่ตรง/);
 const plan=(await db.query("select effective_audit_source_files($1,'2026-10-18') p",[c])).rows[0].p;assert.equal(plan.length,3);assert.equal(plan.find(f=>f.id===fid).revision,2);
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from source_files where id=$1',[fid])).rows[0].n,1);
 assert.equal((await db.query("select count(*)::int n from audit_run_holds where company=$1 and paused",[c])).rows[0].n,2);
 // Another filename/nonce with identical bytes reuses the existing source.
 const dupId=id(n+9),dupPath=`manual-replacements/${id(1)}/${dupId}/renamed.csv`;
 await db.query("insert into storage.objects values('audit-files',$1,$2,$3,now())",[dupPath,id(1),JSON.stringify({size:4,eTag:'extra-'+c})]);await actor();
 const duplicate=(await db.query("select add_audit_manual_source($1,'2026-10-18','pm_statement',$2,'Verified duplicate file should not be registered') r",[c,JSON.stringify({...meta,id:dupId,storage_path:dupPath,file_name:'renamed.csv'})])).rows[0].r;
 assert.equal(duplicate.duplicate,true);assert.equal(duplicate.source_file_id,fid);
 // A monitor may stage the exact selected files; the automatic primary stays paused.
 await actor('monitor');const job=(await db.query("select to_jsonb(request_account_recheck($1,'2026-10-18','ALL','all','account',$2,$3)) q",[c,id(n+10),[id(n+4),id(n+5),fid]])).rows[0].q;assert.equal(job.status,'queued');
 await actor();await assert.rejects(db.query("select add_audit_manual_source($1,'2026-10-18','pm_statement',$2,'No new file while the manual worker is running')",[c,JSON.stringify({...meta,id:id(n+11),storage_path:`manual-replacements/${id(1)}/${id(n+11)}/extra.csv`})]),/กำลังใช้/);
 await db.exec('reset role');
}
assert.equal(await fingerprint(),before);
await actor('admin',['FR8']);await assert.rejects(db.query("select correct_audit_source($1,2,'foreign.csv','FR8','2026-10-18','pm_statement',null,false,'Must not borrow inaccessible company')",[id(100+8*20+5)]),/ไม่มีสิทธิ์/);
await db.exec('reset role');assert.equal((await db.query("select has_function_privilege('anon','add_audit_manual_source(text,date,text,jsonb,text)','execute') ok")).rows[0].ok,false);
console.log('PASS nine companies: reviewed date corrections, user-owned extra files, no duplicate registration/retry, explicit selected-file staging, automatic worker paused, original files/cases/amounts/holds preserved, roles and busy-job guards enforced. Synthetic DB only.');await db.close();
