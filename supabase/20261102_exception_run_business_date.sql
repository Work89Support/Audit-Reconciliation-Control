begin;

create or replace function public.enforce_exception_run_business_date()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_business_date date;
begin
  if new.run_id is null then return new; end if;
  select r.business_date into v_business_date from public.recon_runs r where r.id = new.run_id;
  if v_business_date is null then raise exception 'ไม่พบรอบกระทบยอดของเคสนี้'; end if;
  new.business_date := v_business_date;
  return new;
end
$$;

drop trigger if exists trg_exception_run_business_date on public.exceptions;
create trigger trg_exception_run_business_date
before insert or update of run_id, business_date on public.exceptions
for each row execute function public.enforce_exception_run_business_date();

do $$
declare v_case public.exceptions%rowtype; v_run_date date;
begin
  select e.* into v_case from public.exceptions e
  where e.id = '91b6a552-f411-4ab2-85fe-9434cc683926'::uuid
    and e.company = '3XB' and e.code = 'EX-3003' for update;
  if not found then raise exception 'ไม่พบเคส 3XB EX-3003 ที่อนุมัติให้แก้'; end if;
  select r.business_date into v_run_date from public.recon_runs r where r.id = v_case.run_id;
  if v_run_date is distinct from '2026-11-01'::date
     or v_case.business_date is distinct from '2026-11-02'::date then
    raise exception 'ขอบเขตเคสเปลี่ยนจากข้อมูลที่ตรวจสอบไว้ — หยุดแก้';
  end if;
  update public.exceptions set business_date = v_run_date, updated_at = now() where id = v_case.id;
  insert into public.audit_log(actor, action, entity, target, detail, meta)
  values ('system:exception-run-date-fix','correct_exception_business_date','exception',v_case.id::text,
    'แก้ business_date ให้ตรงกับรอบกระทบยอด เพื่อให้ส่งชี้แจงจากผลหลักปัจจุบันได้',
    jsonb_build_object('company',v_case.company,'code',v_case.code,'run_id',v_case.run_id,
      'from_business_date',v_case.business_date,'to_business_date',v_run_date));
end
$$;

notify pgrst, 'reload schema';
commit;
