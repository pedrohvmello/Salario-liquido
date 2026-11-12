-- HML-first hardening. Validate before any production GO.
-- Revoked sessions must not use an unexpired access token to read protected
-- financial rows or invoke privileged administrator endpoints.
-- The session_id claim is issued by Supabase Auth, not user_metadata.

create or replace function private.current_session_is_active()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from auth.sessions s
      where s.id = nullif(auth.jwt()->>'session_id', '')::uuid
        and s.user_id = auth.uid()
        and (s.not_after is null or s.not_after > now())
    )
$$;
revoke all on function private.current_session_is_active() from public, anon, authenticated;

-- Used by restrictive RLS policies on user financial/profile tables and storage.
-- Accounts without a verified factor still need a non-revoked session.
create or replace function private.current_mfa_satisfied()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.current_session_is_active()
    and (
      not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      )
      or (auth.jwt()->>'aal') = 'aal2'
    )
$$;
revoke all on function private.current_mfa_satisfied() from public, anon;
grant execute on function private.current_mfa_satisfied() to authenticated;

-- Admin RPC authorization also requires the same live session.
create or replace function private.is_current_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.current_session_is_active()
    and exists (
      select 1
      from public.app_members m
      where m.user_id = auth.uid()
        and m.role = 'admin'
        and m.active
        and m.status = 'approved'
        and (auth.jwt()->>'aal') = 'aal2'
        and exists (
          select 1 from auth.mfa_factors f
          where f.user_id = m.user_id
            and f.factor_type = 'totp'
            and f.status = 'verified'
        )
    )
$$;
