-- User-provided figures transcribed from the employer's official annual income statement.
-- Never store source PDFs or CPF in this table. The original PDFs remain in private storage.
create table if not exists public.annual_tax_comparisons(
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_year integer not null check(calendar_year between 2000 and 2100),
  official_values jsonb not null default '{}'::jsonb
    check(jsonb_typeof(official_values)='object'),
  updated_at timestamptz not null default now(),
  primary key(user_id,calendar_year)
);
create index if not exists annual_tax_comparisons_user_year on public.annual_tax_comparisons(user_id,calendar_year);
alter table public.annual_tax_comparisons enable row level security;
create policy "annual_tax_comparisons_owner" on public.annual_tax_comparisons
  for all to authenticated
  using (user_id=(select auth.uid()) and exists(
    select 1 from public.app_members m where m.user_id=(select auth.uid()) and m.active))
  with check (user_id=(select auth.uid()) and exists(
    select 1 from public.app_members m where m.user_id=(select auth.uid()) and m.active));
revoke all on table public.annual_tax_comparisons from anon;
grant select,insert,update,delete on table public.annual_tax_comparisons to authenticated;
