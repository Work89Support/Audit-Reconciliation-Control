import fs from 'node:fs';import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);
const baseline=fs.readFileSync('tests/all-company-primary-handoff-db.test.mjs','utf8');
const setup=baseline.slice(baseline.indexOf('const db='),baseline.indexOf('const companies='));
const {db,id}=await new (Object.getPrototypeOf(async function(){}).constructor)('PGlite','fs',setup+';return {db,id};')(PGlite,fs);
const patch=fs.readFileSync('supabase/20261017_primary_bo_timing_projection.sql','utf8');
await db.exec(patch);await db.exec(patch);
const countsPatch=fs.readFileSync('supabase/20261017_primary_count_breakdown.sql','utf8');
await db.exec(countsPatch);await db.exec(countsPatch);
const payloadPatch=fs.readFileSync('supabase/20261017_primary_projection_bounded_payload.sql','utf8');
await db.exec(payloadPatch);await db.exec(payloadPatch);
const settings=(await db.query("select proconfig from pg_proc where oid='accept_manual_primary_with_cases(uuid,text,text,boolean)'::regprocedure")).rows[0].proconfig;
assert(settings.includes('statement_timeout=30s'));
assert(settings.includes('lock_timeout=5s'));
for(const [c,company] of ['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'].entries()){
 const date='2026-10-16',bo=id(100+c),request=id(200+c),run=id(300+c);
 const files=[{id:bo,physical_source_file_id:bo,company,business_date:date,kind:'bo_main',checksum:'immutable'}];
 const actual=i=>({company,business_date:date,account:i%2?'COREPAY':'AUTOPEER',direction:'ถอน',ex_type:'cross_day',system_amount:100,bank_amount:null,amount_diff:0,risk_amount:0,
 bo_raw:`${i} | 2026-10-15 23:58:00 | 2026-10-16 00:01:00 | ${id(500+i)} | TEST`,bo_date:date,bo_time:'00:01:00',
 customer_details:{source_rows:{bo:{fileId:bo,row:i+1},stm:null}}});
 const records=Array.from({length:9},(_,i)=>actual(i+1));
 for(const r of records.slice(0,3))r.business_date='2026-10-15';
 const exceptions=records.flatMap(r=>[r,{...structuredClone(r),bank_amount:100,stm_raw:'— ตรวจจากรายงานหลังบ้าน ไม่ต้องใช้ statement —',customer_details:{source_rows:{bo:null,stm:null}}}]);
 const report={quality:'passed',company,date,account:'ALL',direction:'all',bo_count:9,stm_count:0,matched:0,match_evidence:[],exceptions,summary:{waiting_bo:[]}};
 const legacy=(await db.query('select manual_primary_report_projection_rows($1) p',[JSON.stringify(report)])).rows[0].p;
 const projected=(await db.query('select manual_primary_report_projection($1) p',[JSON.stringify(report)])).rows[0].p;
 assert.deepEqual(projected,legacy,'bounded projection must be byte-for-byte JSON equivalent');
 if(company==='FR8'){
  const large={...structuredClone(report),match_evidence:Array.from({length:5000},(_,i)=>({bo:{fileId:bo,row:i+1},stm:{fileId:bo,row:i+5001},raw:'evidence'.repeat(200)})),summary:{...report.summary,full_evidence:'preserved'.repeat(1000000)},unknown_future_field:{preserved:true}};
  const expected=(await db.query('select manual_primary_report_projection_rows($1) p',[JSON.stringify(large)])).rows[0].p;
  const actual=(await db.query('select manual_primary_report_projection($1) p',[JSON.stringify(large)])).rows[0].p;
  assert.deepEqual(actual,expected,'large evidence, summary and future keys preserved exactly');
  assert.deepEqual(actual.match_evidence,large.match_evidence);
  assert.equal(actual.summary.full_evidence,large.summary.full_evidence);
 }
 assert.equal(projected.exceptions.length,9);assert.equal(projected.summary.bo_timing_annotation_count,9);assert.equal(projected.exceptions[0].bank_amount,null,'never fabricate STM from a BO-only warning');
 assert.equal(projected.summary.report_scope_correction_count,3);
 assert.equal(projected.exceptions[0].business_date,date);assert.equal(projected.exceptions[0].customer_details.original_business_date,'2026-10-15');
 assert.equal(projected.exceptions[0].customer_details.bo_timing_annotations[0].original_warning.bank_amount,100,'original warning retained separately');
 assert.deepEqual(projected.exceptions[0].customer_details.bo_timing_annotations[0].source_rows,records[0].customer_details.source_rows,'annotation links to the genuine physical row, not the empty original warning');
 assert.deepEqual((await db.query('select manual_primary_report_projection($1) p',[JSON.stringify(projected)])).rows[0].p,projected,'projection idempotent');
 await db.query('insert into test_manifest values($1,$2)',[company,JSON.stringify(files)]);
 await db.query("insert into daily_recon_jobs(id,company,business_date,status) values($1,$2,$3,'error')",[run,company,date]);
 await db.query("insert into account_recheck_jobs values($1,$2,$3,'ALL','all','account','confirmed',1,null,$4,$5,$6)",[request,company,date,JSON.stringify({effective_files:files}),[bo],JSON.stringify(report)]);
 await db.exec('set role authenticated');
 let p=(await db.query('select manual_primary_preview($1) p',[request])).rows[0].p;
 assert.equal(p.allowed,true,JSON.stringify(p));assert.equal(p.after.exception_count,9);assert.equal(p.bo_timing_annotation_count,9);assert.equal(p.report_scope_correction_count,3);
 assert.equal(p.raw_exception_count,18);assert.equal(p.actionable_exception_count,9);assert.equal(p.waiting_bo_count,0);
 await assert.rejects(db.query("select accept_manual_primary_with_cases($1,'stale','Read-only QA reason unchanged',true)",[request]),/เปลี่ยน/);
 // All writes below are isolated PGlite fixtures, never production.
 const applied=(await db.query("select accept_manual_primary_with_cases($1,$2,'Fixture explicit head confirmation',true) r",[request,p.token])).rows[0].r;
 assert.equal(applied.case_set.created,9);
 assert.equal((await db.query("select accept_manual_primary_with_cases($1,$2,'Fixture explicit head confirmation',true) r",[request,p.token])).rows[0].r.case_set.created,0);
 await db.exec('reset role');
 assert.deepEqual((await db.query('select result from account_recheck_jobs where id=$1',[request])).rows[0].result,report,'original report immutable');
 for(const [name,change] of [['ambiguous raw',r=>r.exceptions.push(structuredClone(r.exceptions[0]))],['wrong account',r=>r.exceptions[1].account='OTHER'],['unknown statement',r=>r.exceptions[1].stm_raw='unknown'],['missing real pointer',r=>r.exceptions[0].customer_details.source_rows.bo=null]]){
 const invalid=structuredClone(report);change(invalid);const x=(await db.query('select manual_primary_report_projection($1) p',[JSON.stringify(invalid)])).rows[0].p;
 assert(x.exceptions.some(e=>e.customer_details?.source_rows?.bo===null),name+' cannot invent a source pointer');
 await db.query('update account_recheck_jobs set result=$2 where id=$1',[request,JSON.stringify(invalid)]);
 await db.exec('set role authenticated');
 assert.equal((await db.query('select manual_primary_preview($1) p',[request])).rows[0].p.allowed,false,name+' must fail final preview');
 await db.exec('reset role');
 }
 await db.query('update account_recheck_jobs set result=$2 where id=$1',[request,JSON.stringify(report)]);
}
assert.equal((await db.query('select count(*) n from manual_primary_case_items')).rows[0].n,81);
console.log('PASS isolated DB: nine companies, real row linkage, 9 warnings retained not duplicated, immutable raw reports, no fabricated STM, strict ambiguity/missing-source rejection, atomic handoff and idempotency.');await db.close();
