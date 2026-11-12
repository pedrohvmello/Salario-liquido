import {describe,expect,it} from 'vitest'
import {passkeyErrorMessage,supportsWebAuthn} from './passkey'

describe('passkey support',()=>{
 it('does not assume browser WebAuthn exists in non-browser environments',()=>{
  expect(supportsWebAuthn()).toBe(false)
 })
 it('explains missing backend, cancelled user gesture and origin mismatch',()=>{
  expect(passkeyErrorMessage(new Error('passkey_disabled'))).toContain('Supabase')
  expect(passkeyErrorMessage(new DOMException('Not allowed','NotAllowedError'))).toContain('cancelada')
  expect(passkeyErrorMessage(new DOMException('RP ID mismatch','SecurityError'))).toContain('domínio')
  expect(passkeyErrorMessage(new DOMException('InvalidStateError','InvalidStateError'))).toContain('já está cadastrada')
 })
 it('keeps safe messages for unknown failures',()=>{
  expect(passkeyErrorMessage(new Error('Falha de comunicação'))).toBe('Falha de comunicação')
  expect(passkeyErrorMessage(null)).toContain('Não foi possível')
 })
})
