const fs=require('node:fs');
const assert=require('node:assert/strict');

const rules=fs.readFileSync('docs/RECONCILIATION_OPERATING_RULES_20261025.md','utf8');
const formats=fs.readFileSync('formats.js','utf8');
const pairing=fs.readFileSync('manual-pairing.js','utf8');
const migration=fs.readFileSync('supabase/20261026_7m_internal_transfer_same_account_only.sql','utf8');
const dispatcher=JSON.parse(fs.readFileSync('n8n/audit-round-dispatcher.json','utf8'));

assert.match(rules,/ให้รอบอัตโนมัติทำงานต่อผ่าน Dispatcher ที่อนุมัติเท่านั้น/);
assert.equal(dispatcher.nodes.find(node=>node.type==='n8n-nodes-base.scheduleTrigger')?.parameters?.rule?.interval?.[0]?.expression,'0 0 8,19 * * *');

assert.match(rules,/Keep -.*ไม่เข้ายอด ไม่สร้าง Exception และไม่เปิดเคส/s);
assert.match(formats,/keepInformation/);
assert.match(formats,/infoCategory: "เก็บ"/);

assert.match(rules,/ปิดเคสต้องเป็นบัญชีเดียวกันระหว่าง BO กับ STM\/PM/);
assert.doesNotMatch(pairing,/internalTransferDirectionMatches/);
assert.match(migration,/a\.account is distinct from b\.account/);
assert.match(migration,/a\.direction is distinct from b\.direction/);

assert.match(rules,/หมด SLA.*แจ้งเตือนและยกระดับ/);
assert.match(rules,/ความเสียหาย 0 บาท \/ ไม่พบความผิดพลาด/);
assert.match(rules,/ความเสียหาย 0 บาท \/ แต่มีการทำงานผิดพลาด/);
assert.match(rules,/ยืนยันความเสียหาย/);

for(const sample of ['10 ↔ 1,000','40 ↔ 4,000','53 ↔ 953','4,000','08:44'])assert.ok(rules.includes(sample),sample);
assert.match(rules,/ฟิลด์สำคัญใดไม่ผ่าน threshold[\s\S]+หยุด `needs_review`/);

console.log('Final operating rules 2026-10-26: auto route, same-account 7M closure, Keep exclusion, SLA outcomes and OCR gate passed');
