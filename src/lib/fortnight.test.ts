import {describe,expect,it} from 'vitest'
import {fortnightDays,getFortnight,shiftFortnight} from './fortnight'
import {classifyHours} from './calendar'

describe('fortnight navigation',()=>{
 it('starts at days 1 and 16, respecting months of different lengths',()=>{
  expect(getFortnight('2026-11-17')).toMatchObject({start:'2026-11-16',end:'2026-11-30'})
  expect(getFortnight('2026-11-01')).toMatchObject({start:'2026-11-01',end:'2026-11-15'})
  expect(fortnightDays('2028-02-17')).toHaveLength(14)
  expect(getFortnight('2028-02-17').end).toBe('2028-02-29')
 })
 it('moves across the end of the year without skipping a fortnight',()=>{
  expect(shiftFortnight('2026-12-20',1)).toBe('2027-01-01')
  expect(shiftFortnight('2027-01-05',-1)).toBe('2026-12-16')
  expect(shiftFortnight('2026-11-03',1)).toBe('2026-11-16')
  expect(shiftFortnight('2026-11-20',-1)).toBe('2026-11-01')
 })
 it('accepts a selected calendar day and derives its fortnight',()=>{
  expect(getFortnight('2026-11-15').start).toBe('2026-11-01')
  expect(getFortnight('2026-11-16').start).toBe('2026-11-16')
 })
})

describe('time classification with additional hours',()=>{
 it('adds additional hours to worked and overtime hours',()=>{
  const result=classifyHours({
   date:'2026-11-17',start:'09:00',lunchStart:'12:00',lunchEnd:'13:00',
   end:'18:00',holidayOverride:false,additionalHours:'01:30'
  },new Set())
  expect(result.total).toBe(9.5)
  expect(result.h60).toBe(1.5)
  expect(result.h80).toBe(0)
 })
 it('includes holiday and Sunday hours in the 100% category',()=>{
  const result=classifyHours({
   date:'2026-11-15',start:'09:00',lunchStart:'12:00',lunchEnd:'13:00',
   end:'18:00',holidayOverride:null,additionalHours:'00:30'
  },new Set())
  expect(result.h100).toBe(8.5)
 })
})
