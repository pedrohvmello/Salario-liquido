# Payrep: modelo de redefinição de senha no Supabase Auth

## Escopo e situação

- **Preparado no código, pendente de configuração no painel do Supabase hospedado.**
- Projeto HML: `nrpqcrhschztdwbfgnyo`; modelo: `supabase/templates/recovery-hml.html`.
- Projeto PRD: `klvurrcmfrwetmynscjc`; modelo: `supabase/templates/recovery.html`.
- Assunto recomendado em ambos: **Payrep | Redefina sua senha**.
- Remetente desejado: **Payrep <noreply@payrep.com.br>**, condicionado à autorização do domínio no SMTP.
- Os arquivos são derivados do template visual de confirmação de conta do Payrep: cabeçalho roxo, ícone, conteúdo branco, CTA roxo e rodapé. O destino do botão continua **`{{ .ConfirmationURL }}`**, gerado pelo Supabase Auth. Não construir tokens, links ou hashes manualmente.

## Configuração por ambiente

1. No painel do projeto Supabase correto, abra **Authentication > Email Templates > Reset Password**. Defina o assunto e cole o conteúdo completo do template HTML correspondente ao ambiente. Salve.
2. Em **Authentication > SMTP Settings**, habilite SMTP personalizado caso ainda não esteja configurado neste projeto. Configure o provedor SMTP já utilizado pelo Payrep (Maileroo), com o host e a porta definidos na conta do provedor, o remetente **noreply@payrep.com.br** autorizado pelo domínio e o nome **Payrep**. Não copiar ou expor senha SMTP no repositório.
3. Ajuste os redirecionamentos autorizados de cada projeto para o domínio correspondente: HML `https://payrep-hml.vercel.app`, PRD `https://payrep.com.br`. Mantenha os redirecionamentos anteriores necessários.
4. Em uma conta de teste, use **Segurança > Enviar link para redefinir senha**. Confira remetente real, SPF/DKIM quando disponível, assunto, layout, abertura do link, redirecionamento correto, alteração de senha e expiração do link.
5. Faça a mesma validação separadamente em HML e PRD, pois configurações de Auth são independentes entre projetos.

## Observações

- O fluxo de solicitação já é `db.auth.resetPasswordForEmail(user.email,{redirectTo:window.location.origin})` em `src/components/AccountSecurityPage.tsx`. Não é necessário alterar essa chamada para mudar a aparência do e-mail.
- O remetente `noreply@mail.app.supabase.io` mostrado no print comprova que **aquele e-mail** foi entregue pelo provedor padrão do Supabase, não pelo `noreply@payrep.com.br`.
- O SMTP da Edge Function `support-mailer` é separado do SMTP de **Supabase Authentication**. Configurar o primeiro não altera o segundo.
- A integração Supabase disponível nesta conversa não expõe alteração de SMTP ou de Auth Email Templates hospedados. A ativação e o teste de entrega devem ser feitos no painel, sem encaminhar credenciais para o chat.

Documentação oficial: https://supabase.com/docs/guides/auth/auth-email-templates e https://supabase.com/docs/guides/auth/auth-smtp
