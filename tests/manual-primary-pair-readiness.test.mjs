import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=await PGlite.create();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`create role anon;create role authenticated;
create schema storage;
create function current_user_active() returns boolean language sql as $$select true$$;
create function has_company_access(c text) returns boolean language sql as $$select c='FR8'$$;
create table exceptions(id uuid primary key,company text,business_date date,run_id uuid,superseded_by_exception_id uuid,account text,direction text,currency text,ex_type text,system_amount numeric,bank_amount numeric,bo_raw text,stm_raw text,customer_details jsonb default '{}');
create table daily_recon_jobs(company text,business_date date,is_archived boolean,status text,last_run_id uuid);
create table recon_runs(id uuid primary key,summary jsonb,file_ids uuid[]);
create table source_files(id uuid primary key,company text,file_name text,parsed boolean,parse_error text,kind text,storage_path text);
create table storage.objects(name text,bucket_id text);
create table manual_primary_results(id uuid primary key,company text,business_date date,recheck_id uuid,base_run_id uuid,report jsonb,source_stamp jsonb,accepted_at timestamptz);
create table manual_primary_case_items(primary_id uuid,exception_id uuid);
create table account_recheck_jobs(id uuid,status text,result jsonb,account text,direction text);
create function manual_primary_report_projection(v jsonb) returns jsonb language sql immutable as $$select v$$;
create function effective_audit_source_files(text,date) returns jsonb language sql stable as $$select current_setting('test.sources')::jsonb$$;
create function manual_primary_sources(v jsonb) returns jsonb language sql immutable as $$select v$$;
create function manual_primary_sources_intact(stamp jsonb,files jsonb) returns boolean language sql immutable as $$select files @> stamp$$;
create function primary_case_is_current(p uuid) returns boolean language sql stable as $$
 select exists(select 1 from exceptions e join manual_primary_case_items i on i.exception_id=e.id
 join manual_primary_results v on v.id=i.primary_id where e.id=p and v.id=(select n.id from manual_primary_results n
 where n.company=e.company and n.business_date=e.business_date order by accepted_at desc,id desc limit 1))$$;`);
const migration=fs.readFileSync('supabase/20261020_manual_primary_pair_readiness.sql','utf8');
assert.doesNotMatch(migration,/\b(update|insert into|delete from)\s+public\.(exceptions|recon_runs|daily_recon_jobs|manual_primary_results|manual_primary_case_items)\b/i);
await db.exec(migration);await db.exec(migration);

const primary=id(1),recheck=id(2),boFile=id(3),stmFile=id(4);
const stamp=[
 {id:boFile,physical:boFile,path:'bo.xlsx',company:'FR8',kind:'bo_main'},
 {id:stmFile,physical:stmFile,path:'pm.xlsx',company:'FR8',kind:'pm_statement'},
];
const report={quality:'passed'};
await db.query("select set_config('test.sources',$1,false)",[JSON.stringify(stamp)]);
await db.query("insert into daily_recon_jobs values('FR8','2026-10-19',false,'queued',null)");
await db.query('insert into account_recheck_jobs values($1,\'confirmed\',$2,\'ALL\',\'all\')',[recheck,report]);
await db.query("insert into manual_primary_results values($1,'FR8','2026-10-19',$2,null,$3,$4,now())",[primary,recheck,report,stamp]);
await db.query("insert into source_files values($1,'FR8','BO.xlsx',true,null,'bo_main','bo.xlsx'),($2,'FR8','PM.xlsx',true,null,'pm_statement','pm.xlsx')",[boFile,stmFile]);
await db.exec("insert into storage.objects values('bo.xlsx','audit-files'),('pm.xlsx','audit-files')");

const cases=[
 [id(6),'FR8-R-a962f2f2-006','missing_stm',100,null,'BO 100',null,{source_rows:{bo:{fileId:boFile,row:6}}}],
 [id(10),'FR8-R-a962f2f2-010','missing_bo',null,100,null,'STM 100',{source_rows:{stm:{fileId:stmFile,row:10}}}],
 [id(12),'FR8-R-a962f2f2-012','missing_stm',40,null,'BO 40 A',null,{source_rows:{bo:{fileId:boFile,row:12}}}],
 [id(13),'FR8-R-a962f2f2-013','missing_stm',40,null,'BO 40 B',null,{source_rows:{bo:{fileId:boFile,row:13}}}],
 [id(14),'FR8-R-a962f2f2-014','missing_bo',null,40,null,'STM 40 A',{source_rows:{stm:{fileId:stmFile,row:14}}}],
 [id(15),'FR8-R-a962f2f2-015','missing_bo',null,40,null,'STM 40 B',{source_rows:{stm:{fileId:stmFile,row:15}}}],
];
for(const [caseId,code,type,systemAmount,bankAmount,boRaw,stmRaw,details] of cases){
 await db.query("insert into exceptions values($1,'FR8','2026-10-19',null,null,'AUTOPEER','ฝาก','THB',$2,$3,$4,$5,$6,$7)",
  [caseId,type,systemAmount,bankAmount,boRaw,stmRaw,{...details,manual_primary_id:primary,code}]);
 await db.query('insert into manual_primary_case_items values($1,$2)',[primary,caseId]);
}
const ready=async(caseId,side)=>(await db.query('select manual_pair_scoped_source_ready($1,$2) ready',[caseId,side])).rows[0].ready;
for(const caseId of [id(6),id(12),id(13)])assert.equal(await ready(caseId,'BO'),true);
for(const caseId of [id(10),id(14),id(15)])assert.equal(await ready(caseId,'STM'),true);
await db.exec("delete from storage.objects where name='pm.xlsx'");assert.equal(await ready(id(10),'STM'),false,'missing stored evidence remains blocked');
await db.exec("insert into storage.objects values('pm.xlsx','audit-files');update daily_recon_jobs set status='running'");assert.equal(await ready(id(10),'STM'),false,'running scope remains blocked');
await db.exec("update daily_recon_jobs set status='queued'");await db.query("select set_config('test.sources',$1,false)",[JSON.stringify(stamp.slice(0,1))]);assert.equal(await ready(id(6),'BO'),false,'changed accepted source set remains blocked');
await db.query("select set_config('test.sources',$1,false)",[JSON.stringify([...stamp,{id:id(9),physical:id(9),path:'new.pdf',company:'FR8',kind:'stm_pdf'}])]);assert.equal(await ready(id(6),'BO'),true,'appended files do not invalidate accepted source rows');

const systemRun=id(20),systemFile=id(21),systemCase=id(22);
const coverage={source_parser_completion:true,bo_first:{complete:false,required:[{company:'FR8',identity:'AUTOPEER',direction:'deposit',rows:1,source_files:['SYS-BO.xlsx']}],received:[],missing:[]}};
await db.query('insert into recon_runs values($1,$2,$3)',[systemRun,coverage,[systemFile]]);
await db.query("insert into source_files values($1,'FR8','SYS-BO.xlsx',true,null,'bo_main','sys-bo.xlsx')",[systemFile]);
await db.exec("insert into storage.objects values('sys-bo.xlsx','audit-files');update daily_recon_jobs set status='needs_review',last_run_id='"+systemRun+"'");
await db.query("insert into exceptions values($1,'FR8','2026-10-19',$2,null,'AUTOPEER','ฝาก','THB','missing_stm',100,null,'SYSTEM BO',null,$3)",[systemCase,systemRun,{source_rows:{bo:{fileId:systemFile,row:1}}}]);
assert.equal(await ready(systemCase,'BO'),true,'existing system-run scoped readiness remains available');
assert.equal((await db.query("select has_function_privilege('authenticated','manual_pair_scoped_source_ready(uuid,text)','execute') allowed")).rows[0].allowed,false);
await db.close();
console.log('PASS manual-primary pair readiness: FR8 100/40 source rows allowed; storage, running, changed-source guards and legacy system path preserved. Synthetic PostgreSQL only.');
