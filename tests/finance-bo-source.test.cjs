const assert=require('node:assert/strict'),fs=require('node:fs'),S=require('../finance-bo-source.js');
const file={id:'10000000-0000-0000-0000-000000000001',company:'MR9',file_name:'MR9_BO_2000-01-01.xlsx'};
const records=[{rowNo:2,boDate:'2000-01-01',date:'2000-01-02',boSec:82800,sec:20,direction:'deposit',amount:100.68,memberCode:'customer-private',performedBy:'staff-not-user',channel:'AZPAY'},
 {rowNo:3,boDate:'2000-01-02',date:'2000-01-01',boSec:60,direction:'withdraw',amount:200,channel:'COREPAY'}];
const parse=()=>({company:'MR9',code:'bo_transaction_export',headerIdx:0,records,aux:[{}],dropped:{},warnings:[]});
const p=S.normalize(file,[['header']],parse,'2000-01-01');assert.equal(p.rows.length,1);assert.equal(p.rows[0].date,'2000-01-01');assert.equal(p.rows[0].sec,82800);assert.equal(p.rows[0].customer_user,'customer-private');assert.equal(p.meta.other_date_rows,1);assert.equal(p.meta.aux_rows,1);
assert.equal(S.normalize(file,{rows:[['header']],rowNumbers:[1,10,11]},parse,'2000-01-01').rows[0].row,10,'keep physical XLSX row reference');
assert.equal(p.otherRows[0].date,'2000-01-02');assert.equal(p.otherRows[0].row,3);assert.doesNotMatch(JSON.stringify(p.otherRows),/customer_user|performedBy/);
assert.doesNotMatch(JSON.stringify(p),/staff-not-user|performedBy|username/);assert.deepEqual(S.totals(p.rows),{count:1,deposit:100.68,withdraw:0,deposits:1,withdrawals:0});
assert.throws(()=>S.normalize(file,[],()=>({...parse(),dropped:{'ไม่มีเวลาที่อ่านได้':1}}),'2000-01-01'),/อ่านไม่ครบ/);
assert.doesNotThrow(()=>S.normalize(file,[['header'],['รวม']],()=>({...parse(),dropped:{'ไม่มีเวลาที่อ่านได้':1}}),'2000-01-01'));
assert.throws(()=>S.normalize(file,[],()=>({...parse(),company:'MC8'}),'2000-01-01'),/บริษัท/);
const sql=fs.readFileSync('supabase/20261016_finance_bo_source_reports.sql','utf8');
assert.doesNotMatch(sql,/\b(update|insert into|delete from|alter table|create trigger)\s+(?:public\.)?(daily_recon_jobs|recon_runs|exceptions|source_files|source_file_ocr|manual_primary_results|damages)\b/i);
assert.doesNotMatch(sql,/create or replace function public\.(finance_bo_window|finance_bo_aggregate|read_manual_primary|effective_audit_source_files)\b/);
console.log('PASS finance-only BO source: BO original day/time, explicit customer only, exact cents, unsupported/dropped data blocked, zero/footer accounting and no operational mutations.');
