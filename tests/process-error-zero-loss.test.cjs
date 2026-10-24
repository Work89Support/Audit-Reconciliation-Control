const assert=require('node:assert/strict'),fs=require('node:fs');
const ui=fs.readFileSync('case-closure.js','utf8');
const sb=fs.readFileSync('supabase.js','utf8');
const summary=fs.readFileSync('damage-summary.js','utf8');
const sql=fs.readFileSync('supabase/20261024_process_error_zero_loss.sql','utf8');

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
console.log('Process error zero-loss: explicit outcome, responsibility, audit trail and non-collection register row');
