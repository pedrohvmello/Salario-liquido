# Plano de entrega e critérios de aceite

## Sprint 1: base multiusuário e interface (esta branch)
- [x] Base React responsiva, navegação e demo sintética sem persistência
- [x] Migração SQL com RLS e storage privado
- [x] Autenticação por convite (exige provisionamento Supabase)
- [x] Eventos com vigência e jornada por dia
- [x] Calculadora 2026 e testes unitários iniciais
- [x] Leitura inicial de PDFs novos/antigos e prévia para confirmar
- [ ] Execução da migração em projeto Supabase e teste real de isolamento com 2 usuários
- [ ] Validação visual e testes E2E das telas com banco ativo
- [ ] Homologação do importador com 41 holerites reais, FORA do GitHub
- [ ] Revisão independente e aceite

## Sprint 2: exatidão e conciliação
- Testes para todos os layouts, rubricas e rodapés com PDFs privados
- Conciliar totais de proventos/descontos/líquidos e identificar exceções (férias, bonificações)
- Dicionário versionado de rubricas e mapeamento de eventos com confirmação
- Calendário anual e DSR calibrado com critérios do empregador
- Histórico/visualização do PDF privado por URL assinada
- Tabelas tributárias por competência, incluindo férias e 13º
- Evolução da pensão real x simulação (com decisão judicial validada)

## Sprint 3: piloto com até 20 pessoas
- Convites automatizados pelo backend, recuperação de senha, administração sem ver salários
- Importadores pluggáveis por empregador, lançamento manual e revisão de rubricas
- Backup/exportação/eliminação sob solicitação, LGPD, termos e privacidade
- Proteção contra duplicatas, limites, auditoria, monitoramento e testes de permissão
- Homologação explícita e autorização antes de deploy de produção

## Critérios de bloqueio
- Nenhuma publicação com dados reais sem RLS verificada.
- Nenhuma mutação automática de eventos baseada em PDF sem revisão.
- Nenhuma simulação tributária apresentada como homologada.
- Nenhuma cópia dos PDFs reais ou dados de usuário em commit, issue pública, CI logs ou fixture.
