-- Recognize the agreed English file-name template independently of provider.
-- Examples: AT4_PM_COREPAY_D_2026-08-28.xlsx and SK8_MANUAL_CREDIT_2026-08-27.xlsx.

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
    when new.file_name ~* '(^|_)(COMMISSION_)?EVIDENCE_' then 'doc_clarify'
    else new.kind
  end;

  return new;
end;
$$;

drop trigger if exists source_files_template_kind on public.source_files;
create trigger source_files_template_kind
before insert or update of file_name, kind on public.source_files
for each row execute function public.classify_source_file_template_name();

-- Reclassify existing production-period files without requiring manual preview.
update public.source_files f
set kind = case
      when f.file_name ~* '(^|_)PM_[A-Z0-9]+_(D|W|DW)_[0-9]{4}[-_][0-9]{1,2}[-_][0-9]{1,2}' then 'pm_statement'
      when f.file_name ~* '(^|_)MANUAL_PAYMENT_' then 'manual_payment'
      when f.file_name ~* '(^|_)MANUAL_CREDIT_' then 'manual_credit'
      when f.file_name ~* '(^|_)MANUAL_BONUS_' then 'manual_bonus'
      when f.file_name ~* '(^|_)COMMISSION_WITHDRAW_' then 'comm_req'
      when f.file_name ~* '(^|_)CREDIT_WITHDRAW_' then 'credit_out'
      when f.file_name ~* '(^|_)(COMMISSION_)?EVIDENCE_' then 'doc_clarify'
      else f.kind
    end,
    parsed = false,
    parsed_at = null,
    parse_error = null
from public.mail_batches b
where b.id = f.batch_id
  and b.business_date >= date '2026-08-27'
  and f.kind = 'unknown'
  and f.file_name ~* '(^|_)(PM_[A-Z0-9]+_(D|W|DW)_[0-9]{4}[-_][0-9]{1,2}[-_][0-9]{1,2}|MANUAL_(PAYMENT|CREDIT|BONUS)_|COMMISSION_(WITHDRAW|EVIDENCE)_|CREDIT_WITHDRAW_|EVIDENCE_)';

select public.refresh_daily_recon_jobs(date '2026-08-27', current_date);
