-- Keep the dedicated Audit assistant role distinct from company responders.
-- current_app_role() intentionally maps audit_assistant to monitor for legacy
-- RLS. Role-sensitive clarification reads must therefore also inspect the raw
-- profile role. No company scope is added and no case data is changed here.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $account$
declare p public.app_profiles%rowtype;
begin
  select * into p
  from public.app_profiles
  where lower(email)='audit123g@gmail.com'
  for update;

  if p.user_id is null then raise exception 'Audit assistant account not found'; end if;
  if not p.active then raise exception 'Audit assistant account is inactive'; end if;
  if p.role is distinct from 'audit_assistant' then
    update public.app_profiles set role='audit_assistant',updated_at=now() where user_id=p.user_id;
    insert into public.audit_log(actor,actor_user_id,action,entity,target,detail)
    values('authorized role repair',p.user_id,'update','user_access',p.email,
      coalesce(p.role,'null')||' -> audit_assistant; company scope preserved');
  end if;
end $account$;

create or replace function public.case_clarification_instructions(p_exception_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare e public.exceptions; v_role text; v_raw_role text;
begin
  v_role:=public.current_app_role();
  select role into v_raw_role from public.app_profiles where user_id=auth.uid() and active;
  select * into e from public.exceptions where id=p_exception_id;
  if auth.uid() is null or not public.current_user_active() or e.id is null
     or not public.has_company_access(e.company)
     or (coalesce(v_role,'') not in ('monitor','lead','admin','shift_lead')
         and coalesce(v_raw_role,'')<>'audit_assistant') then
    raise exception 'ไม่มีสิทธิ์อ่านคำขอชี้แจงของเคสนี้' using errcode='42501';
  end if;
  if v_raw_role='shift_lead' and e.requested_at is null and e.status not in ('clarifying','answered') then
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

notify pgrst,'reload schema';
commit;
