-- HML-only: paid subscription and unsettled payment guard before account closure.
-- This does not affect "Excluir meus dados", which never closes the account.
-- Billing cancellation is performed by an external/provider workflow, not here.

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
  ELSIF FOUND AND v_sub.plan_code <> 'free' THEN
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
REVOKE ALL ON FUNCTION private.account_closure_billing_state(uuid)
 FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_my_account_closure_status()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
 v_uid uuid := (select auth.uid());
BEGIN
 IF v_uid IS NULL OR NOT private.current_mfa_satisfied() THEN
  RAISE EXCEPTION 'Sessão inválida ou verificação de segurança pendente.'
   USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.app_members
  WHERE user_id=v_uid AND status='approved' AND active
 ) THEN
  RAISE EXCEPTION 'Conta sem permissão de acesso.' USING ERRCODE='42501';
 END IF;
 RETURN private.account_closure_billing_state(v_uid);
END
$function$;
REVOKE ALL ON FUNCTION public.get_my_account_closure_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_account_closure_status() TO authenticated;

-- The billing check is repeated inside the same transaction that clears data
-- and suspends the membership. The subscription row is locked so that a
-- concurrent status update cannot bypass the last-moment validation.
CREATE OR REPLACE FUNCTION public.close_my_account(p_confirmation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
 v_uid uuid := (select auth.uid());
 v_member public.app_members%rowtype;
 v_deleted jsonb;
 v_billing jsonb;
BEGIN
 IF p_confirmation IS DISTINCT FROM 'EXCLUIR' THEN
  RAISE EXCEPTION 'Digite EXCLUIR para confirmar o encerramento da conta.' USING ERRCODE='22023';
 END IF;
 IF v_uid IS NULL OR NOT private.current_mfa_satisfied() THEN
  RAISE EXCEPTION 'Sessão não autorizada ou autenticação de dois fatores pendente.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_member FROM public.app_members
 WHERE user_id=v_uid FOR UPDATE;
 IF NOT FOUND OR v_member.active IS DISTINCT FROM true OR v_member.status<>'approved' THEN
  RAISE EXCEPTION 'Somente uma conta ativa pode solicitar o encerramento.' USING ERRCODE='42501';
 END IF;
 IF v_member.role='admin' AND
    (SELECT count(*) FROM public.app_members
     WHERE role='admin' AND active=true AND status='approved')<=1 THEN
  RAISE EXCEPTION 'A última conta administradora não pode ser suspensa. Transfira a administração antes.' USING ERRCODE='42501';
 END IF;

 -- Lock both subscription and currently pending payment rows before checking.
 PERFORM 1 FROM public.billing_subscriptions WHERE user_id=v_uid FOR UPDATE;
 PERFORM 1 FROM public.billing_payments
 WHERE user_id=v_uid AND status='pending' FOR SHARE;
 SELECT private.account_closure_billing_state(v_uid) INTO v_billing;
 IF (v_billing->>'allowed') IS DISTINCT FROM 'true' THEN
  IF v_billing->>'reason'='renewal_active' THEN
   RAISE EXCEPTION 'Há uma assinatura paga com renovação ativa. Cancele a renovação antes de encerrar a conta.'
    USING ERRCODE='23514';
  ELSIF v_billing->>'reason'='payment_pending' THEN
   RAISE EXCEPTION 'Há uma cobrança pendente. Regularize a cobrança ou contate o suporte antes de encerrar a conta.'
    USING ERRCODE='23514';
  ELSE
   RAISE EXCEPTION 'A situação da assinatura precisa ser verificada pelo suporte antes do encerramento.'
    USING ERRCODE='23514';
  END IF;
 END IF;
 -- A failure within payroll data removal rolls back the entire transaction.
 SELECT public.clear_my_payroll_data('EXCLUIR') INTO v_deleted;
 UPDATE public.app_members SET status='suspended',active=false,self_suspended_at=now()
 WHERE user_id=v_uid;
 INSERT INTO public.app_admin_audit(actor_id,target_user_id,action,old_value,new_value)
 VALUES(v_uid,v_uid,'self_account_suspension','approved','suspended');
 RETURN pg_catalog.jsonb_build_object('reset',true,'accountSuspended',true,'removed',v_deleted);
END
$function$;
REVOKE ALL ON FUNCTION public.close_my_account(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.close_my_account(text) TO authenticated;
