-- Provisional evidence proposals only: never modifies exceptions or financial results.
begin;
set local lock_timeout = '5s';
create table if not exists public.evidence_recommendations (
  id uuid primary key default gen_random_uuid(),
  source_file_id uuid not null references public.source_files(id),
  business_date date not null,
  company text not null check (company ~ '^[A-Z0-9]{2,20}$'),
  payer_company text not null check (payer_company ~ '^[A-Z0-9]{2,20}$'),
  provider text not null check (length(btrim(provider)) between 1 and 80),
  amount numeric(16,2) not null check (amount > 0 and amount < 100000000000000),
  evidence_note text not null check (length(btrim(evidence_note)) between 10 and 8000),
  status text not null default 'pending_audit' check (status = 'pending_audit'),
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists evidence_recommendations_date_idx
  on public.evidence_recommendations(business_date,company);
create index if not exists evidence_recommendations_file_idx
  on public.evidence_recommendations(source_file_id);
alter table public.evidence_recommendations enable row level security;
revoke all on public.evidence_recommendations from public, anon, authenticated;
grant select, insert on public.evidence_recommendations to authenticated;
drop policy if exists evidence_recommendations_read on public.evidence_recommendations;
create policy evidence_recommendations_read on public.evidence_recommendations
for select to authenticated using (
  public.current_user_active()
  and public.current_app_role() in ('monitor','lead','admin')
  and public.has_company_access(company) and public.has_company_access(payer_company)
);
drop policy if exists evidence_recommendations_add on public.evidence_recommendations;
create policy evidence_recommendations_add on public.evidence_recommendations
for insert to authenticated with check (
  public.current_user_active()
  and public.current_app_role() in ('monitor','lead','admin')
  and created_by = auth.uid() and status = 'pending_audit'
  and public.has_company_access(company) and public.has_company_access(payer_company)
  and exists(select 1 from public.source_files f where f.id = source_file_id
    and f.kind = 'doc_clarify' and upper(f.company) in
      (evidence_recommendations.company,evidence_recommendations.payer_company))
);
comment on table public.evidence_recommendations is
  'Unverified document-based recommendations, not confirmed transaction matches, approvals or damages. Append-only for authenticated auditors.';
notify pgrst,'reload schema';
commit;
