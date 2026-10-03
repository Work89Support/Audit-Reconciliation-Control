-- Additive collection ledger. Never infer an employee or payment from old records.
-- No historical updates, automatic case closure, or actual money transfers.
begin;
set local lock_timeout='5s';
set local statement_timeout='15s';
create table if not exists public.damage_collections (
  damage_id uuid primary key references public.damages(id),
  company text not null,
  category text not null check(category in ('employee','backoffice','pm','game','external')),
  party_code text not null check(length(btrim(party_code)) between 1 and 100),
  party_name text not null check(length(btrim(party_name)) between 1 and 200),
  shift text,
  approved_amount numeric(16,2) not null check(approved_amount>=0),
  reason text not null,
  approved_by uuid not null,
  approved_at timestamptz not null default now(),
  check(category<>'employee' or length(btrim(shift))>0)
);
create table if not exists public.damage_receipts (
  id uuid primary key,
  damage_id uuid not null references public.damage_collections(damage_id),
  company text not null,
  paid_at date not null,
  amount numeric(16,2) not null check(amount>0),
  transfer_reference text not null,
  source_file_id uuid not null unique references public.source_files(id),
  note text not null,
  confirmed_by uuid not null,
  confirmed_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  unique(company,transfer_reference)
);
alter table public.damage_collections enable row level security;
alter table public.damage_receipts enable row level security;
drop policy if exists damage_collections_read on public.damage_collections;
create policy damage_collections_read on public.damage_collections for select to authenticated
  using(public.current_user_active() and public.has_company_access(company));
drop policy if exists damage_receipts_read on public.damage_receipts;
create policy damage_receipts_read on public.damage_receipts for select to authenticated
  using(public.current_user_active() and public.has_company_access(company));
revoke all on public.damage_collections,public.damage_receipts from public,anon,authenticated;
grant select on public.damage_collections,public.damage_receipts to authenticated;

create or replace function public.approve_damage_collection(
  p_damage_id uuid,p_party_code text,p_party_name text,p_shift text,p_amount numeric,p_reason text
) returns setof public.damage_collections language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.damages%rowtype; c public.damage_collections%rowtype; category_value text;
begin
  if auth.uid() is null or not public.current_user_active() or coalesce(public.current_app_role(),'') not in ('lead','admin') then
    raise exception 'ไม่มีสิทธิ์อนุมัติยอดเรียกเก็บ' using errcode='42501';
  end if;
  select * into d from public.damages where id=p_damage_id for update;
  if not found or not public.has_company_access(d.company) then raise exception 'ไม่พบรายการหรือไม่มีสิทธิ์' using errcode='42501'; end if;
  if not coalesce(d.has_evidence,false) or d.exception_id is null
     or (not exists(select 1 from public.case_evidence f where f.exception_id=d.exception_id)
       and not exists(select 1 from public.exceptions e join public.source_files f on f.id=e.clarification_file_id
         where e.id=d.exception_id and f.kind='doc_clarify' and nullif(f.storage_path,'') is not null)) then
    raise exception 'ต้องมีหลักฐานจริงที่ผูกเคสก่อนอนุมัติเรียกเก็บ';
  end if;
  category_value := substring(d.cause from '^\[damage:v2:(employee|backoffice|pm|game|external)\]');
  if category_value is null then raise exception 'ประเภทเดิมยังไม่ชัดเจน ต้องตรวจสอบก่อน ไม่แปลงอัตโนมัติ'; end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<0
     or p_amount<>round(p_amount,2) or p_amount>coalesce(d.amount_thb,d.amount) then raise exception 'ยอดเรียกเก็บไม่ถูกต้องหรือเกินยอดเสียหาย'; end if;
  if coalesce(length(btrim(p_party_code)),0) not between 1 and 100 or coalesce(length(btrim(p_party_name)),0) not between 1 and 200
     or coalesce(length(btrim(p_reason)),0) not between 10 and 2000 or length(p_shift)>32 then raise exception 'ต้องยืนยันรหัส ชื่อ และเหตุผล'; end if;
  if category_value='employee' and (coalesce(btrim(p_shift),'') in ('','-','รอยืนยันกะ')
     or coalesce(btrim(d.employee),'') in ('','-','ไม่ระบุ','รอยืนยันผู้เกี่ยวข้อง')
     or nullif(btrim(d.employee),'') is null or nullif(btrim(d.shift),'') is null
     or btrim(p_party_name)<>btrim(d.employee) or btrim(p_shift)<>btrim(d.shift)) then
    raise exception 'ชื่อและกะต้องตรงทะเบียน ห้ามเลือกพนักงานอื่น';
  end if;
  if category_value='employee' then
    perform pg_advisory_xact_lock(hashtextextended(d.company||'|'||btrim(p_party_code),0));
  end if;
  if category_value='employee' and exists(select 1 from public.damage_collections other
      where other.company=d.company and other.category='employee' and other.party_code=btrim(p_party_code)
      and other.party_name<>btrim(p_party_name)) then
    raise exception 'รหัสพนักงานนี้มีชื่ออื่นในทะเบียน ต้องตรวจตัวคนก่อน';
  end if;
  select * into c from public.damage_collections where damage_id=d.id;
  if found then
    if c.party_code=btrim(p_party_code) and c.party_name=btrim(p_party_name) and c.shift is not distinct from nullif(btrim(p_shift),'')
      and c.approved_amount=p_amount and c.reason=btrim(p_reason) then return next c; return; end if;
    raise exception 'อนุมัติผู้รับผิดชอบแล้ว ไม่เขียนทับตัวคนหรือยอดเดิม';
  end if;
  insert into public.damage_collections(damage_id,company,category,party_code,party_name,shift,approved_amount,reason,approved_by)
    values(d.id,d.company,category_value,btrim(p_party_code),btrim(p_party_name),nullif(btrim(p_shift),''),p_amount,btrim(p_reason),auth.uid()) returning * into c;
  insert into public.audit_log(actor,actor_user_id,action,entity,target,detail)
    values(auth.uid()::text,auth.uid(),'approve_collection','damage',d.id::text,btrim(p_reason));
  return next c;
end $$;

create or replace function public.confirm_damage_receipt(
  p_id uuid,p_damage_id uuid,p_paid_at date,p_amount numeric,p_reference text,p_source_file_id uuid,p_note text
) returns setof public.damage_receipts language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.damage_collections%rowtype; r public.damage_receipts%rowtype; paid numeric; d public.damages%rowtype;
begin
  if auth.uid() is null or not public.current_user_active() or coalesce(public.current_app_role(),'') not in ('lead','admin') then
    raise exception 'ไม่มีสิทธิ์ยืนยันยอดโอนคืน' using errcode='42501'; end if;
  select * into c from public.damage_collections where damage_id=p_damage_id for update;
  if not found or not public.has_company_access(c.company) then raise exception 'ต้องอนุมัติตัวคนและยอดเรียกเก็บก่อน' using errcode='42501'; end if;
  select * into r from public.damage_receipts where id=p_id;
  if found then
    if r.damage_id=p_damage_id and r.paid_at=p_paid_at and r.amount=p_amount and r.transfer_reference=upper(btrim(p_reference))
      and r.source_file_id=p_source_file_id and r.note=btrim(p_note) and r.voided_at is null then return next r; return; end if;
    raise exception 'รหัสบันทึกซ้ำแต่ข้อมูลไม่ตรง'; end if;
  select * into d from public.damages where id=p_damage_id;
  if d.company is distinct from c.company or substring(d.cause from '^\[damage:v2:(employee|backoffice|pm|game|external)\]') is distinct from c.category then
    raise exception 'บริษัทหรือประเภททะเบียนเปลี่ยน ต้องตรวจสอบก่อนรับโอนคืน'; end if;
  if p_paid_at is null or p_paid_at<d.business_date or p_paid_at>current_date then raise exception 'วันที่โอนต้องไม่ก่อนเหตุหรือเป็นอนาคต'; end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0 or p_amount<>round(p_amount,2)
     or coalesce(length(btrim(p_reference)),0) not between 1 and 200 or coalesce(length(btrim(p_note)),0) not between 10 and 2000 then
    raise exception 'ยอด รหัสโอน หรือเหตุผลไม่ครบ'; end if;
  if not exists(select 1 from public.source_files f where f.id=p_source_file_id and f.kind='doc_clarify'
      and f.company=c.company and nullif(f.storage_path,'') is not null
      and exists(select 1 from storage.objects o where o.bucket_id='audit-files' and o.name=f.storage_path)) then
    raise exception 'หลักฐานต้องเป็นไฟล์จริงของบริษัทเดียวกัน'; end if;
  select coalesce(sum(amount),0) into paid from public.damage_receipts where damage_id=p_damage_id and voided_at is null;
  if paid+p_amount>c.approved_amount then raise exception 'ยอดโอนรวมเกินยอดอนุมัติเรียกเก็บ'; end if;
  insert into public.damage_receipts(id,damage_id,company,paid_at,amount,transfer_reference,source_file_id,note,confirmed_by)
    values(p_id,c.damage_id,c.company,p_paid_at,p_amount,upper(btrim(p_reference)),p_source_file_id,btrim(p_note),auth.uid()) returning * into r;
  insert into public.audit_log(actor,actor_user_id,action,entity,target,detail)
    values(auth.uid()::text,auth.uid(),'confirm_receipt','damage',c.damage_id::text,btrim(p_note));
  return next r;
end $$;
create or replace function public.void_damage_receipt(p_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.damage_receipts%rowtype;
begin
  if auth.uid() is null or not public.current_user_active() or coalesce(public.current_app_role(),'') not in ('lead','admin') then raise exception 'ไม่มีสิทธิ์' using errcode='42501'; end if;
  select * into r from public.damage_receipts where id=p_id;
  if not found or not public.has_company_access(r.company) then raise exception 'ไม่พบรายการหรือไม่มีสิทธิ์' using errcode='42501'; end if;
  perform 1 from public.damage_collections where damage_id=r.damage_id for update;
  if coalesce(length(btrim(p_reason)),0) not between 10 and 2000 then raise exception 'ต้องระบุเหตุผล 10–2000 ตัวอักษร'; end if;
  update public.damage_receipts set voided_at=now(),voided_by=auth.uid(),void_reason=btrim(p_reason) where id=p_id and voided_at is null;
  if found then insert into public.audit_log(actor,actor_user_id,action,entity,target,detail)
    values(auth.uid()::text,auth.uid(),'void_receipt','damage',r.damage_id::text,btrim(p_reason)); end if;
end $$;
revoke all on function public.approve_damage_collection(uuid,text,text,text,numeric,text),public.confirm_damage_receipt(uuid,uuid,date,numeric,text,uuid,text),public.void_damage_receipt(uuid,text) from public,anon;
grant execute on function public.approve_damage_collection(uuid,text,text,text,numeric,text),public.confirm_damage_receipt(uuid,uuid,date,numeric,text,uuid,text),public.void_damage_receipt(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
