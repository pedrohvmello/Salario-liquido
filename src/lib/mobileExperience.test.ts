import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'

const app=readFileSync('src/App.tsx','utf8')
const hours=readFileSync('src/components/FortnightTimesheet.tsx','utf8')
const cards=readFileSync('src/components/OverviewCardsEditor.tsx','utf8')
const styles=readFileSync('src/styles.css','utf8')

describe('Payrep smartphone-only experience',()=>{
 it('keeps the established desktop tables and adds touch-only presentations',()=>{
  expect(styles).toContain('@media (max-width:760px) and (pointer:coarse)')
  expect(styles).toContain('.payrep-desktop-only{display:none!important}')
  expect(styles).toContain('.payrep-mobile-only{display:flex!important}')
  expect(app).toContain('<table className="annual-salary-table">')
  expect(app).toContain('<table className="events-table">')
  expect(app).toContain('payrep-mobile-only payrep-mobile-list')
  expect(app).toContain('mobile-import-record')
 })
 it('edits the same day entries and saves via the existing timesheet path',()=>{
  expect(hours).toContain('className="fortnight-mobile-days"')
  expect(hours).toContain("change(row.date,{[key]:event.target.value})")
  expect(hours).toContain("change(row.date,{bankHours:event.target.checked})")
  expect(hours).toContain("change(row.date,{holidayOverride:event.target.checked})")
  expect(hours).toContain('saveTimeEntries(changed)')
  expect(hours).toContain('className="fortnight-table"')
 })
 it('preserves long-press dragging of dashboard cards',()=>{
  expect(cards).toContain('holdTimer.current=setTimeout')
  expect(cards).toContain('setPointerCapture(event.pointerId)')
  expect(cards).toContain('onPointerDown={e=>cardDown(e,id)}')
  expect(cards).toContain('onPointerMove={cardMove}')
  expect(cards).toContain('onPointerUp={cardUp}')
  expect(styles).toContain('.overview-card-editing{touch-action:none}')
  expect(styles).not.toContain('touch-action:pan-x!important')
 })
 it('adapts financial and administration tables in touch viewports',()=>{
  for(const file of [
   'src/components/ThirteenthOverview.tsx',
   'src/components/VacationOverview.tsx',
   'src/components/BillingPaymentHistory.tsx',
   'src/components/AdminDashboard.tsx',
   'src/components/TaxPreview.tsx',
   'src/components/FinancialInsights.tsx',
   'src/components/AdminCollectiveLibrary.tsx'
  ])expect(readFileSync(file,'utf8')).toContain('mobile-stack-table')
  expect(styles).toContain('.mobile-stack-table tbody td::before')
  expect(styles).toContain('.mobile-stack-table.mobile-thirteenth')
 })
})
