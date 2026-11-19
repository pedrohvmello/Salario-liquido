-- HML: grant Full-equivalent capabilities to approved admins without any paid plan.
-- Existing Asaas subscriptions are preserved for audit and cancellation history.
CREATE OR REPLACE FUNCTION private.pep_plan_for_user(p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_paid integer:=0;v_promo integer:=0;v_trial integer:=0;
begin
 if not exists(select 1 from public.app_members
  where user_id=p_user_id and active and status='approved') then return 'free'; end if;
 -- Admin rights are role-based, not paid entitlements.
 if exists(select 1 from public.app_members
  where user_id=p_user_id and role='admin' and active and status='approved')
 then return 'full'; end if;
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
$function$;

CREATE OR REPLACE FUNCTION public.my_effective_payrep_plan()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 v_admin boolean:=false;
begin
 if v_uid is null or not private.current_mfa_satisfied() or not exists(
  select 1 from public.app_members where user_id=v_uid and active=true and status='approved'
 ) then raise exception 'Sessão ou conta sem permissão.' using errcode='42501'; end if;
 select exists(select 1 from public.app_members
  where user_id=v_uid and active=true and status='approved' and role='admin') into v_admin;
 select plan_code into v_paid from public.billing_subscriptions
  where user_id=v_uid and plan_code in ('basic','full')
   and status='active' and (current_period_end is null or current_period_end>now());
 v_paid:=coalesce(v_paid,'free');
 v_base_rank:=case v_paid when 'full' then 2 when 'basic' then 1 else 0 end;
 select * into v_trial from public.billing_full_trials where user_id=v_uid;
 v_manual_trial_active:=v_trial.user_id is not null
  and v_trial.revoked_at is null and v_trial.starts_at<=now() and v_trial.ends_at>now();
 if v_manual_trial_active or v_admin then v_base_rank:=2; end if;
 select * into v_promo from private.payrep_promo_redemptions
  where user_id=v_uid and started_at<=now() and ends_at>now()
  order by started_at desc limit 1;
 if v_promo.id is not null then
  v_promo_rank:=case v_promo.plan_code when 'full' then 2 when 'basic' then 1 else 0 end;
 end if;
 v_promo_applied:=not v_admin and v_promo.id is not null and v_promo_rank>v_base_rank;
 v_effective:=case greatest(v_base_rank,v_promo_rank)
  when 2 then 'full' when 1 then 'basic' else 'free' end;
 return pg_catalog.jsonb_build_object(
  'effectivePlan',v_effective,
  'isAdmin',v_admin,
  'accessSource',case when v_admin then 'administrator' else 'subscription' end,
  'paidPlan',v_paid,
  'trialActive',not v_admin and v_manual_trial_active and v_promo.id is null and v_paid='free',
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
$function$;
