import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {AI_LIMITS,validSupportAiLimits} from './supportAiLimits'

describe('Daily Payrep AI quotas controlled by administrators',()=>{
 it('exempts only MFA-verified administrators from application-level quotas',()=>{
  const edge=readFileSync('supabase/functions/support-ai/index.ts','utf8')
  const sql=readFileSync('supabase/migrations/0032_support_ai_admin_unlimited_hml.sql','utf8')
  const ui=readFileSync('src/components/AdminSupportAiLimits.tsx','utf8')
  expect(edge).toContain("scoped.rpc('is_app_admin')")
  expect(edge).toContain("typeof verifiedAdmin!=='boolean'")
  expect(edge).toContain("if(!verifiedAdmin){")
  expect(edge).toContain("reserve_support_ai_request")
  expect(edge).not.toContain("req.headers.get('x-payrep-admin')")
  expect(sql).toContain("m.role='admin'")
  expect(sql).toContain("not exists (")
  expect(sql).toContain("usage_day")
  expect(ui).toContain('Administradores com autenticação MFA validada não têm limite')
  expect(ui).toContain('franquia gratuita da Cloudflare')
 })

 it('accepts configurable daily quotas in the intended safe ranges',()=>{
  expect(validSupportAiLimits(8,50)).toBe(true)
  expect(validSupportAiLimits(25,100)).toBe(true)
  expect(validSupportAiLimits(1,1)).toBe(true)
  expect(validSupportAiLimits(AI_LIMITS.perUserMax,AI_LIMITS.globalMax)).toBe(true)
 })
 it('rejects zero, negatives, fractions, invalid totals and unbounded values',()=>{
  for(const [user,total] of [
   [0,50],[-1,50],[1,0],[10,9],[10.5,50],[10,20.25],
   [101,200],[10,301],[NaN,100],[Infinity,100]
  ])expect(validSupportAiLimits(user,total)).toBe(false)
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
