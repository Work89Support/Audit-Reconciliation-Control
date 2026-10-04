-- Additive manual pairing; does not close existing cases or change historical amounts.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table public.manual_case_pairs (
 id uuid primary key,
 bo_case_id uuid not null references public.exceptions(id),
 stm_case_id uuid not null references public.exceptions(id),
 bo_company text not null, stm_company text not null,
 mode text not null check(mode in ('same','cross')),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 difference numeric(16,2) not null check(difference between 0 and 5),
 reason text not null check(length(btrim(reason)) between 10 and 2000),
 evidence_id uuid references public.case_evidence(id),
 snapshot jsonb not null,
 submitted_by uuid not null references auth.users(id), submitted_at timestamptz not null default now(),
 decided_by uuid references auth.users(id), decided_at timestamptz, decision_note text,
 check(bo_case_id<>stm_case_id),check(mode<>'cross' or evidence_id is not null),
 check(decided_by is null or decided_by<>submitted_by)
);
create table public.manual_pair_members (
 pair_id uuid not null references public.manual_case_pairs(id),
 exception_id uuid not null references public.exceptions(id),
 source_key text not null, released_at timestamptz,
 primary key(pair_id,exception_id)
);
create unique index manual_pair_case_reserved on public.manual_pair_members(exception_id) where released_at is null;
create unique index manual_pair_source_reserved on public.manual_pair_members(source_key) where released_at is null;
alter table public.exceptions add column manual_pair_id uuid references public.manual_case_pairs(id);
alter table public.manual_case_pairs enable row level security;
alter table public.manual_pair_members enable row level security;
create policy manual_pairs_read on public.manual_case_pairs for select to authenticated
 using(public.current_user_active() and public.has_company_access(bo_company) and public.has_company_access(stm_company));
create policy manual_members_read on public.manual_pair_members for select to authenticated
 using(exists(select 1 from public.manual_case_pairs p where p.id=pair_id));
revoke all on public.manual_case_pairs,public.manual_pair_members from public,anon,authenticated;
grant select on public.manual_case_pairs,public.manual_pair_members to authenticated;

create function public.manual_pair_source_key(e public.exceptions) returns text language sql immutable
 set search_path=public,pg_temp as $$
 select e.company||'|'||e.direction||'|'||e.account||'|'||
 case when e.ex_type='missing_stm' then 'BO|'||md5(e.bo_raw) else 'STM|'||md5(e.stm_raw) end
$$;
revoke all on function public.manual_pair_source_key(public.exceptions) from public,anon,authenticated;

create function public.validate_manual_pair(p_bo uuid,p_stm uuid,p_mode text,p_evidence uuid)
 returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.exceptions%rowtype; b public.exceptions%rowtype; difference numeric;
begin
 select * into a from public.exceptions where id=p_bo;
 select * into b from public.exceptions where id=p_stm;
 if a.id is null or b.id is null or a.id=b.id or not public.has_company_access(a.company) or not public.has_company_access(b.company)
   then raise exception 'ไม่พบคู่เคสหรือไม่มีสิทธิ์ทั้งสองบริษัท' using errcode='42501'; end if;
 if a.ex_type<>'missing_stm' or b.ex_type<>'missing_bo' or a.direction is distinct from b.direction
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
 return jsonb_build_object('bo',to_jsonb(a),'stm',to_jsonb(b),'difference',difference);
end $$;
revoke all on function public.validate_manual_pair(uuid,uuid,text,uuid) from public,anon,authenticated;

create function public.submit_manual_case_pair(p_id uuid,p_bo uuid,p_stm uuid,p_mode text,p_reason text,p_evidence uuid default null)
 returns public.manual_case_pairs language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.manual_case_pairs%rowtype; proof jsonb; a public.exceptions%rowtype; b public.exceptions%rowtype;
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
 insert into public.manual_case_pairs(id,bo_case_id,stm_case_id,bo_company,stm_company,mode,difference,reason,evidence_id,snapshot,submitted_by)
   values(p_id,p_bo,p_stm,a.company,b.company,p_mode,(proof->>'difference')::numeric,btrim(p_reason),p_evidence,proof,auth.uid()) returning * into p;
 insert into public.manual_pair_members(pair_id,exception_id,source_key) values
   (p.id,a.id,public.manual_pair_source_key(a)),(p.id,b.id,public.manual_pair_source_key(b));
 update public.exceptions set status='pair_pending',manual_pair_id=p.id,updated_at=now() where id in(a.id,b.id);
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail)
   values(auth.uid()::text,auth.uid(),'manual_pair_submit','manual_case_pair',p.id::text,p.reason);
 return p;
end $$;

create function public.decide_manual_case_pair(p_id uuid,p_action text,p_note text)
 returns public.manual_case_pairs language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.manual_case_pairs%rowtype; proof jsonb; a public.exceptions%rowtype; b public.exceptions%rowtype;
begin
 if auth.uid() is null or not public.current_user_active() or coalesce(public.current_app_role(),'') not in ('lead','admin')
   then raise exception 'เฉพาะหัวหน้าทีมอนุมัติได้' using errcode='42501'; end if;
 -- Same lock order as submit: exceptions then pair. Pair row lock follows member locks.
 select * into p from public.manual_case_pairs where id=p_id;
 if not found or not public.has_company_access(p.bo_company) or not public.has_company_access(p.stm_company)
   then raise exception 'ไม่พบคำขอหรือไม่มีสิทธิ์' using errcode='42501'; end if;
 perform 1 from public.exceptions where id in(p.bo_case_id,p.stm_case_id) order by id for update;
 select * into p from public.manual_case_pairs where id=p_id for update;
 if p.submitted_by=auth.uid() then raise exception 'ผู้ส่งคำขอห้ามอนุมัติหรือปฏิเสธคำขอของตนเอง'; end if;
 if p_action is null or p_action not in('approve','reject') or coalesce(length(btrim(p_note)),0) not between 10 and 2000
   then raise exception 'ระบุผลและเหตุผลอย่างน้อย 10 ตัวอักษร'; end if;
 if p.status<>'pending' then
   if p.decided_by=auth.uid() and p.decision_note=btrim(p_note) and p.status=(case when p_action='approve' then 'approved' else 'rejected' end) then return p; end if;
   raise exception 'คำขอไม่ได้รออนุมัติ';
 end if;
 select * into a from public.exceptions where id=p.bo_case_id;
 select * into b from public.exceptions where id=p.stm_case_id;
 if a.status<>'pair_pending' or b.status<>'pair_pending' or a.manual_pair_id is distinct from p.id or b.manual_pair_id is distinct from p.id then raise exception 'สถานะคู่เคสเปลี่ยน ต้องตรวจใหม่'; end if;
 if p_action='approve' then
   proof:=public.validate_manual_pair(a.id,b.id,p.mode,p.evidence_id);
   -- Compare source lineage, amounts and dates, not mutable notes/checklist fields.
   if exists(select 1 from unnest(array['run_id','company','business_date','direction','account','currency','system_amount','bank_amount','bo_raw','stm_raw','ex_type']) k
     where proof->'bo'->k is distinct from p.snapshot->'bo'->k or proof->'stm'->k is distinct from p.snapshot->'stm'->k)
     then raise exception 'ต้นทางหรือยอดเปลี่ยนหลังส่งคำขอ ต้องตรวจใหม่'; end if;
 end if;
 update public.manual_case_pairs set status=case when p_action='approve' then 'approved' else 'rejected' end,
   decided_by=auth.uid(),decided_at=now(),decision_note=btrim(p_note) where id=p.id returning * into p;
 if p_action='approve' then
   update public.exceptions set status='closed',auto_closed=false,approved_by=auth.uid(),approved_at=now(),resolved_by=auth.uid()::text,resolved_at=now(),
     resolution_note='ปิดคู่โดยหัวหน้าทีม — Audit จับคู่เอง '||p.id||' ผลต่าง '||p.difference||' บาท: '||p.reason||' / '||p_note,updated_at=now()
     where id in(p.bo_case_id,p.stm_case_id);
 else
   update public.exceptions set status='open',manual_pair_id=null,updated_at=now() where id in(p.bo_case_id,p.stm_case_id);
   update public.manual_pair_members set released_at=now() where pair_id=p.id;
 end if;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,detail)
   values(auth.uid()::text,auth.uid(),'manual_pair_'||p_action,'manual_case_pair',p.id::text,btrim(p_note));
 return p;
end $$;

-- Never allow the existing quick-close/status endpoints to bypass paired approval.
create function public.guard_manual_pair_case() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.manual_case_pairs%rowtype;
begin
 if old.manual_pair_id is null and new.manual_pair_id is null then return new; end if;
 select * into p from public.manual_case_pairs where id=coalesce(old.manual_pair_id,new.manual_pair_id);
 if p.id is null or old.id not in(p.bo_case_id,p.stm_case_id) then raise exception 'คำขอจับคู่ไม่ถูกต้อง'; end if;
 if old.manual_pair_id is null then
   if new.manual_pair_id=p.id and new.status='pair_pending' and old.status='open' and p.status='pending' and p.submitted_by=auth.uid() then return new; end if;
 elsif old.status='pair_pending' then
   if new.status='closed' and p.status='approved' and p.decided_by=auth.uid() and new.manual_pair_id=p.id then return new; end if;
   if new.status='open' and p.status='rejected' and p.decided_by=auth.uid() and new.manual_pair_id is null then return new; end if;
   if new.status=old.status and new.manual_pair_id=old.manual_pair_id
     and (to_jsonb(new)-array['updated_at','cause','employee','shift','response_text'])=(to_jsonb(old)-array['updated_at','cause','employee','shift','response_text']) then return new; end if;
 else
   if new.manual_pair_id=old.manual_pair_id and new.status=old.status then return new; end if;
 end if;
 raise exception 'คู่เคสถูกจองไว้ ต้องใช้หัวหน้าทีมอนุมัติ/ไม่อนุมัติคำขอจับคู่';
end $$;
create trigger exceptions_manual_pair_guard before update on public.exceptions for each row execute function public.guard_manual_pair_case();
revoke all on function public.guard_manual_pair_case() from public,anon,authenticated;
revoke all on function public.submit_manual_case_pair(uuid,uuid,uuid,text,text,uuid),public.decide_manual_case_pair(uuid,text,text) from public,anon;
grant execute on function public.submit_manual_case_pair(uuid,uuid,uuid,text,text,uuid),public.decide_manual_case_pair(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
