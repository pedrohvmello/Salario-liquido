import {describe,expect,it} from 'vitest'
import {reconcileVacations,vacationAdvanceFromLines,type VacationStatement,type StatementRubric} from './vacation'
const monthly=(id:string,period:string,net=0):VacationStatement=>({id,period,document_type:'monthly',net,salary_advance:0,net_received:net,credits:11000,debits:11000-net})
const receipt=(id:string,start:string,end:string,net:number):VacationStatement=>({
 id,period:start.slice(0,7),document_type:'vacation',vacation_start:start,vacation_end:end,
 net,credits:20000,debits:20000-net,salary_advance:null,net_received:null
})
const debit=(id:string,code:string,amount:number,description='DESCONTO ADIANTAMENTO FERIAS MES I'):StatementRubric=>({statement_id:id,code,amount,side:'debit',description})
describe('Vacation cash reconciliation',()=>{
 it('infers a vacation advance from monthly paycheck, keeping it separate from 13th taxable salary',()=>{
  const v=reconcileVacations([monthly('apr','2024-04')],[debit('apr','07200',8200),debit('apr','07210',6100)])
  expect(v.byMonth.get('2024-04')?.vacation).toBe(14300)
  expect(v.byMonth.get('2024-04')?.total).toBe(14300)
  expect(v.occurrences[0].state).toBe('estimated')
 })
 it('replaces estimated advances with receipt, never adds both',()=>{
  const v=reconcileVacations([monthly('apr','2024-04'),receipt('vac','2024-04-01','2024-04-30',14300)],
  [debit('apr','07200',8200),debit('apr','07210',6100)])
  expect(v.byMonth.get('2024-04')?.total).toBe(14300)
  expect(v.occurrences[0].state).toBe('reconciled')
  expect(v.occurrences[0].difference).toBe(0)
 })
 it('allocates advance to start month when holidays span two months',()=>{
  const v=reconcileVacations([monthly('jun','2023-06',2500),receipt('vac','2023-05-08','2023-06-06',19000)],
  [debit('jun','07200',3000)])
  expect(v.byMonth.get('2023-05')?.total).toBe(19000)
  expect(v.byMonth.get('2023-06')?.total).toBe(2500)
  expect(v.occurrences).toHaveLength(1)
  expect(v.occurrences[0].state).toBe('partial')
 })
 it('does not invent the unknown portion of a two-month vacation from a future adjustment code',()=>{
  const v=reconcileVacations([monthly('apr','2026-04'),monthly('may','2026-05',2400),receipt('vac','2026-04-06','2026-05-05',19600)],
   [debit('apr','07200',8800),debit('apr','07210',7800),debit('may','8914',3790,'Fé - imp-leg')])
  expect(v.byMonth.get('2026-04')?.total).toBe(19600)
  expect(v.byMonth.get('2026-05')?.total).toBe(2400)
  expect(v.occurrences).toHaveLength(1)
  expect(v.occurrences[0].difference).toBe(-3000)
  expect(v.occurrences[0].state).toBe('difference')
 })
 it('never doubles a receipt when the same date range is uploaded again',()=>{
  const v=reconcileVacations([monthly('apr','2024-04'),receipt('vac1','2024-04-01','2024-04-30',1000),
   receipt('vac2','2024-04-01','2024-04-30',1000)],[])
  expect(v.occurrences).toHaveLength(1)
  expect(v.byMonth.get('2024-04')?.vacation).toBe(1000)
 })
 it('ignores payroll credit 02080 which is not a separate 13th salary payment',()=>{
  expect(vacationAdvanceFromLines([
   {code:'02080',description:'ADIANTAMENTO 13º SALARIO FERIAS',amount:7000,side:'credit'},
   {code:'07210',description:'DESCONTO ADIANTAMENTO 13º FERIAS',amount:7000,side:'debit'},
   {code:'8914',description:'Fé - imp-leg',amount:500,side:'debit'}
  ])).toBe(7000)
 })
})
