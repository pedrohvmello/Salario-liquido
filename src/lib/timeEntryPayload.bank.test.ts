import {describe,expect,it} from 'vitest'
import {timePayload} from './timeEntryPayload'
import type {DayEntry} from './calendar'
const base:DayEntry={date:'2026-11-17',start:'09:00',lunchStart:'12:00',lunchEnd:'13:00',end:'19:00',holidayOverride:false,additionalHours:'01:00',bankHours:true}
describe('bank entry persistence',()=>{
 it('saves bank flags and a holiday snapshot',()=>{
  const payload=timePayload(base,'test-user')
  expect(payload).toMatchObject({bank_hours:true,effective_holiday:false,additional_minutes:60})
 })
 it('keeps legacy entries as paid overtime',()=>{
  const payload=timePayload({...base,bankHours:undefined},'test-user')
  expect(payload.bank_hours).toBe(false)
 })
 it('honors the manual holiday override',()=>{
  const payload=timePayload({...base,holidayOverride:true,effectiveHoliday:false},'test-user')
  expect(payload.effective_holiday).toBe(true)
 })
})
