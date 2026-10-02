-- Scoped false-case correction; retain source/history, never approve money.
begin;
do $$
declare v_run uuid; v_count integer;
begin
  select r.id into v_run from public.daily_recon_jobs j
  join public.recon_runs r on r.id=j.last_run_id
  where j.id='919e42d5-3493-4b09-abe9-d950ff95c1dd'
    and j.company='UFABET7M' and j.business_date='2026-10-01'
    and j.status='completed'
    and r.summary->>'worker_version'='1.9.73-neutral-missing-evidence';
  if v_run is null then raise exception 'Require completed latest 7M run'; end if;
  if exists(select 1 from public.recon_runs r
    cross join lateral jsonb_array_elements(r.summary->'match_evidence') ev
    where r.id=v_run and ev->'stm'->>'fileId'='1769fa2b-132a-4ea4-b763-c83a7062a3f3') then
    raise exception 'Prior-day source still participates in matching';
  end if;
  select count(*) into v_count from public.exceptions
  where run_id=v_run and account='5034633891' and status='open'
    and company='UFABET7M' and business_date='2026-10-01'
    and ex_type in ('missing_bo','amount_diff')
    and previous_exception_id is not null and superseded_by_exception_id is null
    and stm_raw ~ '^30/09/26[[:space:]]';
  if v_count>30 then raise exception 'Unexpected repair population %',v_count; end if;
  with corrected as (
    update public.exceptions
    set status='closed',auto_closed=true,resolved_at=now(),
      resolved_by='system:printed-date-repair',closing_run_id=v_run,
      closure_rule='source-printed-date-outside-business-day',
      resolution_note='แก้เคสเทียม: STM ระบุ 30/09/26 ไม่ใช่รายการของ 01/10 ตัวอ่านใหม่รักษาวันต้นฉบับ การแก้นี้ไม่ใช่การอนุมัติธุรกรรมของ 30/09',updated_at=now()
    where run_id=v_run and account='5034633891' and status='open'
      and company='UFABET7M' and business_date='2026-10-01'
      and ex_type in ('missing_bo','amount_diff')
      and previous_exception_id is not null and superseded_by_exception_id is null
      and stm_raw ~ '^30/09/26[[:space:]]'
    returning id,code,stm_raw,previous_exception_id
  )
  insert into public.audit_log(actor,action,entity,target,detail,meta)
  select 'system:printed-date-repair','repair_false_exception','exceptions',id::text,
    'Printed 2026-09-30 source must not create 2026-10-01 exception',
    jsonb_build_object('run_id',v_run,'code',code,'stm_raw',stm_raw,
      'previous_exception_id',previous_exception_id,'financial_approval',false)
  from corrected;
end $$;
commit;
