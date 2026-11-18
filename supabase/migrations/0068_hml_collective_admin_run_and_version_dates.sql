
-- Admin can start one monitored check without waiting for the weekly cron.
create function public.run_collective_source_check()
returns integer language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_app_admin() then
  raise exception using errcode='42501',message='Acesso administrativo obrigatório';
 end if;
 return private.collective_scan_sources();
end $$;
revoke all on function public.run_collective_source_check() from public,anon;
grant execute on function public.run_collective_source_check() to authenticated;

-- Every published version must be disjoint within its company/region profile.
create function private.collective_check_profile_version_dates()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists (
  select 1 from public.collective_profile_versions p
  where p.profile_id=new.profile_id and p.id<>new.id
    and p.valid_from<=new.valid_until and p.valid_until>=new.valid_from
 ) then raise exception using errcode='23514',message='Perfil já possui versão publicada com vigência sobreposta.';
 end if;
 return new;
end $$;
create trigger collective_profile_no_overlap before insert on public.collective_profile_versions
 for each row execute function private.collective_check_profile_version_dates();
revoke all on function private.collective_check_profile_version_dates() from public;
