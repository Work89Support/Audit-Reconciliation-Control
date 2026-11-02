-- A checksum-bound, fully reviewed TMN visual transcription is an effective
-- parse for queue/refresh purposes. The raw parser error is deliberately kept
-- on source_files so the automatic parse is never misrepresented as success.

create or replace function public.audit_source_file_effectively_parsed(
  p_file_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $function$
  select coalesce(source_file.parsed, false)
    or public.audit_source_parse_reviewed(source_file.id)
    or (
      source_file.file_name !~* '(?:^|[^A-Z])BBL(?:[^A-Z]|$)|ธนาคารกรุงเทพ'
      and exists (
        select 1
        from public.source_files parsed_file
        join public.mail_batches parsed_batch
          on parsed_batch.id = parsed_file.batch_id
        join storage.objects source_object
          on source_object.bucket_id = 'audit-files'
         and source_object.name = source_file.storage_path
        join storage.objects parsed_object
          on parsed_object.bucket_id = 'audit-files'
         and parsed_object.name = parsed_file.storage_path
        where parsed_file.id <> source_file.id
          and coalesce(parsed_file.parsed, false)
          and parsed_batch.business_date = source_batch.business_date
          and upper(coalesce(nullif(parsed_file.company, ''), nullif(parsed_batch.company, '')))
              = upper(coalesce(nullif(source_file.company, ''), nullif(source_batch.company, '')))
          and lower(regexp_replace(trim(parsed_file.file_name), '[[:space:]]+', ' ', 'g'))
              = lower(regexp_replace(trim(source_file.file_name), '[[:space:]]+', ' ', 'g'))
          and parsed_file.size_bytes is not distinct from source_file.size_bytes
          and nullif(parsed_object.metadata ->> 'eTag', '') is not null
          and parsed_object.metadata ->> 'eTag' = source_object.metadata ->> 'eTag'
      )
    )
  from public.source_files source_file
  join public.mail_batches source_batch
    on source_batch.id = source_file.batch_id
  where source_file.id = p_file_id;
$function$;

revoke all on function public.audit_source_file_effectively_parsed(uuid) from public;
grant execute on function public.audit_source_file_effectively_parsed(uuid)
  to authenticated, service_role;

comment on function public.audit_source_file_effectively_parsed(uuid) is
  'True for a raw parse, a checksum-bound complete TMN visual review, or a byte-identical parsed non-BBL sibling.';
