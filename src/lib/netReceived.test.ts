import {describe,it,expect} from 'vitest'
import {netMonthlyReceived,salaryAdvanceFromLines} from './netReceived'

describe('historical monthly net including advance',()=>{
 it('adds an old-layout salary advance to the closing payment',()=>{
  const advance=salaryAdvanceFromLines([
   {code:'07220',description:'DESCONTO ADIANTAMENTO QUINZENAL',amount:1700,side:'debit'},
   {code:'07200',description:'DESCONTO ADIANTAMENTO FERIAS MES I',amount:600,side:'debit'},
   {code:'07210',description:'DESCONTO ADIANTAMENTO 13º FERIAS',amount:400,side:'debit'}
  ],'old')
  expect(advance).toBe(1700)
  expect(netMonthlyReceived(2400,advance)).toBe(4100)
 })
 it('recognizes new-layout /B02 and ignores unrelated discounts',()=>{
  const advance=salaryAdvanceFromLines([
   {code:'/B02',description:'Adiantamento pago',amount:1840.5,side:'debit'},
   {code:'MG11',description:'Pensão',amount:800,side:'debit'}
  ],'new')
  expect(netMonthlyReceived(970.31,advance)).toBe(2810.81)
 })
 it('never infers a missing closing net from gross or discounts',()=>expect(netMonthlyReceived(null,1800)).toBeNull())
 it('treats absence of salary advance as zero, not as vacation advance',()=>{
  const advance=salaryAdvanceFromLines([{code:'07200',description:'Adiantamento de férias',amount:1000,side:'debit'}],'old')
  expect(advance).toBe(0)
  expect(netMonthlyReceived(0,advance)).toBe(0)
 })
 it('rejects wrongly classified advance instead of silently adding it',()=>expect(()=>salaryAdvanceFromLines([{code:'/B02',description:'Adiantamento pago',amount:500,side:'credit'}],'new')).toThrow())
})
