-- Staged first-run reports and visible blockers; never resume the primary bot or write cases.
begin;
alter table public.account_recheck_jobs alter column base_run_id drop not null;

create or replace function public.request_account_recheck(p_company text,p_date date,p_account text,p_direction text,p_mode text,p_request_key uuid,p_file_ids uuid[] default null)
returns public.account_recheck_jobs language plpgsql security definer set search_path=public as $$
declare j public.daily_recon_jobs%rowtype;q public.account_recheck_jobs%rowtype;s jsonb;plan jsonb;chosen uuid[];
begin
 if not coalesce(public.current_user_active(),false) or not coalesce(public.has_company_access(p_company),false)
  or coalesce(public.current_app_role(),'') not in ('monitor','lead','admin') then raise exception 'ไม่มีสิทธิ์สั่งตรวจ';end if;
 if p_direction not in ('all','deposit','withdraw') or p_mode not in ('compare','account') or length(trim(p_account)) not between 1 and 100
 then raise exception 'ขอบเขตไม่ถูกต้อง';end if;
 select * into q from public.account_recheck_jobs where request_key=p_request_key;
 if found then
  if q.requested_by<>auth.uid() or q.company<>p_company or q.business_date<>p_date or q.account<>p_account
   or q.direction<>p_direction or q.mode<>p_mode or (p_file_ids is not null and q.selected_file_ids<>p_file_ids) then raise exception 'Request key conflict';end if;return q;
 end if;
 select * into j from public.daily_recon_jobs where company=p_company and business_date=p_date and not is_archived for update;
 if not found then raise exception 'ยังไม่มีคิวบริษัท/วันที่นี้ กรุณาตรวจการรับไฟล์';end if;
 if j.last_run_id is null and p_account<>'ALL' then raise exception 'ยังไม่มีผลเดิม: เลือกทุกบัญชีในไฟล์เพื่อสร้างรายงานครั้งแรก';end if;
 perform public.expire_account_rechecks(p_company,p_date);
 if j.status='running' then raise exception 'บอทกำลังใช้วัน/บริษัทนี้ กรุณารอให้จบก่อน';end if;
 s:=public.account_recheck_snapshot(p_company,p_date);
 plan:=public.effective_audit_source_files(p_company,p_date);
 chosen:=coalesce(p_file_ids,array(select (f->>'id')::uuid from jsonb_array_elements(plan) f where not (f->>'excluded')::boolean and f->>'kind' in ('bo_main','stm_pdf','pm_statement')));
 if cardinality(chosen)=0 or cardinality(chosen)>500 or cardinality(chosen)<>(select count(distinct id) from unnest(chosen) id)
 or exists(select 1 from unnest(chosen) id where not exists(select 1 from jsonb_array_elements(plan) f where (f->>'id')::uuid=id and not (f->>'excluded')::boolean and f->>'kind' in ('bo_main','stm_pdf','pm_statement')))
 then raise exception 'ไฟล์ที่เลือกไม่มีสิทธิ์ อยู่นอกบริษัท/วัน หรือถูกกักไว้';end if;
 if not exists(select 1 from jsonb_array_elements(plan) f where (f->>'id')::uuid=any(chosen) and f->>'kind'='bo_main')
 or not exists(select 1 from jsonb_array_elements(plan) f where (f->>'id')::uuid=any(chosen) and f->>'kind' in ('stm_pdf','pm_statement'))
 then raise exception 'ต้องเลือกหลักฐานทั้ง STM/PM และ BO ไม่ถือว่าไฟล์ขาดเป็นยอดศูนย์';end if;
 if exists(select 1 from jsonb_array_elements(plan) f where (f->>'id')::uuid=any(chosen) and nullif(f->>'checksum','') is not null group by f->>'checksum',f->>'kind' having count(*)>1)
 then raise exception 'เลือกไฟล์เนื้อหาซ้ำกัน กรุณาเลือกเพียงหนึ่งฉบับ';end if;
 s:=s||jsonb_build_object('effective_files',plan);
 if p_account<>'ALL' and not exists(select 1 from public.recon_runs r,jsonb_array_elements(coalesce(r.summary->'bo_first'->'required','[]')) c
  where r.id=j.last_run_id and c->>'identity'=p_account)
  and not exists(select 1 from public.exceptions e where e.run_id=j.last_run_id and e.account=p_account)
  and not exists(select 1 from public.recon_runs r,jsonb_array_elements(coalesce(r.summary->'match_evidence','[]')) c
   where r.id=j.last_run_id and c->>'account'=p_account)
 then raise exception 'บัญชีไม่อยู่ในผลบริษัท/วันที่นี้';end if;
 insert into public.account_recheck_jobs(company,business_date,account,direction,mode,request_key,requested_by,base_run_id,snapshot,selected_file_ids)
 values(p_company,p_date,p_account,p_direction,p_mode,p_request_key,auth.uid(),j.last_run_id,s,chosen) returning * into q;
 insert into public.audit_log(actor,action,entity,target,company,detail)
 values(auth.uid()::text,'account_recheck_requested','account_recheck',q.id::text,p_company,'ตรวจเฉพาะบัญชี ไม่เปิดหรือปิดเคส');
 return q;
end $$;

create or replace function public.claim_account_recheck(p_id uuid,p_execution_id text) returns public.account_recheck_jobs
language plpgsql security definer set search_path=public as $$
declare q public.account_recheck_jobs%rowtype;j public.daily_recon_jobs%rowtype;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Worker only';end if;
 if length(coalesce(p_execution_id,'')) not between 1 and 150 then raise exception 'Worker execution ID required';end if;
 select * into q from public.account_recheck_jobs where id=p_id;
 if not found then raise exception 'ไม่พบงาน';end if;
 select * into j from public.daily_recon_jobs where company=q.company and business_date=q.business_date and not is_archived for update;
 if not found then raise exception 'คิวหลักเปลี่ยน ต้องตรวจใหม่';end if;
 perform public.expire_account_rechecks(q.company,q.business_date);
 select * into q from public.account_recheck_jobs where id=p_id for update;
 if q.status<>'queued' then raise exception 'งานถูกจองหรือทำเสร็จแล้ว';end if;
 if (j.status='running') or j.last_run_id is distinct from q.base_run_id
  or (public.account_recheck_snapshot(q.company,q.business_date)||jsonb_build_object('effective_files',public.effective_audit_source_files(q.company,q.business_date))) is distinct from q.snapshot
 then raise exception 'ข้อมูลเปลี่ยนหรือมีงานบอทซ้อน';end if;
 update public.account_recheck_jobs set status='running',revision=revision+1,updated_at=now(),
  lease_expires_at=now()+interval '30 minutes',worker_execution_id=p_execution_id,attempt_count=attempt_count+1
  where id=p_id returning * into q;
 return q;
end $$;

create or replace function public.confirm_account_recheck(p_id uuid,p_expected_revision integer,p_reason text,p_reviewed boolean)
returns public.account_recheck_jobs language plpgsql security definer set search_path=public as $$
declare q public.account_recheck_jobs%rowtype;j public.daily_recon_jobs%rowtype;
begin
 if coalesce(public.current_app_role(),'') not in ('lead','admin') or not coalesce(public.current_user_active(),false)
 then raise exception 'เฉพาะหัวหน้าและผู้ดูแลระบบยืนยันผลได้';end if;
 -- Same lock order as request/worker: company-day first, scoped job second.
 select * into q from public.account_recheck_jobs where id=p_id;
 if not found or not coalesce(public.has_company_access(q.company),false) then raise exception 'ไม่พบงานหรือไม่มีสิทธิ์';end if;
 select * into j from public.daily_recon_jobs where company=q.company and business_date=q.business_date and not is_archived for update;
 if not found then raise exception 'คิวหลักเปลี่ยน ต้องตรวจใหม่';end if;
 select * into q from public.account_recheck_jobs where id=p_id for update;
 if q.status='confirmed' then return q;end if;
 if q.mode<>'account' or q.status<>'ready' or q.revision<>p_expected_revision or not coalesce(p_reviewed,false)
  or length(trim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception 'ต้องทบทวนผลล่าสุดและระบุเหตุผล';end if;
 if (j.status='running') or j.last_run_id is distinct from q.base_run_id
  or (public.account_recheck_snapshot(q.company,q.business_date)||jsonb_build_object('effective_files',public.effective_audit_source_files(q.company,q.business_date))) is distinct from q.snapshot
 then raise exception 'ผลรอบเดิม ไฟล์ หรือเคสเปลี่ยนแล้ว ต้องตรวจซ้ำ';end if;
 if q.result is null or coalesce(q.result->>'quality','')<>'passed'
 then raise exception 'ยังไม่ผ่านตรวจความครบถ้วน';end if;
 update public.account_recheck_jobs set status='confirmed',confirmed_by=auth.uid(),confirmed_at=now(),
  confirmation_reason=trim(p_reason),revision=revision+1,updated_at=now() where id=p_id returning * into q;
 -- Acceptance is a separate account result, never a full-company replacement.
 insert into public.audit_log(actor,action,entity,target,company,detail,meta)
 values(auth.uid()::text,'account_recheck_confirmed','account_recheck',q.id::text,q.company,trim(p_reason),
 jsonb_build_object('base_run_id',q.base_run_id,'account',q.account,'direction',q.direction,'cases_closed',0));
 return q;
end $$;

create or replace function public.list_account_rechecks(p_company text,p_date date) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if not coalesce(public.current_user_active(),false) or not coalesce(public.has_company_access(p_company),false)
 or coalesce(public.current_app_role(),'') not in ('monitor','lead','admin') then raise exception 'ไม่มีสิทธิ์อ่านผลตรวจซ้ำ';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'request_key',q.request_key,'company',q.company,'business_date',q.business_date,
 'account',q.account,'direction',q.direction,'mode',q.mode,
 'status',case when q.status in ('queued','running') and q.lease_expires_at<now() then 'failed' else q.status end,
 'revision',q.revision,'error',case when q.status in ('queued','running') and q.lease_expires_at<now() then 'งานหมดเวลา ตรวจสถานะแล้วสั่งใหม่ได้' else q.error end,
 'created_at',q.created_at,'lease_expires_at',q.lease_expires_at,'base_run_id',q.base_run_id,
 'confirmed_at',q.confirmed_at,'confirmed_by',q.confirmed_by,'confirmation_reason',q.confirmation_reason,
 'base_is_current',j.id is not null and q.base_run_id is not distinct from j.last_run_id,
 'result',case when q.result is null then null else jsonb_build_object('stm_count',q.result->'stm_count',
 'bo_count',q.result->'bo_count','matched',q.result->'matched','exception_count',jsonb_array_length(q.result->'exceptions')) end
 ) order by q.created_at desc),'[]') from (select * from public.account_recheck_jobs where company=p_company and business_date=p_date order by created_at desc limit 50) q
 left join public.daily_recon_jobs j on j.company=q.company and j.business_date=q.business_date and not j.is_archived);
end $$;

create or replace function public.file_run_management_state(p_company text,p_date date) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare j public.daily_recon_jobs%rowtype;
begin
 if not coalesce(public.current_user_active(),false) or not coalesce(public.has_company_access(p_company),false)
 then raise exception 'ไม่มีสิทธิ์อ่านบริษัทนี้';end if;
 select * into j from public.daily_recon_jobs where company=p_company and business_date=p_date and not is_archived;
 return jsonb_build_object('files',public.effective_audit_source_files(p_company,p_date),
 'hold',(select to_jsonb(h) from public.audit_run_holds h where company=p_company and business_date=p_date),
 'manualOnly',public.audit_source_scope_managed(p_company,p_date),
 'job',case when j.id is null then null else jsonb_build_object('status',j.status,'last_run_id',j.last_run_id,'attempt_count',j.attempt_count,'last_error',j.last_error) end,
 'manual',(select jsonb_build_object('status',case when q.status in ('queued','running') and q.lease_expires_at<now() then 'failed' else q.status end,'error',case when q.status in ('queued','running') and q.lease_expires_at<now() then 'งานตรวจมือหมดเวลา ตรวจสถานะแล้วสั่งใหม่ได้' else q.error end) from public.account_recheck_jobs q where company=p_company and business_date=p_date order by created_at desc limit 1));
end $$;
-- Scoped read-only notices, including held/managed work whose raw queue still says queued.
create function public.audit_run_notices(p_from date,p_to date,p_company text default null) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if not coalesce(public.current_user_active(),false) then raise exception 'ต้องเข้าสู่ระบบ';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>93 then raise exception 'เลือกช่วงไม่เกิน 93 วัน';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('company',j.company,'business_date',j.business_date,
 'status',j.status,'last_run_id',j.last_run_id,'attempt_count',j.attempt_count,'last_error',j.last_error,
 'hold',(select to_jsonb(h)-'updated_by' from public.audit_run_holds h where h.company=j.company and h.business_date=j.business_date),
 'manualOnly',public.audit_source_scope_managed(j.company,j.business_date))),'[]')
 from public.daily_recon_jobs j where not j.is_archived and j.business_date between p_from and p_to
 and (p_company is null or j.company=p_company) and public.has_company_access(j.company));
end $$;
revoke all on function public.audit_run_notices(date,date,text) from public,anon;
grant execute on function public.audit_run_notices(date,date,text) to authenticated;
commit;

