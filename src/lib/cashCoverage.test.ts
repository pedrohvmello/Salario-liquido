import {describe,it,expect} from 'vitest'
import {nonMonthlyCashWarnings} from './cashCoverage'
describe('coverage of cash received in exceptional payroll',()=>{
 it('warns when vacation and 13th advances make the closing net misleading',()=>{
  const warnings=nonMonthlyCashWarnings([
    {code:'07200',description:'DESCONTO ADIANTAMENTO FERIAS MES I',amount:8327.68,side:'debit'},
    {code:'07210',description:'DESCONTO ADIANTAMENTO 13º FERIAS',amount:6051.81,side:'debit'}
  ],'monthly')
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toContain('não representa todos os depósitos')
 })
 it('does not warn for a normal salary advance',()=>expect(nonMonthlyCashWarnings([
  {code:'07220',description:'DESCONTO ADIANTAMENTO QUINZENAL',amount:4841.44,side:'debit'}
 ],'monthly')).toEqual([]))
 it('never flags PPR salary as vacation',()=>expect(nonMonthlyCashWarnings([
  {code:'07200',description:'DESCONTO ADIANTAMENTO FERIAS MES I',amount:100,side:'debit'}
 ],'ppr')).toEqual([]))
 it('catches wording in future payroll layouts',()=>expect(nonMonthlyCashWarnings([
   {code:'A001',description:'Adiantamento de férias',amount:1000,side:'debit'}
 ],'monthly')).toHaveLength(1))
})
