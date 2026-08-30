-- Parse attachments as soon as they arrive, even when the opposite side of
-- the reconciliation is still missing.  Reconciliation itself remains gated
-- by required_groups, so an incomplete file set cannot create a misleading run.

begin;

create or replace function public.queue_due_daily_recon_jobs(
  p_from date default current_date-7,
  p_to date default current_date
)
returns setof public.daily_recon_jobs
language plpgsql
security definer
set search_path=public
as $$
declare
  v_from date:=least(coalesce(p_from,current_date-7),coalesce(p_to,current_date));
  v_to date:=greatest(coalesce(p_to,current_date),coalesce(p_from,current_date-7));
begin
  update public.daily_recon_jobs
  set status=case when attempt_count>=3 then 'error' else 'queued' end,
      claimed_at=null,
      claimed_by=null,
      last_error=case when attempt_count>=3
        then 'หยุดลองอัตโนมัติหลังล้มเหลว 3 ครั้ง: ตรวจรูปแบบไฟล์หรือเพิ่มไฟล์ที่ถูกต้อง'
        else 'กู้คิวอัตโนมัติ: งานเดิมค้างเกิน 15 นาที' end,
      updated_at=now()
  where not is_archived
    and status='running'
    and claimed_at<now()-interval '15 minutes';

  perform public.refresh_daily_recon_jobs(v_from,v_to);

  update public.daily_recon_jobs
  set status='needs_review',updated_at=now()
  where not is_archived
    and business_date between v_from and v_to
    and error_count>0;

  update public.daily_recon_jobs
  set status='queued',updated_at=now()
  where not is_archived
    and business_date between v_from and v_to
    and status='ready'
    and error_count=0;

  -- Important: queue an incomplete job only when it has an unread attachment.
  -- The worker parses it, then returns the job to waiting_files without creating
  -- a reconciliation run.
  update public.daily_recon_jobs j
  set status='queued',
      attempt_count=0,
      claimed_at=null,
      claimed_by=null,
      last_error=null,
      updated_at=now()
  where not j.is_archived
    and j.business_date between v_from and v_to
    -- Include queued/error jobs as well: a previous parser/OCR failure may
    -- already have consumed all retry attempts before this migration ran.
    -- Unread supported files are safe to retry because parse-result writes
    -- are idempotent per source file.
    and j.status in ('waiting_files','needs_review','completed','queued','error')
    and j.error_count=0
    and exists (
      select 1
      from public.mail_batches b
      join public.source_files f on f.batch_id=b.id
      where b.business_date=j.business_date
        and upper(coalesce(nullif(f.company,''),nullif(b.company,'')))=upper(j.company)
        and not coalesce(f.parsed,false)
        and f.parse_error is null
        and f.file_name~* '\.(xlsx|xlsm|xls|csv|pdf)$'
        and f.kind=any(array[
          'stm_pdf','pm_statement','bo_main','manual_credit','manual_payment',
          'manual_bonus','comm_req','credit_out'
        ]::text[])
    );

  update public.daily_recon_jobs
  set status='needs_review',updated_at=now()
  where not is_archived
    and business_date between v_from and v_to
    and status='waiting_files'
    and cutoff_at<=now();

  insert into public.recon_notifications
    (dedupe_key,level,title,detail,business_date,company,job_id)
  select 'missing:'||j.id||':'||j.missing_groups::text,
         'warning','ไฟล์ยังไม่ครบหลังเวลาปิดรับ',
         'กลุ่มไฟล์ที่ขาด: '||j.missing_groups::text,
         j.business_date,j.company,j.id
  from public.daily_recon_jobs j
  where not j.is_archived
    and j.status='needs_review'
    and j.error_count=0
  on conflict(dedupe_key) do nothing;

  insert into public.recon_notifications
    (dedupe_key,level,title,detail,business_date,company,job_id)
  select 'retry-exhausted:'||j.id||':'||j.attempt_count,
         'error','หยุดลองกระทบยอดอัตโนมัติ',
         coalesce(j.last_error,'งานล้มเหลวซ้ำเกินกำหนด'),
         j.business_date,j.company,j.id
  from public.daily_recon_jobs j
  where not j.is_archived
    and j.status='error'
    and j.attempt_count>=3
  on conflict(dedupe_key) do nothing;

  return query
  select * from public.daily_recon_jobs
  where not is_archived and business_date between v_from and v_to
  order by business_date,company;
end;
$$;

create or replace function public.finish_daily_recon_parse_only(
  p_job_id uuid
)
returns public.daily_recon_jobs
language plpgsql
security definer
set search_path=public
as $$
declare
  v_job public.daily_recon_jobs%rowtype;
begin
  select * into v_job
  from public.daily_recon_jobs
  where id=p_job_id
  for update;
  if not found then
    raise exception 'daily reconciliation job not found: %',p_job_id;
  end if;

  select * into v_job
  from public.refresh_daily_recon_job(v_job.business_date,v_job.company);

  update public.daily_recon_jobs
  set status=case
        when error_count>0 then 'needs_review'
        when jsonb_array_length(missing_groups)>0 then 'waiting_files'
        else 'ready'
      end,
      claimed_at=null,
      claimed_by=null,
      last_error=case
        when error_count>0 then last_error
        when jsonb_array_length(missing_groups)>0
          then 'อ่านไฟล์ที่ได้รับแล้ว · รอไฟล์อีกฝั่งก่อนกระทบยอด'
        else null
      end,
      updated_at=now()
  where id=p_job_id
  returning * into v_job;

  return v_job;
end;
$$;

-- Keep the existing parser/OCR persistence implementation intact and wrap its
-- result with the required-file gate.  This also makes older published worker
-- versions safe while the new workflow version is being rolled out.
do $$
begin
  if to_regprocedure('public.record_source_file_parse_results_raw(uuid,jsonb)') is null then
    alter function public.record_source_file_parse_results(uuid,jsonb)
      rename to record_source_file_parse_results_raw;
  end if;
end;
$$;

create or replace function public.record_source_file_parse_results(
  p_job_id uuid,
  p_results jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_result jsonb;
  v_job public.daily_recon_jobs%rowtype;
begin
  v_result:=public.record_source_file_parse_results_raw(p_job_id,p_results);
  select * into v_job from public.daily_recon_jobs where id=p_job_id;

  if coalesce((v_result->>'passed')::boolean,false)
     and jsonb_array_length(v_job.missing_groups)>0 then
    update public.daily_recon_jobs
    set status='waiting_files',
        claimed_at=null,
        claimed_by=null,
        last_error='อ่านไฟล์ที่ได้รับแล้ว · รอไฟล์อีกฝั่งก่อนกระทบยอด',
        updated_at=now()
    where id=p_job_id;
    v_result:=jsonb_set(v_result,'{passed}','false'::jsonb,true);
    v_result:=v_result||jsonb_build_object('waiting_for_files',true);
  else
    v_result:=v_result||jsonb_build_object('waiting_for_files',false);
  end if;

  return v_result;
end;
$$;

revoke all on function public.queue_due_daily_recon_jobs(date,date) from public;
revoke all on function public.finish_daily_recon_parse_only(uuid) from public;
revoke all on function public.record_source_file_parse_results(uuid,jsonb) from public;
grant execute on function public.queue_due_daily_recon_jobs(date,date) to authenticated;
grant execute on function public.finish_daily_recon_parse_only(uuid) to authenticated;
grant execute on function public.record_source_file_parse_results(uuid,jsonb) to authenticated;

commit;
