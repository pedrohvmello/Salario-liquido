import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {helpFaq,SUPPORT_EMAIL} from '../components/SupportPage'

describe('Payrep sidebar, avatar and support center',()=>{
 it('keeps institutional links inside the sidebar footer',()=>{
  const app=readFileSync('src/App.tsx','utf8')
  expect(app).toContain('className="sidebar-footer"')
  for(const path of ['/sobre','/privacidade','/termos'])expect(app).toContain('href="'+path+'"')
  expect(app).toContain('© 2026 Payrep')
 })
 it('opens Help from the avatar after Security',()=>{
  const profile=readFileSync('src/components/ProfileMenu.tsx','utf8')
  expect(profile.indexOf('> Ajuda</button>')).toBeGreaterThan(profile.indexOf('> Segurança</button>'))
  expect(profile).toContain("onNavigate('help')")
  expect(profile).not.toContain('className="profile-photo-actions"')
  expect(profile).toContain('profile-photo-dialog-backdrop')
  expect(profile).toContain('Ampliar e gerenciar foto do perfil')
 })
 it('exposes FAQs, real ticket submission and a mail contact fallback',()=>{
  expect(helpFaq.length).toBeGreaterThanOrEqual(6)
  expect(SUPPORT_EMAIL).toBe('suporte@payrep.com.br')
  const component=readFileSync('src/components/SupportPage.tsx','utf8')
  expect(component).toContain("db.from('support_tickets')")
  expect(component).toContain('.insert({user_id:current.id')
  expect(component).toContain('Registrar chamado')
  expect(component).toContain('mailto:')
 })
 it('restricts support tickets with RLS',()=>{
  const sql=readFileSync('supabase/migrations/0021_support_tickets.sql','utf8')
  expect(sql).toContain('enable row level security')
  expect(sql).toContain('support_tickets_insert_owner')
  expect(sql).toContain('support_tickets_read_owner_or_admin')
  expect(sql).toContain('private.is_current_admin()')
 })
})
