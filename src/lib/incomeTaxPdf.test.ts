import {describe,expect,it} from 'vitest'
import {inferCalendarYear,extractTaxFieldsFromLines} from './incomeTaxPdf'

describe('employer Income Tax document year detection',()=>{
 it('uses the calendar year explicitly printed in the report',()=>{
  expect(inferCalendarYear('COMPROVANTE DE RENDIMENTOS PAGOS Ano-calendário: 2025 Exercício: 2026')).toBe(2025)
  expect(inferCalendarYear('INFORME DE RENDIMENTOS | ANO CALENDÁRIO 2024 | EXERCÍCIO 2025')).toBe(2024)
 })
 it('can infer the calendar year from the exercise as a fallback',()=>{
  expect(inferCalendarYear('Informe de Rendimentos | Exercício: 2026')).toBe(2025)
 })
 it('rejects conflicting years rather than assigning a PDF to the wrong year',()=>{
  expect(inferCalendarYear('Ano-calendário 2024 | Exercício 2026')).toBeNull()
  expect(inferCalendarYear('Ano-calendário 2023 / Ano-calendário 2024')).toBeNull()
  expect(inferCalendarYear('Informe de Rendimentos | 2025')).toBeNull()
 })
 it('recognizes the wording and layout used by an employer-issued Receita Federal report',()=>{
  const header='Ministério da Fazenda Comprovante de Rendimentos Pagos e de Imposto sobre a Renda Retido na Fonte Exercício de 2026 Ano - calendário de 2025'
  expect(inferCalendarYear(header)).toBe(2025)
  expect(inferCalendarYear(header+' '+header)).toBe(2025)
 })
 it('asks for manual confirmation only when the header years contradict each other',()=>{
  expect(inferCalendarYear('Exercício de 2027 Ano - calendário de 2025')).toBeNull()
  expect(inferCalendarYear('Exercício de 2026')).toBe(2025)
  expect(inferCalendarYear('Ano-calendário de 2024')).toBe(2024)
 })

})


describe('RFB income tax exclusive-liquidity amounts',()=>{
 const line=(text:string,page=1)=>({text,page})
 it('reads 13th net, IRRF and PLR from actual type of section 5 while ignoring zeros in sections 4 and 6',()=>{
  const sample=[
   line('4. Rendimentos Isentos e Não Tributáveis'),
   line('2. Parcela isenta do 13º salário de aposentadoria 0,00'),
   line('5. Rendimentos sujeitos à Tributação Exclusiva (rendimento líquido)'),
   line('1. 13º (décimo terceiro) salário 12.345,67'),
   line('2. Imposto sobre a Renda Retido na Fonte sobre 13º (décimo terceiro) salário 2.675,00'),
   line('3. Outros'),
   line('OUTROS PLR 9.876,54'),
   line('6. Rendimentos Recebidos Acumuladamente - Art. 12-A'),
   line('1. Total dos rendimentos tributáveis (inclusive férias e décimo terceiro salário) 0,00'),
   line('7. Informações Complementares',2),
   line('O total da linha 3 do quadro 5 já inclui a PLR correspondente a R$ 9.876,54',2)
  ]
  const result=extractTaxFieldsFromLines(sample)
  expect(result.fields.thirteenth_net).toBe(12345.67)
  expect(result.fields.thirteenth_irrf).toBe(2675)
  expect(result.fields.ppr_net).toBe(9876.54)
  expect(result.fields.thirteenth).toBeUndefined()
  expect(result.fields.ppr_gross).toBeUndefined()
  expect(result.fields.ppr_irrf).toBeUndefined()
 })
 it('supports an amount on the next PDF text line without treating other sections as financial sources',()=>{
  const result=extractTaxFieldsFromLines([
   line('5. Rendimentos sujeitos à Tributação Exclusiva (rendimento líquido)'),
   line('1. 13º (décimo terceiro) salário'),
   line('11.111,11'),
   line('3. Outros'),
   line('OUTROS PLR'),
   line('22.222,22'),
   line('6. Rendimentos Recebidos Acumuladamente'),
   line('1. Total dos rendimentos tributáveis (inclusive décimo terceiro salário) 0,00')
  ])
  expect(result.fields.thirteenth_net).toBe(11111.11)
  expect(result.fields.ppr_net).toBe(22222.22)
 })
 it('does not silently treat a report without a declared net/gross basis as gross income',()=>{
  const result=extractTaxFieldsFromLines([
   line('5. Rendimentos sujeitos à Tributação Exclusiva'),
   line('1. 13º (décimo terceiro) salário 5.000,00'),
   line('3. OUTROS PLR 4.000,00'),
  ])
  expect(result.fields.thirteenth_net).toBeUndefined()
  expect(result.fields.ppr_net).toBeUndefined()
  expect(result.fields.ppr_gross).toBeUndefined()
 })
})
