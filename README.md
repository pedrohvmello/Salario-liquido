# Salário Líquido

Aplicativo brasileiro multiusuário para simular salário líquido, controlar horas extras, registrar eventos com vigência e importar holerites em PDF.

> **Estado: MVP em desenvolvimento, sem produção.** Não armazene arquivos reais no repositório público. Cálculos ainda não certificados para folha e pensão judicial.

## Escopo disponível nesta branch

- React + TypeScript + Vite, interface adaptativa;
- Conta privada Supabase Auth e RLS por usuário, cadastro por convite (provisionamento inicial via painel Supabase);
- Simulação de INSS e IRRF de 2026, cálculo circular de pensão opcional e descontos básicos;
- Cadastro e edição de eventos e de horários diários;
- Corte de horas extras: 2ª quinzena anterior + 1ª quinzena atual;
- Feriados de São Paulo por regra, com override manual;
- Importação assistida de PDFs da Accenture (layouts antigo e novo), incluindo PDFs anuais multipágina;
- Histórico mensal e consolidado, gráficos de bruto/líquido e FGTS;
- Armazenamento privado de PDFs, preservação das rubricas e alertas para conferência.

## Desenvolvimento

Requer Node.js 22+.

```bash
npm install
cp .env.example .env
npm test
npm run dev
npm run build
```

Sem variáveis Supabase, a aplicação mostra apenas uma demonstração **fictícia**, sem persistência. Nunca usar a demonstração como cálculo real.

## Configurar autenticação e dados

1. Criar um projeto privado Supabase.
2. Executar `supabase/migrations/0001_init.sql` pelo SQL Editor.
3. Colocar URL e chave **anon/publishable** em `.env`. Nunca colocar `service_role` no frontend.
4. Desativar cadastro público em Supabase Auth, usando convites controlados.
5. Criar usuário com convite no painel Auth. Após aceitar, ativar o usuário em `public.app_members` (inserção administrada, nunca pelo cliente).
6. Validar RLS com **dois usuários diferentes** antes de carregar dados reais.
7. Executar testes e usar preview antes de habilitar produção.

**Importante:** esta entrega não provisiona Supabase nem publica o projeto. Login e importação persistida só funcionarão depois da configuração segura do backend.

## Limitações explícitas

- 2026 apenas para projeção tributária. Holerites históricos preservam o valor original, sem recálculo.
- A regra de 26% de pensão é **hipótese**; depende da sentença. Cálculo do RH ainda não esclarecido.
- Divisor 220h ainda precisa confirmação. DSR, férias, 13º, noturno e rubricas específicas não têm motor definitivo.
- Feriados oficiais de São Paulo calculados por regras conhecidas. Pontos facultativos não são automaticamente feriados.
- Horários cruzando meia-noite ainda não aceitos.
- Importador tem classificação inicial e detecta totais incoerentes. Rubricas desconhecidas e períodos especiais exigem revisão.
- Saldo líquido final do holerite **não representa** total recebido no mês quando houve adiantamento.
- Cadastro de eventos com vigência mensal; mudanças intramensais e retroativos ainda exigem tratamento dedicado.

## Fontes oficiais

- [INSS 2026](https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal/)
- [IRRF 2026](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026)
- [Calendário SP 2026](https://prefeitura.sp.gov.br/web/gestao/w/calendario_2026)

## Próximos marcos

Consultar `docs/PLANO.md`. Nenhuma informação de remuneração, PDF ou credencial real deve ser versionada neste repositório.

## Primeiro acesso e recuperação de senha

O app possui login, solicitação de recuperação e formulário de atualização de senha em Configurações. Para que o convite ou e-mail de recuperação chegue ao app, configure **Auth → URL Configuration** no Supabase com o domínio da versão de homologação, preservando o bloqueio de cadastro aberto. O cadastro inicial deve ser enviado pelo painel Supabase Auth (Invite User), não por SQL direto em `auth.users`.

## Login Google (OAuth)

O botão `Continuar com Google` foi implementado, mas fica oculto enquanto `VITE_ENABLE_GOOGLE_OAUTH` não for `true` na Vercel. Antes de habilitar:

1. No Google Auth Platform, configurar a tela de consentimento e criar credenciais OAuth do tipo **Web application**. Origem autorizada para HML: `https://salario-liquido-hml.vercel.app`; URI de redirecionamento: `https://klvurrcmfrwetmynscjc.supabase.co/auth/v1/callback`.
2. Configurar **Google** no Supabase Authentication → Sign In / Providers com o Client ID e Client Secret. **Nunca versionar ou enviar o Client Secret ao frontend ou ao GitHub.**
3. No Supabase Auth → URL Configuration, adicionar a URL de HML à allowlist de redirects; manter cadastro público desabilitado.
4. Ativar `VITE_ENABLE_GOOGLE_OAUTH=true` apenas no ambiente de HML na Vercel, gerar novo deploy e testar com conta previamente autorizada.

Para links de recuperação (`type=recovery`) e convites (`type=invite`), o app abre o formulário de definição de senha em tela dedicada, em vez do dashboard. Emails enviados pelo SMTP interno do Supabase são limitados; para piloto com até 20 usuários, configurar um SMTP apropriado antes de convidar participantes.

## Líquido mensal efetivamente recebido

Preservamos três valores históricos distintos por holerite:
- **Líquido no fechamento**: campo original de pagamento líquido no PDF.
- **Adiantamento salarial**: desconto que corresponde ao dinheiro já pago antecipadamente na mesma competência, identificado por código `07220` no formato antigo ou `/B02` no novo.
- **Líquido mensal recebido**: fechamento + adiantamento salarial, armazenado também em `statements.net_received`.

O total mensal é usado no histórico, totais anuais, gráficos e no quadro de realizado do dashboard. A prévia explicita todos os componentes antes de salvar. **Não somamos** automaticamente adiantamento de férias (ex.: `07200`) nem adiantamento de 13º (ex.: `07210`), que são pagamentos e eventos distintos e necessitam de fluxo próprio. Em meses com férias ou 13º, portanto, o total de dinheiro efetivamente transferido no mês pode exigir conciliação adicional. Esta mudança não altera o líquido originalmente impresso nem reinterpreta as bases de INSS/IRRF.

Migração: `supabase/migrations/0005_net_received.sql` aplicada no projeto Supabase de homologação. Sem histórico real gravado pelo desenvolvimento.
