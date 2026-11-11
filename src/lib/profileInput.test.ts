import {describe,expect,it} from 'vitest'
import {formatCep,formatPhone,isValidCepResult} from './profileInput'
describe('Brazilian profile input masks and CEP response',()=>{
 it('formats mobile, landline and partial input',()=>{
  expect(formatPhone('11987654321')).toBe('(11) 98765-4321')
  expect(formatPhone('+55 11 98765-4321')).toBe('(11) 98765-4321')
  expect(formatPhone('1134567890')).toBe('(11) 3456-7890')
  expect(formatPhone('11')).toBe('(11')
 })
 it('formats pasted and progressively entered CEP without excess digits',()=>{
  expect(formatCep('04726240')).toBe('04726-240')
  expect(formatCep('04726666666')).toBe('04726-666')
  expect(formatCep('04726')).toBe('04726')
 })
 it('rejects missing and invalid ViaCEP results',()=>{
  expect(isValidCepResult({erro:true})).toBe(false)
  expect(isValidCepResult({logradouro:'Sé'})).toBe(false)
  expect(isValidCepResult({localidade:'São Paulo',uf:'SP'})).toBe(true)
 })
})
