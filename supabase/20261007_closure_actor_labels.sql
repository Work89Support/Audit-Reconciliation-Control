-- Presentation-only fix. Do not expand approval rights or rewrite historical closures.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create or replace function public.audit_closer_label() returns text
language sql stable security definer set search_path=public,pg_temp as $$
 select case
 when public.current_app_role()='admin' then 'ผู้ดูแลระบบ'
 when public.current_app_role()='lead' then 'หัวหน้า Audit'
 when public.current_audit_assistant() then 'ผู้ช่วย Audit'
 else 'Audit' end;
$$;
revoke all on function public.audit_closer_label() from public,anon,authenticated;
do $patch$
declare def text; needle text;
begin
 def:=pg_get_functiondef('public.decide_case_closure(uuid,text,text)'::regprocedure);
 needle:='resolution_note=''หัวหน้าอนุมัติ: ''||';
 if strpos(def,needle)=0 then raise exception 'Unrecognized document closure label baseline';end if;
 def:=replace(def,needle,'resolution_note=''ปิดโดย ''||public.audit_closer_label()||'': ''||');
 def:=replace(def,'''หัวหน้าตรวจผล Audit และหลักฐาน อนุมัติปิดเคส''',
 'public.audit_closer_label()||'' ตรวจผล Audit และหลักฐาน อนุมัติปิดเคส''');
 execute def;
 def:=pg_get_functiondef('public.decide_manual_case_pair(uuid,text,text)'::regprocedure);
 needle:='resolution_note=''ปิดคู่โดยหัวหน้าทีม — Audit จับคู่เอง ''||';
 if strpos(def,needle)=0 then raise exception 'Unrecognized manual pair label baseline';end if;
 execute replace(def,needle,'resolution_note=''ปิดคู่โดย ''||public.audit_closer_label()||'' — Audit จับคู่เอง ''||');
end $patch$;
notify pgrst,'reload schema';
commit;
