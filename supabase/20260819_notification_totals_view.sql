begin;

create or replace view public.v_recon_notification_status
with (security_invoker = true) as
select j.*,
       totals.actual_mail_total,
       totals.actual_file_total
from public.daily_recon_jobs j
cross join (
  select (select count(*) from public.mail_batches)::bigint as actual_mail_total,
         (select count(*) from public.source_files)::bigint as actual_file_total
) totals;

grant select on public.v_recon_notification_status to authenticated;

commit;
