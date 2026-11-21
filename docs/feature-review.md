# Revisão obrigatória das informações do Payrep

Sempre que uma funcionalidade, regra de plano, autenticação, cobrança, privacidade ou integração mudar, antes do deploy:

1. Conferir e, se necessário, atualizar `public/sobre.html`.
2. Conferir e, se necessário, atualizar `public/privacidade.html` e arquivar nova revisão integral V1.0 no histórico.
3. Conferir e, se necessário, atualizar `public/termos.html` e arquivar nova revisão integral V1.0 no histórico.
4. Conferir e atualizar o FAQ em `supabase/functions/support-ai/knowledge.ts`.
5. Conferir o comportamento do Pep Ajuda, as restrições por plano, a privacidade e o conteúdo de sua base de conhecimento. Publicar a Edge Function em HML e PRD quando a base do Pep mudar.

Após revisar os cinco itens, registrar a decisão em `docs/feature-review.json`, inclusive quando não houver mudança textual. Atualizar os fingerprints de `src`, `supabase/functions` e `supabase/migrations` com os hashes de árvore do Git após preparar/stagear o código. A pipeline `scripts/check-feature-review.cjs` bloqueia build se código mudar sem registrar a revisão.

Orientação para calcular hashes de árvores do commit: `git rev-parse HEAD:src`, `git rev-parse HEAD:supabase/functions`, `git rev-parse HEAD:supabase/migrations`. Para árvore preparada mas não commitada, use `git write-tree` e examine as subárvores. A revisão não é um mecanismo automático de avaliação jurídica; ela é uma trava documental que obriga uma decisão humana explícita.

Nunca sobrescrever revisões antigas. Manter a etiqueta pública V1.0 até autorização formal de lançamento. As contas, planos e pagamentos em HML e PRD são distintos e não devem ser copiados ou misturados. Preservar a conta administradora.

## Revisão da busca no FAQ, oferta do Pep e navegação (20/11/2026)

- **Sobre:** atualizado para descrever a pesquisa local no FAQ com categorias e perguntas recolhidas por padrão.
- **Privacidade:** revisada sem alteração textual. A pesquisa é local sobre textos públicos do FAQ, sem nova transmissão de dados pessoais; o tratamento do Pep pessoal e do Asaas permanece igual.
- **Termos:** revisados sem alteração textual. O novo convite à contratação apenas apresenta recursos já descritos, sem novo preço, período gratuito ou direito contratual.
- **FAQ:** adicionada orientação sobre a pesquisa instantânea; categorias fechadas inicialmente e resultados exibidos automaticamente durante a digitação.
- **Pep Ajuda:** atualizado no conhecimento compartilhado para explicar o novo recurso de busca; mantém isolamento de dados e controles de quota.
- **Interface:** o bloqueio do Pep pessoal Free apresenta benefícios de Basic e Full e direciona à tela Assinatura, que determina preços e disponibilidade atuais. Botão Voltar removido dessa oferta. Menu reorganizado para Visão geral > Meus Holerites > Eventos e vigências.
- **Versionamento legal:** Política V1.0 revisão 07 e Termos V1.0 revisão 06 inalterados, pois não ocorreram mudanças na finalidade de tratamento nem nas condições comerciais.

## Vídeo de apresentação do Pep (20/11/2026)

- **Sobre:** revista sem alteração: descrição do Pep pessoal e Pep Ajuda continua correta.
- **Privacidade:** revista sem alteração: vídeo promocional público não lê dados de usuário nem utiliza IA por si só; não introduz novo tratamento de dados pessoais.
- **Termos:** revistos sem alteração: vídeo apresenta funcionalidades sem alterar planos, direitos, preços ou cancelamento.
- **FAQ:** revisto sem alteração: como acessar o Pep e conhecer planos já consta nas orientações.
- **Pep Ajuda:** revisto sem alteração: responde às mesmas perguntas e conserva a mesma base de conhecimento.
- **Interface:** substituir imagem estática do Pep no paywall por animação existente `pep-chat-loop.mp4`, com fallback estático e preferência por movimento reduzido; incluir o vídeo promocional enviado pelo titular tanto no paywall quanto na Home, com controles e áudio apenas mediante reprodução iniciada pelo visitante.
- **Mídia:** original 1920x1080, 10 segundos, com áudio. Versão publicada em H.264/AAC 960x540 (~530 KB), com poster WebP. Arquivos de apresentação são estáticos e compartilhados entre os frontends HML e PRD; não alteram os buckets de cada Supabase.
- **Versionamento:** permanece V1.0 e as revisões legais arquivadas não foram alteradas.

## Gestão de planos efetivos e promoções (21/11/2026)

- **Sobre:** atualizada para descrever alteração administrativa de plano e promoções Basic/Full.
- **Política de Privacidade:** revista com os novos dados de auditoria: usuário, concessor, plano, código, datas e revogação. Revisão 08 da V1.0 arquivada.
- **Termos de Uso:** explicada a separação do plano efetivo e da assinatura financeira, com revogação promocional. Revisão 07 da V1.0 arquivada.
- **FAQ:** adicionadas cinco respostas sobre acesso efetivo, concessão e revogação, usuários por código e alteração administrativa de plano.
- **Pep Ajuda:** atualizada a base compartilhada; o limite de consultas e isolamento de dados pessoais permanecem intactos.
- **Interface e autenticação:** área administrativa com busca de usuários, planos Free/Basic/Full, concessões temporárias, históricos, dias restantes e confirmação antes de revogar. Entrada no painel reforçada por recuperação da rota de Visão geral e fallback de erro. `paid` é traduzido para **Pago**, sem mudar dados de provedor.
- **Pagamentos:** nenhuma concessão altera ou cancela assinaturas Asaas; alterações administrativas de acesso têm auditoria.

## Franquias contratadas e apresentação dos planos (21/11/2026)

- **Sobre:** atualizado com a franquia pessoal do Pep registrada no checkout.
- **Privacidade:** revisão 09 da V1.0 arquivada, incluindo o dado sobre franquia do Pep em registros financeiros.
- **Termos:** revisão 08 da V1.0 arquivada, explicando mínimo contratado, cotas diárias, cota global e dependência de terceiros.
- **FAQ:** incluídas respostas sobre benefício e limitações, cotas imutáveis e filtro por plano na gestão de usuários.
- **Pep Ajuda:** conhecimento alinhado aos novos benefícios e condições, sem alterar a lógica do modelo.
- **Front-end:** mascote estático no banner roxo, vídeo menor e automático sem controles de transporte (som somente pelo botão de hover), cards de filtro e edição visualmente separada, assinantes consolidados.
- **Back-end:** limites pessoais de consultas do Pep são capturados no checkout no banco de dados, preservados pelo vínculo verificado do Asaas e consultados como maior entre limite geral e mínimo contratado. Os limites globais e externos não são garantidos pelo contrato pessoal.

## Banner Pep com animação transparente nativa (21/11/2026)

- **Sobre:** revisada. Mudança exclusivamente visual; descrição das funcionalidades permanece adequada.
- **Política de Privacidade:** revisada. Arquivo WebM local, sem terceiros ou novas transferências de dados; nenhuma alteração documental necessária.
- **Termos de Uso:** revisados. O vídeo ilustrativo não altera condições comerciais ou limitações; sem revisão documental adicional.
- **FAQ:** revisado. Nenhuma mudança de operação ou instrução de uso; sem novas perguntas necessárias.
- **Pep Ajuda:** revisado. Conhecimento, limites e Edge Function inalterados; este vídeo se aplica apenas ao cabeçalho da oferta de upgrade do Pep pessoal.
- **Implementação:** mídia VP9 WebM com canal alpha real, armazenada em `public/media/pep-banner-transparente.webm`, reproduzida sem áudio, em loop, sem controles, diretamente no navegador. A imagem do Pep é fallback até o início da reprodução, em falhas e quando a preferência do sistema reduz animações.
- **Escopo e segurança:** não modifica o vídeo institucional já existente, pagamentos, assinatura, banco de dados nem autenticação.

## Troca da animação do banner Pep (21/11/2026)

- Sobre, Privacidade, Termos, FAQ e Pep Ajuda: revisados; substituição apenas de mídia decorativa local, sem mudanças de operação, dados pessoais, benefícios ou contrato.
- Novo arquivo: public/media/pep-banner-v2-transparente.webm, gerado do MP4 fornecido pelo responsável. Fundo verde removido, transparência VP9 alpha confirmada, 10 s, 400 × 560, sem áudio. Caminho versionado evita reutilização de vídeo antigo em cache.
- Interface: somente o banner roxo de upgrade do Pep pessoal foi alterado. Mantidos loop silencioso, imagem fallback, movimento reduzido e vídeo institucional original.
- Segurança e dados: nenhuma alteração em Edge Functions, autenticação, planos, pagamentos, banco ou políticas de acesso.

## Informe IR Free, Definições e Regime de Jornada (21/11/2026)

- **Sobre:** descrição atualizada de informe de rendimentos e regime de jornada, com saldo informativo sem banco para cargo de confiança.
- **Política de Privacidade:** V1.0 revisão 10, informando que a preferência regular/cargo de confiança é armazenada em user_settings, sem apagar históricos existentes.
- **Termos de Uso:** V1.0 revisão 09, esclarecendo que a seleção no aplicativo não determina o enquadramento legal e que saldo informativo não representa crédito de banco ou pagamento de horas extras.
- **FAQ:** quatro respostas novas sobre Base e Regime de Jornada, efeitos do cargo de confiança, cálculo do saldo informativo e proposta de planos no Informe IR.
- **Pep Ajuda:** mesma base do FAQ, com explicação das alterações, limitações do Free e registros históricos.
- **Produto:** Base e Regime de Jornada são painéis HTML details inicialmente recolhidos; Jornada regular é o padrão persistido. Cargo de confiança suprime cálculos de extras e banco, não altera dias registrados, mas permite registro voluntário e saldo informativo por jornada completa versus política (ou 8h em dias úteis).
- **Informe IR:** para Free sem documentos, tela de benefícios e CTA para Assinatura; com documentos anteriores, permite continuar consultando. Basic/Full continuam com importação e revisão do PDF.
- **Banco:** coluna work_regime com check e default regular. Nenhuma migração, remoção ou recálculo dos registros time_entries.
