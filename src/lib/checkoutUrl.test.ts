import {describe,expect,it} from 'vitest'
import {validatedSandboxCheckoutUrl,validatedProductionCheckoutUrl} from './checkoutUrl'

const checkoutId='8b117537-703b-41e9-8da8-55317357a3e5'
describe('Asaas Sandbox checkout redirect',()=>{
 it('accepts the Asaas-provided link including the Sandbox account prefix',()=>{
  const link='https://sandbox.asaas.com/000/checkoutSession/show/'+checkoutId
  expect(validatedSandboxCheckoutUrl(link)).toBe(link)
 })
 it('accepts the legacy sandbox route without the account prefix',()=>{
  const link='https://sandbox.asaas.com/checkoutSession/show/'+checkoutId
  expect(validatedSandboxCheckoutUrl(link)).toBe(link)
 })
 it.each([
  'https://asaas.com/checkoutSession/show?id='+checkoutId,
  'https://evil.example/000/checkoutSession/show/'+checkoutId,
  'https://sandbox.asaas.com.evil.example/000/checkoutSession/show/'+checkoutId,
  'http://sandbox.asaas.com/000/checkoutSession/show/'+checkoutId,
  'https://sandbox.asaas.com/000/checkoutSession/show/'+checkoutId+'?redirect=https://evil.example',
  'https://sandbox.asaas.com/000/checkoutSession/show/not-a-uuid'
 ])('rejects unexpected redirect %s',url=>{
  expect(()=>validatedSandboxCheckoutUrl(url)).toThrow('Destino de pagamento não autorizado.')
 })
})

describe('Asaas production checkout redirect',()=>{
 it('accepts exclusively the canonical hosted Asaas checkout',()=>{
  const url='https://asaas.com/checkoutSession/show?id='+checkoutId
  expect(validatedProductionCheckoutUrl(url)).toBe(url)
 })
 it.each([
  'https://sandbox.asaas.com/checkoutSession/show/'+checkoutId,
  'https://asaas.com/checkoutSession/show/'+checkoutId,
  'https://asaas.com/checkoutSession/show?id='+checkoutId+'&next=https://evil.example',
  'https://evil.example/checkoutSession/show?id='+checkoutId,
  'https://asaas.com.evil.example/checkoutSession/show?id='+checkoutId,
  'http://asaas.com/checkoutSession/show?id='+checkoutId,
  'https://asaas.com/checkoutSession/show?id=not-a-uuid'
 ])('rejects unsafe redirect %s',url=>{
  expect(()=>validatedProductionCheckoutUrl(url)).toThrow('Destino de pagamento não autorizado.')
 })
})
