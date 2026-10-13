-- Use indexed source identity and evaluate immutable keys once per source row.
begin;
create or replace function public.monthly_source_key(p jsonb) returns text language sql immutable as $$
 select case when coalesce(nullif(p->'bo','null'::jsonb),p->'stm')->>'fileId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and coalesce(nullif(p->'bo','null'::jsonb),p->'stm')->>'row' ~ '^[0-9]+$'
 and p->>'direction' in ('deposit','withdraw','ฝาก','ถอน') then
 (case when p->'bo' is not null and p->'bo'<>'null'::jsonb then 'BO:' else 'STM:' end)||
 (coalesce(nullif(p->'bo','null'::jsonb),p->'stm')->>'fileId')||':'||(coalesce(nullif(p->'bo','null'::jsonb),p->'stm')->>'row')||':'||
 (case p->>'direction' when 'ฝาก' then 'deposit' when 'ถอน' then 'withdraw' else p->>'direction' end) end
$$;
create or replace function public.monthly_audit_population(p_company text,p_month date)
returns table(source_key text,run_id uuid,exception_id uuid,business_date date,snapshot jsonb)
language sql stable security definer set search_path=public as $$
 with runs as materialized(select r.* from public.daily_recon_jobs j join public.recon_runs r on r.id=j.last_run_id
 where j.company=p_company and j.business_date>=p_month and j.business_date<(p_month+interval '1 month') and not j.is_archived
 and j.status in ('completed','needs_review') and r.company=j.company and r.business_date=j.business_date),
 raw as materialized (
 select r.id as run_id,null::uuid as exception_id,r.business_date,m||jsonb_build_object('kind','matched','bo',m->'bo','stm',m->'stm') as p,2 as priority
 from runs r,jsonb_array_elements(coalesce(r.summary->'match_evidence','[]')) m
 union all
 select r.id,e.id,r.business_date,jsonb_build_object('kind','exception','account',e.account,'direction',e.direction,'bo',e.customer_details->'source_rows'->'bo','stm',e.customer_details->'source_rows'->'stm','amount',coalesce(e.system_amount,e.bank_amount),'result',to_jsonb(e)),1
 from runs r join public.exceptions e on e.run_id=r.id and e.company=p_company and e.business_date=r.business_date
 where e.superseded_by_exception_id is null
 union all
 select r.id,null::uuid,r.business_date,w||jsonb_build_object('kind','waiting_source','bo',w->'boSource','stm',w->'stmSource'),3
 from runs r,jsonb_array_elements(coalesce(r.summary->'waiting_bo','[]')) w
 ),keyed as materialized (select raw.*,public.monthly_source_key(p) as key from raw),
 valid as(select * from keyed k where key is not null
 and exists(select 1 from public.source_files f where f.id=case when coalesce(nullif(k.p->'bo','null'::jsonb),k.p->'stm')->>'fileId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (coalesce(nullif(k.p->'bo','null'::jsonb),k.p->'stm')->>'fileId')::uuid end and f.company=p_company and f.parsed and f.parse_error is null)
 and not exists(select 1 from jsonb_array_elements(jsonb_build_array(k.p->'bo',k.p->'stm')) s where s is not null and s<>'null'::jsonb
 and not exists(select 1 from public.source_files f where f.id=case when s->>'fileId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (s->>'fileId')::uuid end and f.company=p_company and f.parsed and f.parse_error is null)))
 select distinct on(key) key,run_id,exception_id,business_date,p from valid order by key,priority,run_id,exception_id
$$;

commit;
