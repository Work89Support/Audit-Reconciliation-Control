-- One-off repair for the confirmed 3XB SCB previous-day false cases.
-- Keep source files, old runs and exceptions; never infer a financial approval.
begin;
do $$
declare
  v_run uuid;
  v_candidates integer;
begin
  select r.id into v_run
  from public.daily_recon_jobs j join public.recon_runs r on r.id=j.last_run_id
  where j.id='172007c9-c95f-4ab7-9581-4940319965b0'
    and j.company='3XB' and j.business_date='2026-10-01'
    and j.status='completed'
    and r.summary->>'worker_version'='1.9.73-neutral-missing-evidence';
  if v_run is null then
    raise exception 'Require completed 3XB 2026-10-01 run on verified parser 1.9.73';
  end if;

  select count(*) into v_candidates from public.exceptions
  where run_id=v_run and company='3XB' and business_date='2026-10-01'
    and account='5034633029' and ex_type in ('missing_bo','amount_diff')
    and status='open' and superseded_by_exception_id is null
    and previous_exception_id is not null
    and stm_raw ~ '^30/09/26[[:space:]]';
  if v_candidates>42 then
    raise exception 'Unexpected printed-date repair population: %',v_candidates;
  end if;

  with corrected as (
    update public.exceptions
    set status='closed',auto_closed=true,resolved_at=now(),
        resolved_by='system:printed-date-repair',closing_run_id=v_run,
        closure_rule='source-printed-date-outside-business-day',
        resolution_note='แก้เคสเทียม: STM ต้นฉบับระบุ 30/09/26 แต่รอบเก่าเปลี่ยนเป็น 01/10; ตัวอ่านใหม่รักษาวันต้นฉบับและไม่นำรายการนี้เข้ารอบ 01/10 ไม่ใช่การอนุมัติธุรกรรมหรือยืนยันยอดของ 30/09',
        updated_at=now()
    where run_id=v_run and company='3XB' and business_date='2026-10-01'
      and account='5034633029' and ex_type in ('missing_bo','amount_diff')
      and status='open' and superseded_by_exception_id is null
      and previous_exception_id is not null
      and stm_raw ~ '^30/09/26[[:space:]]'
    returning id,code,stm_raw,previous_exception_id
  )
  insert into public.audit_log(actor,action,entity,target,detail,meta)
  select 'system:printed-date-repair','repair_false_exception','exceptions',id::text,
    'Confirmed source date 2026-09-30 must not create a 2026-10-01 exception',
    jsonb_build_object('run_id',v_run,'code',code,'stm_raw',stm_raw,
      'previous_exception_id',previous_exception_id,'source_date','2026-09-30',
      'business_date','2026-10-01','financial_approval',false)
  from corrected;

  with corrected as (
    update public.exceptions
    set cause='ยังไม่พบรายการ STM/PM คู่กัน ต้องตรวจความครบของไฟล์และหลักฐานก่อนระบุสาเหตุ',updated_at=now()
    where run_id=v_run and company='3XB' and business_date='2026-10-01'
      and ex_type='missing_stm' and status='open'
      and cause='auto ไม่เข้า แล้วทำ manual ซ้ำ'
    returning id
  )
  insert into public.audit_log(actor,action,entity,target,detail,meta)
  select 'system:printed-date-repair','correct_unproven_cause','exceptions',id::text,
    'Removed automatic manual-duplicate allegation; evidence remains missing and case stays open',
    jsonb_build_object('run_id',v_run,'financial_approval',false)
  from corrected;
end $$;
commit;
