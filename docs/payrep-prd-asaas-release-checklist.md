# Payrep | Checklist de preparação PRD / Assinaturas Asaas
Data de revisão: 20/11/2026. **Este arquivo não autoriza cobranças reais.**

## Ambientes constatados

- Web HML: `payrep-hml.vercel.app`, Vercel `payrep-hml`.
  Último commit validado: `9a0a5cfd4b3e6b5d3169fc6ee4473cc10a47c57a`.
  Supabase HML: `nrpqcrhschztdwbfgnyo`.
- Web PRD: `payrep.com.br`, Vercel `payrep` (`prj_4NI7IsHpASPdsREDx2IHwyiGQ7yf`).
  Commit atualmente publicado em PRD (verificado em 20/11): `8e6bbce11b52c8dbfc86e1ffce51153a969084ae`.
  Supabase PRD: `klvurrcmfrwetmynscjc`.
- HML e PRD divergem no repositório (361 commits à frente e 16 atrás do commit PRD na comparação).
- PRD **não** tem a estrutura Asaas que HML possui: `billing_checkout_intents`,
  `billing_webhook_events`, `billing_accounts`, funções RPC de cobrança e políticas correspondentes.
- HML também possui outras tabelas e migrações posteriores ausentes em PRD (informes IR,
  conversas Pep, políticas e documentos complementares). **Não basta publicar o frontend de HML em PRD**.
- Preços PRD: Basic e Full nulos, `available_for_checkout=false`.
  Valores de teste HML não devem ser copiados como valores comerciais.

## Branch de preparação (não publicada em PRD)

`codex/payrep-prd-asaas-readiness-20261120`

- Mantém a lógica HML testada, com funções Asaas especializadas em produção.
- Frontend exige retorno `mode=production` e URL HTTPS no domínio exato `asaas.com`,
  caminho `/checkoutSession/show` e único parâmetro `id` em UUID.
- Backend usa `https://api.asaas.com/v3`, origem CORS `https://payrep.com.br`,
  projeto Supabase PRD e secrets distintos de HML.
- As funções **devem permanecer desabilitadas** sem `PAYREP_ASAAS_PRODUCTION_ENABLED=true`.
- Não colocar API keys no frontend, código Git, logs ou comentários de banco.

## Ordem necessária antes do deploy principal

1. Fazer backup/restauração testada do PRD e registrar schema baseline, tabelas,
   políticas RLS, triggers, funções, dependências e filas de eventos.
2. Resolver o desvio de branches Git e definir a versão final para PRD sem perder os
   16 commits exclusivos de produção.
3. Preparar plano de migração SQL **aditiva**, revisando as migrações de HML
   incompatíveis com a estrutura existente de PRD; testar em clone/branch de banco,
   sem alterar dados de usuários reais.
4. Aplicar migrações em PRD, conferir grants, isolamento entre usuários, políticas
   de permissões Free/Basic/Full e integridade de dados existentes.
5. Publicar Edge Functions com segredos de PRD e verificar saúde em modo
   *desabilitado*; depois somente ativar sob aprovação explícita.
6. Definir preços comerciais Basic/Full em centavos de real (não usar R$ 5/R$ 10
   de HML por padrão). Habilitar `available_for_checkout` somente após homologação completa.
7. Criar API Key **da conta de produção Asaas**, armazená-la no Secret Manager da
   Supabase PRD como `ASAAS_PRODUCTION_API_KEY`; não reutilizar a chave Sandbox.
8. Criar secret independente `ASAAS_PRODUCTION_WEBHOOK_TOKEN` (mínimo 32 caracteres).
   Cadastrar webhook no **Asaas Produção**:
   `https://klvurrcmfrwetmynscjc.supabase.co/functions/v1/billing-webhook-asaas`.
   Validar header `asaas-access-token` em tempo constante.
9. Revisar eventos `CHECKOUT_*`, `SUBSCRIPTION_*`, `PAYMENT_*`, persistência idempotente,
   vínculo estrito checkout/assinatura/pagamento, renovação, atraso, cancelamento,
   estorno, chargeback, indisponibilidade do provedor e reconciliação manual.
   **Não liberar plano pago por callback de navegador ou CHECKOUT_PAID isolado**.
10. Só promover frontend e habilitar `PAYREP_ASAAS_PRODUCTION_ENABLED=true` após
   validação funcional, testes de sandbox, webhooks produtivos de teste controlado,
   cancelamento, auditoria, RLS e preços.
11. Validar pagamentos em PROD com cobrança autorizada de baixo valor **apenas
   após** decisão explícita e conta Asaas habilitada, sem testes sobre clientes reais.
12. Observabilidade: registrar eventos rejeitados, duplicados, atraso de fila,
   falhas de sincronização e motivos de conciliação; plano de rollback
   independente para web e backend. Preservar livros financeiros para fins fiscais.

## Condições de liberação

- Deploy PRD de frontend: **bloqueado** enquanto migrações, RLS e autenticação divergirem.
- Criação de cobrança Asaas: **bloqueada** sem três condições simultâneas:
  preço comercial publicado, credenciais produção e `PAYREP_ASAAS_PRODUCTION_ENABLED=true`.
- A ausência de erro no build não prova que billing/RLS/assinaturas funcionam.
- O status de pagamento real precisa ser confirmado contra a API e eventos autenticados
  do Asaas; não por `?billing=success`.

Documentação:
- https://docs.asaas.com/docs/prepara%C3%A7%C3%A3o-para-produ%C3%A7%C3%A3o
- https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook
- https://docs.asaas.com/docs/link-do-checkout-e-redirecionamento-do-cliente
