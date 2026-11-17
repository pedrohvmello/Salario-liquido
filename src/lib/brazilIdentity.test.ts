import {describe,expect,it} from 'vitest'
import {cpfDigits,formatCpf,isValidCpf,validBirthDate} from './brazilIdentity'

describe('Payrep checkout CPF',()=>{
 it('accepts a valid CPF and normalizes formatting',()=>{
  expect(isValidCpf('529.982.247-25')).toBe(true)
  expect(cpfDigits('529.982.247-25')).toBe('52998224725')
  expect(formatCpf('52998224725')).toBe('529.982.247-25')
 })
 it('rejects incorrect checksum, repeated digits and incomplete input',()=>{
  expect(isValidCpf('529.982.247-26')).toBe(false)
  expect(isValidCpf('111.111.111-11')).toBe(false)
  expect(isValidCpf('529982247')).toBe(false)
  expect(isValidCpf('')).toBe(false)
 })
 it('enforces date validity only when supplied, independently from checkout',()=>{
  expect(validBirthDate('1990-02-20')).toBe(true)
  expect(validBirthDate('2024-02-30')).toBe(false)
  expect(validBirthDate('2099-01-01')).toBe(false)
 })
})
