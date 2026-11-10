import {describe,it,expect} from 'vitest'
import {calculateINSS2026,calculateIRRF2026,calculatePayroll2026,defaults} from './money'
import {classifyHours,paidMonth,saoPauloHoliday} from './calendar'
describe('2026 official tables',()=>{
 it('caps employee INSS',()=>expect(calculateINSS2026(20000)).toBe(988.09))
 it('deducts dependents in IR base',()=>expect(calculateIRRF2026(10000,900,1000,1).base).toBe(7910.41))
 it('IR reduction up to 5000',()=>expect(calculateIRRF2026(5000,509.6,0,0).tax).toBe(0))
 it('pension and IR converge',()=>{
   const r=calculatePayroll2026({...defaults,salary:14000,trienio:200,dependents:1,pensionMethod:'old26',pensionPercent:26})
   expect(Math.abs(r.pension-0.26*(r.gross-r.inss-r.irrf))).toBeLessThan(.02)
 })
 it('does not subtract FGTS from net',()=>{const r=calculatePayroll2026({...defaults,salary:10000});expect(r.netMonth).toBeCloseTo(r.gross-r.inss-r.irrf-r.pension,2)})
})
describe('hours and São Paulo holidays',()=>{
 const e={date:'2026-11-05',start:'08:00',lunchStart:'12:00',lunchEnd:'13:00',end:'19:00',holidayOverride:null}
 it('first two extra hours are 60%',()=>expect(classifyHours(e).h60).toBe(2))
 it('Saturday extras start at 60%',()=>expect(classifyHours({...e,date:'2026-11-07'}).h80).toBe(8))
 it('Sunday 100%',()=>expect(classifyHours({...e,date:'2026-11-08'}).h100).toBe(10))
 it('override replaces holiday calendar',()=>expect(classifyHours({...e,date:'2026-11-20',holidayOverride:false}).h100).toBe(0))
 it('real holidays',()=>expect(saoPauloHoliday('2026-07-09')).toBe(true))
 it('uses a city-specific calendar without inheriting São Paulo municipal dates',()=>{
  const e={date:'2027-01-25',start:'08:00',lunchStart:'12:00',lunchEnd:'13:00',end:'19:00',holidayOverride:null}
  expect(classifyHours(e,new Set(['2027-01-25'])).h100).toBe(10)
  expect(classifyHours(e,new Set(['2027-01-01'])).h100).toBe(0)
  expect(classifyHours({...e,holidayOverride:true},new Set()).h100).toBe(10)
  expect(classifyHours({...e,holidayOverride:false},new Set(['2027-01-25'])).h100).toBe(0)
 })
 it('quinzena rollover',()=>{expect(paidMonth('2026-10-17')).toBe('2026-11');expect(paidMonth('2026-11-05')).toBe('2026-11')})
})
