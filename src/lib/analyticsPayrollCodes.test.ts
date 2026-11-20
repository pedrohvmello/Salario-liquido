import {describe,expect,it} from 'vitest'
import {payrollMetrics,timeMetrics} from './analytics'
import type {SavedStatement} from './data'
import type {StatementRubric} from './vacation'

const doc=(id:string,period:string):SavedStatement=>({
 id,period,document_type:'monthly',fgts:null
} as SavedStatement)
const rubric=(statement_id:string,code:string,description:string,amount:number):StatementRubric=>({
 statement_id,code,description,amount,side:'debit'
} as StatementRubric)

describe('New and old payslip rubrics are comparable without missing taxation',()=>{
 it('recognizes May 2026 onward pension, INSS, IRRF and private investment fields',()=>{
  const rows=payrollMetrics([doc('new','2026-07')],[
   rubric('new','/314','Contr. INSS Remuneração 14,00',988.07),
   rubric('new','/401','Tributo IRRF 27,50',2167.15),
   rubric('new','MG11','Pagamento Pensão Reg.',3156.90),
   rubric('new','7627','ESPP 10,00',1534.06),
   rubric('new','7610','Prev. VGBL básica',306.81)
  ])
  expect(rows).toHaveLength(1)
  expect(rows[0].inss).toBe(988.07)
  expect(rows[0].irrfSalary).toBe(2167.15)
  expect(rows[0].pension).toBe(3156.90)
  expect(rows[0].espp).toBe(1534.06)
  expect(rows[0].privatePension).toBe(306.81)
  const annual=timeMetrics(rows,'all')
  expect(annual[0].inss).toBe(988.07)
 })
 it('retains old-format tax and contribution fields and classifies May changes only once',()=>{
  const rows=payrollMetrics([doc('old','2026-03'),doc('new','2026-05')],[
   rubric('old','07020','INSS MES',988.07),
   rubric('old','07050','IRRF MES',2130.41),
   rubric('old','07150','PENSAO ALIMENTICIA MES',3201.01),
   rubric('new','/314','Contr. INSS Remuneração 14,00',988.07),
   rubric('new','/401','Tributo IRRF 27,50',2105.36),
   rubric('new','MG11','Pagamento Pensão Reg.',2583.98)
  ])
  const year=timeMetrics(rows,'all')
  expect(year[0].inss).toBe(1976.14)
  expect(year[0].irrfSalary).toBe(4235.77)
  expect(year[0].pension).toBe(5784.99)
  expect(year[0].monthlyStatements).toBe(2)
 })
})
