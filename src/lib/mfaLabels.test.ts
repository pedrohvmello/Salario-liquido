import {describe,it,expect} from 'vitest'
import {authenticatorApps,cleanMfaLabel,displayMfaLabel,mfaLabelMetadataKey,readMfaLabels} from './mfaLabels'
const id='f757ccfb-8075-4c94-b768-a0a496584395'
describe('MFA labels are cosmetic and per factor',()=>{
 it('reads a persisted alias for the correct factor',()=>{
  const metadata={[mfaLabelMetadataKey]:{[id]:'Microsoft Authenticator'}}
  expect(displayMfaLabel(id,'Payrep autenticador',metadata)).toBe('Microsoft Authenticator')
  expect(displayMfaLabel('039d7905-20ce-498b-9760-397729ce62f0','Google Authenticator',metadata)).toBe('Google Authenticator')
 })
 it('falls back safely on bad or absent metadata',()=>{
  expect(readMfaLabels(null)).toEqual({})
  expect(displayMfaLabel(id,'Payrep autenticador',{[mfaLabelMetadataKey]:{[id]:1}})).toBe('Payrep autenticador')
  expect(readMfaLabels({[mfaLabelMetadataKey]:{'__proto__':'malicious'}})).toEqual({})
 })
 it('validates labels and provider options',()=>{
  expect(authenticatorApps).toContain('Microsoft Authenticator')
  expect(cleanMfaLabel('  Microsoft   Authenticator  ')).toBe('Microsoft Authenticator')
  expect(()=>cleanMfaLabel(' ')).toThrow()
  expect(()=>cleanMfaLabel('x'.repeat(61))).toThrow()
 })
})
