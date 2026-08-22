-- Correct historical BO reports that were stored with a non-BO kind.
-- Safe to run repeatedly.

begin;

update public.source_files
set kind = 'bo_main'
where file_name ~* 'รายงานบัญชี(ฝาก|ถอน)|(^|[^A-Z])BO([^A-Z]|$)'
  and kind is distinct from 'bo_main';

commit;
