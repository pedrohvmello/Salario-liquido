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

## Base de trabalho e feriados

Em **Configurações → Base:**, cada usuário escolhe sua UF e município, a partir da lista oficial de localidades do IBGE, com código IBGE de sete dígitos. O valor fica no campo privado `user_settings.base_city`; usuários diferentes podem ter Bases distintas. **Nenhuma cidade é presumida para contas novas:** é necessário selecionar e salvar a Base antes de usar o controle de horas.

Em **Controle de horas**, a Base cadastrada aparece no formulário de ponto e determina os feriados automáticos aplicados à classificação de 100%:

- Calendário nacional/estadual baseado na biblioteca `date-holidays`, com dados locais e sem enviar salário ou folha a terceiros.
- Algumas cidades têm calendário municipal local cadastrado nessa biblioteca (inclusive São Paulo). Para as demais, tenta-se consulta à API de feriados aberta `api.feriados.dev`, enviando somente cidade/UF/ano. Se a consulta falhar ou a cobertura não for confirmada, o app informa **cobertura parcial** e não considera automaticamente feriados municipais desconhecidos. O ajuste manual por data continua disponível e tem prioridade.
- Pontos facultativos não equivalem automaticamente a feriados.
- Mudança de Base refaz a classificação de jornadas antigas **sem ajuste manual**; não altera os horários nem os holerites históricos.

A migração é `supabase/migrations/0006_user_base.sql`. Este é um mecanismo inicial, não uma certificação jurídica de feriados de todos os 5.570 municípios. Para expansão comercial, preferir uma fonte de feriados municipais auditável, com cobertura e fundamento legal documentados.

## Holerites de PPR (participação nos resultados)

O importador distingue, no cabeçalho do formato antigo Accenture, a **folha PPR** da folha **MENSAL**. No PDF de PPR, preserva todas as rubricas, identifica o pagamento pela data impressa e registra em `statements` com `document_type='ppr'`, `gross_ppr` e `payment_date`.

Após o usuário conferir e confirmar a importação, um trigger da migração `supabase/migrations/0007_ppr_events.sql` cria automaticamente um evento pontual `salary_events.kind='ppr'`, vinculado ao mesmo `source_statement_id`. Reimportar o mesmo documento atualiza o evento existente, sem duplicar; os dados usados nos testes públicos são fictícios. O histórico salarial regular, o cálculo mensal de salário e os gráficos de salário não somam o PPR. Os totais de PPR aparecem separadamente no histórico e em Análises.

O valor bruto do evento corresponde à rubrica de PPR, e o líquido à quantia impressa no holerite. O código inicialmente homologável é `00845` no layout antigo. Outros modelos de PPR devem passar por revisão do importador antes de serem aceitos. Nenhum PDF privado foi versionado no GitHub.

## Jornada

O horário default de **saída** para novos apontamentos é `18:00`. Apontamentos existentes não são modificados.

## Prévia do informe de rendimentos e IRRF do PPR

A aba **Informe IR (prévia)** reúne os valores que podem ser comprovados diretamente pelos documentos. Na primeira versão, inclui **PPR bruto**, **IRRF retido sobre PPR**, **PPR líquido** e contribuição negocial, totalizados pelo **ano real de pagamento** do PPR. Rendimentos mensais identificados são apresentados apenas como indicadores por competência e **não são convertidos automaticamente em rendimento tributável anual**.

A interface permite lançar manualmente os campos informados no comprovante oficial da empresa, armazenados em `annual_tax_comparisons` com RLS por usuário. Para cada valor que o app conseguiu apurar, mostra a diferença `PDFs - informe oficial`. Ausência de holerites ou rubricas não vira zero fictício; o status é `Não apurado`.

O IRRF específico do PPR já fica salvo em `statements.ppr_income_tax`, além das rubricas originais em `statement_lines`. Ele aparece no histórico, consolidado anual, em Análises e na prévia de IR. **Não se mistura IRRF de PLR/PPR com IRRF salarial**, pois PLR paga por PJ no Brasil é sujeita a tributação exclusiva/definitiva. Fontes: Receita Federal, manual Meu Imposto de Renda 2026, Rendimentos do Trabalho; IN RFB 1500/2014 art. 17.

Próximas etapas de homologação: classificar por layouts e competência as rubricas de salários tributáveis, INSS, IRRF salarial, férias, 13º, pensão e previdência; identificar corretamente as datas de pagamentos mensais; importar o PDF oficial do comprovante e comparar automaticamente, sem substituí-lo como documento original. **Esta tela não é informe oficial nem permite entrega da declaração à Receita.**

## Férias: holerite mensal como principal, recibo opcional

A folha **MENSAL** continua sendo a fonte principal do histórico. No layout antigo, as rubricas de desconto `07200` (adiantamento de férias) e `07210` (adiantamento do 13º nas férias) permitem **estimar dinheiro já recebido**; elas não se transformam em remuneração tributável adicional. O líquido financeiro da competência = fechamento + adiantamento quinzenal + adiantamentos de férias/13º inferidos.

O recibo independente identificado como **Folha: FERIAS** pode ser importado separadamente, com competência, início/fim, data de pagamento, proventos, descontos, líquido e todas as rubricas. O recibo é **opcional** e nunca se soma por cima do valor da folha: ao encontrá-lo, o algoritmo vincula as competências que interceptam o período de férias, **substitui o adiantamento inferido** pelo líquido original do recibo e apresenta a diferença, se houver. O agrupamento financeiro fica no **mês de início das férias**, mesmo quando o pagamento real ocorreu no mês anterior. A data real é preservada para conciliação futura do imposto de renda, sem alterar a competência financeira.

A aba Histórico/Análises e a tela de Eventos exibem as ocorrências derivadas dos documentos com estados: **Estimado pela folha**, **Conciliado com recibo**, **Conciliação parcial**, **Diferença a conferir** ou **Somente recibo**. Mesmo com dois recibos iguais do mesmo período, o total não é duplicado. O arquivo PDF original continua privado no bucket `payslips`.

Para férias que atravessam competências ou misturam o layout antigo e novo, valores não identificáveis pelas rubricas de adiantamento não são inventados. A conciliação deve permanecer visivelmente pendente quando não fechar. O recibo não deve ser adicionado ao total de proventos tributáveis da folha mensal nem ao PPR.

Migração: `supabase/migrations/0009_vacation_documents.sql`. O código deriva os totais atuais a partir de `statements` e `statement_lines`; não sobrescreve os líquidos já armazenados.
