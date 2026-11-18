-- HML only. Banco de horas is a cumulative signed-minute ledger derived from
-- completed days. Legacy rows default to paid overtime, without bank credits.
alter table public.time_entries
 add column if not exists bank_hours boolean not null default false,
 add column if not exists effective_holiday boolean not null default false;

alter table public.time_entries
 add column if not exists bank_delta_minutes integer generated always as (
  case
   when bank_hours
    and start_at is not null and lunch_start is not null
    and lunch_end is not null and end_at is not null
   then
    (extract(epoch from ((lunch_start - start_at) + (end_at - lunch_end))) / 60)::integer
     + additional_minutes
     - case when effective_holiday or extract(isodow from date) in (6,7) then 0 else 480 end
   else 0
  end
 ) stored;

alter table public.time_entries
 add constraint time_entries_bank_complete_order_check check (
  start_at is null or lunch_start is null or lunch_end is null or end_at is null
  or (
    start_at <= lunch_start and lunch_start <= lunch_end and lunch_end <= end_at
    and (extract(epoch from ((lunch_start - start_at) + (end_at - lunch_end))) / 60)
         + additional_minutes between 0 and 1440
  )
 );

-- A deferred constraint validates the entire updated ledger in chronological
-- order at transaction end, so simultaneous edits in a fortnight are atomic.
create function public.payrep_assert_time_bank_nonnegative()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
 v_user uuid;
 v_invalid_date date;
begin
 v_user := case when tg_op='DELETE' then old.user_id else new.user_id end;
 perform pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(v_user::text, 741020)
 );
 select q.date into v_invalid_date
 from (
  select t.date,
   sum(t.bank_delta_minutes) over(order by t.date rows unbounded preceding) as running_minutes
  from public.time_entries t where t.user_id=v_user
 ) q where q.running_minutes < 0
 order by q.date limit 1;
 if v_invalid_date is not null then
  raise exception using errcode='23514',
    message='Banco de horas insuficiente em '||to_char(v_invalid_date,'DD/MM/YYYY')||'.';
 end if;
 return null;
end;
$$;

revoke all on function public.payrep_assert_time_bank_nonnegative() from public;
create constraint trigger time_entries_bank_nonnegative
after insert or update or delete on public.time_entries
deferrable initially deferred
for each row
execute function public.payrep_assert_time_bank_nonnegative();
