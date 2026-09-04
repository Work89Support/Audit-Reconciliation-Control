-- Accept evidence workbooks used by the audit team, including names such as
-- MC8_EVIDENCE(รวมความเสียหาย)_2026-09-02.xlsx. Keep the source file as
-- evidence; it must never enter the STM/BO transaction parser automatically.

begin;

create or replace function public.classify_source_file_template_name()
returns trigger
language plpgsql
set search_path=public
as $$
begin
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

update public.source_files
set kind='doc_clarify',
    parsed=false,
    parsed_at=null,
    row_count=null,
    parse_error=null
where kind='unknown'
  and (
    file_name ~* '(^|_)(COMMISSION_)?EVIDENCE(_|\(|[[:space:]]|$)'
    or file_name ~* 'รวมความเสียหาย|หลักฐาน|ชี้แจง'
  );

-- Old aggregate labels are systems/directions, not audit companies. Preserve
-- their history but keep them out of every active queue and summary.
update public.daily_recon_jobs
set is_archived=true,
    archived_at=coalesce(archived_at,now()),
    archived_from_status=coalesce(archived_from_status,status),
    archive_reason=coalesce(archive_reason,'ชื่อระบบ/ทิศทาง ไม่ใช่บริษัทในขอบเขตตรวจสอบ'),
    claimed_at=null,
    claimed_by=null,
    updated_at=now()
where upper(company) in ('SYS123','XXX','PM','BO','STM','DW')
  and not is_archived;

select public.refresh_daily_recon_jobs(
  greatest(date '2026-08-27', current_date-interval '14 days')::date,
  current_date
);

commit;
