-- Follow-up: check the loaded subscription row rather than the FOUND flag of a subsequent SELECT EXISTS.
CREATE OR REPLACE FUNCTION private.account_closure_billing_state(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_sub public.billing_subscriptions%rowtype;
  v_pending boolean;
  v_reason text := 'eligible';
  v_allowed boolean := true;
  v_period_remaining boolean := false;
BEGIN
  SELECT * INTO v_sub FROM public.billing_subscriptions WHERE user_id=p_user;
  SELECT EXISTS (
    SELECT 1 FROM public.billing_payments
    WHERE user_id=p_user AND status='pending'
  ) INTO v_pending;

  IF v_pending THEN
    v_allowed:=false;
    v_reason:='payment_pending';
  ELSIF v_sub.user_id IS NOT NULL AND v_sub.plan_code <> 'free' THEN
    -- Require a verifiable billing identifier for paid plans. If records are
    -- incomplete, fail closed and direct the user to billing support.
    IF v_sub.provider IS NULL
       OR nullif(trim(v_sub.provider_subscription_id),'') IS NULL THEN
      v_allowed:=false;
      v_reason:='billing_review';
    ELSIF v_sub.status IN ('past_due','incomplete','unpaid') THEN
      v_allowed:=false;
      v_reason:='billing_review';
    ELSIF v_sub.status IN ('active','trialing') AND NOT v_sub.cancel_at_period_end THEN
      v_allowed:=false;
      v_reason:='renewal_active';
    ELSIF v_sub.status='canceled' OR
         (v_sub.status IN ('active','trialing') AND v_sub.cancel_at_period_end) THEN
      v_allowed:=true;
      v_reason:='eligible';
      v_period_remaining:=(v_sub.current_period_end IS NOT NULL
                          AND v_sub.current_period_end>now());
    ELSE
      v_allowed:=false;
      v_reason:='billing_review';
    END IF;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'allowed',v_allowed,'reason',v_reason,
    'plan',coalesce(v_sub.plan_code,'free'),
    'subscriptionStatus',coalesce(v_sub.status,'none'),
    'cancelAtPeriodEnd',coalesce(v_sub.cancel_at_period_end,false),
    'periodEnd',v_sub.current_period_end,
    'paidTimeRemaining',v_period_remaining
  );
END
$function$;

REVOKE ALL ON FUNCTION private.account_closure_billing_state(uuid) FROM PUBLIC,anon,authenticated;
