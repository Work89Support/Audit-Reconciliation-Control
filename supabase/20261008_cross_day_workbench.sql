-- Additive workbench: exact native STM rows, independent head approval. No existing cases closed.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table public.cross_day_pair_requests (
 id uuid primary key, exception_id uuid not null references public.exceptions(id),
 company text not null, stm_file_id uuid not null references public.source_files(id), stm_row integer not null check(stm_row>0),
 bo_key text not null, stm_key text not null, logical_key text not null,
 difference numeric(16,2) not null check(difference between 0 and 5), snapshot jsonb not null,
 reason text not null check(length(btrim(reason)) between 10 and 2000),
 status text not null default 'pending' check(status in('pending','approved','rejected')),
 submitted_by uuid not null references auth.users(id), submitted_at timestamptz not null default now(),
 decided_by uuid references auth.users(id), decided_at timestamptz, decision_note text,
 check(decided_by is null or decided_by<>submitted_by)
);
create unique index cross_day_pair_case_reserved on public.cross_day_pair_requests(exception_id) where status<>'rejected';
create unique index cross_day_pair_bo_reserved on public.cross_day_pair_requests(bo_key) where status<>'rejected';
create unique index cross_day_pair_stm_reserved on public.cross_day_pair_requests(stm_key) where status<>'rejected';
create unique index cross_day_pair_logical_reserved on public.cross_day_pair_requests(logical_key) where status<>'rejected';
alter table public.exceptions add column cross_day_request_id uuid references public.cross_day_pair_requests(id);
alter table public.cross_day_pair_requests enable row level security;
create policy cross_day_pairs_read on public.cross_day_pair_requests for select to authenticated
 using(public.current_user_active() and public.has_company_access(company));
revoke all on public.cross_day_pair_requests from public,anon,authenticated;
grant select on public.cross_day_pair_requests to authenticated;

-- Only the complete native PDF cache with a hash matching Storage is selectable.
-- Generic OCR and unsupported bank parsers remain preview-only, never zero activity.
create function public.cross_day_verified_rows(p_file uuid) returns setof jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select n from public.source_files f join public.source_file_ocr o on o.source_file_id=f.id
 join storage.objects obj on obj.bucket_id='audit-files' and obj.name=f.storage_path
 cross join lateral jsonb_array_elements(o.rows) n
 where f.id=p_file and f.kind='stm_pdf' and f.parsed and f.parse_error is null
 and o.provider='native-pdf-cross-day-review-v1' and o.page_count>0 and length(o.extracted_text)>0
 and n->>'bank'='SCB' and n->>'noTime'='false'
 and trim(both '"' from obj.metadata->>'eTag')=n->>'file_md5'
 and n->>'rowNo'~'^[1-9][0-9]*$' and n->>'amount'~'^[0-9]+([.][0-9]{1,2})?$'
 and case when n->>'amount'~'^[0-9]+([.][0-9]{1,2})?$' then (n->>'amount')::numeric>0 else false end
 and n->>'balance'~'^-?[0-9]+([.][0-9]+)?$' and n->>'date'~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 and n->>'sec'~'^[0-9]+$' and (n->>'sec')::integer between 0 and 86399
 and n->>'direction' in('deposit','withdraw') and coalesce(n->>'account','')<>''
$$;
revoke all on function public.cross_day_verified_rows(uuid) from public,anon,authenticated;

create function public.cross_day_workbench(p_company text,p_from date,p_to date) returns jsonb
language plpgsql security definer set search_path=public,pg_temp set statement_timeout='20s' as $$
declare cases jsonb;files jsonb;
begin
 if auth.uid() is null or not public.current_user_active() or not public.has_company_access(p_company)
 then raise exception 'ไม่มีสิทธิ์บริษัทนี้' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>7 then raise exception 'เลือกช่วงเอกสารไม่เกิน 8 วัน';end if;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.business_date,e.occurred_at,e.id),'[]') into cases
 from public.exceptions e join public.daily_recon_jobs j on j.last_run_id=e.run_id and j.company=e.company and not j.is_archived
 where e.company=p_company and e.business_date between p_from and p_to and e.ex_type='cross_day'
 and e.status='open' and e.superseded_by_exception_id is null and e.cross_day_request_id is null
 and e.manual_pair_id is null and e.case_closure_request_id is null and to_jsonb(e)->>'governance_request_id' is null;
 select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'company',f.company,'business_date',b.business_date,
 'file_name',f.file_name,'storage_path',f.storage_path,'rows',coalesce((select jsonb_agg(n||jsonb_build_object('verified',true)) from public.cross_day_verified_rows(f.id) n),'[]')) order by b.business_date,f.file_name),'[]') into files
 from public.source_files f join public.mail_batches b on b.id=f.batch_id
 where f.company=p_company and f.kind='stm_pdf' and b.business_date between p_from and p_to;
 return jsonb_build_object('version',1,'cases',cases,'files',files);
end $$;

create function public.validate_cross_day_row(p_case uuid,p_file uuid,p_row integer) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.exceptions%rowtype;f public.source_files%rowtype;n jsonb;v_bo_key text;v_stm_key text;v_logical_key text;diff numeric;
begin
 select * into strict e from public.exceptions where id=p_case;
 select * into strict f from public.source_files where id=p_file;
 if not public.has_company_access(e.company) or f.company is distinct from e.company then raise exception 'บริษัทหรือสิทธิ์ไม่ตรงกัน';end if;
 if e.ex_type<>'cross_day' or e.currency is distinct from 'THB' or e.system_amount is null or e.system_amount<=0
 or e.superseded_by_exception_id is not null or e.manual_pair_id is not null or e.case_closure_request_id is not null or to_jsonb(e)->>'governance_request_id' is not null
 or coalesce(length(btrim(e.bo_raw)),0)<2 or btrim(e.bo_raw)~'^(—|–|-|ไม่พบ|รอข้อมูล)'
 then raise exception 'เคสหรือ BO ต้นทางไม่พร้อม';end if;
 if not exists(select 1 from public.daily_recon_jobs j join public.recon_runs r on r.id=j.last_run_id
 join public.source_files bo on bo.id::text=e.customer_details#>>'{source_rows,bo,fileId}'
 join storage.objects obj on obj.bucket_id='audit-files' and obj.name=bo.storage_path
 where j.company=e.company and not j.is_archived and j.status='completed' and j.last_run_id=e.run_id
 and r.summary->>'source_parser_completion'='true' and bo.id=any(r.file_ids) and bo.company=e.company
 and bo.kind='bo_main' and bo.parsed and bo.parse_error is null and e.customer_details#>>'{source_rows,bo,row}'~'^[1-9][0-9]*$')
 then raise exception 'ผลรันเปลี่ยนหรือยังรันไม่เสร็จ ต้องตรวจล่าสุดก่อนส่ง/อนุมัติ';end if;
 select x into strict n from public.cross_day_verified_rows(p_file) x where (x->>'rowNo')::integer=p_row;
 if n->>'account' is distinct from e.account or n->>'date' is distinct from e.business_date::text
 or n->>'direction' is distinct from (case e.direction when 'ฝาก' then 'deposit' when 'ถอน' then 'withdraw' end)
 or coalesce(substring(n->>'desc' from 'x([0-9]{4})'),'')=''
 or substring(n->>'desc' from 'x([0-9]{4})') is distinct from right(e.customer_details#>>'{bo,account}',4)
 then raise exception 'วันจริง บัญชี ทิศทาง หรือท้ายบัญชีลูกค้าไม่ตรง ต้องชี้แจงก่อน';end if;
 diff:=abs(e.system_amount-(n->>'amount')::numeric);
 if diff>5 then raise exception 'ผลต่างเกิน 5 บาท';end if;
 v_bo_key:=concat_ws('|',e.company,e.account,n->>'direction',e.customer_details#>>'{source_rows,bo,fileId}',e.customer_details#>>'{source_rows,bo,row}');
 v_stm_key:=concat_ws('|',e.company,e.account,n->>'direction',f.id::text,n->>'rowNo');
 v_logical_key:=concat_ws('|',e.company,e.account,n->>'direction',n->>'date',((n->>'sec')::integer/60)::text,(n->>'amount')::numeric::text,(n->>'balance')::numeric::text,substring(n->>'desc' from 'x([0-9]{4})'));
 if exists(select 1 from public.cross_day_closure_evidence x where x.exception_id=e.id or x.bo_key=v_bo_key or x.stm_key=v_stm_key or x.evidence->>'nativeLogicalKey'=v_logical_key)
 or exists(select 1 from public.daily_recon_jobs j join public.recon_runs r on r.id=j.last_run_id
 cross join lateral jsonb_array_elements(coalesce(r.summary->'match_evidence','[]')) ev
 where not j.is_archived and r.company=e.company and ev->>'account'=e.account and ev->>'direction'=n->>'direction'
 and ((ev#>>'{bo,fileId}'=e.customer_details#>>'{source_rows,bo,fileId}' and ev#>>'{bo,row}'=e.customer_details#>>'{source_rows,bo,row}')
 or (ev#>>'{stm,fileId}'=f.id::text and ev#>>'{stm,row}'=n->>'rowNo')
 or (ev#>>'{stm,date}'=n->>'date' and case when ev->>'stmAmount'~'^[0-9]+([.][0-9]+)?$' then (ev->>'stmAmount')::numeric=(n->>'amount')::numeric else false end
 and coalesce(ev#>>'{stm,sec}','')~'^[0-9]+$' and (ev#>>'{stm,sec}')::integer/60=(n->>'sec')::integer/60)))
 then raise exception 'BO หรือ STM ถูกใช้ในคู่สำเร็จ/เคสปิดแล้ว';end if;
 if exists(select 1 from public.exceptions other where other.id<>e.id and other.run_id=e.run_id and other.superseded_by_exception_id is null
 and ((other.customer_details#>>'{source_rows,bo,fileId}'=e.customer_details#>>'{source_rows,bo,fileId}' and other.customer_details#>>'{source_rows,bo,row}'=e.customer_details#>>'{source_rows,bo,row}')
 or (other.customer_details#>>'{source_rows,stm,fileId}'=f.id::text and other.customer_details#>>'{source_rows,stm,row}'=n->>'rowNo')))
 then raise exception 'มีเคสอื่นอ้างต้นทางเดียวกัน ให้ตรวจเคสซ้ำก่อน';end if;
 return jsonb_build_object('bo',to_jsonb(e),'stm',n,'file',jsonb_build_object('id',f.id,'file_name',f.file_name,'storage_path',f.storage_path),
 'bo_key',v_bo_key,'stm_key',v_stm_key,'logical_key',v_logical_key,'difference',diff);
end $$;
revoke all on function public.validate_cross_day_row(uuid,uuid,integer) from public,anon,authenticated;

create function public.submit_cross_day_pair(p_id uuid,p_case uuid,p_file uuid,p_row integer,p_reason text)
returns public.cross_day_pair_requests language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.cross_day_pair_requests%rowtype; e public.exceptions%rowtype;proof jsonb;
begin
 if auth.uid() is null or not public.current_user_active() or coalesce(public.current_app_role(),'') not in('monitor','audit_assistant','lead','admin') then raise exception 'เฉพาะ Audit ส่งคู่ได้' using errcode='42501';end if;
 if p_id is null or coalesce(length(btrim(p_reason)),0) not between 10 and 2000 then raise exception 'ระบุเหตุผล 10–2000 ตัวอักษร';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into q from public.cross_day_pair_requests where id=p_id;
 if found then
 if q.submitted_by=auth.uid() and q.exception_id=p_case and q.stm_file_id=p_file and q.stm_row=p_row and q.reason=btrim(p_reason) then return q;end if;
 raise exception 'รหัสคำขอถูกใช้กับข้อมูลอื่นแล้ว';end if;
 -- Same order for submission/decision: jobs, case, source cache, request.
 perform 1 from public.daily_recon_jobs where company=(select company from public.exceptions where id=p_case) order by id for update;
 select * into strict e from public.exceptions where id=p_case for update;
 perform 1 from public.source_file_ocr where source_file_id=p_file for share;
 if e.status<>'open' or e.cross_day_request_id is not null then raise exception 'เคสถูกดำเนินการโดยผู้อื่นแล้ว';end if;
 proof:=public.validate_cross_day_row(p_case,p_file,p_row);
 insert into public.cross_day_pair_requests(id,exception_id,company,stm_file_id,stm_row,bo_key,stm_key,logical_key,difference,snapshot,reason,submitted_by)
 values(p_id,e.id,e.company,p_file,p_row,proof->>'bo_key',proof->>'stm_key',proof->>'logical_key',(proof->>'difference')::numeric,proof,btrim(p_reason),auth.uid()) returning * into q;
 update public.exceptions set cross_day_request_id=q.id,status='pair_pending',updated_at=now() where id=e.id;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail) values(auth.uid()::text,auth.uid(),'cross_day_pair_submit','cross_day_pair_request',q.id::text,q.reason);
 return q;
end $$;

create function public.decide_cross_day_pair(p_id uuid,p_action text,p_note text)
returns public.cross_day_pair_requests language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.cross_day_pair_requests%rowtype;e public.exceptions%rowtype;proof jsonb;k text;
begin
 if auth.uid() is null or not public.current_user_active() or coalesce(public.current_app_role(),'') not in('lead','admin') then raise exception 'เฉพาะหัวหน้าอนุมัติ' using errcode='42501';end if;
 select * into strict q from public.cross_day_pair_requests where id=p_id;
 if not public.has_company_access(q.company) or q.submitted_by=auth.uid() then raise exception 'ผู้ส่งห้ามอนุมัติคำขอตัวเอง หรือไม่มีสิทธิ์บริษัท' using errcode='42501';end if;
 if p_action is null or p_action not in('approve','reject') or coalesce(length(btrim(p_note)),0)>2000 or (p_action='reject' and coalesce(length(btrim(p_note)),0)<10) then raise exception 'ระบุผลตรวจและเหตุผลส่งกลับ';end if;
 perform 1 from public.daily_recon_jobs where company=q.company order by id for update;
 select * into strict e from public.exceptions where id=q.exception_id for update;
 perform 1 from public.source_file_ocr where source_file_id=q.stm_file_id for share;
 select * into strict q from public.cross_day_pair_requests where id=p_id for update;
 if q.status<>'pending' then
 if q.decided_by=auth.uid() and q.status=(case p_action when 'approve' then 'approved' else 'rejected' end) then return q;end if;
 raise exception 'คำขอไม่รออนุมัติแล้ว';end if;
 if e.status<>'pair_pending' or e.cross_day_request_id is distinct from q.id then raise exception 'สถานะเคสเปลี่ยน ต้องตรวจใหม่';end if;
 if p_action='approve' then
 proof:=public.validate_cross_day_row(e.id,q.stm_file_id,q.stm_row);
 foreach k in array array['run_id','company','business_date','occurred_at','direction','account','currency','system_amount','bo_raw','customer_details'] loop
 if proof->'bo'->k is distinct from q.snapshot->'bo'->k then raise exception 'BO ต้นทางเปลี่ยนหลังส่ง ต้องส่งกลับตรวจใหม่';end if;end loop;
 if proof->'stm' is distinct from q.snapshot->'stm' or proof->>'logical_key' is distinct from q.logical_key then raise exception 'STM ต้นทางเปลี่ยน ต้องตรวจใหม่';end if;
 insert into public.cross_day_closure_evidence(exception_id,evidence_run_id,evidence_key,stm_key,bo_key,evidence)
 values(e.id,e.run_id,md5(q.bo_key||'|'||q.logical_key),q.stm_key,q.bo_key,q.snapshot||jsonb_build_object('nativeLogicalKey',q.logical_key,'method','head-cross-day-workbench','request_id',q.id));
 end if;
 update public.cross_day_pair_requests set status=case p_action when 'approve' then 'approved' else 'rejected' end,
 decided_by=auth.uid(),decided_at=now(),decision_note=btrim(p_note) where id=q.id returning * into q;
 if p_action='approve' then
 update public.exceptions set status='closed',auto_closed=false,approved_by=auth.uid(),approved_at=now(),resolved_by=auth.uid()::text,resolved_at=now(),
 closure_rule='head-cross-day-workbench',resolution_note='หัวหน้า Audit อนุมัติคู่ข้ามวัน '||q.id||': '||q.reason,updated_at=now() where id=e.id;
 else update public.exceptions set status='open',cross_day_request_id=null,updated_at=now() where id=e.id;end if;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail) values(auth.uid()::text,auth.uid(),'cross_day_pair_'||p_action,'cross_day_pair_request',q.id::text,coalesce(p_note,''));
 return q;
end $$;

create function public.guard_cross_day_request() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.cross_day_pair_requests%rowtype;
begin
 if old.cross_day_request_id is null and new.cross_day_request_id is null then return new;end if;
 select * into q from public.cross_day_pair_requests where id=coalesce(old.cross_day_request_id,new.cross_day_request_id);
 if q.id is null or q.exception_id<>old.id then raise exception 'คำขอคู่ข้ามวันไม่ตรงเคส';end if;
 if (to_jsonb(new)-array['cross_day_request_id','status','updated_at','approved_by','approved_at','resolved_by','resolved_at','auto_closed','closure_rule','resolution_note']) is distinct from
 (to_jsonb(old)-array['cross_day_request_id','status','updated_at','approved_by','approved_at','resolved_by','resolved_at','auto_closed','closure_rule','resolution_note']) then raise exception 'ต้นทางถูกจอง ห้ามแก้ระหว่างรออนุมัติ';end if;
 if old.cross_day_request_id is null and new.cross_day_request_id=q.id and old.status='open' and new.status='pair_pending' and q.status='pending' and q.submitted_by=auth.uid() then return new;end if;
 if q.decided_by=auth.uid() and public.current_app_role() in('lead','admin') then
 if q.status='approved' and old.status='pair_pending' and new.status='closed' and new.cross_day_request_id=q.id then return new;end if;
 if q.status='rejected' and new.status='open' and new.cross_day_request_id is null then return new;end if;end if;
 if to_jsonb(new)-'updated_at'=to_jsonb(old)-'updated_at' then return new;end if;
 raise exception 'ดำเนินการผ่านคำขอข้ามวันเท่านั้น';
end $$;
create trigger exceptions_cross_day_request_guard before update on public.exceptions for each row execute function public.guard_cross_day_request();
-- Request history is append-only; statuses change only in the two security-definer RPCs.
create function public.cross_day_request_no_delete() returns trigger language plpgsql as $$begin raise exception 'ห้ามลบประวัติคำขอข้ามวัน';end$$;
create trigger cross_day_requests_no_delete before delete on public.cross_day_pair_requests for each row execute function public.cross_day_request_no_delete();
revoke all on function public.guard_cross_day_request(),public.cross_day_request_no_delete() from public,anon,authenticated;
revoke all on function public.cross_day_workbench(text,date,date),public.submit_cross_day_pair(uuid,uuid,uuid,integer,text),public.decide_cross_day_pair(uuid,text,text) from public,anon;
grant execute on function public.cross_day_workbench(text,date,date),public.submit_cross_day_pair(uuid,uuid,uuid,integer,text),public.decide_cross_day_pair(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
