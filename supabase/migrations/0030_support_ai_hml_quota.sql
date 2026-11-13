-- Payrep AI support: HML-only request reservation and strict quotas.
-- Never stores questions, AI replies, salary values, or Cloudflare credentials.
create table if not exists public.support_ai_daily_usage (
 user_id uuid not null references auth.users(id) on delete cascade,
 usage_day date not null,
 request_count integer not null default 0 check (request_count between 0 and 8),
 last_request_at timestamptz not null default now(),
 primary key(user_id,usage_day)
);
alter table public.support_ai_daily_usage enable row level security;
revoke all on public.support_ai_daily_usage from public, anon, authenticated;
grant select,insert,update on public.support_ai_daily_usage to service_role;

create or replace function public.reserve_support_ai_request(p_user_id uuid)
returns text language plpgsql security invoker
set search_path=''
as $$
declare
 v_day date := (now() at time zone 'UTC')::date;
 v_count integer := 0;
 v_global integer := 0;
 v_last timestamptz;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then
  raise exception 'Backend authorization required' using errcode='42501';
 end if;
 if p_user_id is null or not exists (
  select 1 from public.app_members m
   where m.user_id=p_user_id and m.active and m.status='approved'
 ) then return 'not_eligible'; end if;

 -- Serialize allocations even across users to enforce the daily global cap.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('payrep-support-ai-utc-day-'||v_day::text));
 select coalesce(sum(request_count),0) into v_global
 from public.support_ai_daily_usage where usage_day=v_day;
 if v_global >= 50 then return 'global_limit'; end if;

 select request_count,last_request_at into v_count,v_last
 from public.support_ai_daily_usage
 where user_id=p_user_id and usage_day=v_day;
 if found and v_count >= 8 then return 'user_limit'; end if;
 if found and v_last > now()-interval '20 seconds' then return 'cooldown'; end if;

 insert into public.support_ai_daily_usage(user_id,usage_day,request_count,last_request_at)
 values(p_user_id,v_day,1,now())
 on conflict(user_id,usage_day) do update
 set request_count=public.support_ai_daily_usage.request_count+1,
     last_request_at=now();
 return 'ok';
end
$$;
revoke all on function public.reserve_support_ai_request(uuid) from public, anon, authenticated;
grant execute on function public.reserve_support_ai_request(uuid) to service_role;
