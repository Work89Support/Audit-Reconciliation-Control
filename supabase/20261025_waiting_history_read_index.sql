create index concurrently if not exists exceptions_waiting_history_read_idx
on public.exceptions (company,business_date,created_at desc,id)
where superseded_by_exception_id is null
  and customer_details->>'waiting_source'='true';
