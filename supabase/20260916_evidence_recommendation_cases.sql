-- Exact UUID links, not a money-only join. Old runs remain historical.
begin;
set local lock_timeout = '5s';
create table if not exists public.evidence_recommendation_cases (
  recommendation_id uuid not null references public.evidence_recommendations(id),
  exception_id uuid not null references public.exceptions(id),
  reason text not null check(length(btrim(reason)) between 10 and 4000),
  created_at timestamptz not null default now(),
  primary key(recommendation_id,exception_id)
);
create index if not exists evidence_recommendation_cases_exception_idx
  on public.evidence_recommendation_cases(exception_id);
alter table public.evidence_recommendation_cases enable row level security;
revoke all on public.evidence_recommendation_cases from public,anon,authenticated;
grant select on public.evidence_recommendation_cases to authenticated;
create policy evidence_recommendation_cases_read on public.evidence_recommendation_cases
for select to authenticated using (
  public.current_user_active() and exists (
    select 1 from public.evidence_recommendations r
    join public.exceptions e on e.id=evidence_recommendation_cases.exception_id
    join public.daily_recon_jobs j on j.last_run_id=e.run_id and not j.is_archived
    where r.id=evidence_recommendation_cases.recommendation_id
      and r.status='pending_audit'
      and e.company in(r.company,r.payer_company)
      and e.business_date=r.business_date
      and j.company=e.company and j.business_date=e.business_date
  )
);
comment on table public.evidence_recommendation_cases is
  'Reviewed evidence relevance links only. Not approved matches. No effect on exception state or financial totals.';
notify pgrst,'reload schema';
commit;
