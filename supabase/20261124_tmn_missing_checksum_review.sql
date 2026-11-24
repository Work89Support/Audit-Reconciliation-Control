-- Bind fresh TMN source metadata only. No matching, primary, case or approval changes.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
-- Registering the first digest of an already bound TMN review draft is metadata only.
-- Preserve the existing refresh path for replacements and every other source change.
create or replace function public.on_source_file_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_batch uuid;v_date date;v_company text;
begin
 if TG_OP='UPDATE' then
  if nullif(old.checksum,'') is null and new.checksum ~ '^[a-f0-9]{64}$'
   and new.company='UFABET7M' and new.kind='stm_pdf'
   and (to_jsonb(new)-'checksum') is not distinct from (to_jsonb(old)-'checksum')
   and exists(select 1 from public.tmn_ocr_review_drafts d
    where d.source_file_id=new.id and d.source_checksum=new.checksum
      and d.company='UFABET7M' and d.draft->>'sourceId'=new.id::text
      and d.draft->>'sourceChecksum'=new.checksum
      and d.draft->>'sourceType'='tmn-ocr-review-draft-v1'
      and d.draft->'reviewed'='false'::jsonb) then
   return new;
  end if;
 end if;
 v_batch:=coalesce(new.batch_id,old.batch_id);
 select business_date,company into v_date,v_company from public.mail_batches where id=v_batch;
 if v_date is not null and v_company is not null then perform public.refresh_daily_recon_job(v_date,v_company);end if;
 return coalesce(new,old);
end $$;

create or replace function public.store_tmn_review_drafts(p_company text,p_date date,p_files jsonb,p_allowed uuid[])
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb;d jsonb;f public.source_files%rowtype;b public.mail_batches%rowtype;
begin
 if p_company<>'UFABET7M' then return;end if;
 for item in select value from jsonb_array_elements(coalesce(p_files,'[]')) loop
  d:=item->'tmn_review_draft';if d is null or d='null'::jsonb then continue;end if;
  if not((item->>'id')::uuid=any(p_allowed)) then raise exception 'TMN review file outside job';end if;
  select * into strict f from public.source_files where id=(item->>'id')::uuid for update;
  select * into strict b from public.mail_batches where id=f.batch_id;
  if f.kind<>'stm_pdf' or coalesce(f.company,b.company)<>p_company or b.business_date not between p_date and p_date+1
   or d->>'sourceId' is distinct from f.id::text
   or coalesce(d->>'sourceChecksum','') !~ '^[a-f0-9]{64}$'
   or (nullif(f.checksum,'') is not null and d->>'sourceChecksum' is distinct from f.checksum)
   or d->>'company' is distinct from p_company or d->>'businessDate' is distinct from b.business_date::text
   or d->>'sourceType' is distinct from 'tmn-ocr-review-draft-v1' or d->>'version' is distinct from '1'
   or d->'reviewed' is distinct from 'false'::jsonb
   or coalesce((d->>'pageCount')::integer,0) not between 1 and 100
   or jsonb_typeof(d->'rows') is distinct from 'array'
   or jsonb_typeof(d->'issues') is distinct from 'array'
   or jsonb_array_length(d->'rows')>10000 or octet_length(d::text)>2000000
   then raise exception 'TMN review draft source identity invalid';end if;
  -- Store the validated receipt first so the narrow trigger guard can recognize it.
  insert into public.tmn_ocr_review_drafts values(f.id,d->>'sourceChecksum',p_company,b.business_date,d,now())
   on conflict(source_file_id,source_checksum) do update set draft=excluded.draft,updated_at=excluded.updated_at;
  -- Bind only a missing digest from downloaded bytes; never replace one or requeue work.
  if nullif(f.checksum,'') is null then
   update public.source_files set checksum=d->>'sourceChecksum' where id=f.id and nullif(checksum,'') is null;
  end if;
 end loop;
end $$;
revoke all on function public.store_tmn_review_drafts(text,date,jsonb,uuid[]) from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
