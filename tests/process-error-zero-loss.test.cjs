const assert=require('node:assert/strict'),fs=require('node:fs');
const ui=fs.readFileSync('case-closure.js','utf8');
const sb=fs.readFileSync('supabase.js','utf8');
const summary=fs.readFileSync('damage-summary.js','utf8');
const sql=fs.readFileSync('supabase/20261024_process_error_zero_loss.sql','utf8');
const compat=fs.readFileSync('supabase/20261026_process_error_close_rpc_compat.sql','utf8');

for(const text of [
  '2. ความเสียหาย 0 บาท / แต่มีการทำงานผิดพลาด',
  'closureProcessEmployee','closureProcessShift','closureProcessChecked',
  'submitProcessErrorCase','decideProcessErrorCase','closeProcessErrorCase'
])assert.ok(ui.includes(text)||sb.includes(text),text);
assert.match(ui,/outcome==='process_error'.*amount=outcome==='damage'\?Number\(raw\):0/s);
assert.ok(summary.includes('process_error:v1'));
for(const text of [
  "outcome in ('no_loss','process_error','damage')",
  'responsible_employee','responsible_shift',
  'submit_process_error_case','decide_process_error_case','close_process_error_case',
  "0,'THB',1,0,'[damage:v2:employee] [process_error:v1] '",
  "'บันทึกข้อสังเกต','ไม่ต้องเรียกเก็บ'"
])assert.ok(sql.includes(text),text);
assert.doesNotMatch(sql,/update public\.damages set/);
assert.match(ui,/outcome==='process_error'\s*\?\{p_id:id,p_case:e\.dbId,p_reason:reason,p_employee:processResponsibility\.employee,p_shift:processResponsibility\.shift\}/);
for(const text of [
  'p_outcome text','p_amount numeric','p_category text',
  "p_outcome is distinct from 'process_error'",
  'p_amount is distinct from 0','p_category is not null',
  'return public.close_process_error_case(p_id,p_case,p_reason,p_employee,p_shift)',
  "notify pgrst,'reload schema'"
])assert.ok(compat.includes(text),text);
console.log('Process error zero-loss: explicit outcome, responsibility, audit trail and non-collection register row');
