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
  expect(parseMailerooEmail({...valid,domain:'other.com'})).toBeNull()
  expect(parseMailerooEmail({...valid,recipients:['suporte@payrep.com.br']})).toBeNull()
  expect(parseMailerooEmail({...valid,recipients:[valid.recipients[0],valid.recipients[0]]})).toBeNull()
  // Attachments are deliberately ignored, not downloaded into ticket messages.
  expect(parseMailerooEmail({...valid,attachments:[{filename:'image-signature.png'}]})).not.toBeNull()
  expect(parseMailerooEmail({...valid,recipients:[valid.recipients[0],valid.recipients[0].toUpperCase()]})).not.toBeNull()
  expect(parseMailerooEmail({...valid,headers:{From:['User <owner@example.org>'], 'Auto-Submitted':['auto-replied']}})).toBeNull()
  expect(parseMailerooEmail({...valid,body:{stripped_plaintext:''}})).toBeNull()
  expect(parseMailerooEmail({...valid,body:{stripped_plaintext:'x'.repeat(4001)}})).toBeNull()
  expect(parseMailerooEmail({...valid,validation_url:'https://127.0.0.1'})).toBeNull()
 })
 it('safely extracts plaintext when the provider has no stripped plaintext',()=>{
  const reply={...valid,body:{
   stripped_plaintext:'',plaintext:'Uma resposta de teste!\n\nOn Nov 13 2026 01:49, Suporte wrote:\n> Mensagem original'
  }}
  const result=inspectMailerooEmail(reply)
  expect(result.reason).toBeNull()
  expect(result.candidate?.body).toBe('Uma resposta de teste!')
 })
 it('returns safe diagnostic codes for unexpected provider formats',()=>{
  expect(inspectMailerooEmail({...valid,body:{stripped_plaintext:''}}).reason).toBe('missing_reply_text')
  expect(inspectMailerooEmail({...valid,recipients:[]}).reason).toBe('invalid_recipients')
  expect(inspectMailerooEmail({...valid,is_dmarc_aligned:false}).reason).toBe('unaligned_dmarc')
  expect(inspectMailerooEmail({...valid,headers:{}}).reason).toBe('missing_sender')
 })

})
