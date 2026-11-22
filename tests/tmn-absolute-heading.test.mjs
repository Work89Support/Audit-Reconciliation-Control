import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({});
for (const file of ['formats.js','registry.js','pdf-stm.js']) {
  vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
}
const parse = (name,pages,date='2026-11-21') => {
  ctx.input = pages.map(cells=>cells.map(text=>({text})));
  return vm.runInContext(`PdfStm.parse(${JSON.stringify(name)},input,${JSON.stringify(date)})`,ctx);
};
const name = 'UFABET7M_STM_TMN_รุ่งฟ้า_DW_2026-11-21.pdf';
const row = (time,amount) => ['รับเงินจาก ทดสอบ ก***',`+฿ ${amount.toFixed(2)}`,time];
const pages = Array.from({length:10},(_,i)=>['รายการ',...row(`01:${String(i).padStart(2,'0')}`,20)]);
pages[0].splice(1,0,'21 พฤศจิกายน 2569','เมื่อวานนี้');
// A new heading below the final rows belongs to the following older day.
pages[9].push('20 พฤศจิกายน 2569',...row('23:59',30));
const result = await parse(name,pages);
assert.equal(result.records.filter(r=>!r.ocrDateCandidateOnly).length,10);
assert.equal(result.records.filter(r=>r.ocrDateCandidateOnly).length,1);
assert.ok(result.records.slice(0,10).every(r=>r.sourceDate==='2026-11-21'));
assert.equal(result.records.at(-1).sourceDate,'2026-11-20');
assert.equal(result.header.account,'0812792075');
assert.equal(result.header.accountSource,'registered_tmn_owner');
// Flattening the same OCR into one page must not change calendar assignment.
const flattened = await parse(name,[pages.flat()]);
assert.deepEqual(JSON.parse(JSON.stringify(flattened.records.map(r=>[r.sourceDate,r.sec,r.amount]))),
  JSON.parse(JSON.stringify(result.records.map(r=>[r.sourceDate,r.sec,r.amount]))));
// Equal time/amount occurrences survive as distinct rows.
const repeated = await parse(name,[['รายการ','21 พฤศจิกายน 2569','เมื่อวานนี้',...row('08:44',4000),...row('08:44',4000)]]);
assert.equal(repeated.records.length,2);
assert.notEqual(repeated.records[0].rowNo,repeated.records[1].rowNo);
assert.ok(repeated.records.every(r=>!r.ocrDateCandidateOnly));
const wrongCompany = await parse('FR8_STM_TMN_รุ่งฟ้า_DW_2026-11-21.pdf',pages);
assert.equal(wrongCompany.header.account,'');
const ambiguous = await parse('UFABET7M_STM_TMN_รุ่งฟ้า_สรวิศา_DW_2026-11-21.pdf',pages);
assert.equal(ambiguous.header.account,'');
const owner = await parse('UFABET7M_STM_TMN_สรวิศา_DW_2026-11-21.pdf',pages);
assert.equal(owner.header.account,'0639274201');
console.log('TMN absolute headings, 10-page continuation, scoped owner and repeated rows passed');
