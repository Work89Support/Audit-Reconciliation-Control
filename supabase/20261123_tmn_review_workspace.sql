-- ข้อมูลร่าง OCR สำหรับ Audit; ไม่เปลี่ยนผลหลัก ยอด หรือเคสเดิม
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table if not exists public.tmn_ocr_review_drafts (
 source_file_id uuid not null references public.source_files(id),
 source_checksum text not null check(source_checksum ~ '^[a-f0-9]{64}$'),
 company text not null check(company='UFABET7M'),business_date date not null,
 draft jsonb not null,updated_at timestamptz not null default now(),
 primary key(source_file_id,source_checksum)
);
alter table public.tmn_ocr_review_drafts enable row level security;
revoke all on public.tmn_ocr_review_drafts from public,anon,authenticated;
-- อ่านผ่าน RPC ที่ตรวจบทบาท บริษัท และ checksum ปัจจุบันเท่านั้น
create or replace function public.store_tmn_review_drafts(p_company text,p_date date,p_files jsonb,p_allowed uuid[])
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb;d jsonb;f public.source_files%rowtype;b public.mail_batches%rowtype;
begin
 if p_company<>'UFABET7M' then return;end if;
 for item in select value from jsonb_array_elements(coalesce(p_files,'[]')) loop
  d:=item->'tmn_review_draft';if d is null or d='null'::jsonb then continue;end if;
  if not((item->>'id')::uuid=any(p_allowed)) then raise exception 'TMN review file outside job';end if;
  select * into strict f from public.source_files where id=(item->>'id')::uuid;
  select * into strict b from public.mail_batches where id=f.batch_id;
  if f.kind<>'stm_pdf' or coalesce(f.company,b.company)<>p_company or b.business_date not between p_date and p_date+1
   or d->>'sourceId' is distinct from f.id::text or d->>'sourceChecksum' is distinct from f.checksum
   or d->>'company' is distinct from p_company or d->>'businessDate' is distinct from b.business_date::text
   or d->>'sourceType' is distinct from 'tmn-ocr-review-draft-v1' or d->>'version' is distinct from '1'
   or d->'reviewed' is distinct from 'false'::jsonb
   or coalesce((d->>'pageCount')::integer,0) not between 1 and 100
   or jsonb_typeof(d->'rows') is distinct from 'array'
   or jsonb_typeof(d->'issues') is distinct from 'array'
   or jsonb_array_length(d->'rows')>10000 or octet_length(d::text)>2000000
   then raise exception 'TMN review draft source identity invalid';end if;
  insert into public.tmn_ocr_review_drafts values(f.id,f.checksum,p_company,b.business_date,d,now())
   on conflict(source_file_id,source_checksum) do update set draft=excluded.draft,updated_at=excluded.updated_at;
 end loop;
end $$;
revoke all on function public.store_tmn_review_drafts(text,date,jsonb,uuid[]) from public,anon,authenticated;

-- ใช้สัญญา RPC เดิมทุกประการ เพิ่มเพียงสำเนาร่างหลังตัวตรวจ scope/lease เดิมผ่าน
create or replace function public.record_source_file_parse_results_tmn_review(p_job_id uuid,p_results jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp set statement_timeout='60s' as $$
declare result jsonb;j public.daily_recon_jobs%rowtype;allowed uuid[];
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Worker only';end if;
 result:=public.record_source_file_parse_results(p_job_id,p_results);
 select * into strict j from public.daily_recon_jobs where id=p_job_id;
 select array_agg((x->>'id')::uuid) into allowed from jsonb_array_elements(p_results) x;
 perform public.store_tmn_review_drafts(j.company,j.business_date,p_results,allowed);
 return result;
end $$;
create or replace function public.finish_account_recheck_compact_tmn_review(p_id uuid,p_revision integer,p_result jsonb,p_error text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp set statement_timeout='120s' as $$
declare result jsonb;q public.account_recheck_jobs%rowtype;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Worker only';end if;
 result:=public.finish_account_recheck_compact(p_id,p_revision,p_result,p_error);
 select * into strict q from public.account_recheck_jobs where id=p_id;
 perform public.store_tmn_review_drafts(q.company,q.business_date,p_result->'source_files',q.selected_file_ids);
 return result;
end $$;
revoke all on function public.record_source_file_parse_results_tmn_review(uuid,jsonb),public.finish_account_recheck_compact_tmn_review(uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.record_source_file_parse_results_tmn_review(uuid,jsonb),public.finish_account_recheck_compact_tmn_review(uuid,integer,jsonb,text) to service_role;

create or replace function public.read_tmn_review_context(p_source_file_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare f public.source_files%rowtype;b public.mail_batches%rowtype;v_company text;
begin
 if auth.uid() is null or not coalesce(public.current_user_active(),false)
  or coalesce(public.current_app_role(),'') not in ('monitor','audit_assistant','lead','admin') then raise exception 'Audit reviewer required';end if;
 select * into strict f from public.source_files where id=p_source_file_id;
 select * into strict b from public.mail_batches where id=f.batch_id;v_company:=coalesce(f.company,b.company);
 if v_company<>'UFABET7M' or f.kind<>'stm_pdf' or not coalesce(public.has_company_access(v_company),false) then raise exception 'TMN source access denied';end if;
 return jsonb_build_object(
  'draft',(select draft from public.tmn_ocr_review_drafts d where d.source_file_id=f.id and d.source_checksum=f.checksum),
  'approved',(select jsonb_build_object('id',r.id,'payload',r.payload,'approved_at',r.approved_at) from public.reviewed_pdf_recoveries r where r.source_file_id=f.id and r.superseded_at is null and r.payload->>'sourceChecksum'=f.checksum order by r.approved_at desc limit 1),
  'job',(select jsonb_build_object('id',j.id,'status',j.status,'run',j.last_run_id,'files',j.file_count,'parsed',j.parsed_count,'error',j.last_error,'paused',exists(select 1 from public.audit_run_holds h where h.company=j.company and h.business_date=j.business_date and h.paused)) from public.daily_recon_jobs j where j.company=v_company and j.business_date=b.business_date and not j.is_archived),
  'manual',(select jsonb_build_object('id',q.id,'status',q.status,'company',q.company,'date',q.business_date,'account',q.account,'direction',q.direction,'mode',q.mode,'fileIds',q.selected_file_ids,'base_run_id',q.base_run_id) from public.account_recheck_jobs q where q.company=v_company and q.business_date=b.business_date and f.id=any(q.selected_file_ids) order by q.created_at desc limit 1)
 );
end $$;
revoke all on function public.read_tmn_review_context(uuid) from public,anon;
grant execute on function public.read_tmn_review_context(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
