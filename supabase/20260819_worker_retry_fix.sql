-- Worker retry guard and manual recovery helper.
-- Run this once in Supabase SQL Editor as the postgres role.

begin;

-- Keep the operating company from the subject. 3XB is a company label;
-- XXX is the business-system label and must not replace it.
create or replace function public.normalize_mail_batch_source() returns trigger
language plpgsql set search_path=public as $$
declare v_source public.mail_sources%rowtype; begin
  new.source_email:=coalesce(nullif(lower(new.source_email),''),lower(substring(coalesce(new.sender,'') from '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')));
  select * into v_source from public.mail_sources where email=new.source_email and active;
  if found then
    new.source_name:=coalesce(new.source_name,v_source.display_name);
    if new.business_system is null and cardinality(v_source.business_systems)=1 then new.business_system:=v_source.business_systems[1]; end if;
  end if;
  if coalesce(new.subject,'') ~* 'UFABET7M|(^|[^A-Z0-9])7M([^A-Z0-9]|$)' then new.business_system:='UFABET7M';
  elsif coalesce(new.subject,'') ~* 'XXX|(^|[^A-Z0-9])3XB([^A-Z0-9]|$)' then new.business_system:='XXX';
  elsif coalesce(new.subject,'') ~* '(ระบบ[[:space:]]*)?123|(^|[^A-Z0-9])(SK8|AT4|FR8)([^A-Z0-9]|$)' then new.business_system:='SYS123';
  end if;
  if new.company is null or upper(new.company) in ('BO','PM','STM','FWD','BBL','KBANK','SCB','KTB','BAY','GSB','TTB','LBK','XXX','SYS123') then
    if coalesce(new.subject,'') ~* '(^|[^A-Z0-9])3XB(ET)?([^A-Z0-9]|$)' then new.company:='3XB';
    elsif coalesce(new.subject,'') ~* '(^|[^A-Z0-9])AT4([^A-Z0-9]|$)' then new.company:='AT4';
    elsif coalesce(new.subject,'') ~* '(^|[^A-Z0-9])FR8([^A-Z0-9]|$)' then new.company:='FR8';
    elsif coalesce(new.subject,'') ~* '(^|[^A-Z0-9])SK8([^A-Z0-9]|$)' then new.company:='SK8';
    elsif coalesce(new.subject,'') ~* '(^|[^A-Z0-9])MR9([^A-Z0-9]|$)' then new.company:='MR9';
    elsif coalesce(new.subject,'') ~* '(^|[^A-Z0-9])MC8([^A-Z0-9]|$)' then new.company:='MC8';
    elsif coalesce(new.subject,'') ~* '(^|[^A-Z0-9])UR9([^A-Z0-9]|$)' then new.company:='UR9';
    elsif coalesce(new.subject,'') ~* '(^|[^A-Z0-9])PS8([^A-Z0-9]|$)' then new.company:='PS8';
    elsif coalesce(new.subject,'') ~* 'UFABET7M|(^|[^A-Z0-9])7M([^A-Z0-9]|$)' then new.company:='UFABET7M';
    else new.company:=new.business_system;
    end if;
  end if;
  return new;
end $$;

-- Recognize ฝาก-ถอน PDFs as bank statements even when different dash characters
-- or no spaces are used in the filename.
create or replace function public.normalize_source_file_company() returns trigger
language plpgsql set search_path=public as $$
begin
  if new.file_name ~* '\.pdf$' and new.file_name ~* 'ฝาก[[:space:]]*[-–—/]?[[:space:]]*ถอน|ฝากถอน|statement|(^|[^A-Z0-9])STM([^A-Z0-9]|$)' then new.kind:='stm_pdf'; end if;
  if new.file_name ~* '(^|[^A-Z0-9])AT4([^A-Z0-9]|$)' then new.company:='AT4';
  elsif new.file_name ~* '(^|[^A-Z0-9])FR8([^A-Z0-9]|$)' then new.company:='FR8';
  elsif new.file_name ~* '(^|[^A-Z0-9])SK8([^A-Z0-9]|$)' then new.company:='SK8';
  elsif new.file_name ~* '(^|[^A-Z0-9])MR9([^A-Z0-9]|$)' then new.company:='MR9';
  elsif new.file_name ~* '(^|[^A-Z0-9])MC8([^A-Z0-9]|$)' then new.company:='MC8';
  elsif new.file_name ~* '(^|[^A-Z0-9])UR9([^A-Z0-9]|$)' then new.company:='UR9';
  elsif new.file_name ~* '(^|[^A-Z0-9])PS8([^A-Z0-9]|$)' then new.company:='PS8';
  elsif new.file_name ~* 'UFABET7M|(^|[^A-Z0-9])7M([^A-Z0-9]|$)' then new.company:='UFABET7M';
  elsif new.file_name ~* '(^|[^A-Z0-9])3XB([^A-Z0-9]|$)' then new.company:='3XB';
  elsif new.file_name ~* '(^|[^A-Z0-9])XXX([^A-Z0-9]|$)' then new.company:='XXX';
  elsif new.file_name ~* 'SYS123|ระบบ[[:space:]]*123' then new.company:='SYS123';
  end if;
  if new.kind='unknown' and new.file_name ~* 'AUTOPEER|CYBER|AZPAY|MYPAY|12PAY' then new.kind:='pm_statement'; end if;
  return new;
end $$;

-- Backfill rows ingested before the corrected rules.
update public.mail_batches
set company=company
where subject ~* '(3XB(ET)?|AT4|FR8|SK8|MR9|MC8|UR9|PS8|UFABET7M)';

update public.source_files
set kind=kind
where file_name ~* '\.pdf$'
  and file_name ~* 'ฝาก[[:space:]]*[-–—/]?[[:space:]]*ถอน|ฝากถอน|statement|(^|[^A-Z0-9])STM([^A-Z0-9]|$)';

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
           when f.file_name ~* '(ATP|AZPAY|12PAY|MYPAY|(^|[^A-Z])PM([^A-Z]|$))' then 'pm_statement'
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
  if v_old.status='running' then v_status:='running';
  elsif v_old.status='completed' and v_files=v_old.file_count then v_status:='completed';
  elsif v_old.status='error' and v_files=v_old.file_count and v_old.attempt_count>=3 then v_status:='error';
  elsif jsonb_array_length(v_missing)=0 and v_files>0 then
    v_status:=case when v_old.status='completed' then 'queued' else 'ready' end;
    v_late:=coalesce(v_old.status='completed' and v_files<>v_old.file_count,false);
  else v_status:='waiting_files'; end if;

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

create or replace function public.queue_due_daily_recon_jobs(p_from date default current_date-7,p_to date default current_date)
returns setof public.daily_recon_jobs language plpgsql security definer set search_path=public as $$
begin
  update public.daily_recon_jobs set status=case when attempt_count>=3 then 'error' else 'queued' end,
    claimed_at=null,claimed_by=null,
    last_error=case when attempt_count>=3 then 'หยุดลองอัตโนมัติหลังล้มเหลว 3 ครั้ง: ตรวจรูปแบบไฟล์หรือเพิ่มไฟล์ที่ถูกต้อง'
      else 'กู้คิวอัตโนมัติ: งานเดิมค้างเกิน 15 นาที' end,updated_at=now()
    where status='running' and claimed_at < now()-interval '15 minutes';
  perform public.refresh_daily_recon_jobs(p_from,p_to);
  update public.daily_recon_jobs set status='queued',updated_at=now()
    where business_date between p_from and p_to and status='ready';
  update public.daily_recon_jobs set status='needs_review',updated_at=now()
    where business_date between p_from and p_to and status='waiting_files' and cutoff_at<=now();
  insert into public.recon_notifications(dedupe_key,level,title,detail,business_date,company,job_id)
    select 'missing:'||j.id||':'||j.missing_groups::text,'warning','ไฟล์ยังไม่ครบหลังเวลาปิดรับ',
      'กลุ่มไฟล์ที่ขาด: '||j.missing_groups::text,j.business_date,j.company,j.id
    from public.daily_recon_jobs j where j.status='needs_review' on conflict(dedupe_key) do nothing;
  insert into public.recon_notifications(dedupe_key,level,title,detail,business_date,company,job_id)
    select 'retry-exhausted:'||j.id||':'||j.attempt_count,'error','หยุดลองกระทบยอดอัตโนมัติ',
      coalesce(j.last_error,'งานล้มเหลวซ้ำเกินกำหนด'),j.business_date,j.company,j.id
    from public.daily_recon_jobs j where j.status='error' and j.attempt_count>=3
    on conflict(dedupe_key) do nothing;
  return query select * from public.daily_recon_jobs where business_date between p_from and p_to order by business_date,company;
end $$;

create or replace function public.claim_daily_recon_job(p_worker text default 'web-worker')
returns public.daily_recon_jobs language plpgsql security definer set search_path=public as $$
declare v_job public.daily_recon_jobs%rowtype; begin
  select * into v_job from public.daily_recon_jobs where status='queued' and attempt_count<3
    order by business_date,updated_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.daily_recon_jobs set status='running',claimed_at=now(),claimed_by=p_worker,
    attempt_count=attempt_count+1,last_error=null,updated_at=now() where id=v_job.id returning * into v_job;
  return v_job;
end $$;

create or replace function public.retry_daily_recon_job(p_job_id uuid)
returns public.daily_recon_jobs language plpgsql security definer set search_path=public as $$
declare v_job public.daily_recon_jobs%rowtype; begin
  update public.daily_recon_jobs set status='queued',attempt_count=0,last_error=null,
    claimed_at=null,claimed_by=null,rerun_requested_at=now(),updated_at=now()
    where id=p_job_id returning * into v_job;
  return v_job;
end $$;

revoke all on function public.refresh_daily_recon_job(date,text) from public;
revoke all on function public.queue_due_daily_recon_jobs(date,date) from public;
revoke all on function public.claim_daily_recon_job(text) from public;
revoke all on function public.retry_daily_recon_job(uuid) from public;
grant execute on function public.queue_due_daily_recon_jobs(date,date) to authenticated;
grant execute on function public.claim_daily_recon_job(text) to authenticated;
grant execute on function public.retry_daily_recon_job(uuid) to authenticated;

-- Rebuild completeness using the corrected company/kind assignments.
do $$
declare v_from date; v_to date;
begin
  select min(business_date),max(business_date) into v_from,v_to from public.mail_batches where business_date is not null;
  if v_from is not null then
    perform public.refresh_daily_recon_jobs(v_from,v_to);
    perform public.queue_due_daily_recon_jobs(v_from,v_to);
  end if;
end $$;

commit;
