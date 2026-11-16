-- PRD release: monthly pension inference and vacation-safe trienio.
-- Infer a change in the pension PERCENTAGE only from repeated, consistent
-- monthly observations. One-off overtime/retro adjustments remain exceptions.
-- This is not evidence of the judicial order or its exact legal start date.
CREATE OR REPLACE FUNCTION private.inferred_pension_events(p_user uuid)
RETURNS TABLE(statement_id uuid,kind text,effective_date date,value numeric,notes text,period text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
 WITH source AS (
  SELECT s.id,s.period,s.payment_date,s.event_use_competence_end,s.credits,
   sum(l.amount) FILTER(WHERE l.side='debit' AND
    (l.code='07150' OR l.description ~* 'PENS[AÃ]O ALIMENT[IÍ]CIA (MES|M[EÊ]S|MENSAL)')) AS pension,
   sum(l.amount) FILTER(WHERE l.side='debit' AND
    (l.code IN ('07020','/314') OR l.description ~* '^INSS (MES|M[EÊ]S)')) AS inss,
   sum(l.amount) FILTER(WHERE l.side='debit' AND
    (l.code IN ('07050','/401') OR l.description ~* '^IRRF (MES|M[EÊ]S)')) AS irrf
  FROM public.statements s
  LEFT JOIN public.statement_lines l ON l.statement_id=s.id
  WHERE s.user_id=p_user AND s.document_type='monthly'
  GROUP BY s.id
 ), samples AS (
  SELECT s.*,
   round(s.pension*100/(s.credits-s.inss-s.irrf),2) AS pct,
   CASE WHEN s.payment_date IS NOT NULL THEN s.payment_date
    WHEN s.event_use_competence_end THEN
      (date_trunc('month',(s.period||'-01')::date)+interval '1 month - 1 day')::date
    ELSE NULL::date END AS event_date
  FROM source s
  WHERE s.pension>0 AND s.credits>0 AND s.inss>=0 AND s.irrf>=0
    AND s.credits-s.inss-s.irrf>0
 ), verified AS (
  SELECT * FROM samples s
  WHERE s.pct BETWEEN 0.01 AND 100
    AND abs(s.pension-round((s.credits-s.inss-s.irrf)*s.pct/100,2))<=0.06
 ), votes AS (
  SELECT pct,count(*) AS matches
  FROM verified GROUP BY pct HAVING count(*)>=3
 ), winner AS (
  SELECT v.pct,v.matches,(SELECT count(*) FROM samples) AS total
  FROM votes v ORDER BY v.matches DESC,v.pct LIMIT 1
 ), majority AS (
  SELECT * FROM winner WHERE matches*10 >= total*7
    AND NOT EXISTS(
     SELECT 1 FROM public.salary_events e
     WHERE e.user_id=p_user AND e.kind='pensionPercent'
       AND e.source_statement_id IS NULL
    )
 )
 SELECT s.id,'pensionPercent'::text,s.event_date,m.pct,
  ('@payrep:pension-rule:v1:'||pg_catalog.jsonb_build_object(
   'note','Percentual INFERIDO dos holerites, não confirmação da sentença. '||
     m.matches::text||' de '||m.total::text||
     ' folhas mensais conciliam com proventos menos INSS e IRRF. '||
     'Data da primeira observação válida; exceções com férias, retroativos ou '||
     'ajustes não determinam alteração do percentual. Confirmar critérios judiciais.',
   'rule',pg_catalog.jsonb_build_object(
      'excludeInss',true,'excludeIrrf',true,'includeOvertime',true,
      'includeVacation',true,'includeVacationThird',true,
      'includeThirteenth',true,'includePpr',false)
  )::text)::text,
  s.period
 FROM samples s JOIN majority m ON s.pct=m.pct
 WHERE s.event_date IS NOT NULL
 ORDER BY s.period,s.id LIMIT 1
$function$;
REVOKE ALL ON FUNCTION private.inferred_pension_events(uuid) FROM PUBLIC,anon,authenticated;

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
   ('trienio',CASE WHEN s.trienio IS NOT NULL
     AND EXISTS(SELECT 1 FROM public.statements p
      WHERE p.user_id=p_user AND p.document_type='monthly' AND p.period<s.period
      AND p.trienio>s.trienio)
     AND EXISTS(SELECT 1 FROM public.statement_lines v
      WHERE v.statement_id=s.id AND v.side='credit'
      AND (v.code IN ('02000','02005','02010','02015','02080')
       OR v.description ~* '(F[EÉ]RIAS|FERIAS)'))
    THEN null::numeric ELSE s.trienio::numeric END),
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
 UNION ALL
 SELECT p.statement_id,p.kind,p.effective_date,p.value,p.notes,p.period
 FROM private.inferred_pension_events(p_user) p
$function$;

CREATE OR REPLACE FUNCTION public.sync_my_monthly_salary_events(
 p_use_competence_end boolean DEFAULT false,
 p_document_ids uuid[] DEFAULT NULL
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
-- PRD release intentionally performs no retroactive deletes or backfills.
-- Existing user-owned documents and events remain unchanged.
