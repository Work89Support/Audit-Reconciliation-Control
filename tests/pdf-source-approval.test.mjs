import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({});
vm.runInContext(fs.readFileSync('reviewed-pdf-recovery.js','utf8')+'\n'+fs.readFileSync('pdf-source-approval.js','utf8')+'\nglobalThis.check=PdfSourceApproval.validate;',c);
const source={id:'source',company:'PS8',kind:'stm_pdf',checksum:'original',business_date:'2026-09-09'};
const hash='a'.repeat(64);
const payload={version:1,sourceId:'source',company:'PS8',sourceChecksum:'original',pdfSha256:hash,businessDate:'2026-09-09',account:'0123456789',bank:'SCB',coverageEvidence:'ตรวจครบทุกหน้าเทียบกับต้นฉบับ',expectedRowIds:['P1-R1'],controls:{deposit:{count:1,amount:5},withdraw:{count:0,amount:0}},rows:[{id:'P1-R1',date:'2026-09-09',time:'01:00',code:'X1',direction:'deposit',amount:5,previous:10,balance:15,last4:'0012',description:'รับโอนจาก KTB x0012',reviewed:false}]};
assert.equal(c.check(payload,source,hash,new Set(['P1-R1'])).rows[0].reviewed,true);
assert.equal(payload.rows[0].reviewed,false,'input must not be mutated');
assert.throws(()=>c.check(payload,source,hash,new Set()),/ทุกแถว/);
assert.throws(()=>c.check(payload,source,'b'.repeat(64)),/ไม่ตรง/);
for(const change of [p=>p.company='FR8',p=>p.sourceId='other',p=>p.sourceChecksum='stale',p=>p.businessDate='2026-09-08',p=>p.rows[0].last4='9999',p=>p.rows[0].balance=16,p=>p.controls.deposit.amount=6,p=>p.rows[0].code='X2',p=>p.coverageEvidence='']){
 const bad=structuredClone(payload);change(bad);assert.throws(()=>c.check(bad,source,hash));
}
const html=fs.readFileSync('index.html','utf8');
assert.ok(html.indexOf('reviewed-pdf-recovery.js')<html.indexOf('pdf-source-approval.js'));
assert.ok(html.indexOf('pdf-source-approval.js')<html.indexOf('app.js'));
const code=fs.readFileSync('pdf-source-approval.js','utf8');
assert.doesNotMatch(code,/retryJob|markParsed|confirmAuditPairs|localStorage/);
console.log('PDF source approval: row review, hash/scope/identity/balance rejection, immutability and wiring passed');
