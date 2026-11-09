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
