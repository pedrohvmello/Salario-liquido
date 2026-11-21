import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
describe('Admin access and initial application visibility',()=>{
 it('shows Basic/Full grants with searchable user selection and revoke action',()=>{
  const src=readFileSync('src/components/AdminFullTrials.tsx','utf8')
  expect(src).toContain('Acesso promocional')
  expect(src).toContain('searchable value={target}')
  expect(src).toContain('Duração')
  expect(src).toContain('Dias restantes')
  expect(src).toContain('revokePromotionalAccess')
 })
 it('shows code redemptions, source code and days remaining',()=>{
  const src=readFileSync('src/components/AdminPromoCodes.tsx','utf8')
  expect(src).toContain('Usuários que utilizaram códigos promocionais')
  expect(src).toContain('row.code')
  expect(src).toContain('daysRemaining')
  expect(src).toContain('admin-promo-actions')
 })
 it('offers audited manual access separate from provider billing',()=>{
  const src=readFileSync('src/components/AdminUserPlans.tsx','utf8')
  expect(src).toContain('changeAdminPlan')
  expect(src).toContain('Plano contratado')
  expect(src).toContain('Acesso efetivo')
  expect(src).toContain('não foram modificados')
 })
 it('recovers new login at overview and shows explicit page error instead of a blank panel',()=>{
  const app=readFileSync('src/App.tsx','utf8')
  const fallback=readFileSync('src/components/AppPageBoundary.tsx','utf8')
  expect(app).toContain("bootstrappedIdentityRef.current===user.id")
  expect(app).toContain("<AppPageBoundary key={section}")
  expect(fallback).toContain('Não foi possível exibir esta tela')
 })
})
