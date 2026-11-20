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
describe('Multi-ring composition: constant liquid allocations and no duplicate income',()=>{
 const none={espp:false,privatePension:false}
 it('includes ESPP and previdência in a fixed combined liquid group regardless of checked filters',()=>{
  const base=financialComposition([annual()],none)
  expect(base.cashNet).toBe(600)
  expect(base.netAndInvestments).toBe(645)
  expect(base.inner.find(s=>s.key==='net')?.value).toBe(645)
  expect(base.unclassified).toBe(5)
  expect(total(base.inner)).toBe(1000)
  expect(total(base.outer)).toBe(1000)
  const selected=financialComposition([annual()],{espp:true,privatePension:true})
  expect(selected.cashNet).toBe(base.cashNet)
  expect(selected.netAndInvestments).toBe(base.netAndInvestments)
  expect(selected.unclassified).toBe(base.unclassified)
  expect(total(selected.inner)).toBe(1000)
  expect(total(selected.outer)).toBe(1000)
  expect(selected.inner.find(s=>s.key==='net')?.value).toBe(600)
  expect(selected.inner.find(s=>s.key==='espp')?.value).toBe(30)
  expect(selected.inner.find(s=>s.key==='privatePension')?.value).toBe(15)
  expect(selected.outer.find(s=>s.key==='outerNet')?.value).toBe(745)
  expect(selected.inner.some(s=>s.key==='trienio')).toBe(false)
 })
 it('never invents balancing adjustments when known values exceed gross',()=>{
  const result=financialComposition([annual({payrollGross:500})],none)
  expect(result.inner).toHaveLength(0)
  expect(result.outer).toHaveLength(0)
  expect(result.warnings.join(' ')).toContain('ultrapassam')
 })
 it('allows ESPP highlighting even when the balance residual cannot finance the whole amount',()=>{
  const row=annual({espp:70})
  const without=financialComposition([row],{espp:false,privatePension:false})
  const result=financialComposition([row],{espp:true,privatePension:false})
  expect(result.included.espp).toBe(0)
  expect(result.netAndInvestments).toBe(615)
  expect(result.netAndInvestments).toBe(without.netAndInvestments)
  expect(result.cashNet).toBe(without.cashNet)
  expect(result.unclassified).toBe(35)
  expect(result.unclassified).toBe(without.unclassified)
  expect(result.inner.find(s=>s.key==='espp')?.value).toBe(70)
  expect(result.inner.find(s=>s.key==='net')?.value).toBe(545)
  expect(total(result.inner)).toBe(1000)
  expect(result.warnings.join(' ')).toContain('ESPP')
 })
 it('excludes official-only years from gross-based rings without hiding the official series',()=>{
  const rows=[annual({year:'2025'}),annual({
   year:'2024',payrollGross:null,net:null,irrf:500,inss:350,pension:250,
   taxableOfficial:900,months:0
  })]
  const donut=financialComposition(rows,none)
  expect(donut.gross).toBe(1000)
  expect(total(donut.inner)).toBe(1000)
  expect(donut.warnings.join(' ')).toContain('2024')
  expect(rows[1].taxableOfficial).toBe(900)
 })
 it('never divides by zero for percentage tooltips',()=>{
  expect(percentOfGross(100,1000)).toBe('10,0%')
  expect(percentOfGross(100,0)).toBe('—')
 })
})
