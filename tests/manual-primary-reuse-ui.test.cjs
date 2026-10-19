const assert=require('node:assert/strict'),fs=require('node:fs');
const p=require('../manual-primary.js');
const v={id:'new',company:'SK8',business_date:'2026-10-17',report:{exceptions:[{system_amount:300}]},case_set:{items:[{primary_id:'new',row_kind:'exception',row_index:0,exception_id:'existing'}]}};
const old={id:'existing',code:'ORIGINAL',status:'closed',resolution_note:'keep',customer_details:{manual_primary_id:'old',manual_primary_row_kind:'waiting',manual_primary_row_index:7}};
assert.equal(p.cases(v,[old])[0].status,'closed');assert.equal(p.cases(v,[old])[0].id,'existing');assert.equal(p.cases(v,[old])[0].resolution_note,'keep');
assert.equal(p.cases(v,[{...old,id:'wrong'}])[0].id,null);
assert.match(fs.readFileSync('supabase.js','utf8'),/waitingIds\.has\(e.id\)/);
assert.match(fs.readFileSync('manual-primary.js','utf8'),/ไม่สร้างซ้ำหรือเปิดเคสที่ปิดแล้ว/);
console.log('PASS UI uses current membership, preserves original closed case identity and supports waiting row remapping.');
