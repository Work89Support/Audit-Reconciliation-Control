-- When an automatic rerun left two immutable cases pointing at the exact same
-- physical source rows, prefer the case from the current base run.  The older
-- case remains untouched as history; this patch only selects which existing
-- case is linked into the newly accepted manual-primary case set.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $patch$
declare d text; old_block text; new_block text;
begin
 d:=pg_get_functiondef('public.activate_manual_primary_cases(uuid,text,text,boolean)'::regprocedure);
 if position('manual-primary-current-base-run-preference-v1' in d)>0 then return;end if;
 old_block:=$old$if coalesce(cardinality(candidates),0)=0 then
 select array_agg(e.id order by e.id) into candidates from public.exceptions e
 where e.company=v.company and e.business_date=v.business_date
 and public.manual_case_source_identity(e.customer_details->'source_rows')=lineage; end if;$old$;
 new_block:=$new$if coalesce(cardinality(candidates),0)=0 then
 /* manual-primary-current-base-run-preference-v1: prefer the immutable case from this primary's base run */
 select array_agg(e.id order by e.id) into candidates from public.exceptions e
 where e.company=v.company and e.business_date=v.business_date
 and e.run_id is not distinct from v.base_run_id
 and public.manual_case_source_identity(e.customer_details->'source_rows')=lineage;
 if coalesce(cardinality(candidates),0)=0 then
  select array_agg(e.id order by e.id) into candidates from public.exceptions e
  where e.company=v.company and e.business_date=v.business_date
  and public.manual_case_source_identity(e.customer_details->'source_rows')=lineage;
 end if; end if;$new$;
 if (length(d)-length(replace(d,old_block,'')))<>length(old_block)
 or position('manual-primary-exact-case-reuse-v2' in d)=0
 or position('if coalesce(cardinality(candidates),0)>1 then' in d)=0
 or position('update public.exceptions' in lower(d))>0
 then raise exception 'Unexpected current case-reuse definition; stop without replacing';end if;
 execute replace(d,old_block,new_block);
end $patch$;

notify pgrst,'reload schema';
commit;
