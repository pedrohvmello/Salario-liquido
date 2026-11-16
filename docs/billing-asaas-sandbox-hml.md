# Payrep | Integração de assinaturas Asaas (HML)

## Estado atual
- Estrutura **HML somente**, sem cobrança real, sem chave de produção e sem preços definidos.
- Checkout hospedado para recorrência mensal em cartão de crédito.
- O Payrep nunca recebe números ou CVV de cartões.
- As tabelas `billing_checkout_intents` e `billing_webhook_events` são isoladas por RLS e privilégios.
- Em 16/11/2026, Basic e Full foram habilitados exclusivamente no banco HML para teste de checkout com preço **temporário R$ 1,00/mês em ambos**, sem alterar os preços comerciais da futura produção.
- Os três nomes de secrets (`ASAAS_SANDBOX_API_KEY`, `ASAAS_SANDBOX_WEBHOOK_TOKEN` e `PAYREP_ASAAS_SANDBOX_ENABLED`) constam na configuração de HML, mas os valores e a comunicação não foram validados ponta a ponta.
- A liberação no banco não implica confirmação de pagamento, criação de assinatura ou ativação de benefícios; tudo depende de checkout autenticado e dos eventos do provedor.
- A liberação de recursos pagos por evento financeiro ainda **não** foi habilitada.

## Contrato técnico
1. Usuário autenticado seleciona um plano habilitado. `billing-checkout-asaas` verifica o token.
2. `begin_my_billing_checkout` valida conta, MFA, preço no banco, assinatura atual e duplicidade.
3. A Edge Function utiliza a chave exclusiva do Sandbox na API `POST /v3/checkouts`. O navegador é enviado ao checkout hospedado.
4. Asaas envia eventos autenticados por `asaas-access-token` ao endpoint `billing-webhook-asaas`.
5. O SQL `receive_asaas_billing_event` persiste os eventos com chave única `(provider,provider_event_id)`, evita duplicação e atualiza o status de um checkout **já associado**.
6. Eventos de assinatura e pagamento ficam na fila `needs_review` até a vinculação com identificadores do provedor ser verificada. **Não ativar Basic/Full por callback ou apenas por CHECKOUT_PAID.**

## Ativação futura no HML
1. Criar conta exclusivamente no [Sandbox Asaas](https://sandbox.asaas.com/). Nunca usar chave de produção.
2. Configurar diretamente nos *secrets* do projeto Supabase HML:
   - `ASAAS_SANDBOX_API_KEY`: chave de API exclusiva do Sandbox.
   - `ASAAS_SANDBOX_WEBHOOK_TOKEN`: segredo único de 32 a 255 caracteres, diferente da chave de API.
   - `PAYREP_ASAAS_SANDBOX_ENABLED=true`.
3. Configurar webhook Asaas:
   - URL: `https://nrpqcrhschztdwbfgnyo.supabase.co/functions/v1/billing-webhook-asaas`
   - Autenticação: `asaas-access-token` igual ao segredo armazenado.
   - Eventos `CHECKOUT_*`, `SUBSCRIPTION_*` e `PAYMENT_*` relevantes.
   - HTTP 200 confirma persistência, não necessariamente ativação de benefícios.
4. Os valores simbólicos HML servem somente ao teste; definir preços comerciais e limites reais Basic/Full antes da produção.
5. Testar primeiro checkout, pagamento, duplicidade de webhook, atraso, cancelamento, estorno, chargeback, indisponibilidade e conciliação por ID.
6. Implementar e provar conciliação de `SUBSCRIPTION_CREATED` + `PAYMENT_CONFIRMED` ou `PAYMENT_RECEIVED` com a conta/checkout originários **antes** de conceder acesso pago.
7. Implementar cancelamento no provedor, atualizações de cartão, tratamento de inadimplência, uma rotina de auditoria de divergências e preservação de registros fiscais independentes de `auth.users`.
8. Revisar privacidade, retenção, base fiscal e contratação antes de qualquer lançamento real.

## Cuidados
- Não configurar token do Asaas em `VITE_*` ou em arquivos do GitHub.
- Não fazer chamadas reais no projeto PRD.
- O retorno `?billing=success` informa apenas a navegação do checkout, não comprovante de recebimento.
- Não preencher preço automaticamente e não simular cobranças pagas na base PRD.
- O Asaas envia webhooks no modelo *at least once*: deduplicar pelo `id` e conferir a fila `needs_review`.
- O código usa explicitamente `api-sandbox.asaas.com`. A migração para produção exigirá nova revisão de segurança e credenciais.
- A versão Payrep V1.0 permanece inalterada.

## Documentação oficial
- [Asaas Checkout recorrente](https://docs.asaas.com/docs/checkout-com-assinatura-recorrente)
- [Webhooks Asaas](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook)
- [Asaas Sandbox](https://docs.asaas.com/docs/sandbox)
