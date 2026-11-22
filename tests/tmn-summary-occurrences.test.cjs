const assert=require('node:assert/strict');
const {summarize}=require('../mc8-live-sheets.js');
const row=(id,amount=20)=>({company:'UFABET7M',account:'0812792075',direction:'deposit',key:id,
 isPair:false,kind:'review',exType:'missing_bo',pmAmount:amount,pmRaw:'same customer description',
 pm:{},bo:{},case:{customer_details:{source_rows:{stm:{fileId:'wallet-pdf',row:id}}}}});
const a=row(1),b=row(2),c=row(3,10);
let total=summarize([a,b,c]);
assert.equal(total.pmCount,3);assert.equal(total.pmCents,5000);
// A second representation of the same physical row is counted once.
total=summarize([a,b,c,{...a,key:'warning'}]);
assert.equal(total.pmCount,3);assert.equal(total.pmCents,5000);
// A matched row and a distinct equal-time/equal-amount case both survive.
const matched={...a,key:'pair',isPair:true,kind:'matched',pmSource:{fileId:'wallet-pdf',row:1},boAmount:20,boRaw:'bo',boTime:'2026-11-21 06:29',boSource:{fileId:'bo',row:1}};
total=summarize([matched,b]);
assert.equal(total.pmCount,2);assert.equal(total.pmCents,4000);
console.log('TMN summary preserves distinct physical occurrences and suppresses only repeated representations');
