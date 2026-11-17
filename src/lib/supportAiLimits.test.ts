import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {validPepLimits} from './supportAiLimits'
import {parseAiInput} from '../../supabase/functions/support-ai/validation'

describe('Pep quotas by mode and effective plan',()=>{
 it('validates the three per-user limits and global limit',()=>{
  expect(validPepLimits(50,20,50,500)).toBe(true)
  expect(validPepLimits(8,100,100,100)).toBe(true)
  expect(validPepLimits(50,51,50,500)).toBe(false)
  expect(validPepLimits(0,10,20,100)).toBe(false)
  expect(validPepLimits(20,10.5,30,100)).toBe(false)
  expect(validPepLimits(1,1,1,Number.MAX_SAFE_INTEGER+1)).toBe(false)
 })
 it('requires explicit help or personal mode to prevent financial-data bypass',()=>{
  expect(parseAiInput({question:'Como importar holerite?',mode:'help'}).value?.mode).toBe('help')
  expect(parseAiInput({question:'Quanto ganhei?',mode:'personal'}).value?.mode).toBe('personal')
  expect(parseAiInput({question:'Quanto ganhei?',useFinancialData:true}).value).toBeNull()
  expect(parseAiInput({question:'Quanto ganhei?',mode:'help',useFinancialData:true}).value).toBeNull()
 })
 it('enforces separate help/personal quota counters and only Full can read payslip data',()=>{
  const migration=readFileSync('supabase/migrations/0057_hml_pep_plan_quotas.sql','utf8')
  const edge=readFileSync('supabase/functions/support-ai/index.ts','utf8')
  expect(migration).toContain("mode text not null check(mode in ('help','personal'))")
  expect(migration).toContain("p_mode='personal'")
  expect(migration).toContain('v_settings.pep_full_daily_limit')
  expect(migration).toContain('pg_advisory_xact_lock')
  expect(migration).toContain("if v_role='admin' then return 'ok'")
  expect(edge).toContain("const canReadPayslips=paidPlan==='full'")
  expect(edge).toContain("if(personalQuestion)")
  expect(edge).toContain("p_mode:mode")
  expect(edge).not.toContain('reserve_support_ai_request')
 })
 it('keeps all limits editable in administrative settings',()=>{
  const ui=readFileSync('src/components/AdminSupportAiLimits.tsx','utf8')
  expect(ui).toContain('Pep Ajuda | consultas por usuário')
  expect(ui).toContain('Pep Basic | consultas pessoais')
  expect(ui).toContain('Pep Full | consultas pessoais')
  expect(ui).toContain('Limite global')
  expect(ui).toContain('Salvar limites do Pep')
 })
})
