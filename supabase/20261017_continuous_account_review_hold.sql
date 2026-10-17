-- User-authorized FR8/SCB evidence hold from 16 October onward.
-- Additive scope only: no case, amount, source, reconciliation or damage writes.
begin;
set local lock_timeout='5s';

-- A separate marker preserves the original scope rows byte-for-byte.
-- No authenticated write/release grant. STM ingestion cannot clear this marker.
-- Release requires a separately authorized Head/Admin review with verified STM;
-- this deployment deliberately exposes no automatic or client-side release path.
create table if not exists public.account_review_hold_continuations(
 hold_id uuid primary key references public.account_review_holds(id),
 authorization_ref text not null unique,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.account_review_hold_continuations enable row level security;
revoke all on public.account_review_hold_continuations from public,anon,authenticated;
grant select on public.account_review_hold_continuations to authenticated;
drop policy if exists continuation_read on public.account_review_hold_continuations;
create policy continuation_read on public.account_review_hold_continuations for select to authenticated using(exists(
 select 1 from public.account_review_holds h where h.id=hold_id and public.account_review_hold_access(h.company)));

create or replace function public.account_review_hold_id(p_company text,p_date date,p_account text,p_time text) returns uuid
language sql stable security definer set search_path=public,pg_temp as $$
 select h.id from public.account_review_holds h
 left join public.account_review_hold_continuations c on c.hold_id=h.id
 where h.company=p_company
 and (h.business_date=p_date or c.hold_id is not null and p_date>=h.business_date)
 and h.account=regexp_replace(coalesce(p_account,''),'[^0-9]','','g')
 and (h.time_from='00:00:00'::time and h.time_to='23:59:59'::time
 or (p_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$' and p_time between h.time_from::text and h.time_to::text))
 order by h.business_date desc,h.id limit 1
$$;
create or replace function public.account_review_hold_scopes() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(to_jsonb(h)||jsonb_build_object('continuous',c.hold_id is not null) order by h.business_date,h.id),'[]')
 from public.account_review_holds h left join public.account_review_hold_continuations c on c.hold_id=h.id
 where public.account_review_hold_access(h.company)
$$;
create or replace function public.account_review_hold_for_case(p_case uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare e public.exceptions;v uuid;
begin
 select * into e from public.exceptions where id=p_case;
 if not found or not public.account_review_hold_access(e.company) then raise exception 'ไม่มีสิทธิ์เคส/บริษัท' using errcode='42501';end if;
 v:=public.account_review_hold_id(e.company,e.business_date,e.account,coalesce(e.bo_time,e.occurred_at)::text);
 return (select to_jsonb(h)||jsonb_build_object('continuous',c.hold_id is not null)
 from public.account_review_holds h left join public.account_review_hold_continuations c on c.hold_id=h.id where h.id=v);
end$$;

-- Supplemental operational report: existing account/company authorization only.
-- Projects existing cases dynamically, so future manual/system versions are
-- protected without inserting duplicate cases or overwriting ledger history.
create or replace function public.account_review_hold_continuation_report(p_company text,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare scopes jsonb;items jsonb;
begin
 if not public.account_review_hold_access(p_company) or not coalesce(public.current_app_role() in ('lead','monitor','audit_assistant','shift_lead','exec','admin'),false)
 then raise exception 'ไม่มีสิทธิ์อ่านทะเบียนบริษัท' using errcode='42501';end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>365 then raise exception 'ช่วงรายงานไม่เกิน 366 วัน';end if;
 select coalesce(jsonb_agg(to_jsonb(h)||jsonb_build_object('continuous',true) order by h.business_date,h.id),'[]') into scopes
 from public.account_review_holds h join public.account_review_hold_continuations c on c.hold_id=h.id
 where h.company=p_company and h.business_date<=p_to;
 select coalesce(jsonb_agg(jsonb_build_object('hold_id',h.id,'source_ref',e.id::text,'item_kind','case','exception_id',e.id,
 'code',e.code,'occurred_at',coalesce(e.bo_time,e.occurred_at)::text,'direction',e.direction,'bo_amount',e.system_amount,
 'original_status',e.status,'company',h.company,'date',e.business_date,'account',h.account,'reason',h.reason,
 'responsible_role',h.responsible_role,'registered_at',h.created_at,'registered_by',h.created_by,
 'continuous',true,'assessment','ยังประเมินไม่ได้ — ขาด STM','loss_amount',null)
 order by e.business_date,coalesce(e.bo_time,e.occurred_at),e.id),'[]') into items
 from public.exceptions e join public.account_review_holds h on h.id=public.account_review_hold_id(e.company,e.business_date,e.account,coalesce(e.bo_time,e.occurred_at)::text)
 join public.account_review_hold_continuations c on c.hold_id=h.id
 where e.company=p_company and e.business_date between p_from and p_to and e.superseded_by_exception_id is null;
 return jsonb_build_object('company',p_company,'scopes',scopes,'items',items);
end$$;

-- Finance report remains finance-only; supplement, never replace, old ledger.
create or replace function public.account_review_hold_report(p_company text,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare scopes jsonb;items jsonb;continuation jsonb;
begin
 if not coalesce(p_company=any(public.finance_reporting_companies()),false) then raise exception 'ไม่มีสิทธิ์รายงานบริษัท' using errcode='42501';end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>365 then raise exception 'ช่วงรายงานไม่เกิน 366 วัน';end if;
 continuation:=public.account_review_hold_continuation_report(p_company,p_from,p_to);
 select coalesce(jsonb_agg(to_jsonb(h) order by h.business_date,h.id),'[]') into scopes from public.account_review_holds h
 where h.company=p_company and h.business_date between p_from and p_to
 and not exists(select 1 from public.account_review_hold_continuations c where c.hold_id=h.id);
 select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('company',h.company,'date',h.business_date,'account',h.account,
 'reason',h.reason,'responsible_role',h.responsible_role,'registered_at',h.created_at,'registered_by',h.created_by,
 'assessment','ยังประเมินไม่ได้ — ขาด STM','loss_amount',null) order by h.business_date,i.occurred_at,i.source_ref),'[]') into items
 from public.account_review_hold_items i join public.account_review_holds h on h.id=i.hold_id
 where h.company=p_company and h.business_date between p_from and p_to;
 return jsonb_build_object('company',p_company,'scopes',scopes||(continuation->'scopes'),'items',items||(continuation->'items'));
end$$;
revoke all on function public.account_review_hold_continuation_report(text,date,date) from public,anon;
grant execute on function public.account_review_hold_continuation_report(text,date,date) to authenticated;
-- Reassert private matching helper after replacement; no new write privileges.
revoke all on function public.account_review_hold_id(text,date,text,text) from public,anon,authenticated;

do $$
declare old_items text;old_scopes text;before_cases text;after_cases text;h public.account_review_holds;
begin
 select md5(coalesce(jsonb_agg(to_jsonb(i) order by hold_id,source_ref)::text,'')) into old_items from public.account_review_hold_items i;
 select md5(coalesce(jsonb_agg(to_jsonb(s) order by id)::text,'')) into old_scopes from public.account_review_holds s where request_ref<>'user-approved-fr8-scb-20261016-continuous';
 select md5(coalesce(jsonb_agg(to_jsonb(e) order by id)::text,'')) into before_cases from public.exceptions e where company='FR8' and business_date>='2026-10-16';
 if exists(select 1 from public.damages d join public.exceptions e on e.id=d.exception_id where e.company='FR8'
 and regexp_replace(e.account,'[^0-9]','','g')='4311918665' and e.business_date>='2026-10-16')
 then raise exception 'Existing damage must be reviewed separately, not overwritten';end if;
 insert into public.account_review_holds(id,company,account,business_date,time_from,time_to,reason,created_by,request_ref) values
 ('83abf196-4d52-441d-a72c-4aff75434b16','FR8','4311918665','2026-10-16','00:00:00','23:59:59',
 'SCB จิตติพัฒน์ถูกระงับ — พักตรวจต่อเนื่องตั้งแต่ 16 ต.ค. 2026 จนมี STM และหัวหน้า/Admin ยืนยันยกเลิกพัก ไม่คิดเป็นความเสียหายจริง ไม่เปลี่ยนยอดหรือปิดเคส',
 '3bd23940-ef55-46ec-9a10-294779cd33b4','user-approved-fr8-scb-20261016-continuous') on conflict(request_ref) do nothing;
 select * into strict h from public.account_review_holds where request_ref='user-approved-fr8-scb-20261016-continuous';
 if h.id<>'83abf196-4d52-441d-a72c-4aff75434b16' or h.company<>'FR8' or h.account<>'4311918665' or h.business_date<>'2026-10-16'
 or h.time_from<>'00:00:00' or h.time_to<>'23:59:59' then raise exception 'Continuous scope conflict; stop for review';end if;
 insert into public.account_review_hold_continuations(hold_id,authorization_ref) values(h.id,h.request_ref) on conflict do nothing;
 if not exists(select 1 from public.account_review_hold_continuations c where c.hold_id=h.id and c.authorization_ref=h.request_ref) then raise exception 'Continuation receipt conflict';end if;
 select md5(coalesce(jsonb_agg(to_jsonb(e) order by id)::text,'')) into after_cases from public.exceptions e where company='FR8' and business_date>='2026-10-16';
 if before_cases<>after_cases or old_items<>(select md5(coalesce(jsonb_agg(to_jsonb(i) order by hold_id,source_ref)::text,'')) from public.account_review_hold_items i)
 or old_scopes<>(select md5(coalesce(jsonb_agg(to_jsonb(s) order by id)::text,'')) from public.account_review_holds s where request_ref<>'user-approved-fr8-scb-20261016-continuous')
 then raise exception 'Protected cases or historical ledger changed';end if;
end$$;
notify pgrst,'reload schema';
commit;
