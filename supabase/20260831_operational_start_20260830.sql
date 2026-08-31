-- เริ่มรอบใช้งานจริงใหม่วันที่ 30 สิงหาคม 2026
-- เก็บข้อมูลวันที่ 27-29 และข้อมูลเก่ากว่านั้นไว้เป็นประวัติ โดยไม่ลบไฟล์ เมล หรือผลกระทบยอดเดิม

begin;

insert into public.audit_runtime_settings
  (id, operational_start_date, history_cutoff_date, note, updated_at)
values
  (true, date '2026-08-30', date '2026-08-29',
   'เก็บข้อมูลถึง 29 สิงหาคม 2569 เป็นประวัติ และเริ่มรอบใช้งานจริงใหม่วันที่ 30 สิงหาคม 2569', now())
on conflict (id) do update
set operational_start_date=excluded.operational_start_date,
    history_cutoff_date=excluded.history_cutoff_date,
    note=excluded.note,
    updated_at=now();

update public.daily_recon_jobs j
set is_archived=true,
    archived_at=coalesce(j.archived_at,now()),
    archived_from_status=coalesce(j.archived_from_status,j.status),
    archive_reason='เก็บเป็นประวัติก่อนเริ่มรอบใหม่วันที่ 30 สิงหาคม 2569',
    claimed_at=null,
    claimed_by=null,
    updated_at=now()
where j.business_date < date '2026-08-30'
  and not j.is_archived;

update public.daily_recon_jobs j
set is_archived=false,
    archived_at=null,
    archived_from_status=null,
    archive_reason=null,
    updated_at=now()
where j.business_date >= date '2026-08-30'
  and j.is_archived;

select public.refresh_daily_recon_jobs(date '2026-08-30', current_date);

commit;
