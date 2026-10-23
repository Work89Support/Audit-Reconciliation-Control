const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(
  path.join(__dirname, '..', 'supabase', '20261023_preserve_completed_unblocked_job.sql'),
  'utf8',
);

function expect(pattern, message) {
  if (!pattern.test(sql)) throw new Error(message);
}

expect(/old\.status='completed'/, 'only completed results may be preserved');
expect(/new\.status in \('ready','waiting_files','needs_review'\)/, 'derived refresh states must be covered');
expect(/new\.last_run_id is not distinct from old\.last_run_id/, 'a changed run must never be preserved blindly');
expect(/audit_run_preflight_review\(old\.company,old\.business_date\)/, 'live preflight must decide preservation');
expect(/not coalesce\(\(review->>'blocked'\)::boolean,true\)/, 'unknown review state must fail closed');
expect(/new\.status:='completed'/, 'safe accepted result must stay completed');
expect(/before update of status on public\.daily_recon_jobs/, 'guard must run before refresh changes status');

console.log('preserve completed unblocked job contract passed');
