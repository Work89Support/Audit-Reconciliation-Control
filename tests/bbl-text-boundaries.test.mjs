import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context=vm.createContext({console});
vm.runInContext(fs.readFileSync(new URL('../pdf-stm.js',import.meta.url),'utf8')+';globalThis.P=PdfStm;',context);
const P=context.P;
const heading='STATEMENT OF SAVINGS ACCOUNT\nAccount No. 123-4-56789-0\n01/11/2026 - 20/11/2026';
const rows=[
 '20/11/26 TRF FR OTH BK 100.00 500.00 mPhone',
 '20/11/26 TRF TO OTH BK 10.00 490.00 mPhone',
 '20/11/26 TRF FR OTH BK 100.00 590.00 mPhone',
 '20/11/26 TRANSFER 5.00 585.00 mPhone',
];
const parse=text=>P.parseText('AT4_STM_BBL_sample.pdf',text,'2026-11-20');
const normal=await parse(heading+'\nธนาคารกรุงเทพ จำกัด (มหาชน)\n'+rows.join('\n'));
assert.equal(normal.header.bank,'BBL','period must not hide a later bank heading');
assert.equal(normal.quality.complete,true);
const expected=JSON.stringify(normal.records.map(r=>[r.date,r.direction,r.amount,r.balance]));
for(const separator of [' ','\n','\r\n']) {
 const result=await parse(heading+' ผานทาง Date Particulars Chq.No. Withdrawal Deposit Balance Via\nธนาคารกรุงเทพ จำกัด (มหาชน)\n'+rows.join(separator));
 assert.equal(result.quality.complete,true,separator);
 assert.equal(result.quality.parsedRows,4);
 assert.equal(JSON.stringify(result.records.map(r=>[r.date,r.direction,r.amount,r.balance])),expected);
 assert.equal(result.records.filter(r=>r.amount===100).length,2,'real repeated amounts stay separate');
 assert.equal(new Set(result.records.map(r=>r.sourceLine)).size,4,'distinct source row positions');
 assert.ok(result.records.every(r=>r.noTime&&r.sec===0),'never invent BBL time');
}
const flat=await parse('ธนาคารกรุงเทพ '+heading.replaceAll('\n',' ')+' '+rows.join(' ')+' จำนวนรายการถอน/Total No. of Debits 2 จำนวนเงินถอน/Total Debit Amount 15.00');
assert.equal(flat.quality.complete,true,'footer must not become an extra transaction amount');
assert.equal(flat.records.length,4);
const pages=await parse(heading+'\nธนาคารกรุงเทพ\n'+rows.slice(0,2).join(' ')+'\f'+rows.slice(2).join(' '));
assert.deepEqual(Array.from(pages.records,r=>r.page),[1,1,2,2]);
const malformed=await parse(heading+'\nธนาคารกรุงเทพ\n'+rows[0]+' 20/11/26 UNRECOGNIZED 8.00 508.00 mPhone');
assert.equal(malformed.quality.complete,false,'unknown collapsed tuples must block, never pick the last amount');
assert.equal(malformed.records.length,0);
for(const bad of ['20/11/26 TRF FR OTH BK 100.00 mPhone','20/11/26 TRF FR OTH BK 100.00 500.00 600.00 mPhone']) {
 const result=await parse(heading+'\nธนาคารกรุงเทพ\n'+bad);
 assert.equal(result.quality.complete,false);assert.equal(result.quality.unreadRows.length,1);
}
const fakePeriod=await parse(heading+'\nธนาคารกรุงเทพ\n01/11/2026 - 20/11/2026 50.00 500.00');
assert.equal(fakePeriod.quality.complete,false,'date-range recognition must not swallow money');
const scb=await P.parseText('SCB.pdf','SIAM COMMERCIAL\nAccount No. 1234567890\n20/11/26 12:00 X1 ENET 100.00 500.00','2026-11-20');
assert.equal(scb.header.bank,'SCB');assert.equal(scb.records.length,1);
const counterparty=await P.parseText('KBANK.pdf','ธนาคารกสิกรไทย\nAccount No. 1234567890\n20-11-26 12:00 รับโอนเงิน 100.00 500.00 K PLUS จาก ธนาคารกรุงเทพ','2026-11-20');
assert.equal(counterparty.header.bank,'KBANK');assert.equal(counterparty.records.length,1);
console.log('PASS BBL native/OCR boundaries, metadata, repeated rows, pages, fail-closed malformed input and bank isolation');
