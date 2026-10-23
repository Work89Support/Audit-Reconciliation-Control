-- Parsing a batch updates parsed/parsed_at/row_count/parse_error for every file.
-- Those fields are already aggregated by record_source_file_parse_results;
-- refreshing the whole daily job once per file causes large batches to time out.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

drop trigger if exists source_files_refresh_recon_job on public.source_files;
create trigger source_files_refresh_recon_job
after insert or delete or update of
  batch_id,
  file_name,
  from_zip,
  mime_type,
  size_bytes,
  storage_path,
  drive_file_id,
  drive_url,
  checksum,
  kind,
  company,
  intake_original_kind
on public.source_files
for each row execute function public.on_source_file_change();

-- Large companies can return thousands of normalized rows inside the per-file
-- result envelope. Keep the wider budget scoped to this RPC only.
alter function public.record_source_file_parse_results(uuid,jsonb)
  set statement_timeout='60s';

notify pgrst,'reload schema';
commit;
