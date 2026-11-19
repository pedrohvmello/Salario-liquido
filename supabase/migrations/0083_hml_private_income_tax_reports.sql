-- HML ONLY. Employer annual income-tax PDFs for Basic and Full.
-- One current source document per user and calendar year. Provenance is explicit.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('income-tax-reports','income-tax-reports',false,15000000,array['application/pdf'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,
 allowed_mime_types=excluded.allowed_mime_types;

create table public.annual_tax_reports(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 calendar_year integer not null check (calendar_year between 1990 and 2100),
 storage_key text not null unique,
 original_filename text not null check (length(original_filename) between 1 and 160),
 sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
 file_size_bytes integer not null check (file_size_bytes between 1 and 15000000),
 extracted_values jsonb not null default '{}'::jsonb check (jsonb_typeof(extracted_values)='object'),
 reviewed_values jsonb not null default '{}'::jsonb check (jsonb_typeof(reviewed_values)='object'),
 confirmed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,calendar_year),
 check (split_part(storage_key,'/',1)=user_id::text),
 check (split_part(storage_key,'/',2)=calendar_year::text),
 check (storage_key ~ '^[0-9a-f-]{36}/[0-9]{4}/[0-9a-f-]{36}\\.pdf$')
);
create index annual_tax_reports_owner_year on public.annual_tax_reports(user_id,calendar_year desc);
alter table public.annual_tax_reports enable row level security;

create policy tax_report_owner_read on public.annual_tax_reports
 for select to authenticated using (
  user_id=(select auth.uid()) and (select private.current_mfa_satisfied())
  and exists(select 1 from public.app_members m
   where m.user_id=(select auth.uid()) and m.active and m.status='approved')
 );
create policy tax_report_owner_upload on public.annual_tax_reports
 for insert to authenticated with check (
  user_id=(select auth.uid()) and (select private.current_mfa_satisfied())
  and private.pep_plan_for_user((select auth.uid())) in ('basic','full')
 );
create policy tax_report_owner_confirm on public.annual_tax_reports
 for update to authenticated using (
  user_id=(select auth.uid()) and (select private.current_mfa_satisfied())
  and private.pep_plan_for_user((select auth.uid())) in ('basic','full')
 ) with check (
  user_id=(select auth.uid()) and (select private.current_mfa_satisfied())
  and private.pep_plan_for_user((select auth.uid())) in ('basic','full')
 );
create policy tax_report_owner_delete on public.annual_tax_reports
 for delete to authenticated using (
  user_id=(select auth.uid()) and (select private.current_mfa_satisfied())
  and exists(select 1 from public.app_members m
   where m.user_id=(select auth.uid()) and m.active and m.status='approved')
 );
revoke all on public.annual_tax_reports from anon;
grant select,insert,update,delete on public.annual_tax_reports to authenticated;

-- Existing permissive storage policies allow other buckets using bucket_id <> ...
-- MUST protect this new private bucket by a RESTRICTIVE policy, not just
-- independent permissive owner policies.
create policy income_tax_reports_isolation on storage.objects
 as restrictive for all to authenticated
 using (
  bucket_id <> 'income-tax-reports'
  or (
    (storage.foldername(name))[1]=(select auth.uid())::text
    and (select private.current_mfa_satisfied())
    and exists(select 1 from public.app_members m where
      m.user_id=(select auth.uid()) and m.active and m.status='approved')
  )
 )
 with check (
  bucket_id <> 'income-tax-reports'
  or (
    (storage.foldername(name))[1]=(select auth.uid())::text
    and (select private.current_mfa_satisfied())
    and private.pep_plan_for_user((select auth.uid())) in ('basic','full')
    and storage.extension(name)='pdf'
  )
 );

-- Explicit bucket policies. The restrictive policy above is defense-in-depth
-- against broad pre-existing policies and prevents cross-account access.
create policy income_tax_reports_read on storage.objects
 for select to authenticated using (
  bucket_id='income-tax-reports'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and (select private.current_mfa_satisfied())
 );
create policy income_tax_reports_upload on storage.objects
 for insert to authenticated with check (
  bucket_id='income-tax-reports'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and (select private.current_mfa_satisfied())
  and private.pep_plan_for_user((select auth.uid())) in ('basic','full')
  and storage.extension(name)='pdf'
 );
create policy income_tax_reports_delete on storage.objects
 for delete to authenticated using (
  bucket_id='income-tax-reports'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and (select private.current_mfa_satisfied())
 );
