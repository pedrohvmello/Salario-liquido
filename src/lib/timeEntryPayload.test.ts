import {describe,expect,it} from 'vitest'
import {timePayload} from './timeEntryPayload'
import type {DayEntry} from './calendar'

const blank=(date='2026-11-17'):DayEntry=>({
 date,start:'',lunchStart:'',lunchEnd:'',end:'',additionalHours:'',
 holidayOverride:null,comments:''
})

describe('time entries saved in Supabase',()=>{
 it('accepts a valid ISO date and a complete workday',()=>{
  const row=timePayload({...blank(),start:'09:00',lunchStart:'12:00',lunchEnd:'13:00',end:'19:00'},'user-1')
  expect(row).toMatchObject({
   user_id:'user-1',date:'2026-11-17',start_at:'09:00',lunch_start:'12:00',
   lunch_end:'13:00',end_at:'19:00',additional_minutes:0
  })
 })
 it('allows incomplete days with only an entry time, comments or holiday override',()=>{
  expect(timePayload({...blank(),start:'09:00'},'user-1').lunch_start).toBeNull()
  expect(timePayload({...blank(),comments:'Consulta médica',holidayOverride:true},'user-1'))
   .toMatchObject({start_at:null,end_at:null,comments:'Consulta médica',holiday_override:true})
 })
 it('converts additional hours into integer minutes',()=>{
  expect(timePayload({...blank(),additionalHours:'01:30'},'user-1').additional_minutes).toBe(90)
 })
 it('rejects malformed dates and times without modifying existing rows',()=>{
  expect(()=>timePayload(blank('17/11/2026'),'user-1')).toThrow('Data inválida')
  expect(()=>timePayload(blank('2026-02-30'),'user-1')).toThrow('Data inválida')
  expect(()=>timePayload({...blank(),start:'25:00'},'user-1')).toThrow('Entrada')
  expect(()=>timePayload({...blank(),additionalHours:'1h30'},'user-1')).toThrow('Horas adicionais')
 })
})
