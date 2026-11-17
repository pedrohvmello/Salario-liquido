-- HML: fully reconciled paid checkout no longer blocks a new purchase after cancellation.
-- Never reset the checkout status or erase historical provider links.
CREATE OR REPLACE FUNCTION public.begin_my_billing_checkout(p_plan text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
 v_uid uuid := (SELECT auth.uid());
 v_price integer;
 v_id uuid;
 v_existing uuid;
 v_account uuid;
BEGIN
 IF v_uid IS NULL OR NOT private.current_mfa_satisfied() OR NOT EXISTS(
  SELECT 1 FROM public.app_members WHERE user_id=v_uid AND active=true AND status='approved'
 ) THEN
  RAISE EXCEPTION 'Sessão ou conta sem autorização.' USING ERRCODE='42501';
 END IF;
 IF p_plan NOT IN ('basic','full') OR p_plan IS NULL THEN
  RAISE EXCEPTION 'Plano inválido.' USING ERRCODE='22023';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_uid::text), 63328);
 SELECT monthly_price_cents INTO v_price FROM public.billing_plans
 WHERE code=p_plan AND available_for_checkout=true AND currency='BRL'
   AND monthly_price_cents>0;
 IF v_price IS NULL THEN
  RAISE EXCEPTION 'Plano indisponível para contratação. Preço ainda não configurado.' USING ERRCODE='22023';
 END IF;
 IF EXISTS (
  SELECT 1 FROM public.billing_subscriptions
  WHERE user_id=v_uid AND plan_code<>'free'
   AND status IN ('active','trialing','past_due','incomplete','unpaid')
 ) THEN
  RAISE EXCEPTION 'Já existe uma assinatura paga em andamento. Gerencie-a antes de contratar outra.' USING ERRCODE='23514';
 END IF;
 -- The latest paid checkout must have its own linked Asaas subscription.
 -- Previously reconciled canceled subscriptions must not block a new purchase.
 IF EXISTS(
  SELECT 1 FROM public.billing_checkout_intents i
  WHERE i.id=(
   SELECT id FROM public.billing_checkout_intents
   WHERE user_id=v_uid AND status='paid' ORDER BY created_at DESC LIMIT 1
  ) AND NOT EXISTS(
   SELECT 1 FROM public.billing_webhook_events e
   JOIN public.billing_subscriptions s
    ON s.provider='asaas'
    AND s.provider_subscription_id=e.payload#>>'{subscription,id}'
    AND s.user_id=v_uid
   WHERE e.provider='asaas' AND e.event_type='SUBSCRIPTION_CREATED'
    AND e.payload#>>'{subscription,checkoutSession}'=i.provider_checkout_id
  )
 ) THEN
  RAISE EXCEPTION 'Há um checkout pago pendente de conciliação. Não inicie outra cobrança.' USING ERRCODE='23514';
 END IF;
 UPDATE public.billing_checkout_intents SET status='expired',updated_at=now()
 WHERE user_id=v_uid AND status IN ('pending','checkout_created')
   AND expires_at<now();
 SELECT id INTO v_existing FROM public.billing_checkout_intents
 WHERE user_id=v_uid AND status IN ('pending','checkout_created') AND expires_at>=now()
 ORDER BY created_at DESC LIMIT 1;
 IF v_existing IS NOT NULL THEN
  RAISE EXCEPTION 'Já existe um checkout em andamento. Aguarde sua expiração ou contate o suporte.' USING ERRCODE='23514';
 END IF;
 INSERT INTO public.billing_accounts(user_id) VALUES(v_uid)
 ON CONFLICT(user_id) DO NOTHING;
 SELECT id INTO v_account FROM public.billing_accounts WHERE user_id=v_uid;
 IF v_account IS NULL THEN
  RAISE EXCEPTION 'Não foi possível preparar o cadastro financeiro.' USING ERRCODE='23514';
 END IF;
 INSERT INTO public.billing_checkout_intents(user_id,billing_account_id,plan_code,amount_cents)
 VALUES(v_uid,v_account,p_plan,v_price)
 RETURNING id INTO v_id;
 RETURN pg_catalog.jsonb_build_object('id',v_id,'plan',p_plan,
  'amountCents',v_price,'currency','BRL','cycle','MONTHLY');
END
$function$;

-- Expire explicitly canceled renewals after their paid term. Asaas was set
-- INACTIVE before cancel_at_period_end was marked. Preserve payment history.
select cron.schedule('payrep-hml-expire-canceled-subscriptions','15 * * * *',
 $cron$
 update public.billing_subscriptions
 set plan_code='free',status='canceled',cancel_at_period_end=false,updated_at=now()
 where provider='asaas' and plan_code in ('basic','full')
  and cancel_at_period_end=true and current_period_end<=now()
 $cron$);
