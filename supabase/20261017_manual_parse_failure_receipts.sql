-- Keep diagnostic receipts even when a failed Quality Gate discards the report.
-- No source amount, case, accepted result, hold, or prior request is backfilled.
begin;
set local lock_timeout='5s';
create or replace function public.finish_account_recheck_compact(
 p_id uuid,p_revision integer,p_result jsonb,p_error text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare q public.account_recheck_jobs%rowtype; receipts jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Worker only';end if;
 -- Original scope, lease, revision and quality gates run first, unchanged.
 q:=public.finish_account_recheck(p_id,p_revision,p_result,p_error);
 if p_error is not null then
  select coalesce(jsonb_agg(jsonb_build_object(
   'id',f->'id','file_name',left(f->>'file_name',180),'parsed',f->'parsed',
   'row_count',f->'row_count','attempted_row_count',f->'attempted_row_count',
   'parse_error',left(f->>'parse_error',1000),'parser_version',f->'parser_version'
  ) order by f->>'id'),'[]') into receipts
  from jsonb_array_elements(case when jsonb_typeof(p_result->'source_files')='array'
   then p_result->'source_files' else '[]'::jsonb end) f
  where f->>'id'=any(q.selected_file_ids::text[]);
  insert into public.audit_log(actor,action,entity,target,company,detail,meta)
  values('account-recheck-worker','account_recheck_parse_failed','account_recheck_jobs',
   q.id::text,q.company,'อ่านไฟล์ไม่ผ่าน Quality Gate — เก็บสาเหตุรายไฟล์ไว้ ไม่ใช้ผลและไม่เปลี่ยนเคส',
   jsonb_build_object('business_date',q.business_date,'execution_id',q.worker_execution_id,
    'stage','quality_gate','message',left(p_error,4000),'request_revision',p_revision,
    'source_receipts',receipts,'cases_changed',0,'source_amounts_changed',0));
 end if;
 return public.account_recheck_worker_envelope(q);
end$$;
revoke all on function public.finish_account_recheck_compact(uuid,integer,jsonb,text)
 from public,anon,authenticated;
grant execute on function public.finish_account_recheck_compact(uuid,integer,jsonb,text) to service_role;
do $$declare d text;
begin
 d:=pg_get_functiondef('public.worker_failure_context(text,date)'::regprocedure);
 if position('account_recheck_parse_failed' in d)=0 then
  if position($needle$action='worker_failure_verified'$needle$ in d)=0 then
   raise exception 'Unreviewed failure context definition';
  end if;
  execute replace(d,$needle$action='worker_failure_verified'$needle$,
   $patch$action in ('worker_failure_verified','account_recheck_parse_failed')$patch$);
 end if;
end$$;
notify pgrst,'reload schema';
commit;
