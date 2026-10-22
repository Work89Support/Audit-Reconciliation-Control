const assert=require('node:assert/strict'),fs=require('node:fs');
const ui=fs.readFileSync('case-closure.js','utf8');
const sb=fs.readFileSync('supabase.js','utf8');
const sql=fs.readFileSync('supabase/20261022_direct_employee_damage_close.sql','utf8');

for(const token of ['closureResponsibilityFields','closureEmployee','closureShift','closureResponsibilityChecked','closeDocumentCaseWithResponsibility'])assert.ok(ui.includes(token),token);
assert.match(ui,/missingResponsibility\(responsibility\.employee\).*missingResponsibility\(responsibility\.shift\)/s);
assert.match(sb,/rpc\/close_document_case_with_responsibility/);
assert.match(sb,/e\.employee!==body\.p_employee\|\|e\.shift!==body\.p_shift/);
for(const token of ['for update','p_outcome<>\'damage\'','p_category<>\'employee\'','case_responsibility_confirm','public.close_document_case(p_id,p_case,p_outcome,p_amount,p_reason,p_category)'])assert.ok(sql.includes(token),token);
assert.doesNotMatch(sql,/update public\.exceptions set (system_amount|bank_amount|risk_amount|status|case_closure_request_id)/);
assert.match(sql,/coalesce\(btrim\(e\.employee\).*btrim\(e\.employee\)<>btrim\(p_employee\)/s);
assert.match(sql,/coalesce\(btrim\(e\.shift\).*btrim\(e\.shift\)<>btrim\(p_shift\)/s);
console.log('Direct employee damage close: evidence-confirmed identity and close remain atomic');
