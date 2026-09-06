-- Apply BEFORE publishing the updated web app / n8n worker.
-- Additive only: old cases remain NULL; never infer dates/times from occurred_at.
begin;
alter table public.exceptions
  add column if not exists bo_date date,
  add column if not exists bo_time time without time zone,
  add column if not exists stm_date date,
  add column if not exists stm_time time without time zone;
comment on column public.exceptions.bo_time is 'Original normalized BO time, NULL when unknown; not copied from STM or occurred_at';
comment on column public.exceptions.stm_time is 'Original normalized STM time, NULL when unknown; not inferred from time_diff_sec';
notify pgrst, 'reload schema';
commit;
