-- Payrep PRD only: one-minute support mail queue drain via Supabase Cron.
-- Never embed the worker token in a migration or cron.job.command.
-- Vault secret named "payrep_prd_support_mailer_worker_token" must be
-- created separately with the exact existing Edge Functions worker token.
-- Until it exists, the job performs no HTTP requests.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

create or replace function private.payrep_prd_support_mailer_tick()
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
 v_worker_token text;
begin
 -- Avoid calling the Edge Function every minute when there is no work.
 if not exists(
  select 1 from public.support_email_outbox
  where state='pending' and next_attempt_at<=now()
 ) then return null; end if;

 select decrypted_secret into v_worker_token
 from vault.decrypted_secrets
 where name='payrep_prd_support_mailer_worker_token'
 limit 1;

 -- The token must be stored in Vault; never use a public Supabase API key. Apply only after PRD security preflight.
 if v_worker_token is null or length(v_worker_token)<32 then
  return null;
 end if;

 return net.http_post(
  url:='https://klvurrcmfrwetmynscjc.supabase.co/functions/v1/support-mailer',
  headers:=jsonb_build_object(
   'Content-Type','application/json',
   'X-Payrep-Worker-Token',v_worker_token
  ),
  body:='{}'::jsonb,
  timeout_milliseconds:=10000
 );
end
$$;
revoke all on function private.payrep_prd_support_mailer_tick()
 from public,anon,authenticated;

-- This named job belongs to PRD only and invokes the no-secret SQL wrapper.
select cron.schedule(
 'payrep-prd-support-mailer',
 '* * * * *',
 'select private.payrep_prd_support_mailer_tick();'
);
