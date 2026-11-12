import {describe,expect,it} from 'vitest'
import {accessScreenFor,adminNeedsTotp,membershipAccessState} from './accessGate'

const id='user-one'
describe('membership gate',()=>{
 it('does not mislabel loading or a different user as awaiting approval',()=>{
  expect(accessScreenFor(id,null)).toBe('checking')
  expect(accessScreenFor(id,{userId:id,state:'checking'})).toBe('checking')
  expect(accessScreenFor(id,{userId:'user-two',state:'approved'})).toBe('checking')
  expect(accessScreenFor(id,{userId:'user-two',state:'pending'})).toBe('checking')
 })
 it('only shows pending and denied states when the lookup resolved',()=>{
  expect(accessScreenFor(id,{userId:id,state:'pending'})).toBe('pending')
  expect(accessScreenFor(id,{userId:id,state:'suspended'})).toBe('suspended')
  expect(accessScreenFor(id,{userId:id,state:'rejected'})).toBe('rejected')
  expect(accessScreenFor(id,{userId:id,state:'error'})).toBe('error')
  expect(accessScreenFor(id,{userId:id,state:'enroll-mfa'})).toBe('enroll-mfa')
  expect(accessScreenFor(id,{userId:id,state:'approved'})).toBe('approved')
 })
 it('keeps network errors separate and correctly maps membership',()=>{
  expect(membershipAccessState(null)).toBe('pending')
  expect(membershipAccessState({active:false,role:'member',status:'pending'})).toBe('pending')
  expect(membershipAccessState({active:false,role:'member',status:'suspended'})).toBe('suspended')
  expect(membershipAccessState({active:false,role:'member',status:'rejected'})).toBe('rejected')
  expect(membershipAccessState({active:true,role:'admin',status:'approved'})).toBe('approved')
 })
 it('requires verified TOTP for active approved admins only',()=>{
  const admin={active:true,role:'admin' as const,status:'approved' as const}
  const member={active:true,role:'member' as const,status:'approved' as const}
  expect(adminNeedsTotp(admin,0,true)).toBe(true)
  expect(adminNeedsTotp(admin,1,true)).toBe(false)
  expect(adminNeedsTotp(admin,0,false)).toBe(false)
  expect(adminNeedsTotp(member,0,true)).toBe(false)
  expect(adminNeedsTotp({...admin,active:false},0,true)).toBe(false)
  expect(adminNeedsTotp({...admin,status:'suspended'},0,true)).toBe(false)
 })

})
