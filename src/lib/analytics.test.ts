import {describe,expect,it} from 'vitest'
import {classifyPayrollLine,payrollMetrics,timeMetrics,taxTimeSeries,thirteenthComparison,pprComparison} from './analytics'
import type {SavedStatement} from './data'
import type {StatementRubric} from './vacation'
const monthly=(id:string,period:string,fgts:number|null):SavedStatement=>({
 id,period,document_type:'monthly',fgts,format:'old',
 vacation_start:null,vacation_end:null,payment_date:null,gross_ppr:null,
 ppr_income_tax:0,ppr_union_contribution:0,thirteenth_gross:null,thirteenth_advance:0,
 thirteenth_inss:0,thirteenth_irrf:0,thirteenth_pension:0,
 salary_contract:12000,trienio:90,credits:12000,debits:8000,net:4000,
 salary_advance:4500,net_received:8500,ir_base:10000,warnings:[],source_file:'fictional.pdf'
})
const line=(id:string,code:string,description:string,amount:number,side:'credit'|'debit'):StatementRubric=>({
 statement_id:id,code,description,amount,side
})
describe('Análises com dados reais da folha',()=>{
 const records=[
  monthly('jan','2024-01',800),monthly('feb','2024-02',810),
 ]
 const rubrics=[
  line('jan','00135','TRIENIO',90,'credit'),
  line('jan','07780','VGBL - PREVIDENCIA PRIVADA BASICA',240,'debit'),
  line('jan','07020','INSS MES',900,'debit'),
  line('jan','07050','IRRF MES',1200,'debit'),
  line('jan','07150','PENSAO ALIMENTICIA MES',2000,'debit'),
  line('jan','00050','HORAS EXTRAS 60%',400,'credit'),
  line('feb','00135','TRIENIO',90,'credit'),
  line('feb','07065','IRRF DESCONTADO FERIAS I',200,'debit'),
  line('feb','07780','VGBL - PREVIDENCIA PRIVADA BASICA',240,'debit'),
  line('feb','01930','REEMBOLSO TRIENIO MES ANTERIOR',15,'credit')
 ]
 it('só contabiliza rubricas mensais identificadas',()=>{
  const a=payrollMetrics(records,rubrics)
  expect(a[0].privatePension).toBe(240)
  expect(a[0].trienio).toBe(90)
  expect(a[0].inss).toBe(900)
  expect(a[0].irrfSalary).toBe(1200)
  expect(a[0].pension).toBe(2000)
  expect(a[0].overtime).toBe(400)
  expect(a[0].espp).toBeNull()
  expect(a[0].meal).toBeNull()
  expect(a[1].trienio).toBe(90) // excludes retroactive reimbursement
  expect(a[1].irrfVacation).toBe(200)
 })
 it('filtrar 2024 preserva os 12 meses de FGTS, com lacunas ausentes',()=>{
  const rows=timeMetrics(payrollMetrics(records,rubrics),'2024')
  expect(rows).toHaveLength(12)
  expect(rows[0].label).toBe('Jan')
  expect(rows[0].fgts).toBe(800)
  expect(rows[1].fgts).toBe(810)
  expect(rows[11].label).toBe('Dez')
  expect(rows[11].fgts).toBeNull()
 })
 it('todos os anos agrega mês a mês sem transformar falta de dados em zero',()=>{
  const rows=timeMetrics(payrollMetrics(records,rubrics),'all')
  expect(rows).toHaveLength(1)
  expect(rows[0].fgts).toBe(1610)
  expect(rows[0].trienio).toBe(180)
  expect(rows[0].meal).toBeNull()
 })
 it('IRRF mensal, férias, PPR e 13º ficam separados',()=>{
  const ppr={...monthly('ppr','2024-04',null),document_type:'ppr' as const,
    payment_date:'2024-11-27',gross_ppr:24000,ppr_income_tax:3500,net:20500}
  const thirteenth={...monthly('13','2024-12',null),document_type:'thirteenth' as const,
    payment_date:'2024-12-19',thirteenth_irrf:1700}
  const series=taxTimeSeries(payrollMetrics(records,rubrics),[...records,ppr,thirteenth],'2024')
  expect(series).toHaveLength(12)
  expect(series[0].salary).toBe(1200)
  expect(series[1].vacation).toBe(200)
  expect(series[10].ppr).toBe(3500)
  expect(series[11].thirteenth).toBe(1700)
  expect(series[11].total).toBe(1700)
 })
 it('13º: bruto fecha com líquido total, pensão, INSS e IRRF na pilha',()=>{
  const rows=thirteenthComparison([{year:'2025',gross:17854.65,advance:6299.94,
    closingNet:5870.64,pension:2062.66,inss:951.62,irrf:2669.79}],'all')
  expect(rows).toHaveLength(1)
  expect(rows[0].net).toBe(12170.58)
  expect(rows[0].inss).toBe(951.62)
  expect(rows[0].other).toBe(0)
  expect(rows[0].net+rows[0].pension!+rows[0].inss!+rows[0].irrf).toBeCloseTo(rows[0].gross,2)
 })
 it('PPR soma apenas seus documentos e preserva diferença de contribuições',()=>{
  const ppr={...monthly('ppr','2025-11',null),document_type:'ppr' as const,
    gross_ppr:25023,net:21243.47,ppr_income_tax:3714.53,payment_date:'2025-11-28'}
  const r=pprComparison([ppr],'2025')[0]
  expect(r.gross).toBe(25023)
  expect(r.net).toBe(21243.47)
  expect(r.irrf).toBe(3714.53)
  expect(r.other).toBe(65)
 })
 it('não confunde VR debitado com benefício efetivamente creditado',()=>{
  expect(classifyPayrollLine({code:'3456',description:'DESCONTO VALE REFEIÇÃO',side:'debit'})).toBeNull()
  expect(classifyPayrollLine({code:'3456',description:'VALE REFEIÇÃO',side:'credit'})).toBe('meal')
 })
})
