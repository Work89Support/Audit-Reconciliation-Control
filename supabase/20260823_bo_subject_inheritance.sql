-- BO is a property of the email/report, not necessarily part of each attachment filename.
-- Safe to run repeatedly in the Supabase SQL Editor.

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
  end if;

  if new.file_name ~* '(^|[^A-Z0-9])AT4([^A-Z0-9]|$)' then new.company:='AT4';
  elsif new.file_name ~* '(^|[^A-Z0-9])FR8([^A-Z0-9]|$)' then new.company:='FR8';
  elsif new.file_name ~* '(^|[^A-Z0-9])SK8([^A-Z0-9]|$)' then new.company:='SK8';
  elsif new.file_name ~* '(^|[^A-Z0-9])MR9?([^A-Z0-9]|$)' then new.company:='MR9';
  elsif new.file_name ~* '(^|[^A-Z0-9])MC8?([^A-Z0-9]|$)' then new.company:='MC8';
  elsif new.file_name ~* '(^|[^A-Z0-9])UR9([^A-Z0-9]|$)' then new.company:='UR9';
  elsif new.file_name ~* '(^|[^A-Z0-9])PS8([^A-Z0-9]|$)' then new.company:='PS8';
  elsif new.file_name ~* 'UFABET7M|(^|[^A-Z0-9])(UFA)?7M([^A-Z0-9]|$)' then new.company:='UFABET7M';
  elsif new.file_name ~* '(^|[^A-Z0-9])3X(BET|B)?([^A-Z0-9]|$)' then new.company:='3XB';
  elsif new.file_name ~* '(^|[^A-Z0-9])XXX([^A-Z0-9]|$)' then new.company:='XXX';
  elsif new.file_name ~* 'SYS123|ระบบ[[:space:]]*123' then new.company:='SYS123';
  end if;

  if new.kind='unknown' and new.file_name ~* 'AUTOPEER|CYBER|AZPAY|MYPAY|12PAY' then
    new.kind:='pm_statement';
  end if;
  return new;
end $$;

drop trigger if exists source_files_normalize_company on public.source_files;
create trigger source_files_normalize_company
before insert or update of file_name,kind,batch_id on public.source_files
for each row execute function public.normalize_source_file_company();

-- Repair files already ingested from a BO email even when names are only UR9.xlsx / mc.xlsx / MR9.xlsx.
update public.source_files f
set kind='bo_main'
from public.mail_batches b
where b.id=f.batch_id
  and b.subject ~* 'รายงานหน้า[[:space:]]*BO'
  and f.file_name ~* '\.(xlsx|xlsm|xls|csv)$'
  and f.kind is distinct from 'bo_main';

update public.source_files
set company=case
  when file_name ~* '(^|[^A-Z0-9])AT4([^A-Z0-9]|$)' then 'AT4'
  when file_name ~* '(^|[^A-Z0-9])FR8([^A-Z0-9]|$)' then 'FR8'
  when file_name ~* '(^|[^A-Z0-9])SK8([^A-Z0-9]|$)' then 'SK8'
  when file_name ~* '(^|[^A-Z0-9])MR9?([^A-Z0-9]|$)' then 'MR9'
  when file_name ~* '(^|[^A-Z0-9])MC8?([^A-Z0-9]|$)' then 'MC8'
  when file_name ~* '(^|[^A-Z0-9])UR9([^A-Z0-9]|$)' then 'UR9'
  when file_name ~* '(^|[^A-Z0-9])PS8([^A-Z0-9]|$)' then 'PS8'
  when file_name ~* '(^|[^A-Z0-9])3X(BET|B)?([^A-Z0-9]|$)' then '3XB'
  else company end
where file_name ~* '(^|[^A-Z0-9])(AT4|FR8|SK8|MR9?|MC8?|UR9|PS8|3X(BET|B)?)([^A-Z0-9]|$)';

commit;
