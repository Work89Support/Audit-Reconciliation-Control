-- All-company handoff. Definitions only: no historical backfill or live case writes.
begin;
set local lock_timeout='5s';

-- Explicit final confirmation accepts the report AND materializes its cases in
-- the same transaction. Any stale source, invalid row, or duplicate rolls back
-- the entire operation. Keep the legacy report-only endpoint unchanged.
create or replace function public.accept_manual_primary_with_cases(
 p_id uuid,p_token text,p_reason text,p_reviewed boolean
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare accepted jsonb; preview jsonb; activated jsonb; version_id uuid;
begin
 accepted:=public.accept_manual_primary(p_id,p_token,p_reason,p_reviewed);
 version_id:=(accepted->>'id')::uuid;
 preview:=public.manual_primary_cases_preview(version_id);
 activated:=public.activate_manual_primary_cases(version_id,preview->>'token',p_reason,p_reviewed);
 return accepted||jsonb_build_object('case_set',activated,'cases_ready',true);
end $$;
revoke all on function public.accept_manual_primary_with_cases(uuid,text,text,boolean) from public,anon;
grant execute on function public.accept_manual_primary_with_cases(uuid,text,text,boolean) to authenticated;

-- A completed newer system run already has its own persisted cases. Do not
-- duplicate them, or let an older manual case-set hide that newer run.
create or replace function public.read_manual_primary(p_company text,p_date date) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v public.manual_primary_results; j public.daily_recon_jobs;
begin
 if not coalesce(public.current_user_active(),false) or not coalesce(public.has_company_access(p_company),false) then raise exception 'ไม่มีสิทธิ์บริษัท';end if;
 select * into v from public.manual_primary_results where company=p_company and business_date=p_date order by accepted_at desc,id desc limit 1;
 if v.id is null then return null;end if;
 select * into j from public.daily_recon_jobs where company=p_company and business_date=p_date and not is_archived;
 if j.last_run_id is distinct from v.base_run_id and j.status='completed' and coalesce(j.error_count,0)=0
 and exists(select 1 from public.recon_runs r where r.id=j.last_run_id and r.company=p_company and r.business_date=p_date)
 then return null;end if;
 if j.last_run_id is distinct from v.base_run_id or v.source_stamp<>public.manual_primary_sources(public.effective_audit_source_files(p_company,p_date)) then
 return jsonb_build_object('stale',true,'id',v.id,'message','ผลหลักตรวจมือมีไฟล์/รอบใหม่ ต้องรันทบทวนใหม่');end if;
 return to_jsonb(v)-'source_stamp';
end $$;

create or replace function public.primary_case_is_current(p_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(
 select 1 from public.exceptions e
 left join lateral (select v.id,v.base_run_id from public.manual_primary_results v
   where v.company=e.company and v.business_date=e.business_date order by v.accepted_at desc,v.id desc limit 1) m on true
 left join public.daily_recon_jobs j on j.company=e.company and j.business_date=e.business_date and not j.is_archived
 where e.id=p_id and public.current_user_active() and public.has_company_access(e.company)
 and case
   when m.id is null then true -- retain the existing system lifecycle outside manual scopes
   when j.id is not null and j.last_run_id is not distinct from m.base_run_id then exists(
     select 1 from public.manual_primary_case_items i where i.primary_id=m.id and i.exception_id=e.id)
   else j.status='completed' and coalesce(j.error_count,0)=0 and e.run_id=j.last_run_id
     and e.customer_details->>'manual_primary_id' is null
     and exists(select 1 from public.recon_runs r where r.id=j.last_run_id and r.company=e.company and r.business_date=e.business_date)
 end)
$$;
revoke all on function public.read_manual_primary(text,date),public.primary_case_is_current(uuid) from public,anon;
grant execute on function public.read_manual_primary(text,date),public.primary_case_is_current(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
