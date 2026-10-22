const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Holds=require('../account-review-holds.js');
const sql=fs.readFileSync('supabase/20261022_managed_account_review_holds.sql','utf8');

test('3XB SCB Waewdao is seeded as an open-ended hold without changing cases or amounts',()=>{
 assert.match(sql,/'3XB','6242596342','2026-10-22'/);
 assert.match(sql,/'SCB','แววดาว'/);
 assert.doesNotMatch(sql,/\b(update|delete)\s+public\.(exceptions|recon_runs|daily_recon_jobs|damages|source_files)\b/i);
});

test('managed hold uses lead/admin authorization, audit log and optimistic release',()=>{
 assert.match(sql,/role_name not in \('lead','admin'\)/);
 assert.match(sql,/p_expected_revision<>c\.revision/);
 assert.match(sql,/account_hold_paused/);
 assert.match(sql,/account_hold_resumed/);
 assert.match(sql,/effective_end_date=p_start_date/);
});

test('released continuous hold applies before end date only',()=>{
 const scope={company:'3XB',account:'6242596342',business_date:'2026-10-22',effective_end_date:'2026-10-24',time_from:'00:00:00',time_to:'23:59:59',continuous:true};
 Holds.set([scope]);
 assert.equal(Holds.match({company:'3XB',account:'624-2-59634-2',date:'2026-10-22'}),scope);
 assert.equal(Holds.match({company:'3XB',account:'6242596342',date:'2026-10-23'}),scope);
 assert.equal(Holds.match({company:'3XB',account:'6242596342',date:'2026-10-24'}),null);
});

test('management page is separate and only exposes scoped adapter writes',()=>{
 const source=fs.readFileSync('account-review-holds.js','utf8'),app=fs.readFileSync('app.js','utf8');
 assert.match(source,/async function mountManager/);
 assert.match(source,/\['lead','admin'\]\.includes\(role\)/);
 assert.match(source,/ไม่รันซ้ำ · ไม่เปลี่ยนยอดหรือเคส/);
 assert.doesNotMatch(source,/fetch\(|\.rpc\(|service_role/i);
 assert.match(app,/id: "account-holds"/);
 assert.match(app,/VIEWS\['account-holds'\]/);
});
