import {describe,expect,it} from 'vitest'
import {annualFinancialRows,financialComposition,percentOfGross,type AnnualFinancialRow} from './analyticsFinancial'
import type {TimeMetrics} from './analytics'
const metrics=(year:string,values:Partial<TimeMetrics>={}):TimeMetrics=>({
 period:year,label:year,monthlyStatements:12,fgts:null,trienio:null,privatePension:null,
 inss:null,espp:null,meal:null,pension:null,overtime:null,irrfSalary:null,irrfVacation:null,...values
})
const annual=(values:Partial<AnnualFinancialRow>={}):AnnualFinancialRow=>({
 year:'2025',payrollGross:1000,net:600,pension:100,inss:100,irrf:150,
 taxableOfficial:950,espp:30,privatePension:15,trienio:80,months:12,
 officialFields:['taxable_salary','inss','salary_irrf','alimony'],...values
})
const none={trienio:false,espp:false,privatePension:false}
const total=(rows:{value:number}[])=>Math.round(rows.reduce((sum,row)=>sum+row.value,0)*100)/100
describe('Annual Payrep figures distinguish payroll gross from confirmed taxable IR base',()=>{
 it('keeps both figures without falsely equating fiscal income and payroll credits',()=>{
  const years=annualFinancialRows(
   [{period:'2024',bruto:166740.51,liquido:96822.10},{period:'2025',bruto:195632.71,liquido:110379.50}],
   [metrics('2024',{irrfSalary:19800,inss:10800,pension:29000}),
    metrics('2025',{irrfSalary:24000,inss:11000,pension:30000})],
   [{calendar_year:2024,confirmed_at:'2026-11-19T00:00:00Z',
     reviewed_values:{taxable_salary:161440.6,salary_irrf:20750.81,inss:10906.2,alimony:33743.73}},
    {calendar_year:2025,confirmed_at:'2026-11-19T00:00:00Z',
     reviewed_values:{taxable_salary:190945.19,salary_irrf:25991.89,inss:11419.44,alimony:39829.89}}],
   'all')
  expect(years).toHaveLength(2)
  expect(years[0].payrollGross).toBe(166740.51)
  expect(years[0].taxableOfficial).toBe(161440.6)
  expect(years[0].inss).toBe(10906.2)
  expect(years[0].irrf).toBe(20750.81)
  expect(years[0].pension).toBe(33743.73)
  expect(years[1].payrollGross).toBe(195632.71)
  expect(years[1].taxableOfficial).toBe(190945.19)
  expect(years[1].irrf).toBe(25991.89)
  expect(years[1].pension).toBe(39829.89)
 })
 it('never promotes unreviewed figures or missing fields into official numbers',()=>{
  const years=annualFinancialRows([{period:'2025',bruto:200,liquido:120}],
   [metrics('2025',{monthlyStatements:1,irrfSalary:20,inss:11,pension:10})],
   [{calendar_year:2025,confirmed_at:'',reviewed_values:{taxable_salary:150,irrf:undefined} as never}], 'all')
  expect(years[0].taxableOfficial).toBeNull()
  expect(years[0].irrf).toBe(20)
 })
 it('aggregates twelve monthly points when a specific year is selected',()=>{
  const rows=annualFinancialRows([
   {period:'01/25',bruto:700,liquido:400},{period:'02/25',bruto:300,liquido:200}],
   [metrics('2025',{monthlyStatements:2,inss:80,irrfSalary:30})],[], '2025')
  expect(rows).toHaveLength(1)
  expect(rows[0].payrollGross).toBe(1000)
  expect(rows[0].net).toBe(600)
 })
})
describe('Multi-ring composition reconciles to payroll gross, with no duplicate triênio',()=>{
 it('reconciles inner and outer rings to gross before and after splitting ESPP and pension',()=>{
  const base=financialComposition([annual()],none)
  expect(total(base.inner)).toBe(1000)
  expect(total(base.outer)).toBe(1000)
  expect(base.inner.find(s=>s.key==='others')?.value).toBe(50)
  const detailed=financialComposition([annual()],{trienio:true,espp:true,privatePension:true})
  expect(total(detailed.inner)).toBe(1000)
  expect(total(detailed.outer)).toBe(1000)
  expect(total(detailed.origin)).toBe(1000)
  expect(detailed.inner.find(s=>s.key==='espp')?.value).toBe(30)
  expect(detailed.inner.find(s=>s.key==='privatePension')?.value).toBe(15)
  expect(detailed.inner.find(s=>s.key==='others')?.value).toBe(5)
  expect(detailed.origin.find(s=>s.key==='trienio')?.value).toBe(80)
  expect(detailed.inner.find(s=>s.key==='trienio')).toBeUndefined()
 })
 it('refuses to invent an amount if the composition does not reconcile',()=>{
  const result=financialComposition([annual({payrollGross:500})],none)
  expect(result.inner).toHaveLength(0)
  expect(result.outer).toHaveLength(0)
  expect(result.warnings.join(' ')).toContain('ultrapassam')
 })
 it('does not clip ESPP if it exceeds the residual; it reports the limitation',()=>{
  const result=financialComposition([annual({espp:70})],{trienio:false,espp:true,privatePension:false})
  expect(result.inner.some(s=>s.key==='espp')).toBe(false)
  expect(result.inner.find(s=>s.key==='others')?.value).toBe(50)
  expect(result.warnings.join(' ')).toContain('ESPP')
 })
 it('never divides by zero for percentage tooltips',()=>{
  expect(percentOfGross(100,1000)).toBe('10,0%')
  expect(percentOfGross(100,0)).toBe('—')
 })
})
