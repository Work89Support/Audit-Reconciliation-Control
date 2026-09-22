-- Prevent one unresolved transaction from appearing twice after a rerun when
-- parser improvements change only its display account/provider.  The exact
-- source time and amount remain the transaction identity.  Raw parser text is
-- deliberately excluded because parser upgrades can reformat that text.  No
-- exception is deleted.
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
    coalesce(p_exception.occurred_at::text,'')
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
-- has the same source time/amount/type/direction.  The set-based update uses
-- the existing (run_id,lifecycle_key) index and refuses ambiguous collisions.
-- The carry row is retained and linked as superseded, preserving Audit Log.
with candidates as (
  select c.id as carry_id,c.run_id,
         min(n.id::text)::uuid as native_id,count(*) as match_count
  from public.daily_recon_jobs j
  join public.exceptions c on c.run_id=j.last_run_id
  join public.exceptions n on n.run_id=c.run_id
    and n.id<>c.id
    and n.previous_exception_id is null
    and n.superseded_by_exception_id is null
    and n.lifecycle_key=c.lifecycle_key
  where j.status='completed'
    and c.previous_exception_id is not null
    and c.superseded_by_exception_id is null
    and c.code like '%-C%'
  group by c.id,c.run_id
), unique_matches as (
  select carry_id,run_id,native_id from candidates where match_count=1
), updated as (
  update public.exceptions e
  set superseded_by_exception_id=m.native_id,
      status='closed',auto_closed=true,resolved_at=now(),
      resolved_by='system:exception-lifecycle-v2',closure_rule='duplicate-carry-superseded',
      resolution_note='ซ่อนเคสยกมาซ้ำหลัง parser ปรับชื่อบัญชี โดยเชื่อมกับเคสปัจจุบันและเก็บประวัติเดิม',updated_at=now()
  from unique_matches m where e.id=m.carry_id
  returning e.id,e.run_id,m.native_id
)
insert into public.audit_log(actor,action,entity,target,detail,meta)
select 'system:exception-lifecycle-v2','duplicate_carry_superseded','exception',u.id::text,
       'เคสยกมาซ้ำกับเวลาและยอดต้นทางของรอบปัจจุบัน จึงเชื่อมและนำออกจากคิวตรวจโดยไม่ลบข้อมูล',
       jsonb_build_object('native_exception_id',u.native_id,'run_id',u.run_id,'rule','unique-source-time-amount')
from updated u;

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
