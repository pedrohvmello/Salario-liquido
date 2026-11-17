import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {
 checkPassword,passwordPolicyDefaults,validatePasswordPolicy,
 passwordRuleIndicators,passwordRequirements,isPasswordPolicy
} from './passwordPolicy'
describe('Supabase-synchronized password requirements',()=>{
 it('defaults to the previous HML baseline until verified',()=>{
  expect(passwordPolicyDefaults.minLength).toBe(12)
  expect(passwordPolicyDefaults.preset).toBe('mixed_case_numbers_symbols')
  expect(validatePasswordPolicy(passwordPolicyDefaults)).toBeNull()
 })
 it('supports Supabase-accepted requirements, not unsupported checkbox combinations',()=>{
  expect(validatePasswordPolicy({minLength:8,preset:'none'})).toBeNull()
  expect(validatePasswordPolicy({minLength:8,preset:'letters_numbers'})).toBeNull()
  expect(validatePasswordPolicy({minLength:10,preset:'mixed_case_numbers'})).toBeNull()
  expect(validatePasswordPolicy({minLength:14,preset:'mixed_case_numbers_symbols'})).toBeNull()
  expect(validatePasswordPolicy({minLength:7,preset:'none'})).not.toBeNull()
  expect(isPasswordPolicy({minLength:8,preset:'symbols_only'})).toBe(false)
 })
 it('validates all four groups for the strongest preset',()=>{
  expect(checkPassword('SenhaSuper123!')).toEqual([])
  expect(checkPassword('abcdefgh123!')).toContain('letra maiúscula')
  expect(checkPassword('ABCDEFGH123!')).toContain('letra minúscula')
  expect(checkPassword('abcdefghABC!')).toContain('número')
  expect(checkPassword('abcdefghABC12')).toContain('caractere especial')
  expect(passwordRuleIndicators('abcdefghABC12!',passwordPolicyDefaults)).toHaveLength(5)
 })
 it('handles a letters-and-numbers preset without forcing uppercase',()=>{
  const p={minLength:8,preset:'letters_numbers'} as const
  expect(checkPassword('abcdefgh123',p)).toEqual([])
  expect(checkPassword('123456789',p)).toContain('letra')
  expect(checkPassword('abcdefgh',p)).toContain('número')
  expect(passwordRequirements(p)).toContain('8 caracteres')
  expect(checkPassword('abc', {minLength:8,preset:'none'})).toEqual(['mínimo de 8 caracteres'])
 })
 it('performs management updates only through server-side admin verification and readback',()=>{
  const edge=readFileSync('supabase/functions/admin-password-policy/index.ts','utf8')
  const ui=readFileSync('src/components/AdminPasswordPolicy.tsx','utf8')
  const auth=readFileSync('src/components/AuthGate.tsx','utf8')
  const schema=readFileSync('supabase/migrations/0059_hml_synced_password_policy.sql','utf8')
  expect(edge).toContain("signedClient.rpc('is_app_admin')")
  expect(edge).toContain("Deno.env.get('PAYREP_AUTH_CONFIG_MANAGEMENT_TOKEN')")
  expect(edge).toContain("'PATCH'")
  expect(edge).toContain("apiFetch('GET')")
  expect(edge).toContain("if(!checked||!matchPolicy(checked,desired))")
  expect(schema).toContain('revoke all on public.payrep_password_policy')
  expect(schema).toContain('grant select,update on public.payrep_password_policy to service_role')
  expect(ui).toContain("callAuthPasswordPolicy('save',policy,saved)")
  expect(auth).toContain('loadPasswordPolicy()')
 })
})
