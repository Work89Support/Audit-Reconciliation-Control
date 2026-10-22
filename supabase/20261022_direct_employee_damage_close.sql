-- Allow a lead/admin to confirm the real employee and shift from evidence in
-- the same transaction that closes an employee-damage case. No amount,
-- source, history, pause state, or unrelated case is changed.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create function public.close_document_case_with_responsibility(
  p_id uuid,p_case uuid,p_outcome text,p_amount numeric,p_reason text,p_category text,
  p_employee text,p_shift text
) returns public.case_closure_requests
language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.exceptions%rowtype; q public.case_closure_requests%rowtype;
begin
 if auth.uid() is null or not public.current_user_active()
 or (coalesce(public.current_app_role(),'') not in ('lead','admin') and not public.current_audit_assistant())
 then raise exception 'เฉพาะหัวหน้า / ผู้มีสิทธิ์ปิดเคสเท่านั้น' using errcode='42501'; end if;

 select * into q from public.case_closure_requests where id=p_id for update;
 if found then return public.close_document_case(p_id,p_case,p_outcome,p_amount,p_reason,p_category); end if;

 select * into e from public.exceptions where id=p_case for update;
 if not found or not public.has_company_access(e.company)
 then raise exception 'ไม่พบเคสหรือไม่มีสิทธิ์บริษัท' using errcode='42501'; end if;
 if p_outcome<>'damage' or p_category<>'employee'
 then raise exception 'การยืนยันผู้เกี่ยวข้องใช้ได้เฉพาะความเสียหายพนักงาน'; end if;
 if coalesce(btrim(p_employee),'') in ('','-','ไม่ระบุ','รอยืนยันผู้เกี่ยวข้อง')
 or coalesce(btrim(p_shift),'') in ('','-','รอยืนยันกะ')
 or length(btrim(p_employee))>200 or length(btrim(p_shift))>32
 then raise exception 'ต้องยืนยันผู้เกี่ยวข้องและกะจริงจากหลักฐาน'; end if;
 if coalesce(btrim(e.employee),'') not in ('','-','ไม่ระบุ','รอยืนยันผู้เกี่ยวข้อง') and btrim(e.employee)<>btrim(p_employee)
 then raise exception 'เคสมีผู้เกี่ยวข้องเดิมต่างจากข้อมูลใหม่ กรุณาโหลดและทบทวนก่อน'; end if;
 if coalesce(btrim(e.shift),'') not in ('','-','รอยืนยันกะ') and btrim(e.shift)<>btrim(p_shift)
 then raise exception 'เคสมีกะเดิมต่างจากข้อมูลใหม่ กรุณาโหลดและทบทวนก่อน'; end if;

 update public.exceptions set employee=btrim(p_employee),shift=btrim(p_shift),updated_at=now() where id=e.id;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail)
 values(auth.uid()::text,auth.uid(),'case_responsibility_confirm','exception',e.id::text,
   'ยืนยันผู้เกี่ยวข้องและกะจากหลักฐานก่อนปิดความเสียหายพนักงาน');
 return public.close_document_case(p_id,p_case,p_outcome,p_amount,p_reason,p_category);
end $$;

revoke all on function public.close_document_case_with_responsibility(uuid,uuid,text,numeric,text,text,text,text) from public,anon;
grant execute on function public.close_document_case_with_responsibility(uuid,uuid,text,numeric,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
