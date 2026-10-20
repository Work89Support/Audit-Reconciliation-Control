-- Definitions only. Existing held drafts, primary results, cases and holds are untouched.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

-- A new receipt retains the sender/parser's original classification for audit.
-- No UPDATE/backfill: files used by historical primary results remain intact.
alter table public.source_files add column if not exists intake_original_kind text;

create or replace function public.audit_intake_source_kind(p_name text,p_kind text)
returns text language plpgsql immutable set search_path=public,pg_temp as $$
declare n text:=coalesce(p_name,''); k text:=coalesce(p_kind,'unknown');
begin
 -- Explicit evidence and auxiliary reports must win over broad PM/provider names.
 if k in ('doc_clarify','manual_credit','manual_payment','manual_bonus','comm_req','credit_out') or n ~* 'evidence|ชี้แจง|หลักฐาน|manual[_ -]*(credit|payment|bonus)|commission|credit[_ -]*out|ฝากมือ|เติมมือ|โบนัส|ค่าคอม|ถอนเครดิต'
 then return 'doc_clarify';end if;
 -- Explicit reviewed types allow incorrectly named source documents to be used.
 if k in ('bo_main','stm_pdf','pm_statement') then return k;end if;
 if n ~* '\.(xlsx|xlsm|xls|csv|txt)$' then
  if n ~* '(^|[^a-z0-9])BO([^a-z0-9]|$)|รายงานบัญชี(ฝาก|ถอน)' then return 'bo_main';end if;
  if n ~* '(^|[^a-z0-9])PM([^a-z0-9]|$)|AUTOPEER|AZPAY|CYBERPAY|CYBERPLUS|COREPAY|CPXM|CPPAY|12PAY|MYPAY|(^|[^a-z0-9])CP2([^a-z0-9]|$)'
  then return 'pm_statement';end if;
 end if;
 if n ~* '\.(pdf|docx)$' and n ~* '(^|[^a-z0-9])STM([^a-z0-9]|$)|statement|ฝาก[[:space:]]*[-–—/]?[[:space:]]*ถอน'
 then return 'stm_pdf';end if;
 return 'doc_clarify';
end $$;
revoke all on function public.audit_intake_source_kind(text,text) from public,anon,authenticated;
grant execute on function public.audit_intake_source_kind(text,text) to service_role;

create or replace function public.apply_audit_intake_source_kind()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 new.intake_original_kind:=new.kind;
 new.kind:=public.audit_intake_source_kind(new.file_name,new.kind);
 return new;
end $$;
revoke all on function public.apply_audit_intake_source_kind() from public,anon,authenticated;
drop trigger if exists source_file_intake_role on public.source_files;
create trigger source_file_intake_role before insert on public.source_files
for each row execute function public.apply_audit_intake_source_kind();

do $patch$
declare d text;needle text;replacement text;
begin
 d:=pg_get_functiondef('public.audit_run_preflight_review(text,date)'::regprocedure);
 if position('context_cross_day_v1' in d)=0 then
  needle:='warnings jsonb:=''[]''; arrivals';
  if position(needle in d)=0 then raise exception 'Unreviewed preflight declaration';end if;
  d:=replace(d,needle,'warnings jsonb:=''[]''; informational jsonb:=''[]''; arrivals');
  needle:='if jsonb_array_length(arrivals)>0 then warnings:=warnings||';
  if position(needle in d)=0 then raise exception 'Unreviewed persisted cross-day notice';end if;
  d:=replace(d,needle,'if jsonb_array_length(arrivals)>0 then informational:=informational||');
  d:=replace(d,'มีรายการคนละวันในผลรัน ต้องตรวจแถวจริงและคิวเดิมก่อนดำเนินการ ไม่ตัดทิ้งหรือสร้างซ้ำ',
   'พบรายการข้ามวันตามบริบท เก็บวันและแถวเดิมให้ทีมตรวจ ไม่หยุดรอบเพราะวันต่างกันอย่างเดียว');
  needle:='from files where nullif(error,'''') is not null';
  if position(needle in d)=0 then raise exception 'Unreviewed parse-error notice';end if;
  d:=replace(d,needle,'from files where kind in (''bo_main'',''stm_pdf'',''pm_statement'') and nullif(error,'''') is not null');
  d:=replace(d,'(''bo_main'',''stm_pdf'',''pm_statement'',''manual_credit'',''manual_payment'',''manual_bonus'',''comm_req'',''credit_out'')',
   '(''bo_main'',''stm_pdf'',''pm_statement'')');
  needle:='return jsonb_build_object(''version'',1,';
  if position(needle in d)=0 then raise exception 'Unreviewed preflight return';end if;
  d:=replace(d,needle,'return jsonb_build_object(''version'',2,''policy'',''context_cross_day_v1'',''informational'',informational,');
  -- Existing draft.warnings intentionally stay blocking: never release old work implicitly.
  execute d;
 end if;

 d:=pg_get_functiondef('public.stage_daily_recon_preflight(uuid,jsonb,jsonb)'::regprocedure);
 if position('context_cross_day_v1' in d)=0 then
  needle:='warnings:=warnings||jsonb_build_array(jsonb_build_object(''code'',''cross_day_scope'',''detail'',''อ่านรายการคนละวันแล้ว พักเป็นรายงานรอทบทวนก่อนสร้างเคสหรือเปลี่ยนผลหลัก''));';
  if position(needle in d)=0 then raise exception 'Unreviewed worker cross-day gate';end if;
  replacement:=$context$
 -- context_cross_day_v1: require row identity/context, not same-day timestamps.
 if exists(select 1 from jsonb_array_elements(p_exceptions) e
  where coalesce(e->>'business_date','')!~'^20[0-9]{2}-[0-9]{2}-[0-9]{2}$')
 then raise exception 'Missing or invalid report row date; review source context';end if;
 if exists(select 1 from jsonb_array_elements(p_exceptions) e
  where e->>'business_date' is distinct from j.business_date::text and (
   e->>'ex_type' is distinct from 'cross_day'
   or coalesce(e->>'business_date','')!~'^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
   or not exists(select 1 from (values('bo'),('stm')) s(side)
    where e#>>array['customer_details','source_rows',side,'fileId'] in
     (select jsonb_array_elements_text(p_result->'file_ids'))
    and coalesce(e#>>array['customer_details','source_rows',side,'row'],'')~'^[1-9][0-9]*$')
  )) then
  warnings:=warnings||jsonb_build_array(jsonb_build_object('code','cross_day_context_unverified',
   'detail','รายการต่างวันขาดประเภทหรือแถวต้นทางที่พิสูจน์ได้ ต้องตรวจบริบทก่อน ไม่ใช่พักเพราะวันต่างกันอย่างเดียว'));
 end if;
 if exists(select 1 from jsonb_array_elements(p_exceptions) e
  where e->>'business_date' is distinct from j.business_date::text
  and public.worker_primary_scope_protected(j.company,(e->>'business_date')::date)) then
  warnings:=warnings||jsonb_build_array(jsonb_build_object('code','historical_primary_protected',
   'detail','รายการอ้างวันที่มีผลหลักรันมือ ต้องตรวจเคสเดิมก่อน ห้ามสร้างซ้ำหรือแก้ผลย้อนหลัง'));
 end if;
 $context$;
  d:=replace(d,needle,replacement);
  needle:='return jsonb_build_object(''proceed'',true,''warnings'',''[]''::jsonb);';
  if position(needle in d)=0 then raise exception 'Unreviewed worker proceed receipt';end if;
  replacement:='return jsonb_build_object(''proceed'',true,''warnings'',''[]''::jsonb,''policy'',''context_cross_day_v1'',''cross_day_count'',(select count(*) from jsonb_array_elements(p_exceptions) e where e->>''business_date'' is distinct from j.business_date::text),''context_review_required'',exists(select 1 from jsonb_array_elements(p_exceptions) e where e->>''business_date'' is distinct from j.business_date::text));';
  execute replace(d,needle,replacement);
 end if;
end $patch$;
notify pgrst,'reload schema';
commit;
