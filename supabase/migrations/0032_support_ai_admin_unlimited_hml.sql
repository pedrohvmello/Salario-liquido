-- HML AI: administrators with verified TOTP are not rate-limited in the Edge
-- Function. Exclude historical admin requests from the regular-users' global cap
-- and dashboard usage without deleting or changing preexisting usage rows.
-- Cloudflare's free daily neuron budget is external and not unlimited.
begin;

create or replace function private.admin_get_support_ai_limits()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
 v_limits record;
 v_used integer;
 v_users integer;
begin
 if not private.is_current_admin() then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 select s.support_ai_user_daily_limit as user_limit,
        s.support_ai_global_daily_limit as global_limit
 into v_limits from public.app_admin_settings s where s.id=1;
 if not found then
  raise exception 'Missing administration settings' using errcode='P0002';
 end if;
 select coalesce(sum(request_count),0)::integer,count(*)::integer
 into v_used,v_users
 from public.support_ai_daily_usage u
 where u.usage_day=(now() at time zone 'UTC')::date
   and not exists (
    select 1 from public.app_members m
    where m.user_id=u.user_id and m.role='admin'
   );
 return pg_catalog.jsonb_build_object(
  'userDailyLimit',v_limits.user_limit,
  'globalDailyLimit',v_limits.global_limit,
  'usedToday',v_used,
  'usersToday',v_users,
  'timezone','UTC'
 );
end $$;

create or replace function public.reserve_support_ai_request(p_user_id uuid)
returns text language plpgsql security invoker set search_path=''
as $$
declare
 v_day date := (now() at time zone 'UTC')::date;
 v_count integer := 0;
 v_global integer := 0;
 v_last timestamptz;
 v_user_limit integer;
 v_global_limit integer;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then
  raise exception 'Backend authorization required' using errcode='42501';
 end if;
 if p_user_id is null or not exists (
  select 1 from public.app_members m
   where m.user_id=p_user_id and m.active and m.status='approved'
 ) then return 'not_eligible'; end if;

 -- The advisory lock serializes requests across users, protecting the global cap.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('payrep-support-ai-utc-day-'||v_day::text));
 select s.support_ai_user_daily_limit,s.support_ai_global_daily_limit
 into v_user_limit,v_global_limit
 from public.app_admin_settings s where s.id=1;
 if not found then return 'configuration_unavailable'; end if;

 select coalesce(sum(request_count),0) into v_global
 from public.support_ai_daily_usage u
 where u.usage_day=v_day and not exists (
  select 1 from public.app_members m
  where m.user_id=u.user_id and m.role='admin'
 );
 if v_global >= v_global_limit then return 'global_limit'; end if;

 select request_count,last_request_at into v_count,v_last
 from public.support_ai_daily_usage where user_id=p_user_id and usage_day=v_day;
 if found and v_count >= v_user_limit then return 'user_limit'; end if;
 if found and v_last > now()-interval '20 seconds' then return 'cooldown'; end if;

 insert into public.support_ai_daily_usage(user_id,usage_day,request_count,last_request_at)
 values(p_user_id,v_day,1,now())
 on conflict(user_id,usage_day) do update
 set request_count=public.support_ai_daily_usage.request_count+1,last_request_at=now();
 return 'ok';
end $$;

commit;
