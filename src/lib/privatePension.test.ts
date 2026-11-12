import {describe,expect,it} from 'vitest'
import {effectiveParams,eventsKinds,type SalaryEvent} from './data'
import {calculatePayroll2026,defaults} from './money'

function event(kind:string,value:number,effective_date:string):SalaryEvent{
 return {id:kind+':'+effective_date,kind,value,effective_date,notes:''}
}

describe('Previdência calculada automaticamente',()=>{
 it('não oferece evento manual de Previdência R$',()=>{
  expect(eventsKinds.some(([kind])=>kind==='privatePensionFixed')).toBe(false)
  expect(eventsKinds.some(([kind])=>kind==='privatePensionPercent')).toBe(true)
 })
 it('desconsidera legado de valor fixo sem excluir dados',()=>{
  const history=[
   event('salary',12000,'2024-01-01'),
   event('privatePensionPercent',2,'2024-01-01'),
   event('privatePensionFixed',450,'2024-01-01'),
   event('salary',15340.57,'2025-12-01')
  ]
  const effective=effectiveParams(defaults,history,'2026-11')
  expect(effective.privatePensionPercent).toBe(2)
  expect(effective.privatePensionFixed).toBe(0)
  expect(calculatePayroll2026(effective).privatePension).toBe(306.81)
  expect(history).toHaveLength(4)
 })
 it('não antecipa alíquotas futuras para meses anteriores',()=>{
  const history=[event('salary',12000,'2024-01-01'),event('privatePensionPercent',2,'2026-01-01'),event('privatePensionPercent',3,'2027-01-01')]
  expect(calculatePayroll2026(effectiveParams(defaults,history,'2025-12')).privatePension).toBe(0)
  expect(calculatePayroll2026(effectiveParams(defaults,history,'2026-12')).privatePension).toBe(240)
  expect(calculatePayroll2026(effectiveParams(defaults,history,'2027-01')).privatePension).toBe(360)
 })
})
