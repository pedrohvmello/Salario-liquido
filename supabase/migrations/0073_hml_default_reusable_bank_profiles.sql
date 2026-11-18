-- HML: reusable hour-bank profiles with automatic Generic assignment.
-- Existing weighted time entries remain unchanged; only new/edited entries use the selection.
create table public.bank_policy_profiles (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,60}$'),
 name text not null check (char_length(trim(name)) between 3 and 100),
 description text not null default '',
 source_note text not null default '',
 source_version_id uuid unique references public.collective_profile_versions(id) on delete restrict,
 valid_from date not null default date '2000-01-01',
 valid_until date not null default date '2099-12-31',
 weekday_factor numeric(4,2) not null default 1 check (weekday_factor between 0.25 and 4),
 saturday_factor numeric(4,2) not null default 1 check (saturday_factor between 0.25 and 4),
 sunday_factor numeric(4,2) not null default 2 check (sunday_factor between 0.25 and 4),
 holiday_factor numeric(4,2) not null default 2 check (holiday_factor between 0.25 and 4),
 daily_target_minutes integer not null default 480 check (daily_target_minutes between 60 and 720),
 settlement_interval_months integer not null default 6 check (settlement_interval_months between 1 and 12),
 settlement_months smallint[] not null default array[2,8]::smallint[],
 settlement_half smallint not null default 1 check (settlement_half in (1,2)),
 verified boolean not null default false,
 active boolean not null default true,
 is_default boolean not null default false,
 created_at timestamptz not null default now(),
 constraint bank_profile_dates check (valid_from<=valid_until),
 constraint bank_profile_settlement_months check (cardinality(settlement_months) between 1 and 12 and settlement_months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]),
 constraint bank_profile_verify_source check (not verified or source_version_id is not null)
);
create unique index bank_profile_only_one_default on public.bank_policy_profiles(is_default) where is_default=true;
insert into public.bank_policy_profiles(
 slug,name,description,source_note,weekday_factor,saturday_factor,sunday_factor,holiday_factor,
 daily_target_minutes,is_default,verified
) values (
 'generica','Genérica',
 'Política padrão para novos usuários; regras ilustrativas que devem ser conferidas com o acordo aplicável.',
 'Critérios iniciais semelhantes ao ACT histórico da Accenture/SP: não constituem enquadramento trabalhista.',
 1,1,2,2,480,true,false
);
create table public.user_bank_profile_selections (
 user_id uuid primary key references auth.users(id) on delete cascade,
 profile_id uuid not null references public.bank_policy_profiles(id) on delete restrict,
 selected_at timestamptz not null default now()
);
create index user_bank_profile_selected on public.user_bank_profile_selections(profile_id);
alter table public.time_entries
 add column if not exists bank_profile_id uuid references public.bank_policy_profiles(id) on delete restrict;

alter table public.bank_policy_profiles enable row level security;
alter table public.user_bank_profile_selections enable row level security;
create policy "available bank profiles visible to users" on public.bank_policy_profiles
 for select to authenticated using(active=true or (select public.is_app_admin()));
create policy "bank profiles admin insert" on public.bank_policy_profiles
 for insert to authenticated with check((select public.is_app_admin()));
create policy "bank profiles admin update" on public.bank_policy_profiles
 for update to authenticated using((select public.is_app_admin())) with check((select public.is_app_admin()));
create policy "selected bank profile owner view" on public.user_bank_profile_selections
 for select to authenticated using(user_id=(select auth.uid()) or (select public.is_app_admin()));
grant select,insert,update on public.bank_policy_profiles to authenticated;
grant select on public.user_bank_profile_selections to authenticated;

-- The default applies at registration, regardless of the approval state.
create function private.payrep_assign_default_bank_profile()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.user_bank_profile_selections(user_id,profile_id)
 select new.id,id from public.bank_policy_profiles where is_default=true
 on conflict(user_id) do nothing;
 return new;
end $$;
create trigger payrep_auth_default_bank_profile after insert on auth.users
 for each row execute function private.payrep_assign_default_bank_profile();
insert into public.user_bank_profile_selections(user_id,profile_id)
select u.id,p.id from auth.users u cross join public.bank_policy_profiles p
where p.is_default=true on conflict(user_id) do nothing;
revoke all on function private.payrep_assign_default_bank_profile() from public;

-- A user changes only their own selection. Do not recalculate recorded days.
create function public.select_my_bank_profile(p_profile_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid();
begin
 if v_user is null or not exists(
  select 1 from public.app_members m where m.user_id=v_user
   and m.active=true and m.status='approved'
 ) or not private.current_mfa_satisfied() then
  raise exception using errcode='42501',message='Conta não autorizada.';
 end if;
 if not exists(select 1 from public.bank_policy_profiles p
  where p.id=p_profile_id and p.active=true
    and p.valid_from<=current_date and p.valid_until>=current_date) then
  raise exception using errcode='23514',message='Perfil inexistente ou sem vigência atual.';
 end if;
 insert into public.user_bank_profile_selections(user_id,profile_id,selected_at)
 values(v_user,p_profile_id,now())
 on conflict(user_id) do update set profile_id=excluded.profile_id,selected_at=excluded.selected_at;
 return p_profile_id;
end $$;
revoke all on function public.select_my_bank_profile(uuid) from public,anon;
grant execute on function public.select_my_bank_profile(uuid) to authenticated;

-- Protect historical factors once a profile has been used in time entries.
create function private.payrep_protect_bank_profile()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.is_default and (new.is_default is distinct from old.is_default or new.active is distinct from true) then
  raise exception using errcode='23514',message='O perfil Genérica deve permanecer padrão e ativo.';
 end if;
 if (old.weekday_factor,old.saturday_factor,old.sunday_factor,old.holiday_factor,
    old.daily_target_minutes,old.valid_from,old.valid_until)
 is distinct from
    (new.weekday_factor,new.saturday_factor,new.sunday_factor,new.holiday_factor,
    new.daily_target_minutes,new.valid_from,new.valid_until)
 and exists(select 1 from public.time_entries e where e.bank_profile_id=old.id) then
  raise exception using errcode='23514',message='Perfil já utilizado: crie uma nova versão para preservar o histórico.';
 end if;
 return new;
end $$;
create trigger payrep_protect_bank_profile before update on public.bank_policy_profiles
 for each row execute function private.payrep_protect_bank_profile();
revoke all on function private.payrep_protect_bank_profile() from public;

-- A verified publication becomes an available reusable profile, never a new user assignment.
create function private.payrep_publish_bank_catalog_version()
returns trigger language plpgsql security invoker set search_path='' as $$
declare v public.collective_profiles%rowtype;
begin
 select * into v from public.collective_profiles where id=new.profile_id;
 insert into public.bank_policy_profiles(
  slug,name,description,source_note,source_version_id,valid_from,valid_until,
  weekday_factor,saturday_factor,sunday_factor,holiday_factor,daily_target_minutes,
  settlement_interval_months,settlement_months,settlement_half,verified,active
 ) values(
  'official-'||replace(new.id::text,'-',''),v.name,
  v.organization||' / '||v.uf||' · versão '||new.version,
  'Acordo verificado pela biblioteca Payrep',new.id,new.valid_from,new.valid_until,
  new.weekday_factor,new.saturday_factor,new.sunday_factor,new.holiday_factor,
  new.daily_target_minutes,new.settlement_interval_months,new.settlement_months,
  new.settlement_half,true,true
 ) on conflict(source_version_id) do nothing;
 return new;
end $$;
create trigger payrep_catalog_profile_on_version
 after insert on public.collective_profile_versions
 for each row execute function private.payrep_publish_bank_catalog_version();
revoke all on function private.payrep_publish_bank_catalog_version() from public;

-- A flagged fully blank weekday is a full-day compensated absence. Partial clock
-- rows remain drafts; unchecked entries never debit the hour bank.
create or replace function private.payrep_apply_bank_policy()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
 p public.bank_policy_profiles%rowtype;
 worked integer;
 overtime_minutes integer;
 multiplier numeric(4,2);
 is_blank boolean;
begin
 new.bank_weighted_minutes:=0;
 new.bank_policy_id:=null;
 new.bank_profile_id:=null;
 if new.holiday_override is not null then new.effective_holiday:=new.holiday_override; end if;
 if not new.bank_hours then return new; end if;

 is_blank:=new.start_at is null and new.lunch_start is null
  and new.lunch_end is null and new.end_at is null
  and coalesce(new.additional_minutes,0)=0;
 if not is_blank and (
  new.start_at is null or new.lunch_start is null
  or new.lunch_end is null or new.end_at is null
 ) then return new; end if;

 select profile.* into p
 from public.bank_policy_profiles profile
 join public.user_bank_profile_selections choice on choice.profile_id=profile.id
 where choice.user_id=new.user_id
   and profile.active=true
   and profile.valid_from<=new.date and profile.valid_until>=new.date
 limit 1;
 if not found then
  raise exception using errcode='23514',
  message='Nenhum perfil de Banco de Horas vigente para '||to_char(new.date,'DD/MM/YYYY')||'.';
 end if;
 worked:=case when is_blank then 0 else
  (extract(epoch from ((new.lunch_start-new.start_at)+(new.end_at-new.lunch_end)))/60)::integer
   + coalesce(new.additional_minutes,0) end;
 if worked<0 or worked>1440 then
  raise exception using errcode='23514',message='Jornada inválida para Banco de Horas.';
 end if;
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
 new.bank_weighted_minutes:=case when overtime_minutes>=0
  then round(overtime_minutes::numeric*multiplier)::integer
  else overtime_minutes end;
 new.bank_profile_id:=p.id;
 return new;
end $$;
