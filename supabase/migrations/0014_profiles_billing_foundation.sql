-- Payrep profile and billing foundation. No payment processor or paid access is enabled.
create table public.user_profiles(
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(char_length(display_name)<=100),
 phone text not null default '' check(char_length(phone)<=30),
 postal_code text not null default '' check(char_length(postal_code)<=20),
 street text not null default '' check(char_length(street)<=160),
 street_number text not null default '' check(char_length(street_number)<=24),
 complement text not null default '' check(char_length(complement)<=100),
 neighborhood text not null default '' check(char_length(neighborhood)<=100),
 city text not null default '' check(char_length(city)<=100),
 state text not null default '' check(char_length(state)<=80),
 country text not null default 'Brasil' check(char_length(country)<=80),
 updated_at timestamptz not null default now()
);
alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from public,anon,authenticated;
grant select,insert,update on public.user_profiles to authenticated;
create policy "user_profiles_select" on public.user_profiles for select to authenticated using(user_id=(select auth.uid()));
create policy "user_profiles_insert" on public.user_profiles for insert to authenticated with check(user_id=(select auth.uid()));
create policy "user_profiles_update" on public.user_profiles for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
insert into public.user_profiles(user_id,display_name)
select id,left(coalesce(nullif(raw_user_meta_data->>'display_name',''),nullif(raw_user_meta_data->>'full_name',''),
 nullif(raw_user_meta_data->>'name',''),''),100) from auth.users on conflict(user_id) do nothing;

create table public.billing_plans(
 code text primary key check(code in ('free','basic','full')),
 label text not null,
 monthly_price_cents integer check(monthly_price_cents is null or monthly_price_cents>=0),
 currency text not null default 'BRL' check(currency ~ '^[A-Z]{3}$'),
 available_for_checkout boolean not null default false,
 entitlements jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
insert into public.billing_plans(code,label,monthly_price_cents,available_for_checkout) values
 ('free','Free',0,false),('basic','Basic',null,false),('full','Full',null,false);
alter table public.billing_plans enable row level security;
revoke all on public.billing_plans from public,anon,authenticated;
grant select on public.billing_plans to authenticated;
create policy "billing_plans_select" on public.billing_plans for select to authenticated using(true);

create table public.billing_subscriptions(
 user_id uuid primary key references auth.users(id) on delete cascade,
 plan_code text not null default 'free' references public.billing_plans(code),
 status text not null default 'active' check(status in ('active','trialing','past_due','canceled','incomplete','unpaid')),
 provider text,provider_customer_id text,provider_subscription_id text,
 current_period_start timestamptz,current_period_end timestamptz,
 cancel_at_period_end boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(plan_code='free' or provider_subscription_id is not null)
);
create unique index billing_customer_provider_unique on public.billing_subscriptions(provider,provider_customer_id)
 where provider is not null and provider_customer_id is not null;
create unique index billing_subscription_provider_unique on public.billing_subscriptions(provider,provider_subscription_id)
 where provider is not null and provider_subscription_id is not null;
alter table public.billing_subscriptions enable row level security;
revoke all on public.billing_subscriptions from public,anon,authenticated;
grant select on public.billing_subscriptions to authenticated;
create policy "billing_subscriptions_select" on public.billing_subscriptions for select to authenticated
 using(user_id=(select auth.uid()));
insert into public.billing_subscriptions(user_id) select id from auth.users on conflict(user_id) do nothing;

create table public.billing_payments(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null,provider_payment_id text not null,
 description text not null default '',
 amount_cents integer not null check(amount_cents>=0),
 currency text not null default 'BRL' check(currency ~ '^[A-Z]{3}$'),
 status text not null check(status in ('pending','paid','failed','refunded','canceled')),
 due_at timestamptz,paid_at timestamptz,created_at timestamptz not null default now(),
 unique(provider,provider_payment_id)
);
create index billing_payments_user_date on public.billing_payments(user_id,created_at desc);
alter table public.billing_payments enable row level security;
revoke all on public.billing_payments from public,anon,authenticated;
grant select on public.billing_payments to authenticated;
create policy "billing_payments_select" on public.billing_payments for select to authenticated
 using(user_id=(select auth.uid()));
-- Subscription and payment tables are read-only to users. Future billing webhooks must be server-authenticated.

create or replace function private.admin_dashboard_data()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare result jsonb;
begin
 if not private.is_current_admin() then
   raise exception 'Administrator access required' using errcode='42501';
 end if;
 select pg_catalog.jsonb_build_object(
   'requireApproval',(select s.require_approval from public.app_admin_settings s where s.id=1),
   'trackingSince',(select min(first_seen_at) from public.app_session_visits),
   'users',coalesce((
     select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
       'id',u.id,'email',u.email,'createdAt',u.created_at,
       'lastSignInAt',u.last_sign_in_at,
       'emailConfirmed',u.email_confirmed_at is not null,
       'role',coalesce(m.role,'member'),'status',coalesce(m.status,'pending'),
       'active',coalesce(m.active,false),
       'sessions',coalesce(visits.total,0),
       'sessions30d',coalesce(visits.recent,0),
       'lastAppAccess',visits.last_visit,
       'displayName',coalesce(nullif(p.display_name,''),u.raw_user_meta_data->>'display_name',u.raw_user_meta_data->>'full_name',''),
       'plan',coalesce(sub.plan_code,'free'),
       'city',nullif(p.city,''),'state',nullif(p.state,'')
     ) order by u.created_at desc)
     from auth.users u
     left join public.app_members m on m.user_id=u.id
     left join public.user_profiles p on p.user_id=u.id
     left join public.billing_subscriptions sub on sub.user_id=u.id
     left join lateral(
       select count(*)::integer as total,
        count(*) filter(where a.first_seen_at>=now()-interval '30 days')::integer as recent,
        max(a.last_seen_at) as last_visit
       from public.app_session_visits a where a.user_id=u.id
     ) visits on true
    ),'[]'::jsonb),
   'sessions30d',(select count(*) from public.app_session_visits where first_seen_at>=now()-interval '30 days'),
   'uniqueUsers30d',(select count(distinct user_id) from public.app_session_visits where first_seen_at>=now()-interval '30 days'),
   'recentActions',coalesce((
      select pg_catalog.jsonb_agg(z.info order by z.performed_at desc)
      from (
        select pg_catalog.jsonb_build_object(
         'action',a.action,'targetId',a.target_user_id,
         'performedAt',a.performed_at,'old',a.old_value,'new',a.new_value
        ) as info,a.performed_at
        from public.app_admin_audit a order by a.performed_at desc limit 15
      ) z
   ),'[]'::jsonb)
 ) into result;
 return result;
end
$$;

create or replace function private.admin_user_detail(p_target uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare result jsonb;
begin
 if not private.is_current_admin() then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 select pg_catalog.jsonb_build_object(
  'id',u.id,'email',u.email,'createdAt',u.created_at,
  'lastSignInAt',u.last_sign_in_at,'emailConfirmed',u.email_confirmed_at is not null,
  'role',coalesce(m.role,'member'),'status',coalesce(m.status,'pending'),
  'profile',coalesce(to_jsonb(p)-'user_id'-'updated_at',jsonb_build_object()),
  'subscription',jsonb_build_object('plan',coalesce(s.plan_code,'free'),
    'status',coalesce(s.status,'active'),'provider',s.provider,
    'providerCustomerId',s.provider_customer_id,'providerSubscriptionId',s.provider_subscription_id,
    'periodStart',s.current_period_start,'periodEnd',s.current_period_end,
    'cancelAtPeriodEnd',coalesce(s.cancel_at_period_end,false)),
  'payments',coalesce((select jsonb_agg(jsonb_build_object(
    'id',b.id,'provider',b.provider,'description',b.description,
    'amountCents',b.amount_cents,'currency',b.currency,'status',b.status,
    'dueAt',b.due_at,'paidAt',b.paid_at,'createdAt',b.created_at) order by b.created_at desc)
    from (select * from public.billing_payments where user_id=u.id order by created_at desc limit 30) b),'[]'::jsonb),
  'payslipCount',(select count(*) from public.statements where user_id=u.id),
  'eventCount',(select count(*) from public.salary_events where user_id=u.id)
 ) into result
 from auth.users u
 left join public.app_members m on m.user_id=u.id
 left join public.user_profiles p on p.user_id=u.id
 left join public.billing_subscriptions s on s.user_id=u.id
 where u.id=p_target;
 if result is null then raise exception 'User not found' using errcode='22023'; end if;
 return result;
end
$$;
revoke all on function private.admin_user_detail(uuid) from public,anon;
grant execute on function private.admin_user_detail(uuid) to authenticated;
create or replace function public.get_admin_user_detail(p_target uuid)
returns jsonb language sql stable security invoker set search_path=''
as $$select private.admin_user_detail(p_target)$$;
revoke all on function public.get_admin_user_detail(uuid) from public,anon;
grant execute on function public.get_admin_user_detail(uuid) to authenticated;
