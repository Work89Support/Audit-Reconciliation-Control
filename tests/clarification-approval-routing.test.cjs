const assert=require('node:assert/strict'),fs=require('node:fs');
const app=fs.readFileSync('app.js','utf8');
assert.match(app,/workflow\.approvalsAvailable && workflow\.approvals && can\('approve'\)[\s\S]*?route: "approvals"/);
assert.match(app,/saved\.clarification_file_id!==b\.dataset\.linkMail/);
assert.match(app,/data-review-evidence/);
assert.match(app,/openEvidenceRelatedCase\(b\.dataset\.reviewEvidence,\{focusFiles:true\}\)/);
assert.match(fs.readFileSync('audit-review.js','utf8'),/e\.status === 'open' && Boolean\(e\.clarificationFileId\)/);
console.log('Clarification review: approval route, saved file verification, linked open cases and exact case/file drawer passed');
