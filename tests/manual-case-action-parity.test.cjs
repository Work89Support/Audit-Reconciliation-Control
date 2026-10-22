const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');

const app=fs.readFileSync('app.js','utf8');
const sb=fs.readFileSync('supabase.js','utf8');
const overview=fs.readFileSync('review-overview.js','utf8');
const sql=fs.readFileSync('supabase/20261022_manual_case_action_parity.sql','utf8');
const html=fs.readFileSync('index.html','utf8');

for(const guard of [
  'public.primary_case_is_current(e.id)',
  'public.account_review_hold_for_case(e.id) is not null',
  "public.manual_pair_scoped_source_ready(e.id,'BO')",
  "public.manual_pair_scoped_source_ready(e.id,'STM')",
  "old.customer_details->>''manual_primary_id'' is null",
  'audit_case_action_ready(e.id)',
])assert.ok(sql.includes(guard),guard);
assert.match(sql,/create or replace function public\.request_current_case_clarification/);
assert.match(sql,/create or replace function public\.close_current_audit_case/);
assert.match(sql,/Definitions only: installation changes no case, amount/);
assert.match(sb,/rpc\('request_current_case_clarification'/);
assert.match(sb,/rpc\('close_current_audit_case'/);
assert.doesNotMatch(sb.slice(sb.indexOf('async function requestClarification'),sb.indexOf('async function manualPairCandidates')),/\/rest\/v1\/exceptions\?id=.*method: "PATCH"/s);
assert.match(overview,/\['open','pending_next_day'\]\.includes\(row\.status\)/);
assert.match(app,/\["open", "pending_next_day"\]\.includes\(e\.status\)/);
assert.match(html,/supabase\.js\?v=[^"']*manual-case-parity-20261022/);
assert.match(html,/app\.js\?v=[^"']*manual-case-parity-20261022/);

const start=app.indexOf('function exceptionSourceFileIds');
const end=app.indexOf('\n\nasync function loadExceptionSupport',start);
const context=vm.createContext({});
vm.runInContext(app.slice(start,end),context);
const files=context.exceptionSourceFileIds({customerDetails:{source_rows:{
  bo:{fileId:'bo-file'},stm:{fileId:'stm-file'},duplicate:{fileId:'bo-file'},other:{sourceFileId:'other-file'},empty:null,
}}});
assert.deepEqual([...files],['bo-file','stm-file','other-file']);
assert.deepEqual([...context.exceptionSourceFileIds({})],[]);
assert.match(app,/Sb\.exceptionFiles\(e\.runId, e\.clarificationFileId, sourceFileIds\)/);
assert.match(sb,/async function exceptionFiles\(runId, clarificationFileId, sourceFileIds = \[\]\)/);

console.log('PASS manual case action parity: current-primary guards, RPC clarification/closure, preserved return flow and source-file loading');
