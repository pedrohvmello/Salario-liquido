-- Historical total received = closing payroll net + salary advance previously paid.
-- Does NOT add vacation/13th salary advance; original printed net remains untouched.
alter table public.statements
 add column if not exists salary_advance numeric(16,2),
 add column if not exists net_received numeric(16,2);

alter table public.statements
 add constraint statements_salary_advance_positive check (salary_advance is null or salary_advance >= 0),
 add constraint statements_net_received_matches_advance check (
   net_received is null or (
     net is not null and salary_advance is not null
     and net_received = net + salary_advance
   )
 );
