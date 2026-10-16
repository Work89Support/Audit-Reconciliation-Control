const assert=require('node:assert/strict');
const live=require('../mc8-live-sheets.js'),schema=require('../mc8-sheet-schema.js'),primary=require('../manual-primary.js');
const raw='TEST-ref-1220 | 2026-10-15 23:58:56 | 2026-10-16 00:00:05 | COREPAY | withdraw | 1220 | TEST-member | TEST-auditor';
const actual={id:'qa-actual',code:'EX-3001',company:'FR8',business_date:'2026-10-15',account:'COREPAY',direction:'ถอน',status:'pending_next_day',ex_type:'cross_day',system_amount:1220,bank_amount:null,bo_date:'2026-10-16',bo_time:'00:00:05',bo_raw:raw,stm_raw:'',detail:'รายการข้ามวัน (BO กับธนาคารคนละวัน)',customer_details:{bo:{reference:'TEST-ref-1220',user:'TEST-member'},source_rows:{bo:{fileId:'00000000-0000-4000-8000-000000000001',row:3},stm:null}}};
const warning={id:'qa-warning',code:'EX-3002',company:'FR8',business_date:'2026-10-15',account:'COREPAY',direction:'ถอน',status:'open',ex_type:'cross_day',system_amount:1220,bank_amount:1220,bo_date:'2026-10-15',bo_time:'23:58:56',bo_raw:raw,stm_raw:'— ตรวจจากรายงานหลังบ้าน ไม่ต้องใช้ statement —',detail:'ระบบบันทึก 2026-10-15 23:58:56 แต่ธนาคารบันทึก 2026-10-16 00:00:05 — ต้องตรวจร่วมกับไฟล์วันถัดไป',customer_details:{source_rows:{bo:null,stm:null}}};
const data={run:{id:'qa-run',summary:{match_evidence:[]}},cases:[actual,warning],complete:true};
const before=JSON.stringify(data),rows=live.rowsOf(data,'FR8');
assert.equal(rows.length,1);assert.equal(rows[0].case.id,actual.id);assert.equal(rows[0].isPair,false);
assert.equal(rows[0].pmAmount,null,'a Rules amount is not evidence of an STM transaction');
assert.equal(rows[0].boAmount,1220);assert.equal(rows[0].relatedCrossDayWarnings[0].id,warning.id);
assert.equal(live.summarize(rows).pmCents,0);assert.equal(live.summarize(rows).boCents,122000);
assert.equal(live.summarize(rows).diffAfterCents,-122000);
assert.match(rows[0].reason,/EX-3002/);assert.match(live.auditStatus(rows[0],true),/ค้างรอ/);
const exported=live.buildAuditExportSheets(rows,'FR8','2026-10-15',true,schema);
assert.equal(exported[0].rows.length,1);assert.equal(exported[0].rows[0][exported[0].headers.indexOf('BO · ยอด')],1220);
assert.match(exported[0].rows[0].join(' | '),/คำเตือนข้ามวันประกอบรายการเดิม EX-3002/);
assert.equal(JSON.stringify(data),before,'no source, case, status, or report may be rewritten');
assert.equal(live.rowsOf({...data,cases:[warning,actual]}).length,1,'ordering does not affect folding');
for(const change of [{company:'MR9'},{account:'AUTOPEER'},{direction:'ฝาก'},{business_date:'2026-10-14'},
 {system_amount:1221},{bo_raw:raw+' | another real row'}, {bank_amount:1220},
 {customer_details:{source_rows:{bo:{fileId:'invalid',row:3},stm:null}}},
 {customer_details:{source_rows:{bo:{fileId:'00000000-0000-4000-8000-000000000001'},stm:null}}},
 {status:'closed'},{ex_type:'missing_stm'}]){
 assert.equal(live.rowsOf({...data,cases:[{...actual,...change},warning]}).length,2,'unproved target must not hide a warning: '+JSON.stringify(change));
}
for(const change of [{stm_raw:'actual STM record'},{bank_amount:null},{bank_amount:1000},{ex_type:'manual_review'},
 {customer_details:{source_rows:{bo:{fileId:'00000000-0000-4000-8000-000000000001',row:4},stm:null}}},
 {status:'closed'},{bo_raw:'1220'}]){
 assert.equal(live.rowsOf({...data,cases:[actual,{...warning,...change}]}).length,2,'real or unproved warning remains visible');
}
assert.equal(live.rowsOf({...data,cases:[actual,{...actual,id:'qa-second',customer_details:{source_rows:{bo:{fileId:'00000000-0000-4000-8000-000000000001',row:4},stm:null}}},warning]}).length,3,'ambiguous identical BO raw on distinct physical rows must not be merged');
const v={id:'qa-primary',company:'FR8',business_date:'2026-10-15',base_run_id:'qa-run',report:{exceptions:[actual,warning],match_evidence:[],summary:{}}};
assert.equal(live.rowsOf({run:primary.run(v),cases:primary.cases(v),primaryResult:v},'FR8').length,1,'accepted manual reports share the same display/export policy');
console.log('PASS cross-day Rules notices: exact unique BO raw + physical source, one financial row, unchanged history/status, no false STM, consistent Excel, and fail-closed ambiguity tests.');
