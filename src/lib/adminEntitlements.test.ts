import {describe,expect,it} from 'vitest'
import {daysRemaining,grantStateText,paymentStatusText,planName} from './adminEntitlements'
describe('Admin plan access and payment labels',()=>{
 it('tracks remaining days for active grants and returns zero on revocation/expiry',()=>{
  const now=Date.parse('2026-11-20T00:00:00Z')
  expect(daysRemaining('2026-11-21T02:00:00Z','active',now)).toBe(2)
  expect(daysRemaining('2026-11-20T00:00:00Z','active',now)).toBe(0)
  expect(daysRemaining('2026-12-21T00:00:00Z','revoked',now)).toBe(0)
 })
 it('localizes billing status without modifying provider values',()=>{
  expect(paymentStatusText('paid')).toBe('Pago')
  expect(paymentStatusText('PENDING')).toBe('Pendente')
  expect(paymentStatusText('failed')).toBe('Falhou')
  expect(grantStateText('revoked')).toBe('Revogado')
  expect(planName('basic')).toBe('Basic')
 })
})
