import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {sessionAuthTransition} from './sessionAuthTransition'

describe('Payrep session continuity when returning to a tab',()=>{
 const sameId='16fe755b-0619-400e-beb0-294443215780'
 const otherId='abb324f3-2da3-4941-ad12-3df98159a72b'
 it('does not reset UI on SIGNED_IN for the same account on focus',()=>{
  expect(sessionAuthTransition('SIGNED_IN',sameId,sameId)).toEqual({
   resetMfa:false,backgroundMfaCheck:true
  })
 })
 it('does not reset UI on normal access token renewal',()=>{
  expect(sessionAuthTransition('TOKEN_REFRESHED',sameId,sameId)).toEqual({
   resetMfa:false,backgroundMfaCheck:true
  })
 })
 it('requires revalidation on login, sign out and account switch',()=>{
  expect(sessionAuthTransition('INITIAL_SESSION',null,sameId).resetMfa).toBe(true)
  expect(sessionAuthTransition('SIGNED_IN',null,sameId).resetMfa).toBe(true)
  expect(sessionAuthTransition('SIGNED_IN',sameId,otherId).resetMfa).toBe(true)
  expect(sessionAuthTransition('SIGNED_OUT',sameId,null)).toEqual({
   resetMfa:true,backgroundMfaCheck:false
  })
 })
 it('does not restart the auth gate for updates to a signed-in user',()=>{
  expect(sessionAuthTransition('USER_UPDATED',sameId,sameId)).toEqual({
   resetMfa:false,backgroundMfaCheck:false
  })
  expect(sessionAuthTransition('INITIAL_SESSION',null,null)).toEqual({
   resetMfa:false,backgroundMfaCheck:false
  })
 })
 it('bootstraps auth from a single callback and defers background MFA checks',()=>{
  const app=readFileSync('src/App.tsx','utf8')
  expect(app).not.toContain("db.auth.getSession().then")
  expect(app).toContain('const change=sessionAuthTransition(event,authUserIdRef.current,nextUserId)')
  expect(app).toContain('if(mfaEnabled&&change.resetMfa)')
  expect(app).toContain('if(mfaEnabled&&change.backgroundMfaCheck)')
  expect(app).toContain('const nextState=mfaGateForAssurance(result.data,result.error)')
  expect(app).toContain("if(nextState!=='ready')setMfaState(nextState)")
  expect(app).toContain("setAuthReady(true)")
 })
})
