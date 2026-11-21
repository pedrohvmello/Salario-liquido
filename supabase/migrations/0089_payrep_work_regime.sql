-- Work-regime preference is independent of salaries, time-entry history and bank policies.
-- Existing users stay in the regular regime.
alter table public.user_settings
 add column if not exists work_regime text not null default 'regular';
alter table public.user_settings
 drop constraint if exists user_settings_work_regime_check;
alter table public.user_settings
 add constraint user_settings_work_regime_check check (work_regime in ('regular','trust'));
comment on column public.user_settings.work_regime is
 'User-selected presentation: regular hours and bank calculations, or trust role without overtime or new bank accrual. Historical time entries are never rewritten.';
