-- Mail intake control only. This migration does not reconcile, rerun, approve,
-- close, reopen, or change any audit case, amount, hold, or accepted result.

create table if not exists public.mail_pull_requests (
  id uuid primary key default gen_random_uuid(),
  source_email text not null references public.mail_sources(email),
  date_from date not null,
  date_to date not null,
  status text not null default 'queued' check (status in ('queued','processing','completed','partial','error','cancelled')),
  requested_by uuid not null default auth.uid(),
  requested_by_email text not null,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  found_count integer,
  imported_count integer,
  skipped_count integer,
  error_message text,
  worker_receipt jsonb not null default '{}'::jsonb,
  constraint mail_pull_requests_date_order check (date_to >= date_from),
  constraint mail_pull_requests_date_window check (date_to - date_from <= 31)
);

create index if not exists mail_pull_requests_queue_idx
  on public.mail_pull_requests(status,requested_at);
create index if not exists mail_pull_requests_source_idx
  on public.mail_pull_requests(source_email,date_from,date_to,requested_at desc);

alter table public.mail_pull_requests enable row level security;

drop policy if exists mail_pull_requests_lead_read on public.mail_pull_requests;
create policy mail_pull_requests_lead_read on public.mail_pull_requests for select to authenticated
using(public.current_user_active() and public.current_app_role() in ('lead','admin'));

create or replace function public.register_mail_source(
  p_email text,
  p_display_name text,
  p_business_systems text[] default '{}',
  p_expected_reports text[] default '{}',
  p_note text default null
) returns public.mail_sources
language plpgsql security definer set search_path=public as $$
declare
  normalized_email text:=lower(trim(coalesce(p_email,'')));
  row_out public.mail_sources%rowtype;
begin
  if public.current_app_role() not in ('lead','admin') then raise exception 'เฉพาะหัวหน้าหรือผู้ดูแลระบบเพิ่มผู้ส่งได้'; end if;
  if normalized_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$' then raise exception 'รูปแบบอีเมลไม่ถูกต้อง'; end if;
  if length(trim(coalesce(p_display_name,''))) < 2 then raise exception 'กรุณาระบุชื่อผู้ส่ง'; end if;

  insert into public.mail_sources(email,display_name,business_systems,expected_reports,active,note,updated_at)
  values(normalized_email,trim(p_display_name),coalesce(p_business_systems,'{}'),coalesce(p_expected_reports,'{}'),true,nullif(trim(coalesce(p_note,'')),''),now())
  on conflict(email) do update set
    display_name=excluded.display_name,
    business_systems=excluded.business_systems,
    expected_reports=excluded.expected_reports,
    active=true,
    note=excluded.note,
    updated_at=now()
  returning * into row_out;

  insert into public.audit_log(actor,actor_user_id,action,entity,target,detail,meta)
  values(coalesce(auth.jwt()->>'email',auth.uid()::text),auth.uid(),'register','mail_source',normalized_email,
    'เพิ่มหรือเปิดใช้งานผู้ส่งเมลสำหรับคลังเอกสาร โดยยังไม่ดึงเมลและไม่รันกระทบยอด',
    jsonb_build_object('business_systems',row_out.business_systems,'expected_reports',row_out.expected_reports));
  return row_out;
end $$;

create or replace function public.request_mail_pull(
  p_email text,
  p_date_from date,
  p_date_to date
) returns public.mail_pull_requests
language plpgsql security definer set search_path=public as $$
declare
  normalized_email text:=lower(trim(coalesce(p_email,'')));
  row_out public.mail_pull_requests%rowtype;
begin
  if public.current_app_role() not in ('lead','admin') then raise exception 'เฉพาะหัวหน้าหรือผู้ดูแลระบบสั่งดึงเมลได้'; end if;
  if p_date_from is null or p_date_to is null or p_date_to < p_date_from then raise exception 'ช่วงวันที่ไม่ถูกต้อง'; end if;
  if p_date_to-p_date_from > 31 then raise exception 'ดึงได้ครั้งละไม่เกิน 32 วัน'; end if;
  if not exists(select 1 from public.mail_sources where email=normalized_email and active) then raise exception 'อีเมลนี้ยังไม่อยู่ในทะเบียนผู้ส่งที่เปิดใช้งาน'; end if;
  if exists(select 1 from public.mail_pull_requests where source_email=normalized_email and date_from=p_date_from and date_to=p_date_to and status in ('queued','processing')) then
    raise exception 'มีคำขอดึงอีเมลและช่วงวันที่นี้อยู่แล้ว';
  end if;

  insert into public.mail_pull_requests(source_email,date_from,date_to,requested_by,requested_by_email)
  values(normalized_email,p_date_from,p_date_to,auth.uid(),coalesce(auth.jwt()->>'email',auth.uid()::text)) returning * into row_out;
  insert into public.audit_log(actor,actor_user_id,action,entity,target,detail,meta)
  values(row_out.requested_by_email,auth.uid(),'request','mail_pull',row_out.id::text,
    'ส่งคำขอดึงเมลเข้าคลังเท่านั้น ไม่ใช่คำสั่งรันหรือยืนยันผลกระทบยอด',
    jsonb_build_object('source_email',normalized_email,'date_from',p_date_from,'date_to',p_date_to));
  return row_out;
end $$;

create or replace function public.claim_mail_pull_request()
returns public.mail_pull_requests
language plpgsql security definer set search_path=public as $$
declare row_out public.mail_pull_requests%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'worker only'; end if;
  select * into row_out from public.mail_pull_requests where status='queued' order by requested_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.mail_pull_requests set status='processing',started_at=now(),error_message=null where id=row_out.id returning * into row_out;
  return row_out;
end $$;

create or replace function public.finish_mail_pull_request(
  p_id uuid,
  p_status text,
  p_found integer default 0,
  p_imported integer default 0,
  p_skipped integer default 0,
  p_error text default null,
  p_receipt jsonb default '{}'::jsonb
) returns public.mail_pull_requests
language plpgsql security definer set search_path=public as $$
declare row_out public.mail_pull_requests%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'worker only'; end if;
  if p_status not in ('completed','partial','error') then raise exception 'invalid worker status'; end if;
  update public.mail_pull_requests set status=p_status,finished_at=now(),found_count=greatest(coalesce(p_found,0),0),
    imported_count=greatest(coalesce(p_imported,0),0),skipped_count=greatest(coalesce(p_skipped,0),0),
    error_message=nullif(left(coalesce(p_error,''),2000),''),worker_receipt=coalesce(p_receipt,'{}'::jsonb)
  where id=p_id and status='processing' returning * into row_out;
  if not found then raise exception 'ไม่พบคำขอที่ worker กำลังทำงาน'; end if;
  return row_out;
end $$;

revoke all on function public.register_mail_source(text,text,text[],text[],text) from public;
revoke all on function public.request_mail_pull(text,date,date) from public;
revoke all on function public.claim_mail_pull_request() from public;
revoke all on function public.finish_mail_pull_request(uuid,text,integer,integer,integer,text,jsonb) from public;
grant execute on function public.register_mail_source(text,text,text[],text[],text) to authenticated;
grant execute on function public.request_mail_pull(text,date,date) to authenticated;
grant execute on function public.claim_mail_pull_request() to service_role;
grant execute on function public.finish_mail_pull_request(uuid,text,integer,integer,integer,text,jsonb) to service_role;
grant select on public.mail_pull_requests to authenticated;

