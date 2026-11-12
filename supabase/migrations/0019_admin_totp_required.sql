-- Phase 3, HML only until manual validation and explicit production GO.
-- An administrator must have a verified TOTP factor and a current AAL2 session.
-- A user without MFA remains able to use non-administrative features.
-- SECURITY DEFINER admin RPCs call this helper. Do not read user_metadata for authorization.
create or replace function private.is_current_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
 select exists(
  select 1
  from public.app_members m
  where m.user_id=auth.uid()
    and m.role='admin'
    and m.active
    and m.status='approved'
    and (auth.jwt()->>'aal')='aal2'
    and exists(
      select 1 from auth.mfa_factors f
      where f.user_id=m.user_id
        and f.factor_type='totp'
        and f.status='verified'
    )
 )
$$;
-- Existing EXECUTE grants are preserved by CREATE OR REPLACE.
