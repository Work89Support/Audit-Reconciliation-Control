begin;

-- Master expectations transcribed from the Audit account registry.
-- STM and PM counts are registered capacity, not a promise that every account
-- is used every day. BO is the only deterministic daily file requirement.
create table if not exists public.audit_company_file_rules (
  company text primary key references public.audit_companies(code) on update cascade,
  business_system text not null,
  expected_bo_files integer not null check (expected_bo_files > 0),
  registered_stm_accounts integer not null default 0 check (registered_stm_accounts >= 0),
  registered_pm_files integer not null default 0 check (registered_pm_files >= 0),
  pm_providers text[] not null default array[]::text[],
  inactive_pm_providers text[] not null default array[]::text[],
  pending_registry_pm_providers text[] not null default array[]::text[],
  registry_warning text,
  registry_source text not null,
  updated_at timestamptz not null default now()
);

-- Safe to rerun when the first version of this migration already created the table.
alter table public.audit_company_file_rules
  add column if not exists inactive_pm_providers text[] not null default array[]::text[],
  add column if not exists pending_registry_pm_providers text[] not null default array[]::text[];

insert into public.audit_company_file_rules
  (company,business_system,expected_bo_files,registered_stm_accounts,
   registered_pm_files,pm_providers,inactive_pm_providers,pending_registry_pm_providers,
   registry_warning,registry_source,updated_at)
values
  -- Counts and provider status below are from the live "ทะเบียนบัญชี" tab on 2026-08-31.
  -- They describe registered capacity only. Daily missing STM/PM is derived from
  -- the providers/accounts actually present in BO, never from these static counts.
  ('3XB','XXX',1,10,10,array['AUTOPEER','AZPAY','12PAY','MYPAY','COREPAY'],array[]::text[],array[]::text[],
    '12PAY ยังเป็นใช้งานในทะเบียน แม้ทีมแจ้งว่าไม่พบการใช้งานในปัจจุบัน','https://docs.google.com/spreadsheets/d/1PlxeE2CIH9uh93xFJ0LHmo-9TI931chDJxdckBzfaME',now()),
  ('FR8','123',2,6,9,array['AUTOPEER','AZPAY','CYBERPLUS','MYPAY','COREPAY'],array[]::text[],array['CPXM'],
    'คำตอบทีมระบุ CPXM แต่ทะเบียนชีตยังใช้ COREPAY จึงต้องยืนยันชื่อมาตรฐานเดียวกัน','https://docs.google.com/spreadsheets/d/1PlxeE2CIH9uh93xFJ0LHmo-9TI931chDJxdckBzfaME',now()),
  ('AT4','123',2,3,9,array['AUTOPEER','AZPAY','CYBERPLUS','MYPAY','COREPAY'],array[]::text[],array['CPXM'],
    'คำตอบทีมระบุ CPXM แต่ชีตยังเป็น COREPAY; MYPAY ยังเป็นใช้งานแม้ทีมแจ้งว่าไม่พบการใช้งาน','https://docs.google.com/spreadsheets/d/1PlxeE2CIH9uh93xFJ0LHmo-9TI931chDJxdckBzfaME',now()),
  ('SK8','123',2,2,9,array['AUTOPEER','AZPAY','CYBERPLUS','MYPAY','COREPAY'],array[]::text[],array['CPXM'],
    'คำตอบทีมระบุ CPXM แต่ชีตยังเป็น COREPAY; MYPAY ยังเป็นใช้งานแม้ทีมแจ้งว่าไม่พบการใช้งาน','https://docs.google.com/spreadsheets/d/1PlxeE2CIH9uh93xFJ0LHmo-9TI931chDJxdckBzfaME',now()),
  ('MR9','XXX',1,2,10,array['AUTOPEER','AZPAY','12PAY','MYPAY','COREPAY'],array[]::text[],array[]::text[],
    '12PAY ยังเป็นใช้งานในชีตแม้ทีมแจ้งว่าไม่พบการใช้งาน','https://docs.google.com/spreadsheets/d/1PlxeE2CIH9uh93xFJ0LHmo-9TI931chDJxdckBzfaME',now()),
  ('MC8','XXX',1,3,8,array['AUTOPEER','AZPAY','MYPAY','COREPAY'],array[]::text[],array[]::text[],null,'https://docs.google.com/spreadsheets/d/1PlxeE2CIH9uh93xFJ0LHmo-9TI931chDJxdckBzfaME',now()),
  ('UR9','XXX',1,3,8,array['AUTOPEER','AZPAY','MYPAY','COREPAY'],array[]::text[],array[]::text[],null,'https://docs.google.com/spreadsheets/d/1PlxeE2CIH9uh93xFJ0LHmo-9TI931chDJxdckBzfaME',now()),
  ('PS8','XXX',1,2,8,array['AUTOPEER','AZPAY','MYPAY','COREPAY'],array[]::text[],array[]::text[],null,'https://docs.google.com/spreadsheets/d/1PlxeE2CIH9uh93xFJ0LHmo-9TI931chDJxdckBzfaME',now()),
  ('UFABET7M','7M',1,6,8,array['AUTOPEER','AZPAY','CYBERPLUS','MYPAY'],array['COREPAY'],array[]::text[],null,'https://docs.google.com/spreadsheets/d/1PlxeE2CIH9uh93xFJ0LHmo-9TI931chDJxdckBzfaME',now())
on conflict (company) do update set
  business_system=excluded.business_system,
  expected_bo_files=excluded.expected_bo_files,
  registered_stm_accounts=excluded.registered_stm_accounts,
  registered_pm_files=excluded.registered_pm_files,
  pm_providers=excluded.pm_providers,
  inactive_pm_providers=excluded.inactive_pm_providers,
  pending_registry_pm_providers=excluded.pending_registry_pm_providers,
  registry_warning=excluded.registry_warning,
  registry_source=excluded.registry_source,
  updated_at=excluded.updated_at;

alter table public.audit_company_file_rules enable row level security;
drop policy if exists audit_company_file_rules_auth_read on public.audit_company_file_rules;
create policy audit_company_file_rules_auth_read on public.audit_company_file_rules
for select to authenticated using (true);
grant select on public.audit_company_file_rules to authenticated;

drop view if exists public.v_daily_company_checklist;
create view public.v_daily_company_checklist
with (security_invoker=true) as
with settings as (
  select operational_start_date,history_cutoff_date
  from public.audit_runtime_settings where id=true
), clock as (
  select (now() at time zone 'Asia/Bangkok')::date local_date,
         (now() at time zone 'Asia/Bangkok')::time local_time
), dates as (
  select generate_series(s.operational_start_date,
    greatest(c.local_date,s.operational_start_date),'1 day'::interval)::date business_date
  from settings s cross join clock c
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
         count(f.id) filter(where f.kind='bo_main')::integer bo_count,
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
), base as (
  select g.*,c.local_date,c.local_time,
         rule.business_system,rule.expected_bo_files,
         rule.registered_stm_accounts,rule.registered_pm_files,
         rule.pm_providers,rule.inactive_pm_providers,rule.pending_registry_pm_providers,
         rule.registry_warning,rule.registry_source,
         f.mail_count,f.file_count,f.recon_file_count,f.parsed_count,f.error_count,
         f.stm_count,f.bo_count,f.pm_deposit_count,f.pm_withdraw_count,f.last_mail_at,
         j.id job_id,j.status job_status,j.cutoff_at,j.completed_at,j.last_error,j.missing_groups,
         r.matched,r.match_rate,ex.exception_count,ex.resolved_count,ex.open_count
  from grid g cross join clock c
  left join public.audit_company_file_rules rule on rule.company=g.company
  left join files f on f.business_date=g.business_date and f.company=g.company
  left join public.daily_recon_jobs j
    on j.business_date=g.business_date and upper(j.company)=g.company and not j.is_archived
  left join public.recon_runs r on r.id=j.last_run_id
  left join ex on ex.job_id=j.id
)
select business_date,company,display_name,false is_history,
       coalesce(job_status,'waiting_files') job_status,
       coalesce(mail_count,0) mail_count,coalesce(file_count,0) file_count,
       coalesce(parsed_count,0) parsed_count,coalesce(error_count,0) error_count,
       coalesce(stm_count,0) stm_count,coalesce(bo_count,0) bo_count,
       coalesce(pm_deposit_count,0) pm_deposit_count,
       coalesce(pm_withdraw_count,0) pm_withdraw_count,
       last_mail_at,cutoff_at,completed_at,last_error,
       coalesce(missing_groups,'[]'::jsonb) required_missing,
       coalesce(matched,0)::integer matched_count,match_rate,
       coalesce(exception_count,0) exception_count,
       coalesce(resolved_count,0) resolved_count,
       coalesce(open_count,0) open_count,
       case when business_date>local_date then array[]::text[] else array_remove(array[
         case when coalesce(file_count,0)=0 and (business_date<local_date or local_time>=time '08:00') then 'ยังไม่พบอีเมล/ไฟล์' end,
         case when coalesce(bo_count,0)<coalesce(expected_bo_files,1) and (business_date<local_date or local_time>=time '08:00')
           then 'ขาด BO '||coalesce(bo_count,0)||'/'||coalesce(expected_bo_files,1) end,
         case when coalesce(error_count,0)>0 then 'มีไฟล์อ่านไม่สำเร็จ' end,
         case when coalesce(recon_file_count,0)>0 and coalesce(parsed_count,0)+coalesce(error_count,0)<coalesce(recon_file_count,0)
           then 'มีไฟล์กระทบยอดรออ่าน' end,
         case when coalesce(open_count,0)>0 then 'มีเคสยังไม่ปิด' end
       ],null) end missing_items,
       case
         when business_date>local_date then 'scheduled'
         when business_date=local_date and local_time<time '05:00' then 'scheduled'
         when coalesce(error_count,0)>0 then 'parse_error'
         when business_date=local_date and local_time<time '08:00' then 'receiving'
         when coalesce(file_count,0)=0 then 'missing_files'
         when coalesce(bo_count,0)<coalesce(expected_bo_files,1) then 'missing_required'
         when coalesce(parsed_count,0)<coalesce(recon_file_count,0) then 'waiting_parse'
         when coalesce(job_status,'waiting_files')='completed' and coalesce(open_count,0)=0 then 'completed'
         when coalesce(job_status,'waiting_files')='completed' then 'open_cases'
         else coalesce(job_status,'waiting_files')
       end checklist_status,
       coalesce(recon_file_count,0) recon_file_count,
       business_system,coalesce(expected_bo_files,1) expected_bo_count,
       coalesce(registered_stm_accounts,0) registered_stm_accounts,
       coalesce(registered_pm_files,0) registered_pm_files,
       coalesce(pm_providers,array[]::text[]) pm_providers,
       coalesce(inactive_pm_providers,array[]::text[]) inactive_pm_providers,
       coalesce(pending_registry_pm_providers,array[]::text[]) pending_registry_pm_providers,
       registry_warning,registry_source,
       case
         when business_date<local_date then 'closed_window'
         when local_time<time '05:00' then 'before_receive'
         when local_time<time '08:00' then 'receiving'
         when local_time<time '17:00' then 'auditing'
         when local_time<time '19:00' then 'clarification_upload'
         else 'audit_upload_overdue'
       end workflow_phase,
       case
         when business_date<local_date then 'ตรวจย้อนหลัง'
         when local_time<time '05:00' then 'รอรับไฟล์'
         when local_time<time '08:00' then 'กำลังรับไฟล์จากแอดมิน'
         when local_time<time '17:00' then 'กำลังตรวจและกระทบยอด'
         when local_time<time '19:00' then 'ส่งชี้แจงและอัปโหลดผลงาน'
         else 'เกิน 19:00 — ติดตามทีมออดิทให้อัปโหลดหรือชี้แจง'
       end workflow_phase_label
from base
order by business_date desc,sort_order;

grant select on public.v_daily_company_checklist to anon, authenticated;
notify pgrst, 'reload schema';

commit;
