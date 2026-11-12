import {describe,expect,it} from 'vitest'
import {isPprPayslip,paymentDateFromHeader,pprDetails,makePprEvent,type PdfRow} from './ppr'
const row=(label:string,y:number,items:Array<[string,number]>):PdfRow=>({text:label,y,items:items.map(([text,x])=>({text,x,y}))})
describe('PPR document (fictional values)',()=>{
 const header=[
  row('Folha: Dt. pagt.:',500,[['Folha:',37],['Dt. pagt.:',403]]),
  row('PPR 15/11/2025',485,[['PPR',37],['15/11/2025',403]])
 ]
 it('recognizes PPR in payroll type header and payment date',()=>{
  expect(isPprPayslip(header)).toBe(true)
  expect(paymentDateFromHeader(header)).toBe('2025-11-15')
 })
 it('does not confuse a PPR mention in a monthly payroll',()=>{
  const monthly=[row('Folha:',500,[['Folha:',37]]),row('MENSAL',485,[['MENSAL',37]]),row('PPR',250,[['PPR',70]])]
  expect(isPprPayslip(monthly)).toBe(false)
 })
 it('separates PPR earnings, income tax and negotiating fee',()=>{
  expect(pprDetails([
   {code:'00845',description:'PPR',amount:12000,side:'credit'},
   {code:'05755',description:'CONTRIBUICAO NEGOCIAL PPR',amount:60,side:'debit'},
   {code:'07095',description:'IRRF PPR',amount:2200,side:'debit'},
  ])).toEqual({gross:12000,incomeTax:2200,unionContribution:60})
 })
 it('makes a one-time PPR event on actual payment date',()=>{
  const e=makePprEvent({period:'2025-11',paymentDate:'2025-11-15',grossPpr:12000,credits:12000,debits:2260,net:9740})
  expect(e.kind).toBe('ppr');expect(e.effective_date).toBe('2025-11-15');expect(e.value).toBe(12000)
 })
 it('rejects incomplete PPR and does not invent amounts',()=>{
  expect(()=>makePprEvent({period:'2025-11',paymentDate:null,grossPpr:12000,credits:12000,debits:2260,net:9740})).toThrow()
  expect(()=>makePprEvent({period:'2025-11',paymentDate:'2025-11-15',grossPpr:12000,credits:12000,debits:2260,net:9741})).toThrow()
 })
})
