import {describe,expect,it} from 'vitest'
import {overtimeComponents,overtimeDsr} from './overtimeDsr'
describe('extra rates and DSR within Payrep payroll periods',()=>{
 it('separates 60%, 80%, 100% with reconciled totals',()=>{
  const detail=overtimeComponents({h60:2,h80:1,h100:4},15400)
  expect(detail.p60).toBe(224)
  expect(detail.p80).toBe(126)
  expect(detail.p100).toBe(560)
  expect(detail.total).toBe(910)
 })
 it('uses Oct 16 to Nov 15 for Nov/2026 and counts Sunday holidays once',()=>{
  const period=overtimeDsr('2026-11',560,new Set(['2026-11-02','2026-11-15']))
  expect(period).toEqual({amount:134.4,workingDays:25,restDays:6,periodStart:'2026-10-16',periodEnd:'2026-11-15'})
 })
 it('supports manually added and removed holiday, preserving Sundays as rest',()=>{
  const holidays=new Set(['2026-11-02'])
  const modified=overtimeDsr('2026-11',560,holidays,new Map([['2026-11-02',false],['2026-10-20',true]]))
  expect(modified.restDays).toBe(6)
  expect(overtimeDsr('2026-11',560,holidays,new Map([['2026-11-02',false]])).restDays).toBe(5)
 })
 it('does not create DSR without overtime',()=>expect(overtimeDsr('2026-11',0,new Set()).amount).toBe(0))
 it('handles year rollover',()=>{
  const period=overtimeDsr('2027-01',100,new Set(['2026-12-25','2027-01-01']))
  expect(period.periodStart).toBe('2026-12-16')
  expect(period.periodEnd).toBe('2027-01-15')
  expect(period.workingDays+period.restDays).toBe(31)
 })
})
