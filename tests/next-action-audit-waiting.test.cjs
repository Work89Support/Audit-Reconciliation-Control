const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const start = app.indexOf('function nextActionForState() {');
const end = app.indexOf('\nfunction renderNextAction', start);
assert.ok(start >= 0 && end > start);
const sandbox = {
  cloudState: {batches: []}, liveIntakeState: {batches: []},
  liveOverviewState: {checklist: []}, statementNeedsBoReview: () => false,
  scopedWorkflowMetrics: () => ({approvalsAvailable: true, approvals: 0, followUps: 0, openAvailable: true, open: 0}),
  can: () => true, num: String,
  AuditReview: {rows: (rows, opts) => rows.filter(r => opts.canAccessCompany(r.company))},
  DB: {exceptions: [{company: '3XB'}, {company: 'OTHER'}]},
  state: {role: 'admin', filters: {}},
  canAccessCompany: c => c === '3XB',
  ROUTE_ROLES: {admin: ['audit-review'], clarifier: ['clarify']},
};
vm.createContext(sandbox);
vm.runInContext(app.slice(start, end), sandbox);
assert.equal(sandbox.nextActionForState().route, 'audit-review');
assert.match(sandbox.nextActionForState().label, /1 เคส/);
sandbox.DB.exceptions = [];
assert.equal(sandbox.nextActionForState().route, 'reports');
sandbox.DB.exceptions = [{company: '3XB'}];
sandbox.state.role = 'clarifier';
assert.equal(sandbox.nextActionForState().route, 'reports');
console.log('next action: audit waiting is defined, respects company and route scope');
const sb = fs.readFileSync(path.join(__dirname, '..', 'supabase.js'), 'utf8');
const evidence = sb.slice(sb.indexOf('async function matchedEvidence('), sb.indexOf('async function reconciliationEvidence('));
assert.match(evidence, /select=id,company,business_date,stm_count/);
