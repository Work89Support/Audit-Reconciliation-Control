-- Read-only validation fix. No source/report/case/hold rows are rewritten.
begin;
set local lock_timeout='5s';
create or replace function public.manual_primary_annotation_money(p text) returns numeric
language sql immutable set search_path=public,pg_temp as $$
 select case when length(p)<=30 and p ~ '^[0-9]+([.][0-9]{1,2})?$' then p::numeric end
$$;

-- Only one explicit manual-review annotation of one existing, flagged pair.
-- Both physical pointers AND account, company, direction, currency and amounts
-- must agree. A different partner, reused pair, duplicate warning or unknown
-- exception type remains a real duplicate and is still rejected.
create or replace function public.manual_primary_review_annotations(p_report jsonb)
returns table(exception_index integer,pair_index integer)
language sql immutable set search_path=public,pg_temp as $$
 with pairs as (
  select (ordinality-1)::integer idx,value p from jsonb_array_elements(coalesce(p_report->'match_evidence','[]')) with ordinality
 ), warnings as (
  select (ordinality-1)::integer idx,value e from jsonb_array_elements(coalesce(p_report->'exceptions','[]')) with ordinality
 ), candidates as (
  select e.idx exception_index,p.idx pair_index,
  count(*) over(partition by e.idx) warning_matches,
  count(*) over(partition by p.idx) pair_warnings
  from warnings e join pairs p on
   e.e#>>'{customer_details,source_rows,bo,fileId}'=p.p#>>'{bo,fileId}'
   and e.e#>>'{customer_details,source_rows,bo,row}'=p.p#>>'{bo,row}'
   and e.e#>>'{customer_details,source_rows,stm,fileId}'=p.p#>>'{stm,fileId}'
   and e.e#>>'{customer_details,source_rows,stm,row}'=p.p#>>'{stm,row}'
  where e.e->>'ex_type'='manual_review' and p.p->'manualReview'='true'::jsonb
   and e.e->>'company'=p.p->>'company' and e.e->>'account'=p.p->>'account'
   and case e.e->>'direction' when 'ฝาก' then 'deposit' when 'ถอน' then 'withdraw' else e.e->>'direction' end
       =case p.p->>'direction' when 'ฝาก' then 'deposit' when 'ถอน' then 'withdraw' else p.p->>'direction' end
   and coalesce(e.e->>'currency','THB')=coalesce(p.p->>'currency','THB')
   and public.manual_primary_annotation_money(e.e->>'system_amount')=public.manual_primary_annotation_money(coalesce(p.p->>'boAmount',p.p->>'amount'))
   and public.manual_primary_annotation_money(e.e->>'bank_amount')=public.manual_primary_annotation_money(p.p->>'stmAmount')
 ) select exception_index,pair_index from candidates where warning_matches=1 and pair_warnings=1
$$;

create or replace function public.manual_primary_counted_pointers(p_report jsonb)
returns table(side text,s jsonb)
language sql immutable set search_path=public,pg_temp as $$
 with annotations as materialized(select exception_index from public.manual_primary_review_annotations(p_report)),
 remaining as (
  select value e from jsonb_array_elements(coalesce(p_report->'exceptions','[]')) with ordinality x(value,n)
  where not exists(select 1 from annotations a where a.exception_index=n-1)
 )
 select 'bo',p->'bo' from jsonb_array_elements(coalesce(p_report->'match_evidence','[]')) p
 union all select 'stm',p->'stm' from jsonb_array_elements(coalesce(p_report->'match_evidence','[]')) p
 union all select 'bo',e#>'{customer_details,source_rows,bo}' from remaining
 union all select 'stm',e#>'{customer_details,source_rows,stm}' from remaining
 union all select 'bo',w->'boSource' from jsonb_array_elements(coalesce(p_report#>'{summary,waiting_bo}','[]')) w
 union all select 'stm',w->'stmSource' from jsonb_array_elements(coalesce(p_report#>'{summary,waiting_bo}','[]')) w
$$;
revoke all on function public.manual_primary_annotation_money(text),public.manual_primary_review_annotations(jsonb),public.manual_primary_counted_pointers(jsonb) from public,anon,authenticated;

-- Keep every existing authorization, stale-source, provenance and coverage gate.
-- Replace only the duplicate-use counting CTE, with a guarded exact signature.
do $$declare definition text;old_cte text;
begin
 definition:=pg_get_functiondef('public.manual_primary_preview(uuid)'::regprocedure);
 old_cte:=$cte$with pointers as (
 select 'bo' side,p->'bo' s from jsonb_array_elements(coalesce(q.result->'match_evidence','[]')) p
 union all select 'stm',p->'stm' from jsonb_array_elements(coalesce(q.result->'match_evidence','[]')) p
 union all select 'bo',e->'customer_details'->'source_rows'->'bo' from jsonb_array_elements(coalesce(q.result->'exceptions','[]')) e
 union all select 'stm',e->'customer_details'->'source_rows'->'stm' from jsonb_array_elements(coalesce(q.result->'exceptions','[]')) e
 union all select 'bo',w->'boSource' from jsonb_array_elements(coalesce(q.result->'summary'->'waiting_bo','[]')) w
 union all select 'stm',w->'stmSource' from jsonb_array_elements(coalesce(q.result->'summary'->'waiting_bo','[]')) w)$cte$;
 if position('manual_primary_counted_pointers' in definition)=0 then
  if position(old_cte in definition)=0 then raise exception 'Preview definition changed; do not bypass validation';end if;
  definition:=replace(definition,old_cte,'with pointers as (select * from public.manual_primary_counted_pointers(q.result))');
  if position($needle$'file_count',jsonb_array_length(stamp)$needle$ in definition)=0 then raise exception 'Preview return signature changed';end if;
  definition:=replace(definition,$needle$'file_count',jsonb_array_length(stamp)$needle$,
   $replacement$'review_annotation_count',(select count(*) from public.manual_primary_review_annotations(q.result)),
 'file_count',jsonb_array_length(stamp)$replacement$);
  execute definition;
 end if;
end$$;
notify pgrst,'reload schema';
commit;
