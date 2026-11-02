-- A reviewed, checksum-bound 7M TMN transcription is effective parser evidence.
-- Resume the affected company/day automatically after approval so an operator
-- does not need to ask for a manual rerun.  This migration never changes a
-- completed/active job, accepted primary result, exception, amount or case.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

alter function public.approve_reviewed_pdf_recovery(jsonb,text)
  rename to approve_reviewed_pdf_recovery_store_20261031;

create or replace function public.queue_reviewed_tmn_recovery(
  p_recovery_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  f public.source_files%rowtype;
  b public.mail_batches%rowtype;
  j public.daily_recon_jobs%rowtype;
  prior_status text;
  queued boolean:=false;
  reason text:='not_eligible';
begin
  if p_recovery_id is null or p_payload is null
     or p_payload->>'company'<>'UFABET7M'
     or p_payload->>'bank'<>'TMN'
     or p_payload->>'sourceType'<>'tmn-screenshot-list-v1' then
    return jsonb_build_object('queued',false,'reason','not_reviewed_7m_tmn');
  end if;

  select * into strict f
  from public.source_files
  where id=(p_payload->>'sourceId')::uuid;
  select * into strict b from public.mail_batches where id=f.batch_id;

  -- The storage function has already validated reviewer access, checksum,
  -- page coverage, unique source-row IDs and controls. Re-check the immutable
  -- source scope before changing only the queue lifecycle.
  if coalesce(f.kind,'')<>'stm_pdf'
     or (p_payload->>'sourceChecksum') is distinct from f.checksum
     or (p_payload->>'businessDate') is distinct from b.business_date::text
     or upper(coalesce(f.company,b.company,''))<>'UFABET7M'
     or not public.audit_source_parse_reviewed(f.id) then
    raise exception 'Reviewed TMN source scope changed; automatic resume stopped';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('tmn-reviewed-resume:UFABET7M:'||b.business_date::text)
  );
  select * into j
  from public.daily_recon_jobs
  where company='UFABET7M' and business_date=b.business_date and not is_archived
  for update;
  if not found then
    reason:='job_not_found';
  elsif exists(
    select 1 from public.audit_run_holds h
    where h.company=j.company and h.business_date=j.business_date and h.paused
  ) then
    reason:='paused';
  elsif j.status not in ('waiting_files','ready','needs_review','error') then
    -- queued/running/completed are deliberately immutable here. In particular,
    -- a reviewed file must not replace an accepted/completed primary result.
    reason:='status_'||j.status;
  else
    prior_status:=j.status;
    select * into j from public.refresh_daily_recon_job(b.business_date,'UFABET7M');
    if jsonb_array_length(coalesce(j.missing_groups,'[]'::jsonb))=0
       and j.file_count>0 and j.parsed_count=j.file_count and j.error_count=0 then
      update public.daily_recon_jobs
         set status='queued',attempt_count=0,last_error=null,
             claimed_at=null,claimed_by=null,rerun_requested_at=now(),updated_at=now()
       where id=j.id
         and status in ('ready','needs_review','error','waiting_files')
       returning * into j;
      queued:=found;
      reason:=case when queued then 'queued' else 'concurrent_status_change' end;
    else
      reason:='quality_gate_incomplete';
    end if;
  end if;

  insert into public.audit_log(
    actor,actor_user_id,action,entity,target,company,detail,meta
  ) values (
    auth.uid()::text,auth.uid(),'reviewed_tmn_auto_resume','daily_recon_jobs',
    coalesce(j.id::text,'UFABET7M|'||b.business_date::text),'UFABET7M',
    case when queued
      then 'หลักฐาน TMN ตรวจครบและผูก checksum แล้ว จัดคิวกระทบยอดอัตโนมัติ'
      else 'บันทึกหลักฐาน TMN แล้ว แต่ไม่เปลี่ยนคิว: '||reason end,
    jsonb_build_object(
      'recovery_id',p_recovery_id,'source_file_id',f.id,
      'business_date',b.business_date,'prior_status',prior_status,
      'result_status',j.status,'queued',queued,'reason',reason,
      'raw_parse_error_preserved',true,'case_writes',0,
      'closed_cases_touched',0,'primary_results_touched',0
    )
  );

  if queued then
    insert into public.recon_notifications(
      dedupe_key,level,title,detail,business_date,company,job_id
    ) values (
      'tmn-reviewed-auto-resume:'||p_recovery_id,'info',
      '7M ตรวจ TMN ครบและเข้าคิวอัตโนมัติ',
      'ระบบจะใช้รายการตาม source row ที่ตรวจครบ โดยไม่รวมยอดซ้ำทิ้ง',
      b.business_date,'UFABET7M',j.id
    ) on conflict(dedupe_key) do nothing;
  end if;

  return jsonb_build_object(
    'queued',queued,'reason',reason,'job_id',j.id,'job_status',j.status
  );
end;
$$;

create or replace function public.approve_reviewed_pdf_recovery(
  p_payload jsonb,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  result_id uuid;
begin
  result_id:=public.approve_reviewed_pdf_recovery_store_20261031(p_payload,p_note);
  perform public.queue_reviewed_tmn_recovery(result_id,p_payload);
  return result_id;
end;
$$;

revoke all on function public.approve_reviewed_pdf_recovery_store_20261031(jsonb,text)
  from public,anon,authenticated;
revoke all on function public.queue_reviewed_tmn_recovery(uuid,jsonb)
  from public,anon,authenticated;
revoke all on function public.approve_reviewed_pdf_recovery(jsonb,text)
  from public,anon;
grant execute on function public.approve_reviewed_pdf_recovery(jsonb,text)
  to authenticated;

notify pgrst,'reload schema';
commit;
