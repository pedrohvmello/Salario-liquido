import {describe,expect,it} from 'vitest'
import {clearedFortnightHours} from './fortnightReset'
import type {DayEntry} from './calendar'

describe('safe fortnight hours reset',()=>{
 it('clears entry, lunch, exit, additional hours and bank flag only',()=>{
  const original:DayEntry={
   date:'2026-11-20',start:'09:00',lunchStart:'12:00',lunchEnd:'13:00',
   end:'18:00',additionalHours:'01:30',bankHours:true,
   bankDeltaMinutes:90,bankWeightedMinutes:180,
   holidayOverride:true,comments:'Folga compensada',
   effectiveHoliday:true
  }
  const cleared=clearedFortnightHours(original)
  expect(cleared).toMatchObject({
   date:'2026-11-20',start:'',lunchStart:'',lunchEnd:'',end:'',
   additionalHours:'',bankHours:false,bankDeltaMinutes:null,
   bankWeightedMinutes:null,holidayOverride:true,
   comments:'Folga compensada',effectiveHoliday:true
  })
  expect(original.start).toBe('09:00')
  expect(original.bankHours).toBe(true)
 })
})
