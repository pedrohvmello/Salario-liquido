-- HML: allow saving partial workday rows in the fortnight timesheet.
-- Original rows remain intact; the calendar/payroll calculation still ignores incomplete rows.
alter table public.time_entries
 alter column start_at drop not null,
 alter column lunch_start drop not null,
 alter column lunch_end drop not null,
 alter column end_at drop not null;

alter table public.time_entries
 add column if not exists additional_minutes integer not null default 0,
 add column if not exists comments text;

do $$
begin
 if not exists (select 1 from pg_constraint where conrelid='public.time_entries'::regclass
  and conname='time_entries_additional_minutes_range') then
  alter table public.time_entries add constraint time_entries_additional_minutes_range
   check (additional_minutes between 0 and 1439);
 end if;
 if not exists (select 1 from pg_constraint where conrelid='public.time_entries'::regclass
  and conname='time_entries_comments_length') then
  alter table public.time_entries add constraint time_entries_comments_length
   check (comments is null or char_length(comments) <= 500);
 end if;
end
$$;
