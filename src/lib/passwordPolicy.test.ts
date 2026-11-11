import {describe,it,expect} from 'vitest'
import {checkPassword,passwordPolicyDefaults,validatePasswordPolicy} from './passwordPolicy'
describe('password policy preview',()=>{
 it('rejects invalid minimum limits',()=>{expect(validatePasswordPolicy({...passwordPolicyDefaults,minLength:6})).toBeTruthy();expect(validatePasswordPolicy({...passwordPolicyDefaults,minLength:12})).toBeNull()})
 it('validates all configured character groups',()=>{expect(checkPassword('Abcdefg1!',passwordPolicyDefaults)).toEqual([]);expect(checkPassword('abcdefgh',passwordPolicyDefaults)).toContain('letra maiúscula');expect(checkPassword('ABCDEFGH',passwordPolicyDefaults)).toContain('número')})
 it('does not require groups when disabled',()=>{expect(checkPassword('aaaaaaaa',{minLength:8,requireLetters:false,requireUppercase:false,requireNumbers:false,requireSymbols:false})).toEqual([])})
})
