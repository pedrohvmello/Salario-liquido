-- Performance enhancement for Supabase RLS evaluation; apply after 0001_init.sql.

alter policy "read own membership" on public.app_members using (user_id=(select auth.uid()));
alter policy "user_settings_owner" on public.user_settings
 using (user_id=(select auth.uid()) and exists(select 1 from public.app_members m where m.user_id=(select auth.uid()) and m.active))
 with check (user_id=(select auth.uid()) and exists(select 1 from public.app_members m where m.user_id=(select auth.uid()) and m.active));
alter policy "salary_events_owner" on public.salary_events
 using (user_id=(select auth.uid()) and exists(select 1 from public.app_members m where m.user_id=(select auth.uid()) and m.active))
 with check (user_id=(select auth.uid()) and exists(select 1 from public.app_members m where m.user_id=(select auth.uid()) and m.active));
alter policy "time_entries_owner" on public.time_entries
 using (user_id=(select auth.uid()) and exists(select 1 from public.app_members m where m.user_id=(select auth.uid()) and m.active))
 with check (user_id=(select auth.uid()) and exists(select 1 from public.app_members m where m.user_id=(select auth.uid()) and m.active));
alter policy "statements_owner" on public.statements
 using (user_id=(select auth.uid()) and exists(select 1 from public.app_members m where m.user_id=(select auth.uid()) and m.active))
 with check (user_id=(select auth.uid()) and exists(select 1 from public.app_members m where m.user_id=(select auth.uid()) and m.active));
alter policy "statement_lines_owner" on public.statement_lines
 using (user_id=(select auth.uid()) and exists(select 1 from public.statements s where s.id=statement_id and s.user_id=(select auth.uid())))
 with check (user_id=(select auth.uid()) and exists(select 1 from public.statements s where s.id=statement_id and s.user_id=(select auth.uid())));
alter policy "upload only own PDFs" on storage.objects
 with check (bucket_id='payslips' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.app_members m where m.user_id=(select auth.uid()) and m.active));
alter policy "read own PDFs" on storage.objects
 using (bucket_id='payslips' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.app_members m where m.user_id=(select auth.uid()) and m.active));
