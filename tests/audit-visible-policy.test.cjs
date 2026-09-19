const assert=require('node:assert/strict');
const policy=require('../audit-visible-policy.js');
const ReviewOverview=require('../review-overview.js');

const historical=[
  {id:'missing',company:'MC8',ex_type:'missing_stm',type_name:'BO มากกว่า STM',status:'open',direction:'ถอน'},
  {id:'large',company:'MC8',ex_type:'large_amount',type_name:'ยอดสูงผิดปกติ ต้องมีเอกสารกำกับ',status:'open',direction:'ถอน'},
  {id:'time',company:'PS8',ex_type:'time_diff',type_name:'เวลาเกิน tolerance',status:'open',direction:'ถอน'},
  {id:'time-other',company:'AT4',ex_type:'time_diff',type_name:'เวลาเกิน tolerance',status:'open',direction:'ถอน'},
  {id:'other-company',company:'AT4',ex_type:'large_amount',type_name:'ยอดสูงผิดปกติ ต้องมีเอกสารกำกับ',status:'open',direction:'ถอน'},
];
assert.deepEqual(policy.filter(historical).map(row=>row.id),['missing','time-other','other-company']);
assert.equal(policy.isInformational({company:'PS8',type:'large-amount'}),true);
assert.equal(policy.isInformational({company:'UR9',type_name:'ต้องแนบเอกสารอนุมัติ'}),true);
assert.equal(policy.isInformational({company:'3XB',ex_type:'time_diff'}),true);
assert.equal(policy.isInformational({company:'MC8',ex_type:'missing_stm',system_amount:200000}),false,'ยอดสูงต้องไม่ซ่อนเคส missing_stm จริง');

const view=ReviewOverview.model({run:{matched:0,summary:{match_evidence:[]}},cases:historical,confirmations:[]});
assert.deepEqual(view.rows.map(row=>row.id),['missing','time-other','other-company']);
assert.equal(view.counts.review,3);
console.log('Audit visible policy: five XB companies hide informational large-amount and time-variance rows');
