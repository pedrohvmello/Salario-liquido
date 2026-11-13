import {describe,expect,it} from 'vitest'
import {parseMailerooEmail,inspectMailerooEmail,safeValidationUrl} from '../../supabase/functions/support-inbound/validation'

const validUrl='https://inbound-api.maileroo.net/validate-callback/677730adac1b7a32de362cce/b71bfca7653deeb8802c87124ba65212'
const valid={
 _id:'677730adac1b7a32de362ccd',
 message_id:'abc.12345@provider.test',
 domain:'payrep.com.br',
 recipients:['hml-chamado-2026-0002-0123456789abcdef0123456789abcdef@payrep.com.br'],
 headers:{From:['Cliente <cliente@example.org>'],Subject:['Re: suporte']},
 body:{stripped_plaintext:'Resposta com contexto\nObrigado'},
 attachments:null,
 is_dmarc_aligned:true,
 is_spam:false,
 validation_url:validUrl
}
describe('Maileroo inbound Payrep webhook',()=>{
 it('accepts only HTTPS validation URLs on exact Maileroo host',()=>{
  expect(safeValidationUrl(validUrl)).toBe(true)
  for(const x of [
   'http://inbound-api.maileroo.net/validate-callback/677730adac1b7a32de362cce/b71bfca7653deeb8802c87124ba65212',
   'https://inbound-api.maileroo.net.evil.com/validate-callback/677730adac1b7a32de362cce/b71bfca7653deeb8802c87124ba65212',
   'https://inbound-api.maileroo.net@evil.com/validate-callback/677730adac1b7a32de362cce/b71bfca7653deeb8802c87124ba65212',
   'https://inbound-api.maileroo.net/validate-callback/677730adac1b7a32de362cce/b71bfca7653deeb8802c87124ba65212?redirect=http://evil.com',
   'https://127.0.0.1/validate-callback/677730adac1b7a32de362cce/b71bfca7653deeb8802c87124ba65212'
  ])expect(safeValidationUrl(x)).toBe(false)
 })
 it('parses a valid reply and extracts the latest message',()=>{
  expect(parseMailerooEmail(valid)).toEqual({
   eventId:valid._id,sourceMessageId:valid.message_id,recipient:valid.recipients[0],
   senderEmail:'cliente@example.org',body:valid.body.stripped_plaintext,
   validationUrl:validUrl
  })
 })
 it('rejects unsafe or irrelevant inbound messages',()=>{
  expect(parseMailerooEmail({...valid,is_spam:true})).toBeNull()
  expect(parseMailerooEmail({...valid,is_dmarc_aligned:false})).toBeNull()
  // Maileroo's domain field may not equal the routed recipient domain.
  // Only the full recipient address and the backend ticket lookup authorize delivery.
  expect(parseMailerooEmail({...valid,domain:'other.com'})).not.toBeNull()
  expect(parseMailerooEmail({...valid,domain:'gmail.com'})).not.toBeNull()
  expect(parseMailerooEmail({...valid,domain:undefined})).not.toBeNull()
  expect(parseMailerooEmail({...valid,recipients:['suporte@payrep.com.br']})).toBeNull()
  // Attachments are deliberately ignored, not downloaded into ticket messages.
  expect(parseMailerooEmail({...valid,attachments:[{filename:'image-signature.png'}]})).not.toBeNull()
  expect(parseMailerooEmail({...valid,recipients:[valid.recipients[0],valid.recipients[0].toUpperCase()]})).not.toBeNull()
  expect(parseMailerooEmail({...valid,headers:{From:['User <owner@example.org>'], 'Auto-Submitted':['auto-replied']}})).toBeNull()
  expect(parseMailerooEmail({...valid,body:{stripped_plaintext:''}})).toBeNull()
  expect(parseMailerooEmail({...valid,body:{stripped_plaintext:'x'.repeat(4001)}})).toBeNull()
  expect(parseMailerooEmail({...valid,validation_url:'https://127.0.0.1'})).toBeNull()
 })
 it('keeps HML and PRD recipient namespaces isolated',()=>{
  const hml=valid.recipients[0]
  const prd=hml.replace('hml-chamado-','chamado-')
  expect(parseMailerooEmail({...valid,recipients:[prd]})).toBeNull()
  expect(parseMailerooEmail({...valid,recipients:[prd]},'chamado')?.recipient).toBe(prd)
  expect(parseMailerooEmail({...valid,recipients:[hml]},'chamado')).toBeNull()
 })
 it('safely extracts plaintext when the provider has no stripped plaintext',()=>{
  const reply={...valid,body:{
   stripped_plaintext:'',plaintext:'Uma resposta de teste!\n\nOn Nov 13 2026 01:49, Suporte wrote:\n> Mensagem original'
  }}
  const result=inspectMailerooEmail(reply)
  expect(result.reason).toBeNull()
  expect(result.candidate?.body).toBe('Uma resposta de teste!')
 })
 it('removes multiline Gmail pt-BR attribution even inside stripped_plaintext',()=>{
  const result=inspectMailerooEmail({...valid,body:{
   stripped_plaintext:'Entendi. Obrigado\n\nEm sex., 13 de nov. de 2026, 06:26, Suporte Payrep <suporte@payrep.com.br>\nescreveu:',
   plaintext:'Entendi. Obrigado\n\nEm sex., 13 de nov. de 2026, 06:26, Suporte Payrep <suporte@payrep.com.br>\nescreveu:\n> conteúdo anterior'
  }})
  expect(result.candidate?.body).toBe('Entendi. Obrigado')
 })
 it('removes Gmail quoted message attribution after wrapped names and addresses',()=>{
  const result=inspectMailerooEmail({...valid,body:{
   stripped_plaintext:'Resposta nova\nSegunda linha\n\nEm sex., 13 de novembro de 2026, 06:26,\nSuporte Payrep\n<suporte@payrep.com.br>\nescreveu:\n> histórico citado'
  }})
  expect(result.candidate?.body).toBe('Resposta nova\nSegunda linha')
 })
 it('handles wrapped Gmail English quotation in stripped_plaintext',()=>{
  const result=inspectMailerooEmail({...valid,body:{
   stripped_plaintext:'Thanks for the answer.\n\nOn Fri, Nov 13, 2026 at 6:26 AM\nPayrep Support <suporte@payrep.com.br>\nwrote:\n> previous message'
  }})
  expect(result.candidate?.body).toBe('Thanks for the answer.')
 })
 it('preserves genuine new text and rejects quoted history without an answer',()=>{
  const regular=inspectMailerooEmail({...valid,body:{
   stripped_plaintext:'Eu escrevi: uma explicação.\nEm outro momento discutimos o cálculo.'
  }})
  expect(regular.candidate?.body).toBe('Eu escrevi: uma explicação.\nEm outro momento discutimos o cálculo.')
  const quoteOnly=inspectMailerooEmail({...valid,body:{
   stripped_plaintext:'\nEm sex., 13 de nov. de 2026, 06:26, Suporte Payrep <suporte@payrep.com.br>\nescreveu:\n> antigo'
  }})
  expect(quoteOnly.reason).toBe('missing_reply_text')
 })
 it('checks message size after removing old quoted history',()=>{
  const result=inspectMailerooEmail({...valid,body:{
   stripped_plaintext:'Mensagem curta\n\nEm sex., 13 de nov. de 2026, 06:26, Suporte Payrep <suporte@payrep.com.br>\nescreveu:\n>'+ 'antigo'.repeat(900)
  }})
  expect(result.candidate?.body).toBe('Mensagem curta')
 })
 it('returns safe diagnostic codes for unexpected provider formats',()=>{
  expect(inspectMailerooEmail({...valid,body:{stripped_plaintext:''}}).reason).toBe('missing_reply_text')
  expect(inspectMailerooEmail({...valid,recipients:[]}).reason).toBe('invalid_recipients')
  expect(inspectMailerooEmail({...valid,is_dmarc_aligned:false}).reason).toBe('unaligned_dmarc')
  expect(inspectMailerooEmail({...valid,headers:{}}).reason).toBe('missing_sender')
 })

})
