-- Definitions only. Use the accepted manual case-set as well as the system run.
-- Keep all role, company, lifecycle, storage and evidence-preservation checks.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $patch$
declare
 d text;
 needle text := $old$if not exists(select 1 from public.daily_recon_jobs j where j.last_run_id=e.run_id
    and j.company=e.company and j.business_date=e.business_date and not j.is_archived) then$old$;
 replacement text := $new$if not (
 -- selected-file-primary-case-guard-v1: exact current case membership, never report count.
 public.primary_case_is_current(e.id)
 and (
 exists(select 1 from public.daily_recon_jobs j where j.last_run_id=e.run_id
 and j.company=e.company and j.business_date=e.business_date and not j.is_archived)
 or exists(
 select 1 from public.manual_primary_case_items i
 join public.manual_primary_results m on m.id=i.primary_id
 where i.exception_id=e.id and m.company=e.company and m.business_date=e.business_date
 and m.id=(select v.id from public.manual_primary_results v
 where v.company=e.company and v.business_date=e.business_date
 order by v.accepted_at desc,v.id desc limit 1))
 )
 ) then$new$;
begin
 d:=pg_get_functiondef('public.link_selected_case_file(uuid,uuid,text)'::regprocedure);
 if position('selected-file-primary-case-guard-v1' in d)>0 then return;end if;
 if (length(d)-length(replace(d,needle,'')))<>length(needle)
 or position('public.has_company_access(e.company)' in d)=0
 or position('public.current_app_role() not in (''lead'',''admin'')' in d)=0
 or position('for update' in d)=0 or position('for share' in d)=0
 or position('storage.objects' in d)=0
 or position('e.clarification_file_id is distinct from f.id' in d)=0
 or position('e.superseded_by_exception_id is not null' in d)=0
 or position('public.can_attach_waiting_cross_day_evidence(e.id)' in d)=0
 then raise exception 'Unexpected selected-file definition; stop without overwriting';end if;
 execute replace(d,needle,replacement);
end $patch$;
notify pgrst,'reload schema';
commit;
