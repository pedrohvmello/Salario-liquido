-- HML safety: a paid Asaas checkout has been confirmed, but financial events
-- are pending verified reconciliation. Block any additional checkout for the
-- same account until reconciliation is implemented; avoid duplicate subscriptions.
-- This is a temporary fail-closed guard, not a production pricing or license rule.
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
 IF EXISTS(
  SELECT 1 FROM public.billing_checkout_intents
  WHERE user_id=v_uid AND status='paid'
 ) THEN
  RAISE EXCEPTION 'Já existe um checkout pago aguardando conciliação. Não inicie outra cobrança.' USING ERRCODE='23514';
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
