-- เปลี่ยนเฉพาะฟังก์ชันรับงานล้มเหลว ไม่แก้ผล เคส ไฟล์ หรือทะเบียนพักเดิม
begin;
set local lock_timeout='5s';
create or replace function public.fail_daily_recon_execution(
 p_execution_id text,p_workflow_id text,p_error text,p_last_node text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.daily_recon_jobs; v_count integer; v_partial boolean; v_status text; v_message text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Worker only'; end if;
 if p_workflow_id is distinct from 'hggaOLqKPXB5roGM' or coalesce(p_execution_id,'')!~'^[0-9]{1,24}$'
 then return jsonb_build_object('status','ignored_unrecognized_execution'); end if;
 perform pg_advisory_xact_lock(hashtext('daily-recon-worker-claim'));
 select count(*) into v_count from public.daily_recon_jobs
 where not is_archived and status='running' and claimed_by='n8n-cloud-worker:'||p_execution_id;
 if v_count=0 then return jsonb_build_object('status','ignored_not_current','execution_id',p_execution_id); end if;
 if v_count<>1 then raise exception 'Ambiguous worker lease'; end if;
 select * into j from public.daily_recon_jobs
 where not is_archived and status='running' and claimed_by='n8n-cloud-worker:'||p_execution_id for update;
 if not found then return jsonb_build_object('status','ignored_not_current','execution_id',p_execution_id); end if;
 -- ถ้ามีผลถูกเขียนบางส่วนแล้ว ต้องพักตรวจ ไม่รันซ้ำและไม่รับรองผลค้างอัตโนมัติ
 select exists(select 1 from public.recon_runs r where r.company=j.company
   and r.business_date=j.business_date and r.summary->>'job_id'=j.id::text
   and r.created_at>=j.claimed_at) into v_partial;
 v_status:=case when v_partial then 'needs_review' when j.attempt_count>=3 then 'error' else 'queued' end;
 v_message:=left('Worker execution '||p_execution_id||' ล้มเหลวที่ '||coalesce(nullif(p_last_node,''),'ไม่ระบุขั้นตอน')||': '||coalesce(nullif(p_error,''),'ไม่ทราบข้อผิดพลาด')
   ||case when v_partial then ' · มีผลบางส่วน ต้องทบทวนก่อนรันต่อ'
           when j.attempt_count>=3 then ' · ครบจำนวนลองอัตโนมัติ ต้องตรวจ Worker ก่อนลองใหม่'
           else ' · คืนคิวโดยเก็บผลและเคสเดิม' end,2000);
 update public.daily_recon_jobs set status=v_status,claimed_at=null,claimed_by=null,
   last_error=v_message,rerun_requested_at=null,updated_at=now()
 where id=j.id and status='running' and claimed_by='n8n-cloud-worker:'||p_execution_id;
 insert into public.audit_log(actor,action,entity,target,company,detail,meta)
 values('n8n:error-finalizer','worker_failure_verified','daily_recon_jobs',j.id::text,j.company,
   v_message,jsonb_build_object('execution_id',p_execution_id,'business_date',j.business_date,
   'stage',p_last_node,'message',p_error,'source_kind','automatic','lease_bound',true,
   'partial_result',v_partial,'next_status',v_status,'cases_changed',0,'source_amounts_changed',0));
 insert into public.recon_notifications(dedupe_key,level,title,detail,business_date,company,job_id)
 values('execution-failure:'||p_execution_id,'error','Worker ล้มเหลวและคืนสถานะแล้ว',v_message,j.business_date,j.company,j.id)
 on conflict(dedupe_key) do nothing;
 return jsonb_build_object('status',v_status,'job_id',j.id,'company',j.company,
   'business_date',j.business_date,'execution_id',p_execution_id,'partial_result',v_partial,
   'cases_changed',0,'source_amounts_changed',0);
end $$;
revoke all on function public.fail_daily_recon_execution(text,text,text,text) from public,anon,authenticated;
grant execute on function public.fail_daily_recon_execution(text,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
