-- HML only: apply confirmed recurring Asaas charges atomically and idempotently.
-- The authenticated webhook and a fresh Asaas API response must agree.
create or replace function public.apply_verified_asaas_renewal(
 p_subscription_id text,
 p_payment_id text,
 p_customer_id text,
 p_amount_cents integer,
 p_next_due_date date,
 p_payment_due_date date,
 p_payment_status text
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 v_sub public.billing_subscriptions%rowtype;
 v_amount integer;
 v_account uuid;
begin
 if (select auth.role())<>'service_role' then
  raise exception 'Privileged billing operation required' using errcode='42501';
 end if;
 if p_payment_status not in ('CONFIRMED','RECEIVED')
  or p_amount_cents is null or p_amount_cents<500
  or p_subscription_id !~ '^sub_[A-Za-z0-9_]{5,80}$'
  or p_payment_id !~ '^pay_[A-Za-z0-9_]{5,80}$'
  or p_customer_id !~ '^cus_[A-Za-z0-9_]{5,80}$'
  or p_next_due_date is null or p_payment_due_date is null then
  raise exception 'Invalid provider charge' using errcode='22023';
 end if;
 select * into v_sub from public.billing_subscriptions
  where provider='asaas' and provider_subscription_id=p_subscription_id
   and provider_customer_id=p_customer_id and plan_code in ('basic','full')
   for update;
 if not found or v_sub.status not in ('active','past_due') or v_sub.cancel_at_period_end then
  raise exception 'Unknown or canceled subscription' using errcode='23514';
 end if;
 if v_sub.current_period_end is null
  or p_payment_due_date < v_sub.current_period_end::date
  or p_next_due_date <= v_sub.current_period_end::date
  or p_next_due_date <= p_payment_due_date then
  -- Never advance the period from the initial payment or an older notification.
  return pg_catalog.jsonb_build_object('applied',false,'reason','not_new_period');
 end if;
 select i.amount_cents into v_amount
 from public.billing_webhook_events e
 join public.billing_checkout_intents i
  on i.provider_checkout_id=e.payload#>>'{subscription,checkoutSession}'
 where e.provider='asaas' and e.event_type='SUBSCRIPTION_CREATED'
  and e.payload#>>'{subscription,id}'=p_subscription_id
  and i.status='paid' and i.user_id=v_sub.user_id
 order by e.received_at desc limit 1;
 if v_amount is null or v_amount<>p_amount_cents then
  raise exception 'Charge differs from original contracted amount' using errcode='23514';
 end if;
 if not exists(
  select 1 from public.billing_webhook_events e
  where e.provider='asaas'
   and e.event_type in ('PAYMENT_CONFIRMED','PAYMENT_RECEIVED')
   and e.payload#>>'{payment,id}'=p_payment_id
   and e.payload#>>'{payment,subscription}'=p_subscription_id
   and e.payload#>>'{payment,customer}'=p_customer_id
   and e.payload#>>'{payment,value}' ~ '^[0-9]+([.][0-9]{1,2})?$'
   and ((e.payload#>>'{payment,value}')::numeric*100)::integer=p_amount_cents
 ) then
  raise exception 'Verified payment webhook missing' using errcode='23514';
 end if;
 if exists(select 1 from public.billing_payments where provider='asaas'
  and provider_payment_id=p_payment_id
  and user_id is distinct from v_sub.user_id) then
  raise exception 'Payment belongs to another account' using errcode='23514';
 end if;
 select id into v_account from public.billing_accounts where user_id=v_sub.user_id;
 if v_account is null then raise exception 'Billing account absent' using errcode='23514'; end if;
 insert into public.billing_payments
  (user_id,billing_account_id,provider,provider_payment_id,description,
   amount_cents,currency,status,due_at,paid_at)
 values (v_sub.user_id,v_account,'asaas',p_payment_id,
  'Payrep '||case when v_sub.plan_code='basic' then 'Basic' else 'Full' end||' (Sandbox)',
  p_amount_cents,'BRL','paid',
  (p_payment_due_date::timestamp+interval '12 hours') at time zone 'UTC',now())
 on conflict(provider,provider_payment_id) do update set
  status='paid',paid_at=coalesce(public.billing_payments.paid_at,excluded.paid_at);
 update public.billing_subscriptions set
  status='active',current_period_start=v_sub.current_period_end,
  current_period_end=(p_next_due_date::timestamp+interval '12 hours') at time zone 'UTC',
  updated_at=now()
 where user_id=v_sub.user_id and provider_subscription_id=p_subscription_id;

 update public.billing_webhook_events set processing_status='processed',
   processed_at=now(),last_error=null
 where provider='asaas' and event_type in ('PAYMENT_CONFIRMED','PAYMENT_RECEIVED')
  and payload#>>'{payment,id}'=p_payment_id;
 return pg_catalog.jsonb_build_object('applied',true,
  'plan',v_sub.plan_code,'newPeriodEnd',p_next_due_date);
end
$fn$;
revoke all on function public.apply_verified_asaas_renewal(
 text,text,text,integer,date,date,text) from public,anon,authenticated;
grant execute on function public.apply_verified_asaas_renewal(
 text,text,text,integer,date,date,text) to service_role;
