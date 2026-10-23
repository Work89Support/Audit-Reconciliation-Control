-- Keep the automatic-run write guard, but avoid repeating the same locked
-- daily-job lookup for every exception in one bulk insert transaction.
create or replace function public.guard_automatic_run_write()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  guard_key text;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    return new;
  end if;

  guard_key := coalesce(new.company,'') || '|' || coalesce(new.business_date::text,'');
  if current_setting('audit.automatic_run_guard_key',true) = guard_key then
    return new;
  end if;

  -- The row lock serializes this write transaction with pause/source-review
  -- changes. Once held, later rows for the same company/day are covered by it.
  perform 1
  from public.daily_recon_jobs
  where company=new.company
    and business_date=new.business_date
    and not is_archived
  for update;

  if public.audit_run_blocked(new.company,new.business_date) then
    raise exception 'พักงาน/ตรวจเฉพาะบัญชีอยู่ ไม่บันทึกผลอัตโนมัติ — สาเหตุระหว่างบันทึก: %',
      case
        when exists(
          select 1 from public.audit_run_holds
          where company=new.company and business_date=new.business_date and paused
        ) then 'พักบอทรอบหลักตามคำสั่ง'
        when public.audit_source_scope_managed(new.company,new.business_date)
          then 'มีเวอร์ชันไฟล์แก้ไข ต้องทบทวนผลแยก'
        else 'มีงานตรวจมือ queued/running ที่ lease ยังไม่หมด ป้องกันงานซ้อน'
      end;
  end if;

  perform set_config('audit.automatic_run_guard_key',guard_key,true);
  return new;
end
$$;

revoke all on function public.guard_automatic_run_write() from public,anon,authenticated;
grant execute on function public.guard_automatic_run_write() to service_role;

