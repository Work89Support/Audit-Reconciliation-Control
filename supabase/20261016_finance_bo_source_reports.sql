-- Finance-only report versions. No writes to reconciliation, source files or cases.
begin;
set local lock_timeout='5s';
create table if not exists public.finance_bo_source_reports(
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,
 company text not null,business_date date not null,source_stamp text not null,parser_version text not null,
 summary jsonb not null,source_files jsonb not null,reason text not null,
 accepted_by uuid not null,accepted_role text not null,accepted_at timestamptz not null default clock_timestamp(),
 unique(company,business_date,source_stamp,parser_version)
);
alter table public.finance_bo_source_reports enable row level security;
revoke all on public.finance_bo_source_reports from public,anon,authenticated;
create index if not exists finance_bo_source_reports_day on public.finance_bo_source_reports(company,business_date,accepted_at desc);

create or replace function public.finance_bo_report_sources(p_company text,p_date date) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',f->>'id','company',p_company,'business_date',p_date,
  'file_name',f->>'file_name','kind','bo_main','physical_id',coalesce(f->>'physical_source_file_id',f->>'id'),
  'storage_path',f->>'storage_path','size_bytes',f->>'size_bytes','revision',f->>'revision',
  'checksum',f->>'checksum','object_version',f->>'storage_object_version','etag',f->>'storage_object_etag') order by f->>'id'),'[]')
 from jsonb_array_elements(public.effective_audit_source_files(p_company,p_date)) f
 where f->>'kind'='bo_main' and not coalesce((f->>'excluded')::boolean,false)
 and coalesce(f->>'business_date',p_date::text)=p_date::text
$$;
revoke all on function public.finance_bo_report_sources(text,date) from public,anon,authenticated;

create or replace function public.finance_bo_report_manifest(p_company text,p_date date) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare files jsonb;v public.finance_bo_source_reports;
begin
 if not coalesce(p_company=any(public.finance_reporting_companies()),false) or public.current_app_role() not in ('lead','admin') then raise exception 'เฉพาะหัวหน้า/Admin ที่มีสิทธิ์บริษัท' using errcode='42501';end if;
 if p_date is null or p_date>= (now() at time zone 'Asia/Bangkok')::date then raise exception 'เลือกวันรายงานที่สิ้นสุดแล้ว';end if;
 files:=public.finance_bo_report_sources(p_company,p_date);
 select * into v from public.finance_bo_source_reports where company=p_company and business_date=p_date order by accepted_at desc,id desc limit 1;
 return jsonb_build_object('company',p_company,'date',p_date,'files',files,'stamp',md5(files::text),'can_confirm',true,
  'previous',case when v.id is not null then v.summary||jsonb_build_object('id',v.id,'accepted_at',v.accepted_at,'accepted_by',v.accepted_by,'stale',v.source_stamp<>md5(files::text)) end);
end $$;

create or replace function public.accept_finance_bo_report(p_request uuid,p_company text,p_date date,p_stamp text,p_parser text,p_files jsonb,p_rows jsonb,p_reason text,p_ack boolean) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare files jsonb;s jsonb;a jsonb;private_salt text;v public.finance_bo_source_reports;mf jsonb;v_file jsonb;
begin
 if not coalesce(p_company=any(public.finance_reporting_companies()),false) or public.current_app_role() not in ('lead','admin') then raise exception 'เฉพาะหัวหน้า/Admin ที่มีสิทธิ์บริษัท' using errcode='42501';end if;
 if p_request is null or p_date is null or p_date>=(now() at time zone 'Asia/Bangkok')::date or p_ack is distinct from true or length(btrim(coalesce(p_reason,''))) not between 10 and 1000 or p_parser is distinct from 'finance-bo-source-v1' then raise exception 'ต้องตรวจขอบเขตและยืนยันเฉพาะรายงานให้ครบ';end if;
 perform pg_advisory_xact_lock(hashtext('finance-bo-report/'||p_company||'/'||p_date));
 files:=public.finance_bo_report_sources(p_company,p_date);
 if jsonb_array_length(files)=0 or p_stamp is distinct from md5(files::text) then raise exception 'BO เปลี่ยนหรือไม่มีไฟล์ กรุณาอ่านใหม่ก่อนยืนยัน';end if;
 select * into v from public.finance_bo_source_reports where request_id=p_request;
 if v.id is not null then
  if v.company<>p_company or v.business_date<>p_date or v.source_stamp<>p_stamp or v.parser_version<>p_parser then raise exception 'รหัสคำขอซ้ำต่างขอบเขต';end if;
  return jsonb_build_object('id',v.id,'company',v.company,'date',v.business_date,'accepted_at',v.accepted_at,'already_saved',true);
 end if;
 select * into v from public.finance_bo_source_reports where company=p_company and business_date=p_date and source_stamp=p_stamp and parser_version=p_parser;
 if v.id is not null then return jsonb_build_object('id',v.id,'company',v.company,'date',v.business_date,'accepted_at',v.accepted_at,'already_saved',true);end if;
 if jsonb_typeof(p_files) is distinct from 'array' or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>100000 or octet_length(p_rows::text)>25000000 then raise exception 'รูปแบบแถวรายงานไม่ถูกต้อง/เกินขอบเขต';end if;
 if jsonb_array_length(p_files)<>jsonb_array_length(files) or (select count(distinct x->>'id') from jsonb_array_elements(p_files) x)<>jsonb_array_length(files) then raise exception 'ชุดไฟล์ไม่ครบหรือซ้ำ';end if;
 for v_file in select * from jsonb_array_elements(p_files) loop
  select x into mf from jsonb_array_elements(files) x where x->>'id'=v_file->>'id';
  if mf is null or coalesce(v_file->>'sha256','') !~ '^[0-9a-f]{64}$' or coalesce(v_file->>'rows','') !~ '^[0-9]+$' then raise exception 'ตรวจหลักฐานต้นทาง BO ไม่ครบ';end if;
  if v_file->>'duplicate_of' is not null then
   if v_file->>'duplicate_of'=v_file->>'id' or (v_file->>'rows')::integer<>0 or not exists(select 1 from jsonb_array_elements(p_files) x where x->>'id'=v_file->>'duplicate_of' and x->>'sha256'=v_file->>'sha256' and x->>'duplicate_of' is null) then raise exception 'ไฟล์ซ้ำต้องอ้างไฟล์จริงเนื้อหาเดียวกัน';end if;
  elsif v_file->>'format' not in ('bo_main','bo_compact','bo_transaction_export') or v_file->>'format' is null then raise exception 'รูปแบบ BO ไม่รองรับ';
  end if;
  if (select count(*) from jsonb_array_elements(p_rows) x where x->>'file_id'=v_file->>'id')<>(v_file->>'rows')::integer then raise exception 'จำนวนแถวไม่ตรงไฟล์';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_files) x join jsonb_array_elements(p_files) y on x->>'sha256'=y->>'sha256' and x->>'id'<>y->>'id' where x->>'duplicate_of' is null and y->>'duplicate_of' is null) then raise exception 'ห้ามบวกไฟล์เนื้อหาซ้ำ';end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x where length(btrim(coalesce(x->>'ref','')))>0 and x->>'ref' not in ('-','—') group by x->>'ref',x->>'date',x->>'direction',x->>'amount',x->>'account',x->>'customer_user' having count(distinct x->>'file_id')>1) then raise exception 'พบแถวอ้างอิงซ้อนระหว่างไฟล์ BO ต้องทบทวนก่อนยืนยัน';end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x where not exists(select 1 from jsonb_array_elements(p_files) f where f->>'id'=x->>'file_id' and f->>'duplicate_of' is null)
  or coalesce(x->>'row','') !~ '^[1-9][0-9]{0,8}$' or x->>'date' is distinct from p_date::text or coalesce(x->>'direction','') not in ('deposit','withdraw')
  or public.finance_report_number(x->>'amount') is null or length(coalesce(x->>'account',''))>200 or length(coalesce(x->>'customer_user',''))>200
  or (x->>'sec' is not null and (coalesce(x->>'sec','') !~ '^[0-9]{1,5}$' or (x->>'sec')::integer>86399))) then raise exception 'แถว BO ไม่ตรงวัน/ไฟล์/ยอดต้นทาง';end if;
 select jsonb_build_object('match_evidence',coalesce(jsonb_agg(jsonb_build_object('bo',jsonb_build_object('fileId',x->>'file_id','row',x->'row','date',x->>'date','sec',x->'sec'),
  'boAmount',x->>'amount','direction',x->>'direction','account',x->>'account','customer',jsonb_build_object('bo',jsonb_build_object('user',nullif(btrim(x->>'customer_user'),''))))),'[]')) into s from jsonb_array_elements(p_rows) x;
 a:=public.finance_bo_aggregate(s,'[]',p_date,jsonb_array_length(p_rows));
 if coalesce((a->>'complete')::boolean,false) is not true then raise exception 'แถวอ้างอิงซ้ำหรืออ่านไม่ครบ ไม่ยืนยันรายงาน';end if;
 select salt into private_salt from public.finance_analytics_private where id=true;
 if private_salt is null then raise exception 'ยังไม่พร้อมปกป้องข้อมูลลูกค้า';end if;
 a:=(a-'users')||jsonb_build_object('user_keys',(select coalesce(jsonb_agg((u-'identity')||jsonb_build_object('key',md5(p_company||'/'||private_salt||'/'||(u->>'identity')))),'[]') from jsonb_array_elements(a->'users') u),
  'user_complete',(a->>'identified_rows')::integer=(a->>'count')::integer and coalesce((a->>'user_conflicts')::integer,0)=0,
  'source_mode','bo_source_report','reconciliation_changed',false);
 -- Store approved aggregates, not customer plaintext or operational rows.
 insert into public.finance_bo_source_reports(request_id,company,business_date,source_stamp,parser_version,summary,source_files,reason,accepted_by,accepted_role)
 values(p_request,p_company,p_date,p_stamp,p_parser,a,
 (select jsonb_agg(m||jsonb_build_object('read',jsonb_build_object('sha256',f->>'sha256','format',f->>'format','rows',f->'rows','other_date_rows',f->'other_date_rows','aux_rows',f->'aux_rows','footer_rows',f->'footer_rows','duplicate_of',f->>'duplicate_of'))) from jsonb_array_elements(files) m join jsonb_array_elements(p_files) f on m->>'id'=f->>'id'),btrim(p_reason),auth.uid(),public.current_app_role()) returning * into v;
 return jsonb_build_object('id',v.id,'company',v.company,'date',v.business_date,'accepted_at',v.accepted_at,'already_saved',false);
end $$;

create or replace function public.finance_report_bo_window(p_company text,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;days jsonb:='[]';d jsonb;v public.finance_bo_source_reports;files jsonb;
begin
 -- Legacy fallback remains explicitly incomplete when its original criteria fail.
 result:=public.finance_bo_window(p_company,p_from,p_to);
 for d in select * from jsonb_array_elements(result->'days') loop
  select * into v from public.finance_bo_source_reports where company=p_company and business_date=(d->>'date')::date order by accepted_at desc,id desc limit 1;
  if v.id is not null then
   files:=public.finance_bo_report_sources(p_company,(d->>'date')::date);
   if v.source_stamp=md5(files::text) then d:=v.summary||jsonb_build_object('company',p_company,'date',v.business_date,'report_id',v.id,'accepted_at',v.accepted_at,'accepted_by',v.accepted_by,'reason','BO ต้นทางครบตามชุดที่หัวหน้า/Admin ยืนยันรายงาน · แยกจากผลกระทบยอด');
   else d:=d||jsonb_build_object('complete',false,'user_complete',false,'report_id',v.id,'source_mode','legacy_report_stale','reason','BO เปลี่ยนหลังยืนยันรายงาน ต้องอ่านและยืนยันรายงานใหม่ ผลกระทบยอดเดิมไม่เปลี่ยน');end if;
  else d:=d||jsonb_build_object('source_mode','legacy_reconciliation_reference');end if;
  days:=days||jsonb_build_array(d);
 end loop;
 return result||jsonb_build_object('days',days);
end $$;
create or replace function public.finance_bo_report_history(p_company text,p_date date) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not coalesce(p_company=any(public.finance_reporting_companies()),false) then raise exception 'ไม่มีสิทธิ์บริษัท' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'company',v.company,'date',v.business_date,'deposit',v.summary->'deposit','withdraw',v.summary->'withdraw','count',v.summary->'count','accepted_at',v.accepted_at,'accepted_by',v.accepted_by,'reason',v.reason) order by v.accepted_at desc,v.id desc),'[]') from public.finance_bo_source_reports v where company=p_company and business_date=p_date);
end $$;
revoke all on function public.finance_bo_report_manifest(text,date),public.accept_finance_bo_report(uuid,text,date,text,text,jsonb,jsonb,text,boolean),public.finance_report_bo_window(text,date,date),public.finance_bo_report_history(text,date) from public,anon;
grant execute on function public.finance_bo_report_manifest(text,date),public.accept_finance_bo_report(uuid,text,date,text,text,jsonb,jsonb,text,boolean),public.finance_report_bo_window(text,date,date),public.finance_bo_report_history(text,date) to authenticated;
notify pgrst,'reload schema';
commit;
