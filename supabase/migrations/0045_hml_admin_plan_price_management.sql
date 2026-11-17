-- HML: admin-controlled test plan price and checkout availability.
-- All updates are server-validated; commercial subscription amounts are NOT modified.
create table if not exists public.billing_plan_price_audit(
 id bigint generated always as identity primary key,
 plan_code text not null references public.billing_plans(code),
 actor_id uuid not null references auth.users(id),
 old_monthly_price_cents integer,
 new_monthly_price_cents integer,
 old_available_for_checkout boolean not null,
 new_available_for_checkout boolean not null,
 created_at timestamptz not null default now()
);
alter table public.billing_plan_price_audit enable row level security;
revoke all on public.billing_plan_price_audit from public, anon, authenticated;

create or replace function public.update_hml_billing_plan(
 p_plan text, p_price_cents integer, p_available boolean
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 v_uid uuid := (select auth.uid());
 v_old public.billing_plans%rowtype;
begin
 if v_uid is null or not private.current_mfa_satisfied()
  or not exists(select 1 from public.app_members
   where user_id=v_uid and active=true and status='approved' and role='admin') then
  raise exception 'Acesso administrativo negado' using errcode='42501';
 end if;
 if p_plan not in ('basic','full') or p_plan is null
  or p_price_cents is null or p_price_cents<500
  or p_price_cents>100000000 or p_available is null then
  raise exception 'Preço inválido (mínimo R$ 5,00, apenas Basic/Full)' using errcode='22023';
 end if;
 select * into v_old from public.billing_plans
  where code=p_plan for update;
 if not found then raise exception 'Plano não encontrado' using errcode='22023'; end if;
 if v_old.monthly_price_cents is distinct from p_price_cents
  or v_old.available_for_checkout is distinct from p_available then
  update public.billing_plans set monthly_price_cents=p_price_cents,
   available_for_checkout=p_available,updated_at=now() where code=p_plan;
  insert into public.billing_plan_price_audit(
   plan_code,actor_id,old_monthly_price_cents,new_monthly_price_cents,
   old_available_for_checkout,new_available_for_checkout)
  values(p_plan,v_uid,v_old.monthly_price_cents,p_price_cents,
   v_old.available_for_checkout,p_available);
 end if;
 return pg_catalog.jsonb_build_object(
  'code',p_plan,'monthly_price_cents',p_price_cents,'available_for_checkout',p_available);
end
$fn$;
revoke all on function public.update_hml_billing_plan(text,integer,boolean) from public,anon;
grant execute on function public.update_hml_billing_plan(text,integer,boolean) to authenticated;
