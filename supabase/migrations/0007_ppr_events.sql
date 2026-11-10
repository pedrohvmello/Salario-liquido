-- Standalone profit-sharing (PPR) payroll statements and source-linked one-time events.
-- Never merge PPR earnings with regular salary in monthly trends.
alter table public.statements
  add column if not exists document_type text not null default 'monthly'
    check (document_type in ('monthly','ppr')),
  add column if not exists payment_date date,
  add column if not exists gross_ppr numeric(16,2),
  add column if not exists ppr_income_tax numeric(16,2) not null default 0,
  add column if not exists ppr_union_contribution numeric(16,2) not null default 0;

alter table public.salary_events
  add column if not exists source_statement_id uuid references public.statements(id) on delete cascade;
alter table public.salary_events
  add constraint salary_events_source_statement_unique unique(source_statement_id);

-- Source-linked event references must belong to the same member.
alter policy "salary_events_owner" on public.salary_events
  using (user_id=(select auth.uid())
    and exists(select 1 from public.app_members m where m.user_id=(select auth.uid()) and m.active))
  with check (user_id=(select auth.uid())
    and exists(select 1 from public.app_members m where m.user_id=(select auth.uid()) and m.active)
    and (source_statement_id is null or exists(
      select 1 from public.statements s
      where s.id=source_statement_id and s.user_id=(select auth.uid()))));

-- Changes to statements and their corresponding automatic PPR events occur in
-- the same DB transaction, so retries never duplicate the source-linked event.
create or replace function public.sync_ppr_event_from_statement()
returns trigger
language plpgsql security definer set search_path = ''
as $function$
begin
  if new.document_type='ppr' then
    if new.payment_date is null or new.gross_ppr is null
       or new.gross_ppr<=0 or new.credits is null
       or new.debits is null or new.net is null
       or abs((new.credits-new.debits)-new.net)>0.02 then
      raise exception 'Incomplete or inconsistent PPR statement';
    end if;
    insert into public.salary_events
      (user_id,kind,effective_date,value,notes,source_statement_id)
    values
      (new.user_id,'ppr',new.payment_date,new.gross_ppr,
       'PPR importado: competência '||new.period||
       '; líquido pago '||new.net::text||
       '; descontos '||new.debits::text,
       new.id)
    on conflict (source_statement_id)
    do update set kind='ppr',effective_date=excluded.effective_date,
      value=excluded.value,notes=excluded.notes,user_id=excluded.user_id;
  else
    delete from public.salary_events e
      where e.source_statement_id=new.id;
  end if;
  return new;
end
$function$;
revoke all on function public.sync_ppr_event_from_statement() from public,anon,authenticated;
drop trigger if exists sync_ppr_event_after_write on public.statements;
create trigger sync_ppr_event_after_write
  after insert or update of document_type,payment_date,gross_ppr,credits,debits,net
  on public.statements
  for each row execute function public.sync_ppr_event_from_statement();
