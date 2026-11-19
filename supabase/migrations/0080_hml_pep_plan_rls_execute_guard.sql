-- HML: Restore EXECUTE needed by Storage/statement RLS while retaining
-- account isolation for the private SECURITY DEFINER plan evaluator.
CREATE OR REPLACE FUNCTION private.pep_plan_for_user(p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_paid integer:=0;v_promo integer:=0;v_trial integer:=0;
begin
 -- RLS needs authenticated EXECUTE; prohibit looking up other users' plans.
 if (auth.jwt()->>'role') is distinct from 'service_role'
   and ((select auth.uid()) is null or p_user_id is distinct from (select auth.uid())) then
  raise exception 'Plan access limited to own account' using errcode='42501';
 end if;
 if not exists(select 1 from public.app_members
  where user_id=p_user_id and active and status='approved') then return 'free'; end if;
 -- Admin rights are role-based, not paid entitlements.
 if exists(select 1 from public.app_members
  where user_id=p_user_id and role='admin' and active and status='approved')
 then return 'full'; end if;
 select coalesce(max(case s.plan_code when 'full' then 2 when 'basic' then 1 else 0 end),0)
 into v_paid from public.billing_subscriptions s
 where s.user_id=p_user_id and s.status='active'
 and (s.current_period_end is null or s.current_period_end>now());
 if exists(select 1 from public.billing_full_trials t where t.user_id=p_user_id
  and t.revoked_at is null and t.starts_at<=now() and t.ends_at>now())then v_trial:=2;end if;
 select coalesce(max(case r.plan_code when 'full' then 2 when 'basic' then 1 else 0 end),0)
 into v_promo from private.payrep_promo_redemptions r
 where r.user_id=p_user_id and r.started_at<=now() and r.ends_at>now();
 return case greatest(v_paid,v_trial,v_promo) when 2 then 'full' when 1 then 'basic' else 'free' end;
end
$function$;
revoke execute on function private.pep_plan_for_user(uuid) from public, anon;
grant execute on function private.pep_plan_for_user(uuid) to authenticated;
