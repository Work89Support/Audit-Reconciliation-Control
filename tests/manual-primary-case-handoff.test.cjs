const fs=require('node:fs'),assert=require('node:assert/strict');
const app=fs.readFileSync('app.js','utf8'),primary=fs.readFileSync('manual-primary.js','utf8');
assert.match(primary,/const saved=await opts.accept[\s\S]*?await opts.onAccepted\?\.\(saved\)/);
assert.match(app,/onAccepted:async value=>[\s\S]*?if\(value\?\.id\)await openManualPrimaryCaseSet\(value.id/);
assert.match(app,/onNewCaseSet: \['lead','admin'\].includes\(state.role\)\?openManualPrimaryCaseSet:null,[\s\S]*?isActive: \(\) => state.route === 'exceptions'/);
assert.equal((app.match(/onNewCaseSet: \['lead','admin'\].includes\(state.role\)\?openManualPrimaryCaseSet:null/g)||[]).length,2);
const flow=fs.readFileSync('primary-case-sets.js','utf8');assert.match(flow,/p.already_created/);assert.match(flow,/p_reviewed:true/);assert.match(flow,/latest.token!==p.token/);
assert.doesNotMatch(primary,/activateManualPrimaryCases|activate_manual_primary_cases/,'acceptance opens review, never silently creates cases');
console.log('PASS manual-primary handoff: both sheet entrypoints, accepted version passed to case review, explicit head/admin confirmation retained, no automatic acceptance or closure.');
