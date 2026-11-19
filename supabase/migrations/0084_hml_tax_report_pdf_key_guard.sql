-- Fix the PDF suffix validator without ambiguous regex backslash escaping.
alter table public.annual_tax_reports
 drop constraint if exists annual_tax_reports_storage_key_check;
alter table public.annual_tax_reports
 add constraint annual_tax_reports_storage_key_check
 check (storage_key ~ '^[0-9a-f-]{36}/[0-9]{4}/[0-9a-f-]{36}[.]pdf$');