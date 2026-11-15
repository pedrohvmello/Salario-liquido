-- HML only. Self-service account closure retains auth/profile data for reactivation,
-- but removes payroll data atomically and marks the account suspended.
ALTER TABLE public.app_members
  ADD COLUMN IF NOT EXISTS self_suspended_at timestamptz;

COMMENT ON COLUMN public.app_members.self_suspended_at IS
  'Non-null only for user-initiated suspension after payroll data clearance. Does not grant access.';

CREATE OR REPLACE FUNCTION public.close_my_account(p_confirmation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
 v_uid uuid := (select auth.uid());
 v_member public.app_members%rowtype;
 v_deleted jsonb;
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
 -- clear_my_payroll_data checks the same user/session, including MFA and approval.
 -- A failure rolls back the whole transaction, including membership changes.
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

CREATE OR REPLACE FUNCTION public.request_my_reactivation(p_confirmation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
 v_uid uuid := (select auth.uid());
 v_member public.app_members%rowtype;
 v_requires_approval boolean;
 v_status text;
BEGIN
 IF p_confirmation IS DISTINCT FROM 'REATIVAR' THEN
  RAISE EXCEPTION 'Confirme a solicitação de reativação.' USING ERRCODE='22023';
 END IF;
 IF v_uid IS NULL OR NOT private.current_mfa_satisfied() THEN
  RAISE EXCEPTION 'Sessão não autorizada ou autenticação de dois fatores pendente.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_member FROM public.app_members WHERE user_id=v_uid FOR UPDATE;
 IF NOT FOUND OR v_member.status<>'suspended' OR v_member.active=true THEN
  RAISE EXCEPTION 'A conta não está suspensa ou não pode ser reativada.' USING ERRCODE='42501';
 END IF;
 SELECT require_approval INTO v_requires_approval FROM public.app_admin_settings WHERE id=1;
 -- Admin-enforced suspensions NEVER bypass a manual review.
 v_requires_approval:=coalesce(v_requires_approval,true) OR v_member.self_suspended_at IS NULL;
 v_status:=CASE WHEN v_requires_approval THEN 'pending' ELSE 'approved' END;
 UPDATE public.app_members
 SET status=v_status,active=NOT v_requires_approval,self_suspended_at=NULL
 WHERE user_id=v_uid;
 INSERT INTO public.app_admin_audit(actor_id,target_user_id,action,old_value,new_value)
 VALUES(v_uid,v_uid,'self_reactivation_request','suspended',v_status);
 RETURN pg_catalog.jsonb_build_object(
  'status',v_status,
  'approvalRequired',v_requires_approval,
  'active',NOT v_requires_approval
 );
END
$function$;
REVOKE ALL ON FUNCTION public.request_my_reactivation(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_my_reactivation(text) TO authenticated;

-- Ensure admin-driven status changes do not leave stale self-suspension markers
-- that might later allow a bypass when approval policy is disabled.
CREATE OR REPLACE FUNCTION private.clear_stale_self_suspension()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $function$
BEGIN
 IF old.status IS DISTINCT FROM new.status AND new.status<>'suspended' THEN
  new.self_suspended_at:=NULL;
 END IF;
 RETURN new;
END
$function$;
REVOKE ALL ON FUNCTION private.clear_stale_self_suspension() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS clear_stale_self_suspension_on_status ON public.app_members;
CREATE TRIGGER clear_stale_self_suspension_on_status
BEFORE UPDATE OF status ON public.app_members
FOR EACH ROW EXECUTE FUNCTION private.clear_stale_self_suspension();
