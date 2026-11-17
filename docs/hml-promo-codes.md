# Payrep HML | Códigos promocionais Basic e Full

## Operação

Menu administrativo **Planos e Assinaturas > Códigos promocionais**. O administrador autenticado com MFA escolhe:
- código escolhido pelo administrador, de 4 a 12 caracteres, convertido para maiúsculas; permite A-Z, 0-9, hífen e sublinhado
- plano Basic ou Full
- dias de acesso de 1 a 365
- último dia para utilizar o código (data em America/Sao_Paulo)
- limite opcional de resgates (1 a 10.000; vazio = ilimitado)

O administrador informa o código, que é normalizado para uppercase no frontend e no banco. O banco guarda apenas o hash do código e os quatro caracteres finais; o código completo só é devolvido ao finalizar o cadastro, para cópia. A desativação impede novos resgates, mas não revoga benefícios já concedidos. O mesmo texto só pode ser cadastrado novamente seis meses **após sua desativação**, preservando os registros antigos e o histórico de resgates. Códigos ainda ativos, mesmo que a data de resgate já tenha expirado, continuam reservados até serem desativados. A migração `0055_hml_custom_promo_codes_six_month_reuse.sql` substitui o gerador automático anterior. Os códigos PAY-... criados antes da migração continuam válidos até o término ou desativação.

Menu do usuário **Assinatura > Código promocional**:
1. escolher Basic ou Full e informar código
2. autenticação/MFA e aprovação da conta são verificadas no servidor
3. verificar plano, validade até o final da data informada, limite de resgates, uso anterior e promoções simultâneas
4. gravar concessão por uma transação atômica e retornar data/hora final
5. calcular acesso a cada consulta ao banco, sem depender de cron

## Exemplo: expiração independente

Código expira em **18/11/2026** (inclusive, horário de São Paulo).
Usuário resgata em 17/11/2026 às 15:00. Duração: **7 dias**.
Acesso até 24/11/2026 às 15:00, mesmo que o código deixe de aceitar novos resgates em 19/11.

## Precedência de planos

- Sem assinatura paga: Free > Basic ou Full por código > volta a Free após o período.
- Com Basic pago ativo: Full promocional prevalece durante o período; volta a Basic **se a assinatura ainda estiver vigente**.
- Com Full pago ativo: códigos de Basic/Full não oferecem aumento de benefício e são recusados.
- Sem cobrança, token de cartão ou mudança de status no Asaas.
- O resgate promocional **não interrompe** renovações financeiras nem gera desconto nas faturas.
- Não permite promoções simultâneas nem sobreposição com teste manual Full.

## Controles técnicos

- SQL em `supabase/migrations/0054_hml_promotional_plan_codes.sql` e `0055_hml_custom_promo_codes_six_month_reuse.sql`, somente no projeto HML `nrpqcrhschztdwbfgnyo`.
- `private.payrep_promo_codes` e `private.payrep_promo_redemptions`: RLS ativo; nenhuma concessão direta para anon ou authenticated.
- RPCs autenticados: `create_hml_promo_code`, `list_hml_promo_codes`, `disable_hml_promo_code`, `redeem_hml_promo_code`, `my_effective_payrep_plan`.
- Criação e listagem exigem `private.is_current_admin()`, que usa verificação MFA.
- Resgate usa `private.current_mfa_satisfied()`, bloqueia usuário não aprovado e trava linha de `app_members` e código para evitar concorrência.
- Período de acesso é calculado pelo servidor com `started_at` e `ends_at`, não pelo relógio do navegador.
- Expiração do código não altera concedidos existentes. Expiração do benefício volta ao plano pago *vigente*, não a um registro desatualizado.

## Validação pendente

- Deploy do Vercel HML devido ao limite diário `api-deployments-free-per-day` (HTTP 402).
- Build e teste end-to-end em navegador após deploy.
- A **matriz de funcionalidades por plano** ainda precisa ser definida e aplicada às APIs/telas. A função de plano efetivo fornece a fonte de autorização, mas não equivale por si só a impor controle por recurso.
- PRD não alterado.
