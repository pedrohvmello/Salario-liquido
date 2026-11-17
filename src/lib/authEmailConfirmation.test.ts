import {describe,expect,it} from 'vitest'
import {isUnconfirmedEmailError} from './authEmailConfirmation'
describe('Auth unconfirmed email status',()=>{
 it('recognizes the Supabase error code',()=>{
  expect(isUnconfirmedEmailError({code:'email_not_confirmed',message:'Email not confirmed'})).toBe(true)
 })
 it('supports older English error payloads',()=>{
  expect(isUnconfirmedEmailError({message:'Email not confirmed'})).toBe(true)
 })
 it('does not convert wrong credentials or unrelated errors into confirmation instructions',()=>{
  expect(isUnconfirmedEmailError({code:'invalid_credentials',message:'Invalid login credentials'})).toBe(false)
  expect(isUnconfirmedEmailError({code:'over_email_send_rate_limit'})).toBe(false)
  expect(isUnconfirmedEmailError(null)).toBe(false)
 })
})
