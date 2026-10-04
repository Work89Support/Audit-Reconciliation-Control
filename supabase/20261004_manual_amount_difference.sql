-- Extend audited pairing to an existing BO/STM amount-difference case.
-- Keep roles, RLS, 5-baht limit, accepted-run gate and independent approval.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
alter table public.manual_pair_members add column secondary_source_key text;
create unique index manual_pair_secondary_source_reserved
 on public.manual_pair_members(secondary_source_key) where released_at is null;
do $migration$
declare c text;
begin
 select conname into strict c from pg_constraint
 where conrelid='public.manual_case_pairs'::regclass and contype='c'
 and pg_get_constraintdef(oid) ~ 'bo_case_id <> stm_case_id';
 execute format('alter table public.manual_case_pairs drop constraint %I',c);
end $migration$;
alter table public.manual_case_pairs add constraint manual_pair_case_shape
 check(bo_case_id<>stm_case_id or (mode='same' and coalesce(snapshot->>'review_type','')='amount_difference'));
create or replace function public.validate_manual_pair(p_bo uuid,p_stm uuid,p_mode text,p_evidence uuid)
 returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.exceptions%rowtype; b public.exceptions%rowtype; difference numeric;
begin
 select * into a from public.exceptions where id=p_bo;
 select * into b from public.exceptions where id=p_stm;
 if a.id is null or b.id is null or (a.id=b.id and (p_mode is distinct from 'same' or a.ex_type<>'amount_diff')) or not public.has_company_access(a.company) or not public.has_company_access(b.company)
   then raise exception 'ไม่พบคู่เคสหรือไม่มีสิทธิ์ทั้งสองบริษัท' using errcode='42501'; end if;
 if (a.id<>b.id and (a.ex_type<>'missing_stm' or b.ex_type<>'missing_bo')) or a.direction is distinct from b.direction
   or a.direction not in ('ฝาก','ถอน') or a.currency is distinct from 'THB' or b.currency is distinct from 'THB'
   or a.system_amount is null or a.system_amount<=0 or b.bank_amount is null or b.bank_amount<=0
   or coalesce(length(btrim(a.bo_raw)),0)<2 or coalesce(length(btrim(b.stm_raw)),0)<2
   or btrim(a.bo_raw) ~ '^(—|–|-|ไม่พบ|รอข้อมูล)' or btrim(b.stm_raw) ~ '^(—|–|-|ไม่พบ|รอข้อมูล)'
   then raise exception 'ต้องเป็น BO ที่ขาด STM จับกับ STM/PM ที่ขาด BO ทิศทางเดียวกันและมีข้อมูลต้นทาง'; end if;
 if p_mode is null or p_mode not in ('same','cross') or (p_mode='same' and a.company<>b.company)
   or (p_mode='cross' and a.company=b.company) then raise exception 'ประเภทการจับคู่ไม่ตรงบริษัท'; end if;
 difference:=abs(a.system_amount-b.bank_amount);
 if difference::text in ('NaN','Infinity','-Infinity') or difference>5 then raise exception 'ผลต่างเกิน 5 บาท จับคู่ไม่ได้'; end if;
 if a.superseded_by_exception_id is not null or b.superseded_by_exception_id is not null
   or not exists(select 1 from public.daily_recon_jobs j join public.recon_runs r on r.id=j.last_run_id
      where not j.is_archived and j.status='completed' and j.company=a.company and j.business_date=a.business_date and r.id=a.run_id
      and r.summary->>'source_parser_completion'='true' and r.summary->'bo_first'->>'complete'='true' and cardinality(r.file_ids)>0
      and not exists(select 1 from public.source_files f where f.id=any(r.file_ids) and (not f.parsed or f.parse_error is not null)))
   or not exists(select 1 from public.daily_recon_jobs j join public.recon_runs r on r.id=j.last_run_id
      where not j.is_archived and j.status='completed' and j.company=b.company and j.business_date=b.business_date and r.id=b.run_id
      and r.summary->>'source_parser_completion'='true' and r.summary->'bo_first'->>'complete'='true' and cardinality(r.file_ids)>0
      and not exists(select 1 from public.source_files f where f.id=any(r.file_ids) and (not f.parsed or f.parse_error is not null)))
   then raise exception 'ต้องใช้เคสจากผลรันล่าสุดที่ผ่านการอ่านไฟล์ครบและไม่มีงานรันค้าง'; end if;
 if (p_mode='cross' or p_evidence is not null) and not exists(
   select 1 from public.case_evidence f join storage.objects o on o.name=f.storage_path and o.bucket_id='audit-files'
   where f.id=p_evidence and f.exception_id in (a.id,b.id) and f.size_bytes>0)
   then raise exception 'ต้องมีหลักฐานที่อัปโหลดและผูกกับหนึ่งในสองเคสจริง'; end if;
 return jsonb_build_object('bo',to_jsonb(a),'stm',to_jsonb(b),'difference',difference,'review_type',case when a.id=b.id then 'amount_difference' else 'case_pair' end);
end $$;

create or replace function public.submit_manual_case_pair(p_id uuid,p_bo uuid,p_stm uuid,p_mode text,p_reason text,p_evidence uuid default null)
 returns public.manual_case_pairs language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.manual_case_pairs%rowtype; proof jsonb; a public.exceptions%rowtype; b public.exceptions%rowtype; bo_key text; stm_key text; lock_key text;
begin
 if auth.uid() is null or not public.current_user_active() or coalesce(public.current_app_role(),'') not in ('monitor','lead','admin')
   then raise exception 'เฉพาะ Audit ส่งคำขอจับคู่ได้' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into p from public.manual_case_pairs where id=p_id;
 if found then
   if p.submitted_by=auth.uid() and p.bo_case_id=p_bo and p.stm_case_id=p_stm and p.mode=p_mode and p.reason=btrim(p_reason)
     and p.evidence_id is not distinct from p_evidence then return p; end if;
   raise exception 'รหัสคำขอถูกใช้แล้ว';
 end if;
 -- Deterministic locks prevent two Audits reserving either case concurrently.
 perform 1 from public.exceptions where id in (p_bo,p_stm) order by id for update;
 select * into a from public.exceptions where id=p_bo;
 select * into b from public.exceptions where id=p_stm;
 if a.status is distinct from 'open' or b.status is distinct from 'open' or a.manual_pair_id is not null or b.manual_pair_id is not null
   then raise exception 'คู่เคสไม่เปิดหรือถูกจองแล้ว'; end if;
 if p_id is null or coalesce(length(btrim(p_reason)),0) not between 10 and 2000 then raise exception 'ระบุเหตุผลอย่างน้อย 10 ตัวอักษร'; end if;
 proof:=public.validate_manual_pair(p_bo,p_stm,p_mode,p_evidence);
 bo_key:=a.company||'|'||a.direction||'|'||a.account||'|BO|'||md5(a.bo_raw);
 stm_key:=b.company||'|'||b.direction||'|'||b.account||'|STM|'||md5(b.stm_raw);
 if bo_key is null or stm_key is null then raise exception 'ต้นทางต้องมีบัญชีและข้อมูลอ้างอิง'; end if;
 for lock_key in select distinct k from unnest(array[bo_key,stm_key]) k order by k loop
   perform pg_advisory_xact_lock(hashtextextended(lock_key,1));
 end loop;
 if exists(select 1 from public.manual_pair_members m where m.released_at is null
   and (m.source_key in (bo_key,stm_key) or m.secondary_source_key in (bo_key,stm_key))) then
   raise exception 'รายการต้นทางถูกจองหรืออนุมัติไปแล้ว' using errcode='23505';
 end if;
 insert into public.manual_case_pairs(id,bo_case_id,stm_case_id,bo_company,stm_company,mode,difference,reason,evidence_id,snapshot,submitted_by)
   values(p_id,p_bo,p_stm,a.company,b.company,p_mode,(proof->>'difference')::numeric,btrim(p_reason),p_evidence,proof,auth.uid()) returning * into p;
 if a.id=b.id then
   insert into public.manual_pair_members(pair_id,exception_id,source_key,secondary_source_key)
     values(p.id,a.id,bo_key,stm_key);
 else
   insert into public.manual_pair_members(pair_id,exception_id,source_key)
     values(p.id,a.id,bo_key),(p.id,b.id,stm_key);
 end if;
 update public.exceptions set status='pair_pending',manual_pair_id=p.id,updated_at=now() where id in(a.id,b.id);
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail)
   values(auth.uid()::text,auth.uid(),'manual_pair_submit','manual_case_pair',p.id::text,p.reason);
 return p;
end $$;

notify pgrst,'reload schema';
commit;
