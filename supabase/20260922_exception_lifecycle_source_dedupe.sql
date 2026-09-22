-- Prevent one unresolved transaction from appearing twice after a rerun when
-- parser improvements change only its display account/provider.  The exact
-- source evidence remains the transaction identity.  No exception is deleted.
begin;
set local lock_timeout = '5s';

create or replace function public.recon_exception_lifecycle_key(p_exception public.exceptions)
returns text language sql immutable set search_path=public as $$
  select md5(concat_ws('|',
    upper(trim(coalesce(p_exception.company,''))),
    coalesce(p_exception.business_date::text,''),
    lower(trim(coalesce(p_exception.ex_type,''))),
    trim(coalesce(p_exception.direction,'')),
    coalesce(p_exception.bank_amount,p_exception.system_amount,0)::text,
    trim(coalesce(p_exception.stm_raw,'')),
    trim(coalesce(p_exception.bo_raw,''))
  ))
$$;

-- Existing lifecycle keys were produced by v1 and included account. Refresh
-- only committed current runs: these are the sole predecessor runs inspected
-- by the next reconciliation, so historical rows need no bulk rewrite.
update public.exceptions e
set lifecycle_key=public.recon_exception_lifecycle_key(e)
from public.daily_recon_jobs j
where e.run_id=j.last_run_id
  and e.lifecycle_key is distinct from public.recon_exception_lifecycle_key(e);

-- Repair current-run carry rows only when exactly one native row in that run
-- has the same source evidence.  The carry row is retained and linked as
-- superseded, preserving the complete Audit Log/history.
do $$
declare
  v_carry public.exceptions%rowtype;
  v_native_id uuid;
  v_count integer;
begin
  for v_carry in
    select e.* from public.daily_recon_jobs j
    join public.exceptions e on e.run_id=j.last_run_id
    where j.status='completed'
      and e.previous_exception_id is not null
      and e.superseded_by_exception_id is null
      and e.code like '%-C%'
    order by e.created_at,e.id
    for update of e
  loop
    select count(*),min(x.id::text)::uuid into v_count,v_native_id
    from public.exceptions x
    where x.run_id=v_carry.run_id and x.id<>v_carry.id
      and x.previous_exception_id is null
      and x.superseded_by_exception_id is null
      and public.recon_exception_lifecycle_key(x)=public.recon_exception_lifecycle_key(v_carry);
    if v_count=1 then
      update public.exceptions set superseded_by_exception_id=v_native_id,
        status='closed',auto_closed=true,resolved_at=now(),
        resolved_by='system:exception-lifecycle-v2',closure_rule='duplicate-carry-superseded',
        resolution_note='ซ่อนเคสยกมาซ้ำหลัง parser ปรับชื่อบัญชี โดยเชื่อมกับเคสปัจจุบันและเก็บประวัติเดิม',updated_at=now()
      where id=v_carry.id;
      insert into public.audit_log(actor,action,entity,target,detail,meta)
      values('system:exception-lifecycle-v2','duplicate_carry_superseded','exception',v_carry.id::text,
        'เคสยกมาซ้ำกับหลักฐานต้นฉบับของรอบปัจจุบัน จึงเชื่อมและนำออกจากคิวตรวจโดยไม่ลบข้อมูล',
        jsonb_build_object('native_exception_id',v_native_id,'run_id',v_carry.run_id,'rule','unique-source-evidence'));
    end if;
  end loop;
end $$;

create or replace view public.v_current_exceptions as
select e.id, e.run_id, e.code, e.business_date, e.occurred_at,
       e.company, e.bank, e.account, e.direction, e.member_code,
       e.ex_type, e.type_name, e.severity, e.status, e.track, e.due_at,
       e.system_amount, e.bank_amount, e.amount_diff, e.risk_amount,
       e.currency, e.fx_rate, e.time_diff_sec, e.employee, e.shift,
       e.cause, e.detail, e.stm_raw, e.bo_raw, e.created_at, e.updated_at,
       e.customer_details
from public.daily_recon_jobs j
join public.exceptions e on e.run_id = j.last_run_id
where j.status = 'completed'
  and e.superseded_by_exception_id is null;

grant select on public.v_current_exceptions to authenticated;
revoke all on function public.recon_exception_lifecycle_key(public.exceptions) from public,anon;
grant execute on function public.recon_exception_lifecycle_key(public.exceptions) to authenticated,service_role;
notify pgrst, 'reload schema';
commit;
