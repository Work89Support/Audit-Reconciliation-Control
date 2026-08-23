-- Preserve 1-23 August 2026 as read-only history and start a clean
-- operational period on 24 August 2026.  Ingested files are never deleted.

begin;

create table if not exists public.audit_runtime_settings (
  id boolean primary key default true check (id),
  operational_start_date date not null,
  history_cutoff_date date not null,
  note text,
  updated_at timestamptz not null default now()
);

insert into public.audit_runtime_settings
  (id, operational_start_date, history_cutoff_date, note)
values
  (true, date '2026-08-24', date '2026-08-23',
   'เก็บข้อมูล 1-23 สิงหาคม 2569 เป็นประวัติ และเริ่มรอบปฏิบัติงานใหม่วันที่ 24 สิงหาคม 2569')
on conflict (id) do update
set operational_start_date=excluded.operational_start_date,
    history_cutoff_date=excluded.history_cutoff_date,
    note=excluded.note,
    updated_at=now();

create table if not exists public.audit_companies (
  code text primary key,
  display_name text not null,
  sort_order integer not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.audit_companies(code,display_name,sort_order) values
  ('3XB','3XB',10),
  ('AT4','AT4',20),
  ('FR8','FR8',30),
  ('SK8','SK8',40),
  ('MR9','MR9',50),
  ('MC8','MC8',60),
  ('UR9','UR9',70),
  ('PS8','PS8',80),
  ('UFABET7M','UFABET7M',90)
on conflict(code) do update
set display_name=excluded.display_name,
    sort_order=excluded.sort_order,
    active=true,
    updated_at=now();

alter table public.daily_recon_jobs
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_from_status text,
  add column if not exists archive_reason text;

create index if not exists daily_recon_jobs_active_queue_idx
  on public.daily_recon_jobs(status,business_date,updated_at)
  where not is_archived;

create or replace function public.apply_daily_recon_operating_scope()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_start date;
begin
  select operational_start_date into v_start
  from public.audit_runtime_settings where id=true;
  if v_start is not null and new.business_date < v_start then
    new.is_archived:=true;
    new.archived_at:=coalesce(new.archived_at,now());
    new.archived_from_status:=coalesce(new.archived_from_status,new.status);
    new.archive_reason:=coalesce(new.archive_reason,'ข้อมูลก่อนวันเริ่มรอบปฏิบัติงานใหม่');
  end if;
  return new;
end $$;

drop trigger if exists daily_recon_jobs_operating_scope on public.daily_recon_jobs;
create trigger daily_recon_jobs_operating_scope
before insert or update of business_date,status on public.daily_recon_jobs
for each row execute function public.apply_daily_recon_operating_scope();

update public.daily_recon_jobs j
set is_archived=true,
    archived_at=coalesce(j.archived_at,now()),
    archived_from_status=coalesce(j.archived_from_status,j.status),
    archive_reason=coalesce(j.archive_reason,'เก็บเป็นประวัติก่อนเริ่มรอบ 24 สิงหาคม 2569'),
    claimed_at=null,
    claimed_by=null,
    updated_at=now()
where j.business_date < date '2026-08-24';

create or replace function public.queue_due_daily_recon_jobs(
  p_from date default current_date-7,
  p_to date default current_date
)
returns setof public.daily_recon_jobs
language plpgsql security definer set search_path=public as $$
declare v_start date; v_from date; v_to date;
begin
  select operational_start_date into v_start from public.audit_runtime_settings where id=true;
  v_from:=greatest(coalesce(p_from,v_start),v_start);
  v_to:=greatest(coalesce(p_to,current_date),v_from);

  update public.daily_recon_jobs
  set status=case when attempt_count>=3 then 'error' else 'queued' end,
      claimed_at=null,claimed_by=null,
      last_error=case when attempt_count>=3
        then 'หยุดลองอัตโนมัติหลังล้มเหลว 3 ครั้ง: ตรวจรูปแบบไฟล์หรือเพิ่มไฟล์ที่ถูกต้อง'
        else 'กู้คิวอัตโนมัติ: งานเดิมค้างเกิน 15 นาที' end,
      updated_at=now()
  where not is_archived and status='running' and claimed_at<now()-interval '15 minutes';

  perform public.refresh_daily_recon_jobs(v_from,v_to);

  update public.daily_recon_jobs set status='needs_review',updated_at=now()
  where not is_archived and business_date between v_from and v_to and error_count>0;

  update public.daily_recon_jobs set status='queued',updated_at=now()
  where not is_archived and business_date between v_from and v_to
    and status='ready' and error_count=0;

  update public.daily_recon_jobs set status='needs_review',updated_at=now()
  where not is_archived and business_date between v_from and v_to
    and status='waiting_files' and cutoff_at<=now();

  insert into public.recon_notifications
    (dedupe_key,level,title,detail,business_date,company,job_id)
  select 'missing:'||j.id||':'||j.missing_groups::text,'warning','ไฟล์ยังไม่ครบหลังเวลาปิดรับ',
         'กลุ่มไฟล์ที่ขาด: '||j.missing_groups::text,j.business_date,j.company,j.id
  from public.daily_recon_jobs j
  where not j.is_archived and j.status='needs_review' and j.error_count=0
  on conflict(dedupe_key) do nothing;

  insert into public.recon_notifications
    (dedupe_key,level,title,detail,business_date,company,job_id)
  select 'retry-exhausted:'||j.id||':'||j.attempt_count,'error','หยุดลองกระทบยอดอัตโนมัติ',
         coalesce(j.last_error,'งานล้มเหลวซ้ำเกินกำหนด'),j.business_date,j.company,j.id
  from public.daily_recon_jobs j
  where not j.is_archived and j.status='error' and j.attempt_count>=3
  on conflict(dedupe_key) do nothing;

  return query select * from public.daily_recon_jobs
  where not is_archived and business_date between v_from and v_to
  order by business_date,company;
end $$;

create or replace function public.claim_daily_recon_job(p_worker text default 'web-worker')
returns public.daily_recon_jobs language plpgsql security definer set search_path=public as $$
declare v_job public.daily_recon_jobs%rowtype; v_start date;
begin
  select operational_start_date into v_start from public.audit_runtime_settings where id=true;
  select * into v_job from public.daily_recon_jobs
  where not is_archived and business_date>=v_start and status='queued' and attempt_count<3
  order by business_date,updated_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.daily_recon_jobs set status='running',claimed_at=now(),claimed_by=p_worker,
    attempt_count=attempt_count+1,last_error=null,updated_at=now()
  where id=v_job.id returning * into v_job;
  return v_job;
end $$;

create or replace function public.claim_daily_recon_jobs(
  p_worker text default 'n8n-cloud-worker',p_limit integer default 5
)
returns setof public.daily_recon_jobs
language plpgsql security definer set search_path=public as $$
declare v_worker text:=coalesce(nullif(p_worker,''),'n8n-cloud-worker'); v_start date;
begin
  select operational_start_date into v_start from public.audit_runtime_settings where id=true;
  if not pg_try_advisory_xact_lock(hashtext('daily-recon-worker-claim')) then return; end if;

  update public.daily_recon_jobs j
  set status='queued',claimed_at=null,claimed_by=null,
      last_error='คืนคิวอัตโนมัติหลัง worker timeout',updated_at=now()
  where not j.is_archived and j.business_date>=v_start and j.status='running'
    and j.claimed_by=v_worker and j.claimed_at<now()-interval '30 minutes'
    and not exists(select 1 from public.recon_runs r
      where r.summary->>'job_id'=j.id::text and r.created_at>=j.claimed_at);

  if exists(select 1 from public.daily_recon_jobs
    where not is_archived and business_date>=v_start and status='running' and claimed_by=v_worker)
  then return; end if;

  return query
  with picked as (
    select j.id from public.daily_recon_jobs j
    where not j.is_archived and j.business_date>=v_start and j.status='queued' and j.attempt_count<3
    order by j.business_date,j.company,j.updated_at
    for update skip locked limit greatest(1,least(coalesce(p_limit,5),20))
  ), updated as (
    update public.daily_recon_jobs j set status='running',claimed_at=now(),claimed_by=v_worker,
      attempt_count=j.attempt_count+1,last_error=null,updated_at=now()
    from picked p where j.id=p.id returning j.*
  ) select * from updated order by business_date,company;
end $$;

-- One row per company/day, including rows where no email has arrived yet.
create or replace view public.v_daily_company_checklist
with (security_invoker=true) as
with settings as (
  select operational_start_date,history_cutoff_date from public.audit_runtime_settings where id=true
), dates as (
  select generate_series(s.operational_start_date,
    greatest(current_date,s.operational_start_date),'1 day'::interval)::date business_date
  from settings s
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
  from public.mail_batches b join public.source_files f on f.batch_id=b.id
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
       coalesce(r.matched,0)::integer matched_count,
       r.match_rate,
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
left join public.daily_recon_jobs j on j.business_date=g.business_date and upper(j.company)=g.company and not j.is_archived
left join public.recon_runs r on r.id=j.last_run_id
left join ex on ex.job_id=j.id
order by g.business_date desc,g.sort_order;

drop view if exists public.v_recon_operations;
create view public.v_recon_operations with (security_invoker=true) as
select j.*,r.match_rate,r.matched,r.exception_count,r.elapsed_ms,
       coalesce(n.unread_count,0) unread_notification_count
from public.daily_recon_jobs j
left join public.recon_runs r on r.id=j.last_run_id
left join (select job_id,count(*) filter(where read_at is null) unread_count
           from public.recon_notifications group by job_id) n on n.job_id=j.id
order by j.business_date desc,j.company;

drop view if exists public.v_recon_quality;
create view public.v_recon_quality with (security_invoker=true) as
select j.business_date,j.company,j.business_system,j.status,j.missing_groups,j.file_count,j.error_count,
       j.is_archived,j.archived_at,j.archived_from_status,j.archive_reason,
       r.id run_id,r.created_at run_at,r.stm_count,r.bo_count,r.matched,r.match_rate,r.exception_count,r.summary
from public.daily_recon_jobs j left join public.recon_runs r on r.id=j.last_run_id;

drop view if exists public.v_recon_notification_status;
create view public.v_recon_notification_status with (security_invoker=true) as
select j.*,totals.actual_mail_total,totals.actual_file_total
from public.daily_recon_jobs j
cross join (select (select count(*) from public.mail_batches)::bigint actual_mail_total,
                   (select count(*) from public.source_files)::bigint actual_file_total) totals;

alter table public.audit_runtime_settings enable row level security;
alter table public.audit_companies enable row level security;
drop policy if exists audit_runtime_settings_authenticated on public.audit_runtime_settings;
create policy audit_runtime_settings_authenticated on public.audit_runtime_settings
for select to authenticated using(true);
drop policy if exists audit_companies_authenticated on public.audit_companies;
create policy audit_companies_authenticated on public.audit_companies
for select to authenticated using(true);

grant select on public.audit_runtime_settings,public.audit_companies to authenticated;
grant select on public.v_daily_company_checklist,public.v_recon_operations,
  public.v_recon_quality,public.v_recon_notification_status to authenticated;
revoke all on function public.queue_due_daily_recon_jobs(date,date) from public;
revoke all on function public.claim_daily_recon_job(text) from public;
revoke all on function public.claim_daily_recon_jobs(text,integer) from public;
grant execute on function public.queue_due_daily_recon_jobs(date,date) to authenticated;
grant execute on function public.claim_daily_recon_job(text) to authenticated;
grant execute on function public.claim_daily_recon_jobs(text,integer) to authenticated;

commit;
