-- Store the overall dependent count separately from IRRF-qualified dependents.
-- NULL means not present or not safely identified in the original payslip.
alter table public.statements
 add column dependents_total integer null
 constraint statements_dependents_total_check check(dependents_total between 0 and 30);
comment on column public.statements.dependents_total is
 'Total dependents on payslip (Dep.); distinct from dependents_irrf (Dep.IR).';
