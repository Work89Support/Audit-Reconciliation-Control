-- Recognize the new compact file-name convention immediately while keeping
-- compatibility with Thai legacy names such as รายการถอน_KB_ชื่อ_วัน.pdf.

begin;

create or replace function public.audit_file_direction(p_file_name text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when coalesce(p_file_name,'') ~* 'ฝาก.*ถอน|ถอน.*ฝาก|deposit.*withdraw|withdraw.*deposit|(^|[^A-Z0-9])DW([^A-Z0-9]|$)' then 'both'
    when coalesce(p_file_name,'') ~* 'ฝาก|deposit|(^|[^A-Z0-9])D([^A-Z0-9]|$)' then 'deposit'
    when coalesce(p_file_name,'') ~* 'ถอน|withdraw|(^|[^A-Z0-9])W([^A-Z0-9]|$)' then 'withdraw'
    else null
  end;
$$;

create or replace function public.audit_is_bank_statement_pdf(p_file_name text)
returns boolean
language sql
immutable
parallel safe
as $$
  select coalesce(p_file_name,'') ~* '\.pdf$'
    and (
      coalesce(p_file_name,'') ~* 'ฝาก[[:space:]]*[-–—/]?[[:space:]]*ถอน|ฝากถอน|statement|(^|[^A-Z0-9])STM([^A-Z0-9]|$)'
      or (
        coalesce(p_file_name,'') ~* '(^|[^A-Z0-9])(SCB|KB|KBANK|KTB|BBL|GSB|TMN|BAY|LBK|KRUNGSRI|TTB|UOB)([^A-Z0-9]|$)'
        and public.audit_file_direction(p_file_name) is not null
      )
    );
$$;

create or replace function public.normalize_source_file_company() returns trigger
language plpgsql set search_path=public as $$
declare v_subject text;
begin
  select subject into v_subject from public.mail_batches where id=new.batch_id;

  if coalesce(v_subject,'') ~* 'รายงานหน้า[[:space:]]*BO'
     and new.file_name ~* '\.(xlsx|xlsm|xls|csv)$' then
    new.kind:='bo_main';
  elsif public.audit_is_bank_statement_pdf(new.file_name) then
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

-- Repair previous files that were stored as clarification/unknown only because
-- their names contained one direction rather than the words STM or ฝาก-ถอน.
update public.source_files
set kind='stm_pdf', parsed=false, parse_error=null
where public.audit_is_bank_statement_pdf(file_name)
  and kind is distinct from 'stm_pdf';

create or replace view public.v_daily_company_checklist
with (security_invoker=true) as
with settings as (
  select operational_start_date,history_cutoff_date
  from public.audit_runtime_settings where id=true
), dates as (
  select generate_series(s.operational_start_date,
    greatest(current_date,s.operational_start_date),'1 day'::interval)::date business_date
  from settings s
  union
  select distinct b.business_date
  from public.mail_batches b cross join settings s
  where b.business_date is not null
    and b.received_at >= (s.operational_start_date::timestamp at time zone 'Asia/Bangkok')
), grid as (
  select d.business_date,c.code company,c.display_name,c.sort_order
  from dates d cross join public.audit_companies c where c.active
), files as (
  select b.business_date,
         upper(coalesce(nullif(f.company,''),nullif(b.company,''))) company,
         count(distinct b.id)::integer mail_count,
         count(f.id)::integer file_count,
         count(f.id) filter(where
           f.file_name~* '\.(xlsx|xlsm|xls|csv|pdf)$' and
           f.kind=any(array['stm_pdf','pm_statement','bo_main','manual_credit',
             'manual_payment','manual_bonus','comm_req','credit_out']::text[])
         )::integer recon_file_count,
         count(f.id) filter(where f.parsed and
           f.file_name~* '\.(xlsx|xlsm|xls|csv|pdf)$' and
           f.kind=any(array['stm_pdf','pm_statement','bo_main','manual_credit',
             'manual_payment','manual_bonus','comm_req','credit_out']::text[])
         )::integer parsed_count,
         count(f.id) filter(where f.parse_error is not null and
           f.file_name~* '\.(xlsx|xlsm|xls|csv|pdf)$' and
           f.kind=any(array['stm_pdf','pm_statement','bo_main','manual_credit',
             'manual_payment','manual_bonus','comm_req','credit_out']::text[])
         )::integer error_count,
         count(f.id) filter(where f.kind='stm_pdf' or public.audit_is_bank_statement_pdf(f.file_name))::integer stm_count,
         count(f.id) filter(where
           f.kind='bo_main' or b.subject~* '(^|[^A-Z0-9])BO([^A-Z0-9]|$)|รายงานหน้า[[:space:]]*BO')::integer bo_count,
         count(f.id) filter(where f.kind='pm_statement' and public.audit_file_direction(f.file_name) in ('deposit','both'))::integer pm_deposit_count,
         count(f.id) filter(where f.kind='pm_statement' and public.audit_file_direction(f.file_name) in ('withdraw','both'))::integer pm_withdraw_count,
         max(b.received_at) last_mail_at
  from public.mail_batches b
  join public.source_files f on f.batch_id=b.id
  group by b.business_date,upper(coalesce(nullif(f.company,''),nullif(b.company,'')))
), ex as (
  select j.id job_id,
         count(e.id)::integer exception_count,
         count(e.id) filter(where e.status in ('closed','approved'))::integer resolved_count,
         count(e.id) filter(where e.status not in ('closed','approved'))::integer open_count
  from public.daily_recon_jobs j
  left join public.exceptions e on e.run_id=j.last_run_id
  group by j.id
)
select g.business_date,g.company,g.display_name,
       false is_history,
       coalesce(j.status,'waiting_files') job_status,
       coalesce(f.mail_count,0) mail_count,coalesce(f.file_count,0) file_count,
       coalesce(f.parsed_count,0) parsed_count,coalesce(f.error_count,0) error_count,
       coalesce(f.stm_count,0) stm_count,coalesce(f.bo_count,0) bo_count,
       coalesce(f.pm_deposit_count,0) pm_deposit_count,
       coalesce(f.pm_withdraw_count,0) pm_withdraw_count,
       f.last_mail_at,j.cutoff_at,j.completed_at,j.last_error,
       coalesce(j.missing_groups,'[]'::jsonb) required_missing,
       coalesce(r.matched,0)::integer matched_count,r.match_rate,
       coalesce(ex.exception_count,0) exception_count,
       coalesce(ex.resolved_count,0) resolved_count,
       coalesce(ex.open_count,0) open_count,
       case when g.business_date>current_date then array[]::text[] else array_remove(array[
         case when coalesce(f.file_count,0)=0 then 'ยังไม่พบอีเมล/ไฟล์' end,
         case when coalesce(f.stm_count,0)=0 then 'ขาด STM ฝาก-ถอน' end,
         case when coalesce(f.bo_count,0)=0 then 'ขาด BO' end,
         case when coalesce(f.pm_deposit_count,0)=0 then 'ยังไม่พบ PM ฝาก' end,
         case when coalesce(f.pm_withdraw_count,0)=0 then 'ยังไม่พบ PM ถอน' end,
         case when coalesce(f.error_count,0)>0 then 'มีไฟล์อ่านไม่สำเร็จ' end,
         case when coalesce(f.recon_file_count,0)>0 and
           coalesce(f.parsed_count,0)+coalesce(f.error_count,0)<coalesce(f.recon_file_count,0)
           then 'มีไฟล์กระทบยอดรออ่าน' end,
         case when coalesce(ex.open_count,0)>0 then 'มีเคสยังไม่ปิด' end
       ],null) end missing_items,
       case
         when g.business_date>current_date then 'scheduled'
         when coalesce(f.file_count,0)=0 then 'missing_files'
         when coalesce(f.stm_count,0)=0 or coalesce(f.bo_count,0)=0 then 'missing_required'
         when coalesce(f.error_count,0)>0 then 'parse_error'
         when coalesce(f.parsed_count,0)<coalesce(f.recon_file_count,0) then 'waiting_parse'
         when coalesce(j.status,'waiting_files')='completed' and coalesce(ex.open_count,0)=0 then 'completed'
         when coalesce(j.status,'waiting_files')='completed' then 'open_cases'
         else coalesce(j.status,'waiting_files')
       end checklist_status,
       coalesce(f.recon_file_count,0) recon_file_count
from grid g
left join files f on f.business_date=g.business_date and f.company=g.company
left join public.daily_recon_jobs j
  on j.business_date=g.business_date and upper(j.company)=g.company and not j.is_archived
left join public.recon_runs r on r.id=j.last_run_id
left join ex on ex.job_id=j.id
order by g.business_date desc,g.sort_order;

-- Re-evaluate active jobs after repairing prior classifications.
do $$
declare v_start date;
begin
  select operational_start_date into v_start from public.audit_runtime_settings where id=true;
  perform public.refresh_daily_recon_jobs(v_start,current_date);
end $$;

commit;
