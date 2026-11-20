import {describe,expect,it} from 'vitest'
import {buildFinancialMonths,financialTrends,financialDestinations,annualComparison,documentsAudit,
 type FinancialMonth} from './financialInsights'
import type {SavedStatement} from './data'
import type {StatementRubric,VacationLedger} from './vacation'
import type {MonthlyMetrics} from './analytics'
const doc=(id:string,period:string,gross:number):SavedStatement=>({
 id,period,document_type:'monthly',credits:gross,duplicate_of:null
} as SavedStatement)
const m=(period:string,values:Partial<MonthlyMetrics>={}):MonthlyMetrics=>({
 period,fgts:null,irrfSalary:null,irrfVacation:null,
 trienio:null,privatePension:null,inss:null,espp:null,meal:null,pension:null,overtime:null,...values
})
const line=(id:string,code:string,amount:number,side:'credit'|'debit'='debit'):StatementRubric=>({
 statement_id:id,code,description:code,amount,side
} as StatementRubric)
const ledger=(entries:Record<string,number|null>):VacationLedger=>({
 months:[],occurrences:[],byMonth:new Map(Object.entries(entries).map(([period,total])=>[
 period,{period,total,closing:total,salaryAdvance:0,vacation:0,
 vacationState:null,vacationNote:'',monthlyIds:[],receiptIds:[]}
 ]))
})
const money=(nums:(number|null)[])=>Math.round(nums.reduce<number>((a,b)=>a+(b??0),0)*100)/100
describe('Financial insight evidence',()=>{
 it('keeps actual payments distinct from ESPP, pension and totalizer with no double entry',()=>{
  const rows=buildFinancialMonths([
   doc('monthly','2025-11',1000),
   {id:'total',document_type:'adjustment',payroll_subtype:'totalizer',period:'2025-11',
    payment_date:'2025-11-27',credits:100,debits:20,net:80,duplicate_of:null} as SavedStatement,
   {id:'rect',document_type:'adjustment',payroll_subtype:'rectification',period:'2025-10',
    credits:1400,net:1150,duplicate_of:null} as SavedStatement
  ],[line('total','07151',20)],
   ledger({'2025-11':700}),
   [m('2025-11',{espp:80,privatePension:20,pension:70,inss:60,irrfSalary:50})])
  expect(rows).toHaveLength(1)
  expect(rows[0].gross).toBe(1100)
  expect(rows[0].net).toBe(780)
  expect(rows[0].pension).toBe(90)
  const dist=financialDestinations(rows,'2025')
  expect(dist[10].classified).toBe(true)
  expect(dist[10].cash).toBe(780)
  expect(dist[10].espp).toBe(80)
  expect(dist[10].privatePension).toBe(20)
  expect(dist[10].remainder).toBe(20)
  expect(money([dist[10].cash,dist[10].espp,dist[10].privatePension,
   dist[10].pension,dist[10].inss,dist[10].irrf,dist[10].remainder])).toBe(1100)
 })
 it('uses true missing-month gaps and refuses a partial yearly tax rate',()=>{
  const rows:FinancialMonth[]=[
   {period:'2025-01',year:'2025',month:1,label:'Jan',gross:1000,net:650,espp:60,
    privatePension:20,pension:70,inss:80,irrf:120,statementCount:1,totalizerCount:0},
   {period:'2025-02',year:'2025',month:2,label:'Fev',gross:1200,net:900,espp:20,
    privatePension:20,pension:80,inss:null,irrf:90,statementCount:1,totalizerCount:0}
  ]
  const monthly=financialTrends(rows,'2025')
  expect(monthly).toHaveLength(12)
  expect(monthly[0].rateTaxes).toBe(20)
  expect(monthly[1].rateTaxes).toBeNull()
  expect(monthly[2].gross).toBeNull()
  const annual=financialTrends(rows,'all')
  expect(annual[0].gross).toBe(2200)
  expect(annual[0].inss).toBeNull()
  expect(annual[0].rateTaxes).toBeNull()
 })
 it('compares 2026 with the same imported months of 2025, never a full-year extrapolation',()=>{
  const data:FinancialMonth[]=[
   ['2025-01',1000,700],['2025-02',2000,1400],['2025-03',3000,2300],
   ['2026-01',1100,800],['2026-02',2200,1500]
  ].map(([period,gross,net])=>({
   period:String(period),year:String(period).slice(0,4),month:Number(String(period).slice(5)),
   label:String(period),gross:Number(gross),net:Number(net),
   espp:null,privatePension:null,pension:null,inss:null,irrf:null,
   statementCount:1,totalizerCount:0
  }))
  const r=annualComparison(data,'2026')
  expect(r.map(x=>x.year)).toEqual(['2025','2026'])
  expect(r[1].gross).toBe(3300)
  expect(r[1].commonMonths).toBe(2)
  expect(r[1].grossChange).toBe(10)
  expect(r[1].netChange).toBeCloseTo(9.52,2)
  expect(r[0].grossChange).toBeNull()
 })
 it('never treats missing cash as a zero-valued destination',()=>{
  const rows:FinancialMonth[]=[{
   period:'2025-01',year:'2025',month:1,label:'Jan',gross:1000,net:null,espp:50,
   privatePension:20,pension:70,inss:60,irrf:100,statementCount:1,totalizerCount:0
  }]
  const dist=financialDestinations(rows,'2025')
  expect(dist[0].classified).toBe(false)
  expect(dist[0].cash).toBeNull()
 })
 it('only marks a document year reconciled with 12 months and confirmed exact IR total',()=>{
  const a=Array.from({length:12},(_,i)=>doc('m'+i,'2025-'+String(i+1).padStart(2,'0'),100))
  const r=documentsAudit(a,[],[{
   calendar_year:2025,confirmed_at:'2026-03-01',
   reviewed_values:{taxable_salary:1200}
  }],'2025')
  expect(r[0].months).toBe(12)
  expect(r[0].difference).toBe(0)
  expect(r[0].state).toBe('reconciled')
  const partial=documentsAudit(a.slice(0,11),[],[{
   calendar_year:2025,confirmed_at:'2026-03-01',reviewed_values:{taxable_salary:1100}
  }],'2025')
  expect(partial[0].difference).toBe(0)
  expect(partial[0].state).toBe('partial')
  expect(documentsAudit(a,[],[],'2025')[0].state).toBe('without-report')
 })
})
