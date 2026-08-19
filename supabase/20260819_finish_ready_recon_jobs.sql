create or replace function public.finish_ready_daily_recon_jobs()
returns integer language plpgsql security definer set search_path=public as $$
declare
  v_ready record;
  v_finished integer := 0;
begin
  for v_ready in
    select distinct on (j.id)
      j.id as job_id,
      r.id as run_id,
      coalesce(r.file_ids, '{}'::uuid[]) as file_ids
    from public.daily_recon_jobs j
    join public.recon_runs r
      on r.summary->>'job_id' = j.id::text
     and r.created_at >= coalesce(j.claimed_at, '-infinity'::timestamptz)
    where j.status = 'running'
    order by j.id, r.created_at desc
  loop
    update public.source_files
       set parsed = true,
           parsed_at = now(),
           parse_error = null
     where id = any(v_ready.file_ids);

    perform public.finish_daily_recon_job(v_ready.job_id, v_ready.run_id);
    v_finished := v_finished + 1;
  end loop;

  return v_finished;
end $$;

revoke all on function public.finish_ready_daily_recon_jobs() from public;
grant execute on function public.finish_ready_daily_recon_jobs() to authenticated;
