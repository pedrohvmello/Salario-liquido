# Payrep: envio de notificações de chamados por e-mail

## Estado
A migração 0024 registra eventos em uma fila privada (outbox). O banco e a interface
não enviam e-mail diretamente. Nenhuma mensagem é disparada por essa migração isoladamente.
O worker `supabase/functions/support-mailer/index.ts` está preparado, mas seu envio
**depende** de configuração independente no Supabase e no Maileroo.

## Eventos previstos
- ticket_opened: e-mail para suporte@payrep.com.br com protocolo, categoria,
  solicitante, assunto e descrição;
- user_message: notifica suporte@payrep.com.br sobre novos comentários do usuário;
- admin_message: notifica o titular do chamado com a resposta do suporte;
- ticket_closed: notifica o titular do encerramento.

A página do Payrep continua sendo a fonte de verdade do atendimento.
Um e-mail aceito pelo Maileroo não garante entrega final à caixa de destino.

## Ativação controlada (HML antes de PRD)
1. Verificar no Maileroo o domínio de envio e o remetente `SUPPORT_FROM_EMAIL`.
2. Criar chave de envio restrita ao domínio, armazenada como Supabase Secret
   `MAILEROO_API_KEY` no projeto HML, nunca como variável `VITE_*` ou em Git.
3. Configurar `SUPPORT_FROM_EMAIL`, `SUPPORT_APP_URL` e um valor aleatório forte
   para `SUPPORT_MAILER_WORKER_TOKEN` nas secrets do projeto HML.
4. Publicar `support-mailer` em HML e configurar uma execução confiável a cada
   minuto ou poucos minutos, por POST, com header
   `X-Payrep-Worker-Token`. O endpoint sempre exige esse token, mesmo sem JWT.
5. Testar utilizando endereços de e-mail de homologação. Confirmar o recebimento,
   tratamento de erro, reenvio e ausência de vazamento de dados em logs.
6. Somente após aceite, repetir a configuração em PRD, com credenciais separadas.

O worker marca os eventos como `sent` após aceitação do Maileroo; caso contrário,
reagenda até cinco tentativas. Uma falha inesperada entre envio e gravação do resultado
pode causar duplicidade; um monitoramento operacional deve detectar filas paradas.

## Respostas por e-mail: estudo de integração (ainda não implementadas)
O Maileroo oferece **Inbound Routing**. Após configurar MX/rota para o domínio
ou subdomínio de atendimento, um webhook recebe mensagens processadas.
Seu campo `body.stripped_plaintext` contém a última resposta sem histórico citado.

Antes de permitir inserção de mensagens por webhook:
- validar o endereço único `validation_url` com o provedor, exigindo domínio HTTPS
  confiável e evitando SSRF; cada URL pode ser usada só uma vez;
- rejeitar spam, falhas de alinhamento DMARC, remetentes desconhecidos,
  anexos inesperados e emails automáticos;
- resolver protocolo com segurança e exigir que o remetente corresponda à conta
  titular, em vez de confiar apenas no assunto;
- deduplicar pelo `message_id` de origem;
- recusar mensagens em chamados finalizados;
- filtrar assinaturas, respostas citadas e conteúdo perigoso;
- não criar respostas a partir de mensagens encaminhadas por terceiros;
- auditar tentativas negadas sem registrar conteúdo pessoal nos logs.

Documentação oficial:
https://maileroo.com/docs/api-reference/emails/send-email
https://maileroo.com/docs/inbound-routing/webhooks
