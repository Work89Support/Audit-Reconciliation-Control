const assert = require('node:assert/strict');
const {model,filter,caseState}=require('../review-overview.js');
const evidence=[{direction:'deposit',account:'AUTOPEER',customer:{bo:{account:'0012345678'}}},{direction:'withdraw',account:'SCB',manualReview:true}];
const data={run:{matched:10,summary:{match_evidence:evidence}},cases:[{id:'1',status:'open',direction:'ฝาก',account:'SCB'},{id:'2',status:'clarifying',direction:'ถอน',account:'SCB'},{id:'3',status:'closed',direction:'ฝาก',account:'AUTOPEER'}]};
const m=model(data);
assert.equal(m.reportedMatched,10);
assert.equal(m.evidenceCount,2); // Never invent 8 missing pair rows.
assert.equal(m.counts.matched,1);
assert.equal(m.counts.review,2); // manual matched pair still requires review.
assert.equal(m.counts.clarification,1);
assert.equal(m.counts.closed,1);
assert.equal(filter(m.rows,{status:'all',direction:'all',account:'',query:''}).length,5);
assert.equal(filter(m.rows,{status:'matched',direction:'deposit',account:'AUTOPEER',query:'0012345678'}).length,1);
assert.equal(filter(m.rows,{status:'matched',direction:'withdraw',account:'',query:''}).length,0);
assert.equal(caseState({status:'answered'}),'clarification');
assert.equal(model({run:null,cases:[]}).rows.length,0);
assert.equal(model({run:{matched:239,summary:{}},cases:[]}).counts.matched,0);
console.log('Unified overview: filters, manual gate, missing evidence and states passed');
