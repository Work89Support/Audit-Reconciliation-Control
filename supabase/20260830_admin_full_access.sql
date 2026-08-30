-- Admin operational access: every page/company and every workflow action.
-- Deletion of transaction/evidence remains intentionally unavailable.

drop policy if exists exceptions_audit_update on public.exceptions;
create policy exceptions_audit_update on public.exceptions for update to authenticated
  using(public.current_app_role() in ('monitor','lead','shift_lead','admin') and public.has_company_access(company))
  with check(public.current_app_role() in ('monitor','lead','shift_lead','admin') and public.has_company_access(company));

drop policy if exists damages_lead_write on public.damages;
create policy damages_lead_write on public.damages for insert to authenticated
  with check(public.current_app_role() in ('lead','admin') and public.has_company_access(company));
drop policy if exists damages_lead_update on public.damages;
create policy damages_lead_update on public.damages for update to authenticated
  using(public.current_app_role() in ('lead','admin') and public.has_company_access(company))
  with check(public.current_app_role() in ('lead','admin') and public.has_company_access(company));

drop policy if exists clarify_docs_workflow_write on public.clarify_docs;
create policy clarify_docs_workflow_write on public.clarify_docs for insert to authenticated
  with check(public.current_app_role() in ('monitor','lead','shift_lead','admin') and public.has_company_access(company));

drop policy if exists clarification_matches_scoped_write on public.clarification_matches;
create policy clarification_matches_scoped_write on public.clarification_matches for insert to authenticated
  with check(public.current_app_role() in ('monitor','lead','admin') and public.has_company_access(company));
drop policy if exists clarification_matches_scoped_update on public.clarification_matches;
create policy clarification_matches_scoped_update on public.clarification_matches for update to authenticated
  using(public.current_app_role() in ('monitor','lead','admin') and public.has_company_access(company))
  with check(public.current_app_role() in ('monitor','lead','admin') and public.has_company_access(company));

notify pgrst,'reload schema';
