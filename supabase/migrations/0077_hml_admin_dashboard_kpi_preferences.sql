-- Per-administrator color, visibility and order of User Management KPIs.
-- Does not modify account/employee data or salary settings.
create table public.admin_dashboard_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 card_order text[] not null default array[
  'registered','approved','pending','blocked','sessions30d',
  'uniqueUsers30d','free','basic','full','locations'
 ]::text[],
 card_colors jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now(),
 constraint admin_kpi_order_allowed check(
  cardinality(card_order)<=10 and
  card_order <@ array[
   'registered','approved','pending','blocked','sessions30d',
   'uniqueUsers30d','free','basic','full','locations'
  ]::text[]),
 constraint admin_kpi_colors_object check(jsonb_typeof(card_colors)='object')
);
alter table public.admin_dashboard_preferences enable row level security;
create policy "Admin reads own dashboard cards" on public.admin_dashboard_preferences
 for select to authenticated
 using(user_id=(select auth.uid()) and (select public.is_app_admin()));
create policy "Admin creates own dashboard cards" on public.admin_dashboard_preferences
 for insert to authenticated
 with check(user_id=(select auth.uid()) and (select public.is_app_admin()));
create policy "Admin changes own dashboard cards" on public.admin_dashboard_preferences
 for update to authenticated
 using(user_id=(select auth.uid()) and (select public.is_app_admin()))
 with check(user_id=(select auth.uid()) and (select public.is_app_admin()));
grant select,insert,update on public.admin_dashboard_preferences to authenticated;
