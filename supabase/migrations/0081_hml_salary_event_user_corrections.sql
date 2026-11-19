-- Keep edits/removals of source-linked events separate from immutable PDF evidence.
-- A re-import/sync must never overwrite a deliberate user correction or revive a hidden event.
alter table public.salary_events add column user_override boolean not null default false;
alter table public.salary_events add column hidden boolean not null default false;
comment on column public.salary_events.user_override is 'User manually adjusted a source-linked event; preserve on import sync.';
comment on column public.salary_events.hidden is 'User removed this event from forecasts; source-linked evidence retained for audit and sync dedup.';
CREATE OR REPLACE FUNCTION public.sync_my_monthly_salary_events(p_use_competence_end boolean DEFAULT false, p_document_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_user uuid := (select auth.uid());
 v_wrote integer:=0;
 v_needs_date integer:=0;
 v_approx integer:=0;
 v_events integer:=0;
BEGIN
 IF v_user IS NULL OR NOT private.current_mfa_satisfied() THEN
  RAISE EXCEPTION 'Sessão inválida ou 2FA pendente.' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.app_members
  WHERE user_id=v_user AND active AND status='approved') THEN
  RAISE EXCEPTION 'Conta sem autorização.' USING ERRCODE='42501';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_user::text),51962);
 IF coalesce(p_use_competence_end,false) THEN
  UPDATE public.statements SET event_use_competence_end=true
  WHERE user_id=v_user AND document_type='monthly' AND payment_date IS NULL
    AND NOT event_use_competence_end
    AND (p_document_ids IS NULL OR id=ANY(p_document_ids));
  GET DIAGNOSTICS v_wrote=ROW_COUNT;
 END IF;
 -- Drop only auto-generated events for this user that are no longer a change
 -- point. Never touch user-created events (source_statement_id IS NULL).
 DELETE FROM public.salary_events e
 USING public.statements s
 WHERE e.source_statement_id=s.id AND s.user_id=v_user
   AND s.document_type='monthly'
   AND NOT e.user_override AND NOT e.hidden
   AND e.kind IN ('salary','trienio','dependents','privatePensionPercent','esppPercent','pensionPercent')
   AND NOT EXISTS (
    SELECT 1 FROM private.monthly_salary_event_observations(v_user) wanted
    WHERE wanted.statement_id=s.id AND wanted.kind=e.kind
   );
 INSERT INTO public.salary_events(user_id,kind,effective_date,value,notes,source_statement_id)
 SELECT v_user,c.kind,c.effective_date,c.value,c.notes,c.statement_id
 FROM private.monthly_salary_event_observations(v_user) c
 ON CONFLICT (source_statement_id,kind)
 DO UPDATE SET effective_date=excluded.effective_date,value=excluded.value,
  notes=excluded.notes,user_id=excluded.user_id
 WHERE NOT public.salary_events.user_override AND NOT public.salary_events.hidden
   AND (public.salary_events.effective_date IS DISTINCT FROM excluded.effective_date
    OR public.salary_events.value IS DISTINCT FROM excluded.value
    OR public.salary_events.notes IS DISTINCT FROM excluded.notes);
 GET DIAGNOSTICS v_events=ROW_COUNT;
 SELECT count(*) INTO v_needs_date FROM public.statements
 WHERE user_id=v_user AND document_type='monthly'
   AND payment_date IS NULL AND NOT event_use_competence_end;
 SELECT count(*) INTO v_approx FROM public.statements
 WHERE user_id=v_user AND document_type='monthly'
   AND payment_date IS NULL AND event_use_competence_end;
 RETURN pg_catalog.jsonb_build_object(
  'synced',true,'changedEvents',v_events,
  'missingDateDocuments',v_needs_date,
  'provisionalDateDocuments',v_approx,'confirmedProvisional',v_wrote
 );
END
$function$;
