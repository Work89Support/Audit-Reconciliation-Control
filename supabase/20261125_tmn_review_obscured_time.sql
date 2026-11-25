-- Allow an explicitly documented missing time in an otherwise verified TMN row.
begin;
set local lock_timeout = '5s';

do $migration$
declare
  definition text;
  previous_check constant text := $old$or coalesce(x->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'$old$;
  updated_check constant text := $new$or not (
       (coalesce(x->>'timeDisposition','')='' and coalesce(x->>'time','') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
       or (coalesce(x->>'timeDisposition','')='not_visible'
           and coalesce(x->>'time','')=''
           and jsonb_typeof(x->'timeEvidence') is not distinct from 'string'
           and coalesce(length(trim(x->>'timeEvidence')),0)>=10)
     )$new$;
begin
  definition := pg_get_functiondef('public.audit_source_recovery_reviewed(uuid)'::regprocedure);
  if position(updated_check in definition)>0 then return; end if;
  if position(previous_check in definition)=0 then
    raise exception 'Unexpected reviewed TMN time predicate';
  end if;
  execute replace(definition,previous_check,updated_check);
end;
$migration$;
commit;
