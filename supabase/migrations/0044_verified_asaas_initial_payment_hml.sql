-- Payrep HML: atomically materialize one verified first recurring payment.
-- This function can only be called with the server-side Supabase service role.
-- The caller verifies fresh Asaas API status and billing amount, while SQL
-- independently checks that the user, checkout and provider resource chain
-- match authenticated, previously stored Asaas webhook events.
create or replace function public.apply_verified_asaas_initial_payment(
 p_intent_id uuid,
 p_subscription_id text,
 p_payment_id text,
 p_customer_id text,
 p_amount_cents integer,
 p_next_due_date date,
 p_payment_due_date date,
 p_payment_status text
)
returns jsonb
language plpgsql security definer
set search_path=''
as $function$
declare
 v_intent public.billing_checkout_intents%rowtype;
 v_account uuid;
 v_plan text;
begin
 if (select auth.role()) <> 'service_role' then
  raise exception 'Service role required' using errcode='42501';
 end if;
 if p_intent_id is null or
    p_subscription_id !~ '^sub_[A-Za-z0-9_]{5,80}$' or
    p_payment_id !~ '^pay_[A-Za-z0-9_]{5,80}$' or
    p_customer_id !~ '^cus_[A-Za-z0-9_]{5,80}$' or
    p_payment_status not in ('CONFIRMED','RECEIVED') or
    p_amount_cents is null or p_amount_cents<=0 or
    p_next_due_date is null or p_next_due_date < current_date or
    p_payment_due_date is null then
  raise exception 'Invalid verified provider payment data' using errcode='22023';
 end if;

 select * into v_intent from public.billing_checkout_intents
 where id=p_intent_id for update;
 if not found or v_intent.provider<>'asaas' or v_intent.status<>'paid'
  or v_intent.provider_checkout_id is null
  or v_intent.amount_cents<>p_amount_cents
  or v_intent.currency<>'BRL'
  or v_intent.plan_code not in ('basic','full') then
  raise exception 'Checkout not eligible for settlement' using errcode='23514';
 end if;
 v_plan:=v_intent.plan_code;

 -- This specific checkout was paid, using the exact internal intent as
 -- provider externalReference. A redirect/query-string is never sufficient.
 if not exists(select 1 from public.billing_webhook_events e
  where e.provider='asaas' and e.event_type='CHECKOUT_PAID'
   and e.payload#>>'{checkout,id}'=v_intent.provider_checkout_id
   and e.payload#>>'{checkout,externalReference}'=v_intent.id::text
   and e.payload#>>'{checkout,status}'='PAID') then
  raise exception 'Missing verified checkout-paid event' using errcode='23514';
 end if;

 -- The created subscription must identify this checkout and amount. Do not
 -- infer owner from a customer-supplied email, name or payment callback.
 if not exists(select 1 from public.billing_webhook_events e
  where e.provider='asaas' and e.event_type='SUBSCRIPTION_CREATED'
   and e.payload#>>'{subscription,id}'=p_subscription_id
   and e.payload#>>'{subscription,checkoutSession}'=v_intent.provider_checkout_id
   and e.payload#>>'{subscription,customer}'=p_customer_id
   and e.payload#>>'{subscription,status}'='ACTIVE'
   and e.payload#>>'{subscription,cycle}'='MONTHLY'
   and e.payload#>>'{subscription,value}' ~ '^[0-9]+([.][0-9]{1,2})?$'
   and ((e.payload#>>'{subscription,value}')::numeric*100)::integer=p_amount_cents) then
  raise exception 'Subscription is not linked to paid checkout' using errcode='23514';
 end if;

 -- First payment event must belong to the same checkout and subscription.
 if not exists(select 1 from public.billing_webhook_events e
  where e.provider='asaas' and e.event_type='PAYMENT_CREATED'
   and e.payload#>>'{payment,id}'=p_payment_id
   and e.payload#>>'{payment,checkoutSession}'=v_intent.provider_checkout_id
   and e.payload#>>'{payment,subscription}'=p_subscription_id
   and e.payload#>>'{payment,customer}'=p_customer_id
   and e.payload#>>'{payment,value}' ~ '^[0-9]+([.][0-9]{1,2})?$'
   and ((e.payload#>>'{payment,value}')::numeric*100)::integer=p_amount_cents) then
  raise exception 'Payment not linked to paid checkout' using errcode='23514';
 end if;

 -- Never attach the same provider subscription or payment to another user.
 if exists(select 1 from public.billing_subscriptions s
  where s.provider='asaas' and s.provider_subscription_id=p_subscription_id
   and s.user_id<>v_intent.user_id) or
   exists(select 1 from public.billing_payments p
    where p.provider='asaas' and p.provider_payment_id=p_payment_id
     and p.user_id is distinct from v_intent.user_id) then
  raise exception 'Provider resource linked to another account' using errcode='23514';
 end if;
 if exists(select 1 from public.billing_subscriptions s
   where s.user_id=v_intent.user_id
    and s.plan_code<>'free'
    and s.provider_subscription_id is distinct from p_subscription_id) then
  raise exception 'Another paid subscription is already linked to this account' using errcode='23514';
 end if;

 insert into public.billing_accounts(user_id) values(v_intent.user_id)
 on conflict(user_id) do nothing;
 select id into v_account from public.billing_accounts
 where user_id=v_intent.user_id;
 if v_account is null then
  raise exception 'Missing billing identity' using errcode='23514';
 end if;
 update public.billing_checkout_intents set billing_account_id=v_account
 where id=p_intent_id and billing_account_id is null;

 insert into public.billing_subscriptions
  (user_id,plan_code,status,provider,provider_customer_id,
   provider_subscription_id,current_period_start,current_period_end,
   cancel_at_period_end,updated_at)
 values
  (v_intent.user_id,v_plan,'active','asaas',p_customer_id,
   p_subscription_id,now(),
   (p_next_due_date::timestamp+interval '12 hours') at time zone 'UTC',
   false,now())
 on conflict(user_id) do update set
  plan_code=excluded.plan_code,status='active',provider='asaas',
  provider_customer_id=excluded.provider_customer_id,
  provider_subscription_id=excluded.provider_subscription_id,
  current_period_start=coalesce(public.billing_subscriptions.current_period_start,excluded.current_period_start),
  current_period_end=excluded.current_period_end,
  updated_at=now();

 insert into public.billing_payments
  (user_id,billing_account_id,provider,provider_payment_id,description,
   amount_cents,currency,status,due_at,paid_at)
 values
  (v_intent.user_id,v_account,'asaas',p_payment_id,'Payrep '||
   case when v_plan='basic' then 'Basic' else 'Full' end||' (Sandbox)',
   p_amount_cents,'BRL','paid',
   (p_payment_due_date::timestamp+interval '12 hours') at time zone 'UTC',
   now())
 on conflict(provider,provider_payment_id) do update set
  status='paid',paid_at=coalesce(public.billing_payments.paid_at,now()),
  billing_account_id=excluded.billing_account_id;

 update public.billing_webhook_events set
  processing_status='processed',processed_at=now(),last_error=null
 where provider='asaas' and processing_status='needs_review'
  and (
    (event_type='SUBSCRIPTION_CREATED'
     and payload#>>'{subscription,id}'=p_subscription_id)
   or (event_type='PAYMENT_CREATED'
     and payload#>>'{payment,id}'=p_payment_id)
  );

 return pg_catalog.jsonb_build_object('applied',true,'plan',v_plan,
  'paymentStatus',p_payment_status,'firstPaymentId',p_payment_id);
end
$function$;

revoke all on function public.apply_verified_asaas_initial_payment(
 uuid,text,text,text,integer,date,date,text)
 from PUBLIC,anon,authenticated;
grant execute on function public.apply_verified_asaas_initial_payment(
 uuid,text,text,text,integer,date,date,text) to service_role;
