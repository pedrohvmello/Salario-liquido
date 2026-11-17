-- HML billing isolation. Broad FOR ALL MFA policies were permissive and,
-- together with SELECT grants, could expose other users' payment metadata.
drop policy if exists mfa_verified_billing_subscriptions on public.billing_subscriptions;
drop policy if exists mfa_verified_subscriptions on public.billing_subscriptions;
drop policy if exists billing_subscriptions_select on public.billing_subscriptions;
drop policy if exists billing_subscriptions_owner_read on public.billing_subscriptions;
create policy billing_subscriptions_owner_read
 on public.billing_subscriptions for select to authenticated
 using(user_id=(select auth.uid()) and (select private.current_mfa_satisfied()));

drop policy if exists mfa_verified_billing_payments on public.billing_payments;
drop policy if exists billing_payments_select on public.billing_payments;
drop policy if exists billing_payments_owner_read on public.billing_payments;
create policy billing_payments_owner_read
 on public.billing_payments for select to authenticated
 using(user_id=(select auth.uid()) and (select private.current_mfa_satisfied()));

revoke insert,update,delete,truncate on public.billing_subscriptions from anon,authenticated;
revoke insert,update,delete,truncate on public.billing_payments from anon,authenticated;
