const assert=require('node:assert/strict'),fs=require('node:fs');
const overview=require('../review-overview.js'),primary=require('../manual-primary.js');
for(const company of ['3XB','AT4','FR8','MC8','MR9','PS8','SK8','UFABET7M','UR9']){
 const row={company,status:'pending_next_day'};
 assert.equal(overview.canClarifyCase(row),true);
 assert.deepEqual(overview.closureReviewAction(row),{action:'review',label:'ตรวจหลักฐานข้ามวัน',enabled:true});
 assert.equal(overview.auditLabel({case:row}),'ค้างรอข้อมูลข้ามวัน');
 for(const status of ['closed','approved','damage','clarifying'])assert.equal(overview.canClarifyCase({...row,status}),false);
}
const p={raw_exception_count:38,bo_timing_annotation_count:9,actionable_exception_count:29,waiting_bo_count:5,after:{exception_count:34}};
assert.match(primary.countBreakdown(p),/38 −.*9 =.*29 \+.*5 =.*34/);
assert.equal(primary.countBreakdown({...p,waiting_bo_count:6}),'');
const app=fs.readFileSync('app.js','utf8');
assert.match(app,/fresh\.status!==row\.status\|\|!\['open','answered','pending_next_day'\]/);
console.log('PASS nine-company pending cases: review-only closure, explicit clarification, terminal states blocked, 38-9+5=34 without record mutation.');
