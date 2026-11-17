-- HML: read the actual Supabase Auth minimum even if it is the platform's
-- default 6 characters. Stronger 8+ passwords remain recommended.
-- This changes only the Payrep mirror constraint, not the Auth configuration.
alter table public.payrep_password_policy
 drop constraint if exists payrep_password_policy_min_length_check;
alter table public.payrep_password_policy
 add constraint payrep_password_policy_min_length_check
 check (min_length between 6 and 128);