const fs=require('node:fs');
const assert=require('node:assert/strict');
const app=fs.readFileSync('app.js','utf8');
const docs=fs.readFileSync('docs.js','utf8');
const migration=fs.readFileSync('supabase/20261103_return_clarification_request_receipt.sql','utf8');

assert.match(app,/data-open-ex="\$\{h\(e\.id\)\}">\$\{h\(caseLabel\(e\)\)\}/,'tracking keeps UUID as action key and shows the scoped case number');
assert.match(app,/data-ex="\$\{h\(e\.id\)\}">\$\{h\(caseLabel\(e\)\)\}/,'case lists keep UUID as action key and show the scoped case number');
assert.match(app,/displayCase: caseLabel\(item\)/,'request documents receive the readable case number');
assert.match(app,/displayCase: caseLabel\(e\)/,'clarification documents receive the readable case number');
assert.match(docs,/e\.displayCase \|\| e\.code \|\| e\.id/,'documents prefer the readable case number');
assert.match(migration,/clarification_return_receipt_v2/);
assert.match(migration,/new\.requested_at:=coalesce\(old\.requested_at,transaction_timestamp\(\)\)/);
assert.match(migration,/e\.status='clarifying' and e\.requested_at is null/,'existing invisible returned cases are repaired narrowly');
assert.match(migration,/preserved_financial_data/);
console.log('PASS returned clarification visibility and readable case labels');
