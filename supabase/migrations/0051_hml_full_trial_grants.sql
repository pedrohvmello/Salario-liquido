-- HML: Full trial grants are independent of Asaas billing and never create charges.
-- One trial per account, admin assigned for 7/14/30 days, no auto conversion.
create table if not exists public.billing_full_trials (
 user_id uuid primary key references auth.users(id) on delete cascade,
 starts_at timestamptz not null default now(),
 ends_at timestamptz not null,
 granted_by uuid references auth.users(id) on delete set null,
 granted_at timestamptz not null default now(),
 revoked_at timestamptz,
 revoked_by uuid references auth.users(id) on delete set null,
 constraint billing_full_trials_dates check (ends_at > starts_at and ends_at <= starts_at + interval '31 days'),
 constraint billing_full_trials_revocation check (revoked_at is null or revoked_at >= starts_at)
);
alter table public.billing_full_trials enable row level security;
revoke all on public.billing_full_trials from public,anon,authenticated;
grant select on public.billing_full_trials to authenticated;
drop policy if exists billing_full_trials_owner_read on public.billing_full_trials;
create policy billing_full_trials_owner_read on public.billing_full_trials for select to authenticated
 using(user_id=(select auth.uid()) and (select private.current_mfa_satisfied()));

create or replace function public.grant_hml_full_trial(p_target uuid,p_days integer)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid := (select auth.uid());
 v_from timestamptz := now();
 v_to timestamptz;
begin
 if v_actor is null or not private.is_current_admin() then
  raise exception 'Operação administrativa não autorizada.' using errcode='42501';
 end if;
 if p_target is null or p_days not in (7,14,30) or p_days is null then
  raise exception 'Selecione um usuário e uma duração válida (7, 14 ou 30 dias).' using errcode='22023';
 end if;
 if not exists(select 1 from public.app_members where user_id=p_target
  and active=true and status='approved') then
  raise exception 'Usuário não está aprovado e ativo.' using errcode='23514';
 end if;
 if exists(select 1 from public.billing_subscriptions s where s.user_id=p_target
  and s.plan_code in ('basic','full') and s.status in ('active','trialing','past_due')
  and (s.current_period_end is null or s.current_period_end > now())) then
  raise exception 'Há uma assinatura paga vigente. Não sobreponha com um teste grátis.' using errcode='23514';
 end if;
 if exists(select 1 from public.billing_full_trials where user_id=p_target) then
  raise exception 'Esse usuário já recebeu um teste Full. Não há concessão repetida.' using errcode='23514';
 end if;
 v_to := v_from + (p_days || ' days')::interval;
 insert into public.billing_full_trials(user_id,starts_at,ends_at,granted_by)
  values(p_target,v_from,v_to,v_actor);
 return pg_catalog.jsonb_build_object('granted',true,'endsAt',v_to);
end
$fn$;
revoke all on function public.grant_hml_full_trial(uuid,integer) from public,anon;
grant execute on function public.grant_hml_full_trial(uuid,integer) to authenticated;

create or replace function public.revoke_hml_full_trial(p_target uuid)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_actor uuid:=(select auth.uid()); v_count integer;
begin
 if v_actor is null or not private.is_current_admin() then
  raise exception 'Operação administrativa não autorizada.' using errcode='42501';
 end if;
 update public.billing_full_trials
 set revoked_at=now(),revoked_by=v_actor
 where user_id=p_target and revoked_at is null and ends_at>now();
 get diagnostics v_count=row_count;
 if v_count<>1 then raise exception 'Teste Full ativo não encontrado.' using errcode='23514';end if;
 return pg_catalog.jsonb_build_object('revoked',true);
end
$fn$;
revoke all on function public.revoke_hml_full_trial(uuid) from public,anon;
grant execute on function public.revoke_hml_full_trial(uuid) to authenticated;

create or replace function public.list_hml_full_trials()
returns jsonb language plpgsql security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or not private.is_current_admin() then
  raise exception 'Operação administrativa não autorizada.' using errcode='42501';
 end if;
 return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'userId',t.user_id,'displayName',coalesce(p.display_name,'Usuário sem nome'),
  'startsAt',t.starts_at,'endsAt',t.ends_at,'revokedAt',t.revoked_at,
  'state',case when t.revoked_at is not null then 'revoked'
   when t.ends_at<=now() then 'expired' else 'active' end
 ) order by t.granted_at desc)
 from public.billing_full_trials t
 left join public.user_profiles p on p.user_id=t.user_id),'[]'::jsonb);
end
$fn$;
revoke all on function public.list_hml_full_trials() from public,anon;
grant execute on function public.list_hml_full_trials() to authenticated;

create or replace function public.my_effective_payrep_plan()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare
 v_uid uuid:=(select auth.uid());
 v_paid text;
 v_trial public.billing_full_trials%rowtype;
 v_effective text:='free';
begin
 if v_uid is null or not private.current_mfa_satisfied() or not exists(
  select 1 from public.app_members where user_id=v_uid and active=true and status='approved'
 ) then
  raise exception 'Sessão ou conta sem permissão.' using errcode='42501';
 end if;
 select plan_code into v_paid from public.billing_subscriptions
 where user_id=v_uid and plan_code in ('basic','full')
  and status='active' and (current_period_end is null or current_period_end>now());
 select * into v_trial from public.billing_full_trials where user_id=v_uid;
 if v_paid in ('basic','full') then
  v_effective:=v_paid;
 elsif v_trial.user_id is not null and v_trial.revoked_at is null
  and v_trial.starts_at<=now() and v_trial.ends_at>now() then
  v_effective:='full';
 end if;
 return pg_catalog.jsonb_build_object(
  'effectivePlan',v_effective,
  'paidPlan',coalesce(v_paid,'free'),
  'trialActive',v_effective='full' and v_paid is null,
  'trialStartsAt',v_trial.starts_at,
  'trialEndsAt',v_trial.ends_at,
  'trialRevokedAt',v_trial.revoked_at);
end
$fn$;
revoke all on function public.my_effective_payrep_plan() from public,anon;
grant execute on function public.my_effective_payrep_plan() to authenticated;
