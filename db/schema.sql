-- =============================================================
-- Audit Reconciliation Control — Supabase schema (เฟส 1)
-- ตรงกับที่ supabase.js เรียกใช้จริง (recon_runs, exceptions,
-- mail_batches + source_files, audit_log, v_daily_status)
-- ระบบเป็นเงินบาทล้วน (ไม่มี currency/fx_rate)
--
-- วิธีใช้: เปิด Supabase → SQL Editor → วางไฟล์นี้ → Run
-- หมายเหตุ: n8n ใช้ service_role (ข้าม RLS) เขียน mail_batches/source_files
--           หน้าเว็บใช้ anon key + ผู้ใช้ที่ล็อกอิน (อยู่ใต้ RLS)
-- =============================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ---------- ทะเบียนบัญชี (master) : subco = บริษัท ----------
create table if not exists accounts (
  id            text primary key,            -- เลขบัญชี (digits) หรือรหัส PM
  account_raw   text,                         -- เลขบัญชีแบบมีขีด
  company       text not null,                -- subco (3XB, FR8, ... , 7M)
  bank          text,                         -- KBANK/SCB/KTB/BBL/TMN/LBK/BAY
  channel       text,                         -- K PLUS / ENET / mPhone / LBK / MOBILE
  provider      text,                         -- ช่องทาง PM (AUTOPEER/AZPAY/...) ว่างถ้าเป็นบัญชีธนาคาร
  type          text,                         -- ฝาก / ถอน / ถอน-ฝาก / PM
  holder        text,
  source        text,                         -- 'bank' | 'pm'
  file_pattern  text,                         -- รูปแบบชื่อไฟล์ที่ระบบใช้แท็ก
  active        boolean not null default true,
  note          text,
  updated_at    timestamptz not null default now()
);
create index if not exists idx_accounts_company on accounts(company);

-- ---------- คลังไฟล์จากเมล (n8n เขียนเข้า) ----------
create table if not exists mail_batches (
  id            uuid primary key default gen_random_uuid(),
  business_date date,
  company       text,
  subject       text,
  sender        text,
  received_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists idx_mail_batches_date on mail_batches(business_date);

create table if not exists source_files (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid references mail_batches(id) on delete cascade,
  business_date date,
  company       text,
  file_name     text,
  file_type     text,                         -- STM/BO/PM/...
  bank          text,
  storage_path  text,                         -- path ใน Supabase Storage
  checksum      text,
  row_count     integer,
  parsed        boolean not null default false,
  parsed_at     timestamptz,
  parse_error   text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_source_files_batch on source_files(batch_id);

-- ---------- ผลกระทบยอดแต่ละรอบ ----------
create table if not exists recon_runs (
  id              uuid primary key default gen_random_uuid(),
  business_date   date,
  company         text,
  run_by          text,
  elapsed_ms      integer default 0,
  stm_count       integer default 0,
  bo_count        integer default 0,
  matched         integer default 0,
  match_rate      numeric(6,3) default 0,
  exception_count integer default 0,
  no_stm_count    integer default 0,
  file_ids        jsonb,
  summary         jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_recon_runs_date on recon_runs(business_date);

-- ---------- รายการผิดปกติ (exceptions) ----------
create table if not exists exceptions (
  id             bigserial primary key,
  run_id         uuid references recon_runs(id) on delete set null,
  code           text,                         -- รหัสเคสในแอป เช่น EX-2736
  business_date  date,
  occurred_at    text,                         -- เวลา HH:MM:SS
  company        text,
  bank           text,
  account        text,
  direction      text,                         -- ฝาก/ถอน/PM
  member_code    text,
  ex_type        text,
  type_name      text,
  severity       text,                         -- critical/high/medium/low
  status         text,
  track          text,                         -- XB / SYS123
  system_amount  numeric,                      -- ยอดฝั่ง BO
  bank_amount    numeric,                      -- ยอดฝั่ง STM
  amount_diff    numeric,
  risk_amount    numeric,
  time_diff_sec  integer,
  employee       text,
  shift          text,
  cause          text,
  detail         text,
  stm_raw        text,
  bo_raw         text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_exceptions_run     on exceptions(run_id);
create index if not exists idx_exceptions_date     on exceptions(business_date);
create index if not exists idx_exceptions_acc_amt  on exceptions(account, bank_amount);
create index if not exists idx_exceptions_status   on exceptions(status);

-- ---------- ทะเบียนความเสียหาย (บาทล้วน) ----------
create table if not exists damages (
  id             text primary key,             -- DMG-xxx
  exception_code text,
  business_date  date,
  company        text,
  employee       text,
  shift          text,
  amount         numeric,                       -- บาท
  cause          text,
  cycle          text,                          -- C1/C2/C3
  evidence       boolean default false,
  hr_status      text,
  finance_status text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_damages_cycle on damages(cycle);

-- ---------- บันทึกการใช้งาน (เขียนอย่างเดียว) ----------
create table if not exists audit_log (
  id      bigserial primary key,
  at      timestamptz not null default now(),
  actor   text,
  action  text,
  entity  text,
  target  text,
  detail  text,
  meta    jsonb
);
create index if not exists idx_audit_log_at on audit_log(at desc);

-- ---------- ผู้ใช้ ↔ บทบาท (สำหรับ Auth จริง เฟส 2) ----------
create table if not exists user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role    text not null default 'monitor',     -- monitor/shift_lead/auditor/lead/admin
  email   text
);

create or replace function public.auth_role() returns text
language sql stable as $$
  select coalesce((select role from public.user_roles where user_id = auth.uid()), 'none')
$$;

-- ---------- View สรุปสถานะรายวัน (supabase.js: v_daily_status) ----------
create or replace view v_daily_status
  with (security_invoker = true) as
select
  r.business_date,
  count(distinct r.id)                              as runs,
  coalesce(sum(r.stm_count),0)                      as stm_count,
  coalesce(sum(r.matched),0)                        as matched,
  coalesce(sum(r.exception_count),0)               as exception_count,
  round(avg(nullif(r.match_rate,0))::numeric,3)     as avg_match_rate,
  (select count(*) from source_files sf where sf.business_date = r.business_date) as files_received,
  (select count(*) from source_files sf where sf.business_date = r.business_date and sf.parsed) as files_parsed
from recon_runs r
group by r.business_date;

-- =============================================================
-- Row Level Security
--   เปิด RLS ทุกตาราง · n8n (service_role) ข้าม RLS ได้เสมอ
--   นโยบายเริ่มต้น: ผู้ใช้ที่ล็อกอิน (authenticated) อ่านได้
--   เขียน/แก้ได้ (แต่ห้ามลบ) · audit_log เขียนอย่างเดียว
-- =============================================================
alter table accounts       enable row level security;
alter table mail_batches   enable row level security;
alter table source_files   enable row level security;
alter table recon_runs     enable row level security;
alter table exceptions     enable row level security;
alter table damages        enable row level security;
alter table audit_log      enable row level security;
alter table user_roles     enable row level security;

-- อ่านได้ทุกตารางถ้าล็อกอิน
create policy read_authed on accounts     for select to authenticated using (true);
create policy read_authed on mail_batches for select to authenticated using (true);
create policy read_authed on source_files for select to authenticated using (true);
create policy read_authed on recon_runs   for select to authenticated using (true);
create policy read_authed on exceptions   for select to authenticated using (true);
create policy read_authed on damages      for select to authenticated using (true);
create policy read_authed on audit_log    for select to authenticated using (true);
create policy read_self   on user_roles   for select to authenticated using (user_id = auth.uid());

-- เขียนผลตรวจ/เคส/ความเสียหาย (insert + update, ไม่มี delete)
create policy ins_authed on recon_runs for insert to authenticated with check (true);
create policy ins_authed on exceptions for insert to authenticated with check (true);
create policy upd_authed on exceptions for update to authenticated using (true) with check (true);
create policy ins_authed on damages    for insert to authenticated with check (true);
create policy upd_authed on damages    for update to authenticated using (true) with check (true);
create policy upd_files  on source_files for update to authenticated using (true) with check (true);

-- audit_log: insert อย่างเดียว (ไม่มี update/delete policy = ทำไม่ได้)
create policy ins_audit on audit_log for insert to authenticated with check (true);

-- ตัวอย่างสิทธิ์ตาม role (เฟส 2): เฉพาะ lead/admin อนุมัติ-ปิดเคส
-- create policy approve_lead on exceptions for update to authenticated
--   using (public.auth_role() in ('lead','admin'))
--   with check (public.auth_role() in ('lead','admin'));

-- =============================================================
-- Storage bucket สำหรับไฟล์ดิบ/หลักฐาน (ชื่อ bucket = ค่า cfg().bucket ในแอป)
-- สร้างผ่าน Dashboard → Storage ก็ได้ หรือรันบรรทัดล่างนี้
-- =============================================================
insert into storage.buckets (id, name, public)
values ('audit-files', 'audit-files', false)
on conflict (id) do nothing;

-- อ่าน/อัปโหลดไฟล์ได้เฉพาะผู้ล็อกอิน (บนบัคเก็ต audit-files)
create policy "read files authed" on storage.objects for select to authenticated
  using (bucket_id = 'audit-files');
create policy "upload files authed" on storage.objects for insert to authenticated
  with check (bucket_id = 'audit-files');

-- =============================================================
-- เสร็จเฟส 1 (schema). ขั้นต่อไป: ใส่ Supabase URL + anon key
-- ในหน้า "คลังไฟล์จากเมล" ของแอป แล้วเปิดบันทึกผลจริง
-- =============================================================

-- ---------- สิทธิ์ให้ PostgREST (Supabase) มองเห็น ----------
grant usage on schema public to anon, authenticated;
grant select on v_daily_status to authenticated;
-- ถ้า REST ตอบ 401/permission ให้รันเพิ่ม:
-- grant select, insert, update on all tables in schema public to authenticated;
