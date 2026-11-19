import {describe,expect,it} from 'vitest'
import {readDependentCounts,type DependentHeaderRow} from './dependents'
const row=(text:string,y:number,items:Array<{text:string;x:number}>=[]):DependentHeaderRow=>({text,y,items})
describe('Payslip dependent header extraction',()=>{
 it('distinguishes IRRF and general dependents on the October 2026 layout',()=>{
  expect(readDependentCounts([
   row('Admissão Dep.IR Dep.',430,[{text:'Dep.IR',x:680},{text:'Dep.',x:765}]),
   row('01.04.2020 1 2',410,[{text:'1',x:687},{text:'2',x:774}])
  ])).toEqual({irrf:1,total:2})
 })
 it('accepts both values on one line',()=>{
  expect(readDependentCounts([row('Dep.IR: 1 Dep.: 2',420)]))
   .toEqual({irrf:1,total:2})
 })
 it('accepts explicit long labels without treating total as IRRF',()=>{
  expect(readDependentCounts([row('Dependentes IRRF: 1; Dependentes: 2',410)]))
   .toEqual({irrf:1,total:2})
 })
 it('keeps missing values unknown rather than inferring from an unrelated count',()=>{
  expect(readDependentCounts([row('Salário base 15340,57; Dep.: 2',420)]))
   .toEqual({irrf:null,total:2})
  expect(readDependentCounts([row('Férias / valor dependentes inexistente',420)]))
   .toEqual({irrf:null,total:null})
 })
 it('accepts an explicit zero and rejects implausible counts',()=>{
  expect(readDependentCounts([row('Dep.IR 0  Dep. 31',420)]))
   .toEqual({irrf:0,total:null})
 })
})
