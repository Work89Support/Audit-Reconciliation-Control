-- Operational scope follows the date the email reached the audit mailbox.
-- A report may legitimately describe the previous business day, so using
-- business_date alone would archive files that arrived after go-live.

begin;

create or replace function public.job_has_operational_mail(
  p_business_date date,
  p_company text
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  with settings as (
    select operational_start_date
    from public.audit_runtime_settings
    where id=true
  )
  select exists (
    select 1
    from public.mail_batches b
    join public.source_files f on f.batch_id=b.id
    cross join settings s
    where b.business_date=p_business_date
      and upper(coalesce(nullif(f.company,''),nullif(b.company,'')))=upper(p_company)
      and b.received_at >= (s.operational_start_date::timestamp at time zone 'Asia/Bangkok')
  );
$$;

create or replace function public.apply_daily_recon_operating_scope()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_start date;
  v_operational boolean;
begin
  select operational_start_date into v_start
  from public.audit_runtime_settings where id=true;

  v_operational := new.business_date>=v_start
    or public.job_has_operational_mail(new.business_date,new.company);

  if v_operational then
    new.is_archived:=false;
    new.archived_at:=null;
    new.archived_from_status:=null;
    new.archive_reason:=null;
  else
    new.is_archived:=true;
    new.archived_at:=coalesce(new.archived_at,now());
    new.archived_from_status:=coalesce(new.archived_from_status,new.status);
    new.archive_reason:=coalesce(new.archive_reason,'ไม่มีเมลที่รับเข้าหลังวันเริ่มระบบจริง');
  end if;
  return new;
end;
$$;

drop trigger if exists daily_recon_jobs_operating_scope on public.daily_recon_jobs;
create trigger daily_recon_jobs_operating_scope
before insert or update of business_date,company,status on public.daily_recon_jobs
for each row execute function public.apply_daily_recon_operating_scope();

create or replace function public.queue_due_daily_recon_jobs(
  p_from date default current_date-7,
  p_to date default current_date
)
returns setof public.daily_recon_jobs
language plpgsql
security definer
set search_path=public
as $$
declare
  v_from date:=least(coalesce(p_from,current_date-7),coalesce(p_to,current_date));
  v_to date:=greatest(coalesce(p_to,current_date),coalesce(p_from,current_date-7));
begin
  update public.daily_recon_jobs
  set status=case when attempt_count>=3 then 'error' else 'queued' end,
      claimed_at=null,
      claimed_by=null,
      last_error=case when attempt_count>=3
        then 'หยุดลองอัตโนมัติหลังล้มเหลว 3 ครั้ง: ตรวจรูปแบบไฟล์หรือเพิ่มไฟล์ที่ถูกต้อง'
        else 'กู้คิวอัตโนมัติ: งานเดิมค้างเกิน 15 นาที' end,
      updated_at=now()
  where not is_archived
    and status='running'
    and claimed_at<now()-interval '15 minutes';

  perform public.refresh_daily_recon_jobs(v_from,v_to);

  update public.daily_recon_jobs
  set status='needs_review',updated_at=now()
  where not is_archived
    and business_date between v_from and v_to
    and error_count>0;

  update public.daily_recon_jobs
  set status='queued',updated_at=now()
  where not is_archived
    and business_date between v_from and v_to
    and status='ready'
    and error_count=0;

  update public.daily_recon_jobs
  set status='needs_review',updated_at=now()
  where not is_archived
    and business_date between v_from and v_to
    and status='waiting_files'
    and cutoff_at<=now();

  insert into public.recon_notifications
    (dedupe_key,level,title,detail,business_date,company,job_id)
  select 'missing:'||j.id||':'||j.missing_groups::text,
         'warning','ไฟล์ยังไม่ครบหลังเวลาปิดรับ',
         'กลุ่มไฟล์ที่ขาด: '||j.missing_groups::text,
         j.business_date,j.company,j.id
  from public.daily_recon_jobs j
  where not j.is_archived
    and j.status='needs_review'
    and j.error_count=0
  on conflict(dedupe_key) do nothing;

  insert into public.recon_notifications
    (dedupe_key,level,title,detail,business_date,company,job_id)
  select 'retry-exhausted:'||j.id||':'||j.attempt_count,
         'error','หยุดลองกระทบยอดอัตโนมัติ',
         coalesce(j.last_error,'งานล้มเหลวซ้ำเกินกำหนด'),
         j.business_date,j.company,j.id
  from public.daily_recon_jobs j
  where not j.is_archived
    and j.status='error'
    and j.attempt_count>=3
  on conflict(dedupe_key) do nothing;

  return query
  select * from public.daily_recon_jobs
  where not is_archived and business_date between v_from and v_to
  order by business_date,company;
end;
$$;

create or replace function public.claim_daily_recon_job(
  p_worker text default 'web-worker'
)
returns public.daily_recon_jobs
language plpgsql
security definer
set search_path=public
as $$
declare v_job public.daily_recon_jobs%rowtype;
begin
  select * into v_job
  from public.daily_recon_jobs
  where not is_archived and status='queued' and attempt_count<3
  order by business_date,updated_at
  for update skip locked limit 1;
  if not found then return null; end if;

  update public.daily_recon_jobs
  set status='running',claimed_at=now(),claimed_by=p_worker,
      attempt_count=attempt_count+1,last_error=null,updated_at=now()
  where id=v_job.id returning * into v_job;
  return v_job;
end;
$$;

create or replace function public.claim_daily_recon_jobs(
  p_worker text default 'n8n-cloud-worker',
  p_limit integer default 5
)
returns setof public.daily_recon_jobs
language plpgsql
security definer
set search_path=public
as $$
declare v_worker text:=coalesce(nullif(p_worker,''),'n8n-cloud-worker');
begin
  if not pg_try_advisory_xact_lock(hashtext('daily-recon-worker-claim')) then return; end if;

  update public.daily_recon_jobs j
  set status='queued',claimed_at=null,claimed_by=null,
      last_error='คืนคิวอัตโนมัติหลัง worker timeout',updated_at=now()
  where not j.is_archived
    and j.status='running'
    and j.claimed_by=v_worker
    and j.claimed_at<now()-interval '30 minutes'
    and not exists (
      select 1 from public.recon_runs r
      where r.summary->>'job_id'=j.id::text and r.created_at>=j.claimed_at
    );

  if exists (
    select 1 from public.daily_recon_jobs
    where not is_archived and status='running' and claimed_by=v_worker
  ) then return; end if;

  return query
  with picked as (
    select j.id
    from public.daily_recon_jobs j
    where not j.is_archived and j.status='queued' and j.attempt_count<3
    order by j.business_date,j.company,j.updated_at
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,5),20))
  ), updated as (
    update public.daily_recon_jobs j
    set status='running',claimed_at=now(),claimed_by=v_worker,
        attempt_count=j.attempt_count+1,last_error=null,updated_at=now()
    from picked p where j.id=p.id returning j.*
  )
  select * from updated order by business_date,company;
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
         count(f.id) filter(where f.parsed)::integer parsed_count,
         count(f.id) filter(where f.parse_error is not null)::integer error_count,
         count(f.id) filter(where
           f.kind='stm_pdf' or (f.file_name~* '\.pdf$' and f.file_name~* 'ฝาก[[:space:]]*[-–—/]?[[:space:]]*ถอน|ฝากถอน|statement|STM'))::integer stm_count,
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
         case when coalesce(f.file_count,0)>0 and coalesce(f.parsed_count,0)+coalesce(f.error_count,0)<coalesce(f.file_count,0) then 'มีไฟล์รออ่าน' end,
         case when coalesce(ex.open_count,0)>0 then 'มีเคสยังไม่ปิด' end
       ],null) end missing_items,
       case
         when g.business_date>current_date then 'scheduled'
         when coalesce(f.file_count,0)=0 then 'missing_files'
         when coalesce(f.stm_count,0)=0 or coalesce(f.bo_count,0)=0 then 'missing_required'
         when coalesce(f.error_count,0)>0 then 'parse_error'
         when coalesce(f.parsed_count,0)<coalesce(f.file_count,0) then 'waiting_parse'
         when coalesce(j.status,'waiting_files')='completed' and coalesce(ex.open_count,0)=0 then 'completed'
         when coalesce(j.status,'waiting_files')='completed' then 'open_cases'
         else coalesce(j.status,'waiting_files')
       end checklist_status
from grid g
left join files f on f.business_date=g.business_date and f.company=g.company
left join public.daily_recon_jobs j
  on j.business_date=g.business_date and upper(j.company)=g.company and not j.is_archived
left join public.recon_runs r on r.id=j.last_run_id
left join ex on ex.job_id=j.id
order by g.business_date desc,g.sort_order;

-- Re-evaluate only reports that arrived after go-live. Historical rows remain.
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

revoke all on function public.job_has_operational_mail(date,text) from public;
revoke all on function public.queue_due_daily_recon_jobs(date,date) from public;
revoke all on function public.claim_daily_recon_job(text) from public;
revoke all on function public.claim_daily_recon_jobs(text,integer) from public;
grant execute on function public.queue_due_daily_recon_jobs(date,date) to authenticated;
grant execute on function public.claim_daily_recon_job(text) to authenticated;
grant execute on function public.claim_daily_recon_jobs(text,integer) to authenticated;
grant select on public.v_daily_company_checklist to authenticated;

commit;
