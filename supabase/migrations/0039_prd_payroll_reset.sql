-- PRD release, opt-in payroll reset. Does not delete auth.users, app_members,
-- user_profiles, billing, support history, security factors or activity audit.
-- The caller must be logged in, approved and MFA/session compliant.
CREATE OR REPLACE FUNCTION public.clear_my_payroll_data(confirmation text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_count_statements integer := 0;
  v_count_events integer := 0;
  v_count_hours integer := 0;
  v_count_tax integer := 0;
  v_count_settings integer := 0;
BEGIN
  IF confirmation IS DISTINCT FROM 'EXCLUIR' THEN
    RAISE EXCEPTION 'Confirmação inválida.';
  END IF;
  IF v_uid IS NULL OR NOT private.current_mfa_satisfied() THEN
    RAISE EXCEPTION 'Sessão não autorizada ou verificação MFA pendente.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_members m
    WHERE m.user_id = v_uid AND m.active = true AND m.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Conta não autorizada.';
  END IF;

  -- Prevent concurrent resets for the same identity during the DB transaction.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_uid::text), 51961);

  -- These rows are unique to this user. CASCADE removes statement_lines and
  -- any salary_events linked to a statement. The extra salary_events delete
  -- removes manual and orphaned events as well.
  DELETE FROM public.salary_events WHERE user_id = v_uid;
  GET DIAGNOSTICS v_count_events = ROW_COUNT;
  DELETE FROM public.statements WHERE user_id = v_uid;
  GET DIAGNOSTICS v_count_statements = ROW_COUNT;
  DELETE FROM public.time_entries WHERE user_id = v_uid;
  GET DIAGNOSTICS v_count_hours = ROW_COUNT;
  DELETE FROM public.annual_tax_comparisons WHERE user_id = v_uid;
  GET DIAGNOSTICS v_count_tax = ROW_COUNT;
  DELETE FROM public.user_settings WHERE user_id = v_uid;
  GET DIAGNOSTICS v_count_settings = ROW_COUNT;

  RETURN pg_catalog.jsonb_build_object(
    'reset', true,
    'statements', v_count_statements,
    'events', v_count_events,
    'hours', v_count_hours,
    'taxComparisons', v_count_tax,
    'settings', v_count_settings
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.clear_my_payroll_data(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_my_payroll_data(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.clear_my_payroll_data(text) TO authenticated;
