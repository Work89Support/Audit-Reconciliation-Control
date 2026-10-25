-- Allow a guarded UFABET7M internal-transfer pair to close when one side is
-- clarifying/answered. The validated pair snapshot preserves the prior status,
-- clarification text, files and timestamps for Audit. No case rows are changed by this migration.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $patch$
declare definition text;patched text;
begin
 definition:=pg_get_functiondef('public.submit_manual_case_pair(uuid,uuid,uuid,text,text,uuid)'::regprocedure);
 if position('p_mode=''internal'' and a.status in(''open'',''clarifying'',''answered'')' in definition)>0 then
  patched:=definition;
 else
  patched:=replace(definition,
   'not (((a.status=''open'' or (a.status=''pending_next_day'' and a.ex_type=''cross_day'')) and b.status=''open'') or (a.id=b.id and a.ex_type=''amount_diff'' and a.status in (''clarifying'',''answered'')))',
   'not (((a.status=''open'' or (a.status=''pending_next_day'' and a.ex_type=''cross_day'')) and b.status=''open'') or (p_mode=''internal'' and a.status in(''open'',''clarifying'',''answered'') and b.status in(''open'',''clarifying'',''answered'')) or (a.id=b.id and a.ex_type=''amount_diff'' and a.status in (''clarifying'',''answered'')))');
  if patched=definition then raise exception 'Unexpected submit_manual_case_pair status guard; no changes applied';end if;
 end if;
 if position('p_mode=''internal'' and a.status in(''open'',''clarifying'',''answered'')' in patched)=0
 then raise exception 'Internal status guard missing; no changes applied';end if;
 execute patched;
end $patch$;

do $patch$
declare definition text;patched text;
begin
 definition:=pg_get_functiondef('public.guard_manual_pair_case()'::regprocedure);
 if position('p.mode=''internal'' and old.status in (''open'',''clarifying'',''answered'')' in definition)>0 then
  patched:=definition;
 else
  patched:=replace(definition,
   '(old.status=''open'' or (old.status=''pending_next_day'' and old.id=p.bo_case_id and old.ex_type=''cross_day'') or (p.bo_case_id=p.stm_case_id and old.ex_type=''amount_diff'' and old.status in (''clarifying'',''answered'')))',
   '(old.status=''open'' or (old.status=''pending_next_day'' and old.id=p.bo_case_id and old.ex_type=''cross_day'') or (p.mode=''internal'' and old.status in (''open'',''clarifying'',''answered'')) or (p.bo_case_id=p.stm_case_id and old.ex_type=''amount_diff'' and old.status in (''clarifying'',''answered'')))');
  if patched=definition then raise exception 'Unexpected guard_manual_pair_case status guard; no changes applied';end if;
 end if;
 if position('p.mode=''internal'' and old.status in (''open'',''clarifying'',''answered'')' in patched)=0
 then raise exception 'Internal trigger guard missing; no changes applied';end if;
 execute patched;
end $patch$;

create or replace function public.manual_pair_internal_source_key(e public.exceptions,p_side text)
returns text language sql immutable set search_path=public,pg_temp as $$
 select case when p_side in ('BO','STM') then
  e.company||'|'||e.direction||'|'||e.account||'|'||p_side||'|ROW|'||
  coalesce(nullif(e.customer_details#>>array['source_rows',lower(p_side),'fileId'],'')||':'||
   nullif(e.customer_details#>>array['source_rows',lower(p_side),'row'],''),
   md5(case when p_side='BO' then e.bo_raw else e.stm_raw end))
 end
$$;
revoke all on function public.manual_pair_internal_source_key(public.exceptions,text) from public,anon,authenticated;

do $patch$
declare definition text;patched text;
begin
 definition:=pg_get_functiondef('public.submit_manual_case_pair(uuid,uuid,uuid,text,text,uuid)'::regprocedure);
 if position('manual_pair_internal_source_key(a,''BO'')' in definition)>0 then
  patched:=definition;
 else
  patched:=replace(replace(definition,
   'bo_key:=a.company||''|''||a.direction||''|''||a.account||''|BO|''||md5(a.bo_raw);',
   'bo_key:=case when p_mode=''internal'' then public.manual_pair_internal_source_key(a,''BO'') else a.company||''|''||a.direction||''|''||a.account||''|BO|''||md5(a.bo_raw) end;'),
   'stm_key:=b.company||''|''||b.direction||''|''||b.account||''|STM|''||md5(b.stm_raw);',
   'stm_key:=case when p_mode=''internal'' then public.manual_pair_internal_source_key(b,''STM'') else b.company||''|''||b.direction||''|''||b.account||''|STM|''||md5(b.stm_raw) end;');
  if patched=definition then raise exception 'Unexpected manual pair source-key definition; no changes applied';end if;
 end if;
 if position('manual_pair_internal_source_key(a,''BO'')' in patched)=0
   or position('manual_pair_internal_source_key(b,''STM'')' in patched)=0
 then raise exception 'Internal source-row key missing; no changes applied';end if;
 execute patched;
end $patch$;

update public.manual_pair_members member set source_key=public.manual_pair_internal_source_key(exception_row,
 case when exception_row.id=pair_row.bo_case_id then 'BO' else 'STM' end)
from public.manual_case_pairs pair_row,public.exceptions exception_row
where member.pair_id=pair_row.id and member.exception_id=exception_row.id
 and member.released_at is null and pair_row.mode='internal';

insert into public.audit_log(actor,action,entity,target,detail)
values('authorized policy migration','update','approval_policy','UFABET7M internal clarifying pair',
 'Allow only a validated internal 7M pair to reserve and close from open/clarifying/answered. Duplicate amount/time rows use source file plus row identity. Clarification history and case state remain unchanged.');
notify pgrst,'reload schema';
commit;
