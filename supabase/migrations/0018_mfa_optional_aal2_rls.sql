-- MFA opt-in enforcement, HML only until explicit PRD approval.
-- A verified factor requires an AAL2 JWT on sensitive tables and admin RPCs.
create or replace function private.current_mfa_satisfied()
returns boolean
language sql
stable security definer
set search_path = ''
as $$
 select
  not exists(
   select 1 from auth.mfa_factors f
   where f.user_id=auth.uid() and f.status='verified'
  )
  or (auth.jwt()->>'aal')='aal2'
$$;
revoke all on function private.current_mfa_satisfied() from public, anon;
grant execute on function private.current_mfa_satisfied() to authenticated;

-- Every sensitive user-owned table must enforce MFA even when called via Data API.
create policy "mfa_verified_account" on public.app_members as restrictive for all to authenticated
 using ((select private.current_mfa_satisfied())) with check ((select private.current_mfa_satisfied()));
create policy "mfa_verified_profile" on public.user_profiles as restrictive for all to authenticated
 using ((select private.current_mfa_satisfied())) with check ((select private.current_mfa_satisfied()));
create policy "mfa_verified_statements" on public.statements as restrictive for all to authenticated
 using ((select private.current_mfa_satisfied())) with check ((select private.current_mfa_satisfied()));
create policy "mfa_verified_statement_lines" on public.statement_lines as restrictive for all to authenticated
 using ((select private.current_mfa_satisfied())) with check ((select private.current_mfa_satisfied()));
create policy "mfa_verified_salary_events" on public.salary_events as restrictive for all to authenticated
 using ((select private.current_mfa_satisfied())) with check ((select private.current_mfa_satisfied()));
create policy "mfa_verified_time_entries" on public.time_entries as restrictive for all to authenticated
 using ((select private.current_mfa_satisfied())) with check ((select private.current_mfa_satisfied()));
create policy "mfa_verified_user_settings" on public.user_settings as restrictive for all to authenticated
 using ((select private.current_mfa_satisfied())) with check ((select private.current_mfa_satisfied()));
create policy "mfa_verified_tax_comparisons" on public.annual_tax_comparisons as restrictive for all to authenticated
 using ((select private.current_mfa_satisfied())) with check ((select private.current_mfa_satisfied()));
create policy "mfa_verified_subscriptions" on public.billing_subscriptions as restrictive for all to authenticated
 using ((select private.current_mfa_satisfied())) with check ((select private.current_mfa_satisfied()));
create policy "mfa_verified_billing_payments" on public.billing_payments as restrictive for all to authenticated
 using ((select private.current_mfa_satisfied())) with check ((select private.current_mfa_satisfied()));

-- Restrict storage operations for personal documents and profile pictures.
create policy "mfa_verified_private_storage" on storage.objects as restrictive for all to authenticated
 using ((bucket_id not in ('payslips','profile-avatars')) or (select private.current_mfa_satisfied()))
 with check ((bucket_id not in ('payslips','profile-avatars')) or (select private.current_mfa_satisfied()));

-- SECURITY DEFINER admin endpoints do not inherit table RLS. Protect these too.
create or replace function private.is_current_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
 select exists(
  select 1 from public.app_members m
  where m.user_id=auth.uid() and m.role='admin' and m.active and m.status='approved'
 ) and private.current_mfa_satisfied()
$$;
