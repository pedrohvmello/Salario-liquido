-- Independent internal billing identity. Do not cascade retained payment history
-- when the account identity is removed later. Fiscal retention rules will be
-- documented before any live charge or hard-delete implementation.
CREATE TABLE IF NOT EXISTS public.billing_accounts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_accounts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.billing_accounts TO authenticated;
DROP POLICY IF EXISTS billing_accounts_owner_read ON public.billing_accounts;
CREATE POLICY billing_accounts_owner_read ON public.billing_accounts
 FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()) AND (SELECT private.current_mfa_satisfied()));

INSERT INTO public.billing_accounts(user_id)
SELECT DISTINCT user_id FROM public.billing_payments
WHERE user_id IS NOT NULL ON CONFLICT(user_id) DO NOTHING;

ALTER TABLE public.billing_payments
 ADD COLUMN IF NOT EXISTS billing_account_id uuid REFERENCES public.billing_accounts(id);
UPDATE public.billing_payments p
SET billing_account_id=a.id
FROM public.billing_accounts a
WHERE p.user_id=a.user_id AND p.billing_account_id IS NULL;
-- Existing payments keep a stable billing account even after auth user deletion.
ALTER TABLE public.billing_payments DROP CONSTRAINT IF EXISTS billing_payments_user_id_fkey;
ALTER TABLE public.billing_payments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.billing_payments
 ADD CONSTRAINT billing_payments_user_id_fkey
 FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS billing_payments_financial_account_date
 ON public.billing_payments(billing_account_id,created_at DESC);

ALTER TABLE public.billing_checkout_intents
 ADD COLUMN IF NOT EXISTS billing_account_id uuid REFERENCES public.billing_accounts(id);

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

REVOKE ALL ON FUNCTION public.begin_my_billing_checkout(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.begin_my_billing_checkout(text) TO authenticated;
