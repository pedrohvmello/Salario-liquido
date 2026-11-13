-- HML: no hidden per-request cooldown. Administrators set both daily caps.
-- Users remain subject to configurable daily quotas and Cloudflare free allocation.
begin;
create or replace function public.reserve_support_ai_request(p_user_id uuid)
returns text language plpgsql security invoker set search_path=''
as $$
declare
 v_day date := (now() at time zone 'UTC')::date;
 v_count integer := 0;
 v_global integer := 0;
 v_user_limit bigint;
 v_global_limit bigint;
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

 select request_count into v_count
 from public.support_ai_daily_usage where user_id=p_user_id and usage_day=v_day;
 if found and v_count >= v_user_limit then return 'user_limit'; end if;

 insert into public.support_ai_daily_usage(user_id,usage_day,request_count,last_request_at)
 values(p_user_id,v_day,1,now())
 on conflict(user_id,usage_day) do update
 set request_count=public.support_ai_daily_usage.request_count+1,last_request_at=now();
 return 'ok';
end $$;
revoke all on function public.reserve_support_ai_request(uuid) from public,anon,authenticated;
grant execute on function public.reserve_support_ai_request(uuid) to service_role;
commit;
