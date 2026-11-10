import {describe,expect,it} from 'vitest'
import {summarizeTaxYear,calculatedOfficialValue,officialDifference,type TaxStatement} from './annualTax'
const make=(value:Partial<TaxStatement>):TaxStatement=>({
 id:'id',period:'2025-11',document_type:'ppr',payment_date:'2025-11-28',
 gross_ppr:25023,ppr_income_tax:3714.53,ppr_union_contribution:65,credits:25023,net:21243.47,net_received:21243.47,...value
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
 it('não trata zero válido como valor ausente',()=>{
  expect(officialDifference(0,0)).toBe(0)
  expect(officialDifference(5,null)).toBeNull()
  expect(officialDifference(null,10)).toBeNull()
  expect(officialDifference(25023,24900)).toBe(123)
 })
})
