import {describe,expect,it} from 'vitest'
import {annualSalarySummary} from './annualSalary'
import {reconcileVacations,type StatementRubric} from './vacation'
import {reconcileThirteenth} from './thirteenthLedger'
import type {SavedStatement} from './data'
const statement=(id:string,type:SavedStatement['document_type'],period:string,
 fields:Partial<SavedStatement>={}):SavedStatement=>({
 id,document_type:type,period,format:'old',duplicate_of:null,storage_key:'',
 source_page:1,vacation_start:null,vacation_end:null,payment_date:null,
 gross_ppr:null,ppr_income_tax:0,ppr_union_contribution:0,
 thirteenth_gross:null,thirteenth_advance:0,thirteenth_inss:0,
 thirteenth_irrf:0,thirteenth_pension:0,salary_contract:null,trienio:null,
 credits:null,debits:null,net:null,salary_advance:null,net_received:null,
 ir_base:null,fgts:null,warnings:[],source_file:'test.pdf',...fields
})
const line=(statement_id:string,code:string,description:string,side:'credit'|'debit',
 amount:number):StatementRubric=>({statement_id,code,description,side,amount})
const calculate=(s:SavedStatement[],lines:StatementRubric[])=>
 annualSalarySummary(s,lines,reconcileVacations(s,lines),reconcileThirteenth(s,lines))
describe('historical annual gross and statutory deductions',()=>{
 it('combines monthly salary, full 13th, vacation once and deduplicated PPR',()=>{
  const statements=[
   statement('nov','monthly','2025-11',{credits:18000,trienio:200,fgts:1300,net:10000,salary_advance:5000}),
   statement('dec','monthly','2025-12',{credits:22000,net:8000,salary_advance:5000}),
   statement('vac','vacation','2025-11',{vacation_start:'2025-11-01',vacation_end:'2025-11-30',payment_date:'2025-10-30',credits:2800,net:2400}),
   statement('13','thirteenth','2025-12',{payment_date:'2025-12-20',thirteenth_gross:15000,
    credits:15000,net:7000,thirteenth_advance:5000,thirteenth_irrf:2000,thirteenth_inss:1000}),
   statement('ppr','ppr','2025-11',{payment_date:'2025-11-28',gross_ppr:12000,net:10000,ppr_income_tax:2000}),
   statement('ppr-copy','ppr','2025-11',{payment_date:'2025-11-28',gross_ppr:12000,net:10000,ppr_income_tax:2000})
  ]
  const rubrics=[
   line('nov','1000','Salário','credit',15000),
   line('nov','3301','Triênio','credit',200),
   line('nov','02800','Férias mês','credit',2800),
   line('nov','07050','IRRF mês','debit',2000),
   line('nov','07020','INSS mês','debit',800),
   line('nov','07150','Pensão Alimentícia mês','debit',1500),
   line('nov','07780','VGBL Previdência Privada Básica','debit',200),
   line('nov','05345','ESPP','debit',1000),
   line('dec','02880','Adiantamento 13º salário férias','credit',5000),
   line('vac','02000','Férias 1ª ocorrência','credit',2800)
  ]
  const summary=calculate(statements,rubrics).find(x=>x.year==='2025')!
  expect(summary.gross).toBe(62000)
  expect(summary.netBeforeOtherDeductions).toBe(54200)
  expect(summary.vacationGross).toBe(2800)
  expect(summary.thirteenthGross).toBe(15000)
  expect(summary.pprGross).toBe(12000)
  expect(summary.irrfTotal).toBe(6000)
  expect(summary.inss).toBe(1800)
  expect(summary.fgts).toBe(1300)
  expect(summary.trienio).toBe(200)
  expect(summary.pension).toBe(1500)
  expect(summary.privatePension).toBe(200)
  expect(summary.espp).toBe(1000)
 })
 it('reconciles only the missing vacation withholding when monthly payroll has partial values',()=>{
  const month=statement('month','monthly','2023-11',{credits:12000,net:8000})
  const vacation=statement('vac','vacation','2023-11',{
   vacation_start:'2023-11-01',vacation_end:'2023-11-30',
   payment_date:'2023-10-30',credits:2600,net:1800
  })
  const rubrics=[
   line('month','1000','Salário','credit',10000),
   line('month','02800','Férias mês','credit',2000),
   line('month','07050','IRRF mês','debit',1700),
   line('month','07065','IRRF descontado férias I','debit',300),
   line('month','07020','INSS mês','debit',900),
   line('month','07040','INSS descontado férias I','debit',100),
   line('month','07150','Pensão alimentícia mês','debit',400),
   line('month','07145','Desconto pensão alimentícia férias','debit',80),
   line('vac','02000','Férias 1ª ocorrência','credit',2600),
   line('vac','07060','IRRF férias normais','debit',500),
   line('vac','07030','INSS férias','debit',200),
   line('vac','07155','Pensão alimentícia férias','debit',150)
  ]
  const report=calculate([month,vacation],rubrics)[0]
  expect(report.gross).toBe(12600)
  expect(report.vacationGross).toBe(2600)
  expect(report.irrfTotal).toBe(2200)
  expect(report.inss).toBe(1100)
  expect(report.pension).toBe(550)
  expect(report.netBeforeOtherDeductions).toBe(9300)
 })
 it('preserves the 13th advance as a partial gross until the final receipt is available',()=>{
  const monthly=statement('month','monthly','2026-11',{credits:16000})
  const report=calculate([monthly],[line('month','02880','Adiantamento 13º salário férias','credit',7000)])
  expect(report[0].gross).toBe(16000)
  expect(report[0].thirteenthGross).toBe(7000)
 })
 it('includes an unmatched vacation receipt without creating a fictitious monthly salary',()=>{
  const receipt=statement('vac','vacation','2020-10',{credits:3500,net:3100,
   vacation_start:'2020-10-01',vacation_end:'2020-10-30',payment_date:'2020-09-29'})
  const report=calculate([receipt],[
   line('vac','02000','Férias','credit',3500),
   line('vac','07060','IRRF Férias normais','debit',400)
  ]).find(x=>x.year==='2020')!
  expect(report.vacationGross).toBe(3500)
  expect(report.gross).toBe(3500)
  expect(report.irrfTotal).toBe(400)
  expect(report.netBeforeOtherDeductions).toBe(3100)
 })
})
