-- Fixed random cohorts and append-only review/evidence history. Never mutate financial records.
begin;
create table public.monthly_audit_sets(
 id uuid primary key default gen_random_uuid(),month date not null check(month=date_trunc('month',month)::date),company text not null,
 requested_count integer not null check(requested_count between 1 and 500),available_count integer not null default 0,selected_count integer not null default 0,
 created_by uuid not null references public.app_profiles(user_id),created_at timestamptz not null default now(),
 unique(month,company),check(selected_count<=requested_count and selected_count<=available_count)
);
create table public.monthly_audit_items(
 id uuid primary key default gen_random_uuid(),set_id uuid not null references public.monthly_audit_sets(id),ordinal integer not null,
 source_key text not null,run_id uuid not null references public.recon_runs(id),exception_id uuid references public.exceptions(id),business_date date not null,
 snapshot jsonb not null,assigned_to uuid references public.app_profiles(user_id),assessment text not null default 'pending' check(assessment in ('pending','passed','concern','needs_evidence')),
 note text not null default '',revision integer not null default 1,reviewed_by uuid references public.app_profiles(user_id),reviewed_at timestamptz,
 unique(set_id,source_key),unique(set_id,ordinal)
);
create table public.monthly_audit_history(
 id uuid primary key default gen_random_uuid(),item_id uuid not null references public.monthly_audit_items(id),actor uuid not null references public.app_profiles(user_id),action text not null,
 detail jsonb not null,created_at timestamptz not null default now()
);
create table public.monthly_audit_evidence(
 id uuid primary key,item_id uuid not null references public.monthly_audit_items(id),storage_path text not null unique,file_name text not null,mime_type text not null,size_bytes bigint not null check(size_bytes between 1 and 20971520),
 uploaded_by uuid not null references public.app_profiles(user_id),created_at timestamptz not null default now()
);
create function public.can_read_monthly_audit(p_set uuid) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce(public.current_user_active(),false) and coalesce(public.current_app_role(),'') in ('monitor','audit_assistant','lead','admin')
 and exists(select 1 from public.monthly_audit_sets s where s.id=p_set and public.has_company_access(s.company))
$$;
create function public.can_review_monthly_audit(p_item uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.monthly_audit_items i where i.id=p_item and public.can_read_monthly_audit(i.set_id)
 and (public.current_app_role() in ('lead','admin') or i.assigned_to=auth.uid()))
$$;
revoke all on function public.can_read_monthly_audit(uuid),public.can_review_monthly_audit(uuid) from public,anon;
grant execute on function public.can_read_monthly_audit(uuid),public.can_review_monthly_audit(uuid) to authenticated;
alter table public.monthly_audit_sets enable row level security;
alter table public.monthly_audit_items enable row level security;
alter table public.monthly_audit_history enable row level security;
alter table public.monthly_audit_evidence enable row level security;
create policy monthly_sets_read on public.monthly_audit_sets for select to authenticated using(public.can_read_monthly_audit(id));
create policy monthly_items_read on public.monthly_audit_items for select to authenticated using(public.can_read_monthly_audit(set_id));
create policy monthly_history_read on public.monthly_audit_history for select to authenticated using(exists(select 1 from public.monthly_audit_items i where i.id=item_id and public.can_read_monthly_audit(i.set_id)));
create policy monthly_evidence_read on public.monthly_audit_evidence for select to authenticated using(exists(select 1 from public.monthly_audit_items i where i.id=item_id and public.can_read_monthly_audit(i.set_id)));
grant select on public.monthly_audit_sets,public.monthly_audit_items,public.monthly_audit_history,public.monthly_audit_evidence to authenticated;
revoke insert,update,delete on public.monthly_audit_sets,public.monthly_audit_items,public.monthly_audit_history,public.monthly_audit_evidence from authenticated,anon;

create function public.monthly_source_key(p jsonb) returns text language sql immutable set search_path=public as $$
 select case when coalesce(nullif(p->'bo','null'::jsonb),p->'stm')->>'fileId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and coalesce(nullif(p->'bo','null'::jsonb),p->'stm')->>'row' ~ '^[0-9]+$'
 and p->>'direction' in ('deposit','withdraw','ฝาก','ถอน') then
 (case when p->'bo' is not null and p->'bo'<>'null'::jsonb then 'BO:' else 'STM:' end)||
 (coalesce(nullif(p->'bo','null'::jsonb),p->'stm')->>'fileId')||':'||(coalesce(nullif(p->'bo','null'::jsonb),p->'stm')->>'row')||':'||
 (case p->>'direction' when 'ฝาก' then 'deposit' when 'ถอน' then 'withdraw' else p->>'direction' end) end
$$;
create function public.monthly_audit_population(p_company text,p_month date)
returns table(source_key text,run_id uuid,exception_id uuid,business_date date,snapshot jsonb)
language sql stable security definer set search_path=public as $$
 with runs as materialized(select r.* from public.daily_recon_jobs j join public.recon_runs r on r.id=j.last_run_id
 where j.company=p_company and j.business_date>=p_month and j.business_date<(p_month+interval '1 month') and not j.is_archived
 and j.status in ('completed','needs_review') and r.company=j.company and r.business_date=j.business_date),
 raw as (
 select r.id as run_id,null::uuid as exception_id,r.business_date,m||jsonb_build_object('kind','matched','bo',m->'bo','stm',m->'stm') as p,2 as priority
 from runs r,jsonb_array_elements(coalesce(r.summary->'match_evidence','[]')) m
 union all
 select r.id,e.id,r.business_date,jsonb_build_object('kind','exception','account',e.account,'direction',e.direction,'bo',e.customer_details->'source_rows'->'bo','stm',e.customer_details->'source_rows'->'stm','amount',coalesce(e.system_amount,e.bank_amount),'result',to_jsonb(e)),1
 from runs r join public.exceptions e on e.run_id=r.id and e.company=p_company and e.business_date=r.business_date
 where e.superseded_by_exception_id is null
 union all
 select r.id,null::uuid,r.business_date,w||jsonb_build_object('kind','waiting_source','bo',w->'boSource','stm',w->'stmSource'),3
 from runs r,jsonb_array_elements(coalesce(r.summary->'waiting_bo','[]')) w
 ),keyed as (select raw.*,public.monthly_source_key(p) as key from raw),
 valid as(select * from keyed k where key is not null
 and exists(select 1 from public.source_files f where f.id::text=coalesce(nullif(k.p->'bo','null'::jsonb),k.p->'stm')->>'fileId' and f.company=p_company and f.parsed and f.parse_error is null)
 and not exists(select 1 from jsonb_array_elements(jsonb_build_array(k.p->'bo',k.p->'stm')) s where s is not null and s<>'null'::jsonb
 and not exists(select 1 from public.source_files f where f.id::text=s->>'fileId' and f.company=p_company and f.parsed and f.parse_error is null)))
 select distinct on(key) key,run_id,exception_id,business_date,p from valid order by key,priority,run_id,exception_id
$$;
revoke all on function public.monthly_audit_population(text,date) from public,anon,authenticated;

create function public.create_monthly_audit_set(p_company text,p_month date,p_count integer) returns public.monthly_audit_sets
language plpgsql security definer set search_path=public as $$
declare s public.monthly_audit_sets%rowtype;available integer;selected integer;
begin
 if not coalesce(public.current_user_active(),false) or coalesce(public.current_app_role(),'') not in ('lead','admin') or not coalesce(public.has_company_access(p_company),false) then raise exception 'เฉพาะหัวหน้า/ผู้ดูแลในบริษัทที่มีสิทธิ์';end if;
 if p_month is null or p_month<>date_trunc('month',p_month)::date or p_month>date_trunc('month',now() at time zone 'Asia/Bangkok')::date or p_count is null or p_count not between 1 and 500 then raise exception 'เลือกเดือนและจำนวน 1–500 ต่อบริษัท';end if;
 if not exists(select 1 from public.audit_companies where code=p_company and active) then raise exception 'บริษัทไม่อยู่ในทะเบียน';end if;
 perform pg_advisory_xact_lock(hashtext('monthly-audit:'||p_company||':'||p_month::text));
 select * into s from public.monthly_audit_sets where company=p_company and month=p_month;
 if found then
  if s.requested_count<>p_count then raise exception 'มีชุดเดือนนี้แล้ว ไม่สุ่มใหม่หรือเปลี่ยนจำนวน ใช้ชุดเดิม';end if;
  return s;
 end if;
 perform 1 from public.daily_recon_jobs where company=p_company and business_date>=p_month and business_date<p_month+interval '1 month' and not is_archived for share;
 insert into public.monthly_audit_sets(month,company,requested_count,created_by) values(p_month,p_company,p_count,auth.uid()) returning * into s;
 with pool as materialized(select * from public.monthly_audit_population(p_company,p_month)),
 picked as(select *,random() as random_order from pool order by random_order limit p_count),
 inserted as(insert into public.monthly_audit_items(set_id,ordinal,source_key,run_id,exception_id,business_date,snapshot)
 select s.id,row_number() over(order by random_order),source_key,run_id,exception_id,business_date,snapshot from picked returning id)
 select (select count(*) from pool),(select count(*) from inserted) into available,selected;
 update public.monthly_audit_sets set available_count=available,selected_count=selected where id=s.id returning * into s;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,company,detail,meta) values(auth.uid()::text,auth.uid(),'monthly_audit_sample','monthly_audit_set',s.id::text,p_company,'สุ่มตรวจรายเดือน ไม่เปลี่ยนยอดหรือเคส',to_jsonb(s));
 return s;
end $$;

create function public.monthly_audit_reviewer_allowed(p_user uuid,p_company text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.app_profiles p where p.user_id=p_user and p.active and p.role in ('monitor','audit_assistant','lead','admin')
 and (p.role in ('lead','admin') or exists(select 1 from public.user_company_access a where a.user_id=p_user and a.company in (p_company,'*'))))
$$;
revoke all on function public.monthly_audit_reviewer_allowed(uuid,text) from public,anon,authenticated;
create function public.assign_monthly_audit_reviewer(p_item uuid,p_revision integer,p_reviewer uuid) returns public.monthly_audit_items
language plpgsql security definer set search_path=public as $$
declare i public.monthly_audit_items%rowtype;c text;
begin
 if not coalesce(public.current_user_active(),false) or coalesce(public.current_app_role(),'') not in ('lead','admin') then raise exception 'เฉพาะหัวหน้า/ผู้ดูแล';end if;
 select * into i from public.monthly_audit_items where id=p_item for update;
 if not found or not public.can_read_monthly_audit(i.set_id) or i.revision is distinct from p_revision then raise exception 'รายการหรือสิทธิ์เปลี่ยน โหลดใหม่';end if;
 select company into c from public.monthly_audit_sets where id=i.set_id;
 if not coalesce(public.monthly_audit_reviewer_allowed(p_reviewer,c),false) then raise exception 'ผู้ตรวจไม่มีสิทธิ์บริษัทนี้';end if;
 insert into public.monthly_audit_history(item_id,actor,action,detail) values(i.id,auth.uid(),'assign',jsonb_build_object('from',i.assigned_to,'to',p_reviewer));
 update public.monthly_audit_items set assigned_to=p_reviewer,revision=revision+1 where id=i.id returning * into i;return i;
end $$;
create function public.save_monthly_audit_assessment(p_item uuid,p_revision integer,p_assessment text,p_note text) returns public.monthly_audit_items
language plpgsql security definer set search_path=public as $$
declare i public.monthly_audit_items%rowtype;
begin
 select * into i from public.monthly_audit_items where id=p_item for update;
 if not found or not public.can_review_monthly_audit(p_item) or i.revision is distinct from p_revision then raise exception 'รายการ ผู้ตรวจ หรือสิทธิ์เปลี่ยน โหลดใหม่';end if;
 if p_assessment is null or p_assessment not in ('passed','concern','needs_evidence') or length(trim(coalesce(p_note,''))) not between 10 and 2000 then raise exception 'เลือกผลประเมินและหมายเหตุอย่างน้อย 10 ตัวอักษร';end if;
 insert into public.monthly_audit_history(item_id,actor,action,detail) values(i.id,auth.uid(),'assessment',jsonb_build_object('before',jsonb_build_object('assessment',i.assessment,'note',i.note,'reviewed_by',i.reviewed_by),'after',jsonb_build_object('assessment',p_assessment,'note',trim(p_note))));
 update public.monthly_audit_items set assessment=p_assessment,note=trim(p_note),reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),revision=revision+1 where id=i.id returning * into i;return i;
end $$;

create function public.monthly_audit_context(p_month date) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not coalesce(public.current_user_active(),false) or coalesce(public.current_app_role(),'') not in ('monitor','audit_assistant','lead','admin') then raise exception 'ไม่มีสิทธิ์สุ่มตรวจ Audit';end if;
 return jsonb_build_object('sets',(select coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('reviewed_count',(select count(*) from public.monthly_audit_items i where i.set_id=s.id and assessment<>'pending')) order by s.company),'[]') from public.monthly_audit_sets s where month=p_month and public.can_read_monthly_audit(id)),
 'companies',(select coalesce(jsonb_agg(code order by code),'[]') from public.audit_companies where active and public.has_company_access(code)));
end $$;
create function public.monthly_audit_set_detail(p_set uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare c text;
begin
 if not public.can_read_monthly_audit(p_set) then raise exception 'ไม่มีสิทธิ์อ่านชุดนี้';end if;
 select company into c from public.monthly_audit_sets where id=p_set;
 return jsonb_build_object('set',(select to_jsonb(s) from public.monthly_audit_sets s where id=p_set),
 'reviewers',(select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'name',full_name) order by full_name),'[]') from public.app_profiles p where public.monthly_audit_reviewer_allowed(user_id,c)),
 'items',(select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('can_review',public.can_review_monthly_audit(i.id),
 'evidence',(select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('uploaded_name',(select full_name from public.app_profiles where user_id=e.uploaded_by)) order by created_at),'[]') from public.monthly_audit_evidence e where item_id=i.id),
 'history',(select coalesce(jsonb_agg(to_jsonb(h)||jsonb_build_object('actor_name',(select full_name from public.app_profiles where user_id=h.actor)) order by created_at),'[]') from public.monthly_audit_history h where item_id=i.id),
 'sources',(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'file_name',f.file_name,'storage_path',f.storage_path,'mime_type',f.mime_type,'size_bytes',f.size_bytes,'kind',f.kind)),'[]') from public.source_files f where f.company=c and f.id::text in (i.snapshot->'bo'->>'fileId',i.snapshot->'stm'->>'fileId'))
 ) order by ordinal),'[]') from public.monthly_audit_items i where set_id=p_set));
end $$;

create function public.register_monthly_audit_evidence(p_item uuid,p_id uuid,p_name text,p_mime text,p_size bigint,p_path text) returns public.monthly_audit_evidence
language plpgsql security definer set search_path=public as $$
declare e public.monthly_audit_evidence%rowtype;
begin
 perform 1 from public.monthly_audit_items where id=p_item for update;
 if not coalesce(public.can_review_monthly_audit(p_item),false) then raise exception 'ผู้ตรวจหรือสิทธิ์เปลี่ยนแล้ว';end if;
 select * into e from public.monthly_audit_evidence where id=p_id;
 if found then
  if e.item_id<>p_item or e.storage_path<>p_path or e.uploaded_by<>auth.uid() or e.file_name<>p_name or e.mime_type<>p_mime or e.size_bytes<>p_size then raise exception 'Evidence receipt conflict';end if;return e;
 end if;
 if p_size is null or p_size not between 1 and 20971520 or p_mime is null or p_mime not in ('image/png','image/jpeg','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv','application/csv','application/vnd.ms-excel','text/plain','application/octet-stream') or length(coalesce(p_name,'')) not between 1 and 200 or p_name ~ '[[:cntrl:]/]' or strpos(p_name,chr(92))>0 or p_name !~* '\.(png|jpe?g|webp|pdf|docx|xlsx|csv|txt)$'
 or p_path is distinct from 'monthly-audit/'||auth.uid()::text||'/'||p_item::text||'/'||p_id::text||'/'||p_name then raise exception 'ชื่อ ชนิด ขนาด หรือที่เก็บหลักฐานไม่ถูกต้อง';end if;
 if not exists(select 1 from storage.objects o where bucket_id='audit-files' and name=p_path and owner_id=auth.uid()::text and (metadata->>'size')::bigint=p_size and coalesce(metadata->>'mimetype',p_mime)=p_mime) then raise exception 'ยังไม่พบไฟล์อัปโหลดของผู้ตรวจ';end if;
 insert into public.monthly_audit_evidence(id,item_id,storage_path,file_name,mime_type,size_bytes,uploaded_by) values(p_id,p_item,p_path,p_name,p_mime,p_size,auth.uid()) returning * into e;
 insert into public.monthly_audit_history(item_id,actor,action,detail) values(p_item,auth.uid(),'evidence_added',to_jsonb(e));return e;
end $$;
create function public.can_upload_monthly_audit_path(p_path text) returns boolean language plpgsql stable security definer set search_path=public as $$
begin
 if p_path !~ '^monthly-audit/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$' then return false;end if;
 return split_part(p_path,'/',2)=auth.uid()::text and public.can_review_monthly_audit(split_part(p_path,'/',3)::uuid);
exception when invalid_text_representation then return false;
end $$;
create function public.can_read_monthly_audit_path(p_path text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.monthly_audit_evidence e join public.monthly_audit_items i on i.id=e.item_id where e.storage_path=p_path and public.can_read_monthly_audit(i.set_id))
$$;
create policy monthly_proof_upload on storage.objects for insert to authenticated with check(bucket_id='audit-files' and public.can_upload_monthly_audit_path(name) and (metadata->>'size')::bigint between 1 and 20971520);
create policy monthly_proof_read on storage.objects for select to authenticated using(bucket_id='audit-files' and public.can_read_monthly_audit_path(name));
revoke all on function public.monthly_source_key(jsonb),public.can_upload_monthly_audit_path(text),public.can_read_monthly_audit_path(text) from public,anon;
grant execute on function public.can_upload_monthly_audit_path(text),public.can_read_monthly_audit_path(text) to authenticated;
revoke all on function public.create_monthly_audit_set(text,date,integer),public.assign_monthly_audit_reviewer(uuid,integer,uuid),public.save_monthly_audit_assessment(uuid,integer,text,text),public.monthly_audit_context(date),public.monthly_audit_set_detail(uuid),public.register_monthly_audit_evidence(uuid,uuid,text,text,bigint,text) from public,anon;
grant execute on function public.create_monthly_audit_set(text,date,integer),public.assign_monthly_audit_reviewer(uuid,integer,uuid),public.save_monthly_audit_assessment(uuid,integer,text,text),public.monthly_audit_context(date),public.monthly_audit_set_detail(uuid),public.register_monthly_audit_evidence(uuid,uuid,text,text,bigint,text) to authenticated;
commit;
