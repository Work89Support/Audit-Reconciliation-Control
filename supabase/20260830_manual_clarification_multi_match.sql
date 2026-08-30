begin;

-- An auditor may use one clarification/evidence file for several open cases.
-- The automatic matcher remains conservative (one best case); this RPC is the
-- explicit, audited path used after a person previews the file and selects the
-- applicable cases. Cross-company attachment is rejected in the database.
create or replace function public.manual_match_clarification_file(
  p_file_id uuid,
  p_exception_ids uuid[],
  p_actor text default 'web-auditor',
  p_note text default 'Audit จับคู่ไฟล์ชี้แจงกับเคสที่เลือก'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_file public.source_files%rowtype;
  v_batch public.mail_batches%rowtype;
  v_company text;
  v_date date;
  v_ids uuid[] := '{}';
  v_all_ids uuid[] := '{}';
  v_requested integer := 0;
  v_note text;
begin
  select * into v_file from public.source_files where id = p_file_id;
  if not found then raise exception 'ไม่พบไฟล์ชี้แจงที่เลือก'; end if;
  if v_file.kind <> 'doc_clarify' then
    raise exception 'ไฟล์นี้ยังไม่ได้กำหนดเป็นไฟล์ชี้แจง/หลักฐาน';
  end if;

  select * into v_batch from public.mail_batches where id = v_file.batch_id;
  v_company := upper(coalesce(nullif(v_file.company, ''), nullif(v_batch.company, '')));
  v_date := v_batch.business_date;
  v_note := left(coalesce(nullif(trim(p_note), ''), 'Audit จับคู่ไฟล์ชี้แจงกับเคสที่เลือก'), 2000);

  select count(*) into v_requested
  from (select distinct unnest(coalesce(p_exception_ids, '{}')) as id) requested;
  if v_requested = 0 then raise exception 'กรุณาเลือกอย่างน้อย 1 เคส'; end if;
  if v_company is null then raise exception 'ไฟล์ชี้แจงไม่มีบริษัท จึงยังจับคู่เคสไม่ได้'; end if;

  select coalesce(array_agg(e.id order by e.business_date, e.occurred_at, e.created_at), '{}')
    into v_ids
  from public.exceptions e
  join (select distinct unnest(p_exception_ids) as id) requested on requested.id = e.id
  where upper(coalesce(e.company, '')) = v_company
    and coalesce(e.status, 'open') not in ('closed', 'approved', 'damage');

  if cardinality(v_ids) <> v_requested then
    raise exception 'บางเคสไม่ใช่บริษัทเดียวกับไฟล์ หรือถูกปิดไปแล้ว กรุณารีเฟรชและเลือกใหม่';
  end if;

  update public.exceptions set
    status = 'answered',
    clarification_file_id = p_file_id,
    auto_closed = false,
    resolution_note = v_note,
    resolved_at = null,
    resolved_by = coalesce(nullif(p_actor, ''), 'web-auditor'),
    match_confidence = 100
  where id = any(v_ids);

  -- Keep earlier automatic/manual links when the auditor adds another group
  -- from a later preview. This makes repeated saves additive and idempotent.
  select coalesce(array_agg(distinct linked_id), '{}') into v_all_ids
  from unnest(
    coalesce((select matched_exception_ids from public.clarification_matches where file_id = p_file_id), '{}') || v_ids
  ) linked_id;

  insert into public.clarification_matches(
    file_id, batch_id, business_date, company, extracted_text,
    matched_exception_ids, confidence, outcome, reason, processed_by, processed_at
  ) values (
    p_file_id, v_file.batch_id, v_date, v_company, '',
    v_all_ids, 100, 'answered', v_note, coalesce(nullif(p_actor, ''), 'web-auditor'), now()
  )
  on conflict (file_id) do update set
    batch_id = excluded.batch_id,
    business_date = excluded.business_date,
    company = excluded.company,
    matched_exception_ids = excluded.matched_exception_ids,
    confidence = excluded.confidence,
    outcome = excluded.outcome,
    reason = excluded.reason,
    processed_by = excluded.processed_by,
    processed_at = excluded.processed_at;

  insert into public.audit_log(actor, action, entity, target, detail, meta)
  values (
    coalesce(nullif(p_actor, ''), 'web-auditor'),
    'clarification_manual_multi_match',
    'source_file', p_file_id::text,
    format('จับคู่ไฟล์ %s กับ %s เคสของ %s', v_file.file_name, cardinality(v_ids), v_company),
    jsonb_build_object(
      'file_name', v_file.file_name,
      'company', v_company,
      'business_date', v_date,
      'exception_ids', v_ids,
      'note', v_note
    )
  );

  return jsonb_build_object(
    'file_id', p_file_id,
    'company', v_company,
    'business_date', v_date,
    'matched_count', cardinality(v_ids),
    'matched_exception_ids', v_all_ids,
    'outcome', 'answered',
    'reason', v_note
  );
end $$;

revoke all on function public.manual_match_clarification_file(uuid,uuid[],text,text) from public;
grant execute on function public.manual_match_clarification_file(uuid,uuid[],text,text) to authenticated, service_role;

commit;
