import {describe,expect,it} from 'vitest'
import {inferCalendarYear} from './incomeTaxPdf'

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
})
