import {describe,expect,it} from 'vitest'
import {summarizeTaxYear,calculatedOfficialValue,officialDifference,type TaxStatement} from './annualTax'
const make=(value:Partial<TaxStatement>):TaxStatement=>({
 id:'id',period:'2025-11',document_type:'ppr',payment_date:'2025-11-28',
 gross_ppr:25023,ppr_income_tax:3714.53,ppr_union_contribution:65,
 thirteenth_gross:null,thirteenth_advance:0,thirteenth_inss:0,thirteenth_irrf:0,thirteenth_pension:0,credits:25023,net:21243.47,net_received:21243.47,...value
})
describe('prévia anual de IR: consolidação segura',()=>{
 it('separa PPR e IRRF exclusivo por ANO DE PAGAMENTO',()=>{
  const s=summarizeTaxYear([
    make({period:'2024-12',payment_date:'2025-01-10'}),
    make({period:'2025-12',payment_date:'2026-01-10'}),
    make({id:'monthly',document_type:'monthly',payment_date:null,period:'2025-11',credits:18000,net:11000,net_received:15000})
  ],2025)
  expect(s.pprDocuments).toBe(1)
  expect(s.pprGross).toBe(25023)
  expect(s.pprIrrf).toBe(3714.53)
  expect(s.pprContribution).toBe(65)
  expect(s.monthlyDocuments).toBe(1)
  expect(s.monthlyGrossIndicative).toBe(18000)
  expect(calculatedOfficialValue(s,'taxable_salary')).toBeNull()
  expect(calculatedOfficialValue(s,'ppr_irrf')).toBe(3714.53)
 })
 it('não presume PPR sem documento nem data',()=>{
  const s=summarizeTaxYear([make({payment_date:null})],2025)
  expect(s.pprGross).toBe(0)
  expect(s.pprUnassignedDates).toBe(1)
  expect(calculatedOfficialValue(s,'ppr_gross')).toBeNull()
 })
 it('IRRF do 13º não se mistura com o IRRF salarial ou PPR',()=>{
  const summary=summarizeTaxYear([
   make({id:'13',period:'2025-12',document_type:'thirteenth',payment_date:'2025-12-19',
     thirteenth_gross:16000,thirteenth_irrf:2400,thirteenth_inss:900,
     thirteenth_pension:1500,thirteenth_advance:6000,gross_ppr:null}),
   make({id:'vac',period:'2025-04',document_type:'vacation',payment_date:'2025-03-27',gross_ppr:null})
  ],2025)
  expect(summary.thirteenthDocuments).toBe(1)
  expect(calculatedOfficialValue(summary,'thirteenth')).toBe(16000)
  expect(calculatedOfficialValue(summary,'thirteenth_irrf')).toBe(2400)
  expect(calculatedOfficialValue(summary,'salary_irrf')).toBeNull()
  expect(summary.pprDocuments).toBe(0)
 })
 it('não trata zero válido como valor ausente',()=>{
  expect(officialDifference(0,0)).toBe(0)
  expect(officialDifference(5,null)).toBeNull()
  expect(officialDifference(null,10)).toBeNull()
  expect(officialDifference(25023,24900)).toBe(123)
 })
})
