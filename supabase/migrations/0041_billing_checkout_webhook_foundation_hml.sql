-- Payrep HML, phase 1 billing architecture (Asaas sandbox only).
-- Plans remain unavailable and unpriced. This creates no charges or subscriptions.
-- Only the trusted billing Edge Function can start a checkout; only verified
-- provider webhooks can populate the internal inbox.

CREATE TABLE IF NOT EXISTS public.billing_checkout_intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 plan_code text NOT NULL REFERENCES public.billing_plans(code)
   CHECK (plan_code IN ('basic','full')),
 provider text NOT NULL DEFAULT 'asaas' CHECK (provider='asaas'),
 amount_cents integer NOT NULL CHECK (amount_cents>0),
 currency text NOT NULL DEFAULT 'BRL' CHECK(currency='BRL'),
 billing_cycle text NOT NULL DEFAULT 'MONTHLY' CHECK(billing_cycle='MONTHLY'),
 status text NOT NULL DEFAULT 'pending'
   CHECK(status IN ('pending','checkout_created','paid','canceled','expired','failed')),
 provider_checkout_id text UNIQUE,
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '60 minutes'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_checkout_intents_owner_date
 ON public.billing_checkout_intents(user_id,created_at DESC);
ALTER TABLE public.billing_checkout_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_checkout_intents FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.billing_checkout_intents TO authenticated;
DROP POLICY IF EXISTS billing_checkout_intents_owner_read ON public.billing_checkout_intents;
CREATE POLICY billing_checkout_intents_owner_read
 ON public.billing_checkout_intents FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()) AND (SELECT private.current_mfa_satisfied()));

CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 provider text NOT NULL DEFAULT 'asaas' CHECK(provider='asaas'),
 provider_event_id text NOT NULL,
 event_type text NOT NULL,
 provider_checkout_id text,
 provider_subscription_id text,
 provider_payment_id text,
 payload jsonb NOT NULL,
 processing_status text NOT NULL DEFAULT 'received'
  CHECK(processing_status IN ('received','processed','needs_review','failed')),
 received_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz,
 last_error text,
 UNIQUE(provider,provider_event_id)
);
CREATE INDEX IF NOT EXISTS billing_webhook_events_queue
 ON public.billing_webhook_events(processing_status,received_at);
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_webhook_events FROM PUBLIC,anon,authenticated;
-- Service role alone, no end-user access to raw payment provider payloads.

-- Fail closed when plan is unavailable, price missing, user blocked,
-- an active paid subscription exists, or a checkout is already in progress.
CREATE OR REPLACE FUNCTION public.begin_my_billing_checkout(p_plan text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
 v_uid uuid := (SELECT auth.uid());
 v_price integer;
 v_id uuid;
 v_existing uuid;
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
 UPDATE public.billing_checkout_intents SET status='expired',updated_at=now()
 WHERE user_id=v_uid AND status IN ('pending','checkout_created')
   AND expires_at<now();
 SELECT id INTO v_existing FROM public.billing_checkout_intents
 WHERE user_id=v_uid AND status IN ('pending','checkout_created') AND expires_at>=now()
 ORDER BY created_at DESC LIMIT 1;
 IF v_existing IS NOT NULL THEN
  RAISE EXCEPTION 'Já existe um checkout em andamento. Aguarde sua expiração ou contate o suporte.' USING ERRCODE='23514';
 END IF;
 INSERT INTO public.billing_checkout_intents(user_id,plan_code,amount_cents)
 VALUES(v_uid,p_plan,v_price)
 RETURNING id INTO v_id;
 RETURN pg_catalog.jsonb_build_object('id',v_id,'plan',p_plan,
  'amountCents',v_price,'currency','BRL','cycle','MONTHLY');
END
$function$;
REVOKE ALL ON FUNCTION public.begin_my_billing_checkout(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.begin_my_billing_checkout(text) TO authenticated;

-- Service-only, atomic, idempotent storage of webhooks. An event is persisted
-- BEFORE HTTP 200; only checkout lifecycle changes are applied automatically.
-- Paid plan activation requires verified subscription and payment reconciliation.
CREATE OR REPLACE FUNCTION public.receive_asaas_billing_event(p_event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
 v_id text;
 v_type text;
 v_checkout text;
 v_external text;
 v_subscription text;
 v_payment text;
 v_inserted bigint;
 v_owner uuid;
 v_changed integer := 0;
BEGIN
 IF (SELECT auth.role()) <> 'service_role' THEN
  RAISE EXCEPTION 'Privileged billing operation required.' USING ERRCODE='42501';
 END IF;
 v_id:=NULLIF(p_event->>'id','');
 v_type:=NULLIF(p_event->>'event','');
 IF v_id IS NULL OR length(v_id)>180 OR v_type IS NULL OR length(v_type)>100 OR pg_catalog.pg_column_size(p_event)>131072 THEN
  RAISE EXCEPTION 'Invalid webhook event.' USING ERRCODE='22023';
 END IF;
 v_checkout:=NULLIF(p_event#>>'{checkout,id}','');
 v_external:=NULLIF(p_event#>>'{checkout,externalReference}','');
 v_subscription:=NULLIF(p_event#>>'{subscription,id}','');
 v_payment:=NULLIF(p_event#>>'{payment,id}','');
 INSERT INTO public.billing_webhook_events(
  provider_event_id,event_type,provider_checkout_id,provider_subscription_id,provider_payment_id,payload
 )
 VALUES(v_id,v_type,v_checkout,v_subscription,v_payment,p_event)
 ON CONFLICT(provider,provider_event_id) DO NOTHING RETURNING id INTO v_inserted;
 IF v_inserted IS NULL THEN
  RETURN pg_catalog.jsonb_build_object('duplicate',true,'stored',true);
 END IF;
 IF v_type IN ('CHECKOUT_PAID','CHECKOUT_CANCELED','CHECKOUT_EXPIRED','CHECKOUT_CREATED') THEN
  UPDATE public.billing_checkout_intents i SET
    status=CASE
      WHEN v_type='CHECKOUT_PAID' THEN 'paid'
      WHEN v_type='CHECKOUT_CANCELED' THEN 'canceled'
      WHEN v_type='CHECKOUT_EXPIRED' THEN 'expired'
      ELSE 'checkout_created' END,
    updated_at=now()
  WHERE i.provider='asaas' AND i.provider_checkout_id=v_checkout
    AND v_checkout IS NOT NULL
    AND (v_external IS NULL OR i.id::text=v_external)
    AND (
      v_type='CHECKOUT_PAID' AND i.status IN ('pending','checkout_created','paid') OR
      v_type='CHECKOUT_CREATED' AND i.status='pending' OR
      v_type IN ('CHECKOUT_CANCELED','CHECKOUT_EXPIRED') AND i.status IN ('pending','checkout_created')
    );
  GET DIAGNOSTICS v_changed=ROW_COUNT;
 END IF;
 -- Subscription/payment webhooks are retained for verified reconciliation.
 -- Do not infer a user or activate paid entitlements from an unlinked resource.
 UPDATE public.billing_webhook_events SET
  processing_status=CASE WHEN v_changed>0 THEN 'processed' ELSE 'needs_review' END,
  processed_at=now(),
  last_error=CASE WHEN v_changed>0 THEN NULL ELSE 'Awaiting verified provider-resource reconciliation' END
 WHERE id=v_inserted;
 RETURN pg_catalog.jsonb_build_object('duplicate',false,'stored',true,
  'checkoutUpdated',v_changed>0,'needsReview',v_changed=0);
END
$function$;
REVOKE ALL ON FUNCTION public.receive_asaas_billing_event(jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.receive_asaas_billing_event(jsonb) TO service_role;

-- A read-only, user-scoped checkout history; no user-level changes allowed.
COMMENT ON TABLE public.billing_webhook_events IS
 'Restricted provider event inbox. Data minimization and retention policy must be set before live billing.';
