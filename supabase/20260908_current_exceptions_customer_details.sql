-- Append the customer field without changing the existing view filters or grants.
begin;
set local lock_timeout = '5s';
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
where j.status = 'completed';
notify pgrst, 'reload schema';
commit;
