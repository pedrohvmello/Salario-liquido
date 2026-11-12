import {afterEach,describe,expect,it,vi} from 'vitest'
import {forgetRememberedCredential,passkeyHintKey,rememberedCredentialId,validCredentialId} from './devicePasskeys'

describe('passkey credential hint',()=>{
 afterEach(()=>vi.unstubAllGlobals())
 it('accepts only base64url encoded credential IDs',()=>{
  expect(validCredentialId('AbCdEf0123456789_-abc')).toBe(true)
  expect(validCredentialId('6a8f0e12-ff42-48d2-aa88-000000000000')).toBe(true)
  expect(validCredentialId('')).toBe(false)
  expect(validCredentialId('<script>injection</script>')).toBe(false)
  expect(validCredentialId('a'.repeat(1025))).toBe(false)
 })
 it('stores and forgets the hint without treating it as authorization',()=>{
  const records=new Map<string,string>()
  vi.stubGlobal('window',{localStorage:{
   getItem:(key:string)=>records.get(key)??null,
   setItem:(key:string,value:string)=>records.set(key,value),
   removeItem:(key:string)=>records.delete(key)
  }})
  expect(rememberedCredentialId()).toBe('')
  records.set(passkeyHintKey,'AbCdEf0123456789_-abc')
  expect(rememberedCredentialId()).toBe('AbCdEf0123456789_-abc')
  forgetRememberedCredential()
  expect(rememberedCredentialId()).toBe('')
 })
})
