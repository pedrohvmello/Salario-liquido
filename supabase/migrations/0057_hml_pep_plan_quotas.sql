-- Payrep HML: independent Pep Ajuda and Pep personal quotas, Basic/Full share personal usage.
-- UI values can change without a deploy; server evaluates the effective paid/promotional plan.
alter table public.app_admin_settings
 add column if not exists pep_help_daily_limit bigint not null default 50 check (pep_help_daily_limit>0),
 add column if not exists pep_basic_daily_limit bigint not null default 20 check (pep_basic_daily_limit>0),
 add column if not exists pep_full_daily_limit bigint not null default 50 check (pep_full_daily_limit>0);

-- Preserve the current help limit instead of silently resetting it.
update public.app_admin_settings
 set pep_help_daily_limit=support_ai_user_daily_limit where id=1;

create table if not exists private.pep_daily_usage(
 user_id uuid not null references auth.users(id) on delete cascade,
 usage_day date not null,
 mode text not null check(mode in ('help','personal')),
 request_count bigint not null default 0 check(request_count>=0),
 last_request_at timestamptz not null default now(),
 primary key(user_id,usage_day,mode)
);
alter table private.pep_daily_usage enable row level security;
revoke all on private.pep_daily_usage from public,anon,authenticated;

-- Legacy requests were not labelled by purpose; count them conservatively as help.
insert into private.pep_daily_usage(user_id,usage_day,mode,request_count,last_request_at)
 select user_id,usage_day,'help',request_count,last_request_at
 from public.support_ai_daily_usage
 on conflict(user_id,usage_day,mode) do nothing;

create or replace function private.pep_plan_for_user(p_user_id uuid)
returns text language plpgsql stable security definer set search_path=''
as $fn$
declare v_paid integer:=0;v_promo integer:=0;v_trial integer:=0;
begin
 if not exists(select 1 from public.app_members
  where user_id=p_user_id and active and status='approved') then return 'free'; end if;
 select coalesce(max(case s.plan_code when 'full' then 2 when 'basic' then 1 else 0 end),0)
 into v_paid from public.billing_subscriptions s
 where s.user_id=p_user_id and s.status='active'
 and (s.current_period_end is null or s.current_period_end>now());
 if exists(select 1 from public.billing_full_trials t where t.user_id=p_user_id
  and t.revoked_at is null and t.starts_at<=now() and t.ends_at>now())then v_trial:=2;end if;
 select coalesce(max(case r.plan_code when 'full' then 2 when 'basic' then 1 else 0 end),0)
 into v_promo from private.payrep_promo_redemptions r
 where r.user_id=p_user_id and r.started_at<=now() and r.ends_at>now();
 return case greatest(v_paid,v_trial,v_promo) when 2 then 'full' when 1 then 'basic' else 'free' end;
end
$fn$;
revoke all on function private.pep_plan_for_user(uuid) from public,anon,authenticated;

create or replace function public.reserve_pep_request(p_user_id uuid,p_mode text)
returns text language plpgsql security definer set search_path=''
as $fn$
declare
 v_day date:=(now() at time zone 'UTC')::date;
 v_role text;
 v_plan text;
 v_user_limit bigint;
 v_global_limit bigint;
 v_user_used bigint;
 v_global_used bigint;
 v_settings public.app_admin_settings%rowtype;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then
  raise exception 'Backend authorization required' using errcode='42501';
 end if;
 if p_mode not in ('help','personal') or p_user_id is null then return 'invalid_mode';end if;
 select role into v_role from public.app_members
 where user_id=p_user_id and active=true and status='approved';
 if not found then return 'not_eligible';end if;
 v_plan:=private.pep_plan_for_user(p_user_id);
 if p_mode='personal' and v_plan='free' and v_role<>'admin' then return 'plan_required';end if;
 if v_role='admin' then return 'ok';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('payrep-pep-utc-day-'||v_day::text));
 select * into v_settings from public.app_admin_settings where id=1;
 if not found then return 'configuration_unavailable';end if;
 v_user_limit:=case p_mode when 'help' then v_settings.pep_help_daily_limit
  when 'personal' then (case v_plan when 'full' then v_settings.pep_full_daily_limit
   else v_settings.pep_basic_daily_limit end) end;
 v_global_limit:=v_settings.support_ai_global_daily_limit;
 select coalesce(sum(request_count),0) into v_global_used
 from private.pep_daily_usage u
 where u.usage_day=v_day and not exists(select 1 from public.app_members a
  where a.user_id=u.user_id and a.role='admin');
 if v_global_used>=v_global_limit then return 'global_limit';end if;
 select coalesce(request_count,0) into v_user_used from private.pep_daily_usage
  where user_id=p_user_id and usage_day=v_day and mode=p_mode;
 v_user_used:=coalesce(v_user_used,0);
 if v_user_used>=v_user_limit then return 'user_limit';end if;
 insert into private.pep_daily_usage(user_id,usage_day,mode,request_count,last_request_at)
 values(p_user_id,v_day,p_mode,1,now())
 on conflict(user_id,usage_day,mode) do update
 set request_count=private.pep_daily_usage.request_count+1,last_request_at=now();
 return 'ok';
end
$fn$;
revoke all on function public.reserve_pep_request(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_pep_request(uuid,text) to service_role;

create or replace function private.admin_get_pep_limits()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare v_settings public.app_admin_settings%rowtype;v_used bigint;v_users bigint;
begin
 if not private.is_current_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 select * into v_settings from public.app_admin_settings where id=1;
 if not found then raise exception 'Missing settings' using errcode='P0002';end if;
 select coalesce(sum(u.request_count),0),count(distinct u.user_id)
 into v_used,v_users from private.pep_daily_usage u where u.usage_day=(now() at time zone 'UTC')::date
 and not exists(select 1 from public.app_members m where m.user_id=u.user_id and m.role='admin');
 return pg_catalog.jsonb_build_object('helpDailyLimit',v_settings.pep_help_daily_limit,
  'basicDailyLimit',v_settings.pep_basic_daily_limit,'fullDailyLimit',v_settings.pep_full_daily_limit,
  'globalDailyLimit',v_settings.support_ai_global_daily_limit,
  'usedToday',v_used,'usersToday',v_users,'timezone','UTC');
end
$fn$;
create or replace function public.get_pep_limits()
returns jsonb language sql stable set search_path=''
as $fn$ select private.admin_get_pep_limits() $fn$;
revoke all on function public.get_pep_limits() from public,anon;
grant execute on function public.get_pep_limits() to authenticated;

create or replace function private.admin_update_pep_limits(
 p_help bigint,p_basic bigint,p_full bigint,p_global bigint)
returns void language plpgsql security definer set search_path=''
as $fn$
declare v_old jsonb;v_new jsonb;
begin
 if not private.is_current_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 if p_help is null or p_basic is null or p_full is null or p_global is null
 or least(p_help,p_basic,p_full,p_global)<1 or p_full<p_basic then
 raise exception 'Informe limites positivos e Full maior ou igual ao Basic.' using errcode='22023';end if;
 select pg_catalog.jsonb_build_object('help',pep_help_daily_limit,
  'basic',pep_basic_daily_limit,'full',pep_full_daily_limit,
  'global',support_ai_global_daily_limit) into v_old
 from public.app_admin_settings where id=1 for update;
 if v_old is null then raise exception 'Missing settings' using errcode='P0002';end if;
 v_new:=pg_catalog.jsonb_build_object('help',p_help,'basic',p_basic,'full',p_full,'global',p_global);
 if v_old=v_new then return;end if;
 update public.app_admin_settings set pep_help_daily_limit=p_help,
  pep_basic_daily_limit=p_basic,pep_full_daily_limit=p_full,
  support_ai_global_daily_limit=p_global,updated_at=now(),updated_by=auth.uid()
 where id=1;
 insert into public.app_admin_audit(actor_id,action,old_value,new_value)
 values(auth.uid(),'pep_plan_daily_limits',v_old::text,v_new::text);
end
$fn$;
create or replace function public.set_pep_limits(
 p_help bigint,p_basic bigint,p_full bigint,p_global bigint)
returns void language sql set search_path=''
as $fn$ select private.admin_update_pep_limits(p_help,p_basic,p_full,p_global) $fn$;
revoke all on function public.set_pep_limits(bigint,bigint,bigint,bigint) from public,anon;
grant execute on function public.set_pep_limits(bigint,bigint,bigint,bigint) to authenticated;

create or replace function public.get_my_pep_usage()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare v_uid uuid:=(select auth.uid());v_member public.app_members%rowtype;
 v_plan text;v_settings public.app_admin_settings%rowtype;v_help bigint;v_personal bigint;
begin
 if v_uid is null or not private.current_mfa_satisfied() then
  raise exception 'Session not authorized' using errcode='42501';end if;
 select * into v_member from public.app_members where user_id=v_uid and active and status='approved';
 if v_member.user_id is null then raise exception 'Account not authorized' using errcode='42501';end if;
 v_plan:=private.pep_plan_for_user(v_uid);
 select * into v_settings from public.app_admin_settings where id=1;
 select coalesce(max(request_count) filter(where mode='help'),0),
  coalesce(max(request_count) filter(where mode='personal'),0)
 into v_help,v_personal from private.pep_daily_usage
 where user_id=v_uid and usage_day=(now() at time zone 'UTC')::date;
 return pg_catalog.jsonb_build_object('effectivePlan',v_plan,
  'unlimited',v_member.role='admin',
  'helpUsed',v_help,'personalUsed',v_personal,
  'helpLimit',v_settings.pep_help_daily_limit,
  'personalLimit',case v_plan when 'full' then v_settings.pep_full_daily_limit
   when 'basic' then v_settings.pep_basic_daily_limit else 0 end,
  'timezone','UTC');
end
$fn$;
revoke all on function public.get_my_pep_usage() from public,anon;
grant execute on function public.get_my_pep_usage() to authenticated;
