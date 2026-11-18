-- HML: make the settlement fortnight explicit in administrative policy metadata.
-- Settlement remains informational until a controlled reconciliation workflow is available.
alter table public.time_bank_policies
 add column settlement_half smallint not null default 1
 check (settlement_half in (1,2));