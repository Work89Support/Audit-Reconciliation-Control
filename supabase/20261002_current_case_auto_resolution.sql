-- Persist evidence-based closure; never hide open carry rows by their code.
begin;
set local lock_timeout='10s';
create or replace function public.resolve_current_evidence_cases(p_run_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_closed integer; v_date_closed integer;
begin
  -- Only the completed, current result of a non-archived job is authoritative.
  perform 1 from public.daily_recon_jobs j join public.recon_runs r on r.id=j.last_run_id
    where r.id=p_run_id and j.status='completed' and not j.is_archived
      and r.summary->>'source_parser_completion'='true' for update of j;
  if not found then return 0; end if;
  with pairs as (
    select ev,ordinality pair_id,r.company,r.business_date from public.recon_runs r
    cross join lateral jsonb_array_elements(coalesce(r.summary->'match_evidence','[]')) with ordinality p(ev,ordinality)
    where r.id=p_run_id
  ), candidates as (
    select e.id,e.previous_exception_id,p.pair_id,e.ex_type,
      count(*) over(partition by e.id) pair_count,
      count(*) over(partition by p.pair_id,e.ex_type) case_count
    from public.exceptions e join pairs p on upper(coalesce(p.ev->>'company',p.company))=upper(e.company)
      and upper(p.ev->>'account')=upper(e.account)
      and (case p.ev->>'direction' when 'deposit' then 'ฝาก' when 'withdraw' then 'ถอน' end)=e.direction
    where e.run_id=p_run_id and e.previous_exception_id is not null
      and e.status in ('open','clarifying','answered') and e.superseded_by_exception_id is null
      and e.ex_type in ('missing_stm','cross_day')
      and p.ev->'bo'->>'date'=e.business_date::text
      and coalesce(e.customer_details->'bo'->>'reference','')<>''
      and coalesce(e.customer_details->'bo'->>'user','')<>''
      and p.ev->'customer'->'bo'->>'reference'=e.customer_details->'bo'->>'reference'
      and p.ev->'customer'->'stm'->>'reference'=e.customer_details->'bo'->>'reference'
      and p.ev->'customer'->'bo'->>'user'=e.customer_details->'bo'->>'user'
      and p.ev->'customer'->'stm'->>'user'=e.customer_details->'bo'->>'user'
      and coalesce(p.ev->>'boAmount',p.ev->>'amount','') ~ '^[0-9]+([.][0-9]+)?$'
      and coalesce(p.ev->>'stmAmount',p.ev->>'amount','') ~ '^[0-9]+([.][0-9]+)?$'
      and (coalesce(p.ev->>'boAmount',p.ev->>'amount'))::numeric=e.system_amount
      and (coalesce(p.ev->>'stmAmount',p.ev->>'amount'))::numeric=e.system_amount
      and coalesce(p.ev->>'manualReview','false')='false'
  ), closed as (
    update public.exceptions e set status='closed',auto_closed=true,resolved_at=now(),
      resolved_by='system:current-evidence-v4',closing_run_id=p_run_id,
      closure_rule='unique-ref-user-amount-evidence',
      resolution_note='รอบปัจจุบันพบคู่ 1:1 Ref User และยอดเงินจริงตรงทั้ง BO และ STM/PM จึงปิดเคสค้างเดิมโดยเก็บประวัติ',updated_at=now()
    from candidates c where e.id=c.id and c.pair_count=1 and c.case_count=1
    returning e.id,e.previous_exception_id
  ), logged as (
    insert into public.audit_log(actor,action,entity,target,detail,meta)
    select 'system:current-evidence-v4','exception_auto_closed_on_ref_user_amount','exception',id::text,
      'Closed persisted carry case from unique matching Ref + User + both source amounts',
      jsonb_build_object('closing_run_id',p_run_id,'previous_exception_id',previous_exception_id,
        'rule','unique-ref-user-amount-evidence') from closed returning id
  ) select count(*) into v_closed from closed;
  -- A preserved SCB printed date is authoritative, not the mail/report date.
  -- Only retired carried rows are corrected, never a native current result.
  with corrected as (
    update public.exceptions e set status='closed',auto_closed=true,resolved_at=now(),
      resolved_by='system:current-evidence-v4',closing_run_id=p_run_id,
      closure_rule='source-printed-date-outside-business-day',
      resolution_note='แก้เคสเทียมของ SCB: วันต้นฉบับอยู่นอกรอบตรวจและตัวอ่านล่าสุดรักษาวันจริงไว้ ไม่ใช่การอนุมัติธุรกรรมของวันอื่น',updated_at=now()
    from public.recon_runs r
    where r.id=p_run_id and e.run_id=r.id
      and r.summary->>'scb_printed_dates_preserved'='true'
      and e.previous_exception_id is not null and e.superseded_by_exception_id is null
      and e.status in ('open','clarifying','answered') and upper(e.bank)='SCB'
      and e.ex_type in ('missing_bo','amount_diff')
      and e.stm_raw ~ '^([0-2][0-9]|3[01])/(0[1-9]|1[0-2])/[0-9]{2}[[:space:]]'
      and to_char(e.business_date,'DD/MM/YY')<>left(e.stm_raw,8)
      and exists(select 1 from public.source_files f where f.id=any(r.file_ids)
        and f.kind='stm_pdf' and f.parsed and f.parse_error is null and f.file_name ilike '%SCB%')
    returning e.id,e.stm_raw
  ) insert into public.audit_log(actor,action,entity,target,detail,meta)
  select 'system:current-evidence-v4','repair_false_exception','exception',id::text,
    'Preserved SCB printed source date outside this run; no financial approval',
    jsonb_build_object('closing_run_id',p_run_id,'stm_raw',stm_raw,'financial_approval',false)
  from corrected;
  get diagnostics v_date_closed=row_count;
  return v_closed+v_date_closed;
end $$;

create or replace function public.resolve_current_evidence_after_finish()
returns trigger language plpgsql security definer set search_path=public as $$
begin perform public.resolve_current_evidence_cases(new.last_run_id); return new; end $$;
drop trigger if exists daily_recon_jobs_resolve_current_evidence on public.daily_recon_jobs;
create trigger daily_recon_jobs_resolve_current_evidence
after update of last_run_id,status on public.daily_recon_jobs for each row
when(new.status='completed' and new.last_run_id is not null and new.last_run_id is distinct from old.last_run_id)
execute function public.resolve_current_evidence_after_finish();
revoke all on function public.resolve_current_evidence_cases(uuid) from public,anon,authenticated;
revoke all on function public.resolve_current_evidence_after_finish() from public,anon,authenticated;
grant execute on function public.resolve_current_evidence_cases(uuid) to service_role;

-- Remove only the erroneous carry-code exclusion; preserve RLS and all other filters.
do $migration$
declare definition text;
begin
  select pg_get_functiondef('public.audit_daily_checklist(date,date,text,integer)'::regprocedure) into definition;
  if position('and code not like ''%-C%''' in definition)>0 then
    execute replace(definition,'and code not like ''%-C%''','');
  end if;
  select pg_get_viewdef('public.v_current_exceptions'::regclass,true) into definition;
  if definition ~* 'AND NOT \(e.previous_exception_id IS NOT NULL AND e.code ~~ ''%-C%''::text\)' then
    definition:=regexp_replace(definition,'AND NOT \(e.previous_exception_id IS NOT NULL AND e.code ~~ ''%-C%''::text\)','','i');
    execute 'create or replace view public.v_current_exceptions as '||definition;
  elsif definition ~* 'code.*%-C%' then
    raise exception 'Unexpected current-exception view; review before changing';
  end if;
end $migration$;

-- Explicitly scoped repair of the already verified current 7M run.
select public.resolve_current_evidence_cases(last_run_id) from public.daily_recon_jobs
where id='919e42d5-3493-4b09-abe9-d950ff95c1dd' and status='completed';
notify pgrst,'reload schema';
commit;
