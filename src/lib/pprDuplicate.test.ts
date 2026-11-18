import {describe,it,expect} from 'vitest'
import {pprReceiptKey} from './pprDuplicate'
const ppr={period:'2025-11',paymentDate:'2025-11-28',gross:1234.56,net:1000,incomeTax:234.56,unionContribution:0}
describe('PPR semantic deduplication',()=>{
 it('identifies the same payment in different source files',()=>{
  expect(pprReceiptKey(ppr)).toBe(pprReceiptKey({...ppr,gross:1234.56000001}))
 })
 it('allows different instalments and values',()=>{
  expect(pprReceiptKey(ppr)).not.toBe(pprReceiptKey({...ppr,net:950}))
  expect(pprReceiptKey(ppr)).not.toBe(pprReceiptKey({...ppr,paymentDate:'2025-12-05'}))
 })
 it('keeps null and zero distinct',()=>{
  expect(pprReceiptKey({...ppr,incomeTax:null})).not.toBe(pprReceiptKey({...ppr,incomeTax:0}))
 })
})
