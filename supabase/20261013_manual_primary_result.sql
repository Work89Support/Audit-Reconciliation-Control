-- Append-only report authority. Never updates original runs, jobs, amounts or cases.
create table public.manual_primary_results (
 id uuid primary key default gen_random_uuid(),
 company text not null, business_date date not null,
 recheck_id uuid not null unique references public.account_recheck_jobs(id),
 base_run_id uuid references public.recon_runs(id),
 previous_id uuid references public.manual_primary_results(id),
 report jsonb not null, source_stamp jsonb not null,
 accepted_by uuid not null references public.app_profiles(user_id),
 accepted_at timestamptz not null default now(), reason text not null check(length(trim(reason)) between 10 and 2000)
);
create index manual_primary_scope on public.manual_primary_results(company,business_date,accepted_at desc,id);
alter table public.manual_primary_results enable row level security;
create policy manual_primary_read on public.manual_primary_results for select to authenticated
 using(public.current_user_active() and public.has_company_access(company));
grant select on public.manual_primary_results to authenticated;
revoke insert,update,delete on public.manual_primary_results from authenticated,anon;

-- Ignore parser housekeeping and evidence documents, but bind exact storage bytes,
-- corrected metadata, physical revisions and OCR input to the accepted result.
create function public.manual_primary_sources(p_files jsonb) returns jsonb
language sql immutable as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',f->'id','physical',f->'physical_source_file_id',
 'name',f->'file_name','company',f->'company','date',f->'business_date','kind',f->'kind',
 'revision',f->'revision','path',f->'storage_path','checksum',f->'checksum',
 'version',f->'storage_object_version','etag',f->'storage_object_etag',
 'size',f->'storage_size_bytes','ocr',f->'source_file_ocr') order by f->>'id'),'[]')
 from jsonb_array_elements(coalesce(p_files,'[]')) f
 where f->>'kind' in ('bo_main','stm_pdf','pm_statement') and not coalesce((f->>'excluded')::boolean,false)
$$;

create function public.manual_primary_preview(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare q public.account_recheck_jobs; j public.daily_recon_jobs; v public.manual_primary_results;
 files jsonb; stamp jsonb; problems text[]:='{}'; before_report jsonb; token text; nbo integer; nstm integer; rawbo integer; rawstm integer;
begin
 select * into q from public.account_recheck_jobs where id=p_id;
 if q.id is null or not coalesce(public.current_user_active(),false)
 or coalesce(public.current_app_role(),'') not in ('lead','admin') or not coalesce(public.has_company_access(q.company),false)
 or (public.current_app_role()='lead' and not exists(select 1 from public.user_company_access where user_id=auth.uid() and upper(company)=upper(q.company)))
 then raise exception 'เฉพาะหัวหน้า/ผู้ดูแลในบริษัทที่มีสิทธิ์';end if;
 select * into j from public.daily_recon_jobs where company=q.company and business_date=q.business_date and not is_archived;
 select * into v from public.manual_primary_results where company=q.company and business_date=q.business_date order by accepted_at desc,id desc limit 1;
 files:=public.effective_audit_source_files(q.company,q.business_date);
 stamp:=public.manual_primary_sources(files);
 if q.status<>'confirmed' or q.mode<>'account' then problems:=array_append(problems,'ต้องยืนยันรายงานตรวจมือก่อน');end if;
 if q.account<>'ALL' or q.direction<>'all' then problems:=array_append(problems,'ใช้เป็นผลหลักได้เฉพาะทุกบัญชีและฝาก–ถอนครบ ต้องรันใหม่ให้ครบขอบเขต');end if;
 if j.id is null or j.status='running' or j.last_run_id is distinct from q.base_run_id then problems:=array_append(problems,'รอบหลักเปลี่ยนหรือกำลังรัน ต้องตรวจใหม่');end if;
 if stamp<>public.manual_primary_sources(q.snapshot->'effective_files') then problems:=array_append(problems,'ไฟล์ล่าสุดหรือ OCR เปลี่ยน ต้องรันตรวจมือใหม่');end if;
 if jsonb_array_length(stamp)=0 or exists(select 1 from jsonb_array_elements(stamp) f where not (f->>'id')::uuid=any(coalesce(q.selected_file_ids,'{}'))) then problems:=array_append(problems,'ไฟล์ที่เลือกไม่ครอบคลุมไฟล์กระทบยอดล่าสุดทั้งหมด');end if;
 if q.result->>'quality' is distinct from 'passed' or q.result->>'company' is distinct from q.company
 or coalesce(q.result->>'business_date',q.result->>'date') is distinct from q.business_date::text
 or q.result->>'account' is distinct from 'ALL' or q.result->>'direction' is distinct from 'all'
 or coalesce((q.result->>'matched')::integer,-1)<>jsonb_array_length(coalesce(q.result->'match_evidence','[]'))
 then problems:=array_append(problems,'ผลตรวจไม่ผ่านคุณภาพหรือขอบเขตไม่ตรง');end if;
 -- Every transaction must have an immutable physical source pointer. Amount is
 -- never an identity; equal amounts on different rows remain separate.
 if exists(with pointers as (
 select p->'bo' s from jsonb_array_elements(coalesce(q.result->'match_evidence','[]')) p
 union all select p->'stm' from jsonb_array_elements(coalesce(q.result->'match_evidence','[]')) p
 union all select e->'customer_details'->'source_rows'->'bo' from jsonb_array_elements(coalesce(q.result->'exceptions','[]')) e
 union all select e->'customer_details'->'source_rows'->'stm' from jsonb_array_elements(coalesce(q.result->'exceptions','[]')) e
 union all select w->'boSource' from jsonb_array_elements(coalesce(q.result->'summary'->'waiting_bo','[]')) w
 union all select w->'stmSource' from jsonb_array_elements(coalesce(q.result->'summary'->'waiting_bo','[]')) w)
 select 1 from pointers where s is not null and s<>'null'::jsonb and
 (coalesce(s->>'fileId','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 or coalesce(s->>'row','')!~'^[0-9]+$'
 or not exists(select 1 from jsonb_array_elements(stamp) f where f->>'physical'=s->>'fileId')))
 then problems:=array_append(problems,'รายการต้นทางไม่มีตัวอ้างอิงไฟล์/แถวที่พิสูจน์ได้');end if;
 with pointers as (
 select 'bo' side,p->'bo' s from jsonb_array_elements(coalesce(q.result->'match_evidence','[]')) p
 union all select 'stm',p->'stm' from jsonb_array_elements(coalesce(q.result->'match_evidence','[]')) p
 union all select 'bo',e->'customer_details'->'source_rows'->'bo' from jsonb_array_elements(coalesce(q.result->'exceptions','[]')) e
 union all select 'stm',e->'customer_details'->'source_rows'->'stm' from jsonb_array_elements(coalesce(q.result->'exceptions','[]')) e
 union all select 'bo',w->'boSource' from jsonb_array_elements(coalesce(q.result->'summary'->'waiting_bo','[]')) w
 union all select 'stm',w->'stmSource' from jsonb_array_elements(coalesce(q.result->'summary'->'waiting_bo','[]')) w)
 select count(distinct (s->>'fileId',s->>'row')) filter(where side='bo' and s->>'fileId' is not null),
 count(distinct (s->>'fileId',s->>'row')) filter(where side='stm' and s->>'fileId' is not null),
 count(*) filter(where side='bo' and s->>'fileId' is not null),count(*) filter(where side='stm' and s->>'fileId' is not null) into nbo,nstm,rawbo,rawstm from pointers;
 if nbo<>coalesce((q.result->>'bo_count')::integer,-1) or nstm<>coalesce((q.result->>'stm_count')::integer,-1)
 then problems:=array_append(problems,'จำนวนรายการต้นทางยังพิสูจน์ไม่ครบ ห้ามใช้ผลหลัก ต้องตรวจรายงานใหม่');end if;
 if rawbo<>nbo or rawstm<>nstm then problems:=array_append(problems,'แถวต้นทางเดียวกันแสดงซ้ำหลายรายการ ห้ามใช้ผลหลัก');end if;
 if v.id is not null and v.base_run_id is not distinct from j.last_run_id and v.source_stamp=stamp then before_report:=jsonb_build_object('stm_count',v.report->'stm_count','bo_count',v.report->'bo_count','matched',v.report->'matched','exception_count',jsonb_array_length(coalesce(v.report->'exceptions','[]'))+jsonb_array_length(coalesce(v.report->'summary'->'waiting_bo','[]')));
 else select jsonb_build_object('stm_count',r.stm_count,'bo_count',r.bo_count,'matched',r.matched,'exception_count',r.exception_count) into before_report from public.recon_runs r where r.id=j.last_run_id;end if;
 token:=md5(jsonb_build_object('q',q.id,'revision',q.revision,'result',q.result,'base',j.last_run_id,'sources',stamp,'prior',v.id)::text);
 return jsonb_build_object('id',q.id,'company',q.company,'date',q.business_date,'account',q.account,'direction',q.direction,
 'revision',q.revision,'token',token,'allowed',cardinality(problems)=0,'problems',to_jsonb(problems),
 'file_count',jsonb_array_length(stamp),'before',before_report,'after',jsonb_build_object('stm_count',q.result->'stm_count','bo_count',q.result->'bo_count','matched',q.result->'matched','exception_count',jsonb_array_length(coalesce(q.result->'exceptions','[]'))+jsonb_array_length(coalesce(q.result->'summary'->'waiting_bo','[]'))),
 'already_applied',exists(select 1 from public.manual_primary_results where recheck_id=q.id),'primary_id',v.id);
end $$;

create function public.accept_manual_primary(p_id uuid,p_token text,p_reason text,p_reviewed boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare q public.account_recheck_jobs; v public.manual_primary_results; prev uuid; check_result jsonb;
begin
 perform 1 from public.app_profiles where user_id=auth.uid() and active and role in ('lead','admin') for update;
 if not found then raise exception 'เฉพาะหัวหน้า/ผู้ดูแลที่ใช้งานอยู่';end if;
 select * into q from public.account_recheck_jobs where id=p_id;
 if q.id is null or not coalesce(public.has_company_access(q.company),false)
 or (public.current_app_role()='lead' and not exists(select 1 from public.user_company_access where user_id=auth.uid() and upper(company)=upper(q.company))) then raise exception 'ไม่มีสิทธิ์บริษัท';end if;
 perform 1 from public.daily_recon_jobs where company=q.company and business_date=q.business_date and not is_archived for update;
 select * into q from public.account_recheck_jobs where id=p_id for update;
 if p_reviewed is distinct from true or length(trim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception 'ต้องทบทวนและระบุเหตุผล';end if;
 check_result:=public.manual_primary_preview(p_id);
 if not (check_result->>'allowed')::boolean then raise exception 'ข้อมูลหรือไฟล์ล่าสุดเปลี่ยน ต้องเปิดทบทวนใหม่: %',check_result->'problems';end if;
 select * into v from public.manual_primary_results where recheck_id=p_id;
 if v.id is not null then return jsonb_build_object('id',v.id,'replayed',true);end if;
 if check_result->>'token' is distinct from p_token then raise exception 'ผลหลักหรือขอบเขตเปลี่ยน ต้องเปิดทบทวนใหม่';end if;
 select id into prev from public.manual_primary_results where company=q.company and business_date=q.business_date order by accepted_at desc,id desc limit 1;
 insert into public.manual_primary_results(company,business_date,recheck_id,base_run_id,previous_id,report,source_stamp,accepted_by,reason)
 values(q.company,q.business_date,q.id,q.base_run_id,prev,q.result,public.manual_primary_sources(public.effective_audit_source_files(q.company,q.business_date)),auth.uid(),trim(p_reason)) returning * into v;
 insert into public.audit_log(actor,action,entity,target,company,detail,meta)
 values(auth.uid()::text,'manual_primary_accepted','manual_primary_results',v.id::text,q.company,trim(p_reason),
 jsonb_build_object('recheck_id',q.id,'base_run_id',q.base_run_id,'previous_id',prev,'cases_created',0,'cases_closed',0,'source_amounts_changed',0));
 return jsonb_build_object('id',v.id,'accepted_at',v.accepted_at);
end $$;

create function public.read_manual_primary(p_company text,p_date date) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v public.manual_primary_results; base uuid;
begin
 if not coalesce(public.current_user_active(),false) or not coalesce(public.has_company_access(p_company),false) then raise exception 'ไม่มีสิทธิ์บริษัท';end if;
 select * into v from public.manual_primary_results where company=p_company and business_date=p_date order by accepted_at desc,id desc limit 1;
 if v.id is null then return null;end if;
 select last_run_id into base from public.daily_recon_jobs where company=p_company and business_date=p_date and not is_archived;
 if base is distinct from v.base_run_id or v.source_stamp<>public.manual_primary_sources(public.effective_audit_source_files(p_company,p_date)) then
 return jsonb_build_object('stale',true,'id',v.id,'message','ผลหลักตรวจมือมีไฟล์/รอบใหม่ ต้องรันทบทวนใหม่');end if;
 return to_jsonb(v)-'source_stamp';
end $$;

revoke all on function public.manual_primary_sources(jsonb),public.manual_primary_preview(uuid),public.accept_manual_primary(uuid,text,text,boolean),public.read_manual_primary(text,date) from public,anon;
grant execute on function public.manual_primary_preview(uuid),public.accept_manual_primary(uuid,text,text,boolean),public.read_manual_primary(text,date) to authenticated;
