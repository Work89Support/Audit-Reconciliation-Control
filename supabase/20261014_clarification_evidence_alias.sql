-- Repair only the SQL alias collision with the PL/pgSQL source-file variable.
-- Preserve all authorization, proof, history and status guards. No record writes.
begin;
set local lock_timeout='5s';
do $repair$
declare body text;
 old_query text := 'select 1 from public.case_evidence f join storage.objects o on o.bucket_id=''audit-files'' and o.name=f.storage_path where f.exception_id=e.id and f.size_bytes>0';
 new_query text := 'select 1 from public.case_evidence ce join storage.objects o on o.bucket_id=''audit-files'' and o.name=ce.storage_path where ce.exception_id=e.id and ce.size_bytes>0';
begin
 body:=pg_get_functiondef('public.submit_case_clarification(uuid,text,uuid,text,uuid)'::regprocedure);
 if strpos(body,old_query)=0 then
  if strpos(body,new_query)>0 then return;end if;
  raise exception 'Unexpected clarification proof query; inspect before changing';
 end if;
 execute replace(body,old_query,new_query);
end $repair$;
notify pgrst,'reload schema';
commit;
