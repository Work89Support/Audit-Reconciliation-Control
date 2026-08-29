-- เริ่มรอบใช้งานจริงวันที่ 27 สิงหาคม 2026
-- ข้อมูลก่อนหน้านี้ยังอยู่ครบ แต่ daily_recon_jobs จะถูกเก็บเป็นประวัติ

begin;

insert into public.audit_runtime_settings
  (id, operational_start_date, history_cutoff_date, note, updated_at)
values
  (true, date '2026-08-27', date '2026-08-26',
   'เก็บข้อมูลถึง 26 สิงหาคม 2569 เป็นประวัติ และเริ่มใช้งานจริงวันที่ 27 สิงหาคม 2569', now())
on conflict (id) do update
set operational_start_date=excluded.operational_start_date,
    history_cutoff_date=excluded.history_cutoff_date,
    note=excluded.note,
    updated_at=now();

update public.daily_recon_jobs j
set is_archived=true,
    archived_at=coalesce(j.archived_at,now()),
    archived_from_status=coalesce(j.archived_from_status,j.status),
    archive_reason='เก็บเป็นประวัติก่อนเริ่มใช้งานจริงวันที่ 27 สิงหาคม 2569',
    claimed_at=null,
    claimed_by=null,
    updated_at=now()
where j.business_date < date '2026-08-27'
  and not j.is_archived;

update public.daily_recon_jobs j
set is_archived=false,
    archived_at=null,
    archived_from_status=null,
    archive_reason=null,
    updated_at=now()
where j.business_date >= date '2026-08-27'
  and j.is_archived;

select public.refresh_daily_recon_jobs(date '2026-08-27', current_date);

commit;
