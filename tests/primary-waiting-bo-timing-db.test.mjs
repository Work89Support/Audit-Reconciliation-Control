import fs from 'node:fs';import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);
const baseline=fs.readFileSync('tests/all-company-primary-handoff-db.test.mjs','utf8');
const setup=baseline.slice(baseline.indexOf('const db='),baseline.indexOf('const companies='));
const {db,id}=await new (Object.getPrototypeOf(async function(){}).constructor)('PGlite','fs',setup+';return {db,id};')(PGlite,fs);
for(const name of ['20261017_primary_bo_timing_projection.sql','20261017_primary_count_breakdown.sql','20261017_primary_projection_bounded_payload.sql','20261018_primary_waiting_bo_timing_projection.sql'])await db.exec(fs.readFileSync('supabase/'+name,'utf8'));
await db.exec(fs.readFileSync('supabase/20261018_primary_waiting_bo_timing_projection.sql','utf8'));
const project=async r=>(await db.query('select manual_primary_report_projection($1) p',[JSON.stringify(r)])).rows[0].p;
for(const [i,company]of ['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'].entries()){
 const file=id(100+i),request=id(200+i),run=id(300+i),ref=id(400+i),date='2026-10-17';
 const raw=`1023 | 2026-10-16 22:35:42 | 2026-10-17 02:17:00 | ${ref} | TEST`;
 const w={company,date,account:'999999999999',direction:'withdraw',type:'missing_stm',status:'waiting_source',systemAmount:50000,bankAmount:null,riskAmount:0,amountDiff:0,boDate:date,boTime:'02:17:00',boRaw:raw,boSource:{fileId:file,row:1024},stmSource:null,customerDetails:{bo:{reference:ref},stm:null}};
 const warning={company,business_date:date,account:w.account,direction:'ถอน',ex_type:'cross_day',system_amount:50000,bank_amount:50000,risk_amount:0,amount_diff:0,bo_date:'2026-10-16',bo_time:'22:35:42',bo_raw:raw,stm_raw:'— ตรวจจากรายงานหลังบ้าน ไม่ต้องใช้ statement —',customer_details:{source_rows:{bo:null,stm:null}}};
 const report={company,business_date:date,account:'ALL',direction:'all',quality:'passed',bo_count:1,stm_count:0,matched:0,match_evidence:[],exceptions:[warning],summary:{waiting_bo:[w]},untouched:{history:'keep'}};
 const before=JSON.stringify(report),p=await project(report);
 assert.equal(JSON.stringify(report),before);assert.equal(p.exceptions.length,0);assert.equal(p.summary.waiting_bo.length,1);
 assert.equal(p.summary.bo_timing_annotation_count,1);assert.equal(p.summary.original_exception_count,1);
 const annotated=p.summary.waiting_bo[0],a=annotated.customerDetails.bo_timing_annotations[0];
 assert.deepEqual(a.original_warning,warning);assert.deepEqual(a.source_rows,{bo:w.boSource,stm:null});
 const stripped=structuredClone(annotated);delete stripped.customerDetails.bo_timing_annotations;assert.deepEqual(stripped,w,'original waiting amounts/status/time/source must remain exact');
 assert.deepEqual(await project(p),p,'projection is idempotent, no repeated annotations');assert.deepEqual(p.untouched,report.untouched);
 const files=[{id:file,physical_source_file_id:file,company,business_date:date,kind:'bo_main',checksum:'BO-original'}];
 await db.query('insert into test_manifest values($1,$2)',[company,JSON.stringify(files)]);
 await db.query("insert into daily_recon_jobs(id,company,business_date,status) values($1,$2,$3,'error')",[run,company,date]);
 await db.query("insert into account_recheck_jobs values($1,$2,$3,'ALL','all','account','confirmed',1,null,$4,$5,$6)",[request,company,date,JSON.stringify({effective_files:files}),[file],JSON.stringify(report)]);
 await db.exec('set role authenticated');
 const preview=(await db.query('select manual_primary_preview($1) p',[request])).rows[0].p;
 assert.equal(preview.allowed,true,JSON.stringify(preview));assert.equal(preview.raw_exception_count,1);assert.equal(preview.actionable_exception_count,0);assert.equal(preview.waiting_bo_count,1);
 // Materialization tests are confined to this isolated database.
 const accepted=(await db.query("select accept_manual_primary_with_cases($1,$2,'Synthetic reviewed source test only',true) r",[request,preview.token])).rows[0].r;
 assert.equal(accepted.case_set.created,1);assert.equal((await db.query("select accept_manual_primary_with_cases($1,$2,'Synthetic reviewed source test only',true) r",[request,preview.token])).rows[0].r.case_set.created,0);
 const e=(await db.query('select e.* from exceptions e join manual_primary_case_items i on i.exception_id=e.id where i.primary_id=$1',[accepted.id])).rows[0];
 assert.equal(Number(e.system_amount),50000);assert.equal(e.bank_amount,null);assert.deepEqual(e.customer_details.bo_timing_annotations[0].original_warning,warning);
 await db.exec('reset role');
 assert.deepEqual((await db.query('select result from account_recheck_jobs where id=$1',[request])).rows[0].result,report);
 for(const [name,change]of [
 ['foreign company',r=>r.summary.waiting_bo[0].company='FOREIGN'],['different account',r=>r.summary.waiting_bo[0].account='OTHER'],
 ['different raw',r=>r.summary.waiting_bo[0].boRaw+=' changed'],['different amount',r=>r.summary.waiting_bo[0].systemAmount=49999],
 ['different date',r=>r.summary.waiting_bo[0].date='2026-10-18'],['different direction',r=>r.summary.waiting_bo[0].direction='deposit'],
 ['wrong transaction reference',r=>r.summary.waiting_bo[0].customerDetails.bo.reference=id(999)],['missing physical file',r=>delete r.summary.waiting_bo[0].boSource.fileId],
 ['zero physical row',r=>r.summary.waiting_bo[0].boSource.row=0],['unproven row',r=>delete r.summary.waiting_bo[0].boSource.row],
 ['ambiguous waiting item',r=>r.summary.waiting_bo.push(structuredClone(r.summary.waiting_bo[0]))],['duplicate warning',r=>r.exceptions.push(structuredClone(r.exceptions[0]))],
 ['real STM',r=>r.exceptions[0].stm_raw='Actual bank statement'],['warning points elsewhere',r=>r.exceptions[0].customer_details.source_rows.bo={fileId:id(999),row:9}],
 ['actual risk',r=>r.exceptions[0].risk_amount=50000],['STM exists',r=>r.summary.waiting_bo[0].bankAmount=50000],
 ['different BO bank time',r=>r.summary.waiting_bo[0].boTime='02:18:00']
 ]){
  const bad=structuredClone(report);change(bad);const out=await project(bad);assert.equal(out.exceptions.length,bad.exceptions.length,name+' must not silently hide a finding');
 }
}
assert.equal((await db.query('select count(*) n from manual_primary_case_items')).rows[0].n,9);
console.log('PASS isolated waiting-BO projection: nine companies; exact unique physical row; original warning retained; immutable reports/amounts; no fabricated STM; 17 ambiguity/identity/source negatives; one case not two; idempotent handoff. No production acceptance.');
await db.close();
