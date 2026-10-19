import fs from 'node:fs';import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);const db=new PGlite();
// Reuse the established isolated reconciliation fixture, not production data.
const fixture=fs.readFileSync('tests/manual-source-addition-db.test.mjs','utf8');
await db.exec(fixture.split('await db.exec(`')[1].split('`);')[0]);
for(const file of ['20261012_account_recheck.sql','20261012_file_run_management.sql','20261013_manual_run_readiness.sql'])await db.exec(fs.readFileSync('supabase/'+file,'utf8'));
await db.exec('alter table recon_runs add column file_ids uuid[];create table manual_primary_results(id uuid primary key,company text,business_date date,source_stamp jsonb);');
const sql=fs.readFileSync('supabase/20261019_source_exclusion.sql','utf8');await db.exec(sql);await db.exec(sql);
const companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.query('insert into auth.users values($1)',[id(1)]);
async function actor(role='admin',scope=companies){await db.exec('reset role');await db.query("select set_config('test.actor',$1,false),set_config('test.role',$2,false),set_config('test.companies',$3,false),set_config('test.active','true',false),set_config('test.api_role','authenticated',false)",[id(1),role,scope.join(',')]);await db.exec('set role authenticated');}
const protectedData=async()=>{await db.exec('reset role');return JSON.stringify((await db.query(`select (select jsonb_agg(to_jsonb(f) order by id) from source_files f) files,(select jsonb_agg(to_jsonb(e) order by id) from exceptions e) cases,(select jsonb_agg(to_jsonb(h) order by id) from account_review_holds h) registry,(select jsonb_agg(to_jsonb(h) order by company,business_date) from audit_run_holds h) holds,(select jsonb_agg(to_jsonb(j) order by id) from daily_recon_jobs j) jobs,(select jsonb_agg(to_jsonb(r) order by id) from recon_runs r) runs`)).rows);};
for(const [i,c] of companies.entries()){
 const n=100+i*20;
 await db.query('insert into audit_companies values($1,true)',[c]);
 await db.query("insert into mail_batches(id,company,business_date) values($1,$2,'2026-10-18')",[id(n),c]);
 await db.query("insert into source_files(id,batch_id,company,file_name,kind,storage_path,size_bytes,parsed) values($1,$2,$3,'PM.xlsx','pm_statement',$4,12,false)",[id(n+1),id(n),c,c+'/PM']);
 await db.query("insert into daily_recon_jobs(id,company,business_date,status) values($1,$2,'2026-10-18','completed')",[id(n+2),c]);
 await db.query("insert into audit_run_holds values($1,'2026-10-18',true,'existing hold unchanged',3,$2,now())",[c,id(1)]);
 await db.query("insert into exceptions(id,company,business_date,status,system_amount) values($1,$2,'2026-10-18','closed',2)",[id(n+3),c]);
 await db.query("insert into account_review_holds values($1,$2,'unchanged registry')",[id(n+4),c]);
 const before=await protectedData();
 const save=(rev,excluded,reason='Verified duplicate file exclusion')=>db.query('select set_audit_source_excluded($1,$2,$3,$4) v',[id(n+1),rev,excluded,reason]);
 await actor('monitor');await assert.rejects(save(1,true),/หัวหน้า/);await actor('admin',['NONE']);await assert.rejects(save(1,true),/สิทธิ์/);
 await actor();await assert.rejects(save(1,true,'short'),/เหตุผล/);
 let v=(await save(1,true)).rows[0].v;assert.equal(v.excluded,true);assert.equal(v.revision,2);
 assert.equal((await db.query("select audit_run_blocked($1,'2026-10-18') b",[c])).rows[0].b,true);
 await assert.rejects(save(1,true),/เวอร์ชัน/);
 await assert.rejects(db.query("select request_account_recheck($1,'2026-10-18','ALL','all','account',$2,$3)",[c,id(n+10),[id(n+1)]]),/ไฟล์|เลือก/);
 v=(await save(2,false,'Restore verified file for future selection')).rows[0].v;assert.equal(v.excluded,false);assert.equal(v.revision,3);
 assert.equal(await protectedData(),before,'Amounts, original bytes metadata, cases, job status, both hold registries and old results unchanged');
 await db.query("insert into manual_primary_results values($1,$2,'2026-10-18',$3)",[id(n+5),c,JSON.stringify([{id:id(n+1),physical:id(n+1)}])]);
 await actor();await assert.rejects(save(3,true),/ผลหลัก/);
 await db.exec('reset role');await db.query('delete from manual_primary_results where id=$1',[id(n+5)]);
 await db.query("insert into recon_runs(id,company,business_date,file_ids) values($1,$2,'2026-10-18',$3)",[id(n+6),c,[id(n+1)]]);
 await db.query('update daily_recon_jobs set last_run_id=$1 where id=$2',[id(n+6),id(n+2)]);
 await actor();await assert.rejects(save(3,true),/ผลหลัก/);
 await db.exec('reset role');await db.query("update daily_recon_jobs set last_run_id=null,status='running' where id=$1",[id(n+2)]);
 await actor();await assert.rejects(save(3,true),/กำลังใช้/);
 await db.exec('reset role');await db.query("update daily_recon_jobs set status='completed' where id=$1",[id(n+2)]);
 assert.equal((await db.query('select count(*)::int n from audit_source_revisions where source_file_id=$1',[id(n+1)])).rows[0].n,2);
 assert.equal((await db.query("select count(*)::int n from audit_log where target=$1 and action in('source_file_excluded','source_file_restored')",[id(n+1)])).rows[0].n,2);
}
assert.equal((await db.query("select has_function_privilege('anon','set_audit_source_excluded(uuid,integer,boolean,text)','execute') ok")).rows[0].ok,false);
console.log('PASS nine companies: exclude/restore only append revisions, primary and busy guards, permissions, stale retry, manual selection rejection, unchanged files/amounts/cases/jobs/holds. Synthetic DB only.');await db.close();
