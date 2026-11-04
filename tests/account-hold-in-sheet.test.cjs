const assert=require('node:assert/strict');
const fs=require('node:fs');
const sheets=require('../mc8-live-sheets.js');

const hold={company:'FR8',account:'4102050696',business_date:'2026-11-04',continuous:true,effective_end_date:null,time_from:'00:00:00',time_to:'23:59:59',reason:'บัญชีธุรกรรมจริง จึงพักตรวจจนกว่าจะมี STM'};
assert.equal(sheets.holdForAccount([hold],'FR8','2026-11-04','SCB 410-205069-6'),hold);
assert.equal(sheets.holdForAccount([hold],'FR8','2026-11-05','4102050696'),hold);
assert.equal(sheets.holdForAccount([hold],'FR8','2026-11-03','4102050696'),null);
assert.equal(sheets.holdForAccount([hold],'3XB','2026-11-04','4102050696'),null);
assert.equal(sheets.holdForAccount([hold],'FR8','2026-11-04','4102050697'),null);
assert.equal(sheets.holdForAccount([{...hold,effective_end_date:'2026-11-06'}],'FR8','2026-11-06','4102050696'),null);
const ui=fs.readFileSync(require.resolve('../mc8-live-sheets.js'),'utf8');
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
assert.match(ui,/summaryRow\(group\.label,summarize\(group\.rows\),complete,group\.key,holdForAccount/);
assert.match(ui,/data-account-review-hold/);
assert.equal((app.match(/loadHoldScopes: Sb\.reviewHoldScopes/g)||[]).length,2);
