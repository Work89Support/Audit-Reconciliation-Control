import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const sql=await readFile(new URL('../supabase/20261004_cross_day_evidence_only_followup.sql',import.meta.url),'utf8');
const body=sql.split('create or replace function public.queue_previous_recon_day_followup()')[1].split('end $$;')[0];
assert.ok(body.includes('public.review_cross_day_backlog(v_target)'));
assert.ok(body.includes("'mode','cross_day_evidence_only'"));
assert.ok(body.includes("status in('queued','running')"));
assert.ok(body.includes("source_parser_completion'='true'"));
assert.ok(body.includes("'queued',0"));
assert.doesNotMatch(body,/retry_daily_recon_job|insert into public\.exceptions|update public\.daily_recon_jobs|insert into public\.recon_runs/i);
assert.doesNotMatch(sql,/grant execute|revoke all/i);
assert.ok(sql.includes('historical_completed_evidence_only'));
assert.ok(sql.includes('historical_auto_queue_evidence_only'));
assert.ok(sql.includes("Asia/Bangkok''")&&sql.includes('::date-1'));
// The deployed reviewer is unchanged. Its identity and reservation guards
// are checked in the live rollback trial, not by importing an unstaged migration.
console.log('Cross-day follow-up: existing cases only, no full-day retries/new cases, identity/reservation guards retained');
