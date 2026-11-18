
-- Allow an authenticated approved member to apply an already reviewed profile
-- only to their own time bank. The version and factors are immutable snapshots.
create function public.assign_my_collective_profile_version(p_version_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid();
 v_version public.collective_profile_versions%rowtype;
 v_profile public.collective_profiles%rowtype;
 v_id uuid;
begin
 if v_user is null or not exists(
  select 1 from public.app_members m
  where m.user_id=v_user and m.active=true and m.status='approved'
 ) or not private.current_mfa_satisfied() then
  raise exception using errcode='42501',message='Conta não autorizada para atribuir políticas.';
 end if;
 select * into v_version from public.collective_profile_versions where id=p_version_id;
 if not found then raise exception using errcode='23503',message='Versão não publicada.'; end if;
 select * into v_profile from public.collective_profiles where id=v_version.profile_id;
 insert into public.time_bank_policies (
  user_id,title,source_reference,valid_from,valid_until,
  weekday_factor,saturday_factor,sunday_factor,holiday_factor,
  daily_target_minutes,settlement_interval_months,settlement_months,settlement_half,
  catalog_profile_version_id
 ) values (
  v_user,v_profile.name,'Biblioteca Payrep · '||v_profile.organization||' / '||v_profile.uf,
  v_version.valid_from,v_version.valid_until,
  v_version.weekday_factor,v_version.saturday_factor,v_version.sunday_factor,v_version.holiday_factor,
  v_version.daily_target_minutes,v_version.settlement_interval_months,
  v_version.settlement_months,v_version.settlement_half,
  v_version.id
 ) returning id into v_id;
 insert into public.collective_profile_followers(user_id,profile_id)
 values(v_user,v_version.profile_id) on conflict do nothing;
 return v_id;
end $$;
revoke all on function public.assign_my_collective_profile_version(uuid) from public,anon;
grant execute on function public.assign_my_collective_profile_version(uuid) to authenticated;
