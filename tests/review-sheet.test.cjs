const assert=require('node:assert/strict');
const {sheetRow,sheetHeaders,auditLabel}=require('../review-overview.js');
const pair={pair:{amount:100,stmAmount:100,bo:{date:'2026-09-08',sec:180},stm:{date:'2026-09-08',sec:240},customer:{bo:{user:'demo-user'},stm:{last4:'1234',bank:'GSB'}},timeDifferenceSeconds:60},account:'SCB-company',direction:'deposit'};
assert.equal(sheetRow(pair).length,sheetHeaders.length);
assert.equal(auditLabel(pair),'ยังไม่ยืนยันโดย Audit');
assert.equal(sheetRow(pair)[10],'User: demo-user');
assert.equal(sheetRow(pair)[9],''); // Customer bank must not copy company bank.
assert.equal(sheetRow({...pair,direction:'unknown'})[4],'ไม่ระบุประเภท');
assert.equal(auditLabel({case:{status:'answered'}}),'รอตรวจคำตอบ');
console.log('Sheet fields and independent audit states passed');
