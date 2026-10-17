-- Definitions only: avoid repeatedly copying full match evidence and summary
-- while projecting a few exception annotations. All validation stays unchanged.
begin;
set local lock_timeout='5s';
do $$declare d text;
begin
 d:=pg_get_functiondef('public.manual_primary_report_projection(jsonb)'::regprocedure);
 if position('manual_primary_report_projection_rows' in d)=0 then
  if position('bo_timing_projection_version' in d)=0 then
   raise exception 'Unreviewed projection definition';
  end if;
  execute replace(d,'FUNCTION public.manual_primary_report_projection(',
   'FUNCTION public.manual_primary_report_projection_rows(');
 end if;
end$$;
create or replace function public.manual_primary_report_projection(p_report jsonb)
returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare small jsonb; projected jsonb;
begin
 if p_report is null then return null;end if;
 small:=jsonb_build_object('company',p_report->'company',
  'business_date',p_report->'business_date','date',p_report->'date',
  'exceptions',p_report->'exceptions','summary',jsonb_strip_nulls(jsonb_build_object(
   'bo_timing_annotation_count',p_report#>'{summary,bo_timing_annotation_count}',
   'report_scope_correction_count',p_report#>'{summary,report_scope_correction_count}')));
 projected:=public.manual_primary_report_projection_rows(small);
 if projected=small then return p_report;end if;
 return p_report||jsonb_build_object('exceptions',projected->'exceptions',
  'summary',coalesce(p_report->'summary','{}')||(projected->'summary'));
end$$;
revoke all on function public.manual_primary_report_projection_rows(jsonb),
 public.manual_primary_report_projection(jsonb) from public,anon,authenticated;
-- A primary handoff deliberately revalidates sources and creates the complete
-- case set atomically. Give only this RPC a bounded 30s budget; never change
-- the global/role timeout, retry writes, or weaken any provenance/permission gate.
alter function public.accept_manual_primary_with_cases(uuid,text,text,boolean)
 set statement_timeout='30s';
alter function public.accept_manual_primary_with_cases(uuid,text,text,boolean)
 set lock_timeout='5s';
notify pgrst,'reload schema';
commit;
