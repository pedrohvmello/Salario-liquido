import {afterEach,describe,expect,it,vi} from 'vitest'
import {autoPromptPreferred,passkeyAutoPreferenceKey,passkeyErrorMessage,setAutoPromptPreference,supportsWebAuthn} from './passkey'

describe('passkey support',()=>{
 afterEach(()=>vi.unstubAllGlobals())
 it('stores per-device automatic prompt opt out without affecting passkeys',()=>{
  const values=new Map<string,string>()
  vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v)}}})
  expect(autoPromptPreferred()).toBe(true)
  setAutoPromptPreference(false)
  expect(values.get(passkeyAutoPreferenceKey)).toBe('off')
  expect(autoPromptPreferred()).toBe(false)
  setAutoPromptPreference(true)
  expect(autoPromptPreferred()).toBe(true)
 })
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
