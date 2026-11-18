-- HML: negative bank balances represent hours owed and are allowed.
-- The BEFORE trigger still computes each signed movement and retains its
-- historic policy snapshot. Only the deferred nonnegative check is removed.
drop trigger if exists time_entries_bank_nonnegative on public.time_entries;
drop function if exists public.payrep_assert_time_bank_nonnegative();
