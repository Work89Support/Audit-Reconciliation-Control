-- Additive migration. No historical amounts, categories, employees or shifts are changed.
-- Install before deploying the new damage form. The original RPC remains compatible.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
alter table public.damages add column if not exists occurred_at time;
create or replace function public.confirm_damage_details(
  p_exception_id uuid, p_previous_status text, p_amount numeric, p_cause text,
  p_employee text, p_shift text, p_occurred_at time
) returns setof public.damages
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  e public.exceptions%rowtype;
  d public.damages%rowtype;
  employee_value text := nullif(btrim(p_employee),'');
  shift_value text := nullif(btrim(p_shift),'');
begin
  if auth.uid() is null or not public.current_user_active()
     or coalesce(public.current_app_role(),'') not in ('lead','admin') then
    raise exception 'ไม่มีสิทธิ์ยืนยันความเสียหาย' using errcode='42501';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount >= 100000000000000
     or p_amount <> round(p_amount,2) or p_amount::text in ('NaN','Infinity','-Infinity') then
    raise exception 'ยอดเสียหายต้องมากกว่า 0 และไม่เกิน 2 ตำแหน่งทศนิยม';
  end if;
  if p_cause is null or p_cause !~ '^\[damage:v2:(employee|backoffice|external|pm|game)\] .+'
     or length(btrim(regexp_replace(p_cause, '^\[[^]]+\] ', ''))) = 0 then
    raise exception 'ต้องเลือกประเภทและระบุเหตุผล';
  end if;
  if length(employee_value)>200 or length(shift_value)>32 then
    raise exception 'ชื่อหรือกะยาวเกินกำหนด';
  end if;
  select * into e from public.exceptions where id=p_exception_id for update;
  if not found or not public.has_company_access(e.company) then
    raise exception 'ไม่พบเคสหรือไม่มีสิทธิ์' using errcode='42501';
  end if;
  select * into d from public.damages where exception_id=e.id;
  if found then
    if e.status='damage' and d.amount_thb=p_amount and d.cause=p_cause
       and d.employee is not distinct from employee_value
       and d.shift is not distinct from shift_value
       and d.occurred_at is not distinct from p_occurred_at then
      return next d; return;
    end if;
    raise exception 'มีทะเบียนความเสียหายแล้ว กรุณารีเฟรชตรวจสอบ';
  end if;
  if e.status is distinct from p_previous_status or coalesce(e.status,'') not in ('open','clarifying','answered') then
    raise exception 'สถานะเคสเปลี่ยน กรุณารีเฟรชตรวจสอบ';
  end if;
  if not exists(select 1 from public.case_evidence where exception_id=e.id)
     and not exists(select 1 from public.source_files where id=e.clarification_file_id
       and kind='doc_clarify' and nullif(storage_path,'') is not null) then
    raise exception 'ต้องมีหลักฐานที่ผูกเคสในระบบ';
  end if;
  insert into public.damages(code,exception_id,business_date,company,employee,shift,occurred_at,
    amount,currency,fx_rate,amount_thb,cause,cycle,has_evidence,hr_status,finance_status)
  values('DMG-'||e.id,e.id,e.business_date,e.company,employee_value,shift_value,p_occurred_at,
    p_amount,'THB',1,p_amount,p_cause,
    case when extract(day from e.business_date)<=15 then 'C1'
         when extract(day from e.business_date)<=25 then 'C2' else 'C3' end,
    true,'ยังไม่ส่งบุคคล','รอปิดรอบ') returning * into d;
  update public.exceptions set status='damage',updated_at=now() where id=e.id;
  if not found then raise exception 'เปลี่ยนสถานะไม่ได้'; end if;
  return next d;
end;
$$;
revoke all on function public.confirm_damage_details(uuid,text,numeric,text,text,text,time) from public, anon;
grant execute on function public.confirm_damage_details(uuid,text,numeric,text,text,text,time) to authenticated;
notify pgrst,'reload schema';
commit;
