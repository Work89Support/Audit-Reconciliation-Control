-- Apply BEFORE deploying the updated app and importing the rebuilt workers.
-- No case status, source file, or existing evidence is overwritten.
begin;
alter table public.exceptions add column if not exists customer_details jsonb not null default '{}'::jsonb;
comment on column public.exceptions.customer_details is 'Separate bo/stm customer user, account, name, reference. Empty for historical rows until evidence is reprocessed; never infer customer from company account.';
notify pgrst, 'reload schema';
commit;
