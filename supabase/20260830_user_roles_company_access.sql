-- Production authorization: user role + company scope + durable case ownership
-- Run once in Supabase SQL Editor after supabase/schema.sql.

create table if not exists public.app_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role text not null default 'monitor'
    check (role in ('monitor','lead','shift_lead','exec','admin')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_company_access (
  user_id uuid not null references public.app_profiles(user_id) on delete cascade,
  company text not null,
  can_respond boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, company)
);
create index if not exists user_company_access_company_idx
  on public.user_company_access(company, user_id);

alter table public.exceptions add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table public.exceptions add column if not exists requested_by uuid references auth.users(id) on delete set null;
alter table public.exceptions add column if not exists requested_at timestamptz;
alter table public.exceptions add column if not exists responded_by uuid references auth.users(id) on delete set null;
alter table public.exceptions add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.exceptions add column if not exists response_text text;
alter table public.exceptions add column if not exists responded_at timestamptz;
alter table public.exceptions add column if not exists approved_at timestamptz;
alter table public.exceptions add column if not exists resolution_note text;
alter table public.exceptions add column if not exists resolved_at timestamptz;
alter table public.exceptions add column if not exists resolved_by text;
create index if not exists exceptions_assignment_idx on public.exceptions(assigned_to, status, due_at);

alter table public.audit_log add column if not exists actor_user_id uuid references auth.users(id) on delete set null;
alter table public.audit_log add column if not exists company text;
alter table public.audit_log alter column actor_user_id set default auth.uid();

create or replace function public.current_app_role()
returns text language sql stable security definer set search_path=public as $$
  select role from public.app_profiles where user_id=auth.uid() and active limit 1
$$;

create or replace function public.current_user_active()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.app_profiles where user_id=auth.uid() and active)
$$;

create or replace function public.has_company_access(p_company text)
returns boolean language sql stable security definer set search_path=public as $$
  select case
    when public.current_app_role() in ('lead','exec','admin') then true
    else exists(
      select 1 from public.user_company_access a
      where a.user_id=auth.uid() and upper(a.company) in ('*',upper(coalesce(p_company,'')))
    )
  end
$$;

create or replace function public.get_my_access()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'email',p.email,'full_name',p.full_name,'role',p.role,'active',p.active,
    'companies',coalesce((select jsonb_agg(a.company order by a.company) from public.user_company_access a where a.user_id=p.user_id),'[]'::jsonb)
  )
  from public.app_profiles p where p.user_id=auth.uid()
$$;

create or replace function public.admin_list_user_access()
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
begin
  if public.current_app_role()<>'admin' then raise exception 'เฉพาะผู้ดูแลระบบเท่านั้น'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id',p.user_id,'email',p.email,'full_name',p.full_name,'role',p.role,'active',p.active,
      'companies',coalesce((select jsonb_agg(a.company order by a.company) from public.user_company_access a where a.user_id=p.user_id),'[]'::jsonb)
    ) order by p.email) from public.app_profiles p
  ),'[]'::jsonb);
end $$;

create or replace function public.admin_upsert_user_access(
  p_email text, p_full_name text, p_role text, p_active boolean, p_companies text[] default '{}'
) returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_user_id uuid; v_company text;
begin
  if public.current_app_role()<>'admin' then raise exception 'เฉพาะผู้ดูแลระบบเท่านั้น'; end if;
  if p_role not in ('monitor','lead','shift_lead','exec','admin') then raise exception 'บทบาทไม่ถูกต้อง'; end if;
  select id into v_user_id from auth.users where lower(email)=lower(trim(p_email)) limit 1;
  if v_user_id is null then raise exception 'ยังไม่พบบัญชี % ใน Supabase Auth — ให้ผู้ใช้นั้นสมัครหรือรับคำเชิญก่อน',p_email; end if;
  insert into public.app_profiles(user_id,email,full_name,role,active,updated_at)
  values(v_user_id,lower(trim(p_email)),trim(coalesce(p_full_name,'')),p_role,coalesce(p_active,false),now())
  on conflict(user_id) do update set email=excluded.email,full_name=excluded.full_name,role=excluded.role,active=excluded.active,updated_at=now();
  delete from public.user_company_access where user_id=v_user_id;
  foreach v_company in array coalesce(p_companies,'{}') loop
    if nullif(trim(v_company),'') is not null then
      insert into public.user_company_access(user_id,company) values(v_user_id,upper(trim(v_company))) on conflict do nothing;
    end if;
  end loop;
  insert into public.audit_log(actor,actor_user_id,action,entity,target,detail)
  values(coalesce((select email from auth.users where id=auth.uid()),auth.uid()::text),auth.uid(),'update','user_access',lower(trim(p_email)),p_role||' · '||array_to_string(coalesce(p_companies,'{}'),','));
  return public.admin_list_user_access();
end $$;

-- Bootstrap the existing production owner. No other Auth account is activated automatically.
insert into public.app_profiles(user_id,email,full_name,role,active)
select id,lower(email),'ผู้ดูแลระบบ','admin',true from auth.users
where lower(email)='work.ltd89@gmail.com'
on conflict(user_id) do update set role='admin',active=true,updated_at=now();

alter table public.app_profiles enable row level security;
alter table public.user_company_access enable row level security;
drop policy if exists app_profiles_self_read on public.app_profiles;
create policy app_profiles_self_read on public.app_profiles for select to authenticated
  using(user_id=auth.uid() or public.current_app_role()='admin');
drop policy if exists user_company_access_self_read on public.user_company_access;
create policy user_company_access_self_read on public.user_company_access for select to authenticated
  using(user_id=auth.uid() or public.current_app_role()='admin');

-- Remove the former "every authenticated user can read/write everything" policies.
do $$ declare t text; begin
  foreach t in array array['mail_batches','source_files','recon_runs','exceptions','damages','clarify_docs','audit_log','mail_sources','recon_requirements','daily_recon_jobs','recon_notifications'] loop
    execute format('drop policy if exists %I on public.%I',t||'_auth_read',t);
    execute format('drop policy if exists %I on public.%I',t||'_auth_write',t);
    execute format('drop policy if exists %I on public.%I',t||'_auth_update',t);
  end loop;
end $$;

-- Later feature migrations added broad policies with different names. Remove
-- those as well so the role/company boundary cannot be bypassed.
drop policy if exists clarification_matches_auth_read on public.clarification_matches;
drop policy if exists clarification_matches_auth_write on public.clarification_matches;
drop policy if exists clarification_matches_auth_update on public.clarification_matches;
drop policy if exists source_file_replacements_auth_read on public.source_file_replacements;
drop policy if exists source_file_ocr_read_authenticated on public.source_file_ocr;

-- Company-scoped operational data. service_role used by n8n bypasses RLS.
do $$ declare t text; begin
  foreach t in array array['mail_batches','recon_runs','exceptions','damages','clarify_docs','daily_recon_jobs','recon_notifications'] loop
    execute format('drop policy if exists %I on public.%I',t||'_scoped_read',t);
    execute format('create policy %I on public.%I for select to authenticated using (public.current_user_active() and public.has_company_access(company))',t||'_scoped_read',t);
  end loop;
end $$;

drop policy if exists source_files_scoped_read on public.source_files;
create policy source_files_scoped_read on public.source_files for select to authenticated using(
  public.current_user_active() and public.has_company_access(coalesce(
    nullif(company,''),(select b.company from public.mail_batches b where b.id=source_files.batch_id)
  ))
);
drop policy if exists clarification_matches_scoped_read on public.clarification_matches;
create policy clarification_matches_scoped_read on public.clarification_matches for select to authenticated
  using(public.current_user_active() and public.has_company_access(company));
drop policy if exists clarification_matches_scoped_write on public.clarification_matches;
create policy clarification_matches_scoped_write on public.clarification_matches for insert to authenticated
  with check(public.current_app_role() in ('monitor','lead') and public.has_company_access(company));
drop policy if exists clarification_matches_scoped_update on public.clarification_matches;
create policy clarification_matches_scoped_update on public.clarification_matches for update to authenticated
  using(public.current_app_role() in ('monitor','lead') and public.has_company_access(company));
drop policy if exists source_file_replacements_scoped_read on public.source_file_replacements;
create policy source_file_replacements_scoped_read on public.source_file_replacements for select to authenticated
  using(public.current_user_active() and public.has_company_access(company));
drop policy if exists source_file_ocr_scoped_read on public.source_file_ocr;
create policy source_file_ocr_scoped_read on public.source_file_ocr for select to authenticated using(
  public.current_user_active() and exists(
    select 1 from public.source_files f where f.id=source_file_ocr.source_file_id
      and public.has_company_access(coalesce(nullif(f.company,''),(select b.company from public.mail_batches b where b.id=f.batch_id)))
  )
);

drop policy if exists exceptions_audit_update on public.exceptions;
create policy exceptions_audit_update on public.exceptions for update to authenticated
  using(public.current_app_role() in ('monitor','lead','shift_lead') and public.has_company_access(company))
  with check(public.current_app_role() in ('monitor','lead','shift_lead') and public.has_company_access(company));
drop policy if exists damages_lead_write on public.damages;
create policy damages_lead_write on public.damages for insert to authenticated
  with check(public.current_app_role()='lead' and public.has_company_access(company));
drop policy if exists damages_lead_update on public.damages;
create policy damages_lead_update on public.damages for update to authenticated
  using(public.current_app_role()='lead' and public.has_company_access(company));
drop policy if exists clarify_docs_workflow_write on public.clarify_docs;
create policy clarify_docs_workflow_write on public.clarify_docs for insert to authenticated
  with check(public.current_app_role() in ('monitor','lead','shift_lead') and public.has_company_access(company));

drop policy if exists global_settings_read on public.mail_sources;
create policy global_settings_read on public.mail_sources for select to authenticated using(public.current_user_active());
drop policy if exists global_requirements_read on public.recon_requirements;
create policy global_requirements_read on public.recon_requirements for select to authenticated using(public.current_user_active());
drop policy if exists global_settings_admin_write on public.mail_sources;
create policy global_settings_admin_write on public.mail_sources for all to authenticated
  using(public.current_app_role()='admin') with check(public.current_app_role()='admin');
drop policy if exists global_requirements_admin_write on public.recon_requirements;
create policy global_requirements_admin_write on public.recon_requirements for all to authenticated
  using(public.current_app_role()='admin') with check(public.current_app_role()='admin');

drop policy if exists audit_log_scoped_read on public.audit_log;
create policy audit_log_scoped_read on public.audit_log for select to authenticated
  using(public.current_app_role() in ('lead','admin') or actor_user_id=auth.uid());
drop policy if exists audit_log_append on public.audit_log;
create policy audit_log_append on public.audit_log for insert to authenticated
  with check(public.current_user_active() and (actor_user_id is null or actor_user_id=auth.uid()));

drop policy if exists audit_files_read on storage.objects;
create policy audit_files_read on storage.objects for select to authenticated using(
  bucket_id='audit-files' and public.current_user_active() and exists(
    select 1 from public.source_files f where f.storage_path=name and public.has_company_access(f.company)
  )
);
drop policy if exists audit_files_write on storage.objects;
create policy audit_files_write on storage.objects for insert to authenticated with check(
  bucket_id='audit-files' and public.current_app_role() in ('monitor','lead','admin')
);

grant select on public.app_profiles,public.user_company_access to authenticated;
grant execute on function public.get_my_access() to authenticated;
grant execute on function public.admin_list_user_access() to authenticated;
grant execute on function public.admin_upsert_user_access(text,text,text,boolean,text[]) to authenticated;
revoke all on function public.current_app_role() from public;
revoke all on function public.current_user_active() from public;
revoke all on function public.has_company_access(text) from public;
revoke all on function public.admin_list_user_access() from public;
revoke all on function public.admin_upsert_user_access(text,text,text,boolean,text[]) from public;
grant execute on function public.current_app_role(),public.current_user_active(),public.has_company_access(text) to authenticated;

notify pgrst,'reload schema';
