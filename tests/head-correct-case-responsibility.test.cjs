const assert=require('node:assert/strict'),fs=require('node:fs');
const sql=fs.readFileSync('supabase/20261023_head_correct_case_responsibility.sql','utf8');

for(const token of [
  "role_value not in ('lead','admin')",
  'case_responsibility_correct',
  'old_employee',
  'old_shift',
  'for update',
  'public.close_document_case(p_id,p_case,p_outcome,p_amount,p_reason,p_category)',
  "p_outcome<>'damage'",
  "p_category<>'employee'"
]) assert.ok(sql.includes(token),token);

assert.match(sql,/responsibility_changed[\s\S]*role_value not in \('lead','admin'\)/);
assert.match(sql,/update public\.exceptions[\s\S]*employee=btrim\(p_employee\),shift=btrim\(p_shift\)/);
assert.doesNotMatch(sql,/update public\.exceptions set (system_amount|bank_amount|risk_amount|status|case_closure_request_id)/);
assert.doesNotMatch(sql,/delete from/i);
console.log('Head responsibility correction: role guard, atomic close and audit history contracts passed');
