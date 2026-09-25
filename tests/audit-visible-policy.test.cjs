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
assert.deepEqual(policy.filter(historical).map(row=>row.id),['missing']);
assert.equal(policy.isInformational({company:'PS8',type:'large-amount'}),true);
assert.equal(policy.isInformational({company:'UR9',type_name:'ต้องแนบเอกสารอนุมัติ'}),true);
assert.equal(policy.isInformational({company:'3XB',ex_type:'time_diff'}),true);
assert.equal(policy.isInformational({company:'AT4',ex_type:'time_diff'}),true);
assert.equal(policy.isInformational({company:'FR8',type:'large-amount'}),true);
assert.equal(policy.isInformational({company:'MC8',ex_type:'missing_stm',system_amount:200000}),false,'ยอดสูงต้องไม่ซ่อนเคส missing_stm จริง');

const matchedPair={company:'MC8',account:'1998545397',direction:'deposit',boAmount:100,stmAmount:100,
  bo:{date:'2026-09-15',sec:52800},stm:{date:'2026-09-15',sec:52800},
  customer:{bo:{reference:'2717490',user:'3win00575'},stm:{bank:'BAY',name:'MANIRAT SIK'}}};
const staleMatchedCases=[
  {id:'stale-bo',company:'MC8',account:'1998545397',direction:'ฝาก',ex_type:'missing_stm',system_amount:100,bo_date:'2026-09-15',bo_time:'14:40:00',customer_details:{bo:{reference:'2717490',user:'3win00575'}}},
  {id:'stale-stm',company:'MC8',account:'1998545397',direction:'ฝาก',ex_type:'missing_bo',bank_amount:100,stm_date:'2026-09-15',stm_time:'14:40:00',customer_details:{stm:{bank:'BAY',name:'MANIRAT SIK'}}},
  {id:'real-missing',company:'MC8',account:'1998545397',direction:'ฝาก',ex_type:'missing_bo',bank_amount:100,stm_date:'2026-09-15',stm_time:'14:41:00',customer_details:{stm:{bank:'SCB',name:'OTHER'}}},
];
assert.deepEqual(policy.filter(staleMatchedCases,[matchedPair]).map(row=>row.id),['real-missing'],'stored matched evidence must suppress both stale missing halves only');
assert.deepEqual(policy.filter(staleMatchedCases,[{...matchedPair,company:''}]).map(row=>row.id),['real-missing'],'older evidence without company must use the single-company workspace scope');

const sapanPair={company:'3XB',account:'AUTOPEER',direction:'withdraw',boAmount:100,stmAmount:100,
  bo:{date:'2026-09-15',sec:79750},stm:{date:'2026-09-15',sec:79750},
  customer:{bo:{note:'Sapan: 6aa95f3e6f7ddd65ebf18744'},stm:{providerReference:'6aa95f3e6f7ddd65ebf18744'}}};
const staleWrongTime={id:'stale-sapan',company:'3XB',account:'AUTOPEER',direction:'ถอน',ex_type:'missing_stm',system_amount:100,
  bo_date:'2026-09-15',bo_time:'21:35:00',bo_raw:'Sapan: 6aa95f3e6f7ddd65ebf18744 | โอนจริง 100 สำเร็จ 100',
  customer_details:{bo:{note:'Sapan: 6aa95f3e6f7ddd65ebf18744 | โอนจริง 100 สำเร็จ 100'}}};
assert.deepEqual(policy.filter([staleWrongTime],[sapanPair]),[],'exact XB provider id and amount must suppress a stale case even when its old time differs');

const view=ReviewOverview.model({run:{matched:0,summary:{match_evidence:[]}},cases:historical,confirmations:[]});
assert.deepEqual(view.rows.map(row=>row.id),['missing']);
assert.equal(view.counts.review,1);
console.log('Audit visible policy: XB and 123 companies hide informational large-amount and time-variance rows');
