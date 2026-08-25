-- Map the field team's short company code "SK" to canonical company SK8.
-- CPXM spreadsheets sent under a PM report are PM statements, not company PM.

begin;

create or replace function public.normalize_source_file_company() returns trigger
language plpgsql set search_path=public as $$
declare v_subject text;
begin
  select subject into v_subject from public.mail_batches where id=new.batch_id;

  if coalesce(v_subject,'') ~* 'รายงานหน้า[[:space:]]*BO'
     and new.file_name ~* '\.(xlsx|xlsm|xls|csv)$' then
    new.kind:='bo_main';
  elsif new.file_name ~* '\.pdf$'
     and new.file_name ~* 'ฝาก[[:space:]]*[-–—/]?[[:space:]]*ถอน|ฝากถอน|statement|(^|[^A-Z0-9])STM([^A-Z0-9]|$)' then
    new.kind:='stm_pdf';
  elsif new.kind='unknown'
     and new.file_name ~* '\.(xlsx|xlsm|xls|csv)$'
     and (coalesce(v_subject,'') ~* 'รายงาน[[:space:]]*PM'
       or new.file_name ~* 'AUTOPEER|CYBER|AZPAY|MYPAY|12PAY|CPXM') then
    new.kind:='pm_statement';
  end if;

  if new.file_name ~* '(^|[^A-Z0-9])AT4([^A-Z0-9]|$)' then new.company:='AT4';
  elsif new.file_name ~* '(^|[^A-Z0-9])FR8([^A-Z0-9]|$)' then new.company:='FR8';
  elsif new.file_name ~* '(^|[^A-Z0-9])SK8?([^A-Z0-9]|$)' then new.company:='SK8';
  elsif new.file_name ~* '(^|[^A-Z0-9])MR9?([^A-Z0-9]|$)' then new.company:='MR9';
  elsif new.file_name ~* '(^|[^A-Z0-9])MC8?([^A-Z0-9]|$)' then new.company:='MC8';
  elsif new.file_name ~* '(^|[^A-Z0-9])UR9([^A-Z0-9]|$)' then new.company:='UR9';
  elsif new.file_name ~* '(^|[^A-Z0-9])PS8([^A-Z0-9]|$)' then new.company:='PS8';
  elsif new.file_name ~* 'UFABET7M|(^|[^A-Z0-9])(UFA)?7M([^A-Z0-9]|$)' then new.company:='UFABET7M';
  elsif new.file_name ~* '(^|[^A-Z0-9])3X(BET|B)?([^A-Z0-9]|$)' then new.company:='3XB';
  elsif new.file_name ~* '(^|[^A-Z0-9])XXX([^A-Z0-9]|$)' then new.company:='XXX';
  elsif new.file_name ~* 'SYS123|ระบบ[[:space:]]*123' then new.company:='SYS123';
  end if;

  return new;
end $$;

drop trigger if exists source_files_normalize_company on public.source_files;
create trigger source_files_normalize_company
before insert or update of file_name,kind,batch_id on public.source_files
for each row execute function public.normalize_source_file_company();

update public.source_files f
set company='SK8',
    kind=case
      when f.kind='unknown' and f.file_name ~* '\.(xlsx|xlsm|xls|csv)$' then 'pm_statement'
      else f.kind
    end
from public.mail_batches b
where b.id=f.batch_id
  and f.file_name ~* '(^|[^A-Z0-9])SK([^A-Z0-9]|$)'
  and (b.subject ~* 'รายงาน[[:space:]]*PM' or f.file_name ~* 'CPXM');

select public.refresh_daily_recon_job(date '2026-08-24','SK8');

commit;
