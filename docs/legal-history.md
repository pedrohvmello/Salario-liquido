# Histórico de documentos legais do Payrep

- A identificação pública de Política de Privacidade e Termos de Uso permanece **V1.0** enquanto o produto estiver na fase pré-lançamento. Nenhuma revisão pré-lançamento incrementa essa identificação sem autorização explícita.
- O histórico foi iniciado com **quatro revisões reais** de cada documento, recuperadas de commits GitHub de 12/11/2026. A identificação administrativa V1.0 das primeiras revisões é retrospectiva; o HTML arquivado é preservado exatamente como era.
- Para cada alteração em `public/privacidade.html` ou `public/termos.html`, ANTES de publicar HML ou PRD, criar um arquivo novo e imutável em `public/legal-history/<documento>-v1.0-rNN.html`, com os bytes integrais do HTML atualizado. Nunca sobrescrever arquivo de revisão anterior.
- Acrescentar a revisão no fim de `public/legal-history/manifest.json` com `id`, `version`, `revision`, `changedAt` em ISO 8601 UTC, `summary`, `path`, `sourceCommit` e `blobSha` Git blob SHA-1 calculado sobre `blob <tamanho_em_bytes>\\0<conteúdo>`. Atualizar `currentRevisionId`.
- O teste `publicPages.test.ts` impede que uma mudança no HTML atual seja implantada sem o snapshot correspondente; ele valida os hashes das revisões e compara os bytes do arquivo atual com o último snapshot.
- Em `Administração > Configurações > Histórico dos documentos legais`, o administrador seleciona documento e revisão. A consulta exibe os metadados e fornece um link para abrir a cópia integral arquivada em nova aba, sem pré-visualização incorporada.
- As páginas legais são documentos públicos, de modo que URLs dos arquivos arquivados também são acessíveis publicamente mesmo que a interface de pesquisa seja exibida apenas a administradores. Para restringir integralmente os arquivos históricos, será necessária entrega autenticada no servidor.
- Depois da abertura pública, não alterar as versões divulgadas retroativamente. Registrar uma nova versão, preservando os snapshots da V1.0; alterar `launchState` apenas mediante autorização explícita de lançamento.

## Revisões de 20/11/2026

- Política de Privacidade V1.0 revisão 06 e Termos de Uso V1.0 revisão 05 registram as alterações relativas a Pep, processamento externo de IA, planos e pagamentos Asaas, suporte por e-mail e exclusão de dados.
- Os HTMLs arquivados anteriores permanecem intocados, inclusive terminologia histórica. O conteúdo ao vivo das páginas públicas não deve exibir referências internas a HML/PRD.
- A identidade formal do controlador e os critérios detalhados de retenção continuam pendentes; a atualização de redação não substitui a validação jurídica pré-lançamento.

## Revisão do controlador e FAQ (20/11/2026)

- Controlador informado pelo operador: **Pedro Henrique Vieira de Mello**, pessoa física, contato `suporte@payrep.com.br`. CPF e endereço não foram fornecidos e não devem ser inventados.
- Política de Privacidade, revisão 07, e Termos de Uso, revisão 06. A política diferencia critérios de conservação por categoria, sem declarar expurgo periódico automático inexistente. A versão pública permanece V1.0.
- A revisão do FAQ e do Pep Ajuda utiliza fonte de conhecimento comum em `supabase/functions/support-ai/knowledge.ts`. Qualquer alteração funcional deve revisar Sobre, Privacidade, Termos, FAQ e conhecimento do Pep antes da publicação.

## Plano efetivo, acesso promocional e auditoria (21/11/2026)

- Privacidade V1.0 revisão 08 e Termos V1.0 revisão 07 refletem as concessões de Basic/Full, a revogação individual, os registros de auditoria e a separação entre permissão efetiva e cobrança Asaas.
- Revisões antigas preservadas. Não há alteração da etiqueta pública V1.0.
