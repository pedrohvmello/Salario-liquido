import {describe,expect,it} from 'vitest'
import {billingReturnFromUrl,withoutBillingReturn} from './billingReturn'

describe('Asaas checkout callback navigation',()=>{
 it.each(['success','cancel','expired'] as const)('recognizes a %s return without granting a subscription',status=>{
  expect(billingReturnFromUrl('https://payrep-hml.vercel.app/?billing='+status)).toBe(status)
 })
 it('ignores malformed and unrelated values',()=>{
  expect(billingReturnFromUrl('https://payrep-hml.vercel.app/')).toBeNull()
  expect(billingReturnFromUrl('https://payrep-hml.vercel.app/?billing=paid')).toBeNull()
  expect(billingReturnFromUrl('bad url')).toBeNull()
 })
 it('removes only billing callback and preserves other navigation data',()=>{
  expect(withoutBillingReturn('https://payrep-hml.vercel.app/?billing=success&feature=account#note'))
   .toBe('/?feature=account#note')
 })
})
