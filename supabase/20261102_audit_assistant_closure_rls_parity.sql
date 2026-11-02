-- Restore the legacy RLS role projection for Audit assistants after the
-- Storage timeout hardening changed current_app_role() to return the raw role.
-- This does not grant lead/admin access, add company scope, or change a case.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create or replace function public.current_app_role()
returns text language plpgsql stable security definer set search_path=public,pg_temp as $$
declare role_value text;
begin
 select p.role into role_value
 from public.app_profiles p
 where p.user_id=auth.uid() and p.active
 limit 1;
 return case when role_value='audit_assistant' then 'monitor' else role_value end;
end $$;

drop policy if exists closure_request_read on public.case_closure_requests;
create policy closure_request_read on public.case_closure_requests
 for select to authenticated
 using(
  public.current_user_active()
  and (public.current_app_role() in ('monitor','lead','admin')
       or public.current_audit_assistant())
  and public.has_company_access(company)
 );

notify pgrst,'reload schema';
commit;
