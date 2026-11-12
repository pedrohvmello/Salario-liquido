import {describe,expect,it} from 'vitest'
import {buildPayrepTotpUri,PAYREP_TOTP_ISSUER} from './totpIssuer'

describe('Payrep TOTP issuer',()=>{
 it('uses Payrep as the service name and keeps the user identifier',()=>{
  const result=buildPayrepTotpUri('JBSWY3DPEHPK3PXP','pessoa@example.com')
  const uri=new URL(result)
  expect(PAYREP_TOTP_ISSUER).toBe('Payrep')
  expect(uri.protocol).toBe('otpauth:')
  expect(uri.hostname).toBe('totp')
  expect(decodeURIComponent(uri.pathname)).toBe('/Payrep:pessoa@example.com')
  expect(uri.searchParams.get('issuer')).toBe('Payrep')
  expect(uri.searchParams.get('secret')).toBe('JBSWY3DPEHPK3PXP')
  expect(uri.searchParams.get('digits')).toBe('6')
  expect(uri.searchParams.get('period')).toBe('30')
 })
 it('encodes arbitrary account labels and never changes the TOTP secret',()=>{
  const uri=new URL(buildPayrepTotpUri('JBSW Y3DP EHPK 3PXP','teste+web@exemplo.com'))
  expect(decodeURIComponent(uri.pathname)).toBe('/Payrep:teste+web@exemplo.com')
  expect(uri.searchParams.get('secret')).toBe('JBSWY3DPEHPK3PXP')
 })
 it('rejects malformed input to avoid creating invalid authenticator entries',()=>{
  expect(()=>buildPayrepTotpUri('bad','teste@example.com')).toThrow('Chave TOTP inválida.')
 })
})
