-- Dedicated optional vacation receipts coexist with regular payroll and PPR.
-- Do not sum vacation PDF totals into monthly credits or tax bases.
-- Cash reconciliation is computed from authenticated user's statement lines.
alter table public.statements
 drop constraint if exists statements_document_type_check;
alter table public.statements
 add constraint statements_document_type_check
 check (document_type in ('monthly','ppr','vacation'));
alter table public.statements
 add column if not exists vacation_start date,
 add column if not exists vacation_end date;
alter table public.statements
 add constraint statements_vacation_dates_check check (
   (document_type <> 'vacation' and vacation_start is null and vacation_end is null)
   or (document_type = 'vacation' and vacation_start is not null and vacation_end is not null
      and vacation_end >= vacation_start and payment_date is not null)
 );
create index if not exists statements_vacation_period
 on public.statements(user_id,vacation_start,vacation_end)
 where document_type='vacation';
