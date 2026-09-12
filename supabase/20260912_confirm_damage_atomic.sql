-- Apply before deploying the confirmDamage client. No cases are changed by installation.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
-- Abort rather than delete/merge any pre-existing duplicates.
create unique index if not exists damages_one_per_exception_idx
  on public.damages(exception_id) where exception_id is not null;

create or replace function public.confirm_damage(
  p_exception_id uuid, p_previous_status text, p_amount numeric, p_cause text
) returns setof public.damages
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  e public.exceptions%rowtype;
  d public.damages%rowtype;
begin
  if auth.uid() is null or not public.current_user_active()
     or coalesce(public.current_app_role(),'') not in ('lead','admin') then
    raise exception 'ไม่มีสิทธิ์ยืนยันความเสียหาย' using errcode='42501';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount >= 100000000000000
     or p_amount <> round(p_amount,2) or p_amount::text in ('NaN','Infinity','-Infinity') then
    raise exception 'ยอดเสียหายต้องมากกว่า 0 และไม่เกิน 2 ตำแหน่งทศนิยม';
  end if;
  if p_cause is null or p_cause !~ '^\[damage:v1:(employee(:X[135])?|system|external)\] .+'
     or length(btrim(regexp_replace(p_cause, '^\[[^]]+\] ', ''))) = 0 then
    raise exception 'ต้องเลือกประเภทและระบุเหตุผล';
  end if;
  select * into e from public.exceptions where id=p_exception_id for update;
  if not found or not public.has_company_access(e.company) then
    raise exception 'ไม่พบเคสหรือไม่มีสิทธิ์' using errcode='42501';
  end if;
  select * into d from public.damages where exception_id=e.id;
  if found then
    if e.status='damage' and d.amount_thb=p_amount and d.cause=p_cause then
      return next d; return; -- Same confirmed request retried after a lost response.
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
  insert into public.damages(code,exception_id,business_date,company,employee,shift,
    amount,currency,fx_rate,amount_thb,cause,cycle,has_evidence,hr_status,finance_status)
  values('DMG-'||e.id,e.id,e.business_date,e.company,e.employee,e.shift,
    p_amount,'THB',1,p_amount,p_cause,
    case when extract(day from e.business_date)<=15 then 'C1'
         when extract(day from e.business_date)<=25 then 'C2' else 'C3' end,
    true,'ยังไม่ส่งบุคคล','รอปิดรอบ') returning * into d;
  update public.exceptions set status='damage',updated_at=now() where id=e.id;
  if not found then raise exception 'เปลี่ยนสถานะไม่ได้'; end if;
  return next d;
end;
$$;
revoke all on function public.confirm_damage(uuid,text,numeric,text) from public;
-- Supabase default privileges can grant anon explicitly, independently of PUBLIC.
revoke all on function public.confirm_damage(uuid,text,numeric,text) from anon;
grant execute on function public.confirm_damage(uuid,text,numeric,text) to authenticated;
notify pgrst,'reload schema';
commit;
