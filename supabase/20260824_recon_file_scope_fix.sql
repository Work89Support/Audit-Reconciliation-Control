-- Count every attachment as received evidence, but send only reconciliation
-- files through the parser/quality gate. Clarification documents stay visible
-- without making an otherwise completed job look unfinished.

begin;

create or replace function public.refresh_daily_recon_job(
  p_business_date date,
  p_company text
)
returns public.daily_recon_jobs
language plpgsql
security definer
set search_path=public
as $$
declare
  v_req public.recon_requirements%rowtype;
  v_old public.daily_recon_jobs%rowtype;
  v_out public.daily_recon_jobs%rowtype;
  v_kinds text[]:='{}';
  v_missing jsonb:='[]'::jsonb;
  v_mails integer:=0;
  v_files integer:=0;
  v_parsed integer:=0;
  v_errors integer:=0;
  v_system text;
  v_status text;
  v_late boolean:=false;
begin
  if p_business_date is null or nullif(trim(p_company),'') is null then
    raise exception 'business_date and company are required';
  end if;

  select * into v_req
  from public.recon_requirements
  where company=p_company and active;
  if not found then
    select * into v_req
    from public.recon_requirements
    where company='*' and active;
  end if;
  if not found then raise exception 'No active reconciliation requirement'; end if;

  select count(distinct b.id),
         count(f.id),
         count(f.id) filter(where f.parsed),
         count(f.id) filter(where f.parse_error is not null),
         coalesce(array_agg(distinct f.kind) filter(where f.id is not null),'{}'),
         max(b.business_system)
  into v_mails,v_files,v_parsed,v_errors,v_kinds,v_system
  from public.mail_batches b
  join public.source_files f on f.batch_id=b.id
  where b.business_date=p_business_date
    and upper(coalesce(nullif(f.company,''),nullif(b.company,'')))=upper(p_company)
    and f.file_name~* '\.(xlsx|xlsm|xls|csv|pdf)$'
    and f.kind=any(array[
      'stm_pdf','pm_statement','bo_main','manual_credit','manual_payment',
      'manual_bonus','comm_req','credit_out'
    ]::text[]);

  select coalesce(jsonb_agg(g.value),'[]'::jsonb) into v_missing
  from jsonb_array_elements(v_req.required_groups) g
  where not exists (
    select 1 from jsonb_array_elements_text(g.value) k
    where k.value=any(v_kinds)
  );

  select * into v_old
  from public.daily_recon_jobs
  where business_date=p_business_date and company=p_company;

  if v_old.status='running' then
    v_status:='running';
  elsif v_old.status='completed' and v_files>0 and v_parsed=v_files and v_errors=0 then
    v_status:='completed';
  elsif v_old.status='error' and v_files=v_old.file_count and v_old.attempt_count>=3 then
    v_status:='error';
  elsif jsonb_array_length(v_missing)=0 and v_files>0 then
    v_status:=case when v_old.status='completed' then 'queued' else 'ready' end;
    v_late:=coalesce(v_old.status='completed' and v_parsed<v_files,false);
  else
    v_status:='waiting_files';
  end if;

  insert into public.daily_recon_jobs (
    business_date,company,business_system,status,present_kinds,missing_groups,
    mail_count,file_count,parsed_count,error_count,cutoff_at,late_file,
    rerun_requested_at
  ) values (
    p_business_date,p_company,v_system,v_status,v_kinds,v_missing,
    v_mails,v_files,v_parsed,v_errors,
    ((p_business_date+v_req.close_day_offset)::timestamp+v_req.close_time)
      at time zone 'Asia/Bangkok',
    v_late,case when v_late then now() else null end
  )
  on conflict (business_date,company) do update
  set business_system=excluded.business_system,
      status=excluded.status,
      present_kinds=excluded.present_kinds,
      missing_groups=excluded.missing_groups,
      mail_count=excluded.mail_count,
      file_count=excluded.file_count,
      parsed_count=excluded.parsed_count,
      error_count=excluded.error_count,
      cutoff_at=excluded.cutoff_at,
      late_file=daily_recon_jobs.late_file or excluded.late_file,
      attempt_count=case
        when excluded.file_count<>daily_recon_jobs.file_count then 0
        else daily_recon_jobs.attempt_count end,
      last_error=case
        when excluded.file_count<>daily_recon_jobs.file_count then null
        else daily_recon_jobs.last_error end,
      rerun_requested_at=coalesce(
        excluded.rerun_requested_at,daily_recon_jobs.rerun_requested_at),
      updated_at=now()
  returning * into v_out;

  if v_late then
    insert into public.recon_notifications(
      dedupe_key,level,title,detail,business_date,company,job_id
    ) values (
      'late:'||v_out.id||':'||v_files,'warning',
      'พบไฟล์มาช้าและเข้าคิวรันซ้ำ',
      'จำนวนไฟล์กระทบยอดเพิ่มเป็น '||v_files,
      p_business_date,p_company,v_out.id
    ) on conflict(dedupe_key) do nothing;
  end if;
  return v_out;
end;
$$;

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
         count(f.id) filter(where
           f.kind='stm_pdf' or (f.file_name~* '\.pdf$' and
             f.file_name~* 'ฝาก[[:space:]]*[-–—/]?[[:space:]]*ถอน|ฝากถอน|statement|STM'))::integer stm_count,
         count(f.id) filter(where
           f.kind='bo_main' or b.subject~* '(^|[^A-Z0-9])BO([^A-Z0-9]|$)|รายงานหน้า[[:space:]]*BO')::integer bo_count,
         count(f.id) filter(where f.kind='pm_statement' and f.file_name~* 'ฝาก')::integer pm_deposit_count,
         count(f.id) filter(where f.kind='pm_statement' and f.file_name~* 'ถอน')::integer pm_withdraw_count,
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

do $$
declare v_start date; v_from date; v_to date;
begin
  select operational_start_date into v_start
  from public.audit_runtime_settings where id=true;
  select min(b.business_date),max(b.business_date) into v_from,v_to
  from public.mail_batches b
  where b.business_date is not null
    and b.received_at >= (v_start::timestamp at time zone 'Asia/Bangkok');
  if v_from is not null then
    perform public.refresh_daily_recon_jobs(v_from,v_to);
    perform public.queue_due_daily_recon_jobs(v_from,v_to);
  end if;
end;
$$;

revoke all on function public.refresh_daily_recon_job(date,text) from public;
grant select on public.v_daily_company_checklist to authenticated;

commit;
