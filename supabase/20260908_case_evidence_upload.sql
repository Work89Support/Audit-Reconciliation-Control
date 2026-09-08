-- User approved scoped clarification uploads on 2026-09-08.
-- Does not replace existing policies or close cases.
begin;
set local lock_timeout='5s';
create table if not exists public.case_evidence (
  id uuid primary key,
  exception_id uuid not null references public.exceptions(id),
  storage_path text not null unique,
  file_name text not null,
  size_bytes bigint not null check(size_bytes > 0 and size_bytes <= 20971520),
  mime_type text not null,
  uploaded_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.case_evidence enable row level security;
create policy case_evidence_read on public.case_evidence for select to authenticated
using (public.current_user_active() and exists (
  select 1 from public.exceptions e where e.id=exception_id and public.has_company_access(e.company)
));
create policy case_evidence_insert on public.case_evidence for insert to authenticated
with check (
  public.current_user_active() and uploaded_by=auth.uid()
  and public.current_app_role() in ('monitor','lead','shift_lead','admin')
  and storage_path='case-evidence/'||exception_id::text||'/'||auth.uid()::text||'/'||id::text
  and exists(select 1 from public.exceptions e where e.id=exception_id
    and public.has_company_access(e.company) and e.status in ('open','clarifying','answered')
    and (public.current_app_role()<>'shift_lead' or e.status='clarifying'))
  and exists(select 1 from storage.objects o where o.bucket_id='audit-files'
    and o.name=storage_path and o.owner_id=auth.uid()::text)
);
grant select,insert on public.case_evidence to authenticated;
create policy case_evidence_object_insert on storage.objects for insert to authenticated
with check (
  bucket_id='audit-files' and public.current_user_active()
  and public.current_app_role() in ('monitor','lead','shift_lead','admin')
  and split_part(name,'/',1)='case-evidence'
  and split_part(name,'/',3)=auth.uid()::text
  and array_length(string_to_array(name,'/'),1)=4
  and exists(select 1 from public.exceptions e where e.id::text=split_part(name,'/',2)
    and public.has_company_access(e.company) and e.status in ('open','clarifying','answered')
    and (public.current_app_role()<>'shift_lead' or e.status='clarifying'))
);
create policy case_evidence_object_read on storage.objects for select to authenticated
using (bucket_id='audit-files' and public.current_user_active() and exists (
  select 1 from public.case_evidence f join public.exceptions e on e.id=f.exception_id
  where f.storage_path=name and public.has_company_access(e.company)
));
-- The uploader must be able to verify the object before registering its evidence row.
create policy case_evidence_upload_verify on storage.objects for select to authenticated
using (bucket_id='audit-files' and public.current_user_active()
  and owner_id=auth.uid()::text and split_part(name,'/',1)='case-evidence'
  and split_part(name,'/',3)=auth.uid()::text
  and exists(select 1 from public.exceptions e where e.id::text=split_part(name,'/',2)
    and public.has_company_access(e.company)));
notify pgrst,'reload schema';
commit;
