-- Pausing a company-day must stop an already-created automatic queue as well.
-- This migration changes queue control only. It never updates recon_runs,
-- exceptions, case evidence, amounts, accepted run IDs, or closed-case state.
begin;

create or replace function public.guard_paused_daily_job_queue()
returns trigger language plpgsql security definer set search_path=public as $$
declare previous_status text;previous_run_id uuid;
begin
 if tg_op='UPDATE' then previous_status:=old.status;previous_run_id:=old.last_run_id;end if;
 if public.audit_run_blocked(new.company,new.business_date) then
  -- A late queue refresh or a worker finishing after the hold must not make the
  -- company-day actionable again. Preserve a previously completed job as
  -- completed; otherwise park the control row for human review.
  if new.status in ('ready','queued','running')
   or (new.status='completed' and coalesce(previous_status,'')<>'completed') then
   new.status:=case
    when previous_status='completed' and previous_run_id is not null then 'completed'
    else 'needs_review'
   end;
  end if;
  new.claimed_at:=null;
  new.claimed_by:=null;
  new.rerun_requested_at:=null;
 end if;
 return new;
end $$;

drop trigger if exists audit_hold_daily_job_queue on public.daily_recon_jobs;
create trigger audit_hold_daily_job_queue
before insert or update of status,rerun_requested_at on public.daily_recon_jobs
for each row execute function public.guard_paused_daily_job_queue();

create or replace function public.set_audit_run_hold(p_company text,p_date date,p_paused boolean,p_reason text,p_expected_revision integer)
returns public.audit_run_holds language plpgsql security definer set search_path=public as $$
declare h public.audit_run_holds%rowtype;j public.daily_recon_jobs%rowtype;
 previous_status text;queue_status text;
begin
 if coalesce(public.current_app_role(),'') not in ('lead','admin') or not coalesce(public.current_user_active(),false)
  or not coalesce(public.has_company_access(p_company),false) then raise exception 'เฉพาะหัวหน้า/ผู้ดูแลตามสิทธิ์บริษัท';end if;
 if length(trim(coalesce(p_reason,''))) not between 10 and 2000 or p_paused is null then raise exception 'กรุณาระบุเหตุผล';end if;
 if not exists(select 1 from public.audit_companies where code=p_company and active) or p_date is null then raise exception 'บริษัท/วันที่ไม่ถูกต้อง';end if;
 perform pg_advisory_xact_lock(hashtext('audit-hold:'||p_company||':'||p_date));
 select * into j from public.daily_recon_jobs where company=p_company and business_date=p_date and not is_archived for update;
 previous_status:=j.status;
 select * into h from public.audit_run_holds where company=p_company and business_date=p_date for update;
 if coalesce(h.revision,0) is distinct from p_expected_revision then raise exception 'สถานะพักงานเปลี่ยนแล้ว โหลดใหม่';end if;
 if not p_paused and public.audit_source_scope_managed(p_company,p_date) then
  raise exception 'วัน/บริษัทนี้มีไฟล์เวอร์ชันแก้ไข ใช้ตรวจมือและยืนยันรายงานแยกได้ แต่ยังไม่เปิดบอทเขียนรอบหลัก จนตรวจการเชื่อมเคสเดิมเพื่อป้องกันเคสซ้ำ';
 end if;
 if not p_paused and exists(select 1 from public.audit_source_revisions where company=p_company and business_date=p_date)
 and not exists(select 1 from public.account_recheck_jobs q where q.company=p_company and q.business_date=p_date
  and q.status='confirmed' and q.mode='account' and q.account='ALL' and q.direction='all' and q.base_run_id=j.last_run_id
  and (public.account_recheck_snapshot(p_company,p_date)||jsonb_build_object('effective_files',public.effective_audit_source_files(p_company,p_date)))=q.snapshot)
 then raise exception 'ไฟล์มีการแก้ไข ต้องให้หัวหน้า/ผู้ดูแลตรวจและยืนยันผลทุกบัญชีก่อนเปิดงาน';end if;
 insert into public.audit_run_holds(company,business_date,paused,reason,revision,updated_by)
 values(p_company,p_date,p_paused,trim(p_reason),coalesce(h.revision,0)+1,auth.uid())
 on conflict(company,business_date) do update set paused=excluded.paused,reason=excluded.reason,
 revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now() returning * into h;
 if p_paused then
  -- Preserve the accepted run and every result/case field. Only park the queue
  -- control row and clear future/active claim markers.
  update public.daily_recon_jobs set
   status=case when status='completed' then 'completed' else 'needs_review' end,
   claimed_at=null,claimed_by=null,rerun_requested_at=null,updated_at=now()
  where company=p_company and business_date=p_date and not is_archived
   and (status in ('ready','queued','running') or rerun_requested_at is not null);
  select status into queue_status from public.daily_recon_jobs
   where company=p_company and business_date=p_date and not is_archived;
  update public.account_recheck_jobs set status='failed',error='หยุดโดยหัวหน้า/ผู้ดูแล: '||trim(p_reason),
   revision=revision+1,updated_at=now() where company=p_company and business_date=p_date and status in ('queued','running');
 end if;
 insert into public.audit_log(actor,action,entity,target,company,detail,meta)
 values(auth.uid()::text,case when p_paused then 'pause_reconciliation' else 'resume_reconciliation' end,
 'company_day',p_company||'|'||p_date,p_company,trim(p_reason),jsonb_build_object(
  'revision',h.revision,'queue_status_before',previous_status,'queue_status_after',coalesce(queue_status,previous_status),
  'accepted_result_preserved',true,'cases_unchanged',true));
 return h;
end $$;

revoke all on function public.guard_paused_daily_job_queue() from public,anon,authenticated;
revoke all on function public.set_audit_run_hold(text,date,boolean,text,integer) from public,anon;
grant execute on function public.set_audit_run_hold(text,date,boolean,text,integer) to authenticated;

notify pgrst,'reload schema';
commit;
