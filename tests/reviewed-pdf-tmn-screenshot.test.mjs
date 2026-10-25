import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync('reviewed-pdf-recovery.js', 'utf8') + ';globalThis.recovery=ReviewedPdfRecovery;', context);

const file = {id:'tmn-source',company:'UFABET7M',checksum:'tmn-checksum',kind:'stm_pdf'};
const job = {company:'UFABET7M',business_date:'2026-10-24'};
const recovery = {id:'tmn-revision',status:'approved',approved_by:'reviewer',approved_at:'2026-10-25',payload:{
  version:1,sourceType:'tmn-screenshot-list-v1',sourceId:file.id,sourceChecksum:file.checksum,
  pdfSha256:'b'.repeat(64),company:job.company,businessDate:job.business_date,account:'0639274201',bank:'TMN',
  coverageReviewed:true,coverageEvidence:'reviewed all screenshot pages and overlaps',
  expectedRowIds:['P1-R1','P2-R1','P9-R1'],controls:{deposit:{count:1,amount:80},withdraw:{count:1,amount:4000}},rows:[
    {id:'P1-R1',date:'2026-10-24',time:'08:44',direction:'withdraw',amount:4000,description:'โอนเงินให้ นาย กิตติ ป***',reviewed:true},
    {id:'P2-R1',date:'2026-10-24',time:'08:44',direction:'withdraw',amount:4000,description:'โอนเงินให้ นาย กิตติ ป***',duplicateOf:'P1-R1',reviewed:true},
    {id:'P9-R1',date:'2026-10-24',time:'23:27',direction:'deposit',amount:80,description:'รับเงินจาก ชาตรี ใ***',reviewed:true},
  ],
}};

const result = context.recovery.normalize(recovery, file, job);
assert.equal(result.records.length, 2);
assert.equal(result.records.filter(row => row.amount === 4000).length, 1);
assert.equal(result.records[0].balance, null);
assert.equal(result.records[0].sourcePage, 1);
assert.equal(result.format.realCode, 'stm_pdf_reviewed_tmn_screenshot');
assert.equal(result.records.map(row => row.sec).join(','), '31440,84420');

for (const change of [
  value => value.payload.bank = 'SCB',
  value => value.payload.sourceType = '',
  value => value.payload.rows[1].duplicateOf = 'missing',
  value => value.payload.rows[1].amount = 3999,
]) {
  const invalid = structuredClone(recovery);
  change(invalid);
  assert.throws(() => context.recovery.normalize(invalid, file, job), /PDF recovery:/);
}

console.log('TMN screenshot recovery preserves real rows and removes page overlap only');
