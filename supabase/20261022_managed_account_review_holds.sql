-- Head/Admin managed account suspension holds. Reconciliation results, cases,
-- amounts, evidence, run history and existing hold history remain unchanged.
begin;
set local lock_timeout='5s';

alter table public.account_review_holds add column if not exists bank text;
alter table public.account_review_holds add column if not exists account_name text;
alter table public.account_review_hold_continuations add column if not exists effective_end_date date;
alter table public.account_review_hold_continuations add column if not exists released_at timestamptz;
alter table public.account_review_hold_continuations add column if not exists released_by uuid references auth.users(id);
alter table public.account_review_hold_continuations add column if not exists release_reason text;
alter table public.account_review_hold_continuations add column if not exists revision integer not null default 1 check(revision>0);

create or replace function public.account_review_hold_id(p_company text,p_date date,p_account text,p_time text) returns uuid
language sql stable security definer set search_path=public,pg_temp as $$
 select h.id from public.account_review_holds h
 left join public.account_review_hold_continuations c on c.hold_id=h.id
 where h.company=p_company
 and ((c.hold_id is null and h.business_date=p_date) or (c.hold_id is not null and p_date>=h.business_date and (c.effective_end_date is null or p_date<c.effective_end_date)))
 and h.account=regexp_replace(coalesce(p_account,''),'[^0-9]','','g')
 and (h.time_from='00:00:00'::time and h.time_to='23:59:59'::time
 or (p_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$' and p_time between h.time_from::text and h.time_to::text))
 order by h.business_date desc,h.id limit 1
$$;

create or replace function public.account_review_hold_scopes() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(to_jsonb(h)||jsonb_build_object(
  'continuous',c.hold_id is not null,'active',c.hold_id is not null and c.effective_end_date is null,
  'effective_end_date',c.effective_end_date,'released_at',c.released_at,'released_by',c.released_by,
  'release_reason',c.release_reason,'revision',coalesce(c.revision,1)) order by h.business_date,h.id),'[]')
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
 return (select to_jsonb(h)||jsonb_build_object('continuous',c.hold_id is not null,'active',c.hold_id is not null and c.effective_end_date is null,
 'effective_end_date',c.effective_end_date,'release_reason',c.release_reason,'revision',coalesce(c.revision,1))
 from public.account_review_holds h left join public.account_review_hold_continuations c on c.hold_id=h.id where h.id=v);
end$$;

create or replace function public.account_review_hold_continuation_report(p_company text,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare scopes jsonb;items jsonb;
begin
 if not public.account_review_hold_access(p_company) or not coalesce(public.current_app_role() in ('lead','monitor','audit_assistant','shift_lead','exec','admin'),false)
 then raise exception 'ไม่มีสิทธิ์อ่านทะเบียนบริษัท' using errcode='42501';end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>365 then raise exception 'ช่วงรายงานไม่เกิน 366 วัน';end if;
 select coalesce(jsonb_agg(to_jsonb(h)||jsonb_build_object('continuous',true,'active',c.effective_end_date is null,
 'effective_end_date',c.effective_end_date,'released_at',c.released_at,'released_by',c.released_by,'release_reason',c.release_reason,'revision',c.revision)
 order by h.business_date,h.id),'[]') into scopes
 from public.account_review_holds h join public.account_review_hold_continuations c on c.hold_id=h.id
 where h.company=p_company and h.business_date<=p_to and (c.effective_end_date is null or c.effective_end_date>p_from);
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

create or replace function public.manage_account_review_hold(
 p_action text,p_company text,p_account text,p_bank text,p_account_name text,p_reason text,
 p_start_date date default current_date,p_expected_revision integer default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare normalized text:=regexp_replace(coalesce(p_account,''),'[^0-9]','','g');role_name text:=public.current_app_role();h public.account_review_holds;c public.account_review_hold_continuations;
begin
 if auth.uid() is null or role_name not in ('lead','admin') or not public.account_review_hold_access(p_company) then raise exception 'เฉพาะหัวหน้าออดิทหรือผู้ดูแลระบบที่มีสิทธิ์บริษัท' using errcode='42501';end if;
 if p_action not in ('pause','resume') or length(normalized) not between 6 and 20 or p_start_date is null or length(btrim(coalesce(p_reason,'')))<10 then raise exception 'ข้อมูลพักบัญชีไม่ครบหรือเหตุผลสั้นกว่า 10 ตัวอักษร';end if;
 perform pg_advisory_xact_lock(hashtextextended(upper(p_company)||':'||normalized,0));
 select h0.* into h from public.account_review_holds h0 join public.account_review_hold_continuations c0 on c0.hold_id=h0.id where upper(h0.company)=upper(p_company) and h0.account=normalized and c0.effective_end_date is null order by h0.business_date desc,h0.id limit 1 for update of c0;
 if p_action='pause' then
  if found then return jsonb_build_object('ok',true,'unchanged',true,'hold',to_jsonb(h));end if;
  if length(btrim(coalesce(p_bank,'')))<2 or length(btrim(coalesce(p_account_name,'')))<2 then raise exception 'ระบุธนาคารและชื่อบัญชี';end if;
  insert into public.account_review_holds(id,company,account,business_date,time_from,time_to,reason,responsible_role,created_by,request_ref,bank,account_name)
  values(gen_random_uuid(),upper(p_company),normalized,p_start_date,'00:00:00','23:59:59',btrim(p_reason),'Audit Lead / Admin',auth.uid(),'managed-account-hold:'||gen_random_uuid(),upper(btrim(p_bank)),btrim(p_account_name)) returning * into h;
  insert into public.account_review_hold_continuations(hold_id,authorization_ref) values(h.id,h.request_ref) returning * into c;
  insert into public.audit_log(actor,actor_user_id,action,entity,target,company,detail,meta) values(auth.uid()::text,auth.uid(),'account_hold_paused','account_review_hold',h.id::text,h.company,h.reason,jsonb_build_object('account',h.account,'bank',h.bank,'account_name',h.account_name,'start_date',h.business_date));
 else
  if not found then raise exception 'ไม่พบบัญชีที่กำลังพักอยู่';end if;
  select * into c from public.account_review_hold_continuations where hold_id=h.id for update;
  if p_expected_revision is null or p_expected_revision<>c.revision then raise exception 'ข้อมูลถูกเปลี่ยนแล้ว กรุณาโหลดใหม่';end if;
  update public.account_review_hold_continuations set effective_end_date=p_start_date,released_at=clock_timestamp(),released_by=auth.uid(),release_reason=btrim(p_reason),revision=revision+1 where hold_id=h.id returning * into c;
  insert into public.audit_log(actor,actor_user_id,action,entity,target,company,detail,meta) values(auth.uid()::text,auth.uid(),'account_hold_resumed','account_review_hold',h.id::text,h.company,c.release_reason,jsonb_build_object('account',h.account,'effective_end_date',c.effective_end_date,'revision',c.revision));
 end if;
 return jsonb_build_object('ok',true,'hold',to_jsonb(h),'control',to_jsonb(c));
end$$;

revoke all on function public.manage_account_review_hold(text,text,text,text,text,text,date,integer) from public,anon;
grant execute on function public.manage_account_review_hold(text,text,text,text,text,text,date,integer) to authenticated;
revoke all on function public.account_review_hold_id(text,date,text,text) from public,anon,authenticated;

do $$
declare h public.account_review_holds;
begin
 perform pg_advisory_xact_lock(hashtextextended('3XB:6242596342',0));
 select h0.* into h from public.account_review_holds h0 join public.account_review_hold_continuations c on c.hold_id=h0.id where h0.company='3XB' and h0.account='6242596342' and c.effective_end_date is null limit 1;
 if not found then
  insert into public.account_review_holds(id,company,account,business_date,time_from,time_to,reason,responsible_role,created_by,request_ref,bank,account_name)
  values('5b47d451-b8c8-4b70-8de7-72f739003d4a','3XB','6242596342','2026-10-22','00:00:00','23:59:59','SCB แววดาวถูกระงับ — พักตรวจและรอ STM จนกว่าหัวหน้าออดิทหรือผู้ดูแลระบบจะปลดพัก','Audit Lead / Admin','3bd23940-ef55-46ec-9a10-294779cd33b4','user-approved-3xb-scb-waewdao-20261022','SCB','แววดาว') returning * into h;
  insert into public.account_review_hold_continuations(hold_id,authorization_ref) values(h.id,h.request_ref);
 end if;
end$$;
notify pgrst,'reload schema';
commit;
