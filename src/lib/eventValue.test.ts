import {describe,it,expect} from 'vitest'
import {parseEventValue,formatEventValue,formatEventInput} from './eventValue'

describe('formatação dos eventos salariais',()=>{
 it('exibe milhar com ponto e duas casas decimais',()=>{
  expect(formatEventValue(15340.57,'salary')).toBe('15.340,57')
  expect(formatEventValue(179,'trienio')).toBe('179,00')
  expect(formatEventValue(1234567.89,'bonus')).toBe('1.234.567,89')
  expect(formatEventValue(0,'salary')).toBe('0,00')
 })
 it('aceita entradas pt-BR sem alterar valores de salários',()=>{
  expect(parseEventValue('15.340,57','salary')).toBe(15340.57)
  expect(parseEventValue('15340,57','salary')).toBe(15340.57)
  expect(parseEventValue('1.234','salary')).toBe(1234)
  expect(parseEventValue('1.234,5','salary')).toBe(1234.5)
  expect(parseEventValue('R$ 1.234,56','salary')).toBe(1234.56)
  expect(formatEventInput('15340,57','salary')).toBe('15.340,57')
 })
 it('continua aceitando valor decimal do antigo type number',()=>{
  expect(parseEventValue('15340.57','salary')).toBe(15340.57)
  expect(parseEventValue('15340.5','salary')).toBe(15340.5)
 })
 it('recusa entradas inválidas em vez de gravar zero ou número incorreto',()=>{
  for(const raw of ['', '15.340.57','1,234','abc','1.23.456','12,34,56','NaN']){
   expect(parseEventValue(raw,'salary'),raw).toBeNull()
  }
 })
 it('dependentes permanece uma quantidade inteira',()=>{
  expect(parseEventValue('1','dependents')).toBe(1)
  expect(formatEventValue(1,'dependents')).toBe('1')
  expect(parseEventValue('1,5','dependents')).toBeNull()
 })
 it('percentuais mantêm precisão e formato de duas casas',()=>{
  expect(parseEventValue('10,50','esppPercent')).toBe(10.5)
  expect(formatEventValue(10.5,'esppPercent')).toBe('10,50')
 })
})
