import {describe,expect,it} from 'vitest'
import {calculateBankLedger,formatBankMinutes,movementForDay,paidOvertime,type TimeBankPolicy} from './timeBank'
import type {DayEntry} from './calendar'

const dates=new Set<string>()
const policy:TimeBankPolicy={
 id:'policy-1',user_id:'test',title:'ACT teste',source_reference:'',
 valid_from:'2025-01-01',valid_until:'2027-12-31',
 weekday_factor:1,saturday_factor:1,sunday_factor:2,holiday_factor:2,
 daily_target_minutes:480,settlement_interval_months:6,settlement_months:[2,8],settlement_half:1
}
const policies=[policy]
const entry=(date:string,end:string,bankHours=true):DayEntry=>({
 date,start:'09:00',lunchStart:'12:00',lunchEnd:'13:00',
 end,holidayOverride:false,bankHours,additionalHours:'',comments:''
})

describe('cumulative hour bank',()=>{
 it('accrues excess and deducts only existing balance in chronological order',()=>{
  const first=entry('2026-11-17','19:30')
  const second=entry('2026-11-18','17:30')
  const ledger=calculateBankLedger([second,first],dates,policies)
  expect(movementForDay(first,dates,policies)).toBe(90)
  expect(movementForDay(second,dates,policies)).toBe(-30)
  expect(ledger.balanceMinutes).toBe(60)
  expect(ledger.firstInsufficientDate).toBeNull()
  expect(formatBankMinutes(ledger.balanceMinutes)).toBe('01:00')
 })
 it('prevents compensation before hours have been earned',()=>{
  const ledger=calculateBankLedger([
   entry('2026-11-17','17:00'),
   entry('2026-11-18','19:00')
  ],dates,policies)
  expect(ledger.firstInsufficientDate).toBe('2026-11-17')
 })
 it('keeps overtime as paid when the box is unchecked',()=>{
  const regular=entry('2026-11-17','19:00',false)
  expect(movementForDay(regular,dates,policies)).toBe(0)
  expect(paidOvertime(regular,dates).h60).toBe(1)
  expect(paidOvertime({...regular,bankHours:true},dates).h60).toBe(0)
 })
 it('credits 1:1 on Saturday and 2:1 on Sunday and holidays',()=>{
  expect(movementForDay(entry('2026-11-21','13:00'),dates,policies)).toBe(180)
  expect(movementForDay(entry('2026-11-22','13:00'),dates,policies)).toBe(360)
  const holiday={...entry('2026-11-17','13:00'),holidayOverride:null}
  expect(movementForDay(holiday,new Set(['2026-11-17']),policies)).toBe(360)
 })
 it('skips incomplete rows, preserving snapshotted movements',()=>{
  const incomplete={...entry('2026-11-18','17:30'),end:''}
  const ledger=calculateBankLedger([
   {...entry('2026-11-17','19:00'),bankWeightedMinutes:60},
   incomplete
  ],dates,policies)
  expect(ledger.balanceMinutes).toBe(60)
 })
 it('uses minute precision and catches retroactive changes across months',()=>{
  const original=entry('2026-11-30','19:01')
  const withdrawal=entry('2026-12-01','17:59')
  expect(calculateBankLedger([withdrawal,original],dates,policies).balanceMinutes).toBe(60)
  expect(calculateBankLedger([withdrawal,{...original,end:'18:00'}],dates,policies)
   .firstInsufficientDate).toBe('2026-12-01')
 })
 it('supports versions, custom factors and rejects expired policy for new credits',()=>{
  const current:TimeBankPolicy={
   ...policy,valid_from:'2026-09-01',valid_until:'2027-08-31',
   sunday_factor:3,weekday_factor:1.5
  }
  expect(movementForDay(entry('2026-11-22','13:00'),dates,[current])).toBe(540)
  expect(movementForDay(entry('2026-11-17','19:00'),dates,[current])).toBe(90)
  const expired=calculateBankLedger(
   [entry('2026-11-22','13:00')],dates,[{...policy,valid_until:'2026-08-31'}])
  expect(expired.firstMissingPolicyDate).toBe('2026-11-22')
 })
})
