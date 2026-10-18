-- Definitions only. Preserve raw reports and all business/financial records.
-- A BO timing notice may refer to an existing waiting-STM item rather than an
-- exception. Attach the notice to that exact source, never create it twice.
begin;
set local lock_timeout='5s';

create or replace function public.manual_primary_waiting_timing_links(p_report jsonb)
returns table(warning_index integer,waiting_index integer) language sql immutable
set search_path=public,pg_temp as $$
 with warnings as (
 select (n-1)::integer idx,r from jsonb_array_elements(coalesce(p_report->'exceptions','[]')) with ordinality x(r,n)
 ), waiting as (
 select (n-1)::integer idx,r from jsonb_array_elements(coalesce(p_report#>'{summary,waiting_bo}','[]')) with ordinality x(r,n)
 ), candidates as (
 select a.idx warning_index,b.idx waiting_index,
 count(*) over(partition by a.idx) candidates,
 count(*) over(partition by b.r#>>'{boSource,fileId}',b.r#>>'{boSource,row}') warnings
 from warnings a join waiting b on a.r->>'bo_raw'=b.r->>'boRaw'
 and a.r->>'company'=b.r->>'company' and a.r->>'company'=p_report->>'company'
 and a.r->>'business_date'=b.r->>'date'
 and a.r->>'business_date'=coalesce(p_report->>'business_date',p_report->>'date')
 and a.r->>'account'=b.r->>'account'
 and case a.r->>'direction' when 'ฝาก' then 'deposit' when 'ถอน' then 'withdraw' else a.r->>'direction' end
 =case b.r->>'direction' when 'ฝาก' then 'deposit' when 'ถอน' then 'withdraw' else b.r->>'direction' end
 and a.r->'system_amount'=b.r->'systemAmount'
 where a.r->>'ex_type'='cross_day' and b.r->>'type'='missing_stm' and b.r->>'status'='waiting_source'
 and a.r->>'stm_raw'='— ตรวจจากรายงานหลังบ้าน ไม่ต้องใช้ statement —'
 and a.r->'system_amount'=a.r->'bank_amount' and a.r->'risk_amount'='0'::jsonb and a.r->'amount_diff'='0'::jsonb
 and jsonb_typeof(a.r->'system_amount')='number'
 and coalesce(a.r#>'{customer_details,source_rows,stm}','null')='null'::jsonb
 and (coalesce(a.r#>'{customer_details,source_rows,bo}','null')='null'::jsonb
 or a.r#>'{customer_details,source_rows,bo}'=b.r->'boSource')
 and coalesce(b.r->'stmSource','null')='null'::jsonb and coalesce(b.r->'bankAmount','null')='null'::jsonb
 and b.r#>>'{boSource,fileId}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and b.r#>>'{boSource,row}' ~ '^[1-9][0-9]*$'
 and a.r->>'bo_raw' ~ '^[0-9]+ [|] '
 and trim(split_part(a.r->>'bo_raw','|',4)) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and trim(split_part(a.r->>'bo_raw','|',4))=b.r#>>'{customerDetails,bo,reference}'
 and a.r->>'bo_date'=left(trim(split_part(a.r->>'bo_raw','|',2)),10)
 and a.r->>'bo_time'=substring(trim(split_part(a.r->>'bo_raw','|',2)) from 12 for 8)
 and b.r->>'date'=left(trim(split_part(a.r->>'bo_raw','|',3)),10)
 and b.r->>'boTime'=substring(trim(split_part(a.r->>'bo_raw','|',3)) from 12 for 8)
 ) select warning_index,waiting_index from candidates where candidates=1 and warnings=1
$$;

-- Keep the existing bounded exception-to-exception projection unchanged.
do $$declare d text;begin
 if to_regprocedure('public.manual_primary_report_exception_projection(jsonb)') is null then
  d:=pg_get_functiondef('public.manual_primary_report_projection(jsonb)'::regprocedure);
  if position('manual_primary_report_projection_rows(small)' in d)=0 then raise exception 'Unreviewed primary projection; stop';end if;
  execute replace(d,'FUNCTION public.manual_primary_report_projection(',
   'FUNCTION public.manual_primary_report_exception_projection(');
 end if;
end$$;
create or replace function public.manual_primary_report_projection(p_report jsonb)
returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare projected jsonb;small jsonb;out_exceptions jsonb;out_waiting jsonb;linked integer;
begin
 projected:=public.manual_primary_report_exception_projection(p_report);
 if projected is null then return null;end if;
 small:=jsonb_build_object('company',projected->'company','business_date',projected->'business_date','date',projected->'date',
 'exceptions',projected->'exceptions','summary',jsonb_build_object('waiting_bo',projected#>'{summary,waiting_bo}'));
 with links as materialized(select * from public.manual_primary_waiting_timing_links(small)),
 exceptions as(select (n-1)::integer idx,r from jsonb_array_elements(coalesce(small->'exceptions','[]')) with ordinality x(r,n)),
 waiting as(select (n-1)::integer idx,r from jsonb_array_elements(coalesce(small#>'{summary,waiting_bo}','[]')) with ordinality x(r,n))
 select (select count(*) from links),
 (select coalesce(jsonb_agg(r order by idx),'[]') from exceptions e where not exists(select 1 from links l where l.warning_index=e.idx)),
 (select coalesce(jsonb_agg(case when exists(select 1 from links l where l.waiting_index=w.idx) then
 jsonb_set(w.r,'{customerDetails}',coalesce(w.r->'customerDetails','{}')||jsonb_build_object('bo_timing_annotations',
 coalesce(w.r#>'{customerDetails,bo_timing_annotations}','[]')||
 (select jsonb_agg(jsonb_build_object('projection_warning_index',e.idx,'original_warning',e.r,
 'source_rows',jsonb_build_object('bo',w.r->'boSource','stm',null),'annotation_target','waiting_bo') order by e.idx)
 from links l join exceptions e on e.idx=l.warning_index where l.waiting_index=w.idx))) else w.r end order by w.idx),'[]') from waiting w)
 into linked,out_exceptions,out_waiting;
 if linked=0 then return projected;end if;
 return projected||jsonb_build_object('exceptions',out_exceptions,'summary',coalesce(projected->'summary','{}')||jsonb_build_object(
 'waiting_bo',out_waiting,'bo_timing_annotation_count',coalesce((projected#>>'{summary,bo_timing_annotation_count}')::integer,0)+linked,
 'waiting_bo_timing_annotation_count',coalesce((projected#>>'{summary,waiting_bo_timing_annotation_count}')::integer,0)+linked,
 'original_exception_count',coalesce((projected#>>'{summary,original_exception_count}')::integer,jsonb_array_length(coalesce(p_report->'exceptions','[]'))),
 'waiting_bo_timing_projection_version',1));
end$$;
revoke all on function public.manual_primary_waiting_timing_links(jsonb),
 public.manual_primary_report_exception_projection(jsonb),public.manual_primary_report_projection(jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
