-- Let an authenticated auditor correct a stored file from the preview modal.
-- The old parser result is cleared and the affected daily job is refreshed.

begin;

create or replace function public.reclassify_source_file(
  p_file_id uuid,
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
  v_actor text := coalesce(nullif(auth.jwt()->>'email', ''), nullif(trim(p_actor), ''), 'authenticated-user');
  v_job public.daily_recon_jobs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_file_id is null then
    raise exception 'file_id is required';
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

  select b.business_date, upper(coalesce(nullif(v_file.company, ''), nullif(b.company, '')))
  into v_date, v_old_company
  from public.mail_batches b
  where b.id=v_file.batch_id;

  -- Update kind first because the legacy normalizer trigger listens to kind.
  -- Company is intentionally applied in a second update so the auditor's
  -- explicit choice is the final value.
  update public.source_files
  set kind=v_kind,
      parsed=false,
      parsed_at=null,
      row_count=null,
      parse_error=null
  where id=p_file_id;
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
    'reclassify_and_retry',
    'source_file',
    p_file_id::text,
    'เปลี่ยนประเภทไฟล์และส่งตรวจใหม่',
    jsonb_build_object(
      'business_date', v_date,
      'old_company', v_old_company,
      'company', v_company,
      'kind', v_kind,
      'job_status', v_job.status
    )
  );

  return jsonb_build_object(
    'file_id', p_file_id,
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

revoke all on function public.reclassify_source_file(uuid, text, text, text) from public;
grant execute on function public.reclassify_source_file(uuid, text, text, text) to authenticated;

commit;
