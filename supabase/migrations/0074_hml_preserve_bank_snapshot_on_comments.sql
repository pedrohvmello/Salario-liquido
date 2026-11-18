-- HML: prevent unrelated edits from recomputing historic bank movements.
-- The older per-user assignment API is retired in favor of reusable profiles.
revoke execute on function public.assign_my_collective_profile_version(uuid) from authenticated;
revoke insert,update on public.time_bank_policies from authenticated;

create or replace function private.payrep_apply_bank_policy()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
 p public.bank_policy_profiles%rowtype;
 worked integer;
 overtime_minutes integer;
 multiplier numeric(4,2);
 is_blank boolean;
begin
 -- A comment-only save (or other unrelated edit) must not change a recorded
 -- policy snapshot, even if the user selected a different profile since then.
 if tg_op='UPDATE' and
  old.date is not distinct from new.date and
  old.user_id is not distinct from new.user_id and
  old.bank_hours is not distinct from new.bank_hours and
  old.start_at is not distinct from new.start_at and
  old.lunch_start is not distinct from new.lunch_start and
  old.lunch_end is not distinct from new.lunch_end and
  old.end_at is not distinct from new.end_at and
  old.additional_minutes is not distinct from new.additional_minutes and
  old.holiday_override is not distinct from new.holiday_override and
  old.effective_holiday is not distinct from new.effective_holiday
 then
  new.bank_weighted_minutes:=old.bank_weighted_minutes;
  new.bank_policy_id:=old.bank_policy_id;
  new.bank_profile_id:=old.bank_profile_id;
  return new;
 end if;
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
