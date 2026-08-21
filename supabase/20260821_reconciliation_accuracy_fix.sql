-- Reconciliation accuracy hardening.
-- 1) A PM report no longer substitutes for the bank statement requirement.
-- 2) Completed jobs are re-opened when a newly enforced required side is absent.
-- 3) Current-result views never add obsolete reruns to operational totals.

begin;

update public.recon_requirements
set required_groups='[["stm_pdf"],["bo_main"]]'::jsonb,
    note='ต้องมี Statement ธนาคาร (STM) และรายงานหลังบ้าน (BO) ก่อนเริ่มกระทบยอด; PM เป็นคู่ข้อมูลเสริม ไม่ใช้แทน STM',
    updated_at=now()
where company='*';

-- Common misspelling seen in real attachments.
update public.source_files
set kind='pm_statement'
where kind='unknown' and file_name ~* 'CYBER|CYNER|CBY';

create or replace function public.refresh_daily_recon_job(p_business_date date, p_company text)
returns public.daily_recon_jobs language plpgsql security definer set search_path=public as $$
declare
  v_req public.recon_requirements%rowtype; v_old public.daily_recon_jobs%rowtype;
  v_out public.daily_recon_jobs%rowtype; v_kinds text[] := '{}'; v_missing jsonb := '[]'::jsonb;
  v_mails integer := 0; v_files integer := 0; v_parsed integer := 0; v_errors integer := 0;
  v_system text; v_status text; v_late boolean := false;
begin
  if p_business_date is null or nullif(trim(p_company),'') is null then raise exception 'business_date and company are required'; end if;
  select * into v_req from public.recon_requirements where company=p_company and active;
  if not found then select * into v_req from public.recon_requirements where company='*' and active; end if;
  if not found then raise exception 'No active reconciliation requirement'; end if;

  select count(distinct b.id), count(f.id), count(f.id) filter(where f.parsed),
         count(f.id) filter(where f.parse_error is not null),
         coalesce(array_agg(distinct case
           when f.file_name ~* '\.pdf$' and f.file_name ~* 'ฝาก[[:space:]]*[-–—/]?[[:space:]]*ถอน|ฝากถอน|statement|(^|[^A-Z0-9])STM([^A-Z0-9]|$)' then 'stm_pdf'
           when f.kind is not null and f.kind<>'unknown' then f.kind
           when f.file_name ~* '(ATP|AUTOPEER|AZPAY|12PAY|MYPAY|CYBER|CYNER|CBY|(^|[^A-Z])PM([^A-Z]|$))' then 'pm_statement'
           when f.file_name ~* '\.pdf$' then 'stm_pdf'
           when f.file_name ~* 'รายงานบัญชี(ฝาก|ถอน)|(^|[^A-Z])BO([^A-Z]|$)' then 'bo_main'
           else 'unknown' end) filter(where f.id is not null),'{}'), max(b.business_system)
  into v_mails,v_files,v_parsed,v_errors,v_kinds,v_system
  from public.mail_batches b join public.source_files f on f.batch_id=b.id
  where b.business_date=p_business_date and coalesce(f.company,b.company)=p_company;

  select coalesce(jsonb_agg(g.value),'[]'::jsonb) into v_missing
  from jsonb_array_elements(v_req.required_groups) g
  where not exists (select 1 from jsonb_array_elements_text(g.value) k where k.value=any(v_kinds));

  select * into v_old from public.daily_recon_jobs where business_date=p_business_date and company=p_company;
  if v_old.status='running' then
    v_status:='running';
  elsif jsonb_array_length(v_missing)=0 and v_files>0 then
    if v_old.status='completed' and v_files=v_old.file_count then v_status:='completed';
    elsif v_old.status='error' and v_files=v_old.file_count and v_old.attempt_count>=3 then v_status:='error';
    else v_status:='ready'; end if;
    v_late:=coalesce(v_old.status='completed' and v_files<>v_old.file_count,false);
  else
    v_status:='waiting_files';
  end if;

  insert into public.daily_recon_jobs (business_date,company,business_system,status,present_kinds,missing_groups,
    mail_count,file_count,parsed_count,error_count,cutoff_at,late_file,rerun_requested_at)
  values (p_business_date,p_company,v_system,v_status,v_kinds,v_missing,v_mails,v_files,v_parsed,v_errors,
    ((p_business_date+v_req.close_day_offset)::timestamp+v_req.close_time) at time zone 'Asia/Bangkok',
    v_late,case when v_late then now() else null end)
  on conflict (business_date,company) do update set business_system=excluded.business_system,status=excluded.status,
    present_kinds=excluded.present_kinds,missing_groups=excluded.missing_groups,mail_count=excluded.mail_count,
    file_count=excluded.file_count,parsed_count=excluded.parsed_count,error_count=excluded.error_count,
    cutoff_at=excluded.cutoff_at,late_file=daily_recon_jobs.late_file or excluded.late_file,
    attempt_count=case when excluded.file_count<>daily_recon_jobs.file_count then 0 else daily_recon_jobs.attempt_count end,
    last_error=case when excluded.file_count<>daily_recon_jobs.file_count then null else daily_recon_jobs.last_error end,
    rerun_requested_at=coalesce(excluded.rerun_requested_at,daily_recon_jobs.rerun_requested_at),updated_at=now()
  returning * into v_out;

  if v_late then insert into public.recon_notifications(dedupe_key,level,title,detail,business_date,company,job_id)
    values('late:'||v_out.id||':'||v_files,'warning','พบไฟล์มาช้าและเข้าคิวรันซ้ำ','จำนวนไฟล์เพิ่มเป็น '||v_files,p_business_date,p_company,v_out.id)
    on conflict(dedupe_key) do nothing; end if;
  return v_out;
end $$;

create or replace view public.v_current_exceptions as
select e.*
from public.daily_recon_jobs j
join public.exceptions e on e.run_id=j.last_run_id
where j.status='completed';

create or replace view public.v_recon_quality as
select j.business_date,j.company,j.business_system,j.status,j.missing_groups,j.file_count,j.error_count,
       r.id run_id,r.created_at run_at,r.stm_count,r.bo_count,r.matched,r.match_rate,r.exception_count,r.summary
from public.daily_recon_jobs j
left join public.recon_runs r on r.id=j.last_run_id;

grant select on public.v_current_exceptions to authenticated;
grant select on public.v_recon_quality to authenticated;

do $$
declare v_from date; v_to date;
begin
  select greatest(min(business_date),current_date-interval '120 days')::date,max(business_date)
    into v_from,v_to from public.mail_batches where business_date is not null;
  if v_from is not null then
    perform public.refresh_daily_recon_jobs(v_from,v_to);
    perform public.queue_due_daily_recon_jobs(v_from,v_to);
  end if;
end $$;

commit;
