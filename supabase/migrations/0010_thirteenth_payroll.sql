-- Dedicated December 13th-paycheck is separate from regular monthly payroll and vacations.
-- Withholds (INSS, IRRF, support payments) stay segregated for annual tax comparison.
alter table public.statements
  drop constraint if exists statements_document_type_check;
alter table public.statements
  add constraint statements_document_type_check
  check (document_type in ('monthly','ppr','vacation','thirteenth'));
alter table public.statements
  add column if not exists thirteenth_gross numeric(16,2),
  add column if not exists thirteenth_advance numeric(16,2) not null default 0,
  add column if not exists thirteenth_inss numeric(16,2) not null default 0,
  add column if not exists thirteenth_irrf numeric(16,2) not null default 0,
  add column if not exists thirteenth_pension numeric(16,2) not null default 0;
alter table public.statements
  add constraint statements_thirteenth_valid check (
   (document_type<>'thirteenth' and thirteenth_gross is null)
   or (document_type='thirteenth'
     and period ~ '^[0-9]{4}-12$'
     and payment_date is not null
     and left(period,4)=to_char(payment_date,'YYYY')
     and thirteenth_gross>0
     and credits is not null and debits is not null and net is not null
     and abs(credits-debits-net)<=.02
     and abs(thirteenth_gross-credits)<=.02
     and abs((thirteenth_advance+thirteenth_inss+thirteenth_irrf+thirteenth_pension)-debits)<=.02)
  );
-- Only one genuine annual payroll receipt per year per user. Identical reuploads
-- with same SHA/page still upsert into the existing source record.
create unique index if not exists statements_unique_thirteenth_per_year
 on public.statements(user_id,period) where document_type='thirteenth';

create or replace function public.sync_special_statement_event()
returns trigger
language plpgsql security definer set search_path=''
as $function$
declare
  event_kind text;
  amount numeric;
  event_note text;
begin
  if new.document_type='ppr' then
    if new.payment_date is null or new.gross_ppr is null or new.gross_ppr<=0
       or new.credits is null or new.debits is null or new.net is null
       or abs((new.credits-new.debits)-new.net)>.02 then
      raise exception 'Incomplete or inconsistent PPR statement';
    end if;
    event_kind:='ppr';
    amount:=new.gross_ppr;
    event_note:='PPR importado: competência '||new.period||
       '; líquido pago '||new.net::text||'; descontos '||new.debits::text;
  elsif new.document_type='thirteenth' then
    if new.payment_date is null or new.thirteenth_gross is null or
       new.credits is null or new.debits is null or new.net is null or
       abs(new.credits-new.debits-new.net)>.02 then
      raise exception 'Incomplete or inconsistent thirteenth paycheck';
    end if;
    event_kind:='thirteenth';
    amount:=new.thirteenth_gross;
    event_note:='13º importado: competência '||new.period||
      '; IRRF exclusivo '||new.thirteenth_irrf::text||
      '; INSS 13º '||new.thirteenth_inss::text||
      '; adiantamento já descontado '||new.thirteenth_advance::text||
      '; líquido do fechamento '||new.net::text;
  else
    delete from public.salary_events where source_statement_id=new.id;
    return new;
  end if;
  insert into public.salary_events(user_id,kind,effective_date,value,notes,source_statement_id)
   values(new.user_id,event_kind,new.payment_date,amount,event_note,new.id)
  on conflict (source_statement_id)
   do update set kind=excluded.kind,effective_date=excluded.effective_date,
     value=excluded.value,notes=excluded.notes,user_id=excluded.user_id;
  return new;
end
$function$;
revoke all on function public.sync_special_statement_event() from public,anon,authenticated;
drop trigger if exists sync_ppr_event_after_write on public.statements;
drop trigger if exists sync_special_event_after_write on public.statements;
create trigger sync_special_event_after_write
after insert or update of document_type,payment_date,gross_ppr,thirteenth_gross,
 thirteenth_advance,thirteenth_inss,thirteenth_irrf,thirteenth_pension,
 credits,debits,net
on public.statements for each row
execute function public.sync_special_statement_event();
drop function if exists public.sync_ppr_event_from_statement();
