-- HML: private, explicitly saved Pep conversations. PDF and payroll records are not copied here.
create table if not exists public.pep_conversations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 mode text not null check (mode in ('help','personal')),
 title text not null check (char_length(title) between 1 and 120),
 messages jsonb not null check (
  jsonb_typeof(messages)='array'
  and jsonb_array_length(messages) between 1 and 100
  and octet_length(messages::text)<=100000
 ),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists pep_conversations_owner_updated_idx
 on public.pep_conversations(user_id,mode,updated_at desc);
alter table public.pep_conversations enable row level security;
create policy pep_conversations_select_own on public.pep_conversations
 for select to authenticated using ((select auth.uid())=user_id);
create policy pep_conversations_insert_own on public.pep_conversations
 for insert to authenticated with check ((select auth.uid())=user_id);
create policy pep_conversations_update_own on public.pep_conversations
 for update to authenticated using ((select auth.uid())=user_id)
 with check ((select auth.uid())=user_id);
create policy pep_conversations_delete_own on public.pep_conversations
 for delete to authenticated using ((select auth.uid())=user_id);
revoke all on public.pep_conversations from anon;
grant select,insert,update,delete on public.pep_conversations to authenticated;
