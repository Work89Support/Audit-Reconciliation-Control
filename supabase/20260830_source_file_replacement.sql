-- Allow an authenticated auditor to replace an unreadable attachment with a
-- corrected file.  The old Storage object is deliberately kept and every
-- replacement is recorded so the audit trail remains reversible.

begin;

create table if not exists public.source_file_replacements (
  id uuid primary key default gen_random_uuid(),
  source_file_id uuid not null references public.source_files(id) on delete cascade,
  replaced_at timestamptz not null default now(),
  replaced_by text not null,
  old_file_name text not null,
  old_mime_type text,
  old_size_bytes bigint,
  old_storage_path text not null,
  old_checksum text,
  new_file_name text not null,
  new_mime_type text,
  new_size_bytes bigint,
  new_storage_path text not null,
  new_checksum text,
  company text not null,
  kind text not null
);

create index if not exists source_file_replacements_file_idx
  on public.source_file_replacements(source_file_id, replaced_at desc);

alter table public.source_file_replacements enable row level security;
drop policy if exists source_file_replacements_auth_read on public.source_file_replacements;
create policy source_file_replacements_auth_read on public.source_file_replacements
  for select to authenticated using (true);
grant select on table public.source_file_replacements to authenticated;

create or replace function public.replace_source_file(
  p_file_id uuid,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_storage_path text,
  p_checksum text,
  p_company text,
  p_kind text,
  p_actor text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_file public.source_files%rowtype;
  v_date date;
  v_old_company text;
  v_company text := upper(trim(coalesce(p_company, '')));
  v_kind text := trim(coalesce(p_kind, ''));
  v_name text := trim(coalesce(p_file_name, ''));
  v_path text := trim(coalesce(p_storage_path, ''));
  v_actor text := coalesce(nullif(auth.jwt()->>'email', ''), nullif(trim(p_actor), ''), 'authenticated-user');
  v_job public.daily_recon_jobs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_file_id is null then
    raise exception 'file_id is required';
  end if;
  if v_name = '' or v_path = '' or coalesce(p_size_bytes, 0) <= 0 then
    raise exception 'Replacement file metadata is incomplete';
  end if;
  if position('/replacements/' in v_path) = 0 then
    raise exception 'Replacement file must use the replacements storage path';
  end if;
  if not exists(select 1 from public.audit_companies where code=v_company and active) then
    raise exception 'Unknown or inactive company: %', v_company;
  end if;
  if v_kind <> all(array[
    'stm_pdf', 'pm_statement', 'bo_main', 'manual_credit', 'manual_payment',
    'manual_bonus', 'comm_req', 'credit_out', 'doc_clarify', 'unknown'
  ]::text[]) then
    raise exception 'Unsupported file kind: %', v_kind;
  end if;

  select f.* into v_file
  from public.source_files f
  where f.id=p_file_id
  for update;
  if not found then
    raise exception 'Source file not found';
  end if;
  if v_file.storage_path = v_path then
    raise exception 'Replacement path must differ from the current file';
  end if;

  select b.business_date, upper(coalesce(nullif(v_file.company, ''), nullif(b.company, '')))
  into v_date, v_old_company
  from public.mail_batches b
  where b.id=v_file.batch_id;

  insert into public.source_file_replacements(
    source_file_id, replaced_by,
    old_file_name, old_mime_type, old_size_bytes, old_storage_path, old_checksum,
    new_file_name, new_mime_type, new_size_bytes, new_storage_path, new_checksum,
    company, kind
  ) values (
    p_file_id, v_actor,
    v_file.file_name, v_file.mime_type, v_file.size_bytes, v_file.storage_path, v_file.checksum,
    v_name, nullif(trim(coalesce(p_mime_type, '')), ''), p_size_bytes, v_path, nullif(trim(coalesce(p_checksum, '')), ''),
    v_company, v_kind
  );

  -- Keep the same source_files id so recon jobs and evidence links continue to
  -- point at the attachment, but switch it to the new immutable Storage object.
  update public.source_files
  set file_name=v_name,
      mime_type=nullif(trim(coalesce(p_mime_type, '')), ''),
      size_bytes=p_size_bytes,
      storage_path=v_path,
      checksum=nullif(trim(coalesce(p_checksum, '')), ''),
      drive_file_id=null,
      drive_url=null,
      kind=v_kind,
      parsed=false,
      parsed_at=null,
      row_count=null,
      parse_error=null
  where id=p_file_id;
  -- Apply the auditor's explicit company after the legacy normalization trigger.
  update public.source_files set company=v_company where id=p_file_id;

  if v_date is not null and nullif(v_old_company, '') is not null and v_old_company <> v_company then
    perform public.refresh_daily_recon_job(v_date, v_old_company);
  end if;
  if v_date is not null then
    v_job := public.refresh_daily_recon_job(v_date, v_company);
    if jsonb_array_length(v_job.missing_groups)=0
       and v_job.file_count > 0
       and v_job.error_count=0
       and v_job.status <> 'running' then
      update public.daily_recon_jobs
      set status='queued',
          attempt_count=0,
          last_error=null,
          claimed_at=null,
          claimed_by=null,
          rerun_requested_at=now(),
          updated_at=now()
      where id=v_job.id
      returning * into v_job;
    end if;
  end if;

  insert into public.audit_log(actor, action, entity, target, detail, meta)
  values(
    v_actor,
    'replace_source_file_and_retry',
    'source_file',
    p_file_id::text,
    'อัปโหลดไฟล์ใหม่แทนที่และส่งตรวจใหม่',
    jsonb_build_object(
      'business_date', v_date,
      'old_company', v_old_company,
      'company', v_company,
      'kind', v_kind,
      'old_file_name', v_file.file_name,
      'old_storage_path', v_file.storage_path,
      'new_file_name', v_name,
      'new_storage_path', v_path,
      'job_status', v_job.status
    )
  );

  return jsonb_build_object(
    'file_id', p_file_id,
    'file_name', v_name,
    'mime_type', nullif(trim(coalesce(p_mime_type, '')), ''),
    'size_bytes', p_size_bytes,
    'storage_path', v_path,
    'checksum', nullif(trim(coalesce(p_checksum, '')), ''),
    'business_date', v_date,
    'company', v_company,
    'kind', v_kind,
    'job_id', v_job.id,
    'job_status', v_job.status,
    'queued', coalesce(v_job.status='queued', false),
    'missing_groups', coalesce(v_job.missing_groups, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.replace_source_file(uuid, text, text, bigint, text, text, text, text, text) from public;
grant execute on function public.replace_source_file(uuid, text, text, bigint, text, text, text, text, text) to authenticated;

commit;
