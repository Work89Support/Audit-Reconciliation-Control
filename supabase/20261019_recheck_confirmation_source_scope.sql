-- A neighbouring batch can leave the raw date window without changing any
-- effective source. Do not re-run matching for unused raw-window attachments.
-- Still compare the ENTIRE effective manifest, selected physical file rows,
-- job, cases and evidence exactly. No snapshot/status/history data is rewritten.
begin;
set local lock_timeout='5s';
create or replace function public.account_recheck_snapshots_equal(a jsonb,b jsonb,chosen uuid[])
returns boolean language sql immutable set search_path=public,pg_temp as $$
 select coalesce(a=b or (
 cardinality(chosen)>0 and cardinality(chosen)=(select count(distinct x) from unnest(chosen)x)
 and a-'files'=b-'files'
 and jsonb_typeof(a->'effective_files')='array' and jsonb_typeof(a->'files')='array' and jsonb_typeof(b->'files')='array'
 and cardinality(chosen)=(select count(*) from jsonb_array_elements(a->'effective_files') f where f->>'id'=any(chosen::text[]))
 and (select coalesce(jsonb_agg(f order by f->>'id'),'[]') from jsonb_array_elements(a->'files')f
 where f->>'id'=any(chosen::text[]) or exists(select 1 from jsonb_array_elements(a->'effective_files')p
 where p->>'id'=any(chosen::text[]) and p->>'physical_source_file_id'=f->>'id'))
 = (select coalesce(jsonb_agg(f order by f->>'id'),'[]') from jsonb_array_elements(b->'files')f
 where f->>'id'=any(chosen::text[]) or exists(select 1 from jsonb_array_elements(b->'effective_files')p
 where p->>'id'=any(chosen::text[]) and p->>'physical_source_file_id'=f->>'id'))
 ),false)
$$;
revoke all on function public.account_recheck_snapshots_equal(jsonb,jsonb,uuid[]) from public,anon,authenticated;
do $patch$
declare d text;a text;b text;
begin
 d:=pg_get_functiondef('public.confirm_account_recheck(uuid,integer,text,boolean)'::regprocedure);
 a:=$old$(public.account_recheck_snapshot(q.company,q.business_date)||jsonb_build_object('effective_files',public.effective_audit_source_files(q.company,q.business_date))) is distinct from q.snapshot$old$;
 b:=$new$not public.account_recheck_snapshots_equal(
 (public.account_recheck_snapshot(q.company,q.business_date)||jsonb_build_object('effective_files',public.effective_audit_source_files(q.company,q.business_date))),q.snapshot,q.selected_file_ids)$new$;
 if position(b in d)>0 then return;end if;
 if (length(d)-length(replace(d,a,'')))<>length(a)
 or position('q.result->>''quality''' in d)=0
 or position('q.revision<>p_expected_revision' in d)=0
 or position('public.current_app_role()' in d)=0
 or position('public.has_company_access(q.company)' in d)=0
 or position('j.last_run_id is distinct from q.base_run_id' in d)=0
 then raise exception 'Unexpected report-confirmation definition';end if;
 execute replace(d,a,b);
end $patch$;
notify pgrst,'reload schema';
commit;
