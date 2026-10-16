-- Additive evidence hold. Original case status, source amounts and recon results stay intact.
begin;
set local lock_timeout='5s';
create table if not exists public.account_review_holds(
 id uuid primary key, company text not null, account text not null,
 business_date date not null,time_from time not null,time_to time not null,
 reason text not null, responsible_role text not null default 'Audit Lead / Admin',
 created_by uuid not null,created_at timestamptz not null default clock_timestamp(),
 request_ref text not null unique, check(time_from<=time_to),
 unique(company,account,business_date,time_from,time_to)
);
create table if not exists public.account_review_hold_items(
 hold_id uuid not null references public.account_review_holds(id),source_ref text not null,
 item_kind text not null check(item_kind in ('case','waiting_bo')),
 exception_id uuid references public.exceptions(id),recheck_id uuid references public.account_recheck_jobs(id),
 code text,occurred_at text,direction text,bo_amount numeric,original_status text,
 source_file_id uuid,source_row integer,
 primary key(hold_id,source_ref),
 check((item_kind='case' and exception_id is not null) or (item_kind='waiting_bo' and recheck_id is not null))
);
create or replace function public.account_review_hold_access(p_company text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and coalesce(public.current_user_active(),false)
 and exists(select 1 from public.audit_companies c where c.code=p_company and c.active
 and (public.current_app_role()='admin' or exists(select 1 from public.user_company_access a
 where a.user_id=auth.uid() and upper(a.company) in (upper(c.code),'*'))))
$$;
alter table public.account_review_holds enable row level security;
alter table public.account_review_hold_items enable row level security;
revoke all on public.account_review_holds,public.account_review_hold_items from public,anon,authenticated;
grant select on public.account_review_holds,public.account_review_hold_items to authenticated;
drop policy if exists review_hold_read on public.account_review_holds;
create policy review_hold_read on public.account_review_holds for select to authenticated using(public.account_review_hold_access(company));
drop policy if exists review_hold_item_read on public.account_review_hold_items;
create policy review_hold_item_read on public.account_review_hold_items for select to authenticated using(exists(
 select 1 from public.account_review_holds h where h.id=hold_id and public.account_review_hold_access(h.company)));

-- Account/date/time, not display code, define the hold (also protects future versions).
create or replace function public.account_review_hold_id(p_company text,p_date date,p_account text,p_time text) returns uuid
language sql stable security definer set search_path=public,pg_temp as $$
 select h.id from public.account_review_holds h where h.company=p_company and h.business_date=p_date
 and h.account=regexp_replace(coalesce(p_account,''),'[^0-9]','','g')
 and (h.time_from='00:00:00'::time and h.time_to='23:59:59'::time
 or (p_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$' and p_time between h.time_from::text and h.time_to::text))
 limit 1
$$;
create or replace function public.account_review_hold_scopes() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(to_jsonb(h) order by h.business_date),'[]') from public.account_review_holds h
 where public.account_review_hold_access(h.company)
$$;
create or replace function public.account_review_hold_for_case(p_case uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare e public.exceptions;v uuid;
begin
 select * into e from public.exceptions where id=p_case;
 if not found or not public.account_review_hold_access(e.company) then raise exception 'ไม่มีสิทธิ์เคส/บริษัท' using errcode='42501';end if;
 v:=public.account_review_hold_id(e.company,e.business_date,e.account,coalesce(e.bo_time,e.occurred_at)::text);
 return (select to_jsonb(h) from public.account_review_holds h where id=v);
end$$;
create or replace function public.account_review_hold_report(p_company text,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare scopes jsonb;items jsonb;
begin
 if not coalesce(p_company=any(public.finance_reporting_companies()),false) then raise exception 'ไม่มีสิทธิ์รายงานบริษัท' using errcode='42501';end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>365 then raise exception 'ช่วงรายงานไม่เกิน 366 วัน';end if;
 select coalesce(jsonb_agg(to_jsonb(h) order by h.business_date),'[]') into scopes from public.account_review_holds h
 where h.company=p_company and h.business_date between p_from and p_to;
 select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('company',h.company,'date',h.business_date,'account',h.account,
 'reason',h.reason,'responsible_role',h.responsible_role,'registered_at',h.created_at,'registered_by',h.created_by,
 'assessment','ยังประเมินไม่ได้ — ขาด STM','loss_amount',null) order by h.business_date,i.occurred_at,i.source_ref),'[]') into items
 from public.account_review_hold_items i join public.account_review_holds h on h.id=i.hold_id
 where h.company=p_company and h.business_date between p_from and p_to;
 return jsonb_build_object('company',p_company,'scopes',scopes,'items',items);
end$$;

-- Server-side guard covers direct PATCH, closure RPCs, pairing and damage insertion.
create or replace function public.guard_account_review_hold() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.exceptions;
begin
 if tg_table_name='exceptions' then
  if new.status in ('closed','approved','damage') and (tg_op='INSERT' or new.status is distinct from old.status)
  and public.account_review_hold_id(new.company,new.business_date,new.account,coalesce(new.bo_time,new.occurred_at)::text) is not null then
   raise exception 'พักตรวจ — บัญชีถูกระงับ / รอ STM: ยังปิดเคสหรือยืนยันความเสียหายไม่ได้';
  end if;
 else
  select * into e from public.exceptions where id=new.exception_id;
  if found and public.account_review_hold_id(e.company,e.business_date,e.account,coalesce(e.bo_time,e.occurred_at)::text) is not null then
   raise exception 'พักตรวจ — บัญชีถูกระงับ / รอ STM: ไม่ใช่ความเสียหายที่ยืนยันแล้ว';
  end if;
 end if;
 return new;
end$$;
drop trigger if exists account_review_hold_close_guard on public.exceptions;
create trigger account_review_hold_close_guard before insert or update of status on public.exceptions for each row execute function public.guard_account_review_hold();
drop trigger if exists account_review_hold_damage_guard on public.damages;
create trigger account_review_hold_damage_guard before insert or update of exception_id on public.damages for each row execute function public.guard_account_review_hold();
revoke all on function public.account_review_hold_access(text),public.account_review_hold_id(text,date,text,text),public.account_review_hold_scopes(),public.account_review_hold_for_case(uuid),public.account_review_hold_report(text,date,date),public.guard_account_review_hold() from public,anon;
revoke all on function public.account_review_hold_id(text,date,text,text),public.guard_account_review_hold() from authenticated;
grant execute on function public.account_review_hold_access(text),public.account_review_hold_scopes(),public.account_review_hold_for_case(uuid),public.account_review_hold_report(text,date,date) to authenticated;

-- Seed only the exact user-authorized scope; abort if evidence/counts drift.
do $$
declare before_hash text;after_hash text;n integer;
begin
 before_hash:=md5(public.account_recheck_snapshot('FR8','2026-10-14')::text||public.account_recheck_snapshot('FR8','2026-10-15')::text);
 select count(*) into n from public.exceptions e where e.company='FR8' and e.business_date='2026-10-14' and e.account='4311918665'
 and e.occurred_at between '23:00:00' and '23:59:59' and e.status not in ('closed','approved') and e.superseded_by_exception_id is null;
 if n<>13 then raise exception 'Expected 13 authorized cases, found %',n;end if;
 if not exists(select 1 from public.account_recheck_jobs where id='cc3b796b-daf2-48f0-80fc-1740d907e8bb' and status in ('ready','confirmed') and result->>'quality'='passed')
 or exists(select 1 from public.manual_primary_results where recheck_id='cc3b796b-daf2-48f0-80fc-1740d907e8bb') then raise exception 'Staged request or primary changed';end if;
 select count(*) into n from public.account_recheck_jobs q,jsonb_array_elements(q.result->'summary'->'waiting_bo') w
 where q.id='cc3b796b-daf2-48f0-80fc-1740d907e8bb' and w->>'account'='4311918665' and w->>'date'='2026-10-15';
 if n<>143 then raise exception 'Expected 143 waiting BO records, found %',n;end if;
 if exists(select 1 from public.damages d join public.exceptions e on e.id=d.exception_id where e.company='FR8' and e.account='4311918665'
 and (e.business_date='2026-10-15' or e.business_date='2026-10-14' and e.occurred_at between '23:00:00' and '23:59:59')) then raise exception 'Existing damage must be reviewed separately, not overwritten';end if;
 insert into public.account_review_holds(id,company,account,business_date,time_from,time_to,reason,created_by,request_ref) values
 ('83abf196-4d52-441d-a72c-4aff75434b14','FR8','4311918665','2026-10-14','23:00:00','23:59:59','บัญชี SCB จิตติพัฒน์ถูกระงับ ไม่สามารถขอ STM ได้ รอหลักฐานเพื่อกลับมาตรวจ ยังไม่ยืนยันความเสียหาย','3bd23940-ef55-46ec-9a10-294779cd33b4','user-approved-fr8-scb-20261014-late'),
 ('83abf196-4d52-441d-a72c-4aff75434b15','FR8','4311918665','2026-10-15','00:00:00','23:59:59','บัญชี SCB จิตติพัฒน์ถูกระงับ ไม่สามารถขอ STM ได้ รอหลักฐานเพื่อกลับมาตรวจ ยังไม่ยืนยันความเสียหาย','3bd23940-ef55-46ec-9a10-294779cd33b4','user-approved-fr8-scb-20261015-all') on conflict(request_ref) do nothing;
 insert into public.account_review_hold_items(hold_id,source_ref,item_kind,exception_id,code,occurred_at,direction,bo_amount,original_status)
 select '83abf196-4d52-441d-a72c-4aff75434b14',e.id::text,'case',e.id,e.code,e.occurred_at::text,e.direction,e.system_amount,e.status from public.exceptions e
 where e.company='FR8' and e.business_date='2026-10-14' and e.account='4311918665' and e.occurred_at between '23:00:00' and '23:59:59'
 and e.status not in ('closed','approved') and e.superseded_by_exception_id is null on conflict do nothing;
 insert into public.account_review_hold_items(hold_id,source_ref,item_kind,recheck_id,code,occurred_at,direction,bo_amount,original_status,source_file_id,source_row)
 select '83abf196-4d52-441d-a72c-4aff75434b15',(w#>>'{boSource,fileId}')||':'||(w#>>'{boSource,row}'),'waiting_bo',q.id,
 'BO แถว '||(w#>>'{boSource,row}'),w->>'boTime',w->>'direction',(w->>'systemAmount')::numeric,w->>'status',(w#>>'{boSource,fileId}')::uuid,(w#>>'{boSource,row}')::integer
 from public.account_recheck_jobs q,jsonb_array_elements(q.result->'summary'->'waiting_bo') w
 where q.id='cc3b796b-daf2-48f0-80fc-1740d907e8bb' and w->>'account'='4311918665' and w->>'date'='2026-10-15' on conflict do nothing;
 after_hash:=md5(public.account_recheck_snapshot('FR8','2026-10-14')::text||public.account_recheck_snapshot('FR8','2026-10-15')::text);
 if before_hash<>after_hash then raise exception 'Protected operational state changed';end if;
end$$;
-- Keep existing report implementation, adding only the explicit hold exclusion.
do $$declare definition text;needle text:='and e.superseded_by_exception_id is null and e.risk_amount>0';begin
 definition:=pg_get_functiondef('public.finance_case_report(text,date,date)'::regprocedure);
 if position('account_review_hold_id' in definition)=0 then
  if position(needle in definition)=0 then raise exception 'Finance report changed; review before patching';end if;
  definition:=replace(definition,needle,needle||' and public.account_review_hold_id(e.company,e.business_date,e.account,coalesce(e.bo_time,e.occurred_at)::text) is null');
  execute definition;
 end if;
end$$;
notify pgrst,'reload schema';
commit;
