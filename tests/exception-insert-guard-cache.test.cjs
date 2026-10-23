const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(
  path.join(__dirname, '..', 'supabase', '20261023_exception_insert_guard_cache.sql'),
  'utf8',
);

function expect(pattern, message) {
  if (!pattern.test(sql)) throw new Error(message);
}

expect(/auth\.role\(\).*service_role/s, 'guard must remain service-role scoped');
expect(/from public\.daily_recon_jobs[\s\S]*for update/i, 'guard must retain the daily-job row lock');
expect(/audit_run_blocked\(new\.company,new\.business_date\)/, 'guard must retain the live blocked check');
expect(/current_setting\('audit\.automatic_run_guard_key',true\)/, 'guard must reuse a transaction-local decision');
expect(/set_config\('audit\.automatic_run_guard_key',guard_key,true\)/, 'guard cache must be transaction local');
expect(/company=new\.company[\s\S]*business_date=new\.business_date/, 'guard key scope must include company and date');

console.log('exception insert guard cache contract passed');
