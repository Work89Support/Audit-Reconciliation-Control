-- Macro-enabled Word files are audit evidence, not reconciliation workbooks.
-- The worker intentionally supports xlsx/xlsm/xls/csv/pdf only; leaving .docm
-- as manual_credit/manual_payment makes the intake screen look incomplete even
-- though these files cannot produce transaction rows. Preserve every object and
-- record the reclassification in audit_log.

begin;

create or replace function public.classify_source_file_template_name()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  -- DOCM is a Word document even when its filename contains MANUAL_*.
  -- It may be linked to a case as supporting evidence, but must never enter the
  -- transaction parser or the daily reconciliation quality gate.
  if new.file_name ~* '\.docm$' then
    new.kind := 'doc_clarify';
    return new;
  end if;

  if coalesce(new.kind, 'unknown') <> 'unknown' then
    return new;
  end if;

  new.kind := case
    when new.file_name ~* '(^|_)PM_[A-Z0-9]+_(D|W|DW)_[0-9]{4}[-_][0-9]{1,2}[-_][0-9]{1,2}' then 'pm_statement'
    when new.file_name ~* '(^|_)MANUAL_PAYMENT_' then 'manual_payment'
    when new.file_name ~* '(^|_)MANUAL_CREDIT_' then 'manual_credit'
    when new.file_name ~* '(^|_)MANUAL_BONUS_' then 'manual_bonus'
    when new.file_name ~* '(^|_)COMMISSION_WITHDRAW_' then 'comm_req'
    when new.file_name ~* '(^|_)CREDIT_WITHDRAW_' then 'credit_out'
    when new.file_name ~* '(^|_)(COMMISSION_)?EVIDENCE(_|\(|[[:space:]]|$)'
      or new.file_name ~* 'รวมความเสียหาย|หลักฐาน|ชี้แจง'
      then 'doc_clarify'
    else new.kind
  end;

  return new;
end;
$$;

drop trigger if exists source_files_template_kind on public.source_files;
create trigger source_files_template_kind
before insert or update of file_name, kind on public.source_files
for each row execute function public.classify_source_file_template_name();

with changed as (
  update public.source_files f
  set kind='doc_clarify',
      parsed=false,
      parsed_at=null,
      row_count=null,
      parse_error=null
  where f.file_name ~* '\.docm$'
    and f.kind <> 'doc_clarify'
  returning f.id, f.company, f.file_name, f.batch_id
)
insert into public.audit_log(actor,action,entity,target,detail,meta)
select
  'system:migration-20260924',
  'reclassify_non_recon_document',
  'source_file',
  c.id::text,
  'จัด DOCM เป็นเอกสารประกอบ ไม่ส่งเข้า parser กระทบยอด',
  jsonb_build_object(
    'company', c.company,
    'file_name', c.file_name,
    'batch_id', c.batch_id,
    'new_kind', 'doc_clarify',
    'storage_object_preserved', true
  )
from changed c;

select public.refresh_daily_recon_jobs(date '2026-09-15', current_date);

commit;
