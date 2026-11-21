import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
const file=(path:string)=>readFileSync(path,'utf8')
describe('Immutable personal Pep quota contract',()=>{
 const migration=file('supabase/migrations/0088_payrep_pep_paid_quota_snapshots.sql')
 it('captures offer server-side, immutable across checkout updates',()=>{
  expect(migration).toContain('create trigger payrep_pep_checkout_offer before insert')
  expect(migration).toContain('private.capture_pep_offer_snapshot')
  expect(migration).toContain('Contracted Pep offer is immutable')
  expect(migration).toContain('new.pep_personal_daily_limit_snapshot:=v_limit')
 })
 it('links activation to the verified Asaas subscription and preserves renewals',()=>{
  expect(migration).toContain("e.event_type='SUBSCRIPTION_CREATED'")
  expect(migration).toContain("i.status='paid'")
  expect(migration).toContain('new.pep_personal_daily_limit_snapshot:=old.pep_personal_daily_limit_snapshot')
  expect(migration).toContain("Verified contract quota snapshot not found")
 })
 it('enforces the larger of current allowance and subscribed minimum',()=>{
  expect(migration).toContain('greatest(')
  expect(migration).toContain('private.guaranteed_pep_personal_daily_limit(p_user_id,v_plan)')
  expect(migration).toContain('private.guaranteed_pep_personal_daily_limit(v_uid,v_plan)')
 })
 it('shows all plan benefits and limits before payment',()=>{
  const sub=file('src/components/SubscriptionPage.tsx')
  const benefit=file('src/components/PlanBenefitsDialog.tsx')
  expect(sub).toContain('Ver benefícios e limites')
  expect(sub).toContain('loadMyPlanBenefitLimits()')
  expect(benefit).toContain('Franquia preservada na contratação')
  expect(benefit).toContain('globalDailyLimit')
  expect(benefit).toContain('contrat')
 })
})
