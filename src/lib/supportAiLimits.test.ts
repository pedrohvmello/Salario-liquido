import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {validSupportAiLimits} from './supportAiLimits'

describe('Daily Payrep AI quotas controlled by administrators',()=>{
 it('exempts authenticated administrators without requiring MFA solely for AI questions',()=>{
  const edge=readFileSync('supabase/functions/support-ai/index.ts','utf8')
  const ui=readFileSync('src/components/AdminSupportAiLimits.tsx','utf8')
  expect(edge).toContain(".select('active,status,role')")
  expect(edge).toContain("membership.role==='admin'")
  expect(edge).toContain('if(!verifiedAdmin){')
  expect(edge).not.toContain("scoped.rpc('is_app_admin')")
  expect(ui).toContain('Administradores não têm limite interno')
 })
 it('accepts any positive independent daily integer limits',()=>{
  for(const [user,total] of [[8,50],[25,100],[1,1],[500,9999],[1000,10],[10000000,20000000]])
   expect(validSupportAiLimits(user,total)).toBe(true)
 })
 it('rejects negatives, fractions and unsafe numbers',()=>{
  for(const [user,total] of [[0,50],[-1,50],[1,0],[10.5,50],[10,20.25],[NaN,100],[Infinity,100],[Number.MAX_SAFE_INTEGER+1,100]])
   expect(validSupportAiLimits(user,total)).toBe(false)
 })
 it('keeps editing in Admin Settings, never client-side-only enforcement',()=>{
  const page=readFileSync('src/components/AdminSettingsPage.tsx','utf8')
  const admin=readFileSync('src/components/AdminSupportAiLimits.tsx','utf8')
  const api=readFileSync('src/lib/supportAiLimits.ts','utf8')
  expect(page).toContain('<AdminSupportAiLimits/>')
  expect(admin).toContain('Mensagens por usuário comum / dia')
  expect(admin).toContain('Mensagens totais de usuários comuns / dia')
  expect(admin).toContain('Salvar limites da IA')
  expect(api).toContain("rpc('get_support_ai_limits')")
  expect(api).toContain("rpc('set_support_ai_limits'")
  expect(api).toContain('validSupportAiLimits')
 })
 it('enforces server-side limits in a locked transaction with MFA-protected admin RPCs',()=>{
  const migration=readFileSync('supabase/migrations/0031_support_ai_configurable_limits_hml.sql','utf8')
  expect(migration).toContain('private.is_current_admin()')
  expect(migration).toContain('pg_advisory_xact_lock')
  expect(migration).toContain('v_global >= v_global_limit')
  expect(migration).toContain('v_count >= v_user_limit')
  expect(migration).toContain('auth.uid()')
  expect(migration).toContain('support_ai_daily_limits')
  expect(migration).toContain('revoke all on function public.get_support_ai_limits() from public,anon,authenticated')
  expect(migration).toContain('revoke all on function public.set_support_ai_limits(integer,integer) from public,anon,authenticated')
  expect(migration).toContain('grant execute on function public.get_support_ai_limits() to authenticated')
  expect(migration).toContain('grant execute on function public.set_support_ai_limits(integer,integer) to authenticated')
 })
})
