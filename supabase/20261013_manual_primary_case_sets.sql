-- New case sets are explicit head/admin decisions, separate from report acceptance.
begin;
set local lock_timeout='5s';
create table public.manual_primary_case_sets (
 primary_id uuid primary key references public.manual_primary_results(id),
 company text not null,business_date date not null,
 confirmed_by uuid not null references public.app_profiles(user_id),
 confirmed_at timestamptz not null default now(),reason text not null,
 case_count integer not null check(case_count between 0 and 10000)
);
create index primary_case_set_scope on public.manual_primary_case_sets(company,business_date);
create table public.manual_primary_case_items (
 primary_id uuid not null references public.manual_primary_case_sets(primary_id),
 row_kind text not null check(row_kind in ('exception','waiting')),
 row_index integer not null check(row_index>=0),
 source_key text not null,exception_id uuid not null unique references public.exceptions(id),
 primary key(primary_id,row_kind,row_index),unique(primary_id,source_key)
);
alter table public.manual_primary_case_sets enable row level security;
alter table public.manual_primary_case_items enable row level security;
create policy primary_case_set_read on public.manual_primary_case_sets for select to authenticated
 using(public.current_user_active() and public.has_company_access(company));
create policy primary_case_item_read on public.manual_primary_case_items for select to authenticated
 using(exists(select 1 from public.manual_primary_case_sets b where b.primary_id=manual_primary_case_items.primary_id));
grant select on public.manual_primary_case_sets,public.manual_primary_case_items to authenticated;
revoke insert,update,delete on public.manual_primary_case_sets,public.manual_primary_case_items from anon,authenticated;

create function public.primary_case_is_current(p_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.exceptions e where e.id=p_id and public.current_user_active() and public.has_company_access(e.company)
 and (not exists(select 1 from public.manual_primary_case_sets b where b.company=e.company and b.business_date=e.business_date)
 or exists(select 1 from public.manual_primary_case_items i join public.manual_primary_results v on v.id=i.primary_id
 where i.exception_id=e.id and v.id=(select n.id from public.manual_primary_results n
 where n.company=e.company and n.business_date=e.business_date order by n.accepted_at desc,n.id desc limit 1))))
$$;
create view public.active_audit_exceptions with(security_invoker=true) as
 select e.* from public.exceptions e where public.primary_case_is_current(e.id);
grant select on public.active_audit_exceptions to authenticated;

create function public.manual_primary_cases_preview(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v public.manual_primary_results; check_result jsonb; b public.manual_primary_case_sets;
begin
 select * into v from public.manual_primary_results where id=p_id;
 if v.id is null or not coalesce(public.current_user_active(),false) or coalesce(public.current_app_role(),'') not in ('lead','admin')
 or not coalesce(public.has_company_access(v.company),false)
 or (public.current_app_role()='lead' and not exists(select 1 from public.user_company_access where user_id=auth.uid() and upper(company)=upper(v.company)))
 then raise exception 'เฉพาะหัวหน้า/ผู้ดูแลในบริษัทที่มีสิทธิ์';end if;
 if v.id is distinct from (select id from public.manual_primary_results where company=v.company and business_date=v.business_date order by accepted_at desc,id desc limit 1)
 then raise exception 'ผลหลักเปลี่ยน ต้องทบทวนเวอร์ชันล่าสุด';end if;
 check_result:=public.manual_primary_preview(v.recheck_id);
 if not coalesce((check_result->>'allowed')::boolean,false) then raise exception 'ไฟล์หรือขอบเขตเปลี่ยน: %',check_result->'problems';end if;
 if not exists(select 1 from public.account_recheck_jobs q where q.id=v.recheck_id and q.result=v.report and q.base_run_id is not distinct from v.base_run_id)
 or v.source_stamp is distinct from public.manual_primary_sources(public.effective_audit_source_files(v.company,v.business_date))
 then raise exception 'ผลหลักหรือไฟล์เปลี่ยน ต้องทบทวนใหม่';end if;
 select * into b from public.manual_primary_case_sets where primary_id=v.id;
 return jsonb_build_object('primary_id',v.id,'company',v.company,'date',v.business_date,
 'case_count',jsonb_array_length(coalesce(v.report->'exceptions','[]'))+jsonb_array_length(coalesce(v.report->'summary'->'waiting_bo','[]')),
 'history_count',(select count(*) from public.exceptions e where e.company=v.company and e.business_date=v.business_date
 and not exists(select 1 from public.manual_primary_case_items i where i.primary_id=v.id and i.exception_id=e.id)),
 'already_created',b.primary_id is not null,'token',md5(v.id::text||(check_result->>'token')));
end $$;

create function public.activate_manual_primary_cases(p_id uuid,p_token text,p_reason text,p_reviewed boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v public.manual_primary_results; p jsonb; r jsonb; item record; n integer:=0; eid uuid; k text; b public.manual_primary_case_sets;
begin
 perform 1 from public.app_profiles where user_id=auth.uid() and active and role in ('lead','admin') for update;
 if not found then raise exception 'เฉพาะหัวหน้า/ผู้ดูแลที่ใช้งานอยู่';end if;
 select * into strict v from public.manual_primary_results where id=p_id;
 perform 1 from public.daily_recon_jobs where company=v.company and business_date=v.business_date and not is_archived for update;
 perform 1 from public.manual_primary_results where id=p_id for update;
 if p_reviewed is distinct from true or length(trim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception 'ต้องทบทวนและระบุเหตุผล';end if;
 p:=public.manual_primary_cases_preview(p_id);
 select * into b from public.manual_primary_case_sets where primary_id=p_id;
 if b.primary_id is not null then return jsonb_build_object('primary_id',p_id,'created',0,'case_count',b.case_count,'replayed',true);end if;
 if p->>'token' is distinct from p_token then raise exception 'ข้อมูลเปลี่ยน ต้องทบทวนใหม่';end if;
 insert into public.manual_primary_case_sets(primary_id,company,business_date,confirmed_by,reason,case_count)
 values(v.id,v.company,v.business_date,auth.uid(),trim(p_reason),(p->>'case_count')::integer);
 for item in
 select 'exception' kind,(ordinality-1)::integer idx,value payload from jsonb_array_elements(coalesce(v.report->'exceptions','[]')) with ordinality
 union all select 'waiting',(ordinality-1)::integer,value from jsonb_array_elements(coalesce(v.report->'summary'->'waiting_bo','[]')) with ordinality
 loop
 r:=item.payload;
 if item.kind='waiting' then r:=jsonb_build_object('company',v.company,'business_date',v.business_date,'account',r->'account','direction',r->'direction',
 'system_amount',r->'systemAmount','bank_amount',r->'bankAmount','amount_diff',r->'amountDiff','risk_amount',r->'riskAmount',
 'bo_date',r->'boDate','bo_time',r->'boTime','stm_date',nullif(r->>'stmDate',''),'stm_time',nullif(r->>'stmTime','-'),
 'bo_raw',r->'boRaw','stm_raw',r->'stmRaw','employee',r->'employee','cause',r->'cause','detail',r->'detail','severity',r->'severity',
 'ex_type','missing_stm','type_name','BO รอ STM/PM/หลักฐาน','customer_details',coalesce(r->'customerDetails','{}')||
 jsonb_build_object('waiting_source',true,'bo_account_label',r->'account','source_rows',jsonb_build_object('bo',r->'boSource','stm',r->'stmSource')));end if;
 if r->>'company' is distinct from v.company or r->>'business_date' is distinct from v.business_date::text
 or r->>'direction' not in ('ฝาก','ถอน','deposit','withdraw') or nullif(r->>'account','') is null then raise exception 'ขอบเขตรายการต้นทางไม่ตรง';end if;
 k:=md5(jsonb_build_object('company',v.company,'date',v.business_date,'direction',r->>'direction','sources',r->'customer_details'->'source_rows')::text);
 if r->'customer_details'->'source_rows' is null or r->'customer_details'->'source_rows'='{}' then raise exception 'ไม่มีหลักฐานไฟล์และแถวต้นทาง';end if;
 eid:=gen_random_uuid();n:=n+1;
 insert into public.exceptions(id,run_id,code,business_date,occurred_at,company,bank,account,direction,member_code,ex_type,type_name,severity,status,track,
 system_amount,bank_amount,amount_diff,risk_amount,currency,time_diff_sec,employee,shift,cause,detail,bo_raw,stm_raw,bo_date,bo_time,stm_date,stm_time,customer_details)
 values(eid,v.base_run_id,v.company||'-R-'||left(replace(v.id::text,'-',''),8)||'-'||lpad(n::text,3,'0'),v.business_date,nullif(coalesce(r->>'occurred_at',r->>'bo_time',r->>'stm_time'),'')::time,
 v.company,r->>'bank',r->>'account',case when r->>'direction' in ('deposit','ฝาก') then 'ฝาก' else 'ถอน' end,r->>'member_code',r->>'ex_type',r->>'type_name',
 coalesce(r->>'severity','medium'),case when r->>'ex_type'='cross_day' then 'pending_next_day' else 'open' end,
 case when v.company in ('AT4','FR8','SK8') then 'cycle' else 'daily' end,
 (r->>'system_amount')::numeric,(r->>'bank_amount')::numeric,(r->>'amount_diff')::numeric,(r->>'risk_amount')::numeric,coalesce(r->>'currency','THB'),
 (r->>'time_diff_sec')::integer,r->>'employee',r->>'shift',r->>'cause',r->>'detail',r->>'bo_raw',r->>'stm_raw',
 nullif(r->>'bo_date','')::date,nullif(r->>'bo_time','')::time,nullif(r->>'stm_date','')::date,nullif(r->>'stm_time','')::time,
 coalesce(r->'customer_details','{}')||jsonb_build_object('manual_primary_id',v.id,'manual_primary_row_kind',item.kind,'manual_primary_row_index',item.idx));
 insert into public.manual_primary_case_items values(v.id,item.kind,item.idx,k,eid);
 end loop;
 if n<>(p->>'case_count')::integer then raise exception 'จำนวนเคสไม่ตรงผลล่าสุด';end if;
 insert into public.audit_log(actor,action,entity,target,company,detail,meta) values(auth.uid()::text,'manual_primary_case_set_activated','manual_primary_results',v.id::text,v.company,trim(p_reason),
 jsonb_build_object('cases_created',n,'historical_cases_unchanged',p->'history_count','cases_closed',0,'source_amounts_changed',0));
 return jsonb_build_object('primary_id',v.id,'created',n,'case_count',n,'history_count',p->'history_count');
end $$;
revoke all on function public.primary_case_is_current(uuid),public.manual_primary_cases_preview(uuid),public.activate_manual_primary_cases(uuid,text,text,boolean) from public,anon;
grant execute on function public.primary_case_is_current(uuid),public.manual_primary_cases_preview(uuid),public.activate_manual_primary_cases(uuid,text,text,boolean) to authenticated;
-- Pending queues exclude historical sets; direct history/detail reads remain intact.
create view public.active_case_closure_requests with(security_invoker=true) as select q.* from public.case_closure_requests q where public.primary_case_is_current(q.exception_id);
create view public.active_cross_day_pair_requests with(security_invoker=true) as select q.* from public.cross_day_pair_requests q where public.primary_case_is_current(q.exception_id);
create view public.active_cross_day_image_reviews with(security_invoker=true) as select q.* from public.cross_day_image_reviews q where public.primary_case_is_current(q.exception_id);
create view public.active_manual_case_pairs with(security_invoker=true) as select q.* from public.manual_case_pairs q where public.primary_case_is_current(q.bo_case_id) and public.primary_case_is_current(q.stm_case_id);
grant select on public.active_case_closure_requests,public.active_cross_day_pair_requests,public.active_cross_day_image_reviews,public.active_manual_case_pairs to authenticated;
create function public.guard_historical_primary_case() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.manual_primary_case_sets b where b.company=old.company and b.business_date=old.business_date)
 and not public.primary_case_is_current(old.id) then raise exception 'เคสชุดเดิมเป็นประวัติ ใช้เคสจากผลหลักชุดใหม่';end if;
 return new;
end $$;
create trigger primary_history_unchanged before update on public.exceptions for each row execute function public.guard_historical_primary_case();
revoke all on function public.guard_historical_primary_case() from public,anon,authenticated;
create function public.read_manual_primary_case_set(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v public.manual_primary_results;b public.manual_primary_case_sets;
begin
 select * into v from public.manual_primary_results where id=p_id;
 if v.id is null or not coalesce(public.current_user_active(),false) or not coalesce(public.has_company_access(v.company),false) then raise exception 'ไม่มีสิทธิ์บริษัท';end if;
 select * into b from public.manual_primary_case_sets where primary_id=p_id;
 if b.primary_id is null then return null;end if;
 return to_jsonb(b)||jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from public.manual_primary_case_items i where i.primary_id=p_id),
 'open_count',(select count(*) from public.manual_primary_case_items i join public.exceptions e on e.id=i.exception_id where i.primary_id=p_id and e.status not in ('closed','approved')),
 'closed_count',(select count(*) from public.manual_primary_case_items i join public.exceptions e on e.id=i.exception_id where i.primary_id=p_id and e.status in ('closed','approved')));
end $$;
revoke all on function public.read_manual_primary_case_set(uuid) from public,anon;
grant execute on function public.read_manual_primary_case_set(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
