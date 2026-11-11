import {describe,expect,it} from 'vitest'
import {planCount,localityCounts} from './adminMetrics'
describe('registered users by plan and locality',()=>{
 const users=[
  {plan:'free' as const,city:'São Paulo',state:'SP'},
  {plan:'free' as const,city:'São Paulo',state:'SP'},
  {plan:'basic' as const,city:'Campinas',state:'SP'},
  {plan:'full' as const,city:'',state:''}
 ]
 it('counts each plan, including Free accounts',()=>expect(planCount(users)).toEqual({free:2,basic:1,full:1}))
 it('groups users by city and state and exposes missing locality',()=>{
  expect(localityCounts(users)).toEqual([
   {location:'São Paulo / SP',count:2},
   {location:'Campinas / SP',count:1},
   {location:'Não informado',count:1}
  ])
 })
})
