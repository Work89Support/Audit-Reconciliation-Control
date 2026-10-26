const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Summary=require('../daily-case-summary.js'),Holds=require('../account-review-holds.js');
const app=fs.readFileSync('app.js','utf8'),fn=app.match(/function dailyAuditSheetRows\([^]*?\n}/)[0];
const companies=['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9'];
for(const company of companies)for(const manual of [false,true]){
 const primary=manual?{case_set:{},report:{exceptions:[{},{}]}}:null;
 const input={checklist:[{company,business_date:'2026-10-16',open_count:1,resolved_count:5}],quality:[{company,business_date:'2026-10-16',exception_count:2,primaryResult:primary}]};
 const before=JSON.stringify(input),ctx={dailyCompanyState:input,isLiveCompanyRow:()=>true,dailyResultStatus:(r,q)=>({primary:q.primaryResult})};vm.createContext(ctx);vm.runInContext(fn,ctx);
 const [row]=ctx.dailyAuditSheetRows('2026-10-16'),html=Summary.markup(row);
 assert.match(html,/ค้างปัจจุบัน 1 เคส/);assert.match(html,/ปิดแล้ว 5 เคส/);assert.match(html,/ผลตรวจตอนรัน 2 รายการ/);assert.ok(html.indexOf('ค้างปัจจุบัน')<html.indexOf('ผลตรวจตอนรัน'));
 assert.equal(JSON.stringify(input),before);
 input.checklist[0].open_count=0;assert.match(Summary.markup(ctx.dailyAuditSheetRows('2026-10-16')[0]),/ค้างปัจจุบัน 0 เคส/);
 input.checklist[0].open_count=null;const unavailable=Summary.markup(ctx.dailyAuditSheetRows('2026-10-16')[0]);assert.match(unavailable,/กำลังตรวจจำนวน/);assert.doesNotMatch(unavailable,/ค้างปัจจุบัน [0-9]/);
 if(primary){delete primary.case_set;assert.match(Summary.markup(ctx.dailyAuditSheetRows('2026-10-16')[0]),/รอสร้างชุดเคสปัจจุบัน/);}
}
{
 const input={checklist:[{company:'MR9',business_date:'2026-10-16',open_count:124,resolved_count:952}],caseCounts:[{company:'MR9',business_date:'2026-10-16',total_count:17,open_count:17,resolved_count:0}],quality:[{company:'MR9',business_date:'2026-10-16',exception_count:17}]};
 const ctx={dailyCompanyState:input,isLiveCompanyRow:()=>true,dailyResultStatus:()=>({primary:null})};vm.createContext(ctx);vm.runInContext(fn,ctx);
 const [row]=ctx.dailyAuditSheetRows('2026-10-16');assert.equal(row.exceptionCount,17);assert.equal(row.openCount,17);assert.equal(row.resolvedCount,0);
}
assert.ok(app.indexOf('id="dailySummaryHolds"')<app.indexOf('if (dailyCompanyState.loading && !dailyCompanyState.batches)'));
assert.match(app,/AccountReviewHolds.mountReadOnly/);assert.equal(typeof Holds.mountReadOnly,'function');
assert.doesNotMatch(Holds.mountReadOnly.toString(),/\.patch\(|\.post\(|\.rpc\(|requestClarification|closeException|saveHold/);
console.log('PASS current-case emphasis: nine companies x manual/system, 1 current vs 2 original vs 5 closed, genuine zero, unknown counts, staged cases, immutable inputs, persistent read-only registry launcher.');
