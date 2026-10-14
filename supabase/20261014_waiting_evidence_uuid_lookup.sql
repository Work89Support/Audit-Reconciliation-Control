-- Lookup-only repair for Storage upload timeouts. Preserve exact policy guards
-- and lowercase UUID semantics; no record, permission or case changes.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $repair$
declare
 expression text;
 old_lookup text := '((e.id)::text = split_part(objects.name, ''/''::text, 2))';
 new_lookup text := '(e.id = CASE WHEN split_part(objects.name, ''/''::text, 2) ~ ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'' THEN split_part(objects.name, ''/''::text, 2)::uuid ELSE NULL::uuid END)';
begin
 select with_check into expression from pg_policies
 where schemaname='storage' and tablename='objects'
 and policyname='waiting_cross_day_object_insert' and cmd='INSERT';
 if not found then raise exception 'Waiting evidence policy missing; inspect deployment'; end if;
 if strpos(expression,old_lookup)=0 then
   if strpos(expression,'(e.id =')>0 and strpos(expression,'^[0-9a-f]{8}')>0 then return; end if;
   raise exception 'Unexpected waiting evidence policy shape; inspect before changing';
 end if;
 execute format('alter policy waiting_cross_day_object_insert on storage.objects with check (%s)',
   replace(expression,old_lookup,new_lookup));
end $repair$;
commit;
