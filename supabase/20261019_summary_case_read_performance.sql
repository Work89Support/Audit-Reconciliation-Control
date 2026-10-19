-- Read-path performance only. No business row, approval, hold or source edits.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';

-- Notes/instructions/history currently scan the whole audit log for one case.
create index if not exists audit_log_case_read_idx
 on public.audit_log(entity,target,action,at,id);
create index if not exists audit_log_source_case_refs_idx
 on public.audit_log using gin ((meta->'exception_ids'))
 where entity='source_file';
create index if not exists audit_source_revision_replacement_read_idx
 on public.audit_source_revisions(replacement_file_id)
 where replacement_file_id is not null;

do $patch$
declare d text; a text; b text;
begin
 d:=pg_get_functiondef('public.effective_audit_source_files(text,date)'::regprocedure);
 if position('summary-source-candidates-v1' in d)>0 then return;end if;
 if position('public.current_user_active()' in d)=0
 or position('public.has_company_access(p_company)' in d)=0
 or position('coalesce(r.company,f.company,b.company)=p_company' in d)=0
 or position('storage.objects' in d)=0 or position('source_file_ocr' in d)=0
 then raise exception 'Unreviewed source manifest definition';end if;
 a:='return (select coalesce(jsonb_agg(to_jsonb(f)';
 b:=$new$return (with candidate_ids as materialized (
 -- summary-source-candidates-v1: conservative superset, not a new scope rule.
 -- Include originals AND every corrected scope; latest revision, adjacent-day
 -- eligibility, replacements, exclusions, bytes and OCR still use old checks.
 select f0.id from public.mail_batches b0
 join public.source_files f0 on f0.batch_id=b0.id
 where b0.business_date between p_date and p_date+1
 and coalesce(f0.company,b0.company)=p_company
 union
 select r0.source_file_id from public.audit_source_revisions r0
 join public.source_files f0 on f0.id=r0.source_file_id
 join public.mail_batches b0 on b0.id=f0.batch_id
 where coalesce(r0.business_date,b0.business_date) between p_date and p_date+1
 and coalesce(r0.company,f0.company,b0.company)=p_company
 ) select coalesce(jsonb_agg(to_jsonb(f)$new$;
 if (length(d)-length(replace(d,a,'')))<>length(a)
 then raise exception 'Unexpected source manifest aggregate';end if;
 d:=replace(d,a,b);
 a:='from public.source_files f join public.mail_batches b on b.id=f.batch_id';
 b:='from candidate_ids ci join public.source_files f on f.id=ci.id join public.mail_batches b on b.id=f.batch_id';
 if (length(d)-length(replace(d,a,'')))<>length(a)
 then raise exception 'Unexpected source manifest join';end if;
 execute replace(d,a,b);
end $patch$;
notify pgrst,'reload schema';
commit;
