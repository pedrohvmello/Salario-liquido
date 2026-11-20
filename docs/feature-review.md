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
