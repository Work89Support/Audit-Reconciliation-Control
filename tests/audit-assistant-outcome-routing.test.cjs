const assert=require('node:assert/strict');
const fs=require('node:fs');

const ui=fs.readFileSync('case-closure.js','utf8');

assert.match(ui,/directForOutcome=outcome=>baseDirect&&!\(state\.role==='audit_assistant'&&outcome!=='no_loss'\)/);
assert.doesNotMatch(ui,/querySelector\('option\[value="process_error"\]'\)\.disabled=true/);
assert.doesNotMatch(ui,/querySelector\('option\[value="damage"\]'\)\.disabled=true;\s*\}\s*if\(state\.role==='audit_assistant'/);
assert.match(ui,/ผู้ช่วยปิดตรงได้เฉพาะผลข้อ 1/);
assert.match(ui,/ส่วนข้อ 2 และ 3 เลือกและบันทึกผลได้ แต่ระบบจะส่งหัวหน้าตรวจอนุมัติก่อนปิดเคส/);
assert.match(ui,/direct=directForOutcome\(\$\('#closureOutcome'\)\.value\)/);
assert.match(ui,/outcome==='process_error'\?\(direct\?Sb\.closeProcessErrorCase:Sb\.submitProcessErrorCase\)/);
assert.match(ui,/direct\?Sb\.closeDocumentCase:Sb\.submitCaseClosure/);

console.log('Audit assistant outcomes: options 2-3 remain selectable and route to head approval');
