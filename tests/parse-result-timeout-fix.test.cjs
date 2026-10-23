const fs=require('node:fs'),assert=require('node:assert/strict');
const sql=fs.readFileSync('supabase/20261023_parse_result_timeout_fix.sql','utf8');
assert.match(sql,/drop trigger if exists source_files_refresh_recon_job/);
assert.match(sql,/after insert or delete or update of[\s\S]*batch_id[\s\S]*intake_original_kind/);
for(const parseField of ['parsed','parsed_at','row_count','parse_error']){
  const triggerColumns=sql.slice(sql.indexOf('after insert'),sql.indexOf('on public.source_files'));
  assert.doesNotMatch(triggerColumns,new RegExp(`\\b${parseField}\\b`));
}
assert.match(sql,/execute function public\.on_source_file_change\(\)/);
assert.match(sql,/alter function public\.record_source_file_parse_results\(uuid,jsonb\)[\s\S]*statement_timeout='60s'/);
console.log('Parse result timeout fix: registry changes refresh jobs; parse-result fields do not rescan the full day per file.');
