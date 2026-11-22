-- Accept the existing authenticated, page-reviewed PDF approval format as
-- effective TMN parser evidence. Preserve the live visual-review branch,
-- raw OCR/error columns, all job/case data, and existing function privileges.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create or replace function public.audit_source_recovery_reviewed(p_source_file_id uuid)
returns boolean language sql stable security definer
set search_path=public,pg_temp as $function$
 select exists (
  select 1 from public.source_files f
  join public.mail_batches b on b.id=f.batch_id
  join public.reviewed_pdf_recoveries r on r.source_file_id=f.id
  join public.source_file_ocr o on o.source_file_id=f.id
  where f.id=p_source_file_id and f.kind='stm_pdf'
   and coalesce(f.company,b.company)='UFABET7M'
   and r.company='UFABET7M' and r.business_date=b.business_date
   and r.superseded_at is null and r.approved_by is not null
   and length(trim(r.approval_note))>=10
   and o.reviewed_recovery->>'id'=r.id::text
   and o.reviewed_recovery->'payload'=r.payload
   and r.payload->>'version'='1'
   and r.payload->>'sourceType'='tmn-screenshot-list-v1'
   and r.payload->>'sourceId'=f.id::text
   and f.checksum ~ '^[a-f0-9]{64}$'
   and r.payload->>'sourceChecksum'=f.checksum
   and r.payload->>'pdfSha256'=f.checksum
   and r.payload->>'company'=r.company
   and r.payload->>'businessDate'=b.business_date::text
   and r.payload->>'bank'='TMN'
   and r.payload->>'account' ~ '^0[0-9]{9}$'
   and r.payload->'coverageReviewed'='true'::jsonb
   and length(trim(r.payload->>'coverageEvidence'))>=10
   and (r.payload->>'pageCount')::integer between 1 and 500
   and jsonb_array_length(r.payload->'pagesReviewed')=(r.payload->>'pageCount')::integer
   and not exists(select 1 from generate_series(1,(r.payload->>'pageCount')::integer) p
                  where not (r.payload->'pagesReviewed' @> jsonb_build_array(p)))
   and jsonb_array_length(r.payload->'rows') between 1 and 10000
   and jsonb_array_length(r.payload->'rows')=jsonb_array_length(r.payload->'expectedRowIds')
   and jsonb_array_length(r.payload->'rows')=(select count(distinct x->>'id') from jsonb_array_elements(r.payload->'rows') x)
   and not exists (
    select 1 from jsonb_array_elements(r.payload->'rows') x
    where x->'reviewed' is distinct from 'true'::jsonb
     or x->>'date' is distinct from b.business_date::text
     or coalesce(x->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     or coalesce(x->>'direction','') not in ('deposit','withdraw')
     or coalesce((x->>'amount')::numeric,0)<=0
     or (x->>'page')::integer not between 1 and (r.payload->>'pageCount')::integer
     or nullif(x->>'duplicateOf','') is not null
     or coalesce(x->>'description','') ~* 'ค่าธรรมเนียม|fee'
     or not(r.payload->'expectedRowIds' @> jsonb_build_array(x->>'id'))
   )
   and not exists (
    select 1 from (values('deposit'),('withdraw')) d(direction)
    where r.payload#>array['controls',d.direction,'count'] is distinct from
     to_jsonb((select count(*) from jsonb_array_elements(r.payload->'rows') x where x->>'direction'=d.direction))
     or r.payload#>array['controls',d.direction,'amount'] is distinct from
     to_jsonb((select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(r.payload->'rows') x where x->>'direction'=d.direction))
   )
 );
$function$;
revoke all on function public.audit_source_recovery_reviewed(uuid) from public,anon,authenticated;

-- Patch only this predicate. Keep the deployed visual-review validator intact.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('public.audit_source_parse_reviewed(uuid)'::regprocedure);
 if position('public.audit_source_recovery_reviewed(p_source_file_id)' in definition)=0 then
  if position('tmn_visual_review_v1' in definition)=0
   or position('select coalesce((' in definition)=0 then
   raise exception 'Unexpected TMN review predicate; migration stopped';
  end if;
  definition:=replace(definition,'select coalesce((',
   'select public.audit_source_recovery_reviewed(p_source_file_id) or coalesce((');
  execute definition;
 end if;
end;
$migration$;
notify pgrst,'reload schema';
commit;
