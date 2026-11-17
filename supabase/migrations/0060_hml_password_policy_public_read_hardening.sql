-- HML password policy read path hardening: avoid anon SECURITY DEFINER.
-- The only publicly visible row contains nonsecret password requirements.
grant select on public.payrep_password_policy to anon,authenticated;
create policy payrep_password_policy_public_read
 on public.payrep_password_policy for select to anon,authenticated
 using(id=1);
alter function public.get_payrep_password_policy() security invoker;
