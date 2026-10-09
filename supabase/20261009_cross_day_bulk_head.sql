-- Approved workflow: helpers submit; lead/admin can close their own prepared pairs.
-- Keep all existing source, reservation, role, company and latest-run validation.
begin;
set local lock_timeout='5s';
do $patch$
declare t text;c record;def text;needle text;
begin
 foreach t in array array['cross_day_pair_requests','cross_day_image_reviews'] loop
  for c in select conname from pg_constraint where conrelid=('public.'||t)::regclass
   and contype='c' and pg_get_constraintdef(oid) like '%decided_by%' and pg_get_constraintdef(oid) like '%submitted_by%'
  loop execute format('alter table public.%I drop constraint %I',t,c.conname);end loop;
 end loop;
 def:=pg_get_functiondef('public.decide_cross_day_pair(uuid,text,text)'::regprocedure);
 needle:='if not public.has_company_access(q.company) or q.submitted_by=auth.uid() then';
 if strpos(def,needle)=0 then raise exception 'Unexpected native decision baseline';end if;
 execute replace(def,needle,'if public.has_company_access(q.company) is distinct from true then');
 def:=pg_get_functiondef('public.decide_cross_day_image_review(uuid,text,text)'::regprocedure);
 if strpos(def,needle)=0 then raise exception 'Unexpected image decision baseline';end if;
 execute replace(def,needle,'if public.has_company_access(q.company) is distinct from true then');
end $patch$;
create function public.close_cross_day_pair(p_id uuid,p_case uuid,p_file uuid,p_row integer,p_reason text)
returns public.cross_day_pair_requests language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.cross_day_pair_requests%rowtype;
begin
 if auth.uid() is null or public.current_user_active() is distinct from true
 or coalesce(public.current_app_role(),'') not in('lead','admin') then raise exception 'เฉพาะหัวหน้า / แอดมินปิดคู่โดยตรง' using errcode='42501';end if;
 q:=public.submit_cross_day_pair(p_id,p_case,p_file,p_row,p_reason);
 return public.decide_cross_day_pair(q.id,'approve',p_reason);
end $$;
create function public.close_cross_day_image_review(p_id uuid,p_case uuid,p_file uuid,p_page integer,p_reason text)
returns public.cross_day_image_reviews language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.cross_day_image_reviews%rowtype;
begin
 if auth.uid() is null or public.current_user_active() is distinct from true
 or coalesce(public.current_app_role(),'') not in('lead','admin') then raise exception 'เฉพาะหัวหน้า / แอดมินปิดคู่โดยตรง' using errcode='42501';end if;
 q:=public.submit_cross_day_image_review(p_id,p_case,p_file,p_page,p_reason);
 return public.decide_cross_day_image_review(q.id,'approve',q.reason);
end $$;
revoke all on function public.close_cross_day_pair(uuid,uuid,uuid,integer,text),public.close_cross_day_image_review(uuid,uuid,uuid,integer,text) from public,anon;
grant execute on function public.close_cross_day_pair(uuid,uuid,uuid,integer,text),public.close_cross_day_image_review(uuid,uuid,uuid,integer,text) to authenticated;
notify pgrst,'reload schema';
commit;
