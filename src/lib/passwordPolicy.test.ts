import {describe,it,expect} from 'vitest'
import {checkPassword,passwordPolicyDefaults,validatePasswordPolicy} from './passwordPolicy'
describe('Phase 1 password baseline',()=>{
 it('requires at least twelve characters',()=>{
  expect(passwordPolicyDefaults.minLength).toBe(12)
  expect(validatePasswordPolicy({...passwordPolicyDefaults,minLength:8})).toBeTruthy()
  expect(validatePasswordPolicy({...passwordPolicyDefaults,minLength:12})).toBeNull()
 })
 it('requires all four character groups',()=>{
  expect(checkPassword('SenhaSuper123!')).toEqual([])
  expect(checkPassword('abcdefgh123!')).toContain('letra maiúscula')
  expect(checkPassword('ABCDEFGH123!')).toContain('letra minúscula')
  expect(checkPassword('abcdefghABC!')).toContain('número')
  expect(checkPassword('abcdefghABC12')).toContain('caractere especial')
 })
 it('rejects shorter passwords',()=>{
  expect(checkPassword('Abcdef12!')).toContain('mínimo de 12 caracteres')
 })
})
