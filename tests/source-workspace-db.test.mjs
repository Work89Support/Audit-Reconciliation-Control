import fs from 'node:fs';import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);const db=new PGlite();const fixture=fs.readFileSync('tests/manual-source-addition-db.test.mjs','utf8');await db.exec(fixture.split('await db.exec(`')[1].split('`);')[0]);
await db.exec('alter table daily_recon_jobs add constraint test_unique_company_day unique(business_date,company)');
for(const f of ['20261012_account_recheck.sql','20261012_file_run_management.sql','20261013_manual_run_readiness.sql','20261019_manual_source_addition.sql','20261019_source_workspace.sql'])await db.exec(fs.readFileSync('supabase/'+f,'utf8'));
await db.exec(fs.readFileSync('supabase/20261019_source_workspace.sql','utf8'));
assert.doesNotMatch(fs.readFileSync('supabase/20261019_source_workspace.sql','utf8'),/s:=public\.file_run_management_state/,'File listing must not execute full round preflight');
const companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'],id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.query('insert into auth.users values($1)',[id(1)]);
async function actor(role='admin',scope=companies){await db.exec('reset role');await db.query("select set_config('test.actor',$1,false),set_config('test.role',$2,false),set_config('test.companies',$3,false),set_config('test.active','true',false),set_config('test.api_role','authenticated',false)",[id(1),role,scope.join(',')]);await db.exec('set role authenticated');}
for(const [i,c]of companies.entries()){
 await db.exec('reset role');await db.query('insert into audit_companies values($1,true)',[c]);const n=100+i*10,mailId=id(n),mailFile=id(n+1),fid=id(n+2),path=`manual-replacements/${id(1)}/${fid}/original.csv`;
 await db.query("insert into mail_batches(id,gmail_message_id,company,business_date) values($1::uuid,'mail-'||$1::uuid::text,$2,'2026-10-18')",[mailId,c]);await db.query("insert into source_files(id,batch_id,company,file_name,kind,size_bytes) values($1,$2,$3,'mail.xlsx','pm_statement',9)",[mailFile,mailId,c]);
 await db.query("insert into storage.objects values('audit-files',$1,$2,$3,now())",[path,id(1),JSON.stringify({size:4,eTag:'unique-'+c})]);
 const meta={id:fid,storage_path:path,file_name:'original.csv',effective_name:c+'_renamed.csv',size_bytes:4,mime_type:'text/csv',checksum:String(i+1).repeat(64)};
 await actor('monitor');await assert.rejects(db.query("select add_audit_manual_source($1,'2026-10-18','pm_statement',$2,'verified actual source content')",[c,JSON.stringify(meta)]),/หัวหน้า/);
 await actor();const result=(await db.query("select add_audit_manual_source($1,'2026-10-18','pm_statement',$2,'verified actual source content') r",[c,JSON.stringify(meta)])).rows[0].r;assert.equal(result.reused,false);
 const state=(await db.query("select audit_source_workspace($1,'2026-10-18') s",[c])).rows[0].s;
 assert.equal(state.files.find(f=>f.id===mailFile).source_origin,'mail');const uploaded=state.files.find(f=>f.id===fid);assert.equal(uploaded.source_origin,'upload');assert.equal(uploaded.file_name,c+'_renamed.csv');assert.equal(uploaded.original_file_name,'original.csv');assert.equal(state.hold.paused,true);
 await assert.rejects(db.query("select add_audit_manual_source($1,'2026-10-18','pm_statement',$2,'verified actual source content')",[c,JSON.stringify({...meta,effective_name:'another.csv'})]),/คำขอเพิ่มไฟล์เดิมไม่ตรง/);
 const evidenceId=id(n+3),evidencePath=`manual-replacements/${id(1)}/${evidenceId}/evidence.docx`;
 await db.exec('reset role');await db.query("insert into storage.objects values('audit-files',$1,$2,$3,now())",[evidencePath,id(1),JSON.stringify({size:4,eTag:'evidence-'+c})]);await actor();
 await db.query("select add_audit_manual_source($1,'2026-10-18','doc_clarify',$2,'verified evidence document only')",[c,JSON.stringify({...meta,id:evidenceId,storage_path:evidencePath,file_name:'evidence.docx',effective_name:'evidence-review.docx',checksum:'a'.repeat(64)})]);
 const evidence=(await db.query("select audit_source_workspace($1,'2026-10-18') s",[c])).rows[0].s.files.find(f=>f.id===evidenceId);assert.equal(evidence.kind,'doc_clarify');assert.equal(evidence.original_file_name,'evidence.docx');
 await actor('admin',['NONE']);await assert.rejects(db.query("select audit_source_workspace($1,'2026-10-18')",[c]),/สิทธิ์/);
 await db.exec('reset role');assert.equal((await db.query('select file_name from source_files where id=$1',[fid])).rows[0].file_name,'original.csv');assert.equal((await db.query('select count(*)::int n from account_recheck_jobs')).rows[0].n,0);
}
console.log('PASS nine-company DB: immutable original/effective rename, new-day intake without automatic run, mail/upload provenance, scoped read and upload role guards, retry integrity; no primary/case/run mutations. Synthetic DB only.');await db.close();
