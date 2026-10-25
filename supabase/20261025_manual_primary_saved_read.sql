begin;

create or replace function public.read_manual_primary_saved(p_company text,p_date date) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare
  v public.manual_primary_results;
  j public.daily_recon_jobs;
begin
  if not coalesce(public.current_user_active(),false)
    or not coalesce(public.has_company_access(p_company),false) then
    raise exception 'ไม่มีสิทธิ์บริษัท';
  end if;

  select * into v
  from public.manual_primary_results
  where company=p_company and business_date=p_date
  order by accepted_at desc,id desc
  limit 1;
  if v.id is null then return null; end if;

  select * into j
  from public.daily_recon_jobs
  where company=p_company and business_date=p_date and not is_archived
  limit 1;

  if j.last_run_id is distinct from v.base_run_id
    and j.status='completed'
    and coalesce(j.error_count,0)=0 then
    return null;
  end if;

  return (to_jsonb(v)-'source_stamp') || jsonb_build_object(
    'stale',j.last_run_id is distinct from v.base_run_id,
    'review_needed',true,
    'review_reason','แสดงผลหลักที่ยืนยันไว้แล้ว แต่การตรวจความสดของไฟล์ต้นทางใช้เวลานานเกินกำหนด · ห้ามยืนยันหรือปิดงานจากหน้านี้จนตรวจไฟล์สำเร็จ'
  );
end $$;

revoke all on function public.read_manual_primary_saved(text,date) from public,anon;
grant execute on function public.read_manual_primary_saved(text,date) to authenticated;

commit;
