# Payrep HML: autenticação por e-mail

## Template de confirmação (preparado, não aplicado automaticamente)

- Projeto: Supabase HML `nrpqcrhschztdwbfgnyo`
- Arquivo: `supabase/templates/confirmation.html`
- Assunto: `Payrep | Confirme seu e-mail`
- Template usa `{{ .ConfirmationURL }}` gerado pelo Supabase Auth.
- A identidade segue `supabase/functions/support-mailer/template.ts`: cabeçalho roxo escuro, ícone oficial, conteúdo branco, botão roxo e rodapé.
- Imagem: `https://payrep-hml.vercel.app/icon-192.png`.
- **Não** modificar o link para construção manual de token/OTP.

## Ativação na console HML

1. Supabase Dashboard > projeto HML > Authentication > Email Templates > Confirm signup.
2. Substituir o corpo HTML pelo arquivo e definir o assunto acima. Salvar. Os arquivos do repositório NÃO alteram o template hospedado por si só.
3. Authentication > SMTP Settings: configurar um remetente autenticado do domínio Payrep e o SMTP da Maileroo, caso ainda não esteja habilitado. Nunca incluir credenciais no GitHub ou no frontend.
4. Na Maileroo: utilizar uma conta SMTP autorizada para o domínio. Host `smtp.maileroo.com`, porta `587` (STARTTLS), usuário e senha da conta SMTP criada no serviço. Nome do remetente `Payrep`; endereço de remetente deve ser um endereço realmente validado no provedor.
5. Manter a exigência de confirmação de e-mail ativada e o redirecionamento HML na URL permitida.
6. Fazer uma inscrição com um endereço novo autorizado, confirmar entrega, identidade do remetente, clique no token e redirecionamento correto. Não reutilizar senha real ou endereço de terceiros para testes.
7. Replicar em PRD somente após autorização explícita; trocar URL do ícone para domínio de produção conforme configuração.

## Limitação atual

A integração conectada do Supabase disponibiliza SQL, Edge Functions e consultas, mas não uma ação para atualizar os Email Templates ou SMTP do Auth hospedado. Portanto este arquivo deve ser aplicado manualmente no painel antes de afirmar que o email foi alterado.

Documentação: https://supabase.com/docs/guides/auth/auth-email-templates e https://supabase.com/docs/guides/auth/auth-smtp .
