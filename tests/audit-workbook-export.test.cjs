const assert = require('node:assert/strict');
const fs = require('node:fs');
const schema = require('../mc8-sheet-schema.js');
const live = require('../mc8-live-sheets.js');
const writer = require('../xlsx-writer.js');

const liveSource = fs.readFileSync(require.resolve('../mc8-live-sheets.js'), 'utf8');
const appSource = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const indexSource = fs.readFileSync(require.resolve('../index.html'), 'utf8');
assert.ok(liveSource.includes('id="mc8-live-export"'));
assert.ok(appSource.includes("audit_reconciliation_workbook"));
assert.ok(indexSource.includes('xlsx-writer.js?v=audit-export-20260919'));

const row = (overrides = {}) => ({
  key: overrides.code || 'row', isPair: true, kind: 'matched', company: 'MC8',
  account: 'AUTOPEER', direction: 'deposit', code: 'PAIR-1',
  bo: { user: 'bo-user', reference: 'BO-1', account: '1111', bank: 'KBANK' },
  pm: { user: 'pm-user', reference: 'PM-1', account: '1111', bank: 'KBANK' },
  boAmount: 100, pmAmount: 100, boTime: '2026-09-15 10:00:00', pmTime: '2026-09-15 10:00:10',
  reason: 'same amount and identity', boSource: { row: 2 }, pmSource: { row: 2, timeColumn: 'paymentTime', amountColumn: 'realAmount' },
  ...overrides,
});

const rows = [
  row(),
  row({ key: 'advisory', code: 'PAIR-INFO', kind: 'advisory', reason: 'แสดงข้อมูลเพิ่มเติมโดยไม่ต้องยืนยัน' }),
  row({ key: 'review', code: 'EX-1', isPair: false, kind: 'review', boAmount: 200, pmAmount: 200, reason: 'รอ Audit ยืนยัน' }),
  row({ key: 'error', code: 'EX-2', isPair: false, kind: 'review', account: 'AZPAY', direction: 'withdraw', boAmount: 300, pmAmount: null, pm: {}, reason: 'ไม่พบ STM/PM' }),
  row({ key: 'crossday', code: 'EX-XDAY', isPair: false, kind: 'pending_next_day', account: 'COREPAY', direction: 'deposit', exType: 'cross_day', reason: 'รอข้อมูลของวันถัดไป' }),
  row({ key: 'closed', code: 'EX-3', isPair: false, kind: 'closed', account: '1998545397', boAmount: 50, pmAmount: 50, reason: 'Audit ปิดเคสแล้ว' }),
];

const sheets = live.buildAuditExportSheets(rows, 'MC8', '2026-09-15', true, schema);
assert.deepEqual(sheets.map(sheet => sheet.name), ['ข้อมูลทั้งหมด', 'สรุป', 'STM KBANK pm-user D-W', 'AT ถ', 'AT ฝ', 'AZ ถ', 'AZ ฝ', 'CP ถ', 'CP ฝ', 'M ถ', 'M ฝ']);
assert.equal(sheets[0].title, undefined, 'first sheet header must start on row 1');
assert.equal(sheets[0].headers.at(-1), 'สถานะสำหรับเทียบทีมกระทบมือ');
assert.deepEqual(sheets[0].rowTones, ['', '', '', 'error', 'warning', '']);
assert.equal(sheets[0].cellTones[0].at(-1), 'success');
assert.equal(sheets[0].cellTones[1].at(-1), 'success');
assert.equal(sheets[0].cellTones[4].at(-1), 'warning');
assert.equal(sheets[0].cellTones[5].at(-1), 'success');
assert.equal(sheets[0].footerRows[0][sheets[0].headers.indexOf('BO · ยอด')], 750);
assert.equal(sheets[0].footerRows[0][sheets[0].headers.indexOf('STM/PM · ยอด')], 450);
assert.equal(sheets[0].footerRows[0][sheets[0].headers.indexOf('ผลต่างยอด')], -300);
assert.equal(sheets[2].rows.length, 1, 'numeric company account must appear on Statement sheet');
assert.equal(sheets[2].rows[0].at(-1), 'ปิดเคสแล้ว');

const multipleStatementAccounts = live.buildAuditExportSheets([
  row({ key: 'stm-songkran-deposit', account: '1111111111', direction: 'deposit', pm: { user: 'สงกรานต์', account: '1111111111', bank: 'SCB' } }),
  row({ key: 'stm-songkran-withdraw', account: '1111111111', direction: 'withdraw', pm: { user: 'สงกรานต์', account: '1111111111', bank: 'SCB' } }),
  row({ key: 'stm-waewdao-deposit', account: '2222222222', direction: 'deposit', pm: { user: 'แววดาว', account: '2222222222', bank: 'SCB' } }),
  row({ key: 'stm-waewdao-withdraw', account: '2222222222', direction: 'withdraw', pm: { user: 'แววดาว', account: '2222222222', bank: 'SCB' } }),
], '3XB', '2026-09-16', true, schema);
const songkranSheet = multipleStatementAccounts.find(sheet => sheet.name === 'STM SCB สงกรานต์ D-W');
const waewdaoSheet = multipleStatementAccounts.find(sheet => sheet.name === 'STM SCB แววดาว D-W');
assert.ok(songkranSheet, 'each normal statement account must receive its own named sheet');
assert.ok(waewdaoSheet, 'a second statement account must not be merged into the first sheet');
assert.equal(songkranSheet.rows.length, 2, 'deposit and withdrawal stay together for the same statement account');
assert.equal(waewdaoSheet.rows.length, 2, 'deposit and withdrawal stay together for the second statement account');

const sys123Sheets = live.buildAuditExportSheets([
  row({company:'AT4',account:'AUTOPEER',direction:'deposit',pm:{user:'mem-1',account:'0012345678'},pmSource:{row:2,timeColumn:'วันที่ทำรายการ',amountColumn:'จำนวนเงินฝาก'}}),
  row({company:'AT4',account:'CYBERPLUS',direction:'withdraw',pm:{user:'mem-2'},pmSource:{row:3,timeColumn:'วันที่ทำรายการ',amountColumn:'จำนวนเงินถอน'}}),
  row({company:'AT4',account:'1111111111',direction:'deposit',pm:{user:'จิรภัทร์',account:'1111111111',bank:'KBANK'}}),
  row({company:'AT4',account:'1111111111',direction:'withdraw',pm:{user:'จิรภัทร์',account:'1111111111',bank:'KBANK'}}),
], 'AT4', '2026-09-20', true, schema);
for(const name of ['AT ถ','AT ฝ','AZ ฝ','CP ถ','CP ฝ','CY ถ','CY ฝ','LP ถ','LP ฝ'])assert.ok(sys123Sheets.some(sheet=>sheet.name===name),`123 export must include ${name}`);
assert.ok(!sys123Sheets.some(sheet=>sheet.name==='AZ ถ'),'123 export must not invent AZPAY withdrawal sheet');
assert.ok(sys123Sheets.find(sheet=>sheet.name==='AT ฝ').headers.includes('รหัสสมาชิก'));
assert.ok(sys123Sheets.find(sheet=>sheet.name==='AT ฝ').headers.includes('เลขบัญชีสมาชิก'));
assert.ok(sys123Sheets.find(sheet=>sheet.name==='AT ฝ').headers.includes('จำนวนเงินฝาก'));
assert.ok(!sys123Sheets.find(sheet=>sheet.name==='CY ถ').headers.includes('เลขบัญชีสมาชิก'),'123 CYBERPLUS withdrawal uses only member and amount');
assert.equal(sys123Sheets.find(sheet=>sheet.name==='STM KBANK จิรภัทร์ D').rows.length,1,'123 normal-bank deposit must have a separate account sheet');
assert.equal(sys123Sheets.find(sheet=>sheet.name==='STM KBANK จิรภัทร์ W').rows.length,1,'123 normal-bank withdrawal must have a separate account sheet');

const threeXbSheets = live.buildAuditExportSheets([
  row({company:'3XB',account:'LOCALPAY',direction:'deposit'}),
  row({company:'3XB',account:'LOCALPAY',direction:'withdraw',pmSource:{row:2,timeColumn:'updateTime',amountColumn:'amount'}}),
], '3XB', '2026-09-17', true, schema);
assert.ok(threeXbSheets.some(sheet=>sheet.name==='LP ฝ'),'3XB export must include LOCALPAY deposit sheet');
assert.ok(threeXbSheets.some(sheet=>sheet.name==='LP ถ'),'3XB export must include LOCALPAY withdrawal sheet');
assert.equal(threeXbSheets.find(sheet=>sheet.name==='LP ฝ').rows.length,1);
assert.equal(threeXbSheets.find(sheet=>sheet.name==='LP ถ').rows.length,1);

const sevenMSheets = live.buildAuditExportSheets([
  row({company:'7M',account:'AUTOPEER',direction:'withdraw',pmSource:{row:2,timeColumn:'วันที่',amountColumn:'P2P จ่าย'}}),
  row({company:'7M',account:'COREPAY',direction:'deposit',pmSource:{row:3,timeColumn:'วันที่ทำรายการ',amountColumn:'จำนวนที่ได้รับ'}}),
  row({company:'7M',account:'CYBERPLUS',direction:'deposit',pmSource:{row:4,timeColumn:'วันที่ทำรายการ',amountColumn:'จำนวนเงิน'}}),
  row({company:'7M',account:'LOCALPAY',direction:'withdraw',pmSource:{row:5,timeColumn:'วันเวลาอัพเดต',amountColumn:'จำนวนเงิน'}}),
  row({company:'7M',account:'0812792075',direction:'deposit',pm:{user:'รุ่งฟ้า',account:'0812792075',bank:'TMN'}}),
  row({company:'7M',account:'0812792075',direction:'withdraw',pm:{user:'รุ่งฟ้า',account:'0812792075',bank:'TMN'}}),
  row({company:'7M',account:'5034633891',direction:'deposit',pm:{user:'สมภพ',account:'5034633891',bank:'SCB'}}),
  row({company:'7M',account:'5034633891',direction:'withdraw',pm:{user:'สมภพ',account:'5034633891',bank:'SCB'}}),
], 'UFABET7M', '2026-09-20', true, schema);
for(const name of ['AT ถ','AT ฝ','CP ถ','CP ฝ','CY ถ','CY ฝ','AZ ฝ','M ถ','M ฝ','LO ถ','LO ฝ'])assert.ok(sevenMSheets.some(sheet=>sheet.name===name),`7M export must include ${name}`);
assert.ok(!sevenMSheets.some(sheet=>sheet.name==='AZ ถ'),'7M export must not invent AZ withdrawal sheet');
assert.equal(sevenMSheets.find(sheet=>sheet.name==='AT ถ').headers[0],'วันที่');
assert.ok(sevenMSheets.find(sheet=>sheet.name==='AT ถ').headers.includes('P2P จ่าย'));
assert.ok(sevenMSheets.find(sheet=>sheet.name==='CP ฝ').headers.includes('จำนวนที่ได้รับ'));
assert.equal(sevenMSheets.find(sheet=>sheet.name==='STM SCB สมภพ D-W').rows.length,2,'normal bank deposit and withdrawal stay together');
assert.equal(sevenMSheets.find(sheet=>sheet.name==='STM TMN รุ่งฟ้า D').rows.length,1,'TMN deposit has a separate sheet');
assert.equal(sevenMSheets.find(sheet=>sheet.name==='STM TMN รุ่งฟ้า W').rows.length,1,'TMN withdrawal has a separate sheet');

const sevenMCp2Sheets = live.buildAuditExportSheets([
  row({company:'UFABET7M',account:'CP2 PAYMENT ถอน 000000CP2',direction:'withdraw',pmSource:{row:2,timeColumn:'วันเวลาอัพเดต',amountColumn:'จำนวนเงิน'}}),
  row({company:'UFABET7M',account:'CP2 PAYMENT ฝาก 000000CP2',direction:'deposit',pmSource:{row:3,timeColumn:'วันที่ทำรายการ',amountColumn:'จำนวนที่ได้รับ'}}),
], 'UFABET7M', '2026-09-20', true, schema);
assert.equal(sevenMCp2Sheets.find(sheet=>sheet.name==='CP ถ').rows.length,1,'CP2 withdrawal must be exported under COREPAY/CP');
assert.equal(sevenMCp2Sheets.find(sheet=>sheet.name==='CP ฝ').rows.length,1,'CP2 deposit must be exported under COREPAY/CP');

const numericCorepaySheets = live.buildAuditExportSheets([
  row({company:'UFABET7M',account:'6608660006',direction:'deposit',pm:{reference:'260919033016-81682672-CP'},pmSource:{row:2,timeColumn:'paymentTime',amountColumn:'realAmount'}}),
], 'UFABET7M', '2026-09-19', true, schema);
assert.equal(numericCorepaySheets.find(sheet=>sheet.name==='CP ฝ').rows.length,1,'numeric COREPAY merchant account must remain on the CP deposit sheet');
assert.ok(!numericCorepaySheets.some(sheet=>sheet.name.startsWith('STM STM')),'numeric COREPAY merchant account must not create a bogus Statement sheet');

const atDeposit = sheets.find(sheet => sheet.name === 'AT ฝ');
assert.deepEqual(atDeposit.headers.slice(0, schema.sheets.find(sheet => sheet.name === 'AT ฝ').headers.length), schema.sheets.find(sheet => sheet.name === 'AT ฝ').headers);
assert.deepEqual(atDeposit.headers.slice(-4), ['เงื่อนไขที่จับคู่', 'ต่างเวลา', 'ผลต่างยอด', 'สถานะ Audit']);
assert.equal(atDeposit.rows.length, 3);
assert.equal(atDeposit.rows[0].at(-1), 'ปิดได้ทันที');
assert.equal(atDeposit.rows[1].at(-1), 'แจ้งข้อมูล · ไม่ต้องยืนยัน');
assert.equal(atDeposit.rows[2].at(-1), 'ปิดได้ทันที');
assert.equal(atDeposit.rows[0][atDeposit.headers.indexOf('requestTime')], '', 'requestTime must stay blank');
assert.equal(atDeposit.rows[0][atDeposit.headers.indexOf('paymentTime')], '2026-09-15 10:00:10');
assert.match(atDeposit.rows[0][atDeposit.headers.indexOf('เงื่อนไขที่จับคู่')], /เวลา PM: paymentTime/);
assert.match(atDeposit.rows[0][atDeposit.headers.indexOf('เงื่อนไขที่จับคู่')], /ยอด PM: realAmount/);

const expiredDeposit = live.buildAuditExportSheets([row({pmSource:{row:3,timeColumn:'expiredTime',amountColumn:'realAmount'}})], 'PS8', '2026-09-15', true, schema).find(sheet=>sheet.name==='AT ฝ');
assert.equal(expiredDeposit.rows[0][expiredDeposit.headers.indexOf('paymentTime')], '');
assert.equal(expiredDeposit.rows[0][expiredDeposit.headers.indexOf('expiredTime')], '2026-09-15 10:00:10');
assert.match(expiredDeposit.rows[0][expiredDeposit.headers.indexOf('เงื่อนไขที่จับคู่')], /เวลา PM: expiredTime/);

const cpDeposit = sheets.find(sheet => sheet.name === 'CP ฝ');
assert.equal(cpDeposit.rows[0].at(-1), 'ค้างรอข้อมูลข้ามวัน · รอข้อมูลของวันถัดไป');
const atSummary = sheets[1].rows.find(row => row[0] === 'AT ฝ');
assert.equal(atSummary[7], 1, 'advisory match must not be counted as an Audit action item');

const azWithdraw = sheets.find(sheet => sheet.name === 'AZ ถ');
assert.equal(azWithdraw.rows[0].at(-1), 'ปิดไม่ได้/ต้องตรวจ');
assert.equal(azWithdraw.rowTones[0], 'error');
assert.ok(azWithdraw.footerRows[0].includes('รวม 1 รายการ'));

(async () => {
  const blob = writer.build(sheets, 'MC8 2026-09-15');
  assert.ok(blob.size > 1000);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const xml = new TextDecoder().decode(bytes);
  assert.ok(xml.includes('ข้อมูลทั้งหมด'));
  assert.ok(xml.includes('FFFCE4D6'), 'red exception fill must be embedded');
  assert.ok(xml.includes('FFFFF2CC'), 'yellow review fill must be embedded');
  assert.ok(xml.includes('<row r="1" ht="26" customHeight="1">'), 'table header must start at row 1');
  console.log('Audit workbook export passed: template headers, all statuses, row highlights, totals and row-1 header.');
})().catch(error => { console.error(error); process.exitCode = 1; });
