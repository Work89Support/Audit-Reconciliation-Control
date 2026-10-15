-- Additive action ledger only. Never changes exceptions, damages or receipts.
begin;
set local lock_timeout='5s';
create table if not exists public.finance_action_evidence(
 id uuid primary key default gen_random_uuid(),company text not null,exception_id uuid not null references public.exceptions(id),
 file_name text not null,size_bytes bigint not null check(size_bytes between 1 and 20971520),mime_type text not null,
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),storage_path text not null unique,
 uploaded_by uuid not null,created_at timestamptz not null default clock_timestamp(),
 unique(company,exception_id,sha256)
);
create table if not exists public.finance_action_events(
 id uuid primary key default gen_random_uuid(),seq bigint generated always as identity unique,
 request_id uuid not null,company text not null,exception_id uuid not null references public.exceptions(id),
 action_type text not null check(action_type in ('remediated','finance_notified','recovery_received')),
 state text not null check(state in ('done','reopened')),responsible_id uuid not null,
 action_date date not null,note text not null check(length(btrim(note)) between 3 and 4000),
 evidence_ids uuid[] not null default '{}',actor_id uuid not null,created_at timestamptz not null default clock_timestamp(),
 payload jsonb not null,unique(actor_id,request_id),check(state<>'done' or cardinality(evidence_ids)>0)
);
create index if not exists finance_action_latest on public.finance_action_events(company,exception_id,action_type,seq desc);

create or replace function public.finance_action_access(p_company text,p_write boolean default false) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and coalesce(public.current_user_active(),false)
 and coalesce(public.current_app_role(),'')=any(case when p_write then array['lead','admin'] else array['lead','admin','exec'] end)
 and exists(select 1 from public.audit_companies c where c.code=p_company and c.active
 and (public.current_app_role()='admin' or exists(select 1 from public.user_company_access a
 where a.user_id=auth.uid() and upper(a.company) in (upper(c.code),'*'))))
$$;
alter table public.finance_action_events enable row level security;
alter table public.finance_action_evidence enable row level security;
revoke all on public.finance_action_events,public.finance_action_evidence from public,anon,authenticated;
grant select on public.finance_action_events,public.finance_action_evidence to authenticated;
drop policy if exists finance_action_read on public.finance_action_events;
create policy finance_action_read on public.finance_action_events for select to authenticated using(public.finance_action_access(company));
drop policy if exists finance_action_proof_read on public.finance_action_evidence;
create policy finance_action_proof_read on public.finance_action_evidence for select to authenticated using(public.finance_action_access(company));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('finance-action-evidence','finance-action-evidence',false,20971520,array['application/pdf','image/png','image/jpeg','image/webp','text/plain','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do nothing;
-- Abort rather than accidentally publish evidence in a pre-existing public bucket.
do $$begin if exists(select 1 from storage.buckets where id='finance-action-evidence' and public) then raise exception 'Action bucket must be private';end if;end$$;
create or replace function public.finance_action_storage_access(p_path text,p_write boolean default false) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.finance_action_evidence f where f.storage_path=p_path
 and public.finance_action_access(f.company,p_write) and (not p_write or f.uploaded_by=auth.uid()))
$$;
drop policy if exists finance_action_storage_read on storage.objects;
create policy finance_action_storage_read on storage.objects for select to authenticated using(bucket_id='finance-action-evidence' and public.finance_action_storage_access(name));
drop policy if exists finance_action_storage_insert on storage.objects;
create policy finance_action_storage_insert on storage.objects for insert to authenticated with check(bucket_id='finance-action-evidence' and public.finance_action_storage_access(name,true));
-- Restrictive guards also protect this bucket if an older permissive policy exists.
drop policy if exists finance_action_storage_read_guard on storage.objects;
create policy finance_action_storage_read_guard on storage.objects as restrictive for select to public using(bucket_id<>'finance-action-evidence' or public.finance_action_storage_access(name));
drop policy if exists finance_action_storage_insert_guard on storage.objects;
create policy finance_action_storage_insert_guard on storage.objects as restrictive for insert to public with check(bucket_id<>'finance-action-evidence' or (public.finance_action_storage_access(name,true) and (metadata->>'size')::bigint between 1 and 20971520));
drop policy if exists finance_action_storage_update_guard on storage.objects;
create policy finance_action_storage_update_guard on storage.objects as restrictive for update to public using(bucket_id<>'finance-action-evidence') with check(bucket_id<>'finance-action-evidence');
drop policy if exists finance_action_storage_delete_guard on storage.objects;
create policy finance_action_storage_delete_guard on storage.objects as restrictive for delete to public using(bucket_id<>'finance-action-evidence');
-- No update/delete policy: no upsert or overwriting evidence.

create or replace function public.reserve_finance_action_evidence(p_company text,p_case uuid,p_name text,p_size bigint,p_mime text,p_sha256 text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.finance_action_evidence;new_id uuid:=gen_random_uuid();
begin
 if not public.finance_action_access(p_company,true) or not exists(select 1 from public.exceptions where id=p_case and company=p_company) then raise exception 'ไม่มีสิทธิ์เคส/บริษัท' using errcode='42501';end if;
 if p_size is null or p_size not between 1 and 20971520 or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$'
 or p_name is null or length(p_name) not between 1 and 200 or p_name ~ '[/\\]' or p_name ~ '[[:cntrl:]]'
 or p_mime is null or p_mime<>all(array['application/pdf','image/png','image/jpeg','image/webp','text/plain','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']) then raise exception 'ไฟล์ไม่ถูกต้องหรือเกิน 20 MB';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_company||p_case::text||p_sha256,0));
 select * into f from public.finance_action_evidence where company=p_company and exception_id=p_case and sha256=p_sha256;
 if not found then
 insert into public.finance_action_evidence(id,company,exception_id,file_name,size_bytes,mime_type,sha256,storage_path,uploaded_by)
 values(new_id,p_company,p_case,p_name,p_size,p_mime,p_sha256,p_company||'/'||auth.uid()::text||'/'||new_id::text||'/'||p_name,auth.uid()) returning * into f;
 elsif f.size_bytes<>p_size then raise exception 'ไฟล์ซ้ำแต่ขนาดไม่ตรง';end if;
 if f.uploaded_by<>auth.uid() and not exists(select 1 from storage.objects where bucket_id='finance-action-evidence' and name=f.storage_path and (metadata->>'size')::bigint=f.size_bytes) then raise exception 'ไฟล์เดิมยังอัปโหลดไม่ครบ ให้ผู้แนบเดิมลองต่อ';end if;
 return to_jsonb(f)||jsonb_build_object('uploaded',exists(select 1 from storage.objects where bucket_id='finance-action-evidence' and name=f.storage_path and (metadata->>'size')::bigint=f.size_bytes));
end$$;

create or replace function public.finance_action_case(p_company text,p_case uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare e public.exceptions;history jsonb;owners jsonb;files jsonb;
begin
 if not public.finance_action_access(p_company) then raise exception 'ไม่มีสิทธิ์บริษัท' using errcode='42501';end if;
 select * into e from public.exceptions where company=p_company and id=p_case;
 if not found then raise exception 'ไม่พบเคสในบริษัท';end if;
 if (select count(*) from public.finance_action_events where exception_id=p_case and company=p_company)>1000 then raise exception 'ประวัติมากเกินขอบเขต ต้องแยกรายงาน';end if;
 select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('responsible_name',p.full_name,'actor_name',u.full_name) order by a.seq desc),'[]') into history
 from public.finance_action_events a left join public.app_profiles p on p.user_id=a.responsible_id left join public.app_profiles u on u.user_id=a.actor_id
 where a.exception_id=p_case and a.company=p_company;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.user_id,'name',coalesce(nullif(p.full_name,''),p.user_id::text)) order by p.full_name),'[]') into owners
 from public.app_profiles p where p.active and (p.role='admin' or exists(select 1 from public.user_company_access a where a.user_id=p.user_id and upper(a.company) in (upper(p_company),'*')));
 select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at),'[]') into files from public.finance_action_evidence f
 where f.company=p_company and f.exception_id=p_case and exists(select 1 from storage.objects o where o.bucket_id='finance-action-evidence' and o.name=f.storage_path and (o.metadata->>'size')::bigint=f.size_bytes);
 return jsonb_build_object('company',p_company,'case_id',p_case,'code',e.code,'date',e.business_date,'case_status',e.status,
 'can_write',public.finance_action_access(p_company,true),'owners',owners,'history',history,'files',files);
end$$;

create or replace function public.find_finance_action_case(p_company text,p_date date,p_code text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare ids uuid[];
begin
 if not public.finance_action_access(p_company) then raise exception 'ไม่มีสิทธิ์บริษัท' using errcode='42501';end if;
 if p_date is null or p_code is null or length(btrim(p_code)) not between 1 and 100 then raise exception 'ระบุบริษัท วันที่ และรหัสเคส';end if;
 select array_agg(id) into ids from public.exceptions where company=p_company and business_date=p_date and upper(code)=upper(btrim(p_code));
 if coalesce(cardinality(ids),0)=0 then raise exception 'ไม่พบเคส';end if;
 if cardinality(ids)>1 then raise exception 'รหัสซ้ำหลายเวอร์ชัน ให้เปิดจากรายละเอียดเคสในรายงานเพื่อระบุ UUID';end if;
 return public.finance_action_case(p_company,ids[1]);
end$$;

create or replace function public.save_finance_action(p_company text,p_case uuid,p_action text,p_state text,p_owner uuid,p_date date,p_note text,p_files uuid[],p_request uuid,p_expected uuid default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare old public.finance_action_events;latest_id uuid;payload_value jsonb;f uuid;file_ids uuid[];
begin
 if not public.finance_action_access(p_company,true) or not exists(select 1 from public.exceptions where id=p_case and company=p_company) then raise exception 'ไม่มีสิทธิ์บันทึก Action' using errcode='42501';end if;
 if p_request is null or p_action is null or p_action<>all(array['remediated','finance_notified','recovery_received']) or p_state is null or p_state<>all(array['done','reopened'])
 or p_date is null or p_date>(clock_timestamp() at time zone 'Asia/Bangkok')::date
 or p_date<(select business_date from public.exceptions where id=p_case and company=p_company)
 or p_note is null or length(btrim(p_note)) not between 3 and 4000
 or p_owner is null or not exists(select 1 from public.app_profiles p where p.user_id=p_owner and p.active and (p.role='admin' or exists(select 1 from public.user_company_access a where a.user_id=p.user_id and upper(a.company) in (upper(p_company),'*')))) then raise exception 'ต้องระบุขั้นตอน ผู้รับผิดชอบ วันที่ไม่เกินวันนี้ และรายละเอียด';end if;
 select coalesce(array_agg(distinct x order by x),'{}') into file_ids from unnest(coalesce(p_files,'{}')) x;
 if cardinality(file_ids)>10 or (p_state='done' and cardinality(file_ids)=0) then raise exception 'ต้องมีหลักฐานจริง 1–10 ไฟล์';end if;
 foreach f in array file_ids loop
 if not exists(select 1 from public.finance_action_evidence a join storage.objects o on o.bucket_id='finance-action-evidence' and o.name=a.storage_path
 where a.id=f and a.company=p_company and a.exception_id=p_case and (o.metadata->>'size')::bigint=a.size_bytes) then raise exception 'หลักฐานยังอัปโหลดไม่ครบหรือไม่ตรงเคส';end if;
 end loop;
 payload_value:=jsonb_build_object('company',p_company,'case_id',p_case,'action',p_action,'state',p_state,'owner',p_owner,'date',p_date,'note',btrim(p_note),'files',file_ids,'expected',p_expected);
 -- Lock retry ID as well as case step so simultaneous retries cannot race.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request::text,0));
 select * into old from public.finance_action_events where actor_id=auth.uid() and request_id=p_request;
 if found then if old.payload<>payload_value then raise exception 'คำขอเดิมมีข้อมูลต่างกัน กรุณาตรวจประวัติก่อน';end if;return public.finance_action_case(p_company,p_case);end if;
 perform pg_advisory_xact_lock(hashtextextended(p_company||p_case::text||p_action,0));
 select id into latest_id from public.finance_action_events where company=p_company and exception_id=p_case and action_type=p_action order by seq desc limit 1;
 if latest_id is distinct from p_expected then raise exception 'Action เปลี่ยนแล้ว กรุณาเปิดประวัติล่าสุดก่อนบันทึก' using errcode='40001';end if;
 insert into public.finance_action_events(request_id,company,exception_id,action_type,state,responsible_id,action_date,note,evidence_ids,actor_id,payload)
 values(p_request,p_company,p_case,p_action,p_state,p_owner,p_date,btrim(p_note),file_ids,auth.uid(),payload_value);
 return public.finance_action_case(p_company,p_case);
end$$;

create or replace function public.finance_action_report(p_company text,p_to date) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare rows jsonb;
begin
 if not public.finance_action_access(p_company) then raise exception 'ไม่มีสิทธิ์บริษัท' using errcode='42501';end if;
 if p_to is null then raise exception 'ระบุวันที่สิ้นช่วง';end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.seq desc),'[]') into rows from (
 select distinct on(a.exception_id,a.action_type) a.id,a.seq,a.company,a.exception_id,a.action_type,a.state,a.responsible_id,p.full_name as responsible_name,
 a.action_date,a.note,a.evidence_ids,a.actor_id,a.created_at,e.code,e.business_date as date,e.status as case_status
 from public.finance_action_events a join public.exceptions e on e.id=a.exception_id and e.company=a.company
 left join public.app_profiles p on p.user_id=a.responsible_id where a.company=p_company and e.business_date<=p_to
 order by a.exception_id,a.action_type,a.seq desc limit 10001) t;
 if jsonb_array_length(rows)>10000 then raise exception 'Action มากเกินขอบเขต ต้องแยกช่วงรายงาน';end if;
 return jsonb_build_object('company',p_company,'as_of',clock_timestamp(),'items',rows);
end$$;
revoke all on function public.finance_action_access(text,boolean),public.finance_action_storage_access(text,boolean),public.reserve_finance_action_evidence(text,uuid,text,bigint,text,text),public.finance_action_case(text,uuid),public.find_finance_action_case(text,date,text),public.save_finance_action(text,uuid,text,text,uuid,date,text,uuid[],uuid,uuid),public.finance_action_report(text,date) from public,anon;
grant execute on function public.finance_action_access(text,boolean),public.finance_action_storage_access(text,boolean),public.reserve_finance_action_evidence(text,uuid,text,bigint,text,text),public.finance_action_case(text,uuid),public.find_finance_action_case(text,date,text),public.save_finance_action(text,uuid,text,text,uuid,date,text,uuid[],uuid,uuid),public.finance_action_report(text,date) to authenticated;
notify pgrst,'reload schema';
commit;
