-- HML: versioned per-user hour-bank policy.
-- The prior generated bank_delta_minutes remains for compatibility; the official
-- cumulative balance now uses bank_weighted_minutes, snapshotted on each entry.
create table public.time_bank_policies (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 3 and 140),
 source_reference text not null default '' check (char_length(source_reference) <= 350),
 valid_from date not null,
 valid_until date not null,
 weekday_factor numeric(4,2) not null default 1,
 saturday_factor numeric(4,2) not null default 1,
 sunday_factor numeric(4,2) not null default 2,
 holiday_factor numeric(4,2) not null default 2,
 daily_target_minutes integer not null default 480,
 settlement_interval_months integer not null default 6,
 settlement_months smallint[] not null default array[2,8]::smallint[],
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint bank_policy_dates check (valid_until>=valid_from),
 constraint bank_policy_target check (daily_target_minutes between 60 and 720),
 constraint bank_policy_factor check (
  weekday_factor between 0.25 and 4 and saturday_factor between 0.25 and 4
  and sunday_factor between 0.25 and 4 and holiday_factor between 0.25 and 4
 ),
 constraint bank_policy_settlement_interval check (settlement_interval_months between 1 and 12),
 constraint bank_policy_settlement_months check (
   cardinality(settlement_months) between 1 and 12
   and settlement_months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]
 )
);
create index time_bank_policies_user_dates on public.time_bank_policies(user_id, valid_from, valid_until);
alter table public.time_bank_policies enable row level security;
create policy "hour bank policies visible to owner and admin" on public.time_bank_policies
 for select to authenticated using ((select auth.uid())=user_id or (select public.is_app_admin()));
create policy "hour bank policies insert by admin" on public.time_bank_policies
 for insert to authenticated with check ((select public.is_app_admin()));
create policy "hour bank policies update by admin" on public.time_bank_policies
 for update to authenticated
 using ((select public.is_app_admin())) with check ((select public.is_app_admin()));
grant select,insert,update on public.time_bank_policies to authenticated;
revoke delete on public.time_bank_policies from authenticated,anon;

alter table public.time_entries
 add column bank_weighted_minutes integer not null default 0,
 add column bank_policy_id uuid references public.time_bank_policies(id) on delete restrict;

create function private.payrep_check_bank_policy_ranges()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text,741021));
 if exists (
  select 1 from public.time_bank_policies p
  where p.user_id=new.user_id and p.id<>new.id
   and p.valid_from<=new.valid_until and p.valid_until>=new.valid_from
 ) then
  raise exception using errcode='23514',message='Políticas de Banco de Horas não podem ter vigências sobrepostas.';
 end if;
 if tg_op='UPDATE' and (
  old.user_id is distinct from new.user_id
  or old.valid_from is distinct from new.valid_from
  or old.valid_until is distinct from new.valid_until
  or old.weekday_factor is distinct from new.weekday_factor
  or old.saturday_factor is distinct from new.saturday_factor
  or old.sunday_factor is distinct from new.sunday_factor
  or old.holiday_factor is distinct from new.holiday_factor
  or old.daily_target_minutes is distinct from new.daily_target_minutes
 ) and exists (
  select 1 from public.time_entries t
  where t.user_id=old.user_id and t.bank_policy_id=old.id
 ) then
  raise exception using errcode='23514',message='Política já utilizada: crie uma nova vigência para preservar o histórico do Banco de Horas.';
 end if;
 new.updated_at:=now();
 return new;
end;
$$;
create trigger payrep_check_bank_policy_ranges before insert or update
 on public.time_bank_policies for each row execute function private.payrep_check_bank_policy_ranges();

create function private.payrep_apply_bank_policy()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
 p public.time_bank_policies%rowtype;
 worked integer;
 overtime_minutes integer;
 is_weekend boolean;
 multiplier numeric(4,2);
begin
 new.bank_weighted_minutes:=0;
 new.bank_policy_id:=null;
 if new.holiday_override is not null then new.effective_holiday:=new.holiday_override; end if;
 if not new.bank_hours or new.start_at is null or new.lunch_start is null
  or new.lunch_end is null or new.end_at is null then return new; end if;
 select * into p from public.time_bank_policies
 where user_id=new.user_id and valid_from<=new.date and valid_until>=new.date
 order by valid_from desc limit 1;
 if not found then
  raise exception using errcode='23514',
  message='Sem política de Banco de Horas vigente para '||to_char(new.date,'DD/MM/YYYY')||'.';
 end if;
 worked:=(extract(epoch from ((new.lunch_start-new.start_at)+(new.end_at-new.lunch_end)))/60)::integer
   + new.additional_minutes;
 if worked<0 or worked>1440 then raise exception using errcode='23514',message='Jornada inválida para Banco de Horas.';end if;
 is_weekend:=extract(isodow from new.date) in (6,7);
 if new.effective_holiday then
  overtime_minutes:=worked;multiplier:=p.holiday_factor;
 elsif extract(isodow from new.date)=7 then
  overtime_minutes:=worked;multiplier:=p.sunday_factor;
 elsif extract(isodow from new.date)=6 then
  overtime_minutes:=worked;multiplier:=p.saturday_factor;
 else
  overtime_minutes:=worked-p.daily_target_minutes;
  multiplier:=p.weekday_factor;
 end if;
 if overtime_minutes>=0 then
  new.bank_weighted_minutes:=round(overtime_minutes::numeric*multiplier)::integer;
 else
  new.bank_weighted_minutes:=overtime_minutes;
 end if;
 new.bank_policy_id:=p.id;
 return new;
end;
$$;
create trigger payrep_apply_bank_policy before insert or update on public.time_entries
 for each row execute function private.payrep_apply_bank_policy();

-- Preserve the existing deferred credit-availability guard, but check the weighted
-- balance, including retroactive edits across all historical periods.
create or replace function public.payrep_assert_time_bank_nonnegative()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
 v_user uuid;
 v_invalid_date date;
begin
 v_user:=case when tg_op='DELETE' then old.user_id else new.user_id end;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,741020));
 select q.date into v_invalid_date from (
  select t.date, sum(t.bank_weighted_minutes) over (order by t.date rows unbounded preceding) as balance
  from public.time_entries t where t.user_id=v_user
 ) q where q.balance<0 order by q.date limit 1;
 if v_invalid_date is not null then
  raise exception using errcode='23514',
   message='Banco de Horas insuficiente em '||to_char(v_invalid_date,'DD/MM/YYYY')||'.';
 end if;
 return null;
end;
$$;
revoke all on function public.payrep_assert_time_bank_nonnegative() from public;
revoke all on function private.payrep_check_bank_policy_ranges() from public;
revoke all on function private.payrep_apply_bank_policy() from public;
