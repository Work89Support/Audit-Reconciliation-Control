-- Explicitly approved recovery for old document requests. No manual-pair/loss permission change.
begin;
set local lock_timeout='5s';
create or replace function public.approve_own_document_closure(p_id uuid,p_note text default null)
returns public.case_closure_requests language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.case_closure_requests%rowtype; e public.exceptions%rowtype; old_origin text;
begin
 if auth.uid() is null or not public.current_user_active() or coalesce(public.current_app_role(),'') not in('lead','admin')
 then raise exception 'เฉพาะหัวหน้า / ผู้ดูแลระบบตรวจปิดคำขอเอกสารของตัวเองได้' using errcode='42501'; end if;
 select * into q from public.case_closure_requests where id=p_id;
 if not found or q.requested_by<>auth.uid() or not public.has_company_access(q.company)
 then raise exception 'ไม่พบคำขอเอกสารของบัญชีนี้' using errcode='42501'; end if;
 select * into e from public.exceptions where id=q.exception_id for update;
 select * into q from public.case_closure_requests where id=p_id for update;
 if q.requested_by<>auth.uid() or q.outcome<>'no_loss' or q.loss_amount<>0
 then raise exception 'ทางนี้ใช้ได้เฉพาะคำขอเอกสาร ไม่เสียหาย 0 บาท'; end if;
 if q.status='approved' and q.decided_by=auth.uid() then return q; end if;
 if q.status<>'pending' or q.review_origin not in('audit_submission','head_direct')
 or e.status<>'answered' or e.case_closure_request_id is distinct from q.id
 or e.manual_pair_id is not null or e.superseded_by_exception_id is not null
 then raise exception 'สถานะเปลี่ยน ต้องโหลดเคสใหม่'; end if;
 if not public.case_has_stored_document(e.id) then raise exception 'ต้องมีหลักฐานจริงในคลัง'; end if;
 if not exists(select 1 from public.daily_recon_jobs j where not j.is_archived and j.company=e.company
 and j.business_date=e.business_date and j.last_run_id=e.run_id)
 then raise exception 'เคสไม่ใช่ผลรันที่ระบบรับไว้'; end if;
 old_origin:=q.review_origin;
 update public.case_closure_requests set review_origin='head_direct' where id=q.id;
 -- Existing decision routine still validates immutable source, document, amounts and damages.
 q:=public.decide_case_closure(q.id,'approve',p_note);
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail)
 values(auth.uid()::text,auth.uid(),'head_legacy_document_approve','case_closure_request',q.id::text,
 'Explicit head document review; original requester retained; previous origin: '||old_origin);
 return q;
end $$;
revoke all on function public.approve_own_document_closure(uuid,text) from public,anon;
grant execute on function public.approve_own_document_closure(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
