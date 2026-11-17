-- HML: a verified OVERDUE recurring invoice is recorded as failed.
-- Only mark the subscription past_due after the already-paid period ends.
create or replace function public.apply_verified_asaas_overdue(
 p_subscription_id text,
 p_payment_id text,
 p_customer_id text,
 p_amount_cents integer,
 p_payment_due_date date
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 v_sub public.billing_subscriptions%rowtype;
 v_expected integer;
 v_account uuid;
begin
 if (select auth.role())<>'service_role' then
  raise exception 'Service role required' using errcode='42501'; end if;
 if p_subscription_id !~ '^sub_[A-Za-z0-9_]{5,80}$'
  or p_payment_id !~ '^pay_[A-Za-z0-9_]{5,80}$'
  or p_customer_id !~ '^cus_[A-Za-z0-9_]{5,80}$'
  or p_amount_cents is null or p_amount_cents<500
  or p_payment_due_date is null then
  raise exception 'Invalid overdue payment data' using errcode='22023';end if;
 select * into v_sub from public.billing_subscriptions
  where provider='asaas' and provider_subscription_id=p_subscription_id
    and provider_customer_id=p_customer_id and plan_code in ('basic','full')
  for update;
 if not found then return pg_catalog.jsonb_build_object('applied',false,'reason','unknown_subscription');end if;
 select i.amount_cents into v_expected
 from public.billing_checkout_intents i
 join public.billing_webhook_events e
  on e.payload#>>'{subscription,checkoutSession}'=i.provider_checkout_id
 where e.provider='asaas' and e.event_type='SUBSCRIPTION_CREATED'
  and e.payload#>>'{subscription,id}'=p_subscription_id
  and i.user_id=v_sub.user_id and i.status='paid'
 order by e.received_at desc limit 1;
 if v_expected is null or v_expected<>p_amount_cents then
  raise exception 'Charge differs from contracted amount' using errcode='23514';end if;
 if not exists(select 1 from public.billing_webhook_events e
  where e.provider='asaas' and e.event_type='PAYMENT_OVERDUE'
   and e.payload#>>'{payment,id}'=p_payment_id
   and e.payload#>>'{payment,subscription}'=p_subscription_id
   and e.payload#>>'{payment,customer}'=p_customer_id) then
  raise exception 'No matching overdue event' using errcode='23514';end if;
 if exists(select 1 from public.billing_payments p
  where p.provider='asaas' and p.provider_payment_id=p_payment_id
   and p.user_id is distinct from v_sub.user_id) then
  raise exception 'Payment linked to another account' using errcode='23514';end if;
 select id into v_account from public.billing_accounts where user_id=v_sub.user_id;
 if v_account is null then raise exception 'Billing account missing' using errcode='23514';end if;
 insert into public.billing_payments
  (user_id,billing_account_id,provider,provider_payment_id,description,
   amount_cents,currency,status,due_at)
 values(v_sub.user_id,v_account,'asaas',p_payment_id,'Cobrança vencida (Asaas Sandbox)',
  p_amount_cents,'BRL','failed',
  (p_payment_due_date::timestamp+interval '12 hours') at time zone 'UTC')
 on conflict(provider,provider_payment_id) do update set status='failed'
  where public.billing_payments.status not in ('paid','refunded');
 update public.billing_subscriptions
  set status='past_due',updated_at=now()
  where user_id=v_sub.user_id and provider_subscription_id=p_subscription_id
   and status='active' and cancel_at_period_end=false
   and current_period_end<now();
 update public.billing_webhook_events
  set processing_status='processed',processed_at=now(),last_error=null
  where provider='asaas' and event_type='PAYMENT_OVERDUE'
   and payload#>>'{payment,id}'=p_payment_id;
 return pg_catalog.jsonb_build_object('applied',true);
end
$fn$;
revoke all on function public.apply_verified_asaas_overdue(
 text,text,text,integer,date) from public,anon,authenticated;
grant execute on function public.apply_verified_asaas_overdue(
 text,text,text,integer,date) to service_role;
