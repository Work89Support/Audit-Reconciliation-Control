begin;

create or replace function public.approve_reviewed_pdf_recovery(p_payload jsonb, p_note text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  f public.source_files%rowtype;
  b public.mail_batches%rowtype;
  prior public.reviewed_pdf_recoveries%rowtype;
  result_id uuid;
  row_count integer;
begin
  if auth.uid() is null or coalesce(public.current_app_role(),'') not in ('monitor','lead','admin') then
    raise exception 'Authenticated Audit reviewer required';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or length(trim(coalesce(p_note,''))) < 10 then
    raise exception 'Source review payload and approval note required';
  end if;
  select * into strict f from public.source_files where id = (p_payload->>'sourceId')::uuid for update;
  select * into strict b from public.mail_batches where id = f.batch_id;
  if not coalesce(public.has_company_access(coalesce(f.company,b.company)),false) then raise exception 'Company access denied'; end if;
  if coalesce(f.kind,'') <> 'stm_pdf' or nullif(f.checksum,'') is null
    or (p_payload->>'company') is distinct from coalesce(f.company,b.company)
    or (p_payload->>'businessDate') is distinct from b.business_date::text
    or (p_payload->>'sourceChecksum') is distinct from f.checksum
    or coalesce(p_payload->>'pdfSha256','') !~ '^[a-f0-9]{64}$'
    or (p_payload->>'version') is distinct from '1'
    or coalesce(p_payload->>'account','') !~ '^[0-9]{8,16}$'
    or coalesce(p_payload->>'bank','') not in ('SCB','KBANK','TMN')
    or (p_payload->>'bank' = 'TMN' and coalesce(p_payload->>'sourceType','') <> 'tmn-screenshot-list-v1')
    or (p_payload->'coverageReviewed') is distinct from 'true'::jsonb
    or length(trim(coalesce(p_payload->>'coverageEvidence',''))) < 10 then
    raise exception 'Source identity, checksum or coverage review mismatch';
  end if;
  if jsonb_typeof(p_payload->'rows') is distinct from 'array'
    or jsonb_typeof(p_payload->'expectedRowIds') is distinct from 'array'
    or jsonb_typeof(p_payload->'controls') is distinct from 'object' then raise exception 'Invalid rows or controls'; end if;
  row_count := jsonb_array_length(p_payload->'rows');
  if row_count = 0 or row_count > 10000
    or row_count <> jsonb_array_length(p_payload->'expectedRowIds')
    or exists(select 1 from jsonb_array_elements(p_payload->'rows') r where (r->'reviewed') is distinct from 'true'::jsonb)
    or row_count <> (select count(distinct r->>'id') from jsonb_array_elements(p_payload->'rows') r)
    or exists(select 1 from jsonb_array_elements(p_payload->'rows') r
      where not (p_payload->'expectedRowIds' @> jsonb_build_array(r->>'id'))) then
    raise exception 'Every source row must be reviewed exactly once';
  end if;
  select * into prior from public.reviewed_pdf_recoveries
    where source_file_id=f.id and business_date=b.business_date and superseded_at is null;
  if found and prior.payload = p_payload then return prior.id; end if;
  if prior.id is not null then
    update public.reviewed_pdf_recoveries set superseded_at=now() where id=prior.id;
  end if;
  insert into public.reviewed_pdf_recoveries(source_file_id,business_date,company,payload,approved_by,approval_note)
    values(f.id,b.business_date,coalesce(f.company,b.company),p_payload,auth.uid(),p_note) returning id into result_id;
  return result_id;
end $$;

revoke all on function public.approve_reviewed_pdf_recovery(jsonb,text) from public, anon;
grant execute on function public.approve_reviewed_pdf_recovery(jsonb,text) to authenticated;
notify pgrst, 'reload schema';

commit;
