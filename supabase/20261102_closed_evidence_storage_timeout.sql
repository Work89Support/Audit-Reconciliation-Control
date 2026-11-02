-- Keep closed-case evidence corrections append-only while avoiding nested SQL
-- authorization helpers in Storage RLS. Production logs showed SQLSTATE 57014
-- during current_app_role() -> has_company_access() policy evaluation.
begin;
set local lock_timeout='5s';

-- PL/pgSQL prevents the authorization lookups from being inlined/replanned
-- repeatedly when several permissive Storage policies are considered.
create or replace function public.current_app_role()
returns text language plpgsql stable security definer set search_path=public,pg_temp as $$
declare role_value text;
begin
 select p.role into role_value
 from public.app_profiles p
 where p.user_id=auth.uid() and p.active
 limit 1;
 return role_value;
end $$;

create or replace function public.current_user_active()
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 return exists(
  select 1 from public.app_profiles p
  where p.user_id=auth.uid() and p.active
 );
end $$;

create or replace function public.has_company_access(p_company text)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare role_value text;
begin
 select p.role into role_value
 from public.app_profiles p
 where p.user_id=auth.uid() and p.active
 limit 1;
 if role_value is null then return false; end if;
 if role_value in ('lead','exec','admin') then return true; end if;
 return exists(
  select 1 from public.user_company_access a
  where a.user_id=auth.uid()
   and upper(a.company) in ('*',upper(coalesce(p_company,'')))
 );
end $$;

-- One direct lookup for the exact closed-case correction path. This preserves
-- the existing lead/admin + closed/approved contract without calling the
-- general role/company helpers again from inside Storage RLS.
create or replace function public.can_upload_closed_case_evidence_path(p_name text)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null
  or split_part(p_name,'/',1)<>'case-evidence'
  or split_part(p_name,'/',3)<>auth.uid()::text
  or array_length(string_to_array(p_name,'/'),1)<>4 then
  return false;
 end if;
 return exists(
  select 1
  from public.app_profiles p
  join public.exceptions e on e.id::text=split_part(p_name,'/',2)
  where p.user_id=auth.uid() and p.active
   and p.role in ('lead','admin')
   and e.status in ('closed','approved')
 );
end $$;

revoke all on function public.can_upload_closed_case_evidence_path(text) from public,anon;
grant execute on function public.can_upload_closed_case_evidence_path(text) to authenticated;

drop policy if exists case_evidence_closed_correction_upload on storage.objects;
create policy case_evidence_closed_correction_upload on storage.objects
 for insert to authenticated
 with check(
  bucket_id='audit-files'
  and public.can_upload_closed_case_evidence_path(name)
 );

-- The legacy bucket-wide policy must not bypass or re-evaluate the dedicated
-- case-evidence policies. Other audit-file paths keep their former behavior.
drop policy if exists audit_files_write on storage.objects;
create policy audit_files_write on storage.objects for insert to authenticated
 with check(
  bucket_id='audit-files'
  and name not like 'case-evidence/%'
  and public.current_app_role() in ('monitor','lead','admin')
 );

notify pgrst,'reload schema';
commit;
