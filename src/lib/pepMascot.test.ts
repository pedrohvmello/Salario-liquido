import {describe,expect,it} from 'vitest'
import {existsSync,readFileSync} from 'node:fs'

describe('Pep mascot in HML help and chat',()=>{
 it('uses the requested help copy and truthful financial opt-in description',()=>{
  const help=readFileSync('src/components/SupportPage.tsx','utf8')
  expect(help).toContain('Pergunte ao Pep')
  expect(help).toContain('Escreva sua pergunta ao Pep e receba orientações sobre como utilizar o Payrep.')
  expect(help).toContain('<PepMascot variant="help"/>')
  expect(help).not.toContain('Ainda não consulta seus holerites nem valores individuais.')
  expect(help).toContain('Com sua autorização, o Pep pode consultar resumos dos seus holerites')
  expect(help).toContain('VITE_HML_SUPABASE_PROJECT_REF')
 })
 it('gives Pep a distinct chat header, avatar, reply identity and thinking state',()=>{
  const chat=readFileSync('src/components/SupportAiChat.tsx','utf8')
  expect(chat).toContain('<PepMascot variant="header"/>')
  expect(chat).toContain('<PepMascot variant="avatar"/>')
  expect(chat).toContain('<PepMascot variant="thinking"/>')
  expect(chat).toContain("item.role==='user'?'Você':'Pep'")
  expect(chat).toContain('Pep está analisando...')
  expect(chat).toContain('Permitir consultas aos meus dados salariais')
 })
 it('uses the approved, reusable lightweight mascot asset with no external host',()=>{
  const mascot=readFileSync('src/components/PepMascot.tsx','utf8')
  expect(mascot).toContain('/brand/pep-mascot.avif')
  expect(mascot).toContain('alt=')
  expect(existsSync('public/brand/pep-mascot.avif')).toBe(true)
 })
 it('does not overlap content and respects reduced motion and mobile layout',()=>{
  const css=readFileSync('src/styles.css','utf8')
  expect(css).toContain('.help-ai-entry{display:grid;')
  expect(css).toContain('.payrep-ai-header-actions')
  expect(css).toContain('.pep-chat-reply-avatar')
  expect(css).toContain('@media(prefers-reduced-motion:reduce)')
  expect(css).toContain('.pep-mascot-header{display:none}')
 })
})
