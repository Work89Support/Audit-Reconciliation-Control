-- Restore the browser role required by the waiting cross-day Storage policy.
-- Permission-only repair: no case, file, amount, status or history rows change.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $verify_function$
begin
 if to_regprocedure('public.can_attach_waiting_cross_day_evidence(uuid)') is null then
  raise exception 'Missing can_attach_waiting_cross_day_evidence(uuid); stop repair';
 end if;
end $verify_function$;

revoke all on function public.can_attach_waiting_cross_day_evidence(uuid) from public,anon;
grant execute on function public.can_attach_waiting_cross_day_evidence(uuid) to authenticated;

do $verify_grant$
begin
 if not has_function_privilege(
  'authenticated',
  'public.can_attach_waiting_cross_day_evidence(uuid)',
  'EXECUTE'
 ) then
  raise exception 'Authenticated execute grant was not restored';
 end if;
end $verify_grant$;

notify pgrst,'reload schema';
commit;
