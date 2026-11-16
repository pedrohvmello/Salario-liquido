-- PRD release: derived salary events per payslip, with explicit provisional-date consent.
-- The original source document remains available; deleting it cascades linked events.
ALTER TABLE public.statements ADD COLUMN IF NOT EXISTS dependents_irrf integer
  CHECK (dependents_irrf BETWEEN 0 AND 30);
ALTER TABLE public.statements ADD COLUMN IF NOT EXISTS event_use_competence_end boolean NOT NULL DEFAULT false;

ALTER TABLE public.salary_events DROP CONSTRAINT IF EXISTS salary_events_source_statement_unique;
ALTER TABLE public.salary_events DROP CONSTRAINT IF EXISTS salary_events_source_kind_unique;
ALTER TABLE public.salary_events ADD CONSTRAINT salary_events_source_kind_unique
  UNIQUE(source_statement_id,kind);

-- Keep occasional PPR/13th triggers compatible with more than one event
-- per monthly statement, and don't delete monthly source events on updates.
CREATE OR REPLACE FUNCTION public.sync_special_statement_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE event_kind text; amount numeric; event_note text;
BEGIN
 IF new.document_type='ppr' THEN
  IF new.payment_date IS NULL OR new.gross_ppr IS NULL OR new.gross_ppr<=0
     OR new.credits IS NULL OR new.debits IS NULL OR new.net IS NULL
     OR abs((new.credits-new.debits)-new.net)>.02 THEN
   RAISE EXCEPTION 'Incomplete or inconsistent PPR statement';
  END IF;
  event_kind:='ppr'; amount:=new.gross_ppr;
  event_note:='PPR importado: competência '||new.period||
   '; líquido pago '||new.net::text||'; descontos '||new.debits::text;
 ELSIF new.document_type='thirteenth' THEN
  IF new.payment_date IS NULL OR new.thirteenth_gross IS NULL
     OR new.credits IS NULL OR new.debits IS NULL OR new.net IS NULL
     OR abs(new.credits-new.debits-new.net)>.02 THEN
   RAISE EXCEPTION 'Incomplete or inconsistent thirteenth paycheck';
  END IF;
  event_kind:='thirteenth'; amount:=new.thirteenth_gross;
  event_note:='13º importado: competência '||new.period||
   '; IRRF exclusivo '||new.thirteenth_irrf::text||
   '; INSS 13º '||new.thirteenth_inss::text||
   '; adiantamento já descontado '||new.thirteenth_advance::text||
   '; líquido do fechamento '||new.net::text;
 ELSE
  DELETE FROM public.salary_events
  WHERE source_statement_id=new.id AND kind IN ('ppr','thirteenth');
  RETURN new;
 END IF;
 INSERT INTO public.salary_events(user_id,kind,effective_date,value,notes,source_statement_id)
 VALUES(new.user_id,event_kind,new.payment_date,amount,event_note,new.id)
 ON CONFLICT (source_statement_id,kind)
 DO UPDATE SET effective_date=excluded.effective_date,value=excluded.value,
 notes=excluded.notes,user_id=excluded.user_id;
 RETURN new;
END
$function$;
REVOKE ALL ON FUNCTION public.sync_special_statement_event() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.monthly_salary_event_observations(p_user uuid)
RETURNS TABLE(statement_id uuid,kind text,effective_date date,value numeric,notes text,period text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
 WITH source AS (
  SELECT s.id, s.period,s.salary_contract,s.trienio,s.dependents_irrf,
   CASE WHEN s.payment_date IS NOT NULL THEN s.payment_date
    WHEN s.event_use_competence_end THEN
      (date_trunc('month',(s.period||'-01')::date)+interval '1 month - 1 day')::date
    ELSE null END as effective_date,
   (s.payment_date IS NULL) as approximate,
   (
    SELECT sum(l.amount) FROM public.statement_lines l
    WHERE l.statement_id=s.id AND l.side='debit'
     AND (l.code='07780' OR l.description ~* '(VGBL|PGBL|PREVID[EÊ]NCIA PRIVADA)')
   ) as pension_amount,
   (
    SELECT sum(l.amount) FROM public.statement_lines l
    WHERE l.statement_id=s.id AND l.side='debit'
     AND l.description ~* '(ESPP|PLANO DE COMPRA DE A[CÇ][OÕ]ES)'
   ) as espp_amount
  FROM public.statements s
  WHERE s.user_id=p_user AND s.document_type='monthly'
 ), candidates AS (
  SELECT s.id,s.period,s.effective_date,s.approximate,k.kind,k.value
  FROM source s
  CROSS JOIN LATERAL (VALUES
   ('salary'::text,s.salary_contract::numeric),
   ('trienio',s.trienio::numeric),
   ('dependents',s.dependents_irrf::numeric),
   ('privatePensionPercent',CASE WHEN s.salary_contract>0 AND s.pension_amount>0 THEN round(s.pension_amount*100/s.salary_contract,2) END),
   ('esppPercent',CASE WHEN s.salary_contract>0 AND s.espp_amount>0 THEN round(s.espp_amount*100/s.salary_contract,2) END)
  ) AS k(kind,value)
  WHERE s.effective_date IS NOT NULL AND k.value IS NOT NULL AND k.value>=0
    AND k.value<=CASE WHEN k.kind IN ('esppPercent','privatePensionPercent') THEN 100 ELSE 100000000 END
 ), ordered AS (
  SELECT c.*,lag(c.value) OVER (PARTITION BY c.kind ORDER BY c.period,c.id) AS previous_value
  FROM candidates c
 )
 SELECT o.id,o.kind,o.effective_date,o.value,
  ('Importado automaticamente do holerite '||o.period||
   CASE WHEN o.approximate
    THEN '; data de referência estimada: último dia da competência, NÃO é data de pagamento confirmada'
    ELSE '; data de pagamento extraída do documento' END
   ||'; confirme vigência e rubricas quando necessário')::text,
  o.period
 FROM ordered o
 WHERE o.previous_value IS DISTINCT FROM o.value
$function$;
REVOKE ALL ON FUNCTION private.monthly_salary_event_observations(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.sync_my_monthly_salary_events(
 p_use_competence_end boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
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
    AND NOT event_use_competence_end;
  GET DIAGNOSTICS v_wrote=ROW_COUNT;
 END IF;
 -- Drop only auto-generated events for this user that are no longer a change
 -- point. Never touch user-created events (source_statement_id IS NULL).
 DELETE FROM public.salary_events e
 USING public.statements s
 WHERE e.source_statement_id=s.id AND s.user_id=v_user
   AND s.document_type='monthly'
   AND e.kind IN ('salary','trienio','dependents','privatePensionPercent','esppPercent')
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
 WHERE public.salary_events.effective_date IS DISTINCT FROM excluded.effective_date
    OR public.salary_events.value IS DISTINCT FROM excluded.value
    OR public.salary_events.notes IS DISTINCT FROM excluded.notes;
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
REVOKE ALL ON FUNCTION public.sync_my_monthly_salary_events(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_my_monthly_salary_events(boolean) TO authenticated;
