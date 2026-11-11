import {describe,it,expect} from 'vitest'
import {accountInitials,profileDisplayName,canConfirmDeletion} from './profile'
describe('account profile menu',()=>{
 it('uses the same email initials as the old sidebar',()=>{
  expect(accountInitials({email:'pedrohvmello@example.com'})).toBe('PE')
  expect(accountInitials({email:'ana@example.com'})).toBe('AN')
  expect(accountInitials(null)).toBe('SL')
 })
 it('prefers updated display names over OAuth labels',()=>{
  expect(profileDisplayName({user_metadata:{display_name:'Nome escolhido',full_name:'Nome antigo'}})).toBe('Nome escolhido')
  expect(profileDisplayName({user_metadata:{full_name:'Nome antigo'}})).toBe('Nome antigo')
 })
 it('requires both explicit deletion confirmations',()=>{
  expect(canConfirmDeletion('EXCLUIR',false)).toBe(false)
  expect(canConfirmDeletion('excluir',true)).toBe(false)
  expect(canConfirmDeletion('EXCLUIR',true)).toBe(true)
 })
})
