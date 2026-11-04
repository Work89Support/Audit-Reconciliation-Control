-- Production bank-account master for reconciliation controls.
-- Parsed STM accounts enter as pending candidates; only Lead/Admin approval
-- makes them selectable. Existing reconciliation results and cases are untouched.
begin;
set local lock_timeout='5s';

create table if not exists public.audit_bank_accounts(
 company text not null references public.audit_companies(code) on update cascade,
 bank text not null,
 account text not null,
 account_name text,
 status text not null default 'pending' check(status in ('pending','active','rejected')),
 source_kind text not null default 'stm_candidate',
 source_ref text,
 first_seen_at timestamptz not null default clock_timestamp(),
 last_seen_at timestamptz not null default clock_timestamp(),
 approved_at timestamptz,
 approved_by uuid references auth.users(id),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id),
 review_reason text,
 revision integer not null default 1 check(revision>0),
 primary key(company,account),
 check(account=regexp_replace(account,'[^0-9]','','g') and length(account) between 6 and 20),
 check(length(btrim(bank))>=2),
 check(status<>'active' or length(btrim(coalesce(account_name,'')))>=2)
);
alter table public.audit_bank_accounts enable row level security;
revoke all on public.audit_bank_accounts from public,anon,authenticated;

create or replace function public.bank_account_registry_rows() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(to_jsonb(a) order by a.company,a.bank,a.account),'[]'::jsonb)
 from public.audit_bank_accounts a
 where public.account_review_hold_access(a.company)
 and coalesce(public.current_app_role() in ('lead','monitor','audit_assistant','shift_lead','exec','admin'),false)
$$;

create or replace function public.manage_bank_account_registry(
 p_action text,p_company text,p_account text,p_bank text,p_account_name text,
 p_reason text,p_expected_revision integer
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 normalized text:=regexp_replace(coalesce(p_account,''),'[^0-9]','','g');
 role_name text:=public.current_app_role();
 row_data public.audit_bank_accounts;
begin
 if auth.uid() is null or role_name not in ('lead','admin') or not public.account_review_hold_access(upper(p_company))
 then raise exception 'เฉพาะหัวหน้าออดิทหรือผู้ดูแลระบบที่มีสิทธิ์บริษัท' using errcode='42501';end if;
 if p_action not in ('approve','reject') or length(normalized) not between 6 and 20
 or length(btrim(coalesce(p_reason,'')))<10 then raise exception 'ข้อมูลตรวจบัญชีไม่ครบหรือเหตุผลสั้นกว่า 10 ตัวอักษร';end if;
 perform pg_advisory_xact_lock(hashtextextended(upper(p_company)||':'||normalized,0));
 select * into row_data from public.audit_bank_accounts where company=upper(p_company) and account=normalized for update;
 if not found then raise exception 'ไม่พบบัญชีที่รอตรวจ';end if;
 if p_expected_revision is null or p_expected_revision<>row_data.revision then raise exception 'ข้อมูลถูกเปลี่ยนแล้ว กรุณาโหลดใหม่';end if;
 if p_action='approve' then
  if length(btrim(coalesce(p_bank,'')))<2 or length(btrim(coalesce(p_account_name,'')))<2 then raise exception 'ระบุธนาคารและชื่อบัญชีให้ครบ';end if;
  update public.audit_bank_accounts set bank=upper(btrim(p_bank)),account_name=btrim(p_account_name),status='active',
   approved_at=clock_timestamp(),approved_by=auth.uid(),reviewed_at=clock_timestamp(),reviewed_by=auth.uid(),
   review_reason=btrim(p_reason),revision=revision+1 where company=row_data.company and account=row_data.account returning * into row_data;
 else
  update public.audit_bank_accounts set status='rejected',reviewed_at=clock_timestamp(),reviewed_by=auth.uid(),
   review_reason=btrim(p_reason),revision=revision+1 where company=row_data.company and account=row_data.account returning * into row_data;
 end if;
 insert into public.audit_log(actor,actor_user_id,action,entity,target,company,detail,meta)
 values(auth.uid()::text,auth.uid(),'bank_account_registry_'||p_action,'audit_bank_account',row_data.account,row_data.company,
  row_data.review_reason,jsonb_build_object('bank',row_data.bank,'account_name',row_data.account_name,'source_kind',row_data.source_kind,'source_ref',row_data.source_ref,'revision',row_data.revision));
 return to_jsonb(row_data);
end$$;

-- Every completed run can propose newly observed STM accounts. The trigger does
-- not activate, reject, hold, close, or reconcile anything.
create or replace function public.capture_recon_bank_account_candidates() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb;company_code text;account_digits text;bank_code text;
begin
 for item in select value from jsonb_array_elements(coalesce(new.summary#>'{bo_first,received}','[]'::jsonb)) loop
  if upper(coalesce(item->>'kind',''))<>'STM' then continue;end if;
  account_digits:=regexp_replace(coalesce(item->>'identity',''),'[^0-9]','','g');
  if length(account_digits) not between 6 and 20 then continue;end if;
  company_code:=upper(coalesce(item->>'company',new.company,''));
  if company_code='7M' then company_code:='UFABET7M';end if;
  bank_code:=upper(coalesce(nullif(split_part(btrim(coalesce(item->>'label','')),' ',1),''),'UNKNOWN'));
  if bank_code='UNKNOWN' then continue;end if;
  insert into public.audit_bank_accounts(company,bank,account,account_name,status,source_kind,source_ref)
  values(company_code,bank_code,account_digits,null,'pending','recon_run',new.id::text)
  on conflict(company,account) do update set last_seen_at=clock_timestamp(),
   source_ref=case when public.audit_bank_accounts.status='pending' then excluded.source_ref else public.audit_bank_accounts.source_ref end;
 end loop;
 return new;
end$$;
drop trigger if exists capture_recon_bank_account_candidates on public.recon_runs;
create trigger capture_recon_bank_account_candidates after insert or update of summary on public.recon_runs
for each row execute function public.capture_recon_bank_account_candidates();

insert into public.audit_bank_accounts(company,bank,account,account_name,status,source_kind)
values
('3XB','KBANK','1968766313','นาย นราธิป ขุนอาจ','active','static_registry'),
('3XB','SCB','5034632277','นางสาว สงกรานต์ สร้อยแก้ว','active','static_registry'),
('3XB','SCB','5034625466','นาย ชานิชน์ ชมพิมาย','active','static_registry'),
('3XB','KBANK','1998024354','นาย สุพจน์ บุญธรรม','active','static_registry'),
('3XB','KBANK','2231661134','นาย วายุ บุญสร้าง','active','static_registry'),
('3XB','KBANK','2308381717','นาย วีรยุทธ ลายหม้อ','active','static_registry'),
('3XB','KBANK','1938713800','นาย ประวิตร ประวาร','active','static_registry'),
('3XB','KTB','6060748201','นาย นราธิป ขุนอาจ','active','static_registry'),
('3XB','BBL','6517247760','นาย จิรายุ แสงย้อย','active','static_registry'),
('3XB','KTB','6640748576','นวพล เหลืองอ่อน','active','static_registry'),
('FR8','KBANK','2273888465','น.ส. สุวรรณี สร้อยแก้ว','active','static_registry'),
('FR8','KBANK','1981674096','น.ส. จิรภัทร์ เกื้อกูล','active','static_registry'),
('FR8','SCB','4142322778','นางสาว สิริพร แซ่โป่ว','active','static_registry'),
('FR8','KTB','3473031801','นางสาว รวิวรรณ์ คำมี','active','static_registry'),
('FR8','BBL','6517250129','น.ส.เพ็ญศรี เกิดนิมิตร','active','static_registry'),
('FR8','SCB','4311918665','จิตติพัฒน์','active','static_registry'),
('FR8','SCB','5034633029','นาย ภานุพงษ์ พร้อมจิตย์','active','static_registry'),
('FR8','SCB','4102050696','นาย อำนาจ สาธุชาติ','active','verified_user'),
('AT4','BBL','6517248040','นาย นรวร ผาสุข','active','static_registry'),
('AT4','KTB','2090879114','นางสาว เบญจพร สุดตา','active','static_registry'),
('AT4','KTB','6060748139','นางสาว รัตนาพร มาคะบุตร','active','static_registry'),
('SK8','BBL','6517249394','น.ส. ดลยา หอมจันทร์','active','static_registry'),
('SK8','LBK','1968765058','นางสาว ปาหนัน สุขใจ','active','static_registry'),
('MR9','SCB','5034674009','คุณากร','active','static_registry'),
('MR9','KBANK','1998218930','น.ส. สิริพร แซ่โป่ว','active','static_registry'),
('MR9','KTB','6648590203','นาย มโนชา ชมภู','active','static_registry'),
('MC8','SCB','4312127429','นางสาว จันทร์ทิวา อินพุ่ม','active','static_registry'),
('MC8','KBANK','1998545397','นาย ทินกร โฉมสะอาด','active','static_registry'),
('MC8','BAY','1701694610','นาย อภิเชษฐ์ จันทร์สำราญ','active','static_registry'),
('UR9','SCB','4201154177','คมสัน','active','static_registry'),
('UR9','KBANK','1998227220','นาย ชัยยา จันทรโชติ','active','static_registry'),
('UR9','KTB','6657497121','นาย ณัฐพล งามถนอม','active','static_registry'),
('UR9','KTB','6643745675','นาย คมสัน ศรีพันธ์','active','static_registry'),
('PS8','SCB','5292894087','นาย นรวร ผาสุข','active','static_registry'),
('PS8','KTB','6640746468','นาย ธนวิชญ์ จานทอง','active','static_registry'),
('UFABET7M','KBANK','1953167154','น.ส. เพ็ญศรี เกิดนิมิตร','active','static_registry'),
('UFABET7M','TMN','0812792075','คุณรุ่งฟ้า แซ่ตั้ง','active','static_registry'),
('UFABET7M','TMN','0639274201','คุณสรวิศา อาญาเมือง','active','static_registry'),
('UFABET7M','SCB','5034633891','นาย สมภพ ไวไธสง','active','static_registry'),
('UFABET7M','KBANK','1953583301','นาย กิตติ ปานแสงทอง','active','static_registry'),
('UFABET7M','SCB','6242596342','นางสาว แววดาว ประกอบทรัพย์','active','static_registry'),
('UFABET7M','SCB','5034633346','นาย สุคร ชัยภา','active','static_registry')
on conflict(company,account) do update set
 bank=excluded.bank,account_name=excluded.account_name,status='active',source_kind=excluded.source_kind,
 approved_at=coalesce(public.audit_bank_accounts.approved_at,clock_timestamp()),
 last_seen_at=clock_timestamp(),revision=public.audit_bank_accounts.revision+1
where public.audit_bank_accounts.bank is distinct from excluded.bank
   or public.audit_bank_accounts.account_name is distinct from excluded.account_name
   or public.audit_bank_accounts.status is distinct from 'active'
   or public.audit_bank_accounts.source_kind is distinct from excluded.source_kind;

revoke all on function public.bank_account_registry_rows(),public.manage_bank_account_registry(text,text,text,text,text,text,integer) from public,anon;
grant execute on function public.bank_account_registry_rows(),public.manage_bank_account_registry(text,text,text,text,text,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
