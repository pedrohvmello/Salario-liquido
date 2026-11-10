-- User-selected work base, identified by official Brazilian IBGE municipality code.
-- This is separate from salary formulas and does not affect existing parameters.
alter table public.user_settings add column if not exists base_city jsonb;
alter table public.user_settings add constraint user_settings_base_city_check
check (
 base_city is null or (
  jsonb_typeof(base_city)='object'
  and length(coalesce(base_city->>'city','')) between 1 and 120
  and (base_city->>'uf') ~ '^[A-Z]{2}$'
  and (base_city->>'ibge') ~ '^[0-9]{7}$'
 )
);
