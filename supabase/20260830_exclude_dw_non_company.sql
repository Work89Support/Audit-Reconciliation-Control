-- DW is a deposit/withdraw direction marker in file names, not an audit company.
-- Preserve the old row as history, but never show or queue it as a company again.

begin;

update public.audit_companies
set active=false,
    updated_at=now()
where upper(code)='DW';

update public.daily_recon_jobs
set is_archived=true,
    archived_at=coalesce(archived_at,now()),
    archived_from_status=coalesce(archived_from_status,status),
    archive_reason='DW เป็นรหัสทิศทางฝาก-ถอน ไม่ใช่บริษัทที่ต้องรอไฟล์',
    claimed_at=null,
    claimed_by=null,
    updated_at=now()
where upper(company)='DW'
  and not is_archived;

create or replace function public.apply_daily_recon_operating_scope()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_start date;
  v_is_company boolean;
begin
  select operational_start_date into v_start
  from public.audit_runtime_settings
  where id=true;

  select exists(
    select 1
    from public.audit_companies c
    where c.active and upper(c.code)=upper(new.company)
  ) into v_is_company;

  if not coalesce(v_is_company,false) then
    new.is_archived:=true;
    new.archived_at:=coalesce(new.archived_at,now());
    new.archived_from_status:=coalesce(new.archived_from_status,new.status);
    new.archive_reason:=coalesce(
      new.archive_reason,
      'ไม่ใช่บริษัทในขอบเขตตรวจสอบ 9 บริษัท'
    );
    new.claimed_at:=null;
    new.claimed_by:=null;
  elsif v_start is not null and new.business_date < v_start then
    new.is_archived:=true;
    new.archived_at:=coalesce(new.archived_at,now());
    new.archived_from_status:=coalesce(new.archived_from_status,new.status);
    new.archive_reason:=coalesce(
      new.archive_reason,
      'ข้อมูลก่อนวันเริ่มรอบปฏิบัติงานใหม่'
    );
  end if;

  return new;
end;
$$;

-- Re-run the trigger for any other legacy pseudo-company rows without deleting
-- their audit history.
update public.daily_recon_jobs j
set updated_at=now()
where not exists (
  select 1
  from public.audit_companies c
  where c.active and upper(c.code)=upper(j.company)
);

create or replace function public.refresh_daily_recon_jobs(
  p_from date default current_date-7,
  p_to date default current_date
)
returns setof public.daily_recon_jobs
language plpgsql
security definer
set search_path=public
as $$
declare
  r record;
begin
  for r in
    select distinct
      b.business_date,
      c.code as company
    from public.mail_batches b
    join public.source_files f on f.batch_id=b.id
    join public.audit_companies c
      on c.active
     and upper(c.code)=upper(coalesce(nullif(f.company,''),nullif(b.company,'')))
    where b.business_date between p_from and p_to
  loop
    return next public.refresh_daily_recon_job(r.business_date,r.company);
  end loop;
end;
$$;

revoke all on function public.refresh_daily_recon_jobs(date,date) from public;
grant execute on function public.refresh_daily_recon_jobs(date,date) to authenticated;

commit;
