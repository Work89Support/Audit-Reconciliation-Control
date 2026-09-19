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
  reason: 'same amount and identity', boSource: { row: 2 }, pmSource: { row: 2 },
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
assert.deepEqual(sheets.map(sheet => sheet.name), ['ข้อมูลทั้งหมด', 'สรุป', 'Statement', 'AT ถ', 'AT ฝ', 'AZ ถ', 'AZ ฝ', 'CP ถ', 'CP ฝ', 'M ถ', 'M ฝ']);
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
