import {describe,it,expect} from 'vitest'
import {defaultPensionRule,encodePensionNotes,parsePensionNotes} from './pensionRule'
import {changeCardVisibility,defaultOverviewCards,followingMonth,moveOverviewCard,normalizeOverviewCards,projectedMealBenefit,workingDays,selectCompetence,reorderOverviewCardTo,isOverviewWideSection,normalizeOverviewCardColors,setOverviewCardColor,overviewCardPalette} from './overview'
import {effectiveParams} from './data'
import {calculatePayroll2026,defaults} from './money'
describe('pension event semantics',()=>{
 it('does not apply 26% to an account without pension events',()=>{
  const params=effectiveParams({...defaults,salary:15000,pensionPercent:26,pensionMethod:'old26'},[],'2026-11')
  expect(params.pensionMethod).toBe('none')
  expect(calculatePayroll2026(params).pension).toBe(0)
 })
 it('activates only after the effective month and deactivates after event removal',()=>{
  const events=[{id:'p',kind:'pensionPercent',effective_date:'2026-11-04',value:26,notes:''}]
  expect(effectiveParams(defaults,events,'2026-10').pensionMethod).toBe('none')
  expect(effectiveParams(defaults,events,'2026-11').pensionMethod).toBe('old26')
  expect(effectiveParams(defaults,[],'2026-11').pensionMethod).toBe('none')
 })
 it('round trips criteria without leaking encoded metadata into notes',()=>{
  const encoded=encodePensionNotes('Decisão judicial',defaultPensionRule)
  const parsed=parsePensionNotes(encoded)
  expect(parsed.note).toBe('Decisão judicial')
  expect(parsed.rule).toEqual(defaultPensionRule)
  expect(parsePensionNotes('Texto anterior').note).toBe('Texto anterior')
 })
 it('supports optional IRRF and INSS deductions, and overtime inclusion',()=>{
  const a=calculatePayroll2026({...defaults,salary:12000,pensionMethod:'old26',pensionPercent:26})
  const b=calculatePayroll2026({...defaults,salary:12000,pensionMethod:'old26',pensionPercent:26,pensionRule:{excludeInss:false,excludeIrrf:false,includeOvertime:true}})
  expect(b.pension).toBeGreaterThan(a.pension)
  const c=calculatePayroll2026({...defaults,salary:12000,overtimePay:1200,pensionMethod:'old26',pensionPercent:26,pensionRule:{excludeInss:true,excludeIrrf:true,includeOvertime:false}})
  const d=calculatePayroll2026({...defaults,salary:12000,overtimePay:1200,pensionMethod:'old26',pensionPercent:26,pensionRule:{excludeInss:true,excludeIrrf:true,includeOvertime:true}})
  expect(c.pension).toBeLessThan(d.pension)
 })
})
describe('overview cards and advance month VR',()=>{
 it('keeps user-defined ordering and hidden cards',()=>{
  const a=changeCardVisibility(defaultOverviewCards,'fgts',false)
  expect(a).not.toContain('fgts')
  const oldPosition=a.indexOf('pensionPercent')
  expect(moveOverviewCard(a,'pensionPercent',-1).indexOf('pensionPercent')).toBe(oldPosition-1)
  expect(moveOverviewCard(['gross','pensionPercent','fgts'],'fgts',-1)).toEqual(['gross','fgts','pensionPercent','salaryComposition','competenceOvertime'])
  expect(normalizeOverviewCards(['espp','gross','espp','unknown'])).toEqual(['espp','gross','salaryComposition','competenceOvertime'])
 })
 it('handles year rollover',()=>expect(followingMonth('2026-12')).toBe('2027-01'))
 it('restores the current month when the native picker is cleared',()=>{
  expect(selectCompetence('','2026-11')).toBe('2026-11')
  expect(selectCompetence('2026-01','2026-11')).toBe('2026-01')
  expect(selectCompetence('2026-00','2026-11')).toBe('2026-11')
  expect(selectCompetence('invalid','2026-11')).toBe('2026-11')
 })
 it('calculates 19 working days of November 2026 and R$842,27',()=>{
  const holidays=new Set(['2026-11-02','2026-11-20'])
  expect(workingDays('2026-11',holidays)).toBe(19)
  expect(projectedMealBenefit(44.33,'2026-10',holidays)).toEqual({referenceMonth:'2026-11',days:19,total:842.27})
 })
 it('never treats weekends as payable days',()=>{
  expect(workingDays('2026-11',new Set())).toBe(21)
 })
})

describe('new IRRF and INSS overview cards',()=>{
 it('uses the same monthly payroll values and makes the cards visible by default',()=>{
  const payroll=calculatePayroll2026({...defaults,salary:16000})
  expect(payroll.irrf).toBeGreaterThan(0)
  expect(payroll.inss).toBeGreaterThan(0)
  expect(defaultOverviewCards).toContain('irrf')
  expect(defaultOverviewCards).toContain('inss')
 })
 it('adds both cards once to a legacy saved layout and retains its relative order',()=>{
  expect(normalizeOverviewCards(['gross','fgts'],1))
   .toEqual(['gross','fgts','irrf','inss','salaryComposition','competenceOvertime'])
  expect(normalizeOverviewCards(['gross','irrf','fgts'],1))
   .toEqual(['gross','irrf','fgts','inss','salaryComposition','competenceOvertime'])
 })
 it('respects deliberately hidden cards after the layout is saved as version 2',()=>{
  const updated=normalizeOverviewCards(['gross','fgts','irrf','inss'],2)
  const hidden=changeCardVisibility(changeCardVisibility(updated,'irrf',false),'inss',false)
  expect(normalizeOverviewCards(hidden,2)).not.toContain('irrf')
  expect(normalizeOverviewCards(hidden,2)).not.toContain('inss')
 })
})
describe('pastel dashboard card colors',()=>{
 it('offers a constrained soft palette, including a reset option',()=>{
  expect(overviewCardPalette.map(x=>x.id)).toEqual([
   'default','lavender','blue','green','yellow','pink','peach','gray'
  ])
 })
 it('preserves independent colors and removes the default override',()=>{
  const colored=setOverviewCardColor({},'irrf','blue')
  const both=setOverviewCardColor(colored,'inss','green')
  expect(both).toEqual({irrf:'blue',inss:'green'})
  expect(setOverviewCardColor(both,'irrf','default')).toEqual({inss:'green'})
 })
 it('discards unknown card IDs and injected or invalid CSS colors',()=>{
  expect(normalizeOverviewCardColors({
   irrf:'lavender',inss:'red; background:url(javascript:alert(1))',
   unknown:'blue',salaryComposition:'peach'
  })).toEqual({irrf:'lavender',salaryComposition:'peach'})
 })
})

describe('mobile overview card rearrangement',()=>{
 it('allows sections to occupy and move among metric-card grid slots',()=>{
  expect(isOverviewWideSection('salaryComposition')).toBe(true)
  expect(isOverviewWideSection('competenceOvertime')).toBe(true)
  expect(isOverviewWideSection('gross')).toBe(false)
  const reordered=reorderOverviewCardTo(['gross','espp','salaryComposition','competenceOvertime'],'salaryComposition',0)
  expect(reordered[0]).toBe('salaryComposition')
  expect(reordered).toContain('competenceOvertime')
  expect(changeCardVisibility(reordered,'salaryComposition',false)).toContain('salaryComposition')
 })
 it('inserts at a chosen row/column slot, shifting later cards forward',()=>{
  const original=['gross','deductions','fgts','mealBenefit','espp'] as const
  expect(reorderOverviewCardTo([...original],'espp',1)).toEqual(['gross','espp','deductions','fgts','mealBenefit','salaryComposition','competenceOvertime'])
  expect(reorderOverviewCardTo([...original],'gross',4)).toEqual(['deductions','fgts','mealBenefit','espp','gross','salaryComposition','competenceOvertime'])
 })
 it('ignores invalid drop locations, preserving hidden cards',()=>{
  const current=changeCardVisibility(defaultOverviewCards,'fgts',false)
  expect(reorderOverviewCardTo(current,'fgts',1)).toEqual(current)
  expect(reorderOverviewCardTo(current,'espp',-1)).toEqual(current)
  expect(reorderOverviewCardTo(current,'espp',1000)).toEqual(current)
 })
})
