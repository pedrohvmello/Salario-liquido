-- Initialize a private profile and a Free subscription at signup.
-- This does not bypass existing membership approval or unlock paid features.
create or replace function private.initialize_profile_and_plan()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 insert into public.user_profiles(user_id,display_name)
 values(new.id,left(coalesce(nullif(new.raw_user_meta_data->>'display_name',''),
    nullif(new.raw_user_meta_data->>'full_name',''),
    nullif(new.raw_user_meta_data->>'name',''),''),100))
 on conflict(user_id) do nothing;
 insert into public.billing_subscriptions(user_id,plan_code,status)
 values(new.id,'free','active')
 on conflict(user_id) do nothing;
 return new;
end
$$;
revoke all on function private.initialize_profile_and_plan() from public,anon,authenticated;
drop trigger if exists on_auth_profile_and_plan_created on auth.users;
create trigger on_auth_profile_and_plan_created after insert on auth.users
for each row execute function private.initialize_profile_and_plan();
