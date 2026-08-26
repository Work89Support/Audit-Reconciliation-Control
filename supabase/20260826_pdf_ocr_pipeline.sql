-- Store OCR evidence separately so normal file/dashboard queries remain fast.
-- The original PDF in Storage is never replaced.

create table if not exists public.source_file_ocr (
  source_file_id uuid primary key references public.source_files(id) on delete cascade,
  provider text not null default 'google_document_ai',
  confidence numeric,
  page_count integer not null default 0,
  line_count integer not null default 0,
  extracted_text text,
  rows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.source_file_ocr enable row level security;

drop policy if exists source_file_ocr_read_authenticated on public.source_file_ocr;
create policy source_file_ocr_read_authenticated
on public.source_file_ocr for select
to authenticated
using (true);

create or replace function public.record_source_file_parse_results(
  p_job_id uuid,
  p_results jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.daily_recon_jobs%rowtype;
  v_result jsonb;
  v_file_id uuid;
  v_error text;
  v_row_count integer;
  v_updated integer := 0;
  v_errors integer := 0;
  v_error_files text[] := '{}';
begin
  select * into v_job from public.daily_recon_jobs where id = p_job_id for update;
  if not found then raise exception 'daily reconciliation job not found: %', p_job_id; end if;

  for v_result in select value from jsonb_array_elements(coalesce(p_results, '[]'::jsonb))
  loop
    begin
      v_file_id := (v_result->>'id')::uuid;
      v_error := nullif(trim(v_result->>'parse_error'), '');
      v_row_count := greatest(coalesce((v_result->>'row_count')::integer, 0), 0);
    exception when others then
      raise exception 'invalid parse result payload: %', v_result;
    end;

    update public.source_files f
       set parsed = v_error is null,
           parsed_at = case when v_error is null then now() else null end,
           row_count = v_row_count,
           parse_error = v_error
     where f.id = v_file_id
       and exists (
         select 1 from public.mail_batches b
          where b.id = f.batch_id
            and b.business_date = v_job.business_date
            and upper(coalesce(f.company, b.company, '')) = upper(v_job.company)
       );

    if found then
      v_updated := v_updated + 1;

      if coalesce((v_result->>'ocr_used')::boolean, false) then
        insert into public.source_file_ocr
          (source_file_id, provider, confidence, page_count, line_count, extracted_text, rows, updated_at)
        values
          (v_file_id,
           'google_document_ai',
           nullif(v_result->>'ocr_confidence', '')::numeric,
           greatest(coalesce(nullif(v_result->>'ocr_page_count', '')::integer, 0), 0),
           cardinality(regexp_split_to_array(coalesce(v_result->>'ocr_text', ''), E'\\r?\\n')),
           left(coalesce(v_result->>'ocr_text', ''), 40000),
           coalesce(v_result->'ocr_rows', '[]'::jsonb),
           now())
        on conflict (source_file_id) do update
          set provider = excluded.provider,
              confidence = excluded.confidence,
              page_count = excluded.page_count,
              line_count = excluded.line_count,
              extracted_text = excluded.extracted_text,
              rows = excluded.rows,
              updated_at = now();
      end if;

      if v_error is not null then
        v_errors := v_errors + 1;
        if cardinality(v_error_files) < 8 then
          v_error_files := array_append(v_error_files, coalesce(v_result->>'file_name', v_file_id::text));
        end if;
      end if;
    end if;
  end loop;

  if v_updated = 0 then raise exception 'no source files were updated for job %', p_job_id; end if;

  if v_errors > 0 then
    update public.daily_recon_jobs
       set status = 'needs_review',
           parsed_count = greatest(v_updated - v_errors, 0),
           error_count = v_errors,
           claimed_at = null,
           claimed_by = null,
           last_error = left('Quality Gate: อ่านไฟล์ไม่ผ่าน ' || v_errors || ' ไฟล์ — ' || array_to_string(v_error_files, ', '), 2000),
           updated_at = now()
     where id = p_job_id;

    insert into public.recon_notifications
      (dedupe_key, level, title, detail, business_date, company, job_id)
    values
      ('parse-quality:' || p_job_id || ':' || md5(coalesce(p_results::text, '')),
       'error', 'อ่านไฟล์ไม่ผ่าน Quality Gate',
       'พบ ' || v_errors || ' ไฟล์: ' || array_to_string(v_error_files, ', '),
       v_job.business_date, v_job.company, p_job_id)
    on conflict (dedupe_key) do nothing;
  else
    update public.daily_recon_jobs
       set parsed_count = v_updated,
           error_count = 0,
           last_error = null,
           updated_at = now()
     where id = p_job_id;
  end if;

  return jsonb_build_object('updated', v_updated, 'errors', v_errors, 'passed', v_errors = 0);
end;
$$;

revoke all on table public.source_file_ocr from anon;
grant select on table public.source_file_ocr to authenticated;
revoke all on function public.record_source_file_parse_results(uuid, jsonb) from public;
grant execute on function public.record_source_file_parse_results(uuid, jsonb) to authenticated;
