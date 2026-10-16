-- Definitions only: installation does not submit requests or change business rows.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

-- Attachment-only waiting cases still need their FIRST clarification request.
-- Keep the existing resend/SLA rules for every other status and preserve files.
do $patch$
declare body text; anchor text:='if public.case_has_stored_document(old.id) then';
begin
 select pg_get_functiondef('public.set_document_case_deadline()'::regprocedure) into body;
 if position('waiting_cross_day_first_request_v1' in body)=0 then
 if position(anchor in body)=0 then raise exception 'Deadline guard drift: stop installation';end if;
 body:=replace(body,anchor,'if public.case_has_stored_document(old.id) and not (old.status=''pending_next_day'' and old.requested_at is null and old.responded_at is null) /* waiting_cross_day_first_request_v1 */ then');
 execute body;
 end if;
end $patch$;

create or replace function public.waiting_cross_day_clarification_ready(p_case uuid)
returns boolean language sql stable security invoker set search_path=public,pg_temp as $$
 select coalesce(public.can_attach_waiting_cross_day_evidence(p_case),false)
 and exists(select 1 from public.exceptions e where e.id=p_case
 and e.requested_at is null and e.responded_at is null
 and public.account_review_hold_for_case(e.id) is null)
$$;

create or replace function public.request_waiting_cross_day_clarification(p_case uuid)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare e public.exceptions; previous_status text;
begin
 if auth.uid() is null or public.current_user_active() is distinct from true
 or public.current_app_role() not in ('monitor','audit_assistant','lead','admin') then
 raise exception 'ไม่มีสิทธิ์ส่งขอชี้แจง';end if;
 select * into e from public.exceptions where id=p_case for update;
 if not found or public.has_company_access(e.company) is distinct from true then
 raise exception 'ไม่พบเคสในบริษัทที่มีสิทธิ์';end if;
 -- Serialize against reruns/primary changes, in addition to locking this case.
 perform 1 from public.daily_recon_jobs j where j.company=e.company
 and j.business_date=e.business_date and not j.is_archived for share;
 if public.primary_case_is_current(e.id) is distinct from true then
 raise exception 'ผลหลักเปลี่ยน กรุณาเปิดเคสล่าสุด';end if;
 -- A retry never resets the first request, deadline, or existing clarification.
 if e.status='clarifying' and e.requested_at is not null then
 return jsonb_build_object('id',e.id,'status',e.status,'requested_at',e.requested_at,'requested_by',e.requested_by,'replayed',true);end if;
 if public.waiting_cross_day_clarification_ready(e.id) is distinct from true then
 raise exception 'เคสไม่พร้อมส่งขอชี้แจง: ตรวจสถานะ ผลหลัก สิทธิ์ คำขอที่ค้าง หรือทะเบียนพักตรวจ';end if;
 previous_status:=e.status;
 update public.exceptions set status='clarifying',requested_at=now(),requested_by=auth.uid(),updated_at=now()
 where id=e.id and status='pending_next_day' and requested_at is null and responded_at is null
 returning * into e;
 if not found then raise exception 'สถานะเปลี่ยนแล้วหรือไม่มีสิทธิ์แก้เคส';end if;
 insert into public.audit_log(actor,action,entity,target,company,detail,meta)
 values(auth.uid()::text,'request_clarify','exception',e.id::text,e.company,
 'ส่งขอชี้แจงจากเคสรอข้ามวัน — ไม่จับคู่ ไม่เปลี่ยนยอด ไม่ปิดเคส',
 jsonb_build_object('previous_status',previous_status,'status',e.status,'run_id',e.run_id));
 return jsonb_build_object('id',e.id,'status',e.status,'requested_at',e.requested_at,'requested_by',e.requested_by,'replayed',false);
end$$;
revoke all on function public.waiting_cross_day_clarification_ready(uuid) from public,anon;
revoke all on function public.request_waiting_cross_day_clarification(uuid) from public,anon;
grant execute on function public.waiting_cross_day_clarification_ready(uuid) to authenticated;
grant execute on function public.request_waiting_cross_day_clarification(uuid) to authenticated;
commit;
