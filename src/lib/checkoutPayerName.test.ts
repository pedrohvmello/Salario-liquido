import {describe,expect,it} from 'vitest'
import {isValidCheckoutName,normalizeCheckoutName} from './checkoutPayerName'
describe('Asaas payer name validation',()=>{
 it('rejects a single-word alias even when it has three characters',()=>{
  expect(isValidCheckoutName('LRP')).toBe(false)
  expect(isValidCheckoutName('Ana')).toBe(false)
  expect(isValidCheckoutName('')).toBe(false)
 })
 it('accepts real names and normalizes extra whitespace',()=>{
  expect(isValidCheckoutName('Ana Paula')).toBe(true)
  expect(isValidCheckoutName("João D'Ávila")).toBe(true)
  expect(normalizeCheckoutName('  Ana   Paula   Silva ')).toBe('Ana Paula Silva')
 })
 it('rejects digits, scripts and implausible abbreviated names',()=>{
  expect(isValidCheckoutName('Ana 123')).toBe(false)
  expect(isValidCheckoutName('A B')).toBe(false)
  expect(isValidCheckoutName('<script> Ana')).toBe(false)
 })
})
