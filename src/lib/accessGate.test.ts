import {describe,expect,it} from 'vitest'
import {accessScreenFor,membershipAccessState} from './accessGate'

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
  expect(accessScreenFor(id,{userId:id,state:'approved'})).toBe('approved')
 })
 it('keeps network errors separate and correctly maps membership',()=>{
  expect(membershipAccessState(null)).toBe('pending')
  expect(membershipAccessState({active:false,role:'member',status:'pending'})).toBe('pending')
  expect(membershipAccessState({active:false,role:'member',status:'suspended'})).toBe('suspended')
  expect(membershipAccessState({active:false,role:'member',status:'rejected'})).toBe('rejected')
  expect(membershipAccessState({active:true,role:'admin',status:'approved'})).toBe('approved')
 })
})
