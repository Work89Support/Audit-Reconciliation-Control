import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync(new URL('../supabase/20261031_tmn_review_auto_resume.sql',import.meta.url),'utf8');

test('reviewed 7M TMN evidence resumes only a safe automatic queue',()=>{
  assert.match(sql,/approve_reviewed_pdf_recovery_store_20261031\(p_payload,p_note\)/);
  assert.match(sql,/p_payload->>'company'<>'UFABET7M'/);
  assert.match(sql,/p_payload->>'bank'<>'TMN'/);
  assert.match(sql,/sourceType'<>'tmn-screenshot-list-v1'/);
  assert.match(sql,/audit_source_parse_reviewed\(f\.id\)/);
  assert.match(sql,/j\.status not in \('waiting_files','ready','needs_review','error'\)/);
  assert.match(sql,/status in \('ready','needs_review','error','waiting_files'\)/);
  assert.match(sql,/parsed_count=j\.file_count and j\.error_count=0/);
  assert.match(sql,/audit_run_holds[\s\S]*h\.paused/);
  assert.match(sql,/status='queued',attempt_count=0,last_error=null/);
  assert.match(sql,/rerun_requested_at=now\(\)/);
  assert.match(sql,/reviewed_tmn_auto_resume/);
  assert.doesNotMatch(sql,/update\s+public\.(exceptions|recon_runs|manual_primary_results|damages)/i);
  assert.doesNotMatch(sql,/delete\s+from/i);
});

test('completed and active jobs are explicitly excluded from TMN auto resume',()=>{
  assert.match(sql,/queued\/running\/completed are deliberately immutable here/);
  assert.match(sql,/primary_results_touched',0/);
  assert.match(sql,/closed_cases_touched',0/);
});
