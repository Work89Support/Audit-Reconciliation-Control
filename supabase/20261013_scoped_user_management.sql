-- Delegated user administration uses explicit company grants, never legacy lead-wide read access.
begin;
-- Old Admin-only RPCs must fail closed for inactive/missing profiles as well.
-- Patch only the reviewed guard, preserving the deployed function body.
do $guard$
declare signature text;definition text;needle text := 'if public.current_app_role()<>''admin'' then';
begin
 foreach signature in array array['public.admin_list_user_access()','public.admin_upsert_user_access(text,text,text,boolean,text[])'] loop
  if to_regprocedure(signature) is null then raise exception 'Missing required Admin RPC: %',signature;end if;
  definition:=pg_get_functiondef(to_regprocedure(signature));
  if strpos(definition,needle)>0 then
   execute replace(definition,needle,'if not coalesce(public.current_user_active(),false) or coalesce(public.current_app_role(),'''')<>''admin'' then');
  elsif strpos(definition,'coalesce(public.current_app_role(),'''')<>''admin''')=0 or strpos(definition,'coalesce(public.current_user_active(),false)')=0 then
   raise exception 'Unrecognized Admin guard: %; inspect before deployment',signature;
  end if;
 end loop;
end $guard$;
create function public.lead_management_companies(p_actor uuid default auth.uid()) returns text[]
language sql stable security definer set search_path=public as $$
 select coalesce(array_agg(distinct a.company order by a.company),'{}') from public.user_company_access a
 join public.audit_companies c on c.code=a.company and c.active
 join public.app_profiles p on p.user_id=a.user_id and p.active and p.role='lead'
 where a.user_id=p_actor and a.company<>'*'
$$;
revoke all on function public.lead_management_companies(uuid) from public,anon,authenticated;

create function public.lead_can_manage_user(p_actor uuid,p_target uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select p_actor<>p_target and exists(select 1 from public.app_profiles p where p.user_id=p_actor and p.active and p.role='lead')
 and exists(select 1 from public.app_profiles p where p.user_id=p_target and p.role in ('monitor','audit_assistant','shift_lead'))
 and exists(select 1 from public.user_company_access a where a.user_id=p_target)
 and not exists(select 1 from public.user_company_access a where a.user_id=p_target and not (a.company=any(public.lead_management_companies(p_actor))))
$$;
revoke all on function public.lead_can_manage_user(uuid,uuid) from public,anon,authenticated;

create function public.lead_user_management_context() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if not coalesce(public.current_user_active(),false) or coalesce(public.current_app_role(),'')<>'lead' then raise exception 'เฉพาะหัวหน้าที่เปิดใช้งาน';end if;
 return jsonb_build_object('companies',to_jsonb(public.lead_management_companies()),'roles',jsonb_build_array('monitor','audit_assistant','shift_lead'),
 'users',(select coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'email',p.email,'full_name',p.full_name,'role',p.role,'active',p.active,'revision',p.updated_at,
 'companies',(select jsonb_agg(a.company order by a.company) from public.user_company_access a where a.user_id=p.user_id)) order by p.full_name),'[]')
 from public.app_profiles p where public.lead_can_manage_user(auth.uid(),p.user_id)));
end $$;

create function public.lead_update_user_access(p_target uuid,p_revision timestamptz,p_name text,p_role text,p_active boolean,p_companies text[],p_reason text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare before_profile jsonb;before_scope jsonb;scope text[];company_code text;
begin
 perform 1 from public.app_profiles where user_id=auth.uid() for update;
 if not coalesce(public.current_user_active(),false) or coalesce(public.current_app_role(),'')<>'lead' then raise exception 'เฉพาะหัวหน้าที่เปิดใช้งาน';end if;
 if p_target=auth.uid() then raise exception 'หัวหน้าไม่สามารถแก้สิทธิ์ตัวเอง';end if;
 perform 1 from public.app_profiles where user_id=p_target for update;
 if not coalesce(public.lead_can_manage_user(auth.uid(),p_target),false) then raise exception 'ผู้ใช้นี้อยู่นอกขอบเขตหรือเป็นบทบาทที่หัวหน้าจัดการไม่ได้';end if;
 if not exists(select 1 from public.app_profiles where user_id=p_target and updated_at=p_revision) then raise exception 'ข้อมูลสิทธิ์เปลี่ยนแล้ว กรุณาโหลดใหม่';end if;
 if p_role not in ('monitor','audit_assistant','shift_lead') or p_role is null then raise exception 'หัวหน้าสร้าง Admin/หัวหน้า/ผู้บริหารไม่ได้';end if;
 if length(trim(coalesce(p_name,''))) not between 1 and 120 or length(trim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception 'ระบุชื่อและเหตุผลอย่างน้อย 10 ตัวอักษร';end if;
 select coalesce(array_agg(distinct upper(trim(c))),'{}') into scope from unnest(coalesce(p_companies,'{}')) c;
 if cardinality(scope)=0 or exists(select 1 from unnest(scope) c where not (c=any(public.lead_management_companies()))) then raise exception 'เลือกบริษัทภายในขอบเขตหัวหน้าเท่านั้น ไม่ใช้ *';end if;
 select to_jsonb(p) into before_profile from public.app_profiles p where user_id=p_target;
 select jsonb_agg(to_jsonb(a)) into before_scope from public.user_company_access a where user_id=p_target;
 update public.app_profiles set full_name=trim(p_name),role=p_role,active=coalesce(p_active,false),updated_at=clock_timestamp() where user_id=p_target;
 delete from public.user_company_access where user_id=p_target;
 foreach company_code in array scope loop insert into public.user_company_access(user_id,company) values(p_target,company_code);end loop;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail,meta)
 values(auth.uid()::text,auth.uid(),'lead_update_user_access','user_access',p_target::text,trim(p_reason),jsonb_build_object('before_profile',before_profile,'before_scope',before_scope,'after_role',p_role,'after_active',p_active,'after_companies',scope));
 return public.lead_user_management_context();
end $$;

create table public.scoped_user_invites(
 id uuid primary key default gen_random_uuid(),request_key uuid not null unique,actor uuid not null references public.app_profiles(user_id),
 email text not null,full_name text not null,role text not null check(role in ('monitor','audit_assistant','shift_lead')),
 companies text[] not null,active boolean not null,reason text not null,
 status text not null default 'pending' check(status in ('pending','processing','completed','failed')),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '5 minutes',
 new_user_id uuid references auth.users(id),completed_at timestamptz,error text
);
alter table public.scoped_user_invites enable row level security;
revoke all on public.scoped_user_invites from authenticated,anon;

create function public.prepare_scoped_user_invite(p_request_key uuid,p_email text,p_name text,p_role text,p_companies text[],p_active boolean,p_reason text) returns public.scoped_user_invites
language plpgsql security definer set search_path=public as $$
declare ticket public.scoped_user_invites%rowtype;scope text[];
begin
 perform 1 from public.app_profiles where user_id=auth.uid() for update;
 if not coalesce(public.current_user_active(),false) or coalesce(public.current_app_role(),'')<>'lead' then raise exception 'เฉพาะหัวหน้าที่เปิดใช้งาน';end if;
 select coalesce(array_agg(distinct upper(trim(c)) order by upper(trim(c))),'{}') into scope from unnest(coalesce(p_companies,'{}')) c;
 select * into ticket from public.scoped_user_invites where request_key=p_request_key;
 if found then
  if ticket.actor is distinct from auth.uid() or ticket.email is distinct from lower(trim(p_email)) or ticket.full_name is distinct from trim(p_name) or ticket.role is distinct from p_role or ticket.companies is distinct from scope or ticket.active is distinct from p_active or ticket.reason is distinct from trim(p_reason) then raise exception 'Request key conflict';end if;
  return ticket;
 end if;
 if p_role is null or p_role not in ('monitor','audit_assistant','shift_lead') then raise exception 'หัวหน้าสร้าง Admin/หัวหน้า/ผู้บริหารไม่ได้';end if;
 if lower(trim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_email)>254 or length(trim(coalesce(p_name,''))) not between 1 and 120 or length(trim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception 'ข้อมูลผู้ใช้หรือเหตุผลไม่ครบ';end if;
 if exists(select 1 from public.app_profiles where lower(email)=lower(trim(p_email))) or exists(select 1 from auth.users where lower(email)=lower(trim(p_email))) then raise exception 'มีผู้ใช้นี้แล้ว ใช้แก้ไขรายการเดิม ไม่ส่งคำเชิญซ้ำ';end if;
 if (select count(*) from public.scoped_user_invites where actor=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'ส่งคำขอครบ 20 ครั้งในชั่วโมงนี้ กรุณารอหรือให้ Admin ตรวจ';end if;
 select coalesce(array_agg(distinct upper(trim(c)) order by upper(trim(c))),'{}') into scope from unnest(coalesce(p_companies,'{}')) c;
 if cardinality(scope)=0 or exists(select 1 from unnest(scope) c where not (c=any(public.lead_management_companies()))) then raise exception 'เลือกบริษัทภายในขอบเขตหัวหน้าเท่านั้น ไม่ใช้ *';end if;
 insert into public.scoped_user_invites(request_key,actor,email,full_name,role,companies,active,reason)
 values(p_request_key,auth.uid(),lower(trim(p_email)),trim(p_name),p_role,scope,coalesce(p_active,false),trim(p_reason)) returning * into ticket;
 return ticket;
end $$;

create function public.claim_scoped_user_invite(p_ticket uuid) returns public.scoped_user_invites
language plpgsql security definer set search_path=public as $$
declare t public.scoped_user_invites%rowtype;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Server only';end if;
 select * into t from public.scoped_user_invites where id=p_ticket for update;
 if not found then raise exception 'ไม่พบคำขอ';end if;
 if t.status='completed' then return t;end if;
 if t.status<>'pending' or t.expires_at<now() then raise exception 'คำขอถูกส่งแล้วหรือหมดเวลา อย่าส่งซ้ำ ให้ Admin ตรวจสถานะ';end if;
 perform 1 from public.app_profiles where user_id=t.actor for update;
 if not exists(select 1 from public.app_profiles where user_id=t.actor and active and role='lead') or exists(select 1 from unnest(t.companies) c where not(c=any(public.lead_management_companies(t.actor)))) then raise exception 'สิทธิ์หัวหน้าเปลี่ยนแล้ว';end if;
 update public.scoped_user_invites set status='processing' where id=p_ticket returning * into t;return t;
end $$;

create function public.finish_scoped_user_invite(p_ticket uuid,p_user uuid) returns jsonb
language plpgsql security definer set search_path=public,auth as $$
declare t public.scoped_user_invites%rowtype;company_code text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Server only';end if;
 select * into t from public.scoped_user_invites where id=p_ticket for update;
 if not found then raise exception 'ไม่พบคำขอ';end if;
 if t.status='completed' and t.new_user_id=p_user then return jsonb_build_object('ok',true,'user_id',p_user);end if;
 if t.status<>'processing' or t.expires_at<now() or p_user=t.actor then raise exception 'คำขอไม่พร้อมหรือหมดเวลา';end if;
 perform 1 from public.app_profiles where user_id=t.actor for update;
 if not exists(select 1 from public.app_profiles where user_id=t.actor and active and role='lead') or exists(select 1 from unnest(t.companies) c where not(c=any(public.lead_management_companies(t.actor)))) then raise exception 'สิทธิ์หัวหน้าเปลี่ยนแล้ว ไม่เปิดสิทธิ์บัญชีใหม่';end if;
 if not exists(select 1 from auth.users where id=p_user and lower(email)=t.email and created_at>=t.created_at) then raise exception 'บัญชีไม่ใช่ผู้ใช้ใหม่ของคำขอนี้';end if;
 perform 1 from public.app_profiles where user_id=p_user for update;
 if exists(select 1 from public.app_profiles where user_id=p_user and (active or role<>'monitor' or created_at<t.created_at)) or exists(select 1 from public.user_company_access where user_id=p_user) then raise exception 'ไม่แก้สิทธิ์บัญชีที่มีอยู่เดิม';end if;
 insert into public.app_profiles(user_id,email,full_name,role,active) values(p_user,t.email,t.full_name,t.role,false)
 on conflict(user_id) do update set full_name=t.full_name,role=t.role,active=false,updated_at=clock_timestamp();
 foreach company_code in array t.companies loop insert into public.user_company_access(user_id,company) values(p_user,company_code);end loop;
 update public.app_profiles set active=t.active,updated_at=clock_timestamp() where user_id=p_user;
 update public.scoped_user_invites set status='completed',new_user_id=p_user,completed_at=clock_timestamp() where id=p_ticket;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail,meta) values(t.actor::text,t.actor,'lead_create_user','user_access',p_user::text,t.reason,jsonb_build_object('ticket',t.id,'role',t.role,'companies',t.companies,'active',t.active));
 return jsonb_build_object('ok',true,'user_id',p_user);
end $$;

revoke all on function public.lead_user_management_context(),public.lead_update_user_access(uuid,timestamptz,text,text,boolean,text[],text),public.prepare_scoped_user_invite(uuid,text,text,text,text[],boolean,text) from public,anon;
grant execute on function public.lead_user_management_context(),public.lead_update_user_access(uuid,timestamptz,text,text,boolean,text[],text),public.prepare_scoped_user_invite(uuid,text,text,text,text[],boolean,text) to authenticated;
revoke all on function public.claim_scoped_user_invite(uuid),public.finish_scoped_user_invite(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_scoped_user_invite(uuid),public.finish_scoped_user_invite(uuid,uuid) to service_role;
commit;
