-- Authorized head self-review exception; no historical case is closed by migration.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
alter table public.manual_case_pairs add column self_approved boolean not null default false;
do $migration$
declare c text;
begin
 select conname into strict c from pg_constraint where conrelid='public.manual_case_pairs'::regclass and contype='c'
   and pg_get_constraintdef(oid) like '%decided_by <> submitted_by%';
 execute format('alter table public.manual_case_pairs drop constraint %I',c);
end $migration$;
alter table public.manual_case_pairs add constraint manual_pair_self_review_shape
 check ((not self_approved and (decided_by is null or decided_by<>submitted_by))
   or (self_approved and decided_by=submitted_by and status='approved' and mode='same' and bo_company=stm_company and difference<=5));
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
 if a.status is null or b.status is null or not (a.status='open' and b.status='open' or (a.id=b.id and a.ex_type='amount_diff' and a.status in ('clarifying','answered'))) or a.manual_pair_id is not null or b.manual_pair_id is not null
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

create or replace function public.decide_manual_case_pair(p_id uuid,p_action text,p_note text)
 returns public.manual_case_pairs language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.manual_case_pairs%rowtype; proof jsonb; a public.exceptions%rowtype; b public.exceptions%rowtype;
begin
 if p_action='approve' and coalesce(length(btrim(p_note)),0)=0 then p_note:='หัวหน้าตรวจหลักฐานและอนุมัติปิดเคส'; end if;
 if auth.uid() is null or not public.current_user_active() or coalesce(public.current_app_role(),'') not in ('lead','admin')
   then raise exception 'เฉพาะหัวหน้าทีมอนุมัติได้' using errcode='42501'; end if;
 -- Same lock order as submit: exceptions then pair. Pair row lock follows member locks.
 select * into p from public.manual_case_pairs where id=p_id;
 if not found or not public.has_company_access(p.bo_company) or not public.has_company_access(p.stm_company)
   then raise exception 'ไม่พบคำขอหรือไม่มีสิทธิ์' using errcode='42501'; end if;
 perform 1 from public.exceptions where id in(p.bo_case_id,p.stm_case_id) order by id for update;
 select * into p from public.manual_case_pairs where id=p_id for update;
 
 if p_action is null or p_action not in('approve','reject') or coalesce(length(btrim(p_note)),0)>2000 or (p_action='reject' and coalesce(length(btrim(p_note)),0)<10)
   then raise exception 'ระบุผลและเหตุผลอย่างน้อย 10 ตัวอักษร'; end if;
 if p.status<>'pending' then
   if p.decided_by=auth.uid() and p.decision_note=btrim(p_note) and p.status=(case when p_action='approve' then 'approved' else 'rejected' end) then return p; end if;
   raise exception 'คำขอไม่ได้รออนุมัติ';
 end if;
 select * into a from public.exceptions where id=p.bo_case_id;
 select * into b from public.exceptions where id=p.stm_case_id;
 if a.status<>'pair_pending' or b.status<>'pair_pending' or a.manual_pair_id is distinct from p.id or b.manual_pair_id is distinct from p.id then raise exception 'สถานะคู่เคสเปลี่ยน ต้องตรวจใหม่'; end if;
 if p.submitted_by=auth.uid() then
   if p_action<>'approve' or p.mode<>'same' or p.bo_company<>p.stm_company or p.difference>5
     or not (
       exists(select 1 from public.case_evidence f join storage.objects o on o.name=f.storage_path and o.bucket_id='audit-files'
         where (f.id=p.evidence_id or p.evidence_id is null) and f.exception_id in(a.id,b.id) and f.size_bytes>0)
       or exists(select 1 from public.source_files f join storage.objects o on o.name=f.storage_path and o.bucket_id='audit-files'
         where f.id in(a.clarification_file_id,b.clarification_file_id))
     ) then raise exception 'คำขอตัวเองต้องเป็นบริษัทเดียวกัน ไม่เกิน 5 บาท และมีหลักฐานในคลังจริง'; end if;
 end if;
 if p_action='approve' then
   proof:=public.validate_manual_pair(a.id,b.id,p.mode,p.evidence_id);
   -- Compare source lineage, amounts and dates, not mutable notes/checklist fields.
   if exists(select 1 from unnest(array['run_id','company','business_date','direction','account','currency','system_amount','bank_amount','bo_raw','stm_raw','ex_type']) k
     where proof->'bo'->k is distinct from p.snapshot->'bo'->k or proof->'stm'->k is distinct from p.snapshot->'stm'->k)
     then raise exception 'ต้นทางหรือยอดเปลี่ยนหลังส่งคำขอ ต้องตรวจใหม่'; end if;
 end if;
 update public.manual_case_pairs set status=case when p_action='approve' then 'approved' else 'rejected' end,
   decided_by=auth.uid(),decided_at=now(),decision_note=btrim(p_note),self_approved=(p.submitted_by=auth.uid()) where id=p.id returning * into p;
 if p_action='approve' then
   update public.exceptions set status='closed',auto_closed=false,approved_by=auth.uid(),approved_at=now(),resolved_by=auth.uid()::text,resolved_at=now(),
     resolution_note='ปิดคู่โดยหัวหน้าทีม — Audit จับคู่เอง '||p.id||' ผลต่าง '||p.difference||' บาท: '||p.reason||' / '||p_note,updated_at=now()
     where id in(p.bo_case_id,p.stm_case_id);
 else
   update public.exceptions set status=coalesce(case when id=p.bo_case_id then p.snapshot->'bo'->>'status' else p.snapshot->'stm'->>'status' end,'open'),manual_pair_id=null,updated_at=now() where id in(p.bo_case_id,p.stm_case_id);
   update public.manual_pair_members set released_at=now() where pair_id=p.id;
 end if;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail)
   values(auth.uid()::text,auth.uid(),case when p.self_approved then 'manual_pair_self_approve' else 'manual_pair_'||p_action end,'manual_case_pair',p.id::text,btrim(p_note));
 return p;
end $$;

create or replace function public.guard_manual_pair_case() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.manual_case_pairs%rowtype;
begin
 if old.manual_pair_id is null and new.manual_pair_id is null then return new; end if;
 select * into p from public.manual_case_pairs where id=coalesce(old.manual_pair_id,new.manual_pair_id);
 if p.id is null or old.id not in(p.bo_case_id,p.stm_case_id) then raise exception 'คำขอจับคู่ไม่ถูกต้อง'; end if;
 if old.manual_pair_id is null then
   if new.manual_pair_id=p.id and new.status='pair_pending' and (old.status='open' or (p.bo_case_id=p.stm_case_id and old.ex_type='amount_diff' and old.status in ('clarifying','answered'))) and p.status='pending' and p.submitted_by=auth.uid() then return new; end if;
 elsif old.status='pair_pending' then
   if new.status='closed' and p.status='approved' and p.decided_by=auth.uid() and new.manual_pair_id=p.id then return new; end if;
   if new.status=coalesce(case when old.id=p.bo_case_id then p.snapshot->'bo'->>'status' else p.snapshot->'stm'->>'status' end,'open') and p.status='rejected' and p.decided_by=auth.uid() and new.manual_pair_id is null then return new; end if;
   if new.status=old.status and new.manual_pair_id=old.manual_pair_id
     and (to_jsonb(new)-array['updated_at','cause','employee','shift','response_text'])=(to_jsonb(old)-array['updated_at','cause','employee','shift','response_text']) then return new; end if;
 else
   if new.manual_pair_id=old.manual_pair_id and new.status=old.status then return new; end if;
 end if;
 raise exception 'คู่เคสถูกจองไว้ ต้องใช้หัวหน้าทีมอนุมัติ/ไม่อนุมัติคำขอจับคู่';
end $$;

notify pgrst,'reload schema';
commit;
