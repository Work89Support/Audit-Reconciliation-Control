-- Reuse exact physical source rows across accepted manual versions.
-- Definition/schema change only: never update existing cases, approvals or holds.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

-- Canonical lineage ignores display metadata, never file identity or row number.
create or replace function public.manual_case_source_identity(p jsonb)
returns jsonb language sql immutable set search_path=public,pg_temp as $$
 select case when p is null or jsonb_typeof(p)<>'object'
 or not (coalesce(p#>>'{bo,row}','')~'^[1-9][0-9]*$' or coalesce(p#>>'{stm,row}','')~'^[1-9][0-9]*$')
 or exists(select 1 from (values('bo'),('stm')) s(side)
  where p->side is not null and p->side<>'null'::jsonb and
  (coalesce(p#>>array[side,'fileId'],'')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   or coalesce(p#>>array[side,'row'],'')!~'^[1-9][0-9]*$')) then null
 else jsonb_build_object('bo',case when p->'bo' is not null and p->'bo'<>'null'::jsonb
  then jsonb_build_object('fileId',lower(p#>>'{bo,fileId}'),'row',(p#>>'{bo,row}')::numeric) else null end,
 'stm',case when p->'stm' is not null and p->'stm'<>'null'::jsonb
  then jsonb_build_object('fileId',lower(p#>>'{stm,fileId}'),'row',(p#>>'{stm,row}')::numeric) else null end) end
$$;
revoke all on function public.manual_case_source_identity(jsonb) from public,anon,authenticated;

-- One existing case may belong to several immutable report versions, but only
-- once in each version. Keep the old membership rows for full history.
alter table public.manual_primary_case_items drop constraint if exists manual_primary_case_items_exception_id_key;
create unique index if not exists manual_primary_case_items_version_case on public.manual_primary_case_items(primary_id,exception_id);
create index if not exists manual_primary_case_items_case_lookup on public.manual_primary_case_items(exception_id);

do $patch$
declare d text; a text; b text; lookup text; preferred text;
begin
 d:=pg_get_functiondef('public.activate_manual_primary_cases(uuid,text,text,boolean)'::regprocedure);
 if position('manual-primary-exact-case-reuse-v2' in d)>0 then return;end if;
 lookup:=$lookup$select array_agg(e.id order by e.id) into candidates from public.exceptions e
 where e.company=v.company and e.business_date=v.business_date
 and public.manual_case_source_identity(e.customer_details->'source_rows')=lineage;$lookup$;
 preferred:=$preferred$select array_agg(e.id order by e.id) into candidates from public.exceptions e
 where e.company=v.company and e.business_date=v.business_date
 and public.manual_case_source_identity(e.customer_details->'source_rows')=lineage
 and exists(select 1 from public.manual_primary_case_items prior
 where prior.primary_id=v.previous_id and prior.exception_id=e.id);
 if coalesce(cardinality(candidates),0)=0 then
 $preferred$||lookup||' end if;';
 if position('manual-primary-exact-case-reuse-v1' in d)>0 then
  if (length(d)-length(replace(d,lookup,'')))<>length(lookup) then raise exception 'Reuse v1 lookup drift';end if;
  execute replace(replace(d,lookup,preferred),'manual-primary-exact-case-reuse-v1','manual-primary-exact-case-reuse-v2');
  return;
 end if;
 a:='declare v public.manual_primary_results; p jsonb; r jsonb; item record; n integer:=0; eid uuid; k text; b public.manual_primary_case_sets;';
 b:=a||' candidates uuid[]; lineage jsonb; reused integer:=0;';
 if (length(d)-length(replace(d,a,'')))<>length(a) then raise exception 'Case activation declaration drift';end if;
 d:=replace(d,a,b);
 a:='eid:=gen_random_uuid();n:=n+1;';
 b:=$reuse$
 -- manual-primary-exact-case-reuse-v2: never copy approvals or mutate old cases.
 lineage:=public.manual_case_source_identity(r->'customer_details'->'source_rows');
 if lineage is null then raise exception 'แถวต้นทางไม่สมบูรณ์ ห้ามสร้างหรืออ้างเคส';end if;
 select array_agg(e.id order by e.id) into candidates from public.exceptions e
 where e.company=v.company and e.business_date=v.business_date
 and public.manual_case_source_identity(e.customer_details->'source_rows')=lineage;
 if coalesce(cardinality(candidates),0)>1 then raise exception 'มีหลายเคสอ้างแถวเดียวกัน ต้องตรวจประวัติก่อนยืนยัน';end if;
 if coalesce(cardinality(candidates),0)=1 then
  eid:=candidates[1];
  perform 1 from public.exceptions e where e.id=eid and e.company=v.company and e.business_date=v.business_date
  and e.account=r->>'account'
  and e.direction=case when r->>'direction' in ('deposit','ฝาก') then 'ฝาก' else 'ถอน' end
  and e.system_amount is not distinct from (r->>'system_amount')::numeric
  and e.bank_amount is not distinct from (r->>'bank_amount')::numeric
  and e.superseded_by_exception_id is null for update;
  if not found then raise exception 'แถวเดิมมีขอบเขตหรือยอดเปลี่ยน ห้ามสร้างเคสซ้ำ';end if;
  n:=n+1;reused:=reused+1;
  insert into public.manual_primary_case_items values(v.id,item.kind,item.idx,k,eid);
  continue;
 end if;
 eid:=gen_random_uuid();n:=n+1;
 $reuse$;
 b:=replace(b,lookup,preferred);
 if (length(d)-length(replace(d,a,'')))<>length(a)
 or position('public.manual_primary_cases_preview(p_id)' in d)=0
 or position('ข้อมูลเปลี่ยน ต้องทบทวนใหม่' in d)=0
 or position('for update' in d)=0
 or position('update public.exceptions' in lower(d))>0
 then raise exception 'Unexpected activation guards; stop without replacing';end if;
 d:=replace(d,a,b);
 d:=replace(d,'''cases_created'',n,','''cases_created'',n-reused,''cases_reused'',reused,');
 d:=replace(d,'''created'',n,''case_count'',n,','''created'',n-reused,''reused'',reused,''case_count'',n,');
 execute d;
end $patch$;

-- Retain exact current membership + accepted report + storage/source checks.
-- The originating manual_primary_id stays immutable on a reused case.
do $guard$
declare d text; a text; b text;
begin
 d:=pg_get_functiondef('public.cross_day_current_manual_case(public.exceptions)'::regprocedure);
 a:='and v.id::text=e.customer_details->>''manual_primary_id''';
 b:=$new$and v.id=(select latest.id from public.manual_primary_results latest
 where latest.company=e.company and latest.business_date=e.business_date
 order by latest.accepted_at desc,latest.id desc limit 1) -- manual-primary-reused-membership-v1$new$;
 if position('manual-primary-reused-membership-v1' in d)>0 then return;end if;
 if (length(d)-length(replace(d,a,'')))<>length(a)
 or position('i.exception_id=e.id' in d)=0
 or position('public.primary_case_is_current(e.id)' in d)=0
 or position('v.source_stamp=public.manual_primary_sources' in d)=0
 or position('storage.objects' in d)=0
 or position('q.status=''confirmed''' in d)=0
 then raise exception 'Unexpected current-case source guard';end if;
 execute replace(d,a,b);
end $guard$;
notify pgrst,'reload schema';
commit;
