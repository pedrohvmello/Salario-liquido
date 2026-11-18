import {describe,expect,it} from 'vitest'
import {calculateBankLedger,formatBankMinutes,movementForDay,paidOvertime} from './timeBank'
import type {DayEntry} from './calendar'
const dates=new Set<string>()
const entry=(date:string,end:string,bankHours=true):DayEntry=>({
 date,start:'09:00',lunchStart:'12:00',lunchEnd:'13:00',
 end,holidayOverride:false,bankHours,additionalHours:'',comments:''
})
describe('cumulative hour bank',()=>{
 it('accrues worked excess, deducts only existing balance, in chronological order',()=>{
  const first=entry('2026-11-17','19:30')
  const second=entry('2026-11-18','17:30')
  const ledger=calculateBankLedger([second,first],dates)
  expect(movementForDay(first,dates)).toBe(90)
  expect(movementForDay(second,dates)).toBe(-30)
  expect(ledger.balanceMinutes).toBe(60)
  expect(ledger.firstInsufficientDate).toBeNull()
  expect(formatBankMinutes(ledger.balanceMinutes)).toBe('01:00')
 })
 it('prevents compensation before hours have been earned',()=>{
  const result=calculateBankLedger([
   entry('2026-11-17','17:00'),
   entry('2026-11-18','19:00')
  ],dates)
  expect(result.firstInsufficientDate).toBe('2026-11-17')
 })
 it('preserves the original paid overtime when not banked',()=>{
  const regular=entry('2026-11-17','19:00',false)
  expect(movementForDay(regular,dates)).toBe(0)
  expect(paidOvertime(regular,dates).h60).toBe(1)
  expect(paidOvertime({...regular,bankHours:true},dates).h60).toBe(0)
 })
 it('banks the entire overtime shift on Saturdays, Sundays and holidays',()=>{
  const saturday=entry('2026-11-21','13:00')
  const sunday=entry('2026-11-22','13:00')
  expect(movementForDay(saturday,dates)).toBe(180)
  expect(movementForDay(sunday,dates)).toBe(180)
  expect(movementForDay({...entry('2026-11-17','13:00'),holidayOverride:null},new Set(['2026-11-17']))).toBe(180)
 })
 it('keeps incomplete rows out of the bank and supports draft previews',()=>{
  const incomplete={...entry('2026-11-18','17:30'),end:''}
  const result=calculateBankLedger([
   {...entry('2026-11-17','19:00'),bankDeltaMinutes:60},
   incomplete
  ],dates)
  expect(result.balanceMinutes).toBe(60)
  expect(result.firstInsufficientDate).toBeNull()
 })
 it('respects minute precision across month boundaries and edits',()=>{
  const original=entry('2026-11-30','19:01')
  const withdrawal=entry('2026-12-01','17:59')
  expect(calculateBankLedger([withdrawal,original],dates).balanceMinutes).toBe(60)
  expect(calculateBankLedger([withdrawal,{...original,end:'18:00'}],dates)
   .firstInsufficientDate).toBe('2026-12-01')
 })
})
