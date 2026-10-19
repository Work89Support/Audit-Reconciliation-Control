const fs=require('node:fs'),assert=require('node:assert/strict'),ui=require('../file-run-management.js');
const companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
for(const company of companies){const files=['bo_main','bo_main','stm_pdf',...Array(6).fill('pm_statement')].map((kind,i)=>({id:company+i,kind}));const selected=new Set(files.map(f=>f.id));assert.equal(ui.selectionSummary(files,selected),'เลือกใช้ตรวจ 9 ไฟล์ · BO 2 · STM 1 · PM 6 — ยังไม่รัน');selected.delete(company+3);assert.match(ui.selectionSummary(files,selected),/8 ไฟล์.*PM 5/);}
const css=fs.readFileSync('styles.css','utf8'),client=fs.readFileSync('file-run-management.js','utf8'),app=fs.readFileSync('app.js','utf8'),sb=fs.readFileSync('supabase.js','utf8');
assert.match(css,/#modal:has\(#fileRunManagementPanel\).*1180px/);assert.match(css,/file-run-table-scroll\{overflow-x:auto/);assert.match(css,/white-space:normal!important;overflow-wrap:anywhere/);
assert.match(client,/ค้นไฟล์จากวัน\/บริษัทอื่น/);assert.match(client,/เพิ่มไฟล์จากเครื่อง/);assert.match(client,/expectedRevision:f.revision/);assert.match(client,/originCompany/);assert.match(client,/ถัดไป: ทบทวนรันมือ/);assert.match(client,/opts\.onRun\(\[\.\.\.selected\]\)/);
assert.match(app,/searchSources:Sb.effectiveAuditFiles,addSource:Sb.addAuditManualSource/);assert.match(sb,/fileRunManagement,effectiveAuditFiles/);
assert.doesNotMatch(client,/accept_manual_primary|submit_clarification|close_exception/);
console.log('PASS wide file workflow: all nine company counts, bounded horizontal table, wrap long names, explicit source-date/company review, upload permissions, selection alone never runs or changes cases');
