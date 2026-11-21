-- HML/PRD. Capture the Pep personal daily entitlement at checkout creation.
-- Future administrator reductions cannot diminish an already contracted minimum.
-- This is separate from shared global safety quotas, external provider availability and promotional allowances.
alter table public.billing_checkout_intents
 add column if not exists pep_personal_daily_limit_snapshot bigint
 check(pep_personal_daily_limit_snapshot is null or pep_personal_daily_limit_snapshot>=1);
alter table public.billing_subscriptions
 add column if not exists pep_personal_daily_limit_snapshot bigint
 check(pep_personal_daily_limit_snapshot is null or pep_personal_daily_limit_snapshot>=1);

-- Historical records had no immutable offer snapshot. Establish a one-time baseline from
-- current server-side configuration; do not falsely claim their original offer can be recovered.
update public.billing_checkout_intents c
set pep_personal_daily_limit_snapshot=case c.plan_code
 when 'basic' then s.pep_basic_daily_limit when 'full' then s.pep_full_daily_limit end
from public.app_admin_settings s
where s.id=1 and c.plan_code in ('basic','full')
 and c.pep_personal_daily_limit_snapshot is null;
update public.billing_subscriptions b
set pep_personal_daily_limit_snapshot=case b.plan_code
 when 'basic' then s.pep_basic_daily_limit when 'full' then s.pep_full_daily_limit end
from public.app_admin_settings s
where s.id=1 and b.plan_code in ('basic','full')
 and b.status='active' and b.provider='asaas'
 and b.pep_personal_daily_limit_snapshot is null;

create or replace function private.capture_pep_offer_snapshot()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare v_limit bigint;
begin
 select case new.plan_code when 'basic' then pep_basic_daily_limit
  when 'full' then pep_full_daily_limit end into v_limit
 from public.app_admin_settings where id=1;
 if v_limit is null or v_limit<1 then
  raise exception 'Pep plan quota unavailable for checkout' using errcode='23514';
 end if;
 new.pep_personal_daily_limit_snapshot:=v_limit;
 return new;
end $fn$;
revoke all on function private.capture_pep_offer_snapshot() from public,anon,authenticated;
drop trigger if exists payrep_pep_checkout_offer on public.billing_checkout_intents;
create trigger payrep_pep_checkout_offer before insert on public.billing_checkout_intents
for each row execute function private.capture_pep_offer_snapshot();

create or replace function private.prevent_pep_offer_edit()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if old.pep_personal_daily_limit_snapshot is distinct from new.pep_personal_daily_limit_snapshot then
  raise exception 'Contracted Pep offer is immutable' using errcode='23514';
 end if;
 return new;
end $fn$;
revoke all on function private.prevent_pep_offer_edit() from public,anon,authenticated;
drop trigger if exists payrep_pep_checkout_immutable on public.billing_checkout_intents;
create trigger payrep_pep_checkout_immutable before update on public.billing_checkout_intents
for each row execute function private.prevent_pep_offer_edit();

create or replace function private.capture_pep_subscription_snapshot()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare v_snap bigint;
begin
 if new.plan_code not in ('basic','full') or new.provider is distinct from 'asaas' then
  new.pep_personal_daily_limit_snapshot:=null;
  return new;
 end if;
 -- Never overwrite the original subscription guarantee during renewal or status updates.
 if tg_op='UPDATE' then
  if old.provider_subscription_id is not distinct from new.provider_subscription_id
   and old.plan_code is not distinct from new.plan_code
   and old.pep_personal_daily_limit_snapshot is not null then
    new.pep_personal_daily_limit_snapshot:=old.pep_personal_daily_limit_snapshot;
    return new;
  end if;
 end if;
 -- Only an Asaas settlement linked by verified subscription event to a paid internal
 -- checkout can supply the contractual terms. No user-supplied values are accepted.
 if new.status='active' and new.provider_subscription_id is not null then
  select i.pep_personal_daily_limit_snapshot into v_snap
  from public.billing_webhook_events e
  join public.billing_checkout_intents i
   on i.provider_checkout_id=e.payload#>>'{subscription,checkoutSession}'
  where e.provider='asaas' and e.event_type='SUBSCRIPTION_CREATED'
    and e.payload#>>'{subscription,id}'=new.provider_subscription_id
    and i.user_id=new.user_id and i.plan_code=new.plan_code
    and i.status='paid' and i.pep_personal_daily_limit_snapshot is not null
  order by e.received_at desc limit 1;
  if v_snap is null then
   raise exception 'Verified contract quota snapshot not found' using errcode='23514';
  end if;
  new.pep_personal_daily_limit_snapshot:=v_snap;
 end if;
 return new;
end $fn$;
revoke all on function private.capture_pep_subscription_snapshot() from public,anon,authenticated;
drop trigger if exists payrep_pep_subscription_snapshot on public.billing_subscriptions;
create trigger payrep_pep_subscription_snapshot before insert or update on public.billing_subscriptions
for each row execute function private.capture_pep_subscription_snapshot();

create or replace function private.guaranteed_pep_personal_daily_limit(p_user_id uuid,p_effective_plan text)
returns bigint language sql stable security definer set search_path=''
as $fn$
 select case when p_effective_plan='free' then 0
 else greatest(
  (select case p_effective_plan when 'full' then pep_full_daily_limit
   else pep_basic_daily_limit end from public.app_admin_settings where id=1),
  coalesce((select s.pep_personal_daily_limit_snapshot from public.billing_subscriptions s
   where s.user_id=p_user_id and s.plan_code in ('basic','full') and s.status='active'
   and (s.current_period_end is null or s.current_period_end>now())),0)
 ) end
$fn$;
revoke all on function private.guaranteed_pep_personal_daily_limit(uuid,text) from public,anon,authenticated;

create or replace function public.get_my_plan_benefit_limits()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare v_uid uuid:=(select auth.uid());v_s public.app_admin_settings%rowtype;v_snapshot bigint;
begin
 if v_uid is null or not private.current_mfa_satisfied() or not exists(
  select 1 from public.app_members where user_id=v_uid and active=true and status='approved'
 ) then raise exception 'Acesso não autorizado' using errcode='42501';end if;
 select * into v_s from public.app_admin_settings where id=1;
 if not found then raise exception 'Configuração indisponível' using errcode='P0002';end if;
 select s.pep_personal_daily_limit_snapshot into v_snapshot from public.billing_subscriptions s
 where s.user_id=v_uid and s.plan_code in ('basic','full') and s.status='active'
  and (s.current_period_end is null or s.current_period_end>now());
 return pg_catalog.jsonb_build_object(
  'helpDailyLimit',v_s.pep_help_daily_limit,
  'basicDailyLimit',v_s.pep_basic_daily_limit,
  'fullDailyLimit',v_s.pep_full_daily_limit,
  'globalDailyLimit',v_s.support_ai_global_daily_limit,
  'contractedPersonalDailyMinimum',v_snapshot,
  'effectivePersonalDailyLimit',private.guaranteed_pep_personal_daily_limit(
    v_uid,private.pep_plan_for_user(v_uid)),
  'resetTimezone','UTC');
end $fn$;
revoke all on function public.get_my_plan_benefit_limits() from public,anon;
grant execute on function public.get_my_plan_benefit_limits() to authenticated;


CREATE OR REPLACE FUNCTION public.reserve_pep_request(p_user_id uuid, p_mode text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  else private.guaranteed_pep_personal_daily_limit(p_user_id,v_plan) end;
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_pep_usage()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  'personalLimit',case when v_plan in ('basic','full')
   then private.guaranteed_pep_personal_daily_limit(v_uid,v_plan) else 0 end,
  'contractedPersonalLimit',(select s.pep_personal_daily_limit_snapshot
   from public.billing_subscriptions s where s.user_id=v_uid and s.plan_code in ('basic','full')
   and s.status='active' and (s.current_period_end is null or s.current_period_end>now())),
  'timezone','UTC');
end
$function$
;
