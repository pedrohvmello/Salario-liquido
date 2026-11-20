-- HML. Preserve supplemental payroll documents without corrupting monthly figures.
-- Additional payment is counted only for the totalizadora; the difference and
-- retificadora PDFs remain evidence and never become additional cash receipts.
alter table public.statements
 drop constraint if exists statements_document_type_check;
alter table public.statements
 add constraint statements_document_type_check check (
 document_type in ('monthly','ppr','vacation','thirteenth','adjustment')
 );
alter table public.statements
 add column if not exists payroll_subtype text,
 add column if not exists source_periods text[] not null default '{}';
alter table public.statements
 add constraint statements_adjustment_subtype_valid check (
   (document_type='adjustment' and payroll_subtype in ('difference','rectification','totalizer'))
   or (document_type<>'adjustment' and payroll_subtype is null)
 );
alter table public.statements
 add constraint statements_adjustment_payment_required check (
   payroll_subtype<>'totalizer' or (
    payment_date is not null and credits>0 and debits>=0 and net>=0
    and abs(credits-debits-net)<=0.02
   )
 );
create unique index statements_totalizer_financial_identity
 on public.statements(user_id,period,payment_date,credits,debits,net)
 where document_type='adjustment' and payroll_subtype='totalizer' and duplicate_of is null;
comment on column public.statements.payroll_subtype is
 'Supplemental payroll: difference/rectification are evidence; totalizer is one paid adjustment.';
comment on column public.statements.source_periods is
 'Original competence(s) shown explicitly by the source or confirmed from a matching correction. Not inferred from the payment month.';
