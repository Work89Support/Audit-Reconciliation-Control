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
  sender            text,                       -- ผู้ส่งต่อ เช่น faz123u3@gmail.com
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

do $$
declare t text;
begin
  foreach t in array array['mail_batches','source_files','recon_runs','exceptions','fx_rates','damages','clarify_docs','audit_log']
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
create or replace view public.v_batch_files as
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

create or replace view public.v_daily_status as
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
