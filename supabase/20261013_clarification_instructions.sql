-- Expose only Audit's company-scoped clarification instructions, never the Audit log.
-- No case, amount, evidence or damage record is changed by this migration.
begin;
create or replace function public.case_clarification_instructions(p_exception_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare e public.exceptions; v_role text;
begin
 v_role:=public.current_app_role();
 select * into e from public.exceptions where id=p_exception_id;
 if auth.uid() is null or not public.current_user_active() or e.id is null
    or not public.has_company_access(e.company)
    or coalesce(v_role,'') not in ('monitor','lead','admin','shift_lead') then
   raise exception 'ไม่มีสิทธิ์อ่านคำขอชี้แจงของเคสนี้';
 end if;
 if v_role='shift_lead' and e.requested_at is null and e.status not in ('clarifying','answered') then
   return '[]'::jsonb;
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'by',a.actor,'at',a.at,'text',a.detail)
   order by a.at,a.id) from public.audit_log a
   join public.app_profiles p on p.user_id=a.actor_user_id
   where a.entity='exception' and a.action='case_note' and a.target=e.id::text
     and p.role in ('monitor','audit_assistant','lead','admin')
     and nullif(btrim(a.detail),'') is not null
     and (a.meta->>'audience'='clarification_company'
       or (a.meta->>'audience' is null and e.requested_at is not null and a.at<=e.requested_at))), '[]'::jsonb);
end $$;
revoke all on function public.case_clarification_instructions(uuid) from public,anon;
grant execute on function public.case_clarification_instructions(uuid) to authenticated;
create or replace function public.append_clarification_instruction(p_exception_id uuid,p_text text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare e public.exceptions; a public.audit_log; p public.app_profiles;
begin
 select * into p from public.app_profiles where user_id=auth.uid() and active;
 select * into e from public.exceptions where id=p_exception_id for update;
 if auth.uid() is null or p.user_id is null or p.role not in ('monitor','audit_assistant','lead','admin')
    or e.id is null or not public.has_company_access(e.company) then
   raise exception 'ไม่มีสิทธิ์บันทึกคำขอชี้แจงของเคสนี้';
 end if;
 if e.status in ('closed','approved','damage') then raise exception 'เคสนี้ปิดแล้ว ดูประวัติเดิมได้ แต่เพิ่มคำขอชี้แจงไม่ได้'; end if;
 if coalesce(length(btrim(p_text)),0) not between 1 and 2000 then raise exception 'กรอกรายละเอียดคำขอ 1–2,000 ตัวอักษร'; end if;
 insert into public.audit_log(actor,actor_user_id,company,action,entity,target,detail,meta)
 values(coalesce(nullif(p.full_name,''),p.email),auth.uid(),e.company,'case_note','exception',e.id::text,btrim(p_text),jsonb_build_object('audience','clarification_company')) returning * into a;
 return jsonb_build_object('id',a.id,'by',a.actor,'at',a.at,'text',a.detail);
end $$;
revoke all on function public.append_clarification_instruction(uuid,text) from public,anon;
grant execute on function public.append_clarification_instruction(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
