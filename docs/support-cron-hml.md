# Payrep HML: automático de notificações por Supabase Cron

Status: a fila `support_email_outbox` já funciona manualmente pelo serviço
`support-mailer`. Em HML, esta migração ativa `pg_cron` e `pg_net`,
cria o job `payrep-hml-support-mailer` a cada minuto e uma função
`private.payrep_hml_support_mailer_tick()`. A função só envia a solicitação
HTTP quando há mensagens com `state='pending'`, cujo
`next_attempt_at <= now()`, **e** existe no Supabase Vault um secret válido
chamado `payrep_hml_support_mailer_worker_token`.

O token deve ser **o mesmo valor** que a Edge Function `support-mailer`
recebe pelo secret `SUPPORT_MAILER_WORKER_TOKEN`. Não armazene esse token
em Git, cron.job.command, logs ou SQL salvo.

## Passo manual pendente
1. Supabase HML → Vault → criar novo secret:
   Name: `payrep_hml_support_mailer_worker_token`
   Secret: valor já salvo em `SUPPORT_MAILER_WORKER_TOKEN`.
2. Se o valor antigo não estiver disponível, gere um token forte novo e
   configure o mesmo valor em Edge Function Secrets e Vault.
3. Verifique **somente metadados**, nunca decripte ou imprima o valor:
   `select name from vault.secrets where name='payrep_hml_support_mailer_worker_token';`
4. Abra um chamado de teste em HML e confira a fila e o e-mail sem apertar Test.
5. Monitore:
   `select jobid, jobname, schedule, active from cron.job where jobname='payrep-hml-support-mailer';`
   `select status, return_message, start_time from cron.job_run_details where jobid=(select jobid from cron.job where jobname='payrep-hml-support-mailer') order by start_time desc limit 10;`
   `select kind,state,count(*) from public.support_email_outbox group by kind,state;`
6. Para pausar imediatamente:
   `select cron.unschedule('payrep-hml-support-mailer');`

## Segurança e operação
- Supabase HML apenas, não ativar em PRD sem GO/NO-GO.
- Nenhuma secret value é registrada no banco em texto simples.
- No `pg_net`, os headers com token ficam temporariamente em
  `net.http_request_queue`. Só utilizar token exclusivo deste worker,
  nunca `service_role` ou Maileroo API Key, e limitar acesso ao Postgres.
- A função retorna `null` se não há trabalho ou se o Vault não tem token.
  Um job com execução SQL bem-sucedida não comprova que e-mail foi entregue.
- O envio usa a fila com até cinco tentativas por item, conforme o worker.
- Verifique `net._http_response` para erros de HTTP e a outbox para falhas.
