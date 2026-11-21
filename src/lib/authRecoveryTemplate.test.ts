import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'

describe('Payrep recovery email templates',()=>{
 for(const environment of ['production','hml'] as const){
  it('uses valid Supabase recovery token and Payrep branding in '+environment,()=>{
   const name=environment==='hml'?'recovery-hml.html':'recovery.html'
   const html=readFileSync('supabase/templates/'+name,'utf8')
   expect(html).toContain('<html lang="pt-BR">')
   expect(html).toContain('Redefina sua senha | Payrep')
   expect(html).toContain('Redefinir minha senha')
   expect(html).toContain('{{ .ConfirmationURL }}')
   expect(html.split('{{ .ConfirmationURL }}').length-1).toBe(1)
   expect(html).toContain('Não solicitou a alteração?')
   expect(html).toContain('background:#29064C')
   expect(html).toContain('background:#7900D6')
   expect(html).not.toContain('Confirme seu e-mail para continuar')
   expect(html).toContain(environment==='hml'?'https://payrep-hml.vercel.app/icon-192.png':'https://payrep.com.br/icon-192.png')
  })
 }
 it('keeps the recovery action delegated to Supabase Auth',()=>{
  const security=readFileSync('src/components/AccountSecurityPage.tsx','utf8')
  expect(security).toContain('db.auth.resetPasswordForEmail')
  expect(security).toContain('redirectTo:window.location.origin')
  expect(security).not.toContain('noreply@payrep.com.br')
 })
 it('is explicit that hosted SMTP and templates need activation',()=>{
  const docs=readFileSync('docs/auth-recovery-email.md','utf8')
  expect(docs).toContain('pendente de configuração no painel')
  expect(docs).toContain('noreply@payrep.com.br')
 })
})
