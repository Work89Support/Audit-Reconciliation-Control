begin;

-- BO is the daily source of truth for accounts/providers actually used.
-- This view exposes the latest completed worker result without turning the
-- registry's maximum capacity into a false "missing file" requirement.
create or replace view public.v_bo_first_daily_coverage
with (security_invoker=true) as
select
  r.id as run_id,
  r.business_date,
  upper(r.company) as company,
  r.created_at,
  coalesce(r.summary->'bo_first'->>'method', 'BO_FIRST') as method,
  coalesce(r.summary->'bo_first'->'required', '[]'::jsonb) as required,
  coalesce(r.summary->'bo_first'->'received', '[]'::jsonb) as received,
  coalesce(r.summary->'bo_first'->'missing', '[]'::jsonb) as missing,
  coalesce((r.summary->'bo_first'->>'complete')::boolean, false) as complete,
  r.summary->'bo_first'->>'registry_source' as registry_source
from public.recon_runs r
where r.summary ? 'bo_first';

grant select on public.v_bo_first_daily_coverage to anon, authenticated;
notify pgrst, 'reload schema';

commit;
