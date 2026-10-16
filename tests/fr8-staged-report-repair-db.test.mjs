import fs from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);const db=new PGlite();
const sql=fs.readFileSync('supabase/repairs/20261016_fr8_oct15_staged_report.sql','utf8');
await db.exec(sql.slice(0,sql.indexOf('-- BEGIN STAGING')));
const source={fileId:'00000000-0000-4000-8000-000000000001',row:3};
const raw='TEST-1220 | 2026-10-15 23:58:56 | 2026-10-16 00:00:05 | COREPAY | withdraw | 1220 | TEST-user';
const actual={company:'FR8',business_date:'2026-10-16',ex_type:'cross_day',direction:'ถอน',account:'COREPAY',system_amount:1220,bank_amount:null,bo_date:'2026-10-16',bo_time:'00:00:05',bo_raw:raw,customer_details:{source_rows:{bo:source,stm:null}}};
const notice={...actual,bank_amount:1220,bo_date:'2026-10-15',bo_time:'23:58:56',stm_raw:'— ตรวจจากรายงานหลังบ้าน ไม่ต้องใช้ statement —',detail:'Original Rules warning',customer_details:{source_rows:{bo:null,stm:null}}};
const r={company:'FR8',business_date:'2026-10-15',account:'ALL',direction:'all',quality:'passed',stm_count:0,bo_count:1,matched:0,match_evidence:[],exceptions:[actual,notice],summary:{waiting_bo:[{amount:15,boSource:{...source,row:4}}]}};
const repair=async value=>(await db.query("select pg_temp.repair_fr8_report($1,'2026-10-15') r",[JSON.stringify(value)])).rows[0].r;
const before=JSON.stringify(r);let out=await repair(r);assert.equal(JSON.stringify(r),before);
assert.equal(out.exceptions.length,1);assert.equal(out.exception_count,2);assert.equal(out.exceptions[0].business_date,'2026-10-15');
for(const k of ['bo_date','bo_time','bo_raw','system_amount','bank_amount'])assert.deepEqual(out.exceptions[0][k],actual[k]);
assert.deepEqual(out.exceptions[0].customer_details.source_rows,actual.customer_details.source_rows);
assert.deepEqual(out.summary.waiting_bo,r.summary.waiting_bo);assert.deepEqual(out.match_evidence,r.match_evidence);
assert.deepEqual(out.summary.report_repair.rules_annotations[0].original_warning,notice);
assert.equal(out.summary.report_repair.rules_annotations[0].bo_source.row,3);
assert.equal(out.summary.report_repair.scope_changes.length,1);
assert.equal(out.summary.report_repair.primary_accepted,false);assert.equal(out.summary.report_repair.cases_created,0);
assert.equal((await repair({...r,exceptions:[notice,actual]})).exceptions.length,1);
for(const change of [
 x=>x.company='MR9',x=>delete x.company,x=>delete x.exceptions,x=>x.exceptions[1].bo_raw+=' different',
 x=>x.exceptions[1].bank_amount=1230,x=>x.exceptions[0].account='AUTOPEER',
 x=>x.exceptions[0].customer_details.source_rows.bo.fileId='invalid',
 x=>delete x.exceptions[0].customer_details.source_rows.bo.row,
 x=>x.exceptions[0].business_date='2026-10-17',x=>x.exceptions[0].bo_date='2026-10-14',
 x=>x.exceptions.push(structuredClone(x.exceptions[0])),x=>x.exceptions.push(structuredClone(x.exceptions[1])),
 x=>x.exceptions[1].stm_raw='Real STM must not be converted',
 ]){const value=structuredClone(r);change(value);await db.exec('savepoint negative');await assert.rejects(repair(value));await db.exec('rollback to savepoint negative');}
await db.exec('rollback');
assert.doesNotMatch(sql,/\b(update|delete\s+from)\s+public\.(exceptions|recon_runs|manual_primary_results|source_files|account_review_holds)\b/i);
assert.doesNotMatch(sql,/\b(accept_manual_primary|activate_manual_primary_cases)\s*\(/);
console.log('PASS FR8 staged repair: exact unique source identity, preserved transactions/warnings/waiting rows, report-day only, ambiguous/unproved rows rejected, no acceptance or case writes.');
await db.close();
