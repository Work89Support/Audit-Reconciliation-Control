import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/20260919_exception_lifecycle.sql', import.meta.url), 'utf8');

assert.match(app, /const AUDIT_COMPANY_GROUPS/);
assert.match(app, /companies: \["3XB", "MC8", "MR9", "PS8", "UR9"\]/);
assert.match(app, /name: "เครือ 123"[\s\S]*status: "pending"/);
assert.match(app, /name: "เครือ 7M"[\s\S]*status: "active"/);
assert.match(app, /paymentTime ก่อน; ใช้ expiredTime เฉพาะเมื่อไม่มี paymentTime/);
assert.match(app, /ยอดถอน AT\/M ใช้ transferredAmount · ยอดถอน AZ\/CP ใช้ amount/);
assert.match(app, /groupedCompanyOptions\(companies, company\)/);
assert.match(app, /function reviewCompanyGroupsMarkup\(companies\)/);
assert.match(app, /3 เครือบริษัท · เลือกบริษัทย่อย/);
assert.match(app, /reviewCompanyGroupsMarkup\(companies\)/);
assert.match(css, /\.company-group-grid/);
assert.match(css, /\.company-rule-details/);
assert.match(css, /\.review-company-groups/);

assert.match(migration, /exception_carried_forward/);
assert.match(migration, /exception_auto_closed_on_rerun/);
assert.match(migration, /cross_day_auto_closed/);
assert.match(migration, /v_evidence_count=1/);
assert.match(migration, /reason','no-unique-match-evidence'/);
assert.doesNotMatch(migration, /delete\s+from\s+public\.exceptions/i);

console.log('company groups + exception lifecycle: ผ่าน');
