
-- New monitoring worker handles HTML/TXT/PDF downloads into the private bucket.
-- The token is read from Vault only by privileged database routines.
create function private.collective_enqueue_edge_call()
returns bigint language plpgsql security invoker set search_path='' as $$
declare v_token text;
begin
 select decrypted_secret into v_token from vault.decrypted_secrets
 where name='payrep_hml_collective_monitor_token' limit 1;
 if v_token is null then raise exception 'Token de monitoramento não configurado no Vault.';end if;
 return net.http_post(
  url:='https://nrpqcrhschztdwbfgnyo.supabase.co/functions/v1/collective-monitor',
  body:='{}'::jsonb,
  headers:=jsonb_build_object(
   'Content-Type','application/json',
   'x-payrep-collective-worker-token',v_token
  ),
  timeout_milliseconds:=120000
 );
end $$;
revoke all on function private.collective_enqueue_edge_call() from public;

create or replace function public.run_collective_source_check()
returns integer language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_app_admin() then
  raise exception using errcode='42501',message='Acesso administrativo obrigatório';
 end if;
 perform private.collective_enqueue_edge_call();
 return 1;
end $$;
revoke all on function public.run_collective_source_check() from public,anon;
grant execute on function public.run_collective_source_check() to authenticated;

select cron.unschedule('payrep-hml-collective-weekly-scan');
select cron.unschedule('payrep-hml-collective-response-reconciliation');
select cron.schedule(
 'payrep-hml-collective-weekly-scan',
 '0 11 * * 1',
 $job$select private.collective_enqueue_edge_call()$job$
);
