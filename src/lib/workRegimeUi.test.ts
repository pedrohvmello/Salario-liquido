import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
const file=(path:string)=>readFileSync(path,'utf8')
describe('Regime de jornada and Free IR flows',()=>{
 it('keeps Base and Regime collapsed initially and saves each choice',()=>{
  const app=file('src/App.tsx')
  expect(app).toContain('<details className="payrep-definition-accordion">')
  expect(app).toContain('Configure sua Base')
  expect(app).toContain('Regime de Jornada')
  expect(app).toContain("saveWorkRegime('trust')")
  expect(app).toContain("saveWorkRegime('regular')")
  expect(app).not.toContain('<details className="payrep-definition-accordion" open')
 })
 it('stops overtime payroll calculations in trust regime',()=>{
  const app=file('src/App.tsx')
  const sheet=file('src/components/FortnightTimesheet.tsx')
  expect(app).toContain("workRegime==='trust'?[]:holidayDates?")
  expect(sheet).toContain('trust?emptyBank():calculateBankLedger')
  expect(sheet).toContain('disabled={trust}')
  expect(sheet).toContain('recordedHoursBalanceMinutes')
  expect(sheet).not.toContain('Configure sua Base ou aguarde o calendário de feriados para exibir os cálculos.')
 })
 it('shows Free IR marketing only for accounts with no stored annual documents',()=>{
  const tax=file('src/components/TaxPreview.tsx')
  const offer=file('src/components/IncomeTaxUpgrade.tsx')
  expect(tax).toContain("accessState==='ready'&&!canUpload&&viewingYears.length===0")
  expect(tax).toContain('onSubscribe={onSubscribe}')
  expect(offer).toContain('Conhecer os planos Basic e Full')
  expect(offer).toContain('Documentos centralizados')
  expect(offer).toContain('Conferência e privacidade')
 })
 it('adds a non-destructive regime column defaulting to regular',()=>{
  const migration=file('supabase/migrations/0089_payrep_work_regime.sql')
  expect(migration).toContain("work_regime text not null default 'regular'")
  expect(migration).not.toMatch(/delete from|truncate table|drop table/i)
 })
})
