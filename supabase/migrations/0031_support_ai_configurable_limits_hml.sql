-- HML: configurable daily AI request limits, protected by administrator TOTP and RLS.
-- Default limits preserve the original behavior (8/user and 50/global per UTC day).
-- Bounds avoid unbounded Cloudflare usage. Provider Free allowance remains independent.
begin;

alter table public.app_admin_settings
 add column if not exists support_ai_user_daily_limit integer not null default 8,
 add column if not exists support_ai_global_daily_limit integer not null default 50;

alter table public.app_admin_settings
 drop constraint if exists app_admin_settings_support_ai_limits_check;
alter table public.app_admin_settings
 add constraint app_admin_settings_support_ai_limits_check
 check (
  support_ai_user_daily_limit between 1 and 100
  and support_ai_global_daily_limit between 1 and 300
  and support_ai_global_daily_limit >= support_ai_user_daily_limit
 );

alter table public.support_ai_daily_usage
 drop constraint if exists support_ai_daily_usage_request_count_check;
alter table public.support_ai_daily_usage
 add constraint support_ai_daily_usage_request_count_check
 check (request_count between 0 and 100);

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
 from public.support_ai_daily_usage
 where usage_day=(now() at time zone 'UTC')::date;
 return pg_catalog.jsonb_build_object(
  'userDailyLimit',v_limits.user_limit,
  'globalDailyLimit',v_limits.global_limit,
  'usedToday',v_used,
  'usersToday',v_users,
  'timezone','UTC'
 );
end $$;

create or replace function private.admin_update_support_ai_limits(p_user_limit integer,p_global_limit integer)
returns void language plpgsql security definer set search_path=''
as $$
declare
 v_old record;
begin
 if not private.is_current_admin() then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 if p_user_limit is null or p_global_limit is null
  or p_user_limit not between 1 and 100
  or p_global_limit not between 1 and 300
  or p_global_limit < p_user_limit then
  raise exception 'Invalid daily AI limits' using errcode='22023';
 end if;
 select support_ai_user_daily_limit as per_user,
        support_ai_global_daily_limit as overall
 into v_old from public.app_admin_settings where id=1 for update;
 if not found then
  raise exception 'Missing administration settings' using errcode='P0002';
 end if;
 if v_old.per_user=p_user_limit and v_old.overall=p_global_limit then return; end if;
 update public.app_admin_settings
 set support_ai_user_daily_limit=p_user_limit,
     support_ai_global_daily_limit=p_global_limit,
     updated_at=now(),
     updated_by=auth.uid()
 where id=1;
 insert into public.app_admin_audit(actor_id,action,old_value,new_value)
 values(
  auth.uid(),'support_ai_daily_limits',
  pg_catalog.jsonb_build_object('user',v_old.per_user,'global',v_old.overall)::text,
  pg_catalog.jsonb_build_object('user',p_user_limit,'global',p_global_limit)::text
 );
end $$;

create or replace function public.get_support_ai_limits()
returns jsonb language sql stable security invoker set search_path=''
as $$ select private.admin_get_support_ai_limits() $$;

create or replace function public.set_support_ai_limits(p_user_limit integer,p_global_limit integer)
returns void language sql security invoker set search_path=''
as $$ select private.admin_update_support_ai_limits(p_user_limit,p_global_limit) $$;

revoke all on function private.admin_get_support_ai_limits() from public,anon,authenticated;
revoke all on function private.admin_update_support_ai_limits(integer,integer) from public,anon,authenticated;
grant execute on function private.admin_get_support_ai_limits() to authenticated;
grant execute on function private.admin_update_support_ai_limits(integer,integer) to authenticated;
revoke all on function public.get_support_ai_limits() from public,anon,authenticated;
revoke all on function public.set_support_ai_limits(integer,integer) from public,anon,authenticated;
grant execute on function public.get_support_ai_limits() to authenticated;
grant execute on function public.set_support_ai_limits(integer,integer) to authenticated;

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
 from public.support_ai_daily_usage where usage_day=v_day;
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
revoke all on function public.reserve_support_ai_request(uuid) from public,anon,authenticated;
grant execute on function public.reserve_support_ai_request(uuid) to service_role;

commit;
