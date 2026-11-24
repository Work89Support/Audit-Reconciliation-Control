-- Bind fresh TMN source metadata only. No matching, primary, case or approval changes.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
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
  -- The caller is the service_role receipt wrapper after its original lease/scope check.
  -- Bind only a previously missing digest computed from downloaded PDF bytes; never replace one.
  if nullif(f.checksum,'') is null then
   update public.source_files set checksum=d->>'sourceChecksum' where id=f.id and nullif(checksum,'') is null;
   f.checksum:=d->>'sourceChecksum';
  end if;
  insert into public.tmn_ocr_review_drafts values(f.id,f.checksum,p_company,b.business_date,d,now())
   on conflict(source_file_id,source_checksum) do update set draft=excluded.draft,updated_at=excluded.updated_at;
 end loop;
end $$;
revoke all on function public.store_tmn_review_drafts(text,date,jsonb,uuid[]) from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
