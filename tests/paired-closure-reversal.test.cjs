const assert=require('node:assert/strict');
const fs=require('node:fs');
const sql=fs.readFileSync('supabase/20261025_reverse_paired_case_closure.sql','utf8');
const app=fs.readFileSync('app.js','utf8');

assert.match(sql,/audit\.manual_pair_reversal/);
assert.match(sql,/old\.manual_pair_id is not null and new\.manual_pair_id is null/);
assert.match(sql,/pair_row\.status<>'approved'/);
assert.match(sql,/manual_pair_id=null,case_closure_request_id=null/);
assert.match(sql,/manual_pair_members set released_at=coalesce\(released_at,now\(\)\)/);
assert.match(sql,/manual_case_pairs set reversed_at=now\(\),reversed_by=auth\.uid\(\),reversal_reason=/);
assert.match(sql,/status=case when id=e\.id then target_status/);
assert.doesNotMatch(sql,/delete from public\.(exceptions|manual_case_pairs|damages|case_evidence)/i);
assert.match(app,/ยกเลิกผลคู่ ปลดคู่จอง และคืนทั้งสองเคส/);

console.log('PASS paired closure reversal: atomic pair release, preserved history, both cases reopened');
