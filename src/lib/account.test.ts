import {describe,expect,it} from 'vitest'
import {blankProfile,validateProfile} from './account'
describe('Payrep account profile validation',()=>{
 it('accepts a complete Brazilian address',()=>{
  const profile={...blankProfile(),display_name:'Pedro Henrique',phone:'(11) 99999-9999',postal_code:'04567-890',city:'São Paulo',state:'SP'}
  expect(validateProfile(profile).postal_code).toBe('04567-890')
 })
 it('requires a valid name',()=>expect(()=>validateProfile({...blankProfile(),display_name:'X'})).toThrow())
 it('rejects invalid CEP format',()=>expect(()=>validateProfile({...blankProfile(),display_name:'Maria Silva',postal_code:'1234'})).toThrow())
 it('rejects invalid phone characters',()=>expect(()=>validateProfile({...blankProfile(),display_name:'Maria Silva',phone:'telefone'})).toThrow())
 it('preserves optional empty fields',()=>{
  expect(validateProfile({...blankProfile(),display_name:'Maria Silva'}).phone).toBe('')
 })
})
