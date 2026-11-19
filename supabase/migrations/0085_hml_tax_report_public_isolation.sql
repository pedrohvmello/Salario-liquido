-- The isolation guard must apply to both authenticated and anon callers;
-- pre-existing broad permissive policies can otherwise expose a private bucket.
drop policy if exists income_tax_reports_isolation on storage.objects;
create policy income_tax_reports_isolation on storage.objects
 as restrictive for all to public
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