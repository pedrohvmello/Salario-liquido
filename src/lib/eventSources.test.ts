import {describe,expect,it} from 'vitest'
import {latestEffectiveEvent} from './eventSources'
import type {SalaryEvent} from './data'
const event=(kind:string,effective_date:string,value:number):SalaryEvent=>({
 id:kind+'-'+effective_date,kind,effective_date,value,notes:''
})
describe('Origem dos parâmetros de remuneração',()=>{
 const list=[
  event('salary','2024-11-01',12514.88),
  event('salary','2025-12-01',15340.57),
  event('trienio','2026-05-01',179),
  event('esppPercent','2025-11-28',10),
  event('thirteenth','2025-12-19',17854.65)
 ]
 it('exibe o evento mais recente aplicável à competência',()=>{
  expect(latestEffectiveEvent(list,'salary','2026-11')?.value).toBe(15340.57)
  expect(latestEffectiveEvent(list,'trienio','2026-11')?.value).toBe(179)
  expect(latestEffectiveEvent(list,'esppPercent','2026-11')?.value).toBe(10)
 })
 it('não antecipa vigências futuras ao consultar competências antigas',()=>{
  expect(latestEffectiveEvent(list,'salary','2025-06')?.value).toBe(12514.88)
  expect(latestEffectiveEvent(list,'trienio','2026-04')).toBeNull()
  expect(latestEffectiveEvent(list,'salary','2023-06')).toBeNull()
 })
 it('13º e demais ocorrências não alteram salário-base',()=>{
  expect(latestEffectiveEvent(list,'salary','2025-12')?.value).toBe(15340.57)
 })
})
