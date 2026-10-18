-- Definitions only: no backfill, submission, matching, closure or ledger writes.
begin;
set local lock_timeout='5s';
set local statement_timeout='15s';
create or replace function public.cross_day_case_source_ready(e public.exceptions)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.current_user_active() and public.has_company_access(e.company)
 and public.primary_case_is_current(e.id)
 and case when e.customer_details->>'manual_primary_id' is not null
 then public.cross_day_current_manual_case(e)
 else exists(select 1 from public.daily_recon_jobs j
 where j.company=e.company and j.business_date=e.business_date
 and not j.is_archived and j.last_run_id=e.run_id) end
$$;
revoke all on function public.cross_day_case_source_ready(public.exceptions) from public,anon,authenticated;
do $patch$
declare d text;a text;b text;s text;
begin
 s:='public.cross_day_workbench(text,date,date)';
 d:=pg_get_functiondef(s::regprocedure);
 if position('cross_day_case_source_ready(e)' in d)=0 then
  a:='from public.exceptions e join public.daily_recon_jobs j on j.last_run_id=e.run_id and j.company=e.company and not j.is_archived';
  b:='from public.exceptions e';
  if (length(d)-length(replace(d,a,'')))<>length(a) then raise exception 'Workbench source anchor drift';end if;
  d:=replace(d,a,b);
  a:='and e.ex_type=''cross_day''';
  if (length(d)-length(replace(d,a,'')))<>length(a)
   or position('public.primary_case_is_current(e.id)' in d)=0
   or position('public.cross_day_current_manual_case(e)' in d)=0
  then raise exception 'Workbench authority guard drift';end if;
  execute replace(d,a,a||' and public.cross_day_case_source_ready(e)');
 end if;
 foreach s in array array['public.submit_cross_day_image_review(uuid,uuid,uuid,integer,text)',
 'public.decide_cross_day_image_review(uuid,text,text)'] loop
  d:=pg_get_functiondef(s::regprocedure);
  if position('cross_day_case_source_ready(e)' in d)>0 then continue;end if;
  a:='if not exists(select 1 from public.daily_recon_jobs j where j.company=e.company and not j.is_archived and j.last_run_id=e.run_id) then';
  if (length(d)-length(replace(d,a,'')))<>length(a)
   or position('public.primary_case_is_current(e.id)' in d)=0
   or position('public.cross_day_current_manual_case(e)' in d)=0
   or position('for update' in d)=0 or position('storage.objects' in d)=0
  then raise exception 'Cross-day image source/authority anchor drift: %',s;end if;
  execute replace(d,a,'if not public.cross_day_case_source_ready(e) then');
 end loop;
end $patch$;
notify pgrst,'reload schema';
commit;
