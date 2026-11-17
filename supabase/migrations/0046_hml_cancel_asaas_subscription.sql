-- HML: owner-initiated cancellation of automatic renewal.
-- Keep the already paid service period and financial ledger unchanged.
create or replace function public.my_asaas_subscription_for_cancellation()
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 v_uid uuid:=(select auth.uid());
 v_sub public.billing_subscriptions%rowtype;
begin
 if v_uid is null or not private.current_mfa_satisfied()
  or not exists(select 1 from public.app_members
   where user_id=v_uid and active=true and status='approved') then
  raise exception 'Conta não autorizada' using errcode='42501';
 end if;
 select * into v_sub from public.billing_subscriptions
  where user_id=v_uid and provider='asaas'
   and plan_code in ('basic','full') and status='active';
 if not found or v_sub.provider_subscription_id is null
  then raise exception 'Assinatura paga ativa não encontrada' using errcode='23514'; end if;
 return pg_catalog.jsonb_build_object(
  'user_id',v_uid,'provider_subscription_id',v_sub.provider_subscription_id,
  'provider_customer_id',v_sub.provider_customer_id,
  'cancel_at_period_end',v_sub.cancel_at_period_end,
  'current_period_end',v_sub.current_period_end);
end
$fn$;
revoke all on function public.my_asaas_subscription_for_cancellation() from public,anon;
grant execute on function public.my_asaas_subscription_for_cancellation() to authenticated;

create or replace function public.finalize_asaas_subscription_cancellation(
 p_user_id uuid,p_subscription_id text,p_status text
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 v_changed integer;
begin
 if (select auth.role())<>'service_role' then
  raise exception 'Serviço não autorizado' using errcode='42501';
 end if;
 if p_user_id is null or p_subscription_id is null
  or p_status<>'INACTIVE' then
  raise exception 'Status de cancelamento inválido' using errcode='22023';
 end if;
 update public.billing_subscriptions set
  cancel_at_period_end=true,updated_at=now()
 where user_id=p_user_id and provider='asaas' and provider_subscription_id=p_subscription_id
  and plan_code in ('basic','full') and status='active';
 get diagnostics v_changed=row_count;
 if v_changed<>1 then
  raise exception 'Assinatura local não corresponde ao Asaas' using errcode='23514';
 end if;
 return pg_catalog.jsonb_build_object('canceledRenewal',true);
end
$fn$;
revoke all on function public.finalize_asaas_subscription_cancellation(uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.finalize_asaas_subscription_cancellation(uuid,text,text)
 to service_role;
