-- Let a lead/admin correct an existing employee and work shift while closing
-- an employee-damage case. The change stays atomic with closure and records
-- both the previous and confirmed responsibility in the audit log.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create or replace function public.close_document_case_with_responsibility(
  p_id uuid,p_case uuid,p_outcome text,p_amount numeric,p_reason text,p_category text,
  p_employee text,p_shift text
) returns public.case_closure_requests
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  e public.exceptions%rowtype;
  q public.case_closure_requests%rowtype;
  role_value text := coalesce(public.current_app_role(),'');
  old_employee text;
  old_shift text;
  responsibility_changed boolean;
begin
 if auth.uid() is null or not public.current_user_active()
 or (role_value not in ('lead','admin') and not public.current_audit_assistant())
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

 old_employee:=coalesce(nullif(btrim(e.employee),''),'-');
 old_shift:=coalesce(nullif(btrim(e.shift),''),'-');
 responsibility_changed:=old_employee is distinct from btrim(p_employee)
   or old_shift is distinct from btrim(p_shift);

 if responsibility_changed
 and old_employee not in ('-','ไม่ระบุ','รอยืนยันผู้เกี่ยวข้อง')
 and role_value not in ('lead','admin')
 then raise exception 'ผู้เกี่ยวข้องเดิมเปลี่ยนได้เฉพาะหัวหน้า/Admin กรุณาให้หัวหน้าตรวจหลักฐาน'; end if;
 if responsibility_changed
 and old_shift not in ('-','รอยืนยันกะ')
 and role_value not in ('lead','admin')
 then raise exception 'กะเดิมเปลี่ยนได้เฉพาะหัวหน้า/Admin กรุณาให้หัวหน้าตรวจหลักฐาน'; end if;

 update public.exceptions
 set employee=btrim(p_employee),shift=btrim(p_shift),updated_at=now()
 where id=e.id;

 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail)
 values(
   auth.uid()::text,
   auth.uid(),
   case when responsibility_changed then 'case_responsibility_correct' else 'case_responsibility_confirm' end,
   'exception',
   e.id::text,
   case when responsibility_changed
     then format('หัวหน้า/Admin แก้ผู้เกี่ยวข้องและกะจากหลักฐาน: %s / %s -> %s / %s',old_employee,old_shift,btrim(p_employee),btrim(p_shift))
     else 'ยืนยันผู้เกี่ยวข้องและกะจากหลักฐานก่อนปิดความเสียหายพนักงาน'
   end
 );
 return public.close_document_case(p_id,p_case,p_outcome,p_amount,p_reason,p_category);
end $$;

revoke all on function public.close_document_case_with_responsibility(uuid,uuid,text,numeric,text,text,text,text) from public,anon;
grant execute on function public.close_document_case_with_responsibility(uuid,uuid,text,numeric,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
