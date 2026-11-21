-- Promote grants and revocations without modifying Asaas billing records.
-- All writes are admin-only, require verified TOTP, and retain audit history.
alter table private.payrep_promo_redemptions
 add column if not exists revoked_at timestamptz,
 add column if not exists revoked_by uuid references auth.users(id) on delete set null;

create table if not exists public.billing_manual_access_grants(
 id uuid primary key default pg_catalog.gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 plan_code text not null check(plan_code in ('basic','full')),
 starts_at timestamptz not null default now(),
 ends_at timestamptz not null,
 granted_by uuid references auth.users(id) on delete set null,
 granted_at timestamptz not null default now(),
 revoked_at timestamptz,
 revoked_by uuid references auth.users(id) on delete set null,
 constraint billing_manual_access_grant_dates check(ends_at>starts_at and ends_at<=starts_at+interval '366 days'),
 constraint billing_manual_access_grant_revocation check(revoked_at is null or revoked_at>=starts_at)
);
create index if not exists billing_manual_access_grants_user_idx on public.billing_manual_access_grants(user_id,ends_at desc);
alter table public.billing_manual_access_grants enable row level security;
revoke all on public.billing_manual_access_grants from public,anon,authenticated;

create table if not exists public.billing_admin_plan_overrides(
 user_id uuid primary key references auth.users(id) on delete cascade,
 plan_code text not null check(plan_code in ('free','basic','full')),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null
);
alter table public.billing_admin_plan_overrides enable row level security;
revoke all on public.billing_admin_plan_overrides from public,anon,authenticated;

create table if not exists public.billing_admin_plan_override_audit(
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 previous_plan text,
 new_plan text,
 actor_id uuid references auth.users(id) on delete set null,
 changed_at timestamptz not null default now()
);
alter table public.billing_admin_plan_override_audit enable row level security;
revoke all on public.billing_admin_plan_override_audit from public,anon,authenticated;

create or replace function public.grant_admin_promotional_access(p_target uuid,p_plan text,p_days integer)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_actor uuid:=(select auth.uid());v_now timestamptz:=now();v_end timestamptz;v_id uuid;
v_paid text;
begin
 if v_actor is null or not private.is_current_admin() then
  raise exception 'Acesso administrativo requer sessão TOTP validada.' using errcode='42501';
 end if;
 if p_target is null or p_plan not in ('basic','full') or p_days not between 1 and 365 then
  raise exception 'Informe usuário, plano e duração entre 1 e 365 dias.' using errcode='22023';
 end if;
 perform 1 from public.app_members where user_id=p_target and active and status='approved' and role<>'admin' for update;
 if not found then raise exception 'Usuário não está aprovado, ativo ou é administrador.' using errcode='23514';end if;
 if exists(select 1 from public.billing_admin_plan_overrides where user_id=p_target) then
  raise exception 'Remova a alteração manual permanente antes de conceder promoção.' using errcode='23514';
 end if;
 if exists(select 1 from public.billing_manual_access_grants
  where user_id=p_target and revoked_at is null and starts_at<=v_now and ends_at>v_now)
 or exists(select 1 from public.billing_full_trials
  where user_id=p_target and revoked_at is null and starts_at<=v_now and ends_at>v_now)
 or exists(select 1 from private.payrep_promo_redemptions
  where user_id=p_target and revoked_at is null and started_at<=v_now and ends_at>v_now) then
   raise exception 'O usuário já tem benefício promocional vigente. Revogue-o antes de conceder outro.' using errcode='23514';
 end if;
 select s.plan_code into v_paid from public.billing_subscriptions s where s.user_id=p_target
  and s.status='active' and (s.current_period_end is null or s.current_period_end>v_now);
 if coalesce(v_paid,'free')='full' or (v_paid='basic' and p_plan='basic') then
  raise exception 'O plano pago vigente já oferece este nível ou superior.' using errcode='23514';
 end if;
 v_end:=v_now+pg_catalog.make_interval(days=>p_days);
 insert into public.billing_manual_access_grants(user_id,plan_code,starts_at,ends_at,granted_by)
 values(p_target,p_plan,v_now,v_end,v_actor) returning id into v_id;
 return pg_catalog.jsonb_build_object('granted',true,'id',v_id,'plan',p_plan,'startsAt',v_now,'endsAt',v_end);
end $fn$;
revoke all on function public.grant_admin_promotional_access(uuid,text,integer) from public,anon;
grant execute on function public.grant_admin_promotional_access(uuid,text,integer) to authenticated;

create or replace function public.revoke_admin_promotional_access(p_id uuid,p_type text)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_actor uuid:=(select auth.uid());v_count integer:=0;
begin
 if v_actor is null or not private.is_current_admin() then
  raise exception 'Acesso administrativo requer sessão TOTP validada.' using errcode='42501';
 end if;
 if p_id is null or p_type not in ('manual','code','legacy') then
  raise exception 'Tipo ou identificador de promoção inválido.' using errcode='22023';
 end if;
 if p_type='manual' then
  update public.billing_manual_access_grants set revoked_at=now(),revoked_by=v_actor
  where id=p_id and revoked_at is null and ends_at>now();
 elsif p_type='code' then
  update private.payrep_promo_redemptions set revoked_at=now(),revoked_by=v_actor
  where id=p_id and revoked_at is null and ends_at>now();
 else
  update public.billing_full_trials set revoked_at=now(),revoked_by=v_actor
  where user_id=p_id and revoked_at is null and ends_at>now();
 end if;
 get diagnostics v_count=row_count;
 if v_count<>1 then raise exception 'Acesso promocional ativo não encontrado.' using errcode='23514'; end if;
 return pg_catalog.jsonb_build_object('revoked',true,'type',p_type,'id',p_id);
end $fn$;
revoke all on function public.revoke_admin_promotional_access(uuid,text) from public,anon;
grant execute on function public.revoke_admin_promotional_access(uuid,text) to authenticated;

create or replace function public.set_admin_plan_override(p_target uuid,p_plan text)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_actor uuid:=(select auth.uid());v_previous text;
begin
 if v_actor is null or not private.is_current_admin() then
  raise exception 'Acesso administrativo requer sessão TOTP validada.' using errcode='42501';
 end if;
 if p_target is null or (p_plan is not null and p_plan not in ('free','basic','full')) then
  raise exception 'Plano inválido.' using errcode='22023';
 end if;
 perform 1 from public.app_members where user_id=p_target and active and status='approved' and role<>'admin' for update;
 if not found then raise exception 'Usuário não está aprovado, ativo ou é administrador.' using errcode='23514';end if;
 select o.plan_code into v_previous from public.billing_admin_plan_overrides o where o.user_id=p_target for update;
 if p_plan is null then
  delete from public.billing_admin_plan_overrides where user_id=p_target;
 else
  insert into public.billing_admin_plan_overrides(user_id,plan_code,updated_at,updated_by)
   values(p_target,p_plan,now(),v_actor)
  on conflict(user_id) do update set plan_code=excluded.plan_code,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
 end if;
 if v_previous is distinct from p_plan then
  insert into public.billing_admin_plan_override_audit(user_id,previous_plan,new_plan,actor_id)
   values(p_target,v_previous,p_plan,v_actor);
 end if;
 return pg_catalog.jsonb_build_object('updated',true,'plan',p_plan,'previousPlan',v_previous,
  'billingUnchanged',true);
end $fn$;
revoke all on function public.set_admin_plan_override(uuid,text) from public,anon;
grant execute on function public.set_admin_plan_override(uuid,text) to authenticated;

-- The registered purchase remains separate from the effective product access.
create or replace function private.payrep_effective_plan_for_user(p_user_id uuid)
returns text language sql stable security definer set search_path=''
as $fn$
 select case
 when exists(select 1 from public.app_members a where a.user_id=p_user_id and a.active and a.status='approved' and a.role='admin') then 'full'
 when exists(select 1 from public.billing_admin_plan_overrides o where o.user_id=p_user_id)
 then (select o.plan_code from public.billing_admin_plan_overrides o where o.user_id=p_user_id)
 else case greatest(
  coalesce((select max(case s.plan_code when 'full' then 2 when 'basic' then 1 else 0 end)
   from public.billing_subscriptions s where s.user_id=p_user_id and s.status='active'
   and (s.current_period_end is null or s.current_period_end>now())),0),
  case when exists(select 1 from public.billing_full_trials t where t.user_id=p_user_id
   and t.starts_at<=now() and t.ends_at>now() and t.revoked_at is null) then 2 else 0 end,
  coalesce((select max(case g.plan_code when 'full' then 2 when 'basic' then 1 else 0 end)
   from public.billing_manual_access_grants g where g.user_id=p_user_id
   and g.starts_at<=now() and g.ends_at>now() and g.revoked_at is null),0),
  coalesce((select max(case r.plan_code when 'full' then 2 when 'basic' then 1 else 0 end)
   from private.payrep_promo_redemptions r where r.user_id=p_user_id
   and r.started_at<=now() and r.ends_at>now() and r.revoked_at is null),0)
 ) when 2 then 'full' when 1 then 'basic' else 'free' end
 end;
$fn$;
revoke all on function private.payrep_effective_plan_for_user(uuid) from public,anon,authenticated;

create or replace function public.my_effective_payrep_plan()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare v_uid uuid:=(select auth.uid());v_paid text:='free';v_effective text;
v_admin boolean:=false;v_trial public.billing_full_trials%rowtype;
v_promo private.payrep_promo_redemptions%rowtype;v_manual public.billing_manual_access_grants%rowtype;
v_override text;v_paid_rank int:=0;v_promo_rank int:=0;v_manual_rank int:=0;
begin
 if v_uid is null or not private.current_mfa_satisfied() or not exists(
  select 1 from public.app_members where user_id=v_uid and active and status='approved'
 ) then raise exception 'Sessão ou conta sem permissão.' using errcode='42501'; end if;
 select exists(select 1 from public.app_members where user_id=v_uid and active and status='approved' and role='admin') into v_admin;
 select s.plan_code into v_paid from public.billing_subscriptions s where s.user_id=v_uid
  and s.plan_code in ('basic','full') and s.status='active'
  and (s.current_period_end is null or s.current_period_end>now());
 v_paid:=coalesce(v_paid,'free');
 v_paid_rank:=case v_paid when 'full' then 2 when 'basic' then 1 else 0 end;
 select * into v_trial from public.billing_full_trials where user_id=v_uid;
 select * into v_manual from public.billing_manual_access_grants where user_id=v_uid and revoked_at is null
  and starts_at<=now() and ends_at>now() order by starts_at desc limit 1;
 select * into v_promo from private.payrep_promo_redemptions where user_id=v_uid and revoked_at is null
  and started_at<=now() and ends_at>now() order by started_at desc limit 1;
 select o.plan_code into v_override from public.billing_admin_plan_overrides o where o.user_id=v_uid;
 v_effective:=private.payrep_effective_plan_for_user(v_uid);
 v_promo_rank:=case v_promo.plan_code when 'full' then 2 when 'basic' then 1 else 0 end;
 v_manual_rank:=case v_manual.plan_code when 'full' then 2 when 'basic' then 1 else 0 end;
 return pg_catalog.jsonb_build_object(
  'effectivePlan',v_effective,'isAdmin',v_admin,'paidPlan',v_paid,
  'accessSource',case when v_admin then 'administrator'
   when v_override is not null then 'admin_override'
   when v_manual.user_id is not null and v_manual_rank>=v_paid_rank and v_manual_rank>=v_promo_rank then 'manual_grant'
   when v_promo.id is not null and v_promo_rank>v_paid_rank then 'promotion'
   when v_trial.user_id is not null and v_trial.revoked_at is null and v_trial.starts_at<=now() and v_trial.ends_at>now() then 'trial'
   else 'subscription' end,
  'adminOverridePlan',v_override,
  'manualAccessActive',v_manual.user_id is not null,
  'manualAccessPlan',v_manual.plan_code,
  'manualAccessStartsAt',v_manual.starts_at,'manualAccessEndsAt',v_manual.ends_at,
  'trialActive',v_trial.user_id is not null and v_trial.revoked_at is null
     and v_trial.starts_at<=now() and v_trial.ends_at>now(),
  'trialStartsAt',v_trial.starts_at,'trialEndsAt',v_trial.ends_at,'trialRevokedAt',v_trial.revoked_at,
  'promoActive',v_promo.id is not null,
  'promoApplied',not v_admin and v_override is null and v_promo.id is not null and
     v_promo_rank>v_paid_rank and v_promo_rank>v_manual_rank,
  'promoPlan',v_promo.plan_code,'promoStartsAt',v_promo.started_at,
  'promoEndsAt',v_promo.ends_at,'promoGrantedDays',v_promo.access_days,
  'promoPreviousPlan',v_promo.original_paid_plan);
end $fn$;

create or replace function private.pep_plan_for_user(p_user_id uuid)
returns text language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (auth.jwt()->>'role') is distinct from 'service_role'
  and ((select auth.uid()) is null or p_user_id is distinct from (select auth.uid()))
 then raise exception 'Plan access limited to own account' using errcode='42501';end if;
 if not exists(select 1 from public.app_members where user_id=p_user_id and active and status='approved')
 then return 'free';end if;
 return private.payrep_effective_plan_for_user(p_user_id);
end $fn$;

create or replace function public.list_admin_manual_access()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or not private.is_current_admin() then
  raise exception 'Acesso administrativo requer sessão TOTP validada.' using errcode='42501';
 end if;
 return coalesce((
  select pg_catalog.jsonb_agg(x.info order by x.order_date desc)
  from (
   select g.granted_at order_date,pg_catalog.jsonb_build_object(
     'id',g.id,'type','manual','userId',g.user_id,'email',u.email,
     'displayName',coalesce(nullif(p.display_name,''),u.email,'Usuário'),
     'plan',g.plan_code,'startsAt',g.starts_at,'endsAt',g.ends_at,
     'revokedAt',g.revoked_at,'state',case when g.revoked_at is not null then 'revoked'
      when g.ends_at<=now() then 'expired' else 'active' end) info
   from public.billing_manual_access_grants g
   join auth.users u on u.id=g.user_id left join public.user_profiles p on p.user_id=g.user_id
   union all
   select t.granted_at,pg_catalog.jsonb_build_object(
     'id',t.user_id,'type','legacy','userId',t.user_id,'email',u.email,
     'displayName',coalesce(nullif(p.display_name,''),u.email,'Usuário'),
     'plan','full','startsAt',t.starts_at,'endsAt',t.ends_at,
     'revokedAt',t.revoked_at,'state',case when t.revoked_at is not null then 'revoked'
      when t.ends_at<=now() then 'expired' else 'active' end)
   from public.billing_full_trials t
   join auth.users u on u.id=t.user_id left join public.user_profiles p on p.user_id=t.user_id
  ) x
 ),'[]'::jsonb);
end $fn$;
revoke all on function public.list_admin_manual_access() from public,anon;
grant execute on function public.list_admin_manual_access() to authenticated;

create or replace function public.list_admin_promo_redemptions()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or not private.is_current_admin() then
  raise exception 'Acesso administrativo requer sessão TOTP validada.' using errcode='42501';
 end if;
 return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
 'id',r.id,'type','code','userId',r.user_id,'email',u.email,
 'displayName',coalesce(nullif(p.display_name,''),u.email,'Usuário'),
 'plan',r.plan_code,'code',coalesce(c.code_value, '•••• '||c.code_suffix),
 'codeId',r.code_id,'startsAt',r.started_at,'endsAt',r.ends_at,
 'revokedAt',r.revoked_at,'state',case when r.revoked_at is not null then 'revoked'
  when r.ends_at<=now() then 'expired' else 'active' end)
 order by r.started_at desc)
 from private.payrep_promo_redemptions r
 join private.payrep_promo_codes c on c.id=r.code_id
 join auth.users u on u.id=r.user_id left join public.user_profiles p on p.user_id=r.user_id
 ),'[]'::jsonb);
end $fn$;
revoke all on function public.list_admin_promo_redemptions() from public,anon;
grant execute on function public.list_admin_promo_redemptions() to authenticated;

create or replace function public.list_admin_plan_access()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or not private.is_current_admin() then
  raise exception 'Acesso administrativo requer sessão TOTP validada.' using errcode='42501';
 end if;
 return coalesce((
 select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'userId',m.user_id,'email',u.email,'displayName',coalesce(nullif(p.display_name,''),u.email,'Usuário'),
  'role',m.role,'active',m.active,'status',m.status,
  'basePlan',coalesce(s.plan_code,'free'),
  'paidPlan',case when s.status='active' and (s.current_period_end is null or s.current_period_end>now())
      then s.plan_code else 'free' end,
  'effectivePlan',case when m.role='admin' then 'full'
    when m.active and m.status='approved' then private.payrep_effective_plan_for_user(m.user_id)
    else 'free' end,
  'overridePlan',o.plan_code,
  'overrideChangedAt',o.updated_at,
  'hasActivePromo',exists(select 1 from private.payrep_promo_redemptions r
    where r.user_id=m.user_id and r.revoked_at is null and r.started_at<=now() and r.ends_at>now()),
  'hasActiveManual',exists(select 1 from public.billing_manual_access_grants g
    where g.user_id=m.user_id and g.revoked_at is null and g.starts_at<=now() and g.ends_at>now()),
  'hasActiveLegacyTrial',exists(select 1 from public.billing_full_trials t
    where t.user_id=m.user_id and t.revoked_at is null and t.starts_at<=now() and t.ends_at>now())
 ) order by u.email)
 from public.app_members m
 join auth.users u on u.id=m.user_id
 left join public.user_profiles p on p.user_id=m.user_id
 left join public.billing_subscriptions s on s.user_id=m.user_id
 left join public.billing_admin_plan_overrides o on o.user_id=m.user_id
 ),'[]'::jsonb);
end $fn$;
revoke all on function public.list_admin_plan_access() from public,anon;
grant execute on function public.list_admin_plan_access() to authenticated;

-- Existing code-redemption checks must ignore explicitly revoked grants.
-- Preserve uniqueness: the same code cannot be redeemed twice by one user.
create or replace function public.redeem_hml_promo_code(p_plan text,p_code text)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_uid uuid:=(select auth.uid());
 v_normalized text:=pg_catalog.upper(pg_catalog.regexp_replace(coalesce(p_code,''),'[[:space:]]+','','g'));
 v_member public.app_members%rowtype;v_promo private.payrep_promo_codes%rowtype;
 v_paid text:='free';v_now timestamptz:=now();v_end timestamptz;
begin
 if v_uid is null or not private.current_mfa_satisfied() then
  raise exception 'Sessão inválida para resgatar promoção.' using errcode='42501';end if;
 if p_plan is null or p_plan not in ('basic','full') or length(v_normalized)<4 or length(v_normalized)>64 then
  raise exception 'Código inválido para o plano selecionado.' using errcode='22023';end if;
 select * into v_member from public.app_members where user_id=v_uid for update;
 if v_member.user_id is null or not v_member.active or v_member.status<>'approved'
 then raise exception 'A conta precisa estar aprovada e ativa.' using errcode='42501';end if;
 if exists(select 1 from public.billing_admin_plan_overrides where user_id=v_uid) then
  raise exception 'O acesso da conta está definido manualmente pelo administrador.' using errcode='23514';end if;
 select * into v_promo from private.payrep_promo_codes
  where code_hash=pg_catalog.md5(v_normalized) and disabled_at is null
  order by created_at desc limit 1 for update;
 if v_promo.id is null or v_promo.plan_code<>p_plan or v_promo.redeem_until<=v_now then
  raise exception 'Código inválido, expirado ou indisponível.' using errcode='22023';end if;
 if exists(select 1 from private.payrep_promo_redemptions where user_id=v_uid and code_id=v_promo.id)
 then raise exception 'Este código já foi utilizado nesta conta.' using errcode='23514';end if;
 if exists(select 1 from private.payrep_promo_redemptions
  where user_id=v_uid and revoked_at is null and started_at<=v_now and ends_at>v_now)
 or exists(select 1 from public.billing_manual_access_grants
  where user_id=v_uid and revoked_at is null and starts_at<=v_now and ends_at>v_now)
 or exists(select 1 from public.billing_full_trials
  where user_id=v_uid and revoked_at is null and starts_at<=v_now and ends_at>v_now) then
  raise exception 'Já existe promoção ativa. Aguarde ou solicite a revisão do acesso.' using errcode='23514';end if;
 select s.plan_code into v_paid from public.billing_subscriptions s
  where s.user_id=v_uid and s.status='active' and s.plan_code in ('basic','full')
   and (s.current_period_end is null or s.current_period_end>v_now);
 v_paid:=coalesce(v_paid,'free');
 if v_paid='full' or (v_paid='basic' and p_plan='basic') then
  raise exception 'Plano pago vigente já oferece este nível ou superior.' using errcode='23514';end if;
 if v_promo.max_redemptions is not null and
  (select count(*) from private.payrep_promo_redemptions where code_id=v_promo.id)>=v_promo.max_redemptions then
   raise exception 'Código atingiu o limite de resgates.' using errcode='23514';end if;
 v_end:=v_now+pg_catalog.make_interval(days=>v_promo.access_days);
 insert into private.payrep_promo_redemptions(code_id,user_id,plan_code,access_days,started_at,ends_at,original_paid_plan)
 values(v_promo.id,v_uid,p_plan,v_promo.access_days,v_now,v_end,v_paid);
 return pg_catalog.jsonb_build_object('redeemed',true,'plan',p_plan,'days',v_promo.access_days,
  'startsAt',v_now,'endsAt',v_end,'previousPlan',v_paid);
end $fn$;

-- Restrict new function helper to trusted callers and service-side business logic.
-- Existing private.pep_plan_for_user invokes this through a SECURITY DEFINER body.
