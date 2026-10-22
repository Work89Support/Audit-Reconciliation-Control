-- Enforce the two operational work shifts for new employee-damage records.
-- Existing damages, amounts, case states, history and collection records are untouched.
begin;
set local lock_timeout='5s';
set local statement_timeout='15s';

create or replace function public.enforce_damage_work_shift()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if new.cause ~ '^\[damage:v2:employee\] '
     and coalesce(btrim(new.shift),'') not in ('day','night') then
    raise exception 'ความเสียหายพนักงานต้องเลือกกะเช้า 08:00–20:00 หรือกะดึก 20:00–08:00';
  end if;
  return new;
end $$;

drop trigger if exists damages_work_shift_guard on public.damages;
create trigger damages_work_shift_guard before insert on public.damages
for each row execute function public.enforce_damage_work_shift();

revoke all on function public.enforce_damage_work_shift() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
