-- =============================================================
-- Audit AI Reconciliation — Supabase schema
-- รันไฟล์นี้ทั้งไฟล์ใน Supabase → SQL Editor → New query → Run
-- ปลอดภัยที่จะรันซ้ำ (ใช้ if not exists / create or replace ทุกจุด)
-- =============================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- 1) ทะเบียนเมลที่ n8n ดึงเข้ามา (1 แถว = 1 เมล)
-- -------------------------------------------------------------
create table if not exists public.mail_batches (
  id                uuid primary key default gen_random_uuid(),
  gmail_message_id  text not null unique,
  gmail_thread_id   text,
  mailbox           text,                       -- work.ltd89@gmail.com
  label             text,                       -- AUDIT 2
  subject           text,
  sender            text,                       -- ผู้ส่งต่อจาก Gmail
  received_at       timestamptz,
  company           text,                       -- AT4 / SK8 / FR8 (แกะจากหัวข้อ)
  business_date     date,                       -- 20-07-69 -> 2026-07-20
  is_supplement     boolean default false,      -- "ส่งตรวจบัญชีเพิ่มเติม"
  file_count        integer default 0,
  status            text default 'new'
                    check (status in ('new','stored','parsed','error')),
  note              text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists mail_batches_date_idx    on public.mail_batches (business_date desc);
create index if not exists mail_batches_company_idx on public.mail_batches (company, business_date desc);
create index if not exists mail_batches_status_idx  on public.mail_batches (status);

-- -------------------------------------------------------------
-- 2) ไฟล์แนบทุกไฟล์ (แตก zip แล้ว) — ไฟล์จริงอยู่ใน Storage
-- -------------------------------------------------------------
create table if not exists public.source_files (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid references public.mail_batches(id) on delete cascade,
  file_name     text not null,
  from_zip      text,                            -- ชื่อไฟล์ zip ต้นทาง ถ้ามี
  mime_type     text,
  size_bytes    bigint,
  storage_path  text not null,                   -- 2026-07-20/AT4/AT4 รายงานบัญชีฝาก.xlsx
  drive_file_id text,
  drive_url     text,
  checksum      text,
  kind          text default 'unknown',          -- bo_main | manual_credit | manual_payment |
                                                 -- manual_bonus | comm_req | credit_out |
                                                 -- stm_pdf | doc_clarify | unknown
  parsed        boolean default false,
  parsed_at     timestamptz,
  row_count     integer,
  parse_error   text,
  created_at    timestamptz default now(),
  unique (batch_id, file_name, from_zip)
);

create index if not exists source_files_batch_idx  on public.source_files (batch_id);
create index if not exists source_files_parsed_idx on public.source_files (parsed);
create index if not exists source_files_kind_idx   on public.source_files (kind);
create unique index if not exists source_files_storage_path_uidx on public.source_files (storage_path);
create index if not exists source_files_checksum_idx on public.source_files (checksum) where checksum is not null;

-- -------------------------------------------------------------
-- 3) ผลการกระทบยอดแต่ละครั้ง
-- -------------------------------------------------------------
create table if not exists public.recon_runs (
  id             uuid primary key default gen_random_uuid(),
  business_date  date not null,
  company        text,
  run_by         text,
  started_at     timestamptz default now(),
  elapsed_ms     integer,
  stm_count      integer default 0,
  bo_count       integer default 0,
  matched        integer default 0,
  match_rate     numeric(6,3),
  exception_count integer default 0,
  no_stm_count   integer default 0,
  file_ids       uuid[],
  summary        jsonb,
  created_at     timestamptz default now()
);

create index if not exists recon_runs_date_idx on public.recon_runs (business_date desc);

-- -------------------------------------------------------------
-- 4) รายการผิดปกติ
-- -------------------------------------------------------------
create table if not exists public.exceptions (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid references public.recon_runs(id) on delete cascade,
  code           text,                   -- EX-3001
  business_date  date,
  occurred_at    time,
  company        text,
  bank           text,
  account        text,
  direction      text,
  member_code    text,
  ex_type        text,
  type_name      text,
  severity       text check (severity in ('critical','high','medium','low')),
  status         text default 'open',
  track          text,                   -- daily | cycle
  due_at         timestamptz,
  system_amount  numeric(16,2),
  bank_amount    numeric(16,2),
  amount_diff    numeric(16,2),
  risk_amount    numeric(16,2),
  currency       text default 'THB',
  fx_rate        numeric(12,4),
  time_diff_sec  integer,
  employee       text,
  shift          text,
  cause          text,
  detail         text,
  stm_raw        text,
  bo_raw         text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique (run_id, code)
);

create index if not exists exceptions_date_idx     on public.exceptions (business_date desc);
create index if not exists exceptions_severity_idx on public.exceptions (severity, status);
create index if not exists exceptions_track_idx    on public.exceptions (track, status);

-- -------------------------------------------------------------
-- 5) อัตราแลกเปลี่ยน USDT/THB รายวัน (log ห้ามทับของเดิม)
-- -------------------------------------------------------------
create table if not exists public.fx_rates (
  id          uuid primary key default gen_random_uuid(),
  rate_date   date not null unique,
  quote       text default 'USDT',
  base        text default 'THB',
  rate        numeric(12,4) not null check (rate > 0 and rate < 1000),
  recorded_by text,
  recorded_at timestamptz default now(),
  note        text,
  ref_source  text,
  ref_rate    numeric(12,4),
  revisions   jsonb default '[]'::jsonb
);

-- เก็บค่าเดิมลง revisions อัตโนมัติเมื่อมีการแก้
create or replace function public.fx_keep_revision() returns trigger as $$
begin
  if new.rate is distinct from old.rate or new.note is distinct from old.note then
    new.revisions := coalesce(old.revisions, '[]'::jsonb) || jsonb_build_object(
      'rate', old.rate, 'by', old.recorded_by, 'at', old.recorded_at, 'note', old.note
    );
    new.recorded_at := now();
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists fx_rates_revision on public.fx_rates;
create trigger fx_rates_revision before update on public.fx_rates
  for each row execute function public.fx_keep_revision();

-- -------------------------------------------------------------
-- 6) ทะเบียนความเสียหาย
-- -------------------------------------------------------------
create table if not exists public.damages (
  id             uuid primary key default gen_random_uuid(),
  code           text,
  exception_id   uuid references public.exceptions(id) on delete set null,
  business_date  date,
  company        text,
  employee       text,
  shift          text,
  amount         numeric(16,2) not null,
  currency       text default 'THB',
  fx_rate        numeric(12,4),
  amount_thb     numeric(16,2),
  cause          text,
  cycle          text,                    -- C1 / C2 / C3
  has_evidence   boolean default false,
  hr_status      text,
  finance_status text,
  closed_at      timestamptz,
  created_at     timestamptz default now()
);

create index if not exists damages_cycle_idx on public.damages (business_date desc, cycle);

-- -------------------------------------------------------------
-- 7) เอกสารชี้แจงที่ออกจากระบบ
-- -------------------------------------------------------------
create table if not exists public.clarify_docs (
  id             uuid primary key default gen_random_uuid(),
  doc_no         text not null,
  doc_type       text check (doc_type in ('request','clarification')),
  business_date  date,
  company        text,
  track          text,
  shift          text,
  cycle          text,
  item_count     integer,
  total_amount   numeric(16,2),
  issued_by      text,
  issued_at      timestamptz default now(),
  due_at         timestamptz,
  storage_path   text,
  drive_url      text,
  exception_ids  uuid[],
  unique (doc_no)
);

-- -------------------------------------------------------------
-- 8) Audit log
-- -------------------------------------------------------------
create table if not exists public.audit_log (
  id         bigserial primary key,
  at         timestamptz default now(),
  actor      text,
  action     text,
  entity     text,
  target     text,
  detail     text,
  meta       jsonb
);

create index if not exists audit_log_at_idx on public.audit_log (at desc);

-- -------------------------------------------------------------
-- 9) ทะเบียนผู้ส่ง + คิวกระทบยอดรายวัน
-- -------------------------------------------------------------
create table if not exists public.mail_sources (
  email text primary key, display_name text not null,
  business_systems text[] not null default '{}', expected_reports text[] not null default '{}',
  active boolean not null default true, note text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ทะเบียนผู้ส่งจริงเป็นข้อมูลส่วนบุคคล: เพิ่มผ่าน SQL Editor ที่มีสิทธิ์เท่านั้น
-- ไม่เก็บอีเมลจริงไว้ใน source code / GitHub repository

alter table public.mail_batches add column if not exists source_email text;
alter table public.mail_batches add column if not exists source_name text;
alter table public.mail_batches add column if not exists business_system text;

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
  if new.company is null or upper(new.company) in ('BO','PM','STM','FWD','BBL','KBANK','SCB','KTB','BAY','GSB','TTB','LBK') then
    new.company:=new.business_system;
  end if;
  return new;
end $$;
drop trigger if exists mail_batches_normalize_source on public.mail_batches;
create trigger mail_batches_normalize_source before insert or update on public.mail_batches
for each row execute function public.normalize_mail_batch_source();

update public.mail_batches set source_email=source_email where source_email is not null or sender is not null;

create table if not exists public.recon_requirements (
  company text primary key,
  required_groups jsonb not null default '[["stm_pdf"],["bo_main"]]'::jsonb,
  close_time time not null default '10:00', close_day_offset integer not null default 1,
  active boolean not null default true, note text, updated_at timestamptz default now(),
  check (jsonb_typeof(required_groups) = 'array')
);

insert into public.recon_requirements (company, required_groups, note)
values ('*', '[["stm_pdf","pm_statement"],["bo_main","manual_credit","manual_payment","manual_bonus"]]'::jsonb,
        'ค่าเริ่มต้น: ต้องมีอย่างน้อยหนึ่งไฟล์ฝั่งธนาคาร/PM และหนึ่งไฟล์ฝั่ง BO')
on conflict (company) do nothing;

create table if not exists public.daily_recon_jobs (
  id uuid primary key default gen_random_uuid(), business_date date not null, company text not null,
  business_system text,
  status text not null default 'waiting_files' check (status in ('waiting_files','ready','queued','running','completed','needs_review','error')),
  present_kinds text[] not null default '{}', missing_groups jsonb not null default '[]'::jsonb,
  mail_count integer not null default 0, file_count integer not null default 0,
  parsed_count integer not null default 0, error_count integer not null default 0,
  cutoff_at timestamptz, late_file boolean not null default false, rerun_requested_at timestamptz,
  claimed_at timestamptz, claimed_by text, completed_at timestamptz,
  last_run_id uuid references public.recon_runs(id) on delete set null,
  attempt_count integer not null default 0, last_error text,
  created_at timestamptz default now(), updated_at timestamptz default now(), unique (business_date, company)
);
create index if not exists daily_recon_jobs_status_idx on public.daily_recon_jobs (status, business_date);

create table if not exists public.recon_notifications (
  id bigserial primary key, dedupe_key text not null unique,
  level text not null check (level in ('info','warning','error','success')),
  title text not null, detail text, business_date date, company text,
  job_id uuid references public.daily_recon_jobs(id) on delete cascade,
  read_at timestamptz, created_at timestamptz default now()
);

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
           when f.kind is not null and f.kind<>'unknown' then f.kind
           when f.file_name ~* '(ATP|AZPAY|12PAY|MYPAY|(^|[^A-Z])PM([^A-Z]|$))' then 'pm_statement'
           when f.file_name ~* '\.pdf$' then 'stm_pdf'
           when f.file_name ~* 'รายงานบัญชี(ฝาก|ถอน)|(^|[^A-Z])BO([^A-Z]|$)' then 'bo_main'
           else 'unknown' end) filter(where f.id is not null),'{}'), max(b.business_system)
  into v_mails,v_files,v_parsed,v_errors,v_kinds,v_system
  from public.mail_batches b left join public.source_files f on f.batch_id=b.id
  where b.business_date=p_business_date and b.company=p_company;

  select coalesce(jsonb_agg(g.value),'[]'::jsonb) into v_missing
  from jsonb_array_elements(v_req.required_groups) g
  where not exists (select 1 from jsonb_array_elements_text(g.value) k where k.value=any(v_kinds));

  select * into v_old from public.daily_recon_jobs where business_date=p_business_date and company=p_company;
  if v_old.status='running' then v_status:='running';
  elsif v_old.status='completed' and v_files<=v_old.file_count then v_status:='completed';
  elsif jsonb_array_length(v_missing)=0 and v_files>0 then
    v_status:=case when v_old.status='completed' then 'queued' else 'ready' end;
    v_late:=coalesce(v_old.status='completed' and v_files>v_old.file_count,false);
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
    rerun_requested_at=coalesce(excluded.rerun_requested_at,daily_recon_jobs.rerun_requested_at),updated_at=now()
  returning * into v_out;

  if v_late then insert into public.recon_notifications(dedupe_key,level,title,detail,business_date,company,job_id)
    values('late:'||v_out.id||':'||v_files,'warning','พบไฟล์มาช้าและเข้าคิวรันซ้ำ','จำนวนไฟล์เพิ่มเป็น '||v_files,p_business_date,p_company,v_out.id)
    on conflict(dedupe_key) do nothing; end if;
  return v_out;
end $$;

create or replace function public.refresh_daily_recon_jobs(p_from date default current_date-7,p_to date default current_date)
returns setof public.daily_recon_jobs language plpgsql security definer set search_path=public as $$
declare r record; begin
  for r in select distinct business_date,company from public.mail_batches
    where business_date between p_from and p_to and company is not null
  loop return next public.refresh_daily_recon_job(r.business_date,r.company); end loop;
end $$;

create or replace function public.queue_due_daily_recon_jobs(p_from date default current_date-7,p_to date default current_date)
returns setof public.daily_recon_jobs language plpgsql security definer set search_path=public as $$
begin
  update public.daily_recon_jobs set status='queued',claimed_at=null,claimed_by=null,
    last_error='กู้คิวอัตโนมัติ: งานเดิมค้างเกิน 15 นาที',updated_at=now()
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
  return query select * from public.daily_recon_jobs where business_date between p_from and p_to order by business_date,company;
end $$;

create or replace function public.claim_daily_recon_job(p_worker text default 'web-worker')
returns public.daily_recon_jobs language plpgsql security definer set search_path=public as $$
declare v_job public.daily_recon_jobs%rowtype; begin
  select * into v_job from public.daily_recon_jobs where status='queued'
    order by business_date,updated_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.daily_recon_jobs set status='running',claimed_at=now(),claimed_by=p_worker,
    attempt_count=attempt_count+1,last_error=null,updated_at=now() where id=v_job.id returning * into v_job;
  return v_job;
end $$;

create or replace function public.finish_daily_recon_job(p_job_id uuid,p_run_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.daily_recon_jobs set status='completed',last_run_id=p_run_id,completed_at=now(),
    late_file=false,rerun_requested_at=null,updated_at=now() where id=p_job_id;
  insert into public.recon_notifications(dedupe_key,level,title,detail,business_date,company,job_id)
  select 'complete:'||id||':'||p_run_id,'success','กระทบยอดรายวันสำเร็จ','บันทึกผลการรัน '||p_run_id,
    business_date,company,id from public.daily_recon_jobs where id=p_job_id on conflict(dedupe_key) do nothing;
end $$;

create or replace function public.fail_daily_recon_job(p_job_id uuid,p_error text)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.daily_recon_jobs set status='error',last_error=left(p_error,2000),updated_at=now() where id=p_job_id;
  insert into public.recon_notifications(dedupe_key,level,title,detail,business_date,company,job_id)
  select 'error:'||id||':'||attempt_count,'error','กระทบยอดรายวันล้มเหลว',left(p_error,2000),
    business_date,company,id from public.daily_recon_jobs where id=p_job_id on conflict(dedupe_key) do nothing;
end $$;

create or replace function public.on_source_file_change() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_batch uuid; v_date date; v_company text; begin
  v_batch:=coalesce(new.batch_id,old.batch_id);
  select business_date,company into v_date,v_company from public.mail_batches where id=v_batch;
  if v_date is not null and v_company is not null then perform public.refresh_daily_recon_job(v_date,v_company); end if;
  return coalesce(new,old);
end $$;
drop trigger if exists source_files_refresh_recon_job on public.source_files;
create trigger source_files_refresh_recon_job after insert or delete or update on public.source_files
for each row execute function public.on_source_file_change();

-- -------------------------------------------------------------
-- 9) updated_at อัตโนมัติ
-- -------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at := now(); return new; end $$ language plpgsql;

drop trigger if exists mail_batches_touch on public.mail_batches;
create trigger mail_batches_touch before update on public.mail_batches
  for each row execute function public.touch_updated_at();

drop trigger if exists exceptions_touch on public.exceptions;
create trigger exceptions_touch before update on public.exceptions
  for each row execute function public.touch_updated_at();

-- -------------------------------------------------------------
-- 10) Storage bucket สำหรับไฟล์ต้นฉบับ (ไม่เปิดสาธารณะ)
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('audit-files', 'audit-files', false)
on conflict (id) do nothing;

-- -------------------------------------------------------------
-- 11) RLS — ข้อมูลธนาคารลูกค้า ห้ามเปิดให้ anon อ่าน
--     ผู้ใช้ต้องล็อกอินด้วย Supabase Auth ก่อนเสมอ
-- -------------------------------------------------------------
alter table public.mail_batches enable row level security;
alter table public.source_files enable row level security;
alter table public.recon_runs   enable row level security;
alter table public.exceptions   enable row level security;
alter table public.fx_rates     enable row level security;
alter table public.damages      enable row level security;
alter table public.clarify_docs enable row level security;
alter table public.audit_log    enable row level security;
alter table public.mail_sources enable row level security;
alter table public.recon_requirements enable row level security;
alter table public.daily_recon_jobs enable row level security;
alter table public.recon_notifications enable row level security;

do $$
declare t text;
begin
  foreach t in array array['mail_batches','source_files','recon_runs','exceptions','fx_rates','damages','clarify_docs','audit_log','mail_sources','recon_requirements','daily_recon_jobs','recon_notifications']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_auth_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_auth_read', t);

    execute format('drop policy if exists %I on public.%I', t || '_auth_write', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (true)', t || '_auth_write', t);

    execute format('drop policy if exists %I on public.%I', t || '_auth_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (true) with check (true)', t || '_auth_update', t);
  end loop;
end $$;

-- audit_log ห้ามแก้/ลบ แม้จะล็อกอินแล้ว (เขียนเพิ่มได้อย่างเดียว)
drop policy if exists audit_log_auth_update on public.audit_log;

-- Storage: ผู้ที่ล็อกอินแล้วอ่านไฟล์ใน bucket นี้ได้
drop policy if exists audit_files_read on storage.objects;
create policy audit_files_read on storage.objects
  for select to authenticated using (bucket_id = 'audit-files');

drop policy if exists audit_files_write on storage.objects;
create policy audit_files_write on storage.objects
  for insert to authenticated with check (bucket_id = 'audit-files');

-- หมายเหตุ: n8n เขียนด้วย service_role key ซึ่งข้าม RLS อยู่แล้ว
--          service_role key ต้องเก็บไว้ใน n8n เท่านั้น ห้ามใส่ในหน้าเว็บเด็ดขาด

-- -------------------------------------------------------------
-- 12) View สรุปให้หน้าคลังไฟล์เรียกใช้ทีเดียว
-- -------------------------------------------------------------
create or replace view public.v_batch_files
with (security_invoker = true) as
select
  b.id            as batch_id,
  b.business_date,
  b.company,
  b.subject,
  b.sender,
  b.received_at,
  b.is_supplement,
  b.status        as batch_status,
  f.id            as file_id,
  f.file_name,
  f.from_zip,
  f.kind,
  f.size_bytes,
  f.storage_path,
  f.drive_url,
  f.parsed,
  f.row_count,
  f.parse_error
from public.mail_batches b
left join public.source_files f on f.batch_id = b.id;

create or replace view public.v_daily_status
with (security_invoker = true) as
select
  b.business_date,
  b.company,
  count(distinct b.id)                                        as mail_count,
  count(f.id)                                                 as file_count,
  count(f.id) filter (where f.parsed)                         as parsed_count,
  count(f.id) filter (where f.parse_error is not null)        as error_count,
  max(b.received_at)                                          as last_mail_at
from public.mail_batches b
left join public.source_files f on f.batch_id = b.id
group by b.business_date, b.company
order by b.business_date desc, b.company;

grant select on public.v_batch_files, public.v_daily_status to authenticated;

create or replace view public.v_recon_operations
with (security_invoker = true) as
select j.*, r.match_rate, r.matched, r.exception_count, r.elapsed_ms,
       coalesce(n.unread_count,0) as unread_notification_count
from public.daily_recon_jobs j
left join public.recon_runs r on r.id=j.last_run_id
left join (
  select job_id,count(*) filter(where read_at is null) as unread_count
  from public.recon_notifications group by job_id
) n on n.job_id=j.id
order by j.business_date desc,j.company;

grant select on public.v_recon_operations to authenticated;
grant execute on function public.refresh_daily_recon_jobs(date,date) to authenticated;
grant execute on function public.queue_due_daily_recon_jobs(date,date) to authenticated;
revoke all on function public.refresh_daily_recon_job(date,text) from public;
revoke all on function public.refresh_daily_recon_jobs(date,date) from public;
revoke all on function public.queue_due_daily_recon_jobs(date,date) from public;
revoke all on function public.claim_daily_recon_job(text) from public;
revoke all on function public.finish_daily_recon_job(uuid,uuid) from public;
revoke all on function public.fail_daily_recon_job(uuid,text) from public;
grant execute on function public.claim_daily_recon_job(text) to authenticated;
grant execute on function public.finish_daily_recon_job(uuid,uuid) to authenticated;
grant execute on function public.fail_daily_recon_job(uuid,text) to authenticated;
