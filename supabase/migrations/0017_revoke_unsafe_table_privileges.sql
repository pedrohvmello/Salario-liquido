-- Phase 1 hardening: remove privileges not protected by RLS.
-- Tested on isolated HML first. Apply to PRD only after a separate GO.
revoke truncate, trigger, references on table
 public.annual_tax_comparisons,
 public.salary_events,
 public.statement_lines,
 public.statements,
 public.time_entries,
 public.user_settings
from anon, authenticated;

-- Prevent new application tables created by postgres from inheriting these grants.
alter default privileges for role postgres in schema public
 revoke truncate, trigger, references on tables from anon, authenticated;
