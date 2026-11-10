import {describe,expect,it} from 'vitest'
import {requiresPasswordSetup} from './authRedirect'
describe('authentication callback intent',()=>{
  it('requires a password screen for recovery links',()=>expect(requiresPasswordSetup('recovery')).toBe(true))
  it('requires a password screen for invitation links',()=>expect(requiresPasswordSetup('invite')).toBe(true))
  it('does not force password on Google sign-in',()=>expect(requiresPasswordSetup(undefined)).toBe(false))
  it('does not force password on ordinary email confirmations',()=>expect(requiresPasswordSetup('signup')).toBe(false))
})
