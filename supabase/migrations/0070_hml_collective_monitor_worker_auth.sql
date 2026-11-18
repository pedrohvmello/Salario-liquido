
-- Private worker authentication. The random token is generated and stored solely
-- inside Supabase Vault; it is never returned to the client or source repository.
do $$
begin
 if not exists(select 1 from vault.secrets where name='payrep_hml_collective_monitor_token') then
  perform vault.create_secret(
   encode(gen_random_bytes(32),'hex'),
   'payrep_hml_collective_monitor_token',
   'Internal HML collective document monitor'
  );
 end if;
end $$;
create function public.verify_collective_monitor_token(p_token text)
returns boolean language sql stable security definer set search_path='' as $$
 select length(p_token)=64
  and p_token=(select decrypted_secret from vault.decrypted_secrets where name='payrep_hml_collective_monitor_token' limit 1)
$$;
revoke all on function public.verify_collective_monitor_token(text) from public,anon,authenticated;
grant execute on function public.verify_collective_monitor_token(text) to service_role;
