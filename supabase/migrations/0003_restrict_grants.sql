-- Defense in depth: anon role has no table privileges; membership read-only from client.

revoke all on table public.app_members, public.user_settings, public.salary_events, public.time_entries, public.statements, public.statement_lines from anon;
revoke insert, update, delete, truncate, references, trigger on public.app_members from authenticated;
grant select on public.app_members to authenticated;
