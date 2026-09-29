-- 7M receives TMN statements as screenshots embedded in DOCX late in the
-- month. Treat only explicitly named bank statements as reconciliation input;
-- ordinary Word documents remain clarification evidence.

begin;

create or replace function public.audit_is_bank_statement_pdf(p_file_name text)
returns boolean
language sql
immutable
parallel safe
as $$
  select coalesce(p_file_name,'') ~* '\.(pdf|docx)$'
    and (
      coalesce(p_file_name,'') ~* 'ฝาก[[:space:]]*[-–—/]?[[:space:]]*ถอน|ฝากถอน|statement|(^|[^A-Z0-9])STM([^A-Z0-9]|$)'
      or (
        coalesce(p_file_name,'') ~* '(^|[^A-Z0-9])(SCB|KB|KBANK|KTB|BBL|GSB|TMN|BAY|LBK|KRUNGSRI|TTB|UOB)([^A-Z0-9]|$)'
        and public.audit_file_direction(p_file_name) is not null
      )
    );
$$;

with changed as (
  update public.source_files f
  set kind='stm_pdf',
      parsed=false,
      parsed_at=null,
      row_count=null,
      parse_error=null
  where upper(coalesce(f.company,''))='UFABET7M'
    and f.file_name ~* '\.docx$'
    and public.audit_is_bank_statement_pdf(f.file_name)
    and f.kind is distinct from 'stm_pdf'
  returning f.id,f.company,f.file_name,f.batch_id
)
insert into public.audit_log(actor,action,entity,target,detail,meta)
select 'system:migration-20260929','reclassify_7m_word_statement','source_file',c.id::text,
       'จัด Word ที่เป็น Statement 7M เข้าตัวอ่านกระทบยอด',
       jsonb_build_object('company',c.company,'file_name',c.file_name,'batch_id',c.batch_id,
                          'new_kind','stm_pdf','storage_object_preserved',true)
from changed c;

select public.refresh_daily_recon_jobs(date '2026-09-15',current_date);

commit;
