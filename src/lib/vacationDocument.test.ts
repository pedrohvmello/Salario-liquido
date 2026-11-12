import {describe,it,expect} from 'vitest'
import {vacationPeriodFromHeader,isVacationPayslip} from './vacationDocument'
const row=(text:string,y:number,items:Array<[string,number]>)=>({text,y,items:items.map(([value,x])=>({text:value,x,y}))})
describe('vacation PDF',()=>{
 const rows=[
  row('Folha: Período de Pagamento: Dt. pagt.:',500,[['Folha:',36],['Período de Pagamento:',175],['Dt. pagt.:',402]]),
  row('FERIAS 01/04/2024 a 30/04/2024 27/03/2024',480,
   [['FERIAS',36],['01/04/2024 a 30/04/2024',175],['27/03/2024',402]])
 ]
 it('identifies dedicated vacation payroll (not normal payroll)',()=>{
  expect(isVacationPayslip(rows)).toBe(true)
  expect(vacationPeriodFromHeader(rows)).toEqual({start:'2024-04-01',end:'2024-04-30'})
  expect(isVacationPayslip([rows[0],row('MENSAL',480,[['MENSAL',36]])])).toBe(false)
 })
})
