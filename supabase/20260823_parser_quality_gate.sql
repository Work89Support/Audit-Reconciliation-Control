-- Parser quality gate: a reconciliation job may finish only after every source file
-- was decoded into usable transaction rows. Header/format failures stay visible.

create or replace function public.record_source_file_parse_results(
  p_job_id uuid,
  p_results jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.daily_recon_jobs%rowtype;
  v_result jsonb;
  v_file_id uuid;
  v_error text;
  v_row_count integer;
  v_updated integer := 0;
  v_errors integer := 0;
  v_error_files text[] := '{}';
begin
  select * into v_job from public.daily_recon_jobs where id = p_job_id for update;
  if not found then raise exception 'daily reconciliation job not found: %', p_job_id; end if;

  for v_result in select value from jsonb_array_elements(coalesce(p_results, '[]'::jsonb))
  loop
    begin
      v_file_id := (v_result->>'id')::uuid;
      v_error := nullif(trim(v_result->>'parse_error'), '');
      v_row_count := greatest(coalesce((v_result->>'row_count')::integer, 0), 0);
    exception when others then
      raise exception 'invalid parse result payload: %', v_result;
    end;

    update public.source_files f
       set parsed = v_error is null,
           parsed_at = case when v_error is null then now() else null end,
           row_count = v_row_count,
           parse_error = v_error
     where f.id = v_file_id
       and exists (
         select 1
           from public.mail_batches b
          where b.id = f.batch_id
            and b.business_date = v_job.business_date
            and upper(coalesce(f.company, b.company, '')) = upper(v_job.company)
       );

    if found then
      v_updated := v_updated + 1;
      if v_error is not null then
        v_errors := v_errors + 1;
        if cardinality(v_error_files) < 8 then
          v_error_files := array_append(v_error_files, coalesce(v_result->>'file_name', v_file_id::text));
        end if;
      end if;
    end if;
  end loop;

  if v_updated = 0 then raise exception 'no source files were updated for job %', p_job_id; end if;

  if v_errors > 0 then
    update public.daily_recon_jobs
       set status = 'needs_review',
           parsed_count = greatest(v_updated - v_errors, 0),
           error_count = v_errors,
           claimed_at = null,
           claimed_by = null,
           last_error = left('Quality Gate: อ่านไฟล์ไม่ผ่าน ' || v_errors || ' ไฟล์ — ' || array_to_string(v_error_files, ', '), 2000),
           updated_at = now()
     where id = p_job_id;

    insert into public.recon_notifications
      (dedupe_key, level, title, detail, business_date, company, job_id)
    values
      ('parse-quality:' || p_job_id || ':' || md5(coalesce(p_results::text, '')),
       'error', 'อ่านไฟล์ไม่ผ่าน Quality Gate',
       'พบ ' || v_errors || ' ไฟล์: ' || array_to_string(v_error_files, ', '),
       v_job.business_date, v_job.company, p_job_id)
    on conflict (dedupe_key) do nothing;
  else
    update public.daily_recon_jobs
       set parsed_count = v_updated,
           error_count = 0,
           last_error = null,
           updated_at = now()
     where id = p_job_id;
  end if;

  return jsonb_build_object('updated', v_updated, 'errors', v_errors, 'passed', v_errors = 0);
end;
$$;

-- queue_due_daily_recon_jobs refreshes counters first. Keep parse failures out of
-- the automatic queue until the file/parser is corrected and explicitly retried.
create or replace function public.queue_due_daily_recon_jobs(
  p_from date default current_date - 7,
  p_to date default current_date
)
returns setof public.daily_recon_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.daily_recon_jobs
     set status = case when attempt_count >= 3 then 'error' else 'queued' end,
         claimed_at = null,
         claimed_by = null,
         last_error = case when attempt_count >= 3
           then 'หยุดลองอัตโนมัติหลังล้มเหลว 3 ครั้ง: ตรวจรูปแบบไฟล์หรือเพิ่มไฟล์ที่ถูกต้อง'
           else 'กู้คิวอัตโนมัติ: งานเดิมค้างเกิน 15 นาที' end,
         updated_at = now()
   where status = 'running' and claimed_at < now() - interval '15 minutes';

  perform public.refresh_daily_recon_jobs(p_from, p_to);

  update public.daily_recon_jobs
     set status = 'needs_review',
         updated_at = now()
   where business_date between p_from and p_to
     and error_count > 0;

  update public.daily_recon_jobs
     set status = 'queued', updated_at = now()
   where business_date between p_from and p_to
     and status = 'ready'
     and error_count = 0;

  update public.daily_recon_jobs
     set status = 'needs_review', updated_at = now()
   where business_date between p_from and p_to
     and status = 'waiting_files'
     and cutoff_at <= now();

  insert into public.recon_notifications
    (dedupe_key, level, title, detail, business_date, company, job_id)
  select 'missing:' || j.id || ':' || j.missing_groups::text,
         'warning', 'ไฟล์ยังไม่ครบหลังเวลาปิดรับ',
         'กลุ่มไฟล์ที่ขาด: ' || j.missing_groups::text,
         j.business_date, j.company, j.id
    from public.daily_recon_jobs j
   where j.status = 'needs_review'
     and j.error_count = 0
  on conflict (dedupe_key) do nothing;

  insert into public.recon_notifications
    (dedupe_key, level,title,detail,business_date,company,job_id)
  select 'retry-exhausted:' || j.id || ':' || j.attempt_count,
         'error', 'หยุดลองกระทบยอดอัตโนมัติ',
         coalesce(j.last_error, 'งานล้มเหลวซ้ำเกินกำหนด'),
         j.business_date, j.company, j.id
    from public.daily_recon_jobs j
   where j.status = 'error' and j.attempt_count >= 3
  on conflict (dedupe_key) do nothing;

  return query
    select * from public.daily_recon_jobs
     where business_date between p_from and p_to
     order by business_date, company;
end;
$$;

revoke all on function public.record_source_file_parse_results(uuid, jsonb) from public;
revoke all on function public.queue_due_daily_recon_jobs(date, date) from public;
grant execute on function public.record_source_file_parse_results(uuid, jsonb) to authenticated;
grant execute on function public.queue_due_daily_recon_jobs(date, date) to authenticated;

