-- HML: public read-only password policy snapshot, synced only after verifying
-- the Supabase Auth Management API. Never expose Management API tokens.
create table if not exists public.payrep_password_policy(
 id smallint primary key default 1 check(id=1),
 min_length integer not null default 12 check(min_length between 8 and 128),
 required_preset text not null default 'mixed_case_numbers_symbols'
  check(required_preset in ('none','letters_numbers','mixed_case_numbers','mixed_case_numbers_symbols')),
 synced_at timestamptz,
 updated_at timestamptz not null default now()
);
insert into public.payrep_password_policy(id,min_length,required_preset)
 values(1,12,'mixed_case_numbers_symbols') on conflict(id) do nothing;
alter table public.payrep_password_policy enable row level security;
revoke all on public.payrep_password_policy from public,anon,authenticated;
-- A dedicated whitelisted function provides signup password rules without exposing
-- a mutable table or internal service state.
create or replace function public.get_payrep_password_policy()
returns jsonb language sql stable security definer set search_path=''
as $function$
 select jsonb_build_object(
  'minLength',p.min_length,'preset',p.required_preset,
  'synced',p.synced_at is not null
 ) from public.payrep_password_policy p where p.id=1
$function$;
revoke all on function public.get_payrep_password_policy() from public,anon,authenticated;
grant execute on function public.get_payrep_password_policy() to anon,authenticated;
grant select,update on public.payrep_password_policy to service_role;
comment on table public.payrep_password_policy is
 'Read-only snapshot for Payrep password validation. Source of truth: Supabase Auth config. Writes permitted only to service_role after management API verification.';
