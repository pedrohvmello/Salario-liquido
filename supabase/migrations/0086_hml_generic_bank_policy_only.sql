-- HML: freeze the user-selectable bank of hours profiles at Genérica.
-- Historical saved time movements are not rewritten.
do $$
begin
 if (select count(*) from public.bank_policy_profiles where is_default and active) <> 1 then
  raise exception 'Expected exactly one active default bank profile';
 end if;
end $$;

update public.user_bank_profile_selections
 set profile_id=(select id from public.bank_policy_profiles where is_default and active),
     selected_at=now()
 where profile_id<>(select id from public.bank_policy_profiles where is_default and active);

create or replace function private.restrict_bank_profile_to_generic()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_default uuid;
begin
 select p.id into v_default
 from public.bank_policy_profiles p
 where p.active=true and p.is_default=true;
 if v_default is null or new.profile_id is distinct from v_default then
  raise exception using errcode='23514',
   message='Somente a política Genérica está disponível nesta versão.';
 end if;
 return new;
end $$;

drop trigger if exists bank_profile_generic_only on public.user_bank_profile_selections;
create trigger bank_profile_generic_only
 before insert or update of profile_id on public.user_bank_profile_selections
 for each row execute function private.restrict_bank_profile_to_generic();
