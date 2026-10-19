import fs from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);
const db=new PGlite();
await db.exec(`create schema auth;create schema storage;
 create table test_access(active boolean,company text);
 insert into test_access values(true,'ALL');
 create function auth.role() returns text language sql stable as $$select 'authenticated'::text$$;
 create function current_user_active() returns boolean language sql stable as $$select active from test_access$$;
 create function has_company_access(c text) returns boolean language sql stable as $$select company in(c,'ALL') from test_access$$;
 create table mail_batches(id uuid primary key,business_date date,company text);
 create table source_files(id uuid primary key,batch_id uuid,company text,file_name text,kind text,storage_path text,checksum text,size_bytes bigint,mime_type text,row_count int,parse_error text,parsed boolean,created_at timestamptz);
 create table audit_source_revisions(id uuid primary key,source_file_id uuid,revision int,effective_name text,company text,business_date date,kind text,excluded boolean,replacement_file_id uuid);
 create table source_file_ocr(source_file_id uuid primary key,text text);
 create table storage.objects(bucket_id text,name text,updated_at timestamptz,metadata jsonb);
 create table audit_log(id uuid,entity text,target text,action text,at timestamptz,meta jsonb);`);
const source=fs.readFileSync('supabase/20261012_file_run_management.sql','utf8');
const original=source.slice(source.indexOf('create function public.effective_audit_source_files('),source.indexOf('create function public.audit_run_blocked('));
await db.exec(original);
await db.exec(original.replace('public.effective_audit_source_files','public.original_source_manifest'));
const companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
for(let i=0;i<180;i++){
 const company=companies[i%9],date=i%4===0?'2026-10-18':i%4===1?'2026-10-17':'2026-10-16';
 await db.query('insert into mail_batches values($1,$2,$3)',[id(i+1),date,company]);
 await db.query(`insert into source_files values($1,$2,$3,$4,$5,$6,$7,100,'application/pdf',2,null,true,'2026-10-19')`,[id(i+1000),id(i+1),i%5===0?null:company,i%3===0?'BBL.pdf':i%3===1?'KTB.pdf':'SCB.pdf',i%7===0?'doc_clarify':'stm_pdf',`files/${i}`,`hash-${i}`]);
 await db.query("insert into storage.objects values('audit-files',$1,'2026-10-19',$2)",[`files/${i}`,JSON.stringify({eTag:`e-${i}`,size:100})]);
 await db.query('insert into source_file_ocr values($1,$2)',[id(i+1000),`immutable OCR ${i}`]);
 if(i%3===0)for(let rev=1;rev<=2;rev++)await db.query(`insert into audit_source_revisions values($1,$2,$3,$4,$5,$6,'stm_pdf',$7,$8)`,[id(5000+i*3+rev),id(i+1000),rev,'BBL corrected.pdf',companies[(i+rev)%9],rev===1?'2026-10-17':'2026-10-18',i%6===0,i%9===0?id(1001+i):null]);
}
const protectedTables=['source_files','audit_source_revisions','source_file_ocr','mail_batches','storage.objects','audit_log'];
const snapshots=async()=>Promise.all(protectedTables.map(async t=>(await db.query(`select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]')::text) hash from ${t} t`)).rows[0].hash));
const before=await snapshots();
const patch=fs.readFileSync('supabase/20261019_summary_case_read_performance.sql','utf8');
await db.exec(patch);await db.exec(patch);
for(const company of companies)for(const date of ['2026-10-01','2026-10-02','2026-10-16','2026-10-17','2026-10-18']){
 const {rows}=await db.query('select effective_audit_source_files($1,$2)=original_source_manifest($1,$2) same',[company,date]);
 assert.equal(rows[0].same,true,company+' '+date+' must preserve byte/OCR/revision manifest exactly');
}
assert.deepEqual(await snapshots(),before,'no business, source, OCR or history rows changed');
await db.exec("update test_access set company='SK8'");
await assert.rejects(db.query("select effective_audit_source_files('FR8','2026-10-17')"),/ไม่มีสิทธิ์/);
await db.exec('update test_access set active=false');
await assert.rejects(db.query("select effective_audit_source_files('SK8','2026-10-17')"),/ไม่มีสิทธิ์/);
console.log('PASS read performance DB: exact manifest equivalence in 45 scopes, original/corrected/adjacent/replaced/excluded/OCR coverage, idempotent migration, unchanged protected rows and unchanged authorization.');
await db.close();
