-- HML only: promotional Basic/Full time-limited access independent of Asaas.
-- Code expiry controls REDEMPTION; redemption expiry controls USER ACCESS.
-- Random codes are only returned once to the administrator, with only hashes stored.
create table if not exists private.payrep_promo_codes (
 id uuid primary key default pg_catalog.gen_random_uuid(),
 code_hash text not null unique,
 code_suffix text not null,
 plan_code text not null check (plan_code in ('basic','full')),
 access_days integer not null check (access_days between 1 and 365),
 redeem_until timestamptz not null,
 max_redemptions integer check (max_redemptions between 1 and 10000),
 created_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null,
 disabled_at timestamptz,
 disabled_by uuid references auth.users(id) on delete set null
);
create table if not exists private.payrep_promo_redemptions (
 id uuid primary key default pg_catalog.gen_random_uuid(),
 code_id uuid not null references private.payrep_promo_codes(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete cascade,
 plan_code text not null check (plan_code in ('basic','full')),
 access_days integer not null check (access_days between 1 and 365),
 started_at timestamptz not null default now(),
 ends_at timestamptz not null,
 original_paid_plan text not null check (original_paid_plan in ('free','basic','full')),
 unique(code_id,user_id),
 check(ends_at>started_at and ends_at<=started_at+interval '366 days')
);
create index if not exists payrep_promo_redemptions_user_expiry_idx
 on private.payrep_promo_redemptions(user_id,ends_at desc);
create index if not exists payrep_promo_redemptions_code_idx
 on private.payrep_promo_redemptions(code_id);
alter table private.payrep_promo_codes enable row level security;
alter table private.payrep_promo_redemptions enable row level security;
revoke all on private.payrep_promo_codes, private.payrep_promo_redemptions from public,anon,authenticated;

create or replace function public.create_hml_promo_code(
 p_plan text,p_days integer,p_last_date date,p_max_redemptions integer default null
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_actor uuid:=(select auth.uid());
 v_code text;
 v_random text;
 v_record private.payrep_promo_codes%rowtype;
 v_until timestamptz;
begin
 if v_actor is null or not private.is_current_admin() then
  raise exception 'Acesso restrito ao administrador verificado.' using errcode='42501';
 end if;
 if p_plan is null or p_plan not in ('basic','full') or p_days is null or p_days not between 1 and 365
  or p_last_date is null
  or p_last_date<(now() at time zone 'America/Sao_Paulo')::date
  or p_last_date>(now() at time zone 'America/Sao_Paulo')::date+interval '730 days'
  or (p_max_redemptions is not null and p_max_redemptions not between 1 and 10000) then
  raise exception 'Plano, duração, vencimento ou limite de usos inválido.' using errcode='22023';
 end if;
 v_until:=((p_last_date+1)::timestamp at time zone 'America/Sao_Paulo');
 for i in 1..5 loop
  v_random:=upper(substr(replace(pg_catalog.gen_random_uuid()::text,'-',''),1,20));
  v_code:='PAY-'||substr(v_random,1,4)||'-'||substr(v_random,5,4)||'-'
    ||substr(v_random,9,4)||'-'||substr(v_random,13,4)||'-'||substr(v_random,17,4);
  insert into private.payrep_promo_codes
   (code_hash,code_suffix,plan_code,access_days,redeem_until,max_redemptions,created_by)
   values(pg_catalog.md5(v_code),right(v_random,4),p_plan,p_days,v_until,p_max_redemptions,v_actor)
   on conflict(code_hash) do nothing
   returning * into v_record;
  if v_record.id is not null then
   return pg_catalog.jsonb_build_object(
    'id',v_record.id,'code',v_code,'plan',p_plan,'days',p_days,
    'redeemUntil',v_until,'maxRedemptions',p_max_redemptions);
  end if;
 end loop;
 raise exception 'Não foi possível gerar um código único.' using errcode='23505';
end
$fn$;
revoke all on function public.create_hml_promo_code(text,integer,date,integer) from public,anon;
grant execute on function public.create_hml_promo_code(text,integer,date,integer) to authenticated;

create or replace function public.list_hml_promo_codes()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or not private.is_current_admin() then
  raise exception 'Acesso restrito ao administrador verificado.' using errcode='42501';
 end if;
 return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'id',p.id,'codeSuffix',p.code_suffix,'plan',p.plan_code,'days',p.access_days,
  'redeemUntil',p.redeem_until,'maxRedemptions',p.max_redemptions,
  'redeemedCount',(select count(*) from private.payrep_promo_redemptions r where r.code_id=p.id),
  'createdAt',p.created_at,
  'disabledAt',p.disabled_at,
  'status',case when p.disabled_at is not null then 'disabled'
    when p.redeem_until<=now() then 'expired'
    when p.max_redemptions is not null and
      (select count(*) from private.payrep_promo_redemptions r where r.code_id=p.id)>=p.max_redemptions
      then 'exhausted'
    else 'active' end
 ) order by p.created_at desc)
 from private.payrep_promo_codes p),'[]'::jsonb);
end
$fn$;
revoke all on function public.list_hml_promo_codes() from public,anon;
grant execute on function public.list_hml_promo_codes() to authenticated;

create or replace function public.disable_hml_promo_code(p_code_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_actor uuid:=(select auth.uid());v_changed integer;
begin
 if v_actor is null or not private.is_current_admin() then
  raise exception 'Acesso restrito ao administrador verificado.' using errcode='42501';
 end if;
 update private.payrep_promo_codes
 set disabled_at=now(),disabled_by=v_actor
 where id=p_code_id and disabled_at is null;
 get diagnostics v_changed=row_count;
 if v_changed<>1 then
  raise exception 'Código não encontrado ou já desativado.' using errcode='23514';
 end if;
 return pg_catalog.jsonb_build_object('disabled',true);
end
$fn$;
revoke all on function public.disable_hml_promo_code(uuid) from public,anon;
grant execute on function public.disable_hml_promo_code(uuid) to authenticated;

create or replace function public.redeem_hml_promo_code(p_plan text,p_code text)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_uid uuid:=(select auth.uid());
 v_normalized text:=upper(regexp_replace(coalesce(p_code,''),'[[:space:]]+','','g'));
 v_member public.app_members%rowtype;
 v_promo private.payrep_promo_codes%rowtype;
 v_paid text:='free';
 v_trial_active boolean:=false;
 v_now timestamptz:=now();
 v_end timestamptz;
 v_redemption private.payrep_promo_redemptions%rowtype;
begin
 if v_uid is null or not private.current_mfa_satisfied() then
  raise exception 'Sessão inválida para resgatar a promoção.' using errcode='42501';
 end if;
 if p_plan not in ('basic','full') or p_plan is null or length(v_normalized)>64 then
  raise exception 'Código inválido ou indisponível para o plano selecionado.' using errcode='22023';
 end if;
 -- Serializes redemptions by this user, even when different codes are submitted concurrently.
 select * into v_member from public.app_members
 where user_id=v_uid for update;
 if v_member.user_id is null or v_member.active is distinct from true
  or v_member.status is distinct from 'approved' then
  raise exception 'A conta precisa estar aprovada e ativa.' using errcode='42501';
 end if;
 -- Locks this code across users to enforce the redemption cap atomically.
 select * into v_promo from private.payrep_promo_codes
 where code_hash=pg_catalog.md5(v_normalized) for update;
 if v_promo.id is null or v_promo.plan_code<>p_plan
  or v_promo.disabled_at is not null or v_promo.redeem_until<=v_now then
  raise exception 'Código inválido, expirado ou indisponível para o plano selecionado.' using errcode='22023';
 end if;
 if exists(select 1 from private.payrep_promo_redemptions r
    where r.user_id=v_uid and r.code_id=v_promo.id) then
  raise exception 'Este código já foi utilizado nesta conta.' using errcode='23514';
 end if;
 if exists(select 1 from private.payrep_promo_redemptions r
    where r.user_id=v_uid and r.ends_at>v_now) then
  raise exception 'Você já possui uma promoção ativa. Aguarde o encerramento para resgatar outra.' using errcode='23514';
 end if;
 select exists(select 1 from public.billing_full_trials t
   where t.user_id=v_uid and t.revoked_at is null
   and t.starts_at<=v_now and t.ends_at>v_now) into v_trial_active;
 if v_trial_active then
  raise exception 'Você já possui um teste Full ativo.' using errcode='23514';
 end if;
 select s.plan_code into v_paid from public.billing_subscriptions s
  where s.user_id=v_uid and s.status='active'
    and s.plan_code in ('basic','full')
    and (s.current_period_end is null or s.current_period_end>v_now);
 v_paid:=coalesce(v_paid,'free');
 if v_paid='full' or (v_paid='basic' and p_plan='basic') then
  raise exception 'Seu plano pago já oferece este nível de acesso ou superior.' using errcode='23514';
 end if;
 if v_promo.max_redemptions is not null and (select count(*)
   from private.payrep_promo_redemptions where code_id=v_promo.id)>=v_promo.max_redemptions then
  raise exception 'Este código atingiu o limite de utilizações.' using errcode='23514';
 end if;
 v_end:=v_now+(v_promo.access_days||' days')::interval;
 insert into private.payrep_promo_redemptions
 (code_id,user_id,plan_code,access_days,started_at,ends_at,original_paid_plan)
 values(v_promo.id,v_uid,p_plan,v_promo.access_days,v_now,v_end,v_paid)
 returning * into v_redemption;
 return pg_catalog.jsonb_build_object('redeemed',true,'plan',p_plan,
  'days',v_promo.access_days,'startsAt',v_now,'endsAt',v_end,
  'previousPlan',v_paid);
end
$fn$;
revoke all on function public.redeem_hml_promo_code(text,text) from public,anon;
grant execute on function public.redeem_hml_promo_code(text,text) to authenticated;

-- A manually granted Full trial must not overlap a promotional entitlement.
-- Keep the existing admin grant function's rule set and add a guarded wrapper.
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
 -- Lock account row to synchronize with promotional redemptions.
 perform 1 from public.app_members
 where user_id=p_target and active=true and status='approved' for update;
 if not found then
  raise exception 'Usuário não está aprovado e ativo.' using errcode='23514';
 end if;
 if exists(select 1 from private.payrep_promo_redemptions r
  where r.user_id=p_target and r.ends_at>v_from) then
  raise exception 'O usuário possui uma promoção ativa. Aguarde o término antes de conceder teste Full.' using errcode='23514';
 end if;
 if exists(select 1 from public.billing_subscriptions s where s.user_id=p_target
  and s.plan_code in ('basic','full') and s.status in ('active','trialing','past_due')
  and (s.current_period_end is null or s.current_period_end>v_from)) then
  raise exception 'Há uma assinatura paga vigente. Não sobreponha com um teste grátis.' using errcode='23514';
 end if;
 if exists(select 1 from public.billing_full_trials where user_id=p_target) then
  raise exception 'Esse usuário já recebeu um teste Full. Não há concessão repetida.' using errcode='23514';
 end if;
 v_to:=v_from+(p_days||' days')::interval;
 insert into public.billing_full_trials(user_id,starts_at,ends_at,granted_by)
 values(p_target,v_from,v_to,v_actor);
 return pg_catalog.jsonb_build_object('granted',true,'endsAt',v_to);
end
$fn$;

-- Single server-side source of truth for effective access, evaluated dynamically
-- by timestamps: no cron is required to revoke an expired promotional plan.
create or replace function public.my_effective_payrep_plan()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare
 v_uid uuid:=(select auth.uid());
 v_paid text:='free';
 v_trial public.billing_full_trials%rowtype;
 v_promo private.payrep_promo_redemptions%rowtype;
 v_effective text:='free';
 v_base_rank integer:=0;
 v_promo_rank integer:=0;
 v_promo_applied boolean:=false;
 v_manual_trial_active boolean:=false;
begin
 if v_uid is null or not private.current_mfa_satisfied() or not exists(
  select 1 from public.app_members where user_id=v_uid and active=true and status='approved'
 ) then raise exception 'Sessão ou conta sem permissão.' using errcode='42501'; end if;
 select plan_code into v_paid from public.billing_subscriptions
  where user_id=v_uid and plan_code in ('basic','full')
   and status='active' and (current_period_end is null or current_period_end>now());
 v_paid:=coalesce(v_paid,'free');
 v_base_rank:=case v_paid when 'full' then 2 when 'basic' then 1 else 0 end;
 select * into v_trial from public.billing_full_trials where user_id=v_uid;
 v_manual_trial_active:=v_trial.user_id is not null
  and v_trial.revoked_at is null and v_trial.starts_at<=now() and v_trial.ends_at>now();
 if v_manual_trial_active then v_base_rank:=2; end if;
 select * into v_promo from private.payrep_promo_redemptions
  where user_id=v_uid and started_at<=now() and ends_at>now()
  order by started_at desc limit 1;
 if v_promo.id is not null then
  v_promo_rank:=case v_promo.plan_code when 'full' then 2 when 'basic' then 1 else 0 end;
 end if;
 v_promo_applied:=v_promo.id is not null and v_promo_rank>v_base_rank;
 v_effective:=case greatest(v_base_rank,v_promo_rank)
  when 2 then 'full' when 1 then 'basic' else 'free' end;
 return pg_catalog.jsonb_build_object(
  'effectivePlan',v_effective,
  'paidPlan',v_paid,
  'trialActive',v_manual_trial_active and v_promo.id is null and v_paid='free',
  'trialStartsAt',v_trial.starts_at,
  'trialEndsAt',v_trial.ends_at,
  'trialRevokedAt',v_trial.revoked_at,
  'promoActive',v_promo.id is not null,
  'promoApplied',v_promo_applied,
  'promoPlan',v_promo.plan_code,
  'promoStartsAt',v_promo.started_at,
  'promoEndsAt',v_promo.ends_at,
  'promoGrantedDays',v_promo.access_days,
  'promoPreviousPlan',v_promo.original_paid_plan
 );
end
$fn$;
revoke all on function public.my_effective_payrep_plan() from public,anon;
grant execute on function public.my_effective_payrep_plan() to authenticated;
