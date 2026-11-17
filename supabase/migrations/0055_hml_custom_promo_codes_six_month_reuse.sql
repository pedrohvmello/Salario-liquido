-- HML only: administrator-specified promotional codes (4-12 uppercase ASCII chars).
-- A disabled code cannot be re-created for six calendar months after disabled_at.
-- Historical code/redemption records must remain intact after the cooldown.

-- Existing historical codes had a global uniqueness constraint. Reusing their
-- text after the six-month cooldown requires preserving history in separate rows.
alter table private.payrep_promo_codes
  drop constraint if exists payrep_promo_codes_code_hash_key;
create unique index if not exists payrep_promo_codes_one_usable_hash
  on private.payrep_promo_codes(code_hash) where disabled_at is null;
create index if not exists payrep_promo_codes_disabled_code_lookup
  on private.payrep_promo_codes(code_hash,disabled_at desc);

-- Remove the old four-argument generator. It must not remain callable as an
-- alternative API for creating uncontrolled automatically generated codes.
drop function if exists public.create_hml_promo_code(text,integer,date,integer);

create or replace function public.create_hml_promo_code(
 p_plan text,
 p_days integer,
 p_last_date date,
 p_code text,
 p_max_redemptions integer default null
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid:=(select auth.uid());
 v_code text:=pg_catalog.upper(pg_catalog.btrim(coalesce(p_code,'')));
 v_hash text;
 v_until timestamptz;
 v_existing_active boolean;
 v_reuse_after timestamptz;
 v_record private.payrep_promo_codes%rowtype;
begin
 if v_actor is null or not private.is_current_admin() then
  raise exception 'Acesso restrito ao administrador verificado.' using errcode='42501';
 end if;
 if v_code !~ '^[A-Z0-9_-]{4,12}$' then
  raise exception 'Informe um código entre 4 e 12 caracteres, usando letras, números, hífen ou sublinhado.' using errcode='22023';
 end if;
 if p_plan is null or p_plan not in ('basic','full') or p_days is null or p_days not between 1 and 365
  or p_last_date is null
  or p_last_date<(now() at time zone 'America/Sao_Paulo')::date
  or p_last_date>(now() at time zone 'America/Sao_Paulo')::date+interval '730 days'
  or (p_max_redemptions is not null and p_max_redemptions not between 1 and 10000) then
  raise exception 'Plano, duração, vencimento ou limite de usos inválido.' using errcode='22023';
 end if;

 v_hash:=pg_catalog.md5(v_code);
 -- Serialize simultaneous creation attempts for the SAME text, independently
 -- from the partial unique index. Advisory lock is scoped to the transaction.
 perform pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('payrep_promo:'||v_hash,0)
 );
 select exists(
  select 1 from private.payrep_promo_codes
  where code_hash=v_hash and disabled_at is null
 ) into v_existing_active;
 if v_existing_active then
  raise exception 'Este código já foi cadastrado. Desative-o antes de reutilizá-lo.' using errcode='23505';
 end if;
 -- Historical disabled records remain. Check latest disabled time even when
 -- the code was used in a previous campaign or on another plan.
 select max(disabled_at + interval '6 months') into v_reuse_after
 from private.payrep_promo_codes
 where code_hash=v_hash and disabled_at is not null;
 if v_reuse_after is not null and now()<v_reuse_after then
  raise exception 'Código desativado: reutilização permitida somente a partir de %.',
   to_char(v_reuse_after at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')
   using errcode='23514';
 end if;

 v_until:=((p_last_date+1)::timestamp at time zone 'America/Sao_Paulo');
 insert into private.payrep_promo_codes
  (code_hash,code_suffix,plan_code,access_days,redeem_until,max_redemptions,created_by)
 values(v_hash,pg_catalog.right(v_code,4),p_plan,p_days,v_until,p_max_redemptions,v_actor)
 returning * into v_record;

 return pg_catalog.jsonb_build_object(
  'id',v_record.id,'code',v_code,'plan',p_plan,'days',p_days,
  'redeemUntil',v_until,'maxRedemptions',p_max_redemptions);
end
$fn$;
revoke all on function public.create_hml_promo_code(text,integer,date,text,integer) from public,anon;
grant execute on function public.create_hml_promo_code(text,integer,date,text,integer) to authenticated;

-- Disabling a code must not revoke promotions already redeemed. This is
-- unchanged from the previous migration. Only the *lookup* below changes:
-- when a disabled code is re-created after cooldown, select the usable
-- record, not a prior disabled historical record.
create or replace function public.redeem_hml_promo_code(p_plan text,p_code text)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_uid uuid:=(select auth.uid());
 v_normalized text:=pg_catalog.upper(pg_catalog.regexp_replace(coalesce(p_code,''),'[[:space:]]+','','g'));
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
 -- Permit legacy 24-character PAY codes already issued.
 if p_plan not in ('basic','full') or p_plan is null or length(v_normalized)<4
  or length(v_normalized)>64 then
  raise exception 'Código inválido ou indisponível para o plano selecionado.' using errcode='22023';
 end if;
 select * into v_member from public.app_members
 where user_id=v_uid for update;
 if v_member.user_id is null or v_member.active is distinct from true
  or v_member.status is distinct from 'approved' then
  raise exception 'A conta precisa estar aprovada e ativa.' using errcode='42501';
 end if;
 select * into v_promo from private.payrep_promo_codes
 where code_hash=pg_catalog.md5(v_normalized) and disabled_at is null
 order by created_at desc limit 1 for update;
 if v_promo.id is null or v_promo.plan_code<>p_plan
  or v_promo.redeem_until<=v_now then
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
