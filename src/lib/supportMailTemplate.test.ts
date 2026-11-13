import {describe,expect,it} from 'vitest'
import {renderSupportEmail} from '../../supabase/functions/support-mailer/template'

const base={
 kind:'admin_message' as const,status:'in_progress' as const,
 ticketCode:'2026-0004',
 subject:'Teste chamado',
 category:'conta',
 requesterName:'Pedro Henrique',
 requesterEmail:'usuario@example.com',
 message:'Olá. Obrigado pelo retorno.',
 appUrl:'https://payrep-hml.vercel.app',
 allowEmailReply:true
}
describe('Payrep HTML support notifications',()=>{
 it('includes Payrep logo, style, subject and an accessible link',()=>{
  const out=renderSupportEmail(base)
  expect(out.html).toContain('<!doctype html>')
  expect(out.html).toContain('lang="pt-BR"')
  expect(out.html).toContain('https://payrep-hml.vercel.app/icon-192.png')
  expect(out.html).toContain('#29064C')
  expect(out.html).toContain('Teste chamado')
  expect(out.html).toContain('Cadastro e conta')
  expect(out.html).toContain('Em atendimento')
  expect(out.html).toContain('Acompanhar chamado no Payrep')
  expect(out.plain).toContain('2026-0004')
 })
 it('instructs users to reply directly without changing subject or recipient',()=>{
  const out=renderSupportEmail(base)
  expect(out.html).toContain('Você pode responder a este e-mail')
  expect(out.html).toContain('Não altere o assunto nem o destinatário')
  expect(out.plain).toContain('Não altere o assunto nem o destinatário')
 })
 it('never invites email reply for a closed ticket or a support-facing ticket',()=>{
  for(const kind of ['ticket_opened','user_message','ticket_closed'] as const){
   const result=renderSupportEmail({...base,kind,status:kind==='ticket_closed'?'resolved':'open'})
   expect(result.html).not.toContain('Você pode responder a este e-mail')
   expect(result.plain).not.toContain('Não altere o assunto nem o destinatário')
  }
  const replyOff=renderSupportEmail({...base,allowEmailReply:false})
  expect(replyOff.html).not.toContain('Você pode responder a este e-mail')
 })
 it('uses the matching pastel badge for each ticket status',()=>{
  expect(renderSupportEmail({...base,status:'open'}).html).toContain('#FFF6D8')
  expect(renderSupportEmail({...base,status:'in_progress'}).html).toContain('#FFF0DE')
  expect(renderSupportEmail({...base,kind:'ticket_closed',status:'resolved'}).html).toContain('#E9F7EB')
 })
 it('escapes untrusted message, subject and requester name',()=>{
  const out=renderSupportEmail({...base,
   subject:'Teste <script>alert("x")</script>',
   requesterName:'<img src=x>',
   message:'<h1>Olá</h1> & obrigado\nAté amanhã'
  })
  expect(out.html).not.toContain('<script>')
  expect(out.html).not.toContain('<h1>Olá</h1>')
  expect(out.html).toContain('&lt;h1&gt;Olá&lt;/h1&gt; &amp; obrigado<br>Até amanhã')
  expect(out.html).toContain('&lt;img src=x&gt;')
  expect(out.plain).toContain('<h1>Olá</h1>')
 })
 it('does not create unsafe external links from untrusted app urls',()=>{
  expect(()=>renderSupportEmail({...base,appUrl:'http://payrep.example'})).toThrow()
  expect(()=>renderSupportEmail({...base,appUrl:'https://evil.example@payrep.example'})).toThrow()
 })
})
