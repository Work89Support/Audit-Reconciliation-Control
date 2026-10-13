const assert=require('node:assert/strict'),fs=require('node:fs'),m=require('../clarification-flow.js');
assert.equal(m.canRespond('clarifying','shift_lead'),true);assert.equal(m.canRespond('answered','shift_lead'),true);
for(const status of ['closed','damage','open','approved','pair_pending'])assert.equal(m.canRespond(status,'shift_lead'),false);
assert.match(m.draftMarkup({file_name:'<script>bad</script>'}),/ยังไม่ได้ส่ง/);assert.doesNotMatch(m.draftMarkup({file_name:'<script>bad</script>'}),/<script>/);
assert.match(m.historyMarkup([{text:'ข้อความเดิม',label:'เลือกไฟล์',actor_name:'ผู้ชี้แจง',file_name:'proof.pdf'}],()=> 'เวลาไทย'),/ข้อความเดิม/);
const app=fs.readFileSync('app.js','utf8'),pick=app.slice(app.indexOf("if(state.role==='shift_lead'){",app.indexOf("list.querySelectorAll('[data-link-mail]').forEach(b=>b.onclick")),app.indexOf('b.disabled=true;',app.indexOf("list.querySelectorAll('[data-link-mail]').forEach(b=>b.onclick")));
assert.match(pick,/_clarificationDraftFile=file/);assert.doesNotMatch(pick,/Sb\.(manualMatch|link|submit)/);assert.match(app,/submitClarificationWithFile/);
const sql=fs.readFileSync('supabase/20261013_clarification_submit_flow.sql','utf8');assert.match(sql,/for update/);assert.match(sql,/previous_response_text/);assert.match(sql,/storage.objects/);assert.doesNotMatch(sql,/delete from|system_amount\s*=|bank_amount\s*=|status='closed'/);
console.log('PASS clarification flow: draft file selection has no server mutation, escaped legacy history, atomic submit and no closure/financial writes.');
