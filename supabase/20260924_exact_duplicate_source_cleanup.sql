-- Keep one auditable reconciliation source for byte-equivalent duplicate
-- attachments. The older copies remain in Storage and source_files as evidence.
begin;

with ranked as (
  select
    f.id,
    row_number() over (
      partition by b.business_date,
                   upper(coalesce(f.company, b.company)),
                   lower(regexp_replace(trim(f.file_name), '\s+', ' ', 'g')),
                   coalesce(f.size_bytes, 0),
                   coalesce(f.checksum, '')
      order by f.created_at desc, f.id desc
    ) as copy_rank
  from public.source_files f
  join public.mail_batches b on b.id = f.batch_id
  where f.kind in ('stm_pdf', 'pm_statement', 'bo_main')
    and coalesce(f.size_bytes, 0) > 0
), duplicates as (
  select id from ranked where copy_rank > 1
), changed as (
  update public.source_files f
     set kind = 'doc_clarify',
         parsed = false,
         parsed_at = null,
         row_count = null,
         parse_error = null
   where f.id in (select id from duplicates)
     and f.kind <> 'doc_clarify'
  returning f.id, f.file_name, f.storage_path
)
insert into public.audit_log(actor, action, entity, target, detail, meta)
select
  'system:migration-20260924',
  'exact_duplicate_source_reclassified',
  'source_file',
  id::text,
  'จัดไฟล์แนบซ้ำเป็นเอกสารประกอบ โดยเก็บไฟล์ใหม่สุดไว้กระทบยอด',
  jsonb_build_object(
    'file_name', file_name,
    'storage_path', storage_path,
    'reason', 'older byte-equivalent attachment retained as evidence; newest copy remains reconciliation source'
  )
from changed;

select public.refresh_daily_recon_jobs(date '2026-09-15', current_date);

commit;
