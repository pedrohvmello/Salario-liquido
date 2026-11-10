import {describe,it,expect} from 'vitest'
import {baseKey,DEFAULT_BASE,isValidBase} from './base'
import {loadHolidayCatalog,publicDatesFromProvider} from './holidayBase'
describe('holiday base',()=>{
 it('uses IBGE identifier',()=>{expect(baseKey(DEFAULT_BASE)).toBe('SP-3550308');expect(isValidBase(DEFAULT_BASE)).toBe(true)})
 it('recognizes city holidays only for that city',async()=>{
  const c=await loadHolidayCatalog(DEFAULT_BASE,[2026])
  expect(c.dates.has('2026-01-25')).toBe(true)
  expect(c.dates.has('2026-07-09')).toBe(true)
  expect(c.dates.has('2026-12-25')).toBe(true)
  expect(c.coverage).toBe('regional')
 })
 it('ignores ponto facultativo in municipal feed',()=>{
  const d=publicDatesFromProvider({data:[{date:'2026-02-16',type:'optional'},{date:'2026-06-04',type:'municipal'},{date:'2026-01-01',type:'national'}]})
  expect([...d]).toEqual(['2026-06-04','2026-01-01'])
 })
})
