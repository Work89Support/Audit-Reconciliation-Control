-- Lookup optimization only: preserve every role/company/ownership/status guard.
-- Lower-case canonical UUID paths preserve the old id::text equality semantics.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $migration$
declare p record; old_lookup text := '((e.id)::text = split_part(objects.name, ''/''::text, 2))';
 new_lookup text := '(e.id = CASE WHEN split_part(objects.name, ''/''::text, 2) ~ ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'' THEN split_part(objects.name, ''/''::text, 2)::uuid ELSE NULL::uuid END)';
 expression text;
begin
 for p in select policyname,qual,with_check from pg_policies
   where schemaname='storage' and tablename='objects'
   and policyname in ('case_evidence_object_insert','case_evidence_upload_verify','pending_pair_evidence_object_insert')
 loop
   expression := coalesce(p.with_check,p.qual);
   if strpos(expression,old_lookup)=0 then
     if strpos(expression,'(e.id =')>0 and strpos(expression,'^[0-9a-f]{8}')>0 then continue; end if;
     raise exception 'Unexpected policy shape: %; inspect before changing',p.policyname;
   end if;
   expression := replace(expression,old_lookup,new_lookup);
   execute format('alter policy %I on storage.objects %s (%s)',p.policyname,
     case when p.with_check is not null then 'with check' else 'using' end,expression);
 end loop;
end $migration$;
commit;
