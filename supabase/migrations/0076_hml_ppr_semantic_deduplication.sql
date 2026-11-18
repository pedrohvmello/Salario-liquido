-- HML: prevent equivalent PPR receipts under different PDF file hashes.
alter table public.statements
 add column duplicate_of uuid references public.statements(id) on delete set null;
alter table public.statements
 add constraint statements_duplicate_not_self check (duplicate_of is null or duplicate_of<>id);

with ranked as (
 select id,
  first_value(id) over(partition by user_id,period,coalesce(payment_date,date '0001-01-01'),
   coalesce(gross_ppr,-1),coalesce(net,-1),coalesce(ppr_income_tax,-1),
   coalesce(ppr_union_contribution,-1) order by uploaded_at,id) as canonical_id,
  row_number() over(partition by user_id,period,coalesce(payment_date,date '0001-01-01'),
   coalesce(gross_ppr,-1),coalesce(net,-1),coalesce(ppr_income_tax,-1),
   coalesce(ppr_union_contribution,-1) order by uploaded_at,id) as rn
 from public.statements where document_type='ppr'
)
update public.statements s set duplicate_of=r.canonical_id
from ranked r where s.id=r.id and r.rn>1;

delete from public.salary_events where source_statement_id in
 (select id from public.statements where duplicate_of is not null)
 and kind='ppr';

create unique index statements_ppr_semantic_unique
on public.statements (
 user_id,period,coalesce(payment_date,date '0001-01-01'),
 coalesce(gross_ppr,-1),coalesce(net,-1),
 coalesce(ppr_income_tax,-1),coalesce(ppr_union_contribution,-1)
) where document_type='ppr' and duplicate_of is null;

create function private.guard_statement_duplicate_ref()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' and new.duplicate_of is not null then
  raise exception using errcode='23514',message='Vínculo de duplicidade não pode ser definido pelo upload.';
 end if;
 if tg_op='UPDATE' and old.duplicate_of is null and new.duplicate_of is not null then
  raise exception using errcode='23514',message='Vínculo de duplicidade não pode ser alterado manualmente.';
 end if;
 return new;
end $$;
create trigger guard_statement_duplicate_ref
 before insert or update on public.statements for each row
 execute function private.guard_statement_duplicate_ref();
revoke all on function private.guard_statement_duplicate_ref() from public;

CREATE OR REPLACE FUNCTION public.sync_special_statement_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE event_kind text; amount numeric; event_note text;
BEGIN
 IF new.duplicate_of IS NOT NULL THEN
  DELETE FROM public.salary_events WHERE source_statement_id=new.id AND kind IN ('ppr','thirteenth');
  RETURN new;
 END IF;
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
$function$
;
