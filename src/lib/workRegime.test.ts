import {describe,expect,it} from 'vitest'
import {recordedHoursBalanceMinutes,normalizedWorkRegime} from './workRegime'
import type {DayEntry} from './calendar'
const record=(date:string,start='09:00',end='18:00',bankHours=false):DayEntry=>({
 date,start,lunchStart:'12:00',lunchEnd:'13:00',end,bankHours,holidayOverride:null,
 additionalHours:'',comments:''
})
describe('Work regime and informational hour balance',()=>{
 it('defaults to regular and recognizes a trust role',()=>{
  expect(normalizedWorkRegime(undefined)).toBe('regular')
  expect(normalizedWorkRegime('trust')).toBe('trust')
 })
 it('shows a signed balance from registered worked hours without banking them',()=>{
  const days=[record('2026-11-16'),record('2026-11-17','09:00','17:00'),
   record('2026-11-21','09:00','13:00'),record('2026-11-22','','')]
  expect(recordedHoursBalanceMinutes(days,new Set(),[])).toBe(120)
  expect(days.every(r=>r.bankHours===false)).toBe(true)
 })
 it('keeps old bank flags and supports holiday overrides without mutation',()=>{
  const old=record('2026-11-16','09:00','19:00',true)
  const holiday=record('2026-11-20','09:00','13:00',false)
  holiday.holidayOverride=true
  expect(recordedHoursBalanceMinutes([old,holiday],new Set(),[])).toBe(240)
  expect(old.bankHours).toBe(true)
 })
 it('excludes incomplete days and never fills in absent dates',()=>{
  expect(recordedHoursBalanceMinutes([record('2026-11-16','09:00','')],null,[])).toBe(0)
 })
})
