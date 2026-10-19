import fs from 'node:fs';import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);
const baseline=fs.readFileSync('tests/all-company-primary-handoff-db.test.mjs','utf8');
const setup=baseline.slice(baseline.indexOf('const db='),baseline.indexOf('const companies='));
const {db,id}=await new (Object.getPrototypeOf(async function(){}).constructor)('PGlite','fs',setup+';return {db,id};')(PGlite,fs);
await db.exec(`create or replace function manual_primary_report_projection(j jsonb) returns jsonb language sql immutable as $$select j||'{"review_projection":"display-only"}'::jsonb$$;`);
const patch=fs.readFileSync('supabase/20261019_verified_statement_coverage.sql','utf8');await db.exec(patch);await db.exec(patch);
const company='SK8',date='2026-10-17',bo=id(10),old=id(11),latest=id(12),run=id(13),prior=id(14),request=id(15);
const files=[{id:bo,physical_source_file_id:bo,company,business_date:date,kind:'bo_main',checksum:'BO',storage_etag:'b'},
 {id:old,physical_source_file_id:old,company,business_date:date,kind:'stm_pdf',checksum:'OLD',storage_etag:'o'},
 {id:latest,physical_source_file_id:latest,company,business_date:'2026-10-18',kind:'stm_pdf',checksum:'NEW',storage_etag:'n'}];
await db.query('insert into test_manifest values($1,$2)',[company,JSON.stringify(files)]);
await db.query('insert into recon_runs values($1,$2,$3,1,1,1,0)',[run,company,date]);
await db.query("insert into daily_recon_jobs(id,company,business_date,last_run_id,status) values($1,$2,$3,$4,'completed')",[id(16),company,date,run]);
const stamps=(await db.query('select manual_primary_sources($1) s',[JSON.stringify(files)])).rows[0].s;
// Supply real-looking immutable storage ETags through the production stamp schema.
for(const s of stamps)s.etag=s.id===old?'old-etag':s.id===latest?'new-etag':'bo-etag';
const oldStamp=stamps.find(x=>x.id===old),newStamp=stamps.find(x=>x.id===latest);
const row=(n,d,amount,balance)=>({row:n,date:d,account:'SYNTHETIC-BBL',direction:'withdraw',amount,balance,detail:'TRF TO OTH BK',via:'mPhone'});
const oldRows=[row(1,'2026-10-16',20,120),row(2,date,100,20)],newRows=[...oldRows,row(3,date,2,18)];
const pair=(file,n,amount,boRow)=>({account:'SYNTHETIC-BBL',direction:'withdraw',amount,stmAmount:amount,boAmount:amount,stm:{fileId:file,row:n,date},bo:{fileId:bo,row:boRow,date}});
const priorReport={quality:'passed',match_evidence:[pair(old,2,100,1)]};
await db.query("insert into manual_primary_results(id,company,business_date,recheck_id,base_run_id,report,source_stamp,accepted_by,reason) values($1,$2,$3,$4,$5,$6,$7,$8,'Original approved synthetic statement')",[prior,company,date,id(17),run,JSON.stringify(priorReport),JSON.stringify([oldStamp]),id(1)]).catch(async err=>{
 // recheck_id FK must be satisfied using the normal isolated fixture relation.
 if(err.code!=='23503')throw err;
 await db.query("insert into account_recheck_jobs(id,company,business_date) values($1,$2,$3)",[id(17),company,date]);
 await db.query("insert into manual_primary_results(id,company,business_date,recheck_id,base_run_id,report,source_stamp,accepted_by,reason) values($1,$2,$3,$4,$5,$6,$7,$8,'Original approved synthetic statement')",[prior,company,date,id(17),run,JSON.stringify(priorReport),JSON.stringify([oldStamp]),id(1)]);
});
const report={quality:'passed',company,date,account:'ALL',direction:'all',bo_count:2,stm_count:2,matched:2,match_evidence:[pair(latest,2,100,1),pair(latest,3,2,2)],exceptions:[],summary:{waiting_bo:[]}};
const makeJob=async req=>db.query("insert into account_recheck_jobs values($1,$2,$3,'ALL','all','account','confirmed',1,$4,$5,$6,$7)",[req,company,date,run,JSON.stringify({effective_files:files}),[bo,latest],JSON.stringify(report)]);
await makeJob(request);
// Owner-recorded technical verification is not available to ordinary authenticated clients.
const record=async(req,rows=oldRows,newR=newRows)=>db.query("insert into manual_statement_coverage_reviews(recheck_id,prior_primary_id,company,business_date,old_file_id,new_file_id,old_stamp,new_stamp,result_hash,old_sha256,new_sha256,old_rows,new_rows,note) select id,$2,company,business_date,$3,$4,$5,$6,md5(result::text),repeat('a',64),repeat('b',64),$7,$8,'Independently compared complete synthetic statement rows and balances' from account_recheck_jobs where id=$1",[req,prior,old,latest,JSON.stringify(oldStamp),JSON.stringify(newStamp),JSON.stringify(rows),JSON.stringify(newR)]);
const covered=async(req=request,f=oldStamp,s=stamps)=>(await db.query('select manual_statement_covered(q,$2,$3) yes from account_recheck_jobs q where id=$1',[req,JSON.stringify(f),JSON.stringify(s)])).rows[0].yes;
assert.equal(await covered(),false);await record(request);assert.equal(await covered(),true);
const projected=(await db.query(`select manual_statement_covered(jsonb_populate_record(null::account_recheck_jobs,to_jsonb(q)||jsonb_build_object('result',manual_primary_report_projection(q.result))),$2,$3) yes from account_recheck_jobs q where id=$1`,[request,JSON.stringify(oldStamp),JSON.stringify(stamps)])).rows[0].yes;
assert.equal(projected,true,'normal reviewed display projection still binds the original immutable result hash');
const tampered=(await db.query(`select manual_statement_covered(jsonb_populate_record(null::account_recheck_jobs,to_jsonb(q)||jsonb_build_object('result',q.result||'{"fake":true}'::jsonb)),$2,$3) yes from account_recheck_jobs q where id=$1`,[request,JSON.stringify(oldStamp),JSON.stringify(stamps)])).rows[0].yes;
assert.equal(tampered,false,'arbitrary projected report cannot reuse technical verification');
for(const [i,change]of [x=>x[0].balance++,x=>x.pop(),x=>x[0].direction='deposit',x=>x[0].amount++,x=>x[1].row=1].entries()){
 const req=id(100+i);await makeJob(req);const n=structuredClone(newRows);change(n);await record(req,oldRows,n);assert.equal(await covered(req),false);
}
assert.equal(await covered(request,{...oldStamp,etag:'changed'}),false);
assert.equal(await covered(request,oldStamp,stamps.map(x=>x.id===latest?{...x,etag:'changed'}:x)),false);
await db.query("update account_recheck_jobs set result=jsonb_set(result,'{match_evidence,0,stm,row}','99') where id=$1",[request]);assert.equal(await covered(),false);
await db.query('update account_recheck_jobs set result=$2 where id=$1',[request,JSON.stringify(report)]);
await db.query("update account_recheck_jobs set status='ready' where id=$1",[request]);assert.equal(await covered(),false);
await assert.rejects(db.query('update manual_statement_coverage_reviews set note=note'),/append-only/);
await assert.rejects(db.query('delete from manual_statement_coverage_reviews'),/append-only/);
await db.exec('set role authenticated');await assert.rejects(db.query('insert into manual_statement_coverage_reviews(id) values($1)',[id(500)]),/permission denied/);
const preview=(await db.query("select pg_get_functiondef('manual_primary_preview(uuid)'::regprocedure) d")).rows[0].d;
assert(preview.includes('public.manual_statement_covered(q,f,stamp)'));
for(const gate of ['stamp<>public.manual_primary_sources(q.snapshot',"q.result->>'quality'",'public.current_app_role()','ไฟล์ที่เลือกไม่ครอบคลุม'])assert(preview.includes(gate));
console.log('PASS verified statement coverage: no proof fails closed; all old rows/balances/multiplicity; current physical stamps; exact unchanged result; real day/file/row/amount pointers; confirmed quality; append-only owner records; existing approval/source/coverage guards retained.');await db.close();
