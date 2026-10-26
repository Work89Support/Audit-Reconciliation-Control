-- Close only carried KTB missing-BO cases whose exact STM source row was
-- excluded by the audited System-123 BO-first reconciliation rule.
begin;
set local lock_timeout='10s';

create or replace function public.resolve_sys123_ktb_bo_first_suppressed_cases(p_run_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_closed integer;
begin
  perform 1
  from public.daily_recon_jobs j
  join public.recon_runs r on r.id=j.last_run_id
  where r.id=p_run_id and j.status='completed' and not j.is_archived
    and r.summary->>'source_parser_completion'='true'
    and r.summary->>'worker_version'='1.9.86-ktb-bo-source-lifecycle'
  for update of j;
  if not found then return 0; end if;

  with suppressed as (
    select s
    from public.recon_runs r
    cross join lateral jsonb_array_elements(
      coalesce(r.summary->'bo_first'->'sys123_ktb_bo_first_suppressed_rows','[]'::jsonb)
    ) s
    where r.id=p_run_id
      and coalesce(s->>'fileId','')<>''
      and coalesce(s->>'row','')~'^[0-9]+$'
  ), closed as (
    update public.exceptions e
    set status='closed',auto_closed=true,resolved_at=now(),
      resolved_by='system:sys123-ktb-bo-first-v1',closing_run_id=p_run_id,
      closure_rule='sys123-ktb-bo-first-exact-source-row',
      resolution_note='ปิดเคสค้างเทียมเมื่อรอบปัจจุบันยึด BO เป็นฐานและระบุ STM ส่วนเกินด้วยไฟล์และแถวต้นทางตรงกัน; ไม่ใช่การยืนยันความเสียหาย',
      risk_amount=0,updated_at=now()
    from suppressed x
    where e.run_id=p_run_id and e.previous_exception_id is not null
      and e.superseded_by_exception_id is null
      and e.status in ('open','clarifying','answered')
      and e.ex_type='missing_bo' and upper(coalesce(e.bank,''))='KTB'
      and e.customer_details->'source_rows'->'stm'->>'fileId'=x.s->>'fileId'
      and e.customer_details->'source_rows'->'stm'->>'row'=x.s->>'row'
      and upper(coalesce(e.company,''))=upper(coalesce(x.s->>'company',''))
      and upper(trim(coalesce(e.account,'')))=upper(trim(coalesce(x.s->>'account','')))
      and e.business_date=(x.s->>'date')::date
      and e.direction=case x.s->>'direction' when 'deposit' then 'ฝาก' when 'withdraw' then 'ถอน' else x.s->>'direction' end
      and coalesce(e.bank_amount,e.system_amount,0)=(x.s->>'amount')::numeric
    returning e.id,e.previous_exception_id
  ), logged as (
    insert into public.audit_log(actor,action,entity,target,detail,meta)
    select 'system:sys123-ktb-bo-first-v1','exception_auto_closed_on_exact_suppressed_source','exception',id::text,
      'Closed carried KTB false case from exact suppressed STM source row',
      jsonb_build_object('closing_run_id',p_run_id,'previous_exception_id',previous_exception_id,
        'rule','sys123-ktb-bo-first-exact-source-row','financial_approval',false)
    from closed returning id
  ) select count(*) into v_closed from closed;
  return v_closed;
end $$;

create or replace function public.resolve_sys123_ktb_bo_first_after_finish()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.resolve_sys123_ktb_bo_first_suppressed_cases(new.last_run_id);
  return new;
end $$;

drop trigger if exists daily_recon_jobs_resolve_sys123_ktb_bo_first on public.daily_recon_jobs;
create trigger daily_recon_jobs_resolve_sys123_ktb_bo_first
after update of last_run_id,status on public.daily_recon_jobs for each row
when(new.status='completed' and new.last_run_id is not null and new.last_run_id is distinct from old.last_run_id)
execute function public.resolve_sys123_ktb_bo_first_after_finish();

revoke all on function public.resolve_sys123_ktb_bo_first_suppressed_cases(uuid) from public,anon,authenticated;
revoke all on function public.resolve_sys123_ktb_bo_first_after_finish() from public,anon,authenticated;
grant execute on function public.resolve_sys123_ktb_bo_first_suppressed_cases(uuid) to service_role;
notify pgrst,'reload schema';
commit;
