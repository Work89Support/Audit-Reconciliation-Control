-- Admin-only password provisioning. No passwords are stored in application tables/logs.
begin;
create table public.password_account_operations (
 id uuid primary key,actor uuid not null references auth.users(id),email text not null,
 action text not null check(action in ('create','reset')),full_name text not null,
 companies text[] not null,reason text not null,status text not null default 'processing',
 user_id uuid references auth.users(id),created_at timestamptz not null default now()
);
create unique index password_account_processing_email on public.password_account_operations(lower(email)) where status='processing';
alter table public.password_account_operations enable row level security;
revoke all on public.password_account_operations from anon,authenticated;
create table public.password_change_gates (
 user_id uuid primary key references auth.users(id),operation_id uuid not null references public.password_account_operations(id),
 restore_active boolean not null,created_at timestamptz not null default now()
);
alter table public.password_change_gates enable row level security;
revoke all on public.password_change_gates from anon,authenticated;

create function public.password_change_required() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.password_change_gates where user_id=auth.uid())
$$;
revoke all on function public.password_change_required() from public,anon;
grant execute on function public.password_change_required() to authenticated;

-- Preserve the installed role/company policies; add a server-side gate around their SQL bodies.
do $guard$
declare n text; original text; result_type text;
begin
 foreach n in array array['current_user_active','current_app_role','has_company_access'] loop
  select p.prosrc,pg_catalog.format_type(p.prorettype,null) into original,result_type
   from pg_proc p join pg_namespace s on s.oid=p.pronamespace join pg_language l on l.oid=p.prolang
   where s.nspname='public' and p.proname=n and l.lanname='sql';
  if original is null then raise exception 'Unrecognized installed authorization function: %',n;end if;
  original:=regexp_replace(trim(original),';\s*$','');
  execute format('create or replace function public.%I(%s) returns %s language sql stable security definer set search_path=public as %L',
   n,case when n='has_company_access' then 'p_company text' else '' end,result_type,
   'select case when exists(select 1 from public.password_change_gates where user_id=auth.uid()) then '||
   case when result_type='boolean' then 'false' else 'null::text' end||' else ('||original||') end');
 end loop;
end $guard$;

create function public.begin_password_account(p_id uuid,p_actor uuid,p_email text,p_action text,p_name text,p_companies text[],p_reason text) returns jsonb
language plpgsql security definer set search_path=public,auth as $$
declare o public.password_account_operations%rowtype;u uuid;p public.app_profiles%rowtype;scope text[];
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Server only';end if;
 perform 1 from public.app_profiles where user_id=p_actor and active and role='admin' for update;
 if not found or exists(select 1 from public.password_change_gates where user_id=p_actor) then raise exception 'เฉพาะ Admin ที่ใช้งานได้';end if;
 perform pg_advisory_xact_lock(hashtext(lower(trim(p_email))));
 select * into o from public.password_account_operations where id=p_id;
 if found then
  if o.actor<>p_actor or o.email<>lower(trim(p_email)) or o.action<>p_action or o.full_name<>trim(p_name) or o.companies is distinct from p_companies or o.reason<>trim(p_reason) then raise exception 'Request key conflict';end if;
  if o.status<>'completed' then raise exception 'คำขอเดิมยังไม่ยืนยันผล ให้ตรวจบัญชีก่อน ไม่สร้าง/รีเซ็ตซ้ำ';end if;
  return jsonb_build_object('replayed',true,'user_id',o.user_id);
 end if;
 if p_action not in ('create','reset') or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_email)>254 or length(trim(p_name)) not between 1 and 120 or length(trim(p_reason)) not between 10 and 2000 then raise exception 'ข้อมูลไม่ครบ';end if;
 select coalesce(array_agg(distinct upper(trim(c)) order by upper(trim(c))),'{}') into scope from unnest(p_companies) c;
 if cardinality(scope)=0 or exists(select 1 from unnest(scope) c where not exists(select 1 from public.audit_company_file_rules r where r.company=c)) then raise exception 'เลือกบริษัทจากทะเบียนเท่านั้น';end if;
 select id into u from auth.users where lower(email)=lower(trim(p_email));
 if p_action='create' and (u is not null or exists(select 1 from public.app_profiles where lower(email)=lower(trim(p_email)))) then raise exception 'มีบัญชีแล้ว ไม่สร้างซ้ำ ใช้รีเซ็ตรหัสแยก';end if;
 if p_action='reset' then
  if u is null or u=p_actor then raise exception 'ไม่พบผู้ใช้ หรือเป็นบัญชีตนเอง';end if;
  select * into p from public.app_profiles where user_id=u for update;
  if not found or p.role<>'shift_lead' then raise exception 'เมนูนี้รีเซ็ตเฉพาะผู้ชี้แจง ไม่เปลี่ยนสิทธิ์บัญชีอื่น';end if;
 end if;
 insert into public.password_account_operations(id,actor,email,action,full_name,companies,reason,user_id)
 values(p_id,p_actor,lower(trim(p_email)),p_action,trim(p_name),scope,trim(p_reason),u);
 if p_action='reset' then
  insert into public.password_change_gates(user_id,operation_id,restore_active) values(u,p_id,p.active)
   on conflict(user_id) do update set operation_id=p_id,created_at=now();
  update public.app_profiles set active=false,updated_at=clock_timestamp() where user_id=u;
 end if;
 return jsonb_build_object('user_id',u,'replayed',false);
end $$;

create function public.finish_password_account(p_id uuid,p_user uuid) returns jsonb
language plpgsql security definer set search_path=public,auth as $$
declare o public.password_account_operations%rowtype;c text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Server only';end if;
 select * into o from public.password_account_operations where id=p_id for update;
 if not found or o.status<>'processing' then raise exception 'คำขอไม่พร้อม';end if;
 if not exists(select 1 from public.app_profiles where user_id=o.actor and active and role='admin') or exists(select 1 from public.password_change_gates where user_id=o.actor) then raise exception 'สิทธิ์ Admin เปลี่ยน';end if;
 if not exists(select 1 from auth.users where id=p_user and lower(email)=o.email) then raise exception 'ผู้ใช้ไม่ตรงคำขอ';end if;
 if o.action='create' then
  if exists(select 1 from public.app_profiles where user_id=p_user and (active or role<>'monitor' or created_at<o.created_at)) or exists(select 1 from public.user_company_access where user_id=p_user) then raise exception 'ไม่แก้บัญชีเดิม';end if;
  insert into public.app_profiles(user_id,email,full_name,role,active) values(p_user,o.email,o.full_name,'shift_lead',false)
   on conflict(user_id) do update set full_name=o.full_name,role='shift_lead',active=false,updated_at=clock_timestamp();
  foreach c in array o.companies loop insert into public.user_company_access(user_id,company) values(p_user,c);end loop;
  insert into public.password_change_gates(user_id,operation_id,restore_active) values(p_user,p_id,true);
 else
  if o.user_id<>p_user or not exists(select 1 from public.password_change_gates where user_id=p_user and operation_id=p_id) then raise exception 'มีการรีเซ็ตใหม่แทรก';end if;
 end if;
 update public.password_account_operations set status='completed',user_id=p_user where id=p_id;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail,meta) values(o.actor::text,o.actor,'password_account_'||o.action,'user_access',p_user::text,o.reason,jsonb_build_object('operation',p_id,'password_change_required',true));
 return jsonb_build_object('ok',true,'user_id',p_user,'password_change_required',true,'sent_email',false);
end $$;

create function public.password_gate_context(p_user uuid,p_password text,p_session uuid) returns jsonb
language plpgsql security definer set search_path=public,auth,extensions as $$
declare g public.password_change_gates%rowtype;old_hash text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Server only';end if;
 select * into g from public.password_change_gates where user_id=p_user;
 if not found then raise exception 'ไม่มีคำขอเปลี่ยนรหัสครั้งแรก';end if;
 if not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and created_at>=g.created_at) then raise exception 'ต้องเข้าสู่ระบบใหม่หลังรีเซ็ต ไม่ใช้ Session เดิม';end if;
 select encrypted_password into old_hash from auth.users where id=p_user;
 if crypt(p_password,old_hash)=old_hash then raise exception 'ต้องตั้งรหัสใหม่ ไม่ใช้รหัสเริ่มต้นเดิม';end if;
 return jsonb_build_object('operation_id',g.operation_id);
end $$;

create function public.finish_first_password(p_user uuid,p_operation uuid) returns boolean
language plpgsql security definer set search_path=public as $$
declare g public.password_change_gates%rowtype;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Server only';end if;
 select * into g from public.password_change_gates where user_id=p_user for update;
 if not found or g.operation_id<>p_operation or not exists(select 1 from public.password_account_operations where id=p_operation and status='completed') then raise exception 'สถานะเปลี่ยน กรุณาเข้าใหม่';end if;
 update public.app_profiles set active=g.restore_active,updated_at=clock_timestamp() where user_id=p_user;
 delete from public.password_change_gates where user_id=p_user;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail) values(p_user::text,p_user,'first_password_changed','user_access',p_user::text,'ตั้งรหัสส่วนตัวสำเร็จ ไม่เก็บรหัสผ่าน');
 return true;
end $$;
revoke all on function public.begin_password_account(uuid,uuid,text,text,text,text[],text),public.finish_password_account(uuid,uuid),public.password_gate_context(uuid,text,uuid),public.finish_first_password(uuid,uuid) from public,anon,authenticated;
grant execute on function public.begin_password_account(uuid,uuid,text,text,text,text[],text),public.finish_password_account(uuid,uuid),public.password_gate_context(uuid,text,uuid),public.finish_first_password(uuid,uuid) to service_role;
commit;
