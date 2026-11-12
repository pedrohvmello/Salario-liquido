-- Payrep HML: tickets with per-user isolation and admin triage.
-- No service-role keys or outgoing mail credentials in the frontend.
create table if not exists public.support_tickets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 category text not null check (category in ('acesso','holerites','calculos','conta','outro')),
 subject text not null check (char_length(btrim(subject)) between 5 and 120),
 description text not null check (char_length(btrim(description)) between 20 and 4000),
 status text not null default 'open' check (status in ('open','in_progress','resolved')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists support_tickets_user_created_idx on public.support_tickets (user_id, created_at desc);
create index if not exists support_tickets_status_created_idx on public.support_tickets (status, created_at desc);
alter table public.support_tickets enable row level security;
revoke all on public.support_tickets from anon;
grant select, insert, update on public.support_tickets to authenticated;

create policy "support_tickets_insert_owner" on public.support_tickets
 for insert to authenticated
 with check (
   user_id=(select auth.uid())
   and (select private.current_mfa_satisfied())
   and exists (
      select 1 from public.app_members m
      where m.user_id=(select auth.uid()) and m.active and m.status='approved'
   )
 );
create policy "support_tickets_read_owner_or_admin" on public.support_tickets
 for select to authenticated
 using (
  (select private.current_mfa_satisfied())
  and (user_id=(select auth.uid()) or (select private.is_current_admin()))
 );
create policy "support_tickets_update_admin" on public.support_tickets
 for update to authenticated
 using ((select private.is_current_admin()))
 with check ((select private.is_current_admin()));
-- Only admins can update existing tickets. No direct client deletion.
