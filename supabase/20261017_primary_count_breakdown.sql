-- Definitions only. No report, source, case, hold or financial row is changed.
begin;
set local lock_timeout='5s';
set local statement_timeout='10s';
do $$declare d text;anchor text:=$a$'report_scope_correction_count',coalesce($a$;
begin
 d:=pg_get_functiondef('public.manual_primary_preview(uuid)'::regprocedure);
 if position($a$'raw_exception_count'$a$ in d)=0 then
  if position(anchor in d)=0 then raise exception 'Primary preview definition drift';end if;
  d:=replace(d,anchor,$p$'raw_exception_count',coalesce((q.result#>>'{summary,original_exception_count}')::integer,jsonb_array_length(coalesce(q.result->'exceptions','[]'))),
 'actionable_exception_count',jsonb_array_length(coalesce(q.result->'exceptions','[]')),
 'waiting_bo_count',jsonb_array_length(coalesce(q.result#>'{summary,waiting_bo}','[]')),
 'report_scope_correction_count',coalesce($p$);
  execute d;
 end if;
end$$;
notify pgrst,'reload schema';
commit;
