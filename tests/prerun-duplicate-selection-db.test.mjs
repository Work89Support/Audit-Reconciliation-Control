process.on('uncaughtException', e=>{console.error(e.message, e.where||'',e.query||'');process.exit(1);});
import fs from 'node:fs';import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);const db=new PGlite();
const fixture=fs.readFileSync('tests/manual-source-addition-db.test.mjs','utf8');
await db.exec(fixture.split('await db.exec(`')[1].split('`);')[0]);
for(const f of ['20261012_account_recheck.sql','20261012_file_run_management.sql','20261013_manual_run_readiness.sql'])await db.exec(fs.readFileSync('supabase/'+f,'utf8'));
await db.exec(`create table manual_primary_results(id uuid primary key,company text,business_date date);
create table audit_run_preflight_drafts(id uuid primary key,company text,business_date date);
alter table recon_runs add column file_ids uuid[];
grant select on daily_recon_jobs to authenticated;
alter table daily_recon_jobs add column claimed_at timestamptz,add column claimed_by text;
create function audit_source_file_effectively_parsed(p_file_id uuid) returns boolean language sql security definer as $$select coalesce(source_file.parsed, false) from source_files source_file where source_file.id=p_file_id$$;`);
const migration=fs.readFileSync('supabase/20261128_prerun_duplicate_file_selection.sql','utf8');
await db.exec(migration);await db.exec(migration); // repeatable installation
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.query('insert into auth.users values($1)',[id(1)]);
const companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
async function actor(role='admin',scope=companies){await db.exec('reset role');await db.query("select set_config('test.actor',$1,false),set_config('test.role',$2,false),set_config('test.companies',$3,false),set_config('test.active','true',false),set_config('test.api_role','authenticated',false)",[id(1),role,scope.join(',')]);await db.exec('set role authenticated');}
async function setup(n,c,tag='same'){
 await db.exec('reset role');await db.query('insert into audit_companies values($1,true) on conflict do nothing',[c]);
 await db.query("insert into mail_batches(id,company,business_date) values($1,'PS','2026-11-27'),($2,$3,'2026-11-27')",[id(n),id(n+1),c]);
 await db.query("insert into source_files(id,batch_id,company,file_name,kind,storage_path,size_bytes,parsed) values($1,$2,$3,'STM.pdf','stm_pdf',$4,4,false),($5,$6,$3,'STM.pdf','stm_pdf',$7,4,false)",[id(n+2),id(n),c,c+'/'+n,id(n+3),id(n+1),c+'/'+(n+1)]);
 await db.query("insert into storage.objects values('audit-files',$1,$2,$3,now()),('audit-files',$4,$2,$5,now())",[c+'/'+n,id(1),JSON.stringify({size:3,eTag:'same'}),c+'/'+(n+1),JSON.stringify({size:3,eTag:tag})]);
 await db.query("insert into daily_recon_jobs(id,company,business_date,status) values($1,$2,'2026-11-27','queued')",[id(n+4),c]);
}
const correct=(n,c,kind='doc_clarify',name='STM.pdf')=>db.query("select to_jsonb(correct_audit_source($1,1,$2,$3,'2026-11-27',$4,null,false,'Verified duplicate removed before first run')) r",[id(n+2),name,c,kind]);
for(const [i,c]of companies.entries()){
 const n=100+i*20;await setup(n,c);await actor();
 const r=(await correct(n,c)).rows[0].r;assert.equal(r.pre_run_duplicate,true);assert.equal(r.duplicate_of,id(n+3));
 assert.equal((await db.query("select audit_run_blocked($1,'2026-11-27') b",[c])).rows[0].b,false);
 assert.equal((await db.query("select audit_source_file_effectively_parsed($1) b",[id(n+2)])).rows[0].b,true);
 assert.equal((await db.query("select status from daily_recon_jobs where id=$1",[id(n+4)])).rows[0].status,'queued');
 assert.equal((await db.query('select count(*)::int n from audit_run_holds where company=$1',[c])).rows[0].n,0);
 const inbox=(await db.query("select audit_source_inbox_batches('2026-11-27','2026-11-27',$1) v",[c])).rows[0].v;
 assert.equal(inbox.length,2,'file company must include source attached to mislabelled PS mail');
 const files=inbox.flatMap(b=>b.source_files);assert.equal(files.length,2);assert.equal(files.filter(f=>f.kind==='stm_pdf').length,1);assert.equal(files.find(f=>f.id===id(n+2)).revision,2);
 const manager=(await db.query("select file_run_management_state($1,'2026-11-27') v",[c])).rows[0].v;
 assert.deepEqual(files.map(f=>[f.id,f.kind,f.revision]).sort(),manager.files.map(f=>[f.id,f.kind,f.revision]).sort());
 await assert.rejects(correct(n,c),/เวอร์ชัน/);
 // Once the remaining copy is removed there is no keeper, so automatic work must stop.
 const last=(await db.query("select to_jsonb(correct_audit_source($1,1,'STM.pdf',$2,'2026-11-27','doc_clarify',null,false,'Never remove the last active statement')) r",[id(n+3),c])).rows[0].r;
 assert.equal(last.pre_run_duplicate,false);assert.equal((await db.query("select audit_run_blocked($1,'2026-11-27') b",[c])).rows[0].b,true);
}
// Identical filenames/size without matching bytes are insufficient.
await setup(500,'DIFF','different');await actor('admin',['DIFF']);assert.equal((await correct(500,'DIFF')).rows[0].r.pre_run_duplicate,false);
// Every type of previous work keeps the old hold path and preserves protected records.
for(const [i,change] of ["update daily_recon_jobs set status='running' where company=$1","update daily_recon_jobs set attempt_count=1 where company=$1","update daily_recon_jobs set claimed_by='worker' where company=$1","insert into recon_runs values(gen_random_uuid(),$1,'2026-11-27','{}',null)","insert into manual_primary_results values(gen_random_uuid(),$1,'2026-11-27')","insert into exceptions(id,company,business_date,status,system_amount) values(gen_random_uuid(),$1,'2026-11-27','closed',200)","insert into audit_run_preflight_drafts values(gen_random_uuid(),$1,'2026-11-27')"].entries()){
 const c='USED'+i,n=600+i*20;await setup(n,c);await db.query(change,[c]);
 const before=JSON.stringify((await db.query("select (select jsonb_agg(to_jsonb(r)) from recon_runs r where company=$1) runs,(select jsonb_agg(to_jsonb(e)) from exceptions e where company=$1) cases,(select jsonb_agg(to_jsonb(f)) from source_files f where company=$1) files",[c])).rows);
 await actor('admin',[c]);assert.equal((await correct(n,c)).rows[0].r.pre_run_duplicate,false);
 await db.exec('reset role');const after=JSON.stringify((await db.query("select (select jsonb_agg(to_jsonb(r)) from recon_runs r where company=$1) runs,(select jsonb_agg(to_jsonb(e)) from exceptions e where company=$1) cases,(select jsonb_agg(to_jsonb(f)) from source_files f where company=$1) files",[c])).rows);assert.equal(after,before);
}
// An existing independent hold is retained even for an eligible duplicate.
await setup(900,'HELD');await db.query("insert into audit_run_holds values('HELD','2026-11-27',true,'Independent manual hold',1,$1,now())",[id(1)]);
await actor('admin',['HELD']);assert.equal((await correct(900,'HELD')).rows[0].r.pre_run_duplicate,true);
assert.equal((await db.query("select audit_run_blocked('HELD','2026-11-27') b")).rows[0].b,true);
// Permissions never let an ordinary reviewer alter a revision.
await actor('monitor');await assert.rejects(correct(100,'3XB'),/หัวหน้า/);
await actor('admin',['NONE']);await assert.rejects(db.query("select audit_source_inbox_batches('2026-11-27','2026-11-27','PS8')"),/สิทธิ์/);
await db.exec('reset role');assert.equal((await db.query("select has_function_privilege('anon','audit_source_inbox_batches(date,date,text)','execute') b")).rows[0].b,false);
console.log('PASS nine-company duplicate quarantine before first claim; byte identity; last-copy protection; effective inbox parity; stale revision and role guards; prior attempts/results/closed cases preserved. Synthetic PostgreSQL only.');await db.close();
